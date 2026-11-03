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

const I = {
  lock: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
  ),
  arrow: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  plus: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
  ),
  trash: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
  ),
  share: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12M7 9l5-5 5 5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>
  ),
  card: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></svg>
  ),
  bank: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></svg>
  ),
  sun: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg>
  ),
  moon: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
  ),
};

const sizes: ButtonSize[] = ["sm", "md", "lg"];
const variants: ButtonVariant[] = ["primary", "secondary", "tertiary", "ghost", "destructive"];

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [method, setMethod] = useState<"card" | "bank">("card");
  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

  return (
    <div className="fd-btn-demo" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <ButtonScope>
        <header className="fd-btn-demo-bar">
          <div className="fd-btn-demo-brand">
            <span className="fd-btn-demo-logo" aria-hidden="true" />
            Halden Pay
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={theme === "light" ? I.moon : I.sun}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          />
        </header>

        <main className="fd-btn-demo-main">
          <section className="fd-btn-demo-card" aria-labelledby="fd-btn-pay-h">
            <p className="fd-btn-demo-eyebrow">Invoice INV-2041 · due 4 Nov</p>
            <h2 id="fd-btn-pay-h" className="fd-btn-demo-h">Pay Northwind Freight</h2>
            <p className="fd-btn-demo-amount">$2,480<span>.00</span></p>

            <dl className="fd-btn-demo-lines">
              <div><dt>Pallet storage · Oct</dt><dd>$1,920.00</dd></div>
              <div><dt>Cross-dock handling</dt><dd>$480.00</dd></div>
              <div><dt>Processing fee</dt><dd>$80.00</dd></div>
            </dl>

            <div className="fd-btn-demo-methods" role="radiogroup" aria-label="Payment method">
              {([
                ["card", "Visa ending 4242", "Expires 08/28", I.card],
                ["bank", "Chase checking ···· 0917", "ACH · free, 1–2 days", I.bank],
              ] as const).map(([id, t, s, ic]) => (
                <button key={id} type="button" role="radio" aria-checked={method === id} className="fd-btn-demo-method" onClick={() => setMethod(id)}>
                  <span className="fd-btn-demo-method-ic">{ic}</span>
                  <span className="fd-btn-demo-method-t">{t}<small>{s}</small></span>
                  <span className="fd-btn-demo-radio" aria-hidden="true" />
                </button>
              ))}
            </div>

            <Button
              size="lg"
              variant="primary"
              iconLeft={I.lock}
              loadingLabel="Processing"
              successLabel="Payment sent"
              onClick={() => wait(1800)}
              style={{ width: "100%" }}
            >
              Pay $2,480.00
            </Button>
            <div className="fd-btn-demo-row">
              <Button variant="secondary" size="md" style={{ flex: 1 }}>Save for later</Button>
              <Button variant="ghost" size="md" style={{ flex: 1 }}>Cancel</Button>
            </div>
            <p className="fd-btn-demo-fine">Payments are encrypted. Funds settle in 1–2 business days.</p>
          </section>

          <section className="fd-btn-demo-card fd-btn-demo-spec" aria-labelledby="fd-btn-spec-h">
            <p className="fd-btn-demo-eyebrow">Button system</p>
            <h2 id="fd-btn-spec-h" className="fd-btn-demo-h">5 variants, 3 sizes</h2>

            <div className="fd-btn-demo-matrix">
              {variants.map((v) => (
                <div className="fd-btn-demo-mrow" key={v}>
                  <span className="fd-btn-demo-mlabel">{v}</span>
                  <div className="fd-btn-demo-mcells">
                    {sizes.map((s) => (
                      <Button key={s} variant={v} size={s}>
                        {v === "destructive" ? "Delete" : v === "primary" ? "Continue" : "Label"}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="fd-btn-demo-divider" />
            <div className="fd-btn-demo-mrow">
              <span className="fd-btn-demo-mlabel">icons</span>
              <div className="fd-btn-demo-mcells">
                <Button variant="secondary" iconLeft={I.plus}>New invoice</Button>
                <Button variant="primary" iconRight={I.arrow}>Next</Button>
                <Button variant="secondary" icon={I.share} aria-label="Share" />
                <Button variant="destructive" size="sm" icon={I.trash} aria-label="Delete" />
              </div>
            </div>
            <div className="fd-btn-demo-mrow">
              <span className="fd-btn-demo-mlabel">states</span>
              <div className="fd-btn-demo-mcells">
                <Button variant="primary" disabled>Disabled</Button>
                <Button variant="secondary" loading loadingLabel="Loading" />
                <Button variant="primary" shape="soft" onClick={() => wait(1200)} successLabel="Saved" loadingLabel="Saving">Save changes</Button>
              </div>
            </div>
          </section>
        </main>
      </ButtonScope>
    </div>
  );
}

const demoCss = `
:where(.fd-btn-demo,.fd-btn-demo *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-btn-demo,.fd-btn-demo *)::before,:where(.fd-btn-demo,.fd-btn-demo *)::after{box-sizing:border-box}
:where(.fd-btn-demo svg){display:block;flex-shrink:0}
:where(.fd-btn-demo button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-btn-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-bg:#F7F7F9;--d-card:#fff;--d-ink:#0B0B0F;--d-mut:#6B6B76;--d-line:rgba(11,11,15,.08);--d-soft:#F1F1F4;--d-accent:#007AFF;
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-dur-2:240ms;
  min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.45 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-btn-demo[data-fd-theme="dark"]{--d-bg:#0B0B0F;--d-card:#141418;--d-ink:#F5F5F7;--d-mut:#9A9AA6;--d-line:rgba(255,255,255,.08);--d-soft:#1C1C22;--d-accent:#0A84FF}
.fd-btn-demo-bar{display:flex;align-items:center;justify-content:space-between;height:56px;padding:0 24px;border-bottom:1px solid var(--d-line)}
.fd-btn-demo-brand{display:flex;align-items:center;gap:10px;font:600 15px/1 var(--d-font);letter-spacing:-.01em}
.fd-btn-demo-logo{width:20px;height:20px;border-radius:6px;background:var(--d-ink);position:relative}
.fd-btn-demo-logo::after{content:"";position:absolute;inset:6px;border-radius:2px;background:var(--d-bg)}
.fd-btn-demo-main{display:grid;grid-template-columns:minmax(0,420px) minmax(0,520px);gap:24px;justify-content:center;align-items:start;padding:48px 24px 64px}
.fd-btn-demo-card{display:flex;flex-direction:column;gap:16px;padding:28px;border-radius:24px;background:var(--d-card);
  box-shadow:0 0 0 1px var(--d-line),0 1px 2px rgba(0,0,0,.04),0 24px 48px -24px rgba(0,0,0,.18)}
.fd-btn-demo[data-fd-theme="dark"] .fd-btn-demo-card{box-shadow:0 0 0 1px var(--d-line),0 1px 0 rgba(255,255,255,.04) inset,0 24px 48px -24px rgba(0,0,0,.6)}
.fd-btn-demo-eyebrow{font:500 13px/1 var(--d-font);color:var(--d-mut);letter-spacing:0}
.fd-btn-demo-h{font:600 20px/1.2 var(--d-font);letter-spacing:-.01em}
.fd-btn-demo-amount{font:600 44px/1 ui-sans-serif,-apple-system,"SF Pro Display","Inter",sans-serif;letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin:4px 0 4px}
.fd-btn-demo-amount span{color:var(--d-mut)}
.fd-btn-demo-lines{display:flex;flex-direction:column;gap:12px;padding:16px 0;border-block:1px solid var(--d-line);font-size:15px}
.fd-btn-demo-lines div{display:flex;justify-content:space-between;gap:16px}
.fd-btn-demo-lines dt{color:var(--d-mut)}
.fd-btn-demo-lines dd{font-variant-numeric:tabular-nums}
.fd-btn-demo-methods{display:flex;flex-direction:column;gap:8px}
.fd-btn-demo-method{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-radius:14px;text-align:left;cursor:pointer;background:var(--d-card);
  box-shadow:0 0 0 1px var(--d-line);transition:box-shadow var(--fd-dur-2) var(--fd-ease-out),background-color var(--fd-dur-2) var(--fd-ease-out);font:inherit;color:inherit}
.fd-btn-demo-method:focus-visible{outline:2px solid color-mix(in srgb,var(--d-accent) 70%,transparent);outline-offset:2px}
.fd-btn-demo-method[aria-checked="true"]{box-shadow:0 0 0 1.5px var(--d-accent);background:color-mix(in srgb,var(--d-accent) 5%,var(--d-card))}
.fd-btn-demo-method-ic{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:var(--d-soft)}
.fd-btn-demo-method-ic svg{width:18px;height:18px}
.fd-btn-demo-method-t{display:flex;flex-direction:column;gap:2px;flex:1;font:500 15px/1.2 var(--d-font)}
.fd-btn-demo-method-t small{font:400 13px/1.2 var(--d-font);color:var(--d-mut)}
.fd-btn-demo-radio{width:18px;height:18px;border-radius:50%;box-shadow:0 0 0 1.5px var(--d-line) inset,0 0 0 1px var(--d-mut) inset;opacity:.6;transition:all var(--fd-dur-2) var(--fd-ease-out)}
.fd-btn-demo-method[aria-checked="true"] .fd-btn-demo-radio{opacity:1;box-shadow:0 0 0 5px var(--d-accent) inset}
.fd-btn-demo-row{display:flex;gap:8px}
.fd-btn-demo-fine{font:400 13px/1.4 var(--d-font);color:var(--d-mut);text-align:center}
.fd-btn-demo-matrix{display:flex;flex-direction:column;gap:16px}
.fd-btn-demo-mrow{display:grid;grid-template-columns:84px 1fr;align-items:center;gap:12px}
.fd-btn-demo-mlabel{font:500 12px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;color:var(--d-mut)}
.fd-btn-demo-mcells{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.fd-btn-demo-divider{height:1px;background:var(--d-line);margin:4px 0}
@media (max-width:900px){.fd-btn-demo-main{grid-template-columns:minmax(0,1fr);padding:24px 16px 48px}.fd-btn-demo-bar{padding:0 16px}}
@media (max-width:520px){.fd-btn-demo-card{padding:20px;border-radius:20px}.fd-btn-demo-mrow{grid-template-columns:1fr;gap:8px}}
@media (prefers-reduced-motion:reduce){.fd-btn-demo,.fd-btn-demo *{transition-duration:.01ms!important}}
`;
