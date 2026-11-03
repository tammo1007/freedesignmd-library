/**
 * PricingTiersToggle, three-plan B2B pricing section with a monthly / yearly
 * segmented switch. Prices roll like an odometer when the billing period
 * changes, a hand-drawn proof mark annotates the yearly saving, and the
 * recommended plan is set apart by structure (an inverted column that breaks
 * the top rule and carries its own tab), not by a glow.
 *
 * Props: plans (name, audience, monthly price, yearly price per month, limits,
 * features, cta, recommended?, note?), eyebrow, title, lede, currency,
 * unit (e.g. "editor / mo"), saveNote, footer (string[]), defaultPeriod.
 * CSS vars: --fd-ptt-paper, --fd-ptt-ink, --fd-ptt-signal.
 *
 * Browser support: all evergreen browsers.
 * Accessibility: the billing switch is a radiogroup (arrow keys move between
 * options); each price has a visually hidden full sentence and a polite live
 * region announces the period change. Odometer digits are aria-hidden.
 * Reduced motion: digits swap instantly, the switch thumb jumps.
 */
import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export type Period = "monthly" | "yearly";

export interface TierPlan {
  id: string;
  name: string;
  audience: string;
  /** Price per unit when billed monthly. */
  monthly: number;
  /** Price per unit per month when billed yearly. */
  yearly: number;
  limits: [string, string][];
  featuresTitle?: string;
  features: string[];
  cta: { label: string; href: string };
  recommended?: boolean;
  /** Short tab text shown on the recommended plan. */
  note?: string;
}

export interface PricingTiersToggleProps {
  plans?: TierPlan[];
  eyebrow?: string;
  title?: string;
  lede?: string;
  currency?: string;
  unit?: string;
  saveNote?: string;
  footer?: string[];
  defaultPeriod?: Period;
  className?: string;
}

const PLANS: TierPlan[] = [
  {
    id: "reviewer",
    name: "Reviewer",
    audience: "Freelancers and two-person studios shipping to a handful of clients.",
    monthly: 12,
    yearly: 10,
    limits: [
      ["Active projects", "3"],
      ["Version history", "30 days"],
      ["Guest reviewers", "5 per project"],
      ["Asset storage", "20 GB"],
    ],
    features: ["Review Figma frames, PDFs and live URLs", "Pin comments to pixels, not pages", "Export comments as CSV or PDF"],
    cta: { label: "Start 14-day trial", href: "#trial" },
  },
  {
    id: "studio",
    name: "Studio",
    audience: "In-house teams of 5 to 40 editors with a real approval process.",
    monthly: 24,
    yearly: 20,
    recommended: true,
    note: "Picked by 61% of teams with 10+ editors",
    limits: [
      ["Active projects", "Unlimited"],
      ["Version history", "1 year"],
      ["Guest reviewers", "Unlimited"],
      ["Asset storage", "200 GB"],
    ],
    featuresTitle: "Everything in Reviewer, plus",
    features: ["Approval stages with named sign-off (up to 3)", "Two-way sync with Slack, Linear and Jira", "Side-by-side version diff with overlay slider", "Due dates and reminders for late reviewers"],
    cta: { label: "Start 14-day trial", href: "#trial" },
  },
  {
    id: "agency",
    name: "Agency",
    audience: "Agencies running review rooms for many clients at once.",
    monthly: 48,
    yearly: 40,
    limits: [
      ["Client workspaces", "Unlimited, own branding"],
      ["Version history", "Forever"],
      ["Single sign-on", "SAML + SCIM"],
      ["Asset storage", "1 TB"],
    ],
    featuresTitle: "Everything in Studio, plus",
    features: ["Custom review domain (review.yourstudio.com)", "Audit log with 7-year retention", "99.9% uptime SLA, credits if we miss"],
    cta: { label: "Book a 20-minute demo", href: "#demo" },
  },
];

const FOOTER = ["Clients and stakeholders comment free, always", "14-day trial, no card", "Hosted in Frankfurt, EU data residency"];

