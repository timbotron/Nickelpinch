/**
 * calendar() and datePicker() — a date grid and the field that opens it.
 * No framework, no dependency.
 *
 *   import { calendar, datePicker } from "@valeness/hangar/calendar";
 *
 *   const cal = calendar(document.querySelector(".hud-calendar"), {
 *     mode: "range",
 *     months: 2,
 *     min: "2026-01-01",
 *     onChange: ({ iso }) => console.log(iso.from, iso.to),
 *   });
 *   cal.value;                                  // { from: Date, to: Date }
 *   cal.setValue({ from: "2026-09-01", to: "2026-09-07" });
 *   cal.goTo(new Date());
 *   cal.setOptions({ max: new Date() });        // bounds changed by the app
 *   cal.destroy();
 *
 *   const picker = datePicker(document.querySelector(".hud-datepicker-trigger"), {
 *     mode: "range",
 *     presets: true,
 *     input: "window",                          // hidden <input name="window">
 *   });
 *
 * CALENDAR renders into `root` (give it class hud-calendar) and owns what it
 * renders: one caption, one role="grid" table per month, the previous/next
 * month buttons and an aria-hidden readout. It follows the WAI-ARIA date
 * grid: a single tab stop on the focused day, and
 *
 *   ←/→            previous/next day (swapped under direction: rtl)
 *   ↑/↓            same day previous/next week
 *   Home/End       first/last day of the week
 *   PageUp/Down    same day previous/next month (clamped to its length)
 *   Shift+PageUp/Down  same day previous/next year
 *   Enter/Space    select (the days are real buttons)
 *
 * Moving focus off the visible months pages the view. Disabled days —
 * outside min/max or rejected by isDisabled — stay focusable with
 * aria-disabled="true", so a keyboard user can walk across a disabled
 * weekend and hear why; focus never leaves min..max.
 *
 * Options:
 *   mode          "single" | "range" | "multiple"            default "single"
 *   value         single: Date | "yyyy-mm-dd" | null
 *                 range: { from, to } or [from, to]
 *                 multiple: an array of dates
 *   min, max      Date | "yyyy-mm-dd" — inclusive bounds
 *   isDisabled    (date: Date) => boolean
 *   locale        BCP 47 tag; default <html lang>, then the browser's
 *   weekStartsOn  0–6, 0 = Sunday; default from Intl.Locale week info,
 *                 else Monday
 *   months        months side by side                         default 1
 *   weekNumbers   show a week-number column                   default false
 *   readout       show the aria-hidden telemetry line         default true
 *   labels        { prev, next, week, weekShort } — English defaults
 *   onChange      (detail) => void — same detail as the event
 *
 * Every user selection dispatches a bubbling `hud-change` CustomEvent on
 * root. detail = { mode, value, iso }: value in Date objects (local
 * midnight), iso the same shape in yyyy-mm-dd strings. A range fires
 * twice: once with to: null after the first pick, once complete.
 *
 * Returns { value, setValue(value), goTo(date), setOptions(limits),
 * destroy() }. setOptions({ min, max, isDisabled }) changes those three
 * after init — a key left out keeps its value, null clears it — and
 * redraws, keeping the selection even if it now falls outside; every
 * other option is fixed for the calendar's life. setValue(), goTo()
 * and setOptions() are programmatic: they fire neither hud-change nor
 * onChange, so a framework can push its state in without it coming
 * back. destroy() removes the listeners and puts back what root held.
 *
 * DATE PICKER turns a `.hud-field` button into the trigger for a
 * [popover].hud-datepicker holding an optional preset list and a
 * calendar, anchored with anchor(). Single mode closes on pick, range
 * mode once the end is picked, multiple mode stays open. A pick, a
 * preset or Esc closes it and returns focus to the trigger; a click
 * outside or tabbing away closes it and leaves focus where it went.
 *
 * Extra options (everything else goes to calendar()):
 *   presets       true for the defaults, or [{ label, value }] where
 *                 value is a calendar value or (today: Date) => value
 *   format        (date: Date) => string, or Intl.DateTimeFormat
 *                 options                     default { dateStyle: "medium" }
 *   input         an <input> kept in sync with the ISO value, a name
 *                 (a hidden input is created after the trigger), or
 *                 [fromInput, toInput] for a range. One input holds a
 *                 range as "from/to" once both ends are set, and a
 *                 multiple selection comma-separated.
 *   placeholder   trigger text when empty
 *   labels        adds { dialog, presets } to the calendar labels
 *   side, align   anchor() placement              default bottom, start
 *
 * The trigger's accessible name becomes its <label> (or its own
 * aria-label / aria-labelledby) followed by the value, and it fires the
 * same `hud-change` event; the inner calendar's is not let past the
 * popover, so a listener on a form hears one event per change.
 * Returns { value, setValue, setOptions, open, close, destroy }, the
 * calendar's setters also updating the trigger, the inputs and the
 * presets' availability. destroy() removes the popover, a created input
 * and a label id it assigned, and restores the trigger.
 *
 * FRAMEWORKS. calendar()'s root is module-owned: render it empty — its
 * children are replaced. The trigger's content is the picker's too:
 * render the button empty, with your own attributes (id, disabled,
 * aria-invalid) on it. The popover, and a hidden input created from a
 * name, go in right after the trigger; frameworks leave such nodes be
 * (React and Vue both place their own siblings around them correctly).
 * Hold the value in your state: set it from hud-change or onChange,
 * push it back with setValue() and new bounds with setOptions(), and
 * render a hidden input from it yourself rather than hand `input` one
 * the framework binds — the picker writes input.value without an event.
 */

