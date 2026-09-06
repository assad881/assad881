/* ============================================================
   محرّك التسعير
   السعر النهائي = سعر المواد + تكلفة النقل + رسوم المنصة + الضريبة − الخصم

   وحدة البيع تأتي من المادة نفسها (م³ أو طن) ولا تُخلط داخل الطلب الواحد،
   والكميات والحدود وحمولة الشاحنة كلها بنفس تلك الوحدة.
   لا تُثبَّت أي مادة أو سعر أو منطقة داخل الكود.
   ============================================================ */
window.KX = window.KX || {};
KX.pricing = (function () {
  const U = () => KX.util;

  /* الإعدادات المالية الفعّالة: جدول الإعدادات يتقدّم على القيم الافتراضية */
  async function financeSettings() {
    const def = KX.config.finance;
    const s = await KX.repo.setting('finance', null);
    return Object.assign({}, def, s || {});
  }

  /* حمولة الشاحنة بوحدة المادة المطلوبة */
  function truckCapacity(truck, unit) {
    const v = unit === 'ton' ? truck.capacity_tons : truck.capacity_m3;
    return Number(v) || 0;
  }

  /* السعر العام الساري للمادة عند مورد معيّن — أسعار القائمة فقط */
  async function activePrice(supplierId, materialId, atISO) {
    const at = atISO || U().nowISO();
    const rows = await KX.repo.list('supplier_prices', {
      where: { supplier_id: supplierId, material_id: materialId, is_active: true, customer_id: null }
    });
    const valid = rows.filter(function (p) {
      return (!p.valid_from || p.valid_from <= at) && (!p.valid_to || p.valid_to >= at);
    });
    return U().sortBy(valid, 'valid_from', 'desc')[0] || null;
  }

  /* السعر الخاص: لا يُعرض علنًا. يُستحق بأحد سببين —
     اعتماد العميل في ملفه، أو إدخال كود سعر خاص مصرّح به. */
  async function specialPrice(customerId, supplierId, materialId, unlockCode) {
    if (!customerId) return null;
    const rows = await KX.repo.list('supplier_prices', {
      where: { supplier_id: supplierId, material_id: materialId, is_active: true }
    });
    const special = rows.filter((p) => p.is_special);
    if (!special.length) return null;

    const customer = await KX.repo.get('customer_profiles', customerId);
    const approved = !!(customer && customer.special_pricing_approved);

    for (const p of special) {
      if (p.customer_id && p.customer_id === customerId) return p;      // سعر تعاقدي لهذا العميل
      if (p.customer_id) continue;                                       // سعر عميل آخر
      if (approved) return p;                                            // عميل معتمد لدى الإدارة
      if (unlockCode && p.unlock_code &&
          String(unlockCode).trim().toUpperCase() === String(p.unlock_code).toUpperCase()) return p;
    }
    return null;
  }

  /* شريحة الكمية: خصم تدريجي معرّف داخل سجل السعر */
  function tierUnitPrice(priceRow, qty) {
    let unit = Number(priceRow.price_per_unit);
    U().sortBy(priceRow.tiers || [], 'min_qty').forEach(function (t) {
      if (qty >= Number(t.min_qty)) unit = Number(t.price_per_unit);
    });
    return unit;
  }

  /* تعرفة النقل حسب المنطقة ونوع الشاحنة */
  async function transportRate(zoneId, truckTypeId, transporterId) {
    const where = { zone_id: zoneId, truck_type_id: truckTypeId, is_active: true };
    if (transporterId) where.transporter_id = transporterId;
    const rows = await KX.repo.list('transport_rates', { where: where });
    return U().sortBy(rows, 'price_per_trip')[0] || null;
  }

  /* التحقق من الكوبون وحساب الخصم */
  async function applyCoupon(code, base, customerId) {
    if (!code || !KX.config.features.coupons) return { amount: 0, coupon: null };
    const c = await KX.repo.first('coupons', { code: String(code).toUpperCase(), is_active: true });
    const now = U().nowISO();
    if (!c) return { amount: 0, coupon: null, error: 'الكوبون غير موجود' };
    if (c.valid_from && c.valid_from > now) return { amount: 0, coupon: null, error: 'الكوبون لم يبدأ بعد' };
    if (c.valid_to && c.valid_to < now)     return { amount: 0, coupon: null, error: 'انتهت صلاحية الكوبون' };
    if (c.max_uses && (c.used_count || 0) >= c.max_uses) return { amount: 0, coupon: null, error: 'استُنفد الكوبون' };
    if (c.min_order_value && base < c.min_order_value)
      return { amount: 0, coupon: null, error: 'الحد الأدنى للطلب ' + U().fmtOMR(c.min_order_value) };
    if (c.customer_id && c.customer_id !== customerId)
      return { amount: 0, coupon: null, error: 'الكوبون مخصّص لعميل آخر' };

    let amount = c.discount_type === 'percent' ? base * (Number(c.discount_value) / 100)
                                               : Number(c.discount_value);
    if (c.max_discount) amount = Math.min(amount, Number(c.max_discount));
    return { amount: U().round(Math.min(amount, base), 3), coupon: c };
  }

  /* ============ الحساب الرئيسي ============
     input: { supplier_id, material_id, quantity, order_by ('unit'|'truck'),
              truck_type_id, zone_id, site, customer_id, coupon_code,
              unlock_code, scheduled_at, transporter_id } */
  async function quote(input) {
    const errors = [], warnings = [], notices = [];
    const fin = await financeSettings();

    const material = await KX.repo.get('materials', input.material_id);
    const supplier = await KX.repo.get('suppliers', input.supplier_id);
    const truck    = await KX.repo.get('truck_types', input.truck_type_id);
    const zone     = await KX.repo.get('delivery_zones', input.zone_id);

    if (!material) errors.push('المادة غير متاحة');
    if (!supplier) errors.push('المورد غير متاح');
    if (!zone)     errors.push('منطقة التوصيل غير محددة');
    if (!truck)    errors.push('نوع الشاحنة غير محدد');
    if (errors.length) return { ok: false, errors: errors };

    const unit = material.unit || 'm3';
    const unitLabel = KX.schema.UNITS[unit] || unit;
    const capacity = truckCapacity(truck, unit);
    if (capacity <= 0)
      return { ok: false, errors: ['حمولة ' + truck.name + ' غير معرّفة بوحدة ' + unitLabel] };

    /* 1) الكمية والرحلات — الطلب إما بالوحدة أو بعدد الشاحنات */
    const qtyInput = Number(input.quantity) || 0;
    const quantity = input.order_by === 'truck'
      ? U().round(qtyInput * capacity, 3)
      : U().round(qtyInput, 3);
    const trips = U().ceilDiv(quantity, capacity);
    if (quantity <= 0) return { ok: false, errors: ['أدخل كمية صحيحة'] };

    /* 2) سعر المادة */
    const special = await specialPrice(input.customer_id, input.supplier_id,
                                       input.material_id, input.unlock_code);
    const listRow = await activePrice(input.supplier_id, input.material_id, input.scheduled_at);
    const priceRow = special || listRow;
    if (!priceRow) return { ok: false, errors: ['لا يوجد سعر ساري لهذه المادة عند هذا المورد'] };

    /* الحد الأدنى للتوصيل — شاحنة كاملة عادةً */
    const minQty = Number(priceRow.min_qty || listRow && listRow.min_qty || 0);
    if (minQty && quantity < minQty)
      errors.push('الحد الأدنى للتوصيل ' + U().fmtNum(minQty, 0) + ' ' + unitLabel +
                  ' (شاحنة واحدة)، والمطلوب ' + U().fmtNum(quantity, 1) + ' ' + unitLabel);
    if (priceRow.max_qty && quantity > Number(priceRow.max_qty))
      errors.push('الحد الأقصى للطلب ' + priceRow.max_qty + ' ' + unitLabel);

    const availableToday = Number(priceRow.available_per_day || 0);
    if (availableToday && quantity > availableToday)
      warnings.push('الكمية تتجاوز المتاح يوميًا (' + availableToday + ' ' + unitLabel +
                    ') — قد يُقسَّم التوريد على أكثر من يوم');

    const unitPrice = special ? Number(special.price_per_unit) : tierUnitPrice(priceRow, quantity);
    const materialCost = U().round(quantity * unitPrice, 3);
    if (special) notices.push('طُبّق سعر خاص معتمد لهذه المادة');

    /* 3) تكلفة النقل — بند منفصل دائمًا، لا يُدمج في سعر المادة */
    const rate = await transportRate(input.zone_id, truck.id, input.transporter_id);
    if (!rate) return { ok: false, errors: ['لا توجد تعرفة نقل لهذه المنطقة ونوع الشاحنة'] };

    let distanceKm = null;
    if (input.site && supplier.location) distanceKm = U().distanceKm(supplier.location, input.site);
    const perTrip = U().round(
      Number(rate.price_per_trip) +
      (rate.price_per_km && distanceKm ? Number(rate.price_per_km) * distanceKm : 0), 3);
    const transportCost = U().round(perTrip * trips, 3);

    /* 4) رسوم المنصة */
    const goodsAndFreight = U().round(materialCost + transportCost, 3);
    const platformFee = U().round(
      Number(fin.platformFeeFixed) + goodsAndFreight * Number(fin.platformFeePercent), 3);

    /* 5) الخصم */
    const subtotal = U().round(goodsAndFreight + platformFee, 3);
    const cp = await applyCoupon(input.coupon_code, subtotal, input.customer_id);
    if (cp.error) warnings.push(cp.error);
    const discount = cp.amount;

    /* 6) الضريبة — بند مستقل يُحسب عند انطباقه */
    const taxable = U().round(subtotal - discount, 3);
    const vatRate = fin.vatEnabled ? Number(fin.vatRate) : 0;
    const vat = U().round(taxable * vatRate, 3);

    /* 7) الإجمالي */
    const total = U().round(taxable + vat, 3);

    /* 8) توزيع المستحقات والعمولة — لا يُعرض للعميل */
    const supplierCommission    = U().round(materialCost  * Number(fin.supplierCommissionPercent), 3);
    const transporterCommission = U().round(transportCost * Number(fin.transporterCommissionPercent), 3);
    const platformRevenue       = U().round(platformFee + supplierCommission + transporterCommission, 3);

    return {
      ok: errors.length === 0,
      errors: errors, warnings: warnings, notices: notices,
      inputs: {
        material_id: material.id, material_sku: material.sku,
        material_name: KX.i18n.pick(material.name_i18n, material.name),
        material_name_ar: (material.name_i18n || {}).ar || material.name,
        material_size: material.size || '',
        supplier_id: supplier.id, supplier_name: supplier.name,
        zone_id: zone.id, zone_name: zone.name,
        truck_id: truck.id, truck_name: truck.name, truck_capacity: capacity,
        unit: unit, unit_label: unitLabel,
        order_by: input.order_by || 'unit', quantity_entered: qtyInput,
        distance_km: distanceKm,
        price_row_id: priceRow.id, is_special_price: !!special
      },
      quantities: { quantity: quantity, unit: unit, trips: trips, capacity: capacity, min_qty: minQty },
      lines: {
        unit_price: unitPrice,
        material_cost: materialCost,
        transport_per_trip: perTrip,
        transport_cost: transportCost,
        platform_fee: platformFee,
        discount: discount,
        coupon_code: cp.coupon ? cp.coupon.code : null,
        vat_rate: vatRate,
        vat: vat
      },
      totals: { subtotal: subtotal, taxable: taxable, total: total },
      internal: {
        supplier_commission: supplierCommission,
        transporter_commission: transporterCommission,
        platform_fee: platformFee,
        platform_revenue: platformRevenue,
        supplier_payable: U().round(materialCost - supplierCommission, 3),
        transporter_payable: U().round(transportCost - transporterCommission, 3),
        margin_per_unit: U().round(platformRevenue / quantity, 3)
      },
      priced_at: U().nowISO()
    };
  }

  /* رسوم الانتظار — تُضاف بعد اعتمادها من الإدارة فقط */
  async function waitingCharge(minutes) {
    const fin = await financeSettings();
    const billable = Math.max(0, Number(minutes) - Number(fin.waitingFreeMinutes));
    return KX.util.round((billable / 60) * Number(fin.waitingRatePerHour), 3);
  }

  return { quote, activePrice, specialPrice, transportRate, applyCoupon,
           waitingCharge, financeSettings, tierUnitPrice, truckCapacity };
})();
