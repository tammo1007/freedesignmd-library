/**
 * PricingPlanCarousel, mobile-first plan picker for a fitness app. On phones
 * the plans are a horizontal scroll-snap carousel (peeking neighbours, synced
 * dots, the selected plan centred on load); from 900px they sit in a row.
 * Below, the free trial is explained as a timeline: today you unlock
 * everything, day 5 we remind you, day 7 you are charged the selected plan's
 * price. Day ticks fill one by one when the timeline scrolls into view.
 *
 * Props: plans ({ id, name, price, period, perMonth?, badge?, features[],
 * seats? }), defaultId, trialDays, reminderDay, title, lede, cta, fine.
 * CSS vars: --fd-ppc-bg, --fd-ppc-fg, --fd-ppc-volt, --fd-ppc-ink.
 *
 * Browser support: all evergreen browsers (CSS scroll snap).
 * Accessibility: plans are a radiogroup of real radio inputs (arrow keys
 * work); dots are buttons that scroll to a plan; the timeline is an ordered
 * list with the charge amount as text.
 * Reduced motion: no tick sweep, smooth scrolling becomes instant.
 */
import { useEffect, useId, useRef, useState } from "react";

export interface FitPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  perMonth?: string;
  badge?: string;
  features: string[];
}

export interface PricingPlanCarouselProps {
  plans?: FitPlan[];
  defaultId?: string;
  trialDays?: number;
  reminderDay?: number;
  currency?: string;
  title?: string;
  lede?: string;
  cta?: string;
  fine?: string;
  className?: string;
}

const PLANS: FitPlan[] = [
  { id: "monthly", name: "Monthly", price: 14.99, period: "month", features: ["Adaptive run and strength plans", "Apple Watch, Garmin and Coros sync", "Cancel any month"] },
  { id: "annual", name: "Annual", price: 79.99, period: "year", perMonth: "$6.67 a month", badge: "Most picked", features: ["Everything in Monthly", "Race-day pacing for 5K to marathon", "Coach chat, replies within 24 h", "Saves $99.89 vs monthly"] },
  { id: "duo", name: "Duo", price: 119.99, period: "year", perMonth: "$5.00 each a month", features: ["Two accounts, one bill", "Shared streaks and weekly leaderboard", "Swap training partner once a year"] },
];

