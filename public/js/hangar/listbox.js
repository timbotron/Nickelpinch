/**
 * select(), combobox(), command(), commandShortcut() — the listbox
 * pickers. No framework, no dependency beyond anchor().
 *
 *   import { select, combobox, command, commandShortcut } from "@valeness/hangar/listbox";
 *
 *   const region = select(trigger, listbox, { onChange: ({ value }) => load(value) });
 *   const team = combobox(input, listbox, { multiple: true });
 *   const palette = command(root, { onSelect: ({ value }) => run(value) });
 *   const stop = commandShortcut(dialog, { key: "k" });
 *
 * All three follow the WAI-ARIA Authoring Practices combobox pattern.
 * Focus never leaves the trigger or input: the option under the cursor
 * is tracked with aria-activedescendant and marked .is-active, and the
 * chosen one carries aria-selected="true". Options are
 * [role="option"] elements (.hud-pop-opt) with an optional data-value
 * (default: the text of .hud-pop-opt-label, else the option's text)
 * and aria-disabled="true" to skip them. Missing ids are generated.
 * Options are read live, never cached: add, remove, replace, re-label,
 * re-value or (dis)able them at any time — by hand or by a framework's
 * re-render — and a MutationObserver re-syncs. refresh() re-syncs by
 * hand after anything else (aria-selected you wrote yourself, say).
 *
 * SELECT — the select-only combobox. `trigger` is a <button> with a
 * .hud-select-trigger-value span; `listbox` sits in a
 * .hud-pop[popover]. Keys, closed: ↓ / Alt+↓ / Enter / Space open on
 * the selected option, ↑ and Home open on the first, End on the last,
 * a printable key opens on the first match. Open: ↑ ↓, Home, End,
 * PageUp/PageDown (10 rows), typeahead; Enter, Space, Alt+↑ and Tab
 * choose and close; Esc closes without choosing. The value is mirrored
 * into a hidden <input> for forms — `options.input`, else the
 * trigger's next sibling if it is an input[type=hidden] — and a form
 * reset restores the initial choice.
 *
 *   onChange(detail)   also dispatched as `hud-change` on the trigger;
 *                      detail = { value, label, option }
 *   returns { value, setValue(v), open(), close(), refresh(), destroy() }
 *   setValue(value) chooses the option with that data-value (null
 *   clears) exactly as a pick would, but fires neither onChange nor
 *   `hud-change`. A value whose option is not rendered yet is held and
 *   taken when the option appears. select() owns the text of
 *   .hud-select-trigger-value — render it empty; if it is missing it is
 *   created, and removed again on destroy.
 *
 * COMBOBOX — an editable combobox with a listbox popup,
 * aria-autocomplete="list". Typing opens and filters (the first match
 * becomes active); ↓ / ↑ open on the selected / last option, Alt+↓
 * opens without moving, Alt+↑ closes, PageUp/PageDown step 10; Home and
 * End stay the input's caret keys. Enter picks. Esc closes the popup;
 * pressed again it clears the input. Leaving the field puts the chosen
 * label back if the text was edited away from it (the value always
 * comes from the list). An optional .hud-combobox-toggle button in the
 * field opens and closes it.
 *
 *   filter(option, query) → boolean   default: every word of the query
 *                      occurs in the label or data-keywords, ignoring
 *                      case and accents. `false` turns filtering off,
 *                      for results you render yourself (async).
 *   multiple           picks toggle and render as .hud-chip elements in
 *                      `chipsRoot` (default: the input's
 *                      .hud-field--chips), kept together before the
 *                      input. The popup stays open; Backspace in an
 *                      empty input removes the last chip; a chip's ×
 *                      removes it and focus moves to the next chip, else
 *                      the input. Changes are announced through a
 *                      visually hidden status. destroy() removes the
 *                      chips it created.
 *   renderChips        with multiple, `false` leaves the chips to you:
 *                      render one .hud-chip[data-value] (holding a
 *                      .hud-chip-x button) per selected value. combobox()
 *                      then never adds or removes a chip; it still
 *                      handles × and Backspace, moves focus, announces,
 *                      and reports the new `values` in `hud-change`.
 *                      Default true.
 *   onSelect(detail)   on every pick from the list; detail = { value,
 *                      label, option } plus { selected, values } when
 *                      multiple. A chip's × is not a pick: for the
 *                      whole selection, listen to `hud-change`.
 *   messages           { empty, added(label), removed(label), remove(label) }
 *                      — the English defaults, for translation.
 *   `hud-change` fires on the input whenever the user changes the
 *   selection, and on clear(); detail = { value, label, option } (all
 *   null when cleared) plus { selected, values } when multiple.
 *   returns { value, values, setValue(v), setValues(values), open(),
 *             close(), refresh(), clear(), status(state, text), destroy() }
 *   setValues(values) selects exactly these values (single mode: the
 *   first) — input text, chips and aria-selected follow — without
 *   onSelect, `hud-change` or an announcement; values that stay keep
 *   their place. setValue(v) is setValues([v]); null or [] clears. A
 *   value is an option's data-value, or { value, label } for one that
 *   is not rendered (async results); a bare value with no option shows
 *   as itself until its option appears.
 *   status("loading" | "error" | "idle", text?) drives the popup's
 *   .hud-pop-msg (a role="status" line, created if missing) and
 *   aria-busy on the listbox. With nothing to show and no status, the
 *   message is the `empty` text (default: the message's data-empty, else
 *   "No matches").
 *
 * COMMAND — the palette. `root` is a .hud-command holding a
 * .hud-command-input and a [role="listbox"]. The first match is always
 * active; ↑ ↓ wrap, PageUp/PageDown step 10, Enter or a click runs it,
 * Esc clears the query (and, once empty, is left to the dialog to
 * close). The empty state's text is .hud-command-empty's data-empty,
 * with {query} replaced — default "No matching commands".
 *
 *   onSelect(detail, event)   also dispatched as `hud-select` on root;
 *                      detail = { value, label, option }. Inside a
 *                      <dialog> the dialog closes afterwards unless the
 *                      event is cancelled (event.preventDefault()).
 *   filter(option, query) → boolean   as in combobox(); `false` turns
 *                      filtering off.
 *   Inside a dialog, a click on the backdrop closes it, and the query
 *   is reset whenever it closes. command() owns the text of
 *   .hud-command-empty — render it empty.
 *   returns { refresh(), reset(), destroy() }
 *
 * COMMANDSHORTCUT — Ctrl+K / ⌘K (any `key`) opens `dialog` modally and
 * focuses its .hud-command-input; the same chord closes it. The
 * keydown listener goes on `target` (default: document). Returns a
 * function that removes it.
 *
 * FRAMEWORKS — create in an effect (useEffect, onMounted) and destroy in
 * its cleanup: a StrictMode double mount leaves one set of listeners.
 * Options, command items and (with renderChips: false) chips may be
 * framework-rendered, keyed lists. Push app state with setValue() /
 * setValues() right after creating and whenever it changes — they fire
 * nothing, so there is no loop — and take the user's changes from
 * onChange, onSelect or `hud-change`. Leave the combobox and command
 * inputs uncontrolled (no value binding, no v-model) and aria-selected
 * unbound: the pickers write them. With module chips, render nothing
 * but the input and static siblings in the chips root — anything the
 * framework inserts later lands after the chips.
 *
 * Popups: a .hud-pop with the popover attribute goes to the top layer
 * (switched to popover="manual": the pickers own dismissal) and is held
 * under its field by anchor(). Without it the panel is shown and hidden
 * with the hidden attribute and positioned by field.css. Every function
 * is inert on the server and returns its API regardless.
 */

