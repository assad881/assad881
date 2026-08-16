/* Asaad Paper Invest — in-platform alert rules */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  const Alerts = {
    /* Runs after every scan. Alerts are de-duplicated per symbol per day. */
    evaluate(scan) {
      const store = AP.store;
      const pf = AP.portfolio.summary();
      const today = U.today();

      scan.evals.forEach(function (ev) {
        if (!ev.ok || !ev.ind) return;
        const a = ev.ind;
        const sym = ev.symbol;

        if (ev.score >= 80) {
          store.pushAlert('score80', 'good', 'alert_score80', { a: sym, b: ev.score }, sym);
        }
        if (a.rsi !== null) {
          if (a.rsi > 70) store.pushAlert('rsi70', 'warn', 'alert_rsi70', { a: sym, b: U.round(a.rsi, 1) }, sym);
          if (a.rsi < 30) store.pushAlert('rsi30', 'warn', 'alert_rsi30', { a: sym, b: U.round(a.rsi, 1) }, sym);
        }
        // SMA200 break: closed above yesterday, below today
        if (a.sma200 && a.price < a.sma200) {
          const bars = AP.market.seriesWithManual(sym);
          if (bars.length > 201) {
            const prevCloses = bars.slice(0, -1).map(function (b) { return U.num(b.c); });
            const prevSma = AP.ind.sma(prevCloses, 200);
            if (prevSma && prevCloses[prevCloses.length - 1] > prevSma) {
              store.pushAlert('sma200', 'bad', 'alert_sma200', { a: sym }, sym);
            }
          }
        }
        if (a.atrPct !== null && a.atrPct > 3.5) {
          store.pushAlert('vol', 'warn', 'alert_vol', { a: sym, b: U.round(a.atrPct, 1) }, sym);
        }
        const earnings = store.s.earnings[sym];
        if (earnings) {
          const d = U.daysBetween(today, earnings);
          if (d >= 0 && d <= 7) {
            store.pushAlert('earnings', 'info', 'alert_earnings', { a: sym, b: earnings }, sym);
          }
        }

        // position-specific alerts
        const pos = pf.positions[sym];
        if (pos) {
          const dayPct = pos.dayPlPct;
          const threshold = a.atrPct !== null ? Math.max(4, a.atrPct * 2) : 5;
          if (dayPct <= -threshold) {
            store.pushAlert('drop', 'bad', 'alert_drop', { a: sym, b: U.pct(dayPct, 2) }, sym);
          }
          const plan = AP.journal.latestPlanFor(sym);
          if (plan) {
            if (a.price >= plan.t1) {
              store.pushAlert('target', 'good', 'alert_target', { a: sym, b: U.round(plan.t1, 2) }, sym);
            }
            if (a.price <= plan.stop) {
              store.pushAlert('stop', 'bad', 'alert_stop', { a: sym, b: U.round(plan.stop, 2) }, sym);
            }
          }
        }
      });

      // market-wide volatility
      if (scan.regime.ind && scan.regime.ind.atrPct !== null && scan.regime.ind.atrPct > 1.8) {
        AP.store.pushAlert('marketvol', 'warn', 'alert_vol',
          { a: scan.regime.proxy, b: U.round(scan.regime.ind.atrPct, 1) }, scan.regime.proxy);
      }
      AP.store.save();
    },

    text(alert) {
      return AP.t(alert.key, alert.params);
    },
    markAllRead() {
      AP.store.s.alerts.forEach(function (a) { a.read = true; });
      AP.store.save();
    },
    clear() {
      AP.store.s.alerts = [];
      AP.store.save();
    }
  };

  AP.alerts = Alerts;
})(window);
