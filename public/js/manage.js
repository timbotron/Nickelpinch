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
  // A failed delete (etc.) surfaces as an error toast with the server's first message.
  function failed(e) {
    var errs = errsOf(e)
    NP.toast('That didn\u2019t go through', 'error', errs[Object.keys(errs)[0]][0])
  }
  function errLine(errors) {
    if (!errors) return null
    var msgs = []
    Object.keys(errors).forEach(function (k) { msgs = msgs.concat(errors[k]) })
    return m('.mt-2', NP.alert(msgs.join(' ')))
  }

  // Hangar building blocks for this screen (CODE-388): a list row, a form card, and a
  // row action — a ghost icon actuator named for its target (Hangar: every --icon
  // needs an aria-label), danger for destructive ones.
  var ROW = 'section.hud-card.mb-2.flex.items-center.justify-between.gap-3.px-4.py-3'
  var FORM = 'section.hud-card.hud-brackets--diag.mb-4.p-5'
  var LOADING = 'progress.hud-progress.w-full[aria-label=Loading]'
  function act(glyph, label, onclick, danger, disabled) {
    return m('button.hud-actuator.hud-actuator--ghost.hud-actuator--icon.hud-actuator--sm[type=button]' + (danger ? '.hud-actuator--danger' : ''), {
      onclick: onclick, 'aria-label': label, title: label, disabled: disabled,
    }, glyph)
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
    NP.req(A.editId ? 'PUT' : 'POST', url, aBody(A.form)).then(function () { aReset(); aLoad(); NP.toast('Account saved') }, function (e) { A.errors = errsOf(e) })
  }
  function aDel(a) {
    NP.confirm('Delete account ' + a.name + '?', 'Past transactions keep their history.', 'Delete account', 'Keep account').then(function (ok) {
      if (ok) NP.req('DELETE', '/api/budgets/' + bid + '/accounts/' + a.id).then(function () { aLoad(); NP.toast('Account deleted') }, failed)
    })
  }
  function accountForm() {
    var f = A.form
    var isCard = f.type === 'credit_card'
    return m(FORM, [
      NP.bar(A.editId ? 'Edit account' : 'New account', null, 'h3'),
      NP.field('Name', f.name, function (v) { f.name = v }, { ph: 'Checking' }),
      NP.field('Type', f.type, function (v) { f.type = v }, { options: [['bank', 'Bank account'], ['credit_card', 'Credit card']] }),
      NP.field(isCard ? 'Amount owed' : 'Balance', f.balance, function (v) { f.balance = v }, { ph: '0.00' }),
      isCard ? NP.field('Credit limit', f.credit_limit, function (v) { f.credit_limit = v }, { ph: '3000.00' }) : null,
      isCard ? NP.field('Due day (1–31)', f.due_date, function (v) { f.due_date = v }, { type: 'number' }) : null,
      errLine(A.errors),
      m('.mt-3.flex.gap-2', [
        m('button.hud-actuator[type=button]', { onclick: aSave }, A.editId ? 'Save' : 'Add account'),
        m('button.hud-actuator.hud-actuator--ghost[type=button]', { onclick: aReset }, 'Cancel'),
      ]),
    ])
  }
  function accountsTab() {
    if (!bid) return NP.notice('No budget selected', 'Pick a budget from the switcher above to manage its accounts and categories.')
    if (A.items === null) { aLoad(); return m(LOADING) }
    return m('div', [
      A.form ? accountForm() : m('button.hud-actuator.hud-actuator--sm.mb-4[type=button]', { onclick: aNew }, '+ New account'),
      A.items.length ? A.items.map(function (a) {
        return m(ROW, [
          m('div', [
            m('span.font-medium', a.name),
            m('span.font-mono.ml-2.text-xs.text-muted', a.type === 'credit_card' ? 'card' : 'bank'),
            m('.font-mono.text-sm.text-muted', (a.type === 'credit_card' ? a.balance + ' owed' : a.balance) + (a.credit_limit ? ' · limit ' + a.credit_limit : '') + (a.due_date ? ' · due ' + a.due_date : '')),
          ]),
          m('.flex.gap-2', [
            act('✎', 'Edit ' + a.name, function () { aEdit(a) }),
            act('✕', 'Delete account ' + a.name, function () { aDel(a) }, true),
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
  function cNew() { cReset(); if (A.items === null) aLoad(); if (G.items === null) gLoad(); C.form = { name: '', type: 'standard', monthly_limit: '0', rollover_rule: 'accumulate', account_id: '', group_id: '' } }
  function cEdit(c) { cReset(); if (A.items === null) aLoad(); if (G.items === null) gLoad(); C.editId = c.id; C.form = { name: c.name, type: c.type, monthly_limit: c.monthly_limit, rollover_rule: c.rollover_rule, account_id: c.account_id == null ? '' : String(c.account_id), group_id: c.group_id == null ? '' : String(c.group_id) } }
  function cSave() {
    C.errors = null
    var f = C.form
    var url = '/api/budgets/' + bid + '/categories' + (C.editId ? '/' + C.editId : '')
    NP.req(C.editId ? 'PUT' : 'POST', url, { name: f.name, type: f.type, monthly_limit: f.monthly_limit, rollover_rule: f.rollover_rule, account_id: f.account_id === '' ? null : Number(f.account_id), group_id: f.group_id === '' ? null : Number(f.group_id) })
      .then(function () { cReset(); cLoad(); gLoad(); NP.toast('Category saved') }, function (e) { C.errors = errsOf(e) })
  }
  // Bank-account picker, shown only for savings envelopes (null = held externally).
  function catAccountField(f) {
    if (f.type !== 'savings') return null
    if (A.items === null) return m('.font-mono.mb-2.text-xs.text-muted', 'Loading accounts…')
    var opts = [['', 'None — held outside tracked accounts']].concat(
      A.items.filter(function (a) { return a.type === 'bank' }).map(function (a) { return [a.id, a.name] })
    )
    return NP.field('Held in (bank account)', f.account_id, function (v) { f.account_id = v }, { options: opts, optional: true })
  }
  function cDel(c) {
    NP.confirm('Delete category ' + c.name + '?', 'Its entries lose this envelope. Consider archiving instead if it has history.', 'Delete category', 'Keep category').then(function (ok) {
      if (ok) NP.req('DELETE', '/api/budgets/' + bid + '/categories/' + c.id).then(function () { cLoad(); NP.toast('Category deleted') }, failed)
    })
  }
  function categoryForm() {
    var f = C.form
    return m(FORM, [
      NP.bar(C.editId ? 'Edit category' : 'New category', null, 'h3'),
      NP.field('Name', f.name, function (v) { f.name = v }, { ph: 'Groceries' }),
      NP.field('Type', f.type, function (v) { f.type = v }, { options: CAT_TYPES }),
      NP.field('Monthly limit / goal', f.monthly_limit, function (v) { f.monthly_limit = v }, { ph: '0.00' }),
      NP.field('Rollover', f.rollover_rule, function (v) { f.rollover_rule = v }, { options: ROLLOVER }),
      catAccountField(f),
      catGroupField(f),
      errLine(C.errors),
      m('.mt-3.flex.gap-2', [
        m('button.hud-actuator[type=button]', { onclick: cSave }, C.editId ? 'Save' : 'Add category'),
        m('button.hud-actuator.hud-actuator--ghost[type=button]', { onclick: cReset }, 'Cancel'),
      ]),
    ])
  }
  // ---- category groups (CODE-352): create / rename / delete / reorder, plus the
  // per-category group picker. A group just brings envelopes together for the
  // overview rollup — it never receives money itself.
  var G = { items: null, form: null, editId: null, errors: null }
  function gReset() { G.form = null; G.editId = null; G.errors = null }
  function gLoad() { G.items = null; NP.req('GET', '/api/budgets/' + bid + '/category-groups').then(function (r) { G.items = r.data }, function () { G.items = [] }) }
  function gNew() { gReset(); G.form = { name: '' } }
  function gEdit(g) { gReset(); G.editId = g.id; G.form = { name: g.name } }
  function gSave() {
    G.errors = null
    var url = '/api/budgets/' + bid + '/category-groups' + (G.editId ? '/' + G.editId : '')
    NP.req(G.editId ? 'PUT' : 'POST', url, { name: G.form.name }).then(function () { gReset(); gLoad(); NP.toast('Group saved') }, function (e) { G.errors = errsOf(e) })
  }
  function gDel(g) {
    NP.confirm('Delete group ' + g.name + '?', 'Its envelopes stay — just ungrouped.', 'Delete group', 'Keep group').then(function (ok) {
      if (ok) NP.req('DELETE', '/api/budgets/' + bid + '/category-groups/' + g.id).then(function () { gLoad(); cLoad(); NP.toast('Group deleted') }, failed)
    })
  }
  // Reorder by swapping neighbours and POSTing the full id order back.
  function gMove(i, dir) {
    var j = i + dir
    if (j < 0 || j >= G.items.length) return
    var order = G.items.map(function (x) { return x.id })
    var t = order[i]; order[i] = order[j]; order[j] = t
    NP.req('POST', '/api/budgets/' + bid + '/category-groups/reorder', { order: order }).then(function (r) { G.items = r.data })
  }
  function groupName(id) { var g = (G.items || []).filter(function (x) { return x.id === id })[0]; return g ? g.name : '' }
  // The group picker on the category form — shown for every type (savings included).
  function catGroupField(f) {
    var opts = [['', 'None — ungrouped']].concat((G.items || []).map(function (g) { return [g.id, g.name] }))
    return NP.field('Group', f.group_id, function (v) { f.group_id = v }, { options: opts, optional: true })
  }
  function groupForm() {
    return m(FORM, [
      NP.bar(G.editId ? 'Rename group' : 'New group', null, 'h3'),
      // key: the category form (also a 'Name' field) can be open at the same time
      NP.field('Name', G.form.name, function (v) { G.form.name = v }, { ph: 'Bills', key: 'group' }),
      errLine(G.errors),
      m('.mt-3.flex.gap-2', [
        m('button.hud-actuator[type=button]', { onclick: gSave }, G.editId ? 'Save' : 'Add group'),
        m('button.hud-actuator.hud-actuator--ghost[type=button]', { onclick: gReset }, 'Cancel'),
      ]),
    ])
  }
  function groupsSection() {
    if (G.items === null) { gLoad(); return m(LOADING) }
    return m('.mb-6', [
      NP.bar('Groups', !G.form ? m('button.hud-actuator.hud-actuator--ghost.hud-actuator--sm[type=button]', { onclick: gNew }, '+ Group') : null),
      G.form ? groupForm() : null,
      G.items.length ? G.items.map(function (g, i) {
        return m(ROW, [
          m('div', [
            m('span.font-medium', g.name),
            m('span.font-mono.ml-2.text-xs.text-muted', g.category_ids.length + (g.category_ids.length === 1 ? ' envelope' : ' envelopes')),
          ]),
          m('.flex.gap-2', [
            act('↑', 'Move ' + g.name + ' up', function () { gMove(i, -1) }, false, i === 0),
            act('↓', 'Move ' + g.name + ' down', function () { gMove(i, 1) }, false, i === G.items.length - 1),
            act('✎', 'Rename ' + g.name, function () { gEdit(g) }),
            act('✕', 'Delete group ' + g.name, function () { gDel(g) }, true),
          ]),
        ])
      }) : m('p.text-muted.text-sm', 'No groups yet. Group related envelopes (e.g. “Bills”) to roll them up on the overview.'),
    ])
  }

  function categoriesTab() {
    if (!bid) return NP.notice('No budget selected', 'Pick a budget from the switcher above to manage its accounts and categories.')
    if (C.items === null) { cLoad(); return m(LOADING) }
    return m('div', [
      groupsSection(),
      C.form ? categoryForm() : m('button.hud-actuator.hud-actuator--sm.mb-4[type=button]', { onclick: cNew }, '+ New category'),
      C.items.length ? C.items.map(function (c) {
        return m(ROW, [
          m('div', [
            m('span.font-medium', c.name),
            c.group_id ? m('span.hud-channel-tag.ml-2', groupName(c.group_id)) : null,
            m('span.font-mono.ml-2.text-xs.text-muted', c.type + ' · ' + c.rollover_rule),
            m('.font-mono.text-sm.text-muted', 'limit ' + c.monthly_limit + ' · spent ' + c.spent + ' · saved ' + c.saved),
          ]),
          m('.flex.gap-2', [
            act('✎', 'Edit ' + c.name, function () { cEdit(c) }),
            act('✕', 'Delete category ' + c.name, function () { cDel(c) }, true),
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
      .then(function () { bReset(); bLoad(); NP.toast('Budget saved') }, function (e) { B.errors = errsOf(e) })
  }
  function bDel(b) {
    NP.confirm('Delete budget ' + b.name + '?', 'This removes its accounts, categories, and entries for everyone. It cannot be undone.', 'Delete budget', 'Keep budget').then(function (ok) {
      if (!ok) return
      NP.req('DELETE', '/api/budgets/' + b.id).then(function () {
        if (b.id === bid) window.location.href = '/home' // active budget gone; let the shell re-pick
        else { bLoad(); NP.toast('Budget deleted') }
      }, failed)
    })
  }
  function bSwitch(b) { NP.req('POST', '/api/budgets/' + b.id + '/switch').then(function () { window.location.reload() }) }
  function budgetForm() {
    var f = B.form
    return m(FORM, [
      NP.bar(B.editId ? 'Edit budget' : 'New budget', null, 'h3'),
      NP.field('Name', f.name, function (v) { f.name = v }, { ph: 'Household' }),
      NP.field('Currency (3-letter)', f.base_currency, function (v) { f.base_currency = v }, { ph: 'USD' }),
      errLine(B.errors),
      m('.mt-3.flex.gap-2', [
        m('button.hud-actuator[type=button]', { onclick: bSave }, B.editId ? 'Save' : 'Create budget'),
        m('button.hud-actuator.hud-actuator--ghost[type=button]', { onclick: bReset }, 'Cancel'),
      ]),
    ])
  }
  function budgetsTab() {
    if (B.items === null) { bLoad(); return m(LOADING) }
    return m('div', [
      B.form ? budgetForm() : m('button.hud-actuator.hud-actuator--sm.mb-4[type=button]', { onclick: bNew }, '+ New budget'),
      B.items.map(function (b) {
        var isActive = b.id === bid
        var isOwner = b.role === 'owner'
        return m(ROW, [
          m('div', [
            m('span.font-medium', b.name),
            isActive ? m('span.hud-pill.ml-2', [m('i.hud-dot'), 'active']) : null,
            m('.font-mono.text-sm.text-muted', b.base_currency + ' · ' + b.role),
          ]),
          m('.flex.gap-2', [
            isActive ? null : act('→', 'Switch to ' + b.name, function () { bSwitch(b) }),
            isOwner ? act('✎', 'Edit ' + b.name, function () { bEdit(b) }) : null,
            isOwner ? act('✕', 'Delete budget ' + b.name, function () { bDel(b) }, true) : null,
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
        m('.mb-5', NP.tabs('Manage', TABS, tab, function (k) { tab = k }, true)),
        tab === 'accounts' ? accountsTab() : tab === 'categories' ? categoriesTab() : budgetsTab(),
      ]
    },
  }
  m.mount(el, Manage)
})()
