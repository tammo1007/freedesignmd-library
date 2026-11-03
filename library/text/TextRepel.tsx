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
    <div className="fd-tr-demo">
      <style>{demoCss}</style>
      <header className="fd-tr-demo-bar">
        <span className="fd-tr-demo-brand">Marrow<span>&amp;</span>Pine</span>
        <span className="fd-tr-demo-loc">Rotterdam, 51.92°N</span>
        <div className="fd-tr-demo-seg" role="radiogroup" aria-label="Cursor field">
          {(["repel", "attract"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>
              {m === "repel" ? "Repel" : "Attract"}
            </button>
          ))}
        </div>
      </header>
      <main className="fd-tr-demo-main">
        <p className="fd-tr-demo-eyebrow">Independent brand &amp; motion studio · Est. 2014</p>
        <TextRepel text="We make brands people can’t scroll past." mode={mode} className="fd-tr-demo-h1" radius={180} strength={mode === "repel" ? 64 : 36} />
        <div className="fd-tr-demo-row">
          <p className="fd-tr-demo-copy">
            Identity, motion and digital product for companies that would rather be remembered than merely seen. Currently shaping launches for a Dutch
            e-bike maker, a Lisbon hotel group and a climate fund.
          </p>
          <a className="fd-tr-demo-cta" href="#work">
            See selected work
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </a>
        </div>
        <ul className="fd-tr-demo-tags" aria-label="Disciplines">
          {["Brand systems", "Motion identity", "Type design", "Product UI", "Launch films"].map((t) => <li key={t}>{t}</li>)}
        </ul>
      </main>
      <footer className="fd-tr-demo-foot">
        <span>Clients incl. Veloq, Oda Hotels, Northbound Fund</span>
        <span>hello@marrowpine.studio</span>
      </footer>
    </div>
  );
}

const demoCss = `
.fd-tr-demo,.fd-tr-demo *,.fd-tr-demo *::before,.fd-tr-demo *::after{box-sizing:border-box}
.fd-tr-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:"SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;
  --d-bg:#E9FF5B;--d-ink:#111110;--d-mut:rgba(17,17,16,.62);
  display:flex;flex-direction:column;margin:0;padding:0;min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.5 var(--d-font);-webkit-font-smoothing:antialiased}
.fd-tr-demo-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0;padding:20px clamp(16px,4vw,48px)}
.fd-tr-demo-brand{margin:0;font:700 20px/1 var(--d-disp);letter-spacing:-.03em}
.fd-tr-demo-brand span{margin:0 2px;font-style:italic;font-weight:400;font-family:ui-serif,Georgia,serif}
.fd-tr-demo-loc{margin:0;font:500 13px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;color:var(--d-mut)}
.fd-tr-demo-seg{display:inline-flex;margin:0;padding:3px;border-radius:9999px;background:rgba(17,17,16,.08)}
.fd-tr-demo-seg button{appearance:none;-webkit-appearance:none;margin:0;height:30px;padding:0 14px;border:0;border-radius:9999px;background:transparent;color:var(--d-mut);
  font:500 13px/1 var(--d-font);cursor:pointer;transition:background-color 240ms cubic-bezier(.65,0,.35,1),color 240ms}
.fd-tr-demo-seg button[aria-checked="true"]{background:var(--d-ink);color:var(--d-bg)}
.fd-tr-demo button:focus-visible,.fd-tr-demo a:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px}
.fd-tr-demo-main{flex:1;display:flex;flex-direction:column;justify-content:center;margin:0 auto;padding:clamp(24px,6vh,64px) clamp(16px,4vw,48px);width:100%;max-width:1440px}
.fd-tr-demo-eyebrow{margin:0 0 24px;font:500 13px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;color:var(--d-mut);text-transform:uppercase;letter-spacing:.04em}
.fd-tr-demo-h1{max-width:11ch;color:var(--d-ink);font:800 clamp(52px,10.4vw,152px)/.88 var(--d-disp);letter-spacing:-.055em;cursor:crosshair}
.fd-tr-demo-row{display:flex;align-items:flex-end;justify-content:space-between;gap:32px;flex-wrap:wrap;margin:clamp(32px,6vh,64px) 0 0}
.fd-tr-demo-copy{max-width:30em;margin:0;font:400 17px/1.5 var(--d-font);letter-spacing:-.01em;color:var(--d-ink)}
.fd-tr-demo-cta{display:inline-flex;align-items:center;gap:10px;height:56px;margin:0;padding:0 26px;border-radius:9999px;background:var(--d-ink);color:var(--d-bg);
  font:500 17px/1 var(--d-font);text-decoration:none;transition:transform 120ms cubic-bezier(.22,1,.36,1)}
.fd-tr-demo-cta:active{transform:scale(.96)}
.fd-tr-demo-cta svg{display:block}
.fd-tr-demo-tags{display:flex;flex-wrap:wrap;gap:8px;margin:32px 0 0;padding:0;list-style:none}
.fd-tr-demo-tags li{margin:0;padding:8px 14px;border-radius:9999px;box-shadow:inset 0 0 0 1px rgba(17,17,16,.3);font:500 13px/1 var(--d-font)}
.fd-tr-demo-foot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:0;padding:20px clamp(16px,4vw,48px);border-top:1px solid rgba(17,17,16,.16);font:500 13px/1.3 var(--d-font);color:var(--d-mut)}
@media (max-width:640px){.fd-tr-demo-loc{display:none}}
`;
