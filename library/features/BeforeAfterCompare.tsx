/**
 * BeforeAfterCompare — a draggable before / after comparison for an AI
 * product-photo retouching tool. The "before" is the same photo with a colour
 * cast, uneven light and a cluttered set (stand, cable, tape, dust) built in
 * CSS and SVG; three chips choose which edits the "after" side receives.
 *
 * Props: src, alt, eyebrow, title, lede, edits ({ id, label, detail, stat }),
 * initial (0..100, divider position).
 * Default image /img/prism/parfum.webp (copy it next to your page or pass `src`).
 * CSS vars: --fd-bac-bg, --fd-bac-ink, --fd-bac-acid.
 *
 * Browser support: all evergreen browsers (clip-path inset, CSS filters,
 * pointer events with capture).
 * Interaction: drag anywhere on the image, or focus the handle and use the
 * arrow keys (Shift for 10%), Home and End.
 * Accessibility: the handle is role="slider" with aria-valuenow / valuetext;
 * edit chips are toggle buttons (aria-pressed); a live region says which edits
 * are applied.
 * Reduced motion: no intro sweep, no scan line; divider still moves directly.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

export interface BacEdit {
  id: "clutter" | "color" | "light";
  label: string;
  detail: string;
  stat: string;
}

export interface BeforeAfterCompareProps {
  src?: string;
  alt?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  edits?: BacEdit[];
  initial?: number;
  className?: string;
}

const DEFAULT_EDITS: BacEdit[] = [
  { id: "clutter", label: "Remove clutter", detail: "C-stand, cable, tape marks and 31 dust spots", stat: "14 objects" },
  { id: "color", label: "Fix colour", detail: "Tungsten cast neutralised to your brand white", stat: "ΔE 11.2 → 1.4" },
  { id: "light", label: "Relight", detail: "Soft key from the left, contact shadow rebuilt", stat: "5600 K" },
];

/** Deterministic dust so server and client render the same specks. */
const DUST = Array.from({ length: 31 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  const q = (v: number) => Math.round(v * 100) / 100;
  return { x: q(6 + r(1) * 88), y: q(4 + r(2) * 88), s: q(0.5 + r(3) * 1.6), d: r(4) > 0.6 };
});

function Clutter() {
  return (
    <svg className="fd-bac-clutter" viewBox="0 0 400 500" preserveAspectRatio="none" aria-hidden="true">
      {/* C-stand on the left */}
      <rect x="22" y="0" width="9" height="430" fill="#2a2a2a" />
      <rect x="18" y="140" width="17" height="22" rx="3" fill="#1b1b1b" />
      <rect x="31" y="146" width="70" height="7" fill="#303030" />
      <circle cx="104" cy="149.5" r="9" fill="#1b1b1b" />
      <path d="M26 430 L-10 500 M26 430 L60 500 M26 430 L26 500" stroke="#262626" strokeWidth="7" />
      {/* cable across the floor */}
      <path d="M-10 452 C 70 430, 120 492, 200 470 S 330 430, 410 476" fill="none" stroke="#111" strokeWidth="6" strokeLinecap="round" />
      <path d="M-10 452 C 70 430, 120 492, 200 470 S 330 430, 410 476" fill="none" stroke="#3a3a3a" strokeWidth="1.5" strokeLinecap="round" transform="translate(0 -1.5)" />
      {/* gaffer tape marks */}
      <rect x="120" y="408" width="46" height="9" fill="#C9B66B" opacity=".9" transform="rotate(-9 143 412)" />
      <rect x="250" y="415" width="38" height="9" fill="#C9B66B" opacity=".9" transform="rotate(14 269 419)" />
      <rect x="252" y="402" width="9" height="34" fill="#C9B66B" opacity=".85" transform="rotate(14 256 419)" />
      {/* clamp shadow on the right */}
      <ellipse cx="392" cy="120" rx="40" ry="110" fill="#000" opacity=".35" />
      {/* price sticker */}
      <rect x="272" y="300" width="34" height="18" rx="2" fill="#F4EFE2" transform="rotate(-6 289 309)" />
      <text x="276" y="313" fontSize="10" fontFamily="ui-monospace,Menlo,monospace" fill="#C03" transform="rotate(-6 289 309)">€49</text>
    </svg>
  );
}

