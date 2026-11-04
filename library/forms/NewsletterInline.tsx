/**
 * NewsletterInline, a single-line email capture with inline validation,
 * a loading state inside the button and a success morph (the field turns into
 * a confirmation with a drawn check, with an undo link).
 *
 * Props: onSubmit(email) (return a Promise; throw Error("message") to show a
 * server error such as "already subscribed"), placeholder, cta, successTitle,
 * successBody, size ("md" | "lg"), theme.
 *
 * Browser support: all evergreen browsers.
 * Accessibility: <form> with a labelled email input (visually hidden label),
 * aria-invalid + aria-describedby, errors in role="alert", the success message
 * is a polite live region and receives focus management through the "Use a
 * different email" button. Validation runs on blur (if non-empty) and submit;
 * once an error is shown it clears as soon as the value becomes valid.
 * Reduced motion: no shake, the morph is an opacity fade.
 */
import { useEffect, useId, useRef, useState } from "react";

export interface NewsletterInlineProps {
  onSubmit?: (email: string) => void | Promise<unknown>;
  placeholder?: string;
  cta?: string;
  successTitle?: string;
  successBody?: (email: string) => string;
  size?: "md" | "lg";
  theme?: "light" | "dark";
  className?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function NewsletterInline({
  onSubmit,
  placeholder = "Your email address",
  cta = "Subscribe",
  successTitle = "You’re on the list",
  successBody = (e) => `We sent a confirmation link to ${e}.`,
  size = "lg",
  theme,
  className,
}: NewsletterInlineProps) {
  const uid = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [shake, setShake] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const check = (v: string) => (!v.trim() ? "Add your email to subscribe" : EMAIL.test(v.trim()) ? undefined : "That doesn’t look like an email. Try name@domain.com");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase !== "idle") return;
    const err = check(email);
    if (err) {
      setError(err);
      setShake((s) => s + 1);
      input.current?.focus();
      return;
    }
    setError(undefined);
    setPhase("loading");
    try {
      await onSubmit?.(email.trim());
      await new Promise((r) => window.setTimeout(r, 900));
      if (alive.current) setPhase("done");
    } catch (ex) {
      if (!alive.current) return;
      setPhase("idle");
      setError(ex instanceof Error ? ex.message : "Something went wrong. Please try again.");
      setShake((s) => s + 1);
      input.current?.focus();
    }
  };

  return (
    <div className={`fd-nl${className ? " " + className : ""}`} data-size={size} data-phase={phase} data-bad={error ? "" : undefined} data-fd-theme={theme}>
      <style>{css}</style>
      <div key={shake} className="fd-nl-box" data-shake={shake && error ? "" : undefined}>
        <form className="fd-nl-form" onSubmit={submit} noValidate aria-hidden={phase === "done"} inert={phase === "done"}>
          <label htmlFor={`${uid}-e`} className="fd-nl-sr">Email address</label>
          <svg className="fd-nl-mail" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3.5 7.5l8.5 6 8.5-6" /></svg>
          <input
            ref={input}
            id={`${uid}-e`}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={placeholder}
            value={email}
            disabled={phase === "loading"}
            aria-invalid={!!error}
            aria-describedby={`${uid}-m`}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error && !check(e.target.value)) setError(undefined);
            }}
            onBlur={() => email && setError(check(email))}
          />
          <button type="submit" className="fd-nl-btn" aria-busy={phase === "loading"}>
            <span>{cta}</span>
            <svg className="fd-nl-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="2.5" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
          </button>
        </form>

        <div className="fd-nl-done" role="status" aria-live="polite">
          {phase === "done" && (
            <>
              <span className="fd-nl-badge" aria-hidden="true"><svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
              <span className="fd-nl-dtxt"><b>{successTitle}</b><span>{successBody(email.trim())}</span></span>
              <button type="button" className="fd-nl-undo" onClick={() => { setPhase("idle"); setEmail(""); requestAnimationFrame(() => input.current?.focus()); }}>Use a different email</button>
            </>
          )}
        </div>
      </div>
      <p id={`${uid}-m`} className="fd-nl-msg" role={error ? "alert" : undefined} data-err={error ? "" : undefined}>{error}</p>
    </div>
  );
}

