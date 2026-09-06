/* سجل التدقيق — يُستدعى عند كل عملية حسّاسة ولا يُحذف أبدًا */
window.KX = window.KX || {};
KX.audit = (function () {
  async function log(action, entity, entityId, details) {
    const s = KX.store.get('session') || {};
    try {
      await KX.repo.insert('audit_logs', {
        action: action,                 // مثال: order.transition, price.update, payment.verify
        entity: entity,
        entity_id: entityId || null,
        actor_id: s.user_id || 'system',
        actor_role: s.role || 'system',
        actor_name: s.name || 'النظام',
        details: details || {},
        ip: 'local',
        at: KX.util.nowISO()
      });
    } catch (e) { console.error('audit failed', e); }
  }
  /* لقطة قبل/بعد لتتبّع التغييرات الحقلية */
  function diff(before, after) {
    const out = {};
    const keys = new Set(Object.keys(before || {}).concat(Object.keys(after || {})));
    keys.forEach(function (k) {
      if (['updated_at'].indexOf(k) !== -1) return;
      const b = before ? before[k] : undefined, a = after ? after[k] : undefined;
      if (JSON.stringify(b) !== JSON.stringify(a)) out[k] = { from: b, to: a };
    });
    return out;
  }
  return { log, diff };
})();
