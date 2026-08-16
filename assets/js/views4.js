/* Asaad Paper Invest — views: Final report & Settings */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;
  const UI = AP.ui;
  const t = function (k, p) { return AP.t(k, p); };

  /* ---------- which indicator conditions actually preceded good signals ---------- */
  function indicatorEffectiveness() {
    const entries = AP.journal.entries().filter(function (e) {
      return e.indicators && ['success', 'fail', 'partial'].indexOf(e.outcome) >= 0 &&
        AP.journal.BULLISH.indexOf(e.decision) >= 0;
    });
    const conds = [
      { key: 'r_above_sma200', test: function (i) { return i.sma200 && i.sma200 > 0 ? true : null; }, val: function (e) { return e.price > e.indicators.sma200; } },
      { key: 'r_rsi_healthy', test: function (i) { return i.rsi !== null; }, val: function (e) { return e.indicators.rsi >= 45 && e.indicators.rsi <= 65; } },
      { key: 'r_macd_pos', test: function (i) { return i.macdHist !== null; }, val: function (e) { return e.indicators.macdHist > 0; } },
      { key: 'r_vol_low', test: function (i) { return i.atrPct !== null; }, val: function (e) { return e.indicators.atrPct < 3; } },
      { key: 'r_no_overbought', test: function (i) { return i.chg5d !== null; }, val: function (e) { return e.indicators.chg5d < 8; } },
      { key: 'r_near_high', test: function (i) { return i.fromHigh !== null; }, val: function (e) { return e.indicators.fromHigh > -12; } }
    ];
    return conds.map(function (c) {
      let tN = 0, tS = 0, fN = 0, fS = 0;
      entries.forEach(function (e) {
        if (!c.test(e.indicators)) return;
        const on = c.val(e);
        const ok = e.outcome === 'success' ? 1 : 0;
        if (on) { tN++; tS += ok; } else { fN++; fS += ok; }
      });
      const withRate = tN ? (tS / tN) * 100 : null;
      const withoutRate = fN ? (fS / fN) * 100 : null;
      return {
        key: c.key, n: tN + fN, withRate: withRate, withoutRate: withoutRate,
        lift: (withRate !== null && withoutRate !== null) ? withRate - withoutRate : null
      };
    }).filter(function (r) { return r.n >= 3; })
      .sort(function (a, b) { return (b.lift === null ? -999 : b.lift) - (a.lift === null ? -999 : a.lift); });
  }

  function verdict(a, benchTable, jstats) {
    const dayNo = AP.store.dayNumberRaw();
    const total = AP.store.settings().experimentDays;
    const pfRow = benchTable.find(function (r) { return r.id === 'portfolio'; });
    const rivals = benchTable.filter(function (r) { return !r.isPortfolio; });
    const bestRival = rivals.length ? rivals.slice().sort(function (x, y) { return y.retPct - x.retPct; })[0] : null;
    const beatsBest = bestRival ? pfRow.retPct - bestRival.retPct : 0;
    const reasons = [];

    const thinSample = a.tradesCount < 5 || jstats.graded < 8 || dayNo < Math.min(45, total * 0.5);
    if (thinSample) {
      reasons.push(AP.i18n.lang === 'ar'
        ? 'حجم العينة صغير (' + a.tradesCount + ' صفقة مغلقة، ' + jstats.graded + ' إشارة مُقيَّمة، اليوم ' + Math.min(dayNo, total) + ' من ' + total + ') — لا يكفي لاستنتاج موثوق.'
        : 'Sample is small (' + a.tradesCount + ' closed trades, ' + jstats.graded + ' graded signals, day ' + Math.min(dayNo, total) + ' of ' + total + ') — not enough for a reliable conclusion.');
    }
    if (bestRival) {
      reasons.push((AP.i18n.lang === 'ar' ? 'الفرق مقابل أفضل مرجع (' : 'Gap versus the best benchmark (') +
        t(bestRival.labelKey) + '): ' + U.pct(beatsBest));
    }
    if (a.profitFactor !== null && a.profitFactor !== Infinity) {
      reasons.push('Profit Factor: ' + U.round(a.profitFactor, 2));
    }
    reasons.push(t('max_drawdown') + ': ' + U.pctPlain(-Math.abs(a.maxDrawdown), 2));
    if (jstats.hitRate !== null) reasons.push(t('signal_quality') + ': ' + U.pctPlain(jstats.hitRate, 1));

    let key;
    const pf = a.profitFactor === null ? 0 : (a.profitFactor === Infinity ? 3 : a.profitFactor);
    if (a.totalReturnPct < -10 || (a.maxDrawdown > 25 && a.totalReturnPct < 0)) key = 'verdict_not_ready';
    else if (thinSample) key = 'verdict_needs_more';
    else if (beatsBest > 1 && pf >= 1.3 && (a.winRate === null || a.winRate >= 50) && a.maxDrawdown < 18) key = 'verdict_promising';
    else if (beatsBest > -2 && pf >= 1 && a.maxDrawdown < 22) key = 'verdict_small';
    else if (a.totalReturnPct > -5) key = 'verdict_needs_more';
    else key = 'verdict_not_ready';

    return { key: key, reasons: reasons, beatsBest: beatsBest, bestRival: bestRival };
  }

  /* ---------------- Report ---------------- */
  AP.views.report = function (host) {
    const st = AP.store.settings();
    const a = AP.analytics.compute();
    const jstats = AP.journal.stats();
    const benchTable = AP.analytics.benchmarkTable();
    const timing = AP.analytics.timingVerdict();
    const s507 = AP.s507.ensure();
    const dayNo = Math.min(AP.store.dayNumberRaw(), st.experimentDays);
    const complete = AP.store.isComplete();
    const v = verdict(a, benchTable, jstats);

    const head = U.el('div', { class: 'card' }, [
      U.el('div', { class: 'row' }, [
        U.el('div', {}, [
          U.el('h2', { class: 'card-title', style: { fontSize: '20px' }, text: t('report_title') }),
          U.el('div', { class: 'card-sub', text: t('report_sub') })
        ]),
        U.el('div', { style: { marginInlineStart: 'auto' }, class: 'row' }, [
          U.el('span', { class: 'badge ' + (complete ? 'good' : 'warn'), text: t('day_of', { a: dayNo, b: st.experimentDays }) }),
          U.el('button', { class: 'btn sm', text: t('print_report'), onclick: function () { window.print(); } })
        ])
      ]),
      complete ? null : U.el('div', { class: 'notice warn', style: { marginTop: '12px' } }, [
        U.el('div', {}, [
          U.el('div', { text: t('report_locked') }),
          U.el('div', { class: 'tiny muted', text: t('report_preliminary', { a: dayNo, b: st.experimentDays }) })
        ])
      ])
    ]);
    host.appendChild(head);

    // headline numbers
    function box(labelKey, value, cls) {
      return U.el('div', { class: 'kpi' }, [
        U.el('div', { class: 'kpi-label', text: t(labelKey) }),
        U.el('div', { class: 'kpi-value tnum ' + (cls || ''), text: value })
      ]);
    }
    host.appendChild(UI.card('analytics_title', null, U.el('div', { class: 'kpis' }, [
      box('initial_capital', U.money(st.initialCapital)),
      box('final_value', U.money(a.equity), U.sign(a.totalReturn)),
      box('total_return', U.pct(a.totalReturnPct), U.sign(a.totalReturn)),
      box('trades_count', String(a.tradesCount)),
      box('win_rate', a.winRate === null ? '—' : U.pctPlain(a.winRate, 1)),
      box('max_drawdown', U.pctPlain(-Math.abs(a.maxDrawdown), 2), a.maxDrawdown ? 'neg' : ''),
      box('profit_factor', a.profitFactor === null ? '—' : (a.profitFactor === Infinity ? '∞' : U.round(a.profitFactor, 2))),
      box('sharpe', a.sharpe === null ? '—' : U.round(a.sharpe, 2))
    ])));

    // benchmark comparison
    const sorted = benchTable.slice().sort(function (x, y) { return y.retPct - x.retPct; });
    host.appendChild(UI.card('benchmark_title', 'benchmark_note', U.el('div', {}, [
      UI.table([t('strategy'), t('value_now'), t('total_return'), t('diff_vs_portfolio')],
        sorted.map(function (r) {
          return [
            U.el('span', { text: t(r.labelKey), style: r.isPortfolio ? { fontWeight: '700' } : {} }),
            U.el('span', { class: 'tnum', text: U.money(r.value) }),
            U.el('span', { class: 'tnum ' + U.sign(r.retPct), text: U.pct(r.retPct) }),
            r.isPortfolio ? '—' : U.el('span', { class: 'tnum ' + U.sign(r.diff), text: U.pct(r.diff) })
          ];
        })),
      U.el('div', { class: 'row', style: { marginTop: '12px' } }, [
        U.el('span', { class: 'badge good', text: t('best_strategy') + ': ' + t(sorted[0].labelKey) }),
        U.el('span', { class: 'badge bad', text: t('worst_strategy') + ': ' + t(sorted[sorted.length - 1].labelKey) })
      ]),
      U.el('div', { class: 'notice info', style: { marginTop: '12px' } }, [
        U.el('div', {}, [
          U.el('strong', { text: t('timing_question') + ' ' }),
          U.el('span', { text: t(timing.key, timing.params) })
        ])
      ])
    ])));

    // 507 comparison
    host.appendChild(UI.card('s507_compare', null, UI.table(
      [t('strategy'), t('contributed'), t('current_value'), t('gain'), t('total_return')],
      ['A', 'B', 'C'].map(function (k) {
        const s = s507[k];
        return [
          U.el('span', { text: t(s.nameKey), style: s507.best === k ? { fontWeight: '700' } : {} }),
          U.el('span', { class: 'tnum', text: U.money(s.contributed) }),
          U.el('span', { class: 'tnum', text: U.money(s.value) }),
          U.el('span', { class: 'tnum ' + U.sign(s.gain), text: U.money(s.gain) }),
          U.el('span', { class: 'tnum ' + U.sign(s.gainPct), text: U.pct(s.gainPct) })
        ];
      })
    )));

    // error analysis
    const errors = [];
    const worstTrades = a.closed.slice().sort(function (x, y) { return x.plPct - y.plPct; }).slice(0, 3);
    worstTrades.forEach(function (c) {
      if (c.plPct < 0) {
        errors.push((AP.i18n.lang === 'ar'
          ? 'خسارة في ' + c.symbol + ' بنسبة ' + U.pct(c.plPct) + ' خلال ' + c.holdDays + ' يومًا'
          : 'Loss in ' + c.symbol + ' of ' + U.pct(c.plPct) + ' over ' + c.holdDays + ' days') +
          (c.score ? ' — Signal Score ' + c.score : ''));
      }
    });
    if (a.avgLoss !== null && a.avgGain !== null && Math.abs(a.avgLoss) > a.avgGain) {
      errors.push(AP.i18n.lang === 'ar'
        ? 'متوسط الخسارة (' + U.pct(a.avgLoss) + ') أكبر من متوسط الربح (' + U.pct(a.avgGain) + ') — وقف الخسارة أو حجم المركز يحتاج مراجعة.'
        : 'Average loss (' + U.pct(a.avgLoss) + ') exceeds average gain (' + U.pct(a.avgGain) + ') — stop placement or position sizing needs review.');
    }
    if (a.cashWeight > 60 && a.totalReturnPct < 2) {
      errors.push(AP.i18n.lang === 'ar'
        ? 'نسبة السيولة مرتفعة (' + U.pctPlain(a.cashWeight, 0) + ') — الانتظار الطويل قلّل من العائد مقابل الاستثمار المنتظم.'
        : 'Cash weight is high (' + U.pctPlain(a.cashWeight, 0) + ') — extended waiting reduced return versus regular investing.');
    }
    if (a.maxDrawdown > 15) {
      errors.push(AP.i18n.lang === 'ar'
        ? 'أقصى تراجع بلغ ' + U.pctPlain(a.maxDrawdown, 1) + ' — تركيز المحفظة أو التوقيت زاد من التقلب.'
        : 'Maximum drawdown reached ' + U.pctPlain(a.maxDrawdown, 1) + ' — concentration or timing increased volatility.');
    }
    if (!errors.length) {
      errors.push(AP.i18n.lang === 'ar'
        ? 'لا توجد أخطاء جوهرية واضحة في البيانات المتاحة حتى الآن.'
        : 'No clear material errors in the data collected so far.');
    }
    host.appendChild(UI.card('error_analysis', null,
      U.el('ul', { class: 'reason-list' }, errors.map(function (e) { return U.el('li', { text: e }); }))));

    // indicator usefulness
    const eff = indicatorEffectiveness();
    host.appendChild(UI.card('useful_indicators', null, eff.length
      ? UI.table([t('indicators'), t('trades_count'), t('was_successful'), t('signal_quality')],
        eff.map(function (r) {
          return [
            t(r.key),
            String(r.n),
            r.withRate === null ? '—' : U.pctPlain(r.withRate, 0),
            r.lift === null ? '—' : U.el('span', { class: U.sign(r.lift), text: U.pct(r.lift, 0) })
          ];
        }))
      : UI.empty('journal_empty')));

    // weak signals
    const weak = Object.keys(jstats.byBand).map(function (k) {
      return Object.assign({ key: k }, jstats.byBand[k]);
    }).filter(function (b) { return b.graded >= 2 && b.hitRate !== null && b.hitRate < 50; })
      .sort(function (x, y) { return x.hitRate - y.hitRate; });
    host.appendChild(UI.card('weak_signals', null, weak.length
      ? UI.table([t('signal'), t('trades_count'), t('was_successful'), t('avg_gain')],
        weak.map(function (b) {
          return [t(b.key), String(b.total), U.pctPlain(b.hitRate, 0),
          b.avgRet === null ? '—' : U.el('span', { class: U.sign(b.avgRet), text: U.pct(b.avgRet) })];
        }))
      : UI.empty(AP.i18n.lang === 'ar' ? 'لا توجد فئة إشارات بأداء ضعيف واضح حتى الآن.' : 'No clearly weak signal band so far.')));

    // verdict
    const vbox = U.el('div', { class: 'verdict' }, [
      U.el('div', { class: 'card-sub', text: t('final_verdict') }),
      U.el('div', { class: 'verdict-value', text: t(v.key) })
    ]);
    host.appendChild(UI.card('final_verdict', null, U.el('div', {}, [
      vbox,
      U.el('div', { class: 'card-sub', style: { marginBottom: '6px' }, text: t('verdict_basis') }),
      U.el('ul', { class: 'reason-list' }, v.reasons.map(function (r) { return U.el('li', { text: r }); })),
      U.el('div', { class: 'notice info', style: { marginTop: '10px' }, text: t('prob_note') })
    ])));
  };

  /* ---------------- Settings ---------------- */
  AP.views.settings = function (host) {
    const st = AP.store.settings();

    function field(labelKey, node, hintKey) {
      return U.el('div', { class: 'field' }, [
        U.el('label', { text: t(labelKey) }), node,
        hintKey ? U.el('div', { class: 'hint', text: t(hintKey) }) : null
      ]);
    }
    function numInput(value, step) {
      return U.el('input', { type: 'number', step: step || '1', value: String(value) });
    }

    /* general */
    const langSel = U.el('select', {}, [
      U.el('option', { value: 'ar', text: 'العربية' }),
      U.el('option', { value: 'en', text: 'English' })
    ]);
    langSel.value = AP.i18n.lang;
    langSel.addEventListener('change', function () { AP.app.setLang(langSel.value); });

    const themeSel = U.el('select', {}, [
      U.el('option', { value: 'dark', text: t('theme_dark') }),
      U.el('option', { value: 'light', text: t('theme_light') })
    ]);
    themeSel.value = st.theme;
    themeSel.addEventListener('change', function () { AP.app.setTheme(themeSel.value); });

    host.appendChild(UI.card('general', null, U.el('div', { class: 'form-row' }, [
      field('lang_label', langSel), field('theme_dark', themeSel)
    ])));

    /* capital & experiment */
    const capIn = numInput(st.initialCapital, '100');
    const startIn = U.el('input', { type: 'date', value: st.startDate });
    const daysIn = numInput(st.experimentDays, '1');
    host.appendChild(UI.card('capital_settings', null, U.el('div', {}, [
      U.el('div', { class: 'form-row' }, [field('initial_capital_field', capIn), field('start_date', startIn)]),
      field('experiment_days', daysIn),
      U.el('div', { class: 'notice warn', text: t('apply_capital_warning') }),
      U.el('button', {
        class: 'btn primary', text: t('save'),
        onclick: function () {
          const newCap = U.num(capIn.value, st.initialCapital);
          st.startDate = startIn.value || st.startDate;
          st.experimentDays = U.clamp(U.num(daysIn.value, 90), 1, 3650);
          if (newCap !== st.initialCapital) {
            UI.confirm(t('apply_capital_warning'), function () {
              AP.store.resetCapital(newCap);
              AP.app.refresh(false);
              UI.toast(t('save') + ' ✓', 'good');
            });
          } else {
            AP.store.save();
            AP.app.refresh(false);
            UI.toast(t('save') + ' ✓', 'good');
          }
        }
      })
    ])));

    /* risk */
    const maxSingleIn = numInput(st.risk.maxSingle, '0.5');
    const maxEtfIn = numInput(st.risk.maxEtf, '0.5');
    const minCashIn = numInput(st.risk.minCash, '0.5');
    const riskTradeIn = numInput(st.risk.riskPerTrade, '0.1');
    host.appendChild(UI.card('risk_settings', null, U.el('div', {}, [
      U.el('div', { class: 'form-row' }, [field('max_single', maxSingleIn), field('max_etf', maxEtfIn)]),
      U.el('div', { class: 'form-row' }, [field('min_cash', minCashIn), field('risk_per_trade', riskTradeIn)]),
      U.el('div', { class: 'notice', text: AP.i18n.lang === 'ar'
        ? 'قواعد ثابتة خلال التجربة: بدون Margin، بدون Options، بدون Short Selling، ولا مطاردة للأسعار بعد صعود حاد.'
        : 'Fixed rules for the experiment: no margin, no options, no short selling, and no chasing after sharp run-ups.' }),
      U.el('button', {
        class: 'btn primary', text: t('save'),
        onclick: function () {
          st.risk.maxSingle = U.clamp(U.num(maxSingleIn.value, 10), 1, 100);
          st.risk.maxEtf = U.clamp(U.num(maxEtfIn.value, 25), 1, 100);
          st.risk.minCash = U.clamp(U.num(minCashIn.value, 10), 0, 90);
          st.risk.riskPerTrade = U.clamp(U.num(riskTradeIn.value, 1), 0.1, 10);
          AP.store.save();
          AP.app.rescan();
          UI.renderShell();
          UI.toast(t('save') + ' ✓', 'good');
        }
      })
    ])));

    /* market data */
    const provSel = U.el('select', {}, [
      U.el('option', { value: 'auto', text: t('provider_auto') }),
      U.el('option', { value: 'stooq', text: t('provider_stooq') }),
      U.el('option', { value: 'yahoo', text: t('provider_yahoo') }),
      U.el('option', { value: 'manual', text: t('provider_manual') }),
      U.el('option', { value: 'demo', text: t('provider_demo') })
    ]);
    provSel.value = st.provider;
    const proxyIn = U.el('input', { type: 'text', value: st.proxyUrl, placeholder: 'https://api.allorigins.win/raw?url=' });

    const manualHost = U.el('div', {});
    function renderManual() {
      manualHost.innerHTML = '';
      const rows = AP.store.watchlist().map(function (w) {
        const input = U.el('input', {
          type: 'number', step: '0.01',
          value: AP.store.lastPrice(w.symbol) ? U.round(AP.store.lastPrice(w.symbol), 2) : ''
        });
        input.addEventListener('change', function () {
          const v = U.num(input.value);
          if (v > 0) {
            AP.market.setManualPrice(w.symbol, U.today(), v);
            AP.app.rescan();
            UI.toast(w.symbol + ' ✓', 'good');
          }
        });
        const earn = U.el('input', { type: 'date', value: AP.store.s.earnings[w.symbol] || '' });
        earn.addEventListener('change', function () {
          if (earn.value) AP.store.s.earnings[w.symbol] = earn.value;
          else delete AP.store.s.earnings[w.symbol];
          AP.store.save();
        });
        return [
          U.el('span', { class: 'sym', text: w.symbol }),
          U.el('span', { class: 'tiny muted', text: AP.market.sourceOf(w.symbol) || '—' }),
          input,
          earn
        ];
      });
      manualHost.appendChild(UI.table([t('symbol'), t('data_source'), t('last_price'), t('earnings_next')], rows));
    }
    renderManual();

    host.appendChild(UI.card('data_settings', null, U.el('div', {}, [
      U.el('div', { class: 'form-row' }, [field('provider', provSel), field('proxy_url', proxyIn, 'proxy_hint')]),
      U.el('button', {
        class: 'btn primary', text: t('save'),
        onclick: function () {
          st.provider = provSel.value;
          st.proxyUrl = proxyIn.value.trim();
          AP.store.save();
          AP.app.refresh(true);
          UI.toast(t('save') + ' ✓', 'good');
        }
      }),
      U.el('div', { class: 'sep' }),
      U.el('div', { class: 'card-sub', text: t('manual_prices') }),
      U.el('div', { class: 'hint', style: { marginBottom: '8px' }, text: t('manual_hint') }),
      manualHost
    ])));

    /* data management */
    const importInput = U.el('input', { type: 'file', accept: '.json', style: { display: 'none' } });
    importInput.addEventListener('change', function () {
      const f = importInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          AP.store.importJSON(String(reader.result));
          AP.app.boot();
          UI.toast(t('import') + ' ✓', 'good');
        } catch (e) {
          UI.toast(t('err_invalid'), 'bad');
        }
      };
      reader.readAsText(f);
    });

    host.appendChild(UI.card('data_management', null, U.el('div', {}, [
      U.el('div', { class: 'row' }, [
        U.el('button', {
          class: 'btn', text: t('export_data'),
          onclick: function () {
            U.download('asaad-paper-invest-' + U.today() + '.json', AP.store.exportJSON());
          }
        }),
        U.el('button', { class: 'btn', text: t('import_data'), onclick: function () { importInput.click(); } }),
        U.el('button', {
          class: 'btn', text: t('rebuild_snapshots'),
          onclick: function () {
            AP.store.saveSnapshot({ scores: AP.app.lastScores(), regime: AP.app.currentScan().regime.label });
            AP.journal.updateFollowUps();
            UI.toast(t('snapshot_saved') + ' ✓', 'good');
            UI.renderShell();
          }
        }),
        U.el('button', {
          class: 'btn', text: t('seed_demo'),
          onclick: function () {
            UI.confirm(t('replay_confirm'), function () {
              const daysIn2 = 90;
              UI.toast(t('replay_running'));
              AP.backtest.run(daysIn2, function (done, total) {
                if (done === total) UI.toast(t('replay_done', { a: total }), 'good');
              }).then(function (res) {
                if (!res) return;
                AP.app.rescan();
                AP.ui.renderShell();
              }).catch(function (e) {
                UI.toast(String(e.message || e), 'bad');
              });
            });
          }
        }),
        U.el('button', {
          class: 'btn danger', text: t('reset_all'),
          onclick: function () {
            UI.confirm(t('reset_confirm'), function () {
              AP.store.resetAll();
              AP.app.boot();
              UI.toast(t('reset') + ' ✓', 'good');
            });
          }
        }),
        importInput
      ]),
      U.el('div', { class: 'hint', style: { marginTop: '10px' }, text: t('storage_used') + ': ' + AP.store.storageSize() })
    ])));

    host.appendChild(UI.card('about', null, U.el('div', {}, [
      U.el('p', { class: 'small', text: t('about_text') }),
      U.el('p', { class: 'tiny muted', text: t('paper_only') })
    ])));
  };
})(window);
