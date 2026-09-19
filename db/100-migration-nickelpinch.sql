-- Nickelpinch app tables (CODE-200). Runs after core migrations (001-004, which
-- ship `users` / `login_attempts` / `settings`) in filename order — it never
-- recreates `users`. Money is DECIMAL(22,2). One currency per budget.
--
-- Data model: doc/REWRITE_PLAN.md §5. A budget is the multi-tenant boundary; a
-- user may own one budget and belong to others. Accounts (bank / credit card) are
-- first-class, separate from spending/savings categories (envelopes).

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";
SET NAMES utf8mb4;

-- --------------------------------------------------------
-- budgets: the tenant boundary + unit of sharing. One canonical owner; one
-- currency shared by all its accounts and categories.
-- --------------------------------------------------------
CREATE TABLE `budgets` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `owner_user_id` int UNSIGNED NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'My Budget',
  `base_currency` varchar(3) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'USD',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `budgets_owner_idx` (`owner_user_id`),
  CONSTRAINT `fk_budgets_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- accounts: bank accounts and credit cards. `balance` = real dollars (bank) or
-- amount owed (credit card); credit_limit + due_date apply to cards only.
-- --------------------------------------------------------
CREATE TABLE `accounts` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `budget_id` int UNSIGNED NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `type` enum('bank','credit_card') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'bank',
  `balance` decimal(22,2) NOT NULL DEFAULT 0.00,
  `credit_limit` decimal(22,2) DEFAULT NULL,
  `due_date` tinyint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `accounts_budget_idx` (`budget_id`),
  CONSTRAINT `fk_accounts_budget` FOREIGN KEY (`budget_id`) REFERENCES `budgets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- categories: spending/savings envelopes. `spent` = consumed this period,
-- `monthly_limit` = budget/goal, `saved` = rollover. rollover_rule decides what
-- the monthly reset does with the remainder. `account_id` (savings only) pins the
-- envelope to the bank account holding it: set = in that tracked bank, NULL = held
-- outside tracked accounts (what "external savings" used to mean). The Extra rollup
-- counts a savings envelope only when it is pinned to an account.
-- --------------------------------------------------------
CREATE TABLE `categories` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `budget_id` int UNSIGNED NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `type` enum('standard','savings','archived') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'standard',
  `monthly_limit` decimal(22,2) NOT NULL DEFAULT 0.00,
  `spent` decimal(22,2) NOT NULL DEFAULT 0.00,
  `saved` decimal(22,2) NOT NULL DEFAULT 0.00,
  `rollover_rule` enum('accumulate','reset') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'accumulate',
  `account_id` int UNSIGNED DEFAULT NULL,
  `rank` int NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `categories_budget_rank_idx` (`budget_id`, `rank`),
  KEY `categories_account_idx` (`account_id`),
  CONSTRAINT `fk_categories_budget` FOREIGN KEY (`budget_id`) REFERENCES `budgets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_categories_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- entries: a transaction. `type` decides its meaning; `account_id` is the bank/
-- card the money moved to/from; `to_account_id` is the transfer destination.
-- `created_by` stamps who logged it (attribution in shared budgets).
-- --------------------------------------------------------
CREATE TABLE `entries` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `budget_id` int UNSIGNED NOT NULL,
  `created_by` int UNSIGNED DEFAULT NULL,
  `type` enum('purchase','move','paycc','deposit','withdraw','transfer','reset') COLLATE utf8mb4_general_ci NOT NULL,
  `entry_date` date NOT NULL,
  `total_amount` decimal(22,2) NOT NULL DEFAULT 0.00,
  `description` varchar(255) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `account_id` int UNSIGNED DEFAULT NULL,
  `to_account_id` int UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `entries_budget_date_idx` (`budget_id`, `entry_date`),
  KEY `entries_account_idx` (`account_id`),
  CONSTRAINT `fk_entries_budget` FOREIGN KEY (`budget_id`) REFERENCES `budgets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_entries_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_entries_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_entries_to_account` FOREIGN KEY (`to_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- entry_splits: the "from" side of an entry — 1..5 category portions summing to
-- the entry total (enforced in the app). from_saved marks a portion drawn from a
-- category's savings rather than its balance.
-- --------------------------------------------------------
CREATE TABLE `entry_splits` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `entry_id` int UNSIGNED NOT NULL,
  `category_id` int UNSIGNED NOT NULL,
  `amount` decimal(22,2) NOT NULL DEFAULT 0.00,
  `from_saved` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `entry_splits_entry_idx` (`entry_id`),
  KEY `entry_splits_category_idx` (`category_id`),
  CONSTRAINT `fk_splits_entry` FOREIGN KEY (`entry_id`) REFERENCES `entries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_splits_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- budget_members: shared full-access members of a budget. The owner is canonical
-- on budgets.owner_user_id; these are additional members (role 'member' = full
-- money ops, no member-management / no delete).
-- --------------------------------------------------------
CREATE TABLE `budget_members` (
  `budget_id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `role` enum('owner','member') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'member',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`budget_id`, `user_id`),
  KEY `budget_members_user_idx` (`user_id`),
  CONSTRAINT `fk_members_budget` FOREIGN KEY (`budget_id`) REFERENCES `budgets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- category_shares: per-category view-only grants (e.g. share "Kid1" to a child).
-- --------------------------------------------------------
CREATE TABLE `category_shares` (
  `category_id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `capability` enum('view') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'view',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`category_id`, `user_id`),
  KEY `category_shares_user_idx` (`user_id`),
  CONSTRAINT `fk_shares_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_shares_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- user_profiles: per-user app preferences (not budget-scoped). Keeps core's
-- `users` table untouched. default_account_id is the pre-selected "paid via".
-- --------------------------------------------------------
CREATE TABLE `user_profiles` (
  `user_id` int UNSIGNED NOT NULL,
  `theme` varchar(10) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'dark',
  `default_view` enum('simple','detailed') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'simple',
  `default_account_id` int UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_profiles_account` FOREIGN KEY (`default_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
