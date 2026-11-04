/**
 * TextRepel, a headline whose letters drift away from the cursor (or toward
 * it) and spring back home. Every letter runs its own spring (stiffness 380,
 * damping 30 by default) with a little tilt from horizontal velocity, so the
 * line feels like it is made of something physical.
 *
 * Props
 * - text: string             Headline text (also the accessible label).
 * - as?: "h1" | "h2" | "p" | "div". Default "h1".
 * - mode?: "repel" | "attract". Default "repel".
 * - radius?: number          Influence radius in px. Default 160.
 * - strength?: number        Max displacement in px at the cursor. Default 56.
 * - stiffness?, damping?     Spring settings. Defaults 380 / 30.
 * - tilt?: boolean           Rotate letters with their velocity. Default true.
 * - className / style        Typography comes from you (font-size, colour…).
 * CSS vars: none needed; style the root like any heading.
 *
 * Performance: one rAF loop per instance, letter homes measured on resize
 * only (offsetLeft/Top are transform-independent), reads happen before writes,
 * the loop sleeps when every letter is at rest and pauses off-screen.
 * Accessibility: a visually hidden copy carries the text, letters are aria-hidden.
 * Reduced motion or coarse pointers: letters stay still.
 * Browser support: all evergreen browsers.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, Ref } from "react";

export interface TextRepelProps {
  text: string;
  as?: "h1" | "h2" | "p" | "div";
  mode?: "repel" | "attract";
  radius?: number;
  strength?: number;
  stiffness?: number;
  damping?: number;
  tilt?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function TextRepel({
  text,
  as = "h1",
  mode = "repel",
  radius = 160,
  strength = 56,
  stiffness = 380,
  damping = 30,
  tilt = true,
  className,
  style,
}: TextRepelProps) {
  const root = useRef<HTMLElement>(null);
  const opts = useRef({ mode, radius, strength, stiffness, damping, tilt });
  opts.current = { mode, radius, strength, stiffness, damping, tilt };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>(".fd-tr-c"));
    const n = spans.length;
    const hx = new Float32Array(n);
    const hy = new Float32Array(n);
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const vx = new Float32Array(n);
    const vy = new Float32Array(n);
    let px = -1e6;
    let py = -1e6;
    let inside = false;
    let raf = 0;
    let last = 0;
    let visible = true;

    const measure = () => {
      for (let i = 0; i < n; i++) {
        const s = spans[i];
        // offsetParent is the root (position:relative); offsets ignore transforms
        let ox = s.offsetLeft + s.offsetWidth / 2;
        let oy = s.offsetTop + s.offsetHeight / 2;
        const p = s.offsetParent as HTMLElement | null;
        if (p && p !== el) {
          ox += p.offsetLeft;
          oy += p.offsetTop;
        }
        hx[i] = ox;
        hy[i] = oy;
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    document.fonts?.ready.then(measure).catch(() => {});

    const tick = (t: number) => {
      raf = 0;
      const dt = Math.min(0.032, (t - last) / 1000 || 0.016);
      last = t;
      const o = opts.current;
      const R = o.radius;
      const sign = o.mode === "attract" ? -1 : 1;
      // read once per frame
      const r = el.getBoundingClientRect();
      const lx = px - r.left;
      const ly = py - r.top;
      let moving = false;
      const h = dt / 2;
      for (let i = 0; i < n; i++) {
        let tx = 0;
        let ty = 0;
        if (inside) {
          const dx = hx[i] - lx;
          const dy = hy[i] - ly;
          const d = Math.hypot(dx, dy) || 0.0001;
          if (d < R) {
            const mag = Math.pow(1 - d / R, 2) * o.strength;
            // attract never overshoots the cursor
            const m = sign > 0 ? mag : -Math.min(mag, d * 0.6);
            tx = (dx / d) * m;
            ty = (dy / d) * m;
          }
        }
        for (let k = 0; k < 2; k++) {
          vx[i] += (-o.stiffness * (x[i] - tx) - o.damping * vx[i]) * h;
          vy[i] += (-o.stiffness * (y[i] - ty) - o.damping * vy[i]) * h;
          x[i] += vx[i] * h;
          y[i] += vy[i] * h;
        }
        if (Math.abs(x[i] - tx) > 0.05 || Math.abs(y[i] - ty) > 0.05 || Math.abs(vx[i]) > 0.5 || Math.abs(vy[i]) > 0.5) moving = true;
      }
      // write
      for (let i = 0; i < n; i++) {
        const rot = o.tilt ? Math.max(-24, Math.min(24, vx[i] * 0.04 + x[i] * 0.18)) : 0;
        spans[i].style.transform = `translate3d(${x[i].toFixed(2)}px,${y[i].toFixed(2)}px,0) rotate(${rot.toFixed(2)}deg)`;
      }
      if ((moving || inside) && visible && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf && visible) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" && e.buttons === 0) return;
      px = e.clientX;
      py = e.clientY;
      const r = el.getBoundingClientRect();
      const pad = opts.current.radius;
      inside = px > r.left - pad && px < r.right + pad && py > r.top - pad && py < r.bottom + pad;
      kick();
    };
    const onLeave = () => {
      inside = false;
      kick();
    };
    const io = new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
      if (visible) kick();
    });
    io.observe(el);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      if (raf) cancelAnimationFrame(raf);
      spans.forEach((s) => (s.style.transform = ""));
    };
  }, [text]);

  const Tag = as as "h1";
  const words = text.split(/(\s+)/);
  return (
    <Tag ref={root as Ref<HTMLHeadingElement>} className={`fd-tr${className ? " " + className : ""}`} style={style}>
      <style>{css}</style>
      <span className="fd-tr-sr">{text}</span>
      {words.map((w, k) =>
        /^\s+$/.test(w) ? (
          " "
        ) : (
          <span key={k} className="fd-tr-w" aria-hidden="true">
            {Array.from(w).map((ch, j) => (
              <span key={j} className="fd-tr-c">{ch}</span>
            ))}
          </span>
        ),
      )}
    </Tag>
  );
}

const css = `
:where(.fd-tr){margin:0;padding:0;border:0;background:none;color:inherit;
  font:700 clamp(3rem,9vw,7rem)/.92 "SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.04em;text-wrap:balance}
.fd-tr,.fd-tr *{box-sizing:border-box}
.fd-tr{position:relative;display:block;user-select:none;-webkit-user-select:none;touch-action:pan-y}
.fd-tr-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.fd-tr-w{position:relative;display:inline-block;margin:0;padding:0;white-space:nowrap}
.fd-tr-c{display:inline-block;margin:0;padding:0;will-change:transform;transform-origin:50% 70%}
`;

/* ───────────────────────────── demo ───────────────────────────── */

