/**
 * SegmentedControl — a single-choice control with a thumb that slides
 * between options on a spring (billing period, view mode, density…).
 *
 * Props: options[] ({ value, label, badge?, icon?, disabled? }), value /
 * defaultValue / onChange, size ("sm" | "md" | "lg"), fullWidth,
 * aria-label (required unless aria-labelledby), theme.
 * CSS vars: --fd-seg-accent (thumb tint), --fd-seg-radius.
 *
 * Browser support: all evergreen browsers; the thumb is positioned from
 * measured offsets (ResizeObserver) so any label width works.
 * Accessibility: role="radiogroup" with role="radio" options and a roving
 * tabindex. ArrowLeft/Right/Up/Down move AND select (like native radios),
 * Home/End jump. Reduced motion: the thumb jumps without overshoot.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export interface SegmentOption {
  value: string;
  label: ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  theme?: "light" | "dark";
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export function SegmentedControl({
  options,
  value,
  defaultValue,
  onChange,
  size = "md",
  fullWidth,
  theme,
  className,
  ...aria
}: SegmentedControlProps) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value);
  const current = value ?? inner;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const track = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const el = refs.current[current];
    if (el) setRect({ x: el.offsetLeft, w: el.offsetWidth });
  }, [current]);

  useLayoutEffect(measure, [measure, options.length]);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 30);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && track.current) ro.observe(track.current);
    Object.values(refs.current).forEach((n) => n && ro?.observe(n));
    return () => {
      window.clearTimeout(t);
      ro?.disconnect();
    };
  }, [measure]);

  const select = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };

  const onKey = (e: KeyboardEvent) => {
    const enabled = options.filter((o) => !o.disabled);
    const i = enabled.findIndex((o) => o.value === current);
    let n = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % enabled.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = enabled.length - 1;
    if (n < 0) return;
    e.preventDefault();
    const next = enabled[n];
    select(next.value);
    refs.current[next.value]?.focus();
  };

  return (
    <div className={`fd-seg${className ? " " + className : ""}`} data-size={size} data-full={fullWidth || undefined} data-ready={ready || undefined} data-fd-theme={theme}>
      <style>{css}</style>
      <div ref={track} className="fd-seg-track" role="radiogroup" onKeyDown={onKey} {...aria}>
        {rect && <span className="fd-seg-thumb" aria-hidden="true" style={{ transform: `translateX(${rect.x}px)`, width: rect.w }} />}
        {options.map((o) => {
          const on = o.value === current;
          return (
            <button
              key={o.value}
              ref={(n) => {
                refs.current[o.value] = n;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              disabled={o.disabled}
              className="fd-seg-opt"
              onClick={() => select(o.value)}
            >
              {o.icon && <span className="fd-seg-ic">{o.icon}</span>}
              <span className="fd-seg-label">{o.label}</span>
              {o.badge && <span className="fd-seg-badge">{o.badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const css = `
:where(.fd-seg,.fd-seg *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-seg,.fd-seg *)::before,:where(.fd-seg,.fd-seg *)::after{box-sizing:border-box}
:where(.fd-seg svg){display:block;flex-shrink:0}
:where(.fd-seg button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-seg{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --g-track:rgba(11,11,15,.06);--g-thumb:#fff;--g-fg:#0B0B0F;--g-mut:#6B6B76;--g-ring:rgba(0,122,255,.7);--g-badge-bg:rgba(0,122,255,.12);--g-badge-fg:#0058C7;
  --g-thumb-sh:0 0 0 .5px rgba(11,11,15,.06),0 1px 2px rgba(11,11,15,.12),0 3px 8px -2px rgba(11,11,15,.12);
  display:inline-flex;vertical-align:middle;max-width:100%;
  font:500 14px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;color:var(--g-fg);
}
[data-fd-theme="dark"] .fd-seg,.fd-seg[data-fd-theme="dark"]{--g-track:rgba(255,255,255,.07);--g-thumb:#34343D;--g-fg:#F5F5F7;--g-mut:#9A9AA6;--g-ring:rgba(10,132,255,.85);--g-badge-bg:rgba(48,209,88,.18);--g-badge-fg:#5BE382;
  --g-thumb-sh:0 1px 0 rgba(255,255,255,.08) inset,0 0 0 .5px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.4)}
.fd-seg[data-full]{display:flex;width:100%}
.fd-seg[data-size="sm"]{--g-h:28px;--g-px:12px;--g-fs:13px}
.fd-seg[data-size="md"]{--g-h:36px;--g-px:16px;--g-fs:14px}
.fd-seg[data-size="lg"]{--g-h:44px;--g-px:22px;--g-fs:15px}
.fd-seg-track{position:relative;display:inline-flex;align-items:stretch;padding:3px;border-radius:9999px;background:var(--g-track);max-width:100%;overflow-x:auto;scrollbar-width:none}
.fd-seg-track::-webkit-scrollbar{display:none}
.fd-seg[data-full] .fd-seg-track{display:flex;width:100%}
.fd-seg[data-full] .fd-seg-opt{flex:1}
.fd-seg-thumb{position:absolute;z-index:0;left:0;top:3px;bottom:3px;border-radius:9999px;background:var(--g-thumb);box-shadow:var(--g-thumb-sh);pointer-events:none;will-change:transform,width}
.fd-seg[data-ready] .fd-seg-thumb{transition:transform var(--fd-dur-3) var(--fd-spring),width var(--fd-dur-3) var(--fd-spring)}
.fd-seg-opt{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:calc(var(--g-h) - 6px);padding:0 var(--g-px);border-radius:9999px;
  appearance:none;-webkit-appearance:none;border:0;outline:0;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;background:transparent;white-space:nowrap;
  color:var(--g-mut);font-family:inherit;font-size:var(--g-fs);font-weight:500;line-height:1;letter-spacing:inherit;
  transform:scale(1);transition:color var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring)}
.fd-seg-opt[aria-checked="true"]{color:var(--g-fg)}
@media (hover:hover){.fd-seg-opt[aria-checked="false"]:hover:not(:disabled){color:var(--g-fg)}}
.fd-seg-opt:active{transform:scale(.96);transition:transform var(--fd-dur-1) var(--fd-ease-out)}
.fd-seg-opt:focus-visible{outline:2px solid var(--g-ring);outline-offset:1px}
.fd-seg-opt:disabled{opacity:.4;cursor:not-allowed}
.fd-seg-ic{display:grid;place-items:center;width:16px;height:16px}.fd-seg-ic svg{width:100%;height:100%}
.fd-seg-label{display:block}
.fd-seg-badge{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:9999px;background:var(--g-badge-bg);color:var(--g-badge-fg);font-size:11px;font-weight:600;letter-spacing:0}
@media (prefers-reduced-motion:reduce){.fd-seg[data-ready] .fd-seg-thumb{transition:transform 1ms linear,width 1ms linear}.fd-seg-opt,.fd-seg-opt:active{transition:none;transform:none}}
@media (prefers-contrast:more){.fd-seg-track{box-shadow:0 0 0 1px currentColor}.fd-seg-thumb{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

function useTween(target: number, ms = 420) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (!window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      from.current = target;
      return;
    }
    const a = from.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 4);
      const nv = a + (target - a) * e;
      from.current = nv;
      setV(nv);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const PLANS = [
  { id: "starter", name: "Starter", blurb: "For individuals tracking their first runs.", monthly: 0, yearly: 0, feats: ["3 active projects", "7-day history", "Community support"] },
  { id: "team", name: "Team", blurb: "For product teams shipping weekly.", monthly: 24, yearly: 19, popular: true, feats: ["Unlimited projects", "1-year history", "SSO and audit log", "Priority support"] },
  { id: "business", name: "Business", blurb: "For orgs with compliance needs.", monthly: 49, yearly: 39, feats: ["Everything in Team", "SAML + SCIM", "Custom data retention", "Dedicated success manager"] },
];

function Price({ plan, yearly, seats }: { plan: (typeof PLANS)[number]; yearly: boolean; seats: number }) {
  const per = useTween(yearly ? plan.yearly : plan.monthly);
  const total = per * seats;
  return (
    <div className="fd-seg-demo-price">
      <span className="fd-seg-demo-amt">${Math.round(per)}</span>
      <span className="fd-seg-demo-per">/ seat / mo</span>
      <p>{plan.monthly === 0 ? "Free forever" : `$${Math.round(total).toLocaleString("en-US")} / month for ${seats} seats${yearly ? ", billed yearly" : ""}`}</p>
    </div>
  );
}

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [billing, setBilling] = useState("yearly");
  const [seats, setSeats] = useState("10");

  return (
    <div className="fd-seg-demo" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-seg-demo-bar">
        <span className="fd-seg-demo-brand"><i />Trailhead</span>
        <button type="button" className="fd-seg-demo-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      </header>

      <main className="fd-seg-demo-main">
        <p className="fd-seg-demo-eyebrow">Pricing</p>
        <h1>Simple pricing for teams that ship.</h1>
        <p className="fd-seg-demo-sub">Start free. Upgrade when your release cadence outgrows the basics.</p>

        <div className="fd-seg-demo-controls">
          <SegmentedControl
            aria-label="Billing period"
            size="lg"
            value={billing}
            onChange={setBilling}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly", badge: "−20%" },
            ]}
          />
          <div className="fd-seg-demo-seats">
            <span id="fd-seg-seats">Seats</span>
            <SegmentedControl
              aria-labelledby="fd-seg-seats"
              size="sm"
              value={seats}
              onChange={setSeats}
              options={[{ value: "5", label: "5" }, { value: "10", label: "10" }, { value: "25", label: "25" }, { value: "50", label: "50" }]}
            />
          </div>
        </div>

        <div className="fd-seg-demo-grid">
          {PLANS.map((p) => (
            <section key={p.id} className="fd-seg-demo-plan" data-popular={p.popular || undefined} aria-labelledby={`fd-seg-${p.id}`}>
              <div className="fd-seg-demo-plan-head">
                <h2 id={`fd-seg-${p.id}`}>{p.name}</h2>
                {p.popular && <span className="fd-seg-demo-pop">Most popular</span>}
              </div>
              <p className="fd-seg-demo-blurb">{p.blurb}</p>
              <Price plan={p} yearly={billing === "yearly"} seats={Number(seats)} />
              <ul>
                {p.feats.map((f) => (
                  <li key={f}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-seg-demo,.fd-seg-demo *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-seg-demo,.fd-seg-demo *)::before,:where(.fd-seg-demo,.fd-seg-demo *)::after{box-sizing:border-box}
:where(.fd-seg-demo svg){display:block;flex-shrink:0}
:where(.fd-seg-demo button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-seg-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:ui-sans-serif,-apple-system,"SF Pro Display","Inter",sans-serif;
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-dur-2:240ms;
  --d-bg:#F7F7F9;--d-card:#fff;--d-ink:#0B0B0F;--d-mut:#6B6B76;--d-line:rgba(11,11,15,.08);--d-soft:rgba(11,11,15,.05);--d-accent:#007AFF;
  min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.45 var(--d-font);-webkit-font-smoothing:antialiased;transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-seg-demo[data-fd-theme="dark"]{--d-bg:#09090B;--d-card:#111115;--d-ink:#F5F5F7;--d-mut:#9A9AA6;--d-line:rgba(255,255,255,.09);--d-soft:rgba(255,255,255,.06);--d-accent:#0A84FF}
.fd-seg-demo-bar{display:flex;align-items:center;justify-content:space-between;height:60px;padding:0 clamp(16px,4vw,40px)}
.fd-seg-demo-brand{display:flex;align-items:center;gap:10px;font:600 17px/1 var(--d-disp);letter-spacing:-.02em}
.fd-seg-demo-brand i{display:block;width:18px;height:18px;border-radius:5px;background:var(--d-ink);clip-path:polygon(0 100%,50% 0,100% 100%)}
.fd-seg-demo-theme{cursor:pointer;height:32px;padding:0 14px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-seg-demo-theme:hover{color:var(--d-ink)}.fd-seg-demo-theme:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px}
.fd-seg-demo-main{max-width:1040px;margin:0 auto;padding:clamp(24px,6vh,64px) clamp(16px,4vw,40px) 64px;text-align:center}
.fd-seg-demo-eyebrow{font:500 13px/1 var(--d-font);color:var(--d-accent)}
.fd-seg-demo-main h1{margin-top:16px;font:600 clamp(32px,5vw,44px)/1.08 var(--d-disp);letter-spacing:-.03em}
.fd-seg-demo-sub{margin:14px auto 0;max-width:460px;font:400 17px/1.5 var(--d-font);letter-spacing:-.01em;color:var(--d-mut)}
.fd-seg-demo-controls{display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:32px}
.fd-seg-demo-seats{display:flex;align-items:center;gap:12px;font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-seg-demo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:40px;text-align:left}
.fd-seg-demo-plan{display:flex;flex-direction:column;gap:16px;padding:24px;border-radius:24px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line),0 1px 2px rgba(0,0,0,.04),0 16px 32px -24px rgba(0,0,0,.2)}
.fd-seg-demo-plan[data-popular]{box-shadow:0 0 0 1.5px var(--d-accent),0 1px 2px rgba(0,0,0,.04),0 24px 48px -24px rgba(0,122,255,.35)}
.fd-seg-demo-plan-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px}
.fd-seg-demo-plan h2{font:600 17px/1.2 var(--d-font);letter-spacing:-.01em}
.fd-seg-demo-pop{height:22px;display:inline-flex;align-items:center;padding:0 9px;border-radius:9999px;background:var(--d-accent);color:#fff;font:600 11px/1 var(--d-font)}
.fd-seg-demo-blurb{font:400 14px/1.4 var(--d-font);color:var(--d-mut);min-height:40px}
.fd-seg-demo-price{padding-bottom:16px;border-bottom:1px solid var(--d-line)}
.fd-seg-demo-amt{font:600 44px/1 var(--d-disp);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.fd-seg-demo-per{margin-left:6px;font:400 14px/1 var(--d-font);color:var(--d-mut)}
.fd-seg-demo-price p{margin-top:10px;font:400 13px/1.3 var(--d-font);color:var(--d-mut);font-variant-numeric:tabular-nums;min-height:17px}
.fd-seg-demo-plan ul{display:flex;flex-direction:column;gap:12px;font:400 14px/1.3 var(--d-font)}
.fd-seg-demo-plan li{display:flex;align-items:center;gap:10px}.fd-seg-demo-plan li svg{color:var(--d-accent)}
@media (max-width:860px){.fd-seg-demo-grid{grid-template-columns:1fr}.fd-seg-demo-blurb{min-height:0}}
`;
