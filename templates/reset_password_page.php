<?php $this->layout('app::basic'); ?>
<section class="hud-card hud-brackets mx-auto max-w-md p-6">
    <h1 class="mb-4 text-xl font-semibold">Set a new password</h1>
    <form action="/password-reset/<?= $this->e($uuid) ?>" method="POST">
        <?= $this->csrf_field() ?>
        <?= $this->insert('app::hud_field', ['id' => 'password', 'label' => 'Password', 'type' => 'password', 'autocomplete' => 'new-password']) ?>
        <?= $this->insert('app::hud_field', ['id' => 'password2', 'label' => 'Repeat password', 'type' => 'password', 'autocomplete' => 'new-password']) ?>
        <button type="submit" class="hud-actuator mt-2">Change password</button>
    </form>
</section>
