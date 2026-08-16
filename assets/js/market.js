/* Asaad Paper Invest — market data layer.
   Tries real providers first; falls back to cache, then to a clearly-labelled
   internal simulator so the platform stays usable with no network. */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  // Reference levels used only to seed the offline simulator so that the
  // demo series stay in a plausible range per symbol.
  const SEEDS = {
    SPUS: { base: 47, drift: 0.00035, vol: 0.0092 },
    VOO: { base: 560, drift: 0.00036, vol: 0.0090 },
    QQQ: { base: 505, drift: 0.00045, vol: 0.0118 },
    AAPL: { base: 228, drift: 0.00038, vol: 0.0135 },
    MSFT: { base: 430, drift: 0.00040, vol: 0.0130 },
    NVDA: { base: 128, drift: 0.00075, vol: 0.0260 },
    GOOGL: { base: 175, drift: 0.00040, vol: 0.0150 },
    AMZN: { base: 185, drift: 0.00042, vol: 0.0160 },
    META: { base: 520, drift: 0.00048, vol: 0.0175 },
    TSLA: { base: 235, drift: 0.00030, vol: 0.0300 },
    SPY: { base: 610, drift: 0.00036, vol: 0.0090 }
  };

  function proxied(url) {
    const p = (AP.store.settings().proxyUrl || '').trim();
    if (!p) return url;
    if (p.indexOf('{url}') >= 0) return p.replace('{url}', encodeURIComponent(url));
    return p + encodeURIComponent(url);
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      const t = setTimeout(function () { reject(new Error('timeout')); }, ms || 12000);
      promise.then(function (v) { clearTimeout(t); resolve(v); },
        function (e) { clearTimeout(t); reject(e); });
    });
  }

  /* ---------------- providers ---------------- */

  function parseStooqCsv(text) {
    const lines = String(text).trim().split(/\r?\n/);
    if (lines.length < 3) throw new Error('bad csv');
    const head = lines[0].toLowerCase();
    if (head.indexOf('date') !== 0) throw new Error('bad csv header');
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const p = lines[i].split(',');
      if (p.length < 5) continue;
      const c = Number(p[4]);
      if (!isFinite(c) || c <= 0) continue;
      out.push({
        d: p[0],
        o: Number(p[1]) || c, h: Number(p[2]) || c, l: Number(p[3]) || c,
        c: c, v: Number(p[5]) || 0
      });
    }
    if (out.length < 30) throw new Error('too few rows');
    return out;
  }

  const providers = {
    stooq(symbol) {
      const url = 'https://stooq.com/q/d/l/?s=' + encodeURIComponent(symbol.toLowerCase()) + '.us&i=d';
      return withTimeout(fetch(proxied(url), { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('http ' + r.status);
          return r.text();
        })
        .then(function (t) { return { bars: parseStooqCsv(t), source: 'stooq' }; }));
    },

    yahoo(symbol) {
      const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
        encodeURIComponent(symbol) + '?range=2y&interval=1d&includePrePost=false';
      return withTimeout(fetch(proxied(url), { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('http ' + r.status);
          return r.json();
        })
        .then(function (j) {
          const res = j && j.chart && j.chart.result && j.chart.result[0];
          if (!res || !res.timestamp) throw new Error('no chart data');
          const q = res.indicators.quote[0];
          const adj = res.indicators.adjclose && res.indicators.adjclose[0]
            ? res.indicators.adjclose[0].adjclose : null;
          const bars = [];
          for (let i = 0; i < res.timestamp.length; i++) {
            const c = adj && isFinite(adj[i]) ? adj[i] : q.close[i];
            if (!isFinite(c) || c === null) continue;
            bars.push({
              d: U.dateKey(new Date(res.timestamp[i] * 1000)),
              o: isFinite(q.open[i]) ? q.open[i] : c,
              h: isFinite(q.high[i]) ? q.high[i] : c,
              l: isFinite(q.low[i]) ? q.low[i] : c,
              c: c,
              v: isFinite(q.volume[i]) ? q.volume[i] : 0
            });
          }
          if (bars.length < 30) throw new Error('too few rows');
          return { bars: bars, source: 'yahoo' };
        }));
    },

    /* Deterministic offline series — clearly labelled as simulated in the UI. */
    demo(symbol) {
      const seed = SEEDS[symbol] || { base: 60 + (symbol.charCodeAt(0) % 90), drift: 0.0003, vol: 0.016 };
      const rand = U.rng('asaad|' + symbol);
      const days = 420;
      const bars = [];
      // walk forward to today so the last simulated bar is always current
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cursor = new Date(today);
      cursor.setDate(cursor.getDate() - Math.ceil(days * 1.45));
      let price = seed.base * (0.72 + rand() * 0.12);
      let regime = 0;
      while (cursor <= today) {
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6) {
          // slowly switching drift regimes -> produces trends, pullbacks, ranges
          if (rand() < 0.012) regime = (rand() - 0.45) * 2.2;
          const shock = (rand() + rand() + rand() + rand() - 2) * seed.vol;
          const ret = seed.drift * (1 + regime) + shock;
          const open = price;
          price = Math.max(1, price * (1 + ret));
          const hi = Math.max(open, price) * (1 + rand() * seed.vol * 0.6);
          const lo = Math.min(open, price) * (1 - rand() * seed.vol * 0.6);
          bars.push({
            d: U.dateKey(cursor),
            o: U.round(open, 2), h: U.round(hi, 2), l: U.round(lo, 2), c: U.round(price, 2),
            v: Math.round((3e6 + rand() * 4e7) * (1 + Math.abs(ret) * 12))
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      return Promise.resolve({ bars: bars.slice(-days), source: 'demo' });
    }
  };

  function chainFor(mode) {
    if (mode === 'demo') return ['demo'];
    if (mode === 'stooq') return ['stooq', 'demo'];
    if (mode === 'yahoo') return ['yahoo', 'demo'];
    if (mode === 'manual') return [];
    return ['stooq', 'yahoo', 'demo'];
  }

  const Market = {
    lastMode: 'unknown',
    failures: [],

    isFresh(symbol) {
      const c = AP.store.cache.series[symbol];
      if (!c || !c.bars || !c.bars.length) return false;
      if (c.source === 'demo') return false;
      const ageH = (Date.now() - U.num(c.ts)) / 3600000;
      if (ageH > 6) return false;
      const lastBar = c.bars[c.bars.length - 1].d;
      // fresh if last bar is today or the most recent weekday
      let ref = new Date();
      let guard = 0;
      while ((ref.getDay() === 0 || ref.getDay() === 6) && guard++ < 5) ref.setDate(ref.getDate() - 1);
      return lastBar >= U.dateKey(ref) || ageH < 2;
    },

    fetchSymbol(symbol) {
      const mode = AP.store.settings().provider || 'auto';
      const chain = chainFor(mode);
      let i = 0;
      function next() {
        if (i >= chain.length) return Promise.reject(new Error('no provider'));
        const name = chain[i++];
        return providers[name](symbol).catch(function (err) {
          Market.failures.push(symbol + ':' + name + ':' + (err && err.message));
          return next();
        });
      }
      return next();
    },

    /* Refresh every watchlist symbol + the market proxy. */
    refreshAll(onProgress) {
      const syms = AP.store.symbols().slice();
      const proxySym = AP.store.settings().marketProxy || 'VOO';
      if (syms.indexOf(proxySym) < 0) syms.push(proxySym);
      Market.failures = [];
      let done = 0;
      let live = 0, demo = 0, cached = 0;

      const jobs = syms.map(function (sym) {
        if (Market.isFresh(sym)) {
          cached++;
          done++;
          if (onProgress) onProgress(done, syms.length, sym);
          return Promise.resolve();
        }
        return Market.fetchSymbol(sym).then(function (res) {
          AP.store.setSeries(sym, res.bars, res.source);
          if (res.source === 'demo') demo++; else live++;
        }).catch(function () {
          // keep whatever is cached
          if (AP.store.series(sym)) cached++;
        }).then(function () {
          done++;
          if (onProgress) onProgress(done, syms.length, sym);
        });
      });

      return Promise.all(jobs).then(function () {
        Market.lastMode = live > 0 ? (demo > 0 ? 'mixed' : 'live') : (demo > 0 ? 'demo' : 'cached');
        AP.store.s.meta.lastRefresh = Date.now();
        AP.store.s.meta.dataMode = Market.lastMode;
        AP.store.save();
        return { live: live, demo: demo, cached: cached, mode: Market.lastMode };
      });
    },

    sourceOf(symbol) {
      const c = AP.store.cache.series[symbol];
      return c ? c.source : null;
    },

    /* Series with manual price overrides merged in.
       While replaying (AP.asOf) the series is truncated to that date so no
       indicator can see the future. */
    seriesWithManual(symbol) {
      const asOf = AP.asOf;
      let bars = (AP.store.series(symbol) || []).slice();
      if (asOf) bars = bars.filter(function (b) { return b.d <= asOf; });
      const manual = AP.store.s.manualPrices[symbol];
      if (!manual) return bars;
      Object.keys(manual).sort().forEach(function (d) {
        const c = U.num(manual[d]);
        if (!c) return;
        const idx = bars.findIndex(function (b) { return b.d === d; });
        const bar = { d: d, o: c, h: c, l: c, c: c, v: 0, manual: true };
        if (idx >= 0) bars[idx] = Object.assign({}, bars[idx], { c: c, manual: true });
        else bars.push(bar);
      });
      bars.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
      return bars;
    },

    setManualPrice(symbol, date, price) {
      const mp = AP.store.s.manualPrices;
      if (!mp[symbol]) mp[symbol] = {};
      mp[symbol][date || U.today()] = U.num(price);
      AP.store.save();
    },

    clearManual(symbol) {
      delete AP.store.s.manualPrices[symbol];
      AP.store.save();
    }
  };

  AP.market = Market;
  AP.marketSeeds = SEEDS;
})(window);
