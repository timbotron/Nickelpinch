/**
 * slider() and rangeSlider() — readouts for .hud-slider, and the
 * two-thumb range. No framework, no dependency.
 *
 *   import { slider, rangeSlider } from "@valeness/hangar/slider";
 *
 *   const gain = slider(document.querySelector("#gain"), {
 *     format: (v) => String(v).padStart(3, "0"),   // the readout: "040"
 *     valuetext: (v) => `${v} percent`,            // what a screen reader hears
 *   });
 *   gain.setValue(75);                             // from code: redraws, no event
 *
 *   const latency = rangeSlider(document.querySelector(".hud-slider-range"), {
 *     output: document.querySelector("#latency-out"),
 *     format: ([lo, hi]) => `${lo}–${hi}`,
 *     valuetext: (v) => `${v} milliseconds`,
 *   });
 *   latency.el.addEventListener("hud-change", (e) => filter(e.detail.value)); // [120, 380]
 *   latency.setValue([100, 300]);                  // from code: no event
 *
 * The single slider needs no script to look right: its filled run is
 * CSS (instruments/slider.css). slider() is for what the platform
 * does not do — writing the value into a readout as it moves, and
 * giving the input an aria-valuetext with its unit. The readout is
 * `output` if you pass one, else an <output> whose `for` names the
 * input's id; output: null means none. Both are refreshed on every
 * input event and after the owning form resets.
 *
 * rangeSlider() takes the .hud-slider-range wrapper and its two
 * range inputs, low first. It keeps low ≤ high (a thumb pushed past
 * the other stops against it), writes the run between them to
 * --hud-slider-lo and --hud-slider-hi (0–1) on the wrapper for the
 * CSS to draw, and keeps the thumb you can still move on top when
 * the two meet at an end of the track. It fires `hud-change` on the
 * wrapper (bubbling) on every user movement, detail { value: [lo,
 * hi], item } — the native input/change events still bubble too. A
 * thumb pushed past the other is put back in the input event's capture
 * phase, through the platform's value setter rather than any override
 * a framework installs on the element, so listeners on the inputs and
 * frameworks that track value writes only ever see the corrected
 * value. min and max are read from the low input each time.
 *
 * Both return { update(), setValue(), destroy() } (rangeSlider adds el
 * and a live value). setValue(v) — a number, or [lo, hi] in either
 * order for the range — sets the inputs from code and redraws.
 * update() redraws after you set the value, min or max yourself. The
 * browser fires no event for a value set from code and neither do
 * these, so a framework can push its state in without it coming back.
 * destroy() removes the listeners and restores what it wrote —
 * aria-valuetext (when valuetext was given), --hud-slider-lo/-hi and
 * the thumbs' z-index — to how it found them; the values and the
 * readout's text stay.
 *
 * FRAMEWORKS. The inputs may be controlled (React value= + onChange,
 * Vue v-model): the readout, run and aria-valuetext follow a user
 * move on their own, and after the framework changes the value — or
 * min/max — call update() (React: an effect on the value; Vue: a watch
 * with flush: "post"). Or keep the inputs uncontrolled, take the value
 * from `input` / hud-change and push yours with setValue(). The
 * readout element's text is slider()'s: render it empty, or pass
 * output: null and render the number yourself.
 */

const hasDom = () => typeof document !== "undefined";

const inert = (el) => ({ el, value: null, update() {}, setValue() {}, destroy() {} });

/* Put back an attribute as it was found. */
const restoreAttr = (el, name, was) => (was == null ? el.removeAttribute(name) : el.setAttribute(name, was));

/* The <output> that names this input in its `for` list, if any. */
function outputFor(input) {
  if (!input.id) return null;
  const root = input.getRootNode();
  for (const out of root.querySelectorAll?.("output") ?? []) {
    if (out.htmlFor.contains(input.id)) return out;
  }
  return null;
}

/* After a form reset the values revert once the event is done. */
function onReset(input, fn) {
  const form = input.form;
  if (!form) return () => {};
  let timer = 0;
  const handler = () => {
    clearTimeout(timer);
    timer = setTimeout(fn);
  };
  form.addEventListener("reset", handler);
  return () => {
    clearTimeout(timer);
    form.removeEventListener("reset", handler);
  };
}

