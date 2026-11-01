/**
 * LiquidGlass — Apple's Liquid Glass material, rebuilt for the web.
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
 *   radius="capsule"       // "capsule" | number (px) — keep radii concentric
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
import type { AllHTMLAttributes, CSSProperties, ElementType, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

export type GlassVariant = "regular" | "clear";
export type GlassTone = "light" | "dark";

export interface LiquidGlassProps extends Omit<AllHTMLAttributes<HTMLElement>, "as"> {
  /** Element to render. Default "div". */
  as?: ElementType;
  /** "regular" blurs + adjusts luminosity (use with text); "clear" is highly translucent (use over rich media). */
  variant?: GlassVariant;
  /** Regular variant colour scheme. Clear always uses light-on-dark foreground. Default "light". */
  tone?: GlassTone;
  /** Corner radius in px, "capsule" (default), or "auto" — read from the element's own border-radius (use for animated morphs). */
  radius?: number | "capsule" | "auto";
  /** Accent tint colour (any CSS colour) — makes the glass "prominent". */
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

/* ───────────────────────── demo: a lens over an editorial spread ───────────────────────── */

type LensShape = "capsule" | "circle" | "rounded";
const LENS_SIZE: Record<LensShape, (compact: boolean) => { w: number; h: number; r: number }> = {
  capsule: (c) => (c ? { w: 232, h: 96, r: 48 } : { w: 340, h: 132, r: 66 }),
  circle: (c) => (c ? { w: 148, h: 148, r: 74 } : { w: 196, h: 196, r: 98 }),
  rounded: (c) => (c ? { w: 220, h: 150, r: 34 } : { w: 300, h: 200, r: 44 }),
};

