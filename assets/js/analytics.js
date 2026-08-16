/* Asaad Paper Invest — performance analytics */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  const Analytics = {
    compute() {
      const st = AP.store.settings();
      const pf = AP.portfolio.summary();
      const closed = AP.portfolio.closedTrades();
      const eq = AP.portfolio.equitySeries();
      const equityValues = eq.map(function (r) { return r.v; });

      const wins = closed.filter(function (t) { return t.pl > 0; });
      const losses = closed.filter(function (t) { return t.pl < 0; });
      const grossWin = U.sum(wins.map(function (t) { return t.pl; }));
      const grossLoss = Math.abs(U.sum(losses.map(function (t) { return t.pl; })));

      const bySymbol = {};
      closed.forEach(function (t) {
        if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { symbol: t.symbol, trades: 0, pl: 0, wins: 0, retSum: 0 };
        const b = bySymbol[t.symbol];
        b.trades++; b.pl += t.pl; b.retSum += t.plPct;
        if (t.pl > 0) b.wins++;
      });
      // include open positions in the per-asset view
      Object.keys(pf.positions).forEach(function (s) {
        if (!bySymbol[s]) bySymbol[s] = { symbol: s, trades: 0, pl: 0, wins: 0, retSum: 0 };
        bySymbol[s].openPl = pf.positions[s].pl;
        bySymbol[s].openPlPct = pf.positions[s].plPct;
      });
      Object.keys(bySymbol).forEach(function (s) {
        const b = bySymbol[s];
        b.winRate = b.trades ? (b.wins / b.trades) * 100 : null;
        b.avgRet = b.trades ? b.retSum / b.trades : null;
        b.total = U.num(b.pl) + U.num(b.openPl);
      });

      const byDecision = {};
      closed.forEach(function (t) {
        const k = t.decision || 'dec_manual';
        if (!byDecision[k]) byDecision[k] = { key: k, trades: 0, pl: 0, wins: 0, retSum: 0 };
        const b = byDecision[k];
        b.trades++; b.pl += t.pl; b.retSum += t.plPct;
        if (t.pl > 0) b.wins++;
      });
      Object.keys(byDecision).forEach(function (k) {
        const b = byDecision[k];
        b.winRate = b.trades ? (b.wins / b.trades) * 100 : null;
        b.avgRet = b.trades ? b.retSum / b.trades : null;
      });

      const best = closed.slice().sort(function (a, b) { return b.plPct - a.plPct; })[0] || null;
      const worst = closed.slice().sort(function (a, b) { return a.plPct - b.plPct; })[0] || null;

      return {
        equity: pf.equity,
        initial: st.initialCapital,
        totalReturn: pf.totalPl,
        totalReturnPct: pf.totalPlPct,
        realized: pf.realized,
        unrealized: pf.unrealized,
        cash: pf.cash,
        cashWeight: pf.cashWeight,
        invested: pf.invested,
        dayPl: pf.dayPl,
        dayPlPct: pf.dayPlPct,
        tradesCount: closed.length,
        winCount: wins.length,
        lossCount: losses.length,
        winRate: closed.length ? (wins.length / closed.length) * 100 : null,
        lossRate: closed.length ? (losses.length / closed.length) * 100 : null,
        avgGain: wins.length ? U.mean(wins.map(function (t) { return t.plPct; })) : null,
        avgLoss: losses.length ? U.mean(losses.map(function (t) { return t.plPct; })) : null,
        avgGainUsd: wins.length ? U.mean(wins.map(function (t) { return t.pl; })) : null,
        avgLossUsd: losses.length ? U.mean(losses.map(function (t) { return t.pl; })) : null,
        profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : null),
        maxDrawdown: equityValues.length > 1 ? AP.ind.maxDrawdown(equityValues) : 0,
        drawdownSeries: eq.map(function (r, i) {
          return { d: r.d, v: AP.ind.drawdownSeries(equityValues)[i] };
        }),
        sharpe: AP.ind.sharpe(equityValues),
        avgHold: closed.length ? U.mean(closed.map(function (t) { return t.holdDays; })) : null,
        bestTrade: best,
        worstTrade: worst,
        bySymbol: bySymbol,
        byDecision: byDecision,
        closed: closed,
        equitySeries: eq,
        positionsCount: Object.keys(pf.positions).length
      };
    },

    /* Compare the active portfolio against every benchmark. */
    benchmarkTable() {
      const rows = AP.bench.all();
      const pfRow = rows.find(function (r) { return r.id === 'portfolio'; });
      return rows.map(function (r) {
        return Object.assign({}, r, {
          diff: pfRow ? r.retPct - pfRow.retPct : 0,
          isPortfolio: r.id === 'portfolio'
        });
      });
    },

    /* Did timing add value versus simply investing regularly? */
    timingVerdict() {
      const rows = AP.analytics.benchmarkTable();
      const pf = rows.find(function (r) { return r.id === 'portfolio'; });
      const dca = rows.find(function (r) { return r.id === 'dca'; });
      if (!pf || !dca) return { key: 'timing_equal', params: { a: '—' }, delta: 0 };
      const delta = pf.retPct - dca.retPct;
      if (Math.abs(delta) < 0.5) return { key: 'timing_equal', params: {}, delta: delta };
      return {
        key: delta > 0 ? 'timing_yes' : 'timing_no',
        params: { a: U.pct(Math.abs(delta)) },
        delta: delta
      };
    }
  };

  AP.analytics = Analytics;
})(window);
