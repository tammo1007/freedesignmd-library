/**
 * GlassToggle, an iOS 26 switch whose knob turns into Liquid Glass while
 * you touch it.
 *
 * At rest the knob is a solid white capsule. On press it swells, the white
 * drains away and it becomes clear glass refracting the track beneath it; you
 * can drag it across, and on release it springs to its side and turns solid
 * again (HIG: transient interactive elements may become glass).
 *
 * Props: checked, onChange(checked), disabled, label (accessible name, or
 *   use aria-labelledby), accent (on colour, default #34C759), size ("m" | "l"),
 *   className, id. Controlled.
 * Accessibility: <button role="switch" aria-checked>; Space/Enter toggle;
 *   focus ring. Reduced motion: no swell/spring, instant snap.
 * Browser support: refraction in Chromium; frosted glass elsewhere.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { GlassScope, LiquidGlass, useGlassEnv, useSpring } from "./liquid-glass";

export interface GlassToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  accent?: string;
  size?: "m" | "l";
  id?: string;
  className?: string;
}

const DIM = { m: { w: 64, h: 28, kw: 39, kh: 24, pad: 2 }, l: { w: 80, h: 36, kw: 50, kh: 31, pad: 2.5 } };

export function GlassToggle({ checked, onChange, disabled, label, accent = "#34C759", size = "m", id, className, ...aria }: GlassToggleProps) {
  const env = useGlassEnv();
  const root = useRef<HTMLButtonElement | null>(null);
  const knob = useRef<HTMLElement | null>(null);
  const d = DIM[size];
  const travel = d.w - d.kw - d.pad * 2;
  const [active, setActive] = useState(false);

  const paint = () => {
    const k = knob.current;
    if (!k) return;
    const lift = sp.value; // 0 solid → 1 glass
    const sx = 1 + lift * 0.42 + Math.min(0.18, Math.abs(kx.velocity) * 0.0006);
    const sy = 1 + lift * 0.42 - Math.min(0.08, Math.abs(kx.velocity) * 0.0003);
    k.style.transform = `translateX(${kx.value.toFixed(2)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    k.style.setProperty("--fd-gtg-solid", String(Math.max(0, 1 - lift * 1.25).toFixed(3)));
    root.current?.style.setProperty("--fd-gtg-p", String((kx.value / travel).toFixed(4)));
  };
  const kx = useSpring(checked ? travel : 0, paint, { stiffness: 420, damping: 26 });
  const sp = useSpring(0, paint, { stiffness: 520, damping: 30 });

  // follow `checked` from outside
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current || env.reducedMotion) {
      firstRun.current = false;
      kx.set(checked ? travel : 0);
      return;
    }
    if (!drag.current.active) kx.to(checked ? travel : 0);
  }, [checked, travel, env.reducedMotion, kx]);

  const drag = useRef({ active: false, moved: false, x0: 0, k0: 0, pid: -1 });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const down = (e: PointerEvent) => {
      if (disabled || e.button !== 0) return;
      const g = drag.current;
      g.active = true;
      g.moved = false;
      g.x0 = e.clientX;
      g.k0 = kx.value;
      g.pid = e.pointerId;
      el.setPointerCapture(e.pointerId);
      setActive(true);
      if (env.reducedMotion) sp.set(1);
      else sp.to(1);
    };
    const move = (e: PointerEvent) => {
      const g = drag.current;
      if (!g.active || e.pointerId !== g.pid) return;
      const dx = e.clientX - g.x0;
      if (Math.abs(dx) > 3) g.moved = true;
      if (!g.moved) return;
      let x = g.k0 + dx;
      if (x < 0) x *= 0.25;
      if (x > travel) x = travel + (x - travel) * 0.25;
      kx.stiffness = 1000;
      kx.damping = 55;
      kx.to(x);
    };
    const up = (e: PointerEvent) => {
      const g = drag.current;
      if (!g.active || e.pointerId !== g.pid) return;
      g.active = false;
      setActive(false);
      kx.stiffness = 420;
      kx.damping = 26;
      const next = g.moved ? kx.value > travel / 2 : !checked;
      if (env.reducedMotion) {
        sp.set(0);
        kx.set(next ? travel : 0);
      } else {
        sp.to(0);
        kx.to(next ? travel : 0);
      }
      if (next !== checked) onChange(next);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [checked, disabled, onChange, travel, env.reducedMotion, kx, sp]);

  return (
    <GlassScope>
      <button
        ref={root}
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={["fd-gtg", `fd-gtg--${size}`, active ? "is-active" : "", className ?? ""].filter(Boolean).join(" ")}
        style={{ "--fd-gtg-accent": accent, "--fd-gtg-w": `${d.w}px`, "--fd-gtg-h": `${d.h}px`, "--fd-gtg-kw": `${d.kw}px`, "--fd-gtg-kh": `${d.kh}px`, "--fd-gtg-pad": `${d.pad}px`, "--fd-gtg-p": checked ? 1 : 0 } as CSSProperties}
        onClick={(e) => {
          // pointer toggles are handled on pointerup; this is keyboard / AT activation
          if (e.detail === 0 && !disabled) onChange(!checked);
        }}
        {...aria}
      >
        <style>{css}</style>
        <span className="fd-gtg-track" aria-hidden="true">
          <span className="fd-gtg-on" />
        </span>
        <LiquidGlass ref={knob} as="span" className="fd-gtg-knob" variant="clear" radius="capsule" refraction={1.25} dispersion={0.1} shadow={false} aria-hidden="true">
          <span className="fd-gtg-solid" />
        </LiquidGlass>
      </button>
    </GlassScope>
  );
}

const css = `
.fd-gtg,.fd-gtg *,.fd-gtg *::before,.fd-gtg *::after{box-sizing:border-box}
.fd-gtg{position:relative;display:inline-block;flex:none;width:var(--fd-gtg-w);height:var(--fd-gtg-h);margin:0;padding:0;border:0;border-radius:999px;background:none;color:inherit;font:inherit;vertical-align:middle;
  cursor:pointer;touch-action:none;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;outline:none}
.fd-gtg:focus-visible{outline:2px solid color-mix(in srgb,#0A84FF 70%,transparent);outline-offset:2px}
.fd-gtg:disabled{cursor:default;opacity:0.45}
.fd-gtg-track{position:absolute;inset:0;display:block;margin:0;padding:0;border-radius:inherit;overflow:hidden;background:rgba(120,120,128,0.16);box-shadow:inset 0 0 0 0.5px rgba(0,0,0,0.04)}
.fd-gtg-on{position:absolute;inset:0;display:block;margin:0;padding:0;border-radius:inherit;background:var(--fd-gtg-accent);opacity:var(--fd-gtg-p);transform-origin:0 50%}
.fd-gtg-knob{position:absolute !important;left:var(--fd-gtg-pad);top:var(--fd-gtg-pad);display:block;width:var(--fd-gtg-kw);height:var(--fd-gtg-kh);margin:0;padding:0;will-change:transform;
  --fd-lg-shadow:0 3px 8px rgba(0,0,0,0.15),0 1px 1px rgba(0,0,0,0.12),0 3px 1px rgba(0,0,0,0.04)}
.fd-gtg.is-active .fd-gtg-knob{--fd-lg-shadow:0 8px 22px -6px rgba(0,0,0,0.28),0 1px 2px rgba(0,0,0,0.08)}
.fd-gtg-solid{position:absolute;inset:0;display:block;margin:0;padding:0;border-radius:inherit;background:#FFFFFF;opacity:var(--fd-gtg-solid,1)}
.fd-gtg-knob .fd-lg-spec{opacity:calc(1 - var(--fd-gtg-solid,1) * 0.85)}
.fd-gtg-knob .fd-lg-fill{background:rgba(255,255,255,0.04)}
@media (prefers-contrast: more){.fd-gtg-track{box-shadow:inset 0 0 0 1px rgba(0,0,0,0.6)}.fd-gtg-solid{opacity:1 !important}}
@media (prefers-reduced-transparency: reduce){.fd-gtg-solid{opacity:1 !important}}
`;

/* ───────────────────────── demo ───────────────────────── */

export function Demo() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [c, setC] = useState(true);
  return (
    <div className="fd-gtgd">
      <style>{demoCss}</style>
      <div className="fd-gtgd-row">
        <GlassToggle size="l" checked={a} onChange={setA} label="Wi-Fi" />
        <GlassToggle size="l" checked={b} onChange={setB} label="Bluetooth" />
        <GlassToggle size="l" checked={c} onChange={setC} label="Focus" accent="#0A84FF" />
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-gtgd,.fd-gtgd *,.fd-gtgd *::before,.fd-gtgd *::after{box-sizing:border-box}
.fd-gtgd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;color:#1d1d1f;font:400 15px/1.4 ${F};letter-spacing:normal;
  background:radial-gradient(46% 62% at 28% 32%,#ffcfa6 0%,transparent 70%),radial-gradient(44% 58% at 74% 68%,#b7c3ff 0%,transparent 70%),radial-gradient(30% 40% at 62% 22%,#ffc2dc 0%,transparent 70%),#f1eeea}
.fd-gtgd-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:28px;margin:0;padding:0}
`;
