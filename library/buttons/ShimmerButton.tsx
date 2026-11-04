/**
 * ShimmerButton, dark capsule with a travelling light sweep and a rotating
 * border glow. Built for single, high-intent calls to action.
 *
 * Props: size ("sm" | "md" | "lg"), iconRight, speed (seconds per sweep,
 * default 3.2), theme ("light" | "dark" | inherits [data-fd-theme]), plus every
 * native <button> prop. CSS vars: --fd-shim-bg, --fd-shim-glow, --fd-shim-radius.
 *
 * Browser support: sweep works everywhere; the rotating ring uses @property
 * (Chrome, Edge, Safari 16.4+, Firefox 128+) and degrades to a static ring.
 * Accessibility: native <button>, visible focus ring, effects are
 * aria-hidden. Reduced motion: sweep and ring animation are removed.
 */
import { forwardRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ShimmerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  iconRight?: ReactNode;
  speed?: number;
  theme?: "light" | "dark";
}

export const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(function ShimmerButton(
  { size = "md", iconRight, speed = 3.2, theme, className, style, children, type = "button", ...rest },
  ref,
) {
  return (
    <>
      <style>{css}</style>
      <button
        ref={ref}
        type={type}
        className={`fd-shim${className ? " " + className : ""}`}
        data-size={size}
        data-fd-theme={theme}
        style={{ ["--fd-shim-speed" as string]: `${speed}s`, ...style }}
        {...rest}
      >
        <span className="fd-shim-ring" aria-hidden="true" />
        <span className="fd-shim-sweep" aria-hidden="true" />
        <span className="fd-shim-content">
          <span className="fd-shim-label">{children}</span>
          {iconRight && <span className="fd-shim-icon">{iconRight}</span>}
        </span>
      </button>
    </>
  );
});

const css = `
:where(.fd-shim,.fd-shim *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-shim,.fd-shim *)::before,:where(.fd-shim,.fd-shim *)::after{box-sizing:border-box}
:where(.fd-shim svg){display:block;flex-shrink:0}
@property --fd-shim-a{syntax:"<angle>";inherits:false;initial-value:0deg}
.fd-shim{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --fd-shim-bg:#0B0B0F;--fd-shim-fg:#F5F5F7;--fd-shim-edge:rgba(255,255,255,.14);--fd-shim-glow:255,255,255;--fd-shim-radius:9999px;
  --s-shadow:0 1px 0 rgba(255,255,255,.1) inset,0 1px 2px rgba(11,11,15,.3),0 12px 28px -12px rgba(11,11,15,.55);
  position:relative;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;isolation:isolate;
  appearance:none;-webkit-appearance:none;border:0;outline:0;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;
  background:var(--fd-shim-bg);color:var(--fd-shim-fg);border-radius:var(--fd-shim-radius);
  font:500 15px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;
  box-shadow:0 0 0 1px var(--fd-shim-edge),var(--s-shadow);
  transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring),box-shadow var(--fd-dur-2) var(--fd-ease-out);
}
[data-fd-theme="dark"] .fd-shim,.fd-shim[data-fd-theme="dark"]{--fd-shim-bg:#1F1F27;--fd-shim-edge:rgba(255,255,255,.16);--s-shadow:0 1px 0 rgba(255,255,255,.08) inset,0 1px 2px rgba(0,0,0,.5),0 12px 32px -12px rgba(0,0,0,.8)}
.fd-shim[data-size="sm"]{height:32px;padding:0 14px;font-size:13px}
.fd-shim[data-size="md"]{height:40px;padding:0 20px;font-size:15px}
.fd-shim[data-size="lg"]{height:52px;padding:0 28px;font-size:17px;letter-spacing:-.01em}
.fd-shim-content{position:relative;z-index:2;display:inline-flex;align-items:center;gap:8px}
.fd-shim-label{display:block;white-space:nowrap}
.fd-shim-icon{display:grid;place-items:center;width:18px;height:18px;transition:transform var(--fd-dur-2) var(--fd-ease-out)}
.fd-shim-icon svg{width:100%;height:100%}
.fd-shim-sweep{position:absolute;z-index:1;top:0;bottom:0;left:0;width:45%;pointer-events:none;
  background:linear-gradient(100deg,transparent 0%,rgba(var(--fd-shim-glow),.0) 20%,rgba(var(--fd-shim-glow),.22) 50%,rgba(var(--fd-shim-glow),0) 80%,transparent 100%);
  transform:translateX(-120%) skewX(-18deg);animation:fd-shim-sweep var(--fd-shim-speed,3.2s) var(--fd-ease-out) infinite}
.fd-shim-ring{position:absolute;inset:0;z-index:1;border-radius:inherit;padding:1px;pointer-events:none;
  background:conic-gradient(from var(--fd-shim-a),transparent 0deg,transparent 250deg,rgba(var(--fd-shim-glow),.9) 320deg,transparent 360deg);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);
  animation:fd-shim-spin calc(var(--fd-shim-speed,3.2s) * 1.6) linear infinite;opacity:.8;transition:opacity var(--fd-dur-2) var(--fd-ease-out)}
@media (hover:hover){
  .fd-shim:hover{box-shadow:0 0 0 1px rgba(var(--fd-shim-glow),.22),var(--s-shadow),0 0 28px -4px rgba(var(--fd-shim-glow),.28)}
  .fd-shim:hover .fd-shim-ring{opacity:1}
  .fd-shim:hover .fd-shim-icon{transform:translateX(2px)}
}
.fd-shim:active{transform:scale(.96);transition:transform var(--fd-dur-1) var(--fd-ease-out),box-shadow var(--fd-dur-2) var(--fd-ease-out)}
.fd-shim:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
.fd-shim:disabled{opacity:.5;cursor:not-allowed;transform:none}
.fd-shim:disabled .fd-shim-sweep,.fd-shim:disabled .fd-shim-ring{animation:none;opacity:0}
@keyframes fd-shim-sweep{0%{transform:translateX(-120%) skewX(-18deg)}55%,100%{transform:translateX(320%) skewX(-18deg)}}
@keyframes fd-shim-spin{to{--fd-shim-a:360deg}}
@media (prefers-reduced-motion:reduce){
  .fd-shim,.fd-shim:active{transition:box-shadow var(--fd-dur-1) linear;transform:none}
  .fd-shim-sweep{display:none}
  .fd-shim-ring{animation:none;--fd-shim-a:300deg;opacity:.6}
  .fd-shim-icon{transition:none}
}
@media (prefers-contrast:more){.fd-shim{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const arrow = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export function Demo() {
  return (
    <div className="fd-shimd">
      <style>{demoCss}</style>
      <ShimmerButton size="lg" iconRight={arrow} theme="dark">Join the waitlist</ShimmerButton>
    </div>
  );
}

const demoCss = `
.fd-shimd,.fd-shimd *,.fd-shimd *::before,.fd-shimd *::after{box-sizing:border-box}
.fd-shimd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f4f4f4;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
`;
