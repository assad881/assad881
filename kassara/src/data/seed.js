/* ============================================================
   البيانات الأولية.

   قائمة الأسعار والمواد حقيقية، مصدرها:
     «مشاريع الواعدة الحديثة ش م م — أسعار منتجات الكسارة»
     AL WAEDA MODERN ENT LLC — MATERIALS PRICE LIST
   12 مادة بسعر المتر المكعب من باب الكسارة، النقل والضريبة غير مشمولين،
   والحد الأدنى للتوصيل شاحنة 18 م³. أسماء المواد بخمس لغات من الجدول المعتمد.

   أما العملاء وشركات النقل والشاحنات والسائقون والطلبات فبيانات اختبار
   افتراضية لتشغيل المنصة وتجربتها، ولا تمثّل جهات فعلية.
   ============================================================ */
window.KX = window.KX || {};
KX.seed = (function () {
  const SEED_VERSION = 'v2-waeda';
  const U = () => KX.util;
  const iso = (d) => new Date(d).toISOString();
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

  async function needsSeed() {
    const v = KX.store.ls('kx:seed_version');
    const users = await KX.repo.count('users');
    return v !== SEED_VERSION || users === 0;
  }

  async function run(force) {
    if (!force && !(await needsSeed())) return false;
    KX.repo.reset();

    /* ---------- الإعدادات ---------- */
    await KX.repo.insert('settings', { key: 'finance', value: KX.config.finance });
    await KX.repo.insert('settings', { key: 'company', value: {
      legal_name: 'مشاريع الواعدة الحديثة ش.م.م',
      legal_name_en: 'Al Waeda Modern Ent LLC',
      cr_number: '—', vat_number: '—',
      address: 'محافظة الظاهرة، سلطنة عُمان',
      bank_name: '—', iban: '—',
      note: 'تُستكمل البيانات الرسمية قبل الإطلاق'
    }});
    await KX.repo.insert('settings', { key: 'price_list', value: {
      source: 'مشاريع الواعدة الحديثة ش م م — أسعار منتجات الكسارة',
      source_en: 'AL WAEDA MODERN ENT LLC — MATERIALS PRICE LIST',
      basis: 'سعر المتر المكعب من باب الكسارة',
      excludes: ['النقل', 'ضريبة القيمة المضافة'],
      min_delivery_m3: 18,
      captured_at: '2026-09-06'
    }});

    /* ---------- فئات المواد ---------- */
    const cats = await KX.repo.insertMany('material_categories', [
      { code: 'SAND', name: 'رمل',          name_en: 'Sand',              sort: 1, icon: '⏳' },
      { code: 'AGG',  name: 'ركام مكسر',    name_en: 'Crushed aggregate', sort: 2, icon: '🪨' },
      { code: 'BASE', name: 'طبقة أساس',    name_en: 'Base course',       sort: 3, icon: '🛣️' },
      { code: 'FILL', name: 'مواد ردم',     name_en: 'Backfilling',       sort: 4, icon: '⛰️' },
      { code: 'NAT',  name: 'ركام طبيعي',   name_en: 'Natural aggregate', sort: 5, icon: '🧱' }
    ]);
    const C = {}; cats.forEach((c) => { C[c.code] = c.id; });

    /* ---------- المواد وأسعارها — من القائمة الرسمية ---------- */
    const PRICE_LIST = [
      { sku: 'SAND-NORMAL-05', cat: 'SAND', size: '5 mm', price: 1.9, special: 1.6, min: 18,
        name: { ar: 'رمل عادي', en: 'Normal Sand',
                ur: 'عام ریت', hi: 'सामान्य रेत',
                bn: 'সাধারণ বালি' } },
      { sku: 'SAND-PLASTER-02', cat: 'SAND', size: '2 mm', price: 2.9, special: null, min: 18,
        name: { ar: 'رمل بلاستر', en: 'Plaster Sand',
                ur: 'پلاسٹر ریت', hi: 'प्लास्टर रेत',
                bn: 'প্লাস্টার বালি' } },
      { sku: 'SAND-BLOCK-316', cat: 'SAND', size: '3/16', price: 1.9, special: null, min: 18,
        name: { ar: 'رمل طابوق', en: 'Block Sand',
                ur: 'بلاک ریت', hi: 'ब्लॉक रेत',
                bn: 'ব্লক বালি' } },
      { sku: 'AGG-CRUSH-038', cat: 'AGG', size: '3/8', price: 1.9, special: null, min: 18,
        name: { ar: 'ركام مكسر', en: 'Crushed Aggregate',
                ur: 'کرشڈ ایگریگیٹ', hi: 'क्रश्ड एग्रीगेट',
                bn: 'ক্রাশড অ্যাগ্রিগেট' } },
      { sku: 'AGG-CRUSH-034', cat: 'AGG', size: '3/4', price: 2.4, special: null, min: 18,
        name: { ar: 'ركام مكسر', en: 'Crushed Aggregate',
                ur: 'کرشڈ ایگریگیٹ', hi: 'क्रश्ड एग्रीगेट',
                bn: 'ক্রাশড অ্যাগ্রিগেট' } },
      { sku: 'BASE-ABC-0020', cat: 'BASE', size: '0.2–20 mm', price: 2.2, special: null, min: 18,
        name: { ar: 'طبقة أساس ABC', en: 'ABC Base Course',
                ur: 'اے بی سی بیس کورس', hi: 'एबीसी बेस कोर्स',
                bn: 'এবিসি বেস কোর্স' } },
      { sku: 'FILL-WADI', cat: 'FILL', size: '—', price: 0.65, special: null, min: 18,
        name: { ar: 'مواد ردم وادي', en: 'Wadi Backfill Material',
                ur: 'وادی بیک فل مواد', hi: 'वादी बैकफिल सामग्री',
                bn: 'ওয়াদি ব্যাকফিল উপকরণ' } },
      { sku: 'FILL-WADI-SCR', cat: 'FILL', size: '—', price: 1.1, special: null, min: 18,
        name: { ar: 'مواد ردم وادي مغربلة', en: 'Screened Wadi Backfill Material',
                ur: 'چھنا ہوا وادی بیک فل مواد', hi: 'छनी हुई वादी बैकफिल सामग्री',
                bn: 'ছাঁকা ওয়াদি ব্যাকফিল উপকরণ' } },
      { sku: 'AGG-NAT-10', cat: 'NAT', size: '10 mm', price: 0.9, special: null, min: 18,
        name: { ar: 'حصى طبيعي', en: 'Natural Aggregate',
                ur: 'قدرتی بجری', hi: 'प्राकृतिक बजरी',
                bn: 'প্রাকৃতিক নুড়ি' } },
      { sku: 'AGG-NAT-20', cat: 'NAT', size: '20 mm', price: 1.0, special: null, min: 18,
        name: { ar: 'حصى طبيعي', en: 'Natural Aggregate',
                ur: 'قدرتی بجری', hi: 'प्राकृतिक बजरी',
                bn: 'প্রাকৃতিক নুড়ি' } },
      { sku: 'AGG-NAT-2040', cat: 'NAT', size: '20–40 mm', price: 1.65, special: null, min: 18,
        name: { ar: 'حصى طبيعي', en: 'Natural Aggregate',
                ur: 'قدرتی بجری', hi: 'प्राकृतिक बजरी',
                bn: 'প্রাকৃতিক নুড়ি' } },
      { sku: 'AGG-NAT-4080', cat: 'NAT', size: '40–80 mm', price: 2.0, special: null, min: 18,
        name: { ar: 'حصى طبيعي', en: 'Natural Aggregate',
                ur: 'قدرتی بجری', hi: 'प्राकृतिक बजरी',
                bn: 'প্রাকৃতিক নুড়ি' } }
    ];

    const M = {};
    for (const row of PRICE_LIST) {
      const m = await KX.repo.insert('materials', {
        sku: row.sku, category_id: C[row.cat],
        name: row.name.ar, name_i18n: row.name,
        size: row.size, unit: 'm3', is_active: true
      });
      M[row.sku] = m.id;
    }

    /* ---------- المورد: الكسارة ---------- */
    const supUser = await KX.repo.insert('users', {
      name: 'مشاريع الواعدة الحديثة', phone: '96891000001',
      role: 'supplier', account_status: 'active'
    });
    const supplier = await KX.repo.insert('suppliers', {
      user_id: supUser.id, code: 'WAEDA',
      name: 'مشاريع الواعدة الحديثة ش.م.م', name_en: 'Al Waeda Modern Ent LLC',
      cr_number: '—', phone: '96891000001',
      wilayat: 'عبري', governorate: 'الظاهرة',
      location: { lat: 23.1850, lng: 56.4400 },
      address: 'محافظة الظاهرة — سلطنة عُمان',
      loading_capacity_per_day: 900, unit: 'm3',
      working_hours: '6:00 ص — 6:00 م',
      rating: 0, is_approved: true, is_active: true
    });

    /* سعر عام لكل مادة + السعر الخاص حيث ينطبق.
       السعر الخاص لا يُعرض علنًا: يُستحق باعتماد الإدارة للعميل أو بكود مصرّح. */
    for (const row of PRICE_LIST) {
      await KX.repo.insert('supplier_prices', {
        supplier_id: supplier.id, material_id: M[row.sku],
        price_per_unit: row.price, unit: 'm3', currency: 'OMR',
        min_qty: row.min, max_qty: null,
        available_per_day: 900, tiers: [],
        includes_transport: false, includes_vat: false,
        valid_from: daysAgo(1), valid_to: null,
        customer_id: null, is_special: false, is_active: true,
        source: 'قائمة أسعار منتجات الكسارة'
      });
      if (row.special) {
        await KX.repo.insert('supplier_prices', {
          supplier_id: supplier.id, material_id: M[row.sku],
          price_per_unit: row.special, unit: 'm3', currency: 'OMR',
          min_qty: row.min, max_qty: null,
          available_per_day: 900, tiers: [],
          includes_transport: false, includes_vat: false,
          valid_from: daysAgo(1), valid_to: null,
          customer_id: null, is_special: true, unlock_code: 'WAEDA-SP',
          is_active: true, note: 'سعر خاص للعملاء المعتمدين — لا يُعرض علنًا'
        });
      }
    }

    /* ---------- مناطق التوصيل ---------- */
    const zones = await KX.repo.insertMany('delivery_zones', [
      { code: 'IBR-C', name: 'عبري — المركز',  name_en: 'Ibri — Centre', wilayat: 'عبري', governorate: 'الظاهرة',
        radius_km: 15, center: { lat: 23.2257, lng: 56.5158 }, is_active: true },
      { code: 'IBR-O', name: 'عبري — الأطراف', name_en: 'Ibri — Outskirts', wilayat: 'عبري', governorate: 'الظاهرة',
        radius_km: 40, center: { lat: 23.2600, lng: 56.4600 }, is_active: true },
      { code: 'DHK',   name: 'ضنك',             name_en: 'Dhank', wilayat: 'ضنك', governorate: 'الظاهرة',
        radius_km: 30, center: { lat: 23.5486, lng: 56.2647 }, is_active: true },
      { code: 'YNQ',   name: 'ينقل',            name_en: 'Yanqul', wilayat: 'ينقل', governorate: 'الظاهرة',
        radius_km: 30, center: { lat: 23.5872, lng: 56.5397 }, is_active: true },
      { code: 'OUT',   name: 'خارج المحافظة (بالطلب)', name_en: 'Outside governorate', wilayat: '—',
        governorate: 'أخرى', radius_km: 200, center: { lat: 23.4, lng: 56.5 }, is_active: false }
    ]);
    const Z = {}; zones.forEach((z) => { Z[z.code] = z.id; });

    /* ---------- أنواع الشاحنات — الحمولة بالمتر المكعب وبالطن ---------- */
    const truckTypes = await KX.repo.insertMany('truck_types', [
      { code: 'TIP18', name: 'قلاب 18 م³', name_en: 'Tipper 18 m³',
        capacity_m3: 18, capacity_tons: 30, axles: 4, is_active: true,
        note: 'الحد الأدنى للتوصيل — شاحنة واحدة' },
      { code: 'TIP12', name: 'قلاب 12 م³', name_en: 'Tipper 12 m³',
        capacity_m3: 12, capacity_tons: 20, axles: 3, is_active: true },
      { code: 'TRL24', name: 'تريلة 24 م³', name_en: 'Trailer 24 m³',
        capacity_m3: 24, capacity_tons: 40, axles: 6, is_active: true },
      { code: 'TRL30', name: 'تريلة 30 م³', name_en: 'Trailer 30 m³',
        capacity_m3: 30, capacity_tons: 48, axles: 6, is_active: true }
    ]);
    const T = {}; truckTypes.forEach((t) => { T[t.code] = t.id; });

    /* ---------- بيانات اختبار: مستخدمون، عملاء، ناقلون ---------- */
    const users = await KX.repo.insertMany('users', [
      { name: 'إدارة المنصة',          phone: '96899000001', role: 'admin', account_status: 'active' },
      { name: 'موظف العمليات',         phone: '96899000002', role: 'ops',   account_status: 'active' },
      { name: 'أحمد بن سعيد',          phone: '96890000001', role: 'customer', account_status: 'active' },
      { name: 'شركة البناء الحديث',    phone: '96890000002', role: 'customer', account_status: 'active' },
      { name: 'خالد المنذري',          phone: '96890000003', role: 'customer', account_status: 'active' },
      { name: 'Ravi Kumar',            phone: '96890000004', role: 'customer', account_status: 'active', lang: 'hi' },
      { name: 'نقليات الظاهرة',        phone: '96892000001', role: 'transporter', account_status: 'active' },
      { name: 'شركة عبري للنقل الثقيل', phone: '96892000002', role: 'transporter', account_status: 'active' },
      { name: 'سيف البلوشي',           phone: '96893000001', role: 'driver', account_status: 'active' },
      { name: 'ماجد الكعبي',           phone: '96893000002', role: 'driver', account_status: 'active' },
      { name: 'Md. Karim',             phone: '96893000003', role: 'driver', account_status: 'active', lang: 'bn' }
    ]);
    const byPhone = {}; users.forEach((u) => { byPhone[u.phone] = u; });

    const customers = await KX.repo.insertMany('customer_profiles', [
      { user_id: byPhone['96890000001'].id, name: 'أحمد بن سعيد', phone: '96890000001',
        customer_type: 'individual', special_pricing_approved: false,
        credit_approved: false, credit_limit: 0, credit_used: 0, total_orders: 0, total_spent: 0, lang: 'ar' },
      { user_id: byPhone['96890000002'].id, name: 'شركة البناء الحديث', phone: '96890000002',
        customer_type: 'company', company_name: 'شركة البناء الحديث ش.م.م', cr_number: '1234567',
        special_pricing_approved: true,
        credit_approved: true, credit_limit: 5000.000, credit_used: 0, total_orders: 0, total_spent: 0, lang: 'ar' },
      { user_id: byPhone['96890000003'].id, name: 'خالد المنذري', phone: '96890000003',
        customer_type: 'contractor', company_name: 'مؤسسة المنذري للمقاولات', cr_number: '7654321',
        special_pricing_approved: false,
        credit_approved: true, credit_limit: 2000.000, credit_used: 0, total_orders: 0, total_spent: 0, lang: 'ar' },
      { user_id: byPhone['96890000004'].id, name: 'Ravi Kumar', phone: '96890000004',
        customer_type: 'contractor', company_name: 'Kumar Contracting',
        special_pricing_approved: false,
        credit_approved: false, credit_limit: 0, credit_used: 0, total_orders: 0, total_spent: 0, lang: 'hi' }
    ]);
    const CU = {}; customers.forEach((c) => { CU[c.phone] = c; });

    const locations = await KX.repo.insertMany('locations', [
      { customer_id: CU['96890000001'].id, label: 'منزل العائلة — حي الظاهر', zone_id: Z['IBR-C'],
        coords: { lat: 23.2290, lng: 56.5170 }, address: 'عبري، حي الظاهر',
        contact_name: 'أحمد', contact_phone: '96890000001', is_default: true },
      { customer_id: CU['96890000002'].id, label: 'مشروع فيلات العقر', zone_id: Z['IBR-O'],
        coords: { lat: 23.2650, lng: 56.4720 }, address: 'عبري، العقر، مخطط الفيلات',
        contact_name: 'م. فهد', contact_phone: '96890000012', is_default: true },
      { customer_id: CU['96890000002'].id, label: 'مستودع الشركة — الصناعية', zone_id: Z['IBR-C'],
        coords: { lat: 23.2100, lng: 56.5400 }, address: 'عبري، المنطقة الصناعية',
        contact_name: 'مسؤول المخزن', contact_phone: '96890000013', is_default: false },
      { customer_id: CU['96890000003'].id, label: 'طريق ربط داخلي — ضنك', zone_id: Z.DHK,
        coords: { lat: 23.5510, lng: 56.2700 }, address: 'ضنك، طريق ربط قرية العراقي',
        contact_name: 'خالد', contact_phone: '96890000003', is_default: true },
      { customer_id: CU['96890000004'].id, label: 'Site A — Ibri', zone_id: Z['IBR-C'],
        coords: { lat: 23.2200, lng: 56.5300 }, address: 'Ibri industrial area, plot 12',
        contact_name: 'Ravi', contact_phone: '96890000004', is_default: true }
    ]);

    const carriers = await KX.repo.insertMany('transport_companies', [
      { user_id: byPhone['96892000001'].id, name: 'نقليات الظاهرة', code: 'TRP-DHR',
        phone: '96892000001', wilayat: 'عبري', governorate: 'الظاهرة',
        service_zones: [Z['IBR-C'], Z['IBR-O'], Z.DHK, Z.YNQ],
        rating: 0, is_approved: true, is_active: true },
      { user_id: byPhone['96892000002'].id, name: 'شركة عبري للنقل الثقيل', code: 'TRP-IBR',
        phone: '96892000002', wilayat: 'عبري', governorate: 'الظاهرة',
        service_zones: [Z['IBR-C'], Z['IBR-O']],
        rating: 0, is_approved: true, is_active: true }
    ]);
    const TR = {}; carriers.forEach((c) => { TR[c.code] = c; });

    const trucks = await KX.repo.insertMany('trucks', [
      { transporter_id: TR['TRP-DHR'].id, truck_type_id: T.TIP18, plate_no: '1 د ح 4521',
        make: 'Volvo FMX', year: 2021, capacity_m3: 18, capacity_tons: 30, is_available: true },
      { transporter_id: TR['TRP-DHR'].id, truck_type_id: T.TIP18, plate_no: '5 ر س 8830',
        make: 'MAN TGS', year: 2020, capacity_m3: 18, capacity_tons: 30, is_available: true },
      { transporter_id: TR['TRP-DHR'].id, truck_type_id: T.TRL24, plate_no: '3 ب ن 1177',
        make: 'Scania R', year: 2022, capacity_m3: 24, capacity_tons: 40, is_available: true },
      { transporter_id: TR['TRP-IBR'].id, truck_type_id: T.TIP12, plate_no: '7 ك م 2093',
        make: 'Isuzu FVZ', year: 2019, capacity_m3: 12, capacity_tons: 20, is_available: true },
      { transporter_id: TR['TRP-IBR'].id, truck_type_id: T.TRL30, plate_no: '2 ع ط 6644',
        make: 'Mercedes Actros', year: 2023, capacity_m3: 30, capacity_tons: 48, is_available: true }
    ]);

    const drivers = await KX.repo.insertMany('drivers', [
      { user_id: byPhone['96893000001'].id, transporter_id: TR['TRP-DHR'].id, name: 'سيف البلوشي',
        phone: '96893000001', license_no: 'DL-118254', license_expiry: iso('2028-04-30'),
        default_truck_id: trucks[0].id, is_active: true, lang: 'ar' },
      { user_id: byPhone['96893000002'].id, transporter_id: TR['TRP-DHR'].id, name: 'ماجد الكعبي',
        phone: '96893000002', license_no: 'DL-227741', license_expiry: iso('2027-11-15'),
        default_truck_id: trucks[2].id, is_active: true, lang: 'ar' },
      { user_id: byPhone['96893000003'].id, transporter_id: TR['TRP-IBR'].id, name: 'Md. Karim',
        phone: '96893000003', license_no: 'DL-330192', license_expiry: iso('2029-01-20'),
        default_truck_id: trucks[4].id, is_active: true, lang: 'bn' }
    ]);

    /* ---------- تعرفة النقل: لكل منطقة ونوع شاحنة ---------- */
    const rateTable = [
      ['IBR-C', 'TIP12',  9.000, 0.000], ['IBR-C', 'TIP18', 14.000, 0.000],
      ['IBR-C', 'TRL24', 18.000, 0.000], ['IBR-C', 'TRL30', 22.000, 0.000],
      ['IBR-O', 'TIP12', 12.000, 0.150], ['IBR-O', 'TIP18', 18.000, 0.200],
      ['IBR-O', 'TRL24', 23.000, 0.250], ['IBR-O', 'TRL30', 28.000, 0.300],
      ['DHK',   'TIP12', 18.000, 0.200], ['DHK',   'TIP18', 27.000, 0.250],
      ['DHK',   'TRL24', 34.000, 0.300], ['DHK',   'TRL30', 41.000, 0.350],
      ['YNQ',   'TIP12', 20.000, 0.200], ['YNQ',   'TIP18', 30.000, 0.250],
      ['YNQ',   'TRL24', 37.000, 0.300], ['YNQ',   'TRL30', 45.000, 0.350]
    ];
    for (const [z, t, perTrip, perKm] of rateTable) {
      await KX.repo.insert('transport_rates', {
        zone_id: Z[z], truck_type_id: T[t], transporter_id: null,
        price_per_trip: perTrip, price_per_km: perKm,
        valid_from: daysAgo(1), valid_to: null, is_active: true
      });
    }

    await KX.repo.insertMany('coupons', [
      { code: 'WELCOME10', description: 'خصم ترحيبي 10% للطلب الأول', discount_type: 'percent',
        discount_value: 10, max_discount: 15.000, min_order_value: 50.000,
        valid_from: daysAgo(1), valid_to: U().addDays(U().nowISO(), 60),
        max_uses: 200, used_count: 0, customer_id: null, is_active: true }
    ]);

    KX.store.ls('kx:seed_version', SEED_VERSION);
    await seedHistoricalOrders({ CU, supplier, TR, T, Z, M, locations, trucks, drivers });
    return true;
  }

  /* طلبات اختبار سابقة لتغذية لوحة المؤشرات — كميات بالمتر المكعب */
  async function seedHistoricalOrders(ref) {
    const plan = [
      { cust: '96890000002', site: 1, sku: 'BASE-ABC-0020',  qty: 72, truck: 'TRL24', zone: 'IBR-O', status: 'delivered',  age: 21 },
      { cust: '96890000002', site: 1, sku: 'AGG-CRUSH-034',  qty: 36, truck: 'TIP18', zone: 'IBR-O', status: 'delivered',  age: 17 },
      { cust: '96890000001', site: 0, sku: 'FILL-WADI',      qty: 54, truck: 'TIP18', zone: 'IBR-C', status: 'delivered',  age: 14 },
      { cust: '96890000003', site: 3, sku: 'AGG-NAT-2040',   qty: 96, truck: 'TRL24', zone: 'DHK',   status: 'delivered',  age: 11 },
      { cust: '96890000004', site: 4, sku: 'SAND-NORMAL-05', qty: 18, truck: 'TIP18', zone: 'IBR-C', status: 'delivered',  age: 8 },
      { cust: '96890000003', site: 3, sku: 'BASE-ABC-0020',  qty: 60, truck: 'TRL30', zone: 'DHK',   status: 'in_transit', age: 2 },
      { cust: '96890000001', site: 0, sku: 'SAND-PLASTER-02', qty: 18, truck: 'TIP18', zone: 'IBR-C', status: 'paid',      age: 1 },
      { cust: '96890000002', site: 1, sku: 'SAND-BLOCK-316', qty: 24, truck: 'TRL24', zone: 'IBR-O', status: 'ready_for_payment', age: 1 },
      { cust: '96890000003', site: 3, sku: 'FILL-WADI-SCR',  qty: 36, truck: 'TIP18', zone: 'DHK',   status: 'cancelled',  age: 5 }
    ];
    let seq = 100;
    for (const p of plan) {
      const cust = ref.CU[p.cust];
      const site = ref.locations[p.site];
      const q = await KX.pricing.quote({
        supplier_id: ref.supplier.id, material_id: ref.M[p.sku],
        quantity: p.qty, order_by: 'unit', truck_type_id: ref.T[p.truck],
        zone_id: ref.Z[p.zone], site: site.coords, customer_id: cust.id
      });
      if (!q.quantities) continue;
      seq++;
      const createdAt = daysAgo(p.age);
      const paid = ['paid', 'preparing', 'loading', 'in_transit', 'arrived', 'delivered'].indexOf(p.status) !== -1;
      const order = await KX.repo.insert('orders', {
        order_no: 'KX-' + new Date(createdAt).getFullYear() + '-' + String(seq).padStart(6, '0'),
        customer_id: cust.id, site_id: site.id,
        supplier_id: ref.supplier.id, transporter_id: ref.TR['TRP-DHR'].id,
        zone_id: ref.Z[p.zone], truck_id: ref.T[p.truck],
        status: p.status, scheduled_at: U().addDays(createdAt, 1),
        quantity: q.quantities.quantity, unit: q.quantities.unit,
        trips_planned: q.quantities.trips,
        trips_done: p.status === 'delivered' ? q.quantities.trips : 0,
        price_snapshot: q,
        material_cost: q.lines.material_cost, transport_cost: q.lines.transport_cost,
        platform_fee: q.lines.platform_fee, discount: q.lines.discount,
        vat: q.lines.vat, total: q.totals.total,
        amount_paid: paid ? q.totals.total : 0, amount_refunded: 0, waiting_fees: 0,
        delivery_otp: String(Math.floor(1000 + Math.random() * 9000)),
        created_at: createdAt, updated_at: createdAt,
        delivered_at: p.status === 'delivered' ? U().addDays(createdAt, 1) : null,
        history: [{ at: createdAt, status: 'draft', note: 'بيانات اختبار' },
                  { at: U().addDays(createdAt, 0.5), status: p.status, note: 'بيانات اختبار' }]
      });
      await KX.repo.insert('order_items', {
        order_id: order.id, material_id: ref.M[p.sku], material_sku: p.sku,
        material_name: q.inputs.material_name_ar, unit: q.quantities.unit,
        order_by: 'unit', quantity: q.quantities.quantity,
        unit_price: q.lines.unit_price, line_total: q.lines.material_cost
      });
      if (paid) {
        await KX.repo.insert('payments', {
          order_id: order.id, customer_id: cust.id, method: 'card',
          amount: q.totals.total, currency: 'OMR', status: 'captured',
          provider: 'demo', provider_ref: 'DEMO-SEED-' + seq,
          idempotency_key: order.id + ':seed', paid_at: createdAt, created_at: createdAt
        });
      }
      if (p.status === 'delivered') {
        await KX.payments.issueInvoice(order);
        await KX.settlements.buildForOrder(order);
        await KX.repo.insert('reviews', {
          order_id: order.id, customer_id: cust.id,
          supplier_id: order.supplier_id, transporter_id: order.transporter_id,
          supplier_rating: 4 + (seq % 2), transporter_rating: 4 + ((seq + 1) % 2),
          comment: 'الكمية مطابقة والتوصيل في الموعد.', created_at: order.delivered_at
        });
        await KX.repo.update('customer_profiles', cust.id, {
          total_orders: Number(cust.total_orders || 0) + 1,
          total_spent: U().round(Number(cust.total_spent || 0) + Number(order.total), 3)
        });
        cust.total_orders = Number(cust.total_orders || 0) + 1;
        cust.total_spent = U().round(Number(cust.total_spent || 0) + Number(order.total), 3);
      }
      if (p.status === 'in_transit') {
        const trips = await KX.trips.createForOrder(order,
          { transporter_id: ref.TR['TRP-DHR'].id, truck_id: ref.trucks[2].id });
        for (const t of trips) {
          await KX.repo.update('trips', t.id, {
            driver_id: ref.drivers[1].id, truck_id: ref.trucks[2].id, status: 'en_route',
            timeline: [{ at: daysAgo(2), status: 'assigned' }, { at: daysAgo(1), status: 'loaded' },
                       { at: U().nowISO(), status: 'en_route' }]
          });
        }
      }
    }
  }
  return { run, needsSeed, SEED_VERSION };
})();
