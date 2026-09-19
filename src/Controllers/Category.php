<?php

namespace App\Controllers;

use App\Auth\Access;

/**
 * Categories JSON API (CODE-211 / D2). Categories are the spending/savings
 * envelopes: money divided into monthly limits, with `spent` consumed this period
 * and `saved` the rolled-over remainder. `rollover_rule` decides what the monthly
 * reset (D3) does with an unspent limit — accumulate it into `saved`, or reset.
 *
 * The type list lives in one place (self::TYPES). The legacy app overloaded a
 * single `class` column (20/30/40/255) and its create flow special-cased the
 * values, which is why making a savings category silently failed; here every type
 * takes the same validated path, so that bug can't recur by construction.
 *
 * Categories are the money surface, not a viewer's slice: reads require READ_FULL
 * (owner/member, never a category viewer — their single shared envelope is served
 * by dedicated share-scoped routes) and mutations require WRITE. All routes are
 * budget-scoped and rows are confined to the budget via Base::scoped_row.
 */
class Category extends Base {

    // The authoritative type + rollover-rule lists — the single source of truth the
    // ticket calls for. Anything outside them 422s.
    const TYPES = ['standard', 'savings', 'archived'];
    const ROLLOVER_RULES = ['accumulate', 'reset'];

    // Columns returned to the client (never budget_id / timestamps). account_id pins
    // a savings envelope to the bank account holding it (null = held externally).
    const OUT = ['id', 'name', 'type', 'monthly_limit', 'spent', 'saved', 'rollover_rule', 'account_id', 'rank'];

    // GET /api/budgets/{b}/categories — ordered by rank then id (the dashboard order).
    public function index($vars) {
        $this->budget_for_action($vars['b'], Access::READ_FULL);
        $rows = $this->db->select('categories', self::OUT, ['budget_id' => $vars['b'], 'ORDER' => ['rank' => 'ASC', 'id' => 'ASC']]);
        $this->json(['data' => array_map([$this, 'shape'], $rows)]);
    }

    // POST /api/budgets/{b}/categories
    public function create($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);

