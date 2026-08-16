/* Asaad Paper Invest — paper portfolio engine (FIFO lots, no leverage, no shorts) */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;

  const Portfolio = {
    /* ---------- valuation ---------- */
    summary() {
      const st = AP.store.s;
      const settings = st.settings;
      const out = {
        cash: U.num(st.cash),
        positions: {},
        invested: 0,
        cost: 0,
        unrealized: 0,
        dayPl: 0,
        realized: 0
      };
      Object.keys(st.positions).forEach(function (sym) {
        const p = st.positions[sym];
        if (!p || p.qty <= 0) return;
        const price = AP.store.lastPrice(sym) || p.avgCost;
        const prev = AP.store.prevClose(sym) || price;
        const value = p.qty * price;
        const cost = p.qty * p.avgCost;
        out.positions[sym] = {
          symbol: sym,
          qty: p.qty,
          avgCost: p.avgCost,
          price: price,
          prevClose: prev,
          value: value,
          cost: cost,
          pl: value - cost,
          plPct: cost ? ((value - cost) / cost) * 100 : 0,
          dayPl: (price - prev) * p.qty,
          dayPlPct: prev ? ((price - prev) / prev) * 100 : 0,
          openedAt: p.openedAt,
          isEtf: AP.store.isEtf(sym)
        };
        out.invested += value;
        out.cost += cost;
        out.unrealized += value - cost;
        out.dayPl += (price - prev) * p.qty;
      });
      out.realized = st.transactions.reduce(function (a, t) { return a + U.num(t.realized); }, 0);
      out.equity = out.cash + out.invested;
      const base = U.num(settings.initialCapital, 10000);
      out.totalPl = out.equity - base;
      out.totalPlPct = base ? (out.totalPl / base) * 100 : 0;
      out.cashWeight = out.equity ? (out.cash / out.equity) * 100 : 100;
      Object.keys(out.positions).forEach(function (s) {
        out.positions[s].weight = out.equity ? (out.positions[s].value / out.equity) * 100 : 0;
      });
      // yesterday's equity for a day P/L percentage
      const prevEquity = out.equity - out.dayPl;
      out.dayPlPct = prevEquity ? (out.dayPl / prevEquity) * 100 : 0;
      return out;
    },

    positionOf(sym) {
      const p = AP.store.s.positions[sym];
      return p && p.qty > 0 ? p : null;
    },

    /* ---------- risk checks ---------- */
    checkRisk(sym, qty, price) {
      const st = AP.store.settings();
      const pf = Portfolio.summary();
      const warnings = [];
      const equity = pf.equity || st.initialCapital;
      const held = pf.positions[sym] ? pf.positions[sym].value : 0;
      const after = held + qty * price;
      const pctAfter = equity ? (after / equity) * 100 : 0;
      const isEtf = AP.store.isEtf(sym);
      const cap = isEtf ? st.risk.maxEtf : st.risk.maxSingle;
      if (pctAfter > cap + 0.01) {
        warnings.push({ key: isEtf ? 'warn_cap_etf' : 'warn_cap_single', params: { a: cap } });
      }
      const cashAfter = pf.cash - qty * price;
      if (equity && (cashAfter / equity) * 100 < st.risk.minCash - 0.01) {
        warnings.push({ key: 'warn_cash_buffer', params: { a: st.risk.minCash } });
      }
      return { warnings: warnings, weightAfter: pctAfter, cap: cap };
    },

    /* ---------- trading ---------- */
    buy(sym, qty, price, opts) {
      opts = opts || {};
      qty = U.num(qty); price = U.num(price);
      const st = AP.store.s;
      if (!sym || qty <= 0 || price <= 0) return { ok: false, err: 'err_invalid' };
      const commission = U.num(st.settings.commission);
      const cost = qty * price + commission;
      if (cost > st.cash + 1e-9) return { ok: false, err: 'err_insufficient_cash' };

      const p = st.positions[sym] || {
        symbol: sym, qty: 0, avgCost: 0, realized: 0,
        openedAt: opts.date || U.today(), lots: []
      };
      const newQty = p.qty + qty;
      p.avgCost = (p.qty * p.avgCost + qty * price) / newQty;
      p.qty = newQty;
      p.lots.push({ qty: qty, price: price, date: opts.date || U.today() });
      st.positions[sym] = p;
      st.cash -= cost;

      st.transactions.unshift({
        id: U.uid('tx'), date: opts.date || U.today(), ts: Date.now(),
        type: 'BUY', symbol: sym, qty: qty, price: price,
        amount: qty * price, fees: commission, realized: 0,
        cashAfter: st.cash, note: opts.note || '',
        score: opts.score === undefined ? null : opts.score,
        decision: opts.decision || null,
        plan: opts.plan || null
      });
      AP.store.save();
      return { ok: true };
    },

    sell(sym, qty, price, opts) {
      opts = opts || {};
      qty = U.num(qty); price = U.num(price);
      const st = AP.store.s;
      const p = st.positions[sym];
      if (!p || p.qty <= 0) return { ok: false, err: 'err_insufficient_shares' };
      if (qty <= 0 || price <= 0) return { ok: false, err: 'err_invalid' };
      if (qty > p.qty + 1e-9) return { ok: false, err: 'err_insufficient_shares' };

      // FIFO realisation
      let remaining = qty, realized = 0;
      const consumed = [];
      while (remaining > 1e-9 && p.lots.length) {
        const lot = p.lots[0];
        const take = Math.min(lot.qty, remaining);
        realized += take * (price - lot.price);
        consumed.push({ qty: take, price: lot.price, date: lot.date });
        lot.qty -= take;
        remaining -= take;
        if (lot.qty <= 1e-9) p.lots.shift();
      }
      const commission = U.num(st.settings.commission);
      realized -= commission;
      p.qty = U.round(p.qty - qty, 8);
      p.realized = U.num(p.realized) + realized;
      if (p.qty <= 1e-8) {
        p.qty = 0;
        p.lots = [];
      }
      st.cash += qty * price - commission;
      if (p.qty === 0) delete st.positions[sym];
      else st.positions[sym] = p;

      st.transactions.unshift({
        id: U.uid('tx'), date: opts.date || U.today(), ts: Date.now(),
        type: 'SELL', symbol: sym, qty: qty, price: price,
        amount: qty * price, fees: commission, realized: realized,
        cashAfter: st.cash, note: opts.note || '',
        score: opts.score === undefined ? null : opts.score,
        decision: opts.decision || null,
        lots: consumed
      });
      AP.store.save();
      return { ok: true, realized: realized };
    },

    /* ---------- closed trades (FIFO matched) ---------- */
    closedTrades() {
      // Newest transactions sit at index 0, so a same-millisecond tie is broken
      // by array position (higher index = earlier) rather than left unordered.
      const txs = AP.store.s.transactions
        .map(function (t, i) { return { t: t, i: i }; })
        .sort(function (a, b) {
          if (a.t.date !== b.t.date) return a.t.date < b.t.date ? -1 : 1;
          const dt = U.num(a.t.ts) - U.num(b.t.ts);
          if (dt) return dt;
          return b.i - a.i;
        })
        .map(function (x) { return x.t; });
      const open = {};      // sym -> [{qty,price,date,score,decision}]
      const closed = [];
      txs.forEach(function (t) {
        if (t.type === 'BUY') {
          if (!open[t.symbol]) open[t.symbol] = [];
          open[t.symbol].push({ qty: t.qty, price: t.price, date: t.date, score: t.score, decision: t.decision });
        } else if (t.type === 'SELL') {
          let remaining = t.qty;
          const lots = open[t.symbol] || [];
          while (remaining > 1e-9 && lots.length) {
            const lot = lots[0];
            const take = Math.min(lot.qty, remaining);
            const pl = take * (t.price - lot.price);
            closed.push({
              symbol: t.symbol,
              qty: take,
              entryDate: lot.date,
              exitDate: t.date,
              entryPrice: lot.price,
              exitPrice: t.price,
              pl: pl,
              plPct: lot.price ? ((t.price - lot.price) / lot.price) * 100 : 0,
              holdDays: Math.max(0, U.daysBetween(lot.date, t.date)),
              score: lot.score,
              decision: lot.decision,
              exitDecision: t.decision
            });
            lot.qty -= take;
            remaining -= take;
            if (lot.qty <= 1e-9) lots.shift();
          }
        }
      });
      return closed;
    },

    /* ---------- equity history (from snapshots, plus today) ---------- */
    equitySeries() {
      const snaps = AP.store.s.snapshots.slice();
      const pf = Portfolio.summary();
      const today = U.today();
      const rows = snaps.map(function (s) { return { d: s.date, v: U.num(s.equity) }; });
      if (!rows.length || rows[rows.length - 1].d !== today) rows.push({ d: today, v: pf.equity });
      else rows[rows.length - 1].v = pf.equity;
      const start = AP.store.settings().startDate;
      if (rows.length === 1 && rows[0].d !== start) {
        rows.unshift({ d: start, v: AP.store.settings().initialCapital });
      }
      return rows;
    },

    /* Partial sells can leave a sliver worth a few cents; round those up to a
       full exit so the portfolio does not fill with dust positions. */
    dustAdjustedQty(sym, qty, price) {
      const pos = Portfolio.positionOf(sym);
      if (!pos) return qty;
      const capped = Math.min(U.num(qty), pos.qty);
      const remaining = pos.qty - capped;
      if (remaining > 0 && remaining * U.num(price) < 1) return pos.qty;
      return capped;
    },

    /* Suggested quantity honouring caps and the cash buffer. */
    maxAffordable(sym, price) {
      const st = AP.store.settings();
      const pf = Portfolio.summary();
      const cap = AP.store.isEtf(sym) ? st.risk.maxEtf : st.risk.maxSingle;
      const equity = pf.equity || st.initialCapital;
      const held = pf.positions[sym] ? pf.positions[sym].value : 0;
      const byCap = Math.max(0, equity * (cap / 100) - held);
      const byCash = Math.max(0, pf.cash - equity * (st.risk.minCash / 100));
      const dollars = Math.min(byCap, byCash);
      return {
        dollars: dollars,
        shares: price > 0 ? Math.floor((dollars / price) * 10000) / 10000 : 0,
        hardMaxShares: price > 0 ? Math.floor((pf.cash / price) * 10000) / 10000 : 0
      };
    }
  };

  AP.portfolio = Portfolio;
})(window);