function Odometer({ value }: { value: number }) {
  const s = String(value);
  return (
    <span className="fd-ptt-odo" aria-hidden="true">
      {s.split("").map((d, i) => (
        <span className="fd-ptt-dig" key={s.length - i}>
          <span className="fd-ptt-strip" style={{ transform: `translateY(${-Number(d) * 10}%)`, transitionDelay: `${i * 70}ms` }}>
            {"0123456789".split("").map((n) => (
              <span key={n}>{n}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

export function PricingTiersToggle({
  plans = PLANS,
  eyebrow = "Pricing, per editor seat",
  title = "Reviewers are free. You pay for the people who ship.",
  lede = "Every plan includes unlimited commenters. Count only the designers, writers and PMs who upload work.",
  currency = "$",
  unit = "editor / mo",
  saveNote = "2 months free",
  footer = FOOTER,
  defaultPeriod = "yearly",
  className,
}: PricingTiersToggleProps) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [live, setLive] = useState("");
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const order: Period[] = ["monthly", "yearly"];

  const choose = (p: Period) => {
    setPeriod(p);
    setLive(p === "yearly" ? "Showing yearly prices, two months free." : "Showing monthly prices.");
  };
  const onKey = (e: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = period === "monthly" ? "yearly" : "monthly";
    choose(next);
    btns.current[order.indexOf(next)]?.focus();
  };

  return (
    <section className={`fd-ptt${className ? " " + className : ""}`} aria-labelledby={`${uid}-t`}>
      <style>{css}</style>
      <div className="fd-ptt-head">
        <div className="fd-ptt-intro">
          <p className="fd-ptt-eyebrow">{eyebrow}</p>
          <h2 className="fd-ptt-title" id={`${uid}-t`}>{title}</h2>
          <p className="fd-ptt-lede">{lede}</p>
        </div>
        <div className="fd-ptt-billing">
          <div className="fd-ptt-seg" role="radiogroup" aria-label="Billing period" data-p={period} onKeyDown={onKey}>
            <span className="fd-ptt-thumb" aria-hidden="true" />
            {order.map((p, i) => (
              <button
                key={p}
                ref={(el) => {
                  btns.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={period === p}
                tabIndex={period === p ? 0 : -1}
                className="fd-ptt-opt"
                onClick={() => choose(p)}
              >
                {p === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
          <span className="fd-ptt-save" data-on={period === "yearly" ? "" : undefined}>
            <svg width="46" height="30" viewBox="0 0 46 30" fill="none" aria-hidden="true">
              <path className="fd-ptt-arrow" d="M44 26C30 27 14 22 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path className="fd-ptt-arrow" d="M3 11.5L6.6 5 12.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{saveNote}</span>
          </span>
        </div>
      </div>

      <ol className="fd-ptt-grid">
        {plans.map((p, idx) => {
          const price = period === "yearly" ? p.yearly : p.monthly;
          const billed = period === "yearly" ? `Billed ${currency}${p.yearly * 12} per editor yearly` : `Billed monthly, cancel any time`;
          return (
            <li key={p.id} className="fd-ptt-plan" data-rec={p.recommended ? "" : undefined}>
              {p.recommended && <p className="fd-ptt-tab">{p.note ?? "Recommended"}</p>}
              <div className="fd-ptt-top">
                <span className="fd-ptt-num">{String(idx + 1).padStart(2, "0")}</span>
                <h3 className="fd-ptt-name">{p.name}</h3>
              </div>
              <p className="fd-ptt-aud">{p.audience}</p>
              <div className="fd-ptt-price">
                <span className="fd-ptt-cur" aria-hidden="true">{currency}</span>
                <Odometer value={price} />
                <span className="fd-ptt-unit" aria-hidden="true">{unit}</span>
                <span className="fd-ptt-sr">
                  {currency}
                  {price} per {unit.replace("/", "per")}, {billed}
                </span>
              </div>
              <p className="fd-ptt-billed" aria-hidden="true">
                {period === "yearly" && <s>{currency}{p.monthly}</s>} {billed}
              </p>
              <a className="fd-ptt-cta" href={p.cta.href}>
                {p.cta.label}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <dl className="fd-ptt-limits">
                {p.limits.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              {p.featuresTitle && <p className="fd-ptt-ftitle">{p.featuresTitle}</p>}
              <ul className="fd-ptt-feats">
                {p.features.map((f) => (
                  <li key={f}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M2 7.6l3.1 3L12 3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      <ul className="fd-ptt-foot">
        {footer.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div className="fd-ptt-sr" role="status" aria-live="polite">{live}</div>
    </section>
  );
}

const css = `
:where(.fd-ptt,.fd-ptt *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-ptt,.fd-ptt *)::before,:where(.fd-ptt,.fd-ptt *)::after{box-sizing:border-box}
:where(.fd-ptt svg){display:block;flex-shrink:0}
:where(.fd-ptt button){appearance:none;-webkit-appearance:none;cursor:pointer;border-radius:0}
.fd-ptt{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-ptt-paper:#F3F0E8;--fd-ptt-ink:#17160F;--fd-ptt-signal:#D9381E;
  --mut:#6B675C;--line:rgba(23,22,15,.14);--line2:rgba(23,22,15,.85);
  --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  display:block;width:100%;background:var(--fd-ptt-paper);color:var(--fd-ptt-ink);
  font:400 15px/22px var(--sans);letter-spacing:-.003em;-webkit-font-smoothing:antialiased;
  padding:clamp(48px,7vw,96px) clamp(16px,4vw,56px) clamp(48px,6vw,80px)}
.fd-ptt-head{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:32px 48px;padding-bottom:clamp(48px,6vw,72px)}
.fd-ptt-eyebrow{font:500 12px/16px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--mut)}
.fd-ptt-title{margin-top:16px;max-width:15ch;font:700 clamp(2.25rem,5vw,4rem)/1 var(--sans);letter-spacing:-.045em}
.fd-ptt-lede{margin-top:20px;max-width:46ch;font-size:1.0625rem;line-height:26px;color:var(--mut)}
.fd-ptt-billing{position:relative;padding-bottom:6px}
.fd-ptt-seg{position:relative;display:grid;grid-template-columns:1fr 1fr;width:240px;height:48px;padding:4px;border-radius:9999px;background:#E6E1D4;box-shadow:inset 0 0 0 1px var(--line)}
.fd-ptt-thumb{position:absolute;top:4px;left:4px;width:calc(50% - 4px);height:40px;border-radius:9999px;background:var(--fd-ptt-ink);transition:transform var(--fd-dur-3) var(--fd-spring)}
.fd-ptt-seg[data-p="yearly"] .fd-ptt-thumb{transform:translateX(100%)}
.fd-ptt-opt{position:relative;z-index:1;height:40px;border-radius:9999px;font:600 14px/40px var(--sans);letter-spacing:-.005em;color:var(--fd-ptt-ink);transition:color var(--fd-dur-2) var(--fd-ease-in-out)}
.fd-ptt-opt[aria-checked="true"]{color:var(--fd-ptt-paper)}
.fd-ptt-opt:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-ptt-signal) 70%,transparent);outline-offset:2px}
.fd-ptt-save{position:absolute;right:-8px;top:calc(100% + 2px);display:flex;align-items:flex-start;gap:4px;color:var(--fd-ptt-signal);font:italic 500 15px/18px "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;white-space:nowrap;opacity:.35;transition:opacity var(--fd-dur-2)}
.fd-ptt-save span{padding-top:16px}
.fd-ptt-save[data-on]{opacity:1}
.fd-ptt-save svg{transform:translateX(-4px)}
.fd-ptt-arrow{stroke-dasharray:60;stroke-dashoffset:60;transition:stroke-dashoffset var(--fd-dur-4) var(--fd-ease-out)}
.fd-ptt-save[data-on] .fd-ptt-arrow{stroke-dashoffset:0}

.fd-ptt-grid{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1.12fr 1fr;border-top:1.5px solid var(--line2)}
.fd-ptt-plan{position:relative;display:flex;flex-direction:column;padding:32px clamp(20px,2.4vw,36px) 40px;border-left:1px solid var(--line)}
.fd-ptt-plan:first-child{border-left:0;padding-left:0}
.fd-ptt-plan:last-child{padding-right:0}
.fd-ptt-plan[data-rec]{margin-top:-28px;padding-top:28px;padding-left:clamp(24px,2.8vw,40px);padding-right:clamp(24px,2.8vw,40px);background:var(--fd-ptt-ink);color:var(--fd-ptt-paper);border-left:0;--mut:#ADA898;--line:rgba(243,240,232,.16)}
.fd-ptt-plan[data-rec]+.fd-ptt-plan{border-left:0}
.fd-ptt-tab{position:absolute;left:0;bottom:100%;padding:7px 12px 6px clamp(24px,2.8vw,40px);width:100%;background:var(--fd-ptt-signal);color:#fff;font:500 11px/16px var(--mono);letter-spacing:.03em;text-transform:uppercase}
.fd-ptt-top{display:flex;align-items:baseline;gap:12px}
.fd-ptt-num{font:500 12px/16px var(--mono);color:var(--mut)}
.fd-ptt-name{font:700 1.5rem/32px var(--sans);letter-spacing:-.025em}
.fd-ptt-aud{margin-top:8px;min-height:44px;max-width:34ch;font-size:.875rem;line-height:22px;color:var(--mut)}
.fd-ptt-price{position:relative;display:flex;align-items:flex-start;margin-top:28px;height:72px}
.fd-ptt-cur{font:600 1.5rem/32px var(--sans);margin-top:6px;margin-right:2px}
.fd-ptt-odo{display:flex;font:700 4.5rem/72px var(--sans);letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.fd-ptt-dig{display:block;height:72px;overflow:hidden}
.fd-ptt-strip{display:flex;flex-direction:column;transition:transform var(--fd-dur-4) var(--fd-ease-in-out)}
.fd-ptt-strip span{display:block;height:72px}
.fd-ptt-unit{align-self:flex-end;margin:0 0 10px 8px;font:500 12px/16px var(--mono);color:var(--mut)}
.fd-ptt-billed{margin-top:8px;font:400 12px/18px var(--mono);color:var(--mut)}
.fd-ptt-billed s{text-decoration:line-through;text-decoration-color:var(--fd-ptt-signal);text-decoration-thickness:1.5px;margin-right:4px}
.fd-ptt-cta{display:inline-flex;align-items:center;justify-content:space-between;gap:12px;margin-top:24px;height:48px;padding:0 18px 0 20px;border-radius:9999px;font:600 15px/48px var(--sans);letter-spacing:-.01em;color:var(--fd-ptt-ink);box-shadow:inset 0 0 0 1.5px var(--fd-ptt-ink);transition:background-color var(--fd-dur-1),color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-ptt-cta svg{transition:transform var(--fd-dur-2) var(--fd-ease-out)}
.fd-ptt-cta:hover{background:var(--fd-ptt-ink);color:var(--fd-ptt-paper)}
.fd-ptt-cta:hover svg{transform:translateX(3px)}
.fd-ptt-cta:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-ptt-cta:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-ptt-signal) 70%,transparent);outline-offset:2px}
.fd-ptt-plan[data-rec] .fd-ptt-cta{background:var(--fd-ptt-paper);color:var(--fd-ptt-ink);box-shadow:none}
.fd-ptt-plan[data-rec] .fd-ptt-cta:hover{background:var(--fd-ptt-signal);color:#fff}
.fd-ptt-limits{margin-top:32px;border-top:1px solid var(--line)}
.fd-ptt-limits div{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px dashed var(--line);font:400 12px/18px var(--mono)}
.fd-ptt-limits dt{color:var(--mut)}
.fd-ptt-limits dd{text-align:right;font-weight:600}
.fd-ptt-ftitle{margin-top:24px;font:500 11px/16px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--mut)}
.fd-ptt-feats{display:grid;gap:10px;margin-top:14px}
.fd-ptt-plan:not([data-rec]) .fd-ptt-feats:first-of-type{margin-top:24px}
.fd-ptt-feats li{display:flex;gap:10px;font-size:.875rem;line-height:20px}
.fd-ptt-feats svg{margin-top:3px;color:var(--fd-ptt-signal)}
.fd-ptt-foot{max-width:1200px;margin:0 auto;display:flex;flex-wrap:wrap;gap:8px 28px;padding-top:24px;border-top:1px solid var(--line);font:400 12px/18px var(--mono);color:var(--mut)}
.fd-ptt-foot li{display:flex;align-items:center;gap:8px}
.fd-ptt-foot li::before{content:"";display:block;width:6px;height:6px;background:var(--fd-ptt-signal)}
.fd-ptt-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:900px){
  .fd-ptt-head{grid-template-columns:1fr;padding-bottom:72px}
  .fd-ptt-grid{grid-template-columns:1fr;border-top:0}
  .fd-ptt-plan,.fd-ptt-plan:first-child,.fd-ptt-plan:last-child{padding:28px 0 36px;border-left:0;border-top:1.5px solid var(--line2)}
  .fd-ptt-plan[data-rec]{margin:40px -16px 0;padding:28px 16px 36px;border-top:0}
  .fd-ptt-plan[data-rec]+.fd-ptt-plan{border-top:0}
  .fd-ptt-tab{padding-left:16px}
  .fd-ptt-aud{min-height:0}
  .fd-ptt-foot{margin-top:8px}
}
@media (prefers-reduced-motion:reduce){.fd-ptt *{transition-duration:1ms!important;transition-delay:0ms!important}}
@media (prefers-contrast:more){.fd-ptt{--line:currentColor}}
`;

export function Demo() {
  return (
    <div className="fd-pttd">
      <style>{demoCss}</style>
      <header className="fd-pttd-nav">
        <a className="fd-pttd-logo" href="#home" aria-label="Redline home">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="20" height="20" stroke="currentColor" strokeWidth="2" />
            <path d="M-1 15L23 7" stroke="#D9381E" strokeWidth="2.4" />
          </svg>
          redline
        </a>
        <nav className="fd-pttd-links" aria-label="Main">
          <a href="#product">Product</a>
          <a href="#customers">Customers</a>
          <a href="#pricing" aria-current="page">Pricing</a>
          <a href="#changelog">Changelog</a>
        </nav>
        <a className="fd-pttd-sign" href="#login">Sign in</a>
      </header>
      <PricingTiersToggle />
    </div>
  );
}

const demoCss = `
:where(.fd-pttd,.fd-pttd *){box-sizing:border-box;margin:0;padding:0;font:inherit;color:inherit;text-decoration:none}
.fd-pttd{min-height:100vh;background:#F3F0E8;color:#17160F;font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif}
.fd-pttd-nav{max-width:1312px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:24px;height:64px;padding:0 clamp(16px,4vw,56px);border-bottom:1px solid rgba(23,22,15,.14)}
.fd-pttd-logo{display:flex;align-items:center;gap:10px;font:800 19px/24px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter",sans-serif;letter-spacing:-.05em}
.fd-pttd-logo svg{display:block;overflow:visible}
.fd-pttd-links{display:flex;gap:28px;font-weight:500;color:#6B675C}
.fd-pttd-links a[aria-current]{color:#17160F}
.fd-pttd-links a:hover{color:#17160F}
.fd-pttd-sign{font-weight:600}
@media (max-width:700px){.fd-pttd-links{display:none}}
`;
