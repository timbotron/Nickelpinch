/**
 * toggleGroup() and radioGroup() — keyboard and state for button
 * groups. No framework, no dependency.
 *
 *   import { toggleGroup, radioGroup } from "@valeness/hangar/group";
 *
 *   // Latching toggles, any number in (.hud-toggle-group)
 *   const overlays = toggleGroup(document.querySelector("#overlays"));
 *   overlays.el.addEventListener("hud-change", (e) => render(e.detail.value)); // ["grid", "labels"]
 *   overlays.setValue(["grid"]);                // from code: no event
 *
 *   // At most one in; pressing the lit one lets it out again
 *   toggleGroup(align, { multiple: false });    // detail.value: "left" | null
 *
 *   // Exactly one of N — the segmented selector, or any
 *   // role="radiogroup" of role="radio" buttons
 *   const gran = radioGroup(document.querySelector(".hud-selector"));
 *   gran.el.addEventListener("hud-change", (e) => load(e.detail.value)); // "WEEK"
 *   gran.select("MONTH");                      // from code: no event
 *   gran.setValue(null);                       // none checked; no event
 *
 *   gran.destroy();
 *
 * TOGGLE GROUP. Items are the [aria-pressed] buttons inside the
 * element. Click, Enter and Space flip aria-pressed (they are native
 * buttons, so the browser turns the keys into clicks); with
 * multiple: false, pressing one lets the others out. The group is one
 * tab stop, and the arrow keys move along it — Left/Right, or Up/Down
 * when the element has aria-orientation="vertical" — plus Home/End.
 * Moving does not press. The element gets role="group" if it has no
 * role; the aria-label is yours.
 *
 * RADIO GROUP, the WAI-ARIA APG radio group: one tab stop, landing on
 * the checked radio (the first, if none is); the arrow keys move AND
 * check, wrapping at the ends, Right/Down forward and Left/Up back
 * (Left/Right swap under direction: rtl); Space checks the focused
 * radio. aria-checked is the state, and .is-active — what
 * .hud-selector-opt paints from — is kept in step with it on every
 * item, from the first call on.
 *
 * Both skip disabled and aria-disabled items, and both fire
 * `hud-change` on the group element (bubbling) when the user changes
 * the value — never for a change made from code. detail.value is an
 * item's value: its value attribute, else data-value, else its
 * trimmed text. detail.item is the button that changed.
 *
 * Both return { el, value, select(itemOrValue), setValue(value),
 * refresh(), destroy() }. value is read live from the DOM, in the shape
 * detail.value has: an array for a multiple toggle group, else a
 * string or null. select() presses or checks one item and moves the
 * tab stop to it. setValue() makes the whole group match a value — a
 * toggle group presses exactly the listed values and lets the rest
 * out; a radio group checks the item with that value, none for null
 * or no match. Neither fires hud-change, so a framework can push its
 * state in without it coming back as a change.
 *
 * Arrow keys always walk the items as they are in the DOM now, but the
 * tab stop (and a radio group's .is-active) is re-derived only by
 * refresh(): call it after adding or removing items — in a framework,
 * after each render that changes them. destroy() removes the
 * listeners, the roving tabindex and a role it added, leaving the
 * markup's pressed/checked state as it stands.
 *
 * FRAMEWORKS. The items are yours to render; the module writes only
 * aria-pressed / aria-checked, a radio's .is-active and tabindex on
 * them. Render aria-pressed (or aria-checked plus is-active) from your
 * own value, set that value from hud-change, and your re-render agrees
 * with what the module wrote. Don't render tabindex on the items. A
 * class binding that leaves is-active out wipes it when it changes:
 * bind it too, or call refresh() after that render.
 */

import { roving } from "./internal/roving.js";

const hasDom = () => typeof document !== "undefined";

const enabled = (el) => !el.disabled && el.getAttribute("aria-disabled") !== "true";

/** An item's value: value attribute, then data-value, then its text. */
const valueOf = (el) => el.getAttribute("value") || el.dataset.value || el.textContent.trim();

const inert = (el, value = null) => ({
  el,
  value,
  select() {},
  setValue() {},
  refresh() {},
  destroy() {},
});

/* Shared scaffolding: role, listeners, item lookup, roving, teardown. */
function group(el, { role, items: selector, orientation, isOn, activate, onKey }) {
  const addedRole = !el.hasAttribute("role");
  if (addedRole) el.setAttribute("role", role);

  const items = () => [...el.querySelectorAll(selector)];
  const saved = new Map(items().map((item) => [item, item.getAttribute("tabindex")]));

  const nav = roving(el, {
    items: selector,
    orientation,
    initial: isOn,
    onMove: activate.onMove,
  });

  const onClick = (e) => {
    const item = e.target.closest?.(selector);
    if (!item || !el.contains(item) || !enabled(item)) return;
    activate.onClick(item);
  };

  el.addEventListener("click", onClick);
  if (onKey) el.addEventListener("keydown", onKey);

  const find = (which) =>
    typeof which === "string" ? items().find((item) => valueOf(item) === which) : which;

  return {
    nav,
    items,
    find,
    destroy() {
      nav.destroy();
      el.removeEventListener("click", onClick);
      if (onKey) el.removeEventListener("keydown", onKey);
      if (addedRole) el.removeAttribute("role");
      for (const item of items()) {
        const was = saved.get(item);
        if (was == null) item.removeAttribute("tabindex");
        else item.setAttribute("tabindex", was);
      }
    },
  };
}

