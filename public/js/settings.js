// Settings screen (F7). Mithril island over E8 (GET/PUT /api/settings) for the
// per-user preferences: theme, default dashboard view, and default "paid via"
// account. Saving the theme applies it live and locally so the shell agrees. Budget
// currency is deliberately not here — it's a per-budget setting (Manage → Budgets).
;(function () {
  var el = document.getElementById('settings-app')
  if (!el) return

  var boot = window.__NP__ || {}
  var bid = boot.active_budget_id || null

  var THEMES = [['dark', 'Dark'], ['light', 'Light']]
  var VIEWS = [['simple', 'Simple'], ['detailed', 'Detailed']]

  var state = { loading: true, error: false, form: null, accounts: [], saved: false, errors: null, saving: false }

  function load() {
    var reqs = [NP.req('GET', '/api/settings')]
    if (bid) reqs.push(NP.req('GET', '/api/budgets/' + bid + '/accounts'))
    Promise.all(reqs).then(function (res) {
      var s = res[0].data
      state.form = {
        theme: s.theme,
        default_view: s.default_view,
        default_account_id: s.default_account_id == null ? '' : String(s.default_account_id),
      }
      state.accounts = bid ? res[1].data : []
      state.loading = false
    }, function () { state.loading = false; state.error = true })
  }

  function save() {
    state.errors = null
    state.saved = false
    state.saving = true
    var f = state.form
    var body = {
      theme: f.theme,
      default_view: f.default_view,
      default_account_id: f.default_account_id === '' ? null : Number(f.default_account_id),
    }
    NP.req('PUT', '/api/settings', body).then(function (r) {
      state.saving = false
      state.saved = true
      // Reflect the theme immediately (and locally) so the shell + pre-paint agree.
      document.documentElement.setAttribute('data-theme', r.data.theme)
      try { localStorage.setItem('np-theme', r.data.theme) } catch (e) {}
    }, function (e) {
      state.saving = false
      state.errors = (e && e.response && e.response.errors) || { _: ['Could not save settings.'] }
    })
  }

  function accountField() {
    if (!bid) return m('.font-mono.mb-2.text-xs.text-muted', 'Select a budget to choose a default payment account.')
    var opts = [['', 'No default']].concat(state.accounts.map(function (a) {
      return [a.id, a.name + (a.type === 'credit_card' ? ' (card)' : '')]
    }))
    return NP.field('Default payment account', state.form.default_account_id, function (v) { state.form.default_account_id = v }, { options: opts, optional: true })
  }

  function errorList() {
    if (!state.errors) return null
    var msgs = []
    Object.keys(state.errors).forEach(function (k) { msgs = msgs.concat(state.errors[k]) })
    return m('.mt-2', NP.alert(msgs.join(' '), 'Not saved'))
  }

  var Settings = {
    oninit: load,
    view: function () {
      if (state.loading) return m('progress.hud-progress.w-full[aria-label=Loading settings]')
      if (state.error) return NP.alert('Could not load settings.')
      return [
        m('h1.mb-4.text-2xl.font-semibold', 'Settings'),
        m('section.hud-card.hud-brackets--diag.max-w-lg.p-5', [
          m('.mb-3', NP.bar('Preferences')),
          // Segmented selectors, not switches: these wait for Save (Hangar: a switch
          // applies at once).
          NP.field('Theme', state.form.theme, function (v) { state.form.theme = v }, { options: THEMES, segment: true }),
          NP.field('Default dashboard view', state.form.default_view, function (v) { state.form.default_view = v }, { options: VIEWS, segment: true }),
          accountField(),
          errorList(),
          m('.mt-4.flex.items-center.gap-3', [
            // aria-busy (not disabled, which drops focus); clicks ignored while saving.
            m('button.hud-actuator[type=button]', { 'aria-busy': state.saving ? 'true' : null, onclick: function () { if (!state.saving) save() } }, 'Save settings'),
            // A status region that exists before it is filled, so "saved" is announced.
            m('span[role=status]', state.saved ? m('span.hud-pill', [m('i.hud-dot'), 'saved']) : null),
          ]),
        ]),
        m('p.hud-readout.mt-4.text-xs', 'Budget currency is set per budget under Manage → Budgets.'),
      ]
    },
  }

  m.mount(el, Settings)
})()
