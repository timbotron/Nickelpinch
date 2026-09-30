// Add-entry forms (F4). One Mithril island for every money operation, over the
// E2–E4 endpoints (POST /api/budgets/{b}/entries/{type}). It reads ?type= and ?from=
// (the dashboard's per-envelope + deep-links here), pre-selects the user's default
// payment account, and — for a purchase — offers the dynamic 1..5 split with an
// assign-remaining helper and a live sum (computed in exact cents). Submits through
// NP.req (CSRF header); on success it returns to the dashboard, else shows the 422s.
;(function () {
  var el = document.getElementById('entry-app')
  if (!el) return

  var boot = window.__NP__ || {}
  var bid = boot.active_budget_id || null

  var TYPES = [
    ['purchase', 'Purchase'], ['move', 'Move'], ['paycc', 'Pay card'],
    ['deposit', 'Deposit'], ['withdraw', 'Withdraw'], ['transfer', 'Transfer'],
  ]
  var params = new URLSearchParams(location.search)

  var state = {
    loading: true,
    error: false,
    data: null,          // { budget, accounts, categories } from the dashboard endpoint
    defaultAccount: null,
    type: 'purchase',
    submitting: false,
    errors: null,
    form: {
      account_id: '', to_account_id: '', category_id: '', to_category_id: '',
      amount: '', total_amount: '',
      splits: [{ uid: 0, category_id: '', amount: '' }], // uid keys the rows
      // Today in the user's local time — toISOString() is UTC, which in the evening
      // west of Greenwich is already tomorrow.
      entry_date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
      description: '',
    },
  }

  var t = params.get('type')
  if (t && TYPES.some(function (x) { return x[0] === t })) state.type = t

  function load() {
    if (!bid) { state.loading = false; return }
    Promise.all([
      NP.req('GET', '/api/budgets/' + bid + '/dashboard'),
      NP.req('GET', '/api/settings'),
    ]).then(function (res) {
      state.data = res[0].data
      var def = res[1].data.default_account_id
      // Only use the default if it belongs to this budget's accounts.
      state.defaultAccount = state.data.accounts.some(function (a) { return a.id === def }) ? def : null
      prefill()
      state.loading = false
    }, function () { state.loading = false; state.error = true })
  }

  function prefill() {
    var from = params.get('from')
    if (from) {
      state.form.splits[0].category_id = from
      state.form.category_id = from
    }
    if (state.defaultAccount) state.form.account_id = String(state.defaultAccount)
    m.redraw()
  }

  // --- accounts / categories option lists (with a leading placeholder) ---
  function acctOpts(pred) {
    var opts = state.data.accounts.filter(pred || function () { return true }).map(function (a) {
      return [a.id, a.name + (a.type === 'credit_card' ? ' (card)' : '')]
    })
    return [['', 'Select account…']].concat(opts)
  }
  function catOpts() {
    return [['', 'Select category…']].concat(state.data.categories.map(function (c) { return [c.id, c.name] }))
  }
  var isBank = function (a) { return a.type === 'bank' }
  var isCard = function (a) { return a.type === 'credit_card' }

  // --- split helpers (exact cents) ---
  // The first envelope has no amount field — it absorbs whatever is left of the total
  // (so a single-envelope purchase is just: total + one category). Extra envelopes
  // (rows 2+) carry explicit amounts, and the first gets total − their sum.
  function extraCents() {
    return state.form.splits.slice(1).reduce(function (a, s) { return a + (s.amount ? NP.toCents(s.amount) : 0) }, 0)
  }
  var nextUid = 1
  function addSplit() { if (state.form.splits.length < 5) state.form.splits.push({ uid: nextUid++, category_id: '', amount: '' }) }
  function removeSplit(i) { if (state.form.splits.length > 1) state.form.splits.splice(i, 1) }

  // Envelope pickers are Hangar comboboxes (type to filter — budgets grow many
  // envelopes); account pickers are Hangar selects. Split rows are keyed by uid so
  // removing a middle row doesn't hand its widget to the next row.
  var ENV = { search: true }
  function purchaseFields() {
    var f = state.form
    var cur = state.data.budget.base_currency
    var multi = f.splits.length > 1
    var firstC = (f.total_amount ? NP.toCents(f.total_amount) : 0) - extraCents()
    var firstNeg = !!f.total_amount && firstC < 0
    return [
      NP.field('Total spent', f.total_amount, function (v) { f.total_amount = v }, { ph: '0.00', inputmode: 'decimal' }),
      NP.field('Paid from (bank debit or card charge)', f.account_id, function (v) { f.account_id = v }, { options: acctOpts() }),
      m('.mt-4', NP.bar(multi ? 'Split across envelopes (1–5)' : 'Envelope', null, 'h3')),
      // First envelope: just the category — it takes the remainder of the total.
      m('.flex.items-end.gap-2', [
        m('.grow', NP.field(multi ? 'Envelope (gets the rest)' : 'Envelope', f.splits[0].category_id, function (v) { f.splits[0].category_id = v }, Object.assign({ options: catOpts(), key: f.splits[0].uid }, ENV))),
        multi ? m('.hud-readout.w-28.pb-5.text-right.text-sm', { style: firstNeg ? { color: 'var(--hud-error-ink)' } : null }, [m('span.lbl', 'REST '), NP.money(cur, NP.fromCents(firstC))]) : null,
      ]),
      // Extra envelopes: explicit amounts.
      f.splits.slice(1).map(function (s, idx) {
        var i = idx + 1
        return m('.flex.items-end.gap-2', { key: s.uid }, [
          m('.grow', NP.field('Envelope', s.category_id, function (v) { s.category_id = v }, Object.assign({ options: catOpts(), key: s.uid }, ENV))),
          m('.w-28', NP.field('Amount', s.amount, function (v) { s.amount = v }, { ph: '0.00', inputmode: 'decimal', key: s.uid })),
          m('button.hud-actuator.hud-actuator--ghost.hud-actuator--danger.hud-actuator--icon.mb-3[type=button]', { onclick: function () { removeSplit(i) }, 'aria-label': 'Remove envelope ' + (i + 1) }, '✕'),
        ])
      }),
      f.splits.length < 5 ? m('button.hud-actuator.hud-actuator--ghost.hud-actuator--sm.mb-3[type=button]', { onclick: addSplit }, '+ Add another envelope') : null,
      firstNeg ? m('p.hud-field-error', 'The extra envelopes add up to more than the total.') : null,
    ]
  }

  function typeFields() {
    var f = state.form
    var amount = NP.field('Amount', f.amount, function (v) { f.amount = v }, { ph: '0.00', inputmode: 'decimal' })
    switch (state.type) {
      case 'purchase': return purchaseFields()
      case 'move': return [
        NP.field('From envelope', f.category_id, function (v) { f.category_id = v }, Object.assign({ options: catOpts() }, ENV)),
        NP.field('To envelope', f.to_category_id, function (v) { f.to_category_id = v }, Object.assign({ options: catOpts() }, ENV)),
        amount,
      ]
      case 'paycc': return [
        NP.field('Pay from (bank)', f.account_id, function (v) { f.account_id = v }, { options: acctOpts(isBank) }),
        NP.field('Card to pay', f.to_account_id, function (v) { f.to_account_id = v }, { options: acctOpts(isCard) }),
        amount,
      ]
      case 'deposit': return [
        NP.field('Into (bank)', f.account_id, function (v) { f.account_id = v }, { options: acctOpts(isBank) }),
        amount,
      ]
      case 'withdraw': return [
        NP.field('From (bank)', f.account_id, function (v) { f.account_id = v }, { options: acctOpts(isBank) }),
        NP.field('Attribute to envelope (optional)', f.category_id, function (v) { f.category_id = v }, Object.assign({ options: catOpts(), optional: true }, ENV)),
        amount,
      ]
      case 'transfer': return [
        NP.field('From account', f.account_id, function (v) { f.account_id = v }, { options: acctOpts() }),
        NP.field('To account', f.to_account_id, function (v) { f.to_account_id = v }, { options: acctOpts() }),
        amount,
      ]
    }
    return []
  }

  function num(v) { return v === '' || v == null ? null : Number(v) }
  function body() {
    var f = state.form
    var common = { entry_date: f.entry_date, description: f.description }
    switch (state.type) {
      case 'purchase':
        // Extra envelopes (rows 2+) with a category + amount; the first envelope
        // takes total − their sum. Always send the total so the server checks it (the
        // computed first amount makes the splits sum to it exactly, by construction).
        var extra = f.splits.slice(1).filter(function (s) { return s.category_id && s.amount })
          .map(function (s) { return { category_id: num(s.category_id), amount: s.amount } })
        var extraSum = extra.reduce(function (a, s) { return a + NP.toCents(s.amount) }, 0)
        var first = { category_id: num(f.splits[0].category_id), amount: NP.fromCents((f.total_amount ? NP.toCents(f.total_amount) : 0) - extraSum) }
        return Object.assign({ account_id: num(f.account_id), splits: [first].concat(extra), total_amount: f.total_amount }, common)
      case 'move': return Object.assign({ category_id: num(f.category_id), to_category_id: num(f.to_category_id), amount: f.amount }, common)
      case 'paycc': return Object.assign({ account_id: num(f.account_id), to_account_id: num(f.to_account_id), amount: f.amount }, common)
      case 'deposit': return Object.assign({ account_id: num(f.account_id), amount: f.amount }, common)
      case 'withdraw':
        var w = Object.assign({ account_id: num(f.account_id), amount: f.amount }, common)
        if (f.category_id) w.category_id = num(f.category_id)
        return w
      case 'transfer': return Object.assign({ account_id: num(f.account_id), to_account_id: num(f.to_account_id), amount: f.amount }, common)
    }
  }

  function errorList() {
    if (!state.errors) return null
    var msgs = []
    Object.keys(state.errors).forEach(function (k) { msgs = msgs.concat(state.errors[k]) })
    return m('.mt-3', NP.alert(msgs.join(' '), 'Not saved'))
  }

  // Save is a Hangar actuator: aria-busy while posting (not `disabled`, which would
  // drop focus mid-action — clicks are ignored while busy instead), and a refused
  // save plays Hangar's deny() glitch on it.
  function submit() {
    if (state.submitting) return
    state.errors = null
    state.submitting = true
    NP.req('POST', '/api/budgets/' + bid + '/entries/' + state.type, body()).then(
      function () { window.location.href = '/home' },
      function (e) {
        var r = e && e.response
        state.errors = r && r.errors ? r.errors : { _: [(r && r.error) || 'Could not save the entry.'] }
        state.submitting = false
        NP.hudLoad(['deny']).then(function (H) { H.deny.deny(document.getElementById('entry-save')) })
      }
    )
  }

  function setType(v) {
    state.type = v
    state.errors = null
  }

  var Entry = {
    oninit: load,
    view: function () {
      if (!bid) return NP.notice('No budget selected', 'Pick a budget from the switcher above to add an entry.')
      if (state.loading) return m('progress.hud-progress.w-full[aria-label=Loading the form]')
      if (state.error) return NP.alert('Could not load the form.')

      return [
        m('h1.mb-4.text-2xl.font-semibold', 'Add entry'),
        m('.sm:hidden', NP.field('Entry type', state.type, setType, { options: TYPES })),
        // Type picker: Hangar tabs on sm+, the select above on mobile (CODE-313).
        m('.mb-5.hidden.sm:block', NP.tabs('Entry type', TYPES, state.type, setType)),
        m('section.hud-card.hud-brackets--diag.max-w-lg.p-5', [
          typeFields(),
          NP.field('Date', state.form.entry_date, function (v) { state.form.entry_date = v }, { type: 'date' }),
          NP.field('Note (optional)', state.form.description, function (v) { state.form.description = v }, { ph: 'e.g. Costco' }),
          errorList(),
          m('.mt-4.flex.gap-2', [
            m('button.hud-actuator#entry-save[type=button]', { 'aria-busy': state.submitting ? 'true' : null, onclick: submit }, state.submitting ? 'Saving' : 'Save entry'),
            m('a.hud-actuator.hud-actuator--ghost', { href: '/home' }, 'Cancel'),
          ]),
        ]),
      ]
    },
  }

  m.mount(el, Entry)
})()
