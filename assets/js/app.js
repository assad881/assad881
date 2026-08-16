/* Asaad Paper Invest — bootstrap & daily cycle */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  const App = {
    booted: false,
    scanCache: null,

    boot() {
      AP.store.load();
      const st = AP.store.settings();
      AP.i18n.setLang(st.lang);
      App.applyLang();
      App.applyTheme();

      const hash = (location.hash || '').replace('#', '');
      if (hash && AP.views[hash]) AP.ui.route = hash;

      App.rescan();
      AP.ui.renderShell();
      App.booted = true;

      // fetch market data in the background, then run the daily cycle
      App.refresh(false);

      window.addEventListener('hashchange', function () {
        const h = (location.hash || '').replace('#', '');
        if (h && AP.views[h] && h !== AP.ui.route) {
          AP.ui.route = h;
          AP.ui.renderShell();
        }
      });
      window.addEventListener('resize', U.debounce(function () { AP.ui.renderView(); }, 250));
    },

    /* Pull prices, re-score everything, snapshot the day, raise alerts. */
    refresh(showToast) {
      if (AP.ui.busy) return Promise.resolve();
      AP.ui.busy = true;
      if (showToast) AP.ui.toast(AP.t('refreshing'));
      const bar = document.querySelector('.appbar .icon-btn');
      if (bar) bar.textContent = '⏳';

      return AP.market.refreshAll()
        .catch(function (e) { console.warn('refresh failed', e); return null; })
        .then(function () {
          return AP.news.fetchFor().catch(function () { return null; });
        })
        .then(function () {
          App.runDailyCycle();
          AP.ui.busy = false;
          AP.ui.renderShell();
          if (showToast) {
            const mode = AP.store.s.meta.dataMode;
            AP.ui.toast(AP.t('last_update') + ': ' + U.fmtTime(Date.now(), AP.i18n.lang) +
              ' · ' + AP.t(mode === 'demo' ? 'demo_data_badge' : mode === 'cached' ? 'cached_data_badge' : 'live_data_badge'),
              mode === 'demo' ? '' : 'good');
          }
        });
    },

    /* Everything that must happen once per day, idempotently. */
    runDailyCycle() {
      App.rescan();
      const scan = App.scanCache;
      AP.journal.updateFollowUps();
      AP.journal.logScan(scan);
      AP.alerts.evaluate(scan);
      AP.store.saveSnapshot({
        scores: App.lastScores(),
        regime: scan.regime.label,
        breadth: U.round(scan.regime.breadth, 1)
      });
      try { AP.s507.ensure(); } catch (e) { console.warn('507 sim failed', e); }
    },

    rescan() {
      App.scanCache = AP.signals.scanAll();
      AP.lastScan = App.scanCache;
      return App.scanCache;
    },

    currentScan() {
      if (!App.scanCache) App.rescan();
      return App.scanCache;
    },

    lastScores() {
      const scan = App.currentScan();
      const out = {};
      scan.evals.forEach(function (e) {
        if (!e.ok) return;
        out[e.symbol] = {
          score: e.score,
          decision: e.decision,
          band: e.band ? e.band.key : null,
          rsi: e.ind.rsi === null ? null : U.round(e.ind.rsi, 1)
        };
      });
      return out;
    },

    /* ---------- theme & language ---------- */
    applyTheme() {
      document.documentElement.setAttribute('data-theme', AP.store.settings().theme === 'light' ? 'light' : 'dark');
    },
    setTheme(theme) {
      AP.store.settings().theme = theme === 'light' ? 'light' : 'dark';
      AP.store.save();
      App.applyTheme();
      AP.ui.renderShell();
    },
    toggleTheme() {
      App.setTheme(AP.store.settings().theme === 'dark' ? 'light' : 'dark');
    },

    applyLang() {
      const lang = AP.i18n.lang;
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      document.title = AP.t('app_name') + ' — ' + AP.t('app_tagline');
    },
    setLang(lang) {
      AP.i18n.setLang(lang);
      AP.store.settings().lang = AP.i18n.lang;
      AP.store.save();
      App.applyLang();
      AP.ui.renderShell();
    },
    toggleLang() {
      App.setLang(AP.i18n.lang === 'ar' ? 'en' : 'ar');
    }
  };

  AP.app = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { App.boot(); });
  } else {
    App.boot();
  }
})(window);
