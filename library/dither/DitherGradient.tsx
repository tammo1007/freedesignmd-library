/**
 * DitherGradient, a slow, flowing mesh-gradient backdrop (domain-warped noise
 * fields) quantised through ordered dithering into 2–4 inks. Built for hero
 * sections: put any content inside as children.
 *
 * Props
 * - palette?: string[]   2–4 hex inks, darkest → lightest. Default deep pine → pale lichen.
 * - pixelSize?: number   Dither cell in CSS px. Default 3.
 * - algorithm?: "bayer4" | "bayer8" | "ign"   (ign = interleaved gradient noise, a cheap blue-ish noise). Default "bayer8".
 * - speed?: number       Flow speed multiplier. Default 1.
 * - scale?: number       Feature size; larger = bigger blobs. Default 1.
 * - glow?: [x, y]        Position (0–1) of a sun-like light pool; null to disable. Default [0.78, 0.28].
 * - interactive?: boolean  The light pool drifts toward the cursor. Default true.
 * - brightness?: number  −0.5…0.5 overall exposure. Default 0.
 * - shade?: number       0–1 darkens the left side for headline legibility. Default 0.
 * - children             Content rendered above the backdrop.
 * CSS vars: --fd-dgrad-fallback.
 *
 * Browser support: WebGL2 / WebGL1. Without WebGL a dotted CSS gradient is
 * shown. Reduced motion: one still frame, no cursor follow. The canvas is
 * aria-hidden; children carry the content.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject, ReactNode, RefObject } from "react";

/* ───────────────────────── tiny WebGL stage ───────────────────────── */

type GL = WebGLRenderingContext | WebGL2RenderingContext;
interface Stage {
  gl: GL;
  gl2: boolean;
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
  w: number;
  h: number;
  dpr: number;
  reduced: boolean;
}
interface StageHooks {
  setup?: (s: Stage) => void;
  /** Set uniforms; return true to keep animating. */
  frame: (s: Stage, time: number, dt: number) => boolean;
}

function createStage(canvas: HTMLCanvasElement, frag: string): Stage | null {
  const attrs: WebGLContextAttributes = { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" };
  let gl: GL | null = canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null;
  const gl2 = !!gl;
  if (!gl) gl = (canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs)) as WebGLRenderingContext | null;
  if (!gl) return null;
  const head = gl2 ? "#version 300 es\n" : "";
  const vs = head + (gl2 ? "#define attribute in\n" : "") + "attribute vec2 aP;void main(){gl_Position=vec4(aP,0.,1.);}";
  const fs =
    head +
    "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n" +
    (gl2 ? "#define texture2D texture\n#define gl_FragColor fdOut\nout vec4 fdOut;\n" : "") +
    frag;
  const make = (type: number, src: string) => {
    const s = gl!.createShader(type);
    if (!s) return null;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
      console.warn("[fd-shader]", gl!.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const v = make(gl.VERTEX_SHADER, vs);
  const f = make(gl.FRAGMENT_SHADER, fs);
  const prog = gl.createProgram();
  if (!v || !f || !prog) return null;
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  gl.bindAttribLocation(prog, 0, "aP");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const u: Stage["u"] = {};
  for (const m of frag.matchAll(/uniform\s+\w+\s+(\w+)/g)) u[m[1]] = gl.getUniformLocation(prog, m[1]);
  return { gl, gl2, prog, u, w: 1, h: 1, dpr: 1, reduced: false };
}

function useStage(ref: RefObject<HTMLCanvasElement | null>, frag: string, hooks: MutableRefObject<StageHooks>, maxDpr = 2) {
  const [failed, setFailed] = useState(false);
  const kick = useRef<() => void>(() => {});
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let stage: Stage | null = null;
    let raf = 0;
    let last = 0;
    let time = 0;
    let visible = true;
    let alive = true;
    const loop = (now: number) => {
      raf = 0;
      if (!stage || !alive) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      if (!reduced) time += dt;
      const more = hooks.current.frame(stage, time, dt);
      stage.gl.drawArrays(stage.gl.TRIANGLES, 0, 3);
      if (more && !reduced && visible && !document.hidden) raf = requestAnimationFrame(loop);
      else last = 0;
    };
    const request = () => {
      if (!raf && alive && stage) raf = requestAnimationFrame(loop);
    };
    const resize = () => {
      if (!stage) return;
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      stage.w = w;
      stage.h = h;
      stage.dpr = dpr;
      stage.gl.viewport(0, 0, w, h);
      request();
    };
    const init = () => {
      stage = createStage(canvas, frag);
      if (!stage) {
        setFailed(true);
        return;
      }
      stage.reduced = reduced;
      hooks.current.setup?.(stage);
      resize();
    };
    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      raf = 0;
      stage = null;
    };
    const onRestored = () => init();
    const onVis = () => !document.hidden && request();
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    document.addEventListener("visibilitychange", onVis);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) request();
    });
    io.observe(canvas);
    kick.current = request;
    init();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.removeEventListener("visibilitychange", onVis);
      kick.current = () => {};
    };
  }, [ref, frag, hooks, maxDpr]);
  return { failed, kick };
}

