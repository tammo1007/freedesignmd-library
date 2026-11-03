/**
 * HeroClimateData, a dark climate/energy hero. A canvas globe made of dotted
 * land (procedural continents, no map data) spins slowly; glowing arcs carry
 * energy between grid nodes, and live counters (MW dispatched, tCO₂ avoided,
 * sites online) tick in real time. Drag or move the pointer to tilt the
 * globe; on scroll the globe rises and scales while the copy parallaxes away.
 *
 * Props: title, lede, primaryCta, secondaryCta, metrics
 * ({ label, base, perSecond, unit, decimals }[]), nodes ([lat, lon][]).
 * CSS vars: --fd-grd-bg, --fd-grd-accent, --fd-grd-accent-2.
 *
 * Browser support: all evergreen browsers (2D canvas). DPR capped at 2.
 * Motion: single rAF loop, paused off-screen (IntersectionObserver) and in
 * hidden tabs; pointer tilt on a spring (k=380, c=30, mass 4); scroll via
 * getBoundingClientRect (transform/opacity). prefers-reduced-motion renders
 * one static frame and frozen counters.
 * Accessibility: canvas is aria-hidden; metrics are a <dl> whose values are
 * updated at most every 500 ms and are not announced (aria-live off).
 */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export type GridMetric = { label: string; base: number; perSecond: number; unit: string; decimals?: number };

export interface HeroClimateDataProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  metrics?: GridMetric[];
  nodes?: [number, number][];
}

const DEFAULT_METRICS: GridMetric[] = [
  { label: "Clean power dispatched now", base: 18432.6, perSecond: 3.7, unit: "MW", decimals: 1 },
  { label: "CO₂ avoided this year", base: 2841907, perSecond: 41, unit: "tCO₂" },
  { label: "Batteries & farms online", base: 3214, perSecond: 0.02, unit: "sites" },
];

// [lat, lon], wind farms, solar parks and storage sites (fictional)
const DEFAULT_NODES: [number, number][] = [
  [55.7, 8.1], [52.4, 4.9], [40.4, -3.7], [37.4, -122], [34, -117.5], [31.5, -100], [41.9, -87.6], [-23.5, -46.6],
  [-33.9, 151.2], [-31.9, 115.9], [35.7, 139.7], [1.35, 103.8], [25.2, 55.3], [19, 72.8], [-26.2, 28], [64.1, -21.9], [59.3, 18], [45.5, -73.6],
];

const ARCS: [number, number][] = [
  [0, 1], [1, 2], [2, 15], [3, 4], [4, 5], [5, 6], [6, 17], [17, 15], [7, 14], [8, 9], [10, 11], [11, 13], [12, 13], [12, 2], [16, 0], [9, 11], [14, 12], [3, 10],
];

// tiny deterministic value-noise for continents
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// rough continental blobs (lat, lon, radius°) so the land reads as Earth-like
const BLOBS: [number, number, number][] = [
  [50, 10, 22], [60, 60, 30], [45, 95, 28], [30, 110, 18], [22, 78, 12], [25, 45, 12], [8, 20, 22], [-12, 25, 20], [-28, 25, 10],
  [50, -100, 24], [60, -110, 18], [35, -95, 16], [68, -45, 10], [15, -90, 6], [-8, -60, 18], [-25, -60, 13], [-42, -68, 6],
  [-25, 134, 16], [0, 115, 6], [-4, 140, 5], [36, 138, 4], [64, 100, 16], [8, 0, 10],
];
function isLand(lat: number, lon: number) {
  let v = 0;
  for (const [la, lo, r] of BLOBS) {
    let dl = lon - lo;
    if (dl > 180) dl -= 360;
    if (dl < -180) dl += 360;
    const d = Math.hypot((lat - la) * 1.1, dl * Math.cos((lat * Math.PI) / 180));
    v = Math.max(v, 1 - d / r);
  }
  v += (vnoise(lon / 9 + 20, lat / 9 + 20) - 0.5) * 0.7;
  return v > 0.12;
}

