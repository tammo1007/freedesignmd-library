/**
 * LiquidGlass, Apple's Liquid Glass material, rebuilt for the web.
 *
 * A surface for controls and navigation that float ABOVE content. It bends
 * what is behind it like a real glass slab: a convex squircle bevel refracts
 * the backdrop (Snell's law, IOR 1.5) so lines and text bend near the rim
 * while the centre stays flat and readable; a light-facing specular rim, a
 * faint counter-light, slight chromatic dispersion and a touch glow finish it.
 *
 * <LiquidGlass
 *   as="button"            // any element, default "div"
 *   variant="regular"      // "regular" (blur + luminosity, for text) | "clear" (over photos/video)
 *   tone="light"           // regular only: "light" | "dark" foreground/fill scheme
 *   radius="capsule"       // "capsule" | number (px), keep radii concentric
 *   tint="#007AFF"         // optional accent tint (glassProminent)
 *   dim                    // clear only: 35% dark dimming layer for bright content
 *   interactive            // springy press, pointer highlight, touch glow
 *   bezel={20} refraction={1} dispersion={0.05} blur={8}
 * />
 *
 * Also exported: Spring (tiny rAF spring integrator), useSpring,
 * useReducedMotion, useGlassEnv, stretchTransform, createVelocityTracker,
 * GlassScope (render the stylesheet once for many glass elements).
 *
 * Browser support: real refraction uses an SVG displacement filter inside
 * `backdrop-filter: url(#…)`, which only Chromium (Chrome, Edge, Arc, Brave,
 * Opera) supports. Safari and Firefox get a tuned frosted recipe (blur +
 * saturate + brightness) with the same specular rim and highlights.
 * Accessibility: purely visual; pass real elements via `as` (button, nav…).
 * Honors prefers-reduced-transparency (opaque frosted fill),
 * prefers-contrast: more (opaque + solid border) and prefers-reduced-motion
 * (no spring/scale, glow fades only).
 */
import { createContext, forwardRef, useContext, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { AllHTMLAttributes, CSSProperties, ElementType, ReactNode } from "react";

export type GlassVariant = "regular" | "clear";
export type GlassTone = "light" | "dark";

export interface LiquidGlassProps extends Omit<AllHTMLAttributes<HTMLElement>, "as"> {
  /** Element to render. Default "div". */
  as?: ElementType;
  /** "regular" blurs + adjusts luminosity (use with text); "clear" is highly translucent (use over rich media). */
  variant?: GlassVariant;
  /** Regular variant colour scheme. Clear always uses light-on-dark foreground. Default "light". */
  tone?: GlassTone;
  /** Corner radius in px, "capsule" (default), or "auto", read from the element's own border-radius (use for animated morphs). */
  radius?: number | "capsule" | "auto";
  /** Accent tint colour (any CSS colour), makes the glass "prominent". */
  tint?: string;
  /** Adds the 35% dark dimming layer HIG asks for when clear glass sits on bright content. */
  dim?: boolean;
  /** Press bounce, pointer-following highlight and touch glow. */
  interactive?: boolean;
  /** Scale while pressed (interactive only). Default 0.96. Use >1 for "lift". */
  pressScale?: number;
  /** Width of the refracting bevel in px. Default ≈ 26% of the short side (6–40px). */
  bezel?: number;
  /** Refraction strength multiplier. Default 1. */
  refraction?: number;
  /** Chromatic dispersion 0–0.3. Default 0.05. */
  dispersion?: number;
  /** Backdrop blur in px. Defaults: regular 8, clear 0.6. */
  blur?: number;
  /** Drop shadow under the glass. Default true. */
  shadow?: boolean;
  children?: ReactNode;
}

/* ───────────────────────── environment ───────────────────────── */

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type GlassEnv = { refraction: boolean; reducedMotion: boolean; reducedTransparency: boolean };
const SSR_ENV: GlassEnv = { refraction: false, reducedMotion: false, reducedTransparency: false };

function detectChromium(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } };
  const brands = nav.userAgentData?.brands?.map((b) => b.brand).join(" ") ?? "";
  if (/Chromium|Google Chrome|Microsoft Edge|Opera|Brave/i.test(brands)) return true;
  const ua = nav.userAgent;
  return /\b(Chrome|Chromium|HeadlessChrome)\/\d/.test(ua) && !/Firefox|FxiOS/.test(ua);
}

