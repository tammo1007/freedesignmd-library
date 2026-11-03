/**
 * HeroTravelParallax, a ryokan hero. A washi-paper column carries the
 * headline, lede and a ruled row of house facts; the right side is a
 * photograph of a guest room opening onto the moss garden, framed by two
 * shoji screens that slide apart on load. The screens can be slid shut again
 * with a button: the garden then glows through translucent paper. The photo
 * drifts with the pointer on a spring and sinks on scroll while the copy
 * lifts away. A booking bar spans both columns.
 *
 * Props: brand, kicker, title, lede, facts ({ k, v }[]), image ({ src, alt,
 * caption }), location, checkIn, checkOut, guests, nightly (number), currency,
 * onSearch(values).
 * CSS vars: --fd-alp-paper, --fd-alp-ink, --fd-alp-accent, --fd-alp-wood.
 *
 * Browser support: all evergreen browsers. Closed shoji use backdrop-filter
 * for the paper glow and fall back to an opaque paper tone when unsupported or
 * when prefers-reduced-transparency is set.
 * Motion: shoji slide with --fd-ease-in-out over --fd-dur-4 ×2; pointer
 * parallax on a spring (k=380, c=30, mass 4); scroll-linked depth via rAF +
 * getBoundingClientRect (transform/opacity only, paused off screen).
 * prefers-reduced-motion: screens start open, no parallax, no slide.
 * Accessibility: the booking bar is a real <form> with labelled inputs; the
 * shoji toggle is a <button aria-pressed>; the photo has alt text.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

export interface HeroTravelParallaxProps {
  brand?: string;
  kicker?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  facts?: { k: string; v: string }[];
  image?: { src: string; alt: string; caption?: string };
  location?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  nightly?: number;
  currency?: string;
  onSearch?: (v: { location: string; checkIn: string; checkOut: string; guests: number }) => void;
}

const DEFAULT_FACTS = [
  { k: "Bath", v: "Hinoki, 06:00 to 23:00" },
  { k: "Dinner", v: "Kaiseki at 18:30" },
  { k: "Maples", v: "Peak 18 to 30 Nov" },
];

export function HeroTravelParallax({
  brand = "Hanare",
  kicker = "Higashiyama, Kyoto · 35.00°N · 9 rooms",
  title = (
    <>
      Nine rooms,
      <br />
      one garden,
      <br />
      <em>no hurry.</em>
    </>
  ),
  lede = "A 1926 machiya off Shinmonzen-dōri, restored joint by joint. Cypress baths, kaiseki by Aya Morikawa, and a moss garden raked at six every morning before anyone is up.",
  facts = DEFAULT_FACTS,
  image = {
    src: "/img/halcyon/ryokan.webp",
    alt: "A tatami room with a cypress soaking tub, its shoji open onto a moss garden under a red maple",
    caption: "Room 4, Kaede. North garden, 07:40",
  },
  location = "Hanare, Higashiyama, Kyoto",
  checkIn = "2027-11-18",
  checkOut = "2027-11-22",
  guests = 2,
  nightly = 68000,
  currency = "¥",
  onSearch,
}: HeroTravelParallaxProps) {
  const root = useRef<HTMLElement>(null);
  const photo = useRef<HTMLImageElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [vals, setVals] = useState({ location, checkIn, checkOut, guests });
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(false);

  // slide the shoji open once the page has settled
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOpen(true);
      return;
    }
    const t = window.setTimeout(() => setOpen(true), 450);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sp = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      sp.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      sp.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const onLeave = () => {
      sp.tx = 0;
      sp.ty = 0;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let lastSig = "";
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      for (let i = 0; i < 2; i++) {
        const h = dt / 2;
        sp.vx += ((-380 * (sp.x - sp.tx) - 30 * sp.vx) / 4) * h;
        sp.vy += ((-380 * (sp.y - sp.ty) - 30 * sp.vy) / 4) * h;
        sp.x += sp.vx * h;
        sp.y += sp.vy * h;
      }
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height * 0.8)));
      const sig = `${sp.x.toFixed(4)}|${sp.y.toFixed(4)}|${p.toFixed(4)}`;
      if (sig !== lastSig) {
        lastSig = sig;
        if (photo.current) photo.current.style.transform = `translate3d(${(-sp.x * 14).toFixed(2)}px, ${(-sp.y * 10 + p * 70).toFixed(2)}px, 0) scale(${(1.08 + p * 0.04).toFixed(4)})`;
        if (copy.current) {
          copy.current.style.transform = `translate3d(0, ${(p * -70).toFixed(1)}px, 0)`;
          copy.current.style.opacity = `${(1 - p * 1.3).toFixed(3)}`;
        }
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", start);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch?.(vals);
    setSent(true);
    window.setTimeout(() => setSent(false), 1800);
  };

  const nights = Math.max(1, Math.round((Date.parse(vals.checkOut) - Date.parse(vals.checkIn)) / 864e5) || 1);

  return (
    <section ref={root} className="fd-alp" data-open={open ? "" : undefined} aria-label={`${brand}, ryokan in Kyoto`}>
      <style>{css}</style>

      <div ref={copy} className="fd-alp-copy">
        <p className="fd-alp-kicker">{kicker}</p>
        <h1 className="fd-alp-h1">{title}</h1>
        <p className="fd-alp-lede">{lede}</p>
        <dl className="fd-alp-facts">
          {facts.map((f) => (
            <div key={f.k}>
              <dt>{f.k}</dt>
              <dd>{f.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="fd-alp-pic">
        <img ref={photo} className="fd-alp-img" src={image.src} alt={image.alt} width={1024} height={1024} fetchPriority="high" />
        <div className="fd-alp-shoji fd-alp-shoji-l" aria-hidden="true">
          <i className="fd-alp-hikite" />
        </div>
        <div className="fd-alp-shoji fd-alp-shoji-r" aria-hidden="true">
          <i className="fd-alp-hikite" />
        </div>
        <div className="fd-alp-picbar">
          {image.caption && <p className="fd-alp-cap">{image.caption}</p>}
          <button type="button" className="fd-alp-slide" aria-pressed={!open} onClick={() => setOpen((o) => !o)}>
            <svg viewBox="0 0 20 14" width="20" height="14" aria-hidden="true">
              <rect x="0.75" y="0.75" width="18.5" height="12.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M10 1v12M5.4 1v12M14.6 1v12M1 7h18" stroke="currentColor" strokeWidth="0.9" />
            </svg>
            {open ? "Close the shoji" : "Open the shoji"}
          </button>
        </div>
      </div>

      <form className="fd-alp-book" onSubmit={submit} aria-label="Check availability">
        <label className="fd-alp-f fd-alp-f-loc">
          <span>Where</span>
          <input value={vals.location} onChange={(e) => setVals({ ...vals, location: e.target.value })} />
        </label>
        <label className="fd-alp-f">
          <span>Check in</span>
          <input type="date" value={vals.checkIn} onChange={(e) => setVals({ ...vals, checkIn: e.target.value })} />
        </label>
        <label className="fd-alp-f">
          <span>Check out</span>
          <input type="date" value={vals.checkOut} onChange={(e) => setVals({ ...vals, checkOut: e.target.value })} />
        </label>
        <div className="fd-alp-f fd-alp-f-g">
          <span id={`${uid}-g`}>Guests</span>
          <div className="fd-alp-step" role="group" aria-labelledby={`${uid}-g`}>
            <button type="button" aria-label="Fewer guests" onClick={() => setVals({ ...vals, guests: Math.max(1, vals.guests - 1) })}>
              −
            </button>
            <output aria-live="polite">{vals.guests}</output>
            <button type="button" aria-label="More guests" onClick={() => setVals({ ...vals, guests: Math.min(4, vals.guests + 1) })}>
              +
            </button>
          </div>
        </div>
        <button type="submit" className="fd-alp-go">
          <span>{sent ? "Checking the ledger…" : "Check availability"}</span>
          <small>
            {nights} {nights === 1 ? "night" : "nights"}, from {currency}
            {(nightly * nights).toLocaleString("en-US")}
          </small>
        </button>
      </form>
    </section>
  );
}

const lattice = (c: string) =>
  `linear-gradient(90deg, ${c} 3px, transparent 3px), linear-gradient(180deg, ${c} 3px, transparent 3px)`;

const css = `
.fd-alp, .fd-alp *, .fd-alp *::before, .fd-alp *::after { box-sizing: border-box; }
.fd-alp {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-alp-paper: #F1ECE2;
  --fd-alp-ink: #1F1B17;
  --fd-alp-muted: #6B6158;
  --fd-alp-accent: #A8382A;
  --fd-alp-wood: #4A3526;
  --fd-alp-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --fd-alp-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  --fd-alp-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
  --fd-alp-gutter: max(40px, calc(50vw - 640px));
  position: relative; display: block; overflow: hidden; margin: 0; padding: 0; height: 100vh; min-height: 760px; max-height: 1000px;
  background: var(--fd-alp-paper); color: var(--fd-alp-ink); font: 400 1rem/1.5 var(--fd-alp-sans); isolation: isolate;
}

.fd-alp-copy { position: absolute; left: var(--fd-alp-gutter); top: 0; bottom: 150px; width: calc(42% - var(--fd-alp-gutter) - 32px); display: flex; flex-direction: column; justify-content: center; margin: 0; padding: 76px 0 0; will-change: transform, opacity; }
.fd-alp-kicker {
  margin: 0 0 26px; padding: 0; color: var(--fd-alp-muted);
  font: 500 0.6875rem/1 var(--fd-alp-mono); letter-spacing: 0.14em; text-transform: uppercase;
  animation: fd-alp-rise var(--fd-dur-4) var(--fd-ease-out) 200ms both;
}
.fd-alp-h1 {
  margin: 0; padding: 0; color: var(--fd-alp-ink);
  font: 400 clamp(3rem, 5.4vw, 5.5rem)/0.96 var(--fd-alp-serif); letter-spacing: -0.035em;
  animation: fd-alp-rise 1000ms var(--fd-ease-out) 260ms both;
}
.fd-alp-h1 em { font-style: italic; color: var(--fd-alp-accent); }
.fd-alp-lede {
  margin: 26px 0 0; padding: 0; max-width: 30rem; color: #4A423B;
  font: 400 1.0625rem/1.6 var(--fd-alp-sans); letter-spacing: -0.008em; text-wrap: pretty;
  animation: fd-alp-rise var(--fd-dur-4) var(--fd-ease-out) 480ms both;
}
.fd-alp-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; margin: 32px 0 0; padding: 0; max-width: 32rem; border-top: 1px solid rgba(31,27,23,0.16); animation: fd-alp-rise var(--fd-dur-4) var(--fd-ease-out) 600ms both; }
.fd-alp-facts > div { margin: 0; padding: 12px 12px 0 0; }
.fd-alp-facts > div + div { padding-left: 12px; border-left: 1px solid rgba(31,27,23,0.1); }
.fd-alp-facts dt { margin: 0; padding: 0; font: 500 0.625rem/1 var(--fd-alp-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--fd-alp-accent); }
.fd-alp-facts dd { margin: 6px 0 0; padding: 0; font: 400 0.8125rem/1.35 var(--fd-alp-sans); color: var(--fd-alp-ink); }

.fd-alp-pic { position: absolute; top: 0; right: 0; bottom: 0; width: 58%; margin: 0; overflow: hidden; background: #2A211B; }
.fd-alp-img { position: absolute; inset: -4%; display: block; width: 108%; height: 108%; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; object-fit: cover; object-position: 60% 50%; will-change: transform; transform: scale(1.08); }
.fd-alp-shoji {
  position: absolute; top: 0; bottom: 0; width: 50.5%; margin: 0;
  background-color: rgba(246,240,229,0.72);
  background-image: ${lattice("rgba(74,53,38,0.9)")}, radial-gradient(120% 90% at 50% 40%, rgba(255,250,240,0.55), rgba(232,222,204,0.2));
  background-size: 25% 12.5%, 25% 12.5%, 100% 100%;
  background-position: -1px -1px, -1px -1px, 0 0;
  border: 9px solid var(--fd-alp-wood);
  -webkit-backdrop-filter: blur(9px) saturate(0.7) brightness(1.15); backdrop-filter: blur(9px) saturate(0.7) brightness(1.15);
  box-shadow: inset 0 0 40px rgba(74,53,38,0.25);
  transition: transform 1400ms var(--fd-ease-in-out);
}
.fd-alp-shoji-l { left: 0; }
.fd-alp-shoji-r { right: 0; }
.fd-alp[data-open] .fd-alp-shoji-l { transform: translateX(-101%); }
.fd-alp[data-open] .fd-alp-shoji-r { transform: translateX(101%); }
.fd-alp-hikite { position: absolute; top: 50%; width: 10px; height: 34px; margin: -17px 0 0; border-radius: 9999px; background: var(--fd-alp-wood); box-shadow: inset 0 0 0 2px rgba(0,0,0,0.25); }
.fd-alp-shoji-l .fd-alp-hikite { right: 14px; }
.fd-alp-shoji-r .fd-alp-hikite { left: 14px; }

.fd-alp-picbar { position: absolute; left: 28px; right: 28px; top: 92px; display: flex; justify-content: space-between; align-items: center; gap: 16px; margin: 0; padding: 0; z-index: 2; }
.fd-alp-cap { margin: 0; padding: 7px 10px; background: rgba(31,27,23,0.62); color: #F1ECE2; font: 500 0.6875rem/1 var(--fd-alp-mono); letter-spacing: 0.06em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.fd-alp-slide {
  appearance: none; -webkit-appearance: none; cursor: pointer; flex: none; display: inline-flex; align-items: center; gap: 9px; height: 36px; margin: 0; padding: 0 14px; border: 0; border-radius: 9999px;
  background: var(--fd-alp-paper); color: var(--fd-alp-ink); font: 500 0.8125rem/1 var(--fd-alp-sans); letter-spacing: -0.005em;
  box-shadow: 0 8px 24px -10px rgba(0,0,0,0.5);
  transition: transform var(--fd-dur-2) var(--fd-spring), background var(--fd-dur-1);
}
.fd-alp-slide svg { display: block; color: var(--fd-alp-wood); }
.fd-alp-slide:hover { background: #fff; }
.fd-alp-slide:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }

.fd-alp-book {
  position: absolute; left: var(--fd-alp-gutter); right: 40px; bottom: 40px; z-index: 3; margin: 0; padding: 8px;
  display: grid; grid-template-columns: 1.5fr 1fr 1fr 0.8fr auto; gap: 0; align-items: stretch;
  border-radius: 4px; background: var(--fd-alp-paper); border: 1px solid rgba(31,27,23,0.14);
  box-shadow: 0 30px 70px -36px rgba(31,27,23,0.55);
  animation: fd-alp-bar 1000ms var(--fd-ease-out) 700ms both;
}
.fd-alp-f { display: flex; flex-direction: column; justify-content: center; gap: 6px; margin: 0; padding: 10px 18px; border-radius: 2px; min-width: 0; transition: background var(--fd-dur-1); }
.fd-alp-f + .fd-alp-f { box-shadow: inset 1px 0 0 rgba(31,27,23,0.1); }
.fd-alp-f:hover, .fd-alp-f:focus-within { background: #E8E1D4; }
.fd-alp-f > span { display: block; margin: 0; font: 500 0.625rem/1 var(--fd-alp-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--fd-alp-muted); }
.fd-alp-f input {
  appearance: none; -webkit-appearance: none; display: block; width: 100%; margin: 0; padding: 0; border: 0; outline: 0; background: transparent;
  font: 500 0.9375rem/1.3 var(--fd-alp-sans); letter-spacing: -0.01em; color: var(--fd-alp-ink); min-width: 0;
}
.fd-alp-f input::-webkit-calendar-picker-indicator { opacity: 0.45; }
.fd-alp-step { display: flex; align-items: center; gap: 12px; }
.fd-alp-step button {
  appearance: none; -webkit-appearance: none; display: grid; place-items: center; width: 26px; height: 26px; margin: 0; padding: 0; border-radius: 9999px; cursor: pointer;
  border: 1px solid rgba(31,27,23,0.22); background: transparent; color: var(--fd-alp-ink); font: 500 0.9375rem/1 var(--fd-alp-sans);
  transition: transform var(--fd-dur-2) var(--fd-spring), background var(--fd-dur-1);
}
.fd-alp-step button:hover { background: rgba(31,27,23,0.06); }
.fd-alp-step button:active { transform: scale(0.9); transition-duration: var(--fd-dur-1); }
.fd-alp-step output { min-width: 1ch; font: 500 0.9375rem/1 var(--fd-alp-sans); color: var(--fd-alp-ink); font-variant-numeric: tabular-nums; }
.fd-alp-go {
  appearance: none; -webkit-appearance: none; cursor: pointer; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 5px;
  margin: 0; padding: 0 26px; border: 0; border-radius: 2px; background: var(--fd-alp-ink); color: #F1ECE2; text-align: left;
  transition: transform var(--fd-dur-2) var(--fd-spring), background var(--fd-dur-1);
}
.fd-alp-go span { font: 600 0.9375rem/1.1 var(--fd-alp-sans); letter-spacing: -0.01em; white-space: nowrap; }
.fd-alp-go small { font: 400 0.75rem/1 var(--fd-alp-sans); color: rgba(241,236,226,0.7); white-space: nowrap; font-variant-numeric: tabular-nums; }
.fd-alp-go:hover { background: var(--fd-alp-accent); }
.fd-alp-go:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-alp-go:focus-visible, .fd-alp-step button:focus-visible, .fd-alp-slide:focus-visible { outline: 2px solid rgba(168,56,42,0.7); outline-offset: 2px; }

@keyframes fd-alp-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes fd-alp-bar { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: none; } }

@media (max-width: 1100px) {
  .fd-alp-copy { width: calc(46% - var(--fd-alp-gutter) - 24px); }
  .fd-alp-pic { width: 54%; }
  .fd-alp-facts { grid-template-columns: 1fr; }
  .fd-alp-facts > div + div { padding-left: 0; border-left: 0; }
}
@media (max-width: 860px) {
  .fd-alp { display: flex; flex-direction: column; height: auto; min-height: 844px; max-height: none; --fd-alp-gutter: 20px; }
  .fd-alp-copy { position: relative; left: auto; top: auto; bottom: auto; width: auto; margin: 0; padding: 92px 20px 28px; }
  .fd-alp-kicker { margin-bottom: 18px; font-size: 0.625rem; }
  .fd-alp-h1 { font-size: 3.25rem; }
  .fd-alp-lede { margin-top: 18px; font-size: 0.9375rem; }
  .fd-alp-facts { display: none; }
  .fd-alp-pic { position: relative; top: auto; right: auto; bottom: auto; width: 100%; height: 330px; flex: none; }
  .fd-alp-picbar { top: auto; bottom: 64px; left: 16px; right: 16px; justify-content: flex-end; }
  .fd-alp-cap { display: none; }
  .fd-alp-shoji { border-width: 6px; }
  .fd-alp-book { position: relative; left: auto; right: auto; bottom: auto; margin: -44px 16px 24px; grid-template-columns: 1fr 1fr; padding: 6px; }
  .fd-alp-f { padding: 10px 12px; }
  .fd-alp-f + .fd-alp-f { box-shadow: none; }
  .fd-alp-f-loc, .fd-alp-go { grid-column: 1 / -1; }
  .fd-alp-f-loc { box-shadow: inset 0 -1px 0 rgba(31,27,23,0.1); }
  .fd-alp-go { min-height: 56px; margin-top: 4px; flex-direction: row; justify-content: space-between; align-items: center; padding: 0 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-alp *, .fd-alp *::before { animation: none !important; }
  .fd-alp-shoji { transition: none; }
}
@media (prefers-reduced-transparency: reduce) { .fd-alp-shoji { background-color: #EDE6D8; -webkit-backdrop-filter: none; backdrop-filter: none; } }
`;

/* ───────────────────────── Demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-alp-demo">
      <style>{demoCss}</style>
      <header className="fd-alp-demo-nav">
        <a className="fd-alp-demo-logo" href="#top">
          <svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true">
            <rect x="1" y="1" width="20" height="20" fill="none" stroke="#1F1B17" strokeWidth="1.6" />
            <path d="M11 1v20M1 11h20" stroke="#1F1B17" strokeWidth="1.1" />
            <rect x="12.4" y="12.4" width="7.2" height="7.2" fill="#A8382A" />
          </svg>
          Hanare
        </a>
        <nav aria-label="Primary">
          <a href="#rooms">Rooms</a>
          <a href="#bath">Bath</a>
          <a href="#kaiseki">Kaiseki</a>
          <a href="#kyoto">Kyoto notes</a>
        </nav>
        <a className="fd-alp-demo-cta" href="#reserve">Reserve</a>
      </header>
      <HeroTravelParallax />
      <section className="fd-alp-demo-after" aria-label="Rooms">
        <p>Nine rooms, each with its own corner of the garden.</p>
        <ul>
          <li><b>Tsuki</b><span>Garden room · 32 m²</span><em>from ¥68,000</em></li>
          <li><b>Kaede</b><span>Corner room, hinoki tub · 41 m²</span><em>from ¥84,000</em></li>
          <li><b>Hanare</b><span>The detached house · 66 m²</span><em>from ¥142,000</em></li>
        </ul>
      </section>
    </div>
  );
}

const demoCss = `
.fd-alp-demo { position: relative; margin: 0; padding: 0; min-height: 100vh; background: #F1ECE2; }
.fd-alp-demo *, .fd-alp-demo *::before, .fd-alp-demo *::after { box-sizing: border-box; }
.fd-alp-demo-nav {
  position: absolute; z-index: 10; top: 0; left: 0; right: 0; height: 76px; margin: 0; padding: 0 40px 0 max(40px, calc(50vw - 640px));
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 40px;
  animation: fd-alp-demo-in 900ms cubic-bezier(0.22, 1, 0.36, 1) 300ms both;
}
.fd-alp-demo-logo { display: inline-flex; align-items: center; gap: 10px; margin: 0; color: #1F1B17; text-decoration: none; font: 400 1.375rem/1 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; letter-spacing: 0.02em; }
.fd-alp-demo-logo svg { display: block; }
.fd-alp-demo-nav nav { display: flex; gap: 26px; margin: 0; padding: 0; }
.fd-alp-demo-nav nav a { color: #4A423B; text-decoration: none; font: 500 0.8125rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; letter-spacing: 0; transition: color 120ms; }
.fd-alp-demo-nav nav a:hover { color: #A8382A; }
.fd-alp-demo-cta { grid-column: 3; display: inline-flex; align-items: center; height: 38px; padding: 0 18px; border-radius: 9999px; color: #1F1B17; background: #F1ECE2; text-decoration: none; font: 600 0.8125rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; box-shadow: 0 8px 24px -10px rgba(0,0,0,0.5); }
.fd-alp-demo-nav a:focus-visible { outline: 2px solid rgba(168,56,42,.7); outline-offset: 2px; }
.fd-alp-demo-after { margin: 0; padding: 96px max(20px, calc(50vw - 560px)) 120px; background: #1F1B17; color: #F1ECE2; }
.fd-alp-demo-after p { margin: 0; padding: 0; max-width: 22ch; font: 400 clamp(1.75rem, 3.4vw, 2.75rem)/1.1 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; letter-spacing: -0.02em; text-wrap: balance; }
.fd-alp-demo-after ul { margin: 40px 0 0; padding: 0; list-style: none; border-top: 1px solid rgba(241,236,226,0.16); }
.fd-alp-demo-after li { display: grid; grid-template-columns: 140px minmax(0, 1fr) auto; gap: 16px; align-items: baseline; margin: 0; padding: 18px 0; border-bottom: 1px solid rgba(241,236,226,0.1); }
.fd-alp-demo-after b { font: 400 1.25rem/1.2 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; color: #fff; }
.fd-alp-demo-after span { font: 400 0.875rem/1.3 ui-sans-serif, -apple-system, "Inter", sans-serif; color: rgba(241,236,226,0.62); }
.fd-alp-demo-after em { font: 500 0.8125rem/1 ui-monospace, "SF Mono", Menlo, monospace; font-style: normal; color: #E9A99E; }
@keyframes fd-alp-demo-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
@media (max-width: 1100px) { .fd-alp-demo-nav nav { display: none; } }
@media (max-width: 860px) {
  .fd-alp-demo-nav { height: 64px; padding: 0 20px; }
  .fd-alp-demo-cta { background: #1F1B17; color: #F1ECE2; box-shadow: none; height: 36px; }
  .fd-alp-demo-after li { grid-template-columns: 1fr auto; }
  .fd-alp-demo-after li span { grid-column: 1 / -1; grid-row: 2; }
}
@media (prefers-reduced-motion: reduce) { .fd-alp-demo-nav { animation: none; } }
`;
