/**
 * FisheyeGrid, an infinite, two-axis tile wall you drag around with
 * momentum. A lens bulges the tiles around the pointer (or the centre when
 * the pointer is away): nearby tiles swell and push their neighbours out,
 * far tiles shrink back, like looking through a loupe.
 *
 * Props
 * - count: number                       How many distinct tiles exist (wall repeats them).
 * - renderTile: (i) => ReactNode        Render tile content for index i (0..count-1).
 * - tile?: number                       Tile size in px. Default 180 (130 under 640px).
 * - gap?: number                        Gap in px. Default 14.
 * - lens?: number                       Bulge strength 0–1. Default .55.
 * - lensRadius?: number                 Lens radius in px. Default 300.
 * - onSelect?: (i) => void              Tile click (ignored after a drag).
 * - label?: string                      Accessible name of the wall.
 * - className / style                   Size the wall (it fills its box; give it a height).
 * CSS vars: --fd-fg-radius (tile radius, default 16px), --fd-fg-bg.
 *
 * Implementation: a pooled grid of absolutely positioned tiles (only enough
 * to cover the viewport + one ring) wraps around as you pan; every frame
 * computes each tile's world cell, applies the lens displacement and writes
 * one transform. Content only re-renders when a tile wraps to a new cell.
 * Momentum uses exponential friction; pointer, wheel/trackpad and arrow keys pan.
 * Accessibility: the wall is a focusable region (arrow keys pan, Enter picks
 * the centre tile); tiles are aria-hidden duplicates, so pass a list of the
 * real items elsewhere if they matter (the Demo has one).
 * Reduced motion: no momentum glide and no lens.
 * Browser support: all evergreen browsers.
 *
 * Demo images: /img/lux/*-800.webp and /img/people/p1,p3,p6.webp, included in the repo's
 * public/img, copy them next to your page or swap in your own.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

export interface FisheyeGridProps {
  count: number;
  renderTile: (i: number) => ReactNode;
  tile?: number;
  gap?: number;
  lens?: number;
  lensRadius?: number;
  onSelect?: (i: number) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const cellIndex = (cx: number, cy: number, count: number) => {
  // stable pseudo-random index per world cell, avoids visible repetition rows
  let h = (cx * 374761393 + cy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h % count) + count) % count;
};

export function FisheyeGrid({ count, renderTile, tile = 180, gap = 14, lens = 0.55, lensRadius = 300, onSelect, label = "Tile wall", className, style }: FisheyeGridProps) {
  const root = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ cols: 0, rows: 0, size: tile });
  // which content index each pool slot shows (state so React renders content)
  const [slots, setSlots] = useState<number[]>([]);
  const api = useRef<{ panBy: (x: number, y: number) => void; centerIndex: () => number }>({ panBy: () => {}, centerIndex: () => 0 });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const size = el.clientWidth < 640 ? Math.round(tile * 0.72) : tile;
      const pitch = size + gap;
      const cols = Math.ceil(el.clientWidth / pitch) + 3;
      const rows = Math.ceil(el.clientHeight / pitch) + 3;
      setDims((d) => (d.cols === cols && d.rows === rows && d.size === size ? d : { cols, rows, size }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tile, gap]);

  useEffect(() => {
    const el = root.current;
    const { cols, rows, size } = dims;
    if (!el || !cols) return;
    const tiles = Array.from(el.querySelectorAll<HTMLElement>(".fd-fg-tile"));
    if (tiles.length !== cols * rows) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const pitch = size + gap;
    let W = el.clientWidth;
    let H = el.clientHeight;
    // camera
    let ox = 0;
    let oy = 0;
    let vx = 0;
    let vy = 0;
    // lens centre (smoothed) and target
    let lx = W / 2;
    let ly = H / 2;
    let tlx = lx;
    let tly = ly;
    let lensAmt = reduced ? 0 : lens;
    let dragging = false;
    let moved = 0;
    let lastPX = 0;
    let lastPY = 0;
    let lastPT = 0;
    let raf = 0;
    let last = 0;
    let visible = true;
    const assigned = new Int32Array(cols * rows).fill(-1);
    let pendingSlots: number[] | null = null;

    const frame = (t: number) => {
      raf = 0;
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      if (!dragging && !reduced) {
        const fr = Math.exp(-dt * 4.2);
        ox += vx * dt;
        oy += vy * dt;
        vx *= fr;
        vy *= fr;
        if (Math.abs(vx) < 4) vx = 0;
        if (Math.abs(vy) < 4) vy = 0;
      }
      const ls = 1 - Math.exp(-dt * 10);
      lx += (tlx - lx) * ls;
      ly += (tly - ly) * ls;

      const R = el.clientWidth < 640 ? lensRadius * 0.7 : lensRadius;
      let changed = false;
      const next = pendingSlots ?? Array.from(assigned);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          // wrap pool slot into the visible window
          const wx = ((((i * pitch + ox) % (cols * pitch)) + cols * pitch) % (cols * pitch)) - pitch * 1.5;
          const wy = ((((j * pitch + oy) % (rows * pitch)) + rows * pitch) % (rows * pitch)) - pitch * 1.5;
          // world cell of this slot
          const cx = Math.round((wx - ox) / pitch);
          const cy = Math.round((wy - oy) / pitch);
          const idx = cellIndex(cx, cy, count);
          if (assigned[k] !== idx) {
            assigned[k] = idx;
            next[k] = idx;
            changed = true;
          }
          // lens: radial displacement + scale around (lx, ly)
          const tx = wx + size / 2;
          const ty = wy + size / 2;
          const dx = tx - lx;
          const dy = ty - ly;
          const d = Math.hypot(dx, dy);
          const g = Math.exp(-(d * d) / (2 * R * R));
          const scale = 1 + lensAmt * 0.9 * g - lensAmt * 0.18 * (1 - g);
          const push = 1 + lensAmt * 0.55 * g * (d / (R + 1)) * 1.6;
          const px = lx + dx * push - size / 2;
          const py = ly + dy * push - size / 2;
          tiles[k].style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0) scale(${scale.toFixed(4)})`;
          tiles[k].style.zIndex = String(Math.round(g * 100));
        }
      }
      if (changed) {
        pendingSlots = next;
        setSlots(next.slice());
        pendingSlots = null;
      }
      const busy = dragging || Math.abs(vx) + Math.abs(vy) > 0 || Math.abs(tlx - lx) + Math.abs(tly - ly) > 0.3;
      if (busy && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf && visible) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = 0;
      vx = vy = 0;
      lastPX = e.clientX;
      lastPY = e.clientY;
      lastPT = performance.now();
      el.setPointerCapture(e.pointerId);
      el.setAttribute("data-dragging", "");
      kick();
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (e.pointerType !== "touch") {
        tlx = e.clientX - r.left;
        tly = e.clientY - r.top;
      }
      if (dragging) {
        const now = performance.now();
        const dx = e.clientX - lastPX;
        const dy = e.clientY - lastPY;
        const dtt = Math.max(1, now - lastPT) / 1000;
        ox += dx;
        oy += dy;
        moved += Math.abs(dx) + Math.abs(dy);
        // smoothed release velocity
        vx = vx * 0.6 + (dx / dtt) * 0.4;
        vy = vy * 0.6 + (dy / dtt) * 0.4;
        lastPX = e.clientX;
        lastPY = e.clientY;
        lastPT = now;
      }
      kick();
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.removeAttribute("data-dragging");
      if (performance.now() - lastPT > 80) vx = vy = 0;
      if (moved < 6) {
        vx = vy = 0;
        const t = (e.target as Element | null)?.closest?.(".fd-fg-tile") as HTMLElement | null;
        if (t) onSelectRef.current?.(Number(t.dataset.idx));
      }
      kick();
    };
    const onLeave = () => {
      tlx = W / 2;
      tly = H / 2;
      kick();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      ox -= e.deltaX;
      oy -= e.deltaY;
      kick();
    };
    const onResize = () => {
      W = el.clientWidth;
      H = el.clientHeight;
      tlx = W / 2;
      tly = H / 2;
      kick();
    };
    const io = new IntersectionObserver((es) => {
      visible = es.some((x) => x.isIntersecting);
      if (visible) kick();
    });
    io.observe(el);
    api.current = {
      panBy: (x: number, y: number) => {
        if (reduced) {
          ox += x;
          oy += y;
        } else {
          vx += x * 5;
          vy += y * 5;
        }
        kick();
      },
      centerIndex: () => {
        let best = 0;
        let bd = Infinity;
        tiles.forEach((t) => {
          const r = t.getBoundingClientRect();
          const er = el.getBoundingClientRect();
          const d = Math.hypot(r.left + r.width / 2 - er.left - W / 2, r.top + r.height / 2 - er.top - H / 2);
          if (d < bd) {
            bd = d;
            best = Number(t.dataset.idx);
          }
        });
        return best;
      },
    };
    lensAmt = reduced ? 0 : lens;

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);
    // centre the wall on a tile, then draw
    ox = W / 2 - size / 2 - pitch * 1.5 + pitch * 0.5;
    oy = H / 2 - size / 2 - pitch * 1.5 + pitch * 0.5;
    kick();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
    };
  }, [dims, gap, lens, lensRadius, count]);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = dims.size + gap;
    const map: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (map[e.key]) {
      e.preventDefault();
      api.current.panBy(...map[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(api.current.centerIndex());
    }
  };

  const n = dims.cols * dims.rows;
  return (
    <div
      ref={root}
      className={`fd-fg${className ? " " + className : ""}`}
      style={{ ...style, ["--fd-fg-size" as string]: `${dims.size}px` }}
      role="region"
      aria-roledescription="pannable wall"
      aria-label={`${label}. Drag or use arrow keys to pan, Enter to pick the centre tile.`}
      tabIndex={0}
      onKeyDown={onKey}
    >
      <style>{css}</style>
      {Array.from({ length: n }, (_, k) => {
        const idx = slots[k] ?? k % count;
        return (
          <div key={k} className="fd-fg-tile" data-idx={idx} aria-hidden="true">
            {renderTile(idx)}
          </div>
        );
      })}
    </div>
  );
}

const css = `
.fd-fg,.fd-fg *,.fd-fg *::before,.fd-fg *::after{box-sizing:border-box}
.fd-fg{--fd-fg-radius:16px;--fd-fg-bg:#0D0D10;position:relative;display:block;margin:0;padding:0;overflow:hidden;background:var(--fd-fg-bg);
  cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;outline:0}
.fd-fg[data-dragging]{cursor:grabbing}
.fd-fg:focus-visible{box-shadow:inset 0 0 0 2px rgba(10,132,255,.8)}
.fd-fg-tile{position:absolute;left:0;top:0;width:var(--fd-fg-size);height:var(--fd-fg-size);margin:0;padding:0;border-radius:var(--fd-fg-radius);overflow:hidden;
  will-change:transform;transform-origin:50% 50%;contain:layout paint;box-shadow:0 10px 30px -14px rgba(0,0,0,.6)}
`;

/* ───────────────────────── photo tiles ───────────────────────── */

