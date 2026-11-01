/**
 * DitherImage — GPU ordered / blue-noise dithering of any image into a 2–4
 * colour palette, with a cursor "loupe" that sharpens, inverts or reveals the
 * photo underneath.
 *
 * Props
 * - src?: string            Image URL (loaded with crossOrigin="anonymous", cover-fitted).
 * - draw?: (ctx, w, h)=>void Procedural source drawn to an offscreen canvas (used when no src).
 * - palette?: string[]      2–4 hex colours, darkest → lightest. Default ink / paper.
 * - pixelSize?: number      Dither cell size in CSS px. Default 3.
 * - algorithm?: "bayer2" | "bayer4" | "bayer8" | "blue-noise". Default "bayer8".
 * - contrast?: number       1 = neutral. Default 1.15.
 * - brightness?: number     −0.5…0.5. Default 0.
 * - lens?: "sharpen" | "invert" | "reveal" | "none". Default "sharpen".
 * - lensRadius?: number     CSS px. Default 140.
 * - children                Overlay content (type, UI) rendered above the canvas.
 * CSS vars: --fd-dimg-radius, --fd-dimg-fallback.
 *
 * Browser support: WebGL2 with WebGL1 fallback. Without WebGL a CSS halftone
 * gradient is shown. Accessibility: pass `alt` — the canvas gets role="img".
 * Reduced motion: the loupe snaps instead of easing.
 *
 * Demo image: /img/people/p2.webp (placeholder portrait, included in the repo's
 * public/img/people — copy it next to your page or swap in your own).
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

/** 64×64 blue-noise threshold map (void-and-cluster, void-filling pass). Cached. */
let blueNoiseCache: Uint8Array | null = null;
function blueNoise(): Uint8Array {
  if (blueNoiseCache) return blueNoiseCache;
  const S = 64;
  const N = S * S;
  const energy = new Float32Array(N);
  const rank = new Int32Array(N).fill(-1);
  const R = 6;
  const kern: number[] = [];
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) kern.push(x, y, Math.exp(-(x * x + y * y) / (2 * 1.9 * 1.9)));
  let seed = 7;
  for (let i = 0; i < N; i++) {
    seed = (seed * 16807) % 2147483647;
    energy[i] = (seed / 2147483647) * 1e-4;
  }
  for (let k = 0; k < N; k++) {
    let best = 0;
    let bv = Infinity;
    for (let i = 0; i < N; i++) if (rank[i] < 0 && energy[i] < bv) { bv = energy[i]; best = i; }
    rank[best] = k;
    const bx = best % S;
    const by = (best / S) | 0;
    for (let j = 0; j < kern.length; j += 3) {
      const x = (bx + kern[j] + S) % S;
      const y = (by + kern[j + 1] + S) % S;
      energy[y * S + x] += kern[j + 2];
    }
  }
  const out = new Uint8Array(N);
  for (let i = 0; i < N; i++) out[i] = Math.floor((rank[i] * 256) / N);
  blueNoiseCache = out;
  return out;
}

/* ───────────────────────── shader ───────────────────────── */

