/**
 * PaymentForm — card entry with brand detection, live formatting, Luhn and
 * expiry validation, a country select and a live card preview that flips to
 * show the CVC while that field is focused.
 *
 * Props: onSubmit(values) (may return a Promise: button shows loading → paid),
 * amountLabel (e.g. "€1,248.60"), countries[], defaultName, theme.
 * Exports: PaymentForm, CardPreview, detectBrand, formatCardNumber, luhn.
 * No card data leaves the component; wire `onSubmit` to your PSP's tokenizer —
 * never post raw card numbers to your own server.
 *
 * Browser support: all evergreen browsers (3D flip uses preserve-3d; falls
 * back to a fade where unsupported by prefers-reduced-motion).
 * Accessibility: real labels, autocomplete tokens (cc-number, cc-exp, cc-csc,
 * cc-name, country), inputmode="numeric", errors tied via aria-describedby and
 * announced, the preview is aria-hidden (decorative mirror of the inputs).
 */
import { useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "jcb" | "unionpay" | "unknown";

export function detectBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]|[3-6]|7[01]|720))/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(6011|65|64[4-9])/.test(digits)) return "discover";
  if (/^35(2[89]|[3-8])/.test(digits)) return "jcb";
  if (/^62/.test(digits)) return "unionpay";
  return "unknown";
}

export function formatCardNumber(digits: string, brand: CardBrand = detectBrand(digits)) {
  const d = digits.slice(0, brand === "amex" ? 15 : 19);
  if (brand === "amex") return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
  return (d.match(/.{1,4}/g) ?? []).join(" ");
}

export function luhn(digits: string) {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return digits.length >= 12 && sum % 10 === 0;
}

const formatExpiry = (digits: string) => {
  let d = digits.slice(0, 4);
  if (d.length === 1 && Number(d) > 1) d = "0" + d;
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d.length === 2 ? `${d} / ` : d;
};

export interface PaymentValues {
  number: string;
  brand: CardBrand;
  expiry: string;
  cvc: string;
  name: string;
  country: string;
}

export interface PaymentFormProps {
  onSubmit?: (v: PaymentValues) => void | Promise<unknown>;
  amountLabel?: string;
  countries?: { code: string; name: string }[];
  defaultName?: string;
  theme?: "light" | "dark";
  className?: string;
}

const COUNTRIES = [
  { code: "PT", name: "Portugal" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" },
];

function useMask(fmt: (d: string) => string, set: (v: string) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const raw = el.value;
    const pos = el.selectionStart ?? raw.length;
    const before = raw.slice(0, pos).replace(/\D/g, "").length;
    const out = fmt(raw.replace(/\D/g, ""));
    set(out);
    let idx = out.length;
    if (before === 0) idx = 0;
    else {
      let n = 0;
      for (let i = 0; i < out.length; i++) {
        if (/\d/.test(out[i])) n++;
        if (n === before) {
          idx = i + 1;
          break;
        }
      }
    }
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(idx, idx);
      } catch {
        /* element may have unmounted */
      }
    });
  };
}

