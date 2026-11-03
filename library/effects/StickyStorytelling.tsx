/**
 * StickyStory, Apple-style scrollytelling. The media column stays pinned
 * while text steps scroll past; the active step drives a crossfade/morph
 * between media states and a progress rail.
 *
 * Props:
 * - steps: { eyebrow, title, body, stat? }[], text column.
 * - renderMedia(active): ReactNode, return every media state; mark the one
 *   matching `active` (e.g. data-active) and crossfade with CSS. The media
 *   root also receives `--fd-sst-p` (0–1 across the story) and `--fd-sst-k`
 *   (fractional step index) every frame for continuous, scrubbed motion.
 * - header: optional ReactNode rendered above the grid.
 * - scrollContainer: optional ref to a scrolling element; otherwise the
 *   nearest scrollable ancestor or the window.
 * CSS vars: --fd-sst-accent, --fd-sst-bg, --fd-sst-ink.
 *
 * Browser support: evergreen (position: sticky). Under 760px the media pins
 * to the top half and steps scroll beneath it.
 * Accessibility: all copy is real, in-order text. The active step is mirrored
 * with aria-current. Reduced motion keeps crossfades at 120ms and removes
 * scale and drift.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";

export type StoryStep = { eyebrow: string; title: string; body: string; stat?: { value: string; label: string } };

export interface StickyStoryProps {
  steps: StoryStep[];
  renderMedia: (active: number) => ReactNode;
  scrollContainer?: RefObject<HTMLElement | null>;
  header?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && p.scrollHeight > p.clientHeight + 1) return p;
    p = p.parentElement;
  }
  return null;
}

export function StickyStory({ steps, renderMedia, scrollContainer, header, className, style }: StickyStoryProps) {
  const root = useRef<HTMLElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const stepEls = useRef<(HTMLElement | null)[]>([]);
  const fill = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = root.current;
    const md = media.current;
    if (!el || !md) return;
    const sc = scrollContainer?.current ?? findScrollParent(el);
    const target: HTMLElement | Window = sc ?? window;
    let raf = 0;
    let cur = -1;
    let visible = true;

    const frame = () => {
      raf = 0;
      // read phase
      const vh = sc ? sc.clientHeight : window.innerHeight;
      const top0 = sc ? sc.getBoundingClientRect().top : 0;
      const line = top0 + vh * 0.55;
      const rects = stepEls.current.map((s) => (s ? s.getBoundingClientRect() : null));
      let k = 0;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (!r) continue;
        const mid = r.top + r.height / 2;
        if (mid < line) k = i;
      }
      // fractional index for continuous morphs
      const first = rects[0];
      const last = rects[rects.length - 1];
      let p = 0;
      if (first && last) {
        const a = first.top + first.height / 2;
        const b = last.top + last.height / 2;
        p = clamp((line - a) / (b - a || 1));
      }
      // write phase
      md.style.setProperty("--fd-sst-p", p.toFixed(4));
      md.style.setProperty("--fd-sst-k", (p * (steps.length - 1)).toFixed(4));
      if (fill.current) fill.current.style.transform = `scaleY(${p.toFixed(4)})`;
      if (k !== cur) {
        cur = k;
        setActive(k);
      }
    };
    const kick = () => {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) kick();
      },
      { root: sc ?? null },
    );
    io.observe(el);
    frame();
    target.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    return () => {
      io.disconnect();
      target.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollContainer, steps.length]);

  return (
    <section ref={root} className={`fd-sst${className ? " " + className : ""}`} style={style}>
      <style>{css}</style>
      {header}
      <div className="fd-sst-grid">
        <div className="fd-sst-pin">
          <div ref={media} className="fd-sst-media" data-active={active}>
            {renderMedia(active)}
          </div>
          <ol className="fd-sst-dots" aria-hidden="true">
            {steps.map((s, i) => (
              <li key={s.title} className="fd-sst-dot" data-on={i === active ? "" : undefined}>
                <span className="fd-sst-dot-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="fd-sst-dot-l">{s.eyebrow}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="fd-sst-text">
          <span className="fd-sst-rail" aria-hidden="true">
            <span ref={fill} className="fd-sst-fill" />
          </span>
          {steps.map((s, i) => (
            <article
              key={s.title}
              ref={(n) => {
                stepEls.current[i] = n;
              }}
              className="fd-sst-step"
              data-on={i === active ? "" : undefined}
              aria-current={i === active ? "step" : undefined}
            >
              <span className="fd-sst-knot" aria-hidden="true" />
              <p className="fd-sst-eyebrow">
                <span className="fd-sst-n">{String(i + 1).padStart(2, "0")}</span>
                {s.eyebrow}
              </p>
              <h3 className="fd-sst-title">{s.title}</h3>
              <p className="fd-sst-body">{s.body}</p>
              {s.stat && (
                <p className="fd-sst-stat">
                  <span className="fd-sst-stat-v">{s.stat.value}</span>
                  <span className="fd-sst-stat-l">{s.stat.label}</span>
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const css = `
.fd-sst{
  --fd-ease-out:cubic-bezier(0.22,1,0.36,1);--fd-ease-in-out:cubic-bezier(0.65,0,0.35,1);
  --fd-spring:cubic-bezier(0.34,1.56,0.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-sst-accent:#0E9F8E;--fd-sst-bg:#F4F6F5;--fd-sst-ink:#0B1412;--fd-sst-muted:#5D6B67;
  --fd-sst-sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --fd-sst-display:"SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter Display","Inter","Segoe UI",Roboto,sans-serif;
  --fd-sst-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  position:relative;display:block;margin:0;padding:0;background:var(--fd-sst-bg);color:var(--fd-sst-ink);
}
.fd-sst,.fd-sst *,.fd-sst *::before,.fd-sst *::after{box-sizing:border-box}
.fd-sst-grid{
  display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);gap:clamp(32px,6vw,96px);
  max-width:1240px;margin:0 auto;padding:0 clamp(16px,4vw,56px);
}
.fd-sst-pin{
  position:sticky;top:0;height:100vh;height:100svh;display:flex;flex-direction:column;justify-content:center;gap:20px;margin:0;padding:24px 0;
}
.fd-sst-media{
  --fd-sst-p:0;--fd-sst-k:0;
  position:relative;width:100%;aspect-ratio:1/1;max-height:72vh;margin:0 auto;border-radius:28px;overflow:hidden;
  background:#0B1412;box-shadow:0 40px 80px -40px rgba(11,20,18,.45),0 0 0 1px rgba(11,20,18,.06);
}
.fd-sst-dots{display:flex;gap:6px;list-style:none;margin:0;padding:0;justify-content:center}
.fd-sst-dot{
  display:inline-flex;align-items:center;gap:6px;height:28px;margin:0;padding:0 12px;border-radius:9999px;
  color:var(--fd-sst-muted);background:transparent;border:1px solid rgba(11,20,18,.1);
  font:500 0.75rem/1 var(--fd-sst-sans);letter-spacing:0;white-space:nowrap;
  transition:background var(--fd-dur-2) var(--fd-ease-out),color var(--fd-dur-2) var(--fd-ease-out),border-color var(--fd-dur-2) var(--fd-ease-out);
}
.fd-sst-dot-n{font:500 0.6875rem/1 var(--fd-sst-mono)}
.fd-sst-dot[data-on]{background:var(--fd-sst-ink);color:#fff;border-color:var(--fd-sst-ink)}

.fd-sst-text{position:relative;margin:0;padding:22vh 0 30vh 36px}
.fd-sst-rail{position:absolute;left:5px;top:22vh;bottom:30vh;width:2px;border-radius:9999px;background:rgba(11,20,18,.08);overflow:hidden}
.fd-sst-fill{position:absolute;inset:0;display:block;background:var(--fd-sst-accent);transform:scaleY(0);transform-origin:50% 0;will-change:transform}
.fd-sst-step{
  position:relative;display:block;margin:0;padding:0;min-height:62vh;
  opacity:.28;transition:opacity var(--fd-dur-3) var(--fd-ease-out);
}
.fd-sst-step:last-child{min-height:40vh}
.fd-sst-step[data-on]{opacity:1}
.fd-sst-knot{
  position:absolute;left:-36px;top:4px;width:12px;height:12px;border-radius:50%;
  background:var(--fd-sst-bg);border:2px solid rgba(11,20,18,.2);
  transition:border-color var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring),background var(--fd-dur-2) var(--fd-ease-out);
}
.fd-sst-step[data-on] .fd-sst-knot{border-color:var(--fd-sst-accent);background:var(--fd-sst-accent);transform:scale(1.25)}
.fd-sst-eyebrow{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:0;color:var(--fd-sst-accent);font:600 0.8125rem/1.2 var(--fd-sst-sans);letter-spacing:0}
.fd-sst-n{color:var(--fd-sst-muted);font:500 0.75rem/1 var(--fd-sst-mono)}
.fd-sst-title{margin:0 0 14px;padding:0;color:var(--fd-sst-ink);font:650 clamp(1.75rem,3vw,2.75rem)/1.05 var(--fd-sst-display);letter-spacing:-0.03em}
.fd-sst-body{margin:0;padding:0;max-width:440px;color:var(--fd-sst-muted);font:400 1.0625rem/1.55 var(--fd-sst-sans);letter-spacing:-0.005em}
.fd-sst-stat{display:flex;align-items:baseline;gap:12px;margin:28px 0 0;padding:18px 0 0;border-top:1px solid rgba(11,20,18,.1);max-width:440px}
.fd-sst-stat-v{flex:none;white-space:nowrap;color:var(--fd-sst-ink);font:600 2rem/1 var(--fd-sst-display);letter-spacing:-0.025em}
.fd-sst-stat-l{color:var(--fd-sst-muted);font:400 0.8125rem/1.35 var(--fd-sst-sans);letter-spacing:0}

@media (max-width:760px){
  .fd-sst-grid{display:block;padding:0}
  .fd-sst-pin{height:auto;top:0;z-index:2;padding:12px 16px 12px;gap:10px;background:var(--fd-sst-bg)}
  .fd-sst-pin::after{content:"";position:absolute;left:0;right:0;top:100%;height:32px;background:linear-gradient(var(--fd-sst-bg),transparent);pointer-events:none}
  .fd-sst-media{aspect-ratio:16/11;max-height:44vh;border-radius:22px}
  .fd-sst-dot-l{display:none}
  .fd-sst-dot{padding:0 10px;height:24px}
  .fd-sst-text{padding:8vh 16px 30vh 50px}
  .fd-sst-rail{left:21px;top:8vh}
  .fd-sst-step{min-height:58vh}
  .fd-sst-title{font-size:1.625rem}
  .fd-sst-body{font-size:0.9375rem}
}
@media (prefers-reduced-motion: reduce){
  .fd-sst *{transition-duration:120ms !important}
}
`;

/* ------------------------------------------------------------------ Demo */

