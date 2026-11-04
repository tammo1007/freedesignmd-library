/**
 * MultiStepSignup, three-step onboarding form (Account → Workspace → Review)
 * with a progress stepper, per-step validation, direction-aware step
 * transitions, a measured height animation and a review step with edit links.
 *
 * Props: onComplete(data) (may return a Promise), productDomain (suffix shown
 * after the workspace URL, default "ledgerline.app"), theme.
 * Exports: MultiStepSignup, SignupData.
 *
 * Browser support: all evergreen browsers (ResizeObserver for height).
 * Accessibility: a <form> per step (Enter submits), labelled fields with
 * aria-invalid + aria-describedby, errors announced via role="alert", focus
 * moves to the step heading on every transition, the stepper is an <ol> with
 * aria-current="step", completed steps are buttons. Radio cards use native
 * radios. Reduced motion: transitions are replaced by a short fade.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface SignupData {
  name: string;
  email: string;
  password: string;
  company: string;
  size: string;
  role: string;
  slug: string;
  terms: boolean;
}

const STEPS = ["Account", "Workspace", "Review"] as const;
const SIZES = ["1–10", "11–50", "51–200", "200+"];
const ROLES = ["Finance lead", "RevOps manager", "Founder / CEO", "Engineer", "Other"];
const FREE = /@(gmail|yahoo|hotmail|outlook|icloud|proton)\./i;
const TAKEN = ["acme", "demo", "test", "admin", "app", "ledgerline"];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);

type Errors = Partial<Record<keyof SignupData, string>>;

function validate(step: number, d: SignupData): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (d.name.trim().split(/\s+/).length < 2) e.name = "Enter your first and last name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e.email = "Enter a valid email address";
    else if (FREE.test(d.email)) e.email = "Please use your work email, not a personal one";
    if (d.password.length < 8) e.password = "At least 8 characters";
    else if (!/\d/.test(d.password) || !/[a-z]/i.test(d.password)) e.password = "Include a letter and a number";
  }
  if (step === 1) {
    if (!d.company.trim()) e.company = "Tell us your company name";
    if (!d.size) e.size = "Pick your team size";
    if (!d.role) e.role = "Choose the closest role";
    if (d.slug.length < 3) e.slug = "At least 3 characters";
    else if (TAKEN.includes(d.slug)) e.slug = `“${d.slug}” is taken. Try ${d.slug}-hq`;
  }
  if (step === 2 && !d.terms) e.terms = "Accept the terms to continue";
  return e;
}

function FieldWrap({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="fd-ms-field" data-bad={error ? "" : undefined}>
      <label htmlFor={id}>{label}</label>
      {children}
      <p className="fd-ms-msg" id={`${id}-m`} role={error ? "alert" : undefined} data-err={error ? "" : undefined}>{error ?? hint}</p>
    </div>
  );
}

export interface MultiStepSignupProps {
  onComplete?: (d: SignupData) => void | Promise<unknown>;
  productDomain?: string;
  theme?: "light" | "dark";
  className?: string;
}

export function MultiStepSignup({ onComplete, productDomain = "ledgerline.app", theme, className }: MultiStepSignupProps) {
  const uid = useId();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [furthest, setFurthest] = useState(0);
  const [d, setD] = useState<SignupData>({ name: "", email: "", password: "", company: "", size: "", role: "", slug: "", terms: false });
  const [slugTouched, setSlugTouched] = useState(false);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [pw, setPw] = useState(false);
  const [phase, setPhase] = useState<"form" | "loading" | "done">("form");
  const head = useRef<HTMLHeadingElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | undefined>();
  const first = useRef(true);

  const errors = validate(step, d);
  const err = (k: keyof SignupData) => (shown[k] ? errors[k] : undefined);
  const set = <K extends keyof SignupData>(k: K, v: SignupData[K]) => setD((p) => ({ ...p, [k]: v }));

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    setH(el.offsetHeight);
    return () => ro.disconnect();
  }, [step, phase]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    head.current?.focus({ preventScroll: true });
  }, [step, phase]);

  const go = (n: number) => {
    setDir(n > step ? "next" : "prev");
    setShown({});
    setStep(n);
    setFurthest((f) => Math.max(f, n));
  };

  const next = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(step, d);
    const keys = Object.keys(errs) as (keyof SignupData)[];
    if (keys.length) {
      setShown(Object.fromEntries(keys.map((k) => [k, true])));
      requestAnimationFrame(() => document.getElementById(`${uid}-${keys[0]}`)?.focus());
      return;
    }
    if (step < 2) return go(step + 1);
    setPhase("loading");
    try {
      await onComplete?.(d);
      await new Promise((r) => window.setTimeout(r, 1200));
      setPhase("done");
    } catch {
      setPhase("form");
    }
  };

  const common = (k: keyof SignupData) => ({ id: `${uid}-${k}`, "aria-invalid": !!err(k), "aria-describedby": `${uid}-${k}-m`, onBlur: () => String(d[k] ?? "").length > 0 && setShown((s) => ({ ...s, [k]: true })) });

  const slugOk = d.slug.length >= 3 && !TAKEN.includes(d.slug);

  return (
    <div className={`fd-ms${className ? " " + className : ""}`} data-fd-theme={theme}>
      <style>{css}</style>

      {phase !== "done" && (
        <ol className="fd-ms-steps" aria-label="Sign-up progress">
          {STEPS.map((s, i) => {
            const state = i < step ? "done" : i === step ? "current" : "todo";
            const body = (
              <>
                <span className="fd-ms-dot" data-state={state}>
                  {state === "done" ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="fd-ms-name">{s}</span>
              </>
            );
            return (
              <li key={s} className="fd-ms-step" data-state={state} aria-current={i === step ? "step" : undefined}>
                {i <= furthest && i !== step && phase === "form" ? (
                  <button type="button" className="fd-ms-stepbtn" onClick={() => go(i)} aria-label={`Go back to ${s}`}>{body}</button>
                ) : (
                  <span className="fd-ms-stepbtn">{body}</span>
                )}
                {i < STEPS.length - 1 && <span className="fd-ms-line" aria-hidden="true"><i style={{ transform: `scaleX(${i < step ? 1 : 0})` }} /></span>}
              </li>
            );
          })}
        </ol>
      )}

      <div className="fd-ms-viewport" style={{ height: h === undefined ? undefined : h + 16 }}>
        <div ref={inner} className="fd-ms-inner">
          {phase === "done" ? (
            <div className="fd-ms-panel fd-ms-success" key="done" data-dir="next">
              <span className="fd-ms-bigcheck" aria-hidden="true"><svg aria-hidden="true" focusable="false" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
              <h2 ref={head} tabIndex={-1}>You’re in, {d.name.split(" ")[0]}.</h2>
              <p>Your workspace is ready at <b>{d.slug}.{productDomain}</b>. We sent a confirmation link to {d.email}.</p>
              <button type="button" className="fd-ms-btn" data-v="primary" onClick={() => { setPhase("form"); setStep(0); setFurthest(0); setShown({}); setD({ name: "", email: "", password: "", company: "", size: "", role: "", slug: "", terms: false }); setSlugTouched(false); }}>Open workspace</button>
            </div>
          ) : (
            <form className="fd-ms-panel" key={step} data-dir={dir} onSubmit={next} noValidate aria-labelledby={`${uid}-h`}>
              <header>
                <p className="fd-ms-count">Step {step + 1} of 3</p>
                <h2 id={`${uid}-h`} ref={head} tabIndex={-1}>{step === 0 ? "Create your account" : step === 1 ? "Set up your workspace" : "Review and create"}</h2>
              </header>

              {step === 0 && (
                <div className="fd-ms-fields">
                  <FieldWrap id={`${uid}-name`} label="Full name" error={err("name")}>
                    <input {...common("name")} autoComplete="name" placeholder="Priya Natarajan" value={d.name} onChange={(e) => set("name", e.target.value)} autoFocus />
                  </FieldWrap>
                  <FieldWrap id={`${uid}-email`} label="Work email" error={err("email")} hint="We’ll never share it.">
                    <input {...common("email")} type="email" autoComplete="email" placeholder="priya@northbeam.co" value={d.email} onChange={(e) => set("email", e.target.value)} />
                  </FieldWrap>
                  <FieldWrap id={`${uid}-password`} label="Password" error={err("password")} hint="8+ characters with a letter and a number.">
                    <div className="fd-ms-pw">
                      <input {...common("password")} type={pw ? "text" : "password"} autoComplete="new-password" value={d.password} onChange={(e) => set("password", e.target.value)} />
                      <button type="button" aria-label={pw ? "Hide password" : "Show password"} aria-pressed={pw} onClick={() => setPw(!pw)}>{pw ? "Hide" : "Show"}</button>
                    </div>
                  </FieldWrap>
                </div>
              )}

              {step === 1 && (
                <div className="fd-ms-fields">
                  <FieldWrap id={`${uid}-company`} label="Company name" error={err("company")}>
                    <input
                      {...common("company")}
                      autoComplete="organization"
                      placeholder="Northbeam"
                      value={d.company}
                      onChange={(e) => {
                        const v = e.target.value;
                        setD((p) => ({ ...p, company: v, slug: slugTouched ? p.slug : slugify(v) }));
                      }}
                      autoFocus
                    />
                  </FieldWrap>
                  <div className="fd-ms-field" data-bad={err("size") ? "" : undefined}>
                    <span className="fd-ms-lab" id={`${uid}-size`}>Team size</span>
                    <div className="fd-ms-cards" role="radiogroup" aria-labelledby={`${uid}-size`}>
                      {SIZES.map((s) => (
                        <label key={s} className="fd-ms-card" data-on={d.size === s ? "" : undefined}>
                          <input type="radio" name={`${uid}-sz`} value={s} checked={d.size === s} onChange={() => set("size", s)} />
                          <span>{s}</span>
                        </label>
                      ))}
                    </div>
                    <p className="fd-ms-msg" role={err("size") ? "alert" : undefined} data-err={err("size") ? "" : undefined}>{err("size")}</p>
                  </div>
                  <FieldWrap id={`${uid}-role`} label="Your role" error={err("role")}>
                    <div className="fd-ms-sel">
                      <select {...common("role")} value={d.role} onChange={(e) => set("role", e.target.value)} data-empty={!d.role || undefined}>
                        <option value="">Select a role</option>
                        {ROLES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                    </div>
                  </FieldWrap>
                  <FieldWrap id={`${uid}-slug`} label="Workspace URL" error={err("slug")} hint={slugOk ? <span className="fd-ms-ok">{d.slug}.{productDomain} is available</span> : "Letters, numbers and dashes."}>
                    <div className="fd-ms-url">
                      <input {...common("slug")} placeholder="northbeam" value={d.slug} onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} autoCapitalize="none" spellCheck={false} />
                      <span>.{productDomain}</span>
                    </div>
                  </FieldWrap>
                </div>
              )}

              {step === 2 && (
                <div className="fd-ms-review">
                  {[
                    { t: "Account", go: 0, rows: [["Name", d.name], ["Email", d.email], ["Password", "•".repeat(Math.min(d.password.length, 12))]] },
                    { t: "Workspace", go: 1, rows: [["Company", d.company], ["Team size", `${d.size} people`], ["Role", d.role], ["URL", `${d.slug}.${productDomain}`]] },
                  ].map((g) => (
                    <section key={g.t} className="fd-ms-group">
                      <div className="fd-ms-ghead"><h3>{g.t}</h3><button type="button" onClick={() => go(g.go)}>Edit<span className="fd-ms-sr"> {g.t}</span></button></div>
                      <dl>{g.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                    </section>
                  ))}
                  <label className="fd-ms-terms" data-bad={err("terms") ? "" : undefined}>
                    <input id={`${uid}-terms`} type="checkbox" checked={d.terms} onChange={(e) => set("terms", e.target.checked)} aria-invalid={!!err("terms")} />
                    <span className="fd-ms-box" aria-hidden="true"><svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                    <span>I agree to the Terms of Service and the Data Processing Addendum.</span>
                  </label>
                  <p className="fd-ms-msg" role={err("terms") ? "alert" : undefined} data-err={err("terms") ? "" : undefined}>{err("terms")}</p>
                </div>
              )}

              <footer className="fd-ms-actions">
                {step > 0 ? <button type="button" className="fd-ms-btn" data-v="ghost" onClick={() => go(step - 1)} disabled={phase === "loading"}>Back</button> : <span />}
                <button type="submit" className="fd-ms-btn" data-v="primary" data-loading={phase === "loading" || undefined} aria-busy={phase === "loading"}>
                  <span>{step === 2 ? "Create workspace" : "Continue"}</span>
                  <svg className="fd-ms-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
                </button>
              </footer>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const css = `
:where(.fd-ms,.fd-ms *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-ms,.fd-ms *)::before,:where(.fd-ms,.fd-ms *)::after{box-sizing:border-box}
:where(.fd-ms svg){display:block;flex-shrink:0}
:where(.fd-ms button,.fd-ms input,.fd-ms select){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;outline:0}
.fd-ms{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --s-bg:#fff;--s-fg:#0B0B0F;--s-mut:#6B6B76;--s-line:rgba(11,11,15,.16);--s-line-h:rgba(11,11,15,.28);--s-soft:rgba(11,11,15,.05);--s-accent:#007AFF;--s-err:#D70015;--s-ok:#0F7D3F;
  width:100%;max-width:440px;
  font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;color:var(--s-fg);
}
[data-fd-theme="dark"] .fd-ms,.fd-ms[data-fd-theme="dark"]{--s-bg:#16161B;--s-fg:#F5F5F7;--s-mut:#9A9AA6;--s-line:rgba(255,255,255,.14);--s-line-h:rgba(255,255,255,.26);--s-soft:rgba(255,255,255,.06);--s-accent:#0A84FF;--s-err:#FF6A60;--s-ok:#5BE382}
.fd-ms-steps{display:flex;align-items:center;margin-bottom:28px}
.fd-ms-step{display:flex;align-items:center;flex:none}
.fd-ms-step:not(:last-child){flex:1}
.fd-ms-stepbtn{display:inline-flex;align-items:center;gap:10px;appearance:none;-webkit-appearance:none;border:0;outline:0;background:transparent;cursor:default;font-family:inherit;font-size:13px;font-weight:500;line-height:1;color:var(--s-mut);border-radius:9999px;padding:2px 2px 2px 0}
button.fd-ms-stepbtn{cursor:pointer}
button.fd-ms-stepbtn:focus-visible{outline:2px solid color-mix(in srgb,var(--s-accent) 70%,transparent);outline-offset:3px}
.fd-ms-step[data-state="current"] .fd-ms-stepbtn{color:var(--s-fg)}
.fd-ms-dot{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--s-mut);box-shadow:0 0 0 1px var(--s-line);background:var(--s-bg);
  transition:background-color var(--fd-dur-3) var(--fd-ease-out),color var(--fd-dur-3) var(--fd-ease-out),box-shadow var(--fd-dur-3) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring)}
.fd-ms-dot[data-state="current"]{color:var(--s-accent);box-shadow:0 0 0 1.5px var(--s-accent),0 0 0 5px color-mix(in srgb,var(--s-accent) 16%,transparent)}
.fd-ms-dot[data-state="done"]{background:var(--s-accent);color:#fff;box-shadow:0 0 0 1px var(--s-accent)}
@media (hover:hover){button.fd-ms-stepbtn:hover .fd-ms-dot{transform:scale(1.08)}}
.fd-ms-line{flex:1;height:2px;margin:0 12px;border-radius:2px;background:var(--s-line);overflow:hidden}
.fd-ms-line i{display:block;height:100%;background:var(--s-accent);transform-origin:left;transition:transform var(--fd-dur-3) var(--fd-ease-out)}
.fd-ms-viewport{overflow:hidden;margin:-8px;padding:8px;transition:height var(--fd-dur-3) var(--fd-ease-out)}
.fd-ms-inner{width:100%}
.fd-ms-panel{display:flex;flex-direction:column;gap:24px;animation:fd-ms-next var(--fd-dur-3) var(--fd-ease-out) both}
.fd-ms-panel[data-dir="prev"]{animation-name:fd-ms-prev}
.fd-ms-count{font-size:13px;line-height:1;font-weight:500;color:var(--s-accent)}
.fd-ms-panel h2{margin-top:10px;font-size:26px;font-weight:600;line-height:1.15;letter-spacing:-.025em;outline:0;font-family:ui-sans-serif,-apple-system,"SF Pro Display","Inter",sans-serif}
.fd-ms-fields{display:flex;flex-direction:column;gap:16px}
.fd-ms-field>label,.fd-ms-lab{display:block;margin:0 0 6px 2px;font-size:13px;font-weight:500;line-height:1.2;color:var(--s-mut)}
.fd-ms-field input:not([type="radio"]),.fd-ms-field select{display:block;width:100%;height:48px;padding:0 14px;border-radius:12px;background:var(--s-bg);color:var(--s-fg);font-family:inherit;font-size:15px;line-height:1.2;letter-spacing:inherit;
  box-shadow:0 0 0 1px var(--s-line),0 1px 2px rgba(11,11,15,.04);caret-color:var(--s-accent);transition:box-shadow var(--fd-dur-2) var(--fd-ease-out)}
@media (hover:hover){.fd-ms-field input:not([type="radio"]):hover,.fd-ms-field select:hover{box-shadow:0 0 0 1px var(--s-line-h),0 1px 2px rgba(11,11,15,.04)}}
.fd-ms-field input:not([type="radio"]):focus,.fd-ms-field select:focus,.fd-ms-url:focus-within{box-shadow:0 0 0 1.5px var(--s-accent),0 0 0 5px color-mix(in srgb,var(--s-accent) 18%,transparent)}
.fd-ms-field[data-bad] input:not([type="radio"]),.fd-ms-field[data-bad] select,.fd-ms-field[data-bad] .fd-ms-url{box-shadow:0 0 0 1.5px var(--s-err)}
.fd-ms-field input::placeholder{color:var(--s-mut);opacity:.6}
.fd-ms-msg{min-height:18px;padding:6px 2px 0;font-size:12.5px;line-height:1.3;color:var(--s-mut)}
.fd-ms-msg[data-err]{color:var(--s-err);animation:fd-ms-shake 380ms var(--fd-ease-out)}
.fd-ms-ok{color:var(--s-ok)}
.fd-ms-pw{position:relative}.fd-ms-pw input{padding-right:64px!important}
.fd-ms-pw button{position:absolute;right:8px;top:8px;height:32px;padding:0 10px;border-radius:9999px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:500;line-height:1;color:var(--s-mut);transition:background-color var(--fd-dur-1)}
.fd-ms-pw button:hover{background:var(--s-soft);color:var(--s-fg)}.fd-ms-pw button:focus-visible{outline:2px solid color-mix(in srgb,var(--s-accent) 70%,transparent);outline-offset:1px}
.fd-ms-sel{position:relative}.fd-ms-sel select{padding-right:40px;cursor:pointer}.fd-ms-sel select[data-empty]{color:var(--s-mut)}.fd-ms-sel select option{color:#0B0B0F;background:#fff}
.fd-ms-sel svg{position:absolute;right:14px;top:16px;pointer-events:none;color:var(--s-mut)}
.fd-ms-url{display:flex;align-items:center;border-radius:12px;background:var(--s-bg);box-shadow:0 0 0 1px var(--s-line),0 1px 2px rgba(11,11,15,.04);transition:box-shadow var(--fd-dur-2) var(--fd-ease-out)}
.fd-ms-url input{flex:1;min-width:0;box-shadow:none!important;background:transparent!important;padding-right:0!important}
.fd-ms-url span{padding:0 14px 0 2px;font-size:15px;color:var(--s-mut);white-space:nowrap}
.fd-ms-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.fd-ms-card{position:relative;display:grid;place-items:center;height:48px;margin:0;border-radius:12px;background:var(--s-bg);box-shadow:0 0 0 1px var(--s-line);cursor:pointer;font-size:14px;font-weight:500;color:var(--s-fg);transition:box-shadow var(--fd-dur-2) var(--fd-ease-out),background-color var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring)}
.fd-ms-card input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.fd-ms-card[data-on]{box-shadow:0 0 0 1.5px var(--s-accent);background:color-mix(in srgb,var(--s-accent) 8%,var(--s-bg));color:var(--s-accent)}
.fd-ms-card:has(input:focus-visible){outline:2px solid color-mix(in srgb,var(--s-accent) 70%,transparent);outline-offset:2px}
.fd-ms-card:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-ms-review{display:flex;flex-direction:column;gap:12px}
.fd-ms-group{padding:16px;border-radius:16px;background:var(--s-soft)}
.fd-ms-ghead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.fd-ms-ghead h3{font-size:13px;font-weight:600;line-height:1.2;color:var(--s-mut);text-transform:uppercase;letter-spacing:.05em}
.fd-ms-ghead button{cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;line-height:1;color:var(--s-accent);border-radius:6px;padding:2px 4px}
.fd-ms-ghead button:focus-visible{outline:2px solid color-mix(in srgb,var(--s-accent) 70%,transparent);outline-offset:2px}
.fd-ms-group dl{display:flex;flex-direction:column;gap:8px}
.fd-ms-group dl div{display:flex;justify-content:space-between;gap:16px;font-size:14px;line-height:1.3}
.fd-ms-group dt{color:var(--s-mut)}.fd-ms-group dd{text-align:right;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.fd-ms-terms{position:relative;display:flex;gap:12px;align-items:flex-start;margin-top:4px;cursor:pointer;font-size:14px;line-height:1.4;color:var(--s-fg)}
.fd-ms-terms input{position:absolute;opacity:0;width:20px;height:20px}
.fd-ms-box{display:grid;place-items:center;flex:none;width:20px;height:20px;margin-top:1px;border-radius:6px;background:var(--s-bg);box-shadow:0 0 0 1px var(--s-line-h);color:transparent;transition:background-color var(--fd-dur-2) var(--fd-ease-out),box-shadow var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring)}
.fd-ms-terms input:checked+.fd-ms-box{background:var(--s-accent);box-shadow:0 0 0 1px var(--s-accent);color:#fff;transform:scale(1.06)}
.fd-ms-terms input:focus-visible+.fd-ms-box{outline:2px solid color-mix(in srgb,var(--s-accent) 70%,transparent);outline-offset:2px}
.fd-ms-terms[data-bad] .fd-ms-box{box-shadow:0 0 0 1.5px var(--s-err)}
.fd-ms-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:4px}
.fd-ms-btn{position:relative;display:inline-grid;place-items:center;height:48px;padding:0 26px;border-radius:9999px;cursor:pointer;font-family:inherit;font-size:15px;font-weight:500;line-height:1;letter-spacing:-.005em;
  transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring),background-color var(--fd-dur-2) var(--fd-ease-out),filter var(--fd-dur-1)}
.fd-ms-btn>*{grid-area:1/1;transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-ease-out)}
.fd-ms-btn[data-v="primary"]{background:var(--s-accent);color:#fff;min-width:150px;box-shadow:0 1px 0 rgba(255,255,255,.22) inset,0 1px 2px rgba(0,40,120,.35),0 10px 22px -12px var(--s-accent)}
.fd-ms-btn[data-v="ghost"]{color:var(--s-mut);padding:0 16px}
@media (hover:hover){.fd-ms-btn[data-v="primary"]:hover{filter:brightness(1.08)}.fd-ms-btn[data-v="ghost"]:hover{color:var(--s-fg);background:var(--s-soft)}}
.fd-ms-btn:active{transform:scale(.96);transition:transform var(--fd-dur-1) var(--fd-ease-out)}
.fd-ms-btn:focus-visible{outline:2px solid color-mix(in srgb,var(--s-accent) 70%,transparent);outline-offset:3px}
.fd-ms-btn:disabled{opacity:.5;cursor:not-allowed}
.fd-ms-spin{opacity:0;transform:scale(.7);animation:fd-ms-rot .8s linear infinite}
.fd-ms-btn[data-loading]>span{opacity:0;transform:translateY(-8px)}.fd-ms-btn[data-loading] .fd-ms-spin{opacity:1;transform:none}
.fd-ms-success{align-items:flex-start;padding-top:8px}
.fd-ms-success p{font-size:15px;line-height:1.5;color:var(--s-mut);max-width:38ch}.fd-ms-success b{color:var(--s-fg);font-weight:600}
.fd-ms-bigcheck{display:grid;place-items:center;width:64px;height:64px;border-radius:20px;background:color-mix(in srgb,var(--s-ok) 16%,transparent);color:var(--s-ok);animation:fd-ms-pop 600ms var(--fd-spring)}
.fd-ms-bigcheck path{stroke-dasharray:24;stroke-dashoffset:24;animation:fd-ms-draw 460ms var(--fd-ease-out) 160ms forwards}
.fd-ms-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes fd-ms-next{from{opacity:0;transform:translateX(28px)}}
@keyframes fd-ms-prev{from{opacity:0;transform:translateX(-28px)}}
@keyframes fd-ms-rot{to{transform:rotate(360deg)}}
@keyframes fd-ms-draw{to{stroke-dashoffset:0}}
@keyframes fd-ms-pop{from{transform:scale(.5);opacity:0}}
@keyframes fd-ms-shake{20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
@media (max-width:420px){.fd-ms-name{display:none}.fd-ms-cards{grid-template-columns:repeat(2,1fr)}.fd-ms-step[data-state="current"] .fd-ms-name{display:inline}}
@media (prefers-reduced-motion:reduce){.fd-ms-panel,.fd-ms-panel[data-dir="prev"]{animation:fd-ms-fade 100ms linear both}.fd-ms-viewport,.fd-ms-line i,.fd-ms-dot,.fd-ms-btn,.fd-ms-btn>*{transition:none}.fd-ms-msg[data-err],.fd-ms-bigcheck,.fd-ms-spin{animation:none}.fd-ms-bigcheck path{animation:none;stroke-dashoffset:0}}
@keyframes fd-ms-fade{from{opacity:0}}
@media (prefers-contrast:more){.fd-ms-field input:not([type="radio"]),.fd-ms-field select{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

export function Demo() {
  return (
    <div className="fd-msd">
      <style>{demoCss}</style>
      <div className="fd-msd-card">
        <MultiStepSignup theme="light" />
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-msd,.fd-msd *,.fd-msd *::before,.fd-msd *::after{box-sizing:border-box}
.fd-msd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;color:#1d1d1f;font:400 15px/1.4 ${F};letter-spacing:normal;background:#f1f1f2}
.fd-msd-card{width:100%;max-width:440px;margin:0;padding:32px;border-radius:28px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.04),0 1px 2px rgba(0,0,0,.03),0 18px 40px -22px rgba(0,0,0,.2)}
`;
