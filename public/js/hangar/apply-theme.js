/**
 * Theme and intensity plumbing — no framework, no store, no dependency.
 *
 * Hangar reads two attributes off the document element:
 *   data-theme  "dark" | "light"
 *   data-hud    "restrained" | "tactical" | "canopy" | "off"
 *
 * That is the whole contract. If you already have a theme system,
 * ignore this file and set those attributes yourself.
 *
 *   import { initTheme, setTheme, toggleTheme, setIntensity } from "@valeness/hangar/theme";
 *   initTheme();
 *
 * Call initTheme() before first paint (a blocking module in <head>, or
 * the top of your entry) so a returning visitor never sees a flash of
 * the wrong theme.
 *
 *   applyTheme(t) / applyIntensity(l)   set the attribute only
 *   setTheme(t) / setIntensity(l)       set it and remember it
 *   toggleTheme()                       dark ⇄ light, remembered
 *   getTheme() / getIntensity()         read the attribute
 *   systemTheme()                       the OS preference
 *   onThemeChange(fn)                   fn(theme) on every change
 *
 * Unknown values fall back to "dark" / "tactical". No function fires an
 * event; onThemeChange() hears every data-theme change whoever made it,
 * so app state can follow it without echo loops (it calls back only when
 * the value actually changes).
 *
 * Frameworks: the attributes live on <html>, which the app usually does
 * not render. If it does (Next.js, Remix, Nuxt useHead, SvelteKit's
 * app.html), let one side own data-theme / data-hud: either this file,
 * with suppressHydrationWarning (or equivalent) on <html> since
 * initTheme() runs before hydration, or the framework, rendering the
 * attributes from state and never calling apply*()/set*(). initTheme()
 * and onThemeChange() return teardowns for effect cleanups.
 *
 * SSR: nothing touches the DOM at import time. On the server getTheme()
 * is "dark", getIntensity() "tactical", systemTheme() "dark", the
 * apply/set functions do nothing (and store nothing), and initTheme() /
 * onThemeChange() return no-op teardowns.
 */

export const THEMES = ["dark", "light"];
export const INTENSITIES = ["restrained", "tactical", "canopy", "off"];

const THEME_KEY = "hangar.theme";
const HUD_KEY = "hangar.hud";

const hasDom = () => typeof document !== "undefined";

/* localStorage throws in some privacy contexts, and returns null in
   plenty of ordinary ones. Neither is exceptional — fall back and move
   on rather than taking the page down over a stored preference. */
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

/** The OS preference, used only when the user has expressed none. */
export function systemTheme() {
  if (typeof globalThis.matchMedia !== "function") return "dark";
  return globalThis.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function getTheme() {
  if (!hasDom()) return "dark";
  return document.documentElement.getAttribute("data-theme") || "dark";
}

export function applyTheme(theme) {
  if (!hasDom()) return;
  document.documentElement.setAttribute("data-theme", THEMES.includes(theme) ? theme : "dark");
}

export function setTheme(theme) {
  applyTheme(theme);
  if (hasDom()) writeStored(THEME_KEY, getTheme());
  return getTheme();
}

export function toggleTheme() {
  return setTheme(getTheme() === "dark" ? "light" : "dark");
}

export function getIntensity() {
  if (!hasDom()) return "tactical";
  return document.documentElement.getAttribute("data-hud") || "tactical";
}

export function applyIntensity(level) {
  if (!hasDom()) return;
  const next = INTENSITIES.includes(level) ? level : "tactical";
  /* tactical is the no-attribute default; leaving the attribute off
     keeps the DOM honest about what is actually overridden. */
  if (next === "tactical") document.documentElement.removeAttribute("data-hud");
  else document.documentElement.setAttribute("data-hud", next);
}

export function setIntensity(level) {
  applyIntensity(level);
  if (hasDom()) writeStored(HUD_KEY, getIntensity());
  return getIntensity();
}

/**
 * Restore the stored theme and intensity, falling back to the OS
 * preference for theme and to tactical for intensity.
 *
 * @param {{theme?: string, intensity?: string, followSystem?: boolean}} [options]
 *   theme / intensity   force a value instead of reading storage
 *   followSystem        keep tracking the OS theme until the user
 *                       picks one explicitly (default true)
 * @returns {() => void} teardown for the system listener
 */
export function initTheme(options = {}) {
  const { theme, intensity, followSystem = true } = options;

  const storedTheme = readStored(THEME_KEY);
  applyTheme(theme ?? storedTheme ?? systemTheme());
  applyIntensity(intensity ?? readStored(HUD_KEY) ?? "tactical");

  if (!followSystem || storedTheme || theme || typeof globalThis.matchMedia !== "function") {
    return () => {};
  }

  const mq = globalThis.matchMedia("(prefers-color-scheme: light)");
  const onChange = (e) => {
    /* Only while the user has not chosen — an explicit choice wins
       over the OS from then on. */
    if (!readStored(THEME_KEY)) applyTheme(e.matches ? "light" : "dark");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Run a callback whenever data-theme changes, from anywhere — including
 * a change made by code that never imported this module. Useful for
 * re-theming a canvas or chart library that cannot read CSS variables.
 * Writing the value it already has is not a change and calls nothing.
 *
 * @param {(theme: string) => void} fn
 * @returns {() => void} teardown
 */
export function onThemeChange(fn) {
  if (!hasDom()) return () => {};
  let last = getTheme();
  const observer = new MutationObserver(() => {
    const next = getTheme();
    if (next === last) return;
    last = next;
    fn(next);
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}
