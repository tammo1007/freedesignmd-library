/**
 * ParticleText, text (or any canvas-drawable mark) sampled into particles.
 * The cursor pushes particles aside and they spring home; a click detonates
 * the word and it reforms. Particles keep a faint idle shimmer.
 *
 * Props
 * - text: string                 Word or short title. Use "\n" for two lines.
 * - font?: string                Canvas font weight + family. Default 800 + system display stack.
 * - colors?: string[]            Particle palette, picked by x position. Default warm gradient.
 * - gap?: number                 Sampling step in CSS px (smaller = more particles). Default auto by size.
 * - radius?: number              Cursor influence radius in px. Default 90.
 * - draw?: (ctx, w, h) => void   Draw your own mark (logo) in white instead of text.
 * - label?: string               Accessible text. Default `text`.
 * - className / style            Size the box; the canvas fills it (min-height 240px).
 *
 * Physics: per particle spring to home (k 0.06/frame-normalised, damping 0.86)
 * plus a radial push from the pointer. Typed arrays, one draw call per colour
 * bucket, DPR capped at 2. The loop pauses off-screen and when the tab is
 * hidden. Reduced motion: static particles, no explosion.
 * Accessibility: canvas is aria-hidden; a visually hidden heading/text holds
 * the label. Click / Enter / Space on the focusable stage trigger the burst.
 * Browser support: all evergreen browsers (Canvas 2D).
 */
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

