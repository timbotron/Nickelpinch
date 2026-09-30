/**
 * toast() — transient notifications. No framework, no dependency.
 *
 *   import { toast } from "@valeness/hangar/toast";
 *
 *   toast({ title: "Deploy complete", description: "api-gateway v3.2 is live." });
 *   const t = toast({
 *     title: "Row deleted",
 *     tone: "warn",
 *     action: { label: "Undo", onClick: () => restore(row) },
 *   });
 *   t.dismiss();
 *
 * The first call creates the region (instruments/toast.css) at the
 * block-end / inline-end corner of the page. To configure it, create it
 * yourself once, before the first toast; toast() then posts into it:
 *
 *   import { toastRegion } from "@valeness/hangar/toast";
 *   const region = toastRegion({ max: 5, hotkey: "Alt+T" });
 *   // … region.destroy() on teardown
 *
 * toast(options) → { dismiss(), element }
 *   title        string | Node   required
 *   description  string | Node
 *   tone         "info" | "ok" | "warn" | "error"          default "info"
 *   action       { label, onClick(event) } — one button; the toast
 *                closes after onClick unless it calls
 *                event.preventDefault()
 *   duration     ms before it closes itself                default 5000
 *                Infinity (or 0) keeps it until dismissed.
 *                Error toasts default to Infinity: a failure should not
 *                vanish before it has been read.
 *   dismissible  show the close button                     default true
 *
 * toastRegion(options) → { toast(opts), dismissAll(), setPlacement(p),
 *                          placement, destroy(), element }
 *   max          toasts shown at once; older ones wait, paused,
 *                until a slot frees                        default 3
 *   placement    the corner, as one block edge and one inline edge:
 *                "block-end inline-end" | "block-end inline-start" |
 *                "block-start inline-end" | "block-start inline-start"
 *                                                          default "block-end inline-end"
 *   label        the region's accessible name              default "Notifications"
 *   hotkey       jumps focus to the newest toast, e.g. "F8",
 *                "Alt+T"; null to disable                  default "F8"
 *   closeLabel   aria-label of every close button          default "Dismiss notification"
 *   parent       where the region is appended              default document.body
 *   The region's DOM is created lazily, on its first toast. toast()
 *   posts into the most recently created region that has not been
 *   destroyed; destroying it hands toast() back to the one before.
 *
 * Placement. The corner is written to the region as data-placement and
 * toast.css does the positioning, so it is logical (RTL mirrors it)
 * and the same attribute works on markup you render yourself. The
 * newest toast sits nearest the pinned block edge — last in the list at
 * block-end, first at block-start — so the DOM, Tab and reading order
 * match what is on screen. Toasts slide in from the pinned inline edge.
 * setPlacement() moves an existing region, open toasts included; an
 * unknown value falls back to the default.
 *
 * Accessibility. The region is a labelled landmark holding two
 * visually hidden live regions, created with it and empty: polite for
 * info/ok/warn, assertive for error. Each toast's text is written into
 * the right one a beat after insertion, which is what makes the first
 * announcement reliable. Timers pause while the pointer is over the
 * stack, while focus is inside it, and while the page is hidden. Every
 * toast is focusable; the hotkey reaches the newest, Tab moves through
 * its buttons, Escape dismisses the focused toast. When a focused toast
 * closes, focus moves to its neighbour, or back to where it was before
 * the hotkey.
 *
 * Motion is CSS only (the slide in toast.css), so reduced motion and
 * data-hud="off" are honoured there; the script waits for whatever
 * exit animation is actually running, and removes at once if none is.
 *
 * Events, bubbling from the toast element (listen on the region or the
 * document):
 *   hud-toast-show      a toast was inserted            detail: { tone }
 *   hud-toast-dismiss   a toast started to close        detail: { tone, reason }
 *                       reason: "timeout" | "close" | "action" | "escape" | "api"
 *
 * Frameworks. The region is module-owned: its DOM is appended to
 * `parent` and nothing the app rendered is moved or rewritten. A
 * `parent` you pass should be an element the app renders empty. Create
 * the region before anything can toast — at module scope (SSR-safe: on
 * the server it is inert) or in the root component's mount effect,
 * with destroy() in its cleanup; child effects run before the root's,
 * so a child that toasts on mount would otherwise get a default region
 * of its own. StrictMode's double mount leaves exactly one region: a
 * destroyed region never built any DOM, since that waits for the first
 * toast. Calling toast() from event handlers or effects is fine; a
 * Node passed as title/description is moved into the toast.
 */

