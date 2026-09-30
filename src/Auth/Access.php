<?php

namespace App\Auth;

use Medoo\Medoo;

/**
 * The app's authorization guard (CODE-205 / B4). Initium's Cred answers *who you
 * are*; Access answers *what you may do* within a budget — the app's core addition
 * on top of the framework.
 *
 * A budget is the multi-tenant boundary. Every budget-scoped request resolves:
 * authenticated user (Cred) → role in the target budget → capability check →
 * (for a category viewer) the categories they may see. This is a small, defined
 * permission set — deliberately not a general RBAC engine.
 *
 *   Role    | read            | write (money ops) | manage (budget/members/sharing)
 *   --------|-----------------|-------------------|--------------------------------
 *   owner   | whole budget    | ✅                | ✅
 *   member  | whole budget    | ✅                | ❌
 *   viewer  | shared cats only| ❌                | ❌
 *
 * Pure decision object — no HTTP side effects, so it unit-tests cleanly. The HTTP
 * gate (401/403/404 + JSON) lives on App\Controllers\Base, which delegates here.
 */
class Access {

    // Capabilities a budget-scoped action can require.
    const READ = 'read';           // minimal budget context — name, my role (owner/member/viewer)
    const READ_FULL = 'read_full'; // full money surface — accounts, all categories, dashboard/Extra
    const WRITE = 'write';         // money ops: accounts, categories, entries
    const MANAGE = 'manage';       // budget settings, members, sharing, delete

    // READ_FULL vs READ: a category viewer gets READ (they must learn the budget's
    // name + that their role is viewer) but never READ_FULL — accounts, the full
    // category list, and the combined Extra are owner/member only. A viewer's narrow
    // slice (their shared category + its transactions) is served by dedicated
    // share-scoped endpoints, not the budget's full-surface routes.

    // Roles, strongest first — the order capability checks and precedence follow.
    const ROLE_OWNER = 'owner';
    const ROLE_MEMBER = 'member';
    const ROLE_VIEWER = 'viewer';

    private Medoo $db;
    private $viewer; // Cred::userDetails() array, or false when anonymous

    public function __construct(Medoo $db, $viewer) {
        $this->db = $db;
        $this->viewer = $viewer;
    }

    public function user_id() {
        return $this->viewer['user_id'] ?? null;
    }

    // The viewer's role in a budget: 'owner' | 'member' | 'viewer', or null with no
    // access (or no such budget). Owner is canonical on budgets.owner_user_id; full
    // members are budget_members rows; a viewer holds a category_shares grant on at
    // least one of the budget's categories.
    public function role($budget_id): ?string {
        if(!$this->viewer) {
            return null;
        }
        $uid = $this->viewer['user_id'];

        $owner_id = $this->db->get('budgets', 'owner_user_id', ['id' => $budget_id]);
        if(!$owner_id) {
            return null;
        }
        if($owner_id == $uid) {
            return self::ROLE_OWNER;
        }

        $role = $this->db->get('budget_members', 'role', ['budget_id' => $budget_id, 'user_id' => $uid]);
        if($role) {
            return $role;
        }

        $shares = $this->db->has('category_shares', ['[>]categories' => ['category_id' => 'id']], [
            'category_shares.user_id' => $uid,
            'categories.budget_id' => $budget_id,
        ]);
        return $shares ? self::ROLE_VIEWER : null;
    }

    // Whether a role satisfies a capability. null role (no access) satisfies nothing.
    public function role_can(?string $role, string $capability): bool {
        switch($capability) {
            case self::READ:
                return in_array($role, [self::ROLE_OWNER, self::ROLE_MEMBER, self::ROLE_VIEWER], true);
            case self::READ_FULL:
            case self::WRITE:
                return in_array($role, [self::ROLE_OWNER, self::ROLE_MEMBER], true);
            case self::MANAGE:
                return $role === self::ROLE_OWNER;
        }
        return false;
    }

    // Category ids the viewer may see in a budget. Owner/member see every category;
    // a category viewer sees only the ones shared with them; no access → none. This
    // is the scoping primitive read paths use so a viewer never sees other envelopes
    // (and the entry queries in Epic E scope to entries touching these ids).
    public function visible_category_ids($budget_id, ?string $role = null): array {
        $role = $role ?? $this->role($budget_id);

        if($role === self::ROLE_OWNER || $role === self::ROLE_MEMBER) {
            return array_map('intval', $this->db->select('categories', 'id', ['budget_id' => $budget_id]));
        }
        if($role === self::ROLE_VIEWER) {
            return array_map('intval', $this->db->select('category_shares', ['[>]categories' => ['category_id' => 'id']], 'categories.id', [
                'category_shares.user_id' => $this->user_id(),
                'categories.budget_id' => $budget_id,
            ]));
        }
        return [];
    }
}
