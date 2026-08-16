/* Asaad Paper Invest — persistent state store (localStorage) */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  const KEY = 'asaad_paper_invest_v1';
  const CACHE_KEY = 'asaad_paper_invest_cache_v1';

  const DEFAULT_WATCHLIST = [
    { symbol: 'SPUS', name: 'SP Funds S&P 500 Sharia ETF', nameAr: 'صندوق SP Funds المتوافق', type: 'etf', sector: 'Broad Market' },
    { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', nameAr: 'فانغارد S&P 500', type: 'etf', sector: 'Broad Market' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', nameAr: 'إنفيسكو ناسداك 100', type: 'etf', sector: 'Technology' },
    { symbol: 'AAPL', name: 'Apple Inc.', nameAr: 'أبل', type: 'stock', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', nameAr: 'مايكروسوفت', type: 'stock', sector: 'Technology' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', nameAr: 'إنفيديا', type: 'stock', sector: 'Semiconductors' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', nameAr: 'ألفابت (جوجل)', type: 'stock', sector: 'Communication' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', nameAr: 'أمازون', type: 'stock', sector: 'Consumer Discretionary' },
    { symbol: 'META', name: 'Meta Platforms Inc.', nameAr: 'ميتا', type: 'stock', sector: 'Communication' },
    { symbol: 'TSLA', name: 'Tesla Inc.', nameAr: 'تسلا', type: 'stock', sector: 'Consumer Discretionary' }
  ];

  function defaultState() {
    const today = U.today();
    return {
      version: 1,
      createdAt: Date.now(),
      settings: {
        lang: 'ar',
        theme: 'dark',
        initialCapital: 10000,
        startDate: today,
        experimentDays: 90,
        fxOmrUsd: 2.6,
        monthlyOmr: 507,
        provider: 'auto',
        proxyUrl: '',
        commission: 0,
        risk: {
          maxSingle: 10,     // % of portfolio for one stock
          maxEtf: 25,        // % of portfolio for a diversified ETF
          minCash: 10,       // % minimum cash buffer
          riskPerTrade: 1    // % of equity risked per trade (entry -> stop)
        },
        benchmarkSymbol: 'VOO',
        marketProxy: 'VOO'
      },
      watchlist: U.deepClone(DEFAULT_WATCHLIST),
      cash: 10000,
      positions: {},           // symbol -> { symbol, qty, avgCost, realized, openedAt, lots:[{qty,price,date}] }
      transactions: [],
      journal: [],
      snapshots: [],           // { date, equity, cash, invested, prices:{}, positions:{}, regime, scores:{} }
      alerts: [],
      news: [],
      manualPrices: {},        // symbol -> { date: close }
      earnings: {},            // symbol -> 'YYYY-MM-DD'
      s507: { lastRun: null, strategies: null, contributions: [] },
      meta: { lastRefresh: null, lastSnapshot: null, dataMode: 'unknown' }
    };
  }

  const Store = {
    state: null,
    cache: { series: {} },
    listeners: [],

    load() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          Store.state = Store.migrate(parsed);
        } catch (e) {
          console.warn('State parse failed, starting fresh', e);
          Store.state = defaultState();
        }
      } else {
        Store.state = defaultState();
      }
      try {
        const c = localStorage.getItem(CACHE_KEY);
        if (c) Store.cache = JSON.parse(c);
      } catch (e) { Store.cache = { series: {} }; }
      if (!Store.cache || typeof Store.cache !== 'object') Store.cache = { series: {} };
      if (!Store.cache.series) Store.cache.series = {};
      return Store.state;
    },

    migrate(s) {
      const d = defaultState();
      const out = Object.assign({}, d, s || {});
      out.settings = Object.assign({}, d.settings, s.settings || {});
      out.settings.risk = Object.assign({}, d.settings.risk, (s.settings && s.settings.risk) || {});
      ['watchlist', 'transactions', 'journal', 'snapshots', 'alerts', 'news'].forEach(function (k) {
        if (!Array.isArray(out[k])) out[k] = d[k];
      });
      ['positions', 'manualPrices', 'earnings'].forEach(function (k) {
        if (!out[k] || typeof out[k] !== 'object') out[k] = {};
      });
      out.s507 = Object.assign({}, d.s507, s.s507 || {});
      out.meta = Object.assign({}, d.meta, s.meta || {});
      if (typeof out.cash !== 'number') out.cash = out.settings.initialCapital;
      return out;
    },

    save() {
      // during a replay the state changes on every simulated day; persisting
      // each one would serialise the whole store dozens of times
      if (AP.backtest && AP.backtest.running) { Store.emit(); return; }
      try {
        localStorage.setItem(KEY, JSON.stringify(Store.state));
      } catch (e) {
        console.warn('Save failed (storage full?)', e);
        // try to shed snapshots history to make room
        if (Store.state.snapshots.length > 200) {
          Store.state.snapshots = Store.state.snapshots.slice(-200);
          try { localStorage.setItem(KEY, JSON.stringify(Store.state)); } catch (e2) { /* give up */ }
        }
      }
      Store.emit();
    },

    saveCache: U.debounce(function () {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(Store.cache));
      } catch (e) {
        // Cache is expendable: drop it rather than blocking the app.
        try { localStorage.removeItem(CACHE_KEY); } catch (e2) { /* noop */ }
      }
    }, 600),

    on(fn) { Store.listeners.push(fn); },
    emit() { Store.listeners.forEach(function (f) { try { f(Store.state); } catch (e) { console.error(e); } }); },

    /* ---------- accessors ---------- */
    get s() { return Store.state; },
    settings() { return Store.state.settings; },
    watchlist() { return Store.state.watchlist; },
    symbols() { return Store.state.watchlist.map(function (w) { return w.symbol; }); },
    meta(sym) {
      return Store.state.watchlist.find(function (w) { return w.symbol === sym; }) ||
        { symbol: sym, name: sym, nameAr: sym, type: 'stock', sector: '—' };
    },
    assetName(sym) {
      const m = Store.meta(sym);
      return AP.i18n.lang === 'ar' ? (m.nameAr || m.name || sym) : (m.name || sym);
    },
    isEtf(sym) { return Store.meta(sym).type === 'etf'; },

    addSymbol(sym, info) {
      const s = String(sym || '').trim().toUpperCase();
      if (!s) return { ok: false, err: 'err_invalid' };
      if (Store.symbols().indexOf(s) >= 0) return { ok: false, err: 'symbol_exists' };
      Store.state.watchlist.push(Object.assign({
        symbol: s, name: s, nameAr: s, type: 'stock', sector: '—'
      }, info || {}));
      Store.save();
      return { ok: true };
    },
    removeSymbol(sym) {
      Store.state.watchlist = Store.state.watchlist.filter(function (w) { return w.symbol !== sym; });
      Store.save();
    },

    /* ---------- prices ---------- */
    series(sym) {
      const c = Store.cache.series[sym];
      return c && Array.isArray(c.bars) ? c.bars : null;
    },
    setSeries(sym, bars, source) {
      Store.cache.series[sym] = { bars: bars, source: source, ts: Date.now() };
      Store.saveCache();
    },
    lastPrice(sym) {
      const bars = AP.market ? AP.market.seriesWithManual(sym) : Store.series(sym);
      const barLast = bars && bars.length ? bars[bars.length - 1] : null;
      return barLast ? U.num(barLast.c) : 0;
    },
    prevClose(sym) {
      const bars = AP.market ? AP.market.seriesWithManual(sym) : Store.series(sym);
      if (!bars || bars.length < 2) return Store.lastPrice(sym);
      return U.num(bars[bars.length - 2].c);
    },
    priceOn(sym, dateKey) {
      const bars = AP.market ? AP.market.seriesWithManual(sym) : Store.series(sym);
      if (!bars || !bars.length) return null;
      let best = null;
      for (let i = 0; i < bars.length; i++) {
        if (bars[i].d <= dateKey) best = bars[i]; else break;
      }
      return best ? U.num(best.c) : null;
    },
    /* First close at or after a date — used for signal follow-ups so a target
       landing on a weekend waits for the next real session instead of reusing
       the signal day's own price. */
    priceOnOrAfter(sym, dateKey) {
      const bars = AP.market ? AP.market.seriesWithManual(sym) : Store.series(sym);
      if (!bars || !bars.length) return null;
      for (let i = 0; i < bars.length; i++) {
        if (bars[i].d >= dateKey) return { date: bars[i].d, price: U.num(bars[i].c) };
      }
      return null;
    },

    /* ---------- experiment clock ---------- */
    dayNumber() {
      const st = Store.settings();
      const n = U.daysBetween(st.startDate, U.today()) + 1;
      return U.clamp(n, 1, st.experimentDays);
    },
    dayNumberRaw() {
      return U.daysBetween(Store.settings().startDate, U.today()) + 1;
    },
    daysRemaining() {
      return Math.max(0, Store.settings().experimentDays - Store.dayNumberRaw());
    },
    // day 90 of 90 is the final day, so the experiment counts as complete then
    isComplete() { return Store.dayNumberRaw() >= Store.settings().experimentDays; },

    /* ---------- alerts ---------- */
    pushAlert(type, severity, key, params, symbol) {
      const dedupe = type + '|' + (symbol || '') + '|' + U.today();
      if (Store.state.alerts.some(function (a) { return a.dedupe === dedupe; })) return;
      Store.state.alerts.unshift({
        id: U.uid('al'), ts: Date.now(), date: U.today(),
        type: type, severity: severity, key: key, params: params || {},
        symbol: symbol || null, read: false, dedupe: dedupe
      });
      if (Store.state.alerts.length > 300) Store.state.alerts.length = 300;
    },
    unreadAlerts() {
      return Store.state.alerts.filter(function (a) { return !a.read; }).length;
    },

    /* ---------- snapshots ---------- */
    saveSnapshot(extra) {
      const date = U.today();
      const pf = AP.portfolio.summary();
      const prices = {};
      Store.symbols().forEach(function (s) { prices[s] = Store.lastPrice(s); });
      const snap = Object.assign({
        date: date,
        equity: U.round(pf.equity, 2),
        cash: U.round(pf.cash, 2),
        invested: U.round(pf.invested, 2),
        realized: U.round(pf.realized, 2),
        unrealized: U.round(pf.unrealized, 2),
        prices: prices,
        positions: Object.keys(Store.state.positions).reduce(function (acc, k) {
          const p = Store.state.positions[k];
          acc[k] = { qty: p.qty, avgCost: p.avgCost };
          return acc;
        }, {})
      }, extra || {});
      const idx = Store.state.snapshots.findIndex(function (x) { return x.date === date; });
      if (idx >= 0) Store.state.snapshots[idx] = snap;
      else Store.state.snapshots.push(snap);
      Store.state.snapshots.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      Store.state.meta.lastSnapshot = date;
      Store.save();
      return snap;
    },
    snapshotOn(date) {
      return Store.state.snapshots.find(function (s) { return s.date === date; }) || null;
    },

    /* ---------- data management ---------- */
    exportJSON() {
      return JSON.stringify({ state: Store.state, cache: Store.cache, exportedAt: new Date().toISOString() }, null, 2);
    },
    importJSON(text) {
      const parsed = JSON.parse(text);
      const st = parsed.state || parsed;
      Store.state = Store.migrate(st);
      if (parsed.cache) Store.cache = parsed.cache;
      Store.save();
      Store.saveCache();
      return true;
    },
    resetAll() {
      Store.state = defaultState();
      Store.cache = { series: {} };
      try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* noop */ }
      Store.save();
    },
    resetCapital(amount) {
      const st = Store.settings();
      st.initialCapital = U.num(amount, 10000);
      Store.state.cash = st.initialCapital;
      Store.state.positions = {};
      Store.state.transactions = [];
      Store.state.snapshots = [];
      Store.state.s507 = { lastRun: null, strategies: null, contributions: [] };
      Store.save();
    },
    storageSize() {
      try {
        const a = localStorage.getItem(KEY) || '';
        const b = localStorage.getItem(CACHE_KEY) || '';
        return Math.round((a.length + b.length) / 1024) + ' KB';
      } catch (e) { return '—'; }
    }
  };

  AP.store = Store;
  AP.DEFAULT_WATCHLIST = DEFAULT_WATCHLIST;
})(window);
