/**
 * Data-table behaviour for a native <table class="hud-table"> — sort,
 * select, filter, page. No framework, no dependency.
 *
 *   import { sortable, selectable, filterRows, paginate } from "@valeness/hangar/table";
 *
 *   const sort = sortable(table);
 *   const selection = selectable(table);
 *   const pager = paginate(table, nav, { pageSize: 10 });
 *   search.addEventListener("input", () => filterRows(table, search.value));
 *   table.addEventListener("hud-selectionchange", (e) => {
 *     count.textContent = String(e.detail.count).padStart(2, "0");
 *   });
 *   // later: sort.destroy(); selection.destroy(); pager.destroy();
 *
 * sortable(table, { compare?, reorder? })
 *   Every <button class="hud-table-sort"> in the thead sorts its column.
 *   It is a native button, so click, Enter and Space all work. The <th>
 *   gets aria-sort="ascending" ⇄ "descending"; the previously sorted
 *   header loses aria-sort (APG: one sorted header at a time). Keys come
 *   from the cell's data-value, else a <time datetime>, else its text.
 *   A column whose keys are all numbers ("1,284", "41.2 ms", "$4.20",
 *   "−3", "12%") sorts numerically; all ISO dates, chronologically;
 *   otherwise by a locale collator with numeric ordering. Empty cells
 *   go last in both directions. The sort is stable, moves the row
 *   nodes (so selection and focus state travel with them), keeps each
 *   <tbody> separate and keeps the empty-state row last.
 *   compare(a, b, { column, header, rowA, rowB }) replaces the default
 *   ascending comparison of two keys. Fires `hud-sortchange` on the
 *   table: detail { column, direction, header }.
 *   reorder (default true): false never moves a row — the headers still
 *   toggle aria-sort and fire hud-sortchange, and you sort your own
 *   data from the event. Use it when a framework renders the rows.
 *   Handle: sort(column, direction = "ascending") acts like a click,
 *   event included. setSort(column, direction = "ascending") sets the
 *   same state from code — aria-sort, and the row order when reorder
 *   is on — without firing hud-sortchange; setSort(null) clears
 *   aria-sort. column is an index or a header cell.
 *
 * selectable(table)
 *   The first checkbox in each body row (prefer one inside
 *   .hud-table-check) selects that row and mirrors onto the <tr> as
 *   aria-selected. The checkbox in the thead selects every row that is
 *   currently displayed (not filtered out, not on another page), and
 *   shows checked / indeterminate / unchecked for those rows. Shift-click
 *   selects the range from the last row clicked. Disabled checkboxes are
 *   skipped. Fires `hud-selectionchange` on the table: detail
 *   { rows, count } — every selected row, displayed or not.
 *   Rows added later are adopted (a checked box or aria-selected="true"
 *   selects them) and the header box follows rows being added, removed
 *   or hidden; a selected row that is removed simply leaves the
 *   selection, with no event.
 *   Handle: selected(); selectAll(on = true) and clear(), which fire
 *   the event like a click; setSelected(rows | (row) => boolean), which
 *   sets exactly that selection (disabled boxes included) from code
 *   without firing it.
 *
 * filterRows(table, query)
 *   Hides body rows whose text does not contain every whitespace-
 *   separated term of query (case- and accent-insensitive; checkbox,
 *   .hud-table-actions and [data-filter="off"] cells are not searched).
 *   Shows the row holding a .hud-table-empty cell when nothing matches.
 *   Returns the number of matching rows and fires `hud-filterchange`:
 *   detail { query, count }. It is one pass over the rows there now:
 *   call it again after rows are added or re-rendered (same query is
 *   fine — paginate() keeps its page unless the terms changed).
 *
 * paginate(table, nav, { pageSize = 10, page = 1, siblings = 1, labels })
 *   Drives a <nav class="hud-pagination">: renders its
 *   .hud-pagination-list (page buttons with ellipses, or a PAGE 03/12
 *   readout when the nav is .hud-pagination--compact), shows only the
 *   current page's rows, follows a new filterRows() query back to page
 *   1, follows sorts and added/removed rows and <tbody>s, reads a
 *   <select> inside .hud-pagination-size as the page size, and keeps
 *   focus on the control the user was on across re-renders. Fires
 *   `hud-pagechange` on the nav: detail { page, pages, pageSize, total }
 *   — whenever one of those changes, go() and setPageSize() included;
 *   pushing back the page it just reported is a no-op, so a two-way
 *   binding settles. The list is the module's: render it empty (or
 *   not at all — it is created, and removed again on destroy()).
 *   labels: { prev, next, previousPage, nextPage, page(n), readout }.
 *
 * Every function is SSR-safe. The widgets return an object with
 * destroy(). filterRows() and paginate() own the `hidden` attribute of
 * body rows: do not set it on data rows yourself while they are active.
 * Header cells with rowspan are not accounted for; colspan is.
 *
 * With React, Vue or Svelte the rows are the framework's. Pass
 * { reorder: false } and sort your data on hud-sortchange; key rows by
 * id; do not render `hidden`, aria-sort, aria-selected, the checked
 * state of the row / header checkboxes or the page-size <select>'s
 * value — the module owns them — and push state in with setSort(),
 * setSelected(), go(), setPageSize(). selectable() and paginate()
 * follow the rendered rows by themselves; filterRows() does not: re-run
 * it after each render that changes rows, or filter in your own state.
 */

