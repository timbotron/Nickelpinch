/**
 * menu(), contextMenu(), menubar() — the WAI-ARIA menu patterns on top
 * of the popover attribute. No framework, no dependency.
 *
 *   import { menu, contextMenu, menubar } from "@valeness/hangar/menu";
 *
 *   const actions = menu(button, document.getElementById("actions"));
 *   actions.el.addEventListener("hud-select", (e) => run(e.detail.item));
 *   contextMenu(panel, document.getElementById("row-menu"));
 *   menubar(document.querySelector(".hud-menubar"));
 *
 * Markup is css/instruments/menu.css: a [popover].hud-menu with
 * role="menu" holding role="menuitem" / "menuitemcheckbox" /
 * "menuitemradio" items, optionally inside role="group" wrappers. A
 * missing popover attribute becomes popover="auto", which is what gives
 * the menu its light dismiss and puts it in the top layer.
 *
 * menu(trigger, menuEl, { side, align, offset })   — APG Menu Button
 *   Wires aria-haspopup / aria-expanded / aria-controls on the trigger.
 *   Click, Enter, Space and ArrowDown open it on the first item, ArrowUp
 *   on the last; a pointer click opens it with focus on the panel.
 *   side/align/offset go to anchor() — default bottom / start / 6.
 *
 * contextMenu(target, menuEl, { offset })
 *   Opens at the pointer on `contextmenu`, and beside the focused element
 *   on Shift+F10 or the ContextMenu key. The target (or something in it)
 *   must be focusable for the keyboard path to exist.
 *
 * menubar(el)                                        — APG Menubar
 *   role="menubar" of top-level role="menuitem" triggers. Each opens the
 *   menu named by its aria-controls (or its next [role="menu"] sibling).
 *
 * Inside any menu: Up/Down, Home/End and typeahead move; Enter activates
 * and closes; Space toggles a checkbox or radio item and stays open;
 * Escape closes one level and returns focus to what opened it; Tab
 * closes everything, returns focus, and lets the Tab carry on from
 * there. ArrowRight (ArrowLeft under direction: rtl) opens a submenu —
 * an item with aria-haspopup whose menu is its aria-controls target or
 * its next [role="menu"] sibling — and the opposite arrow closes it.
 * Inside a menubar the same arrows walk to the neighbouring menu. The
 * pointer highlights on hover and opens submenus after a short dwell.
 *
 * Activating an item toggles aria-checked on a menuitemcheckbox, checks a
 * menuitemradio and unchecks the others in its role="group" (or in the
 * menu, if it has none), then dispatches a bubbling, cancelable
 * `hud-select` CustomEvent from the item:
 *
 *   detail: { item, value: item.dataset.value ?? null, checked: true | false | null }
 *
 * Calling preventDefault() on it, or a data-keep-open attribute on the
 * item, its group or its menu, keeps the menu open. Disabled items
 * (aria-disabled="true") never fire it. Opening and closing are the
 * menu element's native `toggle` event.
 *
 * Keep submenus inside their parent menu's DOM (next to their trigger)
 * so the browser nests the popovers; a submenu that lives elsewhere
 * relies on showPopover({ source }), which not every engine supports.
 *
 * Items are read live: rows the app adds, removes, disables or
 * re-renders — with the menu closed or open — are in the arrow-key and
 * typeahead order at the next key press, and submenus are re-resolved
 * each time their parent opens. menubar() also observes its own subtree
 * (a MutationObserver), so entries the app adds, removes or re-points
 * (a new aria-controls) are wired, unwired or re-wired on their own; its
 * refresh() does it at once. Render the panels
 * unconditionally — they are hidden until opened — so the elements passed
 * in stay the ones on the page; if the framework replaces the trigger or
 * a top-level panel, destroy and call again.
 *
 * aria-checked is the state, read live on every activation. Setting it
 * from code, or rendering it from app state, is the programmatic setter:
 * nothing fires. On activation the item flips first and hud-select
 * reports the new value, so a framework that renders aria-checked from
 * state stores detail.checked and re-renders the same value; to refuse a
 * change, set the attribute back in the handler.
 *
 * menu() and contextMenu() return { el, open(focus?), close(), isOpen(),
 * destroy() }; open() takes "first", "last" or "menu" (focus the panel).
 * contextMenu()'s also has `context`: the element it was last opened on
 * — the one right-clicked, or the one focused when the key was pressed.
 * menubar() returns { el, close(), refresh(), destroy() }. destroy()
 * removes the listeners and the ARIA wiring this module added to
 * triggers, entries and panels; aria-checked stays as it stands, and so
 * does a popover attribute it added, so a panel never drops into the
 * page flow. All three are inert outside a browser.
 */

