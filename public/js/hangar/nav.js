/**
 * Navigation behaviour — the app-shell sidebar, the top navigation menu
 * and the breadcrumb overflow. No framework, no dependency.
 *
 *   import { sidebar, navMenu, breadcrumb } from "@valeness/hangar/nav";
 *
 *   const shell = sidebar(document.querySelector(".hud-shell"), {
 *     toggle: document.querySelector(".hud-sidebar-toggle"),
 *     storageKey: "app.sidebar",
 *   });
 *   shell.toggle();          // or toggle(true) / toggle(false)
 *   shell.setExpanded(false); // from app state: no event
 *   shell.expanded;          // boolean
 *   shell.destroy();
 *
 *   const menu = navMenu(document.querySelector(".hud-navmenu"));
 *   const crumbs = breadcrumb(document.querySelector(".hud-breadcrumb"));
 *
 * SIDEBAR. The toggle collapses the sidebar to its icon rail on wide
 * screens and slides it out as a drawer on narrow ones (the `narrow`
 * media query, default "(max-width: 720px)" — the same breakpoint
 * sidebar.css uses; change both together).
 *
 *   toggle      element or list of elements; each gets aria-controls,
 *               aria-expanded and aria-keyshortcuts
 *   storageKey  remember the rail state in localStorage under this key
 *               (the drawer always starts closed)
 *   shortcut    Ctrl/Cmd + this key toggles; false to turn it off.
 *               Default "b". Ignored while typing in contenteditable
 *   narrow      media query for drawer mode
 *
 * Rail: data-collapsed on the shell, persisted. Hovering or focusing a
 * railed item shows its label beside it; clicking a nested group's
 * summary expands the sidebar and opens the group. Drawer:
 * data-drawer="open" on the shell, the main column is made inert,
 * focus moves to the current item, and Escape or a click outside
 * closes it and hands focus back to the toggle.
 *
 * Items with aria-disabled="true" stay focusable but are not followed.
 * Fires "hud-sidebar" on the shell: detail { expanded, mode }, mode
 * "docked" or "drawer". toggle() fires it; setExpanded(expanded) is
 * for pushing app state in and does not — otherwise it does exactly
 * what toggle(expanded) does: in docked mode it sets the rail and
 * stores it under storageKey, in drawer mode it opens or closes the
 * drawer and moves focus. Returns { toggle(force?),
 * setExpanded(expanded), expanded, destroy() }. destroy() removes the
 * listeners and the name tag, closes the drawer, un-inerts the main
 * column and restores every attribute it set on the toggles and the
 * sidebar; data-collapsed stays as it stands.
 *
 * Frameworks: sidebar() owns data-drawer on the shell and
 * aria-controls / aria-expanded on the toggles, so do not render those.
 * data-collapsed may be rendered (server-side, from the stored
 * preference) as the starting state; after that, follow hud-sidebar
 * into app state and push app state back with setExpanded(). The shell
 * and toggles must be the same elements for the handle's life —
 * re-create it if the app swaps them. The name tag is the one node it
 * adds: a popover appended as the shell's last child, which React and
 * Vue step around (they insert relative to their own nodes).
 *
 * NAVIGATION MENU. Triggers are buttons with popovertarget, so opening,
 * Escape and light dismiss are the browser's. navMenu() adds placement
 * (js/anchor.js), aria-expanded, one panel at a time, and the optional
 * keys of the WAI-ARIA disclosure navigation pattern: Left/Right move
 * along the bar (mirrored under rtl), Down/Up on a trigger open its
 * panel at the first/last link, arrows move within a panel, Home/End
 * jump, Escape closes and returns focus to the trigger. A panel closes
 * when focus leaves it and its trigger, or one of its links is followed;
 * an aria-disabled link is not followed. Fires
 * "hud-navmenu" on the nav: detail { open, trigger, panel }. Returns
 * { close(), destroy() }.
 *
 * BREADCRUMB. breadcrumb() places the "…" overflow list under its
 * button, keeps aria-expanded, and gives the list Up/Down/Home/End and
 * Escape. Returns { destroy() }. It never folds the path itself: the
 * "…" item and its list are your markup, so render them from the route.
 *
 * navMenu() and breadcrumb() move, hide and create nothing. They watch
 * the nav's subtree (a MutationObserver), so triggers and panels a
 * framework adds, replaces or removes are wired and unwired as they
 * come and go — no refresh call. A panel is expected inside the nav,
 * next to its trigger. A panel that is open while its trigger is
 * re-rendered stays open and is re-anchored to the new trigger at once.
 * destroy() closes any open panel and restores aria-expanded,
 * aria-controls and any generated panel id.
 *
 * Every function is SSR-safe: with no DOM it returns inert handles.
 */

