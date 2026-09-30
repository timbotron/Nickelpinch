/**
 * resizable() — drag and keyboard resizing for a .hud-split panel
 * group. No framework, no dependency.
 *
 *   import { resizable } from "@valeness/hangar/resizable";
 *
 *   const split = resizable(document.querySelector(".hud-split"), {
 *     min: 15,                 // smallest a panel may be, % of the group
 *     max: 85,                 // largest
 *     step: 5,                 // one arrow press, %
 *     storageKey: "app.split", // remember sizes in localStorage
 *   });
 *   group.addEventListener("hud-resize", (e) => chart.reflow());
 *   split.sizes;               // [28, 72]
 *   split.setSizes([40, 60]);  // from app state: no event
 *   split.destroy();
 *
 * Each handle is a WAI-ARIA window splitter. Its value is the size of
 * the panel before it, as a percentage of the whole group; moving it
 * trades space with the panel after it and nothing else.
 *
 *   pointer          drag, with pointer capture (touch and pen too)
 *   Left / Right     on a side-by-side group; mirrored under rtl, so
 *                    the arrow always moves the handle the way it points
 *   Up / Down        on a stacked (--vertical) group
 *   Home / End       the smallest / largest the panel before may be
 *   Enter            collapse the panel before to 0; again to restore
 *
 * Per-panel limits: data-min / data-max on a .hud-split-panel override
 * min / max for that panel. A collapsed panel gets data-collapsed (the
 * CSS hides it, taking its contents out of the tab order) and its
 * handle aria-valuetext="Collapsed".
 *
 * Only the group's own panels and handles are touched: a group nested
 * in a panel is left alone, so call resizable() on each group.
 *
 * The handle gets role="separator", tabindex="0", aria-orientation and
 * aria-controls (pointing at the panel before; an id is generated if
 * it has none) when the markup leaves them out. aria-label is yours.
 *
 * Fires "hud-resize" on the group whenever a user changes the sizes —
 * continuously while dragging — with detail { sizes, handle, dragging }.
 * Sizes are written back as --hud-split-size on each panel, so they
 * survive a destroy(). With no DOM, returns an inert handle.
 *
 * Returns { sizes, setSizes(sizes), destroy() }. setSizes() takes one
 * number per panel (any scale; normalised to sum to 100), brings them
 * within the limits as a stored layout is, updates the panels, the
 * handles' ARIA and storageKey — and fires no event, so app state can
 * be pushed in without echoing back. A list of the wrong length is
 * ignored. destroy() removes the listeners and every attribute it set
 * on the handles (and generated panel ids); --hud-split-size and
 * data-collapsed stay.
 *
 * Frameworks: panels and handles may be re-rendered. The group's
 * children are watched (a MutationObserver): sizes follow their panels,
 * a new panel takes its own --hud-split-size or an even share, the set
 * is normalised again, and new handles are wired — no refresh call.
 * Once resizable() runs it owns --hud-split-size: give the starting
 * sizes in markup or through setSizes(), not a style binding that
 * re-renders (a Vue :style object re-applies every key on each patch).
 */

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
   was rendered. prune() hands back and forgets elements that have left,
   so a re-rendering list does not keep every node it ever had alive. */
