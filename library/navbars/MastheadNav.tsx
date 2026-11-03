/**
 * MastheadNav, a two-tier newspaper masthead. A mono dateline with edition
 * and weather, a huge serif wordmark, and a section rail that scrolls
 * sideways (with arrow buttons and edge fades when it overflows) ending in a
 * Subscribe pill. When the masthead scrolls out of view a slim bar slides down
 * with a small wordmark and a red reading-progress rule.
 *
 * Props: name, dateline, edition, weather, sections (label, href), current
 * (href of the active section), subscribe ({ label, href }).
 * CSS vars: --fd-mst-paper, --fd-mst-ink, --fd-mst-red.
 *
 * Behaviour: the big masthead scrolls with the page; the slim bar is
 * `position: fixed` and appears via IntersectionObserver. Progress reads
 * window scroll.
 * Browser support: all evergreen browsers (mask-image for rail fades).
 * Accessibility: the rail is a <nav> list with aria-current on the active
 * section; arrow buttons are labelled and hidden when not needed. "Sections"
 * opens a modal dialog with a focus trap; Escape closes it and returns focus.
 * The slim bar is aria-hidden and untabbable while it is off-screen.
 * Reduced motion: the slim bar appears without sliding.
 */
import { useEffect, useId, useRef, useState } from "react";

export interface MstSection { label: string; href: string }
export interface MastheadNavProps {
  name?: string;
  dateline?: string;
  edition?: string;
  weather?: string;
  sections?: MstSection[];
  current?: string;
  subscribe?: { label: string; href: string; note?: string };
  className?: string;
}

const SECTIONS: MstSection[] = [
  { label: "Front Page", href: "#front" },
  { label: "World", href: "#world" },
  { label: "Europe", href: "#europe" },
  { label: "Politics", href: "#politics" },
  { label: "Business", href: "#business" },
  { label: "Climate", href: "#climate" },
  { label: "Science", href: "#science" },
  { label: "Technology", href: "#tech" },
  { label: "Opinion", href: "#opinion" },
  { label: "Culture", href: "#culture" },
  { label: "Books", href: "#books" },
  { label: "Food", href: "#food" },
  { label: "Travel", href: "#travel" },
  { label: "Sport", href: "#sport" },
  { label: "Obituaries", href: "#obits" },
  { label: "Crossword", href: "#crossword" },
];

function Emblem({ size = 40 }: { size?: number }) {
  return (
    <svg className="fd-mst-emblem" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="20" cy="20" rx="7.5" ry="17" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3 20h34M6 11.5h28M6 28.5h28" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M20 1.5v37" stroke="var(--fd-mst-red)" strokeWidth="1.8" />
    </svg>
  );
}

