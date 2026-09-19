<?php

namespace App\Controllers;

use App\Auth\Access;
use App\Services\EntryError;
use App\Services\EntryService;

/**
 * Entries JSON API — the HTTP layer over App\Services\EntryService (the money
 * engine, E1). Each handler authorizes the viewer against the budget (WRITE — a
 * money op), checks the CSRF header, then delegates the balance work to the
 * service, translating an EntryError into a 422 with the same field => messages
 * shape the rest of the API uses. The controller does no money math itself.
 *
 * E2 (CODE-214) adds purchase + the shared entry serializer; move / pay-CC /
 * deposit / withdraw (E3), transfer (E4), and detail + delete (E5) land on top.
 */
class Entry extends Base {

    // The money operations exposed for creation, mapped 1:1 to EntryService types.
    // The whitelist grew per ticket: purchase (E2); move / pay-CC / deposit /
    // withdraw (E3); transfer (E4). A path type outside it is not an endpoint.
    const CREATE_TYPES = ['purchase', 'move', 'paycc', 'deposit', 'withdraw', 'transfer'];

    // POST /api/budgets/{b}/entries/{type} — one dispatcher for every create. The
    // engine owns each type's balance math and validation; here we only whitelist
    // the operation, gate it (in create_entry), and shape the result. purchase is
    // paid to a bank (balance drops) or a credit card (owed rises); move shifts into
    // a category's saved; pay-CC drops a bank and the card's owed together; deposit
    // adds to a bank; withdraw drops a bank, optionally attributed to an envelope;
    // transfer moves between two accounts with no envelope side.
    public function create($vars) {
        if(!in_array($vars['type'], self::CREATE_TYPES, true)) {
            $this->json_error('Unknown entry type.', 404);
        }
        $this->json(['data' => $this->create_entry($vars['b'], $vars['type'])], 201);
    }

    // Every value entries.type can hold — the filterable set for history (the six
    // transaction types plus reset, which shows in the feed like any other entry).
    const HISTORY_TYPES = ['purchase', 'move', 'paycc', 'deposit', 'withdraw', 'transfer', 'reset'];

    // GET /api/budgets/{b}/entries — the history/list, newest first. Optional filters
    // (query string): type (one of HISTORY_TYPES), category (entries with a split on
    // it), and range in days (30 / 90 / 180) or all. Paged via limit (<=500) + offset;
    // meta carries the filtered total. READ_FULL — the feed is the money surface.
    public function index($vars) {
        $this->budget_for_action($vars['b'], Access::READ_FULL);

        $conds = ['entries.budget_id = :b'];
        $params = [':b' => (int) $vars['b']];

        $type = $_GET['type'] ?? null;
        if($type !== null && $type !== '') {
            if(!in_array($type, self::HISTORY_TYPES, true)) {
                $this->json(['errors' => ['type' => ['Unknown entry type.']]], 422);
            }
            $conds[] = 'entries.type = :type';
            $params[':type'] = $type;
        }

        $range = $_GET['range'] ?? 'all';
        if($range !== 'all') {
            if(!in_array((string) $range, ['30', '90', '180'], true)) {
                $this->json(['errors' => ['range' => ['Must be 30, 90, 180, or all.']]], 422);
            }
            $conds[] = 'entries.entry_date >= :cutoff';
            $params[':cutoff'] = date('Y-m-d', strtotime('-' . (int) $range . ' days'));
        }

        $cat_col = '';
        $category = $_GET['category'] ?? null;
        if($category !== null && $category !== '') {
            if(!is_numeric($category)) {
                $this->json(['errors' => ['category' => ['Must be a category id.']]], 422);
            }
            // A subquery, not a join: an entry can split the same category twice, and
            // a join would then list it twice.
            $conds[] = 'entries.id IN (SELECT entry_id FROM entry_splits WHERE category_id = :cat)';
            $params[':cat'] = (int) $category;
            // Surface this envelope's slice of each entry (signed sum of its splits)
            // so the list row can show the portion, not the whole total (F5 / CODE-312).
            // The id is validated numeric, so inlining it is injection-safe.
            $cat_col = ', (SELECT COALESCE(SUM(amount), 0) FROM entry_splits WHERE entry_id = entries.id AND category_id = ' . (int) $category . ') AS category_amount';
        }

        $limit = min(500, max(1, (int) ($_GET['limit'] ?? 100)));
        $offset = max(0, (int) ($_GET['offset'] ?? 0));
        $where = implode(' AND ', $conds);

        $total = (int) $this->db->query("SELECT COUNT(*) FROM entries WHERE $where", $params)->fetchColumn();
        $rows = $this->db->query(
            "SELECT id, type, entry_date, total_amount, description, account_id, to_account_id, created_by$cat_col
             FROM entries WHERE $where ORDER BY entry_date DESC, id DESC LIMIT $limit OFFSET $offset",
            $params
        )->fetchAll(\PDO::FETCH_ASSOC);

        $data = array_map(function ($e) {
            $row = $this->list_row($e);
            if(array_key_exists('category_amount', $e)) {
                $row['category_amount'] = $e['category_amount'];
            }
            return $row;
        }, $rows);

        $this->json(['data' => $data, 'meta' => [
            'total' => $total,
            'count' => count($rows),
            'limit' => $limit,
            'offset' => $offset,
        ]]);
    }