export function BeforeAfterCompare({
  src = "/img/prism/parfum.webp",
  alt = "A bottle of PRISM eau de parfum on a grey studio backdrop",
  eyebrow = "Cleanplate for e-commerce",
  title = <>Shot on a kitchen table.<br /><span>Sold on a white page.</span></>,
  lede = "Upload a phone photo, get back a catalogue image that matches the other 400 in your store. Drag the line to compare.",
  edits = DEFAULT_EDITS,
  initial = 50,
  className,
}: BeforeAfterCompareProps) {
  const [pos, setPos] = useState(initial);
  const [on, setOn] = useState<Record<string, boolean>>({ clutter: true, color: true, light: true });
  const [scan, setScan] = useState(0);
  const [drag, setDrag] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const uid = useId();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = stage.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 1400);
        const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        setPos(initial + Math.sin(ease * Math.PI) * 26);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [initial]);

  const fromPointer = (clientX: number) => {
    const r = stage.current!.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  const onKey = (e: ReactKeyboardEvent) => {
    const d = e.shiftKey ? 10 : 2;
    const k: Record<string, number> = { ArrowLeft: pos - d, ArrowDown: pos - d, ArrowRight: pos + d, ArrowUp: pos + d, Home: 0, End: 100, PageDown: pos - 10, PageUp: pos + 10 };
    if (e.key in k) { e.preventDefault(); setPos(Math.max(0, Math.min(100, k[e.key]))); }
  };
  const toggle = (id: string) => { setOn((o) => ({ ...o, [id]: !o[id] })); setScan((s) => s + 1); };
  const applied = edits.filter((e) => on[e.id]);

  const layer = (fix: Record<string, boolean>) => (
    <div className="fd-bac-layer" data-color={fix.color ? "" : undefined} data-light={fix.light ? "" : undefined} data-clean={fix.clutter ? "" : undefined}>
      <img src={src} alt="" width={570} height={818} draggable={false} />
      <div className="fd-bac-cast" />
      <div className="fd-bac-light" />
      <div className="fd-bac-relight" />
      <Clutter />
      <svg className="fd-bac-dust" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {DUST.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={Math.round(d.s * 35) / 100} fill={d.d ? "rgba(30,25,20,.55)" : "rgba(255,255,255,.7)"} />)}
      </svg>
    </div>
  );

  return (
    <section className={`fd-bac${className ? " " + className : ""}`} aria-labelledby={`${uid}-h`}>
      <style>{css}</style>
      <div className="fd-bac-wrap">
        <div className="fd-bac-copy">
          <p className="fd-bac-eyebrow">{eyebrow}</p>
          <h2 id={`${uid}-h`} className="fd-bac-title">{title}</h2>
          <p className="fd-bac-lede">{lede}</p>
          <div className="fd-bac-chips" role="group" aria-label="Edits to apply">
            {edits.map((e, i) => (
              <button key={e.id} type="button" className="fd-bac-chip" aria-pressed={!!on[e.id]} onClick={() => toggle(e.id)}>
                <span className="fd-bac-chip-k">{String(i + 1).padStart(2, "0")}</span>
                <span className="fd-bac-chip-b"><b>{e.label}</b><small>{e.detail}</small></span>
                <span className="fd-bac-chip-s">{e.stat}</span>
                <span className="fd-bac-box" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5.2 4.2 7.4 8 2.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              </button>
            ))}
          </div>
          <p className="fd-bac-foot"><span>3.4 s per image</span><span>Exports to Shopify, Shopware, Amazon</span></p>
          <p className="fd-bac-sr" aria-live="polite">{applied.length ? `After shows: ${applied.map((a) => a.label.toLowerCase()).join(", ")}.` : "No edits applied."}</p>
        </div>
        <figure className="fd-bac-fig">
          <div
            ref={stage}
            className="fd-bac-stage"
            data-drag={drag ? "" : undefined}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); fromPointer(e.clientX); }}
            onPointerMove={(e) => { if (drag) fromPointer(e.clientX); }}
            onPointerUp={() => setDrag(false)}
            onPointerCancel={() => setDrag(false)}
            role="img"
            aria-label={`${alt}. Before and after retouching comparison.`}
          >
            {layer({})}
            <div className="fd-bac-after" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
              {layer(on)}
              <span key={scan} className="fd-bac-scan" data-run={scan ? "" : undefined} />
            </div>
            <span className="fd-bac-lab fd-bac-lab-b" style={{ opacity: pos < 14 ? 0 : 1 }}>Before</span>
            <span className="fd-bac-lab fd-bac-lab-a" style={{ opacity: pos > 86 ? 0 : 1 }}>After</span>
            <div className="fd-bac-div" style={{ left: `${pos}%` }}>
              <button
                type="button"
                className="fd-bac-handle"
                role="slider"
                aria-label="Comparison divider"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pos)}
                aria-valuetext={`${Math.round(100 - pos)}% after`}
                onKeyDown={onKey}
              >
                <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true"><path d="M5 1 1 5l4 4M13 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
          <figcaption className="fd-bac-cap"><span>IMG_4471.HEIC</span><span>3024 × 4032 → 2000 × 2500, sRGB</span></figcaption>
        </figure>
      </div>
    </section>
  );
}

