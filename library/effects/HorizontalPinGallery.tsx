/**
 * HorizontalPinGallery — vertical scroll drives a horizontal track. The
 * section pins (position: sticky) while a row of large cards slides sideways;
 * each card's artwork counter-moves inside its frame for parallax, and a
 * counter + progress bar track the active card.
 *
 * Props:
 * - items: { title, meta, year, art: ReactNode, caption? }[]
 * - heading: ReactNode shown in the pinned header (left).
 * - parallax: px of inner art travel per card (default 80).
 * - scrollContainer: optional ref; otherwise nearest scrollable ancestor.
 * CSS vars: --fd-hpg-bg, --fd-hpg-ink, --fd-hpg-card-w, --fd-hpg-gap.
 *
 * Browser support: evergreen (sticky + transforms). The section height is
 * computed from the track width so the scroll distance always matches.
 * Accessibility: cards are articles in DOM order; the track is reachable by
 * keyboard (Tab focuses each card and scrolls it into view). Reduced motion:
 * no pinning — the track becomes a native horizontal scroller with snap.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";

export type GalleryItem = { title: string; meta: string; year: string; art: ReactNode; caption?: string };

export interface HorizontalPinGalleryProps {
  items: GalleryItem[];
  heading?: ReactNode;
  parallax?: number;
  scrollContainer?: RefObject<HTMLElement | null>;
  className?: string;
  style?: CSSProperties;
}

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && p.scrollHeight > p.clientHeight + 1) return p;
    p = p.parentElement;
  }
  return null;
}

export function HorizontalPinGallery({ items, heading, parallax = 80, scrollContainer, className, style }: HorizontalPinGalleryProps) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const arts = useRef<(HTMLDivElement | null)[]>([]);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const bar = useRef<HTMLSpanElement>(null);
  const [idx, setIdx] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const el = root.current;
    const tr = track.current;
    if (!el || !tr) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      return;
    }
    const sc = scrollContainer?.current ?? findScrollParent(el);
    const target: HTMLElement | Window = sc ?? window;
    let dist = 0;
    let vh = 0;
    let vw = 0;
    let cardW = 0;
    let offsets: number[] = [];
    let raf = 0;
    let visible = true;
    let shown = -1;
    let lastT = 0;
    let cur = -1;

    const measure = () => {
      vh = sc ? sc.clientHeight : window.innerHeight;
      vw = tr.parentElement ? tr.parentElement.clientWidth : window.innerWidth;
      el.style.setProperty("--fd-hpg-vw", `${vw}px`);
      dist = Math.max(0, tr.scrollWidth - vw);
      el.style.height = `${Math.round(vh + dist)}px`;
      el.style.setProperty("--fd-hpg-vh", `${vh}px`);
      offsets = cards.current.map((c) => (c ? c.offsetLeft : 0));
      cardW = cards.current[0]?.offsetWidth ?? 1;
    };
    const progress = () => {
      const r = el.getBoundingClientRect();
      const top = sc ? r.top - sc.getBoundingClientRect().top : r.top;
      return dist > 0 ? clamp(-top / dist) : 0;
    };
    const render = (p: number) => {
      const x = -p * dist;
      tr.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      for (let i = 0; i < arts.current.length; i++) {
        const a = arts.current[i];
        if (!a) continue;
        // card centre relative to viewport centre, in card widths
        const c = (offsets[i] + x + cardW / 2 - vw / 2) / (cardW || 1);
        if (c < -2.5 || c > 2.5) continue;
        a.style.transform = `translate3d(${(-c * parallax).toFixed(2)}px,0,0) scale(1.18)`;
      }
      if (bar.current) bar.current.style.transform = `scaleX(${p.toFixed(4)})`;
      const k = Math.round(p * (items.length - 1));
      if (k !== cur) {
        cur = k;
        setIdx(k);
      }
    };
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
      lastT = t;
      const goal = progress();
      if (shown < 0) shown = goal;
      shown += (goal - shown) * (1 - Math.exp(-dt * 12));
      if (Math.abs(goal - shown) < 0.0003) shown = goal;
      render(shown);
      raf = shown !== goal ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!raf && visible) {
        lastT = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const onResize = () => {
      measure();
      render(shown < 0 ? progress() : shown);
    };
    // keyboard: focusing a card scrolls the page so that card is centred
    const onFocus = (e: FocusEvent) => {
      const i = cards.current.indexOf(e.target as HTMLElement);
      if (i < 0 || dist <= 0) return;
      const p = clamp((offsets[i] + cardW / 2 - vw / 2) / dist);
      const r = el.getBoundingClientRect();
      const top = sc ? r.top - sc.getBoundingClientRect().top : r.top;
      const y = (sc ? sc.scrollTop : window.scrollY) + top + p * dist;
      tr.parentElement?.scrollTo?.(0, 0);
      if (sc) sc.scrollTo({ top: y });
      else window.scrollTo({ top: y });
    };

    measure();
    shown = progress();
    render(shown);
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) kick();
      },
      { root: sc ?? null },
    );
    io.observe(el);
    const ro = new ResizeObserver(onResize);
    ro.observe(tr);
    target.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", onResize);
    tr.addEventListener("focusin", onFocus);
    return () => {
      io.disconnect();
      ro.disconnect();
      target.removeEventListener("scroll", kick);
      window.removeEventListener("resize", onResize);
      tr.removeEventListener("focusin", onFocus);
      if (raf) cancelAnimationFrame(raf);
      el.style.height = "";
    };
  }, [scrollContainer, parallax, items.length]);

  const n = String(items.length).padStart(2, "0");
  return (
    <section ref={root} className={`fd-hpg${className ? " " + className : ""}`} data-reduced={reduced ? "" : undefined} style={style}>
      <style>{css}</style>
      <div className="fd-hpg-pin">
        <header className="fd-hpg-head">
          <div className="fd-hpg-heading">{heading}</div>
          <div className="fd-hpg-count" aria-live="polite">
            <span className="fd-hpg-count-now">
              <span className="fd-hpg-roll" style={{ transform: `translate3d(0,${-idx}em,0)` }}>
                {items.map((_, i) => (
                  <span key={i} className="fd-hpg-roll-n">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                ))}
              </span>
            </span>
            <span className="fd-hpg-count-of">/ {n}</span>
          </div>
        </header>
        <div className="fd-hpg-viewport">
          <div ref={track} className="fd-hpg-track">
            {items.map((it, i) => (
              <article
                key={it.title}
                ref={(node) => {
                  cards.current[i] = node;
                }}
                className="fd-hpg-card"
                tabIndex={0}
                data-on={i === idx ? "" : undefined}
                aria-label={`${it.title}, ${it.meta}, ${it.year}`}
              >
                <div className="fd-hpg-frame">
                  <div
                    ref={(node) => {
                      arts.current[i] = node;
                    }}
                    className="fd-hpg-art"
                    aria-hidden="true"
                  >
                    {it.art}
                  </div>
                  {it.caption && <span className="fd-hpg-cap">{it.caption}</span>}
                </div>
                <div className="fd-hpg-info">
                  <span className="fd-hpg-i">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="fd-hpg-title">{it.title}</h3>
                  <span className="fd-hpg-meta">{it.meta}</span>
                  <span className="fd-hpg-year">{it.year}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="fd-hpg-foot" aria-hidden="true">
          <span className="fd-hpg-bar">
            <span ref={bar} className="fd-hpg-bar-fill" />
          </span>
        </div>
      </div>
    </section>
  );
}

const css = `
.fd-hpg{
  --fd-ease-out:cubic-bezier(0.22,1,0.36,1);--fd-ease-in-out:cubic-bezier(0.65,0,0.35,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-hpg-bg:#ECE8E1;--fd-hpg-ink:#171612;--fd-hpg-muted:#6E6A60;
  --fd-hpg-card-w:min(calc(var(--fd-hpg-vw,100vw) * .62),820px);--fd-hpg-gap:clamp(16px,2.4vw,40px);
  --fd-hpg-sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --fd-hpg-display:"SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter Display","Inter","Segoe UI",Roboto,sans-serif;
  --fd-hpg-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  position:relative;display:block;margin:0;padding:0;background:var(--fd-hpg-bg);color:var(--fd-hpg-ink);
}
.fd-hpg,.fd-hpg *,.fd-hpg *::before,.fd-hpg *::after{box-sizing:border-box}
.fd-hpg-pin{
  position:sticky;top:0;height:var(--fd-hpg-vh,100vh);display:grid;grid-template-rows:auto minmax(0,1fr) auto;grid-template-columns:minmax(0,1fr);overflow:hidden;
  margin:0;padding:clamp(20px,4vh,40px) 0 clamp(16px,3vh,28px);
}
.fd-hpg-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin:0;padding:0 clamp(16px,4vw,56px) clamp(14px,2.6vh,28px)}
.fd-hpg-heading{min-width:0;margin:0;padding:0}
.fd-hpg-count{display:inline-flex;align-items:baseline;gap:8px;flex:none;margin:0;padding:0;font:500 0.875rem/1 var(--fd-hpg-mono);color:var(--fd-hpg-muted)}
.fd-hpg-count-now{position:relative;display:inline-block;height:1em;overflow:hidden;color:var(--fd-hpg-ink);font:600 clamp(2rem,4vw,3rem)/1 var(--fd-hpg-display);letter-spacing:-0.03em;font-variant-numeric:tabular-nums}
.fd-hpg-roll{display:flex;flex-direction:column;transition:transform var(--fd-dur-3) var(--fd-ease-out)}
.fd-hpg-roll-n{display:block;height:1em}
.fd-hpg-viewport{position:relative;min-height:0;min-width:0;margin:0;padding:0;overflow:hidden}
.fd-hpg-track{
  display:flex;gap:var(--fd-hpg-gap);height:100%;width:max-content;margin:0;
  padding:0 calc((var(--fd-hpg-vw,100vw) - var(--fd-hpg-card-w)) / 2);will-change:transform;
}
.fd-hpg-card{
  position:relative;display:flex;flex-direction:column;gap:14px;width:var(--fd-hpg-card-w);height:100%;margin:0;padding:0;outline:none;
}
.fd-hpg-card:focus-visible .fd-hpg-frame{outline:2px solid rgba(0,122,255,.7);outline-offset:3px}
.fd-hpg-frame{
  position:relative;flex:1;min-height:0;margin:0;overflow:hidden;border-radius:20px;background:#CFC8BC;
  transform:scale(.94);transition:transform var(--fd-dur-4) var(--fd-ease-out);
}
.fd-hpg-card[data-on] .fd-hpg-frame{transform:none}
.fd-hpg-art{position:absolute;inset:0;margin:0;will-change:transform;transform:scale(1.18)}
.fd-hpg-art > *{display:block;width:100%;height:100%}
.fd-hpg-cap{
  position:absolute;left:16px;bottom:14px;padding:7px 10px;border-radius:9999px;
  background:rgba(23,22,18,.55);color:#F4F1EA;font:500 0.6875rem/1 var(--fd-hpg-mono);letter-spacing:.04em;
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
}
.fd-hpg-info{
  display:grid;grid-template-columns:auto 1fr auto;align-items:baseline;gap:4px 16px;margin:0;padding:0 2px;
  opacity:.45;transition:opacity var(--fd-dur-3) var(--fd-ease-out);
}
.fd-hpg-card[data-on] .fd-hpg-info{opacity:1}
.fd-hpg-i{color:var(--fd-hpg-muted);font:500 0.75rem/1 var(--fd-hpg-mono)}
.fd-hpg-title{margin:0;padding:0;color:var(--fd-hpg-ink);font:600 clamp(1.125rem,1.8vw,1.5rem)/1.15 var(--fd-hpg-display);letter-spacing:-0.02em}
.fd-hpg-year{color:var(--fd-hpg-muted);font:500 0.8125rem/1 var(--fd-hpg-mono)}
.fd-hpg-meta{grid-column:2;color:var(--fd-hpg-muted);font:400 0.875rem/1.35 var(--fd-hpg-sans)}
.fd-hpg-foot{display:flex;justify-content:center;margin:0;padding:clamp(14px,2.6vh,24px) 24px 0}
.fd-hpg-bar{position:relative;display:block;width:min(320px,60%);height:2px;border-radius:9999px;background:rgba(23,22,18,.12);overflow:hidden}
.fd-hpg-bar-fill{position:absolute;inset:0;display:block;background:var(--fd-hpg-ink);transform:scaleX(0);transform-origin:0 50%;will-change:transform}
@media (max-width:640px){
  .fd-hpg{--fd-hpg-card-w:calc(var(--fd-hpg-vw,100vw) * .82);--fd-hpg-gap:12px}
  .fd-hpg-frame{border-radius:16px}
  .fd-hpg-year{display:none}
  .fd-hpg-info{grid-template-columns:auto 1fr}
}
/* reduced motion: no pin, native horizontal scroller */
.fd-hpg[data-reduced] .fd-hpg-pin{position:relative;height:auto}
.fd-hpg[data-reduced] .fd-hpg-viewport{overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory}
.fd-hpg[data-reduced] .fd-hpg-track{height:min(70vh,560px);transform:none !important}
.fd-hpg[data-reduced] .fd-hpg-card{scroll-snap-align:center}
.fd-hpg[data-reduced] .fd-hpg-frame{transform:none}
.fd-hpg[data-reduced] .fd-hpg-art{transform:none !important}
.fd-hpg[data-reduced] .fd-hpg-info{opacity:1}
.fd-hpg[data-reduced] .fd-hpg-foot,.fd-hpg[data-reduced] .fd-hpg-count{display:none}
`;

/* ------------------------------------------------------------------ Demo */

type Scene = { sky: [string, string]; ground: string; ink: string; sun: string; kind: "tower" | "pavilion" | "bridge" | "house" | "library" | "chapel" };

function Building({ s }: { s: Scene }) {
  const gid = `fd-hpg-sky${useId().replace(/:/g, "")}`;
  // simple orthographic architecture: concrete masses, glazing lines, shadow planes
  const ink = s.ink;
  const body =
    s.kind === "tower" ? (
      <g>
        <rect x="430" y="90" width="150" height="420" fill={ink} />
        <rect x="580" y="90" width="44" height="420" fill="#000" opacity=".25" />
        {Array.from({ length: 18 }, (_, i) => (
          <rect key={i} x="438" y={104 + i * 22} width="134" height="3" fill="#fff" opacity=".22" />
        ))}
        <rect x="350" y="370" width="80" height="140" fill={ink} opacity=".75" />
        <rect x="624" y="300" width="110" height="210" fill={ink} opacity=".6" />
      </g>
    ) : s.kind === "pavilion" ? (
      <g>
        <path d="M200 330 L 800 300 L 800 316 L 200 346 Z" fill={ink} />
        {[260, 380, 500, 620, 740].map((x) => (
          <rect key={x} x={x} y={330 - (x - 200) * 0.05} width="8" height={180 + (x - 200) * 0.05} fill={ink} opacity=".85" />
        ))}
        <rect x="290" y="380" width="420" height="130" fill="#fff" opacity=".18" />
        <path d="M200 346 L 800 316 L 800 330 L 200 360 Z" fill="#000" opacity=".2" />
      </g>
    ) : s.kind === "bridge" ? (
      <g>
        <path d="M0 360 L 1000 330 L 1000 352 L 0 382 Z" fill={ink} />
        <path d="M120 377 C 300 250 500 250 680 355" fill="none" stroke={ink} strokeWidth="10" />
        {Array.from({ length: 16 }, (_, i) => {
          const x = 150 + i * 34;
          const t = (x - 120) / 560;
          const y = 377 - 4 * t * (1 - t) * 118;
          return <line key={i} x1={x} y1={y} x2={x} y2={372 - (x / 1000) * 30} stroke={ink} strokeWidth="2" opacity=".7" />;
        })}
        <rect x="0" y="420" width="1000" height="200" fill={s.sky[1]} opacity=".5" />
      </g>
    ) : s.kind === "house" ? (
      <g>
        <path d="M300 300 L 470 200 L 640 300 L 640 510 L 300 510 Z" fill={ink} />
        <path d="M640 300 L 470 200 L 520 200 L 700 300 L 700 510 L 640 510 Z" fill="#000" opacity=".3" />
        <rect x="350" y="360" width="110" height="150" fill={s.sun} opacity=".85" />
        <rect x="490" y="330" width="100" height="60" fill="#fff" opacity=".2" />
      </g>
    ) : s.kind === "library" ? (
      <g>
        <rect x="180" y="250" width="640" height="260" fill={ink} />
        {Array.from({ length: 20 }, (_, i) => (
          <rect key={i} x={196 + i * 31} y="270" width="14" height="220" fill="#fff" opacity={0.08 + (i % 3) * 0.06} />
        ))}
        <rect x="180" y="236" width="640" height="14" fill="#000" opacity=".3" />
      </g>
    ) : (
      <g>
        <path d="M420 510 L 420 260 C 420 170 580 170 580 260 L 580 510 Z" fill={ink} />
        <rect x="494" y="180" width="12" height="330" fill={s.sun} opacity=".9" />
        <path d="M580 510 L 580 260 C 580 210 560 190 540 182 C 600 190 640 220 640 270 L 640 510 Z" fill="#000" opacity=".28" />
      </g>
    );
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.sky[0]} />
          <stop offset="1" stopColor={s.sky[1]} />
        </linearGradient>
        <radialGradient id={`${gid}g`}>
          <stop offset="0" stopColor={s.sun} stopOpacity=".55" />
          <stop offset="1" stopColor={s.sun} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${gid}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.sky[1]} stopOpacity="0" />
          <stop offset="1" stopColor={s.sky[1]} stopOpacity=".55" />
        </linearGradient>
        <linearGradient id={`${gid}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".14" />
          <stop offset="1" stopColor="#000" stopOpacity=".25" />
        </linearGradient>
      </defs>
      <rect width="1000" height="620" fill={`url(#${gid})`} />
      <circle cx="760" cy="150" r="190" fill={`url(#${gid}g)`} />
      <circle cx="760" cy="150" r="70" fill={s.sun} opacity=".92" />
      <path d="M0 470 C 120 430 220 452 330 436 S 560 404 660 430 S 880 420 1000 440 L 1000 512 L 0 512 Z" fill={s.ink} opacity=".14" />
      <path d="M0 492 C 160 470 300 486 460 474 S 760 466 1000 484 L 1000 512 L 0 512 Z" fill={s.ink} opacity=".1" />
      <rect x="0" y="420" width="1000" height="92" fill={`url(#${gid}h)`} />
      <rect x="0" y="510" width="1000" height="110" fill={s.ground} />
      <rect x="0" y="510" width="1000" height="110" fill={`url(#${gid}r)`} />
      {body}
      <rect x="0" y="510" width="1000" height="2" fill="#000" opacity=".15" />
    </svg>
  );
}

