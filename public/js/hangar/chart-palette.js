/**
 * chartPalette() — Hangar's tokens as concrete colours for any chart
 * library. No framework, no dependency.
 *
 *   import { chartPalette, onThemeChange } from "@valeness/hangar/chart-palette";
 *
 *   const p = chartPalette(chartContainer);
 *   // p.series      15 colours, stride-3 around the hue wheel
 *   // p.text        body text of the chart (legend, tooltips)
 *   // p.strong      titles, values under the pointer
 *   // p.muted       axis labels, the HUD-label colour
 *   // p.grid        gridlines          p.axis     axis lines, ticks
 *   // p.accent      the brand hue      p.accentSoft  hover/selection wash
 *   // p.crosshair   the one HUD mark allowed over a plot (translucent)
 *   // p.ok, p.warn, p.error   threshold and status lines
 *   // p.background  the surface the chart actually sits on
 *   // p.fontSans, p.fontMono  font stacks
 *
 *   const stop = onThemeChange(() => chart.update(themeFrom(chartPalette(chartContainer))), { el: chartContainer });
 *
 * WHY THIS EXISTS. Hangar's palette is OKLCH, and the browser reports it
 * back in OKLCH: getComputedStyle(el).color for --hud-hue-7 is
 * "oklch(0.78 0.14 35)", and a color-mix() token comes back as
 * "oklch(0.72 0.16 268 / 0.55)". SVG renderers accept that; canvas
 * libraries with their own colour parser (Chart.js, ECharts, uPlot,
 * Highcharts' Color for hover brightness) do not, and fail silently.
 * So every colour here is resolved in the element's real cascade —
 * theme, brand overrides, color-mix() all applied — then converted to
 * legacy "rgb(r, g, b)" / "rgba(r, g, b, a)", the one syntax every
 * parser has understood since 2010. Out-of-sRGB-gamut colours are
 * mapped with the CSS Color 4 chroma-reduction algorithm, so a vivid
 * hue keeps its hue instead of being clipped sideways.
 *
 * The palette is a snapshot. Charts do not re-read CSS, so on a theme
 * flip either rebuild the options from a fresh chartPalette() or — the
 * more reliable route for most libraries — remount the chart (in React,
 * key it on the theme). onThemeChange() tells you when: it watches
 * data-theme / data-hud / class / style on the element and every
 * ancestor, plus the OS colour scheme, and calls back only when the
 * resolved palette actually changed. It cannot see a stylesheet being
 * swapped; call chartPalette() yourself after one.
 *
 * SSR-safe: without a document every function returns fallbacks and
 * onThemeChange() returns a no-op.
 */

/* The series palette, as token NAMES. Resolved at call time against
   whatever those tokens currently mean, so the palette follows your
   theme and your brand without being restated here.

   The order is a stride-3 walk around the hue wheel rather than the
   declaration order, so that adjacent series in a chart are far apart
   in hue and stay tellable apart. */
export const SERIES_TOKENS = [
  "--hud-hue-7", "--hud-hue-8", "--hud-hue-2", "--hud-hue-4", "--hud-hue-6",
  "--hud-hue-3", "--hud-hue-1", "--hud-hue-9", "--hud-hue-5", "--hud-hue-10",
  "--hud-ch-blue", "--hud-ch-green", "--hud-ch-amber", "--hud-ch-violet", "--hud-ch-rose",
];

const FALLBACK_COLOR = "#888888";

/* The element a probe is resolved against: the element itself, or the
   body when asked for the root, so that tokens set on <body> count too. */
function host(el) {
  if (!el || el === document.documentElement) return document.body ?? document.documentElement;
  return el;
}

/* A token name ("--hud-bg-1") becomes var(--hud-bg-1); anything else is taken
   as a colour expression as-is ("var(--x, var(--hud-bg-2))", "color-mix(…)"). */
const expr = (token) => (token.startsWith("--") ? `var(${token})` : token);

/**
 * Resolve many colour tokens with one probe element.
 *
 * @param {string[]} tokens  token names or colour expressions
 * @param {{el?: Element, format?: "rgb" | "computed", fallback?: string}} [options]
 *   format "rgb" (default) converts to rgb()/rgba(); "computed" returns
 *   exactly what getComputedStyle reports (oklch() in current engines).
 * @returns {string[]}
 */