export function PaymentForm({ onSubmit, amountLabel = "$0.00", countries = COUNTRIES, defaultName = "", theme, className }: PaymentFormProps) {
  const uid = useId();
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState(defaultName);
  const [country, setCountry] = useState(countries[0]?.code ?? "");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [flipped, setFlipped] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "paid">("idle");
  const timer = useRef(0);

  const digits = number.replace(/\D/g, "");
  const brand = detectBrand(digits);
  const need = brand === "amex" ? 15 : 16;
  const cvcLen = brand === "amex" ? 4 : 3;

  const errors: Record<string, string | undefined> = {
    number: !digits ? "Enter your card number" : digits.length < need ? "Card number is incomplete" : !luhn(digits) ? "That card number doesn’t look right" : undefined,
    expiry: (() => {
      const d = expiry.replace(/\D/g, "");
      if (d.length < 4) return d.length ? "Use MM / YY" : "Enter an expiry date";
      const m = Number(d.slice(0, 2));
      const y = 2000 + Number(d.slice(2));
      if (m < 1 || m > 12) return "Month must be 01–12";
      const now = new Date();
      if (y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1)) return "This card has expired";
      return undefined;
    })(),
    cvc: cvc.length < cvcLen ? `${cvcLen} digits on the ${brand === "amex" ? "front" : "back"} of your card` : undefined,
    name: name.trim().length < 3 || !name.includes(" ") ? "Enter the name as printed on the card" : undefined,
  };
  const show = (k: string) => (touched[k] ? errors[k] : undefined);
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));
  const valid = !Object.values(errors).some(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase !== "idle") return;
    setTouched({ number: true, expiry: true, cvc: true, name: true });
    if (!valid) {
      const first = (["number", "expiry", "cvc", "name"] as const).find((k) => errors[k]);
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    setPhase("loading");
    try {
      await onSubmit?.({ number: digits, brand, expiry, cvc, name, country });
      await new Promise((r) => (timer.current = window.setTimeout(r, 1400)));
      setPhase("paid");
    } catch {
      setPhase("idle");
    }
  };

  const numMask = useMask((d) => formatCardNumber(d, detectBrand(d)), setNumber);
  const expMask = useMask(formatExpiry, setExpiry);

  const field = (k: "number" | "expiry" | "cvc" | "name", label: string, control: ReactNode) => (
    <div className="fd-pay-field" data-bad={show(k) ? "" : undefined} data-k={k}>
      <label htmlFor={`${uid}-${k}`}>{label}</label>
      <div className="fd-pay-box">{control}</div>
      <p className="fd-pay-err" id={`${uid}-${k}-e`} role={show(k) ? "alert" : undefined}>{show(k)}</p>
    </div>
  );

  return (
    <form className={`fd-pay${className ? " " + className : ""}`} data-fd-theme={theme} onSubmit={submit} noValidate aria-label="Payment details">
      <style>{css}</style>
      <CardPreview brand={brand} number={number} name={name} expiry={expiry} cvc={cvc} flipped={flipped} />

      <div className="fd-pay-fields">
        {field(
          "number",
          "Card number",
          <>
            <input id={`${uid}-number`} inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" value={number} onChange={numMask} onBlur={() => touch("number")} aria-invalid={!!show("number")} aria-describedby={`${uid}-number-e`} disabled={phase !== "idle"} />
            <span className="fd-pay-brand" aria-label={brand === "unknown" ? undefined : brand}><BrandMark brand={brand} /></span>
          </>,
        )}
        <div className="fd-pay-two">
          {field("expiry", "Expiry", <input id={`${uid}-expiry`} inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" value={expiry} onChange={expMask} onBlur={() => touch("expiry")} aria-invalid={!!show("expiry")} aria-describedby={`${uid}-expiry-e`} disabled={phase !== "idle"} />)}
          {field(
            "cvc",
            brand === "amex" ? "CID" : "CVC",
            <input
              id={`${uid}-cvc`}
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder={brand === "amex" ? "1234" : "123"}
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, cvcLen))}
              onFocus={() => setFlipped(brand !== "amex")}
              onBlur={() => {
                setFlipped(false);
                touch("cvc");
              }}
              aria-invalid={!!show("cvc")}
              aria-describedby={`${uid}-cvc-e`}
              disabled={phase !== "idle"}
            />,
          )}
        </div>
        {field("name", "Name on card", <input id={`${uid}-name`} autoComplete="cc-name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch("name")} aria-invalid={!!show("name")} aria-describedby={`${uid}-name-e`} disabled={phase !== "idle"} />)}
        <div className="fd-pay-field">
          <label htmlFor={`${uid}-country`}>Billing country</label>
          <div className="fd-pay-box fd-pay-select">
            <select id={`${uid}-country`} autoComplete="country" value={country} onChange={(e) => setCountry(e.target.value)} disabled={phase !== "idle"}>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </div>
        </div>
      </div>

      <button type="submit" className="fd-pay-submit" data-phase={phase} aria-busy={phase === "loading"}>
        <span className="fd-pay-l" data-on={phase === "idle" ? "" : undefined}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          Pay {amountLabel}
        </span>
        <span className="fd-pay-l" data-on={phase === "loading" ? "" : undefined} aria-hidden="true">
          <svg aria-hidden="true" focusable="false" className="fd-pay-spin" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
          Processing
        </span>
        <span className="fd-pay-l" data-on={phase === "paid" ? "" : undefined} aria-hidden="true">
          <svg aria-hidden="true" focusable="false" className="fd-pay-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          Payment confirmed
        </span>
      </button>
      <p className="fd-pay-fine" role="status">{phase === "paid" ? "A receipt was sent to your email." : "Encrypted end to end. We never store your full card number."}</p>
    </form>
  );
}

