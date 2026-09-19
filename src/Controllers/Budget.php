<?php

namespace App\Controllers;

use App\Auth\Access;

/**
 * Budget JSON API (CODE-206 / C1). A budget is the multi-tenant boundary and the
 * unit of sharing: accounts, categories, and entries all hang off it. A user may
 * own one budget and belong to others (full member or category viewer), so the
 * app is multi-budget with a switcher, and the domain API is budget-scoped
 * (/api/budgets/{b}/...).
 *
 * Authorization goes through the App\Auth\Access guard via Base::budget_for_action
 * (capability READ / MANAGE). CRUD returns JSON; mutations gate on the CSRF header.
 */
class Budget extends Base {

    // GET /api/budgets — budgets the viewer owns or belongs to, each with my role.
    public function index() {
        $viewer = $this->require_viewer();
        $this->json(['data' => $this->list_budgets($viewer['user_id'])]);
    }

    // POST /api/budgets — create a budget; the creator becomes its owner.
    public function create() {
        $viewer = $this->require_viewer();
        $this->verify_csrf_header();
        $input = $this->json_input();

        $v = new \Valitron\Validator($input);
        $v->rule('required', 'name');
        $v->rule('lengthMax', 'name', 200);
        if(!$v->validate()) {
            $this->json(['errors' => $v->errors()], 422);
        }
        $currency = $this->clean_currency($input['base_currency'] ?? 'USD');

        $this->db->insert('budgets', [
            'owner_user_id' => $viewer['user_id'],
            'name' => $input['name'],
            'base_currency' => $currency,
        ]);
        $id = (int) $this->db->id();
        $this->json(['data' => ['id' => $id, 'name' => $input['name'], 'base_currency' => $currency, 'role' => 'owner']], 201);
    }

    // GET /api/budgets/{b}/summary — the budget plus my role in it.
    public function summary($vars) {
        ['budget' => $budget, 'role' => $role] = $this->budget_for_action($vars['b'], Access::READ);
        $this->json(['data' => [
            'id' => (int) $budget['id'],
            'name' => $budget['name'],
            'base_currency' => $budget['base_currency'],
            'role' => $role,
            'is_owner' => $role === 'owner',
        ]]);
    }

    // PUT /api/budgets/{b} — rename / change currency (owner only).
    public function update($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::MANAGE);
        $input = $this->json_input();

        $fields = [];
        if(array_key_exists('name', $input)) {
            $v = new \Valitron\Validator($input);
            $v->rule('required', 'name');
            $v->rule('lengthMax', 'name', 200);
            if(!$v->validate()) {
                $this->json(['errors' => $v->errors()], 422);
            }
            $fields['name'] = $input['name'];
        }
        if(array_key_exists('base_currency', $input)) {
            $fields['base_currency'] = $this->clean_currency($input['base_currency']);
        }
        if(!$fields) {
            $this->json_error('Nothing to update.', 422);
        }

        $this->db->update('budgets', $fields, ['id' => $vars['b']]);
        $updated = $this->db->get('budgets', ['id', 'name', 'base_currency'], ['id' => $vars['b']]);
        $this->json(['data' => ['id' => (int) $updated['id'], 'name' => $updated['name'], 'base_currency' => $updated['base_currency']]]);
    }

    // DELETE /api/budgets/{b} — remove the budget (owner only). FKs cascade its
    // accounts, categories, entries, members, and shares.
    public function delete($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::MANAGE);

        $this->db->delete('budgets', ['id' => $vars['b']]);
        if(($_SESSION['active_budget_id'] ?? null) == $vars['b']) {
            unset($_SESSION['active_budget_id']);
        }
        $this->json(['data' => ['deleted' => true]]);
    }

    // POST /api/budgets/{b}/switch — make this the active budget for the session.
    // ('switch' is a reserved word, hence switch_to.)
    public function switch_to($vars) {
        $this->verify_csrf_header();
        ['budget' => $budget, 'role' => $role] = $this->budget_for_action($vars['b'], Access::READ);

        $_SESSION['active_budget_id'] = (int) $budget['id'];
        $this->json(['data' => ['id' => (int) $budget['id'], 'name' => $budget['name'], 'role' => $role]]);
    }

    // Budgets the user owns or belongs to (member or category viewer), keyed by id
    // so a stronger role wins when several sources name the same budget. Kept
    // separate from index() so it can be reused for hydration and unit-tested.
    protected function list_budgets(int $uid): array {
        $budgets = [];

        foreach($this->db->select('budgets', ['id', 'name', 'base_currency'], ['owner_user_id' => $uid, 'ORDER' => ['created_at' => 'ASC']]) as $b) {
            $budgets[(int) $b['id']] = ['id' => (int) $b['id'], 'name' => $b['name'], 'base_currency' => $b['base_currency'], 'role' => 'owner'];
        }

        $members = $this->db->select('budget_members', ['[>]budgets' => ['budget_id' => 'id']], [
            'budgets.id (id)',
            'budgets.name (name)',
            'budgets.base_currency (base_currency)',
            'budget_members.role (role)',
        ], ['budget_members.user_id' => $uid]);
        foreach($members as $b) {
            $id = (int) $b['id'];
            if(!isset($budgets[$id])) {
                $budgets[$id] = ['id' => $id, 'name' => $b['name'], 'base_currency' => $b['base_currency'], 'role' => $b['role']];
            }
        }

        $shared = $this->db->select('category_shares', ['[>]categories' => ['category_id' => 'id']], [
            'categories.budget_id (budget_id)',
        ], ['category_shares.user_id' => $uid, 'GROUP' => 'categories.budget_id']);
        foreach($shared as $row) {
            $id = (int) $row['budget_id'];
            if(!isset($budgets[$id])) {
                $meta = $this->db->get('budgets', ['id', 'name', 'base_currency'], ['id' => $id]);
                if($meta) {
                    $budgets[$id] = ['id' => (int) $meta['id'], 'name' => $meta['name'], 'base_currency' => $meta['base_currency'], 'role' => 'viewer'];
                }
            }
        }

        return array_values($budgets);
    }

    // Normalize a currency code to a 3-letter uppercase ISO code, or 422 out.
    protected function clean_currency(string $raw): string {
        $currency = strtoupper(trim($raw));
        if(!preg_match('/^[A-Z]{3}$/', $currency)) {
            $this->json(['errors' => ['base_currency' => ['Currency must be a 3-letter code.']]], 422);
        }
        return $currency;
    }
}
