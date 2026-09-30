// Nickelpinch — no build step. Mithril is vendored (global `m`); this is a plain
// script. As screens land (Epic F) they mount Mithril islands guarded by getElementById.

// Shared toolkit for the Mithril islands. NP.req is the only sanctioned way to hit
// a mutating JSON endpoint: it carries the CSRF token the server requires on XHR
// (the SameSite=Lax session cookie is the first factor; this custom header, which a
// cross-origin page cannot set without a CORS preflight we never grant, is the
// second). The token is emitted into <meta name="csrf-token"> for logged-in pages.
window.NP = window.NP || {}
;(function (NP) {
  var meta = document.querySelector('meta[name="csrf-token"]')
  NP.csrf = meta ? meta.getAttribute('content') : ''

  // Mutating JSON request through Mithril, with the CSRF header attached.
  NP.req = function (method, url, body) {
    return m.request({
      method: method,
      url: url,
      body: body,
      headers: { 'X-CSRF-Token': NP.csrf },
    })
  }

  // --- shared money helpers (integer cents; no float) — DECIMAL(22,2) at the edges.
  NP.toCents = function (dec) {
    dec = String(dec == null ? '' : dec).trim()
    var neg = dec.charAt(0) === '-'
    if (neg) dec = dec.slice(1)
    var parts = dec.split('.')
    var frac = ((parts[1] || '') + '00').slice(0, 2)
    var c = (parseInt(parts[0], 10) || 0) * 100 + (parseInt(frac, 10) || 0)
    return neg ? -c : c
  }
  NP.fromCents = function (c) {
    var neg = c < 0
    c = Math.abs(c)
    return (neg ? '-' : '') + Math.floor(c / 100) + '.' + String(c % 100).padStart(2, '0')
  }
  var SYMBOL = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: '$', AUD: '$' }
  NP.money = function (currency, s) {
    var n = Number(s)
    var body = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return (n < 0 ? '-' : '') + (SYMBOL[currency] || '') + body
  }

  // A labeled Hangar form field for the island forms (CODE-387). onset(value) receives
  // changes. opts: options + segment -> a Hangar segmented selector; options [[value, label], ...] -> a Hangar select (a leading ['', text]
  // is the placeholder; opts.optional makes "none" pickable); + search -> a type-to-filter
  // combobox; type 'date' -> the Hangar date picker; else a text-ish input (type, ph,
  // inputmode). Ids are stable across redraws — derived from the label, plus opts.key
  // where one label repeats (split rows) — so <label for> keeps pairing.
  var NONE = '__none' // data-value for the optional "none" pick ('' can't be a value)
  NP.field = function (label, value, onset, opts) {
    opts = opts || {}
    var id = opts.id || 'f-' + String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-') + (opts.key != null ? '-' + opts.key : '')
    var control = opts.segment ? NP.segment(label, opts.options, value, onset, id + '-label')
      : opts.options ? pickField(id, value, onset, opts)
      : opts.type === 'date' ? dateField(id, value, onset)
      : m('.hud-field.hud-brackets', m('input.hud-input', {
          id: id, type: opts.type || 'text', value: value == null ? '' : value, placeholder: opts.ph || '',
          inputmode: opts.inputmode, oninput: function (e) { onset(e.target.value) },
        }))
    // A segmented choice is a radiogroup (not labelable): it's named via aria-labelledby.
    return m('.hud-form-field.mb-3', [m('label.hud-label', { for: opts.segment ? null : id, id: id + '-label' }, label), control])
  }

  // Select or combobox over [[value, label], ...] through NP.Hud. The widget owns the
  // trigger text / input text and aria-selected, so none of that is rendered here; the
  // value is pushed in, user picks come back through onChange / hud-change.
  function pickField(id, value, onset, opts) {
    var ph = opts.options.length && opts.options[0][0] === '' ? opts.options[0][1] : ''
    var list = opts.options.filter(function (o) { return o[0] !== '' })
    // A select needs a real "none" option to go back to; a combobox clears by emptying
    // its input, and a none option there would write its label into the input.
    var none = opts.optional && !opts.search
    if (none) list.unshift([NONE, ph || 'None'])
    var popover = m('.hud-pop.hud-brackets--diag[popover=manual]', [
      m('.hud-pop-list[role=listbox]', { 'aria-labelledby': id + '-label' }, list.map(function (o) {
        return m('.hud-pop-opt[role=option]', { key: String(o[0]), 'data-value': String(o[0]) }, m('span.hud-pop-opt-label', o[1]))
      })),
      opts.search ? m('.hud-pop-msg[role=status][data-empty=No matches]') : null,
    ])
    return m(NP.Hud, {
      use: ['listbox'], ident: id + (opts.search ? ':combobox' : ':select'),
      value: value === '' || value == null ? (none ? NONE : null) : String(value),
      init: function (dom, H) {
        var list = dom.querySelector('[role=listbox]')
        if (!opts.search) {
          return H.listbox.select(dom.querySelector('.hud-select-trigger'), list, {
            onChange: function (d) { onset(d.value == null || d.value === NONE ? '' : d.value); m.redraw() },
          })
        }
        var input = dom.querySelector('.hud-combobox-input')
        input.addEventListener('hud-change', function (e) {
          onset(e.detail.value == null || e.detail.value === NONE ? '' : e.detail.value)
          m.redraw()
        })
        return H.listbox.combobox(input, list)
      },
    }, opts.search ? [
      m('.hud-field.hud-brackets.w-full', [
        m('input.hud-input.hud-combobox-input', { id: id, placeholder: ph || 'Search…' }),
        m('button.hud-combobox-toggle[type=button][tabindex=-1]', { 'aria-label': 'Show all' }),
      ]),
      popover,
    ] : [
      m('button.hud-field.hud-select-trigger.hud-brackets.w-full[type=button]', { id: id }, m('span.hud-select-trigger-value', { 'data-placeholder': ph || 'Choose…' })),
      popover,
    ])
  }

  // The Hangar date picker (ISO YYYY-MM-DD). It inserts its popover after the trigger,
  // so the host is frozen: Mithril renders it once and never diffs Hangar's siblings.
  function dateField(id, value, onset) {
    return m(NP.Hud, {
      use: ['calendar'], ident: id, frozen: true, value: value || null,
      init: function (dom, H) {
        var trigger = dom.querySelector('.hud-datepicker-trigger')
        trigger.addEventListener('hud-change', function (e) { onset(e.detail.iso || ''); m.redraw() })
        return H.calendar.datePicker(trigger, { value: value || null })
      },
    }, m('button.hud-field.hud-datepicker-trigger.hud-brackets.w-full', { id: id }))
  }

  // Shared island states: a titled card (e.g. "No budget selected") and an error
  // callout inserted after a failure (role=alert — Hangar: never on page load).
  NP.notice = function (title, text) {
    return m('section.hud-card.hud-brackets.p-5', [
      NP.bar(title),
      m('p.mt-2.text-muted', text),
    ])
  }
  NP.alert = function (text, title) {
    return m('.hud-callout.hud-callout--error[role=alert]', [
      m('span.hud-callout-glyph[aria-hidden=true]'),
      m('.hud-callout-body', [title ? m('p.hud-callout-title', title) : null, m('p.hud-callout-text', text)]),
    ])
  }

  // Hangar segmented selector over [[value, label], ...] through NP.Hud + radioGroup —
  // a choice inside a form (Hangar: a switch applies at once; this waits for Save).
  // radioGroup owns aria-checked / .is-active / tabindex, so the options render
  // neither; `current` is pushed in and a pick calls onpick(value). Named by `label`,
  // or by the element id in `labelledby` when a visible label exists.
  NP.segment = function (label, items, current, onpick, labelledby) {
    return m(NP.Hud, {
      use: ['group'], value: current, ident: label,
      attrs: { class: 'hud-field hud-selector', role: 'radiogroup', 'aria-label': labelledby ? null : label, 'aria-labelledby': labelledby || null },
      init: function (dom, H) {
        dom.addEventListener('hud-change', function (e) { onpick(e.detail.value); m.redraw() })
        return H.group.radioGroup(dom)
      },
    }, items.map(function (x) {
      return m('button.hud-selector-opt[type=button][role=radio]', { key: x[0], 'data-value': x[0] }, x[1])
    }))
  }

  // Hangar tabs over [[key, label], ...] through NP.Hud: `current` is pushed in as the
  // index and a user pick calls onpick(key); tabs() owns aria-selected / tabindex, so
  // the tab buttons render neither. `segment` is the segmented look (2–5 tabs; wraps
  // rather than scrolls on a phone).
  NP.tabs = function (label, items, current, onpick, segment) {
    var keys = items.map(function (x) { return x[0] })
    return m(NP.Hud, {
      use: ['tabs'], value: keys.indexOf(current), attrs: { class: 'hud-tabs' },
      init: function (dom, H) {
        dom.addEventListener('hud-tabchange', function (e) { onpick(keys[e.detail.index]); m.redraw() })
        return H.tabs.tabs(dom)
      },
    }, m('.hud-tablist[role=tablist]' + (segment ? '.hud-tablist--segment.hud-brackets' : ''), { 'aria-label': label }, items.map(function (x) {
      return m('button.hud-tab[type=button][role=tab]', { key: x[0] }, x[1])
    })))
  }

  // --- feedback (CODE-392) ---
  // NP.confirm: a Hangar alert dialog in place of window.confirm, built on demand in
  // <body> (outside the islands) and removed after. The title and the action button
  // name what happens; initial focus sits on the safe way out; Escape or "keep"
  // resolves false. Text goes in via textContent, never markup.
  var dialogSeq = 0
  NP.confirm = function (title, body, action, keep) {
    var id = 'np-confirm-' + (++dialogSeq)
    var d = document.createElement('dialog')
    d.className = 'hud-dialog hud-dialog--alert hud-dialog--sm hud-brackets'
    d.setAttribute('role', 'alertdialog')
    d.setAttribute('aria-labelledby', id + '-t')
    d.setAttribute('aria-describedby', id + '-d')
    d.innerHTML = '<header class="hud-dialog-head"><span class="hud-dialog-icon" aria-hidden="true">▲</span>' +
      '<h2 class="hud-dialog-title" id="' + id + '-t"></h2></header>' +
      '<div class="hud-dialog-body"><p id="' + id + '-d"></p></div>' +
      '<footer class="hud-dialog-actions"><button class="hud-actuator hud-actuator--ghost" type="button" data-hud-close autofocus></button>' +
      '<button class="hud-actuator hud-actuator--danger" type="button" data-hud-close="confirm"></button></footer>'
    d.querySelector('h2').textContent = title
    d.querySelector('p').textContent = body
    d.querySelector('[data-hud-close=""]').textContent = keep || 'Cancel'
    d.querySelector('[data-hud-close=confirm]').textContent = action
    document.body.appendChild(d)
    return NP.hudLoad(['dialog']).then(function (H) { return H.dialog.openDialog(d) }).then(function (v) {
      d.remove()
      return v === 'confirm'
    })
  }

  // NP.toast: a Hangar toast (tone ok / info / warn / error — errors stay until
  // dismissed, per Hangar). The region is created once, bottom-right, clear of the
  // app header; its live regions exist before the first toast so it's announced.
  var toastRegion = null
  NP.toast = function (title, tone, description) {
    return NP.hudLoad(['toast']).then(function (H) {
      if (!toastRegion) toastRegion = H.toast.toastRegion({ max: 4, placement: 'block-end inline-end' })
      return toastRegion.toast({ title: title, tone: tone || 'ok', description: description })
    })
  }

  // Hangar section bar: ▸ LABEL ──── [end]. `end` is an optional trailing vnode (a
  // count or a control); `tag` is the heading level (default h2), kept in the outline.
  // Used as a card header, so it drops Hangar's 18px top margin (meant for sections
  // flowing down a page), which would otherwise stack on the card's padding.
  NP.bar = function (label, end, tag) {
    return m('.hud-section-bar.mt-0', [
      m('span.hud-section-tick[aria-hidden=true]', '▸'),
      m((tag || 'h2') + '.hud-section-label', label),
      m('span.hud-section-rule[aria-hidden=true]'),
      end || null,
    ])
  }

  // --- Hangar behaviour modules (CODE-384) ---
  // The vendored modules under /js/hangar/ are ES modules; the islands are classic
  // scripts. Dynamic import() works from classic scripts, so a page loads only the
  // modules it uses, on first use, with no module-script ordering race. Resolves to
  // { name: moduleNamespace }, e.g. H.tabs.tabs(root), H.listbox.select(trigger, list).
  var hudCache = {}
  NP.hudLoad = function (names) {
    return Promise.all(names.map(function (n) {
      return hudCache[n] || (hudCache[n] = import('/js/hangar/' + n + '.js'))
    })).then(function (mods) {
      var H = {}
      names.forEach(function (n, i) { H[n] = mods[i] })
      return H
    })
  }

  // NP.Hud — the one Mithril adapter every Hangar widget goes through.
  //
  //   m(NP.Hud, {
  //     use: ['tabs'],                                   // modules to load
  //     init: function (dom, H) { return H.tabs.tabs(dom, { ... }) }, // build + wire, return the handle
  //     value: state.tab,     // optional: pushed with handle.setValue() when it changes
  //     ident: 'f-amount',    // optional: which widget this is (see below)
  //     frozen: true,         // optional: DOM-building modules (calendar, table)
  //     tag: 'div', attrs: { class: 'hud-tabs' },        // the host element
  //   }, children)
  //
  // Lifecycle: oncreate loads the modules and calls init(dom, H); value changes are
  // pushed with setValue(), which fires no event, so state -> widget -> state can't loop
  // (widget -> state goes through the onChange / hud-* listener init wires); onremove
  // calls destroy(), including when the island unmounts before the modules arrive.
  //
  // Identity: Mithril reuses a component instance at the same position across
  // redraws, so when a form swaps one widget for another there (entry type Purchase ->
  // Move turns "Paid from" into "To envelope"), the instance is patched, not recreated.
  // `ident` + `use` name the widget; when they change, the old handle is destroyed and
  // init runs again on the new markup. A generation counter drops a load still in
  // flight for the old identity.
  //
  // Rules for markup inside an NP.Hud:
  //  1. Never render attributes the module owns on the elements it manages —
  //     aria-selected / aria-expanded / aria-activedescendant, `hidden` on panels,
  //     roving `tabindex`. Mithril only diffs attributes it rendered, so leaving them
  //     out leaves them to Hangar; rendering them would reset Hangar's state on redraw.
  //  2. DOM-building modules (calendar, table) get `frozen: true`: Mithril renders the
  //     host once and never re-diffs its children (same as the Lightweight Charts host);
  //     value still flows in through setValue().
  function hudPush(st, attrs) {
    if (!('value' in attrs)) return
    if (st.handle && st.handle.setValue && attrs.value !== st.value) st.handle.setValue(attrs.value)
    st.value = attrs.value // remembered even before the handle exists; applied once it does
  }
  function hudInit(vnode) {
    var st = vnode.state
    var gen = st.gen = (st.gen || 0) + 1
    st.ident = vnode.attrs.use.join(',') + '|' + (vnode.attrs.ident || '')
    st.value = vnode.attrs.value
    st.handle = null
    NP.hudLoad(vnode.attrs.use).then(function (H) {
      if (st.gen !== gen) return // unmounted, or re-initialised, while the modules loaded
      st.handle = vnode.attrs.init(vnode.dom, H)
      if (st.value !== undefined && st.handle && st.handle.setValue) st.handle.setValue(st.value)
    })
  }
  function hudTeardown(st) {
    st.gen = (st.gen || 0) + 1
    if (st.handle && st.handle.destroy) st.handle.destroy()
    st.handle = null
  }
  function hudSame(vnode) {
    return vnode.attrs.use.join(',') + '|' + (vnode.attrs.ident || '') === vnode.state.ident
  }
  NP.Hud = {
    oncreate: hudInit,
    onbeforeupdate: function (vnode) {
      if (!vnode.attrs.frozen || !hudSame(vnode)) return true
      hudPush(vnode.state, vnode.attrs) // frozen hosts skip onupdate, so push here
      return false
    },
    onupdate: function (vnode) {
      if (hudSame(vnode)) return hudPush(vnode.state, vnode.attrs)
      hudTeardown(vnode.state)
      hudInit(vnode)
    },
    onremove: function (vnode) { hudTeardown(vnode.state) },
    view: function (vnode) { return m(vnode.attrs.tag || 'div', vnode.attrs.attrs || {}, vnode.children) },
  }
})(window.NP)

