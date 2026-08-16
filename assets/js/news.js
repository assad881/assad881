/* Asaad Paper Invest — Market Intelligence.
   Headlines alone are never trusted: each item is classified and paired with a
   short, probabilistic impact note. */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  const LEX = [
    { re: /(beats?|beat expectations|tops estimates|record (revenue|profit)|raises guidance|upgrade[sd]?|outperform|strong demand|buyback|dividend (hike|increase)|approval|wins? contract|expands?)/i, w: 1, cat: 'positive_fundamental' },
    { re: /(misses?|missed estimates|cuts? guidance|downgrade[sd]?|underperform|weak demand|slowdown|layoffs?|recall|investigation|lawsuit|probe|fine[ds]?|antitrust|delays?|halts?|resigns?)/i, w: -1, cat: 'negative_fundamental' },
    { re: /(surges?|soars?|jumps?|rallies|rally|climbs?|gains?)/i, w: 0.45, cat: 'price_action' },
    { re: /(plunges?|tumbles?|slumps?|sinks?|drops?|falls?|slides?)/i, w: -0.45, cat: 'price_action' },
    { re: /(inflation cools?|rate cut|dovish|soft landing|stimulus)/i, w: 0.5, cat: 'macro' },
    { re: /(inflation (rises?|hot)|rate hike|hawkish|recession|tariffs?|shutdown|conflict|war)/i, w: -0.5, cat: 'macro' },
    { re: /(launch(es|ed)?|unveils?|new (chip|model|product)|partnership|ai deal|expansion)/i, w: 0.4, cat: 'product' },
    { re: /(earnings|results|quarterly report|guidance)/i, w: 0, cat: 'earnings' }
  ];

  const IMPACT = {
    ar: {
      positive_fundamental: 'خبر يتعلق بأساسيات الشركة قد يدعم التقييم على المدى المتوسط. الاحتمالية إيجابية لكن التأثير قد يكون مُسعَّرًا مسبقًا.',
      negative_fundamental: 'خبر قد يضغط على الأرباح أو التقييم. يُفضّل رفع مستوى الحذر وعدم زيادة المركز حتى تتضح الصورة.',
      price_action: 'حركة سعرية حادة دون تغيّر جوهري مؤكد في الأساسيات — التقلب أعلى من المعتاد ولا يوجد تأكيد كافٍ للاتجاه.',
      macro: 'عامل اقتصادي عام يؤثر على السوق ككل وليس على هذا الأصل وحده. قد ينعكس على شهية المخاطرة.',
      product: 'تطور تشغيلي قد يدعم النمو مستقبلًا. الأثر الفعلي يحتاج وقتًا للظهور في النتائج المالية.',
      earnings: 'حدث مرتبط بنتائج الأرباح — التقلب عادةً يرتفع حول هذه الفترة، ويفضّل تقليل حجم المخاطرة قبلها.',
      neutral: 'خبر معلوماتي دون أثر جوهري واضح على قرار الاستثمار في الوقت الحالي.'
    },
    en: {
      positive_fundamental: 'A fundamentals-related item that may support valuation over the medium term. Probability leans positive, though the impact may already be priced in.',
      negative_fundamental: 'An item that could pressure earnings or valuation. Higher caution is warranted; adding to the position is not advisable until this clears.',
      price_action: 'A sharp price move without confirmed fundamental change — volatility is above normal and there is no sufficient confirmation of direction.',
      macro: 'A macro factor affecting the whole market rather than this asset alone. It may shift overall risk appetite.',
      product: 'An operational development that may support future growth. The real effect needs time to appear in financial results.',
      earnings: 'An earnings-related event — volatility usually rises around these dates, so reducing risk size beforehand is reasonable.',
      neutral: 'Informational item with no clear material effect on the investment decision right now.'
    }
  };

  function classify(text) {
    let score = 0, cat = 'neutral', best = 0;
    LEX.forEach(function (l) {
      if (l.re.test(text)) {
        score += l.w;
        if (Math.abs(l.w) >= Math.abs(best)) { best = l.w; cat = l.cat; }
        else if (best === 0 && l.cat === 'earnings') cat = 'earnings';
      }
    });
    score = U.clamp(score, -1, 1);
    const sentiment = score > 0.25 ? 'positive' : score < -0.25 ? 'negative' : 'neutral';
    if (sentiment === 'neutral' && cat === 'price_action') cat = 'neutral';
    return { score: score, sentiment: sentiment, cat: cat };
  }

  const News = {
    all() {
      return AP.store.s.news.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    },

    forSymbol(sym) {
      return News.all().filter(function (n) { return n.symbol === sym; });
    },

    add(item) {
      const text = (item.title || '') + ' ' + (item.summary || '');
      const c = item.sentiment ? { sentiment: item.sentiment, score: item.sentiment === 'positive' ? 0.6 : item.sentiment === 'negative' ? -0.6 : 0, cat: 'neutral' } : classify(text);
      const n = {
        id: U.uid('nw'),
        date: item.date || U.today(),
        symbol: (item.symbol || 'MARKET').toUpperCase(),
        title: item.title || '',
        summary: item.summary || IMPACT[AP.i18n.lang][c.cat] || IMPACT.ar.neutral,
        impactKey: c.cat,
        sentiment: c.sentiment,
        score: c.score,
        source: item.source || 'manual',
        url: item.url || null,
        manual: item.manual !== false
      };
      if (AP.store.s.news.some(function (x) { return x.title === n.title && x.symbol === n.symbol && x.date === n.date; })) {
        return null;
      }
      AP.store.s.news.unshift(n);
      if (AP.store.s.news.length > 400) AP.store.s.news.length = 400;
      AP.store.save();
      return n;
    },

    remove(id) {
      AP.store.s.news = AP.store.s.news.filter(function (n) { return n.id !== id; });
      AP.store.save();
    },

    impactText(item) {
      const table = IMPACT[AP.i18n.lang] || IMPACT.ar;
      if (item.manual && item.summary && item.summary !== table[item.impactKey]) return item.summary;
      return table[item.impactKey] || table.neutral;
    },

    /* Recency-weighted sentiment for the signal engine (-1..1). */
    sentimentFor(sym) {
      const today = U.today();
      const items = AP.store.s.news.filter(function (n) {
        return (n.symbol === sym || n.symbol === 'MARKET') && U.daysBetween(n.date, today) <= 14;
      });
      if (!items.length) return { score: 0, count: 0 };
      let num = 0, den = 0;
      items.forEach(function (n) {
        const age = Math.max(0, U.daysBetween(n.date, today));
        const w = (n.symbol === sym ? 1 : 0.4) * Math.exp(-age / 7);
        num += U.num(n.score) * w;
        den += w;
      });
      return { score: den ? U.clamp(num / den, -1, 1) : 0, count: items.length };
    },

    /* Best-effort fetch of headlines; silently degrades when blocked. */
    fetchFor(symbols) {
      const proxy = (AP.store.settings().proxyUrl || '').trim();
      if (!proxy) return Promise.resolve({ fetched: 0, blocked: true });
      const list = (symbols || AP.store.symbols()).slice(0, 12);
      let fetched = 0;
      const jobs = list.map(function (sym) {
        const url = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=' + encodeURIComponent(sym) + '&region=US&lang=en-US';
        const full = proxy.indexOf('{url}') >= 0 ? proxy.replace('{url}', encodeURIComponent(url)) : proxy + encodeURIComponent(url);
        return fetch(full, { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.text() : Promise.reject(new Error('http ' + r.status)); })
          .then(function (xml) {
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const items = Array.prototype.slice.call(doc.querySelectorAll('item')).slice(0, 5);
            items.forEach(function (it) {
              const title = (it.querySelector('title') || {}).textContent || '';
              const pub = (it.querySelector('pubDate') || {}).textContent || '';
              const link = (it.querySelector('link') || {}).textContent || '';
              if (!title) return;
              const date = pub ? U.dateKey(new Date(pub)) : U.today();
              const added = News.add({
                symbol: sym, title: title, date: date, source: 'Yahoo Finance',
                url: link, manual: false, summary: ''
              });
              if (added) fetched++;
            });
          })
          .catch(function () { /* blocked or offline — stay silent */ });
      });
      return Promise.all(jobs).then(function () { return { fetched: fetched, blocked: false }; });
    },

    classify: classify
  };

  AP.news = News;
})(window);