        $fields = $this->build_fields($this->json_input(), null, (int) $vars['b']);
        $fields['budget_id'] = (int) $vars['b'];
        // Default rank appends to the end of this budget's list.
        if(!array_key_exists('rank', $fields)) {
            $max = $this->db->max('categories', 'rank', ['budget_id' => $vars['b']]);
            $fields['rank'] = $max === null ? 0 : (int) $max + 1;
        }
        $this->db->insert('categories', $fields);
        $this->json(['data' => $this->shape($this->db->get('categories', self::OUT, ['id' => $this->db->id()]))], 201);
    }

    // PUT /api/budgets/{b}/categories/{c}
    public function update($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);
        $existing = $this->scoped_row('categories', $vars['c'], $vars['b'], ['id', 'type']);

        $fields = $this->build_fields($this->json_input(), $existing, (int) $vars['b']);
        if(!$fields) {
            $this->json_error('Nothing to update.', 422);
        }
        $this->db->update('categories', $fields, ['id' => $vars['c']]);
        $this->json(['data' => $this->shape($this->db->get('categories', self::OUT, ['id' => $vars['c']]))]);
    }

    // DELETE /api/budgets/{b}/categories/{c}. entry_splits and category_shares are
    // ON DELETE CASCADE, so this drops the envelope's split history with it — a
    // category with real transactions is normally retired by setting type=archived,
    // not deleted.
    public function delete($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);
        $this->scoped_row('categories', $vars['c'], $vars['b'], ['id']);

        $this->db->delete('categories', ['id' => $vars['c']]);
        $this->json(['data' => ['deleted' => true]]);
    }

    // Build the writable column set from input. $existing null = create (name +
    // defaults required); otherwise update (only supplied keys change). monthly_limit
    // is a goal/limit so it's non-negative; spent and saved are running tallies the
    // service layer (or a hand correction) can push either way, so they're signed.
    private function build_fields(array $input, ?array $existing, int $budgetId): array {
        $creating = ($existing === null);
        $fields = [];

        if($creating || array_key_exists('type', $input)) {
            $type = $input['type'] ?? 'standard';
            if(!in_array($type, self::TYPES, true)) {
                $this->json(['errors' => ['type' => ['Must be one of: ' . implode(', ', self::TYPES) . '.']]], 422);
            }
            $fields['type'] = $type;
        }
        // Effective type for the account-pin rule below.
        $type = $fields['type'] ?? ($existing['type'] ?? 'standard');

        if($creating || array_key_exists('rollover_rule', $input)) {
            $rule = $input['rollover_rule'] ?? 'accumulate';
            if(!in_array($rule, self::ROLLOVER_RULES, true)) {
                $this->json(['errors' => ['rollover_rule' => ['Must be one of: ' . implode(', ', self::ROLLOVER_RULES) . '.']]], 422);
            }
            $fields['rollover_rule'] = $rule;
        }

        if($creating || array_key_exists('name', $input)) {
            $v = new \Valitron\Validator($input);
            $v->rule('required', 'name');
            $v->rule('lengthMax', 'name', 200);
            if(!$v->validate()) {
                $this->json(['errors' => $v->errors()], 422);
            }
            $fields['name'] = $input['name'];
        }

        if($creating) {
            $fields['monthly_limit'] = $this->clean_money($input['monthly_limit'] ?? '0', 'monthly_limit', false);
            $fields['spent'] = $this->clean_money($input['spent'] ?? '0', 'spent');
            $fields['saved'] = $this->clean_money($input['saved'] ?? '0', 'saved');
        } else {
            if(array_key_exists('monthly_limit', $input)) {
                $fields['monthly_limit'] = $this->clean_money($input['monthly_limit'], 'monthly_limit', false);
            }
            if(array_key_exists('spent', $input)) {
                $fields['spent'] = $this->clean_money($input['spent'], 'spent');
            }
            if(array_key_exists('saved', $input)) {
                $fields['saved'] = $this->clean_money($input['saved'], 'saved');
            }
        }

        // account_id pins a SAVINGS envelope to the bank account holding it. Only
        // savings may carry it; any other type forces it null (incl. switching a
        // savings category to standard/archived). null on a savings = held outside
        // tracked accounts (the old "external savings").
        if($type === 'savings') {
            if($creating || array_key_exists('account_id', $input)) {
                $a = $input['account_id'] ?? null;
                $fields['account_id'] = ($a === null || $a === '') ? null : $this->clean_account($a, $budgetId);
            }
        } elseif($creating || array_key_exists('type', $input)) {
            $fields['account_id'] = null;
        }

        if(array_key_exists('rank', $input)) {
            $fields['rank'] = $this->clean_rank($input['rank']);
        }

        return $fields;
    }

    // Validate a savings envelope's pinned account: it must be a BANK account in this
    // budget. Returns the id, or 422 out. (Credit cards can't hold savings.)
    private function clean_account($raw, int $budgetId): int {
        if(!is_numeric($raw)) {
            $this->json(['errors' => ['account_id' => ['Must be an account id.']]], 422);
        }
        $acct = $this->db->get('accounts', ['id', 'type'], ['id' => (int) $raw, 'budget_id' => $budgetId]);
        if(!$acct) {
            $this->json(['errors' => ['account_id' => ['Account not found in this budget.']]], 422);
        }
        if($acct['type'] !== 'bank') {
            $this->json(['errors' => ['account_id' => ['Savings must be held in a bank account.']]], 422);
        }
        return (int) $acct['id'];
    }

    // A display-order rank (non-negative integer), or 422 out.
    private function clean_rank($raw): int {
        if(!is_numeric($raw) || (int) $raw != $raw || (int) $raw < 0) {
            $this->json(['errors' => ['rank' => ['Must be a non-negative integer.']]], 422);
        }
        return (int) $raw;
    }

    // DB row -> client shape (ints for id/rank; DECIMAL strings pass through).
    private function shape(array $r): array {
        return [
            'id' => (int) $r['id'],
            'name' => $r['name'],
            'type' => $r['type'],
            'monthly_limit' => $r['monthly_limit'],
            'spent' => $r['spent'],
            'saved' => $r['saved'],
            'rollover_rule' => $r['rollover_rule'],
            'account_id' => $r['account_id'] === null ? null : (int) $r['account_id'],
            'rank' => (int) $r['rank'],
        ];
    }
}
