/**
 * ImageRipple — an image card that behaves like a shallow pool. The cursor
 * drags a wake through a real-time wave simulation (ping-pong framebuffers,
 * 16-bit heights packed into RGBA8 so it runs on every WebGL device), and the
 * surface refracts the image with a slight chromatic split and a wet sheen.
 *
 * Props
 * - src?: string         Image URL (crossOrigin="anonymous", cover-fitted).
 * - draw?: (ctx, w, h)=>void  Procedural source drawn to an offscreen canvas (used when no src).
 * - drawSize?: [w, h]    Size of the procedural canvas. Default [800, 1000].
 * - strength?: number    Refraction amount. Default 1.
 * - chroma?: number      Chromatic split 0–1.5. Default 0.6.
 * - damping?: number     Wave energy kept per step (0.95–0.995). Default 0.986.
 * - cell?: number        Simulation cell size in CSS px — bigger = broader, cheaper waves. Default 2.
 * - radius?: number      Drop radius in CSS px. Default 14.
 * - alt?: string         Accessible description (canvas gets role="img").
 * - children             Overlay content (captions) above the image.
 * CSS vars: --fd-ripple-radius.
 *
 * Browser support: WebGL2 / WebGL1 (no float-texture extensions needed).
 * Without WebGL the image is shown still. Reduced motion: no simulation —
 * the image renders still. The loop sleeps once the water settles.
 *
 * Demo images: /img/lux/{hotel-golden,bamboo,dunes}.webp, included in the repo's public/img/lux —
 * copy them next to your page or swap in your own.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type GL = WebGLRenderingContext | WebGL2RenderingContext;

const HEAD = (gl2: boolean) =>
  (gl2 ? "#version 300 es\n" : "") +
  "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n" +
  (gl2 ? "#define texture2D texture\n#define gl_FragColor fdOut\nout vec4 fdOut;\n" : "");

const CODEC = `
float dec(vec2 c){ vec2 b = floor(c * 255. + .5); return (b.x * 256. + b.y) / 65535. * 2. - 1.; }
vec2 enc(float v){ float x = floor(clamp(v * .5 + .5, 0., 1.) * 65535. + .5); float hi = floor(x / 256.); return vec2(hi, x - hi * 256.) / 255.; }
`;

const SIM = `
uniform sampler2D uState;
uniform vec2 uSimRes;
uniform vec4 uDrops[4];   // sim px x, y, radius, strength
uniform float uDamp;
${CODEC}
void main(){
  vec2 t = 1. / uSimRes;
  vec2 uv = gl_FragCoord.xy * t;
  vec4 c = texture2D(uState, uv);
  float h = dec(c.rg);
  float p = dec(c.ba);
  float n = dec(texture2D(uState, uv + vec2(t.x, 0.)).rg) + dec(texture2D(uState, uv - vec2(t.x, 0.)).rg)
          + dec(texture2D(uState, uv + vec2(0., t.y)).rg) + dec(texture2D(uState, uv - vec2(0., t.y)).rg);
  float nh = (n * .5 - p) * uDamp;
  for (int i = 0; i < 4; i++) {
    vec4 d = uDrops[i];
    if (d.w == 0.) continue;
    float r = length(gl_FragCoord.xy - d.xy) / d.z;
    if (r < 1.) nh += d.w * (.5 + .5 * cos(3.14159 * r));
  }
  gl_FragColor = vec4(enc(nh), enc(h));
}
`;

const DRAW = `
uniform sampler2D uState;
uniform sampler2D uImg;
uniform vec2 uRes;
uniform vec2 uSimRes;
uniform vec2 uImgSize;
uniform float uStrength;
uniform float uChroma;
${CODEC}
float hAt(vec2 uv){
  vec2 p = uv * uSimRes - .5;
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 t = 1. / uSimRes;
  float a = dec(texture2D(uState, (i + vec2(.5, .5)) * t).rg);
  float b = dec(texture2D(uState, (i + vec2(1.5, .5)) * t).rg);
  float c = dec(texture2D(uState, (i + vec2(.5, 1.5)) * t).rg);
  float d = dec(texture2D(uState, (i + vec2(1.5, 1.5)) * t).rg);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
vec2 cover(vec2 uv){
  float ra = uRes.x / uRes.y;
  float ia = uImgSize.x / uImgSize.y;
  vec2 s = ra > ia ? vec2(1., ia / ra) : vec2(ra / ia, 1.);
  return (uv - .5) * s + .5;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 e = 1. / uSimRes;
  float gx = hAt(uv + vec2(e.x, 0.)) - hAt(uv - vec2(e.x, 0.));
  float gy = hAt(uv + vec2(0., e.y)) - hAt(uv - vec2(0., e.y));
  vec2 g = vec2(gx, gy);
  vec2 off = g * .06 * uStrength;
  float ch = uChroma * .22;
  vec3 col;
  col.r = texture2D(uImg, cover(uv + off * (1. + ch))).r;
  col.g = texture2D(uImg, cover(uv + off)).g;
  col.b = texture2D(uImg, cover(uv + off * (1. - ch))).b;
  // wet sheen: highlight minus the flat-surface baseline, plus soft slope shading
  vec3 n = normalize(vec3(-g * 9., 1.));
  vec3 H = normalize(vec3(-.35, .55, 1.));
  float base = pow(H.z / length(H), 90.);
  float spec = max(pow(max(dot(n, H), 0.), 90.) - base, 0.);
  col += spec * .55;
  col *= 1. + (gy - gx) * 1.4;
  gl_FragColor = vec4(col, 1.);
}
`;

const BLIT_VS = (gl2: boolean) => (gl2 ? "#version 300 es\nin vec2 aP;" : "attribute vec2 aP;") + "void main(){gl_Position=vec4(aP,0.,1.);}";

export interface ImageRippleProps {
  src?: string;
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  drawSize?: [number, number];
  strength?: number;
  chroma?: number;
  damping?: number;
  cell?: number;
  radius?: number;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function ImageRipple({
  src,
  draw,
  drawSize = [800, 1000],
  strength = 1,
  chroma = 0.6,
  damping = 0.986,
  cell = 2,
  radius = 14,
  alt = "",
  className,
  style,
  children,
}: ImageRippleProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stillRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const live = useRef({ strength, chroma, damping, cell, radius });
  live.current = { strength, chroma, damping, cell, radius };
  const source = useRef<{ el: TexImageSource | null; w: number; h: number; dirty: boolean }>({ el: null, w: 1, h: 1, dirty: false });
  const api = useRef<{ kick: () => void; drop: (x: number, y: number, s: number, r?: number) => void }>({ kick: () => {}, drop: () => {} });

  // source image
  useEffect(() => {
    let cancelled = false;
    const done = (el: TexImageSource, w: number, h: number) => {
      source.current = { el, w, h, dirty: true };
      api.current.kick();
      const still = stillRef.current;
      if (still) {
        const r = still.getBoundingClientRect();
        still.width = Math.max(1, Math.round(r.width));
        still.height = Math.max(1, Math.round(r.height));
        const c = still.getContext("2d");
        if (c) {
          const s = Math.max(still.width / w, still.height / h);
          c.drawImage(el as CanvasImageSource, (still.width - w * s) / 2, (still.height - h * s) / 2, w * s, h * s);
        }
      }
    };
    if (src) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => !cancelled && done(img, img.naturalWidth, img.naturalHeight);
      img.src = src;
    } else if (draw) {
      const c = document.createElement("canvas");
      c.width = drawSize[0];
      c.height = drawSize[1];
      const ctx = c.getContext("2d");
      if (ctx) draw(ctx, c.width, c.height);
      done(c, c.width, c.height);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, draw, drawSize[0], drawSize[1], failed]);

  // GL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const attrs: WebGLContextAttributes = { antialias: false, alpha: false, preserveDrawingBuffer: false };
    let gl: GL | null = canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null;
    const gl2 = !!gl;
    if (!gl) gl = canvas.getContext("webgl", attrs) as WebGLRenderingContext | null;
    if (!gl) {
      setFailed(true);
      return;
    }
    const g = gl;
    const build = (fs: string) => {
      const mk = (type: number, s: string) => {
        const sh = g.createShader(type)!;
        g.shaderSource(sh, s);
        g.compileShader(sh);
        if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) console.warn("[ImageRipple]", g.getShaderInfoLog(sh));
        return sh;
      };
      const p = g.createProgram()!;
      g.attachShader(p, mk(g.VERTEX_SHADER, BLIT_VS(gl2)));
      g.attachShader(p, mk(g.FRAGMENT_SHADER, HEAD(gl2) + fs));
      g.bindAttribLocation(p, 0, "aP");
      g.linkProgram(p);
      const u: Record<string, WebGLUniformLocation | null> = {};
      for (const m of fs.matchAll(/uniform\s+\w+\s+(\w+)/g)) u[m[1]] = g.getUniformLocation(p, m[1]);
      return { p, u, ok: !!g.getProgramParameter(p, g.LINK_STATUS) };
    };
    const sim = build(SIM);
    const ren = build(DRAW);
    if (!sim.ok || !ren.ok) {
      setFailed(true);
      return;
    }
    const buf = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    g.enableVertexAttribArray(0);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);

    const tex = (filter: number) => {
      const t = g.createTexture()!;
      g.bindTexture(g.TEXTURE_2D, t);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, filter);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, filter);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      return t;
    };
    const imgTex = tex(g.LINEAR);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array([20, 22, 26, 255]));
    let states: { t: WebGLTexture; f: WebGLFramebuffer }[] = [];
    let cur = 0;
    let SW = 1;
    let SH = 1;
    let W = 1;
    let H = 1;
    let dpr = 1;
    const drops: number[][] = [];
    let raf = 0;
    let last = 0;
    let awakeUntil = 0;
    let visible = true;
    let acc = 0;

    const allocSim = () => {
      for (const s of states) {
        g.deleteTexture(s.t);
        g.deleteFramebuffer(s.f);
      }
      SW = Math.max(8, Math.round(W / live.current.cell));
      SH = Math.max(8, Math.round(H / live.current.cell));
      // neutral height (0) encodes to 0x7FFF / 0x8000 → bytes [127/128, 255/0]
      const init = new Uint8Array(SW * SH * 4);
      for (let i = 0; i < init.length; i += 4) {
        init[i] = 128;
        init[i + 1] = 0;
        init[i + 2] = 128;
        init[i + 3] = 0;
      }
      states = [0, 1].map(() => {
        const t = tex(g.NEAREST);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, SW, SH, 0, g.RGBA, g.UNSIGNED_BYTE, init);
        const f = g.createFramebuffer()!;
        g.bindFramebuffer(g.FRAMEBUFFER, f);
        g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0);
        return { t, f };
      });
      g.bindFramebuffer(g.FRAMEBUFFER, null);
    };

    const step = () => {
      const src = states[cur];
      const dst = states[1 - cur];
      g.useProgram(sim.p);
      g.bindFramebuffer(g.FRAMEBUFFER, dst.f);
      g.viewport(0, 0, SW, SH);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, src.t);
      g.uniform1i(sim.u.uState, 0);
      g.uniform2f(sim.u.uSimRes, SW, SH);
      g.uniform1f(sim.u.uDamp, live.current.damping);
      const d = new Float32Array(16);
      drops.splice(0, 4).forEach((v, i) => d.set(v, i * 4));
      g.uniform4fv(sim.u.uDrops, d);
      g.drawArrays(g.TRIANGLES, 0, 3);
      cur = 1 - cur;
    };

    const render = () => {
      const s = source.current;
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      g.viewport(0, 0, canvas.width, canvas.height);
      g.useProgram(ren.p);
      g.activeTexture(g.TEXTURE1);
      g.bindTexture(g.TEXTURE_2D, imgTex);
      if (s.dirty && s.el) {
        g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
        try {
          g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, s.el);
        } catch {
          /* tainted (no CORS) */
        }
        g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
        s.dirty = false;
      }
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, states[cur].t);
      g.uniform1i(ren.u.uState, 0);
      g.uniform1i(ren.u.uImg, 1);
      g.uniform2f(ren.u.uRes, canvas.width, canvas.height);
      g.uniform2f(ren.u.uSimRes, SW, SH);
      g.uniform2f(ren.u.uImgSize, s.w, s.h);
      g.uniform1f(ren.u.uStrength, live.current.strength);
      g.uniform1f(ren.u.uChroma, live.current.chroma);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(now - last, 50) : 16.7;
      last = now;
      // fixed 120 Hz sim so wave speed is frame-rate independent
      acc += dt;
      let n = 0;
      while (acc >= 8.33 && n < 4) {
        step();
        acc -= 8.33;
        n++;
      }
      if (n === 4) acc = 0;
      render();
      if (now < awakeUntil && visible && !document.hidden) raf = requestAnimationFrame(loop);
      else last = 0;
    };
    const kick = (wake = 0) => {
      awakeUntil = Math.max(awakeUntil, performance.now() + wake);
      if (!raf) raf = requestAnimationFrame(loop);
    };
    api.current.kick = () => kick(0);
    api.current.drop = (x, y, s, r) => {
      if (reduced) return;
      const k = live.current.cell;
      drops.push([x / k, (H - y) / k, Math.max(1.5, (r ?? live.current.radius) / k), s]);
      if (drops.length > 12) drops.splice(0, drops.length - 12);
      kick(5000);
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      allocSim();
      kick(0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick(0);
    });
    io.observe(canvas);
    const onVis = () => !document.hidden && kick(0);
    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      raf = 0;
      setFailed(true);
    };
    document.addEventListener("visibilitychange", onVis);
    canvas.addEventListener("webglcontextlost", onLost);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      for (const s of states) {
        g.deleteTexture(s.t);
        g.deleteFramebuffer(s.f);
      }
      g.deleteTexture(imgTex);
      g.deleteBuffer(buf);
      g.deleteProgram(sim.p);
      g.deleteProgram(ren.p);
      api.current = { kick: () => {}, drop: () => {} };
    };
  }, [cell]);

  // pointer → wake
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let lx = -1;
    let ly = -1;
    let lt = 0;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const move = (e: PointerEvent) => {
      const [x, y] = local(e);
      const now = performance.now();
      if (lx < 0) {
        lx = x;
        ly = y;
        lt = now;
        return;
      }
      const dist = Math.hypot(x - lx, y - ly);
      const spacing = live.current.radius * 0.6;
      if (dist < spacing) return;
      const v = Math.min(dist / Math.max(1, now - lt), 3);
      // stamp drops along the segment so fast moves leave a continuous wake
      const steps = Math.min(4, Math.ceil(dist / spacing));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        api.current.drop(lx + (x - lx) * t, ly + (y - ly) * t, 0.08 + 0.09 * v);
      }
      lx = x;
      ly = y;
      lt = now;
    };
    const down = (e: PointerEvent) => {
      const [x, y] = local(e);
      api.current.drop(x, y, 0.55, live.current.radius * 1.6);
    };
    const leave = () => {
      lx = -1;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div ref={rootRef} className={`fd-ripple${className ? " " + className : ""}`} style={style}>
      <style>{css}</style>
      {failed ? (
        <canvas ref={stillRef} className="fd-ripple-canvas" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} />
      ) : (
        <canvas ref={canvasRef} className="fd-ripple-canvas" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} />
      )}
      {children ? <div className="fd-ripple-overlay">{children}</div> : null}
    </div>
  );
}

