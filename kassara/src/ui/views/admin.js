/* لوحة الإدارة — المؤشرات والطلبات والمدفوعات والتسويات والتقارير والرقابة */
window.KX = window.KX || {};
KX.viewsAdmin = (function () {
  const e = (s) => KX.util.esc(s);
  const U = () => KX.util;
  const L = () => KX.layout;

  async function counts() {
    const orders = await KX.repo.list('orders', {});
    const c = {};
    const review = orders.filter((o) => ['under_review', 'awaiting_supplier', 'awaiting_carrier',
                                         'awaiting_transfer_verification'].indexOf(o.status) !== -1).length;
    if (review) c['/admin/orders'] = review;
    const ver = orders.filter((o) => o.status === 'awaiting_transfer_verification').length;
    if (ver) c['/admin/payments'] = ver;
    const comp = (await KX.repo.list('complaints', { where: { status: 'open' } })).length;
    if (comp) c['/admin/complaints'] = comp;
    return c;
  }

  /* ---------------- لوحة المؤشرات ---------------- */
  async function dashboard(ctx) {
    const days = Number((ctx.query || {}).days) || 30;
    L().renderApp(KX.ui.loading('جارٍ حساب المؤشرات…'), { title: 'لوحة المؤشرات' });

    const m = await KX.analytics.overview(days);
    const inPeriod = m.orders.filter((o) => o.created_at >= m.from);
    const [mats, zones, sup, car] = await Promise.all([
      KX.analytics.byMaterial(inPeriod), KX.analytics.byZone(inPeriod),
      KX.analytics.supplierPerformance(inPeriod), KX.analytics.carrierPerformance(inPeriod)
    ]);
    const settle = await KX.settlements.summary();

    const rangeBar = '<div class="filter-bar">' +
      [7, 30, 90, 365].map((d) => '<a href="#/admin?days=' + d + '" class="btn btn--sm ' +
        (days === d ? 'btn--navy' : 'btn--ghost') + '">' +
        (d === 365 ? 'سنة' : d + ' يوم') + '</a>').join('') + '</div>';

    const kpis = '<div class="grid grid-4">' +
      KX.ui.kpi({ label: 'عدد الطلبات', value: U().fmtNum(m.orders_count), delta: m.orders_delta, accent: true }) +
      KX.ui.kpi({ label: 'الأطنان المباعة', value: U().fmtNum(m.tons_sold, 1) + ' طن', delta: m.tons_delta }) +
      KX.ui.kpi({ label: 'إجمالي قيمة الطلبات', value: U().fmtOMR(m.gross_value), delta: m.gross_delta }) +
      KX.ui.kpi({ label: 'إيراد المنصة', value: U().fmtOMR(m.platform_revenue), delta: m.revenue_delta, accent: true }) +
      '</div><div class="grid grid-4 mt">' +
      KX.ui.kpi({ label: 'متوسط قيمة الطلب', value: U().fmtOMR(m.avg_order_value) }) +
      KX.ui.kpi({ label: 'متوسط زمن التوصيل', value: m.avg_delivery_hours + ' ساعة' }) +
      KX.ui.kpi({ label: 'الربحية لكل طن', value: U().fmtOMR(m.margin_per_ton) }) +
      KX.ui.kpi({ label: 'تكلفة النقل', value: U().fmtOMR(m.transport_cost) }) +
      '</div>';

    const attention = [];
    if (m.pending_verification) attention.push('<a href="#/admin/payments">' + m.pending_verification + ' تحويل بانتظار التحقق</a>');
    if (m.pending_payment) attention.push(m.pending_payment + ' طلب بانتظار دفع العميل');
    if (m.late) attention.push('<b>' + m.late + ' طلب متأخر عن موعده</b>');
    if (m.open_complaints) attention.push('<a href="#/admin/complaints">' + m.open_complaints + ' شكوى مفتوحة</a>');
    const alertBox = attention.length
      ? KX.ui.alert('يتطلب إجراءً: ' + attention.join(' • '), 'warn', '⚡') : '';

    /* الرسوم — كل رسم بمحور واحد، مع جدول بديل تحته */
    const ordersSeries = KX.analytics.daily(inPeriod, Math.min(days, 30), 'count');
    const valueSeries  = KX.analytics.daily(inPeriod, Math.min(days, 30), 'value');
    const split = KX.analytics.valueSplit(inPeriod);

    const charts =
      '<div class="grid grid-2 mt">' +
        KX.ui.card('عدد الطلبات اليومية',
          KX.charts.line(ordersSeries, { aria: 'عدد الطلبات لكل يوم', note: 'مرّر المؤشر على الرسم لعرض قيمة كل يوم.' })) +
        KX.ui.card('قيمة الطلبات اليومية (ر.ع.)',
          KX.charts.line(valueSeries, { aria: 'قيمة الطلبات لكل يوم' })) +
      '</div>' +
      '<div class="grid grid-2 mt">' +
        KX.ui.card('الأطنان المسلّمة حسب المادة',
          KX.charts.barsH(mats.slice(0, 8), { aria: 'الأطنان حسب المادة' }) +
          (mats.length ? KX.ui.table([
            { key: 'label', label: 'المادة' },
            { key: 'value', label: 'الأطنان', num: true, render: (r) => U().fmtNum(r.value, 1) }
          ], mats, { compact: true }) : '')) +
        KX.ui.card('أكثر المناطق طلبًا',
          KX.charts.barsH(zones.slice(0, 8), { aria: 'الطلبات حسب المنطقة' })) +
      '</div>' +
      '<div class="mt">' + KX.ui.card('توزيع قيمة الطلبات المسلّمة',
        KX.charts.stacked(split, { aria: 'توزيع القيمة بين المورد والناقل والمنصة',
          note: 'الضريبة مستثناة لأنها محصّلة لحساب الجهة الضريبية ولا تُعد إيرادًا.' }) +
        KX.ui.table([
          { key: 'label', label: 'البند' },
          { key: 'value', label: 'المبلغ', num: true, render: (r) => U().fmtOMR(r.value) }
        ], split, { compact: true })) + '</div>';

    const maxTons = Math.max.apply(null, sup.map((s) => s.tons).concat([1]));
    const perf =
      '<div class="grid grid-2 mt">' +
        KX.ui.card('أداء الموردين', KX.ui.table([
          { key: 'name', label: 'المورد' },
          { key: 'tons', label: 'الأطنان', num: true,
            render: (r) => U().fmtNum(r.tons, 1) + KX.charts.mini(r.tons, maxTons) },
          { key: 'delivered', label: 'مسلّم / كلي', num: true, render: (r) => r.delivered + ' / ' + r.orders },
          { key: 'fulfillment', label: 'نسبة الإنجاز', num: true, render: (r) => r.fulfillment + '%' },
          { key: 'rating', label: 'التقييم', num: true, render: (r) => '⭐ ' + r.rating }
        ], sup, { compact: true })) +
        KX.ui.card('أداء الناقلين', KX.ui.table([
          { key: 'name', label: 'الناقل' },
          { key: 'trips', label: 'الرحلات', num: true },
          { key: 'delivered_trips', label: 'منجزة', num: true },
          { key: 'value', label: 'قيمة النقل', num: true, render: (r) => U().fmtOMR(r.value) },
          { key: 'rating', label: 'التقييم', num: true, render: (r) => '⭐ ' + r.rating }
        ], car, { compact: true })) +
      '</div>';

    const money =
      '<div class="grid grid-3 mt">' +
        KX.ui.kpi({ label: 'مستحقات الموردين', value: U().fmtOMR(settle.pending_supplier), sub: 'غير مسددة' }) +
        KX.ui.kpi({ label: 'مستحقات الناقلين', value: U().fmtOMR(settle.pending_transporter), sub: 'غير مسددة' }) +
        KX.ui.kpi({ label: 'عملاء جدد / متكررون', value: m.new_customers + ' / ' + m.repeat_customers }) +
      '</div>';

    L().renderApp(rangeBar + alertBox + kpis + charts + perf + money,
      { title: 'لوحة المؤشرات', subtitle: 'آخر ' + days + ' يومًا',
        actions: '<button class="btn btn--ghost btn--sm" id="export-kpi">⬇️ تصدير المؤشرات</button>',
        counts: await counts() });
    KX.charts.bindTooltips();

    document.getElementById('export-kpi').onclick = function () {
      U().download('kpis-' + days + 'd.csv', U().toCSV([{
        الفترة_بالأيام: days, عدد_الطلبات: m.orders_count, الأطنان: m.tons_sold,
        قيمة_الطلبات: m.gross_value, إيراد_المنصة: m.platform_revenue,
        متوسط_الطلب: m.avg_order_value, متوسط_زمن_التوصيل_ساعة: m.avg_delivery_hours,
        الملغاة: m.cancelled, المتأخرة: m.late
      }]), 'text/csv');
    };
  }

  /* ---------------- إدارة الطلبات ---------------- */
  async function orders(ctx) {
    const status = (ctx.query || {}).status || 'all';
    const q = ((ctx.query || {}).q || '').trim();
    const all = await KX.orders.all();
    const [customers, suppliers, carriers] = await Promise.all([
      KX.repo.mapBy('customer_profiles'), KX.repo.mapBy('suppliers'), KX.repo.mapBy('transport_companies')
    ]);
    let rows = status === 'all' ? all
      : status === 'action' ? all.filter((o) => ['under_review', 'awaiting_supplier', 'awaiting_carrier',
                                                 'awaiting_transfer_verification'].indexOf(o.status) !== -1)
      : all.filter((o) => o.status === status);
    if (q) rows = rows.filter((o) => (o.order_no + ' ' + ((customers[o.customer_id] || {}).name || ''))
      .toLowerCase().indexOf(q.toLowerCase()) !== -1);

    const statusOpts = ['all', 'action'].concat(Object.keys(KX.orders.STATUS));
    const bar = '<div class="filter-bar">' +
      '<input class="input" id="q" placeholder="بحث برقم الطلب أو اسم العميل" value="' + e(q) + '">' +
      '<select id="st">' + statusOpts.map((s) => '<option value="' + s + '"' +
        (s === status ? ' selected' : '') + '>' +
        (s === 'all' ? 'كل الحالات' : s === 'action' ? '⚡ يتطلب إجراءً' : KX.orders.label(s)) +
        '</option>').join('') + '</select>' +
      '<button class="btn btn--ghost btn--sm" id="csv">⬇️ تصدير</button>' +
      '<span class="muted">' + rows.length + ' طلب</span></div>';

    L().renderApp(bar + KX.ui.table([
      { key: 'order_no', label: 'الطلب', render: (r) => '<a href="#/admin/orders/' + r.id + '"><b>' + e(r.order_no) + '</b></a>' },
      { key: 'c', label: 'العميل', render: (r) => e((customers[r.customer_id] || {}).name || '—') },
      { key: 's', label: 'المورد', render: (r) => e((suppliers[r.supplier_id] || {}).name || '—') },
      { key: 't', label: 'الناقل', render: (r) => e((carriers[r.transporter_id] || {}).name || '<span class="muted">غير معيّن</span>') },
      { key: 'tons', label: 'الأطنان', num: true, render: (r) => U().fmtNum(r.tons, 1) },
      { key: 'total', label: 'الإجمالي', num: true, render: (r) => U().fmtOMR(r.total) },
      { key: 'paid', label: 'المدفوع', num: true, render: (r) => U().fmtOMR(r.amount_paid || 0) },
      { key: 'status', label: 'الحالة', render: (r) => KX.ui.statusBadge(r.status) },
      { key: 'created_at', label: 'التاريخ', render: (r) => U().fmtDate(r.created_at) }
    ], rows, { emptyText: 'لا توجد طلبات مطابقة' }),
      { title: 'إدارة الطلبات', counts: await counts() });

    document.getElementById('st').onchange = function () { location.hash = '/admin/orders?status=' + this.value; };
    document.getElementById('q').onkeydown = function (ev) {
      if (ev.key === 'Enter') location.hash = '/admin/orders?status=' + status + '&q=' + encodeURIComponent(this.value);
    };
    document.getElementById('csv').onclick = function () {
      U().download('orders.csv', U().toCSV(rows.map((o) => ({
        رقم_الطلب: o.order_no, الحالة: KX.orders.label(o.status),
        العميل: (customers[o.customer_id] || {}).name, المورد: (suppliers[o.supplier_id] || {}).name,
        الأطنان: o.tons, الرحلات: o.trips_planned, الإجمالي: o.total, المدفوع: o.amount_paid,
        التاريخ: o.created_at
      }))), 'text/csv');
    };
  }

  /* ---------------- تفاصيل الطلب (إدارة) ---------------- */
  async function orderDetail(ctx) {
    const order = await KX.repo.get('orders', ctx.params.id);
    if (!order) { L().renderApp(KX.ui.alert('الطلب غير موجود', 'danger'), { title: 'الطلب' }); return; }
    const [customer, site, supplier, carriers, trips, payments, refunds, trucks, drivers] = await Promise.all([
      KX.repo.get('customer_profiles', order.customer_id),
      KX.repo.get('locations', order.site_id),
      KX.repo.get('suppliers', order.supplier_id),
      KX.repo.list('transport_companies', { where: { is_active: true } }),
      KX.trips.forOrder(order.id),
      KX.repo.list('payments', { where: { order_id: order.id } }),
      KX.repo.list('refunds', { where: { order_id: order.id } }),
      KX.repo.list('trucks', {}), KX.repo.list('drivers', {})
    ]);
    const role = KX.auth.role();
    const next = KX.orders.allowedTransitions(order.status, role);
    const q = order.price_snapshot;
    const internal = (q || {}).internal || {};

    const transitionBtns = next.map((t) =>
      '<button class="btn btn--sm ' + (t.to === 'cancelled' ? 'btn--ghost' : 'btn--navy') + '" ' +
      'data-to="' + t.to + '">' + e(t.label) + '</button>').join('');

    const assignBox = KX.ui.card('التعيين',
      '<div class="field-row">' +
      KX.ui.field({ name: 'transporter_id', label: 'شركة النقل', type: 'select',
        value: order.transporter_id || '', placeholder: 'اختر الناقل',
        options: carriers.map((c) => ({ value: c.id, label: c.name })) }) +
      KX.ui.field({ name: 'trips_planned', label: 'عدد الرحلات', type: 'number',
        value: order.trips_planned, min: 1 }) +
      '</div>' +
      '<button class="btn btn--primary btn--sm" id="assign">حفظ التعيين وإنشاء الرحلات</button>');

    const tripsBox = KX.ui.card('الرحلات (' + trips.length + ')',
      trips.length ? KX.ui.table([
        { key: 'seq', label: '#', render: (t) => t.seq },
        { key: 'status', label: 'الحالة', render: (t) => KX.ui.badge(KX.trips.TRIP_STATUS[t.status].label, KX.trips.TRIP_STATUS[t.status].tone) },
        { key: 'd', label: 'السائق', render: (t) => e(((drivers.find((x) => x.id === t.driver_id)) || {}).name || 'غير معيّن') },
        { key: 'tr', label: 'الشاحنة', render: (t) => e(((trucks.find((x) => x.id === t.truck_id)) || {}).plate_no || '—') },
        { key: 'tons', label: 'الكمية', num: true, render: (t) => U().fmtNum(t.actual_tons || t.planned_tons, 1) },
        { key: 'w', label: 'انتظار', num: true, render: (t) => t.waiting_minutes
            ? (t.waiting_minutes + ' د — ' + U().fmtOMR(t.waiting_fee) +
               (t.waiting_approved ? ' ' + KX.ui.badge('معتمد', 'ok')
                 : ' <button class="btn btn--sm btn--ok" data-approve-wait="' + t.id + '">اعتماد</button>')) : '—' }
      ], trips, { compact: true }) : '<p class="muted">لم تُنشأ رحلات بعد — عيّن الناقل أولًا.</p>');

    const financeBox = KX.ui.card('التحليل المالي الداخلي',
      row('قيمة المواد', U().fmtOMR(order.material_cost)) +
      row('تكلفة النقل', U().fmtOMR(order.transport_cost)) +
      row('رسوم المنصة', U().fmtOMR(order.platform_fee)) +
      row('عمولة المورد', U().fmtOMR(internal.supplier_commission || 0)) +
      row('عمولة الناقل', U().fmtOMR(internal.transporter_commission || 0)) +
      '<hr class="divider">' +
      row('إيراد المنصة', U().fmtOMR(internal.platform_revenue || order.platform_fee)) +
      row('مستحق المورد', U().fmtOMR(internal.supplier_payable || 0)) +
      row('مستحق الناقل', U().fmtOMR(internal.transporter_payable || 0)) +
      row('الربحية لكل طن', U().fmtOMR(internal.margin_per_ton || 0)));

    const history = (order.history || []).slice().reverse().map((h, i) => ({
      title: KX.orders.label(h.status),
      meta: U().fmtDateTime(h.at) + ' — ' + (h.by_name || h.by || '') + (h.note ? ' • ' + h.note : ''),
      current: i === 0
    }));

    L().renderApp(
      KX.ui.steps(order.status) +
      '<div class="card mb"><div class="row row--between">' +
        '<div><b>الإجراءات المتاحة</b><div class="muted" style="font-size:.82rem">الحالة الحالية: ' +
        e(KX.orders.label(order.status)) + '</div></div>' +
        '<div class="btn-group">' + (transitionBtns || '<span class="muted">لا توجد انتقالات متاحة</span>') +
        (Number(order.amount_paid) > Number(order.amount_refunded || 0)
          ? '<button class="btn btn--sm btn--danger" id="refund">↩️ استرداد</button>' : '') +
        '</div></div></div>' +
      '<div class="grid grid-2">' +
        '<div class="stack">' +
          KX.ui.card('الطلب',
            row('رقم الطلب', order.order_no) +
            row('العميل', (customer || {}).name + ' — ' + U().fmtPhone((customer || {}).phone)) +
            row('نوع الحساب', KX.schema.CUSTOMER_TYPES[(customer || {}).customer_type] || '—') +
            row('المادة', q ? q.inputs.material_name : '—') +
            row('المورد', (supplier || {}).name || '—') +
            row('الكمية', U().fmtNum(order.tons, 1) + ' طن') +
            row('الموقع', site ? site.label + ' — ' + site.address : '—') +
            row('الموعد', U().fmtDateTime(order.scheduled_at)) +
            row('رمز الاستلام', order.delivery_otp || '—') +
            (order.notes ? row('ملاحظات', order.notes) : '')) +
          assignBox + tripsBox +
        '</div>' +
        '<div class="stack">' +
          financeBox +
          KX.ui.card('المدفوعات والاستردادات',
            KX.ui.table([
              { key: 'method', label: 'العملية', render: (p) => e(KX.payments.METHODS[p.method] || p.method) },
              { key: 'amount', label: 'المبلغ', num: true, render: (p) => U().fmtOMR(p.amount) },
              { key: 'status', label: 'الحالة', render: (p) => e(p.status) },
              { key: 'a', label: '', render: (p) => p.status === 'pending_verification'
                  ? '<button class="btn btn--sm btn--ok" data-verify="' + p.id + '">اعتماد</button> ' +
                    '<button class="btn btn--sm btn--ghost" data-reject="' + p.id + '">رفض</button>' : '' }
            ], payments, { compact: true, emptyText: 'لا مدفوعات' }) +
            (refunds.length ? '<div class="mt">' + KX.ui.table([
              { key: 'amount', label: 'مسترد', num: true, render: (r) => U().fmtOMR(r.amount) },
              { key: 'reason', label: 'السبب' },
              { key: 'approved_by_name', label: 'اعتمده' }
            ], refunds, { compact: true }) + '</div>' : '')) +
          KX.ui.card('سجل الطلب الكامل', KX.ui.timeline(history)) +
        '</div>' +
      '</div>',
      { title: order.order_no, subtitle: (customer || {}).name, counts: await counts() });

    /* ربط الإجراءات */
    U().on(document, 'click', '[data-to]', async function (ev, el) {
      const to = el.dataset.to;
      const needsReason = to === 'cancelled' || to === 'disputed';
      const res = await U().confirmDialog({
        title: 'تغيير حالة الطلب', reasonRequired: needsReason, danger: to === 'cancelled',
        message: 'نقل الطلب إلى: ' + KX.orders.label(to)
      });
      if (!res) return;
      try {
        await KX.orders.transition(order.id, to, { note: typeof res === 'string' ? res : '' });
        if (to === 'preparing' && !trips.length && order.transporter_id)
          await KX.trips.createForOrder(order, { transporter_id: order.transporter_id });
        U().toast('تم التحديث', 'success'); KX.router.resolve();
      } catch (err) { U().toast(err.message, 'error'); }
    });
    const assign = document.getElementById('assign');
    if (assign) assign.onclick = async function () {
      const tid = document.querySelector('[name=transporter_id]').value;
      const n = Number(document.querySelector('[name=trips_planned]').value);
      if (!tid) { U().toast('اختر شركة النقل', 'error'); return; }
      await KX.repo.update('orders', order.id, { transporter_id: tid, trips_planned: n });
      await KX.audit.log('order.assign_carrier', 'orders', order.id, { transporter_id: tid, trips: n });
      const fresh = await KX.repo.get('orders', order.id);
      if (!trips.length) await KX.trips.createForOrder(fresh, { transporter_id: tid });
      U().toast('حُفظ التعيين', 'success'); KX.router.resolve();
    };
    U().on(document, 'click', '[data-verify]', async function (ev, el) {
      try { await KX.payments.verifyTransfer(el.dataset.verify, true, 'اعتماد من الإدارة');
        U().toast('اعتُمد التحويل', 'success'); KX.router.resolve(); }
      catch (err) { U().toast(err.message, 'error'); }
    });
    U().on(document, 'click', '[data-reject]', async function (ev, el) {
      const r = await U().confirmDialog({ title: 'رفض الإيصال', reasonRequired: true, danger: true, message: 'سيُعاد الطلب إلى حالة «جاهز للدفع».' });
      if (!r) return;
      await KX.payments.verifyTransfer(el.dataset.reject, false, r);
      U().toast('رُفض الإيصال'); KX.router.resolve();
    });
    U().on(document, 'click', '[data-approve-wait]', async function (ev, el) {
      await KX.trips.approveWaiting(el.dataset.approveWait, true);
      U().toast('اعتُمدت رسوم الانتظار', 'success'); KX.router.resolve();
    });
    const rf = document.getElementById('refund');
    if (rf) rf.onclick = async function () {
      const reason = await U().confirmDialog({
        title: 'استرداد مبلغ', reasonRequired: true, danger: true,
        message: 'النسبة المقترحة حسب المرحلة: ' +
          (KX.orders.refundPercentFor(order.status) * 100).toFixed(0) + '% من ' + U().fmtOMR(order.amount_paid)
      });
      if (!reason) return;
      try { await KX.payments.refund(order.id, { reason: reason });
        U().toast('نُفّذ الاسترداد', 'success'); KX.router.resolve(); }
      catch (err) { U().toast(err.message, 'error'); }
    };
  }

  function row(k, v) {
    return '<div class="row row--between" style="padding:6px 0;border-bottom:1px solid var(--border)">' +
      '<span class="muted">' + e(k) + '</span><b style="text-align:end">' + e(v) + '</b></div>';
  }

  /* ---------------- المدفوعات ---------------- */
  async function payments() {
    const [pays, refunds, orders] = await Promise.all([
      KX.repo.list('payments', { order: { field: 'created_at', dir: 'desc' } }),
      KX.repo.list('refunds', { order: { field: 'created_at', dir: 'desc' } }),
      KX.repo.mapBy('orders')
    ]);
    const pending = pays.filter((p) => p.status === 'pending_verification');
    const totals = {
      captured: U().round(U().sum(pays.filter((p) => p.status === 'captured'), (p) => +p.amount), 3),
      refunded: U().round(U().sum(refunds, (r) => +r.amount), 3)
    };
    L().renderApp(
      '<div class="grid grid-3 mb">' +
        KX.ui.kpi({ label: 'إجمالي المحصّل', value: U().fmtOMR(totals.captured), accent: true }) +
        KX.ui.kpi({ label: 'إجمالي المسترد', value: U().fmtOMR(totals.refunded) }) +
        KX.ui.kpi({ label: 'بانتظار التحقق', value: pending.length, sub: pending.length ? 'يتطلب إجراءً' : '' }) +
      '</div>' +
      (pending.length ? KX.ui.card('تحويلات بانتظار التحقق', KX.ui.table([
        { key: 'o', label: 'الطلب', render: (p) => '<a href="#/admin/orders/' + p.order_id + '">' +
            e((orders[p.order_id] || {}).order_no || '—') + '</a>' },
        { key: 'amount', label: 'المبلغ', num: true, render: (p) => U().fmtOMR(p.amount) },
        { key: 'transfer_ref', label: 'مرجع التحويل' },
        { key: 'transfer_bank', label: 'البنك' },
        { key: 'created_at', label: 'التاريخ', render: (p) => U().fmtDateTime(p.created_at) },
        { key: 'a', label: '', render: (p) => '<button class="btn btn--sm btn--ok" data-verify="' + p.id + '">اعتماد</button> ' +
            '<button class="btn btn--sm btn--ghost" data-reject="' + p.id + '">رفض</button>' }
      ], pending, { compact: true })) : '') +
      '<div class="mt">' + KX.ui.card('كل المدفوعات', KX.ui.table([
        { key: 'o', label: 'الطلب', render: (p) => '<a href="#/admin/orders/' + p.order_id + '">' +
            e((orders[p.order_id] || {}).order_no || '—') + '</a>' },
        { key: 'method', label: 'الطريقة', render: (p) => e(KX.payments.METHODS[p.method] || p.method) },
        { key: 'amount', label: 'المبلغ', num: true, render: (p) => U().fmtOMR(p.amount) },
        { key: 'status', label: 'الحالة', render: (p) => KX.ui.badge(
            p.status === 'captured' ? 'مُحصّلة' : p.status === 'pending_verification' ? 'بانتظار التحقق' : 'مرفوضة',
            p.status === 'captured' ? 'ok' : p.status === 'rejected' ? 'danger' : 'warn') },
        { key: 'provider_ref', label: 'مرجع العملية' },
        { key: 'created_at', label: 'التاريخ', render: (p) => U().fmtDateTime(p.created_at) }
      ], pays, { compact: true })) + '</div>' +
      '<div class="mt">' + KX.ui.card('الاستردادات', KX.ui.table([
        { key: 'o', label: 'الطلب', render: (r) => e((orders[r.order_id] || {}).order_no || '—') },
        { key: 'amount', label: 'المبلغ', num: true, render: (r) => U().fmtOMR(r.amount) },
        { key: 'percent_applied', label: 'النسبة', num: true, render: (r) => (r.percent_applied * 100).toFixed(0) + '%' },
        { key: 'reason', label: 'السبب' },
        { key: 'approved_by_name', label: 'اعتمده' },
        { key: 'created_at', label: 'التاريخ', render: (r) => U().fmtDate(r.created_at) }
      ], refunds, { compact: true, emptyText: 'لا توجد استردادات' })) + '</div>',
      { title: 'المدفوعات والاستردادات', counts: await counts() });

    U().on(document, 'click', '[data-verify]', async function (ev, el) {
      try { await KX.payments.verifyTransfer(el.dataset.verify, true, 'اعتماد من الإدارة');
        U().toast('اعتُمد التحويل', 'success'); KX.router.resolve(); }
      catch (err) { U().toast(err.message, 'error'); }
    });
    U().on(document, 'click', '[data-reject]', async function (ev, el) {
      const r = await U().confirmDialog({ title: 'رفض الإيصال', reasonRequired: true, danger: true, message: '' });
      if (!r) return;
      await KX.payments.verifyTransfer(el.dataset.reject, false, r);
      U().toast('رُفض الإيصال'); KX.router.resolve();
    });
  }

  /* ---------------- التسويات ---------------- */
  async function settlements() {
    const [rows, suppliers, carriers] = await Promise.all([
      KX.repo.list('settlements', { order: { field: 'created_at', dir: 'desc' } }),
      KX.repo.mapBy('suppliers'), KX.repo.mapBy('transport_companies')
    ]);
    const commissions = await KX.repo.list('commissions', {});
    const name = (r) => r.party_type === 'supplier'
      ? (suppliers[r.party_id] || {}).name : (carriers[r.party_id] || {}).name;
    const s = await KX.settlements.summary();
    const revenue = U().round(U().sum(commissions, (c) => +c.total_revenue), 3);

    L().renderApp(
      '<div class="grid grid-3 mb">' +
        KX.ui.kpi({ label: 'إيراد المنصة المعترف به', value: U().fmtOMR(revenue), accent: true }) +
        KX.ui.kpi({ label: 'مستحقات الموردين', value: U().fmtOMR(s.pending_supplier) }) +
        KX.ui.kpi({ label: 'مستحقات الناقلين', value: U().fmtOMR(s.pending_transporter) }) +
      '</div>' +
      KX.ui.card('التسويات', KX.ui.table([
        { key: 'order_no', label: 'الطلب' },
        { key: 'party_type', label: 'الطرف', render: (r) => KX.ui.badge(
            r.party_type === 'supplier' ? 'مورد' : 'ناقل', r.party_type === 'supplier' ? 'info' : 'orange') },
        { key: 'n', label: 'الاسم', render: (r) => e(name(r) || '—') },
        { key: 'gross_amount', label: 'الإجمالي', num: true, render: (r) => U().fmtOMR(r.gross_amount) },
        { key: 'commission', label: 'عمولة المنصة', num: true, render: (r) => U().fmtOMR(r.commission) },
        { key: 'net_payable', label: 'الصافي المستحق', num: true, render: (r) => '<b>' + U().fmtOMR(r.net_payable) + '</b>' },
        { key: 'due_date', label: 'تاريخ الاستحقاق', render: (r) => U().fmtDate(r.due_date) },
        { key: 'status', label: 'الحالة', render: (r) => KX.ui.badge(r.status === 'paid' ? 'مسددة' : 'معلّقة',
            r.status === 'paid' ? 'ok' : 'warn') },
        { key: 'a', label: '', render: (r) => r.status === 'pending'
            ? '<button class="btn btn--sm btn--ok" data-pay="' + r.id + '">تسديد</button>' : '' }
      ], rows, { compact: true, emptyText: 'لا توجد تسويات بعد' }),
        '<button class="btn btn--ghost btn--sm" id="csv">⬇️ تصدير</button>'),
      { title: 'العمولات والتسويات', counts: await counts() });

    U().on(document, 'click', '[data-pay]', async function (ev, el) {
      const ok = await U().confirmDialog({ title: 'تسديد المستحق', message: 'تأكيد صرف المستحق لهذا الطرف؟' });
      if (!ok) return;
      await KX.settlements.markPaid(el.dataset.pay, 'MANUAL-' + Date.now());
      U().toast('سُجّل التسديد', 'success'); KX.router.resolve();
    });
    document.getElementById('csv').onclick = function () {
      U().download('settlements.csv', U().toCSV(rows.map((r) => ({
        الطلب: r.order_no, الطرف: r.party_type, الاسم: name(r), الإجمالي: r.gross_amount,
        العمولة: r.commission, الصافي: r.net_payable, الحالة: r.status
      }))), 'text/csv');
    };
  }

  /* ---------------- الشكاوى ---------------- */
  async function complaints() {
    const rows = await KX.repo.list('complaints', { order: { field: 'created_at', dir: 'desc' } });
    L().renderApp(KX.ui.table([
      { key: 'created_at', label: 'التاريخ', render: (r) => U().fmtDateTime(r.created_at) },
      { key: 'name', label: 'المُبلِّغ', render: (r) => e(r.name || '—') + '<br><small class="mono">' +
          e(U().fmtPhone(r.phone || '')) + '</small>' },
      { key: 'subject', label: 'النوع' },
      { key: 'message', label: 'التفاصيل' },
      { key: 'status', label: 'الحالة', render: (r) => KX.ui.badge(
          r.status === 'open' ? 'مفتوحة' : 'مغلقة', r.status === 'open' ? 'warn' : 'ok') },
      { key: 'a', label: '', render: (r) => r.status === 'open'
          ? '<button class="btn btn--sm btn--ok" data-resolve="' + r.id + '">معالجة وإغلاق</button>' : e(r.resolution || '') }
    ], rows, { emptyText: 'لا توجد شكاوى' }), { title: 'الشكاوى', counts: await counts() });

    U().on(document, 'click', '[data-resolve]', async function (ev, el) {
      const r = await U().confirmDialog({ title: 'إغلاق الشكوى', reasonRequired: true,
        message: 'اكتب الإجراء المتخذ — سيظهر للعميل.' });
      if (!r) return;
      await KX.repo.update('complaints', el.dataset.resolve, { status: 'resolved', resolution: r, resolved_at: U().nowISO() });
      await KX.audit.log('complaint.resolve', 'complaints', el.dataset.resolve, { resolution: r });
      U().toast('أُغلقت الشكوى', 'success'); KX.router.resolve();
    });
  }

  /* ---------------- الإشعارات ---------------- */
  async function notifications() {
    const sent = await KX.repo.list('notifications', { order: { field: 'sent_at', dir: 'desc' }, limit: 50 });
    L().renderApp(
      KX.ui.card('إرسال إشعار جماعي',
        '<form id="n-form">' +
        KX.ui.field({ name: 'role', label: 'الفئة المستهدفة', type: 'select', placeholder: 'كل المستخدمين',
          options: Object.keys(KX.schema.ROLES).map((k) => ({ value: k, label: KX.schema.ROLES[k] })) }) +
        KX.ui.field({ name: 'title', label: 'العنوان', required: true }) +
        KX.ui.field({ name: 'body', label: 'النص', type: 'textarea', rows: 3, required: true }) +
        KX.ui.alert('القنوات الخارجية (SMS، واتساب، البريد، Push) مهيّأة في الكود ومعطّلة حتى ربط مزوّد فعلي.', 'info', '📡') +
        '<button class="btn btn--primary" type="submit">إرسال</button></form>') +
      '<div class="mt">' + KX.ui.card('آخر الإشعارات المرسلة', KX.ui.table([
        { key: 'sent_at', label: 'التاريخ', render: (n) => U().fmtDateTime(n.sent_at) },
        { key: 'title', label: 'العنوان' },
        { key: 'body', label: 'النص' },
        { key: 'read', label: 'مقروء', render: (n) => n.read ? '✅' : '—' }
      ], sent, { compact: true })) + '</div>',
      { title: 'الإشعارات', counts: await counts() });

    document.getElementById('n-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      if (!v.title || !v.body) { U().toast('أكمل العنوان والنص', 'error'); return; }
      const n = await KX.notify.broadcast(v.role || null, v.title, v.body);
      U().toast('أُرسل الإشعار إلى ' + n + ' مستخدم', 'success'); KX.router.resolve();
    };
  }

  /* ---------------- سجل التدقيق ---------------- */
  async function audit(ctx) {
    const q = ((ctx.query || {}).q || '').trim();
    let rows = await KX.repo.list('audit_logs', { order: { field: 'at', dir: 'desc' }, limit: 400 });
    if (q) rows = rows.filter((r) => (r.action + ' ' + r.entity + ' ' + (r.actor_name || ''))
      .toLowerCase().indexOf(q.toLowerCase()) !== -1);
    L().renderApp(
      '<div class="filter-bar"><input class="input" id="q" placeholder="بحث في السجل" value="' + e(q) + '">' +
      '<button class="btn btn--ghost btn--sm" id="csv">⬇️ تصدير</button>' +
      '<span class="muted">' + rows.length + ' عملية</span></div>' +
      KX.ui.alert('سجل التدقيق للقراءة فقط ولا يُحذف — يوثّق كل عملية حسّاسة ومن نفّذها.', 'info', '🛡️') +
      KX.ui.table([
        { key: 'at', label: 'الوقت', render: (r) => U().fmtDateTime(r.at) },
        { key: 'actor_name', label: 'المنفّذ', render: (r) => e(r.actor_name) + '<br><small class="muted">' +
            e(KX.schema.ROLES[r.actor_role] || r.actor_role) + '</small>' },
        { key: 'action', label: 'العملية', render: (r) => '<code>' + e(r.action) + '</code>' },
        { key: 'entity', label: 'الجدول' },
        { key: 'details', label: 'التفاصيل', render: (r) => '<small class="mono">' +
            e(JSON.stringify(r.details || {}).slice(0, 120)) + '</small>' }
      ], rows, { compact: true, emptyText: 'لا توجد عمليات مسجّلة' }),
      { title: 'سجل التدقيق', counts: await counts() });

    document.getElementById('q').onkeydown = function (ev) {
      if (ev.key === 'Enter') location.hash = '/admin/audit?q=' + encodeURIComponent(this.value);
    };
    document.getElementById('csv').onclick = function () {
      U().download('audit-log.csv', U().toCSV(rows.map((r) => ({
        الوقت: r.at, المنفذ: r.actor_name, الدور: r.actor_role, العملية: r.action,
        الجدول: r.entity, المعرف: r.entity_id, التفاصيل: JSON.stringify(r.details)
      }))), 'text/csv');
    };
  }

  /* ---------------- التقارير ---------------- */
  async function reports(ctx) {
    const days = Number((ctx.query || {}).days) || 90;
    const m = await KX.analytics.overview(days);
    const inPeriod = m.orders.filter((o) => o.created_at >= m.from);
    const [mats, zones, sup, car] = await Promise.all([
      KX.analytics.byMaterial(inPeriod), KX.analytics.byZone(inPeriod),
      KX.analytics.supplierPerformance(inPeriod), KX.analytics.carrierPerformance(inPeriod)
    ]);
    const statuses = KX.analytics.statusSplit(inPeriod);

    L().renderApp(
      '<div class="filter-bar">' + [30, 90, 180, 365].map((d) =>
        '<a href="#/admin/reports?days=' + d + '" class="btn btn--sm ' +
        (days === d ? 'btn--navy' : 'btn--ghost') + '">' + d + ' يوم</a>').join('') +
      '<button class="btn btn--ghost btn--sm" id="print">🖨️ طباعة التقرير</button></div>' +
      '<div class="grid grid-2">' +
        KX.ui.card('المبيعات حسب المادة', KX.ui.table([
          { key: 'label', label: 'المادة' },
          { key: 'value', label: 'الأطنان', num: true, render: (r) => U().fmtNum(r.value, 1) }
        ], mats, { compact: true })) +
        KX.ui.card('الطلبات حسب المنطقة', KX.ui.table([
          { key: 'label', label: 'المنطقة' },
          { key: 'value', label: 'عدد الطلبات', num: true }
        ], zones, { compact: true })) +
      '</div>' +
      '<div class="mt">' + KX.ui.card('توزيع الطلبات على الحالات', KX.ui.table([
        { key: 'label', label: 'الحالة' },
        { key: 'value', label: 'العدد', num: true },
        { key: 'p', label: 'النسبة', num: true, render: (r) =>
            ((r.value / (inPeriod.length || 1)) * 100).toFixed(1) + '%' }
      ], statuses, { compact: true })) + '</div>' +
      '<div class="grid grid-2 mt">' +
        KX.ui.card('تقرير الموردين', KX.ui.table([
          { key: 'name', label: 'المورد' }, { key: 'orders', label: 'طلبات', num: true },
          { key: 'tons', label: 'أطنان', num: true, render: (r) => U().fmtNum(r.tons, 1) },
          { key: 'value', label: 'قيمة المواد', num: true, render: (r) => U().fmtOMR(r.value) },
          { key: 'cancelled', label: 'ملغاة', num: true }
        ], sup, { compact: true }), '<button class="btn btn--ghost btn--sm" id="csv-sup">⬇️</button>') +
        KX.ui.card('تقرير الناقلين', KX.ui.table([
          { key: 'name', label: 'الناقل' }, { key: 'trips', label: 'رحلات', num: true },
          { key: 'delivered_trips', label: 'منجزة', num: true },
          { key: 'value', label: 'قيمة النقل', num: true, render: (r) => U().fmtOMR(r.value) }
        ], car, { compact: true }), '<button class="btn btn--ghost btn--sm" id="csv-car">⬇️</button>') +
      '</div>',
      { title: 'التقارير', subtitle: 'آخر ' + days + ' يومًا', counts: await counts() });

    document.getElementById('print').onclick = () => window.print();
    document.getElementById('csv-sup').onclick = () =>
      U().download('suppliers-report.csv', U().toCSV(sup), 'text/csv');
    document.getElementById('csv-car').onclick = () =>
      U().download('carriers-report.csv', U().toCSV(car), 'text/csv');
  }

  return { dashboard, orders, orderDetail, payments, settlements,
           complaints, notifications, audit, reports, counts, row };
})();
