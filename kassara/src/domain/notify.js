/* الإشعارات — داخل التطبيق الآن، وقنوات خارجية جاهزة للربط لاحقًا */
window.KX = window.KX || {};
KX.notify = (function () {
  /* قنوات خارجية: تُفعّل بربط مزوّد فعلي دون تغيير نقاط الاستدعاء */
  const channels = {
    inapp: { enabled: true,  send: async (n) => n },
    sms:      { enabled: false, send: async () => { /* TODO: مزوّد SMS عُماني */ } },
    whatsapp: { enabled: false, send: async () => { /* TODO: WhatsApp Business API */ } },
    email:    { enabled: false, send: async () => { /* TODO: SMTP / مزوّد بريد */ } },
    push:     { enabled: false, send: async () => { /* TODO: Web Push */ } }
  };

  async function push(userId, title, body, link) {
    if (!userId) return null;
    const n = await KX.repo.insert('notifications', {
      user_id: userId, title: title, body: body, link: link || null,
      read: false, sent_at: KX.util.nowISO(), channels_sent: ['inapp']
    });
    Object.keys(channels).forEach(function (c) {
      if (c !== 'inapp' && channels[c].enabled) channels[c].send(n);
    });
    KX.store.emit('notification', n);
    return n;
  }

  /* رسائل حالة الطلب — نقطة واحدة لكل التنبيهات */
  const MESSAGES = {
    under_review:                  ['استلمنا طلبك', 'طلبك {no} قيد المراجعة، وسنبلغك فور تأكيد التوفّر.'],
    awaiting_supplier:             ['بانتظار تأكيد المورد', 'أُحيل طلبك {no} إلى المورد لتأكيد توفّر المادة.'],
    awaiting_carrier:             ['بانتظار تعيين ناقل', 'تم تأكيد المادة لطلبك {no}، ويجري تعيين الناقل.'],
    ready_for_payment:             ['طلبك جاهز للدفع', 'يمكنك الآن سداد قيمة الطلب {no} لبدء التنفيذ.'],
    awaiting_transfer_verification:['بانتظار التحقق من التحويل', 'استلمنا إيصال التحويل للطلب {no} وجارٍ التحقق.'],
    paid:                          ['تم استلام الدفع', 'تم تأكيد الدفع للطلب {no}، وسيصدر أمر التحميل.'],
    preparing:                     ['جاري التجهيز', 'صدر أمر التحميل للطلب {no}.'],
    loading:                       ['جاري التحميل', 'بدأ تحميل شاحنة طلبك {no} في الكسارة.'],
    in_transit:                    ['الشاحنة في الطريق', 'انطلقت شاحنة الطلب {no} إلى موقعك.'],
    arrived:                       ['وصلت الشاحنة', 'وصلت شاحنة الطلب {no} إلى الموقع. رمز الاستلام: {otp}'],
    delivered:                     ['تم التسليم', 'اكتمل تسليم الطلب {no}. شكرًا لثقتك.'],
    cancelled:                     ['أُلغي الطلب', 'تم إلغاء الطلب {no}.'],
    disputed:                      ['طلبك تحت المراجعة', 'فُتحت مراجعة للطلب {no} وسنتواصل معك.'],
    refunded_partial:              ['استرداد جزئي', 'تم اعتماد استرداد جزئي للطلب {no}.'],
    refunded_full:                 ['استرداد كامل', 'تم اعتماد استرداد كامل للطلب {no}.']
  };

  async function onOrderStatus(order, fromStatus) {
    const m = MESSAGES[order.status];
    if (!m) return;
    const body = m[1].replace('{no}', order.order_no).replace('{otp}', order.delivery_otp || '');
    await push(order.customer_id, m[0], body, '#/customer/orders/' + order.id);

    /* تنبيه الأطراف المعنية */
    if (order.status === 'awaiting_supplier' && order.supplier_id) {
      const s = await KX.repo.get('suppliers', order.supplier_id);
      if (s) await push(s.user_id, 'طلب جديد بانتظار تأكيدك',
        'الطلب ' + order.order_no + ' — ' + order.tons + ' طن', '#/supplier/orders');
    }
    if (order.status === 'awaiting_carrier' && order.transporter_id) {
      const t = await KX.repo.get('transport_companies', order.transporter_id);
      if (t) await push(t.user_id, 'مهمة نقل بانتظار قبولك',
        'الطلب ' + order.order_no + ' — ' + order.trips_planned + ' رحلة', '#/transporter/orders');
    }
    KX.store.emit('order:status', { order: order, from: fromStatus });
  }

  const forUser  = (userId) => KX.repo.list('notifications', { where: { user_id: userId }, order: { field: 'sent_at', dir: 'desc' } });
  const markRead = (id)     => KX.repo.update('notifications', id, { read: true });
  async function markAllRead(userId) {
    const rows = await forUser(userId);
    for (const n of rows) if (!n.read) await markRead(n.id);
  }
  /* بث جماعي من لوحة الإدارة */
  async function broadcast(role, title, body) {
    const users = await KX.repo.list('users', role ? { where: { role: role } } : {});
    for (const u of users) await push(u.id, title, body, null);
    await KX.audit.log('notification.broadcast', 'notifications', null, { role: role, count: users.length });
    return users.length;
  }

  return { push, onOrderStatus, forUser, markRead, markAllRead, broadcast, channels, MESSAGES };
})();
