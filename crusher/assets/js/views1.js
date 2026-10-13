/* كسارة اكسبريس — لوحة اليوم وسجل النقلات */
(function (root) {
  'use strict';
  const EX = (root.EX = root.EX || {});
  const U = EX.util;
  const t = function (k, p) { return EX.t(k, p); };
  const V = (EX.views = EX.views || {});

  function unitLabel(u) { return t('unit_' + (u === 'm3' ? 'm3' : u === 'load' ? 'load' : 'ton')); }
  V.unitLabel = unitLabel;

  function needSetup() {
    const s = EX.store.s;
    if (s.customers.length) return null;
    return U.el('div', { class: 'notice' }, [
      U.el('b', { text: 'ابدأ هنا: ' }),
      U.el('span', { text: 'أضف أول عميل من شاشة «العملاء»، أو حمّل بيانات تجريبية من «الإعدادات» لتجربة التطبيق بسرعة.' })
    ]);
  }

  /* ======================= لوحة اليوم ======================= */
  V.dashboard = function (host) {
    const today = U.today();
    const mStart = U.startOfMonth(today);
    const day = EX.calc.summary(today, today);
    const month = EX.calc.summary(mStart, today);
    const receivables = EX.calc.totalReceivables();

    const setup = needSetup();
    if (setup) host.appendChild(setup);

    host.appendChild(U.el('div', { class: 'kpi-grid' }, [
      EX.ui.kpi(t('kpi_loads_today'), U.iso(String(day.trips)), { sub: EX.calc.qtyLabel(day.qty) }),
      EX.ui.kpi(t('kpi_revenue_today'), U.money(day.revenue), { tone: day.revenue > 0 ? 'pos' : '' }),
      EX.ui.kpi(t('kpi_cash_today'), U.money(day.collected), { sub: t('pay_cash') + ' + ' + t('payments_title') }),
      EX.ui.kpi(t('kpi_receivables'), U.money(receivables), { tone: receivables > 0 ? 'warn' : '', sub: t('aging') })
    ]));

    host.appendChild(U.el('div', { class: 'kpi-grid' }, [
      EX.ui.kpi(t('kpi_month_revenue'), U.money(month.revenue), { sub: U.monthLabel(U.monthKey(today), EX.i18n.lang) }),
      EX.ui.kpi(t('kpi_month_expenses'), U.money(month.expensesTotal)),
      EX.ui.kpi(t('kpi_month_profit'), U.money(month.net), { tone: U.sign(month.net) }),
      EX.ui.kpi(t('margin'), U.pct(month.margin), { tone: U.sign(month.margin), sub: t('loads_count') + ': ' + U.iso(String(month.trips)) })
    ]));

    /* إجراءات سريعة */
    host.appendChild(EX.ui.card(t('quick_actions'), U.el('div', { class: 'btn-row' }, [
      U.el('button', { class: 'btn primary', text: '+ ' + t('new_load'), onclick: function () { V.loadForm(); } }),
      U.el('button', { class: 'btn', text: t('new_payment'), onclick: function () { V.paymentForm(); } }),
      U.el('button', { class: 'btn', text: t('new_expense'), onclick: function () { V.expenseForm(); } }),
      U.el('button', { class: 'btn ghost', text: t('add_customer'), onclick: function () { V.customerForm(); } })
    ])));

    /* الحركة اليومية */
    const series = EX.calc.dailySeries(30);
    const chartHost = U.el('div', { class: 'chart' });
    host.appendChild(EX.ui.card(t('revenue_30'), U.el('div', {}, [
      chartHost,
      EX.charts.legend([{ label: t('revenue') }, { label: t('total_expenses') }])
    ])));
    EX.charts.line(chartHost, series.map(function (d) {
      return { label: U.iso(d.date.slice(5)), value: d.revenue, value2: d.expense };
    }), { second: true, height: 190 });

    /* توزيع الكميات على المواد + أعلى العملاء */
    const grid = U.el('div', { class: 'grid-2' });
    const matHost = U.el('div', { class: 'chart' });
    const custHost = U.el('div', { class: 'chart' });
    grid.appendChild(EX.ui.card(t('mix_month'), matHost));
    grid.appendChild(EX.ui.card(t('top_customers'), custHost));
    host.appendChild(grid);

    const byMat = EX.calc.breakdown(month.loads, 'materialId').slice(0, 7);
    EX.charts.hbars(matHost, byMat.map(function (r) {
      return { label: r.label, value: r.revenue, text: U.money(r.revenue, { bare: true, decimals: 0 }) };
    }), { colors: true });

    const byCust = EX.calc.breakdown(month.loads, 'customerId').slice(0, 7);
    EX.charts.hbars(custHost, byCust.map(function (r) {
      return { label: r.label, value: r.revenue, text: U.money(r.revenue, { bare: true, decimals: 0 }) };
    }), { colors: true });

    /* نقلات اليوم */
    const todayLoads = U.sortBy(day.loads, function (l) { return l.createdAt || 0; }, true);
    host.appendChild(EX.ui.card(t('today_loads'), V.loadsTable(todayLoads, { compact: true }), {
      subtitle: EX.calc.qtyLabel(day.qty) + ' · ' + U.money(day.revenue),
      actions: U.el('button', { class: 'btn ghost sm', text: t('nav_loads'), onclick: function () { EX.ui.go('loads'); } })
    }));

    /* أعلى المديونيات */
    const debtors = U.sortBy(EX.store.s.customers.map(function (c) {
      return { c: c, bal: EX.calc.customerBalance(c.id) };
    }).filter(function (r) { return r.bal > 0.0005; }), function (r) { return r.bal; }, true).slice(0, 8);
    if (debtors.length) {
      host.appendChild(EX.ui.card(t('top_debtors'), EX.ui.table([
        { label: t('customer'), cell: function (r) { return r.c.name; } },
        { label: t('area'), cell: function (r) { return r.c.area || '—'; }, hideSm: true },
        { label: t('balance'), align: 'end', tnum: true, cell: function (r) { return U.money(r.bal); } }
      ], debtors, {
        onRowClick: function (r) { EX.ui.go('customers', { customerId: r.c.id }); }
      })));
    }
  };

  /* ======================= جدول النقلات ======================= */
  V.loadsTable = function (loads, opts) {
    opts = opts || {};
    const cols = [
      { label: t('load_no'), width: '74px', tnum: true, cell: function (l) { return U.iso('#' + l.no); } },
      { label: t('date'), width: '104px', tnum: true, hideSm: opts.compact, cell: function (l) { return U.fmtDate(l.date); } },
      { label: t('customer'), cell: function (l) { return EX.store.customerName(l.customerId); } },
      { label: t('material'), cell: function (l) { return EX.store.materialName(l.materialId); } },
      { label: t('qty'), align: 'end', tnum: true, cell: function (l) { return U.qty(l.qty, unitLabel(l.unit)); } },
      { label: t('unit_price'), align: 'end', tnum: true, hideSm: true, cell: function (l) { return U.money(l.price); } },
      { label: t('total'), align: 'end', tnum: true, cell: function (l) { return U.money(l.total); } },
      {
        label: t('payment_type'), align: 'center', cell: function (l) {
          return EX.ui.badge(t(l.payment === 'cash' ? 'pay_cash' : 'pay_credit'), l.payment === 'cash' ? 'good' : 'warn');
        }
      },
      { label: t('truck'), hideSm: true, cell: function (l) { return EX.store.truckLabel(l.truckId); } },
      {
        label: t('actions'), align: 'end', cell: function (l) {
          return EX.ui.rowActions([
            { label: t('ticket'), onClick: function () { EX.print.ticket(l); } },
            { label: t('edit'), onClick: function () { V.loadForm(l); } },
            {
              label: t('delete'), danger: true, onClick: function () {
                EX.ui.confirm(t('delete_confirm'), function () {
                  EX.store.removeLoad(l.id);
                  EX.ui.toast(t('deleted'));
                  EX.ui.refresh();
                });
              }
            }
          ]);
        }
      }
    ].filter(function (c) { return !(opts.compact && c.label === t('truck')); });

    /* يُبنى التذييل من قائمة الأعمدة نفسها حتى يبقى كل مجموع تحت عموده */
    const totals = {};
    totals[t('load_no')] = t('total') + ' · ' + loads.length;
    totals[t('qty')] = EX.calc.qtyLabel(EX.calc.qtySummary(loads));
    totals[t('total')] = U.money(U.sum(loads, function (l) { return l.total; }));
    const footer = loads.length ? cols.map(function (c) {
      return { text: totals[c.label] || '', align: c.align, tnum: !!totals[c.label] && c.label !== t('load_no') };
    }) : null;

    return EX.ui.table(cols, loads, {
      footer: footer,
      emptyTitle: t('no_data'),
      emptyHint: opts.compact ? 'لا توجد نقلات مسجلة لهذا اليوم.' : t('empty_hint')
    });
  };

  /* ======================= شاشة النقلات ======================= */
  V.loads = function (host) {
    const f = EX.ui.ctx.loadFilter = EX.ui.ctx.loadFilter || {
      from: U.addDays(U.today(), -30), to: U.today(), q: '', customerId: '', materialId: '', payment: ''
    };
    const onChange = function (name, value) {
      f[name] = value;
      EX.ui.refresh();
    };

    host.appendChild(EX.ui.filterBar([
      { type: 'search', name: 'q', value: f.q },
      { type: 'date', name: 'from', label: t('from'), value: f.from },
      { type: 'date', name: 'to', label: t('to'), value: f.to },
      {
        type: 'select', name: 'customerId', value: f.customerId,
        options: [{ value: '', label: t('customer') + ': ' + t('all') }].concat(
          U.sortBy(EX.store.s.customers, function (c) { return c.name; }).map(function (c) {
            return { value: c.id, label: c.name };
          }))
      },
      {
        type: 'select', name: 'materialId', value: f.materialId,
        options: [{ value: '', label: t('material') + ': ' + t('all') }].concat(
          EX.store.s.materials.map(function (m) { return { value: m.id, label: EX.store.materialName(m.id) }; }))
      },
      {
        type: 'select', name: 'payment', value: f.payment,
        options: [
          { value: '', label: t('payment_type') + ': ' + t('all') },
          { value: 'cash', label: t('pay_cash') },
          { value: 'credit', label: t('pay_credit') }
        ]
      },
      { type: 'button', label: t('last_30'), onClick: function () { f.from = U.addDays(U.today(), -30); f.to = U.today(); EX.ui.refresh(); } },
      { type: 'button', label: t('this_month'), onClick: function () { f.from = U.startOfMonth(U.today()); f.to = U.today(); EX.ui.refresh(); } }
    ], onChange));

    const loads = U.sortBy(EX.calc.loads(f), function (l) { return l.date + '_' + String(l.no).padStart(6, '0'); }, true);
    const sum = EX.calc.summary(f.from, f.to);
    const filteredRevenue = U.sum(loads, function (l) { return l.total; });

    host.appendChild(U.el('div', { class: 'kpi-grid' }, [
      EX.ui.kpi(t('loads_count'), U.iso(String(loads.length))),
      EX.ui.kpi(t('qty'), EX.calc.qtyLabel(EX.calc.qtySummary(loads))),
      EX.ui.kpi(t('gross_revenue'), U.money(filteredRevenue)),
      EX.ui.kpi(t('avg_load'), U.money(loads.length ? filteredRevenue / loads.length : 0))
    ]));

    host.appendChild(EX.ui.card(t('loads_title'), V.loadsTable(loads), {
      subtitle: U.fmtDate(f.from) + ' → ' + U.fmtDate(f.to),
      actions: U.el('div', { class: 'btn-row' }, [
        U.el('button', { class: 'btn ghost sm', text: t('export_csv'), onclick: function () { V.exportLoads(loads); } }),
        U.el('button', { class: 'btn primary sm', text: '+ ' + t('add_load'), onclick: function () { V.loadForm(); } })
      ])
    }));
    void sum;
  };

  V.exportLoads = function (loads) {
    const rows = [[t('load_no'), t('date'), t('customer'), t('material'), t('qty'), t('unit'),
      t('unit_price'), t('discount'), t('total'), t('payment_type'), t('truck'), t('driver'), t('site'), t('notes')]];
    loads.forEach(function (l) {
      const trk = EX.store.truck(l.truckId);
      rows.push([l.no, l.date, EX.store.customerName(l.customerId), EX.store.materialName(l.materialId),
        l.qty, unitLabel(l.unit), l.price, l.discount || 0, l.total,
        t(l.payment === 'cash' ? 'pay_cash' : 'pay_credit'),
        trk ? trk.plate : '', trk ? trk.driver || '' : '', l.site || '', l.notes || '']);
    });
    EX.ui.saveFile('loads_' + U.today() + '.csv', U.csv(rows), 'text/csv');
  };

  /* ======================= نموذج النقلة ======================= */
  V.loadForm = function (existing) {
    const st = EX.store.s;
    if (!st.customers.length) {
      EX.ui.toast('أضف عميلًا أولًا', 'bad');
      return V.customerForm();
    }
    const l = existing || {};
    const mats = st.materials.filter(function (m) { return m.active !== false || m.id === l.materialId; });
    const defMat = l.materialId || (mats[0] && mats[0].id) || '';
    const defCust = l.customerId || st.customers[0].id;

    const totalLine = U.el('div', { class: 'total-line' });
    const recalc = function () {
      const v = form.get();
      const total = EX.calc.loadTotal({ qty: v.qty, price: v.price, discount: v.discount });
      U.clear(totalLine).appendChild(U.el('div', {}, [
        U.el('span', { class: 'muted small', text: t('total') + ': ' }),
        U.el('b', { class: 'tnum big', text: U.money(total) })
      ]));
    };
    const syncPrice = function () {
      const v = form.get();
      const m = EX.store.material(v.materialId);
      form.set('price', EX.store.priceFor(v.customerId, v.materialId));
      if (m) {
        form.set('unit', m.unit);
        if (m.unit === 'load' && (!v.qty || U.num(v.qty) === 0)) form.set('qty', 1);
      }
      recalc();
    };

    const form = EX.ui.form([
      { name: 'date', label: t('date'), type: 'date', value: l.date || U.today(), required: true },
      {
        name: 'customerId', label: t('customer'), type: 'select', required: true, value: defCust,
        options: U.sortBy(st.customers, function (c) { return c.name; }).map(function (c) {
          return { value: c.id, label: c.name + (c.area ? ' — ' + c.area : '') };
        }),
        onInput: syncPrice
      },
      {
        name: 'materialId', label: t('material'), type: 'select', required: true, value: defMat,
        options: mats.map(function (m) { return { value: m.id, label: EX.store.materialName(m.id) }; }),
        onInput: syncPrice
      },
      {
        name: 'qty', label: t('qty'), type: 'number', required: true, step: '0.01', min: 0,
        value: l.qty === undefined ? '' : l.qty, onInput: recalc
      },
      {
        name: 'unit', label: t('unit'), type: 'select',
        value: l.unit || (EX.store.material(defMat) || {}).unit || 'ton',
        options: ['ton', 'load', 'm3'].map(function (u) { return { value: u, label: unitLabel(u) }; })
      },
      {
        name: 'price', label: t('unit_price') + ' (ر.ع)', type: 'number', required: true, step: '0.001', min: 0,
        value: l.price === undefined ? EX.store.priceFor(defCust, defMat) : l.price, onInput: recalc
      },
      {
        name: 'discount', label: t('discount') + ' (ر.ع)', type: 'number', step: '0.001', min: 0,
        value: l.discount || '', onInput: recalc
      },
      {
        name: 'payment', label: t('payment_type'), type: 'select',
        value: l.payment || ((EX.store.customer(defCust) || {}).type === 'cash' ? 'cash' : 'credit'),
        options: [{ value: 'cash', label: t('pay_cash') }, { value: 'credit', label: t('pay_credit') }]
      },
      {
        name: 'truckId', label: t('truck'), type: 'select', value: l.truckId || '',
        options: [{ value: '', label: '—' }].concat(st.trucks.map(function (tr) {
          return { value: tr.id, label: tr.plate + (tr.driver ? ' · ' + tr.driver : '') };
        }))
      },
      { name: 'site', label: t('site'), type: 'text', value: l.site || '', placeholder: t('optional') },
      { name: 'notes', label: t('notes'), type: 'textarea', value: l.notes || '', span: 2 }
    ]);

    const body = U.el('div', {}, [form.node, totalLine]);
    recalc();

    EX.ui.modal({
      title: existing ? t('edit_load') + ' #' + existing.no : t('add_load'),
      body: body,
      wide: true,
      confirmText: t('save'),
      extra: existing ? U.el('button', {
        class: 'btn ghost sm', text: t('ticket'),
        onclick: function () { EX.print.ticket(existing); }
      }) : null,
      onConfirm: function () {
        if (!form.valid()) return false;
        const v = form.get();
        v.qty = U.num(v.qty);
        v.price = U.num(v.price);
        v.discount = U.num(v.discount);
        if (v.qty <= 0) { EX.ui.toast(t('qty') + ' > 0', 'bad'); return false; }
        if (existing) EX.store.updateLoad(existing.id, v);
        else EX.store.addLoad(v);
        EX.ui.toast(t('saved'), 'good');
        EX.ui.refresh();
      }
    });
  };
})(window);