    // GET /api/budgets/{b}/entries/{e} — the entry with its split breakdown. Detail
    // is part of the money surface, so it needs READ_FULL (owner/member, not a
    // category viewer, whose narrower feed is served by share-scoped routes). The
    // row is confined to the budget, so a cross-budget id 404s.
    public function show($vars) {
        $this->budget_for_action($vars['b'], Access::READ_FULL);
        $this->scoped_row('entries', $vars['e'], $vars['b'], ['id']);
        $this->json(['data' => $this->entry_shape((int) $vars['e'])]);
    }

    // DELETE /api/budgets/{b}/entries/{e} — reverse the entry's balance changes and
    // remove it (splits cascade). Each transaction entry records its own deltas, so
    // reversal is order-independent — no latest-only rule. A reset entry is refused
    // here by the engine (undo it via the reset route); that surfaces as a 422.
    public function destroy($vars) {
        $this->verify_csrf_header();
        $this->budget_for_action($vars['b'], Access::WRITE);
        $this->scoped_row('entries', $vars['e'], $vars['b'], ['id']);
        try {
            (new EntryService($this->db))->reverse((int) $vars['e']);
        } catch(EntryError $e) {
            $this->json(['errors' => $e->errors], 422);
        }
        $this->json(['data' => ['deleted' => true]]);
    }

    // Shared create path: gate, run the engine, 422 on validation failure, else
    // return the created entry. Returns the entry shape (never reached on error —
    // json() ends the request).
    protected function create_entry($budgetId, string $type): array {
        $this->verify_csrf_header();
        $this->budget_for_action($budgetId, Access::WRITE);
        try {
            $id = (new EntryService($this->db))->apply((int) $budgetId, (int) $this->viewer()['user_id'], $type, $this->json_input());
        } catch(EntryError $e) {
            $this->json(['errors' => $e->errors], 422);
        }
        return $this->entry_shape($id);
    }

    // An entry plus its category splits, in client shape. Shared by the create
    // handlers and E5's detail; the scalar fields come from list_row.
    protected function entry_shape(int $id): array {
        $e = $this->db->get('entries', ['id', 'type', 'entry_date', 'total_amount', 'description', 'account_id', 'to_account_id', 'created_by'], ['id' => $id]);
        $shape = $this->list_row($e);
        $shape['splits'] = array_map(function ($s) {
            return [
                'category_id' => (int) $s['category_id'],
                'amount' => $s['amount'],
                'from_saved' => (int) $s['from_saved'] === 1,
            ];
        }, $this->db->select('entry_splits', ['category_id', 'amount', 'from_saved'], ['entry_id' => $id]));
        return $shape;
    }

    // The scalar shape of an entry row (no splits). Money stays a DECIMAL string;
    // ids become ints. The history list uses this directly; entry_shape adds splits.
    protected function list_row(array $e): array {
        return [
            'id' => (int) $e['id'],
            'type' => $e['type'],
            'entry_date' => $e['entry_date'],
            'total_amount' => $e['total_amount'],
            'description' => $e['description'],
            'account_id' => $e['account_id'] === null ? null : (int) $e['account_id'],
            'to_account_id' => $e['to_account_id'] === null ? null : (int) $e['to_account_id'],
            'created_by' => $e['created_by'] === null ? null : (int) $e['created_by'],
        ];
    }
}
