<?php

namespace App\Controllers;

use App\Auth\Access;

/**
 * Reports API (CODE-235). Server-computed spend aggregations feeding the charts, over
 * entries + entry_splits. "Spend" = split amounts on `purchase` / `withdraw` entries —
 * the two types that raise a category's `spent`; moves (savings) and resets are
 * excluded by the entry-type filter. READ_FULL (money surface, owner/member). Exact
 * DECIMAL-in-SQL, like the dashboard rollup.
 */
class Report extends Base {

    // Spend on the two entry types that consume an envelope. Shared WHERE fragment.
    const SPEND_TYPES = "e.type IN ('purchase', 'withdraw')";

    // GET /api/budgets/{b}/reports/by-month — total spend per month (LWC histogram).
    // Optional ?category= scopes to one envelope. Months as YYYY-MM-01 (LWC time).
    public function byMonth($vars) {
        $this->budget_for_action($vars['b'], Access::READ_FULL);
        $conds = 'e.budget_id = :b AND ' . self::SPEND_TYPES;
        $params = [':b' => (int) $vars['b']];
        $cat = $_GET['category'] ?? null;
        if($cat !== null && $cat !== '') {
            if(!is_numeric($cat)) {
                $this->json(['errors' => ['category' => ['Must be a category id.']]], 422);
            }
            $conds .= ' AND s.category_id = :cat';
            $params[':cat'] = (int) $cat;
        }
        $rows = $this->db->query(
            "SELECT DATE_FORMAT(e.entry_date, '%Y-%m-01') AS month, COALESCE(SUM(s.amount), 0.00) AS total
             FROM entries e JOIN entry_splits s ON s.entry_id = e.id
             WHERE $conds GROUP BY month ORDER BY month ASC",
            $params
        )->fetchAll(\PDO::FETCH_ASSOC);
        $this->json(['data' => array_map(function ($r) {
            return ['month' => $r['month'], 'total' => $r['total']];
        }, $rows)]);
    }

    // GET /api/budgets/{b}/reports/by-category?month=YYYY-MM — spend per envelope for one
    // month (the SVG bar breakdown). Defaults to the current month.
    public function byCategory($vars) {
        $this->budget_for_action($vars['b'], Access::READ_FULL);
        [$start, $end] = $this->month_range($_GET['month'] ?? date('Y-m'));
        $rows = $this->db->query(
            "SELECT s.category_id, c.name, COALESCE(SUM(s.amount), 0.00) AS total
             FROM entries e
               JOIN entry_splits s ON s.entry_id = e.id
               JOIN categories c ON c.id = s.category_id
             WHERE e.budget_id = :b AND " . self::SPEND_TYPES . " AND e.entry_date >= :start AND e.entry_date < :end
             GROUP BY s.category_id, c.name HAVING total <> 0 ORDER BY total DESC",
            [':b' => (int) $vars['b'], ':start' => $start, ':end' => $end]
        )->fetchAll(\PDO::FETCH_ASSOC);
        $this->json(['data' => array_map(function ($r) {
            return ['category_id' => (int) $r['category_id'], 'name' => $r['name'], 'total' => $r['total']];
        }, $rows)]);
    }

    // GET /api/budgets/{b}/reports/category-trend?category=&range= — daily spend for one
    // envelope over a range (30 / 90 / 180 / all). LWC line.
    public function categoryTrend($vars) {
        $this->budget_for_action($vars['b'], Access::READ_FULL);
        $cat = $_GET['category'] ?? null;
        if(!is_numeric($cat)) {
            $this->json(['errors' => ['category' => ['A category is required.']]], 422);
        }
        $conds = 'e.budget_id = :b AND s.category_id = :cat AND ' . self::SPEND_TYPES;
        $params = [':b' => (int) $vars['b'], ':cat' => (int) $cat];
        $range = $_GET['range'] ?? 'all';
        if($range !== 'all') {
            if(!in_array((string) $range, ['30', '90', '180'], true)) {
                $this->json(['errors' => ['range' => ['Must be 30, 90, 180, or all.']]], 422);
            }
            $conds .= ' AND e.entry_date >= :cutoff';
            $params[':cutoff'] = date('Y-m-d', strtotime('-' . (int) $range . ' days'));
        }
        $rows = $this->db->query(
            "SELECT e.entry_date AS date, COALESCE(SUM(s.amount), 0.00) AS total
             FROM entries e JOIN entry_splits s ON s.entry_id = e.id
             WHERE $conds GROUP BY e.entry_date ORDER BY e.entry_date ASC",
            $params
        )->fetchAll(\PDO::FETCH_ASSOC);
        $this->json(['data' => array_map(function ($r) {
            return ['date' => $r['date'], 'total' => $r['total']];
        }, $rows)]);
    }

    // First day of the given YYYY-MM and first day of the next month, or 422.
    private function month_range(string $month): array {
        if(!preg_match('/^\d{4}-(\d{2})$/', $month, $m) || (int) $m[1] < 1 || (int) $m[1] > 12) {
            $this->json(['errors' => ['month' => ['Must be a real YYYY-MM.']]], 422);
        }
        $start = $month . '-01';
        return [$start, date('Y-m-01', strtotime($start . ' +1 month'))];
    }
}
