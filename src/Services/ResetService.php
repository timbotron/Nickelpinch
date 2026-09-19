<?php

namespace App\Services;

use Medoo\Medoo;

/**
 * Monthly reset — "start a new month" (CODE-212 / D3). The first piece of the
 * money engine and the first component of the service layer Epic E's EntryService
 * will grow into: balance math lives in a transactional service, never a
 * controller, so apply and reverse stay co-located and testable.
 *
 * A reset closes the current month for every active envelope (all categories bar
 * archived): it rolls each envelope's unspent budget into `saved` — or draws any
 * overspend back out of `saved` — then zeroes `spent`. Categories whose
 * rollover_rule is 'reset' keep their `saved` untouched (use-it-or-lose-it); only
 * 'accumulate' categories carry the remainder.
 *
 * It is one reversible entry (type='reset') inside a DB transaction. Each affected
 * envelope gets an entry_split recording its pre-reset `spent` (so reverse can put
 * it back) and a from_saved flag marking whether it rolled into `saved` (so reverse
 * knows to back the roll-in out). Undo adds the recorded balance back to the live
 * `spent` (preserving any spending done since the reset) and subtracts the roll-in
 * against the category's current monthly_limit.
 *
 * Money is done in SQL: the columns are DECIMAL(22,2) and MySQL's fixed-point
 * arithmetic is exact, so there is no float or rounding step here (and no bcmath
 * dependency, which the runtime lacks). Amounts stay entirely in the database.
 */
class ResetService {

    private Medoo $db;

    public function __construct(Medoo $db) {
        $this->db = $db;
    }

    // Close the month for a budget. Returns the created entry's summary. The four
    // statements run in one transaction; splits are recorded from `spent` BEFORE the
    // update zeroes it.
    public function apply(int $budgetId, ?int $userId): array {
        $summary = [];
        $this->db->action(function (Medoo $db) use ($budgetId, $userId, &$summary) {
            $db->insert('entries', [
                'budget_id' => $budgetId,
                'created_by' => $userId,
                'type' => 'reset',
                'entry_date' => date('Y-m-d'),
                'total_amount' => '0.00',
                'description' => 'Monthly reset',
            ]);
            $entryId = (int) $db->id();

            // Record each active envelope's pre-reset balance + whether it accumulates.
            $db->query(
                'INSERT INTO entry_splits (entry_id, category_id, amount, from_saved)
                 SELECT :eid, id, spent, IF(rollover_rule = :acc, 1, 0)
                 FROM categories WHERE budget_id = :b AND type != :arch',
                [':eid' => $entryId, ':acc' => 'accumulate', ':b' => $budgetId, ':arch' => 'archived']
            );

            // Roll unspent budget into saved (accumulate only), then zero spent.
            $db->query(
                'UPDATE categories
                 SET saved = saved + IF(rollover_rule = :acc, monthly_limit - spent, 0), spent = 0
                 WHERE budget_id = :b AND type != :arch',
                [':acc' => 'accumulate', ':b' => $budgetId, ':arch' => 'archived']
            );

            // The entry total is the spending the month closed out.
            $db->query(
                'UPDATE entries SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM entry_splits WHERE entry_id = :eid) WHERE id = :eid',
                [':eid' => $entryId]
            );

            $row = $db->get('entries', ['id', 'entry_date', 'total_amount'], ['id' => $entryId]);
            $summary = [
                'entry_id' => (int) $row['id'],
                'entry_date' => $row['entry_date'],
                'total_amount' => $row['total_amount'],
                'reset_count' => $db->count('entry_splits', ['entry_id' => $entryId]),
            ];
        });
        return $summary;
    }

    // Undo a reset entry: restore each envelope's balance and back out its roll-in,
    // then delete the entry (its splits cascade). Recomputes the saved roll-in
    // against the category's current monthly_limit — exact unless the limit was
    // changed between the reset and this undo.
    public function reverse(int $entryId): void {
        $this->db->action(function (Medoo $db) use ($entryId) {
            $db->query(
                'UPDATE categories c
                 JOIN entry_splits s ON s.category_id = c.id AND s.entry_id = :eid
                 SET c.spent = c.spent + s.amount,
                     c.saved = c.saved - IF(s.from_saved = 1, c.monthly_limit - s.amount, 0)',
                [':eid' => $entryId]
            );
            $db->delete('entries', ['id' => $entryId]);
        });
    }
}