const FILTERED = "data-hud-filtered";
const PAGED = "data-hud-paged";
const NOOP = { destroy() {} };

const isEmptyRow = (row) => !!row.querySelector(":scope > .hud-table-empty");

function dataRows(table) {
  const rows = [];
  for (const body of table.tBodies) for (const row of body.rows) if (!isEmptyRow(row)) rows.push(row);
  return rows;
}

function emptyRowOf(table) {
  for (const body of table.tBodies) for (const row of body.rows) if (isEmptyRow(row)) return row;
  return null;
}

function syncHidden(row) {
  row.hidden = row.hasAttribute(FILTERED) || row.hasAttribute(PAGED);
}

function flag(row, attr, on) {
  if (row.hasAttribute(attr) === on) return;
  row.toggleAttribute(attr, on);
  syncHidden(row);
}

/* Column index of a cell, counting colspans before it. */
function columnOf(cell) {
  let col = 0;
  for (const c of cell.parentElement.cells) {
    if (c === cell) return col;
    col += c.colSpan;
  }
  return col;
}

function cellAt(row, col) {
  let i = 0;
  for (const c of row.cells) {
    if (col < i + c.colSpan) return c;
    i += c.colSpan;
  }
  return null;
}

function keyOf(cell) {
  if (!cell) return "";
  if (cell.dataset.value !== undefined) return cell.dataset.value.trim();
  const time = cell.querySelector("time[datetime]");
  if (time) return time.getAttribute("datetime").trim();
  return cell.textContent.replace(/\s+/g, " ").trim();
}

const NUMBER = /^([+-]?)[$€£¥]?\s*([+-]?)(\d*\.?\d+(?:e[+-]?\d+)?)\s*(?:%|[a-zµ°/]+)?$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function toNumber(key) {
  const m = NUMBER.exec(key.replace(/[\s,_\u00a0\u202f]/g, "").replace(/[\u2212\u2013]/g, "-"));
  if (!m) return null;
  const negative = (m[1] === "-") !== (m[2] === "-");
  return (negative ? -1 : 1) * Number(m[3]);
}

/* ---------------------------------------------------------------
   sortable
   --------------------------------------------------------------- */

