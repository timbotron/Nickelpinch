/**
 * popover(), tooltip(), hoverCard() — the anchored overlays. No
 * framework, no dependency beyond anchor().
 *
 *   import { popover, tooltip, hoverCard } from "@valeness/hangar/popover";
 *
 *   // <button popovertarget="filters">Filters</button>
 *   // <div id="filters" popover class="hud-popover hud-brackets">…</div>
 *   const stop = popover(button, { side: "bottom", align: "start" });
 *
 *   const untip = tooltip(rescan, "Re-scan targets", { side: "top" });
 *   const uncard = hoverCard(link, card, { openDelay: 700, closeDelay: 300 });
 *
 * All three put the floating element in the top layer (the popover
 * attribute) and hold it beside its trigger with anchor(), which flips
 * it to the side with room and writes the side it used to data-side.
 * They also write --hud-aim on the floating element: the distance,
 * along the edge that faces the trigger, to the trigger's centre — the
 * point the leader (.hud-popover-arrow, the tooltip's ::after) is drawn
 * at, so it keeps pointing at the trigger after a flip or a clamp.
 *
 * POPOVER — opening, closing, Esc and light dismiss stay native
 * (button[popovertarget]). popover() only positions the panel while it
 * is open, releases it on close, and mirrors the state to aria-expanded
 * on the trigger. A panel holding a form is a non-modal dialog: give it
 * role="dialog" and aria-labelledby in your markup.
 *
 *   side    "top" | "bottom" | "left" | "right"   default "bottom"
 *   align   "start" | "center" | "end"            default "start"
 *   offset  gap to the trigger, px                default 6
 *
 * TOOLTIP — WAI-ARIA tooltip pattern, and WCAG 1.4.13:
 *   shows    on hover after `delay` (default 500ms); immediately if
 *            another tooltip was showing in the last 300ms, so a
 *            toolbar can be swept; immediately on keyboard focus
 *   hides    when both pointer and focus have left, on pointerdown on
 *            the trigger, and on Esc — without moving focus
 *   hoverable  the pointer can cross onto the tooltip and stay there
 *   persistent no timeout
 * `content` is a string (a .hud-tooltip is made and inserted after the
 * trigger, and removed again on destroy) or your own element. The
 * trigger gets the tooltip's id in aria-describedby. A :disabled
 * trigger never shows one — it cannot take focus, so a keyboard user
 * could never reach it. Use aria-disabled, or wrap it (see GUIDE.md).
 *
 *   side    default "top";  align default "center";  offset default 6
 *   delay   hover delay, ms                       default 500
 *   parent  where a made tooltip goes: appended to this element instead
 *           of inserted after the trigger. In a framework component, and
 *           in a group whose CSS counts children (.hud-actuator-group's
 *           :last-child), pass document.body (or render the element
 *           yourself and pass it as `content`), so no node of ours lands
 *           among the trigger's siblings. It is in the top layer either
 *           way; only inherited custom properties (a --hud-channel on an
 *           ancestor) and dir follow the DOM.
 *
 * HOVER CARD — a preview of what a link points at, for sighted pointer
 * and keyboard users. Opens after `openDelay` (default 700ms) of hover
 * or of keyboard focus, stays open while the pointer is over the
 * trigger or the card or focus is inside either, closes `closeDelay`
 * (default 300ms) after both are left, and on Esc. It adds no ARIA: the
 * card is supplementary, never the only route to what it shows. Place
 * the card straight after the trigger in the DOM, so Tab from the
 * trigger walks into it while it is open.
 *
 *   side  default "bottom";  align default "start";  offset default 6
 *
 * Every function returns a destroy function, which first closes the
 * floating element if this call has it open (so it never drops back to
 * the middle of the screen). State changes are the platform's own
 * beforetoggle / toggle events on the floating element — listen there to
 * lazy-load a card or log a tooltip.
 *
 * In a framework the trigger and the floating element are yours: these
 * functions listen, and write only aria-expanded (popover) or an id in
 * aria-describedby (tooltip) on the trigger, popover="manual" where it
 * is missing, and inline position styles on the floating element.
 * Content you re-render while it is open is re-measured and re-placed.
 * Call them in the effect of the component that renders both elements
 * and destroy there: the browser closes a popover that is unmounted
 * while open, and destroy() drops the tracking. Each reads its elements
 * once, so run it again if the framework replaces one. If you render
 * aria-describedby on a trigger yourself, include the tooltip's id in
 * it. A string tooltip is fixed text; for text that changes, render the
 * .hud-tooltip element yourself and pass it.
 */

