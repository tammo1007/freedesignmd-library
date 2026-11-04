/**
 * PhotoLens, a round magnifier that follows the pointer over a photo and
 * shows it enlarged. On touch it follows your finger, floating above it.
 *
 * Props: src, width (px, default 280), ratio (height / width of the photo,
 * default 1.333; set it to the picture's real ratio), zoom (default 2.4),
 * lens (diameter in px, default 132), aria-label.
 * CSS vars: --fd-pl-radius.
 *
 * Browser support: all evergreen browsers. The lens is a second layer of the
 * same picture, no canvas, no network request.
 * Accessibility: decorative magnification; the photo keeps its aria-label.
 * Reduced motion: the lens snaps without easing.
 */
import { useRef, useState } from "react";
import type { PointerEvent } from "react";

export interface PhotoLensProps {
  src: string;
  width?: number;
  ratio?: number;
  zoom?: number;
  lens?: number;
  className?: string;
  "aria-label"?: string;
}

export function PhotoLens({
  src,
  width = 280,
  ratio = 4 / 3,
  zoom = 2.4,
  lens = 132,
  className,
  "aria-label": label = "Photo",
}: PhotoLensProps) {
  const height = Math.round(width * ratio);
  const [pos, setPos] = useState({ x: width * 0.7, y: height * 0.58 });
  const [live, setLive] = useState(false);
  const [touch, setTouch] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState(true);

  const place = (e: PointerEvent<HTMLDivElement>) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos({
      x: Math.min(Math.max(e.clientX - r.left, 0), width),
      y: Math.min(Math.max(e.clientY - r.top, 0), height),
    });
  };

  const r = lens / 2;
  const lift = touch ? r + 28 : 0;
  const lx = pos.x;
  const ly = pos.y - lift;

  return (
    <div
      ref={box}
      className={`fd-pl${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={label}
      data-live={live || undefined}
      style={{ width, height }}
      onPointerEnter={(e) => {
        setTouch(e.pointerType === "touch");
        setLive(true);
        place(e);
      }}
      onPointerDown={(e) => {
        setTouch(e.pointerType === "touch");
        setLive(true);
        place(e);
      }}
      onPointerMove={place}
      onPointerLeave={() => setLive(false)}
      onPointerUp={(e) => e.pointerType === "touch" && setLive(false)}
    >
      <style>{css}</style>
      {ok ? <img className="fd-pl-img" src={src} alt="" draggable={false} decoding="async" onError={() => setOk(false)} /> : null}
      <span
        className="fd-pl-lens"
        aria-hidden="true"
        style={{
          width: lens,
          height: lens,
          transform: `translate3d(${lx - r}px, ${ly - r}px, 0)`,
          backgroundImage: ok ? `url(${src})` : undefined,
          backgroundSize: `${width * zoom}px ${height * zoom}px`,
          backgroundPosition: `${r - pos.x * zoom}px ${r - pos.y * zoom}px`,
        }}
      />
    </div>
  );
}

const FONT = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
const css = `
.fd-pl,.fd-pl *,.fd-pl *::before,.fd-pl *::after{box-sizing:border-box}
.fd-pl{--fd-pl-radius:22px;--fd-ease-out:cubic-bezier(0.22,1,0.36,1);position:relative;display:block;margin:0;padding:0;border-radius:var(--fd-pl-radius);background:linear-gradient(160deg,#dcd0c8,#9aa3b8);box-shadow:0 1px 2px rgba(0,0,0,.1),0 20px 38px -16px rgba(0,0,0,.4);font:400 14px/1.4 ${FONT};cursor:none;touch-action:none;-webkit-user-select:none;user-select:none;overflow:hidden}
.fd-pl-img{position:absolute;inset:0;display:block;width:100%;height:100%;margin:0;padding:0;border:0;object-fit:cover;pointer-events:none}
.fd-pl-lens{position:absolute;left:0;top:0;display:block;margin:0;padding:0;border-radius:50%;background-color:#d8d2cc;background-repeat:no-repeat;border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 1px rgba(0,0,0,.12),0 10px 24px -6px rgba(0,0,0,.45),inset 0 0 18px rgba(0,0,0,.12);pointer-events:none;will-change:transform;scale:1;transition:scale 360ms var(--fd-ease-out)}
.fd-pl-lens::after{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(60% 40% at 32% 22%,rgba(255,255,255,.35),transparent 70%)}
.fd-pl:not([data-live]) .fd-pl-lens{scale:.9}
@media (hover:none){.fd-pl{cursor:default}}
@media (prefers-reduced-motion:reduce){.fd-pl-lens{transition:none}}
`;

export function Demo() {
  return (
    <div className="fd-pld">
      <style>{demoCss}</style>
      <PhotoLens src="/demo/butterfly-p.webp" ratio={4 / 3} aria-label="Butterfly" />
    </div>
  );
}

const demoCss = `
.fd-pld,.fd-pld *,.fd-pld *::before,.fd-pld *::after{box-sizing:border-box}
.fd-pld{display:flex;align-items:center;justify-content:center;width:100%;min-height:100vh;margin:0;padding:48px 20px;background:#ececec;font:400 14px/1.4 ${FONT};letter-spacing:normal;overflow:hidden}
`;
