/**
 * replay() — play a one-shot microinteraction again. No framework, no
 * dependency.
 *
 *   import { replay } from "@valeness/hangar/motion";
 *
 *   value.textContent = next;
 *   replay(value, "hud-blip");
 *
 * A CSS animation starts when its class is newly applied, not because
 * the class is present, so a one-shot (hud-flash-in, hud-blip,
 * hud-scan-once, hud-acquire, hud-deny, hud-alert) will not play again on
 * an element that already has it. replay() removes the class, forces a
 * reflow so the browser sees the element without it, and adds it back.
 * The reflow is the step that is easy to drop; without it the two class
 * changes collapse into none and nothing plays. On an element without the
 * class it simply adds it, so the same call covers first play and replay.
 *
 * One class per call, and nothing returned: the one-shots share the
 * `animation` property, so an element runs one of them at a time
 * (hud-acquire, which rides on the selection classes, is the only one
 * paired with anything). Listen for `animationend` if you need to know
 * when it is over; under reduced motion or data-hud="off" there is no
 * animation and so no event.
 *
 * Does nothing for a null or undefined element, so
 * `replay(document.querySelector(…), …)` is safe, and touches no DOM at
 * import time, so it is safe to import under SSR.
 */

/**
 * @param {Element | null | undefined} el
 * @param {string} cls one class name, e.g. "hud-blip"
 * @returns {void}
 */
export function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  // Reading layout flushes style, so the removal is seen before the add.
  void el.getBoundingClientRect();
  el.classList.add(cls);
}
