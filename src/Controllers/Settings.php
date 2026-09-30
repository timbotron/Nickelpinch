<?php

namespace App\Controllers;

use App\Auth\Access;

/**
 * User settings API (CODE-220 / E8). Per-user preferences in the user_profiles
 * table — NOT budget-scoped: they belong to the logged-in user, so these gate on
 * login rather than a budget capability. GET reads the profile (schema defaults
 * when no row exists yet); PUT updates the supplied fields and upserts the row.
 *
 * Fields: theme (dark|light), default_view (simple|detailed), default_account_id
 * (the pre-selected "paid via" account, or null). Currency is deliberately absent
 * here: the plan settled it as per-budget (budgets.base_currency), edited through
 * the budget update endpoint — user_profiles has no currency column.
 */
class Settings extends Base {

    const THEMES = ['dark', 'light'];
    const VIEWS = ['simple', 'detailed'];

    // GET /api/settings — the current user's preferences (defaults if unset).
    public function show() {
        $viewer = $this->require_viewer();
        $this->json(['data' => $this->profile((int) $viewer['user_id'])]);
    }

    // PUT /api/settings — update the supplied preference fields; upsert the row.
    public function update() {
        $this->verify_csrf_header();
        $viewer = $this->require_viewer();
        $uid = (int) $viewer['user_id'];
        $input = $this->json_input();

        $fields = [];
        if(array_key_exists('theme', $input)) {
            if(!in_array($input['theme'], self::THEMES, true)) {
                $this->json(['errors' => ['theme' => ['Must be dark or light.']]], 422);
            }
            $fields['theme'] = $input['theme'];
        }
        if(array_key_exists('default_view', $input)) {
            if(!in_array($input['default_view'], self::VIEWS, true)) {
                $this->json(['errors' => ['default_view' => ['Must be simple or detailed.']]], 422);
            }
            $fields['default_view'] = $input['default_view'];
        }
        if(array_key_exists('default_account_id', $input)) {
            $fields['default_account_id'] = $this->clean_default_account($input['default_account_id']);
        }
        if(!$fields) {
            $this->json_error('Nothing to update.', 422);
        }

        if($this->db->has('user_profiles', ['user_id' => $uid])) {
            $this->db->update('user_profiles', $fields, ['user_id' => $uid]);
        } else {
            $this->db->insert('user_profiles', array_merge(['user_id' => $uid], $fields));
        }
        $this->json(['data' => $this->profile($uid)]);
    }

    // The user's profile, or the schema defaults when no row exists yet (GET never
    // writes). default_account_id comes back as an int or null.
    protected function profile(int $uid): array {
        $row = $this->db->get('user_profiles', ['theme', 'default_view', 'default_account_id'], ['user_id' => $uid])
            ?: ['theme' => 'dark', 'default_view' => 'simple', 'default_account_id' => null];
        return [
            'theme' => $row['theme'],
            'default_view' => $row['default_view'],
            'default_account_id' => $row['default_account_id'] === null ? null : (int) $row['default_account_id'],
        ];
    }

    // Validate the default "paid via" account: null/'' clears it; otherwise it must
    // be an account in a budget the user can write to (a money account they'd use).
    private function clean_default_account($raw) {
        if($raw === null || $raw === '') {
            return null;
        }
        if(!is_numeric($raw)) {
            $this->json(['errors' => ['default_account_id' => ['Must be an account id.']]], 422);
        }
        $budget_id = $this->db->get('accounts', 'budget_id', ['id' => (int) $raw]);
        if($budget_id === null || !$this->access()->role_can($this->access()->role($budget_id), Access::WRITE)) {
            $this->json(['errors' => ['default_account_id' => ['Not an account you can use.']]], 422);
        }
        return (int) $raw;
    }
}
