/**
 * ButtonCore, the full button system.
 *
 * Variants: primary · secondary · tertiary · ghost · destructive
 * Sizes:    sm (32) · md (40) · lg (48)
 * Icons:    iconLeft · iconRight · icon-only (pass `icon` + `aria-label`)
 * States:   hover · press (scale .96 + spring release) · focus-visible ·
 *           disabled · loading → success check → idle
 *
 * Props: variant, size, shape ("pill" | "soft"), iconLeft, iconRight, icon,
 *   loading (controlled), loadingLabel, successLabel, successDuration (ms),
 *   theme ("light" | "dark", otherwise inherits from the nearest
 *   [data-fd-theme] ancestor). `onClick` may return a Promise: the button then
 *   morphs label → spinner → check → label by itself.
 * Wrap many buttons in <ButtonScope> to render the stylesheet only once.
 *
 * Browser support: all evergreen browsers. Needs React 18+ (SSR safe).
 * Accessibility: native <button>; aria-busy while loading, a polite live
 * region announces the success label; focus ring is never removed; while busy
 * the button stays focusable (aria-disabled) so focus is not lost.
 * Reduced motion: no scale/spring, spinner becomes a gentle pulse.
 */
import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";
type Phase = "idle" | "loading" | "success";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: "pill" | "soft";
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Icon-only button. Always pair with aria-label. */
  icon?: ReactNode;
  loading?: boolean;
  loadingLabel?: ReactNode;
  successLabel?: ReactNode;
  successDuration?: number;
  theme?: "light" | "dark";
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
}

const StyleCtx = createContext(false);

/** Renders the stylesheet once for every Button inside it. */
export function ButtonScope({ children }: { children: ReactNode }) {
  return (
    <StyleCtx.Provider value>
      <style>{css}</style>
      {children}
    </StyleCtx.Provider>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    shape = "pill",
    iconLeft,
    iconRight,
    icon,
    loading,
    loadingLabel,
    successLabel,
    successDuration = 1600,
    theme,
    onClick,
    children,
    className,
    type = "button",
    ...rest
  },
  ref,
) {
  const scoped = useContext(StyleCtx);
  const [phase, setPhase] = useState<Phase>("idle");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const shown: Phase = loading ? "loading" : phase;
  const busy = shown !== "idle";

  const handle = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      if (busy || rest.disabled) {
        e.preventDefault();
        return;
      }
      const out = onClick?.(e);
      if (out && typeof (out as Promise<unknown>).then === "function") {
        setPhase("loading");
        try {
          await out;
          if (!alive.current) return;
          setPhase("success");
          window.setTimeout(() => alive.current && setPhase("idle"), successDuration);
        } catch {
          if (alive.current) setPhase("idle");
        }
      }
    },
    [busy, onClick, rest.disabled, successDuration],
  );

  return (
    <>
      {!scoped && <style>{css}</style>}
      <button
        ref={ref}
        type={type}
        className={`fd-btn${className ? " " + className : ""}`}
        data-variant={variant}
        data-size={size}
        data-shape={shape}
        data-phase={shown}
        data-icon-only={icon ? "" : undefined}
        data-fd-theme={theme}
        aria-busy={shown === "loading" || undefined}
        aria-disabled={busy || undefined}
        onClick={handle}
        {...rest}
      >
        <span className="fd-btn-layer" data-layer="idle">
          {icon ? (
            <span className="fd-btn-icon">{icon}</span>
          ) : (
            <>
              {iconLeft && <span className="fd-btn-icon">{iconLeft}</span>}
              <span className="fd-btn-label">{children}</span>
              {iconRight && <span className="fd-btn-icon">{iconRight}</span>}
            </>
          )}
        </span>
        <span className="fd-btn-layer" data-layer="loading" aria-hidden="true">
          <Spinner />
          {loadingLabel && !icon && <span className="fd-btn-label">{loadingLabel}</span>}
        </span>
        <span className="fd-btn-layer" data-layer="success" aria-hidden="true">
          <Check />
          {successLabel && !icon && <span className="fd-btn-label">{successLabel}</span>}
        </span>
        <span className="fd-btn-sr" role="status" aria-live="polite">
          {shown === "success" ? (typeof successLabel === "string" ? successLabel : "Done") : ""}
        </span>
      </button>
    </>
  );
});

