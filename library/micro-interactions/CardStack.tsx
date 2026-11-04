/**
 * CardStack, a stack of photo cards you can throw around: drag the front
 * card away and it swoops to the back, tap a card behind to pull it forward.
 *
 * Props: images[] (urls; a soft gradient shows if one fails to load),
 * width (px, default 220), ratio (height / width, default 1.32),
 * onChange(frontIndex), aria-label.
 * CSS vars: --fd-cs-radius, --fd-cs-shadow.
 *
 * Browser support: all evergreen browsers (pointer events + CSS transforms).
 * Accessibility: the stack is a focusable group, ArrowRight / ArrowDown send
 * the front card back, ArrowLeft / ArrowUp bring the last one forward. A
 * visually hidden live region announces the position. Reduced motion: cards
 * change place without the swoop.
 */
import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

const TONES = [
  "linear-gradient(160deg,#f3d1b8,#d7959a)",
  "linear-gradient(160deg,#c9d6f2,#8e9fd6)",
  "linear-gradient(160deg,#d3e6cf,#8fb996)",
  "linear-gradient(160deg,#f2e2b6,#d9b36b)",
  "linear-gradient(160deg,#e3cdf0,#a98fd0)",
];

export interface CardStackProps {
  images?: string[];
  width?: number;
  ratio?: number;
  onChange?: (front: number) => void;
  className?: string;
  "aria-label"?: string;
}

type Drag = { id: number; x: number; y: number };

export function CardStack({
  images = [],
  width = 220,
  ratio = 1.32,
  onChange,
  className,
  "aria-label": label = "Photo stack",
}: CardStackProps) {
  const count = Math.max(images.length, 1);
  const [order, setOrder] = useState(() => Array.from({ length: count }, (_, i) => i));
  const [drag, setDrag] = useState<Drag | null>(null);
  const start = useRef({ x: 0, y: 0, t: 0, vx: 0, vy: 0, moved: false });
  const last = useRef({ x: 0, y: 0, t: 0 });

  const commit = (next: number[]) => {
    setOrder(next);
    onChange?.(next[0]);
  };
  const sendBack = () => commit([...order.slice(1), order[0]]);
  const bringForward = () => commit([order[order.length - 1], ...order.slice(0, -1)]);
  const pull = (id: number) => commit([id, ...order.filter((o) => o !== id)]);

  const down = (e: PointerEvent<HTMLDivElement>, id: number, depth: number) => {
    start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, vx: 0, vy: 0, moved: false };
    last.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    if (depth === 0) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ id, x: 0, y: 0 });
    }
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const dt = Math.max(e.timeStamp - last.current.t, 1);
    start.current.vx = (e.clientX - last.current.x) / dt;
    start.current.vy = (e.clientY - last.current.y) / dt;
    last.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    if (Math.hypot(x, y) > 5) start.current.moved = true;
    setDrag({ id: drag.id, x, y });
  };
  const up = (e: PointerEvent<HTMLDivElement>, id: number, depth: number) => {
    if (depth !== 0) {
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) < 6) pull(id);
      return;
    }
    if (!drag) return;
    const dist = Math.hypot(drag.x, drag.y);
    const speed = Math.hypot(start.current.vx, start.current.vy);
    setDrag(null);
    if (dist > width * 0.32 || (speed > 0.55 && dist > 24)) sendBack();
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      sendBack();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      bringForward();
    }
  };

  const height = Math.round(width * ratio);
  const pullAmount = drag ? Math.min(Math.hypot(drag.x, drag.y) / (width * 0.5), 1) : 0;

  return (
    <div
      className={`fd-cs${className ? ` ${className}` : ""}`}
      role="group"
      aria-roledescription="stack"
      aria-label={label}
      tabIndex={0}
      onKeyDown={key}
      style={{ width, height: height + 56 }}
    >
      <style>{css}</style>
      {images.map((src, id) => {
        const depth = order.indexOf(id);
        const dragging = drag?.id === id;
        const shown = Math.min(depth, 4);
        const lift = depth > 0 ? pullAmount * (depth === 1 ? 1 : 0.4) : 0;
        const y = dragging ? drag.y : -shown * 28 + lift * 28;
        const x = dragging ? drag.x : 0;
        const rot = dragging ? drag.x / 16 : (depth % 2 ? 1 : -1) * Math.min(depth, 3) * 0.9;
        const s = dragging ? 1.02 : 1 - shown * 0.055 + lift * 0.055;
        return (
          <div
            key={id}
            className="fd-cs-card"
            data-drag={dragging || undefined}
            data-front={depth === 0 || undefined}
            aria-hidden={depth !== 0}
            style={{
              width,
              height,
              zIndex: images.length - depth,
              opacity: depth > 3 ? 0 : 1,
              transform: `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg) scale(${s})`,
              filter: depth === 0 ? undefined : `brightness(${1 - Math.min(depth, 3) * 0.045 + lift * 0.045})`,
            }}
            onPointerDown={(e) => down(e, id, depth)}
            onPointerMove={move}
            onPointerUp={(e) => up(e, id, depth)}
            onPointerCancel={() => setDrag(null)}
          >
            <span className="fd-cs-photo" style={{ background: TONES[id % TONES.length] }}>
              <Photo src={src} />
            </span>
          </div>
        );
      })}
      <span className="fd-cs-live" aria-live="polite">{`Card ${order[0] + 1} of ${images.length}`}</span>
    </div>
  );
}

