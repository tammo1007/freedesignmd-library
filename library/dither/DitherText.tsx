/**
 * DitherText, a headline printed as an ordered-dither halftone. The text is
 * rasterised to a mask, then a shader fills it with Bayer-dithered tone whose
 * density follows scroll: dots build up as the headline scrolls into view
 * and dissolve as it leaves. A soft light gradient across the letters gives
 * the dots a printed, tonal look.
 *
 * Props
 * - children: string     The headline (also real DOM text for a11y/SEO/selection).
 * - as?: "h1" | "h2" | "p". Default "h2".
 * - ink?: string         Dot colour. Default "#0B0B0F".
 * - pixelSize?: number   Dither cell in CSS px. Default 3.
 * - scroll?: boolean     Scroll-reactive density. Default true. (false = fully inked)
 * - tone?: [number, number]  Min/max density across the letters. Default [0.35, 1].
 * - angle?: number       Direction of the tonal gradient in degrees. Default 120.
 * CSS: size with `font-size` on the root (clamp() works); the canvas matches the DOM text.
 *
 * Browser support: WebGL2 / WebGL1. Without WebGL the DOM text is shown with a
 * dotted CSS mask. Reduced motion: density is fixed at full (no scroll link).
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
uniform sampler2D uMask;
uniform vec2 uRes;
uniform float uPx;
uniform vec3 uInk;
uniform float uDensity;   // 0..1 from scroll
uniform vec2 uTone;
uniform vec2 uDir;

float bayer2(vec2 a){ a = floor(a); return fract(a.x * .5 + a.y * a.y * .75); }
float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(.5 * a) * .25 + bayer2(a); }

void main(){
  vec2 id = floor(gl_FragCoord.xy / uPx);
  vec2 c = (id + .5) * uPx / uRes;
  float m = texture2D(uMask, c).r;
  if (m < .5) { gl_FragColor = vec4(0.); return; }
  // tonal sweep across the line + a sweep that "prints" with scroll
  float g = dot(c - .5, uDir) + .5;
  float tone = mix(uTone.x, uTone.y, smoothstep(0., 1., g));
  float wipe = smoothstep(uDensity * 1.6 - .6, uDensity * 1.6 - .2, 1. - g);
  float l = tone * (1. - wipe) * smoothstep(0., .25, uDensity);
  float th = bayer8(id) + .0078125;
  float on = step(th, l);
  // round dots inside each cell
  vec2 f = fract(gl_FragCoord.xy / uPx) - .5;
  float dot_ = 1. - smoothstep(.36, .5, length(f));
  float a = on * dot_;
  gl_FragColor = vec4(uInk * a, a);
}
`;

/* ───────────────────────── component ───────────────────────── */

export interface DitherTextProps {
  children: string;
  as?: "h1" | "h2" | "p";
  ink?: string;
  pixelSize?: number;
  scroll?: boolean;
  tone?: [number, number];
  angle?: number;
  className?: string;
  style?: CSSProperties;
}