import { anchor } from "./anchor.js";

const OPTION = '[role="option"]';
const PAGE = 10;
const TYPEAHEAD_MS = 500;

/* What the list observers watch: options added, removed, re-labelled,
   re-valued or (dis)abled — by a framework's re-render or by hand. The
   modules' own writes (aria-selected, hidden, id) are not in the list,
   so a sync never triggers another. */
const WATCH = {
  childList: true,
  subtree: true,
  characterData: true,
  attributeFilter: ["data-value", "data-keywords", "aria-disabled", "disabled"],
};

let seq = 0;
const uid = (prefix) => `${prefix}-${(++seq).toString(36)}`;
const ensureId = (el, prefix) => el.id || (el.id = uid(prefix));
const hasDom = () => typeof document !== "undefined";

const labelOf = (opt) => (opt.querySelector(".hud-pop-opt-label") ?? opt).textContent.trim();
const valueOf = (opt) => opt.dataset.value ?? labelOf(opt);
const isEnabled = (opt) => !opt.disabled && opt.getAttribute("aria-disabled") !== "true";
const isShown = (opt) => !opt.hidden && !opt.closest('[role="group"][hidden]');

/* Case- and accent-insensitive, so "sao" finds "São Paulo". */
const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function contains(option, query) {
  const hay = fold(`${labelOf(option)} ${option.dataset.keywords ?? ""}`);
  return fold(query).split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
}

const printable = (e) => e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

/* A listbox with no name borrows its control's label. */
function nameListbox(listbox, host) {
  if (listbox.hasAttribute("aria-label") || listbox.hasAttribute("aria-labelledby")) return;
  const label = host.labels?.[0];
  if (host.hasAttribute("aria-labelledby")) listbox.setAttribute("aria-labelledby", host.getAttribute("aria-labelledby"));
  else if (label) listbox.setAttribute("aria-labelledby", ensureId(label, "hud-label"));
  else if (host.hasAttribute("aria-label")) listbox.setAttribute("aria-label", host.getAttribute("aria-label"));
}

/* Keep the active row — and, for the first row of a group, the group's
   label — inside the list's scrollport. Scrolls the list only, never
   the page. */
function reveal(listbox, opt) {
  if (listbox.scrollHeight <= listbox.clientHeight) return;
  const group = opt.closest('[role="group"]');
  const label = group && group.querySelector(`${OPTION}:not([hidden])`) === opt ? group.querySelector(".hud-pop-group") : null;
  const box = listbox.getBoundingClientRect();
  const pad = parseFloat(getComputedStyle(listbox).paddingBlockStart) || 0;
  const top = (label ?? opt).getBoundingClientRect().top;
  const bottom = opt.getBoundingClientRect().bottom;
  if (top < box.top + pad) listbox.scrollTop -= box.top + pad - top;
  else if (bottom > box.bottom - pad) listbox.scrollTop += bottom - (box.bottom - pad);
}

