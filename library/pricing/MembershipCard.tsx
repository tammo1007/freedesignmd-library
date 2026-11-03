/**
 * MembershipCard — a single-plan pricing section for a premium clinic
 * membership, presented as the physical card members carry. The card tilts
 * in 3D toward the pointer (spring physics) with a light sheen that follows
 * it, and flips to its back (care-team line, signature strip) on click or
 * Enter. Beside it: the price, what is included and, just as clearly, what is
 * not.
 *
 * Props: brand, member ({ name, number, since, clinic }), price
 * ({ monthly, yearly, currency }), included / excluded ([title, detail][]),
 * title, lede, cta, backLines.
 * CSS vars: --fd-mc-bg, --fd-mc-ink, --fd-mc-card, --fd-mc-foil.
 *
 * Browser support: all evergreen browsers (3D transforms, backface-visibility).
 * Accessibility: the card is a real <button> with aria-pressed reflecting the
 * flip; both faces are readable text (the hidden face is aria-hidden). Lists
 * use <ul> with headings.
 * Reduced motion: no tilt or sheen; the flip is instant.
 */
import { useEffect, useRef, useState } from "react";

export interface MembershipCardProps {
  brand?: string;
  member?: { name: string; number: string; since: string; clinic: string };
  price?: { monthly: number; yearly: number; currency: string };
  title?: string;
  lede?: string;
  included?: [string, string][];
  excluded?: [string, string][];
  cta?: { label: string; href: string };
  backLines?: [string, string][];
  className?: string;
}

const INCLUDED: [string, string][] = [
  ["Unlimited GP appointments", "Same or next day, 30 minutes each, in person or video."],
  ["Annual health assessment", "90 minutes with your GP, bloods covering 42 markers, results explained in person."],
  ["A direct line to your care team", "WhatsApp or phone, 8am to 8pm, seven days. Median reply: 11 minutes."],
  ["Prescriptions and referrals", "Issued the same day. Referral letters within 24 hours."],
  ["Two physiotherapy sessions a year", "45 minutes each at our Marylebone clinic."],
];

const EXCLUDED: [string, string][] = [
  ["Emergency care", "Chest pain, a bad fall, anything urgent: call 999 or go to A&E."],
  ["Specialist and hospital fees", "We refer you and chase it. The consultant bills you or your insurer."],
  ["The cost of medication", "Your prescription is free; the pharmacy charges for what's on it."],
  ["Dental, optical and fertility care", "Not something we do well enough to include."],
];

const BACK: [string, string][] = [
  ["Care team", "+44 20 7946 0321"],
  ["WhatsApp", "8am to 8pm, 7 days"],
  ["Clinics", "Marylebone · Islington · Clapham"],
];

const serif = `"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif`;