import { anchor } from "./anchor.js";

const hasDom = () => typeof document !== "undefined";

/* localStorage throws in some privacy contexts, and returns null in
   plenty of ordinary ones. Neither is exceptional. */
function readStored(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

let uid = 0;

/* Attributes written onto the app's markup, each with the value it had
   before the first write, so destroy() can hand the markup back as it
   was rendered. */
function ledger() {
  const saved = new Map();
  const set = (el, name, value) => {
    let attrs = saved.get(el);
    if (!attrs) saved.set(el, (attrs = new Map()));
    if (!attrs.has(name)) attrs.set(name, el.getAttribute(name));
    el.setAttribute(name, value);
  };
  return {
    set,
    id(el, prefix) {
      if (!el.id) set(el, "id", `${prefix}-${++uid}`);
      return el.id;
    },
    restore() {
      for (const [el, attrs] of saved) {
        for (const [name, was] of attrs) {
          if (was === null) el.removeAttribute(name);
          else el.setAttribute(name, was);
        }
      }
      saved.clear();
    },
  };
}

const isRtl = (el) => getComputedStyle(el).direction === "rtl";
const shown = (el) => el.getClientRects().length > 0;
const asList = (x) => (!x ? [] : typeof Element !== "undefined" && x instanceof Element ? [x] : [...x]);

const FOCUSABLE =
  'a[href], button:not([disabled]), summary, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusables = (root) => [...root.querySelectorAll(FOCUSABLE)].filter(shown);

const canPopover = () => typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;
const isOpen = (panel) => {
  try {
    return panel.matches(":popover-open");
  } catch {
    return false;
  }
};

/* One trigger → one popover panel: aria-expanded, and placement by
   anchor(). The panel is placed three times on the way open: as it is
   about to show (unmeasured, so right for the common case), in the
   first animation frame — rAF runs before the browser paints, so the
   first painted frame has the real size — and on the toggle event, in
   case frames are throttled (a background tab). A panel already open
   when it is wired (its trigger was just re-rendered) is placed at
   once. Returns cleanup(closeOpen = true): anchor()'s release puts the
   panel back at its UA position, so an open panel is closed first —
   unless closeOpen is false, for a panel that is re-wired straight
   away to a new trigger. */
function disclose(trigger, panel, placement, onToggle) {
  let release = null;
  let frame = 0;
  const attrs = ledger();

  attrs.set(trigger, "aria-expanded", String(isOpen(panel)));
  attrs.set(trigger, "aria-controls", attrs.id(panel, "hud-panel"));

  const place = () => {
    release?.();
    release = anchor(panel, trigger, placement);
  };
  if (isOpen(panel)) place();

  const onBefore = (e) => {
    if (e.newState !== "open") return;
    place();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (isOpen(panel)) place();
    });
  };

  const onChange = (e) => {
    const open = e.newState === "open";
    trigger.setAttribute("aria-expanded", String(open));
    if (open && isOpen(panel)) place();
    if (!open) {
      cancelAnimationFrame(frame);
      release?.();
      release = null;
    }
    onToggle?.(open);
  };

  panel.addEventListener("beforetoggle", onBefore);
  panel.addEventListener("toggle", onChange);

  return (closeOpen = true) => {
    panel.removeEventListener("beforetoggle", onBefore);
    panel.removeEventListener("toggle", onChange);
    cancelAnimationFrame(frame);
    if (closeOpen) close(panel);
    release?.();
    attrs.restore();
  };
}