/* The virtual cursor: which option aria-activedescendant points at. */
function cursor(listbox, host, { wrap = false, onActive } = {}) {
  let active = null;
  const all = () => [...listbox.querySelectorAll(OPTION)];
  const navigable = () => all().filter((o) => isShown(o) && isEnabled(o));

  const set = (opt, { scroll = true } = {}) => {
    const next = opt ?? null;
    if (next !== active) {
      const prev = active;
      prev?.classList.remove("is-active");
      active = next;
      if (active) {
        active.classList.add("is-active");
        host.setAttribute("aria-activedescendant", ensureId(active, "hud-opt"));
      } else {
        host.removeAttribute("aria-activedescendant");
      }
      onActive?.(active, prev);
    }
    if (active && scroll) reveal(listbox, active);
  };

  const step = (delta) => {
    const opts = navigable();
    if (!opts.length) return set(null);
    const i = opts.indexOf(active);
    let n;
    if (i < 0) n = delta > 0 ? 0 : opts.length - 1;
    else if (wrap && Math.abs(delta) === 1) n = (i + delta + opts.length) % opts.length;
    else n = Math.max(0, Math.min(opts.length - 1, i + delta));
    set(opts[n]);
  };

  const edge = (end) => {
    const opts = navigable();
    set(end ? opts.at(-1) : opts[0]);
    // Past the last enabled row there may be disabled ones (or before
    // the first, a heading): show the true end of the list.
    if (active && listbox.scrollHeight > listbox.clientHeight) {
      listbox.scrollTop = end ? listbox.scrollHeight : 0;
      reveal(listbox, active);
    }
  };

  return {
    get active() { return active; },
    all, navigable, set, step, edge,
    /* Drop an active option that has been removed, hidden or disabled. */
    prune() {
      if (active && (!active.isConnected || !isShown(active) || !isEnabled(active))) set(null);
    },
  };
}

/* Pointer: hover moves the cursor, click picks, and a press anywhere in
   the panel keeps focus where it is. */
function pointer(panel, listbox, cur, pick) {
  const optionAt = (e) => {
    const o = e.target.closest?.(OPTION);
    return o && listbox.contains(o) && isShown(o) && isEnabled(o) ? o : null;
  };
  // Browsers replay a pointermove when the list scrolls under a still
  // pointer; only a pointer that actually moved may take the cursor, or
  // arrowing past the fold would snap back to the row under the mouse.
  let x = NaN;
  let y = NaN;
  const onMove = (e) => {
    if (e.clientX === x && e.clientY === y) return;
    x = e.clientX;
    y = e.clientY;
    const o = optionAt(e);
    if (o && o !== cur.active) cur.set(o, { scroll: false });
  };
  const onDown = (e) => e.preventDefault();
  const onClick = (e) => {
    const o = optionAt(e);
    if (o) pick(o);
  };
  listbox.addEventListener("pointermove", onMove);
  listbox.addEventListener("click", onClick);
  panel.addEventListener("mousedown", onDown);
  return () => {
    listbox.removeEventListener("pointermove", onMove);
    listbox.removeEventListener("click", onClick);
    panel.removeEventListener("mousedown", onDown);
  };
}

/* The popup: top layer + anchor() when it is a popover, else hidden. */
function surface(listbox, reference) {
  const panel = listbox.closest("[popover]") ?? listbox.closest(".hud-pop") ?? listbox;
  const top = panel.hasAttribute("popover") && typeof panel.showPopover === "function";
  if (top) panel.setAttribute("popover", "manual");
  else panel.hidden = true;
  let release = null;

  const isOpen = () => (top ? panel.matches(":popover-open") : !panel.hidden);

  return {
    panel,
    isOpen,
    show() {
      if (isOpen()) return;
      if (!top) {
        panel.hidden = false;
        return;
      }
      panel.style.minInlineSize = `${Math.round(reference.getBoundingClientRect().width)}px`;
      panel.showPopover();
      release = anchor(panel, reference, { side: "bottom", align: "start" });
    },
    hide() {
      release?.();
      release = null;
      if (!isOpen()) return;
      if (top) panel.hidePopover();
      else panel.hidden = true;
    },
  };
}

function typeahead() {
  let buffer = "";
  let timer = 0;
  return {
    get pending() { return buffer !== ""; },
    find(char, opts, current) {
      clearTimeout(timer);
      timer = setTimeout(() => { buffer = ""; }, TYPEAHEAD_MS);
      buffer += fold(char);
      // One letter repeated cycles through the options starting with it;
      // anything else matches the whole string, starting from here.
      const cycling = [...buffer].every((c) => c === buffer[0]);
      const needle = cycling ? buffer[0] : buffer;
      const i = opts.indexOf(current);
      const from = cycling ? i + 1 : Math.max(i, 0);
      const ordered = [...opts.slice(from), ...opts.slice(0, from)];
      return ordered.find((o) => fold(labelOf(o)).startsWith(needle)) ?? null;
    },
    reset() {
      clearTimeout(timer);
      buffer = "";
    },
  };
}

/* ------------------------------------------------------------------ */

