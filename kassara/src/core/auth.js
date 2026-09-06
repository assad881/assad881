/* ============================================================
   المصادقة والصلاحيات — دخول برقم الهاتف ورمز OTP
   في النسخة التجريبية يُولَّد الرمز محليًا ويُعرض على الشاشة.
   في الإنتاج: يُستبدل sendOtp بمزوّد SMS، ويُدار الدخول عبر Supabase Auth + RLS.
   ============================================================ */
window.KX = window.KX || {};
KX.auth = (function () {
  const U = () => KX.util;
  const SESSION_KEY = 'kx:session';
  const OTP_TTL_MIN = 10;
  const MAX_ATTEMPTS = 5;

  /* ---------- الجلسة ---------- */
  function restore() {
    const s = KX.store.ls(SESSION_KEY);
    if (s && s.expires_at && s.expires_at > U().nowISO()) {
      KX.store.set('session', s);
      return s;
    }
    KX.store.ls(SESSION_KEY, null);
    return null;
  }
  const session = () => KX.store.get('session');
  const isLoggedIn = () => !!session();
  const role = () => (session() || {}).role || 'guest';

  /* ---------- الصلاحيات (RBAC) ---------- */
  function can(permission) {
    const perms = KX.schema.PERMISSIONS[role()] || [];
    if (perms.indexOf('*') !== -1) return true;
    if (perms.indexOf(permission) !== -1) return true;
    /* دعم النمط العام: orders.read يغطي orders.read.own */
    return perms.some((p) => permission.indexOf(p + '.') === 0);
  }
  function requireRole(roles) {
    const r = role();
    return (Array.isArray(roles) ? roles : [roles]).indexOf(r) !== -1;
  }

  /* ---------- إرسال رمز التحقق ---------- */
  async function sendOtp(phoneRaw) {
    const phone = U().normalizePhone(phoneRaw);
    if (!U().isValidPhone(phone)) throw new Error('رقم هاتف عُماني غير صحيح');

    /* حد المحاولات: 3 رموز خلال 10 دقائق للرقم الواحد */
    const recent = await KX.repo.list('otp_codes', {
      where: { phone: phone, created_at: { gte: new Date(Date.now() - OTP_TTL_MIN * 60000).toISOString() } }
    });
    if (recent.length >= 3) throw new Error('تجاوزت عدد المحاولات المسموح. حاول بعد 10 دقائق.');

    const code = KX.config.demo.enabled
      ? KX.config.demo.otpCode
      : String(Math.floor(100000 + Math.random() * 900000));

    await KX.repo.insert('otp_codes', {
      phone: phone, code: code, attempts: 0, used: false,
      expires_at: new Date(Date.now() + OTP_TTL_MIN * 60000).toISOString()
    });
    /* في الإنتاج: KX.notify.channels.sms.send(...) */
    return { phone: phone, demo_code: KX.config.demo.enabled ? code : null };
  }

  /* ---------- التحقق وتسجيل الدخول ---------- */
  async function verifyOtp(phoneRaw, code) {
    const phone = U().normalizePhone(phoneRaw);
    const rows = await KX.repo.list('otp_codes', { where: { phone: phone, used: false } });
    const active = U().sortBy(rows, 'created_at', 'desc')[0];
    if (!active) throw new Error('لم يُرسل رمز لهذا الرقم');
    if (active.expires_at < U().nowISO()) throw new Error('انتهت صلاحية الرمز، أعد الإرسال');
    if (Number(active.attempts) >= MAX_ATTEMPTS) throw new Error('تجاوزت محاولات الإدخال');
    if (String(active.code) !== String(code).trim()) {
      await KX.repo.update('otp_codes', active.id, { attempts: Number(active.attempts) + 1 });
      throw new Error('رمز التحقق غير صحيح');
    }
    await KX.repo.update('otp_codes', active.id, { used: true });

    let user = await KX.repo.first('users', { phone: phone });
    if (!user) return { needsRegistration: true, phone: phone };
    if (user.account_status === 'suspended') throw new Error('هذا الحساب موقوف. تواصل مع الدعم.');
    if (user.account_status === 'pending') throw new Error('حسابك بانتظار اعتماد الإدارة.');

    return openSession(user);
  }

  async function openSession(user) {
    const s = {
      user_id: user.id, name: user.name, phone: user.phone, role: user.role,
      customer_id: null, supplier_id: null, transporter_id: null, driver_id: null,
      expires_at: U().addDays(U().nowISO(), 30),
      started_at: U().nowISO()
    };
    /* ربط الجلسة بملف الطرف حسب الدور */
    if (user.role === 'customer') {
      const p = await KX.repo.first('customer_profiles', { user_id: user.id });
      s.customer_id = p ? p.id : null; s.customer = p;
    } else if (user.role === 'supplier') {
      const p = await KX.repo.first('suppliers', { user_id: user.id });
      s.supplier_id = p ? p.id : null; s.supplier = p;
    } else if (user.role === 'transporter') {
      const p = await KX.repo.first('transport_companies', { user_id: user.id });
      s.transporter_id = p ? p.id : null; s.transporter = p;
    } else if (user.role === 'driver') {
      const p = await KX.repo.first('drivers', { user_id: user.id });
      s.driver_id = p ? p.id : null; s.driver = p;
    }
    KX.store.ls(SESSION_KEY, s);
    KX.store.set('session', s);
    await KX.repo.update('users', user.id, { last_login_at: U().nowISO() });
    await KX.audit.log('auth.login', 'users', user.id, { role: user.role });
    return { session: s, user: user };
  }

  /* ---------- التسجيل ---------- */
  async function register(data) {
    const phone = U().normalizePhone(data.phone);
    const exists = await KX.repo.first('users', { phone: phone });
    if (exists) throw new Error('هذا الرقم مسجّل مسبقًا');

    const errors = U().validate(data, {
      name:  { required: true, minLength: 3, message: 'الاسم مطلوب (3 أحرف على الأقل)' },
      phone: { required: true, type: 'phone' }
    });
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);

    const user = await KX.repo.insert('users', {
      name: data.name.trim(), phone: phone, email: data.email || null,
      role: 'customer',                      // التسجيل الذاتي للعملاء فقط
      account_status: 'active',
      lang: 'ar'
    });
    await KX.repo.insert('customer_profiles', {
      user_id: user.id, name: user.name, phone: phone,
      customer_type: data.customer_type || 'individual',
      company_name: data.company_name || null,
      cr_number: data.cr_number || null,
      vat_number: data.vat_number || null,
      credit_approved: false, credit_limit: 0, credit_used: 0,
      total_orders: 0, total_spent: 0
    });
    await KX.audit.log('auth.register', 'users', user.id, { type: data.customer_type });
    return openSession(user);
  }

  function logout() {
    const s = session();
    if (s) KX.audit.log('auth.logout', 'users', s.user_id, {});
    KX.store.ls(SESSION_KEY, null);
    KX.store.set('session', null);
  }

  /* تحديث بيانات الجلسة بعد تعديل الملف الشخصي */
  async function refreshSession() {
    const s = session();
    if (!s) return null;
    const user = await KX.repo.get('users', s.user_id);
    return user ? openSession(user) : (logout(), null);
  }

  /* الصفحة الافتراضية لكل دور بعد الدخول */
  function homeFor(r) {
    return ({
      customer: '/customer', supplier: '/supplier', transporter: '/transporter',
      driver: '/driver', admin: '/admin', ops: '/admin'
    })[r || role()] || '/';
  }

  return { restore, session, isLoggedIn, role, can, requireRole,
           sendOtp, verifyOtp, register, logout, refreshSession, openSession, homeFor };
})();