const css = `
.fd-ripple, .fd-ripple *, .fd-ripple *::before, .fd-ripple *::after { box-sizing: border-box; }
.fd-ripple {
  position: relative; display: block; margin: 0; padding: 0; border: 0; overflow: hidden;
  border-radius: var(--fd-ripple-radius, 24px); background: #14161A; color: inherit; isolation: isolate; touch-action: pan-y;
}
.fd-ripple-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; }
.fd-ripple-overlay { position: absolute; inset: 0; margin: 0; padding: 0; pointer-events: none; }
.fd-ripple-overlay a, .fd-ripple-overlay button { pointer-events: auto; }
`;

/* ───────────────────────── demo ───────────────────────── */

const SCENES: { desc: string; place: string; country: string; coords: string; nights: string; price: string; src: string }[] = [
  { desc: "pastel houses stacked up a hillside above the sea at sunset", place: "Positano", country: "Italy", coords: "40.63° N · 14.48° E", nights: "7 nights", price: "from €3,450", src: "/img/halcyon/positano-sunset.webp" },
  { desc: "sunlit bamboo grove with long shadows", place: "Arashiyama", country: "Japan", coords: "35.01° N · 135.67° E", nights: "9 nights", price: "from €4,980", src: "/img/lux/bamboo.webp" },
  { desc: "wind-carved golden desert dunes at dusk", place: "Wadi Rum", country: "Jordan", coords: "29.57° N · 35.42° E", nights: "6 nights", price: "from €2,890", src: "/img/lux/dunes.webp" },
];

