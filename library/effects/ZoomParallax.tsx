/**
 * ZoomParallax, Apple-style "zoom out" scroll scene. A full-bleed hero tile
 * starts filling the viewport; as you scroll, it shrinks into the centre of a
 * 7-tile mosaic while the six surrounding tiles scale and drift into place.
 * Text overlays fade out as the grid settles, a caption fades in.
 *
 * Props:
 * - tiles: exactly 7 ReactNodes; tiles[0] is the hero (centre) tile.
 * - overlay: ReactNode shown on the hero at the start (fades out).
 * - caption: ReactNode shown under the settled grid.
 * - length: scroll length in viewport heights (default 2.6).
 * - scrollContainer: optional ref; otherwise nearest scrollable ancestor.
 * CSS vars: --fd-zpx-bg, --fd-zpx-gap, --fd-zpx-radius.
 *
 * Layout: 4×3 mosaic on wide stages (hero spans 2×2), 2×4 under 640px.
 * Each tile's final rect is measured once per resize; per frame, only
 * transforms are written (FLIP-style inverse scale from the full-bleed rect).
 * Browser support: evergreen (sticky + transforms).
 * Demo images: /img/lux/{dunes,bamboo,lantern,still-vase,still-tea} and /img/halcyon/{positano-sunset,pool-lemons}.webp (+ -800
 * variants), included in the repo's public/img/lux, copy them next to your page or swap in your own.
 * Accessibility: tiles are aria-hidden art unless you pass labelled content;
 * overlay/caption text is real text. Reduced motion shows the settled grid.
 */
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";

export interface ZoomParallaxProps {
  tiles: ReactNode[];
  overlay?: ReactNode;
  caption?: ReactNode;
  length?: number;
  scrollContainer?: RefObject<HTMLElement | null>;
  className?: string;
  style?: CSSProperties;
}

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && p.scrollHeight > p.clientHeight + 1) return p;
    p = p.parentElement;
  }
  return null;
}

