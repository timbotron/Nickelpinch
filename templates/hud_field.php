<?php
// A Hangar form field for the server-rendered forms (CODE-391): label + bracketed
// input. Hangar derives the "● REQ" mark on the label from the input's `required`.
// Params: id, label, type; optional name (defaults to id), value, autocomplete.
?>
<div class="hud-form-field mb-3">
    <label class="hud-label" for="<?= $this->e($id) ?>"><?= $this->e($label) ?></label>
    <div class="hud-field hud-brackets">
        <input class="hud-input" type="<?= $this->e($type) ?>" id="<?= $this->e($id) ?>" name="<?= $this->e($name ?? $id) ?>" value="<?= $this->e($value ?? '') ?>"<?= isset($autocomplete) ? ' autocomplete="' . $this->e($autocomplete) . '"' : '' ?> required>
    </div>
</div>