const STEPS: StoryStep[] = [
  {
    eyebrow: "Design",
    title: "Write the protocol once. In plain language.",
    body: "Describe the experiment the way you’d explain it to a colleague. Helix compiles it into a validated plate map with controls, replicates and randomised well positions.",
    stat: { value: "38 min", label: "median time from idea to a runnable 384-well plan" },
  },
  {
    eyebrow: "Run",
    title: "Robots run it overnight. You sleep.",
    body: "Plans dispatch to liquid handlers, incubators and readers across your bench. Every pipetting step is logged with volume, tip and timestamp, no more lab-notebook archaeology.",
    stat: { value: "11,204", label: "plates executed last month across 62 partner labs" },
  },
  {
    eyebrow: "Analyse",
    title: "Results arrive already curve-fitted.",
    body: "Dose–response fits, Z′ factors and outlier flags compute as the reader streams. Bad wells are caught at 3 a.m., not at Monday stand-up.",
    stat: { value: "Z′ 0.81", label: "average assay quality on the platform this quarter" },
  },
  {
    eyebrow: "Share",
    title: "Every result is reproducible by default.",
    body: "Publish the protocol, raw reads and analysis as one signed bundle. A collaborator in Basel can rerun your exact experiment on their own hardware.",
    stat: { value: "94%", label: "of shared runs reproduced within ±5% on first attempt" },
  },
];

