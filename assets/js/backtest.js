/* Asaad Paper Invest — replay engine.
   Moves the whole app back in time (AP.asOf) and lets the same signal engine
   walk forward day by day, so the past N trading days can be replayed exactly
   as the system would have decided them. Indicators only ever see bars up to
   the simulated day — there is no look-ahead. */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  function tradingDays(fromDate, toDate) {
    const ref = AP.store.settings().marketProxy || 'VOO';
    const bars = AP.store.series(ref) || AP.store.series(AP.store.symbols()[0]) || [];
    return bars.map(function (b) { return b.d; })
      .filter(function (d) { return d >= fromDate && d <= toDate; });
  }

  const Backtest = {
    running: false,

    /* Replay the last `days` calendar days. Resets cash, positions, journal,
       snapshots and alerts; keeps the watchlist, settings and news. */
    run(days, onProgress) {
      if (Backtest.running) return Promise.resolve(null);
      const st = AP.store.settings();
      const realToday = U.realToday();
      const start = U.addDays(realToday, -Math.abs(days) + 1);

      const dates = tradingDays(start, realToday);
      if (dates.length < 5) {
        return Promise.reject(new Error('not enough price history to replay'));
      }

      // fresh experiment starting at the first replayed trading day
      st.startDate = dates[0];
      AP.store.s.cash = st.initialCapital;
      AP.store.s.positions = {};
      AP.store.s.transactions = [];
      AP.store.s.journal = [];
      AP.store.s.snapshots = [];
      AP.store.s.alerts = [];
      AP.store.s.s507 = { lastRun: null, strategies: null, contributions: [] };

      Backtest.running = true;
      let i = 0;
      const CHUNK = 6;

      return new Promise(function (resolve, reject) {
        function step() {
          try {
            const end = Math.min(i + CHUNK, dates.length);
            for (; i < end; i++) {
              Backtest.simulateDay(dates[i]);
            }
            if (onProgress) onProgress(i, dates.length, dates[Math.min(i, dates.length - 1)]);
            if (i < dates.length) {
              setTimeout(step, 0);
            } else {
              AP.asOf = null;
              Backtest.running = false;   // re-enables persistence
              AP.journal.updateFollowUps();
              try { AP.s507.run(); } catch (e) { console.warn('507 replay failed', e); }
              AP.store.save();
              resolve({ days: dates.length, from: dates[0], to: dates[dates.length - 1] });
            }
          } catch (e) {
            AP.asOf = null;
            Backtest.running = false;
            reject(e);
          }
        }
        setTimeout(step, 0);
      });
    },

    /* One simulated trading day, using only data available on that day. */
    simulateDay(date) {
      AP.asOf = date;
      const scan = AP.signals.scanAll();
      AP.lastScan = scan;

      // alerts are a live-monitoring feature; replaying them would just
      // backfill hundreds of stale notifications
      AP.journal.logScan(scan);

      // 1) act on existing positions first so cash is freed before buying
      scan.holdingActions.forEach(function (ev) {
        const pos = AP.portfolio.positionOf(ev.symbol);
        if (!pos) return;
        const price = ev.ind.price;
        let qty = 0;
        if (ev.decision === 'dec_exit') qty = pos.qty;
        else if (ev.decision === 'dec_take_profit') qty = pos.qty * 0.5;
        else if (ev.decision === 'dec_trim') qty = pos.qty / 3;
        qty = AP.portfolio.dustAdjustedQty(ev.symbol, Math.floor(qty * 10000) / 10000, price);
        if (qty > 0) {
          AP.portfolio.sell(ev.symbol, qty, price, {
            date: date, decision: ev.decision, score: ev.score,
            note: 'replay'
          });
        }
      });

      // 2) at most one new entry per day — the system's single best idea
      const pick = scan.pick;
      if (pick && pick.size && pick.size.pct >= 0.25) {
        const price = pick.ind.price;
        const qty = Math.floor((pick.size.amount / price) * 10000) / 10000;
        if (qty > 0) {
          const res = AP.portfolio.buy(pick.symbol, qty, price, {
            date: date, decision: pick.decision, score: pick.score,
            plan: pick.plan, note: 'replay'
          });
          if (res.ok) {
            const entry = AP.store.s.journal.find(function (e) {
              return e.date === date && e.symbol === pick.symbol;
            });
            if (entry) entry.executed = true;
          }
        }
      }

      AP.journal.updateFollowUps();
      AP.store.saveSnapshot({
        scores: (function () {
          const out = {};
          scan.evals.forEach(function (e) {
            if (e.ok) out[e.symbol] = { score: e.score, decision: e.decision, band: e.band.key };
          });
          return out;
        })(),
        regime: scan.regime.label,
        breadth: U.round(scan.regime.breadth, 1),
        replay: true
      });
    }
  };

  AP.backtest = Backtest;
})(window);