/** Runtime capabilities. SSR-safe: everything is false until mounted. */
export function useGlassEnv(): GlassEnv {
  const [env, setEnv] = useState<GlassEnv>(SSR_ENV);
  useEffect(() => {
    const mm = (q: string) => window.matchMedia(q);
    const rm = mm("(prefers-reduced-motion: reduce)");
    const rt = mm("(prefers-reduced-transparency: reduce)");
    const hc = mm("(prefers-contrast: more)");
    const read = () =>
      setEnv({
        refraction: detectChromium() && !rt.matches && !hc.matches,
        reducedMotion: rm.matches,
        reducedTransparency: rt.matches || hc.matches,
      });
    read();
    [rm, rt, hc].forEach((q) => q.addEventListener?.("change", read));
    return () => [rm, rt, hc].forEach((q) => q.removeEventListener?.("change", read));
  }, []);
  return env;
}

export function useReducedMotion(): boolean {
  return useGlassEnv().reducedMotion;
}

/* ───────────────────────── physics ───────────────────────── */

export type SpringConfig = { stiffness?: number; damping?: number; mass?: number; precision?: number };

/** Semi-implicit Euler spring integrated in rAF. Drives transforms through `onUpdate`. */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  stiffness: number;
  damping: number;
  mass: number;
  precision: number;
  private raf = 0;
  private last = 0;
  constructor(value: number, public onUpdate: (v: number, s: Spring) => void, cfg: SpringConfig = {}) {
    this.value = this.target = value;
    this.stiffness = cfg.stiffness ?? 380;
    this.damping = cfg.damping ?? 30;
    this.mass = cfg.mass ?? 1;
    this.precision = cfg.precision ?? 0.001;
  }
  /** Animate to `target`, optionally injecting a velocity (units/s). */
  to(target: number, velocity?: number) {
    this.target = target;
    if (velocity !== undefined) this.velocity = velocity;
    if (!this.raf && typeof requestAnimationFrame !== "undefined") {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }
  /** Jump without animating. */
  set(v: number) {
    this.stop();
    this.value = this.target = v;
    this.velocity = 0;
    this.onUpdate(v, this);
  }
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  get active() {
    return this.raf !== 0;
  }
  private tick = (now: number) => {
    const dt = Math.min(Math.max((now - this.last) / 1000, 0), 1 / 30);
    this.last = now;
    const steps = 4;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const f = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += (f / this.mass) * h;
      this.value += this.velocity * h;
    }
    const p = this.precision;
    if (Math.abs(this.velocity) < p * 10 && Math.abs(this.value - this.target) < p) {
      this.value = this.target;
      this.velocity = 0;
      this.raf = 0;
      this.onUpdate(this.value, this);
      return;
    }
    this.onUpdate(this.value, this);
    this.raf = requestAnimationFrame(this.tick);
  };
}

/** A stable Spring for the component's lifetime. `onUpdate` may change between renders. */
export function useSpring(initial: number, onUpdate: (v: number) => void, cfg?: SpringConfig): Spring {
  const cb = useRef(onUpdate);
  cb.current = onUpdate;
  const ref = useRef<Spring | null>(null);
  if (!ref.current) ref.current = new Spring(initial, (v) => cb.current(v), cfg);
  useEffect(() => () => ref.current?.stop(), []);
  return ref.current;
}

/** Area-preserving stretch along a velocity vector (px/s). */
export function stretchTransform(vx: number, vy: number, gain = 0.00018, max = 0.32): string {
  const speed = Math.hypot(vx, vy);
  if (speed < 1) return "";
  const a = Math.atan2(vy, vx);
  const s = 1 + Math.min(max, speed * gain);
  return `rotate(${a}rad) scale(${s}, ${1 / s}) rotate(${-a}rad)`;
}

/** Tracks pointer velocity (px/s) over the last ~80ms. */
export function createVelocityTracker() {
  let samples: { x: number; y: number; t: number }[] = [];
  return {
    reset() {
      samples = [];
    },
    push(x: number, y: number, t = performance.now()) {
      samples.push({ x, y, t });
      while (samples.length > 2 && t - samples[0].t > 80) samples.shift();
    },
    get(): { vx: number; vy: number } {
      if (samples.length < 2) return { vx: 0, vy: 0 };
      const a = samples[0];
      const b = samples[samples.length - 1];
      const dt = Math.max((b.t - a.t) / 1000, 1 / 240);
      return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
    },
  };
}

/* ───────────────────────── optics: displacement + specular maps ───────────────────────── */

