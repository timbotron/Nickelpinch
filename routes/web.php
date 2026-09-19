<?php

use App\Controllers\Account;
use App\Controllers\Budget;
use App\Controllers\Category;
use App\Controllers\Dashboard;
use App\Controllers\Entry;
use App\Controllers\Home;
use App\Controllers\Report;
use App\Controllers\Reset;
use App\Controllers\Settings;
use FastRoute\RouteCollector;

// App routes. Core auth routes (/login, /create-account, /password-*, /logout) and
// the admin area (/admin) are mounted separately in public/index.php.
return function (RouteCollector $r) {
    // Pages (server-rendered)
    $r->get('/', [Home::class, 'home_page']);
    $r->get('/home', [Home::class, 'dashboard']); // LOGIN_REDIRECT target
    $r->get('/manage', [Home::class, 'manage']);  // accounts / categories / budgets (F3)
    $r->get('/entry', [Home::class, 'entry']);     // add-entry forms (F4)
    $r->get('/history', [Home::class, 'history']); // filtered history + reversal (F5)
    $r->get('/settings', [Home::class, 'settings']); // user preferences (F7)
    $r->get('/reports', [Home::class, 'reports']);   // spend charts (CODE-235)

    // Budget JSON API (C1). Budget-scoped; mutations gate on the CSRF header and
    // are authorized in the handlers via Base::budget_for_action.
    $r->get('/api/budgets', [Budget::class, 'index']);
    $r->post('/api/budgets', [Budget::class, 'create']);
    $r->get('/api/budgets/{b:\d+}/summary', [Budget::class, 'summary']);
    $r->put('/api/budgets/{b:\d+}', [Budget::class, 'update']);
    $r->delete('/api/budgets/{b:\d+}', [Budget::class, 'delete']);
    $r->post('/api/budgets/{b:\d+}/switch', [Budget::class, 'switch_to']);

    // Accounts API (D1). Budget-scoped; index needs READ_FULL (owner/member, not a
    // viewer), mutations need WRITE + the CSRF header.
    $r->get('/api/budgets/{b:\d+}/accounts', [Account::class, 'index']);
    $r->post('/api/budgets/{b:\d+}/accounts', [Account::class, 'create']);
    $r->put('/api/budgets/{b:\d+}/accounts/{a:\d+}', [Account::class, 'update']);
    $r->delete('/api/budgets/{b:\d+}/accounts/{a:\d+}', [Account::class, 'delete']);

    // Categories API (D2). Budget-scoped; index needs READ_FULL (owner/member, not a
    // viewer), mutations need WRITE + the CSRF header.
    $r->get('/api/budgets/{b:\d+}/categories', [Category::class, 'index']);
    $r->post('/api/budgets/{b:\d+}/categories', [Category::class, 'create']);
    $r->put('/api/budgets/{b:\d+}/categories/{c:\d+}', [Category::class, 'update']);
    $r->delete('/api/budgets/{b:\d+}/categories/{c:\d+}', [Category::class, 'delete']);

    // Monthly reset (D3). Close the month / undo the last reset. WRITE + CSRF.
    $r->post('/api/budgets/{b:\d+}/reset', [Reset::class, 'create']);
    $r->delete('/api/budgets/{b:\d+}/reset/{e:\d+}', [Reset::class, 'delete']);

    // Entries API (E2+). One create dispatcher over EntryService keyed by {type}
    // (purchase, move, paycc, deposit, withdraw, transfer); WRITE + CSRF. The letter-
    // only type constraint keeps it clear of E5's numeric {e:\d+} detail route.
    $r->post('/api/budgets/{b:\d+}/entries/{type:[a-z_]+}', [Entry::class, 'create']);
    // History / list with filters (E7): ?type=&category=&range=30|90|180|all&limit=&offset=
    $r->get('/api/budgets/{b:\d+}/entries', [Entry::class, 'index']);
    // Entry detail + delete-as-reversal (E5). Numeric {e} — distinct from the
    // letter-only create type above. READ_FULL to view; WRITE + CSRF to delete.
    $r->get('/api/budgets/{b:\d+}/entries/{e:\d+}', [Entry::class, 'show']);
    $r->delete('/api/budgets/{b:\d+}/entries/{e:\d+}', [Entry::class, 'destroy']);

    // Dashboard rollup (E6). Per-account balances, active envelopes, combined Extra.
    // READ_FULL — the full money surface, never a category viewer's slice.
    $r->get('/api/budgets/{b:\d+}/dashboard', [Dashboard::class, 'summary']);

    // Reports (CODE-235): server-computed spend aggregations for the charts. READ_FULL.
    $r->get('/api/budgets/{b:\d+}/reports/by-month', [Report::class, 'byMonth']);
    $r->get('/api/budgets/{b:\d+}/reports/by-category', [Report::class, 'byCategory']);
    $r->get('/api/budgets/{b:\d+}/reports/category-trend', [Report::class, 'categoryTrend']);

    // User settings (E8): per-user preferences in user_profiles. Login-gated, not
    // budget-scoped; the PUT gates on the CSRF header.
    $r->get('/api/settings', [Settings::class, 'show']);
    $r->put('/api/settings', [Settings::class, 'update']);
};
