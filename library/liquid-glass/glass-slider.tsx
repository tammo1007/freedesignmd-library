/**
 * GlassSlider — a slider whose thumb turns into Liquid Glass while dragged.
 *
 * At rest the thumb is a compact solid capsule. Grab it and it swells into
 * clear glass that refracts the fill and track underneath, stretches along
 * its velocity (area-preserving) and springs back to solid on release.
 *
 * Props: value, onChange(value), min (0), max (100), step (1), label
 *   (accessible name) or aria-labelledby, valueText(value) for
 *   aria-valuetext, accent (fill colour or CSS gradient), tone ("light" |
 *   "dark"), ticks (number of tick marks), disabled, className.
 * Accessibility: native <input type="range"> drives everything — Arrow keys,
 *   PageUp/PageDown, Home/End and screen readers work as usual.
 * Reduced motion: no swell or stretch, thumb moves instantly.
 * Browser support: refraction in Chromium; frosted glass elsewhere.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { GlassScope, LiquidGlass, createVelocityTracker, useGlassEnv, useSpring } from "./liquid-glass";

export interface GlassSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  "aria-labelledby"?: string;
  valueText?: (v: number) => string;
  /** Fill colour or gradient. */
  accent?: string;
  tone?: "light" | "dark";
  ticks?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const KW = 38; // thumb width at rest
const KH = 24;