import { anchor } from "./anchor.js";
import { roving } from "./internal/roving.js";

const DAY_MS = 864e5;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

let seq = 0;
const uid = (prefix) => `${prefix}-${++seq}`;

/* Dates are held as day numbers — days since 1970-01-01 on the proleptic
   Gregorian calendar, computed in UTC so no time zone or DST shift can
   move a day. Only rendering and the public API see Date objects. */
function dayOf(y, m, d) {
  const t = new Date(0);
  t.setUTCFullYear(y, m, d);
  return Math.round(t.getTime() / DAY_MS);
}

function partsOf(dn) {
  const t = new Date(dn * DAY_MS);
  return [t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()];
}

/* 1970-01-01 was a Thursday. 0 = Sunday. */
const weekdayOf = (dn) => (((dn + 4) % 7) + 7) % 7;

function toDate(dn, hour = 0) {
  const [y, m, d] = partsOf(dn);
  const date = new Date(2000, 0, 1, hour);
  date.setFullYear(y, m, d);
  return date;
}

const pad = (n, w = 2) => String(n).padStart(w, "0");

function isoOf(dn) {
  if (dn == null) return null;
  const [y, m, d] = partsOf(dn);
  return `${y < 0 ? "-" : ""}${pad(Math.abs(y), 4)}-${pad(m + 1)}-${pad(d)}`;
}

