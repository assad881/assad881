/* أدوات عامة: تنسيق، تحقق، DOM، تصدير */
window.KX = window.KX || {};
KX.util = (function () {
  const cfg = () => KX.config;

  /* ---------- معرفات وتواريخ ---------- */
  function uid(prefix) {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return (prefix ? prefix + '_' : '') + t + r;
  }
  const nowISO = () => new Date().toISOString();

  function orderNo(seq) {              // رقم طلب مقروء: KX-2026-000148
    const y = new Date().getFullYear();
    return 'KX-' + y + '-' + String(seq).padStart(6, '0');
  }

  /* ---------- أرقام وعملة ---------- */
  function round(n, d) {
    const f = Math.pow(10, d === undefined ? 3 : d);
    return Math.round((Number(n) + Number.EPSILON) * f) / f;
  }
  function money(n) {                  // 12.5 -> "12.500"
    const d = cfg().currency.decimals;
    return (Number(n) || 0).toFixed(d);
  }
  function fmtOMR(n) {                 // 12.5 -> "12.500 ر.ع."
    return money(n) + ' ' + cfg().currency.symbol;
  }
  const NUM_LOCALE = 'ar-OM-u-nu-latn';   // أرقام لاتينية لتطابق تنسيق العملة
  function fmtNum(n, d) {
    return new Intl.NumberFormat(NUM_LOCALE, {
      minimumFractionDigits: d || 0, maximumFractionDigits: d === undefined ? 2 : d
    }).format(Number(n) || 0);
  }
  const ceilDiv = (a, b) => (b > 0 ? Math.ceil(a / b) : 0);

  /* الوحدة تأتي من المادة؛ لا تُفترض هنا */
  const unitLabel = (u) => (KX.schema.UNITS[u || 'm3'] || u || '');
  /* الكمية بلا كسر زائد: 18 م³ لا 18.0 م³ */
  const fmtQty = (v, u) => new Intl.NumberFormat(NUM_LOCALE,
    { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(Number(v) || 0) +
    ' ' + unitLabel(u);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);

  /* ---------- تواريخ ---------- */
  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(NUM_LOCALE,
      { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(NUM_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' }) +
           ' • ' + d.toLocaleTimeString(NUM_LOCALE, { hour: '2-digit', minute: '2-digit' });
  }
  function relTime(iso) {
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60) return 'الآن';
    if (diff < 3600) return 'قبل ' + Math.floor(diff / 60) + ' دقيقة';
    if (diff < 86400) return 'قبل ' + Math.floor(diff / 3600) + ' ساعة';
    return 'قبل ' + Math.floor(diff / 86400) + ' يوم';
  }
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const addDays = (iso, n) => new Date(new Date(iso).getTime() + n * 86400000).toISOString();

  /* ---------- تحقق من المدخلات ---------- */
  function normalizePhone(p) {          // يقبل 9xxxxxxx أو 9689xxxxxxx أو +968...
    let s = String(p || '').replace(/[^\d]/g, '');
    if (s.startsWith('00968')) s = s.slice(5);
    if (s.length === 8) s = '968' + s;
    return s;
  }
  function isValidPhone(p) {
    const s = normalizePhone(p);
    return /^968[79][0-9]{7}$/.test(s) || /^968[89][0-9]{7}$/.test(s);
  }
  function fmtPhone(p) {
    const s = normalizePhone(p);
    return s.length === 11 ? '+968 ' + s.slice(3, 7) + ' ' + s.slice(7) : p;
  }
  function isValidCoords(lat, lng) {
    return Number.isFinite(+lat) && Number.isFinite(+lng) &&
           Math.abs(+lat) <= 90 && Math.abs(+lng) <= 180;
  }
  /* التحقق من مجموعة حقول: يعيد كائن أخطاء فارغًا عند النجاح */
  function validate(values, rules) {
    const errors = {};
    Object.keys(rules).forEach(function (k) {
      const r = rules[k], v = values[k];
      if (r.required && (v === undefined || v === null || String(v).trim() === '')) {
        errors[k] = r.message || 'هذا الحقل مطلوب'; return;
      }
      if (v === undefined || v === null || v === '') return;
      if (r.type === 'number') {
        const n = Number(v);
        if (!Number.isFinite(n)) { errors[k] = 'أدخل رقمًا صحيحًا'; return; }
        if (r.min !== undefined && n < r.min) { errors[k] = 'أقل قيمة مسموحة ' + r.min; return; }
        if (r.max !== undefined && n > r.max) { errors[k] = 'أعلى قيمة مسموحة ' + r.max; return; }
      }
      if (r.type === 'phone' && !isValidPhone(v)) { errors[k] = 'رقم هاتف عُماني غير صحيح'; return; }
      if (r.minLength && String(v).length < r.minLength) {
        errors[k] = 'الحد الأدنى ' + r.minLength + ' حروف'; return;
      }
      if (r.pattern && !r.pattern.test(String(v))) { errors[k] = r.message || 'صيغة غير صحيحة'; }
    });
    return errors;
  }

  /* ---------- DOM ---------- */
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  function on(root, evt, sel, handler) {
    (root || document).addEventListener(evt, function (e) {
      const t = e.target.closest(sel);
      if (t && (root || document).contains(t)) handler(e, t);
    });
  }

  /* ---------- إشعارات واجهة ---------- */
  function toast(msg, kind) {
    let host = $('#kx-toasts');
    if (!host) { host = document.createElement('div'); host.id = 'kx-toasts'; document.body.appendChild(host); }
    const n = document.createElement('div');
    n.className = 'toast toast--' + (kind || 'info');
    n.textContent = msg;
    host.appendChild(n);
    setTimeout(function () { n.classList.add('is-out'); setTimeout(() => n.remove(), 300); }, 3200);
  }

  /* حوار تأكيد يعيد Promise<boolean> */
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true">' +
          '<h3>' + esc(opts.title || 'تأكيد') + '</h3>' +
          '<p>' + esc(opts.message || '') + '</p>' +
          (opts.reasonRequired
            ? '<label class="field"><span>السبب <b class="req">*</b></span><textarea id="kx-reason" rows="3"></textarea></label>'
            : '') +
          '<div class="modal__actions">' +
            '<button class="btn btn--ghost" data-no>إلغاء</button>' +
            '<button class="btn ' + (opts.danger ? 'btn--danger' : 'btn--primary') + '" data-yes>' +
              esc(opts.confirmText || 'تأكيد') + '</button>' +
          '</div></div>';
      document.body.appendChild(wrap);
      const close = (val) => { wrap.remove(); resolve(val); };
      wrap.querySelector('[data-no]').onclick = () => close(false);
      wrap.querySelector('[data-yes]').onclick = function () {
        if (opts.reasonRequired) {
          const r = wrap.querySelector('#kx-reason').value.trim();
          if (!r) { toast('السبب مطلوب', 'error'); return; }
          close(r);
        } else close(true);
      };
      wrap.onclick = (e) => { if (e.target === wrap) close(false); };
    });
  }

  /* ---------- CSV (استيراد/تصدير الأسعار والتقارير) ---------- */
  function toCSV(rows, columns) {
    const cols = columns || Object.keys(rows[0] || {});
    const escCell = (v) => {
      const s = v === undefined || v === null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + [cols.join(',')]
      .concat(rows.map((r) => cols.map((c) => escCell(r[c])).join(',')))
      .join('\n');
  }
  function parseCSV(text) {
    const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').trim();
    const lines = clean.split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) return [];
    const split = (line) => {
      const out = []; let cur = '', q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') q = false;
          else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === ',') { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur); return out;
    };
    const head = split(lines[0]).map((h) => h.trim());
    return lines.slice(1).map(function (l) {
      const cells = split(l), o = {};
      head.forEach((h, i) => { o[h] = (cells[i] || '').trim(); });
      return o;
    });
  }
  /* حفظ ملف للمستخدم.
     في مضيف يمنع التنزيل المباشر (صفحة منشورة) يُستخدم مسار الحفظ المتاح؛
     وفي الملف المحلي أو الخادم العادي يُستخدم رابط Blob. */
  let _downloads;                       // undefined = لم يُفحص، null = غير متاح
  async function saveHandler() {
    if (_downloads !== undefined) return _downloads;
    _downloads = null;
    if (window.claude && typeof window.claude.use === 'function') {
      try { _downloads = await window.claude.use('downloads'); } catch (e) { _downloads = null; }
    }
    return _downloads;
  }
  async function download(filename, content, mime) {
    const cap = await saveHandler();
    if (cap) {
      try { await cap.save({ filename: filename, data: content }); return true; }
      catch (err) {
        if (err && err.code === 'declined') return false;
        if (err && ['rate_limited', 'unavailable', 'not_granted'].indexOf(err.code) !== -1) {
          toast('تعذّر حفظ الملف في هذا العرض', 'error'); return false;
        }
        /* أخطاء أخرى: جرّب المسار المحلي */
      }
    }
    const blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  }

  /* ---------- متفرقات ---------- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function groupBy(arr, key) {
    return arr.reduce(function (acc, x) {
      const k = typeof key === 'function' ? key(x) : x[key];
      (acc[k] = acc[k] || []).push(x); return acc;
    }, {});
  }
  function sortBy(arr, key, dir) {
    const f = typeof key === 'function' ? key : (x) => x[key];
    const s = dir === 'desc' ? -1 : 1;
    return arr.slice().sort((a, b) => (f(a) > f(b) ? s : f(a) < f(b) ? -s : 0));
  }
  /* مسافة تقريبية بين إحداثيتين بالكيلومتر (Haversine) */
  function distanceKm(a, b) {
    if (!a || !b) return null;
    const R = 6371, toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return round(2 * R * Math.asin(Math.sqrt(h)), 1);
  }

  return { uid, nowISO, orderNo, round, money, fmtOMR, fmtNum, unitLabel, fmtQty, ceilDiv, clamp, sum,
           fmtDate, fmtDateTime, relTime, daysBetween, addDays,
           normalizePhone, isValidPhone, fmtPhone, isValidCoords, validate,
           esc, $, $$, on, toast, confirmDialog,
           toCSV, parseCSV, download, clone, groupBy, sortBy, distanceKm };
})();
