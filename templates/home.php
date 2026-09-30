<?php $this->layout('app::basic'); ?>
<div class="grid gap-10 py-8 md:grid-cols-2 md:items-center">
    <div>
        <p class="hud-channel-tag mb-4 inline-block">Envelope budgeting · self-hosted</p>
        <h1 class="mb-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Know what every dollar is doing.</h1>
        <p class="mb-7 max-w-md text-lg text-muted">
            Split your money into envelopes, track spending against each, and see what's truly
            free. Open-source and free to use.
        </p>
        <div class="flex flex-wrap items-center gap-3">
            <a class="hud-actuator" href="<?= SITE_URL ?>login">Open Nickelpinch →</a>
            <a class="hud-actuator hud-actuator--ghost" href="https://nickelpinch.com">It's open source</a>
        </div>
    </div>
    <section class="hud-card hud-brackets--diag p-5">
        <div class="hud-progress-readout">
            <span class="hud-progress-label">Groceries</span>
            <span class="hud-progress-value" aria-hidden="true">$60 / $820</span>
            <progress class="hud-progress w-full" value="7" max="100" aria-label="Groceries: $60 of $820 spent">7%</progress>
        </div>
        <p class="hud-readout mt-3 text-xs"><span class="lbl">↑ A GAUGE PER ENVELOPE</span></p>
    </section>
</div>