function dayFrom(v) {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const match = ISO.exec(v.trim());
    if (!match) return null;
    const [y, m, d] = [+match[1], +match[2] - 1, +match[3]];
    const dn = dayOf(y, m, d);
    const [cy, cm] = partsOf(dn);
    return cy === y && cm === m ? dn : null; // reject 2026-02-31
  }
  const date = v instanceof Date ? v : new Date(v);
  return Number.isNaN(date.getTime()) ? null : dayOf(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths(dn, k) {
  const [y, m, d] = partsOf(dn);
  const length = dayOf(y, m + k + 1, 1) - dayOf(y, m + k, 1);
  return dayOf(y, m + k, Math.min(d, length));
}

function monthStart(dn) {
  const [y, m] = partsOf(dn);
  return dayOf(y, m, 1);
}

function resolveLocale(locale) {
  const wanted = locale || (typeof document !== "undefined" && document.documentElement.lang) || undefined;
  try {
    return new Intl.DateTimeFormat(wanted).resolvedOptions().locale;
  } catch {
    return new Intl.DateTimeFormat().resolvedOptions().locale;
  }
}

/* Intl.Locale week info: getWeekInfo() in current engines, the weekInfo
   getter in older Chromium, absent in some. firstDay is 1–7 (7 = Sunday). */
function weekInfoOf(locale) {
  try {
    const loc = new Intl.Locale(locale);
    const info = typeof loc.getWeekInfo === "function" ? loc.getWeekInfo() : loc.weekInfo;
    if (info && info.firstDay) return { firstDay: info.firstDay % 7, minimalDays: info.minimalDays };
  } catch {
    /* fall through */
  }
  return null;
}

/* Normalise a value for a mode into the internal selection. */
function selectionOf(mode, value) {
  if (mode === "range") {
    const [a, b] = Array.isArray(value) ? value : [value?.from, value?.to];
    let from = dayFrom(a);
    let to = dayFrom(b);
    if (from == null) [from, to] = [to, null];
    if (from != null && to != null && to < from) [from, to] = [to, from];
    return { from, to };
  }
  if (mode === "multiple") {
    const list = Array.isArray(value) ? value : value == null ? [] : [value];
    return new Set(list.map(dayFrom).filter((dn) => dn != null));
  }
  return dayFrom(Array.isArray(value) ? value[0] : value);
}

function detailOf(mode, sel) {
  if (mode === "range") {
    return {
      mode,
      value: { from: sel.from == null ? null : toDate(sel.from), to: sel.to == null ? null : toDate(sel.to) },
      iso: { from: isoOf(sel.from), to: isoOf(sel.to) },
    };
  }
  if (mode === "multiple") {
    const days = [...sel].sort((a, b) => a - b);
    return { mode, value: days.map((dn) => toDate(dn)), iso: days.map(isoOf) };
  }
  return { mode, value: sel == null ? null : toDate(sel), iso: isoOf(sel) };
}

const firstSelected = (mode, sel) =>
  mode === "range" ? sel.from : mode === "multiple" ? (sel.size ? Math.min(...sel) : null) : sel;

function make(tag, className, attrs) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

const CAL_LABELS = { prev: "Previous month", next: "Next month", week: "Week", weekShort: "Wk" };

/* The inert handle, for the server or a missing root: value is the empty
   selection in the mode's own shape. */
const noop = (mode) => ({
  value: detailOf(mode, selectionOf(mode, null)).value,
  setValue() {},
  setOptions() {},
  goTo() {},
  destroy() {},
});

export function calendar(root, options = {}) {
  if (typeof document === "undefined" || !root) return noop(options.mode);

  const {
    mode = "single",
    value,
    min: minOption,
    max: maxOption,
    isDisabled: isDisabledOption,
    locale: localeOption,
    weekStartsOn,
    months: monthsOption = 1,
    weekNumbers = false,
    readout: showReadout = true,
    labels: labelOptions,
    onChange,
  } = options;

  const labels = { ...CAL_LABELS, ...labelOptions };
  const months = Math.max(1, Math.floor(monthsOption) || 1);
  const locale = resolveLocale(localeOption);
  const info = weekInfoOf(locale);
  const weekStart = Number.isInteger(weekStartsOn) ? ((weekStartsOn % 7) + 7) % 7 : info ? info.firstDay : 1;
  // Week numbering follows the locale's rule when the week start does;
  // otherwise ISO 8601 for a Monday start and "the week holding 1 January"
  // for any other.
  const minimalDays = info && info.firstDay === weekStart && info.minimalDays ? info.minimalDays : weekStart === 1 ? 4 : 1;

  // min, max and isDisabled are what setOptions() can change later. A key
  // left out keeps its value; null or undefined clears it.
  const limits = { min: null, max: null, isDisabled: null };
  let min = null;
  let max = null;
  const limit = (next) => {
    if ("min" in next) limits.min = dayFrom(next.min);
    if ("max" in next) limits.max = dayFrom(next.max);
    if ("isDisabled" in next) limits.isDisabled = typeof next.isDisabled === "function" ? next.isDisabled : null;
    ({ min, max } = limits);
    if (min != null && max != null && max < min) [min, max] = [max, min];
  };
  limit({ min: minOption, max: maxOption, isDisabled: isDisabledOption });

  const clamp = (dn) => Math.max(min ?? dn, Math.min(dn, max ?? dn));
  const disabled = (dn) =>
    (min != null && dn < min) || (max != null && dn > max) || Boolean(limits.isDisabled?.(toDate(dn)));

  const fmt = {
    caption: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    day: new Intl.DateTimeFormat(locale, { day: "numeric" }),
    full: new Intl.DateTimeFormat(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }),
    weekdayNarrow: new Intl.DateTimeFormat(locale, { weekday: "narrow" }),
    weekdayLong: new Intl.DateTimeFormat(locale, { weekday: "long" }),
    number: new Intl.NumberFormat(locale),
  };
  // A short weekday longer than four characters ("יום א׳") will not fit a
  // day cell; such locales get the narrow form. abbr keeps the full name.
  const shortFits = [0, 1, 2, 3, 4, 5, 6].every((k) => [...fmt.weekday.format(toDate(3 + k, 12))].length <= 4);

  let sel = selectionOf(mode, value);
  const todayOf = () => dayFrom(new Date());
  let focusDay = clamp(firstSelected(mode, sel) ?? todayOf());
  let view = monthStart(focusDay); // first visible month
  let hover = null;

  /* ---- week numbers ---- */
  const weekOne = (y) => {
    const jan1 = dayOf(y, 0, 1);
    const offset = (weekdayOf(jan1) - weekStart + 7) % 7;
    return 7 - offset >= minimalDays ? jan1 - offset : jan1 - offset + 7;
  };
  const weekNumber = (rowStart) => {
    const [y] = partsOf(rowStart + 6);
    const one = weekOne(y);
    return rowStart >= one ? (rowStart - one) / 7 + 1 : (rowStart - weekOne(y - 1)) / 7 + 1;
  };

  /* ---- build (once; render() only updates) ---- */
  const original = [...root.childNodes];
  const id = uid("hud-calendar");

  const navButton = (step, label, glyph) => {
    const b = make("button", "hud-calendar-nav-btn", { type: "button", "aria-label": label, "data-step": String(step) });
    b.append(make("span", "", { "aria-hidden": "true" }));
    b.firstChild.textContent = glyph;
    return b;
  };
  const prev = navButton(-1, labels.prev, "◂");
  const next = navButton(1, labels.next, "▸");
  const nav = make("div", "hud-calendar-nav");
  nav.append(prev, next);

  const monthsEl = make("div", "hud-calendar-months");
  const grids = [];
  for (let i = 0; i < months; i++) {
    const month = make("div", "hud-calendar-month");
    const caption = make("div", "hud-calendar-caption", { id: `${id}-m${i}` });
    if (i === 0) caption.setAttribute("aria-live", "polite");
    const table = make("table", "hud-calendar-grid", { role: "grid", "aria-labelledby": caption.id });
    if (mode !== "single") table.setAttribute("aria-multiselectable", "true");

    const head = make("tr");
    if (weekNumbers) {
      const th = make("th", "hud-calendar-weekno", { scope: "col", abbr: labels.week });
      th.textContent = labels.weekShort;
      head.append(th);
    }
    for (let c = 0; c < 7; c++) {
      const sample = toDate(3 + ((weekStart + c) % 7), 12); // 1970-01-04 was a Sunday
      const th = make("th", "hud-calendar-weekday", { scope: "col", abbr: fmt.weekdayLong.format(sample) });
      th.textContent = (shortFits ? fmt.weekday : fmt.weekdayNarrow).format(sample);
      head.append(th);
    }
    const thead = make("thead");
    thead.append(head);

    const tbody = make("tbody");
    const rows = [];
    for (let r = 0; r < 6; r++) {
      const tr = make("tr");
      const week = weekNumbers ? make("th", "hud-calendar-weekno", { scope: "row" }) : null;
      if (week) tr.append(week);
      const cells = [];
      for (let c = 0; c < 7; c++) {
        const td = make("td", "hud-calendar-cell", { role: "gridcell" });
        const btn = make("button", "hud-calendar-day", { type: "button", tabindex: "-1" });
        tr.append(td);
        cells.push({ td, btn });
      }
      tbody.append(tr);
      rows.push({ week, cells });
    }
    table.append(thead, tbody);
    month.append(caption, table);
    monthsEl.append(month);
    grids.push({ caption, rows });
  }

  const readout = showReadout ? make("div", "hud-readout hud-calendar-readout", { "aria-hidden": "true" }) : null;

  /* ---- render ---- */
  const buttons = new Map(); // in-month day number → button

  const isSelected = (dn) => {
    if (mode === "range") return sel.from != null && (sel.to == null ? dn === sel.from : dn >= sel.from && dn <= sel.to);
    if (mode === "multiple") return sel.has(dn);
    return dn === sel;
  };

  const setAttr = (el, name, v) => {
    if (v == null || v === false) el.removeAttribute(name);
    else if (el.getAttribute(name) !== String(v)) el.setAttribute(name, v);
  };

  const paintReadout = () => {
    if (!readout) return;
    const lbl = (text) => {
      const s = make("span", "lbl");
      s.textContent = text;
      return s;
    };
    const parts = [];
    if (mode === "range") {
      // The caption already carries the year; the far end drops it when
      // it is the same, so the line fits one month's width.
      const [fy] = sel.from != null ? partsOf(sel.from) : [];
      const to = sel.to != null && partsOf(sel.to)[0] === fy ? isoOf(sel.to).slice(-5) : isoOf(sel.to);
      parts.push(lbl("RNG"), ` ${isoOf(sel.from) ?? "——"} ⟶ ${to ?? "——"}`);
      if (sel.from != null && sel.to != null) parts.push(" ", lbl("·"), `\u00a0${pad(sel.to - sel.from + 1)}D`);
    } else if (mode === "multiple") {
      parts.push(lbl("SET"), ` ${pad(sel.size)}`);
      if (sel.size) parts.push(" ", lbl("·"), ` ${isoOf(Math.max(...sel))}`);
    } else {
      parts.push(lbl("SEL"), ` ${isoOf(sel) ?? "——"}`);
    }
    readout.replaceChildren(...parts);
  };

  const render = () => {
    const today = todayOf();
    const partial = mode === "range" && sel.from != null && sel.to == null;
    const preview = partial && hover != null && hover !== sel.from;
    const lo = preview ? Math.min(sel.from, hover) : null;
    const hi = preview ? Math.max(sel.from, hover) : null;
    const complete = mode === "range" && sel.from != null && sel.to != null && sel.to > sel.from;

    buttons.clear();
    grids.forEach((grid, i) => {
      const start = addMonths(view, i);
      const [y, m] = partsOf(start);
      const end = dayOf(y, m + 1, 1) - 1;

      // The first caption is a live region: touch it only when the month
      // actually changes, or every hover would be announced.
      if (grid.month !== start) {
        grid.month = start;
        grid.caption.replaceChildren(
          ...fmt.caption.formatToParts(toDate(start, 12)).map((p) => {
            if (p.type !== "year") return p.value;
            const s = make("span", "hud-calendar-year");
            s.textContent = p.value;
            return s;
          }),
        );
      }

      const gridStart = start - ((weekdayOf(start) - weekStart + 7) % 7);
      grid.rows.forEach((row, r) => {
        const rowStart = gridStart + r * 7;
        let shown = 0;
        row.cells.forEach(({ td, btn }, c) => {
          const dn = rowStart + c;
          const inMonth = dn >= start && dn <= end;
          const outside = !inMonth && ((dn < start && i === 0) || (dn > end && i === months - 1));
          if (!inMonth && !outside) {
            if (td.firstChild) td.replaceChildren();
            td.className = "hud-calendar-cell";
            td.removeAttribute("aria-selected");
            return;
          }
          shown++;
          if (btn.parentNode !== td) td.append(btn);

          const date = toDate(dn, 12);
          const iso = isoOf(dn);
          if (btn.dataset.date !== iso) {
            btn.dataset.date = iso;
            btn.textContent = fmt.day.format(date);
            btn.setAttribute("aria-label", fmt.full.format(date));
          }
          setAttr(btn, "aria-current", dn === today ? "date" : null);
          setAttr(btn, "aria-disabled", disabled(dn) ? "true" : null);
          btn.tabIndex = inMonth && dn === focusDay ? 0 : -1;
          if (inMonth) buttons.set(dn, btn);

          setAttr(td, "aria-selected", isSelected(dn) ? "true" : "false");
          const cls = ["hud-calendar-cell"];
          if (outside) cls.push("is-outside");
          if (complete) {
            if (dn === sel.from) cls.push("is-range-start");
            else if (dn === sel.to) cls.push("is-range-end");
            else if (dn > sel.from && dn < sel.to) cls.push("is-in-range");
          }
          if (preview && dn >= lo && dn <= hi) {
            cls.push(dn === lo ? "is-preview-start" : dn === hi ? "is-preview-end" : "is-preview");
          }
          const className = cls.join(" ");
          if (td.className !== className) td.className = className;
        });
        if (row.week) {
          const n = weekNumber(rowStart);
          row.week.textContent = shown ? fmt.number.format(n) : "";
          setAttr(row.week, "aria-label", shown ? `${labels.week} ${n}` : null);
        }
      });
    });

    setAttr(prev, "aria-disabled", min != null && view <= min ? "true" : null);
    setAttr(next, "aria-disabled", max != null && lastVisible() >= max ? "true" : null);
    paintReadout();
  };

  // view is always the 1st of a month, so this is the day before the
  // first month past the view.
  const lastVisible = () => addMonths(view, months) - 1;

  const reveal = () => {
    if (focusDay < view) view = monthStart(focusDay);
    else if (focusDay > lastVisible()) view = addMonths(monthStart(focusDay), -(months - 1));
  };

  const emit = () => {
    const detail = detailOf(mode, sel);
    root.dispatchEvent(new CustomEvent("hud-change", { bubbles: true, detail }));
    onChange?.(detail);
  };

  const pick = (dn) => {
    if (mode === "range") {
      if (sel.from == null || sel.to != null) sel = { from: dn, to: null };
      else sel = dn < sel.from ? { from: dn, to: sel.from } : { from: sel.from, to: dn };
    } else if (mode === "multiple") {
      if (sel.has(dn)) sel.delete(dn);
      else sel.add(dn);
    } else {
      sel = dn;
    }
    hover = null;
    focusDay = dn;
    reveal();
    render();
    buttons.get(dn)?.focus();
    emit();
  };

  const moveTo = (dn) => {
    focusDay = clamp(dn);
    if (mode === "range" && sel.from != null && sel.to == null) hover = focusDay;
    reveal();
    render();
    buttons.get(focusDay)?.focus();
  };

  const step = (k) => {
    view = addMonths(view, k);
    focusDay = clamp(addMonths(focusDay, k));
    if (focusDay < view || focusDay > lastVisible()) focusDay = clamp(view);
    render();
  };

  /* ---- events ---- */
  const onClick = (e) => {
    const navBtn = e.target.closest?.(".hud-calendar-nav-btn");
    if (navBtn && nav.contains(navBtn)) {
      if (navBtn.getAttribute("aria-disabled") !== "true") step(Number(navBtn.dataset.step));
      return;
    }
    const btn = e.target.closest?.(".hud-calendar-day");
    if (!btn || !monthsEl.contains(btn) || btn.getAttribute("aria-disabled") === "true") return;
    const dn = dayFrom(btn.dataset.date);
    if (dn != null) pick(dn);
  };

  const onKeyDown = (e) => {
    const btn = e.target.closest?.(".hud-calendar-day");
    if (!btn || !monthsEl.contains(btn) || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    const from = dayFrom(btn.dataset.date) ?? focusDay;
    const rtl = getComputedStyle(root).direction === "rtl";
    const column = (weekdayOf(from) - weekStart + 7) % 7;
    let to;
    switch (e.key) {
      case "ArrowRight": to = from + (rtl ? -1 : 1); break;
      case "ArrowLeft": to = from + (rtl ? 1 : -1); break;
      case "ArrowDown": to = from + 7; break;
      case "ArrowUp": to = from - 7; break;
      case "Home": to = from - column; break;
      case "End": to = from + 6 - column; break;
      case "PageUp": to = addMonths(from, e.shiftKey ? -12 : -1); break;
      case "PageDown": to = addMonths(from, e.shiftKey ? 12 : 1); break;
      default: return;
    }
    e.preventDefault();
    moveTo(to);
  };

  const onFocusIn = (e) => {
    const btn = e.target.closest?.(".hud-calendar-day");
    if (!btn || !monthsEl.contains(btn)) return;
    const dn = dayFrom(btn.dataset.date);
    if (dn == null || !buttons.has(dn)) return; // an outside day, about to be picked
    const previewing = mode === "range" && sel.from != null && sel.to == null;
    if (dn === focusDay && (!previewing || hover === dn)) return;
    focusDay = dn;
    if (previewing) hover = dn;
    render();
  };

  const onPointerOver = (e) => {
    if (mode !== "range" || sel.from == null || sel.to != null) return;
    const btn = e.target.closest?.(".hud-calendar-day");
    const dn = btn && btn.getAttribute("aria-disabled") !== "true" ? dayFrom(btn.dataset.date) : null;
    if (dn != null && dn !== hover) {
      hover = dn;
      render();
    }
  };

  const onPointerLeave = () => {
    if (hover == null) return;
    hover = null;
    render();
  };

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown);
  monthsEl.addEventListener("focusin", onFocusIn);
  monthsEl.addEventListener("pointerover", onPointerOver);
  monthsEl.addEventListener("pointerleave", onPointerLeave);

  // Painted before it goes in, so the live caption does not announce
  // the first month on load.
  render();
  root.replaceChildren(nav, monthsEl, ...(readout ? [readout] : []));

  return {
    get value() {
      return detailOf(mode, sel).value;
    },
    setValue(v) {
      sel = selectionOf(mode, v);
      hover = null;
      const first = firstSelected(mode, sel);
      if (first != null && (first < view || first > lastVisible())) {
        focusDay = clamp(first);
        reveal();
      }
      render();
    },
    goTo(date) {
      const dn = dayFrom(date);
      if (dn == null) return;
      focusDay = clamp(dn);
      reveal();
      render();
    },
    /** Change min, max or isDisabled after init and redraw. No event. */
    setOptions(next = {}) {
      limit(next);
      focusDay = clamp(focusDay);
      reveal();
      render();
    },
    destroy() {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeyDown);
      monthsEl.removeEventListener("focusin", onFocusIn);
      monthsEl.removeEventListener("pointerover", onPointerOver);
      monthsEl.removeEventListener("pointerleave", onPointerLeave);
      root.replaceChildren(...original);
    },
  };
}