import { anchor } from "./anchor.js";

/* A tooltip opened within this long of another closing skips its delay. */
const SKIP_WINDOW = 300;
/* Time the pointer has to cross the gap from trigger to tooltip. */
const GRACE = 120;

let seq = 0;
const uid = (prefix) => `${prefix}-${(++seq).toString(36)}`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

const isOpen = (el) => el.matches(":popover-open");

/* anchor(), plus --hud-aim for the leader. The listeners are added after
   anchor()'s own, so each animation frame places first, then aims. The
   release puts both custom properties back as they were, as anchor()
   does with what it wrote. */
function follow(floating, reference, options) {
  const kept = ["--hud-anchor-offset", "--hud-aim"].map((p) => [p, floating.style.getPropertyValue(p)]);
  const release = anchor(floating, reference, options);
  let frame = 0;

  const aim = () => {
    frame = 0;
    const r = reference.getBoundingClientRect();
    const f = floating.getBoundingClientRect();
    const side = floating.dataset.side;
    let at;
    if (side === "left" || side === "right") {
      at = clamp(r.top + r.height / 2 - f.top, 8, f.height - 8);
    } else {
      const cx = r.left + r.width / 2;
      const rtl = getComputedStyle(floating).direction === "rtl";
      at = clamp(rtl ? f.right - cx : cx - f.left, 8, f.width - 8);
    }
    floating.style.setProperty("--hud-aim", `${Math.round(at)}px`);
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(aim);
  };

  floating.style.setProperty("--hud-anchor-offset", `${options.offset ?? 6}px`);
  aim();
  window.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
  observer?.observe(floating);
  observer?.observe(reference);

  return () => {
    release();
    cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule, { capture: true });
    window.removeEventListener("resize", schedule);
    observer?.disconnect();
    for (const [p, v] of kept) {
      if (v) floating.style.setProperty(p, v);
      else floating.style.removeProperty(p);
    }
  };
}

/* Add or remove one id in a space-separated IDREF list. */
function refs(el, attr, id, add) {
  const list = (el.getAttribute(attr) ?? "").split(/\s+/).filter((t) => t && t !== id);
  if (add) list.push(id);
  if (list.length) el.setAttribute(attr, list.join(" "));
  else el.removeAttribute(attr);
}

/* ---------------------------------------------------------------- */
/* popover                                                           */
/* ---------------------------------------------------------------- */

/* Which trigger last clicked a panel open — the fallback for browsers
   without ToggleEvent.source, when two triggers share one panel. */
const invokers = new WeakMap();

export function popover(trigger, options = {}) {
  if (typeof document === "undefined" || !trigger) return () => {};
  const panel =
    trigger.popoverTargetElement ?? document.getElementById(trigger.getAttribute("popovertarget") ?? "");
  if (!panel) return () => {};

  const { side = "bottom", align = "start", offset = 6 } = options;
  let release = null;

  const mine = (event) => {
    const source = event.source ?? invokers.get(panel) ?? null;
    return source === null || source === trigger;
  };

  const close = () => {
    release?.();
    release = null;
    panel.style.removeProperty("opacity");
    trigger.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    release?.();
    release = follow(panel, trigger, { side, align, offset });
    panel.style.removeProperty("opacity");
    trigger.setAttribute("aria-expanded", "true");
  };

  const onClick = () => invokers.set(panel, trigger);

  // beforetoggle fires before the panel renders, when it cannot be
  // measured yet. Hold it transparent — not hidden, so autofocus inside
  // still lands — until toggle, when it has a size and can be placed.
  const onBefore = (event) => {
    if (event.newState === "open") {
      if (mine(event)) panel.style.opacity = "0";
    } else {
      close();
    }
  };

  const onToggle = (event) => {
    if (!isOpen(panel)) return close();
    if (mine(event)) open();
    else trigger.setAttribute("aria-expanded", "false");
  };

  trigger.addEventListener("click", onClick);
  panel.addEventListener("beforetoggle", onBefore);
  panel.addEventListener("toggle", onToggle);
  if (isOpen(panel)) open();
  else trigger.setAttribute("aria-expanded", "false");

  return () => {
    // A panel this binding placed is closed first: released while still
    // open, it would drop back to the UA popover position mid-screen. One
    // opened from another trigger (another popover() call) is left alone.
    if (release && isOpen(panel)) panel.hidePopover();
    trigger.removeEventListener("click", onClick);
    panel.removeEventListener("beforetoggle", onBefore);
    panel.removeEventListener("toggle", onToggle);
    release?.();
    release = null;
    panel.style.removeProperty("opacity");
    trigger.removeAttribute("aria-expanded");
  };
}

