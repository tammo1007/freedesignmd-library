/**
 * FanOut, a pile of photo cards that opens into an arc and gathers back
 * into a pile. Cards leave one after another; hovering one lifts it.
 *
 * Props: images[], radius (px, default 220), arc (degrees, default 130),
 * cardWidth (px, default 92), open / defaultOpen / onOpenChange,
 * spreadLabel / gatherLabel (text of the built-in toggle), aria-label.
 * CSS vars: --fd-fo-radius.
 *
 * Browser support: all evergreen browsers (CSS transforms only).
 * Accessibility: the toggle is a real button with aria-expanded. Reduced
 * motion: cards change place without the stagger.
 */
import { useState } from "react";

const TONES = [
  "linear-gradient(160deg,#f3d1b8,#d7959a)",
  "linear-gradient(160deg,#c9d6f2,#8e9fd6)",
  "linear-gradient(160deg,#d3e6cf,#8fb996)",
  "linear-gradient(160deg,#f2e2b6,#d9b36b)",
  "linear-gradient(160deg,#e3cdf0,#a98fd0)",
];

export interface FanOutProps {
  images: string[];
  radius?: number;
  arc?: number;
  cardWidth?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  spreadLabel?: string;
  gatherLabel?: string;
  className?: string;
  "aria-label"?: string;
}

export function FanOut({
  images,
  radius = 220,
  arc = 130,
  cardWidth = 92,
  open,
  defaultOpen = false,
  onOpenChange,
  spreadLabel = "Spread",
  gatherLabel = "Gather",
  className,
  "aria-label": label = "Photo fan",
}: FanOutProps) {
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = open ?? inner;
  const toggle = () => {
    if (open === undefined) setInner(!isOpen);
    onOpenChange?.(!isOpen);
  };
  const h = Math.round(cardWidth * 1.34);
  const n = images.length;
  const rad = (d: number) => (d * Math.PI) / 180;

  return (
    <div className={`fd-fo${className ? ` ${className}` : ""}`} style={{ width: radius * 2 + cardWidth + 40 }}>
      <style>{css}</style>
      <div
        className="fd-fo-stage"
        role="group"
        aria-label={label}
        style={{ height: radius + h + 24 }}
      >
        {images.map((src, i) => {
          const t = n > 1 ? i / (n - 1) : 0.5;
          const a = isOpen ? -arc / 2 + t * arc : (i - (n - 1) / 2) * 2.2;
          const x = isOpen ? Math.sin(rad(a)) * radius : (i - (n - 1) / 2) * 1.5;
          const y = isOpen ? -Math.cos(rad(a)) * radius : (n - 1 - i) * -1.2;
          return (
            <span
              key={i}
              className="fd-fo-slot"
              style={{
                width: cardWidth,
                height: h,
                marginLeft: -cardWidth / 2,
                transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${a.toFixed(1)}deg)`,
                transitionDelay: `${(isOpen ? i : n - 1 - i) * 36}ms`,
                zIndex: i,
              }}
            >
              <span className="fd-fo-card" style={{ background: TONES[i % TONES.length] }}>
                <Img src={src} />
              </span>
            </span>
          );
        })}
      </div>
      <button type="button" className="fd-fo-toggle" aria-expanded={isOpen} onClick={toggle}>
        {isOpen ? gatherLabel : spreadLabel}
      </button>
    </div>
  );
}

function Img({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return <img className="fd-fo-img" src={src} alt="" draggable={false} loading="lazy" decoding="async" onError={() => setOk(false)} />;
}

const FONT = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
const css = `
.fd-fo,.fd-fo *,.fd-fo *::before,.fd-fo *::after{box-sizing:border-box}
.fd-fo{--fd-fo-radius:14px;--fd-ease-out:cubic-bezier(0.22,1,0.36,1);display:flex;flex-direction:column;align-items:center;gap:28px;max-width:100%;margin:0;padding:0;font:400 14px/1.4 ${FONT};color:#111}
.fd-fo-stage{position:relative;display:block;width:100%;margin:0;padding:0}
.fd-fo-slot{position:absolute;left:50%;bottom:0;display:block;margin-top:0;padding:0;transform-origin:50% 100%;transition:transform 720ms var(--fd-ease-out)}
.fd-fo-card{position:absolute;inset:0;display:block;margin:0;padding:0;border-radius:var(--fd-fo-radius);overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.12),0 10px 22px -8px rgba(0,0,0,.35);transition:transform 360ms var(--fd-ease-out)}
.fd-fo-slot:hover .fd-fo-card{transform:translateY(-12px) scale(1.07)}
.fd-fo-img{position:absolute;inset:0;display:block;width:100%;height:100%;margin:0;padding:0;border:0;object-fit:cover;pointer-events:none}
.fd-fo-toggle{display:inline-flex;align-items:center;justify-content:center;margin:0;padding:11px 22px;border:0;border-radius:999px;background:#111;color:#fff;font:500 14px/1.2 ${FONT};letter-spacing:normal;cursor:pointer;appearance:none;-webkit-appearance:none;box-shadow:0 1px 2px rgba(0,0,0,.14),0 8px 18px -8px rgba(0,0,0,.4);transition:transform 200ms var(--fd-ease-out);-webkit-tap-highlight-color:transparent}
.fd-fo-toggle:active{transform:scale(.96)}
.fd-fo-toggle:focus-visible{outline:2px solid #1a73e8;outline-offset:3px}
@media (prefers-reduced-motion:reduce){.fd-fo-slot,.fd-fo-card{transition:none!important}}
@media (max-width:560px){.fd-fo-stage{transform:scale(.62);transform-origin:50% 100%;margin-bottom:-90px}}
`;

export function Demo() {
  const names = ["eagle", "butterfly", "giraffe", "iguana", "meadow", "sunset", "ridge"];
  return (
    <div className="fd-fod">
      <style>{demoCss}</style>
      <FanOut images={names.map((n) => `/demo/${n}-p.webp`)} />
    </div>
  );
}

const demoCss = `
.fd-fod,.fd-fod *,.fd-fod *::before,.fd-fod *::after{box-sizing:border-box}
.fd-fod{display:flex;align-items:center;justify-content:center;width:100%;min-height:100vh;margin:0;padding:48px 20px;background:#ececec;font:400 14px/1.4 ${FONT};letter-spacing:normal;overflow:hidden}
`;
