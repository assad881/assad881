/* كسارة اكسبريس — العملاء والذمم والمدفوعات والمواد والشاحنات والمصروفات */
(function (root) {
  'use strict';
  const EX = (root.EX = root.EX || {});
  const U = EX.util;
  const t = function (k, p) { return EX.t(k, p); };
  const V = EX.views;

  /* ======================= العملاء ======================= */
  V.customers = function (host) {
    if (EX.ui.ctx.customerId && EX.store.customer(EX.ui.ctx.customerId)) {
      return V.customerDetail(host, EX.store.customer(EX.ui.ctx.customerId));
    }
    const f = EX.ui.ctx.custFilter = EX.ui.ctx.custFilter || { q: '', only: '' };

    host.appendChild(EX.ui.filterBar([
      { type: 'search', name: 'q', value: f.q },
      {
        type: 'select', name: 'only', value: f.only,
        options: [
          { value: '', label: t('all') },
          { value: 'debt', label: t('balance') + ' > 0' },
          { value: 'credit', label: t('pay_credit') },
          { value: 'cash', label: t('pay_cash') }
        ]
      },
      { type: 'button', label: '+ ' + t('add_customer'), onClick: function () { V.customerForm(); } }
    ], function (name, value) { f[name] = value; EX.ui.refresh(); }));

    const aging = EX.calc.aging();
    host.appendChild(U.el('div', { class: 'kpi-grid' }, [
      EX.ui.kpi(t('aging_0'), U.money(aging.buckets.b0)),
      EX.ui.kpi(t('aging_31'), U.money(aging.buckets.b31), { tone: aging.buckets.b31 > 0 ? 'warn' : '' }),
      EX.ui.kpi(t('aging_61'), U.money(aging.buckets.b61), { tone: aging.buckets.b61 > 0 ? 'warn' : '' }),
      EX.ui.kpi(t('aging_90'), U.money(aging.buckets.b90), { tone: aging.buckets.b90 > 0 ? 'neg' : '' })
    ]));

    const rows = EX.store.s.customers.map(function (c) {
      const loads = EX.store.s.loads.filter(function (l) { return l.customerId === c.id; });
      const last = loads.length ? U.sortBy(loads, function (l) { return l.date; }, true)[0].date : '';
      return {
        c: c,
        balance: EX.calc.customerBalance(c.id),
        trips: loads.length,
        revenue: U.sum(loads, function (l) { return l.total; }),
        last: last,
        ageRow: aging.perCustomer[c.id] || null
      };
    }).filter(function (r) {
      if (f.q && !U.match([r.c.name, r.c.phone, r.c.area, r.c.notes].join(' '), f.q)) return false;
      if (f.only === 'debt' && r.balance <= 0.0005) return false;
      if (f.only === 'credit' && r.c.type !== 'credit') return false;
      if (f.only === 'cash' && r.c.type !== 'cash') return false;
      return true;
    });

    const sorted = U.sortBy(rows, function (r) { return r.balance; }, true);

    host.appendChild(EX.ui.card(t('customers_title'), EX.ui.table([
      { label: t('name'), cell: function (r) { return r.c.name; } },
      { label: t('phone'), tnum: true, hideSm: true, cell: function (r) { return r.c.phone ? U.iso(r.c.phone) : '—'; } },
      { label: t('area'), hideSm: true, cell: function (r) { return r.c.area || '—'; } },
      {
        label: t('customer_type'), align: 'center', cell: function (r) {
          return EX.ui.badge(t(r.c.type === 'cash' ? 'pay_cash' : 'pay_credit'), r.c.type === 'cash' ? 'good' : '');
        }
      },
      { label: t('loads_count'), align: 'end', tnum: true, hideSm: true, cell: function (r) { return U.iso(String(r.trips)); } },
      { label: t('revenue'), align: 'end', tnum: true, hideSm: true, cell: function (r) { return U.money(r.revenue); } },
      { label: t('last_load'), tnum: true, hideSm: true, cell: function (r) { return r.last ? U.fmtDate(r.last) : '—'; } },
      {
        label: t('balance'), align: 'end', tnum: true, cell: function (r) {
          return U.el('b', { class: r.balance > 0.0005 ? 'warn' : 'muted', text: U.money(r.balance) });
        }
      },
      {
        label: t('actions'), align: 'end', cell: function (r) {
          return EX.ui.rowActions([
            { label: t('statement'), onClick: function () { EX.ui.go('customers', { customerId: r.c.id }); } },
            { label: t('new_payment'), onClick: function () { V.paymentForm({ customerId: r.c.id }); } },
            { label: t('edit'), onClick: function () { V.customerForm(r.c); } }
          ]);
        }
      }
    ], sorted, {
      onRowClick: function (r) { EX.ui.go('customers', { customerId: r.c.id }); },
      footer: sorted.length ? [
        { text: t('total') + ' · ' + sorted.length }, { text: '' }, { text: '' }, { text: '' }, { text: '' }, { text: '' }, { text: '' },
        { text: U.money(U.sum(sorted, function (r) { return Math.max(0, r.balance); })), align: 'end', tnum: true },
        { text: '' }
      ] : null
    }), {
      actions: U.el('button', { class: 'btn primary sm', text: '+ ' + t('add_customer'), onclick: function () { V.customerForm(); } })
    }));
  };

  /* ---------- كشف حساب عميل ---------- */
  V.customerDetail = function (host, c) {
    const f = EX.ui.ctx.stFilter = EX.ui.ctx.stFilter || { from: '', to: U.today() };
    host.appendChild(U.el('div', { class: 'back-row' }, [
      U.el('button', { class: 'btn ghost sm', text: '← ' + t('nav_customers'), onclick: function () { EX.ui.go('customers'); } }),
      U.el('div', { class: 'spacer' }),
      U.el('button', { class: 'btn ghost sm', text: t('edit'), onclick: function () { V.customerForm(c); } }),
      U.el('button', { class: 'btn sm', text: t('new_payment'), onclick: function () { V.paymentForm({ customerId: c.id }); } }),
      U.el('button', { class: 'btn primary sm', text: '+ ' + t('add_load'), onclick: function () { V.loadForm({ customerId: c.id }); } })
    ]));

    const st = EX.calc.statement(c.id, f.from, f.to);
    const loads = EX.store.s.loads.filter(function (l) { return l.customerId === c.id; });
    const age = EX.calc.aging().perCustomer[c.id];

    host.appendChild(EX.ui.card(c.name, U.el('div', { class: 'meta-grid' }, [
      U.el('div', {}, [U.el('span', { class: 'muted small', text: t('phone') }), U.el('div', { class: 'tnum', text: c.phone ? U.iso(c.phone) : '—' })]),
      U.el('div', {}, [U.el('span', { class: 'muted small', text: t('area') }), U.el('div', { text: c.area || '—' })]),
      U.el('div', {}, [U.el('span', { class: 'muted small', text: t('customer_type') }), U.el('div', { text: t(c.type === 'cash' ? 'pay_cash' : 'pay_credit') })]),
      U.el('div', {}, [U.el('span', { class: 'muted small', text: t('loads_count') }), U.el('div', { class: 'tnum', text: U.iso(String(loads.length)) })]),
      U.el('div', {}, [U.el('span', { class: 'muted small', text: t('revenue') }), U.el('div', { class: 'tnum', text: U.money(U.sum(loads, function (l) { return l.total; })) })]),
      U.el('div', {}, [U.el('span', { class: 'muted small', text: t('balance') }), U.el('div', { class: 'tnum big ' + (st.closing > 0.0005 ? 'warn' : ''), text: U.money(st.closing) })])
    ]), { subtitle: c.notes || '' }));

    if (age) {
      host.appendChild(EX.ui.card(t('aging'), U.el('div', { class: 'kpi-grid tight' }, [
        EX.ui.kpi(t('aging_0'), U.money(age.b0)),
        EX.ui.kpi(t('aging_31'), U.money(age.b31)),
        EX.ui.kpi(t('aging_61'), U.money(age.b61)),
        EX.ui.kpi(t('aging_90'), U.money(age.b90), { tone: age.b90 > 0 ? 'neg' : '' })
      ])));
    }

    host.appendChild(EX.ui.filterBar([
      { type: 'date', name: 'from', label: t('from'), value: f.from },
      { type: 'date', name: 'to', label: t('to'), value: f.to },
      { type: 'button', label: t('all'), onClick: function () { f.from = ''; f.to = U.today(); EX.ui.refresh(); } }
    ], function (name, value) { f[name] = value; EX.ui.refresh(); }));

    const rows = st.rows.slice().reverse();
    host.appendChild(EX.ui.card(t('statement'), EX.ui.table([
      { label: t('date'), tnum: true, width: '104px', cell: function (r) { return U.fmtDate(r.date); } },
      { label: t('ref'), cell: function (r) { return r.ref ? U.iso(r.ref) : '—'; } },
      { label: t('notes'), cell: function (r) { return r.desc; } },
      { label: t('debit'), align: 'end', tnum: true, cell: function (r) { return r.debit ? U.money(r.debit) : '—'; } },
      { label: t('credit_col'), align: 'end', tnum: true, cell: function (r) { return r.credit ? U.money(r.credit) : '—'; } },
      { label: t('running'), align: 'end', tnum: true, cell: function (r) { return U.money(r.balance); } }
    ], rows, {
      footer: [
        { text: t('doc_prev_balance') + ': ' + U.money(st.opening) }, { text: '' }, { text: '' },
        { text: U.money(U.sum(rows, function (r) { return r.debit; })), align: 'end', tnum: true },
        { text: U.money(U.sum(rows, function (r) { return r.credit; })), align: 'end', tnum: true },
        { text: U.money(st.closing), align: 'end', tnum: true }
      ]
    }), {
      actions: U.el('div', { class: 'btn-row' }, [
        U.el('button', { class: 'btn ghost sm', text: t('export_csv'), onclick: function () {
          const out = [[t('date'), t('ref'), t('notes'), t('debit'), t('credit_col'), t('running')]];
          st.rows.forEach(function (r) { out.push([r.date, r.ref, r.desc, r.debit, r.credit, r.balance]); });
          EX.ui.saveFile('statement_' + c.name + '.csv', U.csv(out), 'text/csv');
        } }),
        U.el('button', { class: 'btn sm', text: t('print'), onclick: function () { EX.print.statement(c, st, f); } })
      ])
    }));
  };

  V.customerForm = function (existing) {
    const c = existing || {};
    const mats = EX.store.s.materials;
    const priceFields = mats.map(function (m) {
      return {
        name: 'p_' + m.id, label: EX.store.materialName(m.id) + ' (' + V.unitLabel(m.unit) + ')',
        type: 'number', step: '0.001', min: 0,
        placeholder: String(m.price),
        value: c.priceOverrides && c.priceOverrides[m.id] !== undefined ? c.priceOverrides[m.id] : ''
      };
    });

    const main = EX.ui.form([
      { name: 'name', label: t('name'), type: 'text', value: c.name || '', required: true, span: 2 },
      { name: 'phone', label: t('phone'), type: 'tel', value: c.phone || '' },
      { name: 'area', label: t('area'), type: 'text', value: c.area || '' },
      {
        name: 'type', label: t('customer_type'), type: 'select', value: c.type || 'credit',
        options: [{ value: 'credit', label: t('pay_credit') }, { value: 'cash', label: t('pay_cash') }]
      },
      { name: 'openingBalance', label: t('opening_balance') + ' (ر.ع)', type: 'number', step: '0.001', value: c.openingBalance || '' },
      { name: 'notes', label: t('notes'), type: 'textarea', value: c.notes || '', span: 2 }
    ]);
    const prices = EX.ui.form(priceFields, { cols: 3 });

    const body = U.el('div', {}, [
      main.node,
      U.el('div', { class: 'sub-head' }, [
        U.el('b', { text: t('special_prices') }),
        U.el('span', { class: 'muted small', text: ' — ' + t('special_prices_hint') })
      ]),
      prices.node
    ]);

    EX.ui.modal({
      title: existing ? t('edit_customer') : t('add_customer'),
      wide: true,
      body: body,
      extra: existing ? U.el('button', {
        class: 'btn ghost sm danger', text: t('delete'),
        onclick: function () {
          EX.ui.confirm(t('delete_confirm'), function () {
            EX.store.remove('customers', existing.id);
            EX.ui.toast(t('deleted'));
            EX.ui.go('customers');
            U.$$('.modal-backdrop').forEach(function (n) { n.remove(); });
          });
        }
      }) : null,
      onConfirm: function () {
        if (!main.valid()) return false;
        const v = main.get();
        const pv = prices.get();
        const overrides = {};
        mats.forEach(function (m) {
          const val = pv['p_' + m.id];
          if (val !== '' && val !== null && val !== undefined && isFinite(Number(val))) overrides[m.id] = U.num(val);
        });
        EX.store.upsert('customers', {
          id: existing ? existing.id : undefined,
          name: v.name, phone: v.phone, area: v.area, type: v.type,
          openingBalance: U.num(v.openingBalance), notes: v.notes,
          priceOverrides: overrides, active: true
        }, 'cus');
        EX.ui.toast(t('saved'), 'good');
        EX.ui.refresh();
      }
    });
  };

  /* ======================= المدفوعات ======================= */
  V.payments = function (host) {
    const f = EX.ui.ctx.payFilter = EX.ui.ctx.payFilter || {
      from: U.addDays(U.today(), -60), to: U.today(), q: '', customerId: ''
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
      { type: 'button', label: '+ ' + t('add_payment'), onClick: function () { V.paymentForm(); } }
    ], function (name, value) { f[name] = value; EX.ui.refresh(); }));

    const pays = U.sortBy(EX.calc.payments(f), function (p) { return p.date; }, true);
    const total = U.sum(pays, function (p) { return p.amount; });

    host.appendChild(U.el('div', { class: 'kpi-grid' }, [
      EX.ui.kpi(t('collected'), U.money(total), { tone: 'pos' }),
      EX.ui.kpi(t('rows'), U.iso(String(pays.length))),
      EX.ui.kpi(t('kpi_receivables'), U.money(EX.calc.totalReceivables()), { tone: 'warn' })
    ]));

    host.appendChild(EX.ui.card(t('payments_title'), EX.ui.table([
      { label: t('date'), tnum: true, width: '104px', cell: function (p) { return U.fmtDate(p.date); } },
      { label: t('customer'), cell: function (p) { return EX.store.customerName(p.customerId); } },
      { label: t('amount'), align: 'end', tnum: true, cell: function (p) { return U.money(p.amount); } },
      { label: t('method'), align: 'center', cell: function (p) { return EX.ui.badge(t('m_' + p.method)); } },
      { label: t('ref'), hideSm: true, cell: function (p) { return p.ref ? U.iso(p.ref) : '—'; } },
      { label: t('notes'), hideSm: true, cell: function (p) { return p.notes || '—'; } },
      {
        label: t('actions'), align: 'end', cell: function (p) {
          return EX.ui.rowActions([
            { label: t('receipt'), onClick: function () { EX.print.receipt(p); } },
            { label: t('edit'), onClick: function () { V.paymentForm(p); } },
            {
              label: t('delete'), danger: true, onClick: function () {
                EX.ui.confirm(t('delete_confirm'), function () {
                  EX.store.remove('payments', p.id);
                  EX.ui.toast(t('deleted'));
                  EX.ui.refresh();
                });
              }
            }
          ]);
        }
      }
    ], pays, {
      footer: pays.length ? [
        { text: t('total') }, { text: '' },
        { text: U.money(total), align: 'end', tnum: true },
        { text: '' }, { text: '' }, { text: '' }, { text: '' }
      ] : null
    }), {
      actions: U.el('button', { class: 'btn primary sm', text: '+ ' + t('add_payment'), onclick: function () { V.paymentForm(); } })
    }));
  };

  V.paymentForm = function (existing) {
    if (!EX.store.s.customers.length) { EX.ui.toast('أضف عميلًا أولًا', 'bad'); return V.customerForm(); }
    const p = existing || {};
    const balLine = U.el('div', { class: 'total-line' });
    const showBal = function () {
      const v = form.get();
      const bal = EX.calc.customerBalance(v.customerId);
      U.clear(balLine).appendChild(U.el('div', {}, [
        U.el('span', { class: 'muted small', text: t('balance') + ': ' }),
        U.el('b', { class: 'tnum big ' + (bal > 0.0005 ? 'warn' : ''), text: U.money(bal) })
      ]));
    };
    const form = EX.ui.form([
      { name: 'date', label: t('date'), type: 'date', value: p.date || U.today(), required: true },
      {
        name: 'customerId', label: t('customer'), type: 'select', required: true,
        value: p.customerId || (EX.ui.ctx.payCust || EX.store.s.customers[0].id),
        options: U.sortBy(EX.store.s.customers, function (c) { return c.name; }).map(function (c) {
          return { value: c.id, label: c.name + ' — ' + U.money(EX.calc.customerBalance(c.id)) };
        }),
        onInput: showBal
      },
      { name: 'amount', label: t('amount') + ' (ر.ع)', type: 'number', required: true, step: '0.001', min: 0, value: p.amount === undefined ? '' : p.amount },
      {
        name: 'method', label: t('method'), type: 'select', value: p.method || 'cash',
        options: [{ value: 'cash', label: t('m_cash') }, { value: 'bank', label: t('m_bank') }, { value: 'cheque', label: t('m_cheque') }]
      },
      { name: 'ref', label: t('ref'), type: 'text', value: p.ref || '', placeholder: t('optional') },
      { name: 'notes', label: t('notes'), type: 'textarea', value: p.notes || '', span: 2 }
    ]);
    if (existing && existing.customerId) form.set('customerId', existing.customerId);
    showBal();

    EX.ui.modal({
      title: existing ? t('edit') + ' — ' + t('receipt') : t('add_payment'),
      wide: true,
      body: U.el('div', {}, [form.node, balLine]),
      onConfirm: function () {
        if (!form.valid()) return false;
        const v = form.get();
        v.amount = U.num(v.amount);
        if (v.amount <= 0) { EX.ui.toast(t('amount') + ' > 0', 'bad'); return false; }
        EX.store.upsert('payments', Object.assign({ id: existing ? existing.id : undefined }, v), 'pay');
        EX.ui.toast(t('saved'), 'good');
        EX.ui.refresh();
      }
    });
  };

  /* ======================= المواد ======================= */
  V.materials = function (host) {
    const mStart = U.startOfMonth(U.today());
    const loads = EX.calc.loads({ from: mStart, to: U.today() });
    const byMat = U.groupBy(loads, function (l) { return l.materialId; });

    host.appendChild(EX.ui.card(t('materials_title'), EX.ui.table([
      { label: t('material'), cell: function (m) { return EX.store.materialName(m.id); } },
      { label: t('unit'), align: 'center', cell: function (m) { return V.unitLabel(m.unit); } },
      { label: t('default_price'), align: 'end', tnum: true, cell: function (m) { return U.money(m.price); } },
      {
        label: t('sold_qty') + ' — ' + t('this_month'), align: 'end', tnum: true, cell: function (m) {
          const g = byMat[m.id] || [];
          return U.qty(U.sum(g, function (l) { return l.qty; }), V.unitLabel(m.unit));
        }
      },
      {
        label: t('revenue') + ' — ' + t('this_month'), align: 'end', tnum: true, cell: function (m) {
          return U.money(U.sum(byMat[m.id] || [], function (l) { return l.total; }));
        }
      },
      {
        label: t('active'), align: 'center', cell: function (m) {
          return EX.ui.badge(t(m.active === false ? 'inactive' : 'active'), m.active === false ? '' : 'good');
        }
      },
      {
        label: t('actions'), align: 'end', cell: function (m) {
          return EX.ui.rowActions([
            { label: t('edit'), onClick: function () { V.materialForm(m); } },
            {
              label: m.active === false ? t('active') : t('inactive'), onClick: function () {
                EX.store.upsert('materials', { id: m.id, active: m.active === false });
                EX.ui.refresh();
              }
            }
          ]);
        }
      }
    ], EX.store.s.materials, {}), {
      subtitle: 'السعر الافتراضي يُستخدم تلقائيًا في النقلة الجديدة، ويمكن تجاوزه بسعر خاص لكل عميل.',
      actions: U.el('button', { class: 'btn primary sm', text: '+ ' + t('add_material'), onclick: function () { V.materialForm(); } })
    }));
  };

  V.materialForm = function (existing) {
    const m = existing || {};
    const form = EX.ui.form([
      { name: 'name', label: t('name') + ' (ع)', type: 'text', value: m.name || '', required: true },
      { name: 'nameEn', label: t('name') + ' (EN)', type: 'text', value: m.nameEn || '' },
      {
        name: 'unit', label: t('unit'), type: 'select', value: m.unit || 'ton',
        options: ['ton', 'load', 'm3'].map(function (u) { return { value: u, label: V.unitLabel(u) }; })
      },
      { name: 'price', label: t('default_price') + ' (ر.ع)', type: 'number', step: '0.001', min: 0, required: true, value: m.price === undefined ? '' : m.price }
    ]);
    EX.ui.modal({
      title: existing ? t('edit') : t('add_material'),
      body: form.node,
      extra: existing ? U.el('button', {
        class: 'btn ghost sm danger', text: t('delete'),
        onclick: function () {
          const used = EX.store.s.loads.some(function (l) { return l.materialId === existing.id; });
          if (used) return EX.ui.toast('المادة مستخدمة في نقلات — أوقفها بدل حذفها', 'bad');
          EX.ui.confirm(t('delete_confirm'), function () {
            EX.store.remove('materials', existing.id);
            EX.ui.toast(t('deleted'));
            EX.ui.refresh();
            U.$$('.modal-backdrop').forEach(function (n) { n.remove(); });
          });
        }
      }) : null,
      onConfirm: function () {
        if (!form.valid()) return false;
        const v = form.get();
        EX.store.upsert('materials', {
          id: existing ? existing.id : undefined,
          name: v.name, nameEn: v.nameEn, unit: v.unit, price: U.num(v.price),
          active: existing ? existing.active !== false : true
        }, 'mat');
        EX.ui.toast(t('saved'), 'good');
        EX.ui.refresh();
      }
    });
  };

  /* ======================= الشاحنات ======================= */
  V.trucks = function (host) {
    const f = EX.ui.ctx.trkFilter = EX.ui.ctx.trkFilter || { from: U.startOfMonth(U.today()), to: U.today() };
    host.appendChild(EX.ui.filterBar([
      { type: 'date', name: 'from', label: t('from'), value: f.from },
      { type: 'date', name: 'to', label: t('to'), value: f.to },
      { type: 'button', label: '+ ' + t('add_truck'), onClick: function () { V.truckForm(); } }
    ], function (name, value) { f[name] = value; EX.ui.refresh(); }));

    const loads = EX.calc.loads({ from: f.from, to: f.to });
    const byTruck = U.groupBy(loads, function (l) { return l.truckId || ''; });
    const exps = EX.calc.expenses({ from: f.from, to: f.to });

    host.appendChild(EX.ui.card(t('trucks_title'), EX.ui.table([
      { label: t('plate'), tnum: true, cell: function (tr) { return U.iso(tr.plate); } },
      { label: t('driver'), cell: function (tr) { return tr.driver || '—'; } },
      { label: t('phone'), tnum: true, hideSm: true, cell: function (tr) { return tr.phone ? U.iso(tr.phone) : '—'; } },
      { label: t('capacity'), align: 'end', tnum: true, hideSm: true, cell: function (tr) { return tr.capacity ? U.qty(tr.capacity) : '—'; } },
      { label: t('trips'), align: 'end', tnum: true, cell: function (tr) { return U.iso(String((byTruck[tr.id] || []).length)); } },
      {
        label: t('hauled'), align: 'end', tnum: true, cell: function (tr) {
          return EX.calc.qtyLabel(EX.calc.qtySummary(byTruck[tr.id] || []));
        }
      },
      {
        label: t('revenue'), align: 'end', tnum: true, cell: function (tr) {
          return U.money(U.sum(byTruck[tr.id] || [], function (l) { return l.total; }));
        }
      },
      {
        label: t('total_expenses'), align: 'end', tnum: true, hideSm: true, cell: function (tr) {
          return U.money(U.sum(exps.filter(function (e) { return e.truckId === tr.id; }), function (e) { return e.amount; }));
        }
      },
      {
        label: t('actions'), align: 'end', cell: function (tr) {
          return EX.ui.rowActions([{ label: t('edit'), onClick: function () { V.truckForm(tr); } }]);
        }
      }
    ], EX.store.s.trucks, {}), {
      subtitle: U.fmtDate(f.from) + ' → ' + U.fmtDate(f.to),
      actions: U.el('button', { class: 'btn primary sm', text: '+ ' + t('add_truck'), onclick: function () { V.truckForm(); } })
    }));

    const unassigned = (byTruck[''] || []).length;
    if (unassigned) {
      host.appendChild(U.el('div', { class: 'notice warn', text: 'عدد ' + unassigned + ' نقلة غير مربوطة بشاحنة في هذه الفترة.' }));
    }
  };

  V.truckForm = function (existing) {
    const tr = existing || {};
    const form = EX.ui.form([
      { name: 'plate', label: t('plate'), type: 'text', value: tr.plate || '', required: true },
      { name: 'driver', label: t('driver'), type: 'text', value: tr.driver || '' },
      { name: 'phone', label: t('phone'), type: 'tel', value: tr.phone || '' },
      { name: 'capacity', label: t('capacity'), type: 'number', step: '0.5', min: 0, value: tr.capacity || '' },
      { name: 'notes', label: t('notes'), type: 'textarea', value: tr.notes || '', span: 2 }
    ]);
    EX.ui.modal({
      title: existing ? t('edit') : t('add_truck'),
      body: form.node,
      extra: existing ? U.el('button', {
        class: 'btn ghost sm danger', text: t('delete'),
        onclick: function () {
          const used = EX.store.s.loads.some(function (l) { return l.truckId === existing.id; });
          if (used) return EX.ui.toast('الشاحنة مستخدمة في نقلات مسجلة', 'bad');
          EX.ui.confirm(t('delete_confirm'), function () {
            EX.store.remove('trucks', existing.id);
            EX.ui.toast(t('deleted'));
            EX.ui.refresh();
            U.$$('.modal-backdrop').forEach(function (n) { n.remove(); });
          });
        }
      }) : null,
      onConfirm: function () {
        if (!form.valid()) return false;
        const v = form.get();
        EX.store.upsert('trucks', Object.assign({ id: existing ? existing.id : undefined, active: true }, v, { capacity: U.num(v.capacity) }), 'trk');
        EX.ui.toast(t('saved'), 'good');
        EX.ui.refresh();
      }
    });
  };

  /* ======================= المصروفات ======================= */
  V.expenses = function (host) {
    const f = EX.ui.ctx.expFilter = EX.ui.ctx.expFilter || {
      from: U.startOfMonth(U.today()), to: U.today(), q: '', category: ''
    };
    host.appendChild(EX.ui.filterBar([
      { type: 'search', name: 'q', value: f.q },
      { type: 'date', name: 'from', label: t('from'), value: f.from },
      { type: 'date', name: 'to', label: t('to'), value: f.to },
      {
        type: 'select', name: 'category', value: f.category,
        options: [{ value: '', label: t('category') + ': ' + t('all') }].concat(
          EX.store.EXPENSE_CATEGORIES.map(function (k) { return { value: k, label: t('cat_' + k) }; }))
      },
      { type: 'button', label: '+ ' + t('add_expense'), onClick: function () { V.expenseForm(); } }
    ], function (name, value) { f[name] = value; EX.ui.refresh(); }));

    const exps = U.sortBy(EX.calc.expenses(f), function (e) { return e.date; }, true);
    const total = U.sum(exps, function (e) { return e.amount; });
    const revenue = U.sum(EX.calc.loads({ from: f.from, to: f.to }), function (l) { return l.total; });

    host.appendChild(U.el('div', { class: 'kpi-grid' }, [
      EX.ui.kpi(t('total_expenses'), U.money(total), { tone: 'neg' }),
      EX.ui.kpi(t('gross_revenue'), U.money(revenue), { tone: 'pos' }),
      EX.ui.kpi(t('net_profit'), U.money(revenue - total), { tone: U.sign(revenue - total) }),
      EX.ui.kpi(t('share'), U.pct(revenue > 0 ? total / revenue * 100 : 0), { sub: t('total_expenses') + ' / ' + t('gross_revenue') })
    ]));

    const chartHost = U.el('div', { class: 'chart' });
    const breakdown = EX.calc.expenseBreakdown(exps);
    host.appendChild(EX.ui.card(t('expenses_breakdown'), U.el('div', { class: 'grid-2-tight' }, [
      chartHost,
      EX.ui.table([
        { label: t('category'), cell: function (r) { return r.label; } },
        { label: t('amount'), align: 'end', tnum: true, cell: function (r) { return U.money(r.amount); } },
        { label: t('share'), align: 'end', tnum: true, cell: function (r) { return U.pct(r.share); } }
      ], breakdown, {})
    ])));
    EX.charts.donut(chartHost, breakdown.map(function (r) { return { label: r.label, value: r.amount }; }), { centerLabel: 'ر.ع' });

    host.appendChild(EX.ui.card(t('expenses_title'), EX.ui.table([
      { label: t('date'), tnum: true, width: '104px', cell: function (e) { return U.fmtDate(e.date); } },
      { label: t('category'), cell: function (e) { return t('cat_' + (e.category || 'other')); } },
      { label: t('amount'), align: 'end', tnum: true, cell: function (e) { return U.money(e.amount); } },
      { label: t('truck'), hideSm: true, cell: function (e) { return e.truckId ? EX.store.truckLabel(e.truckId) : '—'; } },
      { label: t('notes'), hideSm: true, cell: function (e) { return e.notes || '—'; } },
      {
        label: t('actions'), align: 'end', cell: function (e) {
          return EX.ui.rowActions([
            { label: t('edit'), onClick: function () { V.expenseForm(e); } },
            {
              label: t('delete'), danger: true, onClick: function () {
                EX.ui.confirm(t('delete_confirm'), function () {
                  EX.store.remove('expenses', e.id);
                  EX.ui.toast(t('deleted'));
                  EX.ui.refresh();
                });
              }
            }
          ]);
        }
      }
    ], exps, {
      footer: exps.length ? [
        { text: t('total') }, { text: '' },
        { text: U.money(total), align: 'end', tnum: true },
        { text: '' }, { text: '' }, { text: '' }
      ] : null
    }), {
      actions: U.el('div', { class: 'btn-row' }, [
        U.el('button', { class: 'btn ghost sm', text: t('export_csv'), onclick: function () {
          const rows = [[t('date'), t('category'), t('amount'), t('truck'), t('notes')]];
          exps.forEach(function (e) {
            rows.push([e.date, t('cat_' + (e.category || 'other')), e.amount, e.truckId ? EX.store.truckLabel(e.truckId) : '', e.notes || '']);
          });
          EX.ui.saveFile('expenses_' + U.today() + '.csv', U.csv(rows), 'text/csv');
        } }),
        U.el('button', { class: 'btn primary sm', text: '+ ' + t('add_expense'), onclick: function () { V.expenseForm(); } })
      ])
    }));
  };

  V.expenseForm = function (existing) {
    const e = existing || {};
    const form = EX.ui.form([
      { name: 'date', label: t('date'), type: 'date', value: e.date || U.today(), required: true },
      {
        name: 'category', label: t('category'), type: 'select', value: e.category || 'diesel',
        options: EX.store.EXPENSE_CATEGORIES.map(function (k) { return { value: k, label: t('cat_' + k) }; })
      },
      { name: 'amount', label: t('amount') + ' (ر.ع)', type: 'number', step: '0.001', min: 0, required: true, value: e.amount === undefined ? '' : e.amount },
      {
        name: 'truckId', label: t('truck') + ' (' + t('optional') + ')', type: 'select', value: e.truckId || '',
        options: [{ value: '', label: '—' }].concat(EX.store.s.trucks.map(function (tr) {
          return { value: tr.id, label: tr.plate + (tr.driver ? ' · ' + tr.driver : '') };
        }))
      },
      { name: 'notes', label: t('notes'), type: 'textarea', value: e.notes || '', span: 2 }
    ]);
    EX.ui.modal({
      title: existing ? t('edit') : t('add_expense'),
      body: form.node,
      onConfirm: function () {
        if (!form.valid()) return false;
        const v = form.get();
        v.amount = U.num(v.amount);
        if (v.amount <= 0) { EX.ui.toast(t('amount') + ' > 0', 'bad'); return false; }
        EX.store.upsert('expenses', Object.assign({ id: existing ? existing.id : undefined }, v), 'exp');
        EX.ui.toast(t('saved'), 'good');
        EX.ui.refresh();
      }
    });
  };
})(window);