export function MembershipCard({
  brand = "Marlow House",
  member = { name: "Priya Raman", number: "MH 0419 2286", since: "11 / 2026", clinic: "Marylebone" },
  price = { monthly: 115, yearly: 1240, currency: "£" },
  title = "One membership. A GP who knows your name by the second visit.",
  lede = "No tiers, no add-ons at the till. Join for yourself or add a partner at the same price. Cancel any month after the first three.",
  included = INCLUDED,
  excluded = EXCLUDED,
  cta = { label: "Become a member", href: "#join" },
  backLines = BACK,
  className,
}: MembershipCardProps) {
  const stage = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const st = stage.current;
    const el = tilt.current;
    if (!st || !el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const s = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, mx: 50, my: 30 };
    let raf = 0;
    let last = 0;
    const K = 380, C = 30;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      for (const k of ["x", "y"] as const) {
        const t = k === "x" ? s.tx : s.ty;
        const v = k === "x" ? "vx" : "vy";
        const a = K * (t - s[k]) - C * s[v];
        s[v] += a * dt;
        s[k] += s[v] * dt;
      }
      el.style.transform = `rotateX(${s.y.toFixed(2)}deg) rotateY(${s.x.toFixed(2)}deg)`;
      el.style.setProperty("--mx", `${s.mx}%`);
      el.style.setProperty("--my", `${s.my}%`);
      const still = Math.abs(s.tx - s.x) < 0.01 && Math.abs(s.ty - s.y) < 0.01 && Math.abs(s.vx) < 0.01 && Math.abs(s.vy) < 0.01;
      raf = still ? 0 : requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const move = (e: PointerEvent) => {
      const r = st.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      s.tx = (px - 0.5) * 22;
      s.ty = -(py - 0.5) * 18;
      s.mx = px * 100;
      s.my = py * 100;
      el.dataset.hover = "";
      kick();
    };
    const leave = () => {
      s.tx = 0;
      s.ty = 0;
      s.mx = 50;
      s.my = 30;
      delete el.dataset.hover;
      kick();
    };
    st.addEventListener("pointermove", move);
    st.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      st.removeEventListener("pointermove", move);
      st.removeEventListener("pointerleave", leave);
    };
  }, []);

  const saving = price.monthly * 12 - price.yearly;

  return (
    <section className={`fd-mc${className ? " " + className : ""}`} aria-label={`${brand} membership`}>
      <style>{css}</style>
      <div className="fd-mc-grid">
        <div className="fd-mc-stage" ref={stage}>
          <div className="fd-mc-tilt" ref={tilt}>
            <button type="button" className="fd-mc-card" aria-pressed={flipped} aria-label={flipped ? "Show front of membership card" : "Show back of membership card"} onClick={() => setFlipped((f) => !f)}>
              <span className="fd-mc-flip" data-flipped={flipped ? "" : undefined}>
                <span className="fd-mc-face fd-mc-front" aria-hidden={flipped}>
                  <span className="fd-mc-row">
                    <span className="fd-mc-brand">{brand}</span>
                    <span className="fd-mc-kind">Medical membership</span>
                  </span>
                  <svg className="fd-mc-seal" viewBox="0 0 120 120" aria-hidden="true">
                    <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="1" />
                    <circle cx="60" cy="60" r="49" fill="none" stroke="currentColor" strokeWidth=".6" strokeDasharray="1.5 3" />
                    <text x="60" y="70" textAnchor="middle" fill="currentColor" style={{ font: `italic 400 38px/1 ${serif}`, letterSpacing: "-1px" }}>MH</text>
                    <text x="60" y="92" textAnchor="middle" fill="currentColor" style={{ font: "500 7px/1 ui-monospace,Menlo,monospace", letterSpacing: "2px" }}>EST. 2019</text>
                  </svg>
                  <span className="fd-mc-chip" aria-hidden="true" />
                  <span className="fd-mc-bottom">
                    <span className="fd-mc-field">
                      <small>Member</small>
                      <b className="fd-mc-name">{member.name}</b>
                    </span>
                    <span className="fd-mc-field fd-mc-r">
                      <small>Since</small>
                      <b>{member.since}</b>
                    </span>
                  </span>
                  <span className="fd-mc-num">
                    {member.number} · {member.clinic}
                  </span>
                  <span className="fd-mc-sheen" aria-hidden="true" />
                </span>
                <span className="fd-mc-face fd-mc-back" aria-hidden={!flipped}>
                  <span className="fd-mc-stripe" />
                  <span className="fd-mc-back-body">
                    {backLines.map(([k, v]) => (
                      <span key={k} className="fd-mc-bl">
                        <small>{k}</small>
                        <b>{v}</b>
                      </span>
                    ))}
                    <span className="fd-mc-sig">
                      <svg viewBox="0 0 160 30" aria-hidden="true">
                        <path d="M4 22c10-16 16-16 14-4s8-14 14-10-2 14 6 10 10-12 16-8 0 10 8 8 14-14 22-10 4 10 12 6 16-8 24-4 10 4 20 2" fill="none" stroke="#3A2418" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className="fd-mc-fine">Not valid for emergency treatment. If found, please return to 41 Weymouth Street, London W1G 6NR.</span>
                  </span>
                </span>
              </span>
            </button>
          </div>
          <p className="fd-mc-hint">
            <span aria-hidden="true">↻</span> Tap the card to turn it over
          </p>
        </div>

        <div className="fd-mc-copy">
          <p className="fd-mc-eyebrow">Membership, 2026</p>
          <h2 className="fd-mc-title">{title}</h2>
          <p className="fd-mc-lede">{lede}</p>
          <div className="fd-mc-price">
            <p className="fd-mc-amt">
              <span className="fd-mc-cur">{price.currency}</span>
              {price.monthly}
              <span className="fd-mc-per">a month</span>
            </p>
            <p className="fd-mc-alt">
              or {price.currency}
              {price.yearly.toLocaleString("en-GB")} paid yearly, which saves {price.currency}
              {saving}. No joining fee.
            </p>
          </div>
          <a className="fd-mc-cta" href={cta.href}>
            {cta.label}
          </a>
        </div>
        <div className="fd-mc-lists">
            <div>
              <h3 className="fd-mc-lh">What&apos;s included</h3>
              <ul className="fd-mc-list">
                {included.map(([t, d]) => (
                  <li key={t}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M4.8 8.2l2.1 2 4.3-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>
                      <b>{t}</b>
                      {d}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="fd-mc-not">
              <h3 className="fd-mc-lh">What&apos;s not, honestly</h3>
              <ul className="fd-mc-list">
                {excluded.map(([t, d]) => (
                  <li key={t}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
                      <path d="M5.5 10.5l5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <span>
                      <b>{t}</b>
                      {d}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
        </div>
      </div>
    </section>
  );
}

const css = `
:where(.fd-mc,.fd-mc *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-mc,.fd-mc *)::before,:where(.fd-mc,.fd-mc *)::after{box-sizing:border-box}
:where(.fd-mc svg){display:block;flex-shrink:0}
:where(.fd-mc button){appearance:none;-webkit-appearance:none;cursor:pointer;text-align:left}
.fd-mc{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-mc-bg:#F1E8DA;--fd-mc-ink:#3A2418;--fd-mc-card:#8C3B22;--fd-mc-foil:#EBCB98;
  --mut:#7A6556;--line:rgba(58,36,24,.16);
  --serif:${serif};--sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  display:block;width:100%;background:var(--fd-mc-bg);color:var(--fd-mc-ink);font:400 15px/22px var(--sans);-webkit-font-smoothing:antialiased;
  padding:clamp(48px,7vw,104px) clamp(16px,4vw,56px)}
.fd-mc-grid{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);grid-template-areas:"stage copy" "stage lists";column-gap:clamp(40px,6vw,96px);align-items:start}
.fd-mc-stage{grid-area:stage}.fd-mc-copy{grid-area:copy}.fd-mc-lists{grid-area:lists}
.fd-mc-stage{position:sticky;top:32px;display:flex;flex-direction:column;align-items:center;padding:clamp(24px,4vw,56px) 0;perspective:1100px;touch-action:pan-y}
.fd-mc-tilt{width:100%;max-width:460px;transform-style:preserve-3d;will-change:transform;--mx:50%;--my:30%}
.fd-mc-card{display:block;width:100%;aspect-ratio:1.586;border-radius:18px;padding:0;background:none;transform-style:preserve-3d}
.fd-mc-card:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-mc-card) 70%,transparent);outline-offset:6px}
.fd-mc-flip{position:relative;display:block;width:100%;height:100%;transform-style:preserve-3d;transition:transform var(--fd-dur-4) var(--fd-ease-in-out)}
.fd-mc-flip[data-flipped]{transform:rotateY(180deg)}
.fd-mc-card:active .fd-mc-flip{transition-duration:var(--fd-dur-4)}
.fd-mc-face{position:absolute;inset:0;display:block;overflow:hidden;border-radius:18px;-webkit-backface-visibility:hidden;backface-visibility:hidden;box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 30px 50px -24px rgba(58,36,24,.55),0 8px 16px -8px rgba(58,36,24,.35)}
.fd-mc-front{padding:7% 7.5%;color:var(--fd-mc-foil);background:
  radial-gradient(120% 90% at 100% 0%,rgba(255,214,170,.22),transparent 55%),
  repeating-linear-gradient(115deg,rgba(255,255,255,.025) 0 2px,transparent 2px 5px),
  linear-gradient(160deg,#9C4529 0%,var(--fd-mc-card) 48%,#6A2A17 100%)}
.fd-mc-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.fd-mc-brand{font:400 clamp(1rem,2.2vw,1.375rem)/1 var(--serif);letter-spacing:.14em;text-transform:uppercase;font-variant:small-caps}
.fd-mc-kind{font:500 clamp(.5rem,1.1vw,.625rem)/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;opacity:.8}
.fd-mc-seal{position:absolute;right:7%;top:28%;width:26%;height:auto;opacity:.55}
.fd-mc-chip{position:absolute;left:7.5%;top:34%;width:13%;aspect-ratio:1.3;border-radius:5px;background:linear-gradient(135deg,#F3D9A9,#C99A5B 60%,#E9C88E);box-shadow:inset 0 0 0 1px rgba(90,50,20,.35)}
.fd-mc-chip::before{content:"";position:absolute;inset:30% 0;border-top:1px solid rgba(90,50,20,.35);border-bottom:1px solid rgba(90,50,20,.35)}
.fd-mc-chip::after{content:"";position:absolute;inset:0 38%;border-left:1px solid rgba(90,50,20,.35);border-right:1px solid rgba(90,50,20,.35)}
.fd-mc-bottom{position:absolute;left:7.5%;right:7.5%;bottom:19%;display:flex;justify-content:space-between;align-items:flex-end}
.fd-mc-field{display:flex;flex-direction:column;gap:4px}
.fd-mc-field small{font:500 clamp(.5rem,1vw,.5625rem)/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;opacity:.7}
.fd-mc-field b{font:400 clamp(1rem,2.4vw,1.5rem)/1.1 var(--serif);font-style:italic;letter-spacing:.005em;text-shadow:0 1px 0 rgba(0,0,0,.25)}
.fd-mc-r{text-align:right}
.fd-mc-r b{font:500 clamp(.75rem,1.6vw,.9375rem)/1.1 var(--mono);font-style:normal}
.fd-mc-num{position:absolute;left:7.5%;bottom:8%;font:500 clamp(.5625rem,1.2vw,.75rem)/1 var(--mono);letter-spacing:.18em;opacity:.75}
.fd-mc-sheen{position:absolute;inset:0;background:radial-gradient(55% 65% at var(--mx) var(--my),rgba(255,228,190,.16),transparent 70%);opacity:.5;transition:opacity var(--fd-dur-3)}
.fd-mc-tilt[data-hover] .fd-mc-sheen{opacity:1}
.fd-mc-back{transform:rotateY(180deg);background:#EFE3CF;color:var(--fd-mc-ink)}
.fd-mc-stripe{display:block;height:20%;margin-top:7%;background:#2A1A11}
.fd-mc-back-body{display:grid;grid-template-columns:1fr 1fr;gap:clamp(8px,2.4vw,14px) 6%;padding:5.5% 7.5%}
.fd-mc-bl{display:flex;flex-direction:column;gap:3px}
.fd-mc-bl small{font:500 clamp(.5rem,1vw,.5625rem)/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
.fd-mc-bl b{font:600 clamp(.6875rem,1.5vw,.875rem)/1.25 var(--sans)}
.fd-mc-sig{display:block;height:clamp(26px,5vw,36px);border-radius:3px;background:repeating-linear-gradient(-45deg,#F8F1E4 0 4px,#EADBC2 4px 6px);padding:3px 8px}
.fd-mc-sig svg{width:auto;height:100%}
.fd-mc-bl:nth-child(3){grid-column:1 / -1}
.fd-mc-fine{align-self:center;font:400 clamp(.5rem,1vw,.625rem)/1.4 var(--sans);color:var(--mut)}
.fd-mc-hint{margin-top:28px;display:flex;align-items:center;gap:8px;font:400 13px/20px var(--mono);color:var(--mut)}
.fd-mc-hint span{font-size:16px}

.fd-mc-eyebrow{font:500 12px/16px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--fd-mc-card)}
.fd-mc-title{margin-top:18px;font:400 clamp(2rem,3.8vw,3.25rem)/1.06 var(--serif);letter-spacing:-.02em;max-width:18ch}
.fd-mc-lede{margin-top:20px;max-width:48ch;font-size:1.0625rem;line-height:26px;color:var(--mut)}
.fd-mc-price{margin-top:36px;padding-top:24px;border-top:1px solid var(--line)}
.fd-mc-amt{display:flex;align-items:baseline;font:400 clamp(3.5rem,6vw,5rem)/1 var(--serif);letter-spacing:-.04em}
.fd-mc-cur{font-size:.5em;align-self:flex-start;margin:.2em .06em 0 0}
.fd-mc-per{margin-left:12px;font:400 15px/22px var(--sans);letter-spacing:0;color:var(--mut)}
.fd-mc-alt{margin-top:10px;font-size:.875rem;line-height:22px;color:var(--mut)}
.fd-mc-cta{display:inline-flex;align-items:center;justify-content:center;margin-top:24px;height:52px;padding:0 28px;border-radius:9999px;background:var(--fd-mc-ink);color:var(--fd-mc-bg);font:600 15px/52px var(--sans);transition:background-color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-mc-cta:hover{background:var(--fd-mc-card)}
.fd-mc-cta:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-mc-cta:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-mc-card) 70%,transparent);outline-offset:2px}
.fd-mc-lists{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:48px}
.fd-mc-lh{padding-bottom:12px;border-bottom:1px solid var(--line);font:500 12px/16px var(--mono);letter-spacing:.1em;text-transform:uppercase}
.fd-mc-list{display:grid;gap:16px;margin-top:16px}
.fd-mc-list li{display:flex;gap:12px;font-size:.875rem;line-height:21px;color:var(--mut)}
.fd-mc-list svg{margin-top:2px;color:#4F7A52}
.fd-mc-list b{display:block;font-weight:600;color:var(--fd-mc-ink)}
.fd-mc-not .fd-mc-list svg{color:var(--fd-mc-card)}
.fd-mc-not{padding-left:24px;border-left:1px dashed var(--line)}
@media (max-width:960px){
  .fd-mc-grid{grid-template-columns:1fr;grid-template-areas:"copy" "stage" "lists"}
  .fd-mc-stage{position:relative;top:0;padding:48px 8px 0}
  .fd-mc-lists{margin-top:40px}
}
@media (max-width:600px){
  .fd-mc-lists{grid-template-columns:1fr;gap:36px}
  .fd-mc-not{padding-left:0;border-left:0}
}
@media (prefers-reduced-motion:reduce){.fd-mc *{transition-duration:1ms!important}}
@media (prefers-contrast:more){.fd-mc{--line:var(--fd-mc-ink)}.fd-mc-sheen{display:none}}
`;

export function Demo() {
  return (
    <div className="fd-mcd">
      <style>{demoCss}</style>
      <header className="fd-mcd-nav">
        <a href="#home" className="fd-mcd-logo">
          Marlow House
          <span>Medical</span>
        </a>
        <nav aria-label="Main">
          <a href="#doctors">Our doctors</a>
          <a href="#membership" aria-current="page">Membership</a>
          <a href="#clinics">Clinics</a>
        </nav>
        <a href="#book" className="fd-mcd-book">020 7946 0321</a>
      </header>
      <MembershipCard />
    </div>
  );
}

const demoCss = `
:where(.fd-mcd,.fd-mcd *){box-sizing:border-box;margin:0;padding:0;font:inherit;color:inherit;text-decoration:none}
.fd-mcd{min-height:100vh;background:#F1E8DA;color:#3A2418;font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif}
.fd-mcd-nav{display:flex;align-items:center;justify-content:space-between;gap:20px;height:68px;padding:0 clamp(16px,4vw,56px);border-bottom:1px solid rgba(58,36,24,.14)}
.fd-mcd-logo{display:flex;align-items:baseline;gap:8px;font:400 20px/24px ${serif};letter-spacing:.1em;text-transform:uppercase}
.fd-mcd-logo span{font:500 10px/12px ui-monospace,Menlo,monospace;letter-spacing:.16em;color:#8C3B22}
.fd-mcd-nav nav{display:flex;gap:28px;color:#7A6556}
.fd-mcd-nav nav a[aria-current]{color:#3A2418;text-decoration:underline;text-underline-offset:6px;text-decoration-color:#8C3B22}
.fd-mcd-book{font:500 13px/20px ui-monospace,Menlo,monospace}
@media (max-width:760px){.fd-mcd-nav nav{display:none}.fd-mcd-logo{font-size:17px}}
`;
