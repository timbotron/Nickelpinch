/**
 * deny() — the refusal glitch. No framework, no dependency.
 *
 *   import { deny } from "@valeness/hangar/deny";
 *   commitButton.addEventListener("click", () => {
 *     if (!dirty) { message.textContent = "Nothing to commit"; deny(commitButton); }
 *   });
 *
 * The element loses signal for ~0.7s, modelled on the keyframes
 * cyberpunk.net ships for its own glitch (bands of a duplicated layer
 * shoved ±5px on a −2° tilt, with hard "clip to nothing" cuts), pushed
 * further with things only a real copy of the element allows:
 *
 *   SLICES      the element is re-drawn as seven horizontal bands, each
 *               a clone of it; a new random partition every frame, some
 *               bands shoved sideways, some tinted red or cyan
 *   RGB SPLIT   red and cyan ghosts of the whole element, offset in
 *               opposite directions and blended (screen on dark, multiply
 *               on light) so only the fringes show colour
 *   HOT BAND    the cyberpunk.net layer itself: one band of a yellow,
 *               cyan-framed, −2°-tilted copy, on the exact band
 *               positions from their keyframes
 *   CORRUPTION  red/cyan/yellow slabs, striped noise and inverted blocks
 *   SCRAMBLE    the copies' text decays into hex and symbols, same
 *               length, so nothing reflows
 *   DROPOUTS    whole frames where the element is simply gone
 *   NEGATIVE    one frame of the second hit flips to negative
 *   AFTERGLOW   a red frame blinks twice, then everything is removed
 *
 * The real element is never restyled beyond its opacity (a Web
 * Animation, cancelled at the end — no attribute, class or inline style
 * is written), never moved in the DOM and never loses focus; the
 * copies live in an aria-hidden, inert overlay inserted as its next
 * sibling for the duration and then removed. The copies carry no ids
 * and no names, so a copied checked radio cannot uncheck the real one.
 * Colours are CSS (interactions.css: --hud-deny-a, default
 * --hud-error; --hud-deny-b, default --hud-hue-6; --hud-deny-c, default --hud-warn —
 * derived from cyberpunk.net's own glitch, see .hud-glitch there) — this
 * file only moves geometry.
 *
 * Frameworks: safe on an element React, Vue or any framework renders.
 * They insert their own nodes relative to their own nodes, so the
 * transient overlay does not disturb them. If the framework removes,
 * replaces or moves the element (or drops the overlay) mid-glitch, the
 * glitch ends at once and the Promise resolves.
 *
 * Honours prefers-reduced-motion (a steady red frame for the same
 * duration, no motion) and data-hud="off" (nothing). Returns a Promise
 * that resolves when the element is back to normal. Calling it again on
 * the same element restarts it.
 *
 * Options:
 *   seed   number — a fixed seed gives the same glitch every time
 *          (tests, screenshots); default random.
 *
 * Always pair it with text that says WHY. The glitch only says "no".
 */

/* Glitch frames at ~33fps: deliberately choppy, every change a hard cut. */
const FRAME = 28;
const GLOW = 50;

/* Intensity per frame. 0 is a clean frame, -1 a dropout (element gone).
   Hit, dropout, hit, hold, twitch, second hit with a dropout, decay. */
const SCRIPT = [1, 0.85, -1, 1, 0.5, 0, 0, 0.25, 0, 0.9, 1, -1, 0.7, 1, 0.4, 0.15, 0, 0.1, 0];

/* Afterglow: the red frame blinks on, off, on. */
const GLOW_SCRIPT = [1, 0, 1];

/* [top %, bottom %] — the band positions in cyberpunk.net's keyframes. */
const CP_BANDS = [[2, 5], [78, 100], [44, 54], [40, 60], [40, 85], [63, 80], [0, 10]];

const SLICES = 7;
const BLOCK_POOL = ["a", "a", "b", "b", "c", "inv", "noise"];
const GLYPHS = "0123456789ABCDEF#%&*+=<>/\\|_";

