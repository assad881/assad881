/* مشغّل Supabase / PostgreSQL — نفس واجهة المشغّل المحلي.
   للتفعيل: ضع url و anonKey في config، وأضف سكربت supabase-js في index.html،
   ثم غيّر KX.config.data.driver إلى 'supabase'. لا يتغيّر أي منطق أعمال. */
window.KX = window.KX || {};
KX.driverSupabase = (function () {
  let client = null;
  function sb() {
    if (client) return client;
    const c = KX.config.data.supabase;
    if (!window.supabase || !c.url || !c.anonKey) {
      throw new Error('Supabase غير مهيّأ — راجع config/app.config.js');
    }
    client = window.supabase.createClient(c.url, c.anonKey);
    return client;
  }
  function applyWhere(q, where) {
    Object.keys(where || {}).forEach(function (k) {
      const c = where[k];
      if (c === null) { q = q.is(k, null); return; }          // IS NULL في PostgREST
      if (typeof c !== 'object') { q = q.eq(k, c); return; }
      if ('in'   in c) q = q.in(k, c.in);
      if ('neq'  in c) q = q.neq(k, c.neq);
      if ('gte'  in c) q = q.gte(k, c.gte);
      if ('lte'  in c) q = q.lte(k, c.lte);
      if ('gt'   in c) q = q.gt(k, c.gt);
      if ('lt'   in c) q = q.lt(k, c.lt);
      if ('like' in c) q = q.ilike(k, '%' + c.like + '%');
    });
    return q;
  }
  async function list(table, opts) {
    opts = opts || {};
    let q = sb().from(table).select('*');
    q = applyWhere(q, opts.where);
    if (!opts.includeDeleted) q = q.neq('status_flag', 'deleted');
    if (opts.order) q = q.order(opts.order.field, { ascending: opts.order.dir !== 'desc' });
    if (opts.limit) q = q.range(opts.offset || 0, (opts.offset || 0) + opts.limit - 1);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  }
  async function get(table, id) {
    const { data, error } = await sb().from(table).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  async function insert(table, obj) {
    const { data, error } = await sb().from(table).insert(obj).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  async function insertMany(table, arr) {
    const { data, error } = await sb().from(table).insert(arr).select();
    if (error) throw new Error(error.message);
    return data;
  }
  async function update(table, id, patch) {
    const { data, error } = await sb().from(table)
      .update(Object.assign({}, patch, { updated_at: new Date().toISOString() }))
      .eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const softDelete = (table, id) => update(table, id, { status_flag: 'deleted' });
  async function hardDelete(table, id) {
    const meta = KX.schema.TABLES[table] || {};
    if (meta.immutable) throw new Error('لا يُسمح بحذف سجلات ' + (meta.label || table));
    const { error } = await sb().from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }
  async function count(table, where) {
    let q = sb().from(table).select('id', { count: 'exact', head: true }).neq('status_flag', 'deleted');
    q = applyWhere(q, where);
    const { count: c, error } = await q;
    if (error) throw new Error(error.message);
    return c || 0;
  }
  /* المعاملات المالية تُنفَّذ عبر دوال RPC في قاعدة البيانات (انظر db/004_functions.sql) */
  async function tx(fn) { return fn(); }
  async function rpc(name, args) {
    const { data, error } = await sb().rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  }
  function reset() { throw new Error('غير مسموح على قاعدة بيانات الإنتاج'); }

  return { list, get, insert, insertMany, update, softDelete, hardDelete, count, tx, rpc, reset };
})();