const FRAG = /* glsl */ `
uniform sampler2D uImg;
uniform sampler2D uNoise;
uniform vec2 uRes;
uniform vec2 uImgSize;
uniform float uPx;
uniform float uAlgo;
uniform vec3 uPal[4];
uniform float uN;
uniform float uContrast;
uniform float uBright;
uniform vec3 uLens;
uniform float uRadius;
uniform float uMode;

float bayer2(vec2 a){ a = floor(a); return fract(a.x * .5 + a.y * a.y * .75); }
float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(.5 * a) * .25 + bayer2(a); }

float threshold(vec2 cell){
  if (uAlgo < .5) return bayer2(cell) + .125;
  if (uAlgo < 1.5) return bayer4(cell) + .03125;
  if (uAlgo < 2.5) return bayer8(cell) + .0078125;
  return texture2D(uNoise, (mod(cell, 64.) + .5) / 64.).r + .002;
}

vec2 cover(vec2 uv){
  float ra = uRes.x / uRes.y;
  float ia = uImgSize.x / uImgSize.y;
  vec2 s = ra > ia ? vec2(1., ia / ra) : vec2(ra / ia, 1.);
  return (uv - .5) * s + .5;
}

vec3 pal(float i){
  vec3 c = uPal[0];
  c = mix(c, uPal[1], step(.5, i));
  c = mix(c, uPal[2], step(1.5, i));
  c = mix(c, uPal[3], step(2.5, i));
  return c;
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  float d = length(fc - uLens.xy);
  float lens = (1. - smoothstep(uRadius * .35, uRadius, d)) * uLens.z;

  float cell = uPx;
  if (uMode < .5) cell = max(1., floor(mix(uPx, max(1., uPx * .34), lens) + .5));
  vec2 id = floor(fc / cell);
  vec2 center = (id + .5) * cell;
  vec3 src = texture2D(uImg, cover(center / uRes)).rgb;
  float l = dot(src, vec3(.2126, .7152, .0722));
  l = clamp((l - .5) * uContrast + .5 + uBright, 0., 1.);

  float t = threshold(id);
  float n = uN - 1.;
  float v = l * n;
  float idx = min(floor(v) + step(t, fract(v)), n);
  vec3 col = pal(idx);

  if (uMode > .5 && uMode < 1.5) {
    // invert — the loupe edge is itself dithered
    float inside = step(t, lens);
    col = mix(col, pal(n - idx), inside);
  } else if (uMode > 1.5 && uMode < 2.5) {
    vec3 photo = texture2D(uImg, cover(fc / uRes)).rgb;
    col = mix(col, photo, step(t, lens));
  }
  gl_FragColor = vec4(col, 1.);
}
`;

/* ───────────────────────── component ───────────────────────── */

export type DitherAlgorithm = "bayer2" | "bayer4" | "bayer8" | "blue-noise";