// 16 × 24 plate rendered as 8 × 12 for clarity
const ROWS = 8;
const COLS = 12;
const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function HelixMedia({ active }: { active: number }) {
  const wells = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const conc = c / (COLS - 1);
      const resp = 1 / (1 + Math.pow(0.35 / Math.max(0.02, conc), 2.4));
      const ctrl = c === 0 || c === COLS - 1;
      const outlier = i === 41 || i === 77;
      wells.push(
        <span
          key={i}
          className="fd-sst-demo-well"
          data-ctrl={ctrl ? "" : undefined}
          data-out={outlier ? "" : undefined}
          style={{
            ["--r" as string]: r,
            ["--c" as string]: c,
            ["--v" as string]: (resp * (0.85 + hash(i) * 0.3)).toFixed(3),
            ["--d" as string]: `${Math.round((r + c) * 18)}ms`,
          }}
        />,
      );
    }
  // dose–response points
  const pts = Array.from({ length: 12 }, (_, i) => {
    const x = i / 11;
    const y = 1 / (1 + Math.pow(0.42 / Math.max(0.03, x), 2.6));
    return { x: 40 + x * 320, y: 250 - (y * (0.92 + hash(i + 9) * 0.16)) * 200 };
  });
  const curve = Array.from({ length: 60 }, (_, i) => {
    const x = i / 59;
    const y = 1 / (1 + Math.pow(0.42 / Math.max(0.03, x), 2.6));
    return `${i ? "L" : "M"}${(40 + x * 320).toFixed(1)} ${(250 - y * 200).toFixed(1)}`;
  }).join(" ");

  return (
    <div className="fd-sst-demo-stage" data-state={active}>
      <div className="fd-sst-demo-bgl" />
      {/* state 0: protocol editor */}
      <div className="fd-sst-demo-layer fd-sst-demo-proto" data-active={active === 0 ? "" : undefined}>
        <div className="fd-sst-demo-win">
          <div className="fd-sst-demo-winbar">
            <i />
            <i />
            <i />
            <span>kinase-panel-v3.helix</span>
          </div>
          <div className="fd-sst-demo-code">
            <p>
              <b>test</b> 12 compounds <em>against</em> KRAS-G12C
            </p>
            <p>
              <b>dose</b> 10 µM → 0.5 nM, <em>half-log</em>, 11 points
            </p>
            <p>
              <b>replicates</b> 3 · <b>controls</b> DMSO, sotorasib
            </p>
            <p>
              <b>readout</b> luminescence @ 24 h
            </p>
            <p className="fd-sst-demo-ok">✓ compiled · 384 wells · 2 plates</p>
          </div>
        </div>
      </div>
      {/* state 1+2: plate */}
      <div className="fd-sst-demo-layer fd-sst-demo-plate" data-active={active === 1 || active === 2 ? "" : undefined}>
        <div className="fd-sst-demo-platebox">
          <div className="fd-sst-demo-wells">{wells}</div>
          <div className="fd-sst-demo-head">
            <span>HX-0412 · 1/2</span>
            <span className="fd-sst-demo-live">{active >= 2 ? "2 outliers flagged" : "Dispensing · row F"}</span>
          </div>
        </div>
      </div>
      {/* state 3: curve + bundle */}
      <div className="fd-sst-demo-layer fd-sst-demo-curve" data-active={active === 3 ? "" : undefined}>
        <svg viewBox="0 0 400 290" className="fd-sst-demo-svg" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1="40" x2="360" y1={50 + i * 50} y2={50 + i * 50} stroke="rgba(255,255,255,.08)" />
          ))}
          <path d={curve} className="fd-sst-demo-path" pathLength={1} />
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4.5" className="fd-sst-demo-pt" style={{ ["--d" as string]: `${i * 40}ms` }} />
          ))}
          <text x="40" y="280" className="fd-sst-demo-ax">
            0.5 nM
          </text>
          <text x="360" y="280" textAnchor="end" className="fd-sst-demo-ax">
            10 µM
          </text>
        </svg>
        <div className="fd-sst-demo-card">
          <span className="fd-sst-demo-card-k">IC₅₀</span>
          <span className="fd-sst-demo-card-v">42.7 nM</span>
          <span className="fd-sst-demo-card-s">Signed bundle · sha 9f3c…a10e</span>
        </div>
      </div>
    </div>
  );
}

