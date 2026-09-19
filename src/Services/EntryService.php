<?php

namespace App\Services;

use Medoo\Medoo;

/**
 * The money engine (CODE-213 / E1) — the highest-risk logic in the app. Every
 * transaction type's apply and reverse live side by side here, inside one Medoo
 * ->action() transaction, computing in integer cents, so the two directions can
 * never drift out of step. (Monthly reset is its own bulk operation in
 * App\Services\ResetService; this engine owns the per-transaction types.)
 *
 * Two primitives keep the whole thing uniform and reversible:
 *
 *   1. Account effects are DERIVED from the entry (type + total + the one or two
 *      accounts), never stored, by accountEffects(). apply() runs them forward,
 *      reverse() runs the same list negated — one function, so they cannot diverge.
 *      applyToAccount() turns a signed cash delta (+ = money into the account) into
 *      a balance change by account kind: a bank is an asset (balance += delta), a
 *      credit card is a liability (owed balance -= delta). That single rule covers
 *      purchase, deposit, withdraw, pay-CC, and transfer over any mix of accounts.
 *
 *   2. Category effects are STORED as signed entry_splits: `amount` is a signed
 *      cents delta and `from_saved` picks the column it lands on (0 = spent,
 *      1 = saved). apply() adds each; reverse() subtracts each. Because the split
 *      set is recorded at apply time, a move's "pull from saved first, then dip into
 *      spent" is frozen into the splits and reverses exactly regardless of later
 *      state.
 *
 * Money is integer cents in PHP (the runtime has no bcmath); values at rest are
 * DECIMAL(22,2) strings, converted at the edges. Accounts and categories are always
 * resolved within the budget, so the engine can't reach across tenants.
 *
 * Assumes an account's kind (bank vs credit card) is stable across an entry's
 * lifetime — the sign an account contributes is read from its current row at both
 * apply and reverse.
 */
class EntryService {

    // The transaction types this engine owns (reset is ResetService's).
    const TYPES = ['purchase', 'move', 'paycc', 'deposit', 'withdraw', 'transfer'];

    private Medoo $db;

    public function __construct(Medoo $db) {
        $this->db = $db;
    }

    // Create an entry of $type in $budgetId and apply its balance changes. Returns
    // the new entry id. Throws EntryError (transaction rolled back) on bad input.
    public function apply(int $budgetId, ?int $userId, string $type, array $input): int {
        if(!in_array($type, self::TYPES, true)) {
            throw new EntryError(['type' => ['Unknown entry type.']]);
        }

        $entryId = 0;
        $this->db->action(function (Medoo $db) use ($budgetId, $userId, $type, $input, &$entryId) {
            $plan = $this->plan($budgetId, $type, $input);

            $db->insert('entries', [
                'budget_id' => $budgetId,
                'created_by' => $userId,
                'type' => $type,
                'entry_date' => $plan['entry_date'],
                'total_amount' => self::fromCents($plan['total']),
                'description' => $plan['description'],
                'account_id' => $plan['account_id'],
                'to_account_id' => $plan['to_account_id'],
            ]);
            $entryId = (int) $db->id();

            foreach($plan['splits'] as $s) {
                $db->insert('entry_splits', [
                    'entry_id' => $entryId,
                    'category_id' => $s['category_id'],
                    'amount' => self::fromCents($s['amount_cents']),
                    'from_saved' => $s['from_saved'],
                ]);
                $this->applyToCategory($db, $s['category_id'], $s['from_saved'], $s['amount_cents']);
            }

            foreach($this->accountEffects($type, $plan['total'], $plan['account_id'], $plan['to_account_id']) as [$accId, $delta]) {
                $this->applyToAccount($db, $accId, $delta);
            }
        });
        return $entryId;
    }

    // Undo an entry and delete it (splits cascade). Reverses the same account and
    // category effects apply() ran. Only this engine's types are reversible here.
    public function reverse(int $entryId): void {
        $this->db->action(function (Medoo $db) use ($entryId) {
            $entry = $db->get('entries', ['type', 'total_amount', 'account_id', 'to_account_id'], ['id' => $entryId]);
            if(!$entry) {
                throw new EntryError(['entry' => ['Not found.']]);
            }
            if(!in_array($entry['type'], self::TYPES, true)) {
                throw new EntryError(['entry' => ['Not a reversible entry type.']]);
            }

            $total = self::toCents($entry['total_amount']);
            $acc = $entry['account_id'] !== null ? (int) $entry['account_id'] : null;
            $to = $entry['to_account_id'] !== null ? (int) $entry['to_account_id'] : null;
            foreach($this->accountEffects($entry['type'], $total, $acc, $to) as [$accId, $delta]) {
                $this->applyToAccount($db, $accId, -$delta);
            }

            foreach($db->select('entry_splits', ['category_id', 'amount', 'from_saved'], ['entry_id' => $entryId]) as $s) {
                $this->applyToCategory($db, (int) $s['category_id'], (int) $s['from_saved'], -self::toCents($s['amount']));
            }

            $db->delete('entries', ['id' => $entryId]);
        });
    }

