/**
 * HeroTravelParallax — a boutique-hotel hero built from a layered SVG
 * landscape: sky, sun, five mountain ranges, drifting mist and a lake that
 * mirrors the ranges. Layers move at different depths with the pointer and on
 * scroll, and the scene shifts from golden hour to blue dusk as the section
 * scrolls away (the sun sets, stars appear in the reflection). A frosted
 * booking bar sits on top.
 *
 * Props: brand, title, lede, location, defaults for the booking fields
 * (checkIn, checkOut, guests), onSearch(values).
 * CSS vars: --fd-alp-ink, --fd-alp-glass, --fd-alp-accent.
 *
 * Browser support: all evergreen browsers; the booking bar uses
 * backdrop-filter and falls back to an opaque panel when unsupported or when
 * prefers-reduced-transparency is set.
 * Motion: pointer parallax on a spring (k=380, c=30), scroll-linked depth and
 * colour via rAF + getBoundingClientRect (transform/opacity only, paused off
 * screen). prefers-reduced-motion: static golden-hour composition.
 * Accessibility: the landscape is decorative (aria-hidden). The booking bar is
 * a real <form> with labelled inputs.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

export interface HeroTravelParallaxProps {
  brand?: string;
  kicker?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  location?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  onSearch?: (v: { location: string; checkIn: string; checkOut: string; guests: number }) => void;
}

// ranges from far to near: [color day, color dusk, path]
const RANGES: { day: string; dusk: string; d: string; depth: number }[] = [
  { day: "#c9a7a8", dusk: "#5d5f8a", depth: 0.08, d: "M0 330 L90 290 L170 312 L260 250 L330 280 L420 220 L520 268 L600 240 L700 284 L790 236 L880 270 L960 228 L1060 262 L1160 216 L1260 258 L1360 238 L1440 270 L1440 600 L0 600Z" },
  { day: "#a7848e", dusk: "#45486f", depth: 0.16, d: "M0 360 L120 300 L210 330 L300 262 L380 300 L470 240 L560 296 L650 270 L760 318 L860 254 L950 300 L1060 246 L1150 296 L1250 270 L1340 312 L1440 280 L1440 600 L0 600Z" },
  { day: "#7d6177", dusk: "#30345a", depth: 0.28, d: "M0 400 L80 360 L170 380 L260 318 L330 352 L420 300 L500 344 L610 290 L700 360 L820 330 L900 368 L1010 308 L1100 352 L1200 322 L1320 372 L1440 334 L1440 600 L0 600Z" },
  { day: "#4c3b52", dusk: "#1f2343", depth: 0.45, d: "M0 430 L110 380 L200 410 L310 352 L420 410 L530 372 L640 420 L760 380 L880 432 L980 394 L1080 430 L1210 370 L1320 414 L1440 388 L1440 600 L0 600Z" },
  { day: "#251c2e", dusk: "#11142a", depth: 0.7, d: "M0 470 C120 452 210 430 330 446 C460 462 540 420 660 432 C780 444 860 470 980 456 C1110 440 1220 420 1440 452 L1440 600 L0 600Z" },
];

const lerpHex = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
};

export function HeroTravelParallax({
  brand = "Halvøy",
  kicker = "Lofoten · 68°N · 22 rooms",
  title = (
    <>
      Where the fjord
      <br />
      <em>holds the light.</em>
    </>
  ),
  lede = "A timber-and-glass retreat on the water’s edge in Reine. Sauna on the jetty, kitchen by Ingrid Moe, and a sky that stays gold until midnight.",
  location = "Halvøy Reine, Lofoten",
  checkIn = "2027-06-18",
  checkOut = "2027-06-22",
  guests = 2,
  onSearch,
}: HeroTravelParallaxProps) {
  const root = useRef<HTMLElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const refl = useRef<HTMLDivElement>(null);
  const sky = useRef<HTMLDivElement>(null);
  const sun = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const stars = useRef<HTMLDivElement>(null);
  const mist = useRef<(HTMLDivElement | null)[]>([]);
  const fills = useRef<(SVGPathElement | null)[]>([]);
  const rfills = useRef<(SVGPathElement | null)[]>([]);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [vals, setVals] = useState({ location, checkIn, checkOut, guests });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sp = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      sp.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      sp.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const onLeave = () => {
      sp.tx = 0;
      sp.ty = 0;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let lastP = -1;
    let lastSig = "";
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      for (let i = 0; i < 2; i++) {
        const h = dt / 2;
        // softer spring for scenery (k=380, c=30 scaled by mass 4)
        sp.vx += ((-380 * (sp.x - sp.tx) - 30 * sp.vx) / 4) * h;
        sp.vy += ((-380 * (sp.y - sp.ty) - 30 * sp.vy) / 4) * h;
        sp.x += sp.vx * h;
        sp.y += sp.vy * h;
      }
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height * 0.8)));
      // idle: nothing moved since the last frame → skip all writes
      const sig = `${sp.x.toFixed(4)}|${sp.y.toFixed(4)}|${p.toFixed(4)}`;
      if (sig === lastSig) {
        if (visible && !document.hidden) raf = requestAnimationFrame(frame);
        return;
      }
      lastSig = sig;
      layers.current.forEach((g, i) => {
        if (!g) return;
        const d = RANGES[i].depth;
        g.style.transform = `translate3d(${(-sp.x * 60 * d).toFixed(2)}px, ${(-sp.y * 14 * d + p * 260 * d).toFixed(2)}px, 0)`;
      });
      if (refl.current) refl.current.style.transform = `translate3d(${(sp.x * 26).toFixed(2)}px, 0, 0)`;
      if (mist.current[1]) mist.current[1].style.transform = `translate3d(${(-sp.x * 70).toFixed(1)}px, ${(p * 60).toFixed(1)}px, 0)`;
      if (sun.current) sun.current.style.transform = `translate3d(${(-sp.x * 4).toFixed(2)}px, ${(p * 180 - sp.y * 3).toFixed(2)}px, 0)`;
      if (copy.current) {
        copy.current.style.transform = `translate3d(${(sp.x * -6).toFixed(2)}px, ${(p * -90).toFixed(1)}px, 0)`;
        copy.current.style.opacity = `${(1 - p * 1.4).toFixed(3)}`;
      }
      const tp = Math.round(p * 200) / 200;
      if (tp !== lastP) {
        lastP = tp;
        const dusk = Math.min(1, tp * 1.4);
        if (sky.current) sky.current.style.setProperty("--dusk", dusk.toFixed(3));
        fills.current.forEach((f, i) => f && f.setAttribute("fill", lerpHex(RANGES[i].day, RANGES[i].dusk, dusk)));
        rfills.current.forEach((f, i) => f && f.setAttribute("fill", lerpHex(RANGES[i].day, RANGES[i].dusk, dusk)));
        if (stars.current) stars.current.style.opacity = `${Math.max(0, dusk - 0.35) * 1.5}`;
      }
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
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch?.(vals);
    setSent(true);
    window.setTimeout(() => setSent(false), 1800);
  };

  const nights = Math.max(1, Math.round((Date.parse(vals.checkOut) - Date.parse(vals.checkIn)) / 864e5) || 1);

  return (
    <section ref={root} className="fd-alp" aria-label={`${brand} — hotel`}>
      <style>{css}</style>
      <div ref={sky} className="fd-alp-sky" aria-hidden="true" />
      <div className="fd-alp-scene" aria-hidden="true">
        <svg aria-hidden="true" className="fd-alp-defs" width="0" height="0" focusable="false">
          <defs>
            <radialGradient id={`${uid}-sun`}>
              <stop offset="0" stopColor="#fff7e0" />
              <stop offset="0.35" stopColor="#ffd59a" stopOpacity="0.9" />
              <stop offset="1" stopColor="#ff9f6e" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${uid}-water`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#0a0c1c" stopOpacity="0.85" />
            </linearGradient>
            <radialGradient id={`${uid}-mist`}>
              <stop offset="0" stopColor="#fff6ee" stopOpacity="0.62" />
              <stop offset="0.45" stopColor="#fff6ee" stopOpacity="0.28" />
              <stop offset="1" stopColor="#fff6ee" stopOpacity="0" />
            </radialGradient>
            <pattern id={`${uid}-ripple`} width="480" height="11" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="480" height="1" fill="#ffe8cc" opacity="0.10" />
              <rect x="0" y="5" width="480" height="1" fill="#ffe8cc" opacity="0.05" />
            </pattern>
            <clipPath id={`${uid}-below`}>
              <rect x="-400" y="500" width="2240" height="500" />
            </clipPath>
          </defs>
        </svg>
        <div ref={stars} className="fd-alp-layer fd-alp-static" style={{ opacity: 0 }}>
          <svg aria-hidden="true" focusable="false" viewBox="0 -150 1440 900" preserveAspectRatio="xMidYMax slice">
            {STARS.map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill="#fff" />
            ))}
          </svg>
        </div>
        <div ref={sun} className="fd-alp-layer">
          <svg aria-hidden="true" focusable="false" viewBox="0 -150 1440 900" preserveAspectRatio="xMidYMax slice" className="fd-alp-halo">
            <circle cx="980" cy="300" r="190" fill={`url(#${uid}-sun)`} />
          </svg>
          <svg aria-hidden="true" focusable="false" viewBox="0 -150 1440 900" preserveAspectRatio="xMidYMax slice">
            <circle cx="980" cy="300" r="44" fill="#fff4dc" />
          </svg>
        </div>
        {RANGES.map((r, i) => (
          <div key={i} ref={(n) => { layers.current[i] = n; }} className="fd-alp-layer">
            {i === 4 && (
              <div ref={(n) => { mist.current[0] = n; }} className="fd-alp-layer fd-alp-mistwrap">
                <svg aria-hidden="true" focusable="false" viewBox="0 -150 1440 900" preserveAspectRatio="xMidYMax slice" className="fd-alp-mist fd-alp-mist-a">
                  <ellipse cx="420" cy="420" rx="620" ry="46" fill={`url(#${uid}-mist)`} />
                </svg>
              </div>
            )}
            <svg aria-hidden="true" focusable="false" viewBox="0 -150 1440 900" preserveAspectRatio="xMidYMax slice">
              <path ref={(n) => { fills.current[i] = n; }} d={r.d} fill={r.day} />
              {i === 4 && (
                <g transform="translate(1010 404)">
                  {[0, 34, 70, 112].map((x, k) => (
                    <g key={k} transform={`translate(${x} ${k % 2 ? 6 : 0})`}>
                      <path d="M0 40 L0 14 L14 0 L28 14 L28 40Z" fill="#140f1c" />
                      <rect x="8" y="22" width="12" height="10" fill="#ffcf7d" />
                    </g>
                  ))}
                  <rect x="-30" y="40" width="200" height="3" fill="#140f1c" />
                </g>
              )}
            </svg>
          </div>
        ))}
        <div ref={(n) => { mist.current[1] = n; }} className="fd-alp-layer fd-alp-mistwrap">
          <svg aria-hidden="true" focusable="false" viewBox="0 -150 1440 900" preserveAspectRatio="xMidYMax slice" className="fd-alp-mist fd-alp-mist-b">
            <ellipse cx="900" cy="474" rx="760" ry="38" fill={`url(#${uid}-mist)`} opacity=".85" />
          </svg>
        </div>
        <div ref={refl} className="fd-alp-layer">
          <svg aria-hidden="true" focusable="false" viewBox="0 -150 1440 900" preserveAspectRatio="xMidYMax slice">
            <rect x="-400" y="500" width="2240" height="500" fill="#2a2440" />
            <g clipPath={`url(#${uid}-below)`} opacity="0.62">
              <g transform="translate(0 1000) scale(1 -1)">
                {RANGES.slice(1).map((r, i) => (
                  <path key={i} ref={(n) => { rfills.current[i + 1] = n; }} d={r.d} fill={r.day} />
                ))}
              </g>
              <ellipse cx="980" cy="700" rx="40" ry="140" fill="#ffe2b0" opacity=".55" />
            </g>
          </svg>
        </div>
        <div className="fd-alp-layer fd-alp-ripple">
          <svg aria-hidden="true" focusable="false" viewBox="0 -150 1440 900" preserveAspectRatio="xMidYMax slice">
            <rect x="-400" y="500" width="2240" height="400" fill={`url(#${uid}-ripple)`} />
          </svg>
        </div>
        <div className="fd-alp-layer fd-alp-static">
          <svg aria-hidden="true" focusable="false" viewBox="0 -150 1440 900" preserveAspectRatio="xMidYMax slice">
            <rect x="-400" y="500" width="2240" height="400" fill={`url(#${uid}-water)`} />
            <rect x="-400" y="499" width="2240" height="2" fill="#ffe8c4" opacity=".35" />
          </svg>
        </div>
      </div>
      <div className="fd-alp-vignette" aria-hidden="true" />

      <div ref={copy} className="fd-alp-copy">
        <p className="fd-alp-kicker">{kicker}</p>
        <h1 className="fd-alp-h1">{title}</h1>
        <p className="fd-alp-lede">{lede}</p>
      </div>

      <form className="fd-alp-book" onSubmit={submit} aria-label="Check availability">
        <label className="fd-alp-f fd-alp-f-loc">
          <span>Where</span>
          <input value={vals.location} onChange={(e) => setVals({ ...vals, location: e.target.value })} />
        </label>
        <label className="fd-alp-f">
          <span>Check in</span>
          <input type="date" value={vals.checkIn} onChange={(e) => setVals({ ...vals, checkIn: e.target.value })} />
        </label>
        <label className="fd-alp-f">
          <span>Check out</span>
          <input type="date" value={vals.checkOut} onChange={(e) => setVals({ ...vals, checkOut: e.target.value })} />
        </label>
        <div className="fd-alp-f fd-alp-f-g">
          <span id={`${uid}-g`}>Guests</span>
          <div className="fd-alp-step" role="group" aria-labelledby={`${uid}-g`}>
            <button type="button" aria-label="Fewer guests" onClick={() => setVals({ ...vals, guests: Math.max(1, vals.guests - 1) })}>−</button>
            <output aria-live="polite">{vals.guests}</output>
            <button type="button" aria-label="More guests" onClick={() => setVals({ ...vals, guests: Math.min(6, vals.guests + 1) })}>+</button>
          </div>
        </div>
        <button type="submit" className="fd-alp-go">
          <span>{sent ? "Searching…" : "Check availability"}</span>
          <small>
            {nights} {nights === 1 ? "night" : "nights"} · from €{(420 * nights).toLocaleString("en-US")}
          </small>
        </button>
      </form>
    </section>
  );
}

const STARS: [number, number, number][] = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 211.7) % 1440;
  const y = ((i * 97.3) % 260) + 20;
  return [Math.round(x), Math.round(y), i % 7 === 0 ? 1.6 : 0.9];
});

const css = `
.fd-alp, .fd-alp *, .fd-alp *::before, .fd-alp *::after { box-sizing: border-box; }
.fd-alp {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-alp-ink: #1c1426;
  --fd-alp-glass: rgba(255, 250, 244, 0.62);
  --fd-alp-accent: #1c1426;
  --fd-alp-serif: ui-serif, "New York", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --fd-alp-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  position: relative; display: block; overflow: hidden; margin: 0; padding: 0; height: 100vh; min-height: 760px; max-height: 1000px;
  background: #e8b9a0; color: #fff; font: 400 1rem/1.5 var(--fd-alp-sans); isolation: isolate;
}
.fd-alp-sky {
  --dusk: 0;
  position: absolute; inset: 0;
  background: linear-gradient(180deg, #f6c9a8 0%, #f0b49a 30%, #e9a395 52%, #c98d97 70%);
}
.fd-alp-sky::after {
  content: ""; position: absolute; inset: 0; opacity: var(--dusk);
  background: linear-gradient(180deg, #0d1230 0%, #2b2d5e 40%, #6a5a8a 62%, #a77b8c 72%);
}
.fd-alp-scene { position: absolute; inset: 0; overflow: hidden; animation: fd-alp-scenein 1800ms var(--fd-ease-out) both; }
.fd-alp-defs { position: absolute; width: 0; height: 0; overflow: hidden; display: block; }
.fd-alp-layer { position: absolute; inset: -40px -80px; will-change: transform; pointer-events: none; }
.fd-alp-layer > svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.fd-alp-mistwrap { inset: 0; will-change: auto; }
.fd-alp-static { will-change: auto; }
.fd-alp-mist { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.fd-alp-mist-a { animation: fd-alp-drift 38s var(--fd-ease-in-out) infinite alternate; }
.fd-alp-mist-b { animation: fd-alp-drift 52s var(--fd-ease-in-out) -20s infinite alternate-reverse; }
@keyframes fd-alp-drift { from { transform: translate3d(-8%, 0, 0); } to { transform: translate3d(10%, 0, 0); } }
.fd-alp-halo { animation: fd-alp-pulse 8s var(--fd-ease-in-out) infinite alternate; transform-origin: 68% 33%; }
.fd-alp-ripple { animation: fd-alp-ripple 9s var(--fd-ease-in-out) infinite alternate; }
@keyframes fd-alp-ripple { from { transform: translate3d(-30px, 0, 0); } to { transform: translate3d(30px, 0, 0); } }
.fd-alp-vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(120% 80% at 30% 20%, transparent 50%, rgba(20,12,30,0.35)); }

.fd-alp-copy { position: absolute; left: 0; right: 0; top: 0; margin: 0 auto; max-width: 1280px; padding: 15vh 56px 0; will-change: transform, opacity; }
.fd-alp-kicker {
  display: inline-flex; margin: 0 0 22px; padding: 0; color: rgba(36, 22, 40, 0.75);
  font: 600 0.75rem/1 var(--fd-alp-sans); letter-spacing: 0.22em; text-transform: uppercase;
  animation: fd-alp-rise var(--fd-dur-4) var(--fd-ease-out) 200ms both;
}
.fd-alp-h1 {
  margin: 0; padding: 0; max-width: 11ch; color: #24162a;
  font: 400 clamp(3rem, 6.6vw, 6rem)/0.94 var(--fd-alp-serif); letter-spacing: -0.035em; text-wrap: balance;
  animation: fd-alp-blur 1200ms var(--fd-ease-out) 260ms both;
}
.fd-alp-h1 em { font-style: italic; color: #fff8ee; text-shadow: 0 2px 30px rgba(120, 50, 40, 0.35); }
.fd-alp-lede {
  margin: 22px 0 0; padding: 0; max-width: 31rem; color: rgba(36, 22, 40, 0.86);
  font: 400 clamp(1rem, 1.2vw, 1.125rem)/1.55 var(--fd-alp-sans); letter-spacing: -0.01em; text-wrap: pretty;
  animation: fd-alp-rise var(--fd-dur-4) var(--fd-ease-out) 520ms both;
}

.fd-alp-book {
  position: absolute; left: 50%; bottom: 48px; z-index: 3; width: min(1080px, calc(100% - 48px)); margin: 0; padding: 10px;
  display: grid; grid-template-columns: 1.5fr 1fr 1fr 0.9fr auto; gap: 4px; align-items: stretch;
  border-radius: 28px; background: var(--fd-alp-glass); border: 1px solid rgba(255,255,255,0.55);
  -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4);
  box-shadow: 0 1px 0 rgba(255,255,255,0.7) inset, 0 30px 80px -30px rgba(20, 10, 40, 0.55);
  transform: translateX(-50%); animation: fd-alp-bar 1000ms var(--fd-ease-out) 700ms both;
}
.fd-alp-f { display: flex; flex-direction: column; justify-content: center; gap: 4px; margin: 0; padding: 10px 18px; border-radius: 18px; transition: background var(--fd-dur-1); min-width: 0; }
.fd-alp-f:hover, .fd-alp-f:focus-within { background: rgba(255,255,255,0.55); }
.fd-alp-f > span { display: block; margin: 0; font: 600 0.6875rem/1 var(--fd-alp-sans); letter-spacing: 0.08em; text-transform: uppercase; color: rgba(28,20,38,0.6); }
.fd-alp-f input {
  appearance: none; -webkit-appearance: none; display: block; width: 100%; margin: 0; padding: 0; border: 0; outline: 0; background: transparent;
  font: 500 1rem/1.3 var(--fd-alp-sans); letter-spacing: -0.01em; color: var(--fd-alp-ink); min-width: 0;
}
.fd-alp-f input::-webkit-calendar-picker-indicator { opacity: 0.5; }
.fd-alp-step { display: flex; align-items: center; gap: 12px; }
.fd-alp-step button {
  appearance: none; -webkit-appearance: none; display: grid; place-items: center; width: 26px; height: 26px; margin: 0; padding: 0; border-radius: 9999px; cursor: pointer;
  border: 1px solid rgba(28,20,38,0.2); background: rgba(255,255,255,0.6); color: var(--fd-alp-ink); font: 500 0.9375rem/1 var(--fd-alp-sans);
  transition: transform var(--fd-dur-2) var(--fd-spring);
}
.fd-alp-step button:active { transform: scale(0.9); transition-duration: var(--fd-dur-1); }
.fd-alp-step output { min-width: 1ch; font: 500 1rem/1 var(--fd-alp-sans); color: var(--fd-alp-ink); font-variant-numeric: tabular-nums; }
.fd-alp-go {
  appearance: none; -webkit-appearance: none; cursor: pointer; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 4px;
  margin: 0; padding: 0 26px; border: 0; border-radius: 20px; background: var(--fd-alp-accent); color: #fff7ee; text-align: left;
  box-shadow: 0 10px 30px -10px rgba(28,20,38,0.7); transition: transform var(--fd-dur-2) var(--fd-spring), background var(--fd-dur-1);
}
.fd-alp-go span { font: 600 0.9375rem/1.1 var(--fd-alp-sans); letter-spacing: -0.01em; white-space: nowrap; }
.fd-alp-go small { font: 400 0.75rem/1 var(--fd-alp-sans); color: rgba(255,247,238,0.7); white-space: nowrap; }
.fd-alp-go:hover { background: #33243f; }
.fd-alp-go:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-alp-go:focus-visible, .fd-alp-step button:focus-visible { outline: 2px solid rgba(28,20,38,0.7); outline-offset: 2px; }

@keyframes fd-alp-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes fd-alp-blur { from { opacity: 0; filter: blur(16px); transform: translateY(20px); } to { opacity: 1; filter: none; transform: none; } }
@keyframes fd-alp-bar { from { opacity: 0; transform: translate(-50%, 40px) scale(0.97); } to { opacity: 1; transform: translateX(-50%); } }
@keyframes fd-alp-scenein { from { opacity: 0; transform: scale(1.08) translateY(30px); } to { opacity: 1; transform: none; } }
@keyframes fd-alp-pulse { from { transform: scale(0.94); opacity: 0.85; } to { transform: scale(1.06); opacity: 1; } }

@media (max-width: 860px) {
  .fd-alp { min-height: 844px; height: auto; max-height: none; }
  .fd-alp-copy { position: relative; padding: 110px 20px 0; }
  .fd-alp-lede { font-size: 0.9375rem; margin-top: 18px; }
  .fd-alp-book { position: absolute; bottom: 16px; width: calc(100% - 32px); grid-template-columns: 1fr 1fr; padding: 8px; border-radius: 24px; }
  .fd-alp-f { padding: 9px 12px; }
  .fd-alp-f-loc, .fd-alp-go { grid-column: 1 / -1; }
  .fd-alp-go { min-height: 56px; flex-direction: row; justify-content: space-between; align-items: center; padding: 0 20px; border-radius: 16px; }
}
@media (prefers-reduced-motion: reduce) { .fd-alp *, .fd-alp *::before, .fd-alp-scene { animation: none !important; } }
@media (prefers-reduced-transparency: reduce) { .fd-alp-book { background: #fbf4ec; -webkit-backdrop-filter: none; backdrop-filter: none; } }
`;

/* ───────────────────────── Demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-alp-demo">
      <style>{demoCss}</style>
      <header className="fd-alp-demo-nav">
        <a className="fd-alp-demo-logo" href="#top">Halvøy</a>
        <nav aria-label="Primary">
          <a href="#rooms">Rooms</a>
          <a href="#sauna">Sauna &amp; sea</a>
          <a href="#kitchen">Kitchen</a>
          <a href="#journeys">Journeys</a>
        </nav>
        <a className="fd-alp-demo-cta" href="#reserve">Reserve</a>
      </header>
      <HeroTravelParallax />
      <section className="fd-alp-demo-after" aria-label="Rooms">
        <p>Twenty-two rooms, each facing the water.</p>
        <ul>
          <li><b>Fjord Room</b><span>28 m² · from €420</span></li>
          <li><b>Rorbu Cabin</b><span>46 m² · from €610</span></li>
          <li><b>Jetty Suite</b><span>72 m² · from €980</span></li>
        </ul>
      </section>
    </div>
  );
}

const demoCss = `
.fd-alp-demo { position: relative; margin: 0; padding: 0; min-height: 100vh; background: #1c1426; }
.fd-alp-demo *, .fd-alp-demo *::before, .fd-alp-demo *::after { box-sizing: border-box; }
.fd-alp-demo-nav {
  position: absolute; z-index: 10; top: 0; left: 0; right: 0; max-width: 1280px; height: 76px; margin: 0 auto; padding: 0 56px;
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  animation: fd-alp-demo-in 900ms cubic-bezier(0.22, 1, 0.36, 1) 300ms both;
}
.fd-alp-demo-logo { margin: 0; color: #24162a; text-decoration: none; font: italic 400 1.625rem/1 ui-serif, "New York", "Iowan Old Style", Georgia, serif; letter-spacing: -0.02em; }
.fd-alp-demo-nav nav { display: flex; gap: 32px; }
.fd-alp-demo-nav nav a { color: rgba(36,22,42,0.85); text-decoration: none; font: 500 0.875rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; letter-spacing: -0.005em; }
.fd-alp-demo-cta { display: inline-flex; align-items: center; height: 38px; padding: 0 18px; border-radius: 9999px; color: #24162a; text-decoration: none; font: 600 0.875rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; background: rgba(255,250,244,0.6); border: 1px solid rgba(255,255,255,0.6); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
.fd-alp-demo-nav a:focus-visible { outline: 2px solid rgba(28,20,38,.7); outline-offset: 2px; border-radius: 8px; }
.fd-alp-demo-after { margin: 0; padding: 96px 24px 140px; background: #11142a; color: #EDE7F2; text-align: center; }
.fd-alp-demo-after p { margin: 0 auto; padding: 0; max-width: 20ch; font: 400 clamp(1.75rem, 3.4vw, 2.75rem)/1.1 ui-serif, "New York", "Iowan Old Style", Georgia, serif; letter-spacing: -0.02em; text-wrap: balance; }
.fd-alp-demo-after ul { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin: 40px auto 0; padding: 0; list-style: none; }
.fd-alp-demo-after li { display: flex; flex-direction: column; gap: 6px; min-width: 200px; margin: 0; padding: 20px 24px; border-radius: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); text-align: left; }
.fd-alp-demo-after b { font: 600 1rem/1.2 ui-sans-serif, -apple-system, "Inter", sans-serif; color: #fff; }
.fd-alp-demo-after span { font: 400 0.875rem/1.2 ui-sans-serif, -apple-system, "Inter", sans-serif; color: rgba(237,231,242,0.6); }
@keyframes fd-alp-demo-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
@media (max-width: 860px) { .fd-alp-demo-nav { padding: 0 20px; height: 64px; } .fd-alp-demo-nav nav { display: none; } }
@media (prefers-reduced-motion: reduce) { .fd-alp-demo-nav { animation: none; } }
`;
