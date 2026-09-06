/* مكوّنات واجهة قابلة لإعادة الاستخدام — كلها ترجع HTML نصيًا */
window.KX = window.KX || {};
KX.ui = (function () {
  const U = () => KX.util;
  const e = (s) => KX.util.esc(s);

  const badge = (text, tone) => '<span class="badge badge--' + (tone || 'muted') + '">' + e(text) + '</span>';
  const statusBadge = (s) => badge(KX.orders.label(s), KX.orders.tone(s));
  const money = (n) => '<span class="mono">' + e(U().fmtOMR(n)) + '</span>';

  function kpi(o) {
    const d = o.delta;
    return '<div class="kpi ' + (o.accent ? 'kpi--accent' : '') + '">' +
      '<div class="kpi__label">' + e(o.label) + '</div>' +
      '<div class="kpi__value">' + e(o.value) + '</div>' +
      (o.sub ? '<div class="kpi__sub">' + e(o.sub) + '</div>' : '') +
      (d === null
        ? '<div class="kpi__sub">لا توجد فترة سابقة للمقارنة</div>'
        : d !== undefined
          ? '<div class="kpi__delta kpi__delta--' + (d >= 0 ? 'up' : 'down') + '">' +
            (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(1) + '% مقارنة بالفترة السابقة</div>'
          : '') +
      '</div>';
  }

  function table(cols, rows, opts) {
    opts = opts || {};
    if (!rows.length) return empty(opts.emptyText || 'لا توجد بيانات لعرضها', opts.emptyIcon);
    const head = cols.map((c) => '<th class="' + (c.num ? 'num' : '') + '">' + e(c.label) + '</th>').join('');
    const body = rows.map(function (r, i) {
      const tds = cols.map(function (c) {
        const v = typeof c.render === 'function' ? c.render(r, i) : e(r[c.key]);
        return '<td class="' + (c.num ? 'num' : '') + '">' + v + '</td>';
      }).join('');
      return '<tr' + (opts.rowAttrs ? ' ' + opts.rowAttrs(r) : '') + '>' + tds + '</tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table ' + (opts.compact ? 'table--compact' : '') + '">' +
           '<thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  const empty = (text, icon) =>
    '<div class="empty"><div class="empty__icon">' + (icon || '📭') + '</div><div>' + e(text) + '</div></div>';

  const card = (title, body, actions) =>
    '<div class="card">' +
      (title ? '<div class="card__head"><h3 class="card__title">' + e(title) + '</h3>' +
               (actions ? '<div class="btn-group">' + actions + '</div>' : '') + '</div>' : '') +
      body + '</div>';

  const alert = (text, kind, icon) =>
    '<div class="alert alert--' + (kind || 'info') + '"><span>' + (icon || 'ℹ️') + '</span><div>' + text + '</div></div>';

  function field(o) {
    const id = o.id || o.name;
    const err = o.error ? '<span class="field__err">' + e(o.error) + '</span>' : '';
    const hint = o.hint ? '<span class="field__hint">' + e(o.hint) + '</span>' : '';
    let input;
    if (o.type === 'select') {
      input = '<select id="' + e(id) + '" name="' + e(o.name) + '"' + (o.disabled ? ' disabled' : '') + '>' +
        (o.placeholder ? '<option value="">' + e(o.placeholder) + '</option>' : '') +
        (o.options || []).map((op) =>
          '<option value="' + e(op.value) + '"' + (String(op.value) === String(o.value) ? ' selected' : '') + '>' +
          e(op.label) + '</option>').join('') + '</select>';
    } else if (o.type === 'textarea') {
      input = '<textarea id="' + e(id) + '" name="' + e(o.name) + '" rows="' + (o.rows || 3) + '" placeholder="' +
        e(o.placeholder || '') + '">' + e(o.value || '') + '</textarea>';
    } else {
      input = '<input id="' + e(id) + '" name="' + e(o.name) + '" type="' + (o.type || 'text') + '" ' +
        'value="' + e(o.value === undefined || o.value === null ? '' : o.value) + '" ' +
        'placeholder="' + e(o.placeholder || '') + '"' +
        (o.step ? ' step="' + e(o.step) + '"' : '') + (o.min !== undefined ? ' min="' + e(o.min) + '"' : '') +
        (o.max !== undefined ? ' max="' + e(o.max) + '"' : '') +
        (o.disabled ? ' disabled' : '') + (o.inputmode ? ' inputmode="' + e(o.inputmode) + '"' : '') +
        (o.cls ? ' class="' + e(o.cls) + '"' : '') + '>';
    }
    return '<label class="field ' + (o.error ? 'field--error' : '') + '">' +
      '<span>' + e(o.label) + (o.required ? ' <b class="req">*</b>' : '') + '</span>' +
      input + err + hint + '</label>';
  }

  const choice = (o) =>
    '<button type="button" class="choice ' + (o.selected ? 'is-selected' : '') + '" ' +
      'data-choice="' + e(o.group) + '" data-value="' + e(o.value) + '">' +
      '<div class="choice__title">' + e(o.title) + '</div>' +
      (o.meta ? '<div class="choice__meta">' + e(o.meta) + '</div>' : '') +
      (o.price ? '<div class="choice__price">' + e(o.price) + '</div>' : '') + '</button>';

  /* ملخّص السعر التفصيلي — يُعرض للعميل قبل الاعتماد */
  function priceBox(q, opts) {
    opts = opts || {};
    const L = q.lines, Q = q.quantities;
    let h = '<div class="price-box">';
    h += '<div class="line"><span>سعر المادة (' + U().fmtNum(Q.tons, 1) + ' طن × ' +
         U().money(L.unit_price_per_ton) + ')</span><b>' + U().money(L.material_cost) + '</b></div>';
    h += '<div class="line"><span>النقل (' + Q.trips + ' رحلة × ' + U().money(L.transport_per_trip) +
         ')</span><b>' + U().money(L.transport_cost) + '</b></div>';
    h += '<div class="line"><span>رسوم المنصة</span><b>' + U().money(L.platform_fee) + '</b></div>';
    if (L.discount > 0)
      h += '<div class="line line--discount"><span>الخصم' + (L.coupon_code ? ' (' + e(L.coupon_code) + ')' : '') +
           '</span><b>− ' + U().money(L.discount) + '</b></div>';
    if (L.vat > 0)
      h += '<div class="line"><span>ضريبة القيمة المضافة (' + (L.vat_rate * 100).toFixed(0) + '%)</span><b>' +
           U().money(L.vat) + '</b></div>';
    h += '<hr><div class="total"><span>السعر النهائي</span><b>' + U().fmtOMR(q.totals.total) + '</b></div>';
    if (!opts.hideNote)
      h += '<div style="margin-top:10px;font-size:.78rem;color:#9fb5c8">' +
           'السعر شامل التوريد والنقل حتى موقعك. لا يتغيّر بعد الدفع إلا بموافقتك.</div>';
    h += '</div>';
    return h;
  }

  /* شريط تقدّم مراحل الطلب */
  function steps(status) {
    const flow = ['under_review', 'awaiting_supplier', 'awaiting_carrier', 'ready_for_payment',
                  'paid', 'preparing', 'loading', 'in_transit', 'arrived', 'delivered'];
    const cur = flow.indexOf(status);
    return '<div class="steps">' + flow.map(function (s, i) {
      const cls = cur === -1 ? '' : (i < cur ? 'is-done' : i === cur ? 'is-current' : '');
      return '<div class="steps__item ' + cls + '" title="' + e(KX.orders.label(s)) + '"></div>';
    }).join('') + '</div>';
  }

  function timeline(items) {
    return '<ul class="timeline">' + items.map(function (it, i) {
      const cls = it.current ? 'is-current' : (it.done !== false ? 'is-done' : '');
      return '<li class="' + cls + '"><div class="timeline__title">' + e(it.title) + '</div>' +
             '<div class="timeline__meta">' + e(it.meta || '') + '</div></li>';
    }).join('') + '</ul>';
  }

  const loading = (text) =>
    '<div class="empty"><span class="spinner"></span><div style="margin-top:10px">' + e(text || 'جارٍ التحميل…') + '</div></div>';

  /* قراءة قيم نموذج إلى كائن */
  function formValues(formEl) {
    const out = {};
    U().$$('input,select,textarea', formEl).forEach(function (el) {
      if (!el.name) return;
      out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return out;
  }
  /* ربط أزرار الاختيار البطاقي */
  function bindChoices(root, group, onPick) {
    U().on(root, 'click', '[data-choice="' + group + '"]', function (ev, el) {
      U().$$('[data-choice="' + group + '"]', root).forEach((x) => x.classList.remove('is-selected'));
      el.classList.add('is-selected');
      onPick(el.dataset.value, el);
    });
  }

  return { badge, statusBadge, money, kpi, table, empty, card, alert, field, choice,
           priceBox, steps, timeline, loading, formValues, bindChoices };
})();
