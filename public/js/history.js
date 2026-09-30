// History screen (F5). Mithril island over E7 (the filtered entry list) and E5
// (detail expand + delete-as-reversal). Filters by type / category / date range,
// pages with "load more", expands a row to its split breakdown, and deletes an entry
// (which reverses its balance math). Loaded after mithril + app.js.
;(function () {
  var el = document.getElementById('history-app')
  if (!el) return

  var boot = window.__NP__ || {}
  var bid = boot.active_budget_id || null
  var params = new URLSearchParams(location.search)

  var TYPE_LABELS = {
    purchase: 'Purchase', move: 'Move', paycc: 'Pay card',
    deposit: 'Deposit', withdraw: 'Withdraw', transfer: 'Transfer', reset: 'Monthly reset',
  }

  var state = {
    loading: true,
    error: false,
    ref: null, // { accounts: {id:name}, categories: {id:name}, currency }
    catList: [],
    filters: {
      type: params.get('type') || '',
      category: params.get('category') || '',
      range: params.get('range') || 'all',
    },
    entries: [],
    total: 0,
    offset: 0,
    limit: 25,
    fetching: false,
  }

  function loadRef() {
    return NP.req('GET', '/api/budgets/' + bid + '/dashboard').then(function (r) {
      var d = r.data
      var am = {}; d.accounts.forEach(function (a) { am[a.id] = a.name })
      var cm = {}; d.categories.forEach(function (c) { cm[c.id] = c.name })
      state.ref = { accounts: am, categories: cm, currency: d.budget.base_currency }
      state.catList = d.categories.map(function (c) { return [c.id, c.name] })
    })
  }

  function qs() {
    var f = state.filters
    var p = new URLSearchParams()
    if (f.type) p.set('type', f.type)
    if (f.category) p.set('category', f.category)
    if (f.range && f.range !== 'all') p.set('range', f.range)
    p.set('limit', state.limit)
    p.set('offset', state.offset)
    return p.toString()
  }

  function fetchEntries() {
    state.fetching = true
    return NP.req('GET', '/api/budgets/' + bid + '/entries?' + qs()).then(function (r) {
      state.entries = state.entries.concat(r.data)
      state.total = r.meta.total
      state.fetching = false
    }, function () { state.fetching = false })
  }

  function applyFilters() { state.entries = []; state.offset = 0; fetchEntries() }
  function loadMore() { state.offset += state.limit; fetchEntries() }

  function acctName(id) { return id == null ? null : (state.ref.accounts[id] || 'Account #' + id) }
  function catName(id) { return state.ref.categories[id] || 'Category #' + id }
  function money(s) { return NP.money(state.ref.currency, s) }

  function toggle(e) {
    e._open = !e._open
    if (e._open && !e._detail) {
      NP.req('GET', '/api/budgets/' + bid + '/entries/' + e.id).then(function (r) { e._detail = r.data })
    }
  }

  function del(e) {
    var label = (TYPE_LABELS[e.type] || e.type).toLowerCase()
    NP.confirm('Delete this ' + label + '?', 'It reverses every balance change it made.', 'Delete & reverse', 'Keep it').then(function (ok) {
      if (!ok) return
      NP.req('DELETE', '/api/budgets/' + bid + '/entries/' + e.id).then(function () {
        applyFilters()
        NP.toast('Entry reversed', 'ok', 'Every balance it touched is back.')
      }, function (err) {
        var errs = err && err.response && err.response.errors
        NP.toast('Could not delete this entry', 'error', errs ? errs[Object.keys(errs)[0]][0] : null)
      })
    })
  }

  // An expanded entry's detail, in the row beneath it: the real total (even when the
  // collapsed row shows just this envelope's slice — CODE-312), the accounts, and the
  // split breakdown, as a Hangar readout.
  function detailBlock(e) {
    var d = e._detail
    if (!d) return m('progress.hud-progress.w-full[aria-label=Loading entry detail]')
    return m('.hud-readout.space-y-1.py-1.text-sm', [
      m('.flex.justify-between', [m('span.lbl', 'TOTAL'), m('span', money(d.total_amount))]),
      acctName(d.account_id) ? m('.flex.justify-between', [m('span.lbl', 'ACCOUNT'), m('span', acctName(d.account_id) + (d.to_account_id ? ' → ' + acctName(d.to_account_id) : ''))]) : null,
      d.splits.map(function (sp) {
        return m('.flex.justify-between', [m('span.lbl', catName(sp.category_id) + (sp.from_saved ? ' (savings)' : '')), m('span', money(sp.amount))])
      }),
      // Reset entries are undone via the monthly-reset flow, not here (the engine
      // refuses them), so no delete button for those.
      e.type !== 'reset' ? m('.pt-2', m('button.hud-actuator.hud-actuator--ghost.hud-actuator--danger.hud-actuator--sm[type=button]', {
        onclick: function () { del(e) },
      }, 'Delete & reverse ' + (TYPE_LABELS[e.type] || e.type).toLowerCase())) : null,
    ])
  }

  // A Hangar table (CSS) rendered by Mithril: rows come from the server a page at a
  // time, so Hangar's client-side sort/paginate modules don't apply. Each entry is a
  // row whose header cell holds the expand button (keyboard reachable, aria-expanded);
  // an open entry is aria-selected and gets a detail row beneath it.
  function table() {
    var cat = state.filters.category
    var rows = state.entries.reduce(function (acc, e) {
      acc.push(m('tr', { key: e.id, 'aria-selected': e._open ? 'true' : null }, [
        m('td.hud-table-mono.whitespace-nowrap', e.entry_date),
        m('th[scope=row]', m('button.w-full.text-left[type=button]', { 'aria-expanded': e._open ? 'true' : 'false', onclick: function () { toggle(e) } }, [
          m('span.block.text-sm.font-medium', TYPE_LABELS[e.type] || e.type),
          e.description ? m('span.block.text-xs.text-muted', e.description) : null,
        ])),
        // When filtered by a category, show that envelope's slice; otherwise the total.
        m('td.hud-table-num', money(cat && e.category_amount != null ? e.category_amount : e.total_amount)),
      ]))
      if (e._open) acc.push(m('tr', { key: 'd' + e.id }, m('td[colspan=3]', detailBlock(e))))
      return acc
    }, [])
    return m('.hud-table-wrap.hud-brackets', m('.hud-table-scroll', m('table.hud-table', [
      m('thead', m('tr', [
        m('th[scope=col]', 'Date'),
        m('th[scope=col]', 'Entry'),
        m('th[scope=col].hud-table-num', cat ? 'Envelope share' : 'Amount'),
      ])),
      m('tbody', rows.length ? rows : m('tr', m('td.hud-table-empty[colspan=3]', [m('span.hud-table-empty-label', 'No match'), 'No entries match these filters.']))),
    ])))
  }

  function filterBar() {
    var f = state.filters
    var typeOpts = [['', 'All types']].concat(Object.keys(TYPE_LABELS).map(function (k) { return [k, TYPE_LABELS[k]] }))
    var catOpts = [['', 'All categories']].concat(state.catList)
    var rangeOpts = [['all', 'All time'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['180', 'Last 180 days']]
    return m('.mb-4.grid.gap-3.sm:grid-cols-3', [
      NP.field('Type', f.type, function (v) { f.type = v; applyFilters() }, { options: typeOpts, optional: true }),
      NP.field('Category', f.category, function (v) { f.category = v; applyFilters() }, { options: catOpts, optional: true }),
      NP.field('Range', f.range, function (v) { f.range = v; applyFilters() }, { options: rangeOpts }),
    ])
  }

  var History = {
    oninit: function () {
      if (!bid) { state.loading = false; return }
      loadRef().then(function () { return fetchEntries() }).then(function () { state.loading = false }, function () { state.loading = false; state.error = true })
    },
    view: function () {
      if (!bid) return NP.notice('No budget selected', 'Pick a budget from the switcher above to see its history.')
      if (state.loading) return m('progress.hud-progress.w-full[aria-label=Loading history]')
      if (state.error) return NP.alert('Could not load history.')

      return [
        m('h1.mb-4.text-2xl.font-semibold', 'History'),
        filterBar(),
        table(),
        m('.mt-4.flex.items-center.justify-between', [
          m('.hud-readout.text-xs', [m('span.lbl', 'SHOWING '), ('0' + state.entries.length).slice(-2) + '/' + ('0' + state.total).slice(-2)]),
          state.entries.length < state.total ? m('button.hud-actuator.hud-actuator--ghost.hud-actuator--sm[type=button]', {
            'aria-busy': state.fetching ? 'true' : null, onclick: function () { if (!state.fetching) loadMore() },
          }, 'Load more') : null,
        ]),
      ]
    },
  }

  m.mount(el, History)
})()