    // Validate input for a type and build the concrete plan: total (cents), the
    // account(s) on the entry, and the signed category splits. All money integrity
    // lives here; the callers above just execute the plan.
    private function plan(int $budgetId, string $type, array $input): array {
        $base = [
            'total' => 0,
            'account_id' => null,
            'to_account_id' => null,
            'entry_date' => $this->cleanDate($input['entry_date'] ?? null),
            'description' => $this->cleanDesc($input['description'] ?? ''),
            'splits' => [],
        ];

        switch($type) {
            case 'purchase':
                $acc = $this->account($budgetId, $input['account_id'] ?? null, 'account_id');
                $rows = $input['splits'] ?? null;
                if(!is_array($rows) || count($rows) < 1 || count($rows) > 5) {
                    throw new EntryError(['splits' => ['Provide 1 to 5 category splits.']]);
                }
                $total = 0;
                foreach(array_values($rows) as $i => $row) {
                    $cat = $this->category($budgetId, $row['category_id'] ?? null, "splits.$i.category_id");
                    $amt = $this->money($row['amount'] ?? null, "splits.$i.amount");
                    $base['splits'][] = ['category_id' => (int) $cat['id'], 'amount_cents' => $amt, 'from_saved' => 0];
                    $total += $amt;
                }
                // If the caller states a total (the split form's assign-remaining
                // helper does), the splits must add up to it — the server is the
                // authority on the sum, not the client's arithmetic.
                if(isset($input['total_amount']) && $input['total_amount'] !== null && $input['total_amount'] !== '') {
                    if($this->money($input['total_amount'], 'total_amount') !== $total) {
                        throw new EntryError(['total_amount' => ['Split amounts must sum to the total.']]);
                    }
                }
                $base['total'] = $total;
                $base['account_id'] = (int) $acc['id'];
                return $base;

            case 'deposit':
                $acc = $this->account($budgetId, $input['account_id'] ?? null, 'account_id', 'bank');
                $base['total'] = $this->money($input['amount'] ?? null, 'amount');
                $base['account_id'] = (int) $acc['id'];
                return $base;

            case 'withdraw':
                $acc = $this->account($budgetId, $input['account_id'] ?? null, 'account_id', 'bank');
                $amt = $this->money($input['amount'] ?? null, 'amount');
                $base['total'] = $amt;
                $base['account_id'] = (int) $acc['id'];
                if(isset($input['category_id']) && $input['category_id'] !== null && $input['category_id'] !== '') {
                    $cat = $this->category($budgetId, $input['category_id'], 'category_id');
                    $base['splits'][] = ['category_id' => (int) $cat['id'], 'amount_cents' => $amt, 'from_saved' => 0];
                }
                return $base;

            case 'paycc':
                $bank = $this->account($budgetId, $input['account_id'] ?? null, 'account_id', 'bank');
                $card = $this->account($budgetId, $input['to_account_id'] ?? null, 'to_account_id', 'credit_card');
                $base['total'] = $this->money($input['amount'] ?? null, 'amount');
                $base['account_id'] = (int) $bank['id'];
                $base['to_account_id'] = (int) $card['id'];
                return $base;

            case 'transfer':
                $src = $this->account($budgetId, $input['account_id'] ?? null, 'account_id');
                $dst = $this->account($budgetId, $input['to_account_id'] ?? null, 'to_account_id');
                if((int) $src['id'] === (int) $dst['id']) {
                    throw new EntryError(['to_account_id' => ['Source and destination must differ.']]);
                }
                $base['total'] = $this->money($input['amount'] ?? null, 'amount');
                $base['account_id'] = (int) $src['id'];
                $base['to_account_id'] = (int) $dst['id'];
                return $base;

            case 'move':
                $from = $this->category($budgetId, $input['category_id'] ?? null, 'category_id');
                $to = $this->category($budgetId, $input['to_category_id'] ?? null, 'to_category_id');
                if((int) $from['id'] === (int) $to['id']) {
                    throw new EntryError(['to_category_id' => ['Source and destination must differ.']]);
                }
                $amt = $this->money($input['amount'] ?? null, 'amount');
                // Pull from the source's savings first, dip into its spent only if
                // savings fall short (never treat a negative saved as available).
                $fromSaved = max(0, min($amt, self::toCents($from['saved'])));
                $fromSpent = $amt - $fromSaved;
                $base['splits'][] = ['category_id' => (int) $to['id'], 'amount_cents' => $amt, 'from_saved' => 1];
                if($fromSaved > 0) {
                    $base['splits'][] = ['category_id' => (int) $from['id'], 'amount_cents' => -$fromSaved, 'from_saved' => 1];
                }
                if($fromSpent > 0) {
                    $base['splits'][] = ['category_id' => (int) $from['id'], 'amount_cents' => -$fromSpent, 'from_saved' => 0];
                }
                $base['total'] = $amt;
                return $base;
        }
        throw new EntryError(['type' => ['Unknown entry type.']]); // unreachable; guarded in apply()
    }