export interface ParticleTextProps {
  text: string;
  font?: string;
  colors?: string[];
  gap?: number;
  radius?: number;
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const DISPLAY = '800 100px "SF Pro Display", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif';

export function ParticleText({
  text,
  font = DISPLAY,
  colors = ["#FFD166", "#FF8A5B", "#FF4D8D", "#B66DFF", "#5B8CFF"],
  gap,
  radius = 90,
  draw,
  label,
  className,
  style,
}: ParticleTextProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const burstRef = useRef<() => void>(() => {});

  useEffect(() => {
    const host = wrap.current;
    const canvas = cv.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let W = 0;
    let H = 0;
    let dpr = 1;
    let n = 0;
    let hx = new Float32Array(0);
    let hy = new Float32Array(0);
    let x = new Float32Array(0);
    let y = new Float32Array(0);
    let vx = new Float32Array(0);
    let vy = new Float32Array(0);
    let col = new Uint8Array(0);
    let sz = new Float32Array(0);
    let ph = new Float32Array(0);
    let px = -1e5;
    let py = -1e5;
    let raf = 0;
    let visible = true;
    let lastT = 0;
    let first = true;
    let burstAt = -1e9;

    const sample = () => {
      const r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      // rasterise mark at 1x into an offscreen canvas
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const o = off.getContext("2d", { willReadFrequently: true });
      if (!o) return;
      o.fillStyle = "#fff";
      if (draw) draw(o, W, H);
      else {
        const lines = text.split("\n");
        o.font = font;
        const widest = Math.max(...lines.map((l) => o.measureText(l).width));
        const sizeByW = (100 * W * 0.9) / widest;
        const sizeByH = (H * 0.86) / (lines.length * 0.92);
        const fs = Math.min(sizeByW, sizeByH);
        o.font = font.replace(/\d+px/, `${fs.toFixed(1)}px`);
        o.textAlign = "center";
        o.textBaseline = "middle";
        const lh = fs * 0.92;
        lines.forEach((l, i) => o.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh));
      }
      const data = o.getImageData(0, 0, W, H).data;
      const step = gap ?? Math.max(3, Math.round(Math.sqrt((W * H) / 14000)));
      const pts: number[] = [];
      for (let yy = 0; yy < H; yy += step) {
        for (let xx = (yy / step) % 2 ? step / 2 : 0; xx < W; xx += step) {
          const i = ((yy | 0) * W + (xx | 0)) * 4 + 3;
          if (data[i] > 128) pts.push(xx, yy);
        }
      }
      const prevN = n;
      const ox = x;
      const oy = y;
      n = pts.length / 2;
      hx = new Float32Array(n);
      hy = new Float32Array(n);
      const nx = new Float32Array(n);
      const ny = new Float32Array(n);
      vx = new Float32Array(n);
      vy = new Float32Array(n);
      col = new Uint8Array(n);
      sz = new Float32Array(n);
      ph = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        hx[i] = pts[i * 2];
        hy[i] = pts[i * 2 + 1];
        if (i < prevN) {
          nx[i] = ox[i];
          ny[i] = oy[i];
        } else if (first && !reduced) {
          // initial assembly: particles drift in from a wide ring
          const a = Math.random() * Math.PI * 2;
          const d = Math.max(W, H) * (0.6 + Math.random() * 0.5);
          nx[i] = W / 2 + Math.cos(a) * d;
          ny[i] = H / 2 + Math.sin(a) * d;
        } else {
          nx[i] = hx[i];
          ny[i] = hy[i];
        }
        const t = hx[i] / W + (Math.random() - 0.5) * 0.18;
        col[i] = Math.max(0, Math.min(colors.length - 1, Math.floor(t * colors.length)));
        sz[i] = step * (0.42 + Math.random() * 0.22);
        ph[i] = Math.random() * Math.PI * 2;
      }
      x = nx;
      y = ny;
      first = false;
    };

    const render = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (let c = 0; c < colors.length; c++) {
        ctx.fillStyle = colors[c];
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          if (col[i] !== c) continue;
          const s = sz[i] * (reduced ? 1 : 0.9 + 0.12 * Math.sin(t * 0.002 + ph[i]));
          ctx.rect(x[i] - s / 2, y[i] - s / 2, s, s);
        }
        ctx.fill();
      }
    };

    const tick = (t: number) => {
      raf = 0;
      const f = Math.min(2, (t - lastT) / 16.667 || 1);
      lastT = t;
      const R = radius;
      const R2 = R * R;
      // after a burst the spring relaxes and air drag drops, then both ease back
      const since = t - burstAt;
      const relax = since < 1400 ? Math.min(1, Math.max(0.02, (since - 380) / 1000)) : 1;
      const k = 0.06 * f * relax * relax;
      const damp = Math.pow(0.86 + 0.06 * (1 - relax), f);
      for (let i = 0; i < n; i++) {
        const dx = x[i] - px;
        const dy = y[i] - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) || 1;
          const push = (1 - d / R) * 7 * f;
          vx[i] += (dx / d) * push;
          vy[i] += (dy / d) * push;
        }
        vx[i] = (vx[i] + (hx[i] - x[i]) * k) * damp;
        vy[i] = (vy[i] + (hy[i] - y[i]) * k) * damp;
        x[i] += vx[i] * f;
        y[i] += vy[i] * f;
      }
      render(t);
      if (visible && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf && visible && !reduced) {
        lastT = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    sample();
    if (reduced) render(0);
    else start();

    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      if (Math.round(r.width) === W && Math.round(r.height) === H) return;
      sample();
      if (reduced) render(0);
    });
    ro.observe(host);
    document.fonts?.ready.then(() => {
      sample();
      if (reduced) render(0);
    }).catch(() => {});

    const io = new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
      if (visible) start();
    });
    io.observe(host);
    const onVis = () => !document.hidden && start();
    document.addEventListener("visibilitychange", onVis);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
    };
    const onLeave = () => {
      px = py = -1e5;
    };
    burstRef.current = () => {
      if (reduced) return;
      const cx = px > -1e4 ? px : W / 2;
      const cy = py > -1e4 ? py : H / 2;
      for (let i = 0; i < n; i++) {
        const dx = x[i] - cx;
        const dy = y[i] - cy;
        const d = Math.hypot(dx, dy) || 1;
        const p = 6 + Math.random() * 9 + Math.min(10, 1600 / (d + 60));
        vx[i] += (dx / d) * p + (Math.random() - 0.5) * 8;
        vy[i] += (dy / d) * p + (Math.random() - 0.5) * 8;
      }
      burstAt = performance.now();
      start();
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [text, font, colors.join(","), gap, radius, draw]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={wrap}
      className={`fd-pt${className ? " " + className : ""}`}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`${label ?? text.replace(/\n/g, " ")}, press to scatter`}
      onClick={() => burstRef.current()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          burstRef.current();
        }
      }}
    >
      <style>{css}</style>
      <canvas ref={cv} className="fd-pt-cv" aria-hidden="true" />
    </div>
  );
}

