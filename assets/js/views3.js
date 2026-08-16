/* Asaad Paper Invest — views: Journal, 507 Strategy, News, Alerts */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;
  const UI = AP.ui;
  const t = function (k, p) { return AP.t(k, p); };

  function outcomeBadge(o) {
    const map = { success: ['good', 'success'], fail: ['bad', 'fail'], partial: ['warn', 'partial'], pending: ['', 'pending'] };
    const m = map[o] || ['', 'pending'];
    return U.el('span', { class: 'badge ' + m[0], text: t(m[1]) });
  }

  function followCell(f) {
    if (!f) return U.el('span', { class: 'muted', text: '—' });
    return U.el('div', {}, [
      U.el('div', { class: 'tnum', text: U.money(f.price) }),
      U.el('div', { class: 'tiny ' + U.sign(f.ret), text: U.pct(f.ret) })
    ]);
  }

  /* ---------------- Journal ---------------- */
  AP.views.journal = function (host) {
    const stats = AP.journal.stats();
    const all = AP.journal.entries();

    const summary = U.el('div', { class: 'kpis' }, [
      U.el('div', { class: 'kpi' }, [
        U.el('div', { class: 'kpi-label', text: t('journal_title') }),
        U.el('div', { class: 'kpi-value tnum', text: String(stats.total) })
      ]),
      U.el('div', { class: 'kpi' }, [
        U.el('div', { class: 'kpi-label', text: t('was_successful') }),
        U.el('div', { class: 'kpi-value tnum', text: stats.hitRate === null ? '—' : U.pctPlain(stats.hitRate, 1) }),
        U.el('div', { class: 'kpi-sub', text: stats.graded + ' ' + t('closed_trades') })
      ]),
      U.el('div', { class: 'kpi' }, [
        U.el('div', { class: 'kpi-label', text: t('pending') }),
        U.el('div', { class: 'kpi-value tnum', text: String(stats.pending) })
      ]),
      U.el('div', { class: 'kpi' }, [
        U.el('div', { class: 'kpi-label', text: t('executed') }),
        U.el('div', { class: 'kpi-value tnum', text: String(stats.executedCount) })
      ])
    ]);

    const filterSel = U.el('select', {}, [U.el('option', { value: '', text: t('all') })].concat(
      ['dec_buy', 'dec_scale_in', 'dec_take_profit', 'dec_trim', 'dec_exit', 'dec_none'].map(function (d) {
        return U.el('option', { value: d, text: t(d) });
      })
    ));
    const tableHost = U.el('div', {});

    function renderTable() {
      const f = filterSel.value;
      const list = all.filter(function (e) { return !f || e.decision === f; }).slice(0, 300);
      tableHost.innerHTML = '';
      if (!list.length) { tableHost.appendChild(UI.empty('journal_empty')); return; }
      tableHost.appendChild(UI.table(
        [t('date'), t('symbol'), t('price_at_signal'), t('score'), t('decision'),
          t('after_1d'), t('after_1w'), t('after_1m'), t('was_successful'), t('reasons')],
        list.map(function (e) {
          return [
            e.date,
            e.symbol === '—' ? '—' : U.el('span', { class: 'sym', text: e.symbol }),
            e.price === null ? '—' : U.el('span', { class: 'tnum', text: U.money(e.price) }),
            e.score === null ? '—' : U.el('strong', { class: 'tnum', text: String(e.score) }),
            (function () {
              const wrap = U.el('div', { class: 'row', style: { gap: '5px' } });
              wrap.appendChild(UI.decisionBadge(e.decision));
              if (e.executed) wrap.appendChild(U.el('span', { class: 'badge good', text: t('executed') }));
              return wrap;
            })(),
            followCell(e.followUp && e.followUp.d1),
            followCell(e.followUp && e.followUp.w1),
            followCell(e.followUp && e.followUp.m1),
            e.decision === 'dec_none' ? U.el('span', { class: 'muted', text: '—' }) : outcomeBadge(e.outcome),
            U.el('button', {
              class: 'btn sm ghost', text: t('details'),
              onclick: function () { entryDetail(e); }
            })
          ];
        })
      ));
    }
    filterSel.addEventListener('change', renderTable);
    renderTable();

    host.appendChild(UI.card('journal_title', 'journal_sub', U.el('div', {}, [
      summary,
      U.el('div', { class: 'row', style: { margin: '6px 0 12px' } }, [
        U.el('span', { class: 'small muted', text: t('filter_decision') }),
        (function () { filterSel.style.maxWidth = '220px'; return filterSel; })()
      ]),
      tableHost
    ])));

    function entryDetail(e) {
      const body = U.el('div', {});
      body.appendChild(U.el('div', { class: 'row' }, [
        U.el('span', { class: 'sym', style: { fontSize: '20px' }, text: e.symbol }),
        UI.decisionBadge(e.decision),
        e.score !== null ? U.el('span', { class: 'badge info', text: t('signal_score') + ' ' + e.score }) : null,
        U.el('span', { class: 'badge', text: e.date })
      ]));
      if (e.regime) {
        body.appendChild(U.el('div', { class: 'small muted', style: { marginTop: '6px' }, text: t('market_today') + ': ' + t('market_' + e.regime.label) }));
      }
      body.appendChild(U.el('div', { class: 'card-sub', style: { marginTop: '12px' }, text: t('reasons') }));
      const ul = U.el('ul', { class: 'reason-list' });
      (e.reasons || []).forEach(function (r) { ul.appendChild(U.el('li', { text: AP.signals.reasonText(r) })); });
      body.appendChild(ul);

      if (e.indicators) {
        body.appendChild(U.el('div', { class: 'sep' }));
        body.appendChild(UI.table([t('indicators'), t('value_now')], [
          [t('rsi14'), e.indicators.rsi === null ? '—' : e.indicators.rsi],
          [t('sma20'), e.indicators.sma20 || '—'],
          [t('sma50'), e.indicators.sma50 || '—'],
          [t('sma200'), e.indicators.sma200 || '—'],
          [t('macd_hist'), e.indicators.macdHist === null ? '—' : e.indicators.macdHist],
          [t('atr_pct'), e.indicators.atrPct === null ? '—' : U.pctPlain(e.indicators.atrPct)],
          [t('change_5d'), e.indicators.chg5d === null ? '—' : U.pct(e.indicators.chg5d)],
          [t('from_high'), e.indicators.fromHigh === null ? '—' : U.pct(e.indicators.fromHigh)]
        ]));
      }
      if (e.plan) {
        body.appendChild(U.el('div', { class: 'sep' }));
        body.appendChild(U.el('div', { class: 'card-sub', style: { marginBottom: '8px' }, text: t('plan_title') }));
        const grid = U.el('div', { class: 'planbox' });
        [['entry_price', U.money(e.plan.entry)], ['stop_loss', U.money(e.plan.stop)],
        ['target1', U.money(e.plan.t1)], ['target2', U.money(e.plan.t2)],
        ['rr', e.plan.rr + ' : 1'], ['suggested_alloc', e.size ? U.pctPlain(e.size.pct) : '—']]
          .forEach(function (it) {
            grid.appendChild(U.el('div', { class: 'plan-item' }, [
              U.el('div', { class: 'plan-label', text: t(it[0]) }),
              U.el('div', { class: 'plan-value', text: String(it[1]) })
            ]));
          });
        body.appendChild(grid);
      }
      body.appendChild(U.el('div', { class: 'sep' }));
      body.appendChild(UI.table([t('date'), t('price'), t('pl_pct')], [
        [t('after_1d'), e.followUp.d1 ? U.money(e.followUp.d1.price) : t('pending'), e.followUp.d1 ? U.pct(e.followUp.d1.ret) : '—'],
        [t('after_1w'), e.followUp.w1 ? U.money(e.followUp.w1.price) : t('pending'), e.followUp.w1 ? U.pct(e.followUp.w1.ret) : '—'],
        [t('after_1m'), e.followUp.m1 ? U.money(e.followUp.m1.price) : t('pending'), e.followUp.m1 ? U.pct(e.followUp.m1.ret) : '—']
      ]));
      UI.modal({ title: t('journal_title'), body: body, actions: false });
    }

    // day archive
    const snaps = AP.store.s.snapshots.slice().reverse();
    const archive = snaps.length ? UI.table(
      [t('date'), t('equity'), t('kpi_cash'), t('kpi_invested'), t('market_today'), ''],
      snaps.slice(0, 120).map(function (s) {
        return [
          s.date,
          U.el('span', { class: 'tnum', text: U.money(s.equity) }),
          U.el('span', { class: 'tnum', text: U.money(s.cash) }),
          U.el('span', { class: 'tnum', text: U.money(s.invested) }),
          s.regime ? t('market_' + s.regime) : '—',
          U.el('button', { class: 'btn sm ghost', text: t('view_day'), onclick: function () { dayDetail(s); } })
        ];
      })
    ) : UI.empty('no_data');
    host.appendChild(UI.card('history_title', 'history_sub', archive));

    function dayDetail(s) {
      const body = U.el('div', {});
      body.appendChild(U.el('div', { class: 'row' }, [
        U.el('strong', { text: s.date }),
        s.regime ? U.el('span', { class: 'badge', text: t('market_today') + ': ' + t('market_' + s.regime) }) : null
      ]));
      body.appendChild(U.el('div', { class: 'kpis', style: { marginTop: '10px' } }, [
        U.el('div', { class: 'kpi' }, [U.el('div', { class: 'kpi-label', text: t('equity') }), U.el('div', { class: 'kpi-value tnum', text: U.money(s.equity) })]),
        U.el('div', { class: 'kpi' }, [U.el('div', { class: 'kpi-label', text: t('kpi_cash') }), U.el('div', { class: 'kpi-value tnum', text: U.money(s.cash) })]),
        U.el('div', { class: 'kpi' }, [U.el('div', { class: 'kpi-label', text: t('kpi_invested') }), U.el('div', { class: 'kpi-value tnum', text: U.money(s.invested) })]),
        U.el('div', { class: 'kpi' }, [U.el('div', { class: 'kpi-label', text: t('unrealized_profit') }), U.el('div', { class: 'kpi-value tnum ' + U.sign(s.unrealized), text: U.money(s.unrealized) })])
      ]));

      if (s.scores) {
        body.appendChild(U.el('div', { class: 'card-sub', style: { margin: '12px 0 6px' }, text: t('score') }));
        body.appendChild(UI.table([t('symbol'), t('score'), t('decision'), t('price')],
          Object.keys(s.scores).map(function (sym) {
            const sc = s.scores[sym];
            return [
              U.el('span', { class: 'sym', text: sym }),
              U.el('strong', { class: 'tnum', text: String(sc.score !== undefined ? sc.score : sc) }),
              sc.decision ? UI.decisionBadge(sc.decision) : '—',
              s.prices && s.prices[sym] ? U.money(s.prices[sym]) : '—'
            ];
          }).sort(function (a, b) { return 0; })));
      }
      const dayEntries = AP.journal.entries().filter(function (e) { return e.date === s.date; });
      if (dayEntries.length) {
        body.appendChild(U.el('div', { class: 'card-sub', style: { margin: '12px 0 6px' }, text: t('journal_title') }));
        dayEntries.forEach(function (e) {
          body.appendChild(U.el('div', { class: 'notice' }, [
            U.el('div', {}, [
              U.el('div', { class: 'row' }, [
                U.el('span', { class: 'sym', text: e.symbol }),
                UI.decisionBadge(e.decision),
                e.score !== null ? U.el('span', { class: 'badge info', text: String(e.score) }) : null
              ]),
              U.el('div', { class: 'tiny muted', style: { marginTop: '4px' }, text: (e.reasons || []).slice(0, 3).map(function (r) { return AP.signals.reasonText(r); }).join(' · ') })
            ])
          ]));
        });
      }
      UI.modal({ title: t('view_day') + ' — ' + s.date, body: body, actions: false });
    }
  };

  /* ---------------- 507 Strategy ---------------- */
  AP.views.s507 = function (host) {
    const st = AP.store.settings();
    const res = AP.s507.ensure();

    const omrIn = U.el('input', { type: 'number', step: '1', value: st.monthlyOmr });
    const fxIn = U.el('input', { type: 'number', step: '0.0001', value: st.fxOmrUsd });
    const usdOut = U.el('div', { class: 'kpi-value tnum', text: U.money(AP.s507.monthlyUsd()) });

    function recalc() {
      st.monthlyOmr = U.num(omrIn.value, 507);
      st.fxOmrUsd = U.num(fxIn.value, 2.6);
      AP.store.save();
      usdOut.textContent = U.money(AP.s507.monthlyUsd());
    }
    omrIn.addEventListener('change', recalc);
    fxIn.addEventListener('change', recalc);

    const controls = U.el('div', {}, [
      U.el('div', { class: 'form-row' }, [
        U.el('div', { class: 'field' }, [U.el('label', { text: t('omr_monthly') }), omrIn]),
        U.el('div', { class: 'field' }, [U.el('label', { text: t('fx_rate') }), fxIn])
      ]),
      U.el('div', { class: 'kpi' }, [
        U.el('div', { class: 'kpi-label', text: t('monthly_usd') }),
        usdOut
      ]),
      U.el('div', { class: 'row', style: { marginTop: '12px' } }, [
        U.el('button', {
          class: 'btn primary', text: t('s507_run'),
          onclick: function () { recalc(); AP.s507.run(); UI.renderView(); UI.toast(t('s507_run') + ' ✓', 'good'); }
        })
      ]),
      U.el('div', { class: 'hint', text: t('s507_note') })
    ]);
    host.appendChild(UI.card('s507_title', 's507_sub', controls));

    const P = AP.charts.palette();
    const colors = { A: P.s1, B: P.s2, C: P.s3 };

    const cards = U.el('div', { class: 'grid3' });
    ['A', 'B', 'C'].forEach(function (k) {
      const s = res[k];
      const dot = U.el('span', { class: 'legend-swatch' });
      dot.style.background = colors[k];
      const holdings = Object.keys(s.holdings);
      cards.appendChild(U.el('div', { class: 'card' }, [
        U.el('div', { class: 'row' }, [dot, U.el('div', { class: 'card-title', text: t(s.nameKey) }),
          res.best === k ? U.el('span', { class: 'badge good', text: '★' }) : null]),
        U.el('div', { class: 'tiny muted', style: { marginTop: '4px' }, text: t(s.descKey) }),
        U.el('div', { class: 'sep' }),
        U.el('div', { class: 'stack' }, [
          U.el('div', { class: 'row' }, [U.el('span', { class: 'small muted', text: t('contributed') }),
            U.el('span', { class: 'tnum', style: { marginInlineStart: 'auto' }, text: U.money(s.contributed) })]),
          U.el('div', { class: 'row' }, [U.el('span', { class: 'small muted', text: t('current_value') }),
            U.el('span', { class: 'tnum', style: { marginInlineStart: 'auto', fontWeight: '700' }, text: U.money(s.value) })]),
          U.el('div', { class: 'row' }, [U.el('span', { class: 'small muted', text: t('gain') }),
            U.el('span', { class: 'tnum ' + U.sign(s.gain), style: { marginInlineStart: 'auto' }, text: U.money(s.gain) + ' (' + U.pct(s.gainPct) + ')' })]),
          s.cash > 0 ? U.el('div', { class: 'row' }, [U.el('span', { class: 'small muted', text: t('s507_cash_waiting') }),
            U.el('span', { class: 'tnum', style: { marginInlineStart: 'auto' }, text: U.money(s.cash) })]) : null
        ]),
        holdings.length ? U.el('div', {}, [
          U.el('div', { class: 'sep' }),
          U.el('div', { class: 'tiny muted', text: t('s507_holdings') }),
          U.el('div', { class: 'small' }, holdings.map(function (h) {
            return U.el('div', { class: 'row' }, [
              U.el('span', { class: 'sym', text: h }),
              U.el('span', { class: 'tnum muted', style: { marginInlineStart: 'auto' }, text: U.qty(s.holdings[h]) + ' ' + t('shares') })
            ]);
          }))
        ]) : null
      ]));
    });
    host.appendChild(cards);

    const cmpHost = U.el('div', {});
    const cmpLegend = U.el('div', {});
    host.appendChild(UI.card('s507_compare', null, U.el('div', {}, [
      cmpHost, cmpLegend,
      U.el('div', { class: 'sep' }),
      UI.table([t('strategy'), t('contributed'), t('current_value'), t('gain'), t('total_return')],
        ['A', 'B', 'C'].map(function (k) {
          const s = res[k];
          return [
            U.el('span', { text: t(s.nameKey), style: res.best === k ? { fontWeight: '700' } : {} }),
            U.el('span', { class: 'tnum', text: U.money(s.contributed) }),
            U.el('span', { class: 'tnum', text: U.money(s.value) }),
            U.el('span', { class: 'tnum ' + U.sign(s.gain), text: U.money(s.gain) }),
            U.el('span', { class: 'tnum ' + U.sign(s.gainPct), text: U.pct(s.gainPct) })
          ];
        }))
    ])));
    setTimeout(function () {
      const series = ['A', 'B', 'C'].map(function (k) {
        return { label: t(res[k].nameKey), color: colors[k], points: res[k].series };
      });
      AP.charts.line(cmpHost, { height: 240, series: series, area: false });
      cmpLegend.innerHTML = '';
      const lg = U.el('div', { class: 'legend' });
      ['A', 'B', 'C'].forEach(function (k) {
        const sw = U.el('span', { class: 'legend-swatch' });
        sw.style.background = colors[k];
        lg.appendChild(U.el('span', { class: 'legend-item' }, [
          sw, U.el('span', { text: t(res[k].nameKey) }),
          U.el('span', { class: 'legend-val ' + U.sign(res[k].gainPct), text: U.pct(res[k].gainPct) })
        ]));
      });
      cmpLegend.appendChild(lg);
    }, 0);

    // contributions log
    const logRows = [];
    ['A', 'B', 'C'].forEach(function (k) {
      (res[k].log || []).forEach(function (l) {
        logRows.push([t(res[k].nameKey), l.date, l.symbol, l.price ? U.money(l.price) : '—',
          U.qty(l.shares), U.money(l.amount)]);
      });
      (res[k].deployments || []).forEach(function (l) {
        logRows.push([t(res[k].nameKey) + ' ▸', l.date, l.symbol, U.money(l.price), U.qty(l.shares), U.money(l.amount)]);
      });
    });
    host.appendChild(UI.card('s507_contrib_log', null, logRows.length
      ? UI.table([t('strategy'), t('date'), t('symbol'), t('price'), t('shares'), t('amount')], logRows)
      : UI.empty('no_data')));
  };

  /* ---------------- News ---------------- */
  AP.views.news = function (host) {
    const items = AP.news.all();

    const addBtn = U.el('button', {
      class: 'btn sm', text: '+ ' + t('add_news'),
      onclick: function () {
        const symSel = U.el('select', {}, [U.el('option', { value: 'MARKET', text: 'MARKET' })].concat(
          AP.store.symbols().map(function (s) { return U.el('option', { value: s, text: s }); })));
        const titleIn = U.el('input', { type: 'text' });
        const sumIn = U.el('textarea', { rows: '3' });
        const sentSel = U.el('select', {}, [
          U.el('option', { value: '', text: t('unknown') }),
          U.el('option', { value: 'positive', text: t('positive') }),
          U.el('option', { value: 'neutral', text: t('neutral') }),
          U.el('option', { value: 'negative', text: t('negative') })
        ]);
        const dateIn = U.el('input', { type: 'date', value: U.today() });
        const body = U.el('div', {}, [
          U.el('div', { class: 'form-row' }, [
            U.el('div', { class: 'field' }, [U.el('label', { text: t('symbol') }), symSel]),
            U.el('div', { class: 'field' }, [U.el('label', { text: t('date') }), dateIn])
          ]),
          U.el('div', { class: 'field' }, [U.el('label', { text: t('news_title_field') }), titleIn]),
          U.el('div', { class: 'field' }, [U.el('label', { text: t('news_summary_field') }), sumIn]),
          U.el('div', { class: 'field' }, [U.el('label', { text: t('sentiment') }), sentSel])
        ]);
        UI.modal({
          title: t('add_news'), body: body, confirmText: t('add'),
          onConfirm: function () {
            if (!titleIn.value.trim()) { UI.toast(t('err_invalid'), 'bad'); return false; }
            AP.news.add({
              symbol: symSel.value, title: titleIn.value, summary: sumIn.value,
              sentiment: sentSel.value || null, date: dateIn.value, source: 'manual'
            });
            AP.app.rescan();
            UI.renderShell();
            UI.toast(t('add') + ' ✓', 'good');
          }
        });
      }
    });

    const list = U.el('div', {});
    if (!items.length) list.appendChild(UI.empty('news_empty'));
    items.slice(0, 80).forEach(function (n) {
      list.appendChild(U.el('div', { class: 'alert-item' }, [
        U.el('span', {
          class: 'alert-icon ' + (n.sentiment === 'positive' ? 'good' : n.sentiment === 'negative' ? 'bad' : 'info'),
          text: n.sentiment === 'positive' ? '▲' : n.sentiment === 'negative' ? '▼' : '■'
        }),
        U.el('div', { class: 'alert-body' }, [
          U.el('div', { class: 'row' }, [
            U.el('span', { class: 'sym', text: n.symbol }),
            U.el('span', {
              class: 'badge ' + (n.sentiment === 'positive' ? 'good' : n.sentiment === 'negative' ? 'bad' : ''),
              text: t(n.sentiment)
            }),
            U.el('span', { class: 'tiny muted', text: n.date + ' · ' + n.source })
          ]),
          n.url
            ? U.el('a', { href: n.url, target: '_blank', rel: 'noopener noreferrer', text: n.title, style: { display: 'block', marginTop: '4px' } })
            : U.el('div', { style: { marginTop: '4px' }, text: n.title }),
          U.el('div', { class: 'tiny muted', style: { marginTop: '4px' } }, [
            U.el('strong', { text: t('impact') + ': ' }),
            U.el('span', { text: AP.news.impactText(n) })
          ])
        ]),
        U.el('button', {
          class: 'btn sm ghost', text: '✕',
          onclick: function () { AP.news.remove(n.id); AP.app.rescan(); UI.renderView(); }
        })
      ]));
    });

    host.appendChild(U.el('div', { class: 'notice info', text: t('news_disclaimer') }));
    host.appendChild(UI.card('news_title', 'news_sub', list, addBtn));
  };

  /* ---------------- Alerts ---------------- */
  AP.views.alerts = function (host) {
    const alerts = AP.store.s.alerts;
    const actions = U.el('div', { class: 'row' }, [
      U.el('button', { class: 'btn sm', text: t('mark_all_read'), onclick: function () { AP.alerts.markAllRead(); UI.renderShell(); } }),
      U.el('button', { class: 'btn sm ghost', text: t('clear_alerts'), onclick: function () { AP.alerts.clear(); UI.renderShell(); } })
    ]);

    const list = U.el('div', {});
    if (!alerts.length) list.appendChild(UI.empty('alerts_empty'));
    alerts.slice(0, 150).forEach(function (a) {
      const icon = { good: '▲', bad: '▼', warn: '!', info: 'i' }[a.severity] || 'i';
      list.appendChild(U.el('div', { class: 'alert-item' + (a.read ? '' : ' unread') }, [
        U.el('span', { class: 'alert-icon ' + (a.severity || 'info'), text: icon }),
        U.el('div', { class: 'alert-body' }, [
          U.el('div', { text: AP.alerts.text(a) }),
          U.el('div', { class: 'alert-time', text: U.fmtTime(a.ts, AP.i18n.lang) })
        ]),
        a.symbol ? U.el('button', {
          class: 'btn sm ghost', text: t('details'),
          onclick: function () { if (AP.store.symbols().indexOf(a.symbol) >= 0) UI.assetDetail(a.symbol); }
        }) : null
      ]));
    });

    host.appendChild(UI.card('alerts_title', null, list, actions));
    if (alerts.some(function (a) { return !a.read; })) {
      setTimeout(function () {
        AP.store.s.alerts.forEach(function (a) { a.read = true; });
        AP.store.save();
      }, 1500);
    }
  };
})(window);
