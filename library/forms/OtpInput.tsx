/**
 * OtpInput, one-time-code entry (default 6 digits) with auto-advance,
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

export function Demo() {
  const [code, setCode] = useState("482");
  const [status, setStatus] = useState<OtpStatus>("idle");
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Any complete code is accepted, except one repeated digit (try 111111 to see the error state).
  const verify = (c: string) => {
    setStatus("verifying");
    timer.current = window.setTimeout(() => {
      const bad = /^(\d)\1+$/.test(c);
      setStatus(bad ? "error" : "success");
      timer.current = window.setTimeout(() => {
        setCode("");
        setStatus("idle");
      }, bad ? 900 : 1800);
    }, 800);
  };

  return (
    <div className="fd-otpd">
      <style>{demoCss}</style>
      <OtpInput theme="light" value={code} onChange={setCode} onComplete={verify} status={status} aria-label="6-digit verification code" />
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-otpd,.fd-otpd *,.fd-otpd *::before,.fd-otpd *::after{box-sizing:border-box}
.fd-otpd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;color:#1d1d1f;font:400 15px/1.4 ${F};letter-spacing:normal;background:#f1f1f2}
`;
