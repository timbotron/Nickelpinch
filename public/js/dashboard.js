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

  // Per-viewer group collapse state, keyed by budget. Groups are collapsed by
  // default; we persist only the set the viewer has expanded (CODE-351).
  var GKEY = 'np-dash-groups-' + bid
  function loadExpanded() { try { return JSON.parse(localStorage.getItem(GKEY) || '[]') } catch (e) { return [] } }

  var state = {
    loading: true,
    error: false,
    data: null,
    detailed: savedView() !== 'simple', // detailed by default; the health bars are the point
    expanded: {}, // group id -> true when expanded
  }
  loadExpanded().forEach(function (id) { state.expanded[id] = true })

  function toggleGroup(id) {
    if (state.expanded[id]) delete state.expanded[id]
    else state.expanded[id] = true
    try { localStorage.setItem(GKEY, JSON.stringify(Object.keys(state.expanded).map(Number))) } catch (e) {}
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

  // Rows power on (Hangar hud-flash-in) staggered 40ms down the list via --hud-delay;
  // keyed rows keep their element across redraws, so it plays once per row.
  var OVER = { color: 'var(--hud-error-ink)' }

  // Envelope fill = spent / (limit + saved), clamped — a Hangar segmented gauge, warn
  // at >= 75%, error when over. `label` names the bar for assistive tech.
  function healthBar(c, label) {
    var denom = Number(c.monthly_limit) + Number(c.saved)
    var p = denom <= 0 ? (Number(c.spent) > 0 ? 100 : 0) : (Number(c.spent) / denom) * 100
    p = Math.max(0, Math.min(100, p))
    var tone = Number(c.spent) > denom ? '.hud-progress--error' : p >= 75 ? '.hud-progress--warn' : ''
    return m('.mt-2', [
      m('progress.hud-progress.w-full' + tone, { value: Math.round(p), max: 100, 'aria-label': label + ' spent' }),
      m('.hud-readout.mt-1.flex.justify-between.text-xs', [
        m('span', [m('span.lbl', 'SPENT '), NP.money(state.data.budget.base_currency, c.spent)]),
        Number(c.saved) > 0 ? m('span', [m('span.lbl', 'SAVED '), NP.money(state.data.budget.base_currency, c.saved)]) : null,
      ]),
    ])
  }

  function categoryRow(c, i) {
    return m('.hud-flash-in.border-b.border-line.py-3', { key: c.id, style: { '--hud-delay': (i * 40) + 'ms' } }, [
      m('.flex.items-center.justify-between.gap-3', [
        m('a.font-medium.no-underline', { href: '/history?category=' + c.id }, c.name),
        m('.flex.items-center.gap-2', [
          m('span.font-mono.text-sm.text-muted', { style: Number(c.remaining) < 0 ? OVER : null }, NP.money(state.data.budget.base_currency, c.remaining)),
          // The + jumps to the add-purchase form (F4) with this envelope pre-filled
          // as the source; the form pre-selects the user's default payment account.
          m('a.hud-actuator.hud-actuator--ghost.hud-actuator--icon.hud-actuator--sm', { href: '/entry?type=purchase&from=' + c.id, title: 'Add purchase from ' + c.name, 'aria-label': 'Add purchase from ' + c.name }, '+'),
        ]),
      ]),
      state.detailed && c.type === 'standard' ? healthBar(c, c.name) : null,
      state.detailed && c.type !== 'standard' && Number(c.saved) > 0
        ? m('.hud-readout.mt-1.text-xs', [m('span.lbl', 'SAVED '), NP.money(state.data.budget.base_currency, c.saved), Number(c.monthly_limit) > 0 ? [m('span.lbl', ' · GOAL '), NP.money(state.data.budget.base_currency, c.monthly_limit)] : null])
        : null,
    ])
  }

  // A group is a native <details> accordion item: the browser owns open/close, and
  // ontoggle feeds the per-viewer persistence (guarded, since toggle also fires when
  // Mithril sets `open` from state). The summary carries the rolled-up "left";
  // collapsed & detailed, a summary gauge sits under it; open, the children power on.
  function groupRow(g, kids, i) {
    var open = !!state.expanded[g.id]
    return m('.hud-flash-in.border-b.border-line', { key: 'g' + g.id, style: { '--hud-delay': (i * 40) + 'ms' } }, [
      m('details.hud-accordion-item', {
        open: open,
        ontoggle: function (e) { if (e.target.open !== !!state.expanded[g.id]) toggleGroup(g.id) },
      }, [
        m('summary', [
          m('h3', g.name),
          m('span.hud-accordion-meta', { style: Number(g.remaining) < 0 ? OVER : null }, ('0' + kids.length).slice(-2) + ' ENV · ' + NP.money(state.data.budget.base_currency, g.remaining)),
        ]),
        m('.hud-accordion-content', kids.map(categoryRow)),
      ]),
      state.detailed && !open ? m('.pb-3', healthBar(g, g.name)) : null,
    ])
  }

  function categoriesPanel(d) {
    var groups = d.groups || []
    var groupIds = {}
    groups.forEach(function (g) { groupIds[g.id] = true })
    // Bucket categories under their group; anything ungrouped (or whose group didn't
    // come back, e.g. only-archived) renders flat.
    var byGroup = {}
    var ungrouped = []
    d.categories.forEach(function (c) {
      if (c.group_id != null && groupIds[c.group_id]) { (byGroup[c.group_id] = byGroup[c.group_id] || []).push(c) }
      else ungrouped.push(c)
    })
    return m('section.hud-card.hud-brackets--diag.p-5', [
      // Detailed / Simple as a Hangar segmented selector (NP.segment).
      m('.mb-2', NP.bar('Envelopes', NP.segment('Envelope view', [['detailed', 'DETAIL'], ['simple', 'SIMPLE']], state.detailed ? 'detailed' : 'simple', function (v) { setDetailed(v === 'detailed') }))),
      d.categories.length ? [
        groups.map(function (g, i) { return groupRow(g, byGroup[g.id] || [], i) }),
        ungrouped.map(function (c, i) { return categoryRow(c, groups.length + i) }),
      ] : m('p.text-muted.text-sm', 'No envelopes yet.'),
    ])
  }

  function line(label, value) {
    return m('.flex.justify-between', [m('span.lbl', label), m('span', NP.money(state.data.budget.base_currency, value))])
  }

  // Extra is the hero readout: a Hangar stat tile, then the reconciliation readout.
  function extraPanel(d) {
    var r = d.rollup
    return m('section.hud-card.hud-brackets.p-5', [
      NP.bar('Extra'),
      m('.hud-stat.hud-brackets--tl.mt-3', [
        m('.hud-stat-label', 'FREE TO SPEND'),
        m('.hud-stat-value.text-3xl', { style: Number(r.extra) < 0 ? OVER : null }, NP.money(state.data.budget.base_currency, r.extra)),
      ]),
      m('.hud-readout.mt-4.space-y-1.text-sm', [
        line('BANK', r.bank_total),
        line('− BUDGET LEFT', r.remaining_budget),
        line('− SAVED', r.saved),
        line('− CC OWED', r.cc_owed),
      ]),
    ])
  }

  function accountsPanel(d) {
    var banks = d.accounts.filter(function (a) { return a.type === 'bank' })
    var cards = d.accounts.filter(function (a) { return a.type === 'credit_card' })
    return [
      banks.length ? m('section.hud-card.p-5', [
        NP.bar('Accounts', m('span.hud-section-count', ('0' + banks.length).slice(-2))),
        banks.map(function (a) {
          return m('.py-2', { key: a.id }, [
            m('.flex.justify-between', [m('span', a.name), m('span.font-mono.text-sm', NP.money(state.data.budget.base_currency, a.balance))]),
            // When savings are pinned here, show what's earmarked vs. free.
            Number(a.earmarked) > 0 ? m('.hud-readout.text-xs', [m('span.lbl', 'FREE '), NP.money(state.data.budget.base_currency, a.free), m('span.lbl', ' · EARMARKED '), NP.money(state.data.budget.base_currency, a.earmarked)]) : null,
          ])
        }),
      ]) : null,
      cards.length ? m('section.hud-card.p-5', [
        NP.bar('Credit cards', m('span.hud-section-count', ('0' + cards.length).slice(-2))),
        cards.map(function (a) {
          return m('.py-2', { key: a.id }, [
            m('.flex.justify-between', [m('span', a.name), m('span.font-mono.text-sm', NP.money(state.data.budget.base_currency, a.balance) + ' owed')]),
            m('.hud-readout.text-xs', [
              a.credit_limit ? [m('span.lbl', 'LIMIT '), NP.money(state.data.budget.base_currency, a.credit_limit)] : null,
              a.due_date ? [m('span.lbl', (a.credit_limit ? ' · ' : '') + 'DUE DAY '), ('0' + a.due_date).slice(-2)] : null,
            ]),
          ])
        }),
      ]) : null,
    ]
  }

  var Dashboard = {
    oninit: load,
    view: function () {
      if (!bid) {
        return NP.notice('No budget selected', 'Pick a budget from the switcher above to see its dashboard.')
      }
      if (state.loading) return m('progress.hud-progress.w-full[aria-label=Loading dashboard]')
      if (state.error) return NP.alert('Could not load the dashboard.')

      var d = state.data
      return [
        m('.mb-4.flex.items-baseline.justify-between', [
          m('h1.text-2xl.font-semibold', d.budget.name),
          m('span.hud-channel-tag', d.budget.base_currency),
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