/* Every trigger matching `selector` under `root`, paired with its panel
   and wired by `wire` (which returns a disclose() cleanup). A framework
   re-rendering the items adds, replaces and drops triggers and panels,
   so the pairs are re-read whenever the subtree's children or a
   popovertarget change. Stale pairs are unwired before new ones are
   wired, so a panel that moves to a new trigger is released and
   re-anchored in the same task, never painted in between. */
function disclosures(root, selector, wire) {
  const live = new Map(); // trigger → { panel, cleanup }
  const refresh = () => {
    const next = new Map();
    for (const trigger of root.querySelectorAll(selector)) {
      const panel = targetOf(trigger);
      if (panel) next.set(trigger, panel);
    }
    const kept = new Set(next.values());
    for (const [trigger, { panel, cleanup }] of live) {
      if (next.get(trigger) === panel) continue;
      cleanup(!kept.has(panel));
      live.delete(trigger);
    }
    for (const [trigger, panel] of next) {
      if (!live.has(trigger)) live.set(trigger, { panel, cleanup: wire(trigger, panel) });
    }
  };
  refresh();
  const observer = typeof MutationObserver === "function" ? new MutationObserver(refresh) : null;
  observer?.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["popovertarget"] });
  return {
    pairs: () => [...live].map(([trigger, { panel }]) => [trigger, panel]),
    destroy() {
      observer?.disconnect();
      for (const { cleanup } of live.values()) cleanup();
      live.clear();
    },
  };
}

/* The panel a popovertarget button opens. popoverTargetElement only
   resolves in a connected document, so a subtree wired before it is
   mounted falls back to a lookup within its own root. */
const targetOf = (trigger) => {
  if (trigger.popoverTargetElement) return trigger.popoverTargetElement;
  const id = trigger.getAttribute("popovertarget");
  if (!id) return null;
  let root = trigger;
  while (root.parentNode) root = root.parentNode;
  return root.getElementById?.(id) ?? root.querySelector?.(`#${CSS.escape(id)}`) ?? null;
};

/* aria-disabled keeps an item focusable and named; activating it is
   what has to be stopped. */
const refuseDisabled = (e) => {
  const el = e.target instanceof Element ? e.target.closest('[aria-disabled="true"]') : null;
  if (!el) return false;
  e.preventDefault();
  return true;
};

const open = (panel, trigger) => {
  if (isOpen(panel)) return;
  try {
    panel.showPopover({ source: trigger });
  } catch {
    /* already shown by another path, or not a popover */
  }
};

const close = (panel) => {
  if (!isOpen(panel)) return;
  try {
    panel.hidePopover();
  } catch {
    /* ignore */
  }
};

