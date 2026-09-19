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
    if (!bid) return m('.mono.mb-2.text-xs.text-muted', 'Select a budget to choose a default payment account.')
    var opts = [['', 'No default']].concat(state.accounts.map(function (a) {
      return [a.id, a.name + (a.type === 'credit_card' ? ' (card)' : '')]
    }))
    return NP.field('Default payment account', state.form.default_account_id, function (v) { state.form.default_account_id = v }, { options: opts })
  }

  function errorList() {
    if (!state.errors) return null
    var msgs = []
    Object.keys(state.errors).forEach(function (k) { msgs = msgs.concat(state.errors[k]) })
    return m('.mono.mt-2.text-sm.text-red-300', msgs.map(function (mm) { return m('div', mm) }))
  }

  var Settings = {
    oninit: load,
    view: function () {
      if (state.loading) return m('p.text-muted', 'Loading…')
      if (state.error) return m('.card', m('p.text-red-300', 'Could not load settings.'))
      return [
        m('h1.mb-4.text-2xl.font-semibold', 'Settings'),
        m('.card.max-w-lg', [
          NP.field('Theme', state.form.theme, function (v) { state.form.theme = v }, { options: THEMES }),
          NP.field('Default dashboard view', state.form.default_view, function (v) { state.form.default_view = v }, { options: VIEWS }),
          accountField(),
          errorList(),
          m('.mt-4.flex.items-center.gap-3', [
            m('button.btn', { disabled: state.saving, onclick: save }, state.saving ? 'Saving…' : 'Save settings'),
            state.saved ? m('span.mono.text-sm.text-accent', 'Saved ✓') : null,
          ]),
        ]),
        m('p.mono.mt-4.text-xs.text-muted', 'Budget currency is set per budget under Manage → Budgets.'),
      ]
    },
  }

  m.mount(el, Settings)
})()
