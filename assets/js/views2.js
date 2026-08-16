/* Asaad Paper Invest — views: Portfolio & Analytics */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;
  const UI = AP.ui;
  const t = function (k, p) { return AP.t(k, p); };

  function benchSeriesConfig() {
    const P = AP.charts.palette();
    const colorBySlot = { accent: P.s1, c2: P.s2, c3: P.s3, c4: P.s4, c5: P.s5 };
    return AP.bench.all().map(function (b) {
      return {
        id: b.id,
        label: t(b.labelKey),
        color: colorBySlot[b.color] || P.s1,
        value: b.value,
        retPct: b.retPct,
        points: b.series.map(function (p) { return { d: p.d, v: p.v }; })
      };
    });
  }

  function legendFor(series) {
    const wrap = U.el('div', { class: 'legend' });
    series.forEach(function (s) {
      const sw = U.el('span', { class: 'legend-swatch' });
      sw.style.background = s.color;
      wrap.appendChild(U.el('span', { class: 'legend-item' }, [
        sw,
        U.el('span', { text: s.label }),
        U.el('span', { class: 'legend-val ' + U.sign(s.retPct), text: U.pct(s.retPct) })
      ]));
    });
    return wrap;
  }

  /* ---------------- Portfolio ---------------- */
  AP.views.portfolio = function (host) {
    const pf = AP.portfolio.summary();
    const syms = Object.keys(pf.positions);

    // positions
    const posNode = syms.length ? (function () {
      const rows = syms.map(function (s) {
        const p = pf.positions[s];
        return [
          (function () {
            const c = UI.symbolCell(s);
            c.style.cursor = 'pointer';
            c.addEventListener('click', function () { UI.assetDetail(s); });
            return c;
          })(),
          U.el('span', { class: 'tnum', text: U.qty(p.qty) }),
          U.el('span', { class: 'tnum', text: U.money(p.avgCost) }),
          U.el('div', {}, [
            U.el('div', { class: 'tnum', text: U.money(p.price) }),
            U.el('div', { class: 'tiny ' + U.sign(p.dayPlPct), text: U.pct(p.dayPlPct) })
          ]),
          U.el('span', { class: 'tnum', text: U.money(p.value) }),
          U.el('span', { class: 'tnum ' + U.sign(p.pl), text: U.money(p.pl) }),
          U.el('span', { class: 'tnum ' + U.sign(p.pl), text: U.pct(p.plPct) }),
          U.el('span', { class: 'tnum', text: U.pctPlain(p.weight, 1) }),
          U.el('div', { class: 'row' }, [
            U.el('button', { class: 'btn sm', text: t('buy'), onclick: function () { UI.tradeModal(s, 'BUY', { price: p.price }); } }),
            U.el('button', { class: 'btn sm ghost', text: t('sell'), onclick: function () { UI.tradeModal(s, 'SELL', { price: p.price }); } })
          ])
        ];
      });
      return UI.table([t('symbol'), t('shares'), t('avg_cost'), t('last_price'), t('market_value'),
        t('pl'), t('pl_pct'), t('weight'), t('actions')], rows);
    })() : UI.empty('no_positions');

    host.appendChild(UI.card('positions', null, posNode,
      U.el('span', { class: 'badge', text: t('cash_weight') + ': ' + U.pctPlain(pf.cashWeight, 1) })));

    // growth + allocation
    const grid = U.el('div', { class: 'grid2' });

    const growthHost = U.el('div', {});
    const growthCard = UI.card('growth_chart', null, growthHost);
    grid.appendChild(growthCard);
    setTimeout(function () {
      AP.charts.line(growthHost, {
        height: 220,
        series: [{
          label: t('bench_portfolio'), color: AP.charts.palette().s1,
          points: AP.portfolio.equitySeries().map(function (r) { return { d: r.d, v: r.v }; })
        }]
      });
    }, 0);

    const allocHost = U.el('div', {});
    const allocLegend = U.el('div', {});
    const allocCard = UI.card('allocation', null, U.el('div', {}, [allocHost, allocLegend]));
    grid.appendChild(allocCard);
    setTimeout(function () {
      const P = AP.charts.palette();
      const slots = [P.s1, P.s2, P.s3, P.s4, P.s5, P.s6, P.s7];
      let slices = syms.map(function (s) {
        return { label: s, value: pf.positions[s].value };
      }).sort(function (a, b) { return b.value - a.value; });
      // cap at six named holdings; anything past that folds into "Other"
      let other = null;
      if (slices.length > 6) {
        const rest = slices.slice(6);
        slices = slices.slice(0, 6);
        other = {
          label: AP.i18n.lang === 'ar' ? 'أخرى' : 'Other',
          value: U.sum(rest.map(function (r) { return r.value; })),
          color: P.muted
        };
      }
      slices.forEach(function (s, i) { s.color = slots[i % slots.length]; });
      if (other) slices.push(other);
      slices.push({ label: t('kpi_cash'), value: pf.cash, color: P.grid });
      AP.charts.donut(allocHost, slices, {
        height: 200,
        centerLabel: U.money0(pf.equity),
        centerSub: t('kpi_portfolio_value')
      });
      allocLegend.innerHTML = '';
      const lg = U.el('div', { class: 'legend' });
      slices.forEach(function (s) {
        const sw = U.el('span', { class: 'legend-swatch' });
        sw.style.background = s.color;
        lg.appendChild(U.el('span', { class: 'legend-item' }, [
          sw, U.el('span', { text: s.label }),
          U.el('span', { class: 'legend-val', text: U.pctPlain(pf.equity ? (s.value / pf.equity) * 100 : 0, 1) })
        ]));
      });
      allocLegend.appendChild(lg);
    }, 0);
    host.appendChild(grid);

    // benchmarks
    const benchHost = U.el('div', {});
    const benchLegend = U.el('div', {});
    const benchTable = U.el('div', {});
    host.appendChild(UI.card('vs_benchmarks', 'benchmark_note',
      U.el('div', {}, [benchHost, benchLegend, U.el('div', { class: 'sep' }), benchTable])));
    setTimeout(function () {
      const series = benchSeriesConfig();
      AP.charts.line(benchHost, { height: 240, mode: 'pct', series: series, area: false });
      benchLegend.innerHTML = '';
      benchLegend.appendChild(legendFor(series));
      benchTable.innerHTML = '';
      benchTable.appendChild(UI.table([t('strategy'), t('value_now'), t('total_return'), t('diff_vs_portfolio')],
        AP.analytics.benchmarkTable().map(function (r) {
          return [
            U.el('span', { text: t(r.labelKey), style: r.isPortfolio ? { fontWeight: '700' } : {} }),
            U.el('span', { class: 'tnum', text: U.money(r.value) }),
            U.el('span', { class: 'tnum ' + U.sign(r.retPct), text: U.pct(r.retPct) }),
            r.isPortfolio ? '—' : U.el('span', { class: 'tnum ' + U.sign(r.diff), text: U.pct(r.diff) })
          ];
        })));
    }, 0);

    // transactions
    const txs = AP.store.s.transactions;
    const txNode = txs.length ? UI.table(
      [t('date'), t('type'), t('symbol'), t('shares'), t('price'), t('amount'), t('pl'), t('balance_after'), t('note')],
      txs.slice(0, 120).map(function (x) {
        return [
          x.date,
          U.el('span', { class: 'badge ' + (x.type === 'BUY' ? 'info' : 'warn'), text: t(x.type === 'BUY' ? 'tx_buy' : 'tx_sell') }),
          U.el('span', { class: 'sym', text: x.symbol }),
          U.el('span', { class: 'tnum', text: U.qty(x.qty) }),
          U.el('span', { class: 'tnum', text: U.money(x.price) }),
          U.el('span', { class: 'tnum', text: U.money(x.amount) }),
          x.type === 'SELL' ? U.el('span', { class: 'tnum ' + U.sign(x.realized), text: U.money(x.realized) }) : '—',
          U.el('span', { class: 'tnum', text: U.money(x.cashAfter) }),
          x.note || (x.decision ? t(x.decision) : '—')
        ];
      })
    ) : UI.empty('no_transactions');
    host.appendChild(UI.card('transactions', null, txNode));

    // watchlist manager
    const wlRows = AP.store.watchlist().map(function (w) {
      return [
        U.el('span', { class: 'sym', text: w.symbol }),
        AP.store.assetName(w.symbol),
        U.el('span', { class: 'badge', text: t(w.type === 'etf' ? 'type_etf' : 'type_stock') }),
        w.sector || '—',
        U.el('span', { class: 'tnum', text: U.money(AP.store.lastPrice(w.symbol)) }),
        U.el('button', {
          class: 'btn sm ghost', text: t('remove'),
          onclick: function () {
            UI.confirm(t('remove_symbol_confirm', { a: w.symbol }), function () {
              AP.store.removeSymbol(w.symbol);
              AP.app.refresh(false);
            });
          }
        })
      ];
    });
    host.appendChild(UI.card('watchlist', null,
      UI.table([t('symbol'), t('name'), t('asset_type'), t('sector'), t('last_price'), ''], wlRows)));
  };

  /* ---------------- Analytics ---------------- */
  AP.views.analytics = function (host) {
    const a = AP.analytics.compute();
    const jstats = AP.journal.stats();

    function stat(labelKey, value, cls, sub) {
      return U.el('div', { class: 'kpi' }, [
        U.el('div', { class: 'kpi-label', text: t(labelKey) }),
        U.el('div', { class: 'kpi-value tnum ' + (cls || ''), text: value }),
        sub ? U.el('div', { class: 'kpi-sub', text: sub }) : null
      ]);
    }

    const grid = U.el('div', { class: 'kpis' }, [
      stat('total_return', U.money(a.totalReturn), U.sign(a.totalReturn), U.pct(a.totalReturnPct)),
      stat('realized_profit', U.money(a.realized), U.sign(a.realized)),
      stat('unrealized_profit', U.money(a.unrealized), U.sign(a.unrealized)),
      stat('win_rate', a.winRate === null ? '—' : U.pctPlain(a.winRate, 1), '', a.winCount + ' / ' + a.tradesCount),
      stat('loss_rate', a.lossRate === null ? '—' : U.pctPlain(a.lossRate, 1), '', a.lossCount + ' / ' + a.tradesCount),
      stat('avg_gain', a.avgGain === null ? '—' : U.pct(a.avgGain), 'pos', a.avgGainUsd === null ? '' : U.money(a.avgGainUsd)),
      stat('avg_loss', a.avgLoss === null ? '—' : U.pct(a.avgLoss), 'neg', a.avgLossUsd === null ? '' : U.money(a.avgLossUsd)),
      stat('profit_factor', a.profitFactor === null ? '—' : (a.profitFactor === Infinity ? '∞' : U.round(a.profitFactor, 2))),
      stat('max_drawdown', U.pctPlain(-Math.abs(a.maxDrawdown), 2), a.maxDrawdown > 0 ? 'neg' : ''),
      stat('sharpe', a.sharpe === null ? '—' : U.round(a.sharpe, 2)),
      stat('trades_count', String(a.tradesCount)),
      stat('avg_hold', a.avgHold === null ? '—' : U.round(a.avgHold, 1) + ' ' + t('days_unit')),
      stat('best_trade', a.bestTrade ? a.bestTrade.symbol + ' ' + U.pct(a.bestTrade.plPct) : '—', a.bestTrade ? 'pos' : ''),
      stat('worst_trade', a.worstTrade ? a.worstTrade.symbol + ' ' + U.pct(a.worstTrade.plPct) : '—', a.worstTrade ? 'neg' : ''),
      stat('cash_weight', U.pctPlain(a.cashWeight, 1)),
      stat('signal_quality', jstats.hitRate === null ? '—' : U.pctPlain(jstats.hitRate, 1), '', jstats.graded + ' / ' + jstats.total)
    ]);
    host.appendChild(UI.card('analytics_title', null, grid));

    // equity + drawdown
    const g2 = U.el('div', { class: 'grid2' });
    const eqHost = U.el('div', {});
    const ddHost = U.el('div', {});
    g2.appendChild(UI.card('equity_curve', null, eqHost));
    g2.appendChild(UI.card('drawdown_curve', null, ddHost));
    host.appendChild(g2);
    setTimeout(function () {
      AP.charts.line(eqHost, {
        height: 210,
        series: [{ label: t('equity'), color: AP.charts.palette().s1, points: a.equitySeries.map(function (r) { return { d: r.d, v: r.v }; }) }]
      });
      AP.charts.line(ddHost, {
        height: 210, mode: 'value', unit: 'pct', zeroBase: true,
        series: [{ label: t('max_drawdown'), color: AP.charts.palette().critical, points: a.drawdownSeries.map(function (r) { return { d: r.d, v: r.v }; }) }]
      });
    }, 0);

    // benchmarks
    const bTable = AP.analytics.benchmarkTable();
    const timing = AP.analytics.timingVerdict();
    const benchHost = U.el('div', {});
    const benchLegend = U.el('div', {});
    host.appendChild(UI.card('benchmark_title', 'benchmark_note', U.el('div', {}, [
      benchHost, benchLegend,
      U.el('div', { class: 'sep' }),
      UI.table([t('strategy'), t('value_now'), t('total_return'), t('diff_vs_portfolio')],
        bTable.map(function (r) {
          return [
            U.el('span', { text: t(r.labelKey), style: r.isPortfolio ? { fontWeight: '700' } : {} }),
            U.el('span', { class: 'tnum', text: U.money(r.value) }),
            U.el('span', { class: 'tnum ' + U.sign(r.retPct), text: U.pct(r.retPct) }),
            r.isPortfolio ? '—' : U.el('span', { class: 'tnum ' + U.sign(r.diff), text: U.pct(r.diff) })
          ];
        })),
      U.el('div', { class: 'notice info', style: { marginTop: '12px' } }, [
        U.el('div', {}, [
          U.el('strong', { text: t('timing_question') + ' ' }),
          U.el('span', { text: t(timing.key, timing.params) })
        ])
      ])
    ])));
    setTimeout(function () {
      const series = benchSeriesConfig();
      AP.charts.line(benchHost, { height: 240, mode: 'pct', series: series, area: false });
      benchLegend.innerHTML = '';
      benchLegend.appendChild(legendFor(series));
    }, 0);

    // per-asset performance
    const symRows = Object.keys(a.bySymbol).map(function (s) { return a.bySymbol[s]; })
      .sort(function (x, y) { return U.num(y.total) - U.num(x.total); });
    const symChart = U.el('div', {});
    host.appendChild(UI.card('per_symbol', null, U.el('div', {}, [
      symChart,
      U.el('div', { class: 'sep' }),
      UI.table([t('symbol'), t('trades_count'), t('win_rate'), t('realized_profit'), t('unrealized_profit'), t('total_return')],
        symRows.map(function (r) {
          return [
            U.el('span', { class: 'sym', text: r.symbol }),
            String(r.trades),
            r.winRate === null ? '—' : U.pctPlain(r.winRate, 0),
            U.el('span', { class: 'tnum ' + U.sign(r.pl), text: U.money(r.pl) }),
            U.el('span', { class: 'tnum ' + U.sign(r.openPl), text: r.openPl === undefined ? '—' : U.money(r.openPl) }),
            U.el('span', { class: 'tnum ' + U.sign(r.total), text: U.money(r.total) })
          ];
        }))
    ])));
    setTimeout(function () {
      if (!symRows.length) return;
      AP.charts.bars(symChart, symRows.map(function (r) {
        return { label: r.symbol, value: U.num(r.total) };
      }), { fmt: function (v) { return U.money(v); } });
    }, 0);

    // per-signal performance
    const sigRows = Object.keys(a.byDecision).map(function (k) { return a.byDecision[k]; });
    const jbands = jstats.byBand;
    host.appendChild(UI.card('per_signal', null, U.el('div', {}, [
      sigRows.length ? UI.table([t('signal'), t('trades_count'), t('win_rate'), t('pl'), t('avg_gain')],
        sigRows.map(function (r) {
          return [
            t(r.key) || r.key,
            String(r.trades),
            r.winRate === null ? '—' : U.pctPlain(r.winRate, 0),
            U.el('span', { class: 'tnum ' + U.sign(r.pl), text: U.money(r.pl) }),
            r.avgRet === null ? '—' : U.el('span', { class: 'tnum ' + U.sign(r.avgRet), text: U.pct(r.avgRet) })
          ];
        })) : UI.empty('no_closed_trades'),
      U.el('div', { class: 'sep' }),
      U.el('div', { class: 'card-sub', style: { marginBottom: '8px' }, text: t('hit_rate_by_band') }),
      UI.table([t('signal'), t('trades_count'), t('was_successful'), t('avg_gain')],
        Object.keys(jbands).map(function (k) {
          const b = jbands[k];
          return [
            t(k),
            String(b.total),
            b.hitRate === null ? t('pending') : U.pctPlain(b.hitRate, 0) + ' (' + b.success + '/' + b.graded + ')',
            b.avgRet === null ? '—' : U.el('span', { class: 'tnum ' + U.sign(b.avgRet), text: U.pct(b.avgRet) })
          ];
        }))
    ])));

    // closed trades
    const closedNode = a.closed.length ? UI.table(
      [t('symbol'), t('date'), t('shares'), t('entry_price'), t('price'), t('pl'), t('pl_pct'), t('avg_hold'), t('signal')],
      a.closed.slice().reverse().slice(0, 100).map(function (c) {
        return [
          U.el('span', { class: 'sym', text: c.symbol }),
          c.entryDate + ' → ' + c.exitDate,
          U.el('span', { class: 'tnum', text: U.qty(c.qty) }),
          U.el('span', { class: 'tnum', text: U.money(c.entryPrice) }),
          U.el('span', { class: 'tnum', text: U.money(c.exitPrice) }),
          U.el('span', { class: 'tnum ' + U.sign(c.pl), text: U.money(c.pl) }),
          U.el('span', { class: 'tnum ' + U.sign(c.pl), text: U.pct(c.plPct) }),
          c.holdDays + ' ' + t('days_unit'),
          c.score === null || c.score === undefined ? '—' : String(c.score)
        ];
      })
    ) : UI.empty('no_closed_trades');
    host.appendChild(UI.card('closed_trades', null, closedNode));
  };
})(window);
