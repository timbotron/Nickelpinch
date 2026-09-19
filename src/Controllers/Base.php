<?php

namespace App\Controllers;

use App\Auth\Access;
use Initium\Auth\Cred;
use Initium\Csrf;
use Initium\View;

/**
 * Base for Nickelpinch's own controllers. Extends core's Initium\Base (which owns
 * $this->db, the flash queue, return_code, isUUID, generate_uuid) and adds the
 * app-only toolkit: the JSON API helpers, the login gate, the shared Plates engine
 * wiring, and the HTTP gate over the App\Auth\Access authorization guard. Modeled
 * on taskshare's App\Controllers\Base.
 */
class Base extends \Initium\Base {

    protected $templates;      // lazily built by view()
    protected $viewer;         // memoized userDetails() for this request
    private $viewer_loaded = false;
    private $access;           // memoized App\Auth\Access for this request

    // The logged-in user array (user_id, email, is_admin) or false, read once per
    // request from core's Cred and cached.
    protected function viewer() {
        if(!$this->viewer_loaded) {
            $this->viewer = Cred::userDetails();
            $this->viewer_loaded = true;
        }
        return $this->viewer;
    }

    // Lazily build the shared Plates engine (app:: resolves app-first, core-fallback)
    // with the layout data. JSON API handlers never call this.
    protected function view() {
        if($this->templates !== null) {
            return $this->templates;
        }
        // Per-user theme (F7): stamp the saved preference so server-rendered pages
        // paint it with no flash. Dark is the default when unset / logged out.
        $viewer = $this->viewer();
        $theme = 'dark';
        if($viewer) {
            $saved = $this->db->get('user_profiles', 'theme', ['user_id' => $viewer['user_id']]);
            if($saved) {
                $theme = $saved;
            }
        }

        $this->templates = View::engine();
        $this->templates->addData([
            'is_logged_in' => $viewer ? true : false,
            'is_admin' => Cred::isAdmin(),
            'user_theme' => $theme,
            // The session's active budget, for the shell's switcher bootstrap (F1).
            'active_budget_id' => $_SESSION['active_budget_id'] ?? null,
        ], ['app::basic']);
        return $this->templates;
    }

    protected function require_login() {
        if(!$this->viewer()) {
            header('Location: ' . SITE_URL . 'login');
            exit;
        }
    }

    // CSRF gate for mutating XHR (the JSON endpoints in Epics C–F). The SameSite=Lax
    // session cookie already blocks cross-site sends; this required custom header is
    // the second factor — a cross-origin page cannot set it without a CORS preflight
    // we never grant. Call at the top of every state-changing JSON handler, before
    // any work. app.js's NP.req attaches the header from <meta name="csrf-token">.
    protected function verify_csrf_header(): void {
        $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if(!is_string($sent) || !hash_equals(Csrf::token(), $sent)) {
            $this->json_error('Bad CSRF token.', 400);
        }
    }

    // --- JSON API helpers ---

    protected function json_input(): array {
        $data = json_decode(file_get_contents('php://input'), true);
        return is_array($data) ? $data : [];
    }

    protected function json($data, int $code = 200) {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode($data);
        die;
    }

    protected function json_error(string $message, int $code) {
        $this->json(['error' => $message], $code);
    }

    // --- Budget authorization (HTTP gate over App\Auth\Access) ---

    // The request's authorization guard (memoized). Pure decision object; the JSON
    // side effects (401/403/404) live here in the controller layer.
    protected function access(): Access {
        if($this->access === null) {
            $this->access = new Access($this->db, $this->viewer());
        }
        return $this->access;
    }

    // Login gate for JSON endpoints: return the viewer, or end the request with a
    // 401 (the HTML require_login redirects; XHR callers want a status, not a page).
    protected function require_viewer(): array {
        $viewer = $this->viewer();
        if(!$viewer) {
            $this->json_error('Not logged in.', 401);
        }
        return $viewer;
    }

    // Authorize the viewer against a budget for a capability (Access::READ / WRITE /
    // MANAGE), or end with a JSON error. Returns ['budget' => row, 'role' => role].
    // 404 (not 403) hides a budget the viewer has no role in, so its existence never
    // leaks; 403 is only for a real role that lacks the capability.
    protected function budget_for_action($budget_id, string $capability = Access::READ): array {
        $this->require_viewer();
        $role = $this->access()->role($budget_id);
        if($role === null) {
            $this->json_error('Budget not found.', 404);
        }
        if(!$this->access()->role_can($role, $capability)) {
            $this->json_error('Not allowed.', 403);
        }
        return [
            'budget' => $this->db->get('budgets', ['id', 'owner_user_id', 'name', 'base_currency'], ['id' => $budget_id]),
            'role' => $role,
        ];
    }

    // Fetch a row from a budget-scoped table by id, confined to $budget_id, or end
    // with a 404. Guards every {budget}/{child} route (accounts, categories,
    // entries) against reaching a sibling budget's rows; 404 hides existence.
    protected function scoped_row(string $table, $id, $budget_id, $columns = '*'): array {
        // Medoo returns a scalar for a single-column string; force an array shape so
        // the row contract holds however a caller names its columns.
        if(is_string($columns) && $columns !== '*') {
            $columns = [$columns];
        }
        $row = $this->db->get($table, $columns, ['id' => $id, 'budget_id' => $budget_id]);
        if(!$row) {
            $this->json_error('Not found.', 404);
        }
        return $row;
    }

    // --- input helpers ---

    // Validate a money input and return it as a normalized string for a
    // DECIMAL(22,2) column, or 422 out. Guards the stored value only (optional sign,
    // up to 18 integer digits, up to 2 decimals) — arithmetic on balances is the
    // service layer's job (integer cents). MySQL pads the scale on store; handlers
    // read the row back for the canonical "0.00" form.
    protected function clean_money($raw, string $field, bool $allow_negative = true): string {
        $s = (is_int($raw) || is_float($raw) || is_string($raw)) ? trim((string) $raw) : '';
        $pattern = $allow_negative ? '/^-?\d{1,18}(\.\d{1,2})?$/' : '/^\d{1,18}(\.\d{1,2})?$/';
        if($s === '' || !preg_match($pattern, $s)) {
            $this->json(['errors' => [$field => ['Must be a number with up to 2 decimals.']]], 422);
        }
        return $s;
    }
}
