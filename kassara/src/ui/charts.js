/* ============================================================
   رسوم بيانية بصيغة SVG مضمّنة — بلا أي مكتبة خارجية.
   القواعد المطبّقة: محور واحد لكل رسم، ألوان مُتحقَّق منها،
   عناوين مباشرة على القيم المهمّة، وجدول بديل لكل رسم.
   ============================================================ */
window.KX = window.KX || {};
KX.charts = (function () {
  const U = () => KX.util;
  const e = (s) => KX.util.esc(s);
  let seq = 0;
  const nid = () => 'viz' + (++seq);

  function niceMax(v) {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }

  /* ---------- خط زمني: سلسلة واحدة، بلا مفتاح ألوان (العنوان يسمّيها) ---------- */
  function line(data, opts) {
    opts = opts || {};
    const id = nid(), W = 640, H = opts.height || 200;
    const pad = { t: 14, r: 14, b: 26, l: 44 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    if (!data.length) return KX.ui.empty('لا توجد بيانات كافية للرسم', '📉');

    const max = niceMax(Math.max.apply(null, data.map((d) => d.value)) || 1);
    const x = (i) => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
    const y = (v) => pad.t + ih - (v / max) * ih;

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
    const grid = ticks.map((t) =>
      '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + y(t) + '" y2="' + y(t) + '"/>').join('');
    const yLabels = ticks.map((t) =>
      '<text x="' + (pad.l - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' +
      U().fmtNum(t, t < 10 ? 1 : 0) + '</text>').join('');

    const pts = data.map((d, i) => x(i) + ',' + y(d.value));
    const path = 'M' + pts.join(' L');
    const area = path + ' L' + x(data.length - 1) + ',' + (pad.t + ih) + ' L' + x(0) + ',' + (pad.t + ih) + ' Z';

    /* عناوين محور السين: أول وآخر ونقطة وسطى فقط لتفادي التزاحم */
    const showIdx = data.length <= 7 ? data.map((_, i) => i)
      : [0, Math.floor(data.length / 2), data.length - 1];
    const xLabels = showIdx.map((i) =>
      '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + e(data[i].label) + '</text>').join('');

    const dots = data.map((d, i) =>
      '<circle class="viz__dot" cx="' + x(i) + '" cy="' + y(d.value) + '" r="4" ' +
      'data-i="' + i + '" data-label="' + e(d.label) + '" data-value="' + e(d.display || U().fmtNum(d.value, 1)) + '"/>').join('');

    /* مناطق التقاط عريضة للمؤشّر */
    const hit = data.map((d, i) =>
      '<rect x="' + (x(i) - iw / (data.length * 2 || 1)) + '" y="' + pad.t + '" ' +
      'width="' + Math.max(12, iw / (data.length || 1)) + '" height="' + ih + '" fill="transparent" ' +
      'data-hit="' + i + '" data-x="' + x(i) + '" data-y="' + y(d.value) + '" ' +
      'data-label="' + e(d.label) + '" data-value="' + e(d.display || U().fmtNum(d.value, 1)) + '"/>').join('');

    return '<div class="viz" id="' + id + '" data-chart="line">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + e(opts.aria || 'رسم بياني خطي') + '">' +
      '<g class="viz__grid">' + grid + '</g>' +
      '<g class="viz__axis">' + yLabels + xLabels + '</g>' +
      '<path class="viz__area" d="' + area + '"/>' +
      '<path class="viz__line" d="' + path + '"/>' +
      '<line class="viz__cross" x1="0" x2="0" y1="' + pad.t + '" y2="' + (pad.t + ih) + '" style="opacity:0"/>' +
      dots + hit + '</svg>' +
      '<div class="viz-tip"></div>' +
      (opts.note ? '<div class="viz-note">' + e(opts.note) + '</div>' : '') +
      '</div>';
  }

  /* ---------- أعمدة أفقية: سلسلة واحدة، عناوين قيم مباشرة ---------- */
  function barsH(data, opts) {
    opts = opts || {};
    if (!data.length) return KX.ui.empty('لا توجد بيانات كافية للرسم', '📊');
    const id = nid(), W = 640, rowH = 30, W_LABEL = 150;
    const H = data.length * rowH + 8;
    const max = Math.max.apply(null, data.map((d) => d.value)) || 1;
    const barW = W - W_LABEL - 78;

    const rows = data.map(function (d, i) {
      const w = Math.max(3, (d.value / max) * barW);
      const yy = i * rowH + 6;
      /* الأعمدة في اتجاه RTL تبدأ من اليمين */
      return '<text class="viz__label--dim viz__label" x="' + (W - 4) + '" y="' + (yy + 13) + '" ' +
             'text-anchor="end">' + e(d.label) + '</text>' +
             '<rect class="viz__bar" x="' + (W - W_LABEL - w) + '" y="' + yy + '" width="' + w + '" height="17" rx="4"/>' +
             '<text class="viz__label" x="' + (W - W_LABEL - w - 8) + '" y="' + (yy + 13) + '" text-anchor="end">' +
             e(d.display || U().fmtNum(d.value, 1)) + '</text>';
    }).join('');

    return '<div class="viz" id="' + id + '">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + e(opts.aria || 'أعمدة') + '">' +
      rows + '</svg>' +
      (opts.note ? '<div class="viz-note">' + e(opts.note) + '</div>' : '') + '</div>';
  }

  /* ---------- شريط مكدّس: ثلاث فئات كحد أقصى + مفتاح ألوان + عناوين مباشرة ---------- */
  function stacked(segments, opts) {
    opts = opts || {};
    const total = U().sum(segments, (s) => Number(s.value)) || 1;
    const id = nid(), W = 640, H = 46, GAP = 2;      /* فاصل 2px بلون السطح بين الشرائح */
    let x = W;
    const bars = segments.map(function (s, i) {
      const w = Math.max(2, (Number(s.value) / total) * (W - GAP * (segments.length - 1)));
      x -= w;
      const rect = '<rect x="' + x + '" y="0" width="' + w + '" height="22" rx="4" ' +
                   'fill="var(--series-' + (i + 1) + ')"/>';
      const pct = ((Number(s.value) / total) * 100).toFixed(0);
      const label = w > 44
        ? '<text class="viz__label" x="' + (x + w / 2) + '" y="38" text-anchor="middle">' + pct + '%</text>'
        : '';
      x -= GAP;
      return rect + label;
    }).join('');

    const legend = '<div class="viz-legend">' + segments.map((s, i) =>
      '<span><i style="background:var(--series-' + (i + 1) + ')"></i>' + e(s.label) + ' — <b>' +
      e(s.display || U().fmtOMR(s.value)) + '</b></span>').join('') + '</div>';

    return '<div class="viz" id="' + id + '">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + e(opts.aria || 'توزيع') + '">' +
      bars + '</svg>' + legend +
      (opts.note ? '<div class="viz-note">' + e(opts.note) + '</div>' : '') + '</div>';
  }

  /* شريط مصغّر داخل الجداول */
  function mini(value, max) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return '<div class="minibar viz"><i style="width:' + pct.toFixed(1) + '%"></i></div>';
  }

  /* تفعيل التلميحات على الرسوم الخطية بعد إدراجها في الصفحة */
  function bindTooltips(root) {
    U().$$('[data-chart="line"]', root || document).forEach(function (box) {
      const tip = box.querySelector('.viz-tip');
      const cross = box.querySelector('.viz__cross');
      const svg = box.querySelector('svg');
      const vb = svg.viewBox.baseVal;
      U().$$('[data-hit]', box).forEach(function (r) {
        r.addEventListener('mouseenter', function () {
          const px = Number(r.dataset.x), py = Number(r.dataset.y);
          const rect = svg.getBoundingClientRect();
          const sx = rect.width / vb.width, sy = rect.height / vb.height;
          tip.innerHTML = '<span>' + r.dataset.label + '</span> — <b>' + r.dataset.value + '</b>';
          tip.style.insetInlineStart = '';
          tip.style.left = (px * sx) + 'px';
          tip.style.top = (py * sy) + 'px';
          tip.classList.add('is-on');
          cross.setAttribute('x1', px); cross.setAttribute('x2', px);
          cross.style.opacity = '1';
        });
        r.addEventListener('mouseleave', function () {
          tip.classList.remove('is-on'); cross.style.opacity = '0';
        });
      });
    });
  }
  return { line, barsH, stacked, mini, bindTooltips, niceMax };
})();
