/**
 * HeroFashionEditorial — a luxury-house campaign hero. A giant serif masthead
 * sets in letter by letter, and three campaign photographs (two cloth close
 * crops and the house fragrance) are revealed with clip-path wipes. Each frame
 * carries a ruled caption: look number, piece, price. On scroll the masthead
 * and the image strip drift horizontally in opposite directions; the pointer
 * adds a gentle parallax inside each frame, and hovering a frame lifts its
 * caption rule into the house red.
 *
 * Props: house, season, collection, intro, looks ({ no, title, detail, price,
 * src, alt }[]), primaryCta, secondaryCta.
 * CSS vars: --fd-msn-paper, --fd-msn-ink, --fd-msn-accent.
 *
 * Browser support: all evergreen browsers.
 * Motion: CSS entrance (clip-path wipes, letter masks), rAF scroll drift and
 * pointer parallax (transform only, paused off-screen).
 * prefers-reduced-motion: final composition, no drift.
 * Accessibility: images carry descriptive alt text; the masthead is the page
 * <h1>; captions are real <figcaption>s.
 */
import { useEffect, useRef } from "react";

export type LookFrame = {
  no: string;
  title: string;
  detail: string;
  price: string;
  src: string;
  alt: string;
};

export interface HeroFashionEditorialProps {
  house?: string;
  season?: string;
  collection?: string;
  kicker?: string;
  intro?: string;
  looks?: LookFrame[];
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

const DEFAULT_LOOKS: LookFrame[] = [
  {
    no: "Look 07",
    title: "Double-faced cashmere coat",
    detail: "Terracotta, hand-finished seams",
    price: "€4,900",
    src: "/img/lux/drape-terra.webp",
    alt: "Close crop of terracotta double-faced cashmere falling in long soft folds",
  },
  {
    no: "N°38",
    title: "Vérane eau de parfum",
    detail: "Amber, iris, cedar",
    price: "€285",
    src: "/img/lux/perfume-noir.webp",
    alt: "An amber Vérane perfume bottle on a dark plinth under a warm arched alcove",
  },
  {
    no: "Look 21",
    title: "Wool gabardine trench",
    detail: "Nocturne, Biella cloth",
    price: "€3,600",
    src: "/img/lux/drape-ink.webp",
    alt: "Midnight-blue wool gabardine with cool highlights running down the drape",
  },
];

export function HeroFashionEditorial({
  house = "MAISON VÉRANE",
  season = "Automne-Hiver 2026",
  collection = "Vérane",
  kicker = "The Autumn-Winter collection",
  intro = "Forty-one looks cut in Biella wool, Como silk and the softest double-faced cashmere we have ever woven. Shown in Paris, 3 March.",
  looks = DEFAULT_LOOKS,
  primaryCta = { label: "Discover the collection", href: "#collection" },
  secondaryCta = { label: "Watch the show, 14 min", href: "#show" },
}: HeroFashionEditorialProps) {
  const root = useRef<HTMLElement>(null);
  const mast = useRef<HTMLHeadingElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const frames = useRef<(HTMLImageElement | null)[]>([]);

  // fit the masthead to the full measure, whatever serif the system resolves
  useEffect(() => {
    const h = mast.current;
    const wrap = h?.parentElement;
    if (!h || !wrap) return;
    const fit = () => {
      h.style.fontSize = "";
      const avail = wrap.clientWidth - parseFloat(getComputedStyle(wrap).paddingLeft) * 2;
      const fs = parseFloat(getComputedStyle(h).fontSize);
      const w = h.scrollWidth;
      if (w > 0) h.style.fontSize = `${Math.floor(fs * (avail / w) * 0.995)}px`;
    };
    fit();
    const r1 = requestAnimationFrame(fit);
    const t1 = window.setTimeout(fit, 400);
    document.fonts?.ready.then(fit).catch(() => {});
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(r1);
      window.clearTimeout(t1);
    };
  }, [collection]);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sp = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      sp.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      sp.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    el.addEventListener("pointermove", onMove);
    let raf = 0;
    let visible = true;
    const frame = () => {
      raf = 0;
      sp.x += (sp.tx - sp.x) * 0.06;
      sp.y += (sp.ty - sp.y) * 0.06;
      const r = el.getBoundingClientRect();
      const p = Math.max(-0.2, Math.min(1, -r.top / Math.max(1, r.height)));
      if (mast.current) mast.current.style.transform = `translate3d(${(-p * 22).toFixed(2)}vw, ${(p * 40).toFixed(1)}px, 0)`;
      if (strip.current) strip.current.style.transform = `translate3d(${(p * 14).toFixed(2)}vw, ${(-p * 60).toFixed(1)}px, 0)`;
      frames.current.forEach((f, i) => {
        if (!f) return;
        const d = [1, -0.7, 0.85][i % 3];
        f.style.transform = `translate3d(${(sp.x * 12 * d).toFixed(2)}px, ${(sp.y * 9 * d + p * 36 * d).toFixed(2)}px, 0) scale(${(1.1 + p * 0.05).toFixed(4)})`;
      });
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
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
    };
  }, []);

  const letters = Array.from(collection);

  return (
    <section ref={root} className="fd-msn" aria-label={`${house}, ${season}`}>
      <style>{css}</style>

      <div className="fd-msn-top">
        <span>{season}</span>
        <span className="fd-msn-hide-s">Collection N°&nbsp;38</span>
        <span>Paris · Milano · Tokyo</span>
      </div>

      <div className="fd-msn-mastwrap">
        <h1 ref={mast} className="fd-msn-mast" aria-label={collection}>
          {letters.map((ch, i) => (
            <span key={i} className="fd-msn-ch" aria-hidden="true">
              <span style={{ animationDelay: `${120 + i * 70}ms` }}>{ch}</span>
            </span>
          ))}
        </h1>
      </div>

      <div className="fd-msn-body">
        <div className="fd-msn-copy">
          <p className="fd-msn-kicker">{kicker}</p>
          <p className="fd-msn-intro">{intro}</p>
          <div className="fd-msn-ctas">
            <a className="fd-msn-btn" href={primaryCta.href}>
              {primaryCta.label}
              <svg viewBox="0 0 20 10" width="20" height="10" aria-hidden="true">
                <path d="M0 5h18M14 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </a>
            <a className="fd-msn-link" href={secondaryCta.href}>
              {secondaryCta.label}
            </a>
          </div>
        </div>

        <div ref={strip} className="fd-msn-strip">
          {looks.map((l, i) => (
            <figure key={l.no + l.title} className={`fd-msn-fig fd-msn-fig-${i}`}>
              <div className="fd-msn-frame" style={{ animationDelay: `${450 + i * 160}ms` }}>
                <img
                  ref={(n) => {
                    frames.current[i] = n;
                  }}
                  className="fd-msn-photo"
                  src={l.src}
                  alt={l.alt}
                  width={1200}
                  height={1500}
                  decoding="async"
                />
              </div>
              <figcaption className="fd-msn-cap">
                <span className="fd-msn-no">{l.no}</span>
                <span className="fd-msn-what">
                  <i>{l.title}</i>
                  <small>{l.detail}</small>
                </span>
                <b className="fd-msn-price">{l.price}</b>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="fd-msn-foot" aria-hidden="true">
        <span className="fd-msn-scroll">
          <i />
          Scroll
        </span>
      </div>
    </section>
  );
}

const css = `
.fd-msn, .fd-msn *, .fd-msn *::before, .fd-msn *::after { box-sizing: border-box; }
.fd-msn {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-msn-paper: #F3EEE6;
  --fd-msn-ink: #16120F;
  --fd-msn-accent: #7A1F24;
  --fd-msn-rule: rgba(22,18,15,0.18);
  --fd-msn-serif: "Didot", "Bodoni 72", "Bodoni MT", ui-serif, "New York", "Iowan Old Style", "Times New Roman", Georgia, serif;
  --fd-msn-sans: "Helvetica Neue", ui-sans-serif, -apple-system, "Inter", Arial, sans-serif;
  position: relative; display: block; overflow: hidden; margin: 0; padding: 0 0 28px; min-height: 860px;
  background: var(--fd-msn-paper); color: var(--fd-msn-ink); font: 400 1rem/1.5 var(--fd-msn-sans);
  isolation: isolate;
}
.fd-msn-top {
  display: flex; justify-content: space-between; gap: 16px; margin: 0; padding: 92px 40px 0;
  font: 500 0.6875rem/1 var(--fd-msn-sans); letter-spacing: 0.24em; text-transform: uppercase; color: #5a5048;
  animation: fd-msn-fade 1000ms var(--fd-ease-out) 900ms both;
}
.fd-msn-top span { margin: 0; padding: 0; }
.fd-msn-mastwrap { position: relative; z-index: 0; margin: 0; padding: 0 28px; }
.fd-msn-mast {
  width: max-content;
  display: block; margin: 6px 0 0; padding: 0; white-space: nowrap; will-change: transform;
  font: 400 clamp(5.5rem, 26vw, 26rem)/0.8 var(--fd-msn-serif); letter-spacing: -0.035em;
  color: var(--fd-msn-ink);
  font-optical-sizing: auto;
}
.fd-msn-ch { display: inline-block; overflow: hidden; padding: 0.04em 0 0.02em; }
.fd-msn-ch > span { display: inline-block; animation: fd-msn-up 1100ms var(--fd-ease-out) both; }
.fd-msn-body {
  position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 2fr); gap: 48px; align-items: start;
  margin: 28px 0 0; padding: 0 40px;
}
.fd-msn-copy { margin: 0; padding: 4px 0 0; }
.fd-msn-kicker { margin: 0 0 14px; padding: 0; font: italic 400 1.25rem/1.2 var(--fd-msn-serif); letter-spacing: -0.005em; color: var(--fd-msn-accent); animation: fd-msn-fade var(--fd-dur-4) var(--fd-ease-out) 1000ms both; }
.fd-msn-intro { margin: 0; padding: 0; max-width: 22rem; font: 400 0.9375rem/1.6 var(--fd-msn-sans); letter-spacing: 0; color: #3a322c; text-wrap: pretty; animation: fd-msn-fade var(--fd-dur-4) var(--fd-ease-out) 1100ms both; }
.fd-msn-ctas { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; margin: 32px 0 0; padding: 0; animation: fd-msn-fade var(--fd-dur-4) var(--fd-ease-out) 1200ms both; }
.fd-msn-btn {
  display: inline-flex; align-items: center; gap: 14px; margin: 0; padding: 0 22px; height: 48px; border: 1px solid var(--fd-msn-ink); border-radius: 0;
  background: var(--fd-msn-ink); color: var(--fd-msn-paper); text-decoration: none;
  font: 500 0.6875rem/1 var(--fd-msn-sans); letter-spacing: 0.22em; text-transform: uppercase;
  transition: background var(--fd-dur-2) var(--fd-ease-out), color var(--fd-dur-2) var(--fd-ease-out), transform var(--fd-dur-2) var(--fd-spring);
}
.fd-msn-btn svg { display: block; transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.fd-msn-btn:hover { background: transparent; color: var(--fd-msn-ink); }
.fd-msn-btn:hover svg { transform: translateX(5px); }
.fd-msn-btn:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-msn-link {
  margin: 0; padding: 0 0 3px; color: var(--fd-msn-ink); text-decoration: none; border-bottom: 1px solid currentColor;
  font: 500 0.6875rem/1 var(--fd-msn-sans); letter-spacing: 0.22em; text-transform: uppercase;
  transition: color var(--fd-dur-1);
}
.fd-msn-link:hover { color: var(--fd-msn-accent); }
.fd-msn-btn:focus-visible, .fd-msn-link:focus-visible { outline: 2px solid rgba(122,31,36,0.7); outline-offset: 3px; }

.fd-msn-strip { position: relative; z-index: 2; display: grid; grid-template-columns: 1.15fr 0.85fr 1fr; gap: 24px; align-items: start; margin-top: -15vw; will-change: transform; }
.fd-msn-fig { margin: 0; padding: 0; min-width: 0; }
.fd-msn-fig-1 { margin-top: 72px; }
.fd-msn-fig-2 { margin-top: 20px; }
.fd-msn-frame {
  position: relative; overflow: hidden; aspect-ratio: 4 / 5; margin: 0; padding: 0; background: #d9cfc2;
  clip-path: inset(100% 0 0 0); animation: fd-msn-wipe 1300ms var(--fd-ease-in-out) both;
}
.fd-msn-fig-1 .fd-msn-frame { aspect-ratio: 3 / 4; clip-path: inset(0 100% 0 0); animation-name: fd-msn-wipe-x; }
.fd-msn-photo { position: absolute; inset: 0; display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; object-fit: cover; will-change: transform; transform: scale(1.1); }
.fd-msn-fig-1 .fd-msn-photo { object-position: 50% 62%; }

.fd-msn-cap {
  position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: baseline;
  margin: 0; padding: 12px 0 0; border-top: 1px solid var(--fd-msn-rule);
  animation: fd-msn-fade var(--fd-dur-4) var(--fd-ease-out) 1500ms both;
}
.fd-msn-cap::before {
  content: ""; position: absolute; left: 0; right: 0; top: -1px; height: 1px; background: var(--fd-msn-accent);
  transform: scaleX(0); transform-origin: left; transition: transform var(--fd-dur-4) var(--fd-ease-out);
}
.fd-msn-fig:hover .fd-msn-cap::before { transform: scaleX(1); }
.fd-msn-no { margin: 0; padding: 0; font: 500 0.625rem/1.6 var(--fd-msn-sans); letter-spacing: 0.22em; text-transform: uppercase; color: #6a5f55; white-space: nowrap; }
.fd-msn-what { display: flex; flex-direction: column; gap: 3px; margin: 0; padding: 0; min-width: 0; }
.fd-msn-what i { display: block; font: italic 400 1rem/1.25 var(--fd-msn-serif); letter-spacing: 0; color: var(--fd-msn-ink); }
.fd-msn-what small { display: block; font: 400 0.75rem/1.35 var(--fd-msn-sans); letter-spacing: 0; color: #6a5f55; }
.fd-msn-price { margin: 0; padding: 0; font: 500 0.75rem/1.6 var(--fd-msn-sans); letter-spacing: 0.04em; color: var(--fd-msn-ink); font-variant-numeric: tabular-nums; white-space: nowrap; }

.fd-msn-foot {
  position: absolute; left: 40px; right: 40px; bottom: 26px; display: flex; justify-content: flex-end; align-items: center;
  font: 500 0.625rem/1 var(--fd-msn-sans); letter-spacing: 0.3em; text-transform: uppercase; color: #5a5048;
  animation: fd-msn-fade 1000ms var(--fd-ease-out) 1600ms both;
}
.fd-msn-scroll { display: inline-flex; align-items: center; gap: 12px; }
.fd-msn-scroll i { display: block; width: 40px; height: 1px; background: currentColor; transform-origin: left; animation: fd-msn-line 2400ms var(--fd-ease-in-out) infinite; }

@keyframes fd-msn-up { from { transform: translateY(102%); } to { transform: none; } }
@keyframes fd-msn-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes fd-msn-wipe { from { clip-path: inset(100% 0 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes fd-msn-wipe-x { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes fd-msn-line { 0% { transform: scaleX(0); } 50% { transform: scaleX(1); transform-origin: left; } 50.01% { transform-origin: right; } 100% { transform: scaleX(0); transform-origin: right; } }

@media (max-width: 1100px) {
  .fd-msn-cap { grid-template-columns: minmax(0, 1fr) auto; row-gap: 6px; }
  .fd-msn-no { grid-column: 1 / -1; }
}
@media (max-width: 860px) {
  .fd-msn { min-height: 844px; padding-bottom: 72px; }
  .fd-msn-top { padding: 84px 16px 0; letter-spacing: 0.18em; }
  .fd-msn-hide-s { display: none; }
  .fd-msn-top span { white-space: nowrap; }
  .fd-msn-top span:last-child { display: none; }
  .fd-msn-mastwrap { padding: 0 12px; }
  .fd-msn-mast { margin-top: 14px; }
  .fd-msn-body { grid-template-columns: 1fr; gap: 32px; margin-top: 24px; padding: 0 16px; }
  .fd-msn-strip { grid-template-columns: 1.15fr 1fr; gap: 12px; margin-top: 0; }
  .fd-msn-fig-1 { margin-top: 44px; }
  .fd-msn-fig-2 { display: none; }
  .fd-msn-cap { grid-template-columns: 1fr; gap: 4px; padding-top: 10px; }
  .fd-msn-what i { font-size: 0.875rem; }
  .fd-msn-what small { display: none; }
  .fd-msn-ctas { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 20px; margin-top: 22px; }
  .fd-msn-foot { left: 16px; right: 16px; bottom: 22px; }
  .fd-msn-copy { order: 2; }
  .fd-msn-intro { max-width: none; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-msn *, .fd-msn *::before { animation: none !important; }
  .fd-msn-frame { clip-path: none; }
}
`;

/* ───────────────────────── Demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-msn-demo">
      <style>{demoCss}</style>
      <header className="fd-msn-demo-nav">
        <nav aria-label="Shop">
          <a href="#women">Women</a>
          <a href="#men">Men</a>
          <a href="#leather">Leather goods</a>
        </nav>
        <a className="fd-msn-demo-logo" href="#top">MAISON VÉRANE</a>
        <div className="fd-msn-demo-r">
          <a href="#stores">Stores</a>
          <a href="#bag" aria-label="Shopping bag, 2 items">Bag (2)</a>
        </div>
      </header>
      <HeroFashionEditorial />
    </div>
  );
}

const demoCss = `
.fd-msn-demo { position: relative; margin: 0; padding: 0; min-height: 100vh; background: #F3EEE6; }
.fd-msn-demo *, .fd-msn-demo *::before, .fd-msn-demo *::after { box-sizing: border-box; }
.fd-msn-demo-nav {
  position: absolute; z-index: 10; top: 0; left: 0; right: 0; height: 64px; padding: 0 40px; margin: 0;
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  border-bottom: 1px solid rgba(22,18,15,0.12);
  animation: fd-msn-demo-in 900ms cubic-bezier(0.22, 1, 0.36, 1) 800ms both;
}
.fd-msn-demo-nav nav, .fd-msn-demo-r { display: flex; gap: 28px; margin: 0; padding: 0; }
.fd-msn-demo-r { justify-content: flex-end; }
.fd-msn-demo-nav a { color: #16120F; text-decoration: none; font: 500 0.6875rem/1 "Helvetica Neue", ui-sans-serif, -apple-system, "Inter", Arial, sans-serif; letter-spacing: 0.2em; text-transform: uppercase; }
.fd-msn-demo-nav a:focus-visible { outline: 2px solid rgba(122,31,36,.7); outline-offset: 3px; }
.fd-msn-demo-nav .fd-msn-demo-logo { font: 400 1.0625rem/1 "Didot", "Bodoni 72", ui-serif, "New York", "Times New Roman", Georgia, serif; letter-spacing: 0.32em; }
@keyframes fd-msn-demo-in { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 860px) {
  .fd-msn-demo-nav { padding: 0 16px; grid-template-columns: auto 1fr auto; gap: 12px; }
  .fd-msn-demo-nav nav a:not(:first-child), .fd-msn-demo-r a:first-child { display: none; }
  .fd-msn-demo-nav .fd-msn-demo-logo { font-size: 0.875rem; letter-spacing: 0.24em; text-align: center; }
}
@media (prefers-reduced-motion: reduce) { .fd-msn-demo-nav { animation: none; } }
`;