;(function () {
  var root = document.documentElement

  // Theme toggle (dark is the default). Anonymous viewers persist to localStorage;
  // logged-in users get a server-saved theme once the users.theme column lands.
  var toggle = document.getElementById('theme-toggle')
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = (root.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark'
      root.setAttribute('data-theme', next)
      try { localStorage.setItem('np-theme', next) } catch (e) {}
      // Logged-in users (the shell stamps data-auth): persist the choice server-side
      // so it follows them across reloads and devices (F7 / E8). Fire-and-forget.
      if (root.getAttribute('data-auth')) { NP.req('PUT', '/api/settings', { theme: next }).catch(function () {}) }
    })
  }

  // Server flash messages arrive as window.__NP_FLASH__ (basic.php) and show as toasts.
  ;(window.__NP_FLASH__ || []).forEach(function (f) { NP.toast(f.text, f.tone) })

  // Mobile nav (CODE-310): the hamburger shows below sm; it toggles the menu panel's
  // `hidden` class (sm:flex keeps it inline on desktop regardless).
  var navToggle = document.getElementById('nav-toggle')
  var navMenu = document.getElementById('nav-menu')
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      var open = navMenu.classList.toggle('hidden') === false
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
    })
  }
})()

// Budget switcher (F1). A shell-level Mithril island: lists the budgets the user can
// reach (GET /api/budgets), marks the session's active one (from window.__NP__), and
// on change switches it server-side (POST .../switch) then reloads so the
// server-rendered pages pick up the new active_budget_id. Only mounts where the shell
// left a #budget-switcher node — i.e. for logged-in pages.
;(function () {
  var el = document.getElementById('budget-switcher')
  if (!el) return

  var boot = window.__NP__ || {}
  var state = { budgets: null, active: boot.active_budget_id || null }

  function load() {
    NP.req('GET', '/api/budgets').then(
      function (res) { state.budgets = (res && res.data) || [] },
      function () { state.budgets = [] }
    )
  }

  function switchTo(id) {
    if (!id || id === state.active) return
    NP.req('POST', '/api/budgets/' + id + '/switch').then(function () {
      window.location.reload()
    }, function () { NP.toast('Could not switch budget', 'error') })
  }

  // A Hangar select (CODE-385) through NP.Hud: the role rides as option metadata
  // (MEMBER / VIEWER), and a user's pick switches server-side. Options carry no
  // aria-selected — the select owns it; the active id is pushed in as `value`.
  var Switcher = {
    oninit: load,
    view: function () {
      if (state.budgets === null) return null // still loading
      if (!state.budgets.length) return m('span.text-sm.text-muted', 'No budgets yet')

      // If the session's active budget isn't one we can reach (access lost), show the
      // placeholder rather than silently implying the wrong budget.
      var inList = state.budgets.some(function (b) { return b.id === state.active })
      return m(NP.Hud, {
        use: ['listbox'],
        value: inList ? String(state.active) : null,
        init: function (dom, H) {
          return H.listbox.select(dom.querySelector('.hud-select-trigger'), dom.querySelector('[role=listbox]'), {
            onChange: function (d) { switchTo(Number(d.value)) },
          })
        },
      }, [
        m('button.hud-field.hud-select-trigger.hud-brackets.w-full[type=button][aria-label=Active budget]',
          m('span.hud-select-trigger-value[data-placeholder=Select budget…]')),
        m('.hud-pop.hud-brackets--diag[popover=manual]',
          m('.hud-pop-list[role=listbox][aria-label=Budgets]', state.budgets.map(function (b) {
            return m('.hud-pop-opt[role=option]', { key: b.id, 'data-value': String(b.id) }, [
              m('span.hud-pop-opt-label', b.name),
              b.role && b.role !== 'owner' ? m('span.hud-pop-opt-meta', b.role.toUpperCase()) : null,
            ])
          }))),
      ])
    },
  }

  m.mount(el, Switcher)
})()
