<?php $this->layout('app::basic'); ?>
<section class="hud-card hud-brackets mx-auto max-w-md p-6">
    <h1 class="mb-2 text-xl font-semibold">Forgot password?</h1>
    <p class="mb-4 text-sm text-muted">Enter your email. If it matches an account, we'll send a reset link.</p>
    <form action="/password-forgot" method="POST">
        <?= $this->csrf_field() ?>
        <?= $this->insert('app::hud_field', ['id' => 'email', 'label' => 'Email', 'type' => 'email', 'value' => $post_content['email'] ?? '', 'autocomplete' => 'email']) ?>
        <button type="submit" class="hud-actuator mt-2">Send reset link</button>
    </form>
    <div class="mt-5 text-sm">
        <a class="text-accent hover:underline" href="<?= SITE_URL ?>login">Back to login</a>
    </div>
</section>