/** Readout and aria-valuetext for one .hud-slider. */
export function slider(input, options = {}) {
  if (!hasDom() || !input) return inert(input);
  const { output = outputFor(input), format = String, valuetext } = options;
  const savedText = input.getAttribute("aria-valuetext");

  const update = () => {
    const v = input.valueAsNumber;
    if (output) output.textContent = format(v);
    if (valuetext) input.setAttribute("aria-valuetext", valuetext(v));
  };

  input.addEventListener("input", update);
  const unreset = onReset(input, update);
  update();

  return {
    update,
    /** Set the value from code and redraw. No event. */
    setValue(v) {
      input.value = String(v);
      update();
    },
    destroy() {
      input.removeEventListener("input", update);
      unreset();
      if (valuetext) restoreAttr(input, "aria-valuetext", savedText);
    },
  };
}

/** Two thumbs over one track: .hud-slider-range with two range inputs. */
export function rangeSlider(root, options = {}) {
  if (!hasDom() || !root) return inert(root);
  const [lo, hi] = root.querySelectorAll('input[type="range"]');
  if (!lo || !hi) return inert(root);

  const {
    output = null,
    format = ([a, b]) => `${a}–${b}`,
    valuetext,
  } = options;

  const saved = {
    run: ["--hud-slider-lo", "--hud-slider-hi"].map((name) => [name, root.style.getPropertyValue(name)]),
    z: [lo.style.zIndex, hi.style.zIndex],
    text: [lo.getAttribute("aria-valuetext"), hi.getAttribute("aria-valuetext")],
  };

  // A thumb pushed past the other is put back during the input event's
  // capture phase — before listeners on the input itself (Vue's v-model)
  // run — and through the prototype's value setter, which a framework
  // tracking .value writes (React's controlled inputs) does not see, so
  // both read the corrected value as the user's input.
  const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;

  let top = hi;
  let last = null;

  const sync = (moved) => {
    // Read each time: the app may move min/max after init.
    const min = Number(lo.min || 0);
    const max = Number(lo.max || 100);
    const span = max - min || 1;
    let a = lo.valueAsNumber;
    let b = hi.valueAsNumber;
    if (a > b) {
      if (moved) setInput.call(moved, String(moved === hi ? a : b));
      else lo.value = String(b);
      a = lo.valueAsNumber;
      b = hi.valueAsNumber;
    }

    root.style.setProperty("--hud-slider-lo", String((a - min) / span));
    root.style.setProperty("--hud-slider-hi", String((b - min) / span));

    // Stacked thumbs: at the top end only the low one can move, at
    // the bottom only the high one; elsewhere the last one used.
    if (moved) top = moved;
    if (a === b && b >= max) top = lo;
    else if (a === b && a <= min) top = hi;
    lo.style.zIndex = top === lo ? "2" : "";
    hi.style.zIndex = top === hi ? "2" : "";

    if (output) output.textContent = format([a, b]);
    if (valuetext) {
      lo.setAttribute("aria-valuetext", valuetext(a));
      hi.setAttribute("aria-valuetext", valuetext(b));
    }

    const changed = !last || last[0] !== a || last[1] !== b;
    last = [a, b];
    if (moved && changed) {
      root.dispatchEvent(
        new CustomEvent("hud-change", { bubbles: true, detail: { value: [a, b], item: moved } })
      );
    }
  };

  const onInput = (e) => {
    if (e.target === lo || e.target === hi) sync(e.target);
  };
  root.addEventListener("input", onInput, true);
  const unreset = onReset(lo, () => sync(null));
  sync(null);

  return {
    el: root,
    get value() {
      return [lo.valueAsNumber, hi.valueAsNumber];
    },
    update: () => sync(null),
    /** Set [lo, hi] from code (either order) and redraw. No event. */
    setValue([a, b]) {
      lo.value = String(Math.min(a, b));
      hi.value = String(Math.max(a, b));
      sync(null);
    },
    destroy() {
      root.removeEventListener("input", onInput, true);
      unreset();
      for (const [name, was] of saved.run) {
        if (was) root.style.setProperty(name, was);
        else root.style.removeProperty(name);
      }
      [lo.style.zIndex, hi.style.zIndex] = saved.z;
      if (valuetext) {
        restoreAttr(lo, "aria-valuetext", saved.text[0]);
        restoreAttr(hi, "aria-valuetext", saved.text[1]);
      }
    },
  };
}
