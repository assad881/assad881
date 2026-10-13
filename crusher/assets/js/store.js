/* كسارة اكسبريس — الحالة والتخزين المحلي */
(function (root) {
  'use strict';
  const EX = (root.EX = root.EX || {});
  const U = EX.util;

  const KEY = 'express_crusher_v1';

  const DEFAULT_MATERIALS = [
    { name: 'بحص 3/4', nameEn: 'Aggregate 3/4"', unit: 'ton', price: 2.5 },
    { name: 'بحص 3/8', nameEn: 'Aggregate 3/8"', unit: 'ton', price: 2.8 },
    { name: 'صبة (خرسانة ناشفة)', nameEn: 'Crusher run', unit: 'ton', price: 2.0 },
    { name: 'بيس كورس', nameEn: 'Base course', unit: 'ton', price: 2.2 },
    { name: 'سب بيس', nameEn: 'Sub-base', unit: 'ton', price: 1.8 },
    { name: 'رمل مغسول', nameEn: 'Washed sand', unit: 'ton', price: 3.0 },
    { name: 'غبار كسارة', nameEn: 'Crusher dust', unit: 'ton', price: 1.5 },
    { name: 'دفان', nameEn: 'Backfill', unit: 'load', price: 15.0 },
    { name: 'بلوك حجري', nameEn: 'Rock boulders', unit: 'ton', price: 2.0 }
  ];

  const EXPENSE_CATEGORIES = ['diesel', 'maintenance', 'parts', 'salaries', 'rent', 'explosives', 'electric', 'other'];

  function defaultState() {
    return {
      version: 1,
      createdAt: Date.now(),
      settings: {
        lang: 'ar',
        theme: 'dark',
        company: {
          name: 'كسارة اكسبريس',
          nameEn: 'Express Crusher',
          phone: '',
          address: '',
          crNo: '',
          vatNo: ''
        },
        vatEnabled: false,
        vatRate: 5,
        decimals: 3,
        loadSeq: 1,
        docSeq: 1
      },
      materials: DEFAULT_MATERIALS.map(function (m) {
        return Object.assign({ id: U.uid('mat'), active: true }, m);
      }),
      customers: [],
      trucks: [],
      loads: [],
      payments: [],
      expenses: []
    };
  }

  const Store = {
    s: null,
    listeners: [],

    load() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          Store.s = Store.migrate(parsed);
        } catch (e) {
          console.warn('state unreadable, starting fresh', e);
          Store.s = defaultState();
        }
      } else {
        Store.s = defaultState();
      }
      return Store.s;
    },

    /* نضمن وجود كل الحقول حتى لو جاءت النسخة من إصدار أقدم */
    migrate(st) {
      const base = defaultState();
      const out = Object.assign({}, base, st || {});
      out.settings = Object.assign({}, base.settings, st && st.settings);
      out.settings.company = Object.assign({}, base.settings.company, st && st.settings && st.settings.company);
      ['materials', 'customers', 'trucks', 'loads', 'payments', 'expenses'].forEach(function (k) {
        if (!Array.isArray(out[k])) out[k] = base[k];
      });
      if (!out.materials.length) out.materials = base.materials;
      return out;
    },

    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(Store.s));
      } catch (e) {
        console.warn('save failed', e);
        if (EX.ui) EX.ui.toast('تعذّر الحفظ — مساحة التخزين ممتلئة؟', 'bad');
      }
      Store.listeners.forEach(function (fn) { try { fn(); } catch (e) { /* listener owns its errors */ } });
      return Store.s;
    },

    onChange(fn) { Store.listeners.push(fn); },
    settings() { return Store.s.settings; },

    /* ---------- أدوات بحث ---------- */
    customer(id) { return Store.s.customers.filter(function (c) { return c.id === id; })[0] || null; },
    material(id) { return Store.s.materials.filter(function (m) { return m.id === id; })[0] || null; },
    truck(id) { return Store.s.trucks.filter(function (t) { return t.id === id; })[0] || null; },

    customerName(id) {
      const c = Store.customer(id);
      return c ? c.name : '—';
    },
    materialName(id) {
      const m = Store.material(id);
      if (!m) return '—';
      return EX.i18n.lang === 'en' ? (m.nameEn || m.name) : m.name;
    },
    truckLabel(id) {
      const t = Store.truck(id);
      if (!t) return '—';
      return t.plate + (t.driver ? ' · ' + t.driver : '');
    },

    /* السعر المعتمد لعميل ومادة: سعر خاص إن وُجد، وإلا سعر القائمة */
    priceFor(customerId, materialId) {
      const c = Store.customer(customerId);
      const m = Store.material(materialId);
      if (c && c.priceOverrides && c.priceOverrides[materialId] !== undefined && c.priceOverrides[materialId] !== '') {
        return U.num(c.priceOverrides[materialId]);
      }
      return m ? U.num(m.price) : 0;
    },

    /* ---------- النقلات ---------- */
    nextLoadNo() {
      const n = U.num(Store.s.settings.loadSeq, 1);
      Store.s.settings.loadSeq = n + 1;
      return n;
    },
    nextDocNo() {
      const n = U.num(Store.s.settings.docSeq, 1);
      Store.s.settings.docSeq = n + 1;
      return n;
    },

    addLoad(data) {
      const rec = Object.assign({
        id: U.uid('ld'),
        no: Store.nextLoadNo(),
        createdAt: Date.now()
      }, data);
      rec.total = EX.calc.loadTotal(rec);
      Store.s.loads.push(rec);
      Store.save();
      return rec;
    },
    updateLoad(id, data) {
      const rec = Store.s.loads.filter(function (l) { return l.id === id; })[0];
      if (!rec) return null;
      Object.assign(rec, data);
      rec.total = EX.calc.loadTotal(rec);
      Store.save();
      return rec;
    },
    removeLoad(id) {
      Store.s.loads = Store.s.loads.filter(function (l) { return l.id !== id; });
      Store.save();
    },

    /* ---------- سجلات عامة ---------- */
    upsert(collection, data, prefix) {
      const arr = Store.s[collection];
      if (data.id) {
        const rec = arr.filter(function (x) { return x.id === data.id; })[0];
        if (rec) { Object.assign(rec, data); Store.save(); return rec; }
      }
      const rec = Object.assign({ id: U.uid(prefix || collection.slice(0, 3)), createdAt: Date.now() }, data);
      arr.push(rec);
      Store.save();
      return rec;
    },
    remove(collection, id) {
      Store.s[collection] = Store.s[collection].filter(function (x) { return x.id !== id; });
      Store.save();
    },

    /* ---------- النسخ الاحتياطي ---------- */
    exportJSON() { return JSON.stringify(Store.s, null, 2); },
    importJSON(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !parsed.settings) throw new Error('bad backup');
      Store.s = Store.migrate(parsed);
      Store.save();
      return Store.s;
    },
    reset() {
      const lang = Store.s.settings.lang, theme = Store.s.settings.theme;
      const company = U.deepClone(Store.s.settings.company);
      Store.s = defaultState();
      Store.s.settings.lang = lang;
      Store.s.settings.theme = theme;
      Store.s.settings.company = company;
      Store.save();
    },

    /* بيانات تجريبية لتجربة التطبيق فورًا */
    loadSample() {
      const st = Store.s;
      const today = U.today();
      const custs = [
        { name: 'مؤسسة الظاهرة للمقاولات', phone: '99112233', area: 'عبري', type: 'credit' },
        { name: 'شركة البركة للإنشاءات', phone: '97445566', area: 'ينقل', type: 'credit' },
        { name: 'سالم بن محمد العبري', phone: '92778899', area: 'عبري', type: 'cash' },
        { name: 'مشروع طريق ضنك', phone: '95001122', area: 'ضنك', type: 'credit' },
        { name: 'بلدية عبري', phone: '25690000', area: 'عبري', type: 'credit', slow: true }
      ].map(function (c) {
        return Store.upsert('customers', Object.assign({ openingBalance: 0, priceOverrides: {}, notes: '', active: true }, c), 'cus');
      });
      const trucks = [
        { plate: '1 ظ 4521', driver: 'خالد', phone: '91234567', capacity: 30 },
        { plate: '2 ظ 7788', driver: 'يوسف', phone: '91234568', capacity: 30 },
        { plate: '3 ظ 1199', driver: 'عبدالله', phone: '91234569', capacity: 25 }
      ].map(function (t) {
        return Store.upsert('trucks', Object.assign({ active: true, notes: '' }, t), 'trk');
      });

      // نقلات موزّعة على آخر 45 يومًا بنمط عمل واقعي
      let seed = 7;
      const rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let d = 44; d >= 0; d--) {
        const date = U.addDays(today, -d);
        const dow = new Date(date + 'T00:00:00').getDay();
        if (dow === 5) continue;                      // الجمعة إجازة
        const n = 3 + Math.floor(rnd() * 6);
        for (let i = 0; i < n; i++) {
          const cust = custs[Math.floor(rnd() * custs.length)];
          const mat = st.materials[Math.floor(rnd() * Math.min(7, st.materials.length))];
          const trk = trucks[Math.floor(rnd() * trucks.length)];
          const qty = mat.unit === 'load' ? 1 : U.round(22 + rnd() * 10, 1);
          Store.addLoad({
            date: date,
            customerId: cust.id,
            materialId: mat.id,
            truckId: trk.id,
            qty: qty,
            unit: mat.unit,
            price: Store.priceFor(cust.id, mat.id),
            discount: 0,
            payment: cust.type === 'cash' ? 'cash' : (rnd() < 0.25 ? 'cash' : 'credit'),
            site: '',
            notes: ''
          });
        }
        if (rnd() < 0.5) {
          const cats = ['diesel', 'maintenance', 'parts', 'salaries', 'electric'];
          Store.upsert('expenses', {
            date: date,
            category: cats[Math.floor(rnd() * cats.length)],
            amount: U.round(80 + rnd() * 500, 3),
            truckId: rnd() < 0.4 ? trucks[Math.floor(rnd() * trucks.length)].id : '',
            notes: ''
          }, 'exp');
        }
      }

      // دفعات واقعية: يسدّد كل عميل جزءًا من آجله على دفعتين أو ثلاث،
      // فيبقى رصيد مستحق موجب بدل أرصدة سالبة عشوائية
      custs.forEach(function (cust) {
        const due = U.sum(st.loads.filter(function (l) {
          return l.customerId === cust.id && l.payment === 'credit';
        }), function (l) { return l.total; });
        if (due <= 0) return;
        // عميل بطيء السداد يترك ذممًا متقادمة تُظهر جدول أعمار الذمم على حقيقته
        const share = cust.slow ? 0 : cust.type === 'cash' ? 0.9 : 0.45 + rnd() * 0.4;
        if (share === 0) return;
        let left = U.round(due * share, 3);
        const installments = 1 + Math.floor(rnd() * 3);
        for (let k = 0; k < installments && left > 1; k++) {
          const amount = k === installments - 1 ? left : U.round(left / (installments - k), 3);
          left = U.round(left - amount, 3);
          Store.upsert('payments', {
            date: U.addDays(today, -Math.floor(rnd() * 40)),
            customerId: cust.id,
            amount: amount,
            method: rnd() < 0.5 ? 'bank' : 'cash',
            ref: '',
            notes: ''
          }, 'pay');
        }
      });

      Store.save();
    },

    EXPENSE_CATEGORIES: EXPENSE_CATEGORIES
  };

  EX.store = Store;
})(window);
