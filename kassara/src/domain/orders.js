/* ============================================================
   دورة حياة الطلب — آلة حالات مع تحكّم بالصلاحيات وسجل تدقيق كامل
   ============================================================ */
window.KX = window.KX || {};
KX.orders = (function () {
  const U = () => KX.util;

  /* الحالات وترتيبها الزمني */
  const STATUS = {
    draft:                        { label: 'مسودة',                    tone: 'muted',  step: 0 },
    under_review:                 { label: 'قيد المراجعة',              tone: 'info',   step: 1 },
    awaiting_supplier:            { label: 'بانتظار تأكيد المورد',      tone: 'info',   step: 2 },
    awaiting_carrier:             { label: 'بانتظار تعيين ناقل',        tone: 'info',   step: 3 },
    ready_for_payment:            { label: 'جاهز للدفع',                tone: 'warn',   step: 4 },
    awaiting_transfer_verification:{ label: 'بانتظار التحقق من التحويل', tone: 'warn',  step: 5 },
    paid:                         { label: 'مدفوع',                     tone: 'ok',     step: 6 },
    preparing:                    { label: 'قيد التجهيز',               tone: 'info',   step: 7 },
    loading:                      { label: 'قيد التحميل',               tone: 'info',   step: 8 },
    in_transit:                   { label: 'في الطريق',                 tone: 'info',   step: 9 },
    arrived:                      { label: 'وصل إلى الموقع',            tone: 'info',   step: 10 },
    delivered:                    { label: 'تم التسليم',                tone: 'ok',     step: 11 },
    cancelled:                    { label: 'ملغي',                      tone: 'danger', step: 12 },
    disputed:                     { label: 'تحت المراجعة',              tone: 'danger', step: 12 },
    refunded_partial:             { label: 'مسترد جزئيًا',              tone: 'warn',   step: 13 },
    refunded_full:                { label: 'مسترد بالكامل',             tone: 'warn',   step: 13 }
  };

  /* الانتقالات المسموحة: من -> [{to, roles, label}] */
  const TRANSITIONS = {
    draft: [
      { to: 'under_review', roles: ['customer', 'admin', 'ops'], label: 'إرسال الطلب للمراجعة' },
      { to: 'cancelled',    roles: ['customer', 'admin'],        label: 'إلغاء المسودة' }
    ],
    under_review: [
      { to: 'awaiting_supplier', roles: ['admin', 'ops'], label: 'إحالة للمورد' },
      { to: 'cancelled',         roles: ['admin', 'ops', 'customer'], label: 'إلغاء' }
    ],
    awaiting_supplier: [
      { to: 'awaiting_carrier', roles: ['supplier', 'admin', 'ops'], label: 'تأكيد توفّر المادة' },
      { to: 'under_review',     roles: ['supplier', 'admin', 'ops'], label: 'طلب تعديل الطلب' },
      { to: 'cancelled',        roles: ['admin', 'ops', 'customer'], label: 'إلغاء' }
    ],
    awaiting_carrier: [
      { to: 'ready_for_payment', roles: ['admin', 'ops', 'transporter'], label: 'تأكيد الناقل وإتاحة الدفع' },
      { to: 'cancelled',         roles: ['admin', 'ops', 'customer'],    label: 'إلغاء' }
    ],
    ready_for_payment: [
      { to: 'paid',                           roles: ['customer', 'admin'], label: 'تم الدفع الإلكتروني' },
      { to: 'awaiting_transfer_verification', roles: ['customer', 'admin'], label: 'رفع إيصال تحويل بنكي' },
      { to: 'cancelled',                      roles: ['customer', 'admin', 'ops'], label: 'إلغاء' }
    ],
    awaiting_transfer_verification: [
      { to: 'paid',              roles: ['admin', 'ops'], label: 'اعتماد التحويل' },
      { to: 'ready_for_payment', roles: ['admin', 'ops'], label: 'رفض الإيصال' },
      { to: 'cancelled',         roles: ['admin', 'ops'], label: 'إلغاء' }
    ],
    paid: [
      { to: 'preparing', roles: ['admin', 'ops', 'supplier'], label: 'إصدار أمر التحميل' },
      { to: 'cancelled', roles: ['admin', 'ops', 'customer'], label: 'إلغاء مع استرداد' }
    ],
    preparing: [
      { to: 'loading',   roles: ['supplier', 'admin', 'ops'], label: 'بدء التحميل' },
      { to: 'cancelled', roles: ['admin', 'ops'],             label: 'إلغاء مع استرداد جزئي' }
    ],
    loading: [
      { to: 'in_transit', roles: ['driver', 'transporter', 'supplier', 'admin', 'ops'], label: 'انطلاق الشاحنة' },
      { to: 'disputed',   roles: ['admin', 'ops'], label: 'إحالة للمراجعة' }
    ],
    in_transit: [
      { to: 'arrived',  roles: ['driver', 'transporter', 'admin', 'ops'], label: 'الوصول إلى الموقع' },
      { to: 'disputed', roles: ['admin', 'ops', 'customer'], label: 'إحالة للمراجعة' }
    ],
    arrived: [
      { to: 'delivered', roles: ['customer', 'driver', 'admin', 'ops'], label: 'تأكيد الاستلام' },
      { to: 'disputed',  roles: ['admin', 'ops', 'customer'], label: 'إحالة للمراجعة' }
    ],
    delivered: [
      { to: 'disputed', roles: ['admin', 'ops', 'customer'], label: 'فتح شكوى' }
    ],
    disputed: [
      { to: 'delivered',        roles: ['admin'], label: 'إغلاق المراجعة — تم التسليم' },
      { to: 'refunded_partial', roles: ['admin'], label: 'اعتماد استرداد جزئي' },
      { to: 'refunded_full',    roles: ['admin'], label: 'اعتماد استرداد كامل' }
    ],
    cancelled: [
      { to: 'refunded_partial', roles: ['admin'], label: 'استرداد جزئي' },
      { to: 'refunded_full',    roles: ['admin'], label: 'استرداد كامل' }
    ],
    refunded_partial: [], refunded_full: []
  };

  const label = (s) => (STATUS[s] || { label: s }).label;
  const tone  = (s) => (STATUS[s] || { tone: 'muted' }).tone;

  function allowedTransitions(status, role) {
    return (TRANSITIONS[status] || []).filter((t) => t.roles.indexOf(role) !== -1);
  }
  /* الحالات التي لم يعد فيها الطلب قابلًا للإلغاء الذاتي من العميل */
  const isLocked = (s) => ['loading', 'in_transit', 'arrived', 'delivered',
                           'refunded_full', 'refunded_partial'].indexOf(s) !== -1;
  const isFinal  = (s) => ['delivered', 'cancelled', 'refunded_full', 'refunded_partial'].indexOf(s) !== -1;
  const isPaid   = (s) => STATUS[s] && STATUS[s].step >= STATUS.paid.step && s !== 'cancelled';

  /* ---------- إنشاء طلب من عرض السعر ---------- */
  async function createFromQuote(quote, ctx) {
    return KX.repo.tx(async function () {
      const seq = (await KX.repo.count('orders')) + 1;
      const order = await KX.repo.insert('orders', {
        order_no: U().orderNo(seq),
        customer_id: ctx.customer_id,
        site_id: ctx.site_id,
        supplier_id: quote.inputs.supplier_id,
        transporter_id: ctx.transporter_id || null,
        zone_id: quote.inputs.zone_id,
        truck_id: quote.inputs.truck_id,
        status: 'draft',
        scheduled_at: ctx.scheduled_at,
        notes: ctx.notes || '',
        quantity: quote.quantities.quantity,
        unit: quote.quantities.unit,
        trips_planned: quote.quantities.trips,
        trips_done: 0,
        /* لقطة السعر — لا تتغيّر بتغيّر قائمة الأسعار لاحقًا */
        price_snapshot: quote,
        material_cost: quote.lines.material_cost,
        transport_cost: quote.lines.transport_cost,
        platform_fee: quote.lines.platform_fee,
        discount: quote.lines.discount,
        coupon_code: quote.lines.coupon_code,
        vat: quote.lines.vat,
        total: quote.totals.total,
        amount_paid: 0,
        amount_refunded: 0,
        waiting_fees: 0,
        delivery_otp: String(Math.floor(1000 + Math.random() * 9000)),
        history: [{ at: U().nowISO(), status: 'draft', by: ctx.customer_id, note: 'إنشاء الطلب' }]
      });
      await KX.repo.insert('order_items', {
        order_id: order.id,
        material_id: quote.inputs.material_id,
        material_sku: quote.inputs.material_sku,
        material_name: quote.inputs.material_name_ar,
        material_name_i18n: quote.inputs.material_name_i18n || null,
        unit: quote.quantities.unit,
        order_by: quote.inputs.order_by,
        quantity: quote.quantities.quantity,
        unit_price: quote.lines.unit_price,
        line_total: quote.lines.material_cost
      });
      await KX.repo.insert('quotations', {
        order_id: order.id, customer_id: ctx.customer_id,
        payload: quote, total: quote.totals.total,
        valid_until: U().addDays(U().nowISO(), 2), accepted: false
      });
      await KX.audit.log('order.create', 'orders', order.id, { total: order.total });
      return order;
    });
  }

  /* ---------- تنفيذ انتقال حالة ---------- */
  async function transition(orderId, toStatus, opts) {
    opts = opts || {};
    const session = KX.store.get('session') || {};
    const role = opts.role || session.role;
    const order = await KX.repo.get('orders', orderId);
    if (!order) throw new Error('الطلب غير موجود');

    const allowed = allowedTransitions(order.status, role).map((t) => t.to);
    if (allowed.indexOf(toStatus) === -1) {
      throw new Error('انتقال غير مسموح: ' + label(order.status) + ' ← ' + label(toStatus) +
                      ' لدور ' + (KX.schema.ROLES[role] || role));
    }
    /* حماية: لا تحميل قبل اكتمال الدفع */
    if (['preparing', 'loading'].indexOf(toStatus) !== -1) {
      const due = U().round(order.total - (order.amount_paid || 0), 3);
      if (due > 0.001) throw new Error('لا يمكن التجهيز قبل سداد كامل المبلغ (المتبقي ' + U().fmtOMR(due) + ')');
    }
    const history = (order.history || []).concat([{
      at: U().nowISO(), status: toStatus,
      by: session.user_id || role, by_name: session.name || role,
      note: opts.note || ''
    }]);
    const patch = Object.assign({ status: toStatus, history: history }, opts.patch || {});
    if (toStatus === 'delivered') patch.delivered_at = U().nowISO();
    if (toStatus === 'cancelled') {
      patch.cancelled_at = U().nowISO();
      patch.cancel_reason = opts.note || '';
    }
    const updated = await KX.repo.update('orders', orderId, patch);
    await KX.audit.log('order.transition', 'orders', orderId,
      { from: order.status, to: toStatus, note: opts.note || '' });
    await KX.notify.onOrderStatus(updated, order.status);
    return updated;
  }

  /* ---------- حساب الاسترداد حسب مرحلة الطلب ---------- */
  function refundPercentFor(status) {
    const policy = KX.config.refundPolicy;
    const step = (STATUS[status] || {}).step || 0;
    let pct = 0;
    for (const p of policy) {
      if (step <= (STATUS[p.upToStatus] || {}).step) { pct = p.refundPercent; break; }
    }
    return pct;
  }
  function refundNoteFor(status) {
    const policy = KX.config.refundPolicy;
    const step = (STATUS[status] || {}).step || 0;
    for (const p of policy) if (step <= (STATUS[p.upToStatus] || {}).step) return p.note;
    return 'يُدرس عبر الشكاوى';
  }

  /* ---------- تأكيد الاستلام برمز OTP ---------- */
  async function confirmReceipt(orderId, code, signature) {
    const order = await KX.repo.get('orders', orderId);
    if (!order) throw new Error('الطلب غير موجود');
    if (order.status !== 'arrived') throw new Error('لم تصل الشاحنة إلى الموقع بعد');
    if (!signature && String(code) !== String(order.delivery_otp))
      throw new Error('رمز الاستلام غير صحيح');
    const updated = await transition(orderId, 'delivered', {
      note: signature ? 'تأكيد بتوقيع إلكتروني' : 'تأكيد برمز OTP',
      patch: { receipt_method: signature ? 'signature' : 'otp', receipt_signature: signature || null }
    });
    await KX.payments.issueInvoice(updated);
    await KX.settlements.buildForOrder(updated);
    return updated;
  }

  /* ---------- استعلامات مساعدة ---------- */
  async function forCustomer(customerId) {
    return KX.repo.list('orders', { where: { customer_id: customerId }, order: { field: 'created_at', dir: 'desc' } });
  }
  async function forSupplier(supplierId) {
    return KX.repo.list('orders', { where: { supplier_id: supplierId }, order: { field: 'created_at', dir: 'desc' } });
  }
  async function forTransporter(transporterId) {
    return KX.repo.list('orders', { where: { transporter_id: transporterId }, order: { field: 'created_at', dir: 'desc' } });
  }
  async function all(where) {
    return KX.repo.list('orders', { where: where, order: { field: 'created_at', dir: 'desc' } });
  }

  return { STATUS, TRANSITIONS, label, tone, allowedTransitions, isLocked, isFinal, isPaid,
           createFromQuote, transition, confirmReceipt, refundPercentFor, refundNoteFor,
           forCustomer, forSupplier, forTransporter, all };
})();
