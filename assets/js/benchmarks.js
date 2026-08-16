/* Asaad Paper Invest — benchmark strategies (buy & hold, DCA, S&P 500) */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  function tradingDates() {
    const st = AP.store.settings();
    const start = st.startDate;
    const today = U.today();
    const dates = {};
    AP.store.s.snapshots.forEach(function (s) { if (s.date >= start) dates[s.date] = 1; });
    // fall back to the benchmark's own bar dates so the curve is not empty
    const bars = AP.market.seriesWithManual(st.benchmarkSymbol || 'VOO') || [];
    bars.forEach(function (b) { if (b.d >= start && b.d <= today) dates[b.d] = 1; });
    dates[start] = 1;
    dates[today] = 1;
    return Object.keys(dates).sort();
  }

  function priceAt(sym, date) {
    const p = AP.store.priceOn(sym, date);
    if (p !== null) return p;
    const bars = AP.market.seriesWithManual(sym);
    return bars && bars.length ? U.num(bars[0].c) : null;
  }

  const Bench = {
    dates: tradingDates,

    /* Invest the full starting capital in one asset on day 1. */
    buyHold(sym, capital) {
      const st = AP.store.settings();
      capital = U.num(capital, st.initialCapital);
      const dates = tradingDates();
      const p0 = priceAt(sym, st.startDate);
      if (!p0) return null;
      const shares = capital / p0;
      const series = dates.map(function (d) {
        const p = priceAt(sym, d) || p0;
        return { d: d, v: shares * p };
      });
      const last = series[series.length - 1];
      return {
        key: sym,
        shares: shares,
        entry: p0,
        series: series,
        value: last ? last.v : capital,
        retPct: capital ? ((last.v - capital) / capital) * 100 : 0
      };
    },

    /* Regular investing: capital split into equal monthly instalments,
       uninvested cash simply waits. */
    dca(sym, capital, instalments) {
      const st = AP.store.settings();
      capital = U.num(capital, st.initialCapital);
      const months = Math.max(1, instalments || Math.max(1, Math.round(st.experimentDays / 30)));
      const per = capital / months;
      const dates = tradingDates();
      if (!dates.length) return null;

      // contribution dates: start, +30d, +60d …
      const contribDates = [];
      for (let i = 0; i < months; i++) contribDates.push(U.addDays(st.startDate, i * 30));

      let shares = 0, cash = capital, ci = 0;
      const series = dates.map(function (d) {
        while (ci < contribDates.length && contribDates[ci] <= d) {
          const p = priceAt(sym, contribDates[ci]);
          if (p) { shares += per / p; cash -= per; }
          ci++;
        }
        const p = priceAt(sym, d) || 0;
        return { d: d, v: shares * p + Math.max(0, cash) };
      });
      const last = series[series.length - 1];
      return {
        key: 'DCA_' + sym,
        shares: shares,
        series: series,
        invested: capital - Math.max(0, cash),
        value: last ? last.v : capital,
        retPct: capital ? ((last.v - capital) / capital) * 100 : 0,
        instalments: months
      };
    },

    /* All benchmarks aligned with the portfolio equity curve. */
    all() {
      const st = AP.store.settings();
      const capital = st.initialCapital;
      const pfSeries = AP.portfolio.equitySeries();
      const pf = AP.portfolio.summary();
      const out = [];

      out.push({
        id: 'portfolio', labelKey: 'bench_portfolio', series: pfSeries,
        value: pf.equity, retPct: pf.totalPlPct, color: 'accent'
      });

      const spus = Bench.buyHold('SPUS', capital);
      if (spus) out.push({ id: 'spus', labelKey: 'bench_spus', series: spus.series, value: spus.value, retPct: spus.retPct, color: 'c2' });

      const voo = Bench.buyHold('VOO', capital);
      if (voo) out.push({ id: 'voo', labelKey: 'bench_voo', series: voo.series, value: voo.value, retPct: voo.retPct, color: 'c3' });

      // S&P 500 proxy — VOO tracks the index; SPY is used if present
      const spxSym = AP.store.series('SPY') ? 'SPY' : 'VOO';
      const spx = Bench.buyHold(spxSym, capital);
      if (spx) out.push({ id: 'spx', labelKey: 'bench_spx', series: spx.series, value: spx.value, retPct: spx.retPct, color: 'c4', note: spxSym });

      const dca = Bench.dca('VOO', capital, Math.max(1, Math.round(st.experimentDays / 30)));
      if (dca) out.push({ id: 'dca', labelKey: 'bench_dca', series: dca.series, value: dca.value, retPct: dca.retPct, color: 'c5' });

      return out;
    },

    priceAt: priceAt
  };

  AP.bench = Bench;
})(window);