/* ---------------------------------------------------------------- */
/* tooltip                                                           */
/* ---------------------------------------------------------------- */

let shownTip = null;
let lastTipHidden = -Infinity;

export function tooltip(trigger, content, options = {}) {
  if (typeof document === "undefined" || !trigger) return () => {};

  const { side = "top", align = "center", offset = 6, delay = 500, parent = null } = options;
  const owned = !(content instanceof Element);
  const tip = owned ? document.createElement("div") : content;

  if (owned) {
    tip.className = "hud-tooltip hud-brackets";
    tip.textContent = String(content ?? "");
    if (parent) parent.append(tip);
    else trigger.after(tip);
  }
  if (!tip.id) tip.id = uid("hud-tooltip");
  if (!tip.hasAttribute("role")) tip.setAttribute("role", "tooltip");
  if (!tip.hasAttribute("popover")) tip.setAttribute("popover", "manual");
  refs(trigger, "aria-describedby", tip.id, true);

  let overTrigger = false;
  let overTip = false;
  let focused = false;
  // Dismissed by Esc or a press: stays down until the pointer comes
  // back or focus leaves and returns.
  let dismissed = false;
  let showTimer = 0;
  let hideTimer = 0;
  let release = null;

  const self = { hide: () => hide(), shown: () => isOpen(tip) };

  const onKey = (event) => {
    if (event.key !== "Escape" || !isOpen(tip)) return;
    dismissed = true;
    hide();
    // One Esc, one layer: the dialog or popover underneath stays open.
    event.preventDefault();
  };

  const settle = () => {
    release?.();
    release = null;
    // Nothing can be hovering a tooltip that is no longer there.
    overTip = false;
    if (shownTip === self) shownTip = null;
    lastTipHidden = performance.now();
    document.removeEventListener("keydown", onKey, true);
  };

  const show = (instant) => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (isOpen(tip) || dismissed || !tip.isConnected || !trigger.isConnected || trigger.matches(":disabled")) return;
    if (shownTip && shownTip !== self) shownTip.hide();
    tip.toggleAttribute("data-instant", instant);
    tip.showPopover();
    release = follow(tip, trigger, { side, align, offset });
    shownTip = self;
    document.addEventListener("keydown", onKey, true);
  };

  const hide = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (isOpen(tip)) tip.hidePopover();
  };

  const maybeHide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!overTrigger && !overTip && !focused) hide();
    }, GRACE);
  };

  const onEnter = (event) => {
    if (event.pointerType === "touch") return;
    overTrigger = true;
    // A fresh hover is a fresh request, even after an Esc.
    dismissed = false;
    clearTimeout(hideTimer);
    if (isOpen(tip)) return;
    const warm = shownTip?.shown() || performance.now() - lastTipHidden < SKIP_WINDOW;
    clearTimeout(showTimer);
    if (warm || delay <= 0) show(warm);
    else showTimer = setTimeout(() => show(false), delay);
  };

  const onLeave = (event) => {
    if (event.pointerType === "touch") return;
    overTrigger = false;
    clearTimeout(showTimer);
    if (!focused) dismissed = false;
    maybeHide();
  };

  const onTipEnter = () => {
    overTip = true;
    clearTimeout(hideTimer);
  };

  const onTipLeave = () => {
    overTip = false;
    maybeHide();
  };

  const onFocus = () => {
    if (!trigger.matches(":focus-visible")) return;
    focused = true;
    show(false);
  };

  const onBlur = () => {
    focused = false;
    if (!overTrigger) dismissed = false;
    if (!overTrigger && !overTip) hide();
  };

  const onPress = () => {
    dismissed = true;
    hide();
  };

  // Closed by anything — hide(), destroy, a script — tidy up here.
  const onBefore = (event) => {
    if (event.newState === "closed") settle();
  };

  trigger.addEventListener("pointerenter", onEnter);
  trigger.addEventListener("pointerleave", onLeave);
  trigger.addEventListener("pointerdown", onPress);
  trigger.addEventListener("focus", onFocus);
  trigger.addEventListener("blur", onBlur);
  tip.addEventListener("pointerenter", onTipEnter);
  tip.addEventListener("pointerleave", onTipLeave);
  tip.addEventListener("beforetoggle", onBefore);

  return () => {
    hide();
    settle();
    trigger.removeEventListener("pointerenter", onEnter);
    trigger.removeEventListener("pointerleave", onLeave);
    trigger.removeEventListener("pointerdown", onPress);
    trigger.removeEventListener("focus", onFocus);
    trigger.removeEventListener("blur", onBlur);
    tip.removeEventListener("pointerenter", onTipEnter);
    tip.removeEventListener("pointerleave", onTipLeave);
    tip.removeEventListener("beforetoggle", onBefore);
    refs(trigger, "aria-describedby", tip.id, false);
    if (owned) tip.remove();
  };
}

