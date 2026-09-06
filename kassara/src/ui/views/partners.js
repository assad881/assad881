/* شاشات المورد وشركة النقل والسائق + صفحة الإشعارات المشتركة */
window.KX = window.KX || {};
KX.viewsPartners = (function () {
  const e = (s) => KX.util.esc(s);
  const U = () => KX.util;
  const L = () => KX.layout;
  const S = () => KX.auth.session();
  const row = (k, v) => '<div class="row row--between" style="padding:6px 0;border-bottom:1px solid var(--border)">' +
    '<span class="muted">' + e(k) + '</span><b style="text-align:end">' + e(v) + '</b></div>';

  /* ==================== المورد ==================== */
  async function supplierDashboard() {
    const sid = S().supplier_id;
    const orders = await KX.orders.forSupplier(sid);
    const settles = await KX.settlements.forParty('supplier', sid);
    const pending = orders.filter((o) => o.status === 'awaiting_supplier');
    const loading = orders.filter((o) => ['paid', 'preparing', 'loading'].indexOf(o.status) !== -1);
    const delivered = orders.filter((o) => o.status === 'delivered');
    const due = U().round(U().sum(settles.filter((s) => s.status === 'pending'), (s) => +s.net_payable), 3);

    L().renderApp(
      (pending.length ? KX.ui.alert('لديك ' + pending.length + ' طلب بانتظار تأكيد توفّر المادة. ' +
        '<a href="#/supplier/orders"><b>راجعها الآن</b></a>', 'warn', '⏳') : '') +
      '<div class="grid grid-4">' +
        KX.ui.kpi({ label: 'بانتظار تأكيدك', value: pending.length, accent: true }) +
        KX.ui.kpi({ label: 'أوامر تحميل نشطة', value: loading.length }) +
        KX.ui.kpi({ label: 'الأطنان المباعة', value: U().fmtNum(U().sum(delivered, (o) => +o.tons), 1) + ' طن' }) +
        KX.ui.kpi({ label: 'مستحقاتي', value: U().fmtOMR(due), sub: 'غير مسددة' }) +
      '</div>' +
      '<div class="mt">' + KX.ui.card('أحدث الطلبات', ordersTable(orders.slice(0, 8), 'supplier')) + '</div>',
      { title: 'لوحة المورد', subtitle: (S().supplier || {}).name });
  }

  function ordersTable(rows, kind) {
    return KX.ui.table([
      { key: 'order_no', label: 'الطلب', render: (o) => '<a href="#/' + kind + '/orders/' + o.id + '"><b>' + e(o.order_no) + '</b></a>' },
      { key: 'm', label: 'المادة', render: (o) => e(((o.price_snapshot || {}).inputs || {}).material_name || '—') },
      { key: 'tons', label: 'الكمية', num: true, render: (o) => U().fmtNum(o.tons, 1) + ' طن' },
      { key: 'trips_planned', label: 'الرحلات', num: true },
      { key: 'scheduled_at', label: 'الموعد', render: (o) => U().fmtDateTime(o.scheduled_at) },
      { key: 'status', label: 'الحالة', render: (o) => KX.ui.statusBadge(o.status) }
    ], rows, { compact: true, emptyText: 'لا توجد طلبات' });
  }

  async function supplierOrders() {
    const orders = await KX.orders.forSupplier(S().supplier_id);
    L().renderApp(ordersTable(orders, 'supplier'), { title: 'طلبات التوريد' });
  }

  async function supplierOrderDetail(ctx) {
    const order = await KX.repo.get('orders', ctx.params.id);
    if (!order || order.supplier_id !== S().supplier_id) {
      L().renderApp(KX.ui.alert('الطلب غير متاح لك', 'danger'), { title: 'الطلب' }); return;
    }
    const [site, customer, trips, tickets] = await Promise.all([
      KX.repo.get('locations', order.site_id),
      KX.repo.get('customer_profiles', order.customer_id),
      KX.trips.forOrder(order.id),
      KX.repo.list('weight_tickets', { where: { order_id: order.id } })
    ]);
    const q = order.price_snapshot;
    const next = KX.orders.allowedTransitions(order.status, 'supplier');

    L().renderApp(
      KX.ui.steps(order.status) +
      '<div class="card mb"><div class="btn-group">' +
        next.map((t) => '<button class="btn btn--sm btn--navy" data-to="' + t.to + '">' + e(t.label) + '</button>').join('') +
        (['preparing', 'loading'].indexOf(order.status) !== -1
          ? '<button class="btn btn--sm btn--primary" id="ticket">⚖️ تسجيل تذكرة ميزان</button>' : '') +
      '</div></div>' +
      '<div class="grid grid-2"><div class="stack">' +
        KX.ui.card('أمر التوريد',
          row('رقم الطلب', order.order_no) +
          row('المادة', q ? q.inputs.material_name : '—') +
          row('الكمية المطلوبة', U().fmtNum(order.tons, 1) + ' طن') +
          row('عدد الرحلات', order.trips_planned + ' × ' + (q ? q.inputs.truck_name : '')) +
          row('موعد التحميل', U().fmtDateTime(order.scheduled_at)) +
          row('وجهة التوصيل', site ? site.label + ' — ' + (q ? q.inputs.zone_name : '') : '—') +
          row('العميل', (customer || {}).name || '—') +
          (order.notes ? row('ملاحظات', order.notes) : '')) +
        KX.ui.card('قيمتي من هذا الطلب',
          row('قيمة المواد', U().fmtOMR(order.material_cost)) +
          row('عمولة المنصة', U().fmtOMR(((q || {}).internal || {}).supplier_commission || 0)) +
          '<hr class="divider">' +
          row('صافي المستحق', U().fmtOMR(((q || {}).internal || {}).supplier_payable || 0))) +
      '</div><div class="stack">' +
        KX.ui.card('الرحلات', KX.ui.table([
          { key: 'seq', label: '#' },
          { key: 'status', label: 'الحالة', render: (t) => KX.ui.badge(KX.trips.TRIP_STATUS[t.status].label, KX.trips.TRIP_STATUS[t.status].tone) },
          { key: 'planned_tons', label: 'مخطط', num: true, render: (t) => U().fmtNum(t.planned_tons, 1) },
          { key: 'actual_tons', label: 'فعلي', num: true, render: (t) => t.actual_tons ? U().fmtNum(t.actual_tons, 1) : '—' }
        ], trips, { compact: true, emptyText: 'لم تُنشأ رحلات بعد' })) +
        KX.ui.card('تذاكر الميزان', KX.ui.table([
          { key: 'ticket_no', label: 'رقم التذكرة' },
          { key: 'gross_tons', label: 'القائم', num: true },
          { key: 'tare_tons', label: 'الفارغ', num: true },
          { key: 'net_tons', label: 'الصافي', num: true, render: (t) => '<b>' + U().fmtNum(t.net_tons, 2) + '</b>' },
          { key: 'recorded_at', label: 'الوقت', render: (t) => U().fmtDateTime(t.recorded_at) }
        ], tickets, { compact: true, emptyText: 'لا توجد تذاكر' })) +
      '</div></div>',
      { title: order.order_no, subtitle: KX.orders.label(order.status) });

    U().on(document, 'click', '[data-to]', async function (ev, el) {
      const to = el.dataset.to;
      const res = await U().confirmDialog({ title: 'تحديث الطلب',
        reasonRequired: to === 'under_review',
        message: to === 'under_review' ? 'اذكر سبب طلب التعديل (نقص كمية، عدم توفّر، اختلاف مواصفة…)'
                                       : 'نقل الطلب إلى: ' + KX.orders.label(to) });
      if (!res) return;
      try {
        await KX.orders.transition(order.id, to, { role: 'supplier', note: typeof res === 'string' ? res : '' });
        U().toast('تم التحديث', 'success'); KX.router.resolve();
      } catch (err) { U().toast(err.message, 'error'); }
    });
    const tb = document.getElementById('ticket');
    if (tb) tb.onclick = function () {
      if (!trips.length) { U().toast('لا توجد رحلات لتسجيل تذكرة عليها', 'error'); return; }
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = '<div class="modal"><h3>تسجيل تذكرة ميزان</h3>' +
        KX.ui.field({ name: 'trip_id', label: 'الرحلة', type: 'select',
          options: trips.map((t) => ({ value: t.id, label: 'رحلة #' + t.seq + ' — ' + KX.trips.TRIP_STATUS[t.status].label })) }) +
        KX.ui.field({ name: 'ticket_no', label: 'رقم التذكرة', required: true }) +
        '<div class="field-row">' +
          KX.ui.field({ name: 'gross_tons', label: 'الوزن القائم (طن)', type: 'number', step: '0.01', required: true }) +
          KX.ui.field({ name: 'tare_tons', label: 'وزن الشاحنة الفارغة (طن)', type: 'number', step: '0.01', required: true }) +
        '</div>' +
        '<div class="modal__actions"><button class="btn btn--ghost" data-no>إلغاء</button>' +
        '<button class="btn btn--primary" data-yes>حفظ التذكرة</button></div></div>';
      document.body.appendChild(wrap);
      wrap.querySelector('[data-no]').onclick = () => wrap.remove();
      wrap.querySelector('[data-yes]').onclick = async function () {
        const v = KX.ui.formValues(wrap);
        if (!v.ticket_no || !Number(v.gross_tons) || Number(v.gross_tons) <= Number(v.tare_tons)) {
          U().toast('تحقّق من أرقام الوزن', 'error'); return;
        }
        await KX.trips.recordWeightTicket(v.trip_id, v);
        wrap.remove(); U().toast('سُجّلت التذكرة', 'success'); KX.router.resolve();
      };
    };
  }

  async function supplierMaterials() {
    const sid = S().supplier_id;
    const [prices, mats] = await Promise.all([
      KX.repo.list('supplier_prices', { where: { supplier_id: sid } }),
      KX.repo.list('materials', { where: { is_active: true } })
    ]);
    const matName = {}; mats.forEach((m) => { matName[m.id] = m.name; });

    L().renderApp(
      KX.ui.alert('تعديل السعر يسري على الطلبات الجديدة فقط. الطلبات السابقة تحتفظ بسعرها المتفق عليه.', 'info', 'ℹ️') +
      KX.ui.card('إضافة مادة إلى قائمتي', '<form id="sp-form">' +
        '<div class="field-row">' +
          KX.ui.field({ name: 'material_id', label: 'المادة', type: 'select', required: true,
            placeholder: 'اختر', options: mats.map((m) => ({ value: m.id, label: m.name })) }) +
          KX.ui.field({ name: 'price_per_ton', label: 'سعر الطن (ر.ع.)', type: 'number', step: '0.001', required: true }) +
        '</div>' +
        '<div class="field-row">' +
          KX.ui.field({ name: 'min_qty_tons', label: 'الحد الأدنى (طن)', type: 'number', value: '12' }) +
          KX.ui.field({ name: 'available_tons_per_day', label: 'المتاح يوميًا (طن)', type: 'number', value: '300' }) +
        '</div>' +
        '<button class="btn btn--primary" type="submit">حفظ</button></form>') +
      '<div class="mt">' + KX.ui.card('موادي وأسعاري', KX.ui.table([
        { key: 'm', label: 'المادة', render: (p) => e(matName[p.material_id] || '—') },
        { key: 'price_per_ton', label: 'سعر الطن', num: true, render: (p) => '<b>' + U().money(p.price_per_ton) + '</b>' },
        { key: 'min_qty_tons', label: 'أدنى كمية', num: true },
        { key: 'available_tons_per_day', label: 'المتاح يوميًا', num: true },
        { key: 'is_active', label: 'الحالة', render: (p) => KX.ui.badge(p.is_active ? 'متاحة' : 'موقوفة', p.is_active ? 'ok' : 'muted') },
        { key: 'a', label: '', render: (p) => '<button class="btn btn--sm btn--ghost" data-avail="' + p.id + '">تحديث التوفّر</button> ' +
            '<button class="btn btn--sm btn--ghost" data-tg="' + p.id + '">' + (p.is_active ? 'إيقاف' : 'تفعيل') + '</button>' }
      ], prices, { compact: true, emptyText: 'لم تضف أي مادة بعد' })) + '</div>',
      { title: 'موادي وأسعاري' });

    document.getElementById('sp-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      if (!v.material_id || !Number(v.price_per_ton)) { U().toast('أكمل المادة والسعر', 'error'); return; }
      await KX.repo.insert('supplier_prices', {
        supplier_id: sid, material_id: v.material_id, price_per_ton: Number(v.price_per_ton),
        currency: 'OMR', min_qty_tons: Number(v.min_qty_tons || 0), max_qty_tons: 1000,
        available_tons_per_day: Number(v.available_tons_per_day || 0), tiers: [],
        valid_from: U().nowISO(), valid_to: null, customer_id: null, is_active: true
      });
      await KX.audit.log('price.create', 'supplier_prices', null, { by: 'supplier' });
      U().toast('حُفظ السعر', 'success'); KX.router.resolve();
    };
    U().on(document, 'click', '[data-tg]', async function (ev, el) {
      const p = prices.find((x) => x.id === el.dataset.tg);
      await KX.repo.update('supplier_prices', p.id, { is_active: !p.is_active });
      KX.router.resolve();
    });
    U().on(document, 'click', '[data-avail]', async function (ev, el) {
      const p = prices.find((x) => x.id === el.dataset.avail);
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = '<div class="modal"><h3>تحديث التوفّر والسعر</h3>' +
        KX.ui.field({ name: 'price_per_ton', label: 'سعر الطن', type: 'number', step: '0.001', value: p.price_per_ton }) +
        KX.ui.field({ name: 'available_tons_per_day', label: 'المتاح اليوم (طن)', type: 'number', value: p.available_tons_per_day }) +
        '<div class="modal__actions"><button class="btn btn--ghost" data-no>إلغاء</button>' +
        '<button class="btn btn--primary" data-yes>حفظ</button></div></div>';
      document.body.appendChild(wrap);
      wrap.querySelector('[data-no]').onclick = () => wrap.remove();
      wrap.querySelector('[data-yes]').onclick = async function () {
        const v = KX.ui.formValues(wrap);
        await KX.repo.update('supplier_prices', p.id, {
          price_per_ton: Number(v.price_per_ton),
          available_tons_per_day: Number(v.available_tons_per_day)
        });
        await KX.repo.insert('price_history', {
          price_id: p.id, supplier_id: sid, material_id: p.material_id,
          old_price: p.price_per_ton, new_price: Number(v.price_per_ton),
          action: 'supplier_update', changed_by: S().user_id, changed_by_name: S().name, at: U().nowISO()
        });
        wrap.remove(); U().toast('حُدّث السعر والتوفّر', 'success'); KX.router.resolve();
      };
    });
  }

  async function supplierSettlements() {
    const rows = await KX.settlements.forParty('supplier', S().supplier_id);
    L().renderApp(settlementsTable(rows), { title: 'مستحقاتي' });
  }
  function settlementsTable(rows) {
    const pending = U().round(U().sum(rows.filter((r) => r.status === 'pending'), (r) => +r.net_payable), 3);
    const paid = U().round(U().sum(rows.filter((r) => r.status === 'paid'), (r) => +r.net_payable), 3);
    return '<div class="grid grid-2 mb">' +
      KX.ui.kpi({ label: 'مستحق غير مسدد', value: U().fmtOMR(pending), accent: true }) +
      KX.ui.kpi({ label: 'إجمالي المسدد', value: U().fmtOMR(paid) }) + '</div>' +
      KX.ui.table([
        { key: 'order_no', label: 'الطلب' },
        { key: 'gross_amount', label: 'الإجمالي', num: true, render: (r) => U().fmtOMR(r.gross_amount) },
        { key: 'commission', label: 'عمولة المنصة', num: true, render: (r) => U().fmtOMR(r.commission) },
        { key: 'net_payable', label: 'الصافي', num: true, render: (r) => '<b>' + U().fmtOMR(r.net_payable) + '</b>' },
        { key: 'due_date', label: 'الاستحقاق', render: (r) => U().fmtDate(r.due_date) },
        { key: 'status', label: 'الحالة', render: (r) => KX.ui.badge(r.status === 'paid' ? 'مسددة' : 'معلّقة', r.status === 'paid' ? 'ok' : 'warn') }
      ], rows, { compact: true, emptyText: 'لا توجد مستحقات بعد' });
  }

  async function supplierReports() {
    const orders = await KX.orders.forSupplier(S().supplier_id);
    const delivered = orders.filter((o) => o.status === 'delivered');
    const items = await KX.repo.list('order_items', {});
    const mine = items.filter((it) => delivered.some((o) => o.id === it.order_id));
    const g = U().groupBy(mine, 'material_name');
    const rows = Object.keys(g).map((k) => ({
      material: k, tons: U().round(U().sum(g[k], (x) => +x.tons), 1),
      value: U().round(U().sum(g[k], (x) => +x.line_total), 3), orders: g[k].length
    }));
    L().renderApp(
      '<div class="grid grid-3 mb">' +
        KX.ui.kpi({ label: 'طلبات منجزة', value: delivered.length }) +
        KX.ui.kpi({ label: 'إجمالي الأطنان', value: U().fmtNum(U().sum(rows, (r) => r.tons), 1) + ' طن' }) +
        KX.ui.kpi({ label: 'قيمة المبيعات', value: U().fmtOMR(U().sum(rows, (r) => r.value)) }) +
      '</div>' +
      KX.ui.card('المبيعات حسب المادة',
        KX.charts.barsH(rows.map((r) => ({ label: r.material, value: r.tons, display: U().fmtNum(r.tons, 1) + ' طن' })),
          { aria: 'الأطنان حسب المادة' }) +
        KX.ui.table([
          { key: 'material', label: 'المادة' },
          { key: 'orders', label: 'الطلبات', num: true },
          { key: 'tons', label: 'الأطنان', num: true, render: (r) => U().fmtNum(r.tons, 1) },
          { key: 'value', label: 'القيمة', num: true, render: (r) => U().fmtOMR(r.value) }
        ], rows, { compact: true }),
        '<button class="btn btn--ghost btn--sm" id="csv">⬇️ تصدير</button>'),
      { title: 'تقاريري' });
    document.getElementById('csv').onclick = () => U().download('supplier-report.csv', U().toCSV(rows), 'text/csv');
  }

  /* ==================== شركة النقل ==================== */
  async function transporterDashboard() {
    const tid = S().transporter_id;
    const [orders, trips, settles] = await Promise.all([
      KX.orders.forTransporter(tid), KX.trips.forTransporter(tid),
      KX.settlements.forParty('transporter', tid)
    ]);
    const pending = orders.filter((o) => o.status === 'awaiting_carrier');
    const active = trips.filter((t) => ['assigned', 'heading_plant', 'at_plant', 'loading', 'loaded', 'en_route', 'at_site'].indexOf(t.status) !== -1);
    const unassigned = trips.filter((t) => !t.driver_id);
    const due = U().round(U().sum(settles.filter((s) => s.status === 'pending'), (s) => +s.net_payable), 3);

    L().renderApp(
      (unassigned.length ? KX.ui.alert(unassigned.length + ' رحلة بلا سائق. ' +
        '<a href="#/transporter/trips"><b>عيّن السائقين</b></a>', 'warn', '🚚') : '') +
      '<div class="grid grid-4">' +
        KX.ui.kpi({ label: 'مهام بانتظار القبول', value: pending.length, accent: true }) +
        KX.ui.kpi({ label: 'رحلات نشطة', value: active.length }) +
        KX.ui.kpi({ label: 'رحلات بلا سائق', value: unassigned.length }) +
        KX.ui.kpi({ label: 'مستحقاتي', value: U().fmtOMR(due) }) +
      '</div>' +
      '<div class="mt">' + KX.ui.card('أحدث المهام', ordersTable(orders.slice(0, 8), 'transporter')) + '</div>',
      { title: 'لوحة الناقل', subtitle: (S().transporter || {}).name });
  }

  async function transporterOrders() {
    const orders = await KX.orders.forTransporter(S().transporter_id);
    L().renderApp(ordersTable(orders, 'transporter'), { title: 'مهام النقل' });
  }

  async function transporterOrderDetail(ctx) {
    const order = await KX.repo.get('orders', ctx.params.id);
    if (!order || order.transporter_id !== S().transporter_id) {
      L().renderApp(KX.ui.alert('المهمة غير متاحة لك', 'danger'), { title: 'المهمة' }); return;
    }
    const [site, supplier, trips] = await Promise.all([
      KX.repo.get('locations', order.site_id), KX.repo.get('suppliers', order.supplier_id),
      KX.trips.forOrder(order.id)
    ]);
    const q = order.price_snapshot;
    const next = KX.orders.allowedTransitions(order.status, 'transporter');
    L().renderApp(
      KX.ui.steps(order.status) +
      (next.length ? '<div class="card mb"><div class="btn-group">' + next.map((t) =>
        '<button class="btn btn--sm btn--navy" data-to="' + t.to + '">' + e(t.label) + '</button>').join('') +
        '</div></div>' : '') +
      '<div class="grid grid-2"><div class="stack">' +
        KX.ui.card('تفاصيل المهمة',
          row('الطلب', order.order_no) +
          row('عدد الرحلات', order.trips_planned) +
          row('نوع الشاحنة', q ? q.inputs.truck_name : '—') +
          row('الكمية الكلية', U().fmtNum(order.tons, 1) + ' طن') +
          row('موقع التحميل', supplier ? supplier.name + ' — ' + supplier.address : '—') +
          row('موقع التسليم', site ? site.label + ' — ' + site.address : '—') +
          row('موعد التوصيل', U().fmtDateTime(order.scheduled_at))) +
        KX.ui.card('قيمة النقل',
          row('إجمالي النقل', U().fmtOMR(order.transport_cost)) +
          row('عمولة المنصة', U().fmtOMR(((q || {}).internal || {}).transporter_commission || 0)) +
          '<hr class="divider">' +
          row('صافي المستحق', U().fmtOMR(((q || {}).internal || {}).transporter_payable || 0))) +
      '</div><div>' + KX.ui.card('الرحلات', tripsAssignTable(trips)) + '</div></div>',
      { title: order.order_no, subtitle: KX.orders.label(order.status) });
    bindTripActions(trips);
    U().on(document, 'click', '[data-to]', async function (ev, el) {
      try {
        await KX.orders.transition(order.id, el.dataset.to, { role: 'transporter' });
        U().toast('تم التحديث', 'success'); KX.router.resolve();
      } catch (err) { U().toast(err.message, 'error'); }
    });
  }

  function tripsAssignTable(trips) {
    return KX.ui.table([
      { key: 'seq', label: '#' },
      { key: 'status', label: 'الحالة', render: (t) => KX.ui.badge(KX.trips.TRIP_STATUS[t.status].label, KX.trips.TRIP_STATUS[t.status].tone) },
      { key: 'planned_tons', label: 'الكمية', num: true, render: (t) => U().fmtNum(t.actual_tons || t.planned_tons, 1) },
      { key: 'a', label: 'الإجراء', render: (t) => '<button class="btn btn--sm btn--ghost" data-assign="' + t.id + '">' +
          (t.driver_id ? 'تغيير السائق' : 'تعيين سائق') + '</button>' }
    ], trips, { compact: true, emptyText: 'لا توجد رحلات' });
  }

  async function transporterTrips() {
    const trips = await KX.trips.forTransporter(S().transporter_id);
    const [drivers, trucks, orders] = await Promise.all([
      KX.repo.list('drivers', { where: { transporter_id: S().transporter_id } }),
      KX.repo.list('trucks', { where: { transporter_id: S().transporter_id } }),
      KX.repo.mapBy('orders')
    ]);
    L().renderApp(KX.ui.table([
      { key: 'order_no', label: 'الطلب', render: (t) => '<a href="#/transporter/orders/' + t.order_id + '">' + e(t.order_no) + '</a>' },
      { key: 'seq', label: 'الرحلة', render: (t) => '#' + t.seq },
      { key: 'status', label: 'الحالة', render: (t) => KX.ui.badge(KX.trips.TRIP_STATUS[t.status].label, KX.trips.TRIP_STATUS[t.status].tone) },
      { key: 'd', label: 'السائق', render: (t) => e((drivers.find((d) => d.id === t.driver_id) || {}).name || '—') },
      { key: 'tr', label: 'الشاحنة', render: (t) => e((trucks.find((x) => x.id === t.truck_id) || {}).plate_no || '—') },
      { key: 'planned_tons', label: 'الكمية', num: true, render: (t) => U().fmtNum(t.actual_tons || t.planned_tons, 1) },
      { key: 'w', label: 'انتظار', render: (t) => t.waiting_minutes ? t.waiting_minutes + ' د' : '—' },
      { key: 'a', label: '', render: (t) => '<button class="btn btn--sm btn--ghost" data-assign="' + t.id + '">سائق</button> ' +
          '<button class="btn btn--sm btn--ghost" data-wait="' + t.id + '">انتظار</button>' }
    ], trips, { compact: true, emptyText: 'لا توجد رحلات' }), { title: 'الرحلات' });
    bindTripActions(trips, drivers, trucks);
  }

  function bindTripActions(trips, driversPre, trucksPre) {
    U().on(document, 'click', '[data-assign]', async function (ev, el) {
      const t = trips.find((x) => x.id === el.dataset.assign);
      const drivers = driversPre || await KX.repo.list('drivers', { where: { transporter_id: S().transporter_id } });
      const trucks  = trucksPre  || await KX.repo.list('trucks',  { where: { transporter_id: S().transporter_id } });
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = '<div class="modal"><h3>تعيين سائق وشاحنة — رحلة #' + t.seq + '</h3>' +
        KX.ui.field({ name: 'driver_id', label: 'السائق', type: 'select', value: t.driver_id || '',
          placeholder: 'اختر', options: drivers.map((d) => ({ value: d.id, label: d.name })) }) +
        KX.ui.field({ name: 'truck_id', label: 'الشاحنة', type: 'select', value: t.truck_id || '',
          placeholder: 'اختر', options: trucks.map((x) => ({ value: x.id, label: x.plate_no + ' — ' + x.capacity_tons + ' طن' })) }) +
        '<div class="modal__actions"><button class="btn btn--ghost" data-no>إلغاء</button>' +
        '<button class="btn btn--primary" data-yes>تعيين</button></div></div>';
      document.body.appendChild(wrap);
      wrap.querySelector('[data-no]').onclick = () => wrap.remove();
      wrap.querySelector('[data-yes]').onclick = async function () {
        const v = KX.ui.formValues(wrap);
        if (!v.driver_id || !v.truck_id) { U().toast('اختر السائق والشاحنة', 'error'); return; }
        await KX.trips.assignDriver(t.id, v.driver_id, v.truck_id);
        wrap.remove(); U().toast('عُيّن السائق', 'success'); KX.router.resolve();
      };
    });
    U().on(document, 'click', '[data-wait]', async function (ev, el) {
      const r = await U().confirmDialog({ title: 'تسجيل رسوم انتظار', reasonRequired: true,
        message: 'اذكر مدة الانتظار بالدقائق وسببها — لا تُحتسب إلا بعد اعتماد الإدارة.' });
      if (!r) return;
      const mins = parseInt(String(r).match(/\d+/) ? String(r).match(/\d+/)[0] : '0', 10);
      if (!mins) { U().toast('اكتب المدة بالدقائق داخل السبب', 'error'); return; }
      const fee = await KX.trips.requestWaiting(el.dataset.wait, mins, r);
      U().toast('سُجّل طلب انتظار بقيمة ' + U().fmtOMR(fee) + ' بانتظار الاعتماد', 'success');
      KX.router.resolve();
    });
  }

  async function transporterFleet() {
    const tid = S().transporter_id;
    const [trucks, drivers, types] = await Promise.all([
      KX.repo.list('trucks', { where: { transporter_id: tid } }),
      KX.repo.list('drivers', { where: { transporter_id: tid } }),
      KX.repo.list('truck_types', { where: { is_active: true } })
    ]);
    const tName = {}; types.forEach((t) => { tName[t.id] = t.name; });
    L().renderApp(
      '<div class="grid grid-2">' +
        KX.ui.card('إضافة شاحنة', '<form id="t-form">' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'plate_no', label: 'رقم اللوحة', required: true, placeholder: '1 د ح 4521' }) +
            KX.ui.field({ name: 'truck_type_id', label: 'النوع', type: 'select', required: true,
              placeholder: 'اختر', options: types.map((t) => ({ value: t.id, label: t.name + ' (' + t.capacity_tons + ' طن)' })) }) +
          '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'make', label: 'الطراز' }) +
            KX.ui.field({ name: 'year', label: 'سنة الصنع', type: 'number', value: '2022' }) +
          '</div>' +
          '<button class="btn btn--primary" type="submit">إضافة</button></form>') +
        KX.ui.card('إضافة سائق', '<form id="d-form">' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'name', label: 'اسم السائق', required: true }) +
            KX.ui.field({ name: 'phone', label: 'رقم الهاتف', required: true, inputmode: 'tel' }) +
          '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'license_no', label: 'رقم الرخصة', required: true }) +
            KX.ui.field({ name: 'license_expiry', label: 'انتهاء الرخصة', type: 'date' }) +
          '</div>' +
          '<button class="btn btn--primary" type="submit">إضافة</button></form>') +
      '</div>' +
      '<div class="mt">' + KX.ui.card('شاحناتي', KX.ui.table([
        { key: 'plate_no', label: 'اللوحة', render: (t) => '<b class="mono">' + e(t.plate_no) + '</b>' },
        { key: 'ty', label: 'النوع', render: (t) => e(tName[t.truck_type_id] || '—') },
        { key: 'capacity_tons', label: 'الحمولة', num: true, render: (t) => t.capacity_tons + ' طن' },
        { key: 'make', label: 'الطراز' }, { key: 'year', label: 'السنة', num: true },
        { key: 'is_available', label: 'التوفّر', render: (t) => KX.ui.badge(t.is_available ? 'متاحة' : 'غير متاحة', t.is_available ? 'ok' : 'muted') },
        { key: 'a', label: '', render: (t) => '<button class="btn btn--sm btn--ghost" data-tg-truck="' + t.id + '">تبديل التوفّر</button>' }
      ], trucks, { compact: true, emptyText: 'لا توجد شاحنات' })) + '</div>' +
      '<div class="mt">' + KX.ui.card('سائقيّ', KX.ui.table([
        { key: 'name', label: 'السائق' },
        { key: 'phone', label: 'الهاتف', render: (d) => '<span class="mono">' + e(U().fmtPhone(d.phone)) + '</span>' },
        { key: 'license_no', label: 'الرخصة' },
        { key: 'license_expiry', label: 'الانتهاء', render: (d) => U().fmtDate(d.license_expiry) },
        { key: 'is_active', label: 'الحالة', render: (d) => KX.ui.badge(d.is_active ? 'نشط' : 'موقوف', d.is_active ? 'ok' : 'muted') }
      ], drivers, { compact: true, emptyText: 'لا يوجد سائقون' })) + '</div>',
      { title: 'الشاحنات والسائقون' });

    document.getElementById('t-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      if (!v.plate_no || !v.truck_type_id) { U().toast('أكمل اللوحة والنوع', 'error'); return; }
      const ty = types.find((t) => t.id === v.truck_type_id);
      await KX.repo.insert('trucks', {
        transporter_id: tid, truck_type_id: v.truck_type_id, plate_no: v.plate_no,
        make: v.make, year: Number(v.year), capacity_tons: ty.capacity_tons, is_available: true
      });
      await KX.audit.log('truck.create', 'trucks', null, { plate: v.plate_no });
      U().toast('أُضيفت الشاحنة', 'success'); KX.router.resolve();
    };
    document.getElementById('d-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      if (!v.name || !U().isValidPhone(v.phone)) { U().toast('تحقّق من الاسم ورقم الهاتف', 'error'); return; }
      const phone = U().normalizePhone(v.phone);
      let user = await KX.repo.first('users', { phone: phone });
      if (!user) user = await KX.repo.insert('users', { name: v.name, phone: phone, role: 'driver', account_status: 'active' });
      await KX.repo.insert('drivers', {
        user_id: user.id, transporter_id: tid, name: v.name, phone: phone,
        license_no: v.license_no, license_expiry: v.license_expiry ? new Date(v.license_expiry).toISOString() : null,
        is_active: true
      });
      await KX.audit.log('driver.create', 'drivers', null, { name: v.name });
      U().toast('أُضيف السائق — يدخل بهذا الرقم ورمز التحقق', 'success'); KX.router.resolve();
    };
    U().on(document, 'click', '[data-tg-truck]', async function (ev, el) {
      const t = trucks.find((x) => x.id === el.dataset.tgTruck);
      await KX.repo.update('trucks', t.id, { is_available: !t.is_available });
      KX.router.resolve();
    });
  }

  async function transporterRates() {
    const [rates, zones, types] = await Promise.all([
      KX.repo.list('transport_rates', {}), KX.repo.list('delivery_zones', {}),
      KX.repo.list('truck_types', {})
    ]);
    const zName = {}; zones.forEach((z) => { zName[z.id] = z.name; });
    const tName = {}; types.forEach((t) => { tName[t.id] = t.name; });
    const mine = (S().transporter || {}).service_zones || [];
    L().renderApp(
      KX.ui.alert('التعرفة المعروضة هي تعرفة المنصة المعتمدة. لتعديلها لمناطقك تواصل مع إدارة المنصة.', 'info', 'ℹ️') +
      KX.ui.card('مناطق خدمتي', mine.length
        ? '<div class="row gap-sm">' + mine.map((z) => KX.ui.badge(zName[z] || z, 'info')).join('') + '</div>'
        : '<p class="muted">لم تُحدَّد مناطق خدمة.</p>') +
      '<div class="mt">' + KX.ui.card('تعرفة النقل المعتمدة', KX.ui.table([
        { key: 'z', label: 'المنطقة', render: (r) => e(zName[r.zone_id] || '—') },
        { key: 't', label: 'نوع الشاحنة', render: (r) => e(tName[r.truck_type_id] || '—') },
        { key: 'price_per_trip', label: 'سعر الرحلة', num: true, render: (r) => U().money(r.price_per_trip) },
        { key: 'price_per_km', label: 'لكل كم', num: true, render: (r) => U().money(r.price_per_km) }
      ], rates.filter((r) => r.is_active), { compact: true })) + '</div>',
      { title: 'أسعاري ومناطقي' });
  }

  async function transporterSettlements() {
    const rows = await KX.settlements.forParty('transporter', S().transporter_id);
    L().renderApp(settlementsTable(rows), { title: 'مستحقاتي' });
  }

  /* ==================== السائق ==================== */
  async function driverToday() {
    const did = S().driver_id;
    const trips = await KX.trips.forDriver(did);
    const active = trips.filter((t) => t.status !== 'delivered' && t.status !== 'cancelled');
    const [orders, sups, sites] = await Promise.all([
      KX.repo.mapBy('orders'), KX.repo.mapBy('suppliers'), KX.repo.mapBy('locations')
    ]);

    const cards = active.map(function (t) {
      const o = orders[t.order_id] || {};
      const sup = sups[o.supplier_id] || {};
      const site = sites[o.site_id] || {};
      const nxt = KX.trips.nextStatus(t.status);
      const mapLink = (c) => c ? 'https://maps.google.com/?q=' + c.lat + ',' + c.lng : '#';
      return '<div class="card mb">' +
        '<div class="row row--between mb"><div><b style="font-size:1.05rem">' + e(o.order_no || '') + '</b>' +
        ' <span class="muted">— رحلة #' + t.seq + '</span></div>' +
        KX.ui.badge(KX.trips.TRIP_STATUS[t.status].label, KX.trips.TRIP_STATUS[t.status].tone) + '</div>' +
        '<div class="panel mb">' +
          row('المادة', ((o.price_snapshot || {}).inputs || {}).material_name || '—') +
          row('الكمية', U().fmtNum(t.planned_tons, 1) + ' طن') +
          row('التحميل من', sup.name || '—') +
          row('التسليم في', site.label || '—') +
          row('الموعد', U().fmtDateTime(o.scheduled_at)) +
        '</div>' +
        '<div class="btn-group mb">' +
          '<a class="btn btn--ghost btn--sm" target="_blank" href="' + mapLink(sup.location) + '">🗺️ موقع الكسارة</a>' +
          '<a class="btn btn--ghost btn--sm" target="_blank" href="' + mapLink(site.coords) + '">📍 موقع العميل</a>' +
          (site.contact_phone ? '<a class="btn btn--ghost btn--sm" href="tel:+' + e(site.contact_phone) + '">📞 اتصال بالعميل</a>' : '') +
        '</div>' +
        '<div class="btn-group">' +
          (nxt ? '<button class="btn btn--primary" data-next="' + t.id + '" data-status="' + nxt + '">' +
                 '➡️ ' + e(KX.trips.TRIP_STATUS[nxt].label) + '</button>' : '') +
          (t.status === 'at_site'
            ? '<button class="btn btn--ok" data-deliver="' + t.id + '" data-order="' + t.order_id + '">✅ إتمام التسليم برمز العميل</button>' : '') +
          '<button class="btn btn--ghost" data-photo="' + t.id + '">📷 رفع صورة</button>' +
        '</div></div>';
    }).join('');

    L().renderApp(
      (active.length ? cards : KX.ui.empty('لا توجد مهام نشطة اليوم', '☕')),
      { title: 'مهامي اليوم', subtitle: S().name + ' — ' + active.length + ' مهمة نشطة' });

    U().on(document, 'click', '[data-next]', async function (ev, el) {
      await KX.trips.updateStatus(el.dataset.next, el.dataset.status);
      U().toast('حُدّثت حالة الرحلة', 'success'); KX.router.resolve();
    });
    U().on(document, 'click', '[data-photo]', function (ev, el) {
      const t = active.find((x) => x.id === el.dataset.photo);
      U().confirmDialog({ title: 'رفع صورة', confirmText: 'تسجيل',
        message: 'في النسخة التجريبية يُسجَّل مرجع الصورة فقط دون رفع ملف فعلي.' })
        .then(async function (ok) {
          if (!ok) return;
          await KX.repo.update('trips', t.id, {
            photos: (t.photos || []).concat([{ at: U().nowISO(), ref: 'photo-' + U().uid(), by: S().name }])
          });
          U().toast('سُجّلت الصورة', 'success');
        });
    });
    U().on(document, 'click', '[data-deliver]', function (ev, el) {
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = '<div class="modal"><h3>إتمام التسليم</h3>' +
        '<p>اطلب من العميل رمز الاستلام المكوّن من أربعة أرقام.</p>' +
        KX.ui.field({ name: 'code', label: 'رمز العميل', cls: 'otp-input', inputmode: 'numeric', placeholder: '••••' }) +
        '<div class="modal__actions"><button class="btn btn--ghost" data-no>إلغاء</button>' +
        '<button class="btn btn--ok" data-yes>تأكيد التسليم</button></div></div>';
      document.body.appendChild(wrap);
      wrap.querySelector('[data-no]').onclick = () => wrap.remove();
      wrap.querySelector('[data-yes]').onclick = async function () {
        const v = KX.ui.formValues(wrap);
        try {
          await KX.trips.updateStatus(el.dataset.deliver, 'delivered');
          await KX.orders.confirmReceipt(el.dataset.order, v.code, null);
          wrap.remove(); U().toast('اكتمل التسليم', 'success'); KX.router.resolve();
        } catch (err) { U().toast(err.message, 'error'); }
      };
    });
  }

  async function driverHistory() {
    const trips = await KX.trips.forDriver(S().driver_id);
    const done = trips.filter((t) => t.status === 'delivered' || t.status === 'cancelled');
    L().renderApp(KX.ui.table([
      { key: 'order_no', label: 'الطلب' },
      { key: 'seq', label: 'الرحلة', render: (t) => '#' + t.seq },
      { key: 'planned_tons', label: 'الكمية', num: true, render: (t) => U().fmtNum(t.actual_tons || t.planned_tons, 1) + ' طن' },
      { key: 'status', label: 'الحالة', render: (t) => KX.ui.badge(KX.trips.TRIP_STATUS[t.status].label, KX.trips.TRIP_STATUS[t.status].tone) },
      { key: 'u', label: 'التاريخ', render: (t) => U().fmtDate((t.timeline || []).slice(-1)[0].at) }
    ], done, { compact: true, emptyText: 'لا توجد رحلات سابقة' }), { title: 'رحلاتي السابقة' });
  }

  /* ==================== الإشعارات (مشتركة) ==================== */
  async function notifications() {
    const rows = await KX.notify.forUser(S().user_id);
    L().renderApp(
      (rows.some((n) => !n.read)
        ? '<div class="mb"><button class="btn btn--ghost btn--sm" id="all">تعليم الكل كمقروء</button></div>' : '') +
      (rows.length ? '<div class="stack">' + rows.map((n) =>
        '<div class="card" style="' + (n.read ? '' : 'border-inline-start:3px solid var(--orange-500)') + '">' +
        '<div class="row row--between"><b>' + e(n.title) + '</b>' +
        '<small class="muted">' + U().relTime(n.sent_at) + '</small></div>' +
        '<p style="margin:6px 0 0">' + e(n.body) + '</p>' +
        (n.link ? '<div class="mt"><a href="' + e(n.link) + '" class="btn btn--ghost btn--sm">فتح</a></div>' : '') +
        '</div>').join('') + '</div>'
        : KX.ui.empty('لا توجد إشعارات', '🔔')),
      { title: 'الإشعارات' });
    const all = document.getElementById('all');
    if (all) all.onclick = async function () {
      await KX.notify.markAllRead(S().user_id); KX.router.resolve();
    };
  }

  return { supplierDashboard, supplierOrders, supplierOrderDetail, supplierMaterials,
           supplierSettlements, supplierReports,
           transporterDashboard, transporterOrders, transporterOrderDetail, transporterTrips,
           transporterFleet, transporterRates, transporterSettlements,
           driverToday, driverHistory, notifications };
})();
