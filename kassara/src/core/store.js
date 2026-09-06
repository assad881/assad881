/* حالة التطبيق + ناقل أحداث بسيط */
window.KX = window.KX || {};
KX.store = (function () {
  const listeners = {};
  const state = { session: null, route: null, cart: null };

  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return () => { listeners[evt] = listeners[evt].filter((f) => f !== fn); };
  }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } });
    (listeners['*'] || []).forEach((fn) => fn({ evt, payload }));
  }
  function set(key, value) { state[key] = value; emit('change:' + key, value); }
  const get = (key) => state[key];

  /* تخزين محلي آمن (يتحمّل الوضع الخاص وحجب التخزين) */
  function ls(key, value) {
    try {
      if (value === undefined) {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      }
      if (value === null) { localStorage.removeItem(key); return null; }
      localStorage.setItem(key, JSON.stringify(value));
      return value;
    } catch (e) { console.warn('storage unavailable', e); return null; }
  }
  return { on, emit, set, get, state, ls };
})();
