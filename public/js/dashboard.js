// Dashboard screen (F2). A per-page Mithril island: loads the server-computed rollup
// for the session's active budget (GET /api/budgets/{b}/dashboard — the E6 endpoint,
// the source of truth) and renders per-account cards, the combined Extra panel, and
// the spending/savings envelopes. Loaded after mithril + app.js via the layout's
// `scripts` section, so `m` and `window.NP` exist. Read-only, so no CSRF needed.
;(function () {
  var el = document.getElementById('dashboard-app')
  if (!el) return

  var boot = window.__NP__ || {}
  var bid = boot.active_budget_id || null

  function savedView() { try { return localStorage.getItem('np-dash-view') } catch (e) { return null } }

  var state = {
    loading: true,
    error: false,
    data: null,
    detailed: savedView() !== 'simple', // detailed by default; the health bars are the point
  }

  function load() {
    if (!bid) { state.loading = false; return }
    m.request({ method: 'GET', url: '/api/budgets/' + bid + '/dashboard' }).then(
      function (res) { state.loading = false; state.data = res.data },
      function () { state.loading = false; state.error = true }
    )
  }

  function setDetailed(v) {
    state.detailed = v
    try { localStorage.setItem('np-dash-view', v ? 'detailed' : 'simple') } catch (e) {}
  }

  // --- money formatting (amounts are DECIMAL strings; the budget carries the code) ---
  var SYMBOL = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: '$', AUD: '$' }
  function money(s) {
    var cur = state.data && state.data.budget ? state.data.budget.base_currency : ''
    var n = Number(s)
    var body = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return (n < 0 ? '-' : '') + (SYMBOL[cur] || '') + body
  }

  // Envelope fill = spent / (limit + saved), clamped; classes drive the color.
  function healthBar(c) {
    var denom = Number(c.monthly_limit) + Number(c.saved)
    var p = denom <= 0 ? (Number(c.spent) > 0 ? 100 : 0) : (Number(c.spent) / denom) * 100
    p = Math.max(0, Math.min(100, p))
    var sel = '.health-fill'
    if (Number(c.spent) > denom) sel += '.is-over'
    else if (p >= 75) sel += '.is-warn'
    return m('.mt-2', [
      m('.health', m('span' + sel, { style: { width: p + '%' } })),
      m('.mt-1.flex.justify-between.mono.text-xs.text-muted', [
        m('span', money(c.spent) + ' spent'),
        Number(c.saved) > 0 ? m('span', money(c.saved) + ' saved') : null,
      ]),
    ])
  }

  function categoryRow(c) {
    var overspent = Number(c.remaining) < 0
    return m('.border-b.border-line.py-3', [
      m('.flex.items-center.justify-between.gap-3', [
        m('a.font-medium.no-underline', { href: '/history?category=' + c.id }, c.name),
        m('.flex.items-center.gap-3', [
          m('span.mono.text-sm' + (overspent ? '.text-red-300' : '.text-muted'), money(c.remaining)),
          // The + jumps to the add-purchase form (F4) with this envelope pre-filled
          // as the source; the form pre-selects the user's default payment account.
          m('a.options-btn', { href: '/entry?type=purchase&from=' + c.id, title: 'Add purchase from ' + c.name, 'aria-label': 'Add purchase from ' + c.name }, '+'),
        ]),
      ]),
      state.detailed && c.type === 'standard' ? healthBar(c) : null,
      state.detailed && c.type !== 'standard' && Number(c.saved) > 0
        ? m('.mono.mt-1.text-xs.text-muted', money(c.saved) + ' saved' + (Number(c.monthly_limit) > 0 ? ' · goal ' + money(c.monthly_limit) : ''))
        : null,
    ])
  }

  function categoriesPanel(d) {
    return m('.card', [
      m('.mb-2.flex.items-center.justify-between', [
        m('p.eyebrow.mb-0', 'Envelopes'),
        m('.flex.gap-1.text-xs', [
          m('button.options-btn' + (state.detailed ? '.text-accent' : ''), { onclick: function () { setDetailed(true) } }, 'Detailed'),
          m('button.options-btn' + (!state.detailed ? '.text-accent' : ''), { onclick: function () { setDetailed(false) } }, 'Simple'),
        ]),
      ]),
      d.categories.length ? d.categories.map(categoryRow) : m('p.text-muted.text-sm', 'No envelopes yet.'),
    ])
  }

  function line(label, value, opts) {
    opts = opts || {}
    return m('.flex.justify-between', [
      m('span', label),
      m('span' + (opts.cls || ''), money(value)),
    ])
  }

  function extraPanel(d) {
    var r = d.rollup
    var neg = Number(r.extra) < 0
    return m('.card', [
      m('p.eyebrow', 'Extra'),
      m('.mono.text-3xl.font-bold' + (neg ? '.text-red-300' : '.text-accent'), money(r.extra)),
      m('.mt-4.space-y-1.mono.text-sm.text-muted', [
        line('Bank balance', r.bank_total),
        line('− Remaining budget', r.remaining_budget),
        line('− Saved', r.saved),
        line('− For CC payment(s)', r.cc_owed),
      ]),
    ])
  }

  function accountsPanel(d) {
    var banks = d.accounts.filter(function (a) { return a.type === 'bank' })
    var cards = d.accounts.filter(function (a) { return a.type === 'credit_card' })
    return [
      banks.length ? m('.card', [
        m('p.eyebrow', 'Accounts'),
        banks.map(function (a) {
          return m('.py-1', [
            m('.flex.justify-between', [m('span', a.name), m('span.mono.text-sm', money(a.balance))]),
            // When savings are pinned here, show what's earmarked vs. free.
            Number(a.earmarked) > 0 ? m('.mono.text-xs.text-muted', money(a.free) + ' free · ' + money(a.earmarked) + ' earmarked') : null,
          ])
        }),
      ]) : null,
      cards.length ? m('.card', [
        m('p.eyebrow', 'Credit cards'),
        cards.map(function (a) {
          return m('.py-1', [
            m('.flex.justify-between', [m('span', a.name), m('span.mono.text-sm', money(a.balance) + ' owed')]),
            m('.mono.text-xs.text-muted', (a.credit_limit ? 'limit ' + money(a.credit_limit) : '') + (a.due_date ? ' · due day ' + a.due_date : '')),
          ])
        }),
      ]) : null,
    ]
  }

  var Dashboard = {
    oninit: load,
    view: function () {
      if (!bid) {
        return m('.card', [m('p.eyebrow', 'No budget selected'), m('p.text-muted', 'Pick a budget from the switcher above to see its dashboard.')])
      }
      if (state.loading) return m('p.text-muted', 'Loading…')
      if (state.error) return m('.card', m('p.text-red-300', 'Could not load the dashboard.'))

      var d = state.data
      return [
        m('.mb-4.flex.items-baseline.justify-between', [
          m('h1.text-2xl.font-semibold', d.budget.name),
          m('span.eyebrow.mb-0', d.budget.base_currency),
        ]),
        // Categories first in the DOM so they lead on mobile (thumb reach); on md+
        // the summary (Extra + accounts) sits alongside in a sidebar column.
        m('.grid.gap-6.md:grid-cols-3', [
          m('.md:col-span-2', categoriesPanel(d)),
          m('.space-y-6.md:col-span-1', [extraPanel(d), accountsPanel(d)]),
        ]),
      ]
    },
  }

  m.mount(el, Dashboard)
})()