function Photo({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return <img className="fd-cs-img" src={src} alt="" draggable={false} decoding="async" onError={() => setOk(false)} />;
}

const FONT = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
const css = `
.fd-cs,.fd-cs *,.fd-cs *::before,.fd-cs *::after{box-sizing:border-box}
.fd-cs{--fd-cs-radius:22px;--fd-cs-shadow:0 1px 2px rgba(0,0,0,.08),0 14px 32px -10px rgba(0,0,0,.28);--fd-ease-out:cubic-bezier(0.22,1,0.36,1);position:relative;display:block;margin:0;padding:56px 0 0;font:400 14px/1.4 ${FONT};color:#111;outline:none;touch-action:pan-y;-webkit-user-select:none;user-select:none}
.fd-cs:focus-visible{outline:2px solid #1a73e8;outline-offset:12px;border-radius:28px}
.fd-cs-card{position:absolute;left:0;bottom:0;margin:0;padding:0;border-radius:var(--fd-cs-radius);overflow:hidden;background:#ddd;box-shadow:var(--fd-cs-shadow);transform-origin:50% 100%;transition:transform 560ms var(--fd-ease-out),filter 560ms var(--fd-ease-out),opacity 300ms;cursor:pointer;will-change:transform}
.fd-cs-card[data-front]{cursor:grab;touch-action:none}
.fd-cs-card[data-drag]{cursor:grabbing;transition:filter 560ms,opacity 300ms}
.fd-cs-photo{position:absolute;inset:0;display:block;margin:0;padding:0}
.fd-cs-img{position:absolute;inset:0;display:block;width:100%;height:100%;margin:0;padding:0;border:0;object-fit:cover;pointer-events:none}
.fd-cs-live{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){.fd-cs-card{transition:none}}
`;

export function Demo() {
  return (
    <div className="fd-csd">
      <style>{demoCss}</style>
      <CardStack
        images={[
          "/demo/eagle-p.webp",
          "/demo/butterfly-p.webp",
          "/demo/giraffe-p.webp",
          "/demo/meadow-p.webp",
          "/demo/iguana-p.webp",
        ]}
      />
    </div>
  );
}

const demoCss = `
.fd-csd,.fd-csd *,.fd-csd *::before,.fd-csd *::after{box-sizing:border-box}
.fd-csd{display:flex;align-items:center;justify-content:center;width:100%;min-height:100vh;margin:0;padding:48px 20px;background:#ececec;font:400 14px/1.4 ${FONT};letter-spacing:normal;overflow:hidden}
`;
