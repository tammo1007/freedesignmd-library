/**
 * HeroAutoScrub — Apple-style scrollytelling for an electric car. The section
 * is 300vh tall with a sticky 100vh stage. As you scroll, a stylised SVG car
 * drives through a tunnel of light rings: the rings rush past, the wheels
 * spin with the scroll velocity, head- and tail-lights bloom, and three specs
 * (0–100 km/h, range, charge) take the stage one after another with
 * counting numbers. The first viewport is a complete composed hero.
 *
 * Props: model, tagline, specs ({ value, unit, label, decimals? }[]), price,
 * primaryCta, secondaryCta. CSS vars: --fd-evx-bg, --fd-evx-accent.
 *
 * Browser support: all evergreen browsers (position: sticky, SVG).
 * Motion: one rAF loop reads getBoundingClientRect, eases the scroll progress
 * (critically damped) and writes transforms/opacity only; it idles when the
 * section is off-screen or the tab is hidden. Wheel spin and ring rush derive
 * from the progress velocity. prefers-reduced-motion collapses the scene to
 * a single static frame with all specs listed.
 * Accessibility: specs are a <dl> in DOM order; decorative SVG is aria-hidden.
 */
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

export type EvSpec = { value: number; unit: string; label: string; decimals?: number; prefix?: string };

export interface HeroAutoScrubProps {
  model?: string;
  tagline?: ReactNode;
  specs?: EvSpec[];
  price?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

const DEFAULT_SPECS: EvSpec[] = [
  { value: 3.4, unit: "s", label: "0–100 km/h with launch control", decimals: 1 },
  { value: 712, unit: "km", label: "WLTP range on a single charge" },
  { value: 18, unit: "min", label: "10–80% on a 350 kW charger" },
];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const bump = (p: number, a: number, b: number, c: number, d: number) => Math.min(ease(seg(p, a, b)), 1 - ease(seg(p, c, d)));

const RINGS = 9;

export function HeroAutoScrub({
  model = "Aurel GT",
  tagline = (
    <>
      Quiet, until it <em>isn’t.</em>
    </>
  ),
  specs = DEFAULT_SPECS,
  price = "From €89,900 · deliveries spring 2027",
  primaryCta = { label: "Reserve with €500", href: "#reserve" },
  secondaryCta = { label: "Book a test drive", href: "#drive" },
}: HeroAutoScrubProps) {
  const root = useRef<HTMLElement>(null);
  const car = useRef<HTMLDivElement>(null);
  const wheels = useRef<(SVGGElement | null)[]>([]);
  const rings = useRef<(HTMLDivElement | null)[]>([]);
  const intro = useRef<HTMLDivElement>(null);
  const specEls = useRef<(HTMLDivElement | null)[]>([]);
  const nums = useRef<(HTMLElement | null)[]>([]);
  const lights = useRef<HTMLDivElement>(null);
  const road = useRef<HTMLDivElement>(null);
  const outro = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.setAttribute("data-static", "");
      nums.current.forEach((n, i) => n && (n.textContent = specs[i].value.toFixed(specs[i].decimals ?? 0)));
      return;
    }
    let p = 0;
    let v = 0;
    let wheel = 0;
    let raf = 0;
    let visible = true;
    let last = performance.now();
    const t0 = last;
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const r = el.getBoundingClientRect();
      const stage = el.firstElementChild as HTMLElement | null;
      const travel = Math.max(1, r.height - (stage?.offsetHeight ?? window.innerHeight));
      const target = clamp(-r.top / travel);
      // critically-damped follow so trackpad steps feel continuous
      const k = 90;
      const c = 2 * Math.sqrt(k);
      const a = k * (target - p) - c * v;
      v += a * dt;
      p += v * dt;
      const t = (now - t0) / 1000;
      const speed = Math.abs(v);
      wheel += (0.25 + speed * 40) * dt * 360;
      wheels.current.forEach((w) => w && w.setAttribute("transform", `rotate(${(wheel % 360).toFixed(1)})`));