const LUT_N = 512;
let LUT: { disp: Float32Array; nxy: Float32Array; nz: Float32Array } | null = null;

/** Convex squircle bevel, t: 0 at the rim → 1 where the slab becomes flat. */
const surface = (t: number) => Math.pow(1 - Math.pow(1 - t, 4), 0.25);
const surfaceSlope = (t: number) => {
  const tt = Math.min(Math.max(t, 1e-4), 1);
  return Math.pow(1 - tt, 3) * Math.pow(1 - Math.pow(1 - tt, 4), -0.75);
};

function lut() {
  if (LUT) return LUT;
  const disp = new Float32Array(LUT_N);
  const nxy = new Float32Array(LUT_N);
  const nz = new Float32Array(LUT_N);
  const IOR = 1.5;
  let max = 0;
  for (let i = 0; i < LUT_N; i++) {
    const t = i / (LUT_N - 1);
    const s = surfaceSlope(t);
    const theta = Math.atan(s); // angle of the surface normal from vertical
    const refr = Math.asin(Math.sin(theta) / IOR); // Snell
    const thickness = 0.55 + surface(t); // base slab + bevel height (in bezel units)
    const d = Math.tan(theta - refr) * thickness;
    disp[i] = d;
    max = Math.max(max, d);
    const l = Math.hypot(s, 1);
    nxy[i] = s / l;
    nz[i] = 1 / l;
  }
  for (let i = 0; i < LUT_N; i++) disp[i] /= max;
  LUT = { disp, nxy, nz };
  return LUT;
}

const sample = (arr: Float32Array, t: number) => {
  const f = Math.min(Math.max(t, 0), 1) * (LUT_N - 1);
  const i = Math.floor(f);
  const j = Math.min(i + 1, LUT_N - 1);
  return arr[i] + (arr[j] - arr[i]) * (f - i);
};

let canvas: HTMLCanvasElement | null = null;

/**
 * Builds the displacement map (R,G = dx,dy around 128) and the specular rim
 * image for a w×h rounded rect. Returns data URLs.
 */