export function HeroClimateData({
  eyebrow = "Gridline · virtual power plant",
  title = (
    <>
      Every battery, turbine and panel
      <span className="fd-grd-glow"> one grid that thinks.</span>
    </>
  ),
  lede = "Gridline orchestrates 3,214 distributed energy sites across 19 markets, dispatching clean power in under 200 ms when the grid needs it most.",
  primaryCta = { label: "Connect your assets", href: "#connect" },
  secondaryCta = { label: "Live grid map", href: "#map" },
  metrics = DEFAULT_METRICS,
  nodes = DEFAULT_NODES,
}: HeroClimateDataProps) {
  const root = useRef<HTMLElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);
  const globeWrap = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const vals = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const el = root.current;
    const canvas = cvs.current;
    if (!el || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // sample land points on a fibonacci sphere
    const N = 5200;
    const pts: { x: number; y: number; z: number; land: boolean }[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      const lat = (Math.asin(y) * 180) / Math.PI;
      const lon = (Math.atan2(z, x) * 180) / Math.PI;
      const land = isLand(lat, lon);
      if (land || i % 5 === 0) pts.push({ x, y, z, land });
    }
    const toVec = (lat: number, lon: number) => {
      const la = (lat * Math.PI) / 180;
      const lo = (lon * Math.PI) / 180;
      return { x: Math.cos(la) * Math.cos(lo), y: Math.sin(la), z: Math.cos(la) * Math.sin(lo) };
    };
    const nv = nodes.map(([la, lo]) => toVec(la, lo));
    // great-circle arcs, lifted
    const arcs = ARCS.filter(([a, b]) => a < nv.length && b < nv.length).map(([a, b], k) => {
      const A = nv[a];
      const B = nv[b];
      const dot = Math.max(-1, Math.min(1, A.x * B.x + A.y * B.y + A.z * B.z));
      const om = Math.acos(dot);
      const seg: { x: number; y: number; z: number }[] = [];
      const S = 48;
      for (let i = 0; i <= S; i++) {
        const t = i / S;
        const s1 = Math.sin((1 - t) * om) / Math.sin(om || 1);
        const s2 = Math.sin(t * om) / Math.sin(om || 1);
        const lift = 1 + Math.sin(t * Math.PI) * (0.08 + om * 0.12);
        seg.push({ x: (A.x * s1 + B.x * s2) * lift, y: (A.y * s1 + B.y * s2) * lift, z: (A.z * s1 + B.z * s2) * lift });
      }
      return { seg, phase: (k * 0.37) % 1, speed: 0.18 + ((k * 13) % 7) * 0.025 };
    });

    let W = 0;
    let H = 0;
    let dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const sp = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      sp.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      sp.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    el.addEventListener("pointermove", onMove);

    const t0 = performance.now();
    let last = t0;
    let lastText = 0;
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      for (let i = 0; i < 2; i++) {
        const h = dt / 2;
        sp.vx += ((-380 * (sp.x - sp.tx) - 30 * sp.vx) / 4) * h;
        sp.vy += ((-380 * (sp.y - sp.ty) - 30 * sp.vy) / 4) * h;
        sp.x += sp.vx * h;
        sp.y += sp.vy * h;
      }
      const t = Math.max(0, (now - t0) / 1000);
      const rotY = 2.2 + t * 0.07 + sp.x * 0.35;
      const rotX = -0.32 + sp.y * 0.18;
      const cy = Math.cos(rotY);
      const sy = Math.sin(rotY);
      const cx = Math.cos(rotX);
      const sx = Math.sin(rotX);
      const R = Math.min(W, H) * 0.44;
      const ox = W / 2;
      const oy = H / 2;
      const proj = (p: { x: number; y: number; z: number }) => {
        const x1 = p.x * cy - p.z * sy;
        const z1 = p.x * sy + p.z * cy;
        const y2 = p.y * cx - z1 * sx;
        const z2 = p.y * sx + z1 * cx;
        return { X: ox + x1 * R, Y: oy - y2 * R, Z: z2 };
      };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // atmosphere
      const g = ctx.createRadialGradient(ox, oy, R * 0.9, ox, oy, R * 1.28);
      g.addColorStop(0, "rgba(64, 224, 168, 0.20)");
      g.addColorStop(0.4, "rgba(64, 224, 168, 0.06)");
      g.addColorStop(1, "rgba(64, 224, 168, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, R * 1.3, 0, Math.PI * 2);
      ctx.fill();
      // sphere body
      const body = ctx.createRadialGradient(ox - R * 0.35, oy - R * 0.4, R * 0.1, ox, oy, R);
      body.addColorStop(0, "#0f2a26");
      body.addColorStop(1, "#050b0c");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(ox, oy, R, 0, Math.PI * 2);
      ctx.fill();
      // dots
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = proj(p);
        if (q.Z < -0.05) continue;
        const shade = 0.25 + q.Z * 0.75;
        if (p.land) {
          ctx.fillStyle = `rgba(150, 255, 214, ${(0.25 + shade * 0.6).toFixed(3)})`;
          const s = 1.15 + q.Z * 0.6;
          ctx.fillRect(q.X - s / 2, q.Y - s / 2, s, s);
        } else {
          ctx.fillStyle = `rgba(120, 170, 190, ${(shade * 0.14).toFixed(3)})`;
          ctx.fillRect(q.X - 0.5, q.Y - 0.5, 1, 1);
        }
      }
      // arcs
      ctx.lineCap = "round";
      for (const a of arcs) {
        const P = a.seg.map(proj);
        ctx.beginPath();
        let started = false;
        for (const q of P) {
          if (q.Z < -0.02) {
            started = false;
            continue;
          }
          if (!started) ctx.moveTo(q.X, q.Y);
          else ctx.lineTo(q.X, q.Y);
          started = true;
        }
        ctx.strokeStyle = "rgba(94, 234, 180, 0.16)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // pulse
        const head = (((a.phase + t * a.speed) % 1) + 1) % 1;
        const len = 0.22;
        ctx.beginPath();
        started = false;
        for (let i = 0; i < P.length; i++) {
          const u = i / (P.length - 1);
          if (u < head - len || u > head) continue;
          const q = P[i];
          if (q.Z < -0.02) {
            started = false;
            continue;
          }
          if (!started) ctx.moveTo(q.X, q.Y);
          else ctx.lineTo(q.X, q.Y);
          started = true;
        }
        const hq = P[Math.min(P.length - 1, Math.floor(head * (P.length - 1)))];
        const tq = P[Math.max(0, Math.floor((head - len) * (P.length - 1)))];
        const lg = ctx.createLinearGradient(tq.X, tq.Y, hq.X, hq.Y);
        lg.addColorStop(0, "rgba(255, 214, 102, 0)");
        lg.addColorStop(1, "rgba(255, 228, 140, 0.95)");
        ctx.strokeStyle = lg;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        if (hq.Z > 0) {
          ctx.fillStyle = "rgba(255, 236, 170, 0.95)";
          ctx.beginPath();
          ctx.arc(hq.X, hq.Y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // nodes
      for (let i = 0; i < nv.length; i++) {
        const q = proj(nv[i]);
        if (q.Z < 0) continue;
        const pulse = (t * 0.6 + i * 0.13) % 1;
        ctx.strokeStyle = `rgba(94, 234, 180, ${(0.6 * (1 - pulse) * q.Z).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(q.X, q.Y, 3 + pulse * 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#5EEAB4";
        ctx.beginPath();
        ctx.arc(q.X, q.Y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // rim light
      const rim = ctx.createRadialGradient(ox, oy, R * 0.82, ox, oy, R);
      rim.addColorStop(0, "rgba(94,234,180,0)");
      rim.addColorStop(1, "rgba(94,234,180,0.18)");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(ox, oy, R, 0, Math.PI * 2);
      ctx.fill();

      // scroll + counters
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      if (globeWrap.current) globeWrap.current.style.transform = `translate3d(0, ${(-p * 120).toFixed(1)}px, 0) scale(${(1 + p * 0.35).toFixed(4)})`;
      if (copy.current) {
        copy.current.style.transform = `translate3d(0, ${(p * -60).toFixed(1)}px, 0)`;
        copy.current.style.opacity = `${(1 - p * 1.5).toFixed(3)}`;
      }
      if (now - lastText > 120) {
        lastText = now;
        const secs = (Date.now() / 1000) % 86400;
        metrics.forEach((m, i) => {
          const n = vals.current[i];
          if (!n) return;
          const wobble = m.unit === "MW" ? Math.sin(t * 0.9) * 22 + Math.sin(t * 2.3) * 6 : 0;
          const v = m.base + m.perSecond * (m.unit === "MW" ? t : secs) + wobble;
          n.textContent = v.toLocaleString("en-US", { minimumFractionDigits: m.decimals ?? 0, maximumFractionDigits: m.decimals ?? 0 });
        });
      }
    };

    if (reduced) {
      draw(t0 + 1);
      return () => {
        ro.disconnect();
        el.removeEventListener("pointermove", onMove);
      };
    }
    let raf = 0;
    let visible = true;
    const loop = (now: number) => {
      raf = 0;
      draw(now);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
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
      ro.disconnect();
      document.removeEventListener("visibilitychange", start);
      el.removeEventListener("pointermove", onMove);
    };
  }, [metrics, nodes]);

  return (
    <section ref={root} className="fd-grd" aria-label="Gridline">
      <style>{css}</style>
      <div className="fd-grd-stars" aria-hidden="true" />
      <div ref={globeWrap} className="fd-grd-globe">
        <canvas ref={cvs} className="fd-grd-canvas" aria-hidden="true" />
      </div>
      <div ref={copy} className="fd-grd-copy">
        <p className="fd-grd-eyebrow">
          <span className="fd-grd-live" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="fd-grd-h1">{title}</h1>
        <p className="fd-grd-lede">{lede}</p>
        <div className="fd-grd-ctas">
          <a className="fd-grd-btn" href={primaryCta.href}>
            {primaryCta.label}
          </a>
          <a className="fd-grd-ghost" href={secondaryCta.href}>
            <span className="fd-grd-live" aria-hidden="true" />
            {secondaryCta.label}
          </a>
        </div>
      </div>
      <dl className="fd-grd-metrics">
        {metrics.map((m, i) => (
          <div key={m.label} className="fd-grd-m" style={{ animationDelay: `${700 + i * 120}ms` }}>
            <dt>{m.label}</dt>
            <dd>
              <span ref={(n) => { vals.current[i] = n; }}>
                {m.base.toLocaleString("en-US", { minimumFractionDigits: m.decimals ?? 0, maximumFractionDigits: m.decimals ?? 0 })}
              </span>
              <small>{m.unit}</small>
            </dd>
            <svg className="fd-grd-spark" viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true">
              <path d={SPARKS[i % SPARKS.length]} fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" pathLength="1" />
            </svg>
          </div>
        ))}
      </dl>
    </section>
  );
}

const SPARKS = [
  "M0 18 L10 16 L20 17 L30 12 L40 14 L50 9 L60 11 L70 7 L80 9 L90 5 L100 7 L110 3 L120 4",
  "M0 22 L15 20 L30 18 L45 16 L60 13 L75 11 L90 8 L105 6 L120 3",
  "M0 14 L12 14 L24 12 L36 13 L48 10 L60 11 L72 9 L84 9 L96 7 L108 7 L120 5",
];

const css = `
.fd-grd, .fd-grd *, .fd-grd *::before, .fd-grd *::after { box-sizing: border-box; }
.fd-grd {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-grd-bg: #030807;
  --fd-grd-accent: #5EEAB4;
  --fd-grd-accent-2: #FFE48C;
  --fd-grd-sans: "SF Pro Display", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  --fd-grd-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
  position: relative; display: block; overflow: hidden; margin: 0; padding: 0; min-height: 880px;
  background: radial-gradient(80% 60% at 70% 50%, #08201b 0%, var(--fd-grd-bg) 65%); color: #E8F5F0;
  font: 400 1rem/1.5 var(--fd-grd-sans); isolation: isolate;
}
.fd-grd-stars {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.6;
  background-image: radial-gradient(1px 1px at 12% 18%, #fff 50%, transparent), radial-gradient(1px 1px at 32% 72%, #cfe 50%, transparent), radial-gradient(1px 1px at 58% 12%, #fff 50%, transparent), radial-gradient(1px 1px at 84% 30%, #dfe 50%, transparent), radial-gradient(1px 1px at 92% 82%, #fff 50%, transparent), radial-gradient(1px 1px at 6% 88%, #fff 50%, transparent), radial-gradient(1.5px 1.5px at 46% 46%, #fff 50%, transparent);
}
.fd-grd-globe { position: absolute; right: -6%; top: 50%; width: min(980px, 72vw); aspect-ratio: 1; margin-top: max(-490px, -36vw); will-change: transform; animation: fd-grd-globein 2000ms var(--fd-ease-out) both; }
.fd-grd-canvas { display: block; width: 100%; height: 100%; }
.fd-grd-copy { position: relative; z-index: 2; max-width: 1240px; margin: 0 auto; padding: 150px 48px 0; will-change: transform, opacity; }
.fd-grd-eyebrow {
  display: inline-flex; align-items: center; gap: 10px; margin: 0 0 24px; padding: 0;
  font: 500 0.75rem/1 var(--fd-grd-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--fd-grd-accent);
  animation: fd-grd-rise var(--fd-dur-4) var(--fd-ease-out) 100ms both;
}
.fd-grd-live { position: relative; display: block; width: 7px; height: 7px; border-radius: 9999px; background: var(--fd-grd-accent); box-shadow: 0 0 12px var(--fd-grd-accent); animation: fd-grd-blink 2s var(--fd-ease-in-out) infinite; }
.fd-grd-h1 {
  margin: 0; padding: 0; max-width: 13ch; color: #F2FBF7;
  font: 600 clamp(2.5rem, 5.4vw, 4.875rem)/1 var(--fd-grd-sans); letter-spacing: -0.045em; text-wrap: balance;
  animation: fd-grd-blur 1100ms var(--fd-ease-out) 180ms both;
}
.fd-grd-glow { background: linear-gradient(90deg, #5EEAB4, #C8FFE6 60%, #FFE48C); -webkit-background-clip: text; background-clip: text; color: transparent; }
.fd-grd-lede { margin: 24px 0 0; padding: 0; max-width: 29rem; color: rgba(214, 236, 228, 0.7); font: 400 clamp(1rem, 1.2vw, 1.125rem)/1.55 var(--fd-grd-sans); letter-spacing: -0.01em; text-wrap: pretty; animation: fd-grd-rise var(--fd-dur-4) var(--fd-ease-out) 380ms both; }
.fd-grd-ctas { display: flex; flex-wrap: wrap; gap: 12px; margin: 34px 0 0; animation: fd-grd-rise var(--fd-dur-4) var(--fd-ease-out) 480ms both; }
.fd-grd-btn {
  display: inline-flex; align-items: center; margin: 0; height: 48px; padding: 0 22px; border-radius: 9999px; border: 0;
  background: var(--fd-grd-accent); color: #02130D; text-decoration: none; font: 600 0.9375rem/1 var(--fd-grd-sans); letter-spacing: -0.01em;
  box-shadow: 0 0 0 1px rgba(94,234,180,0.4), 0 10px 40px -8px rgba(94,234,180,0.55);
  transition: transform var(--fd-dur-2) var(--fd-spring), box-shadow var(--fd-dur-2);
}
.fd-grd-btn:hover { box-shadow: 0 0 0 1px rgba(94,234,180,0.6), 0 14px 50px -6px rgba(94,234,180,0.7); }
.fd-grd-ghost { display: inline-flex; align-items: center; gap: 10px; margin: 0; height: 48px; padding: 0 20px; border-radius: 9999px; border: 1px solid rgba(94,234,180,0.25); background: rgba(94,234,180,0.05); color: #E8F5F0; text-decoration: none; font: 500 0.9375rem/1 var(--fd-grd-sans); transition: transform var(--fd-dur-2) var(--fd-spring), border-color var(--fd-dur-1); }
.fd-grd-ghost:hover { border-color: rgba(94,234,180,0.5); }
.fd-grd-btn:active, .fd-grd-ghost:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-grd-btn:focus-visible, .fd-grd-ghost:focus-visible { outline: 2px solid rgba(94,234,180,0.7); outline-offset: 2px; }
.fd-grd-metrics {
  position: absolute; z-index: 2; left: 50%; bottom: 40px; transform: translateX(-50%); width: min(1144px, calc(100% - 96px)); margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0;
  border-top: 1px solid rgba(94,234,180,0.16);
}
.fd-grd-m { position: relative; margin: 0; padding: 22px 24px 0 0; animation: fd-grd-rise var(--fd-dur-4) var(--fd-ease-out) both; }
.fd-grd-m + .fd-grd-m { padding-left: 24px; border-left: 1px solid rgba(94,234,180,0.1); }
.fd-grd-m dt { margin: 0; padding: 0; font: 500 0.6875rem/1.3 var(--fd-grd-mono); letter-spacing: 0.08em; text-transform: uppercase; color: rgba(214,236,228,0.55); }
.fd-grd-m dd { display: flex; align-items: baseline; gap: 8px; margin: 10px 0 0; padding: 0; font: 500 clamp(1.5rem, 2.6vw, 2.25rem)/1 var(--fd-grd-mono); letter-spacing: -0.04em; color: #F2FBF7; font-variant-numeric: tabular-nums; }
.fd-grd-m dd small { font: 500 0.8125rem/1 var(--fd-grd-mono); letter-spacing: 0; color: var(--fd-grd-accent); }
.fd-grd-spark { position: absolute; right: 24px; top: 26px; width: 96px; height: 22px; display: block; color: var(--fd-grd-accent); opacity: 0.7; }
.fd-grd-spark path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: fd-grd-draw 1600ms var(--fd-ease-out) 1000ms forwards; }

@keyframes fd-grd-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes fd-grd-blur { from { opacity: 0; filter: blur(12px); transform: translateY(12px); } to { opacity: 1; filter: none; transform: none; } }
@keyframes fd-grd-globein { from { opacity: 0; transform: scale(0.82) rotate(-8deg); filter: blur(12px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes fd-grd-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes fd-grd-draw { to { stroke-dashoffset: 0; } }

@media (max-width: 900px) {
  .fd-grd { min-height: 844px; }
  .fd-grd-globe { right: auto; left: 50%; top: auto; bottom: -34vw; width: 120vw; margin: 0 0 0 -60vw; opacity: 0.9; }
  .fd-grd-copy { text-shadow: 0 1px 12px #030807; }
  .fd-grd-copy { padding: 104px 20px 0; }
  .fd-grd-metrics { width: calc(100% - 40px); bottom: 24px; grid-template-columns: 1fr 1fr; }
  .fd-grd-m { padding: 16px 12px 0 0; }
  .fd-grd-m + .fd-grd-m { padding-left: 12px; }
  .fd-grd-m:nth-child(3) { display: none; }
  .fd-grd-spark { display: none; }
}
@media (prefers-reduced-motion: reduce) { .fd-grd *, .fd-grd *::before { animation: none !important; } .fd-grd-spark path { stroke-dashoffset: 0; } }
`;

/* ───────────────────────── Demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-grd-demo">
      <style>{demoCss}</style>
      <header className="fd-grd-demo-nav">
        <a className="fd-grd-demo-logo" href="#top">
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <circle cx="10" cy="10" r="8" fill="none" stroke="#5EEAB4" strokeWidth="1.6" />
            <path d="M2 10h16M10 2c3 3 3 13 0 16M10 2c-3 3-3 13 0 16" fill="none" stroke="#5EEAB4" strokeWidth="1.2" />
          </svg>
          Gridline
        </a>
        <nav aria-label="Primary">
          <a href="#platform">Platform</a>
          <a href="#utilities">Utilities</a>
          <a href="#owners">Asset owners</a>
          <a href="#impact">Impact report</a>
        </nav>
        <a className="fd-grd-demo-cta" href="#demo">Book a demo</a>
      </header>
      <HeroClimateData />
    </div>
  );
}

const demoCss = `
.fd-grd-demo { position: relative; margin: 0; padding: 0; min-height: 100vh; background: #030807; }
.fd-grd-demo *, .fd-grd-demo *::before, .fd-grd-demo *::after { box-sizing: border-box; }
.fd-grd-demo-nav { position: absolute; z-index: 10; top: 0; left: 0; right: 0; max-width: 1240px; height: 72px; margin: 0 auto; padding: 0 48px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.fd-grd-demo-logo { display: inline-flex; align-items: center; gap: 10px; margin: 0; color: #F2FBF7; text-decoration: none; font: 600 1.0625rem/1 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", sans-serif; letter-spacing: -0.02em; }
.fd-grd-demo-logo svg { display: block; }
.fd-grd-demo-nav nav { display: flex; gap: 30px; }
.fd-grd-demo-nav nav a { color: rgba(214,236,228,0.65); text-decoration: none; font: 500 0.875rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; transition: color 120ms; }
.fd-grd-demo-nav nav a:hover { color: #F2FBF7; }
.fd-grd-demo-cta { display: inline-flex; align-items: center; height: 36px; padding: 0 16px; border-radius: 9999px; color: #F2FBF7; text-decoration: none; border: 1px solid rgba(94,234,180,0.3); font: 500 0.875rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; }
.fd-grd-demo-nav a:focus-visible { outline: 2px solid rgba(94,234,180,.7); outline-offset: 2px; border-radius: 8px; }
@media (max-width: 900px) { .fd-grd-demo-nav { padding: 0 20px; height: 64px; } .fd-grd-demo-nav nav { display: none; } }
`;