function makeTexture(gl: GL, filter: number, wrap: number) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return t;
}

const hexToRgb = (hex: string): [number, number, number] => {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/* ───────────────────────── shader ───────────────────────── */

const FRAG = /* glsl */ `
uniform vec2 uRes;
uniform float uTime;
uniform float uPx;
uniform float uAlgo;
uniform vec3 uPal[4];
uniform float uN;
uniform float uScale;
uniform vec3 uGlow;
uniform float uBright;
uniform float uShade;

float bayer2(vec2 a){ a = floor(a); return fract(a.x * .5 + a.y * a.y * .75); }
float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(.5 * a) * .25 + bayer2(a); }

vec2 hash2(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1. + 2. * fract(sin(p) * 43758.5453);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
             mix(dot(hash2(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  mat2 r = mat2(.8, .6, -.6, .8);
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = r * p * 2.03 + 11.7; a *= .5; }
  return v;
}

vec3 pal(float i){
  vec3 c = uPal[0];
  c = mix(c, uPal[1], step(.5, i));
  c = mix(c, uPal[2], step(1.5, i));
  c = mix(c, uPal[3], step(2.5, i));
  return c;
}

void main(){
  vec2 id = floor(gl_FragCoord.xy / uPx);
  vec2 c = (id + .5) * uPx;
  vec2 uv = c / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp, uv.y) * (1.6 / uScale);
  float t = uTime * .06;

  // two-level domain warp → soft, liquid "mesh gradient" bands
  vec2 q = vec2(fbm(p + vec2(0., t)), fbm(p + vec2(5.2, 1.3) - t * .7));
  vec2 r = vec2(fbm(p + 1.8 * q + vec2(1.7, 9.2) + t * .5), fbm(p + 1.8 * q + vec2(8.3, 2.8) - t * .3));
  float f = fbm(p + 2.2 * r);
  float l = .5 + f * 1.15 + .25 * length(q) - .1;

  // vertical atmosphere: darker toward the bottom for legibility
  l += (uv.y - .5) * .35 + uBright;
  // optional shade on the copy side (left), keeps headlines legible
  // on portrait screens copy spans the full width, so the shade widens to cover it
  float reach = mix(.62, 1.7, step(asp, 1.));
  l -= uShade * (1. - smoothstep(.0, reach, uv.x)) * .55;

  // light pool
  if (uGlow.z > 0.) {
    vec2 g = vec2((uv.x - uGlow.x) * asp, uv.y - uGlow.y);
    float d = length(g);
    l += uGlow.z * (.38 * exp(-d * d * 14.) + .14 * exp(-d * 2.6));
  }
  // soft shoulder so highlights roll off instead of clipping to a flat ink
  l = clamp(l, 0., 1.25);
  l = l / (1. + max(l - .85, 0.) * 1.6);
  l = clamp(l, 0., 1.);

  float th;
  if (uAlgo < .5) th = bayer4(id) + .03125;
  else if (uAlgo < 1.5) th = bayer8(id) + .0078125;
  else th = fract(52.9829189 * fract(dot(id, vec2(.06711056, .00583715))));

  float n = uN - 1.;
  float v = l * n;
  float idx = min(floor(v) + step(th, fract(v)), n);
  gl_FragColor = vec4(pal(idx), 1.);
}
`;

/* ───────────────────────── component ───────────────────────── */

export interface DitherGradientProps {
  palette?: string[];
  pixelSize?: number;
  algorithm?: "bayer4" | "bayer8" | "ign";
  speed?: number;
  scale?: number;
  glow?: [number, number] | null;
  interactive?: boolean;
  brightness?: number;
  shade?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const ALGOS = { bayer4: 0, bayer8: 1, ign: 2 };

export function DitherGradient({
  palette = ["#0B1A14", "#1E4D3A", "#7FA77A", "#E4EDC9"],
  pixelSize = 3,
  algorithm = "bayer8",
  speed = 1,
  scale = 1,
  glow = [0.78, 0.28],
  interactive = true,
  brightness = 0,
  shade = 0,
  className,
  style,
  children,
}: DitherGradientProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const props = useRef({ palette, pixelSize, algorithm, speed, scale, glow, interactive, brightness, shade });
  props.current = { palette, pixelSize, algorithm, speed, scale, glow, interactive, brightness, shade };
  const g = useRef({ x: glow?.[0] ?? 0.5, y: glow?.[1] ?? 0.5, tx: -1, ty: -1, t: 0 });

  const hooks = useRef<StageHooks>({
    frame(s, _time, dt) {
      const { gl, u } = s;
      const p = props.current;
      const gs = g.current;
      if (!s.reduced) gs.t += dt * p.speed;
      const homeX = p.glow?.[0] ?? 0.5;
      const homeY = p.glow?.[1] ?? 0.5;
      const tx = gs.tx >= 0 && p.interactive ? homeX + (gs.tx - homeX) * 0.35 : homeX;
      const ty = gs.ty >= 0 && p.interactive ? homeY + (gs.ty - homeY) * 0.35 : homeY;
      const k = s.reduced ? 1 : 1 - Math.exp(-dt * 1.6);
      gs.x += (tx - gs.x) * k;
      gs.y += (ty - gs.y) * k;
      const pal = p.palette.slice(0, 4);
      while (pal.length < 2) pal.push("#ffffff");
      const flat: number[] = [];
      for (let i = 0; i < 4; i++) flat.push(...hexToRgb(pal[Math.min(i, pal.length - 1)]));
      gl.uniform2f(u.uRes, s.w, s.h);
      gl.uniform1f(u.uTime, gs.t + 20);
      gl.uniform1f(u.uPx, Math.max(1, Math.round(p.pixelSize * s.dpr)));
      gl.uniform1f(u.uAlgo, ALGOS[p.algorithm] ?? 1);
      gl.uniform3fv(u.uPal, new Float32Array(flat));
      gl.uniform1f(u.uN, pal.length);
      gl.uniform1f(u.uScale, p.scale);
      gl.uniform3f(u.uGlow, gs.x, 1 - gs.y, p.glow ? 1 : 0);
      gl.uniform1f(u.uBright, p.brightness);
      gl.uniform1f(u.uShade, p.shade);
      return true;
    },
  });
  // Dither cells are chunky, so render at DPR 1 when pixelSize ≥ 2, same look, ¼ the fragments.
  const { failed, kick } = useStage(canvasRef, FRAG, hooks, pixelSize >= 2 ? 1 : 2);

  useEffect(() => kick.current(), [palette.join(), pixelSize, algorithm, scale, glow?.[0], glow?.[1], brightness, shade, kick]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !interactive) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      g.current.tx = (e.clientX - r.left) / r.width;
      g.current.ty = (e.clientY - r.top) / r.height;
    };
    const leave = () => {
      g.current.tx = -1;
      g.current.ty = -1;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [interactive]);

  const fallback = `radial-gradient(60% 70% at ${(glow?.[0] ?? 0.5) * 100}% ${(glow?.[1] ?? 0.5) * 100}%, ${palette[palette.length - 1]} 0%, ${palette[Math.min(2, palette.length - 1)]} 30%, ${palette[1] ?? palette[0]} 60%, ${palette[0]} 100%)`;

  return (
    <div ref={rootRef} className={`fd-dgrad${className ? " " + className : ""}`} style={{ ["--fd-dgrad-fallback" as string]: fallback, ["--fd-dgrad-base" as string]: palette[0], ...style }}>
      <style>{css}</style>
      {failed ? <div className="fd-dgrad-fallback" aria-hidden="true" /> : <canvas ref={canvasRef} className="fd-dgrad-canvas" aria-hidden="true" />}
      <div className="fd-dgrad-content">{children}</div>
    </div>
  );
}

const css = `
.fd-dgrad, .fd-dgrad *, .fd-dgrad *::before, .fd-dgrad *::after { box-sizing: border-box; }
.fd-dgrad { position: relative; display: block; margin: 0; padding: 0; border: 0; overflow: hidden; background: var(--fd-dgrad-base); color: inherit; isolation: isolate; }
.fd-dgrad-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; image-rendering: pixelated; z-index: 0; }
.fd-dgrad-fallback { position: absolute; inset: 0; margin: 0; padding: 0; border: 0; z-index: 0; background: var(--fd-dgrad-fallback); }
.fd-dgrad-fallback::after {
  content: ""; position: absolute; inset: 0; background: var(--fd-dgrad-base); opacity: .55;
  -webkit-mask: radial-gradient(circle, transparent 1px, #000 1.6px) 0 0 / 3px 3px;
          mask: radial-gradient(circle, transparent 1px, #000 1.6px) 0 0 / 3px 3px;
}
.fd-dgrad-content { position: relative; z-index: 1; margin: 0; padding: 0; }
`;

/* ───────────────────────── demo ───────────────────────── */

export function Demo() {
  return (
    <DitherGradient className="fd-dgrad-demo" shade={0.7} brightness={-0.04}>
      <style>{demoCss}</style>
      <header className="fd-dgrad-demo-nav">
        <span className="fd-dgrad-demo-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M5 15c3-1 4-6 7-6s4 5 7 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Canopy Grid
        </span>
        <span className="fd-dgrad-demo-status">
          <span className="fd-dgrad-demo-pulse" aria-hidden="true" /> Live · 2.41 GW flowing
        </span>
      </header>
      <div className="fd-dgrad-demo-hero">
        <p className="fd-dgrad-demo-kicker">Community solar for the Nordics</p>
        <h1 className="fd-dgrad-demo-title">Power that grows<br />where you live.</h1>
        <p className="fd-dgrad-demo-body">
          Subscribe to a share of a solar farm near you. Canopy feeds clean kilowatt-hours straight into your local grid, no roof, no installer, 12% off your bill from the first month.
        </p>
        <div className="fd-dgrad-demo-actions">
          <a className="fd-dgrad-demo-primary" href="#join" onClick={(e) => e.preventDefault()}>Check your postcode</a>
          <a className="fd-dgrad-demo-secondary" href="#farms" onClick={(e) => e.preventDefault()}>See our 14 farms →</a>
        </div>
      </div>
      <dl className="fd-dgrad-demo-stats">
        <div><dt>Households powered</dt><dd>186,420</dd></div>
        <div><dt>CO₂ avoided, 2026</dt><dd>212 kt</dd></div>
        <div><dt>Avg. saving / yr</dt><dd>€318</dd></div>
      </dl>
    </DitherGradient>
  );
}

const demoCss = `
.fd-dgrad-demo { min-height: 100vh; }
.fd-dgrad-demo .fd-dgrad-content {
  display: flex; flex-direction: column; min-height: 100vh; margin: 0; padding: 0 clamp(20px, 5vw, 72px);
  color: #F2F6E6; font: 400 15px/1.5 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
}
.fd-dgrad-demo-nav { display: flex; align-items: center; justify-content: space-between; height: 76px; margin: 0; padding: 0; }
.fd-dgrad-demo-logo { display: inline-flex; align-items: center; gap: 10px; margin: 0; padding: 0; color: #F2F6E6; font: 650 17px/1 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.01em; }
.fd-dgrad-demo-logo svg { display: block; }
.fd-dgrad-demo-status { display: inline-flex; align-items: center; gap: 8px; margin: 0; padding: 7px 12px; border-radius: 9999px; background: rgba(11, 26, 20, .72); color: #E4EDC9; font: 500 12px/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.02em; }
.fd-dgrad-demo-pulse { display: block; width: 7px; height: 7px; margin: 0; padding: 0; border-radius: 50%; background: #B9E06A; box-shadow: 0 0 0 0 rgba(185,224,106,.6); animation: fd-dgrad-pulse 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
@keyframes fd-dgrad-pulse { 0% { box-shadow: 0 0 0 0 rgba(185,224,106,.55); } 100% { box-shadow: 0 0 0 10px rgba(185,224,106,0); } }
.fd-dgrad-demo-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; max-width: 760px; margin: 0; padding: clamp(32px, 8vh, 96px) 0; }
.fd-dgrad-demo-kicker { margin: 0 0 20px; padding: 0; color: #CFE0A8; font: 600 13px/1.3 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.1em; text-transform: uppercase; text-shadow: 0 1px 12px rgba(11,26,20,.7); }
.fd-dgrad-demo-title { margin: 0 0 24px; padding: 0; color: #F7FAEE; letter-spacing: -0.045em; font: 700 clamp(3rem, 7.4vw, 6.75rem)/0.94 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", "Segoe UI", Roboto, sans-serif; text-shadow: 0 2px 40px rgba(11,26,20,.55); }
.fd-dgrad-demo-body { max-width: 50ch; margin: 0 0 36px; padding: 0; color: #E2EBD2; font: 400 1.0625rem/1.55 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.01em; text-shadow: 0 1px 16px rgba(11,26,20,.9); }
.fd-dgrad-demo-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; margin: 0; padding: 0; }
.fd-dgrad-demo-primary { display: inline-flex; align-items: center; height: 52px; margin: 0; padding: 0 26px; border: 0; border-radius: 9999px; background: #E4EDC9; color: #0B1A14; text-decoration: none; font: 650 0.9375rem/1 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.01em; transition: transform 120ms cubic-bezier(0.22, 1, 0.36, 1), background 120ms cubic-bezier(0.22, 1, 0.36, 1); }
.fd-dgrad-demo-primary:hover { background: #FFFFFF; }
.fd-dgrad-demo-primary:active { transform: scale(0.96); }
.fd-dgrad-demo-secondary { margin: 0; padding: 0; color: #F2F6E6; text-decoration: none; font: 550 0.9375rem/1 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; text-shadow: 0 1px 12px rgba(11,26,20,.8); }
.fd-dgrad-demo-secondary:hover { text-decoration: underline; text-underline-offset: 4px; }
.fd-dgrad-demo-primary:focus-visible, .fd-dgrad-demo-secondary:focus-visible { outline: 2px solid rgba(228,237,201,.7); outline-offset: 2px; }
.fd-dgrad-demo-stats { display: grid; grid-template-columns: repeat(3, minmax(0, max-content)); gap: clamp(20px, 6vw, 88px); margin: 0 0 40px; padding: 20px 24px; border-radius: 20px; background: rgba(11, 26, 20, .82); width: max-content; max-width: 100%; }
.fd-dgrad-demo-stats div { margin: 0; padding: 0; }
.fd-dgrad-demo-stats dt { margin: 0 0 6px; padding: 0; color: #8FAF8A; font: 500 12px/1.2 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.04em; text-transform: uppercase; }
.fd-dgrad-demo-stats dd { margin: 0; padding: 0; color: #F2F6E6; font: 650 24px/1.1 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
@media (max-width: 640px) {
  .fd-dgrad-demo-stats { grid-template-columns: 1fr 1fr; width: auto; }
  .fd-dgrad-demo-status { display: none; }
}
@media (prefers-reduced-motion: reduce) { .fd-dgrad-demo-pulse { animation: none; } }
`;