type Art = { t: string; by: string; src: string; pos: string; alt: string };

const ART: Art[] = [
  { t: "Golden Terraces", by: "Mara Olsen", src: "/img/halcyon/positano-sunset-900.webp", pos: "75% 45%", alt: "Cliffside Positano terraces and pastel houses above the sea at golden hour" },
  { t: "Peach Flacon", by: "Kenji Ito", src: "/img/lux/perfume-peach-800.webp", pos: "50% 55%", alt: "Peach-tinted perfume bottle with a copper cap on a pale plinth under an arch" },
  { t: "Night Alley", by: "Ada Novak", src: "/img/lux/lantern-800.webp", pos: "50% 40%", alt: "Glowing paper lanterns against dark striped timber at night" },
  { t: "Kiln", by: "Studio Ferro", src: "/img/lux/still-tea-800.webp", pos: "40% 60%", alt: "Black teapot and two cups on a dark tray beside an olive sprig" },
  { t: "Ines", by: "Rui Costa", src: "/img/people/p3.webp", pos: "50% 0%", alt: "Ines, a woman with braided hair in a black sweater, studio portrait" },
  { t: "Green Hour", by: "Lena Berg", src: "/img/lux/bamboo-800.webp", pos: "50% 50%", alt: "Sunlit bamboo grove with long shadows across the forest floor" },
  { t: "Terracotta Fold", by: "Ola Dahl", src: "/img/lux/drape-terra-800.webp", pos: "50% 50%", alt: "Terracotta fabric falling in soft vertical folds" },
  { t: "Index 07", by: "Nils Arp", src: "/img/lux/still-grey-800.webp", pos: "50% 55%", alt: "Ceramic vase with an olive branch and bowl of fruit, in grey tones" },
  { t: "Dune Specimen", by: "Iris Moreau", src: "/img/lux/dunes-800.webp", pos: "62% 50%", alt: "Wind-carved golden desert dune ridge under a violet dusk sky" },
  { t: "Noir Nº 7", by: "Tomás Vidal", src: "/img/lux/perfume-noir-800.webp", pos: "50% 55%", alt: "Amber perfume bottle with black cap on a dark plinth, lit dramatically" },
  { t: "Amara", by: "Yuna Seo", src: "/img/people/p1.webp", pos: "50% 0%", alt: "Amara, a woman with a gray bob in a black sweater, studio portrait" },
  { t: "Ink Fold", by: "Kofi Mensah", src: "/img/lux/drape-ink-800.webp", pos: "50% 50%", alt: "Navy drape with pale highlights rippling in long vertical folds" },
  { t: "Quiet Vase", by: "Elif Kaya", src: "/img/lux/still-vase-800.webp", pos: "50% 60%", alt: "White ceramic vase with olive branch, terracotta pot and lemons in an arch niche" },
  { t: "Violet Dusk", by: "Max Weber", src: "/img/lux/perfume-dusk-800.webp", pos: "50% 55%", alt: "Pink perfume bottle with a dark cap on a plinth against a purple backdrop" },
  { t: "Kai", by: "Sana Malik", src: "/img/people/p6.webp", pos: "50% 0%", alt: "Kai, a woman with long wavy dark hair in a black sweater, studio portrait" },
  { t: "Harbour Blue", by: "Jonas Lind", src: "/img/halcyon/pool-lemons-900.webp", pos: "70% 45%", alt: "Lemon pergola and blue infinity pool above the Amalfi coastline" },
];

