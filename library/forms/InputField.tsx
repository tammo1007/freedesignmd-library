/**
 * InputField — text input with a floating label, helper / error / success
 * states, prefix + suffix adornments, character counter, clear button and a
 * password reveal toggle. Also supports `multiline` (textarea).
 *
 * Props: label, value / defaultValue / onChange, type, helper, error,
 * success (boolean or message), prefix, suffix, maxLength (shows 12 / 120),
 * clearable, multiline + rows, placeholder (shown once the label floats),
 * disabled, readOnly, size ("md" | "lg"), theme, plus native input props.
 * CSS vars: --fd-in-radius, --fd-in-accent.
 *
 * Browser support: all evergreen browsers (uses :has() only for the progressive
 * hover ring; everything else works without it).
 * Accessibility: real <label for>, aria-invalid, aria-describedby for helper /
 * error / counter, error text is announced (role="alert"), the password toggle
 * is a <button aria-pressed> with a label, the clear button is keyboard
 * reachable. Reduced motion: label moves without easing.
 */
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix" | "onChange" | "value" | "defaultValue">;

export interface InputFieldProps extends Base {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  helper?: ReactNode;
  error?: ReactNode;
  success?: boolean | string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  clearable?: boolean;
  multiline?: boolean;
  rows?: number;
  size?: "md" | "lg";
  theme?: "light" | "dark";
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  {
    label,
    value,
    defaultValue = "",
    onChange,
    type = "text",
    helper,
    error,
    success,
    prefix,
    suffix,
    maxLength,
    clearable,
    multiline,
    rows = 3,
    size = "md",
    theme,
    disabled,
    readOnly,
    placeholder,
    className,
    id,
    onFocus,
    onBlur,
    ...rest
  },
  fwd,
) {
  const uid = useId();
  const fid = id ?? `${uid}-f`;
  const el = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useImperativeHandle(fwd, () => el.current as HTMLInputElement);
  const [inner, setInner] = useState(defaultValue);
  const [focus, setFocus] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [autofilled, setAutofilled] = useState(false);
  const val = value ?? inner;
  const isPw = type === "password";
  const floated = focus || val.length > 0 || !!prefix || autofilled || (!!placeholder && false);
  const state = error ? "error" : success ? "success" : "idle";

  // browsers fill autofill values without firing change on some engines
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (el.current && el.current.value && !val) setAutofilled(true);
    }, 150);
    return () => window.clearTimeout(t);
  }, [val]);

  const set = useCallback(
    (v: string) => {
      if (value === undefined) setInner(v);
      onChange?.(v);
    },
    [onChange, value],
  );

  const hid = `${fid}-help`;
  const eid = `${fid}-err`;
  const cid = `${fid}-cnt`;
  const describedBy = [error ? eid : helper ? hid : null, maxLength ? cid : null].filter(Boolean).join(" ") || undefined;
  const showClear = clearable && val.length > 0 && !disabled && !readOnly;
  const successMsg = typeof success === "string" ? success : null;

  const common = {
    id: fid,
    ref: el,
    value: val,
    disabled,
    readOnly,
    maxLength,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: "fd-in-control",
    placeholder: floated ? placeholder : undefined,
    onChange: (e: { target: { value: string } }) => {
      setAutofilled(false);
      set(e.target.value);
    },
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      setFocus(true);
      onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      setFocus(false);
      onBlur?.(e);
    },
  };

  return (
    <div className={`fd-in${className ? " " + className : ""}`} data-size={size} data-state={state} data-focus={focus || undefined} data-floated={floated || undefined} data-disabled={disabled || undefined} data-multiline={multiline || undefined} data-fd-theme={theme}>
      <style>{css}</style>
      <div className="fd-in-box">
        {prefix && <span className="fd-in-fix fd-in-pre">{prefix}</span>}
        <div className="fd-in-main">
          {multiline ? (
            <textarea {...(common as object)} rows={rows} {...(rest as object)} />
          ) : (
            <input {...common} type={isPw && reveal ? "text" : type} {...rest} />
          )}
          <label className="fd-in-label" htmlFor={fid}>{label}</label>
        </div>
        <span className="fd-in-end">
          {showClear && (
            <button type="button" className="fd-in-btn" aria-label={`Clear ${label}`} onClick={() => { set(""); el.current?.focus(); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.7 12.3a1 1 0 0 1-1.4 1.4L12 13.4l-2.3 2.3a1 1 0 0 1-1.4-1.4l2.3-2.3-2.3-2.3a1 1 0 0 1 1.4-1.4l2.3 2.3 2.3-2.3a1 1 0 0 1 1.4 1.4L13.4 12z" /></svg>
            </button>
          )}
          {isPw && (
            <button type="button" className="fd-in-btn" aria-label={reveal ? "Hide password" : "Show password"} aria-pressed={reveal} onClick={() => setReveal((r) => !r)}>
              {reveal ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a14 14 0 0 1-2.6 3.4M6.6 7.7A14 14 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.5 0 2.8-.4 4-.9M9.9 10a3 3 0 0 0 4.1 4.1" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12C3.5 10 7 6 12 6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          )}
          {suffix && <span className="fd-in-fix fd-in-suf">{suffix}</span>}
          {state === "success" && (
            <span className="fd-in-state fd-in-ok" aria-hidden="true">
              <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
          )}
          {state === "error" && (
            <span className="fd-in-state fd-in-bad" aria-hidden="true">
              <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 7v6M12 17h.01" /></svg>
            </span>
          )}
        </span>
      </div>

      <div className="fd-in-foot">
        <div className="fd-in-msgwrap" data-open={error || helper || successMsg ? "" : undefined}>
          <div className="fd-in-msgin">
            {error ? (
              <p id={eid} className="fd-in-msg fd-in-err" role="alert">{error}</p>
            ) : successMsg ? (
              <p className="fd-in-msg fd-in-okmsg">{successMsg}</p>
            ) : helper ? (
              <p id={hid} className="fd-in-msg">{helper}</p>
            ) : null}
          </div>
        </div>
        {maxLength !== undefined && (
          <span id={cid} className="fd-in-count" data-near={val.length >= maxLength * 0.9 || undefined} aria-live="off">
            {val.length} / {maxLength}
          </span>
        )}
      </div>
    </div>
  );
});

const css = `
:where(.fd-in,.fd-in *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-in,.fd-in *)::before,:where(.fd-in,.fd-in *)::after{box-sizing:border-box}
:where(.fd-in svg){display:block;flex-shrink:0}
:where(.fd-in button,.fd-in input,.fd-in textarea){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;outline:0}
.fd-in{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --n-bg:#fff;--n-fg:#0B0B0F;--n-mut:#6B6B76;--n-line:rgba(11,11,15,.16);--n-line-h:rgba(11,11,15,.28);--n-accent:var(--fd-in-accent,#007AFF);--n-err:#D70015;--n-ok:#0F7D3F;--n-dis:#F1F1F4;
  --n-sh:0 1px 2px rgba(11,11,15,.04);
  display:block;width:100%;
  font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;color:var(--n-fg);
}
[data-fd-theme="dark"] .fd-in,.fd-in[data-fd-theme="dark"]{--n-bg:#16161B;--n-fg:#F5F5F7;--n-mut:#9A9AA6;--n-line:rgba(255,255,255,.14);--n-line-h:rgba(255,255,255,.26);--n-accent:var(--fd-in-accent,#0A84FF);--n-err:#FF6A60;--n-ok:#5BE382;--n-dis:#1B1B21;--n-sh:0 1px 0 rgba(255,255,255,.03) inset}
.fd-in[data-size="md"]{--n-h:52px}.fd-in[data-size="lg"]{--n-h:60px}
.fd-in-box{position:relative;display:flex;align-items:stretch;min-height:var(--n-h);border-radius:var(--fd-in-radius,14px);background:var(--n-bg);box-shadow:0 0 0 1px var(--n-line),var(--n-sh);
  transition:box-shadow var(--fd-dur-2) var(--fd-ease-out),background-color var(--fd-dur-2) var(--fd-ease-out)}
@media (hover:hover){.fd-in:not([data-disabled]):not([data-focus]):not([data-state="error"]):not([data-state="success"]) .fd-in-box:hover{box-shadow:0 0 0 1px var(--n-line-h),var(--n-sh)}}
.fd-in[data-focus] .fd-in-box{box-shadow:0 0 0 1.5px var(--n-accent),0 0 0 5px color-mix(in srgb,var(--n-accent) 18%,transparent)}
.fd-in[data-state="error"] .fd-in-box{box-shadow:0 0 0 1.5px var(--n-err)}
.fd-in[data-state="error"][data-focus] .fd-in-box{box-shadow:0 0 0 1.5px var(--n-err),0 0 0 5px color-mix(in srgb,var(--n-err) 18%,transparent)}
.fd-in[data-state="success"] .fd-in-box{box-shadow:0 0 0 1.5px var(--n-ok)}
.fd-in[data-state="success"][data-focus] .fd-in-box{box-shadow:0 0 0 1.5px var(--n-ok),0 0 0 5px color-mix(in srgb,var(--n-ok) 18%,transparent)}
.fd-in[data-disabled] .fd-in-box{background:var(--n-dis);box-shadow:0 0 0 1px var(--n-line);opacity:.65}
.fd-in-main{position:relative;flex:1;min-width:0;display:flex}
.fd-in-control{appearance:none;-webkit-appearance:none;border:0;outline:0;background:transparent;color:var(--n-fg);width:100%;min-width:0;height:auto;
  padding:calc(var(--n-h) * .42) 16px calc(var(--n-h) * .14);font-family:inherit;font-size:15px;line-height:1.3;font-weight:400;letter-spacing:inherit;caret-color:var(--n-accent);resize:none;
  text-overflow:ellipsis}
.fd-in[data-size="lg"] .fd-in-control{font-size:17px}
.fd-in[data-multiline] .fd-in-control{padding-top:26px;padding-bottom:12px;resize:vertical;min-height:calc(var(--n-h) * 1.5)}
.fd-in-control::placeholder{color:var(--n-mut);opacity:.75}
.fd-in-control:disabled{cursor:not-allowed}
.fd-in-control:-webkit-autofill{-webkit-text-fill-color:var(--n-fg);-webkit-box-shadow:0 0 0 100px var(--n-bg) inset;transition:background-color 9999s}
.fd-in-label{position:absolute;left:16px;top:calc(var(--n-h) / 2);max-width:calc(100% - 32px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;color:var(--n-mut);
  font-size:15px;line-height:1;transform:translateY(-50%);transform-origin:left top;
  transition:transform var(--fd-dur-2) var(--fd-ease-out),color var(--fd-dur-2) var(--fd-ease-out),top var(--fd-dur-2) var(--fd-ease-out)}
.fd-in[data-size="lg"] .fd-in-label{font-size:17px}
.fd-in[data-floated] .fd-in-label{top:calc(var(--n-h) * .3);transform:translateY(-50%) scale(.8)}
.fd-in[data-multiline]:not([data-floated]) .fd-in-label{top:calc(var(--n-h) / 2)}
.fd-in[data-focus] .fd-in-label{color:var(--n-accent)}
.fd-in[data-state="error"] .fd-in-label{color:var(--n-err)}
.fd-in[data-state="success"] .fd-in-label{color:var(--n-ok)}
.fd-in-fix{display:flex;align-items:center;color:var(--n-mut);font-size:15px;white-space:nowrap;user-select:none}
.fd-in-pre{padding:calc(var(--n-h) * .2) 0 0 16px}
.fd-in-pre+.fd-in-main .fd-in-control{padding-left:8px}.fd-in-pre+.fd-in-main .fd-in-label{left:8px}
.fd-in-end{display:flex;align-items:center;gap:2px;padding-right:12px}
.fd-in-suf{padding:calc(var(--n-h) * .2) 4px 0 4px}
.fd-in-btn{appearance:none;-webkit-appearance:none;border:0;outline:0;cursor:pointer;display:grid;place-items:center;width:32px;height:32px;border-radius:9999px;background:transparent;color:var(--n-mut);
  transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring),background-color var(--fd-dur-1) var(--fd-ease-out),color var(--fd-dur-1) var(--fd-ease-out)}
@media (hover:hover){.fd-in-btn:hover{background:color-mix(in srgb,var(--n-fg) 7%,transparent);color:var(--n-fg)}}
.fd-in-btn:active{transform:scale(.92);transition:transform var(--fd-dur-1) var(--fd-ease-out)}
.fd-in-btn:focus-visible{outline:2px solid color-mix(in srgb,var(--n-accent) 70%,transparent);outline-offset:1px}
.fd-in-state{display:grid;place-items:center;width:28px;height:28px;margin-left:2px;border-radius:9999px;animation:fd-in-pop var(--fd-dur-3) var(--fd-spring)}
.fd-in-ok{color:var(--n-ok)}.fd-in-bad{color:var(--n-err)}
.fd-in-ok path{stroke-dasharray:24;stroke-dashoffset:24;animation:fd-in-draw 380ms var(--fd-ease-out) 80ms forwards}
.fd-in-foot{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:0 4px}
.fd-in-msgwrap{display:grid;grid-template-rows:0fr;flex:1;transition:grid-template-rows var(--fd-dur-3) var(--fd-ease-out)}
.fd-in-msgwrap[data-open]{grid-template-rows:1fr}
.fd-in-msgin{overflow:hidden;min-height:0}
.fd-in-msg{padding-top:8px;font-size:13px;line-height:1.35;color:var(--n-mut)}
.fd-in-err{color:var(--n-err);animation:fd-in-slide var(--fd-dur-3) var(--fd-ease-out)}
.fd-in-okmsg{color:var(--n-ok)}
.fd-in-count{padding-top:8px;font-size:12px;line-height:1.35;color:var(--n-mut);font-variant-numeric:tabular-nums;transition:color var(--fd-dur-2) var(--fd-ease-out)}
.fd-in-count[data-near]{color:var(--n-err)}
@keyframes fd-in-pop{from{opacity:0;transform:scale(.4)}}
@keyframes fd-in-draw{to{stroke-dashoffset:0}}
@keyframes fd-in-slide{from{opacity:0;transform:translateY(-4px)}}
@media (prefers-reduced-motion:reduce){.fd-in-label,.fd-in-box,.fd-in-msgwrap{transition-duration:1ms}.fd-in-state,.fd-in-err{animation:none}.fd-in-ok path{animation:none;stroke-dashoffset:0}.fd-in-btn,.fd-in-btn:active{transform:none;transition:none}}
@media (prefers-contrast:more){.fd-in-box{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

function pwScore(v: string) {
  let s = 0;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  return s;
}

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [name, setName] = useState("Amara Okonkwo");
  const [email, setEmail] = useState("amara.okonkwo@");
  const [emailTouched, setEmailTouched] = useState(true);
  const [phone, setPhone] = useState("(415) 555-0142");
  const [member, setMember] = useState("BCX-2204-9187");
  const [pharmacy, setPharmacy] = useState("Mission Bay Pharmacy");
  const [note, setNote] = useState("Prefers text reminders before 6 pm. Allergic to penicillin.");
  const [pw, setPw] = useState("");
  const [pwTouched, setPwTouched] = useState(false);

  const score = pwScore(pw);
  const emailErr = emailTouched && !emailOk(email) ? (email ? "Enter a full address, like amara@example.com" : "Email is required so we can send visit summaries") : undefined;

  return (
    <div className="fd-in-demo" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-in-demo-bar">
        <span className="fd-in-demo-brand"><i aria-hidden="true" />Northfield Health</span>
        <span className="fd-in-demo-who">Amara O.</span>
        <button type="button" className="fd-in-demo-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      </header>

      <main className="fd-in-demo-main">
        <div className="fd-in-demo-title">
          <h1>Account settings</h1>
          <p>Keep your contact details current so your care team can reach you.</p>
        </div>

        <section className="fd-in-demo-card" aria-labelledby="fd-in-profile">
          <div className="fd-in-demo-cardhead"><h2 id="fd-in-profile">Personal information</h2><p>Shown to your care team and on visit summaries.</p></div>
          <div className="fd-in-demo-grid">
            <InputField label="Full name" value={name} onChange={setName} clearable autoComplete="name" success={name.trim().split(" ").length > 1 ? "Matches your insurance card" : false} />
            <InputField label="Email" type="email" value={email} onChange={setEmail} onBlur={() => setEmailTouched(true)} error={emailErr} success={!emailErr && emailOk(email)} autoComplete="email" helper="Used for visit summaries and billing." />
            <InputField label="Mobile phone" type="tel" prefix="+1" value={phone} onChange={setPhone} helper="We text appointment reminders. Msg rates may apply." autoComplete="tel-national" />
            <InputField label="Insurance member ID" value={member} onChange={setMember} suffix="Blue Cross" helper="Find it on the front of your card." />
            <InputField label="Preferred pharmacy" value={pharmacy} onChange={setPharmacy} clearable placeholder="Search by name or ZIP" />
            <InputField label="Date of birth" value="1988-03-14" readOnly helper="Contact support to change a verified date of birth." />
          </div>
          <InputField label="Notes for your care team" multiline rows={3} maxLength={120} value={note} onChange={setNote} helper="Visible to clinicians only." />
        </section>

        <section className="fd-in-demo-card" aria-labelledby="fd-in-sec">
          <div className="fd-in-demo-cardhead"><h2 id="fd-in-sec">Security</h2><p>Use at least 10 characters with a mix of letters, numbers and symbols.</p></div>
          <div className="fd-in-demo-grid">
            <div>
              <InputField
                label="New password"
                type="password"
                value={pw}
                onChange={setPw}
                onBlur={() => setPwTouched(true)}
                autoComplete="new-password"
                error={pwTouched && pw && score < 3 ? "Too easy to guess. Add a number or symbol." : undefined}
                success={score >= 3 ? "Strong password" : false}
              />
              <div className="fd-in-demo-meter" aria-hidden="true" data-score={score}><i /><i /><i /><i /></div>
            </div>
            <InputField label="Current password" type="password" disabled defaultValue="••••••••••" helper="Sign in again to confirm changes." />
          </div>
        </section>

        <div className="fd-in-demo-actions">
          <button type="button" className="fd-in-demo-btn" data-v="ghost">Cancel</button>
          <button type="button" className="fd-in-demo-btn" data-v="primary">Save changes</button>
        </div>
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-in-demo,.fd-in-demo *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-in-demo,.fd-in-demo *)::before,:where(.fd-in-demo,.fd-in-demo *)::after{box-sizing:border-box}
:where(.fd-in-demo button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-in-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:ui-sans-serif,-apple-system,"SF Pro Display","Inter",sans-serif;
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-dur-2:240ms;
  --d-bg:#F5F6F8;--d-card:#fff;--d-ink:#0B0B0F;--d-mut:#6B6B76;--d-line:rgba(11,11,15,.08);--d-accent:#007AFF;--d-teal:#0E8F7E;
  min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.45 var(--d-font);-webkit-font-smoothing:antialiased;transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-in-demo[data-fd-theme="dark"]{--d-bg:#09090B;--d-card:#111115;--d-ink:#F5F5F7;--d-mut:#9A9AA6;--d-line:rgba(255,255,255,.09);--d-accent:#0A84FF;--d-teal:#2DD4BF}
.fd-in-demo-bar{display:flex;align-items:center;gap:16px;height:60px;padding:0 clamp(16px,4vw,40px);background:var(--d-card);border-bottom:1px solid var(--d-line)}
.fd-in-demo-brand{display:flex;align-items:center;gap:10px;margin-right:auto;font:600 16px/1 var(--d-disp);letter-spacing:-.02em}
.fd-in-demo-brand i{display:block;width:20px;height:20px;border-radius:6px;background:var(--d-teal);position:relative}
.fd-in-demo-brand i::before,.fd-in-demo-brand i::after{content:"";position:absolute;background:#fff;border-radius:1px}
.fd-in-demo-brand i::before{left:9px;top:4px;width:2px;height:12px}.fd-in-demo-brand i::after{left:4px;top:9px;width:12px;height:2px}
.fd-in-demo-who{font:400 14px/1 var(--d-font);color:var(--d-mut)}
.fd-in-demo-theme{cursor:pointer;height:32px;padding:0 14px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-in-demo-theme:hover{color:var(--d-ink)}.fd-in-demo-theme:focus-visible,.fd-in-demo-btn:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px}
.fd-in-demo-main{max-width:760px;margin:0 auto;padding:40px clamp(16px,4vw,40px) 72px;display:flex;flex-direction:column;gap:20px}
.fd-in-demo-title h1{font:600 28px/1.15 var(--d-disp);letter-spacing:-.025em}
.fd-in-demo-title p{margin-top:8px;font:400 15px/1.4 var(--d-font);color:var(--d-mut)}
.fd-in-demo-card{display:flex;flex-direction:column;gap:20px;padding:28px;border-radius:24px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line),0 1px 2px rgba(0,0,0,.03),0 16px 32px -24px rgba(0,0,0,.18)}
.fd-in-demo-cardhead h2{font:600 17px/1.2 var(--d-font);letter-spacing:-.01em}
.fd-in-demo-cardhead p{margin-top:6px;font:400 14px/1.4 var(--d-font);color:var(--d-mut)}
.fd-in-demo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 16px;align-items:start}
.fd-in-demo-meter{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:10px 4px 0}
.fd-in-demo-meter i{height:4px;border-radius:9999px;background:var(--d-line);transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-in-demo-meter[data-score="1"] i:nth-child(-n+1){background:#FF453A}.fd-in-demo-meter[data-score="2"] i:nth-child(-n+2){background:#FF9F0A}
.fd-in-demo-meter[data-score="3"] i:nth-child(-n+3){background:#30D158}.fd-in-demo-meter[data-score="4"] i{background:#30D158}
.fd-in-demo-actions{display:flex;justify-content:flex-end;gap:8px}
.fd-in-demo-btn{cursor:pointer;height:44px;padding:0 22px;border-radius:9999px;font:500 15px/1 var(--d-font);transition:transform 420ms cubic-bezier(.34,1.56,.64,1)}
.fd-in-demo-btn:active{transform:scale(.96);transition-duration:120ms}
.fd-in-demo-btn[data-v="primary"]{background:var(--d-accent);color:#fff;box-shadow:0 1px 0 rgba(255,255,255,.22) inset,0 1px 2px rgba(0,40,120,.3)}
.fd-in-demo-btn[data-v="ghost"]{color:var(--d-mut)}.fd-in-demo-btn[data-v="ghost"]:hover{color:var(--d-ink)}
@media (max-width:640px){.fd-in-demo-grid{grid-template-columns:1fr}.fd-in-demo-card{padding:20px;border-radius:20px}}
`;