export function renderGlassMaps(w: number, h: number, radius: number, bezel: number, dpr = 1, draft = false) {
  const L = lut();
  if (!canvas) canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(radius, hw, hh);
  const rn = Math.min(Math.max(r, bezel), hw, hh); // inflated radius → crease-free normals

  const build = (scale: number, kind: "disp" | "spec") => {
    const mw = Math.max(2, Math.round(w * scale));
    const mh = Math.max(2, Math.round(h * scale));
    canvas!.width = mw;
    canvas!.height = mh;
    const img = ctx.createImageData(mw, mh);
    const data = img.data;
    // light from the top-left, a faint counter light from the bottom-right
    const l1x = -0.5, l1y = -0.72, l1z = 0.48;
    const l2x = 0.55, l2y = 0.7, l2z = 0.45;
    for (let j = 0; j < mh; j++) {
      const py = (j + 0.5) / scale - hh;
      const ay = Math.abs(py);
      for (let i = 0; i < mw; i++) {
        const px = (i + 0.5) / scale - hw;
        const ax = Math.abs(px);
        const o = (j * mw + i) * 4;
        // signed distance to the true rounded rect (negative inside)
        const qx = ax - hw + r;
        const qy = ay - hh + r;
        const dist = qx > 0 && qy > 0 ? Math.hypot(qx, qy) - r : Math.max(qx, qy) - r;
        const inside = -dist;
        if (kind === "disp") {
          data[o + 2] = 128;
          data[o + 3] = 255;
        }
        if (inside <= 0 || inside >= bezel) {
          if (kind === "disp") {
            data[o] = 128;
            data[o + 1] = 128;
          }
          continue;
        }
        const t = inside / bezel;
        // outward normal from the inflated rounded rect
        const nx0 = ax - hw + rn;
        const ny0 = ay - hh + rn;
        let nx: number, ny: number;
        if (nx0 > 0 && ny0 > 0) {
          const l = Math.hypot(nx0, ny0);
          nx = nx0 / l;
          ny = ny0 / l;
        } else if (nx0 > ny0) {
          nx = 1;
          ny = 0;
        } else {
          nx = 0;
          ny = 1;
        }
        if (px < 0) nx = -nx;
        if (py < 0) ny = -ny;
        if (kind === "disp") {
          const m = sample(L.disp, t);
          // sample inward: content near the rim is pulled from inside the slab
          data[o] = Math.round(128 - nx * m * 127);
          data[o + 1] = Math.round(128 - ny * m * 127);
        } else {
          const sxy = sample(L.nxy, t);
          const sz = sample(L.nz, t);
          const Nx = nx * sxy, Ny = ny * sxy, Nz = sz;
          const d1 = Math.max(0, Nx * l1x + Ny * l1y + Nz * l1z);
          const d2 = Math.max(0, Nx * l2x + Ny * l2y + Nz * l2z);
          const rim = Math.pow(sxy, 7); // grazing fresnel line right at the edge
          const a = Math.min(1, 0.95 * Math.pow(d1, 5) * sxy + 0.42 * Math.pow(d2, 5) * sxy + 0.22 * rim);
          data[o] = 255;
          data[o + 1] = 255;
          data[o + 2] = 255;
          data[o + 3] = Math.round(a * 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas!.toDataURL("image/png");
  };

  const base = Math.min(1, (draft ? 300 : 520) / Math.max(w, h));
  const disp = build(base, "disp");
  const specScale = draft ? base : Math.min(Math.min(dpr, 2), 1100 / Math.max(w, h));
  const spec = build(specScale, "spec");
  return { disp, spec };
}

/* ───────────────────────── styles ───────────────────────── */

const ScopeCtx = createContext(false);

/** Renders the glass stylesheet once for every LiquidGlass inside it. */
export function GlassScope({ children }: { children: ReactNode }) {
  return (
    <ScopeCtx.Provider value>
      <style>{GLASS_CSS}</style>
      {children}
    </ScopeCtx.Provider>
  );
}

/* ───────────────────────── component ───────────────────────── */

export const LiquidGlass = forwardRef<HTMLElement, LiquidGlassProps>(function LiquidGlass(
  {
    as: Tag = "div",
    variant = "regular",
    tone = "light",
    radius = "capsule",
    tint,
    dim = false,
    interactive = false,
    pressScale = 0.96,
    bezel,
    refraction = 1,
    dispersion = 0.05,
    blur,
    shadow = true,
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const scoped = useContext(ScopeCtx);
  const rawId = useId();
  const fid = "fd-lg-" + rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const el = useRef<HTMLElement | null>(null);
  const specEl = useRef<HTMLSpanElement | null>(null);
  const feImg = useRef<SVGFEImageElement | null>(null);
  const dR = useRef<SVGFEDisplacementMapElement | null>(null);
  const dG = useRef<SVGFEDisplacementMapElement | null>(null);
  const dB = useRef<SVGFEDisplacementMapElement | null>(null);
  useImperativeHandle(ref, () => el.current as HTMLElement);
  const env = useGlassEnv();

  // keep live params in a ref so the observer never needs re-subscribing
  const params = useRef({ radius, bezel, refraction, dispersion, refract: env.refraction });
  params.current = { radius, bezel, refraction, dispersion, refract: env.refraction };

  /* displacement + specular maps, regenerated on size change only */
  useIsoLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    let raf = 0;
    let timer = 0;
    let lastKey = "";
    const apply = (draft = false) => {
      raf = 0;
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      if (w < 4 || h < 4) return;
      const p = params.current;
      const rad =
        p.radius === "capsule"
          ? Math.min(w, h) / 2
          : Math.min(p.radius === "auto" ? parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0 : p.radius, w / 2, h / 2);
      const bz = Math.max(4, Math.min(p.bezel ?? Math.min(Math.max(Math.min(w, h) * 0.26, 6), 40), Math.min(w, h) / 2));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const key = [w, h, rad, bz, dpr].join(":");
      if (key !== lastKey) {
        const maps = renderGlassMaps(w, h, rad, bz, dpr, draft);
        if (!maps) return;
        if (!draft) lastKey = key;
        if (specEl.current) specEl.current.style.backgroundImage = `url("${maps.spec}")`;
        feImg.current?.setAttribute("href", maps.disp);
      }
      const scale = bz * 0.9 * p.refraction * 2;
      const disp = Math.min(Math.max(p.dispersion, 0), 0.3);
      for (const [e, k] of [[dR.current, 1 - disp], [dG.current, 1], [dB.current, 1 + disp]] as const) e?.setAttribute("scale", String(scale * k));
      if (p.refract) node.style.setProperty("--fd-lg-url", `url(#${fid})`);
      else node.style.removeProperty("--fd-lg-url");
    };
    let first = true;
    const onResize = () => {
      feImg.current?.setAttribute("width", String(node.offsetWidth));
      feImg.current?.setAttribute("height", String(node.offsetHeight));
      if (first) {
        first = false;
        return;
      }
      // live resize (morphs, springs): cheap low-res map in the same frame (ResizeObserver
      // runs before paint), full quality once the size settles
      apply(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => apply(false));
      }, 120);
    };
    onResize();
    apply(false);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    ro?.observe(node);
    return () => {
      ro?.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [fid, radius, bezel, refraction, dispersion, env.refraction]);

  /* interaction: press spring, pointer highlight, touch glow */
  const press = useSpring(1, (v) => el.current?.style.setProperty("--fd-lg-s", v.toFixed(4)), { stiffness: 520, damping: 22 });
  useEffect(() => {
    const node = el.current;
    if (!node || !interactive) return;
    const pos = (e: PointerEvent) => {
      const r = node.getBoundingClientRect();
      const s = Number(node.style.getPropertyValue("--fd-lg-s")) || 1;
      node.style.setProperty("--fd-lg-mx", `${((e.clientX - r.left) / s).toFixed(1)}px`);
      node.style.setProperty("--fd-lg-my", `${((e.clientY - r.top) / s).toFixed(1)}px`);
    };
    const down = (e: PointerEvent) => {
      if ((node as HTMLButtonElement).disabled || node.getAttribute("aria-disabled") === "true") return;
      pos(e);
      node.classList.add("fd-lg--pressed");
      node.classList.remove("fd-lg--released");
      if (env.reducedMotion) return;
      press.stiffness = 900;
      press.damping = 48;
      press.to(pressScale);
    };
    const up = () => {
      if (!node.classList.contains("fd-lg--pressed")) return;
      node.classList.remove("fd-lg--pressed");
      node.classList.add("fd-lg--released");
      if (env.reducedMotion) return;
      press.stiffness = 420;
      press.damping = 14;
      press.to(1, (1 - pressScale) * 18);
    };
    const key = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== " " && e.key !== "Enter")) return;
      node.style.setProperty("--fd-lg-mx", "50%");
      node.style.setProperty("--fd-lg-my", "50%");
      node.classList.add("fd-lg--pressed");
      if (!env.reducedMotion) {
        press.stiffness = 900;
        press.damping = 48;
        press.to(pressScale);
      }
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") up();
    };
    node.addEventListener("pointermove", pos);
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointerenter", pos);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    node.addEventListener("keydown", key);
    node.addEventListener("keyup", keyUp);
    node.addEventListener("blur", up);
    return () => {
      node.removeEventListener("pointermove", pos);
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointerenter", pos);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      node.removeEventListener("keydown", key);
      node.removeEventListener("keyup", keyUp);
      node.removeEventListener("blur", up);
    };
  }, [interactive, pressScale, env.reducedMotion, press]);

  const vars: Record<string, string | number> = {};
  if (radius !== "auto") vars["--fd-lg-r"] = radius === "capsule" ? "9999px" : `${radius}px`;
  if (blur !== undefined) vars["--fd-lg-blur"] = `${blur}px`;
  if (tint) vars["--fd-lg-tint"] = tint;

  const cls = [
    "fd-lg",
    `fd-lg--${variant}`,
    variant === "regular" ? `fd-lg--${tone}` : "fd-lg--dark",
    tint ? "fd-lg--tinted" : "",
    dim ? "fd-lg--dim" : "",
    interactive ? "fd-lg--interactive" : "",
    shadow ? "" : "fd-lg--flat",
    env.refraction ? "fd-lg--refract" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag ref={el} className={cls} style={{ ...(vars as CSSProperties), ...style }} {...rest}>
      {!scoped && <style>{GLASS_CSS}</style>}
      <svg className="fd-lg-svg" aria-hidden="true" focusable="false" width="0" height="0">
        <filter id={fid} colorInterpolationFilters="sRGB">
          <feImage ref={feImg} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
          <feDisplacementMap ref={dR} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="dr" />
          <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feDisplacementMap ref={dG} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="dg" />
          <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feDisplacementMap ref={dB} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="db" />
          <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
          <feComposite in="r" in2="g" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rg" />
          <feComposite in="rg" in2="b" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>
      </svg>
      <span className="fd-lg-layer fd-lg-fill" aria-hidden="true" />
      {dim && <span className="fd-lg-layer fd-lg-dimmer" aria-hidden="true" />}
      <span ref={specEl} className="fd-lg-layer fd-lg-spec" aria-hidden="true" />
      <span className="fd-lg-layer fd-lg-edge" aria-hidden="true" />
      {interactive && <span className="fd-lg-layer fd-lg-glow" aria-hidden="true" />}
      {children}
    </Tag>
  );
});

