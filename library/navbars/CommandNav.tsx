/**
 * CommandNav, a quiet product-analytics nav whose search field opens a real
 * ⌘K command palette: recent items, grouped results, fuzzy filtering with
 * highlighted matches, full keyboard control and a live preview pane that
 * draws a sparkline for the highlighted dashboard or event.
 *
 * Props: brand, workspace, links, current, commands (grouped), recent (ids),
 * onRun(item), user ({ name, src }).
 * CSS vars: --fd-cmd-paper, --fd-cmd-ink, --fd-cmd-accent.
 *
 * Keyboard: ⌘K / Ctrl+K toggles the palette anywhere, "/" opens it when you
 * are not typing, ↑ ↓ move, Home/End jump, Enter runs, Escape closes (or
 * clears the query first).
 * Browser support: all evergreen browsers.
 * Accessibility: the palette is a modal dialog; the input is a combobox
 * driving a listbox through aria-activedescendant; groups are labelled; the
 * result count is announced politely. Focus returns to the opener on close.
 * The mobile menu button has aria-expanded and closes on Escape.
 * Reduced motion: palette appears without scaling.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

export type CmdKind = "dashboard" | "event" | "action" | "person";
export interface CmdItem { id: string; label: string; kind: CmdKind; hint?: string; keys?: string[]; keywords?: string }
export interface CmdGroup { heading: string; items: CmdItem[] }
export interface CommandNavProps {
  brand?: string;
  workspace?: { org: string; project: string };
  links?: { label: string; href: string }[];
  current?: string;
  commands?: CmdGroup[];
  recent?: string[];
  user?: { name: string; src: string };
  onRun?: (item: CmdItem) => void;
  className?: string;
}

const COMMANDS: CmdGroup[] = [
  { heading: "Dashboards", items: [
    { id: "d-checkout", label: "Checkout funnel", kind: "dashboard", hint: "Edited by Priya, 2h ago" },
    { id: "d-retention", label: "Week 1 retention by plan", kind: "dashboard", hint: "Pinned · 14 charts" },
    { id: "d-north", label: "North star: weekly riders", kind: "dashboard", hint: "Shared with leadership" },
    { id: "d-ebike", label: "E-bike rental conversion", kind: "dashboard", hint: "Created by you" },
    { id: "d-support", label: "Support tickets vs. app version", kind: "dashboard", hint: "Last viewed Monday" },
  ] },
  { heading: "Events", items: [
    { id: "e-unlock", label: "bike_unlocked", kind: "event", hint: "41,208 in 24h", keywords: "unlock ride start" },
    { id: "e-pay", label: "payment_failed", kind: "event", hint: "312 in 24h", keywords: "card error checkout" },
    { id: "e-signup", label: "signup_completed", kind: "event", hint: "1,904 in 24h", keywords: "register account" },
    { id: "e-dock", label: "dock_full_warning", kind: "event", hint: "88 in 24h", keywords: "station capacity" },
  ] },
  { heading: "Actions", items: [
    { id: "a-new", label: "New insight", kind: "action", keys: ["N"], keywords: "create chart" },
    { id: "a-funnel", label: "New funnel from events", kind: "action", keys: ["F"], keywords: "create" },
    { id: "a-invite", label: "Invite a teammate", kind: "action", keys: ["I"], keywords: "member user add" },
    { id: "a-theme", label: "Switch to dark theme", kind: "action", keys: ["⇧", "D"], keywords: "appearance mode" },
    { id: "a-export", label: "Export current view as CSV", kind: "action", keys: ["E"], keywords: "download" },
  ] },
  { heading: "People", items: [
    { id: "p-priya", label: "Priya Raman", kind: "person", hint: "Growth · owns 9 dashboards" },
    { id: "p-jonas", label: "Jonas Ekberg", kind: "person", hint: "Data engineering" },
  ] },
];

const LINKS = [
  { label: "Dashboards", href: "#dashboards" },
  { label: "Funnels", href: "#funnels" },
  { label: "Retention", href: "#retention" },
  { label: "Live events", href: "#live" },
];

/** Subsequence fuzzy match: returns score and matched indices, or null. */
function fuzzy(q: string, text: string): { score: number; idx: number[] } | null {
  const s = text.toLowerCase();
  const n = q.toLowerCase().replace(/\s+/g, " ").trim();
  if (!n) return { score: 0, idx: [] };
  let i = 0, score = 0, prev = -2;
  const idx: number[] = [];
  for (const ch of n) {
    if (ch === " ") continue;
    const j = s.indexOf(ch, i);
    if (j < 0) return null;
    const start = j === 0 || /[\s_:.\-]/.test(s[j - 1]);
    score += 1 + (j === prev + 1 ? 3 : 0) + (start ? 4 : 0) - Math.min(3, (j - i) * 0.1);
    idx.push(j);
    prev = j;
    i = j + 1;
  }
  // Reject scattered matches: accept one run, acronym-style runs, or a
  // word-start match with only a few breaks.
  const starts = idx.filter((j, k) => k === 0 || idx[k - 1] !== j - 1);
  const atWord = (j: number) => j === 0 || /[\s_:.\-]/.test(s[j - 1]);
  const ok = starts.length === 1 || starts.every(atWord) || (atWord(starts[0]) && starts.length <= 1 + Math.floor(idx.length / 3));
  if (!ok) return null;
  return { score: score - s.length * 0.02, idx };
}

