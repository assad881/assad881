/* كسارة اكسبريس — القاموس (عربي / إنجليزي) */
(function (root) {
  'use strict';
  const EX = (root.EX = root.EX || {});

  const DICT = {
    app_name: ['كسارة اكسبريس', 'Express Crusher'],
    app_tagline: ['إدارة النقلات والعملاء والحسابات', 'Loads, customers & accounts'],

    /* التنقل */
    nav_dashboard: ['اليوم', 'Today'],
    nav_loads: ['النقلات', 'Loads'],
    nav_customers: ['العملاء', 'Customers'],
    nav_payments: ['المدفوعات', 'Payments'],
    nav_materials: ['المواد والأسعار', 'Materials'],
    nav_trucks: ['الشاحنات', 'Trucks'],
    nav_expenses: ['المصروفات', 'Expenses'],
    nav_reports: ['التقارير', 'Reports'],
    nav_settings: ['الإعدادات', 'Settings'],

    /* عام */
    add: ['إضافة', 'Add'],
    edit: ['تعديل', 'Edit'],
    save: ['حفظ', 'Save'],
    cancel: ['إلغاء', 'Cancel'],
    confirm: ['تأكيد', 'Confirm'],
    close: ['إغلاق', 'Close'],
    delete: ['حذف', 'Delete'],
    search: ['بحث', 'Search'],
    filter: ['تصفية', 'Filter'],
    all: ['الكل', 'All'],
    none: ['لا شيء', 'None'],
    total: ['الإجمالي', 'Total'],
    date: ['التاريخ', 'Date'],
    from: ['من', 'From'],
    to: ['إلى', 'To'],
    notes: ['ملاحظات', 'Notes'],
    actions: ['إجراءات', 'Actions'],
    print: ['طباعة', 'Print'],
    export_csv: ['تصدير CSV', 'Export CSV'],
    no_data: ['لا توجد بيانات بعد', 'No data yet'],
    empty_hint: ['ابدأ بإضافة أول سجل من الزر بالأعلى.', 'Start by adding your first record above.'],
    required: ['حقل مطلوب', 'Required field'],
    saved: ['تم الحفظ', 'Saved'],
    deleted: ['تم الحذف', 'Deleted'],
    today_label: ['اليوم', 'Today'],
    this_month: ['هذا الشهر', 'This month'],
    last_30: ['آخر 30 يومًا', 'Last 30 days'],
    optional: ['اختياري', 'optional'],
    active: ['مُفعّل', 'Active'],
    inactive: ['موقوف', 'Inactive'],
    rows: ['سجل', 'rows'],
    delete_confirm: ['سيتم حذف هذا السجل نهائيًا. هل تريد المتابعة؟', 'This record will be permanently deleted. Continue?'],
    language: ['اللغة', 'Language'],
    theme: ['المظهر', 'Theme'],
    dark: ['داكن', 'Dark'],
    light: ['فاتح', 'Light'],

    /* الوحدات */
    unit: ['الوحدة', 'Unit'],
    unit_ton: ['طن', 'ton'],
    unit_load: ['نقلة', 'load'],
    unit_m3: ['م³', 'm³'],

    /* لوحة اليوم */
    dash_title: ['ملخص اليوم', "Today's summary"],
    kpi_loads_today: ['نقلات اليوم', 'Loads today'],
    kpi_qty_today: ['كميات اليوم', 'Quantity today'],
    kpi_revenue_today: ['إيراد اليوم', 'Revenue today'],
    kpi_cash_today: ['المحصّل اليوم', 'Collected today'],
    kpi_month_revenue: ['إيراد الشهر', 'Month revenue'],
    kpi_month_expenses: ['مصروفات الشهر', 'Month expenses'],
    kpi_month_profit: ['صافي الشهر', 'Month net'],
    kpi_receivables: ['إجمالي الذمم', 'Receivables'],
    quick_actions: ['إجراءات سريعة', 'Quick actions'],
    new_load: ['نقلة جديدة', 'New load'],
    new_payment: ['تسجيل دفعة', 'Record payment'],
    new_expense: ['تسجيل مصروف', 'Record expense'],
    today_loads: ['نقلات اليوم', "Today's loads"],
    top_customers: ['أكبر العملاء (الشهر)', 'Top customers (month)'],
    top_debtors: ['أعلى المديونيات', 'Highest balances'],
    revenue_30: ['الإيراد اليومي — آخر 30 يومًا', 'Daily revenue — last 30 days'],
    mix_month: ['توزيع الكميات على المواد (الشهر)', 'Quantity by material (month)'],

    /* النقلات */
    loads_title: ['سجل النقلات', 'Load register'],
    load_no: ['رقم النقلة', 'Load #'],
    customer: ['العميل', 'Customer'],
    material: ['المادة', 'Material'],
    truck: ['الشاحنة', 'Truck'],
    driver: ['السائق', 'Driver'],
    qty: ['الكمية', 'Qty'],
    price: ['السعر', 'Price'],
    unit_price: ['سعر الوحدة', 'Unit price'],
    discount: ['خصم', 'Discount'],
    site: ['الموقع / الوجهة', 'Site / destination'],
    payment_type: ['نوع الدفع', 'Payment'],
    pay_cash: ['نقدي', 'Cash'],
    pay_credit: ['آجل', 'Credit'],
    ticket: ['سند تسليم', 'Delivery note'],
    net_weight: ['الوزن الصافي', 'Net weight'],
    add_load: ['إضافة نقلة', 'Add load'],
    edit_load: ['تعديل نقلة', 'Edit load'],
    loads_count: ['عدد النقلات', 'Loads'],

    /* العملاء */
    customers_title: ['العملاء والذمم', 'Customers & balances'],
    name: ['الاسم', 'Name'],
    phone: ['الهاتف', 'Phone'],
    area: ['المنطقة', 'Area'],
    customer_type: ['التصنيف', 'Type'],
    opening_balance: ['رصيد افتتاحي', 'Opening balance'],
    balance: ['الرصيد المستحق', 'Balance due'],
    statement: ['كشف حساب', 'Statement'],
    add_customer: ['إضافة عميل', 'Add customer'],
    edit_customer: ['تعديل عميل', 'Edit customer'],
    special_prices: ['أسعار خاصة', 'Special prices'],
    special_prices_hint: ['اتركه فارغًا لاستخدام سعر قائمة الأسعار.', 'Leave blank to use the price list.'],
    last_load: ['آخر نقلة', 'Last load'],
    debit: ['مدين', 'Debit'],
    credit_col: ['دائن', 'Credit'],
    running: ['الرصيد', 'Running'],
    aging: ['أعمار الذمم', 'Receivables aging'],
    aging_0: ['0–30 يومًا', '0–30 days'],
    aging_31: ['31–60 يومًا', '31–60 days'],
    aging_61: ['61–90 يومًا', '61–90 days'],
    aging_90: ['أكثر من 90 يومًا', 'Over 90 days'],
    settled: ['مسدّد', 'Settled'],

    /* المدفوعات */
    payments_title: ['المدفوعات المحصّلة', 'Payments received'],
    amount: ['المبلغ', 'Amount'],
    method: ['طريقة الدفع', 'Method'],
    m_cash: ['نقد', 'Cash'],
    m_bank: ['تحويل بنكي', 'Bank transfer'],
    m_cheque: ['شيك', 'Cheque'],
    ref: ['المرجع', 'Reference'],
    add_payment: ['إضافة دفعة', 'Add payment'],
    receipt: ['سند قبض', 'Receipt'],

    /* المواد */
    materials_title: ['المواد وقائمة الأسعار', 'Materials & price list'],
    add_material: ['إضافة مادة', 'Add material'],
    default_price: ['السعر الافتراضي', 'Default price'],
    sold_qty: ['الكمية المبيعة', 'Qty sold'],
    revenue: ['الإيراد', 'Revenue'],

    /* الشاحنات */
    trucks_title: ['الشاحنات والسائقون', 'Trucks & drivers'],
    plate: ['رقم اللوحة', 'Plate'],
    capacity: ['الحمولة (طن)', 'Capacity (t)'],
    add_truck: ['إضافة شاحنة', 'Add truck'],
    trips: ['عدد النقلات', 'Trips'],
    hauled: ['الكمية المنقولة', 'Hauled'],

    /* المصروفات */
    expenses_title: ['المصروفات التشغيلية', 'Operating expenses'],
    category: ['البند', 'Category'],
    add_expense: ['إضافة مصروف', 'Add expense'],
    cat_diesel: ['ديزل / وقود', 'Diesel / fuel'],
    cat_maintenance: ['صيانة', 'Maintenance'],
    cat_parts: ['قطع غيار', 'Spare parts'],
    cat_salaries: ['رواتب وأجور', 'Salaries'],
    cat_rent: ['إيجارات ورسوم', 'Rent & fees'],
    cat_explosives: ['تفجير ونسف', 'Blasting'],
    cat_electric: ['كهرباء وماء', 'Utilities'],
    cat_other: ['أخرى', 'Other'],

    /* التقارير */
    reports_title: ['التقارير والتحليل', 'Reports & analysis'],
    period: ['الفترة', 'Period'],
    summary: ['الملخص', 'Summary'],
    gross_revenue: ['إجمالي الإيراد', 'Gross revenue'],
    total_expenses: ['إجمالي المصروفات', 'Total expenses'],
    net_profit: ['صافي الربح', 'Net profit'],
    margin: ['هامش الربح', 'Profit margin'],
    collected: ['المحصّل', 'Collected'],
    outstanding: ['غير محصّل', 'Outstanding'],
    avg_load: ['متوسط قيمة النقلة', 'Avg load value'],
    avg_price_ton: ['متوسط سعر الطن', 'Avg price / ton'],
    by_material: ['حسب المادة', 'By material'],
    by_customer: ['حسب العميل', 'By customer'],
    by_truck: ['حسب الشاحنة', 'By truck'],
    by_month: ['حسب الشهر', 'By month'],
    rev_vs_exp: ['الإيراد مقابل المصروف', 'Revenue vs expenses'],
    share: ['النسبة', 'Share'],
    expenses_breakdown: ['توزيع المصروفات', 'Expense breakdown'],
    daily_trend: ['الحركة اليومية', 'Daily trend'],

    /* الإعدادات */
    settings_title: ['الإعدادات', 'Settings'],
    company: ['بيانات المؤسسة', 'Business details'],
    company_name: ['اسم المؤسسة', 'Business name'],
    company_phone: ['الهاتف', 'Phone'],
    company_address: ['العنوان', 'Address'],
    cr_no: ['السجل التجاري', 'CR number'],
    vat_no: ['الرقم الضريبي', 'VAT number'],
    vat_enabled: ['إضافة ضريبة القيمة المضافة على المستندات', 'Add VAT on documents'],
    vat_rate: ['نسبة الضريبة %', 'VAT rate %'],
    data: ['البيانات والنسخ الاحتياطي', 'Data & backup'],
    export_all: ['تصدير جميع البيانات (JSON)', 'Export all data (JSON)'],
    import_all: ['استيراد نسخة', 'Import backup'],
    import_hint: ['الصق محتوى ملف النسخة الاحتياطية هنا:', 'Paste the backup file content here:'],
    import_done: ['تم استيراد النسخة', 'Backup imported'],
    import_bad: ['الملف غير صالح', 'Invalid file'],
    sample_data: ['تحميل بيانات تجريبية', 'Load sample data'],
    sample_hint: ['يضيف عملاء ونقلات لتجربة التطبيق. لا يحذف بياناتك.', 'Adds demo customers and loads so you can try the app. Your data is kept.'],
    reset_all: ['حذف كل البيانات', 'Delete all data'],
    reset_confirm: ['سيتم حذف كل العملاء والنقلات والمدفوعات نهائيًا. هل أنت متأكد؟', 'All customers, loads and payments will be permanently deleted. Are you sure?'],
    storage_note: ['كل البيانات محفوظة في متصفحك فقط (localStorage) ولا تُرسل إلى أي خادم. صدّر نسخة احتياطية بين حين وآخر.',
      'All data stays in your browser (localStorage) and is never sent to a server. Export a backup from time to time.'],
    export_copy_hint: ['لم يسمح المتصفح بتنزيل الملف — انسخ النص التالي واحفظه بنفسك.',
      'The browser blocked the download — copy the text below and save it yourself.'],
    copy: ['نسخ', 'Copy'],
    copied: ['تم النسخ', 'Copied'],

    /* المستندات */
    doc_ticket_title: ['سند تسليم مواد', 'Material Delivery Note'],
    doc_invoice_title: ['فاتورة', 'Invoice'],
    doc_statement_title: ['كشف حساب عميل', 'Customer Statement'],
    doc_receipt_title: ['سند قبض', 'Payment Receipt'],
    doc_no: ['رقم المستند', 'Document #'],
    doc_subtotal: ['الإجمالي قبل الضريبة', 'Subtotal'],
    doc_vat: ['ضريبة القيمة المضافة', 'VAT'],
    doc_grand: ['الإجمالي المستحق', 'Total due'],
    doc_received_from: ['استلمنا من', 'Received from'],
    doc_amount_words: ['المبلغ', 'Amount'],
    doc_sig_customer: ['توقيع المستلم', 'Received by'],
    doc_sig_company: ['عن المؤسسة', 'For the business'],
    doc_prev_balance: ['رصيد سابق', 'Previous balance'],
    doc_closing: ['الرصيد الختامي', 'Closing balance'],
    doc_thanks: ['شكرًا لتعاملكم معنا', 'Thank you for your business']
  };

  const I = {
    lang: 'ar',
    setLang(l) { I.lang = l === 'en' ? 'en' : 'ar'; return I.lang; },
    t(key, params) {
      const row = DICT[key];
      let s = row ? (I.lang === 'en' ? (row[1] || row[0]) : row[0]) : key;
      if (params) {
        Object.keys(params).forEach(function (k) {
          s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
        });
      }
      return s;
    },
    dict: DICT
  };

  EX.i18n = I;
  EX.t = function (k, p) { return I.t(k, p); };
})(window);