/* ---------------------------------------------------------------- */

const GLYPH =
  '<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1">' +
  '<rect x="1.5" y="2.5" width="9" height="8"/><path d="M1.5 5.5h9M4 1v3M8 1v3"/>' +
  '<rect x="3" y="7" width="2" height="2" fill="currentColor" stroke="none"/></svg>';

function defaultPresets(mode) {
  const shift = (d, k) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
  const monthOf = (d, k) => ({
    from: new Date(d.getFullYear(), d.getMonth() + k, 1),
    to: new Date(d.getFullYear(), d.getMonth() + k + 1, 0),
  });
  if (mode === "range") {
    return [
      { label: "Today", value: (t) => ({ from: t, to: t }) },
      { label: "Yesterday", value: (t) => ({ from: shift(t, -1), to: shift(t, -1) }) },
      { label: "Last 7 days", value: (t) => ({ from: shift(t, -6), to: t }) },
      { label: "Last 30 days", value: (t) => ({ from: shift(t, -29), to: t }) },
      { label: "This month", value: (t) => monthOf(t, 0) },
      { label: "Last month", value: (t) => monthOf(t, -1) },
    ];
  }
  if (mode === "multiple") return [];
  return [
    { label: "Today", value: (t) => t },
    { label: "Tomorrow", value: (t) => shift(t, 1) },
    { label: "In a week", value: (t) => shift(t, 7) },
  ];
}

