/**
 * MagneticButton — a button that leans toward the cursor when it gets close,
 * driven by a small spring integrator (stiffness 380, damping 30, mass 1).
 * The label travels further than the shell, which gives a parallax feel.
 *
 * Props: strength (0–1, how far it follows, default .35), radius (px of
 * attraction beyond the button edge, default 80), shape ("pill" | "circle"),
 * size ("md" | "lg" | "xl"), tone ("solid" | "outline"), theme, plus native
 * <button> props (or pass `href` to render an <a>).
 * CSS vars: --fd-mag-bg, --fd-mag-fg, --fd-mag-size.
 *
 * Browser support: all evergreen browsers. Pointer attraction is disabled for
 * touch input and for prefers-reduced-motion; the button stays fully usable.
 * Accessibility: native <button>/<a>, focus ring, no transforms affect the
 * hit target semantics. The rAF loop runs only while the button is moving and
 * is cleaned up on unmount.
 */
import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface MagneticButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  href?: string;
  strength?: number;
  radius?: number;
  shape?: "pill" | "circle";
  size?: "md" | "lg" | "xl";
  tone?: "solid" | "outline";
  theme?: "light" | "dark";
}

export function MagneticButton({
  children,
  href,
  strength = 0.35,
  radius = 80,
  shape = "pill",
  size = "lg",
  tone = "solid",
  theme,
  className,
  ...rest
}: MagneticButtonProps) {
  const wrap = useRef<HTMLSpanElement>(null);
  const shell = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = wrap.current;
    if (!host || !window.matchMedia) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const s = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    let raf = 0;
    let last = 0;
    const K = 380;
    const C = 30;

    const apply = () => {
      if (shell.current) shell.current.style.transform = `translate3d(${s.x.toFixed(2)}px,${s.y.toFixed(2)}px,0)`;
      if (label.current) label.current.style.transform = `translate3d(${(s.x * 0.55).toFixed(2)}px,${(s.y * 0.55).toFixed(2)}px,0)`;
    };

    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000 || 0.016, 0.032);
      last = t;
      // semi-implicit Euler, two substeps for stability
      for (let i = 0; i < 2; i++) {
        const h = dt / 2;
        s.vx += (-K * (s.x - s.tx) - C * s.vx) * h;
        s.vy += (-K * (s.y - s.ty) - C * s.vy) * h;
        s.x += s.vx * h;
        s.y += s.vy * h;
      }
      apply();
      const rest = Math.abs(s.x - s.tx) < 0.05 && Math.abs(s.y - s.ty) < 0.05 && Math.abs(s.vx) < 0.05 && Math.abs(s.vy) < 0.05;
      if (rest) {
        s.x = s.tx;
        s.y = s.ty;
        s.vx = s.vy = 0;
        apply();
        raf = 0;
      } else raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = host.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const inside = Math.abs(dx) < r.width / 2 + radius && Math.abs(dy) < r.height / 2 + radius;
      const nx = inside ? dx * strength : 0;
      const ny = inside ? dy * strength : 0;
      if (nx !== s.tx || ny !== s.ty) {
        s.tx = nx;
        s.ty = ny;
        kick();
      }
    };
    const onLeave = () => {
      s.tx = s.ty = 0;
      kick();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [strength, radius]);

  const inner = (
    <>
      <span ref={shell} className="fd-mag-shell" aria-hidden="true" />
      <span ref={label} className="fd-mag-label">{children}</span>
    </>
  );
  const cls = `fd-mag-btn${className ? " " + className : ""}`;

  return (
    <span ref={wrap} className="fd-mag" data-shape={shape} data-size={size} data-tone={tone} data-fd-theme={theme}>
      <style>{css}</style>
      {href ? (
        <a className={cls} href={href}>{inner}</a>
      ) : (
        <button type="button" className={cls} {...rest}>{inner}</button>
      )}
    </span>
  );
}

