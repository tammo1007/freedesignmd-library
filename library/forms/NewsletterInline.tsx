/**
 * NewsletterInline — a single-line email capture with inline validation,
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  return (
    <div className="fd-nl-demo" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-nl-demo-bar">
        <span className="fd-nl-demo-brand">Marlow<i>&amp;</i>Finch</span>
        <nav aria-label="Primary"><a href="#shop">Shop</a><a href="#subscriptions">Subscriptions</a><a href="#brew">Brew guides</a><a href="#roastery">Roastery</a></nav>
        <button type="button" className="fd-nl-demo-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      </header>

      <main className="fd-nl-demo-main">
        <section className="fd-nl-demo-copy" aria-labelledby="fd-nl-h">
          <p className="fd-nl-demo-eyebrow">The Roast Letter · every other Thursday</p>
          <h1 id="fd-nl-h">First pick of every small-lot roast.</h1>
          <p className="fd-nl-demo-sub">Tasting notes, brew recipes and early access to limited harvests from Huila, Yirgacheffe and Kerinci — straight from our roastery in Portland.</p>
          <NewsletterInline
            theme={theme}
            cta="Join free"
            placeholder="you@email.com"
            onSubmit={(email) => new Promise<void>((res, rej) => window.setTimeout(() => (email.toLowerCase() === "taken@example.com" ? rej(new Error("That address is already subscribed. Check your inbox for the latest letter.")) : res()), 700))}
            successTitle="Welcome to the Roast Letter"
            successBody={() => "Confirm in your inbox to claim 10% off."}
          />
          <ul className="fd-nl-demo-perks">
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>10% off your first bag</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Early access to micro-lots</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Unsubscribe in one click</li>
          </ul>
          <p className="fd-nl-demo-fine">18,400 readers · No spam. Read our <a href="#privacy">privacy policy</a>.</p>
        </section>

        <div className="fd-nl-demo-art" aria-hidden="true">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 360 440" width="100%" height="100%">
            <ellipse cx="180" cy="410" rx="130" ry="14" fill="rgba(26,20,16,.16)" />
            <path d="M82 96 Q180 70 278 96 L296 400 Q180 424 64 400 Z" fill="#C9A06B" />
            <path d="M82 96 Q180 70 278 96 L278 120 Q180 96 82 120 Z" fill="#B58B57" />
            <path d="M82 96 Q180 70 278 96" fill="none" stroke="#A67B48" strokeWidth="3" />
            <rect x="106" y="190" width="148" height="164" rx="10" fill="#FBF4E8" />
            <circle cx="180" cy="236" r="26" fill="#1A1410" />
            <ellipse cx="180" cy="236" rx="9" ry="22" fill="#FBF4E8" transform="rotate(24 180 236)" />
            <rect x="126" y="282" width="108" height="9" rx="4" fill="#1A1410" />
            <rect x="140" y="302" width="80" height="6" rx="3" fill="#1A1410" opacity=".5" />
            <rect x="148" y="318" width="64" height="6" rx="3" fill="#1A1410" opacity=".3" />
            <path d="M82 96 L74 70 Q180 54 286 70 L278 96" fill="#9C713F" />
          </svg>
          <span className="fd-nl-demo-tag">Huila Pink Bourbon<small>Notes of plum, jasmine, brown sugar</small></span>
        </div>
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-nl-demo,.fd-nl-demo *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-nl-demo,.fd-nl-demo *)::before,:where(.fd-nl-demo,.fd-nl-demo *)::after{box-sizing:border-box}
:where(.fd-nl-demo svg){display:block;flex-shrink:0}
:where(.fd-nl-demo button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-nl-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:ui-sans-serif,-apple-system,"SF Pro Display","Inter",sans-serif;
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-dur-2:240ms;
  --d-bg:#F4EBDD;--d-ink:#1A1410;--d-mut:#6F6358;--d-line:rgba(26,20,16,.12);--d-art:#E8D6BA;--d-accent:#B8541C;
  min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.45 var(--d-font);-webkit-font-smoothing:antialiased;transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-nl-demo[data-fd-theme="dark"]{--d-bg:#17110D;--d-ink:#F6EEE6;--d-mut:#A89A8C;--d-line:rgba(246,238,230,.12);--d-art:#2A1F17;--d-accent:#FF9A55}
.fd-nl-demo-bar{display:flex;align-items:center;gap:32px;height:68px;padding:0 clamp(16px,4vw,48px)}
.fd-nl-demo-brand{margin-right:auto;font:700 20px/1 var(--d-disp);letter-spacing:-.04em}.fd-nl-demo-brand i{font-style:normal;color:var(--d-accent);margin:0 2px}
.fd-nl-demo-bar nav{display:flex;gap:28px;font:500 14px/1 var(--d-font);color:var(--d-mut)}.fd-nl-demo-bar nav a{padding:8px 0}.fd-nl-demo-bar nav a:hover{color:var(--d-ink)}
.fd-nl-demo-bar a:focus-visible,.fd-nl-demo-theme:focus-visible,.fd-nl-demo-fine a:focus-visible{outline:2px solid var(--d-accent);outline-offset:2px;border-radius:4px}
.fd-nl-demo-theme{cursor:pointer;height:32px;padding:0 14px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 13px/1 var(--d-font);color:var(--d-mut)}.fd-nl-demo-theme:hover{color:var(--d-ink)}
.fd-nl-demo-main{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(24px,5vw,72px);align-items:center;max-width:1160px;margin:0 auto;padding:clamp(24px,6vh,72px) clamp(16px,4vw,48px) 64px}
.fd-nl-demo-eyebrow{font:600 12px/1 var(--d-font);letter-spacing:.08em;text-transform:uppercase;color:var(--d-accent)}
.fd-nl-demo-copy h1{margin:20px 0 0;font:600 clamp(36px,5.2vw,64px)/1.02 var(--d-disp);letter-spacing:-.04em;max-width:11em}
.fd-nl-demo-sub{margin:20px 0 32px;max-width:30em;font:400 17px/1.55 var(--d-font);letter-spacing:-.01em;color:var(--d-mut)}
.fd-nl-demo-perks{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:24px;font:500 14px/1 var(--d-font)}
.fd-nl-demo-perks li{display:flex;align-items:center;gap:8px}.fd-nl-demo-perks svg{color:var(--d-accent)}
.fd-nl-demo-fine{margin-top:20px;font:400 13px/1.4 var(--d-font);color:var(--d-mut)}.fd-nl-demo-fine a{text-decoration:underline;text-underline-offset:3px}
.fd-nl-demo-art{position:relative;aspect-ratio:1/1.15;max-height:560px;border-radius:32px;background:var(--d-art);padding:8% 12% 4%;box-shadow:0 0 0 1px var(--d-line)}
.fd-nl-demo-tag{position:absolute;left:20px;bottom:20px;display:flex;flex-direction:column;gap:4px;padding:12px 16px;border-radius:14px;background:var(--d-bg);box-shadow:0 0 0 1px var(--d-line),0 8px 24px -12px rgba(0,0,0,.3);font:600 14px/1.2 var(--d-font)}
.fd-nl-demo-tag small{font:400 12px/1.3 var(--d-font);color:var(--d-mut)}
@media (max-width:860px){.fd-nl-demo-main{grid-template-columns:1fr}.fd-nl-demo-bar nav{display:none}.fd-nl-demo-art{max-height:380px;aspect-ratio:auto;height:340px;padding:6% 24% 3%}}
`;
