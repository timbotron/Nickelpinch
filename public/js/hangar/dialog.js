/**
 * Dialogs, alert dialogs, sheets and drawers on native <dialog>.
 * No framework, no dependency.
 *
 *   import { dialogs, openDialog, closeDialog } from "@valeness/hangar/dialog";
 *
 *   const stop = dialogs();   // wire every [data-hud-open] / [data-hud-close]
 *
 *   <button data-hud-open="#rename">Rename</button>
 *   <dialog class="hud-dialog hud-brackets" id="rename" aria-labelledby="rename-t">
 *     …
 *     <button data-hud-close>Cancel</button>
 *     <button data-hud-close="save">Save</button>
 *   </dialog>
 *
 *   // or programmatically — resolves with the value it closed with
 *   const value = await openDialog(dialogEl, { returnFocus: button });
 *   if (value === "save") …
 *
 * What the platform already does and this file leaves to it: showModal()
 * puts the dialog in the top layer and makes the rest of the page inert
 * (that is the focus trap), Escape closes it, and <form method="dialog">
 * closes it with the submit button's value.
 *
 * What this adds:
 *
 *   LIGHT DISMISS   a press that starts and ends on the backdrop closes
 *                   with "" — except on an alert dialog
 *                   (.hud-dialog--alert or role="alertdialog"), which
 *                   only closes from a button or Escape
 *   FOCUS RETURN    back to the opener (options.returnFocus, else whatever
 *                   was focused at open), even when that is not where the
 *                   platform would have put it
 *   SCROLL LOCK     the page stops scrolling while any modal is open; the
 *                   scrollbar gutter is kept so nothing shifts sideways
 *   EVENTS          hud-open (detail.opener) and hud-close (detail.value)
 *                   on the dialog, bubbling
 *   ALERT FOCUS     an alert dialog with no [autofocus] focuses its first
 *                   [data-hud-close=""] — the least destructive way out
 *   DRAWER DRAG     on .hud-drawer, drag the handle or header down to
 *                   dismiss; short drags spring back. Instant under
 *                   prefers-reduced-motion and data-hud="off"
 *
 * dialogs(root) also adopts a .hud-dialog opened some other way — a
 * command="show-modal" invoker, a direct showModal() — in browsers that
 * fire `toggle` on <dialog>, so it gets the same lock, dismiss and drag.
 *
 * A dialog removed from the document while open releases its lock. All
 * three functions are safe to import on a server; they do nothing there.
 *
 * In a framework the <dialog> is yours: keep it rendered and don't bind
 * its `open` attribute — showModal() owns it. Drive it from state in an
 * effect (open → openDialog(el), closed → closeDialog(el)) and store
 * `false` on hud-close. Both calls are idempotent — openDialog() on an
 * open dialog returns its pending promise — so a StrictMode double run
 * opens once. Don't close in the effect's cleanup: a dev double mount
 * would close and reopen it. They are the programmatic setters, and like
 * the native close event, hud-open / hud-close announce them too;
 * storing `false` again is a no-op, so this cannot loop. Unmounting an
 * open dialog is safe: the platform drops the inert page and the top
 * layer, this file releases the scroll lock and returns focus to the
 * opener if it is still in the document.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const GRIP = ".hud-drawer-handle, .hud-dialog-head";
const INTERACTIVE = "button, a[href], input, select, textarea, summary, label, [contenteditable], [tabindex]";

/* dialog → session, for every dialog currently open and managed. */
const live = new Map();

let locks = 0;
let saved = null;
let watcher = null;

const hasDom = () => typeof document !== "undefined";

function isAlert(dialog) {
  return dialog.classList.contains("hud-dialog--alert") || dialog.getAttribute("role") === "alertdialog";
}

function reduced(dialog) {
  return globalThis.matchMedia?.(REDUCED).matches || !!dialog.closest('[data-hud="off"]');
}

function outside(dialog, e) {
  const r = dialog.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}

/* Ref-counted, so a dialog opened from a dialog doesn't unlock early. */
function lockScroll() {
  if (locks++ > 0) return;
  const html = document.documentElement;
  const bar = globalThis.innerWidth - html.clientWidth;
  saved = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter };
  if (bar > 0) html.style.scrollbarGutter = "stable";
  html.style.overflow = "hidden";
}

function unlockScroll() {
  if (locks === 0 || --locks > 0) return;
  const html = document.documentElement;
  html.style.overflow = saved.overflow;
  html.style.scrollbarGutter = saved.gutter;
  saved = null;
}

