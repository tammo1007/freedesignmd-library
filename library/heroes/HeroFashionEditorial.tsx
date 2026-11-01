/**
 * HeroFashionEditorial — a luxury-house campaign hero. A giant serif masthead
 * sets in letter by letter, and three art-directed "photographs" (procedural
 * duotone fabric folds built from SVG turbulence + displacement and layered
 * gradients, no image files) are revealed with clip-path wipes. On scroll the
 * masthead and the image strip drift horizontally in opposite directions; the
 * pointer adds a gentle parallax inside each frame.
 *
 * Props: house, season, collection, lookbook ({ title, caption, tone }[]),
 * primaryCta, secondaryCta. Tones: "oxblood" | "sand" | "ink" | "sage".
 * CSS vars: --fd-msn-paper, --fd-msn-ink, --fd-msn-accent.
 *
 * Browser support: all evergreen browsers. SVG filters render the fabric; if
 * a browser drops them the gradients alone still read as art-directed colour
 * fields.
 * Motion: CSS entrance (clip-path wipes, letter masks), rAF scroll drift and
 * pointer parallax (transform only, paused off-screen).
 * prefers-reduced-motion: final composition, no drift.
 * Accessibility: frames are role="img" with descriptive labels; masthead is
 * the page <h1>.
 */
import { useEffect, useId, useRef } from "react";

export type FabricTone = "oxblood" | "sand" | "ink" | "sage";
export type LookFrame = { title: string; caption: string; tone: FabricTone; label: string };

