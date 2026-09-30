/**
 * tabs() — the WAI-ARIA tabs pattern over your own markup. No framework,
 * no dependency.
 *
 *   import { tabs } from "@valeness/hangar/tabs";
 *
 *   const t = tabs(document.querySelector(".hud-tabs"), { activation: "automatic" });
 *   root.addEventListener("hud-tabchange", (e) => load(e.detail.panel));
 *   t.select(2);        // or t.select(tabElement)
 *   t.destroy();        // on unmount
 *
 * Markup is the root, one [role=tablist] holding [role=tab] elements, and
 * one [role=tabpanel] per tab — paired by aria-controls where present,
 * otherwise by order. Missing ids, aria-controls and aria-labelledby are
 * generated; aria-selected, the panels' `hidden` and the roving tabindex
 * are kept in sync from then on. A panel with nothing focusable in it is
 * given tabindex="0", so Tab from the tablist lands on its content.
 *
 * Keyboard, per the APG tabs pattern: Left/Right (Up/Down when the tablist
 * has aria-orientation="vertical") move between tabs, wrapping at the
 * ends and swapping Left/Right under direction: rtl; Home/End jump to the
 * ends; disabled tabs (disabled or aria-disabled="true") are skipped.
 *
 * Options:
 *   activation  "automatic" (default) — moving focus selects the tab.
 *               "manual" — arrows only move focus; Enter or Space (or a
 *               click) selects. Use it when showing a panel is expensive.
 *
 * Every change of selection — click, key, select() — dispatches a
 * bubbling `hud-tabchange` CustomEvent on the root with
 * detail { tab, panel, index, previous }. select() is a no-op, returning
 * false, for a disabled tab or the tab already selected.
 *
 * setValue(which) is select() without the event: for pushing a selection
 * the app already holds (framework state, the URL) into the widget. The
 * panels, ARIA and tab stop change as they would for a click (focus stays
 * where it is), and no hud-tabchange fires, so state → widget → state
 * cannot loop.
 *
 * Tabs and panels the app adds, removes or re-renders later are picked
 * up on their own: a MutationObserver on the root re-pairs them, fills
 * in their ids and ARIA, hides the new panels and keeps a single tab
 * stop. If the selected tab is removed, the one marked
 * aria-selected="true" — else the first enabled one — takes over,
 * without an event; push the app's own choice with setValue(). refresh()
 * does the same at once, for code that adds a tab and selects it in the
 * same task. A framework should not render aria-selected, the panels'
 * hidden or the tabs' tabindex — this module owns them. The root and its
 * tablist must outlive the binding: if the framework replaces either,
 * destroy and call tabs() again.
 *
 *   returns { select(which), setValue(which), refresh(), destroy() }
 *
 * destroy() removes the listeners and the observer, and leaves the ARIA
 * state as it is.
 */

import { roving } from "./internal/roving.js";

let uid = 0;

const TAB = '[role="tab"]';
const PANEL = '[role="tabpanel"]';
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"], summary, audio[controls], video[controls]';

const isDisabled = (tab) => tab.disabled === true || tab.getAttribute("aria-disabled") === "true";

/* A node, added or removed, that could change which tabs and panels exist. */
const touches = (node) =>
  node.nodeType === 1 && (node.matches(`${TAB}, ${PANEL}`) || !!node.querySelector(`${TAB}, ${PANEL}`));

const inert = () => ({ select: () => false, setValue: () => false, refresh() {}, destroy() {} });

