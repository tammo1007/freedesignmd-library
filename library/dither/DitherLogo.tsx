/**
 * DitherLogo, a mark rendered as ordered-dither stipple dots. Every dot is a
 * particle on a spring: the cursor scatters them, they settle back with a
 * little overshoot. On first view the dots assemble from a loose cloud.
 *
 * Props
 * - path?: string        SVG path data (any viewBox), filled with `color`. Overrides the built-in mark.
 * - viewBox?: number     Size of the path's square viewBox. Default 24.
 * - text?: string        Alternative: a word/glyph drawn as the mark.
 * - color?: string       Dot colour. Default "#EDEDF2".
 * - accent?: string      Second ink used by the built-in mark's planet. Default "#FF7A45".
 * - spacing?: number     Dot grid in CSS px. Default 4.
 * - dotScale?: number    Dot diameter relative to spacing. Default 0.7.
 * - radius?: number      Cursor repel radius in CSS px. Default 90.
 * - strength?: number    Cursor force. Default 1.
 * - assemble?: boolean   Intro assembly animation. Default true.
 * - label?: string       Accessible name (canvas gets role="img"); omit for decorative.
 * CSS vars: --fd-dlogo-fallback.
 *
 * Browser support: WebGL2 / WebGL1 (point sprites). Without WebGL a CSS dotted
 * mask fallback is shown. Reduced motion: no assembly, no scatter, still dots.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type GL = WebGLRenderingContext | WebGL2RenderingContext;

const VERT = `
precision highp float;
attribute vec2 aPos;
attribute vec3 aCol;
attribute float aSize;
uniform vec2 uRes;
uniform float uPt;
varying vec3 vCol;
void main(){
  vec2 p = aPos / uRes * 2. - 1.;
  gl_Position = vec4(p.x, -p.y, 0., 1.);
  gl_PointSize = uPt * aSize;
  vCol = aCol;
}`;
const FRAG = `
precision highp float;
varying vec3 vCol;
uniform float uPt;
void main(){
  vec2 c = gl_PointCoord - .5;
  float d = length(c) * 2.;
  float aa = 2. / max(uPt, 1.);
  float a = 1. - smoothstep(1. - aa, 1., d);
  if (a <= 0.) discard;
  gl_FragColor = vec4(vCol * a, a);
}`;

/** Classic 8×8 Bayer matrix, normalised to (0,1). Base cell [[0,2],[3,1]], recursed per bit. */
const BAYER8 = (() => {
  const base = [0, 2, 3, 1];
  const m = new Float32Array(64);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      let v = 0;
      for (let k = 0; k < 3; k++) v += base[(((y >> k) & 1) << 1) | ((x >> k) & 1)] * 4 ** (2 - k);
      m[y * 8 + x] = (v + 0.5) / 64;
    }
  return m;
})();

