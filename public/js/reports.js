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
    // YYYY-MM in local time (toISOString() is UTC: on a month's last evening west of
    // Greenwich it is already next month).
    month: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 7),
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

  // --- LWC trend chart, coloured from Hangar's tokens (CODE-390) ---
  // Hangar's palette is OKLCH / color-mix(), which chart libraries can't parse, so its
  // chart-palette module resolves the tokens to rgb()/rgba(). Its onThemeChange drives
  // the re-theme on a data-theme flip (and follows the OS colour scheme too).
  var TOKENS = ['--hud-bg-2', '--hud-text-2', '--hud-line-1', '--hud-accent',
    'color-mix(in oklch, var(--hud-accent) 33%, transparent)', 'color-mix(in oklch, var(--hud-accent) 0%, transparent)']
  var watching = false
  function destroyChart() { if (chart) { chart.remove(); chart = null } }
  function drawChart() {
    NP.hudLoad(['chart-palette']).then(function (H) {
      if (!hostEl || !window.LightweightCharts || !state.data) return
      var P = H['chart-palette']
      if (!watching) {
        watching = true
        P.onThemeChange(function () { if (chart) drawChart() })
      }
      destroyChart()
      var c = P.resolveColors(TOKENS, { el: hostEl })
      chart = window.LightweightCharts.createChart(hostEl, {
        autoSize: true,
        layout: { background: { color: c[0] }, textColor: c[1], fontFamily: 'JetBrains Mono, monospace' },
        grid: { vertLines: { color: c[2] }, horzLines: { color: c[2] } },
        rightPriceScale: { borderColor: c[2] },
        timeScale: { borderColor: c[2], fixLeftEdge: true, fixRightEdge: true },
        handleScroll: false, handleScale: false,
        crosshair: { horzLine: { labelBackgroundColor: c[3] }, vertLine: { labelBackgroundColor: c[3] } },
      })
      var series = chart.addAreaSeries({ lineColor: c[3], topColor: c[4], bottomColor: c[5], lineWidth: 2, lineType: window.LightweightCharts.LineType.Curved })
      series.setData(state.data.map(function (d) { return { time: d.date, value: Number(d.total) } }))
      chart.timeScale().fitContent()
    })
  }

  // --- By envelope: one Hangar gauge per envelope, scaled to the month's largest ---
  function envelopeBars(rows) {
    if (!rows.length) return m('p.text-muted.text-sm', 'No spending in this month.')
    var max = rows.reduce(function (a, r) { return Math.max(a, Number(r.total)) }, 0)
    return m('.space-y-3', rows.map(function (r) {
      return m('.hud-progress-readout', { key: r.category_id }, [
        m('span.hud-progress-label', r.name),
        m('span.hud-progress-value[aria-hidden=true]', money(r.total)),
        m('progress.hud-progress.w-full', { value: max > 0 ? Math.round((Number(r.total) / max) * 100) : 0, max: 100, 'aria-label': r.name + ' ' + money(r.total) }),
      ])
    }))
  }

  // --- Per month: spaced vertical columns (LWC histograms abut), Hangar-tinted ---
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  function columnBars(rows) {
    if (!rows.length) return m('p.text-muted.text-sm', 'No spending to chart yet.')
    var max = rows.reduce(function (a, r) { return Math.max(a, Number(r.total)) }, 0)
    return m('.flex.gap-3', { style: { height: '260px' } }, rows.map(function (r) {
      var p = r.month.split('-')
      return m('.flex.flex-1.flex-col', { key: r.month }, [
        m('.grow.flex.flex-col.justify-end', [
          m('span.hud-readout.mb-1.text-center.text-xs', money(r.total)),
          m('.w-full', { style: { height: (max > 0 ? (Number(r.total) / max) * 100 : 0) + '%', minHeight: '3px', background: 'var(--hud-accent)', borderRadius: 'var(--hud-radius-sm)' } }),
        ]),
        m('span.hud-readout.mt-1.text-center.text-xs', m('span.lbl', MONTHS[parseInt(p[1], 10) - 1].toUpperCase() + " '" + p[0].slice(2))),
      ])
    }))
  }

  var VIEWS = [['monthly', 'By envelope'], ['permonth', 'Per month'], ['trend', 'Envelope trend']]
  function controls() {
    var catAll = [['', 'All envelopes']].concat(state.ref.categories.map(function (c) { return [c.id, c.name] }))
    var catOne = state.ref.categories.map(function (c) { return [c.id, c.name] })
    return m('.mb-5', [
      m('.mb-3', NP.tabs('Report', VIEWS, state.view, function (k) { state.view = k; onControls() }, true)),
      m('.grid.gap-3.sm:grid-cols-3',
        state.view === 'monthly' ? [NP.field('Month', state.month, function (v) { state.month = v; onControls() }, { type: 'month' })]
        : state.view === 'permonth' ? [NP.field('Envelope', state.category, function (v) { state.category = v; onControls() }, { options: catAll, optional: true })]
        : [
            NP.field('Envelope', state.category, function (v) { state.category = v; onControls() }, { options: catOne }),
            NP.field('Range', state.range, function (v) { state.range = v; onControls() }, { options: [['all', 'All time'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['180', 'Last 180 days']] }),
          ]),
    ])
  }

  function panel() {
    if (state.loading || state.data === null) return m('progress.hud-progress.w-full[aria-label=Loading report]')
    if (state.view === 'monthly') return envelopeBars(state.data)
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
      if (!bid) return NP.notice('No budget selected', 'Pick a budget from the switcher above to see reports.')
      if (state.error) return NP.alert('Could not load reports.')
      if (!state.ready) return m('progress.hud-progress.w-full[aria-label=Loading reports]')
      var title = VIEWS.filter(function (v) { return v[0] === state.view })[0][1]
      return [
        m('h1.mb-4.text-2xl.font-semibold', 'Reports'),
        controls(),
        m('section.hud-card.hud-brackets.p-5', [m('.mb-3', NP.bar(title, m('span.hud-channel-tag', state.ref.currency))), panel()]),
      ]
    },
  }

  m.mount(el, Reports)
})()
