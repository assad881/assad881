/* صفحات الدخول والتسجيل */
window.KX = window.KX || {};
KX.viewsAuth = (function () {
  const e = (s) => KX.util.esc(s);
  const L = () => KX.layout;
  let pendingPhone = null;

  async function login() {
    const demoUsers = KX.config.demo.enabled
      ? await KX.repo.list('users', { where: { account_status: 'active' } }) : [];
    const grouped = KX.util.groupBy(demoUsers, 'role');
    const demoBox = KX.config.demo.enabled
      ? '<div class="card mt"><h4>حسابات العرض التجريبية</h4>' +
        '<p class="muted" style="font-size:.84rem">اضغط أي حساب للدخول مباشرة — رمز التحقق دائمًا <b>' +
        e(KX.config.demo.otpCode) + '</b></p>' +
        Object.keys(grouped).map(function (r) {
          return '<div style="margin-bottom:10px"><div class="sidebar__group" style="padding:4px 0">' +
            e(KX.schema.ROLES[r] || r) + '</div><div class="row gap-sm">' +
            grouped[r].map((u) => '<button class="btn btn--ghost btn--sm" data-demo="' + e(u.phone) + '">' +
              e(u.name) + '</button>').join('') + '</div></div>';
        }).join('') + '</div>'
      : '';

    L().renderPublic('<div class="container--narrow">' +
      '<div class="card card--pad-lg">' +
        '<h1>تسجيل الدخول</h1>' +
        '<p>أدخل رقم هاتفك العُماني ويصلك رمز تحقق.</p>' +
        '<form id="phone-form">' +
          KX.ui.field({ name: 'phone', label: 'رقم الهاتف', required: true,
                        placeholder: '9xxxxxxx', inputmode: 'tel', hint: 'مثال: 90000001 أو 96890000001' }) +
          '<button class="btn btn--primary btn--block btn--lg" type="submit">إرسال رمز التحقق</button>' +
        '</form>' +
        '<div id="otp-area"></div>' +
      '</div>' + demoBox + '</div>');

    document.getElementById('phone-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const phone = KX.ui.formValues(ev.target).phone;
      try { await requestOtp(phone); }
      catch (err) { KX.util.toast(err.message, 'error'); }
    };
    KX.util.on(document, 'click', '[data-demo]', function (ev, el) {
      requestOtp(el.dataset.demo).catch((err) => KX.util.toast(err.message, 'error'));
    });
  }

  async function requestOtp(phone) {
    const r = await KX.auth.sendOtp(phone);
    pendingPhone = r.phone;
    const area = document.getElementById('otp-area');
    area.innerHTML = '<hr class="divider">' +
      (r.demo_code ? KX.ui.alert('رمز التحقق التجريبي: <b style="font-size:1.1rem">' + e(r.demo_code) + '</b>', 'info', '🔐') : '') +
      '<p>أُرسل الرمز إلى <b>' + e(KX.util.fmtPhone(r.phone)) + '</b></p>' +
      '<form id="otp-form">' +
      KX.ui.field({ name: 'code', label: 'رمز التحقق', required: true,
                    cls: 'otp-input', inputmode: 'numeric', placeholder: '••••',
                    value: r.demo_code || '' }) +
      '<button class="btn btn--primary btn--block btn--lg" type="submit">دخول</button>' +
      '<button class="btn btn--ghost btn--block" type="button" id="resend" style="margin-top:8px">تغيير الرقم</button>' +
      '</form>';
    area.querySelector('#resend').onclick = () => login();
    area.querySelector('#otp-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const code = KX.ui.formValues(ev.target).code;
      try {
        const res = await KX.auth.verifyOtp(pendingPhone, code);
        if (res.needsRegistration) { KX.router.go('/register'); return; }
        KX.util.toast('أهلًا ' + res.session.name, 'success');
        KX.router.go(KX.auth.homeFor(res.session.role));
      } catch (err) { KX.util.toast(err.message, 'error'); }
    };
    area.querySelector('input[name=code]').focus();
  }

  function register() {
    const phone = pendingPhone || '';
    L().renderPublic('<div class="container--narrow"><div class="card card--pad-lg">' +
      '<h1>إنشاء حساب جديد</h1>' +
      '<p>أكمل بياناتك لبدء الطلب. الحقول المعلّمة بـ <b class="req">*</b> مطلوبة.</p>' +
      '<form id="reg-form">' +
        KX.ui.field({ name: 'name', label: 'الاسم الكامل', required: true }) +
        KX.ui.field({ name: 'phone', label: 'رقم الهاتف', required: true, value: phone,
                      inputmode: 'tel', disabled: !!phone }) +
        KX.ui.field({ name: 'customer_type', label: 'نوع الحساب', type: 'select', required: true,
          options: Object.keys(KX.schema.CUSTOMER_TYPES).map((k) =>
            ({ value: k, label: KX.schema.CUSTOMER_TYPES[k] })) }) +
        '<div id="company-fields" style="display:none">' +
          KX.ui.field({ name: 'company_name', label: 'اسم الشركة / المؤسسة' }) +
          '<div class="field-row">' +
            KX.ui.field({ name: 'cr_number', label: 'رقم السجل التجاري' }) +
            KX.ui.field({ name: 'vat_number', label: 'الرقم الضريبي' }) +
          '</div></div>' +
        KX.ui.field({ name: 'email', label: 'البريد الإلكتروني (اختياري)', type: 'email' }) +
        '<label class="checkbox mb"><input type="checkbox" name="agree"> ' +
        'أوافق على <a href="#/terms">الشروط والأحكام</a> و<a href="#/privacy">سياسة الخصوصية</a></label>' +
        '<button class="btn btn--primary btn--block btn--lg" type="submit">إنشاء الحساب</button>' +
      '</form></div></div>');

    const typeSel = document.querySelector('select[name=customer_type]');
    const toggle = () => {
      document.getElementById('company-fields').style.display =
        typeSel.value === 'individual' ? 'none' : 'block';
    };
    typeSel.onchange = toggle; toggle();

    document.getElementById('reg-form').onsubmit = async function (ev) {
      ev.preventDefault();
      const v = KX.ui.formValues(ev.target);
      if (phone) v.phone = phone;
      if (!v.agree) { KX.util.toast('يجب الموافقة على الشروط والأحكام', 'error'); return; }
      try {
        const res = await KX.auth.register(v);
        KX.util.toast('تم إنشاء حسابك بنجاح', 'success');
        KX.router.go(KX.auth.homeFor(res.session.role));
      } catch (err) { KX.util.toast(err.message, 'error'); }
    };
  }

  function logout() {
    KX.auth.logout();
    KX.util.toast('تم تسجيل الخروج');
    KX.router.go('/');
  }
  return { login, register, logout };
})();
