/* ============================================================
   اختبار ذاتي للسيناريوهات والأخطاء والصلاحيات (المرحلة السادسة)
   التشغيل: أضف ?selftest=1 إلى الرابط، أو نفّذ KX.selftest.run() في الطرفية.
   تنبيه: يعيد تهيئة البيانات المحلية قبل الاختبار وبعده.
   ============================================================ */
window.KX = window.KX || {};
KX.selftest = (function () {
  const results = [];
  let currentGroup = '';

  function group(name) { currentGroup = name; }
  async function t(name, fn) {
    try { await fn(); results.push({ group: currentGroup, name: name, ok: true }); }
    catch (err) { results.push({ group: currentGroup, name: name, ok: false, error: err.message }); }
  }
  function assert(cond, msg) { if (!cond) throw new Error(msg || 'فشل التحقق'); }
  function near(a, b, tol) { assert(Math.abs(Number(a) - Number(b)) <= (tol || 0.002),
    'القيمة ' + a + ' لا تساوي ' + b); }
  async function throws(fn, expect) {
    let threw = false, msg = '';
    try { await fn(); } catch (e) { threw = true; msg = e.message; }
    assert(threw, 'كان يجب أن ترفض العملية: ' + (expect || ''));
    if (expect) assert(msg.indexOf(expect) !== -1, 'رسالة الخطأ غير متوقعة: ' + msg);
  }
  const asRole = (role, extra) =>
    KX.store.set('session', Object.assign({ user_id: 'test', name: 'اختبار', role: role }, extra || {}));

  async function run() {
    results.length = 0;
    const savedSession = KX.store.get('session');
    await KX.seed.run(true);

    const [sup, mat, truck, zone, cust, site] = await Promise.all([
      KX.repo.first('suppliers', { code: 'SUP-WD' }),
      KX.repo.first('materials', { code: 'BASE' }),
      KX.repo.first('truck_types', { code: 'TIP25' }),
      KX.repo.first('delivery_zones', { code: 'IBR-C' }),
      KX.repo.first('customer_profiles', { phone: '96890000001' }),
      null
    ]);
    const sites = await KX.repo.list('locations', { where: { customer_id: cust.id } });
    const theSite = sites[0];

    /* ---------- 1) التسعير ---------- */
    group('التسعير');
    let quote;
    await t('حساب عرض سعر صحيح', async function () {
      quote = await KX.pricing.quote({
        supplier_id: sup.id, material_id: mat.id, quantity: 50, unit: 'ton',
        truck_type_id: truck.id, zone_id: zone.id, site: theSite.coords, customer_id: cust.id
      });
      assert(quote.ok, 'العرض غير صالح: ' + (quote.errors || []).join(', '));
    });
    await t('عدد الرحلات = تقريب لأعلى للكمية ÷ الحمولة', function () {
      assert(quote.quantities.trips === Math.ceil(50 / 25), 'عدد الرحلات خاطئ');
    });
    await t('معادلة السعر: مواد + نقل + رسوم − خصم + ضريبة', function () {
      const L = quote.lines;
      const sub = L.material_cost + L.transport_cost + L.platform_fee;
      near(quote.totals.subtotal, sub);
      near(quote.totals.taxable, sub - L.discount);
      near(L.vat, (sub - L.discount) * L.vat_rate);
      near(quote.totals.total, (sub - L.discount) + L.vat);
    });
    await t('الطلب بعدد الشاحنات يساوي الكمية × الحمولة', async function () {
      const q2 = await KX.pricing.quote({
        supplier_id: sup.id, material_id: mat.id, quantity: 2, unit: 'truck',
        truck_type_id: truck.id, zone_id: zone.id, site: theSite.coords, customer_id: cust.id
      });
      assert(q2.quantities.tons === 50 && q2.quantities.trips === 2, 'تحويل الشاحنات إلى أطنان خاطئ');
    });
    await t('شريحة الكمية تخفض سعر الطن', async function () {
      const small = await KX.pricing.quote({ supplier_id: sup.id, material_id: mat.id, quantity: 30,
        unit: 'ton', truck_type_id: truck.id, zone_id: zone.id, site: theSite.coords, customer_id: cust.id });
      const big = await KX.pricing.quote({ supplier_id: sup.id, material_id: mat.id, quantity: 600,
        unit: 'ton', truck_type_id: truck.id, zone_id: zone.id, site: theSite.coords, customer_id: cust.id });
      assert(big.lines.unit_price_per_ton < small.lines.unit_price_per_ton, 'الشريحة لم تُطبَّق');
    });
    await t('رفض الكمية دون الحد الأدنى', async function () {
      const q = await KX.pricing.quote({ supplier_id: sup.id, material_id: mat.id, quantity: 1,
        unit: 'ton', truck_type_id: truck.id, zone_id: zone.id, site: theSite.coords, customer_id: cust.id });
      assert(!q.ok, 'كان يجب رفض الكمية الصغيرة');
    });
    await t('الكوبون يخصم ضمن حده الأقصى', async function () {
      const q = await KX.pricing.quote({ supplier_id: sup.id, material_id: mat.id, quantity: 100,
        unit: 'ton', truck_type_id: truck.id, zone_id: zone.id, site: theSite.coords,
        customer_id: cust.id, coupon_code: 'WELCOME10' });
      assert(q.lines.discount > 0 && q.lines.discount <= 15, 'الخصم خارج الحدود');
    });
    await t('السعر التعاقدي للعميل يتقدّم على سعر القائمة', async function () {
      const company = await KX.repo.first('customer_profiles', { phone: '96890000002' });
      const q = await KX.pricing.quote({ supplier_id: sup.id, material_id: mat.id, quantity: 100,
        unit: 'ton', truck_type_id: truck.id, zone_id: zone.id, site: theSite.coords, customer_id: company.id });
      assert(q.inputs.is_special_price, 'لم يُستخدم السعر التعاقدي');
      near(q.lines.unit_price_per_ton, 1.200);
    });
    await t('توزيع المستحقات يساوي قيمة المواد والنقل', function () {
      const i = quote.internal, L = quote.lines;
      near(i.supplier_payable + i.supplier_commission, L.material_cost);
      near(i.transporter_payable + i.transporter_commission, L.transport_cost);
    });

    /* ---------- 2) دورة حياة الطلب ---------- */
    group('دورة حياة الطلب');
    let order;
    await t('إنشاء طلب من عرض السعر', async function () {
      asRole('customer', { customer_id: cust.id });
      order = await KX.orders.createFromQuote(quote, {
        customer_id: cust.id, site_id: theSite.id,
        scheduled_at: KX.util.addDays(KX.util.nowISO(), 2), notes: 'اختبار آلي'
      });
      assert(order.status === 'draft' && order.order_no, 'لم يُنشأ الطلب');
      near(order.total, quote.totals.total);
    });
    await t('لقطة السعر محفوظة داخل الطلب', function () {
      assert(order.price_snapshot && order.price_snapshot.totals, 'لقطة السعر مفقودة');
    });
    await t('انتقال غير مسموح يُرفض', async function () {
      await throws(() => KX.orders.transition(order.id, 'delivered', { role: 'customer' }), 'انتقال غير مسموح');
    });
    await t('العميل يرسل الطلب للمراجعة', async function () {
      order = await KX.orders.transition(order.id, 'under_review', { role: 'customer' });
      assert(order.status === 'under_review');
    });
    await t('الإدارة تحيله للمورد ثم للناقل', async function () {
      asRole('admin');
      order = await KX.orders.transition(order.id, 'awaiting_supplier', { role: 'admin' });
      order = await KX.orders.transition(order.id, 'awaiting_carrier', { role: 'supplier' });
      order = await KX.orders.transition(order.id, 'ready_for_payment', { role: 'admin' });
      assert(order.status === 'ready_for_payment');
    });

    /* ---------- 3) الدفع ---------- */
    group('الدفع والفوترة');
    await t('لا تجهيز قبل اكتمال السداد', async function () {
      await throws(() => KX.orders.transition(order.id, 'preparing', { role: 'admin' }), 'انتقال غير مسموح');
    });
    await t('العربون لا يكمل الطلب وحده', async function () {
      const r = await KX.payments.pay(order.id, { method: 'deposit', depositPercent: 30 });
      assert(r.order.status === 'ready_for_payment', 'الطلب انتقل رغم العربون فقط');
      assert(Number(r.order.amount_paid) > 0, 'لم يُسجَّل العربون');
    });
    await t('منع تكرار نفس الدفعة (idempotency)', async function () {
      const key = 'dup-test';
      const a = await KX.payments.pay(order.id, { method: 'card', amount: 1, idempotency_key: key });
      const b = await KX.payments.pay(order.id, { method: 'card', amount: 1, idempotency_key: key });
      assert(b.duplicate === true && b.payment.id === a.payment.id, 'نُفّذت الدفعة مرتين');
    });
    await t('رفض دفعة تتجاوز المستحق', async function () {
      await throws(() => KX.payments.pay(order.id, { method: 'card', amount: 99999 }), 'يتجاوز المستحق');
    });
    await t('سداد المتبقي ينقل الطلب إلى «مدفوع»', async function () {
      const cur = await KX.repo.get('orders', order.id);
      const due = KX.util.round(cur.total - cur.amount_paid, 3);
      const r = await KX.payments.pay(order.id, { method: 'card', amount: due, idempotency_key: 'final' });
      assert(r.order.status === 'paid', 'الحالة الآن: ' + r.order.status);
      order = r.order;
    });
    await t('الدفع عند الاستلام غير متاح', function () {
      assert(KX.config.payments.codEnabled === false, 'الدفع عند الاستلام مفعّل');
      assert(KX.config.payments.methods.indexOf('cod') === -1, 'cod موجود في طرق الدفع');
    });
    await t('لا تُخزَّن بيانات بطاقة كاملة', async function () {
      const pays = await KX.repo.list('payments', { where: { order_id: order.id } });
      pays.forEach(function (p) {
        assert(!p.card_number && !p.cvv, 'وُجدت بيانات بطاقة مخزّنة');
        if (p.card_last4) assert(String(p.card_last4).length <= 4, 'أكثر من 4 أرقام محفوظة');
      });
    });

    /* ---------- 4) النقل والتسليم ---------- */
    group('النقل والتسليم');
    let trips;
    await t('إنشاء الرحلات وتعيين السائق', async function () {
      const carrier = await KX.repo.first('transport_companies', { code: 'TRP-DHR' });
      await KX.repo.update('orders', order.id, { transporter_id: carrier.id });
      const fresh = await KX.repo.get('orders', order.id);
      trips = await KX.trips.createForOrder(fresh, { transporter_id: carrier.id });
      assert(trips.length === fresh.trips_planned, 'عدد الرحلات لا يطابق الخطة');
      const driver = await KX.repo.first('drivers', { phone: '96893000001' });
      const truckRow = await KX.repo.first('trucks', {});
      await KX.trips.assignDriver(trips[0].id, driver.id, truckRow.id);
    });
    await t('إصدار أمر التحميل بعد الدفع', async function () {
      asRole('admin');
      order = await KX.orders.transition(order.id, 'preparing', { role: 'admin' });
      assert(order.status === 'preparing');
    });
    await t('تذكرة الميزان تسجّل الكمية الفعلية', async function () {
      const wt = await KX.trips.recordWeightTicket(trips[0].id,
        { ticket_no: 'WT-001', gross_tons: 40.5, tare_tons: 15.5 });
      near(wt.net_tons, 25);
    });
    await t('تقدّم الرحلة يحرّك حالة الطلب', async function () {
      await KX.trips.updateStatus(trips[0].id, 'loading');
      let o = await KX.repo.get('orders', order.id);
      assert(o.status === 'loading', 'الحالة: ' + o.status);
      await KX.trips.updateStatus(trips[0].id, 'en_route');
      o = await KX.repo.get('orders', order.id);
      assert(o.status === 'in_transit', 'الحالة: ' + o.status);
      await KX.trips.updateStatus(trips[0].id, 'at_site');
      o = await KX.repo.get('orders', order.id);
      assert(o.status === 'arrived', 'الحالة: ' + o.status);
      order = o;
    });
    await t('رمز استلام خاطئ يُرفض', async function () {
      await throws(() => KX.orders.confirmReceipt(order.id, '0000'), 'رمز الاستلام غير صحيح');
    });
    await t('رمز صحيح يُتمّ التسليم ويصدر الفاتورة', async function () {
      asRole('customer', { customer_id: cust.id });
      const cur = await KX.repo.get('orders', order.id);
      order = await KX.orders.confirmReceipt(order.id, cur.delivery_otp);
      assert(order.status === 'delivered');
      const inv = await KX.repo.first('invoices', { order_id: order.id });
      assert(inv && inv.invoice_no, 'لم تصدر الفاتورة');
      near(inv.total, Number(order.total) + Number(order.waiting_fees || 0));
    });
    await t('التسويات تُبنى ومجموعها يطابق التكاليف', async function () {
      const rows = await KX.repo.list('settlements', { where: { order_id: order.id } });
      assert(rows.length === 2, 'عدد التسويات: ' + rows.length);
      const s = rows.find((r) => r.party_type === 'supplier');
      const c = rows.find((r) => r.party_type === 'transporter');
      near(Number(s.net_payable) + Number(s.commission), order.material_cost);
      near(Number(c.net_payable) + Number(c.commission),
           Number(order.transport_cost) + Number(order.waiting_fees || 0));
    });

    /* ---------- 5) الإلغاء والاسترداد ---------- */
    group('الإلغاء والاسترداد');
    await t('نسبة الاسترداد تتدرج حسب المرحلة', function () {
      assert(KX.orders.refundPercentFor('paid') === 1, 'استرداد ما بعد الدفع ليس كاملًا');
      assert(KX.orders.refundPercentFor('loading') < 1, 'استرداد التحميل ليس جزئيًا');
      assert(KX.orders.refundPercentFor('delivered') === 0, 'استرداد بعد التسليم ليس صفرًا');
    });
    await t('إلغاء بعد الدفع يسترد كامل المبلغ', async function () {
      asRole('customer', { customer_id: cust.id });
      const q = await KX.pricing.quote({ supplier_id: sup.id, material_id: mat.id, quantity: 30,
        unit: 'ton', truck_type_id: truck.id, zone_id: zone.id, site: theSite.coords, customer_id: cust.id });
      let o = await KX.orders.createFromQuote(q, { customer_id: cust.id, site_id: theSite.id,
        scheduled_at: KX.util.addDays(KX.util.nowISO(), 1) });
      o = await KX.orders.transition(o.id, 'under_review', { role: 'customer' });
      asRole('admin');
      o = await KX.orders.transition(o.id, 'awaiting_supplier', { role: 'admin' });
      o = await KX.orders.transition(o.id, 'awaiting_carrier', { role: 'admin' });
      o = await KX.orders.transition(o.id, 'ready_for_payment', { role: 'admin' });
      const r = await KX.payments.pay(o.id, { method: 'card' });
      o = await KX.orders.transition(r.order.id, 'cancelled', { role: 'admin', note: 'اختبار الإلغاء' });
      const ref = await KX.payments.refund(o.id, { reason: 'اختبار', percent: 1 });
      near(ref.amount, r.payment.amount);
      const after = await KX.repo.get('orders', o.id);
      assert(after.status === 'refunded_full', 'الحالة: ' + after.status);
    });
    await t('لا استرداد بلا مدفوعات', async function () {
      const q = await KX.pricing.quote({ supplier_id: sup.id, material_id: mat.id, quantity: 30,
        unit: 'ton', truck_type_id: truck.id, zone_id: zone.id, site: theSite.coords, customer_id: cust.id });
      const o = await KX.orders.createFromQuote(q, { customer_id: cust.id, site_id: theSite.id,
        scheduled_at: KX.util.nowISO() });
      await throws(() => KX.payments.refund(o.id, { reason: 'x' }), 'لا توجد مبالغ مدفوعة');
    });

    /* ---------- 6) الصلاحيات ---------- */
    group('الصلاحيات');
    await t('المدير يملك كل الأذونات', function () {
      asRole('admin'); assert(KX.auth.can('anything.at.all'));
    });
    await t('العميل لا يملك أذونات الإدارة', function () {
      asRole('customer');
      assert(KX.auth.can('orders.create'), 'العميل لا يستطيع إنشاء طلب');
      assert(!KX.auth.can('prices.manage.all'), 'العميل يملك إدارة الأسعار');
      assert(!KX.auth.can('payments.verify'), 'العميل يستطيع اعتماد التحويلات');
    });
    await t('السائق محصور في رحلاته', function () {
      asRole('driver');
      assert(KX.auth.can('trips.update_status'));
      assert(!KX.auth.can('orders.create'), 'السائق يستطيع إنشاء طلب');
      assert(!KX.auth.can('settlements.read.own'), 'السائق يرى التسويات');
    });
    await t('المورد لا ينقل الطلب إلى «في الطريق»', function () {
      const allowed = KX.orders.allowedTransitions('awaiting_supplier', 'supplier').map((x) => x.to);
      assert(allowed.indexOf('in_transit') === -1, 'المورد يملك انتقالًا غير مشروع');
    });
    await t('كل مسار محمي له أدوار معرّفة', function () {
      const guarded = KX.app.ROUTES.filter((r) => String(r[0]).indexOf('/admin') === 0);
      guarded.forEach((r) => assert(Array.isArray(r[2]) && r[2].length, 'مسار إدارة بلا أدوار: ' + r[0]));
    });

    /* ---------- 7) المصادقة ---------- */
    group('المصادقة');
    await t('رفض رقم هاتف غير عُماني', async function () {
      await throws(() => KX.auth.sendOtp('12345'), 'غير صحيح');
    });
    await t('رفض رمز تحقق خاطئ', async function () {
      await KX.auth.sendOtp('96890000001');
      await throws(() => KX.auth.verifyOtp('96890000001', '0000'), 'غير صحيح');
    });
    await t('رمز صحيح يفتح جلسة بالدور الصحيح', async function () {
      const r = await KX.auth.sendOtp('96891000001');
      const s = await KX.auth.verifyOtp('96891000001', r.demo_code);
      assert(s.session.role === 'supplier' && s.session.supplier_id, 'الجلسة ناقصة');
    });
    await t('رقم غير مسجّل يوجّه للتسجيل', async function () {
      const r = await KX.auth.sendOtp('96897777777');
      const s = await KX.auth.verifyOtp('96897777777', r.demo_code);
      assert(s.needsRegistration === true, 'لم يُطلب التسجيل');
    });

    /* ---------- 8) سلامة البيانات ---------- */
    group('سلامة البيانات');
    await t('لا حذف نهائي للطلبات والمدفوعات', async function () {
      await throws(() => KX.repo.hardDelete('orders', order.id), 'لا يُسمح بحذف');
      await throws(() => KX.repo.hardDelete('payments', 'x'), 'لا يُسمح بحذف');
    });
    await t('سجل التدقيق يوثّق العمليات الحسّاسة', async function () {
      const logs = await KX.repo.list('audit_logs', {});
      assert(logs.some((l) => l.action === 'order.transition'), 'انتقالات الطلب غير موثّقة');
      assert(logs.some((l) => l.action === 'payment.create'), 'المدفوعات غير موثّقة');
    });
    await t('تعديل السعر لا يغيّر الطلبات السابقة', async function () {
      const before = await KX.repo.get('orders', order.id);
      const priceRow = await KX.repo.first('supplier_prices', { supplier_id: sup.id, material_id: mat.id });
      await KX.repo.update('supplier_prices', priceRow.id, { price_per_ton: 9.999 });
      const after = await KX.repo.get('orders', order.id);
      near(after.total, before.total);
      await KX.repo.update('supplier_prices', priceRow.id, { price_per_ton: priceRow.price_per_ton });
    });
    await t('كل طلب مرتبط بعميل وموقع ومورد', async function () {
      const all = await KX.repo.list('orders', {});
      all.forEach(function (o) {
        assert(o.customer_id && o.site_id && o.supplier_id, 'طلب ناقص الروابط: ' + o.order_no);
      });
    });
    await t('كل جدول معرّف في المخطط له تسمية', function () {
      Object.keys(KX.schema.TABLES).forEach((t2) =>
        assert(KX.schema.TABLES[t2].label, 'جدول بلا تسمية: ' + t2));
    });

    /* ---------- 9) التنسيق والعرض ---------- */
    group('التنسيق');
    await t('العملة بثلاث منازل عشرية', function () {
      assert(KX.util.fmtOMR(12.5) === '12.500 ر.ع.', KX.util.fmtOMR(12.5));
      assert(KX.util.money(0.1 + 0.2) === '0.300', KX.util.money(0.1 + 0.2));
    });
    await t('تطبيع أرقام الهواتف العُمانية', function () {
      assert(KX.util.normalizePhone('90000001') === '96890000001');
      assert(KX.util.normalizePhone('+968 9000 0001') === '96890000001');
      assert(KX.util.isValidPhone('96890000001') === true);
      assert(KX.util.isValidPhone('96812345678') === false);
    });
    await t('تهريب النص يمنع حقن HTML', function () {
      assert(KX.util.esc('<img src=x onerror=alert(1)>').indexOf('<') === -1, 'لم يُهرَّب النص');
    });
    await t('التصدير والاستيراد CSV متطابقان', function () {
      const rows = [{ a: 'قيمة، بفاصلة', b: 2 }, { a: 'نص "مقتبس"', b: 3 }];
      const parsed = KX.util.parseCSV(KX.util.toCSV(rows));
      assert(parsed.length === 2 && parsed[0].a === 'قيمة، بفاصلة', 'CSV غير متطابق');
    });

    /* ---------- 10) المؤشرات ---------- */
    group('المؤشرات');
    await t('لوحة المؤشرات تُحسب بلا أخطاء', async function () {
      const m = await KX.analytics.overview(30);
      assert(typeof m.orders_count === 'number' && m.orders_count >= 0);
      assert(m.gross_value >= 0 && m.platform_revenue >= 0);
    });
    await t('السلسلة اليومية بطول الفترة المطلوبة', async function () {
      const m = await KX.analytics.overview(30);
      const d = KX.analytics.daily(m.orders, 14, 'count');
      assert(d.length === 14, 'الطول: ' + d.length);
    });
    await t('تقارير الموردين والناقلين تُبنى', async function () {
      const all = await KX.repo.list('orders', {});
      const s = await KX.analytics.supplierPerformance(all);
      const c = await KX.analytics.carrierPerformance(all);
      assert(s.length > 0 && c.length > 0, 'تقارير فارغة');
    });

    /* إعادة البيانات إلى حالتها التجريبية النظيفة */
    await KX.seed.run(true);
    KX.store.set('session', savedSession || null);
    return report();
  }

  function report() {
    const pass = results.filter((r) => r.ok).length;
    const fail = results.filter((r) => !r.ok);
    const summary = { total: results.length, passed: pass, failed: fail.length, results: results };
    console.log('%c اختبار كسّارة إكسبرس: ' + pass + '/' + results.length + ' ناجح ',
      'background:' + (fail.length ? '#c0392b' : '#1c7a53') + ';color:#fff;padding:3px 8px;border-radius:4px');
    console.table(results.map((r) => ({ المجموعة: r.group, الاختبار: r.name,
      النتيجة: r.ok ? '✅' : '❌', الخطأ: r.error || '' })));
    window.__KX_TEST__ = summary;
    return summary;
  }

  /* عرض النتائج على الصفحة */
  function renderPage(summary) {
    const g = KX.util.groupBy(summary.results, 'group');
    const html = '<div class="container" style="padding:28px 20px">' +
      '<h1>نتائج الاختبار الذاتي</h1>' +
      KX.ui.alert('<b>' + summary.passed + ' / ' + summary.total + '</b> اختبارًا ناجحًا' +
        (summary.failed ? ' — <b>' + summary.failed + ' فشل</b>' : ' — كل الاختبارات ناجحة'),
        summary.failed ? 'danger' : 'ok', summary.failed ? '❌' : '✅') +
      Object.keys(g).map((k) => '<div class="mt">' + KX.ui.card(k, KX.ui.table([
        { key: 'ok', label: '', render: (r) => r.ok ? '✅' : '❌' },
        { key: 'name', label: 'الاختبار' },
        { key: 'error', label: 'الخطأ', render: (r) => KX.util.esc(r.error || '') }
      ], g[k], { compact: true })) + '</div>').join('') +
      '<div class="mt"><a href="#/" class="btn btn--primary">العودة للتطبيق</a></div></div>';
    document.getElementById('app').innerHTML = KX.layout.appbar() + html;
  }

  /* تشغيل تلقائي عند ?selftest=1 */
  if (location.search.indexOf('selftest=1') !== -1) {
    window.addEventListener('load', function () {
      setTimeout(async function () {
        document.getElementById('app').innerHTML =
          '<div style="padding:60px;text-align:center;font-family:system-ui">جارٍ تنفيذ الاختبارات…</div>';
        const s = await run();
        renderPage(s);
      }, 300);
    });
  }
  return { run, report, renderPage };
})();