function Hl({ text, idx }: { text: string; idx: number[] }) {
  if (!idx.length) return <>{text}</>;
  const set = new Set(idx);
  const out: ReactNode[] = [];
  let buf = "", on = false;
  for (let i = 0; i <= text.length; i++) {
    const m = i < text.length && set.has(i);
    if ((m !== on || i === text.length) && buf) {
      out.push(on ? <mark key={i}>{buf}</mark> : <span key={i}>{buf}</span>);
      buf = "";
    }
    on = m;
    if (i < text.length) buf += text[i];
  }
  return <>{out}</>;
}

function seeded(id: string) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) / 4294967295;
}

function Glyph({ kind }: { kind: CmdKind }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {kind === "dashboard" && <><rect x="2" y="2" width="5" height="6" rx="1" {...p} /><rect x="9" y="2" width="5" height="3.5" rx="1" {...p} /><rect x="2" y="10" width="5" height="4" rx="1" {...p} /><rect x="9" y="7.5" width="5" height="6.5" rx="1" {...p} /></>}
      {kind === "event" && <path d="M2 8h2.5l1.8-4.5 3.4 9 1.8-4.5H14" {...p} />}
      {kind === "action" && <path d="M8 2.5v11M2.5 8h11" {...p} />}
      {kind === "person" && <><circle cx="8" cy="5.5" r="2.7" {...p} /><path d="M2.8 14c.6-2.8 2.7-4.2 5.2-4.2s4.6 1.4 5.2 4.2" {...p} /></>}
    </svg>
  );
}