/* A framework can unmount an open dialog without a close event ever
   firing. Watch the tree only while something is open. */
function watch() {
  if (watcher || typeof MutationObserver === "undefined") return;
  watcher = new MutationObserver(() => {
    for (const [dialog, session] of live) if (!dialog.isConnected) session.finish();
  });
  watcher.observe(document, { childList: true, subtree: true });
}

function unwatch() {
  if (live.size > 0 || !watcher) return;
  watcher.disconnect();
  watcher = null;
}

function initialFocus(dialog) {
  if (!isAlert(dialog) || dialog.querySelector("[autofocus]")) return;
  dialog.querySelector('[data-hud-close=""]')?.focus();
}

/* Animate the drawer's translate from one offset to another. Resolves at
   once when motion is off. */
function settle(dialog, from, to) {
  if (from === to || reduced(dialog) || typeof dialog.animate !== "function") return Promise.resolve();
  const anim = dialog.animate(
    { translate: [`0 ${from}px`, `0 ${to}px`] },
    { duration: 180, easing: to ? "cubic-bezier(0.4, 0, 1, 1)" : "cubic-bezier(0.16, 1, 0.3, 1)" },
  );
  return anim.finished.catch(() => {});
}

function drawerDrag(dialog, signal) {
  let drag = null;

  const onDown = (e) => {
    if (drag || e.button !== 0) return;
    const grip = e.target.closest?.(GRIP);
    if (!grip || grip.closest("dialog") !== dialog) return;
    const control = e.target.closest(INTERACTIVE);
    if (control && grip.contains(control)) return;
    e.preventDefault(); // no text selection, no focus change
    for (const a of dialog.getAnimations()) a.finish();
    drag = {
      id: e.pointerId,
      grip,
      y0: e.clientY,
      h: dialog.getBoundingClientRect().height,
      dy: 0,
      y: e.clientY,
      t: e.timeStamp,
      v: 0,
    };
    grip.setPointerCapture?.(e.pointerId);
    dialog.classList.add("is-dragging");
  };

  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dy = Math.max(0, e.clientY - drag.y0);
    drag.v = (e.clientY - drag.y) / Math.max(1, e.timeStamp - drag.t);
    drag.y = e.clientY;
    drag.t = e.timeStamp;
    dialog.style.translate = `0 ${drag.dy}px`;
  };

  const onEnd = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dy, h, v, grip } = drag;
    drag = null;
    if (grip.hasPointerCapture?.(e.pointerId)) grip.releasePointerCapture(e.pointerId);
    dialog.classList.remove("is-dragging");
    const dismiss = e.type === "pointerup" && (dy > Math.min(h * 0.35, 160) || (v > 0.6 && dy > 24));
    settle(dialog, dy, dismiss ? h : 0).then(() => {
      if (dismiss) closeDialog(dialog, "");
      dialog.style.translate = "";
    });
  };

  dialog.addEventListener("pointerdown", onDown, { signal });
  dialog.addEventListener("pointermove", onMove, { signal });
  dialog.addEventListener("pointerup", onEnd, { signal });
  dialog.addEventListener("pointercancel", onEnd, { signal });
  dialog.addEventListener("lostpointercapture", onEnd, { signal });
}

/* Take charge of an open modal dialog until it closes. */
function manage(dialog, opener) {
  const ac = new AbortController();
  const { signal } = ac;
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  let pressedBackdrop = false;

  const session = {
    promise,
    finish() {
      if (live.get(dialog) !== session) return;
      live.delete(dialog);
      ac.abort();
      unlockScroll();
      unwatch();
      dialog.classList.remove("is-dragging");
      dialog.style.translate = "";
      const value = dialog.returnValue;
      if (opener?.isConnected) opener.focus();
      dialog.dispatchEvent(new CustomEvent("hud-close", { bubbles: true, detail: { value } }));
      resolve(value);
    },
  };

  /* A press on the backdrop would otherwise blur whatever is focused in
     the dialog — which on an alert dialog, where it doesn't close, leaves
     focus on <body>. */
  dialog.addEventListener(
    "pointerdown",
    (e) => {
      pressedBackdrop = e.target === dialog && outside(dialog, e);
      if (pressedBackdrop) e.preventDefault();
    },
    { signal },
  );

  dialog.addEventListener(
    "click",
    (e) => {
      const fromBackdrop = pressedBackdrop;
      pressedBackdrop = false;
      if (e.defaultPrevented) return;
      const closer = e.target.closest?.("[data-hud-close]");
      if (closer && closer.closest("dialog") === dialog) {
        e.preventDefault();
        closeDialog(dialog, closer.getAttribute("data-hud-close"));
        return;
      }
      /* Both ends of the press on the backdrop: a text selection dragged
         out of the dialog must not close it. */
      if (e.target === dialog && fromBackdrop && outside(dialog, e) && !isAlert(dialog)) {
        closeDialog(dialog, "");
      }
    },
    { signal },
  );

  /* Queued, so it can arrive after the dialog was reopened — then it
     belongs to the previous opening and is ignored. */
  dialog.addEventListener("close", () => { if (!dialog.open) session.finish(); }, { signal });
  if (dialog.classList.contains("hud-drawer")) drawerDrag(dialog, signal);

  live.set(dialog, session);
  lockScroll();
  watch();
  initialFocus(dialog);
  dialog.dispatchEvent(new CustomEvent("hud-open", { bubbles: true, detail: { opener } }));
  return session;
}