const emit = (el, value, item) =>
  el.dispatchEvent(new CustomEvent("hud-change", { bubbles: true, detail: { value, item } }));

/**
 * Latching toggles with one tab stop. multiple (default true): any
 * number pressed, value is an array; false: at most one, value is
 * that item's value or null.
 */
export function toggleGroup(el, options = {}) {
  const { multiple = true } = options;
  if (!hasDom() || !el) return inert(el, multiple ? [] : null);
  const ITEMS = "[aria-pressed]";

  const pressed = (item) => item.getAttribute("aria-pressed") === "true";

  let g;
  const value = () => {
    const on = g.items().filter(pressed).map(valueOf);
    return multiple ? on : (on[0] ?? null);
  };

  const press = (item, on) => {
    if (on && !multiple) {
      for (const other of g.items()) if (other !== item) other.setAttribute("aria-pressed", "false");
    }
    item.setAttribute("aria-pressed", String(on));
  };

  g = group(el, {
    role: "group",
    items: ITEMS,
    orientation: el.getAttribute("aria-orientation") === "vertical" ? "vertical" : "horizontal",
    isOn: pressed,
    activate: {
      onClick(item) {
        press(item, !pressed(item));
        emit(el, value(), item);
      },
    },
  });

  // Markup with several pressed in a single group: keep the first.
  if (!multiple) {
    const first = g.items().find(pressed);
    if (first) press(first, true);
  }

  return {
    el,
    get value() {
      return value();
    },
    /** Press an item (element or value) from code. No event. */
    select(which, on = true) {
      const item = g.find(which);
      if (!item || !el.contains(item)) return;
      press(item, on);
      g.nav.setCurrent(item);
    },
    /**
     * Press exactly the items with these values (a multiple group takes
     * an array; a single one a value or null), release the rest. No event.
     */
    setValue(v) {
      const list = Array.isArray(v) ? v : v == null ? [] : [v];
      const want = new Set((multiple ? list : list.slice(0, 1)).map(String));
      let any = false;
      for (const item of g.items()) {
        const on = want.has(valueOf(item)) && (multiple || !any);
        any ||= on;
        if (pressed(item) !== on) item.setAttribute("aria-pressed", String(on));
      }
    },
    refresh: () => g.nav.refresh(),
    destroy: () => g.destroy(),
  };
}

/**
 * APG radio group over role="radio" buttons: arrows move and check,
 * Space checks, one tab stop on the checked radio. Keeps .is-active in
 * step with aria-checked.
 */
export function radioGroup(el) {
  if (!hasDom() || !el) return inert(el);
  const ITEMS = '[role="radio"]';

  const isOn = (item) => item.getAttribute("aria-checked") === "true";

  let g;
  const checked = () => g.items().find(isOn) ?? null;

  const paint = (target) => {
    for (const item of g.items()) {
      const on = item === target;
      item.setAttribute("aria-checked", String(on));
      item.classList.toggle("is-active", on);
    }
  };

  const choose = (item) => {
    if (item === checked()) return;
    paint(item);
    emit(el, valueOf(item), item);
  };

  g = group(el, {
    role: "radiogroup",
    items: ITEMS,
    orientation: "both",
    isOn,
    activate: { onClick: choose, onMove: choose },
    // A <button> turns Space into a click on its own; anything else
    // playing a radio needs it done here.
    onKey(e) {
      if (e.key !== " " || e.defaultPrevented) return;
      const item = e.target.closest?.(ITEMS);
      if (!item || item.localName === "button" || !el.contains(item) || !enabled(item)) return;
      e.preventDefault();
      choose(item);
    },
  });

  paint(checked());

  return {
    el,
    get value() {
      const item = checked();
      return item ? valueOf(item) : null;
    },
    /** Check an item (element or value) from code. No event. */
    select(which) {
      const item = g.find(which);
      if (!item || !el.contains(item)) return;
      paint(item);
      g.nav.setCurrent(item);
    },
    /** Check the item with this value — none for null or no match. No event. */
    setValue(v) {
      const item = v == null ? null : (g.items().find((i) => valueOf(i) === String(v)) ?? null);
      paint(item);
      if (item) g.nav.setCurrent(item);
    },
    refresh() {
      g.nav.refresh();
      const item = checked();
      paint(item);
      if (item) g.nav.setCurrent(item);
    },
    destroy: () => g.destroy(),
  };
}
