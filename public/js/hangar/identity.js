/**
 * Stable identity hues — the same key gets the same hue in every app.
 * No framework, no dependency, no DOM: pure functions, safe anywhere.
 *
 *   import { hueFor, hueIndex } from "@valeness/hangar/identity";
 *
 *   avatar.style.setProperty("--hud-channel", hueFor(user.id));   // "var(--hud-hue-7)"
 *   card.style.setProperty("--hud-stripe", hueFor(flow.id));
 *   hueIndex(user.id);                                           // 7
 *   hueIndex(user.id, { count: 4 });                             // 1..4
 *
 * THE MAPPING IS A CONTRACT. The hash is a 32-bit multiply-by-31 over
 * the key's UTF-16 code units (Java's String.hashCode, unsigned), and
 * the hue is `h % count + 1`. It will not change: every avatar, card
 * and channel already painted from it would change colour for every
 * user at once. Apps that wrote this hash themselves get the same
 * hues from here.
 */

/** Hangar ships --hud-hue-1 … --hud-hue-10. */
const HUES = 10;

function hash(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

function countOf(options, max) {
  const count = options?.count ?? HUES;
  if (!Number.isInteger(count) || count < 1 || count > max)
    throw new RangeError(`count must be ${max === Infinity ? "a positive integer" : `an integer from 1 to ${max}`}, got ${String(count)}`);
  return count;
}

function keyOf(key) {
  if (typeof key !== "string") throw new TypeError(`key must be a string, got ${key === null ? "null" : typeof key}`);
  return key;
}

/**
 * The 1-based hue number for `key`: 1 … `count` (default 10). Any
 * positive integer count works, so it can index a palette of your own.
 */
export function hueIndex(key, options) {
  const k = keyOf(key);
  return (hash(k) % countOf(options, Infinity)) + 1;
}

/**
 * The hue for `key` as a CSS value, `var(--hud-hue-N)`, ready for
 * --hud-channel, --hud-stripe or any colour property. `count` (1–10,
 * default 10) narrows it to the first `count` hues.
 */
export function hueFor(key, options) {
  const k = keyOf(key);
  return `var(--hud-hue-${(hash(k) % countOf(options, HUES)) + 1})`;
}
