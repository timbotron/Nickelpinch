<!DOCTYPE html>
<html lang="en"<?php if($is_logged_in ?? false): ?> data-theme="<?= $this->e($user_theme ?? 'dark') ?>" data-auth="1"<?php endif; ?>>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title><?= $this->e($page_title ?? SITE_NAME) ?></title>
    <?php if($is_logged_in ?? false): ?>
    <meta name="csrf-token" content="<?= $this->e(\Initium\Csrf::token()) ?>">
    <?php endif; ?>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/app.css">
    <script>
      // Pre-paint: honor a logged-in stamp, else the viewer's saved choice. Dark is
      // the default look (the stylesheet's :root is dark; light needs data-theme="light").
      (function () {
        var el = document.documentElement
        if (el.getAttribute('data-auth')) return
        try { var t = localStorage.getItem('np-theme'); if (t) el.setAttribute('data-theme', t) } catch (e) {}
      })()
    </script>
</head>
<body class="min-h-screen bg-app text-fg antialiased">
    <nav class="border-b border-line">
        <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
            <?php // Logged in, the brand jumps to the overview; logged out, the landing page. ?>
            <a class="brand" href="<?= ($is_logged_in ?? false) ? SITE_URL . 'home' : SITE_URL ?>"><span class="dot"></span><?= $this->e(SITE_NAME) ?></a>
            <div class="ml-auto flex items-center gap-3">
                <button id="theme-toggle" class="options-btn" title="Toggle light / dark" aria-label="Toggle theme">◐</button>
                <?php if($is_logged_in ?? false): ?>
                    <button id="nav-toggle" class="options-btn sm:hidden" aria-label="Menu" aria-expanded="false" aria-controls="nav-menu">☰</button>
                <?php endif; ?>
                <?php if(!($is_logged_in ?? false)): ?>
                    <a href="<?= SITE_URL ?>login">Login</a>
                <?php endif; ?>
            </div>
            <?php if($is_logged_in ?? false): ?>
            <?php // Inline on sm+, a collapsible full-width panel below the bar on mobile. ?>
            <div id="nav-menu" class="hidden w-full pb-2 sm:flex sm:w-auto sm:items-center sm:gap-4 sm:pb-0">
                <div id="budget-switcher" class="mb-3 sm:mb-0"></div>
                <?php // Mobile: a 2-column grid of tappable link cells. Desktop: inline row. ?>
                <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-center sm:gap-4">
                    <a class="navlink" href="<?= SITE_URL ?>home">Overview</a>
                    <a class="navlink" href="<?= SITE_URL ?>entry">Add</a>
                    <a class="navlink" href="<?= SITE_URL ?>history">History</a>
                    <a class="navlink" href="<?= SITE_URL ?>reports">Reports</a>
                    <a class="navlink" href="<?= SITE_URL ?>manage">Manage</a>
                    <a class="navlink" href="<?= SITE_URL ?>settings">Settings</a>
                    <a class="navlink" href="<?= SITE_URL ?>logout">Logout</a>
                </div>
            </div>
            <?php endif; ?>
        </div>
    </nav>

    <?php if(isset($messages) && is_array($messages) && count($messages) > 0): ?>
    <div class="mx-auto mt-4 max-w-5xl space-y-2 px-4">
        <?php foreach($messages as $m): ?>
            <div class="rounded px-3 py-2 text-sm <?= $m['type'] == 'error' ? 'bg-red-500/15 text-red-300' : 'bg-accent-soft text-accent' ?>">
                <?= $this->e($m['value']) ?>
            </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <main class="mx-auto max-w-5xl px-4 py-6">
        <?= $this->section('content') ?>
    </main>

    <?php if($is_logged_in ?? false): ?>
    <script>window.__NP__ = <?= json_encode(['active_budget_id' => $active_budget_id ?? null], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;</script>
    <?php endif; ?>
    <script src="/js/mithril.min.js"></script>
    <script src="/js/app.js"></script>
    <?= $this->section('scripts') ?>
</body>
</html>
