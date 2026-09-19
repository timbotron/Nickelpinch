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

  // A themed <select> (appearance:none + a themed chevron) so dropdowns match the app
  // rather than showing native OS chrome. `options` are pre-built <option> vnodes;
  // `attrs` go on the select; `wrapCls` sizes the wrapper (e.g. 'w-full sm:w-56').
  var CHEVRON = '<span class="select-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>'
  NP.select = function (options, attrs, wrapCls) {
    return m('.select-wrap' + (wrapCls ? '.' + wrapCls.replace(/\s+/g, '.') : ''), [
      m('select.select', attrs, options),
      m.trust(CHEVRON),
    ])
  }

  // A labeled input or themed select for the island forms. onset(value) receives
  // changes; pass opts.options as [[value, label], ...] for a select, else opts.type/ph.
  NP.field = function (label, value, onset, opts) {
    opts = opts || {}
    var control = opts.options
      ? NP.select(
          opts.options.map(function (o) { return m('option', { value: o[0], selected: String(o[0]) === String(value) }, o[1]) }),
          { onchange: function (e) { onset(e.target.value) } })
      : m('input.field', { type: opts.type || 'text', value: value == null ? '' : value, placeholder: opts.ph || '', oninput: function (e) { onset(e.target.value) } })
    return m('label.mb-2.block', [m('span.mono.mb-1.block.text-xs.text-muted', label), control])
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
    })
  }

  var Switcher = {
    oninit: load,
    view: function () {
      if (state.budgets === null) return null // still loading
      if (!state.budgets.length) return m('span.text-sm.text-muted', 'No budgets yet')

      // If the session's active budget isn't one we can reach (access lost), fall
      // back to a placeholder rather than silently showing the wrong budget.
      var inList = state.budgets.some(function (b) { return b.id === state.active })
      var options = state.budgets.map(function (b) {
        var label = b.name + (b.role && b.role !== 'owner' ? ' (' + b.role + ')' : '')
        return m('option', { value: b.id, selected: inList && b.id === state.active }, label)
      })
      if (!inList) {
        options.unshift(m('option', { value: '', selected: true, disabled: true }, 'Select budget…'))
      }
      // Full width in the mobile accordion; a fixed width on desktop.
      return NP.select(options, {
        'aria-label': 'Active budget',
        onchange: function (e) { switchTo(Number(e.target.value)) },
      }, 'w-full sm:w-56')
    },
  }

  m.mount(el, Switcher)
})()
