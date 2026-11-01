/**
 * SearchCommand — a ⌘K command palette: fuzzy filtering with highlighted
 * matches, grouped sections, recent items, full keyboard navigation and a
 * footer with key hints.
 *
 * Props: open, onOpenChange, sections[] ({ id, heading, items[] }), recent
 * (item ids shown first when the query is empty), onSelect(item),
 * placeholder, hotkey (default true: ⌘K / Ctrl+K toggles), theme.
 * Item = { id, label, hint?, icon?, keywords?, shortcut? }.
 * Exports: SearchCommand, fuzzyScore.
 *
 * Render it near the root of your app: it is position: fixed and does not use
 * a portal (so it works without a DOM target and in SSR).
 * Browser support: all evergreen browsers.
 * Accessibility: role="dialog" aria-modal, the input is a combobox
 * (aria-expanded, aria-controls, aria-activedescendant) over a role="listbox";
 * focus is trapped, Escape closes and returns focus to the opener, results
 * count is announced politely. Keys: ↑/↓, Home/End, Enter, Esc, ⌘K.
 * Reduced motion: opens with a fade only.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  keywords?: string;
  shortcut?: string;
}
export interface CommandSection {
  id: string;
  heading: string;
  items: CommandItem[];
}

/** Subsequence fuzzy score with bonuses for word starts and runs. Returns null when it does not match. */
export function fuzzyScore(query: string, text: string): { score: number; idx: number[] } | null {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const t = text.toLowerCase();
  if (!q) return { score: 0, idx: [] };
  // exact substring wins
  const sub = t.indexOf(query.toLowerCase().trim());
  if (sub >= 0) return { score: 100 - sub + query.length, idx: Array.from({ length: query.trim().length }, (_, i) => sub + i) };
  let ti = 0;
  let score = 0;
  let run = 0;
  const idx: number[] = [];
  for (const ch of q) {
    const f = t.indexOf(ch, ti);
    if (f < 0) return null;
    const start = f === 0 || /[\s\-_/.#]/.test(t[f - 1]);
    run = f === ti && idx.length ? run + 1 : 0;
    score += 1 + (start ? 6 : 0) + run * 3 - Math.min(f - ti, 6) * 0.2;
    idx.push(f);
    ti = f + 1;
  }
  return { score, idx };
}

function Hl({ text, idx }: { text: string; idx: number[] }) {
  if (!idx.length) return <>{text}</>;
  const set = new Set(idx);
  const out: ReactNode[] = [];
  let buf = "";
  let on = false;
  for (let i = 0; i < text.length; i++) {
    const m = set.has(i);
    if (m !== on && buf) {
      out.push(on ? <mark key={i}>{buf}</mark> : buf);
      buf = "";
    }
    on = m;
    buf += text[i];
  }
  if (buf) out.push(on ? <mark key="end">{buf}</mark> : buf);
  return <>{out}</>;
}

export interface SearchCommandProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sections: CommandSection[];
  recent?: string[];
  onSelect?: (item: CommandItem, section: CommandSection) => void;
  placeholder?: string;
  hotkey?: boolean;
  theme?: "light" | "dark";
  className?: string;
}