/* ───────────────────────── demo ───────────────────────── */

const LENS = 184;

export function Demo() {
  const stage = useRef<HTMLDivElement | null>(null);
  const lens = useRef<HTMLElement | null>(null);
  const env = useGlassEnv();

  const paint = () => {
    const node = lens.current;
    if (!node) return;
    const st = env.reducedMotion ? "" : stretchTransform(sx.velocity, sy.velocity, 0.00022, 0.28);
    node.style.setProperty("--fd-lg-pre", `translate(${sx.value.toFixed(2)}px, ${sy.value.toFixed(2)}px) ${st}`);
  };
  const sx = useSpring(0, paint, { stiffness: 380, damping: 30 });
  const sy = useSpring(0, paint, { stiffness: 380, damping: 30 });

  const bounds = () => {
    const s = stage.current!;
    return { maxX: Math.max(0, s.clientWidth - LENS), maxY: Math.max(0, s.clientHeight - LENS) };
  };

  // start centred, a little off to the left so the lens straddles the shapes
  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    sx.set(s.clientWidth / 2 - LENS / 2 - 36);
    sy.set(s.clientHeight / 2 - LENS / 2 + 4);
    const onResize = () => {
      const b = bounds();
      sx.to(Math.min(Math.max(sx.target, 0), b.maxX));
      sy.to(Math.min(Math.max(sy.target, 0), b.maxY));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dragging with elastic stretch and a springy throw
  useEffect(() => {
    const node = lens.current;
    if (!node) return;
    const vt = createVelocityTracker();
    let dragging = false;
    let ox = 0, oy = 0;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      node.setPointerCapture(e.pointerId);
      dragging = true;
      ox = e.clientX - sx.value;
      oy = e.clientY - sy.value;
      vt.reset();
      vt.push(e.clientX, e.clientY);
      sx.stiffness = sy.stiffness = env.reducedMotion ? 4000 : 700;
      sx.damping = sy.damping = env.reducedMotion ? 130 : 42;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      vt.push(e.clientX, e.clientY);
      const b = bounds();
      const rb = (v: number, max: number) => (v < 0 ? v * 0.35 : v > max ? max + (v - max) * 0.35 : v);
      sx.to(rb(e.clientX - ox, b.maxX));
      sy.to(rb(e.clientY - oy, b.maxY));
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      const { vx, vy } = vt.get();
      const b = bounds();
      const k = env.reducedMotion ? 0 : 0.11;
      sx.stiffness = sy.stiffness = 260;
      sx.damping = sy.damping = 20;
      sx.to(Math.min(Math.max(sx.target + vx * k, 0), b.maxX), env.reducedMotion ? 0 : vx * 0.4);
      sy.to(Math.min(Math.max(sy.target + vy * k, 0), b.maxY), env.reducedMotion ? 0 : vy * 0.4);
    };
    const key = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 64 : 20;
      const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const v = d[e.key];
      if (!v) return;
      e.preventDefault();
      const b = bounds();
      sx.stiffness = sy.stiffness = 380;
      sx.damping = sy.damping = 30;
      sx.to(Math.min(Math.max(sx.target + v[0], 0), b.maxX));
      sy.to(Math.min(Math.max(sy.target + v[1], 0), b.maxY));
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    node.addEventListener("keydown", key);
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.removeEventListener("keydown", key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env.reducedMotion]);

  return (
    <div className="fd-lgx" ref={stage}>
      <style>{DEMO_CSS}</style>
      <span className="fd-lgx-shape fd-lgx-shape--a" aria-hidden="true" />
      <span className="fd-lgx-shape fd-lgx-shape--b" aria-hidden="true" />
      <span className="fd-lgx-shape fd-lgx-shape--c" aria-hidden="true" />
      <GlassScope>
        <LiquidGlass
          ref={lens}
          as="div"
          role="button"
          tabIndex={0}
          aria-label="Glass lens. Drag it, or use the arrow keys to move it."
          className="fd-lgx-lens"
          variant="clear"
          radius={LENS / 2}
          interactive
          pressScale={1.06}
          refraction={1.2}
          dispersion={0.08}
        />
      </GlassScope>
    </div>
  );
}

const FONT = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const DEMO_CSS = `
.fd-lgx,.fd-lgx *,.fd-lgx *::before,.fd-lgx *::after{box-sizing:border-box}
.fd-lgx{position:relative;height:100vh;min-height:520px;width:100%;overflow:hidden;margin:0;padding:0;color:#1d1d1f;font:400 15px/1.4 ${FONT};letter-spacing:normal;touch-action:none;
  background:radial-gradient(46% 62% at 28% 32%,#ffcfa6 0%,transparent 70%),radial-gradient(44% 58% at 74% 68%,#b7c3ff 0%,transparent 70%),radial-gradient(30% 40% at 62% 22%,#ffc2dc 0%,transparent 70%),#f1eeea}
.fd-lgx-shape{position:absolute;display:block;margin:0;padding:0;pointer-events:none}
.fd-lgx-shape--a{left:calc(50% - 190px);top:calc(50% - 70px);width:150px;height:150px;border-radius:50%;background:#ff8a6b}
.fd-lgx-shape--b{left:calc(50% - 20px);top:calc(50% - 130px);width:150px;height:150px;border-radius:38px;background:#5b6cff;transform:rotate(14deg)}
.fd-lgx-shape--c{left:calc(50% - 30px);top:calc(50% + 40px);width:210px;height:34px;border-radius:999px;background:#fff}
.fd-lgx-lens{position:absolute;left:0;top:0;width:${LENS}px;height:${LENS}px;border-radius:50%;cursor:grab;touch-action:none;will-change:transform;z-index:2}
.fd-lgx-lens.fd-lg--pressed{cursor:grabbing}
`;

const GLASS_CSS = `
.fd-lg{
  --fd-ease-out:cubic-bezier(0.22,1,0.36,1);--fd-ease-in-out:cubic-bezier(0.65,0,0.35,1);--fd-spring:cubic-bezier(0.34,1.56,0.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-lg-url:blur(0px);
  --fd-lg-blur:8px;--fd-lg-sat:1.8;--fd-lg-bright:1.06;--fd-lg-contrast:0.92;
  --fd-lg-fill:rgba(255,255,255,0.30);
  --fd-lg-fg:#0B0B0F;
  --fd-lg-edge-a:rgba(255,255,255,0.95);--fd-lg-edge-b:rgba(255,255,255,0.18);--fd-lg-edge-c:rgba(255,255,255,0.55);
  --fd-lg-shadow:0 12px 32px -10px rgba(10,10,20,0.28),0 2px 6px -1px rgba(10,10,20,0.10);
  --fd-lg-spec-o:0.9;
  isolation:isolate;box-sizing:border-box;margin:0;border:0;
  background:transparent;color:var(--fd-lg-fg);text-decoration:none;
  -webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;
  -webkit-backdrop-filter:blur(var(--fd-lg-blur)) saturate(var(--fd-lg-sat)) brightness(var(--fd-lg-bright)) contrast(var(--fd-lg-contrast));
  backdrop-filter:var(--fd-lg-url) blur(var(--fd-lg-blur)) saturate(var(--fd-lg-sat)) brightness(var(--fd-lg-bright)) contrast(var(--fd-lg-contrast));
  box-shadow:var(--fd-lg-shadow);
}
:where(.fd-lg){position:relative;padding:0;border-radius:var(--fd-lg-r,0px);font:500 15px/1.25 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;text-align:center}
.fd-lg *,.fd-lg *::before,.fd-lg *::after{box-sizing:border-box}
.fd-lg--flat{--fd-lg-shadow:none}
.fd-lg--regular.fd-lg--dark{--fd-lg-fill:rgba(30,30,36,0.42);--fd-lg-fg:#FFFFFF;--fd-lg-bright:0.92;--fd-lg-edge-a:rgba(255,255,255,0.55);--fd-lg-edge-b:rgba(255,255,255,0.08);--fd-lg-edge-c:rgba(255,255,255,0.28);--fd-lg-spec-o:0.55;--fd-lg-shadow:0 14px 36px -12px rgba(0,0,0,0.6),0 2px 6px -1px rgba(0,0,0,0.3)}
.fd-lg--clear{--fd-lg-blur:0.5px;--fd-lg-sat:1.3;--fd-lg-bright:1.03;--fd-lg-contrast:1;--fd-lg-fill:rgba(255,255,255,0.05);--fd-lg-fg:#FFFFFF;--fd-lg-spec-o:1;--fd-lg-shadow:0 10px 30px -10px rgba(0,0,0,0.35),0 1px 3px rgba(0,0,0,0.12);text-shadow:0 1px 2px rgba(0,0,0,0.28)}
.fd-lg--clear:not(.fd-lg--refract){--fd-lg-blur:2.5px;--fd-lg-sat:1.5;--fd-lg-fill:rgba(255,255,255,0.12)}
.fd-lg--regular:not(.fd-lg--refract){--fd-lg-blur:16px}
.fd-lg--tinted{--fd-lg-fg:#FFFFFF;text-shadow:none}
.fd-lg--tinted.fd-lg--regular{--fd-lg-fill:color-mix(in srgb,var(--fd-lg-tint) 84%,transparent)}
.fd-lg--tinted.fd-lg--clear{--fd-lg-fill:color-mix(in srgb,var(--fd-lg-tint) 58%,transparent)}
.fd-lg-svg{position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;display:block;margin:0;padding:0;border:0}
.fd-lg-layer{position:absolute;inset:0;z-index:-1;display:block;margin:0;padding:0;border:0;border-radius:inherit;pointer-events:none;background:none}
.fd-lg-fill{background:var(--fd-lg-fill);box-shadow:inset 0 0 18px -6px rgba(255,255,255,0.22)}
.fd-lg-dimmer{background:rgba(0,0,0,0.35)}
.fd-lg-spec{background-size:100% 100%;background-repeat:no-repeat;opacity:var(--fd-lg-spec-o);transition:opacity var(--fd-dur-2) var(--fd-ease-out)}
.fd-lg-edge{padding:1px;background:linear-gradient(140deg,var(--fd-lg-edge-a),var(--fd-lg-edge-b) 34%,var(--fd-lg-edge-b) 62%,var(--fd-lg-edge-c));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.fd-lg--interactive{transform:var(--fd-lg-pre,translate(0,0)) scale(var(--fd-lg-s,1));cursor:pointer;touch-action:manipulation}
.fd-lg-glow{opacity:0;transition:opacity var(--fd-dur-3) var(--fd-ease-out);
  background:radial-gradient(circle at var(--fd-lg-mx,50%) var(--fd-lg-my,50%),rgba(255,255,255,0.55),rgba(255,255,255,0.14) 38%,transparent 70%);
  background-size:100% 100%;mix-blend-mode:plus-lighter}
.fd-lg--interactive:hover .fd-lg-glow{opacity:0.35}
.fd-lg--pressed .fd-lg-glow{opacity:1;transition-duration:var(--fd-dur-1)}
.fd-lg--released .fd-lg-glow{transition-duration:var(--fd-dur-4)}
.fd-lg:focus-visible{outline:2px solid color-mix(in srgb,#0A84FF 70%,transparent);outline-offset:2px}
.fd-lg[disabled],.fd-lg[aria-disabled="true"]{cursor:default}
@media (prefers-reduced-transparency: reduce){
  .fd-lg{-webkit-backdrop-filter:none;backdrop-filter:none;text-shadow:none}
  .fd-lg .fd-lg-fill{background:#ECECF0}
  .fd-lg--dark .fd-lg-fill{background:#2A2A31}
  .fd-lg--tinted .fd-lg-fill{background:var(--fd-lg-tint)}
  .fd-lg--regular.fd-lg--light:not(.fd-lg--tinted){--fd-lg-fg:#0B0B0F}
  .fd-lg-spec{opacity:0.25}
  .fd-lg-dimmer{display:none}
}
@media (prefers-contrast: more){
  .fd-lg{-webkit-backdrop-filter:none;backdrop-filter:none;text-shadow:none}
  .fd-lg .fd-lg-fill{background:#FFFFFF}
  .fd-lg--dark .fd-lg-fill{background:#000000}
  .fd-lg--tinted .fd-lg-fill{background:var(--fd-lg-tint)}
  .fd-lg--regular.fd-lg--light:not(.fd-lg--tinted){--fd-lg-fg:#000000}
  .fd-lg-spec,.fd-lg-dimmer{display:none}
  .fd-lg-edge{-webkit-mask:none;mask:none;background:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.75)}
  .fd-lg--dark .fd-lg-edge{box-shadow:inset 0 0 0 1px rgba(255,255,255,0.8)}
}
@media (prefers-reduced-motion: reduce){
  .fd-lg--interactive{transform:var(--fd-lg-pre,none)}
  .fd-lg-glow{transition-duration:var(--fd-dur-1)}
}
`;
