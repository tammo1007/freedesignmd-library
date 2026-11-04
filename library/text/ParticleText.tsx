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

export function Demo() {
  return (
    <div className="fd-ptd">
      <style>{demoCss}</style>
      <ParticleText text="Particles" label="Particles" colors={["#1d1d1f", "#2a2a2e", "#38383d"]} gap={4} className="fd-ptd-stage" />
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-ptd,.fd-ptd *,.fd-ptd *::before,.fd-ptd *::after{box-sizing:border-box}
.fd-ptd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f2f2f2;color:#1d1d1f;font:400 15px/1.4 ${F};letter-spacing:normal}
.fd-ptd .fd-ptd-stage{width:100%;max-width:760px;height:clamp(200px,38vh,300px);margin:0;padding:0}
`;