function Spark({ id }: { id: string }) {
  const pts = useMemo(() => {
    const r = seeded(id);
    let v = 40 + r() * 20;
    return Array.from({ length: 24 }, () => (v = Math.max(8, Math.min(92, v + (r() - 0.45) * 18))));
  }, [id]);
  const d = pts.map((y, i) => `${i ? "L" : "M"}${(i / 23) * 220} ${100 - y}`).join(" ");
  return (
    <svg className="fd-cmd-spark" viewBox="0 0 220 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L220 100 L0 100 Z`} fill="var(--fd-cmd-accent)" opacity="0.08" />
      <path d={d} fill="none" stroke="var(--fd-cmd-accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function CommandNav({
  brand = "plumb",
  workspace = { org: "Halden Bikes", project: "Production" },
  links = LINKS,
  current = "#funnels",
  commands = COMMANDS,
  recent: recentInit = ["d-checkout", "e-pay", "a-invite"],
  user = { name: "Mara Lindqvist", src: "/img/people/p6.webp" },
  onRun,
  className,
}: CommandNavProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const [cur, setCur] = useState(0);
  const [recent, setRecent] = useState(recentInit);
  const [toast, setToast] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const menuEl = useRef<HTMLDivElement>(null);
  const pointerMoved = useRef(false);

  const all = useMemo(() => commands.flatMap((g) => g.items.map((i) => ({ i, g: g.heading }))), [commands]);

  const groups = useMemo(() => {
    if (!q.trim()) {
      const rec = recent.map((id) => all.find((x) => x.i.id === id)).filter(Boolean).map((x) => ({ item: x!.i, idx: [] as number[] }));
      const out: { heading: string; rows: { item: CmdItem; idx: number[] }[] }[] = [];
      if (rec.length) out.push({ heading: "Recent", rows: rec });
      commands.forEach((g) => {
        const rows = g.items.filter((i) => !recent.includes(i.id)).slice(0, 3).map((item) => ({ item, idx: [] as number[] }));
        if (rows.length) out.push({ heading: g.heading, rows });
      });
      return out;
    }
    return commands
      .map((g) => ({
        heading: g.heading,
        rows: g.items
          .map((item) => {
            const a = fuzzy(q, item.label);
            const b = a ? null : fuzzy(q, item.keywords ?? "");
            const m = a ?? (b ? { score: b.score - 3, idx: [] } : null);
            return m ? { item, idx: m.idx, score: m.score } : null;
          })
          .filter(Boolean)
          .sort((x, y) => y!.score - x!.score) as { item: CmdItem; idx: number[] }[],
      }))
      .filter((g) => g.rows.length)
      .sort((a, b) => ((b.rows[0] as { score?: number }).score ?? 0) - ((a.rows[0] as { score?: number }).score ?? 0));
  }, [q, commands, recent, all]);

  const flat = useMemo(() => groups.flatMap((g) => g.rows.map((r) => r.item)), [groups]);
  const active = flat[Math.min(cur, flat.length - 1)];
  const optId = (id: string) => `${uid}-o-${id}`;

  const show = (from?: HTMLElement | null) => {
    opener.current = from ?? (document.activeElement as HTMLElement);
    setMenu(false);
    setQ("");
    setCur(0);
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
    window.setTimeout(() => opener.current?.focus?.(), 0);
  };

  // Global shortcuts.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) hide();
        else show();
      } else if (e.key === "/" && !open) {
        const t = e.target as HTMLElement;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) window.setTimeout(() => input.current?.focus(), 10);
  }, [open]);
  useEffect(() => setCur(0), [q]);

  // Keep the active row in view.
  useEffect(() => {
    if (!open || !active) return;
    const el = document.getElementById(optId(active.id));
    const l = list.current;
    if (el && l) {
      const top = el.offsetTop - 34, bottom = el.offsetTop + el.offsetHeight + 8;
      if (top < l.scrollTop) l.scrollTop = top;
      else if (bottom > l.scrollTop + l.clientHeight) l.scrollTop = bottom - l.clientHeight;
    }
  }, [cur, open, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toast lifetime.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Mobile menu.
  useEffect(() => {
    if (!menu) return;
    menuEl.current?.querySelector<HTMLElement>("a,button")?.focus();
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        menuBtn.current?.focus();
      }
    };
    const out = (e: PointerEvent) => {
      if (!menuEl.current?.contains(e.target as Node) && !menuBtn.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("keydown", on);
    document.addEventListener("pointerdown", out);
    return () => {
      document.removeEventListener("keydown", on);
      document.removeEventListener("pointerdown", out);
    };
  }, [menu]);

  const run = (item: CmdItem) => {
    setRecent((r) => [item.id, ...r.filter((x) => x !== item.id)].slice(0, 4));
    onRun?.(item);
    setToast(item.kind === "action" ? `${item.label}` : `Opened ${item.label}`);
    hide();
  };

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const n = flat.length;
    if (e.key === "ArrowDown") { e.preventDefault(); if (n) setCur((c) => (c + 1) % n); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (n) setCur((c) => (c - 1 + n) % n); }
    else if (e.key === "Home") { e.preventDefault(); setCur(0); }
    else if (e.key === "End") { e.preventDefault(); setCur(Math.max(0, n - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (active) run(active); }
    else if (e.key === "Escape") { e.preventDefault(); if (q) setQ(""); else hide(); }
    else if (e.key === "Tab") e.preventDefault();
  };

  let rowIndex = -1;
  const kindLabel: Record<CmdKind, string> = { dashboard: "Dashboard", event: "Event", action: "Action", person: "Person" };

  return (
    <header className={`fd-cmd${className ? " " + className : ""}`}>
      <style>{css}</style>
      <div className="fd-cmd-bar">
        <a href="#top" className="fd-cmd-logo" aria-label={`${brand} home`}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5v5" stroke="currentColor" strokeWidth="1.5" /><path d="M10 6.5 15 12a5 5 0 0 1-10 0z" fill="currentColor" /><circle cx="10" cy="12.5" r="1.6" fill="var(--fd-cmd-paper)" /></svg>
          <span>{brand}</span>
        </a>
        <span className="fd-cmd-crumb" aria-label="Workspace">
          <span className="fd-cmd-slash" aria-hidden="true">/</span>
          <span className="fd-cmd-org">{workspace.org}</span>
          <span className="fd-cmd-env"><i aria-hidden="true" />{workspace.project}</span>
        </span>
        <nav className="fd-cmd-nav" aria-label="Primary">
          {links.map((l) => <a key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined}>{l.label}</a>)}
        </nav>
        <button type="button" className="fd-cmd-search" aria-haspopup="dialog" aria-expanded={open} onClick={(e) => show(e.currentTarget)}>
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10.6 10.6 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          <span className="fd-cmd-ph">Search or jump to…</span>
          <kbd>⌘K</kbd>
        </button>
        <a href="#invite" className="fd-cmd-invite">Invite</a>
        <img className="fd-cmd-av" src={user.src} alt={user.name} width={32} height={32} />
        <button ref={menuBtn} type="button" className="fd-cmd-burger" aria-label="Menu" aria-expanded={menu} aria-controls={`${uid}-m`} onClick={() => setMenu((m) => !m)}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">{menu ? <path d="M4 4l10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /> : <path d="M3 6h12M3 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}</svg>
        </button>
      </div>

      <div ref={menuEl} id={`${uid}-m`} className="fd-cmd-menu" hidden={!menu}>
        <button type="button" className="fd-cmd-msearch" onClick={(e) => show(menuBtn.current ?? e.currentTarget)}>
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10.6 10.6 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          Search or jump to…
        </button>
        <nav aria-label="Mobile">
          {links.map((l) => <a key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined} onClick={() => setMenu(false)}>{l.label}</a>)}
        </nav>
        <div className="fd-cmd-mfoot">
          <span className="fd-cmd-org">{workspace.org}</span>
          <span className="fd-cmd-env"><i aria-hidden="true" />{workspace.project}</span>
          <a href="#invite" className="fd-cmd-invite">Invite</a>
        </div>
      </div>

      {open && (
        <div className="fd-cmd-layer">
          <div className="fd-cmd-scrim" aria-hidden="true" onClick={hide} />
          <div className="fd-cmd-pal" role="dialog" aria-modal="true" aria-label="Command palette">
            <div className="fd-cmd-field">
              <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M10.6 10.6 14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Search dashboards, events, people, or type a command"
                role="combobox"
                aria-expanded="true"
                aria-controls={`${uid}-lb`}
                aria-activedescendant={active ? optId(active.id) : undefined}
                aria-autocomplete="list"
                spellCheck={false}
                autoComplete="off"
              />
              <button type="button" className="fd-cmd-esc" onClick={hide} aria-label="Close">esc</button>
            </div>
            <div className="fd-cmd-body">
              <div ref={list} id={`${uid}-lb`} role="listbox" aria-label="Results" className="fd-cmd-list" onPointerMove={() => (pointerMoved.current = true)}>
                {groups.map((g, gi) => (
                  <div key={g.heading} role="group" aria-labelledby={`${uid}-g${gi}`} className="fd-cmd-group">
                    <div id={`${uid}-g${gi}`} className="fd-cmd-gh">{g.heading}</div>
                    {g.rows.map((r) => {
                      rowIndex++;
                      const ri = rowIndex;
                      const on = ri === Math.min(cur, flat.length - 1);
                      return (
                        <div
                          key={g.heading + r.item.id}
                          id={optId(r.item.id)}
                          role="option"
                          aria-selected={on}
                          className="fd-cmd-opt"
                          data-kind={r.item.kind}
                          onPointerEnter={() => pointerMoved.current && setCur(ri)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => run(r.item)}
                        >
                          <span className="fd-cmd-ic">
                            {r.item.kind === "person" ? <span className="fd-cmd-ini">{r.item.label.split(" ").map((w) => w[0]).join("")}</span> : <Glyph kind={r.item.kind} />}
                          </span>
                          <span className={`fd-cmd-lab${r.item.kind === "event" ? " fd-cmd-mono" : ""}`}><Hl text={r.item.label} idx={r.idx} /></span>
                          {r.item.keys ? (
                            <span className="fd-cmd-keys">{r.item.keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>
                          ) : (
                            <span className="fd-cmd-hint">{r.item.hint}</span>
                          )}
                          <svg className="fd-cmd-enter" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M11.5 3v4.5H3.5M6 5 3.5 7.5 6 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {!flat.length && (
                  <div className="fd-cmd-empty">
                    <p>Nothing called “{q}”.</p>
                    <span>Try an event name like <code>bike_unlocked</code>, or a teammate.</span>
                  </div>
                )}
              </div>
              <aside className="fd-cmd-prev" aria-hidden="true">
                {active && (
                  <>
                    <span className="fd-cmd-pk">{kindLabel[active.kind]}</span>
                    <p className="fd-cmd-pt">{active.label}</p>
                    {(active.kind === "dashboard" || active.kind === "event") ? (
                      <>
                        <Spark id={active.id} />
                        <div className="fd-cmd-pstats">
                          {active.kind === "event" ? <span><b>{active.hint?.split(" in ")[0]}</b> in the last 24 hours</span> : <span><b>{(seeded(active.id)() * 40 + 8).toFixed(1)}%</b> conversion</span>}
                          <span><b>{active.kind === "event" ? "+" : "−"}{(seeded(active.id + "x")() * 9 + 1).toFixed(1)}%</b> vs last week</span>
                        </div>
                      </>
                    ) : (
                      <p className="fd-cmd-pd">{active.kind === "action" ? `Runs immediately. Shortcut ${active.keys?.join(" ") ?? ""} works anywhere outside a text field.` : active.hint}</p>
                    )}
                  </>
                )}
              </aside>
            </div>
            <div className="fd-cmd-foot">
              <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>esc</kbd> {q ? "clear" : "close"}</span>
              <span className="fd-cmd-count" role="status" aria-live="polite">{flat.length} {flat.length === 1 ? "result" : "results"}</span>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fd-cmd-toast" role="status">{toast}</div>}
    </header>
  );
}

const sans = `ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif`;
const mono = `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`;

const css = `
.fd-cmd {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-cmd-paper: #fbfbf9;
  --fd-cmd-ink: #14161a;
  --fd-cmd-soft: #6a6d74;
  --fd-cmd-line: #e6e6e1;
  --fd-cmd-accent: #2a44ff;
  position: sticky; top: 0; z-index: 50; display: block; margin: 0; padding: 0;
  font: 400 14px/1.4 ${sans};
  color: var(--fd-cmd-ink); background: var(--fd-cmd-paper);
  border-bottom: 1px solid var(--fd-cmd-line);
}
.fd-cmd, .fd-cmd *, .fd-cmd *::before, .fd-cmd *::after { box-sizing: border-box; }
.fd-cmd a:focus-visible, .fd-cmd button:focus-visible { outline: 2px solid color-mix(in srgb, var(--fd-cmd-accent) 70%, transparent); outline-offset: 2px; }
.fd-cmd kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; margin: 0; padding: 0 5px; border: 1px solid var(--fd-cmd-line); border-bottom-width: 2px; border-radius: 5px; background: #fff; font: 500 0.6875rem/1 ${mono}; color: var(--fd-cmd-soft); }

.fd-cmd-bar { display: flex; align-items: center; gap: 14px; height: 60px; margin: 0; padding: 0 20px; }
.fd-cmd-logo { display: inline-flex; align-items: center; gap: 7px; margin: 0; padding: 4px; color: var(--fd-cmd-ink); text-decoration: none; border-radius: 6px; }
.fd-cmd-logo svg { display: block; }
.fd-cmd-logo span { font: 700 1.125rem/1 ${sans}; letter-spacing: -0.04em; }
.fd-cmd-crumb { display: inline-flex; align-items: center; gap: 9px; margin: 0; padding: 0; white-space: nowrap; }
.fd-cmd-slash { font: 300 1.25rem/1 ${sans}; color: #c8c8c2; }
.fd-cmd-org { font: 500 0.875rem/1 ${sans}; color: var(--fd-cmd-ink); }
.fd-cmd-env { display: inline-flex; align-items: center; gap: 6px; margin: 0; padding: 4px 8px; border-radius: 9999px; font: 500 0.75rem/1 ${mono}; color: #1d6b3a; background: #e8f4ea; }
.fd-cmd-env i { display: block; width: 6px; height: 6px; border-radius: 9999px; background: #23a455; }
.fd-cmd-nav { display: flex; align-items: center; gap: 2px; margin: 0 0 0 10px; padding: 0; }
.fd-cmd-nav a { position: relative; display: block; margin: 0; padding: 8px 10px; border-radius: 7px; font: 500 0.875rem/1 ${sans}; color: var(--fd-cmd-soft); text-decoration: none; transition: color var(--fd-dur-1) linear, background var(--fd-dur-1) linear; }
.fd-cmd-nav a:hover { color: var(--fd-cmd-ink); background: #f0f0ec; }
.fd-cmd-nav a[aria-current="page"] { color: var(--fd-cmd-ink); }
.fd-cmd-nav a[aria-current="page"]::after { content: ""; position: absolute; left: 10px; right: 10px; bottom: -12px; height: 2px; background: var(--fd-cmd-ink); }
.fd-cmd-search { display: flex; align-items: center; gap: 9px; width: 300px; height: 36px; margin: 0 0 0 auto; padding: 0 6px 0 11px; border: 1px solid var(--fd-cmd-line); border-radius: 9px; background: #fff; font: 400 0.875rem/1 ${sans}; color: var(--fd-cmd-soft); text-align: left; cursor: text; appearance: none; -webkit-appearance: none; box-shadow: 0 1px 0 rgba(20,22,26,0.03); transition: border-color var(--fd-dur-1) linear, box-shadow var(--fd-dur-2) var(--fd-ease-out); }
.fd-cmd-search svg { display: block; flex: none; }
.fd-cmd-search:hover { border-color: #cfcfc8; box-shadow: 0 2px 8px rgba(20,22,26,0.06); }
.fd-cmd-ph { flex: 1; }
.fd-cmd-invite { display: inline-flex; align-items: center; margin: 0; padding: 9px 12px; border-radius: 8px; font: 500 0.8125rem/1 ${sans}; color: #fff; background: var(--fd-cmd-ink); text-decoration: none; }
.fd-cmd-invite:hover { background: #2a2d33; }
.fd-cmd-av { display: block; width: 32px; height: 32px; border-radius: 9999px; object-fit: cover; background: #e6e6e1; }
.fd-cmd-burger { display: none; place-items: center; width: 38px; height: 38px; margin: 0; padding: 0; border: 1px solid var(--fd-cmd-line); border-radius: 9px; background: #fff; color: var(--fd-cmd-ink); cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-cmd-burger svg { display: block; }

.fd-cmd-menu { position: absolute; left: 12px; right: 12px; top: 64px; margin: 0; padding: 10px; border: 1px solid var(--fd-cmd-line); border-radius: 14px; background: #fff; box-shadow: 0 18px 40px rgba(20,22,26,0.14); animation: fd-cmd-pop var(--fd-dur-2) var(--fd-ease-out); transform-origin: top right; }
.fd-cmd-menu[hidden] { display: none; }
.fd-cmd-msearch { display: flex; align-items: center; gap: 9px; width: 100%; margin: 0 0 6px; padding: 12px; border: 1px solid var(--fd-cmd-line); border-radius: 10px; background: var(--fd-cmd-paper); font: 400 0.9375rem/1 ${sans}; color: var(--fd-cmd-soft); text-align: left; cursor: text; appearance: none; -webkit-appearance: none; }
.fd-cmd-msearch svg { display: block; }
.fd-cmd-menu nav { display: block; margin: 0; padding: 0; }
.fd-cmd-menu nav a { display: block; margin: 0; padding: 13px 12px; border-radius: 9px; font: 500 1.0625rem/1 ${sans}; color: var(--fd-cmd-ink); text-decoration: none; }
.fd-cmd-menu nav a[aria-current="page"] { background: #f0f0ec; }
.fd-cmd-mfoot { display: flex; align-items: center; gap: 10px; margin: 6px 0 0; padding: 12px 4px 2px; border-top: 1px solid var(--fd-cmd-line); }
.fd-cmd-mfoot .fd-cmd-invite { margin-left: auto; }

.fd-cmd-layer { position: fixed; inset: 0; z-index: 80; display: flex; justify-content: center; align-items: flex-start; padding: 12vh 16px 16px; }
.fd-cmd-scrim { position: absolute; inset: 0; background: rgba(20,22,26,0.32); animation: fd-cmd-fade var(--fd-dur-2) linear; }
@keyframes fd-cmd-fade { from { opacity: 0; } }
@keyframes fd-cmd-pop { from { opacity: 0; transform: scale(0.97) translateY(-4px); } }
.fd-cmd-pal { position: relative; display: flex; flex-direction: column; width: min(760px, 100%); max-height: min(560px, 76vh); margin: 0; padding: 0; border: 1px solid #dcdcd6; border-radius: 16px; background: #fff; box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset, 0 30px 80px -10px rgba(20,22,26,0.35), 0 8px 20px rgba(20,22,26,0.08); overflow: hidden; animation: fd-cmd-pop var(--fd-dur-2) var(--fd-ease-out); }
.fd-cmd-field { flex: none; display: flex; align-items: center; gap: 12px; margin: 0; padding: 0 14px 0 18px; height: 58px; border-bottom: 1px solid var(--fd-cmd-line); color: var(--fd-cmd-soft); }
.fd-cmd-field svg { display: block; flex: none; }
.fd-cmd-field input { flex: 1; min-width: 0; height: 100%; margin: 0; padding: 0; border: 0; outline: 0; background: transparent; font: 400 1.0625rem/1.2 ${sans}; letter-spacing: -0.01em; color: var(--fd-cmd-ink); appearance: none; -webkit-appearance: none; }
.fd-cmd-field input::placeholder { color: #9a9ca2; }
.fd-cmd-esc { margin: 0; padding: 5px 7px; border: 1px solid var(--fd-cmd-line); border-radius: 6px; background: var(--fd-cmd-paper); font: 500 0.6875rem/1 ${mono}; color: var(--fd-cmd-soft); cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-cmd-body { display: grid; grid-template-columns: minmax(0, 1fr) 248px; min-height: 0; flex: 1; }
.fd-cmd-list { position: relative; overflow-y: auto; margin: 0; padding: 6px 8px 10px; overscroll-behavior: contain; }
.fd-cmd-group { margin: 0; padding: 0; }
.fd-cmd-gh { position: sticky; top: -6px; z-index: 1; margin: 0; padding: 12px 10px 6px; background: #fff; font: 500 0.6875rem/1 ${mono}; letter-spacing: 0.06em; text-transform: uppercase; color: #8d9096; }
.fd-cmd-opt { position: relative; display: flex; align-items: center; gap: 11px; margin: 0; padding: 9px 10px; border-radius: 9px; color: var(--fd-cmd-ink); cursor: pointer; }
.fd-cmd-opt[aria-selected="true"] { background: #f1f2ff; }
.fd-cmd-opt[aria-selected="true"]::before { content: ""; position: absolute; left: -8px; top: 9px; bottom: 9px; width: 3px; border-radius: 0 3px 3px 0; background: var(--fd-cmd-accent); }
.fd-cmd-ic { display: grid; place-items: center; flex: none; width: 28px; height: 28px; border: 1px solid var(--fd-cmd-line); border-radius: 7px; background: var(--fd-cmd-paper); color: var(--fd-cmd-soft); }
.fd-cmd-ic svg { display: block; }
.fd-cmd-opt[aria-selected="true"] .fd-cmd-ic { color: var(--fd-cmd-accent); border-color: #cdd3ff; background: #fff; }
.fd-cmd-ini { font: 600 0.6875rem/1 ${sans}; color: var(--fd-cmd-ink); }
.fd-cmd-lab { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 0.9375rem/1.2 ${sans}; color: var(--fd-cmd-ink); }
.fd-cmd-mono { font: 500 0.875rem/1.2 ${mono}; }
.fd-cmd-lab mark { background: none; color: var(--fd-cmd-accent); font-weight: 700; text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 3px; }
.fd-cmd-hint { flex: none; font: 400 0.8125rem/1 ${sans}; color: #8d9096; white-space: nowrap; }
.fd-cmd-keys { display: inline-flex; gap: 3px; flex: none; }
.fd-cmd-enter { display: block; flex: none; color: var(--fd-cmd-accent); opacity: 0; transform: translateX(-4px); transition: opacity var(--fd-dur-1) linear, transform var(--fd-dur-2) var(--fd-ease-out); }
.fd-cmd-opt[aria-selected="true"] .fd-cmd-enter { opacity: 1; transform: none; }
.fd-cmd-empty { margin: 0; padding: 40px 16px; text-align: center; }
.fd-cmd-empty p { margin: 0 0 6px; font: 600 0.9375rem/1.3 ${sans}; color: var(--fd-cmd-ink); }
.fd-cmd-empty span { font: 400 0.8125rem/1.4 ${sans}; color: var(--fd-cmd-soft); }
.fd-cmd-empty code { font: 500 0.8125rem/1 ${mono}; color: var(--fd-cmd-ink); }
.fd-cmd-prev { margin: 0; padding: 18px 18px; border-left: 1px solid var(--fd-cmd-line); background: var(--fd-cmd-paper); overflow: hidden; }
.fd-cmd-pk { display: block; margin: 0 0 6px; font: 500 0.6875rem/1 ${mono}; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fd-cmd-accent); }
.fd-cmd-pt { margin: 0 0 16px; font: 600 1rem/1.3 ${sans}; letter-spacing: -0.01em; color: var(--fd-cmd-ink); word-break: break-word; }
.fd-cmd-spark { display: block; width: 100%; height: 92px; margin: 0 0 14px; border-bottom: 1px solid var(--fd-cmd-line); }
.fd-cmd-pstats { display: grid; gap: 6px; font: 400 0.8125rem/1.3 ${sans}; color: var(--fd-cmd-soft); }
.fd-cmd-pstats b { font: 600 0.875rem/1 ${mono}; color: var(--fd-cmd-ink); }
.fd-cmd-pd { margin: 0; font: 400 0.8125rem/1.5 ${sans}; color: var(--fd-cmd-soft); }
.fd-cmd-foot { flex: none; display: flex; align-items: center; gap: 16px; margin: 0; padding: 10px 16px; border-top: 1px solid var(--fd-cmd-line); background: var(--fd-cmd-paper); font: 400 0.75rem/1 ${sans}; color: var(--fd-cmd-soft); }
.fd-cmd-foot span { display: inline-flex; align-items: center; gap: 4px; }
.fd-cmd-count { margin-left: auto; font-family: ${mono}; }

.fd-cmd-toast { position: fixed; left: 50%; bottom: 24px; z-index: 90; margin: 0; padding: 11px 16px; border-radius: 10px; background: var(--fd-cmd-ink); color: #fff; font: 500 0.875rem/1.2 ${sans}; transform: translateX(-50%); box-shadow: 0 12px 30px rgba(20,22,26,0.3); animation: fd-cmd-toast var(--fd-dur-3) var(--fd-spring); }
@keyframes fd-cmd-toast { from { opacity: 0; transform: translate(-50%, 12px) scale(0.96); } }

@media (max-width: 1180px) { .fd-cmd-search { width: 220px; } .fd-cmd-crumb .fd-cmd-env { display: none; } }
@media (max-width: 980px) {
  .fd-cmd-nav, .fd-cmd-crumb, .fd-cmd-bar > .fd-cmd-invite { display: none; }
  .fd-cmd-burger { display: grid; }
  .fd-cmd-search { width: auto; flex: 1; max-width: 360px; }
}
@media (max-width: 600px) {
  .fd-cmd-bar { padding: 0 14px; gap: 10px; }
  .fd-cmd-search { width: 38px; flex: none; justify-content: center; padding: 0; }
  .fd-cmd-search .fd-cmd-ph, .fd-cmd-search kbd { display: none; }
  .fd-cmd-layer { padding: 8px; }
  .fd-cmd-pal { max-height: calc(100vh - 16px); max-height: calc(100dvh - 16px); }
  .fd-cmd-body { grid-template-columns: 1fr; }
  .fd-cmd-prev, .fd-cmd-hint, .fd-cmd-foot span:nth-child(-n+2) { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-cmd-pal, .fd-cmd-menu, .fd-cmd-toast, .fd-cmd-scrim { animation: none; }
  .fd-cmd-enter { transition: none; }
}
`;

/* ── Demo ─────────────────────────────────────────────────────────────── */

const STEPS = [
  { name: "Viewed bike", v: 48210, pct: 100 },
  { name: "Selected plan", v: 21904, pct: 45.4 },
  { name: "Entered card", v: 12377, pct: 25.7 },
  { name: "payment_failed", v: 312, pct: 0.6, bad: true },
  { name: "bike_unlocked", v: 11208, pct: 23.2 },
];

export function Demo() {
  return (
    <div className="fd-cmd-demo">
      <style>{demoCss}</style>
      <CommandNav />
      <main>
        <div className="fd-cmd-demo-head">
          <div>
            <p className="fd-cmd-demo-k">Funnels / Checkout funnel</p>
            <h1>Checkout funnel</h1>
          </div>
          <p className="fd-cmd-demo-tip">Press <kbd>⌘</kbd><kbd>K</kbd> or <kbd>/</kbd> to jump anywhere</p>
        </div>
        <div className="fd-cmd-demo-kpis">
          <div><span>Conversion</span><b>23.2%</b><em>+1.8 pts</em></div>
          <div><span>Median time to unlock</span><b>2m 41s</b><em>−14s</em></div>
          <div><span>Failed payments</span><b>312</b><em data-bad="">+41</em></div>
          <div><span>Revenue, 30 days</span><b>€184,920</b><em>+6.2%</em></div>
        </div>
        <section className="fd-cmd-demo-funnel" aria-label="Funnel steps">
          {STEPS.map((s, i) => (
            <div key={s.name} className="fd-cmd-demo-step">
              <span className="fd-cmd-demo-n">{i + 1}</span>
              <span className="fd-cmd-demo-name">{s.name}</span>
              <span className="fd-cmd-demo-track"><span style={{ width: `${Math.max(s.pct, 1.2)}%` }} data-bad={s.bad ? "" : undefined} /></span>
              <span className="fd-cmd-demo-v">{s.v.toLocaleString("en-US")}</span>
              <span className="fd-cmd-demo-p">{s.pct}%</span>
            </div>
          ))}
        </section>
        <p className="fd-cmd-demo-note">Last 30 days · 48,210 sessions · Copenhagen, Malmö and Oslo stations · updated 4 minutes ago</p>
      </main>
    </div>
  );
}

const demoCss = `
.fd-cmd-demo { margin: 0; padding: 0; min-height: 140vh; background: #fbfbf9; color: #14161a; font: 400 14px/1.5 ${sans}; }
.fd-cmd-demo *, .fd-cmd-demo *::before, .fd-cmd-demo *::after { box-sizing: border-box; }
.fd-cmd-demo main { display: block; max-width: 1200px; margin: 0 auto; padding: 36px 20px 120px; }
.fd-cmd-demo-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin: 0 0 28px; }
.fd-cmd-demo-k { margin: 0 0 8px; font: 500 0.75rem/1 ${mono}; color: #6a6d74; }
.fd-cmd-demo h1 { margin: 0; font: 650 2.25rem/1.05 ${sans}; letter-spacing: -0.035em; }
.fd-cmd-demo-tip { margin: 0; font: 400 0.8125rem/1 ${sans}; color: #6a6d74; display: flex; align-items: center; gap: 4px; }
.fd-cmd-demo kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border: 1px solid #e6e6e1; border-bottom-width: 2px; border-radius: 5px; background: #fff; font: 500 0.6875rem/1 ${mono}; color: #14161a; }
.fd-cmd-demo-kpis { display: grid; grid-template-columns: repeat(4, 1fr); margin: 0 0 28px; border: 1px solid #e6e6e1; border-radius: 14px; background: #fff; }
.fd-cmd-demo-kpis div { display: grid; gap: 6px; padding: 18px 20px; border-left: 1px solid #e6e6e1; }
.fd-cmd-demo-kpis div:first-child { border-left: 0; }
.fd-cmd-demo-kpis span { font: 400 0.8125rem/1 ${sans}; color: #6a6d74; }
.fd-cmd-demo-kpis b { font: 600 1.625rem/1 ${sans}; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.fd-cmd-demo-kpis em { font: 500 0.75rem/1 ${mono}; font-style: normal; color: #1d6b3a; }
.fd-cmd-demo-kpis em[data-bad] { color: #c2410c; }
.fd-cmd-demo-funnel { margin: 0; padding: 8px 20px; border: 1px solid #e6e6e1; border-radius: 14px; background: #fff; }
.fd-cmd-demo-step { display: grid; grid-template-columns: 24px 160px 1fr 80px 56px; align-items: center; gap: 14px; padding: 14px 0; border-top: 1px solid #f0f0ec; }
.fd-cmd-demo-step:first-child { border-top: 0; }
.fd-cmd-demo-n { font: 500 0.75rem/1 ${mono}; color: #8d9096; }
.fd-cmd-demo-name { font: 500 0.875rem/1.2 ${mono}; }
.fd-cmd-demo-track { display: block; height: 28px; border-radius: 6px; background: #f4f4f1; overflow: hidden; }
.fd-cmd-demo-track span { display: block; height: 100%; border-radius: 6px; background: #2a44ff; }
.fd-cmd-demo-track span[data-bad] { background: #ea580c; }
.fd-cmd-demo-v, .fd-cmd-demo-p { font: 500 0.875rem/1 ${mono}; text-align: right; font-variant-numeric: tabular-nums; }
.fd-cmd-demo-p { color: #6a6d74; }
.fd-cmd-demo-note { margin: 14px 0 0; font: 400 0.8125rem/1.4 ${sans}; color: #6a6d74; }
@media (max-width: 760px) {
  .fd-cmd-demo main { padding: 24px 14px 100px; }
  .fd-cmd-demo-tip { display: none; }
  .fd-cmd-demo-kpis { grid-template-columns: 1fr 1fr; }
  .fd-cmd-demo-kpis div:nth-child(3) { border-left: 0; }
  .fd-cmd-demo-kpis div:nth-child(n+3) { border-top: 1px solid #e6e6e1; }
  .fd-cmd-demo-step { grid-template-columns: 1fr 64px 48px; gap: 8px 10px; }
  .fd-cmd-demo-n { display: none; }
  .fd-cmd-demo-track { grid-column: 1 / -1; grid-row: 2; height: 18px; }
}
`;
