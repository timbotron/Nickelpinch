// Manage screen (F3). Tabbed Mithril island over the budget/account/category APIs
// (C1/D1/D2): accounts (multi-bank + credit cards), categories (with rollover rule),
// and the budget list. Accounts and categories act on the session's active budget;
// the Budgets tab manages the list itself. Mutations go through NP.req (CSRF header)
// and re-fetch from the server (the source of truth). Loaded after mithril + app.js.
;(function () {
  var el = document.getElementById('manage-app')
  if (!el) return

  var boot = window.__NP__ || {}
  var bid = boot.active_budget_id || null
  var tab = 'accounts'

  // Pull the field=>messages map (422) or a plain error into a uniform shape.
  function errsOf(e) {
    var r = e && e.response
    if (r && r.errors) return r.errors
    if (r && r.error) return { _: [r.error] }
    return { _: ['Something went wrong.'] }
  }
  function errLine(errors) {
    if (!errors) return null
    var msgs = []
    Object.keys(errors).forEach(function (k) { msgs = msgs.concat(errors[k]) })
    return m('.mono.mt-1.text-xs.text-red-300', msgs.join(' '))
  }

  // A labeled input or select. onset(value) updates the bound form field.
  function field(label, value, onset, opts) {
    opts = opts || {}
    var control = opts.options
      ? NP.select(
          opts.options.map(function (o) { return m('option', { value: o[0], selected: String(o[0]) === String(value) }, o[1]) }),
          { onchange: function (e) { onset(e.target.value) } })
      : m('input.field', { type: opts.type || 'text', value: value == null ? '' : value, placeholder: opts.ph || '', oninput: function (e) { onset(e.target.value) } })
    return m('label.mb-2.block', [m('span.mono.mb-1.block.text-xs.text-muted', label), control])
  }

  function needBudget() {
    return m('.card', [m('p.eyebrow', 'No budget selected'), m('p.text-muted', 'Pick a budget from the switcher above to manage its accounts and categories.')])
  }

  // ============================ ACCOUNTS ============================
  var A = { items: null, form: null, editId: null, errors: null }
  function aReset() { A.form = null; A.editId = null; A.errors = null }
  function aLoad() { A.items = null; NP.req('GET', '/api/budgets/' + bid + '/accounts').then(function (r) { A.items = r.data }, function () { A.items = [] }) }
  function aNew() { aReset(); A.form = { name: '', type: 'bank', balance: '0', credit_limit: '', due_date: '' } }
  function aEdit(a) { aReset(); A.editId = a.id; A.form = { name: a.name, type: a.type, balance: a.balance, credit_limit: a.credit_limit || '', due_date: a.due_date || '' } }
  function aBody(f) {
    var b = { name: f.name, type: f.type, balance: f.balance }
    b.credit_limit = f.type === 'credit_card' ? f.credit_limit : null
    b.due_date = f.type === 'credit_card' ? f.due_date : null
    return b
  }
  function aSave() {
    A.errors = null
    var url = '/api/budgets/' + bid + '/accounts' + (A.editId ? '/' + A.editId : '')
    NP.req(A.editId ? 'PUT' : 'POST', url, aBody(A.form)).then(function () { aReset(); aLoad() }, function (e) { A.errors = errsOf(e) })
  }
  function aDel(a) {
    if (!confirm('Delete account "' + a.name + '"? Past transactions keep their history.')) return
    NP.req('DELETE', '/api/budgets/' + bid + '/accounts/' + a.id).then(aLoad)
  }
  function accountForm() {
    var f = A.form
    var isCard = f.type === 'credit_card'
    return m('.card.mb-4', [
      m('p.eyebrow', A.editId ? 'Edit account' : 'New account'),
      field('Name', f.name, function (v) { f.name = v }, { ph: 'Checking' }),
      field('Type', f.type, function (v) { f.type = v }, { options: [['bank', 'Bank account'], ['credit_card', 'Credit card']] }),
      field(isCard ? 'Amount owed' : 'Balance', f.balance, function (v) { f.balance = v }, { ph: '0.00' }),
      isCard ? field('Credit limit', f.credit_limit, function (v) { f.credit_limit = v }, { ph: '3000.00' }) : null,
      isCard ? field('Due day (1–31)', f.due_date, function (v) { f.due_date = v }, { type: 'number' }) : null,
      errLine(A.errors),
      m('.mt-3.flex.gap-2', [
        m('button.btn', { onclick: aSave }, A.editId ? 'Save' : 'Add account'),
        m('button.btn-outline', { onclick: aReset }, 'Cancel'),
      ]),
    ])
  }
  function accountsTab() {
    if (!bid) return needBudget()
    if (A.items === null) { aLoad(); return m('p.text-muted', 'Loading…') }
    return m('div', [
      A.form ? accountForm() : m('button.btn.mb-4', { onclick: aNew }, '+ New account'),
      A.items.length ? A.items.map(function (a) {
        return m('.card.mb-2.flex.items-center.justify-between', [
          m('div', [
            m('span.font-medium', a.name),
            m('span.mono.ml-2.text-xs.text-muted', a.type === 'credit_card' ? 'card' : 'bank'),
            m('.mono.text-sm.text-muted', (a.type === 'credit_card' ? a.balance + ' owed' : a.balance) + (a.credit_limit ? ' · limit ' + a.credit_limit : '') + (a.due_date ? ' · due ' + a.due_date : '')),
          ]),
          m('.flex.gap-2', [
            m('button.options-btn', { onclick: function () { aEdit(a) }, title: 'Edit' }, '✎'),
            m('button.options-btn', { onclick: function () { aDel(a) }, title: 'Delete' }, '✕'),
          ]),
        ])
      }) : m('p.text-muted.text-sm', 'No accounts yet.'),
    ])
  }

  // ============================ CATEGORIES ============================
  var C = { items: null, form: null, editId: null, errors: null }
  var CAT_TYPES = [['standard', 'Standard'], ['savings', 'Savings'], ['archived', 'Archived']]
  var ROLLOVER = [['accumulate', 'Accumulate (roll over)'], ['reset', 'Reset each month']]
  function cReset() { C.form = null; C.editId = null; C.errors = null }
  function cLoad() { C.items = null; NP.req('GET', '/api/budgets/' + bid + '/categories').then(function (r) { C.items = r.data }, function () { C.items = [] }) }
  // Savings envelopes can be pinned to a bank account, so the form needs the account
  // list loaded (reuses the Accounts tab's state).
  function cNew() { cReset(); if (A.items === null) aLoad(); C.form = { name: '', type: 'standard', monthly_limit: '0', rollover_rule: 'accumulate', account_id: '' } }
  function cEdit(c) { cReset(); if (A.items === null) aLoad(); C.editId = c.id; C.form = { name: c.name, type: c.type, monthly_limit: c.monthly_limit, rollover_rule: c.rollover_rule, account_id: c.account_id == null ? '' : String(c.account_id) } }
  function cSave() {
    C.errors = null
    var f = C.form
    var url = '/api/budgets/' + bid + '/categories' + (C.editId ? '/' + C.editId : '')
    NP.req(C.editId ? 'PUT' : 'POST', url, { name: f.name, type: f.type, monthly_limit: f.monthly_limit, rollover_rule: f.rollover_rule, account_id: f.account_id === '' ? null : Number(f.account_id) })
      .then(function () { cReset(); cLoad() }, function (e) { C.errors = errsOf(e) })
  }
  // Bank-account picker, shown only for savings envelopes (null = held externally).
  function catAccountField(f) {
    if (f.type !== 'savings') return null
    if (A.items === null) return m('.mono.mb-2.text-xs.text-muted', 'Loading accounts…')
    var opts = [['', 'None — held outside tracked accounts']].concat(
      A.items.filter(function (a) { return a.type === 'bank' }).map(function (a) { return [a.id, a.name] })
    )
    return field('Held in (bank account)', f.account_id, function (v) { f.account_id = v }, { options: opts })
  }
  function cDel(c) {
    if (!confirm('Delete category "' + c.name + '"? Consider archiving instead if it has history.')) return
    NP.req('DELETE', '/api/budgets/' + bid + '/categories/' + c.id).then(cLoad)
  }
  function categoryForm() {
    var f = C.form
    return m('.card.mb-4', [
      m('p.eyebrow', C.editId ? 'Edit category' : 'New category'),
      field('Name', f.name, function (v) { f.name = v }, { ph: 'Groceries' }),
      field('Type', f.type, function (v) { f.type = v }, { options: CAT_TYPES }),
      field('Monthly limit / goal', f.monthly_limit, function (v) { f.monthly_limit = v }, { ph: '0.00' }),
      field('Rollover', f.rollover_rule, function (v) { f.rollover_rule = v }, { options: ROLLOVER }),
      catAccountField(f),
      errLine(C.errors),
      m('.mt-3.flex.gap-2', [
        m('button.btn', { onclick: cSave }, C.editId ? 'Save' : 'Add category'),
        m('button.btn-outline', { onclick: cReset }, 'Cancel'),
      ]),
    ])
  }
  function categoriesTab() {
    if (!bid) return needBudget()
    if (C.items === null) { cLoad(); return m('p.text-muted', 'Loading…') }
    return m('div', [
      C.form ? categoryForm() : m('button.btn.mb-4', { onclick: cNew }, '+ New category'),
      C.items.length ? C.items.map(function (c) {
        return m('.card.mb-2.flex.items-center.justify-between', [
          m('div', [
            m('span.font-medium', c.name),
            m('span.mono.ml-2.text-xs.text-muted', c.type + ' · ' + c.rollover_rule),
            m('.mono.text-sm.text-muted', 'limit ' + c.monthly_limit + ' · spent ' + c.spent + ' · saved ' + c.saved),
          ]),
          m('.flex.gap-2', [
            m('button.options-btn', { onclick: function () { cEdit(c) }, title: 'Edit' }, '✎'),
            m('button.options-btn', { onclick: function () { cDel(c) }, title: 'Delete' }, '✕'),
          ]),
        ])
      }) : m('p.text-muted.text-sm', 'No categories yet.'),
    ])
  }

  // ============================ BUDGETS ============================
  var B = { items: null, form: null, editId: null, errors: null }
  function bReset() { B.form = null; B.editId = null; B.errors = null }
  function bLoad() { B.items = null; NP.req('GET', '/api/budgets').then(function (r) { B.items = r.data }, function () { B.items = [] }) }
  function bNew() { bReset(); B.form = { name: '', base_currency: 'USD' } }
  function bEdit(b) { bReset(); B.editId = b.id; B.form = { name: b.name, base_currency: b.base_currency } }
  function bSave() {
    B.errors = null
    var f = B.form
    NP.req(B.editId ? 'PUT' : 'POST', '/api/budgets' + (B.editId ? '/' + B.editId : ''), { name: f.name, base_currency: f.base_currency })
      .then(function () { bReset(); bLoad() }, function (e) { B.errors = errsOf(e) })
  }
  function bDel(b) {
    if (!confirm('Delete budget "' + b.name + '"? This removes its accounts, categories, and entries.')) return
    NP.req('DELETE', '/api/budgets/' + b.id).then(function () {
      if (b.id === bid) window.location.href = '/home' // active budget gone; let the shell re-pick
      else bLoad()
    })
  }
  function bSwitch(b) { NP.req('POST', '/api/budgets/' + b.id + '/switch').then(function () { window.location.reload() }) }
  function budgetForm() {
    var f = B.form
    return m('.card.mb-4', [
      m('p.eyebrow', B.editId ? 'Edit budget' : 'New budget'),
      field('Name', f.name, function (v) { f.name = v }, { ph: 'Household' }),
      field('Currency (3-letter)', f.base_currency, function (v) { f.base_currency = v }, { ph: 'USD' }),
      errLine(B.errors),
      m('.mt-3.flex.gap-2', [
        m('button.btn', { onclick: bSave }, B.editId ? 'Save' : 'Create budget'),
        m('button.btn-outline', { onclick: bReset }, 'Cancel'),
      ]),
    ])
  }
  function budgetsTab() {
    if (B.items === null) { bLoad(); return m('p.text-muted', 'Loading…') }
    return m('div', [
      B.form ? budgetForm() : m('button.btn.mb-4', { onclick: bNew }, '+ New budget'),
      B.items.map(function (b) {
        var isActive = b.id === bid
        var isOwner = b.role === 'owner'
        return m('.card.mb-2.flex.items-center.justify-between', [
          m('div', [
            m('span.font-medium', b.name),
            isActive ? m('span.mono.ml-2.text-xs.text-accent', 'active') : null,
            m('.mono.text-sm.text-muted', b.base_currency + ' · ' + b.role),
          ]),
          m('.flex.gap-2', [
            isActive ? null : m('button.options-btn', { onclick: function () { bSwitch(b) }, title: 'Switch to' }, '→'),
            isOwner ? m('button.options-btn', { onclick: function () { bEdit(b) }, title: 'Edit' }, '✎') : null,
            isOwner ? m('button.options-btn', { onclick: function () { bDel(b) }, title: 'Delete' }, '✕') : null,
          ]),
        ])
      }),
    ])
  }

  // ============================ SHELL ============================
  var TABS = [['accounts', 'Accounts'], ['categories', 'Categories'], ['budgets', 'Budgets']]
  var Manage = {
    view: function () {
      return [
        m('h1.mb-4.text-2xl.font-semibold', 'Manage'),
        m('.mb-5.grid.grid-cols-2.gap-2.sm:flex.sm:flex-wrap', TABS.map(function (t) {
          return m('button.btn-outline.justify-center' + (tab === t[0] ? '.text-accent' : ''), { onclick: function () { tab = t[0] } }, t[1])
        })),
        tab === 'accounts' ? accountsTab() : tab === 'categories' ? categoriesTab() : budgetsTab(),
      ]
    },
  }
  m.mount(el, Manage)
})()