export interface DitherImageProps {
  src?: string;
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  /** Size of the procedural `draw` canvas. Default [900, 1200]. */
  drawSize?: [number, number];
  palette?: string[];
  pixelSize?: number;
  algorithm?: DitherAlgorithm;
  contrast?: number;
  brightness?: number;
  lens?: "sharpen" | "invert" | "reveal" | "none";
  lensRadius?: number;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const ALGOS: Record<DitherAlgorithm, number> = { bayer2: 0, bayer4: 1, bayer8: 2, "blue-noise": 3 };
const MODES = { sharpen: 0, invert: 1, reveal: 2, none: 0 };

export function DitherImage({
  src,
  draw,
  drawSize = [900, 1200],
  palette = ["#121212", "#F2EFE8"],
  pixelSize = 3,
  algorithm = "bayer8",
  contrast = 1.15,
  brightness = 0,
  lens = "sharpen",
  lensRadius = 140,
  alt = "",
  className,
  style,
  children,
}: DitherImageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const props = useRef({ palette, pixelSize, algorithm, contrast, brightness, lens, lensRadius });
  props.current = { palette, pixelSize, algorithm, contrast, brightness, lens, lensRadius };
  const source = useRef<{ el: TexImageSource | null; w: number; h: number; dirty: boolean }>({ el: null, w: 1, h: 1, dirty: false });
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0, on: 0, ton: 0, seen: false });
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  const [srcVersion, setSrcVersion] = useState(0);
  const tex = useRef<{ img: WebGLTexture | null; noise: WebGLTexture | null }>({ img: null, noise: null });

  const hooks = useRef<StageHooks>({
    setup(s) {
      const { gl } = s;
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      tex.current.noise = makeTexture(gl, gl.NEAREST, gl.REPEAT);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 64, 64, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, blueNoise());
      tex.current.img = makeTexture(gl, gl.LINEAR, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
      source.current.dirty = !!source.current.el;
      gl.uniform1i(s.u.uImg, 0);
      gl.uniform1i(s.u.uNoise, 1);
    },
    frame(s, _t, dt) {
      const { gl, u } = s;
      const p = props.current;
      const src = source.current;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex.current.noise);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex.current.img);
      if (src.dirty && src.el) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.el);
        } catch {
          /* tainted image (no CORS) — keep placeholder */
        }
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        src.dirty = false;
      }
      const pt = pointer.current;
      const k = s.reduced ? 1 : 1 - Math.exp(-dt * 16);
      const kOn = s.reduced ? 1 : 1 - Math.exp(-dt * 7);
      pt.x += (pt.tx - pt.x) * k;
      pt.y += (pt.ty - pt.y) * k;
      pt.on += (pt.ton - pt.on) * kOn;
      const pal = p.palette.slice(0, 4);
      while (pal.length < 2) pal.push("#ffffff");
      const flat: number[] = [];
      for (let i = 0; i < 4; i++) flat.push(...hexToRgb(pal[Math.min(i, pal.length - 1)]));
      gl.uniform2f(u.uRes, s.w, s.h);
      gl.uniform2f(u.uImgSize, src.w, src.h);
      gl.uniform1f(u.uPx, Math.max(1, Math.round(p.pixelSize * s.dpr)));
      gl.uniform1f(u.uAlgo, ALGOS[p.algorithm] ?? 2);
      gl.uniform3fv(u.uPal, new Float32Array(flat));
      gl.uniform1f(u.uN, pal.length);
      gl.uniform1f(u.uContrast, p.contrast);
      gl.uniform1f(u.uBright, p.brightness);
      gl.uniform3f(u.uLens, pt.x * s.dpr, s.h - pt.y * s.dpr, p.lens === "none" ? 0 : pt.on);
      gl.uniform1f(u.uRadius, p.lensRadius * s.dpr);
      gl.uniform1f(u.uMode, MODES[p.lens] ?? 0);
      const settling = Math.abs(pt.tx - pt.x) + Math.abs(pt.ty - pt.y) > 0.3 || Math.abs(pt.ton - pt.on) > 0.004;
      return settling;
    },
  });
  const { failed, kick } = useStage(canvasRef, FRAG, hooks);

  // load / draw source
  useEffect(() => {
    let cancelled = false;
    if (src) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        if (cancelled) return;
        source.current = { el: img, w: img.naturalWidth, h: img.naturalHeight, dirty: true };
        kick.current();
        setSrcVersion((v) => v + 1);
      };
      img.src = src;
    } else if (draw) {
      const c = document.createElement("canvas");
      c.width = drawSize[0];
      c.height = drawSize[1];
      const ctx = c.getContext("2d");
      if (ctx) draw(ctx, c.width, c.height);
      source.current = { el: c, w: c.width, h: c.height, dirty: true };
      kick.current();
      setSrcVersion((v) => v + 1);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, draw, drawSize[0], drawSize[1], kick]);

  // No WebGL: dither once on the CPU into a 2D canvas (ordered Bayer 8×8), so the fallback still shows the image.
  useEffect(() => {
    const out = fallbackRef.current;
    const srcEl = source.current.el as CanvasImageSource | null;
    if (!failed || !out || !srcEl) return;
    const r = out.getBoundingClientRect();
    const cell = Math.max(1, Math.round(pixelSize));
    const W = Math.max(1, Math.round(r.width / cell));
    const H = Math.max(1, Math.round(r.height / cell));
    out.width = W;
    out.height = H;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const { w, h } = source.current;
    const k = Math.max(W / w, H / h);
    try {
      ctx.drawImage(srcEl, (W - w * k) / 2, (H - h * k) / 2, w * k, h * k);
      const img = ctx.getImageData(0, 0, W, H);
      const pal = palette.slice(0, 4).map(hexToRgb);
      const n = pal.length - 1;
      const base = [0, 2, 3, 1];
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          let b = 0;
          for (let q = 0; q < 3; q++) b += base[(((y >> q) & 1) << 1) | ((x >> q) & 1)] * 4 ** (2 - q);
          const t = (b + 0.5) / 64;
          const i = (y * W + x) * 4;
          let l = (0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]) / 255;
          l = Math.min(1, Math.max(0, (l - 0.5) * contrast + 0.5 + brightness));
          const v = l * n;
          const idx = Math.min(n, Math.floor(v) + (v - Math.floor(v) > t ? 1 : 0));
          img.data[i] = pal[idx][0] * 255;
          img.data[i + 1] = pal[idx][1] * 255;
          img.data[i + 2] = pal[idx][2] * 255;
          img.data[i + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
    } catch {
      /* tainted canvas — CSS halftone shows through */
    }
  }, [failed, srcVersion, palette.join(), pixelSize, contrast, brightness]);

  // redraw when visual props change
  useEffect(() => kick.current(), [palette.join(), pixelSize, algorithm, contrast, brightness, lens, lensRadius, kick]);

  // pointer → loupe
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const pt = pointer.current;
      pt.tx = e.clientX - r.left;
      pt.ty = e.clientY - r.top;
      if (!pt.seen) {
        pt.x = pt.tx;
        pt.y = pt.ty;
        pt.seen = true;
      }
      pt.ton = 1;
      kick.current();
    };
    const leave = () => {
      pointer.current.ton = 0;
      pointer.current.seen = false;
      kick.current();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointercancel", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointercancel", leave);
    };
  }, [kick]);

  return (
    <div ref={rootRef} className={`fd-dimg${className ? " " + className : ""}`} style={style}>
      <style>{css}</style>
      {failed ? (
        <>
          <div className="fd-dimg-fallback" aria-hidden="true" />
          <canvas ref={fallbackRef} className="fd-dimg-canvas" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} />
        </>
      ) : (
        <canvas ref={canvasRef} className="fd-dimg-canvas" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} />
      )}
      {children ? <div className="fd-dimg-overlay">{children}</div> : null}
    </div>
  );
}