export function PricingPlanCarousel({
  plans = PLANS,
  defaultId = "annual",
  trialDays = 7,
  reminderDay = 5,
  currency = "$",
  title = "Seven days on us. Then pick your pace.",
  lede = "Every plan unlocks all 340 sessions, from 12-minute mobility to 32 km long runs. You only choose how you pay.",
  cta = "Start 7 days free",
  fine = "Cancel in two taps: Settings, Membership, Cancel. No email, no phone call, no guilt trip.",
  className,
}: PricingPlanCarouselProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [sel, setSel] = useState(defaultId);
  const [active, setActive] = useState(Math.max(0, plans.findIndex((p) => p.id === defaultId)));
  const [seen, setSeen] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLLabelElement | null)[]>([]);
  const line = useRef<HTMLOListElement>(null);
  const plan = plans.find((p) => p.id === sel) ?? plans[0];

  const scrollTo = (i: number, smooth = true) => {
    const t = track.current;
    const c = cards.current[i];
    if (!t || !c || t.scrollWidth <= t.clientWidth) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    t.scrollTo({ left: c.offsetLeft - (t.clientWidth - c.offsetWidth) / 2, behavior: smooth && !reduce ? "smooth" : "auto" });
  };

  useEffect(() => {
    scrollTo(active, false);
    const t = track.current;
    if (!t) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mid = t.scrollLeft + t.clientWidth / 2;
        let best = 0;
        let d = Infinity;
        cards.current.forEach((c, i) => {
          if (!c) return;
          const dd = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
          if (dd < d) {
            d = dd;
            best = i;
          }
        });
        setActive(best);
      });
    };
    t.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      t.removeEventListener("scroll", onScroll);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = line.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const price = `${currency}${plan.price.toFixed(2)}`;
  const days = Array.from({ length: trialDays + 1 }, (_, i) => i);

  return (
    <section className={`fd-ppc${className ? " " + className : ""}`} aria-labelledby={`${uid}-t`}>
      <style>{css}</style>
      <div className="fd-ppc-head">
        <h2 className="fd-ppc-title" id={`${uid}-t`}>{title}</h2>
        <p className="fd-ppc-lede">{lede}</p>
      </div>

      <div className="fd-ppc-track" ref={track} role="radiogroup" aria-label="Plans">
        {plans.map((p, i) => (
          <label
            key={p.id}
            className="fd-ppc-card"
            data-on={p.id === sel ? "" : undefined}
            ref={(el) => {
              cards.current[i] = el;
            }}
          >
            <input
              type="radio"
              name={`${uid}-plan`}
              value={p.id}
              checked={p.id === sel}
              onChange={() => {
                setSel(p.id);
                scrollTo(i);
              }}
            />
            <span className="fd-ppc-top">
              <span className="fd-ppc-name">{p.name}</span>
              {p.badge && <span className="fd-ppc-badge">{p.badge}</span>}
              <span className="fd-ppc-tick" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.4l3 3 6-6.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </span>
            <span className="fd-ppc-price">
              <b>{currency}{Math.floor(p.price)}</b>
              <i>.{(p.price % 1).toFixed(2).slice(2)}</i>
              <em>/ {p.period}</em>
            </span>
            <span className="fd-ppc-pm">{p.perMonth ?? "Billed monthly"}</span>
            <span className="fd-ppc-feats">
              {p.features.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </span>
          </label>
        ))}
      </div>
      <div className="fd-ppc-dots">
        {plans.map((p, i) => (
          <button key={p.id} type="button" aria-label={`Show ${p.name} plan`} aria-current={i === active ? "true" : undefined} onClick={() => scrollTo(i)} />
        ))}
      </div>

      <div className="fd-ppc-trial">
        <p className="fd-ppc-trial-h">How the free week works</p>
        <ol className="fd-ppc-line" ref={line} data-seen={seen ? "" : undefined}>
          <li className="fd-ppc-days" aria-hidden="true">
            {days.map((d) => (
              <span
                key={d}
                data-k={d === 0 ? "start" : d === reminderDay ? "remind" : d === trialDays ? "charge" : undefined}
                style={{ ["--p" as string]: `${d <= reminderDay ? (d / reminderDay) * 50 : 50 + ((d - reminderDay) / (trialDays - reminderDay)) * 50}%`, transitionDelay: `${d * 90}ms` }}
              />
            ))}
          </li>
          <li className="fd-ppc-step" style={{ ["--at" as string]: 0 }}>
            <span className="fd-ppc-when">Today</span>
            <span className="fd-ppc-what">Everything unlocks. Your first plan builds from a 2-minute run test.</span>
          </li>
          <li className="fd-ppc-step" style={{ ["--at" as string]: reminderDay / trialDays }}>
            <span className="fd-ppc-when">Day {reminderDay}</span>
            <span className="fd-ppc-what">We remind you by push and email, 48 hours before anything is charged.</span>
          </li>
          <li className="fd-ppc-step fd-ppc-charge" style={{ ["--at" as string]: 1 }}>
            <span className="fd-ppc-when">Day {trialDays}</span>
            <span className="fd-ppc-what">
              You pay <b key={plan.id}>{price}</b> for {plan.name.toLowerCase()}. Cancel before and you pay nothing.
            </span>
          </li>
        </ol>
        <div className="fd-ppc-act">
          <a className="fd-ppc-cta" href="#trial">
            {cta}
            <span>then {price} / {plan.period}</span>
          </a>
          <p className="fd-ppc-fine">{fine}</p>
        </div>
      </div>
    </section>
  );
}

