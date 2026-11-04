/**
 * TiltCard, a photo card that leans toward the pointer in 3D, with a soft
 * light sheen that follows it and the picture drifting slightly behind.
 *
 * Props: src, title, caption, width (px, default 260), ratio (height / width,
 * default 1.3), max (max tilt in degrees, default 11), sheen (boolean).
 * CSS vars: --fd-tc-radius.
 *
 * Browser support: all evergreen browsers. Pointer values are written as CSS
 * variables straight to the element, so moving the pointer never re-renders.
 * Accessibility: decorative motion only; the card content is plain text and an
 * image. Reduced motion and touch: the card stays flat.
 */
import { useRef, useState } from "react";
import type { PointerEvent } from "react";

export interface TiltCardProps {
  src?: string;
  title?: string;
  caption?: string;
  width?: number;
  ratio?: number;
  max?: number;
  sheen?: boolean;
  className?: string;
}

export function TiltCard({
  src,
  title,
  caption,
  width = 260,
  ratio = 1.3,
  max = 11,
  sheen = true,
  className,
}: TiltCardProps) {
  const el = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState(true);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const node = el.current;
    if (!node || e.pointerType === "touch") return;
    const r = node.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    node.style.setProperty("--rx", `${((0.5 - py) * 2 * max).toFixed(2)}deg`);
    node.style.setProperty("--ry", `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
    node.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    node.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    node.style.setProperty("--px", `${((px - 0.5) * -14).toFixed(1)}px`);
    node.style.setProperty("--py", `${((py - 0.5) * -14).toFixed(1)}px`);
    node.dataset.live = "";
  };
  const leave = () => {
    const node = el.current;
    if (!node) return;
    delete node.dataset.live;
    for (const k of ["--rx", "--ry", "--px", "--py"]) node.style.removeProperty(k);
  };

  return (
    <div className={`fd-tc${className ? ` ${className}` : ""}`} style={{ width }}>
      <style>{css}</style>
      <div
        ref={el}
        className="fd-tc-card"
        data-sheen={sheen || undefined}
        style={{ height: Math.round(width * ratio) }}
        onPointerMove={move}
        onPointerLeave={leave}
        onPointerCancel={leave}
      >
        <span className="fd-tc-photo">
          {src && ok ? <img className="fd-tc-img" src={src} alt="" draggable={false} decoding="async" onError={() => setOk(false)} /> : null}
        </span>
        <span className="fd-tc-shade" />
        <span className="fd-tc-sheen" />
        {(title || caption) && (
          <span className="fd-tc-text">
            {title ? <span className="fd-tc-title">{title}</span> : null}
            {caption ? <span className="fd-tc-caption">{caption}</span> : null}
          </span>
        )}
      </div>
    </div>
  );
}

const FONT = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
const css = `
.fd-tc,.fd-tc *,.fd-tc *::before,.fd-tc *::after{box-sizing:border-box}
.fd-tc{--fd-tc-radius:24px;--fd-ease-out:cubic-bezier(0.22,1,0.36,1);display:block;margin:0;padding:0;perspective:900px;font:400 14px/1.4 ${FONT};color:#fff}
.fd-tc-card{position:relative;display:block;margin:0;padding:0;border-radius:var(--fd-tc-radius);overflow:hidden;background:linear-gradient(160deg,#dcd0c8,#9aa3b8);box-shadow:0 1px 2px rgba(0,0,0,.1),0 22px 40px -16px rgba(0,0,0,.4);transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) scale(1);transition:transform 700ms var(--fd-ease-out),box-shadow 700ms var(--fd-ease-out);transform-style:preserve-3d;will-change:transform}
.fd-tc-card[data-live]{transform:rotateX(var(--rx)) rotateY(var(--ry)) scale(1.03);transition:transform 120ms linear,box-shadow 300ms;box-shadow:0 1px 2px rgba(0,0,0,.1),0 34px 50px -18px rgba(0,0,0,.5)}
.fd-tc-photo{position:absolute;inset:-14px;display:block;margin:0;padding:0;transform:translate3d(var(--px,0px),var(--py,0px),0);transition:transform 700ms var(--fd-ease-out)}
.fd-tc-card[data-live] .fd-tc-photo{transition:transform 120ms linear}
.fd-tc-img{position:absolute;inset:0;display:block;width:100%;height:100%;margin:0;padding:0;border:0;object-fit:cover;pointer-events:none}
.fd-tc-shade{position:absolute;inset:0;display:block;background:linear-gradient(180deg,transparent 55%,rgba(0,0,0,.5));pointer-events:none}
.fd-tc-sheen{position:absolute;inset:0;display:none;pointer-events:none;opacity:0;background:radial-gradient(420px circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.32),transparent 60%);mix-blend-mode:soft-light;transition:opacity 400ms}
.fd-tc-card[data-sheen] .fd-tc-sheen{display:block}
.fd-tc-card[data-live] .fd-tc-sheen{opacity:1}
.fd-tc-text{position:absolute;left:20px;right:20px;bottom:18px;display:flex;flex-direction:column;gap:3px;margin:0;padding:0;transform:translateZ(30px)}
.fd-tc-title{display:block;margin:0;padding:0;font:600 19px/1.2 ${FONT};letter-spacing:-.01em}
.fd-tc-caption{display:block;margin:0;padding:0;color:rgba(255,255,255,.78);font:400 13px/1.3 ${FONT}}
@media (prefers-reduced-motion:reduce){.fd-tc-card,.fd-tc-photo{transition:none;transform:none!important}}
@media (hover:none){.fd-tc-card,.fd-tc-photo{transform:none!important}}
`;

export function Demo() {
  return (
    <div className="fd-tcd">
      <style>{demoCss}</style>
      <TiltCard src="/demo/eagle-p.webp" title="Golden eagle" caption="Aquila chrysaetos" />
    </div>
  );
}

const demoCss = `
.fd-tcd,.fd-tcd *,.fd-tcd *::before,.fd-tcd *::after{box-sizing:border-box}
.fd-tcd{display:flex;align-items:center;justify-content:center;width:100%;min-height:100vh;margin:0;padding:48px 20px;background:#ececec;font:400 14px/1.4 ${FONT};letter-spacing:normal;overflow:hidden}
`;
