/* الهيكل العام: الرأس، القائمة الجانبية، التذييل */
window.KX = window.KX || {};
KX.layout = (function () {
  const U = () => KX.util;
  const e = (s) => KX.util.esc(s);
  const root = () => document.getElementById('app');

  const PUBLIC_NAV = [
    { path: '/',           label: 'الرئيسية' },
    { path: '/how',        label: 'كيف تعمل الخدمة؟' },
    { path: '/suppliers',  label: 'الموردون' },
    { path: '/faq',        label: 'الأسئلة الشائعة' },
    { path: '/contact',    label: 'تواصل معنا' }
  ];

  const SIDEBARS = {
    /* شاشات العميل وحدها تتبع لغة المستخدم — لوحات التشغيل والإدارة بالعربية */
    customer: [
      { group: 'طلباتي', key: 'orders' },
      { path: '/customer',            key: 'dashboard',     icon: '📊' },
      { path: '/customer/new',        key: 'new_order',     icon: '➕' },
      { path: '/customer/orders',     key: 'orders',        icon: '📦' },
      { path: '/customer/invoices',   key: 'invoice',       icon: '🧾' },
      { group: 'حسابي', key: 'profile' },
      { path: '/customer/sites',      key: 'sites',         icon: '📍' },
      { path: '/customer/profile',    key: 'profile',       icon: '👤' },
      { path: '/customer/complaints', key: 'contact_support', icon: '💬' },
      { path: '/notifications',       key: 'notifications', icon: '🔔' }
    ],
    supplier: [
      { group: 'التشغيل' },
      { path: '/supplier',          label: 'لوحة المتابعة', icon: '📊' },
      { path: '/supplier/orders',   label: 'طلبات التوريد', icon: '📦' },
      { path: '/supplier/loading',  label: 'أوامر التحميل', icon: '🏗️' },
      { group: 'الكسارة' },
      { path: '/supplier/materials', label: 'موادي وأسعاري', icon: '🪨' },
      { path: '/supplier/settlements', label: 'المستحقات',   icon: '💰' },
      { path: '/supplier/reports',  label: 'التقارير',      icon: '📈' },
      { path: '/notifications',     label: 'الإشعارات',     icon: '🔔' }
    ],
    transporter: [
      { group: 'التشغيل' },
      { path: '/transporter',        label: 'لوحة المتابعة', icon: '📊' },
      { path: '/transporter/orders', label: 'مهام النقل',    icon: '🚚' },
      { path: '/transporter/trips',  label: 'الرحلات',       icon: '🛣️' },
      { group: 'الأسطول' },
      { path: '/transporter/fleet',  label: 'الشاحنات والسائقون', icon: '🚛' },
      { path: '/transporter/rates',  label: 'أسعاري ومناطقي', icon: '🏷️' },
      { path: '/transporter/settlements', label: 'المستحقات', icon: '💰' },
      { path: '/notifications',      label: 'الإشعارات',     icon: '🔔' }
    ],
    driver: [
      { path: '/driver',         label: 'مهامي اليوم', icon: '🚚' },
      { path: '/driver/history', label: 'رحلاتي السابقة', icon: '🕘' },
      { path: '/notifications',  label: 'الإشعارات', icon: '🔔' }
    ],
    admin: [
      { group: 'المتابعة' },
      { path: '/admin',              label: 'لوحة المؤشرات', icon: '📊' },
      { path: '/admin/orders',       label: 'إدارة الطلبات', icon: '📦' },
      { path: '/admin/payments',     label: 'المدفوعات والاستردادات', icon: '💳' },
      { path: '/admin/settlements',  label: 'العمولات والتسويات', icon: '💰' },
      { group: 'المستخدمون' },
      { path: '/admin/customers',    label: 'العملاء',        icon: '👥' },
      { path: '/admin/suppliers',    label: 'الموردون',       icon: '🏭' },
      { path: '/admin/transporters', label: 'الناقلون والأسطول', icon: '🚚' },
      { group: 'الإعداد' },
      { path: '/admin/materials',    label: 'المواد والأسعار', icon: '🪨' },
      { path: '/admin/zones',        label: 'المناطق وأسعار النقل', icon: '🗺️' },
      { path: '/admin/coupons',      label: 'العروض والكوبونات', icon: '🎟️' },
      { path: '/admin/settings',     label: 'الإعدادات المالية', icon: '⚙️' },
      { group: 'الرقابة' },
      { path: '/admin/reports',      label: 'التقارير',       icon: '📈' },
      { path: '/admin/complaints',   label: 'الشكاوى',        icon: '⚠️' },
      { path: '/admin/notifications', label: 'إرسال إشعارات', icon: '🔔' },
      { path: '/admin/audit',        label: 'سجل التدقيق',    icon: '🛡️' }
    ]
  };
  SIDEBARS.ops = SIDEBARS.admin;

  function appbar() {
    const s = KX.auth.session();
    const cur = KX.router.current();
    const nav = PUBLIC_NAV.map((n) =>
      '<a href="#' + n.path + '" class="' + (cur === n.path ? 'is-active' : '') + '">' + e(n.label) + '</a>').join('');
    const right = s
      ? '<a href="#' + KX.auth.homeFor(s.role) + '" class="' + (cur.indexOf(KX.auth.homeFor(s.role)) === 0 ? 'is-active' : '') + '">' +
        '👤 ' + e(s.name) + '</a><a href="#/logout">خروج</a>'
      : '<a href="#/login" class="btn btn--primary btn--sm" style="color:#fff">تسجيل الدخول</a>';
    /* مبدّل اللغة — الأسماء بلغتها الأصلية حتى يعرفها من لا يقرأ العربية */
    const langSel = '<select class="lang-pick" id="kx-lang" aria-label="' +
      e(KX.i18n.t('change_language')) + '">' +
      KX.i18n.available().map(function (l) {
        const m = KX.i18n.meta(l);
        return '<option value="' + l + '"' + (l === KX.i18n.getLang() ? ' selected' : '') + '>' +
               e(m.native) + '</option>';
      }).join('') + '</select>';

    return '<header class="appbar"><div class="appbar__inner">' +
      '<a href="#/" class="brand"><span class="brand__mark">🪨</span><span>' + e(KX.config.brand.name) + '</span></a>' +
      '<button class="appbar__burger" id="kx-burger" aria-label="القائمة">☰</button>' +
      '<nav class="appbar__nav" id="kx-nav">' + nav + langSel + right + '</nav>' +
      '</div></header>' +
      (KX.config.demo.enabled ? '<div class="demo-bar">⚠️ ' + e(KX.config.demo.banner) + '</div>' : '');
  }

  function footer() {
    const b = KX.config.brand;
    return '<footer class="footer"><div class="container">' +
      '<div class="grid grid-4">' +
        '<div><h4>' + e(b.name) + '</h4><p style="color:#9fb5c8">' + e(b.tagline) + '</p>' +
        '<p style="color:#9fb5c8">منطقة التشغيل الحالية: ' + e(b.launchArea) + '</p></div>' +
        '<div><h4>الخدمة</h4>' +
          '<div><a href="#/how">كيف تعمل الخدمة؟</a></div>' +
          '<div><a href="#/suppliers">الموردون</a></div>' +
          '<div><a href="#/faq">الأسئلة الشائعة</a></div></div>' +
        '<div><h4>السياسات</h4>' +
          '<div><a href="#/terms">الشروط والأحكام</a></div>' +
          '<div><a href="#/privacy">سياسة الخصوصية</a></div>' +
          '<div><a href="#/refund-policy">سياسة الإلغاء والاسترداد</a></div></div>' +
        '<div><h4>تواصل معنا</h4>' +
          '<div>' + e(b.supportPhone) + '</div><div>' + e(b.supportEmail) + '</div>' +
          '<div style="margin-top:8px"><a href="#/contact">نموذج التواصل</a></div></div>' +
      '</div>' +
      '<div class="footer__bottom"><span>© ' + new Date().getFullYear() + ' ' + e(b.name) +
      ' — نسخة تجريبية ' + e(KX.config.version) + '</span>' +
      '<span>جميع البيانات المعروضة افتراضية وغير حقيقية</span></div>' +
      '</div></footer>';
  }

  function sidebar(role, counts) {
    const items = SIDEBARS[role] || [];
    const cur = KX.router.current().split('?')[0];
    /* المسار النشط هو أطول مسار مطابق حتى لا يُضاء القسم وابنه معًا */
    const matches = items.filter((it) => it.path && (cur === it.path || cur.indexOf(it.path + '/') === 0));
    const best = matches.sort((a, b) => b.path.length - a.path.length)[0];
    /* label المكتوب صراحةً يفوز؛ وإلا يُترجم key بسلسلة الرجوع المعتمدة */
    const text = (it) => it.label || (it.key ? KX.i18n.t(it.key) : '');
    return '<aside class="sidebar">' + items.map(function (it) {
      if (it.group) return '<div class="sidebar__group">' + e(text(it) || it.group) + '</div>';
      const active = best && it.path === best.path;
      const c = counts && counts[it.path];
      return '<a href="#' + it.path + '" class="' + (active ? 'is-active' : '') + '">' +
        '<span>' + it.icon + '</span><span>' + e(text(it)) + '</span>' +
        (c ? '<span class="count">' + c + '</span>' : '') + '</a>';
    }).join('') + '</aside>';
  }

  /* صفحة عامة (بدون قائمة جانبية) */
  function renderPublic(html, opts) {
    opts = opts || {};
    root().innerHTML = appbar() +
      (opts.raw ? html : '<main class="container" style="padding-top:28px;padding-bottom:32px">' + html + '</main>') +
      footer();
    bindChrome();
  }
  /* صفحة داخل لوحة تحكم */
  function renderApp(html, opts) {
    opts = opts || {};
    const s = KX.auth.session() || {};
    root().innerHTML = appbar() +
      '<div class="shell">' + sidebar(s.role, opts.counts) +
      '<main class="content">' +
        (opts.title
          ? '<div class="row row--between mb"><div><h1>' + e(opts.title) + '</h1>' +
            (opts.subtitle ? '<p class="muted" style="margin:0">' + e(opts.subtitle) + '</p>' : '') + '</div>' +
            (opts.actions ? '<div class="btn-group">' + opts.actions + '</div>' : '') + '</div>'
          : '') +
        html +
      '</main></div>';
    bindChrome();
  }

  function bindChrome() {
    const burger = document.getElementById('kx-burger');
    if (burger) burger.onclick = () => document.getElementById('kx-nav').classList.toggle('is-open');
    const lang = document.getElementById('kx-lang');
    if (lang) lang.onchange = function () { KX.i18n.setLang(this.value); KX.router.resolve(); };
  }

  return { renderPublic, renderApp, appbar, footer, sidebar, PUBLIC_NAV, SIDEBARS };
})();