export function select(trigger, listbox, options = {}) {
  let chosen = null;
  const api = {
    get value() { return chosen ? valueOf(chosen) : null; },
    setValue() {}, open() {}, close() {}, refresh() {}, destroy() {},
  };
  if (!hasDom() || !trigger || !listbox) return api;

  const { onChange } = options;
  const sibling = trigger.nextElementSibling;
  const input = options.input ?? (sibling?.matches('input[type="hidden"]') ? sibling : null);

  let valueEl = trigger.querySelector(".hud-select-trigger-value");
  const madeValue = !valueEl;
  if (madeValue) {
    valueEl = document.createElement("span");
    valueEl.className = "hud-select-trigger-value";
    trigger.prepend(valueEl);
  }

  const surf = surface(listbox, trigger);
  const { panel } = surf;
  const cur = cursor(listbox, trigger);
  const find = typeahead();

  ensureId(listbox, "hud-listbox");
  if (trigger.localName === "button" && !trigger.hasAttribute("type")) trigger.type = "button";
  if (!trigger.hasAttribute("role")) trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-controls", listbox.id);
  trigger.setAttribute("aria-expanded", "false");
  listbox.setAttribute("role", "listbox");
  // Focus stays on the trigger. tabindex -1 also keeps the list out of
  // the tab order, where a scrollable one lands otherwise (Chrome makes
  // scroll containers keyboard-focusable).
  listbox.tabIndex = -1;
  nameListbox(listbox, trigger);

  const render = () => {
    const text = chosen ? labelOf(chosen) : "";
    if (valueEl.textContent !== text) valueEl.textContent = text;
    if (input) input.value = chosen ? valueOf(chosen) : "";
  };

  let chosenValue = null;
  let pending = null; // a setValue() value whose option is not rendered yet
  const mark = () => {
    for (const o of cur.all()) {
      ensureId(o, "hud-opt");
      if (o.localName === "button") o.tabIndex = -1;
      o.setAttribute("aria-selected", String(o === chosen));
    }
  };

  /* Re-read the options: an option marked in markup wins, else the one
     holding the value we had, else (first run) the hidden input's. */
  const refresh = () => {
    const opts = cur.all();
    const wanted = chosenValue ?? pending ?? input?.value ?? "";
    chosen =
      opts.find((o) => o.getAttribute("aria-selected") === "true" && o !== chosen) ??
      opts.find((o) => o === chosen && o.isConnected) ??
      (wanted !== "" ? opts.find((o) => valueOf(o) === wanted) : null) ??
      null;
    chosenValue = chosen ? valueOf(chosen) : null;
    if (chosen) pending = null;
    mark();
    render();
    cur.prune();
  };

  const emit = () => {
    const detail = chosen
      ? { value: valueOf(chosen), label: labelOf(chosen), option: chosen }
      : { value: null, label: null, option: null };
    trigger.dispatchEvent(new CustomEvent("hud-change", { bubbles: true, detail }));
    onChange?.(detail);
  };

  const choose = (opt, { silent = false } = {}) => {
    if (opt && !isEnabled(opt)) return;
    const before = chosenValue;
    pending = null;
    chosen = opt ?? null;
    chosenValue = chosen ? valueOf(chosen) : null;
    mark();
    render();
    if (!silent && chosenValue !== before) emit();
  };

  const disabled = () => trigger.disabled || trigger.getAttribute("aria-disabled") === "true";

  const onOutside = (e) => {
    if (!trigger.contains(e.target) && !panel.contains(e.target)) close();
  };

  const open = (which = "selected") => {
    if (disabled()) return;
    if (!surf.isOpen()) {
      surf.show();
      trigger.setAttribute("aria-expanded", "true");
      document.addEventListener("pointerdown", onOutside, true);
    }
    const opts = cur.navigable();
    let target;
    if (which === "first") target = opts[0];
    else if (which === "last") target = opts.at(-1);
    else target = opts.includes(chosen) ? chosen : opts[0];
    cur.set(target);
  };

  function close() {
    surf.hide();
    trigger.setAttribute("aria-expanded", "false");
    cur.set(null);
    find.reset();
    document.removeEventListener("pointerdown", onOutside, true);
  }

  const seek = (key) => {
    const hit = find.find(key, cur.navigable(), cur.active);
    if (hit) cur.set(hit);
  };

  // Space activates a button on keyup in some engines; once keydown has
  // used it, the keyup must not toggle the popup back.
  let swallowSpace = false;

  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || disabled()) return;
    const { key, altKey } = e;
    if (!surf.isOpen()) {
      // Enter and Space are the button's own click, handled there.
      if (key === "ArrowDown") open();
      else if ((key === "ArrowUp" && !altKey) || key === "Home") open("first");
      else if (key === "End") open("last");
      else if (printable(e) && key !== " ") {
        open();
        seek(key);
      } else return;
      e.preventDefault();
      return;
    }

    if (key === "Tab") {
      choose(cur.active);
      close();
      return;
    }
    if (key === "ArrowDown") {
      if (!altKey) cur.step(1);
    } else if (key === "ArrowUp" && altKey) {
      choose(cur.active);
      close();
    } else if (key === "ArrowUp") cur.step(-1);
    else if (key === "PageDown") cur.step(PAGE);
    else if (key === "PageUp") cur.step(-PAGE);
    else if (key === "Home") cur.edge(false);
    else if (key === "End") cur.edge(true);
    else if (key === "Escape") close();
    else if (key === "Enter" || (key === " " && !find.pending)) {
      swallowSpace = key === " ";
      choose(cur.active);
      close();
    } else if (printable(e)) {
      swallowSpace = key === " ";
      seek(key);
    } else return;
    e.preventDefault();
  };

  const onKeyUp = (e) => {
    if (e.key === " " && swallowSpace) {
      swallowSpace = false;
      e.preventDefault();
    }
  };

  const onClick = () => {
    if (swallowSpace) {
      swallowSpace = false;
      return;
    }
    if (surf.isOpen()) close();
    else {
      trigger.focus();
      open();
    }
  };

  const onFocusOut = (e) => {
    if (!surf.isOpen()) return;
    if (e.relatedTarget && panel.contains(e.relatedTarget)) return;
    close();
  };

  const onToggle = (e) => {
    if (e.newState === "closed" && trigger.getAttribute("aria-expanded") === "true") close();
  };

  const form = input?.form ?? trigger.form;
  const onReset = () => setTimeout(() => choose(initial, { silent: true }));

  const unpoint = pointer(panel, listbox, cur, (opt) => {
    choose(opt);
    close();
    trigger.focus();
  });

  refresh();
  const initial = chosen;

  const observer = new MutationObserver(refresh);
  observer.observe(listbox, WATCH);
  trigger.addEventListener("keydown", onKeyDown);
  trigger.addEventListener("keyup", onKeyUp);
  trigger.addEventListener("click", onClick);
  trigger.addEventListener("focusout", onFocusOut);
  panel.addEventListener("toggle", onToggle);
  form?.addEventListener("reset", onReset);

  Object.assign(api, {
    setValue(value) {
      const want = value == null ? null : String(value);
      const opt = want === null ? null : cur.all().find((o) => valueOf(o) === want) ?? null;
      choose(opt, { silent: true });
      if (!opt) pending = want;
    },
    open: () => open(),
    close,
    refresh,
    destroy() {
      close();
      unpoint();
      observer.disconnect();
      trigger.removeEventListener("keydown", onKeyDown);
      trigger.removeEventListener("keyup", onKeyUp);
      trigger.removeEventListener("click", onClick);
      trigger.removeEventListener("focusout", onFocusOut);
      panel.removeEventListener("toggle", onToggle);
      form?.removeEventListener("reset", onReset);
      if (madeValue) valueEl.remove();
    },
  });
  return api;
}

