/* Asaad Paper Invest — "507 Strategy": three parallel monthly-investing tests */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  const ETF_MIX = { SPUS: 0.40, VOO: 0.30, QQQ: 0.30 };   // the 70% ETF sleeve of Strategy B
  const FALLBACK_GROWTH = ['MSFT', 'NVDA', 'AAPL'];

  function contributionDates() {
    const st = AP.store.settings();
    const start = st.startDate;
    const today = U.today();
    const out = [start];
    const d = U.parseDate(start);
    d.setDate(1);
    for (let i = 0; i < 24; i++) {
      d.setMonth(d.getMonth() + 1);
      const key = U.dateKey(d);
      if (key > today) break;
      if (key > start) out.push(key);
    }
    return out;
  }

  function priceAt(sym, date) { return AP.bench.priceAt(sym, date); }

  function growthBasket() {
    // top 3 non-ETF names by today's score, so the sleeve follows the system
    const scan = AP.lastScan;
    if (scan && scan.evals) {
      const picks = scan.evals
        .filter(function (e) { return e.ok && !e.isEtf; })
        .slice(0, 3)
        .map(function (e) { return e.symbol; });
      if (picks.length === 3) return picks;
    }
    return FALLBACK_GROWTH.filter(function (s) { return AP.store.series(s); }).slice(0, 3);
  }

  function valueOf(holdings, date) {
    return Object.keys(holdings).reduce(function (a, sym) {
      const p = priceAt(sym, date);
      return a + holdings[sym] * (p || 0);
    }, 0);
  }

  const S507 = {
    monthlyUsd() {
      const st = AP.store.settings();
      return U.num(st.monthlyOmr) * U.num(st.fxOmrUsd);
    },

    run() {
      const st = AP.store.settings();
      const monthly = S507.monthlyUsd();
      const dates = contributionDates();
      const axis = AP.bench.dates();
      const growth = growthBasket();

      const A = { id: 'A', holdings: {}, cash: 0, contributed: 0, log: [] };
      const B = { id: 'B', holdings: {}, cash: 0, contributed: 0, log: [] };
      const C = { id: 'C', holdings: {}, cash: 0, contributed: 0, log: [], deployments: [] };

      // pre-index historical scores captured in daily snapshots
      const scoreHistory = {};
      AP.store.s.snapshots.forEach(function (s) {
        if (s.scores) scoreHistory[s.date] = s.scores;
      });

      let ci = 0;
      const seriesA = [], seriesB = [], seriesC = [];

      axis.forEach(function (d) {
        // apply contributions due on or before this date
        while (ci < dates.length && dates[ci] <= d) {
          const cd = dates[ci];
          A.contributed += monthly; B.contributed += monthly; C.contributed += monthly;

          const pA = priceAt('SPUS', cd);
          if (pA) {
            const sh = monthly / pA;
            A.holdings.SPUS = (A.holdings.SPUS || 0) + sh;
            A.log.push({ date: cd, symbol: 'SPUS', price: pA, shares: sh, amount: monthly });
          } else { A.cash += monthly; }

          Object.keys(ETF_MIX).forEach(function (sym) {
            const amt = monthly * 0.7 * ETF_MIX[sym];
            const p = priceAt(sym, cd);
            if (p) {
              const sh = amt / p;
              B.holdings[sym] = (B.holdings[sym] || 0) + sh;
              B.log.push({ date: cd, symbol: sym, price: p, shares: sh, amount: amt });
            } else B.cash += amt;
          });
          growth.forEach(function (sym) {
            const amt = monthly * 0.3 / Math.max(1, growth.length);
            const p = priceAt(sym, cd);
            if (p) {
              const sh = amt / p;
              B.holdings[sym] = (B.holdings[sym] || 0) + sh;
              B.log.push({ date: cd, symbol: sym, price: p, shares: sh, amount: amt });
            } else B.cash += amt;
          });

          C.cash += monthly;
          C.log.push({ date: cd, symbol: '—', price: null, shares: 0, amount: monthly });
          ci++;
        }

        // Strategy C deploys only when the system produced a score >= 70 that day
        const scores = scoreHistory[d];
        if (scores && C.cash > 0) {
          let bestSym = null, bestScore = 0;
          Object.keys(scores).forEach(function (sym) {
            const sc = U.num(scores[sym] && scores[sym].score !== undefined ? scores[sym].score : scores[sym]);
            if (sc >= 70 && sc > bestScore) { bestScore = sc; bestSym = sym; }
          });
          if (bestSym) {
            const p = priceAt(bestSym, d);
            if (p) {
              const sh = C.cash / p;
              C.holdings[bestSym] = (C.holdings[bestSym] || 0) + sh;
              C.deployments.push({ date: d, symbol: bestSym, price: p, shares: sh, amount: C.cash, score: bestScore });
              C.cash = 0;
            }
          }
        }

        seriesA.push({ d: d, v: valueOf(A.holdings, d) + A.cash });
        seriesB.push({ d: d, v: valueOf(B.holdings, d) + B.cash });
        seriesC.push({ d: d, v: valueOf(C.holdings, d) + C.cash });
      });

      function pack(s, series, nameKey, descKey) {
        const value = series.length ? series[series.length - 1].v : s.contributed;
        return {
          id: s.id,
          nameKey: nameKey,
          descKey: descKey,
          contributed: s.contributed,
          value: value,
          cash: s.cash,
          gain: value - s.contributed,
          gainPct: s.contributed ? ((value - s.contributed) / s.contributed) * 100 : 0,
          holdings: s.holdings,
          log: s.log,
          deployments: s.deployments || [],
          series: series
        };
      }

      const result = {
        monthlyOmr: st.monthlyOmr,
        fx: st.fxOmrUsd,
        monthlyUsd: monthly,
        contributions: dates,
        growthBasket: growth,
        etfMix: ETF_MIX,
        A: pack(A, seriesA, 'strat_a', 'strat_a_desc'),
        B: pack(B, seriesB, 'strat_b', 'strat_b_desc'),
        C: pack(C, seriesC, 'strat_c', 'strat_c_desc'),
        ranAt: Date.now()
      };
      const ranked = ['A', 'B', 'C'].sort(function (x, y) { return result[y].gainPct - result[x].gainPct; });
      result.best = ranked[0];
      result.worst = ranked[ranked.length - 1];

      AP.store.s.s507 = { lastRun: Date.now(), strategies: result, contributions: dates };
      AP.store.save();
      return result;
    },

    latest() {
      const s = AP.store.s.s507;
      return s && s.strategies ? s.strategies : null;
    },

    ensure() {
      const cur = S507.latest();
      if (!cur) return S507.run();
      const age = Date.now() - U.num(AP.store.s.s507.lastRun);
      if (age > 6 * 3600 * 1000) return S507.run();
      return cur;
    }
  };

  AP.s507 = S507;
})(window);