/* Interaction classes a copy must not carry, or it would replay them. */
const STRIP = [
  "hud-flash-in", "hud-blip", "hud-scan-once", "hud-acquire", "hud-deny",
  "hud-alert", "hud-pulse", "hud-pulse--ok", "hud-pulse--warn", "hud-pulse--error",
];

const running = new WeakMap();

/* mulberry32 — small, fast, good enough to look random. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Everything random is decided up front, so a seed fully determines the
   glitch and the render loop only ever looks frames up. */
function plan(seed, texts) {
  const r = rng(seed);
  const pick = (lo, hi) => lo + r() * (hi - lo);
  const sign = () => (r() < 0.5 ? -1 : 1);
  const negative = SCRIPT.lastIndexOf(1);

  return SCRIPT.map((I, index) => {
    const f = { I, hit: I >= 0.35, twitch: I > 0 && I < 0.35, dropout: I < 0 };
    if (I <= 0) return f;

    const jolt = sign() * pick(0, 6 * I);
    /* Tight fringes, and not on every frame: a constant split reads as
       a style, an intermittent one as a fault. */
    f.ghost = f.twitch || r() < 0.7 ? pick(1.5, 1.5 + 3 * I) : null;
    f.jolt = jolt;
    f.negative = index === negative;
    f.hot = r() < 0.7
      ? { band: CP_BANDS[Math.floor(r() * CP_BANDS.length)], dx: sign() * pick(3, 7) }
      : null;

    if (f.hit) {
      const cuts = Array.from({ length: SLICES - 1 }, r).sort((a, b) => a - b);
      const edges = [0, ...cuts.map((c) => c * 100), 100];
      f.slices = edges.slice(0, -1).map((top, i) => {
        const moved = r() < 0.3 + 0.45 * I;
        return {
          top,
          bottom: edges[i + 1],
          dx: jolt + (moved ? sign() * pick(3, 4 + 22 * I) : 0),
          tint: moved && r() < 0.45 ? (r() < 0.5 ? "a" : "b") : null,
        };
      });

      const count = Math.floor(pick(0, 1 + 3 * I));
      const free = BLOCK_POOL.map((_, i) => i);
      f.blocks = [];
      for (let n = 0; n < count && free.length; n++) {
        const slot = free.splice(Math.floor(r() * free.length), 1)[0];
        f.blocks.push({
          slot,
          left: pick(-6, 88), width: pick(6, 40),
          top: pick(-4, 92), height: pick(4, 22),
        });
      }
    }

    const ratio = pick(0.1, 0.2 + 0.5 * I);
    f.text = texts.map((s) =>
      s.replace(/\S/g, (ch) => (r() < ratio ? GLYPHS[Math.floor(r() * GLYPHS.length)] : ch)),
    );
    return f;
  });
}

function textNodes(root) {
  const out = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.data.trim()) out.push(n);
  return out;
}

function part(cls, children = []) {
  const n = document.createElement("div");
  n.className = cls;
  n.append(...children);
  return n;
}

/* A copy of the element that renders like it: same classes minus the
   interaction ones, live form state carried over, no ids, no names,
   pinned to the element's border-box size at the overlay's origin.
   Without the names a checked radio copy joins no radio group — in the
   document, a same-named one would uncheck the real control. */
function copyOf(el, w, h, display) {
  const c = el.cloneNode(true);
  c.classList.remove(...STRIP);
  c.removeAttribute("id");
  for (const n of c.querySelectorAll("[id]")) n.removeAttribute("id");
  c.removeAttribute("name");
  for (const n of c.querySelectorAll("[name]")) n.removeAttribute("name");

  const fields = "input, select, textarea";
  const src = [el.matches(fields) ? el : null, ...el.querySelectorAll(fields)].filter(Boolean);
  const dst = [c.matches(fields) ? c : null, ...c.querySelectorAll(fields)].filter(Boolean);
  src.forEach((s, i) => {
    if (!dst[i]) return;
    dst[i].value = s.value;
    if ("checked" in s) dst[i].checked = s.checked;
  });

  Object.assign(c.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: `${w}px`,
    height: `${h}px`,
    margin: "0",
    boxSizing: "border-box",
    animation: "none",
    transition: "none",
  });
  if (display === "inline") c.style.display = "inline-block";
  return c;
}