export function GlassSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  valueText,
  accent = "#0A84FF",
  tone = "light",
  ticks = 0,
  disabled,
  className,
  id,
  ...aria
}: GlassSliderProps) {
  const env = useGlassEnv();
  const root = useRef<HTMLDivElement | null>(null);
  const thumb = useRef<HTMLElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const [active, setActive] = useState(false);
  const pct = (value - min) / (max - min || 1);

  const width = useRef(0);
  const paint = () => {
    const t = thumb.current;
    const r = root.current;
    if (!t || !r) return;
    const lift = sp.value;
    const v = env.reducedMotion ? 0 : px.velocity;
    const st = Math.min(0.32, Math.abs(v) * 0.0005);
    const s = 1 + lift * 0.55;
    const x = px.value * (width.current - KW);
    t.style.transform = `translateX(${x.toFixed(2)}px) scale(${(s * (1 + st)).toFixed(4)}, ${(s / (1 + st * 0.7)).toFixed(4)})`;
    t.style.setProperty("--fd-gsl-solid", Math.max(0, 1 - lift * 1.3).toFixed(3));
    r.style.setProperty("--fd-gsl-x", `${(x + KW / 2).toFixed(2)}px`);
  };
  const px = useSpring(pct, paint, { stiffness: 520, damping: 34, precision: 0.0002 });
  const sp = useSpring(0, paint, { stiffness: 520, damping: 30 });

  // measure + follow external value changes
  useEffect(() => {
    const r = root.current;
    if (!r) return;
    const measure = () => {
      width.current = r.clientWidth;
      paint();
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(r);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dragging = useRef(false);
  useEffect(() => {
    if (dragging.current) return;
    if (env.reducedMotion) px.set(pct);
    else px.to(pct);
  }, [pct, env.reducedMotion, px]);

  // latest props for the long-lived pointer handlers
  const live = useRef({ value, min, max, step, disabled, onChange });
  live.current = { value, min, max, step, disabled, onChange };

  // pointer: drag anywhere on the track; thumb follows the finger continuously, value snaps to step
  useEffect(() => {
    const r = root.current;
    if (!r) return;
    const vt = createVelocityTracker();
    let pid = -1;
    let grabOffset = 0;
    const toPct = (clientX: number) => {
      const b = r.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - b.left - grabOffset - KW / 2) / (b.width - KW)));
    };
    const emit = (p: number) => {
      const { value, min, max, step, onChange } = live.current;
      const raw = min + p * (max - min);
      const snapped = Math.min(max, Math.max(min, Math.round((raw - min) / step) * step + min));
      if (snapped !== value) onChange(Number(snapped.toFixed(6)));
    };
    const down = (e: PointerEvent) => {
      if (live.current.disabled || e.button !== 0) return;
      e.preventDefault();
      pid = e.pointerId;
      r.setPointerCapture(pid);
      r.dataset.pointer = "1";
      input.current?.focus({ preventScroll: true });
      const b = r.getBoundingClientRect();
      const thumbX = b.left + px.value * (b.width - KW) + KW / 2;
      // grabbing the thumb keeps the offset; tapping the track jumps there
      grabOffset = Math.abs(e.clientX - thumbX) < KW ? e.clientX - thumbX : 0;
      dragging.current = true;
      setActive(true);
      vt.reset();
      vt.push(e.clientX, 0);
      if (env.reducedMotion) sp.set(1);
      else sp.to(1);
      const p = toPct(e.clientX);
      px.stiffness = 700;
      px.damping = 40;
      if (env.reducedMotion) px.set(p);
      else px.to(p);
      emit(p);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      vt.push(e.clientX, 0);
      const p = toPct(e.clientX);
      if (env.reducedMotion) px.set(p);
      else px.to(p);
      emit(p);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = -1;
      dragging.current = false;
      setActive(false);
      px.stiffness = 520;
      px.damping = 34;
      if (env.reducedMotion) sp.set(0);
      else sp.to(0);
    };
    r.addEventListener("pointerdown", down);
    r.addEventListener("pointermove", move);
    r.addEventListener("pointerup", up);
    r.addEventListener("pointercancel", up);
    return () => {
      r.removeEventListener("pointerdown", down);
      r.removeEventListener("pointermove", move);
      r.removeEventListener("pointerup", up);
      r.removeEventListener("pointercancel", up);
    };
  }, [env.reducedMotion, px, sp]);

  // after a drag ends, glide to the snapped position
  useEffect(() => {
    if (!active && !dragging.current) px.to(pct);
  }, [active, pct, px]);

  return (
    <GlassScope>
      <div
        ref={root}
        className={["fd-gsl", `fd-gsl--${tone}`, active ? "is-active" : "", disabled ? "is-disabled" : "", className ?? ""].filter(Boolean).join(" ")}
        style={{ "--fd-gsl-accent": accent, "--fd-gsl-kw": `${KW}px`, "--fd-gsl-kh": `${KH}px`, "--fd-gsl-x": `calc(${pct} * (100% - ${KW}px) + ${KW / 2}px)` } as CSSProperties}
      >
        <style>{css}</style>
        <span className="fd-gsl-track" aria-hidden="true">
          <span className="fd-gsl-fill" />
          {ticks > 1 && (
            <span className="fd-gsl-ticks">
              {Array.from({ length: ticks }, (_, i) => (
                <i key={i} />
              ))}
            </span>
          )}
        </span>
        <LiquidGlass ref={thumb} as="span" className="fd-gsl-thumb" variant="clear" radius="capsule" refraction={1.3} dispersion={0.1} shadow={false} aria-hidden="true">
          <span className="fd-gsl-solid" />
        </LiquidGlass>
        <input
          ref={input}
          id={id}
          className="fd-gsl-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={valueText?.(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          onKeyDown={() => root.current?.removeAttribute("data-pointer")}
          {...aria}
        />
      </div>
    </GlassScope>
  );
}