const PICKER_LABELS = { dialog: "Choose date", presets: "Presets" };
const PLACEHOLDER = { single: "Pick a date", range: "Pick a range", multiple: "Pick dates" };

export function datePicker(trigger, options = {}) {
  if (typeof document === "undefined" || !trigger) return { ...noop(options.mode), open() {}, close() {} };

  const {
    mode = "single",
    presets,
    format,
    input,
    placeholder = PLACEHOLDER[mode] ?? PLACEHOLDER.single,
    labels: labelOptions,
    side = "bottom",
    align = "start",
    onChange,
    ...calendarOptions
  } = options;

  const labels = {
    ...PICKER_LABELS,
    ...(mode === "range" ? { dialog: "Choose date range" } : null),
    ...labelOptions,
  };
  const locale = resolveLocale(calendarOptions.locale);
  const dtf = new Intl.DateTimeFormat(locale, typeof format === "object" && format ? format : { dateStyle: "medium" });
  const long = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
  const show = typeof format === "function" ? format : (d) => dtf.format(d);
  const say = typeof format === "function" ? format : (d) => long.format(d);

  const id = uid("hud-datepicker");

  /* ---- trigger ---- */
  const saved = {
    children: [...trigger.childNodes],
    attrs: Object.fromEntries(
      ["type", "aria-haspopup", "aria-expanded", "aria-controls", "aria-labelledby", "id"].map((a) => [a, trigger.getAttribute(a)]),
    ),
  };
  if (!trigger.id) trigger.id = `${id}-trigger`;
  if (trigger.tagName === "BUTTON" && !saved.attrs.type) trigger.type = "button";

  const glyph = make("span", "hud-datepicker-glyph", { "aria-hidden": "true" });
  glyph.innerHTML = GLYPH;
  const visual = make("span", "hud-datepicker-text", { "aria-hidden": "true" });
  const spoken = make("span", "hud-datepicker-sr", { id: `${id}-value` });
  trigger.replaceChildren(glyph, visual, spoken);

  // trigger.labels is empty while the trigger is not yet in the document,
  // so a picker wired before mounting looks the labels up itself.
  const labelsOf = () => {
    if (trigger.labels?.length) return [...trigger.labels];
    const scope = trigger.getRootNode();
    const found =
      saved.attrs.id && scope.querySelectorAll
        ? [...scope.querySelectorAll(`label[for="${CSS.escape(saved.attrs.id)}"]`)]
        : [];
    const wrap = trigger.closest("label");
    return wrap && !found.includes(wrap) ? [...found, wrap] : found;
  };
  let nameIds = saved.attrs["aria-labelledby"]?.split(/\s+/).filter(Boolean) ?? [];
  const namedLabels = []; // labels given an id here, to take it back on destroy
  if (!nameIds.length) {
    nameIds = labelsOf().map((l) => {
      if (!l.id) {
        l.id = uid("hud-datepicker-label");
        namedLabels.push(l);
      }
      return l.id;
    });
  }
  if (!nameIds.length && trigger.getAttribute("aria-label")) nameIds = [trigger.id];
  trigger.setAttribute("aria-labelledby", [...nameIds, spoken.id].join(" "));
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");

  /* ---- popover ---- */
  const pop = make("div", "hud-datepicker hud-brackets", {
    id: `${id}-pop`,
    popover: "auto",
    role: "dialog",
    "aria-label": labels.dialog,
  });
  trigger.setAttribute("aria-controls", pop.id);

  const presetList = presets === true ? defaultPresets(mode) : Array.isArray(presets) ? presets : [];
  const presetsEl = presetList.length
    ? make("div", "hud-datepicker-presets", { role: "group", "aria-label": labels.presets })
    : null;
  const presetButtons = presetList.map((p) => {
    const b = make("button", "hud-datepicker-preset", { type: "button" });
    b.textContent = p.label;
    presetsEl.append(b);
    return b;
  });

  const calRoot = make("div", "hud-calendar");
  pop.append(...(presetsEl ? [presetsEl] : []), calRoot);

  /* ---- hidden inputs ---- */
  let created = null;
  let inputs = [];
  if (typeof input === "string") {
    created = make("input", "", { type: "hidden", name: input });
    inputs = [created];
  } else if (Array.isArray(input)) inputs = input.filter(Boolean);
  else if (input) inputs = [input];

  trigger.after(pop);
  if (created) pop.after(created);

  /* ---- state out ---- */
  const text = (className, t) => {
    const s = make("span", className);
    s.textContent = t;
    return s;
  };

  const paint = (detail) => {
    const { value: v } = detail;
    let parts;
    let words;
    if (mode === "range") {
      if (v.from) {
        parts = [
          text("hud-datepicker-value", show(v.from)),
          text("hud-window-reticle", "⟶"),
          v.to ? text("hud-datepicker-value", show(v.to)) : text("hud-datepicker-placeholder", "…"),
        ];
        words = v.to
          ? typeof format !== "function" && long.formatRange ? long.formatRange(v.from, v.to) : `${say(v.from)} – ${say(v.to)}`
          : `${say(v.from)} –`;
      }
    } else if (mode === "multiple") {
      if (v.length) {
        parts = [text("hud-datepicker-value", show(v[0]))];
        if (v.length > 1) parts.push(text("hud-datepicker-more", `+${v.length - 1}`));
        words = v.map(say).join(", ");
      }
    } else if (v) {
      parts = [text("hud-datepicker-value", show(v))];
      words = say(v);
    }
    visual.replaceChildren(...(parts ?? [text("hud-datepicker-placeholder", placeholder)]));
    spoken.textContent = words ?? placeholder;
  };

  const sync = ({ iso }) => {
    if (!inputs.length) return;
    if (mode === "range") {
      if (inputs.length > 1) {
        inputs[0].value = iso.from ?? "";
        inputs[1].value = iso.to ?? "";
      } else inputs[0].value = iso.from && iso.to ? `${iso.from}/${iso.to}` : "";
    } else if (mode === "multiple") inputs[0].value = iso.join(",");
    else inputs[0].value = iso ?? "";
  };

  let release = () => {};
  const isOpen = () => pop.matches(":popover-open");

  const close = () => {
    if (isOpen()) pop.hidePopover();
  };

  const commit = (detail) => {
    paint(detail);
    sync(detail);
    trigger.dispatchEvent(new CustomEvent("hud-change", { bubbles: true, detail }));
    onChange?.(detail);
  };

  const cal = calendar(calRoot, {
    ...calendarOptions,
    labels: labelOptions,
    mode,
    locale,
    onChange: (detail) => {
      commit(detail);
      const done = mode === "range" ? detail.value.to != null : mode === "single" && detail.value != null;
      if (done) close();
    },
  });

  const initial = detailOf(mode, selectionOf(mode, calendarOptions.value));
  paint(initial);
  sync(initial);

  /* ---- presets ---- */
  const bounds = {
    min: dayFrom(calendarOptions.min),
    max: dayFrom(calendarOptions.max),
    isDisabled: calendarOptions.isDisabled,
  };
  const allowed = (dn) =>
    dn != null &&
    (bounds.min == null || dn >= bounds.min) &&
    (bounds.max == null || dn <= bounds.max) &&
    !bounds.isDisabled?.(toDate(dn));
  const presetValue = (p) => {
    const t = toDate(dayFrom(new Date()));
    return typeof p.value === "function" ? p.value(t) : p.value;
  };
  const refreshPresets = () => {
    presetList.forEach((p, i) => {
      const s = selectionOf(mode, presetValue(p));
      const ends = mode === "range" ? [s.from, s.to ?? s.from] : mode === "multiple" ? [...s] : [s];
      const ok = ends.length > 0 && ends.every(allowed);
      if (ok) presetButtons[i].removeAttribute("aria-disabled");
      else presetButtons[i].setAttribute("aria-disabled", "true");
    });
  };
  const presetNav = presetsEl ? roving(presetsEl, { items: ".hud-datepicker-preset", orientation: "vertical" }) : null;

  const onPresetClick = (e) => {
    const b = e.target.closest?.(".hud-datepicker-preset");
    const i = presetButtons.indexOf(b);
    if (i < 0 || b.getAttribute("aria-disabled") === "true") return;
    cal.setValue(presetValue(presetList[i]));
    commit(detailOf(mode, selectionOf(mode, cal.value)));
    close();
  };
  presetsEl?.addEventListener("click", onPresetClick);

  /* ---- open / close ---- */
  const open = () => {
    if (trigger.disabled || trigger.getAttribute("aria-disabled") === "true" || isOpen()) return;
    refreshPresets();
    const v = cal.value;
    const first = mode === "range" ? v.from : mode === "multiple" ? v[0] : v;
    cal.goTo(first ?? new Date());
    pop.showPopover();
    release = anchor(pop, trigger, { side, align });
    trigger.setAttribute("aria-expanded", "true");
    calRoot.querySelector('.hud-calendar-day[tabindex="0"]')?.focus();
  };

  // A popover="auto" is light-dismissed on pointerup, before the trigger's
  // click lands; without this the same click would reopen it. A keyboard
  // click (detail 0) never follows a pointerdown, so it ignores the flag.
  let wasOpen = false;
  const onPointerDown = () => {
    wasOpen = isOpen();
  };
  const onTriggerClick = (e) => {
    const dismissed = wasOpen && e.detail > 0;
    wasOpen = false;
    if (dismissed || isOpen()) close();
    else open();
  };

  const onToggle = (e) => {
    if (e.newState !== "closed") return;
    release();
    release = () => {};
    trigger.setAttribute("aria-expanded", "false");
    const active = document.activeElement;
    if (!active || active === document.body || pop.contains(active)) trigger.focus({ preventScroll: true });
  };

  const onFocusOut = (e) => {
    const to = e.relatedTarget;
    if (to && !pop.contains(to)) close();
  };

  // One event per change for the page: the calendar's own stops here.
  const onInnerChange = (e) => {
    if (e.target === calRoot) e.stopPropagation();
  };

  trigger.addEventListener("pointerdown", onPointerDown);
  trigger.addEventListener("click", onTriggerClick);
  pop.addEventListener("toggle", onToggle);
  pop.addEventListener("focusout", onFocusOut);
  pop.addEventListener("hud-change", onInnerChange);

  return {
    get value() {
      return cal.value;
    },
    setValue(v) {
      cal.setValue(v);
      const detail = detailOf(mode, selectionOf(mode, cal.value));
      paint(detail);
      sync(detail);
    },
    /** Change min, max or isDisabled after init — calendar and presets. No event. */
    setOptions(next = {}) {
      cal.setOptions(next);
      if ("min" in next) bounds.min = dayFrom(next.min);
      if ("max" in next) bounds.max = dayFrom(next.max);
      if ("isDisabled" in next) bounds.isDisabled = next.isDisabled;
      refreshPresets();
    },
    open,
    close,
    destroy() {
      release();
      trigger.removeEventListener("pointerdown", onPointerDown);
      trigger.removeEventListener("click", onTriggerClick);
      pop.removeEventListener("toggle", onToggle);
      pop.removeEventListener("focusout", onFocusOut);
      pop.removeEventListener("hud-change", onInnerChange);
      presetsEl?.removeEventListener("click", onPresetClick);
      presetNav?.destroy();
      if (isOpen()) pop.hidePopover();
      cal.destroy();
      pop.remove();
      created?.remove();
      trigger.replaceChildren(...saved.children);
      for (const [name, v] of Object.entries(saved.attrs)) {
        if (v == null) trigger.removeAttribute(name);
        else trigger.setAttribute(name, v);
      }
      for (const l of namedLabels) l.removeAttribute("id");
    },
  };
}
