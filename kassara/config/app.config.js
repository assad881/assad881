/* ============================================================
   إعدادات المنصة — كل ما يمكن تغييره دون لمس منطق التطبيق
   Platform configuration. No business data is hardcoded here;
   materials / prices / zones live in the database layer.
   ============================================================ */
window.KX = window.KX || {};

KX.config = {
  /* الهوية — الاسم مؤقت وقابل للتغيير من هنا فقط */
  brand: {
    name:      'كسّارة إكسبرس',
    nameEn:    'Kassara Express',
    tagline:   'مواد الكسارات إلى موقعك — طلب واحد، توريد ونقل منظّم',
    launchArea:'ولاية عبري ومحافظة الظاهرة',
    supportPhone: '+968 9000 0000',
    supportEmail: 'support@kassara-express.om'
  },

  /* العملة: الريال العُماني بثلاث منازل عشرية */
  currency: { code: 'OMR', symbol: 'ر.ع.', decimals: 3, locale: 'ar-OM' },

  /* اللغة */
  i18n: { default: 'ar', dir: 'rtl', available: ['ar', 'en'] },

  /* طبقة البيانات: local = تجريبي داخل المتصفح | supabase = قاعدة PostgreSQL حقيقية */
  data: {
    driver: 'local',
    supabase: { url: '', anonKey: '' }   // تُملأ عند الانتقال للإنتاج
  },

  /* طبقة الدفع — مجرّدة حتى يمكن ربط مزوّد عُماني مرخّص لاحقًا */
  payments: {
    provider: 'demo',                    // demo | thawani | omannet | ...
    methods: ['card', 'bank_transfer', 'deposit', 'credit_terms'],
    codEnabled: false,                   // لا يوجد دفع عند الاستلام إطلاقًا
    depositPercent: 30,                  // نسبة العربون الافتراضية
    transferVerificationRequired: true
  },

  /* قيم مالية افتراضية — قابلة للتعديل من لوحة الإدارة (settings) */
  finance: {
    vatEnabled: true,
    vatRate: 0.05,                       // ضريبة القيمة المضافة في عُمان 5%
    platformFeeFixed: 1.500,             // رسوم ثابتة لكل طلب
    platformFeePercent: 0.02,            // نسبة من قيمة المواد + النقل
    supplierCommissionPercent: 0.05,     // عمولة المنصة من المورد
    transporterCommissionPercent: 0.07,  // عمولة المنصة من الناقل
    waitingFreeMinutes: 60,              // فترة انتظار مجانية لكل رحلة
    waitingRatePerHour: 3.000
  },

  /* سياسة الإلغاء والاسترداد حسب مرحلة الطلب (نسبة الاسترداد) */
  refundPolicy: [
    { upToStatus: 'paid',       refundPercent: 1.00, note: 'إلغاء قبل التجهيز — استرداد كامل' },
    { upToStatus: 'preparing',  refundPercent: 0.90, note: 'خصم 10% رسوم تجهيز' },
    { upToStatus: 'loading',    refundPercent: 0.60, note: 'بدأ التحميل — خصم تكلفة التشغيل' },
    { upToStatus: 'in_transit', refundPercent: 0.25, note: 'الشاحنة في الطريق — استرداد جزئي بعد المراجعة' },
    { upToStatus: 'delivered',  refundPercent: 0.00, note: 'تم التسليم — يُدرس عبر الشكاوى فقط' }
  ],

  /* خصائص قابلة للتفعيل والإيقاف */
  features: {
    liveTracking: true,
    coupons: true,
    creditTerms: true,
    reviews: true,
    complaints: true,
    pwa: true
  },

  /* بيئة العرض */
  demo: {
    enabled: true,
    otpCode: '1234',
    banner: 'نسخة تجريبية — جميع البيانات والأسعار والموردين والشاحنات غير حقيقية وللاختبار فقط.'
  },

  version: '1.0.0-mvp'
};
