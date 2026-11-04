/**
 * LiquidMetal, a flowing chrome surface. Domain-warped noise drives a height
 * field; its normals reflect a procedural studio environment (soft boxes,
 * horizon line, floor bounce) with Fresnel and an optional thin-film
 * iridescence. The cursor bulges the surface and taps send out ripples.
 *
 * Props
 * - tint?: "silver" | "gold" | "titanium" | "black-chrome" | "iridescent". Default "silver".
 * - speed?: number        Flow speed multiplier. Default 1.
 * - distortion?: number   Warp amount 0–2. Default 1.
 * - scale?: number        Feature size; larger = broader pools. Default 1.
 * - interactive?: boolean Cursor bulge + tap ripples. Default true.
 * - quality?: number      Max render DPR (metal is smooth; 1.5 looks identical to 2 at ~half the cost). Default 1.5.
 * - children              Content rendered above the surface.
 * CSS vars: --fd-lmetal-radius, --fd-lmetal-fallback.
 *
 * Browser support: WebGL2 / WebGL1. Without WebGL an animated CSS chrome
 * gradient is shown. Reduced motion: a single still frame; no ripples.
 * The canvas is aria-hidden.
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
uniform float uDist;
uniform float uScale;
uniform vec3 uPtr;      // px x, px y, strength
uniform vec4 uRip[4];   // px x, px y, age (s), amplitude
uniform float uTint;
uniform float uDpr;

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

float height(vec2 p, vec2 px){
  float t = uTime * .11;
  // two-octave warp field
  vec2 w = vec2(noise(p * .7 + vec2(t, -t * .7)) + .5 * noise(p * 1.4 - t),
                noise(p * .7 + vec2(-t * .8, t) + 5.2) + .5 * noise(p * 1.4 + t + 3.1));
  vec2 q = p + uDist * 1.1 * w;
  float h = noise(q * .9 + t * .4) + .4 * noise(q * 1.9 - t * .3) + .14 * noise(q * 4.1 + t * .2);
  // long liquid bands, the signature of poured chrome
  h += .45 * sin(q.x * .9 + q.y * .45 + h * 2.2 + t * 2.);

  // cursor bulge
  vec2 dp = (px - uPtr.xy) / uDpr;
  float d2 = dot(dp, dp);
  h += uPtr.z * .9 * exp(-d2 / 9000.);
  // tap ripples
  for (int i = 0; i < 4; i++) {
    vec4 r = uRip[i];
    if (r.w <= 0.) continue;
    float d = length(px - r.xy) / uDpr;
    float front = r.z * 420.;
    float x = d - front;
    h += r.w * sin(x * .06) * exp(-x * x / 5200.) * exp(-r.z * 1.4);
  }
  return h;
}

vec3 studio(vec3 r){
  // r: reflected direction, z toward viewer, y up
  float el = r.y;
  float az = atan(r.x, r.z);
  // the wall behind the camera: graded charcoal → pale, so flat metal reads moody, not grey
  vec3 sky = mix(vec3(.3, .31, .34), vec3(.92, .93, .96), smoothstep(0., .7, el + .3 * abs(az)));
  vec3 floorC = mix(vec3(.02, .021, .025), vec3(.14, .13, .12), smoothstep(-1., -.3, el));
  vec3 c = mix(floorC, sky, smoothstep(-.12, -.06, el));
  // bright cyc sweep right above the horizon
  c += vec3(1.) * .7 * exp(-pow((el + .04) / .03, 2.));
  // soft boxes: a big key left, a strip right, a top light
  float b1 = smoothstep(.08, 0., abs(az + .55) - .2) * smoothstep(.06, 0., abs(el - .35) - .22);
  float b2 = smoothstep(.04, 0., abs(az - .62) - .07) * smoothstep(.05, 0., abs(el - .18) - .3);
  float b3 = smoothstep(.15, 0., abs(el - .9) - .05);
  c += vec3(1.5) * b1 + vec3(1.2) * b2 + vec3(.7) * b3;
  // dark flags give chrome its deep contrast bands
  c *= 1. - .85 * smoothstep(.06, 0., abs(az - .3) - .05) * smoothstep(-.05, .1, el);
  c *= 1. - .6 * smoothstep(.06, 0., abs(az + 1.25) - .1) * smoothstep(-.05, .1, el);
  return c;
}

vec3 tintOf(float k, out float black){
  black = 0.;
  if (k < .5) return vec3(.96, .965, .975);          // silver
  if (k < 1.5) return vec3(1., .78, .42);            // gold
  if (k < 2.5) return vec3(.78, .8, .84);            // titanium
  if (k < 3.5) { black = 1.; return vec3(.55, .56, .6); } // black chrome
  return vec3(.95);                                   // iridescent base
}

void main(){
  vec2 px = gl_FragCoord.xy;
  float m = min(uRes.x, uRes.y);
  vec2 p = (px - .5 * uRes) / m * 1.7 / uScale;
  float e = 1.5 / m;
  float h = height(p, px);
  float hx = height(p + vec2(e, 0.), px + vec2(1.5, 0.));
  float hy = height(p + vec2(0., e), px + vec2(0., 1.5));
  vec3 n = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.) * vec3(.26, .26, 1.));

  // slight perspective so the top of the frame "looks" further away
  vec2 sp = (px / uRes - .5);
  vec3 v = normalize(vec3(sp.x * .35, sp.y * .35 + .1, -1.));
  vec3 r = reflect(v, n);
  vec3 env = studio(r);

  float black;
  vec3 tint = tintOf(uTint, black);
  float cosT = clamp(dot(n, -v), 0., 1.);
  float fres = pow(1. - cosT, 5.);
  vec3 F = mix(tint, vec3(1.), fres);
  vec3 col = env * F;

  if (black > .5) col = pow(env, vec3(1.7)) * .55 * F + .02;
  if (uTint > 3.5) {
    // thin film: thickness from height + view angle
    float film = h * .55 + cosT * 1.2 + uTime * .03;
    vec3 iri = .62 + .38 * cos(6.2831 * (film + vec3(0., .33, .67)));
    // film shows most on mid-tones; highlights stay white, shadows stay deep
    float lum = dot(col, vec3(.333));
    col *= mix(vec3(1.), iri * 1.12, .42 * smoothstep(.05, .5, lum) * (1. - .5 * smoothstep(.9, 1.4, lum)));
  }
  if (uTint > .5 && uTint < 1.5) col += vec3(.06, .03, 0.) * fres;

  // gentle filmic shoulder + vignette
  col = col / (1. + col * .28) * 1.18;
  float vig = 1. - .32 * dot(sp, sp);
  col *= vig;
  gl_FragColor = vec4(col, 1.);
}
`;

/* ───────────────────────── component ───────────────────────── */

