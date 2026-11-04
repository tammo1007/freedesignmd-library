/**
 * CustomCursor, a cursor system for a scope (a section or the whole page):
 * a precise dot plus a ring that follows on a spring. Over elements with
 * data attributes the ring morphs:
 *
 *   data-cursor="View" | "Drag" | "Play" | any short label → ring grows into a labelled disc
 *   data-cursor-magnetic                                     → ring snaps around the element, which leans toward the pointer
 *   data-cursor="hide"                                       → hide the custom cursor (e.g. over text inputs)
 *
 * Props
 * - children                  The scope. The native cursor is hidden inside it (pointer: fine only).
 * - color?: string            Dot / disc colour. Default "#F5F3EE".
 * - blend?: boolean           mix-blend-mode: difference for the ring. Default true.
 * - stiffness?, damping?      Ring spring. Defaults 380 / 30 (the dot is exact).
 * - className / style
 * CSS vars: --fd-cc-color, --fd-cc-ring (ring diameter, default 36px), --fd-cc-disc (label disc, default 88px).
 *
 * Behaviour: hidden on touch / coarse pointers and until the first move; the
 * native cursor comes back over form fields. Keyboard users are unaffected
 * (the cursor is aria-hidden and pointer-only). Reduced motion: the ring
 * follows without spring lag and magnetic leaning is off.
 * Performance: one rAF loop that sleeps when the ring is at rest; target
 * rects are read on enter, writes are transform-only.
 * Browser support: all evergreen browsers.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface CustomCursorProps {
  children: ReactNode;
  color?: string;
  blend?: boolean;
  stiffness?: number;
  damping?: number;
  className?: string;
  style?: CSSProperties;
}

export function CustomCursor({ children, color = "#F5F3EE", blend = true, stiffness = 380, damping = 30, className, style }: CustomCursorProps) {
  const scope = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = scope.current;
    const d = dot.current;
    const r = ring.current;
    const lb = label.current;
    if (!el || !d || !r || !lb) return;
    const fine = window.matchMedia?.("(pointer: fine)").matches ?? true;
    if (!fine) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    el.setAttribute("data-cc-on", "");

    const s = { x: 0, y: 0, vx: 0, vy: 0, w: 36, vw: 0, h: 36, vh: 0 };
    const t = { x: 0, y: 0, w: 36, h: 36 };
    let mx = 0;
    let my = 0;
    let raf = 0;
    let last = 0;
    let shown = false;
    let mag: HTMLElement | null = null;
    let magRect: DOMRect | null = null;
    let ringBase = 36;
    let disc = 88;

    const readVars = () => {
      const cs = getComputedStyle(el);
      ringBase = parseFloat(cs.getPropertyValue("--fd-cc-ring")) || 36;
      disc = parseFloat(cs.getPropertyValue("--fd-cc-disc")) || 88;
    };
    readVars();

    const setTarget = () => {
      if (mag && magRect) {
        const er = el.getBoundingClientRect();
        const cx = magRect.left + magRect.width / 2 - er.left;
        const cy = magRect.top + magRect.height / 2 - er.top;
        // ring hugs the element, offset a little toward the pointer
        t.x = cx + (mx - cx) * 0.12;
        t.y = cy + (my - cy) * 0.12;
        t.w = magRect.width + 14;
        t.h = magRect.height + 14;
        if (!reduced) {
          const lx = (mx - cx) * 0.22;
          const ly = (my - cy) * 0.22;
          mag.style.transform = `translate3d(${lx.toFixed(2)}px,${ly.toFixed(2)}px,0)`;
        }
      } else {
        t.x = mx;
        t.y = my;
        const big = el.getAttribute("data-cc-state") === "label";
        t.w = t.h = big ? disc : ringBase;
      }
    };

    const write = () => {
      d.style.transform = `translate3d(${mx}px,${my}px,0)`;
      r.style.transform = `translate3d(${(s.x - s.w / 2).toFixed(2)}px,${(s.y - s.h / 2).toFixed(2)}px,0)`;
      r.style.width = `${s.w.toFixed(2)}px`;
      r.style.height = `${s.h.toFixed(2)}px`;
    };

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      setTarget();
      if (reduced) {
        s.x = t.x;
        s.y = t.y;
        s.w = t.w;
        s.h = t.h;
      } else {
        const h = dt / 2;
        for (let k = 0; k < 2; k++) {
          s.vx += (-stiffness * (s.x - t.x) - damping * s.vx) * h;
          s.vy += (-stiffness * (s.y - t.y) - damping * s.vy) * h;
          s.vw += (-stiffness * 1.1 * (s.w - t.w) - damping * s.vw) * h;
          s.vh += (-stiffness * 1.1 * (s.h - t.h) - damping * s.vh) * h;
          s.x += s.vx * h;
          s.y += s.vy * h;
          s.w += s.vw * h;
          s.h += s.vh * h;
        }
      }
      write();
      const rest = Math.abs(s.x - t.x) + Math.abs(s.y - t.y) + Math.abs(s.w - t.w) + Math.abs(s.h - t.h) < 0.2 && Math.abs(s.vx) + Math.abs(s.vy) < 0.5;
      if (!rest) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const findTarget = (n: EventTarget | null) => (n instanceof Element ? (n.closest("[data-cursor],[data-cursor-magnetic]") as HTMLElement | null) : null);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const er = el.getBoundingClientRect();
      mx = e.clientX - er.left;
      my = e.clientY - er.top;
      if (!shown) {
        shown = true;
        s.x = t.x = mx;
        s.y = t.y = my;
        el.setAttribute("data-cc-visible", "");
      }
      d.style.transform = `translate3d(${mx}px,${my}px,0)`;
      kick();
    };

    const onOver = (e: PointerEvent) => {
      const tg = findTarget(e.target);
      const native = e.target instanceof Element && e.target.closest("input,textarea,select,[contenteditable='true']");
      const lab = tg?.getAttribute("data-cursor") ?? "";
      if (native || lab === "hide") el.setAttribute("data-cc-state", "hide");
      else if (tg?.hasAttribute("data-cursor-magnetic")) {
        if (mag !== tg) {
          releaseMag();
          mag = tg;
          magRect = tg.getBoundingClientRect();
          // radius of the ring follows the element's own radius
          r.style.borderRadius = getComputedStyle(tg).borderRadius || "9999px";
          tg.style.transition = "transform 120ms linear";
        }
        el.setAttribute("data-cc-state", "magnetic");
      } else if (lab) {
        releaseMag();
        lb.textContent = lab;
        el.setAttribute("data-cc-state", "label");
      } else {
        releaseMag();
        el.removeAttribute("data-cc-state");
      }
      kick();
    };

    const releaseMag = () => {
      if (!mag) return;
      const m = mag;
      m.style.transition = "transform 420ms cubic-bezier(.34,1.56,.64,1)";
      m.style.transform = "";
      mag = null;
      magRect = null;
      r.style.borderRadius = "";
    };

    const onLeave = () => {
      shown = false;
      releaseMag();
      el.removeAttribute("data-cc-visible");
      el.removeAttribute("data-cc-state");
    };
    const onDown = () => el.setAttribute("data-cc-down", "");
    const onUp = () => el.removeAttribute("data-cc-down");
    const onScroll = () => {
      if (mag) magRect = mag.getBoundingClientRect();
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerover", onOver);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", readVars);
    return () => {
      cancelAnimationFrame(raf);
      releaseMag();
      el.removeAttribute("data-cc-on");
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerover", onOver);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", readVars);
    };
  }, [stiffness, damping]);

  return (
    <div ref={scope} className={`fd-cc${className ? " " + className : ""}`} data-blend={blend ? "" : undefined} style={{ ["--fd-cc-color" as string]: color, ...style }}>
      <style>{css}</style>
      {children}
      <div className="fd-cc-layer" aria-hidden="true">
        <div ref={ring} className="fd-cc-ring">
          <span ref={label} className="fd-cc-label" />
        </div>
        <div ref={dot} className="fd-cc-dot" />
      </div>
    </div>
  );
}

const css = `
.fd-cc,.fd-cc-layer,.fd-cc-layer *{box-sizing:border-box}
.fd-cc{--fd-cc-ring:36px;--fd-cc-disc:88px;position:relative;margin:0;padding:0}
.fd-cc[data-cc-on],.fd-cc[data-cc-on] *{cursor:none}
.fd-cc[data-cc-on] :is(input,textarea,select,[contenteditable="true"]){cursor:auto}
.fd-cc-layer{position:absolute;inset:0;margin:0;padding:0;pointer-events:none;z-index:2147483000;overflow:hidden;opacity:0;transition:opacity 240ms cubic-bezier(.22,1,.36,1)}
.fd-cc[data-cc-visible] .fd-cc-layer{opacity:1}
.fd-cc[data-cc-state="hide"] .fd-cc-layer{opacity:0}
.fd-cc-dot{position:absolute;left:-3px;top:-3px;width:6px;height:6px;margin:0;padding:0;border-radius:50%;background:var(--fd-cc-color);will-change:transform;
  transition:opacity 120ms,scale 240ms cubic-bezier(.34,1.56,.64,1)}
.fd-cc-ring{position:absolute;left:0;top:0;display:grid;place-items:center;width:var(--fd-cc-ring);height:var(--fd-cc-ring);margin:0;padding:0;border-radius:9999px;
  border:1.5px solid var(--fd-cc-color);background:transparent;will-change:transform,width,height;
  transition:background-color 240ms cubic-bezier(.22,1,.36,1),border-color 240ms,border-radius 240ms cubic-bezier(.65,0,.35,1),scale 120ms cubic-bezier(.22,1,.36,1)}
.fd-cc[data-blend] .fd-cc-ring{mix-blend-mode:difference}
.fd-cc[data-blend] .fd-cc-dot{mix-blend-mode:difference}
.fd-cc-label{margin:0;padding:0;opacity:0;scale:.6;color:#0B0B0F;font:600 13px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif;letter-spacing:-.005em;white-space:nowrap;
  transition:opacity 120ms,scale 240ms cubic-bezier(.34,1.56,.64,1)}
.fd-cc[data-cc-state="label"] .fd-cc-ring{background:var(--fd-cc-color);border-color:var(--fd-cc-color);mix-blend-mode:normal}
.fd-cc[data-cc-state="label"] .fd-cc-label{opacity:1;scale:1;transition-delay:60ms}
.fd-cc[data-cc-state="label"] .fd-cc-dot,.fd-cc[data-cc-state="magnetic"] .fd-cc-dot{opacity:0;scale:.3}
.fd-cc[data-cc-state="magnetic"] .fd-cc-ring{background:color-mix(in srgb,var(--fd-cc-color) 12%,transparent)}
.fd-cc[data-cc-down] .fd-cc-ring{scale:.88}
@media (pointer:coarse){.fd-cc-layer{display:none}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

export function Demo() {
  return (
    <CustomCursor className="fd-ccd">
      <style>{demoCss}</style>
      <div className="fd-ccd-row">
        <div className="fd-ccd-tile" data-cursor="View" />
        <button type="button" className="fd-ccd-pill" data-cursor-magnetic>Continue</button>
      </div>
    </CustomCursor>
  );
}

const demoCss = `
.fd-ccd,.fd-ccd *,.fd-ccd *::before,.fd-ccd *::after{box-sizing:border-box}
.fd-ccd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#131315;color:#f5f3ee;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
.fd-ccd-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:56px;margin:0;padding:0}
.fd-ccd-tile{width:260px;height:170px;margin:0;padding:0;border-radius:24px;background:#222226}
.fd-ccd-pill{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;justify-content:center;height:48px;margin:0;padding:0 28px;border:0;border-radius:9999px;background:#2b2b30;color:#f5f3ee;font:500 15px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;cursor:pointer}
.fd-ccd-pill:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
@media (max-width:640px){.fd-ccd-row{gap:32px}.fd-ccd-tile{width:min(260px,100%)}}
`;
