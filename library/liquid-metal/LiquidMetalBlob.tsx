/**
 * LiquidMetalBlob, a morphing drop of mercury for hero centrepieces. A tiny
 * raymarcher blends a few metaball spheres with a smooth-min, wobbles the
 * surface with sine displacement and reflects a procedural studio. The blob
 * leans toward the cursor and a satellite droplet is pulled out by it.
 *
 * Props
 * - tint?: "silver" | "gold" | "titanium" | "black-chrome". Default "silver".
 * - speed?: number         Morph speed. Default 1.
 * - size?: number          Blob radius relative to the canvas. Default 1.
 * - interactive?: boolean  Follows the pointer. Default true.
 * - background?: string    Canvas clear colour; "transparent" by default so it sits on any page.
 * - quality?: number       Max DPR. Default 1.5.
 * CSS vars: --fd-lmblob-fallback.
 *
 * Browser support: WebGL2 / WebGL1. Without WebGL a CSS chrome sphere is
 * shown. Reduced motion: one still frame. Canvas is aria-hidden.
 * Performance: 48-step raymarch with early exit, bounded by a sphere test
 * pixels outside the blob's bounds cost almost nothing.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject, RefObject } from "react";

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
uniform vec2 uPtr;     // -1..1 pointer, smoothed
uniform float uPull;   // 0..1 pointer presence
uniform float uTint;
uniform float uSize;

float smin(float a, float b, float k){
  float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
  return mix(b, a, h) - k * h * (1. - h);
}

vec3 c0, c1, c2, c3;

float map(vec3 p){
  float t = uTime;
  float d = length(p - c0) - .62 * uSize;
  d = smin(d, length(p - c1) - .34 * uSize, .32);
  d = smin(d, length(p - c2) - .28 * uSize, .3);
  d = smin(d, length(p - c3) - (.16 + .06 * uPull) * uSize, .3);
  // liquid surface wobble
  d += .035 * sin(p.x * 5. + t * 1.7) * sin(p.y * 4.3 - t * 1.3) * sin(p.z * 4.7 + t);
  return d;
}

vec3 normalAt(vec3 p){
  vec2 e = vec2(.0015, 0.);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
}

vec3 studio(vec3 r){
  float el = r.y;
  float az = atan(r.x, -r.z);
  vec3 sky = mix(vec3(.24, .25, .28), vec3(.96, .97, .99), smoothstep(-.02, .75, el + .2 * abs(az)));
  // studio floor: dark contact band at the horizon, lifting to a soft grey underneath
  vec3 fl = mix(vec3(.04, .04, .045), vec3(.42, .42, .44), smoothstep(-.12, -.85, el));
  vec3 c = mix(fl, sky, smoothstep(-.08, -.03, el));
  c += .7 * exp(-pow((el + .01) / .025, 2.));
  c += 1.6 * smoothstep(.1, 0., abs(az + .7) - .25) * smoothstep(.06, 0., abs(el - .4) - .22);
  c += 1.2 * smoothstep(.05, 0., abs(az - .9) - .07) * smoothstep(.05, 0., abs(el - .15) - .32);
  c += .6 * smoothstep(.2, 0., abs(el - .92) - .05);
  c *= 1. - .85 * smoothstep(.07, 0., abs(az - .2) - .06) * smoothstep(-.05, .1, el);
  c *= 1. - .7 * smoothstep(.12, 0., abs(abs(az) - 2.6) - .3) * smoothstep(-.05, .1, el);
  return c;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / min(uRes.x, uRes.y);
  float t = uTime;
  vec2 ptr = uPtr * uPull;
  c0 = vec3(ptr * .1, 0.);
  // satellites orbit just far enough to stretch, pinch off and re-merge
  c1 = vec3(sin(t * .7) * .72, cos(t * .9) * .42, sin(t * .5) * .3) * uSize + vec3(ptr * .15, 0.);
  c2 = vec3(cos(t * .6 + 2.) * .66, sin(t * .8 + 1.) * .6, cos(t * .7) * .3) * uSize;
  c3 = mix(vec3(sin(t * .5 + 4.) * .95, cos(t * .45) * .8, .2) * uSize, vec3(ptr * vec2(.85, .7), .3), uPull * .7);

  vec3 ro = vec3(0., 0., 4.);
  vec3 rd = normalize(vec3(uv, -1.62));
  // bounding sphere, skip the march for background pixels
  float R = 1.3 * uSize + .2;
  float b = dot(ro, rd);
  float cc = dot(ro, ro) - R * R;
  float disc = b * b - cc;
  vec4 outc = vec4(0.);
  if (disc > 0.) {
    float tt = max(-b - sqrt(disc), 0.);
    float tEnd = -b + sqrt(disc);
    bool hit = false;
    for (int i = 0; i < 48; i++) {
      float d = map(ro + rd * tt);
      if (d < .0015) { hit = true; break; }
      tt += d * .9;
      if (tt > tEnd) break;
    }
    if (hit) {
      vec3 p = ro + rd * tt;
      vec3 n = normalAt(p);
      vec3 r = reflect(rd, n);
      vec3 env = studio(r);
      float fres = pow(1. - clamp(dot(n, -rd), 0., 1.), 5.);
      vec3 tint = uTint < .5 ? vec3(.96, .965, .975) : uTint < 1.5 ? vec3(1., .78, .43) : uTint < 2.5 ? vec3(.78, .8, .85) : vec3(.5);
      vec3 col = env * mix(tint, vec3(1.), fres);
      if (uTint > 2.5) col = pow(env, vec3(1.6)) * .6 + .02;
      // fake contact occlusion where lobes merge
      float ao = clamp(map(p + n * .12) / .12, 0., 1.);
      col *= .55 + .45 * ao;
      col = col / (1. + col * .25) * 1.15;
      outc = vec4(col, 1.);
    }
  }
  // soft floor shadow / reflection glow under the blob
  vec2 sq = (uv - vec2(ptr.x * .04, -.36 * uSize - .02)) * vec2(1., 6.) / (.24 * uSize);
  float sh = exp(-dot(sq, sq)) * .26;
  outc.a = outc.a + sh * (1. - outc.a);
  gl_FragColor = outc;
}
`;

/* ───────────────────────── component ───────────────────────── */

