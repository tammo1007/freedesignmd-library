/**
 * DataTable — a production-grade data table: sortable columns (aria-sort),
 * row selection with an indeterminate header checkbox, sticky header,
 * tabular numerals, pagination, a floating bulk-action bar, an empty state and
 * a loading skeleton.
 *
 * Props: data, columns, getRowId, pageSize, loading, selectable, bulkActions,
 * empty (ReactNode), caption (accessible name), maxHeight, theme.
 * Column: { key, header, align?, width?, sortValue?, sort?, render?, narrowHide? }
 *
 * Browser support: all evergreen browsers. Container queries (Chrome 105,
 * Safari 16, Firefox 110) hide low-priority columns on narrow containers;
 * older browsers simply scroll horizontally.
 * Accessibility: native <table>; sortable headers contain a <button> and set
 * aria-sort; checkboxes are real inputs with row-specific labels; sort and
 * selection changes are announced through a polite live region; the bulk bar
 * is a labelled region. Keyboard: Tab / Shift+Tab, Space on checkboxes, Enter
 * or Space on sort buttons, Escape clears the selection.
 * Reduced motion: transitions collapse to opacity changes and the skeleton
 * stops shimmering.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: number | string;
  /** Value used for sorting; presence makes the column sortable. */
  sortValue?: (row: T) => string | number;
  render?: (row: T) => ReactNode;
  /** Hide this column when the table container is narrow. */
  narrowHide?: boolean;
  numeric?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  pageSize?: number;
  loading?: boolean;
  selectable?: boolean;
  bulkActions?: (ctx: { ids: string[]; clear: () => void }) => ReactNode;
  empty?: ReactNode;
  caption: string;
  maxHeight?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  noun?: [string, string];
  theme?: "light" | "dark";
  className?: string;
}

type Dir = "asc" | "desc";

