/**
 * CountUpStats, a stat band whose numbers roll up like an odometer when they
 * scroll into view, each with a sparkline that draws on in sync.
 *
 * Components:
 * - <Odometer value decimals prefix suffix duration delay start />, each
 *   digit is a vertical reel; reels settle right-to-left with a little
 *   overshoot, like a mechanical counter. Separators (",", ".") are static.
 * - <StatBand stats />, lays out stats with label, delta and sparkline and
 *   triggers them once with an IntersectionObserver (35% visible).
 * Props on stat: { label, value, decimals?, prefix?, suffix?, delta?,
 *   lowerIsBetter? (colours a negative delta green), spark: number[] }.
 * CSS vars: --fd-cus-accent, --fd-cus-ink, --fd-cus-muted.
 *
 * Browser support: evergreen. Only transforms and stroke-dashoffset animate.
 * Accessibility: the final value is exposed as text (aria-label) from the
 * first render; reels are aria-hidden. Reduced motion shows final values and
 * fully drawn sparklines immediately.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

export interface OdometerProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  delay?: number;
  start?: boolean;
  locale?: string;
}

function format(v: number, decimals: number, locale: string) {
  return v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function Odometer({ value, decimals = 0, prefix = "", suffix = "", duration = 1600, delay = 0, start = true, locale = "en-US" }: OdometerProps) {
  const text = format(value, decimals, locale);
  const chars = useMemo(() => text.split(""), [text]);
  const digitCount = chars.filter((c) => /\d/.test(c)).length;
  let di = 0;
  return (
    <span className="fd-cus-odo" aria-label={`${prefix}${text}${suffix}`} role="text" data-go={start ? "" : undefined}>
      {prefix && (
        <span className="fd-cus-affix" aria-hidden="true">
          {prefix}
        </span>
      )}
      {chars.map((c, i) => {
        if (!/\d/.test(c))
          return (
            <span key={i} className="fd-cus-sep" aria-hidden="true">
              {c}
            </span>
          );
        const d = Number(c);
        const fromRight = digitCount - 1 - di++;
        // like a mechanical counter, the rightmost reels spin the most turns
        const turns = Math.min(3, fromRight === 0 ? 3 : fromRight === 1 ? 2 : 1);
        const steps = turns * 10 + d;
        const dur = duration * (0.62 + 0.38 * (1 - fromRight / Math.max(1, digitCount - 1)));
        return (
          <span key={i} className="fd-cus-reel" aria-hidden="true">
            <span
              className="fd-cus-strip"
              style={{
                ["--to" as string]: `${-steps}em`,
                ["--dur" as string]: `${Math.round(dur)}ms`,
                ["--dl" as string]: `${delay + fromRight * 40}ms`,
              }}
            >
              {Array.from({ length: steps + 1 }, (_, k) => (
                <span key={k} className="fd-cus-d">
                  {k % 10}
                </span>
              ))}
            </span>
            <span className="fd-cus-ghost">{c}</span>
          </span>
        );
      })}
      {suffix && (
        <span className="fd-cus-affix" aria-hidden="true">
          {suffix}
        </span>
      )}
    </span>
  );
}

export type Stat = { label: string; value: number; decimals?: number; prefix?: string; suffix?: string; delta?: string; lowerIsBetter?: boolean; spark: number[] };

export interface StatBandProps {
  stats: Stat[];
  className?: string;
  style?: CSSProperties;
}

function sparkPath(v: number[], w: number, h: number) {
  const min = Math.min(...v);
  const max = Math.max(...v);
  const pts = v.map((y, i) => [(i / (v.length - 1)) * w, h - 3 - ((y - min) / (max - min || 1)) * (h - 6)] as const);
  // Catmull-Rom → cubic Bézier for a smooth line
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return { d, end: pts[pts.length - 1] };
}

export function StatBand({ stats, className, style }: StatBandProps) {
  const root = useRef<HTMLDivElement>(null);
  const [go, setGo] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.reduced = "";
      setGo(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setGo(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={root} className={`fd-cus${className ? " " + className : ""}`} data-go={go ? "" : undefined} style={style}>
      <style>{css}</style>
      {stats.map((s, i) => {
        const { d, end } = sparkPath(s.spark, 160, 44);
        const good = !s.delta || s.delta.trim().startsWith("+") || !!s.lowerIsBetter;
        const up = !s.delta || !/^[−-]/.test(s.delta.trim());
        return (
          <div key={s.label} className="fd-cus-stat" style={{ ["--i" as string]: i }}>
            <p className="fd-cus-label">{s.label}</p>
            <p className="fd-cus-value">
              <Odometer value={s.value} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} start={go} delay={i * 140} />
            </p>
            <div className="fd-cus-row">
              {s.delta && (
                <span className="fd-cus-delta" data-good={good ? "" : undefined}>
                  <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
                    <path d={up ? "M5 1 L9 7 H1 Z" : "M5 9 L9 3 H1 Z"} fill="currentColor" />
                  </svg>
                  {s.delta}
                </span>
              )}
              <svg className="fd-cus-spark" viewBox="-2 -2 168 48" aria-hidden="true">
                <path className="fd-cus-spark-area" d={`${d} L160 44 L0 44 Z`} />
                <path className="fd-cus-spark-line" d={d} pathLength={1} />
                <circle className="fd-cus-spark-dot" cx={end[0]} cy={end[1]} r="3.5" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const css = `
.fd-cus{
  --fd-ease-out:cubic-bezier(0.22,1,0.36,1);--fd-spring:cubic-bezier(0.34,1.56,0.64,1);
  --fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-cus-accent:#2F6BFF;--fd-cus-ink:#0B0B0F;--fd-cus-muted:#6B6B76;--fd-cus-up:#0F9D58;--fd-cus-down:#D93025;
  --fd-cus-sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --fd-cus-display:"SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter Display","Inter","Segoe UI",Roboto,sans-serif;
  display:grid;grid-template-columns:var(--fd-cus-cols,repeat(auto-fit,minmax(240px,1fr)));gap:0;margin:0;padding:0;color:var(--fd-cus-ink);
}
.fd-cus,.fd-cus *,.fd-cus *::before,.fd-cus *::after{box-sizing:border-box}
.fd-cus-stat{display:flex;flex-direction:column;gap:10px;margin:0;padding:24px 28px;border-left:1px solid rgba(11,11,15,.1)}
.fd-cus-stat:first-child{border-left:0}
.fd-cus-label{margin:0;padding:0;color:var(--fd-cus-muted);font:500 0.8125rem/1.3 var(--fd-cus-sans);letter-spacing:0}
.fd-cus-value{margin:0;padding:0;color:var(--fd-cus-ink);font:600 clamp(2rem,3.4vw,3.25rem)/1 var(--fd-cus-display);letter-spacing:-0.035em;font-variant-numeric:tabular-nums;white-space:nowrap}
.fd-cus-odo{display:inline-flex;align-items:flex-end;white-space:nowrap}
.fd-cus-affix{display:inline-block;white-space:pre;margin:0 .02em;color:inherit;opacity:.5;font-size:.6em;line-height:1.5}
.fd-cus-sep{display:inline-block;color:inherit}
.fd-cus-reel{position:relative;display:inline-block;height:1em;overflow:hidden;line-height:1;
  -webkit-mask-image:linear-gradient(transparent,#000 14%,#000 86%,transparent);mask-image:linear-gradient(transparent,#000 14%,#000 86%,transparent)}
.fd-cus-ghost{visibility:hidden;display:inline-block}
.fd-cus-strip{position:absolute;left:0;top:0;display:flex;flex-direction:column;transform:translate3d(0,0,0);will-change:transform}
.fd-cus-d{display:block;height:1em;line-height:1;text-align:center}
.fd-cus-odo[data-go] .fd-cus-strip{transform:translate3d(0,var(--to),0);transition:transform var(--dur) cubic-bezier(0.16,1,0.3,1.03) var(--dl)}
.fd-cus-row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:4px 0 0}
.fd-cus-delta{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:9999px;flex:none;
  color:var(--fd-cus-down);background:color-mix(in srgb,var(--fd-cus-down) 10%,transparent);font:600 0.75rem/1 var(--fd-cus-sans)}
.fd-cus-delta[data-good]{color:var(--fd-cus-up);background:color-mix(in srgb,var(--fd-cus-up) 10%,transparent)}
.fd-cus-spark{display:block;width:min(160px,60%);height:auto;overflow:visible}
.fd-cus-spark-line{fill:none;stroke:var(--fd-cus-accent);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1}
.fd-cus-spark-area{fill:var(--fd-cus-accent);opacity:0}
.fd-cus-spark-dot{fill:var(--fd-cus-accent);stroke:#fff;stroke-width:2;transform-box:fill-box;transform-origin:center;transform:scale(0)}
.fd-cus[data-go] .fd-cus-spark-line{stroke-dashoffset:0;transition:stroke-dashoffset 1400ms cubic-bezier(0.65,0,0.35,1) calc(var(--i) * 140ms + 120ms)}
.fd-cus[data-go] .fd-cus-spark-area{opacity:.08;transition:opacity var(--fd-dur-4) var(--fd-ease-out) calc(var(--i) * 140ms + 900ms)}
.fd-cus[data-go] .fd-cus-spark-dot{transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring) calc(var(--i) * 140ms + 1450ms)}
.fd-cus-stat{opacity:0;transform:translate3d(0,14px,0)}
.fd-cus[data-go] .fd-cus-stat{opacity:1;transform:none;transition:opacity var(--fd-dur-4) var(--fd-ease-out) calc(var(--i) * 90ms),transform var(--fd-dur-4) var(--fd-ease-out) calc(var(--i) * 90ms)}
@media (max-width:640px){
  .fd-cus{grid-template-columns:1fr 1fr !important}
  .fd-cus-stat{padding:18px 14px;border-left:0;border-top:1px solid rgba(11,11,15,.1)}
  .fd-cus-stat:nth-child(2n){border-left:1px solid rgba(11,11,15,.1)}
  .fd-cus-stat:nth-child(-n+2){border-top:0}
  .fd-cus-value{font-size:1.875rem}
  .fd-cus-row{flex-direction:column;align-items:flex-start}
  .fd-cus-spark{width:100%}
}
.fd-cus[data-reduced] .fd-cus-strip,.fd-cus[data-reduced] .fd-cus-spark-line,.fd-cus[data-reduced] .fd-cus-spark-dot,
.fd-cus[data-reduced] .fd-cus-stat,.fd-cus[data-reduced] .fd-cus-spark-area{transition:none !important}
@media (prefers-reduced-motion: reduce){
  .fd-cus *{transition-duration:0ms !important;transition-delay:0ms !important}
}
`;

/* ------------------------------------------------------------------ Demo */

