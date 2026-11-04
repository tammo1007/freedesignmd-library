/**
 * PhotoAccordion, a row of narrow photo strips where the one under the
 * pointer (or the last one you tapped) grows and the others make room.
 *
 * Props: items[] ({ src, title }), width (px, default 600), height (px,
 * default 340), defaultActive (index, default 0), expand (growth factor of
 * the active strip, default 7), onChange(index), aria-label.
 * CSS vars: --fd-pa-radius, --fd-pa-gap.
 *
 * Browser support: all evergreen browsers (flex-grow transitions).
 * Accessibility: every strip is a button; ArrowLeft/Right move the active
 * strip, hover follows fine pointers, tap works on touch. Reduced motion:
 * strips resize without easing.
 */
import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

const TONES = [
  "linear-gradient(160deg,#f3d1b8,#d7959a)",
  "linear-gradient(160deg,#c9d6f2,#8e9fd6)",
  "linear-gradient(160deg,#d3e6cf,#8fb996)",
  "linear-gradient(160deg,#f2e2b6,#d9b36b)",
  "linear-gradient(160deg,#e3cdf0,#a98fd0)",
];

export interface AccordionItem {
  src: string;
  title: string;
}

export interface PhotoAccordionProps {
  items: AccordionItem[];
  width?: number;
  height?: number;
  defaultActive?: number;
  expand?: number;
  onChange?: (index: number) => void;
  className?: string;
  "aria-label"?: string;
}

export function PhotoAccordion({
  items,
  width = 600,
  height = 340,
  defaultActive = 0,
  expand = 7,
  onChange,
  className,
  "aria-label": label = "Photos",
}: PhotoAccordionProps) {
  const [active, setActive] = useState(defaultActive);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const go = (i: number) => {
    if (i === active) return;
    setActive(i);
    onChange?.(i);
  };
  const key = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to = e.key === "ArrowRight" ? Math.min(i + 1, items.length - 1) : e.key === "ArrowLeft" ? Math.max(i - 1, 0) : -1;
    if (to < 0) return;
    e.preventDefault();
    go(to);
    refs.current[to]?.focus();
  };

  return (
    <div
      className={`fd-pa${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={label}
      style={{ maxWidth: width, height }}
    >
      <style>{css}</style>
      {items.map((it, i) => (
        <button
          key={i}
          ref={(n) => {
            refs.current[i] = n;
          }}
          type="button"
          className="fd-pa-strip"
          aria-pressed={active === i}
          aria-label={it.title}
          data-active={active === i || undefined}
          style={{ flexGrow: active === i ? expand : 1, background: TONES[i % TONES.length] }}
          onPointerEnter={(e) => e.pointerType === "mouse" && go(i)}
          onClick={() => go(i)}
          onFocus={() => go(i)}
          onKeyDown={(e) => key(e, i)}
        >
          <Img src={it.src} />
          <span className="fd-pa-shade" />
          <span className="fd-pa-title">{it.title}</span>
        </button>
      ))}
    </div>
  );
}

function Img({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return <img className="fd-pa-img" src={src} alt="" draggable={false} loading="lazy" decoding="async" onError={() => setOk(false)} />;
}

const FONT = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
const css = `
.fd-pa,.fd-pa *,.fd-pa *::before,.fd-pa *::after{box-sizing:border-box}
.fd-pa{--fd-pa-radius:20px;--fd-pa-gap:8px;--fd-ease-out:cubic-bezier(0.22,1,0.36,1);display:flex;gap:var(--fd-pa-gap);width:100%;margin:0;padding:0;font:400 14px/1.4 ${FONT};color:#fff}
.fd-pa-strip{position:relative;display:block;flex:1 1 0;min-width:0;margin:0;padding:0;border:0;border-radius:var(--fd-pa-radius);overflow:hidden;cursor:pointer;appearance:none;-webkit-appearance:none;box-shadow:0 1px 2px rgba(0,0,0,.1),0 14px 28px -14px rgba(0,0,0,.35);transition:flex-grow 700ms var(--fd-ease-out);-webkit-tap-highlight-color:transparent}
.fd-pa-strip:focus-visible{outline:2px solid #1a73e8;outline-offset:3px}
.fd-pa-img{position:absolute;inset:0;display:block;width:100%;height:100%;margin:0;padding:0;border:0;object-fit:cover;pointer-events:none;transform:scale(1.12);transition:transform 900ms var(--fd-ease-out)}
.fd-pa-strip[data-active] .fd-pa-img{transform:scale(1)}
.fd-pa-shade{position:absolute;inset:0;display:block;background:linear-gradient(180deg,transparent 55%,rgba(0,0,0,.45));opacity:0;transition:opacity 500ms;pointer-events:none}
.fd-pa-strip[data-active] .fd-pa-shade{opacity:1}
.fd-pa-title{position:absolute;left:20px;bottom:16px;display:block;margin:0;padding:0;font:500 16px/1.2 ${FONT};letter-spacing:-.005em;white-space:nowrap;opacity:0;transform:translateY(8px);transition:opacity 300ms,transform 500ms var(--fd-ease-out)}
.fd-pa-strip[data-active] .fd-pa-title{opacity:1;transform:none;transition-delay:200ms}
@media (prefers-reduced-motion:reduce){.fd-pa-strip,.fd-pa-img,.fd-pa-title{transition:none!important}}
`;

export function Demo() {
  const items = [
    { n: "ridge", t: "Ridge" },
    { n: "balloons", t: "Balloons" },
    { n: "sunset", t: "Sunset" },
    { n: "meadow", t: "Meadow" },
    { n: "butterfly", t: "Butterfly" },
  ];
  return (
    <div className="fd-pad">
      <style>{demoCss}</style>
      <PhotoAccordion items={items.map((i) => ({ src: `/demo/${i.n}.webp`, title: i.t }))} defaultActive={2} />
    </div>
  );
}

const demoCss = `
.fd-pad,.fd-pad *,.fd-pad *::before,.fd-pad *::after{box-sizing:border-box}
.fd-pad{display:flex;align-items:center;justify-content:center;width:100%;min-height:100vh;margin:0;padding:48px 20px;background:#ececec;font:400 14px/1.4 ${FONT};letter-spacing:normal;overflow:hidden}
`;
