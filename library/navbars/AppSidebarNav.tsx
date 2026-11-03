/**
 * AppSidebarNav, a fintech dashboard sidebar: workspace switcher dropdown,
 * nested groups that expand smoothly, badges, an active indicator that
 * slides between items (and onto a collapsed group's parent), and a collapse
 * button that folds the sidebar into a 72px icon rail with tooltips. Icons
 * are drawn on a 20px grid with a consistent 1.5px stroke.
 *
 * Props: workspaces, workspaceId, items (id, label, icon, badge, children),
 * footer items, user, activeId / defaultActiveId, onNavigate, collapsed /
 * defaultCollapsed, onCollapsedChange.
 * CSS vars: --fd-asn-bg, --fd-asn-ink, --fd-asn-brass.
 *
 * Keyboard: ↑ ↓ move between visible items, → opens a group (or moves into
 * it), ← closes it (or moves to its parent), Home/End jump. The workspace
 * menu supports ↑ ↓, Enter and Escape. Below 860px the sidebar becomes a
 * drawer opened from a top bar; Escape closes it and focus returns.
 * Browser support: all evergreen browsers (grid-template-rows animation for
 * groups: Chrome 107+, Safari 16+, Firefox 66+; older browsers snap).
 * Accessibility: <nav aria-label>, aria-current="page", aria-expanded on
 * groups and the switcher, menuitemradio for workspaces, tooltips mirror
 * visible labels in rail mode (the label stays in the accessible name).
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

export type AsnIcon = "home" | "accounts" | "payments" | "cards" | "invoices" | "treasury" | "reports" | "settings" | "help";
export interface AsnItem { id: string; label: string; icon?: AsnIcon; badge?: string | number; badgeTone?: "alert" | "quiet"; meta?: string; children?: AsnItem[] }
export interface AsnWorkspace { id: string; name: string; meta: string; mono: string }
export interface AppSidebarNavProps {
  workspaces?: AsnWorkspace[];
  workspaceId?: string;
  onWorkspaceChange?: (id: string) => void;
  items?: AsnItem[];
  footer?: AsnItem[];
  user?: { name: string; role: string; src: string };
  activeId?: string;
  defaultActiveId?: string;
  onNavigate?: (id: string) => void;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (c: boolean) => void;
  className?: string;
}

const WORKSPACES: AsnWorkspace[] = [
  { id: "nh", name: "Nordhavn Ceramics ApS", meta: "DKK · 3 accounts", mono: "NC" },
  { id: "ls", name: "Lindqvist Studio AB", meta: "SEK · 2 accounts", mono: "LS" },
  { id: "hb", name: "Halden Bikes AS", meta: "NOK · 5 accounts", mono: "HB" },
];

const ITEMS: AsnItem[] = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "accounts", label: "Accounts", icon: "accounts", children: [
    { id: "acc-op", label: "Operating", meta: "1.82M" },
    { id: "acc-pay", label: "Payroll", meta: "412K" },
    { id: "acc-eur", label: "EUR reserve", meta: "€33K" },
  ] },
  { id: "payments", label: "Payments", icon: "payments", badge: 3, badgeTone: "alert", children: [
    { id: "pay-out", label: "Outgoing" },
    { id: "pay-appr", label: "Approvals", badge: 3, badgeTone: "alert" },
    { id: "pay-sched", label: "Scheduled", badge: 8, badgeTone: "quiet" },
  ] },
  { id: "cards", label: "Cards", icon: "cards", badge: "New", badgeTone: "quiet" },
  { id: "invoices", label: "Invoices", icon: "invoices", badge: 12, badgeTone: "quiet" },
  { id: "treasury", label: "Treasury", icon: "treasury", children: [
    { id: "tr-fx", label: "FX conversions" },
    { id: "tr-dep", label: "Deposits, 3.1%" },
  ] },
  { id: "reports", label: "Reports", icon: "reports" },
];

const FOOTER: AsnItem[] = [
  { id: "settings", label: "Settings", icon: "settings" },
  { id: "help", label: "Help & support", icon: "help" },
];

function Icon({ name }: { name: AsnIcon }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const d: Record<AsnIcon, ReactNode> = {
    home: <><path d="M3.5 8.5 10 3.5l6.5 5V16a.5.5 0 0 1-.5.5h-3.5v-5h-5v5H4a.5.5 0 0 1-.5-.5z" {...p} /></>,
    accounts: <><path d="M3 7.5 10 3.5l7 4M4 16.5h12M5.5 8.5v6M8.5 8.5v6M11.5 8.5v6M14.5 8.5v6" {...p} /></>,
    payments: <><path d="M3.5 7h12M12.5 4l3 3-3 3M16.5 13h-12M7.5 10l-3 3 3 3" {...p} /></>,
    cards: <><rect x="2.5" y="4.5" width="15" height="11" rx="2" {...p} /><path d="M2.5 8.5h15M5.5 12.5h3" {...p} /></>,
    invoices: <><path d="M5 2.5h7l3.5 3.5v11a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z" {...p} /><path d="M12 2.5V6h3.5M7.5 10h5M7.5 13h3.5" {...p} /></>,
    treasury: <><circle cx="10" cy="10" r="7" {...p} /><path d="M3 10h14M10 3c-2 2-2.8 4.4-2.8 7s.8 5 2.8 7c2-2 2.8-4.4 2.8-7S12 5 10 3z" {...p} /></>,
    reports: <><path d="M3.5 16.5h13M6 13.5v-3M10 13.5V6M14 13.5V9" {...p} /></>,
    settings: <><path d="M3.5 6h6M13.5 6h3M3.5 14h3M10.5 14h6" {...p} /><circle cx="11.5" cy="6" r="2" {...p} /><circle cx="8.5" cy="14" r="2" {...p} /></>,
    help: <><circle cx="10" cy="10" r="7" {...p} /><path d="M8 8.2a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.4" {...p} /><circle cx="10" cy="13.9" r=".2" {...p} /></>,
  };
  return <svg className="fd-asn-ico" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">{d[name]}</svg>;
}

const Chevron = ({ cls = "" }: { cls?: string }) => (
  <svg className={cls} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function AppSidebarNav({
  workspaces = WORKSPACES,
  workspaceId,
  onWorkspaceChange,
  items = ITEMS,
  footer = FOOTER,
  user = { name: "Søren Holm", role: "Finance lead", src: "/img/people/p7.webp" },
  activeId,
  defaultActiveId = "pay-appr",
  onNavigate,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  className,
}: AppSidebarNavProps) {
  const uid = useId();
  const [activeState, setActive] = useState(defaultActiveId);
  const active = activeId ?? activeState;
  const [railState, setRail] = useState(defaultCollapsed);
  const rail = collapsedProp ?? railState;
  const [ws, setWs] = useState(workspaceId ?? workspaces[0].id);
  const [wsOpen, setWsOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    items.forEach((i) => i.children?.some((c) => c.id === defaultActiveId) && (o[i.id] = true));
    return o;
  });
  const [tip, setTip] = useState<{ label: string; y: number; badge?: string | number } | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const wsBtn = useRef<HTMLButtonElement>(null);
  const wsMenu = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const burger = useRef<HTMLButtonElement>(null);

  const workspace = workspaces.find((w) => w.id === ws) ?? workspaces[0];
  const parentOf = (id: string) => items.find((i) => i.children?.some((c) => c.id === id));

  // Active indicator: sits on the active row, or on its parent when collapsed.
  const place = useCallback(() => {
    const nav = navRef.current, ind = indRef.current;
    if (!nav || !ind) return;
    const par = parentOf(active);
    const targetId = par && (!open[par.id] || rail) ? par.id : active;
    const el = nav.querySelector<HTMLElement>(`[data-id="${targetId}"]`);
    if (!el) {
      ind.style.opacity = "0";
      return;
    }
    const n = nav.getBoundingClientRect(), r = el.getBoundingClientRect();
    ind.style.opacity = "1";
    ind.style.transform = `translateY(${r.top - n.top + nav.scrollTop}px)`;
    ind.style.height = `${r.height}px`;
    if (par && targetId === active) ind.dataset.child = "";
    else delete ind.dataset.child;
  }, [active, open, rail]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    place();
    // Follow groups while they animate open/closed.
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      place();
      if (performance.now() - t0 < 460) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(place);
    if (navRef.current) ro.observe(navRef.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [place]);

  const go = (id: string) => {
    setActive(id);
    onNavigate?.(id);
    setDrawer(false);
  };
  const toggleRail = () => {
    const n = !rail;
    setRail(n);
    onCollapsedChange?.(n);
    setTip(null);
    setWsOpen(false);
  };

  // "[" toggles the rail, like most desktop apps.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!matchMedia("(min-width: 861px)").matches) return;
      setRail((r) => {
        onCollapsedChange?.(!r);
        return !r;
      });
      setTip(null);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [onCollapsedChange]);

  // Workspace menu.
  useEffect(() => {
    if (!wsOpen) return;
    const m = wsMenu.current;
    const sel = m?.querySelector<HTMLElement>('[aria-checked="true"]') ?? m?.querySelector<HTMLElement>("[role^=menuitem]");
    sel?.focus();
    const out = (e: PointerEvent) => {
      if (!m?.contains(e.target as Node) && !wsBtn.current?.contains(e.target as Node)) setWsOpen(false);
    };
    document.addEventListener("pointerdown", out);
    return () => document.removeEventListener("pointerdown", out);
  }, [wsOpen]);

  const onWsKey = (e: ReactKeyboardEvent) => {
    const list = Array.from(wsMenu.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? []);
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); list[list.length - 1]?.focus(); }
    else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); setWsOpen(false); wsBtn.current?.focus(); }
  };
  const pickWs = (id: string) => {
    setWs(id);
    onWorkspaceChange?.(id);
    setWsOpen(false);
    wsBtn.current?.focus();
  };

  // Tree-style arrow navigation.
  const onNavKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    const root = asideRef.current;
    if (!root) return;
    const list = Array.from(root.querySelectorAll<HTMLElement>("[data-nav]")).filter((el) => el.offsetParent !== null && !el.closest("[inert]"));
    const cur = document.activeElement as HTMLElement;
    const i = list.indexOf(cur);
    if (i < 0) return;
    const id = cur.dataset.id ?? "";
    const group = items.find((x) => x.id === id && x.children);
    if (e.key === "ArrowDown") { e.preventDefault(); list[Math.min(list.length - 1, i + 1)].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); list[Math.max(0, i - 1)].focus(); }
    else if (e.key === "Home") { e.preventDefault(); list[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); list[list.length - 1].focus(); }
    else if (e.key === "ArrowRight" && group && !rail) {
      e.preventDefault();
      if (!open[id]) setOpen((o) => ({ ...o, [id]: true }));
      else list[i + 1]?.focus();
    } else if (e.key === "ArrowLeft" && !rail) {
      e.preventDefault();
      if (group && open[id]) setOpen((o) => ({ ...o, [id]: false }));
      else {
        const par = parentOf(id);
        if (par) root.querySelector<HTMLElement>(`[data-id="${par.id}"]`)?.focus();
      }
    }
  };

  // Mobile drawer.
  useEffect(() => {
    if (!drawer) return;
    const a = asideRef.current;
    window.setTimeout(() => a?.querySelector<HTMLElement>("[data-nav]")?.focus(), 40);
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !wsOpen) {
        setDrawer(false);
        burger.current?.focus();
      }
      if (e.key === "Tab" && a) {
        const f = Array.from(a.querySelectorAll<HTMLElement>("button,a")).filter((el) => el.offsetParent !== null && !el.closest("[inert]"));
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    const mq = matchMedia("(min-width: 861px)");
    const onMq = () => mq.matches && setDrawer(false);
    document.addEventListener("keydown", on);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", on);
      mq.removeEventListener("change", onMq);
    };
  }, [drawer, wsOpen]);

  const showTip = (el: HTMLElement, it: AsnItem) => {
    if (!rail || !asideRef.current) return;
    const a = asideRef.current.getBoundingClientRect(), r = el.getBoundingClientRect();
    setTip({ label: it.label, y: r.top - a.top + r.height / 2, badge: it.badge });
  };

  const row = (it: AsnItem, depth: number) => {
    const isGroup = !!it.children?.length;
    const isOpen = !!open[it.id] && !rail;
    const childActive = it.children?.some((c) => c.id === active);
    const current = it.id === active;
    return (
      <li key={it.id} className="fd-asn-li">
        <button
          type="button"
          data-nav=""
          data-id={it.id}
          className={`fd-asn-row${depth ? " fd-asn-sub" : ""}`}
          aria-current={current ? "page" : undefined}
          aria-expanded={isGroup && !rail ? isOpen : undefined}
          aria-controls={isGroup ? `${uid}-${it.id}` : undefined}
          data-on={current || (childActive && (!isOpen || rail)) ? "" : undefined}
          data-within={childActive ? "" : undefined}
          onClick={() => {
            if (isGroup) {
              if (rail) go(it.children!.find((c) => c.id === active)?.id ?? it.children![0].id);
              else setOpen((o) => ({ ...o, [it.id]: !o[it.id] }));
            } else go(it.id);
          }}
          onPointerEnter={(e) => showTip(e.currentTarget, it)}
          onPointerLeave={() => setTip(null)}
          onFocus={(e) => showTip(e.currentTarget, it)}
          onBlur={() => setTip(null)}
        >
          {depth === 0 && it.icon && <Icon name={it.icon} />}
          {depth > 0 && <span className="fd-asn-tick" aria-hidden="true" />}
          <span className="fd-asn-label">{it.label}</span>
          {it.meta && <span className="fd-asn-meta">{it.meta}</span>}
          {it.badge !== undefined && !(isGroup && isOpen) && (
            <span className="fd-asn-badge" data-tone={it.badgeTone ?? "quiet"}>
              {it.badge}
              {typeof it.badge === "number" && <span className="fd-asn-sr"> {it.badgeTone === "alert" ? "need attention" : "items"}</span>}
            </span>
          )}
          {isGroup && <Chevron cls="fd-asn-chev" />}
        </button>
        {isGroup && (
          <div id={`${uid}-${it.id}`} className="fd-asn-group" data-open={isOpen ? "" : undefined} inert={!isOpen ? true : undefined}>
            <ul className="fd-asn-ul">{it.children!.map((c) => row(c, depth + 1))}</ul>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className={`fd-asn${className ? " " + className : ""}`} data-rail={rail ? "" : undefined} data-drawer={drawer ? "" : undefined}>
      <style>{css}</style>
      <div className="fd-asn-top">
        <button ref={burger} type="button" className="fd-asn-burger" aria-label="Open navigation" aria-expanded={drawer} aria-controls={`${uid}-side`} onClick={() => setDrawer(true)}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 6h13M3.5 10h13M3.5 14h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        <span className="fd-asn-mono" aria-hidden="true">{workspace.mono}</span>
        <span className="fd-asn-topname">{workspace.name}</span>
        <img className="fd-asn-av" src={user.src} alt={user.name} width={32} height={32} />
      </div>
      <div className="fd-asn-scrim" aria-hidden="true" onClick={() => setDrawer(false)} />

      <aside ref={asideRef} id={`${uid}-side`} className="fd-asn-side" aria-label="Sidebar" onKeyDown={onNavKey}>
        <div className="fd-asn-head">
          <button
            ref={wsBtn}
            type="button"
            className="fd-asn-ws"
            aria-haspopup="menu"
            aria-expanded={wsOpen}
            aria-controls={`${uid}-ws`}
            aria-label={`Workspace: ${workspace.name}. Switch workspace`}
            onClick={() => setWsOpen((o) => !o)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && !wsOpen) { e.preventDefault(); e.stopPropagation(); setWsOpen(true); }
            }}
          >
            <span className="fd-asn-mono" aria-hidden="true">{workspace.mono}</span>
            <span className="fd-asn-wst">
              <b>{workspace.name}</b>
              <small>{workspace.meta}</small>
            </span>
            <svg className="fd-asn-updown" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 6l3-3 3 3M5 10l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {wsOpen && (
            <div ref={wsMenu} id={`${uid}-ws`} className="fd-asn-wsmenu" role="menu" aria-label="Workspaces" onKeyDown={onWsKey}>
              <p className="fd-asn-wsh">Workspaces</p>
              {workspaces.map((w) => (
                <button key={w.id} type="button" role="menuitemradio" aria-checked={w.id === ws} tabIndex={-1} className="fd-asn-wsitem" onClick={() => pickWs(w.id)}>
                  <span className="fd-asn-mono" aria-hidden="true">{w.mono}</span>
                  <span className="fd-asn-wst"><b>{w.name}</b><small>{w.meta}</small></span>
                  {w.id === ws && <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
              ))}
              <span className="fd-asn-wssep" role="separator" />
              <button type="button" role="menuitem" tabIndex={-1} className="fd-asn-wsitem fd-asn-wsadd" onClick={() => setWsOpen(false)}>
                <span className="fd-asn-plus" aria-hidden="true">+</span>
                <span className="fd-asn-wst"><b>Add a company</b><small>Takes about 6 minutes with MitID</small></span>
              </button>
            </div>
          )}
        </div>

        <nav className="fd-asn-nav" aria-label="Main">
          <div ref={navRef} className="fd-asn-scroll">
            <span ref={indRef} className="fd-asn-ind" aria-hidden="true" />
            <ul className="fd-asn-ul">{items.map((it) => row(it, 0))}</ul>
          </div>
        </nav>

        <div className="fd-asn-foot">
          <ul className="fd-asn-ul">{footer.map((it) => row(it, 0))}</ul>
          <div className="fd-asn-user">
            <img src={user.src} alt="" width={32} height={32} />
            <span className="fd-asn-wst"><b>{user.name}</b><small>{user.role}</small></span>
          </div>
          <button type="button" className="fd-asn-collapse" data-nav="" data-id="__collapse" aria-pressed={rail} aria-label={rail ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleRail}
            onPointerEnter={(e) => showTip(e.currentTarget, { id: "c", label: "Expand sidebar" })} onPointerLeave={() => setTip(null)}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M7.5 3.5v13" stroke="currentColor" strokeWidth="1.5" /><path className="fd-asn-carr" d="M13 8l-2 2 2 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="fd-asn-label">Collapse</span>
            <kbd>[</kbd>
          </button>
        </div>
        {tip && rail && (
          <span className="fd-asn-tip" role="tooltip" style={{ top: tip.y }}>
            {tip.label}
            {tip.badge !== undefined && <i>{tip.badge}</i>}
          </span>
        )}
      </aside>
    </div>
  );
}

const sans = `ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif`;
const mono = `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`;

const css = `
.fd-asn {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-asn-bg: #10241c;
  --fd-asn-bg2: #163026;
  --fd-asn-line: rgba(237,231,214,0.1);
  --fd-asn-ink: #ede7d6;
  --fd-asn-dim: #9aab9f;
  --fd-asn-brass: #c9a35c;
  --fd-asn-w: 264px;
  position: sticky; top: 0; z-index: 40; display: block; height: 100vh; height: 100dvh; margin: 0; padding: 0;
  font: 400 14px/1.4 ${sans};
  color: var(--fd-asn-ink); background: transparent;
}
.fd-asn[data-rail] { --fd-asn-w: 72px; }
.fd-asn, .fd-asn *, .fd-asn *::before, .fd-asn *::after { box-sizing: border-box; }
.fd-asn button:focus-visible { outline: 2px solid color-mix(in srgb, var(--fd-asn-brass) 80%, transparent); outline-offset: -2px; }
.fd-asn-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.fd-asn-ul { margin: 0; padding: 0; list-style: none; }
.fd-asn-li { margin: 0; padding: 0; }

.fd-asn-side { position: relative; display: flex; flex-direction: column; width: var(--fd-asn-w); height: 100%; margin: 0; padding: 12px 12px 12px; background: var(--fd-asn-bg); border-right: 1px solid #0b1a14; transition: width var(--fd-dur-3) var(--fd-ease-in-out); }
.fd-asn-head { position: relative; margin: 0 0 14px; padding: 0; }
.fd-asn-ws { display: flex; align-items: center; gap: 10px; width: 100%; margin: 0; padding: 6px; border: 1px solid transparent; border-radius: 12px; background: none; color: var(--fd-asn-ink); text-align: left; cursor: pointer; appearance: none; -webkit-appearance: none; transition: background var(--fd-dur-1) linear, border-color var(--fd-dur-1) linear; }
.fd-asn-ws:hover, .fd-asn-ws[aria-expanded="true"] { background: var(--fd-asn-bg2); border-color: var(--fd-asn-line); }
.fd-asn-mono { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 9px; font: 700 0.75rem/1 ${sans}; letter-spacing: 0.02em; color: #10241c; background: var(--fd-asn-brass); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.15); }
.fd-asn-wst { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; overflow: hidden; }
.fd-asn-wst b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 0.875rem/1.15 ${sans}; color: var(--fd-asn-ink); }
.fd-asn-wst small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 400 0.75rem/1.1 ${mono}; color: var(--fd-asn-dim); }
.fd-asn-updown { display: block; flex: none; color: var(--fd-asn-dim); }
.fd-asn-wsmenu { position: absolute; left: 0; top: calc(100% + 6px); z-index: 5; width: 288px; margin: 0; padding: 6px; border: 1px solid rgba(237,231,214,0.14); border-radius: 14px; background: #1a362b; box-shadow: 0 24px 50px rgba(3,10,7,0.5); animation: fd-asn-pop var(--fd-dur-2) var(--fd-ease-out); transform-origin: top left; }
@keyframes fd-asn-pop { from { opacity: 0; transform: scale(0.97) translateY(-4px); } }
.fd-asn-wsh { margin: 0; padding: 8px 8px 6px; font: 500 0.6875rem/1 ${mono}; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fd-asn-dim); }
.fd-asn-wsitem { display: flex; align-items: center; gap: 10px; width: 100%; margin: 0; padding: 7px 8px; border: 0; border-radius: 9px; background: none; color: var(--fd-asn-ink); text-align: left; cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-asn-wsitem:hover, .fd-asn-wsitem:focus-visible { background: rgba(237,231,214,0.07); outline: none; }
.fd-asn-wsitem svg { display: block; flex: none; color: var(--fd-asn-brass); }
.fd-asn-wsitem .fd-asn-mono { width: 30px; height: 30px; border-radius: 8px; }
.fd-asn-wsitem:not([aria-checked="true"]) .fd-asn-mono { background: #2b4a3d; color: var(--fd-asn-ink); box-shadow: none; }
.fd-asn-wssep { display: block; height: 1px; margin: 6px 4px; background: var(--fd-asn-line); }
.fd-asn-plus { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border: 1px dashed rgba(237,231,214,0.3); border-radius: 8px; font: 400 1rem/1 ${sans}; color: var(--fd-asn-dim); }

.fd-asn-nav { position: relative; flex: 1; min-height: 0; margin: 0; padding: 0; }
.fd-asn-scroll { position: relative; height: 100%; overflow-y: auto; overflow-x: hidden; margin: 0 -4px; padding: 0 4px; scrollbar-width: thin; scrollbar-color: #2b4a3d transparent; }
.fd-asn-ind { position: absolute; left: 4px; right: 4px; top: 0; height: 36px; border-radius: 10px; background: var(--fd-asn-bg2); box-shadow: inset 0 0 0 1px rgba(237,231,214,0.08); opacity: 0; pointer-events: none; transition: transform var(--fd-dur-3) var(--fd-spring), height var(--fd-dur-2) var(--fd-ease-out), opacity var(--fd-dur-1) linear; }
.fd-asn-ind::before { content: ""; position: absolute; left: -4px; top: 9px; bottom: 9px; width: 3px; border-radius: 0 3px 3px 0; background: var(--fd-asn-brass); }
.fd-asn-ind[data-child] { background: transparent; box-shadow: none; }
.fd-asn-ind[data-child]::before { left: 26px; top: 10px; bottom: 10px; width: 2px; border-radius: 2px; }

.fd-asn-row { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; width: 100%; height: 36px; margin: 0 0 2px; padding: 0 10px; border: 0; border-radius: 10px; background: none; font: 500 0.875rem/1 ${sans}; color: #c3cdc4; text-align: left; white-space: nowrap; cursor: pointer; appearance: none; -webkit-appearance: none; transition: color var(--fd-dur-1) linear, background var(--fd-dur-1) linear; }
.fd-asn-row:hover { color: var(--fd-asn-ink); background: rgba(237,231,214,0.04); }
.fd-asn-row[data-on] { color: var(--fd-asn-ink); }
.fd-asn-row[data-on] .fd-asn-ico { color: var(--fd-asn-brass); }
.fd-asn-ico { display: block; flex: none; color: var(--fd-asn-dim); transition: color var(--fd-dur-2) linear; }
.fd-asn-row:hover .fd-asn-ico { color: var(--fd-asn-ink); }
.fd-asn-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; transition: opacity var(--fd-dur-2) linear; }
.fd-asn-sub { height: 32px; padding-left: 42px; font-weight: 400; font-size: 0.8125rem; }
.fd-asn-tick { position: absolute; left: 20px; top: -2px; bottom: -2px; width: 1px; background: rgba(237,231,214,0.12); }
.fd-asn-sub[aria-current="page"] { color: var(--fd-asn-ink); font-weight: 500; }
.fd-asn-meta { font: 400 0.75rem/1 ${mono}; color: var(--fd-asn-dim); }
.fd-asn-badge { display: inline-grid; place-items: center; min-width: 20px; height: 20px; margin: 0; padding: 0 6px; border-radius: 9999px; font: 600 0.6875rem/1 ${mono}; color: var(--fd-asn-ink); background: rgba(237,231,214,0.1); }
.fd-asn-badge[data-tone="alert"] { color: #10241c; background: var(--fd-asn-brass); }
.fd-asn-chev { display: block; flex: none; color: var(--fd-asn-dim); transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-asn-row[aria-expanded="true"] .fd-asn-chev { transform: rotate(90deg); }
.fd-asn-group { display: grid; grid-template-rows: 0fr; margin: 0; padding: 0; transition: grid-template-rows var(--fd-dur-3) var(--fd-ease-in-out), opacity var(--fd-dur-2) linear; opacity: 0; }
.fd-asn-group[data-open] { grid-template-rows: 1fr; opacity: 1; }
.fd-asn-group > .fd-asn-ul { min-height: 0; overflow: hidden; }

.fd-asn-foot { margin: 8px 0 0; padding: 10px 0 0; border-top: 1px solid var(--fd-asn-line); }
.fd-asn-user { display: flex; align-items: center; gap: 10px; margin: 6px 0 4px; padding: 6px 8px; border-radius: 10px; }
.fd-asn-user img { display: block; flex: none; width: 32px; height: 32px; border-radius: 9999px; object-fit: cover; background: #2b4a3d; }
.fd-asn-collapse { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; height: 36px; margin: 0; padding: 0 10px; border: 0; border-radius: 10px; background: none; font: 500 0.8125rem/1 ${sans}; color: var(--fd-asn-dim); cursor: pointer; appearance: none; -webkit-appearance: none; white-space: nowrap; }
.fd-asn-collapse:hover { color: var(--fd-asn-ink); background: rgba(237,231,214,0.04); }
.fd-asn-collapse svg { display: block; flex: none; }
.fd-asn-carr { transition: transform var(--fd-dur-3) var(--fd-spring); transform-origin: 12px 10px; }
.fd-asn[data-rail] .fd-asn-carr { transform: scaleX(-1); }
.fd-asn-collapse kbd { margin: 0; padding: 2px 6px; border: 1px solid var(--fd-asn-line); border-radius: 5px; background: none; font: 500 0.6875rem/1.2 ${mono}; color: var(--fd-asn-dim); }

.fd-asn[data-rail] .fd-asn-label, .fd-asn[data-rail] .fd-asn-meta, .fd-asn[data-rail] .fd-asn-chev, .fd-asn[data-rail] .fd-asn-wst, .fd-asn[data-rail] .fd-asn-updown, .fd-asn[data-rail] .fd-asn-collapse kbd { opacity: 0; width: 0; flex: 0 0 0; overflow: hidden; pointer-events: none; }
.fd-asn[data-rail] .fd-asn-row { gap: 0; padding: 0 14px; }
.fd-asn[data-rail] .fd-asn-badge { position: absolute; right: 6px; top: 3px; min-width: 8px; height: 8px; padding: 0; font-size: 0; }
.fd-asn[data-rail] .fd-asn-badge[data-tone="quiet"] { display: none; }
.fd-asn[data-rail] .fd-asn-ws { gap: 0; padding: 6px 4px; }
.fd-asn[data-rail] .fd-asn-user { padding: 6px 8px; gap: 0; }
.fd-asn[data-rail] .fd-asn-collapse { gap: 0; padding: 0 14px; }
.fd-asn[data-rail] .fd-asn-wsmenu { left: 0; }
.fd-asn-tip { position: absolute; left: calc(100% + 8px); z-index: 6; display: inline-flex; align-items: center; gap: 8px; margin: 0; padding: 7px 10px; border-radius: 8px; background: #ede7d6; color: #10241c; font: 600 0.8125rem/1 ${sans}; white-space: nowrap; transform: translateY(-50%); pointer-events: none; box-shadow: 0 8px 20px rgba(3,10,7,0.25); animation: fd-asn-tip var(--fd-dur-2) var(--fd-ease-out); }
.fd-asn-tip::before { content: ""; position: absolute; left: -4px; top: 50%; width: 8px; height: 8px; margin-top: -4px; background: inherit; transform: rotate(45deg); }
.fd-asn-tip i { font: 600 0.6875rem/1 ${mono}; font-style: normal; padding: 3px 6px; border-radius: 9999px; background: #10241c; color: #ede7d6; }
@keyframes fd-asn-tip { from { opacity: 0; transform: translate(-4px, -50%); } }

.fd-asn-top, .fd-asn-scrim { display: none; }
.fd-asn-burger { display: grid; place-items: center; width: 40px; height: 40px; margin: 0 0 0 -8px; padding: 0; border: 0; border-radius: 10px; background: none; color: var(--fd-asn-ink); cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-asn-burger svg { display: block; }
.fd-asn-topname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 0.9375rem/1 ${sans}; color: var(--fd-asn-ink); }
.fd-asn-av { display: block; width: 32px; height: 32px; border-radius: 9999px; object-fit: cover; }

@media (max-width: 860px) {
  .fd-asn { --fd-asn-w: min(300px, 86vw); height: auto; position: sticky; top: 0; z-index: 40; }
  .fd-asn-top { display: flex; align-items: center; gap: 10px; height: 56px; margin: 0; padding: 0 16px; background: var(--fd-asn-bg); }
  .fd-asn-top .fd-asn-mono { width: 28px; height: 28px; border-radius: 7px; font-size: 0.6875rem; }
  .fd-asn-side { position: fixed; left: 0; top: 0; bottom: 0; z-index: 2; height: 100vh; height: 100dvh; transform: translateX(-102%); transition: transform var(--fd-dur-3) var(--fd-ease-out); visibility: hidden; }
  .fd-asn[data-drawer] .fd-asn-side { transform: none; visibility: visible; box-shadow: 20px 0 60px rgba(3,10,7,0.35); }
  .fd-asn-scrim { display: block; position: fixed; inset: 0; z-index: 1; background: rgba(6,14,10,0.5); opacity: 0; pointer-events: none; transition: opacity var(--fd-dur-3) linear; }
  .fd-asn[data-drawer] .fd-asn-scrim { opacity: 1; pointer-events: auto; }
  .fd-asn-collapse { display: none; }
  .fd-asn-row { height: 42px; }
  .fd-asn-sub { height: 38px; }
  .fd-asn-wsmenu { width: 100%; }
}
@media (min-width: 861px) { .fd-asn[data-rail] .fd-asn-side { overflow: visible; } }
@media (prefers-reduced-motion: reduce) {
  .fd-asn-side, .fd-asn-ind, .fd-asn-group, .fd-asn-chev, .fd-asn-carr, .fd-asn-scrim { transition: none; }
  .fd-asn-wsmenu, .fd-asn-tip { animation: none; }
}
@media (prefers-contrast: more) { .fd-asn { --fd-asn-dim: #c9d3cb; --fd-asn-line: rgba(237,231,214,0.35); } }
`;

/* ── Demo ─────────────────────────────────────────────────────────────── */

