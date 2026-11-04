/**
 * PhotoDock, a strip of photo thumbnails that swell around the pointer with
 * a smooth falloff, like a dock. Neighbours make room, a label floats above.
 *
 * Props: items[] ({ src, label }), size (px of a resting tile, default 52),
 * magnify (peak scale, default 1.9), reach (px of influence, default 120),
 * onSelect(index), aria-label.
 * CSS vars: --fd-pd-radius, --fd-pd-gap.
 *
 * Browser support: all evergreen browsers (pointer events + CSS sizes).
 * Accessibility: tiles are buttons in a toolbar; keyboard focus magnifies
 * the focused tile just like hover. Reduced motion and touch: no magnify.
 */
import { useState } from "react";
import type { PointerEvent } from "react";

const TONES = [
  "linear-gradient(160deg,#f3d1b8,#d7959a)",
  "linear-gradient(160deg,#c9d6f2,#8e9fd6)",
  "linear-gradient(160deg,#d3e6cf,#8fb996)",
  "linear-gradient(160deg,#f2e2b6,#d9b36b)",
  "linear-gradient(160deg,#e3cdf0,#a98fd0)",
];

export interface DockItem {
  src: string;
  label: string;
}

export interface PhotoDockProps {
  items: DockItem[];
  size?: number;
  magnify?: number;
  reach?: number;
  onSelect?: (index: number) => void;
  className?: string;
  "aria-label"?: string;
}

export function PhotoDock({
  items,
  size = 52,
  magnify = 1.9,
  reach = 120,
  onSelect,
  className,
  "aria-label": label = "Photos",
}: PhotoDockProps) {
  const gap = 8;
  const pitch = size + gap;
  const [x, setX] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [hits, setHits] = useState<Record<number, number>>({});

  const center = x !== null ? x : focus !== null ? 8 + focus * pitch + size / 2 : null;

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    setX(e.clientX - r.left);
  };

  const scaleAt = (i: number) => {
    if (center === null) return 1;
    const d = center - (8 + i * pitch + size / 2);
    return 1 + (magnify - 1) * Math.exp(-(d * d) / (2 * (reach / 2.2) ** 2));
  };

  const active = center === null ? -1 : items.reduce((best, _, i) => (Math.abs(center - (8 + i * pitch + size / 2)) < Math.abs(center - (8 + best * pitch + size / 2)) ? i : best), 0);

  return (
    <div
      className={`fd-pd${className ? ` ${className}` : ""}`}
      style={{ height: Math.round(size * magnify) + 16 + 36 }}
    >
      <style>{css}</style>
      <div
        className="fd-pd-bar"
        role="toolbar"
        aria-label={label}
        onPointerMove={move}
        onPointerLeave={() => setX(null)}
        style={{ paddingInline: 8, gap }}
      >
        {items.map((it, i) => {
          const s = scaleAt(i);
          return (
            <button
              key={i}
              type="button"
              className="fd-pd-tile"
              aria-label={it.label}
              data-active={active === i || undefined}
              data-hit={hits[i] || undefined}
              onFocus={() => setFocus(i)}
              onBlur={() => setFocus(null)}
              onClick={() => {
                setHits((h) => ({ ...h, [i]: (h[i] || 0) + 1 }));
                onSelect?.(i);
              }}
              onAnimationEnd={() => setHits((h) => ({ ...h, [i]: 0 }))}
              style={{ width: size * s, height: size * s, background: TONES[i % TONES.length] }}
            >
              <Img src={it.src} />
              <span className="fd-pd-label">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Img({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return <img className="fd-pd-img" src={src} alt="" draggable={false} decoding="async" onError={() => setOk(false)} />;
}

const FONT = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
const css = `
.fd-pd,.fd-pd *,.fd-pd *::before,.fd-pd *::after{box-sizing:border-box}
.fd-pd{--fd-pd-radius:14px;--fd-ease-out:cubic-bezier(0.22,1,0.36,1);display:flex;align-items:flex-end;justify-content:center;margin:0;padding:0;font:400 12px/1.2 ${FONT}}
.fd-pd-bar{display:flex;align-items:flex-end;margin:0;padding-block:8px;border:1px solid rgba(255,255,255,.7);border-radius:22px;background:rgba(255,255,255,.55);-webkit-backdrop-filter:blur(16px) saturate(1.3);backdrop-filter:blur(16px) saturate(1.3);box-shadow:0 1px 1px rgba(255,255,255,.8) inset,0 14px 30px -14px rgba(0,0,0,.3)}
.fd-pd-tile{position:relative;display:block;flex:none;margin:0;padding:0;border:0;border-radius:var(--fd-pd-radius);overflow:visible;cursor:pointer;appearance:none;-webkit-appearance:none;box-shadow:0 1px 2px rgba(0,0,0,.18),0 6px 12px -6px rgba(0,0,0,.3);transition:width 110ms linear,height 110ms linear;-webkit-tap-highlight-color:transparent}
.fd-pd-img{position:absolute;inset:0;display:block;width:100%;height:100%;margin:0;padding:0;border:0;border-radius:inherit;object-fit:cover;pointer-events:none}
.fd-pd-tile:focus-visible{outline:2px solid #1a73e8;outline-offset:3px}
.fd-pd-tile[data-hit]{animation:fd-pd-hop 480ms var(--fd-ease-out)}
@keyframes fd-pd-hop{0%{transform:translateY(0)}35%{transform:translateY(-14px)}70%{transform:translateY(0)}85%{transform:translateY(-3px)}100%{transform:translateY(0)}}
.fd-pd-label{position:absolute;left:50%;bottom:calc(100% + 10px);display:block;margin:0;padding:5px 10px;border-radius:999px;background:rgba(20,20,22,.82);color:#fff;font:500 12px/1.2 ${FONT};white-space:nowrap;pointer-events:none;opacity:0;transform:translate(-50%,4px);transition:opacity 160ms,transform 220ms var(--fd-ease-out)}
.fd-pd-tile[data-active]:hover .fd-pd-label,.fd-pd-tile[data-active]:focus-visible .fd-pd-label{opacity:1;transform:translate(-50%,0)}
@media (prefers-reduced-motion:reduce),(hover:none){.fd-pd-tile{transition:none}.fd-pd-tile[data-hit]{animation:none}}
`;

export function Demo() {
  const names = ["eagle", "butterfly", "giraffe", "iguana", "meadow", "balloons", "sunset"];
  const label = (n: string) => n[0].toUpperCase() + n.slice(1);
  return (
    <div className="fd-pdd">
      <style>{demoCss}</style>
      <PhotoDock items={names.map((n) => ({ src: `/demo/${n}-s.webp`, label: label(n) }))} />
    </div>
  );
}

const demoCss = `
.fd-pdd,.fd-pdd *,.fd-pdd *::before,.fd-pdd *::after{box-sizing:border-box}
.fd-pdd{display:flex;align-items:center;justify-content:center;width:100%;min-height:100vh;margin:0;padding:48px 20px;background:radial-gradient(48% 60% at 30% 40%,#ffe0c4 0%,transparent 70%),radial-gradient(44% 56% at 72% 62%,#c6d0ff 0%,transparent 70%),#f1eeea;font:400 14px/1.4 ${FONT};letter-spacing:normal;overflow:hidden}
`;
