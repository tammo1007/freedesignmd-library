/**
 * PullButton, a button that leans toward the cursor as it gets close. The
 * label travels a little further than the shell, and the whole thing snaps
 * back on a spring when the pointer leaves.
 *
 * Props: every <button> prop, plus strength (0 to 1, default 0.35),
 * reach (px around the button where it starts to react, default 56),
 * variant ("solid" | "soft", default "solid").
 * CSS vars: --fd-pb-bg, --fd-pb-fg, --fd-pb-radius.
 *
 * Browser support: all evergreen browsers. A small requestAnimationFrame
 * spring runs only while the button is moving and stops by itself.
 * Accessibility: a normal button with a visible focus ring; the pull is
 * pointer-only and is switched off for touch and reduced motion.
 */
import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export interface PullButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  strength?: number;
  reach?: number;
  variant?: "solid" | "soft";
}

export function PullButton({
  strength = 0.35,
  reach = 56,
  variant = "solid",
  className,
  children,
  ...rest
}: PullButtonProps) {
  const zone = useRef<HTMLSpanElement>(null);
  const shell = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const s = useRef({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, raf: 0, last: 0 });

  useEffect(() => {
    const z = zone.current;
    const sh = shell.current;
    const lb = label.current;
    if (!z || !sh || !lb) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const st = s.current;

    const apply = () => {
      sh.style.transform = `translate3d(${st.x.toFixed(2)}px, ${st.y.toFixed(2)}px, 0)`;
      lb.style.transform = `translate3d(${(st.x * 0.45).toFixed(2)}px, ${(st.y * 0.45).toFixed(2)}px, 0)`;
    };
    const tick = (t: number) => {
      const dt = Math.min((t - st.last) / 1000 || 0.016, 0.032);
      st.last = t;
      const k = 190;
      const c = 15;
      st.vx += ((st.tx - st.x) * k - st.vx * c) * dt;
      st.vy += ((st.ty - st.y) * k - st.vy * c) * dt;
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      apply();
      const settled = Math.abs(st.vx) + Math.abs(st.vy) < 0.05 && Math.abs(st.tx - st.x) + Math.abs(st.ty - st.y) < 0.05;
      if (settled) {
        st.x = st.tx;
        st.y = st.ty;
        apply();
        st.raf = 0;
      } else st.raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!st.raf) {
        st.last = performance.now();
        st.raf = requestAnimationFrame(tick);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = sh.getBoundingClientRect();
      const cx = r.left - st.x + r.width / 2;
      const cy = r.top - st.y + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const insideX = Math.abs(dx) < r.width / 2 + reach;
      const insideY = Math.abs(dy) < r.height / 2 + reach;
      if (insideX && insideY) {
        st.tx = dx * strength;
        st.ty = dy * strength;
      } else {
        st.tx = 0;
        st.ty = 0;
      }
      wake();
    };
    const onLeave = () => {
      st.tx = 0;
      st.ty = 0;
      wake();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    z.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      z.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
  }, [strength, reach]);

  return (
    <span ref={zone} className="fd-pb" style={{ padding: reach }}>
      <style>{css}</style>
      <button type="button" {...rest} className={`fd-pb-btn${className ? ` ${className}` : ""}`} data-variant={variant}>
        <span ref={shell} className="fd-pb-shell" aria-hidden="true" />
        <span ref={label} className="fd-pb-label">
          {children}
        </span>
      </button>
    </span>
  );
}

const FONT = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
const css = `
.fd-pb,.fd-pb *,.fd-pb *::before,.fd-pb *::after{box-sizing:border-box}
.fd-pb{display:inline-block;margin:0;font:400 15px/1.2 ${FONT}}
.fd-pb-btn{--fd-pb-bg:#111;--fd-pb-fg:#fff;--fd-pb-radius:999px;position:relative;display:inline-flex;align-items:center;justify-content:center;margin:0;padding:15px 28px;border:0;border-radius:var(--fd-pb-radius);background:transparent;color:var(--fd-pb-fg);font:500 15px/1.2 ${FONT};letter-spacing:normal;text-decoration:none;cursor:pointer;appearance:none;-webkit-appearance:none;-webkit-tap-highlight-color:transparent}
.fd-pb-btn[data-variant="soft"]{--fd-pb-bg:rgba(255,255,255,.9);--fd-pb-fg:#1d1d1f}
.fd-pb-shell{position:absolute;inset:0;display:block;margin:0;padding:0;border-radius:inherit;background:var(--fd-pb-bg);box-shadow:0 1px 2px rgba(0,0,0,.14),0 10px 22px -10px rgba(0,0,0,.4);transition:scale 220ms cubic-bezier(0.22,1,0.36,1);will-change:transform}
.fd-pb-btn[data-variant="soft"] .fd-pb-shell{box-shadow:0 0 0 1px rgba(0,0,0,.06),0 8px 20px -10px rgba(0,0,0,.25)}
.fd-pb-btn:active .fd-pb-shell{scale:.95}
.fd-pb-btn:focus-visible{outline:2px solid #1a73e8;outline-offset:4px}
.fd-pb-label{position:relative;display:block;margin:0;padding:0;will-change:transform}
`;

export function Demo() {
  return (
    <div className="fd-pbd">
      <style>{demoCss}</style>
      <PullButton>Get started</PullButton>
    </div>
  );
}

const demoCss = `
.fd-pbd,.fd-pbd *,.fd-pbd *::before,.fd-pbd *::after{box-sizing:border-box}
.fd-pbd{display:flex;align-items:center;justify-content:center;width:100%;min-height:100vh;margin:0;padding:48px 20px;background:#ececec;font:400 15px/1.4 ${FONT};letter-spacing:normal;overflow:hidden}
`;
