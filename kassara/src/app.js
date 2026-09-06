/* ============================================================
   نقطة الانطلاق: تسجيل المسارات، حراسة الصلاحيات، تشغيل التطبيق
   ============================================================ */
window.KX = window.KX || {};
KX.app = (function () {
  const R = () => KX.router;

  /* المسارات: {path, view, roles} — roles فارغة تعني صفحة عامة */
  const ROUTES = [
    /* عامة */
    ['/',               () => KX.viewsPublic.home()],
    ['/how',            () => KX.viewsPublic.how()],
    ['/suppliers',      () => KX.viewsPublic.suppliers()],
    ['/faq',            () => KX.viewsPublic.faq()],
    ['/terms',          () => KX.viewsPublic.terms()],
    ['/privacy',        () => KX.viewsPublic.privacy()],
    ['/refund-policy',  () => KX.viewsPublic.refundPolicy()],
    ['/contact',        () => KX.viewsPublic.contact()],
    ['/login',          () => KX.viewsAuth.login()],
    ['/register',       () => KX.viewsAuth.register()],
    ['/logout',         () => KX.viewsAuth.logout()],

    /* مشتركة بين جميع المسجّلين */
    ['/notifications',  () => KX.viewsPartners.notifications(), ['customer', 'supplier', 'transporter', 'driver', 'admin', 'ops']],

    /* العميل */
    ['/customer',                 () => KX.viewsCustomer.dashboard(),   ['customer']],
    ['/customer/new',             () => KX.viewsCustomer.newOrder(),    ['customer']],
    ['/customer/orders',          (c) => KX.viewsCustomer.ordersList(c), ['customer']],
    ['/customer/orders/:id',      (c) => KX.viewsCustomer.orderDetail(c), ['customer']],
    ['/customer/sites',           () => KX.viewsCustomer.sites(),       ['customer']],
    ['/customer/invoices',        () => KX.viewsCustomer.invoices(),    ['customer']],
    ['/customer/invoices/:id',    (c) => KX.viewsCustomer.invoiceDetail(c), ['customer']],
    ['/customer/profile',         () => KX.viewsCustomer.profile(),     ['customer']],
    ['/customer/complaints',      () => KX.viewsCustomer.complaints(),  ['customer']],

    /* المورد */
    ['/supplier',                 () => KX.viewsPartners.supplierDashboard(),  ['supplier']],
    ['/supplier/orders',          () => KX.viewsPartners.supplierOrders(),     ['supplier']],
    ['/supplier/orders/:id',      (c) => KX.viewsPartners.supplierOrderDetail(c), ['supplier']],
    ['/supplier/loading',         () => KX.viewsPartners.supplierOrders(),     ['supplier']],
    ['/supplier/materials',       () => KX.viewsPartners.supplierMaterials(),  ['supplier']],
    ['/supplier/settlements',     () => KX.viewsPartners.supplierSettlements(),['supplier']],
    ['/supplier/reports',         () => KX.viewsPartners.supplierReports(),    ['supplier']],

    /* الناقل */
    ['/transporter',              () => KX.viewsPartners.transporterDashboard(), ['transporter']],
    ['/transporter/orders',       () => KX.viewsPartners.transporterOrders(),    ['transporter']],
    ['/transporter/orders/:id',   (c) => KX.viewsPartners.transporterOrderDetail(c), ['transporter']],
    ['/transporter/trips',        () => KX.viewsPartners.transporterTrips(),     ['transporter']],
    ['/transporter/fleet',        () => KX.viewsPartners.transporterFleet(),     ['transporter']],
    ['/transporter/rates',        () => KX.viewsPartners.transporterRates(),     ['transporter']],
    ['/transporter/settlements',  () => KX.viewsPartners.transporterSettlements(), ['transporter']],

    /* السائق */
    ['/driver',                   () => KX.viewsPartners.driverToday(),   ['driver']],
    ['/driver/history',           () => KX.viewsPartners.driverHistory(), ['driver']],

    /* الإدارة */
    ['/admin',                    (c) => KX.viewsAdmin.dashboard(c),   ['admin', 'ops']],
    ['/admin/orders',             (c) => KX.viewsAdmin.orders(c),      ['admin', 'ops']],
    ['/admin/orders/:id',         (c) => KX.viewsAdmin.orderDetail(c), ['admin', 'ops']],
    ['/admin/payments',           () => KX.viewsAdmin.payments(),      ['admin', 'ops']],
    ['/admin/settlements',        () => KX.viewsAdmin.settlements(),   ['admin']],
    ['/admin/complaints',         () => KX.viewsAdmin.complaints(),    ['admin', 'ops']],
    ['/admin/notifications',      () => KX.viewsAdmin.notifications(), ['admin', 'ops']],
    ['/admin/audit',              (c) => KX.viewsAdmin.audit(c),       ['admin']],
    ['/admin/reports',            (c) => KX.viewsAdmin.reports(c),     ['admin', 'ops']],
    ['/admin/materials',          () => KX.viewsAdminConfig.materials(),    ['admin']],
    ['/admin/price-history',      () => KX.viewsAdminConfig.priceHistory(), ['admin']],
    ['/admin/zones',              () => KX.viewsAdminConfig.zones(),        ['admin']],
    ['/admin/coupons',            () => KX.viewsAdminConfig.coupons(),      ['admin']],
    ['/admin/settings',           () => KX.viewsAdminConfig.settings(),     ['admin']],
    ['/admin/customers',          () => KX.viewsAdminConfig.customers(),    ['admin', 'ops']],
    ['/admin/suppliers',          () => KX.viewsAdminConfig.suppliersAdmin(),    ['admin', 'ops']],
    ['/admin/transporters',       () => KX.viewsAdminConfig.transportersAdmin(), ['admin', 'ops']]
  ];

  function registerRoutes() {
    ROUTES.forEach(([path, handler, roles]) => R().add(path, handler, { roles: roles || null }));
    R().setNotFound(() => KX.viewsPublic.notFound());

    /* حارس الصلاحيات: يمنع الوصول لأي مسار خارج دور المستخدم */
    R().setGuard(function (ctx) {
      const roles = ctx.meta.roles;
      if (!roles) return null;
      const s = KX.auth.session();
      if (!s) { KX.util.toast('سجّل الدخول للمتابعة'); return '/login'; }
      if (roles.indexOf(s.role) === -1) {
        KX.util.toast('لا تملك صلاحية الوصول لهذه الصفحة', 'error');
        return KX.auth.homeFor(s.role);
      }
      return null;
    });
  }

  async function boot() {
    document.documentElement.lang = KX.i18n.getLang();
    document.documentElement.dir = KX.config.i18n.dir;

    try {
      await KX.seed.run(false);
    } catch (err) {
      console.error('seed failed', err);
      document.getElementById('app').innerHTML =
        '<div style="padding:40px;text-align:center;font-family:system-ui">' +
        '<h2>تعذّر تهيئة البيانات المحلية</h2><p>' + KX.util.esc(err.message) + '</p>' +
        '<p>تأكّد أن المتصفح يسمح بالتخزين المحلي (localStorage).</p></div>';
      return;
    }

    KX.auth.restore();
    registerRoutes();
    R().start();

    /* تحديث الشريط عند تغيّر الجلسة */
    KX.store.on('change:session', () => R().resolve());

    /* تسجيل عامل الخدمة للعمل دون اتصال (يعمل عبر خادم فقط) */
    if (KX.config.features.pwa && 'serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return { boot, ROUTES, registerRoutes };
})();

document.addEventListener('DOMContentLoaded', KX.app.boot);