function ledger() {
  const saved = new Map();
  const note = (el, name) => {
    let attrs = saved.get(el);
    if (!attrs) saved.set(el, (attrs = new Map()));
    if (!attrs.has(name)) attrs.set(name, el.getAttribute(name));
  };
  const put = (el, attrs) => {
    for (const [name, was] of attrs) {
      if (was === null) el.removeAttribute(name);
      else el.setAttribute(name, was);
    }
  };
  return {
    set(el, name, value) {
      note(el, name);
      el.setAttribute(name, value);
    },
    remove(el, name) {
      if (!el.hasAttribute(name)) return;
      note(el, name);
      el.removeAttribute(name);
    },
    prune(keep) {
      for (const [el, attrs] of saved) {
        if (keep(el)) continue;
        put(el, attrs);
        saved.delete(el);
      }
    },
    restore() {
      for (const [el, attrs] of saved) put(el, attrs);
      saved.clear();
    },
  };
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const round = (n) => Math.round(n * 100) / 100;
const num = (value, fallback) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

/* A panel's own --hud-split-size (inline, or from a stylesheet); null
   when it has none. */
const declared = (panel) => {
  const v = parseFloat(
    panel.style.getPropertyValue("--hud-split-size") || getComputedStyle(panel).getPropertyValue("--hud-split-size")
  );
  return Number.isFinite(v) && v >= 0 ? v : null;
};

/* Sizes for `raw` (null where unknown), normalised to sum to 100.
   Unknown panels split what the known ones leave; `floor` is each
   one's share when nothing is left. */
const fit = (raw, floor) => {
  const known = raw.filter((v) => v !== null);
  const missing = raw.length - known.length;
  const left = Math.max(0, 100 - known.reduce((a, b) => a + b, 0));
  const share = missing ? (left > 0 ? left / missing : floor) : 0;
  const out = raw.map((v) => (v === null ? share : v));
  const total = out.reduce((a, b) => a + b, 0);
  return total > 0 ? out.map((v) => (v * 100) / total) : out.map(() => 100 / out.length);
};

export function resizable(group, options = {}) {
  if (!hasDom() || !group) return { sizes: [], setSizes() {}, destroy() {} };

  const { min = 10, max = 90, step = 5, storageKey } = options;

  const vertical = () => group.classList.contains("hud-split--vertical");
  const rtl = () => getComputedStyle(group).direction === "rtl";
  const panels = () => [...group.children].filter((el) => el.classList.contains("hud-split-panel"));
  const handles = () => [...group.children].filter((el) => el.classList.contains("hud-split-handle"));
  const ownHandle = (node) => {
    const h = node instanceof Element ? node.closest(".hud-split-handle") : null;
    return h && h.parentElement === group ? h : null;
  };

  /* ---- sizes ---- */
  const initial = () => {
    const ps = panels();
    let out = fit(ps.map(declared), 0);

    const stored = storageKey ? readStored(storageKey) : null;
    if (stored) {
      try {
        const saved = JSON.parse(stored);
        const ok = Array.isArray(saved) && saved.length === ps.length && saved.every((v) => Number.isFinite(v) && v >= 0);
        const t = ok ? saved.reduce((a, b) => a + b, 0) : 0;
        if (ok && t > 0) out = saved.map((v) => (v * 100) / t);
      } catch {
        /* a bad stored value is simply ignored */
      }
    }
    return out;
  };

  let seen = panels(); // the panels `sizes` lines up with
  let sizes = initial();
  const restore = new WeakMap();
  const attrs = ledger();

  const limits = (panel) => ({
    lo: num(panel?.dataset.min, min),
    hi: num(panel?.dataset.max, max),
  });

  /* The two panels a handle sits between, and how far it may move. */
  const pair = (h) => {
    const ps = panels();
    const i = ps.indexOf(h.previousElementSibling);
    const j = ps.indexOf(h.nextElementSibling);
    if (i < 0 || j < 0) return null;
    const total = sizes[i] + sizes[j];
    const a = limits(ps[i]);
    const b = limits(ps[j]);
    let lo = Math.max(0, a.lo, total - b.hi);
    let hi = Math.min(total, a.hi, total - b.lo);
    if (lo > hi) lo = hi = clamp(sizes[i], Math.min(lo, hi), Math.max(lo, hi));
    return { i, j, total, lo, hi };
  };

  const sync = () => {
    const ps = panels();
    ps.forEach((p, k) => {
      p.style.setProperty("--hud-split-size", String(round(sizes[k] ?? 0)));
      p.toggleAttribute("data-collapsed", (sizes[k] ?? 0) === 0);
    });
    for (const h of handles()) {
      const r = pair(h);
      if (!r) continue;
      attrs.set(h, "aria-valuenow", String(Math.round(sizes[r.i])));
      attrs.set(h, "aria-valuemin", String(Math.round(r.lo)));
      attrs.set(h, "aria-valuemax", String(Math.round(r.hi)));
      if (sizes[r.i] === 0) attrs.set(h, "aria-valuetext", "Collapsed");
      else attrs.remove(h, "aria-valuetext");
    }
  };

  const save = () => {
    if (storageKey) writeStored(storageKey, JSON.stringify(sizes.map(round)));
  };

  const emit = (handle, dragging) => {
    group.dispatchEvent(
      new CustomEvent("hud-resize", { bubbles: true, detail: { sizes: sizes.map(round), handle, dragging } })
    );
  };

  /* Put the panel before `h` at `value`, within limits. */
  const place = (h, value, dragging = false) => {
    const r = pair(h);
    if (!r) return false;
    const v = clamp(value, r.lo, r.hi);
    if (Math.abs(v - sizes[r.i]) < 0.005) return false;
    sizes[r.i] = v;
    sizes[r.j] = r.total - v;
    restore.delete(h);
    sync();
    emit(h, dragging);
    return true;
  };

  const collapseOrRestore = (h) => {
    const r = pair(h);
    if (!r) return;
    if (sizes[r.i] > 0) {
      restore.set(h, sizes[r.i]);
      sizes[r.i] = 0;
      sizes[r.j] = r.total;
    } else {
      const back = clamp(restore.get(h) ?? r.lo, r.lo, r.hi);
      restore.delete(h);
      sizes[r.i] = back;
      sizes[r.j] = r.total - back;
    }
    sync();
    save();
    emit(h, false);
  };

  /* ---- setup ---- */
  const ready = new WeakSet();
  const setup = (h) => {
    if (ready.has(h)) return false;
    ready.add(h);
    if (!h.hasAttribute("role")) attrs.set(h, "role", "separator");
    if (!h.hasAttribute("tabindex")) attrs.set(h, "tabindex", "0");
    attrs.set(h, "aria-orientation", vertical() ? "horizontal" : "vertical");
    const prev = h.previousElementSibling;
    if (prev?.classList.contains("hud-split-panel") && !h.hasAttribute("aria-controls")) {
      if (!prev.id) attrs.set(prev, "id", `hud-split-panel-${++uid}`);
      attrs.set(h, "aria-controls", prev.id);
    }
    return true;
  };

  // Markup (or a stored layout, or setSizes()) may start outside the
  // limits; bring it in now rather than jumping on the first key press.
  // A collapsed panel stays collapsed.
  const settle = () => {
    for (const h of handles()) {
      const r = pair(h);
      if (r && sizes[r.i] > 0) {
        const v = clamp(sizes[r.i], r.lo, r.hi);
        sizes[r.j] = r.total - v;
        sizes[r.i] = v;
      }
    }
  };

  /* A framework re-rendering the group adds, drops, replaces or reorders
     panels. Sizes follow their panels; a new one takes its own
     --hud-split-size or an even share, and the set is normalised again.
     New handles get the same ARIA as the first ones; panels and handles
     that left are handed back and forgotten. */
  const adopt = () => {
    attrs.prune((el) => {
      if (el.parentElement === group) return true;
      ready.delete(el);
      return false;
    });
    const now = panels();
    let fresh = false;
    for (const h of handles()) fresh = setup(h) || fresh;
    if (now.length === seen.length && now.every((p, k) => p === seen[k])) {
      if (fresh) sync();
      return;
    }
    const was = new Map(seen.map((p, k) => [p, sizes[k]]));
    sizes = fit(now.map((p) => (was.has(p) ? was.get(p) : declared(p))), 100 / (now.length || 1));
    seen = now;
    settle();
    sync();
  };

  for (const h of handles()) setup(h);
  settle();
  sync();

  const observer = typeof MutationObserver === "function" ? new MutationObserver(adopt) : null;
  observer?.observe(group, { childList: true });

  /* ---- keyboard ---- */
  const onKeyDown = (e) => {
    const h = ownHandle(e.target);
    if (!h || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const r = pair(h);
    if (!r) return;
    const now = sizes[r.i];
    const across = !vertical();
    let to;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowRight":
        if (!across) return;
        // The handle moves the way the arrow points. Under rtl the panel
        // before it is on the right, so Left makes it larger.
        to = now + ((e.key === "ArrowRight") !== rtl() ? step : -step);
        break;
      case "ArrowUp":
      case "ArrowDown":
        if (across) return;
        to = now + (e.key === "ArrowDown" ? step : -step);
        break;
      case "Home":
        to = r.lo;
        break;
      case "End":
        to = r.hi;
        break;
      case "Enter":
        e.preventDefault();
        collapseOrRestore(h);
        return;
      default:
        return;
    }
    e.preventDefault();
    // A collapsed panel only comes back by growing, never by shrinking.
    if (now === 0 && to < now) return;
    if (place(h, to)) save();
  };

  /* ---- pointer ---- */
  let drag = null;

  const axis = (e) => (vertical() ? e.clientY : e.clientX);

  const onPointerDown = (e) => {
    const h = ownHandle(e.target);
    if (!h || drag || e.button !== 0 || !e.isPrimary) return;
    const r = pair(h);
    if (!r) return;
    // No preventDefault: the handle's own mousedown focuses it the way
    // a click does (no focus ring), and user-select: none on the handle
    // and the dragging group keeps text from being selected.
    try {
      h.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    // The space the panels actually get — the group minus the handles.
    const span = panels().reduce((s, p) => {
      const b = p.getBoundingClientRect();
      return s + (vertical() ? b.height : b.width);
    }, 0);
    drag = { h, id: e.pointerId, from: axis(e), start: sizes[r.i], span: span || 1, flip: !vertical() && rtl(), moved: false };
    h.setAttribute("data-dragging", "");
    group.setAttribute("data-dragging", "");
  };

  const onPointerMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    let d = axis(e) - drag.from;
    if (drag.flip) d = -d;
    if (place(drag.h, drag.start + (d / drag.span) * 100, true)) drag.moved = true;
  };

  const onPointerEnd = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { h, moved } = drag;
    drag = null;
    try {
      if (h.hasPointerCapture(e.pointerId)) h.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    h.removeAttribute("data-dragging");
    group.removeAttribute("data-dragging");
    if (moved) {
      save();
      emit(h, false);
    }
  };

  group.addEventListener("keydown", onKeyDown);
  group.addEventListener("pointerdown", onPointerDown);
  group.addEventListener("pointermove", onPointerMove);
  group.addEventListener("pointerup", onPointerEnd);
  group.addEventListener("pointercancel", onPointerEnd);
  group.addEventListener("lostpointercapture", onPointerEnd);

  return {
    get sizes() {
      adopt();
      return sizes.map(round);
    },
    setSizes(values) {
      adopt();
      if (!Array.isArray(values) || values.length !== seen.length) return;
      if (!values.every((v) => Number.isFinite(v) && v >= 0)) return;
      const total = values.reduce((a, b) => a + b, 0);
      if (!(total > 0)) return;
      const before = sizes;
      sizes = values.map((v) => (v * 100) / total);
      settle();
      // Collapsing from code remembers the size to come back to, as
      // Enter does.
      for (const h of handles()) {
        const r = pair(h);
        if (!r) continue;
        if (sizes[r.i] === 0 && before[r.i] > 0) restore.set(h, before[r.i]);
        else if (sizes[r.i] > 0) restore.delete(h);
      }
      sync();
      save();
    },
    destroy() {
      observer?.disconnect();
      group.removeEventListener("keydown", onKeyDown);
      group.removeEventListener("pointerdown", onPointerDown);
      group.removeEventListener("pointermove", onPointerMove);
      group.removeEventListener("pointerup", onPointerEnd);
      group.removeEventListener("pointercancel", onPointerEnd);
      group.removeEventListener("lostpointercapture", onPointerEnd);
      if (drag) {
        drag.h.removeAttribute("data-dragging");
        group.removeAttribute("data-dragging");
        drag = null;
      }
      attrs.restore();
    },
  };
}
