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
    <?php // Layer order first: Tailwind preflight (np-base) sits under Hangar (CODE-383). ?>
    <style>@layer np-base, hangar;</style>
    <link rel="stylesheet" href="/css/hangar.min.css">
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
    <?php
    // Primary nav (CODE-385), rendered twice from one list: a Hangar navmenu bar on sm+
    // and the mobile accordion's 2-column grid of ghost actuators. The current page is
    // marked aria-current, which Hangar lights; Logout is an action, never "current".
    $nav = [['home', 'Overview'], ['entry', 'Add'], ['history', 'History'], ['reports', 'Reports'], ['manage', 'Manage'], ['settings', 'Settings']];
    $here = trim((string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
    ?>
    <header class="hud-hairline border-b border-line">
        <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
            <?php // Logged in, the brand jumps to the overview; logged out, the landing page. ?>
            <a class="brand" href="<?= ($is_logged_in ?? false) ? SITE_URL . 'home' : SITE_URL ?>"><span class="dot"></span><?= $this->e(SITE_NAME) ?></a>
            <div class="ml-auto flex items-center gap-2 sm:order-last">
                <button id="theme-toggle" class="hud-actuator hud-actuator--ghost hud-actuator--icon hud-actuator--sm" type="button" title="Toggle light / dark" aria-label="Toggle theme">◐</button>
                <?php if($is_logged_in ?? false): ?>
                    <button id="nav-toggle" class="hud-actuator hud-actuator--ghost hud-actuator--icon hud-actuator--sm sm:hidden" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav-menu">☰</button>
                <?php else: ?>
                    <a class="hud-actuator hud-actuator--ghost hud-actuator--sm" href="<?= SITE_URL ?>login">Login</a>
                <?php endif; ?>
            </div>
            <?php if($is_logged_in ?? false): ?>
            <?php // Inline on sm+, a collapsible full-width panel below the bar on mobile. ?>
            <div id="nav-menu" class="hidden w-full pb-2 sm:flex sm:w-auto sm:items-center sm:gap-4 sm:pb-0">
                <div id="budget-switcher" class="mb-3 w-full sm:mb-0 sm:w-56"></div>
                <div class="hidden sm:block">
                    <nav class="hud-navmenu" aria-label="Main">
                        <ul class="hud-navmenu-list">
                            <?php foreach($nav as [$path, $label]): ?>
                                <li><a class="hud-navmenu-link" href="<?= SITE_URL . $path ?>"<?= $here === $path ? ' aria-current="page"' : '' ?>><?= $label ?></a></li>
                            <?php endforeach; ?>
                            <li><a class="hud-navmenu-link" href="<?= SITE_URL ?>logout">Logout</a></li>
                        </ul>
                    </nav>
                </div>
                <nav class="grid grid-cols-2 gap-2 sm:hidden" aria-label="Main">
                    <?php foreach($nav as [$path, $label]): ?>
                        <?php // Hangar doesn't style actuators by aria-current, so the current page is the filled one. ?>
                        <a class="hud-actuator<?= $here === $path ? '' : ' hud-actuator--ghost' ?> justify-center" href="<?= SITE_URL . $path ?>"<?= $here === $path ? ' aria-current="page"' : '' ?>><?= $label ?></a>
                    <?php endforeach; ?>
                    <a class="hud-actuator hud-actuator--ghost justify-center" href="<?= SITE_URL ?>logout">Logout</a>
                </nav>
            </div>
            <?php endif; ?>
        </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-6">
        <?= $this->section('content') ?>
    </main>

    <?php if($is_logged_in ?? false): ?>
    <script>window.__NP__ = <?= json_encode(['active_budget_id' => $active_budget_id ?? null], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;</script>
    <?php endif; ?>
    <?php // Server flash messages become Hangar toasts (app.js, CODE-392). ?>
    <script>window.__NP_FLASH__ = <?= json_encode(array_map(function ($m) {
        return ['text' => (string) $m['value'], 'tone' => $m['type'] == 'error' ? 'error' : 'ok'];
    }, isset($messages) && is_array($messages) ? $messages : []), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;</script>
    <script src="/js/mithril.min.js"></script>
    <script src="/js/app.js"></script>
    <?= $this->section('scripts') ?>
</body>
</html>
