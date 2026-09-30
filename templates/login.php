<?php $this->layout('app::basic'); ?>
<section class="hud-card hud-brackets mx-auto max-w-md p-6">
    <h1 class="mb-4 text-xl font-semibold">Log in</h1>
    <form action="/login" method="POST">
        <?= $this->csrf_field() ?>
        <?= $this->insert('app::hud_field', ['id' => 'email', 'label' => 'Email', 'type' => 'email', 'value' => $post_content['email'] ?? '', 'autocomplete' => 'email']) ?>
        <?= $this->insert('app::hud_field', ['id' => 'password', 'label' => 'Password', 'type' => 'password', 'autocomplete' => 'current-password']) ?>
        <button type="submit" class="hud-actuator mt-2">Log in</button>
    </form>
    <div class="mt-5 flex justify-between text-sm">
        <a class="text-accent hover:underline" href="<?= SITE_URL ?>password-forgot">Forgot password?</a>
        <?php if($allow_signups ?? false): ?>
            <a class="text-accent hover:underline" href="<?= SITE_URL ?>create-account">Create account</a>
        <?php endif; ?>
    </div>
</section>
