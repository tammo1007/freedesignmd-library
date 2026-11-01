/**
 * OtpInput — one-time-code entry (default 6 digits) with auto-advance,
 * paste and SMS autofill support, a shake on error and a success cascade.
 *
 * Props: length (default 6), value / defaultValue / onChange(code),
 * onComplete(code), status ("idle" | "verifying" | "error" | "success"),
 * groupSize (visual gap after N digits, default 3), disabled, autoFocus,
 * aria-label, theme, charset ("numeric" | "alphanumeric").
 *
 * Browser support: all evergreen browsers. autocomplete="one-time-code" gives
 * iOS / Android SMS suggestions on the first cell.
 * Accessibility: each cell is a labelled <input> ("Digit 3 of 6"), the group
 * has role="group", errors are announced via a live region. Keys: digits type
 * and advance, Backspace clears then steps back, Arrow/Home/End move, Ctrl/⌘+V
 * pastes the whole code. Reduced motion: no shake or pop, colour change only.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";

export type OtpStatus = "idle" | "verifying" | "error" | "success";

export interface OtpInputProps {
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  status?: OtpStatus;
  groupSize?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  charset?: "numeric" | "alphanumeric";
  theme?: "light" | "dark";
  className?: string;
  "aria-label"?: string;
}

export function OtpInput({
  length = 6,
  value,
  defaultValue = "",
  onChange,
  onComplete,
  status = "idle",
  groupSize = 3,
  disabled,
  autoFocus,
  charset = "numeric",
  theme,
  className,
  "aria-label": ariaLabel = "Verification code",
}: OtpInputProps) {
  const uid = useId();
  const [inner, setInner] = useState(defaultValue.slice(0, length));
  const code = (value ?? inner).slice(0, length);
  const cells = useRef<(HTMLInputElement | null)[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const locked = disabled || status === "verifying" || status === "success";
  const clean = useCallback((s: string) => (charset === "numeric" ? s.replace(/\D/g, "") : s.replace(/[^a-z0-9]/gi, "").toUpperCase()), [charset]);

  const commit = useCallback(
    (next: string) => {
      if (value === undefined) setInner(next);
      onChange?.(next);
      if (next.length === length) onComplete?.(next);
    },
    [length, onChange, onComplete, value],
  );

  const focusCell = (i: number) => {
    const c = cells.current[Math.max(0, Math.min(length - 1, i))];
    c?.focus();
    c?.select();
  };

  useEffect(() => {
    if (autoFocus) focusCell(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "error") {
      setShakeKey((k) => k + 1);
      const t = window.setTimeout(() => focusCell(0), 420);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const put = (start: number, raw: string) => {
    const s = clean(raw);
    if (!s) return;
    const arr = code.padEnd(length, " ").split("");
    let i = start;
    for (const ch of s) {
      if (i >= length) break;
      arr[i++] = ch;
    }
    commit(arr.join("").replace(/ +$/, "").replace(/ /g, ""));
    // keep holes impossible: only contiguous codes are stored
    window.requestAnimationFrame(() => focusCell(Math.min(i, length - 1)));
  };

  const chars = code.split("");

  return (
    <div className={`fd-otp${className ? " " + className : ""}`} data-status={status} data-fd-theme={theme}>
      <style>{css}</style>
      <div key={shakeKey} className="fd-otp-row" role="group" aria-label={ariaLabel} data-shake={status === "error" ? "" : undefined}>
        {Array.from({ length }).map((_, i) => (
          <span key={i} className="fd-otp-slot" data-gap={groupSize && i > 0 && i % groupSize === 0 ? "" : undefined}>
            <input
              ref={(n) => {
                cells.current[i] = n;
              }}
              id={`${uid}-${i}`}
              className="fd-otp-cell"
              type="text"
              inputMode={charset === "numeric" ? "numeric" : "text"}
              pattern={charset === "numeric" ? "[0-9]*" : undefined}
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1} of ${length}`}
              aria-invalid={status === "error" || undefined}
              maxLength={length}
              disabled={locked}
              value={chars[i] ?? ""}
              data-filled={chars[i] ? "" : undefined}
              data-active={active === i ? "" : undefined}
              style={{ animationDelay: status === "success" ? `${i * 55}ms` : undefined }}
              onFocus={(e) => {
                setActive(i);
                // never leave a gap: jump to the first empty cell
                const first = Math.min(code.length, length - 1);
                if (i > first) focusCell(first);
                else e.currentTarget.select();
              }}
              onBlur={() => setActive((a) => (a === i ? null : a))}
              onChange={(e) => {
                const v = clean(e.target.value);
                if (!v) {
                  commit(code.slice(0, i) + code.slice(i + 1));
                  return;
                }
                put(i, v.length > 1 ? v : v.slice(-1));
              }}
              onPaste={(e) => {
                e.preventDefault();
                put(0, e.clipboardData.getData("text"));
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace") {
                  e.preventDefault();
                  if (chars[i]) commit(code.slice(0, i) + code.slice(i + 1));
                  else if (i > 0) {
                    commit(code.slice(0, i - 1) + code.slice(i));
                    focusCell(i - 1);
                  }
                } else if (e.key === "ArrowLeft") (e.preventDefault(), focusCell(i - 1));
                else if (e.key === "ArrowRight") (e.preventDefault(), focusCell(Math.min(i + 1, code.length)));
                else if (e.key === "Home") (e.preventDefault(), focusCell(0));
                else if (e.key === "End") (e.preventDefault(), focusCell(code.length));
              }}
            />
            {status === "verifying" && <i className="fd-otp-pulse" style={{ animationDelay: `${i * 80}ms` }} aria-hidden="true" />}
          </span>
        ))}
      </div>
      <span className="fd-otp-sr" role="status" aria-live="polite">
        {status === "error" ? "Incorrect code" : status === "success" ? "Code verified" : status === "verifying" ? "Verifying" : ""}
      </span>
    </div>
  );
}

const css = `
:where(.fd-otp,.fd-otp *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-otp,.fd-otp *)::before,:where(.fd-otp,.fd-otp *)::after{box-sizing:border-box}
:where(.fd-otp input){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;outline:0}
.fd-otp{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --o-bg:#fff;--o-fg:#0B0B0F;--o-line:rgba(11,11,15,.16);--o-line-h:rgba(11,11,15,.3);--o-accent:#007AFF;--o-err:#D70015;--o-ok:#12823F;--o-ok-bg:rgba(31,164,91,.08);--o-err-bg:rgba(215,0,21,.05);
  display:inline-block;max-width:100%;
  font:600 28px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter","Segoe UI",Roboto,sans-serif;color:var(--o-fg);
}
[data-fd-theme="dark"] .fd-otp,.fd-otp[data-fd-theme="dark"]{--o-bg:#16161B;--o-fg:#F5F5F7;--o-line:rgba(255,255,255,.16);--o-line-h:rgba(255,255,255,.3);--o-accent:#0A84FF;--o-err:#FF6A60;--o-ok:#5BE382;--o-ok-bg:rgba(48,209,88,.1);--o-err-bg:rgba(255,69,58,.08)}
.fd-otp-row{display:flex;align-items:center;gap:8px}
.fd-otp-slot{position:relative;display:block;flex:1 1 0;min-width:0;width:52px;max-width:56px}
.fd-otp-slot[data-gap]{margin-left:12px}
.fd-otp-cell{display:block;width:100%;height:64px;padding:0;border-radius:14px;text-align:center;background:var(--o-bg);color:var(--o-fg);caret-color:var(--o-accent);
  font-family:inherit;font-size:28px;font-weight:600;line-height:1;letter-spacing:0;font-variant-numeric:tabular-nums;
  box-shadow:0 0 0 1px var(--o-line),0 1px 2px rgba(11,11,15,.04);
  transition:box-shadow var(--fd-dur-2) var(--fd-ease-out),background-color var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring),color var(--fd-dur-2) var(--fd-ease-out)}
@media (hover:hover){.fd-otp-cell:hover:not(:disabled):not(:focus){box-shadow:0 0 0 1px var(--o-line-h),0 1px 2px rgba(11,11,15,.04)}}
.fd-otp-cell[data-filled]{box-shadow:0 0 0 1px var(--o-line-h),0 1px 2px rgba(11,11,15,.04)}
.fd-otp-cell:focus{box-shadow:0 0 0 1.5px var(--o-accent),0 0 0 5px color-mix(in srgb,var(--o-accent) 18%,transparent);transform:translateY(-1px)}
.fd-otp-cell[data-filled]:not(:focus){animation:fd-otp-pop var(--fd-dur-3) var(--fd-spring)}
.fd-otp-cell:disabled{cursor:default;opacity:1;-webkit-text-fill-color:currentColor}
.fd-otp[data-status="verifying"] .fd-otp-cell{opacity:.7}
.fd-otp[data-status="error"] .fd-otp-cell{color:var(--o-err);background:var(--o-err-bg);box-shadow:0 0 0 1.5px var(--o-err)}
.fd-otp[data-status="success"] .fd-otp-cell{color:var(--o-ok);background:var(--o-ok-bg);box-shadow:0 0 0 1.5px var(--o-ok);animation:fd-otp-ok 520ms var(--fd-spring) both}
.fd-otp-row[data-shake]{animation:fd-otp-shake 460ms cubic-bezier(.36,.07,.19,.97) both}
.fd-otp-pulse{position:absolute;left:50%;bottom:10px;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:var(--o-accent);opacity:0;animation:fd-otp-dot 900ms ease-in-out infinite}
.fd-otp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes fd-otp-pop{0%{transform:scale(.92)}100%{transform:scale(1)}}
@keyframes fd-otp-ok{0%{transform:scale(1)}40%{transform:scale(1.08) translateY(-3px)}100%{transform:scale(1)}}
@keyframes fd-otp-shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-7px)}40%,60%{transform:translateX(7px)}}
@keyframes fd-otp-dot{0%,100%{opacity:0;transform:translateY(2px)}50%{opacity:.9;transform:translateY(-2px)}}
@media (max-width:420px){.fd-otp-row{gap:6px}.fd-otp-slot{width:auto}.fd-otp-cell{height:56px;font-size:24px;border-radius:12px}.fd-otp-slot[data-gap]{margin-left:8px}}
@media (prefers-reduced-motion:reduce){.fd-otp-row[data-shake]{animation:none}.fd-otp-cell,.fd-otp-cell[data-filled]:not(:focus),.fd-otp[data-status="success"] .fd-otp-cell{animation:none;transition:box-shadow 1ms,color 1ms;transform:none}.fd-otp-pulse{animation:none;opacity:.8}}
@media (prefers-contrast:more){.fd-otp-cell{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const DEMO_CODE = "482913";

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<OtpStatus>("idle");
  const [tries, setTries] = useState(3);
  const [secs, setSecs] = useState(28);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (secs <= 0) return;
    const t = window.setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [secs]);

  const verify = (c: string) => {
    setStatus("verifying");
    timer.current = window.setTimeout(() => {
      if (c === DEMO_CODE) setStatus("success");
      else {
        setStatus("error");
        setTries((t) => Math.max(0, t - 1));
        timer.current = window.setTimeout(() => {
          setCode("");
          setStatus("idle");
        }, 900);
      }
    }, 800);
  };
  const reset = () => {
    setCode("");
    setStatus("idle");
    setTries(3);
    setSecs(28);
  };

  return (
    <div className="fd-otp-demo" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-otp-demo-bar">
        <span className="fd-otp-demo-brand"><i aria-hidden="true" />Fjord Bank</span>
        <span className="fd-otp-demo-sec"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>Secure session</span>
        <button type="button" className="fd-otp-demo-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      </header>

      <main className="fd-otp-demo-main">
        <section className="fd-otp-demo-card" aria-labelledby="fd-otp-h">
          <span className="fd-otp-demo-icon" data-ok={status === "success" || undefined} aria-hidden="true">
            {status === "success" ? (
              <svg aria-hidden="true" focusable="false" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            ) : (
              <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M11 18h2" /></svg>
            )}
          </span>
          <h1 id="fd-otp-h">{status === "success" ? "Transfer approved" : "Confirm your transfer"}</h1>
          <p className="fd-otp-demo-sub">
            {status === "success" ? (
              <>$4,200.00 is on its way to <b>Ines Moreau</b>. Arrives tomorrow.</>
            ) : (
              <>Enter the 6-digit code we texted to <b>•••• ••42</b> to send <b>$4,200.00</b> to Ines Moreau.</>
            )}
          </p>

          {status !== "success" ? (
            <>
              <div className="fd-otp-demo-field">
                <OtpInput autoFocus value={code} onChange={setCode} onComplete={verify} status={status} aria-label="6-digit verification code" />
              </div>
              <p className="fd-otp-demo-msg" data-bad={status === "error" || undefined} role="status">
                {status === "error" ? `That code didn’t match. ${tries} attempt${tries === 1 ? "" : "s"} left.` : status === "verifying" ? "Verifying…" : "Codes expire after 10 minutes."}
              </p>
              <div className="fd-otp-demo-resend">
                {secs > 0 ? (
                  <span>Resend code in <b>0:{String(secs).padStart(2, "0")}</b></span>
                ) : (
                  <button type="button" onClick={() => setSecs(28)}>Resend code</button>
                )}
                <span aria-hidden="true">·</span>
                <button type="button">Call me instead</button>
              </div>
              <p className="fd-otp-demo-hint">Demo code: <code>{DEMO_CODE}</code> — or paste any 6 digits.</p>
            </>
          ) : (
            <button type="button" className="fd-otp-demo-done" onClick={reset}>Make another transfer</button>
          )}
        </section>
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-otp-demo,.fd-otp-demo *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-otp-demo,.fd-otp-demo *)::before,:where(.fd-otp-demo,.fd-otp-demo *)::after{box-sizing:border-box}
:where(.fd-otp-demo svg){display:block;flex-shrink:0}
:where(.fd-otp-demo button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-otp-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:ui-sans-serif,-apple-system,"SF Pro Display","Inter",sans-serif;--d-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-dur-2:240ms;
  --d-bg:#F2F4F7;--d-card:#fff;--d-ink:#0B0B0F;--d-mut:#6B6B76;--d-line:rgba(11,11,15,.08);--d-accent:#007AFF;--d-navy:#0B2545;
  min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.45 var(--d-font);-webkit-font-smoothing:antialiased;transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-otp-demo[data-fd-theme="dark"]{--d-bg:#07080B;--d-card:#101116;--d-ink:#F5F5F7;--d-mut:#9A9AA6;--d-line:rgba(255,255,255,.09);--d-accent:#0A84FF;--d-navy:#7FB2FF}
.fd-otp-demo-bar{display:flex;align-items:center;gap:16px;height:60px;padding:0 clamp(16px,4vw,40px)}
.fd-otp-demo-brand{display:flex;align-items:center;gap:10px;margin-right:auto;font:700 17px/1 var(--d-disp);letter-spacing:-.03em;color:var(--d-navy)}
.fd-otp-demo-brand i{display:block;width:20px;height:20px;border-radius:50% 50% 50% 4px;background:var(--d-navy)}
.fd-otp-demo-sec{display:flex;align-items:center;gap:6px;font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-otp-demo-theme{cursor:pointer;height:32px;padding:0 14px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-otp-demo-theme:hover{color:var(--d-ink)}.fd-otp-demo-theme:focus-visible,.fd-otp-demo-resend button:focus-visible,.fd-otp-demo-done:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px;border-radius:6px}
.fd-otp-demo-main{display:grid;place-items:start center;padding:clamp(24px,8vh,80px) 16px 64px}
.fd-otp-demo-card{display:flex;flex-direction:column;align-items:center;text-align:center;width:100%;max-width:480px;padding:clamp(24px,5vw,44px);border-radius:28px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line),0 1px 2px rgba(0,0,0,.04),0 32px 64px -32px rgba(0,0,0,.25)}
.fd-otp-demo-icon{display:grid;place-items:center;width:56px;height:56px;border-radius:18px;background:color-mix(in srgb,var(--d-accent) 12%,transparent);color:var(--d-accent);transition:background-color var(--fd-dur-2) var(--fd-ease-out),color var(--fd-dur-2) var(--fd-ease-out)}
.fd-otp-demo-icon[data-ok]{background:rgba(48,209,88,.16);color:#1C9A44}
.fd-otp-demo-card h1{margin-top:20px;font:600 24px/1.2 var(--d-disp);letter-spacing:-.02em}
.fd-otp-demo-sub{margin-top:10px;max-width:34ch;font:400 15px/1.5 var(--d-font);color:var(--d-mut)}.fd-otp-demo-sub b{color:var(--d-ink);font-weight:600}
.fd-otp-demo-field{margin-top:28px;max-width:100%}
.fd-otp-demo-msg{min-height:20px;margin-top:16px;font:400 14px/20px var(--d-font);color:var(--d-mut)}
.fd-otp-demo-msg[data-bad]{color:#D70015}.fd-otp-demo[data-fd-theme="dark"] .fd-otp-demo-msg[data-bad]{color:#FF6A60}
.fd-otp-demo-resend{display:flex;align-items:center;gap:10px;margin-top:20px;font:400 14px/1 var(--d-font);color:var(--d-mut)}
.fd-otp-demo-resend b{color:var(--d-ink);font-variant-numeric:tabular-nums}
.fd-otp-demo-resend button{cursor:pointer;font:500 14px/1 var(--d-font);color:var(--d-accent)}
.fd-otp-demo-hint{margin-top:28px;padding-top:20px;border-top:1px solid var(--d-line);width:100%;font:400 13px/1.4 var(--d-font);color:var(--d-mut)}
.fd-otp-demo-hint code{font:500 12.5px/1 var(--d-mono);padding:3px 6px;border-radius:6px;background:var(--d-line);color:var(--d-ink)}
.fd-otp-demo-done{margin-top:28px;cursor:pointer;height:44px;padding:0 22px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 15px/1 var(--d-font)}
`;
