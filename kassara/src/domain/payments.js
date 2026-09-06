/* ============================================================
   المدفوعات والفواتير والاستردادات
   لا يوجد دفع عند الاستلام. لا تُخزَّن بيانات البطاقات إطلاقًا.
   طبقة المزوّد مجرّدة (gateway) ليُربط مزوّد عُماني مرخّص لاحقًا.
   ============================================================ */
window.KX = window.KX || {};
KX.payments = (function () {
  const U = () => KX.util;

  const METHODS = {
    card:          'دفع إلكتروني (بطاقة)',
    bank_transfer: 'تحويل بنكي مسبق',
    deposit:       'عربون مقدّم',
    credit_terms:  'شراء آجل (عميل معتمد)'
  };

  /* ---------- طبقة بوابة الدفع ---------- */
  const gateways = {
    /* مزوّد تجريبي: لا يتصل بأي شبكة ولا يخزّن أي بيانات بطاقة */
    demo: {
      async charge(order, amount, meta) {
        await new Promise((r) => setTimeout(r, 500));
        return {
          success: true,
          provider: 'demo',
          provider_ref: 'DEMO-' + U().uid().toUpperCase().slice(-10),
          amount: amount,
          card_last4: meta && meta.last4 ? String(meta.last4).slice(-4) : null
        };
      }
    }
    /* thawani: { charge(order, amount, meta) { ... } }  ← يُضاف عند التعاقد */
  };
  const gateway = () => gateways[KX.config.payments.provider] || gateways.demo;

  /* منع تكرار الدفع: مفتاح تفرّد لكل محاولة */
  async function alreadyPaid(orderId, idempotencyKey) {
    const rows = await KX.repo.list('payments', {
      where: { order_id: orderId, idempotency_key: idempotencyKey }
    });
    return rows[0] || null;
  }

  /* ---------- تنفيذ دفعة ---------- */
  async function pay(orderId, opts) {
    const order = await KX.repo.get('orders', orderId);
    if (!order) throw new Error('الطلب غير موجود');
    if (order.status !== 'ready_for_payment' && order.status !== 'awaiting_transfer_verification')
      throw new Error('الطلب غير جاهز للدفع في حالته الحالية: ' + KX.orders.label(order.status));

    const method = opts.method;
    if (KX.config.payments.methods.indexOf(method) === -1) throw new Error('طريقة دفع غير مدعومة');
    if (method === 'cod' || KX.config.payments.codEnabled) throw new Error('الدفع عند الاستلام غير متاح');

    const due = U().round(order.total - (order.amount_paid || 0), 3);
    let amount = opts.amount !== undefined ? U().round(opts.amount, 3) : due;
    if (method === 'deposit') {
      const pct = Number(opts.depositPercent || KX.config.payments.depositPercent) / 100;
      amount = U().round(order.total * pct, 3);
    }
    if (amount <= 0) throw new Error('لا يوجد مبلغ مستحق');
    if (amount > due + 0.001) throw new Error('المبلغ يتجاوز المستحق (' + U().fmtOMR(due) + ')');

    const key = opts.idempotency_key || (orderId + ':' + method + ':' + amount);
    const dup = await alreadyPaid(orderId, key);
    if (dup) return { payment: dup, order: order, duplicate: true };

    return KX.repo.tx(async function () {
      let result = { success: true, provider: 'manual', provider_ref: null };
      let payStatus = 'captured';

      if (method === 'card') {
        result = await gateway().charge(order, amount, opts.meta);
        if (!result.success) throw new Error('فشل الدفع الإلكتروني');
      } else if (method === 'bank_transfer') {
        payStatus = 'pending_verification';       // بانتظار تحقق الإدارة من الإيصال
      } else if (method === 'credit_terms') {
        const cust = await KX.repo.get('customer_profiles', order.customer_id);
        if (!cust || !cust.credit_approved) throw new Error('الشراء الآجل غير معتمد لهذا الحساب');
        const used = Number(cust.credit_used || 0);
        if (used + amount > Number(cust.credit_limit || 0))
          throw new Error('تجاوز الحد الائتماني المعتمد');
        await KX.repo.update('customer_profiles', cust.id, { credit_used: U().round(used + amount, 3) });
      }

      const payment = await KX.repo.insert('payments', {
        order_id: orderId,
        customer_id: order.customer_id,
        method: method,
        amount: amount,
        currency: KX.config.currency.code,
        status: payStatus,
        provider: result.provider,
        provider_ref: result.provider_ref,
        card_last4: result.card_last4 || null,     // آخر 4 أرقام فقط — لا تُخزَّن البطاقة
        transfer_receipt: opts.receipt_url || null,
        transfer_bank: opts.bank || null,
        transfer_ref: opts.transfer_ref || null,
        idempotency_key: key,
        paid_at: payStatus === 'captured' ? U().nowISO() : null
      });

      let updatedOrder = order;
      if (payStatus === 'captured') {
        const paidTotal = U().round((order.amount_paid || 0) + amount, 3);
        updatedOrder = await KX.repo.update('orders', orderId, { amount_paid: paidTotal });
        if (paidTotal >= U().round(order.total, 3) - 0.001) {
          updatedOrder = await KX.orders.transition(orderId, 'paid',
            { role: 'admin', note: 'اكتمل السداد عبر ' + METHODS[method] });
        }
      } else {
        updatedOrder = await KX.orders.transition(orderId, 'awaiting_transfer_verification',
          { role: 'customer', note: 'تم رفع إيصال التحويل' });
      }
      await KX.audit.log('payment.create', 'payments', payment.id,
        { order_id: orderId, method: method, amount: amount, status: payStatus });
      return { payment: payment, order: updatedOrder };
    });
  }

  /* ---------- اعتماد أو رفض التحويل البنكي ---------- */
  async function verifyTransfer(paymentId, approve, note) {
    const p = await KX.repo.get('payments', paymentId);
    if (!p) throw new Error('الدفعة غير موجودة');
    if (p.status !== 'pending_verification') throw new Error('هذه الدفعة لا تحتاج تحققًا');
    const order = await KX.repo.get('orders', p.order_id);

    if (!approve) {
      await KX.repo.update('payments', paymentId, { status: 'rejected', verify_note: note || '' });
      await KX.orders.transition(p.order_id, 'ready_for_payment', { role: 'admin', note: 'رُفض إيصال التحويل: ' + (note || '') });
      await KX.audit.log('payment.reject', 'payments', paymentId, { note: note });
      return { approved: false };
    }
    return KX.repo.tx(async function () {
      await KX.repo.update('payments', paymentId,
        { status: 'captured', paid_at: U().nowISO(), verify_note: note || '' });
      const paidTotal = U().round((order.amount_paid || 0) + Number(p.amount), 3);
      await KX.repo.update('orders', order.id, { amount_paid: paidTotal });
      if (paidTotal >= U().round(order.total, 3) - 0.001) {
        await KX.orders.transition(order.id, 'paid', { role: 'admin', note: 'اعتُمد التحويل البنكي' });
      }
      await KX.audit.log('payment.verify', 'payments', paymentId, { amount: p.amount });
      return { approved: true };
    });
  }

  /* ---------- الاسترداد ---------- */
  async function refund(orderId, opts) {
    const order = await KX.repo.get('orders', orderId);
    if (!order) throw new Error('الطلب غير موجود');
    const paid = Number(order.amount_paid || 0);
    const already = Number(order.amount_refunded || 0);
    if (paid <= 0) throw new Error('لا توجد مبالغ مدفوعة لاستردادها');

    const pct = opts.percent !== undefined ? Number(opts.percent)
                                           : KX.orders.refundPercentFor(order.status);
    let amount = opts.amount !== undefined ? U().round(opts.amount, 3)
                                           : U().round(paid * pct, 3);
    amount = Math.min(amount, U().round(paid - already, 3));
    if (amount <= 0) throw new Error('المبلغ القابل للاسترداد صفر حسب سياسة المرحلة الحالية');

    return KX.repo.tx(async function () {
      const r = await KX.repo.insert('refunds', {
        order_id: orderId, customer_id: order.customer_id,
        amount: amount, reason: opts.reason || '',
        percent_applied: pct,
        approved_by: (KX.store.get('session') || {}).user_id,
        approved_by_name: (KX.store.get('session') || {}).name,
        status: 'processed', processed_at: U().nowISO()
      });
      const totalRefunded = U().round(already + amount, 3);
      await KX.repo.update('orders', orderId, { amount_refunded: totalRefunded });
      const full = totalRefunded >= paid - 0.001;
      await KX.orders.transition(orderId, full ? 'refunded_full' : 'refunded_partial',
        { role: 'admin', note: 'استرداد ' + U().fmtOMR(amount) + ' — ' + (opts.reason || '') });
      await KX.audit.log('refund.create', 'refunds', r.id, { order_id: orderId, amount: amount, reason: opts.reason });
      return r;
    });
  }

  /* ---------- الفواتير ---------- */
  async function issueInvoice(order) {
    const existing = await KX.repo.first('invoices', { order_id: order.id });
    if (existing) return existing;
    const seq = (await KX.repo.count('invoices')) + 1;
    const inv = await KX.repo.insert('invoices', {
      invoice_no: 'INV-' + new Date().getFullYear() + '-' + String(seq).padStart(6, '0'),
      order_id: order.id, order_no: order.order_no,
      customer_id: order.customer_id,
      issue_date: U().nowISO(),
      material_cost: order.material_cost,
      transport_cost: order.transport_cost,
      platform_fee: order.platform_fee,
      waiting_fees: order.waiting_fees || 0,
      discount: order.discount,
      vat: order.vat,
      total: U().round(Number(order.total) + Number(order.waiting_fees || 0), 3),
      amount_paid: order.amount_paid,
      currency: KX.config.currency.code,
      status: 'issued'
    });
    await KX.audit.log('invoice.issue', 'invoices', inv.id, { order_id: order.id });
    await KX.notify.push(order.customer_id, 'صدرت فاتورتك',
      'فاتورة ' + inv.invoice_no + ' للطلب ' + order.order_no, '#/customer/invoices');
    return inv;
  }

  return { METHODS, pay, verifyTransfer, refund, issueInvoice, gateways };
})();
