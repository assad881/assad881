/* رحلات النقل — تعيين الناقل والسائق والشاحنة وتتبّع الحالة */
window.KX = window.KX || {};
KX.trips = (function () {
  const U = () => KX.util;

  const TRIP_STATUS = {
    assigned:      { label: 'تم التعيين',        tone: 'muted' },
    heading_plant: { label: 'متوجّه للكسارة',    tone: 'info' },
    at_plant:      { label: 'وصل الكسارة',       tone: 'info' },
    loading:       { label: 'جاري التحميل',      tone: 'info' },
    loaded:        { label: 'اكتمل التحميل',     tone: 'ok' },
    en_route:      { label: 'في الطريق للعميل',  tone: 'info' },
    at_site:       { label: 'وصل موقع العميل',   tone: 'info' },
    delivered:     { label: 'تم التفريغ والتسليم', tone: 'ok' },
    cancelled:     { label: 'ملغاة',             tone: 'danger' }
  };
  const FLOW = ['assigned', 'heading_plant', 'at_plant', 'loading', 'loaded',
                'en_route', 'at_site', 'delivered'];

  function nextStatus(s) {
    const i = FLOW.indexOf(s);
    return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
  }

  /* إنشاء رحلات الطلب حسب عدد الشاحنات المطلوبة */
  async function createForOrder(order, opts) {
    const out = [];
    for (let i = 0; i < order.trips_planned; i++) {
      out.push(await KX.repo.insert('trips', {
        order_id: order.id, order_no: order.order_no,
        seq: i + 1,
        transporter_id: opts.transporter_id || order.transporter_id || null,
        driver_id: null, truck_id: opts.truck_id || order.truck_id || null,
        supplier_id: order.supplier_id, site_id: order.site_id,
        status: 'assigned',
        planned_tons: U().round(order.tons / order.trips_planned, 3),
        actual_tons: null,
        waiting_minutes: 0, waiting_fee: 0, waiting_approved: false,
        photos: [], timeline: [{ at: U().nowISO(), status: 'assigned' }]
      }));
    }
    await KX.audit.log('trips.create', 'orders', order.id, { count: out.length });
    return out;
  }

  async function assignDriver(tripId, driverId, truckId) {
    const t = await KX.repo.update('trips', tripId, { driver_id: driverId, truck_id: truckId });
    await KX.audit.log('trip.assign_driver', 'trips', tripId, { driver_id: driverId, truck_id: truckId });
    const d = await KX.repo.get('drivers', driverId);
    if (d) await KX.notify.push(d.user_id, 'مهمة نقل جديدة',
      'رحلة رقم ' + t.seq + ' للطلب ' + t.order_no, '#/driver');
    return t;
  }

  async function updateStatus(tripId, status, extra) {
    const t = await KX.repo.get('trips', tripId);
    if (!t) throw new Error('الرحلة غير موجودة');
    const timeline = (t.timeline || []).concat([{ at: U().nowISO(), status: status }]);
    const patch = Object.assign({ status: status, timeline: timeline }, extra || {});
    const updated = await KX.repo.update('trips', tripId, patch);
    await KX.audit.log('trip.status', 'trips', tripId, { from: t.status, to: status });

    /* مزامنة حالة الطلب مع تقدّم الرحلات */
    const order = await KX.repo.get('orders', t.order_id);
    if (order) {
      const all = await KX.repo.list('trips', { where: { order_id: order.id } });
      const anyLoading = all.some((x) => x.status === 'loading' || x.status === 'at_plant');
      const anyMoving  = all.some((x) => x.status === 'en_route' || x.status === 'loaded');
      const anyAtSite  = all.some((x) => x.status === 'at_site');
      const allDone    = all.every((x) => x.status === 'delivered' || x.status === 'cancelled');
      const role = 'admin';
      try {
        if (order.status === 'preparing' && anyLoading)
          await KX.orders.transition(order.id, 'loading', { role: role, note: 'بدأ تحميل الشاحنات' });
        else if (order.status === 'loading' && anyMoving)
          await KX.orders.transition(order.id, 'in_transit', { role: role, note: 'انطلقت الشاحنة' });
        else if (order.status === 'in_transit' && anyAtSite)
          await KX.orders.transition(order.id, 'arrived', { role: role, note: 'وصلت الشاحنة للموقع' });
      } catch (e) { /* انتقال غير منطبق — يُتجاهل بأمان */ }
      if (allDone && order.status === 'arrived') { /* ينتظر تأكيد العميل بـ OTP */ }
    }
    return updated;
  }

  /* تسجيل تذكرة الميزان والكمية الفعلية */
  async function recordWeightTicket(tripId, data) {
    const t = await KX.repo.get('trips', tripId);
    if (!t) throw new Error('الرحلة غير موجودة');
    const wt = await KX.repo.insert('weight_tickets', {
      trip_id: tripId, order_id: t.order_id, supplier_id: t.supplier_id,
      ticket_no: data.ticket_no, gross_tons: data.gross_tons, tare_tons: data.tare_tons,
      net_tons: U().round(Number(data.gross_tons) - Number(data.tare_tons), 3),
      image_url: data.image_url || null, recorded_at: U().nowISO()
    });
    await KX.repo.update('trips', tripId, { actual_tons: wt.net_tons, weight_ticket_id: wt.id });
    await KX.audit.log('weight_ticket.create', 'weight_tickets', wt.id, { trip_id: tripId, net: wt.net_tons });
    return wt;
  }

  /* طلب رسوم انتظار — لا تُحتسب إلا بعد اعتماد الإدارة */
  async function requestWaiting(tripId, minutes, note) {
    const fee = await KX.pricing.waitingCharge(minutes);
    await KX.repo.update('trips', tripId,
      { waiting_minutes: minutes, waiting_fee: fee, waiting_approved: false, waiting_note: note || '' });
    await KX.audit.log('trip.waiting_request', 'trips', tripId, { minutes: minutes, fee: fee });
    return fee;
  }
  async function approveWaiting(tripId, approve) {
    const t = await KX.repo.get('trips', tripId);
    await KX.repo.update('trips', tripId, { waiting_approved: !!approve });
    if (approve) {
      const order = await KX.repo.get('orders', t.order_id);
      await KX.repo.update('orders', order.id,
        { waiting_fees: U().round(Number(order.waiting_fees || 0) + Number(t.waiting_fee), 3) });
    }
    await KX.audit.log('trip.waiting_' + (approve ? 'approve' : 'reject'), 'trips', tripId, { fee: t.waiting_fee });
  }

  const forDriver      = (id) => KX.repo.list('trips', { where: { driver_id: id }, order: { field: 'created_at', dir: 'desc' } });
  const forTransporter = (id) => KX.repo.list('trips', { where: { transporter_id: id }, order: { field: 'created_at', dir: 'desc' } });
  const forOrder       = (id) => KX.repo.list('trips', { where: { order_id: id }, order: { field: 'seq' } });

  return { TRIP_STATUS, FLOW, nextStatus, createForOrder, assignDriver, updateStatus,
           recordWeightTicket, requestWaiting, approveWaiting, forDriver, forTransporter, forOrder };
})();
