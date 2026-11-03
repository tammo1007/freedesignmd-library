/**
 * UsageCalculator — usage-based API / infrastructure pricing. Three snapping
 * sliders (requests, storage, seats) price the same usage under every plan,
 * pick the cheapest one that fits ("You're on Scale"), and show an itemised
 * bill whose total counts to its new value. A stacked bar breaks the bill
 * down and a small comparison shows what the other plans would have cost.
 *
 * Props: plans (base, included quotas, overage rates, limits), defaults
 * ({ requests, storage, seats } as stop indexes / seat count), requestStops,
 * storageStops, maxSeats, title, lede.
 * CSS vars: --fd-uc-bg, --fd-uc-fg, --fd-uc-signal.
 *
 * Browser support: all evergreen browsers (styled native range inputs).
 * Accessibility: native <input type="range"> with aria-valuetext ("400
 * million requests"); the total sits in a polite live region that updates
 * after the animation settles. Bars are aria-hidden; the itemised list carries
 * the same numbers as text.
 * Reduced motion: the total jumps, bars resize without transition.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface UsagePlan {
  id: string;
  name: string;
  base: number;
  incRequests: number; // millions
  incStorage: number; // GB
  incSeats: number;
  perMillion: number | null; // null = hard limit
  perGB: number | null;
  perSeat: number | null;
  maxRequests: number; // millions
  maxSeats: number;
}

export interface UsageCalculatorProps {
  plans?: UsagePlan[];
  requestStops?: number[];
  storageStops?: number[];
  maxSeats?: number;
  defaults?: { requests: number; storage: number; seats: number };
  title?: string;
  lede?: string;
  className?: string;
}

const PLANS: UsagePlan[] = [
  { id: "hobby", name: "Hobby", base: 0, incRequests: 1, incStorage: 5, incSeats: 1, perMillion: null, perGB: null, perSeat: null, maxRequests: 1, maxSeats: 1 },
  { id: "pro", name: "Pro", base: 29, incRequests: 10, incStorage: 100, incSeats: 3, perMillion: 1.2, perGB: 0.2, perSeat: 12, maxRequests: 1000, maxSeats: 20 },
  { id: "scale", name: "Scale", base: 499, incRequests: 200, incStorage: 1000, incSeats: 10, perMillion: 0.3, perGB: 0.06, perSeat: 8, maxRequests: 1000, maxSeats: 40 },
];

const REQ = [1, 5, 10, 25, 50, 100, 200, 400, 600, 800, 1000];
const STO = [5, 25, 50, 100, 250, 500, 750, 1000, 2000, 3000];

const fmtReq = (m: number) => (m >= 1000 ? `${m / 1000}B` : `${m}M`);
const fmtSto = (g: number) => (g >= 1000 ? `${g / 1000} TB` : `${g} GB`);
const money = (n: number, d = 2) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

type Line = { key: "base" | "req" | "sto" | "seat"; label: string; detail: string; amount: number };

function price(p: UsagePlan, req: number, sto: number, seats: number): { ok: boolean; lines: Line[]; total: number } {
  const xr = Math.max(0, req - p.incRequests);
  const xs = Math.max(0, sto - p.incStorage);
  const xu = Math.max(0, seats - p.incSeats);
  const ok =
    req <= p.maxRequests &&
    seats <= p.maxSeats &&
    (p.perMillion !== null || xr === 0) &&
    (p.perGB !== null || xs === 0) &&
    (p.perSeat !== null || xu === 0);
  const lines: Line[] = [
    { key: "base", label: `${p.name} platform fee`, detail: `incl. ${fmtReq(p.incRequests)} req, ${fmtSto(p.incStorage)}, ${p.incSeats} seat${p.incSeats > 1 ? "s" : ""}`, amount: p.base },
    { key: "req", label: "Requests", detail: xr ? `${fmtReq(xr)} over × $${(p.perMillion ?? 0).toFixed(2)}/M` : "within included", amount: xr * (p.perMillion ?? 0) },
    { key: "sto", label: "Storage", detail: xs ? `${xs.toLocaleString("en-US")} GB over × $${(p.perGB ?? 0).toFixed(2)}` : "within included", amount: xs * (p.perGB ?? 0) },
    { key: "seat", label: "Seats", detail: xu ? `${xu} extra × $${p.perSeat}` : "within included", amount: xu * (p.perSeat ?? 0) },
  ];
  return { ok, lines, total: lines.reduce((a, l) => a + l.amount, 0) };
}

function useTween(target: number) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    if (reduce || start === target) {
      from.current = target;
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const D = 420;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / D);
      const e = 1 - Math.pow(1 - t, 4);
      const cur = start + (target - start) * e;
      from.current = cur;
      setV(cur);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

function Slider({ label, value, stops, onChange, fmt, valueText, unit, labels }: { label: string; value: number; stops: number[]; onChange: (i: number) => void; fmt: (n: number) => string; valueText: (n: number) => string; unit: string; labels: number[] }) {
  const id = useId();
  const pct = (value / (stops.length - 1)) * 100;
  return (
    <div className="fd-uc-sl">
      <div className="fd-uc-sl-top">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {fmt(stops[value])}
          <small>{unit}</small>
        </output>
      </div>
      <div className="fd-uc-track" style={{ ["--p" as string]: `${pct}%` }}>
        <input
          id={id}
          type="range"
          min={0}
          max={stops.length - 1}
          step={1}
          value={value}
          aria-valuetext={valueText(stops[value])}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="fd-uc-ticks" aria-hidden="true">
          {stops.map((s, i) => (
            <span key={s} data-on={i <= value ? "" : undefined} style={{ left: `${(i / (stops.length - 1)) * 100}%` }}>
              {labels.includes(i) ? <em>{fmt(s)}</em> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const COLORS: Record<Line["key"], string> = { base: "#F2EFE6", req: "#FFB224", sto: "#7FA6FF", seat: "#5ED1A0" };

export function UsageCalculator({
  plans = PLANS,
  requestStops = REQ,
  storageStops = STO,
  maxSeats = 40,
  defaults = { requests: 7, storage: 6, seats: 12 },
  title = "Pay for what your functions actually do.",
  lede = "Move the sliders to your last month. We price it on every plan and put you on the cheapest one. No commitment, plans switch automatically at the start of each billing cycle.",
  className,
}: UsageCalculatorProps) {
  const [ri, setRi] = useState(defaults.requests);
  const [si, setSi] = useState(defaults.storage);
  const [seats, setSeats] = useState(defaults.seats);
  const req = requestStops[ri];
  const sto = storageStops[si];

  const priced = useMemo(() => plans.map((p) => ({ plan: p, ...price(p, req, sto, seats) })), [plans, req, sto, seats]);
  const valid = priced.filter((p) => p.ok).sort((a, b) => a.total - b.total);
  const best = valid[0];
  const total = best ? best.total : 0;
  const shown = useTween(total);
  const [live, setLive] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setLive(best ? `${best.plan.name} plan, ${money(best.total)} per month` : "Enterprise pricing, talk to us"), 500);
    return () => clearTimeout(t);
  }, [best?.plan.id, best?.total]); // eslint-disable-line react-hooks/exhaustive-deps

  const runnerUp = best ? priced.filter((p) => p.plan.id !== best.plan.id && p.ok).sort((a, b) => a.total - b.total)[0] : undefined;
  const [whole, cents] = money(shown).split(".");

  return (
    <section className={`fd-uc${className ? " " + className : ""}`} aria-label="Usage pricing calculator">
      <style>{css}</style>
      <div className="fd-uc-wrap">
        <div className="fd-uc-left">
          <p className="fd-uc-eyebrow">
            <span>$ kestrel pricing --estimate</span>
          </p>
          <h2 className="fd-uc-title">{title}</h2>
          <p className="fd-uc-lede">{lede}</p>
          <div className="fd-uc-sliders">
            <Slider label="Requests / month" unit="req" labels={[0, 2, 4, 6, 8, 10]} value={ri} stops={requestStops} onChange={setRi} fmt={fmtReq} valueText={(n) => (n >= 1000 ? `${n / 1000} billion requests` : `${n} million requests`)} />
            <Slider label="Storage (KV + blobs)" unit="" labels={[0, 2, 4, 6, 9]} value={si} stops={storageStops} onChange={setSi} fmt={fmtSto} valueText={(n) => fmtSto(n)} />
            <Slider
              label="Team seats"
              unit={seats === 1 ? "seat" : "seats"}
              value={seats - 1}
              labels={[0, 9, 19, 29, maxSeats - 1]}
              stops={Array.from({ length: maxSeats }, (_, i) => i + 1)}
              onChange={(i) => setSeats(i + 1)}
              fmt={(n) => String(n)}
              valueText={(n) => `${n} seats`}
            />
          </div>
        </div>

        <div className="fd-uc-bill" data-plan={best?.plan.id ?? "enterprise"}>
          <div className="fd-uc-detect">
            <span className="fd-uc-led" aria-hidden="true" />
            <span className="fd-uc-detect-t">
              You&apos;re on <b key={best?.plan.id ?? "ent"}>{best ? best.plan.name : "Enterprise"}</b>
            </span>
            {best && runnerUp && <span className="fd-uc-saves">saves {money(runnerUp.total - best.total, 0)} vs {runnerUp.plan.name}</span>}
          </div>

          {best ? (
            <>
              <ul className="fd-uc-lines">
                {best.lines.map((l) => (
                  <li key={l.key} data-zero={l.amount === 0 ? "" : undefined}>
                    <i style={{ background: COLORS[l.key] }} aria-hidden="true" />
                    <span className="fd-uc-l">
                      {l.label}
                      <small>{l.detail}</small>
                    </span>
                    <span className="fd-uc-amt">{money(l.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="fd-uc-bar" aria-hidden="true">
                {best.lines.map((l) => (
                  <span key={l.key} style={{ flexGrow: Math.max(l.amount, 0.0001), background: COLORS[l.key] }} />
                ))}
              </div>
              <div className="fd-uc-total">
                <span>Estimated / month</span>
                <strong aria-hidden="true">
                  {whole}
                  <small>.{cents}</small>
                </strong>
              </div>
              <div className="fd-uc-cmp" aria-label="Same usage on each plan">
                {priced.map((p) => {
                  const max = Math.max(...priced.filter((q) => q.ok).map((q) => q.total), 1);
                  return (
                    <div key={p.plan.id} className="fd-uc-cmp-row" data-best={p.plan.id === best.plan.id ? "" : undefined}>
                      <span>{p.plan.name}</span>
                      <span className="fd-uc-cmp-bar" aria-hidden="true">
                        <span style={{ transform: `scaleX(${p.ok ? Math.max(p.total / max, 0.01) : 0})` }} />
                      </span>
                      <span className="fd-uc-cmp-v">{p.ok ? money(p.total, 0) : "over limit"}</span>
                    </div>
                  );
                })}
              </div>
              <a className="fd-uc-cta" href="#signup">
                Deploy on {best.plan.name}
                <span aria-hidden="true">↵</span>
              </a>
            </>
          ) : (
            <div className="fd-uc-ent">
              <p>Past 1B requests or 40 seats we write a contract: committed-use discounts, a 99.99% SLA and a named on-call engineer.</p>
              <a className="fd-uc-cta" href="#sales">
                Talk to infrastructure sales
                <span aria-hidden="true">↵</span>
              </a>
            </div>
          )}
          <p className="fd-uc-note">Prices in USD, excl. tax. Egress is free up to 1 TB per 100M requests.</p>
        </div>
      </div>
      <div className="fd-uc-sr" role="status" aria-live="polite">{live}</div>
    </section>
  );
}

const css = `
:where(.fd-uc,.fd-uc *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-uc,.fd-uc *)::before,:where(.fd-uc,.fd-uc *)::after{box-sizing:border-box}
.fd-uc{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-uc-bg:#0D0D0B;--fd-uc-fg:#F2EFE6;--fd-uc-signal:#FFB224;
  --mut:#8E8A7E;--dim:#5A574F;--line:rgba(242,239,230,.1);--panel:#151512;
  --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  display:block;width:100%;background:var(--fd-uc-bg);color:var(--fd-uc-fg);font:400 15px/22px var(--sans);-webkit-font-smoothing:antialiased;
  padding:clamp(48px,7vw,96px) clamp(16px,4vw,56px)}
.fd-uc-wrap{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(32px,6vw,96px);align-items:start}
.fd-uc-eyebrow{font:400 13px/20px var(--mono);color:var(--fd-uc-signal)}
.fd-uc-eyebrow span::after{content:"";display:inline-block;width:8px;height:15px;margin-left:4px;vertical-align:-3px;background:var(--fd-uc-signal);animation:fd-uc-blink 1.1s steps(1) infinite}
@keyframes fd-uc-blink{50%{opacity:0}}
.fd-uc-title{margin-top:20px;max-width:16ch;font:600 clamp(2rem,4.2vw,3.5rem)/1.02 var(--sans);letter-spacing:-.04em}
.fd-uc-lede{margin-top:20px;max-width:52ch;color:var(--mut)}
.fd-uc-sliders{margin-top:48px;display:grid;gap:36px}
.fd-uc-sl-top{display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.fd-uc-sl-top label{font:500 13px/20px var(--mono);color:var(--mut);text-transform:uppercase;letter-spacing:.04em}
.fd-uc-sl-top output{font:500 1.5rem/32px var(--mono);letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--fd-uc-fg)}
.fd-uc-sl-top small{margin-left:6px;font-size:.8125rem;color:var(--mut);letter-spacing:0}
.fd-uc-track{position:relative;margin-top:12px;height:44px}
.fd-uc-track::before,.fd-uc-track::after{content:"";position:absolute;left:0;top:13px;height:2px;border-radius:2px}
.fd-uc-track::before{right:0;background:var(--line)}
.fd-uc-track::after{width:var(--p);background:var(--fd-uc-signal);transition:width var(--fd-dur-2) var(--fd-ease-out)}
.fd-uc-track input{position:absolute;inset:0 -11px auto;width:calc(100% + 22px);height:28px;margin:0;-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer;z-index:2}
.fd-uc-track input::-webkit-slider-runnable-track{height:28px;background:transparent}
.fd-uc-track input::-moz-range-track{height:28px;background:transparent}
.fd-uc-track input::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;margin-top:3px;border-radius:4px;background:var(--fd-uc-fg);border:5px solid var(--fd-uc-bg);box-shadow:0 0 0 1.5px var(--fd-uc-fg);transition:transform var(--fd-dur-2) var(--fd-spring)}
.fd-uc-track input::-moz-range-thumb{width:12px;height:12px;border-radius:4px;background:var(--fd-uc-fg);border:5px solid var(--fd-uc-bg);box-shadow:0 0 0 1.5px var(--fd-uc-fg)}
.fd-uc-track input:active::-webkit-slider-thumb{transform:scale(1.18)}
.fd-uc-track input:focus-visible{outline:none}
.fd-uc-track input:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 1.5px var(--fd-uc-fg),0 0 0 4px color-mix(in srgb,var(--fd-uc-signal) 70%,transparent)}
.fd-uc-track input:focus-visible::-moz-range-thumb{box-shadow:0 0 0 1.5px var(--fd-uc-fg),0 0 0 4px color-mix(in srgb,var(--fd-uc-signal) 70%,transparent)}
.fd-uc-ticks{position:absolute;left:0;right:0;top:20px;height:24px}
.fd-uc-ticks span{position:absolute;top:0;width:1px;height:5px;background:var(--dim)}
.fd-uc-ticks span[data-on]{background:var(--fd-uc-signal)}
.fd-uc-ticks em{position:absolute;top:8px;left:0;transform:translateX(-50%);font:400 11px/14px var(--mono);font-style:normal;color:var(--dim);white-space:nowrap}
.fd-uc-ticks span:first-child em{transform:none}
.fd-uc-ticks span:last-child em{transform:translateX(-100%)}
.fd-uc-ticks span:not([data-on]):not(:first-child){opacity:.6}

.fd-uc-bill{position:relative;padding:28px;border-radius:20px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--line);font-family:var(--mono)}
.fd-uc-detect{display:flex;align-items:center;flex-wrap:wrap;gap:10px 12px;padding-bottom:20px;border-bottom:1px dashed var(--line)}
.fd-uc-led{display:block;width:8px;height:8px;border-radius:50%;background:var(--fd-uc-signal);box-shadow:0 0 0 3px color-mix(in srgb,var(--fd-uc-signal) 22%,transparent)}
.fd-uc-detect-t{font:400 15px/22px var(--mono)}
.fd-uc-detect-t b{display:inline-block;font-weight:700;color:var(--fd-uc-signal);animation:fd-uc-flip var(--fd-dur-3) var(--fd-spring)}
@keyframes fd-uc-flip{from{transform:translateY(60%) rotateX(80deg);opacity:0}to{transform:none;opacity:1}}
.fd-uc-saves{margin-left:auto;padding:3px 8px;border-radius:6px;font:500 11px/16px var(--mono);color:#0D0D0B;background:#5ED1A0}
.fd-uc-lines{margin-top:8px}
.fd-uc-lines li{display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:start;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);transition:opacity var(--fd-dur-2)}
.fd-uc-lines li[data-zero]{opacity:.45}
.fd-uc-lines i{display:block;width:8px;height:8px;margin-top:6px;border-radius:2px}
.fd-uc-l{display:flex;flex-direction:column;font:500 13px/20px var(--mono)}
.fd-uc-l small{font-size:11px;line-height:16px;color:var(--mut)}
.fd-uc-amt{font:500 13px/20px var(--mono);font-variant-numeric:tabular-nums}
.fd-uc-bar{display:flex;gap:2px;height:10px;margin-top:20px;border-radius:3px;overflow:hidden}
.fd-uc-bar span{display:block;flex-basis:0;min-width:2px;transition:flex-grow var(--fd-dur-3) var(--fd-ease-out)}
.fd-uc-total{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:20px}
.fd-uc-total span{font:400 12px/18px var(--mono);color:var(--mut);text-transform:uppercase;letter-spacing:.04em;padding-bottom:8px}
.fd-uc-total strong{font:600 clamp(2.5rem,4vw,3.25rem)/1 var(--mono);letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.fd-uc-total small{font-size:.45em;color:var(--mut);letter-spacing:-.02em}
.fd-uc-cmp{display:grid;gap:6px;margin-top:24px;padding-top:16px;border-top:1px dashed var(--line)}
.fd-uc-cmp-row{display:grid;grid-template-columns:52px minmax(0,1fr) 84px;align-items:center;gap:10px;font:400 12px/18px var(--mono);color:var(--mut)}
.fd-uc-cmp-row[data-best]{color:var(--fd-uc-fg)}
.fd-uc-cmp-bar{display:block;height:6px;border-radius:2px;background:var(--line);overflow:hidden}
.fd-uc-cmp-bar span{display:block;height:100%;width:100%;transform-origin:left;background:var(--dim);transition:transform var(--fd-dur-3) var(--fd-ease-out)}
.fd-uc-cmp-row[data-best] .fd-uc-cmp-bar span{background:var(--fd-uc-signal)}
.fd-uc-cmp-v{text-align:right;font-variant-numeric:tabular-nums}
.fd-uc-cta{display:flex;align-items:center;justify-content:space-between;margin-top:24px;height:48px;padding:0 18px;border-radius:10px;background:var(--fd-uc-signal);color:#0D0D0B;font:600 14px/48px var(--mono);transition:transform var(--fd-dur-2) var(--fd-spring),background-color var(--fd-dur-1)}
.fd-uc-cta:hover{background:#FFC34D}
.fd-uc-cta:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-uc-cta:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-uc-signal) 70%,transparent);outline-offset:2px}
.fd-uc-ent{padding-top:20px}
.fd-uc-ent p{font:400 14px/22px var(--mono);color:var(--mut)}
.fd-uc-note{margin-top:16px;font:400 11px/16px var(--mono);color:var(--dim)}
.fd-uc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:880px){.fd-uc-wrap{grid-template-columns:1fr}.fd-uc-bill{padding:20px}}
@media (prefers-reduced-motion:reduce){.fd-uc *{transition-duration:1ms!important;animation:none!important}}
@media (prefers-contrast:more){.fd-uc{--line:rgba(242,239,230,.5)}}
`;

export function Demo() {
  return (
    <div className="fd-ucd">
      <style>{demoCss}</style>
      <header className="fd-ucd-nav">
        <a href="#home" className="fd-ucd-logo">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M1 17L9 1l8 16H11.5L9 11.5 6.5 17z" fill="#FFB224" />
          </svg>
          kestrel<span>/edge</span>
        </a>
        <nav aria-label="Main">
          <a href="#docs">Docs</a>
          <a href="#pricing" aria-current="page">Pricing</a>
          <a href="#status">Status: all systems normal</a>
        </nav>
      </header>
      <UsageCalculator />
    </div>
  );
}

const demoCss = `
:where(.fd-ucd,.fd-ucd *){box-sizing:border-box;margin:0;padding:0;font:inherit;color:inherit;text-decoration:none}
.fd-ucd{min-height:100vh;background:#0D0D0B;color:#F2EFE6;font:400 13px/20px ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace}
.fd-ucd-nav{display:flex;align-items:center;justify-content:space-between;gap:20px;height:56px;padding:0 clamp(16px,4vw,56px);border-bottom:1px solid rgba(242,239,230,.08)}
.fd-ucd-logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;letter-spacing:-.02em}
.fd-ucd-logo svg{display:block}
.fd-ucd-logo span{color:#8E8A7E;font-weight:400}
.fd-ucd-nav nav{display:flex;gap:24px;color:#8E8A7E}
.fd-ucd-nav nav a[aria-current]{color:#F2EFE6}
.fd-ucd-nav nav a:last-child{color:#5ED1A0}
@media (max-width:640px){.fd-ucd-nav nav a:not([aria-current]){display:none}}
`;