/* ---------------------------------------------------------------- */
/* hover card                                                        */
/* ---------------------------------------------------------------- */

let shownCard = null;

export function hoverCard(trigger, card, options = {}) {
  if (typeof document === "undefined" || !trigger || !card) return () => {};

  const { side = "bottom", align = "start", offset = 6, openDelay = 700, closeDelay = 300 } = options;
  if (!card.hasAttribute("popover")) card.setAttribute("popover", "manual");

  let overTrigger = false;
  let overCard = false;
  // Keyboard focus on the trigger, or any focus inside the card. A mouse
  // click that happens to focus the link does not hold the card open.
  let engaged = false;
  let openTimer = 0;
  let closeTimer = 0;
  let release = null;

  const self = { close: () => close() };
  const within = (node) => node instanceof Node && (trigger.contains(node) || card.contains(node));

  const onKey = (event) => {
    if (event.key !== "Escape" || !isOpen(card)) return;
    // The card is going away; never leave focus stranded inside it.
    if (card.contains(document.activeElement)) trigger.focus();
    close();
    event.preventDefault();
  };

  const settle = () => {
    release?.();
    release = null;
    overCard = false;
    if (shownCard === self) shownCard = null;
    document.removeEventListener("keydown", onKey, true);
  };

  const open = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    if (isOpen(card) || !trigger.isConnected) return;
    if (shownCard && shownCard !== self) shownCard.close();
    card.showPopover();
    release = follow(card, trigger, { side, align, offset });
    shownCard = self;
    document.addEventListener("keydown", onKey, true);
  };

  const close = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    if (isOpen(card)) card.hidePopover();
  };

  const scheduleOpen = () => {
    clearTimeout(closeTimer);
    if (isOpen(card)) return;
    clearTimeout(openTimer);
    openTimer = setTimeout(open, openDelay);
  };

  const scheduleClose = (wait) => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!overTrigger && !overCard && !engaged) close();
    }, wait);
  };

  const onEnter = (event) => {
    if (event.pointerType === "touch") return;
    overTrigger = true;
    scheduleOpen();
  };

  const onLeave = (event) => {
    if (event.pointerType === "touch") return;
    overTrigger = false;
    scheduleClose(closeDelay);
  };

  const onCardEnter = () => {
    overCard = true;
    clearTimeout(closeTimer);
  };

  const onCardLeave = () => {
    overCard = false;
    scheduleClose(closeDelay);
  };

  const onFocusIn = (event) => {
    if (event.target === trigger && !trigger.matches(":focus-visible")) return;
    engaged = true;
    clearTimeout(closeTimer);
    if (event.target === trigger) scheduleOpen();
  };

  const onFocusOut = (event) => {
    if (within(event.relatedTarget)) return;
    engaged = false;
    if (!overTrigger && !overCard) close();
  };

  // A press on the link is a navigation, not a request to preview it.
  const onPress = () => clearTimeout(openTimer);

  const onBefore = (event) => {
    if (event.newState === "closed") settle();
  };

  trigger.addEventListener("pointerenter", onEnter);
  trigger.addEventListener("pointerleave", onLeave);
  trigger.addEventListener("pointerdown", onPress);
  trigger.addEventListener("focusin", onFocusIn);
  trigger.addEventListener("focusout", onFocusOut);
  card.addEventListener("pointerenter", onCardEnter);
  card.addEventListener("pointerleave", onCardLeave);
  card.addEventListener("focusin", onFocusIn);
  card.addEventListener("focusout", onFocusOut);
  card.addEventListener("beforetoggle", onBefore);

  return () => {
    close();
    settle();
    trigger.removeEventListener("pointerenter", onEnter);
    trigger.removeEventListener("pointerleave", onLeave);
    trigger.removeEventListener("pointerdown", onPress);
    trigger.removeEventListener("focusin", onFocusIn);
    trigger.removeEventListener("focusout", onFocusOut);
    card.removeEventListener("pointerenter", onCardEnter);
    card.removeEventListener("pointerleave", onCardLeave);
    card.removeEventListener("focusin", onFocusIn);
    card.removeEventListener("focusout", onFocusOut);
    card.removeEventListener("beforetoggle", onBefore);
  };
}