import { anchor } from "./anchor.js";
import { roving } from "./internal/roving.js";

const ITEM = ':is([role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"])';
const MENU = '[role="menu"], [role="menubar"]';

/* The items that belong to this menu (or menubar) and not to one nested
   inside it: direct children, and those under role=group/none wrappers. */
const itemsOf = (container) =>
  [...container.querySelectorAll(ITEM)].filter((item) => item.parentElement.closest(MENU) === container);

/* Submenu dwell: open after a short hover, close a little later so a
   diagonal move toward the submenu does not drop it. */
const OPEN_DELAY = 120;
const CLOSE_DELAY = 300;

let uid = 0;

/* What this module last wrote to each (element, attribute), so an undo
   can tell its own value from one the app rendered since. */
const wrote = new WeakMap();
const put = (el, name, value) => {
  el.setAttribute(name, value);
  if (!wrote.has(el)) wrote.set(el, new Map());
  wrote.get(el).set(name, value);
};

/* Attribute writes on the app's elements that destroy() takes back. The
   first write to each (element, name) remembers what was there before;
   undo(el) restores one element, undo() all of them. An attribute the
   app has changed since this module last wrote it is the app's again,
   and is left as it is — a re-pointed aria-controls stays re-pointed. */
function ledger() {
  const was = [];
  const set = (el, name, value) => {
    if (!was.some(([e, n]) => e === el && n === name)) was.push([el, name, el.getAttribute(name)]);
    put(el, name, value);
  };
  const id = (el) => el.id || (set(el, "id", `hud-menu-${++uid}`), el.id);
  const undo = (only) => {
    for (let i = was.length - 1; i >= 0; i--) {
      const [el, name, old] = was[i];
      if (only && el !== only) continue;
      was.splice(i, 1);
      if (el.getAttribute(name) !== wrote.get(el)?.get(name)) continue;
      if (old === null) el.removeAttribute(name);
      else el.setAttribute(name, old);
    }
  };
  return { set, id, undo };
}

const labelled = (el) => el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby");
const disabled = (el) => el.disabled === true || el.getAttribute("aria-disabled") === "true";
const hasSub = (el) => el.hasAttribute("aria-haspopup") && el.getAttribute("aria-haspopup") !== "false";
const rtl = (el) => getComputedStyle(el).direction === "rtl";
const plain = (e) => !e.altKey && !e.ctrlKey && !e.metaKey;
const menuOf = (node) => (node?.nodeType === 1 ? node : node?.parentElement)?.closest(MENU) ?? null;

const point = (x, y) => ({ getBoundingClientRect: () => new DOMRect(x, y, 0, 0) });

function popupFor(item) {
  const id = item.getAttribute("aria-controls");
  const byId = id ? item.ownerDocument.getElementById(id) : null;
  if (byId) return byId;
  const next = item.nextElementSibling;
  return next && next.getAttribute("role") === "menu" ? next : null;
}

function isOpen(el) {
  try {
    return el.matches(":popover-open");
  } catch {
    return false;
  }
}

const inert = (el = null) => ({ el, open() {}, close() {}, isOpen: () => false, refresh() {}, destroy() {} });

/* One menu panel: its items, its keyboard, its submenus. `owner` is the
   binding that opened the outermost menu — it knows where focus goes
   back to and what the menubar's arrows mean. */