export function MastheadNav({
  name = "The Meridian Post",
  dateline = "Tuesday, 3 November 2026",
  edition = "Late City Edition · Vol. CXLII · No. 49,311",
  weather = "Rotterdam 11°C, showers clearing by noon",
  sections = SECTIONS,
  current = "#front",
  subscribe = { label: "Subscribe", href: "#subscribe", note: "€1 a week for 6 months" },
  className,
}: MastheadNavProps) {
  const uid = useId();
  const mast = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLUListElement>(null);
  const prog = useRef<HTMLSpanElement>(null);
  const openers = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [slim, setSlim] = useState(false);
  const [edge, setEdge] = useState({ l: false, r: false });
  const [open, setOpen] = useState(false);

  // Slim bar appears once the big masthead has left the viewport.
  useEffect(() => {
    const el = mast.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSlim(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Reading progress (transform only).
  useEffect(() => {
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        if (prog.current) prog.current.style.transform = `scaleX(${p})`;
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);

  // Rail overflow edges.
  useEffect(() => {
    const s = scroller.current;
    if (!s) return;
    const check = () => setEdge({ l: s.scrollLeft > 4, r: s.scrollLeft + s.clientWidth < s.scrollWidth - 4 });
    check();
    s.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(s);
    return () => {
      s.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, []);

  // Sections dialog.
  useEffect(() => {
    if (!open) return;
    const d = dialog.current;
    window.setTimeout(() => d?.querySelector<HTMLElement>("input")?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        openers.current?.focus();
      }
      if (e.key === "Tab" && d) {
        const f = Array.from(d.querySelectorAll<HTMLElement>("a,button,input"));
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && i === f.length - 1) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const nudge = (d: number) => {
    const s = scroller.current;
    if (!s) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    s.scrollBy({ left: d * s.clientWidth * 0.6, behavior: reduce ? "auto" : "smooth" });
  };
  const openMenu = (btn: HTMLButtonElement) => {
    openers.current = btn;
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    openers.current?.focus();
  };

  const [the, ...rest] = name.split(" ");
  const hasThe = /^the$/i.test(the);
  const dlgId = `${uid}-sections`;

  const burger = (compact?: boolean) => (
    <button type="button" className="fd-mst-sec" aria-expanded={open} aria-controls={dlgId} tabIndex={compact && !slim ? -1 : undefined} onClick={(e) => openMenu(e.currentTarget)}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.4" /></svg>
      <span>Sections</span>
    </button>
  );

  return (
    <div className={`fd-mst${className ? " " + className : ""}`}>
      <style>{css}</style>
      <header className="fd-mst-head">
        <div ref={mast} className="fd-mst-mast">
          <div className="fd-mst-top">
            <div className="fd-mst-tl">
              {burger()}
              <a className="fd-mst-search" href="#search" aria-label="Search">
                <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M11.5 11.5l5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
              </a>
            </div>
            <p className="fd-mst-date">{dateline}</p>
            <div className="fd-mst-tr">
              <a className="fd-mst-login" href="#login">Log in</a>
              <a className="fd-mst-sub fd-mst-sub-top" href={subscribe.href}>{subscribe.label}</a>
            </div>
          </div>
          <a className="fd-mst-brand" href="#front" aria-label={`${name}, front page`}>
            {hasThe && <span className="fd-mst-the">{the}</span>}
            <Emblem size={56} />
            <span className="fd-mst-name">{hasThe ? rest.join(" ") : name}</span>
          </a>
          <div className="fd-mst-meta">
            <span>{edition}</span>
            <span className="fd-mst-wx">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M4 10.5h6.2a2.3 2.3 0 0 0 .3-4.6 3.2 3.2 0 0 0-6.2.6A2 2 0 0 0 4 10.5z" fill="none" stroke="currentColor" strokeWidth="1.1" /></svg>
              {weather}
            </span>
            <span>Price €3.80</span>
          </div>
        </div>
        <nav className="fd-mst-railwrap" aria-label="Sections">
          <div className="fd-mst-rail" data-l={edge.l ? "" : undefined} data-r={edge.r ? "" : undefined}>
            <button type="button" className="fd-mst-arrow fd-mst-al" aria-label="Scroll sections left" hidden={!edge.l} onClick={() => nudge(-1)}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M9 2.5L4.5 7 9 11.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            </button>
            <ul ref={scroller} className="fd-mst-list">
              {sections.map((s) => (
                <li key={s.href}>
                  <a href={s.href} className="fd-mst-link" aria-current={s.href === current ? "page" : undefined}>{s.label}</a>
                </li>
              ))}
            </ul>
            <button type="button" className="fd-mst-arrow fd-mst-ar" aria-label="Scroll sections right" hidden={!edge.r} onClick={() => nudge(1)}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 2.5L9.5 7 5 11.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            </button>
          </div>
          <a className="fd-mst-sub fd-mst-sub-rail" href={subscribe.href}>
            {subscribe.label}
            {subscribe.note && <small>{subscribe.note}</small>}
          </a>
        </nav>
      </header>

      <div className="fd-mst-slim" data-on={slim ? "" : undefined} aria-hidden={!slim}>
        <div className="fd-mst-slimrow">
          {burger(true)}
          <a className="fd-mst-slimbrand" href="#front" tabIndex={slim ? undefined : -1}>
            <Emblem size={22} />
            <span>{name}</span>
          </a>
          <a className="fd-mst-sub" href={subscribe.href} tabIndex={slim ? undefined : -1}>{subscribe.label}</a>
        </div>
        <span className="fd-mst-prog" aria-hidden="true"><span ref={prog} /></span>
      </div>

      <div className="fd-mst-dwrap" hidden={!open}>
        <div className="fd-mst-dscrim" aria-hidden="true" onClick={close} />
        <div ref={dialog} id={dlgId} className="fd-mst-drawer" role="dialog" aria-modal="true" aria-label="All sections">
          <div className="fd-mst-dhead">
            <span className="fd-mst-dtitle">Sections</span>
            <button type="button" className="fd-mst-x" aria-label="Close sections" onClick={close}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.4" /></svg>
            </button>
          </div>
          <form className="fd-mst-form" role="search" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor={`${uid}-q`} className="fd-mst-sr">Search the archive</label>
            <input id={`${uid}-q`} type="search" placeholder="Search 178 years of archive" />
          </form>
          <ul className="fd-mst-dlist">
            {sections.map((s, i) => (
              <li key={s.href}>
                <a href={s.href} onClick={close} aria-current={s.href === current ? "page" : undefined}>
                  <span className="fd-mst-dn">{String(i + 1).padStart(2, "0")}</span>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="fd-mst-dfoot">
            <a className="fd-mst-sub" href={subscribe.href}>{subscribe.label}</a>
            <a className="fd-mst-login" href="#login">Log in</a>
          </div>
          <p className="fd-mst-dmeta">{dateline} · {weather}</p>
        </div>
      </div>
    </div>
  );
}

const serif = `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`;
const sans = `ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif`;
const mono = `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`;

const css = `
.fd-mst {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-mst-paper: #f1eee6;
  --fd-mst-ink: #151412;
  --fd-mst-soft: #5d5a53;
  --fd-mst-rule: #c9c4b8;
  --fd-mst-red: #c4161c;
  display: block; margin: 0; padding: 0;
  font: 400 15px/1.4 ${sans};
  color: var(--fd-mst-ink); background: var(--fd-mst-paper);
}
.fd-mst, .fd-mst *, .fd-mst *::before, .fd-mst *::after { box-sizing: border-box; }
.fd-mst a:focus-visible, .fd-mst button:focus-visible, .fd-mst input:focus-visible { outline: 2px solid color-mix(in srgb, var(--fd-mst-red) 70%, transparent); outline-offset: 2px; }
.fd-mst-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.fd-mst-head { display: block; margin: 0; padding: 0 32px; background: var(--fd-mst-paper); }
.fd-mst-mast { margin: 0; padding: 0; }
.fd-mst-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; height: 56px; margin: 0; padding: 0; border-bottom: 1px solid var(--fd-mst-rule); }
.fd-mst-tl, .fd-mst-tr { display: flex; align-items: center; gap: 10px; margin: 0; padding: 0; }
.fd-mst-tr { justify-content: flex-end; gap: 18px; }
.fd-mst-sec { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 0 -8px; padding: 8px; border: 0; border-radius: 2px; background: none; font: 600 0.8125rem/1 ${sans}; letter-spacing: 0.02em; color: var(--fd-mst-ink); cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-mst-sec svg, .fd-mst-search svg { display: block; }
.fd-mst-sec:hover span { text-decoration: underline; text-underline-offset: 3px; }
.fd-mst-search { display: grid; place-items: center; width: 34px; height: 34px; margin: 0; padding: 0; color: var(--fd-mst-ink); text-decoration: none; border-left: 1px solid var(--fd-mst-rule); }
.fd-mst-date { margin: 0; padding: 0; font: 500 0.75rem/1 ${mono}; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fd-mst-ink); white-space: nowrap; }
.fd-mst-login { font: 600 0.8125rem/1 ${sans}; color: var(--fd-mst-ink); text-decoration: none; }
.fd-mst-login:hover { text-decoration: underline; text-underline-offset: 3px; }
.fd-mst-sub { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; margin: 0; padding: 9px 18px; border-radius: 9999px; font: 700 0.8125rem/1 ${sans}; letter-spacing: 0.02em; color: #fff; background: var(--fd-mst-red); text-decoration: none; white-space: nowrap; transition: transform var(--fd-dur-1) var(--fd-ease-out), background var(--fd-dur-1) linear; }
.fd-mst-sub:hover { background: #a31015; }
.fd-mst-sub:active { transform: scale(0.96); }
.fd-mst-sub small { display: block; font: 500 0.625rem/1 ${mono}; letter-spacing: 0.02em; color: rgba(255,255,255,0.86); }

.fd-mst-brand { display: flex; align-items: center; justify-content: center; gap: 0.18em; margin: 0; padding: 26px 0 14px; color: var(--fd-mst-ink); text-decoration: none; font: 700 clamp(2.5rem, 8.4vw, 7.25rem)/0.9 ${serif}; letter-spacing: -0.035em; }
.fd-mst-brand .fd-mst-emblem { display: block; width: 0.58em; height: 0.58em; flex: none; color: var(--fd-mst-ink); margin: 0 0.04em; }
.fd-mst-the { font: italic 400 0.42em/1 ${serif}; letter-spacing: 0; align-self: center; margin: 0 0.06em 0 0; }
.fd-mst-name { display: block; white-space: nowrap; }
.fd-mst-meta { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin: 0; padding: 9px 0; border-top: 3px double var(--fd-mst-ink); font: 500 0.6875rem/1.3 ${mono}; letter-spacing: 0.04em; text-transform: uppercase; color: var(--fd-mst-soft); }
.fd-mst-wx { display: inline-flex; align-items: center; gap: 7px; color: var(--fd-mst-ink); }
.fd-mst-wx svg { display: block; }

.fd-mst-railwrap { display: flex; align-items: center; gap: 16px; margin: 0; padding: 0; border-top: 1px solid var(--fd-mst-ink); border-bottom: 1px solid var(--fd-mst-ink); }
.fd-mst-rail { position: relative; flex: 1; min-width: 0; margin: 0; padding: 0; }
.fd-mst-list { display: flex; gap: 0; margin: 0; padding: 0; list-style: none; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity; }
.fd-mst-list::-webkit-scrollbar { display: none; }
.fd-mst-rail[data-r] .fd-mst-list { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 72px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 72px), transparent); }
.fd-mst-rail[data-l] .fd-mst-list { -webkit-mask-image: linear-gradient(90deg, transparent, #000 72px); mask-image: linear-gradient(90deg, transparent, #000 72px); }
.fd-mst-rail[data-l][data-r] .fd-mst-list { -webkit-mask-image: linear-gradient(90deg, transparent, #000 72px, #000 calc(100% - 72px), transparent); mask-image: linear-gradient(90deg, transparent, #000 72px, #000 calc(100% - 72px), transparent); }
.fd-mst-list li { flex: none; margin: 0; padding: 0; scroll-snap-align: start; }
.fd-mst-link { position: relative; display: block; margin: 0; padding: 14px 14px 13px; font: 500 0.875rem/1 ${serif}; letter-spacing: 0; color: var(--fd-mst-ink); text-decoration: none; white-space: nowrap; }
.fd-mst-list li:first-child .fd-mst-link { padding-left: 0; }
.fd-mst-link::after { content: ""; position: absolute; left: 14px; right: 14px; bottom: -1px; height: 3px; background: var(--fd-mst-red); transform: scaleX(0); transform-origin: left; transition: transform var(--fd-dur-2) var(--fd-ease-out); }
.fd-mst-list li:first-child .fd-mst-link::after { left: 0; }
.fd-mst-link:hover::after { transform: scaleX(1); background: var(--fd-mst-ink); }
.fd-mst-link[aria-current="page"] { font-weight: 700; }
.fd-mst-link[aria-current="page"]::after { transform: scaleX(1); }
.fd-mst-arrow { position: absolute; top: 50%; z-index: 2; display: grid; place-items: center; width: 28px; height: 28px; margin: -14px 0 0; padding: 0; border: 1px solid var(--fd-mst-ink); border-radius: 9999px; background: var(--fd-mst-paper); color: var(--fd-mst-ink); cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-mst-arrow[hidden] { display: none; }
.fd-mst-arrow svg { display: block; }
.fd-mst-al { left: 0; }
.fd-mst-ar { right: 0; }
.fd-mst-sub-rail { margin: 6px 0; padding: 7px 16px; }

.fd-mst-slim { position: fixed; left: 0; right: 0; top: 0; z-index: 50; margin: 0; padding: 0; background: var(--fd-mst-paper); border-bottom: 1px solid var(--fd-mst-ink); transform: translateY(-110%); transition: transform var(--fd-dur-3) var(--fd-ease-out); visibility: hidden; }
.fd-mst-slim[data-on] { transform: none; visibility: visible; }
.fd-mst-slim:not([data-on]) { transition: transform var(--fd-dur-2) var(--fd-ease-in-out), visibility 0s linear var(--fd-dur-2); }
.fd-mst-slimrow { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 52px; margin: 0; padding: 0 32px; }
.fd-mst-slimrow .fd-mst-sub { justify-self: end; padding: 8px 16px; }
.fd-mst-slimbrand { display: inline-flex; align-items: center; gap: 8px; color: var(--fd-mst-ink); text-decoration: none; font: 700 1.375rem/1 ${serif}; letter-spacing: -0.02em; }
.fd-mst-slimbrand .fd-mst-emblem { display: block; }
.fd-mst-prog { position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; margin: 0; padding: 0; }
.fd-mst-prog span { display: block; height: 100%; background: var(--fd-mst-red); transform: scaleX(0); transform-origin: left; }

.fd-mst-dwrap { position: fixed; inset: 0; z-index: 60; }
.fd-mst-dwrap[hidden] { display: none; }
.fd-mst-dscrim { position: absolute; inset: 0; background: rgba(21,20,18,0.45); animation: fd-mst-fade var(--fd-dur-3) var(--fd-ease-out); }
@keyframes fd-mst-fade { from { opacity: 0; } }
.fd-mst-drawer { position: absolute; left: 0; top: 0; bottom: 0; width: min(440px, 100%); overflow-y: auto; margin: 0; padding: 0 28px 32px; background: var(--fd-mst-paper); border-right: 1px solid var(--fd-mst-ink); animation: fd-mst-in var(--fd-dur-3) var(--fd-ease-out); }
@keyframes fd-mst-in { from { transform: translateX(-100%); } }
.fd-mst-dhead { display: flex; align-items: center; justify-content: space-between; height: 64px; margin: 0; padding: 0; border-bottom: 3px double var(--fd-mst-ink); }
.fd-mst-dtitle { font: 700 1.5rem/1 ${serif}; letter-spacing: -0.02em; color: var(--fd-mst-ink); }
.fd-mst-x { display: grid; place-items: center; width: 40px; height: 40px; margin: 0 -10px 0 0; padding: 0; border: 0; background: none; color: var(--fd-mst-ink); cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-mst-x svg { display: block; }
.fd-mst-form { margin: 18px 0 8px; padding: 0; }
.fd-mst-form input { display: block; width: 100%; margin: 0; padding: 12px 14px; border: 1px solid var(--fd-mst-ink); border-radius: 0; background: #fbf9f4; font: 400 1rem/1.2 ${serif}; color: var(--fd-mst-ink); appearance: none; -webkit-appearance: none; }
.fd-mst-dlist { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; margin: 8px 0 0; padding: 0; list-style: none; }
.fd-mst-dlist li { margin: 0; padding: 0; border-bottom: 1px solid var(--fd-mst-rule); }
.fd-mst-dlist a { display: flex; align-items: baseline; gap: 10px; margin: 0; padding: 12px 0; font: 400 1.1875rem/1.2 ${serif}; color: var(--fd-mst-ink); text-decoration: none; }
.fd-mst-dlist a:hover { color: var(--fd-mst-red); }
.fd-mst-dlist a[aria-current="page"] { font-weight: 700; }
.fd-mst-dn { font: 500 0.6875rem/1 ${mono}; color: var(--fd-mst-soft); }
.fd-mst-dfoot { display: flex; align-items: center; gap: 20px; margin: 24px 0 0; padding: 0; }
.fd-mst-dmeta { margin: 20px 0 0; font: 500 0.6875rem/1.5 ${mono}; letter-spacing: 0.04em; text-transform: uppercase; color: var(--fd-mst-soft); }

@media (max-width: 900px) {
  .fd-mst-meta span:last-child { display: none; }
}
@media (max-width: 680px) {
  .fd-mst-head { padding: 0 16px; }
  .fd-mst-top { grid-template-columns: auto 1fr auto; height: 48px; }
  .fd-mst-date { text-align: center; font-size: 0.625rem; letter-spacing: 0.04em; }
  .fd-mst-search, .fd-mst-top .fd-mst-login, .fd-mst-sec span { display: none; }
  .fd-mst-sub-top { padding: 7px 12px; font-size: 0.75rem; }
  .fd-mst-brand { padding: 18px 0 10px; font-size: clamp(2rem, 10.4vw, 3rem); }
  .fd-mst-meta { justify-content: center; }
  .fd-mst-meta span:first-child { display: none; }
  .fd-mst-sub-rail { display: none; }
  .fd-mst-arrow { display: none; }
  .fd-mst-slimrow { padding: 0 16px; grid-template-columns: auto 1fr auto; gap: 8px; }
  .fd-mst-slimrow .fd-mst-sec span { display: none; }
  .fd-mst-slimbrand { justify-self: center; font-size: 1.0625rem; }
  .fd-mst-slimrow .fd-mst-sub { padding: 7px 12px; font-size: 0.75rem; }
  .fd-mst-drawer { padding: 0 20px 28px; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-mst-slim, .fd-mst-slim:not([data-on]), .fd-mst-link::after { transition: none; }
  .fd-mst-drawer, .fd-mst-dscrim { animation: none; }
}
`;

/* ── Demo ─────────────────────────────────────────────────────────────── */

const MORE = [
  { k: "Energy", h: "The North Sea's oldest oil platform will become a wind farm's workshop", d: "Brent Delta's legs stay. Everything above the waterline goes, by barge, to Den Helder." },
  { k: "Cities", h: "Paris counted its trees. There are 486,511, and 300 of them have names", d: "The city's arborists spent four summers with clipboards and a laser. One plane tree is 241." },
  { k: "Science", h: "Why the Wadden Sea's mud is the best carbon store you have never heard of", d: "A square metre of tidal flat locks away more carbon than a square metre of forest, for longer." },
  { k: "Opinion", h: "Dikes are a promise. We should stop making ones we cannot keep", d: "A former water minister on why the next fifty years need fewer walls and more room." },
];

export function Demo() {
  return (
    <div className="fd-mst-demo">
      <style>{demoCss}</style>
      <MastheadNav />
      <main className="fd-mst-demo-main">
        <article className="fd-mst-demo-lead">
          <p className="fd-mst-demo-kick">Climate · Exclusive</p>
          <h1>Rotterdam will let the river in: the city's new plan floods 40 parks on purpose</h1>
          <p className="fd-mst-demo-deck">Engineers say the Maas will rise faster than dikes can be raised. The answer, approved at 1:40 a.m., is to give the water somewhere to go.</p>
          <p className="fd-mst-demo-by">By Annelies de Vries and Tomás Ferreira · Rotterdam · 6 min read</p>
          <div className="fd-mst-demo-cols" lang="en">
            <p><span className="fd-mst-demo-drop">T</span>he vote came after eleven hours of debate and one power cut. By a margin of 23 to 22, the council approved a plan to redesign forty parks, squares and sports fields so that each can hold water during a storm surge, then drain it slowly back to the river within two days.</p>
            <p>The first site, a football pitch in Feijenoord, already sits 1.8 metres below its old level. On a dry afternoon it is a pitch. During last February's storm it held 9,000 cubic metres of water, enough to keep two streets of terraced houses dry.</p>
            <p>“We stopped asking how to keep the water out,” said Ilse Vermeer, the city's chief water engineer, who has spent nineteen years on the problem. “We started asking where it would like to be.”</p>
            <p>Critics on the council argued the €610 million budget would be better spent on raising the Maasboulevard dike by another metre. Ms. Vermeer's answer was a chart: every metre of dike has cost more than the last.</p>
            <p>Construction on the next nine sites begins in March. Residents near each one will receive a letter, a map, and, at the council's insistence, an apology for the noise.</p>
          </div>
        </article>
        <aside className="fd-mst-demo-side">
          <h2>Most read</h2>
          <ol>
            <li><b>The last ferry to Texel now runs on batteries, and it is quieter than the gulls</b></li>
            <li><b>A Utrecht bakery has made the same rye loaf every morning since 1887</b></li>
            <li><b>Opinion: Europe's night trains need a timetable, not another summit</b></li>
            <li><b>The Dutch chess prodigy who learned the game from a library book</b></li>
            <li><b>Crossword No. 18,204: Thursday's cryptic, set by Hecate</b></li>
          </ol>
          <div className="fd-mst-demo-brief">
            <h2>In brief</h2>
            <p><b>Markets.</b> The AEX closed up 0.6% as shipping stocks recovered.</p>
            <p><b>Weather.</b> Showers clearing by noon, a dry and cold evening. High 11°C.</p>
            <p><b>Corrections.</b> Monday's map of the Maas misplaced Dordrecht by eleven kilometres.</p>
          </div>
        </aside>
        <section className="fd-mst-demo-more" aria-label="More from Climate">
          <h2>More from Climate</h2>
          <div>
            {MORE.map((m) => (
              <article key={m.h}>
                <p className="fd-mst-demo-kick">{m.k}</p>
                <h3>{m.h}</h3>
                <p>{m.d}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

const demoCss = `
.fd-mst-demo { margin: 0; padding: 0; min-height: 100vh; background: #f1eee6; color: #151412; font: 400 15px/1.5 ${serif}; }
.fd-mst-demo *, .fd-mst-demo *::before, .fd-mst-demo *::after { box-sizing: border-box; }
.fd-mst-demo-main { display: grid; grid-template-columns: minmax(0, 2.4fr) minmax(0, 1fr); gap: 40px; margin: 0; padding: 32px 32px 160px; }
.fd-mst-demo-lead { padding: 0 40px 0 0; border-right: 1px solid #c9c4b8; }
.fd-mst-demo-kick { margin: 0 0 12px; font: 600 0.75rem/1 ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: 0.08em; text-transform: uppercase; color: #c4161c; }
.fd-mst-demo h1 { margin: 0; font: 700 clamp(2rem, 4.2vw, 3.5rem)/1.02 ${serif}; letter-spacing: -0.025em; color: #151412; }
.fd-mst-demo-deck { margin: 16px 0 14px; font: italic 400 1.25rem/1.4 ${serif}; color: #3b3934; }
.fd-mst-demo-by { margin: 0 0 24px; padding: 0 0 14px; border-bottom: 1px solid #c9c4b8; font: 600 0.75rem/1.3 ${sans}; letter-spacing: 0.02em; color: #5d5a53; }
.fd-mst-demo-cols { columns: 3 220px; column-gap: 28px; column-rule: 1px solid #d8d3c7; }
.fd-mst-demo-cols p { margin: 0 0 14px; font: 400 1rem/1.55 ${serif}; color: #24221f; text-align: justify; hyphens: auto; }
.fd-mst-demo-drop { float: left; margin: 4px 8px 0 0; font: 700 3.6rem/0.8 ${serif}; }
.fd-mst-demo-side h2 { margin: 0 0 12px; padding: 0 0 8px; border-bottom: 3px double #151412; font: 700 1.125rem/1 ${serif}; }
.fd-mst-demo-side ol { margin: 0 0 32px; padding: 0; list-style: none; counter-reset: mr; }
.fd-mst-demo-side li { counter-increment: mr; display: grid; grid-template-columns: 32px 1fr; padding: 12px 0; border-bottom: 1px solid #c9c4b8; }
.fd-mst-demo-side li::before { content: counter(mr); font: 700 1.5rem/1 ${serif}; color: #c4161c; }
.fd-mst-demo-side li b { font: 400 1.0625rem/1.3 ${serif}; }
.fd-mst-demo-brief p { margin: 0 0 12px; font: 400 0.9375rem/1.45 ${serif}; color: #24221f; }
.fd-mst-demo-more { grid-column: 1 / -1; margin: 24px 0 0; padding: 0; }
.fd-mst-demo-more > h2 { margin: 0 0 18px; padding: 0 0 8px; border-bottom: 3px double #151412; font: 700 1.375rem/1 ${serif}; }
.fd-mst-demo-more > div { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; }
.fd-mst-demo-more article { padding: 4px 20px 24px; border-left: 1px solid #c9c4b8; }
.fd-mst-demo-more article:first-child { padding-left: 0; border-left: 0; }
.fd-mst-demo-more h3 { margin: 0 0 10px; font: 700 1.3125rem/1.15 ${serif}; letter-spacing: -0.01em; }
.fd-mst-demo-more article > p:last-child { margin: 0; font: 400 0.9375rem/1.45 ${serif}; color: #3b3934; }
@media (max-width: 860px) {
  .fd-mst-demo-more > div { grid-template-columns: 1fr; }
  .fd-mst-demo-more article { padding: 16px 0; border-left: 0; border-top: 1px solid #c9c4b8; }
  .fd-mst-demo-main { grid-template-columns: 1fr; padding: 24px 16px 120px; }
  .fd-mst-demo-lead { padding: 0; border: 0; }
}
`;
