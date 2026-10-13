/* كسارة اكسبريس — الإقلاع */
(function (root) {
  'use strict';
  const EX = (root.EX = root.EX || {});
  const U = EX.util;

  const App = {
    boot() {
      EX.store.load();
      const st = EX.store.settings();
      EX.i18n.setLang(st.lang);
      App.applyLang();
      App.applyTheme();

      const hash = (location.hash || '').replace('#', '');
      if (hash && EX.views[hash]) EX.ui.route = hash;

      EX.ui.renderShell();

      root.addEventListener('hashchange', function () {
        const h = (location.hash || '').replace('#', '');
        if (h && EX.views[h] && h !== EX.ui.route) {
          EX.ui.route = h;
          EX.ui.ctx = {};
          EX.ui.renderShell();
        }
      });
      // الرسوم مرسومة على canvas بعرض ثابت، فتُعاد عند تغيّر المقاس
      root.addEventListener('resize', U.debounce(function () { EX.ui.renderView(); }, 250));
    },

    applyTheme() {
      document.documentElement.setAttribute('data-theme', EX.store.settings().theme === 'light' ? 'light' : 'dark');
    },
    setTheme(theme) {
      EX.store.settings().theme = theme === 'light' ? 'light' : 'dark';
      EX.store.save();
      App.applyTheme();
      EX.ui.renderShell();
    },
    toggleTheme() { App.setTheme(EX.store.settings().theme === 'dark' ? 'light' : 'dark'); },

    applyLang() {
      const lang = EX.i18n.lang;
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      const c = EX.store.settings().company;
      document.title = (lang === 'en' ? (c.nameEn || c.name) : c.name) || EX.t('app_name');
    },
    setLang(lang) {
      EX.i18n.setLang(lang);
      EX.store.settings().lang = EX.i18n.lang;
      EX.store.save();
      App.applyLang();
      EX.ui.renderShell();
    },
    toggleLang() { App.setLang(EX.i18n.lang === 'ar' ? 'en' : 'ar'); }
  };

  EX.app = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { App.boot(); });
  } else {
    App.boot();
  }
})(window);
