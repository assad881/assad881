/* كسارة اكسبريس — محرّك الحسابات والتقارير
   قاعدة الحساب:
     النقلة النقدية  = إيراد + تحصيل فوري (لا تدخل الذمم)
     النقلة الآجلة   = إيراد + مدين على العميل (تدخل الذمم)
     الدفعة          = تحصيل يسدّد أقدم نقلة آجلة أولًا (FIFO)
*/
(function (root) {
  'use strict';
  const EX = (root.EX = root.EX || {});
  const U = EX.util;

  const C = {
    loadTotal(l) {
      const gross = U.num(l.qty) * U.num(l.price);
      return U.round(Math.max(0, gross - U.num(l.discount)), 3);
    },

    /* ---------- فلترة ---------- */
    inRange(dateStr, from, to) {
      if (from && dateStr < from) return false;
      if (to && dateStr > to) return false;
      return true;
    },
    loads(filter) {
      filter = filter || {};
      return EX.store.s.loads.filter(function (l) {
        if (!C.inRange(l.date, filter.from, filter.to)) return false;
        if (filter.customerId && l.customerId !== filter.customerId) return false;
        if (filter.materialId && l.materialId !== filter.materialId) return false;
        if (filter.truckId && l.truckId !== filter.truckId) return false;
        if (filter.payment && l.payment !== filter.payment) return false;
        if (filter.q) {
          const hay = [EX.store.customerName(l.customerId), EX.store.materialName(l.materialId),
            EX.store.truckLabel(l.truckId), l.site, l.notes, 'ن' + l.no, String(l.no)].join(' ');
          if (!U.match(hay, filter.q)) return false;
        }
        return true;
      });
    },
    payments(filter) {
      filter = filter || {};
      return EX.store.s.payments.filter(function (p) {
        if (!C.inRange(p.date, filter.from, filter.to)) return false;
        if (filter.customerId && p.customerId !== filter.customerId) return false;
        if (filter.q && !U.match([EX.store.customerName(p.customerId), p.ref, p.notes].join(' '), filter.q)) return false;
        return true;
      });
    },
    expenses(filter) {
      filter = filter || {};
      return EX.store.s.expenses.filter(function (e) {
        if (!C.inRange(e.date, filter.from, filter.to)) return false;
        if (filter.category && e.category !== filter.category) return false;
        if (filter.q && !U.match([EX.t('cat_' + e.category), e.notes, EX.store.truckLabel(e.truckId)].join(' '), filter.q)) return false;
        return true;
      });
    },

    /* ---------- أرصدة العملاء ---------- */
    // الرصيد = الافتتاحي + مجموع النقلات الآجلة − مجموع الدفعات
    customerBalance(customerId) {
      const c = EX.store.customer(customerId);
      const opening = c ? U.num(c.openingBalance) : 0;
      const credit = U.sum(EX.store.s.loads.filter(function (l) {
        return l.customerId === customerId && l.payment === 'credit';
      }), function (l) { return l.total; });
      const paid = U.sum(EX.store.s.payments.filter(function (p) {
        return p.customerId === customerId;
      }), function (p) { return p.amount; });
      return U.round(opening + credit - paid, 3);
    },

    totalReceivables() {
      return U.round(U.sum(EX.store.s.customers, function (c) {
        return Math.max(0, C.customerBalance(c.id));
      }), 3);
    },

    /* كشف حساب: سطر لكل نقلة آجلة ودفعة، مرتبًا بالتاريخ مع رصيد متحرك */
    statement(customerId, from, to) {
      const c = EX.store.customer(customerId);
      const opening = c ? U.num(c.openingBalance) : 0;
      const rows = [];
      EX.store.s.loads.forEach(function (l) {
        if (l.customerId !== customerId || l.payment !== 'credit') return;
        rows.push({
          date: l.date, kind: 'load', ref: 'ن' + l.no,
          desc: EX.store.materialName(l.materialId) + ' · ' + U.qty(l.qty, EX.t('unit_' + (l.unit === 'm3' ? 'm3' : l.unit))),
          debit: U.num(l.total), credit: 0, id: l.id
        });
      });
      EX.store.s.payments.forEach(function (p) {
        if (p.customerId !== customerId) return;
        rows.push({
          date: p.date, kind: 'payment', ref: p.ref || '',
          desc: EX.t('receipt') + ' · ' + EX.t('m_' + p.method),
          debit: 0, credit: U.num(p.amount), id: p.id
        });
      });
      rows.sort(function (a, b) {
        if (a.date === b.date) return a.kind === 'load' ? -1 : 1;
        return a.date < b.date ? -1 : 1;
      });
      let bal = opening;
      let openingForPeriod = opening;
      const out = [];
      rows.forEach(function (r) {
        const before = bal;
        bal = U.round(bal + r.debit - r.credit, 3);
        if (!C.inRange(r.date, from, to)) {
          openingForPeriod = bal;
          return;
        }
        out.push(Object.assign({}, r, { balance: bal, balanceBefore: before }));
      });
      return { opening: openingForPeriod, rows: out, closing: bal };
    },

    /* أعمار الذمم: تُسدَّد الدفعات على أقدم نقلة آجلة أولًا */
    aging(asOf) {
      asOf = asOf || U.today();
      const buckets = { b0: 0, b31: 0, b61: 0, b90: 0, total: 0 };
      const perCustomer = {};
      EX.store.s.customers.forEach(function (c) {
        let pool = U.sum(EX.store.s.payments.filter(function (p) { return p.customerId === c.id; }),
          function (p) { return p.amount; });
        // الرصيد الافتتاحي أقدم بند، فيُسدَّد أولًا
        let opening = U.num(c.openingBalance);
        const applied = Math.min(pool, opening);
        opening -= applied;
        pool -= applied;
        const open = U.sortBy(EX.store.s.loads.filter(function (l) {
          return l.customerId === c.id && l.payment === 'credit';
        }), function (l) { return l.date; });
        const row = { b0: 0, b31: 0, b61: 0, b90: 0, total: 0 };
        if (opening > 0) { row.b90 += opening; }
        open.forEach(function (l) {
          let due = U.num(l.total);
          const take = Math.min(pool, due);
          due -= take;
          pool -= take;
          if (due <= 0.0005) return;
          const age = U.daysBetween(l.date, asOf);
          if (age <= 30) row.b0 += due;
          else if (age <= 60) row.b31 += due;
          else if (age <= 90) row.b61 += due;
          else row.b90 += due;
        });
        row.total = U.round(row.b0 + row.b31 + row.b61 + row.b90, 3);
        if (row.total > 0.0005) {
          perCustomer[c.id] = row;
          buckets.b0 += row.b0; buckets.b31 += row.b31; buckets.b61 += row.b61; buckets.b90 += row.b90;
        }
      });
      ['b0', 'b31', 'b61', 'b90'].forEach(function (k) { buckets[k] = U.round(buckets[k], 3); });
      buckets.total = U.round(buckets.b0 + buckets.b31 + buckets.b61 + buckets.b90, 3);
      return { buckets: buckets, perCustomer: perCustomer };
    },

    /* ---------- ملخصات ---------- */
    // الكميات: الطن والمتر المكعب يُجمعان كوحدات، والنقلات تُعدّ بعدد النقلات
    qtySummary(loads) {
      const out = { ton: 0, m3: 0, load: 0, trips: loads.length };
      loads.forEach(function (l) {
        const u = l.unit === 'm3' ? 'm3' : l.unit === 'load' ? 'load' : 'ton';
        out[u] += U.num(l.qty);
      });
      ['ton', 'm3', 'load'].forEach(function (k) { out[k] = U.round(out[k], 2); });
      return out;
    },
    qtyLabel(sum) {
      const parts = [];
      if (sum.ton) parts.push(U.qty(sum.ton, EX.t('unit_ton')));
      if (sum.m3) parts.push(U.qty(sum.m3, EX.t('unit_m3')));
      if (sum.load) parts.push(U.qty(sum.load, EX.t('unit_load')));
      return parts.length ? parts.join(' · ') : U.qty(0, EX.t('unit_ton'));
    },

    summary(from, to) {
      const loads = C.loads({ from: from, to: to });
      const pays = C.payments({ from: from, to: to });
      const exps = C.expenses({ from: from, to: to });
      const revenue = U.round(U.sum(loads, function (l) { return l.total; }), 3);
      const cashLoads = U.round(U.sum(loads.filter(function (l) { return l.payment === 'cash'; }),
        function (l) { return l.total; }), 3);
      const creditLoads = U.round(revenue - cashLoads, 3);
      const paid = U.round(U.sum(pays, function (p) { return p.amount; }), 3);
      const expenses = U.round(U.sum(exps, function (e) { return e.amount; }), 3);
      const q = C.qtySummary(loads);
      const tons = q.ton;
      return {
        from: from, to: to,
        loads: loads, payments: pays, expenses: exps,
        trips: loads.length,
        qty: q,
        revenue: revenue,
        cashLoads: cashLoads,
        creditLoads: creditLoads,
        paymentsTotal: paid,
        collected: U.round(cashLoads + paid, 3),
        expensesTotal: expenses,
        net: U.round(revenue - expenses, 3),
        margin: revenue > 0 ? U.round((revenue - expenses) / revenue * 100, 1) : 0,
        avgLoad: loads.length ? U.round(revenue / loads.length, 3) : 0,
        avgPricePerTon: tons > 0 ? U.round(U.sum(loads.filter(function (l) {
          return (l.unit || 'ton') === 'ton';
        }), function (l) { return l.total; }) / tons, 3) : 0
      };
    },

    /* سلسلة يومية للرسم: الإيراد والمصروف لكل يوم في المدى */
    dailySeries(days) {
      days = days || 30;
      const to = U.today();
      const from = U.addDays(to, -(days - 1));
      const rev = {}, exp = {};
      C.loads({ from: from, to: to }).forEach(function (l) {
        rev[l.date] = U.num(rev[l.date]) + U.num(l.total);
      });
      C.expenses({ from: from, to: to }).forEach(function (e) {
        exp[e.date] = U.num(exp[e.date]) + U.num(e.amount);
      });
      const out = [];
      for (let i = 0; i < days; i++) {
        const d = U.addDays(from, i);
        out.push({ date: d, revenue: U.round(rev[d] || 0, 3), expense: U.round(exp[d] || 0, 3) });
      }
      return out;
    },

    monthlySeries(months) {
      months = months || 12;
      const now = new Date();
      const out = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mk = U.dateKey(d).slice(0, 7);
        const from = mk + '-01';
        const to = U.dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
        const loads = C.loads({ from: from, to: to });
        out.push({
          month: mk,
          revenue: U.round(U.sum(loads, function (l) { return l.total; }), 3),
          expense: U.round(U.sum(C.expenses({ from: from, to: to }), function (e) { return e.amount; }), 3),
          trips: loads.length,
          tons: C.qtySummary(loads).ton
        });
      }
      return out;
    },

    /* تجميع عام: by = 'materialId' | 'customerId' | 'truckId' */
    breakdown(loads, by) {
      const groups = U.groupBy(loads, function (l) { return l[by] || ''; });
      const rows = Object.keys(groups).map(function (k) {
        const g = groups[k];
        const q = C.qtySummary(g);
        return {
          key: k,
          label: by === 'materialId' ? EX.store.materialName(k)
            : by === 'customerId' ? EX.store.customerName(k)
              : EX.store.truckLabel(k),
          trips: g.length,
          qty: q,
          tons: q.ton,
          revenue: U.round(U.sum(g, function (l) { return l.total; }), 3)
        };
      });
      const total = U.sum(rows, function (r) { return r.revenue; });
      rows.forEach(function (r) { r.share = total > 0 ? U.round(r.revenue / total * 100, 1) : 0; });
      return U.sortBy(rows, function (r) { return r.revenue; }, true);
    },

    expenseBreakdown(exps) {
      const groups = U.groupBy(exps, function (e) { return e.category || 'other'; });
      const rows = Object.keys(groups).map(function (k) {
        return {
          key: k,
          label: EX.t('cat_' + k),
          amount: U.round(U.sum(groups[k], function (e) { return e.amount; }), 3),
          count: groups[k].length
        };
      });
      const total = U.sum(rows, function (r) { return r.amount; });
      rows.forEach(function (r) { r.share = total > 0 ? U.round(r.amount / total * 100, 1) : 0; });
      return U.sortBy(rows, function (r) { return r.amount; }, true);
    },

    /* ---------- ضريبة ---------- */
    vat(amount) {
      const st = EX.store.settings();
      if (!st.vatEnabled) return { base: U.round(amount, 3), vat: 0, total: U.round(amount, 3), rate: 0 };
      const rate = U.num(st.vatRate);
      const vat = U.round(amount * rate / 100, 3);
      return { base: U.round(amount, 3), vat: vat, total: U.round(amount + vat, 3), rate: rate };
    }
  };

  EX.calc = C;
})(window);