/* Arrow keys within a panel of links. Returns true when handled. */
function panelKeys(e, panel, trigger, rtl) {
  if (e.key === "Escape") {
    e.preventDefault();
    close(panel);
    trigger.focus();
    return true;
  }
  const links = focusables(panel);
  const i = links.indexOf(e.target);
  if (i < 0) return false;
  const next = rtl ? "ArrowLeft" : "ArrowRight";
  const prev = rtl ? "ArrowRight" : "ArrowLeft";
  let to;
  if (e.key === "ArrowDown" || e.key === next) to = links[i + 1];
  else if (e.key === "ArrowUp" || e.key === prev) to = links[i - 1];
  else if (e.key === "Home") to = links[0];
  else if (e.key === "End") to = links.at(-1);
  else return false;
  e.preventDefault();
  to?.focus();
  return true;
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

export function sidebar(shell, options = {}) {
  const inert = { toggle() {}, setExpanded() {}, get expanded() { return true; }, destroy() {} };
  if (!hasDom() || !shell) return inert;

  const child = (cls) => [...shell.children].find((el) => el.classList.contains(cls)) ?? null;
  const bar = child("hud-sidebar");
  if (!bar) return inert;

  const { toggle, storageKey, shortcut = "b", narrow = "(max-width: 720px)" } = options;
  const main = child("hud-shell-main");
  const toggles = asList(toggle);
  const mq = typeof globalThis.matchMedia === "function" ? globalThis.matchMedia(narrow) : null;
  const key = typeof shortcut === "string" && shortcut ? shortcut.toLowerCase() : null;

  const stored = storageKey ? readStored(storageKey) : null;
  let collapsed = stored === "collapsed" ? true : stored === "expanded" ? false : shell.hasAttribute("data-collapsed");
  let drawerOpen = false;
  let inerted = false;

  const drawer = () => !!mq?.matches;
  const expanded = () => (drawer() ? drawerOpen : !collapsed);

  const attrs = ledger();
  attrs.id(bar, "hud-sidebar");
  for (const t of toggles) {
    attrs.set(t, "aria-controls", bar.id);
    if (key && !t.hasAttribute("aria-keyshortcuts")) {
      attrs.set(t, "aria-keyshortcuts", `Control+${key.toUpperCase()} Meta+${key.toUpperCase()}`);
    }
  }

  const render = () => {
    shell.toggleAttribute("data-collapsed", collapsed);
    const out = drawer() && drawerOpen;
    if (out) shell.setAttribute("data-drawer", "open");
    else shell.removeAttribute("data-drawer");
    if (main && (out || inerted)) {
      main.inert = out;
      inerted = out;
    }
    const state = String(expanded());
    for (const t of toggles) attrs.set(t, "aria-expanded", state);
  };

  /* ---- rail name tag ---- */
  let flyout = null;
  let flyoutFor = null;
  let releaseFlyout = null;
  let hideTimer = 0;

  const hideFlyout = () => {
    clearTimeout(hideTimer);
    releaseFlyout?.();
    releaseFlyout = null;
    flyoutFor = null;
    if (flyout) close(flyout);
  };

  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideFlyout, 120);
  };

  const showFlyout = (item) => {
    if (!canPopover() || drawer() || !collapsed) return;
    const text = item.querySelector(".hud-sidebar-label")?.textContent.trim();
    if (!text) return;
    clearTimeout(hideTimer);
    if (flyoutFor === item) return;
    if (!flyout) {
      // A sibling of the sidebar, not a child: the rail hides labels
      // and counts inside the sidebar, and this must stay visible.
      flyout = document.createElement("div");
      flyout.className = "hud-sidebar-flyout";
      flyout.setAttribute("popover", "manual");
      flyout.setAttribute("aria-hidden", "true");
      flyout.addEventListener("pointerenter", () => clearTimeout(hideTimer));
      flyout.addEventListener("pointerleave", scheduleHide);
      shell.append(flyout);
    }
    releaseFlyout?.();
    flyout.textContent = text;
    const count = item.querySelector(".hud-sidebar-count")?.textContent.trim();
    if (count) flyout.textContent += ` · ${count}`;
    flyoutFor = item;
    open(flyout);
    releaseFlyout = anchor(flyout, item, { side: isRtl(shell) ? "left" : "right", align: "center", offset: 12 });
  };

  const itemOf = (node) => (node instanceof Element ? node.closest(".hud-sidebar-item") : null);

  const onPointerOver = (e) => {
    const item = itemOf(e.target);
    if (item && bar.contains(item) && e.pointerType !== "touch") showFlyout(item);
  };
  const onPointerOut = (e) => {
    const item = itemOf(e.target);
    if (item && item === flyoutFor && !item.contains(e.relatedTarget)) scheduleHide();
  };
  const onFocusIn = (e) => {
    const item = itemOf(e.target);
    if (item) showFlyout(item);
  };
  const onFocusOut = (e) => {
    if (flyoutFor && flyoutFor.contains(e.target)) hideFlyout();
  };

  /* ---- state ---- */
  const firstStop = () =>
    [...bar.querySelectorAll('[aria-current="page"]')].find(shown) ?? focusables(bar)[0] ?? null;

  const set = (next, silent = false) => {
    if (next === expanded()) return;
    hideFlyout();
    if (drawer()) {
      drawerOpen = next;
      render();
      if (drawerOpen) firstStop()?.focus();
      else if (bar.contains(document.activeElement)) toggles.find(shown)?.focus();
    } else {
      collapsed = !next;
      if (storageKey) writeStored(storageKey, collapsed ? "collapsed" : "expanded");
      render();
    }
    if (silent) return;
    shell.dispatchEvent(
      new CustomEvent("hud-sidebar", {
        bubbles: true,
        detail: { expanded: next, mode: drawer() ? "drawer" : "docked" },
      })
    );
  };

  const onToggleClick = () => set(!expanded());

  const onShortcut = (e) => {
    if (!key || e.defaultPrevented || e.altKey || e.shiftKey || !(e.ctrlKey || e.metaKey)) return;
    if (e.key?.toLowerCase() !== key || e.target?.isContentEditable) return;
    e.preventDefault();
    set(!expanded());
  };

  const onKeyDown = (e) => {
    if (e.key !== "Escape") return;
    if (flyoutFor) {
      hideFlyout();
      return;
    }
    if (drawer() && drawerOpen) {
      e.preventDefault();
      set(false);
    }
  };

  const onPointerDown = (e) => {
    if (drawer() && drawerOpen && !bar.contains(e.target)) set(false);
  };

  // A disabled item does nothing. In the rail a nested group has
  // nowhere to open, so its summary expands the sidebar and opens the
  // group instead.
  const onClick = (e) => {
    if (refuseDisabled(e)) return;
    const summary = e.target instanceof Element ? e.target.closest("summary") : null;
    if (!summary || !bar.contains(summary) || drawer() || !collapsed) return;
    e.preventDefault();
    summary.parentElement.open = true;
    set(true);
  };

  const onMedia = () => {
    drawerOpen = false;
    hideFlyout();
    render();
  };

  for (const t of toggles) t.addEventListener("click", onToggleClick);
  document.addEventListener("keydown", onShortcut);
  document.addEventListener("pointerdown", onPointerDown);
  shell.addEventListener("keydown", onKeyDown);
  bar.addEventListener("click", onClick);
  bar.addEventListener("pointerover", onPointerOver);
  bar.addEventListener("pointerout", onPointerOut);
  bar.addEventListener("focusin", onFocusIn);
  bar.addEventListener("focusout", onFocusOut);
  mq?.addEventListener?.("change", onMedia);

  render();

  return {
    toggle(force) {
      set(typeof force === "boolean" ? force : !expanded());
    },
    setExpanded(next) {
      set(!!next, true);
    },
    get expanded() {
      return expanded();
    },
    destroy() {
      for (const t of toggles) t.removeEventListener("click", onToggleClick);
      document.removeEventListener("keydown", onShortcut);
      document.removeEventListener("pointerdown", onPointerDown);
      shell.removeEventListener("keydown", onKeyDown);
      bar.removeEventListener("click", onClick);
      bar.removeEventListener("pointerover", onPointerOver);
      bar.removeEventListener("pointerout", onPointerOut);
      bar.removeEventListener("focusin", onFocusIn);
      bar.removeEventListener("focusout", onFocusOut);
      mq?.removeEventListener?.("change", onMedia);
      hideFlyout();
      flyout?.remove();
      if (inerted && main) main.inert = false;
      shell.removeAttribute("data-drawer");
      attrs.restore();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Navigation menu                                                     */
/* ------------------------------------------------------------------ */

export function navMenu(nav) {
  if (!hasDom() || !nav) return { close() {}, destroy() {} };

  const closeAll = (except) => {
    for (const [, panel] of pairs()) if (panel !== except) close(panel);
  };

  const wired = disclosures(nav, ".hud-navmenu-trigger[popovertarget]", (trigger, panel) =>
    disclose(trigger, panel, { side: "bottom", align: "start", offset: 6 }, (isOpenNow) => {
      if (isOpenNow) closeAll(panel);
      nav.dispatchEvent(
        new CustomEvent("hud-navmenu", { bubbles: true, detail: { open: isOpenNow, trigger, panel } })
      );
    })
  );
  const pairs = wired.pairs;

  const bar = () =>
    [...nav.querySelectorAll(".hud-navmenu-list > li > :is(.hud-navmenu-link, .hud-navmenu-trigger)")].filter(
      (el) => !el.disabled && shown(el)
    );

  const openAt = (trigger, panel, which) => {
    open(panel, trigger);
    const links = focusables(panel);
    (which === "last" ? links.at(-1) : links[0])?.focus({ preventScroll: true });
  };

  const onKeyDown = (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const rtl = isRtl(nav);

    const inside = pairs().find(([, panel]) => panel.contains(e.target));
    if (inside) {
      panelKeys(e, inside[1], inside[0], rtl);
      return;
    }

    const items = bar();
    const i = items.indexOf(e.target);
    if (i < 0) return;
    const own = pairs().find(([trigger]) => trigger === e.target);
    const next = rtl ? "ArrowLeft" : "ArrowRight";
    const prev = rtl ? "ArrowRight" : "ArrowLeft";

    let to = null;
    switch (e.key) {
      case next: to = items[i + 1]; break;
      case prev: to = items[i - 1]; break;
      case "Home": to = items[0]; break;
      case "End": to = items.at(-1); break;
      case "ArrowDown":
        if (!own) return;
        e.preventDefault();
        openAt(own[0], own[1], "first");
        return;
      case "ArrowUp":
        if (!own) return;
        e.preventDefault();
        openAt(own[0], own[1], "last");
        return;
      case "Escape":
        if (own && isOpen(own[1])) {
          e.preventDefault();
          close(own[1]);
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    if (!to) return;
    closeAll();
    to.focus();
  };

  // Focus leaving a disclosure — Tab past its last link onto the next
  // trigger, or out of the menu altogether — closes its panel. A focus
  // loss with nowhere to go (a click on nothing) is left to light
  // dismiss.
  const onFocusOut = (e) => {
    const to = e.relatedTarget;
    if (!to) return;
    for (const [trigger, panel] of pairs()) {
      if (!trigger.contains(to) && !panel.contains(to)) close(panel);
    }
  };

  const onClick = (e) => {
    if (refuseDisabled(e)) return;
    const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
    const pair = link && pairs().find(([, panel]) => panel.contains(link));
    if (pair) close(pair[1]);
  };

  nav.addEventListener("keydown", onKeyDown);
  nav.addEventListener("focusout", onFocusOut);
  nav.addEventListener("click", onClick);

  return {
    close: () => closeAll(),
    destroy() {
      nav.removeEventListener("keydown", onKeyDown);
      nav.removeEventListener("focusout", onFocusOut);
      nav.removeEventListener("click", onClick);
      wired.destroy();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Breadcrumb                                                          */
/* ------------------------------------------------------------------ */

export function breadcrumb(nav) {
  if (!hasDom() || !nav) return { destroy() {} };

  const wired = disclosures(nav, ".hud-breadcrumb-more [popovertarget]", (trigger, panel) =>
    disclose(trigger, panel, { side: "bottom", align: "start", offset: 6 })
  );
  const pairs = wired.pairs;

  const onKeyDown = (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const inside = pairs().find(([, panel]) => panel.contains(e.target));
    if (inside) {
      panelKeys(e, inside[1], inside[0], isRtl(nav));
      return;
    }
    // Down from the open "…" steps into its list.
    const own = pairs().find(([trigger]) => trigger === e.target);
    if (own && e.key === "ArrowDown") {
      e.preventDefault();
      open(own[1], own[0]);
      focusables(own[1])[0]?.focus({ preventScroll: true });
    }
  };

  nav.addEventListener("keydown", onKeyDown);

  return {
    destroy() {
      nav.removeEventListener("keydown", onKeyDown);
      wired.destroy();
    },
  };
}