const css = `
.fd-gsl,.fd-gsl *,.fd-gsl *::before,.fd-gsl *::after{box-sizing:border-box}
.fd-gsl{--fd-gsl-track:rgba(120,120,128,0.2);position:relative;display:block;width:100%;height:36px;margin:0;padding:0;touch-action:none;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.fd-gsl--dark{--fd-gsl-track:rgba(255,255,255,0.18)}
.fd-gsl.is-disabled{opacity:0.45;cursor:default}
.fd-gsl-track{position:absolute;left:0;right:0;top:50%;height:6px;margin:-3px 0 0;padding:0;border-radius:999px;background:var(--fd-gsl-track);overflow:hidden;display:block}
.fd-gsl-fill{position:absolute;left:0;top:0;bottom:0;width:var(--fd-gsl-x);display:block;margin:0;padding:0;border-radius:inherit;background:var(--fd-gsl-accent)}
.fd-gsl-ticks{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:center;margin:0;padding:0 calc(var(--fd-gsl-kw) / 2 - 1px)}
.fd-gsl-ticks i{display:block;width:2px;height:2px;margin:0;border-radius:2px;background:rgba(255,255,255,0.7)}
.fd-gsl-thumb{position:absolute !important;left:0;top:50%;display:block;width:var(--fd-gsl-kw);height:var(--fd-gsl-kh);margin:calc(var(--fd-gsl-kh) / -2) 0 0;padding:0;pointer-events:none;will-change:transform;
  --fd-lg-shadow:0 3px 8px rgba(0,0,0,0.16),0 1px 1px rgba(0,0,0,0.12)}
.fd-gsl.is-active .fd-gsl-thumb{--fd-lg-shadow:0 10px 24px -8px rgba(0,0,0,0.3)}
.fd-gsl-solid{position:absolute;inset:0;display:block;margin:0;padding:0;border-radius:inherit;background:#FFFFFF;opacity:var(--fd-gsl-solid,1)}
.fd-gsl-thumb .fd-lg-spec{opacity:calc(1 - var(--fd-gsl-solid,1) * 0.85)}
.fd-gsl-thumb .fd-lg-fill{background:rgba(255,255,255,0.04)}
.fd-gsl-input{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;opacity:0;pointer-events:none;-webkit-appearance:none;appearance:none;background:none}
.fd-gsl:not([data-pointer]):has(.fd-gsl-input:focus-visible) .fd-gsl-thumb{outline:2px solid color-mix(in srgb,#0A84FF 70%,transparent);outline-offset:3px}
@media (prefers-contrast: more){.fd-gsl-track{box-shadow:inset 0 0 0 1px rgba(0,0,0,0.6)}.fd-gsl-solid{opacity:1 !important}}
@media (prefers-reduced-transparency: reduce){.fd-gsl-solid{opacity:1 !important}}
`;

/* ───────────────────────── demo: EV climate controls ───────────────────────── */

const Ico = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export function Demo() {
  const [temp, setTemp] = useState(21.5);
  return (
    <div className="fd-gsld">
      <style>{demoCss}</style>
      <div className="fd-gsld-box">
        <div className="fd-gsld-top">
          <label className="fd-gsld-lbl" id="fd-gsld-t">Temperature</label>
          <span className="fd-gsld-val">{temp.toFixed(1)} °C</span>
        </div>
        <GlassSlider
          value={temp}
          onChange={setTemp}
          min={16}
          max={28}
          step={0.5}
          aria-labelledby="fd-gsld-t"
          valueText={(v) => `${v.toFixed(1)} degrees Celsius`}
          tone="dark"
          accent="linear-gradient(90deg,#0A84FF,#64D2FF 40%,#FFD60A 70%,#FF453A)"
        />
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const demoCss = `
.fd-gsld,.fd-gsld *,.fd-gsld *::before,.fd-gsld *::after{box-sizing:border-box}
.fd-gsld{position:relative;min-height:100vh;width:100%;margin:0;padding:32px 24px;display:flex;align-items:center;justify-content:center;background:#0a0b0f;color:#F2F2F7;font:400 15px/1.4 ${F};letter-spacing:normal}
.fd-gsld-box{width:min(100%,360px);margin:0;padding:0}
.fd-gsld-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 14px;padding:0}
.fd-gsld-lbl{margin:0;padding:0;font:600 15px/1.3 ${F};letter-spacing:-0.005em;color:#F2F2F7;cursor:default}
.fd-gsld-val{margin:0;font:500 15px/1.3 ${F};color:#AEAEB8;font-variant-numeric:tabular-nums}
`;
