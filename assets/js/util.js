/* Asaad Paper Invest — utilities */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});

  const U = {
    /* ---------- DOM ---------- */
    $(sel, ctx) { return (ctx || document).querySelector(sel); },
    $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); },
    el(tag, attrs, children) {
      const n = document.createElement(tag);
      if (attrs) {
        Object.keys(attrs).forEach(function (k) {
          const v = attrs[k];
          if (v === null || v === undefined || v === false) return;
          if (k === 'class') n.className = v;
          else if (k === 'html') n.innerHTML = v;
          else if (k === 'text') n.textContent = v;
          else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
          else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
          else n.setAttribute(k, v);
        });
      }
      (Array.isArray(children) ? children : children ? [children] : []).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
      return n;
    },
    esc(s) {
      return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /* ---------- numbers ---------- */
    num(v, d) {
      const n = Number(v);
      return isFinite(n) ? n : (d === undefined ? 0 : d);
    },
    round(v, p) { const f = Math.pow(10, p || 0); return Math.round(U.num(v) * f) / f; },
    clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, U.num(v))); },

    // Wrap a formatted number in a bidi isolate so signs and currency symbols
    // stay on the correct side inside Arabic (RTL) text.
    iso(s) { return '⁦' + s + '⁩'; },

    money(v, cur) {
      const n = U.num(v);
      const sign = n < 0 ? '-' : '';
      const a = Math.abs(n);
      const s = a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return U.iso(sign + (cur === 'OMR' ? 'ر.ع ' : '$') + s);
    },
    money0(v) {
      const n = U.num(v);
      return U.iso((n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 }));
    },
    pct(v, p) {
      const n = U.num(v);
      return U.iso((n > 0 ? '+' : '') + n.toFixed(p === undefined ? 2 : p) + '%');
    },
    pctPlain(v, p) { return U.iso(U.num(v).toFixed(p === undefined ? 2 : p) + '%'); },
    qty(v) {
      const n = U.num(v);
      return U.iso(n.toLocaleString('en-US', { maximumFractionDigits: 4 }));
    },
    sign(v) { return U.num(v) > 0 ? 'pos' : U.num(v) < 0 ? 'neg' : 'flat'; },

    /* ---------- dates ----------
       AP.asOf lets the replay engine move the whole app to a past date:
       every "today" in the system flows through here. */
    today() { return root.AP.asOf || U.dateKey(new Date()); },
    realToday() { return U.dateKey(new Date()); },
    dateKey(d) {
      const x = d instanceof Date ? d : new Date(d);
      const m = String(x.getMonth() + 1).padStart(2, '0');
      const day = String(x.getDate()).padStart(2, '0');
      return x.getFullYear() + '-' + m + '-' + day;
    },
    parseDate(s) {
      if (s instanceof Date) return s;
      const p = String(s).split('-');
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2] || 1));
    },
    addDays(dateStr, n) {
      const d = U.parseDate(dateStr);
      d.setDate(d.getDate() + n);
      return U.dateKey(d);
    },
    daysBetween(a, b) {
      const d1 = U.parseDate(a), d2 = U.parseDate(b);
      return Math.round((d2 - d1) / 86400000);
    },
    isWeekend(dateStr) {
      const d = U.parseDate(dateStr).getDay();
      return d === 0 || d === 6;
    },
    fmtDate(dateStr, lang) {
      if (!dateStr) return '—';
      const d = U.parseDate(dateStr);
      try {
        return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB',
          { year: 'numeric', month: 'short', day: 'numeric' });
      } catch (e) { return dateStr; }
    },
    fmtTime(ts, lang) {
      try {
        return new Date(ts).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB',
          { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch (e) { return String(ts); }
    },

    /* ---------- misc ---------- */
    uid(prefix) {
      return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
    deepClone(o) { return JSON.parse(JSON.stringify(o)); },
    debounce(fn, ms) {
      let t;
      return function () {
        const a = arguments, c = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(c, a); }, ms || 200);
      };
    },
    // deterministic pseudo-random generator (used only for offline demo series)
    rng(seed) {
      let s = 0;
      const str = String(seed);
      for (let i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) >>> 0;
      return function () {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
    },
    sum(arr) { return arr.reduce(function (a, b) { return a + U.num(b); }, 0); },
    mean(arr) { return arr.length ? U.sum(arr) / arr.length : 0; },
    stdev(arr) {
      if (arr.length < 2) return 0;
      const m = U.mean(arr);
      return Math.sqrt(U.sum(arr.map(function (x) { return (x - m) * (x - m); })) / (arr.length - 1));
    },
    last(arr, n) { return arr && arr.length ? arr[arr.length - 1 - (n || 0)] : undefined; },
    download(filename, text, mime) {
      const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 100);
    }
  };

  AP.util = U;
})(window);