export function ZoomParallax({ tiles, overlay, caption, length = 2.6, scrollContainer, className, style }: ZoomParallaxProps) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cells = useRef<(HTMLDivElement | null)[]>([]);
  const inners = useRef<(HTMLDivElement | null)[]>([]);
  const ov = useRef<HTMLDivElement>(null);
  const cap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const st = stage.current;
    if (!el || !st) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.reduced = "";
      return;
    }
    const sc = scrollContainer?.current ?? findScrollParent(el);
    const target: HTMLElement | Window = sc ?? window;
    if (sc) el.dataset.contained = "";

    type Geo = { cx: number; cy: number; w: number; h: number };
    let geo: Geo[] = [];
    let S = { w: 0, h: 0 };
    let vh = 0;
    let raf = 0;
    let visible = true;
    let shown = -1;
    let lastT = 0;

    const measure = () => {
      vh = sc ? sc.clientHeight : window.innerHeight;
      if (sc) el.style.setProperty("--fd-zpx-vh", `${vh}px`);
      // read final layout with transforms cleared
      cells.current.forEach((c) => c && (c.style.transform = "none"));
      const sr = st.getBoundingClientRect();
      S = { w: sr.width, h: sr.height };
      geo = cells.current.map((c) => {
        if (!c) return { cx: 0, cy: 0, w: 1, h: 1 };
        const r = c.getBoundingClientRect();
        return { cx: r.left - sr.left + r.width / 2, cy: r.top - sr.top + r.height / 2, w: r.width, h: r.height };
      });
    };
    const progress = () => {
      const r = el.getBoundingClientRect();
      const top = sc ? r.top - sc.getBoundingClientRect().top : r.top;
      const range = r.height - vh;
      return range > 0 ? clamp(-top / range) : 0;
    };
    const render = (p: number) => {
      // 0 → .78 : zoom out; .78 → 1 : hold
      const z = ease(clamp(p / 0.78));
      const hero = geo[0];
      if (!hero) return;
      // scale that makes the hero cover the stage
      const cover = Math.max(S.w / hero.w, S.h / hero.h);
      const k = cover + (1 - cover) * z; // current scale of the whole mosaic
      // the mosaic scales around the hero centre, which itself moves to stage centre at start
      const ox = (S.w / 2 - hero.cx) * (1 - z);
      const oy = (S.h / 2 - hero.cy) * (1 - z);
      for (let i = 0; i < geo.length; i++) {
        const c = cells.current[i];
        const g = geo[i];
        if (!c) continue;
        // per-tile stagger: outer tiles lag a bit and drift in (parallax)
        const dx = g.cx - hero.cx;
        const dy = g.cy - hero.cy;
        const lag = i === 0 ? 0 : 0.18 + 0.08 * ((i * 37) % 5) / 4;
        const zi = i === 0 ? z : easeOut(clamp((p / 0.78 - lag) / (1 - lag)));
        const ki = i === 0 ? k : cover * 1.25 + (1 - cover * 1.25) * zi;
        const tx = ox + dx * (k - 1) + dx * (ki - k) * 0.35;
        const ty = oy + dy * (k - 1) + dy * (ki - k) * 0.35;
        c.style.transform = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${(i === 0 ? k : ki).toFixed(4)})`;
        c.style.opacity = i === 0 ? "1" : clamp(zi * 1.6).toFixed(3);
        const inner = inners.current[i];
        // counter-scale content slightly so the hero art doesn't blow up linearly
        if (inner) inner.style.transform = `scale(${(1 + (i === 0 ? 0.18 : 0.3) * (1 - zi)).toFixed(4)})`;
      }
      if (ov.current) {
        const o = 1 - clamp(p / 0.28);
        ov.current.style.opacity = o.toFixed(3);
        ov.current.style.transform = `translate3d(0,${(-30 * (1 - o)).toFixed(2)}px,0)`;
      }
      if (cap.current) {
        const o = clamp((p - 0.7) / 0.2);
        cap.current.style.opacity = o.toFixed(3);
        cap.current.style.transform = `translate3d(0,${(16 * (1 - o)).toFixed(2)}px,0)`;
      }
      st.style.setProperty("--fd-zpx-r", `${(28 * (0.15 + 0.85 * z)).toFixed(2)}px`);
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
    ro.observe(st);
    target.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      io.disconnect();
      ro.disconnect();
      target.removeEventListener("scroll", kick);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollContainer, tiles.length]);

  return (
    <section ref={root} className={`fd-zpx${className ? " " + className : ""}`} style={{ ["--fd-zpx-len" as string]: String(length), ...style }}>
      <style>{css}</style>
      <div className="fd-zpx-pin">
        <div ref={stage} className="fd-zpx-stage">
          <div className="fd-zpx-grid">
            {tiles.slice(0, 7).map((t, i) => (
              <div
                key={i}
                ref={(n) => {
                  cells.current[i] = n;
                }}
                className="fd-zpx-cell"
                data-i={i}
              >
                <div
                  ref={(n) => {
                    inners.current[i] = n;
                  }}
                  className="fd-zpx-inner"
                >
                  {t}
                </div>
              </div>
            ))}
          </div>
          {overlay && (
            <div ref={ov} className="fd-zpx-overlay">
              {overlay}
            </div>
          )}
          {caption && (
            <div ref={cap} className="fd-zpx-caption">
              {caption}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const css = `
.fd-zpx{
  --fd-zpx-bg:#F5F2EC;--fd-zpx-gap:12px;--fd-zpx-r:28px;
  position:relative;display:block;margin:0;padding:0;background:var(--fd-zpx-bg);
  height:calc(var(--fd-zpx-len) * 100vh);height:calc(var(--fd-zpx-len) * 100svh);
}
.fd-zpx,.fd-zpx *,.fd-zpx *::before,.fd-zpx *::after{box-sizing:border-box}
.fd-zpx[data-contained]{height:calc(var(--fd-zpx-len) * var(--fd-zpx-vh,100vh))}
.fd-zpx-pin{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;margin:0;padding:0}
.fd-zpx[data-contained] .fd-zpx-pin{height:var(--fd-zpx-vh,100vh)}
.fd-zpx-stage{position:relative;width:100%;height:100%;margin:0;padding:clamp(16px,4vh,40px) clamp(16px,3vw,40px) clamp(64px,12vh,112px)}
.fd-zpx-grid{
  display:grid;width:100%;height:100%;margin:0;padding:0;gap:var(--fd-zpx-gap);
  grid-template-columns:1fr 1.15fr 1.15fr 1fr;grid-template-rows:1fr 1fr 1fr;
  grid-template-areas:"a h h b" "c h h d" "e f f f";
}
.fd-zpx-cell{position:relative;min-width:0;min-height:0;overflow:hidden;border-radius:var(--fd-zpx-r);will-change:transform,opacity;transform-origin:50% 50%;background:#ddd}
.fd-zpx-cell[data-i="0"]{grid-area:h;z-index:2}
.fd-zpx-cell[data-i="1"]{grid-area:a}.fd-zpx-cell[data-i="2"]{grid-area:b}.fd-zpx-cell[data-i="3"]{grid-area:c}
.fd-zpx-cell[data-i="4"]{grid-area:d}.fd-zpx-cell[data-i="5"]{grid-area:e}.fd-zpx-cell[data-i="6"]{grid-area:f}
.fd-zpx-inner{position:absolute;inset:0;will-change:transform}
.fd-zpx-inner > *{display:block;width:100%;height:100%}
.fd-zpx-overlay{position:absolute;inset:0;z-index:5;isolation:isolate;display:flex;flex-direction:column;justify-content:flex-end;pointer-events:none;padding:clamp(24px,6vh,64px) clamp(20px,5vw,72px)}
.fd-zpx-caption{position:absolute;left:0;right:0;bottom:0;z-index:5;display:flex;align-items:center;justify-content:center;height:clamp(64px,12vh,112px);opacity:0;padding:0 16px}
@media (max-width:640px){
  .fd-zpx{--fd-zpx-gap:8px}
  .fd-zpx-grid{grid-template-columns:1fr 1fr;grid-template-rows:.8fr 1.3fr 1.3fr .8fr;grid-template-areas:"a b" "h h" "h h" "e f"}
  .fd-zpx-cell[data-i="3"],.fd-zpx-cell[data-i="4"]{display:none}
  .fd-zpx-cell[data-i="6"]{grid-area:f}
}
.fd-zpx[data-reduced]{height:auto}
.fd-zpx[data-reduced] .fd-zpx-pin{position:relative;height:100vh}
.fd-zpx[data-reduced] .fd-zpx-overlay{display:none}
.fd-zpx[data-reduced] .fd-zpx-caption{opacity:1}
`;

/* ------------------------------------------------------------------ Demo */

const TILES: { src: string; label: string; place: string; pos: string }[] = [
  { src: "../halcyon/positano-sunset", label: "Cliffside village of pastel houses above the sea at golden hour", place: "Positano", pos: "70% 50%" },
  { src: "dunes", label: "Wind-carved golden desert dunes under a violet dusk sky", place: "Wadi Rum", pos: "60% 50%" },
  { src: "bamboo", label: "Sunlight through a bamboo grove", place: "Arashiyama", pos: "50% 50%" },
  { src: "../halcyon/pool-lemons", label: "Lemon pergola and blue pool above the Amalfi coastline", place: "Ravello", pos: "65% 50%" },
  { src: "lantern", label: "Glowing paper lanterns against dark striped timber", place: "Gion, Kyoto", pos: "50% 45%" },
  { src: "still-vase", label: "White ceramic vase with an olive branch in an arch niche", place: "Tuscany", pos: "50% 60%" },
  { src: "still-tea", label: "Black teapot and two cups on a dark tray", place: "Fez", pos: "50% 60%" },
];

export function Demo() {
  return (
    <div className="fd-zpx-demo">
      <style>{demoCss}</style>
      <ZoomParallax
        tiles={TILES.map((t, i) => (
          <figure key={t.src} className="fd-zpx-demo-fig">
            <img src={`/img/lux/${t.src}${i === 0 ? "" : "-800"}.webp`} width={i === 0 || i === 1 || i === 3 ? 1920 : 1200} height={i === 0 || i === 1 || i === 3 ? 1200 : 1500} alt={t.label} loading={i === 0 ? "eager" : "lazy"} decoding="async" style={{ objectPosition: t.pos }} />
            <figcaption className="fd-zpx-demo-place">{t.place}</figcaption>
          </figure>
        ))}
        overlay={
          <div className="fd-zpx-demo-ov">
            <span className="fd-zpx-demo-brand">Wayfarer &amp; Co.</span>
            <h1 className="fd-zpx-demo-h">
              Slow travel,
              <br />
              far from the crowds.
            </h1>
            <p className="fd-zpx-demo-cue" aria-hidden="true">
              <span className="fd-zpx-demo-cue-line" />
              Scroll
            </p>
          </div>
        }
        caption={
          <p className="fd-zpx-demo-cap">
            <strong>212 small-group journeys</strong> · 41 countries · guides who live there
          </p>
        }
      />
      <section className="fd-zpx-demo-after">
        <h2 className="fd-zpx-demo-h2">Autumn departures open 3 November.</h2>
      </section>
    </div>
  );
}

const demoCss = `
.fd-zpx-demo{display:block;margin:0;padding:0;background:#F5F2EC;color:#1A1714;min-height:100vh}
.fd-zpx-demo,.fd-zpx-demo *{box-sizing:border-box}
.fd-zpx-demo-fig{position:relative;display:block;width:100%;height:100%;margin:0;padding:0}
.fd-zpx-demo-fig img{display:block;width:100%;height:100%;max-width:none;margin:0;padding:0;object-fit:cover}
.fd-zpx-demo-place{position:absolute;left:12px;bottom:10px;margin:0;padding:5px 9px;border-radius:9999px;background:rgba(20,16,12,.38);color:#fff;
  font:500 0.6875rem/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.03em;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.fd-zpx-overlay::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(to top,rgba(24,14,10,.55),rgba(24,14,10,0) 55%),linear-gradient(to bottom,rgba(24,14,10,.25),rgba(24,14,10,0) 20%)}
.fd-zpx-demo-ov{display:flex;flex-direction:column;height:100%;color:#fff;text-shadow:0 2px 30px rgba(40,14,8,.35)}
.fd-zpx-demo-brand{display:block;margin:0 0 auto;color:#fff;font:600 1.0625rem/1 ui-sans-serif,-apple-system,"Inter",sans-serif;letter-spacing:-0.01em}
.fd-zpx-demo-h{margin:0;padding:0;color:#fff;font:600 clamp(2.75rem,8vw,6.5rem)/.92 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.05em}
.fd-zpx-demo-cue{display:inline-flex;align-items:center;gap:10px;margin:24px 0 0;padding:0;color:rgba(255,255,255,.85);font:500 0.75rem/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}
.fd-zpx-demo-cue-line{position:relative;display:block;width:1px;height:28px;overflow:hidden;background:rgba(255,255,255,.3)}
.fd-zpx-demo-cue-line::after{content:"";position:absolute;left:0;top:0;width:1px;height:12px;background:#fff;animation:fd-zpx-cue 1.6s cubic-bezier(0.65,0,0.35,1) infinite}
@keyframes fd-zpx-cue{0%{transform:translateY(-12px)}100%{transform:translateY(28px)}}
.fd-zpx-demo-cap{margin:0;padding:0;color:#5E564C;text-align:center;font:400 0.9375rem/1.4 ui-sans-serif,-apple-system,"Inter",sans-serif}
.fd-zpx-demo-cap strong{color:#1A1714;font-weight:600}
.fd-zpx-demo-after{max-width:1200px;margin:0 auto;padding:96px clamp(16px,4vw,48px) 140px;text-align:center}
.fd-zpx-demo-h2{margin:0;padding:0;color:#1A1714;font:600 clamp(1.75rem,4vw,3rem)/1.05 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.035em}
@media (prefers-reduced-motion: reduce){.fd-zpx-demo-cue-line::after{animation:none}}
`;
