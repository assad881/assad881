/* كسارة اكسبريس — التقارير والإعدادات */
(function (root) {
  'use strict';
  const EX = (root.EX = root.EX || {});
  const U = EX.util;
  const t = function (k, p) { return EX.t(k, p); };
  const V = EX.views;

  /* ======================= التقارير ======================= */
  V.reports = function (host) {
    const f = EX.ui.ctx.repFilter = EX.ui.ctx.repFilter || {
      from: U.startOfMonth(U.today()), to: U.today()
    };
    const preset = function (label, from, to) {
      return { type: 'button', label: label, onClick: function () { f.from = from(); f.to = to(); EX.ui.refresh(); } };
    };

    host.appendChild(EX.ui.filterBar([
      { type: 'date', name: 'from', label: t('from'), value: f.from },
      { type: 'date', name: 'to', label: t('to'), value: f.to },
      preset(t('today_label'), U.today, U.today),
      preset(t('this_month'), function () { return U.startOfMonth(U.today()); }, U.today),
      preset(t('last_30'), function () { return U.addDays(U.today(), -29); }, U.today),
      {
        type: 'button', label: 'السنة', onClick: function () {
          f.from = U.today().slice(0, 4) + '-01-01'; f.to = U.today(); EX.ui.refresh();
        }
      },
      { type: 'button', label: t('print'), onClick: function () { EX.print.report(f.from, f.to); } }
    ], function (name, value) { f[name] = value; EX.ui.refresh(); }));

    const s = EX.calc.summary(f.from, f.to);

    host.appendChild(U.el('div', { class: 'kpi-grid' }, [
      EX.ui.kpi(t('gross_revenue'), U.money(s.revenue), { tone: 'pos', sub: U.fmtDate(f.from) + ' → ' + U.fmtDate(f.to) }),
      EX.ui.kpi(t('total_expenses'), U.money(s.expensesTotal), { tone: 'neg' }),
      EX.ui.kpi(t('net_profit'), U.money(s.net), { tone: U.sign(s.net) }),
      EX.ui.kpi(t('margin'), U.pct(s.margin), { tone: U.sign(s.margin) })
    ]));

    host.appendChild(U.el('div', { class: 'kpi-grid' }, [
      EX.ui.kpi(t('loads_count'), U.iso(String(s.trips)), { sub: EX.calc.qtyLabel(s.qty) }),
      EX.ui.kpi(t('avg_load'), U.money(s.avgLoad)),
      EX.ui.kpi(t('avg_price_ton'), U.money(s.avgPricePerTon)),
      EX.ui.kpi(t('collected'), U.money(s.collected), { sub: t('pay_cash') + ' ' + U.money(s.cashLoads, { decimals: 0 }) + ' + ' + t('payments_title') + ' ' + U.money(s.paymentsTotal, { decimals: 0 }) })
    ]));

    /* الحركة اليومية داخل الفترة */
    const days = Math.min(120, Math.max(1, U.daysBetween(f.from, f.to) + 1));
    const rev = {}, exp = {};
    s.loads.forEach(function (l) { rev[l.date] = U.num(rev[l.date]) + U.num(l.total); });
    s.expenses.forEach(function (e) { exp[e.date] = U.num(exp[e.date]) + U.num(e.amount); });
    const series = [];
    for (let i = 0; i < days; i++) {
      const d = U.addDays(f.from, i);
      series.push({ label: U.iso(d.slice(5)), value: U.round(rev[d] || 0, 3), value2: U.round(exp[d] || 0, 3) });
    }
    const trendHost = U.el('div', { class: 'chart' });
    host.appendChild(EX.ui.card(t('daily_trend'), U.el('div', {}, [
      trendHost,
      EX.charts.legend([{ label: t('revenue') }, { label: t('total_expenses') }])
    ])));
    if (days <= 45) EX.charts.bars(trendHost, series, { second: true, height: 200 });
    else EX.charts.line(trendHost, series, { second: true, height: 200 });

    /* حسب المادة */
    const byMat = EX.calc.breakdown(s.loads, 'materialId');
    const matChart = U.el('div', { class: 'chart' });
    host.appendChild(EX.ui.card(t('by_material'), U.el('div', { class: 'grid-2-tight' }, [
      matChart,
      EX.ui.table([
        { label: t('material'), cell: function (r) { return r.label; } },
        { label: t('loads_count'), align: 'end', tnum: true, cell: function (r) { return U.iso(String(r.trips)); } },
        { label: t('sold_qty'), align: 'end', tnum: true, cell: function (r) { return EX.calc.qtyLabel(r.qty); } },
        { label: t('revenue'), align: 'end', tnum: true, cell: function (r) { return U.money(r.revenue); } },
        { label: t('share'), align: 'end', tnum: true, cell: function (r) { return U.pct(r.share); } }
      ], byMat, {
        footer: byMat.length ? [
          { text: t('total') }, { text: U.iso(String(s.trips)), align: 'end', tnum: true },
          { text: EX.calc.qtyLabel(s.qty), align: 'end', tnum: true },
          { text: U.money(s.revenue), align: 'end', tnum: true }, { text: '' }
        ] : null
      })
    ])));
    EX.charts.hbars(matChart, byMat.slice(0, 9).map(function (r) {
      return { label: r.label, value: r.revenue, text: U.money(r.revenue, { bare: true, decimals: 0 }) };
    }), { colors: true });

    /* حسب العميل */
    const byCust = EX.calc.breakdown(s.loads, 'customerId');
    const custChart = U.el('div', { class: 'chart' });
    host.appendChild(EX.ui.card(t('by_customer'), U.el('div', { class: 'grid-2-tight' }, [
      custChart,
      EX.ui.table([
        { label: t('customer'), cell: function (r) { return r.label; } },
        { label: t('loads_count'), align: 'end', tnum: true, cell: function (r) { return U.iso(String(r.trips)); } },
        { label: t('revenue'), align: 'end', tnum: true, cell: function (r) { return U.money(r.revenue); } },
        { label: t('share'), align: 'end', tnum: true, cell: function (r) { return U.pct(r.share); } },
        { label: t('balance'), align: 'end', tnum: true, cell: function (r) { return U.money(EX.calc.customerBalance(r.key)); } }
      ], byCust.slice(0, 20), {
        onRowClick: function (r) { EX.ui.go('customers', { customerId: r.key }); }
      })
    ])));
    EX.charts.hbars(custChart, byCust.slice(0, 9).map(function (r) {
      return { label: r.label, value: r.revenue, text: U.money(r.revenue, { bare: true, decimals: 0 }) };
    }), { colors: true });

    /* حسب الشاحنة */
    if (EX.store.s.trucks.length) {
      const byTruck = EX.calc.breakdown(s.loads, 'truckId');
      host.appendChild(EX.ui.card(t('by_truck'), EX.ui.table([
        { label: t('truck'), cell: function (r) { return r.label; } },
        { label: t('trips'), align: 'end', tnum: true, cell: function (r) { return U.iso(String(r.trips)); } },
        { label: t('hauled'), align: 'end', tnum: true, cell: function (r) { return EX.calc.qtyLabel(r.qty); } },
        { label: t('revenue'), align: 'end', tnum: true, cell: function (r) { return U.money(r.revenue); } },
        { label: t('share'), align: 'end', tnum: true, cell: function (r) { return U.pct(r.share); } }
      ], byTruck, {})));
    }

    /* المصروفات */
    const expRows = EX.calc.expenseBreakdown(s.expenses);
    const expChart = U.el('div', { class: 'chart' });
    host.appendChild(EX.ui.card(t('expenses_breakdown'), U.el('div', { class: 'grid-2-tight' }, [
      expChart,
      EX.ui.table([
        { label: t('category'), cell: function (r) { return r.label; } },
        { label: t('rows'), align: 'end', tnum: true, cell: function (r) { return U.iso(String(r.count)); } },
        { label: t('amount'), align: 'end', tnum: true, cell: function (r) { return U.money(r.amount); } },
        { label: t('share'), align: 'end', tnum: true, cell: function (r) { return U.pct(r.share); } }
      ], expRows, {
        footer: expRows.length ? [
          { text: t('total') }, { text: '' },
          { text: U.money(s.expensesTotal), align: 'end', tnum: true }, { text: '' }
        ] : null
      })
    ])));
    EX.charts.donut(expChart, expRows.map(function (r) { return { label: r.label, value: r.amount }; }), { centerLabel: 'ر.ع' });

    /* الأشهر */
    const months = EX.calc.monthlySeries(12);
    const monChart = U.el('div', { class: 'chart' });
    host.appendChild(EX.ui.card(t('rev_vs_exp') + ' — ' + t('by_month'), U.el('div', {}, [
      monChart,
      EX.charts.legend([{ label: t('revenue') }, { label: t('total_expenses') }]),
      EX.ui.table([
        { label: t('period'), cell: function (r) { return U.monthLabel(r.month, EX.i18n.lang); } },
        { label: t('loads_count'), align: 'end', tnum: true, cell: function (r) { return U.iso(String(r.trips)); } },
        { label: t('unit_ton'), align: 'end', tnum: true, cell: function (r) { return U.qty(r.tons); } },
        { label: t('revenue'), align: 'end', tnum: true, cell: function (r) { return U.money(r.revenue); } },
        { label: t('total_expenses'), align: 'end', tnum: true, cell: function (r) { return U.money(r.expense); } },
        {
          label: t('net_profit'), align: 'end', tnum: true, cell: function (r) {
            return U.el('b', { class: U.sign(r.revenue - r.expense), text: U.money(r.revenue - r.expense) });
          }
        }
      ], months.slice().reverse(), {})
    ])));
    EX.charts.bars(monChart, months.map(function (m) {
      return { label: U.iso(m.month.slice(2)), value: m.revenue, value2: m.expense };
    }), { second: true, height: 200 });

    /* أعمار الذمم */
    const aging = EX.calc.aging();
    const ageRows = Object.keys(aging.perCustomer).map(function (id) {
      return Object.assign({ id: id, name: EX.store.customerName(id) }, aging.perCustomer[id]);
    });
    host.appendChild(EX.ui.card(t('aging'), U.el('div', {}, [
      U.el('div', { class: 'kpi-grid tight' }, [
        EX.ui.kpi(t('aging_0'), U.money(aging.buckets.b0)),
        EX.ui.kpi(t('aging_31'), U.money(aging.buckets.b31), { tone: 'warn' }),
        EX.ui.kpi(t('aging_61'), U.money(aging.buckets.b61), { tone: 'warn' }),
        EX.ui.kpi(t('aging_90'), U.money(aging.buckets.b90), { tone: 'neg' })
      ]),
      EX.ui.table([
        { label: t('customer'), cell: function (r) { return r.name; } },
        { label: t('aging_0'), align: 'end', tnum: true, cell: function (r) { return r.b0 ? U.money(r.b0) : '—'; } },
        { label: t('aging_31'), align: 'end', tnum: true, cell: function (r) { return r.b31 ? U.money(r.b31) : '—'; } },
        { label: t('aging_61'), align: 'end', tnum: true, cell: function (r) { return r.b61 ? U.money(r.b61) : '—'; } },
        { label: t('aging_90'), align: 'end', tnum: true, cell: function (r) { return r.b90 ? U.money(r.b90) : '—'; } },
        { label: t('total'), align: 'end', tnum: true, cell: function (r) { return U.el('b', { text: U.money(r.total) }); } }
      ], U.sortBy(ageRows, function (r) { return r.total; }, true), {
        onRowClick: function (r) { EX.ui.go('customers', { customerId: r.id }); },
        footer: ageRows.length ? [
          { text: t('total') },
          { text: U.money(aging.buckets.b0), align: 'end', tnum: true },
          { text: U.money(aging.buckets.b31), align: 'end', tnum: true },
          { text: U.money(aging.buckets.b61), align: 'end', tnum: true },
          { text: U.money(aging.buckets.b90), align: 'end', tnum: true },
          { text: U.money(aging.buckets.total), align: 'end', tnum: true }
        ] : null
      })
    ]), {
      subtitle: 'تُسدَّد الدفعات على أقدم نقلة آجلة أولًا (FIFO).'
    }));
  };

  /* ======================= الإعدادات ======================= */
  V.settings = function (host) {
    const st = EX.store.settings();

    /* بيانات المؤسسة */
    const cForm = EX.ui.form([
      { name: 'name', label: t('company_name') + ' (ع)', type: 'text', value: st.company.name || '', required: true },
      { name: 'nameEn', label: t('company_name') + ' (EN)', type: 'text', value: st.company.nameEn || '' },
      { name: 'phone', label: t('company_phone'), type: 'tel', value: st.company.phone || '' },
      { name: 'address', label: t('company_address'), type: 'text', value: st.company.address || '' },
      { name: 'crNo', label: t('cr_no'), type: 'text', value: st.company.crNo || '' },
      { name: 'vatNo', label: t('vat_no'), type: 'text', value: st.company.vatNo || '' },
      { name: 'vatEnabled', label: t('vat_enabled'), type: 'checkbox', value: !!st.vatEnabled, span: 2 },
      { name: 'vatRate', label: t('vat_rate'), type: 'number', step: '0.5', min: 0, value: st.vatRate }
    ]);
    host.appendChild(EX.ui.card(t('company'), U.el('div', {}, [
      cForm.node,
      U.el('div', { class: 'btn-row', style: { marginTop: '12px' } }, [
        U.el('button', {
          class: 'btn primary', text: t('save'),
          onclick: function () {
            if (!cForm.valid()) return;
            const v = cForm.get();
            st.company = { name: v.name, nameEn: v.nameEn, phone: v.phone, address: v.address, crNo: v.crNo, vatNo: v.vatNo };
            st.vatEnabled = !!v.vatEnabled;
            st.vatRate = U.num(v.vatRate, 5);
            EX.store.save();
            EX.ui.toast(t('saved'), 'good');
            EX.ui.renderShell();
          }
        })
      ])
    ]), { subtitle: 'تظهر هذه البيانات في سندات التسليم والفواتير وكشوف الحساب.' }));

    /* اللغة والمظهر */
    host.appendChild(EX.ui.card(t('settings_title'), U.el('div', { class: 'btn-row' }, [
      U.el('button', {
        class: 'btn' + (EX.i18n.lang === 'ar' ? ' primary' : ' ghost'), text: 'العربية',
        onclick: function () { EX.app.setLang('ar'); }
      }),
      U.el('button', {
        class: 'btn' + (EX.i18n.lang === 'en' ? ' primary' : ' ghost'), text: 'English',
        onclick: function () { EX.app.setLang('en'); }
      }),
      U.el('span', { class: 'divider-v' }),
      U.el('button', {
        class: 'btn' + (st.theme === 'dark' ? ' primary' : ' ghost'), text: t('dark'),
        onclick: function () { EX.app.setTheme('dark'); }
      }),
      U.el('button', {
        class: 'btn' + (st.theme === 'light' ? ' primary' : ' ghost'), text: t('light'),
        onclick: function () { EX.app.setTheme('light'); }
      })
    ])));

    /* البيانات */
    const counts = U.el('div', { class: 'meta-grid' }, [
      ['nav_customers', EX.store.s.customers.length],
      ['nav_loads', EX.store.s.loads.length],
      ['nav_payments', EX.store.s.payments.length],
      ['nav_expenses', EX.store.s.expenses.length],
      ['nav_materials', EX.store.s.materials.length],
      ['nav_trucks', EX.store.s.trucks.length]
    ].map(function (p) {
      return U.el('div', {}, [
        U.el('span', { class: 'muted small', text: t(p[0]) }),
        U.el('div', { class: 'tnum big', text: U.iso(String(p[1])) })
      ]);
    }));

    host.appendChild(EX.ui.card(t('data'), U.el('div', {}, [
      counts,
      U.el('div', { class: 'btn-row', style: { marginTop: '12px' } }, [
        U.el('button', {
          class: 'btn', text: t('export_all'),
          onclick: function () { EX.ui.saveFile('express-crusher-backup-' + U.today() + '.json', EX.store.exportJSON(), 'application/json'); }
        }),
        U.el('button', {
          class: 'btn', text: t('import_all'),
          onclick: function () {
            const area = U.el('textarea', { rows: '10', placeholder: '{ … }' });
            EX.ui.modal({
              title: t('import_all'),
              body: U.el('div', {}, [U.el('div', { class: 'notice', text: t('import_hint') }), area]),
              confirmText: t('import_all'),
              onConfirm: function () {
                try {
                  EX.store.importJSON(area.value);
                  EX.i18n.setLang(EX.store.settings().lang);
                  EX.ui.toast(t('import_done'), 'good');
                  EX.app.applyLang();
                  EX.app.applyTheme();
                  EX.ui.go('dashboard');
                } catch (e) {
                  EX.ui.toast(t('import_bad'), 'bad');
                  return false;
                }
              }
            });
          }
        }),
        U.el('button', {
          class: 'btn ghost', text: t('sample_data'),
          onclick: function () {
            EX.ui.confirm(t('sample_hint'), function () {
              EX.store.loadSample();
              EX.ui.toast(t('saved'), 'good');
              EX.ui.go('dashboard');
            }, { confirmText: t('sample_data'), danger: false });
          }
        }),
        U.el('div', { class: 'spacer' }),
        U.el('button', {
          class: 'btn ghost danger', text: t('reset_all'),
          onclick: function () {
            EX.ui.confirm(t('reset_confirm'), function () {
              EX.store.reset();
              EX.ui.toast(t('deleted'));
              EX.ui.go('dashboard');
            });
          }
        })
      ]),
      U.el('div', { class: 'notice', style: { marginTop: '12px' }, text: t('storage_note') })
    ])));

    host.appendChild(U.el('div', { class: 'footer-note' }, [
      U.el('div', { text: t('app_name') + ' · ' + t('app_tagline') }),
      U.el('div', { class: 'muted small', text: 'بيانات محلية بالكامل — بدون خادم وبدون إنترنت.' })
    ]));
  };
})(window);