/** Tracks whether the table's own container is narrow, so hidden columns are not rendered at all (keeps colSpan rows correct). */
function useNarrow(max: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const f = () => setNarrow(el.clientWidth <= max);
    f();
    const ro = new ResizeObserver(f);
    ro.observe(el);
    return () => ro.disconnect();
  }, [max]);
  return [ref, narrow] as const;
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  pageSize = 8,
  loading = false,
  selectable = true,
  bulkActions,
  empty,
  caption,
  maxHeight = 520,
  initialSort,
  noun = ["row", "rows"],
  theme,
  className,
}: DataTableProps<T>) {
  const uid = useId();
  const [sort, setSort] = useState<{ key: string; dir: Dir } | null>(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [scrolled, setScrolled] = useState(false);
  const [live, setLive] = useState("");
  const headCb = useRef<HTMLInputElement>(null);
  const [cardRef, narrow] = useNarrow(680);
  const cols = narrow ? columns.filter((c) => !c.narrowHide) : columns;

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    const f = col.sortValue;
    const m = sort.dir === "asc" ? 1 : -1;
    return data
      .map((r, i) => [r, i] as const)
      .sort((a, b) => {
        const x = f(a[0]);
        const y = f(b[0]);
        const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
        return c * m || a[1] - b[1];
      })
      .map((p) => p[0]);
  }, [data, columns, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, pages - 1);
  useEffect(() => {
    if (page !== cur) setPage(cur);
  }, [page, cur]);
  const rows = sorted.slice(cur * pageSize, cur * pageSize + pageSize);
  const ids = rows.map(getRowId);
  const nSel = ids.filter((i) => picked.has(i)).length;
  const allOnPage = ids.length > 0 && nSel === ids.length;
  const some = nSel > 0 && !allOnPage;

  useLayoutEffect(() => {
    if (headCb.current) headCb.current.indeterminate = some;
  }, [some]);

  const cycle = (c: DataTableColumn<T>) => {
    let next: { key: string; dir: Dir } | null;
    if (!sort || sort.key !== c.key) next = { key: c.key, dir: c.numeric ? "desc" : "asc" };
    else if (sort.dir === (c.numeric ? "desc" : "asc")) next = { key: c.key, dir: c.numeric ? "asc" : "desc" };
    else next = null;
    setSort(next);
    setLive(next ? `Sorted by ${c.header}, ${next.dir === "asc" ? "ascending" : "descending"}` : "Sorting cleared");
  };

  const toggleRow = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      setLive(`${n.size} ${n.size === 1 ? noun[0] : noun[1]} selected`);
      return n;
    });
  const togglePage = () =>
    setPicked((p) => {
      const n = new Set(p);
      if (allOnPage) ids.forEach((i) => n.delete(i));
      else ids.forEach((i) => n.add(i));
      setLive(`${n.size} ${n.size === 1 ? noun[0] : noun[1]} selected`);
      return n;
    });
  const clear = () => {
    setPicked(new Set());
    setLive("Selection cleared");
  };
  const selectAll = () => {
    setPicked(new Set(sorted.map(getRowId)));
    setLive(`All ${sorted.length} ${noun[1]} selected`);
  };

  const total = picked.size;
  const colCount = cols.length + (selectable ? 1 : 0);
  const from = sorted.length ? cur * pageSize + 1 : 0;
  const to = Math.min(sorted.length, cur * pageSize + pageSize);

  const pageButtons = useMemo(() => {
    const out: (number | "…")[] = [];
    for (let i = 0; i < pages; i++) {
      if (i === 0 || i === pages - 1 || Math.abs(i - cur) <= 1) out.push(i);
      else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
  }, [pages, cur]);

  return (
    <div
      className={`fd-dt${className ? " " + className : ""}`}
      data-fd-theme={theme}
      onKeyDown={(e) => {
        if (e.key === "Escape" && total > 0 && !(e.target as HTMLElement).closest("[role=menu]")) clear();
      }}
    >
      <style>{css}</style>
      <div className="fd-dt-card" ref={cardRef}>
        <div className="fd-dt-scroll" style={{ maxHeight }} data-scrolled={scrolled ? "" : undefined} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)} tabIndex={0} role="region" aria-label={`${caption}, scrollable`}>
          <table className="fd-dt-table" aria-busy={loading} aria-rowcount={sorted.length + 1}>
            <caption className="fd-dt-sr">{caption}</caption>
            <thead>
              <tr>
                {selectable && (
                  <th scope="col" className="fd-dt-th fd-dt-chk" style={{ width: 48 }}>
                    <label className="fd-dt-hit">
                      <input ref={headCb} type="checkbox" className="fd-dt-cb" checked={allOnPage} onChange={togglePage} disabled={loading || !rows.length} aria-label={`Select all ${noun[1]} on this page`} />
                    </label>
                  </th>
                )}
                {cols.map((c) => {
                  const active = sort?.key === c.key;
                  const ariaSort = c.sortValue ? (active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none") : undefined;
                  return (
                    <th key={c.key} scope="col" className="fd-dt-th" style={c.width ? { width: c.width } : undefined} data-align={c.align ?? "left"} data-nh={c.narrowHide ? "" : undefined} aria-sort={ariaSort}>
                      {c.sortValue ? (
                        <button type="button" className="fd-dt-sortbtn" data-active={active ? "" : undefined} onClick={() => cycle(c)} disabled={loading}>
                          <span>{c.header}</span>
                          <svg className="fd-dt-arrow" data-dir={active ? sort!.dir : undefined} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M6 2.5v7M3 6.5l3 3 3-3" />
                          </svg>
                        </button>
                      ) : (
                        <span className="fd-dt-plain">{c.header}</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: Math.min(pageSize, 8) }, (_, i) => (
                    <tr key={i} className="fd-dt-row fd-dt-skel" aria-hidden="true">
                      {selectable && (
                        <td className="fd-dt-td fd-dt-chk">
                          <span className="fd-dt-bone" style={{ width: 16, height: 16, borderRadius: 5, marginLeft: 16 }} />
                        </td>
                      )}
                      {cols.map((c, ci) => (
                        <td key={c.key} className="fd-dt-td" data-align={c.align ?? "left"} data-nh={c.narrowHide ? "" : undefined}>
                          <span className="fd-dt-bone" style={{ width: `${[62, 44, 52, 40, 48, 56][(i + ci) % 6]}%`, animationDelay: `${(i * 60 + ci * 40) % 400}ms` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.map((r, ri) => {
                    const id = getRowId(r);
                    const on = picked.has(id);
                    return (
                      <tr key={id} className="fd-dt-row" data-selected={on ? "" : undefined} aria-selected={selectable ? on : undefined} aria-rowindex={cur * pageSize + ri + 2}>
                        {selectable && (
                          <td className="fd-dt-td fd-dt-chk">
                            <label className="fd-dt-hit">
                              <input type="checkbox" className="fd-dt-cb" checked={on} onChange={() => toggleRow(id)} aria-label={`Select row ${cur * pageSize + ri + 1}`} />
                            </label>
                          </td>
                        )}
                        {cols.map((c) => (
                          <td key={c.key} className="fd-dt-td" data-align={c.align ?? "left"} data-num={c.numeric ? "" : undefined} data-nh={c.narrowHide ? "" : undefined}>
                            {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td className="fd-dt-empty" colSpan={colCount}>
                    {empty ?? (
                      <div className="fd-dt-emptybox">
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="9" width="28" height="22" rx="5" /><path d="M6 16h28M13 23h6" /></svg>
                        <b>No results</b>
                        <span>Nothing matches the current filters.</span>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="fd-dt-foot">
          <span className="fd-dt-count" aria-live="off">
            {loading ? "Loading…" : sorted.length ? <>Showing <b>{from}–{to}</b> of <b>{sorted.length}</b></> : "0 results"}
          </span>
          <nav className="fd-dt-pager" aria-label="Pagination">
            <button type="button" className="fd-dt-pbtn" onClick={() => setPage(cur - 1)} disabled={loading || cur === 0} aria-label="Previous page">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
            </button>
            <span className="fd-dt-pages">
              {pageButtons.map((p, i) =>
                p === "…" ? (
                  <span key={"e" + i} className="fd-dt-gap" aria-hidden="true">…</span>
                ) : (
                  <button key={p} type="button" className="fd-dt-pbtn fd-dt-pnum" data-active={p === cur ? "" : undefined} aria-current={p === cur ? "page" : undefined} aria-label={`Page ${p + 1}`} disabled={loading} onClick={() => setPage(p)}>
                    {p + 1}
                  </button>
                ),
              )}
            </span>
            <span className="fd-dt-pof">Page {cur + 1} of {pages}</span>
            <button type="button" className="fd-dt-pbtn" onClick={() => setPage(cur + 1)} disabled={loading || cur >= pages - 1} aria-label="Next page">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
            </button>
          </nav>
        </div>

        <div className="fd-dt-bulk" data-open={total > 0 ? "" : undefined} role="region" aria-label="Bulk actions" inert={total === 0}>
          <span className="fd-dt-bulkn"><b>{total}</b> selected</span>
          {allOnPage && total < sorted.length && (
            <button type="button" className="fd-dt-link" onClick={selectAll}>Select all {sorted.length}</button>
          )}
          <span className="fd-dt-bulksep" aria-hidden="true" />
          {bulkActions?.({ ids: [...picked], clear })}
          <button type="button" className="fd-dt-x" onClick={clear} aria-label="Clear selection">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>
        </div>
      </div>
      <div className="fd-dt-sr" role="status" aria-live="polite" id={`${uid}-live`}>{live}</div>
    </div>
  );
}

const css = `
:where(.fd-dt,.fd-dt *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-dt,.fd-dt *)::before,:where(.fd-dt,.fd-dt *)::after{box-sizing:border-box}
:where(.fd-dt svg){display:block;flex-shrink:0}
:where(.fd-dt button,.fd-dt input){appearance:none;-webkit-appearance:none;outline:0;border-radius:0}
:where(.fd-dt table){border-collapse:separate;border-spacing:0}
.fd-dt{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --t-bg:#fff;--t-head:#FAFAFA;--t-fg:#0B0B0F;--t-mut:#6B6B76;--t-line:rgba(11,11,15,.08);--t-line2:rgba(11,11,15,.14);--t-hover:rgba(11,11,15,.028);
  --t-sel:rgba(79,70,229,.07);--t-accent:#4F46E5;--t-on:#fff;--t-ring:rgba(79,70,229,.45);--t-bone:rgba(11,11,15,.07);--t-bar:#0B0B0F;--t-baron:#fff;
  position:relative;width:100%;font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.006em;color:var(--t-fg);
  -webkit-font-smoothing:antialiased;
}
[data-fd-theme="dark"] .fd-dt,.fd-dt[data-fd-theme="dark"]{--t-bg:#101014;--t-head:#15151A;--t-fg:#F2F2F5;--t-mut:#9A9AA6;--t-line:rgba(255,255,255,.07);--t-line2:rgba(255,255,255,.14);--t-hover:rgba(255,255,255,.03);--t-sel:rgba(129,140,248,.12);--t-accent:#818CF8;--t-on:#0B0B0F;--t-ring:rgba(129,140,248,.55);--t-bone:rgba(255,255,255,.08);--t-bar:#F2F2F5;--t-baron:#0B0B0F}
.fd-dt-card{position:relative;container-type:inline-size;border-radius:16px;background:var(--t-bg);overflow:hidden;box-shadow:0 0 0 1px var(--t-line),0 1px 2px rgba(11,11,15,.04),0 12px 32px -16px rgba(11,11,15,.12)}
.fd-dt-scroll{overflow:auto;overscroll-behavior:contain;border-radius:16px 16px 0 0}
.fd-dt-scroll:focus-visible{outline:2px solid var(--t-ring);outline-offset:-2px}
.fd-dt-table{width:100%;min-width:640px;table-layout:fixed}
.fd-dt-th{position:sticky;top:0;z-index:2;height:44px;padding:0 16px;background:var(--t-head);font-size:12px;line-height:16px;font-weight:500;letter-spacing:0;color:var(--t-mut);text-align:left;white-space:nowrap;box-shadow:inset 0 -1px 0 var(--t-line);transition:box-shadow var(--fd-dur-2)}
.fd-dt-scroll[data-scrolled] .fd-dt-th{box-shadow:inset 0 -1px 0 var(--t-line),0 8px 12px -8px rgba(11,11,15,.14)}
.fd-dt-th[data-align="right"]{text-align:right}.fd-dt-th[data-align="center"]{text-align:center}
.fd-dt-th.fd-dt-chk,.fd-dt-td.fd-dt-chk{padding:0;width:48px}
.fd-dt-sortbtn{display:inline-flex;align-items:center;gap:6px;height:28px;margin:0 -8px;padding:0 8px;border-radius:8px;cursor:pointer;color:inherit;font:inherit;font-weight:500;transition:background-color var(--fd-dur-1),color var(--fd-dur-1)}
.fd-dt-th[data-align="right"] .fd-dt-sortbtn{flex-direction:row-reverse}
.fd-dt-sortbtn:hover:not(:disabled){background:var(--t-hover);color:var(--t-fg)}
.fd-dt-sortbtn[data-active]{color:var(--t-fg)}
.fd-dt-sortbtn:focus-visible{box-shadow:0 0 0 2px var(--t-bg),0 0 0 4px var(--t-ring)}
.fd-dt-sortbtn:disabled{cursor:default;opacity:.6}
.fd-dt-arrow{opacity:0;transform:translateY(2px);transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring)}
.fd-dt-sortbtn:hover .fd-dt-arrow,.fd-dt-sortbtn:focus-visible .fd-dt-arrow{opacity:.45;transform:none}
.fd-dt-sortbtn[data-active] .fd-dt-arrow{opacity:1;transform:none}
.fd-dt-arrow[data-dir="asc"]{transform:rotate(180deg)}
.fd-dt-plain{display:inline-block}
.fd-dt-td{height:56px;padding:0 16px;border-bottom:1px solid var(--t-line);vertical-align:middle;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:background-color var(--fd-dur-1)}
.fd-dt-td[data-align="right"]{text-align:right}.fd-dt-td[data-align="center"]{text-align:center}
.fd-dt-td[data-num]{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1,"cv11" 1}
.fd-dt-row:last-child .fd-dt-td{border-bottom-color:transparent}
@media (hover:hover){.fd-dt-row:hover .fd-dt-td{background:var(--t-hover)}}
.fd-dt-row[data-selected] .fd-dt-td{background:var(--t-sel)}
.fd-dt-row[data-selected] .fd-dt-chk{box-shadow:inset 2px 0 0 var(--t-accent)}
.fd-dt-hit{display:flex;align-items:center;justify-content:center;width:48px;height:100%;min-height:44px;cursor:pointer}
.fd-dt-cb{position:relative;flex:none;width:16px;height:16px;border-radius:5px;background:var(--t-bg);box-shadow:inset 0 0 0 1.5px var(--t-line2);cursor:pointer;transition:background-color var(--fd-dur-1),box-shadow var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-dt-cb::after{content:"";position:absolute;inset:0;opacity:0;transform:scale(.5);transition:opacity var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring);background:center/12px 12px no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 6.3l2.4 2.4 4.6-5'/%3E%3C/svg%3E")}
[data-fd-theme="dark"] .fd-dt-cb::after,.fd-dt[data-fd-theme="dark"] .fd-dt-cb::after{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%230B0B0F' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 6.3l2.4 2.4 4.6-5'/%3E%3C/svg%3E")}
.fd-dt-cb:indeterminate::after{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='white' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M3 6h6'/%3E%3C/svg%3E")}
[data-fd-theme="dark"] .fd-dt-cb:indeterminate::after,.fd-dt[data-fd-theme="dark"] .fd-dt-cb:indeterminate::after{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%230B0B0F' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M3 6h6'/%3E%3C/svg%3E")}
.fd-dt-cb:checked,.fd-dt-cb:indeterminate{background:var(--t-accent);box-shadow:none}
.fd-dt-cb:checked::after,.fd-dt-cb:indeterminate::after{opacity:1;transform:none}
@media (hover:hover){.fd-dt-cb:hover:not(:checked):not(:indeterminate):not(:disabled){box-shadow:inset 0 0 0 1.5px var(--t-mut)}}
.fd-dt-cb:active:not(:disabled){transform:scale(.88)}
.fd-dt-cb:focus-visible{box-shadow:0 0 0 2px var(--t-bg),0 0 0 4px var(--t-ring)}
.fd-dt-cb:disabled{opacity:.4;cursor:default}
.fd-dt-skel .fd-dt-td{border-bottom-color:var(--t-line)}
.fd-dt-bone{display:block;height:12px;max-width:100%;border-radius:6px;background:linear-gradient(90deg,var(--t-bone) 0%,color-mix(in srgb,var(--t-bone) 40%,transparent) 50%,var(--t-bone) 100%);background-size:200% 100%;animation:fd-dt-shine 1.4s var(--fd-ease-in-out) infinite}
[data-align="right"]>.fd-dt-bone{margin-left:auto}
.fd-dt-empty{padding:0;height:320px;border:0}
.fd-dt-emptybox{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:320px;padding:32px;text-align:center;color:var(--t-mut)}
.fd-dt-emptybox svg{margin-bottom:10px;color:var(--t-mut);opacity:.7}
.fd-dt-emptybox b{font-size:15px;line-height:20px;font-weight:600;color:var(--t-fg)}
.fd-dt-emptybox span{font-size:13px;line-height:20px}
.fd-dt-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:56px;padding:8px 16px;border-top:1px solid var(--t-line);font-size:13px;line-height:20px;color:var(--t-mut);font-variant-numeric:tabular-nums}
.fd-dt-count b{font-weight:500;color:var(--t-fg)}
.fd-dt-pager{display:flex;align-items:center;gap:4px}
.fd-dt-pages{display:flex;align-items:center;gap:2px}
.fd-dt-pof{display:none;margin:0 8px}
.fd-dt-gap{display:grid;place-items:center;width:20px}
.fd-dt-pbtn{display:grid;place-items:center;min-width:32px;height:32px;padding:0 6px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;line-height:1;color:var(--t-mut);font-variant-numeric:tabular-nums;transition:background-color var(--fd-dur-1),color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
@media (hover:hover){.fd-dt-pbtn:hover:not(:disabled):not([data-active]){background:var(--t-hover);color:var(--t-fg)}}
.fd-dt-pbtn:active:not(:disabled){transform:scale(.94)}
.fd-dt-pbtn[data-active]{background:var(--t-fg);color:var(--t-bg);cursor:default}
.fd-dt-pbtn:disabled{opacity:.35;cursor:default}
.fd-dt-pbtn:focus-visible{box-shadow:0 0 0 2px var(--t-bg),0 0 0 4px var(--t-ring)}
.fd-dt-bulk{position:absolute;left:50%;bottom:72px;z-index:5;display:flex;align-items:center;gap:12px;height:48px;padding:0 8px 0 16px;border-radius:14px;background:var(--t-bar);color:var(--t-baron);font-size:13px;font-weight:500;white-space:nowrap;
  box-shadow:0 0 0 1px rgba(255,255,255,.08) inset,0 2px 4px rgba(11,11,15,.2),0 16px 40px -8px rgba(11,11,15,.45);
  opacity:0;transform:translate(-50%,16px) scale(.96);pointer-events:none;visibility:hidden;transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-ease-out),visibility 0s linear var(--fd-dur-3)}
.fd-dt-bulk[data-open]{opacity:1;transform:translate(-50%,0);pointer-events:auto;visibility:visible;transition-delay:0s}
.fd-dt-bulkn{font-variant-numeric:tabular-nums}.fd-dt-bulkn b{font-weight:600}
.fd-dt-bulksep{width:1px;height:20px;background:currentColor;opacity:.2}
.fd-dt-link{cursor:pointer;font-size:13px;font-weight:500;line-height:1;color:inherit;opacity:.7;text-decoration:underline;text-underline-offset:3px;padding:8px 2px;border-radius:6px}
.fd-dt-link:hover{opacity:1}
.fd-dt-link:focus-visible,.fd-dt-bulk :where(button):focus-visible{outline:2px solid var(--t-ring);outline-offset:2px}
.fd-dt-x{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;cursor:pointer;color:inherit;opacity:.7;transition:background-color var(--fd-dur-1),opacity var(--fd-dur-1)}
.fd-dt-x:hover{opacity:1;background:rgba(127,127,127,.2)}
.fd-dt-bulk .fd-dt-act{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:500;line-height:1;color:inherit;background:rgba(127,127,127,.18);transition:background-color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-dt-bulk .fd-dt-act:hover{background:rgba(127,127,127,.3)}
.fd-dt-bulk .fd-dt-act:active{transform:scale(.96)}
.fd-dt-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes fd-dt-shine{to{background-position:-200% 0}}
@container (max-width:680px){
  .fd-dt-table{min-width:0}
  [data-nh]{display:none}
  .fd-dt-td,.fd-dt-th{padding:0 12px}
  .fd-dt-foot .fd-dt-pages{display:none}.fd-dt-pof{display:block}
  .fd-dt-bulk{bottom:72px;max-width:calc(100% - 24px);gap:8px;padding-left:12px}
  .fd-dt-bulk .fd-dt-act span{display:none}
}
@media (prefers-reduced-motion:reduce){
  .fd-dt *,.fd-dt *::before,.fd-dt *::after{transition-duration:1ms!important;animation:none!important}
  .fd-dt-bulk{transform:translate(-50%,0)}
}
@media (prefers-contrast:more){.fd-dt-card{box-shadow:0 0 0 1px currentColor}.fd-dt-td{border-bottom-color:var(--t-line2)}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

interface Txn {
  id: string;
  merchant: string;
  category: string;
  date: string;
  method: string;
  status: "settled" | "pending" | "failed" | "refunded";
  amount: number;
  hue: number;
}

const TXNS: Txn[] = [
  { id: "t01", merchant: "Brightline Air", category: "Travel", date: "2026-10-27", method: "Visa ·· 4417", status: "settled", amount: -1284.0, hue: 214 },
  { id: "t02", merchant: "Cascade Coffee Roasters", category: "Food & drink", date: "2026-10-27", method: "Apple Pay", status: "settled", amount: -18.5, hue: 28 },
  { id: "t03", merchant: "Northwind Payout", category: "Income", date: "2026-10-26", method: "ACH", status: "pending", amount: 14820.35, hue: 152 },
  { id: "t04", merchant: "Fernhill Veterinary", category: "Health", date: "2026-10-26", method: "Mastercard ·· 0932", status: "settled", amount: -246.0, hue: 340 },
  { id: "t05", merchant: "Orbit Cloud Hosting", category: "Software", date: "2026-10-25", method: "Visa ·· 4417", status: "settled", amount: -389.12, hue: 262 },
  { id: "t06", merchant: "Kestrel Logistics", category: "Shipping", date: "2026-10-25", method: "Wire", status: "failed", amount: -5600.0, hue: 190 },
  { id: "t07", merchant: "Marlow & Finch", category: "Food & drink", date: "2026-10-24", method: "Mastercard ·· 0932", status: "refunded", amount: 42.0, hue: 28 },
  { id: "t08", merchant: "Tallis Architects", category: "Services", date: "2026-10-24", method: "ACH", status: "settled", amount: 9250.0, hue: 100 },
  { id: "t09", merchant: "Sundial Fitness", category: "Health", date: "2026-10-23", method: "Visa ·· 4417", status: "settled", amount: -79.0, hue: 340 },
  { id: "t10", merchant: "Pinecrest Hardware", category: "Supplies", date: "2026-10-23", method: "Debit ·· 7781", status: "settled", amount: -134.76, hue: 60 },
  { id: "t11", merchant: "Lumen Design Co.", category: "Services", date: "2026-10-22", method: "ACH", status: "pending", amount: 3400.0, hue: 280 },
  { id: "t12", merchant: "Harbor Street Market", category: "Groceries", date: "2026-10-22", method: "Apple Pay", status: "settled", amount: -97.31, hue: 130 },
  { id: "t13", merchant: "Vantage Insurance", category: "Insurance", date: "2026-10-21", method: "ACH", status: "settled", amount: -612.0, hue: 232 },
  { id: "t14", merchant: "Quill & Anchor Books", category: "Retail", date: "2026-10-21", method: "Visa ·· 4417", status: "settled", amount: -52.4, hue: 8 },
  { id: "t15", merchant: "Meridian Energy", category: "Utilities", date: "2026-10-20", method: "ACH", status: "settled", amount: -218.9, hue: 48 },
  { id: "t16", merchant: "Alder Dental Group", category: "Health", date: "2026-10-20", method: "Mastercard ·· 0932", status: "pending", amount: -420.0, hue: 340 },
  { id: "t17", merchant: "Fieldnotes Press", category: "Income", date: "2026-10-19", method: "Stripe", status: "settled", amount: 2184.6, hue: 152 },
  { id: "t18", merchant: "Copperline Rail", category: "Travel", date: "2026-10-19", method: "Apple Pay", status: "settled", amount: -64.0, hue: 214 },
  { id: "t19", merchant: "Saffron & Salt", category: "Food & drink", date: "2026-10-18", method: "Visa ·· 4417", status: "failed", amount: -86.2, hue: 28 },
  { id: "t20", merchant: "Bluebird Childcare", category: "Services", date: "2026-10-18", method: "ACH", status: "settled", amount: -1450.0, hue: 200 },
  { id: "t21", merchant: "Tern Mobility", category: "Travel", date: "2026-10-17", method: "Apple Pay", status: "settled", amount: -12.75, hue: 214 },
  { id: "t22", merchant: "Greywater Studios", category: "Income", date: "2026-10-17", method: "Wire", status: "settled", amount: 6800.0, hue: 152 },
  { id: "t23", merchant: "Juniper Pharmacy", category: "Health", date: "2026-10-16", method: "Debit ·· 7781", status: "settled", amount: -31.18, hue: 340 },
  { id: "t24", merchant: "Obsidian Security", category: "Software", date: "2026-10-16", method: "Visa ·· 4417", status: "refunded", amount: 149.0, hue: 262 },
];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmtDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const STATUS_LABEL = { settled: "Settled", pending: "Pending", failed: "Failed", refunded: "Refunded" } as const;

const columns: DataTableColumn<Txn>[] = [
  {
    key: "merchant",
    header: "Merchant",
    sortValue: (r) => r.merchant,
    render: (r) => (
      <span className="fd-dtd-merch">
        <span className="fd-dtd-av" style={{ ["--h" as string]: r.hue }} aria-hidden="true">{r.merchant[0]}</span>
        <span className="fd-dtd-mt"><b>{r.merchant}</b><small className="fd-dtd-wd">{r.category}</small><small className="fd-dtd-nr fd-dtd-pill" data-s={r.status}>{STATUS_LABEL[r.status]} · {fmtDate(r.date)}</small></span>
      </span>
    ),
  },
  { key: "date", header: "Date", width: 112, narrowHide: true, sortValue: (r) => r.date, render: (r) => <span className="fd-dtd-mut">{fmtDate(r.date)}</span> },
  { key: "method", header: "Method", width: "20%", narrowHide: true, sortValue: (r) => r.method, render: (r) => <span className="fd-dtd-mut">{r.method}</span> },
  { key: "status", header: "Status", width: 132, narrowHide: true, sortValue: (r) => r.status, render: (r) => <span className="fd-dtd-pill" data-s={r.status}><i />{STATUS_LABEL[r.status]}</span> },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    numeric: true,
    width: 136,
    sortValue: (r) => r.amount,
    render: (r) => <span className="fd-dtd-amt" data-pos={r.amount > 0 ? "" : undefined}>{r.amount > 0 ? "+" : "−"}{usd.format(Math.abs(r.amount))}</span>,
  },
];

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState(TXNS);

  const data = useMemo(() => rows.filter((r) => (r.merchant + r.category + r.method).toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);
  const settled = rows.filter((r) => r.status === "settled");
  const net = settled.reduce((s, r) => s + r.amount, 0);
  const pending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);

  const reload = () => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1800);
  };

  return (
    <div className="fd-dtd" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-dtd-top">
        <div className="fd-dtd-brand"><span className="fd-dtd-logo" aria-hidden="true" />Cobalt Treasury</div>
        <nav aria-label="Primary" className="fd-dtd-nav"><a href="#overview">Overview</a><a href="#transactions" aria-current="page">Transactions</a><a href="#cards">Cards</a><a href="#payouts">Payouts</a></nav>
        <button type="button" className="fd-dtd-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      </header>
      <main className="fd-dtd-main">
        <div className="fd-dtd-head">
          <div><h1>Transactions</h1><p>Every payment in and out of Fernhill Studio LLC, October 2026.</p></div>
          <button type="button" className="fd-dtd-btn fd-dtd-primary" onClick={() => setNote("Export started — we’ll email a CSV to you shortly.")}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2.5v7.5M4.8 7L8 10.2 11.2 7M3 13h10" /></svg>Export CSV
          </button>
        </div>
        <dl className="fd-dtd-stats">
          <div><dt>Net settled</dt><dd>{usd.format(net)}</dd></div>
          <div><dt>Pending</dt><dd>{usd.format(pending)}</dd></div>
          <div><dt>Transactions</dt><dd>{rows.length}</dd></div>
        </dl>
        <div className="fd-dtd-bar">
          <label className="fd-dtd-search">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchant, category or method" aria-label="Search transactions" />
          </label>
          <button type="button" className="fd-dtd-btn" onClick={reload} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={loading ? "fd-dtd-spin" : undefined}><path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1M13.5 2.5v3h-3" /></svg>Refresh
          </button>
        </div>
        <DataTable<Txn>
          theme={theme}
          caption="Transactions"
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          loading={loading}
          pageSize={8}
          noun={["transaction", "transactions"]}
          initialSort={{ key: "date", dir: "desc" }}
          empty={
            <div className="fd-dt-emptybox">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="18" r="9" /><path d="M25 25l8 8" /></svg>
              <b>No transactions match “{q}”</b>
              <span>Try a merchant name, a category such as Travel, or a card ending.</span>
              <button type="button" className="fd-dtd-btn" style={{ marginTop: 12 }} onClick={() => setQ("")}>Clear search</button>
            </div>
          }
          bulkActions={({ ids, clear }) => (
            <>
              <button type="button" className="fd-dt-act" onClick={() => { setNote(`Categorised ${ids.length} transactions.`); clear(); }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1.5 7.5l5-5h5v5l-5 5z" /><circle cx="9.2" cy="4.8" r=".6" fill="currentColor" /></svg><span>Categorise</span>
              </button>
              <button type="button" className="fd-dt-act" onClick={() => { setNote(`Exported ${ids.length} transactions.`); }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 2v6.5M4.3 6L7 8.7 9.7 6M2.5 11.5h9" /></svg><span>Export</span>
              </button>
              <button type="button" className="fd-dt-act" onClick={() => { setRows((p) => p.filter((r) => !ids.includes(r.id))); setNote(`Archived ${ids.length} transactions.`); clear(); }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1.5" y="2.5" width="11" height="3" rx="1" /><path d="M2.5 5.5v5.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.5M5.5 8h3" /></svg><span>Archive</span>
              </button>
            </>
          )}
        />
        <p className="fd-dtd-note" role="status" aria-live="polite">{note}</p>
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-dtd,.fd-dtd *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-dtd,.fd-dtd *)::before,:where(.fd-dtd,.fd-dtd *)::after{box-sizing:border-box}
:where(.fd-dtd svg){display:block;flex-shrink:0}
:where(.fd-dtd button,.fd-dtd input){appearance:none;-webkit-appearance:none;outline:0;border-radius:0}
.fd-dtd{--fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --d-bg:#F6F6F8;--d-fg:#0B0B0F;--d-mut:#6B6B76;--d-line:rgba(11,11,15,.08);--d-card:#fff;--d-accent:#4F46E5;--d-on:#fff;--d-ring:rgba(79,70,229,.45);
  min-height:100vh;background:var(--d-bg);color:var(--d-fg);font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.006em;-webkit-font-smoothing:antialiased}
.fd-dtd[data-fd-theme="dark"]{--d-bg:#0A0A0D;--d-fg:#F2F2F5;--d-mut:#9A9AA6;--d-line:rgba(255,255,255,.08);--d-card:#101014;--d-accent:#818CF8;--d-on:#0B0B0F;--d-ring:rgba(129,140,248,.55)}
.fd-dtd-top{display:flex;align-items:center;gap:32px;height:56px;padding:0 clamp(16px,3vw,32px);background:var(--d-card);box-shadow:inset 0 -1px 0 var(--d-line)}
.fd-dtd-brand{display:flex;align-items:center;gap:10px;font-weight:600;font-size:15px;letter-spacing:-.02em}
.fd-dtd-logo{width:20px;height:20px;border-radius:6px;background:conic-gradient(from 210deg,var(--d-accent),#38BDF8,var(--d-accent))}
.fd-dtd-nav{display:flex;gap:4px;margin-right:auto}
.fd-dtd-nav a{padding:6px 12px;border-radius:8px;font-weight:500;color:var(--d-mut);transition:background-color 120ms,color 120ms}
.fd-dtd-nav a:hover{color:var(--d-fg);background:var(--d-line)}.fd-dtd-nav a[aria-current]{color:var(--d-fg);background:var(--d-line)}
.fd-dtd a:focus-visible,.fd-dtd-theme:focus-visible,.fd-dtd-btn:focus-visible{outline:2px solid var(--d-ring);outline-offset:2px}
.fd-dtd-theme{cursor:pointer;height:32px;padding:0 12px;border-radius:8px;box-shadow:inset 0 0 0 1px var(--d-line);font-size:13px;font-weight:500;color:var(--d-mut);margin-left:auto}.fd-dtd-theme:hover{color:var(--d-fg)}
.fd-dtd-main{max-width:1080px;margin:0 auto;padding:32px clamp(16px,3vw,32px) 56px}
.fd-dtd-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.fd-dtd-head h1{font-size:24px;line-height:32px;font-weight:600;letter-spacing:-.025em}
.fd-dtd-head p{margin-top:4px;color:var(--d-mut)}
.fd-dtd-btn{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:10px;cursor:pointer;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line),0 1px 2px rgba(11,11,15,.05);font-size:13px;font-weight:500;line-height:1;transition:transform 240ms var(--fd-spring),box-shadow 120ms}
.fd-dtd-btn:active{transform:scale(.97)}.fd-dtd-btn:disabled{opacity:.6;cursor:default}
@media (hover:hover){.fd-dtd-btn:hover:not(:disabled){box-shadow:0 0 0 1px rgba(11,11,15,.2),0 1px 2px rgba(11,11,15,.06)}}
.fd-dtd-primary{background:var(--d-fg);color:var(--d-bg);box-shadow:0 1px 2px rgba(11,11,15,.2)}
.fd-dtd-spin{animation:fd-dtd-rot .8s linear infinite}
@keyframes fd-dtd-rot{to{transform:rotate(360deg)}}
.fd-dtd-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}
.fd-dtd-stats>div{padding:16px 20px;border-radius:14px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line)}
.fd-dtd-stats dt{font-size:12px;line-height:16px;color:var(--d-mut);font-weight:500}
.fd-dtd-stats dd{margin-top:6px;font-size:22px;line-height:28px;font-weight:600;letter-spacing:-.025em;font-variant-numeric:tabular-nums}
.fd-dtd-bar{display:flex;gap:8px;margin-bottom:12px}
.fd-dtd-search{position:relative;flex:1;max-width:380px;display:block}
.fd-dtd-search svg{position:absolute;left:12px;top:10px;color:var(--d-mut);pointer-events:none}
.fd-dtd-search input{width:100%;height:36px;padding:0 12px 0 36px;border-radius:10px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line);font-size:14px;color:var(--d-fg);transition:box-shadow 120ms}
.fd-dtd-search input::placeholder{color:var(--d-mut)}
.fd-dtd-search input:focus-visible{box-shadow:0 0 0 1.5px var(--d-accent),0 0 0 4px var(--d-ring)}
.fd-dtd-merch{display:flex;align-items:center;gap:12px;min-width:0}
.fd-dtd-av{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:10px;font-size:13px;font-weight:600;color:hsl(var(--h) 55% 32%);background:hsl(var(--h) 80% 93%);box-shadow:inset 0 0 0 1px hsl(var(--h) 60% 50% / .15)}
.fd-dtd[data-fd-theme="dark"] .fd-dtd-av{color:hsl(var(--h) 85% 80%);background:hsl(var(--h) 40% 20%)}
.fd-dtd-mt{display:flex;flex-direction:column;min-width:0}
.fd-dtd-mt b{font-weight:500;overflow:hidden;text-overflow:ellipsis}
.fd-dtd-mt small{font-size:12px;line-height:16px;color:var(--d-mut)}
.fd-dtd-mut{color:var(--d-mut)}
.fd-dtd-amt{font-weight:500;font-variant-numeric:tabular-nums}.fd-dtd-amt[data-pos]{color:#15803D}
.fd-dtd[data-fd-theme="dark"] .fd-dtd-amt[data-pos]{color:#4ADE80}
.fd-dtd-pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px 0 8px;border-radius:9999px;font-size:12px;font-weight:500;line-height:1;--c:#15803D;color:var(--c);background:color-mix(in srgb,var(--c) 11%,transparent)}
.fd-dtd-pill i{width:6px;height:6px;border-radius:50%;background:currentColor}
.fd-dtd-pill[data-s="pending"]{--c:#B45309}.fd-dtd-pill[data-s="failed"]{--c:#C2271B}.fd-dtd-pill[data-s="refunded"]{--c:#52525B}
.fd-dtd[data-fd-theme="dark"] .fd-dtd-pill{--c:#4ADE80}.fd-dtd[data-fd-theme="dark"] .fd-dtd-pill[data-s="pending"]{--c:#FBBF24}.fd-dtd[data-fd-theme="dark"] .fd-dtd-pill[data-s="failed"]{--c:#FF8A7A}.fd-dtd[data-fd-theme="dark"] .fd-dtd-pill[data-s="refunded"]{--c:#A1A1AA}
.fd-dtd-nr{display:none}
@container (max-width:680px){.fd-dtd-wd{display:none}.fd-dtd-mt small.fd-dtd-nr{display:block;height:auto;padding:0;background:none;font-size:12px;line-height:16px;font-weight:400}}
.fd-dtd-note{min-height:20px;margin-top:12px;font-size:13px;color:var(--d-mut)}
@media (max-width:640px){.fd-dtd-nav{display:none}.fd-dtd-stats{grid-template-columns:1fr 1fr}.fd-dtd-stats>div:last-child{display:none}.fd-dtd-bar{flex-wrap:wrap}.fd-dtd-search{max-width:none;flex-basis:100%}.fd-dtd-top{gap:12px}}
`;