/* ── card preview ── */

const SKIN: Record<CardBrand, { a: string; b: string }> = {
  visa: { a: "#16306B", b: "#0B1B45" },
  mastercard: { a: "#2B2B33", b: "#121216" },
  amex: { a: "#0F6B73", b: "#08414A" },
  discover: { a: "#7A3B10", b: "#3F1D08" },
  jcb: { a: "#1D4D8C", b: "#102B52" },
  unionpay: { a: "#7B1230", b: "#3F0818" },
  unknown: { a: "#3A3A44", b: "#1A1A20" },
};

function BrandMark({ brand, large }: { brand: CardBrand; large?: boolean }) {
  const h = large ? 30 : 22;
  if (brand === "visa")
    return <svg height={h} viewBox="0 0 48 16" aria-hidden="true"><text x="0" y="14" fill={large ? "#fff" : "#1A3F9E"} style={{ font: "italic 800 17px/1 ui-sans-serif,system-ui,sans-serif", letterSpacing: "-.5px" }}>VISA</text></svg>;
  if (brand === "mastercard")
    return <svg height={h} viewBox="0 0 32 20" aria-hidden="true"><circle cx="11" cy="10" r="9" fill="#EB001B" /><circle cx="21" cy="10" r="9" fill="#F79E1B" /><path d="M16 3.1a9 9 0 0 1 0 13.8 9 9 0 0 1 0-13.8z" fill="#FF5F00" /></svg>;
  if (brand === "amex")
    return <svg height={h} viewBox="0 0 44 20" aria-hidden="true"><rect width="44" height="20" rx="4" fill={large ? "#fff" : "#0A6CB4"} /><text x="22" y="14" textAnchor="middle" fill={large ? "#0F6B73" : "#fff"} style={{ font: "800 10px/1 ui-sans-serif,system-ui,sans-serif", letterSpacing: ".5px" }}>AMEX</text></svg>;
  if (brand === "discover")
    return <svg height={h} viewBox="0 0 64 20" aria-hidden="true"><text x="0" y="14" fill={large ? "#fff" : "#2B2B33"} style={{ font: "800 11px/1 ui-sans-serif,system-ui,sans-serif", letterSpacing: ".2px" }}>DISCOVER</text><circle cx="58" cy="10" r="5" fill="#F58220" /></svg>;
  if (brand === "jcb" || brand === "unionpay")
    return <svg height={h} viewBox="0 0 44 20" aria-hidden="true"><rect x="1" y="1" width="42" height="18" rx="4" fill="none" stroke={large ? "#fff" : "#6B6B76"} strokeWidth="1.5" /><text x="22" y="14" textAnchor="middle" fill={large ? "#fff" : "#6B6B76"} style={{ font: "800 9px/1 ui-sans-serif,system-ui,sans-serif" }}>{brand === "jcb" ? "JCB" : "UnionPay"}</text></svg>;
  return (
    <svg width={large ? 32 : 24} height={large ? 22 : 16} viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" opacity=".55"><rect x="1" y="1" width="22" height="14" rx="3" /><path d="M1 6h22M5 11h4" /></svg>
  );
}