    // The signed cash deltas an entry applies to its account(s): + = money into the
    // account. Pure function of the entry, shared by apply and reverse.
    private function accountEffects(string $type, int $total, ?int $acc, ?int $to): array {
        switch($type) {
            case 'purchase':
            case 'withdraw':
                return [[$acc, -$total]];
            case 'deposit':
                return [[$acc, $total]];
            case 'paycc':
            case 'transfer':
                return [[$acc, -$total], [$to, $total]];
        }
        return []; // move touches no account
    }

    // Apply a signed cash delta to an account by kind: bank is an asset (+=), a
    // credit card is a liability whose owed balance moves the opposite way (-=).
    private function applyToAccount(Medoo $db, int $accId, int $deltaCash): void {
        $acc = $db->get('accounts', ['type', 'balance'], ['id' => $accId]);
        $bal = self::toCents($acc['balance']);
        $new = $acc['type'] === 'credit_card' ? $bal - $deltaCash : $bal + $deltaCash;
        $db->update('accounts', ['balance' => self::fromCents($new)], ['id' => $accId]);
    }

    // Add a signed cents delta to a category's spent (from_saved 0) or saved (1).
    private function applyToCategory(Medoo $db, int $catId, int $fromSaved, int $amountCents): void {
        $field = $fromSaved ? 'saved' : 'spent';
        $current = self::toCents($db->get('categories', $field, ['id' => $catId]));
        $db->update('categories', [$field => self::fromCents($current + $amountCents)], ['id' => $catId]);
    }

    // Resolve an account within the budget (optionally requiring a kind), or throw.
    private function account(int $budgetId, $id, string $field, ?string $requireType = null): array {
        if(!is_numeric($id)) {
            throw new EntryError([$field => ['An account is required.']]);
        }
        $row = $this->db->get('accounts', ['id', 'type', 'balance'], ['id' => (int) $id, 'budget_id' => $budgetId]);
        if(!$row) {
            throw new EntryError([$field => ['Account not found in this budget.']]);
        }
        if($requireType !== null && $row['type'] !== $requireType) {
            $label = $requireType === 'credit_card' ? 'a credit card' : 'a bank account';
            throw new EntryError([$field => ["Must be $label."]]);
        }
        return $row;
    }

    // Resolve a category within the budget, or throw. Returns id + saved (move needs
    // the current savings to decide the pull).
    private function category(int $budgetId, $id, string $field): array {
        if(!is_numeric($id)) {
            throw new EntryError([$field => ['A category is required.']]);
        }
        $row = $this->db->get('categories', ['id', 'saved'], ['id' => (int) $id, 'budget_id' => $budgetId]);
        if(!$row) {
            throw new EntryError([$field => ['Category not found in this budget.']]);
        }
        return $row;
    }

    // Validate a positive money input and return it in cents, or throw.
    private function money($raw, string $field): int {
        $s = (is_int($raw) || is_float($raw) || is_string($raw)) ? trim((string) $raw) : '';
        if($s === '' || !preg_match('/^\d{1,18}(\.\d{1,2})?$/', $s)) {
            throw new EntryError([$field => ['Must be a positive number with up to 2 decimals.']]);
        }
        $cents = self::toCents($s);
        if($cents <= 0) {
            throw new EntryError([$field => ['Must be greater than zero.']]);
        }
        return $cents;
    }

    // Default to today; otherwise require a real YYYY-MM-DD.
    private function cleanDate($raw): string {
        if($raw === null || $raw === '') {
            return date('Y-m-d');
        }
        if(!is_string($raw) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $raw, $m) || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            throw new EntryError(['entry_date' => ['Must be a real date (YYYY-MM-DD).']]);
        }
        return $raw;
    }

    private function cleanDesc($raw): string {
        $s = is_string($raw) ? $raw : (is_scalar($raw) ? (string) $raw : '');
        if(mb_strlen($s) > 255) {
            throw new EntryError(['description' => ['Must be 255 characters or fewer.']]);
        }
        return $s;
    }

    // --- integer-cents conversion (no float, no bcmath) ---

    // DECIMAL(22,2) string -> integer cents. Input is canonical DB output or already
    // format-validated, so the shape is trusted here.
    private static function toCents(string $dec): int {
        $dec = trim($dec);
        $neg = ($dec !== '' && $dec[0] === '-');
        if($neg) {
            $dec = substr($dec, 1);
        }
        $dot = strpos($dec, '.');
        $whole = $dot === false ? $dec : substr($dec, 0, $dot);
        $frac = $dot === false ? '' : substr($dec, $dot + 1);
        $frac = substr($frac . '00', 0, 2);
        $cents = ((int) $whole) * 100 + (int) $frac;
        return $neg ? -$cents : $cents;
    }

    private static function fromCents(int $cents): string {
        $neg = $cents < 0;
        $cents = abs($cents);
        return ($neg ? '-' : '') . intdiv($cents, 100) . '.' . str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
