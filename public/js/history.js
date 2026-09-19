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
    if (!confirm('Delete this ' + (TYPE_LABELS[e.type] || e.type).toLowerCase() + '? It reverses every balance change it made.')) return
    NP.req('DELETE', '/api/budgets/' + bid + '/entries/' + e.id).then(applyFilters, function (err) {
      var errs = err && err.response && err.response.errors
      alert(errs ? errs[Object.keys(errs)[0]][0] : 'Could not delete this entry.')
    })
  }

  function detailBlock(e) {
    var d = e._detail
    if (!d) return m('.mono.mt-2.text-xs.text-muted', 'Loading…')
    return m('.mt-3.border-t.border-line.pt-3', [
      // Always show the entry's real total here, even when the collapsed row shows
      // just this envelope's slice (CODE-312).
      m('.flex.justify-between.mono.text-sm', [m('span.text-muted', 'Total'), m('span', money(d.total_amount))]),
      acctName(d.account_id) ? m('.mono.mt-1.text-sm.text-muted', 'Account: ' + acctName(d.account_id) + (d.to_account_id ? ' → ' + acctName(d.to_account_id) : '')) : null,
      d.splits.length ? m('.mt-2', d.splits.map(function (s) {
        return m('.flex.justify-between.mono.text-sm', [
          m('span', catName(s.category_id) + (s.from_saved ? ' (savings)' : '')),
          m('span.text-muted', money(s.amount)),
        ])
      })) : null,
      // Reset entries are undone via the monthly-reset flow, not here (the engine
      // refuses them), so no delete button for those.
      e.type !== 'reset' ? m('button.btn-outline.mt-3', { onclick: function (ev) { ev.stopPropagation(); del(e) } }, 'Delete (reverse)') : null,
    ])
  }

  function row(e) {
    return m('.card.mb-2', [
      m('.flex.cursor-pointer.items-center.justify-between', { onclick: function () { toggle(e) } }, [
        m('div', [
          m('span.mono.text-xs.text-muted', e.entry_date),
          m('span.ml-2.font-medium', TYPE_LABELS[e.type] || e.type),
          e.description ? m('span.ml-2.text-muted', e.description) : null,
        ]),
        // When filtered by a category, show that envelope's slice; otherwise the total.
        m('span.mono.text-sm', money(state.filters.category && e.category_amount != null ? e.category_amount : e.total_amount)),
      ]),
      e._open ? detailBlock(e) : null,
    ])
  }

  function filterBar() {
    var f = state.filters
    var typeOpts = [['', 'All types']].concat(Object.keys(TYPE_LABELS).map(function (k) { return [k, TYPE_LABELS[k]] }))
    var catOpts = [['', 'All categories']].concat(state.catList)
    var rangeOpts = [['all', 'All time'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['180', 'Last 180 days']]
    return m('.mb-4.grid.gap-3.sm:grid-cols-3', [
      NP.field('Type', f.type, function (v) { f.type = v; applyFilters() }, { options: typeOpts }),
      NP.field('Category', f.category, function (v) { f.category = v; applyFilters() }, { options: catOpts }),
      NP.field('Range', f.range, function (v) { f.range = v; applyFilters() }, { options: rangeOpts }),
    ])
  }

  var History = {
    oninit: function () {
      if (!bid) { state.loading = false; return }
      loadRef().then(function () { return fetchEntries() }).then(function () { state.loading = false }, function () { state.loading = false; state.error = true })
    },
    view: function () {
      if (!bid) return m('.card', [m('p.eyebrow', 'No budget selected'), m('p.text-muted', 'Pick a budget from the switcher above to see its history.')])
      if (state.loading) return m('p.text-muted', 'Loading…')
      if (state.error) return m('.card', m('p.text-red-300', 'Could not load history.'))

      return [
        m('h1.mb-4.text-2xl.font-semibold', 'History'),
        filterBar(),
        state.entries.length ? state.entries.map(row) : m('p.text-muted.text-sm', 'No entries match these filters.'),
        m('.mt-4.flex.items-center.justify-between', [
          m('span.mono.text-xs.text-muted', 'Showing ' + state.entries.length + ' of ' + state.total),
          state.entries.length < state.total ? m('button.btn-outline', { disabled: state.fetching, onclick: loadMore }, state.fetching ? 'Loading…' : 'Load more') : null,
        ]),
      ]
    },
  }

  m.mount(el, History)
})()
