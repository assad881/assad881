/* شاشات العميل */
window.KX = window.KX || {};
KX.viewsCustomer = (function () {
  const e = (s) => KX.util.esc(s);
  const U = () => KX.util;
  const L = () => KX.layout;
  const S = () => KX.auth.session();

  async function counts() {
    const orders = await KX.orders.forCustomer(S().customer_id);
    const pay = orders.filter((o) => o.status === 'ready_for_payment').length;
    const notes = (await KX.notify.forUser(S().user_id)).filter((n) => !n.read).length;
    const c = {};
    if (pay) c['/customer/orders'] = pay;
    if (notes) c['/notifications'] = notes;
    return c;
  }

  /* ---------------- لوحة المتابعة ---------------- */
  async function dashboard() {
    const cid = S().customer_id;
    const orders = await KX.orders.forCustomer(cid);
    const profile = await KX.repo.get('customer_profiles', cid);
    const active = orders.filter((o) => !KX.orders.isFinal(o.status));
    const delivered = orders.filter((o) => o.status === 'delivered');
    const toPay = orders.filter((o) => o.status === 'ready_for_payment');
    const tons = U().round(U().sum(delivered, (o) => Number(o.tons)), 1);
    const spent = U().round(U().sum(delivered, (o) => Number(o.total)), 3);

    const kpis = '<div class="grid grid-4">' +
      KX.ui.kpi({ label: 'طلبات نشطة', value: active.length, accent: true }) +
      KX.ui.kpi({ label: 'بانتظار الدفع', value: toPay.length, sub: toPay.length ? 'يتطلب إجراءً منك' : 'لا شيء معلّق' }) +
      KX.ui.kpi({ label: 'إجمالي الأطنان المستلمة', value: U().fmtNum(tons, 1) + ' طن' }) +
      KX.ui.kpi({ label: 'إجمالي المصروف', value: U().fmtOMR(spent) }) +
      '</div>';

    const payAlert = toPay.length
      ? KX.ui.alert('لديك ' + toPay.length + ' طلب جاهز للدفع. ' +
          '<a href="#/customer/orders/' + toPay[0].id + '"><b>ادفع الآن</b></a>', 'warn', '💳')
      : '';

    const recent = orders.slice(0, 6);
    const table = KX.ui.table([
      { key: 'order_no', label: 'رقم الطلب',
        render: (r) => '<a href="#/customer/orders/' + r.id + '"><b>' + e(r.order_no) + '</b></a>' },
      { key: 'tons', label: 'الكمية', num: true, render: (r) => U().fmtNum(r.tons, 1) + ' طن' },
      { key: 'total', label: 'الإجمالي', num: true, render: (r) => U().fmtOMR(r.total) },
      { key: 'status', label: 'الحالة', render: (r) => KX.ui.statusBadge(r.status) },
      { key: 'created_at', label: 'التاريخ', render: (r) => U().fmtDate(r.created_at) }
    ], recent, { emptyText: 'لم تنشئ أي طلب بعد — ابدأ بطلب جديد', emptyIcon: '🚚' });

    L().renderApp(payAlert + kpis + '<div class="mt">' +
      KX.ui.card('أحدث الطلبات', table,
        '<a href="#/customer/orders" class="btn btn--ghost btn--sm">عرض الكل</a>') + '</div>' +
      (profile && profile.credit_approved
        ? '<div class="mt">' + KX.ui.card('الحد الائتماني',
            '<div class="row row--between"><span>المستخدم من الحد</span><b>' +
            U().fmtOMR(profile.credit_used) + ' / ' + U().fmtOMR(profile.credit_limit) + '</b></div>') + '</div>'
        : ''),
      { title: 'مرحبًا ' + S().name, subtitle: 'متابعة طلباتك ومواقع مشاريعك',
        actions: '<a href="#/customer/new" class="btn btn--primary">➕ طلب جديد</a>',
        counts: await counts() });
  }

  /* ---------------- إنشاء طلب جديد ---------------- */
  async function newOrder() {
    const cid = S().customer_id;
    const [sites, mats, cats, suppliers, truckTypes, zones] = await Promise.all([
      KX.repo.list('locations', { where: { customer_id: cid } }),
      KX.repo.list('materials', { where: { is_active: true } }),
      KX.repo.list('material_categories', {}),
      KX.repo.list('suppliers', { where: { is_approved: true, is_active: true } }),
      KX.repo.list('truck_types', { where: { is_active: true } }),
      KX.repo.list('delivery_zones', { where: { is_active: true } })
    ]);
    const prices = await KX.repo.list('supplier_prices', { where: { is_active: true } });

    if (!sites.length) {
      L().renderApp(KX.ui.alert('أضف موقع مشروع أولًا حتى نتمكّن من حساب تكلفة النقل.', 'warn', '📍') +
        '<a href="#/customer/sites" class="btn btn--primary">إضافة موقع مشروع</a>',
        { title: 'طلب جديد', counts: await counts() });
      return;
    }

    const state = {
      site_id: (sites.find((s) => s.is_default) || sites[0]).id,
      material_id: null, supplier_id: null, truck_type_id: null,
      unit: 'ton', quantity: '', scheduled_at: '', coupon_code: '', notes: '',
      quote: null
    };

    const catName = {}; cats.forEach((c) => { catName[c.id] = c.name; });
    /* المواد التي لها سعر ساري لدى مورد واحد على الأقل */
    const availableMats = mats.filter((m) => prices.some((p) => p.material_id === m.id));

    function render() {
      const site = sites.find((s) => s.id === state.site_id);
      const suppliersFor = state.material_id
        ? suppliers.filter((s) => prices.some((p) => p.supplier_id === s.id && p.material_id === state.material_id))
        : [];

      const html =
        /* الخطوة 1: الموقع */
        KX.ui.card('1) موقع التوصيل',
          '<div class="choice-grid">' + sites.map((s) => KX.ui.choice({
            group: 'site', value: s.id, selected: s.id === state.site_id,
            title: s.label, meta: (zones.find((z) => z.id === s.zone_id) || {}).name + ' — ' + s.address
          })).join('') + '</div>' +
          '<div class="mt"><a href="#/customer/sites" class="btn btn--ghost btn--sm">إدارة المواقع</a></div>') +

        /* الخطوة 2: المادة */
        '<div class="mt">' + KX.ui.card('2) المادة المطلوبة',
          '<div class="choice-grid">' + availableMats.map(function (m) {
            const ps = prices.filter((p) => p.material_id === m.id && !p.customer_id);
            const min = ps.length ? Math.min.apply(null, ps.map((p) => Number(p.price_per_ton))) : 0;
            return KX.ui.choice({
              group: 'material', value: m.id, selected: m.id === state.material_id,
              title: m.name, meta: catName[m.category_id],
              price: 'من ' + U().money(min) + ' / طن'
            });
          }).join('') + '</div>') + '</div>' +

        /* الخطوة 3: المورد */
        (state.material_id ? '<div class="mt">' + KX.ui.card('3) المورد',
          '<div class="choice-grid">' + suppliersFor.map(function (s) {
            const p = prices.find((x) => x.supplier_id === s.id && x.material_id === state.material_id && !x.customer_id);
            return KX.ui.choice({
              group: 'supplier', value: s.id, selected: s.id === state.supplier_id,
              title: s.name, meta: s.wilayat + ' • ⭐ ' + s.rating + ' • طاقة ' + s.loading_capacity_tons_day + ' طن/يوم',
              price: U().money(p ? p.price_per_ton : 0) + ' / طن'
            });
          }).join('') + '</div>') + '</div>' : '') +

        /* الخطوة 4: الكمية والشاحنة */
        (state.supplier_id ? '<div class="mt">' + KX.ui.card('4) الكمية والشاحنة',
          '<div class="choice-grid mb">' + truckTypes.map((t) => KX.ui.choice({
            group: 'truck', value: t.id, selected: t.id === state.truck_type_id,
            title: t.name, meta: 'حمولة ' + t.capacity_tons + ' طن'
          })).join('') + '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'unit', label: 'وحدة الطلب', type: 'select', value: state.unit,
              options: [{ value: 'ton', label: 'بالطن' }, { value: 'truck', label: 'بعدد الشاحنات' }] }) +
            KX.ui.field({ name: 'quantity', label: state.unit === 'ton' ? 'الكمية (طن)' : 'عدد الشاحنات',
              type: 'number', step: state.unit === 'ton' ? '0.5' : '1', min: 1, value: state.quantity, required: true }) +
          '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'scheduled_at', label: 'تاريخ ووقت التوصيل', type: 'datetime-local',
              value: state.scheduled_at, required: true }) +
            KX.ui.field({ name: 'coupon_code', label: 'كوبون خصم (اختياري)', value: state.coupon_code,
              placeholder: 'WELCOME10' }) +
          '</div>' +
          KX.ui.field({ name: 'notes', label: 'ملاحظات للمورد أو السائق', type: 'textarea', rows: 2, value: state.notes }) +
          '<button class="btn btn--navy btn--block" id="calc">احسب السعر</button>') + '</div>' : '') +

        /* الخطوة 5: عرض السعر */
        '<div id="quote-area" class="mt"></div>';

      L().renderApp(html, { title: 'طلب جديد',
        subtitle: 'الموقع: ' + (site ? site.label : '—'), counts: null });
      bind();
      if (state.quote) renderQuote();
    }

    function bind() {
      const root = document.getElementById('app');
      KX.ui.bindChoices(root, 'site', (v) => { state.site_id = v; state.quote = null; render(); });
      KX.ui.bindChoices(root, 'material', (v) => {
        state.material_id = v; state.supplier_id = null; state.quote = null; render();
      });
      KX.ui.bindChoices(root, 'supplier', (v) => { state.supplier_id = v; state.quote = null; render(); });
      KX.ui.bindChoices(root, 'truck', (v) => { state.truck_type_id = v; state.quote = null; render(); });

      ['unit', 'quantity', 'scheduled_at', 'coupon_code', 'notes'].forEach(function (n) {
        const el = document.querySelector('[name=' + n + ']');
        if (!el) return;
        el.onchange = function () {
          state[n] = el.value;
          if (n === 'unit') { state.quote = null; render(); }
        };
      });
      const calc = document.getElementById('calc');
      if (calc) calc.onclick = doQuote;
    }

    async function doQuote() {
      const el = (n) => document.querySelector('[name=' + n + ']');
      ['unit', 'quantity', 'scheduled_at', 'coupon_code', 'notes'].forEach((n) => { if (el(n)) state[n] = el(n).value; });
      if (!state.truck_type_id) { U().toast('اختر نوع الشاحنة', 'error'); return; }
      if (!Number(state.quantity)) { U().toast('أدخل الكمية', 'error'); return; }
      if (!state.scheduled_at) { U().toast('حدّد تاريخ ووقت التوصيل', 'error'); return; }

      const site = sites.find((s) => s.id === state.site_id);
      document.getElementById('quote-area').innerHTML = KX.ui.loading('جارٍ حساب السعر…');
      const q = await KX.pricing.quote({
        supplier_id: state.supplier_id, material_id: state.material_id,
        quantity: Number(state.quantity), unit: state.unit,
        truck_type_id: state.truck_type_id, zone_id: site.zone_id, site: site.coords,
        customer_id: cid, coupon_code: state.coupon_code,
        scheduled_at: new Date(state.scheduled_at).toISOString()
      });
      state.quote = q;
      renderQuote();
    }

    function renderQuote() {
      const q = state.quote;
      const area = document.getElementById('quote-area');
      if (!q.ok && q.errors && q.errors.length) {
        area.innerHTML = KX.ui.alert(q.errors.map(e).join('<br>'), 'danger', '⛔');
        return;
      }
      area.innerHTML = KX.ui.card('5) ملخّص السعر',
        (q.warnings.length ? KX.ui.alert(q.warnings.map(e).join('<br>'), 'warn', '⚠️') : '') +
        '<div class="grid grid-2">' +
          '<div>' +
            '<div class="panel mb"><div class="row row--between"><span>الكمية</span><b>' +
              U().fmtNum(q.quantities.tons, 1) + ' طن</b></div>' +
            '<div class="row row--between"><span>عدد الرحلات</span><b>' + q.quantities.trips +
              ' رحلة × ' + q.inputs.truck_name + '</b></div>' +
            '<div class="row row--between"><span>المورد</span><b>' + e(q.inputs.supplier_name) + '</b></div>' +
            '<div class="row row--between"><span>المنطقة</span><b>' + e(q.inputs.zone_name) + '</b></div>' +
            (q.inputs.distance_km ? '<div class="row row--between"><span>المسافة التقريبية</span><b>' +
              q.inputs.distance_km + ' كم</b></div>' : '') +
            '</div>' +
            '<button class="btn btn--primary btn--block btn--lg" id="submit-order">إرسال الطلب للمراجعة</button>' +
            '<p class="muted" style="font-size:.8rem;margin-top:8px">لن يُطلب منك الدفع الآن. بعد تأكيد ' +
            'توفّر المادة والناقل سيصلك إشعار بأن الطلب جاهز للدفع.</p>' +
          '</div>' +
          '<div>' + KX.ui.priceBox(q) + '</div>' +
        '</div>');

      document.getElementById('submit-order').onclick = async function () {
        const ok = await U().confirmDialog({
          title: 'تأكيد إرسال الطلب',
          message: 'السعر النهائي ' + U().fmtOMR(q.totals.total) + ' شامل التوريد والنقل والضريبة. ' +
                   'سيُراجع الطلب ثم يُفتح الدفع.',
          confirmText: 'إرسال الطلب'
        });
        if (!ok) return;
        try {
          const order = await KX.orders.createFromQuote(q, {
            customer_id: cid, site_id: state.site_id,
            scheduled_at: new Date(state.scheduled_at).toISOString(), notes: state.notes
          });
          await KX.orders.transition(order.id, 'under_review', { role: 'customer', note: 'إرسال من العميل' });
          U().toast('أُرسل طلبك ' + order.order_no, 'success');
          KX.router.go('/customer/orders/' + order.id);
        } catch (err) { U().toast(err.message, 'error'); }
      };
    }
    render();
  }

  /* ---------------- قائمة الطلبات ---------------- */
  async function ordersList(ctx) {
    const orders = await KX.orders.forCustomer(S().customer_id);
    const filter = (ctx.query || {}).status || 'all';
    const shown = filter === 'all' ? orders
      : filter === 'active' ? orders.filter((o) => !KX.orders.isFinal(o.status))
      : orders.filter((o) => o.status === filter);

    const tabs = '<div class="tabs">' +
      [['all', 'الكل'], ['active', 'النشطة'], ['ready_for_payment', 'بانتظار الدفع'],
       ['delivered', 'المستلمة'], ['cancelled', 'الملغاة']]
      .map((t) => '<button class="' + (filter === t[0] ? 'is-active' : '') + '" ' +
        'onclick="location.hash=\'/customer/orders?status=' + t[0] + '\'">' + e(t[1]) + '</button>').join('') +
      '</div>';

    L().renderApp(tabs + KX.ui.table([
      { key: 'order_no', label: 'رقم الطلب', render: (r) => '<a href="#/customer/orders/' + r.id + '"><b>' + e(r.order_no) + '</b></a>' },
      { key: 'm', label: 'المادة', render: (r) => e((r.price_snapshot || {}).inputs ? r.price_snapshot.inputs.material_name : '—') },
      { key: 'tons', label: 'الكمية', num: true, render: (r) => U().fmtNum(r.tons, 1) + ' طن' },
      { key: 'trips_planned', label: 'الرحلات', num: true },
      { key: 'total', label: 'الإجمالي', num: true, render: (r) => U().fmtOMR(r.total) },
      { key: 'status', label: 'الحالة', render: (r) => KX.ui.statusBadge(r.status) },
      { key: 'created_at', label: 'التاريخ', render: (r) => U().fmtDate(r.created_at) },
      { key: 'a', label: '', render: (r) => '<a href="#/customer/orders/' + r.id + '" class="btn btn--ghost btn--sm">تفاصيل</a>' }
    ], shown, { emptyText: 'لا توجد طلبات في هذا التصنيف' }),
      { title: 'طلباتي', actions: '<a href="#/customer/new" class="btn btn--primary">➕ طلب جديد</a>',
        counts: await counts() });
  }

  /* ---------------- تفاصيل الطلب ---------------- */
  async function orderDetail(ctx) {
    const order = await KX.repo.get('orders', ctx.params.id);
    if (!order || order.customer_id !== S().customer_id) {
      L().renderApp(KX.ui.alert('الطلب غير موجود أو لا تملك صلاحية عرضه.', 'danger'), { title: 'الطلب' });
      return;
    }
    const [site, supplier, trips, payments, invoice, refunds] = await Promise.all([
      KX.repo.get('locations', order.site_id),
      KX.repo.get('suppliers', order.supplier_id),
      KX.trips.forOrder(order.id),
      KX.repo.list('payments', { where: { order_id: order.id } }),
      KX.repo.first('invoices', { order_id: order.id }),
      KX.repo.list('refunds', { where: { order_id: order.id } })
    ]);
    const q = order.price_snapshot;
    const due = U().round(Number(order.total) - Number(order.amount_paid || 0), 3);

    /* الإجراءات المتاحة للعميل */
    let actions = '';
    if (order.status === 'ready_for_payment')
      actions += '<button class="btn btn--primary" id="pay">💳 ادفع ' + U().fmtOMR(due) + '</button>';
    if (order.status === 'arrived')
      actions += '<button class="btn btn--ok" id="receipt">✅ تأكيد الاستلام</button>';
    if (!KX.orders.isLocked(order.status) && !KX.orders.isFinal(order.status))
      actions += '<button class="btn btn--ghost" id="cancel">إلغاء الطلب</button>';
    if (order.status === 'delivered') {
      actions += '<button class="btn btn--ghost" id="reorder">🔁 إعادة الطلب</button>';
      actions += '<button class="btn btn--ghost" id="review">⭐ تقييم</button>';
    }
    if (invoice) actions += '<a href="#/customer/invoices/' + invoice.id + '" class="btn btn--ghost">🧾 الفاتورة</a>';

    const tripsHtml = trips.length ? KX.ui.table([
      { key: 'seq', label: 'الرحلة', render: (t) => '#' + t.seq },
      { key: 'status', label: 'الحالة', render: (t) => KX.ui.badge(KX.trips.TRIP_STATUS[t.status].label, KX.trips.TRIP_STATUS[t.status].tone) },
      { key: 'planned_tons', label: 'الكمية', num: true, render: (t) => U().fmtNum(t.actual_tons || t.planned_tons, 1) + ' طن' },
      { key: 'u', label: 'آخر تحديث', render: (t) => U().relTime((t.timeline || []).slice(-1)[0].at) }
    ], trips, { compact: true }) : '<p class="muted">لم تُعيَّن الشاحنات بعد.</p>';

    const history = (order.history || []).slice().reverse().map((h, i) => ({
      title: KX.orders.label(h.status), meta: U().fmtDateTime(h.at) + (h.note ? ' — ' + h.note : ''),
      current: i === 0
    }));

    const payHtml = payments.length ? KX.ui.table([
      { key: 'method', label: 'الطريقة', render: (p) => e(KX.payments.METHODS[p.method] || p.method) },
      { key: 'amount', label: 'المبلغ', num: true, render: (p) => U().fmtOMR(p.amount) },
      { key: 'status', label: 'الحالة', render: (p) => KX.ui.badge(
          p.status === 'captured' ? 'مُحصّلة' : p.status === 'pending_verification' ? 'بانتظار التحقق' : 'مرفوضة',
          p.status === 'captured' ? 'ok' : p.status === 'rejected' ? 'danger' : 'warn') },
      { key: 'created_at', label: 'التاريخ', render: (p) => U().fmtDateTime(p.created_at) }
    ], payments, { compact: true }) : '<p class="muted">لا توجد مدفوعات بعد.</p>';

    L().renderApp(
      KX.ui.steps(order.status) +
      (order.status === 'arrived'
        ? KX.ui.alert('وصلت الشاحنة. رمز الاستلام الخاص بك: <b style="font-size:1.15rem">' +
            e(order.delivery_otp) + '</b> — أعطه للسائق أو أكّد الاستلام من هنا.', 'warn', '📍') : '') +
      (due > 0.001 && order.status === 'ready_for_payment'
        ? KX.ui.alert('المبلغ المستحق ' + U().fmtOMR(due) + '. لا يبدأ التنفيذ قبل السداد.', 'warn', '💳') : '') +
      (refunds.length ? KX.ui.alert('تم استرداد ' + U().fmtOMR(U().sum(refunds, (r) => +r.amount)) +
            ' — ' + e(refunds[0].reason || ''), 'info', '↩️') : '') +
      '<div class="grid grid-2">' +
        '<div class="stack">' +
          KX.ui.card('تفاصيل الطلب',
            row('رقم الطلب', order.order_no) +
            row('المادة', q ? q.inputs.material_name : '—') +
            row('المورد', supplier ? supplier.name : '—') +
            row('الكمية', U().fmtNum(order.tons, 1) + ' طن') +
            row('الرحلات', order.trips_planned + ' × ' + (q ? q.inputs.truck_name : '')) +
            row('موقع التوصيل', site ? site.label + ' — ' + site.address : '—') +
            row('موعد التوصيل', U().fmtDateTime(order.scheduled_at)) +
            (order.notes ? row('ملاحظات', order.notes) : '')) +
          KX.ui.card('الشاحنات', tripsHtml) +
          KX.ui.card('المدفوعات', payHtml) +
        '</div>' +
        '<div class="stack">' +
          (q ? KX.ui.priceBox(q) : '') +
          KX.ui.card('سجل الحالة', KX.ui.timeline(history)) +
        '</div>' +
      '</div>',
      { title: order.order_no, subtitle: KX.orders.label(order.status), actions: actions,
        counts: await counts() });

    /* ربط الإجراءات */
    const btn = (id) => document.getElementById(id);
    if (btn('pay')) btn('pay').onclick = () => payDialog(order, due);
    if (btn('receipt')) btn('receipt').onclick = () => receiptDialog(order);
    if (btn('cancel')) btn('cancel').onclick = async function () {
      const pct = KX.orders.refundPercentFor(order.status);
      const reason = await U().confirmDialog({
        title: 'إلغاء الطلب', danger: true, reasonRequired: true, confirmText: 'تأكيد الإلغاء',
        message: 'نسبة الاسترداد في المرحلة الحالية: ' + (pct * 100).toFixed(0) + '% — ' +
                 KX.orders.refundNoteFor(order.status)
      });
      if (!reason) return;
      try {
        await KX.orders.transition(order.id, 'cancelled', { role: 'customer', note: reason });
        if (Number(order.amount_paid) > 0)
          await KX.payments.refund(order.id, { reason: reason, percent: pct });
        U().toast('أُلغي الطلب', 'success');
        KX.router.resolve();
      } catch (err) { U().toast(err.message, 'error'); }
    };
    if (btn('reorder')) btn('reorder').onclick = () => KX.router.go('/customer/new');
    if (btn('review')) btn('review').onclick = () => reviewDialog(order);
  }

  function row(k, v) {
    return '<div class="row row--between" style="padding:6px 0;border-bottom:1px solid var(--border)">' +
      '<span class="muted">' + e(k) + '</span><b style="text-align:end">' + e(v) + '</b></div>';
  }

  /* ---------------- نافذة الدفع ---------------- */
  async function payDialog(order, due) {
    const profile = await KX.repo.get('customer_profiles', order.customer_id);
    const company = await KX.repo.setting('company', {});
    const methods = KX.config.payments.methods.filter((m) =>
      m !== 'credit_terms' || (profile && profile.credit_approved));

    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = '<div class="modal"><h3>دفع الطلب ' + e(order.order_no) + '</h3>' +
      '<p>المبلغ المستحق: <b>' + U().fmtOMR(due) + '</b></p>' +
      KX.ui.field({ name: 'method', label: 'طريقة الدفع', type: 'select',
        options: methods.map((m) => ({ value: m, label: KX.payments.METHODS[m] })) }) +
      '<div id="pm-extra"></div>' +
      '<div class="modal__actions"><button class="btn btn--ghost" data-no>إلغاء</button>' +
      '<button class="btn btn--primary" data-yes>تأكيد الدفع</button></div></div>';
    document.body.appendChild(wrap);

    const sel = wrap.querySelector('[name=method]');
    const extra = wrap.querySelector('#pm-extra');
    function renderExtra() {
      const m = sel.value;
      if (m === 'card') {
        extra.innerHTML = KX.ui.alert('بيئة تجريبية — لا تُدخل بيانات بطاقة حقيقية. ' +
          'في الإنتاج تُوجَّه العملية إلى بوابة دفع مرخّصة ولا تُخزَّن أي بيانات بطاقة لدينا.', 'info', '🔒') +
          KX.ui.field({ name: 'last4', label: 'آخر 4 أرقام (لأغراض العرض فقط)', value: '4242', inputmode: 'numeric' });
      } else if (m === 'bank_transfer') {
        extra.innerHTML = KX.ui.alert('حوّل المبلغ إلى: <b>' + e(company.bank_name || '—') + '</b><br>' +
          'الآيبان: <b class="mono">' + e(company.iban || '—') + '</b><br>ثم ارفع مرجع التحويل.', 'info', '🏦') +
          KX.ui.field({ name: 'transfer_ref', label: 'رقم مرجع التحويل', required: true }) +
          KX.ui.field({ name: 'bank', label: 'البنك المحوّل منه' });
      } else if (m === 'deposit') {
        const pct = KX.config.payments.depositPercent;
        extra.innerHTML = KX.ui.alert('العربون ' + pct + '% = <b>' +
          U().fmtOMR(U().round(order.total * pct / 100, 3)) + '</b>. ' +
          'يُسدَّد المتبقي قبل إصدار أمر التحميل.', 'warn', '💰');
      } else {
        extra.innerHTML = KX.ui.alert('سيُخصم المبلغ من حدك الائتماني المعتمد.', 'info', '📄');
      }
    }
    sel.onchange = renderExtra; renderExtra();

    wrap.querySelector('[data-no]').onclick = () => wrap.remove();
    wrap.querySelector('[data-yes]').onclick = async function () {
      const v = KX.ui.formValues(wrap);
      try {
        wrap.querySelector('[data-yes]').disabled = true;
        await KX.payments.pay(order.id, {
          method: v.method, receipt_url: null, transfer_ref: v.transfer_ref, bank: v.bank,
          meta: { last4: v.last4 }
        });
        wrap.remove();
        U().toast(v.method === 'bank_transfer' ? 'استلمنا بيانات التحويل، جارٍ التحقق' : 'تم الدفع بنجاح', 'success');
        KX.router.resolve();
      } catch (err) {
        wrap.querySelector('[data-yes]').disabled = false;
        U().toast(err.message, 'error');
      }
    };
  }

  /* ---------------- تأكيد الاستلام ---------------- */
  function receiptDialog(order) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = '<div class="modal"><h3>تأكيد استلام الطلب</h3>' +
      '<p>أدخل رمز الاستلام، أو أكّد بالتوقيع الإلكتروني.</p>' +
      KX.ui.field({ name: 'code', label: 'رمز الاستلام', cls: 'otp-input', inputmode: 'numeric', placeholder: '••••' }) +
      '<label class="checkbox"><input type="checkbox" name="sig"> أؤكد الاستلام بتوقيعي الإلكتروني ' +
      '(' + e(S().name) + ')</label>' +
      '<div class="modal__actions"><button class="btn btn--ghost" data-no>إلغاء</button>' +
      '<button class="btn btn--ok" data-yes>تأكيد الاستلام</button></div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('[data-no]').onclick = () => wrap.remove();
    wrap.querySelector('[data-yes]').onclick = async function () {
      const v = KX.ui.formValues(wrap);
      try {
        await KX.orders.confirmReceipt(order.id, v.code, v.sig ? S().name + ' — ' + U().nowISO() : null);
        wrap.remove();
        U().toast('تم تأكيد الاستلام وصدرت الفاتورة', 'success');
        KX.router.resolve();
      } catch (err) { U().toast(err.message, 'error'); }
    };
  }

  /* ---------------- التقييم ---------------- */
  async function reviewDialog(order) {
    const existing = await KX.repo.first('reviews', { order_id: order.id });
    if (existing) { U().toast('سبق أن قيّمت هذا الطلب'); return; }
    const stars = (n) => Array.from({ length: 5 }, (_, i) =>
      '<option value="' + (i + 1) + '"' + (i + 1 === n ? ' selected' : '') + '>' +
      '★'.repeat(i + 1) + '</option>').join('');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = '<div class="modal"><h3>تقييم الخدمة</h3>' +
      '<label class="field"><span>تقييم المورد</span><select name="s">' + stars(5) + '</select></label>' +
      '<label class="field"><span>تقييم الناقل</span><select name="t">' + stars(5) + '</select></label>' +
      KX.ui.field({ name: 'comment', label: 'ملاحظاتك', type: 'textarea', rows: 3 }) +
      '<div class="modal__actions"><button class="btn btn--ghost" data-no>لاحقًا</button>' +
      '<button class="btn btn--primary" data-yes>إرسال التقييم</button></div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('[data-no]').onclick = () => wrap.remove();
    wrap.querySelector('[data-yes]').onclick = async function () {
      const v = KX.ui.formValues(wrap);
      await KX.repo.insert('reviews', {
        order_id: order.id, customer_id: order.customer_id,
        supplier_id: order.supplier_id, transporter_id: order.transporter_id,
        supplier_rating: Number(v.s), transporter_rating: Number(v.t), comment: v.comment
      });
      wrap.remove(); U().toast('شكرًا لتقييمك', 'success');
    };
  }

  /* ---------------- مواقع المشاريع ---------------- */
  async function sites() {
    const cid = S().customer_id;
    const [rows, zones] = await Promise.all([
      KX.repo.list('locations', { where: { customer_id: cid } }),
      KX.repo.list('delivery_zones', { where: { is_active: true } })
    ]);
    const zName = {}; zones.forEach((z) => { zName[z.id] = z.name; });

    L().renderApp(
      KX.ui.table([
        { key: 'label', label: 'الموقع', render: (r) => '<b>' + e(r.label) + '</b>' +
          (r.is_default ? ' ' + KX.ui.badge('افتراضي', 'ok') : '') },
        { key: 'zone_id', label: 'منطقة التوصيل', render: (r) => e(zName[r.zone_id] || '—') },
        { key: 'address', label: 'العنوان' },
        { key: 'coords', label: 'الإحداثيات', render: (r) => r.coords ?
          '<a target="_blank" href="https://maps.google.com/?q=' + r.coords.lat + ',' + r.coords.lng + '">' +
          r.coords.lat.toFixed(4) + ', ' + r.coords.lng.toFixed(4) + '</a>' : '—' },
        { key: 'contact_phone', label: 'مسؤول الموقع', render: (r) => e(r.contact_name || '') + '<br>' +
          '<small class="mono">' + e(U().fmtPhone(r.contact_phone)) + '</small>' },
        { key: 'a', label: '', render: (r) => '<button class="btn btn--ghost btn--sm" data-del="' + r.id + '">حذف</button>' }
      ], rows, { emptyText: 'لم تضف أي موقع بعد' }) +
      '<div class="mt">' + KX.ui.card('إضافة موقع مشروع',
        '<form id="site-form">' +
        '<div class="field-row">' +
          KX.ui.field({ name: 'label', label: 'اسم الموقع', required: true, placeholder: 'مثال: مشروع فيلات العقر' }) +
          KX.ui.field({ name: 'zone_id', label: 'منطقة التوصيل', type: 'select', required: true,
            placeholder: 'اختر المنطقة', options: zones.map((z) => ({ value: z.id, label: z.name })) }) +
        '</div>' +
        KX.ui.field({ name: 'address', label: 'العنوان التفصيلي', required: true }) +
        '<div class="field-row">' +
          KX.ui.field({ name: 'lat', label: 'خط العرض (Latitude)', placeholder: '23.2257', hint: 'من خرائط جوجل' }) +
          KX.ui.field({ name: 'lng', label: 'خط الطول (Longitude)', placeholder: '56.5158' }) +
        '</div>' +
        '<div class="map-pick mb" id="geo-btn">📍 اضغط لاستخدام موقعي الحالي من الجهاز</div>' +
        '<div class="field-row">' +
          KX.ui.field({ name: 'contact_name', label: 'مسؤول الموقع' }) +
          KX.ui.field({ name: 'contact_phone', label: 'هاتف المسؤول', inputmode: 'tel' }) +
        '</div>' +
        '<label class="checkbox mb"><input type="checkbox" name="is_default"> اجعله الموقع الافتراضي</label>' +
        '<button class="btn btn--primary" type="submit">حفظ الموقع</button></form>') + '</div>',
      { title: 'مواقع المشاريع', subtitle: 'احفظ مواقعك لتسريع الطلبات القادمة', counts: await counts() });

    document.getElementById('geo-btn').onclick = function () {
      if (!navigator.geolocation) { U().toast('المتصفح لا يدعم تحديد الموقع', 'error'); return; }
      navigator.geolocation.getCurrentPosition(function (p) {
        document.querySelector('[name=lat]').value = p.coords.latitude.toFixed(6);
        document.querySelector('[name=lng]').value = p.coords.longitude.toFixed(6);
        document.getElementById('geo-btn').classList.add('has-value');
        document.getElementById('geo-btn').textContent = '✅ تم تحديد موقعك الحالي';
      }, () => U().toast('تعذّر تحديد الموقع — أدخل الإحداثيات يدويًا', 'error'));
    };
    document.getElementById('site-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      const errs = U().validate(v, {
        label: { required: true, minLength: 3 }, zone_id: { required: true }, address: { required: true }
      });
      if (Object.keys(errs).length) { U().toast(Object.values(errs)[0], 'error'); return; }
      if (v.lat && !U().isValidCoords(v.lat, v.lng)) { U().toast('إحداثيات غير صحيحة', 'error'); return; }
      if (v.is_default) for (const r of rows) if (r.is_default) await KX.repo.update('locations', r.id, { is_default: false });
      await KX.repo.insert('locations', {
        customer_id: cid, label: v.label, zone_id: v.zone_id, address: v.address,
        coords: v.lat ? { lat: Number(v.lat), lng: Number(v.lng) } : null,
        contact_name: v.contact_name, contact_phone: U().normalizePhone(v.contact_phone),
        is_default: !!v.is_default
      });
      U().toast('حُفظ الموقع', 'success'); KX.router.resolve();
    };
    U().on(document, 'click', '[data-del]', async function (ev, el) {
      const ok = await U().confirmDialog({ title: 'حذف الموقع', message: 'سيُخفى الموقع ولن يُحذف من الطلبات السابقة.', danger: true });
      if (!ok) return;
      await KX.repo.softDelete('locations', el.dataset.del);
      U().toast('حُذف الموقع'); KX.router.resolve();
    });
  }

  /* ---------------- الفواتير ---------------- */
  async function invoices() {
    const rows = await KX.repo.list('invoices', { where: { customer_id: S().customer_id },
                                                  order: { field: 'issue_date', dir: 'desc' } });
    L().renderApp(KX.ui.table([
      { key: 'invoice_no', label: 'رقم الفاتورة', render: (r) => '<b>' + e(r.invoice_no) + '</b>' },
      { key: 'order_no', label: 'الطلب' },
      { key: 'issue_date', label: 'التاريخ', render: (r) => U().fmtDate(r.issue_date) },
      { key: 'total', label: 'الإجمالي', num: true, render: (r) => U().fmtOMR(r.total) },
      { key: 'a', label: '', render: (r) => '<a href="#/customer/invoices/' + r.id + '" class="btn btn--ghost btn--sm">عرض</a>' }
    ], rows, { emptyText: 'لا توجد فواتير بعد' }),
      { title: 'الفواتير', counts: await counts() });
  }

  async function invoiceDetail(ctx) {
    const inv = await KX.repo.get('invoices', ctx.params.id);
    if (!inv || inv.customer_id !== S().customer_id) {
      L().renderApp(KX.ui.alert('الفاتورة غير موجودة', 'danger'), { title: 'الفاتورة' }); return;
    }
    const [order, company, profile] = await Promise.all([
      KX.repo.get('orders', inv.order_id), KX.repo.setting('company', {}),
      KX.repo.get('customer_profiles', inv.customer_id)
    ]);
    const line = (k, v, b) => '<div class="row row--between" style="padding:6px 0">' +
      '<span class="' + (b ? '' : 'muted') + '">' + e(k) + '</span><b>' + e(v) + '</b></div>';

    L().renderApp('<div class="card card--pad-lg">' +
      '<div class="row row--between mb">' +
        '<div><h2 style="margin:0">' + e(company.legal_name || KX.config.brand.name) + '</h2>' +
        '<small class="muted">' + e(company.address || '') + '<br>الرقم الضريبي: ' + e(company.vat_number || '—') + '</small></div>' +
        '<div style="text-align:end"><h3 style="margin:0">فاتورة ضريبية</h3>' +
        '<small class="mono">' + e(inv.invoice_no) + '</small><br>' +
        '<small>' + U().fmtDate(inv.issue_date) + '</small></div>' +
      '</div><hr class="divider">' +
      '<div class="grid grid-2 mb">' +
        '<div><h4>العميل</h4>' + e(profile ? profile.name : '') + '<br>' +
          (profile && profile.company_name ? e(profile.company_name) + '<br>' : '') +
          '<span class="mono">' + e(U().fmtPhone(profile ? profile.phone : '')) + '</span></div>' +
        '<div><h4>الطلب</h4>' + e(inv.order_no) + '<br>' +
          (order ? U().fmtNum(order.tons, 1) + ' طن • ' + order.trips_planned + ' رحلة' : '') + '</div>' +
      '</div>' +
      '<div class="panel">' +
        line('قيمة المواد', U().fmtOMR(inv.material_cost)) +
        line('تكلفة النقل', U().fmtOMR(inv.transport_cost)) +
        line('رسوم المنصة', U().fmtOMR(inv.platform_fee)) +
        (Number(inv.waiting_fees) ? line('رسوم انتظار', U().fmtOMR(inv.waiting_fees)) : '') +
        (Number(inv.discount) ? line('الخصم', '− ' + U().fmtOMR(inv.discount)) : '') +
        line('ضريبة القيمة المضافة', U().fmtOMR(inv.vat)) +
        '<hr class="divider">' +
        line('الإجمالي المستحق', U().fmtOMR(inv.total), true) +
        line('المدفوع', U().fmtOMR(inv.amount_paid), true) +
      '</div>' +
      '<div class="btn-group mt">' +
        '<button class="btn btn--navy" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>' +
        '<button class="btn btn--ghost" id="csv">⬇️ تنزيل CSV</button>' +
        '<a href="#/customer/orders/' + inv.order_id + '" class="btn btn--ghost">عرض الطلب</a>' +
      '</div></div>', { title: 'الفاتورة ' + inv.invoice_no, counts: await counts() });

    document.getElementById('csv').onclick = function () {
      U().download(inv.invoice_no + '.csv', U().toCSV([inv]), 'text/csv');
    };
  }

  /* ---------------- الملف الشخصي ---------------- */
  async function profile() {
    const p = await KX.repo.get('customer_profiles', S().customer_id);
    const user = await KX.repo.get('users', S().user_id);
    L().renderApp('<div class="grid grid-2">' +
      KX.ui.card('بياناتي',
        '<form id="p-form">' +
        KX.ui.field({ name: 'name', label: 'الاسم', value: p.name, required: true }) +
        KX.ui.field({ name: 'phone', label: 'رقم الهاتف', value: U().fmtPhone(p.phone), disabled: true }) +
        KX.ui.field({ name: 'email', label: 'البريد الإلكتروني', value: user.email || '', type: 'email' }) +
        KX.ui.field({ name: 'customer_type', label: 'نوع الحساب', type: 'select', value: p.customer_type,
          options: Object.keys(KX.schema.CUSTOMER_TYPES).map((k) => ({ value: k, label: KX.schema.CUSTOMER_TYPES[k] })) }) +
        KX.ui.field({ name: 'company_name', label: 'اسم الشركة', value: p.company_name || '' }) +
        '<div class="field-row">' +
          KX.ui.field({ name: 'cr_number', label: 'السجل التجاري', value: p.cr_number || '' }) +
          KX.ui.field({ name: 'vat_number', label: 'الرقم الضريبي', value: p.vat_number || '' }) +
        '</div>' +
        '<button class="btn btn--primary" type="submit">حفظ التعديلات</button></form>') +
      KX.ui.card('ملخص الحساب',
        row('نوع الحساب', KX.schema.CUSTOMER_TYPES[p.customer_type]) +
        row('عدد الطلبات المستلمة', p.total_orders || 0) +
        row('إجمالي المصروف', U().fmtOMR(p.total_spent || 0)) +
        row('الشراء الآجل', p.credit_approved ? 'معتمد' : 'غير معتمد') +
        (p.credit_approved ? row('الحد الائتماني', U().fmtOMR(p.credit_limit)) +
                             row('المستخدم من الحد', U().fmtOMR(p.credit_used)) : '') +
        '<hr class="divider"><button class="btn btn--ghost btn--sm" id="export-me">⬇️ تصدير بياناتي</button>') +
      '</div>', { title: 'الملف الشخصي', counts: await counts() });

    document.getElementById('p-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      await KX.repo.update('customer_profiles', p.id, {
        name: v.name, customer_type: v.customer_type, company_name: v.company_name,
        cr_number: v.cr_number, vat_number: v.vat_number
      });
      await KX.repo.update('users', user.id, { name: v.name, email: v.email });
      await KX.audit.log('profile.update', 'customer_profiles', p.id, {});
      await KX.auth.refreshSession();
      U().toast('حُفظت بياناتك', 'success'); KX.router.resolve();
    };
    document.getElementById('export-me').onclick = async function () {
      const orders = await KX.orders.forCustomer(p.id);
      U().download('my-data.csv', U().toCSV(orders.map((o) => ({
        order_no: o.order_no, status: o.status, tons: o.tons, total: o.total, date: o.created_at
      }))), 'text/csv');
    };
  }

  /* ---------------- الشكاوى والتقييمات ---------------- */
  async function complaints() {
    const cid = S().customer_id;
    const [rows, orders, reviews] = await Promise.all([
      KX.repo.list('complaints', { where: { customer_id: cid }, order: { field: 'created_at', dir: 'desc' } }),
      KX.orders.forCustomer(cid),
      KX.repo.list('reviews', { where: { customer_id: cid } })
    ]);
    L().renderApp(
      KX.ui.card('تقديم شكوى',
        '<form id="c-form">' +
        KX.ui.field({ name: 'order_id', label: 'الطلب المعني', type: 'select', placeholder: 'شكوى عامة',
          options: orders.map((o) => ({ value: o.id, label: o.order_no + ' — ' + KX.orders.label(o.status) })) }) +
        KX.ui.field({ name: 'subject', label: 'نوع الشكوى', type: 'select', required: true, options: [
          { value: 'quantity', label: 'نقص في الكمية' },
          { value: 'quality', label: 'جودة المادة' },
          { value: 'delay', label: 'تأخير في التوصيل' },
          { value: 'driver', label: 'سلوك السائق' },
          { value: 'billing', label: 'مشكلة في الفاتورة أو الدفع' },
          { value: 'refund', label: 'طلب استرداد' },
          { value: 'other', label: 'أخرى' }]}) +
        KX.ui.field({ name: 'message', label: 'تفاصيل الشكوى', type: 'textarea', rows: 4, required: true }) +
        '<button class="btn btn--primary" type="submit">إرسال الشكوى</button></form>') +
      '<div class="mt">' + KX.ui.card('شكاواي', KX.ui.table([
        { key: 'created_at', label: 'التاريخ', render: (r) => U().fmtDate(r.created_at) },
        { key: 'subject', label: 'النوع' },
        { key: 'message', label: 'التفاصيل', render: (r) => e(String(r.message).slice(0, 80)) },
        { key: 'status', label: 'الحالة', render: (r) => KX.ui.badge(
            r.status === 'open' ? 'مفتوحة' : r.status === 'resolved' ? 'مغلقة' : 'قيد المعالجة',
            r.status === 'resolved' ? 'ok' : 'warn') },
        { key: 'resolution', label: 'الرد', render: (r) => e(r.resolution || '—') }
      ], rows, { emptyText: 'لا توجد شكاوى' })) + '</div>' +
      '<div class="mt">' + KX.ui.card('تقييماتي', KX.ui.table([
        { key: 'created_at', label: 'التاريخ', render: (r) => U().fmtDate(r.created_at) },
        { key: 'supplier_rating', label: 'المورد', render: (r) => '★'.repeat(r.supplier_rating) },
        { key: 'transporter_rating', label: 'الناقل', render: (r) => '★'.repeat(r.transporter_rating) },
        { key: 'comment', label: 'الملاحظة' }
      ], reviews, { emptyText: 'لم تقيّم أي طلب بعد' })) + '</div>',
      { title: 'الشكاوى والتقييمات', counts: await counts() });

    document.getElementById('c-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      if (!v.message || v.message.length < 10) { U().toast('اكتب تفاصيل الشكوى (10 أحرف على الأقل)', 'error'); return; }
      await KX.repo.insert('complaints', {
        customer_id: cid, order_id: v.order_id || null, subject: v.subject,
        message: v.message, status: 'open', source: 'customer_portal',
        name: S().name, phone: S().phone
      });
      await KX.audit.log('complaint.create', 'complaints', null, { subject: v.subject });
      U().toast('استلمنا شكواك وسنعالجها', 'success'); KX.router.resolve();
    };
  }

  return { dashboard, newOrder, ordersList, orderDetail, sites, invoices, invoiceDetail, profile, complaints };
})();