function panel(el, { trigger = null, parent = null, owner }) {
  const subs = new Map();
  const marks = ledger();
  let sub = null;
  let release = null;
  let openTimer = 0;
  let closeTimer = 0;
  let spaceKeep = false;

  if (!el.hasAttribute("popover")) el.setAttribute("popover", "auto");
  if (!el.hasAttribute("role")) marks.set(el, "role", "menu");
  if (!el.hasAttribute("tabindex")) marks.set(el, "tabindex", "-1");
  marks.id(el);

  const clearTimers = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  };

  const own = () => itemsOf(el);

  // Submenu triggers get their ARIA up front; state items get an
  // explicit aria-checked so the CSS and the event agree from the start.
  // Submenus whose trigger is gone, or no longer has one, are let go.
  const scan = () => {
    const items = own();
    for (const item of subs.keys()) if (!items.includes(item) || !hasSub(item)) drop(item);
    for (const item of items) {
      const role = item.getAttribute("role");
      if ((role === "menuitemcheckbox" || role === "menuitemradio") && !item.hasAttribute("aria-checked"))
        item.setAttribute("aria-checked", "false");
      if (hasSub(item)) subFor(item);
    }
  };

  const drop = (item) => {
    const p = subs.get(item);
    p.destroy();
    if (sub === p) sub = null;
    subs.delete(item);
    marks.undo(item);
    marks.undo(p.el);
  };

  // Resolved again on every call: the app may have re-rendered the
  // submenu as a new element.
  const subFor = (item) => {
    const menuEl = popupFor(item);
    if (subs.has(item)) {
      if (subs.get(item).el === menuEl) return subs.get(item);
      drop(item);
    }
    if (!menuEl) return null;
    marks.id(item);
    marks.set(item, "aria-controls", marks.id(menuEl));
    marks.set(item, "aria-expanded", "false");
    if (!labelled(menuEl)) marks.set(menuEl, "aria-labelledby", item.id);
    const p = panel(menuEl, { trigger: item, parent: api, owner });
    subs.set(item, p);
    return p;
  };

  const openSub = (item, focus) => {
    clearTimers();
    const p = subFor(item);
    if (!p) return;
    if (sub && sub !== p) sub.close();
    sub = p;
    p.open({ reference: item, side: rtl(el) ? "left" : "right", align: "start", offset: 5, focus });
  };

  const scheduleSubClose = () => {
    clearTimeout(openTimer);
    if (!sub) return;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => sub?.close(), CLOSE_DELAY);
  };

  const scheduleSubOpen = (item) => {
    clearTimeout(openTimer);
    if (sub && sub.trigger === item) {
      clearTimeout(closeTimer);
      return;
    }
    if (sub) scheduleSubClose();
    openTimer = setTimeout(() => openSub(item, "none"), OPEN_DELAY);
  };

  const radios = (item) => {
    const scope = item.closest('[role="group"], [role="menu"]');
    return [...scope.querySelectorAll('[role="menuitemradio"]')].filter(
      (r) => r.closest('[role="group"], [role="menu"]') === scope
    );
  };

  const activate = (item) => {
    const role = item.getAttribute("role");
    let checked = null;
    if (role === "menuitemcheckbox") {
      checked = item.getAttribute("aria-checked") !== "true";
      item.setAttribute("aria-checked", String(checked));
    } else if (role === "menuitemradio") {
      for (const r of radios(item)) r.setAttribute("aria-checked", String(r === item));
      checked = true;
    }
    const proceed = item.dispatchEvent(
      new CustomEvent("hud-select", {
        bubbles: true,
        cancelable: true,
        detail: { item, value: item.dataset.value ?? null, checked },
      })
    );
    const pin = item.closest("[data-keep-open]");
    const keep = !proceed || (pin && el.contains(pin)) || (spaceKeep && role !== "menuitem");
    if (!keep) owner.dismiss();
  };

  // Registered before roving, so it runs first: with focus on the panel
  // itself (after a pointer open) the arrows start from the ends rather
  // than from roving's remembered stop.
  const onKeyFirst = (e) => {
    if (e.target !== el || !plain(e)) return;
    const list = nav.items();
    if (e.key === "ArrowDown" || e.key === "Home") nav.focus(0);
    else if (e.key === "ArrowUp" || e.key === "End") nav.focus(list.length - 1);
    else return;
    e.preventDefault();
  };

  const onKey = (e) => {
    if (e.defaultPrevented || e.isComposing || menuOf(e.target) !== el) return;
    if (e.key === "Tab") {
      owner.dismiss();
      return;
    }
    if (!plain(e)) return;

    const item = e.target === el ? null : e.target.closest(ITEM);
    const inward = rtl(el) ? "ArrowLeft" : "ArrowRight";
    const outward = rtl(el) ? "ArrowRight" : "ArrowLeft";

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        if (sub) {
          const t = sub.trigger;
          sub.close();
          t.focus();
        } else if (parent) {
          close();
          trigger.focus();
        } else owner.dismiss();
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!item || disabled(item)) return;
        if (hasSub(item)) openSub(item, "first");
        else {
          // A real click, so consumers' own click listeners and links
          // behave exactly as they do for the pointer.
          spaceKeep = e.key === " ";
          item.click();
          spaceKeep = false;
        }
        return;
      case inward:
        e.preventDefault();
        if (item && hasSub(item) && !disabled(item)) openSub(item, "first");
        else owner.edge?.(1);
        return;
      case outward:
        e.preventDefault();
        if (parent) {
          close();
          trigger.focus();
        } else owner.edge?.(-1);
        return;
      default:
        // Unmatched typeahead stops here, so a parent menu's roving
        // never acts on a key meant for this one.
        if (e.key.length === 1) e.preventDefault();
    }
  };

  const onClick = (e) => {
    if (menuOf(e.target) !== el) return;
    const item = e.target.closest(ITEM);
    if (!item || menuOf(item) !== el) return;
    if (disabled(item)) {
      e.preventDefault();
      return;
    }
    if (hasSub(item)) {
      e.preventDefault();
      openSub(item, e.detail === 0 ? "first" : "none");
      return;
    }
    activate(item);
  };

  const onPointerMove = (e) => {
    if (e.pointerType === "touch") return;
    if (menuOf(e.target) !== el) {
      if (sub?.contains(e.target)) clearTimeout(closeTimer);
      return;
    }
    const item = e.target.closest(ITEM);
    if (!item || menuOf(item) !== el) return;
    if (disabled(item)) {
      if (document.activeElement !== el) el.focus({ preventScroll: true });
      scheduleSubClose();
      return;
    }
    if (document.activeElement !== item) nav.focus(item);
    if (hasSub(item)) scheduleSubOpen(item);
    else scheduleSubClose();
  };

  const onPointerEnter = (e) => {
    if (e.pointerType !== "touch") parent?.hold();
  };

  // The pointer left: drop the hover highlight, unless it is holding a
  // submenu open.
  const onPointerLeave = (e) => {
    if (e.pointerType === "touch") return;
    clearTimeout(openTimer);
    const a = document.activeElement;
    if (!sub && a !== el && el.contains(a) && menuOf(a) === el) el.focus({ preventScroll: true });
  };

  const cleanup = () => {
    clearTimers();
    release?.();
    release = null;
    sub = null;
    if (trigger) put(trigger, "aria-expanded", "false");
    parent?.childClosed(api);
    owner.closed?.(api);
  };

  const onBeforeToggle = (e) => {
    if (e.target === el && e.newState === "closed") cleanup();
  };

  function open({ reference, side = "bottom", align = "start", offset = 6, focus = "first" } = {}) {
    if (typeof el.showPopover !== "function") return;
    scan();
    if (!isOpen(el)) {
      try {
        el.showPopover(trigger ? { source: trigger } : undefined);
      } catch {
        return;
      }
    }
    if (trigger) put(trigger, "aria-expanded", "true");
    release?.();
    release = anchor(el, reference ?? trigger, { side, align, offset });
    nav.refresh();
    if (focus === "first") nav.focus(0);
    else if (focus === "last") nav.focus(nav.items().length - 1);
    else if (focus === "menu") el.focus({ preventScroll: true });
  }

  function close() {
    clearTimers();
    sub?.close();
    if (isOpen(el)) el.hidePopover();
  }

  el.addEventListener("keydown", onKeyFirst);
  const nav = roving(el, {
    items: itemsOf,
    orientation: "vertical",
    loop: true,
    typeahead: true,
    // Moving off a submenu trigger by keyboard closes that submenu.
    onMove: (item) => {
      if (sub && sub.trigger !== item) sub.close();
    },
  });
  el.addEventListener("keydown", onKey);
  el.addEventListener("click", onClick);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerenter", onPointerEnter);
  el.addEventListener("pointerleave", onPointerLeave);
  el.addEventListener("beforetoggle", onBeforeToggle);

  const api = {
    el,
    get trigger() {
      return trigger;
    },
    open,
    close,
    isOpen: () => isOpen(el),
    contains: (node) => !!node && (el.contains(node) || !!sub?.contains(node)),
    hold: () => clearTimeout(closeTimer),
    childClosed: (p) => {
      if (sub === p) sub = null;
    },
    destroy() {
      close();
      clearTimers();
      release?.();
      nav.destroy();
      el.removeEventListener("keydown", onKeyFirst);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("click", onClick);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerenter", onPointerEnter);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("beforetoggle", onBeforeToggle);
      for (const p of subs.values()) p.destroy();
      subs.clear();
      marks.undo();
    },
  };

  scan();
  return api;
}