function Spinner() {
  return (
    <svg className="fd-btn-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="fd-btn-check" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ───────────────────────────── styles ───────────────────────────── */

const css = `
:where(.fd-btn,.fd-btn *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-btn,.fd-btn *)::before,:where(.fd-btn,.fd-btn *)::after{box-sizing:border-box}
:where(.fd-btn svg){display:block;flex-shrink:0}
.fd-btn{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --b-accent:#007AFF;--b-accent-hover:#1A8CFF;--b-accent-soft:rgba(0,122,255,.1);--b-accent-soft-hover:rgba(0,122,255,.16);--b-on-accent:#fff;
  --b-danger:#E5334B;--b-danger-hover:#EF4A60;--b-success:#1FA45B;
  --b-surface:#fff;--b-surface-hover:#F7F7F9;--b-border:rgba(11,11,15,.12);--b-ink:#0B0B0F;--b-ghost-hover:rgba(11,11,15,.06);
  --b-shadow:0 1px 2px rgba(11,11,15,.06),0 1px 1px rgba(11,11,15,.04);
  --b-inset:0 1px 0 rgba(255,255,255,.22) inset;
  --b-ring:rgba(0,122,255,.7);
  position:relative;display:inline-grid;place-items:center;flex-shrink:0;
  appearance:none;-webkit-appearance:none;border:0;outline:0;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;
  font:500 15px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;
  height:var(--b-h);min-width:var(--b-h);padding:0 var(--b-px);border-radius:var(--b-r);
  background:var(--b-bg);color:var(--b-fg);box-shadow:var(--b-sh);
  transform:scale(1);
  transition:transform var(--fd-dur-3) var(--fd-spring),background-color var(--fd-dur-1) var(--fd-ease-out),box-shadow var(--fd-dur-2) var(--fd-ease-out),color var(--fd-dur-2) var(--fd-ease-out);
  white-space:nowrap;
}
[data-fd-theme="dark"] .fd-btn,.fd-btn[data-fd-theme="dark"]{
  --b-accent:#0A84FF;--b-accent-hover:#3B9CFF;--b-accent-soft:rgba(10,132,255,.16);--b-accent-soft-hover:rgba(10,132,255,.24);
  --b-danger:#FF453A;--b-danger-hover:#FF6A60;--b-success:#30D158;
  --b-surface:#1C1C22;--b-surface-hover:#25252C;--b-border:rgba(255,255,255,.1);--b-ink:#F5F5F7;--b-ghost-hover:rgba(255,255,255,.08);
  --b-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 1px 2px rgba(0,0,0,.3);
  --b-inset:0 1px 0 rgba(255,255,255,.28) inset;--b-ring:rgba(10,132,255,.8);
}
.fd-btn[data-fd-theme="light"]{--b-accent:#007AFF;--b-surface:#fff;--b-border:rgba(11,11,15,.12);--b-ink:#0B0B0F}
.fd-btn[data-size="sm"]{--b-h:32px;--b-px:12px;--b-gap:6px;--b-fs:13px;--b-ic:16px}
.fd-btn[data-size="md"]{--b-h:40px;--b-px:16px;--b-gap:8px;--b-fs:15px;--b-ic:18px}
.fd-btn[data-size="lg"]{--b-h:48px;--b-px:22px;--b-gap:10px;--b-fs:17px;--b-ic:20px;letter-spacing:-.01em}
.fd-btn[data-size="sm"]{font-size:13px}.fd-btn[data-size="md"]{font-size:15px}.fd-btn[data-size="lg"]{font-size:17px}
.fd-btn[data-shape="pill"]{--b-r:9999px}
.fd-btn[data-shape="soft"][data-size="sm"]{--b-r:8px}.fd-btn[data-shape="soft"][data-size="md"]{--b-r:10px}.fd-btn[data-shape="soft"][data-size="lg"]{--b-r:12px}
.fd-btn[data-icon-only]{padding:0}

.fd-btn[data-variant="primary"]{--b-bg:var(--b-accent);--b-fg:var(--b-on-accent);--b-sh:var(--b-inset),0 1px 2px rgba(0,40,120,.35),0 8px 18px -10px var(--b-accent)}
.fd-btn[data-variant="secondary"]{--b-bg:var(--b-surface);--b-fg:var(--b-ink);--b-sh:0 0 0 1px var(--b-border),var(--b-shadow)}
.fd-btn[data-variant="tertiary"]{--b-bg:var(--b-accent-soft);--b-fg:var(--b-accent);--b-sh:none}
.fd-btn[data-variant="ghost"]{--b-bg:transparent;--b-fg:var(--b-ink);--b-sh:none}
.fd-btn[data-variant="destructive"]{--b-bg:var(--b-danger);--b-fg:#fff;--b-sh:var(--b-inset),0 1px 2px rgba(120,0,20,.35),0 8px 18px -10px var(--b-danger)}

@media (hover:hover){
  .fd-btn[data-variant="primary"]:hover{--b-bg:var(--b-accent-hover)}
  .fd-btn[data-variant="secondary"]:hover{--b-bg:var(--b-surface-hover)}
  .fd-btn[data-variant="tertiary"]:hover{--b-bg:var(--b-accent-soft-hover)}
  .fd-btn[data-variant="ghost"]:hover{--b-bg:var(--b-ghost-hover)}
  .fd-btn[data-variant="destructive"]:hover{--b-bg:var(--b-danger-hover)}
}
.fd-btn:active{transform:scale(.96);transition:transform var(--fd-dur-1) var(--fd-ease-out),background-color var(--fd-dur-1) var(--fd-ease-out)}
.fd-btn:focus-visible{outline:2px solid var(--b-ring);outline-offset:2px}
.fd-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.fd-btn:disabled:hover{--b-bg:var(--b-bg)}
.fd-btn[aria-disabled="true"]{cursor:default}
.fd-btn[data-phase="success"][data-variant="primary"],.fd-btn[data-phase="success"][data-variant="destructive"]{--b-bg:var(--b-success);--b-sh:var(--b-inset),0 1px 2px rgba(0,60,20,.35),0 8px 18px -10px var(--b-success)}
.fd-btn[data-phase="success"][data-variant="secondary"],.fd-btn[data-phase="success"][data-variant="tertiary"],.fd-btn[data-phase="success"][data-variant="ghost"]{--b-fg:var(--b-success)}

.fd-btn-layer{grid-area:1/1;display:inline-flex;align-items:center;justify-content:center;gap:var(--b-gap);
  transition:opacity var(--fd-dur-2) var(--fd-ease-in-out),transform var(--fd-dur-3) var(--fd-ease-out);}
.fd-btn-layer[data-layer="idle"]{opacity:1;transform:none}
.fd-btn-layer[data-layer="loading"],.fd-btn-layer[data-layer="success"]{opacity:0;transform:translateY(8px) scale(.85);pointer-events:none}
.fd-btn[data-phase="loading"] .fd-btn-layer[data-layer="idle"],.fd-btn[data-phase="success"] .fd-btn-layer[data-layer="idle"]{opacity:0;transform:translateY(-8px) scale(.9)}
.fd-btn[data-phase="loading"] .fd-btn-layer[data-layer="loading"],.fd-btn[data-phase="success"] .fd-btn-layer[data-layer="success"]{opacity:1;transform:none}
.fd-btn-label{display:block;line-height:1}
.fd-btn-icon{display:grid;place-items:center;width:var(--b-ic);height:var(--b-ic)}
.fd-btn-icon svg{width:100%;height:100%}
.fd-btn-spin,.fd-btn-check{width:var(--b-ic);height:var(--b-ic)}
.fd-btn-spin{animation:fd-btn-rot 800ms linear infinite}
.fd-btn-check path{stroke-dasharray:24;stroke-dashoffset:24}
.fd-btn[data-phase="success"] .fd-btn-check path{animation:fd-btn-draw 380ms var(--fd-ease-out) 120ms forwards}
.fd-btn-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes fd-btn-rot{to{transform:rotate(360deg)}}
@keyframes fd-btn-draw{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){
  .fd-btn,.fd-btn:active{transition:background-color var(--fd-dur-1) linear;transform:none}
  .fd-btn-layer{transition:opacity 100ms linear;transform:none!important}
  .fd-btn-spin{animation:fd-btn-pulse 1.4s ease-in-out infinite}
  .fd-btn[data-phase="success"] .fd-btn-check path{animation:none;stroke-dashoffset:0}
}
@keyframes fd-btn-pulse{50%{opacity:.35}}
@media (prefers-contrast:more){.fd-btn[data-variant="tertiary"],.fd-btn[data-variant="ghost"]{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

export function Demo() {
  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
  return (
    <div className="fd-btnd">
      <style>{demoCss}</style>
      <ButtonScope>
        <div className="fd-btnd-row">
          <Button size="lg" variant="primary" loadingLabel="Processing" successLabel="Done" onClick={() => wait(1600)}>
            Continue
          </Button>
          <Button size="lg" variant="secondary">Not now</Button>
        </div>
      </ButtonScope>
    </div>
  );
}

const demoCss = `
.fd-btnd,.fd-btnd *,.fd-btnd *::before,.fd-btnd *::after{box-sizing:border-box}
.fd-btnd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f4f4f4;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
.fd-btnd-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:16px;margin:0;padding:0}
`;