const TONES = ["info", "ok", "warn", "error"];
const TAG = { info: "INFO", ok: "OK", warn: "WARN", error: "ERR" };
const SPOKEN = { info: "", ok: "", warn: "Warning: ", error: "Error: " };

/* data-placement values; the first is the default. */
const PLACEMENTS = ["block-end inline-end", "block-end inline-start", "block-start inline-end", "block-start inline-start"];
const placementOf = (p) => (PLACEMENTS.includes(p) ? p : PLACEMENTS[0]);
/* At block-start the newest toast is first in the list, nearest the edge. */
const newestFirst = (p) => p.startsWith("block-start");

/* How long an announcement stays in the live region: long enough to be
   read, short enough that a screen-reader user browsing the page does
   not find a pile of stale messages. */
const ANNOUNCE_DELAY = 150;
const ANNOUNCE_TTL = 7000;

/* Live regions, oldest first. toast() posts into the newest. */
const regions = [];

const NOOP_TOAST = Object.freeze({ dismiss() {}, element: null });

function hasDom() {
  return typeof document !== "undefined";
}

function fill(el, content) {
  if (content == null) return;
  if (typeof content === "string" || typeof content === "number") el.append(String(content));
  else el.append(content);
}

function textOf(content) {
  if (content == null) return "";
  if (typeof content === "string" || typeof content === "number") return String(content);
  return content.textContent ?? "";
}

/* "Alt+Shift+T" → predicate over a KeyboardEvent. */
function parseHotkey(spec) {
  if (!spec) return null;
  const parts = String(spec).split("+").map((p) => p.trim().toLowerCase());
  const key = parts.pop();
  const mods = new Set(parts);
  return (e) =>
    e.altKey === mods.has("alt") &&
    e.shiftKey === mods.has("shift") &&
    e.ctrlKey === mods.has("ctrl") &&
    e.metaKey === mods.has("meta") &&
    (e.key.toLowerCase() === key || e.code.toLowerCase() === key || e.code.toLowerCase() === `key${key}`);
}