export function SearchCommand({ open, onOpenChange, sections, recent = [], onSelect, placeholder = "Search or run a command…", hotkey = true, theme, className }: SearchCommandProps) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [cur, setCur] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [mouse, setMouse] = useState(false);

  useEffect(() => {
    if (!hotkey) return;
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [hotkey, open, onOpenChange]);

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement;
      setQ("");
      setCur(0);
      const t = window.setTimeout(() => input.current?.focus(), 20);
      return () => window.clearTimeout(t);
    }
    (opener.current as HTMLElement | null)?.focus?.();
  }, [open]);

  const groups = useMemo(() => {
    const all = sections.flatMap((s) => s.items.map((i) => ({ i, s })));
    if (!q.trim()) {
      const rec = recent.map((id) => all.find((x) => x.i.id === id)).filter(Boolean) as typeof all;
      const out: { section: CommandSection; heading: string; rows: { item: CommandItem; idx: number[] }[] }[] = [];
      if (rec.length) out.push({ section: rec[0].s, heading: "Recent", rows: rec.map((x) => ({ item: x.i, idx: [] })) });
      sections.forEach((s) => s.items.some((i) => !recent.includes(i.id)) && out.push({ section: s, heading: s.heading, rows: s.items.filter((i) => !recent.includes(i.id)).slice(0, 4).map((i) => ({ item: i, idx: [] })) }));
      return out;
    }
    return sections
      .map((s) => {
        const rows = s.items
          .map((item) => {
            const a = fuzzyScore(q, item.label);
            const b = a ? null : fuzzyScore(q, `${item.keywords ?? ""} ${item.hint ?? ""}`);
            if (!a && !b) return null;
            return { item, idx: a?.idx ?? [], score: a ? a.score + 20 : (b?.score ?? 0) };
          })
          .filter(Boolean) as { item: CommandItem; idx: number[]; score: number }[];
        rows.sort((x, y) => y.score - x.score);
        return { section: s, heading: s.heading, rows, top: rows[0]?.score ?? -1 };
      })
      .filter((g) => g.rows.length)
      .sort((a, b) => (b as { top: number }).top - (a as { top: number }).top);
  }, [q, sections, recent]);

  const flat = groups.flatMap((g) => g.rows.map((r) => ({ ...r, section: g.section })));
  useEffect(() => setCur(0), [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${cur}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cur]);

  const run = useCallback(
    (n: number) => {
      const r = flat[n];
      if (!r) return;
      onSelect?.(r.item, r.section);
      onOpenChange(false);
    },
    [flat, onSelect, onOpenChange],
  );

  const onKey = (e: React.KeyboardEvent) => {
    setMouse(false);
    if (e.key === "ArrowDown") (e.preventDefault(), setCur((c) => (c + 1) % Math.max(flat.length, 1)));
    else if (e.key === "ArrowUp") (e.preventDefault(), setCur((c) => (c - 1 + flat.length) % Math.max(flat.length, 1)));
    else if (e.key === "Home") (e.preventDefault(), setCur(0));
    else if (e.key === "End") (e.preventDefault(), setCur(flat.length - 1));
    else if (e.key === "Enter") (e.preventDefault(), run(cur));
    else if (e.key === "Escape") (e.preventDefault(), onOpenChange(false));
    else if (e.key === "Tab") e.preventDefault(); // keep focus in the palette
  };

  if (!open) return <style>{css}</style>;

  let n = -1;
  return (
    <div className={`fd-cmd${className ? " " + className : ""}`} data-fd-theme={theme}>
      <style>{css}</style>
      <div className="fd-cmd-scrim" onMouseDown={() => onOpenChange(false)} />
      <div className="fd-cmd-panel" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKey}>
        <div className="fd-cmd-top">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${uid}-list`}
            aria-activedescendant={flat.length ? `${uid}-o${cur}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && <button type="button" className="fd-cmd-clear" aria-label="Clear search" onClick={() => { setQ(""); input.current?.focus(); }}>Clear</button>}
          <kbd>esc</kbd>
        </div>

        <div ref={list} id={`${uid}-list`} className="fd-cmd-list" role="listbox" aria-label="Results" onMouseMove={() => !mouse && setMouse(true)}>
          {flat.length === 0 ? (
            <div className="fd-cmd-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M8.5 11h5" /></svg>
              <p>No results for “{q}”</p>
              <span>Try a shipment ID, warehouse code or action.</span>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.heading + g.section.id} role="group" aria-label={g.heading} className="fd-cmd-group">
                <div className="fd-cmd-head" aria-hidden="true">{g.heading}</div>
                {g.rows.map((r) => {
                  n++;
                  const i = n;
                  return (
                    <div
                      key={r.item.id + g.heading}
                      id={`${uid}-o${i}`}
                      role="option"
                      aria-selected={i === cur}
                      data-i={i}
                      className="fd-cmd-item"
                      data-active={i === cur || undefined}
                      onMouseMove={() => mouse && setCur(i)}
                      onClick={() => run(i)}
                    >
                      <span className="fd-cmd-ic">{r.item.icon}</span>
                      <span className="fd-cmd-txt">
                        <span className="fd-cmd-label"><Hl text={r.item.label} idx={r.idx} /></span>
                        {r.item.hint && <span className="fd-cmd-hint">{r.item.hint}</span>}
                      </span>
                      {r.item.shortcut && <kbd>{r.item.shortcut}</kbd>}
                      <svg className="fd-cmd-enter" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 5v7a3 3 0 0 1-3 3H5M9 11l-4 4 4 4" /></svg>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="fd-cmd-foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
          <b>{flat.length} {flat.length === 1 ? "result" : "results"}</b>
        </div>
        <span className="fd-cmd-sr" role="status" aria-live="polite">{flat.length} results</span>
      </div>
    </div>
  );
}

const css = `
:where(.fd-cmd,.fd-cmd *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-cmd,.fd-cmd *)::before,:where(.fd-cmd,.fd-cmd *)::after{box-sizing:border-box}
:where(.fd-cmd svg){display:block;flex-shrink:0}
:where(.fd-cmd button,.fd-cmd input){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;outline:0}
.fd-cmd{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --c-bg:rgba(255,255,255,.92);--c-solid:#fff;--c-fg:#0B0B0F;--c-mut:#6B6B76;--c-line:rgba(11,11,15,.08);--c-hover:rgba(11,11,15,.05);--c-active:rgba(0,122,255,.1);--c-accent:#007AFF;--c-mark:#0058C7;--c-kbd:rgba(11,11,15,.06);
  position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:min(14vh,120px) 16px 16px;
  font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;color:var(--c-fg);
}
[data-fd-theme="dark"].fd-cmd,.fd-cmd[data-fd-theme="dark"]{--c-bg:rgba(24,24,30,.86);--c-solid:#18181E;--c-fg:#F5F5F7;--c-mut:#9A9AA6;--c-line:rgba(255,255,255,.09);--c-hover:rgba(255,255,255,.06);--c-active:rgba(10,132,255,.22);--c-accent:#0A84FF;--c-mark:#6CB4FF;--c-kbd:rgba(255,255,255,.1)}
.fd-cmd-scrim{position:absolute;inset:0;background:rgba(11,11,15,.35);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);animation:fd-cmd-fade var(--fd-dur-2) var(--fd-ease-out)}
.fd-cmd-panel{position:relative;display:flex;flex-direction:column;width:100%;max-width:640px;max-height:min(560px,calc(100vh - 140px));border-radius:20px;overflow:hidden;
  background:var(--c-bg);-webkit-backdrop-filter:blur(28px) saturate(1.6);backdrop-filter:blur(28px) saturate(1.6);
  box-shadow:0 0 0 1px var(--c-line),0 1px 0 rgba(255,255,255,.1) inset,0 4px 8px rgba(0,0,0,.06),0 40px 80px -20px rgba(0,0,0,.45);animation:fd-cmd-in var(--fd-dur-3) var(--fd-spring)}
.fd-cmd-top{flex:none;display:flex;align-items:center;gap:12px;padding:0 16px;height:60px;border-bottom:1px solid var(--c-line);color:var(--c-mut)}
.fd-cmd-top input{flex:1;min-width:0;height:100%;color:var(--c-fg);font-family:inherit;font-size:17px;letter-spacing:-.01em;caret-color:var(--c-accent)}
.fd-cmd-top input::placeholder{color:var(--c-mut);opacity:.8}
.fd-cmd-clear{cursor:pointer;height:24px;padding:0 8px;border-radius:6px;font-family:inherit;font-size:12px;font-weight:500;color:var(--c-mut)}.fd-cmd-clear:hover{background:var(--c-hover);color:var(--c-fg)}
.fd-cmd-clear:focus-visible{outline:2px solid var(--c-accent);outline-offset:1px}
.fd-cmd kbd{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:6px;background:var(--c-kbd);color:var(--c-mut);font:500 11px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace}
.fd-cmd-list{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:8px;scroll-padding:8px}
.fd-cmd-group+.fd-cmd-group{margin-top:6px}
.fd-cmd-head{padding:10px 12px 6px;font-size:12px;font-weight:600;line-height:1;letter-spacing:.02em;color:var(--c-mut)}
.fd-cmd-item{display:flex;align-items:center;gap:12px;min-height:48px;padding:8px 12px;border-radius:12px;cursor:pointer;transition:background-color var(--fd-dur-1) var(--fd-ease-out)}
.fd-cmd-item[data-active]{background:var(--c-active)}
.fd-cmd-ic{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:var(--c-hover);color:var(--c-mut);transition:background-color var(--fd-dur-1),color var(--fd-dur-1)}
.fd-cmd-item[data-active] .fd-cmd-ic{background:var(--c-accent);color:#fff}
.fd-cmd-ic svg{width:16px;height:16px}
.fd-cmd-txt{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
.fd-cmd-label{font-size:15px;font-weight:500;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fd-cmd-hint{font-size:12.5px;line-height:1.3;color:var(--c-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fd-cmd mark{background:none;color:var(--c-mark);font-weight:700}
.fd-cmd-enter{opacity:0;color:var(--c-mut);transform:translateX(-4px);transition:opacity var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-ease-out)}
.fd-cmd-item[data-active] .fd-cmd-enter{opacity:1;transform:none}
.fd-cmd-item[data-active] kbd{display:none}
.fd-cmd-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:48px 16px;text-align:center;color:var(--c-mut)}
.fd-cmd-empty p{margin-top:8px;font-size:15px;font-weight:500;color:var(--c-fg)}.fd-cmd-empty span{font-size:13px}
.fd-cmd-foot{flex:none;display:flex;align-items:center;gap:16px;padding:0 16px;height:44px;border-top:1px solid var(--c-line);font-size:12px;color:var(--c-mut)}
.fd-cmd-foot span{display:inline-flex;align-items:center;gap:4px}.fd-cmd-foot kbd{min-width:20px;height:20px}
.fd-cmd-foot b{margin-left:auto;font-weight:500;font-variant-numeric:tabular-nums}
.fd-cmd-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes fd-cmd-fade{from{opacity:0}}
@keyframes fd-cmd-in{from{opacity:0;transform:translateY(-12px) scale(.96)}}
@media (max-width:560px){.fd-cmd{padding-top:12px}.fd-cmd-foot span:nth-child(n+2){display:none}.fd-cmd-panel{max-height:calc(100vh - 28px)}}
@media (prefers-reduced-motion:reduce){.fd-cmd-panel{animation:fd-cmd-fade 100ms linear}.fd-cmd-scrim{animation:none}.fd-cmd-enter{transition:none}}
@media (prefers-reduced-transparency:reduce),(prefers-contrast:more){.fd-cmd-panel{background:var(--c-solid);-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:0 0 0 1px currentColor}.fd-cmd-scrim{-webkit-backdrop-filter:none;backdrop-filter:none}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const I = (d: string) => <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const box = I("M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8");
const truck = I("M1 6h13v10H1zM14 10h5l3 3v3h-8M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z");
const pin = I("M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z");
const plus = I("M12 5v14M5 12h14");
const alert = I("M12 3l10 18H2zM12 10v5M12 18h.01");
const grid = I("M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z");
const user = I("M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z");
const moon = I("M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z");

const SECTIONS: CommandSection[] = [
  {
    id: "ship",
    heading: "Shipments",
    items: [
      { id: "s1", label: "SHP-48213 · Rotterdam → Chicago", hint: "In transit · ETA 3 Nov · 12 pallets", icon: box, keywords: "container ocean maersk" },
      { id: "s2", label: "SHP-48190 · Shenzhen → Los Angeles", hint: "Customs hold · Port of LA", icon: alert, keywords: "delay hold customs" },
      { id: "s3", label: "SHP-48177 · Hamburg → Singapore", hint: "Delivered 27 Oct · POD signed", icon: box, keywords: "delivered" },
      { id: "s4", label: "SHP-48251 · Monterrey → Dallas", hint: "Out for delivery · Driver R. Alvarez", icon: truck, keywords: "truck road ftl" },
    ],
  },
  {
    id: "wh",
    heading: "Warehouses",
    items: [
      { id: "w1", label: "DC-04 Memphis Hub", hint: "92% capacity · 38 docks", icon: pin, keywords: "tennessee distribution center" },
      { id: "w2", label: "DC-11 Rotterdam Maasvlakte", hint: "71% capacity · 24 docks", icon: pin, keywords: "netherlands" },
      { id: "w3", label: "DC-07 Reno Crossdock", hint: "58% capacity · 16 docks", icon: pin, keywords: "nevada" },
    ],
  },
  {
    id: "act",
    heading: "Actions",
    items: [
      { id: "a1", label: "Create shipment", hint: "Start a new booking", icon: plus, shortcut: "C" },
      { id: "a2", label: "Reassign carrier", hint: "Move selected loads to another carrier", icon: truck, shortcut: "R" },
      { id: "a3", label: "Escalate to customs broker", hint: "Open a case for held shipments", icon: alert },
      { id: "a4", label: "Toggle dark mode", hint: "Appearance", icon: moon, shortcut: "⌘ D" },
    ],
  },
  {
    id: "nav",
    heading: "Go to",
    items: [
      { id: "n1", label: "Dashboard", icon: grid, shortcut: "G D" },
      { id: "n2", label: "Carriers", icon: truck, shortcut: "G C" },
      { id: "n3", label: "Team settings", icon: user, shortcut: "G S" },
    ],
  },
];

const ROWS = [
  ["SHP-48213", "Rotterdam → Chicago", "In transit", "3 Nov", "ok"],
  ["SHP-48190", "Shenzhen → Los Angeles", "Customs hold", "—", "warn"],
  ["SHP-48251", "Monterrey → Dallas", "Out for delivery", "Today", "ok"],
  ["SHP-48177", "Hamburg → Singapore", "Delivered", "27 Oct", "done"],
  ["SHP-48302", "Antwerp → Newark", "Booked", "9 Nov", "idle"],
];

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(["s2", "a1", "w1"]);
  const [log, setLog] = useState("");
  const isMac = useMemo(() => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform), []);
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(isMac), [isMac]);

  return (
    <div className="fd-cmd-demo" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <aside className="fd-cmd-demo-side" aria-label="Navigation">
        <div className="fd-cmd-demo-logo"><i aria-hidden="true" />Haulr Ops</div>
        {["Dashboard", "Shipments", "Warehouses", "Carriers", "Reports"].map((n, i) => <a key={n} href={`#${n}`} aria-current={i === 0 ? "page" : undefined}>{n}</a>)}
      </aside>
      <main className="fd-cmd-demo-main">
        <div className="fd-cmd-demo-top">
          <button type="button" className="fd-cmd-demo-search" onClick={() => setOpen(true)} aria-haspopup="dialog">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <span>Search shipments, sites, actions…</span>
            <kbd>{mac ? "⌘" : "Ctrl"} K</kbd>
          </button>
          <button type="button" className="fd-cmd-demo-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
        </div>
        <h1>Operations overview</h1>
        <section className="fd-cmd-demo-kpis" aria-label="Key metrics">
          {[["On-time delivery", "94.2%", "+1.1 pt"], ["Active shipments", "1,284", "+86"], ["At risk", "17", "−4"], ["Dock utilisation", "81%", "+3 pt"]].map(([k, v, d]) => (
            <div key={k}><small>{k}</small><b>{v}</b><span data-neg={d.startsWith("−") && k !== "At risk" ? "" : undefined}>{d} vs. last week</span></div>
          ))}
        </section>
        <section className="fd-cmd-demo-table" aria-label="Recent shipments">
          <div className="fd-cmd-demo-th"><span>Shipment</span><span>Lane</span><span>Status</span><span>ETA</span></div>
          {ROWS.map(([id, lane, st, eta, k]) => (
            <div key={id} className="fd-cmd-demo-tr"><b>{id}</b><span>{lane}</span><span data-k={k}><i />{st}</span><span>{eta}</span></div>
          ))}
        </section>
        {log && <p className="fd-cmd-demo-log" role="status">Ran: {log}</p>}
      </main>
      <SearchCommand
        open={open}
        onOpenChange={setOpen}
        sections={SECTIONS}
        recent={recent}
        theme={theme}
        onSelect={(it) => {
          setLog(it.label);
          setRecent((r) => [it.id, ...r.filter((x) => x !== it.id)].slice(0, 4));
          if (it.id === "a4") setTheme((t) => (t === "dark" ? "light" : "dark"));
        }}
      />
    </div>
  );
}

const demoCss = `
:where(.fd-cmd-demo,.fd-cmd-demo *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-cmd-demo,.fd-cmd-demo *)::before,:where(.fd-cmd-demo,.fd-cmd-demo *)::after{box-sizing:border-box}
:where(.fd-cmd-demo button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-cmd-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:ui-sans-serif,-apple-system,"SF Pro Display","Inter",sans-serif;
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-dur-2:240ms;
  --d-bg:#F5F6F8;--d-card:#fff;--d-ink:#0B0B0F;--d-mut:#6B6B76;--d-line:rgba(11,11,15,.08);--d-accent:#007AFF;--d-side:#fff;
  display:grid;grid-template-columns:232px minmax(0,1fr);min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.45 var(--d-font);-webkit-font-smoothing:antialiased;transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-cmd-demo[data-fd-theme="dark"]{--d-bg:#08090B;--d-card:#101014;--d-ink:#F5F5F7;--d-mut:#9A9AA6;--d-line:rgba(255,255,255,.08);--d-accent:#0A84FF;--d-side:#0B0B0F}
.fd-cmd-demo-side{display:flex;flex-direction:column;gap:2px;padding:20px 12px;background:var(--d-side);border-right:1px solid var(--d-line)}
.fd-cmd-demo-logo{display:flex;align-items:center;gap:10px;margin:0 8px 20px;font:700 16px/1 var(--d-disp);letter-spacing:-.02em}
.fd-cmd-demo-logo i{width:20px;height:20px;border-radius:6px;background:#F97316}
.fd-cmd-demo-side a{display:flex;align-items:center;height:34px;padding:0 10px;border-radius:8px;font:400 14px/1 var(--d-font);color:var(--d-mut)}
.fd-cmd-demo-side a:hover,.fd-cmd-demo-side a[aria-current]{background:var(--d-line);color:var(--d-ink)}.fd-cmd-demo-side a[aria-current]{font-weight:500}
.fd-cmd-demo-main{display:flex;flex-direction:column;gap:20px;padding:20px clamp(16px,3vw,40px) 48px;min-width:0}
.fd-cmd-demo-top{display:flex;gap:12px;align-items:center}
.fd-cmd-demo-search{display:flex;align-items:center;gap:10px;flex:1;max-width:460px;height:40px;padding:0 8px 0 14px;border-radius:12px;cursor:pointer;text-align:left;background:var(--d-card);color:var(--d-mut);box-shadow:0 0 0 1px var(--d-line),0 1px 2px rgba(0,0,0,.04);font:400 14px/1 var(--d-font);transition:box-shadow var(--fd-dur-2) var(--fd-ease-out)}
.fd-cmd-demo-search:hover{box-shadow:0 0 0 1px var(--d-mut),0 1px 2px rgba(0,0,0,.04)}.fd-cmd-demo-search span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fd-cmd-demo-search kbd{display:grid;place-items:center;height:24px;padding:0 8px;border-radius:6px;background:var(--d-line);font:500 11px/1 ui-monospace,"SF Mono",Menlo,monospace}
.fd-cmd-demo-search:focus-visible,.fd-cmd-demo-theme:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px}
.fd-cmd-demo-theme{cursor:pointer;margin-left:auto;height:32px;padding:0 14px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 13px/1 var(--d-font);color:var(--d-mut)}.fd-cmd-demo-theme:hover{color:var(--d-ink)}
.fd-cmd-demo-main h1{font:600 24px/1.15 var(--d-disp);letter-spacing:-.02em}
.fd-cmd-demo-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.fd-cmd-demo-kpis div{display:flex;flex-direction:column;gap:8px;padding:16px 18px;border-radius:16px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line)}
.fd-cmd-demo-kpis small{font:400 13px/1 var(--d-font);color:var(--d-mut)}.fd-cmd-demo-kpis b{font:600 26px/1 var(--d-disp);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.fd-cmd-demo-kpis span{font:500 12px/1 var(--d-font);color:#1C9A44}.fd-cmd-demo-kpis span[data-neg]{color:#E5484D}
.fd-cmd-demo-table{border-radius:16px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line);overflow:hidden}
.fd-cmd-demo-th,.fd-cmd-demo-tr{display:grid;grid-template-columns:110px minmax(0,1.6fr) minmax(0,1fr) 80px;gap:16px;align-items:center;padding:0 20px;height:48px;font:400 14px/1 var(--d-font)}
.fd-cmd-demo-th{height:40px;font:500 12px/1 var(--d-font);color:var(--d-mut);border-bottom:1px solid var(--d-line)}
.fd-cmd-demo-tr+.fd-cmd-demo-tr{border-top:1px solid var(--d-line)}.fd-cmd-demo-tr b{font:500 13px/1 ui-monospace,"SF Mono",Menlo,monospace}
.fd-cmd-demo-tr span:nth-child(3){display:inline-flex;align-items:center;gap:8px}.fd-cmd-demo-tr i{width:6px;height:6px;border-radius:50%;background:var(--d-mut)}
.fd-cmd-demo-tr [data-k="ok"] i{background:#30D158}.fd-cmd-demo-tr [data-k="warn"] i{background:#FF9F0A}.fd-cmd-demo-tr [data-k="done"] i{background:var(--d-accent)}
.fd-cmd-demo-log{font:500 13px/1.3 var(--d-font);color:var(--d-accent)}
@media (max-width:900px){.fd-cmd-demo{grid-template-columns:1fr}.fd-cmd-demo-side{display:none}.fd-cmd-demo-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.fd-cmd-demo-th,.fd-cmd-demo-tr{grid-template-columns:96px minmax(0,1fr) 72px}.fd-cmd-demo-th span:nth-child(2),.fd-cmd-demo-tr span:nth-child(2){display:none}}
`;
