<?php $this->layout('app::basic'); ?>
<section class="hud-card hud-brackets mx-auto max-w-md p-6">
    <h1 class="mb-2 text-xl font-semibold">Create your account</h1>
    <p class="mb-4 text-sm text-muted">Enter your email and we'll send a link to set your password.</p>
    <form action="/create-account" method="POST">
        <?= $this->csrf_field() ?>
        <?= $this->insert('app::hud_field', ['id' => 'email', 'label' => 'Email', 'type' => 'email', 'value' => $post_content['email'] ?? '', 'autocomplete' => 'email']) ?>
        <?= $this->insert('app::hud_field', ['id' => 'email2', 'label' => 'Repeat email', 'type' => 'email', 'value' => $post_content['email2'] ?? '', 'autocomplete' => 'email']) ?>
        <button type="submit" class="hud-actuator mt-2">Create account</button>
    </form>
    <div class="mt-5 text-sm">
        <a class="text-accent hover:underline" href="<?= SITE_URL ?>login">Back to login</a>
    </div>
</section>