const hexToRgb = (hex: string): [number, number, number] => {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Built-in mark: squircle app icon with a lit planet sliced by horizon stripes. */
function drawMark(ctx: CanvasRenderingContext2D, S: number, color: string, accent: string) {
  const r = S * 0.24;
  const pad = S * 0.04;
  const sq = (inset: number) => {
    const a = pad + inset;
    const b = S - pad - inset;
    const rr = r - inset * 0.6;
    ctx.beginPath();
    ctx.moveTo(a + rr, a);
    ctx.lineTo(b - rr, a);
    ctx.quadraticCurveTo(b, a, b, a + rr);
    ctx.lineTo(b, b - rr);
    ctx.quadraticCurveTo(b, b, b - rr, b);
    ctx.lineTo(a + rr, b);
    ctx.quadraticCurveTo(a, b, a, b - rr);
    ctx.lineTo(a, a + rr);
    ctx.quadraticCurveTo(a, a, a + rr, a);
    ctx.closePath();
  };
  // icon body: soft top-lit tone (alpha encodes density)
  const body = ctx.createLinearGradient(0, pad, S * 0.3, S - pad);
  body.addColorStop(0, color + "88");
  body.addColorStop(0.55, color + "30");
  body.addColorStop(1, color + "12");
  ctx.fillStyle = body;
  sq(0);
  ctx.fill();
  // crisp rim
  ctx.lineWidth = S * 0.022;
  ctx.strokeStyle = color;
  sq(S * 0.011);
  ctx.stroke();

  // planet
  const cx = S * 0.5;
  const cy = S * 0.53;
  const R = S * 0.25;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, R * 0.05, cx, cy, R * 1.05);
  g.addColorStop(0, accent);
  g.addColorStop(0.45, accent + "f0");
  g.addColorStop(0.8, accent + "80");
  g.addColorStop(1, accent + "30");
  ctx.fillStyle = g;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  // horizon stripes: cut gaps that grow toward the bottom
  ctx.globalCompositeOperation = "destination-out";
  let y = cy + R * 0.08;
  let gap = R * 0.07;
  while (y < cy + R) {
    ctx.fillRect(cx - R, y, R * 2, gap);
    y += gap + R * 0.15;
    gap *= 1.4;
  }
  ctx.restore();
  // orbit ring in front
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.32);
  ctx.strokeStyle = color + "ee";
  ctx.lineWidth = S * 0.018;
  ctx.beginPath();
  ctx.ellipse(0, 0, R * 1.55, R * 0.36, 0, Math.PI * 0.02, Math.PI * 0.98);
  ctx.stroke();
  ctx.restore();
}

interface Particles {
  n: number;
  home: Float32Array;
  pos: Float32Array;
  vel: Float32Array;
  col: Float32Array;
  size: Float32Array;
}

