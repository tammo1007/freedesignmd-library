/**
 * ImageTrail, as the pointer travels across an area, image cards spawn at
 * fixed distance intervals along its path, pop in with a scale + rotation,
 * hold briefly, then fall away and fade. The number of live cards is capped
 * so long gestures never pile up DOM.
 *
 * Props
 * - items: ReactNode[]        Card contents (images, <img>, SVG, gradients…). Cycled in order.
 * - spacing?: number          Pointer travel in px between spawns. Default 90.
 * - max?: number              Max cards alive at once. Default 12.
 * - life?: number             ms a card lives. Default 1100.
 * - size?: [number, number]   Card size [w, h] in px. Default [220, 280] (scaled to 0.62 under 640px).
 * - rotate?: number           Max random tilt in degrees. Default 10.
 * - children                  Content of the area (e.g. a headline); stays above or below via `layer`.
 * - layer?: "under" | "over"  Cards below or above children. Default "under".
 * - className / style
 * CSS vars: --fd-it-radius (card radius, default 14px), --fd-it-shadow.
 *
 * Performance: cards are a pooled set of absolutely positioned elements,
 * animated with the Web Animations API (transform/opacity only). Pointer
 * moves are coalesced into one rAF. Nothing runs while the pointer is idle.
 * Touch: spawns along drags. Reduced motion: no trail (the area still works).
 * Accessibility: the cards are decorative (aria-hidden); put real content in children.
 * Browser support: all evergreen browsers (Web Animations API).
 *
 * Demo images: /img/lux/{dunes,hotel-golden,still-vase,bamboo,lantern,hotel-dusk,still-tea}-800.webp and
 * /img/people/p3.webp, included in the repo's public/img, copy them next to your page or swap in your own.
 */
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface ImageTrailProps {
  items: ReactNode[];
  spacing?: number;
  max?: number;
  life?: number;
  size?: [number, number];
  rotate?: number;
  layer?: "under" | "over";
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ImageTrail({ items, spacing = 90, max = 12, life = 1100, size = [220, 280], rotate = 10, layer = "under", children, className, style }: ImageTrailProps) {
  const root = useRef<HTMLDivElement>(null);
  const pool = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const cards = pool.current.filter(Boolean) as HTMLDivElement[];
    if (!cards.length) return;
    let lastX = NaN;
    let lastY = NaN;
    let acc = 0;
    let next = 0;
    let z = 1;
    let pending: { x: number; y: number } | null = null;
    let raf = 0;
    const alive: { card: HTMLDivElement; anim: Animation }[] = [];

    const spawn = (x: number, y: number, vx: number, vy: number) => {
      const card = cards[next % cards.length];
      const content = next % items.length;
      next++;
      // only show the slot for this content
      card.dataset.i = String(content);
      const k = el.clientWidth < 640 ? 0.62 : 1;
      const w = size[0] * k;
      const h = size[1] * k;
      card.style.width = `${w}px`;
      card.style.height = `${h}px`;
      card.style.zIndex = String(z++);
      const rot = (Math.random() * 2 - 1) * rotate;
      const drift = Math.min(1, Math.hypot(vx, vy) / 40);
      const dx = vx * 1.6 * drift;
      const dy = vy * 1.6 * drift + 28;
      const x0 = x - w / 2;
      const y0 = y - h / 2;
      const old = alive.findIndex((a) => a.card === card);
      if (old >= 0) {
        alive[old].anim.cancel();
        alive.splice(old, 1);
      }
      const anim = card.animate(
        [
          { transform: `translate3d(${x0}px,${y0}px,0) scale(.35) rotate(${rot * 2}deg)`, opacity: 0, offset: 0 },
          { transform: `translate3d(${x0}px,${y0}px,0) scale(1.04) rotate(${rot}deg)`, opacity: 1, offset: 0.16, easing: "cubic-bezier(.22,1,.36,1)" },
          { transform: `translate3d(${x0}px,${y0}px,0) scale(1) rotate(${rot}deg)`, opacity: 1, offset: 0.5, easing: "cubic-bezier(.65,0,.35,1)" },
          { transform: `translate3d(${x0 + dx}px,${y0 + dy}px,0) scale(.82) rotate(${rot * 1.4}deg)`, opacity: 0, offset: 1 },
        ],
        { duration: life, easing: "linear", fill: "both" },
      );
      alive.push({ card, anim });
      anim.onfinish = () => {
        const i = alive.findIndex((a) => a.anim === anim);
        if (i >= 0) alive.splice(i, 1);
      };
      // queue limit: fade out the oldest early
      while (alive.length > max) {
        const o = alive.shift()!;
        o.anim.pause();
        const fade = o.card.animate([{ opacity: getComputedStyle(o.card).opacity }, { opacity: 0 }], { duration: 160, fill: "forwards" });
        fade.onfinish = () => {
          o.anim.cancel();
          fade.cancel();
        };
      }
    };

    const flush = () => {
      raf = 0;
      if (!pending) return;
      const r = el.getBoundingClientRect();
      const x = pending.x - r.left;
      const y = pending.y - r.top;
      pending = null;
      if (Number.isNaN(lastX)) {
        lastX = x;
        lastY = y;
        return;
      }
      const dx = x - lastX;
      const dy = y - lastY;
      const d = Math.hypot(dx, dy);
      acc += d;
      // spawn at exact distance intervals along the segment
      let travelled = d - (acc - spacing);
      while (acc >= spacing) {
        const t = d ? Math.min(1, Math.max(0, travelled / d)) : 1;
        spawn(lastX + dx * t, lastY + dy * t, dx, dy);
        acc -= spacing;
        travelled += spacing;
      }
      lastX = x;
      lastY = y;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" && e.buttons === 0) return;
      pending = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const onLeave = () => {
      lastX = lastY = NaN;
      acc = 0;
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointercancel", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointercancel", onLeave);
      cancelAnimationFrame(raf);
      alive.forEach((a) => a.anim.cancel());
    };
  }, [items.length, spacing, max, life, size[0], size[1], rotate]); // eslint-disable-line react-hooks/exhaustive-deps

  const slots = Math.max(4, max + 2);
  return (
    <div ref={root} className={`fd-it${className ? " " + className : ""}`} data-layer={layer} style={style}>
      <style>{css}</style>
      <div className="fd-it-cards" aria-hidden="true">
        {Array.from({ length: slots }, (_, s) => (
          <div key={s} className="fd-it-card" ref={(n) => { pool.current[s] = n; }}>
            {items.map((it, i) => (
              <div key={i} className="fd-it-slot" data-slot={i}>{it}</div>
            ))}
          </div>
        ))}
      </div>
      <div className="fd-it-content">{children}</div>
    </div>
  );
}

