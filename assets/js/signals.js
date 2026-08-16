/* Asaad Paper Invest — Asaad Signal Score engine.
   Never claims to know future prices: every output is a probabilistic reading
   of the data available today. */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  const WEIGHTS = { trend: 28, momentum: 20, valuation: 12, volatility: 12, market: 14, news: 8, rr: 6 };

  const BANDS = [
    { min: 80, key: 'band_strong', cls: 'band-strong' },
    { min: 65, key: 'band_gradual', cls: 'band-gradual' },
    { min: 50, key: 'band_watch', cls: 'band-watch' },
    { min: 35, key: 'band_nobuy', cls: 'band-nobuy' },
    { min: 0, key: 'band_avoid', cls: 'band-avoid' }
  ];

  function bandOf(score) {
    for (let i = 0; i < BANDS.length; i++) if (score >= BANDS[i].min) return BANDS[i];
    return BANDS[BANDS.length - 1];
  }

  /* ---------- market regime ---------- */
  function marketRegime() {
    const proxy = AP.store.settings().marketProxy || 'VOO';
    const bars = AP.market.seriesWithManual(proxy);
    const ind = bars && bars.length > 3 ? AP.ind.analyze(bars) : null;

    // breadth: share of watchlist trading above its own SMA200 (or SMA50 fallback)
    let above = 0, counted = 0;
    AP.store.symbols().forEach(function (s) {
      const b = AP.market.seriesWithManual(s);
      if (!b || b.length < 60) return;
      const a = AP.ind.analyze(b);
      if (!a) return;
      const ref = a.sma200 || a.sma50;
      if (!ref) return;
      counted++;
      if (a.price > ref) above++;
    });
    const breadth = counted ? above / counted : 0.5;

    let sc = 0;
    if (ind) {
      if (ind.sma200 && ind.price > ind.sma200) sc += 0.35; else sc -= 0.35;
      if (ind.sma50 && ind.sma200 && ind.sma50 > ind.sma200) sc += 0.2; else sc -= 0.15;
      if (ind.sma20 && ind.price > ind.sma20) sc += 0.15; else sc -= 0.1;
      if (ind.chg1m !== null) sc += U.clamp(ind.chg1m / 12, -0.2, 0.2);
      if (ind.atrPct !== null && ind.atrPct > 2.2) sc -= 0.12;
    }
    sc += (breadth - 0.5) * 0.6;
    sc = U.clamp(sc, -1, 1);

    const label = sc > 0.2 ? 'positive' : sc < -0.2 ? 'negative' : 'neutral';
    return {
      score: sc,
      label: label,
      breadth: breadth * 100,
      proxy: proxy,
      ind: ind,
      norm: (sc + 1) / 2
    };
  }

  /* ---------- component scores (each 0..1) ---------- */
  function trendScore(a, R) {
    if (!a) return { v: 0.5, notes: [] };
    const notes = [];
    let v = 0, w = 0;
    const longRef = a.sma200 || a.sma50;
    if (longRef) {
      w += 0.34;
      if (a.price > longRef) { v += 0.34; notes.push(a.sma200 ? 'r_above_sma200' : null); }
      else notes.push(a.sma200 ? 'r_below_sma200' : null);
    }
    if (a.sma50 && a.sma200) {
      w += 0.22;
      if (a.sma50 > a.sma200) { v += 0.22; notes.push('r_golden'); }
      else notes.push('r_death');
    }
    if (a.sma20) {
      w += 0.16;
      if (a.price > a.sma20) v += 0.16;
    }
    if (a.ema20) {
      w += 0.12;
      if (a.price > a.ema20) v += 0.12;
    }
    if (a.sma20Slope !== null) {
      w += 0.09;
      if (a.sma20Slope > 0) v += 0.09;
    }
    if (a.sma200Slope !== null) {
      w += 0.07;
      if (a.sma200Slope > 0) v += 0.07;
    }
    const val = w ? v / w : 0.5;
    if (val >= 0.75) notes.push('r_trend_ok');
    else if (val > 0.35) notes.push('r_trend_mixed');
    return { v: val, notes: notes.filter(Boolean) };
  }

  function rsiQuality(rsi) {
    if (rsi === null || rsi === undefined) return 0.5;
    if (rsi >= 50 && rsi <= 65) return 1;
    if (rsi > 65 && rsi <= 70) return 0.72;
    if (rsi > 70 && rsi <= 78) return 0.38;
    if (rsi > 78) return 0.18;
    if (rsi >= 45) return 0.82;
    if (rsi >= 40) return 0.62;
    if (rsi >= 32) return 0.42;
    return 0.3;
  }

  function momentumScore(a) {
    if (!a) return { v: 0.5, notes: [] };
    const notes = [];
    const rq = rsiQuality(a.rsi);
    if (a.rsi !== null && a.rsi !== undefined) {
      notes.push({ key: 'r_rsi', params: { a: U.round(a.rsi, 1) } });
      if (a.rsi > 70) notes.push('r_rsi_over');
      else if (a.rsi < 30) notes.push('r_rsi_under');
      else notes.push('r_rsi_healthy');
    }
    let mq = 0.5;
    if (a.macd) {
      mq = a.macd.hist > 0 ? 0.8 : 0.25;
      if (a.macd.prevHist !== null) {
        if (a.macd.hist > a.macd.prevHist) mq += 0.2; else mq -= 0.1;
      }
      mq = U.clamp(mq, 0, 1);
      notes.push(a.macd.hist > 0 ? 'r_macd_pos' : 'r_macd_neg');
    }
    let roc = 0.5;
    if (a.chg1m !== null) roc = U.clamp(0.5 + a.chg1m / 20, 0, 1);
    if (a.chg5d !== null) roc = U.clamp(roc * 0.75 + (0.5 + a.chg5d / 14) * 0.25, 0, 1);
    return { v: rq * 0.42 + mq * 0.33 + roc * 0.25, notes: notes };
  }

  function valuationScore(a) {
    if (!a) return { v: 0.5, notes: [] };
    const notes = [];
    let ext = 0.6;
    if (a.extAboveSma200 !== null) {
      const e = a.extAboveSma200;
      if (e < -15) ext = 0.35;
      else if (e < 0) ext = 0.6;
      else if (e <= 12) ext = 1;
      else if (e <= 22) ext = 0.65;
      else if (e <= 35) ext = 0.35;
      else { ext = 0.15; notes.push({ key: 'r_extended', params: { a: U.round(e, 1) } }); }
    }
    let pos = 0.6;
    if (a.fromHigh !== null) {
      const fh = a.fromHigh; // negative or 0
      if (fh > -3) { pos = 0.8; notes.push('r_near_high'); }
      else if (fh > -12) pos = 1;
      else if (fh > -25) { pos = 0.6; notes.push({ key: 'r_deep_drawdown', params: { a: U.round(Math.abs(fh), 1) } }); }
      else { pos = 0.35; notes.push({ key: 'r_deep_drawdown', params: { a: U.round(Math.abs(fh), 1) } }); }
    }
    let bbq = 0.6;
    if (a.bb) {
      const p = a.bb.pctB;
      if (p > 1) bbq = 0.2;
      else if (p > 0.85) bbq = 0.45;
      else if (p >= 0.3) bbq = 1;
      else if (p >= 0) bbq = 0.55;
      else bbq = 0.35;
    }
    return { v: ext * 0.45 + pos * 0.3 + bbq * 0.25, notes: notes };
  }

  function volatilityScore(a, isEtf) {
    if (!a) return { v: 0.5, notes: [] };
    const notes = [];
    let v = 0.5;
    if (a.atrPct !== null) {
      const x = a.atrPct;
      if (x < 1.2) v = 1;
      else if (x < 2) v = 0.85;
      else if (x < 3) v = 0.62;
      else if (x < 4.5) v = 0.38;
      else v = 0.15;
      if (x >= 3) notes.push({ key: 'r_vol_high', params: { a: U.round(x, 2) } });
      else notes.push('r_vol_low');
    }
    if (isEtf) v = U.clamp(v + 0.08, 0, 1);
    return { v: v, notes: notes };
  }

  function newsScore(symbol) {
    const s = (AP.news && AP.news.sentimentFor) ? AP.news.sentimentFor(symbol) : { score: 0, count: 0 };
    const notes = [];
    if (!s.count) notes.push('r_news_none');
    else if (s.score < -0.2) notes.push('r_news_neg');
    else if (s.score > 0.2) notes.push('r_news_pos');
    else notes.push('r_news_none');
    return { v: U.clamp(0.5 + s.score * 0.5, 0, 1), notes: notes, raw: s };
  }

  /* ---------- trade plan ---------- */
  function buildPlan(a, symbol) {
    if (!a || !a.price) return null;
    const price = a.price;
    const atr = a.atr || price * 0.02;
    let stop = price - 2 * atr;
    if (a.support && a.support < price * 0.995) {
      stop = Math.max(Math.min(a.support * 0.99, price - 1.2 * atr), price - 3 * atr);
    }
    stop = Math.min(stop, price * 0.98);
    const risk = Math.max(price - stop, price * 0.005);
    let t1 = price + 1.5 * risk;
    let t2 = price + 3 * risk;
    if (a.resistance && a.resistance > price * 1.005) {
      if (a.resistance < t1) { t1 = a.resistance; t2 = Math.max(price + 2.2 * risk, a.resistance * 1.06); }
      else if (a.resistance < t2) { t2 = Math.max(a.resistance, price + 2.4 * risk); }
    }
    const rr = (t1 - price) / risk;
    return {
      entry: price,
      zoneLow: price - 0.6 * atr,
      zoneHigh: price + 0.3 * atr,
      stop: stop,
      t1: t1,
      t2: t2,
      risk: risk,
      riskPct: (risk / price) * 100,
      rr: rr,
      rr2: (t2 - price) / risk
    };
  }

  function sizing(symbol, plan, score, regime) {
    const st = AP.store.settings();
    const pf = AP.portfolio.summary();
    const equity = pf.equity || st.initialCapital;
    const isEtf = AP.store.isEtf(symbol);
    const cap = isEtf ? st.risk.maxEtf : st.risk.maxSingle;

    let pct = cap;
    if (plan && plan.riskPct > 0) {
      const riskBudget = equity * (st.risk.riskPerTrade / 100);
      const dollars = riskBudget / (plan.riskPct / 100);
      pct = Math.min(pct, (dollars / equity) * 100);
    }
    if (score < 80) pct *= 0.6;          // gradual entries are half-sized
    if (score < 65) pct *= 0.5;
    if (regime && regime.label === 'negative') pct *= 0.6;
    if (regime && regime.label === 'neutral') pct *= 0.85;

    // respect the existing weight in this asset
    const held = pf.positions[symbol];
    const heldPct = held ? (held.value / equity) * 100 : 0;
    pct = Math.max(0, Math.min(pct, cap - heldPct));

    // respect the minimum cash buffer
    const investable = Math.max(0, pf.cash - equity * (st.risk.minCash / 100));
    const byCash = equity ? (investable / equity) * 100 : 0;
    pct = Math.min(pct, byCash);

    const amount = equity * (pct / 100);
    return {
      pct: U.round(pct, 2),
      cap: cap,
      amount: amount,
      shares: plan && plan.entry ? Math.floor((amount / plan.entry) * 10000) / 10000 : 0,
      heldPct: U.round(heldPct, 2),
      cashLimited: byCash < cap
    };
  }

  /* ---------- checklist ---------- */
  function checklist(a, plan, regime, betterAlt, newsRaw) {
    const rows = [];
    // `ok` means "this is favourable for entry"; for inverted questions
    // ("has it risen excessively?") the literal answer is the opposite,
    // so each row also carries the plain yes/no the question asked for.
    const longRef = a && (a.sma200 || a.sma50);
    rows.push({
      q: 'q1',
      ok: !!(a && longRef && a.price > longRef && (!a.sma200Slope || a.sma200Slope >= -0.5)),
      val: a && a.sma200 ? 'SMA200 ' + U.round(a.sma200, 2) : (a && a.sma50 ? 'SMA50 ' + U.round(a.sma50, 2) : '—')
    });
    rows.push({
      q: 'q2',
      ok: !!(a && a.sma200 && a.price > a.sma200),
      val: a && a.sma200 ? U.round(a.price, 2) + ' / ' + U.round(a.sma200, 2) : '—'
    });
    rows.push({
      q: 'q3',
      ok: !!(a && a.sma50 && a.sma20 && a.price > a.sma50 && a.sma20 > a.sma50 * 0.98),
      val: a && a.sma50 ? 'SMA50 ' + U.round(a.sma50, 2) : '—'
    });
    rows.push({
      q: 'q4',
      ok: !!(a && a.rsi !== null && a.rsi >= 40 && a.rsi <= 70),
      val: a && a.rsi !== null ? U.round(a.rsi, 1) : '—'
    });
    const overshoot = a && ((a.chg5d !== null && a.chg5d > 12) || (a.extAboveSma200 !== null && a.extAboveSma200 > 28));
    rows.push({
      q: 'q5', ok: !overshoot, invert: true,
      val: a && a.chg5d !== null ? U.pct(a.chg5d, 1) + ' / 5d' : '—'
    });
    const negNews = newsRaw && newsRaw.score < -0.2;
    rows.push({ q: 'q6', ok: !negNews, invert: true, val: negNews ? AP.t('negative') : AP.t('none') });
    rows.push({ q: 'q7', ok: regime.label !== 'negative', val: AP.t('market_' + regime.label) });
    rows.push({
      q: 'q8', ok: !!(plan && plan.rr >= 1.5), noAnswer: true,   // a ratio, not a yes/no
      val: plan ? U.iso(U.round(plan.rr, 2) + ' : 1') : '—'
    });
    rows.push({
      q: 'q9', ok: !betterAlt, invert: true,
      val: betterAlt || '—'
    });
    rows.forEach(function (r) {
      r.answer = r.invert ? (r.ok ? 'no' : 'yes') : (r.ok ? 'yes' : 'no');
    });
    return rows;
  }

  /* ---------- main evaluation ---------- */
  function evaluate(symbol, regime, opts) {
    opts = opts || {};
    const bars = AP.market.seriesWithManual(symbol);
    const a = (bars && bars.length > 3) ? AP.ind.analyze(bars) : null;
    if (!a) {
      return {
        symbol: symbol, ok: false, score: null, ind: null,
        band: BANDS[BANDS.length - 1], decision: 'dec_none',
        reasons: ['r_insufficient_history'], confidence: 'conf_low'
      };
    }

    const isEtf = AP.store.isEtf(symbol);
    const t = trendScore(a);
    const m = momentumScore(a);
    const val = valuationScore(a);
    const vol = volatilityScore(a, isEtf);
    const nws = newsScore(symbol);
    const plan = buildPlan(a, symbol);
    const rrq = plan ? U.clamp((plan.rr - 0.8) / 1.7, 0, 1) : 0.4;
    const mkt = regime.norm;

    let raw =
      t.v * WEIGHTS.trend +
      m.v * WEIGHTS.momentum +
      val.v * WEIGHTS.valuation +
      vol.v * WEIGHTS.volatility +
      mkt * WEIGHTS.market +
      nws.v * WEIGHTS.news +
      rrq * WEIGHTS.rr;

    const penalties = [];
    if (a.chg5d !== null && a.chg5d > 12) { raw -= 7; penalties.push('chase'); }
    if (a.rsi !== null && a.rsi > 78) { raw -= 5; penalties.push('overbought'); }
    if (a.sma200 && a.sma50 && a.price < a.sma200 && a.sma50 < a.sma200) raw = Math.min(raw, 46);
    if (nws.raw && nws.raw.score < -0.4) raw = Math.min(raw, 55);

    // low-confidence data is pulled toward neutral rather than trusted
    const src = AP.market.sourceOf(symbol);
    let confidence = 'conf_high';
    if (a.bars < 60 || src === 'demo') confidence = 'conf_low';
    else if (a.bars < 200) confidence = 'conf_med';
    if (a.bars < 60) raw = 50 + (raw - 50) * 0.7;

    const score = U.clamp(Math.round(raw), 0, 100);
    const band = bandOf(score);

    // ---- reasons ----
    const reasons = [];
    function push(list) {
      list.forEach(function (n) {
        if (!n) return;
        reasons.push(typeof n === 'string' ? { key: n, params: null } : n);
      });
    }
    push(t.notes); push(m.notes); push(val.notes); push(vol.notes); push(nws.notes);
    reasons.push({ key: regime.label === 'positive' ? 'r_market_pos' : regime.label === 'negative' ? 'r_market_neg' : 'r_market_neutral', params: null });
    if (plan) reasons.push({ key: plan.rr >= 1.5 ? 'r_rr_good' : 'r_rr_bad', params: { a: U.round(plan.rr, 2) + ':1' } });
    if (a.rsi !== null && a.rsi <= 70 && score >= 60) reasons.push({ key: 'r_no_overbought', params: null });
    if (confidence === 'conf_low') reasons.push({ key: 'r_insufficient_history', params: null });

    const size = sizing(symbol, plan, score, regime);

    const trendLabel = (a.sma50 && a.sma200)
      ? (a.price > a.sma200 && a.sma50 > a.sma200 ? 'trend_up'
        : a.price < a.sma200 && a.sma50 < a.sma200 ? 'trend_down' : 'trend_side')
      : (a.sma20 && a.price > a.sma20 ? 'trend_up' : 'trend_side');

    const riskLabel = a.atrPct === null ? 'risk_med'
      : a.atrPct < 1.8 ? 'risk_low' : a.atrPct < 3.2 ? 'risk_med' : 'risk_high';

    return {
      symbol: symbol,
      ok: true,
      ind: a,
      isEtf: isEtf,
      score: score,
      band: band,
      components: {
        trend: U.round(t.v * 100), momentum: U.round(m.v * 100),
        valuation: U.round(val.v * 100), volatility: U.round(vol.v * 100),
        market: U.round(mkt * 100), news: U.round(nws.v * 100), rr: U.round(rrq * 100)
      },
      weights: WEIGHTS,
      penalties: penalties,
      reasons: reasons,
      plan: plan,
      size: size,
      confidence: confidence,
      trendLabel: trendLabel,
      riskLabel: riskLabel,
      newsRaw: nws.raw,
      source: src
    };
  }

  /* ---------- decision layer ---------- */
  function decideFor(ev, regime, ranked) {
    if (!ev.ok) return { decision: 'dec_none', extra: [] };
    const pf = AP.portfolio.summary();
    const pos = pf.positions[ev.symbol];
    const st = AP.store.settings();
    const extra = [];
    const score = ev.score;

    if (pos && pos.qty > 0) {
      const openPlan = AP.journal.latestPlanFor(ev.symbol);
      const price = ev.ind.price;
      if (openPlan && price <= openPlan.stop) {
        extra.push({ key: 'r_stop_hit', params: null });
        return { decision: 'dec_exit', extra: extra };
      }
      if (score < 35) return { decision: 'dec_exit', extra: extra };
      if (score < 50) return { decision: 'dec_trim', extra: extra };
      if (openPlan && price >= openPlan.t1 && pos.plPct > 0) {
        extra.push({ key: 'r_target_hit', params: null });
        return { decision: 'dec_take_profit', extra: extra };
      }
      if (pos.plPct >= 20 && ev.ind.rsi !== null && ev.ind.rsi > 72) {
        extra.push({ key: 'r_target_hit', params: null });
        return { decision: 'dec_take_profit', extra: extra };
      }
      const cap = ev.isEtf ? st.risk.maxEtf : st.risk.maxSingle;
      if (score >= 65 && ev.size.heldPct < cap - 1 && ev.size.pct > 0.3 && regime.label !== 'negative') {
        return { decision: 'dec_scale_in', extra: extra };
      }
      if (ev.size.heldPct >= cap - 1) extra.push({ key: 'r_cap_reached', params: null });
      return { decision: 'dec_wait', extra: extra };
    }

    // not held
    if (ev.size.pct < 0.25) {
      extra.push({ key: 'r_cap_reached', params: null });
      return { decision: 'dec_wait', extra: extra };
    }
    if (regime.label === 'negative' && score < 80) return { decision: 'dec_wait', extra: extra };
    if (!ev.plan || ev.plan.rr < 1.2) return { decision: 'dec_wait', extra: extra };
    if (score >= 80) return { decision: 'dec_buy', extra: extra };
    if (score >= 65) return { decision: 'dec_scale_in', extra: extra };
    return { decision: 'dec_wait', extra: extra };
  }

  const Signals = {
    WEIGHTS: WEIGHTS,
    BANDS: BANDS,
    bandOf: bandOf,
    marketRegime: marketRegime,
    buildPlan: buildPlan,

    /* Evaluate the whole watchlist and rank it. */
    scanAll() {
      const regime = marketRegime();
      const evals = AP.store.symbols().map(function (s) { return evaluate(s, regime); });
      evals.sort(function (x, y) { return (y.score || 0) - (x.score || 0); });

      const bestSym = evals.length && evals[0].ok ? evals[0].symbol : null;
      evals.forEach(function (ev) {
        const better = (bestSym && ev.symbol !== bestSym && evals[0].score - (ev.score || 0) >= 8) ? bestSym : null;
        const d = decideFor(ev, regime, evals);
        ev.decision = d.decision;
        d.extra.forEach(function (e) { ev.reasons.push(e); });
        if (better) ev.betterAlt = better;
        ev.checklist = ev.ok
          ? checklist(ev.ind, ev.plan, regime, better, ev.newsRaw)
          : [];
      });

      // pick today's headline idea: highest scoring actionable candidate
      let pick = null;
      for (let i = 0; i < evals.length; i++) {
        const e = evals[i];
        if (!e.ok) continue;
        if ((e.decision === 'dec_buy' || e.decision === 'dec_scale_in') && e.score >= 65 && e.size.pct >= 0.25) {
          pick = e; break;
        }
      }
      const holdingActions = evals.filter(function (e) {
        return e.ok && ['dec_exit', 'dec_trim', 'dec_take_profit'].indexOf(e.decision) >= 0;
      });

      return { regime: regime, evals: evals, pick: pick, holdingActions: holdingActions, date: U.today() };
    },

    evaluate: evaluate,
    reasonText(r) {
      if (!r) return '';
      if (typeof r === 'string') return AP.t(r);
      return AP.t(r.key, r.params || undefined);
    }
  };

  AP.signals = Signals;
})(window);