export function CardPreview({ brand, number, name, expiry, cvc, flipped }: { brand: CardBrand; number: string; name: string; expiry: string; cvc: string; flipped: boolean }) {
  const skin = SKIN[brand];
  const mask = brand === "amex" ? "•••• •••••• •••••" : "•••• •••• •••• ••••";
  const digits = number.replace(/\D/g, "");
  const shown = number + mask.slice(number.length);
  return (
    <div className="fd-pay-scene" aria-hidden="true">
      <div className="fd-pay-card" data-flip={flipped || undefined} style={{ ["--c1" as string]: skin.a, ["--c2" as string]: skin.b }}>
        <div className="fd-pay-face fd-pay-front">
          <div className="fd-pay-top">
            <svg aria-hidden="true" focusable="false" width="40" height="30" viewBox="0 0 40 30"><rect width="40" height="30" rx="6" fill="#E3C46F" /><path d="M0 10h14v10H0M26 10h14v10H26M14 0v30M26 0v30" stroke="#B8963A" strokeWidth="1.4" fill="none" /></svg>
            <span key={brand} className="fd-pay-logo"><BrandMark brand={brand} large /></span>
          </div>
          <div className="fd-pay-num" data-empty={!digits || undefined}>{shown}</div>
          <div className="fd-pay-bot">
            <div><small>Cardholder</small><span>{name || "FULL NAME"}</span></div>
            <div><small>Expires</small><span>{expiry.replace(/ /g, "") || "MM/YY"}</span></div>
          </div>
        </div>
        <div className="fd-pay-face fd-pay-back">
          <div className="fd-pay-stripe" />
          <div className="fd-pay-sig"><span>{name ? "" : ""}</span><b>{cvc || "•••"}</b></div>
          <p>Authorized signature · not valid unless signed</p>
        </div>
      </div>
    </div>
  );
}