export function Demo() {
  const stage = useRef<HTMLDivElement | null>(null);
  const lens = useRef<HTMLElement | null>(null);
  const [variant, setVariant] = useState<GlassVariant>("clear");
  const [shape, setShape] = useState<LensShape>("capsule");
  const [dim, setDim] = useState(false);
  const [touched, setTouched] = useState(false);
  const [compact, setCompact] = useState(false);
  const env = useGlassEnv();
  const motion = useRef({ x: 0, y: 0, dragging: false });

  const paint = () => {
    const node = lens.current;
    if (!node) return;
    const st = env.reducedMotion ? "" : stretchTransform(sx.velocity, sy.velocity, 0.00022, 0.28);
    node.style.setProperty("--fd-lg-pre", `translate(${sx.value.toFixed(2)}px, ${sy.value.toFixed(2)}px) ${st}`);
  };
  const sx = useSpring(0, paint, { stiffness: 380, damping: 30 });
  const sy = useSpring(0, paint, { stiffness: 380, damping: 30 });
  const sw = useSpring(340, (v) => lens.current?.style.setProperty("width", `${v}px`), { stiffness: 380, damping: 28 });
  const sh = useSpring(132, (v) => lens.current?.style.setProperty("height", `${v}px`), { stiffness: 380, damping: 28 });
  const sr = useSpring(66, (v) => lens.current?.style.setProperty("border-radius", `${v}px`), { stiffness: 380, damping: 30 });

  const bounds = () => {
    const s = stage.current!;
    const n = lens.current!;
    return { maxX: s.clientWidth - n.offsetWidth, maxY: s.clientHeight - n.offsetHeight - (compact ? 92 : 96) };
  };

  // initial placement + a gentle entrance glide
  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    const c = s.clientWidth < 640;
    setCompact(c);
    const z = LENS_SIZE.capsule(c);
    sw.set(z.w);
    sh.set(z.h);
    sr.set(z.r);
    const h1 = s.querySelector(".fd-lgx-h1")?.getBoundingClientRect();
    const sr0 = s.getBoundingClientRect();
    const tx = h1 ? Math.min(h1.left - sr0.left + (c ? 24 : h1.width * 0.18), s.clientWidth - z.w - 12) : 24;
    const ty = h1 ? h1.top - sr0.top + h1.height * (c ? 0.5 : 0.46) - z.h / 2 : 140;
    if (env.reducedMotion) {
      sx.set(tx);
      sy.set(ty);
    } else {
      sx.set(tx - 140);
      sy.set(ty + 40);
      sx.stiffness = sy.stiffness = 90;
      sx.damping = sy.damping = 16;
      sx.to(tx);
      sy.to(ty);
    }
    const onResize = () => {
      const b = bounds();
      sx.to(Math.min(Math.max(sx.target, 0), Math.max(0, b.maxX)));
      sy.to(Math.min(Math.max(sy.target, 0), Math.max(0, b.maxY)));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env.reducedMotion]);

  // morph between shapes, keeping the lens centred
  useEffect(() => {
    if (!stage.current) return;
    const z = LENS_SIZE[shape](compact);
    const cx = sx.target + sw.target / 2;
    const cy = sy.target + sh.target / 2;
    const s = stage.current;
    const nx = Math.min(Math.max(cx - z.w / 2, 0), s.clientWidth - z.w);
    const ny = Math.min(Math.max(cy - z.h / 2, 0), s.clientHeight - z.h - 96);
    if (env.reducedMotion) {
      sw.set(z.w), sh.set(z.h), sr.set(z.r), sx.set(nx), sy.set(ny);
      return;
    }
    sx.stiffness = sy.stiffness = 380;
    sx.damping = sy.damping = 30;
    sw.to(z.w), sh.to(z.h), sr.to(z.r), sx.to(nx), sy.to(ny);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape]);

  // dragging with elastic stretch and a springy throw
  useEffect(() => {
    const node = lens.current;
    if (!node) return;
    const vt = createVelocityTracker();
    let ox = 0, oy = 0;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      node.setPointerCapture(e.pointerId);
      setTouched(true);
      motion.current.dragging = true;
      ox = e.clientX - sx.value;
      oy = e.clientY - sy.value;
      vt.reset();
      vt.push(e.clientX, e.clientY);
      sx.stiffness = sy.stiffness = env.reducedMotion ? 4000 : 700;
      sx.damping = sy.damping = env.reducedMotion ? 130 : 42;
    };
    const move = (e: PointerEvent) => {
      if (!motion.current.dragging) return;
      vt.push(e.clientX, e.clientY);
      const b = bounds();
      // rubber-band past the edges
      const rb = (v: number, max: number) => (v < 0 ? v * 0.35 : v > max ? max + (v - max) * 0.35 : v);
      sx.to(rb(e.clientX - ox, b.maxX));
      sy.to(rb(e.clientY - oy, b.maxY));
    };
    const up = () => {
      if (!motion.current.dragging) return;
      motion.current.dragging = false;
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
      setTouched(true);
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
  }, [env.reducedMotion, compact]);

  return (
    <div className="fd-lgx" ref={stage}>
      <style>{DEMO_CSS}</style>
      <GlassScope>
        <div className="fd-lgx-scroll" tabIndex={0} aria-label="Lumen, issue 14 — scrollable article">
          <Spread />
        </div>

        <LiquidGlass
          ref={lens}
          as="div"
          role="button"
          tabIndex={0}
          aria-label="Glass lens. Drag it, or use the arrow keys to move it."
          className="fd-lgx-lens"
          variant={variant}
          tone="light"
          radius="auto"
          dim={variant === "clear" && dim}
          interactive
          pressScale={1.06}
          refraction={1.1}
          dispersion={0.06}
        >
          <span className={`fd-lgx-hint${touched ? " is-gone" : ""}`} aria-hidden="true">
            <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Drag me
          </span>
        </LiquidGlass>

        <LiquidGlass as="div" className="fd-lgx-bar" variant="regular" tone="light" role="toolbar" aria-label="Lens settings">
          <Segmented
            label="Variant"
            value={variant}
            onChange={(v) => setVariant(v as GlassVariant)}
            options={[
              { value: "regular", label: "Regular" },
              { value: "clear", label: "Clear" },
            ]}
          />
          <span className="fd-lgx-sep" aria-hidden="true" />
          <Segmented
            label="Shape"
            value={shape}
            onChange={(v) => setShape(v as LensShape)}
            options={[
              { value: "capsule", label: "Capsule", icon: <rect x="2" y="5.5" width="14" height="7" rx="3.5" /> },
              { value: "circle", label: "Circle", icon: <circle cx="9" cy="9" r="6" /> },
              { value: "rounded", label: "Rounded", icon: <rect x="2.5" y="4" width="13" height="10" rx="3" /> },
            ]}
            iconOnly
          />
          <span className="fd-lgx-sep" aria-hidden="true" />
          <button
            type="button"
            className="fd-lgx-dim"
            role="switch"
            aria-checked={dim}
            disabled={variant !== "clear"}
            onClick={() => setDim((d) => !d)}
            title="35% dimming layer for clear glass over bright content"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="6.25" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 2.75a6.25 6.25 0 0 1 0 12.5Z" fill="currentColor" />
            </svg>
            <span>Dim</span>
          </button>
        </LiquidGlass>
      </GlassScope>
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
  iconOnly,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; icon?: ReactNode }[];
  onChange: (v: string) => void;
  iconOnly?: boolean;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const onKey = (e: ReactKeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (idx + d + options.length) % options.length;
    onChange(options[n].value);
    const btn = (e.currentTarget as HTMLElement).querySelectorAll("button")[n];
    btn?.focus();
  };
  return (
    <div className={`fd-lgx-seg${iconOnly ? " is-icons" : ""}`} role="radiogroup" aria-label={label} onKeyDown={onKey} style={{ "--n": options.length, "--i": idx } as CSSProperties}>
      <span className="fd-lgx-seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={iconOnly ? o.label : undefined}
          title={iconOnly ? o.label : undefined}
          tabIndex={o.value === value ? 0 : -1}
          className="fd-lgx-seg-btn"
          onClick={() => onChange(o.value)}
        >
          {o.icon ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              {o.icon}
            </svg>
          ) : null}
          {!iconOnly && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

/** The content layer: an editorial spread with type, procedural photographs and fine line work. */
function Spread() {
  return (
    <article className="fd-lgx-paper">
      <header className="fd-lgx-mast">
        <span className="fd-lgx-logo">LUMEN</span>
        <span>Journal of light &amp; material</span>
        <span>No. 14 — Winter 2026</span>
        <span>€14 / CHF 16</span>
      </header>
      <div className="fd-lgx-rules" aria-hidden="true" />
      <section className="fd-lgx-hero">
        <p className="fd-lgx-kicker">Feature · Optics</p>
        <h1 className="fd-lgx-h1">
          Light,<br />
          <em>bent.</em>
        </h1>
        <p className="fd-lgx-dek">
          Glass doesn’t hide what’s behind it. It borrows it, curves it around its edges and hands it back a little brighter. A field guide to the
          physics behind the interfaces of 2026.
        </p>
        <p className="fd-lgx-byline">Words by Ines Vahlkamp · Photographs by Teodor Brask</p>
      </section>

      <section className="fd-lgx-plates" aria-label="Photographs">
        <figure className="fd-lgx-plate">
          <div className="fd-lgx-ph fd-lgx-ph--dune" />
          <figcaption>
            <b>Atacama, 04:52.</b> First light on the salt flats near San Pedro.
          </figcaption>
        </figure>
        <figure className="fd-lgx-plate">
          <div className="fd-lgx-ph fd-lgx-ph--sea" />
          <figcaption>
            <b>Faroe Islands.</b> Swell lines off Gásadalur, 1/2000 s.
          </figcaption>
        </figure>
        <figure className="fd-lgx-plate">
          <div className="fd-lgx-ph fd-lgx-ph--citrus" />
          <figcaption>
            <b>Mercato di Ballarò.</b> Blood oranges, Palermo, February.
          </figcaption>
        </figure>
        <figure className="fd-lgx-plate">
          <div className="fd-lgx-ph fd-lgx-ph--house" />
          <figcaption>
            <b>Glasshouse, Kyoto.</b> 1,184 panes, none of them flat.
          </figcaption>
        </figure>
      </section>

      <section className="fd-lgx-cols">
        <p>
          <span className="fd-lgx-drop">E</span>very lens is a negotiation between thickness and curvature. Near its rim, a slab of glass meets the
          air at a steep angle, and the light passing through is bent hardest there — straight lines bow, letters lean inward, colour separates into
          a thin prism of red and blue. Towards the centre the surface flattens out and the world comes through almost untouched.
        </p>
        <p>
          That is the whole trick behind the new generation of interface materials. A control drawn as a slab of glass reads as an object that
          floats above the page, not a hole cut into it. It stays legible because the middle stays calm, and it feels physical because the edges
          do exactly what a real edge would do.
        </p>
        <p>
          Designers at the Hokuto studio in Kyoto spent eleven months measuring how light falls across curved panes before settling on a squircle
          profile: a curve that rises quickly at the rim and then levels off, so the refraction band stays narrow and bright.
        </p>
      </section>

      <section className="fd-lgx-index" aria-label="Refractive index table">
        <h2 className="fd-lgx-h2">Index of refraction</h2>
        <ul>
          <li><span>Air</span><i /><b>1.000</b></li>
          <li><span>Water, 20 °C</span><i /><b>1.333</b></li>
          <li><span>Crown glass</span><i /><b>1.520</b></li>
          <li><span>Flint glass</span><i /><b>1.620</b></li>
          <li><span>Sapphire</span><i /><b>1.770</b></li>
          <li><span>Diamond</span><i /><b>2.417</b></li>
        </ul>
      </section>

      <section className="fd-lgx-test" aria-label="Calibration plate">
        <div className="fd-lgx-bars" />
        <div className="fd-lgx-grid" />
        <p className="fd-lgx-cap">Plate 7 — calibration chart used for every photograph in this issue.</p>
      </section>

      <section className="fd-lgx-quote">
        <p>“The best material is the one you only notice at its edges.”</p>
        <span>— Mariko Tsuji, Hokuto Glassworks</span>
      </section>
      <footer className="fd-lgx-foot">
        <span>LUMEN 14</span>
        <span>Page 38</span>
      </footer>
    </article>
  );
}

const FONT = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const DISPLAY = `"SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif`;
const SERIF = `"New York","Iowan Old Style","Source Serif 4",Georgia,"Times New Roman",serif`;

const DEMO_CSS = `
.fd-lgx,.fd-lgx *,.fd-lgx *::before,.fd-lgx *::after{box-sizing:border-box}
.fd-lgx{position:relative;height:100vh;min-height:600px;width:100%;overflow:hidden;margin:0;padding:0;background:#F3EFE6;color:#0B0B0F;font:400 15px/1.5 ${FONT};letter-spacing:normal;touch-action:pan-y}
.fd-lgx-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;margin:0;padding:0;outline:none;scrollbar-width:none;overscroll-behavior:contain}
.fd-lgx-scroll::-webkit-scrollbar{display:none}
.fd-lgx-paper{display:block;max-width:1180px;margin:0 auto;padding:28px 40px 160px;background:none;color:#0B0B0F}
.fd-lgx-paper h1,.fd-lgx-paper h2,.fd-lgx-paper p,.fd-lgx-paper figure,.fd-lgx-paper figcaption,.fd-lgx-paper ul,.fd-lgx-paper li{margin:0;padding:0;border:0;background:none;color:inherit}
.fd-lgx-mast{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin:0;padding:0 0 12px;font:500 12px/1.3 ${FONT};letter-spacing:0.08em;text-transform:uppercase;color:#0B0B0F}
.fd-lgx-logo{font:800 24px/1 ${DISPLAY};letter-spacing:0.18em}
.fd-lgx-rules{height:14px;margin:0 0 40px;background:repeating-linear-gradient(180deg,#0B0B0F 0 1.5px,transparent 1.5px 4px)}
.fd-lgx-hero{display:grid;grid-template-columns:1.25fr 1fr;grid-template-areas:"k k" "h d" "h b";column-gap:56px;align-items:end;margin:0 0 56px}
.fd-lgx-kicker{grid-area:k;margin:0 0 8px;font:600 13px/1.3 ${FONT};letter-spacing:0.12em;text-transform:uppercase;color:#C2410C}
.fd-lgx-h1{grid-area:h;margin:0;font:800 clamp(4rem,11vw,9.5rem)/0.86 ${DISPLAY};letter-spacing:-0.055em;color:#0B0B0F}
.fd-lgx-h1 em{font:italic 400 1em/0.86 ${SERIF};letter-spacing:-0.035em;color:#1D4ED8}
.fd-lgx-dek{grid-area:d;margin:0 0 18px;font:400 1.25rem/1.45 ${SERIF};color:#1C1C22;max-width:30ch}
.fd-lgx-byline{grid-area:b;margin:0 0 10px;font:500 13px/1.4 ${FONT};color:#6B6B76}
.fd-lgx-plates{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:0 0 56px}
.fd-lgx-plate{display:block;margin:0}
.fd-lgx-plate figcaption{margin:10px 0 0;font:400 13px/1.45 ${FONT};color:#3A3A44}
.fd-lgx-plate figcaption b{font-weight:650;color:#0B0B0F}
.fd-lgx-ph{display:block;aspect-ratio:4/5;border-radius:4px;overflow:hidden;position:relative}
.fd-lgx-ph--dune{background:
  radial-gradient(circle at 70% 38%,#FFF6D6 0 7%,rgba(255,220,150,0.6) 8%,transparent 22%),
  linear-gradient(176deg,transparent 0 55%,rgba(120,40,20,0.25) 55.5%,transparent 70%),
  repeating-linear-gradient(172deg,rgba(90,30,10,0.0) 0 10px,rgba(90,30,10,0.18) 10px 11px),
  linear-gradient(180deg,#2B1B4F 0%,#B6427A 32%,#F28C4B 52%,#F6C177 62%,#C8693A 63%,#7A2E1C 100%)}
.fd-lgx-ph--sea{background:
  repeating-linear-gradient(178deg,rgba(255,255,255,0) 0 13px,rgba(255,255,255,0.55) 13px 14.5px,rgba(255,255,255,0) 14.5px 22px),
  linear-gradient(180deg,#D8E8EE 0%,#9CC2CF 28%,#1F6F7A 30%,#0E4652 62%,#06222B 100%)}
.fd-lgx-ph--citrus{background:
  radial-gradient(circle at 28% 30%,#FFB347 0 13%,#E8590C 14%,#B42318 18%,transparent 18.5%),
  radial-gradient(circle at 70% 26%,#FFC56E 0 11%,#F76707 12%,#A61E1E 15.5%,transparent 16%),
  radial-gradient(circle at 52% 58%,#FFD08A 0 15%,#F08C00 16%,#C2255C 21%,transparent 21.5%),
  radial-gradient(circle at 22% 80%,#FFE08A 0 12%,#FAB005 13%,#E8590C 17%,transparent 17.5%),
  radial-gradient(circle at 80% 78%,#FF8787 0 12%,#E03131 13%,#7A0E14 17%,transparent 17.5%),
  linear-gradient(160deg,#2F5D3A,#14301E)}
.fd-lgx-ph--house{background:
  repeating-linear-gradient(90deg,rgba(255,255,255,0.75) 0 1.5px,transparent 1.5px 26px),
  repeating-linear-gradient(0deg,rgba(255,255,255,0.75) 0 1.5px,transparent 1.5px 26px),
  radial-gradient(ellipse at 50% 110%,#E7F5C8 0%,#7FB069 30%,#2D6A4F 60%,#0B2B26 100%)}
.fd-lgx-cols{columns:3 260px;column-gap:40px;margin:0 0 64px;font:400 1.0625rem/1.6 ${SERIF};color:#1C1C22}
.fd-lgx-cols p{margin:0 0 16px;font:inherit}
.fd-lgx-drop{float:left;margin:4px 10px 0 0;font:800 4.4rem/0.8 ${DISPLAY};color:#C2410C}
.fd-lgx-index{margin:0 0 64px;padding:28px 0 0;border-top:2px solid #0B0B0F}
.fd-lgx-h2{margin:0 0 18px;font:700 2rem/1.1 ${DISPLAY};letter-spacing:-0.025em;color:#0B0B0F}
.fd-lgx-index ul{list-style:none;margin:0;padding:0;columns:2 300px;column-gap:56px}
.fd-lgx-index li{display:flex;align-items:baseline;gap:10px;margin:0;padding:10px 0;border-bottom:1px solid #0B0B0F;font:500 1.0625rem/1.3 ${FONT};break-inside:avoid}
.fd-lgx-index li i{flex:1;height:1px;border-bottom:1.5px dotted #6B6B76}
.fd-lgx-index li b{font:600 1.0625rem/1.3 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;color:#1D4ED8}
.fd-lgx-test{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin:0 0 64px}
.fd-lgx-bars{height:220px;border-radius:4px;background:linear-gradient(90deg,#FFFFFF 0 14.28%,#FFD60A 14.28% 28.56%,#32D7E6 28.56% 42.84%,#30D158 42.84% 57.12%,#FF2D9B 57.12% 71.4%,#FF3B30 71.4% 85.68%,#0A3DFF 85.68%);box-shadow:inset 0 -46px 0 #0B0B0F,inset 0 -48px 0 #fff}
.fd-lgx-grid{height:220px;border-radius:4px;background:repeating-conic-gradient(#0B0B0F 0 25%,#F3EFE6 0 50%) 0 0/22px 22px}
.fd-lgx-cap{grid-column:1/-1;font:400 13px/1.4 ${FONT};color:#6B6B76}
.fd-lgx-quote{margin:0 0 56px;padding:56px 0;border-top:1px solid #0B0B0F;border-bottom:1px solid #0B0B0F;text-align:center}
.fd-lgx-quote p{margin:0 auto 14px;max-width:18ch;font:italic 400 clamp(2rem,4.6vw,4rem)/1.06 ${SERIF};letter-spacing:-0.025em;color:#0B0B0F}
.fd-lgx-quote span{font:500 13px/1.4 ${FONT};letter-spacing:0.06em;text-transform:uppercase;color:#6B6B76}
.fd-lgx-foot{display:flex;justify-content:space-between;font:500 12px/1 ${FONT};letter-spacing:0.08em;text-transform:uppercase;color:#6B6B76}

.fd-lgx-lens{position:absolute;left:0;top:0;width:340px;height:132px;border-radius:66px;display:flex;align-items:flex-end;justify-content:center;cursor:grab;touch-action:none;will-change:transform;z-index:2}
.fd-lgx-lens.fd-lg--pressed{cursor:grabbing}
.fd-lgx-hint{display:inline-flex;align-items:center;gap:6px;margin:0 0 -40px;padding:6px 12px;border-radius:999px;background:rgba(11,11,15,0.82);color:#fff;font:600 12px/1 ${FONT};letter-spacing:0.01em;text-shadow:none;white-space:nowrap;pointer-events:none;transition:opacity var(--fd-dur-3) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-ease-out)}
.fd-lgx-hint svg{display:block}
.fd-lgx-hint.is-gone{opacity:0;transform:translateY(-6px)}

.fd-lgx-bar{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:6px;z-index:3;white-space:nowrap}
.fd-lgx-sep{display:block;width:1px;height:22px;margin:0 2px;background:rgba(11,11,15,0.14)}
.fd-lgx-seg{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(max-content,1fr);margin:0;padding:0}
.fd-lgx-seg-thumb{position:absolute;top:0;bottom:0;left:0;width:calc(100% / var(--n));transform:translateX(calc(100% * var(--i)));border-radius:999px;background:#0B0B0F;box-shadow:0 2px 8px rgba(0,0,0,0.18);transition:transform var(--fd-dur-3) var(--fd-spring)}
.fd-lgx-seg-btn,.fd-lgx-dim{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:40px;min-width:40px;margin:0;padding:0 16px;border:0;border-radius:999px;background:transparent;color:#1C1C22;font:600 14px/1 ${FONT};letter-spacing:-0.005em;text-shadow:none;cursor:pointer;-webkit-appearance:none;appearance:none;transition:color var(--fd-dur-2) var(--fd-ease-out),background-color var(--fd-dur-1) linear}
.fd-lgx-seg.is-icons .fd-lgx-seg-btn{padding:0 11px}
.fd-lgx-seg-btn svg,.fd-lgx-dim svg{display:block;flex:none}
.fd-lgx-seg-btn[aria-checked="true"]{color:#fff}
.fd-lgx-seg-btn:not([aria-checked="true"]):hover,.fd-lgx-dim:not(:disabled):hover{background:rgba(11,11,15,0.06)}
.fd-lgx-dim[aria-checked="true"]{background:#0B0B0F;color:#fff}
.fd-lgx-dim:disabled{opacity:0.35;cursor:default}
.fd-lgx-seg-btn:focus-visible,.fd-lgx-dim:focus-visible,.fd-lgx-scroll:focus-visible{outline:2px solid color-mix(in srgb,#007AFF 70%,transparent);outline-offset:2px}

@media (max-width:820px){
  .fd-lgx-paper{padding:20px 20px 150px}
  .fd-lgx-mast span:not(.fd-lgx-logo):not(:nth-child(3)){display:none}
  .fd-lgx-hero{grid-template-columns:1fr;grid-template-areas:"k" "h" "d" "b";margin-bottom:40px}
  .fd-lgx-h1{margin:0 0 20px;font-size:clamp(4.4rem,24vw,7rem)}
  .fd-lgx-plates{grid-template-columns:repeat(2,1fr);gap:12px}
  .fd-lgx-test{grid-template-columns:1fr}
  .fd-lgx-bars,.fd-lgx-grid{height:150px}
  .fd-lgx-bar{bottom:20px;gap:2px;padding:4px;max-width:calc(100% - 16px)}
  .fd-lgx-sep{margin:0 1px}
  .fd-lgx-seg-btn,.fd-lgx-dim{height:38px;min-width:36px;padding:0 10px;font-size:13px}
  .fd-lgx-seg.is-icons .fd-lgx-seg-btn{padding:0 8px}
  .fd-lgx-seg.is-icons .fd-lgx-seg-btn{padding:0 9px}
  .fd-lgx-dim span{display:none}
}
@media (prefers-reduced-motion: reduce){
  .fd-lgx-seg-thumb,.fd-lgx-hint{transition-duration:120ms;transition-timing-function:linear}
}
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
