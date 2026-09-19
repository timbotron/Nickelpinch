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
      splits: [{ category_id: '', amount: '' }],
      entry_date: new Date().toISOString().slice(0, 10),
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
  function addSplit() { if (state.form.splits.length < 5) state.form.splits.push({ category_id: '', amount: '' }) }
  function removeSplit(i) { if (state.form.splits.length > 1) state.form.splits.splice(i, 1) }

  function purchaseFields() {
    var f = state.form
    var cur = state.data.budget.base_currency
    var multi = f.splits.length > 1
    var firstC = (f.total_amount ? NP.toCents(f.total_amount) : 0) - extraCents()
    var firstNeg = !!f.total_amount && firstC < 0
    return [
      NP.field('Total spent', f.total_amount, function (v) { f.total_amount = v }, { ph: '0.00' }),
      NP.field('Paid from (bank debit or card charge)', f.account_id, function (v) { f.account_id = v }, { options: acctOpts() }),
      m('p.eyebrow.mt-4', multi ? 'Split across envelopes (1–5)' : 'Envelope'),
      // First envelope: just the category — it takes the remainder of the total.
      m('.mb-2.flex.items-end.gap-2', [
        m('.grow', NP.field(multi ? 'Envelope (gets the rest)' : 'Envelope', f.splits[0].category_id, function (v) { f.splits[0].category_id = v }, { options: catOpts() })),
        multi ? m('.mono.w-24.pb-2.text-right.text-sm' + (firstNeg ? '.text-red-300' : '.text-muted'), NP.money(cur, NP.fromCents(firstC))) : null,
      ]),
      // Extra envelopes: explicit amounts.
      f.splits.slice(1).map(function (s, idx) {
        var i = idx + 1
        return m('.mb-2.flex.items-end.gap-2', [
          m('.grow', NP.field('Envelope', s.category_id, function (v) { s.category_id = v }, { options: catOpts() })),
          m('.w-28', NP.field('Amount', s.amount, function (v) { s.amount = v }, { ph: '0.00' })),
          m('button.options-btn.mb-2', { onclick: function () { removeSplit(i) }, title: 'Remove' }, '✕'),
        ])
      }),
      f.splits.length < 5 ? m('button.btn-outline.mb-3', { onclick: addSplit }, '+ Add another envelope') : null,
      firstNeg ? m('.mono.text-sm.text-red-300', 'The extra envelopes add up to more than the total.') : null,
    ]
  }

  function typeFields() {
    var f = state.form
    switch (state.type) {
      case 'purchase': return purchaseFields()
      case 'move': return [
        NP.field('From envelope', f.category_id, function (v) { f.category_id = v }, { options: catOpts() }),
        NP.field('To envelope', f.to_category_id, function (v) { f.to_category_id = v }, { options: catOpts() }),
        NP.field('Amount', f.amount, function (v) { f.amount = v }, { ph: '0.00' }),
      ]
      case 'paycc': return [
        NP.field('Pay from (bank)', f.account_id, function (v) { f.account_id = v }, { options: acctOpts(isBank) }),
        NP.field('Card to pay', f.to_account_id, function (v) { f.to_account_id = v }, { options: acctOpts(isCard) }),
        NP.field('Amount', f.amount, function (v) { f.amount = v }, { ph: '0.00' }),
      ]
      case 'deposit': return [
        NP.field('Into (bank)', f.account_id, function (v) { f.account_id = v }, { options: acctOpts(isBank) }),
        NP.field('Amount', f.amount, function (v) { f.amount = v }, { ph: '0.00' }),
      ]
      case 'withdraw': return [
        NP.field('From (bank)', f.account_id, function (v) { f.account_id = v }, { options: acctOpts(isBank) }),
        NP.field('Attribute to envelope (optional)', f.category_id, function (v) { f.category_id = v }, { options: catOpts() }),
        NP.field('Amount', f.amount, function (v) { f.amount = v }, { ph: '0.00' }),
      ]
      case 'transfer': return [
        NP.field('From account', f.account_id, function (v) { f.account_id = v }, { options: acctOpts() }),
        NP.field('To account', f.to_account_id, function (v) { f.to_account_id = v }, { options: acctOpts() }),
        NP.field('Amount', f.amount, function (v) { f.amount = v }, { ph: '0.00' }),
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
    return m('.mono.mt-2.text-sm.text-red-300', msgs.map(function (mm) { return m('div', mm) }))
  }

  function submit() {
    state.errors = null
    state.submitting = true
    NP.req('POST', '/api/budgets/' + bid + '/entries/' + state.type, body()).then(
      function () { window.location.href = '/home' },
      function (e) {
        var r = e && e.response
        state.errors = r && r.errors ? r.errors : { _: [(r && r.error) || 'Could not save the entry.'] }
        state.submitting = false
      }
    )
  }

  var Entry = {
    oninit: load,
    view: function () {
      if (!bid) return m('.card', [m('p.eyebrow', 'No budget selected'), m('p.text-muted', 'Pick a budget from the switcher above to add an entry.')])
      if (state.loading) return m('p.text-muted', 'Loading…')
      if (state.error) return m('.card', m('p.text-red-300', 'Could not load the form.'))

      return [
        m('h1.mb-4.text-2xl.font-semibold', 'Add entry'),
        // Type picker: a native dropdown on mobile (the six buttons are too bulky on a
        // phone), the button row on sm+ (CODE-313). Both set state.type.
        m('.mb-5.sm:hidden', NP.field('Entry type', state.type, function (v) { state.type = v; state.errors = null }, { options: TYPES })),
        m('.mb-5.hidden.flex-wrap.gap-2.sm:flex', TYPES.map(function (x) {
          return m('button.btn-outline' + (state.type === x[0] ? '.text-accent' : ''), { onclick: function () { state.type = x[0]; state.errors = null } }, x[1])
        })),
        m('.card.max-w-lg', [
          typeFields(),
          NP.field('Date', state.form.entry_date, function (v) { state.form.entry_date = v }, { type: 'date' }),
          NP.field('Note (optional)', state.form.description, function (v) { state.form.description = v }, { ph: 'e.g. Costco' }),
          errorList(),
          m('.mt-4.flex.gap-2', [
            m('button.btn', { disabled: state.submitting, onclick: submit }, state.submitting ? 'Saving…' : 'Save entry'),
            m('a.btn-outline', { href: '/home' }, 'Cancel'),
          ]),
        ]),
      ]
    },
  }

  m.mount(el, Entry)
})()