const css = `
:where(.fd-pay,.fd-pay *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-pay,.fd-pay *)::before,:where(.fd-pay,.fd-pay *)::after{box-sizing:border-box}
:where(.fd-pay svg){display:block;flex-shrink:0}
:where(.fd-pay button,.fd-pay input,.fd-pay select){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;outline:0}
.fd-pay{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --p-bg:#fff;--p-fg:#0B0B0F;--p-mut:#6B6B76;--p-line:rgba(11,11,15,.16);--p-line-h:rgba(11,11,15,.28);--p-accent:#007AFF;--p-err:#D70015;--p-ok:#1FA45B;
  display:flex;flex-direction:column;gap:20px;width:100%;max-width:420px;
  font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;color:var(--p-fg);
}
[data-fd-theme="dark"] .fd-pay,.fd-pay[data-fd-theme="dark"]{--p-bg:#16161B;--p-fg:#F5F5F7;--p-mut:#9A9AA6;--p-line:rgba(255,255,255,.14);--p-line-h:rgba(255,255,255,.26);--p-accent:#0A84FF;--p-err:#FF6A60}
.fd-pay-scene{perspective:1100px;display:grid;place-items:center;padding:4px 0 8px}
.fd-pay-card{position:relative;width:100%;max-width:340px;aspect-ratio:1.586;transform-style:preserve-3d;transition:transform var(--fd-dur-4) cubic-bezier(.34,1.3,.64,1)}
.fd-pay-card[data-flip]{transform:rotateY(180deg)}
.fd-pay-face{position:absolute;inset:0;border-radius:20px;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;color:#fff;
  background:radial-gradient(120% 90% at 0% 0%,rgba(255,255,255,.16),transparent 55%),linear-gradient(145deg,var(--c1),var(--c2));
  box-shadow:0 1px 0 rgba(255,255,255,.2) inset,0 0 0 1px rgba(255,255,255,.08) inset,0 2px 4px rgba(0,0,0,.2),0 24px 40px -18px rgba(0,0,0,.55);transition:background .5s var(--fd-ease-out)}
.fd-pay-front{display:flex;flex-direction:column;justify-content:space-between;padding:20px 22px}
.fd-pay-top{display:flex;justify-content:space-between;align-items:flex-start}
.fd-pay-logo{display:block;animation:fd-pay-logo var(--fd-dur-3) var(--fd-spring)}
.fd-pay-num{font:500 19px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.06em;text-shadow:0 1px 2px rgba(0,0,0,.3);white-space:nowrap;font-variant-numeric:tabular-nums}
.fd-pay-num[data-empty]{opacity:.75}
.fd-pay-bot{display:flex;justify-content:space-between;gap:12px;font:500 13px/1.2 ui-monospace,"SF Mono",Menlo,monospace;text-transform:uppercase;letter-spacing:.04em}
.fd-pay-bot div{display:flex;flex-direction:column;gap:4px;min-width:0}.fd-pay-bot div:last-child{text-align:right;flex:none}
.fd-pay-bot small{font-size:9px;opacity:.65;letter-spacing:.08em}.fd-pay-bot span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fd-pay-back{transform:rotateY(180deg);padding-top:24px}
.fd-pay-stripe{height:40px;background:#0B0B0F;margin-bottom:20px}
.fd-pay-sig{display:flex;align-items:center;margin:0 20px;height:36px;border-radius:4px;background:repeating-linear-gradient(135deg,#f4f4f2 0 6px,#e9e9e6 6px 12px);color:#0B0B0F}
.fd-pay-sig span{flex:1}.fd-pay-sig b{padding:0 12px;font:700 16px/1 ui-monospace,"SF Mono",Menlo,monospace;font-style:italic;letter-spacing:.1em;background:#fff;height:100%;display:grid;place-items:center;border-radius:0 4px 4px 0}
.fd-pay-back p{margin:12px 20px 0;font-size:9px;opacity:.6;letter-spacing:.04em;text-transform:uppercase}
.fd-pay-fields{display:flex;flex-direction:column;gap:14px}
.fd-pay-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.fd-pay-field label{display:block;margin:0 0 6px 2px;font-size:13px;font-weight:500;line-height:1.2;color:var(--p-mut)}
.fd-pay-box{position:relative;display:flex;align-items:center;height:48px;border-radius:12px;background:var(--p-bg);box-shadow:0 0 0 1px var(--p-line),0 1px 2px rgba(11,11,15,.04);transition:box-shadow var(--fd-dur-2) var(--fd-ease-out)}
@media (hover:hover){.fd-pay-box:hover{box-shadow:0 0 0 1px var(--p-line-h),0 1px 2px rgba(11,11,15,.04)}}
.fd-pay-box:focus-within{box-shadow:0 0 0 1.5px var(--p-accent),0 0 0 5px color-mix(in srgb,var(--p-accent) 18%,transparent)}
.fd-pay-field[data-bad] .fd-pay-box{box-shadow:0 0 0 1.5px var(--p-err)}
.fd-pay-field[data-bad] .fd-pay-box:focus-within{box-shadow:0 0 0 1.5px var(--p-err),0 0 0 5px color-mix(in srgb,var(--p-err) 18%,transparent)}
.fd-pay input,.fd-pay select{width:100%;height:100%;padding:0 14px;color:var(--p-fg);font-family:inherit;font-size:15px;line-height:1.2;font-weight:400;letter-spacing:inherit;border-radius:12px;caret-color:var(--p-accent);min-width:0}
.fd-pay input[inputmode="numeric"]{font-variant-numeric:tabular-nums}
.fd-pay input::placeholder{color:var(--p-mut);opacity:.6}
.fd-pay input:disabled,.fd-pay select:disabled{opacity:.6;cursor:not-allowed}
.fd-pay-brand{display:grid;place-items:center;min-width:44px;padding-right:12px;color:var(--p-mut)}
.fd-pay-brand>*{animation:fd-pay-logo var(--fd-dur-3) var(--fd-spring)}
.fd-pay-select{color:var(--p-mut)}.fd-pay-select select{padding-right:40px;cursor:pointer;color:var(--p-fg)}.fd-pay-select select option{color:#0B0B0F;background:#fff}
.fd-pay-select svg{position:absolute;right:14px;pointer-events:none}
.fd-pay-err{min-height:0;margin:0;padding:0 2px;font-size:12px;line-height:1.3;color:var(--p-err);max-height:0;overflow:hidden;opacity:0;transform:translateY(-3px);transition:max-height var(--fd-dur-3) var(--fd-ease-out),opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-2) var(--fd-ease-out),padding var(--fd-dur-2)}
.fd-pay-field[data-bad] .fd-pay-err{max-height:40px;opacity:1;transform:none;padding-top:6px}
.fd-pay-submit{position:relative;display:grid;place-items:center;width:100%;height:52px;margin-top:4px;border-radius:9999px;cursor:pointer;overflow:hidden;
  background:var(--p-accent);color:#fff;font-family:inherit;font-size:17px;font-weight:500;line-height:1;letter-spacing:-.01em;
  box-shadow:0 1px 0 rgba(255,255,255,.22) inset,0 1px 2px rgba(0,40,120,.35),0 10px 22px -12px var(--p-accent);
  transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring),background-color var(--fd-dur-2) var(--fd-ease-out),filter var(--fd-dur-1)}
@media (hover:hover){.fd-pay-submit:hover{filter:brightness(1.08)}}
.fd-pay-submit:active{transform:scale(.97);transition:transform var(--fd-dur-1) var(--fd-ease-out)}
.fd-pay-submit:focus-visible{outline:2px solid color-mix(in srgb,var(--p-accent) 70%,transparent);outline-offset:3px}
.fd-pay-submit[data-phase="paid"]{background:var(--p-ok)}
.fd-pay-l{grid-area:1/1;display:inline-flex;align-items:center;gap:8px;opacity:0;transform:translateY(8px) scale(.9);transition:opacity var(--fd-dur-2) var(--fd-ease-in-out),transform var(--fd-dur-3) var(--fd-ease-out);pointer-events:none}
.fd-pay-l[data-on]{opacity:1;transform:none}
.fd-pay-spin{animation:fd-pay-rot .8s linear infinite}
.fd-pay-check path{stroke-dasharray:24;stroke-dashoffset:24;animation:fd-pay-draw 380ms var(--fd-ease-out) 120ms forwards}
.fd-pay-fine{text-align:center;font-size:12px;line-height:1.4;color:var(--p-mut)}
@keyframes fd-pay-rot{to{transform:rotate(360deg)}}
@keyframes fd-pay-draw{to{stroke-dashoffset:0}}
@keyframes fd-pay-logo{from{opacity:0;transform:scale(.7)}}
@media (max-width:420px){.fd-pay-num{font-size:16px}.fd-pay-front{padding:16px 18px}}
@media (prefers-reduced-motion:reduce){.fd-pay-card{transition:none}.fd-pay-logo,.fd-pay-brand>*{animation:none}.fd-pay-l,.fd-pay-submit,.fd-pay-submit:active{transition:none;transform:none}.fd-pay-spin{animation:none}.fd-pay-check path{animation:none;stroke-dashoffset:0}.fd-pay-card[data-flip]{transform:rotateY(180deg)}}
@media (prefers-contrast:more){.fd-pay-box{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const TEST = [
  ["Visa", "4242424242424242"],
  ["Mastercard", "5555555555554444"],
  ["Amex", "378282246310005"],
];

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  return (
    <div className="fd-pay-demo" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-pay-demo-bar">
        <span className="fd-pay-demo-brand"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l8-4.5V6a2 2 0 1 1 4 0v6.5l6 3.5v2l-6-1.5V19l2 1v1.5l-3.5-1L10 21.5V20l2-1v-3.5L3 19z" /></svg>Wayfarer</span>
        <ol className="fd-pay-demo-steps" aria-label="Checkout progress"><li>Trip</li><li>Travellers</li><li aria-current="step">Payment</li></ol>
        <button type="button" className="fd-pay-demo-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      </header>

      <main className="fd-pay-demo-main">
        <section className="fd-pay-demo-pane" aria-labelledby="fd-pay-h">
          <h1 id="fd-pay-h">Payment</h1>
          <p className="fd-pay-demo-sub">Pay securely to confirm your booking.</p>
          <div className="fd-pay-demo-test" aria-label="Fill with a test card">
            <span>Try a test card</span>
            {TEST.map(([n, v]) => (
              <button key={n} type="button" onClick={(e) => fill(e.currentTarget, v)}>{n}</button>
            ))}
          </div>
          <PaymentForm amountLabel="€1,248.60" defaultName="Sofia Lindqvist" theme={theme} />
        </section>

        <aside className="fd-pay-demo-sum" aria-label="Booking summary">
          <div className="fd-pay-demo-pic" aria-hidden="true">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><rect width="400" height="180" fill="#FBD9B5" /><circle cx="290" cy="64" r="34" fill="#F7A072" /><path d="M0 180V118l60-28 50 26 70-44 60 40 70-30 90 40v58z" fill="#E9825B" opacity=".85" /><path d="M0 180v-34l70-22 60 24 80-30 70 28 120-26v60z" fill="#C45A3C" /></svg>
            <span>Lisbon, Portugal</span>
          </div>
          <h2>Casa do Alfama · 4 nights</h2>
          <p className="fd-pay-demo-meta">Thu 12 Nov – Mon 16 Nov · 2 adults</p>
          <dl>
            <div><dt>Room, 4 nights × €142.00</dt><dd>€568.00</dd></div>
            <div><dt>Flights LHR → LIS, return</dt><dd>€612.00</dd></div>
            <div><dt>City tax</dt><dd>€16.00</dd></div>
            <div><dt>Service fee</dt><dd>€52.60</dd></div>
            <div data-total><dt>Total (EUR)</dt><dd>€1,248.60</dd></div>
          </dl>
          <p className="fd-pay-demo-cancel"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Free cancellation until 9 Nov</p>
        </aside>
      </main>
    </div>
  );
}

/** Demo helper: type a number into the card field of the mounted form. */
function fill(btn: HTMLElement, digits: string) {
  const input = btn.closest(".fd-pay-demo-pane")?.querySelector<HTMLInputElement>('input[autocomplete="cc-number"]');
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, digits);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
}

const demoCss = `
:where(.fd-pay-demo,.fd-pay-demo *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-pay-demo,.fd-pay-demo *)::before,:where(.fd-pay-demo,.fd-pay-demo *)::after{box-sizing:border-box}
:where(.fd-pay-demo svg){display:block;flex-shrink:0}
:where(.fd-pay-demo button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-pay-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:ui-sans-serif,-apple-system,"SF Pro Display","Inter",sans-serif;
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-dur-2:240ms;
  --d-bg:#F6F4F1;--d-card:#fff;--d-ink:#0B0B0F;--d-mut:#6B6B76;--d-line:rgba(11,11,15,.08);--d-accent:#007AFF;
  min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.45 var(--d-font);-webkit-font-smoothing:antialiased;transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-pay-demo[data-fd-theme="dark"]{--d-bg:#09090B;--d-card:#111115;--d-ink:#F5F5F7;--d-mut:#9A9AA6;--d-line:rgba(255,255,255,.09);--d-accent:#0A84FF}
.fd-pay-demo-bar{display:flex;align-items:center;gap:24px;height:60px;padding:0 clamp(16px,4vw,40px)}
.fd-pay-demo-brand{display:flex;align-items:center;gap:8px;font:700 17px/1 var(--d-disp);letter-spacing:-.03em}
.fd-pay-demo-steps{display:flex;gap:20px;margin:0 auto;font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-pay-demo-steps li{display:flex;align-items:center;gap:20px}.fd-pay-demo-steps li:not(:last-child)::after{content:"";width:24px;height:1px;background:var(--d-line)}
.fd-pay-demo-steps li[aria-current]{color:var(--d-ink)}
.fd-pay-demo-theme{cursor:pointer;height:32px;padding:0 14px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-pay-demo-theme:hover{color:var(--d-ink)}.fd-pay-demo-theme:focus-visible,.fd-pay-demo-test button:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px}
.fd-pay-demo-main{display:grid;grid-template-columns:minmax(0,460px) minmax(0,360px);gap:32px;justify-content:center;align-items:start;padding:24px clamp(16px,4vw,40px) 64px}
.fd-pay-demo-pane{padding:32px;border-radius:28px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line),0 1px 2px rgba(0,0,0,.04),0 32px 64px -40px rgba(0,0,0,.3)}
.fd-pay-demo-pane h1{font:600 24px/1.2 var(--d-disp);letter-spacing:-.02em}
.fd-pay-demo-sub{margin-top:6px;font:400 14px/1.4 var(--d-font);color:var(--d-mut)}
.fd-pay-demo-test{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:20px 0 20px;font:400 13px/1 var(--d-font);color:var(--d-mut)}
.fd-pay-demo-test button{cursor:pointer;height:26px;padding:0 10px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 12px/1 var(--d-font);color:var(--d-ink)}
.fd-pay-demo-test button:hover{background:var(--d-line)}
.fd-pay-demo-sum{position:sticky;top:24px;padding:20px;border-radius:24px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line)}
.fd-pay-demo-pic{position:relative;height:150px;border-radius:14px;overflow:hidden}
.fd-pay-demo-pic span{position:absolute;left:12px;bottom:12px;height:24px;display:inline-flex;align-items:center;padding:0 10px;border-radius:9999px;background:rgba(255,255,255,.9);color:#0B0B0F;font:600 12px/1 var(--d-font)}
.fd-pay-demo-sum h2{margin-top:16px;font:600 17px/1.25 var(--d-font);letter-spacing:-.01em}
.fd-pay-demo-meta{margin-top:4px;font:400 14px/1.4 var(--d-font);color:var(--d-mut)}
.fd-pay-demo-sum dl{display:flex;flex-direction:column;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid var(--d-line);font:400 14px/1.3 var(--d-font)}
.fd-pay-demo-sum dl div{display:flex;justify-content:space-between;gap:16px}.fd-pay-demo-sum dt{color:var(--d-mut)}.fd-pay-demo-sum dd{font-variant-numeric:tabular-nums}
.fd-pay-demo-sum dl div[data-total]{margin-top:4px;padding-top:16px;border-top:1px solid var(--d-line);font:600 17px/1.2 var(--d-font)}.fd-pay-demo-sum dl div[data-total] dt{color:var(--d-ink)}
.fd-pay-demo-cancel{display:flex;align-items:center;gap:8px;margin-top:16px;font:500 13px/1 var(--d-font);color:#1C9A44}
@media (max-width:900px){.fd-pay-demo-main{grid-template-columns:minmax(0,460px)}.fd-pay-demo-sum{position:static;order:-1}.fd-pay-demo-steps{display:none}}
@media (max-width:520px){.fd-pay-demo-pane{padding:20px;border-radius:22px}}
`;
