/**
 * GlassSheet — an iOS 26 Liquid Glass sheet with detents.
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
 * Must be placed inside a positioned container (position: relative) — it fills
 * that container, like a sheet inside a screen.
 * Keyboard: the grabber is a button — Enter/Space cycles detents, Arrow
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
              aria-label={`Resize sheet — ${["collapsed", "half height", "full height"][Math.min(detent, 2)] ?? `detent ${detent + 1}`}`}
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

/* ───────────────────────── demo: maps / hotel booking ───────────────────────── */

const ROOMS = [
  { n: "Deluxe King, harbour view", d: "32 m² · Breakfast for two · Free cancellation until 10 Jun", p: 318, c: ["#FFB199", "#FF0844"] },
  { n: "Junior Suite with terrace", d: "48 m² · Terrace with daybeds · Late checkout", p: 452, c: ["#84FAB0", "#0BA360"] },
  { n: "Twin Classic, courtyard", d: "26 m² · Quiet side · Pay at hotel", p: 246, c: ["#A1C4FD", "#3B5BDB"] },
];

export function Demo() {
  const [detent, setDetent] = useState(1);
  const [room, setRoom] = useState(0);
  return (
    <div className="fd-gshd">
      <style>{demoCss}</style>
      <div className="fd-gshd-device">
        <MapLayer />
        <div className="fd-gshd-pin" style={{ left: "58%", top: "36%" }} aria-hidden="true">
          <span>€318</span>
        </div>
        <div className="fd-gshd-pin is-dim" style={{ left: "28%", top: "22%" }} aria-hidden="true">
          <span>€204</span>
        </div>
        <div className="fd-gshd-pin is-dim" style={{ left: "76%", top: "18%" }} aria-hidden="true">
          <span>€389</span>
        </div>
        <GlassSheet
          detent={detent}
          onDetentChange={setDetent}
          label="Casa Marèa, Lisbon"
          header={
            <div className="fd-gshd-head">
              <div className="fd-gshd-thumb" aria-hidden="true" />
              <div className="fd-gshd-titles">
                <p className="fd-gshd-title">Casa Marèa</p>
                <p className="fd-gshd-sub">Boutique hotel · Alfama, Lisbon · ★ 4.8</p>
              </div>
              <button type="button" className="fd-gshd-x" aria-label="Close">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          }
        >
          <div className="fd-gshd-chips" role="list">
            {["14 – 17 Jun", "2 guests", "3 nights", "4 min to tram 28"].map((c) => (
              <span key={c} role="listitem" className="fd-gshd-chip">
                {c}
              </span>
            ))}
          </div>
          <p className="fd-gshd-h">Choose your room</p>
          <ul className="fd-gshd-rooms" role="radiogroup" aria-label="Rooms">
            {ROOMS.map((r, i) => (
              <li key={r.n}>
                <button type="button" role="radio" aria-checked={room === i} className="fd-gshd-room" onClick={() => setRoom(i)}>
                  <span className="fd-gshd-room-img" style={{ background: `linear-gradient(135deg, ${r.c[0]}, ${r.c[1]})` }} aria-hidden="true" />
                  <span className="fd-gshd-room-txt">
                    <b>{r.n}</b>
                    <span>{r.d}</span>
                  </span>
                  <span className="fd-gshd-room-p">
                    €{r.p}
                    <small>/night</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="fd-gshd-cta">
            Reserve · €{ROOMS[room].p * 3} total
          </button>
          <p className="fd-gshd-h">About</p>
          <p className="fd-gshd-p">
            Twelve rooms in a restored 1890s merchant’s house above the Tagus. Azulejo-tiled stairwell, a rooftop bar that opens at 17:00 and a
            breakfast of pastéis de nata from the bakery next door.
          </p>
          <p className="fd-gshd-p">Check-in from 15:00 · Check-out until 11:00 · No lift (3 floors) · Pets on request.</p>
        </GlassSheet>
      </div>
    </div>
  );
}

function MapLayer() {
  return (
    <svg className="fd-gshd-map" viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="860" fill="#EDE9E0" />
      <path d="M0 560 C80 520 150 600 230 560 S360 520 400 540 V860 H0 Z" fill="#9FD3F2" />
      <path d="M0 600 C90 570 160 640 240 600 S360 570 400 590" fill="none" stroke="#B9E1F7" strokeWidth="6" />
      <g fill="#C9E7B5">
        <path d="M30 80h90v70H30z" />
        <path d="M260 230l80 10-10 80-80-10z" />
        <circle cx="150" cy="420" r="38" />
      </g>
      <g fill="#E1DCD1">
        {Array.from({ length: 60 }, (_, i) => {
          const x = (i * 67) % 380;
          const y = ((i * 131) % 520) + 10;
          return <rect key={i} x={x} y={y} width={18 + (i % 4) * 6} height={14 + (i % 3) * 6} rx="2" />;
        })}
      </g>
      <g fill="none" stroke="#FFFFFF" strokeLinecap="round">
        <path d="M-10 200 C100 180 200 260 410 220" strokeWidth="14" />
        <path d="M120 -10 C140 200 100 380 180 560" strokeWidth="12" />
        <path d="M-10 420 C120 400 250 470 410 430" strokeWidth="10" />
        <path d="M300 -10 C280 140 330 300 290 560" strokeWidth="9" />
        <path d="M-10 320 L410 300" strokeWidth="6" />
        <path d="M60 -10 L40 560" strokeWidth="5" />
        <path d="M210 -10 L230 560" strokeWidth="5" />
      </g>
      <g fill="none" stroke="#F6C445" strokeLinecap="round">
        <path d="M-10 200 C100 180 200 260 410 220" strokeWidth="5" />
      </g>
      <path d="M120 -10 C140 200 100 380 180 560" fill="none" stroke="#E5484D" strokeWidth="3" strokeDasharray="1 7" strokeLinecap="round" />
      <g fontFamily="ui-sans-serif,-apple-system,Inter,sans-serif" fontWeight="600" fill="#6B6B76" fontSize="10" letterSpacing="0.06em">
        <text x="20" y="250">ALFAMA</text>
        <text x="240" y="380">BAIXA</text>
        <text x="40" y="640" fill="#3B82C4">RIO TEJO</text>
      </g>
    </svg>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const D = `"SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif`;
const demoCss = `
.fd-gshd,.fd-gshd *,.fd-gshd *::before,.fd-gshd *::after{box-sizing:border-box}
.fd-gshd{min-height:100vh;width:100%;margin:0;padding:28px 16px;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(900px 600px at 20% 10%,#E6F0FF,transparent 60%),radial-gradient(900px 600px at 90% 90%,#FFEFE0,transparent 60%),#F2F2F7;color:#0B0B0F;font:400 15px/1.4 ${F};letter-spacing:normal}
.fd-gshd-device{position:relative;width:390px;max-width:100%;height:min(820px,calc(100vh - 56px));min-height:620px;margin:0;border-radius:52px;overflow:hidden;background:#EDE9E0;
  box-shadow:0 0 0 10px #0B0B0F,0 0 0 11px #2A2A31,0 50px 100px -40px rgba(20,20,40,0.55)}
.fd-gshd-map{position:absolute;inset:0;display:block;width:100%;height:100%}
.fd-gshd-pin{position:absolute;margin:0;padding:0;transform:translate(-50%,-100%)}
.fd-gshd-pin span{display:block;margin:0;padding:7px 11px;border-radius:999px;background:#0B0B0F;color:#fff;font:700 13px/1 ${F};box-shadow:0 6px 16px -4px rgba(0,0,0,0.4)}
.fd-gshd-pin::after{content:"";display:block;width:10px;height:10px;margin:-5px auto 0;background:#0B0B0F;transform:rotate(45deg);border-radius:0 0 2px 0}
.fd-gshd-pin.is-dim span{background:#fff;color:#0B0B0F}
.fd-gshd-pin.is-dim::after{background:#fff}
.fd-gshd-head{display:flex;align-items:center;gap:12px;margin:2px 0 0;padding:0}
.fd-gshd-thumb{flex:none;width:52px;height:52px;margin:0;border-radius:14px;background:
  linear-gradient(#fff 0 0) 20% 55%/16% 22% no-repeat,linear-gradient(#fff 0 0) 60% 50%/16% 26% no-repeat,
  linear-gradient(180deg,#FFB86B,#E5484D 60%,#6E2B5A)}
.fd-gshd-titles{flex:1;min-width:0;margin:0;padding:0}
.fd-gshd-title{margin:0;font:700 1.375rem/1.15 ${D};letter-spacing:-0.02em;color:inherit}
.fd-gshd-sub{margin:2px 0 0;font:500 13px/1.3 ${F};color:#6B6B76;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fd-gshd-x{flex:none;display:grid;place-items:center;width:30px;height:30px;margin:0;padding:0;border:0;border-radius:50%;background:rgba(120,120,128,0.16);color:#6B6B76;cursor:pointer;-webkit-appearance:none;appearance:none}
.fd-gshd-x svg{display:block}
.fd-gshd-x:focus-visible,.fd-gshd-room:focus-visible,.fd-gshd-cta:focus-visible{outline:2px solid color-mix(in srgb,#0A84FF 70%,transparent);outline-offset:2px}
.fd-gshd-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 18px;padding:0}
.fd-gshd-chip{display:inline-block;margin:0;padding:7px 11px;border-radius:999px;background:rgba(120,120,128,0.12);font:600 13px/1 ${F};color:#1C1C22}
.fd-gshd-h{margin:0 0 10px;font:700 17px/1.2 ${F};letter-spacing:-0.01em;color:inherit}
.fd-gshd-rooms{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-direction:column;gap:8px}
.fd-gshd-rooms li{margin:0;padding:0}
.fd-gshd-room{display:flex;align-items:center;gap:12px;width:100%;margin:0;padding:10px;border:0;border-radius:20px;background:rgba(255,255,255,0.62);color:#0B0B0F;text-align:left;cursor:pointer;-webkit-appearance:none;appearance:none;
  font:inherit;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.05);transition:box-shadow 240ms cubic-bezier(0.22,1,0.36,1),background-color 240ms}
.fd-gshd-room[aria-checked="true"]{background:#fff;box-shadow:inset 0 0 0 2px #007AFF}
.fd-gshd-room-img{flex:none;width:56px;height:56px;border-radius:12px;display:block}
.fd-gshd-room-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.fd-gshd-room-txt b{font:650 15px/1.25 ${F};letter-spacing:-0.01em}
.fd-gshd-room-txt span{font:400 12px/1.35 ${F};color:#6B6B76}
.fd-gshd-room-p{flex:none;font:700 17px/1 ${F};text-align:right}
.fd-gshd-room-p small{display:block;margin-top:3px;font:500 11px/1 ${F};color:#6B6B76}
.fd-gshd-cta{display:block;width:100%;height:52px;margin:0 0 22px;padding:0;border:0;border-radius:999px;background:#007AFF;color:#fff;font:600 17px/1 ${F};letter-spacing:-0.01em;cursor:pointer;-webkit-appearance:none;appearance:none;box-shadow:0 10px 24px -10px rgba(0,122,255,0.7)}
.fd-gshd-p{margin:0 0 12px;font:400 15px/1.5 ${F};color:#3A3A44}
@media (max-width:480px){
  .fd-gshd{padding:0}
  .fd-gshd-device{width:100%;height:100vh;min-height:0;border-radius:0;box-shadow:none}
}
`;