const css = `
.fd-it,.fd-it *,.fd-it *::before,.fd-it *::after{box-sizing:border-box}
.fd-it{--fd-it-radius:14px;--fd-it-shadow:0 24px 48px -16px rgba(0,0,0,.45),0 2px 6px rgba(0,0,0,.18);
  position:relative;display:block;margin:0;padding:0;overflow:hidden;isolation:isolate;touch-action:pan-y}
.fd-it-cards{position:absolute;inset:0;margin:0;padding:0;pointer-events:none;z-index:0}
.fd-it[data-layer="over"] .fd-it-cards{z-index:2}
.fd-it-content{position:relative;z-index:1;margin:0;padding:0}
.fd-it-card{position:absolute;left:0;top:0;margin:0;padding:0;opacity:0;border-radius:var(--fd-it-radius);overflow:hidden;box-shadow:var(--fd-it-shadow);will-change:transform,opacity;
  transform:translate3d(-9999px,0,0)}
.fd-it-slot{display:none;position:absolute;inset:0;margin:0;padding:0}
${Array.from({ length: 32 }, (_, i) => `.fd-it-card[data-i="${i}"] .fd-it-slot[data-slot="${i}"]`).join(",")}{display:block}
.fd-it-slot > *{display:block;width:100%;height:100%;margin:0;object-fit:cover}
`;

/* ───────────────────────────── photo cards ───────────────────────────── */

type Shot = { src: string; alt: string; caption: string; pos?: string };

const SHOTS: Shot[] = [
  { src: "/img/lux/dunes-800.webp", alt: "Wind-carved golden dunes under a violet dusk sky", caption: "Erg Chebbi, 06:12", pos: "62% 50%" },
  { src: "/img/halcyon/positano-sunset-900.webp", alt: "Cliffside Positano village of pastel houses in golden light", caption: "Amalfi, golden hour", pos: "75% 50%" },
  { src: "/img/lux/still-vase-800.webp", alt: "White ceramic vase with an olive branch and lemons", caption: "Studio, still life 04" },
  { src: "/img/lux/bamboo-800.webp", alt: "Sunlight falling through a green bamboo grove", caption: "Arashiyama, 07:20" },
  { src: "/img/people/p3.webp", alt: "Ines, a woman with braided hair in a black sweater, studio portrait", caption: "Ines, Lisbon", pos: "50% 0%" },
  { src: "/img/lux/lantern-800.webp", alt: "Glowing paper lanterns against dark striped timber", caption: "Gion, 21:40" },
  { src: "/img/halcyon/pool-lemons-900.webp", alt: "Lemon pergola and blue pool above the Amalfi coastline", caption: "Positano, blue hour", pos: "70% 50%" },
  { src: "/img/lux/still-tea-800.webp", alt: "Black teapot and two cups on a dark tray with an olive sprig", caption: "Studio, still life 07" },
];