const css = `
.fd-dimg, .fd-dimg *, .fd-dimg *::before, .fd-dimg *::after { box-sizing: border-box; }
.fd-dimg {
  position: relative; display: block; margin: 0; padding: 0; border: 0;
  overflow: hidden; border-radius: var(--fd-dimg-radius, 0px);
  background: #121212; color: inherit; touch-action: pan-y;
  isolation: isolate;
}
.fd-dimg-canvas {
  position: absolute; inset: 0; display: block; width: 100%; height: 100%;
  margin: 0; padding: 0; border: 0; image-rendering: pixelated;
}
.fd-dimg-fallback {
  position: absolute; inset: 0; margin: 0; padding: 0; border: 0;
  background: var(--fd-dimg-fallback, radial-gradient(circle at 50% 38%, #F2EFE8 0 18%, #8A857D 42%, #121212 78%));
  -webkit-mask: radial-gradient(circle, #000 1.1px, transparent 1.6px) 0 0 / 4px 4px;
          mask: radial-gradient(circle, #000 1.1px, transparent 1.6px) 0 0 / 4px 4px;
}
.fd-dimg-overlay { position: absolute; inset: 0; margin: 0; padding: 0; pointer-events: none; }
.fd-dimg-overlay a, .fd-dimg-overlay button { pointer-events: auto; }
`;

/* ───────────────────────── demo ───────────────────────── */

export function Demo() {
  return (
    <section className="fd-dimg-demo">
      <style>{demoCss}</style>
      <div className="fd-dimg-demo-copy">
        <p className="fd-dimg-demo-kicker">Vesper Nº 14 — The Winter Issue</p>
        <h2 className="fd-dimg-demo-title">Shot in shadow. Printed in dots.</h2>
        <p className="fd-dimg-demo-body">
          Forty-two looks in wool, felt and charcoal, photographed by Mara Lindqvist and set in a three-ink risograph palette.
          Move across the cover to bring the shoot into focus.
        </p>
        <div className="fd-dimg-demo-row">
          <a className="fd-dimg-demo-cta" href="#subscribe" onClick={(e) => e.preventDefault()}>
            Subscribe — 4 issues €48
          </a>
          <span className="fd-dimg-demo-meta">On newsstands 12 Nov 2026</span>
        </div>
      </div>
      <DitherImage
        className="fd-dimg-demo-cover"
        src="/img/people/p2.webp"
        palette={["#15120F", "#A8402A", "#EFE7D8"]}
        pixelSize={3}
        algorithm="bayer8"
        contrast={1.25}
        lensRadius={130}
        alt="Vesper magazine cover: a bearded man in a black tee against a white studio backdrop, dithered in rust and cream"
      >
        <div className="fd-dimg-demo-mast">VESPER</div>
        <div className="fd-dimg-demo-issue">
          <span>Nº 14</span>
          <span>Winter 2026</span>
          <span>€14 · £12</span>
        </div>
        <div className="fd-dimg-demo-lines">
          <p className="fd-dimg-demo-line-big">The Quiet Season</p>
          <p className="fd-dimg-demo-line">42 looks in wool, felt &amp; shadow</p>
          <p className="fd-dimg-demo-line fd-dimg-demo-line-sep">Ines Okafor on building Atelier Nord from a Lagos rooftop</p>
        </div>
        <div className="fd-dimg-demo-side">Paris Couture,<br />decoded</div>
      </DitherImage>
    </section>
  );
}