/* Place the overlay exactly over the element, whatever its containing
   block turns out to be: pin at 0,0, measure, correct. */
function place(layer, el, w, h) {
  Object.assign(layer.style, { left: "0px", top: "0px", width: `${w}px`, height: `${h}px` });
  const a = el.getBoundingClientRect();
  const b = layer.getBoundingClientRect();
  layer.style.left = `${a.left - b.left}px`;
  layer.style.top = `${a.top - b.top}px`;
}

export function deny(el, options = {}) {
  if (typeof document === "undefined" || !el?.isConnected) return Promise.resolve();
  if (el.closest('[data-hud="off"]')) return Promise.resolve();

  running.get(el)?.();

  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (!w || !h) return Promise.resolve();

  const cs = getComputedStyle(el);
  const shape = { clipPath: cs.clipPath, borderRadius: cs.borderRadius };
  const shaped = (n) => (Object.assign(n.style, shape), n);

  const layer = part("hud-glitch");
  layer.setAttribute("aria-hidden", "true");
  layer.inert = true;

  const frame = shaped(part("hud-glitch-frame"));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  return new Promise((resolve) => {
    const anims = [];
    let alive = true;
    let raf = 0;

    /* A framework may remove, replace or move the element mid-glitch
       (or drop the overlay). Nothing is left to cover then, so end at
       once rather than leave a ghost where the element was. */
    const parent = el.parentNode;
    const watch = new MutationObserver(() => {
      if (!el.isConnected || el.nextSibling !== layer) stop();
    });
    const insert = () => {
      el.after(layer);
      watch.observe(parent, { childList: true });
    };

    const stop = () => {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      watch.disconnect();
      for (const a of anims) a.cancel();
      layer.remove();
      running.delete(el);
      resolve();
    };
    running.set(el, stop);

    /* Reduced motion: the same "no", as a steady frame — no movement. */
    if (reduced) {
      layer.append(frame);
      insert();
      place(layer, el, w, h);
      const a = frame.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 700 });
      anims.push(a);
      a.finished.then(stop, stop);
      return;
    }

    /* ---- build the overlay ---- */
    const seed = options.seed ?? Math.floor(Math.random() * 2 ** 32);
    const originals = textNodes(el).map((n) => n.data);
    const frames = plan(seed, originals);
    const copies = [];
    const copy = () => {
      const c = copyOf(el, w, h, cs.display);
      copies.push(textNodes(c));
      return c;
    };

    const slices = Array.from({ length: SLICES }, () => {
      const ta = shaped(part("hud-glitch-tint"));
      const tb = shaped(part("hud-glitch-tint hud-glitch-tint--b"));
      return { node: part("hud-glitch-slice", [copy(), ta, tb]), ta, tb };
    });
    const sliceBox = part("hud-glitch-slices", slices.map((s) => s.node));
    const ghostA = part("hud-glitch-ghost", [copy(), shaped(part("hud-glitch-tint"))]);
    const ghostB = part("hud-glitch-ghost", [copy(), shaped(part("hud-glitch-tint hud-glitch-tint--b"))]);
    const hot = part("hud-glitch-hot", [copy(), shaped(part("hud-glitch-hot-line"))]);
    /* cyberpunk.net tilts its layer −2°; on a wide host that is a long
       diagonal, so cap the drift at the ends to ~3px. */
    hot.style.setProperty("--_tilt", `${-Math.min(2, (Math.atan(6 / w) * 180) / Math.PI)}deg`);
    const blocks = BLOCK_POOL.map((type) => part(`hud-glitch-block hud-glitch-block--${type}`));
    const scan = shaped(part("hud-glitch-scan"));

    layer.append(sliceBox, ghostA, ghostB, hot, ...blocks, scan, frame);
    insert();
    place(layer, el, w, h);

    /* ---- timeline ---- */
    const times = [];
    let t = 0;
    for (let i = 0; i < frames.length; i++, t += FRAME) times.push(t);
    for (let i = 0; i < GLOW_SCRIPT.length; i++, t += GLOW) times.push(t);
    const total = t;
    const at = (i) => frames[i] ?? { I: 0, glow: GLOW_SCRIPT[i - frames.length] };

    /* One WAAPI animation per node: a stepped keyframe per frame, then
       the node's resting value. Pausing any of them freezes a frame. */
    const track = (node, perFrame, rest) => {
      const kfs = times.map((time, i) => ({ offset: time / total, easing: "steps(1, end)", ...perFrame(at(i)) }));
      kfs.push({ offset: 1, ...rest });
      const a = node.animate(kfs, { duration: total });
      anims.push(a);
      return a;
    };

    const shown = (f) => f.hit || f.twitch;
    const hidden = { opacity: 0 };
    const full = "inset(0 -64px 0 -64px)";

    const master = track(el, (f) => ({ opacity: f.hit || f.dropout ? 0 : cs.opacity }), { opacity: cs.opacity });

    track(sliceBox, (f) => ({
      opacity: f.hit ? 1 : 0,
      filter: f.negative ? "invert(1) hue-rotate(180deg)" : "none",
    }), hidden);

    slices.forEach((s, i) => {
      const band = (f) => f.slices?.[i];
      track(s.node, (f) => ({
        clipPath: band(f) ? `inset(${band(f).top}% -64px ${100 - band(f).bottom}% -64px)` : full,
        translate: `${band(f)?.dx ?? 0}px 0px`,
      }), { clipPath: full, translate: "0px 0px" });
      track(s.ta, (f) => ({ opacity: band(f)?.tint === "a" ? 0.85 : 0 }), hidden);
      track(s.tb, (f) => ({ opacity: band(f)?.tint === "b" ? 0.85 : 0 }), hidden);
    });

    track(ghostA, (f) => ({
      opacity: shown(f) && f.ghost ? 0.7 : 0,
      translate: `${(f.jolt ?? 0) - (f.ghost ?? 0)}px -1px`,
    }), hidden);
    track(ghostB, (f) => ({
      opacity: shown(f) && f.ghost ? 0.7 : 0,
      translate: `${(f.jolt ?? 0) + (f.ghost ?? 0)}px 1px`,
    }), hidden);

    track(hot, (f) => ({
      opacity: shown(f) && f.hot ? 1 : 0,
      clipPath: f.hot ? `inset(${f.hot.band[0]}% -24px ${100 - f.hot.band[1]}% -24px)` : full,
      translate: `${f.hot?.dx ?? 0}px 0px`,
    }), hidden);

    blocks.forEach((b, slot) => {
      track(b, (f) => {
        const blk = f.blocks?.find((x) => x.slot === slot);
        return blk
          ? { opacity: 1, left: `${blk.left}%`, top: `${blk.top}%`, width: `${blk.width}%`, height: `${blk.height}%` }
          : { opacity: 0, left: "0%", top: "0%", width: "0%", height: "0%" };
      }, hidden);
    });

    /* Scanlines stay under the shoved bands during hits; only on a
       dropout, with nothing else left, do they carry the frame. */
    track(scan, (f) => ({ opacity: f.hit ? 0.3 * f.I : f.dropout ? 0.8 : 0 }), hidden);
    track(frame, (f) => ({ opacity: f.glow ?? 0 }), hidden);

    /* Text can't be keyframed, so it follows the master clock — which
       also means a paused or scrubbed animation shows the right text. */
    let last = -1;
    const tick = () => {
      if (!alive) return;
      const now = Number(master.currentTime ?? 0);
      let i = times.length - 1;
      while (i > 0 && times[i] > now) i--;
      if (i !== last) {
        last = i;
        const text = frames[i]?.text ?? originals;
        for (const nodes of copies) nodes.forEach((n, k) => { n.data = text[k] ?? n.data; });
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    master.finished.then(stop, stop);
  });
}