function ArtCard({ a }: { a: Art }) {
  return (
    <div className="fd-fg-art">
      <img src={a.src} width={800} height={800} alt={a.alt} loading="lazy" decoding="async" draggable={false} style={{ objectPosition: a.pos }} />
      <span className="fd-fg-art-cap">
        <strong>{a.t}</strong>
        <span>{a.by}</span>
      </span>
    </div>
  );
}

/* ───────────────────────────── demo ───────────────────────────── */

export function Demo() {
  const [picked, setPicked] = useState<number | null>(null);
  const [saved, setSaved] = useState(0);
  return (
    <div className="fd-fg-demo">
      <style>{demoCss}</style>
      <FisheyeGrid
        count={ART.length}
        renderTile={(i) => <ArtCard a={ART[i]} />}
        label="Inspiration board"
        className="fd-fg-demo-wall"
        onSelect={(i) => {
          setPicked(i);
          setSaved((s) => s + 1);
        }}
      />
      <header className="fd-fg-demo-bar">
        <span className="fd-fg-demo-brand">Moodwall</span>
        <span className="fd-fg-demo-board">Board · <strong>Rebrand 2027 references</strong></span>
        <span className="fd-fg-demo-count" aria-live="polite">{saved} saved</span>
      </header>
      <div className="fd-fg-demo-hint" aria-hidden="true">Drag to explore · click to save</div>
      {picked !== null && (
        <div className="fd-fg-demo-toast" role="status" key={saved}>
          <img className="fd-fg-demo-sw" src={ART[picked].src} width={22} height={22} alt="" loading="lazy" decoding="async" />
          Saved “{ART[picked].t}” by {ART[picked].by}
        </div>
      )}
      <ul className="fd-fg-demo-sr" aria-label="Pieces on this board">
        {ART.map((a) => <li key={a.t}>{a.t} by {a.by}</li>)}
      </ul>
    </div>
  );
}