type Tint = "silver" | "gold" | "titanium" | "black-chrome";
const TINTS: Record<Tint, number> = { silver: 0, gold: 1, titanium: 2, "black-chrome": 3 };
const FALLBACK: Record<Tint, string> = {
  silver: "radial-gradient(circle at 34% 28%, #ffffff 0 8%, #c9ccd2 22%, #3a3c41 52%, #8a8e96 72%, #1b1c20 100%)",
  gold: "radial-gradient(circle at 34% 28%, #fff6dc 0 8%, #e2bd72 22%, #4d3712 52%, #b0853a 72%, #2a1d08 100%)",
  titanium: "radial-gradient(circle at 34% 28%, #f3f5f8 0 8%, #aeb5bf 22%, #30343a 52%, #737a85 72%, #15171b 100%)",
  "black-chrome": "radial-gradient(circle at 34% 28%, #9a9da4 0 6%, #3f4248 20%, #040405 52%, #2a2c31 72%, #000 100%)",
};

export interface LiquidMetalBlobProps {
  tint?: Tint;
  speed?: number;
  size?: number;
  interactive?: boolean;
  background?: string;
  quality?: number;
  className?: string;
  style?: CSSProperties;
}

export function LiquidMetalBlob({
  tint = "silver",
  speed = 1,
  size = 1,
  interactive = true,
  background = "transparent",
  quality = 1.5,
  className,
  style,
}: LiquidMetalBlobProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef({ t: 0, x: 0, y: 0, tx: 0, ty: 0, pull: 0, tpull: 0, tint, speed, size });
  st.current.tint = tint;
  st.current.speed = speed;
  st.current.size = size;

  const hooks = useRef<StageHooks>({
    setup(s) {
      s.gl.clearColor(0, 0, 0, 0);
    },
    frame(s, _time, dt) {
      const { gl, u } = s;
      const S = st.current;
      if (!s.reduced) S.t += dt * S.speed;
      const k = s.reduced ? 1 : 1 - Math.exp(-dt * 3.2);
      S.x += (S.tx - S.x) * k;
      S.y += (S.ty - S.y) * k;
      S.pull += (S.tpull - S.pull) * (s.reduced ? 1 : 1 - Math.exp(-dt * 2.2));
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.uRes, s.w, s.h);
      gl.uniform1f(u.uTime, S.t + 2.4);
      gl.uniform2f(u.uPtr, S.x, S.y);
      gl.uniform1f(u.uPull, S.pull);
      gl.uniform1f(u.uTint, TINTS[S.tint] ?? 0);
      gl.uniform1f(u.uSize, S.size);
      return true;
    },
  });
  const { failed, kick } = useStage(canvasRef, FRAG, hooks, quality);
  useEffect(() => kick.current(), [tint, size, kick]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !interactive) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Track the pointer page-wide so the blob reacts before you reach it.
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const m = Math.min(r.width, r.height);
      const x = (e.clientX - (r.left + r.width / 2)) / (m / 2);
      const y = -(e.clientY - (r.top + r.height / 2)) / (m / 2);
      const d = Math.hypot(x, y);
      const clamp = d > 1.2 ? 1.2 / d : 1;
      st.current.tx = x * clamp;
      st.current.ty = y * clamp;
      st.current.tpull = Math.max(0, 1 - Math.max(0, d - 1.4) / 1.6);
    };
    const leave = () => {
      st.current.tpull = 0;
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, [interactive]);

  return (
    <div ref={rootRef} className={`fd-lmblob${className ? " " + className : ""}`} style={{ background, ["--fd-lmblob-fallback" as string]: FALLBACK[tint], ...style }}>
      <style>{css}</style>
      {failed ? <div className="fd-lmblob-fallback" aria-hidden="true" /> : <canvas ref={canvasRef} className="fd-lmblob-canvas" aria-hidden="true" />}
    </div>
  );
}

