/* تعريف الجداول والحقول المشتركة — مرجع واحد للطبقتين المحلية وSupabase */
window.KX = window.KX || {};
KX.schema = (function () {
  /* حقول موجودة في كل سجل */
  const BASE = ['id', 'created_at', 'updated_at', 'created_by', 'status_flag'];

  const TABLES = {
    users:              { pk: 'id', label: 'المستخدمون', softDelete: true },
    customer_profiles:  { pk: 'id', label: 'ملفات العملاء', softDelete: true },
    suppliers:          { pk: 'id', label: 'الموردون', softDelete: true },
    material_categories:{ pk: 'id', label: 'فئات المواد', softDelete: true },
    materials:          { pk: 'id', label: 'المواد', softDelete: true },
    supplier_prices:    { pk: 'id', label: 'أسعار الموردين', softDelete: true },
    price_history:      { pk: 'id', label: 'سجل الأسعار', immutable: true },
    locations:          { pk: 'id', label: 'المواقع', softDelete: true },
    delivery_zones:     { pk: 'id', label: 'مناطق التوصيل', softDelete: true },
    transport_companies:{ pk: 'id', label: 'شركات النقل', softDelete: true },
    drivers:            { pk: 'id', label: 'السائقون', softDelete: true },
    truck_types:        { pk: 'id', label: 'أنواع الشاحنات', softDelete: true },
    trucks:             { pk: 'id', label: 'الشاحنات', softDelete: true },
    transport_rates:    { pk: 'id', label: 'أسعار النقل', softDelete: true },
    orders:             { pk: 'id', label: 'الطلبات', immutable: true },
    order_items:        { pk: 'id', label: 'بنود الطلب', immutable: true },
    quotations:         { pk: 'id', label: 'عروض الأسعار', immutable: true },
    payments:           { pk: 'id', label: 'المدفوعات', immutable: true },
    refunds:            { pk: 'id', label: 'الاستردادات', immutable: true },
    trips:              { pk: 'id', label: 'الرحلات', immutable: true },
    weight_tickets:     { pk: 'id', label: 'تذاكر الميزان', immutable: true },
    invoices:           { pk: 'id', label: 'الفواتير', immutable: true },
    settlements:        { pk: 'id', label: 'التسويات', immutable: true },
    commissions:        { pk: 'id', label: 'العمولات', immutable: true },
    notifications:      { pk: 'id', label: 'الإشعارات' },
    reviews:            { pk: 'id', label: 'التقييمات' },
    complaints:         { pk: 'id', label: 'الشكاوى' },
    coupons:            { pk: 'id', label: 'الكوبونات', softDelete: true },
    audit_logs:         { pk: 'id', label: 'سجل التدقيق', immutable: true },
    settings:           { pk: 'id', label: 'إعدادات المنصة' },
    otp_codes:          { pk: 'id', label: 'رموز التحقق' }
  };

  /* الأدوار */
  const ROLES = {
    customer:    'عميل',
    supplier:    'مورد / كسارة',
    transporter: 'شركة نقل',
    driver:      'سائق',
    ops:         'موظف عمليات',
    admin:       'مدير النظام'
  };

  /* الصلاحيات: role -> قائمة الأذونات (* = كل شيء) */
  const PERMISSIONS = {
    admin: ['*'],
    ops: [
      'orders.read', 'orders.assign', 'orders.transition', 'orders.price_review',
      'payments.read', 'payments.verify', 'refunds.create',
      'customers.read', 'suppliers.read', 'transporters.read',
      'materials.read', 'prices.read', 'zones.read',
      'complaints.read', 'complaints.resolve', 'reports.read', 'notifications.send'
    ],
    customer: [
      'orders.create', 'orders.read.own', 'orders.cancel.own', 'orders.confirm_receipt',
      'payments.pay.own', 'invoices.read.own', 'sites.manage.own',
      'reviews.create', 'complaints.create', 'profile.manage.own'
    ],
    supplier: [
      'orders.read.assigned', 'orders.accept', 'orders.load',
      'materials.manage.own', 'prices.manage.own', 'availability.manage.own',
      'weight_tickets.create', 'settlements.read.own', 'reports.read.own'
    ],
    transporter: [
      'trips.read.assigned', 'trips.accept', 'trips.assign_driver',
      'trucks.manage.own', 'drivers.manage.own', 'transport_rates.manage.own',
      'trips.update_status', 'waiting.request', 'settlements.read.own', 'reports.read.own'
    ],
    driver: [
      'trips.read.own', 'trips.update_status', 'trips.upload_proof', 'trips.enter_otp'
    ]
  };

  /* أنواع حسابات العملاء */
  const CUSTOMER_TYPES = { individual: 'فرد', contractor: 'مقاول', company: 'شركة' };

  /* وحدات القياس */
  const UNITS = { ton: 'طن', truck: 'شاحنة', m3: 'متر مكعب' };

  return { BASE, TABLES, ROLES, PERMISSIONS, CUSTOMER_TYPES, UNITS };
})();
