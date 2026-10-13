/* كسارة اكسبريس — أدوات عامة */
(function (root) {
  'use strict';
  const EX = (root.EX = root.EX || {});

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
    clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; },

    /* ---------- أرقام ----------
       الريال العماني يُكتب بثلاث خانات عشرية (1 ر.ع = 1000 بيسة). */
    num(v, d) { const n = Number(v); return isFinite(n) ? n : (d === undefined ? 0 : d); },
    round(v, p) { const f = Math.pow(10, p === undefined ? 3 : p); return Math.round(U.num(v) * f) / f; },
    clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, U.num(v))); },

    // عزل ثنائي الاتجاه حتى تبقى الإشارة والعملة في مكانها الصحيح داخل نص عربي
    iso(s) { return '⁦' + s + '⁩'; },

    money(v, opts) {
      opts = opts || {};
      const d = opts.decimals === undefined ? 3 : opts.decimals;
      const n = U.num(v);
      const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
      const body = (n < 0 ? '-' : '') + s + (opts.bare ? '' : ' ' + (opts.symbol || 'ر.ع'));
      return U.iso(body);
    },
    money0(v) {
      const n = U.num(v);
      return U.iso((n < 0 ? '-' : '') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ر.ع');
    },
    qty(v, unitLabel) {
      const n = U.num(v);
      const s = n.toLocaleString('en-US', { maximumFractionDigits: 2 });
      return U.iso(s + (unitLabel ? ' ' + unitLabel : ''));
    },
    pct(v, p) { return U.iso(U.num(v).toFixed(p === undefined ? 1 : p) + '%'); },
    sign(v) { return U.num(v) > 0 ? 'pos' : U.num(v) < 0 ? 'neg' : 'flat'; },

    /* ---------- تواريخ ---------- */
    today() { return U.dateKey(new Date()); },
    dateKey(d) {
      const x = d instanceof Date ? d : new Date(d);
      const m = String(x.getMonth() + 1).padStart(2, '0');
      const day = String(x.getDate()).padStart(2, '0');
      return x.getFullYear() + '-' + m + '-' + day;
    },
    monthKey(dateStr) { return String(dateStr || '').slice(0, 7); },
    addDays(dateStr, n) {
      const d = new Date(dateStr + 'T00:00:00');
      d.setDate(d.getDate() + n);
      return U.dateKey(d);
    },
    daysBetween(a, b) {
      const x = new Date(a + 'T00:00:00').getTime();
      const y = new Date(b + 'T00:00:00').getTime();
      return Math.round((y - x) / 86400000);
    },
    startOfMonth(dateStr) { return U.monthKey(dateStr) + '-01'; },
    monthLabel(mk, lang) {
      const names = lang === 'en'
        ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        : ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      const p = String(mk).split('-');
      const i = U.num(p[1], 1) - 1;
      return (names[i] || p[1]) + ' ' + p[0];
    },
    fmtDate(dateStr) { return U.iso(String(dateStr || '')); },
    fmtTime(ts) {
      const d = new Date(ts);
      return U.iso(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
    },

    /* ---------- متنوعة ---------- */
    uid(prefix) {
      return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
    deepClone(o) { return JSON.parse(JSON.stringify(o)); },
    sum(arr, fn) {
      return arr.reduce(function (a, x) { return a + U.num(fn ? fn(x) : x); }, 0);
    },
    groupBy(arr, fn) {
      const out = {};
      arr.forEach(function (x) {
        const k = fn(x);
        (out[k] = out[k] || []).push(x);
      });
      return out;
    },
    sortBy(arr, fn, desc) {
      return arr.slice().sort(function (a, b) {
        const x = fn(a), y = fn(b);
        if (x === y) return 0;
        return (x > y ? 1 : -1) * (desc ? -1 : 1);
      });
    },
    debounce(fn, ms) {
      let t = null;
      return function () {
        const args = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(self, args); }, ms || 200);
      };
    },
    normalizeAr(s) {
      return String(s || '').trim().toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[ً-ْ]/g, '');
    },
    match(haystack, needle) {
      if (!needle) return true;
      return U.normalizeAr(haystack).indexOf(U.normalizeAr(needle)) !== -1;
    },

    /* ---------- تصدير ---------- */
    csv(rows) {
      return '﻿' + rows.map(function (r) {
        return r.map(function (c) {
          const s = String(c === null || c === undefined ? '' : c);
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',');
      }).join('\r\n');
    },
    download(filename, text, mime) {
      try {
        const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = U.el('a', { href: url, download: filename });
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 600);
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  EX.util = U;
})(window);