export type MetalTint = "silver" | "gold" | "titanium" | "black-chrome" | "iridescent";
const TINTS: Record<MetalTint, number> = { silver: 0, gold: 1, titanium: 2, "black-chrome": 3, iridescent: 4 };
const FALLBACKS: Record<MetalTint, string> = {
  silver: "linear-gradient(160deg, #f4f5f7 0%, #9da1a8 22%, #fdfdfd 38%, #2b2c30 52%, #c7cad0 66%, #5d6067 84%, #eef0f3 100%)",
  gold: "linear-gradient(160deg, #fff1cc 0%, #b98a3e 22%, #fff6dc 38%, #3a2a12 52%, #e5c27a 66%, #7a5a26 84%, #fbe6b3 100%)",
  titanium: "linear-gradient(160deg, #e6e9ee 0%, #868d98 22%, #f1f3f6 38%, #24272d 52%, #b3b9c2 66%, #535963 84%, #dfe3e9 100%)",
  "black-chrome": "linear-gradient(160deg, #6b6e75 0%, #1b1c20 22%, #9a9da4 38%, #050506 52%, #45484e 66%, #0f1013 84%, #7a7d84 100%)",
  iridescent: "linear-gradient(160deg, #f3e9ff 0%, #8fb7d8 22%, #fff5e1 38%, #2e2a3a 52%, #d7c1f0 66%, #5d7f80 84%, #f2f0e6 100%)",
};

