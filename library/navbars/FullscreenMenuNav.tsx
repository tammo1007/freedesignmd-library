/**
 * FullscreenMenuNav, an architecture studio header whose burger opens a
 * fullscreen overlay. Giant stacked links reveal line by line through a
 * clip-path mask; hovering or focusing a link wipes in a project photograph
 * with its index number, name and year. The burger morphs into an X and the
 * "Menu" label rolls to "Close".
 *
 * Props: studio, tagline, offices (name + IANA time zone, shown as live
 * clocks), items (label, href, project { src, alt, name, place, year }),
 * contact lines.
 * CSS vars: --fd-fsm-paper, --fd-fsm-ink, --fd-fsm-night.
 *
 * Browser support: all evergreen browsers (clip-path inset).
 * Accessibility: the button has aria-expanded/aria-controls; the overlay is a
 * modal dialog with a focus trap, Escape closes it and returns focus. Photos
 * are decorative (the caption carries the information as text).
 * Reduced motion: overlay and links appear with a short fade, photos swap
 * without wiping.
 */
import { useEffect, useId, useRef, useState } from "react";

export interface FsmProject { src: string; alt: string; name: string; place: string; year: string }
export interface FsmItem { label: string; href: string; project: FsmProject }
export interface FullscreenMenuNavProps {
  studio?: string;
  tagline?: string;
  offices?: { name: string; tz: string }[];
  items?: FsmItem[];
  contact?: string[];
  className?: string;
}

const ITEMS: FsmItem[] = [
  { label: "Work", href: "#work", project: { src: "/img/halcyon/courtyard-pool-900.webp", alt: "", name: "Casa dei Limoni", place: "Praiano", year: "2024" } },
  { label: "Studio", href: "#studio", project: { src: "/img/halcyon/journals-900.webp", alt: "", name: "The drawing archive", place: "Via Roma 14", year: "1998" } },
  { label: "Practice", href: "#practice", project: { src: "/img/halcyon/ryokan-900.webp", alt: "", name: "Hanare guest house", place: "Kyoto", year: "2021" } },
  { label: "Journal", href: "#journal", project: { src: "/img/halcyon/suite-900.webp", alt: "", name: "Suite 9, Hotel Calce", place: "Positano", year: "2023" } },
  { label: "Contact", href: "#contact", project: { src: "/img/halcyon/positano-sunset-900.webp", alt: "", name: "Our terrace above the bay", place: "Praiano", year: "2026" } },
];

const OFFICES = [{ name: "Praiano", tz: "Europe/Rome" }, { name: "Kyoto", tz: "Asia/Tokyo" }];
const CONTACT = ["Via Roma 14, 84010 Praiano", "studio@morokessler.it", "+39 089 874 2210"];

