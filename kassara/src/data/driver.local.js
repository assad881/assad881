/* مشغّل بيانات محلي (localStorage) — للنسخة التجريبية والعمل دون اتصال.
   يطابق واجهة مشغّل Supabase تمامًا حتى يمكن التبديل دون تعديل منطق الأعمال. */
window.KX = window.KX || {};
KX.driverLocal = (function () {
  const NS = 'kx:db:';
  const cache = {};

  function read(table) {
    if (cache[table]) return cache[table];
    let rows = [];
    try {
      const raw = localStorage.getItem(NS + table);
      rows = raw ? JSON.parse(raw) : [];
    } catch (e) { rows = []; }
    cache[table] = rows;
    return rows;
  }
  function write(table, rows) {
    cache[table] = rows;
    try { localStorage.setItem(NS + table, JSON.stringify(rows)); }
    catch (e) { KX.util.toast('تعذّر الحفظ: مساحة التخزين ممتلئة', 'error'); throw e; }
  }

  /* مطابقة شروط where: {field: value} أو {field: {op, value}} */
  function match(row, where) {
    if (!where) return true;
    return Object.keys(where).every(function (k) {
      const c = where[k], v = row[k];
      if (c === null || typeof c !== 'object') return v === c;
      if ('in' in c)    return c.in.indexOf(v) !== -1;
      if ('neq' in c)   return v !== c.neq;
      if ('gte' in c)   return v >= c.gte;
      if ('lte' in c)   return v <= c.lte;
      if ('gt'  in c)   return v >  c.gt;
      if ('lt'  in c)   return v <  c.lt;
      if ('like' in c)  return String(v || '').toLowerCase().indexOf(String(c.like).toLowerCase()) !== -1;
      return false;
    });
  }

  async function list(table, opts) {
    opts = opts || {};
    let rows = read(table).filter((r) => match(r, opts.where));
    if (!opts.includeDeleted) rows = rows.filter((r) => r.status_flag !== 'deleted');
    if (opts.order) rows = KX.util.sortBy(rows, opts.order.field, opts.order.dir);
    if (opts.limit) rows = rows.slice(opts.offset || 0, (opts.offset || 0) + opts.limit);
    return KX.util.clone(rows);
  }
  async function get(table, id) {
    const row = read(table).find((r) => r.id === id);
    return row ? KX.util.clone(row) : null;
  }
  async function insert(table, obj) {
    const rows = read(table);
    const rec = Object.assign({
      id: obj.id || KX.util.uid(table.slice(0, 3)),
      created_at: KX.util.nowISO(),
      updated_at: KX.util.nowISO(),
      created_by: (KX.store.get('session') || {}).user_id || 'system',
      status_flag: 'active'
    }, obj);
    rows.push(rec); write(table, rows);
    return KX.util.clone(rec);
  }
  async function insertMany(table, arr) {
    const out = [];
    for (const o of arr) out.push(await insert(table, o));
    return out;
  }
  async function update(table, id, patch) {
    const rows = read(table);
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) throw new Error('السجل غير موجود: ' + table + '/' + id);
    rows[i] = Object.assign({}, rows[i], patch, { updated_at: KX.util.nowISO() });
    write(table, rows);
    return KX.util.clone(rows[i]);
  }
  /* لا حذف نهائي للسجلات المالية — تعليم فقط */
  async function softDelete(table, id) { return update(table, id, { status_flag: 'deleted' }); }
  async function hardDelete(table, id) {
    const meta = KX.schema.TABLES[table] || {};
    if (meta.immutable) throw new Error('لا يُسمح بحذف سجلات ' + (meta.label || table));
    write(table, read(table).filter((r) => r.id !== id));
    return true;
  }
  async function count(table, where) {
    return read(table).filter((r) => r.status_flag !== 'deleted' && match(r, where)).length;
  }
  /* معاملة مبسّطة: لقطة قبل التنفيذ واسترجاعها عند الفشل */
  async function tx(fn) {
    const snapshot = {};
    Object.keys(KX.schema.TABLES).forEach((t) => { snapshot[t] = KX.util.clone(read(t)); });
    try { return await fn(); }
    catch (e) {
      Object.keys(snapshot).forEach((t) => write(t, snapshot[t]));
      throw e;
    }
  }
  function reset() {
    Object.keys(KX.schema.TABLES).forEach(function (t) {
      delete cache[t];
      try { localStorage.removeItem(NS + t); } catch (e) {}
    });
  }
  const raw = (table) => read(table);

  return { list, get, insert, insertMany, update, softDelete, hardDelete, count, tx, reset, raw, write };
})();