      // car: enters from left on load, then drives into centre and grows as it approaches
      const drive = ease(seg(p, 0.0, 0.9));
      const bob = Math.sin(t * 9) * (0.4 + speed * 6);
      if (car.current) {
        const x = -4 + drive * 4;
        const sc = 1 + ease(seg(p, 0.7, 1)) * 0.18;
        car.current.style.transform = `translate3d(${x.toFixed(2)}vw, ${(bob - ease(seg(p, 0.75, 1)) * 40).toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
      }
      // rings rush past; speed blooms
      for (let i = 0; i < RINGS; i++) {
        const ring = rings.current[i];
        if (!ring) continue;
        const z = ((i / RINGS + p * 2.4 + t * 0.012) % 1);
        const s = 0.2 + Math.pow(z, 2.2) * 3.2;
        const o = Math.min(1, z * 3) * (1 - Math.pow(z, 6)) * (0.35 + Math.min(0.65, speed * 8) + seg(p, 0.05, 0.3) * 0.25);
        ring.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
        ring.style.opacity = o.toFixed(3);
      }
      if (lights.current) lights.current.style.opacity = (0.55 + seg(p, 0.05, 0.25) * 0.45 + Math.min(0.3, speed * 3)).toFixed(3);
      if (road.current) road.current.style.backgroundPositionX = `${(-p * 5200 - t * 20).toFixed(1)}px`;
      if (intro.current) {
        const q = seg(p, 0.02, 0.16);
        intro.current.style.opacity = (1 - q).toFixed(3);
        intro.current.style.transform = `translate3d(0, ${(-q * 60).toFixed(1)}px, 0) scale(${(1 - q * 0.05).toFixed(4)})`;
      }
      const windows: [number, number, number, number][] = [
        [0.14, 0.22, 0.34, 0.4],
        [0.38, 0.46, 0.58, 0.64],
        [0.62, 0.7, 0.82, 0.88],
      ];
      specEls.current.forEach((s, i) => {
        if (!s) return;
        const w = windows[i] ?? windows[2];
        const o = bump(p, w[0], w[1], w[2], w[3]);
        s.style.opacity = o.toFixed(3);
        s.style.transform = `translate3d(0, ${((1 - o) * (p < w[1] ? 40 : -40)).toFixed(1)}px, 0)`;
        const n = nums.current[i];
        if (n) {
          const cnt = ease(seg(p, w[0], w[1] + 0.04));
          n.textContent = (specs[i].value * cnt).toFixed(specs[i].decimals ?? 0);
        }
      });
      if (outro.current) {
        const o = ease(seg(p, 0.86, 0.96));
        outro.current.style.opacity = o.toFixed(3);
        outro.current.style.transform = `translate3d(0, ${((1 - o) * 30).toFixed(1)}px, 0)`;
        outro.current.style.pointerEvents = o > 0.5 ? "auto" : "none";
      }
      if (hint.current) hint.current.style.opacity = (1 - seg(p, 0.01, 0.06)).toFixed(3);
      if (bar.current) bar.current.style.transform = `scaleX(${p.toFixed(4)})`;
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", start);
    };
  }, [specs]);

  return (
    <section ref={root} className="fd-evx" aria-label={model}>
      <style>{css}</style>
      <div className="fd-evx-stage">
        <div className="fd-evx-tunnel" aria-hidden="true">
          {Array.from({ length: RINGS }, (_, i) => (
            <div key={i} ref={(n) => { rings.current[i] = n; }} className="fd-evx-ring" />
          ))}
          <div className="fd-evx-floorglow" />
        </div>
        <div ref={road} className="fd-evx-road" aria-hidden="true" />

        <div ref={intro} className="fd-evx-intro">
          <p className="fd-evx-model">{model}</p>
          <h1 className="fd-evx-h1">{tagline}</h1>
          <p className="fd-evx-price">{price}</p>
        </div>

        <dl className="fd-evx-specs">
          {specs.map((s, i) => (
            <div key={s.label} ref={(n) => { specEls.current[i] = n; }} className="fd-evx-spec">
              <dd>
                {s.prefix}
                <span ref={(n) => { nums.current[i] = n; }}>0</span>
                <small>{s.unit}</small>
              </dd>
              <dt>{s.label}</dt>
            </div>
          ))}
        </dl>

        <div ref={car} className="fd-evx-car" aria-hidden="true">
          <div ref={lights} className="fd-evx-lights">
            <i className="fd-evx-beam" />
            <i className="fd-evx-tail" />
          </div>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 900 300" className="fd-evx-svg">
            <defs>
              <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#5b6170" />
                <stop offset="0.28" stopColor="#2a2e38" />
                <stop offset="0.55" stopColor="#0f1116" />
                <stop offset="1" stopColor="#050608" />
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#0b0d12" />
                <stop offset="0.45" stopColor="#2b3446" />
                <stop offset="0.55" stopColor="#5d6b8a" />
                <stop offset="1" stopColor="#0b0d12" />
              </linearGradient>
              <linearGradient id={`${uid}-hl`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <radialGradient id={`${uid}-rim`}>
                <stop offset="0.55" stopColor="#1a1d24" />
                <stop offset="0.8" stopColor="#3a3f4c" />
                <stop offset="1" stopColor="#0b0c10" />
              </radialGradient>
            </defs>
            <ellipse cx="450" cy="262" rx="400" ry="16" fill="#000" opacity="0.7" />
            {/* body */}
            <path
              d="M70 214 C66 190 78 172 110 164 L250 140 C300 104 360 78 450 72 C540 68 610 84 660 118 L720 150 C790 158 832 170 842 196 L846 214 C846 226 838 232 824 232 L770 232 C766 196 740 172 704 172 C668 172 642 196 638 232 L278 232 C274 196 248 172 212 172 C176 172 150 196 146 232 L92 232 C78 232 70 226 70 214Z"
              fill={`url(#${uid}-body)`}
            />
            {/* greenhouse */}
            <path d="M270 142 C318 106 372 88 450 84 C528 82 590 96 636 126 L652 140 C600 142 380 146 270 142Z" fill={`url(#${uid}-glass)`} />
            <path d="M458 86 L462 142" stroke="#08090c" strokeWidth="5" />
            {/* shoulder highlight */}
            <path d="M120 170 C300 150 600 150 820 176" stroke={`url(#${uid}-hl)`} strokeWidth="2" fill="none" />
            <path d="M260 146 C380 150 560 150 660 144" stroke="#9aa6c0" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
            {/* door line + handle */}
            <path d="M470 150 L476 226" stroke="#000" strokeOpacity="0.55" strokeWidth="1.5" />
            <rect x="500" y="166" width="44" height="4" rx="2" fill="#9aa6c0" opacity="0.5" />
            {/* light bars */}
            <path d="M800 170 C820 172 836 178 842 190 L800 186Z" fill="#e8f2ff" className="fd-evx-head" />
            <path d="M74 192 C76 180 88 172 104 170 L104 184Z" fill="#ff2e3a" className="fd-evx-tl" />
            {/* wheels */}
            {[212, 704].map((cx, i) => (
              <g key={cx} transform={`translate(${cx} 232)`}>
                <circle r="58" fill="#050506" />
                <circle r="46" fill={`url(#${uid}-rim)`} />
                <g ref={(n) => { wheels.current[i] = n; }}>
                  {Array.from({ length: 10 }, (_, k) => (
                    <path key={k} d="M0 -10 L5 -42 L-5 -42Z" fill="#6e7586" transform={`rotate(${k * 36})`} />
                  ))}
                </g>
                <circle r="10" fill="#2a2e38" stroke="#7d8597" strokeWidth="1" />
              </g>
            ))}
          </svg>
        </div>

        <div ref={outro} className="fd-evx-outro">
          <a className="fd-evx-btn" href={primaryCta.href}>
            {primaryCta.label}
          </a>
          <a className="fd-evx-link" href={secondaryCta.href}>
            {secondaryCta.label}
          </a>
        </div>

        <div className="fd-evx-progress" aria-hidden="true">
          <span ref={bar} />
        </div>
        <p ref={hint} className="fd-evx-hint" aria-hidden="true">
          Scroll to drive
          <svg aria-hidden="true" focusable="false" viewBox="0 0 12 18" width="12" height="18"><rect x="1" y="1" width="10" height="16" rx="5" fill="none" stroke="currentColor" /><rect x="5.2" y="4" width="1.6" height="3.4" rx=".8" fill="currentColor" className="fd-evx-wheel" /></svg>
        </p>
      </div>
    </section>
  );
}

const css = `
.fd-evx, .fd-evx *, .fd-evx *::before, .fd-evx *::after { box-sizing: border-box; }
.fd-evx {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-evx-bg: #000;
  --fd-evx-accent: #D7E6FF;
  --fd-evx-sans: "SF Pro Display", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  position: relative; display: block; margin: 0; padding: 0; height: 300vh; min-height: 2400px;
  background: var(--fd-evx-bg); color: #F5F5F7; font: 400 1rem/1.5 var(--fd-evx-sans);
}
.fd-evx-stage { position: sticky; top: 0; height: 100vh; min-height: 700px; overflow: hidden; isolation: isolate; }
.fd-evx-tunnel { position: absolute; inset: 0; pointer-events: none; }
.fd-evx-ring {
  position: absolute; left: 50%; top: 58%; width: 60vmax; height: 34vmax; border-radius: 48% / 52%;
  border: 1.5px solid rgba(190, 215, 255, 0.55);
  box-shadow: 0 0 24px rgba(160, 200, 255, 0.35), inset 0 0 24px rgba(160, 200, 255, 0.2);
  transform: translate(-50%, -50%) scale(0.5); opacity: 0; will-change: transform, opacity;
}
.fd-evx-floorglow { position: absolute; left: 0; right: 0; bottom: 0; height: 46%; background: radial-gradient(60% 70% at 50% 100%, rgba(120, 160, 255, 0.18), transparent 70%); }
.fd-evx-road {
  position: absolute; left: 0; right: 0; top: calc(58% + 9vw); height: 2px;
  background-image: linear-gradient(90deg, rgba(255,255,255,0.45) 0 60px, transparent 60px 140px); background-size: 140px 2px;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent); mask-image: linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent);
  opacity: 0.35;
}
.fd-evx-intro { position: absolute; left: 0; right: 0; top: 13vh; text-align: center; padding: 0 24px; will-change: transform, opacity; }
.fd-evx-model { margin: 0; padding: 0; font: 600 clamp(1.0625rem, 1.6vw, 1.5rem)/1 var(--fd-evx-sans); letter-spacing: -0.01em; color: #86868B; animation: fd-evx-rise 900ms var(--fd-ease-out) 100ms both; }
.fd-evx-h1 {
  margin: 14px 0 0; padding: 0; color: #F5F5F7;
  font: 600 clamp(3rem, 7.4vw, 7rem)/0.96 var(--fd-evx-sans); letter-spacing: -0.05em; text-wrap: balance;
  animation: fd-evx-blur 1200ms var(--fd-ease-out) 200ms both;
}
.fd-evx-h1 em { font-style: normal; background: linear-gradient(90deg, #9ec5ff, #ffffff 50%, #ffb4a8); -webkit-background-clip: text; background-clip: text; color: transparent; }
.fd-evx-price { margin: 22px 0 0; padding: 0; font: 400 clamp(1rem, 1.2vw, 1.1875rem)/1.4 var(--fd-evx-sans); color: #A1A1A6; letter-spacing: -0.01em; animation: fd-evx-rise 900ms var(--fd-ease-out) 500ms both; }

.fd-evx-car { position: absolute; left: 50%; top: 58%; width: min(980px, 84vw); margin: 0; transform-origin: 50% 80%; will-change: transform; translate: -50% -50%; animation: fd-evx-carin 1600ms var(--fd-ease-out) 300ms both; }
.fd-evx-svg { display: block; width: 100%; height: auto; overflow: visible; }
.fd-evx-lights { position: absolute; inset: 0; pointer-events: none; opacity: 0.6; }
.fd-evx-beam { position: absolute; display: block; left: 92%; top: 49%; width: 70%; height: 30%; background: radial-gradient(50% 50% at 0% 50%, rgba(220,235,255,0.55), transparent 70%); filter: blur(10px); transform-origin: left; }
.fd-evx-tail { position: absolute; display: block; right: 90%; top: 52%; width: 22%; height: 18%; background: radial-gradient(50% 50% at 100% 50%, rgba(255,40,60,0.6), transparent 70%); filter: blur(8px); }
.fd-evx-head { filter: drop-shadow(0 0 6px #cfe2ff); }
.fd-evx-tl { filter: drop-shadow(0 0 6px #ff2e3a); }

.fd-evx-specs { position: absolute; left: 0; right: 0; top: 12vh; margin: 0; padding: 0 24px; text-align: center; }
.fd-evx-spec { position: absolute; left: 0; right: 0; margin: 0; opacity: 0; will-change: transform, opacity; }
.fd-evx-spec dd { display: flex; justify-content: center; align-items: baseline; gap: 10px; margin: 0; padding: 0; font: 600 clamp(4rem, 11vw, 10rem)/0.9 var(--fd-evx-sans); letter-spacing: -0.06em; color: #F5F5F7; font-variant-numeric: tabular-nums; }
.fd-evx-spec dd small { font: 600 clamp(1.5rem, 3vw, 2.75rem)/1 var(--fd-evx-sans); letter-spacing: -0.03em; color: #86868B; }
.fd-evx-spec dt { margin: 14px 0 0; padding: 0; font: 500 clamp(1rem, 1.3vw, 1.25rem)/1.3 var(--fd-evx-sans); color: #A1A1A6; letter-spacing: -0.01em; }

.fd-evx-outro { position: absolute; left: 0; right: 0; bottom: 12vh; display: flex; justify-content: center; align-items: center; gap: 28px; opacity: 0; pointer-events: none; }
.fd-evx-btn { display: inline-flex; align-items: center; margin: 0; height: 50px; padding: 0 26px; border-radius: 9999px; background: #F5F5F7; color: #000; text-decoration: none; font: 500 1.0625rem/1 var(--fd-evx-sans); letter-spacing: -0.01em; transition: transform var(--fd-dur-2) var(--fd-spring); }
.fd-evx-btn:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-evx-link { margin: 0; padding: 0; color: #2997FF; text-decoration: none; font: 400 1.0625rem/1 var(--fd-evx-sans); }
.fd-evx-link::after { content: " ›"; }
.fd-evx-link:hover { text-decoration: underline; }
.fd-evx-btn:focus-visible, .fd-evx-link:focus-visible { outline: 2px solid rgba(41,151,255,0.7); outline-offset: 3px; }
.fd-evx-progress { position: absolute; left: 50%; bottom: 36px; width: 120px; height: 2px; margin-left: -60px; border-radius: 9999px; background: rgba(255,255,255,0.14); overflow: hidden; }
.fd-evx-progress span { position: absolute; inset: 0; background: #F5F5F7; transform-origin: left; transform: scaleX(0); }
.fd-evx-hint { position: absolute; will-change: opacity; left: 0; right: 0; bottom: 52px; display: flex; justify-content: center; align-items: center; gap: 10px; margin: 0; padding: 0; color: #86868B; font: 500 0.8125rem/1 var(--fd-evx-sans); animation: fd-evx-rise 900ms var(--fd-ease-out) 1400ms both; }
.fd-evx-hint svg { display: block; }
.fd-evx-wheel { animation: fd-evx-scrollwheel 1800ms var(--fd-ease-in-out) infinite; }

@keyframes fd-evx-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes fd-evx-blur { from { opacity: 0; filter: blur(16px); transform: scale(0.97); } to { opacity: 1; filter: none; transform: none; } }
@keyframes fd-evx-carin { from { opacity: 0; translate: -70% -50%; filter: blur(8px) brightness(0.3); } to { opacity: 1; translate: -50% -50%; filter: none; } }
@keyframes fd-evx-scrollwheel { 0% { transform: translateY(0); opacity: 1; } 70% { transform: translateY(5px); opacity: 0; } 100% { transform: translateY(0); opacity: 0; } }

@media (max-width: 760px) {
  .fd-evx-car { width: 104vw; top: 60%; }
  .fd-evx-intro { top: 15vh; }
  .fd-evx-specs { top: 16vh; }
  .fd-evx-ring { width: 120vw; height: 70vw; top: 60%; }
  .fd-evx-outro { flex-direction: column; gap: 18px; bottom: 14vh; }
  .fd-evx-hint { bottom: 50px; }
}

.fd-evx[data-static] { height: auto; min-height: 0; }
.fd-evx[data-static] .fd-evx-stage { position: relative; height: auto; min-height: 100vh; padding: 0 0 80px; }
.fd-evx[data-static] .fd-evx-intro { position: relative; top: auto; padding-top: 14vh; }
.fd-evx[data-static] .fd-evx-car { position: relative; left: auto; top: auto; translate: none; margin: 40px auto 0; }
.fd-evx[data-static] .fd-evx-specs { position: relative; top: auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 32px; max-width: 1000px; margin: 40px auto 0; }
.fd-evx[data-static] .fd-evx-spec { position: relative; opacity: 1; }
.fd-evx[data-static] .fd-evx-spec dd { font-size: 3.5rem; }
.fd-evx[data-static] .fd-evx-outro { position: relative; bottom: auto; opacity: 1; pointer-events: auto; margin-top: 48px; }
.fd-evx[data-static] .fd-evx-ring, .fd-evx[data-static] .fd-evx-progress, .fd-evx[data-static] .fd-evx-hint { display: none; }
@media (prefers-reduced-motion: reduce) { .fd-evx *, .fd-evx *::before { animation: none !important; } }
`;

/* ───────────────────────── Demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-evx-demo">
      <style>{demoCss}</style>
      <header className="fd-evx-demo-nav">
        <a className="fd-evx-demo-logo" href="#top">AUREL</a>
        <nav aria-label="Models">
          <a href="#gt" aria-current="page">GT</a>
          <a href="#tourer">Tourer</a>
          <a href="#x">X</a>
          <a href="#charging">Charging</a>
        </nav>
        <a className="fd-evx-demo-cta" href="#configure">Configure</a>
      </header>
      <HeroAutoScrub />
      <section className="fd-evx-demo-after" aria-label="Next">
        <p>Designed in Gothenburg. Built in Graz. Charged anywhere.</p>
      </section>
    </div>
  );
}

const demoCss = `
.fd-evx-demo { position: relative; margin: 0; padding: 0; min-height: 100vh; background: #000; }
.fd-evx-demo *, .fd-evx-demo *::before, .fd-evx-demo *::after { box-sizing: border-box; }
.fd-evx-demo-nav { position: fixed; z-index: 20; top: 0; left: 0; right: 0; height: 52px; margin: 0; padding: 0 max(24px, calc(50% - 560px)); display: flex; align-items: center; justify-content: space-between; gap: 20px; background: rgba(0,0,0,0.72); -webkit-backdrop-filter: saturate(1.8) blur(20px); backdrop-filter: saturate(1.8) blur(20px); border-bottom: 1px solid rgba(255,255,255,0.08); }
.fd-evx-demo-logo { margin: 0; color: #F5F5F7; text-decoration: none; font: 600 0.9375rem/1 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", sans-serif; letter-spacing: 0.42em; }
.fd-evx-demo-nav nav { display: flex; gap: 28px; }
.fd-evx-demo-nav nav a { color: #A1A1A6; text-decoration: none; font: 400 0.8125rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; transition: color 120ms; }
.fd-evx-demo-nav nav a[aria-current] { color: #F5F5F7; }
.fd-evx-demo-cta { display: inline-flex; align-items: center; height: 28px; padding: 0 14px; border-radius: 9999px; background: #0071E3; color: #fff; text-decoration: none; font: 400 0.8125rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; }
.fd-evx-demo-nav a:focus-visible { outline: 2px solid rgba(41,151,255,.7); outline-offset: 2px; border-radius: 6px; }
.fd-evx-demo-after { margin: 0; padding: 120px 24px 160px; text-align: center; background: #000; }
.fd-evx-demo-after p { margin: 0; padding: 0; color: #86868B; font: 600 clamp(1.5rem, 3vw, 2.5rem)/1.15 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", sans-serif; letter-spacing: -0.03em; text-wrap: balance; }
@media (max-width: 760px) { .fd-evx-demo-nav nav { display: none; } }
`;