export function Demo() {
  const [mode, setMode] = useState<"repel" | "attract">("repel");
  return (
    <div className="fd-trd">
      <style>{demoCss}</style>
      <TextRepel as="h2" text="Hold still if you can." mode={mode} className="fd-trd-text" radius={170} strength={mode === "repel" ? 60 : 34} />
      <div className="fd-trd-seg" role="radiogroup" aria-label="Cursor field">
        {(["repel", "attract"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>
            {m === "repel" ? "Repel" : "Attract"}
          </button>
        ))}
      </div>
    </div>
  );
}

const demoCss = `
.fd-trd,.fd-trd *,.fd-trd *::before,.fd-trd *::after{box-sizing:border-box}
.fd-trd{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f2f2f2;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
.fd-trd .fd-trd-text{margin:0;padding:0;max-width:11em;text-align:center;color:#1d1d1f;font:600 clamp(40px,8.4vw,96px)/1.04 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-.045em;cursor:default}
.fd-trd-seg{display:inline-flex;gap:2px;margin:0;padding:3px;border-radius:9999px;background:rgba(0,0,0,.06)}
.fd-trd-seg button{appearance:none;-webkit-appearance:none;margin:0;height:30px;padding:0 14px;border:0;border-radius:9999px;background:transparent;color:#6e6e73;font:500 13px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;cursor:pointer;transition:background-color 220ms cubic-bezier(.65,0,.35,1),color 220ms}
.fd-trd-seg button[aria-checked="true"]{background:#fff;color:#1d1d1f;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.fd-trd-seg button:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
`;
