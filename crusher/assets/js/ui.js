/* كسارة اكسبريس — الهيكل العام وعناصر الواجهة المشتركة */
(function (root) {
  'use strict';
  const EX = (root.EX = root.EX || {});
  const U = EX.util;
  const t = function (k, p) { return EX.t(k, p); };

  const ROUTES = [
    { id: 'dashboard', key: 'nav_dashboard', icon: '◎', primary: true },
    { id: 'loads', key: 'nav_loads', icon: '▤', primary: true },
    { id: 'customers', key: 'nav_customers', icon: '◍', primary: true },
    { id: 'reports', key: 'nav_reports', icon: '◫', primary: true },
    { id: 'payments', key: 'nav_payments', icon: '◉' },
    { id: 'expenses', key: 'nav_expenses', icon: '◆' },
    { id: 'materials', key: 'nav_materials', icon: '▰' },
    { id: 'trucks', key: 'nav_trucks', icon: '▭' },
    { id: 'settings', key: 'nav_settings', icon: '⚙', primary: true }
  ];

  const UI = {
    route: 'dashboard',
    ctx: {},   // حالة الشاشة الحالية (فلاتر، عميل مفتوح…)

    /* ---------- إشعارات ---------- */
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

    /* ---------- نافذة ---------- */
    modal(opts) {
      const backdrop = U.el('div', { class: 'modal-backdrop' });
      const box = U.el('div', { class: 'modal' + (opts.wide ? ' wide' : '') });
      box.appendChild(U.el('div', { class: 'modal-head' }, [
        U.el('div', { class: 'card-title', text: opts.title || '' }),
        U.el('div', { class: 'spacer' }),
        U.el('button', { class: 'icon-btn', text: '✕', onclick: close, 'aria-label': t('close') })
      ]));
      const body = U.el('div', { class: 'modal-body' });
      if (typeof opts.body === 'string') body.innerHTML = opts.body;
      else if (opts.body) body.appendChild(opts.body);
      box.appendChild(body);

      if (opts.actions !== false) {
        const actions = U.el('div', { class: 'modal-actions' });
        if (opts.extra) actions.appendChild(opts.extra);
        actions.appendChild(U.el('div', { class: 'spacer' }));
        actions.appendChild(U.el('button', { class: 'btn ghost', text: opts.cancelText || t('cancel'), onclick: close }));
        if (opts.onConfirm) {
          actions.appendChild(U.el('button', {
            class: 'btn primary' + (opts.danger ? ' danger' : ''),
            text: opts.confirmText || t('save'),
            onclick: function () { if (opts.onConfirm(body) !== false) close(); }
          }));
        }
        box.appendChild(actions);
      }
      backdrop.appendChild(box);
      backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
      document.body.appendChild(backdrop);
      const first = body.querySelector('input,select,textarea');
      if (first) setTimeout(function () { first.focus(); }, 40);
      function close() { backdrop.remove(); if (opts.onClose) opts.onClose(); }
      return { close: close, body: body };
    },

    confirm(message, onYes, opts) {
      opts = opts || {};
      UI.modal({
        title: opts.title || t('confirm'),
        body: U.el('div', { class: 'small', text: message }),
        confirmText: opts.confirmText || t('confirm'),
        danger: opts.danger !== false,
        onConfirm: function () { onYes(); }
      });
    },

    /* ---------- نماذج ----------
       fields: [{name,label,type,value,options,required,step,min,hint,span,placeholder,onInput}]
       تعيد get() القيم، و errors() التحقق من الحقول المطلوبة. */
    form(fields, opts) {
      opts = opts || {};
      const grid = U.el('div', { class: 'form-grid' + (opts.cols ? ' cols-' + opts.cols : '') });
      const inputs = {};
      fields.forEach(function (f) {
        if (!f) return;
        const id = 'f_' + f.name + '_' + Math.random().toString(36).slice(2, 6);
        const wrap = U.el('label', { class: 'field' + (f.span ? ' span-' + f.span : ''), for: id });
        if (f.type !== 'checkbox') {
          wrap.appendChild(U.el('span', { class: 'field-label' }, [
            U.el('span', { text: f.label }),
            f.required ? U.el('b', { class: 'req', text: '*' }) : null
          ]));
        }
        let input;
        if (f.type === 'select') {
          input = U.el('select', { id: id });
          (f.options || []).forEach(function (o) {
            input.appendChild(U.el('option', { value: o.value, text: o.label, selected: String(o.value) === String(f.value) ? 'selected' : null }));
          });
          input.value = f.value === undefined || f.value === null ? '' : String(f.value);
        } else if (f.type === 'textarea') {
          input = U.el('textarea', { id: id, rows: f.rows || 2, placeholder: f.placeholder || '' });
          input.value = f.value === undefined || f.value === null ? '' : String(f.value);
        } else if (f.type === 'checkbox') {
          input = U.el('input', { id: id, type: 'checkbox' });
          input.checked = !!f.value;
          wrap.classList.add('check');
          wrap.appendChild(input);
          wrap.appendChild(U.el('span', { class: 'field-label inline', text: f.label }));
        } else {
          input = U.el('input', {
            id: id,
            type: f.type || 'text',
            placeholder: f.placeholder || '',
            step: f.step || (f.type === 'number' ? 'any' : null),
            min: f.min === undefined ? null : f.min,
            inputmode: f.type === 'number' ? 'decimal' : null
          });
          input.value = f.value === undefined || f.value === null ? '' : String(f.value);
        }
        if (f.onInput) input.addEventListener(f.type === 'select' || f.type === 'checkbox' ? 'change' : 'input', function () { f.onInput(input, inputs); });
        if (f.type !== 'checkbox') wrap.appendChild(input);
        if (f.hint) wrap.appendChild(U.el('span', { class: 'field-hint', text: f.hint }));
        inputs[f.name] = { input: input, spec: f, wrap: wrap };
        grid.appendChild(wrap);
      });

      const api = {
        node: grid,
        inputs: inputs,
        get() {
          const out = {};
          Object.keys(inputs).forEach(function (k) {
            const it = inputs[k];
            if (it.spec.type === 'checkbox') out[k] = it.input.checked;
            else if (it.spec.type === 'number') out[k] = it.input.value === '' ? '' : U.num(it.input.value);
            else out[k] = it.input.value.trim ? it.input.value.trim() : it.input.value;
          });
          return out;
        },
        set(name, value) {
          const it = inputs[name];
          if (!it) return;
          if (it.spec.type === 'checkbox') it.input.checked = !!value;
          else it.input.value = value === undefined || value === null ? '' : String(value);
        },
        valid() {
          let ok = true;
          Object.keys(inputs).forEach(function (k) {
            const it = inputs[k];
            if (!it.spec.required) return;
            const v = it.spec.type === 'checkbox' ? it.input.checked : String(it.input.value).trim();
            const bad = it.spec.type === 'number' ? (v === '' || !isFinite(Number(v))) : !v;
            it.wrap.classList.toggle('invalid', bad);
            if (bad) ok = false;
          });
          if (!ok) UI.toast(t('required'), 'bad');
          return ok;
        }
      };
      return api;
    },

    /* ---------- بطاقات ---------- */
    card(title, content, opts) {
      opts = opts || {};
      const head = title || opts.actions
        ? U.el('div', { class: 'card-head' }, [
          U.el('div', {}, [
            U.el('div', { class: 'card-title', text: title || '' }),
            opts.subtitle ? U.el('div', { class: 'card-sub', text: opts.subtitle }) : null
          ]),
          U.el('div', { class: 'spacer' }),
          opts.actions || null
        ])
        : null;
      return U.el('div', { class: 'card' + (opts.class ? ' ' + opts.class : '') }, [
        head,
        content
      ]);
    },

    kpi(label, value, opts) {
      opts = opts || {};
      return U.el('div', { class: 'kpi' + (opts.class ? ' ' + opts.class : '') }, [
        U.el('div', { class: 'kpi-label', text: label }),
        U.el('div', { class: 'kpi-value tnum ' + (opts.tone || ''), text: value }),
        opts.sub ? U.el('div', { class: 'kpi-sub', text: opts.sub }) : null
      ]);
    },

    /* ---------- جداول ----------
       cols: [{key,label,cell(row),align,width,tnum,hideSm}] */
    table(cols, rows, opts) {
      opts = opts || {};
      if (!rows.length) {
        return U.el('div', { class: 'empty' }, [
          U.el('div', { class: 'empty-title', text: opts.emptyTitle || t('no_data') }),
          U.el('div', { class: 'empty-hint', text: opts.emptyHint || t('empty_hint') })
        ]);
      }
      const thead = U.el('thead', {}, U.el('tr', {}, cols.map(function (c) {
        return U.el('th', {
          class: (c.align === 'end' ? 'ta-end' : c.align === 'center' ? 'ta-center' : '') + (c.hideSm ? ' hide-sm' : ''),
          style: c.width ? { width: c.width } : null,
          text: c.label
        });
      })));
      const tbody = U.el('tbody', {}, rows.map(function (r, i) {
        const tr = U.el('tr', opts.onRowClick ? { class: 'clickable', onclick: function () { opts.onRowClick(r); } } : {});
        cols.forEach(function (c) {
          const v = c.cell ? c.cell(r, i) : r[c.key];
          const td = U.el('td', {
            class: (c.align === 'end' ? 'ta-end' : c.align === 'center' ? 'ta-center' : '') +
              (c.tnum ? ' tnum' : '') + (c.hideSm ? ' hide-sm' : ''),
            'data-label': c.label
          });
          if (v === null || v === undefined) td.textContent = '—';
          else if (typeof v === 'object' && v.nodeType) td.appendChild(v);
          else td.textContent = String(v);
          tr.appendChild(td);
        });
        return tr;
      }));
      const foot = opts.footer
        ? U.el('tfoot', {}, U.el('tr', {}, opts.footer.map(function (f) {
          return U.el('td', { class: (f.align === 'end' ? 'ta-end' : '') + (f.tnum ? ' tnum' : ''), text: f.text || '' });
        })))
        : null;
      return U.el('div', { class: 'table-wrap' }, U.el('table', { class: 'table' }, [thead, tbody, foot]));
    },

    badge(text, kind) { return U.el('span', { class: 'badge ' + (kind || ''), text: text }); },

    rowActions(items) {
      return U.el('div', { class: 'row-actions' }, items.map(function (it) {
        return U.el('button', {
          class: 'mini-btn' + (it.danger ? ' danger' : ''),
          text: it.label,
          title: it.title || it.label,
          onclick: function (e) { e.stopPropagation(); it.onClick(); }
        });
      }));
    },

    /* شريط فلترة قياسي: بحث + مدى تاريخ + قوائم */
    filterBar(spec, onChange) {
      const bar = U.el('div', { class: 'filter-bar' });
      (spec || []).forEach(function (f) {
        if (f.type === 'search') {
          const input = U.el('input', {
            type: 'search', placeholder: t('search'), value: f.value || '',
            oninput: U.debounce(function (e) { onChange(f.name, e.target.value); }, 250)
          });
          bar.appendChild(U.el('div', { class: 'filter-field grow' }, input));
        } else if (f.type === 'date') {
          bar.appendChild(U.el('div', { class: 'filter-field' }, [
            U.el('span', { class: 'filter-label', text: f.label }),
            U.el('input', {
              type: 'date', value: f.value || '',
              onchange: function (e) { onChange(f.name, e.target.value); }
            })
          ]));
        } else if (f.type === 'select') {
          const sel = U.el('select', { onchange: function (e) { onChange(f.name, e.target.value); } });
          (f.options || []).forEach(function (o) {
            sel.appendChild(U.el('option', { value: o.value, text: o.label, selected: String(o.value) === String(f.value || '') ? 'selected' : null }));
          });
          sel.value = f.value || '';
          bar.appendChild(U.el('div', { class: 'filter-field' }, [
            f.label ? U.el('span', { class: 'filter-label', text: f.label }) : null, sel
          ]));
        } else if (f.type === 'button') {
          bar.appendChild(U.el('button', { class: 'btn ghost sm', text: f.label, onclick: f.onClick }));
        }
      });
      return bar;
    },

    /* عند تعذّر التنزيل: نعرض النص لينسخه المستخدم */
    exportFallback(filename, text) {
      const area = U.el('textarea', { rows: '10', readonly: 'readonly' });
      area.value = text;
      UI.modal({
        title: filename,
        actions: false,
        body: U.el('div', {}, [
          U.el('div', { class: 'notice warn', text: t('export_copy_hint') }),
          area,
          U.el('button', {
            class: 'btn primary', style: { marginTop: '10px' }, text: t('copy'),
            onclick: function () {
              area.select();
              const done = function () { UI.toast(t('copied'), 'good'); };
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, function () {
                  try { document.execCommand('copy'); done(); } catch (e) { /* يبقى النص محددًا */ }
                });
              } else {
                try { document.execCommand('copy'); done(); } catch (e) { /* يبقى النص محددًا */ }
              }
            }
          })
        ])
      });
    },

    saveFile(filename, text, mime) {
      // داخل إطار محمي (معاينة أو استضافة مدمجة) لا يبدأ التنزيل ولا يُطلق خطأ،
      // فنعرض النص للنسخ مباشرة بدل نقرة لا تفعل شيئًا
      let framed = false;
      try { framed = root.self !== root.top; } catch (e) { framed = true; }
      if (framed || !U.download(filename, text, mime)) UI.exportFallback(filename, text);
      else UI.toast(filename, 'good');
    },

    /* ---------- الهيكل ---------- */
    renderShell() {
      const app = U.$('#app');
      U.clear(app);

      const company = EX.store.settings().company;
      const title = EX.i18n.lang === 'en' ? (company.nameEn || company.name) : company.name;

      const bar = U.el('div', { class: 'appbar' }, U.el('div', { class: 'wrap appbar-in' }, [
        U.el('div', { class: 'brand' }, [
          U.el('div', { class: 'logo', text: '⛰' }),
          U.el('div', {}, [
            U.el('div', { class: 'brand-name', text: title || t('app_name') }),
            U.el('div', { class: 'brand-sub', text: t('app_tagline') })
          ])
        ]),
        U.el('div', { class: 'spacer' }),
        U.el('button', { class: 'btn primary sm', text: '+ ' + t('new_load'), onclick: function () { EX.views.loadForm(); } }),
        U.el('button', {
          class: 'icon-btn', text: EX.i18n.lang === 'ar' ? 'EN' : 'ع', title: t('language'),
          onclick: function () { EX.app.toggleLang(); }
        }),
        U.el('button', {
          class: 'icon-btn', text: EX.store.settings().theme === 'dark' ? '☀' : '☾', title: t('theme'),
          onclick: function () { EX.app.toggleTheme(); }
        })
      ]));

      const tabs = U.el('div', { class: 'tabs' }, U.el('div', { class: 'wrap tabs-in' }, ROUTES.map(function (r) {
        return U.el('button', {
          class: 'tab' + (UI.route === r.id ? ' active' : ''),
          onclick: function () { UI.go(r.id); }
        }, [U.el('i', { text: r.icon }), U.el('span', { text: t(r.key) })]);
      })));

      const main = U.el('main', { class: 'wrap view', id: 'view' });

      const nav = U.el('nav', { class: 'bottom-nav' }, ROUTES.filter(function (r) { return r.primary; }).map(function (r) {
        return U.el('button', {
          class: 'nav-btn' + (UI.route === r.id ? ' active' : ''),
          onclick: function () { UI.go(r.id); }
        }, [U.el('i', { text: r.icon }), U.el('span', { text: t(r.key) })]);
      }));

      app.appendChild(bar);
      app.appendChild(tabs);
      app.appendChild(main);
      app.appendChild(nav);
      UI.renderView();
    },

    renderView() {
      const host = U.$('#view');
      if (!host) return;
      U.clear(host);
      const fn = EX.views[UI.route] || EX.views.dashboard;
      try {
        fn(host);
      } catch (e) {
        console.error(e);
        host.appendChild(U.el('div', { class: 'notice bad', text: 'خطأ في العرض: ' + e.message }));
      }
      const active = U.$('.tabs-in .tab.active');
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center' });
    },

    go(route, ctx) {
      UI.route = route;
      UI.ctx = ctx || {};
      if (location.hash !== '#' + route) {
        try { history.replaceState(null, '', '#' + route); } catch (e) { location.hash = route; }
      }
      UI.renderShell();
      root.scrollTo({ top: 0, behavior: 'auto' });
    },

    refresh() { UI.renderView(); },
    ROUTES: ROUTES
  };

  EX.ui = UI;
})(window);
