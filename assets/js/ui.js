/* Asaad Paper Invest — application shell & shared UI pieces */
(function (root) {
  'use strict';
  const AP = (root.AP = root.AP || {});
  const U = AP.util;
  const t = function (k, p) { return AP.t(k, p); };

  const ROUTES = [
    { id: 'today', key: 'nav_today', icon: '◎', primary: true },
    { id: 'portfolio', key: 'nav_portfolio', icon: '▦', primary: true },
    { id: 'opportunities', key: 'nav_opportunities', icon: '↗', primary: true },
    { id: 'analytics', key: 'nav_analytics', icon: '◫', primary: true },
    { id: 'journal', key: 'nav_journal', icon: '☰' },
    { id: 's507', key: 'nav_507', icon: '⬢' },
    { id: 'news', key: 'nav_news', icon: '⚑' },
    { id: 'alerts', key: 'nav_alerts', icon: '◔' },
    { id: 'report', key: 'nav_report', icon: '★' },
    { id: 'settings', key: 'nav_settings', icon: '⚙', primary: true }
  ];

  const UI = {
    route: 'today',
    busy: false,

    /* ---------- toasts ---------- */
    toast(msg, kind) {
      let host = U.$('.toasts');
      if (!host) {
        host = U.el('div', { class: 'toasts' });
        document.body.appendChild(host);
      }
      const el = U.el('div', { class: 'toast ' + (kind || ''), text: msg });
      host.appendChild(el);
      setTimeout(function () {
        el.style.opacity = '0';
        setTimeout(function () { el.remove(); }, 250);
      }, 2600);
    },

    /* ---------- modal ---------- */
    modal(opts) {
      const backdrop = U.el('div', { class: 'modal-backdrop' });
      const box = U.el('div', { class: 'modal' });
      const head = U.el('div', { class: 'modal-head' }, [
        U.el('div', { class: 'card-title', text: opts.title || '' }),
        U.el('div', { class: 'spacer' }),
        U.el('button', { class: 'icon-btn', text: '✕', onclick: close, 'aria-label': t('close') })
      ]);
      box.appendChild(head);
      const body = U.el('div', {});
      if (typeof opts.body === 'string') body.innerHTML = opts.body;
      else if (opts.body) body.appendChild(opts.body);
      box.appendChild(body);

      if (opts.actions !== false) {
        const actions = U.el('div', { class: 'modal-actions' });
        actions.appendChild(U.el('button', { class: 'btn ghost', text: opts.cancelText || t('cancel'), onclick: close }));
        if (opts.onConfirm) {
          actions.appendChild(U.el('button', {
            class: 'btn primary', text: opts.confirmText || t('confirm'),
            onclick: function () {
              const r = opts.onConfirm(body);
              if (r !== false) close();
            }
          }));
        }
        box.appendChild(actions);
      }
      backdrop.appendChild(box);
      backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
      document.body.appendChild(backdrop);
      function close() { backdrop.remove(); if (opts.onClose) opts.onClose(); }
      return { close: close, body: body };
    },

    confirm(message, onYes) {
      UI.modal({
        title: t('confirm'),
        body: U.el('div', { class: 'small', text: message }),
        confirmText: t('confirm'),
        onConfirm: function () { onYes(); }
      });
    },

    /* ---------- shared cells ---------- */
    pl(value, pct, opts) {
      opts = opts || {};
      const cls = U.sign(value);
      const txt = (opts.moneyOnly ? '' : '') + U.money(value) +
        (pct !== null && pct !== undefined ? ' (' + U.pct(pct) + ')' : '');
      return U.el('span', { class: cls + ' tnum', text: txt });
    },

    symbolCell(sym) {
      return U.el('div', {}, [
        U.el('div', { class: 'sym', text: sym }),
        U.el('div', { class: 'sym-name', text: AP.store.assetName(sym) })
      ]);
    },

    bandBadge(ev) {
      const b = ev.band || AP.signals.bandOf(ev.score || 0);
      return U.el('span', { class: 'badge ' + b.cls, text: t(b.key) });
    },

    decisionBadge(decision) {
      const map = {
        dec_buy: 'good', dec_scale_in: 'info', dec_wait: '', dec_none: '',
        dec_take_profit: 'warn', dec_trim: 'warn', dec_exit: 'bad'
      };
      return U.el('span', { class: 'badge ' + (map[decision] || ''), text: t(decision) });
    },

    dataBadge() {
      const mode = AP.store.s.meta.dataMode;
      if (mode === 'demo') return U.el('span', { class: 'badge warn', text: t('demo_data_badge') });
      if (mode === 'live' || mode === 'mixed') return U.el('span', { class: 'badge good', text: t('live_data_badge') });
      if (mode === 'cached') return U.el('span', { class: 'badge', text: t('cached_data_badge') });
      return U.el('span', { class: 'badge', text: t('no_data') });
    },

    card(titleKey, subKey, node, headExtra) {
      const c = U.el('div', { class: 'card' });
      if (titleKey) {
        const head = U.el('div', { class: 'card-head' }, [
          U.el('div', {}, [
            U.el('div', { class: 'card-title', text: typeof titleKey === 'string' ? t(titleKey) : titleKey }),
            subKey ? U.el('div', { class: 'card-sub', text: typeof subKey === 'string' ? t(subKey) : subKey }) : null
          ])
        ]);
        if (headExtra) {
          head.appendChild(U.el('div', { class: 'spacer' }));
          head.appendChild(headExtra);
        }
        c.appendChild(head);
      }
      if (node) c.appendChild(node);
      return c;
    },

    table(headers, rows) {
      const wrap = U.el('div', { class: 'table-wrap' });
      const tbl = U.el('table', { class: 'tbl' });
      const thead = U.el('thead');
      const tr = U.el('tr');
      headers.forEach(function (h) { tr.appendChild(U.el('th', { text: h })); });
      thead.appendChild(tr);
      tbl.appendChild(thead);
      const tbody = U.el('tbody');
      rows.forEach(function (r) {
        const row = U.el('tr');
        r.forEach(function (cell) {
          const td = U.el('td');
          if (cell === null || cell === undefined) td.textContent = '—';
          else if (typeof cell === 'object' && cell.nodeType) td.appendChild(cell);
          else td.textContent = String(cell);
          row.appendChild(td);
        });
        tbody.appendChild(row);
      });
      tbl.appendChild(tbody);
      wrap.appendChild(tbl);
      return wrap;
    },

    empty(msgKey) {
      return U.el('div', { class: 'empty', text: typeof msgKey === 'string' ? t(msgKey) : msgKey });
    },

    /* ---------- app shell ---------- */
    renderShell() {
      const app = U.$('#app');
      app.innerHTML = '';

      const bar = U.el('header', { class: 'appbar' }, [
        U.el('div', { class: 'appbar-inner' }, [
          U.el('div', { class: 'brand' }, [
            U.el('div', { class: 'brand-mark', text: 'A' }),
            U.el('div', {}, [
              U.el('div', { class: 'brand-name', text: t('app_name') }),
              U.el('div', { class: 'brand-sub', text: t('day_of', { a: AP.store.dayNumber(), b: AP.store.settings().experimentDays }) })
            ])
          ]),
          U.el('div', { class: 'appbar-actions' }, [
            U.el('button', {
              class: 'icon-btn', title: t('refresh'), text: UI.busy ? '⏳' : '⟳',
              onclick: function () { AP.app.refresh(true); }
            }),
            (function () {
              const b = U.el('button', {
                class: 'icon-btn', title: t('alerts_title'), text: '◔',
                onclick: function () { UI.go('alerts'); }
              });
              const n = AP.store.unreadAlerts();
              if (n) b.appendChild(U.el('span', { class: 'dot', text: n > 99 ? '99' : String(n) }));
              return b;
            })(),
            U.el('button', {
              class: 'icon-btn', title: t('theme_dark'), text: AP.store.settings().theme === 'dark' ? '☀' : '☾',
              onclick: function () { AP.app.toggleTheme(); }
            }),
            U.el('button', {
              class: 'icon-btn', title: t('language'), text: AP.i18n.lang === 'ar' ? 'EN' : 'ع',
              onclick: function () { AP.app.toggleLang(); }
            })
          ])
        ])
      ]);
      app.appendChild(bar);
      app.appendChild(U.el('div', { class: 'paper-strip', text: '⚠ ' + t('paper_only') }));

      const wrap = U.el('div', { class: 'wrap' });
      wrap.appendChild(UI.kpiStrip());

      const tabs = U.el('nav', { class: 'tabs' });
      ROUTES.forEach(function (r) {
        tabs.appendChild(U.el('button', {
          class: 'tab' + (UI.route === r.id ? ' active' : ''),
          text: t(r.key),
          onclick: function () { UI.go(r.id); }
        }));
      });
      wrap.appendChild(tabs);

      const content = U.el('main', { id: 'view' });
      wrap.appendChild(content);
      app.appendChild(wrap);

      const bn = U.el('nav', { class: 'bottomnav' });
      ROUTES.filter(function (r) { return r.primary; }).forEach(function (r) {
        bn.appendChild(U.el('button', {
          class: 'bnav' + (UI.route === r.id ? ' active' : ''),
          onclick: function () { UI.go(r.id); }
        }, [
          U.el('span', { class: 'ico', text: r.icon }),
          U.el('span', { text: t(r.key) })
        ]));
      });
      app.appendChild(bn);

      UI.renderView();
    },

    kpiStrip() {
      const pf = AP.portfolio.summary();
      const st = AP.store.settings();
      const day = AP.store.dayNumber();
      const remaining = AP.store.daysRemaining();

      function kpi(labelKey, valueText, sub, cls, hero) {
        return U.el('div', { class: 'kpi' + (hero ? ' hero' : '') }, [
          U.el('div', { class: 'kpi-label', text: t(labelKey) }),
          U.el('div', { class: 'kpi-value tnum ' + (cls || ''), text: valueText }),
          sub ? U.el('div', { class: 'kpi-sub', text: sub }) : null
        ]);
      }

      const strip = U.el('section', { class: 'kpis' }, [
        kpi('kpi_portfolio_value', U.money(pf.equity), null, '', true),
        kpi('kpi_today_pl', U.money(pf.dayPl), U.pct(pf.dayPlPct), U.sign(pf.dayPl)),
        kpi('kpi_total_pl', U.money(pf.totalPl), U.pct(pf.totalPlPct), U.sign(pf.totalPl)),
        kpi('kpi_cash', U.money(pf.cash), U.pctPlain(pf.cashWeight) + ' ' + t('cash_weight')),
        kpi('kpi_invested', U.money(pf.invested), Object.keys(pf.positions).length + ' ' + t('positions')),
        kpi('kpi_return', U.pct(pf.totalPlPct), t('initial_capital') + ' ' + U.money0(st.initialCapital), U.sign(pf.totalPl)),
        (function () {
          const box = kpi('kpi_days', U.iso(day + ' / ' + st.experimentDays), t('days_remaining') + ': ' + remaining);
          const track = U.el('div', { class: 'progress-track' });
          const fill = U.el('div', { class: 'progress-fill' });
          fill.style.width = U.clamp((day / st.experimentDays) * 100, 2, 100) + '%';
          track.appendChild(fill);
          box.appendChild(track);
          return box;
        })()
      ]);
      return strip;
    },

    go(route) {
      UI.route = route;
      try { location.hash = '#' + route; } catch (e) { /* noop */ }
      UI.renderShell();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    renderView() {
      const host = U.$('#view');
      if (!host) return;
      host.innerHTML = '';
      const view = AP.views[UI.route];
      if (!view) {
        host.appendChild(UI.empty('no_data'));
        return;
      }
      try {
        view(host);
      } catch (e) {
        console.error('View error', e);
        host.appendChild(UI.empty(String(e && e.message ? e.message : e)));
      }
    },

    refresh() { UI.renderShell(); },

    /* ---------- paper trade dialog ---------- */
    tradeModal(symbol, side, prefill) {
      prefill = prefill || {};
      const price = prefill.price || AP.store.lastPrice(symbol) || 0;
      const pf = AP.portfolio.summary();
      const pos = pf.positions[symbol];
      const maxInfo = AP.portfolio.maxAffordable(symbol, price);

      const body = U.el('div', {});
      body.appendChild(U.el('div', { class: 'row', style: { marginBottom: '10px' } }, [
        UI.symbolCell(symbol),
        U.el('div', { class: 'spacer', style: { marginInlineStart: 'auto' } }),
        U.el('div', { class: 'pick-price tnum', text: U.money(price) })
      ]));

      const sideSel = U.el('select', {}, [
        U.el('option', { value: 'BUY', text: t('tx_buy'), selected: side !== 'SELL' }),
        U.el('option', { value: 'SELL', text: t('tx_sell'), selected: side === 'SELL' })
      ]);
      sideSel.value = side === 'SELL' ? 'SELL' : 'BUY';

      const qtyIn = U.el('input', { type: 'number', step: '0.0001', min: '0', value: prefill.qty || '' });
      const amtIn = U.el('input', { type: 'number', step: '0.01', min: '0', value: prefill.amount ? U.round(prefill.amount, 2) : '' });
      const priceIn = U.el('input', { type: 'number', step: '0.01', min: '0', value: U.round(price, 2) });
      const dateIn = U.el('input', { type: 'date', value: U.today() });
      const noteIn = U.el('input', { type: 'text', value: prefill.note || '' });
      const info = U.el('div', { class: 'hint' });

      function currentPrice() { return U.num(priceIn.value) || price; }
      function syncFromQty() {
        const q = U.num(qtyIn.value);
        amtIn.value = q > 0 ? U.round(q * currentPrice(), 2) : '';
        update();
      }
      function syncFromAmt() {
        const a = U.num(amtIn.value);
        const p = currentPrice();
        qtyIn.value = (a > 0 && p > 0) ? U.round(a / p, 4) : '';
        update();
      }
      function update() {
        const q = U.num(qtyIn.value), p = currentPrice();
        const cost = q * p;
        const isBuy = sideSel.value === 'BUY';
        const lines = [];
        lines.push(t('trade_estimated') + ': ' + U.money(cost));
        if (isBuy) {
          lines.push(t('trade_available_cash') + ': ' + U.money(pf.cash));
          lines.push(t('trade_max_shares') + ': ' + U.qty(maxInfo.shares) + ' (' + U.money(maxInfo.dollars) + ')');
          if (q > 0) {
            const risk = AP.portfolio.checkRisk(symbol, q, p);
            risk.warnings.forEach(function (w) { lines.push('⚠ ' + t(w.key, w.params)); });
          }
        } else if (pos) {
          lines.push(t('shares') + ': ' + U.qty(pos.qty) + ' · ' + t('avg_cost') + ' ' + U.money(pos.avgCost));
          if (q > 0) {
            const pl = (p - pos.avgCost) * q;
            lines.push(t('pl') + ': ' + U.money(pl));
          }
        }
        info.innerHTML = lines.map(function (l) { return U.esc(l); }).join('<br>');
      }
      qtyIn.addEventListener('input', syncFromQty);
      amtIn.addEventListener('input', syncFromAmt);
      priceIn.addEventListener('input', syncFromQty);
      sideSel.addEventListener('change', update);

      function field(labelKey, node) {
        return U.el('div', { class: 'field' }, [U.el('label', { text: t(labelKey) }), node]);
      }
      body.appendChild(field('trade_side', sideSel));
      body.appendChild(U.el('div', { class: 'form-row' }, [
        field('trade_qty', qtyIn),
        field('trade_amount_usd', amtIn)
      ]));
      body.appendChild(U.el('div', { class: 'form-row' }, [
        field('trade_price', priceIn),
        field('trade_date', dateIn)
      ]));
      if (sideSel.value === 'BUY') {
        body.appendChild(U.el('div', { class: 'row', style: { marginBottom: '10px' } }, [
          U.el('button', {
            class: 'btn sm', text: '25%',
            onclick: function () { amtIn.value = U.round(maxInfo.dollars * 0.25, 2); syncFromAmt(); }
          }),
          U.el('button', {
            class: 'btn sm', text: '50%',
            onclick: function () { amtIn.value = U.round(maxInfo.dollars * 0.5, 2); syncFromAmt(); }
          }),
          U.el('button', {
            class: 'btn sm', text: '100%',
            onclick: function () { amtIn.value = U.round(maxInfo.dollars, 2); syncFromAmt(); }
          })
        ]));
      } else if (pos) {
        body.appendChild(U.el('div', { class: 'row', style: { marginBottom: '10px' } }, [
          U.el('button', {
            class: 'btn sm', text: '25%',
            onclick: function () {
              qtyIn.value = AP.portfolio.dustAdjustedQty(symbol, U.round(pos.qty * 0.25, 4), currentPrice());
              syncFromQty();
            }
          }),
          U.el('button', {
            class: 'btn sm', text: '50%',
            onclick: function () {
              qtyIn.value = AP.portfolio.dustAdjustedQty(symbol, U.round(pos.qty * 0.5, 4), currentPrice());
              syncFromQty();
            }
          }),
          U.el('button', { class: 'btn sm', text: '100%', onclick: function () { qtyIn.value = U.round(pos.qty, 4); syncFromQty(); } })
        ]));
      }
      body.appendChild(field('trade_note', noteIn));
      body.appendChild(info);
      update();

      UI.modal({
        title: t('trade_paper_title') + ' · ' + symbol,
        body: body,
        confirmText: t('trade_confirm'),
        onConfirm: function () {
          const q = U.num(qtyIn.value), p = currentPrice();
          if (q <= 0 || p <= 0) { UI.toast(t('err_invalid'), 'bad'); return false; }
          const opts = {
            date: dateIn.value || U.today(),
            note: noteIn.value,
            score: prefill.score === undefined ? null : prefill.score,
            decision: prefill.decision || null,
            plan: prefill.plan || null
          };
          const res = sideSel.value === 'BUY'
            ? AP.portfolio.buy(symbol, q, p, opts)
            : AP.portfolio.sell(symbol, q, p, opts);
          if (!res.ok) { UI.toast(t(res.err), 'bad'); return false; }
          if (prefill.journalId) AP.journal.markExecuted(prefill.journalId, null);
          AP.store.saveSnapshot({ scores: AP.app.lastScores() });
          UI.toast(sideSel.value === 'BUY' ? t('tx_buy') + ' ✓' : t('tx_sell') + ' ✓', 'good');
          UI.renderShell();
        }
      });
    },

    ROUTES: ROUTES
  };

  AP.ui = UI;
  AP.views = AP.views || {};
})(window);