export function FullscreenMenuNav({
  studio = "Moro Kessler",
  tagline = "Architects, Praiano & Kyoto",
  offices = OFFICES,
  items = ITEMS,
  contact = CONTACT,
  className,
}: FullscreenMenuNavProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [cur, setCur] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [times, setTimes] = useState<string[]>(offices.map(() => "--:--"));
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);

  // Live office clocks (client only).
  useEffect(() => {
    const fmt = offices.map((o) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: o.tz }));
    const tick = () => setTimes(fmt.map((f) => f.format(new Date())));
    tick();
    const t = window.setInterval(tick, 15000);
    return () => window.clearInterval(t);
  }, [offices.map((o) => o.tz).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bar gains a hairline once the page scrolls.
  useEffect(() => {
    const on = () => root.current?.toggleAttribute("data-scrolled", window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Mount/unmount with an exit animation.
  useEffect(() => {
    if (open) {
      setShown(true);
      return;
    }
    if (!shown) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setShown(false), reduce ? 0 : 520);
    return () => window.clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const p = panel.current;
    const t = window.setTimeout(() => p?.querySelector<HTMLElement>(".fd-fsm-link")?.focus({ preventScroll: true }), 80);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
      if (e.key === "Tab" && p) {
        const f = [btn.current!, ...Array.from(p.querySelectorAll<HTMLElement>("a,button"))];
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
    return () => {
      window.clearTimeout(t);
      document.documentElement.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (i: number) => {
    if (i === cur) return;
    setPrev(cur);
    setCur(i);
  };

  const p = items[cur]?.project;
  const panelId = `${uid}-menu`;

  return (
    <header ref={root} className={`fd-fsm${className ? " " + className : ""}`} data-open={open ? "" : undefined}>
      <style>{css}</style>
      <div className="fd-fsm-bar">
        <a href="#top" className="fd-fsm-brand" aria-label={`${studio}, ${tagline}`}>
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M1 25V9l12-8 12 8v16" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 25V14h10v11" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
          <span className="fd-fsm-name">{studio}</span>
          <span className="fd-fsm-tag">{tagline}</span>
        </a>
        <p className="fd-fsm-clocks" aria-label="Office hours">
          {offices.map((o, i) => (
            <span key={o.name}><b>{o.name}</b> {times[i]}</span>
          ))}
        </p>
        <button ref={btn} type="button" className="fd-fsm-btn" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
          <span className="fd-fsm-roll" aria-hidden="true"><span>Menu</span><span>Close</span></span>
          <span className="fd-fsm-sr">{open ? "Close menu" : "Open menu"}</span>
          <span className="fd-fsm-lines" aria-hidden="true"><i /><i /></span>
        </button>
      </div>

      {shown && (
        <div ref={panel} id={panelId} className="fd-fsm-panel" role="dialog" aria-modal="true" aria-label="Site menu" data-state={open ? "open" : "closing"}>
          <nav className="fd-fsm-nav" aria-label="Primary">
            <ol>
              {items.map((it, i) => (
                <li key={it.href} style={{ ["--i" as string]: i }}>
                  <a
                    href={it.href}
                    className="fd-fsm-link"
                    data-on={cur === i ? "" : undefined}
                    onPointerEnter={() => pick(i)}
                    onFocus={() => pick(i)}
                    onClick={() => setOpen(false)}
                  >
                    <span className="fd-fsm-idx">{String(i + 1).padStart(2, "0")}</span>
                    <span className="fd-fsm-label">{it.label}</span>
                    <span className="fd-fsm-myear">{it.project.year}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <figure className="fd-fsm-fig" aria-hidden="true">
            <div className="fd-fsm-frame">
              {prev !== null && items[prev] && <img key={`p${prev}`} className="fd-fsm-img fd-fsm-under" src={items[prev].project.src} alt="" width={900} height={900} />}
              <img key={`c${cur}`} className="fd-fsm-img fd-fsm-over" src={p.src} alt={p.alt} width={900} height={900} />
            </div>
            <figcaption>
              <span className="fd-fsm-cn" key={`n${cur}`}>Nº {String(cur + 1).padStart(2, "0")}</span>
              <span className="fd-fsm-ct" key={`t${cur}`}>{p.name}, {p.place}</span>
              <span className="fd-fsm-cy" key={`y${cur}`}>{p.year}</span>
            </figcaption>
          </figure>
          <div className="fd-fsm-foot">
            {contact.map((c) => <span key={c}>{c}</span>)}
            <span className="fd-fsm-live"><i aria-hidden="true" />4 buildings on site this month</span>
          </div>
        </div>
      )}
    </header>
  );
}

const sans = `ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", Roboto, sans-serif`;
const mono = `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`;

const css = `
.fd-fsm {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-fsm-paper: #e9e5dc;
  --fd-fsm-ink: #171614;
  --fd-fsm-night: #141311;
  --fd-fsm-bone: #ebe6dc;
  position: sticky; top: 0; z-index: 50; display: block; margin: 0; padding: 0;
  font: 400 14px/1.4 ${sans};
  color: var(--fd-fsm-ink); background: var(--fd-fsm-paper);
  transition: box-shadow var(--fd-dur-2) linear;
}
.fd-fsm[data-scrolled] { box-shadow: 0 1px 0 rgba(23,22,20,0.16); }
.fd-fsm, .fd-fsm *, .fd-fsm *::before, .fd-fsm *::after { box-sizing: border-box; }
.fd-fsm a:focus-visible, .fd-fsm button:focus-visible { outline: 2px solid rgba(196,90,50,0.7); outline-offset: 3px; }
.fd-fsm-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.fd-fsm-bar { position: relative; z-index: 3; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 72px; margin: 0; padding: 0 28px; color: var(--fd-fsm-ink); transition: color var(--fd-dur-3) var(--fd-ease-in-out); }
.fd-fsm[data-open] .fd-fsm-bar { color: var(--fd-fsm-bone); }
.fd-fsm-brand { display: inline-flex; align-items: center; gap: 12px; justify-self: start; margin: 0; padding: 0; color: inherit; text-decoration: none; }
.fd-fsm-brand svg { display: block; flex: none; }
.fd-fsm-name { font: 800 1.0625rem/1 ${sans}; letter-spacing: -0.03em; text-transform: uppercase; }
.fd-fsm-tag { font: 400 0.75rem/1 ${mono}; letter-spacing: 0; opacity: 0.66; }
.fd-fsm-clocks { display: flex; gap: 22px; margin: 0; padding: 0; font: 400 0.75rem/1 ${mono}; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
.fd-fsm-clocks b { font-weight: 400; text-transform: uppercase; opacity: 0.55; margin-right: 4px; }
.fd-fsm-btn { justify-self: end; display: inline-flex; align-items: center; gap: 14px; height: 44px; margin: 0 -8px 0 0; padding: 0 8px 0 14px; border: 0; border-radius: 0; background: none; color: inherit; cursor: pointer; appearance: none; -webkit-appearance: none; font: 600 0.8125rem/1 ${mono}; letter-spacing: 0.08em; text-transform: uppercase; }
.fd-fsm-roll { position: relative; display: block; height: 14px; overflow: hidden; }
.fd-fsm-roll span { display: block; height: 14px; line-height: 14px; transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.fd-fsm[data-open] .fd-fsm-roll span { transform: translateY(-100%); }
.fd-fsm-lines { position: relative; display: block; width: 30px; height: 30px; }
.fd-fsm-lines i { position: absolute; left: 3px; right: 3px; height: 1.5px; background: currentColor; transition: transform var(--fd-dur-3) var(--fd-spring), top var(--fd-dur-2) var(--fd-ease-out); }
.fd-fsm-lines i:nth-child(1) { top: 11px; }
.fd-fsm-lines i:nth-child(2) { top: 18px; transform-origin: center; }
.fd-fsm-btn:hover .fd-fsm-lines i:nth-child(2) { transform: scaleX(0.6) translateX(-33%); }
.fd-fsm[data-open] .fd-fsm-lines i:nth-child(1) { top: 14.5px; transform: rotate(45deg); }
.fd-fsm[data-open] .fd-fsm-lines i:nth-child(2) { top: 14.5px; transform: rotate(-45deg); }

.fd-fsm-panel { position: fixed; inset: 0; z-index: 2; display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); grid-template-rows: 1fr auto; gap: 0 56px; margin: 0; padding: 104px 28px 26px; background: var(--fd-fsm-night); color: var(--fd-fsm-bone); clip-path: inset(0 0 0 0); animation: fd-fsm-curtain var(--fd-dur-4) var(--fd-ease-out); overflow-y: auto; }
.fd-fsm-panel[data-state="closing"] { clip-path: inset(0 0 100% 0); transition: clip-path 520ms var(--fd-ease-in-out); }
@keyframes fd-fsm-curtain { from { clip-path: inset(0 0 100% 0); } }

.fd-fsm-nav { align-self: center; margin: 0; padding: 0; }
.fd-fsm-nav ol { margin: 0; padding: 0; list-style: none; }
.fd-fsm-nav li { margin: 0; padding: 0; overflow: hidden; clip-path: inset(0 0 100% 0); animation: fd-fsm-line var(--fd-dur-4) var(--fd-ease-out) forwards; animation-delay: calc(180ms + var(--i) * 70ms); }
.fd-fsm-panel[data-state="closing"] .fd-fsm-nav li { animation: none; clip-path: inset(0 0 0 0); }
@keyframes fd-fsm-line { to { clip-path: inset(0 0 0 0); } }
.fd-fsm-link { display: flex; align-items: flex-start; gap: 18px; margin: 0; padding: 0; color: var(--fd-fsm-bone); text-decoration: none; transform: translateY(70%); animation: fd-fsm-rise var(--fd-dur-4) var(--fd-ease-out) forwards; animation-delay: calc(180ms + var(--i) * 70ms); transition: opacity var(--fd-dur-2) linear; }
@keyframes fd-fsm-rise { to { transform: none; } }
.fd-fsm-nav ol:hover .fd-fsm-link, .fd-fsm-nav ol:focus-within .fd-fsm-link { opacity: 0.28; }
.fd-fsm-nav ol .fd-fsm-link[data-on] { opacity: 1; }
.fd-fsm-idx { flex: none; width: 2.4em; margin: 0; padding: 1.5em 0 0; font: 400 0.75rem/1 ${mono}; color: var(--fd-fsm-bone); opacity: 0.55; }
.fd-fsm-label { display: block; font: 800 clamp(3rem, 8.6vw, 8.25rem)/0.9 ${sans}; letter-spacing: -0.055em; text-transform: uppercase; padding: 0 0 0.04em; transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.fd-fsm-link[data-on] .fd-fsm-label { transform: translateX(0.12em); }
.fd-fsm-link:focus-visible { outline-offset: -2px; }
.fd-fsm-myear { display: none; }

.fd-fsm-fig { align-self: center; justify-self: end; width: 100%; max-width: 460px; margin: 0; padding: 0; opacity: 0; animation: fd-fsm-fade var(--fd-dur-4) var(--fd-ease-out) 380ms forwards; }
@keyframes fd-fsm-fade { to { opacity: 1; } }
.fd-fsm-frame { position: relative; aspect-ratio: 4 / 5; overflow: hidden; background: #26241f; }
.fd-fsm-img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; }
.fd-fsm-over { animation: fd-fsm-wipe var(--fd-dur-4) var(--fd-ease-out); }
@keyframes fd-fsm-wipe { from { clip-path: inset(100% 0 0 0); transform: scale(1.08); } to { clip-path: inset(0 0 0 0); transform: scale(1); } }
.fd-fsm-fig figcaption { display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; gap: 14px; margin: 14px 0 0; padding: 12px 0 0; border-top: 1px solid rgba(235,230,220,0.22); }
.fd-fsm-cn, .fd-fsm-cy { font: 400 0.8125rem/1 ${mono}; color: var(--fd-fsm-bone); }
.fd-fsm-cy { font-size: 1.5rem; letter-spacing: -0.02em; }
.fd-fsm-ct { font: 500 0.9375rem/1.3 ${sans}; color: var(--fd-fsm-bone); opacity: 0.8; }
.fd-fsm-cn, .fd-fsm-ct, .fd-fsm-cy { animation: fd-fsm-up var(--fd-dur-3) var(--fd-ease-out); }
@keyframes fd-fsm-up { from { opacity: 0; transform: translateY(6px); } }

.fd-fsm-foot { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px 32px; align-items: center; margin: 28px 0 0; padding: 18px 0 0; border-top: 1px solid rgba(235,230,220,0.18); font: 400 0.75rem/1.3 ${mono}; color: rgba(235,230,220,0.7); opacity: 0; animation: fd-fsm-fade var(--fd-dur-4) var(--fd-ease-out) 520ms forwards; }
.fd-fsm-live { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; color: var(--fd-fsm-bone); }
.fd-fsm-live i { display: block; width: 7px; height: 7px; border-radius: 9999px; background: #c45a32; }

@media (max-width: 860px) {
  .fd-fsm-clocks { display: none; }
  .fd-fsm-bar { grid-template-columns: 1fr auto; height: 64px; padding: 0 18px; }
  .fd-fsm-tag { display: none; }
  .fd-fsm-panel { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; padding: 88px 18px 22px; gap: 0; }
  .fd-fsm-fig { order: -1; justify-self: stretch; max-width: none; margin: 0 0 24px; }
  .fd-fsm-frame { aspect-ratio: 16 / 9; }
  .fd-fsm-fig figcaption { margin-top: 10px; padding-top: 8px; }
  .fd-fsm-cy { font-size: 1rem; }
  .fd-fsm-nav { align-self: start; }
  .fd-fsm-label { font-size: clamp(2.75rem, 14vw, 4.5rem); }
  .fd-fsm-myear { display: block; margin-left: auto; padding: 1.4em 0 0; font: 400 0.75rem/1 ${mono}; opacity: 0.55; }
  .fd-fsm-idx { width: 2em; padding-top: 1.2em; }
  .fd-fsm-live { margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-fsm-panel { animation: fd-fsm-fade var(--fd-dur-1) linear; }
  .fd-fsm-panel[data-state="closing"] { transition: none; }
  .fd-fsm-nav li, .fd-fsm-link { animation: none; clip-path: none; transform: none; }
  .fd-fsm-fig, .fd-fsm-foot { animation: none; opacity: 1; }
  .fd-fsm-over, .fd-fsm-cn, .fd-fsm-ct, .fd-fsm-cy { animation: none; }
  .fd-fsm-lines i, .fd-fsm-roll span, .fd-fsm-label { transition: none; }
}
`;

/* ── Demo ─────────────────────────────────────────────────────────────── */

const WORKS = [
  { n: "014", name: "Casa dei Limoni", place: "Praiano", type: "House, restoration", year: "2024" },
  { n: "013", name: "Suite 9, Hotel Calce", place: "Positano", type: "Interior", year: "2023" },
  { n: "012", name: "Villa Tre Pini pool", place: "Furore", type: "Landscape", year: "2022" },
  { n: "011", name: "Hanare guest house", place: "Kyoto", type: "Hospitality", year: "2021" },
  { n: "010", name: "Cantina Sciacca", place: "Ravello", type: "Winery, new build", year: "2019" },
];

export function Demo() {
  return (
    <div className="fd-fsm-demo">
      <style>{demoCss}</style>
      <FullscreenMenuNav />
      <main>
        <section className="fd-fsm-demo-hero">
          <p className="fd-fsm-demo-k">Since 1998 · 41 buildings · 3 of them still unfinished, on purpose</p>
          <h1>We build slowly, in stone, close to water.</h1>
        </section>
        <img className="fd-fsm-demo-img" src="/img/halcyon/pool-lemons.webp" alt="Pool terrace under lemon trees, Villa Tre Pini" width={1024} height={1024} />
        <section className="fd-fsm-demo-list" aria-label="Selected work">
          {WORKS.map((w) => (
            <a key={w.n} href="#work" className="fd-fsm-demo-row">
              <span>{w.n}</span><b>{w.name}</b><span>{w.place}</span><span>{w.type}</span><span>{w.year}</span>
            </a>
          ))}
        </section>
      </main>
    </div>
  );
}

const demoCss = `
.fd-fsm-demo { margin: 0; padding: 0; min-height: 100vh; background: #e9e5dc; color: #171614; font: 400 15px/1.5 ${sans}; }
.fd-fsm-demo *, .fd-fsm-demo *::before, .fd-fsm-demo *::after { box-sizing: border-box; }
.fd-fsm-demo main { display: block; margin: 0; padding: 0 28px 120px; }
.fd-fsm-demo-hero { display: grid; grid-template-columns: 1fr 3fr; gap: 28px; align-items: end; margin: 0; padding: 96px 0 48px; }
.fd-fsm-demo-k { margin: 0 0 12px; font: 400 0.75rem/1.5 ${mono}; color: #5f5b53; max-width: 26ch; }
.fd-fsm-demo h1 { margin: 0; font: 800 clamp(2.75rem, 7.4vw, 7rem)/0.9 ${sans}; letter-spacing: -0.055em; text-transform: uppercase; color: #171614; }
.fd-fsm-demo-img { display: block; width: 100%; height: 56vh; min-height: 320px; object-fit: cover; }
.fd-fsm-demo-list { margin: 48px 0 0; padding: 0; border-top: 1.5px solid #171614; }
.fd-fsm-demo-row { display: grid; grid-template-columns: 80px 2fr 1fr 1fr 80px; gap: 16px; align-items: baseline; padding: 18px 0; border-bottom: 1px solid rgba(23,22,20,0.2); color: #171614; text-decoration: none; font: 400 0.8125rem/1.3 ${mono}; transition: padding var(--fd-dur-2, 240ms) cubic-bezier(0.22, 1, 0.36, 1); }
.fd-fsm-demo-row b { font: 700 1.5rem/1.1 ${sans}; letter-spacing: -0.03em; }
.fd-fsm-demo-row span:last-child { text-align: right; }
.fd-fsm-demo-row:hover { background: #e2ddd2; }
@media (max-width: 860px) {
  .fd-fsm-demo main { padding: 0 18px 80px; }
  .fd-fsm-demo-hero { grid-template-columns: 1fr; padding: 48px 0 32px; }
  .fd-fsm-demo-row { grid-template-columns: 44px 1fr 48px; }
  .fd-fsm-demo-row span:nth-child(3), .fd-fsm-demo-row span:nth-child(4) { display: none; }
  .fd-fsm-demo-row b { font-size: 1.125rem; }
}
`;
