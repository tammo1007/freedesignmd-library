/**
 * PricingComparisonTable — a plan comparison grid with a sticky first column,
 * sticky plan headers, check / dash / text cells, group headings and a
 * highlighted recommended column.
 *
 * Props: plans, groups, billing ("monthly" | "yearly"), onSelect(planId),
 * maxHeight, theme.
 * Plan: { id, name, blurb, price: { monthly, yearly } | string, cta,
 *         recommended?, badge? }   (a string price renders as-is, e.g. "Custom")
 * Group: { title, rows: [{ label, hint?, values: Record<planId, boolean | string> }] }
 *
 * Browser support: all evergreen browsers (position: sticky on table cells).
 * Accessibility: a real <table> — plan names are column headers, feature
 * labels are row headers (scope="row"), group titles are <th scope="rowgroup">;
 * check cells expose "Included" and dash cells "Not included" to screen
 * readers; the scroll area is focusable with a label so keyboard users can pan
 * it; CTAs name their plan ("Choose Team").
 * Reduced motion: price swaps and hover transitions are instant.
 */
import { useState, type ReactNode } from "react";

export interface PricingPlan {
  id: string;
  name: string;
  blurb?: string;
  price: { monthly: number; yearly: number } | string;
  cta: string;
  recommended?: boolean;
  badge?: string;
}
export interface PricingRow { label: string; hint?: string; values: Record<string, boolean | string> }
export interface PricingGroup { title: string; rows: PricingRow[] }

export interface PricingComparisonTableProps {
  plans: PricingPlan[];
  groups: PricingGroup[];
  billing?: "monthly" | "yearly";
  onSelect?: (planId: string) => void;
  maxHeight?: number;
  caption?: string;
  theme?: "light" | "dark";
  className?: string;
}

function Cell({ v }: { v: boolean | string | undefined }): ReactNode {
  if (v === true)
    return (
      <>
        <svg className="fd-pc-check" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9.4l3.2 3.2L14 5.6" /></svg>
        <span className="fd-pc-sr">Included</span>
      </>
    );
  if (!v)
    return (
      <>
        <span className="fd-pc-dash" aria-hidden="true" />
        <span className="fd-pc-sr">Not included</span>
      </>
    );
  return <span className="fd-pc-txt">{v}</span>;
}