const css = `
:where(.fd-ppc,.fd-ppc *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-ppc,.fd-ppc *)::before,:where(.fd-ppc,.fd-ppc *)::after{box-sizing:border-box}
:where(.fd-ppc svg){display:block;flex-shrink:0}
:where(.fd-ppc button){appearance:none;-webkit-appearance:none;cursor:pointer}
.fd-ppc{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-ppc-bg:#1B2BF0;--fd-ppc-fg:#FFFFFF;--fd-ppc-volt:#DFFF3A;--fd-ppc-ink:#0B0C1A;
  --mut:rgba(255,255,255,.72);--line:rgba(255,255,255,.22);
  --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  display:block;width:100%;overflow:hidden;background:var(--fd-ppc-bg);color:var(--fd-ppc-fg);font:400 15px/22px var(--sans);-webkit-font-smoothing:antialiased;
  padding:clamp(40px,7vw,96px) 0 clamp(40px,6vw,80px)}
.fd-ppc-head,.fd-ppc-trial{max-width:1200px;margin:0 auto;padding:0 clamp(16px,4vw,56px)}
.fd-ppc-head{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:20px 56px;align-items:end}
.fd-ppc-title{font:900 clamp(2.5rem,5.6vw,4.75rem)/.92 var(--sans);font-style:italic;letter-spacing:-.045em;text-transform:uppercase}
.fd-ppc-lede{max-width:40ch;font-size:1rem;line-height:24px;color:var(--mut)}

.fd-ppc-track{max-width:1200px;margin:clamp(32px,5vw,56px) auto 0;padding:8px clamp(16px,4vw,56px) 4px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.fd-ppc-card{position:relative;display:flex;flex-direction:column;min-height:340px;padding:22px;border-radius:24px;cursor:pointer;color:var(--fd-ppc-fg);box-shadow:inset 0 0 0 1.5px var(--line);transition:background-color var(--fd-dur-2) var(--fd-ease-in-out),color var(--fd-dur-2),box-shadow var(--fd-dur-2),transform var(--fd-dur-2) var(--fd-spring)}
.fd-ppc-card:hover{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.6)}
.fd-ppc-card:active{transform:scale(.97);transition-duration:var(--fd-dur-1)}
.fd-ppc-card[data-on]{background:var(--fd-ppc-volt);color:var(--fd-ppc-ink);box-shadow:none}
.fd-ppc-card input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
.fd-ppc-card:has(input:focus-visible){outline:3px solid var(--fd-ppc-volt);outline-offset:3px}
.fd-ppc-top{display:flex;align-items:center;gap:8px}
.fd-ppc-name{font:900 1.375rem/28px var(--sans);font-style:italic;letter-spacing:-.03em;text-transform:uppercase}
.fd-ppc-badge{padding:3px 8px;border-radius:9999px;background:var(--fd-ppc-ink);color:var(--fd-ppc-volt);font:800 10px/14px var(--sans);letter-spacing:.08em;text-transform:uppercase}
.fd-ppc-card:not([data-on]) .fd-ppc-badge{background:var(--fd-ppc-volt);color:var(--fd-ppc-ink)}
.fd-ppc-tick{display:grid;place-items:center;width:28px;height:28px;margin-left:auto;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--line);color:transparent;transition:background-color var(--fd-dur-2),color var(--fd-dur-2),transform var(--fd-dur-3) var(--fd-spring)}
.fd-ppc-card[data-on] .fd-ppc-tick{background:var(--fd-ppc-ink);color:var(--fd-ppc-volt);box-shadow:none;transform:rotate(-8deg) scale(1.08)}
.fd-ppc-price{display:flex;align-items:baseline;padding-top:48px}
.fd-ppc-price b{font:900 clamp(3.5rem,6vw,4.75rem)/1 var(--sans);font-style:italic;letter-spacing:-.06em;font-variant-numeric:tabular-nums}
.fd-ppc-price i{font:900 1.5rem/1 var(--sans);font-style:italic;letter-spacing:-.03em}
.fd-ppc-price em{margin-left:8px;font:600 14px/20px var(--sans);font-style:normal;opacity:.75}
.fd-ppc-pm{margin:4px 0 24px;font:600 13px/18px var(--sans);opacity:.75}
.fd-ppc-feats{display:flex;flex-direction:column;gap:6px;margin-top:auto;padding-top:16px;border-top:1.5px solid currentColor;border-top-color:color-mix(in srgb,currentColor 25%,transparent)}
.fd-ppc-feats span{position:relative;padding-left:18px;font:500 14px/20px var(--sans)}
.fd-ppc-feats span::before{content:"";position:absolute;left:0;top:8px;width:9px;height:4px;background:currentColor;transform:skewX(-20deg)}
.fd-ppc-dots{display:none;justify-content:center;gap:8px;margin-top:18px}
.fd-ppc-dots button{width:8px;height:8px;border-radius:9999px;background:var(--line);transition:width var(--fd-dur-2) var(--fd-ease-out),background-color var(--fd-dur-2)}
.fd-ppc-dots button[aria-current]{width:28px;background:var(--fd-ppc-volt)}
.fd-ppc-dots button:focus-visible{outline:2px solid var(--fd-ppc-volt);outline-offset:3px}

.fd-ppc-trial{margin-top:clamp(40px,6vw,72px)}
.fd-ppc-trial-h{font:800 12px/16px var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--fd-ppc-volt)}
.fd-ppc-line{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-top:20px;padding-top:44px}
.fd-ppc-days{position:absolute;left:14px;right:14px;top:0;display:block;height:28px}
.fd-ppc-days::before{content:"";position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;background:var(--line)}
.fd-ppc-days span{position:absolute;left:var(--p);top:50%;margin:-5px 0 0 -5px;width:10px;height:10px;border-radius:50%;background:var(--fd-ppc-bg);box-shadow:inset 0 0 0 2px var(--line);transition:background-color var(--fd-dur-2),box-shadow var(--fd-dur-2),transform var(--fd-dur-3) var(--fd-spring)}
.fd-ppc-line[data-seen] .fd-ppc-days span{background:var(--fd-ppc-fg);box-shadow:none}
.fd-ppc-days span[data-k]{width:28px;height:28px;margin:-14px 0 0 -14px}
.fd-ppc-line[data-seen] .fd-ppc-days span[data-k]{transform:scale(1)}
.fd-ppc-days span[data-k]::after{content:"";position:absolute;inset:8px;border-radius:50%;background:var(--fd-ppc-bg)}
.fd-ppc-line[data-seen] .fd-ppc-days span[data-k="charge"]{background:var(--fd-ppc-volt)}
.fd-ppc-days span[data-k="charge"]::after{background:var(--fd-ppc-ink)}
.fd-ppc-step{display:flex;flex-direction:column;gap:6px}
.fd-ppc-step:nth-child(3){text-align:center;align-items:center}
.fd-ppc-step:nth-child(4){text-align:right;align-items:flex-end}
.fd-ppc-when{font:900 1.25rem/24px var(--sans);font-style:italic;letter-spacing:-.02em;text-transform:uppercase}
.fd-ppc-what{max-width:30ch;font-size:.875rem;line-height:21px;color:var(--mut)}
.fd-ppc-what b{display:inline-block;padding:0 6px;border-radius:6px;background:var(--fd-ppc-volt);color:var(--fd-ppc-ink);font-weight:800;animation:fd-ppc-pop var(--fd-dur-3) var(--fd-spring)}
@keyframes fd-ppc-pop{from{transform:scale(.6) rotate(-6deg)}to{transform:none}}
.fd-ppc-act{display:flex;flex-wrap:wrap;align-items:center;gap:16px 28px;margin-top:40px;padding-top:28px;border-top:1.5px solid var(--line)}
.fd-ppc-cta{display:inline-flex;flex-direction:column;justify-content:center;min-width:260px;height:64px;padding:0 28px;border-radius:9999px;background:var(--fd-ppc-volt);color:var(--fd-ppc-ink);font:900 1.25rem/24px var(--sans);font-style:italic;letter-spacing:-.02em;text-transform:uppercase;transition:transform var(--fd-dur-2) var(--fd-spring),background-color var(--fd-dur-1)}
.fd-ppc-cta span{font:600 12px/16px var(--sans);font-style:normal;letter-spacing:0;text-transform:none;opacity:.75}
.fd-ppc-cta:hover{background:#fff}
.fd-ppc-cta:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-ppc-cta:focus-visible{outline:3px solid #fff;outline-offset:3px}
.fd-ppc-fine{flex:1;min-width:220px;max-width:46ch;font-size:13px;line-height:20px;color:var(--mut)}

@media (max-width:899px){
  .fd-ppc-head{grid-template-columns:1fr}
  .fd-ppc-track{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 16px;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-left:16px;padding-right:16px}
  .fd-ppc-track::-webkit-scrollbar{display:none}
  .fd-ppc-card{flex:0 0 min(82%,340px);scroll-snap-align:center;min-height:360px}
  .fd-ppc-dots{display:flex}
  .fd-ppc-line{grid-template-columns:1fr;gap:28px;padding-top:0;padding-left:48px}
  .fd-ppc-days{left:0;right:auto;top:14px;bottom:14px;width:28px;height:auto}
  .fd-ppc-days span{left:50%;top:var(--p)}
  .fd-ppc-days::before{left:50%;right:auto;top:0;bottom:0;width:2px;height:auto;margin:0 0 0 -1px}
  .fd-ppc-step:nth-child(3),.fd-ppc-step:nth-child(4){text-align:left;align-items:flex-start}
  .fd-ppc-cta{width:100%}
}
@media (prefers-reduced-motion:reduce){.fd-ppc *{transition-duration:1ms!important;transition-delay:0ms!important;animation:none!important}}
@media (prefers-contrast:more){.fd-ppc{--line:#fff;--mut:#fff}}
`;

