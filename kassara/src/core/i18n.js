/* الترجمة — العربية هي الأساس، والإنجليزية جاهزة للتوسّع */
window.KX = window.KX || {};
KX.i18n = (function () {
  const dict = {
    ar: {
      app_name: 'كسّارة إكسبرس',
      nav_home: 'الرئيسية', nav_how: 'كيف تعمل الخدمة؟', nav_suppliers: 'الموردون',
      nav_faq: 'الأسئلة الشائعة', nav_terms: 'الشروط والأحكام', nav_privacy: 'سياسة الخصوصية',
      nav_refund: 'سياسة الإلغاء والاسترداد', nav_contact: 'تواصل معنا',
      login: 'تسجيل الدخول', logout: 'تسجيل الخروج',
      dashboard: 'لوحة المتابعة', orders: 'الطلبات', new_order: 'طلب جديد',
      invoices: 'الفواتير', profile: 'الملف الشخصي', sites: 'مواقع المشاريع',
      materials: 'المواد', prices: 'الأسعار', zones: 'مناطق التوصيل',
      payments: 'المدفوعات', refunds: 'الاستردادات', settlements: 'التسويات',
      reports: 'التقارير', notifications: 'الإشعارات', audit: 'سجل التدقيق',
      settings: 'الإعدادات', users: 'المستخدمون', save: 'حفظ', cancel: 'إلغاء',
      total: 'الإجمالي', qty: 'الكمية', ton: 'طن', trip: 'رحلة'
    },
    en: {
      app_name: 'Kassara Express',
      nav_home: 'Home', nav_how: 'How it works', nav_suppliers: 'Suppliers',
      nav_faq: 'FAQ', nav_terms: 'Terms', nav_privacy: 'Privacy',
      nav_refund: 'Cancellation & Refund', nav_contact: 'Contact',
      login: 'Sign in', logout: 'Sign out',
      dashboard: 'Dashboard', orders: 'Orders', new_order: 'New order',
      invoices: 'Invoices', profile: 'Profile', sites: 'Project sites',
      materials: 'Materials', prices: 'Prices', zones: 'Delivery zones',
      payments: 'Payments', refunds: 'Refunds', settlements: 'Settlements',
      reports: 'Reports', notifications: 'Notifications', audit: 'Audit log',
      settings: 'Settings', users: 'Users', save: 'Save', cancel: 'Cancel',
      total: 'Total', qty: 'Quantity', ton: 'ton', trip: 'trip'
    }
  };
  let lang = localStorage.getItem('kx:lang') || KX.config.i18n.default;

  function t(key, params) {
    let s = (dict[lang] && dict[lang][key]) || (dict.ar[key]) || key;
    if (params) Object.keys(params).forEach((k) => { s = s.replace('{' + k + '}', params[k]); });
    return s;
  }
  function setLang(l) {
    lang = l; localStorage.setItem('kx:lang', l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  }
  const getLang = () => lang;
  return { t, setLang, getLang, dict };
})();