/* ------------------------------------------------------------------ */

export function menu(trigger, menuEl, options = {}) {
  if (typeof document === "undefined" || !trigger || !menuEl) return inert(menuEl);
  const { side = "bottom", align = "start", offset = 6 } = options;

  const marks = ledger();
  marks.id(trigger);
  marks.set(trigger, "aria-haspopup", "menu");
  marks.set(trigger, "aria-expanded", "false");
  marks.set(trigger, "aria-controls", marks.id(menuEl));
  if (!labelled(menuEl)) marks.set(menuEl, "aria-labelledby", trigger.id);

  const owner = {
    dismiss() {
      const inside = root.contains(document.activeElement);
      root.close();
      if (inside) trigger.focus();
    },
  };
  const root = panel(menuEl, { trigger, owner });

  const open = (focus = "first") => {
    if (disabled(trigger)) return;
    root.open({ reference: trigger, side, align, offset, focus });
  };

  // A press on the trigger light-dismisses an open menu before the click
  // lands; remember it was open so the click does not reopen it.
  let wasOpen = false;
  const onPointerDown = () => {
    wasOpen = root.isOpen();
  };

  const onClick = (e) => {
    const was = wasOpen;
    wasOpen = false;
    if (was || root.isOpen()) owner.dismiss();
    else open(e.detail === 0 ? "first" : "menu");
  };

  const onKeyDown = (e) => {
    if (!plain(e) || e.shiftKey) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") open("first");
    else if (e.key === "ArrowUp") open("last");
    else return;
    e.preventDefault();
  };

  trigger.addEventListener("pointerdown", onPointerDown);
  trigger.addEventListener("click", onClick);
  trigger.addEventListener("keydown", onKeyDown);

  return {
    el: menuEl,
    open,
    close: () => owner.dismiss(),
    isOpen: () => root.isOpen(),
    destroy() {
      trigger.removeEventListener("pointerdown", onPointerDown);
      trigger.removeEventListener("click", onClick);
      trigger.removeEventListener("keydown", onKeyDown);
      root.destroy();
      marks.undo();
    },
  };
}

