<?php

namespace App\Controllers;

use App\Auth\Access;

/**
 * Category groups JSON API (CODE-350 / part of CODE-348). A group is an optional
 * display grouping of categories within a budget (e.g. "Bills") — organizational
 * only, no balances; the dashboard (CODE-351) rolls a group's children up to one
 * "left" figure and expands to show them. Assigning a category to a group happens on
 * the category itself (Category::update's `group_id`); this controller owns the
 * groups and their order.
 *
 * Same access shape as categories/accounts — groups are envelope organization, not
 * budget administration: index needs READ_FULL (owner/member, never a category
 * viewer), mutations need WRITE + the CSRF header. Rows are confined to the budget
 * via Base::scoped_row.
 */
class CategoryGroup extends Base {

    // Columns returned to the client (never budget_id / timestamps).
    const OUT = ['id', 'name', 'rank'];

    // GET /api/budgets/{b}/category-groups — groups in display order, each with its
    // ordered child category ids (so the manage/dashboard UIs render membership).
    public function index($vars) {
        $this->budget_for_action($vars['b'], Access::READ_FULL);
        $groups = $this->db->select('category_groups', self::OUT, ['budget_id' => $vars['b'], 'ORDER' => ['rank' => 'ASC', 'id' => 'ASC']]);
        // Bucket the budget's grouped categories under their group, in category order.
        $kids = $this->db->select('categories', ['id', 'group_id'], [
            'budget_id' => $vars['b'], 'group_id[!]' => null, 'ORDER' => ['rank' => 'ASC', 'id' => 'ASC'],
        ]);
        $by_group = [];
        foreach($kids as $k) {
            $by_group[(int) $k['group_id']][] = (int) $k['id'];
        }
        $this->json(['data' => array_map(function ($g) use ($by_group) {
            return [
                'id' => (int) $g['id'],
                'name' => $g['name'],
                'rank' => (int) $g['rank'],
                'category_ids' => $by_group[(int) $g['id']] ?? [],
            ];
        }, $groups)]);
    }

    // POST /api/budgets/{b}/category-groups
    public function create($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);
        $fields = $this->build_fields($this->json_input(), true);
        $fields['budget_id'] = (int) $vars['b'];
        // Default rank appends to the end of this budget's group list.
        $max = $this->db->max('category_groups', 'rank', ['budget_id' => $vars['b']]);
        $fields['rank'] = $max === null ? 0 : (int) $max + 1;
        $this->db->insert('category_groups', $fields);
        $this->json(['data' => $this->shape($this->db->get('category_groups', self::OUT, ['id' => $this->db->id()]))], 201);
    }

    // PUT /api/budgets/{b}/category-groups/{g} — rename and/or re-rank.
    public function update($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);
        $this->scoped_row('category_groups', $vars['g'], $vars['b'], ['id']);
        $fields = $this->build_fields($this->json_input(), false);
        if(!$fields) {
            $this->json_error('Nothing to update.', 422);
        }
        $this->db->update('category_groups', $fields, ['id' => $vars['g']]);
        $this->json(['data' => $this->shape($this->db->get('category_groups', self::OUT, ['id' => $vars['g']]))]);
    }

    // DELETE /api/budgets/{b}/category-groups/{g}. categories.group_id is ON DELETE
    // SET NULL, so the group's envelopes survive — they just fall back to ungrouped.
    public function delete($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);
        $this->scoped_row('category_groups', $vars['g'], $vars['b'], ['id']);
        $this->db->delete('category_groups', ['id' => $vars['g']]);
        $this->json(['data' => ['deleted' => true]]);
    }

    // POST /api/budgets/{b}/category-groups/reorder — body {order: [id, ...]}. Sets
    // each listed group's rank to its position, transactionally. Every id must be a
    // distinct group in this budget; a stray or duplicate id 422s and nothing writes.
    // Returns the reordered list.
    public function reorder($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);
        $order = $this->json_input()['order'] ?? null;
        if(!is_array($order) || !$order) {
            $this->json(['errors' => ['order' => ['Must be a non-empty array of group ids.']]], 422);
        }
        $ids = array_map('intval', $order);
        if(count($ids) !== count(array_unique($ids))) {
            $this->json(['errors' => ['order' => ['Group ids must be distinct.']]], 422);
        }
        if($this->db->count('category_groups', ['id' => $ids, 'budget_id' => $vars['b']]) !== count($ids)) {
            $this->json(['errors' => ['order' => ['All ids must be groups in this budget.']]], 422);
        }
        $this->db->action(function () use ($ids) {
            foreach($ids as $i => $id) {
                $this->db->update('category_groups', ['rank' => $i], ['id' => $id]);
            }
        });
        $this->index($vars);
    }

    // Build the writable column set. $creating true = name required; otherwise only
    // supplied keys change (name and/or rank).
    private function build_fields(array $input, bool $creating): array {
        $fields = [];
        if($creating || array_key_exists('name', $input)) {
            $v = new \Valitron\Validator($input);
            $v->rule('required', 'name');
            $v->rule('lengthMax', 'name', 200);
            if(!$v->validate()) {
                $this->json(['errors' => $v->errors()], 422);
            }
            $fields['name'] = $input['name'];
        }
        if(array_key_exists('rank', $input)) {
            $fields['rank'] = $this->clean_rank($input['rank']);
        }
        return $fields;
    }

    // A display-order rank (non-negative integer), or 422 out.
    private function clean_rank($raw): int {
        if(!is_numeric($raw) || (int) $raw != $raw || (int) $raw < 0) {
            $this->json(['errors' => ['rank' => ['Must be a non-negative integer.']]], 422);
        }
        return (int) $raw;
    }

    // DB row -> client shape (ints for id/rank).
    private function shape(array $r): array {
        return ['id' => (int) $r['id'], 'name' => $r['name'], 'rank' => (int) $r['rank']];
    }
}
