/* التسويات والعمولات — مستحقات المورد والناقل وإيراد المنصة */
window.KX = window.KX || {};
KX.settlements = (function () {
  const U = () => KX.util;

  /* تُبنى عند تأكيد التسليم، من لقطة السعر المحفوظة في الطلب */
  async function buildForOrder(order) {
    const exists = await KX.repo.list('settlements', { where: { order_id: order.id } });
    if (exists.length) return exists;

    const snap = order.price_snapshot || {};
    const internal = snap.internal || {};
    const waiting = Number(order.waiting_fees || 0);

    return KX.repo.tx(async function () {
      const rows = [];
      rows.push(await KX.repo.insert('settlements', {
        order_id: order.id, order_no: order.order_no,
        party_type: 'supplier', party_id: order.supplier_id,
        gross_amount: order.material_cost,
        commission: internal.supplier_commission || 0,
        net_payable: internal.supplier_payable || U().round(order.material_cost, 3),
        status: 'pending', due_date: U().addDays(U().nowISO(), 14)
      }));
      rows.push(await KX.repo.insert('settlements', {
        order_id: order.id, order_no: order.order_no,
        party_type: 'transporter', party_id: order.transporter_id,
        gross_amount: U().round(Number(order.transport_cost) + waiting, 3),
        commission: internal.transporter_commission || 0,
        net_payable: U().round(Number(internal.transporter_payable || order.transport_cost) + waiting, 3),
        status: 'pending', due_date: U().addDays(U().nowISO(), 14)
      }));
      await KX.repo.insert('commissions', {
        order_id: order.id, order_no: order.order_no,
        platform_fee: order.platform_fee,
        supplier_commission: internal.supplier_commission || 0,
        transporter_commission: internal.transporter_commission || 0,
        total_revenue: internal.platform_revenue || order.platform_fee,
        quantity: order.quantity,
        unit: order.unit,
        margin_per_unit: internal.margin_per_unit || 0,
        recognized_at: U().nowISO()
      });
      await KX.audit.log('settlement.build', 'orders', order.id, { count: rows.length });
      return rows;
    });
  }

  async function markPaid(settlementId, ref) {
    const s = await KX.repo.update('settlements', settlementId,
      { status: 'paid', paid_at: U().nowISO(), payment_ref: ref || null });
    await KX.audit.log('settlement.pay', 'settlements', settlementId, { amount: s.net_payable, ref: ref });
    return s;
  }

  async function forParty(type, id) {
    return KX.repo.list('settlements', { where: { party_type: type, party_id: id },
                                         order: { field: 'created_at', dir: 'desc' } });
  }
  async function summary() {
    const rows = await KX.repo.list('settlements', {});
    const pending = rows.filter((r) => r.status === 'pending');
    return {
      pending_supplier:    U().round(U().sum(pending.filter((r) => r.party_type === 'supplier'),    (r) => +r.net_payable), 3),
      pending_transporter: U().round(U().sum(pending.filter((r) => r.party_type === 'transporter'), (r) => +r.net_payable), 3),
      paid_total:          U().round(U().sum(rows.filter((r) => r.status === 'paid'), (r) => +r.net_payable), 3)
    };
  }
  return { buildForOrder, markPaid, forParty, summary };
})();
