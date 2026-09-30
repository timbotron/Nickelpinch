<?php

namespace App\Controllers;

use App\Auth\Access;

/**
 * Accounts JSON API (CODE-210 / D1). Accounts are first-class, separate from
 * spending/savings categories: a budget has any number of bank accounts and
 * credit cards. `balance` is real cash on a bank and amount owed on a card;
 * `credit_limit` + `due_date` (day of month) apply to cards only. Currency is
 * budget-level (one per budget), so accounts carry none.
 *
 * Accounts are the money surface, not a viewer's slice: reads require READ_FULL
 * (owner/member, never a category viewer) and mutations require WRITE. All routes
 * are budget-scoped and rows are confined to the budget via Base::scoped_row.
 */
class Account extends Base {

    const TYPES = ['bank', 'credit_card'];

    // Columns returned to the client (never budget_id / timestamps).
    const OUT = ['id', 'name', 'type', 'balance', 'credit_limit', 'due_date'];

    // GET /api/budgets/{b}/accounts
    public function index($vars) {
        $this->budget_for_action($vars['b'], Access::READ_FULL);
        $accounts = $this->db->select('accounts', self::OUT, ['budget_id' => $vars['b'], 'ORDER' => ['type' => 'ASC', 'id' => 'ASC']]);
        $this->json(['data' => array_map([$this, 'shape'], $accounts)]);
    }

    // POST /api/budgets/{b}/accounts
    public function create($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);

        $fields = $this->build_fields($this->json_input(), null);
        $fields['budget_id'] = (int) $vars['b'];
        $this->db->insert('accounts', $fields);
        $this->json(['data' => $this->shape($this->db->get('accounts', self::OUT, ['id' => $this->db->id()]))], 201);
    }

    // PUT /api/budgets/{b}/accounts/{a}
    public function update($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);
        $existing = $this->scoped_row('accounts', $vars['a'], $vars['b'], ['id', 'type']);

        $fields = $this->build_fields($this->json_input(), $existing);
        if(!$fields) {
            $this->json_error('Nothing to update.', 422);
        }
        $this->db->update('accounts', $fields, ['id' => $vars['a']]);
        $this->json(['data' => $this->shape($this->db->get('accounts', self::OUT, ['id' => $vars['a']]))]);
    }

    // DELETE /api/budgets/{b}/accounts/{a}. entries.account_id / to_account_id are
    // ON DELETE SET NULL, so past transactions survive the account's removal.
    public function delete($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);
        $this->scoped_row('accounts', $vars['a'], $vars['b'], ['id']);

        $this->db->delete('accounts', ['id' => $vars['a']]);
        $this->json(['data' => ['deleted' => true]]);
    }

    // Build the writable column set from input. $existing null = create (name +
    // defaults required); otherwise update (only supplied keys change). type drives
    // the card-only fields: on a bank, credit_limit + due_date are forced null.
    private function build_fields(array $input, ?array $existing): array {
        $creating = ($existing === null);
        $fields = [];

        if($creating || array_key_exists('type', $input)) {
            $type = $input['type'] ?? 'bank';
            if(!in_array($type, self::TYPES, true)) {
                $this->json(['errors' => ['type' => ['Must be bank or credit_card.']]], 422);
            }
            $fields['type'] = $type;
        }
        $type = $fields['type'] ?? ($existing['type'] ?? 'bank');

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
            $fields['balance'] = $this->clean_money($input['balance'] ?? '0', 'balance');
        } elseif(array_key_exists('balance', $input)) {
            $fields['balance'] = $this->clean_money($input['balance'], 'balance');
        }

        if($type === 'credit_card') {
            if($creating || array_key_exists('credit_limit', $input)) {
                $cl = $input['credit_limit'] ?? null;
                $fields['credit_limit'] = ($cl === null || $cl === '') ? null : $this->clean_money($cl, 'credit_limit', false);
            }
            if($creating || array_key_exists('due_date', $input)) {
                $dd = $input['due_date'] ?? null;
                $fields['due_date'] = ($dd === null || $dd === '') ? null : $this->clean_day($dd);
            }
        } elseif($creating || array_key_exists('type', $input)) {
            // bank (fresh, or switched from a card): no limit / due date.
            $fields['credit_limit'] = null;
            $fields['due_date'] = null;
        }

        return $fields;
    }

    // A day-of-month (1–31), or 422 out.
    private function clean_day($raw): int {
        if(!is_numeric($raw) || (int) $raw != $raw || (int) $raw < 1 || (int) $raw > 31) {
            $this->json(['errors' => ['due_date' => ['Must be a day of month 1–31.']]], 422);
        }
        return (int) $raw;
    }

    // DB row -> client shape (ints for id/day; DECIMAL strings pass through).
    private function shape(array $r): array {
        return [
            'id' => (int) $r['id'],
            'name' => $r['name'],
            'type' => $r['type'],
            'balance' => $r['balance'],
            'credit_limit' => $r['credit_limit'],
            'due_date' => $r['due_date'] === null ? null : (int) $r['due_date'],
        ];
    }
}