const css = `
:where(.fd-nl,.fd-nl *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-nl,.fd-nl *)::before,:where(.fd-nl,.fd-nl *)::after{box-sizing:border-box}
:where(.fd-nl svg){display:block;flex-shrink:0}
:where(.fd-nl button,.fd-nl input){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;outline:0}
.fd-nl{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --n-bg:#fff;--n-fg:#1A1410;--n-mut:#7A6E64;--n-line:rgba(26,20,16,.16);--n-accent:#1A1410;--n-on:#fff;--n-err:#C2271B;--n-ok:#1F7A45;--n-okbg:#E8F4EC;--n-ring:rgba(194,98,28,.55);
  width:100%;max-width:520px;
  font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;color:var(--n-fg);
}
[data-fd-theme="dark"] .fd-nl,.fd-nl[data-fd-theme="dark"]{--n-bg:#241C16;--n-fg:#F6EEE6;--n-mut:#A89A8C;--n-line:rgba(246,238,230,.16);--n-accent:#F6EEE6;--n-on:#1A1410;--n-err:#FF8A7A;--n-ok:#7BE0A4;--n-okbg:#16301F;--n-ring:rgba(255,150,70,.6)}
.fd-nl[data-size="md"]{--n-h:48px}.fd-nl[data-size="lg"]{--n-h:60px}
.fd-nl-box{position:relative;display:grid;height:var(--n-h);border-radius:9999px;background:var(--n-bg);box-shadow:0 0 0 1px var(--n-line),0 1px 2px rgba(26,20,16,.05),0 12px 24px -16px rgba(26,20,16,.25);
  transition:box-shadow var(--fd-dur-2) var(--fd-ease-out),background-color var(--fd-dur-3) var(--fd-ease-out)}
.fd-nl-box:focus-within{box-shadow:0 0 0 1.5px var(--n-accent),0 0 0 5px var(--n-ring)}
.fd-nl[data-bad] .fd-nl-box{box-shadow:0 0 0 1.5px var(--n-err)}
.fd-nl[data-bad] .fd-nl-box:focus-within{box-shadow:0 0 0 1.5px var(--n-err),0 0 0 5px color-mix(in srgb,var(--n-err) 22%,transparent)}
.fd-nl[data-phase="done"] .fd-nl-box{background:var(--n-okbg);box-shadow:0 0 0 1px color-mix(in srgb,var(--n-ok) 40%,transparent)}
.fd-nl-box[data-shake]{animation:fd-nl-shake 440ms cubic-bezier(.36,.07,.19,.97)}
.fd-nl-form,.fd-nl-done{grid-area:1/1;display:flex;align-items:center;min-width:0;transition:opacity var(--fd-dur-3) var(--fd-ease-in-out),transform var(--fd-dur-3) var(--fd-ease-out)}
.fd-nl-form{gap:0;padding:0 calc((var(--n-h) - 44px) / 2) 0 22px}
.fd-nl[data-size="md"] .fd-nl-form{padding-right:4px}
.fd-nl[data-phase="done"] .fd-nl-form{opacity:0;transform:translateY(-10px) scale(.98);pointer-events:none}
.fd-nl-mail{color:var(--n-mut);margin-right:12px}
.fd-nl-form input{flex:1;min-width:0;height:100%;color:var(--n-fg);font-family:inherit;font-size:16px;line-height:1.2;letter-spacing:inherit;caret-color:var(--n-fg);text-overflow:ellipsis}
.fd-nl-form input::placeholder{color:var(--n-mut);opacity:.85}
.fd-nl-form input:disabled{opacity:.6}
.fd-nl-btn{position:relative;display:grid;place-items:center;flex:none;height:calc(var(--n-h) - 16px);padding:0 22px;border-radius:9999px;cursor:pointer;overflow:hidden;
  background:var(--n-accent);color:var(--n-on);font-family:inherit;font-size:15px;font-weight:600;line-height:1;letter-spacing:-.005em;
  transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring),filter var(--fd-dur-1)}
.fd-nl[data-size="lg"] .fd-nl-btn{min-width:116px}
@media (hover:hover){.fd-nl-btn:hover{filter:brightness(1.18)}[data-fd-theme="dark"] .fd-nl-btn:hover,.fd-nl[data-fd-theme="dark"] .fd-nl-btn:hover{filter:brightness(.92)}}
.fd-nl-btn:active{transform:scale(.95);transition:transform var(--fd-dur-1) var(--fd-ease-out)}
.fd-nl-btn:focus-visible{outline:2px solid var(--n-fg);outline-offset:2px}
.fd-nl-btn>*{grid-area:1/1;transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-ease-out)}
.fd-nl-spin{opacity:0;transform:scale(.6);animation:fd-nl-rot .8s linear infinite}
.fd-nl[data-phase="loading"] .fd-nl-btn>span{opacity:0;transform:translateY(-10px)}
.fd-nl[data-phase="loading"] .fd-nl-spin{opacity:1;transform:none}
.fd-nl-done{gap:14px;padding:0 20px 0 12px;opacity:0;transform:translateY(10px) scale(.98);pointer-events:none}
.fd-nl[data-phase="done"] .fd-nl-done{opacity:1;transform:none;pointer-events:auto;transition-delay:80ms}
.fd-nl-badge{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:50%;background:var(--n-ok);color:var(--n-okbg);animation:fd-nl-pop 560ms var(--fd-spring)}
.fd-nl-badge path{stroke-dasharray:24;stroke-dashoffset:24;animation:fd-nl-draw 420ms var(--fd-ease-out) 160ms forwards}
.fd-nl-dtxt{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;font-size:13px;line-height:1.25;color:var(--n-mut)}
.fd-nl-dtxt b{font-size:15px;font-weight:600;color:var(--n-fg)}
.fd-nl-dtxt span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fd-nl-undo{flex:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:500;line-height:1;color:var(--n-ok);padding:8px 6px;border-radius:8px;text-decoration:underline;text-underline-offset:3px}
.fd-nl-undo:focus-visible{outline:2px solid var(--n-ok);outline-offset:1px}
.fd-nl-msg{min-height:0;max-height:0;overflow:hidden;padding:0 22px;font-size:13px;line-height:1.35;color:var(--n-err);opacity:0;transform:translateY(-4px);transition:max-height var(--fd-dur-3) var(--fd-ease-out),opacity var(--fd-dur-2),transform var(--fd-dur-2) var(--fd-ease-out),padding var(--fd-dur-2)}
.fd-nl-msg[data-err]{max-height:48px;opacity:1;transform:none;padding-top:10px}
.fd-nl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes fd-nl-rot{to{transform:rotate(360deg)}}
@keyframes fd-nl-draw{to{stroke-dashoffset:0}}
@keyframes fd-nl-pop{from{transform:scale(.4);opacity:0}}
@keyframes fd-nl-shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-6px)}40%,60%{transform:translateX(6px)}}
@media (max-width:480px){.fd-nl-mail{display:none}.fd-nl-form{padding-left:18px}.fd-nl-undo{display:none}.fd-nl[data-size="lg"] .fd-nl-btn{min-width:0;padding:0 18px}.fd-nl-done{padding-right:12px}}
@media (prefers-reduced-motion:reduce){.fd-nl-box[data-shake]{animation:none}.fd-nl-form,.fd-nl-done{transition:opacity 100ms linear;transform:none!important}.fd-nl-badge{animation:none}.fd-nl-badge path{animation:none;stroke-dashoffset:0}.fd-nl-spin{animation:none}.fd-nl-btn,.fd-nl-btn:active{transition:none;transform:none}}
@media (prefers-contrast:more){.fd-nl-box{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

export function Demo() {
  return (
    <div className="fd-nld">
      <style>{demoCss}</style>
      <div className="fd-nld-box">
        <NewsletterInline
          theme="light"
          cta="Subscribe"
          placeholder="you@email.com"
          onSubmit={() => new Promise<void>((res) => window.setTimeout(res, 700))}
        />
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-nld,.fd-nld *,.fd-nld *::before,.fd-nld *::after{box-sizing:border-box}
.fd-nld{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;color:#1d1d1f;font:400 15px/1.4 ${F};letter-spacing:normal;background:#f1f1f2}
.fd-nld-box{width:100%;max-width:480px;margin:0;padding:0}
`;