const PROJECTS: (Omit<GalleryItem, "art"> & { scene: Scene })[] = [
  { title: "Vesterhavn Tower", meta: "Residential · Aarhus, DK · 31 floors", year: "2025", caption: "CLT hybrid structure", scene: { kind: "tower", sky: ["#F2C9A0", "#E7866A"], ground: "#5A3E33", ink: "#2A2220", sun: "#FFE6B8" } },
  { title: "Salt Pavilion", meta: "Cultural · Algarve, PT · 1,200 m²", year: "2024", caption: "Lime render, cork roof", scene: { kind: "pavilion", sky: ["#CFE3EA", "#8DB6C6"], ground: "#D8CFBE", ink: "#2F3B40", sun: "#FFFFFF" } },
  { title: "Ribe Footbridge", meta: "Infrastructure · Ribe, DK · 140 m span", year: "2023", caption: "Weathering steel", scene: { kind: "bridge", sky: ["#E9E4D8", "#B9C2BD"], ground: "#7A8A84", ink: "#3A3631", sun: "#F7EFD8" } },
  { title: "Casa Encosta", meta: "Private house · Sintra, PT · 280 m²", year: "2023", caption: "Board-formed concrete", scene: { kind: "house", sky: ["#2C3550", "#7E6C8F"], ground: "#2B2A33", ink: "#16161D", sun: "#F7B866" } },
  { title: "Nordlys Library", meta: "Civic · Tromsø, NO · 6,400 m²", year: "2022", caption: "Larch fins, triple glazing", scene: { kind: "library", sky: ["#0F2A35", "#2F7A74"], ground: "#0E1A1E", ink: "#0A1418", sun: "#B8F2D8" } },
  { title: "Chapel of Light", meta: "Sacred · Lleida, ES · 180 m²", year: "2021", caption: "Single slot skylight", scene: { kind: "chapel", sky: ["#F4E7D2", "#D9B892"], ground: "#B08F6A", ink: "#5C4632", sun: "#FFF5DE" } },
];