const demoCss = `
.fd-dimg-demo, .fd-dimg-demo *, .fd-dimg-demo *::before, .fd-dimg-demo *::after { box-sizing: border-box; }
.fd-dimg-demo {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-dur-1: 120ms;
  min-height: 100vh; margin: 0; padding: clamp(28px, 6vw, 88px);
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: clamp(32px, 6vw, 96px);
  align-items: center; background: #ECE5D8; color: #15120F;
  font: 400 15px/1.5 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
}
.fd-dimg-demo-copy { max-width: 460px; justify-self: end; margin: 0; padding: 0; }
.fd-dimg-demo-kicker {
  margin: 0 0 20px; padding: 0; color: #A8402A; letter-spacing: 0.12em; text-transform: uppercase;
  font: 600 12px/1.4 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
}
.fd-dimg-demo-title {
  margin: 0 0 20px; padding: 0; color: #15120F; letter-spacing: -0.04em;
  font: 700 clamp(2.75rem, 5.4vw, 5.5rem)/0.95 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", "Segoe UI", Roboto, sans-serif;
}
.fd-dimg-demo-body { margin: 0 0 32px; padding: 0; color: #4A433B; font: 400 1.0625rem/1.55 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.01em; max-width: 40ch; }
.fd-dimg-demo-row { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 24px; margin: 0; padding: 0; }
.fd-dimg-demo-cta {
  display: inline-flex; align-items: center; height: 48px; margin: 0; padding: 0 24px; border: 0; border-radius: 9999px;
  background: #15120F; color: #EFE7D8; text-decoration: none;
  font: 600 0.9375rem/1 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.01em;
  transition: transform var(--fd-dur-1) var(--fd-ease-out), background var(--fd-dur-1) var(--fd-ease-out);
}
.fd-dimg-demo-cta:hover { background: #A8402A; }
.fd-dimg-demo-cta:active { transform: scale(0.96); }
.fd-dimg-demo-cta:focus-visible { outline: 2px solid rgba(168, 64, 42, .7); outline-offset: 2px; }
.fd-dimg-demo-meta { margin: 0; padding: 0; color: #6B6258; font: 500 13px/1.4 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; }
.fd-dimg-demo-cover.fd-dimg {
  width: min(100%, 560px); aspect-ratio: 3 / 4; justify-self: start; container-type: inline-size;
  --fd-dimg-radius: 4px;
  box-shadow: 0 1px 0 rgba(0,0,0,.06), 0 30px 60px -20px rgba(40, 28, 16, .45), 0 60px 120px -40px rgba(40, 28, 16, .35);
  cursor: crosshair;
}
.fd-dimg-demo-mast {
  position: absolute; left: 5%; right: 5%; top: 3.2%; margin: 0; padding: 0;
  color: #15120F; text-align: center; letter-spacing: -0.06em;
  font: 800 clamp(3.5rem, 11vw, 9.4rem)/0.82 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", "Segoe UI", Roboto, sans-serif;
  font-size: 25.5cqw;
}
.fd-dimg-demo-issue {
  position: absolute; left: 5%; right: 5%; top: 1.4%; display: flex; justify-content: space-between; margin: 0; padding: 0;
  color: #15120F; font: 600 10px/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.14em; text-transform: uppercase;
}
.fd-dimg-demo-lines { position: absolute; left: 5%; bottom: 5%; max-width: 58%; margin: 0; padding: 0; }
.fd-dimg-demo-line-big {
  margin: 0 0 6px; padding: 0; color: #EFE7D8; letter-spacing: -0.035em;
  font: 700 clamp(1.75rem, 3.6vw, 2.75rem)/0.95 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", "Segoe UI", Roboto, sans-serif;
  font-size: clamp(1.5rem, 8cqw, 2.75rem);
}
.fd-dimg-demo-line { margin: 0; padding: 0; color: #EFE7D8; font: 500 0.8125rem/1.35 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: 0; }
.fd-dimg-demo-line-sep { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(239, 231, 216, .5); max-width: 26ch; }
.fd-dimg-demo-side {
  position: absolute; right: 5%; bottom: 5%; max-width: 32%; margin: 0; padding: 6px 10px; background: #A8402A; color: #EFE7D8; text-align: right;
  font: 700 0.8125rem/1.15 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: 0.02em; text-transform: uppercase;
}
@media (max-width: 820px) {
  .fd-dimg-demo { grid-template-columns: 1fr; padding: 28px 20px 40px; }
  .fd-dimg-demo-copy { justify-self: start; }
  .fd-dimg-demo-cover.fd-dimg { justify-self: center; }
}
`;