const FLOW = [
  { m: "Jun", i: 62, o: 48 }, { m: "Jul", i: 71, o: 55 }, { m: "Aug", i: 54, o: 60 }, { m: "Sep", i: 80, o: 52 },
  { m: "Oct", i: 88, o: 61 }, { m: "Nov", i: 46, o: 30 },
];
const APPROVALS = [
  { who: "Kähler Glasur A/S", what: "Glaze order 0418", amt: "DKK 48,200.00", due: "Today" },
  { who: "DSV Road", what: "Freight, week 44", amt: "DKK 12,936.50", due: "Thu" },
  { who: "Ørsted Erhverv", what: "Kiln electricity, October", amt: "DKK 31,402.19", due: "Fri" },
];

export function Demo() {
  return (
    <div className="fd-asn-demo">
      <style>{demoCss}</style>
      <AppSidebarNav />
      <main className="fd-asn-demo-main">
        <header className="fd-asn-demo-head">
          <div>
            <p className="fd-asn-demo-k">Payments / Approvals</p>
            <h1>3 payments need your approval</h1>
          </div>
          <button type="button" className="fd-asn-demo-btn">Approve all · DKK 92,538.69</button>
        </header>
        <section className="fd-asn-demo-grid">
          <div className="fd-asn-demo-card fd-asn-demo-bal">
            <span>Total balance, all accounts</span>
            <b>DKK 2,481,930<small>.42</small></b>
            <em>+ DKK 184,220 since 1 October</em>
            <div className="fd-asn-demo-bars" aria-label="Money in and out, last six months">
              {FLOW.map((f) => (
                <div key={f.m}>
                  <i style={{ height: `${f.i}%` }} />
                  <i style={{ height: `${f.o}%` }} data-out="" />
                  <span>{f.m}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="fd-asn-demo-card">
            <span>Awaiting approval</span>
            <ul>
              {APPROVALS.map((a) => (
                <li key={a.what}>
                  <div><b>{a.who}</b><small>{a.what}</small></div>
                  <div><b>{a.amt}</b><small>{a.due}</small></div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

const demoCss = `
.fd-asn-demo { display: flex; min-height: 100vh; margin: 0; padding: 0; background: #f3efe5; color: #10241c; font: 400 14px/1.45 ${sans}; }
.fd-asn-demo *, .fd-asn-demo *::before, .fd-asn-demo *::after { box-sizing: border-box; }
.fd-asn-demo-main { flex: 1; min-width: 0; margin: 0; padding: 36px 40px 80px; }
.fd-asn-demo-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin: 0 0 28px; }
.fd-asn-demo-k { margin: 0 0 8px; font: 500 0.75rem/1 ${mono}; color: #5b6b61; }
.fd-asn-demo h1 { margin: 0; font: 400 2.25rem/1.05 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; letter-spacing: -0.025em; color: #10241c; }
.fd-asn-demo-btn { margin: 0; padding: 11px 16px; border: 0; border-radius: 10px; background: #10241c; color: #ede7d6; font: 600 0.8125rem/1 ${sans}; cursor: pointer; appearance: none; white-space: nowrap; }
.fd-asn-demo-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; }
.fd-asn-demo-card { margin: 0; padding: 20px; border: 1px solid #e0d9c8; border-radius: 16px; background: #fbf9f3; }
.fd-asn-demo-card > span { display: block; margin: 0 0 10px; font: 500 0.75rem/1 ${mono}; letter-spacing: 0.04em; text-transform: uppercase; color: #5b6b61; }
.fd-asn-demo-bal b { display: block; font: 400 2.75rem/1 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.fd-asn-demo-bal small { font-size: 0.5em; color: #7a877e; }
.fd-asn-demo-bal em { display: block; margin: 8px 0 20px; font: 500 0.8125rem/1 ${mono}; font-style: normal; color: #2f7a4b; }
.fd-asn-demo-bars { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; height: 150px; padding: 0 0 22px; border-bottom: 1px solid #e0d9c8; }
.fd-asn-demo-bars div { position: relative; display: flex; align-items: flex-end; justify-content: center; gap: 4px; }
.fd-asn-demo-bars i { display: block; width: 14px; border-radius: 4px 4px 0 0; background: #10241c; }
.fd-asn-demo-bars i[data-out] { background: #c9a35c; }
.fd-asn-demo-bars span { position: absolute; bottom: -20px; font: 400 0.6875rem/1 ${mono}; color: #5b6b61; }
.fd-asn-demo-card ul { margin: 0; padding: 0; list-style: none; }
.fd-asn-demo-card li { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid #ebe5d6; }
.fd-asn-demo-card li:first-child { border-top: 0; }
.fd-asn-demo-card li div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.fd-asn-demo-card li div:last-child { text-align: right; flex: none; }
.fd-asn-demo-card li b { font: 600 0.875rem/1.2 ${sans}; font-variant-numeric: tabular-nums; }
.fd-asn-demo-card li small { font: 400 0.75rem/1.2 ${sans}; color: #5b6b61; }
@media (max-width: 860px) {
  .fd-asn-demo { display: block; }
  .fd-asn-demo-main { padding: 24px 16px 60px; }
  .fd-asn-demo-head { flex-direction: column; align-items: flex-start; }
  .fd-asn-demo h1 { font-size: 1.75rem; }
  .fd-asn-demo-grid { grid-template-columns: 1fr; }
  .fd-asn-demo-bal b { font-size: 2rem; }
}
`;
