/* Asaad Paper Invest — views: Today & Opportunities */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;
  const UI = AP.ui;
  const t = function (k, p) { return AP.t(k, p); };

  function regimeColor(label) {
    return label === 'positive' ? 'var(--good)' : label === 'negative' ? 'var(--critical)' : 'var(--warning)';
  }

  function reasonsList(ev, limit) {
    const seen = {};
    const items = [];
    (ev.reasons || []).forEach(function (r) {
      const txt = AP.signals.reasonText(r);
      if (!txt || seen[txt]) return;
      seen[txt] = 1;
      items.push(txt);
    });
    const ul = U.el('ul', { class: 'reason-list' });
    items.slice(0, limit || 8).forEach(function (x) { ul.appendChild(U.el('li', { text: x })); });
    return ul;
  }

  function planGrid(ev) {
    if (!ev.plan) return U.el('div', { class: 'hint', text: t('no_data') });
    const p = ev.plan;
    const items = [
      ['entry_price', U.money(p.entry)],
      ['entry_zone', U.iso(U.money(p.zoneLow) + ' – ' + U.money(p.zoneHigh))],
      ['stop_loss', U.money(p.stop)],
      ['target1', U.money(p.t1)],
      ['target2', U.money(p.t2)],
      ['rr', U.iso(U.round(p.rr, 2) + ' : 1')],
      ['suggested_alloc', U.pctPlain(ev.size.pct) + ' (' + U.iso('≤ ' + ev.size.cap + '%') + ')'],
      ['suggested_amount', U.money(ev.size.amount) + ' · ' + U.qty(ev.size.shares) + ' ' + t('shares')]
    ];
    const grid = U.el('div', { class: 'planbox' });
    items.forEach(function (it) {
      grid.appendChild(U.el('div', { class: 'plan-item' }, [
        U.el('div', { class: 'plan-label', text: t(it[0]) }),
        U.el('div', { class: 'plan-value', text: it[1] })
      ]));
    });
    return grid;
  }

  function checklistBlock(ev) {
    if (!ev.checklist || !ev.checklist.length) return null;
    const box = U.el('div', { class: 'check-list' });
    ev.checklist.forEach(function (c) {
      box.appendChild(U.el('div', { class: 'check-item' }, [
        U.el('span', { class: 'check-mark ' + (c.ok ? 'ok' : 'no'), text: c.ok ? '✓' : '✕' }),
        U.el('span', { class: 'check-q', text: t(c.q) }),
        c.noAnswer ? null : U.el('span', {
          class: 'badge ' + (c.ok ? 'good' : 'bad'),
          text: t(c.answer || (c.ok ? 'yes' : 'no'))
        }),
        U.el('span', { class: 'check-v', text: String(c.val) })
      ]));
    });
    return box;
  }

  /* ---------------- asset detail modal ---------------- */
  UI.assetDetail = function (symbol) {
    const scan = AP.app.currentScan();
    const ev = scan.evals.find(function (e) { return e.symbol === symbol; }) ||
      AP.signals.evaluate(symbol, scan.regime);
    const body = U.el('div', {});

    body.appendChild(U.el('div', { class: 'row' }, [
      UI.symbolCell(symbol),
      U.el('div', { style: { marginInlineStart: 'auto' }, class: 'end' }, [
        U.el('div', { class: 'pick-price', text: U.money(ev.ind ? ev.ind.price : AP.store.lastPrice(symbol)) }),
        ev.ind ? U.el('div', { class: 'small ' + U.sign(ev.ind.chg1d), text: U.pct(ev.ind.chg1d) }) : null
      ])
    ]));

    if (!ev.ok) {
      body.appendChild(UI.empty('not_enough_history'));
      UI.modal({ title: symbol, body: body, actions: false });
      return;
    }

    const ringHost = U.el('div', { style: { width: '120px' } });
    body.appendChild(U.el('div', { class: 'row', style: { marginTop: '10px', alignItems: 'center' } }, [
      ringHost,
      U.el('div', { style: { flex: '1', minWidth: '160px' } }, [
        U.el('div', { class: 'row' }, [UI.bandBadge(ev), UI.decisionBadge(ev.decision),
          U.el('span', { class: 'badge', text: t('confidence') + ': ' + t(ev.confidence) })]),
        U.el('div', { class: 'small muted', style: { marginTop: '6px' }, text: t('signal_score') })
      ])
    ]));
    setTimeout(function () { AP.charts.ring(ringHost, ev.score, { size: 116 }); }, 0);

    // price chart
    const chartHost = U.el('div', { style: { marginTop: '12px' } });
    body.appendChild(U.el('div', { class: 'card-sub', text: t('price_chart') }));
    body.appendChild(chartHost);
    setTimeout(function () {
      const bars = AP.market.seriesWithManual(symbol).slice(-180);
      AP.charts.line(chartHost, {
        height: 190,
        series: [{ label: symbol, color: AP.charts.palette().s1, points: bars.map(function (b) { return { d: b.d, v: b.c }; }) }]
      });
    }, 0);

    // score breakdown
    body.appendChild(U.el('div', { class: 'sep' }));
    body.appendChild(U.el('div', { class: 'card-sub', style: { marginBottom: '8px' }, text: t('score_breakdown') }));
    const meterHost = U.el('div', {});
    body.appendChild(meterHost);
    AP.charts.meters(meterHost, [
      { label: t('comp_trend'), value: ev.components.trend, weight: ev.weights.trend },
      { label: t('comp_momentum'), value: ev.components.momentum, weight: ev.weights.momentum },
      { label: t('comp_valuation'), value: ev.components.valuation, weight: ev.weights.valuation },
      { label: t('comp_volatility'), value: ev.components.volatility, weight: ev.weights.volatility },
      { label: t('comp_market'), value: ev.components.market, weight: ev.weights.market },
      { label: t('comp_news'), value: ev.components.news, weight: ev.weights.news },
      { label: t('comp_rr'), value: ev.components.rr, weight: ev.weights.rr }
    ]);

    // indicators table
    const a = ev.ind;
    function row(k, v) { return [t(k), v]; }
    const rows = [
      row('last_price', U.money(a.price)),
      row('change_1d', U.pct(a.chg1d)),
      row('change_5d', a.chg5d === null ? '—' : U.pct(a.chg5d)),
      row('change_1m', a.chg1m === null ? '—' : U.pct(a.chg1m)),
      row('change_3m', a.chg3m === null ? '—' : U.pct(a.chg3m)),
      row('volume', a.volume ? Math.round(a.volume).toLocaleString('en-US') : '—'),
      row('avg_volume', a.avgVolume ? Math.round(a.avgVolume).toLocaleString('en-US') : '—'),
      row('sma20', a.sma20 ? U.money(a.sma20) : '—'),
      row('sma50', a.sma50 ? U.money(a.sma50) : '—'),
      row('sma200', a.sma200 ? U.money(a.sma200) : '—'),
      row('ema20', a.ema20 ? U.money(a.ema20) : '—'),
      row('rsi14', a.rsi === null ? '—' : U.round(a.rsi, 1)),
      row('macd', a.macd ? U.round(a.macd.macd, 3) : '—'),
      row('macd_signal', a.macd ? U.round(a.macd.signal, 3) : '—'),
      row('macd_hist', a.macd ? U.round(a.macd.hist, 3) : '—'),
      row('bb_upper', a.bb ? U.money(a.bb.upper) : '—'),
      row('bb_lower', a.bb ? U.money(a.bb.lower) : '—'),
      row('bb_pos', a.bb ? U.pctPlain(a.bb.pctB * 100) : '—'),
      row('atr', a.atr ? U.round(a.atr, 2) : '—'),
      row('atr_pct', a.atrPct === null ? '—' : U.pctPlain(a.atrPct)),
      row('volatility', a.volatility === null ? '—' : U.pctPlain(a.volatility)),
      row('support', a.support ? U.money(a.support) : '—'),
      row('resistance', a.resistance ? U.money(a.resistance) : '—'),
      row('w52_high', a.high52 ? U.money(a.high52) : '—'),
      row('w52_low', a.low52 ? U.money(a.low52) : '—'),
      row('from_high', a.fromHigh === null ? '—' : U.pct(a.fromHigh)),
      row('sector', AP.store.meta(symbol).sector || '—'),
      row('earnings_next', AP.store.s.earnings[symbol] || t('unknown'))
    ];
    body.appendChild(U.el('div', { class: 'sep' }));
    body.appendChild(U.el('div', { class: 'card-sub', style: { marginBottom: '6px' }, text: t('indicators') }));
    body.appendChild(UI.table([t('name'), t('value_now')], rows));

    body.appendChild(U.el('div', { class: 'sep' }));
    body.appendChild(U.el('div', { class: 'card-sub', text: t('reasons') }));
    body.appendChild(reasonsList(ev, 12));

    body.appendChild(U.el('div', { class: 'sep' }));
    body.appendChild(U.el('div', { class: 'card-sub', style: { marginBottom: '8px' }, text: t('plan_title') }));
    body.appendChild(planGrid(ev));

    const cl = checklistBlock(ev);
    if (cl) {
      body.appendChild(U.el('div', { class: 'sep' }));
      body.appendChild(U.el('div', { class: 'card-sub', style: { marginBottom: '8px' }, text: t('checklist') }));
      body.appendChild(cl);
    }

    const news = AP.news.forSymbol(symbol).slice(0, 4);
    if (news.length) {
      body.appendChild(U.el('div', { class: 'sep' }));
      body.appendChild(U.el('div', { class: 'card-sub', style: { marginBottom: '6px' }, text: t('news_title') }));
      news.forEach(function (n) {
        body.appendChild(U.el('div', { class: 'notice' }, [
          U.el('span', { class: 'badge ' + (n.sentiment === 'positive' ? 'good' : n.sentiment === 'negative' ? 'bad' : ''), text: t(n.sentiment) }),
          U.el('div', {}, [
            U.el('div', { text: n.title }),
            U.el('div', { class: 'tiny muted', text: AP.news.impactText(n) })
          ])
        ]));
      });
    }

    body.appendChild(U.el('div', { class: 'notice info', style: { marginTop: '12px' }, text: t('prob_note') }));

    const actions = U.el('div', { class: 'row', style: { marginTop: '12px' } }, [
      U.el('button', {
        class: 'btn primary', text: t('buy'),
        onclick: function () {
          m.close();
          UI.tradeModal(symbol, 'BUY', {
            price: a.price, amount: ev.size.amount, score: ev.score,
            decision: ev.decision, plan: ev.plan
          });
        }
      }),
      AP.portfolio.positionOf(symbol) ? U.el('button', {
        class: 'btn', text: t('sell'),
        onclick: function () { m.close(); UI.tradeModal(symbol, 'SELL', { price: a.price, score: ev.score, decision: ev.decision }); }
      }) : null,
      U.el('button', {
        class: 'btn ghost', text: t('log_only'),
        onclick: function () {
          AP.journal.add(ev, { regime: { label: AP.app.currentScan().regime.label } });
          AP.store.save();
          UI.toast(t('journal_title') + ' ✓', 'good');
        }
      })
    ]);
    body.appendChild(actions);

    const m = UI.modal({ title: symbol + ' · ' + AP.store.assetName(symbol), body: body, actions: false });
  };

  /* ---------------- Today ---------------- */
  AP.views.today = function (host) {
    const scan = AP.app.currentScan();
    const regime = scan.regime;

    // data status
    const meta = AP.store.s.meta;
    const statusRow = U.el('div', { class: 'row', style: { marginBottom: '12px' } }, [
      UI.dataBadge(),
      U.el('span', { class: 'small muted', text: t('last_update') + ': ' + (meta.lastRefresh ? U.fmtTime(meta.lastRefresh, AP.i18n.lang) : t('never')) }),
      U.el('button', { class: 'btn sm', text: t('refresh'), onclick: function () { AP.app.refresh(true); } })
    ]);
    host.appendChild(statusRow);

    if (AP.store.s.meta.dataMode === 'demo') {
      host.appendChild(U.el('div', { class: 'notice warn' }, [
        U.el('span', { text: '⚠' }),
        U.el('div', {
          text: AP.i18n.lang === 'ar'
            ? 'تعذّر جلب بيانات السوق الحقيقية، ويعمل النظام الآن على سلسلة أسعار محاكاة داخلية. الأرقام صالحة لاختبار المنصة فقط. اضبط وسيط البيانات من الإعدادات للحصول على أسعار حقيقية.'
            : 'Live market data could not be fetched, so the system is running on an internal simulated price series. Figures are valid for testing the platform only. Configure a data proxy in Settings for real prices.'
        })
      ]));
    }

    // hero
    const hero = U.el('section', { class: 'today-hero' });
    hero.appendChild(U.el('h2', { class: 'card-title', style: { fontSize: '19px' }, text: t('today_title') }));
    const dot = U.el('span', { class: 'regime-dot' });
    dot.style.background = regimeColor(regime.label);
    hero.appendChild(U.el('div', { class: 'regime-row', style: { marginTop: '10px' } }, [
      dot,
      U.el('strong', { text: t('market_today') + ': ' + t('market_' + regime.label) }),
      U.el('span', { class: 'badge', text: t('bench_spx') + ' ' + regime.proxy }),
      U.el('span', { class: 'small muted', text: U.pctPlain(regime.breadth, 0) + ' ' + (AP.i18n.lang === 'ar' ? 'من الأصول فوق SMA200' : 'of assets above SMA200') })
    ]));
    hero.appendChild(U.el('div', { class: 'tiny muted', text: t('market_basis') }));
    hero.appendChild(U.el('div', { class: 'sep' }));

    hero.appendChild(U.el('div', { class: 'card-sub', style: { marginBottom: '10px' }, text: t('best_opportunity') }));

    if (!scan.pick) {
      hero.appendChild(U.el('div', { class: 'empty' }, [
        U.el('div', { style: { fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }, text: t('no_trade_today') }),
        U.el('div', { style: { marginTop: '6px' }, text: t('no_trade_reason') })
      ]));
    } else {
      const ev = scan.pick;
      const ringHost = U.el('div', { style: { width: '120px', flex: '0 0 auto' } });
      const head = U.el('div', { class: 'pick-head' }, [
        U.el('div', { class: 'pick-main' }, [
          U.el('div', { class: 'row' }, [
            U.el('span', { class: 'pick-symbol', text: ev.symbol }),
            UI.bandBadge(ev),
            UI.decisionBadge(ev.decision)
          ]),
          U.el('div', { class: 'muted small', text: AP.store.assetName(ev.symbol) + ' · ' + t(AP.store.isEtf(ev.symbol) ? 'type_etf' : 'type_stock') }),
          U.el('div', { class: 'row', style: { marginTop: '8px' } }, [
            U.el('span', { class: 'pick-price', text: U.money(ev.ind.price) }),
            U.el('span', { class: U.sign(ev.ind.chg1d) + ' small', text: U.pct(ev.ind.chg1d) }),
            U.el('span', { class: 'badge', text: t('confidence') + ': ' + t(ev.confidence) })
          ])
        ]),
        ringHost
      ]);
      hero.appendChild(head);
      setTimeout(function () { AP.charts.ring(ringHost, ev.score, { size: 116 }); }, 0);

      hero.appendChild(U.el('div', { class: 'card-sub', style: { marginTop: '12px' }, text: t('reasons') }));
      hero.appendChild(reasonsList(ev, 7));

      hero.appendChild(U.el('div', { class: 'card-sub', style: { marginTop: '14px' }, text: t('plan_title') }));
      hero.appendChild(planGrid(ev));

      hero.appendChild(U.el('div', { class: 'row', style: { marginTop: '14px' } }, [
        U.el('button', {
          class: 'btn primary', text: t('execute_paper'),
          onclick: function () {
            const entry = AP.journal.add(ev, { regime: { label: regime.label } });
            AP.store.save();
            UI.tradeModal(ev.symbol, 'BUY', {
              price: ev.ind.price, amount: ev.size.amount, score: ev.score,
              decision: ev.decision, plan: ev.plan, journalId: entry ? entry.id : null
            });
          }
        }),
        U.el('button', {
          class: 'btn', text: t('details'),
          onclick: function () { UI.assetDetail(ev.symbol); }
        }),
        U.el('button', {
          class: 'btn ghost', text: t('log_only'),
          onclick: function () {
            AP.journal.add(ev, { regime: { label: regime.label } });
            AP.store.save();
            UI.toast(t('journal_title') + ' ✓', 'good');
          }
        })
      ]));
      hero.appendChild(U.el('div', { class: 'tiny muted', style: { marginTop: '10px' }, text: t('prob_note') }));
    }
    host.appendChild(hero);

    // checklist for the pick (or for the top-ranked asset)
    const clSource = scan.pick || scan.evals.find(function (e) { return e.ok; });
    if (clSource && clSource.checklist && clSource.checklist.length) {
      host.appendChild(UI.card(t('checklist') + ' — ' + clSource.symbol, null, checklistBlock(clSource)));
    }

    // actions on holdings
    const acts = scan.holdingActions;
    const actNode = acts.length ? (function () {
      const rows = acts.map(function (e) {
        const pos = AP.portfolio.summary().positions[e.symbol];
        return [
          UI.symbolCell(e.symbol),
          U.el('span', { class: 'tnum', text: U.money(e.ind.price) }),
          U.el('span', { class: 'tnum ' + (pos ? U.sign(pos.pl) : ''), text: pos ? U.pct(pos.plPct) : '—' }),
          String(e.score),
          UI.decisionBadge(e.decision),
          U.el('div', { class: 'row' }, [
            U.el('button', { class: 'btn sm', text: t('sell'), onclick: function () { UI.tradeModal(e.symbol, 'SELL', { price: e.ind.price, score: e.score, decision: e.decision }); } }),
            U.el('button', { class: 'btn sm ghost', text: t('details'), onclick: function () { UI.assetDetail(e.symbol); } })
          ])
        ];
      });
      return UI.table([t('symbol'), t('last_price'), t('pl_pct'), t('score'), t('decision'), t('actions')], rows);
    })() : UI.empty('no_holdings_actions');
    host.appendChild(UI.card('holdings_actions', null, actNode));

    // other candidates
    const others = scan.evals.filter(function (e) { return e.ok && (!scan.pick || e.symbol !== scan.pick.symbol); }).slice(0, 5);
    if (others.length) {
      const rows = others.map(function (e) {
        return [
          UI.symbolCell(e.symbol),
          U.el('span', { class: 'tnum', text: U.money(e.ind.price) }),
          U.el('span', { class: 'tnum ' + U.sign(e.ind.chg1d), text: U.pct(e.ind.chg1d) }),
          U.el('strong', { class: 'tnum', text: String(e.score) }),
          UI.bandBadge(e),
          UI.decisionBadge(e.decision),
          U.el('button', { class: 'btn sm ghost', text: t('details'), onclick: function () { UI.assetDetail(e.symbol); } })
        ];
      });
      host.appendChild(UI.card('other_candidates', null,
        UI.table([t('symbol'), t('last_price'), t('change_1d'), t('score'), t('signal'), t('decision'), ''], rows)));
    }
  };

  /* ---------------- Opportunities ---------------- */
  AP.views.opportunities = function (host) {
    const scan = AP.app.currentScan();

    const addBtn = U.el('button', {
      class: 'btn sm', text: '+ ' + t('add_symbol'),
      onclick: function () {
        const symIn = U.el('input', { type: 'text', placeholder: 'VTI' });
        const nameIn = U.el('input', { type: 'text' });
        const typeSel = U.el('select', {}, [
          U.el('option', { value: 'stock', text: t('type_stock') }),
          U.el('option', { value: 'etf', text: t('type_etf') })
        ]);
        const sectorIn = U.el('input', { type: 'text' });
        const body = U.el('div', {}, [
          U.el('div', { class: 'field' }, [U.el('label', { text: t('add_symbol_hint') }), symIn]),
          U.el('div', { class: 'field' }, [U.el('label', { text: t('name') }), nameIn]),
          U.el('div', { class: 'form-row' }, [
            U.el('div', { class: 'field' }, [U.el('label', { text: t('asset_type') }), typeSel]),
            U.el('div', { class: 'field' }, [U.el('label', { text: t('sector') }), sectorIn])
          ])
        ]);
        UI.modal({
          title: t('add_symbol'), body: body, confirmText: t('add'),
          onConfirm: function () {
            const res = AP.store.addSymbol(symIn.value, {
              name: nameIn.value || symIn.value.toUpperCase(),
              nameAr: nameIn.value || symIn.value.toUpperCase(),
              type: typeSel.value,
              sector: sectorIn.value || '—'
            });
            if (!res.ok) { UI.toast(t(res.err), 'bad'); return false; }
            UI.toast(t('add') + ' ✓', 'good');
            AP.app.refresh(true);
          }
        });
      }
    });

    const rows = scan.evals.map(function (e, i) {
      if (!e.ok) {
        return [
          String(i + 1), UI.symbolCell(e.symbol), '—', '—', '—', '—',
          U.el('span', { class: 'badge', text: t('no_data') }),
          U.el('button', {
            class: 'btn sm ghost', text: '✕',
            onclick: function () { removeSym(e.symbol); }
          })
        ];
      }
      const a = e.ind;
      return [
        U.el('strong', { text: String(i + 1) }),
        (function () {
          const cell = UI.symbolCell(e.symbol);
          cell.style.cursor = 'pointer';
          cell.addEventListener('click', function () { UI.assetDetail(e.symbol); });
          return cell;
        })(),
        U.el('div', {}, [
          U.el('div', { class: 'tnum', text: U.money(a.price) }),
          U.el('div', { class: 'tiny ' + U.sign(a.chg1d), text: U.pct(a.chg1d) })
        ]),
        (function () {
          const wrap = U.el('div', { class: 'row', style: { gap: '6px' } });
          wrap.appendChild(U.el('strong', { class: 'tnum', text: String(e.score) }));
          wrap.appendChild(UI.bandBadge(e));
          return wrap;
        })(),
        U.el('span', { class: 'badge ' + (e.trendLabel === 'trend_up' ? 'good' : e.trendLabel === 'trend_down' ? 'bad' : ''), text: t(e.trendLabel) }),
        U.el('span', { class: 'tnum', text: a.rsi === null ? '—' : U.round(a.rsi, 1) }),
        U.el('span', { class: 'badge ' + (e.riskLabel === 'risk_low' ? 'good' : e.riskLabel === 'risk_high' ? 'bad' : 'warn'), text: t(e.riskLabel) }),
        UI.decisionBadge(e.decision),
        U.el('div', { class: 'row' }, [
          U.el('button', { class: 'btn sm', text: t('details'), onclick: function () { UI.assetDetail(e.symbol); } }),
          U.el('button', { class: 'btn sm ghost', text: '✕', title: t('remove'), onclick: function () { removeSym(e.symbol); } })
        ])
      ];
    });

    function removeSym(sym) {
      UI.confirm(t('remove_symbol_confirm', { a: sym }), function () {
        AP.store.removeSymbol(sym);
        AP.app.refresh(false);
        UI.toast(t('remove') + ' ✓');
      });
    }

    host.appendChild(UI.card('opp_title', 'opp_sub',
      UI.table([t('rank'), t('symbol'), t('price'), t('score'), t('trend'), t('rsi14'), t('risk'), t('signal'), t('actions')], rows),
      addBtn));

    // score distribution across the watchlist
    const chartHost = U.el('div', {});
    host.appendChild(UI.card('signal_quality', 'opp_sub', chartHost));
    setTimeout(function () {
      AP.charts.bars(chartHost, scan.evals.filter(function (e) { return e.ok; }).map(function (e) {
        return {
          label: e.symbol, value: e.score,
          color: e.score >= 80 ? AP.charts.palette().good
            : e.score >= 65 ? AP.charts.palette().s3
              : e.score >= 50 ? AP.charts.palette().s4 : AP.charts.palette().s2
        };
      }), { fmt: function (v) { return Math.round(v) + '/100'; } });
    }, 0);
  };
})(window);