export function contextMenu(target, menuEl, options = {}) {
  if (typeof document === "undefined" || !target || !menuEl) return inert(menuEl);
  const { offset = 2 } = options;

  let returnTo = null;
  let keyAt = -Infinity;
  let context = null;

  const restore = () => {
    const back = returnTo?.isConnected && returnTo !== document.body ? returnTo : target;
    back.focus?.({ preventScroll: true });
  };

  // Bumped by every deliberate close, so a pending right-click reopen
  // (below) can tell a light dismiss from the user choosing something.
  let gesture = 0;

  const owner = {
    dismiss() {
      gesture++;
      const inside = root.contains(document.activeElement);
      root.close();
      if (inside) restore();
    },
  };
  const root = panel(menuEl, { owner });

  const openAt = (reference, focus, on) => {
    if (!root.isOpen()) returnTo = document.activeElement;
    context = on;
    root.open({ reference, side: "bottom", align: "start", offset, focus });
  };

  const onContextMenu = (e) => {
    if (e.defaultPrevented) return;
    e.preventDefault();
    // The keyboard path already opened it; this is the same gesture.
    if (e.timeStamp - keyAt < 600) return;
    const at = point(e.clientX, e.clientY);
    const on = e.target.nodeType === 1 ? e.target : e.target.parentElement;
    openAt(at, "menu", on);
    // Where contextmenu fires on press (Linux, macOS), the release that
    // follows is a pointerup outside the menu, and popover="auto" light-
    // dismisses on it. Put the menu back: at once if the dismissal has
    // already run, else on the next task. While a button is held no other
    // pointerup can arrive, so the next one is this press's release. A
    // deliberate close or a new press before then cancels it.
    if (e.buttons) {
      const token = ++gesture;
      const reopen = () => {
        if (token !== gesture || root.isOpen()) return;
        const back = returnTo;
        openAt(at, "menu", on);
        returnTo = back;
      };
      window.addEventListener(
        "pointerup",
        () => {
          reopen();
          const cancel = () => {
            if (token === gesture) gesture++;
          };
          window.addEventListener("pointerdown", cancel, { once: true, capture: true });
          setTimeout(() => {
            reopen();
            cancel();
            window.removeEventListener("pointerdown", cancel, { capture: true });
          });
        },
        { once: true, capture: true }
      );
    }
  };

  const onKeyDown = (e) => {
    if (e.defaultPrevented) return;
    const f10 = e.key === "F10" && e.shiftKey && plain(e);
    if (e.key !== "ContextMenu" && !f10) return;
    e.preventDefault();
    keyAt = e.timeStamp;
    const a = document.activeElement;
    const on = target.contains(a) ? a : target;
    openAt(on, "first", on);
  };

  target.addEventListener("contextmenu", onContextMenu);
  target.addEventListener("keydown", onKeyDown);

  return {
    el: menuEl,
    open: (focus = "first") => openAt(target, focus, target),
    /* The element the menu was last opened on: the one right-clicked,
       or the one focused when the key was pressed. */
    get context() {
      return context;
    },
    close: () => owner.dismiss(),
    isOpen: () => root.isOpen(),
    destroy() {
      target.removeEventListener("contextmenu", onContextMenu);
      target.removeEventListener("keydown", onKeyDown);
      root.destroy();
    },
  };
}