const STATS: Stat[] = [
  { label: "Shipments tracked this year", value: 48203117, delta: "+18.4% YoY", spark: [12, 14, 13, 17, 19, 18, 22, 24, 23, 27, 30, 33] },
  { label: "Freight value insured", value: 7.82, decimals: 2, prefix: "$", suffix: "B", delta: "+$1.1B", spark: [5.1, 5.4, 5.3, 5.9, 6.2, 6.1, 6.6, 6.9, 7.0, 7.3, 7.6, 7.82] },
  { label: "On-time delivery rate", value: 98.7, decimals: 1, suffix: "%", delta: "+2.3 pts", spark: [94.1, 94.8, 95.2, 95.0, 96.1, 96.4, 97.0, 97.2, 97.8, 98.1, 98.3, 98.7] },
  { label: "Avg. invoice settlement", value: 1.6, decimals: 1, suffix: " days", delta: "−4.2 days", lowerIsBetter: true, spark: [5.8, 5.2, 4.9, 4.1, 3.8, 3.2, 2.9, 2.4, 2.1, 1.9, 1.7, 1.6] },
];

export function Demo() {
  return (
    <div className="fd-cus-demo">
      <style>{demoCss}</style>
      <section className="fd-cus-demo-hero">
        <span className="fd-cus-demo-logo">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="6" fill="#2F6BFF" />
            <path d="M7 15 L 11 9 L 14 13 L 17 8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Cargora
        </span>
        <h1 className="fd-cus-demo-h">Freight payments that settle before the truck is unloaded.</h1>
        <p className="fd-cus-demo-cue" aria-hidden="true">
          <span className="fd-cus-demo-cue-line" />
          Scroll for the numbers
        </p>
      </section>
      <section className="fd-cus-demo-band">
        <div className="fd-cus-demo-band-head">
          <span className="fd-cus-demo-k">2026 network report</span>
          <span className="fd-cus-demo-asof">Updated 28 Oct 2026, 09:00 CET</span>
        </div>
        <div className="fd-cus-demo-card">
          <StatBand stats={STATS} />
        </div>
      </section>
      <section className="fd-cus-demo-after">
        <p className="fd-cus-demo-p">Trusted by 1,940 carriers and shippers across 31 countries.</p>
      </section>
    </div>
  );
}