export interface LiquidMetalProps {
  tint?: MetalTint;
  speed?: number;
  distortion?: number;
  scale?: number;
  interactive?: boolean;
  quality?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function LiquidMetal({
  tint = "silver",
  speed = 1,
  distortion = 1,
  scale = 1,
  interactive = true,
  quality = 1.5,
  className,
  style,
  children,
}: LiquidMetalProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const props = useRef({ tint, speed, distortion, scale, interactive });
  props.current = { tint, speed, distortion, scale, interactive };
  const st = useRef({
    t: 0,
    ptr: { x: 0, y: 0, tx: 0, ty: 0, s: 0, ts: 0 },
    rip: [] as { x: number; y: number; age: number; amp: number }[],
    tint: TINTS[tint],
  });

  const hooks = useRef<StageHooks>({
    frame(s, _time, dt) {
      const { gl, u } = s;
      const p = props.current;
      const S = st.current;
      if (!s.reduced) S.t += dt * p.speed;
      const pt = S.ptr;
      const k = s.reduced ? 1 : 1 - Math.exp(-dt * 6);
      pt.x += (pt.tx - pt.x) * k;
      pt.y += (pt.ty - pt.y) * (1 - Math.exp(-dt * 6));
      pt.s += (pt.ts - pt.s) * (1 - Math.exp(-dt * 3));
      S.rip = S.rip.filter((r) => (r.age += dt) < 2.6);
      const rip = new Float32Array(16);
      S.rip.slice(-4).forEach((r, i) => rip.set([r.x * s.dpr, s.h - r.y * s.dpr, r.age, r.amp], i * 4));
      gl.uniform2f(u.uRes, s.w, s.h);
      gl.uniform1f(u.uTime, S.t + 7);
      gl.uniform1f(u.uDist, p.distortion);
      gl.uniform1f(u.uScale, p.scale);
      gl.uniform3f(u.uPtr, pt.x * s.dpr, s.h - pt.y * s.dpr, p.interactive ? pt.s : 0);
      gl.uniform4fv(u.uRip, rip);
      gl.uniform1f(u.uTint, TINTS[p.tint] ?? 0);
      gl.uniform1f(u.uDpr, s.dpr);
      return true;
    },
  });
  const { failed, kick } = useStage(canvasRef, FRAG, hooks, quality);
  useEffect(() => kick.current(), [tint, distortion, scale, kick]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !interactive) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) return;
    let lastX = 0;
    let lastY = 0;
    let travel = 0;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const move = (e: PointerEvent) => {
      const [x, y] = local(e);
      const pt = st.current.ptr;
      if (pt.ts === 0) {
        pt.x = x;
        pt.y = y;
        lastX = x;
        lastY = y;
      }
      pt.tx = x;
      pt.ty = y;
      pt.ts = 1;
      travel += Math.hypot(x - lastX, y - lastY);
      lastX = x;
      lastY = y;
      if (travel > 260) {
        travel = 0;
        st.current.rip.push({ x, y, age: 0, amp: 0.22 });
      }
    };
    const down = (e: PointerEvent) => {
      const [x, y] = local(e);
      st.current.rip.push({ x, y, age: 0, amp: 0.6 });
    };
    const leave = () => {
      st.current.ptr.ts = 0;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerleave", leave);
    };
  }, [interactive]);

  return (
    <div ref={rootRef} className={`fd-lmetal${className ? " " + className : ""}`} style={{ ["--fd-lmetal-fallback" as string]: FALLBACKS[tint], ...style }}>
      <style>{css}</style>
      {failed ? <div className="fd-lmetal-fallback" aria-hidden="true" /> : <canvas ref={canvasRef} className="fd-lmetal-canvas" aria-hidden="true" />}
      {children ? <div className="fd-lmetal-content">{children}</div> : null}
    </div>
  );
}

const css = `
.fd-lmetal, .fd-lmetal *, .fd-lmetal *::before, .fd-lmetal *::after { box-sizing: border-box; }
.fd-lmetal {
  position: relative; display: block; margin: 0; padding: 0; border: 0; overflow: hidden;
  border-radius: var(--fd-lmetal-radius, 0px); background: #8d9096; color: inherit; isolation: isolate;
}
.fd-lmetal-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; z-index: 0; }
.fd-lmetal-fallback {
  position: absolute; inset: -20%; margin: 0; padding: 0; border: 0; z-index: 0;
  background: var(--fd-lmetal-fallback); background-size: 160% 160%;
  filter: blur(18px) saturate(1.1);
  animation: fd-lmetal-flow 14s cubic-bezier(0.65, 0, 0.35, 1) infinite alternate;
}
@keyframes fd-lmetal-flow { from { background-position: 0% 0%; } to { background-position: 100% 100%; } }
@media (prefers-reduced-motion: reduce) { .fd-lmetal-fallback { animation: none; } }
.fd-lmetal-content { position: relative; z-index: 1; margin: 0; padding: 0; height: 100%; }
`;

/* ───────────────────────── demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-lmetald">
      <style>{demoCss}</style>
      <LiquidMetal className="fd-lmetald-panel" tint="silver" scale={1.9} distortion={0.6} />
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-lmetald,.fd-lmetald *,.fd-lmetald *::before,.fd-lmetald *::after{box-sizing:border-box}
.fd-lmetald{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;background:#f2f2f2}
.fd-lmetald-panel.fd-lmetal{width:min(100%,640px);aspect-ratio:16/9;margin:0;padding:0;--fd-lmetal-radius:28px;box-shadow:0 1px 1px rgba(0,0,0,.06),0 24px 60px -24px rgba(0,0,0,.35)}
`;
