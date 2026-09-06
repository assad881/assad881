/* ============================================================
   الترجمة — خمس لغات معتمدة من جدول «ترجمة الواجهة»
   المصدر: قائمة أسعار مواد الكسارة — Multilingual Price Master
   قاعدة الملف: لا ترجمة آلية وقت التشغيل؛ المفاتيح فقط.
   سلسلة الرجوع: اللغة المختارة ← الإنجليزية ← العربية ← المفتاح.
   ============================================================ */
window.KX = window.KX || {};
KX.i18n = (function () {
  /* بيانات كل لغة من ورقة «إعداد اللغات» */
  const LANGS = {
    ar: { name: 'العربية', native: 'العربية', dir: 'rtl', locale: 'ar-OM',
          font: "'Tajawal', 'Noto Sans Arabic', system-ui, sans-serif" },
    en: { name: 'English', native: 'English', dir: 'ltr', locale: 'en',
          font: "'Inter', 'Noto Sans', system-ui, sans-serif" },
    ur: { name: 'الأردية', native: 'اردو', dir: 'rtl', locale: 'ur',
          font: "'Noto Nastaliq Urdu', 'Noto Sans Arabic', serif", lineHeight: 2.1 },
    hi: { name: 'الهندية', native: 'हिन्दी', dir: 'ltr', locale: 'hi',
          font: "'Noto Sans Devanagari', 'Noto Sans', system-ui, sans-serif" },
    bn: { name: 'البنغالية', native: 'বাংলা', dir: 'ltr', locale: 'bn',
          font: "'Noto Sans Bengali', 'Noto Sans', system-ui, sans-serif" }
  };

  const dict = {
    ar: {
      app_name: 'مواد الكسارة',
      home: 'الرئيسية',
      materials: 'المواد',
      select_material: 'اختر المادة',
      quantity: 'الكمية',
      cubic_meter: 'متر مكعب',
      truck: 'شاحنة',
      delivery_location: 'موقع التوصيل',
      delivery_date: 'تاريخ التوصيل',
      material_price: 'سعر المادة',
      transport_cost: 'تكلفة النقل',
      platform_fee: 'رسوم المنصة',
      vat: 'ضريبة القيمة المضافة',
      discount: 'الخصم',
      total: 'الإجمالي',
      review_order: 'مراجعة الطلب',
      submit_order: 'إرسال الطلب',
      awaiting_approval: 'بانتظار الموافقة',
      payment: 'الدفع',
      pay_now: 'ادفع الآن',
      bank_transfer: 'تحويل بنكي',
      no_cash_on_delivery: 'لا يوجد دفع عند الاستلام',
      order_number: 'رقم الطلب',
      preparing: 'قيد التجهيز',
      loading: 'قيد التحميل',
      on_the_way: 'في الطريق',
      delivered: 'تم التسليم',
      cancelled: 'ملغي',
      invoice: 'الفاتورة',
      track_order: 'تتبع الطلب',
      contact_support: 'تواصل مع الدعم',
      language: 'اللغة',
      change_language: 'تغيير اللغة',
      login: 'تسجيل الدخول',
      phone_number: 'رقم الهاتف',
      continue: 'متابعة',
      price_excludes_transport: 'السعر لا يشمل النقل',
      minimum_order: 'الحد الأدنى للتوصيل 18 م³',
      how_it_works: 'كيف تعمل الخدمة؟',
      suppliers: 'الموردون',
      faq: 'الأسئلة الشائعة',
      terms: 'الشروط والأحكام',
      privacy: 'سياسة الخصوصية',
      refund_policy: 'سياسة الإلغاء والاسترداد',
      contact: 'تواصل معنا',
      dashboard: 'لوحة المتابعة',
      orders: 'الطلبات',
      new_order: 'طلب جديد',
      sites: 'مواقع المشاريع',
      profile: 'الملف الشخصي',
      notifications: 'الإشعارات',
      logout: 'تسجيل الخروج',
      save: 'حفظ',
      cancel: 'إلغاء',
      trips: 'الرحلات',
      supplier: 'المورد',
      zone: 'المنطقة',
      notes: 'ملاحظات',
      special_price: 'سعر خاص',
      trucks_needed: 'عدد الشاحنات المطلوبة',
      price_per_unit: 'سعر الوحدة'
    },
    en: {
      app_name: 'Quarry Materials',
      home: 'Home',
      materials: 'Materials',
      select_material: 'Select material',
      quantity: 'Quantity',
      cubic_meter: 'Cubic metre',
      truck: 'Truck',
      delivery_location: 'Delivery location',
      delivery_date: 'Delivery date',
      material_price: 'Material price',
      transport_cost: 'Transport cost',
      platform_fee: 'Platform fee',
      vat: 'VAT',
      discount: 'Discount',
      total: 'Total',
      review_order: 'Review order',
      submit_order: 'Submit order',
      awaiting_approval: 'Awaiting approval',
      payment: 'Payment',
      pay_now: 'Pay now',
      bank_transfer: 'Bank transfer',
      no_cash_on_delivery: 'Cash on delivery is not available',
      order_number: 'Order number',
      preparing: 'Preparing',
      loading: 'Loading',
      on_the_way: 'On the way',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      invoice: 'Invoice',
      track_order: 'Track order',
      contact_support: 'Contact support',
      language: 'Language',
      change_language: 'Change language',
      login: 'Log in',
      phone_number: 'Phone number',
      continue: 'Continue',
      price_excludes_transport: 'Price excludes transport',
      minimum_order: 'Minimum delivery is 18 m³',
      how_it_works: 'How it works',
      suppliers: 'Suppliers',
      faq: 'FAQ',
      terms: 'Terms',
      privacy: 'Privacy policy',
      refund_policy: 'Cancellation & refund policy',
      contact: 'Contact us',
      dashboard: 'Dashboard',
      orders: 'Orders',
      new_order: 'New order',
      sites: 'Project sites',
      profile: 'Profile',
      notifications: 'Notifications',
      logout: 'Log out',
      save: 'Save',
      cancel: 'Cancel',
      trips: 'Trips',
      supplier: 'Supplier',
      zone: 'Zone',
      notes: 'Notes',
      special_price: 'Special price',
      trucks_needed: 'Trucks required',
      price_per_unit: 'Unit price'
    },
    ur: {
      app_name: 'کرشر مواد',
      home: 'ہوم',
      materials: 'مواد',
      select_material: 'مواد منتخب کریں',
      quantity: 'مقدار',
      cubic_meter: 'مکعب میٹر',
      truck: 'ٹرک',
      delivery_location: 'ڈیلیوری کا مقام',
      delivery_date: 'ڈیلیوری کی تاریخ',
      material_price: 'مواد کی قیمت',
      transport_cost: 'نقل کی لاگت',
      platform_fee: 'پلیٹ فارم فیس',
      vat: 'ویلیو ایڈڈ ٹیکس',
      discount: 'رعایت',
      total: 'کل',
      review_order: 'آرڈر کا جائزہ',
      submit_order: 'آرڈر بھیجیں',
      awaiting_approval: 'منظوری کا انتظار',
      payment: 'ادائیگی',
      pay_now: 'ابھی ادائیگی کریں',
      bank_transfer: 'بینک ٹرانسفر',
      no_cash_on_delivery: 'ڈیلیوری پر نقد ادائیگی دستیاب نہیں ہے',
      order_number: 'آرڈر نمبر',
      preparing: 'تیاری جاری ہے',
      loading: 'لوڈنگ جاری ہے',
      on_the_way: 'راستے میں',
      delivered: 'ڈیلیور ہو گیا',
      cancelled: 'منسوخ',
      invoice: 'انوائس',
      track_order: 'آرڈر ٹریک کریں',
      contact_support: 'سپورٹ سے رابطہ کریں',
      language: 'زبان',
      change_language: 'زبان تبدیل کریں',
      login: 'لاگ اِن',
      phone_number: 'فون نمبر',
      continue: 'جاری رکھیں',
      price_excludes_transport: 'قیمت میں نقل شامل نہیں',
      minimum_order: 'کم از کم ڈیلیوری 18 مکعب میٹر ہے'
    },
    hi: {
      app_name: 'क्रशर सामग्री',
      home: 'होम',
      materials: 'सामग्री',
      select_material: 'सामग्री चुनें',
      quantity: 'मात्रा',
      cubic_meter: 'घन मीटर',
      truck: 'ट्रक',
      delivery_location: 'डिलीवरी स्थान',
      delivery_date: 'डिलीवरी की तारीख',
      material_price: 'सामग्री की कीमत',
      transport_cost: 'परिवहन लागत',
      platform_fee: 'प्लेटफ़ॉर्म शुल्क',
      vat: 'मूल्य वर्धित कर',
      discount: 'छूट',
      total: 'कुल',
      review_order: 'ऑर्डर की समीक्षा करें',
      submit_order: 'ऑर्डर भेजें',
      awaiting_approval: 'स्वीकृति की प्रतीक्षा',
      payment: 'भुगतान',
      pay_now: 'अभी भुगतान करें',
      bank_transfer: 'बैंक ट्रांसफर',
      no_cash_on_delivery: 'डिलीवरी पर नकद भुगतान उपलब्ध नहीं है',
      order_number: 'ऑर्डर नंबर',
      preparing: 'तैयारी में',
      loading: 'लोड हो रहा है',
      on_the_way: 'रास्ते में',
      delivered: 'डिलीवर हो गया',
      cancelled: 'रद्द',
      invoice: 'चालान',
      track_order: 'ऑर्डर ट्रैक करें',
      contact_support: 'सहायता से संपर्क करें',
      language: 'भाषा',
      change_language: 'भाषा बदलें',
      login: 'लॉग इन',
      phone_number: 'फ़ोन नंबर',
      continue: 'जारी रखें',
      price_excludes_transport: 'कीमत में परिवहन शामिल नहीं है',
      minimum_order: 'न्यूनतम डिलीवरी 18 घन मीटर है'
    },
    bn: {
      app_name: 'ক্রাশার উপকরণ',
      home: 'হোম',
      materials: 'উপকরণ',
      select_material: 'উপকরণ নির্বাচন করুন',
      quantity: 'পরিমাণ',
      cubic_meter: 'ঘনমিটার',
      truck: 'ট্রাক',
      delivery_location: 'ডেলিভারির স্থান',
      delivery_date: 'ডেলিভারির তারিখ',
      material_price: 'উপকরণের মূল্য',
      transport_cost: 'পরিবহন খরচ',
      platform_fee: 'প্ল্যাটফর্ম ফি',
      vat: 'মূল্য সংযোজন কর',
      discount: 'ছাড়',
      total: 'মোট',
      review_order: 'অর্ডার পর্যালোচনা করুন',
      submit_order: 'অর্ডার পাঠান',
      awaiting_approval: 'অনুমোদনের অপেক্ষায়',
      payment: 'পেমেন্ট',
      pay_now: 'এখনই পেমেন্ট করুন',
      bank_transfer: 'ব্যাংক ট্রান্সফার',
      no_cash_on_delivery: 'ক্যাশ অন ডেলিভারি উপলভ্য নয়',
      order_number: 'অর্ডার নম্বর',
      preparing: 'প্রস্তুত হচ্ছে',
      loading: 'লোড হচ্ছে',
      on_the_way: 'পথে আছে',
      delivered: 'ডেলিভারি সম্পন্ন',
      cancelled: 'বাতিল',
      invoice: 'ইনভয়েস',
      track_order: 'অর্ডার ট্র্যাক করুন',
      contact_support: 'সহায়তার সাথে যোগাযোগ করুন',
      language: 'ভাষা',
      change_language: 'ভাষা পরিবর্তন করুন',
      login: 'লগ ইন',
      phone_number: 'ফোন নম্বর',
      continue: 'চালিয়ে যান',
      price_excludes_transport: 'মূল্যের মধ্যে পরিবহন অন্তর্ভুক্ত নয়',
      minimum_order: 'ন্যূনতম ডেলিভারি ১৮ ঘনমিটার'
    }
  };

  let lang = localStorage.getItem('kx:lang') || KX.config.i18n.default;
  if (!LANGS[lang]) lang = 'ar';

  /* ترجمة مفتاح — بلا ترجمة آلية، ورجوع صريح */
  function t(key, params) {
    let s = (dict[lang] && dict[lang][key]);
    if (s === undefined) s = dict.en && dict.en[key];
    if (s === undefined) s = dict.ar && dict.ar[key];
    if (s === undefined) s = key;
    if (params) Object.keys(params).forEach((k) => { s = s.replace('{' + k + '}', params[k]); });
    return s;
  }

  /* اختيار نص من كائن متعدد اللغات مخزّن في قاعدة البيانات
     (أسماء المواد مثلًا) — بنفس سلسلة الرجوع */
  function pick(obj, fallback) {
    if (!obj) return fallback || '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj.en || obj.ar || fallback || '';
  }

  function apply() {
    const L = LANGS[lang];
    const el = document.documentElement;
    el.lang = lang;
    el.dir = L.dir;
    el.style.setProperty('--font', L.font);
    el.style.setProperty('--line-height', L.lineHeight || 1.65);
    el.setAttribute('data-lang', lang);
  }
  function setLang(l) {
    if (!LANGS[l]) return;
    lang = l;
    try { localStorage.setItem('kx:lang', l); } catch (e) {}
    apply();
    KX.store.emit('change:lang', l);
  }
  const getLang = () => lang;
  const dir = () => LANGS[lang].dir;
  const locale = () => LANGS[lang].locale;
  const meta = (l) => LANGS[l || lang];
  const available = () => Object.keys(LANGS);
  /* هل للمفتاح ترجمة معتمدة في هذه اللغة؟ (لكشف النواقص قبل الإطلاق) */
  const has = (key, l) => !!(dict[l || lang] && dict[l || lang][key]);
  function missing(l) {
    const base = Object.keys(dict.ar);
    return base.filter((k) => !dict[l] || dict[l][k] === undefined);
  }

  return { t, pick, setLang, getLang, dir, locale, meta, available, apply, has, missing, LANGS, dict };
})();
