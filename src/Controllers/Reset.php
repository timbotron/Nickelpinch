<?php

namespace App\Controllers;

use App\Auth\Access;
use App\Services\ResetService;

/**
 * Monthly reset API (CODE-212 / D3). Thin HTTP gate over App\Services\ResetService:
 * authorize the viewer against the budget (WRITE — a money op, owner/member only),
 * check the CSRF header, delegate the transactional work to the service. "Start a
 * new month" and its undo.
 */
class Reset extends Base {

    // POST /api/budgets/{b}/reset — close the current month for this budget.
    public function create($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);

        $summary = (new ResetService($this->db))->apply((int) $vars['b'], (int) $this->viewer()['user_id']);
        $this->json(['data' => $summary], 201);
    }

    // DELETE /api/budgets/{b}/reset/{e} — undo a reset. Only the most recent reset
    // can be undone: reversing an older one while newer resets stand would restore
    // balances against a state that no longer exists.
    public function delete($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);

        $entry = $this->scoped_row('entries', $vars['e'], $vars['b'], ['id', 'type']);
        if($entry['type'] !== 'reset') {
            $this->json_error('Reset not found.', 404);
        }
        if($this->db->has('entries', ['budget_id' => $vars['b'], 'type' => 'reset', 'id[>]' => $vars['e']])) {
            $this->json_error('A newer reset exists; undo it first.', 409);
        }

        (new ResetService($this->db))->reverse((int) $vars['e']);
        $this->json(['data' => ['reversed' => true, 'entry_id' => (int) $vars['e']]]);
    }
}
