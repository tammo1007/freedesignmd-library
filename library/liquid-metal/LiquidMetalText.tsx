/**
 * LiquidMetalText, a giant headline cast in flowing chrome. The text is
 * rasterised into a mask, blurred into a bevel height map, and combined with
 * a moving liquid height field; the resulting normals reflect a procedural
 * studio. Mouse tilt slides the highlights across the letters.
 *
 * Props
 * - children: string       The headline (also rendered as real, selectable DOM text for a11y/SEO).
 * - as?: "h1" | "h2" | "p" Default "h1".
 * - tint?: "silver" | "gold" | "titanium" | "black-chrome". Default "silver".
 * - weight?: number        Font weight. Default 800.
 * - fontFamily?: string    Default system display stack.
 * - tilt?: boolean         Pointer moves the reflection. Default true.
 * - speed?: number         Flow speed. Default 1.
 * CSS: size the text with `font-size` on the root (e.g. clamp()); the canvas matches the DOM text box.
 * CSS vars: --fd-lmtext-fallback.
 *
 * Browser support: WebGL2 / WebGL1. Without WebGL the DOM text shows a CSS
 * chrome gradient via background-clip:text. Reduced motion: still frame.
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
uniform sampler2D uMask;   // r = crisp coverage, g = blurred (bevel height)
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uTilt;
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
float liquid(vec2 p){
  float t = uTime * .12;
  vec2 w = vec2(noise(p * .8 + t), noise(p * .8 - t + 4.));
  return noise(p * 1.3 + w * 1.6) + .45 * sin(p.x * 1.1 + p.y * .5 + w.x * 3. + t * 2.5);
}
vec3 studio(vec3 r){
  float el = r.y + uTilt.y * .25;
  float az = atan(r.x, r.z) + uTilt.x * .6;
  vec3 sky = mix(vec3(.26, .27, .3), vec3(.95, .96, .98), smoothstep(-.05, .7, el + .25 * abs(az)));
  vec3 fl = mix(vec3(.02), vec3(.14, .13, .12), smoothstep(-1., -.3, el));
  vec3 c = mix(fl, sky, smoothstep(-.1, -.05, el));
  c += .8 * exp(-pow((el + .03) / .035, 2.));
  c += 1.4 * smoothstep(.08, 0., abs(az + .5) - .18) * smoothstep(.06, 0., abs(el - .35) - .2);
  c += 1.1 * smoothstep(.04, 0., abs(az - .7) - .06) * smoothstep(.05, 0., abs(el - .1) - .35);
  c *= 1. - .8 * smoothstep(.06, 0., abs(az - .25) - .05) * smoothstep(-.05, .1, el);
  return c;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 m = texture2D(uMask, uv).rg;
  if (m.r < .004) { gl_FragColor = vec4(0.); return; }
  vec2 px = 1. / uRes;
  // bevel from the blurred mask
  float bx = texture2D(uMask, uv + vec2(px.x * 2., 0.)).g - texture2D(uMask, uv - vec2(px.x * 2., 0.)).g;
  float by = texture2D(uMask, uv + vec2(0., px.y * 2.)).g - texture2D(uMask, uv - vec2(0., px.y * 2.)).g;
  vec2 p = gl_FragCoord.xy / uRes.y * 3.;
  float e = .01;
  float h = liquid(p);
  vec2 lg = vec2(liquid(p + vec2(e, 0.)) - h, liquid(p + vec2(0., e)) - h) / e;
  vec3 n = normalize(vec3(-bx * 7. - lg.x * .07, -by * 7. - lg.y * .07, 1.));
  vec2 sp = uv - .5;
  vec3 v = normalize(vec3(sp.x * .3, sp.y * 1.1 + .12 + .06 * sin(gl_FragCoord.x / uRes.y * 2. + uTime * .3), -1.));
  vec3 r = reflect(v, n);
  vec3 env = studio(r);
  vec3 tint = uTint < .5 ? vec3(.97) : uTint < 1.5 ? vec3(1., .79, .45) : uTint < 2.5 ? vec3(.8, .82, .86) : vec3(.5);
  float fres = pow(1. - clamp(-dot(n, v), 0., 1.), 5.);
  vec3 col = env * mix(tint, vec3(1.), fres);
  if (uTint > 2.5) col = pow(env, vec3(1.6)) * .6 + .02;
  col = col / (1. + col * .25) * 1.15;
  // thin bright rim on the bevel crest
  col += .18 * smoothstep(.45, .5, m.g) * (1. - smoothstep(.5, .6, m.g));
  float a = m.r;
  gl_FragColor = vec4(col * a, a);
}
`;

/* ───────────────────────── component ───────────────────────── */