export function DitherText({
  children,
  as: Tag = "h2",
  ink = "#0B0B0F",
  pixelSize = 3,
  scroll = true,
  tone = [0.35, 1],
  angle = 120,
  className,
  style,
}: DitherTextProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const st = useRef({ ink, pixelSize, tone, angle, scroll, density: scroll ? 0 : 1, target: scroll ? 0 : 1, mask: null as HTMLCanvasElement | null, dirty: false, tex: null as WebGLTexture | null });
  Object.assign(st.current, { ink, pixelSize, tone, angle, scroll });

  const hooks = useRef<StageHooks>({
    setup(s) {
      const { gl } = s;
      st.current.tex = makeTexture(gl, gl.NEAREST, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      st.current.dirty = true;
    },
    frame(s, _t, dt) {
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
      const target = s.reduced || !S.scroll ? 1 : S.target;
      S.density += (target - S.density) * (s.reduced ? 1 : 1 - Math.exp(-dt * 6));
      const a = (S.angle * Math.PI) / 180;
      gl.uniform1i(u.uMask, 0);
      gl.uniform2f(u.uRes, s.w, s.h);
      gl.uniform1f(u.uPx, Math.max(1, Math.round(S.pixelSize * s.dpr)));
      gl.uniform3fv(u.uInk, hexToRgb(S.ink));
      gl.uniform1f(u.uDensity, S.density);
      gl.uniform2f(u.uTone, S.tone[0], S.tone[1]);
      gl.uniform2f(u.uDir, Math.cos(a), Math.sin(a));
      return Math.abs(target - S.density) > 0.002;
    },
  });
  const { failed, kick } = useStage(canvasRef, FRAG, hooks);
  useEffect(() => kick.current(), [ink, pixelSize, tone[0], tone[1], angle, kick]);

  // mask from DOM text layout
  useEffect(() => {
    const textEl = textRef.current;
    if (!textEl || failed) return;
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
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.scale(dpr, dpr);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      ctx.fillStyle = "#fff";
      if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      const node = textEl.firstChild;
      if (node && node.nodeType === 3) {
        const text = node.textContent || "";
        const range = document.createRange();
        let lineTop = -1;
        let start = 0;
        const lines: { s: number; e: number; rect: DOMRect }[] = [];
        for (let i = 0; i < text.length; i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const r = range.getClientRects()[0];
          if (!r) continue;
          if (lineTop < 0) lineTop = r.top;
          if (Math.abs(r.top - lineTop) > fs * 0.3) {
            range.setStart(node, start);
            range.setEnd(node, i);
            lines.push({ s: start, e: i, rect: range.getBoundingClientRect() });
            start = i;
            lineTop = r.top;
          }
        }
        range.setStart(node, start);
        range.setEnd(node, text.length);
        lines.push({ s: start, e: text.length, rect: range.getBoundingClientRect() });
        const m = ctx.measureText("Hg");
        const asc = m.fontBoundingBoxAscent ?? fs * 0.8;
        const desc = m.fontBoundingBoxDescent ?? fs * 0.2;
        for (const ln of lines) {
          const y = ln.rect.top - box.top + (ln.rect.height - (asc + desc)) / 2 + asc;
          ctx.fillText(text.slice(ln.s, ln.e).replace(/\s+$/, ""), ln.rect.left - box.left, y);
        }
      }
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
  }, [children, failed, kick]);

  // scroll → density (1 when the text sits in the middle band of the viewport)
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !scroll) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = (r.top + r.height / 2) / vh; // 0 top … 1 bottom
      const enter = Math.min(1, Math.max(0, (1.05 - center) / 0.45));
      const exit = Math.min(1, Math.max(0, (center + 0.05) / 0.35));
      st.current.target = Math.min(enter, exit);
      kick.current();
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        window.addEventListener("scroll", on, { passive: true });
        window.addEventListener("resize", on);
        on();
      } else {
        window.removeEventListener("scroll", on);
        window.removeEventListener("resize", on);
        st.current.target = 0;
      }
    });
    io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [scroll, kick]);

  return (
    <div ref={rootRef} className={`fd-dtext${className ? " " + className : ""}`} data-state={failed ? "fallback" : ready ? "ready" : "loading"} style={{ ["--fd-dtext-ink" as string]: ink, ...style }}>
      <style>{css}</style>
      <Tag ref={textRef as never} className="fd-dtext-text">
        {children}
      </Tag>
      {!failed && <canvas ref={canvasRef} className="fd-dtext-canvas" aria-hidden="true" />}
    </div>
  );
}

const css = `
.fd-dtext, .fd-dtext *, .fd-dtext *::before, .fd-dtext *::after { box-sizing: border-box; }
.fd-dtext { position: relative; display: block; margin: 0; padding: 0; border: 0; background: transparent; }
:where(.fd-dtext) { font-size: clamp(3rem, 10vw, 8.5rem); }
.fd-dtext-text {
  display: block; margin: 0; padding: 0.02em 0 0.08em; border: 0; background: transparent;
  font-size: inherit; line-height: 0.92; text-transform: none; text-decoration: none;
  color: transparent; -webkit-text-fill-color: transparent;
}
:where(.fd-dtext-text) { font-weight: 800; letter-spacing: -0.045em; font-family: "SF Pro Display", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif; }
.fd-dtext-text::selection { background: rgba(10,132,255,.3); }
.fd-dtext[data-state="fallback"] .fd-dtext-text {
  -webkit-text-fill-color: var(--fd-dtext-ink); color: var(--fd-dtext-ink);
  -webkit-mask: radial-gradient(circle, #000 1.1px, transparent 1.5px) 0 0 / 3px 3px;
          mask: radial-gradient(circle, #000 1.1px, transparent 1.5px) 0 0 / 3px 3px;
}
.fd-dtext-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; pointer-events: none; }
`;

/* ───────────────────────── demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-dtextd">
      <style>{demoCss}</style>
      <DitherText className="fd-dtextd-word" as="p" ink="#1d1d1f" scroll={false}>Dither</DitherText>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-dtextd,.fd-dtextd *,.fd-dtextd *::before,.fd-dtextd *::after{box-sizing:border-box}
.fd-dtextd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;background:#f2f2f2}
.fd-dtextd-word.fd-dtext{display:block;width:max-content;max-width:100%;margin:0;padding:0;font-size:clamp(4.5rem,18vw,9.5rem)}
`;