export function resolveColors(tokens, options = {}) {
  const { el, format = "rgb", fallback = FALLBACK_COLOR } = options;
  if (typeof document === "undefined") return tokens.map(() => fallback);
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "display:none";
  try {
    host(el).appendChild(probe);
    const style = getComputedStyle(probe);
    return tokens.map((token) => {
      probe.style.color = "";
      probe.style.color = expr(token);
      const value = style.color;
      if (!value) return fallback;
      return format === "computed" ? value : (toRgb(value) ?? fallback);
    });
  } catch {
    return tokens.map(() => fallback);
  } finally {
    probe.remove();
  }
}

/** Resolve one colour token. Same options as resolveColors(). */
export function resolveColor(token, options) {
  return resolveColors([token], options)[0];
}

/** Resolve a non-colour custom property (a font stack, a length). */
export function resolveText(token, options = {}) {
  const { el, fallback = "" } = options;
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(el ?? document.documentElement).getPropertyValue(token);
  return value.trim() || fallback;
}

/* ---------------------------------------------------------------
   Colour conversion. Everything lands in gamma-encoded sRGB 0..1.
   --------------------------------------------------------------- */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const toGamma = (v) => {
  const a = Math.abs(v);
  const g = a <= 0.0031308 ? 12.92 * a : 1.055 * a ** (1 / 2.4) - 0.055;
  return Math.sign(v) * g;
};
const toLinear = (v) => {
  const a = Math.abs(v);
  const l = a <= 0.04045 ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4;
  return Math.sign(v) * l;
};

function oklabToSrgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function srgbToOklab([r, g, b]) {
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
const clip = (rgb) => rgb.map(clamp01);

/* CSS Color 4 §13.2 gamut mapping: reduce OKLCH chroma until clipping
   what is left is below one just-noticeable difference. */
function oklchToSrgb(L, C, h) {
  if (L >= 1) return [1, 1, 1];
  if (L <= 0) return [0, 0, 0];
  const rad = (h * Math.PI) / 180;
  const at = (c) => oklabToSrgb(L, c * Math.cos(rad), c * Math.sin(rad));
  const origin = at(C);
  if (inGamut(origin)) return clip(origin);

  const JND = 0.02;
  const dE = (rgb, c) => {
    const [l2, a2, b2] = srgbToOklab(rgb);
    return Math.hypot(L - l2, c * Math.cos(rad) - a2, c * Math.sin(rad) - b2);
  };
  if (dE(clip(origin), C) < JND) return clip(origin);

  let lo = 0;
  let hi = C;
  let loInGamut = true;
  while (hi - lo > 1e-4) {
    const c = (lo + hi) / 2;
    const current = at(c);
    if (loInGamut && inGamut(current)) { lo = c; continue; }
    const clipped = clip(current);
    const e = dE(clipped, c);
    if (e < JND) {
      if (JND - e < 1e-4) return clipped;
      loInGamut = false;
      lo = c;
    } else {
      hi = c;
    }
  }
  return clip(at(lo));
}

/* CIE Lab (D50) → sRGB, via XYZ D50 → D65 (Bradford). */
function labToSrgb(L, a, b) {
  const e = 216 / 24389, k = 24389 / 27;
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = (fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k) * 0.3457 / 0.3585;
  const y = L > k * e ? fy ** 3 : L / k;
  const z = (fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k) * (1 - 0.3457 - 0.3585) / 0.3585;
  const X = 0.9554734527042182 * x - 0.023098536874261423 * y + 0.0632593086610217 * z;
  const Y = -0.028369706963208136 * x + 1.0099954580058226 * y + 0.021041398966943008 * z;
  const Z = 0.012314001688319899 * x - 0.020507696433477912 * y + 1.3303659366080753 * z;
  return linearXyzToSrgb(X, Y, Z);
}

function linearXyzToSrgb(X, Y, Z) {
  return [
    toGamma(3.2409699419045226 * X - 1.537383177570094 * Y - 0.4986107602930034 * Z),
    toGamma(-0.9692436362808796 * X + 1.8759675015077202 * Y + 0.04155505740717559 * Z),
    toGamma(0.05563007969699366 * X - 0.20397695888897652 * Y + 1.0569715142428786 * Z),
  ];
}

/* color(space r g b): the spaces a computed value can realistically be in. */
function colorFnToSrgb(space, [r, g, b]) {
  switch (space) {
    case "srgb": return [r, g, b];
    case "srgb-linear": return [toGamma(r), toGamma(g), toGamma(b)];
    case "display-p3": {
      const R = toLinear(r), G = toLinear(g), B = toLinear(b);
      return linearXyzToSrgb(
        0.4865709486482162 * R + 0.26566769316909306 * G + 0.1982172852343625 * B,
        0.2289745640697488 * R + 0.6917385218365064 * G + 0.079286914093745 * B,
        0.0451133818589026 * G + 1.043944368900976 * B,
      );
    }
    case "xyz":
    case "xyz-d65": return linearXyzToSrgb(r, g, b);
    default: return null;
  }
}

/* One number from a computed-value component: "none" is 0, a
   percentage is scaled to the component's reference range. */
function num(token, percentOf = 1) {
  if (token === undefined || token === "none") return 0;
  if (token.endsWith("%")) return (parseFloat(token) / 100) * percentOf;
  if (token.endsWith("deg")) return parseFloat(token);
  return parseFloat(token);
}

function serialize(rgb, alpha) {
  const [r, g, b] = rgb.map((v) => Math.round(clamp01(v) * 255));
  const a = Math.round(clamp01(alpha) * 1000) / 1000;
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

let canvasCtx = null;

/* Last resort for a syntax this file does not parse: let the browser
   paint one pixel and read it back. */
function viaCanvas(color) {
  if (typeof document === "undefined") return null;
  canvasCtx ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 })
    .getContext("2d", { willReadFrequently: true });
  if (!canvasCtx) return null;
  canvasCtx.clearRect(0, 0, 1, 1);
  canvasCtx.fillStyle = "#000";
  canvasCtx.fillStyle = color;
  canvasCtx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = canvasCtx.getImageData(0, 0, 1, 1).data;
  return serialize([r / 255, g / 255, b / 255], a / 255);
}

