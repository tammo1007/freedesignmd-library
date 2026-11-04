/**
 * LiquidMetalButton, a capsule CTA whose rim (or whole body) is live liquid
 * chrome. A WebGL canvas renders the metal behind a CSS-masked capsule so the
 * label stays crisp DOM text. Pressing sends a ripple out from the touch point.
 *
 * Also exports MetalButtonCSS, a zero-JS fallback with conic/linear chrome
 * gradients and an animated specular sweep. Same API, works everywhere.
 *
 * Props (both)
 * - variant?: "rim" | "solid"   Metal only on the ring, or the whole button. Default "rim".
 * - tint?: "silver" | "gold" | "titanium" | "black-chrome". Default "silver".
 * - size?: "md" | "lg". Default "lg".
 * - icon?: ReactNode            Trailing icon.
 * - plus every native <button> prop.
 * CSS vars: --fd-lmbtn-ring (rim thickness), --fd-lmbtn-face (inner fill), --fd-lmbtn-ink (label colour).
 *
 * Browser support: WebGL2 / WebGL1; without WebGL the CSS chrome is used.
 * Accessibility: native <button>, visible focus ring; canvas is aria-hidden.
 * Reduced motion: still metal, no ripple, no sweep.
 */
import { forwardRef, useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties, MutableRefObject, ReactNode, RefObject } from "react";

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
uniform vec4 uRip;     // px x, px y, age, amp
uniform float uHover;
uniform float uTint;

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
float height(vec2 px){
  vec2 p = px / uRes.y * 1.6;
  float t = uTime * (.25 + uHover * .35);
  vec2 w = vec2(noise(p + vec2(t, 0.)), noise(p + vec2(3.1, -t)));
  float h = noise(p * 1.2 + w * 1.4) + .5 * sin(p.x * 1.4 - t * 1.6 + w.y * 3.);
  float d = length(px - uRip.xy) / uRes.y;
  float x = d - uRip.z * 3.2;
  h += uRip.w * sin(x * 18.) * exp(-x * x * 30.) * exp(-uRip.z * 2.2);
  return h;
}
vec3 studio(vec3 r){
  float el = r.y;
  vec3 sky = mix(vec3(.55, .57, .62), vec3(1.), smoothstep(-.1, .8, el));
  vec3 fl = mix(vec3(.03), vec3(.18, .17, .16), smoothstep(-1., -.3, el));
  vec3 c = mix(fl, sky, smoothstep(-.12, -.06, el));
  c += .6 * exp(-pow((el + .06) / .04, 2.));
  c += 1.1 * smoothstep(.1, 0., abs(r.x + .5) - .2) * smoothstep(.1, 0., abs(el - .4) - .2);
  return c;
}
void main(){
  vec2 px = gl_FragCoord.xy;
  float e = 1.5;
  float h = height(px);
  vec2 g = vec2(height(px + vec2(e, 0.)) - h, height(px + vec2(0., e)) - h) / e * uRes.y * .18;
  vec3 n = normalize(vec3(-g, 1.));
  // capsule geometry adds a convex bevel so the ring reads as a tube
  vec2 c = px - .5 * uRes;
  float R = .5 * uRes.y;
  vec2 q = vec2(max(abs(c.x) - (.5 * uRes.x - R), 0.), c.y);
  vec2 bevel = q / R;
  n = normalize(n + vec3(bevel * .9, 0.));
  vec3 v = vec3(0., 0., -1.);
  vec3 r = reflect(v, n);
  vec3 env = studio(r);
  vec3 tint = uTint < .5 ? vec3(.97) : uTint < 1.5 ? vec3(1., .8, .46) : uTint < 2.5 ? vec3(.8, .82, .86) : vec3(.5);
  vec3 col = env * tint;
  if (uTint > 2.5) col = pow(env, vec3(1.6)) * .6 + .02;
  col = col / (1. + col * .25) * 1.15;
  gl_FragColor = vec4(col, 1.);
}
`;

/* ───────────────────────── components ───────────────────────── */

type Tint = "silver" | "gold" | "titanium" | "black-chrome";
const TINTS: Record<Tint, number> = { silver: 0, gold: 1, titanium: 2, "black-chrome": 3 };

export interface LiquidMetalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "rim" | "solid";
  tint?: Tint;
  size?: "md" | "lg";
  icon?: ReactNode;
}

export const LiquidMetalButton = forwardRef<HTMLButtonElement, LiquidMetalButtonProps>(function LiquidMetalButton(
  { variant = "rim", tint = "silver", size = "lg", icon, className, style, children, type = "button", onPointerDown, onPointerEnter, onPointerLeave, ...rest },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef({ t: 0, hover: 0, thover: 0, rip: { x: 0, y: 0, age: 9, amp: 0 }, tint });
  st.current.tint = tint;

  const hooks = useRef<StageHooks>({
    frame(s, _time, dt) {
      const { gl, u } = s;
      const S = st.current;
      S.hover += (S.thover - S.hover) * (1 - Math.exp(-dt * 6));
      if (!s.reduced) S.t += dt;
      S.rip.age += dt;
      gl.uniform2f(u.uRes, s.w, s.h);
      gl.uniform1f(u.uTime, S.t + 3);
      gl.uniform4f(u.uRip, S.rip.x * s.dpr, s.h - S.rip.y * s.dpr, S.rip.age, S.rip.age < 2 ? S.rip.amp : 0);
      gl.uniform1f(u.uHover, S.hover);
      gl.uniform1f(u.uTint, TINTS[S.tint] ?? 0);
      return true;
    },
  });
  const { failed, kick } = useStage(canvasRef, FRAG, hooks);
  useEffect(() => kick.current(), [tint, kick]);

  if (failed) {
    return (
      <MetalButtonCSS ref={ref} variant={variant} tint={tint} size={size} icon={icon} className={className} style={style} type={type} onPointerDown={onPointerDown} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} {...rest}>
        {children}
      </MetalButtonCSS>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={`fd-lmbtn${className ? " " + className : ""}`}
      data-variant={variant}
      data-size={size}
      data-tint={tint}
      style={style}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        st.current.rip = { x: e.clientX - r.left, y: e.clientY - r.top, age: 0, amp: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 0.9 };
        kick.current();
        onPointerDown?.(e);
      }}
      onPointerEnter={(e) => {
        st.current.thover = 1;
        onPointerEnter?.(e);
      }}
      onPointerLeave={(e) => {
        st.current.thover = 0;
        onPointerLeave?.(e);
      }}
      {...rest}
    >
      <style>{css}</style>
      <canvas ref={canvasRef} className="fd-lmbtn-metal" aria-hidden="true" />
      <span className="fd-lmbtn-face" aria-hidden="true" />
      <span className="fd-lmbtn-label">
        {children}
        {icon ? <span className="fd-lmbtn-icon">{icon}</span> : null}
      </span>
    </button>
  );
});

/** CSS-only chrome capsule: conic + linear gradients and a specular sweep. No JS, no WebGL. */
export const MetalButtonCSS = forwardRef<HTMLButtonElement, LiquidMetalButtonProps>(function MetalButtonCSS(
  { variant = "rim", tint = "silver", size = "lg", icon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={`fd-lmbtn fd-lmbtn-css${className ? " " + className : ""}`} data-variant={variant} data-size={size} data-tint={tint} {...rest}>
      <style>{css}</style>
      <span className="fd-lmbtn-chrome" aria-hidden="true" />
      <span className="fd-lmbtn-face" aria-hidden="true" />
      <span className="fd-lmbtn-label">
        {children}
        {icon ? <span className="fd-lmbtn-icon">{icon}</span> : null}
      </span>
    </button>
  );
});

const css = `
.fd-lmbtn, .fd-lmbtn *, .fd-lmbtn *::before, .fd-lmbtn *::after { box-sizing: border-box; }
.fd-lmbtn {
  --fd-lmbtn-ring: 3px;
  --fd-lmbtn-face: #0E0E11;
  --fd-lmbtn-ink: #F5F5F7;
  --fd-lmbtn-h: 56px;
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  appearance: none; -webkit-appearance: none;
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  height: var(--fd-lmbtn-h); margin: 0; padding: 0 32px; border: 0; border-radius: 9999px;
  background: #5c5f66; color: var(--fd-lmbtn-ink); cursor: pointer; isolation: isolate; overflow: hidden;
  font: 600 1.0625rem/1 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  letter-spacing: -0.01em; text-decoration: none; text-transform: none; white-space: nowrap;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  box-shadow: 0 1px 1px rgba(0,0,0,.25), 0 10px 30px -10px rgba(0,0,0,.55);
  transition: transform 120ms var(--fd-ease-out), box-shadow 240ms var(--fd-ease-out);
}
.fd-lmbtn[data-size="md"] { --fd-lmbtn-h: 44px; padding: 0 22px; font-size: 0.9375rem; --fd-lmbtn-ring: 2px; }
.fd-lmbtn:hover { box-shadow: 0 1px 1px rgba(0,0,0,.25), 0 16px 40px -12px rgba(0,0,0,.6); }
.fd-lmbtn:active { transform: scale(0.96); }
.fd-lmbtn:not(:active) { transition-timing-function: var(--fd-spring), var(--fd-ease-out); }
.fd-lmbtn:focus-visible { outline: 2px solid rgba(10,132,255,.7); outline-offset: 2px; }
.fd-lmbtn:disabled { cursor: not-allowed; opacity: .5; }
.fd-lmbtn-metal, .fd-lmbtn-chrome { position: absolute; inset: 0; display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; border-radius: inherit; z-index: 0; }
.fd-lmbtn-face {
  position: absolute; inset: var(--fd-lmbtn-ring); display: block; margin: 0; padding: 0; border: 0;
  border-radius: 9999px; z-index: 1; background: var(--fd-lmbtn-face);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), inset 0 -8px 16px rgba(0,0,0,.35);
}
.fd-lmbtn[data-variant="solid"] { --fd-lmbtn-ink: #101114; }
.fd-lmbtn[data-variant="solid"] .fd-lmbtn-face {
  inset: 0; background: linear-gradient(180deg, rgba(255,255,255,.62), rgba(236,238,242,.42) 50%, rgba(255,255,255,.55));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.4), inset 0 1px 0 rgba(255,255,255,.85), inset 0 -1px 0 rgba(0,0,0,.15);
}
.fd-lmbtn[data-variant="solid"][data-tint="gold"] .fd-lmbtn-face { background: linear-gradient(180deg, rgba(255,246,222,.6), rgba(240,214,150,.38) 50%, rgba(255,240,200,.55)); }
.fd-lmbtn[data-variant="solid"][data-tint="black-chrome"] .fd-lmbtn-face { background: linear-gradient(180deg, rgba(20,21,24,.55), rgba(8,8,10,.4) 50%, rgba(20,21,24,.6)); box-shadow: inset 0 0 0 1px rgba(255,255,255,.12), inset 0 1px 0 rgba(255,255,255,.25); }
.fd-lmbtn[data-variant="solid"] .fd-lmbtn-label { text-shadow: 0 1px 0 rgba(255,255,255,.55); }
.fd-lmbtn[data-variant="solid"][data-tint="black-chrome"] { --fd-lmbtn-ink: #F5F5F7; }
.fd-lmbtn[data-variant="solid"][data-tint="black-chrome"] .fd-lmbtn-label { text-shadow: 0 1px 1px rgba(0,0,0,.6); }
.fd-lmbtn-label { position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 10px; margin: 0; padding: 0; color: var(--fd-lmbtn-ink); font: inherit; letter-spacing: inherit; }
.fd-lmbtn-icon { display: inline-flex; margin: 0; padding: 0; transition: transform 240ms var(--fd-ease-out); }
.fd-lmbtn-icon svg { display: block; }
.fd-lmbtn:hover .fd-lmbtn-icon { transform: translateX(3px); }

/* CSS chrome */
.fd-lmbtn-chrome {
  background:
    linear-gradient(180deg, rgba(255,255,255,.0) 0 46%, rgba(0,0,0,.55) 50%, rgba(255,255,255,.0) 64%),
    conic-gradient(from 200deg at 50% 50%, #f9fafb, #8a8e96 12%, #f4f5f7 22%, #2a2b2f 34%, #c9ccd2 46%, #fdfdfd 58%, #61646b 70%, #e7e9ec 82%, #3a3c41 92%, #f9fafb);
}
.fd-lmbtn-css[data-tint="gold"] .fd-lmbtn-chrome { background:
    linear-gradient(180deg, rgba(255,255,255,0) 0 46%, rgba(40,24,0,.5) 50%, rgba(255,255,255,0) 64%),
    conic-gradient(from 200deg at 50% 50%, #fff4d6, #a87a33 12%, #fff1c9 22%, #3d2a0f 34%, #e2bd72 46%, #fff8e6 58%, #80602a 70%, #f5d996 82%, #4d3712 92%, #fff4d6); }
.fd-lmbtn-css[data-tint="titanium"] .fd-lmbtn-chrome { background:
    linear-gradient(180deg, rgba(255,255,255,0) 0 46%, rgba(0,0,0,.5) 50%, rgba(255,255,255,0) 64%),
    conic-gradient(from 200deg at 50% 50%, #e9ecf0, #737a85 12%, #e1e5ea 22%, #23262c 34%, #aeb5bf 46%, #f3f5f8 58%, #525862 70%, #d6dbe2 82%, #30343a 92%, #e9ecf0); }
.fd-lmbtn-css[data-tint="black-chrome"] .fd-lmbtn-chrome { background:
    linear-gradient(180deg, rgba(255,255,255,0) 0 46%, rgba(0,0,0,.6) 50%, rgba(255,255,255,0) 64%),
    conic-gradient(from 200deg at 50% 50%, #7d8087, #121316 12%, #6a6d74 22%, #040405 34%, #3f4248 46%, #9a9da4 58%, #17181b 70%, #55585e 82%, #08090a 92%, #7d8087); }
.fd-lmbtn-chrome::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(105deg, transparent 0 35%, rgba(255,255,255,.85) 48%, transparent 60%);
  background-size: 260% 100%; background-position: 120% 0; mix-blend-mode: overlay;
  animation: fd-lmbtn-sweep 3.6s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}
@keyframes fd-lmbtn-sweep { 0%, 30% { background-position: 120% 0; } 70%, 100% { background-position: -20% 0; } }
@media (prefers-reduced-motion: reduce) {
  .fd-lmbtn-chrome::after { animation: none; }
  .fd-lmbtn, .fd-lmbtn-icon { transition: none; }
}
@media (prefers-contrast: more) { .fd-lmbtn-face { box-shadow: inset 0 0 0 1px #fff; } }
`;

/* ───────────────────────── demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-lmbtnd">
      <style>{demoCss}</style>
      <LiquidMetalButton>Continue</LiquidMetalButton>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-lmbtnd,.fd-lmbtnd *,.fd-lmbtnd *::before,.fd-lmbtnd *::after{box-sizing:border-box}
.fd-lmbtnd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;background:#f2f2f2}
`;
