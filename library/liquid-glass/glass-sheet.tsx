/**
 * GlassSheet, an iOS 26 Liquid Glass sheet with detents.
 *
 * - Half / peek detents are inset from the screen edges with a large corner
 *   radius, so content peeks around them (HIG). The radius stays concentric
 *   with the container (`radius` = container radius − inset).
 * - Drag the grabber (or anywhere on the header) to move between detents;
 *   release uses the drag velocity to pick a detent and springs there.
 * - At the full detent the sheet grows to the edges, its corners match the
 *   screen and the glass becomes more opaque for long-form reading.
 *
 * Props: detents (fractions of the container height, e.g. [0.2, 0.52, 0.94]),
 *   detent (index, controlled) + onDetentChange, inset (px, default 8),
 *   radius (corner radius at rest, default 36), tone, label (aria-label),
 *   header (always-visible content next to the grabber), children (body).
 * Must be placed inside a positioned container (position: relative), it fills
 * that container, like a sheet inside a screen.
 * Keyboard: the grabber is a button, Enter/Space cycles detents, Arrow
 *   Up/Down step through them. role="dialog" aria-modal="false".
 * Reduced motion: detent changes are instant. Reduced transparency/contrast:
 *   opaque surface.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { GlassScope, LiquidGlass, createVelocityTracker, useGlassEnv, useSpring } from "./liquid-glass";

export interface GlassSheetProps {
  detents?: number[];
  detent: number;
  onDetentChange: (i: number) => void;
  inset?: number;
  radius?: number;
  tone?: "light" | "dark";
  label: string;
  header?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function GlassSheet({ detents = [0.2, 0.52, 0.94], detent, onDetentChange, inset = 8, radius = 36, tone = "light", label, header, children, className }: GlassSheetProps) {
  const env = useGlassEnv();
  const host = useRef<HTMLDivElement | null>(null);
  const sheet = useRef<HTMLElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const H = useRef(0);
  const [full, setFull] = useState(false);

  const fullIdx = detents.length - 1;
  // expansion 0 (inset, glassy) → 1 (edge-to-edge, more opaque) over the last detent interval
  const paint = (hpx: number) => {
    const s = sheet.current;
    const total = H.current;
    if (!s || !total) return;
    const lo = detents[Math.max(0, fullIdx - 1)] * total;
    const hi = detents[fullIdx] * total;
    const e = Math.min(1, Math.max(0, (hpx - lo) / Math.max(1, hi - lo)));
    const ins = inset * (1 - e);
    s.style.height = `${Math.max(56, hpx).toFixed(1)}px`;
    s.style.left = `${ins.toFixed(2)}px`;
    s.style.right = `${ins.toFixed(2)}px`;
    s.style.bottom = `${ins.toFixed(2)}px`;
    s.style.setProperty("--fd-gsh-e", e.toFixed(3));
    s.style.borderRadius = `${(radius + inset * e).toFixed(2)}px ${(radius + inset * e).toFixed(2)}px ${(radius * (1 - e) + 0).toFixed(2)}px ${(radius * (1 - e)).toFixed(2)}px`;
    if (e > 0.98 !== fullRef.current) {
      fullRef.current = e > 0.98;
      setFull(fullRef.current);
    }
  };
  const fullRef = useRef(false);
  const hs = useSpring(0, paint, { stiffness: 380, damping: 34, precision: 0.2 });

  const target = useCallback((i: number) => detents[Math.min(Math.max(i, 0), fullIdx)] * H.current, [detents, fullIdx]);

  // measure container
  useIso(() => {
    const h = host.current?.parentElement;
    if (!h) return;
    const measure = () => {
      H.current = h.clientHeight;
      hs.set(target(detentRef.current));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(h);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const detentRef = useRef(detent);
  detentRef.current = detent;

  const dragging = useRef(false);
  useEffect(() => {
    if (dragging.current || !H.current) return;
    hs.stiffness = 380;
    hs.damping = 34;
    if (env.reducedMotion) hs.set(target(detent));
    else hs.to(target(detent));
  }, [detent, target, env.reducedMotion, hs]);

  // drag on the header zone
  const grab = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const g = grab.current;
    if (!g) return;
    const vt = createVelocityTracker();
    let pid = -1, y0 = 0, h0 = 0, moved = false;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pid = e.pointerId;
      y0 = e.clientY;
      h0 = hs.value;
      moved = false;
      vt.reset();
      vt.push(0, e.clientY);
      // follow the gesture on window: the finger leaves the grab zone immediately
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      const dy = y0 - e.clientY;
      if (!moved && Math.abs(dy) < 4) return;
      if (!moved) {
        moved = true;
        dragging.current = true;
        g.classList.add("is-dragging");
      }
      vt.push(0, e.clientY);
      const min = target(0), max = target(fullIdx);
      let h = h0 + dy;
      if (h > max) h = max + (h - max) * 0.2;
      if (h < min) h = min - (min - h) * 0.3;
      hs.stiffness = 1200;
      hs.damping = 70;
      if (env.reducedMotion) hs.set(h);
      else hs.to(h);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = -1;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!moved) return;
      g.classList.remove("is-dragging");
      dragging.current = false;
      const { vy } = vt.get();
      const projected = hs.value - vy * 0.18; // fling
      let best = 0, bd = Infinity;
      detents.forEach((d, i) => {
        const dd = Math.abs(d * H.current - projected);
        if (dd < bd) (bd = dd), (best = i);
      });
      hs.stiffness = 380;
      hs.damping = 32;
      if (env.reducedMotion) hs.set(target(best));
      else hs.to(target(best), -vy);
      if (best !== detentRef.current) onDetentChange(best);
      // eat the click that ends a drag
      const stop = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      g.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => g.removeEventListener("click", stop, { capture: true }), 0);
    };
    g.addEventListener("pointerdown", down);
    return () => {
      g.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [detents, fullIdx, target, onDetentChange, env.reducedMotion, hs]);

  const onGrabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onDetentChange(Math.min(fullIdx, detent + 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onDetentChange(Math.max(0, detent - 1));
    }
  };

  return (
    <GlassScope>
      <div ref={host} className={["fd-gsh-host", `fd-gsh--${tone}`, className ?? ""].filter(Boolean).join(" ")}>
        <style>{css}</style>
        <LiquidGlass
          ref={sheet}
          className={`fd-gsh${full ? " is-full" : ""}`}
          variant="regular"
          tone={tone}
          radius="auto"
          bezel={28}
          role="dialog"
          aria-modal="false"
          aria-label={label}
          style={{ "--fd-gsh-r": `${radius}px` } as CSSProperties}
        >
          <div ref={grab} className="fd-gsh-grab">
            <button
              type="button"
              className="fd-gsh-handle"
              aria-label={`Resize sheet, ${["collapsed", "half height", "full height"][Math.min(detent, 2)] ?? `detent ${detent + 1}`}`}
              onClick={() => onDetentChange(detent >= fullIdx ? 0 : detent + 1)}
              onKeyDown={onGrabKey}
            >
              <span aria-hidden="true" />
            </button>
            {header}
          </div>
          <div ref={body} className="fd-gsh-body" aria-hidden={detent === 0 || undefined}>
            {children}
          </div>
        </LiquidGlass>
      </div>
    </GlassScope>
  );
}

const css = `
.fd-gsh-host,.fd-gsh-host *,.fd-gsh-host *::before,.fd-gsh-host *::after{box-sizing:border-box}
.fd-gsh-host{position:absolute;inset:0;margin:0;padding:0;pointer-events:none;z-index:4}
.fd-gsh{position:absolute !important;left:8px;right:8px;bottom:8px;height:50%;display:flex;flex-direction:column;margin:0;padding:0;overflow:hidden;pointer-events:auto;will-change:height;text-align:left;
  --fd-lg-shadow:0 -10px 40px -10px rgba(0,0,0,0.28),0 0 0 0.5px rgba(0,0,0,0.04);
  color:#0B0B0F;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif}
.fd-gsh--dark .fd-gsh{color:#F2F2F7}
/* more opaque as it expands: fill alpha .3 → .86 */
.fd-gsh .fd-lg-fill{background:rgba(250,250,252,calc(0.5 + var(--fd-gsh-e,0) * 0.44))}
.fd-gsh--dark .fd-gsh .fd-lg-fill{background:rgba(28,28,32,calc(0.5 + var(--fd-gsh-e,0) * 0.42))}
.fd-gsh-grab{position:relative;flex:none;margin:0;padding:0 20px 8px;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
.fd-gsh-grab.is-dragging,.fd-gsh-grab.is-dragging *{cursor:grabbing}
.fd-gsh-handle{display:flex;justify-content:center;align-items:center;width:100%;height:22px;margin:0;padding:0;border:0;background:none;cursor:inherit;-webkit-appearance:none;appearance:none;border-radius:8px}
.fd-gsh-handle span{display:block;width:38px;height:5px;margin:0;border-radius:3px;background:rgba(11,11,15,0.22)}
.fd-gsh--dark .fd-gsh-handle span{background:rgba(255,255,255,0.32)}
.fd-gsh-handle:focus-visible{outline:2px solid color-mix(in srgb,#0A84FF 70%,transparent);outline-offset:-2px}
.fd-gsh-body{position:relative;flex:1;min-height:0;margin:0;padding:0 20px 24px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}
.fd-gsh-body::-webkit-scrollbar{display:none}
@media (prefers-reduced-transparency: reduce){.fd-gsh .fd-lg-fill{background:#F2F2F7}.fd-gsh--dark .fd-gsh .fd-lg-fill{background:#1C1C22}}
@media (prefers-contrast: more){.fd-gsh .fd-lg-fill{background:#fff}.fd-gsh--dark .fd-gsh .fd-lg-fill{background:#000}}
`;

/* ───────────────────────── demo ───────────────────────── */

const ROWS = [
  { t: "Directions", d: <path d="M12 3.5 20.5 12 12 20.5 3.5 12 12 3.5ZM9 13v-2.2a1 1 0 0 1 1-1h5m0 0-2-2m2 2-2 2" /> },
  { t: "Share", d: <path d="M12 3.5v11M8 7l4-3.5L16 7M8.5 10.5H7a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5" /> },
  { t: "Add to favorites", d: <path d="M12 20s-7.5-4.4-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.6 12 20 12 20Z" /> },
];

export function Demo() {
  const [detent, setDetent] = useState(1);
  return (
    <div className="fd-gshd">
      <style>{demoCss}</style>
      <div className="fd-gshd-stage">
        <GlassSheet
          detent={detent}
          onDetentChange={setDetent}
          label="Place details"
          header={
            <div className="fd-gshd-head">
              <p className="fd-gshd-title">Harbour View</p>
              <p className="fd-gshd-sub">Lisbon, Portugal</p>
            </div>
          }
        >
          <ul className="fd-gshd-list">
            {ROWS.map((r) => (
              <li key={r.t} className="fd-gshd-item">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {r.d}
                </svg>
                <span>{r.t}</span>
              </li>
            ))}
          </ul>
        </GlassSheet>
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-gshd,.fd-gshd *,.fd-gshd *::before,.fd-gshd *::after{box-sizing:border-box}
.fd-gshd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;color:#1d1d1f;font:400 15px/1.4 ${F};letter-spacing:normal;
  background:radial-gradient(46% 62% at 28% 32%,#ffcfa6 0%,transparent 70%),radial-gradient(44% 58% at 74% 68%,#b7c3ff 0%,transparent 70%),radial-gradient(30% 40% at 62% 22%,#ffc2dc 0%,transparent 70%),#f1eeea}
.fd-gshd-stage{position:relative;width:min(100%,360px);height:min(560px,calc(100vh - 64px));margin:0;padding:0}
.fd-gshd-head{margin:0;padding:6px 0 12px}
.fd-gshd-title{margin:0;font:700 20px/1.25 ${F};letter-spacing:-0.02em;color:#1d1d1f}
.fd-gshd-sub{margin:2px 0 0;font:400 14px/1.35 ${F};color:#6e6e73}
.fd-gshd-list{list-style:none;margin:0;padding:0}
.fd-gshd-item{display:flex;align-items:center;gap:14px;margin:0;padding:15px 2px;font:500 16px/1.3 ${F};letter-spacing:-0.01em;color:#1d1d1f;border-top:0.5px solid rgba(60,60,67,0.18)}
.fd-gshd-item svg{display:block;flex:none;color:#0a84ff}
.fd-gshd-item span{display:block;margin:0;padding:0}
`;