const css = `
.fd-lmblob, .fd-lmblob *, .fd-lmblob *::before, .fd-lmblob *::after { box-sizing: border-box; }
.fd-lmblob { position: relative; display: block; margin: 0; padding: 0; border: 0; aspect-ratio: 1; }
.fd-lmblob-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; }
.fd-lmblob-fallback {
  position: absolute; left: 22%; top: 20%; width: 56%; height: 56%; margin: 0; padding: 0; border: 0; border-radius: 50%;
  background: var(--fd-lmblob-fallback);
  box-shadow: 0 40px 60px -30px rgba(0,0,0,.6);
  animation: fd-lmblob-morph 9s cubic-bezier(0.65, 0, 0.35, 1) infinite alternate;
}
@keyframes fd-lmblob-morph {
  0% { border-radius: 50% 50% 48% 52% / 52% 48% 52% 48%; }
  50% { border-radius: 58% 42% 55% 45% / 45% 58% 42% 55%; }
  100% { border-radius: 44% 56% 46% 54% / 56% 44% 56% 44%; }
}
@media (prefers-reduced-motion: reduce) { .fd-lmblob-fallback { animation: none; } }
`;

/* ───────────────────────── demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-lmblobd">
      <style>{demoCss}</style>
      <LiquidMetalBlob className="fd-lmblobd-blob" />
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-lmblobd,.fd-lmblobd *,.fd-lmblobd *::before,.fd-lmblobd *::after{box-sizing:border-box}
.fd-lmblobd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;background:#f2f2f2}
.fd-lmblobd-blob.fd-lmblob{width:min(100%,640px);margin:0;padding:0}
`;