export function menubar(el) {
  if (typeof document === "undefined" || !el) return inert(el);
  const marks = ledger();
  if (!el.hasAttribute("role")) marks.set(el, "role", "menubar");

  const entries = new Map();
  let active = null;

  const owner = {
    dismiss() {
      const item = active;
      if (!item) return;
      const inside = entries.get(item).contains(document.activeElement);
      entries.get(item).close();
      if (inside) nav.focus(item);
    },
    // Left/Right from inside an open menu: close it, open the neighbour.
    edge(dir) {
      const from = active;
      if (!from) return;
      const list = nav.items();
      const to = list[(list.indexOf(from) + dir + list.length) % list.length];
      entries.get(from).close();
      openItem(to, "first");
    },
    closed(p) {
      if (active && entries.get(active) === p) active = null;
    },
  };

  const wire = (item, menuEl = popupFor(item)) => {
    if (!menuEl) return;
    marks.id(item);
    marks.set(item, "aria-haspopup", "menu");
    marks.set(item, "aria-expanded", "false");
    marks.set(item, "aria-controls", marks.id(menuEl));
    if (!labelled(menuEl)) marks.set(menuEl, "aria-labelledby", item.id);
    entries.set(item, panel(menuEl, { trigger: item, owner }));
  };

  const unwire = (item) => {
    const p = entries.get(item);
    if (active === item) active = null;
    p.destroy();
    entries.delete(item);
    marks.undo(item);
    marks.undo(p.el);
  };

  for (const item of itemsOf(el)) wire(item);

  const nav = roving(el, { items: itemsOf, orientation: "horizontal", loop: true, typeahead: true });

  // Entries the app added, removed or re-pointed at another menu.
  const refresh = () => {
    const items = itemsOf(el);
    for (const [item, p] of entries) {
      // Resolved before unwiring: the undo must not bring back the old target.
      const to = items.includes(item) ? popupFor(item) : null;
      if (to === p.el) continue;
      unwire(item);
      if (to) wire(item, to);
    }
    for (const item of items) if (!entries.has(item)) wire(item);
    nav.refresh();
  };

  const touches = (node) =>
    node.nodeType === 1 && (node.matches(`${ITEM}, [role="menu"]`) || !!node.querySelector(`${ITEM}, [role="menu"]`));
  const observer =
    typeof MutationObserver === "function"
      ? new MutationObserver((records) => {
          const relevant = records.some((r) =>
            r.type === "attributes" ? r.target.matches(ITEM) : [...r.addedNodes, ...r.removedNodes].some(touches),
          );
          if (relevant) refresh();
        })
      : null;
  // An entry re-pointed at another menu is an aria-controls change only.
  // This module's own writes land here too; refresh() finds nothing to do.
  observer?.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-controls"] });

  function openItem(item, focus) {
    if (!item) return;
    const p = entries.get(item);
    if (!p || disabled(item)) {
      nav.focus(item);
      return;
    }
    nav.setCurrent(item);
    if (active && active !== item) entries.get(active).close();
    active = item;
    p.open({ reference: item, side: "bottom", align: "start", offset: 4, focus });
  }

  const barItem = (e) => {
    if (menuOf(e.target) !== el) return null;
    const item = e.target.closest(ITEM);
    return item && entries.has(item) ? item : null;
  };

  const onKey = (e) => {
    if (e.defaultPrevented || !plain(e) || e.shiftKey) return;
    const item = barItem(e);
    if (!item) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") openItem(item, "first");
    else if (e.key === "ArrowUp") openItem(item, "last");
    else if (e.key === "Escape" && active) owner.dismiss();
    else return;
    e.preventDefault();
  };

  let wasOpen = null;
  const onPointerDown = (e) => {
    wasOpen = barItem(e) && active === barItem(e) ? active : null;
  };

  const onClick = (e) => {
    const item = barItem(e);
    const was = wasOpen;
    wasOpen = null;
    if (!item) return;
    if (was === item || active === item) owner.dismiss();
    else openItem(item, e.detail === 0 ? "first" : "menu");
  };

  // With one menu open, sweeping the pointer along the bar switches menus.
  const onPointerOver = (e) => {
    if (e.pointerType === "touch" || !active) return;
    const item = barItem(e);
    if (item && item !== active) openItem(item, "menu");
  };

  el.addEventListener("keydown", onKey);
  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("click", onClick);
  el.addEventListener("pointerover", onPointerOver);

  return {
    el,
    close: () => owner.dismiss(),
    refresh,
    destroy() {
      observer?.disconnect();
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("click", onClick);
      el.removeEventListener("pointerover", onPointerOver);
      nav.destroy();
      for (const p of entries.values()) p.destroy();
      entries.clear();
      marks.undo();
    },
  };
}
