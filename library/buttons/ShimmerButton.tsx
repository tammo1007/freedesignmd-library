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
const check = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const valid = /^\S+@\S+\.\S+$/.test(email);
  const [touched, setTouched] = useState(false);

  return (
    <div className="fd-shim-demo" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-shim-demo-bar">
        <div className="fd-shim-demo-brand"><span className="fd-shim-demo-mark" aria-hidden="true" />Lumen</div>
        <nav className="fd-shim-demo-nav" aria-label="Primary">
          <a href="#models">Models</a><a href="#pricing">Pricing</a><a href="#changelog">Changelog</a>
        </nav>
        <button
          type="button"
          className="fd-shim-demo-theme"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg>
          ) : (
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
          )}
        </button>
      </header>

      <main className="fd-shim-demo-hero">
        <p className="fd-shim-demo-pill"><span className="fd-shim-demo-dot" />Private beta · Q4 2026</p>
        <h1 className="fd-shim-demo-h1">Research that reads<br />the whole literature.</h1>
        <p className="fd-shim-demo-sub">Lumen reads 40 million papers, patents and trial registries, then drafts a cited brief in under two minutes.</p>

        {done ? (
          <div className="fd-shim-demo-done" role="status">
            <span className="fd-shim-demo-done-ic">{check}</span>
            <span>You’re <b>#12,409</b> on the list. We’ll email {email}.</span>
          </div>
        ) : (
          <form
            className="fd-shim-demo-form"
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              if (valid) setDone(true);
            }}
          >
            <label className="fd-shim-demo-field">
              <span className="fd-shim-demo-sr">Work email</span>
              <input type="email" placeholder="you@lab.org" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={touched && !valid} aria-describedby="fd-shim-err" />
            </label>
            <ShimmerButton size="lg" type="submit" iconRight={arrow}>Join the waitlist</ShimmerButton>
          </form>
        )}
        <p id="fd-shim-err" className="fd-shim-demo-err" role="alert">{touched && !valid && !done ? "Enter a valid work email to join." : ""}</p>
        <p className="fd-shim-demo-proof">
          <span className="fd-shim-demo-faces" aria-hidden="true"><i>A</i><i>M</i><i>J</i><i>L</i></span>
          12,408 researchers from Broad, EMBL and ETH Zürich already waiting
        </p>

        <div className="fd-shim-demo-sizes" aria-label="Sizes">
          <ShimmerButton size="sm">Request access</ShimmerButton>
          <ShimmerButton size="md" iconRight={arrow}>Read the docs</ShimmerButton>
        </div>
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-shim-demo,.fd-shim-demo *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-shim-demo,.fd-shim-demo *)::before,:where(.fd-shim-demo,.fd-shim-demo *)::after{box-sizing:border-box}
:where(.fd-shim-demo svg){display:block;flex-shrink:0}
:where(.fd-shim-demo button,.fd-shim-demo input){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;outline:0}
.fd-shim-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:ui-sans-serif,-apple-system,"SF Pro Display","Inter",sans-serif;
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-dur-2:240ms;--fd-dur-4:700ms;
  --d-bg:#F7F7F9;--d-ink:#0B0B0F;--d-mut:#5C5C68;--d-line:rgba(11,11,15,.1);--d-field:#fff;--d-grid:rgba(11,11,15,.05);--d-chip:#fff;
  position:relative;min-height:100vh;overflow:hidden;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.45 var(--d-font);-webkit-font-smoothing:antialiased;transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-shim-demo[data-fd-theme="dark"]{--d-bg:#09090C;--d-ink:#F5F5F7;--d-mut:#9A9AA6;--d-line:rgba(255,255,255,.1);--d-field:#131318;--d-grid:rgba(255,255,255,.045);--d-chip:#131318}
.fd-shim-demo::before{content:"";position:absolute;inset:0;pointer-events:none;
  background-image:linear-gradient(var(--d-grid) 1px,transparent 1px),linear-gradient(90deg,var(--d-grid) 1px,transparent 1px);background-size:56px 56px;
  -webkit-mask-image:radial-gradient(60% 60% at 50% 38%,#000 0%,transparent 75%);mask-image:radial-gradient(60% 60% at 50% 38%,#000 0%,transparent 75%)}
.fd-shim-demo-bar{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;height:64px;padding:0 24px;max-width:1120px;margin:0 auto}
.fd-shim-demo-brand{display:flex;align-items:center;gap:10px;font:600 17px/1 var(--d-font);letter-spacing:-.01em}
.fd-shim-demo-mark{width:18px;height:18px;border-radius:50%;background:var(--d-ink);box-shadow:0 0 0 4px var(--d-line)}
.fd-shim-demo-nav{display:flex;gap:28px;font:400 15px/1 var(--d-font);color:var(--d-mut)}
.fd-shim-demo-nav a{padding:8px 0;transition:color var(--fd-dur-2) var(--fd-ease-out)}
.fd-shim-demo-nav a:hover{color:var(--d-ink)}
.fd-shim-demo-nav a:focus-visible,.fd-shim-demo-theme:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px;border-radius:6px}
.fd-shim-demo-theme{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;cursor:pointer;color:var(--d-mut);transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-shim-demo-theme:hover{background:var(--d-line);color:var(--d-ink)}
.fd-shim-demo-theme svg{width:18px;height:18px}
.fd-shim-demo-hero{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:clamp(56px,10vh,112px) 24px 64px;max-width:760px;margin:0 auto}
.fd-shim-demo-pill{display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 12px;border-radius:9999px;background:var(--d-chip);box-shadow:0 0 0 1px var(--d-line);font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-shim-demo-dot{width:6px;height:6px;border-radius:50%;background:#30D158;box-shadow:0 0 0 3px rgba(48,209,88,.2)}
.fd-shim-demo-h1{margin-top:24px;font:600 clamp(36px,6.4vw,64px)/1.04 var(--d-disp);letter-spacing:-.04em}
.fd-shim-demo-sub{margin-top:20px;max-width:540px;font:400 17px/1.5 var(--d-font);letter-spacing:-.01em;color:var(--d-mut)}
.fd-shim-demo-form{display:flex;gap:8px;margin-top:36px;width:100%;max-width:520px;align-items:center}
.fd-shim-demo-field{flex:1;min-width:0}
.fd-shim-demo-field input{width:100%;height:52px;padding:0 20px;border-radius:9999px;background:var(--d-field);color:var(--d-ink);font:400 15px/1 var(--d-font);box-shadow:0 0 0 1px var(--d-line),0 1px 2px rgba(0,0,0,.06) inset;transition:box-shadow var(--fd-dur-2) var(--fd-ease-out)}
.fd-shim-demo-field input::placeholder{color:var(--d-mut);opacity:.8}
.fd-shim-demo-field input[aria-invalid="true"]{box-shadow:0 0 0 1.5px #FF6A60}
.fd-shim-demo-field input:focus-visible{box-shadow:0 0 0 2px rgba(10,132,255,.7)}
.fd-shim-demo-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.fd-shim-demo-done{display:flex;align-items:center;gap:12px;margin-top:36px;height:52px;padding:0 24px 0 12px;border-radius:9999px;background:var(--d-field);box-shadow:0 0 0 1px var(--d-line);font:400 15px/1 var(--d-font);animation:fd-shim-in 420ms var(--fd-ease-out)}
.fd-shim-demo-done b{font-weight:600;font-variant-numeric:tabular-nums}
.fd-shim-demo-done-ic{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#30D158;color:#04210E}
.fd-shim-demo-done-ic svg{width:16px;height:16px}
.fd-shim-demo-err{height:20px;margin-top:10px;font:400 13px/20px var(--d-font);color:#FF6A60}
.fd-shim-demo-proof{display:flex;align-items:center;gap:12px;margin-top:12px;font:400 13px/1.3 var(--d-font);color:var(--d-mut);text-align:left}
.fd-shim-demo-faces{display:flex}
.fd-shim-demo-faces i{display:grid;place-items:center;width:24px;height:24px;margin-left:-6px;border-radius:50%;background:var(--d-field);box-shadow:0 0 0 2px var(--d-bg),0 0 0 3px var(--d-line);font:600 9px/1 var(--d-font);font-style:normal;color:var(--d-mut)}
.fd-shim-demo-faces i:first-child{margin-left:0}
.fd-shim-demo-faces i:nth-child(2){background:#3A3A46;color:#fff}.fd-shim-demo-faces i:nth-child(3){background:#0A84FF;color:#fff}.fd-shim-demo-faces i:nth-child(4){background:#E8E8EC;color:#0B0B0F}
.fd-shim-demo-sizes{display:flex;align-items:center;gap:16px;margin-top:64px;padding-top:32px;border-top:1px solid var(--d-line);width:100%;justify-content:center}
@keyframes fd-shim-in{from{opacity:0;transform:translateY(8px) scale(.98)}}
@media (max-width:640px){.fd-shim-demo-nav{display:none}.fd-shim-demo-bar{padding:0 16px}.fd-shim-demo-hero{padding-inline:16px}.fd-shim-demo-form{flex-direction:column;align-items:stretch}.fd-shim-demo-form .fd-shim{width:100%}.fd-shim-demo-sizes{flex-wrap:wrap}.fd-shim-demo-proof{max-width:300px}}
@media (prefers-reduced-motion:reduce){.fd-shim-demo-done{animation:none}}
`;
