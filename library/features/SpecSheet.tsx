/**
 * SpecSheet — a technical spec sheet for a piece of hardware, shown for an
 * electric city bike: a huge model number, a hairline grid of specs with
 * units set in mono, and an SVG side elevation with numbered callouts. Hover
 * or focus a spec and its part lights up on the drawing (and the other way
 * round). The drawing traces itself in when it scrolls into view.
 *
 * Props: model, name, intro, price, specs ({ id, label, value, unit, note,
 * part }). `part` links a spec to a drawing part: motor | battery | drive |
 * brakes | frame | tyres | lights.
 * CSS vars: --fd-sps-bg, --fd-sps-chalk, --fd-sps-signal.
 *
 * Browser support: all evergreen browsers.
 * Accessibility: specs are a description list of focusable items; the drawing
 * is role="img" with a summary label, callouts are decorative mirrors of the
 * spec list. Highlight follows hover and keyboard focus.
 * Reduced motion: the drawing is shown fully drawn, highlights swap instantly.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export type SpsPart = "motor" | "battery" | "drive" | "brakes" | "frame" | "tyres" | "lights";
export interface SpsSpec {
  id: string;
  label: string;
  value: string;
  unit: string;
  note: string;
  part: SpsPart;
}

export interface SpecSheetProps {
  model?: string;
  name?: ReactNode;
  intro?: ReactNode;
  price?: string;
  specs?: SpsSpec[];
  className?: string;
}

const DEFAULT_SPECS: SpsSpec[] = [
  { id: "motor", label: "Motor", value: "250", unit: "W · 65 Nm", note: "Rear hub, silent below 25 km/h", part: "motor" },
  { id: "battery", label: "Battery", value: "540", unit: "Wh", note: "Removable, locks into the down tube", part: "battery" },
  { id: "range", label: "Range", value: "40–110", unit: "km", note: "Eco on flat Dutch roads, 75 kg rider", part: "battery" },
  { id: "drive", label: "Drive", value: "CDX", unit: "carbon belt", note: "No oil, 30,000 km service interval", part: "drive" },
  { id: "brakes", label: "Brakes", value: "180/160", unit: "mm", note: "Hydraulic disc, front / rear", part: "brakes" },
  { id: "weight", label: "Weight", value: "19.8", unit: "kg", note: "6061 aluminium frame, size M", part: "frame" },
  { id: "tyres", label: "Tyres", value: "650B × 50", unit: "mm", note: "Puncture belt, reflective wall", part: "tyres" },
  { id: "lights", label: "Lights", value: "70", unit: "lux", note: "Integrated, on with the motor", part: "lights" },
];

const CALLOUTS: { part: SpsPart; n: number; at: [number, number]; to: [number, number] }[] = [
  { part: "motor", n: 1, at: [180, 340], to: [96, 212] },
  { part: "battery", n: 2, at: [450, 272], to: [470, 386] },
  { part: "drive", n: 3, at: [256, 330], to: [262, 430] },
  { part: "brakes", n: 4, at: [648, 316], to: [740, 232] },
  { part: "frame", n: 5, at: [430, 160], to: [430, 70] },
  { part: "tyres", n: 6, at: [722, 380], to: [770, 430] },
  { part: "lights", n: 7, at: [588, 182], to: [680, 120] },
];

export function SpecSheet({
  model = "04",
  name = <>Brakke Model&nbsp;4<br /><span>City, light cargo</span></>,
  intro = "Built in Utrecht for people who carry things: a child seat, a crate of beer, a cello. One belt, one hub, no derailleur to bend in a bike rack.",
  price = "€3,890",
  specs = DEFAULT_SPECS,
  className,
}: SpecSheetProps) {
  const [hot, setHot] = useState<SpsPart | null>(null);
  const [drawn, setDrawn] = useState(false);
  const fig = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setDrawn(true); return; }
    const el = fig.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setDrawn(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const P = (part: SpsPart) => ({ "data-part": part, "data-on": hot === part ? "" : undefined });
  const numOf = (part: SpsPart) => CALLOUTS.find((c) => c.part === part)?.n;

  return (
    <section className={`fd-sps${className ? " " + className : ""}`} aria-labelledby={`${uid}-h`} data-hot={hot ?? undefined}>
      <style>{css}</style>
      <header className="fd-sps-head">
        <div className="fd-sps-model" aria-hidden="true">{model}</div>
        <div className="fd-sps-id">
          <p className="fd-sps-doc"><span>Sheet B4-21</span><span>Rev. C · 2026-09</span></p>
          <h2 id={`${uid}-h`} className="fd-sps-name">{name}</h2>
          <p className="fd-sps-intro">{intro}</p>
          <p className="fd-sps-price"><span>From</span><b>{price}</b><span>incl. 21% VAT</span></p>
        </div>
      </header>
      <div className="fd-sps-body">
        <div className="fd-sps-fig" ref={fig} data-drawn={drawn ? "" : undefined}>
          <svg viewBox="0 0 800 500" role="img" aria-label="Side elevation of the Model 4 with numbered callouts for motor, battery, belt drive, brakes, frame, tyres and lights">
            <defs>
              <pattern id={`g${uid}`} width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M20 0H0V20" fill="none" stroke="var(--fd-sps-grid)" strokeWidth=".5" />
              </pattern>
              <marker id={`a${uid}`} viewBox="0 0 8 8" refX="4" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0 1 L7 4 L0 7" fill="none" stroke="var(--fd-sps-mut)" strokeWidth="1" />
              </marker>
            </defs>
            <rect width="800" height="500" fill={`url(#g${uid})`} />
            <g className="fd-sps-draw">
              {/* tyres */}
              <g {...P("tyres")}>
                <circle cx="180" cy="340" r="120" pathLength={1} /><circle cx="180" cy="340" r="108" pathLength={1} className="fd-sps-thin" />
                <circle cx="620" cy="340" r="120" pathLength={1} /><circle cx="620" cy="340" r="108" pathLength={1} className="fd-sps-thin" />
              </g>
              {/* spokes */}
              <g className="fd-sps-spokes">
                {Array.from({ length: 16 }).map((_, i) => {
                  const a = (i / 16) * Math.PI * 2;
                  const x = Math.round(Math.cos(a) * 1060) / 10, y = Math.round(Math.sin(a) * 1060) / 10;
                  return <g key={i}><line x1="180" y1="340" x2={180 + x} y2={340 + y} /><line x1="620" y1="340" x2={620 + x} y2={340 + y} /></g>;
                })}
              </g>
              {/* frame */}
              <g {...P("frame")}>
                <path d="M330 350 L300 168 M300 172 L560 150 M300 178 L180 340 L330 350 M560 150 L574 200 L620 340" pathLength={1} />
                <path d="M300 168 L294 140 M262 136 L326 136 M560 150 L548 112 L530 108 M548 112 L592 104" pathLength={1} />
                <path d="M548 112 L540 108" pathLength={1} />
              </g>
              {/* battery in down tube */}
              <g {...P("battery")}>
                <path d="M330 350 L572 196" pathLength={1} className="fd-sps-tube" />
                <rect x="368" y="258" width="168" height="26" rx="6" transform="rotate(-32.4 452 271)" pathLength={1} />
                <line x1="384" y1="271" x2="520" y2="271" transform="rotate(-32.4 452 271)" className="fd-sps-thin" pathLength={1} />
              </g>
              {/* drive: belt + pulleys + crank */}
              <g {...P("drive")}>
                <circle cx="330" cy="350" r="24" pathLength={1} />
                <circle cx="180" cy="340" r="15" pathLength={1} />
                <path d="M330 326 L180 325 M330 374 L180 355" pathLength={1} />
                <path d="M330 350 L356 396 M346 398 L370 398" pathLength={1} className="fd-sps-crank" />
              </g>
              {/* motor hub */}
              <g {...P("motor")}>
                <circle cx="180" cy="340" r="30" pathLength={1} />
                <circle cx="180" cy="340" r="6" pathLength={1} />
              </g>
              {/* brakes */}
              <g {...P("brakes")}>
                <circle cx="620" cy="340" r="36" pathLength={1} strokeDasharray="4 3" className="fd-sps-disc" />
                <circle cx="180" cy="340" r="44" pathLength={1} strokeDasharray="4 3" className="fd-sps-disc" />
                <rect x="632" y="296" width="16" height="22" rx="3" pathLength={1} />
                <path d="M548 112 C 520 160, 600 230, 640 298" pathLength={1} className="fd-sps-thin" />
              </g>
              {/* lights */}
              <g {...P("lights")}>
                <rect x="578" y="172" width="18" height="12" rx="3" pathLength={1} />
                <path d="M600 178 L640 170 M600 178 L642 186" className="fd-sps-thin" pathLength={1} />
                <rect x="222" y="270" width="10" height="16" rx="2" pathLength={1} transform="rotate(-53 227 278)" />
              </g>
            </g>
            {/* ground + dimensions */}
            <line x1="40" y1="460" x2="760" y2="460" className="fd-sps-ground" />
            <g className="fd-sps-dim">
              <line x1="180" y1="478" x2="620" y2="478" markerStart={`url(#a${uid})`} markerEnd={`url(#a${uid})`} />
              <line x1="180" y1="464" x2="180" y2="488" /><line x1="620" y1="464" x2="620" y2="488" />
              <text x="400" y="494" textAnchor="middle">WHEELBASE 1,142</text>
              <line x1="784" y1="104" x2="784" y2="460" markerStart={`url(#a${uid})`} markerEnd={`url(#a${uid})`} />
              <text x="776" y="284" textAnchor="middle" transform="rotate(-90 776 284)">1,080</text>
              <path d="M300 168 A 60 60 0 0 1 318 228" fill="none" />
              <text x="320" y="210">72.5°</text>
            </g>
            {/* callouts */}
            {CALLOUTS.map((c) => (
              <g key={c.part} className="fd-sps-call" data-on={hot === c.part ? "" : undefined} onPointerEnter={() => setHot(c.part)} onPointerLeave={() => setHot(null)}>
                <line x1={c.at[0]} y1={c.at[1]} x2={c.to[0]} y2={c.to[1]} />
                <circle cx={c.at[0]} cy={c.at[1]} r="3" className="fd-sps-pin" />
                <circle cx={c.to[0]} cy={c.to[1]} r="13" className="fd-sps-tag" />
                <text x={c.to[0]} y={c.to[1] + 4} textAnchor="middle">{c.n}</text>
              </g>
            ))}
          </svg>
          <div className="fd-sps-titleblock" aria-hidden="true">
            <span>Scale 1:12</span><span>Units mm</span><span>Drawn J. de Wit</span><span>Size M</span>
          </div>
        </div>
        <dl className="fd-sps-grid">
          {specs.map((s, i) => {
            const n = numOf(s.part);
            return (
              <div
                key={s.id}
                className="fd-sps-cell"
                tabIndex={0}
                data-on={hot === s.part ? "" : undefined}
                onPointerEnter={() => setHot(s.part)}
                onPointerLeave={() => setHot(null)}
                onFocus={() => setHot(s.part)}
                onBlur={() => setHot(null)}
              >
                <dt><span className="fd-sps-i">{String(i + 1).padStart(2, "0")}</span>{s.label}{n !== undefined && <span className="fd-sps-ref" aria-hidden="true">{n}</span>}</dt>
                <dd>
                  <span className="fd-sps-v">{s.value}</span><span className="fd-sps-u">{s.unit}</span>
                  <span className="fd-sps-note">{s.note}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}

const css = `
:where(.fd-sps,.fd-sps *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-sps,.fd-sps *)::before,:where(.fd-sps,.fd-sps *)::after{box-sizing:border-box}
:where(.fd-sps svg){display:block}
.fd-sps{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-sps-bg:#0E1A2A;--fd-sps-chalk:#E8E5DA;--fd-sps-mut:#7F8A99;--fd-sps-line:rgba(232,229,218,.16);--fd-sps-grid:rgba(232,229,218,.06);--fd-sps-signal:#FF6A1F;--fd-sps-cell:#102033;
  --fd-sps-sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --fd-sps-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  display:block;width:100%;background:var(--fd-sps-bg);color:var(--fd-sps-chalk);padding:clamp(48px,7vw,104px) clamp(16px,4vw,56px);
  font:400 14px/1.5 var(--fd-sps-sans);-webkit-font-smoothing:antialiased}
.fd-sps-head{max-width:1328px;margin:0 auto;display:grid;grid-template-columns:auto minmax(0,1fr);gap:clamp(24px,4vw,64px);align-items:end;padding-bottom:28px;border-bottom:1px solid var(--fd-sps-chalk)}
.fd-sps-model{font:200 clamp(7rem,20vw,18rem)/.74 var(--fd-sps-sans);letter-spacing:-.08em;color:var(--fd-sps-chalk);font-variant-numeric:tabular-nums;margin-left:-.05em}
.fd-sps-id{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px 40px;align-items:end}
.fd-sps-doc{grid-column:1 / -1;display:flex;gap:24px;font:500 11px/14px var(--fd-sps-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--fd-sps-mut)}
.fd-sps-name{font:600 clamp(1.75rem,3vw,2.5rem)/1.05 var(--fd-sps-sans);letter-spacing:-.035em}
.fd-sps-name span{font-weight:400;color:var(--fd-sps-mut)}
.fd-sps-intro{font:400 15px/1.55 var(--fd-sps-sans);color:#B8BDC4;max-width:48ch}
.fd-sps-price{grid-column:1 / -1;display:flex;align-items:baseline;gap:12px;font:400 12px/1 var(--fd-sps-mono);color:var(--fd-sps-mut);text-transform:uppercase;letter-spacing:.06em}
.fd-sps-price b{font:500 22px/1 var(--fd-sps-mono);letter-spacing:-.02em;color:var(--fd-sps-signal);text-transform:none}
.fd-sps-body{max-width:1328px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);border-bottom:1px solid var(--fd-sps-line)}
.fd-sps-fig{position:relative;padding:24px 24px 16px 0;border-right:1px solid var(--fd-sps-line)}
.fd-sps-fig svg{width:100%;height:auto;overflow:visible}
.fd-sps-draw *{fill:none;stroke:var(--fd-sps-chalk);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.fd-sps-draw .fd-sps-thin{stroke-width:.8;opacity:.6}
.fd-sps-draw .fd-sps-tube{stroke-width:7;opacity:.18}
.fd-sps-spokes line{stroke-width:.4;opacity:.35}
.fd-sps-draw [data-part] *{stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1600ms var(--fd-ease-out),stroke var(--fd-dur-2) var(--fd-ease-in-out),opacity var(--fd-dur-2)}
.fd-sps-draw [data-part] .fd-sps-disc{stroke-dasharray:4 3;stroke-dashoffset:0;opacity:0;transition:opacity var(--fd-dur-4) 900ms,stroke var(--fd-dur-2)}
.fd-sps-fig[data-drawn] .fd-sps-draw [data-part] *{stroke-dashoffset:0}
.fd-sps-fig[data-drawn] .fd-sps-draw [data-part] .fd-sps-disc{opacity:.7}
.fd-sps-spokes{opacity:0;transition:opacity var(--fd-dur-4) 700ms}
.fd-sps-fig[data-drawn] .fd-sps-spokes{opacity:1}
.fd-sps[data-hot] .fd-sps-draw [data-part]:not([data-on]) *{opacity:.28}
.fd-sps-draw [data-part][data-on] *{stroke:var(--fd-sps-signal)}
.fd-sps-draw [data-part][data-on] .fd-sps-tube{opacity:.35}
.fd-sps-ground{stroke:var(--fd-sps-mut);stroke-width:1}
.fd-sps-dim line,.fd-sps-dim path{stroke:var(--fd-sps-mut);stroke-width:.8}
.fd-sps-dim text{font:500 11px var(--fd-sps-mono);letter-spacing:.08em;fill:var(--fd-sps-mut)}
.fd-sps-call{cursor:pointer}
.fd-sps-call line{stroke:var(--fd-sps-mut);stroke-width:.8;stroke-dasharray:2 3}
.fd-sps-call .fd-sps-pin{fill:var(--fd-sps-chalk)}
.fd-sps-call .fd-sps-tag{fill:var(--fd-sps-bg);stroke:var(--fd-sps-chalk);stroke-width:1;transition:fill var(--fd-dur-2),stroke var(--fd-dur-2)}
.fd-sps-call text{font:600 12px var(--fd-sps-mono);fill:var(--fd-sps-chalk);pointer-events:none}
.fd-sps-call[data-on] line{stroke:var(--fd-sps-signal);stroke-dasharray:none}
.fd-sps-call[data-on] .fd-sps-pin{fill:var(--fd-sps-signal)}
.fd-sps-call[data-on] .fd-sps-tag{fill:var(--fd-sps-signal);stroke:var(--fd-sps-signal)}
.fd-sps-call[data-on] text{fill:#14100C}
.fd-sps-titleblock{display:grid;grid-template-columns:repeat(4,auto);justify-content:start;gap:0;margin-top:12px;font:500 10px/14px var(--fd-sps-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--fd-sps-mut)}
.fd-sps-titleblock span{padding:6px 12px;border:1px solid var(--fd-sps-line);margin-left:-1px}
.fd-sps-titleblock span:first-child{margin-left:0}
.fd-sps-grid{display:grid;grid-template-columns:1fr 1fr;align-content:start}
.fd-sps-cell{position:relative;padding:18px 20px 20px;border-bottom:1px solid var(--fd-sps-line);outline:0;cursor:default;transition:background-color var(--fd-dur-2) var(--fd-ease-in-out)}
.fd-sps-cell:nth-child(odd){border-right:1px solid var(--fd-sps-line)}
.fd-sps-cell:nth-last-child(-n+2){border-bottom:0}
.fd-sps-cell::before{content:"";position:absolute;left:0;top:0;width:100%;height:2px;background:var(--fd-sps-signal);transform:scaleX(0);transform-origin:left;transition:transform var(--fd-dur-3) var(--fd-ease-out)}
.fd-sps-cell[data-on]{background:var(--fd-sps-cell)}
.fd-sps-cell[data-on]::before{transform:scaleX(1)}
.fd-sps-cell:focus-visible{box-shadow:inset 0 0 0 2px rgba(255,106,31,.7)}
.fd-sps-cell dt{display:flex;align-items:center;gap:10px;font:500 11px/14px var(--fd-sps-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--fd-sps-mut)}
.fd-sps-i{color:var(--fd-sps-chalk);opacity:.5}
.fd-sps-ref{margin-left:auto;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;box-shadow:inset 0 0 0 1px var(--fd-sps-line);font-size:10px;letter-spacing:0;color:var(--fd-sps-chalk);transition:background-color var(--fd-dur-2),color var(--fd-dur-2)}
.fd-sps-cell[data-on] .fd-sps-ref{background:var(--fd-sps-signal);color:#14100C;box-shadow:none}
.fd-sps-cell dd{margin-top:14px;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px}
.fd-sps-v{font:400 clamp(1.75rem,2.6vw,2.4rem)/1 var(--fd-sps-sans);letter-spacing:-.04em;font-variant-numeric:tabular-nums;color:var(--fd-sps-chalk);transition:color var(--fd-dur-2)}
.fd-sps-cell[data-on] .fd-sps-v{color:var(--fd-sps-signal)}
.fd-sps-u{font:500 12px/1 var(--fd-sps-mono);color:var(--fd-sps-mut)}
.fd-sps-note{flex-basis:100%;margin-top:6px;font:400 13px/1.4 var(--fd-sps-sans);color:#9AA3AE}
@media (max-width:1000px){
  .fd-sps-head{grid-template-columns:1fr;gap:20px}
  .fd-sps-id{grid-template-columns:1fr}
  .fd-sps-body{grid-template-columns:minmax(0,1fr)}
  .fd-sps-fig{border-right:0;border-bottom:1px solid var(--fd-sps-line);padding:20px 0 16px}
}
@media (max-width:520px){
  .fd-sps-model{font-size:9rem}
  .fd-sps-cell{padding:14px 12px 16px}
  .fd-sps-note{font-size:12px}
  .fd-sps-titleblock{grid-template-columns:repeat(2,auto)}
  .fd-sps-titleblock span:nth-child(3){margin-left:0}
  .fd-sps-titleblock span:nth-child(n+3){margin-top:-1px}
  .fd-sps-call text{font-size:16px}
}
@media (prefers-reduced-motion:reduce){
  .fd-sps *{transition-duration:1ms!important;transition-delay:0ms!important}
}
`;

export function Demo() {
  return (
    <div className="fd-spsd">
      <style>{`.fd-spsd{background:#0E1A2A;min-height:100vh}.fd-spsd-nav{box-sizing:border-box;max-width:1440px;margin:0 auto;height:56px;padding:0 clamp(16px,4vw,56px);display:flex;justify-content:space-between;align-items:center;font:500 12px/16px ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#7F8A99}.fd-spsd-nav b{font:800 18px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter",sans-serif;letter-spacing:.18em;color:#E8E5DA}.fd-spsd-nav b i{font-style:normal;color:#FF6A1F}`}</style>
      <div className="fd-spsd-nav"><b>BRAKKE<i>/</i></b><span>Model 4 · Test ride in Utrecht</span></div>
      <SpecSheet />
    </div>
  );
}
