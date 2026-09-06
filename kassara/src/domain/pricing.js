/* ============================================================
   محرّك التسعير
   السعر النهائي = سعر المواد + تكلفة النقل + رسوم المنصة + الضريبة − الخصم
   لا تُثبَّت أي مادة أو سعر أو منطقة داخل الكود؛ كل شيء يُقرأ من قاعدة البيانات.
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

  /* السعر الساري للمادة عند مورد معيّن في تاريخ معيّن */
  async function activePrice(supplierId, materialId, atISO) {
    const at = atISO || U().nowISO();
    /* أسعار القائمة العامة فقط — الأسعار التعاقدية الخاصة بعميل تُقرأ من customerPrice */
    const rows = await KX.repo.list('supplier_prices', {
      where: { supplier_id: supplierId, material_id: materialId, is_active: true, customer_id: null }
    });
    const valid = rows.filter(function (p) {
      const from = !p.valid_from || p.valid_from <= at;
      const to   = !p.valid_to   || p.valid_to   >= at;
      return from && to;
    });
    return U().sortBy(valid, 'valid_from', 'desc')[0] || null;
  }

  /* سعر خاص لعميل معتمد (يتقدّم على سعر القائمة) */
  async function customerPrice(customerId, supplierId, materialId) {
    if (!customerId) return null;
    const rows = await KX.repo.list('supplier_prices', {
      where: { supplier_id: supplierId, material_id: materialId,
               customer_id: customerId, is_active: true }
    });
    return rows[0] || null;
  }

  /* شريحة الكمية: خصم تدريجي معرّف داخل سجل السعر */
  function tierUnitPrice(priceRow, tons) {
    let unit = Number(priceRow.price_per_ton);
    const tiers = priceRow.tiers || [];
    U().sortBy(tiers, 'min_qty').forEach(function (t) {
      if (tons >= Number(t.min_qty)) unit = Number(t.price_per_ton);
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
     input: { supplier_id, material_id, quantity, unit, truck_type_id,
              zone_id, site, customer_id, coupon_code, scheduled_at, transporter_id } */
  async function quote(input) {
    const errors = [], warnings = [];
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

    const capacity = Number(truck.capacity_tons) || 0;
    if (capacity <= 0) return { ok: false, errors: ['حمولة الشاحنة غير معرّفة'] };

    /* 1) الكمية والرحلات */
    const qty = Number(input.quantity) || 0;
    const tons  = input.unit === 'truck' ? U().round(qty * capacity, 3) : U().round(qty, 3);
    const trips = U().ceilDiv(tons, capacity);
    if (tons <= 0) return { ok: false, errors: ['أدخل كمية صحيحة'] };

    /* 2) سعر المادة */
    const special = await customerPrice(input.customer_id, input.supplier_id, input.material_id);
    const listRow = await activePrice(input.supplier_id, input.material_id, input.scheduled_at);
    const priceRow = special || listRow;
    if (!priceRow) return { ok: false, errors: ['لا يوجد سعر ساري لهذه المادة عند هذا المورد'] };

    if (priceRow.min_qty_tons && tons < Number(priceRow.min_qty_tons))
      errors.push('الحد الأدنى للطلب ' + priceRow.min_qty_tons + ' طن');
    if (priceRow.max_qty_tons && tons > Number(priceRow.max_qty_tons))
      errors.push('الحد الأقصى للطلب ' + priceRow.max_qty_tons + ' طن');

    /* التوفّر اليومي المعلن من المورد */
    const availableToday = Number(priceRow.available_tons_per_day || 0);
    if (availableToday && tons > availableToday)
      warnings.push('الكمية تتجاوز التوفّر اليومي المعلن (' + availableToday + ' طن) — قد يُقسَّم التوريد على أكثر من يوم');

    const unitPrice = special ? Number(special.price_per_ton) : tierUnitPrice(priceRow, tons);
    const materialCost = U().round(tons * unitPrice, 3);

    /* 3) تكلفة النقل */
    const rate = await transportRate(input.zone_id, truck.id, input.transporter_id);
    if (!rate) return { ok: false, errors: ['لا توجد تعرفة نقل لهذه المنطقة ونوع الشاحنة'] };

    let distanceKm = null;
    if (input.site && supplier.location) {
      distanceKm = U().distanceKm(supplier.location, input.site);
    }
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

    /* 6) الضريبة */
    const taxable = U().round(subtotal - discount, 3);
    const vatRate = fin.vatEnabled ? Number(fin.vatRate) : 0;
    const vat = U().round(taxable * vatRate, 3);

    /* 7) الإجمالي */
    const total = U().round(taxable + vat, 3);

    /* 8) توزيع المستحقات والعمولة (لا تُعرض للعميل) */
    const supplierCommission   = U().round(materialCost  * Number(fin.supplierCommissionPercent), 3);
    const transporterCommission= U().round(transportCost * Number(fin.transporterCommissionPercent), 3);
    const platformRevenue      = U().round(platformFee + supplierCommission + transporterCommission, 3);
    const supplierPayable      = U().round(materialCost - supplierCommission, 3);
    const transporterPayable   = U().round(transportCost - transporterCommission, 3);

    return {
      ok: errors.length === 0,
      errors: errors, warnings: warnings,
      inputs: {
        material_id: material.id, material_name: material.name,
        supplier_id: supplier.id, supplier_name: supplier.name,
        zone_id: zone.id, zone_name: zone.name,
        truck_id: truck.id, truck_name: truck.name, truck_capacity: capacity,
        unit: input.unit || 'ton', quantity: qty, distance_km: distanceKm,
        price_row_id: priceRow.id, is_special_price: !!special
      },
      quantities: { tons: tons, trips: trips, capacity_tons: capacity },
      lines: {
        unit_price_per_ton: unitPrice,
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
        supplier_payable: supplierPayable,
        transporter_payable: transporterPayable,
        margin_per_ton: U().round(platformRevenue / tons, 3)
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

  return { quote, activePrice, transportRate, applyCoupon, waitingCharge, financeSettings, tierUnitPrice };
})();
