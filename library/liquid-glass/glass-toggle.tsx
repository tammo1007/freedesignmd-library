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
import type { CSSProperties, ReactNode } from "react";
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

/* ───────────────────────── demo: smart-home settings ───────────────────────── */

type Row = { id: string; title: string; sub: string; icon: ReactNode; color: string; on: boolean; accent?: string };

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const INITIAL: Row[] = [
  { id: "away", title: "Away mode", sub: "Lights follow your usual evening pattern", color: "#5856D6", on: true, icon: svg(<path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6" />) },
  { id: "heat", title: "Underfloor heating", sub: "Bathroom & hallway · 21.5 °C", color: "#FF9500", on: true, icon: svg(<path d="M8 4c-2 3 2 5 0 8s2 5 0 8M16 4c-2 3 2 5 0 8s2 5 0 8" />) },
  { id: "blinds", title: "Sunrise blinds", sub: "Open gradually from 06:40", color: "#FF2D55", on: false, icon: svg(<><circle cx="12" cy="15" r="4" /><path d="M3 15h2M19 15h2M12 3v4M5.6 8.6l1.4 1.4M18.4 8.6 17 10M3 20h18" /></>) },
  { id: "leak", title: "Leak alerts", sub: "Kitchen, laundry, water heater", color: "#0A84FF", on: true, icon: svg(<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z" />) },
  { id: "solar", title: "Charge car from solar only", sub: "Wait for > 3.2 kW surplus", color: "#34C759", on: false, icon: svg(<><rect x="3" y="6" width="18" height="11" rx="2" /><path d="M3 11.5h18M9 6v11M15 6v11M12 17v3" /></>) },
];

export function Demo() {
  const [rows, setRows] = useState(INITIAL);
  const [night, setNight] = useState(true);
  const set = (id: string, v: boolean) => setRows((r) => r.map((x) => (x.id === id ? { ...x, on: v } : x)));
  const on = rows.filter((r) => r.on).length;
  return (
    <div className="fd-gtgd">
      <style>{demoCss}</style>
      <div className="fd-gtgd-wrap">
        <header className="fd-gtgd-head">
          <p className="fd-gtgd-eyebrow">Haus Lindenhof · 4 rooms</p>
          <h1 className="fd-gtgd-h">Automations</h1>
          <p className="fd-gtgd-sub">
            {on} of {rows.length} running · last change 18:42
          </p>
        </header>

        <section className="fd-gtgd-feature">
          <div className="fd-gtgd-feature-art" aria-hidden="true" />
          <div className="fd-gtgd-feature-body">
            <p className="fd-gtgd-feature-t" id="fd-gtgd-night">
              Night scene
            </p>
            <p className="fd-gtgd-feature-s">Dims 14 lights to 8%, locks the front door, arms the garden cameras at 23:00.</p>
          </div>
          <GlassToggle size="l" checked={night} onChange={setNight} aria-labelledby="fd-gtgd-night" accent="#FF9F0A" />
        </section>

        <ul className="fd-gtgd-list" aria-label="Automations">
          {rows.map((r) => (
            <li key={r.id} className="fd-gtgd-row">
              <span className="fd-gtgd-ic" style={{ background: r.color }}>
                {r.icon}
              </span>
              <span className="fd-gtgd-txt">
                <span className="fd-gtgd-t" id={`fd-gtgd-${r.id}`}>
                  {r.title}
                </span>
                <span className="fd-gtgd-s" id={`fd-gtgd-${r.id}-s`}>
                  {r.sub}
                </span>
              </span>
              <GlassToggle checked={r.on} onChange={(v) => set(r.id, v)} aria-labelledby={`fd-gtgd-${r.id}`} aria-describedby={`fd-gtgd-${r.id}-s`} />
            </li>
          ))}
          <li className="fd-gtgd-row">
            <span className="fd-gtgd-ic" style={{ background: "#8E8E93" }}>
              {svg(<><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>)}
            </span>
            <span className="fd-gtgd-txt">
              <span className="fd-gtgd-t" id="fd-gtgd-lock">
                Auto-lock garage
              </span>
              <span className="fd-gtgd-s">Requires the Hallo Gate hub</span>
            </span>
            <GlassToggle checked={false} onChange={() => {}} disabled aria-labelledby="fd-gtgd-lock" />
          </li>
        </ul>
        <p className="fd-gtgd-foot">Press and hold a switch, the knob turns to glass. Drag it across.</p>
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const D = `"SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif`;
/* fine grain, an inline SVG feTurbulence tile (no network) */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='1.4 0 0 0 -.2 1.4 0 0 0 -.2 1.4 0 0 0 -.2 0 0 0 0 1'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const demoCss = `
.fd-gtgd,.fd-gtgd *,.fd-gtgd *::before,.fd-gtgd *::after{box-sizing:border-box}
.fd-gtgd{position:relative;overflow:hidden;min-height:100vh;width:100%;margin:0;padding:56px 20px;display:flex;justify-content:center;align-items:flex-start;
  background:radial-gradient(900px 500px at 12% -10%,#E3E7F8 0%,transparent 60%),radial-gradient(800px 560px at 108% 24%,#F2E4DA 0%,transparent 58%),#F2F2F6;color:#0B0B0F;font:400 15px/1.4 ${F};letter-spacing:normal}
.fd-gtgd::before{content:"";position:absolute;inset:0;background-image:${GRAIN};background-size:180px 180px;mix-blend-mode:soft-light;opacity:0.35;pointer-events:none}
.fd-gtgd-wrap{position:relative;width:100%;max-width:560px;margin:0;padding:0}
.fd-gtgd-head{margin:0 0 20px;padding:0 4px}
.fd-gtgd-eyebrow{margin:0 0 4px;font:600 13px/1.3 ${F};letter-spacing:0.02em;text-transform:uppercase;color:#6B6B76}
.fd-gtgd-h{margin:0 0 4px;font:800 2.75rem/1.05 ${D};letter-spacing:-0.035em;color:#0B0B0F}
.fd-gtgd-sub{margin:0;font:500 15px/1.4 ${F};color:#6B6B76}
.fd-gtgd-feature{display:flex;align-items:center;gap:16px;margin:0 0 16px;padding:14px 18px 14px 14px;border-radius:24px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 12px 32px -16px rgba(20,20,40,0.18)}
.fd-gtgd-feature-art{position:relative;flex:none;width:64px;height:64px;margin:0;border-radius:16px;overflow:hidden;background:linear-gradient(150deg,#1D2358,#4A3A78 58%,#C98A5A)}
.fd-gtgd-feature-art::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 68% 34%,transparent 0 11px,rgba(255,255,255,0.6) 12px 13.5px,transparent 14.5px),radial-gradient(circle at 68% 34%,rgba(255,255,255,0.25),transparent 34px)}
.fd-gtgd-feature-body{flex:1;min-width:0;margin:0;padding:0}
.fd-gtgd-feature-t{margin:0 0 2px;font:700 17px/1.25 ${F};letter-spacing:-0.01em;color:#0B0B0F}
.fd-gtgd-feature-s{margin:0;font:400 13px/1.4 ${F};color:#6B6B76}
.fd-gtgd-list{list-style:none;margin:0;padding:6px 0;border-radius:24px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 12px 32px -16px rgba(20,20,40,0.18)}
.fd-gtgd-row{position:relative;display:flex;align-items:center;gap:14px;margin:0;padding:12px 18px 12px 14px;min-height:64px}
.fd-gtgd-row + .fd-gtgd-row::before{content:"";position:absolute;left:62px;right:0;top:0;height:0.5px;background:#E2E2E8}
.fd-gtgd-ic{flex:none;display:grid;place-items:center;width:34px;height:34px;margin:0;border-radius:9px;color:#fff}
.fd-gtgd-ic svg{display:block}
.fd-gtgd-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;margin:0;padding:0}
.fd-gtgd-t{display:block;font:600 16px/1.3 ${F};letter-spacing:-0.01em;color:#0B0B0F}
.fd-gtgd-s{display:block;font:400 13px/1.35 ${F};color:#6B6B76}
.fd-gtgd-foot{margin:16px 0 0;padding:0 4px;font:400 13px/1.4 ${F};color:#8A8A94;text-align:center}
@media (max-width:480px){.fd-gtgd{padding:32px 16px}.fd-gtgd-h{font-size:2.25rem}}
`;