export function Demo() {
  const [order, setOrder] = useState([0, 1, 2]);
  const next = () => setOrder(([a, ...rest]) => [...rest, a]);
  const top = SCENES[order[0]];
  return (
    <section className="fd-ripple-demo">
      <style>{demoCss}</style>
      <div className="fd-ripple-demo-copy">
        <p className="fd-ripple-demo-kicker">Slowtrail · Winter 2026 collection</p>
        <h1 className="fd-ripple-demo-title">Places that make you stop scrolling.</h1>
        <p className="fd-ripple-demo-body">Small-group journeys to the world's quietest edges. Run your cursor over the water — then plan the trip you've been putting off.</p>
        <div className="fd-ripple-demo-row">
          <a className="fd-ripple-demo-cta" href="#book" onClick={(e) => e.preventDefault()}>Explore {top.place}</a>
          <button type="button" className="fd-ripple-demo-next" onClick={next} aria-label="Next destination">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9h10M10 5l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span className="fd-ripple-demo-count" aria-live="polite">{String(order[0] + 1).padStart(2, "0")} / {String(SCENES.length).padStart(2, "0")}</span>
        </div>
      </div>
      <div className="fd-ripple-demo-stack">
        {SCENES.map((s, i) => {
          const pos = order.indexOf(i);
          return (
            <ImageRipple
              key={s.place}
              className="fd-ripple-demo-card"
              src={s.src}
              alt={`${s.place}, ${s.country}: ${s.desc}`}
              style={{ ["--pos" as string]: pos, zIndex: SCENES.length - pos } as CSSProperties}
            >
              <div className="fd-ripple-demo-cap">
                <span className="fd-ripple-demo-coords">{s.coords}</span>
                <span className="fd-ripple-demo-place">{s.place}</span>
                <span className="fd-ripple-demo-country">{s.country}</span>
                <span className="fd-ripple-demo-meta">
                  <span>{s.nights}</span>
                  <span>{s.price}</span>
                </span>
              </div>
            </ImageRipple>
          );
        })}
      </div>
    </section>
  );
}

