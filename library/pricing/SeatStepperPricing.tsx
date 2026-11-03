/**
 * SeatStepperPricing, per-seat volume pricing for a team tool. A seat
 * stepper (buttons with press-and-hold acceleration, or type a number)
 * moves a marker along a visible volume-discount scale; crossing a break
 * re-prices every seat and flashes the tier. Monthly / annual switch. The
 * summary points out the next break ("add 6 seats and pay $84 less") and,
 * past the sales threshold, turns into a talk-to-sales card with a named
 * person.
 *
 * Props: tiers ({ from, monthly, annual }[]), salesFrom, defaultSeats,
 * defaultAnnual, title, lede, contact ({ name, role, photo, reply }), currency.
 * CSS vars: --fd-ssp-bg, --fd-ssp-ink, --fd-ssp-signal.
 *
 * Browser support: all evergreen browsers.
 * Accessibility: the input is a labelled spinbutton (ArrowUp/Down, PageUp/
 * PageDown by 10, Home/End); +/- have aria-labels; billing is a role="switch".
 * The total and tier changes are announced in a polite live region. The scale
 * is described in a visually hidden list.
 * Reduced motion: no marker spring, totals jump.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export interface SeatTier {
  from: number;
  monthly: number;
  annual: number;
}

export interface SeatStepperPricingProps {
  tiers?: SeatTier[];
  salesFrom?: number;
  defaultSeats?: number;
  defaultAnnual?: boolean;
  title?: string;
  lede?: string;
  currency?: string;
  contact?: { name: string; role: string; photo: string; reply: string; href: string };
  className?: string;
}

const TIERS: SeatTier[] = [
  { from: 1, monthly: 14, annual: 12 },
  { from: 10, monthly: 12, annual: 10 },
  { from: 50, monthly: 10, annual: 8.5 },
  { from: 100, monthly: 8.5, annual: 7 },
];

const SCALE_MAX = 400;
const pos = (n: number) => Math.min(1, Math.log(Math.max(1, n)) / Math.log(SCALE_MAX));
const fmt = (n: number, cur: string) => cur + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

function useTween(target: number) {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cur.current = target;
      setV(target);
      return;
    }
    const a = cur.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 420);
      const e = 1 - Math.pow(1 - t, 3);
      cur.current = a + (target - a) * e;
      setV(cur.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

export function SeatStepperPricing({
  tiers = TIERS,
  salesFrom = 251,
  defaultSeats = 42,
  defaultAnnual = true,
  title = "Every seat gets cheaper as your team grows.",
  lede = "One plan, priced per person. Hit a break and the lower price applies to every seat, not only the new ones.",
  currency = "$",
  contact = { name: "Ines Moreau", role: "Head of Sales, EMEA", photo: "/img/people/p3.webp", reply: "Replies within 4 working hours", href: "#sales" },
  className,
}: SeatStepperPricingProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [seats, setSeats] = useState(defaultSeats);
  const [draft, setDraft] = useState(String(defaultSeats));
  const [annual, setAnnual] = useState(defaultAnnual);
  const [flash, setFlash] = useState(0);
  const hold = useRef<{ t?: ReturnType<typeof setTimeout>; n: number }>({ n: 0 });

  const tierIdx = tiers.reduce((acc, t, i) => (seats >= t.from ? i : acc), 0);
  const tier = tiers[tierIdx];
  const sales = seats >= salesFrom;
  const per = annual ? tier.annual : tier.monthly;
  const monthTotal = per * seats;
  const total = annual ? monthTotal * 12 : monthTotal;
  const shown = useTween(sales ? 0 : total);
  const prevTier = useRef(tierIdx);
  useEffect(() => {
    if (prevTier.current !== tierIdx) setFlash((f) => f + 1);
    prevTier.current = tierIdx;
  }, [tierIdx]);

  const next = tiers[tierIdx + 1];
  let hint = "";
  if (next && !sales) {
    const add = next.from - seats;
    const nextPer = annual ? next.annual : next.monthly;
    const nextMonth = nextPer * next.from;
    const diff = monthTotal - nextMonth;
    hint =
      diff > 0
        ? `Add ${add} seat${add > 1 ? "s" : ""} and you'd pay ${fmt(diff * (annual ? 12 : 1), currency)} less ${annual ? "a year" : "a month"}.`
        : `${add} more seat${add > 1 ? "s" : ""} and every seat drops to ${fmt(nextPer, currency)}.`;
  } else if (!sales) {
    hint = `Past ${salesFrom - 1} seats we'll quote you directly.`;
  }

  const set = (n: number) => {
    const v = Math.max(1, Math.min(1000, Math.round(n)));
    setSeats(v);
    setDraft(String(v));
  };
  const startHold = (d: number) => {
    set(seats + d);
    let s = seats + d;
    hold.current.n = 0;
    const loop = () => {
      hold.current.n++;
      const step = hold.current.n > 18 ? 10 : hold.current.n > 8 ? 5 : 1;
      s = Math.max(1, Math.min(1000, s + d * step));
      setSeats(s);
      setDraft(String(s));
      hold.current.t = setTimeout(loop, hold.current.n > 4 ? 70 : 140);
    };
    hold.current.t = setTimeout(loop, 380);
  };
  const stopHold = () => {
    if (hold.current.t) clearTimeout(hold.current.t);
    hold.current.t = undefined;
  };
  useEffect(() => stopHold, []);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const map: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
    if (e.key in map) {
      e.preventDefault();
      set(seats + map[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      set(1);
    } else if (e.key === "End") {
      e.preventDefault();
      set(salesFrom);
    } else if (e.key === "Enter") {
      set(Number(draft) || 1);
    }
  };

  const bounds = [...tiers.map((t) => t.from), salesFrom, SCALE_MAX];

  return (
    <section className={`fd-ssp${className ? " " + className : ""}`} aria-labelledby={`${uid}-t`}>
      <style>{css}</style>
      <div className="fd-ssp-wrap">
        <div className="fd-ssp-main">
          <p className="fd-ssp-eyebrow">
            <span className="fd-ssp-sq" aria-hidden="true" /> Plinth Team plan
          </p>
          <h2 className="fd-ssp-title" id={`${uid}-t`}>{title}</h2>
          <p className="fd-ssp-lede">{lede}</p>

          <div className="fd-ssp-controls">
            <div className="fd-ssp-stepper">
              <label className="fd-ssp-lbl" htmlFor={`${uid}-n`}>Seats</label>
              <div className="fd-ssp-step">
                <button type="button" className="fd-ssp-btn" aria-label="Remove a seat" disabled={seats <= 1} onPointerDown={(e) => { e.preventDefault(); startHold(-1); }} onPointerUp={stopHold} onPointerLeave={stopHold} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); set(seats - 1); } }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
                <input
                  id={`${uid}-n`}
                  className="fd-ssp-input"
                  type="text"
                  inputMode="numeric"
                  role="spinbutton"
                  aria-valuenow={seats}
                  aria-valuemin={1}
                  aria-valuemax={1000}
                  value={draft}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                    setDraft(v);
                    if (v) setSeats(Math.max(1, Math.min(1000, Number(v))));
                  }}
                  onBlur={() => set(Number(draft) || 1)}
                  onKeyDown={onKey}
                />
                <button type="button" className="fd-ssp-btn" aria-label="Add a seat" onPointerDown={(e) => { e.preventDefault(); startHold(1); }} onPointerUp={stopHold} onPointerLeave={stopHold} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); set(seats + 1); } }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M8 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <p className="fd-ssp-holdhint">Hold to count faster</p>
            </div>

            <button type="button" role="switch" aria-checked={annual} className="fd-ssp-switch" onClick={() => setAnnual((a) => !a)}>
              <span className="fd-ssp-track" aria-hidden="true"><span /></span>
              <span className="fd-ssp-sw-t">
                Billed annually
                <small>{annual ? "2 months free" : "Switch to save ~17%"}</small>
              </span>
            </button>
          </div>

          <div className="fd-ssp-scale" style={{ ["--x" as string]: pos(Math.min(seats, SCALE_MAX)) }}>
            <div className="fd-ssp-bar" aria-hidden="true">
              {bounds.slice(0, -1).map((b, i) => {
                const l = pos(b);
                const r = pos(bounds[i + 1]);
                const isSales = i === tiers.length;
                const active = sales ? isSales : i === tierIdx;
                const passed = !isSales && i < tierIdx;
                return (
                  <span key={b} className="fd-ssp-seg" data-on={active ? "" : undefined} data-past={passed || (sales && !isSales) ? "" : undefined} data-sales={isSales ? "" : undefined} style={{ left: `${l * 100}%`, width: `${(r - l) * 100}%` }}>
                    {active && <i key={flash} className="fd-ssp-sweep" />}
                    <b>{isSales ? "Sales" : fmt(annual ? tiers[i].annual : tiers[i].monthly, currency)}</b>
                    <em>{isSales ? `${salesFrom}+` : `${b}${tiers[i + 1] ? `–${tiers[i + 1].from - 1}` : `–${salesFrom - 1}`}`}</em>
                  </span>
                );
              })}
              <span className="fd-ssp-marker" data-over={seats > SCALE_MAX ? "" : undefined}>
                <span>{seats}</span>
              </span>
            </div>
            <ul className="fd-ssp-sr">
              {tiers.map((t, i) => (
                <li key={t.from}>
                  {t.from} to {(tiers[i + 1]?.from ?? salesFrom) - 1} seats: {fmt(annual ? t.annual : t.monthly, currency)} per seat per month
                </li>
              ))}
              <li>{salesFrom} seats or more: custom pricing</li>
            </ul>
          </div>
        </div>

        <aside className="fd-ssp-sum" data-sales={sales ? "" : undefined} aria-label="Your price">
          {!sales ? (
            <>
              <p className="fd-ssp-sum-l">Per seat, per month</p>
              <p className="fd-ssp-per" key={`${per}`}>
                {fmt(per, currency)}
              </p>
              <dl className="fd-ssp-math">
                <div>
                  <dt>Seats</dt>
                  <dd>× {seats}</dd>
                </div>
                {annual && (
                  <div>
                    <dt>Months</dt>
                    <dd>× 12</dd>
                  </div>
                )}
                <div className="fd-ssp-tot">
                  <dt>{annual ? "Per year" : "Per month"}</dt>
                  <dd>{currency}{Math.round(shown).toLocaleString("en-US")}</dd>
                </div>
              </dl>
              {hint && <p className="fd-ssp-hint">{hint}</p>}
              <a className="fd-ssp-cta" href="#start">Start with {seats} seat{seats > 1 ? "s" : ""}</a>
              <p className="fd-ssp-fine">Add or remove people any time; we prorate to the day. Prices exclude VAT.</p>
            </>
          ) : (
            <div className="fd-ssp-sales">
              <p className="fd-ssp-sum-l">{seats} seats</p>
              <p className="fd-ssp-sales-t">At this size, let&apos;s talk.</p>
              <p className="fd-ssp-sales-d">Teams over {salesFrom - 1} get a custom rate, SSO and audit logs at no extra cost, and a migration plan for your old wiki.</p>
              <div className="fd-ssp-person">
                <img src={contact.photo} width={48} height={48} alt="" loading="lazy" />
                <span>
                  <b>{contact.name}</b>
                  {contact.role}
                  <small>{contact.reply}</small>
                </span>
              </div>
              <a className="fd-ssp-cta" href={contact.href}>Talk to sales</a>
            </div>
          )}
        </aside>
      </div>
      <div className="fd-ssp-sr" role="status" aria-live="polite">
        {sales ? `${seats} seats: custom pricing, talk to sales.` : `${seats} seats at ${fmt(per, currency)} each, ${currency}${total.toLocaleString("en-US")} ${annual ? "per year" : "per month"}.`}
      </div>
    </section>
  );
}

const css = `
:where(.fd-ssp,.fd-ssp *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-ssp,.fd-ssp *)::before,:where(.fd-ssp,.fd-ssp *)::after{box-sizing:border-box}
:where(.fd-ssp svg,.fd-ssp img){display:block;flex-shrink:0}
:where(.fd-ssp button){appearance:none;-webkit-appearance:none;cursor:pointer;text-align:left}
.fd-ssp{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-ssp-bg:#FAFAF8;--fd-ssp-ink:#111110;--fd-ssp-signal:#FF4D00;
  --mut:#6F6F6A;--line:#E3E3DE;--soft:#EFEFEB;
  --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  display:block;width:100%;background:var(--fd-ssp-bg);color:var(--fd-ssp-ink);font:400 15px/22px var(--sans);-webkit-font-smoothing:antialiased;
  padding:clamp(48px,7vw,96px) clamp(16px,4vw,56px)}
.fd-ssp-wrap{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:clamp(32px,5vw,80px);align-items:start}
.fd-ssp-eyebrow{display:flex;align-items:center;gap:8px;font:600 13px/20px var(--sans)}
.fd-ssp-sq{display:block;width:10px;height:10px;background:var(--fd-ssp-signal)}
.fd-ssp-title{margin-top:16px;max-width:17ch;font:650 clamp(2.25rem,4.6vw,3.75rem)/1.02 var(--sans);font-weight:650;letter-spacing:-.045em}
.fd-ssp-lede{margin-top:18px;max-width:50ch;font-size:1.0625rem;line-height:26px;color:var(--mut)}
.fd-ssp-controls{display:flex;flex-wrap:wrap;align-items:flex-end;gap:24px 40px;margin-top:44px}
.fd-ssp-lbl{display:block;font:500 13px/18px var(--sans);color:var(--mut)}
.fd-ssp-step{display:flex;align-items:center;gap:4px;margin-top:8px;padding:4px;border-radius:16px;background:#fff;box-shadow:0 0 0 1px var(--line),0 1px 2px rgba(0,0,0,.04)}
.fd-ssp-btn{display:grid;place-items:center;width:52px;height:52px;border-radius:12px;color:var(--fd-ssp-ink);background:var(--soft);transition:background-color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring);touch-action:manipulation;user-select:none;-webkit-user-select:none}
.fd-ssp-btn:hover{background:#E4E4DF}
.fd-ssp-btn:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-ssp-btn:disabled{opacity:.35;cursor:not-allowed}
.fd-ssp-btn:focus-visible,.fd-ssp-input:focus-visible,.fd-ssp-switch:focus-visible,.fd-ssp-cta:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-ssp-signal) 70%,transparent);outline-offset:2px}
.fd-ssp-input{width:112px;height:52px;border-radius:10px;text-align:center;font:700 2rem/52px var(--sans);letter-spacing:-.04em;font-variant-numeric:tabular-nums;color:var(--fd-ssp-ink);background:transparent;outline:none}
.fd-ssp-holdhint{margin-top:8px;font:400 12px/16px var(--sans);color:var(--mut)}
.fd-ssp-switch{display:flex;align-items:center;gap:12px;padding-bottom:30px}
.fd-ssp-track{position:relative;display:block;width:44px;height:26px;border-radius:9999px;background:#D6D6D0;transition:background-color var(--fd-dur-2)}
.fd-ssp-track span{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform var(--fd-dur-2) var(--fd-spring)}
.fd-ssp-switch[aria-checked="true"] .fd-ssp-track{background:var(--fd-ssp-ink)}
.fd-ssp-switch[aria-checked="true"] .fd-ssp-track span{transform:translateX(18px)}
.fd-ssp-sw-t{display:flex;flex-direction:column;font:600 14px/20px var(--sans)}
.fd-ssp-sw-t small{font-weight:400;font-size:12px;line-height:16px;color:var(--mut)}
.fd-ssp-switch[aria-checked="true"] small{color:var(--fd-ssp-signal);font-weight:600}

.fd-ssp-scale{margin-top:36px;padding-top:44px}
.fd-ssp-bar{position:relative;height:96px}
.fd-ssp-seg{position:absolute;top:0;height:12px;background:var(--soft);box-shadow:inset 1px 0 0 var(--fd-ssp-bg);overflow:visible;transition:background-color var(--fd-dur-2)}
.fd-ssp-seg:first-of-type{border-radius:6px 0 0 6px}
.fd-ssp-seg[data-sales]{border-radius:0 6px 6px 0;background:repeating-linear-gradient(-45deg,var(--soft) 0 4px,var(--fd-ssp-bg) 4px 8px)}
.fd-ssp-seg[data-past]{background:#CFCFC9}
.fd-ssp-seg[data-on]{background:var(--fd-ssp-ink)}
.fd-ssp-seg[data-on][data-sales]{background:var(--fd-ssp-signal)}
.fd-ssp-sweep{position:absolute;inset:0;background:var(--fd-ssp-signal);transform-origin:left;animation:fd-ssp-sweep var(--fd-dur-4) var(--fd-ease-out) forwards}
@keyframes fd-ssp-sweep{0%{transform:scaleX(0);opacity:1}60%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}}
.fd-ssp-seg b,.fd-ssp-seg em{position:absolute;left:8px;white-space:nowrap;font-style:normal}
.fd-ssp-seg b{top:24px;font:700 17px/24px var(--sans);letter-spacing:-.02em;color:var(--mut);font-variant-numeric:tabular-nums;transition:color var(--fd-dur-2)}
.fd-ssp-seg em{top:48px;font:400 12px/16px var(--sans);color:var(--mut)}
.fd-ssp-seg[data-on] b{color:var(--fd-ssp-ink)}
.fd-ssp-seg[data-on][data-sales] b{color:var(--fd-ssp-signal)}
.fd-ssp-seg::before{content:"";position:absolute;left:0;top:12px;height:56px;width:1px;background:var(--line)}
.fd-ssp-marker{position:absolute;top:-38px;left:calc(var(--x) * 100%);transform:translateX(-50%);transition:left var(--fd-dur-3) var(--fd-spring);z-index:2}
.fd-ssp-marker span{display:block;padding:3px 8px;border-radius:6px;background:var(--fd-ssp-signal);color:#fff;font:700 12px/16px var(--sans);font-variant-numeric:tabular-nums;white-space:nowrap}
.fd-ssp-marker::after{content:"";position:absolute;left:50%;top:100%;width:2px;height:24px;margin-left:-1px;background:var(--fd-ssp-signal)}
.fd-ssp-marker[data-over]{transform:translateX(-100%)}

.fd-ssp-sum{position:relative;padding:28px;border-radius:24px;background:#fff;box-shadow:0 0 0 1px var(--line),0 20px 40px -28px rgba(0,0,0,.25)}
.fd-ssp-sum-l{font:500 13px/18px var(--sans);color:var(--mut)}
.fd-ssp-per{margin-top:6px;font:700 clamp(3.5rem,5vw,4.5rem)/1 var(--sans);letter-spacing:-.05em;font-variant-numeric:tabular-nums;animation:fd-ssp-pop var(--fd-dur-3) var(--fd-spring)}
@keyframes fd-ssp-pop{from{transform:translateY(8px);opacity:.2}to{transform:none;opacity:1}}
.fd-ssp-math{margin-top:24px;border-top:1px solid var(--line)}
.fd-ssp-math div{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums}
.fd-ssp-math dt{color:var(--mut)}
.fd-ssp-math dd{font-weight:600}
.fd-ssp-math .fd-ssp-tot{border-bottom:0;padding-top:14px}
.fd-ssp-tot dt{color:var(--fd-ssp-ink);font-weight:600}
.fd-ssp-tot dd{font:700 1.5rem/28px var(--sans);letter-spacing:-.03em}
.fd-ssp-hint{margin-top:8px;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--fd-ssp-signal) 9%,#fff);color:#A63200;font:500 13px/18px var(--sans)}
.fd-ssp-cta{display:flex;align-items:center;justify-content:center;margin-top:20px;height:52px;border-radius:14px;background:var(--fd-ssp-ink);color:#fff;font:600 15px/52px var(--sans);transition:background-color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-ssp-cta:hover{background:#2A2A27}
.fd-ssp-cta:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-ssp-sum[data-sales] .fd-ssp-cta{background:var(--fd-ssp-signal)}
.fd-ssp-fine{margin-top:12px;font:400 12px/17px var(--sans);color:var(--mut)}
.fd-ssp-sales{animation:fd-ssp-pop var(--fd-dur-3) var(--fd-ease-out)}
.fd-ssp-sales-t{margin-top:6px;font:700 2rem/36px var(--sans);letter-spacing:-.035em}
.fd-ssp-sales-d{margin-top:10px;color:var(--mut)}
.fd-ssp-person{display:flex;align-items:center;gap:12px;margin-top:20px;padding:12px;border-radius:14px;background:var(--soft)}
.fd-ssp-person img{width:48px;height:48px;border-radius:50%;object-fit:cover}
.fd-ssp-person span{display:flex;flex-direction:column;font:400 13px/18px var(--sans);color:var(--mut)}
.fd-ssp-person b{font-weight:600;color:var(--fd-ssp-ink);font-size:14px}
.fd-ssp-person small{margin-top:2px;font-size:12px;color:#1F7A3A}
.fd-ssp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:960px){.fd-ssp-wrap{grid-template-columns:1fr}}
@media (max-width:560px){
  .fd-ssp-seg b{font-size:13px;left:4px}
  .fd-ssp-seg em{font-size:10px;left:4px}
  .fd-ssp-seg[data-sales] b,.fd-ssp-seg[data-sales] em{left:auto;right:0}
  .fd-ssp-switch{padding-bottom:0}
  .fd-ssp-sum{padding:22px}
}
@media (prefers-reduced-motion:reduce){.fd-ssp *{transition-duration:1ms!important;animation:none!important}}
@media (prefers-contrast:more){.fd-ssp{--line:#111110}}
`;

export function Demo() {
  return (
    <div className="fd-sspd">
      <style>{demoCss}</style>
      <header className="fd-sspd-nav">
        <a href="#home" className="fd-sspd-logo">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <rect x="2" y="12" width="16" height="6" fill="#111110" />
            <rect x="5" y="6" width="10" height="6" fill="#111110" />
            <rect x="8" y="1" width="4" height="5" fill="#FF4D00" />
          </svg>
          Plinth
        </a>
        <nav aria-label="Main">
          <a href="#product">Product</a>
          <a href="#pricing" aria-current="page">Pricing</a>
          <a href="#security">Security</a>
        </nav>
        <a href="#login" className="fd-sspd-in">Log in</a>
      </header>
      <SeatStepperPricing />
    </div>
  );
}

const demoCss = `
:where(.fd-sspd,.fd-sspd *){box-sizing:border-box;margin:0;padding:0;font:inherit;color:inherit;text-decoration:none}
.fd-sspd{min-height:100vh;background:#FAFAF8;color:#111110;font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif}
.fd-sspd-nav{display:flex;align-items:center;justify-content:space-between;gap:20px;height:60px;padding:0 clamp(16px,4vw,56px);border-bottom:1px solid #E3E3DE}
.fd-sspd-logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:17px;letter-spacing:-.03em}
.fd-sspd-logo svg{display:block}
.fd-sspd-nav nav{display:flex;gap:24px;color:#6F6F6A;font-weight:500}
.fd-sspd-nav nav a[aria-current]{color:#111110}
.fd-sspd-in{font-weight:600}
@media (max-width:640px){.fd-sspd-nav nav{display:none}}
`;
