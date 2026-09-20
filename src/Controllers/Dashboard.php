<?php

namespace App\Controllers;

use App\Auth\Access;

/**
 * Dashboard rollup API (CODE-218 / E6). The server is the source of truth for every
 * derived figure — the client renders, it does not compute. One budget-scoped read
 * returns the per-account balances, the active envelopes with their remaining, and
 * the combined "Extra":
 *
 *   Extra = Σ(bank balances) − remaining budget − saved − Σ(credit-card owed)
 *
 * "Remaining budget" and "saved" sum standard envelopes always, and savings ONLY
 * when pinned to a tracked bank account (categories.account_id set). A savings
 * envelope with no account is held outside the tracked banks, so — like the old
 * "external savings" — it shows as an envelope but stays out of the bank-anchored
 * Extra. Archived categories are excluded everywhere. Each bank account also carries
 * `earmarked` (savings pinned to it) and `free` (balance − earmarked).
 *
 * Reads require READ_FULL (owner/member): accounts and the combined Extra are the
 * full money surface, never a category viewer's slice — a viewer gets 403.
 *
 * Money is summed in SQL (exact DECIMAL fixed-point) so there is no float or bcmath
 * step; every figure comes back as a DECIMAL string like the rest of the API.
 */
class Dashboard extends Base {

    // GET /api/budgets/{b}/dashboard
    public function summary($vars) {
        ['budget' => $budget] = $this->budget_for_action($vars['b'], Access::READ_FULL);
        $b = (int) $vars['b'];

        // Per bank account: `earmarked` = savings envelopes pinned to it, `free` =
        // balance − earmarked (how much of that account isn't spoken for). Cards
        // carry no earmark. The LEFT JOIN keeps the sum exact (DECIMAL, no float).
        $accounts = array_map(function ($a) {
            $bank = $a['type'] === 'bank';
            return [
                'id' => (int) $a['id'],
                'name' => $a['name'],
                'type' => $a['type'],
                'balance' => $a['balance'],
                'credit_limit' => $a['credit_limit'],
                'due_date' => $a['due_date'] === null ? null : (int) $a['due_date'],
                'earmarked' => $bank ? $a['earmarked'] : null,
                'free' => $bank ? $a['free'] : null,
            ];
        }, $this->db->query(
            "SELECT a.id, a.name, a.type, a.balance, a.credit_limit, a.due_date,
                    COALESCE(e.earmarked, 0.00) AS earmarked,
                    (a.balance - COALESCE(e.earmarked, 0.00)) AS free
             FROM accounts a
             LEFT JOIN (
               SELECT account_id, SUM(saved) AS earmarked FROM categories
               WHERE budget_id = :b AND type = 'savings' AND account_id IS NOT NULL
               GROUP BY account_id
             ) e ON e.account_id = a.id
             WHERE a.budget_id = :b2 ORDER BY a.type ASC, a.id ASC",
            [':b' => $b, ':b2' => $b]
        )->fetchAll(\PDO::FETCH_ASSOC));

        // Active envelopes with server-computed remaining = (limit + saved) − spent.
        // group_id files an envelope under a display group (CODE-351); the client
        // buckets by it and rolls the group up.
        $categories = array_map(function ($c) {
            return [
                'id' => (int) $c['id'],
                'name' => $c['name'],
                'type' => $c['type'],
                'monthly_limit' => $c['monthly_limit'],
                'spent' => $c['spent'],
                'saved' => $c['saved'],
                'remaining' => $c['remaining'],
                'account_id' => $c['account_id'] === null ? null : (int) $c['account_id'],
                'group_id' => $c['group_id'] === null ? null : (int) $c['group_id'],
            ];
        }, $this->db->query(
            'SELECT id, name, type, monthly_limit, spent, saved, account_id, group_id, (monthly_limit + saved - spent) AS remaining
             FROM categories WHERE budget_id = :b AND type != :arch ORDER BY `rank` ASC, id ASC',
            [':b' => $b, ':arch' => 'archived']
        )->fetchAll(\PDO::FETCH_ASSOC));

        // Display groups with their server-computed rollup — summed over a group's
        // non-archived children (the same figures per envelope, one level up). Only
        // groups with at least one active child appear on the dashboard; empty ones
        // are managed elsewhere. `remaining` is the header's "left".
        $groups = array_map(function ($g) {
            return [
                'id' => (int) $g['id'],
                'name' => $g['name'],
                'rank' => (int) $g['rank'],
                'child_count' => (int) $g['child_count'],
                'monthly_limit' => $g['monthly_limit'],
                'spent' => $g['spent'],
                'saved' => $g['saved'],
                'remaining' => $g['remaining'],
            ];
        }, $this->db->query(
            "SELECT g.id, g.name, g.`rank`,
                    COUNT(c.id) AS child_count,
                    COALESCE(SUM(c.monthly_limit), 0.00) AS monthly_limit,
                    COALESCE(SUM(c.spent), 0.00) AS spent,
                    COALESCE(SUM(c.saved), 0.00) AS saved,
                    COALESCE(SUM(c.monthly_limit + c.saved - c.spent), 0.00) AS remaining
             FROM category_groups g
             LEFT JOIN categories c ON c.group_id = g.id AND c.type != 'archived'
             WHERE g.budget_id = :b
             GROUP BY g.id, g.name, g.`rank`
             HAVING child_count > 0
             ORDER BY g.`rank` ASC, g.id ASC",
            [':b' => $b]
        )->fetchAll(\PDO::FETCH_ASSOC));

        // The Extra rollup, computed entirely in DECIMAL. remaining_budget and saved
        // sum standard envelopes always, and savings ONLY when pinned to a tracked
        // account (account_id IS NOT NULL) — a savings held outside tracked accounts
        // isn't in bank_total, so it must stay out of the reconciliation too.
        $rollup = $this->db->query(
            "SELECT t.*, (t.bank_total - t.remaining_budget - t.saved - t.cc_owed) AS extra FROM (
               SELECT
                 (SELECT COALESCE(SUM(balance), 0.00) FROM accounts WHERE budget_id = :b1 AND type = 'bank') AS bank_total,
                 (SELECT COALESCE(SUM(balance), 0.00) FROM accounts WHERE budget_id = :b2 AND type = 'credit_card') AS cc_owed,
                 (SELECT COALESCE(SUM(monthly_limit - spent), 0.00) FROM categories WHERE budget_id = :b3 AND (type = 'standard' OR (type = 'savings' AND account_id IS NOT NULL))) AS remaining_budget,
                 (SELECT COALESCE(SUM(saved), 0.00) FROM categories WHERE budget_id = :b4 AND (type = 'standard' OR (type = 'savings' AND account_id IS NOT NULL))) AS saved
             ) t",
            [':b1' => $b, ':b2' => $b, ':b3' => $b, ':b4' => $b]
        )->fetch(\PDO::FETCH_ASSOC);

        $this->json(['data' => [
            // The client needs the budget's currency to format every figure below.
            'budget' => [
                'id' => (int) $budget['id'],
                'name' => $budget['name'],
                'base_currency' => $budget['base_currency'],
            ],
            'accounts' => $accounts,
            'categories' => $categories,
            'groups' => $groups,
            'rollup' => [
                'bank_total' => $rollup['bank_total'],
                'remaining_budget' => $rollup['remaining_budget'],
                'saved' => $rollup['saved'],
                'cc_owed' => $rollup['cc_owed'],
                'extra' => $rollup['extra'],
            ],
        ]]);
    }
}
