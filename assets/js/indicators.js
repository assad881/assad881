/* Asaad Paper Invest — technical indicators
   Bars are objects: { d:'YYYY-MM-DD', o, h, l, c, v } sorted ascending by date. */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  function closes(bars) { return bars.map(function (b) { return U.num(b.c); }); }

  const IND = {
    sma(values, period) {
      if (!values || values.length < period) return null;
      let s = 0;
      for (let i = values.length - period; i < values.length; i++) s += values[i];
      return s / period;
    },

    smaSeries(values, period) {
      const out = new Array(values.length).fill(null);
      if (values.length < period) return out;
      let s = 0;
      for (let i = 0; i < values.length; i++) {
        s += values[i];
        if (i >= period) s -= values[i - period];
        if (i >= period - 1) out[i] = s / period;
      }
      return out;
    },

    emaSeries(values, period) {
      const out = new Array(values.length).fill(null);
      if (!values.length) return out;
      const k = 2 / (period + 1);
      let prev = null;
      for (let i = 0; i < values.length; i++) {
        if (i === period - 1) {
          let s = 0;
          for (let j = 0; j < period; j++) s += values[j];
          prev = s / period;
          out[i] = prev;
        } else if (i >= period) {
          prev = values[i] * k + prev * (1 - k);
          out[i] = prev;
        }
      }
      return out;
    },

    ema(values, period) {
      const s = IND.emaSeries(values, period);
      return U.last(s) === undefined ? null : U.last(s);
    },

    /* Wilder's RSI */
    rsiSeries(values, period) {
      const n = values.length;
      const out = new Array(n).fill(null);
      if (n <= period) return out;
      let gain = 0, loss = 0;
      for (let i = 1; i <= period; i++) {
        const ch = values[i] - values[i - 1];
        if (ch >= 0) gain += ch; else loss -= ch;
      }
      let ag = gain / period, al = loss / period;
      out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
      for (let i = period + 1; i < n; i++) {
        const ch = values[i] - values[i - 1];
        const g = ch > 0 ? ch : 0;
        const l = ch < 0 ? -ch : 0;
        ag = (ag * (period - 1) + g) / period;
        al = (al * (period - 1) + l) / period;
        out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
      }
      return out;
    },

    rsi(values, period) {
      const s = IND.rsiSeries(values, period || 14);
      return U.last(s);
    },

    macd(values, fast, slow, signal) {
      fast = fast || 12; slow = slow || 26; signal = signal || 9;
      if (values.length < slow + signal) return null;
      const ef = IND.emaSeries(values, fast);
      const es = IND.emaSeries(values, slow);
      const line = values.map(function (_, i) {
        return (ef[i] === null || es[i] === null) ? null : ef[i] - es[i];
      });
      const compact = line.filter(function (x) { return x !== null; });
      const sig = IND.emaSeries(compact, signal);
      const macdV = U.last(compact);
      const sigV = U.last(sig);
      if (macdV === undefined || sigV === undefined || sigV === null) return null;
      const prevMacd = compact[compact.length - 2];
      const prevSig = sig[sig.length - 2];
      return {
        macd: macdV,
        signal: sigV,
        hist: macdV - sigV,
        prevHist: (prevMacd !== undefined && prevSig !== null && prevSig !== undefined) ? prevMacd - prevSig : null,
        line: line,
        sigSeries: sig
      };
    },

    bollinger(values, period, mult) {
      period = period || 20; mult = mult || 2;
      if (values.length < period) return null;
      const slice = values.slice(-period);
      const mid = U.mean(slice);
      const sd = Math.sqrt(U.mean(slice.map(function (x) { return (x - mid) * (x - mid); })));
      const upper = mid + mult * sd;
      const lower = mid - mult * sd;
      const price = U.last(values);
      const width = upper - lower;
      return {
        mid: mid, upper: upper, lower: lower,
        width: width,
        widthPct: mid ? (width / mid) * 100 : 0,
        pctB: width ? (price - lower) / width : 0.5
      };
    },

    atr(bars, period) {
      period = period || 14;
      if (!bars || bars.length < period + 1) return null;
      const trs = [];
      for (let i = 1; i < bars.length; i++) {
        const h = U.num(bars[i].h, bars[i].c);
        const l = U.num(bars[i].l, bars[i].c);
        const pc = U.num(bars[i - 1].c);
        trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
      }
      // Wilder smoothing
      let a = U.mean(trs.slice(0, period));
      for (let i = period; i < trs.length; i++) a = (a * (period - 1) + trs[i]) / period;
      return a;
    },

    /* annualised volatility from daily log returns */
    volatility(values, lookback) {
      lookback = lookback || 60;
      if (values.length < 20) return null;
      const slice = values.slice(-Math.min(lookback, values.length));
      const rets = [];
      for (let i = 1; i < slice.length; i++) {
        if (slice[i - 1] > 0) rets.push(Math.log(slice[i] / slice[i - 1]));
      }
      if (rets.length < 5) return null;
      return U.stdev(rets) * Math.sqrt(252) * 100;
    },

    changePct(values, back) {
      if (!values || values.length < back + 1) return null;
      const a = values[values.length - 1 - back];
      const b = U.last(values);
      if (!a) return null;
      return ((b - a) / a) * 100;
    },

    high52(bars) {
      const slice = bars.slice(-252);
      return slice.reduce(function (m, b) { return Math.max(m, U.num(b.h, b.c)); }, -Infinity);
    },
    low52(bars) {
      const slice = bars.slice(-252);
      return slice.reduce(function (m, b) { return Math.min(m, U.num(b.l, b.c)); }, Infinity);
    },

    /* Swing-based support & resistance from recent pivots */
    supportResistance(bars, lookback) {
      lookback = lookback || 90;
      const slice = bars.slice(-Math.min(lookback, bars.length));
      if (slice.length < 10) return { support: null, resistance: null };
      const price = U.num(U.last(slice).c);
      const pivotsHigh = [], pivotsLow = [];
      const w = 3;
      for (let i = w; i < slice.length - w; i++) {
        const h = U.num(slice[i].h, slice[i].c);
        const l = U.num(slice[i].l, slice[i].c);
        let isH = true, isL = true;
        for (let j = i - w; j <= i + w; j++) {
          if (j === i) continue;
          if (U.num(slice[j].h, slice[j].c) >= h) isH = false;
          if (U.num(slice[j].l, slice[j].c) <= l) isL = false;
        }
        if (isH) pivotsHigh.push(h);
        if (isL) pivotsLow.push(l);
      }
      const below = pivotsLow.filter(function (p) { return p < price * 0.995; });
      const above = pivotsHigh.filter(function (p) { return p > price * 1.005; });
      const support = below.length ? Math.max.apply(null, below)
        : Math.min.apply(null, slice.map(function (b) { return U.num(b.l, b.c); }));
      const resistance = above.length ? Math.min.apply(null, above)
        : Math.max.apply(null, slice.map(function (b) { return U.num(b.h, b.c); }));
      return { support: support, resistance: resistance };
    },

    avgVolume(bars, period) {
      period = period || 20;
      const slice = bars.slice(-period).map(function (b) { return U.num(b.v); });
      return slice.length ? U.mean(slice) : 0;
    },

    /* max drawdown of an equity array -> percentage (positive number) */
    maxDrawdown(values) {
      let peak = -Infinity, mdd = 0;
      for (let i = 0; i < values.length; i++) {
        peak = Math.max(peak, values[i]);
        if (peak > 0) mdd = Math.max(mdd, (peak - values[i]) / peak);
      }
      return mdd * 100;
    },

    drawdownSeries(values) {
      let peak = -Infinity;
      return values.map(function (v) {
        peak = Math.max(peak, v);
        return peak > 0 ? ((v - peak) / peak) * 100 : 0;
      });
    },

    sharpe(equity, riskFreeAnnual) {
      if (!equity || equity.length < 5) return null;
      const rets = [];
      for (let i = 1; i < equity.length; i++) {
        if (equity[i - 1] > 0) rets.push(equity[i] / equity[i - 1] - 1);
      }
      if (rets.length < 5) return null;
      const sd = U.stdev(rets);
      if (!sd) return null;
      const rf = (riskFreeAnnual === undefined ? 0.04 : riskFreeAnnual) / 252;
      return ((U.mean(rets) - rf) / sd) * Math.sqrt(252);
    },

    /* Full snapshot of indicators for one symbol */
    analyze(bars) {
      if (!bars || bars.length < 3) return null;
      const c = closes(bars);
      const price = U.last(c);
      const sma20 = IND.sma(c, 20), sma50 = IND.sma(c, 50), sma200 = IND.sma(c, 200);
      const ema20 = c.length >= 20 ? IND.ema(c, 20) : null;
      const rsi = c.length > 15 ? IND.rsi(c, 14) : null;
      const macd = IND.macd(c);
      const bb = IND.bollinger(c, 20, 2);
      const atr = IND.atr(bars, 14);
      const sr = IND.supportResistance(bars);
      const hi52 = bars.length >= 20 ? IND.high52(bars) : null;
      const lo52 = bars.length >= 20 ? IND.low52(bars) : null;
      const prev = c.length > 1 ? c[c.length - 2] : price;

      return {
        bars: bars.length,
        date: U.last(bars).d,
        price: price,
        prevClose: prev,
        chg1d: prev ? ((price - prev) / prev) * 100 : 0,
        chg5d: IND.changePct(c, 5),
        chg1m: IND.changePct(c, 21),
        chg3m: IND.changePct(c, 63),
        chg6m: IND.changePct(c, 126),
        volume: U.num(U.last(bars).v),
        avgVolume: IND.avgVolume(bars, 20),
        sma20: sma20, sma50: sma50, sma200: sma200, ema20: ema20,
        sma20Slope: (function () {
          const s = IND.smaSeries(c, 20);
          const a = s[s.length - 6], b = U.last(s);
          return (a && b) ? ((b - a) / a) * 100 : null;
        })(),
        sma200Slope: (function () {
          const s = IND.smaSeries(c, 200);
          const a = s[s.length - 21], b = U.last(s);
          return (a && b) ? ((b - a) / a) * 100 : null;
        })(),
        rsi: rsi,
        macd: macd,
        bb: bb,
        atr: atr,
        atrPct: (atr && price) ? (atr / price) * 100 : null,
        volatility: IND.volatility(c),
        support: sr.support,
        resistance: sr.resistance,
        high52: isFinite(hi52) ? hi52 : null,
        low52: isFinite(lo52) ? lo52 : null,
        fromHigh: (hi52 && isFinite(hi52) && hi52 > 0) ? ((price - hi52) / hi52) * 100 : null,
        fromLow: (lo52 && isFinite(lo52) && lo52 > 0) ? ((price - lo52) / lo52) * 100 : null,
        extAboveSma200: sma200 ? ((price - sma200) / sma200) * 100 : null,
        closes: c
      };
    }
  };

  AP.ind = IND;
})(window);
