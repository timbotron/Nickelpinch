-- Optional dev/demo seed — NOT part of migrations. Apply it by hand into a running
-- stack:
--
--     docker compose --profile seed run --rm seed
--
-- (or: docker compose exec -T db mysql -unickelpinch -pnickelpinch nickelpinch < db/seed-dev.sql)
--
-- It is never mounted into /docker-entrypoint-initdb.d, so a fresh volume and any
-- production init stay clean. Safe to re-run: it first deletes the two demo users,
-- whose FKs cascade away all their budgets/accounts/categories/entries/shares.
--
-- Demo login: demo@nickelpinch.test / demo1234  (partner@nickelpinch.test / demo1234)
-- Balances are illustrative — set directly, not derived from the sample entries.

DELETE FROM users WHERE email IN ('demo@nickelpinch.test', 'partner@nickelpinch.test');

-- password hash is bcrypt of 'demo1234'
INSERT INTO users (id, email, password, is_active, created_at) VALUES
  (1, 'demo@nickelpinch.test',    '$2y$10$4rKWhAVmXIYzc00T32ted.XpZeEIW4A/y3wRXl7wwtwLcbONXH3Bm', 1, CURDATE()),
  (2, 'partner@nickelpinch.test', '$2y$10$4rKWhAVmXIYzc00T32ted.XpZeEIW4A/y3wRXl7wwtwLcbONXH3Bm', 1, CURDATE());

-- demo owns Household + Freelance; is a member of partner's Shared House. So the
-- switcher shows three budgets, one tagged "(member)".
INSERT INTO budgets (id, owner_user_id, name, base_currency) VALUES
  (1, 1, 'Household',    'USD'),
  (2, 1, 'Freelance',    'USD'),
  (3, 2, 'Shared House', 'USD');

INSERT INTO budget_members (budget_id, user_id, role) VALUES (3, 1, 'member');

INSERT INTO accounts (id, budget_id, name, type, balance, credit_limit, due_date) VALUES
  (1, 1, 'Checking',          'bank',        2500.00, NULL,    NULL),
  (2, 1, 'Savings',           'bank',        8000.00, NULL,    NULL),
  (3, 1, 'Visa',              'credit_card',  340.00, 3000.00, 15),
  (4, 2, 'Business Checking', 'bank',        1200.00, NULL,    NULL),
  (5, 3, 'Joint Checking',    'bank',         900.00, NULL,    NULL);

-- Vacation is savings pinned to the Savings bank (acct 2 — counts toward Extra);
-- Emergency is savings held outside tracked accounts (account_id NULL — excluded
-- from Extra, the old "external savings"). Exercises both sides.
INSERT INTO categories (id, budget_id, name, type, monthly_limit, spent, saved, rollover_rule, account_id, `rank`) VALUES
  (1, 1, 'Groceries', 'standard', 600.00, 450.00,   40.00, 'accumulate', NULL, 0),
  (2, 1, 'Dining',    'standard', 200.00, 175.00,    0.00, 'reset',      NULL, 1),
  (3, 1, 'Transport', 'standard', 150.00,  60.00,   10.00, 'accumulate', NULL, 2),
  (4, 1, 'Vacation',  'savings',  300.00,   0.00, 1200.00, 'accumulate', 2,    3),
  (5, 1, 'Emergency', 'savings',    0.00,   0.00, 5000.00, 'accumulate', NULL, 4),
  (6, 2, 'Software',  'standard', 100.00,  45.00,    0.00, 'accumulate', NULL, 0),
  (7, 3, 'Utilities', 'standard', 250.00, 120.00,    0.00, 'accumulate', NULL, 0);

-- A "Bills" display group (CODE-348) in Household with a few fixed monthly bills.
-- Rent + Internet are paid (spent = limit → 0 left); Car insurance is unpaid, so the
-- collapsed group header rolls up to $140.00 still to pay. The group must exist before
-- the categories that point at it (categories.group_id FK).
INSERT INTO category_groups (id, budget_id, name, `rank`) VALUES
  (1, 1, 'Bills', 0);

