/* Asaad Paper Invest — decision log.
   Every recommendation is stored (executed or not) and re-scored later
   at +1 day, +1 week and +1 month so signal quality can be judged. */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  const ACTIONABLE = ['dec_buy', 'dec_scale_in', 'dec_take_profit', 'dec_trim', 'dec_exit'];
  const BULLISH = ['dec_buy', 'dec_scale_in'];
  const BEARISH = ['dec_exit', 'dec_trim', 'dec_take_profit'];

  const Journal = {
    entries() { return AP.store.s.journal; },

    exists(date, symbol, decision) {
      return AP.store.s.journal.some(function (e) {
        return e.date === date && e.symbol === symbol && e.decision === decision;
      });
    },

    add(ev, opts) {
      opts = opts || {};
      const date = opts.date || U.today();
      if (Journal.exists(date, ev.symbol, ev.decision)) {
        return AP.store.s.journal.find(function (e) {
          return e.date === date && e.symbol === ev.symbol && e.decision === ev.decision;
        });
      }
      const entry = {
        id: U.uid('jr'),
        date: date,
        ts: Date.now(),
        symbol: ev.symbol,
        price: ev.ind ? ev.ind.price : AP.store.lastPrice(ev.symbol),
        score: ev.score,
        band: ev.band ? ev.band.key : null,
        decision: ev.decision,
        reasons: (ev.reasons || []).map(function (r) {
          return typeof r === 'string' ? { key: r, params: null } : { key: r.key, params: r.params || null };
        }),
        plan: ev.plan ? {
          entry: U.round(ev.plan.entry, 4), zoneLow: U.round(ev.plan.zoneLow, 4),
          zoneHigh: U.round(ev.plan.zoneHigh, 4), stop: U.round(ev.plan.stop, 4),
          t1: U.round(ev.plan.t1, 4), t2: U.round(ev.plan.t2, 4), rr: U.round(ev.plan.rr, 2)
        } : null,
        size: ev.size ? { pct: ev.size.pct, amount: U.round(ev.size.amount, 2) } : null,
        indicators: ev.ind ? {
          rsi: ev.ind.rsi === null ? null : U.round(ev.ind.rsi, 1),
          sma20: U.round(ev.ind.sma20, 2), sma50: U.round(ev.ind.sma50, 2), sma200: U.round(ev.ind.sma200, 2),
          macdHist: ev.ind.macd ? U.round(ev.ind.macd.hist, 4) : null,
          atrPct: ev.ind.atrPct === null ? null : U.round(ev.ind.atrPct, 2),
          chg5d: ev.ind.chg5d === null ? null : U.round(ev.ind.chg5d, 2),
          fromHigh: ev.ind.fromHigh === null ? null : U.round(ev.ind.fromHigh, 2)
        } : null,
        components: ev.components || null,
        regime: opts.regime || null,
        confidence: ev.confidence || null,
        executed: false,
        txId: null,
        followUp: { d1: null, w1: null, m1: null },
        outcome: 'pending',
        outcomePct: null,
        source: ev.source || null
      };
      AP.store.s.journal.unshift(entry);
      if (AP.store.s.journal.length > 2000) AP.store.s.journal.length = 2000;
      return entry;
    },

    /* Log the whole daily scan: the headline pick plus every actionable call. */
    logScan(scan) {
      const date = scan.date || U.today();
      const regimeInfo = { label: scan.regime.label, breadth: U.round(scan.regime.breadth, 1) };
      let logged = 0;
      scan.evals.forEach(function (ev) {
        if (!ev.ok) return;
        if (ACTIONABLE.indexOf(ev.decision) < 0) return;
        // only log entries the system would actually act on
        if (BULLISH.indexOf(ev.decision) >= 0 && ev.score < 65) return;
        const before = AP.store.s.journal.length;
        Journal.add(ev, { date: date, regime: regimeInfo });
        if (AP.store.s.journal.length > before) logged++;
      });
      if (!scan.pick && !Journal.exists(date, '—', 'dec_none')) {
        AP.store.s.journal.unshift({
          id: U.uid('jr'), date: date, ts: Date.now(), symbol: '—',
          price: null, score: null, band: null, decision: 'dec_none',
          reasons: [{ key: 'no_trade_reason', params: null }],
          plan: null, size: null, indicators: null, components: null,
          regime: regimeInfo, confidence: null, executed: false, txId: null,
          followUp: { d1: null, w1: null, m1: null }, outcome: 'n/a', outcomePct: null
        });
        logged++;
      }
      if (logged) AP.store.save();
      return logged;
    },

    markExecuted(entryId, txId) {
      const e = AP.store.s.journal.find(function (x) { return x.id === entryId; });
      if (e) { e.executed = true; e.txId = txId || null; AP.store.save(); }
    },

    latestPlanFor(symbol) {
      const e = AP.store.s.journal.find(function (x) {
        return x.symbol === symbol && x.plan && BULLISH.indexOf(x.decision) >= 0;
      });
      return e ? e.plan : null;
    },

    /* Fill in +1d / +1w / +1m prices and grade each signal. */
    updateFollowUps() {
      let changed = 0;
      const today = U.today();
      AP.store.s.journal.forEach(function (e) {
        if (!e.symbol || e.symbol === '—' || !e.price) return;
        const horizons = [['d1', 1], ['w1', 7], ['m1', 30]];
        horizons.forEach(function (h) {
          const key = h[0], days = h[1];
          if (e.followUp[key] !== null && e.followUp[key] !== undefined) return;
          const target = U.addDays(e.date, days);
          if (target > today) return;
          const hit = AP.store.priceOnOrAfter(e.symbol, target);
          if (!hit || hit.date <= e.date) return;   // no session after the signal yet
          e.followUp[key] = {
            date: hit.date,
            price: U.round(hit.price, 4),
            ret: U.round(((hit.price - e.price) / e.price) * 100, 2)
          };
          changed++;
        });
        const graded = Journal.grade(e);
        if (graded.outcome !== e.outcome || graded.outcomePct !== e.outcomePct) {
          e.outcome = graded.outcome;
          e.outcomePct = graded.outcomePct;
          changed++;
        }
      });
      if (changed) AP.store.save();
      return changed;
    },

    grade(e) {
      if (!e.price || e.decision === 'dec_none' || e.decision === 'dec_wait') {
        return { outcome: e.decision === 'dec_none' ? 'n/a' : 'pending', outcomePct: null };
      }
      const fu = e.followUp || {};
      const best = fu.m1 || fu.w1 || fu.d1;
      if (!best) return { outcome: 'pending', outcomePct: null };
      const ret = U.num(best.ret);
      const isBull = BULLISH.indexOf(e.decision) >= 0;
      // for defensive calls, a falling price means the call was right
      const effective = isBull ? ret : -ret;
      const threshold = fu.m1 ? 1.5 : fu.w1 ? 1.0 : 0.5;
      let outcome;
      if (effective > threshold) outcome = 'success';
      else if (effective < -threshold) outcome = 'fail';
      else outcome = 'partial';
      return { outcome: outcome, outcomePct: U.round(ret, 2) };
    },

    /* ---------- quality statistics ---------- */
    stats() {
      const list = AP.store.s.journal.filter(function (e) {
        return e.symbol !== '—' && ACTIONABLE.indexOf(e.decision) >= 0;
      });
      const graded = list.filter(function (e) { return ['success', 'fail', 'partial'].indexOf(e.outcome) >= 0; });
      const byBand = {}, byDecision = {}, bySymbol = {};

      function bucket(map, key, e) {
        if (!map[key]) map[key] = { total: 0, success: 0, fail: 0, partial: 0, retSum: 0, graded: 0 };
        const b = map[key];
        b.total++;
        if (['success', 'fail', 'partial'].indexOf(e.outcome) >= 0) {
          b[e.outcome]++;
          b.graded++;
          b.retSum += U.num(e.outcomePct);
        }
      }
      list.forEach(function (e) {
        bucket(byBand, e.band || 'unknown', e);
        bucket(byDecision, e.decision, e);
        bucket(bySymbol, e.symbol, e);
      });
      function rate(b) { return b.graded ? (b.success / b.graded) * 100 : null; }
      Object.keys(byBand).forEach(function (k) { byBand[k].hitRate = rate(byBand[k]); byBand[k].avgRet = byBand[k].graded ? byBand[k].retSum / byBand[k].graded : null; });
      Object.keys(byDecision).forEach(function (k) { byDecision[k].hitRate = rate(byDecision[k]); byDecision[k].avgRet = byDecision[k].graded ? byDecision[k].retSum / byDecision[k].graded : null; });
      Object.keys(bySymbol).forEach(function (k) { bySymbol[k].hitRate = rate(bySymbol[k]); bySymbol[k].avgRet = bySymbol[k].graded ? bySymbol[k].retSum / bySymbol[k].graded : null; });

      const successCount = graded.filter(function (e) { return e.outcome === 'success'; }).length;
      return {
        total: list.length,
        graded: graded.length,
        pending: list.length - graded.length,
        hitRate: graded.length ? (successCount / graded.length) * 100 : null,
        byBand: byBand,
        byDecision: byDecision,
        bySymbol: bySymbol,
        executedCount: list.filter(function (e) { return e.executed; }).length
      };
    },

    ACTIONABLE: ACTIONABLE,
    BULLISH: BULLISH,
    BEARISH: BEARISH
  };

  AP.journal = Journal;
})(window);
