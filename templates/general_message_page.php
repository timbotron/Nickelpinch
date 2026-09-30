<?php $this->layout('app::basic'); ?>
<section class="hud-card hud-brackets mx-auto max-w-md p-6">
    <h1 class="mb-3 text-xl font-semibold"><?= $this->e($top_title) ?></h1>
    <div class="text-sm text-fg"><?= $page_message ?></div>
    <?php if($is_error): ?>
        <p class="mt-3 text-sm text-muted">Please contact support if desired.</p>
        <a href="mailto:<?= $this->e(EMAIL_SUPPORT_ADDRESS) ?>" class="hud-actuator hud-actuator--ghost mt-3">Email support</a>
    <?php endif; ?>
</section>