export function Demo() {
  return (
    <div className="fd-sst-demo">
      <style>{demoCss}</style>
      <StickyStory
        steps={STEPS}
        renderMedia={(a) => <HelixMedia active={a} />}
        header={
          <header className="fd-sst-demo-hero">
            <p className="fd-sst-demo-kicker">Helix Bio, the lab operating system</p>
            <h2 className="fd-sst-demo-h">From hypothesis to signed result in one loop.</h2>
            <p className="fd-sst-demo-cue" aria-hidden="true">
              <span className="fd-sst-demo-cue-line" />
              Scroll
            </p>
          </header>
        }
      />
    </div>
  );
}

const demoCss = `
.fd-sst-demo{display:block;margin:0;padding:0;background:#F4F6F5;min-height:100vh}
.fd-sst-demo-hero{max-width:1240px;margin:0 auto;padding:clamp(48px,10vh,120px) clamp(16px,4vw,56px) 0;text-align:left}
.fd-sst-demo-kicker{margin:0 0 14px;padding:0;color:#0E9F8E;font:600 0.875rem/1.2 ui-sans-serif,-apple-system,"Inter",sans-serif;letter-spacing:0}
.fd-sst-demo-h{margin:0;padding:0;max-width:880px;color:#0B1412;font:650 clamp(2.25rem,6vw,4.5rem)/1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.045em}
.fd-sst-demo-cue{display:flex;width:fit-content;align-items:center;gap:10px;margin:28px 0 0;padding:0;color:#5D6B67;font:500 0.75rem/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}
.fd-sst-demo-cue-line{position:relative;display:block;width:1px;height:28px;overflow:hidden;background:rgba(11,20,18,.15)}
.fd-sst-demo-cue-line::after{content:"";position:absolute;left:0;top:0;width:1px;height:12px;background:#0B1412;animation:fd-sst-cue 1.6s cubic-bezier(0.65,0,0.35,1) infinite}
@keyframes fd-sst-cue{0%{transform:translateY(-12px)}100%{transform:translateY(28px)}}

.fd-sst-demo-stage{position:absolute;inset:0;overflow:hidden;container-type:size;color:#E8F2EF;font-family:ui-sans-serif,-apple-system,"Inter",sans-serif}
.fd-sst-demo-bgl{
  position:absolute;inset:-20%;
  background:
    radial-gradient(40% 40% at calc(30% + var(--fd-sst-p) * 40%) 25%,rgba(14,159,142,.55),transparent 70%),
    radial-gradient(45% 45% at calc(80% - var(--fd-sst-p) * 50%) 85%,rgba(91,108,255,.4),transparent 70%),
    #0B1412;
}
.fd-sst-demo-layer{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:8%;
  opacity:0;transform:scale(.94) translate3d(0,16px,0);filter:blur(6px);
  transition:opacity var(--fd-dur-4) var(--fd-ease-out),transform var(--fd-dur-4) var(--fd-ease-out),filter var(--fd-dur-3) var(--fd-ease-out);
  pointer-events:none;
}
.fd-sst-demo-layer[data-active]{opacity:1;transform:none;filter:none}
.fd-sst-demo-win{width:100%;max-width:min(440px,100cqh * 1.25);border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  -webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);overflow:hidden;box-shadow:0 30px 60px -30px rgba(0,0,0,.6)}
.fd-sst-demo-winbar{display:flex;align-items:center;gap:6px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);font:500 0.75rem/1 ui-monospace,"SF Mono",Menlo,monospace;color:rgba(232,242,239,.6)}
.fd-sst-demo-winbar i{display:block;width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.18)}
.fd-sst-demo-winbar span{margin-left:8px}
.fd-sst-demo-code{padding:clamp(10px,4cqh,18px) 18px clamp(12px,4.4cqh,20px);display:grid;gap:clamp(4px,2.2cqh,10px)}
.fd-sst-demo-code p{margin:0;padding:0;font:400 clamp(0.625rem,3.4cqh,0.9375rem)/1.45 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;color:#E8F2EF;
  opacity:0;transform:translate3d(-8px,0,0);transition:opacity var(--fd-dur-3) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-ease-out)}
.fd-sst-demo-proto[data-active] .fd-sst-demo-code p{opacity:1;transform:none}
.fd-sst-demo-code p:nth-child(2){transition-delay:90ms}.fd-sst-demo-code p:nth-child(3){transition-delay:180ms}
.fd-sst-demo-code p:nth-child(4){transition-delay:270ms}.fd-sst-demo-code p:nth-child(5){transition-delay:420ms}
.fd-sst-demo-code b{font-weight:600;color:#5EEAD4}
.fd-sst-demo-code em{font-style:normal;color:#A5B4FC}
.fd-sst-demo-ok{color:#86EFAC !important;margin-top:6px !important}

.fd-sst-demo-platebox{width:100%;max-width:min(480px,86cqh * 1.3);padding:18px;border-radius:20px;background:linear-gradient(160deg,#E7ECEA,#C9D2CF);box-shadow:0 30px 60px -30px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.8)}
.fd-sst-demo-wells{display:grid;grid-template-columns:repeat(${COLS},1fr);gap:clamp(3px,.6vw,6px)}
.fd-sst-demo-well{
  display:block;aspect-ratio:1;border-radius:50%;
  background:radial-gradient(circle at 40% 35%,rgba(255,255,255,.7),rgba(255,255,255,0) 50%),#AEB9B5;
  box-shadow:inset 0 1px 2px rgba(0,0,0,.25);
  position:relative;overflow:hidden;
}
.fd-sst-demo-well::after{
  content:"";position:absolute;inset:0;border-radius:50%;
  background:color-mix(in srgb,#0E9F8E calc(var(--v) * 100%),#E9F7A8);
  transform:scale(0);opacity:0;
  transition:transform var(--fd-dur-3) var(--fd-spring) var(--d),opacity var(--fd-dur-2) var(--fd-ease-out) var(--d),background var(--fd-dur-4) var(--fd-ease-out);
}
.fd-sst-demo-well[data-ctrl]::after{background:#64748B}
/* Run: rows dispense progressively, scrubbed by --fd-sst-k (fractional step) */
.fd-sst-demo-stage[data-state="1"] .fd-sst-demo-well::after{
  --fill:clamp(0,(var(--fd-sst-k) - 0.45 - var(--r) * 0.065) * 7,1);
  transform:scale(calc(var(--fill) * .72));opacity:calc(var(--fill) * .9);background:#7DD3C7;
  transition:background var(--fd-dur-4) var(--fd-ease-out);
}
.fd-sst-demo-stage[data-state="1"] .fd-sst-demo-well[data-ctrl]::after{background:#94A3B8}
.fd-sst-demo-stage[data-state="2"] .fd-sst-demo-well::after{transform:scale(.86);opacity:1}
.fd-sst-demo-stage[data-state="2"] .fd-sst-demo-well[data-out]{box-shadow:inset 0 1px 2px rgba(0,0,0,.25),0 0 0 2px #F43F5E}
.fd-sst-demo-head{white-space:nowrap;display:flex;justify-content:space-between;gap:8px;margin:14px 2px 0;font:500 0.75rem/1.2 ui-monospace,"SF Mono",Menlo,monospace;color:#29403A}
.fd-sst-demo-live{color:#0E7C6F}

.fd-sst-demo-curve{flex-direction:column;gap:16px}
.fd-sst-demo-svg{display:block;width:100%;max-width:min(460px,64cqh * 1.38);height:auto;overflow:visible}
.fd-sst-demo-path{fill:none;stroke:#5EEAD4;stroke-width:2.5;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1100ms var(--fd-ease-in-out) 200ms}
.fd-sst-demo-curve[data-active] .fd-sst-demo-path{stroke-dashoffset:0}
.fd-sst-demo-pt{fill:#0B1412;stroke:#E8F2EF;stroke-width:2;opacity:0;transform-box:fill-box;transform-origin:center;transform:scale(0);
  transition:opacity var(--fd-dur-2) var(--fd-ease-out) var(--d),transform var(--fd-dur-3) var(--fd-spring) var(--d)}
.fd-sst-demo-curve[data-active] .fd-sst-demo-pt{opacity:1;transform:none}
.fd-sst-demo-ax{fill:rgba(232,242,239,.5);font:500 11px ui-monospace,"SF Mono",Menlo,monospace}
.fd-sst-demo-card{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 12px;padding:12px 16px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
.fd-sst-demo-card-k{font:500 0.75rem/1 ui-monospace,"SF Mono",Menlo,monospace;color:rgba(232,242,239,.6)}
.fd-sst-demo-card-v{font:650 1.375rem/1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.02em;color:#fff}
.fd-sst-demo-card-s{font:500 0.6875rem/1.2 ui-monospace,"SF Mono",Menlo,monospace;color:#86EFAC}
@media (max-width:760px){
  .fd-sst-demo-hero{padding-bottom:12px}
  .fd-sst-demo-layer{padding:6%}
  .fd-sst-demo-platebox{padding:10px}
  .fd-sst-demo-head{margin-top:8px;font-size:0.625rem}
  .fd-sst-demo-curve{gap:8px}
  .fd-sst-demo-card{padding:8px 12px}
  .fd-sst-demo-card-v{font-size:1.0625rem}
  .fd-sst-demo-winbar{padding:8px 12px}
}
@media (prefers-reduced-motion: reduce){
  .fd-sst-demo-layer{transform:none !important;filter:none !important}
  .fd-sst-demo-cue-line::after{animation:none}
}
`;