export function sortable(table, options = {}) {
  if (typeof document === "undefined" || !table) return { sort() {}, setSort() {}, ...NOOP };
  const { compare, reorder = true } = options;
  const lang = table.closest("[lang]")?.lang || undefined;
  const collator = new Intl.Collator(lang, { numeric: true, sensitivity: "base" });

  function headerFor(column) {
    if (typeof column !== "number") return column;
    const rows = table.tHead?.rows;
    const last = rows?.[rows.length - 1];
    return last ? cellAt(last, column) : null;
  }

  function clearOthers(header) {
    for (const th of table.tHead?.querySelectorAll("th[aria-sort]") ?? []) {
      if (th !== header) th.removeAttribute("aria-sort");
    }
  }

  function reorderRows(header, col, desc) {
    const groups = [...table.tBodies].map((body) =>
      [...body.rows].filter((r) => !isEmptyRow(r)).map((row, index) => ({ row, index, key: keyOf(cellAt(row, col)) })),
    );
    const keys = groups.flat().map((e) => e.key).filter(Boolean);
    const kind = keys.length && keys.every((k) => toNumber(k) !== null)
      ? "number"
      : keys.length && keys.every((k) => ISO_DATE.test(k) && !Number.isNaN(Date.parse(k)))
        ? "date"
        : "text";
    const value = (k) => (kind === "number" ? toNumber(k) : kind === "date" ? Date.parse(k) : k);

    const ascending = compare
      ? (a, b) => compare(a.key, b.key, { column: col, header, rowA: a.row, rowB: b.row })
      : (a, b) => (kind === "text" ? collator.compare(a.key, b.key) : value(a.key) - value(b.key));

    groups.forEach((entries, i) => {
      const body = table.tBodies[i];
      entries.sort((a, b) => {
        if (!compare && !a.key !== !b.key) return a.key ? -1 : 1;
        const r = ascending(a, b);
        return (desc ? -r : r) || a.index - b.index;
      });
      const empty = [...body.rows].find(isEmptyRow);
      body.append(...entries.map((e) => e.row), ...(empty ? [empty] : []));
    });
  }

  function apply(column, direction, notify) {
    const header = headerFor(column);
    if (!header) return;
    const col = columnOf(header);
    const desc = direction === "descending";

    clearOthers(header);
    header.setAttribute("aria-sort", desc ? "descending" : "ascending");
    if (reorder) reorderRows(header, col, desc);

    if (!notify) return;
    table.dispatchEvent(new CustomEvent("hud-sortchange", {
      bubbles: true,
      detail: { column: col, direction: desc ? "descending" : "ascending", header },
    }));
  }

  const sort = (column, direction = "ascending") => apply(column, direction, true);

  function setSort(column, direction = "ascending") {
    if (column === null || column === undefined) clearOthers(null);
    else apply(column, direction, false);
  }

  const onClick = (event) => {
    const button = event.target.closest?.(".hud-table-sort");
    if (!button || !table.tHead?.contains(button)) return;
    const th = button.closest("th");
    sort(th, th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending");
  };

  table.addEventListener("click", onClick);
  return {
    sort,
    setSort,
    destroy() {
      table.removeEventListener("click", onClick);
    },
  };
}

/* ---------------------------------------------------------------
   selectable
   --------------------------------------------------------------- */

const boxOf = (row) =>
  row.querySelector(".hud-table-check input[type=checkbox]") ?? row.querySelector("input[type=checkbox]");

export function selectable(table) {
  if (typeof document === "undefined" || !table) {
    return { selected: () => [], selectAll() {}, clear() {}, setSelected() {}, ...NOOP };
  }
  const head = () => table.tHead?.querySelector("input[type=checkbox]") ?? null;
  const displayed = () => dataRows(table).filter((r) => !r.hidden && !boxOf(r)?.disabled);
  const selected = () => dataRows(table).filter((r) => boxOf(r)?.checked);

  let anchor = null;
  let shift = false;

  function mark(row, on) {
    const box = boxOf(row);
    if (!box) return;
    box.checked = on;
    row.setAttribute("aria-selected", String(on));
  }

  function syncHead() {
    const box = head();
    if (!box) return;
    const rows = displayed();
    const n = rows.filter((r) => boxOf(r)?.checked).length;
    box.checked = n > 0 && n === rows.length;
    box.indeterminate = n > 0 && n < rows.length;
    box.disabled = rows.length === 0;
  }

  function emit() {
    const rows = selected();
    table.dispatchEvent(new CustomEvent("hud-selectionchange", { bubbles: true, detail: { rows, count: rows.length } }));
  }

  /* Markup may state selection on either side: a checked box or
     aria-selected="true". Either one wins. */
  function adopt() {
    for (const row of dataRows(table)) {
      const box = boxOf(row);
      if (!box) continue;
      mark(row, box.checked || row.getAttribute("aria-selected") === "true");
    }
    syncHead();
  }

  const onClick = (event) => {
    if (event.target.matches?.("input[type=checkbox]")) shift = event.shiftKey;
  };

  const onChange = (event) => {
    const box = event.target;
    if (!box.matches?.("input[type=checkbox]")) return;
    if (box === head()) {
      for (const row of displayed()) mark(row, box.checked);
      anchor = null;
    } else {
      const row = box.closest("tr");
      if (!row || boxOf(row) !== box || !row.parentElement || row.parentElement.tagName !== "TBODY") return;
      const rows = displayed();
      if (shift && anchor && rows.includes(anchor) && rows.includes(row)) {
        const [a, b] = [rows.indexOf(anchor), rows.indexOf(row)].sort((x, y) => x - y);
        for (const r of rows.slice(a, b + 1)) mark(r, box.checked);
      } else {
        mark(row, box.checked);
      }
      anchor = row;
    }
    shift = false;
    syncHead();
    emit();
  };

  /* Rows come and go (filter, page, sort, your own inserts): keep the
     header box honest and adopt new rows' state. */
  const observer = new MutationObserver((records) => {
    if (records.some((r) => r.type === "childList" && r.addedNodes.length)) adopt();
    else syncHead();
  });
  observer.observe(table, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });

  table.addEventListener("click", onClick, true);
  table.addEventListener("change", onChange);
  adopt();

  return {
    /** Every selected data row, displayed or not. */
    selected,
    /** Select or clear every displayed row. */
    selectAll(on = true) {
      for (const row of displayed()) mark(row, on);
      syncHead();
      emit();
    },
    /** Clear the whole selection, including rows on other pages. */
    clear() {
      for (const row of dataRows(table)) if (!boxOf(row)?.disabled) mark(row, false);
      syncHead();
      emit();
    },
    /** Set exactly this selection from code — the rows to select, or a
        predicate — without firing hud-selectionchange. */
    setSelected(rows) {
      const set = typeof rows === "function" ? null : new Set(rows ?? []);
      for (const row of dataRows(table)) mark(row, set ? set.has(row) : !!rows(row));
      syncHead();
    },
    destroy() {
      observer.disconnect();
      table.removeEventListener("click", onClick, true);
      table.removeEventListener("change", onChange);
    },
  };
}

