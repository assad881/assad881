/* موجّه مسارات بسيط قائم على الـ hash — يعمل من ملف محلي أو خادم */
window.KX = window.KX || {};
KX.router = (function () {
  const routes = [];
  let notFound = null, beforeEach = null;

  function add(pattern, handler, meta) {
    const keys = [];
    const rx = new RegExp('^' + pattern.replace(/:[A-Za-z_]+/g, function (m) {
      keys.push(m.slice(1)); return '([^/]+)';
    }) + '$');
    routes.push({ rx, keys, handler, meta: meta || {}, pattern });
  }
  const setNotFound = (fn) => { notFound = fn; };
  const setGuard    = (fn) => { beforeEach = fn; };

  function current() {
    const h = location.hash.replace(/^#/, '');
    return h === '' ? '/' : h;
  }
  function go(path, replace) {
    if (replace) location.replace('#' + path); else location.hash = path;
    if (current() === path) resolve();
  }
  function resolve() {
    const path = current().split('?')[0];
    const query = {};
    const qs = current().split('?')[1];
    if (qs) qs.split('&').forEach(function (p) {
      const [k, v] = p.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });

    for (const r of routes) {
      const m = path.match(r.rx);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      const ctx = { path, params, query, meta: r.meta };
      if (beforeEach) {
        const redirect = beforeEach(ctx);
        if (redirect) { go(redirect, true); return; }
      }
      KX.store.set('route', ctx);
      window.scrollTo(0, 0);
      Promise.resolve(r.handler(ctx)).catch(function (e) {
        console.error(e);
        KX.util.toast('حدث خطأ غير متوقع: ' + e.message, 'error');
      });
      return;
    }
    if (notFound) notFound({ path });
  }
  function start() {
    window.addEventListener('hashchange', resolve);
    resolve();
  }
  return { add, setNotFound, setGuard, go, start, current, resolve };
})();