/**
 * Convert a computed CSS colour string to legacy rgb()/rgba().
 * Handles rgb/rgba, oklch, oklab, lab, lch and color(srgb | srgb-linear
 * | display-p3 | xyz); anything else is rasterised through a 1×1 canvas.
 *
 * @param {string} color
 * @returns {string | null} null for an empty or unparseable input
 */
export function toRgb(color) {
  const value = String(color ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value === "transparent") return "rgba(0, 0, 0, 0)";

  const m = /^([a-z-]+)\((.*)\)$/.exec(value);
  if (!m) return value.startsWith("#") ? value : viaCanvas(value);
  const [, fn, body] = m;

  const [main, alphaPart] = body.split("/");
  let parts = main.trim().split(/[\s,]+/).filter(Boolean);
  let alpha = alphaPart === undefined ? 1 : num(alphaPart.trim());

  if (fn === "rgb" || fn === "rgba") {
    if (alphaPart === undefined && parts.length === 4) alpha = num(parts.pop());
    return serialize(parts.map((p) => num(p, 255) / 255), alpha);
  }
  if (fn === "oklch") {
    return serialize(oklchToSrgb(num(parts[0], 1), num(parts[1], 0.4), num(parts[2])), alpha);
  }
  if (fn === "oklab") {
    const L = num(parts[0], 1), a = num(parts[1], 0.4), b = num(parts[2], 0.4);
    return serialize(oklchToSrgb(L, Math.hypot(a, b), (Math.atan2(b, a) * 180) / Math.PI), alpha);
  }
  if (fn === "lab") {
    return serialize(clip(labToSrgb(num(parts[0], 100), num(parts[1], 125), num(parts[2], 125))), alpha);
  }
  if (fn === "lch") {
    const L = num(parts[0], 100), C = num(parts[1], 150), h = (num(parts[2]) * Math.PI) / 180;
    return serialize(clip(labToSrgb(L, C * Math.cos(h), C * Math.sin(h))), alpha);
  }
  if (fn === "color") {
    const [space, ...channels] = parts;
    const rgb = colorFnToSrgb(space, channels.map((p) => num(p, 1)));
    if (rgb) return serialize(inGamut(rgb) ? rgb : gamutMapRgb(rgb), alpha);
  }
  return viaCanvas(value);
}

