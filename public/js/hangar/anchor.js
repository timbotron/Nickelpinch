/**
 * anchor() — keep a floating element beside the thing that opened it.
 * No framework, no dependency.
 *
 *   import { anchor } from "@valeness/hangar/anchor";
 *
 *   menu.showPopover();
 *   const release = anchor(menu, button, { side: "bottom", align: "start" });
 *   menu.addEventListener("toggle", (e) => {
 *     if (e.newState === "closed") release();
 *   });
 *
 * The floating element is switched to position: fixed and placed against
 * the reference's viewport rect, which is what top-layer elements
 * (popover, <dialog>) need and what lets a menu escape an
 * overflow: hidden ancestor. Do not use it on an element inside a
 * transformed ancestor unless that element is in the top layer — a
 * transform makes position: fixed relative to the ancestor.
 *
 *   side     "top" | "bottom" | "left" | "right"   default "bottom"
 *   align    "start" | "center" | "end"            default "start"
 *            On the top/bottom sides start/end follow the writing
 *            direction, so "start" is the right-hand edge under
 *            direction: rtl. On left/right, start is the top.
 *   offset   gap between reference and floating element, px   default 6
 *   padding  distance kept from the viewport edge, px          default 8
 *
 * If the chosen side lacks room and the opposite side has more, it
 * flips. Along the other axis it slides to stay on screen. The side
 * actually used is written to data-side on the floating element, so CSS
 * can point an arrow or pick an entry direction from it.
 *
 * `reference` may be an element or anything with getBoundingClientRect(),
 * so a context menu can anchor to the pointer:
 *
 *   anchor(menu, { getBoundingClientRect: () => new DOMRect(e.clientX, e.clientY, 0, 0) });
 *
 * Returns a function that stops tracking and puts back everything anchor()
 * wrote: the inline position, margin, top/right/bottom/left and data-side
 * go back to what they were before it ran, so call it once the element
 * is hidden (or re-anchor straight away). A second call does nothing.
 * Tracking follows scrolling in any scroll container, viewport resizes,
 * and size changes of either element.
 *
 * Nothing else on the floating element is touched, so a framework can
 * own its class, content and every other inline style; leave position,
 * margin, inset/top/right/bottom/left and data-side to anchor(). Bind
 * the element's style as an object (React style={{…}}, Vue
 * :style="{…}"), which is patched property by property; a string
 * style binding (Vue :style="`…`") rewrites the whole attribute when
 * it changes and loses the placement.
 */

const OPPOSITE = { top: "bottom", bottom: "top", left: "right", right: "left" };

/* The inline longhands anchor() writes, put back on release. */
const WRITES = ["position", "margin-top", "margin-right", "margin-bottom", "margin-left", "top", "right", "bottom", "left"];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

export function anchor(floating, reference, options = {}) {
  if (typeof window === "undefined" || !floating || !reference) return () => {};

  const { side = "bottom", align = "start", offset = 6, padding = 8 } = options;

  const { style } = floating;
  const saved = WRITES.map((p) => [p, style.getPropertyValue(p), style.getPropertyPriority(p)]);
  const savedSide = floating.getAttribute("data-side");

  // A popover's UA style is inset: 0; margin: auto — both have to go
  // before left/top mean anything.
  Object.assign(style, { position: "fixed", margin: "0", inset: "auto" });

  let frame = 0;

  const place = () => {
    frame = 0;
    const r = reference.getBoundingClientRect();
    const f = floating.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const rtl = getComputedStyle(floating).direction === "rtl";

    const room = {
      top: r.top - offset - padding,
      bottom: vh - r.bottom - offset - padding,
      left: r.left - offset - padding,
      right: vw - r.right - offset - padding,
    };
    const vertical = (s) => s === "top" || s === "bottom";
    const need = (s) => (vertical(s) ? f.height : f.width);

    let s = OPPOSITE[side] ? side : "bottom";
    if (room[s] < need(s) && room[OPPOSITE[s]] > room[s]) s = OPPOSITE[s];

    let x;
    let y;
    if (vertical(s)) {
      y = s === "bottom" ? r.bottom + offset : r.top - offset - f.height;
      const edge = align === "center" ? "center" : (align === "end") !== rtl ? "right" : "left";
      x = edge === "center" ? r.left + (r.width - f.width) / 2 : edge === "left" ? r.left : r.right - f.width;
    } else {
      x = s === "right" ? r.right + offset : r.left - offset - f.width;
      y = align === "center" ? r.top + (r.height - f.height) / 2 : align === "end" ? r.bottom - f.height : r.top;
    }

    // Slide along both axes to stay on screen. On the main axis this only
    // bites when neither side had room; overlapping the reference then
    // beats being cut off.
    x = clamp(x, padding, vw - f.width - padding);
    y = clamp(y, padding, vh - f.height - padding);

    floating.style.left = `${Math.round(x)}px`;
    floating.style.top = `${Math.round(y)}px`;
    floating.dataset.side = s;
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(place);
  };

  place();
  window.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
  observer?.observe(floating);
  if (typeof Element !== "undefined" && reference instanceof Element) observer?.observe(reference);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule, { capture: true });
    window.removeEventListener("resize", schedule);
    observer?.disconnect();
    for (const [p, value, priority] of saved) {
      if (value) style.setProperty(p, value, priority);
      else style.removeProperty(p);
    }
    if (savedSide == null) floating.removeAttribute("data-side");
    else floating.setAttribute("data-side", savedSide);
  };
}
