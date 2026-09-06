/* لوحة الإدارة — إعداد المواد والأسعار والمناطق والمستخدمين والإعدادات المالية */
window.KX = window.KX || {};
KX.viewsAdminConfig = (function () {
  const e = (s) => KX.util.esc(s);
  const U = () => KX.util;
  const L = () => KX.layout;
  const counts = () => KX.viewsAdmin.counts();

  /* ---------------- المواد والأسعار ---------------- */
  async function materials() {
    const [mats, cats, sups, prices] = await Promise.all([
      KX.repo.list('materials', {}), KX.repo.list('material_categories', {}),
      KX.repo.list('suppliers', {}), KX.repo.list('supplier_prices', {})
    ]);
    const catName = {}; cats.forEach((c) => { catName[c.id] = c.name; });
    const supName = {}; sups.forEach((s) => { supName[s.id] = s.name; });
    const matName = {}; mats.forEach((m) => { matName[m.id] = m.name; });

    L().renderApp(
      KX.ui.alert('لا تُحذف الأسعار المرتبطة بطلبات سابقة — يُوقَف السعر فقط ويبقى في سجل الأسعار. ' +
        'كل طلب يحتفظ بلقطة سعره وقت الإنشاء.', 'info', '🔒') +
      '<div class="grid grid-2">' +
        KX.ui.card('إضافة مادة', '<form id="m-form">' +
          KX.ui.field({ name: 'name', label: 'اسم المادة', required: true }) +
          '<div class="field-row">' +
            KX.ui.field({ name: 'code', label: 'الرمز', required: true, placeholder: 'AGG20' }) +
            KX.ui.field({ name: 'category_id', label: 'الفئة', type: 'select', required: true,
              placeholder: 'اختر', options: cats.map((c) => ({ value: c.id, label: c.name })) }) +
          '</div>' +
          KX.ui.field({ name: 'description', label: 'الوصف' }) +
          '<div class="field-row">' +
            KX.ui.field({ name: 'unit', label: 'وحدة القياس', type: 'select',
              options: Object.keys(KX.schema.UNITS).map((k) => ({ value: k, label: KX.schema.UNITS[k] })) }) +
            KX.ui.field({ name: 'density', label: 'الكثافة (طن/م³)', type: 'number', step: '0.01', value: '1.6',
              hint: 'للتحويل التقريبي بين المتر المكعب والطن في التقارير' }) +
          '</div>' +
          '<button class="btn btn--primary" type="submit">إضافة المادة</button></form>') +
        KX.ui.card('إضافة سعر لمورد', '<form id="p-form">' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'supplier_id', label: 'المورد', type: 'select', required: true,
              placeholder: 'اختر', options: sups.map((s) => ({ value: s.id, label: s.name })) }) +
            KX.ui.field({ name: 'material_id', label: 'المادة', type: 'select', required: true,
              placeholder: 'اختر', options: mats.map((m) => ({ value: m.id, label: m.name })) }) +
          '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'price_per_unit', label: 'سعر الوحدة (ر.ع. / م³)', type: 'number', step: '0.001', required: true }) +
            KX.ui.field({ name: 'available_per_day', label: 'المتاح يوميًا (م³)', type: 'number', value: '300' }) +
          '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'min_qty', label: 'الحد الأدنى (م³)', type: 'number', value: '12' }) +
            KX.ui.field({ name: 'max_qty', label: 'الحد الأقصى (م³)', type: 'number', value: '600' }) +
          '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'valid_from', label: 'ساري من', type: 'date' }) +
            KX.ui.field({ name: 'valid_to', label: 'ساري حتى (اختياري)', type: 'date' }) +
          '</div>' +
          '<button class="btn btn--primary" type="submit">حفظ السعر</button></form>') +
      '</div>' +
      '<div class="mt">' + KX.ui.card('قائمة الأسعار السارية', KX.ui.table([
        { key: 's', label: 'المورد', render: (p) => e(supName[p.supplier_id] || '—') },
        { key: 'm', label: 'المادة', render: (p) => e(matName[p.material_id] || '—') },
        { key: 'price_per_unit', label: 'سعر الم³', num: true, render: (p) => '<b>' + U().money(p.price_per_unit) + '</b>' },
        { key: 'tiers', label: 'شرائح الكمية', render: (p) => (p.tiers || []).length
            ? (p.tiers || []).map((t) => '≥' + t.min_qty + ' م³: ' + U().money(t.price_per_unit)).join('<br>')
            : '<span class="muted">—</span>' },
        { key: 'min_qty', label: 'أدنى/أقصى', num: true, render: (p) => p.min_qty + ' / ' + p.max_qty },
        { key: 'available_per_day', label: 'متاح يوميًا', num: true },
        { key: 'c', label: 'عميل خاص', render: (p) => p.customer_id ? KX.ui.badge('سعر تعاقدي', 'orange') : '—' },
        { key: 'valid_from', label: 'من', render: (p) => U().fmtDate(p.valid_from) },
        { key: 'is_active', label: 'الحالة', render: (p) => KX.ui.badge(p.is_active ? 'ساري' : 'موقوف', p.is_active ? 'ok' : 'muted') },
        { key: 'a', label: '', render: (p) => '<button class="btn btn--sm btn--ghost" data-edit-price="' + p.id + '">تعديل</button> ' +
            '<button class="btn btn--sm btn--ghost" data-toggle-price="' + p.id + '">' + (p.is_active ? 'إيقاف' : 'تفعيل') + '</button>' }
      ], prices, { compact: true }),
        '<button class="btn btn--ghost btn--sm" id="exp">⬇️ تصدير CSV</button>' +
        '<button class="btn btn--ghost btn--sm" id="imp">⬆️ استيراد CSV</button>' +
        '<a href="#/admin/price-history" class="btn btn--ghost btn--sm">سجل التغييرات</a>') + '</div>' +
      '<div class="mt">' + KX.ui.card('المواد', KX.ui.table([
        { key: 'code', label: 'الرمز' }, { key: 'name', label: 'المادة' },
        { key: 'c', label: 'الفئة', render: (m) => e(catName[m.category_id] || '—') },
        { key: 'description', label: 'الوصف' },
        { key: 'unit', label: 'الوحدة', render: (m) => KX.schema.UNITS[m.unit] || m.unit },
        { key: 'is_active', label: 'الحالة', render: (m) => KX.ui.badge(m.is_active ? 'مفعّلة' : 'موقوفة', m.is_active ? 'ok' : 'muted') },
        { key: 'a', label: '', render: (m) => '<button class="btn btn--sm btn--ghost" data-toggle-mat="' + m.id + '">' +
            (m.is_active ? 'إيقاف' : 'تفعيل') + '</button>' }
      ], mats, { compact: true })) + '</div>' +
      '<input type="file" id="file" accept=".csv" style="display:none">',
      { title: 'المواد والأسعار', counts: await counts() });

    document.getElementById('m-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      if (!v.name || !v.code || !v.category_id) { U().toast('أكمل الحقول المطلوبة', 'error'); return; }
      await KX.repo.insert('materials', Object.assign(v, { density: Number(v.density), is_active: true }));
      await KX.audit.log('material.create', 'materials', null, { code: v.code });
      U().toast('أُضيفت المادة', 'success'); KX.router.resolve();
    };

    document.getElementById('p-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      const errs = U().validate(v, {
        supplier_id: { required: true }, material_id: { required: true },
        price_per_unit: { required: true, type: 'number', min: 0.001 }
      });
      if (Object.keys(errs).length) { U().toast(Object.values(errs)[0], 'error'); return; }
      await savePrice(null, v);
      U().toast('حُفظ السعر', 'success'); KX.router.resolve();
    };

    U().on(document, 'click', '[data-toggle-price]', async function (ev, el) {
      const p = prices.find((x) => x.id === el.dataset.togglePrice);
      await KX.repo.update('supplier_prices', p.id, { is_active: !p.is_active });
      await logPriceChange(p, { is_active: !p.is_active }, 'toggle');
      U().toast('حُدّثت الحالة'); KX.router.resolve();
    });
    U().on(document, 'click', '[data-toggle-mat]', async function (ev, el) {
      const m = mats.find((x) => x.id === el.dataset.toggleMat);
      await KX.repo.update('materials', m.id, { is_active: !m.is_active });
      await KX.audit.log('material.toggle', 'materials', m.id, { is_active: !m.is_active });
      KX.router.resolve();
    });
    U().on(document, 'click', '[data-edit-price]', function (ev, el) {
      editPriceDialog(prices.find((x) => x.id === el.dataset.editPrice), matName, supName);
    });

    document.getElementById('exp').onclick = function () {
      U().download('prices.csv', U().toCSV(prices.map((p) => ({
        supplier: supName[p.supplier_id], material: matName[p.material_id],
        price_per_unit: p.price_per_unit, min_qty: p.min_qty, max_qty: p.max_qty,
        available_per_day: p.available_per_day, valid_from: p.valid_from, is_active: p.is_active
      }))), 'text/csv');
    };
    document.getElementById('imp').onclick = () => document.getElementById('file').click();
    document.getElementById('file').onchange = async function (ev) {
      const f = ev.target.files[0]; if (!f) return;
      const text = await f.text();
      const rows = U().parseCSV(text);
      let ok = 0, fail = 0;
      for (const r of rows) {
        const sup = sups.find((s) => s.name === r.supplier);
        const mat = mats.find((m) => m.name === r.material || m.code === r.material);
        if (!sup || !mat || !Number(r.price_per_unit)) { fail++; continue; }
        await savePrice(null, {
          supplier_id: sup.id, material_id: mat.id, price_per_unit: r.price_per_unit,
          min_qty: r.min_qty, max_qty: r.max_qty,
          available_per_day: r.available_per_day, valid_from: r.valid_from
        });
        ok++;
      }
      U().toast('استُورد ' + ok + ' سعر' + (fail ? ' — تعذّر ' + fail + ' صف' : ''), fail ? 'error' : 'success');
      KX.router.resolve();
    };
  }

  /* حفظ سعر جديد + تسجيله في سجل الأسعار */
  async function savePrice(id, v) {
    const payload = {
      supplier_id: v.supplier_id, material_id: v.material_id,
      price_per_unit: Number(v.price_per_unit), currency: 'OMR',
      min_qty: Number(v.min_qty || 0), max_qty: Number(v.max_qty || 0),
      available_per_day: Number(v.available_per_day || 0),
      tiers: v.tiers || [],
      valid_from: v.valid_from ? new Date(v.valid_from).toISOString() : U().nowISO(),
      valid_to: v.valid_to ? new Date(v.valid_to).toISOString() : null,
      customer_id: v.customer_id || null, is_active: true
    };
    const before = id ? await KX.repo.get('supplier_prices', id) : null;
    const row = id ? await KX.repo.update('supplier_prices', id, payload)
                   : await KX.repo.insert('supplier_prices', payload);
    await logPriceChange(before, row, id ? 'update' : 'create');
    return row;
  }
  async function logPriceChange(before, after, action) {
    await KX.repo.insert('price_history', {
      price_id: (after && after.id) || (before && before.id),
      supplier_id: (after || before).supplier_id, material_id: (after || before).material_id,
      old_price: before ? before.price_per_unit : null,
      new_price: after ? after.price_per_unit : null,
      action: action, changed_by: (KX.store.get('session') || {}).user_id,
      changed_by_name: (KX.store.get('session') || {}).name, at: U().nowISO()
    });
    await KX.audit.log('price.' + action, 'supplier_prices', (after || before).id,
      { from: before ? before.price_per_unit : null, to: after ? after.price_per_unit : null });
  }

  function editPriceDialog(p, matName, supName) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = '<div class="modal"><h3>تعديل السعر</h3>' +
      '<p class="muted">' + e(supName[p.supplier_id]) + ' — ' + e(matName[p.material_id]) + '</p>' +
      KX.ui.field({ name: 'price_per_unit', label: 'سعر الم³', type: 'number', step: '0.001', value: p.price_per_unit }) +
      '<div class="field-row">' +
        KX.ui.field({ name: 'min_qty', label: 'أدنى كمية', type: 'number', value: p.min_qty }) +
        KX.ui.field({ name: 'max_qty', label: 'أقصى كمية', type: 'number', value: p.max_qty }) +
      '</div>' +
      KX.ui.field({ name: 'available_per_day', label: 'المتاح يوميًا (م³)', type: 'number', value: p.available_per_day }) +
      KX.ui.field({ name: 'tiers_raw', label: 'شرائح الكمية', placeholder: '100:1.950, 300:1.850',
        value: (p.tiers || []).map((t) => t.min_qty + ':' + t.price_per_unit).join(', ') }) +
      KX.ui.alert('تعديل السعر لا يغيّر الطلبات السابقة — لكل طلب لقطة سعر محفوظة.', 'info', 'ℹ️') +
      '<div class="modal__actions"><button class="btn btn--ghost" data-no>إلغاء</button>' +
      '<button class="btn btn--primary" data-yes>حفظ</button></div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('[data-no]').onclick = () => wrap.remove();
    wrap.querySelector('[data-yes]').onclick = async function () {
      const v = KX.ui.formValues(wrap);
      const tiers = String(v.tiers_raw || '').split(',').map((s) => s.trim()).filter(Boolean)
        .map(function (s) { const [q, pr] = s.split(':'); return { min_qty: Number(q), price_per_unit: Number(pr) }; })
        .filter((t) => t.min_qty > 0 && t.price_per_unit > 0);
      await savePrice(p.id, Object.assign({}, p, v, { tiers: tiers,
        valid_from: p.valid_from, valid_to: p.valid_to }));
      wrap.remove(); U().toast('حُدّث السعر', 'success'); KX.router.resolve();
    };
  }

  async function priceHistory() {
    const [rows, mats, sups] = await Promise.all([
      KX.repo.list('price_history', { order: { field: 'at', dir: 'desc' } }),
      KX.repo.mapBy('materials'), KX.repo.mapBy('suppliers')
    ]);
    L().renderApp(KX.ui.table([
      { key: 'at', label: 'الوقت', render: (r) => U().fmtDateTime(r.at) },
      { key: 's', label: 'المورد', render: (r) => e((sups[r.supplier_id] || {}).name || '—') },
      { key: 'm', label: 'المادة', render: (r) => e((mats[r.material_id] || {}).name || '—') },
      { key: 'old_price', label: 'السعر السابق', num: true, render: (r) => r.old_price ? U().money(r.old_price) : '—' },
      { key: 'new_price', label: 'السعر الجديد', num: true, render: (r) => r.new_price ? '<b>' + U().money(r.new_price) + '</b>' : '—' },
      { key: 'action', label: 'العملية' },
      { key: 'changed_by_name', label: 'نفّذه' }
    ], rows, { compact: true, emptyText: 'لا توجد تغييرات مسجّلة' }),
      { title: 'سجل تغييرات الأسعار', counts: await counts() });
  }

  /* ---------------- المناطق وأسعار النقل ---------------- */
  async function zones() {
    const [zs, tts, rates] = await Promise.all([
      KX.repo.list('delivery_zones', {}), KX.repo.list('truck_types', {}),
      KX.repo.list('transport_rates', {})
    ]);
    const zName = {}; zs.forEach((z) => { zName[z.id] = z.name; });
    const tName = {}; tts.forEach((t) => { tName[t.id] = t.name + ' (' + t.capacity_m3 + ' م³)'; });

    L().renderApp(
      '<div class="grid grid-2">' +
        KX.ui.card('إضافة منطقة توصيل', '<form id="z-form">' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'name', label: 'اسم المنطقة', required: true }) +
            KX.ui.field({ name: 'code', label: 'الرمز', required: true }) +
          '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'wilayat', label: 'الولاية', required: true }) +
            KX.ui.field({ name: 'governorate', label: 'المحافظة', value: 'الظاهرة' }) +
          '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'lat', label: 'خط العرض', type: 'number', step: '0.0001' }) +
            KX.ui.field({ name: 'lng', label: 'خط الطول', type: 'number', step: '0.0001' }) +
          '</div>' +
          '<button class="btn btn--primary" type="submit">إضافة المنطقة</button></form>') +
        KX.ui.card('إضافة تعرفة نقل', '<form id="r-form">' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'zone_id', label: 'المنطقة', type: 'select', required: true,
              placeholder: 'اختر', options: zs.map((z) => ({ value: z.id, label: z.name })) }) +
            KX.ui.field({ name: 'truck_type_id', label: 'نوع الشاحنة', type: 'select', required: true,
              placeholder: 'اختر', options: tts.map((t) => ({ value: t.id, label: tName[t.id] })) }) +
          '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'price_per_trip', label: 'سعر الرحلة (ر.ع.)', type: 'number', step: '0.001', required: true }) +
            KX.ui.field({ name: 'price_per_km', label: 'سعر الكيلومتر الإضافي', type: 'number', step: '0.001', value: '0' }) +
          '</div>' +
          '<button class="btn btn--primary" type="submit">حفظ التعرفة</button></form>') +
      '</div>' +
      '<div class="mt">' + KX.ui.card('مناطق التوصيل', KX.ui.table([
        { key: 'code', label: 'الرمز' }, { key: 'name', label: 'المنطقة' },
        { key: 'wilayat', label: 'الولاية' }, { key: 'governorate', label: 'المحافظة' },
        { key: 'radius_km', label: 'نطاق (كم)', num: true },
        { key: 'is_active', label: 'الحالة', render: (z) => KX.ui.badge(z.is_active ? 'مفعّلة' : 'موقوفة', z.is_active ? 'ok' : 'muted') },
        { key: 'a', label: '', render: (z) => '<button class="btn btn--sm btn--ghost" data-toggle-zone="' + z.id + '">' +
            (z.is_active ? 'إيقاف' : 'تفعيل') + '</button>' }
      ], zs, { compact: true })) + '</div>' +
      '<div class="mt">' + KX.ui.card('تعرفة النقل', KX.ui.table([
        { key: 'z', label: 'المنطقة', render: (r) => e(zName[r.zone_id] || '—') },
        { key: 't', label: 'نوع الشاحنة', render: (r) => e(tName[r.truck_type_id] || '—') },
        { key: 'price_per_trip', label: 'سعر الرحلة', num: true, render: (r) => '<b>' + U().money(r.price_per_trip) + '</b>' },
        { key: 'price_per_km', label: 'لكل كم إضافي', num: true, render: (r) => U().money(r.price_per_km) },
        { key: 'is_active', label: 'الحالة', render: (r) => KX.ui.badge(r.is_active ? 'سارية' : 'موقوفة', r.is_active ? 'ok' : 'muted') },
        { key: 'a', label: '', render: (r) => '<button class="btn btn--sm btn--ghost" data-toggle-rate="' + r.id + '">' +
            (r.is_active ? 'إيقاف' : 'تفعيل') + '</button>' }
      ], rates, { compact: true }),
        '<button class="btn btn--ghost btn--sm" id="exp-rates">⬇️ تصدير</button>') + '</div>' +
      '<div class="mt">' + KX.ui.card('أنواع الشاحنات', KX.ui.table([
        { key: 'code', label: 'الرمز' }, { key: 'name', label: 'النوع' },
        { key: 'capacity_m3', label: 'الحمولة', num: true,
          render: (t) => t.capacity_m3 + ' م³ (' + t.capacity_tons + ' طن)' },
        { key: 'axles', label: 'المحاور', num: true }
      ], tts, { compact: true })) + '</div>',
      { title: 'المناطق وأسعار النقل', counts: await counts() });

    document.getElementById('z-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      if (!v.name || !v.code || !v.wilayat) { U().toast('أكمل الحقول المطلوبة', 'error'); return; }
      await KX.repo.insert('delivery_zones', {
        name: v.name, code: v.code, wilayat: v.wilayat, governorate: v.governorate,
        radius_km: 30, center: v.lat ? { lat: Number(v.lat), lng: Number(v.lng) } : null, is_active: true
      });
      await KX.audit.log('zone.create', 'delivery_zones', null, { code: v.code });
      U().toast('أُضيفت المنطقة', 'success'); KX.router.resolve();
    };
    document.getElementById('r-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      if (!v.zone_id || !v.truck_type_id || !Number(v.price_per_trip)) { U().toast('أكمل الحقول المطلوبة', 'error'); return; }
      await KX.repo.insert('transport_rates', {
        zone_id: v.zone_id, truck_type_id: v.truck_type_id, transporter_id: null,
        price_per_trip: Number(v.price_per_trip), price_per_km: Number(v.price_per_km || 0),
        valid_from: U().nowISO(), valid_to: null, is_active: true
      });
      await KX.audit.log('transport_rate.create', 'transport_rates', null, v);
      U().toast('حُفظت التعرفة', 'success'); KX.router.resolve();
    };
    U().on(document, 'click', '[data-toggle-zone]', async function (ev, el) {
      const z = zs.find((x) => x.id === el.dataset.toggleZone);
      await KX.repo.update('delivery_zones', z.id, { is_active: !z.is_active });
      await KX.audit.log('zone.toggle', 'delivery_zones', z.id, {}); KX.router.resolve();
    });
    U().on(document, 'click', '[data-toggle-rate]', async function (ev, el) {
      const r = rates.find((x) => x.id === el.dataset.toggleRate);
      await KX.repo.update('transport_rates', r.id, { is_active: !r.is_active });
      await KX.audit.log('transport_rate.toggle', 'transport_rates', r.id, {}); KX.router.resolve();
    });
    document.getElementById('exp-rates').onclick = function () {
      U().download('transport-rates.csv', U().toCSV(rates.map((r) => ({
        zone: zName[r.zone_id], truck: tName[r.truck_type_id],
        price_per_trip: r.price_per_trip, price_per_km: r.price_per_km, active: r.is_active
      }))), 'text/csv');
    };
  }

  /* ---------------- الكوبونات ---------------- */
  async function coupons() {
    const rows = await KX.repo.list('coupons', { order: { field: 'created_at', dir: 'desc' } });
    L().renderApp(
      KX.ui.card('إضافة كوبون', '<form id="c-form">' +
        '<div class="field-row">' +
          KX.ui.field({ name: 'code', label: 'رمز الكوبون', required: true, placeholder: 'WELCOME10' }) +
          KX.ui.field({ name: 'discount_type', label: 'نوع الخصم', type: 'select',
            options: [{ value: 'percent', label: 'نسبة مئوية %' }, { value: 'fixed', label: 'مبلغ ثابت ر.ع.' }] }) +
        '</div>' +
        '<div class="field-row">' +
          KX.ui.field({ name: 'discount_value', label: 'قيمة الخصم', type: 'number', step: '0.001', required: true }) +
          KX.ui.field({ name: 'max_discount', label: 'حد أقصى للخصم (ر.ع.)', type: 'number', step: '0.001' }) +
        '</div>' +
        '<div class="field-row">' +
          KX.ui.field({ name: 'min_order_value', label: 'أدنى قيمة طلب', type: 'number', step: '0.001', value: '0' }) +
          KX.ui.field({ name: 'max_uses', label: 'عدد مرات الاستخدام', type: 'number', value: '100' }) +
        '</div>' +
        '<div class="field-row">' +
          KX.ui.field({ name: 'valid_from', label: 'من تاريخ', type: 'date' }) +
          KX.ui.field({ name: 'valid_to', label: 'إلى تاريخ', type: 'date' }) +
        '</div>' +
        KX.ui.field({ name: 'description', label: 'الوصف' }) +
        '<button class="btn btn--primary" type="submit">إنشاء الكوبون</button></form>') +
      '<div class="mt">' + KX.ui.card('الكوبونات', KX.ui.table([
        { key: 'code', label: 'الرمز', render: (c) => '<b class="mono">' + e(c.code) + '</b>' },
        { key: 'description', label: 'الوصف' },
        { key: 'd', label: 'الخصم', render: (c) => c.discount_type === 'percent'
            ? c.discount_value + '%' : U().fmtOMR(c.discount_value) },
        { key: 'min_order_value', label: 'أدنى طلب', num: true, render: (c) => U().fmtOMR(c.min_order_value) },
        { key: 'u', label: 'الاستخدام', num: true, render: (c) => (c.used_count || 0) + ' / ' + (c.max_uses || '∞') },
        { key: 'valid_to', label: 'ينتهي', render: (c) => U().fmtDate(c.valid_to) },
        { key: 'is_active', label: 'الحالة', render: (c) => KX.ui.badge(c.is_active ? 'مفعّل' : 'موقوف', c.is_active ? 'ok' : 'muted') },
        { key: 'a', label: '', render: (c) => '<button class="btn btn--sm btn--ghost" data-toggle-cp="' + c.id + '">' +
            (c.is_active ? 'إيقاف' : 'تفعيل') + '</button>' }
      ], rows, { compact: true })) + '</div>',
      { title: 'العروض والكوبونات', counts: await counts() });

    document.getElementById('c-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      if (!v.code || !Number(v.discount_value)) { U().toast('أكمل الرمز وقيمة الخصم', 'error'); return; }
      await KX.repo.insert('coupons', {
        code: v.code.toUpperCase(), description: v.description,
        discount_type: v.discount_type, discount_value: Number(v.discount_value),
        max_discount: Number(v.max_discount || 0) || null,
        min_order_value: Number(v.min_order_value || 0),
        max_uses: Number(v.max_uses || 0) || null, used_count: 0,
        valid_from: v.valid_from ? new Date(v.valid_from).toISOString() : U().nowISO(),
        valid_to: v.valid_to ? new Date(v.valid_to).toISOString() : null,
        customer_id: null, is_active: true
      });
      await KX.audit.log('coupon.create', 'coupons', null, { code: v.code });
      U().toast('أُنشئ الكوبون', 'success'); KX.router.resolve();
    };
    U().on(document, 'click', '[data-toggle-cp]', async function (ev, el) {
      const c = rows.find((x) => x.id === el.dataset.toggleCp);
      await KX.repo.update('coupons', c.id, { is_active: !c.is_active });
      await KX.audit.log('coupon.toggle', 'coupons', c.id, {}); KX.router.resolve();
    });
  }

  /* ---------------- الإعدادات المالية ---------------- */
  async function settings() {
    const fin = await KX.pricing.financeSettings();
    const company = await KX.repo.setting('company', {});
    L().renderApp(
      '<div class="grid grid-2">' +
        KX.ui.card('الرسوم والعمولات والضريبة', '<form id="f-form">' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'platformFeeFixed', label: 'رسوم ثابتة لكل طلب (ر.ع.)', type: 'number', step: '0.001', value: fin.platformFeeFixed }) +
            KX.ui.field({ name: 'platformFeePercent', label: 'نسبة رسوم المنصة (0.02 = 2%)', type: 'number', step: '0.001', value: fin.platformFeePercent }) +
          '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'supplierCommissionPercent', label: 'عمولة المورد', type: 'number', step: '0.001', value: fin.supplierCommissionPercent }) +
            KX.ui.field({ name: 'transporterCommissionPercent', label: 'عمولة الناقل', type: 'number', step: '0.001', value: fin.transporterCommissionPercent }) +
          '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'vatRate', label: 'نسبة ضريبة القيمة المضافة', type: 'number', step: '0.001', value: fin.vatRate }) +
            KX.ui.field({ name: 'vatEnabled', label: 'تفعيل الضريبة', type: 'select', value: String(fin.vatEnabled),
              options: [{ value: 'true', label: 'مفعّلة' }, { value: 'false', label: 'موقوفة' }] }) +
          '</div>' +
          '<div class="field-row">' +
            KX.ui.field({ name: 'waitingFreeMinutes', label: 'انتظار مجاني (دقيقة)', type: 'number', value: fin.waitingFreeMinutes }) +
            KX.ui.field({ name: 'waitingRatePerHour', label: 'رسوم الانتظار/ساعة', type: 'number', step: '0.001', value: fin.waitingRatePerHour }) +
          '</div>' +
          '<button class="btn btn--primary" type="submit">حفظ الإعدادات</button></form>') +
        KX.ui.card('بيانات المنشأة (تظهر في الفواتير)', '<form id="co-form">' +
          KX.ui.field({ name: 'legal_name', label: 'الاسم القانوني', value: company.legal_name || '' }) +
          '<div class="field-row">' +
            KX.ui.field({ name: 'cr_number', label: 'السجل التجاري', value: company.cr_number || '' }) +
            KX.ui.field({ name: 'vat_number', label: 'الرقم الضريبي', value: company.vat_number || '' }) +
          '</div>' +
          KX.ui.field({ name: 'address', label: 'العنوان', value: company.address || '' }) +
          '<div class="field-row">' +
            KX.ui.field({ name: 'bank_name', label: 'البنك', value: company.bank_name || '' }) +
            KX.ui.field({ name: 'iban', label: 'الآيبان', value: company.iban || '' }) +
          '</div>' +
          '<button class="btn btn--primary" type="submit">حفظ</button></form>') +
      '</div>' +
      '<div class="mt">' + KX.ui.card('أدوات النسخة التجريبية',
        KX.ui.alert('إعادة التهيئة تمسح كل البيانات المحلية وتعيد تحميل البيانات التجريبية. ' +
          'لا تستخدمها على بيانات حقيقية.', 'warn', '⚠️') +
        '<div class="btn-group">' +
        '<button class="btn btn--ghost" id="backup">⬇️ نسخة احتياطية (JSON)</button>' +
        '<button class="btn btn--ghost" id="restore">⬆️ استعادة نسخة</button>' +
        '<button class="btn btn--danger" id="reset">♻️ إعادة تهيئة البيانات التجريبية</button>' +
        '</div><input type="file" id="rfile" accept=".json" style="display:none">') + '</div>',
      { title: 'الإعدادات المالية', counts: await counts() });

    document.getElementById('f-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      const next = {
        platformFeeFixed: Number(v.platformFeeFixed),
        platformFeePercent: Number(v.platformFeePercent),
        supplierCommissionPercent: Number(v.supplierCommissionPercent),
        transporterCommissionPercent: Number(v.transporterCommissionPercent),
        vatRate: Number(v.vatRate), vatEnabled: v.vatEnabled === 'true',
        waitingFreeMinutes: Number(v.waitingFreeMinutes),
        waitingRatePerHour: Number(v.waitingRatePerHour)
      };
      await KX.repo.setSetting('finance', Object.assign({}, fin, next));
      await KX.audit.log('settings.finance', 'settings', null, KX.audit.diff(fin, next));
      U().toast('حُفظت الإعدادات — تُطبَّق على الطلبات الجديدة فقط', 'success');
    };
    document.getElementById('co-form').onsubmit = async function (ev) {
      ev.preventDefault();
      await KX.repo.setSetting('company', KX.ui.formValues(ev.target));
      await KX.audit.log('settings.company', 'settings', null, {});
      U().toast('حُفظت بيانات المنشأة', 'success');
    };
    document.getElementById('backup').onclick = async function () {
      const dump = {};
      for (const t of Object.keys(KX.schema.TABLES)) dump[t] = await KX.repo.list(t, { includeDeleted: true });
      U().download('kassara-backup-' + new Date().toISOString().slice(0, 10) + '.json',
        JSON.stringify(dump, null, 2), 'application/json');
      await KX.audit.log('backup.export', 'settings', null, {});
    };
    document.getElementById('restore').onclick = () => document.getElementById('rfile').click();
    document.getElementById('rfile').onchange = async function (ev) {
      const f = ev.target.files[0]; if (!f) return;
      const ok = await U().confirmDialog({ title: 'استعادة نسخة', danger: true,
        message: 'ستُستبدل كل البيانات الحالية بمحتوى الملف.' });
      if (!ok) return;
      const data = JSON.parse(await f.text());
      KX.repo.reset();
      for (const t of Object.keys(data)) if (KX.schema.TABLES[t]) KX.driverLocal.write(t, data[t]);
      U().toast('استُعيدت النسخة', 'success'); location.reload();
    };
    document.getElementById('reset').onclick = async function () {
      const ok = await U().confirmDialog({ title: 'إعادة التهيئة', danger: true,
        confirmText: 'نعم، أعد التهيئة', message: 'ستُحذف كل البيانات المحلية وتُستبدل بالبيانات التجريبية.' });
      if (!ok) return;
      await KX.seed.run(true);
      KX.auth.logout(); U().toast('أُعيدت التهيئة'); location.hash = '/'; location.reload();
    };
  }

  /* ---------------- إدارة المستخدمين ---------------- */
  async function customers() {
    const [rows, orders] = await Promise.all([
      KX.repo.list('customer_profiles', {}), KX.repo.list('orders', {})
    ]);
    const users = await KX.repo.mapBy('users');
    L().renderApp(KX.ui.table([
      { key: 'name', label: 'العميل', render: (c) => '<b>' + e(c.name) + '</b>' +
          (c.company_name ? '<br><small class="muted">' + e(c.company_name) + '</small>' : '') },
      { key: 'phone', label: 'الهاتف', render: (c) => '<span class="mono">' + e(U().fmtPhone(c.phone)) + '</span>' },
      { key: 'customer_type', label: 'النوع', render: (c) => KX.ui.badge(KX.schema.CUSTOMER_TYPES[c.customer_type]) },
      { key: 'o', label: 'الطلبات', num: true, render: (c) => orders.filter((o) => o.customer_id === c.id).length },
      { key: 'total_spent', label: 'إجمالي المصروف', num: true, render: (c) => U().fmtOMR(c.total_spent || 0) },
      { key: 'credit', label: 'الشراء الآجل', render: (c) => c.credit_approved
          ? KX.ui.badge(U().fmtOMR(c.credit_used) + ' / ' + U().fmtOMR(c.credit_limit), 'ok')
          : '<span class="muted">غير معتمد</span>' },
      { key: 'st', label: 'الحساب', render: (c) => KX.ui.badge(
          (users[c.user_id] || {}).account_status === 'active' ? 'مفعّل' : 'موقوف',
          (users[c.user_id] || {}).account_status === 'active' ? 'ok' : 'danger') },
      { key: 'a', label: '', render: (c) => '<button class="btn btn--sm btn--ghost" data-credit="' + c.id + '">حد ائتماني</button> ' +
          '<button class="btn btn--sm btn--ghost" data-suspend="' + c.user_id + '">إيقاف/تفعيل</button>' }
    ], rows, { compact: true }), { title: 'العملاء', counts: await counts() });

    U().on(document, 'click', '[data-credit]', function (ev, el) {
      const c = rows.find((x) => x.id === el.dataset.credit);
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = '<div class="modal"><h3>الحد الائتماني — ' + e(c.name) + '</h3>' +
        KX.ui.field({ name: 'credit_approved', label: 'الشراء الآجل', type: 'select', value: String(!!c.credit_approved),
          options: [{ value: 'false', label: 'غير معتمد' }, { value: 'true', label: 'معتمد' }] }) +
        KX.ui.field({ name: 'credit_limit', label: 'الحد الائتماني (ر.ع.)', type: 'number', step: '0.001', value: c.credit_limit || 0 }) +
        '<div class="modal__actions"><button class="btn btn--ghost" data-no>إلغاء</button>' +
        '<button class="btn btn--primary" data-yes>حفظ</button></div></div>';
      document.body.appendChild(wrap);
      wrap.querySelector('[data-no]').onclick = () => wrap.remove();
      wrap.querySelector('[data-yes]').onclick = async function () {
        const v = KX.ui.formValues(wrap);
        await KX.repo.update('customer_profiles', c.id, {
          credit_approved: v.credit_approved === 'true', credit_limit: Number(v.credit_limit)
        });
        await KX.audit.log('customer.credit', 'customer_profiles', c.id, v);
        wrap.remove(); U().toast('حُدّث الحد الائتماني', 'success'); KX.router.resolve();
      };
    });
    U().on(document, 'click', '[data-suspend]', async function (ev, el) {
      const u = users[el.dataset.suspend];
      const next = u.account_status === 'active' ? 'suspended' : 'active';
      const ok = await U().confirmDialog({ title: next === 'suspended' ? 'إيقاف الحساب' : 'تفعيل الحساب',
        danger: next === 'suspended', message: 'المستخدم: ' + u.name });
      if (!ok) return;
      await KX.repo.update('users', u.id, { account_status: next });
      await KX.audit.log('user.status', 'users', u.id, { to: next });
      U().toast('حُدّث الحساب'); KX.router.resolve();
    });
  }

  async function suppliersAdmin() {
    const [rows, prices, orders] = await Promise.all([
      KX.repo.list('suppliers', {}), KX.repo.list('supplier_prices', {}), KX.repo.list('orders', {})
    ]);
    L().renderApp(KX.ui.table([
      { key: 'name', label: 'المورد', render: (s) => '<b>' + e(s.name) + '</b><br><small class="muted">' + e(s.address || '') + '</small>' },
      { key: 'wilayat', label: 'الولاية' },
      { key: 'phone', label: 'الهاتف', render: (s) => '<span class="mono">' + e(U().fmtPhone(s.phone)) + '</span>' },
      { key: 'p', label: 'أسعار مسجّلة', num: true, render: (s) => prices.filter((p) => p.supplier_id === s.id).length },
      { key: 'o', label: 'الطلبات', num: true, render: (s) => orders.filter((o) => o.supplier_id === s.id).length },
      { key: 'loading_capacity_per_day', label: 'طاقة التحميل/يوم', num: true },
      { key: 'rating', label: 'التقييم', num: true, render: (s) => '⭐ ' + s.rating },
      { key: 'is_approved', label: 'الاعتماد', render: (s) => KX.ui.badge(s.is_approved ? 'معتمد' : 'بانتظار الاعتماد', s.is_approved ? 'ok' : 'warn') },
      { key: 'a', label: '', render: (s) => '<button class="btn btn--sm btn--ghost" data-approve-sup="' + s.id + '">' +
          (s.is_approved ? 'سحب الاعتماد' : 'اعتماد') + '</button>' }
    ], rows, { compact: true }), { title: 'الموردون', counts: await counts() });

    U().on(document, 'click', '[data-approve-sup]', async function (ev, el) {
      const s = rows.find((x) => x.id === el.dataset.approveSup);
      await KX.repo.update('suppliers', s.id, { is_approved: !s.is_approved });
      await KX.audit.log('supplier.approve', 'suppliers', s.id, { to: !s.is_approved });
      U().toast('حُدّث الاعتماد'); KX.router.resolve();
    });
  }

  async function transportersAdmin() {
    const [rows, trucks, drivers, trips] = await Promise.all([
      KX.repo.list('transport_companies', {}), KX.repo.list('trucks', {}),
      KX.repo.list('drivers', {}), KX.repo.list('trips', {})
    ]);
    L().renderApp(
      KX.ui.card('شركات النقل', KX.ui.table([
        { key: 'name', label: 'الشركة', render: (c) => '<b>' + e(c.name) + '</b>' },
        { key: 'phone', label: 'الهاتف', render: (c) => '<span class="mono">' + e(U().fmtPhone(c.phone)) + '</span>' },
        { key: 't', label: 'الشاحنات', num: true, render: (c) => trucks.filter((t) => t.transporter_id === c.id).length },
        { key: 'd', label: 'السائقون', num: true, render: (c) => drivers.filter((d) => d.transporter_id === c.id).length },
        { key: 'tr', label: 'الرحلات', num: true, render: (c) => trips.filter((t) => t.transporter_id === c.id).length },
        { key: 'rating', label: 'التقييم', num: true, render: (c) => '⭐ ' + c.rating },
        { key: 'is_approved', label: 'الاعتماد', render: (c) => KX.ui.badge(c.is_approved ? 'معتمد' : 'بانتظار', c.is_approved ? 'ok' : 'warn') },
        { key: 'a', label: '', render: (c) => '<button class="btn btn--sm btn--ghost" data-approve-car="' + c.id + '">' +
            (c.is_approved ? 'سحب الاعتماد' : 'اعتماد') + '</button>' }
      ], rows, { compact: true })) +
      '<div class="mt">' + KX.ui.card('الشاحنات', KX.ui.table([
        { key: 'plate_no', label: 'اللوحة', render: (t) => '<b class="mono">' + e(t.plate_no) + '</b>' },
        { key: 'c', label: 'الشركة', render: (t) => e((rows.find((r) => r.id === t.transporter_id) || {}).name || '—') },
        { key: 'make', label: 'الطراز' }, { key: 'year', label: 'السنة', num: true },
        { key: 'capacity_m3', label: 'الحمولة', num: true,
          render: (t) => t.capacity_m3 + ' م³ (' + t.capacity_tons + ' طن)' },
        { key: 'is_available', label: 'التوفّر', render: (t) => KX.ui.badge(t.is_available ? 'متاحة' : 'غير متاحة', t.is_available ? 'ok' : 'muted') }
      ], trucks, { compact: true })) + '</div>' +
      '<div class="mt">' + KX.ui.card('السائقون', KX.ui.table([
        { key: 'name', label: 'السائق' },
        { key: 'phone', label: 'الهاتف', render: (d) => '<span class="mono">' + e(U().fmtPhone(d.phone)) + '</span>' },
        { key: 'c', label: 'الشركة', render: (d) => e((rows.find((r) => r.id === d.transporter_id) || {}).name || '—') },
        { key: 'license_no', label: 'رقم الرخصة' },
        { key: 'license_expiry', label: 'انتهاء الرخصة', render: (d) => {
            const exp = new Date(d.license_expiry) < new Date();
            return (exp ? '<b style="color:var(--danger-600)">' : '') + U().fmtDate(d.license_expiry) + (exp ? ' ⚠️</b>' : ''); } },
        { key: 'tr', label: 'الرحلات', num: true, render: (d) => trips.filter((t) => t.driver_id === d.id).length }
      ], drivers, { compact: true })) + '</div>',
      { title: 'الناقلون والأسطول', counts: await counts() });

    U().on(document, 'click', '[data-approve-car]', async function (ev, el) {
      const c = rows.find((x) => x.id === el.dataset.approveCar);
      await KX.repo.update('transport_companies', c.id, { is_approved: !c.is_approved });
      await KX.audit.log('transporter.approve', 'transport_companies', c.id, { to: !c.is_approved });
      U().toast('حُدّث الاعتماد'); KX.router.resolve();
    });
  }

  return { materials, priceHistory, zones, coupons, settings,
           customers, suppliersAdmin, transportersAdmin };
})();