const css = `
.fd-pt,.fd-pt *{box-sizing:border-box}
.fd-pt{position:relative;display:block;margin:0;padding:0;min-height:240px;width:100%;cursor:pointer;touch-action:pan-y;-webkit-tap-highlight-color:transparent;outline:0;border-radius:20px}
.fd-pt:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px}
.fd-pt-cv{position:absolute;inset:0;display:block;width:100%;height:100%;margin:0;padding:0}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const LINEUP = [
  ["Fri 17 Jul", "Nilsa Varga", "Oberon Tide", "Kasai Lanes", "The Halyards"],
  ["Sat 18 Jul", "Mireille Ochoa", "Night Ferries", "Glasshouse", "Tomo & Ilse"],
  ["Sun 19 Jul", "Ayo Bankole", "Paper Moths", "Dunes Club", "Vela Sound"],
];

export function Demo() {
  return (
    <div className="fd-pt-demo">
      <style>{demoCss}</style>
      <div className="fd-pt-demo-sky" aria-hidden="true" />
      <header className="fd-pt-demo-bar">
        <span className="fd-pt-demo-mark">SFF/27</span>
        <nav className="fd-pt-demo-nav" aria-label="Primary">
          <a href="#lineup">Line-up</a><a href="#tickets">Tickets</a><a href="#camping">Camping</a><a href="#faq">FAQ</a>
        </nav>
        <a className="fd-pt-demo-btn" href="#tickets">Get tickets</a>
      </header>
      <main className="fd-pt-demo-main">
        <p className="fd-pt-demo-eyebrow">17, 19 July 2027 · Lake Alster, Hamburg</p>
        <h1 className="fd-pt-demo-sr">Saltwater Festival</h1>
        <ParticleText text={"SALT\nWATER"} label="Saltwater" className="fd-pt-demo-stage" />
        <p className="fd-pt-demo-hint" aria-hidden="true">Move through the letters · click to scatter</p>
        <div className="fd-pt-demo-lineup" id="lineup">
          {LINEUP.map(([day, ...acts]) => (
            <section key={day} className="fd-pt-demo-day" aria-label={day}>
              <h2>{day}</h2>
              <p>{acts.join(" · ")}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

const demoCss = `
.fd-pt-demo,.fd-pt-demo *,.fd-pt-demo *::before,.fd-pt-demo *::after{box-sizing:border-box}
.fd-pt-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:"SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;
  position:relative;overflow:hidden;margin:0;padding:0;min-height:100vh;background:#0B0714;color:#F7F1FF;font:400 15px/1.5 var(--d-font);-webkit-font-smoothing:antialiased}
.fd-pt-demo-sky{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(60% 50% at 20% 10%,rgba(182,109,255,.28),transparent 70%),radial-gradient(50% 50% at 85% 30%,rgba(255,77,141,.2),transparent 70%),radial-gradient(70% 50% at 50% 110%,rgba(91,140,255,.25),transparent 70%)}
.fd-pt-demo-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.fd-pt-demo-bar{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0;padding:20px clamp(16px,4vw,48px)}
.fd-pt-demo-mark{margin:0;font:800 17px/1 var(--d-disp);letter-spacing:.02em}
.fd-pt-demo-nav{display:flex;gap:28px;margin:0}
.fd-pt-demo-nav a{margin:0;padding:6px 0;color:rgba(247,241,255,.65);font:500 15px/1 var(--d-font);text-decoration:none}
.fd-pt-demo-nav a:hover{color:#F7F1FF}
.fd-pt-demo-btn{display:inline-flex;align-items:center;height:40px;margin:0;padding:0 18px;border-radius:9999px;background:#FFD166;color:#1B1206;font:600 14px/1 var(--d-font);text-decoration:none;
  transition:transform 120ms cubic-bezier(.22,1,.36,1)}
.fd-pt-demo-btn:active{transform:scale(.96)}
.fd-pt-demo a:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
.fd-pt-demo-main{position:relative;max-width:1280px;margin:0 auto;padding:clamp(12px,3vh,32px) clamp(16px,4vw,48px) 40px;text-align:center}
.fd-pt-demo-eyebrow{margin:0;color:rgba(247,241,255,.7);font:500 13px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}
.fd-pt-demo-stage{height:clamp(260px,52vh,520px);margin:12px 0 0}
.fd-pt-demo-hint{margin:6px 0 0;color:rgba(247,241,255,.45);font:500 12px/1 var(--d-font);letter-spacing:.02em}
.fd-pt-demo-lineup{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:clamp(24px,4vh,40px) 0 0;text-align:left}
.fd-pt-demo-day{margin:0;padding:16px 18px;border-radius:20px;background:rgba(247,241,255,.05);box-shadow:inset 0 0 0 1px rgba(247,241,255,.08)}
.fd-pt-demo-day h2{margin:0 0 6px;color:#FFD166;font:600 13px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.06em;text-transform:uppercase}
.fd-pt-demo-day p{margin:0;color:#F7F1FF;font:500 15px/1.45 var(--d-font);letter-spacing:-.01em}
@media (max-width:760px){.fd-pt-demo-nav{display:none}.fd-pt-demo-lineup{grid-template-columns:1fr}.fd-pt-demo-stage{height:300px}}
`;