export function PricingComparisonTable({ plans, groups, billing = "monthly", onSelect, maxHeight = 640, caption = "Plan comparison", theme, className }: PricingComparisonTableProps) {
  const [hs, setHs] = useState(false);
  return (
    <div className={`fd-pc${className ? " " + className : ""}`} data-fd-theme={theme}>
      <style>{css}</style>
      <div className="fd-pc-card">
        <div className="fd-pc-scroll" style={{ maxHeight }} data-hs={hs ? "" : undefined} onScroll={(e) => setHs(e.currentTarget.scrollLeft > 2)} role="region" aria-label={`${caption}, scrollable`} tabIndex={0}>
          <table className="fd-pc-table" style={{ ["--cols" as string]: plans.length }}>
            <caption className="fd-pc-sr">{caption}</caption>
            <thead>
              <tr>
                <th scope="col" className="fd-pc-corner"><span className="fd-pc-sr">Features</span><span className="fd-pc-ctitle" aria-hidden="true">Compare plans</span></th>
                {plans.map((p) => (
                  <th key={p.id} scope="col" className="fd-pc-ph" data-rec={p.recommended ? "" : undefined}>
                    <div className="fd-pc-pi">
                      {p.recommended ? <span className="fd-pc-badge">{p.badge ?? "Most popular"}</span> : <span className="fd-pc-badge" data-ghost="" aria-hidden="true" />}
                      <span className="fd-pc-name">{p.name}</span>
                      <span className="fd-pc-price" key={typeof p.price === "string" ? p.price : billing}>
                        {typeof p.price === "string" ? (
                          <b className="fd-pc-amt fd-pc-custom">{p.price}</b>
                        ) : (
                          <>
                            <b className="fd-pc-amt">{p.price[billing] === 0 ? "$0" : `$${p.price[billing]}`}</b>
                            <small>{p.price[billing] === 0 ? "forever" : `/ user / mo${billing === "yearly" ? ", billed yearly" : ""}`}</small>
                          </>
                        )}
                      </span>
                      <button type="button" className="fd-pc-cta" data-rec={p.recommended ? "" : undefined} onClick={() => onSelect?.(p.id)} aria-label={`${p.cta}: ${p.name} plan`}>
                        {p.cta}
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((g, gi) => (
              <tbody key={g.title}>
                <tr className="fd-pc-gr">
                  <th scope="rowgroup" className="fd-pc-gh">{g.title}</th>
                  <td colSpan={plans.length} className="fd-pc-gfill" />
                </tr>
                {g.rows.map((r, ri) => (
                  <tr key={r.label} className="fd-pc-row">
                    <th scope="row" className="fd-pc-rh">
                      <span className="fd-pc-label">{r.label}</span>
                      {r.hint && <small>{r.hint}</small>}
                    </th>
                    {plans.map((p) => (
                      <td key={p.id} className="fd-pc-td" data-rec={p.recommended ? "" : undefined} data-last={gi === groups.length - 1 && ri === g.rows.length - 1 ? "" : undefined}>
                        <Cell v={r.values[p.id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </div>
  );
}

const css = `
:where(.fd-pc,.fd-pc *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-pc,.fd-pc *)::before,:where(.fd-pc,.fd-pc *)::after{box-sizing:border-box}
:where(.fd-pc svg){display:block;flex-shrink:0}
:where(.fd-pc button){appearance:none;-webkit-appearance:none;outline:0;border-radius:0;cursor:pointer}
:where(.fd-pc table){border-collapse:separate;border-spacing:0}
.fd-pc{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --p-bg:#fff;--p-fg:#14131A;--p-mut:#6B6978;--p-line:rgba(20,19,26,.08);--p-line2:rgba(20,19,26,.16);--p-group:#F8F7FB;--p-accent:#6D28D9;--p-accent2:#8B5CF6;--p-tint:rgba(109,40,217,.045);--p-tintline:rgba(109,40,217,.28);--p-on:#fff;--p-ring:rgba(109,40,217,.5);--p-ok:#15803D;
  width:100%;font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.006em;color:var(--p-fg);-webkit-font-smoothing:antialiased}
[data-fd-theme="dark"].fd-pc,[data-fd-theme="dark"] .fd-pc{--p-bg:#121118;--p-fg:#F2F1F7;--p-mut:#9C99AA;--p-line:rgba(255,255,255,.07);--p-line2:rgba(255,255,255,.15);--p-group:#17161E;--p-accent:#A78BFA;--p-accent2:#C4B5FD;--p-tint:rgba(167,139,250,.07);--p-tintline:rgba(167,139,250,.35);--p-on:#16102B;--p-ring:rgba(167,139,250,.6);--p-ok:#4ADE80}
.fd-pc-card{border-radius:20px;background:var(--p-bg);overflow:hidden;box-shadow:0 0 0 1px var(--p-line),0 1px 2px rgba(20,19,26,.04),0 20px 48px -24px rgba(20,19,26,.2)}
.fd-pc-scroll{overflow:auto;overscroll-behavior:contain}.fd-pc-scroll:focus-visible{outline:2px solid var(--p-ring);outline-offset:-2px}
.fd-pc-table{width:100%;min-width:760px;table-layout:fixed}
.fd-pc-corner{position:sticky;left:0;top:0;z-index:4;width:272px;padding:0 24px;vertical-align:bottom;text-align:left;background:var(--p-bg);box-shadow:inset 0 -1px 0 var(--p-line2)}
.fd-pc-ctitle{display:block;padding-bottom:20px;font-size:13px;line-height:16px;font-weight:600;color:var(--p-mut)}
.fd-pc-ph{position:sticky;top:0;z-index:3;padding:0 12px;vertical-align:top;text-align:left;background:var(--p-bg);box-shadow:inset 0 -1px 0 var(--p-line2)}
.fd-pc-ph[data-rec]{background:linear-gradient(var(--p-tint),var(--p-tint)),var(--p-bg);box-shadow:inset 0 -1px 0 var(--p-line2),inset 1px 0 0 var(--p-tintline),inset -1px 0 0 var(--p-tintline),inset 0 2px 0 var(--p-accent)}
.fd-pc-pi{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-height:176px;padding:22px 0 20px 8px}
.fd-pc-badge{align-self:flex-start;height:20px;padding:0 8px;border-radius:9999px;margin:-2px 0 4px;font-size:11px;line-height:20px;font-weight:600;letter-spacing:.01em;color:var(--p-on);background:linear-gradient(135deg,var(--p-accent),var(--p-accent2))}
.fd-pc-badge[data-ghost]{background:none}
.fd-pc-name{font-size:15px;line-height:20px;font-weight:600;letter-spacing:-.015em}
.fd-pc-price{display:flex;flex-direction:column;gap:0;min-height:60px;margin-bottom:12px;animation:fd-pc-swap var(--fd-dur-3) var(--fd-ease-out)}
.fd-pc-amt{font-size:32px;line-height:40px;font-weight:600;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.fd-pc-custom{font-size:28px}
.fd-pc-price small{font-size:12px;line-height:16px;font-weight:400;color:var(--p-mut)}
.fd-pc-ph:not([data-rec]) .fd-pc-price{margin-bottom:12px}
.fd-pc-cta{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 16px;border-radius:10px;font-size:13px;font-weight:600;line-height:1;white-space:nowrap;color:var(--p-fg);background:var(--p-bg);box-shadow:inset 0 0 0 1px var(--p-line2),0 1px 2px rgba(20,19,26,.05);transition:transform var(--fd-dur-3) var(--fd-spring),background-color var(--fd-dur-1),box-shadow var(--fd-dur-1),filter var(--fd-dur-1)}
@media (hover:hover){.fd-pc-cta:hover{background:var(--p-group);box-shadow:inset 0 0 0 1px var(--p-mut),0 1px 2px rgba(20,19,26,.06)}}
.fd-pc-cta:active{transform:scale(.96)}
.fd-pc-cta[data-rec]{color:var(--p-on);background:linear-gradient(180deg,var(--p-accent2),var(--p-accent));box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 1px 2px rgba(109,40,217,.4),0 6px 16px -6px rgba(109,40,217,.5)}
@media (hover:hover){.fd-pc-cta[data-rec]:hover{background:linear-gradient(180deg,var(--p-accent2),var(--p-accent));filter:brightness(1.08)}}
.fd-pc-cta:focus-visible{box-shadow:0 0 0 2px var(--p-bg),0 0 0 4px var(--p-ring)}
.fd-pc-gh{position:sticky;left:0;height:44px;white-space:nowrap;padding:0 24px;text-align:left;font-size:11px;line-height:16px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--p-mut);background:var(--p-group);box-shadow:inset 0 1px 0 var(--p-line),inset 0 -1px 0 var(--p-line)}
.fd-pc-gh{z-index:2}
.fd-pc-gfill{height:44px;background:var(--p-group);box-shadow:inset 0 1px 0 var(--p-line),inset 0 -1px 0 var(--p-line)}
.fd-pc-rh{position:sticky;left:0;z-index:2;height:56px;padding:0 24px;text-align:left;font-weight:400;background:var(--p-bg);box-shadow:inset 0 -1px 0 var(--p-line);transition:box-shadow var(--fd-dur-2)}
.fd-pc-scroll[data-hs] .fd-pc-rh,.fd-pc-scroll[data-hs] .fd-pc-corner{box-shadow:inset 0 -1px 0 var(--p-line),8px 0 12px -8px rgba(20,19,26,.16)}
.fd-pc-scroll[data-hs] .fd-pc-corner{box-shadow:inset 0 -1px 0 var(--p-line2),8px 0 12px -8px rgba(20,19,26,.16)}
.fd-pc-label{display:block;font-weight:500}
.fd-pc-rh small{display:block;font-size:12px;line-height:16px;color:var(--p-mut)}
.fd-pc-td{height:56px;padding:0 20px;text-align:left;vertical-align:middle;box-shadow:inset 0 -1px 0 var(--p-line);transition:background-color var(--fd-dur-1)}
.fd-pc-td[data-rec]{background:var(--p-tint);box-shadow:inset 0 -1px 0 var(--p-line),inset 1px 0 0 var(--p-tintline),inset -1px 0 0 var(--p-tintline)}
.fd-pc-td[data-rec][data-last]{box-shadow:inset 1px 0 0 var(--p-tintline),inset -1px 0 0 var(--p-tintline),inset 0 -2px 0 var(--p-accent)}
.fd-pc-td[data-last]:not([data-rec]){box-shadow:none}
@media (hover:hover){.fd-pc-row:hover .fd-pc-td:not([data-rec]){background:var(--p-group)}.fd-pc-row:hover .fd-pc-rh{background:var(--p-group)}.fd-pc-row:hover .fd-pc-td[data-rec]{background:color-mix(in srgb,var(--p-accent) 8%,var(--p-bg))}}
.fd-pc-check{color:var(--p-ok)}
.fd-pc-td[data-rec] .fd-pc-check{color:var(--p-accent)}
.fd-pc-dash{display:block;width:10px;height:2px;border-radius:1px;background:var(--p-line2)}
.fd-pc-txt{font-size:14px;font-weight:500;font-variant-numeric:tabular-nums}
.fd-pc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes fd-pc-swap{from{opacity:0;transform:translateY(6px)}}
@media (max-width:640px){
  .fd-pc-table{min-width:680px}
  .fd-pc-corner{width:148px;padding:0 12px}.fd-pc-rh{padding:0 12px}.fd-pc-gh{padding:0 12px}
  .fd-pc-label{font-size:13px;line-height:18px}.fd-pc-rh small{display:none}
  .fd-pc-td{padding:0 12px}.fd-pc-ph{padding:0 4px}
}
@media (prefers-reduced-motion:reduce){.fd-pc *{transition-duration:1ms!important;animation:none!important}}
@media (prefers-contrast:more){.fd-pc-card{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const PLANS: PricingPlan[] = [
  { id: "free", name: "Starter", price: { monthly: 0, yearly: 0 }, cta: "Start free" },
  { id: "pro", name: "Pro", price: { monthly: 24, yearly: 19 }, cta: "Choose Pro" },
  { id: "team", name: "Team", price: { monthly: 59, yearly: 47 }, cta: "Choose Team", recommended: true },
  { id: "ent", name: "Enterprise", price: "Custom", cta: "Talk to sales" },
];

const GROUPS: PricingGroup[] = [
  {
    title: "Usage",
    rows: [
      { label: "Tracked events", hint: "Per month, across all projects", values: { free: "10K", pro: "1M", team: "10M", ent: "Unlimited" } },
      { label: "Projects", values: { free: "1", pro: "10", team: "Unlimited", ent: "Unlimited" } },
      { label: "Data retention", values: { free: "30 days", pro: "12 months", team: "36 months", ent: "Custom" } },
      { label: "Team seats", values: { free: "1", pro: "3", team: "25", ent: "Unlimited" } },
    ],
  },
  {
    title: "Analytics",
    rows: [
      { label: "Dashboards & reports", values: { free: true, pro: true, team: true, ent: true } },
      { label: "Funnels & retention", hint: "Cohort analysis and drop-off", values: { free: false, pro: true, team: true, ent: true } },
      { label: "Session replay", values: { free: false, pro: false, team: true, ent: true } },
      { label: "SQL access", hint: "Query raw events directly", values: { free: false, pro: false, team: true, ent: true } },
      { label: "Data warehouse sync", values: { free: false, pro: false, team: false, ent: true } },
    ],
  },
  {
    title: "Collaboration",
    rows: [
      { label: "Shared dashboards", values: { free: false, pro: true, team: true, ent: true } },
      { label: "Comments & mentions", values: { free: false, pro: true, team: true, ent: true } },
      { label: "Roles & permissions", values: { free: false, pro: false, team: true, ent: true } },
    ],
  },
  {
    title: "Security & support",
    rows: [
      { label: "Single sign-on (SSO)", values: { free: false, pro: false, team: true, ent: true } },
      { label: "SAML & SCIM", values: { free: false, pro: false, team: false, ent: true } },
      { label: "Audit logs", values: { free: false, pro: false, team: false, ent: true } },
      { label: "Support", values: { free: "Community", pro: "Email, 48 h", team: "Priority, 4 h", ent: "Dedicated CSM" } },
      { label: "Uptime SLA", values: { free: false, pro: false, team: "99.9%", ent: "99.99%" } },
    ],
  },
];

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [chosen, setChosen] = useState("");
  return (
    <div className="fd-pcd" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-pcd-top">
        <span className="fd-pcd-brand"><span className="fd-pcd-logo" aria-hidden="true"><i /><i /><i /></span>Plainsight</span>
        <button type="button" className="fd-pcd-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      </header>
      <main className="fd-pcd-main">
        <section className="fd-pcd-hero">
          <h1>Product analytics that grows with your team</h1>
          <p>Start free. Upgrade when you need funnels, replays or SSO. Cancel any time.</p>
          <div className="fd-pcd-seg" role="radiogroup" aria-label="Billing period">
            {(["monthly", "yearly"] as const).map((b) => (
              <button key={b} type="button" role="radio" aria-checked={billing === b} onClick={() => setBilling(b)} onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = b === "monthly" ? "yearly" : "monthly"; setBilling(n); (e.currentTarget.parentElement?.querySelector(`[data-b=${n}]`) as HTMLElement | null)?.focus(); } }} data-b={b} tabIndex={billing === b ? 0 : -1}>
                {b === "monthly" ? "Monthly" : "Yearly"}{b === "yearly" && <em>Save 20%</em>}
              </button>
            ))}
          </div>
        </section>
        <PricingComparisonTable theme={theme} plans={PLANS} groups={GROUPS} billing={billing} maxHeight={720} caption="Plainsight plan comparison" onSelect={(id) => setChosen(PLANS.find((p) => p.id === id)!.name)} />
        <p className="fd-pcd-note" role="status" aria-live="polite">{chosen ? `${chosen} selected — you’d continue to checkout from here.` : "Prices in USD. Taxes calculated at checkout."}</p>
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-pcd,.fd-pcd *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-pcd,.fd-pcd *)::before,:where(.fd-pcd,.fd-pcd *)::after{box-sizing:border-box}
:where(.fd-pcd svg){display:block;flex-shrink:0}
:where(.fd-pcd button){appearance:none;-webkit-appearance:none;outline:0;border-radius:0;cursor:pointer}
.fd-pcd{--fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --d-bg:#F6F5FA;--d-fg:#14131A;--d-mut:#6B6978;--d-line:rgba(20,19,26,.09);--d-accent:#6D28D9;--d-ring:rgba(109,40,217,.5);--d-card:#fff;
  min-height:100vh;background:var(--d-bg);color:var(--d-fg);font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.006em;-webkit-font-smoothing:antialiased}
.fd-pcd[data-fd-theme="dark"]{--d-bg:#0B0A10;--d-fg:#F2F1F7;--d-mut:#9C99AA;--d-line:rgba(255,255,255,.08);--d-accent:#A78BFA;--d-ring:rgba(167,139,250,.6);--d-card:#121118}
.fd-pcd-top{display:flex;align-items:center;justify-content:space-between;height:56px;padding:0 clamp(16px,3vw,32px)}
.fd-pcd-brand{display:flex;align-items:center;gap:10px;font-weight:600;font-size:15px;letter-spacing:-.02em}
.fd-pcd-logo{display:flex;align-items:flex-end;gap:2px;width:20px;height:20px}.fd-pcd-logo i{flex:1;border-radius:2px;background:var(--d-accent)}.fd-pcd-logo i:nth-child(1){height:45%}.fd-pcd-logo i:nth-child(2){height:75%}.fd-pcd-logo i:nth-child(3){height:100%}
.fd-pcd-theme{height:32px;padding:0 12px;border-radius:8px;font-size:13px;font-weight:500;color:var(--d-mut);box-shadow:inset 0 0 0 1px var(--d-line)}.fd-pcd-theme:hover{color:var(--d-fg)}
.fd-pcd-theme:focus-visible,.fd-pcd-seg button:focus-visible{outline:2px solid var(--d-ring);outline-offset:2px}
.fd-pcd-main{max-width:1120px;margin:0 auto;padding:32px clamp(16px,3vw,32px) 56px}
.fd-pcd-hero{display:flex;flex-direction:column;align-items:center;text-align:center;padding:24px 0 40px}
.fd-pcd-hero h1{max-width:16em;font-size:clamp(30px,5vw,48px);line-height:1.08;font-weight:600;letter-spacing:-.04em}
.fd-pcd-hero p{margin-top:14px;font-size:16px;line-height:24px;color:var(--d-mut)}
.fd-pcd-seg{position:relative;display:inline-flex;gap:2px;margin-top:28px;padding:3px;border-radius:12px;background:var(--d-line)}
.fd-pcd-seg button{display:flex;align-items:center;gap:8px;height:34px;padding:0 16px;border-radius:9px;font-size:13px;font-weight:500;line-height:1;color:var(--d-mut);transition:background-color 240ms var(--fd-ease-out),color 240ms,box-shadow 240ms}
.fd-pcd-seg button[aria-checked=true]{background:var(--d-card);color:var(--d-fg);box-shadow:0 1px 3px rgba(20,19,26,.12),0 0 0 1px var(--d-line)}
.fd-pcd-seg em{font-style:normal;font-size:11px;font-weight:600;padding:3px 6px;border-radius:9999px;color:#15803D;background:rgba(22,163,74,.12)}
.fd-pcd[data-fd-theme="dark"] .fd-pcd-seg em{color:#4ADE80}
.fd-pcd-note{margin-top:16px;text-align:center;font-size:13px;color:var(--d-mut);min-height:20px}
@media (prefers-reduced-motion:reduce){.fd-pcd *{transition-duration:1ms!important}}
`;