/* ---------------------------------------------------------------
   filterRows
   --------------------------------------------------------------- */

const fold = (s) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

function searchText(row) {
  let text = "";
  for (const cell of row.cells) {
    if (cell.matches(".hud-table-check, .hud-table-actions, [data-filter='off']")) continue;
    text += ` ${cell.textContent}`;
  }
  return fold(text);
}

/* The terms each table was last filtered by (none yet = ""), and the
   hud-filterchange events that only re-applied them: rows were added
   or re-rendered, the query did not change. paginate() keeps its page
   for those instead of going back to page 1. */
const appliedTerms = new WeakMap();
const reapplied = new WeakSet();

export function filterRows(table, query = "") {
  if (typeof document === "undefined" || !table) return 0;
  const terms = fold(String(query)).split(/\s+/).filter(Boolean);
  let count = 0;
  for (const row of dataRows(table)) {
    const text = terms.length ? searchText(row) : "";
    const match = terms.every((t) => text.includes(t));
    if (match) count++;
    flag(row, FILTERED, !match);
  }
  const empty = emptyRowOf(table);
  if (empty) empty.hidden = count > 0;
  const event = new CustomEvent("hud-filterchange", { bubbles: true, detail: { query: String(query), count } });
  const key = terms.join(" ");
  if ((appliedTerms.get(table) ?? "") === key) reapplied.add(event);
  appliedTerms.set(table, key);
  table.dispatchEvent(event);
  return count;
}

/* ---------------------------------------------------------------
   paginate
   --------------------------------------------------------------- */

const pad = (n) => String(n).padStart(2, "0");

const LABELS = {
  prev: "Prev",
  next: "Next",
  previousPage: "Previous page",
  nextPage: "Next page",
  page: (n) => `Page ${n}`,
  readout: "Page",
};

/* First, last, current ± siblings, and an ellipsis for each gap — a
   constant number of slots, so the buttons do not jump as you page. */
function windowOf(page, pages, siblings) {
  const slots = siblings * 2 + 5;
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  if (pages <= slots) return range(1, pages);
  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, pages);
  if (left <= 3) return [...range(1, 3 + 2 * siblings), "gap", pages];
  if (right >= pages - 2) return [1, "gap", ...range(pages - 2 - 2 * siblings, pages)];
  return [1, "gap", ...range(left, right), "gap", pages];
}

