/**
 * ExpandableTable — a table whose rows expand to reveal a detail panel. The
 * panel opens with a smooth, measured-free height animation using the
 * grid-template-rows 0fr → 1fr technique, so content of any height works.
 *
 * Props: data, columns, getRowId, renderDetail(row), caption, single (only
 * one row open at a time), expanded / onExpandedChange (controlled) or
 * defaultExpanded, theme.
 * Column: { key, header, align?, width?, render?, narrowHide? }
 *
 * Browser support: grid-template-rows interpolation needs Chrome 107, Safari
 * 16, Firefox 66; older browsers snap open without the animation.
 * Accessibility: every row has a disclosure button (aria-expanded,
 * aria-controls) in the first cell; the collapsed panel is visibility:hidden
 * so nothing inside it is focusable or announced; Enter / Space on the button
 * toggle; the whole row is also clickable for pointer users (ignored when the
 * click lands on an interactive child). Panels are role="region" labelled by
 * the row's disclosure button.
 * Reduced motion: the panel appears instantly.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface ExpandableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: number | string;
  render?: (row: T) => ReactNode;
  narrowHide?: boolean;
}

export interface ExpandableTableProps<T> {
  data: T[];
  columns: ExpandableColumn<T>[];
  getRowId: (row: T) => string;
  renderDetail: (row: T) => ReactNode;
  caption: string;
  single?: boolean;
  defaultExpanded?: string[];
  expanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Accessible label for the disclosure button of a row. */
  rowLabel?: (row: T) => string;
  theme?: "light" | "dark";
  className?: string;
}

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
export function ExpandableTable<T>({
  data,
  columns,
  getRowId,
  renderDetail,
  caption,
  single = false,
  defaultExpanded = [],
  expanded,
  onExpandedChange,
  rowLabel,
  theme,
  className,
}: ExpandableTableProps<T>) {
  const uid = useId();
  const [cardRef, narrow] = useNarrow(720);
  const cols = narrow ? columns.filter((c) => !c.narrowHide) : columns;
  const [inner, setInner] = useState<string[]>(defaultExpanded);
  const open = expanded ?? inner;
  const set = (next: string[]) => {
    if (expanded === undefined) setInner(next);
    onExpandedChange?.(next);
  };
  const toggle = (id: string) => {
    const on = open.includes(id);
    set(on ? open.filter((x) => x !== id) : single ? [id] : [...open, id]);
  };

  return (
    <div className={`fd-et${className ? " " + className : ""}`} data-fd-theme={theme}>
      <style>{css}</style>
      <div className="fd-et-card" ref={cardRef}>
        <div className="fd-et-scroll" role="region" aria-label={`${caption}, scrollable`} tabIndex={0}>
          <table className="fd-et-table">
            <caption className="fd-et-sr">{caption}</caption>
            <thead>
              <tr>
                <th scope="col" className="fd-et-th" style={{ width: 52 }}><span className="fd-et-sr">Expand</span></th>
                {cols.map((c) => (
                  <th key={c.key} scope="col" className="fd-et-th" data-align={c.align ?? "left"} data-nh={c.narrowHide ? "" : undefined} style={c.width ? { width: c.width } : undefined}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            {data.map((r, i) => {
              const id = getRowId(r);
              const on = open.includes(id);
              const btn = `${uid}-b${i}`;
              const panel = `${uid}-p${i}`;
              return (
                <tbody key={id} className="fd-et-group" data-open={on ? "" : undefined}>
                  <tr
                    className="fd-et-row"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button,a,input,select,textarea,[role=button]")) return;
                      toggle(id);
                    }}
                  >
                    <td className="fd-et-td fd-et-lead">
                      <button type="button" id={btn} className="fd-et-chev" aria-expanded={on} aria-controls={panel} aria-label={rowLabel ? rowLabel(r) : `Toggle details for row ${i + 1}`} onClick={() => toggle(id)}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
                      </button>
                    </td>
                    {cols.map((c) => (
                      <td key={c.key} className="fd-et-td" data-align={c.align ?? "left"} data-nh={c.narrowHide ? "" : undefined}>
                        {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                  <tr className="fd-et-drow">
                    <td className="fd-et-dtd" colSpan={cols.length + 1}>
                      <div className="fd-et-collapse" id={panel} role="region" aria-labelledby={btn}>
                        <div className="fd-et-clip">
                          <div className="fd-et-detail">{renderDetail(r)}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              );
            })}
          </table>
        </div>
      </div>
    </div>
  );
}

const css = `
:where(.fd-et,.fd-et *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-et,.fd-et *)::before,:where(.fd-et,.fd-et *)::after{box-sizing:border-box}
:where(.fd-et svg){display:block;flex-shrink:0}
:where(.fd-et button){appearance:none;-webkit-appearance:none;outline:0;border-radius:0;cursor:pointer}
:where(.fd-et table){border-collapse:separate;border-spacing:0}
.fd-et{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --e-bg:#fff;--e-head:#F8F9FB;--e-fg:#0F172A;--e-mut:#64748B;--e-line:rgba(15,23,42,.08);--e-line2:rgba(15,23,42,.16);--e-hover:rgba(15,23,42,.028);--e-open:#F8FAFC;--e-accent:#2563EB;--e-ring:rgba(37,99,235,.5);
  width:100%;font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.006em;color:var(--e-fg);-webkit-font-smoothing:antialiased}
[data-fd-theme="dark"].fd-et,[data-fd-theme="dark"] .fd-et{--e-bg:#0F1218;--e-head:#131720;--e-fg:#E8ECF4;--e-mut:#8A94A8;--e-line:rgba(255,255,255,.07);--e-line2:rgba(255,255,255,.15);--e-hover:rgba(255,255,255,.03);--e-open:#131720;--e-accent:#60A5FA;--e-ring:rgba(96,165,250,.55)}
.fd-et-card{container-type:inline-size;border-radius:16px;background:var(--e-bg);overflow:hidden;box-shadow:0 0 0 1px var(--e-line),0 1px 2px rgba(15,23,42,.04),0 12px 32px -16px rgba(15,23,42,.14)}
.fd-et-scroll{overflow-x:auto}.fd-et-scroll:focus-visible{outline:2px solid var(--e-ring);outline-offset:-2px}
.fd-et-table{width:100%;table-layout:fixed;min-width:560px}
.fd-et-th{height:40px;padding:0 16px;background:var(--e-head);font-size:12px;line-height:16px;font-weight:500;color:var(--e-mut);text-align:left;white-space:nowrap;box-shadow:inset 0 -1px 0 var(--e-line)}
.fd-et-th[data-align="right"],.fd-et-td[data-align="right"]{text-align:right}
.fd-et-th:first-child,.fd-et-lead{padding-left:12px;padding-right:0}
.fd-et-td{height:64px;padding:0 16px;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:inset 0 -1px 0 var(--e-line);transition:background-color var(--fd-dur-1),box-shadow var(--fd-dur-3) var(--fd-ease-out)}
.fd-et-group:last-child .fd-et-td,.fd-et-group:last-child .fd-et-dtd{box-shadow:none}
.fd-et-row{cursor:pointer}
@media (hover:hover){.fd-et-row:hover .fd-et-td{background:var(--e-hover)}}
.fd-et-group[data-open] .fd-et-td{background:var(--e-open);box-shadow:none}
.fd-et-chev{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;color:var(--e-mut);transition:background-color var(--fd-dur-1),color var(--fd-dur-1),transform var(--fd-dur-3) var(--fd-spring)}
.fd-et-chev svg{transition:transform var(--fd-dur-3) var(--fd-spring)}
.fd-et-chev:hover{background:var(--e-line);color:var(--e-fg)}
.fd-et-chev:active{transform:scale(.9)}
.fd-et-chev[aria-expanded=true]{color:var(--e-fg)}.fd-et-chev[aria-expanded=true] svg{transform:rotate(90deg)}
.fd-et-chev:focus-visible{box-shadow:0 0 0 2px var(--e-bg),0 0 0 4px var(--e-ring)}
.fd-et-dtd{padding:0;background:var(--e-open);box-shadow:inset 0 -1px 0 var(--e-line);border:0;transition:box-shadow var(--fd-dur-3)}
.fd-et-collapse{display:grid;grid-template-rows:0fr;visibility:hidden;transition:grid-template-rows var(--fd-dur-3) var(--fd-ease-out),visibility 0s linear var(--fd-dur-3)}
.fd-et-group[data-open] .fd-et-collapse{grid-template-rows:1fr;visibility:visible;transition-delay:0s}
.fd-et-clip{min-height:0;overflow:hidden}
.fd-et-detail{padding:4px 24px 24px 64px;opacity:0;transform:translateY(-6px);transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-ease-out)}
.fd-et-group[data-open] .fd-et-detail{opacity:1;transform:none;transition-delay:80ms}
.fd-et-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@container (max-width:720px){[data-nh]{display:none}.fd-et-table{min-width:0}.fd-et-th,.fd-et-td{padding:0 12px}.fd-et-th:first-child,.fd-et-lead{padding-left:8px;padding-right:0}.fd-et-detail{padding:4px 16px 20px}}
@media (prefers-reduced-motion:reduce){.fd-et *{transition-duration:1ms!important;transition-delay:0s!important}.fd-et-detail{transform:none}}
@media (prefers-contrast:more){.fd-et-card{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

interface Stop { place: string; event: string; when: string; state: "done" | "now" | "next"; note?: string }
interface Shipment {
  id: string;
  ref: string;
  from: string;
  to: string;
  carrier: string;
  mode: "Ocean" | "Air" | "Road" | "Rail";
  eta: string;
  status: "In transit" | "Delayed" | "Delivered" | "Customs hold";
  progress: number;
  weight: string;
  cargo: string;
  stops: Stop[];
}

const SHIPMENTS: Shipment[] = [
  {
    id: "s1", ref: "HX-48210", from: "Shenzhen, CN", to: "Rotterdam, NL", carrier: "Maersk Line", mode: "Ocean", eta: "Nov 14", status: "In transit", progress: 62, weight: "18,400 kg", cargo: "2 × 40′ HC · LED lighting",
    stops: [
      { place: "Yantian Port, Shenzhen", event: "Departed", when: "Oct 12 · 06:40", state: "done" },
      { place: "Singapore Strait", event: "Transshipment complete", when: "Oct 19 · 22:15", state: "done" },
      { place: "Suez Canal", event: "Transiting — 14 knots", when: "Oct 29 · now", state: "now", note: "On schedule, 2 days ahead of last vessel" },
      { place: "Port of Rotterdam", event: "Arrival, berth 4", when: "Nov 14 · est.", state: "next" },
    ],
  },
  {
    id: "s2", ref: "HX-48377", from: "Chicago, US", to: "Monterrey, MX", carrier: "Union Pacific", mode: "Rail", eta: "Nov 03", status: "Customs hold", progress: 78, weight: "9,250 kg", cargo: "1 × 53′ · Auto parts",
    stops: [
      { place: "Chicago Intermodal", event: "Loaded", when: "Oct 24 · 14:00", state: "done" },
      { place: "San Antonio Yard", event: "Interchange", when: "Oct 27 · 03:30", state: "done" },
      { place: "Laredo Border", event: "Held — missing pedimento", when: "Oct 29 · 08:12", state: "now", note: "Broker notified. Document due by 17:00 CT." },
      { place: "Monterrey Terminal", event: "Delivery", when: "Nov 03 · est.", state: "next" },
    ],
  },
  {
    id: "s3", ref: "HX-48402", from: "Frankfurt, DE", to: "Singapore, SG", carrier: "Lufthansa Cargo", mode: "Air", eta: "Oct 31", status: "In transit", progress: 41, weight: "640 kg", cargo: "6 pallets · Lab equipment",
    stops: [
      { place: "Frankfurt FRA", event: "Departed", when: "Oct 29 · 01:55", state: "done" },
      { place: "In flight · LH 8160", event: "Over the Caspian Sea", when: "Oct 29 · now", state: "now" },
      { place: "Singapore SIN", event: "Landing", when: "Oct 29 · 22:10 est.", state: "next" },
      { place: "Consignee dock", event: "Delivery", when: "Oct 31 · est.", state: "next" },
    ],
  },
  {
    id: "s4", ref: "HX-47990", from: "Lagos, NG", to: "Accra, GH", carrier: "Trans-West Haulage", mode: "Road", eta: "Oct 30", status: "Delayed", progress: 55, weight: "12,100 kg", cargo: "Pharma · cold chain 2–8°C",
    stops: [
      { place: "Apapa Depot, Lagos", event: "Departed", when: "Oct 27 · 05:00", state: "done" },
      { place: "Seme–Krake Border", event: "Cleared, 9 h queue", when: "Oct 28 · 21:40", state: "done" },
      { place: "Aflao, Ghana", event: "Stopped — road closure", when: "Oct 29 · now", state: "now", note: "Re-routing via Ho. +6 h. Reefer holding 4.1°C." },
      { place: "Tema Warehouse, Accra", event: "Delivery", when: "Oct 30 · est.", state: "next" },
    ],
  },
  {
    id: "s5", ref: "HX-47612", from: "Santos, BR", to: "Hamburg, DE", carrier: "Hapag-Lloyd", mode: "Ocean", eta: "Oct 22", status: "Delivered", progress: 100, weight: "21,000 kg", cargo: "1 × 40′ · Green coffee, 320 bags",
    stops: [
      { place: "Port of Santos", event: "Departed", when: "Sep 28 · 11:20", state: "done" },
      { place: "Algeciras", event: "Bunkering stop", when: "Oct 14 · 04:00", state: "done" },
      { place: "Port of Hamburg", event: "Delivered, signed K. Brandt", when: "Oct 22 · 09:45", state: "done" },
    ],
  },
];

const MODE_ICON: Record<Shipment["mode"], string> = {
  Ocean: "M2 12c2 0 2-1.5 4-1.5S8 12 10 12s2-1.5 4-1.5M3.5 9.5L4 5h8l.5 4.5M8 5V2.5",
  Air: "M2 9l12-5-3 9-3-3-2 3v-3z",
  Road: "M1.5 11.5h1M12.5 11.5h2V8l-2-3h-3v6.5M1.5 4.5h8v7M4.5 13a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4zM11 13a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z",
  Rail: "M4 2.5h8a1 1 0 011 1V10a2 2 0 01-2 2H5a2 2 0 01-2-2V3.5a1 1 0 011-1zM3 7h10M5 14l1.5-2M11 14l-1.5-2",
};

const columns: ExpandableColumn<Shipment>[] = [
  { key: "ref", header: "Shipment", render: (r) => (<span className="fd-etd-refc"><span className="fd-etd-ref">{r.ref}</span><small className="fd-etd-nr">{r.from.split(",")[0]} → {r.to.split(",")[0]}</small></span>) },
  {
    key: "route",
    header: "Route",
    narrowHide: true,
    render: (r) => (
      <span className="fd-etd-route">
        <span>{r.from}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 7h10M8.5 3.5L12 7l-3.5 3.5" /></svg>
        <span>{r.to}</span>
      </span>
    ),
  },
  {
    key: "mode",
    header: "Carrier",
    width: 200,
    narrowHide: true,
    render: (r) => (
      <span className="fd-etd-car">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={MODE_ICON[r.mode]} /></svg>
        {r.carrier}
      </span>
    ),
  },
  { key: "eta", header: "ETA", width: 84, align: "right", narrowHide: true, render: (r) => <span className="fd-etd-eta">{r.eta}</span> },
  { key: "status", header: "Status", width: 148, render: (r) => <span className="fd-etd-pill" data-s={r.status.replace(" ", "-").toLowerCase()}><i />{r.status}</span> },
];

function Timeline({ s }: { s: Shipment }) {
  return (
    <ol className="fd-etd-tl" aria-label={`Route for ${s.ref}`}>
      {s.stops.map((st, i) => (
        <li key={i} className="fd-etd-stop" data-state={st.state} data-last={i === s.stops.length - 1 ? "" : undefined} data-held={st.state === "now" && (s.status === "Customs hold" || s.status === "Delayed") ? "" : undefined}>
          <span className="fd-etd-node" aria-hidden="true">
            {st.state === "done" && <svg aria-hidden="true" focusable="false" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5.3l2.1 2.1L8 3" /></svg>}
          </span>
          <span className="fd-etd-stxt">
            <b>{st.place}</b>
            <span>{st.event}</span>
            {st.note && <em>{st.note}</em>}
          </span>
          <time className="fd-etd-when">{st.when}</time>
          <span className="fd-etd-sr">{st.state === "done" ? "Completed" : st.state === "now" ? "Current" : "Upcoming"}</span>
        </li>
      ))}
    </ol>
  );
}

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [open, setOpen] = useState<string[]>(["s2"]);
  const [single, setSingle] = useState(false);
  const all = open.length === SHIPMENTS.length;

  return (
    <div className="fd-etd" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-etd-top">
        <span className="fd-etd-brand"><span className="fd-etd-logo" aria-hidden="true">H</span>Haulix <small>Control Tower</small></span>
        <button type="button" className="fd-etd-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      </header>
      <main className="fd-etd-main">
        <div className="fd-etd-head">
          <div>
            <h1>Active shipments</h1>
            <p>{SHIPMENTS.filter((s) => s.status !== "Delivered").length} in motion · {SHIPMENTS.filter((s) => s.status === "Delayed" || s.status === "Customs hold").length} need attention</p>
          </div>
          <div className="fd-etd-ctl">
            <label className="fd-etd-chk">
              <input type="checkbox" checked={single} onChange={(e) => { setSingle(e.target.checked); if (e.target.checked) setOpen((o) => o.slice(0, 1)); }} />
              <span>One at a time</span>
            </label>
            <button type="button" className="fd-etd-btn" onClick={() => setOpen(all ? [] : SHIPMENTS.map((s) => s.id))} disabled={single}>{all ? "Collapse all" : "Expand all"}</button>
          </div>
        </div>
        <ExpandableTable<Shipment>
          theme={theme}
          caption="Active shipments"
          data={SHIPMENTS}
          columns={columns}
          getRowId={(r) => r.id}
          single={single}
          expanded={open}
          onExpandedChange={setOpen}
          rowLabel={(r) => `Route details for ${r.ref}, ${r.from} to ${r.to}`}
          renderDetail={(s) => (
            <div className="fd-etd-panel">
              <div className="fd-etd-pl">
                <h2>Route</h2>
                <Timeline s={s} />
              </div>
              <dl className="fd-etd-facts">
                <div><dt>Cargo</dt><dd>{s.cargo}</dd></div>
                <div><dt>Weight</dt><dd>{s.weight}</dd></div>
                <div><dt>Mode</dt><dd>{s.mode} freight · {s.carrier}</dd></div>
                <div><dt>Progress</dt><dd><span className="fd-etd-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.progress} aria-label="Journey progress"><i style={{ width: `${s.progress}%` }} /></span><span className="fd-etd-pct">{s.progress}%</span></dd></div>
                <div className="fd-etd-acts"><button type="button" className="fd-etd-btn">Share tracking</button><button type="button" className="fd-etd-btn fd-etd-solid">Contact carrier</button></div>
              </dl>
            </div>
          )}
        />
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-etd,.fd-etd *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-etd,.fd-etd *)::before,:where(.fd-etd,.fd-etd *)::after{box-sizing:border-box}
:where(.fd-etd svg){display:block;flex-shrink:0}
:where(.fd-etd button,.fd-etd input){appearance:none;-webkit-appearance:none;outline:0;border-radius:0}
:where(.fd-etd button){cursor:pointer}
.fd-etd{--fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --d-bg:#F1F4F8;--d-fg:#0F172A;--d-mut:#64748B;--d-line:rgba(15,23,42,.09);--d-card:#fff;--d-accent:#2563EB;--d-ring:rgba(37,99,235,.5);
  min-height:100vh;background:var(--d-bg);color:var(--d-fg);font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.006em;-webkit-font-smoothing:antialiased}
.fd-etd[data-fd-theme="dark"]{--d-bg:#0A0D12;--d-fg:#E8ECF4;--d-mut:#8A94A8;--d-line:rgba(255,255,255,.08);--d-card:#0F1218;--d-accent:#60A5FA;--d-ring:rgba(96,165,250,.55)}
.fd-etd-top{display:flex;align-items:center;justify-content:space-between;height:56px;padding:0 clamp(16px,3vw,32px);background:var(--d-card);box-shadow:inset 0 -1px 0 var(--d-line)}
.fd-etd-brand{display:flex;align-items:center;gap:10px;font-weight:600;font-size:15px;letter-spacing:-.02em}.fd-etd-brand small{font-weight:400;font-size:13px;color:var(--d-mut);margin-left:2px}
.fd-etd-logo{display:grid;place-items:center;width:24px;height:24px;border-radius:7px;background:var(--d-accent);color:var(--d-card);font-size:13px;font-weight:700}
.fd-etd-theme{height:32px;padding:0 12px;border-radius:8px;font-size:13px;font-weight:500;color:var(--d-mut);box-shadow:inset 0 0 0 1px var(--d-line)}.fd-etd-theme:hover{color:var(--d-fg)}
.fd-etd-theme:focus-visible,.fd-etd-btn:focus-visible{outline:2px solid var(--d-ring);outline-offset:2px}
.fd-etd-main{max-width:1080px;margin:0 auto;padding:32px clamp(16px,3vw,32px) 64px}
.fd-etd-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.fd-etd-head h1{font-size:24px;line-height:32px;font-weight:600;letter-spacing:-.025em}.fd-etd-head p{margin-top:2px;color:var(--d-mut)}
.fd-etd-ctl{display:flex;align-items:center;gap:16px}
.fd-etd-chk{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:500;color:var(--d-mut)}
.fd-etd-chk input{position:relative;width:32px;height:20px;border-radius:9999px;background:var(--d-line);cursor:pointer;transition:background-color 240ms var(--fd-ease-out)}
.fd-etd-chk input::after{content:"";position:absolute;left:2px;top:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform 420ms var(--fd-spring)}
.fd-etd-chk input:checked{background:var(--d-accent)}.fd-etd-chk input:checked::after{transform:translateX(12px)}
.fd-etd-chk input:focus-visible{outline:2px solid var(--d-ring);outline-offset:2px}
.fd-etd-btn{display:inline-flex;align-items:center;height:32px;padding:0 12px;border-radius:9px;font-size:13px;font-weight:500;line-height:1;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line),0 1px 2px rgba(15,23,42,.05);transition:transform 240ms var(--fd-spring)}
.fd-etd-btn:active:not(:disabled){transform:scale(.96)}.fd-etd-btn:disabled{opacity:.5;cursor:default}
.fd-etd-solid{background:var(--d-fg);color:var(--d-card);box-shadow:none}
.fd-etd-ref{font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.fd-etd-refc{display:flex;flex-direction:column;min-width:0}.fd-etd-nr{display:none;font-size:12px;line-height:16px;color:var(--d-mut);overflow:hidden;text-overflow:ellipsis}
@container (max-width:720px){.fd-etd-nr{display:block}}
.fd-etd-route{display:inline-flex;align-items:center;gap:8px}.fd-etd-route svg{color:var(--d-mut)}
.fd-etd-car{display:inline-flex;align-items:center;gap:8px;color:var(--d-mut)}
.fd-etd-eta{font-variant-numeric:tabular-nums;color:var(--d-mut)}
.fd-etd-pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px 0 8px;border-radius:9999px;font-size:12px;font-weight:500;line-height:1;--c:#1D4ED8;color:var(--c);background:color-mix(in srgb,var(--c) 10%,transparent)}
.fd-etd-pill i{width:6px;height:6px;border-radius:50%;background:currentColor}
.fd-etd-pill[data-s="delayed"]{--c:#B45309}.fd-etd-pill[data-s="customs-hold"]{--c:#C2271B}.fd-etd-pill[data-s="delivered"]{--c:#15803D}
.fd-etd[data-fd-theme="dark"] .fd-etd-pill{--c:#93C5FD}.fd-etd[data-fd-theme="dark"] .fd-etd-pill[data-s="delayed"]{--c:#FBBF24}.fd-etd[data-fd-theme="dark"] .fd-etd-pill[data-s="customs-hold"]{--c:#FF8A7A}.fd-etd[data-fd-theme="dark"] .fd-etd-pill[data-s="delivered"]{--c:#4ADE80}
.fd-etd-panel{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:32px;padding-top:12px}
.fd-etd-pl h2,.fd-etd-facts dt{font-size:12px;line-height:16px;font-weight:500;color:var(--d-mut)}
.fd-etd-pl h2{margin-bottom:14px}
.fd-etd-tl{display:flex;flex-direction:column}
.fd-etd-stop{position:relative;display:grid;grid-template-columns:20px minmax(0,1fr) auto;column-gap:14px;padding-bottom:20px}
.fd-etd-stop[data-last]{padding-bottom:0}
.fd-etd-stop::before{content:"";position:absolute;left:9px;top:20px;bottom:0;width:2px;border-radius:2px;background:repeating-linear-gradient(to bottom,var(--d-line) 0 4px,transparent 4px 8px)}
.fd-etd-stop[data-state="done"]::before{background:var(--d-accent);opacity:.55}
.fd-etd-stop[data-last]::before{display:none}
.fd-etd-node{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--d-card);box-shadow:inset 0 0 0 2px var(--d-line);color:var(--d-card)}
.fd-etd-stop[data-state="done"] .fd-etd-node{background:var(--d-accent);box-shadow:none}
.fd-etd-stop[data-state="now"] .fd-etd-node{box-shadow:inset 0 0 0 2px var(--d-accent),0 0 0 4px color-mix(in srgb,var(--d-accent) 18%,transparent);animation:fd-etd-pulse 2s var(--fd-ease-out) infinite}
.fd-etd-stop[data-held] .fd-etd-node{box-shadow:inset 0 0 0 2px #D97706,0 0 0 4px rgba(217,119,6,.18);animation-name:fd-etd-pulse-w}
.fd-etd-stxt{display:flex;flex-direction:column;min-width:0}
.fd-etd-stxt b{font-weight:500}
.fd-etd-stxt span{font-size:13px;line-height:18px;color:var(--d-mut)}
.fd-etd-stxt em{display:block;margin-top:4px;font-style:normal;font-size:12px;line-height:16px;padding:6px 10px;border-radius:8px;background:var(--d-line);color:var(--d-fg)}
.fd-etd-stop[data-state="next"] .fd-etd-stxt b{color:var(--d-mut)}
.fd-etd-when{font-size:12px;line-height:20px;color:var(--d-mut);font-variant-numeric:tabular-nums;white-space:nowrap}
.fd-etd-facts{display:flex;flex-direction:column;gap:14px;padding:16px 18px;border-radius:14px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line);align-self:start}
.fd-etd-facts dd{margin-top:2px;font-weight:500}
.fd-etd-facts dd:has(.fd-etd-bar){display:flex;align-items:center;gap:10px}
.fd-etd-bar{flex:1;height:6px;border-radius:9999px;background:var(--d-line);overflow:hidden}.fd-etd-bar i{display:block;height:100%;border-radius:inherit;background:var(--d-accent)}
.fd-etd-pct{font-variant-numeric:tabular-nums;font-size:13px}
.fd-etd-acts{display:flex;gap:8px;padding-top:2px}
.fd-etd-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes fd-etd-pulse{50%{box-shadow:inset 0 0 0 2px var(--d-accent),0 0 0 7px color-mix(in srgb,var(--d-accent) 0%,transparent)}}
@keyframes fd-etd-pulse-w{50%{box-shadow:inset 0 0 0 2px #D97706,0 0 0 7px rgba(217,119,6,0)}}
@media (max-width:720px){.fd-etd-panel{grid-template-columns:1fr;gap:20px}.fd-etd-brand small{display:none}.fd-etd-when{grid-column:2;line-height:16px}.fd-etd-stop{grid-template-columns:20px minmax(0,1fr)}.fd-etd-stxt{grid-column:2}}
@media (prefers-reduced-motion:reduce){.fd-etd *{animation:none!important;transition-duration:1ms!important}}
`;