/* ------------------------------------------------------------------ */

const MESSAGES = {
  empty: "No matches",
  added: (label) => `${label} added`,
  removed: (label) => `${label} removed`,
  remove: (label) => `Remove ${label}`,
};

export function combobox(input, listbox, options = {}) {
  const picked = new Map(); // value → label, in the order picked
  const api = {
    get value() { return picked.size ? picked.keys().next().value : null; },
    get values() { return [...picked.keys()]; },
    setValue() {}, setValues() {}, open() {}, close() {}, refresh() {}, clear() {}, status() {}, destroy() {},
  };
  if (!hasDom() || !input || !listbox) return api;

  const { filter = contains, multiple = false, onSelect } = options;
  // false: the app renders the chips (framework-owned); we never add or
  // remove one, only read them and handle their × buttons.
  const ownChips = options.renderChips !== false;
  const text = { ...MESSAGES, ...options.messages };
  const field = input.closest(".hud-field") ?? input;
  const chips = multiple ? options.chipsRoot ?? input.closest(".hud-field--chips") : null;
  const toggle = field === input ? null : field.querySelector(".hud-combobox-toggle");
  const surf = surface(listbox, field);
  const { panel } = surf;
  const cur = cursor(listbox, input, { wrap: true });

  ensureId(listbox, "hud-listbox");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", listbox.id);
  input.setAttribute("autocomplete", "off");
  listbox.setAttribute("role", "listbox");
  listbox.tabIndex = -1;
  if (multiple) listbox.setAttribute("aria-multiselectable", "true");
  nameListbox(listbox, input);
  if (toggle) {
    toggle.tabIndex = -1;
    toggle.setAttribute("aria-controls", listbox.id);
    toggle.setAttribute("aria-expanded", "false");
  }

  let msg = panel === listbox ? null : panel.querySelector(".hud-pop-msg");
  let madeMsg = false;
  if (!msg && panel !== listbox) {
    msg = document.createElement("div");
    msg.className = "hud-pop-msg";
    listbox.after(msg);
    madeMsg = true;
  }
  if (msg && !msg.hasAttribute("role")) msg.setAttribute("role", "status");
  const emptyText = options.messages?.empty ?? msg?.dataset.empty ?? text.empty;

  let live = null;
  if (chips) {
    live = document.createElement("span");
    live.className = "hud-combobox-live";
    live.setAttribute("role", "status");
    chips.append(live);
  }
  const say = (message) => {
    if (!live) return;
    // Clear first, so the same message twice is still announced twice.
    live.textContent = "";
    setTimeout(() => { live.textContent = message; }, 40);
  };

  let state = "idle";
  let stateText = "";
  let dirty = false; // the text was typed since the popup opened
  const made = new Set(); // the chips we created, removed on destroy
  const guessed = new Set(); // picked values labelled with the value itself, until their option shows up

  const optionFor = (value) => cur.all().find((o) => valueOf(o) === value) ?? null;
  const chipLabel = (chip) => (chip.querySelector(".hud-chip-label") ?? chip).textContent.replace(/×/g, "").trim();
  const chipList = () => (chips ? [...chips.querySelectorAll(".hud-chip[data-value]")] : []);

  for (const o of cur.all()) {
    if (o.getAttribute("aria-selected") !== "true") continue;
    picked.set(valueOf(o), labelOf(o));
    if (!multiple) break;
  }
  if (chips) {
    for (const chip of chips.querySelectorAll(".hud-chip")) {
      const label = chipLabel(chip);
      chip.dataset.value ??= label;
      if (!picked.has(chip.dataset.value)) picked.set(chip.dataset.value, label);
    }
  }
  if (!multiple) {
    if (picked.size) input.value = picked.values().next().value;
    else if (input.value) {
      const match = cur.all().find((o) => fold(labelOf(o)) === fold(input.value.trim()));
      if (match) picked.set(valueOf(match), labelOf(match));
    }
  }

  const query = () => (multiple || dirty ? input.value.trim() : "");

  const refresh = () => {
    const q = query();
    const opts = cur.all();
    let relabel = false;
    for (const o of opts) {
      ensureId(o, "hud-opt");
      if (o.localName === "button") o.tabIndex = -1;
      const value = valueOf(o);
      if (guessed.delete(value) && picked.has(value)) {
        picked.set(value, labelOf(o));
        relabel = true;
      }
      o.setAttribute("aria-selected", String(picked.has(value)));
      if (filter) o.hidden = q !== "" && !filter(o, q);
    }
    if (relabel) {
      renderChips();
      if (!multiple && !dirty) input.value = picked.values().next().value ?? "";
    }
    if (filter) {
      for (const g of listbox.querySelectorAll('[role="group"]')) {
        g.hidden = !g.querySelector(`${OPTION}:not([hidden])`);
      }
    }
    if (state === "loading") listbox.setAttribute("aria-busy", "true");
    else listbox.removeAttribute("aria-busy");
    if (msg) {
      const line = state !== "idle" ? stateText : opts.some(isShown) ? "" : emptyText;
      msg.classList.toggle("is-error", state === "error");
      if (msg.textContent !== line) msg.textContent = line;
    }
    cur.prune();
    // Automatic selection: while there is a query, its first match is
    // active, so Enter takes it.
    if (!cur.active && surf.isOpen() && q !== "") cur.set(cur.navigable()[0]);
  };

  const makeChip = (value, label) => {
    const chip = document.createElement("span");
    chip.className = "hud-chip";
    chip.dataset.value = value;
    const name = document.createElement("span");
    name.className = "hud-chip-label";
    name.textContent = label;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "hud-chip-x";
    x.setAttribute("aria-label", text.remove(label));
    x.textContent = "×";
    chip.append(name, x);
    made.add(chip);
    return chip;
  };

  function renderChips() {
    if (!chips || !ownChips) return;
    const have = new Map(chipList().map((c) => [c.dataset.value, c]));
    for (const [value, chip] of have) {
      if (picked.has(value)) continue;
      chip.remove();
      made.delete(chip);
    }
    // New chips join the others, so something the app renders between
    // them and the input does not split the row; the first goes right
    // before the input.
    let last = chipList().at(-1);
    let before = chips.contains(input) ? input : null;
    while (before && before.parentElement !== chips) before = before.parentElement;
    for (const [value, label] of picked) {
      const chip = have.get(value);
      if (!chip) {
        const fresh = makeChip(value, label);
        if (last) last.after(fresh);
        else chips.insertBefore(fresh, before);
        last = fresh;
      } else if (made.has(chip) && chip.firstChild.textContent !== label) {
        chip.firstChild.textContent = label;
        chip.lastChild.setAttribute("aria-label", text.remove(label));
      }
    }
  }

  const change = (detail) => {
    input.dispatchEvent(new CustomEvent("hud-change", { bubbles: true, detail }));
  };

  const setExpanded = (on) => {
    input.setAttribute("aria-expanded", String(on));
    toggle?.setAttribute("aria-expanded", String(on));
  };

  const onOutside = (e) => {
    if (!field.contains(e.target) && !panel.contains(e.target)) close();
  };

  const open = (which) => {
    if (input.disabled || input.readOnly) return;
    if (!surf.isOpen()) {
      surf.show();
      setExpanded(true);
      document.addEventListener("pointerdown", onOutside, true);
    }
    refresh();
    const opts = cur.navigable();
    if (which === "first") cur.set(opts[0]);
    else if (which === "last") cur.set(opts.at(-1));
    else if (which === "selected") cur.set(opts.find((o) => picked.has(valueOf(o))) ?? opts[0]);
  };

  function close() {
    surf.hide();
    setExpanded(false);
    cur.set(null);
    document.removeEventListener("pointerdown", onOutside, true);
  }

  const pick = (opt) => {
    if (!opt || !isEnabled(opt)) return;
    const value = valueOf(opt);
    const label = labelOf(opt);
    if (multiple) {
      const on = !picked.has(value);
      if (on) picked.set(value, label);
      else picked.delete(value);
      input.value = "";
      renderChips();
      refresh();
      cur.set(opt);
      say(on ? text.added(label) : text.removed(label));
      const detail = { value, label, option: opt, selected: on, values: [...picked.keys()] };
      change(detail);
      onSelect?.(detail);
      return;
    }
    const changed = !picked.has(value);
    picked.clear();
    picked.set(value, label);
    input.value = label;
    dirty = false;
    input.setSelectionRange?.(label.length, label.length);
    close();
    refresh();
    const detail = { value, label, option: opt };
    if (changed) change(detail);
    onSelect?.(detail);
  };

  const unpick = (value, focusNext) => {
    const label = picked.get(value);
    if (label === undefined) return;
    let next = null;
    if (focusNext) {
      const list = chipList();
      const i = list.findIndex((c) => c.dataset.value === value);
      next = (list[i + 1] ?? list[i - 1])?.querySelector(".hud-chip-x") ?? input;
    }
    picked.delete(value);
    renderChips();
    refresh();
    next?.focus();
    say(text.removed(label));
    change({ value, label, option: optionFor(value), selected: false, values: [...picked.keys()] });
  };

  const clearAll = () => {
    const had = picked.size > 0;
    picked.clear();
    input.value = "";
    dirty = false;
    renderChips();
    refresh();
    if (had) change(multiple ? { value: null, label: null, option: null, selected: false, values: [] } : { value: null, label: null, option: null });
  };

  /* The programmatic selection: exactly the given values, no events and
     no announcement. Values that stay keep their place; new ones follow
     in the order given. A label comes from the item, else the option,
     else the one already known, else the value itself (upgraded when its
     option shows up). */
  const assign = (items) => {
    const next = new Map();
    for (const item of items) {
      if (item == null) continue;
      const value = String(typeof item === "object" ? item.value : item);
      if (next.has(value)) continue;
      const opt = optionFor(value);
      let label = typeof item === "object" && item.label != null ? String(item.label) : opt ? labelOf(opt) : picked.get(value);
      if (label === undefined) {
        label = value;
        guessed.add(value);
      } else if (opt || typeof item === "object") guessed.delete(value);
      next.set(value, label);
      if (!multiple) break;
    }
    if (next.size === picked.size && [...next].every(([v, l]) => picked.get(v) === l)) return;
    for (const value of [...picked.keys()]) if (!next.has(value)) picked.delete(value);
    for (const [value, label] of next) picked.set(value, label);
    if (!multiple) {
      input.value = picked.size ? picked.values().next().value : "";
      dirty = false;
    }
    renderChips();
    refresh();
  };

  /* Single mode, on the way out: typed text exactly naming an option
     takes it; emptied text clears; anything else is put back. */
  const settle = () => {
    if (multiple) {
      if (input.value) {
        input.value = "";
        refresh();
      }
      return;
    }
    const typed = input.value.trim();
    const active = cur.active;
    if (dirty && active && fold(labelOf(active)) === fold(typed)) {
      pick(active);
      return;
    }
    if (typed === "") {
      if (picked.size) clearAll();
    } else {
      input.value = picked.size ? picked.values().next().value : "";
    }
    dirty = false;
  };

  const onInput = () => {
    dirty = true;
    cur.set(null);
    open();
  };

  const onKeyDown = (e) => {
    if (e.isComposing || e.ctrlKey || e.metaKey) return;
    const opened = surf.isOpen();
    const { key, altKey } = e;
    switch (key) {
      case "ArrowDown":
        if (!opened) open(altKey ? undefined : "selected");
        else if (!altKey) cur.step(1);
        break;
      case "ArrowUp":
        if (altKey) {
          if (opened) close();
        } else if (!opened) open("last");
        else cur.step(-1);
        break;
      case "PageDown":
      case "PageUp":
        if (!opened) return;
        cur.step(key === "PageDown" ? PAGE : -PAGE);
        break;
      case "Home":
      case "End":
        // The caret's keys: visual focus goes back to the text.
        if (opened) cur.set(null);
        return;
      case "Enter":
        if (!opened || !cur.active) return;
        pick(cur.active);
        break;
      case "Escape":
        if (opened) close();
        else if (multiple && input.value) {
          input.value = "";
          refresh();
        } else if (!multiple && (input.value || picked.size)) clearAll();
        else return;
        break;
      case "Backspace":
        if (!multiple || input.value !== "" || !picked.size) return;
        unpick([...picked.keys()].at(-1), false);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const onClick = () => {
    if (!surf.isOpen()) open("selected");
  };

  const onFocusOut = (e) => {
    const to = e.relatedTarget;
    if (to && (panel.contains(to) || to === toggle)) return;
    settle();
    close();
  };

  const onToggleDown = (e) => e.preventDefault();
  const onToggleClick = () => {
    if (surf.isOpen()) close();
    else {
      input.focus();
      open("selected");
    }
  };

  const onChipsClick = (e) => {
    const x = e.target.closest(".hud-chip-x");
    const chip = x?.closest(".hud-chip[data-value]");
    if (chip && chips.contains(chip)) {
      // A keyboard press moves on to the next chip; a pointer press
      // hands focus back to the input.
      unpick(chip.dataset.value, e.detail === 0);
      if (e.detail !== 0) input.focus();
    } else if (e.target === chips) input.focus();
  };

  const onChipsKey = (e) => {
    if (e.key !== "Backspace" && e.key !== "Delete") return;
    const chip = e.target.closest?.(".hud-chip-x")?.closest(".hud-chip[data-value]");
    if (!chip) return;
    e.preventDefault();
    unpick(chip.dataset.value, true);
  };

  const onPanelToggle = (e) => {
    if (e.newState === "closed" && input.getAttribute("aria-expanded") === "true") close();
  };

  const unpoint = pointer(panel, listbox, cur, pick);
  renderChips();
  refresh();

  const observer = new MutationObserver(refresh);
  observer.observe(listbox, WATCH);
  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("click", onClick);
  input.addEventListener("focusout", onFocusOut);
  panel.addEventListener("toggle", onPanelToggle);
  toggle?.addEventListener("mousedown", onToggleDown);
  toggle?.addEventListener("click", onToggleClick);
  chips?.addEventListener("click", onChipsClick);
  chips?.addEventListener("keydown", onChipsKey);

  Object.assign(api, {
    setValue: (value) => assign(value == null ? [] : [value]),
    setValues: (values) => assign(values ?? []),
    open: () => open("selected"),
    close,
    refresh,
    clear: clearAll,
    status(next = "idle", message = "") {
      state = next === "loading" || next === "error" ? next : "idle";
      stateText = message || (state === "loading" ? "Loading…" : state === "error" ? "Couldn't load options" : "");
      refresh();
    },
    destroy() {
      close();
      unpoint();
      observer.disconnect();
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onKeyDown);
      input.removeEventListener("click", onClick);
      input.removeEventListener("focusout", onFocusOut);
      panel.removeEventListener("toggle", onPanelToggle);
      toggle?.removeEventListener("mousedown", onToggleDown);
      toggle?.removeEventListener("click", onToggleClick);
      chips?.removeEventListener("click", onChipsClick);
      chips?.removeEventListener("keydown", onChipsKey);
      live?.remove();
      for (const chip of made) chip.remove();
      made.clear();
      if (madeMsg) msg.remove();
    },
  });
  return api;
}

/* ------------------------------------------------------------------ */

export function command(root, options = {}) {
  const api = { refresh() {}, reset() {}, destroy() {} };
  if (!hasDom() || !root) return api;

  const input = root.querySelector(".hud-command-input") ?? root.querySelector("input");
  const listbox = root.querySelector('[role="listbox"]') ?? root.querySelector(".hud-pop-list");
  if (!input || !listbox) return api;

  const { onSelect, filter = contains } = options;
  const empty = root.querySelector(".hud-command-empty");
  const emptyText = empty?.dataset.empty ?? "No matching commands";
  const dialog = root.closest("dialog");
  // Nothing is chosen in a palette, so aria-selected follows the cursor
  // (the APG combobox convention) and no check is drawn.
  const cur = cursor(listbox, input, {
    wrap: true,
    onActive: (next, prev) => {
      prev?.removeAttribute("aria-selected");
      next?.setAttribute("aria-selected", "true");
    },
  });

  ensureId(listbox, "hud-listbox");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", listbox.id);
  input.setAttribute("autocomplete", "off");
  input.spellcheck = false;
  listbox.setAttribute("role", "listbox");
  listbox.tabIndex = -1;
  nameListbox(listbox, input);
  if (empty && !empty.hasAttribute("role")) empty.setAttribute("role", "status");

  const refresh = (restart = false) => {
    const q = input.value.trim();
    const opts = cur.all();
    for (const o of opts) {
      ensureId(o, "hud-opt");
      if (o.localName === "button") o.tabIndex = -1;
      if (filter) o.hidden = q !== "" && !filter(o, q);
    }
    if (filter) {
      for (const g of listbox.querySelectorAll('[role="group"]')) {
        g.hidden = !g.querySelector(`${OPTION}:not([hidden])`);
      }
    }
    const any = opts.some(isShown);
    listbox.hidden = !any;
    input.setAttribute("aria-expanded", String(any));
    if (empty) {
      const line = any ? "" : emptyText.replaceAll("{query}", q);
      if (empty.textContent !== line) empty.textContent = line;
    }
    if (restart) {
      listbox.scrollTop = 0;
      cur.set(null);
    }
    cur.prune();
    if (!cur.active) cur.set(cur.navigable()[0]);
  };

  const run = (opt) => {
    if (!opt || !isEnabled(opt)) return;
    const detail = { value: valueOf(opt), label: labelOf(opt), option: opt };
    const event = new CustomEvent("hud-select", { bubbles: true, cancelable: true, detail });
    root.dispatchEvent(event);
    onSelect?.(detail, event);
    if (!event.defaultPrevented && dialog?.open) dialog.close();
  };

  const onInput = () => refresh(true);

  const onKeyDown = (e) => {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case "ArrowDown": cur.step(1); break;
      case "ArrowUp": cur.step(-1); break;
      case "PageDown": cur.step(PAGE); break;
      case "PageUp": cur.step(-PAGE); break;
      case "Enter":
        if (!cur.active) return;
        run(cur.active);
        break;
      case "Escape":
        // Clear, then close: with a query, Esc only empties it, and the
        // dialog's own Esc is held back until there is nothing to clear.
        if (!input.value) return;
        input.value = "";
        refresh(true);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const reset = () => {
    input.value = "";
    refresh(true);
  };

  // A backdrop click is a press and a release both on the <dialog>
  // itself — not a text selection dragged out of the palette.
  let downOnBackdrop = false;
  const onDialogDown = (e) => { downOnBackdrop = e.target === dialog; };
  const onDialogClick = (e) => {
    if (downOnBackdrop && e.target === dialog) dialog.close();
    downOnBackdrop = false;
  };

  const unpoint = pointer(listbox, listbox, cur, run);
  refresh(true);

  const observer = new MutationObserver(() => refresh());
  observer.observe(listbox, WATCH);
  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKeyDown);
  dialog?.addEventListener("close", reset);
  dialog?.addEventListener("pointerdown", onDialogDown);
  dialog?.addEventListener("click", onDialogClick);

  Object.assign(api, {
    refresh: () => refresh(),
    reset,
    destroy() {
      unpoint();
      observer.disconnect();
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onKeyDown);
      dialog?.removeEventListener("close", reset);
      dialog?.removeEventListener("pointerdown", onDialogDown);
      dialog?.removeEventListener("click", onDialogClick);
    },
  });
  return api;
}

export function commandShortcut(dialog, options = {}) {
  if (!hasDom() || !dialog || typeof dialog.showModal !== "function") return () => {};
  const { key = "k", target = document } = options;
  const want = key.toLowerCase();

  const onKeyDown = (e) => {
    if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    // e.key for the letter printed on the cap; e.code when the layout
    // prints something else there (Cyrillic, Greek…).
    const hit = e.key.toLowerCase() === want || (!/^[\x20-\x7e]$/.test(e.key) && e.code === `Key${want.toUpperCase()}`);
    if (!hit || !dialog.isConnected) return;
    e.preventDefault();
    if (dialog.open) {
      dialog.close();
      return;
    }
    dialog.showModal();
    dialog.querySelector(".hud-command-input")?.focus();
  };

  target.addEventListener("keydown", onKeyDown);
  return () => target.removeEventListener("keydown", onKeyDown);
}
