/* الصفحات العامة */
window.KX = window.KX || {};
KX.viewsPublic = (function () {
  const e = (s) => KX.util.esc(s);
  const L = () => KX.layout;
  const b = () => KX.config.brand;

  function home() {
    const hero =
      '<section class="hero"><div class="container">' +
        '<span class="badge badge--orange" style="margin-bottom:14px">التشغيل التجريبي — ' + e(b().launchArea) + '</span>' +
        '<h1>' + e(b().tagline) + '</h1>' +
        '<p>اطلب البحص والرمل وطبقات الأساس من كسارات معتمدة، واحصل على سعر شامل التوريد والنقل ' +
        'حتى موقع مشروعك — مع متابعة كاملة لكل شاحنة حتى التسليم.</p>' +
        '<div class="btn-group" style="margin-top:22px">' +
          '<a href="#/customer/new" class="btn btn--primary btn--lg">اطلب الآن</a>' +
          '<a href="#/how" class="btn btn--ghost btn--lg" style="color:#fff;border-color:rgba(255,255,255,.3)">كيف تعمل الخدمة؟</a>' +
        '</div>' +
      '</div></section>';

    const features =
      '<section class="container" style="margin-top:-36px;position:relative;z-index:2">' +
      '<div class="grid grid-4">' +
      [['🧾', 'سعر واضح قبل الطلب', 'سعر المادة والنقل والرسوم والضريبة — كل بند مفصّل قبل أن تدفع أي مبلغ.'],
       ['🏭', 'كسارات معتمدة', 'موردون مسجّلون بأسعار وكميات محدّثة وطاقة تحميل معلنة.'],
       ['🚚', 'نقل منظّم', 'شاحنات مرخّصة، عدد الرحلات محسوب تلقائيًا حسب حمولة الشاحنة.'],
       ['📍', 'متابعة حتى الموقع', 'حالة كل شاحنة لحظة بلحظة، وتأكيد استلام برمز خاص بك.']]
      .map((f) => '<div class="feature"><div class="feature__icon">' + f[0] + '</div>' +
                  '<h3>' + e(f[1]) + '</h3><p>' + e(f[2]) + '</p></div>').join('') +
      '</div></section>';

    const how =
      '<section class="container mt-lg"><h2 class="center">أربع خطوات فقط</h2>' +
      '<div class="grid grid-4 mt">' +
      [['1', 'حدّد موقعك والمادة', 'اختر موقع المشروع والمادة والكمية بالطن أو بعدد الشاحنات.'],
       ['2', 'اعتمد السعر', 'يظهر لك السعر التفصيلي وعدد الرحلات وموعد التوصيل.'],
       ['3', 'ادفع مقدمًا', 'دفع إلكتروني أو تحويل بنكي — لا يوجد دفع عند الاستلام.'],
       ['4', 'استلم وأكّد', 'تابع الشاحنة حتى موقعك، وأكّد الاستلام برمز أو توقيع.']]
      .map((s) => '<div class="card"><div class="row gap-sm" style="align-items:center;margin-bottom:8px">' +
                  '<span class="step-num">' + s[0] + '</span><h4 style="margin:0">' + e(s[1]) + '</h4></div>' +
                  '<p style="margin:0">' + e(s[2]) + '</p></div>').join('') +
      '</div></section>';

    const cta =
      '<section class="container mt-lg"><div class="card card--pad-lg" ' +
      'style="background:var(--navy-900);color:#fff;text-align:center">' +
      '<h2 style="color:#fff">هل تملك كسارة أو شاحنات؟</h2>' +
      '<p style="color:#bdd0e0;max-width:560px;margin:0 auto 18px">' +
      'انضم كمورد أو ناقل معتمد، واستقبل طلبات جاهزة مع تسوية مالية منظّمة وتقارير لكل كمية ورحلة.</p>' +
      '<a href="#/contact" class="btn btn--primary">تقديم طلب انضمام</a></div></section>';

    L().renderPublic(hero + features + how + cta, { raw: true });
  }

  function how() {
    const steps = [
      ['تسجيل الدخول', 'أدخل رقم هاتفك العُماني، ويصلك رمز تحقق من أربعة أرقام.'],
      ['تحديد موقع المشروع', 'احفظ أكثر من موقع، وحدّده من الخريطة أو بمشاركة الإحداثيات.'],
      ['اختيار المادة والكمية', 'اختر المادة والمورد، وأدخل الكمية بالطن أو بعدد الشاحنات.'],
      ['حساب الرحلات', 'يحسب النظام عدد الرحلات تلقائيًا حسب حمولة نوع الشاحنة المختار.'],
      ['عرض السعر', 'يظهر سعر المادة والنقل ورسوم المنصة والضريبة والخصم والسعر النهائي.'],
      ['المراجعة والتأكيد', 'تتأكد الإدارة والمورد من توفّر المادة والناقل قبل إتاحة الدفع.'],
      ['الدفع المسبق', 'دفع إلكتروني كامل، أو تحويل بنكي مع رفع الإيصال، أو عربون معتمد.'],
      ['أمر التحميل', 'يصدر أمر التحميل للمورد، ويُعيَّن الناقل والسائق والشاحنة.'],
      ['تذكرة الميزان', 'يسجّل المورد الكمية الفعلية ويرفع تذكرة الميزان أو أمر التحميل.'],
      ['التوصيل والمتابعة', 'تتابع حالة كل شاحنة: التوجه، التحميل، الانطلاق، الوصول.'],
      ['تأكيد الاستلام', 'تؤكد الاستلام برمز OTP أو توقيع إلكتروني على جهاز السائق.'],
      ['الفاتورة والتقييم', 'تصدر الفاتورة النهائية، ويمكنك تقييم المورد والناقل أو تقديم شكوى.']
    ];
    L().renderPublic(
      '<h1>كيف تعمل الخدمة؟</h1>' +
      '<p>المنصة لا تملك كسارة ولا شاحنات. دورها تنظيم الطلب والتسعير والدفع والتوريد والنقل بين ' +
      'العميل والمورد والناقل، مقابل رسوم وعمولة معلنة لكل طلب.</p>' +
      '<div class="card mt">' + KX.ui.timeline(steps.map((s, i) => ({
        title: (i + 1) + '. ' + s[0], meta: s[1], done: true
      }))) + '</div>');
  }

  async function suppliers() {
    const rows = await KX.repo.list('suppliers', { where: { is_approved: true, is_active: true } });
    const mats = await KX.repo.list('materials', {});
    const prices = await KX.repo.list('supplier_prices', { where: { is_active: true, customer_id: null } });
    const byMat = {}; mats.forEach((m) => { byMat[m.id] = m; });

    const cards = rows.map(function (s) {
      const list = prices.filter((p) => p.supplier_id === s.id);
      const items = list.slice(0, 5).map((p) =>
        '<div class="row row--between" style="font-size:.86rem;padding:4px 0;border-bottom:1px solid var(--border)">' +
        '<span>' + e((byMat[p.material_id] || {}).name || '—') + '</span>' +
        '<b class="mono">' + e(KX.util.money(p.price_per_ton)) + ' / طن</b></div>').join('');
      return '<div class="card"><div class="row row--between">' +
        '<h3 style="margin:0">' + e(s.name) + '</h3>' + KX.ui.badge('⭐ ' + s.rating, 'orange') + '</div>' +
        '<p class="muted" style="margin:6px 0 10px">' + e(s.address) + ' — ' + e(s.wilayat) + '</p>' +
        '<div class="row gap-sm mb">' + KX.ui.badge('طاقة تحميل ' + KX.util.fmtNum(s.loading_capacity_tons_day) + ' طن/يوم') +
        KX.ui.badge(s.working_hours) + '</div>' + items +
        '<div class="mt"><a href="#/customer/new" class="btn btn--primary btn--sm btn--block">اطلب من هذا المورد</a></div>' +
        '</div>';
    }).join('');

    L().renderPublic('<h1>الموردون المعتمدون</h1>' +
      '<p>كسارات ومصانع مسجّلة في المنصة داخل محافظة الظاهرة. الأسعار المعروضة لكل طن قبل النقل والرسوم.</p>' +
      KX.ui.alert('الموردون والأسعار في هذه النسخة بيانات تجريبية لا تمثّل منشآت حقيقية.', 'warn', '⚠️') +
      '<div class="grid grid-3 mt">' + cards + '</div>');
  }

  function faq() {
    const items = [
      ['هل يمكنني الدفع عند الاستلام؟',
       'لا. جميع الطلبات تُدفع مقدمًا: دفع إلكتروني كامل، أو تحويل بنكي مع رفع الإيصال، أو عربون معتمد ثم سداد المتبقي قبل إصدار أمر التحميل. الشراء الآجل متاح للعملاء التجاريين المعتمدين فقط ضمن حد ائتماني.'],
      ['كيف يُحسب عدد الشاحنات؟',
       'يقسم النظام الكمية المطلوبة على حمولة نوع الشاحنة الذي اخترته ويقرّب لأعلى. مثال: 60 طنًا بشاحنة 25 طن = 3 رحلات.'],
      ['هل السعر شامل النقل؟',
       'نعم. السعر النهائي يشمل سعر المادة + تكلفة النقل حتى موقعك + رسوم المنصة + الضريبة، ناقص أي خصم. وكل بند يظهر لك قبل الاعتماد.'],
      ['ماذا لو اختلفت الكمية الفعلية عن المطلوبة؟',
       'يسجّل المورد الكمية الفعلية ويرفع تذكرة الميزان. أي فرق يُراجَع قبل إصدار الفاتورة النهائية، ولا يُغيَّر سعر الطلب بعد الدفع إلا بموافقتك.'],
      ['هل يمكنني إلغاء الطلب؟',
       'نعم قبل اعتماد التحميل، وحسب مرحلة الطلب تُحدَّد نسبة الاسترداد. بعد بدء التحميل ينتقل الطلب إلى المراجعة ولا يُلغى تلقائيًا.'],
      ['ما مناطق التغطية؟',
       'التشغيل التجريبي في ولاية عبري ومحافظة الظاهرة (عبري، ضنك، ينقل)، مع توسّع لاحق لبقية المحافظات.'],
      ['كيف أتابع الشاحنة؟',
       'من صفحة الطلب تظهر حالة كل رحلة: متوجّه للكسارة، وصل، جاري التحميل، في الطريق، وصل الموقع، تم التسليم.'],
      ['كيف أؤكد الاستلام؟',
       'يصلك رمز استلام من أربعة أرقام. أعطه للسائق عند التفريغ، أو وقّع إلكترونيًا على جهازه.']
    ];
    L().renderPublic('<h1>الأسئلة الشائعة</h1>' +
      '<div class="stack mt">' + items.map((q) =>
        '<div class="card"><h3>' + e(q[0]) + '</h3><p style="margin:0">' + e(q[1]) + '</p></div>').join('') + '</div>');
  }

  function terms() {
    L().renderPublic('<div class="container--narrow"><h1>الشروط والأحكام</h1>' +
      KX.ui.alert('هذه صيغة تشغيلية أولية للنسخة التجريبية، وتحتاج مراجعة قانونية قبل الإطلاق الفعلي.', 'warn', '⚠️') +
      section('1. طبيعة الخدمة', [
        'المنصة وسيط إلكتروني ينظّم الطلب والتسعير والدفع بين العميل والمورد والناقل.',
        'المنصة لا تملك كسارات ولا شاحنات، ولا تُعد بائعًا مباشرًا للمواد.',
        'تحصل المنصة على رسوم خدمة وعمولة معلنة عن كل طلب.']) +
      section('2. الطلب والتسعير', [
        'يُعد السعر المعروض ساريًا للمدة المحددة في عرض السعر فقط.',
        'تظهر جميع مكوّنات السعر للعميل قبل اعتماد الطلب.',
        'لا يُغيَّر سعر الطلب بعد الدفع إلا بموافقة العميل الصريحة.']) +
      section('3. الدفع', [
        'لا يوجد دفع عند الاستلام.',
        'الدفع مقدمًا إلكترونيًا أو بتحويل بنكي مع رفع الإيصال والتحقق منه.',
        'الشراء الآجل متاح للعملاء المعتمدين فقط ضمن حد ائتماني تحدده الإدارة.']) +
      section('4. التوريد والنقل', [
        'يلتزم المورد بالكمية والمواصفة المتفق عليها ويسجّل الكمية الفعلية بتذكرة ميزان.',
        'يلتزم الناقل بموعد التحميل والتوصيل وبالشاحنة المصرّح بها.',
        'رسوم الانتظار لا تُحتسب إلا بعد اعتمادها من إدارة المنصة.']) +
      section('5. المسؤولية', [
        'العميل مسؤول عن صحة الموقع وإمكانية وصول الشاحنة إليه.',
        'تُوثَّق أي ملاحظة على الكمية أو الجودة قبل تأكيد الاستلام.',
        'تلتزم المنصة بحفظ سجل تدقيق كامل لكل عملية مالية أو تعديل على الطلب.']) +
      '</div>');
  }

  function privacy() {
    L().renderPublic('<div class="container--narrow"><h1>سياسة الخصوصية</h1>' +
      section('البيانات التي نجمعها', [
        'رقم الهاتف والاسم ونوع الحساب وبيانات السجل التجاري للشركات.',
        'مواقع المشاريع والإحداثيات التي تحفظها بنفسك.',
        'بيانات الطلبات والمدفوعات والفواتير.']) +
      section('ما لا نخزّنه', [
        'لا نخزّن أرقام البطاقات البنكية أو رموزها داخل قاعدة بيانات التطبيق إطلاقًا.',
        'تُعالج المدفوعات لدى مزوّد دفع مرخّص، ونحتفظ بمرجع العملية وآخر أربعة أرقام فقط.']) +
      section('الاستخدام والمشاركة', [
        'تُشارك بيانات الطلب مع المورد والناقل المعنيين بالقدر اللازم لتنفيذ التوصيل فقط.',
        'لا تُباع البيانات لأي طرف ثالث.',
        'تُستخدم البيانات المجمّعة لتحسين الخدمة وإعداد تقارير الأداء.']) +
      section('حقوقك', [
        'الاطلاع على بياناتك وتصحيحها من الملف الشخصي.',
        'طلب حذف الحساب — مع الاحتفاظ بالسجلات المالية للمدة النظامية.',
        'إيقاف الإشعارات التسويقية دون التأثير على إشعارات الطلبات.']) +
      '</div>');
  }

  function refundPolicy() {
    const rows = KX.config.refundPolicy.map((p) => ({
      stage: KX.orders.label(p.upToStatus),
      pct: (p.refundPercent * 100).toFixed(0) + '%',
      note: p.note
    }));
    L().renderPublic('<div class="container--narrow"><h1>سياسة الإلغاء والاسترداد</h1>' +
      '<p>تُحدَّد نسبة الاسترداد حسب المرحلة التي وصل إليها الطلب وقت الإلغاء.</p>' +
      KX.ui.table([
        { key: 'stage', label: 'حتى مرحلة' },
        { key: 'pct', label: 'نسبة الاسترداد', num: true },
        { key: 'note', label: 'الملاحظة' }
      ], rows) +
      section('قواعد عامة', [
        'الإلغاء متاح ذاتيًا قبل اعتماد التحميل.',
        'بعد بدء التحميل ينتقل الطلب إلى «تحت المراجعة» ولا يُلغى تلقائيًا.',
        'يُسجَّل لكل استرداد: السبب والمبلغ والمرحلة ومن اعتمده.',
        'يصل العميل إشعار عند كل تحديث على طلب الاسترداد.',
        'تُحفظ جميع العمليات المالية في سجل تدقيق دائم لا يُحذف.']) +
      '</div>');
  }

  function contact() {
    L().renderPublic('<div class="container--narrow"><h1>تواصل معنا</h1>' +
      '<div class="grid grid-2 mb">' +
        '<div class="card"><h4>الدعم</h4><p style="margin:0">' + e(b().supportPhone) + '<br>' + e(b().supportEmail) + '</p></div>' +
        '<div class="card"><h4>المقر</h4><p style="margin:0">عبري — محافظة الظاهرة<br>سلطنة عُمان</p></div>' +
      '</div>' +
      '<div class="card" id="contact-card">' +
        '<h3>أرسل رسالة أو اطلب الانضمام كمورد/ناقل</h3>' +
        '<form id="contact-form">' +
        '<div class="field-row">' +
          KX.ui.field({ name: 'name', label: 'الاسم', required: true }) +
          KX.ui.field({ name: 'phone', label: 'رقم الهاتف', required: true, placeholder: '9xxxxxxx', inputmode: 'tel' }) +
        '</div>' +
        KX.ui.field({ name: 'subject', label: 'الموضوع', type: 'select', required: true, options: [
          { value: 'inquiry', label: 'استفسار عام' },
          { value: 'supplier', label: 'انضمام كمورد / كسارة' },
          { value: 'transporter', label: 'انضمام كشركة نقل' },
          { value: 'complaint', label: 'شكوى' }
        ]}) +
        KX.ui.field({ name: 'message', label: 'الرسالة', type: 'textarea', rows: 4, required: true }) +
        '<button class="btn btn--primary" type="submit">إرسال</button></form></div></div>');

    document.getElementById('contact-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      const errs = KX.util.validate(v, {
        name: { required: true, minLength: 3 },
        phone: { required: true, type: 'phone' },
        message: { required: true, minLength: 10 }
      });
      if (Object.keys(errs).length) { KX.util.toast(Object.values(errs)[0], 'error'); return; }
      await KX.repo.insert('complaints', {
        source: 'contact_form', subject: v.subject, name: v.name,
        phone: KX.util.normalizePhone(v.phone), message: v.message,
        status: 'open', order_id: null, customer_id: null
      });
      KX.util.toast('وصلتنا رسالتك وسنتواصل معك قريبًا', 'success');
      ev.target.reset();
    };
  }

  function section(title, points) {
    return '<div class="card mb"><h3>' + e(title) + '</h3><ul style="margin:0;padding-inline-start:20px;color:var(--text-2)">' +
      points.map((p) => '<li style="margin-bottom:6px">' + e(p) + '</li>').join('') + '</ul></div>';
  }

  function notFound() {
    L().renderPublic('<div class="empty"><div class="empty__icon">🔍</div>' +
      '<h2>الصفحة غير موجودة</h2><p>تحقق من الرابط أو عد إلى الصفحة الرئيسية.</p>' +
      '<a href="#/" class="btn btn--primary">الرئيسية</a></div>');
  }

  return { home, how, suppliers, faq, terms, privacy, refundPolicy, contact, notFound };
})();