function PhotoCard({ s }: { s: Shot }) {
  return (
    <div style={{ position: "relative", display: "block", width: "100%", height: "100%", margin: 0, padding: 0, background: "#1b1a18" }}>
      <img src={s.src} width={800} height={1000} alt={s.alt} loading="lazy" decoding="async" draggable={false} style={{ display: "block", width: "100%", height: "100%", maxWidth: "none", objectFit: "cover", objectPosition: s.pos ?? "50% 50%" }} />
      <span style={{ position: "absolute", left: 12, bottom: 10, margin: 0, padding: 0, color: "rgba(255,255,255,.9)", textShadow: "0 1px 6px rgba(0,0,0,.45)", font: '500 10px/1.2 ui-monospace,"SF Mono",Menlo,monospace', letterSpacing: ".04em" }}>{s.caption}</span>
    </div>
  );
}

/* ───────────────────────────── demo ───────────────────────────── */

export function Demo() {
  const cards = SHOTS.map((s) => <PhotoCard key={s.src} s={s} />);
  return (
    <div className="fd-it-demo">
      <style>{demoCss}</style>
      <ImageTrail items={cards} className="fd-it-demo-area" spacing={84} max={14} life={1200}>
        <header className="fd-it-demo-bar">
          <span className="fd-it-demo-name">Noor Halvorsen</span>
          <nav className="fd-it-demo-nav" aria-label="Primary">
            <a href="#work">Work</a><a href="#journal">Journal</a><a href="#prints">Prints</a><a href="#contact">Contact</a>
          </nav>
        </header>
        <main className="fd-it-demo-main">
          <p className="fd-it-demo-eyebrow">Photographer · Oslo &amp; on assignment</p>
          <h1 className="fd-it-demo-h1">
            Light, <em>wherever</em><br />it lands.
          </h1>
          <p className="fd-it-demo-hint" aria-hidden="true">
            <span className="fd-it-demo-cursor" />
            Move your cursor to leaf through the archive
          </p>
        </main>
        <footer className="fd-it-demo-foot">
          <span>Clients, Kinfolk, Monocle, Aesop, Norrøna</span>
          <span>Archive 2016, 2026 · 4,812 frames</span>
        </footer>
      </ImageTrail>
    </div>
  );
}

const demoCss = `
.fd-it-demo,.fd-it-demo *,.fd-it-demo *::before,.fd-it-demo *::after{box-sizing:border-box}
.fd-it-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:"SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;
  --d-serif:ui-serif,"New York","Iowan Old Style",Charter,Georgia,serif;
  margin:0;padding:0;min-height:100vh;background:#EDEAE4;color:#141412;font:400 15px/1.5 var(--d-font);-webkit-font-smoothing:antialiased}
.fd-it-demo-area{min-height:100vh}
.fd-it-demo-area .fd-it-content{display:flex;flex-direction:column;min-height:100vh;pointer-events:none}
.fd-it-demo-area a{pointer-events:auto}
.fd-it-demo-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0;padding:22px clamp(16px,4vw,48px)}
.fd-it-demo-name{margin:0;font:600 17px/1 var(--d-disp);letter-spacing:-.01em}
.fd-it-demo-nav{display:flex;gap:28px;margin:0}
.fd-it-demo-nav a{margin:0;padding:6px 0;color:rgba(20,20,18,.6);font:500 15px/1 var(--d-font);text-decoration:none}
.fd-it-demo-nav a:hover{color:#141412}
.fd-it-demo a:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px}
.fd-it-demo-main{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;margin:0;padding:24px 16px;text-align:center}
.fd-it-demo-eyebrow{margin:0 0 24px;color:rgba(20,20,18,.6);font:500 13px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.06em;text-transform:uppercase}
.fd-it-demo-h1{margin:0;color:#141412;font:500 clamp(56px,11vw,168px)/.9 var(--d-disp);letter-spacing:-.055em;mix-blend-mode:multiply}
.fd-it-demo-h1 em{font:italic 400 1em/.9 var(--d-serif);letter-spacing:-.04em}
.fd-it-demo-hint{display:inline-flex;align-items:center;gap:10px;margin:36px 0 0;color:rgba(20,20,18,.55);font:500 13px/1 var(--d-font)}
.fd-it-demo-cursor{display:block;width:10px;height:10px;border-radius:50%;background:#141412;animation:fd-it-demo-pulse 1.8s cubic-bezier(.22,1,.36,1) infinite}
@keyframes fd-it-demo-pulse{0%{box-shadow:0 0 0 0 rgba(20,20,18,.35)}100%{box-shadow:0 0 0 14px rgba(20,20,18,0)}}
.fd-it-demo-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0;padding:20px clamp(16px,4vw,48px);color:rgba(20,20,18,.55);font:500 13px/1.3 var(--d-font)}
@media (max-width:640px){.fd-it-demo-nav{display:none}}
@media (prefers-reduced-motion:reduce){.fd-it-demo-cursor{animation:none}}
`;