function sample(
  W: number,
  H: number,
  spacing: number,
  opts: { path?: string; viewBox: number; text?: string; color: string; accent: string },
): Particles {
  const S = Math.max(16, Math.floor(Math.min(W, H)));
  const off = document.createElement("canvas");
  off.width = S;
  off.height = S;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  const empty = { n: 0, home: new Float32Array(), pos: new Float32Array(), vel: new Float32Array(), col: new Float32Array(), size: new Float32Array() };
  if (!ctx) return empty;
  if (opts.path) {
    ctx.save();
    const k = (S * 0.92) / opts.viewBox;
    ctx.translate(S * 0.04, S * 0.04);
    ctx.scale(k, k);
    ctx.fillStyle = opts.color;
    ctx.fill(new Path2D(opts.path));
    ctx.restore();
  } else if (opts.text) {
    ctx.fillStyle = opts.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let fs = S * 0.8;
    ctx.font = `800 ${fs}px ui-sans-serif, -apple-system, "SF Pro Display", "Inter", "Segoe UI", Roboto, sans-serif`;
    const tw = ctx.measureText(opts.text).width;
    if (tw > S * 0.92) fs *= (S * 0.92) / tw;
    ctx.font = `800 ${fs}px ui-sans-serif, -apple-system, "SF Pro Display", "Inter", "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(opts.text, S / 2, S / 2);
  } else {
    drawMark(ctx, S, opts.color, opts.accent);
  }
  const data = ctx.getImageData(0, 0, S, S).data;
  const ox = (W - S) / 2;
  const oy = (H - S) / 2;
  const home: number[] = [];
  const col: number[] = [];
  const size: number[] = [];
  const cols = Math.floor(S / spacing);
  for (let gy = 0; gy < cols; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const px = Math.floor((gx + 0.5) * spacing);
      const py = Math.floor((gy + 0.5) * spacing);
      const i = (py * S + px) * 4;
      const a = data[i + 3] / 255;
      if (a < 0.02) continue;
      if (a < BAYER8[(gy & 7) * 8 + (gx & 7)]) continue;
      home.push(ox + px, oy + py);
      // un-premultiply is not needed: getImageData returns straight alpha
      col.push(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
      size.push(a > 0.9 ? 1 : 0.86);
    }
  }
  const n = home.length / 2;
  return {
    n,
    home: new Float32Array(home),
    pos: new Float32Array(home),
    vel: new Float32Array(n * 2),
    col: new Float32Array(col),
    size: new Float32Array(size),
  };
}

export interface DitherLogoProps {
  path?: string;
  viewBox?: number;
  text?: string;
  color?: string;
  accent?: string;
  spacing?: number;
  dotScale?: number;
  radius?: number;
  strength?: number;
  assemble?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function DitherLogo({
  path,
  viewBox = 24,
  text,
  color = "#EDEDF2",
  accent = "#FF7A45",
  spacing = 4,
  dotScale = 0.7,
  radius = 90,
  strength = 1,
  assemble = true,
  label,
  className,
  style,
}: DitherLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const live = useRef({ dotScale, radius, strength, spacing });
  live.current = { dotScale, radius, strength, spacing };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const attrs: WebGLContextAttributes = { antialias: false, alpha: true, premultipliedAlpha: true };
    let gl: GL | null = canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null;
    if (!gl) gl = canvas.getContext("webgl", attrs) as WebGLRenderingContext | null;
    if (!gl) {
      setFailed(true);
      return;
    }
    const g = gl;
    const compile = (type: number, src: string) => {
      const s = g.createShader(type)!;
      g.shaderSource(s, src);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) console.warn("[DitherLogo]", g.getShaderInfoLog(s));
      return s;
    };
    const prog = g.createProgram()!;
    g.attachShader(prog, compile(g.VERTEX_SHADER, VERT));
    g.attachShader(prog, compile(g.FRAGMENT_SHADER, FRAG));
    g.linkProgram(prog);
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) {
      console.warn("[DitherLogo]", g.getProgramInfoLog(prog));
      setFailed(true);
      return;
    }
    g.useProgram(prog);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    const uRes = g.getUniformLocation(prog, "uRes");
    const uPt = g.getUniformLocation(prog, "uPt");
    const posBuf = g.createBuffer();
    const colBuf = g.createBuffer();
    const sizeBuf = g.createBuffer();
    const aPos = g.getAttribLocation(prog, "aPos");
    const aCol = g.getAttribLocation(prog, "aCol");
    const aSize = g.getAttribLocation(prog, "aSize");

    let P: Particles | null = null;
    let W = 1;
    let H = 1;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let visible = false;
    let assembled = !assemble || reduced;
    const ptr = { x: -9999, y: -9999, px: -9999, py: -9999, in: false };

    const upload = () => {
      if (!P) return;
      g.bindBuffer(g.ARRAY_BUFFER, colBuf);
      g.bufferData(g.ARRAY_BUFFER, P.col, g.STATIC_DRAW);
      g.enableVertexAttribArray(aCol);
      g.vertexAttribPointer(aCol, 3, g.FLOAT, false, 0, 0);
      g.bindBuffer(g.ARRAY_BUFFER, sizeBuf);
      g.bufferData(g.ARRAY_BUFFER, P.size, g.STATIC_DRAW);
      g.enableVertexAttribArray(aSize);
      g.vertexAttribPointer(aSize, 1, g.FLOAT, false, 0, 0);
      g.bindBuffer(g.ARRAY_BUFFER, posBuf);
      g.bufferData(g.ARRAY_BUFFER, P.pos, g.DYNAMIC_DRAW);
      g.enableVertexAttribArray(aPos);
      g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 0, 0);
    };

    const scatter = () => {
      if (!P) return;
      for (let i = 0; i < P.n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.min(W, H) * (0.25 + Math.random() * 0.45);
        P.pos[i * 2] = P.home[i * 2] + Math.cos(a) * d;
        P.pos[i * 2 + 1] = P.home[i * 2 + 1] + Math.sin(a) * d;
        P.vel[i * 2] = 0;
        P.vel[i * 2 + 1] = 0;
      }
    };

    const step = (dt: number) => {
      if (!P) return false;
      const { radius: R, strength: F } = live.current;
      const k = 120;
      const c = 11;
      const R2 = R * R;
      const pvx = ptr.x - ptr.px;
      const pvy = ptr.y - ptr.py;
      ptr.px = ptr.x;
      ptr.py = ptr.y;
      let energy = 0;
      const pos = P.pos;
      const vel = P.vel;
      const home = P.home;
      for (let i = 0; i < P.n * 2; i += 2) {
        let fx = (home[i] - pos[i]) * k - vel[i] * c;
        let fy = (home[i + 1] - pos[i + 1]) * k - vel[i + 1] * c;
        if (ptr.in) {
          const dx = pos[i] - ptr.x;
          const dy = pos[i + 1] - ptr.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const d = Math.sqrt(d2) + 0.001;
            const f = 1 - d / R;
            const push = f * f * 9000 * F;
            fx += (dx / d) * push + pvx * f * 40 * F;
            fy += (dy / d) * push + pvy * f * 40 * F;
          }
        }
        vel[i] += fx * dt;
        vel[i + 1] += fy * dt;
        pos[i] += vel[i] * dt;
        pos[i + 1] += vel[i + 1] * dt;
        energy += Math.abs(vel[i]) + Math.abs(vel[i + 1]) + Math.abs(home[i] - pos[i]) + Math.abs(home[i + 1] - pos[i + 1]);
      }
      return energy / Math.max(1, P.n) > 0.02;
    };

    const draw = () => {
      if (!P) return;
      g.viewport(0, 0, canvas.width, canvas.height);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.uniform2f(uRes, W, H);
      g.uniform1f(uPt, Math.max(1, live.current.spacing * live.current.dotScale * dpr));
      g.bindBuffer(g.ARRAY_BUFFER, posBuf);
      g.bufferSubData(g.ARRAY_BUFFER, 0, P.pos);
      g.drawArrays(g.POINTS, 0, P.n);
    };

    const loop = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      // two half-steps for stability
      let moving = step(dt / 2);
      moving = step(dt / 2) || moving;
      draw();
      if ((moving || ptr.in) && visible && !document.hidden) raf = requestAnimationFrame(loop);
      else last = 0;
    };
    const request = () => {
      if (!raf && !reduced && visible) raf = requestAnimationFrame(loop);
    };

    const build = () => {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      P = sample(W, H, live.current.spacing, { path, viewBox, text, color, accent });
      if (!assembled) scatter();
      upload();
      draw();
      request();
    };

    const ro = new ResizeObserver(() => build());
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) {
        if (!assembled) assembled = true; // first reveal: particles fly home
        request();
      }
    }, { threshold: 0.25 });
    io.observe(canvas);

    const host = canvas.parentElement!;
    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
      if (!ptr.in) {
        ptr.px = ptr.x;
        ptr.py = ptr.y;
      }
      ptr.in = !reduced;
      request();
    };
    const leave = () => {
      ptr.in = false;
      request();
    };
    const onVis = () => !document.hidden && request();
    const onLost = (e: Event) => {
      e.preventDefault();
      console.warn("[DitherLogo] context lost");
      cancelAnimationFrame(raf);
      raf = 0;
      setFailed(true);
    };
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerdown", move);
    host.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", onVis);
    canvas.addEventListener("webglcontextlost", onLost);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerdown", move);
      host.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      g.deleteBuffer(posBuf);
      g.deleteBuffer(colBuf);
      g.deleteBuffer(sizeBuf);
      g.deleteProgram(prog);
    };
  }, [path, viewBox, text, color, accent, spacing, assemble]);

  return (
    <div className={`fd-dlogo${className ? " " + className : ""}`} style={style}>
      <style>{css}</style>
      {failed ? (
        <div className="fd-dlogo-fallback" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ ["--fd-dlogo-c" as string]: color, ["--fd-dlogo-a" as string]: accent }} />
      ) : (
        <canvas ref={canvasRef} className="fd-dlogo-canvas" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
      )}
    </div>
  );
}

const css = `
.fd-dlogo, .fd-dlogo *, .fd-dlogo *::before, .fd-dlogo *::after { box-sizing: border-box; }
.fd-dlogo { position: relative; display: block; margin: 0; padding: 0; border: 0; background: transparent; aspect-ratio: 1; touch-action: pan-y; }
.fd-dlogo-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; }
.fd-dlogo-fallback {
  position: absolute; inset: 4%; margin: 0; padding: 0; border: 0; border-radius: 24%;
  background:
    radial-gradient(circle at 42% 44%, var(--fd-dlogo-a) 0 14%, transparent 26%),
    linear-gradient(160deg, var(--fd-dlogo-c), transparent 85%);
  -webkit-mask: radial-gradient(circle, #000 1.3px, transparent 1.8px) 0 0 / 4px 4px;
          mask: radial-gradient(circle, #000 1.3px, transparent 1.8px) 0 0 / 4px 4px;
}
`;

/* ───────────────────────── demo ───────────────────────── */

export function Demo() {
  return (
    <section className="fd-dlogo-demo">
      <style>{demoCss}</style>
      <header className="fd-dlogo-demo-nav">
        <span className="fd-dlogo-demo-brand">
          <DitherLogo className="fd-dlogo-demo-brandmark" label="Orbital dotted brand mark" spacing={1.5} dotScale={1.15} assemble={false} radius={12} strength={0.4} />
          Orbital
        </span>
        <nav className="fd-dlogo-demo-links" aria-label="Primary">
          <a href="#docs" onClick={(e) => e.preventDefault()}>Docs</a>
          <a href="#changelog" onClick={(e) => e.preventDefault()}>Changelog</a>
          <a href="#pricing" onClick={(e) => e.preventDefault()}>Pricing</a>
        </nav>
      </header>
      <div className="fd-dlogo-demo-grid">
        <div className="fd-dlogo-demo-copy">
          <p className="fd-dlogo-demo-tag">
            <span className="fd-dlogo-demo-dot" aria-hidden="true" /> Orbital 2.0 · Inference at the edge
          </p>
          <h1 className="fd-dlogo-demo-title">Ship models,<br />not servers.</h1>
          <p className="fd-dlogo-demo-body">
            Deploy any open-weight model to 38 regions with one command. Cold starts under 240&nbsp;ms, billed per token, observable down to the kernel.
          </p>
          <div className="fd-dlogo-demo-cmd">
            <span className="fd-dlogo-demo-prompt" aria-hidden="true">$</span>
            <code>npx orbital deploy llama-4-scout --regions all</code>
          </div>
          <dl className="fd-dlogo-demo-stats">
            <div><dt>p50 latency</dt><dd>41 ms</dd></div>
            <div><dt>Regions</dt><dd>38</dd></div>
            <div><dt>Uptime, 90d</dt><dd>99.995%</dd></div>
          </dl>
        </div>
        <div className="fd-dlogo-demo-stage">
          <DitherLogo className="fd-dlogo-demo-mark" label="Orbital logo" />
          <p className="fd-dlogo-demo-caption">Move your cursor through the mark</p>
        </div>
      </div>
    </section>
  );
}

const demoCss = `
.fd-dlogo-demo, .fd-dlogo-demo *, .fd-dlogo-demo *::before, .fd-dlogo-demo *::after { box-sizing: border-box; }
.fd-dlogo-demo {
  min-height: 100vh; margin: 0; padding: 0 clamp(20px, 5vw, 72px) 56px;
  background: radial-gradient(1200px 700px at 75% 45%, #15151C 0%, #0B0B0F 60%); color: #EDEDF2;
  font: 400 15px/1.5 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
}
.fd-dlogo-demo-nav { display: flex; align-items: center; justify-content: space-between; height: 72px; margin: 0; padding: 0; border-bottom: 1px solid rgba(255,255,255,.07); }
.fd-dlogo-demo-brand { display: inline-flex; align-items: center; gap: 10px; margin: 0; padding: 0; color: #EDEDF2; font: 600 17px/1 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.01em; }
.fd-dlogo-demo-brandmark.fd-dlogo { width: 28px; height: 28px; }
.fd-dlogo-demo-links { display: flex; gap: 28px; margin: 0; padding: 0; }
.fd-dlogo-demo-links a { margin: 0; padding: 0; color: #9A9AA6; text-decoration: none; font: 500 14px/1 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; transition: color 120ms cubic-bezier(0.22, 1, 0.36, 1); }
.fd-dlogo-demo-links a:hover { color: #EDEDF2; }
.fd-dlogo-demo-links a:focus-visible { outline: 2px solid rgba(10,132,255,.7); outline-offset: 2px; border-radius: 4px; }
.fd-dlogo-demo-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(24px, 5vw, 80px); align-items: center; max-width: 1240px; margin: 0 auto; padding: clamp(40px, 7vh, 96px) 0 0; }
.fd-dlogo-demo-tag { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 24px; padding: 6px 12px; border: 1px solid rgba(255,255,255,.1); border-radius: 9999px; background: rgba(255,255,255,.03); color: #C7C7D1; font: 500 13px/1.2 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: 0; }
.fd-dlogo-demo-dot { display: block; width: 6px; height: 6px; margin: 0; padding: 0; border-radius: 50%; background: #FF7A45; box-shadow: 0 0 0 3px rgba(255,122,69,.2); }
.fd-dlogo-demo-title { margin: 0 0 20px; padding: 0; color: #F5F5F8; letter-spacing: -0.045em; font: 650 clamp(2.75rem, 5.6vw, 5.5rem)/0.98 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", "Segoe UI", Roboto, sans-serif; }
.fd-dlogo-demo-body { max-width: 44ch; margin: 0 0 28px; padding: 0; color: #9A9AA6; font: 400 1.0625rem/1.55 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.01em; }
.fd-dlogo-demo-cmd { display: inline-flex; align-items: center; gap: 12px; max-width: 100%; margin: 0 0 36px; padding: 14px 18px; border: 1px solid rgba(255,255,255,.09); border-radius: 14px; background: #121218; overflow-x: auto; }
.fd-dlogo-demo-cmd code { margin: 0; padding: 0; background: none; color: #EDEDF2; font: 500 14px/1.2 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; white-space: nowrap; letter-spacing: 0; }
.fd-dlogo-demo-prompt { margin: 0; padding: 0; color: #FF7A45; font: 600 14px/1.2 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; }
.fd-dlogo-demo-stats { display: flex; gap: clamp(20px, 4vw, 48px); margin: 0; padding: 24px 0 0; border-top: 1px solid rgba(255,255,255,.07); }
.fd-dlogo-demo-stats div { margin: 0; padding: 0; }
.fd-dlogo-demo-stats dt { margin: 0 0 6px; padding: 0; color: #6B6B76; font: 500 12px/1.2 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.04em; text-transform: uppercase; }
.fd-dlogo-demo-stats dd { margin: 0; padding: 0; color: #EDEDF2; font: 600 24px/1.1 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.fd-dlogo-demo-copy { min-width: 0; margin: 0; padding: 0; }
.fd-dlogo-demo-stage { display: flex; flex-direction: column; align-items: center; gap: 12px; margin: 0; padding: 0; }
.fd-dlogo-demo-mark.fd-dlogo { width: min(100%, 480px); cursor: crosshair; }
.fd-dlogo-demo-caption { margin: 0; padding: 0; color: #55555F; font: 500 12px/1.2 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.04em; }
@media (max-width: 860px) {
  .fd-dlogo-demo-grid { grid-template-columns: minmax(0, 1fr); }
  .fd-dlogo-demo-stage { order: -1; }
  .fd-dlogo-demo-mark.fd-dlogo { width: min(100%, 320px); }
  .fd-dlogo-demo-links { display: none; }
  .fd-dlogo-demo-cmd { display: flex; }
  .fd-dlogo-demo-stats { flex-wrap: wrap; }
}
`;