const css = `
:where(.fd-mag,.fd-mag *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-mag,.fd-mag *)::before,:where(.fd-mag,.fd-mag *)::after{box-sizing:border-box}
:where(.fd-mag button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-mag{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --fd-mag-bg:#0B0B0F;--fd-mag-fg:#F5F5F7;--fd-mag-ink:#0B0B0F;--fd-mag-line:rgba(11,11,15,.18);
  display:inline-flex;vertical-align:middle;
  font:500 15px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
}
[data-fd-theme="dark"] .fd-mag,.fd-mag[data-fd-theme="dark"]{--fd-mag-bg:#F5F5F7;--fd-mag-fg:#0B0B0F;--fd-mag-ink:#F5F5F7;--fd-mag-line:rgba(255,255,255,.22)}
.fd-mag[data-size="md"]{--m-h:40px;--m-px:20px;--m-fs:15px}
.fd-mag[data-size="lg"]{--m-h:52px;--m-px:28px;--m-fs:17px}
.fd-mag[data-size="xl"]{--m-h:64px;--m-px:36px;--m-fs:20px}
.fd-mag-btn{position:relative;display:inline-grid;place-items:center;height:var(--m-h);padding:0 var(--m-px);border-radius:9999px;
  appearance:none;-webkit-appearance:none;border:0;outline:0;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;
  background:none;color:var(--fd-mag-fg);font-weight:500;font-size:var(--m-fs);line-height:1;font-family:inherit;letter-spacing:-.01em;white-space:nowrap;
  transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring)}
.fd-mag[data-shape="circle"] .fd-mag-btn{width:var(--fd-mag-size,148px);height:var(--fd-mag-size,148px);padding:0}
.fd-mag[data-tone="outline"] .fd-mag-btn{color:var(--fd-mag-ink)}
.fd-mag-btn:active{transform:scale(.96);transition:transform var(--fd-dur-1) var(--fd-ease-out)}
.fd-mag-btn:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:4px}
.fd-mag-shell{position:absolute;inset:0;border-radius:inherit;background:var(--fd-mag-bg);will-change:transform;
  box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 1px 2px rgba(11,11,15,.2),0 14px 28px -14px rgba(11,11,15,.5);
  transition:box-shadow var(--fd-dur-2) var(--fd-ease-out),background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-mag[data-tone="outline"] .fd-mag-shell{background:transparent;box-shadow:0 0 0 1px var(--fd-mag-line)}
@media (hover:hover){
  .fd-mag-btn:hover .fd-mag-shell{box-shadow:0 1px 0 rgba(255,255,255,.2) inset,0 2px 4px rgba(11,11,15,.2),0 22px 36px -14px rgba(11,11,15,.55)}
  .fd-mag[data-tone="outline"] .fd-mag-btn:hover .fd-mag-shell{box-shadow:0 0 0 1px var(--fd-mag-ink)}
}
.fd-mag-label{position:relative;display:block;will-change:transform;pointer-events:none}
@media (prefers-reduced-motion:reduce){.fd-mag-btn,.fd-mag-btn:active{transition:none;transform:none}.fd-mag-shell,.fd-mag-label{transform:none!important}}
@media (prefers-contrast:more){.fd-mag-shell{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const arrowUR = (
  <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", marginLeft: 6 }}><path d="M7 17L17 7M8 7h9v9" /></svg>
);

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [copied, setCopied] = useState(false);

  return (
    <div className="fd-mag-demo" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-mag-demo-bar">
        <span className="fd-mag-demo-brand">Kiln&nbsp;&amp;&nbsp;Field<sup>®</sup></span>
        <nav className="fd-mag-demo-nav" aria-label="Primary">
          <a href="#work">Work</a><a href="#studio">Studio</a><a href="#journal">Journal</a>
        </nav>
        <button
          type="button"
          className="fd-mag-demo-theme"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </header>

      <main className="fd-mag-demo-main">
        <p className="fd-mag-demo-eyebrow">Brand · Motion · Digital product — Lisbon / Berlin</p>
        <h1 className="fd-mag-demo-h1">
          Tell us what you’re <em>making</em>.<br />We’ll make it unforgettable.
        </h1>

        <div className="fd-mag-demo-cta">
          <MagneticButton shape="circle" size="xl" strength={0.4} radius={110} onClick={() => setCopied(true)} className="fd-mag-demo-big">
            {copied ? "Brief sent" : "Say hello"}
          </MagneticButton>
          <div className="fd-mag-demo-aside">
            <p>New projects for Q1 2027 — we take on six a year.</p>
            <div className="fd-mag-demo-links">
              <MagneticButton size="md" tone="outline" href="mailto:studio@kilnandfield.example">studio@kilnandfield.example</MagneticButton>
              <MagneticButton size="md" tone="outline" href="#deck">Credentials deck{arrowUR}</MagneticButton>
            </div>
          </div>
        </div>

        <dl className="fd-mag-demo-facts">
          <div><dt>Recent</dt><dd>Oda Hotels · identity &amp; booking</dd></div>
          <div><dt>Awards</dt><dd>D&amp;AD Pencil, Awwwards SOTD ×4</dd></div>
          <div><dt>Response time</dt><dd>Within two working days</dd></div>
        </dl>
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-mag-demo,.fd-mag-demo *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-mag-demo,.fd-mag-demo *)::before,:where(.fd-mag-demo,.fd-mag-demo *)::after{box-sizing:border-box}
:where(.fd-mag-demo button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-mag-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:ui-sans-serif,-apple-system,"SF Pro Display","Inter",sans-serif;
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-dur-2:240ms;
  --d-bg:#F2F0EB;--d-ink:#0B0B0F;--d-mut:#5E5C57;--d-line:rgba(11,11,15,.12);--d-em:#C2410C;
  min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.45 var(--d-font);-webkit-font-smoothing:antialiased;transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-mag-demo[data-fd-theme="dark"]{--d-bg:#0D0D10;--d-ink:#F5F3EE;--d-mut:#A19F99;--d-line:rgba(255,255,255,.12);--d-em:#FF8A4C}
.fd-mag-demo-bar{display:flex;align-items:center;justify-content:space-between;padding:20px clamp(16px,4vw,48px)}
.fd-mag-demo-brand{font:600 17px/1 var(--d-disp);letter-spacing:-.02em}
.fd-mag-demo-brand sup{font-size:10px;vertical-align:top;margin-left:2px}
.fd-mag-demo-nav{display:flex;gap:32px;font:400 15px/1 var(--d-font);color:var(--d-mut)}
.fd-mag-demo-nav a{padding:8px 0}.fd-mag-demo-nav a:hover{color:var(--d-ink)}
.fd-mag-demo-nav a:focus-visible,.fd-mag-demo-theme:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px;border-radius:6px}
.fd-mag-demo-theme{cursor:pointer;height:32px;padding:0 14px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-mag-demo-theme:hover{color:var(--d-ink)}
.fd-mag-demo-main{padding:clamp(32px,8vh,96px) clamp(16px,4vw,48px) 48px;max-width:1240px;margin:0 auto}
.fd-mag-demo-eyebrow{font:500 13px/1 var(--d-font);color:var(--d-mut);letter-spacing:.02em;text-transform:uppercase}
.fd-mag-demo-h1{margin-top:28px;font:600 clamp(36px,7.4vw,88px)/.98 var(--d-disp);letter-spacing:-.045em;max-width:12.5em}
.fd-mag-demo-h1 em{font-style:normal;color:var(--d-em)}
.fd-mag-demo-cta{display:flex;align-items:center;gap:clamp(24px,5vw,72px);margin-top:clamp(40px,8vh,88px);flex-wrap:wrap}
.fd-mag-demo-big{--fd-mag-size:164px}
.fd-mag-demo-aside{display:flex;flex-direction:column;gap:20px;max-width:520px}
.fd-mag-demo-aside p{font:400 17px/1.45 var(--d-font);letter-spacing:-.01em;color:var(--d-mut)}
.fd-mag-demo-links{display:flex;flex-wrap:wrap;gap:12px}
.fd-mag-demo-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-top:clamp(48px,10vh,112px);padding-top:24px;border-top:1px solid var(--d-line)}
.fd-mag-demo-facts dt{font:500 12px/1 var(--d-font);text-transform:uppercase;letter-spacing:.04em;color:var(--d-mut);margin-bottom:10px}
.fd-mag-demo-facts dd{font:400 15px/1.4 var(--d-font)}
@media (max-width:720px){.fd-mag-demo-nav{display:none}.fd-mag-demo-facts{grid-template-columns:1fr}}
`;