export function tabs(root, options = {}) {
  if (typeof document === "undefined" || !root) return inert();

  const { activation = "automatic" } = options;
  const manual = activation === "manual";

  const tablist = root.querySelector('[role="tablist"]');
  if (!tablist) return inert();

  const list = () => [...tablist.querySelectorAll(TAB)];

  // Skip any prefix already in the document — server-rendered markup, or
  // a second copy of this module, may have used it.
  let prefix;
  do prefix = `hud-tabs-${++uid}`;
  while (document.querySelector(`[id^="${prefix}-"]`));
  // `-tab-2` may still be taken by a tab that was there before a removal.
  const idFor = (kind, i) => {
    let id = `${prefix}-${kind}-${i}`;
    for (let k = i; document.getElementById(id); ) id = `${prefix}-${kind}-${++k}`;
    return id;
  };
  let panelOf = new Map();

  // Pair every tab with its panel and fill in what the markup left out.
  // Idempotent, so it runs again whenever the tabs or panels change.
  const pair = () => {
    // A nested tabs widget's panels live inside one of ours: keep only the
    // outermost panels under this root.
    const candidates = [...root.querySelectorAll(PANEL)];
    const ours = candidates.filter((p) => !candidates.some((q) => q !== p && q.contains(p)));
    const next = new Map();

    list().forEach((tab, i) => {
      if (!tab.id) tab.id = idFor("tab", i);
      if (tab.localName === "button" && !tab.hasAttribute("type")) tab.type = "button";

      const byId = tab.getAttribute("aria-controls");
      const panel = (byId && document.getElementById(byId)) || ours[i] || null;
      if (!panel) return;

      if (!panel.id) panel.id = idFor("panel", i);
      if (byId !== panel.id) tab.setAttribute("aria-controls", panel.id);
      if (!panel.hasAttribute("aria-labelledby") && !panel.hasAttribute("aria-label")) {
        panel.setAttribute("aria-labelledby", tab.id);
      }
      if (!panelOf.has(tab) && !panel.hasAttribute("tabindex") && !panel.querySelector(FOCUSABLE)) panel.tabIndex = 0;
      next.set(tab, panel);
    });
    panelOf = next;
  };

  pair();

  let selected = null;

  // Where Tab re-enters the tablist: always the selected tab, even after
  // manual mode has left focus on another one. `nav` is created below;
  // this only runs after it exists.
  const parkTabStop = () => nav.setCurrent(selected);

  // Scroll an overflowing tablist so the tab is fully in view, with a
  // sliver of its neighbour showing past it as a cue that more follow.
  // Done by hand: focus() leaves a half-visible tab where it is, and
  // scrollIntoView() would scroll the page too.
  const PEEK = 24;
  const vertical = tablist.getAttribute("aria-orientation") === "vertical";
  const reveal = (tab) => {
    const t = tab.getBoundingClientRect();
    const c = tablist.getBoundingClientRect();
    if (vertical) {
      const end = c.top + tablist.clientHeight - PEEK;
      if (t.top < c.top + PEEK) tablist.scrollTop -= c.top + PEEK - t.top;
      else if (t.bottom > end) tablist.scrollTop += t.bottom - end;
    } else {
      const end = c.left + tablist.clientWidth - PEEK;
      if (t.left < c.left + PEEK) tablist.scrollLeft -= c.left + PEEK - t.left;
      else if (t.right > end) tablist.scrollLeft += t.right - end;
    }
  };

  const apply = (target) => {
    for (const tab of list()) {
      const on = tab === target;
      tab.setAttribute("aria-selected", String(on));
      const panel = panelOf.get(tab);
      if (panel) panel.hidden = !on;
    }
    selected = target;
  };

  const choose = (which, notify) => {
    const all = list();
    const tab = typeof which === "number" ? all[which] : which;
    if (!tab || !all.includes(tab) || isDisabled(tab) || tab === selected) return false;
    // Added in this task, before the observer has seen it.
    if (!panelOf.has(tab)) pair();

    const previous = selected;
    apply(tab);
    if (!tablist.contains(document.activeElement)) {
      parkTabStop();
      reveal(tab);
    }
    if (notify) {
      root.dispatchEvent(
        new CustomEvent("hud-tabchange", {
          bubbles: true,
          detail: { tab, panel: panelOf.get(tab) ?? null, index: all.indexOf(tab), previous },
        }),
      );
    }
    return true;
  };

  const select = (which) => choose(which, true);

  const initial = () => {
    const all = list();
    return (
      all.find((t) => t.getAttribute("aria-selected") === "true" && !isDisabled(t)) ??
      all.find((t) => !isDisabled(t)) ??
      null
    );
  };

  apply(initial());

  const nav = roving(tablist, {
    items: TAB,
    orientation: vertical ? "vertical" : "horizontal",
    initial: (el) => el === selected,
    onMove: (el) => {
      reveal(el);
      if (!manual) select(el);
    },
  });
  if (selected) reveal(selected);

  const onClick = (e) => {
    const tab = e.target.closest?.(TAB);
    if (!tab || !tablist.contains(tab)) return;
    select(tab);
    reveal(tab);
  };

  // A <button> tab turns Enter/Space into a click on its own; anything
  // else needs them handled here.
  const onKeyDown = (e) => {
    if (e.defaultPrevented || (e.key !== "Enter" && e.key !== " ")) return;
    const tab = e.target.closest?.(TAB);
    if (!tab || !tablist.contains(tab) || tab.localName === "button") return;
    e.preventDefault();
    select(tab);
  };

  const onFocusOut = (e) => {
    if (!tablist.contains(e.relatedTarget)) parkTabStop();
  };

  const refresh = () => {
    pair();
    apply(selected && list().includes(selected) ? selected : initial());
    nav.refresh();
    if (!tablist.contains(document.activeElement)) parkTabStop();
  };

  const observer =
    typeof MutationObserver === "function"
      ? new MutationObserver((records) => {
          const relevant = records.some((r) =>
            r.type === "attributes" ? r.target.matches(TAB) : [...r.addedNodes, ...r.removedNodes].some(touches),
          );
          if (relevant) refresh();
        })
      : null;
  // Only what the app changes: every attribute this module writes is
  // left out, so its own writes never wake the observer.
  observer?.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "aria-disabled"],
  });

  tablist.addEventListener("click", onClick);
  tablist.addEventListener("keydown", onKeyDown);
  tablist.addEventListener("focusout", onFocusOut);

  return {
    select,
    setValue: (which) => choose(which, false),
    refresh,
    destroy() {
      observer?.disconnect();
      nav.destroy();
      tablist.removeEventListener("click", onClick);
      tablist.removeEventListener("keydown", onKeyDown);
      tablist.removeEventListener("focusout", onFocusOut);
    },
  };
}