export function toastRegion(options = {}) {
  if (!hasDom()) {
    return {
      toast: () => NOOP_TOAST,
      dismissAll() {},
      setPlacement() {},
      placement: placementOf(options.placement),
      destroy() {},
      element: null,
    };
  }

  const {
    max = 3,
    label = "Notifications",
    hotkey = "F8",
    closeLabel = "Dismiss notification",
    parent = null,
  } = options;

  const matchHotkey = parseHotkey(hotkey);
  let placement = placementOf(options.placement);

  /** @type {HTMLElement|null} */
  let region = null;
  let list = null;
  let polite = null;
  let assertive = null;
  const entries = []; // open toasts, oldest first
  const pending = new Set(); // announcement timers
  let hovering = false;
  let focused = false;
  let restoreFocus = null;
  let destroyed = false;

  const paused = () => hovering || focused || document.hidden;

  function liveRegion(politeness) {
    const el = document.createElement("div");
    el.className = "hud-toast-sr";
    el.setAttribute("aria-live", politeness);
    el.setAttribute("aria-atomic", "false");
    el.setAttribute("aria-relevant", "additions");
    return el;
  }

  function onPointerEnter() {
    hovering = true;
    sync();
  }

  function onPointerLeave() {
    hovering = false;
    sync();
  }

  function onFocusIn() {
    focused = true;
    sync();
  }

  function onFocusOut(e) {
    if (region.contains(e.relatedTarget)) return;
    focused = false;
    sync();
  }

  function onKeyDown(e) {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const li = e.target.closest?.(".hud-toast");
    const entry = li && entries.find((x) => x.li === li);
    if (!entry) return;
    e.preventDefault();
    entry.dismiss("escape");
  }

  function onHotkey(e) {
    if (!matchHotkey?.(e) || e.defaultPrevented) return;
    const visible = entries.filter((x) => !x.li.hidden);
    const newest = visible[visible.length - 1];
    if (!newest) return;
    e.preventDefault();
    if (!region.contains(document.activeElement)) restoreFocus = document.activeElement;
    newest.li.focus();
  }

  function ensure() {
    if (region) return;
    region = document.createElement("section");
    region.className = "hud-toast-region";
    region.dataset.placement = placement;
    region.setAttribute("aria-label", label);
    if (hotkey) region.setAttribute("aria-keyshortcuts", hotkey);
    list = document.createElement("ol");
    list.className = "hud-toast-list";
    polite = liveRegion("polite");
    assertive = liveRegion("assertive");
    region.append(list, polite, assertive);
    (parent ?? document.body).append(region);
    region.addEventListener("pointerenter", onPointerEnter);
    region.addEventListener("pointerleave", onPointerLeave);
    region.addEventListener("focusin", onFocusIn);
    region.addEventListener("focusout", onFocusOut);
    region.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", sync);
    if (matchHotkey) document.addEventListener("keydown", onHotkey);
  }

  function announce(tone, text) {
    const target = tone === "error" ? assertive : polite;
    const t = setTimeout(() => {
      pending.delete(t);
      const line = document.createElement("div");
      line.textContent = text;
      target.append(line);
      const t2 = setTimeout(() => {
        pending.delete(t2);
        line.remove();
      }, ANNOUNCE_TTL);
      pending.add(t2);
    }, ANNOUNCE_DELAY);
    pending.add(t);
  }

  /* Show the newest `max`, hide (and hold) the rest, and run or hold
     every visible timer according to the pause state. */
  function sync() {
    if (!region) return;
    const cut = entries.length - Math.max(1, max);
    entries.forEach((entry, i) => {
      entry.li.hidden = i < cut;
      if (entry.li.hidden || paused()) entry.hold();
      else entry.run();
    });
    // A toast removed from under the pointer never gets its pointerleave.
    if (!entries.length) hovering = false;
  }

  function toast(opts = {}) {
    if (destroyed) return NOOP_TOAST;
    ensure();

    const tone = TONES.includes(opts.tone) ? opts.tone : "info";
    let duration = opts.duration ?? (tone === "error" ? Infinity : 5000);
    if (!(duration > 0)) duration = Infinity;
    const { action, dismissible = true } = opts;

    const li = document.createElement("li");
    li.className = `hud-toast hud-toast--${tone} hud-brackets--diag`;
    li.tabIndex = 0;

    const tag = document.createElement("span");
    tag.className = "hud-toast-tag";
    tag.setAttribute("aria-hidden", "true");
    tag.textContent = TAG[tone];

    const title = document.createElement("p");
    title.className = "hud-toast-title";
    if (SPOKEN[tone]) {
      const spoken = document.createElement("span");
      spoken.className = "hud-toast-sr";
      spoken.textContent = SPOKEN[tone];
      title.append(spoken);
    }
    fill(title, opts.title);
    li.append(tag, title);

    if (dismissible) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "hud-toast-close";
      close.setAttribute("aria-label", closeLabel);
      close.textContent = "×";
      close.addEventListener("click", () => entry.dismiss("close"));
      li.append(close);
    }

    if (opts.description != null) {
      const text = document.createElement("p");
      text.className = "hud-toast-text";
      fill(text, opts.description);
      li.append(text);
    }

    if (action?.label) {
      const row = document.createElement("div");
      row.className = "hud-toast-actions";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hud-actuator hud-actuator--sm hud-actuator--ghost";
      button.textContent = action.label;
      button.addEventListener("click", (e) => {
        action.onClick?.(e);
        if (!e.defaultPrevented) entry.dismiss("action");
      });
      row.append(button);
      li.append(row);
    }

    const entry = {
      li,
      remaining: duration,
      started: 0,
      timer: 0,
      closed: false,
      run() {
        if (entry.timer || entry.closed || !Number.isFinite(entry.remaining)) return;
        entry.started = performance.now();
        entry.timer = setTimeout(() => entry.dismiss("timeout"), Math.max(0, entry.remaining));
      },
      hold() {
        if (!entry.timer) return;
        clearTimeout(entry.timer);
        entry.timer = 0;
        entry.remaining -= performance.now() - entry.started;
      },
      dismiss(reason = "api") {
        if (entry.closed) return;
        entry.hold();
        entry.closed = true;
        const index = entries.indexOf(entry);
        entries.splice(index, 1);

        if (li.contains(document.activeElement)) {
          const visible = entries.filter((x) => !x.li.hidden);
          const next = visible.find((x) => entries.indexOf(x) >= index) ?? visible[visible.length - 1];
          const back = restoreFocus?.isConnected ? restoreFocus : null;
          if (next) next.li.focus();
          else if (back) back.focus();
          else li.blur();
          if (!next) restoreFocus = null;
        }

        li.inert = true;
        li.dataset.state = "closing";
        li.dispatchEvent(new CustomEvent("hud-toast-dismiss", { bubbles: true, detail: { tone, reason } }));

        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          li.remove();
          sync();
        };
        const running = li.getAnimations();
        if (!running.length) return finish();
        Promise.allSettled(running.map((a) => a.finished)).then(finish);
        /* A throttled or frozen document may never advance the exit;
           never leave a dead toast on screen past its own length. */
        const length = Math.max(...running.map((a) => a.effect?.getComputedTiming().endTime ?? 0));
        setTimeout(finish, (Number.isFinite(length) ? length : 0) + 50);
      },
    };

    entries.push(entry);
    if (newestFirst(placement)) list.prepend(li);
    else list.append(li);
    sync();
    announce(tone, [SPOKEN[tone] + textOf(opts.title), textOf(opts.description)].filter(Boolean).join(". "));
    li.dispatchEvent(new CustomEvent("hud-toast-show", { bubbles: true, detail: { tone } }));

    return { dismiss: () => entry.dismiss("api"), element: li };
  }

  function dismissAll() {
    for (const entry of [...entries]) entry.dismiss("api");
  }

  /* Move the region to another corner, open toasts included. Crossing
     the block axis reverses the list so the newest stays nearest the
     pinned edge; the toast holding focus is the one node not moved, so
     focus survives. The moved ones replay their entrance. */
  function setPlacement(next) {
    const p = placementOf(next);
    if (destroyed || p === placement) return;
    const flip = newestFirst(p) !== newestFirst(placement);
    placement = p;
    if (!region) return;
    region.dataset.placement = p;
    if (!flip) return;
    const items = [...list.children].reverse();
    const keep = items.find((li) => li.contains(document.activeElement));
    if (!keep) return list.append(...items);
    const k = items.indexOf(keep);
    keep.before(...items.slice(0, k));
    keep.after(...items.slice(k + 1));
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    for (const entry of entries) entry.hold();
    entries.length = 0;
    for (const t of pending) clearTimeout(t);
    pending.clear();
    if (region) {
      document.removeEventListener("visibilitychange", sync);
      if (matchHotkey) document.removeEventListener("keydown", onHotkey);
      region.remove();
      region = null;
    }
    const i = regions.indexOf(api);
    if (i >= 0) regions.splice(i, 1);
  }

  const api = {
    toast,
    dismissAll,
    setPlacement,
    get placement() {
      return placement;
    },
    destroy,
    get element() {
      return region;
    },
  };
  regions.push(api);
  return api;
}

export function toast(options) {
  if (!hasDom()) return NOOP_TOAST;
  const region = regions.at(-1) ?? toastRegion();
  return region.toast(options);
}
