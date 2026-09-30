/**
 * roving() — roving tabindex for a composite widget. Internal: the tabs,
 * menu, toggle-group and similar helpers build on it; it is not a public
 * entry point.
 *
 *   import { roving } from "./internal/roving.js";
 *
 *   const nav = roving(tablist, {
 *     items: '[role="tab"]',              // or (container) => elements, for
 *                                         // sets a selector can't scope
 *                                         // (a menu's own items, not a submenu's)
 *     orientation: "horizontal",          // "vertical" | "horizontal" | "both"
 *     loop: true,                         // wrap at the ends
 *     typeahead: false,                   // printable keys jump by text
 *     initial: (el) => el.getAttribute("aria-selected") === "true",
 *     onMove: (el, event) => select(el),  // after a keyboard move
 *   });
 *   nav.focus(el | index);   nav.setCurrent(el);   nav.items();   nav.refresh();   nav.destroy();
 *
 * setCurrent() moves the tab stop without moving focus — for a
 * programmatic selection that should be where Tab lands next.
 *
 * Exactly one enabled item is in the tab order (tabindex 0), the rest
 * are -1, so Tab enters and leaves the widget in one stop. Arrow keys
 * move along the orientation — Left/Right swap under direction: rtl —
 * and Home/End jump to the ends. With typeahead on, printable keys move
 * to the next item whose text starts with what was typed in the last
 * 500ms; repeating one letter cycles through the items that start with
 * it. An item focused any other way — a click, a programmatic focus —
 * becomes the tab stop.
 *
 * Disabled items (disabled, aria-disabled="true") and items that are not
 * rendered are skipped. Activation — Enter, Space, click — is the
 * caller's, and so is any key the surrounding widget reserves: roving()
 * ignores events that are already defaultPrevented.
 *
 * Call refresh() after adding or removing items.
 */

export function roving(container, options = {}) {
  const {
    items: selector,
    orientation = "vertical",
    loop = true,
    typeahead = false,
    initial,
    onMove,
  } = options;

  const all = () =>
    typeof selector === "function" ? [...selector(container)] : [...container.querySelectorAll(selector)];
  const enabled = (el) => !el.disabled && el.getAttribute("aria-disabled") !== "true";
  const members = () => all().filter(enabled);
  const navigable = () => members().filter((el) => el.getClientRects().length > 0);

  let current = null;

  // Every matching item, disabled ones included, leaves the tab order
  // except the target — an aria-disabled item is still focusable.
  const sync = (target) => {
    for (const el of all()) el.tabIndex = el === target ? 0 : -1;
    current = target;
  };

  const focus = (which) => {
    const list = navigable();
    const el = typeof which === "number" ? list[which] : which;
    if (!el) return;
    sync(el);
    el.focus();
  };

  const refresh = () => {
    const list = members();
    const keep = list.includes(current) ? current : null;
    sync(keep ?? (initial && list.find(initial)) ?? list[0] ?? null);
  };

  let buffer = "";
  let timer = 0;

  const onKeyDown = (e) => {
    if (e.defaultPrevented) return;
    const list = navigable();
    if (!list.length) return;

    const here = list.includes(document.activeElement) ? document.activeElement : current;
    const i = Math.max(0, list.indexOf(here));
    const rtl = getComputedStyle(container).direction === "rtl";
    const h = orientation !== "vertical";
    const v = orientation !== "horizontal";
    const plain = !e.altKey && !e.ctrlKey && !e.metaKey;

    let step = 0;
    let to = -1;
    if (plain && v && e.key === "ArrowDown") step = 1;
    else if (plain && v && e.key === "ArrowUp") step = -1;
    else if (plain && h && e.key === "ArrowRight") step = rtl ? -1 : 1;
    else if (plain && h && e.key === "ArrowLeft") step = rtl ? 1 : -1;
    else if (plain && e.key === "Home") to = 0;
    else if (plain && e.key === "End") to = list.length - 1;

    if (step) {
      to = i + step;
      if (to < 0) to = loop ? list.length - 1 : 0;
      if (to >= list.length) to = loop ? 0 : list.length - 1;
    }

    if (to >= 0) {
      e.preventDefault();
      focus(list[to]);
      onMove?.(list[to], e);
      return;
    }

    if (!typeahead || !plain || e.key.length !== 1 || (e.key === " " && !buffer)) return;

    clearTimeout(timer);
    timer = setTimeout(() => { buffer = ""; }, 500);
    buffer += e.key.toLowerCase();

    // "aaa" means "the next a", not "an item starting with aaa".
    const cycling = buffer.length > 1 && [...buffer].every((c) => c === buffer[0]);
    const needle = cycling ? buffer[0] : buffer;
    const start = buffer.length === 1 || cycling ? i + 1 : i;
    for (let k = 0; k < list.length; k++) {
      const el = list[(start + k) % list.length];
      if (el.textContent.trim().toLowerCase().startsWith(needle)) {
        e.preventDefault();
        focus(el);
        onMove?.(el, e);
        return;
      }
    }
  };

  const onFocusIn = (e) => {
    const el = all().find((item) => item === e.target || item.contains(e.target));
    if (el && enabled(el)) sync(el);
  };

  refresh();
  container.addEventListener("keydown", onKeyDown);
  container.addEventListener("focusin", onFocusIn);

  return {
    focus,
    setCurrent(el) {
      if (el && members().includes(el)) sync(el);
    },
    refresh,
    items: navigable,
    get current() {
      return current;
    },
    destroy() {
      clearTimeout(timer);
      container.removeEventListener("keydown", onKeyDown);
      container.removeEventListener("focusin", onFocusIn);
    },
  };
}