export function Demo() {
  return (
    <div className="fd-ppcd">
      <style>{demoCss}</style>
      <header className="fd-ppcd-nav">
        <a href="#home" className="fd-ppcd-logo">
          <svg width="26" height="16" viewBox="0 0 26 16" aria-hidden="true">
            <path d="M4 0h22l-4 16H0z" fill="#DFFF3A" />
            <path d="M9 4h12M7 8h12M5 12h8" stroke="#1B2BF0" strokeWidth="2" />
          </svg>
          HARDPACE
        </a>
        <a href="#login" className="fd-ppcd-in">Log in</a>
      </header>
      <PricingPlanCarousel />
    </div>
  );
}

const demoCss = `
:where(.fd-ppcd,.fd-ppcd *){box-sizing:border-box;margin:0;padding:0;font:inherit;color:inherit;text-decoration:none}
.fd-ppcd{min-height:100vh;background:#1B2BF0;color:#fff;font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif}
.fd-ppcd-nav{display:flex;align-items:center;justify-content:space-between;height:60px;padding:0 clamp(16px,4vw,56px);border-bottom:1.5px solid rgba(255,255,255,.18)}
.fd-ppcd-logo{display:flex;align-items:center;gap:10px;font-weight:900;font-style:italic;font-size:18px;letter-spacing:-.02em}
.fd-ppcd-logo svg{display:block}
.fd-ppcd-in{font-weight:700}
`;
