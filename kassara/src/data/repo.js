/* واجهة البيانات الموحّدة — كل منطق الأعمال يمرّ من هنا فقط */
window.KX = window.KX || {};
KX.repo = (function () {
  function driver() {
    return KX.config.data.driver === 'supabase' ? KX.driverSupabase : KX.driverLocal;
  }
  const list        = (t, o)    => driver().list(t, o);
  const get         = (t, id)   => driver().get(t, id);
  const insert      = (t, o)    => driver().insert(t, o);
  const insertMany  = (t, a)    => driver().insertMany(t, a);
  const update      = (t, id, p)=> driver().update(t, id, p);
  const softDelete  = (t, id)   => driver().softDelete(t, id);
  const hardDelete  = (t, id)   => driver().hardDelete(t, id);
  const count       = (t, w)    => driver().count(t, w);
  const tx          = (fn)      => driver().tx(fn);
  const reset       = ()        => driver().reset();

  /* أول سجل مطابق */
  async function first(table, where, order) {
    const rows = await list(table, { where, order, limit: 1 });
    return rows[0] || null;
  }
  /* ربط سجلات بمفتاح خارجي: يعيد Map للبحث السريع */
  async function mapBy(table, key) {
    const rows = await list(table, {});
    const m = {};
    rows.forEach((r) => { m[r[key || 'id']] = r; });
    return m;
  }
  /* قراءة إعداد من جدول الإعدادات مع الرجوع لقيمة config الافتراضية */
  async function setting(key, fallback) {
    const row = await first('settings', { key: key });
    return row ? row.value : fallback;
  }
  async function setSetting(key, value) {
    const row = await first('settings', { key: key });
    if (row) return update('settings', row.id, { value: value });
    return insert('settings', { key: key, value: value });
  }
  return { list, get, insert, insertMany, update, softDelete, hardDelete,
           count, tx, reset, first, mapBy, setting, setSetting };
})();
