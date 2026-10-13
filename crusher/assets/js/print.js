/* كسارة اكسبريس — المستندات القابلة للطباعة (سند تسليم، سند قبض، كشف حساب، تقرير) */
(function (root) {
  'use strict';
  const EX = (root.EX = root.EX || {});
  const U = EX.util;
  const t = function (k, p) { return EX.t(k, p); };

  /* ---------- تفقيط المبلغ بالعربية ---------- */
  const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
    'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];

  function under1000(n) {
    const parts = [];
    const h = Math.floor(n / 100), r = n % 100;
    if (h) parts.push(HUNDREDS[h]);
    if (r) {
      if (r < 20) parts.push(ONES[r]);
      else {
        const o = r % 10, tn = Math.floor(r / 10);
        parts.push(o ? ONES[o] + ' و' + TENS[tn] : TENS[tn]);
      }
    }
    return parts.join(' و');
  }

  function words(n) {
    n = Math.floor(Math.abs(U.num(n)));
    if (n === 0) return 'صفر';
    const groups = [
      { div: 1000000000, one: 'مليار', two: 'ملياران', many: 'مليارات' },
      { div: 1000000, one: 'مليون', two: 'مليونان', many: 'ملايين' },
      { div: 1000, one: 'ألف', two: 'ألفان', many: 'آلاف' }
    ];
    const parts = [];
    let rest = n;
    groups.forEach(function (g) {
      const c = Math.floor(rest / g.div);
      rest = rest % g.div;
      if (!c) return;
      if (c === 1) parts.push(g.one);
      else if (c === 2) parts.push(g.two);
      else if (c <= 10) parts.push(under1000(c) + ' ' + g.many);
      else parts.push(under1000(c) + ' ' + g.one);
    });
    if (rest) parts.push(under1000(rest));
    return parts.join(' و');
  }

  function amountWords(v) {
    const n = U.round(Math.abs(U.num(v)), 3);
    const rial = Math.floor(n);
    const baisa = Math.round((n - rial) * 1000);
    let s = words(rial) + ' ريال عماني';
    if (baisa) s += ' و' + words(baisa) + ' بيسة';
    return s + ' فقط';
  }

  /* ---------- عرض المستند ثم طباعته ----------
     يُعرض المستند أولًا على الشاشة: بعض البيئات (مثل الإطارات المحمية)
     لا تفتح نافذة الطباعة إطلاقًا، فتبقى المعاينة هي المخرج المضمون. */
  function render(node) {
    const m = EX.ui.modal({
      title: '',
      wide: true,
      actions: false,
      body: U.el('div', { class: 'doc-sheet' }, node)
    });
    m.body.parentNode.classList.add('doc-modal');
    const head = m.body.parentNode.querySelector('.modal-head');
    head.insertBefore(U.el('button', {
      class: 'btn primary sm', text: t('print'),
      onclick: function () {
        try { root.print(); } catch (e) { EX.ui.toast('المتصفح لم يسمح بفتح نافذة الطباعة', 'bad'); }
      }
    }), head.firstChild);
    return m;
  }

  function header(docTitle, docNo, date) {
    const c = EX.store.settings().company;
    return U.el('div', { class: 'doc-head' }, [
      U.el('div', { class: 'doc-company' }, [
        U.el('div', { class: 'doc-name', text: c.name || t('app_name') }),
        c.nameEn ? U.el('div', { class: 'doc-name-en', text: c.nameEn }) : null,
        U.el('div', { class: 'doc-meta' }, [
          c.phone ? U.el('span', { text: 'هاتف: ' + U.iso(c.phone) }) : null,
          c.address ? U.el('span', { text: c.address }) : null,
          c.crNo ? U.el('span', { text: 'س.ت: ' + U.iso(c.crNo) }) : null,
          c.vatNo ? U.el('span', { text: 'الرقم الضريبي: ' + U.iso(c.vatNo) }) : null
        ])
      ]),
      U.el('div', { class: 'doc-title-box' }, [
        U.el('div', { class: 'doc-title', text: docTitle }),
        docNo ? U.el('div', { class: 'doc-no', text: t('doc_no') + ': ' + U.iso(String(docNo)) }) : null,
        U.el('div', { class: 'doc-no', text: t('date') + ': ' + U.fmtDate(date) })
      ])
    ]);
  }

  function kv(label, value) {
    return U.el('div', { class: 'doc-kv' }, [
      U.el('span', { class: 'k', text: label }),
      U.el('span', { class: 'v', text: value })
    ]);
  }

  function signatures() {
    return U.el('div', { class: 'doc-signs' }, [
      U.el('div', {}, [U.el('div', { class: 'sign-line' }), U.el('div', { class: 'sign-label', text: t('doc_sig_customer') })]),
      U.el('div', {}, [U.el('div', { class: 'sign-line' }), U.el('div', { class: 'sign-label', text: t('doc_sig_company') })])
    ]);
  }

  function docTable(headers, rows, footRows) {
    return U.el('table', { class: 'doc-table' }, [
      U.el('thead', {}, U.el('tr', {}, headers.map(function (h) {
        return U.el('th', { class: h.align === 'end' ? 'ta-end' : '', text: h.label });
      }))),
      U.el('tbody', {}, rows.map(function (r) {
        return U.el('tr', {}, r.map(function (cell, i) {
          return U.el('td', { class: headers[i] && headers[i].align === 'end' ? 'ta-end tnum' : '', text: String(cell) });
        }));
      })),
      footRows ? U.el('tfoot', {}, footRows.map(function (r) {
        return U.el('tr', {}, r.map(function (cell, i) {
          return U.el('td', {
            class: (headers[i] && headers[i].align === 'end' ? 'ta-end tnum' : '') + (cell && cell.strong ? ' strong' : ''),
            colspan: cell && cell.colspan ? cell.colspan : null,
            text: cell && cell.text !== undefined ? cell.text : String(cell === null || cell === undefined ? '' : cell)
          });
        }));
      })) : null
    ]);
  }

  const P = {
    amountWords: amountWords,

    /* سند تسليم مواد لنقلة واحدة */
    ticket(l) {
      const c = EX.store.customer(l.customerId);
      const trk = EX.store.truck(l.truckId);
      const v = EX.calc.vat(l.total);
      const unit = EX.views.unitLabel(l.unit);

      const foot = [[{ text: t('total'), colspan: 3 }, U.money(l.total)]];
      if (v.vat) {
        foot.length = 0;
        foot.push([{ text: t('doc_subtotal'), colspan: 3 }, U.money(v.base)]);
        foot.push([{ text: t('doc_vat') + ' ' + U.pct(v.rate, 0), colspan: 3 }, U.money(v.vat)]);
        foot.push([{ text: t('doc_grand'), colspan: 3, strong: true }, { text: U.money(v.total), strong: true }]);
      }

      render(U.el('div', { class: 'doc' }, [
        header(t('doc_ticket_title'), 'ن-' + l.no, l.date),
        U.el('div', { class: 'doc-party' }, [
          kv(t('customer'), c ? c.name : '—'),
          kv(t('phone'), c && c.phone ? U.iso(c.phone) : '—'),
          kv(t('site'), l.site || '—'),
          kv(t('truck'), trk ? U.iso(trk.plate) : '—'),
          kv(t('driver'), trk && trk.driver ? trk.driver : '—'),
          kv(t('payment_type'), t(l.payment === 'cash' ? 'pay_cash' : 'pay_credit'))
        ]),
        docTable([
          { label: t('material') }, { label: t('qty'), align: 'end' },
          { label: t('unit_price'), align: 'end' }, { label: t('total'), align: 'end' }
        ], [[
          EX.store.materialName(l.materialId),
          U.qty(l.qty, unit),
          U.money(l.price),
          U.money(U.num(l.qty) * U.num(l.price))
        ]].concat(U.num(l.discount) ? [[t('discount'), '', '', '-' + U.money(l.discount, { bare: true })]] : []), foot),
        U.el('div', { class: 'doc-words', text: t('doc_amount_words') + ': ' + amountWords(v.total) }),
        l.notes ? U.el('div', { class: 'doc-notes', text: t('notes') + ': ' + l.notes }) : null,
        signatures(),
        U.el('div', { class: 'doc-foot', text: t('doc_thanks') })
      ]));
    },

    /* سند قبض */
    receipt(p) {
      const c = EX.store.customer(p.customerId);
      const bal = EX.calc.customerBalance(p.customerId);
      render(U.el('div', { class: 'doc' }, [
        header(t('doc_receipt_title'), 'ق-' + String(p.id).slice(-5).toUpperCase(), p.date),
        U.el('div', { class: 'doc-party' }, [
          kv(t('doc_received_from'), c ? c.name : '—'),
          kv(t('phone'), c && c.phone ? U.iso(c.phone) : '—'),
          kv(t('method'), t('m_' + p.method)),
          kv(t('ref'), p.ref ? U.iso(p.ref) : '—')
        ]),
        U.el('div', { class: 'doc-amount' }, [
          U.el('span', { class: 'k', text: t('amount') }),
          U.el('span', { class: 'big tnum', text: U.money(p.amount) })
        ]),
        U.el('div', { class: 'doc-words', text: amountWords(p.amount) }),
        U.el('div', { class: 'doc-party' }, [kv(t('balance') + ' بعد الدفعة', U.money(bal))]),
        p.notes ? U.el('div', { class: 'doc-notes', text: t('notes') + ': ' + p.notes }) : null,
        signatures(),
        U.el('div', { class: 'doc-foot', text: t('doc_thanks') })
      ]));
    },

    /* كشف حساب عميل */
    statement(c, st, range) {
      const rows = st.rows.map(function (r) {
        return [U.fmtDate(r.date), r.ref || '—', r.desc,
          r.debit ? U.money(r.debit, { bare: true }) : '—',
          r.credit ? U.money(r.credit, { bare: true }) : '—',
          U.money(r.balance, { bare: true })];
      });
      render(U.el('div', { class: 'doc' }, [
        header(t('doc_statement_title'), null, U.today()),
        U.el('div', { class: 'doc-party' }, [
          kv(t('customer'), c.name),
          kv(t('phone'), c.phone ? U.iso(c.phone) : '—'),
          kv(t('area'), c.area || '—'),
          kv(t('period'), (range && range.from ? U.fmtDate(range.from) : '—') + ' → ' + U.fmtDate((range && range.to) || U.today()))
        ]),
        docTable([
          { label: t('date') }, { label: t('ref') }, { label: t('notes') },
          { label: t('debit'), align: 'end' }, { label: t('credit_col'), align: 'end' }, { label: t('running'), align: 'end' }
        ], [[U.fmtDate((range && range.from) || ''), '—', t('doc_prev_balance'), '—', '—', U.money(st.opening, { bare: true })]].concat(rows), [
          [{ text: t('doc_closing'), colspan: 3, strong: true },
            { text: U.money(U.sum(st.rows, function (r) { return r.debit; }), { bare: true }) },
            { text: U.money(U.sum(st.rows, function (r) { return r.credit; }), { bare: true }) },
            { text: U.money(st.closing, { bare: true }), strong: true }]
        ]),
        U.el('div', { class: 'doc-words', text: t('doc_grand') + ': ' + amountWords(st.closing) }),
        signatures(),
        U.el('div', { class: 'doc-foot', text: t('doc_thanks') })
      ]));
    },

    /* تقرير الفترة */
    report(from, to) {
      const s = EX.calc.summary(from, to);
      const byMat = EX.calc.breakdown(s.loads, 'materialId');
      const byCust = EX.calc.breakdown(s.loads, 'customerId').slice(0, 15);
      const exps = EX.calc.expenseBreakdown(s.expenses);
      const aging = EX.calc.aging();

      render(U.el('div', { class: 'doc' }, [
        header(t('reports_title'), null, U.today()),
        U.el('div', { class: 'doc-party' }, [
          kv(t('period'), U.fmtDate(from) + ' → ' + U.fmtDate(to)),
          kv(t('loads_count'), U.iso(String(s.trips))),
          kv(t('qty'), EX.calc.qtyLabel(s.qty))
        ]),
        U.el('div', { class: 'doc-sub', text: t('summary') }),
        docTable([{ label: t('summary') }, { label: t('amount'), align: 'end' }], [
          [t('gross_revenue'), U.money(s.revenue, { bare: true })],
          [t('pay_cash'), U.money(s.cashLoads, { bare: true })],
          [t('pay_credit'), U.money(s.creditLoads, { bare: true })],
          [t('payments_title'), U.money(s.paymentsTotal, { bare: true })],
          [t('collected'), U.money(s.collected, { bare: true })],
          [t('total_expenses'), U.money(s.expensesTotal, { bare: true })],
          [t('avg_load'), U.money(s.avgLoad, { bare: true })],
          [t('avg_price_ton'), U.money(s.avgPricePerTon, { bare: true })]
        ], [[{ text: t('net_profit'), strong: true }, { text: U.money(s.net, { bare: true }), strong: true }]]),

        U.el('div', { class: 'doc-sub', text: t('by_material') }),
        docTable([
          { label: t('material') }, { label: t('loads_count'), align: 'end' },
          { label: t('sold_qty'), align: 'end' }, { label: t('revenue'), align: 'end' }, { label: t('share'), align: 'end' }
        ], byMat.map(function (r) {
          return [r.label, String(r.trips), EX.calc.qtyLabel(r.qty), U.money(r.revenue, { bare: true }), U.pct(r.share)];
        })),

        U.el('div', { class: 'doc-sub', text: t('by_customer') }),
        docTable([
          { label: t('customer') }, { label: t('loads_count'), align: 'end' },
          { label: t('revenue'), align: 'end' }, { label: t('balance'), align: 'end' }
        ], byCust.map(function (r) {
          return [r.label, String(r.trips), U.money(r.revenue, { bare: true }), U.money(EX.calc.customerBalance(r.key), { bare: true })];
        })),

        U.el('div', { class: 'doc-sub', text: t('expenses_breakdown') }),
        docTable([{ label: t('category') }, { label: t('amount'), align: 'end' }, { label: t('share'), align: 'end' }],
          exps.map(function (r) { return [r.label, U.money(r.amount, { bare: true }), U.pct(r.share)]; })),

        U.el('div', { class: 'doc-sub', text: t('aging') }),
        docTable([
          { label: t('aging_0'), align: 'end' }, { label: t('aging_31'), align: 'end' },
          { label: t('aging_61'), align: 'end' }, { label: t('aging_90'), align: 'end' }, { label: t('total'), align: 'end' }
        ], [[
          U.money(aging.buckets.b0, { bare: true }), U.money(aging.buckets.b31, { bare: true }),
          U.money(aging.buckets.b61, { bare: true }), U.money(aging.buckets.b90, { bare: true }),
          U.money(aging.buckets.total, { bare: true })
        ]]),
        U.el('div', { class: 'doc-foot', text: t('app_name') + ' — ' + U.fmtDate(U.today()) })
      ]));
    }
  };

  EX.print = P;
})(window);