export function paginate(table, nav, options = {}) {
  if (typeof document === "undefined" || !table || !nav) {
    return { go() {}, setPageSize() {}, refresh() {}, page: 1, pages: 1, ...NOOP };
  }
  const labels = { ...LABELS, ...options.labels };
  const siblings = options.siblings ?? 1;
  const sizeSelect = nav.querySelector(".hud-pagination-size select");
  let pageSize = options.pageSize ?? (Number(sizeSelect?.value) || 10);
  let page = options.page ?? 1;
  let pages = 1;
  let last = "";

  let list = nav.querySelector(".hud-pagination-list");
  const created = !list;
  const original = list ? [...list.childNodes] : [];
  if (!list) {
    list = document.createElement("ul");
    list.className = "hud-pagination-list";
    nav.prepend(list);
  }
  if (sizeSelect && options.pageSize !== undefined) sizeSelect.value = String(pageSize);

  const item = (child, hidden = false) => {
    const li = document.createElement("li");
    if (hidden) li.setAttribute("aria-hidden", "true");
    li.append(child);
    return li;
  };

  const button = (key, text, className, attrs = {}) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = className;
    b.dataset.hudPage = String(key);
    b.textContent = text;
    for (const [k, v] of Object.entries(attrs)) if (v !== false) b.setAttribute(k, v === true ? "" : v);
    return b;
  };

  function render() {
    const focused = list.contains(document.activeElement) ? document.activeElement.dataset.hudPage : null;
    const items = [
      item(button("prev", labels.prev, "hud-pagination-step hud-pagination-prev", {
        "aria-label": labels.previousPage,
        disabled: page <= 1,
      })),
    ];
    if (nav.classList.contains("hud-pagination--compact")) {
      const readout = document.createElement("span");
      readout.className = "hud-pagination-readout";
      readout.setAttribute("aria-live", "polite");
      const label = document.createElement("span");
      label.className = "hud-pagination-label";
      label.textContent = labels.readout;
      readout.append(label, ` ${pad(page)}/${pad(pages)}`);
      items.push(item(readout));
    } else {
      for (const slot of windowOf(page, pages, siblings)) {
        if (slot === "gap") {
          const gap = document.createElement("span");
          gap.className = "hud-pagination-gap";
          gap.textContent = "…";
          items.push(item(gap, true));
        } else {
          items.push(item(button(slot, pad(slot), "hud-pagination-page", {
            "aria-label": labels.page(slot),
            "aria-current": slot === page ? "page" : false,
          })));
        }
      }
    }
    items.push(item(button("next", labels.next, "hud-pagination-step hud-pagination-next", {
      "aria-label": labels.nextPage,
      disabled: page >= pages,
    })));
    list.replaceChildren(...items);

    if (focused === null) return;
    const same = list.querySelector(`[data-hud-page="${focused}"]:not(:disabled)`);
    const fallback = list.querySelector('[aria-current="page"]') ?? list.querySelector("button:not(:disabled)");
    (same ?? fallback)?.focus();
  }

  function apply() {
    const rows = dataRows(table);
    const shown = rows.filter((r) => !r.hasAttribute(FILTERED));
    pages = Math.max(1, Math.ceil(shown.length / pageSize));
    page = Math.min(Math.max(1, page), pages);
    const start = (page - 1) * pageSize;
    for (const row of rows) if (row.hasAttribute(FILTERED)) flag(row, PAGED, false);
    shown.forEach((row, i) => flag(row, PAGED, i < start || i >= start + pageSize));
    render();

    const state = { page, pages, pageSize, total: shown.length };
    const key = JSON.stringify(state);
    if (key === last) return;
    last = key;
    nav.dispatchEvent(new CustomEvent("hud-pagechange", { bubbles: true, detail: state }));
  }

  function go(n) {
    page = n;
    apply();
  }

  function setPageSize(n) {
    const size = Math.max(1, Math.floor(Number(n)) || pageSize);
    /* Keep the first row of the current page in view. */
    const first = (page - 1) * pageSize;
    pageSize = size;
    page = Math.floor(first / size) + 1;
    if (sizeSelect && sizeSelect.value !== String(size)) sizeSelect.value = String(size);
    apply();
  }

  const onClick = (event) => {
    const b = event.target.closest?.("button[data-hud-page]");
    if (!b || !list.contains(b) || b.disabled) return;
    const key = b.dataset.hudPage;
    if (key === "prev") go(page - 1);
    else if (key === "next") go(page + 1);
    else if (Number(key) !== page) go(Number(key));
  };
  const onSize = () => setPageSize(sizeSelect.value);
  /* A new query starts over at page 1; the same terms re-applied to
     re-rendered rows keep the page. */
  const onFilter = (event) => (reapplied.has(event) ? apply() : go(1));

  /* Sorts and your own inserts/removals move rows, and a framework may
     swap a whole <tbody>: watch each one and re-slice. */
  const watch = () => {
    observer.observe(table, { childList: true });
    for (const body of table.tBodies) observer.observe(body, { childList: true });
  };
  const observer = new MutationObserver(() => {
    watch();
    apply();
  });
  watch();

  list.addEventListener("click", onClick);
  sizeSelect?.addEventListener("change", onSize);
  table.addEventListener("hud-filterchange", onFilter);
  apply();

  return {
    go,
    setPageSize,
    refresh: apply,
    get page() { return page; },
    get pages() { return pages; },
    destroy() {
      observer.disconnect();
      list.removeEventListener("click", onClick);
      sizeSelect?.removeEventListener("change", onSize);
      table.removeEventListener("hud-filterchange", onFilter);
      for (const row of dataRows(table)) flag(row, PAGED, false);
      if (created) list.remove();
      else list.replaceChildren(...original);
    },
  };
}