type Tint = "silver" | "gold" | "titanium" | "black-chrome";
const TINTS: Record<Tint, number> = { silver: 0, gold: 1, titanium: 2, "black-chrome": 3 };
const FALLBACK: Record<Tint, string> = {
  silver: "linear-gradient(180deg, #ffffff 0%, #c9ccd2 38%, #3a3c41 50%, #e7e9ec 62%, #8a8e96 100%)",
  gold: "linear-gradient(180deg, #fff6dc 0%, #e2bd72 38%, #4d3712 50%, #f5d996 62%, #a87a33 100%)",
  titanium: "linear-gradient(180deg, #f3f5f8 0%, #aeb5bf 38%, #30343a 50%, #d6dbe2 62%, #737a85 100%)",
  "black-chrome": "linear-gradient(180deg, #9a9da4 0%, #3f4248 38%, #040405 50%, #55585e 62%, #121316 100%)",
};

export interface LiquidMetalTextProps {
  children: string;
  as?: "h1" | "h2" | "p";
  tint?: Tint;
  weight?: number;
  fontFamily?: string;
  tilt?: boolean;
  speed?: number;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_FONT = `"SF Pro Display", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif`;

export function LiquidMetalText({
  children,
  as: Tag = "h1",
  tint = "silver",
  weight = 800,
  fontFamily = DEFAULT_FONT,
  tilt = true,
  speed = 1,
  className,
  style,
}: LiquidMetalTextProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const st = useRef({ t: 0, tilt: { x: 0, y: 0, tx: 0, ty: 0 }, tint, speed, mask: null as HTMLCanvasElement | null, dirty: false, tex: null as WebGLTexture | null });
  st.current.tint = tint;
  st.current.speed = speed;

  const hooks = useRef<StageHooks>({
    setup(s) {
      const { gl } = s;
      st.current.tex = makeTexture(gl, gl.LINEAR, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      st.current.dirty = true;
    },
    frame(s, _time, dt) {
      const { gl, u } = s;
      const S = st.current;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, S.tex);
      if (S.dirty && S.mask && S.mask.width === s.w && S.mask.height === s.h) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, S.mask);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        S.dirty = false;
      }
      if (!s.reduced) S.t += dt * S.speed;
      const k = 1 - Math.exp(-dt * 4);
      S.tilt.x += (S.tilt.tx - S.tilt.x) * k;
      S.tilt.y += (S.tilt.ty - S.tilt.y) * k;
      gl.uniform1i(u.uMask, 0);
      gl.uniform2f(u.uRes, s.w, s.h);
      gl.uniform1f(u.uTime, S.t + 5);
      gl.uniform2f(u.uTilt, S.tilt.x, S.tilt.y);
      gl.uniform1f(u.uTint, TINTS[S.tint] ?? 0);
      return true;
    },
  });
  const { failed, kick } = useStage(canvasRef, FRAG, hooks);

  // Rasterise the DOM text (same font, size, wrapping) into an RG mask whenever layout changes.
  useEffect(() => {
    const textEl = textRef.current;
    const canvas = canvasRef.current;
    if (!textEl || !canvas || failed) return;
    let raf = 0;
    const build = () => {
      raf = 0;
      const box = textEl.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(1, Math.round(box.width * dpr));
      const H = Math.max(1, Math.round(box.height * dpr));
      const cs = getComputedStyle(textEl);
      const fs = parseFloat(cs.fontSize);
      const mask = document.createElement("canvas");
      mask.width = W;
      mask.height = H;
      const ctx = mask.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#fff";
      if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      // Walk the text node's line boxes via Range rects so canvas wrapping matches the DOM exactly.
      const node = textEl.firstChild;
      if (node && node.nodeType === 3) {
        const text = node.textContent || "";
        const range = document.createRange();
        let lineTop = -1;
        let lineStart = 0;
        const lines: { s: number; e: number; rect: DOMRect }[] = [];
        for (let i = 0; i < text.length; i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const r = range.getClientRects()[0];
          if (!r) continue;
          if (lineTop < 0) lineTop = r.top;
          if (Math.abs(r.top - lineTop) > fs * 0.3) {
            range.setStart(node, lineStart);
            range.setEnd(node, i);
            lines.push({ s: lineStart, e: i, rect: range.getBoundingClientRect() });
            lineStart = i;
            lineTop = r.top;
          }
        }
        range.setStart(node, lineStart);
        range.setEnd(node, text.length);
        lines.push({ s: lineStart, e: text.length, rect: range.getBoundingClientRect() });
        const m = ctx.measureText("Hg");
        const asc = m.fontBoundingBoxAscent ?? fs * 0.8;
        const desc = m.fontBoundingBoxDescent ?? fs * 0.2;
        for (const ln of lines) {
          const str = text.slice(ln.s, ln.e).replace(/\s+$/, "");
          const y = ln.rect.top - box.top + (ln.rect.height - (asc + desc)) / 2 + asc;
          ctx.fillText(str, ln.rect.left - box.left, y);
        }
      }
      // R = crisp, G = blurred copy for the bevel
      const blur = document.createElement("canvas");
      blur.width = W;
      blur.height = H;
      const b = blur.getContext("2d");
      if (!b) return;
      b.filter = `blur(${Math.max(1.5, fs * dpr * 0.035)}px)`;
      b.drawImage(mask, 0, 0);
      const crisp = ctx.getImageData(0, 0, W, H);
      const soft = b.getImageData(0, 0, W, H);
      for (let i = 0; i < crisp.data.length; i += 4) {
        const a = crisp.data[i + 3];
        crisp.data[i] = a;
        crisp.data[i + 1] = soft.data[i + 3];
        crisp.data[i + 2] = 0;
        crisp.data[i + 3] = 255;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(crisp, 0, 0);
      st.current.mask = mask;
      st.current.dirty = true;
      setReady(true);
      kick.current();
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(build);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(textEl);
    document.fonts?.ready.then(schedule);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [children, weight, fontFamily, failed, kick]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !tilt) return;
    const move = (e: PointerEvent) => {
      st.current.tilt.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      st.current.tilt.ty = (e.clientY / window.innerHeight - 0.5) * -2;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [tilt]);

  return (
    <div
      ref={rootRef}
      className={`fd-lmtext${className ? " " + className : ""}`}
      data-state={failed ? "fallback" : ready ? "ready" : "loading"}
      style={{ ["--fd-lmtext-fallback" as string]: FALLBACK[tint], ...style }}
    >
      <style>{css}</style>
      <Tag ref={textRef as never} className="fd-lmtext-text" style={{ fontWeight: weight, fontFamily }}>
        {children}
      </Tag>
      {!failed && <canvas ref={canvasRef} className="fd-lmtext-canvas" aria-hidden="true" />}
    </div>
  );
}

const css = `
.fd-lmtext, .fd-lmtext *, .fd-lmtext *::before, .fd-lmtext *::after { box-sizing: border-box; }
.fd-lmtext { position: relative; display: block; margin: 0; padding: 0; border: 0; background: transparent; }
:where(.fd-lmtext) { font-size: clamp(3rem, 11vw, 10rem); }
.fd-lmtext-text {
  display: block; margin: 0; padding: 0.04em 0 0.1em; border: 0; background: transparent;
  font-size: inherit; line-height: 0.95; text-transform: none; text-decoration: none;
  color: transparent; -webkit-text-fill-color: transparent;
  transition: color 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
.fd-lmtext[data-state="fallback"] .fd-lmtext-text,
.fd-lmtext[data-state="loading"] .fd-lmtext-text {
  background: var(--fd-lmtext-fallback); -webkit-background-clip: text; background-clip: text;
}
:where(.fd-lmtext-text) { letter-spacing: -0.045em; }
.fd-lmtext-text::selection { background: rgba(10,132,255,.35); -webkit-text-fill-color: currentColor; color: #fff; }
.fd-lmtext-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; pointer-events: none; }
`;

/* ───────────────────────── demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-lmtextd">
      <style>{demoCss}</style>
      <LiquidMetalText className="fd-lmtextd-word" as="p">Chrome</LiquidMetalText>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-lmtextd,.fd-lmtextd *,.fd-lmtextd *::before,.fd-lmtextd *::after{box-sizing:border-box}
.fd-lmtextd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;background:#f2f2f2}
.fd-lmtextd-word.fd-lmtext{display:block;width:max-content;max-width:100%;margin:0;padding:0;font-size:clamp(4.5rem,18vw,10rem)}
`;