const demoCss = `
.fd-cus-demo{display:block;margin:0;padding:0;background:#F4F5F8;color:#0B0B0F;min-height:100vh}
.fd-cus-demo,.fd-cus-demo *{box-sizing:border-box}
.fd-cus-demo-hero{display:flex;flex-direction:column;min-height:92vh;max-width:1200px;margin:0 auto;padding:28px clamp(16px,4vw,48px) 48px}
.fd-cus-demo-logo{display:inline-flex;align-items:center;gap:10px;color:#0B0B0F;font:700 1.0625rem/1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.02em}
.fd-cus-demo-h{margin:auto 0 0;padding:0;max-width:900px;color:#0B0B0F;font:600 clamp(2.25rem,5.6vw,4.5rem)/1.02 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.045em}
.fd-cus-demo-cue{display:inline-flex;align-items:center;gap:10px;margin:28px 0 0;padding:0;color:#6B6B76;font:500 0.75rem/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}
.fd-cus-demo-cue-line{position:relative;display:block;width:1px;height:28px;overflow:hidden;background:rgba(11,11,15,.15)}
.fd-cus-demo-cue-line::after{content:"";position:absolute;left:0;top:0;width:1px;height:12px;background:#0B0B0F;animation:fd-cus-cue 1.6s cubic-bezier(0.65,0,0.35,1) infinite}
@keyframes fd-cus-cue{0%{transform:translateY(-12px)}100%{transform:translateY(28px)}}
.fd-cus-demo-band{max-width:1200px;margin:0 auto;padding:24px clamp(16px,4vw,48px)}
.fd-cus-demo-band-head{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin:0 0 14px;padding:0 4px}
.fd-cus-demo-k{color:#0B0B0F;font:600 0.9375rem/1.2 ui-sans-serif,-apple-system,"Inter",sans-serif}
.fd-cus-demo-asof{color:#6B6B76;font:500 0.75rem/1.2 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace}
.fd-cus-demo-card{--fd-cus-cols:repeat(auto-fit,minmax(240px,1fr));margin:0;padding:12px 0;border-radius:24px;background:#fff;box-shadow:0 1px 0 rgba(11,11,15,.04),0 24px 48px -28px rgba(11,11,15,.18);border:1px solid rgba(11,11,15,.06)}
.fd-cus-demo-after{max-width:1200px;margin:0 auto;padding:56px clamp(16px,4vw,48px) 50vh}
.fd-cus-demo-p{margin:0;padding:0;color:#6B6B76;font:400 1.0625rem/1.5 ui-sans-serif,-apple-system,"Inter",sans-serif}
@media (min-width:1100px){.fd-cus-demo-card{--fd-cus-cols:1.42fr 1fr 1fr 1fr}}
@media (max-width:640px){.fd-cus-demo-card{padding:4px 0;border-radius:20px}}
@media (prefers-reduced-motion: reduce){.fd-cus-demo-cue-line::after{animation:none}}
`;
