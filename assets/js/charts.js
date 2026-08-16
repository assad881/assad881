/* Asaad Paper Invest — dependency-free canvas charts.
   Palette slots come from CSS custom properties so light/dark swap in one place. */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }

  function palette() {
    return {
      s1: cssVar('--series-1', '#3987e5'),
      s2: cssVar('--series-2', '#d95926'),
      s3: cssVar('--series-3', '#199e70'),
      s4: cssVar('--series-4', '#c98500'),
      s5: cssVar('--series-5', '#d55181'),
      s6: cssVar('--series-6', '#008300'),
      s7: cssVar('--series-7', '#9085e9'),
      good: cssVar('--good', '#0ca30c'),
      critical: cssVar('--critical', '#d03b3b'),
      grid: cssVar('--grid', '#2c2c2a'),
      axis: cssVar('--axis', '#383835'),
      muted: cssVar('--text-muted', '#898781'),
      ink: cssVar('--text-primary', '#fff'),
      surface: cssVar('--surface-1', '#14181f')
    };
  }

  function setupCanvas(host, height) {
    host.innerHTML = '';
    host.classList.add('chart-host');
    const cv = document.createElement('canvas');
    cv.className = 'chart-canvas';
    host.appendChild(cv);
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.setAttribute('role', 'status');
    host.appendChild(tip);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(240, host.clientWidth || 320);
    const h = height || 220;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = '100%';
    cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.textBaseline = 'middle';
    try { ctx.direction = 'ltr'; } catch (e) { /* older engines ignore this */ }
    return { cv: cv, ctx: ctx, w: w, h: h, tip: tip };
  }

  function fmtY(v, kind) {
    if (kind === 'pct') return U.round(v, 1) + '%';
    if (Math.abs(v) >= 1000) return '$' + Math.round(v).toLocaleString('en-US');
    return '$' + U.round(v, 2);
  }

  function niceTicks(min, max, count) {
    if (!isFinite(min) || !isFinite(max)) return [];
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const step0 = span / (count || 4);
    if (!isFinite(step0) || step0 <= 0) return [min, max];
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
    if (!isFinite(step) || step <= 0) return [min, max];
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 0.001 && out.length < 12; v += step) {
      out.push(v);
    }
    return out;
  }

  const Charts = {
    palette: palette,

    /* ---------- multi-series line / area ---------- */
    line(host, cfg) {
      if (!host) return;
      const c = setupCanvas(host, cfg.height);
      const P = palette();
      const ctx = c.ctx;
      const series = (cfg.series || []).map(function (s) {
        return Object.assign({}, s, {
          points: (s.points || []).filter(function (p) { return p && p.d && isFinite(U.num(p.v)); })
        });
      }).filter(function (s) { return s.points.length; });
      if (!series.length) {
        ctx.fillStyle = P.muted;
        ctx.font = '13px system-ui, -apple-system, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(AP.t('no_data'), c.w / 2, c.h / 2);
        return;
      }

      const mode = cfg.mode || 'value';
      // `mode` rebases the data; `unit` only controls how axis/tooltip read
      const unit = cfg.unit || (mode === 'pct' ? 'pct' : 'value');
      const norm = series.map(function (s) {
        const base = U.num(s.points[0].v) || 1;
        return {
          label: s.label, color: s.color || P.s1, dashed: s.dashed,
          pts: s.points.map(function (p) {
            return { d: p.d, raw: U.num(p.v), v: mode === 'pct' ? ((U.num(p.v) - base) / base) * 100 : U.num(p.v) };
          })
        };
      });

      // shared date axis
      const dateSet = {};
      norm.forEach(function (s) { s.pts.forEach(function (p) { dateSet[p.d] = 1; }); });
      const dates = Object.keys(dateSet).sort();
      const xOf = {};
      const padL = cfg.padL === undefined ? 54 : cfg.padL;
      const padR = 12, padT = 12, padB = 26;
      const plotW = c.w - padL - padR;
      const plotH = c.h - padT - padB;
      dates.forEach(function (d, i) {
        xOf[d] = padL + (dates.length === 1 ? plotW / 2 : (i / (dates.length - 1)) * plotW);
      });

      let min = Infinity, max = -Infinity;
      norm.forEach(function (s) {
        s.pts.forEach(function (p) { min = Math.min(min, p.v); max = Math.max(max, p.v); });
      });
      if (cfg.zeroBase) min = Math.min(min, 0);
      const pad = (max - min) * 0.12 || Math.abs(max) * 0.05 || 1;
      min -= pad; max += pad;
      const yOf = function (v) { return padT + plotH - ((v - min) / (max - min)) * plotH; };

      // grid + y labels (recessive)
      ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = AP.i18n.isRTL() ? 'left' : 'right';
      const ticks = niceTicks(min, max, 4);
      ticks.forEach(function (t) {
        const y = yOf(t);
        ctx.strokeStyle = P.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, Math.round(y) + 0.5);
        ctx.lineTo(c.w - padR, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.fillStyle = P.muted;
        ctx.fillText(fmtY(t, unit), AP.i18n.isRTL() ? 4 : padL - 8, y);
      });

      // x labels: first / middle / last only
      ctx.textAlign = 'center';
      [0, Math.floor(dates.length / 2), dates.length - 1].forEach(function (i, k) {
        if (i < 0 || i >= dates.length) return;
        if (k === 1 && dates.length < 4) return;
        ctx.fillStyle = P.muted;
        ctx.fillText(dates[i].slice(5), xOf[dates[i]], c.h - padB / 2 + 2);
      });

      // single-series area fill (a lone data point gets a marker instead)
      if (norm.length === 1 && cfg.area !== false && dates.length > 1) {
        const s = norm[0];
        const g = ctx.createLinearGradient(0, padT, 0, padT + plotH);
        g.addColorStop(0, s.color + '40');
        g.addColorStop(1, s.color + '00');
        ctx.beginPath();
        s.pts.forEach(function (p, i) {
          const x = xOf[p.d], y = yOf(p.v);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.lineTo(xOf[s.pts[s.pts.length - 1].d], padT + plotH);
        ctx.lineTo(xOf[s.pts[0].d], padT + plotH);
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
      }

      // lines — thin, 2px
      norm.forEach(function (s) {
        if (dates.length === 1) {
          const p = s.pts[0];
          ctx.beginPath();
          ctx.arc(xOf[p.d], yOf(p.v), 5, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = P.surface;
          ctx.stroke();
          return;
        }
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = s.color;
        ctx.setLineDash(s.dashed ? [5, 4] : []);
        s.pts.forEach(function (p, i) {
          const x = xOf[p.d], y = yOf(p.v);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      });

      /* hover layer: crosshair + tooltip */
      const tip = c.tip;
      function nearestIndex(mx) {
        let bi = 0, bd = Infinity;
        dates.forEach(function (d, i) {
          const dist = Math.abs(xOf[d] - mx);
          if (dist < bd) { bd = dist; bi = i; }
        });
        return bi;
      }
      let overlay = null;
      function redrawOverlay(idx) {
        if (!overlay) {
          overlay = document.createElement('canvas');
          overlay.className = 'chart-overlay';
          const dpr = window.devicePixelRatio || 1;
          overlay.width = c.cv.width; overlay.height = c.cv.height;
          overlay.style.width = '100%'; overlay.style.height = c.h + 'px';
          host.appendChild(overlay);
          overlay.getContext('2d').scale(dpr, dpr);
        }
        const octx = overlay.getContext('2d');
        octx.clearRect(0, 0, c.w, c.h);
        if (idx === null) return;
        const d = dates[idx];
        const x = xOf[d];
        octx.strokeStyle = P.axis;
        octx.lineWidth = 1;
        octx.beginPath();
        octx.moveTo(Math.round(x) + 0.5, padT);
        octx.lineTo(Math.round(x) + 0.5, padT + plotH);
        octx.stroke();
        norm.forEach(function (s) {
          const p = s.pts.find(function (q) { return q.d === d; });
          if (!p) return;
          const y = yOf(p.v);
          octx.beginPath();
          octx.arc(x, y, 4.5, 0, Math.PI * 2);
          octx.fillStyle = s.color;
          octx.fill();
          octx.lineWidth = 2;
          octx.strokeStyle = P.surface;
          octx.stroke();
        });
      }
      function showTip(idx, mx) {
        const d = dates[idx];
        let html = '<div class="tip-date">' + U.esc(d) + '</div>';
        norm.forEach(function (s) {
          const p = s.pts.find(function (q) { return q.d === d; });
          if (!p) return;
          html += '<div class="tip-row"><span class="tip-dot" style="background:' + s.color + '"></span>' +
            '<span class="tip-label">' + U.esc(s.label) + '</span>' +
            '<span class="tip-val">' + U.esc(unit === 'pct' ? U.pct(p.v) : fmtY(p.raw, 'value')) + '</span></div>';
        });
        tip.innerHTML = html;
        tip.classList.add('show');
        const tw = tip.offsetWidth || 140;
        let left = xOf[d] - tw / 2;
        left = Math.max(4, Math.min(c.w - tw - 4, left));
        tip.style.left = left + 'px';
        tip.style.top = '6px';
      }
      function onMove(e) {
        const rect = c.cv.getBoundingClientRect();
        const mx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const idx = nearestIndex(mx);
        redrawOverlay(idx);
        showTip(idx, mx);
      }
      function onLeave() {
        redrawOverlay(null);
        tip.classList.remove('show');
      }
      host.addEventListener('mousemove', onMove);
      host.addEventListener('mouseleave', onLeave);
      host.addEventListener('touchstart', onMove, { passive: true });
      host.addEventListener('touchmove', onMove, { passive: true });
      host.addEventListener('touchend', onLeave);
    },

    /* ---------- horizontal bars (per-asset performance) ---------- */
    bars(host, rows, cfg) {
      cfg = cfg || {};
      if (!host) return;
      const P = palette();
      const h = Math.max(80, rows.length * 30 + 16);
      const c = setupCanvas(host, h);
      const ctx = c.ctx;
      if (!rows.length) return;
      const labelW = cfg.labelW || 62;
      const valW = 66;
      const plotW = c.w - labelW - valW - 12;
      const maxAbs = Math.max.apply(null, rows.map(function (r) { return Math.abs(U.num(r.value)); })) || 1;
      const hasNeg = rows.some(function (r) { return r.value < 0; });
      const zeroX = hasNeg ? labelW + plotW / 2 : labelW;
      const scale = hasNeg ? (plotW / 2) / maxAbs : plotW / maxAbs;

      ctx.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
      rows.forEach(function (r, i) {
        const y = 10 + i * 30;
        const v = U.num(r.value);
        const w = Math.abs(v) * scale;
        const x = v >= 0 ? zeroX : zeroX - w;
        ctx.fillStyle = r.color || (v >= 0 ? P.good : P.critical);
        const radius = 4;
        const bh = 14;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, Math.max(2, w), bh, v >= 0 ? [0, radius, radius, 0] : [radius, 0, 0, radius]);
        else ctx.rect(x, y, Math.max(2, w), bh);
        ctx.fill();

        ctx.fillStyle = P.ink;
        ctx.textAlign = 'left';
        ctx.fillText(r.label, 2, y + bh / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = v >= 0 ? P.good : P.critical;
        ctx.fillText(cfg.fmt ? cfg.fmt(v) : U.pct(v), c.w - 2, y + bh / 2);
      });
      if (hasNeg) {
        ctx.strokeStyle = P.axis;
        ctx.beginPath();
        ctx.moveTo(zeroX + 0.5, 4);
        ctx.lineTo(zeroX + 0.5, c.h - 4);
        ctx.stroke();
      }
    },

    /* ---------- allocation donut ---------- */
    donut(host, slices, cfg) {
      cfg = cfg || {};
      if (!host) return;
      const P = palette();
      const c = setupCanvas(host, cfg.height || 200);
      const ctx = c.ctx;
      const total = U.sum(slices.map(function (s) { return s.value; }));
      if (!total) {
        ctx.fillStyle = P.muted;
        ctx.textAlign = 'center';
        ctx.font = '13px system-ui';
        ctx.fillText(AP.t('no_data'), c.w / 2, c.h / 2);
        return;
      }
      const cx = c.w / 2, cy = c.h / 2;
      const r = Math.min(c.w, c.h) / 2 - 12;
      const inner = r * 0.62;
      let ang = -Math.PI / 2;
      slices.forEach(function (s) {
        const frac = s.value / total;
        const a2 = ang + frac * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, ang, a2);
        ctx.arc(cx, cy, inner, a2, ang, true);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        // 2px surface gap between segments
        ctx.lineWidth = 2;
        ctx.strokeStyle = P.surface;
        ctx.stroke();
        ang = a2;
      });
      if (cfg.centerLabel) {
        ctx.fillStyle = P.ink;
        ctx.textAlign = 'center';
        ctx.font = '600 15px system-ui, -apple-system, "Segoe UI", sans-serif';
        ctx.fillText(cfg.centerLabel, cx, cy - 6);
        if (cfg.centerSub) {
          ctx.font = '11px system-ui';
          ctx.fillStyle = P.muted;
          ctx.fillText(cfg.centerSub, cx, cy + 12);
        }
      }
    },

    /* ---------- score ring (0..100) ---------- */
    ring(host, score, cfg) {
      cfg = cfg || {};
      if (!host) return;
      const P = palette();
      const size = cfg.size || 116;
      const c = setupCanvas(host, size);
      const ctx = c.ctx;
      const cx = c.w / 2, cy = size / 2;
      const r = size / 2 - 10;
      const val = U.clamp(U.num(score), 0, 100);
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.strokeStyle = P.grid;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      const color = cfg.color || (val >= 80 ? P.good : val >= 65 ? P.s3 : val >= 50 ? P.s4 : val >= 35 ? P.s2 : P.critical);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (val / 100) * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = P.ink;
      ctx.textAlign = 'center';
      ctx.font = '700 24px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillText(String(Math.round(val)), cx, cy - 2);
      ctx.font = '10px system-ui';
      ctx.fillStyle = P.muted;
      ctx.fillText('/100', cx, cy + 16);
    },

    /* ---------- sparkline ---------- */
    spark(host, points, color, height) {
      if (!host || !points || points.length < 2) return;
      const P = palette();
      const c = setupCanvas(host, height || 40);
      const ctx = c.ctx;
      const vals = points.map(function (p) { return U.num(p.v !== undefined ? p.v : p); });
      const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
      const span = (max - min) || 1;
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color || P.s1;
      vals.forEach(function (v, i) {
        const x = (i / (vals.length - 1)) * (c.w - 4) + 2;
        const y = c.h - 4 - ((v - min) / span) * (c.h - 8);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    },

    /* ---------- component score breakdown ---------- */
    meters(host, rows) {
      if (!host) return;
      const P = palette();
      host.innerHTML = '';
      rows.forEach(function (r) {
        const wrap = U.el('div', { class: 'meter-row' });
        wrap.appendChild(U.el('span', { class: 'meter-label', text: r.label }));
        const track = U.el('div', { class: 'meter-track' });
        const fill = U.el('div', { class: 'meter-fill' });
        fill.style.width = U.clamp(r.value, 0, 100) + '%';
        fill.style.background = r.value >= 65 ? P.s3 : r.value >= 45 ? P.s4 : P.s2;
        track.appendChild(fill);
        wrap.appendChild(track);
        wrap.appendChild(U.el('span', { class: 'meter-val', text: Math.round(r.value) + (r.weight ? ' · ×' + r.weight : '') }));
        host.appendChild(wrap);
      });
    }
  };

  AP.charts = Charts;
})(window);
