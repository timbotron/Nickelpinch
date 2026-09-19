<?php $this->layout('app::basic'); ?>
<div class="grid gap-10 py-8 md:grid-cols-2 md:items-center">
    <div>
        <p class="eyebrow">Envelope budgeting · self-hosted</p>
        <h1 class="mb-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Know what every dollar is doing.</h1>
        <p class="mb-7 max-w-md text-lg text-muted">
            Split your money into envelopes, track spending against each, and see what's truly
            free. Open-source and free to use.
        </p>
        <div class="flex flex-wrap items-center gap-3">
            <a class="btn" href="<?= SITE_URL ?>login">Open Nickelpinch →</a>
            <a class="btn-outline" href="https://nickelpinch.com">It's open source</a>
        </div>
    </div>
    <div class="card">
        <div class="mb-3 flex items-center justify-between">
            <span class="font-semibold">Groceries</span>
            <span class="mono text-sm text-muted">$60 / $820</span>
        </div>
        <div class="health"><span class="health-fill" style="width:7%"></span></div>
        <p class="mono mt-3 text-xs text-muted">↑ a thin health bar per envelope</p>
    </div>
</div>