/* A wide-gamut result from color(): route it back through OKLCH so it
   gets the same chroma reduction as everything else. */
function gamutMapRgb(rgb) {
  const [L, a, b] = srgbToOklab(rgb);
  return oklchToSrgb(L, Math.hypot(a, b), (Math.atan2(b, a) * 180) / Math.PI);
}

/* The first non-transparent background at or above el — the surface a
   chart's bar gaps and marker rings should be cut in. */
function surfaceOf(el) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    const rgb = toRgb(bg);
    if (rgb && !/^rgba\(.*, 0\)$/.test(rgb)) return { computed: bg, rgb };
  }
  return null;
}

const ROLES = {
  text: "--hud-text-2",
  strong: "--hud-text-1",
  muted: "--hud-text-3",
  grid: "--hud-line-1",
  axis: "--hud-line-2",
  accent: "--hud-accent",
  accentSoft: "--hud-accent-soft",
  crosshair: "--hud-line",
  ok: "--hud-ok",
  warn: "--hud-warn",
  error: "--hud-error",
  background: "--hud-bg-1",
};

/**
 * The chart palette for el, as concrete colour strings.
 *
 * @param {Element} [el=document.documentElement]  resolve in this
 *   element's cascade (a scoped [data-theme] or brand override counts)
 * @param {{seriesTokens?: string[], format?: "rgb" | "computed"}} [options]
 * @returns {{series: string[], text: string, strong: string, muted: string,
 *   grid: string, axis: string, accent: string, accentSoft: string,
 *   crosshair: string, ok: string, warn: string, error: string,
 *   background: string, fontSans: string, fontMono: string}}
 */
export function chartPalette(el, options = {}) {
  const { seriesTokens = SERIES_TOKENS, format = "rgb" } = options;
  const names = Object.keys(ROLES);
  if (typeof document === "undefined") {
    return {
      series: seriesTokens.map(() => FALLBACK_COLOR),
      ...Object.fromEntries(names.map((n) => [n, FALLBACK_COLOR])),
      fontSans: "system-ui, sans-serif",
      fontMono: "ui-monospace, monospace",
    };
  }
  const target = el ?? document.documentElement;
  const colors = resolveColors([...seriesTokens, ...names.map((n) => ROLES[n])], { el: target, format });
  const palette = {
    series: colors.slice(0, seriesTokens.length),
    ...Object.fromEntries(names.map((n, i) => [n, colors[seriesTokens.length + i]])),
    fontSans: resolveText("--hud-font-sans", { el: target, fallback: "system-ui, sans-serif" }),
    fontMono: resolveText("--hud-font-mono", { el: target, fallback: "ui-monospace, monospace" }),
  };
  const surface = surfaceOf(target);
  if (surface) palette.background = format === "computed" ? surface.computed : surface.rgb;
  return palette;
}

/**
 * Call back with a fresh palette whenever the resolved palette for el
 * changes: a data-theme / data-hud / class / style change on el or any
 * ancestor, or an OS colour-scheme flip. Coalesced to one call per
 * frame and skipped when nothing resolved differently.
 *
 * @param {(palette: ReturnType<typeof chartPalette>) => void} callback
 * @param {{el?: Element, seriesTokens?: string[], format?: "rgb" | "computed"}} [options]
 * @returns {() => void} stop watching
 */
export function onThemeChange(callback, options = {}) {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
  const { el = document.documentElement, ...paletteOptions } = options;
  let last = JSON.stringify(chartPalette(el, paletteOptions));
  let frame = 0;

  const check = () => {
    frame = 0;
    const palette = chartPalette(el, paletteOptions);
    const key = JSON.stringify(palette);
    if (key === last) return;
    last = key;
    callback(palette);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(check);
  };

  const observer = new MutationObserver(schedule);
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    observer.observe(node, { attributes: true, attributeFilter: ["data-theme", "data-hud", "class", "style"] });
  }
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", schedule);

  return () => {
    observer.disconnect();
    scheme.removeEventListener("change", schedule);
    cancelAnimationFrame(frame);
  };
}
