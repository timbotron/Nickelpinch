// Reports screen (CODE-235). Mithril island over the Report aggregation endpoints.
// Three views: "By envelope" (a month's spend per envelope) and "Per month" (total
// spend per month) are hand-rolled bars with spacing between them (LWC's histogram is
// a volume series whose bars abut with no inter-bar padding); the single-envelope
// "Trend" line is rendered with TradingView Lightweight Charts.
// Loaded after mithril + app.js + the LWC standalone (window.LightweightCharts).
;(function () {
  var el = document.getElementById('reports-app')
  if (!el) return

  var boot = window.__NP__ || {}
  var bid = boot.active_budget_id || null

  var state = {
    ready: false, error: false, loading: false,
    ref: null,               // { categories: [{id,name}], currency }
    view: 'monthly',         // 'monthly' | 'permonth' | 'trend'
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    category: '',
    range: '180',
    data: null,
  }

  // --- Lightweight Charts live outside Mithril's diffing (they own a <canvas>). ---
  var chart = null, hostEl = null

  function money(s) { return NP.money(state.ref ? state.ref.currency : '', s) }

  function loadRef() {
    return NP.req('GET', '/api/budgets/' + bid + '/dashboard').then(function (r) {
      state.ref = {
        categories: r.data.categories.map(function (c) { return { id: c.id, name: c.name } }),
        currency: r.data.budget.base_currency,
      }
      if (!state.category && state.ref.categories.length) state.category = String(state.ref.categories[0].id)
    })
  }

  function endpoint() {
    var base = '/api/budgets/' + bid + '/reports/'
    if (state.view === 'monthly') return base + 'by-category?month=' + state.month
    if (state.view === 'permonth') return base + 'by-month' + (state.category ? '?category=' + state.category : '')
    return base + 'category-trend?category=' + state.category + '&range=' + state.range
  }

  function fetchData() {
    if (state.view === 'trend' && !state.category) { state.data = []; return }
    state.loading = true
    NP.req('GET', endpoint()).then(
      function (r) { state.loading = false; state.data = r.data },
      function () { state.loading = false; state.error = true }
    )
  }

  function onControls() { destroyChart(); fetchData() }

  // --- LWC chart (permonth histogram, trend area) ---
  function themeColors() {
    var cs = getComputedStyle(document.documentElement)
    var v = function (n, d) { return (cs.getPropertyValue(n).trim() || d) }
    return { bg: v('--surface', '#0b0f14'), fg: v('--fg', '#d6eef7'), border: v('--border', '#1e2f39'), accent: v('--accent', '#7fdbff') }
  }
  function destroyChart() { if (chart) { chart.remove(); chart = null } }
  function drawChart() {
    if (!hostEl || !window.LightweightCharts || !state.data) return
    destroyChart()
    var c = themeColors()
    chart = window.LightweightCharts.createChart(hostEl, {
      autoSize: true,
      layout: { background: { color: c.bg }, textColor: c.fg, fontFamily: 'JetBrains Mono, monospace' },
      grid: { vertLines: { color: c.border }, horzLines: { color: c.border } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: false, handleScale: false,
      crosshair: { horzLine: { labelBackgroundColor: c.accent }, vertLine: { labelBackgroundColor: c.accent } },
    })
    // Trend only — the per-month view is spaced bars (see columnBars).
    var s = chart.addAreaSeries({ lineColor: c.accent, topColor: c.accent + '55', bottomColor: c.accent + '00', lineWidth: 2, lineType: window.LightweightCharts.LineType.Curved })
    s.setData(state.data.map(function (d) { return { time: d.date, value: Number(d.total) } }))
    chart.timeScale().fitContent()
  }

  // Re-theme the chart when the light/dark toggle flips data-theme.
  new MutationObserver(function () { if (chart) drawChart() })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  // --- SVG bar breakdown (monthly, categorical) ---
  function svgBars(rows) {
    if (!rows.length) return m('p.text-muted.text-sm', 'No spending in this month.')
    var max = rows.reduce(function (a, r) { return Math.max(a, Number(r.total)) }, 0)
    return m('.space-y-3', rows.map(function (r) {
      var pct = max > 0 ? (Number(r.total) / max) * 100 : 0
      return m('div', [
        m('.mb-1.flex.justify-between', [m('span.font-medium', r.name), m('span.mono.text-sm.text-muted', money(r.total))]),
        m('.health', m('span.health-fill', { style: { width: pct + '%' } })),
      ])
    }))
  }

  // --- Vertical bar chart (per-month), spaced columns (LWC histograms abut). ---
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  function monthLabel(ymd) { var p = ymd.split('-'); return MONTHS[parseInt(p[1], 10) - 1] + " '" + p[0].slice(2) }
  function columnBars(rows) {
    if (!rows.length) return m('p.text-muted.text-sm', 'No spending to chart yet.')
    var max = rows.reduce(function (a, r) { return Math.max(a, Number(r.total)) }, 0)
    return m('.flex.gap-3', { style: { height: '260px' } }, rows.map(function (r) {
      var pct = max > 0 ? (Number(r.total) / max) * 100 : 0
      return m('.flex.flex-1.flex-col', [
        m('.grow.flex.flex-col.justify-end', [
          m('span.mono.text-xs.text-muted.mb-1.text-center', money(r.total)),
          m('.w-full', { style: { height: pct + '%', minHeight: '3px', background: 'var(--accent)', borderRadius: 'var(--radius)' } }),
        ]),
        m('span.mono.text-xs.text-muted.mt-1.text-center', monthLabel(r.month)),
      ])
    }))
  }

  function controls() {
    var VIEWS = [['monthly', 'By envelope'], ['permonth', 'Per month'], ['trend', 'Envelope trend']]
    var catAll = [['', 'All envelopes']].concat(state.ref.categories.map(function (c) { return [c.id, c.name] }))
    var catOne = state.ref.categories.map(function (c) { return [c.id, c.name] })
    return m('.mb-5', [
      m('.mb-3.grid.grid-cols-2.gap-2.sm:flex.sm:flex-wrap', VIEWS.map(function (vw) {
        return m('button.btn-outline.justify-center' + (state.view === vw[0] ? '.text-accent' : ''), { onclick: function () { state.view = vw[0]; onControls() } }, vw[1])
      })),
      m('.grid.gap-3.sm:grid-cols-3',
        state.view === 'monthly' ? [NP.field('Month', state.month, function (v) { state.month = v; onControls() }, { type: 'month' })]
        : state.view === 'permonth' ? [NP.field('Envelope', state.category, function (v) { state.category = v; onControls() }, { options: catAll })]
        : [
            NP.field('Envelope', state.category, function (v) { state.category = v; onControls() }, { options: catOne }),
            NP.field('Range', state.range, function (v) { state.range = v; onControls() }, { options: [['all', 'All time'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['180', 'Last 180 days']] }),
          ]),
    ])
  }

  function panel() {
    if (state.loading || state.data === null) return m('p.text-muted', 'Loading…')
    if (state.view === 'monthly') return svgBars(state.data)
    if (state.view === 'permonth') return columnBars(state.data)
    if (!state.data.length) return m('p.text-muted.text-sm', 'No spending to chart yet.')
    // Diff-proof host so Mithril never wipes LWC's canvas; oncreate/onremove manage it.
    return m('div', {
      style: { height: '340px', width: '100%' },
      onbeforeupdate: function () { return false },
      oncreate: function (vn) { hostEl = vn.dom; drawChart() },
      onremove: function () { destroyChart(); hostEl = null },
    })
  }

  var Reports = {
    oninit: function () {
      if (!bid) return
      loadRef().then(function () { state.ready = true; fetchData() }, function () { state.error = true })
    },
    onremove: destroyChart,
    view: function () {
      if (!bid) return m('.card', [m('p.eyebrow', 'No budget selected'), m('p.text-muted', 'Pick a budget from the switcher above to see reports.')])
      if (state.error) return m('.card', m('p.text-red-300', 'Could not load reports.'))
      if (!state.ready) return m('p.text-muted', 'Loading…')
      return [
        m('h1.mb-4.text-2xl.font-semibold', 'Reports'),
        controls(),
        m('.card', panel()),
      ]
    },
  }

  m.mount(el, Reports)
})()