const demoCss = `
.fd-fg-demo,.fd-fg-demo *,.fd-fg-demo *::before,.fd-fg-demo *::after{box-sizing:border-box}
.fd-fg-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:"SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;
  position:relative;height:100vh;min-height:560px;margin:0;padding:0;overflow:hidden;background:#0D0D10;color:#F5F5F7;font:400 15px/1.5 var(--d-font);-webkit-font-smoothing:antialiased}
.fd-fg-demo .fd-fg-demo-wall{position:absolute;inset:0}
.fd-fg-art{position:absolute;inset:0;margin:0;padding:0;background:#1b1a18;color:#fff}
.fd-fg-art img{display:block;position:absolute;inset:0;width:100%;height:100%;max-width:none;margin:0;padding:0;object-fit:cover;pointer-events:none;-webkit-user-drag:none}
.fd-fg-art::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.55),rgba(0,0,0,0) 45%)}
.fd-fg-art-cap{z-index:1;position:absolute;left:10%;right:10%;bottom:8%;display:flex;flex-direction:column;gap:2px;margin:0;padding:0}
.fd-fg-art-cap strong{font:600 13px/1.15 var(--d-disp);letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fd-fg-art-cap span{font:500 10px/1.2 ui-monospace,"SF Mono",Menlo,monospace;opacity:.7;white-space:nowrap}
.fd-fg-demo-bar{z-index:300;position:absolute;left:16px;right:16px;top:16px;display:flex;align-items:center;gap:16px;margin:0 auto;max-width:720px;height:52px;padding:0 10px 0 20px;border-radius:9999px;
  background:rgba(20,20,24,.62);-webkit-backdrop-filter:blur(24px) saturate(1.6);backdrop-filter:blur(24px) saturate(1.6);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 20px 40px -20px rgba(0,0,0,.6);pointer-events:none}
.fd-fg-demo-brand{margin:0;font:700 17px/1 var(--d-disp);letter-spacing:-.02em}
.fd-fg-demo-board{margin:0;color:rgba(245,245,247,.6);font:500 13px/1 var(--d-font);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fd-fg-demo-board strong{color:#F5F5F7;font-weight:600}
.fd-fg-demo-count{margin:0 0 0 auto;padding:9px 14px;border-radius:9999px;background:#F5F5F7;color:#0D0D10;font:600 13px/1 var(--d-font);white-space:nowrap}
.fd-fg-demo-hint{z-index:300;position:absolute;left:50%;bottom:20px;margin:0;padding:10px 16px;border-radius:9999px;transform:translateX(-50%);background:rgba(20,20,24,.62);
  -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);color:rgba(245,245,247,.8);font:500 13px/1 var(--d-font);pointer-events:none;white-space:nowrap}
.fd-fg-demo-toast{z-index:300;position:absolute;left:50%;bottom:68px;display:flex;align-items:center;gap:10px;margin:0;padding:10px 16px 10px 10px;border-radius:9999px;transform:translateX(-50%);
  background:#F5F5F7;color:#0D0D10;font:500 13px/1 var(--d-font);white-space:nowrap;pointer-events:none;animation:fd-fg-demo-toast 2400ms cubic-bezier(.22,1,.36,1) both}
.fd-fg-demo-sw{display:block;width:22px;height:22px;margin:0;padding:0;border-radius:50%;object-fit:cover}
@keyframes fd-fg-demo-toast{0%{opacity:0;transform:translate(-50%,10px)}10%,80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,0)}}
.fd-fg-demo-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
@media (max-width:560px){.fd-fg-demo-board{display:none}}
`;