const demoCss = `
.fd-ripple-demo, .fd-ripple-demo *, .fd-ripple-demo *::before, .fd-ripple-demo *::after { box-sizing: border-box; }
.fd-ripple-demo {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  min-height: 100vh; margin: 0; padding: clamp(32px, 6vw, 88px) clamp(20px, 5vw, 72px);
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: center; gap: clamp(40px, 6vw, 96px);
  background: #F3F0EA; color: #16181D; overflow: hidden;
  font: 400 15px/1.5 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
}
.fd-ripple-demo-copy { max-width: 480px; justify-self: end; margin: 0; padding: 0; }
.fd-ripple-demo-kicker { margin: 0 0 18px; padding: 0; color: #8A6A4E; font: 600 12px/1.3 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.1em; text-transform: uppercase; }
.fd-ripple-demo-title { margin: 0 0 20px; padding: 0; color: #16181D; font: 700 clamp(2.5rem, 4.6vw, 4.25rem)/1 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.04em; }
.fd-ripple-demo-body { max-width: 42ch; margin: 0 0 32px; padding: 0; color: #575A63; font: 400 1.0625rem/1.55 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.01em; }
.fd-ripple-demo-row { display: flex; align-items: center; gap: 12px; margin: 0; padding: 0; }
.fd-ripple-demo-cta {
  display: inline-flex; align-items: center; height: 50px; margin: 0; padding: 0 26px; border: 0; border-radius: 9999px;
  background: #16181D; color: #F7F5F0; text-decoration: none;
  font: 600 15px/1 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.01em;
  transition: transform 120ms var(--fd-ease-out), background 120ms var(--fd-ease-out);
}
.fd-ripple-demo-cta:hover { background: #2C2F37; }
.fd-ripple-demo-cta:active, .fd-ripple-demo-next:active { transform: scale(0.96); }
.fd-ripple-demo-next {
  appearance: none; -webkit-appearance: none; display: inline-flex; align-items: center; justify-content: center;
  width: 50px; height: 50px; margin: 0; padding: 0; border: 1px solid rgba(22,24,29,.16); border-radius: 9999px;
  background: transparent; color: #16181D; cursor: pointer; font: inherit;
  transition: transform 120ms var(--fd-ease-out), background 120ms var(--fd-ease-out);
}
.fd-ripple-demo-next svg { display: block; }
.fd-ripple-demo-next:hover { background: rgba(22,24,29,.06); }
.fd-ripple-demo-cta:focus-visible, .fd-ripple-demo-next:focus-visible { outline: 2px solid rgba(0,122,255,.7); outline-offset: 2px; }
.fd-ripple-demo-count { margin: 0 0 0 6px; padding: 0; color: #8A8D96; font: 500 13px/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; font-variant-numeric: tabular-nums; }
.fd-ripple-demo-stack { position: relative; justify-self: start; width: min(100%, 420px); aspect-ratio: 4 / 5; margin: 0; padding: 0; }
.fd-ripple-demo-stack .fd-ripple-demo-card {
  position: absolute; inset: 0; --fd-ripple-radius: 28px;
  transform: translate(calc(var(--pos) * 34px), calc(var(--pos) * -18px)) rotate(calc(var(--pos) * 4deg)) scale(calc(1 - var(--pos) * 0.06));
  filter: brightness(calc(1 - var(--pos) * 0.12));
  box-shadow: 0 1px 2px rgba(22,24,29,.1), 0 30px 60px -24px rgba(22,24,29,.45);
  transition: transform 420ms var(--fd-spring), filter 420ms var(--fd-ease-out);
  cursor: crosshair;
}
.fd-ripple-demo-cap {
  position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; margin: 0; padding: 72px 24px 22px;
  background: linear-gradient(180deg, rgba(8,10,14,0) 0%, rgba(8,10,14,.55) 55%, rgba(8,10,14,.72) 100%); color: #FFFFFF;
}
.fd-ripple-demo-coords { margin: 0 0 8px; padding: 0; color: rgba(255,255,255,.72); font: 500 11px/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: .08em; }
.fd-ripple-demo-place { margin: 0; padding: 0; color: #FFFFFF; font: 700 2rem/1 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.03em; }
.fd-ripple-demo-country { margin: 6px 0 16px; padding: 0; color: rgba(255,255,255,.85); font: 500 15px/1.3 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; }
.fd-ripple-demo-meta { display: flex; justify-content: space-between; margin: 0; padding: 14px 0 0; border-top: 1px solid rgba(255,255,255,.25); color: #FFFFFF; font: 500 13px/1 ui-sans-serif, -apple-system, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; }
.fd-ripple-demo-meta span { margin: 0; padding: 0; }
@media (max-width: 860px) {
  .fd-ripple-demo { grid-template-columns: 1fr; }
  .fd-ripple-demo-copy { justify-self: start; }
  .fd-ripple-demo-stack { justify-self: center; width: min(78%, 360px); margin-right: 40px; }
}
@media (prefers-reduced-motion: reduce) { .fd-ripple-demo-card { transition: none; } }
`;