INSERT INTO categories (id, budget_id, name, type, monthly_limit, spent, saved, rollover_rule, account_id, group_id, `rank`) VALUES
  (8,  1, 'Rent',          'standard', 1800.00, 1800.00, 0.00, 'reset', NULL, 1, 5),
  (9,  1, 'Car insurance', 'standard',  140.00,    0.00, 0.00, 'reset', NULL, 1, 6),
  (10, 1, 'Internet',      'standard',   70.00,   70.00, 0.00, 'reset', NULL, 1, 7);

-- A little history for Household (shape matches EntryService: purchase splits are
-- positive with from_saved = 0; a deposit has no splits).
INSERT INTO entries (id, budget_id, created_by, type, entry_date, total_amount, description, account_id, to_account_id) VALUES
  (1, 1, 1, 'deposit',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), 2000.00, 'Paycheck',    1,    NULL),
  (2, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 4 DAY),   85.00, 'Costco',      1,    NULL),
  (3, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 2 DAY),   40.00, 'Thai place',  3,    NULL),
  (4, 1, 1, 'purchase', CURDATE(),                             60.00, 'Gas',         1,    NULL);

INSERT INTO entry_splits (entry_id, category_id, amount, from_saved) VALUES
  (2, 1, 85.00, 0),
  (3, 2, 40.00, 0),
  (4, 3, 60.00, 0);

-- A rich set of Groceries (category 1) purchases spread across ~3 months, so the
-- reports have something to chart: a daily trend for Groceries, several months in the
-- per-month histogram, and a meaningful envelope breakdown. Dates are relative to
-- seed time (DATE_SUB from today). All from Checking (account 1).
INSERT INTO entries (id, budget_id, created_by, type, entry_date, total_amount, description, account_id, to_account_id) VALUES
  (5,  1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 1 DAY),  44.20, 'Trader Joe''s',  1, NULL),
  (6,  1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 3 DAY),  18.75, 'Corner market',  1, NULL),
  (7,  1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 6 DAY),  62.10, 'Safeway',        1, NULL),
  (8,  1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 9 DAY),  27.50, 'Farmers market', 1, NULL),
  (9,  1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 12 DAY), 88.30, 'Costco',         1, NULL),
  (10, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 15 DAY), 15.40, 'Corner market',  1, NULL),
  (11, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 18 DAY), 53.90, 'Whole Foods',    1, NULL),
  (12, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 21 DAY), 34.60, 'Trader Joe''s',  1, NULL),
  (13, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 24 DAY), 71.25, 'Safeway',        1, NULL),
  (14, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 27 DAY), 22.15, 'Farmers market', 1, NULL),
  (15, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 33 DAY), 49.99, 'Whole Foods',    1, NULL),
  (16, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 39 DAY), 66.40, 'Costco',         1, NULL),
  (17, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 45 DAY), 28.80, 'Trader Joe''s',  1, NULL),
  (18, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 51 DAY), 57.30, 'Safeway',        1, NULL),
  (19, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 57 DAY), 41.10, 'Whole Foods',    1, NULL),
  (20, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 64 DAY), 38.25, 'Corner market',  1, NULL),
  (21, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 73 DAY), 59.60, 'Costco',         1, NULL),
  (22, 1, 1, 'purchase', DATE_SUB(CURDATE(), INTERVAL 85 DAY), 45.00, 'Safeway',        1, NULL);

INSERT INTO entry_splits (entry_id, category_id, amount, from_saved) VALUES
  (5, 1, 44.20, 0), (6, 1, 18.75, 0), (7, 1, 62.10, 0), (8, 1, 27.50, 0), (9, 1, 88.30, 0),
  (10, 1, 15.40, 0), (11, 1, 53.90, 0), (12, 1, 34.60, 0), (13, 1, 71.25, 0), (14, 1, 22.15, 0),
  (15, 1, 49.99, 0), (16, 1, 66.40, 0), (17, 1, 28.80, 0), (18, 1, 57.30, 0), (19, 1, 41.10, 0),
  (20, 1, 38.25, 0), (21, 1, 59.60, 0), (22, 1, 45.00, 0);
