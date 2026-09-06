/* حساب مؤشرات الأداء والتقارير — مصدر واحد للأرقام في كل اللوحات */
window.KX = window.KX || {};
KX.analytics = (function () {
  const U = () => KX.util;
  const DELIVERED = 'delivered';
  const inRange = (iso, from, to) => iso >= from && iso <= to;

  /* لقطة كاملة للفترة المحددة مع مقارنة بالفترة السابقة المماثلة */
  async function overview(days) {
    days = days || 30;
    const now = new Date();
    const from = U().addDays(now.toISOString(), -days);
    const prevFrom = U().addDays(now.toISOString(), -days * 2);
    const [orders, invoices, commissions, customers, suppliers, carriers, trips, complaints] =
      await Promise.all([
        KX.repo.list('orders', {}), KX.repo.list('invoices', {}),
        KX.repo.list('commissions', {}), KX.repo.list('customer_profiles', {}),
        KX.repo.list('suppliers', {}), KX.repo.list('transport_companies', {}),
        KX.repo.list('trips', {}), KX.repo.list('complaints', {})
      ]);

    const cur  = orders.filter((o) => inRange(o.created_at, from, now.toISOString()));
    const prev = orders.filter((o) => inRange(o.created_at, prevFrom, from));
    const done = (arr) => arr.filter((o) => o.status === DELIVERED);

    const val = (arr) => U().round(U().sum(arr, (o) => Number(o.total)), 3);
    /* الكميات تُجمَع بوحدة الطلب؛ المنصة تبيع بالمتر المكعب */
    const qty = (arr) => U().round(U().sum(arr, (o) => Number(o.quantity || 0)), 1);
    const revenue = (arr) => U().round(U().sum(arr, function (o) {
      const i = (o.price_snapshot || {}).internal || {};
      return Number(i.platform_revenue || o.platform_fee || 0);
    }), 3);
    const transport = (arr) => U().round(U().sum(arr, (o) => Number(o.transport_cost || 0)), 3);

    /* null تعني «لا أساس للمقارنة» — تُعرض كـ«فترة أولى» بدل نسبة مضللة */
    const pct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);

    /* متوسط زمن التوصيل (ساعات) من الإنشاء حتى التسليم */
    const deliveredCur = done(cur).filter((o) => o.delivered_at);
    const avgHours = deliveredCur.length
      ? U().round(U().sum(deliveredCur, (o) =>
          (new Date(o.delivered_at) - new Date(o.created_at)) / 3600000) / deliveredCur.length, 1)
      : 0;

    const newCustomers = customers.filter((c) => inRange(c.created_at, from, now.toISOString())).length;
    const repeat = customers.filter((c) => Number(c.total_orders || 0) > 1).length;

    return {
      period_days: days,
      orders_count: cur.length,
      orders_delta: pct(cur.length, prev.length),
      orders_today: orders.filter((o) => o.created_at >= U().addDays(now.toISOString(), -1)).length,
      qty_sold: qty(done(cur)),
      qty_delta: pct(qty(done(cur)), qty(done(prev))),
      gross_value: val(cur),
      gross_delta: pct(val(cur), val(prev)),
      platform_revenue: revenue(done(cur)),
      revenue_delta: pct(revenue(done(cur)), revenue(done(prev))),
      transport_cost: transport(done(cur)),
      avg_order_value: cur.length ? U().round(val(cur) / cur.length, 3) : 0,
      avg_delivery_hours: avgHours,
      cancelled: cur.filter((o) => o.status === 'cancelled').length,
      late: cur.filter((o) => !KX.orders.isFinal(o.status) &&
                              o.scheduled_at && o.scheduled_at < now.toISOString()).length,
      new_customers: newCustomers,
      repeat_customers: repeat,
      active_orders: orders.filter((o) => !KX.orders.isFinal(o.status)).length,
      pending_payment: orders.filter((o) => o.status === 'ready_for_payment').length,
      pending_verification: orders.filter((o) => o.status === 'awaiting_transfer_verification').length,
      open_complaints: complaints.filter((c) => c.status === 'open').length,
      suppliers_count: suppliers.filter((s) => s.is_active).length,
      carriers_count: carriers.filter((c) => c.is_active).length,
      trips_count: trips.length,
      margin_per_unit: qty(done(cur)) > 0
        ? U().round(revenue(done(cur)) / qty(done(cur)), 3) : 0,
      from: from, to: now.toISOString(), orders: orders
    };
  }

  /* سلسلة زمنية يومية لعدد الطلبات أو قيمتها */
  function daily(orders, days, metric) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const rows = orders.filter((o) => String(o.created_at).slice(0, 10) === key);
      const v = metric === 'value' ? U().round(U().sum(rows, (o) => Number(o.total)), 3)
              : metric === 'qty'   ? U().round(U().sum(rows, (o) => Number(o.quantity || 0)), 1)
              : rows.length;
      out.push({
        label: d.toLocaleDateString('ar-OM-u-nu-latn', { day: 'numeric', month: 'short' }),
        value: v,
        display: metric === 'value' ? U().fmtOMR(v)
               : metric === 'qty'   ? U().fmtNum(v, 1) + ' ' + KX.schema.UNITS.m3 : v + ' طلب'
      });
    }
    return out;
  }

  /* الكميات المسلّمة حسب المادة */
  async function byMaterial(orders) {
    const items = await KX.repo.list('order_items', {});
    const ids = orders.filter((o) => o.status === DELIVERED).map((o) => o.id);
    const rows = items.filter((it) => ids.indexOf(it.order_id) !== -1);
    const g = U().groupBy(rows, 'material_name');
    return U().sortBy(Object.keys(g).map((k) => ({
      label: k, value: U().round(U().sum(g[k], (x) => Number(x.quantity || 0)), 1)
    })), 'value', 'desc')
      .map((r) => Object.assign(r, { display: U().fmtNum(r.value, 1) + ' ' + KX.schema.UNITS.m3 }));
  }

  /* الطلبات حسب المنطقة */
  async function byZone(orders) {
    const zones = await KX.repo.mapBy('delivery_zones');
    const g = U().groupBy(orders, 'zone_id');
    return U().sortBy(Object.keys(g).map((k) => ({
      label: (zones[k] || {}).name || '—', value: g[k].length
    })), 'value', 'desc').map((r) => Object.assign(r, { display: r.value + ' طلب' }));
  }

  /* أداء الموردين */
  async function supplierPerformance(orders) {
    const [suppliers, reviews] = await Promise.all([
      KX.repo.list('suppliers', {}), KX.repo.list('reviews', {})
    ]);
    return U().sortBy(suppliers.map(function (s) {
      const os = orders.filter((o) => o.supplier_id === s.id);
      const dl = os.filter((o) => o.status === DELIVERED);
      const rv = reviews.filter((r) => r.supplier_id === s.id);
      return {
        id: s.id, name: s.name,
        orders: os.length, delivered: dl.length,
        quantity: U().round(U().sum(dl, (o) => Number(o.quantity || 0)), 1),
        value: U().round(U().sum(dl, (o) => Number(o.material_cost)), 3),
        cancelled: os.filter((o) => o.status === 'cancelled').length,
        rating: rv.length ? U().round(U().sum(rv, (r) => Number(r.supplier_rating)) / rv.length, 1) : s.rating,
        fulfillment: os.length ? U().round((dl.length / os.length) * 100, 0) : 0
      };
    }), 'quantity', 'desc');
  }

  /* أداء الناقلين */
  async function carrierPerformance(orders) {
    const [carriers, trips, reviews] = await Promise.all([
      KX.repo.list('transport_companies', {}), KX.repo.list('trips', {}), KX.repo.list('reviews', {})
    ]);
    return U().sortBy(carriers.map(function (c) {
      const os = orders.filter((o) => o.transporter_id === c.id);
      const tp = trips.filter((t) => t.transporter_id === c.id);
      const rv = reviews.filter((r) => r.transporter_id === c.id);
      return {
        id: c.id, name: c.name, orders: os.length,
        trips: tp.length, delivered_trips: tp.filter((t) => t.status === 'delivered').length,
        value: U().round(U().sum(os.filter((o) => o.status === DELIVERED), (o) => Number(o.transport_cost)), 3),
        rating: rv.length ? U().round(U().sum(rv, (r) => Number(r.transporter_rating)) / rv.length, 1) : c.rating
      };
    }), 'trips', 'desc');
  }

  /* توزيع قيمة الطلبات: مواد / نقل / إيراد المنصة (الضريبة محصّلة للدولة وتُستثنى) */
  function valueSplit(orders) {
    const dl = orders.filter((o) => o.status === DELIVERED);
    const materials = U().round(U().sum(dl, (o) => Number(o.material_cost)), 3);
    const transport = U().round(U().sum(dl, (o) => Number(o.transport_cost)), 3);
    const revenue = U().round(U().sum(dl, function (o) {
      const i = (o.price_snapshot || {}).internal || {};
      return Number(i.platform_revenue || o.platform_fee || 0);
    }), 3);
    /* إيراد المنصة يأتي من العمولات المخصومة من المورد والناقل + رسوم المنصة */
    return [
      { label: 'قيمة المواد (صافي للمورد)', value: U().round(materials - revenue * 0.35, 3) },
      { label: 'تكلفة النقل (صافي للناقل)', value: U().round(transport - revenue * 0.35, 3) },
      { label: 'إيراد المنصة', value: revenue }
    ].map((s) => Object.assign(s, { display: U().fmtOMR(s.value) }));
  }

  /* توزيع الطلبات على الحالات */
  function statusSplit(orders) {
    const g = U().groupBy(orders, 'status');
    return U().sortBy(Object.keys(g).map((k) => ({
      label: KX.orders.label(k), value: g[k].length, status: k
    })), 'value', 'desc');
  }

  return { overview, daily, byMaterial, byZone, supplierPerformance,
           carrierPerformance, valueSplit, statusSplit };
})();