/**
 * Open a dialog modally. Resolves with its returnValue once it closes:
 * "" for Escape, the backdrop, a drag or a bare [data-hud-close]; the
 * button's value for [data-hud-close="…"] or a <form method="dialog">
 * submit. Calling it on a dialog that is already open returns the
 * pending promise.
 *
 * @param {HTMLDialogElement} dialog
 * @param {{ returnFocus?: HTMLElement }} [options]
 * @returns {Promise<string>}
 */
export function openDialog(dialog, { returnFocus } = {}) {
  if (!hasDom()) return Promise.resolve("");
  if (!(dialog instanceof HTMLDialogElement)) {
    return Promise.reject(new TypeError("openDialog: expected a <dialog> element"));
  }
  /* The platform's close event is queued, so a dialog closed a moment ago
     can still hold a session. Settle it before reopening. */
  const pending = live.get(dialog);
  if (pending && dialog.open) return pending.promise;
  pending?.finish();

  /* Already open modally (opened natively, not yet adopted): whatever
     has focus now is inside it, so only an explicit returnFocus counts. */
  const opener = returnFocus ?? (dialog.open ? null : document.activeElement);
  if (!dialog.open) {
    dialog.returnValue = "";
    try {
      dialog.showModal();
    } catch (err) {
      return Promise.reject(err);
    }
  } else if (!dialog.matches(":modal")) {
    return Promise.reject(new DOMException("openDialog: the dialog is already open non-modally", "InvalidStateError"));
  }
  return manage(dialog, opener).promise;
}

/**
 * Close a dialog with a return value (default "").
 *
 * @param {HTMLDialogElement} dialog
 * @param {string} [value]
 */
export function closeDialog(dialog, value = "") {
  if (!hasDom() || !dialog?.open) return;
  dialog.close(String(value ?? ""));
  live.get(dialog)?.finish();
}

/**
 * Wire declarative triggers under `root`:
 *   [data-hud-open="#id"]   opens that dialog and returns focus to itself
 *   [data-hud-close]        closes its dialog with "" (or the attribute's
 *                           value, e.g. data-hud-close="save")
 * Returns a function that removes the wiring. Dialogs already open stay
 * managed until they close.
 *
 * @param {Document | Element | ShadowRoot} [root]
 * @returns {() => void}
 */
export function dialogs(root = globalThis.document) {
  if (!hasDom() || !root) return () => {};

  const onClick = (e) => {
    if (e.defaultPrevented) return;
    const trigger = e.target.closest?.("[data-hud-open]");
    if (!trigger || !root.contains(trigger)) return;
    const selector = trigger.getAttribute("data-hud-open");
    let target = null;
    try {
      target = trigger.getRootNode().querySelector?.(selector) ?? document.querySelector(selector);
    } catch {
      return; // not a valid selector
    }
    if (!(target instanceof HTMLDialogElement)) return;
    e.preventDefault();
    openDialog(target, { returnFocus: trigger });
  };

  /* A .hud-dialog opened natively (command="show-modal", showModal()). */
  const onToggle = (e) => {
    const dialog = e.target;
    if (e.newState !== "open" || !(dialog instanceof HTMLDialogElement)) return;
    if (!dialog.classList.contains("hud-dialog") || live.has(dialog) || !dialog.matches(":modal")) return;
    dialog.returnValue = "";
    manage(dialog, null);
  };

  root.addEventListener("click", onClick);
  root.addEventListener("toggle", onToggle, true);
  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("toggle", onToggle, true);
  };
}
