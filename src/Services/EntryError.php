<?php

namespace App\Services;

/**
 * A money-integrity validation failure from EntryService (CODE-213 / E1). Carries a
 * field => messages map in the same shape the JSON endpoints (E2–E5) return as a
 * 422 body, so a controller can rethrow it straight to the client. Thrown for the
 * invariants the engine must never violate (unknown type, amount not positive,
 * split count/sum, an account or category not in the budget, wrong account kind for
 * the operation) — the transaction rolls back untouched.
 */
class EntryError extends \RuntimeException {

    public array $errors;

    public function __construct(array $errors) {
        $this->errors = $errors;
        parent::__construct('Entry validation failed.');
    }
}
