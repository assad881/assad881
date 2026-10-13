/* كسارة اكسبريس — رسوم بيانية على canvas بدون مكتبات خارجية */
(function (root) {
  'use strict';
  const EX = (root.EX = root.EX || {});
  const U = EX.util;

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function palette() {
    return {
      ink: cssVar('--text-primary', '#f2f5f9'),
      muted: cssVar('--text-muted', '#74808f'),
      grid: cssVar('--grid', '#232b36'),
      axis: cssVar('--axis', '#38424f'),
      series: [1, 2, 3, 4, 5, 6, 7].map(function (i) { return cssVar('--series-' + i, '#3987e5'); }),
      good: cssVar('--good', '#0ca30c'),
      critical: cssVar('--critical', '#d03b3b'),
      surface: cssVar('--surface-1', '#141922')
    };
  }

  /* يهيّئ canvas بدقة الشاشة ويعيد السياق والأبعاد المنطقية */
  function setup(host, height) {
    const dpr = root.devicePixelRatio || 1;
    const w = Math.max(240, host.clientWidth || 320);
    const h = height || 200;
    const cv = U.el('canvas', { style: { width: '100%', height: h + 'px', display: 'block' } });
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    U.clear(host).appendChild(cv);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.font = '11px ' + cssVar('--font', 'system-ui');
    ctx.textBaseline = 'middle';
    return { ctx: ctx, w: w, h: h, p: palette() };
  }

  function niceMax(v) {
    if (v <= 0) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / mag;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * mag;
  }

  function shortNum(v) {
    const n = U.num(v);
    const a = Math.abs(n);
    if (a >= 1000000) return (n / 1000000).toFixed(a >= 10000000 ? 0 : 1) + 'M';
    if (a >= 1000) return (n / 1000).toFixed(a >= 10000 ? 0 : 1) + 'k';
    if (a >= 100) return n.toFixed(0);
    return n.toFixed(a >= 10 ? 0 : 1);
  }

  const Charts = {
    empty(host, msg) {
      U.clear(host).appendChild(U.el('div', { class: 'chart-empty', text: msg || EX.t('no_data') }));
    },

    /* خط/مساحة: data = [{label, value}] مع سلسلة ثانية اختيارية value2 */
    line(host, data, opts) {
      opts = opts || {};
      if (!data || !data.length) return Charts.empty(host, opts.emptyMsg);
      const s = setup(host, opts.height || 190);
      const ctx = s.ctx, p = s.p;
      const padL = 44, padR = 10, padT = 12, padB = 22;
      const plotW = s.w - padL - padR, plotH = s.h - padT - padB;
      const vals = data.map(function (d) { return U.num(d.value); })
        .concat(opts.second ? data.map(function (d) { return U.num(d.value2); }) : []);
      const max = niceMax(Math.max.apply(null, vals.concat([0])));

      // شبكة أفقية + محور القيم
      ctx.strokeStyle = p.grid; ctx.lineWidth = 1; ctx.fillStyle = p.muted;
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const y = padT + plotH - (plotH * i / 4);
        ctx.beginPath(); ctx.moveTo(padL, y + 0.5); ctx.lineTo(padL + plotW, y + 0.5); ctx.stroke();
        ctx.fillText(shortNum(max * i / 4), padL - 6, y);
      }

      const x = function (i) { return padL + (data.length === 1 ? plotW / 2 : plotW * i / (data.length - 1)); };
      const y = function (v) { return padT + plotH - plotH * (U.num(v) / (max || 1)); };

      const drawSeries = function (key, color, fill) {
        ctx.beginPath();
        data.forEach(function (d, i) {
          const px = x(i), py = y(d[key]);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
        if (fill) {
          ctx.lineTo(x(data.length - 1), padT + plotH);
          ctx.lineTo(x(0), padT + plotH);
          ctx.closePath();
          const g = ctx.createLinearGradient(0, padT, 0, padT + plotH);
          g.addColorStop(0, color + '33');
          g.addColorStop(1, color + '00');
          ctx.fillStyle = g; ctx.fill();
        }
      };
      drawSeries('value', opts.color || p.series[0], opts.fill !== false);
      if (opts.second) drawSeries('value2', opts.color2 || p.series[1], false);

      // تسميات المحور الأفقي: أول ومنتصف وآخر نقطة فقط لتبقى مقروءة
      ctx.fillStyle = p.muted; ctx.textAlign = 'center';
      [0, Math.floor((data.length - 1) / 2), data.length - 1].forEach(function (i, k, arr) {
        if (arr.indexOf(i) !== k) return;
        const d = data[i];
        if (!d) return;
        ctx.fillText(d.label, U.clamp(x(i), padL + 18, padL + plotW - 18), s.h - padB / 2 - 1);
      });
    },

    /* أعمدة رأسية مجمّعة: data = [{label, value, value2}] */
    bars(host, data, opts) {
      opts = opts || {};
      if (!data || !data.length) return Charts.empty(host, opts.emptyMsg);
      const s = setup(host, opts.height || 190);
      const ctx = s.ctx, p = s.p;
      const padL = 44, padR = 10, padT = 12, padB = 26;
      const plotW = s.w - padL - padR, plotH = s.h - padT - padB;
      const two = !!opts.second;
      const vals = data.map(function (d) { return U.num(d.value); })
        .concat(two ? data.map(function (d) { return U.num(d.value2); }) : []);
      const max = niceMax(Math.max.apply(null, vals.concat([0])));

      ctx.strokeStyle = p.grid; ctx.fillStyle = p.muted; ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const y = padT + plotH - (plotH * i / 4);
        ctx.beginPath(); ctx.moveTo(padL, y + 0.5); ctx.lineTo(padL + plotW, y + 0.5); ctx.stroke();
        ctx.fillText(shortNum(max * i / 4), padL - 6, y);
      }

      const slot = plotW / data.length;
      const bw = Math.max(4, Math.min(28, slot * (two ? 0.34 : 0.6)));
      data.forEach(function (d, i) {
        const cx = padL + slot * (i + 0.5);
        const draw = function (v, color, off) {
          const hh = plotH * (U.num(v) / (max || 1));
          ctx.fillStyle = color;
          ctx.fillRect(cx + off - bw / 2, padT + plotH - hh, bw, Math.max(hh, v > 0 ? 1.5 : 0));
        };
        if (two) {
          draw(d.value, opts.color || p.series[0], -bw / 2 - 1);
          draw(d.value2, opts.color2 || p.series[1], bw / 2 + 1);
        } else {
          draw(d.value, d.color || opts.color || p.series[0], 0);
        }
        if (slot > 26 || data.length <= 12) {
          ctx.fillStyle = p.muted; ctx.textAlign = 'center';
          ctx.fillText(d.label, cx, s.h - padB / 2);
        }
      });
    },

    /* أعمدة أفقية — الأفضل للأسماء العربية الطويلة (عملاء / مواد) */
    hbars(host, data, opts) {
      opts = opts || {};
      if (!data || !data.length) return Charts.empty(host, opts.emptyMsg);
      const rowH = opts.rowH || 26;
      const s = setup(host, Math.max(70, data.length * rowH + 10));
      const ctx = s.ctx, p = s.p;
      const max = Math.max.apply(null, data.map(function (d) { return U.num(d.value); }).concat([0.0001]));
      const labelW = Math.min(150, Math.max(70, s.w * 0.34));
      const valueW = 62;
      const barW = Math.max(30, s.w - labelW - valueW - 12);
      const rtl = document.documentElement.getAttribute('dir') !== 'ltr';

      data.forEach(function (d, i) {
        const y = 6 + i * rowH + rowH / 2 - 3;
        const w = Math.max(2, barW * (U.num(d.value) / max));
        const color = d.color || (opts.colors ? p.series[i % p.series.length] : (opts.color || p.series[0]));
        if (rtl) {
          ctx.textAlign = 'right';
          ctx.fillStyle = p.ink;
          ctx.fillText(String(d.label).slice(0, 26), s.w - 2, y);
          ctx.fillStyle = color;
          ctx.fillRect(s.w - labelW - w, y - 7, w, 14);
          ctx.textAlign = 'left';
          ctx.fillStyle = p.muted;
          ctx.fillText(d.text || shortNum(d.value), 2, y);
        } else {
          ctx.textAlign = 'left';
          ctx.fillStyle = p.ink;
          ctx.fillText(String(d.label).slice(0, 26), 2, y);
          ctx.fillStyle = color;
          ctx.fillRect(labelW, y - 7, w, 14);
          ctx.textAlign = 'right';
          ctx.fillStyle = p.muted;
          ctx.fillText(d.text || shortNum(d.value), s.w - 2, y);
        }
      });
    },

    /* حلقة: data = [{label, value}] */
    donut(host, data, opts) {
      opts = opts || {};
      const items = (data || []).filter(function (d) { return U.num(d.value) > 0; });
      if (!items.length) return Charts.empty(host, opts.emptyMsg);
      const s = setup(host, opts.height || 190);
      const ctx = s.ctx, p = s.p;
      const total = U.sum(items, function (d) { return d.value; });
      const cx = s.w / 2, cy = s.h / 2, r = Math.min(s.w, s.h) / 2 - 8, r2 = r * 0.6;
      let a0 = -Math.PI / 2;
      items.forEach(function (d, i) {
        const a1 = a0 + Math.PI * 2 * (U.num(d.value) / total);
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a1);
        ctx.arc(cx, cy, r2, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = d.color || p.series[i % p.series.length];
        ctx.fill();
        a0 = a1;
      });
      ctx.fillStyle = p.ink; ctx.textAlign = 'center';
      ctx.font = '600 14px ' + cssVar('--font', 'system-ui');
      ctx.fillText(shortNum(total), cx, cy - 6);
      ctx.font = '10px ' + cssVar('--font', 'system-ui');
      ctx.fillStyle = p.muted;
      ctx.fillText(opts.centerLabel || 'ر.ع', cx, cy + 9);
    },

    legend(items) {
      const p = palette();
      return U.el('div', { class: 'legend' }, items.map(function (it, i) {
        return U.el('span', { class: 'legend-item' }, [
          U.el('i', { style: { background: it.color || p.series[i % p.series.length] } }),
          U.el('span', { text: it.label })
        ]);
      }));
    }
  };

  EX.charts = Charts;
})(window);
