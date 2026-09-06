/* ============================================================
   بيانات تجريبية واقعية — كلها افتراضية وغير حقيقية.
   أسماء الموردين وشركات النقل والأسعار من نسج النسخة التجريبية،
   ولا تمثّل أي منشأة فعلية في سلطنة عُمان.
   ============================================================ */
window.KX = window.KX || {};
KX.seed = (function () {
  const SEED_VERSION = 'v1';
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
    if (force) KX.repo.reset();

    /* ---------- الإعدادات المالية ---------- */
    await KX.repo.insert('settings', { key: 'finance', value: KX.config.finance });
    await KX.repo.insert('settings', { key: 'company', value: {
      legal_name: 'كسّارة إكسبرس للتجارة (نسخة تجريبية)',
      cr_number: '0000000', vat_number: 'OM0000000000000',
      address: 'عبري — محافظة الظاهرة، سلطنة عُمان',
      bank_name: 'بنك تجريبي', iban: 'OM00 0000 0000 0000 0000 0000'
    }});

    /* ---------- فئات المواد ---------- */
    const cats = await KX.repo.insertMany('material_categories', [
      { code: 'AGG',  name: 'ركام وحصى',    sort: 1, icon: '🪨' },
      { code: 'SAND', name: 'رمال',          sort: 2, icon: '⏳' },
      { code: 'BASE', name: 'طبقات الأساس',  sort: 3, icon: '🛣️' },
      { code: 'FILL', name: 'مواد الردم',    sort: 4, icon: '⛰️' },
      { code: 'STON', name: 'أحجار وجلاميد', sort: 5, icon: '🧱' }
    ]);
    const C = {}; cats.forEach((c) => { C[c.code] = c.id; });

    /* ---------- المواد ---------- */
    const materials = await KX.repo.insertMany('materials', [
      { category_id: C.AGG,  code: 'AGG20', name: 'بحص 3/4 (20 مم)',      unit: 'ton', description: 'ركام خشن للخرسانة والأساسات', density: 1.55, is_active: true },
      { category_id: C.AGG,  code: 'AGG10', name: 'بحص 3/8 (10 مم)',      unit: 'ton', description: 'ركام ناعم للخرسانة والبلوك', density: 1.50, is_active: true },
      { category_id: C.AGG,  code: 'DUST',  name: 'غبار الكسارة (ناعم)',  unit: 'ton', description: 'يُستخدم في البلوك والتسويات', density: 1.60, is_active: true },
      { category_id: C.SAND, name: 'رمل مغسول',        code: 'SNDW', unit: 'ton', description: 'رمل مغسول لأعمال الخرسانة والبياض', density: 1.45, is_active: true },
      { category_id: C.SAND, name: 'رمل ردم (دفان)',   code: 'SNDF', unit: 'ton', description: 'للردم والتسوية حول الأساسات', density: 1.40, is_active: true },
      { category_id: C.BASE, name: 'طبقة أساس (سبيس)', code: 'BASE', unit: 'ton', description: 'Base course مطابق للمواصفات العامة للطرق', density: 1.85, is_active: true },
      { category_id: C.BASE, name: 'طبقة تحت الأساس (سب بيس)', code: 'SUBB', unit: 'ton', description: 'Sub-base للطرق والساحات', density: 1.80, is_active: true },
      { category_id: C.FILL, name: 'مواد ردم مخلوطة',  code: 'MIXF', unit: 'ton', description: 'ردم عام لرفع المناسيب', density: 1.70, is_active: true },
      { category_id: C.STON, name: 'جلاميد (حجر كبير)', code: 'BOUL', unit: 'ton', description: 'حماية المجاري والجدران الاستنادية', density: 1.65, is_active: true },
      { category_id: C.STON, name: 'حجر بناء مكسّر',    code: 'RUBB', unit: 'ton', description: 'للجدران الاستنادية والأسوار', density: 1.60, is_active: true }
    ]);
    const M = {}; materials.forEach((m) => { M[m.code] = m.id; });

    /* ---------- مناطق التوصيل (بداية التشغيل: الظاهرة) ---------- */
    const zones = await KX.repo.insertMany('delivery_zones', [
      { code: 'IBR-C', name: 'عبري — المركز',        wilayat: 'عبري',  governorate: 'الظاهرة', radius_km: 15, center: { lat: 23.2257, lng: 56.5158 }, is_active: true },
      { code: 'IBR-O', name: 'عبري — الأطراف',       wilayat: 'عبري',  governorate: 'الظاهرة', radius_km: 40, center: { lat: 23.2600, lng: 56.4600 }, is_active: true },
      { code: 'DHK',   name: 'ضنك',                   wilayat: 'ضنك',   governorate: 'الظاهرة', radius_km: 30, center: { lat: 23.5486, lng: 56.2647 }, is_active: true },
      { code: 'YNQ',   name: 'ينقل',                  wilayat: 'ينقل',  governorate: 'الظاهرة', radius_km: 30, center: { lat: 23.5872, lng: 56.5397 }, is_active: true },
      { code: 'OUT',   name: 'خارج المحافظة (بالطلب)', wilayat: '—',    governorate: 'أخرى',    radius_km: 200, center: { lat: 23.4000, lng: 56.5000 }, is_active: false }
    ]);
    const Z = {}; zones.forEach((z) => { Z[z.code] = z.id; });

    /* ---------- أنواع الشاحنات ---------- */
    const truckTypes = await KX.repo.insertMany('truck_types', [
      { code: 'TIP12', name: 'قلاب 12 طن',        capacity_tons: 12, axles: 2, is_active: true },
      { code: 'TIP25', name: 'قلاب 25 طن',        capacity_tons: 25, axles: 4, is_active: true },
      { code: 'TRL30', name: 'تريلة قلاب 30 طن',  capacity_tons: 30, axles: 6, is_active: true },
      { code: 'TRL40', name: 'تريلة قلاب 40 طن',  capacity_tons: 40, axles: 6, is_active: true }
    ]);
    const T = {}; truckTypes.forEach((t) => { T[t.code] = t.id; });

    /* ---------- المستخدمون ---------- */
    const users = await KX.repo.insertMany('users', [
      { name: 'إدارة المنصة',        phone: '96899000001', role: 'admin',       account_status: 'active', email: 'admin@kassara-express.om' },
      { name: 'سالم الحارثي (عمليات)', phone: '96899000002', role: 'ops',        account_status: 'active' },
      { name: 'أحمد بن سعيد',        phone: '96890000001', role: 'customer',    account_status: 'active' },
      { name: 'شركة البناء الحديث',  phone: '96890000002', role: 'customer',    account_status: 'active' },
      { name: 'خالد المنذري (مقاول)', phone: '96890000003', role: 'customer',   account_status: 'active' },
      { name: 'كسارة وادي الظاهرة',  phone: '96891000001', role: 'supplier',    account_status: 'active' },
      { name: 'كسارة عبري للركام',   phone: '96891000002', role: 'supplier',    account_status: 'active' },
      { name: 'مصنع رمال الظاهرة',   phone: '96891000003', role: 'supplier',    account_status: 'active' },
      { name: 'نقليات الظاهرة',      phone: '96892000001', role: 'transporter', account_status: 'active' },
      { name: 'شركة عبري للنقل الثقيل', phone: '96892000002', role: 'transporter', account_status: 'active' },
      { name: 'سيف البلوشي (سائق)',  phone: '96893000001', role: 'driver',      account_status: 'active' },
      { name: 'ماجد الكعبي (سائق)',  phone: '96893000002', role: 'driver',      account_status: 'active' },
      { name: 'يوسف الشامسي (سائق)', phone: '96893000003', role: 'driver',      account_status: 'active' }
    ]);
    const byPhone = {}; users.forEach((u) => { byPhone[u.phone] = u; });

    /* ---------- ملفات العملاء ---------- */
    const customers = await KX.repo.insertMany('customer_profiles', [
      { user_id: byPhone['96890000001'].id, name: 'أحمد بن سعيد', phone: '96890000001',
        customer_type: 'individual', credit_approved: false, credit_limit: 0, credit_used: 0,
        total_orders: 0, total_spent: 0 },
      { user_id: byPhone['96890000002'].id, name: 'شركة البناء الحديث', phone: '96890000002',
        customer_type: 'company', company_name: 'شركة البناء الحديث ش.م.م', cr_number: '1234567',
        vat_number: 'OM1100000000001', credit_approved: true, credit_limit: 5000.000, credit_used: 0,
        total_orders: 0, total_spent: 0 },
      { user_id: byPhone['96890000003'].id, name: 'خالد المنذري', phone: '96890000003',
        customer_type: 'contractor', company_name: 'مؤسسة المنذري للمقاولات', cr_number: '7654321',
        credit_approved: true, credit_limit: 2000.000, credit_used: 0, total_orders: 0, total_spent: 0 }
    ]);
    const CU = {}; customers.forEach((c) => { CU[c.phone] = c; });

    /* ---------- مواقع المشاريع ---------- */
    const locations = await KX.repo.insertMany('locations', [
      { customer_id: CU['96890000001'].id, label: 'منزل العائلة — حي الظاهر',
        zone_id: Z['IBR-C'], coords: { lat: 23.2290, lng: 56.5170 },
        address: 'عبري، حي الظاهر، بجانب مسجد الحي', contact_name: 'أحمد', contact_phone: '96890000001', is_default: true },
      { customer_id: CU['96890000002'].id, label: 'مشروع فيلات العقر (12 وحدة)',
        zone_id: Z['IBR-O'], coords: { lat: 23.2650, lng: 56.4720 },
        address: 'عبري، العقر، مخطط الفيلات', contact_name: 'م. فهد', contact_phone: '96890000012', is_default: true },
      { customer_id: CU['96890000002'].id, label: 'مستودع الشركة — الصناعية',
        zone_id: Z['IBR-C'], coords: { lat: 23.2100, lng: 56.5400 },
        address: 'عبري، المنطقة الصناعية، قطعة 44', contact_name: 'مسؤول المخزن', contact_phone: '96890000013', is_default: false },
      { customer_id: CU['96890000003'].id, label: 'طريق ربط داخلي — ضنك',
        zone_id: Z.DHK, coords: { lat: 23.5510, lng: 56.2700 },
        address: 'ضنك، طريق ربط قرية العراقي', contact_name: 'خالد', contact_phone: '96890000003', is_default: true }
    ]);

    /* ---------- الموردون (كسارات) ---------- */
    const suppliers = await KX.repo.insertMany('suppliers', [
      { user_id: byPhone['96891000001'].id, name: 'كسارة وادي الظاهرة', code: 'SUP-WD',
        cr_number: '2001001', phone: '96891000001', wilayat: 'عبري', governorate: 'الظاهرة',
        location: { lat: 23.1850, lng: 56.4400 }, address: 'وادي الظاهرة — طريق عبري/ضنك',
        loading_capacity_tons_day: 1200, working_hours: '6:00 ص — 6:00 م',
        rating: 4.6, is_approved: true, is_active: true },
      { user_id: byPhone['96891000002'].id, name: 'كسارة عبري للركام', code: 'SUP-IBR',
        cr_number: '2001002', phone: '96891000002', wilayat: 'عبري', governorate: 'الظاهرة',
        location: { lat: 23.2900, lng: 56.5600 }, address: 'شمال عبري — بعد دوار الصناعية',
        loading_capacity_tons_day: 900, working_hours: '6:00 ص — 8:00 م',
        rating: 4.3, is_approved: true, is_active: true },
      { user_id: byPhone['96891000003'].id, name: 'مصنع رمال الظاهرة', code: 'SUP-SND',
        cr_number: '2001003', phone: '96891000003', wilayat: 'ينقل', governorate: 'الظاهرة',
        location: { lat: 23.5600, lng: 56.5100 }, address: 'ينقل — طريق المحضة',
        loading_capacity_tons_day: 600, working_hours: '7:00 ص — 5:00 م',
        rating: 4.1, is_approved: true, is_active: true }
    ]);
    const S = {}; suppliers.forEach((s) => { S[s.code] = s; });

    /* ---------- أسعار الموردين (الأسعار تجريبية) ---------- */
    const priceRows = [
      /* كسارة وادي الظاهرة */
      { s: 'SUP-WD',  m: 'AGG20', p: 2.100, min: 10, max: 600, avail: 400,
        tiers: [{ min_qty: 100, price_per_ton: 1.950 }, { min_qty: 300, price_per_ton: 1.850 }] },
      { s: 'SUP-WD',  m: 'AGG10', p: 2.250, min: 10, max: 500, avail: 300, tiers: [{ min_qty: 100, price_per_ton: 2.100 }] },
      { s: 'SUP-WD',  m: 'BASE',  p: 1.450, min: 25, max: 1000, avail: 800,
        tiers: [{ min_qty: 200, price_per_ton: 1.350 }, { min_qty: 500, price_per_ton: 1.250 }] },
      { s: 'SUP-WD',  m: 'SUBB',  p: 1.200, min: 25, max: 1000, avail: 700, tiers: [{ min_qty: 300, price_per_ton: 1.100 }] },
      { s: 'SUP-WD',  m: 'DUST',  p: 1.100, min: 12, max: 400, avail: 250, tiers: [] },
      /* كسارة عبري للركام */
      { s: 'SUP-IBR', m: 'AGG20', p: 2.050, min: 12, max: 500, avail: 350, tiers: [{ min_qty: 150, price_per_ton: 1.900 }] },
      { s: 'SUP-IBR', m: 'AGG10', p: 2.200, min: 12, max: 400, avail: 250, tiers: [] },
      { s: 'SUP-IBR', m: 'BASE',  p: 1.500, min: 25, max: 900, avail: 600, tiers: [{ min_qty: 250, price_per_ton: 1.380 }] },
      { s: 'SUP-IBR', m: 'BOUL',  p: 1.800, min: 25, max: 300, avail: 200, tiers: [] },
      { s: 'SUP-IBR', m: 'RUBB',  p: 1.700, min: 25, max: 300, avail: 180, tiers: [] },
      { s: 'SUP-IBR', m: 'MIXF',  p: 0.950, min: 25, max: 1200, avail: 900, tiers: [{ min_qty: 400, price_per_ton: 0.850 }] },
      /* مصنع رمال الظاهرة */
      { s: 'SUP-SND', m: 'SNDW',  p: 2.400, min: 12, max: 400, avail: 300, tiers: [{ min_qty: 100, price_per_ton: 2.250 }] },
      { s: 'SUP-SND', m: 'SNDF',  p: 1.150, min: 12, max: 800, avail: 500, tiers: [{ min_qty: 200, price_per_ton: 1.050 }] },
      { s: 'SUP-SND', m: 'DUST',  p: 1.050, min: 12, max: 300, avail: 200, tiers: [] }
    ];
    for (const r of priceRows) {
      await KX.repo.insert('supplier_prices', {
        supplier_id: S[r.s].id, material_id: M[r.m],
        price_per_ton: r.p, currency: 'OMR',
        min_qty_tons: r.min, max_qty_tons: r.max,
        available_tons_per_day: r.avail, tiers: r.tiers,
        valid_from: daysAgo(30), valid_to: null,
        customer_id: null, is_active: true
      });
    }
    /* سعر خاص لعميل معتمد */
    await KX.repo.insert('supplier_prices', {
      supplier_id: S['SUP-WD'].id, material_id: M.BASE, price_per_ton: 1.200,
      currency: 'OMR', min_qty_tons: 50, max_qty_tons: 2000, available_tons_per_day: 800,
      tiers: [], valid_from: daysAgo(10), valid_to: null,
      customer_id: CU['96890000002'].id, is_active: true, note: 'سعر تعاقدي لشركة البناء الحديث'
    });

    /* ---------- شركات النقل ---------- */
    const carriers = await KX.repo.insertMany('transport_companies', [
      { user_id: byPhone['96892000001'].id, name: 'نقليات الظاهرة', code: 'TRP-DHR',
        cr_number: '3001001', phone: '96892000001', wilayat: 'عبري', governorate: 'الظاهرة',
        service_zones: [Z['IBR-C'], Z['IBR-O'], Z.DHK, Z.YNQ],
        rating: 4.5, is_approved: true, is_active: true },
      { user_id: byPhone['96892000002'].id, name: 'شركة عبري للنقل الثقيل', code: 'TRP-IBR',
        cr_number: '3001002', phone: '96892000002', wilayat: 'عبري', governorate: 'الظاهرة',
        service_zones: [Z['IBR-C'], Z['IBR-O']],
        rating: 4.2, is_approved: true, is_active: true }
    ]);
    const TR = {}; carriers.forEach((c) => { TR[c.code] = c; });

    /* ---------- الشاحنات ---------- */
    const trucks = await KX.repo.insertMany('trucks', [
      { transporter_id: TR['TRP-DHR'].id, truck_type_id: T.TIP25, plate_no: '1 د ح 4521', make: 'Volvo FMX', year: 2021, capacity_tons: 25, is_available: true },
      { transporter_id: TR['TRP-DHR'].id, truck_type_id: T.TIP25, plate_no: '5 ر س 8830', make: 'MAN TGS',   year: 2020, capacity_tons: 25, is_available: true },
      { transporter_id: TR['TRP-DHR'].id, truck_type_id: T.TRL30, plate_no: '3 ب ن 1177', make: 'Scania R',  year: 2022, capacity_tons: 30, is_available: true },
      { transporter_id: TR['TRP-IBR'].id, truck_type_id: T.TIP12, plate_no: '7 ك م 2093', make: 'Isuzu FVZ', year: 2019, capacity_tons: 12, is_available: true },
      { transporter_id: TR['TRP-IBR'].id, truck_type_id: T.TRL40, plate_no: '2 ع ط 6644', make: 'Mercedes Actros', year: 2023, capacity_tons: 40, is_available: true }
    ]);

    /* ---------- السائقون ---------- */
    const drivers = await KX.repo.insertMany('drivers', [
      { user_id: byPhone['96893000001'].id, transporter_id: TR['TRP-DHR'].id, name: 'سيف البلوشي',
        phone: '96893000001', license_no: 'DL-118254', license_expiry: iso('2028-04-30'),
        default_truck_id: trucks[0].id, is_active: true },
      { user_id: byPhone['96893000002'].id, transporter_id: TR['TRP-DHR'].id, name: 'ماجد الكعبي',
        phone: '96893000002', license_no: 'DL-227741', license_expiry: iso('2027-11-15'),
        default_truck_id: trucks[2].id, is_active: true },
      { user_id: byPhone['96893000003'].id, transporter_id: TR['TRP-IBR'].id, name: 'يوسف الشامسي',
        phone: '96893000003', license_no: 'DL-330192', license_expiry: iso('2029-01-20'),
        default_truck_id: trucks[4].id, is_active: true }
    ]);

    /* ---------- تعرفة النقل (لكل منطقة ونوع شاحنة) ---------- */
    const rateTable = [
      ['IBR-C', 'TIP12',  9.000, 0.000], ['IBR-C', 'TIP25', 15.000, 0.000],
      ['IBR-C', 'TRL30', 18.000, 0.000], ['IBR-C', 'TRL40', 23.000, 0.000],
      ['IBR-O', 'TIP12', 12.000, 0.150], ['IBR-O', 'TIP25', 19.000, 0.200],
      ['IBR-O', 'TRL30', 23.000, 0.250], ['IBR-O', 'TRL40', 29.000, 0.300],
      ['DHK',   'TIP12', 18.000, 0.200], ['DHK',   'TIP25', 28.000, 0.250],
      ['DHK',   'TRL30', 34.000, 0.300], ['DHK',   'TRL40', 42.000, 0.350],
      ['YNQ',   'TIP12', 20.000, 0.200], ['YNQ',   'TIP25', 31.000, 0.250],
      ['YNQ',   'TRL30', 37.000, 0.300], ['YNQ',   'TRL40', 46.000, 0.350]
    ];
    for (const [z, t, perTrip, perKm] of rateTable) {
      await KX.repo.insert('transport_rates', {
        zone_id: Z[z], truck_type_id: T[t], transporter_id: null,
        price_per_trip: perTrip, price_per_km: perKm,
        valid_from: daysAgo(30), valid_to: null, is_active: true
      });
    }

    /* ---------- كوبونات ---------- */
    await KX.repo.insertMany('coupons', [
      { code: 'WELCOME10', description: 'خصم ترحيبي 10% للطلب الأول', discount_type: 'percent',
        discount_value: 10, max_discount: 15.000, min_order_value: 50.000,
        valid_from: daysAgo(15), valid_to: U().addDays(U().nowISO(), 60),
        max_uses: 200, used_count: 12, customer_id: null, is_active: true },
      { code: 'BASE5', description: 'خصم 5 ر.ع. على طلبات طبقة الأساس', discount_type: 'fixed',
        discount_value: 5.000, max_discount: 5.000, min_order_value: 100.000,
        valid_from: daysAgo(10), valid_to: U().addDays(U().nowISO(), 30),
        max_uses: 100, used_count: 3, customer_id: null, is_active: true }
    ]);

    KX.store.ls('kx:seed_version', SEED_VERSION);

    /* ---------- طلبات تاريخية لتغذية لوحة المؤشرات ---------- */
    await seedHistoricalOrders({ CU: CU, S: S, TR: TR, T: T, Z: Z, M: M,
                                 locations: locations, trucks: trucks, drivers: drivers });
    return true;
  }

  /* طلبات سابقة بحالات مختلفة — لتظهر التقارير والمؤشرات ببيانات واقعية */
  async function seedHistoricalOrders(ref) {
    const plan = [
      { cust: '96890000002', site: 1, sup: 'SUP-WD',  mat: 'BASE',  tons: 150, truck: 'TRL30', zone: 'IBR-O', status: 'delivered',  age: 21 },
      { cust: '96890000002', site: 1, sup: 'SUP-WD',  mat: 'AGG20', tons: 75,  truck: 'TIP25', zone: 'IBR-O', status: 'delivered',  age: 17 },
      { cust: '96890000001', site: 0, sup: 'SUP-IBR', mat: 'MIXF',  tons: 50,  truck: 'TIP25', zone: 'IBR-C', status: 'delivered',  age: 14 },
      { cust: '96890000003', site: 3, sup: 'SUP-WD',  mat: 'SUBB',  tons: 200, truck: 'TRL30', zone: 'DHK',   status: 'delivered',  age: 11 },
      { cust: '96890000002', site: 2, sup: 'SUP-SND', mat: 'SNDW',  tons: 36,  truck: 'TIP12', zone: 'IBR-C', status: 'delivered',  age: 8 },
      { cust: '96890000003', site: 3, sup: 'SUP-IBR', mat: 'BASE',  tons: 120, truck: 'TRL40', zone: 'DHK',   status: 'in_transit', age: 2 },
      { cust: '96890000001', site: 0, sup: 'SUP-IBR', mat: 'AGG10', tons: 25,  truck: 'TIP25', zone: 'IBR-C', status: 'paid',       age: 1 },
      { cust: '96890000002', site: 1, sup: 'SUP-WD',  mat: 'DUST',  tons: 24,  truck: 'TIP12', zone: 'IBR-O', status: 'ready_for_payment', age: 1 },
      { cust: '96890000003', site: 3, sup: 'SUP-SND', mat: 'SNDF',  tons: 60,  truck: 'TIP25', zone: 'DHK',   status: 'cancelled',  age: 5 }
    ];
    let seq = 100;
    for (const p of plan) {
      const cust = ref.CU[p.cust];
      const site = ref.locations[p.site];
      const q = await KX.pricing.quote({
        supplier_id: ref.S[p.sup].id, material_id: ref.M[p.mat],
        quantity: p.tons, unit: 'ton', truck_type_id: ref.T[p.truck],
        zone_id: ref.Z[p.zone], site: site.coords, customer_id: cust.id
      });
      if (!q.ok && !q.quantities) continue;
      seq++;
      const createdAt = daysAgo(p.age);
      const paid = ['paid', 'preparing', 'loading', 'in_transit', 'arrived', 'delivered'].indexOf(p.status) !== -1;
      const order = await KX.repo.insert('orders', {
        order_no: 'KX-' + new Date(createdAt).getFullYear() + '-' + String(seq).padStart(6, '0'),
        customer_id: cust.id, site_id: site.id,
        supplier_id: ref.S[p.sup].id, transporter_id: ref.TR['TRP-DHR'].id,
        zone_id: ref.Z[p.zone], truck_id: ref.T[p.truck],
        status: p.status, scheduled_at: U().addDays(createdAt, 1),
        tons: q.quantities.tons, trips_planned: q.quantities.trips,
        trips_done: p.status === 'delivered' ? q.quantities.trips : 0,
        price_snapshot: q,
        material_cost: q.lines.material_cost, transport_cost: q.lines.transport_cost,
        platform_fee: q.lines.platform_fee, discount: q.lines.discount,
        vat: q.lines.vat, total: q.totals.total,
        amount_paid: paid ? q.totals.total : 0, amount_refunded: 0, waiting_fees: 0,
        delivery_otp: String(Math.floor(1000 + Math.random() * 9000)),
        created_at: createdAt, updated_at: createdAt,
        delivered_at: p.status === 'delivered' ? U().addDays(createdAt, 1) : null,
        history: [{ at: createdAt, status: 'draft', note: 'بيانات تجريبية' },
                  { at: U().addDays(createdAt, 0.5), status: p.status, note: 'بيانات تجريبية' }]
      });
      await KX.repo.insert('order_items', {
        order_id: order.id, material_id: ref.M[p.mat], material_name: q.inputs.material_name,
        unit: 'ton', quantity: p.tons, tons: q.quantities.tons,
        unit_price_per_ton: q.lines.unit_price_per_ton, line_total: q.lines.material_cost
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
          comment: 'التوصيل في الموعد والكمية مطابقة.', created_at: order.delivered_at
        });
        await KX.repo.update('customer_profiles', cust.id, {
          total_orders: Number(cust.total_orders || 0) + 1,
          total_spent: U().round(Number(cust.total_spent || 0) + Number(order.total), 3)
        });
        cust.total_orders = Number(cust.total_orders || 0) + 1;
        cust.total_spent = U().round(Number(cust.total_spent || 0) + Number(order.total), 3);
      }
      if (p.status === 'in_transit') {
        const trips = await KX.trips.createForOrder(order, { transporter_id: ref.TR['TRP-DHR'].id, truck_id: ref.trucks[2].id });
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