export interface HeroFashionEditorialProps {
  house?: string;
  season?: string;
  collection?: string;
  intro?: string;
  looks?: LookFrame[];
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

const TONES: Record<FabricTone, { a: string; b: string; c: string; hi: string }> = {
  oxblood: { a: "#2a0a0d", b: "#6e1a20", c: "#b8483f", hi: "#f2b9a0" },
  sand: { a: "#6b5640", b: "#b99a74", c: "#e4d0b0", hi: "#fff5e4" },
  ink: { a: "#07090f", b: "#1b2232", c: "#45506a", hi: "#c8d2ea" },
  sage: { a: "#26302a", b: "#5f7462", c: "#a9b9a3", hi: "#eef3e6" },
};

// luminance profile across the drape: uneven fold widths read as real cloth
const FOLDS = [
  [30, 90, 210, 120, 40, 70, 235, 160, 60, 110, 190, 80, 30],
  [60, 200, 140, 230, 90, 170, 250, 120, 70, 210, 150],
  [20, 60, 180, 70, 30, 110, 220, 90, 40, 150, 50],
];

const DEFAULT_LOOKS: LookFrame[] = [
  { title: "Look 07", caption: "Double-faced cashmere coat, oxblood", tone: "oxblood", label: "Close crop of oxblood double-faced cashmere falling in deep folds" },
  { title: "Look 12", caption: "Silk charmeuse slip, bone", tone: "sand", label: "Bone silk charmeuse catching light across soft diagonal folds" },
  { title: "Look 21", caption: "Wool gabardine trench, nocturne", tone: "ink", label: "Midnight wool gabardine with a cool highlight along the drape" },
];

export function HeroFashionEditorial({
  house = "MAISON VÉRANE",
  season = "Automne — Hiver 2026",
  collection = "Vérane",
  intro = "Forty-one looks cut in Biella wool, Como silk and the softest double-faced cashmere we have ever woven. Shown in Paris, 3 March.",
  looks = DEFAULT_LOOKS,
  primaryCta = { label: "Discover the collection", href: "#collection" },
  secondaryCta = { label: "Watch the show — 14 min", href: "#show" },
}: HeroFashionEditorialProps) {
  const root = useRef<HTMLElement>(null);
  const mast = useRef<HTMLHeadingElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const frames = useRef<(HTMLDivElement | null)[]>([]);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

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
    const t0 = performance.now();
    const frame = (now: number) => {
      raf = 0;
      sp.x += (sp.tx - sp.x) * 0.06;
      sp.y += (sp.ty - sp.y) * 0.06;
      const r = el.getBoundingClientRect();
      const p = Math.max(-0.2, Math.min(1, -r.top / Math.max(1, r.height)));
      const t = (now - t0) / 1000;
      if (mast.current) mast.current.style.transform = `translate3d(${(-p * 22).toFixed(2)}vw, ${(p * 40).toFixed(1)}px, 0)`;
      if (strip.current) strip.current.style.transform = `translate3d(${(p * 14).toFixed(2)}vw, ${(-p * 60).toFixed(1)}px, 0)`;
      frames.current.forEach((f, i) => {
        if (!f) return;
        const d = [1, -0.7, 0.85][i % 3];
        const breathe = Math.sin(t * 0.35 + i * 1.7) * 0.012;
        f.style.transform = `translate3d(${(sp.x * 14 * d).toFixed(2)}px, ${(sp.y * 10 * d + p * 40 * d).toFixed(2)}px, 0) scale(${(1.12 + breathe + p * 0.06).toFixed(4)})`;
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
    <section ref={root} className="fd-msn" aria-label={`${house} ${season}`}>
      <style>{css}</style>
      <svg className="fd-msn-defs" aria-hidden="true" focusable="false">
        {(["oxblood", "sand", "ink", "sage"] as FabricTone[]).map((tone, i) => {
          const c = TONES[tone];
          return (
            <filter key={tone} id={`${uid}-${tone}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency={`${0.0032 + i * 0.0006} ${0.0042 + i * 0.0005}`} numOctaves={2} seed={i * 7 + 3} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale={150} xChannelSelector="R" yChannelSelector="G" result="d" />
              <feGaussianBlur in="d" stdDeviation="5" result="b" />
              <feComponentTransfer in="b" result="g">
                <feFuncR type="table" tableValues={hexTable(c, 0)} />
                <feFuncG type="table" tableValues={hexTable(c, 1)} />
                <feFuncB type="table" tableValues={hexTable(c, 2)} />
              </feComponentTransfer>
            </filter>
          );
        })}
        <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.5 0" />
        </filter>
      </svg>

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
          <p className="fd-msn-kicker">The Autumn–Winter collection</p>
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
          {looks.map((l, i) => {
            const c = TONES[l.tone];
            return (
              <figure key={l.title} className={`fd-msn-fig fd-msn-fig-${i}`}>
                <div className="fd-msn-frame" role="img" aria-label={l.label} style={{ animationDelay: `${450 + i * 160}ms` }}>
                  <div ref={(n) => { frames.current[i] = n; }} className="fd-msn-photo">
                    <svg viewBox="0 0 400 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                      <defs>
                        <linearGradient id={`${uid}-g${i}`} x1="0" y1="0" x2="1" y2="1" gradientTransform={`rotate(${[18, -22, 8][i % 3]} .5 .5)`}>
                          {FOLDS[i % 3].map((v, k, arr) => (
                            <stop key={k} offset={k / (arr.length - 1)} stopColor={`rgb(${v},${v},${v})`} />
                          ))}
                        </linearGradient>
                      </defs>
                      <rect width="400" height="520" fill={c.b} />
                      <rect x="-80" y="-80" width="560" height="680" fill={`url(#${uid}-g${i})`} filter={`url(#${uid}-${l.tone})`} />
                    </svg>
                    <div className="fd-msn-light" style={{ background: `radial-gradient(80% 60% at ${[30, 70, 40][i % 3]}% ${[20, 30, 15][i % 3]}%, ${c.hi}55, transparent 60%), linear-gradient(180deg, transparent 50%, ${c.a}cc)` }} />
                    <svg className="fd-msn-grain" aria-hidden="true">
                      <rect width="100%" height="100%" filter={`url(#${uid}-grain)`} />
                    </svg>
                  </div>
                  <span className="fd-msn-tag">{l.title}</span>
                </div>
                <figcaption className="fd-msn-cap">{l.caption}</figcaption>
              </figure>
            );
          })}
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

function hexTable(c: { a: string; b: string; c: string; hi: string }, ch: number) {
  const stops = [c.a, c.a, c.b, c.c, c.hi];
  return stops.map((h) => (parseInt(h.slice(1 + ch * 2, 3 + ch * 2), 16) / 255).toFixed(3)).join(" ");
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
  --fd-msn-serif: "Didot", "Bodoni 72", "Bodoni MT", ui-serif, "New York", "Iowan Old Style", "Times New Roman", Georgia, serif;
  --fd-msn-sans: "Helvetica Neue", ui-sans-serif, -apple-system, "Inter", Arial, sans-serif;
  position: relative; display: block; overflow: hidden; margin: 0; padding: 0 0 28px; min-height: 860px;
  background: var(--fd-msn-paper); color: var(--fd-msn-ink); font: 400 1rem/1.5 var(--fd-msn-sans);
  isolation: isolate;
}
.fd-msn-defs { position: absolute; width: 0; height: 0; overflow: hidden; display: block; }
.fd-msn-top {
  display: flex; justify-content: space-between; gap: 16px; margin: 0; padding: 92px 40px 0;
  font: 500 0.6875rem/1 var(--fd-msn-sans); letter-spacing: 0.24em; text-transform: uppercase; color: #5a5048;
  animation: fd-msn-fade 1000ms var(--fd-ease-out) 900ms both;
}
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
.fd-msn-copy { padding-top: 4px; }
.fd-msn-kicker { margin: 0 0 14px; padding: 0; font: italic 400 1.25rem/1.2 var(--fd-msn-serif); letter-spacing: -0.005em; color: var(--fd-msn-accent); animation: fd-msn-fade var(--fd-dur-4) var(--fd-ease-out) 1000ms both; }
.fd-msn-intro { margin: 0; padding: 0; max-width: 22rem; font: 400 0.9375rem/1.6 var(--fd-msn-sans); letter-spacing: 0; color: #3a322c; text-wrap: pretty; animation: fd-msn-fade var(--fd-dur-4) var(--fd-ease-out) 1100ms both; }
.fd-msn-ctas { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; margin: 32px 0 0; animation: fd-msn-fade var(--fd-dur-4) var(--fd-ease-out) 1200ms both; }
.fd-msn-btn {
  display: inline-flex; align-items: center; gap: 14px; margin: 0; padding: 0 22px; height: 48px; border: 1px solid var(--fd-msn-ink); border-radius: 0;
  background: var(--fd-msn-ink); color: var(--fd-msn-paper); text-decoration: none;
  font: 500 0.6875rem/1 var(--fd-msn-sans); letter-spacing: 0.22em; text-transform: uppercase;
  transition: background var(--fd-dur-2) var(--fd-ease-out), color var(--fd-dur-2) var(--fd-ease-out);
}
.fd-msn-btn svg { display: block; transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.fd-msn-btn:hover { background: transparent; color: var(--fd-msn-ink); }
.fd-msn-btn:hover svg { transform: translateX(5px); }
.fd-msn-btn:active { transform: scale(0.96); }
.fd-msn-link {
  margin: 0; padding: 0 0 3px; color: var(--fd-msn-ink); text-decoration: none; border-bottom: 1px solid currentColor;
  font: 500 0.6875rem/1 var(--fd-msn-sans); letter-spacing: 0.22em; text-transform: uppercase;
}
.fd-msn-btn:focus-visible, .fd-msn-link:focus-visible { outline: 2px solid rgba(122,31,36,0.7); outline-offset: 3px; }
.fd-msn-strip { position: relative; z-index: 2; display: grid; grid-template-columns: 1.15fr 0.85fr 1fr; gap: 20px; align-items: start; margin-top: -15vw; will-change: transform; }
.fd-msn-fig { margin: 0; padding: 0; }
.fd-msn-fig-1 { margin-top: 64px; }
.fd-msn-fig-2 { margin-top: 18px; }
.fd-msn-frame {
  position: relative; overflow: hidden; aspect-ratio: 4 / 5; box-shadow: 0 30px 60px -30px rgba(22,18,15,0.45); background: #d9cfc2;
  clip-path: inset(100% 0 0 0); animation: fd-msn-wipe 1300ms var(--fd-ease-in-out) both;
}
.fd-msn-fig-1 .fd-msn-frame { aspect-ratio: 3 / 4; clip-path: inset(0 100% 0 0); animation-name: fd-msn-wipe-x; }
.fd-msn-photo { position: absolute; inset: 0; will-change: transform; transform: scale(1.12); }
.fd-msn-photo > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.fd-msn-light { position: absolute; inset: 0; mix-blend-mode: soft-light; }
.fd-msn-grain { position: absolute; inset: 0; width: 100%; height: 100%; display: block; mix-blend-mode: overlay; opacity: 0.35; }
.fd-msn-tag {
  position: absolute; left: 14px; top: 14px; padding: 0; margin: 0;
  font: 500 0.625rem/1 var(--fd-msn-sans); letter-spacing: 0.24em; text-transform: uppercase; color: rgba(255,255,255,0.86);
}
.fd-msn-cap { margin: 12px 0 0; padding: 0; font: italic 400 0.9375rem/1.3 var(--fd-msn-serif); color: #3a322c; letter-spacing: 0; animation: fd-msn-fade var(--fd-dur-4) var(--fd-ease-out) 1500ms both; }
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

@media (max-width: 860px) {
  .fd-msn { min-height: 844px; padding-bottom: 72px; }
  .fd-msn-top { padding: 84px 16px 0; letter-spacing: 0.18em; }
  .fd-msn-hide-s { display: none; }
  .fd-msn-top span { white-space: nowrap; }
  .fd-msn-top span:last-child { display: none; }
  .fd-msn-mastwrap { padding: 0 12px; }
  .fd-msn-mast { margin-top: 14px; }
  .fd-msn-body { grid-template-columns: 1fr; gap: 28px; margin-top: 24px; padding: 0 16px; }
  .fd-msn-strip { grid-template-columns: 1.2fr 1fr; gap: 12px; margin-top: 0; }
  .fd-msn-fig-1 { margin-top: 40px; }
  .fd-msn-fig-2 { display: none; }
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