export function Demo() {
  const items: GalleryItem[] = PROJECTS.map(({ scene, ...p }) => ({ ...p, art: <Building s={scene} /> }));
  return (
    <div className="fd-hpg-demo">
      <style>{demoCss}</style>
      <section className="fd-hpg-demo-intro">
        <span className="fd-hpg-demo-logo">Atelier Holm &amp; Reis</span>
        <h1 className="fd-hpg-demo-h">Buildings that age well.</h1>
        <p className="fd-hpg-demo-p">An architecture practice in Copenhagen and Lisbon. Six recent projects, scroll to walk through them.</p>
        <p className="fd-hpg-demo-cue" aria-hidden="true">
          <span className="fd-hpg-demo-cue-line" />
          Scroll
        </p>
      </section>
      <HorizontalPinGallery
        items={items}
        heading={
          <>
            <span className="fd-hpg-demo-k">Selected work</span>
            <span className="fd-hpg-demo-t">2021 — 2025</span>
          </>
        }
      />
      <section className="fd-hpg-demo-outro">
        <p className="fd-hpg-demo-p">38 more projects in the archive →</p>
      </section>
    </div>
  );
}

const demoCss = `
.fd-hpg-demo{display:block;margin:0;padding:0;background:#ECE8E1;color:#171612;min-height:100vh}
.fd-hpg-demo,.fd-hpg-demo *{box-sizing:border-box}
.fd-hpg-demo-intro{display:flex;flex-direction:column;justify-content:flex-end;min-height:62vh;max-width:1240px;margin:0 auto;padding:32px clamp(16px,4vw,56px) 48px}
.fd-hpg-demo-logo{margin:0 0 auto;color:#171612;font:600 0.9375rem/1 ui-sans-serif,-apple-system,"Inter",sans-serif;letter-spacing:-0.01em}
.fd-hpg-demo-h{margin:0;padding:0;color:#171612;font:600 clamp(2.75rem,8vw,6.5rem)/.92 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.05em}
.fd-hpg-demo-p{margin:18px 0 0;padding:0;max-width:480px;color:#6E6A60;font:400 1.0625rem/1.45 ui-sans-serif,-apple-system,"Inter",sans-serif}
.fd-hpg-demo-cue{display:inline-flex;align-items:center;gap:10px;margin:28px 0 0;padding:0;color:#6E6A60;font:500 0.75rem/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}
.fd-hpg-demo-cue-line{position:relative;display:block;width:1px;height:28px;overflow:hidden;background:rgba(23,22,18,.15)}
.fd-hpg-demo-cue-line::after{content:"";position:absolute;left:0;top:0;width:1px;height:12px;background:#171612;animation:fd-hpg-cue 1.6s cubic-bezier(0.65,0,0.35,1) infinite}
@keyframes fd-hpg-cue{0%{transform:translateY(-12px)}100%{transform:translateY(28px)}}
.fd-hpg-demo-k{display:block;margin:0 0 6px;color:#6E6A60;font:500 0.75rem/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.06em;text-transform:uppercase}
.fd-hpg-demo-t{display:block;color:#171612;font:600 clamp(1.5rem,3vw,2.25rem)/1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.03em}
.fd-hpg-demo-outro{max-width:1240px;margin:0 auto;padding:48px clamp(16px,4vw,56px) 96px}
@media (prefers-reduced-motion: reduce){.fd-hpg-demo-cue-line::after{animation:none}}
`;