const css = `
:where(.fd-bac,.fd-bac *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-bac,.fd-bac *)::before,:where(.fd-bac,.fd-bac *)::after{box-sizing:border-box}
:where(.fd-bac svg,.fd-bac img){display:block}
:where(.fd-bac button){appearance:none;-webkit-appearance:none;outline:0;border-radius:0;cursor:pointer;text-align:left}
.fd-bac{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-bac-bg:#171716;--fd-bac-ink:#F2F1EC;--fd-bac-mut:#8F8E88;--fd-bac-line:rgba(242,241,236,.12);--fd-bac-acid:#E2FF3D;--fd-bac-panel:#1F1F1D;
  --fd-bac-sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --fd-bac-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  display:block;width:100%;background:var(--fd-bac-bg);color:var(--fd-bac-ink);padding:clamp(56px,8vw,112px) clamp(16px,4vw,56px);
  font:400 15px/1.5 var(--fd-bac-sans);-webkit-font-smoothing:antialiased}
.fd-bac-wrap{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(32px,6vw,88px);align-items:center}
.fd-bac-eyebrow{display:inline-flex;align-items:center;gap:8px;font:500 12px/16px var(--fd-bac-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--fd-bac-mut)}
.fd-bac-eyebrow::before{content:"";width:14px;height:14px;border-radius:50%;background:conic-gradient(var(--fd-bac-acid) 0 50%,transparent 0);box-shadow:inset 0 0 0 1.5px var(--fd-bac-acid)}
.fd-bac-title{margin-top:18px;font:600 clamp(2.25rem,3.9vw,3.4rem)/1 var(--fd-bac-sans);letter-spacing:-.045em}
.fd-bac-title span{color:var(--fd-bac-mut)}
.fd-bac-lede{margin-top:20px;max-width:42ch;font:400 16px/1.55 var(--fd-bac-sans);color:var(--fd-bac-mut)}
.fd-bac-chips{margin-top:32px;display:flex;flex-direction:column;gap:8px}
.fd-bac-chip{display:grid;grid-template-columns:28px minmax(0,1fr) auto 22px;gap:12px;align-items:center;padding:14px 16px;border-radius:14px;background:var(--fd-bac-panel);box-shadow:inset 0 0 0 1px var(--fd-bac-line);color:var(--fd-bac-ink);transition:box-shadow var(--fd-dur-2) var(--fd-ease-in-out),background-color var(--fd-dur-2),transform var(--fd-dur-1)}
.fd-bac-chip:hover{background:#252523}
.fd-bac-chip:active{transform:scale(.98)}
.fd-bac-chip:focus-visible,.fd-bac-handle:focus-visible{outline:2px solid rgba(226,255,61,.75);outline-offset:2px}
.fd-bac-chip[aria-pressed="true"]{box-shadow:inset 0 0 0 1px rgba(226,255,61,.55)}
.fd-bac-chip-k{font:500 12px/1 var(--fd-bac-mono);color:var(--fd-bac-mut)}
.fd-bac-chip-b{display:flex;flex-direction:column;min-width:0}
.fd-bac-chip-b b{font:600 15px/20px var(--fd-bac-sans);letter-spacing:-.01em}
.fd-bac-chip-b small{font:400 13px/18px var(--fd-bac-sans);color:var(--fd-bac-mut)}
.fd-bac-chip-s{font:500 12px/1 var(--fd-bac-mono);color:var(--fd-bac-mut);white-space:nowrap}
.fd-bac-chip[aria-pressed="true"] .fd-bac-chip-s{color:var(--fd-bac-acid)}
.fd-bac-box{display:grid;place-items:center;width:22px;height:22px;border-radius:6px;box-shadow:inset 0 0 0 1.5px var(--fd-bac-line);color:transparent;transition:background-color var(--fd-dur-2) var(--fd-ease-in-out),color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-bac-chip[aria-pressed="true"] .fd-bac-box{background:var(--fd-bac-acid);color:#171716;box-shadow:none}
.fd-bac-chip:active .fd-bac-box{transform:scale(.85)}
.fd-bac-foot{display:flex;flex-wrap:wrap;gap:8px 24px;margin-top:24px;font:400 12px/16px var(--fd-bac-mono);color:var(--fd-bac-mut)}
.fd-bac-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.fd-bac-fig{margin:0;width:100%;max-width:540px;justify-self:end}
.fd-bac-stage{position:relative;width:100%;aspect-ratio:4/5;overflow:hidden;border-radius:6px;background:#888;cursor:ew-resize;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.fd-bac-layer{position:absolute;inset:0;overflow:hidden;background:#9a9a96}
.fd-bac-layer img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 70%;transform:rotate(1.6deg) scale(1.06);filter:sepia(.42) saturate(.78) brightness(.86) contrast(.84) hue-rotate(-6deg);transition:filter var(--fd-dur-4) var(--fd-ease-in-out),transform var(--fd-dur-4) var(--fd-ease-out)}
.fd-bac-layer[data-color] img{filter:none}
.fd-bac-layer[data-clean] img{transform:none}
.fd-bac-cast{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,170,60,.18),rgba(120,70,20,.16));mix-blend-mode:multiply;transition:opacity var(--fd-dur-4) var(--fd-ease-in-out)}
.fd-bac-layer[data-color] .fd-bac-cast{opacity:0}
.fd-bac-light{position:absolute;inset:0;background:radial-gradient(35% 28% at 78% 18%,rgba(255,250,230,.55),transparent 70%),linear-gradient(90deg,rgba(0,0,0,.42),transparent 45%,rgba(0,0,0,.2));transition:opacity var(--fd-dur-4) var(--fd-ease-in-out)}
.fd-bac-relight{position:absolute;inset:0;opacity:0;background:radial-gradient(70% 55% at 30% 30%,rgba(255,255,255,.22),transparent 70%),radial-gradient(30% 6% at 50% 86%,rgba(0,0,0,.18),transparent 80%);transition:opacity var(--fd-dur-4) var(--fd-ease-in-out)}
.fd-bac-layer[data-light] .fd-bac-light{opacity:0}
.fd-bac-layer[data-light] .fd-bac-relight{opacity:1}
.fd-bac-clutter,.fd-bac-dust{position:absolute;inset:0;width:100%;height:100%;transition:opacity var(--fd-dur-3) var(--fd-ease-in-out)}
.fd-bac-layer[data-clean] .fd-bac-clutter,.fd-bac-layer[data-clean] .fd-bac-dust{opacity:0}
.fd-bac-after{position:absolute;inset:0}
.fd-bac-scan{position:absolute;top:0;bottom:0;left:-30%;width:30%;background:linear-gradient(90deg,transparent,rgba(226,255,61,.18) 70%,rgba(226,255,61,.85) 98%,transparent);opacity:0;pointer-events:none}
.fd-bac-scan[data-run]{animation:fd-bac-scan var(--fd-dur-4) var(--fd-ease-in-out) both}
@keyframes fd-bac-scan{0%{opacity:1;transform:translateX(0)}100%{opacity:1;transform:translateX(433%)}}
.fd-bac-lab{position:absolute;top:14px;padding:5px 9px;border-radius:999px;font:500 11px/1 var(--fd-bac-mono);letter-spacing:.08em;text-transform:uppercase;transition:opacity var(--fd-dur-2);pointer-events:none}
.fd-bac-lab-b{left:14px;background:rgba(23,23,22,.72);color:var(--fd-bac-ink)}
.fd-bac-lab-a{right:14px;background:var(--fd-bac-acid);color:#171716}
.fd-bac-div{position:absolute;top:0;bottom:0;width:0;z-index:2}
.fd-bac-div::before{content:"";position:absolute;top:0;bottom:0;left:-1px;width:2px;background:var(--fd-bac-acid);box-shadow:0 0 0 1px rgba(0,0,0,.15)}
.fd-bac-handle{position:absolute;left:-22px;top:50%;width:44px;height:44px;margin-top:-22px;border-radius:50%;display:grid;place-items:center;background:var(--fd-bac-acid);color:#171716;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:ew-resize;transition:transform var(--fd-dur-2) var(--fd-spring)}
.fd-bac-stage[data-drag] .fd-bac-handle{transform:scale(.9)}
.fd-bac-cap{display:flex;justify-content:space-between;gap:12px;margin-top:12px;font:400 12px/16px var(--fd-bac-mono);color:var(--fd-bac-mut)}
@media (max-width:900px){
  .fd-bac-wrap{grid-template-columns:minmax(0,1fr)}
  .fd-bac-copy{display:contents}
  .fd-bac-fig{order:1;margin-top:28px;justify-self:stretch;max-width:none}
  .fd-bac-chips{order:2}
  .fd-bac-foot{order:3}
}
@media (max-width:520px){
  .fd-bac-chip{grid-template-columns:minmax(0,1fr) 22px;padding:12px 14px}
  .fd-bac-chip-k,.fd-bac-chip-s{display:none}
  .fd-bac-cap span:last-child{display:none}
}
@media (prefers-reduced-motion:reduce){
  .fd-bac *{transition-duration:1ms!important}
  .fd-bac-scan{display:none}
}
`;

export function Demo() {
  return (
    <div className="fd-bacd">
      <style>{`.fd-bacd{background:#171716;min-height:100vh}.fd-bacd-nav{box-sizing:border-box;max-width:1352px;margin:0 auto;height:60px;padding:0 clamp(16px,4vw,56px);display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(242,241,236,.12);font:500 13px/18px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter",sans-serif;color:#8F8E88}.fd-bacd-nav b{font:700 17px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter",sans-serif;letter-spacing:-.05em;color:#F2F1EC}.fd-bacd-nav b i{font-style:normal;display:inline-block;width:9px;height:9px;margin-left:3px;border-radius:50%;background:#E2FF3D}`}</style>
      <div className="fd-bacd-nav"><b>cleanplate<i /></b><span>Pricing · API · Sign in</span></div>
      <BeforeAfterCompare />
    </div>
  );
}
