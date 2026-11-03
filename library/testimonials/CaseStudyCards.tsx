/**
 * CaseStudyCards — customer stories as cards: a typographic company
 * wordmark, one headline metric that counts up when the card scrolls into
 * view, a before/after bar, a short quote with portrait and a link to the
 * full story. Asymmetric 7/5 grid on desktop, swipeable snap row on mobile.
 *
 * Props: stories (Story[]), eyebrow, title, intro, className.
 * Story: { company, logo (ReactNode wordmark), sector, city, value, decimals?,
 *   prefix?, suffix?, metric, before, after, ratio (after/before, 0..1),
 *   quote, name, role, portrait, href }
 *
 * Browser support: all evergreen browsers (IntersectionObserver, scroll-snap).
 * Accessibility: each card is an <article>; the animated number has the final
 * value as its accessible text from the first render; the mobile row is a
 * labelled, keyboard-scrollable region with a live position counter.
 * Reduced motion: numbers and bars render at their final values, no count-up.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

export interface Story {
  company: string;
  logo: ReactNode;
  sector: string;
  city: string;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  metric: string;
  before: string;
  after: string;
  /** after / before, used for the bar (0..1). Use >1 for growth metrics. */
  ratio: number;
  quote: string;
  name: string;
  role: string;
  portrait: string;
  href: string;
}

export interface CaseStudyCardsProps {
  stories?: Story[];
  eyebrow?: string;
  title?: string;
  intro?: string;
  className?: string;
}

const P = "/img/people/";
const SANS = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const MONO = `ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace`;
const SERIF = `"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif`;

/* ── wordmarks: real type + a small mark, no grey rectangles ── */
export const Northvane = () => (
  <span className="fd-csc-wm" style={{ gap: 10 }} aria-label="Northvane Freight">
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M11 1l5 14h-10z" fill="currentColor" /><path d="M11 15v6M7 21h8" stroke="currentColor" strokeWidth="1.6" /></svg>
    <span aria-hidden="true" style={{ font: `800 15px/1 ${SANS}`, letterSpacing: ".22em" }}>NORTHVANE</span>
    <span aria-hidden="true" style={{ font: `400 10px/1 ${MONO}`, letterSpacing: ".12em", opacity: 0.6, alignSelf: "flex-end", paddingBottom: 3 }}>FREIGHT</span>
  </span>
);
export const HaldenRoe = () => (
  <span className="fd-csc-wm" aria-label="Halden and Roe">
    <span aria-hidden="true" style={{ font: `400 21px/1 ${SERIF}`, letterSpacing: "-.01em" }}>Halden <i style={{ font: `italic 400 23px/1 ${SERIF}`, color: "var(--fd-csc-brass)" }}>&amp;</i> Roe</span>
  </span>
);
export const Kiruna = () => (
  <span className="fd-csc-wm" style={{ gap: 9 }} aria-label="Kiruna Cold Chain">
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1v18M2.2 5.5l15.6 9M2.2 14.5l15.6-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><circle cx="10" cy="10" r="2.6" fill="var(--fd-csc-card)" stroke="currentColor" strokeWidth="1.7" /></svg>
    <span aria-hidden="true" style={{ font: `600 16px/1 ${MONO}`, letterSpacing: "-.02em" }}>kiruna<span style={{ opacity: 0.55 }}>/cold</span></span>
  </span>
);
export const MossPay = () => (
  <span className="fd-csc-wm" style={{ gap: 6 }} aria-label="Moss Pay">
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="currentColor" /><path d="M5 11.5c1.2-3.6 2.3-5 4-5s2.8 1.4 4 5" fill="none" stroke="var(--fd-csc-card)" strokeWidth="1.8" strokeLinecap="round" /></svg>
    <span aria-hidden="true" style={{ font: `800 20px/1 ${SANS}`, letterSpacing: "-.055em" }}>moss<span style={{ fontWeight: 400 }}>pay</span></span>
  </span>
);

export const DEFAULT_STORIES: Story[] = [
  { company: "Northvane Freight", logo: <Northvane />, sector: "Logistics", city: "Rotterdam", value: 38, prefix: "−", suffix: "%", metric: "month-end close time", before: "9.5 days", after: "5.9 days", ratio: 0.62,
    quote: "Carrier invoices lived in a 40-tab spreadsheet that only Pieter understood. Pieter is on holiday this week. Nobody has noticed, which I mean as a compliment to him.", name: "Joris van Dam", role: "Group Controller", portrait: P + "p7.webp", href: "#northvane" },
  { company: "Halden & Roe", logo: <HaldenRoe />, sector: "Payments", city: "London", value: 2.3, decimals: 1, prefix: "£", suffix: "M", metric: "duplicate payouts caught, year one", before: "£0.4M found", after: "£2.3M found", ratio: 1,
    quote: "The first week it flagged 61 duplicate payouts we had already written off as timing. I printed the report and walked it to the CFO myself.", name: "Aisha Bello", role: "Head of Payment Ops", portrait: P + "p3.webp", href: "#halden-roe" },
  { company: "Kiruna Cold Chain", logo: <Kiruna />, sector: "Logistics", city: "Gothenburg", value: 71, prefix: "−", suffix: "%", metric: "unmatched freight invoices", before: "1,240 / mo", after: "360 / mo", ratio: 0.29,
    quote: "Unmatched invoices went from a weekly fire drill to a line on Thursday's agenda. Our auditors asked what changed, the nicest thing an auditor has ever said to me.", name: "Daniel Cho", role: "Finance Systems Lead", portrait: P + "p8.webp", href: "#kiruna" },
  { company: "Moss Pay", logo: <MossPay />, sector: "Fintech", city: "Berlin", value: 11, suffix: " hrs", metric: "saved per analyst, every close", before: "26 hrs", after: "15 hrs", ratio: 0.58,
    quote: "Every vendor says automated. This is the first one where my team actually deleted the old macros, and nobody asked for them back after the March close.", name: "Ananya Iyer", role: "VP Finance", portrait: P + "p6.webp", href: "#moss-pay" },
];

function useCountUp(target: number, decimals: number, el: RefObject<HTMLElement | null>) {
  const [v, setV] = useState(target);
  /** "done" = final value shown, "wait" = armed, waiting to scroll in, "run" = counting */
  const [phase, setPhase] = useState<"done" | "wait" | "run">("done");
  useLayoutEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") return;
    setV(0);
    setPhase("wait");
  }, []);
  useEffect(() => {
    const node = el.current;
    if (!node || phase !== "wait") return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setPhase("run"); }, { threshold: 0.45 });
    io.observe(node);
    return () => io.disconnect();
  }, [phase, el]);
  useEffect(() => {
    if (phase !== "run") return;
    let raf = 0;
    const t0 = performance.now();
    const D = 1500;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / D);
      setV(+(target * (1 - Math.pow(1 - k, 4))).toFixed(decimals));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, target, decimals]);
  return [v, phase !== "wait"] as const;
}

function Card({ s, i }: { s: Story; i: number }) {
  const ref = useRef<HTMLElement>(null);
  const d = s.decimals ?? 0;
  const [v, live] = useCountUp(s.value, d, ref);
  const shown = `${s.prefix ?? ""}${v.toFixed(d)}${s.suffix ?? ""}`;
  const final = `${s.prefix ?? ""}${s.value.toFixed(d)}${s.suffix ?? ""}`;
  const grow = s.ratio >= 1;
  return (
    <article ref={ref} className="fd-csc-card" data-wide={i % 3 === 0 || undefined} data-live={live || undefined} data-grow={grow || undefined} aria-labelledby={`fd-csc-h-${i}`}>
      <header className="fd-csc-top">
        <span className="fd-csc-logo">{s.logo}</span>
        <span className="fd-csc-tag">{s.sector} · {s.city}</span>
      </header>
      <div className="fd-csc-metric">
        <p className="fd-csc-num" id={`fd-csc-h-${i}`} aria-label={`${final} ${s.metric}, ${s.company}`}>
          <span aria-hidden="true">{shown}</span>
        </p>
        <p className="fd-csc-label">{s.metric}</p>
      </div>
      <div className="fd-csc-bars" aria-hidden="true">
        <div className="fd-csc-bar"><span>Before</span><i style={{ ["--w" as string]: grow ? 0.18 : 1 }} /><b>{s.before}</b></div>
        <div className="fd-csc-bar" data-after=""><span>After</span><i style={{ ["--w" as string]: grow ? 1 : s.ratio }} /><b>{s.after}</b></div>
      </div>
      <blockquote className="fd-csc-quote"><p>{s.quote}</p></blockquote>
      <footer className="fd-csc-foot">
        <img className="fd-csc-av" src={s.portrait} alt="" width={40} height={40} loading="lazy" decoding="async" />
        <span className="fd-csc-who"><b>{s.name}</b><span>{s.role}, {s.company}</span></span>
        <a className="fd-csc-link" href={s.href}>
          Read the story<span className="fd-csc-sr"> of {s.company}</span>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      </footer>
    </article>
  );
}

export function CaseStudyCards({
  stories = DEFAULT_STORIES,
  eyebrow = "Customer ledger · 2026",
  title = "Finance teams that close on day two, and what it took.",
  intro = "340 finance teams run their close on Ledgerline. Four of them agreed to show the numbers, before and after, with nothing rounded in our favour.",
  className,
}: CaseStudyCardsProps) {
  const row = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(1);
  const onScroll = () => {
    const el = row.current;
    if (!el) return;
    const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth;
    setPos(Math.min(stories.length, Math.round(el.scrollLeft / (w + 12)) + 1));
  };
  return (
    <section className={`fd-csc${className ? " " + className : ""}`} aria-label="Customer stories">
      <style>{css}</style>
      <div className="fd-csc-head">
        <p className="fd-csc-eyebrow"><i aria-hidden="true" />{eyebrow}</p>
        <h2 className="fd-csc-title">{title}</h2>
        <p className="fd-csc-intro">{intro}</p>
      </div>
      <div className="fd-csc-grid" ref={row} onScroll={onScroll} role="region" aria-label="Customer story cards" tabIndex={0}>
        {stories.map((s, i) => <Card key={s.company} s={s} i={i} />)}
      </div>
      <p className="fd-csc-pager" aria-live="polite"><b>{String(pos).padStart(2, "0")}</b> / {String(stories.length).padStart(2, "0")}<span>Swipe for more</span></p>
    </section>
  );
}

const css = `
.fd-csc,.fd-csc *,.fd-csc *::before,.fd-csc *::after{box-sizing:border-box}
.fd-csc{--fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-csc-bg:#0B1626;--fd-csc-card:#102036;--fd-csc-fg:#EEF0EA;--fd-csc-mut:#8E9CAE;--fd-csc-line:rgba(238,240,234,.1);--fd-csc-brass:#D2AE63;
  display:block;max-width:1240px;margin:0 auto;padding:88px 32px 96px;background:var(--fd-csc-bg);color:var(--fd-csc-fg);
  font:400 15px/1.5 ${SANS};letter-spacing:-.003em;-webkit-font-smoothing:antialiased}
.fd-csc-head{display:grid;grid-template-columns:7fr 5fr;column-gap:48px;row-gap:20px;align-items:end;margin:0 0 56px;padding:0}
.fd-csc-eyebrow{grid-column:1 / -1;display:flex;align-items:center;gap:12px;margin:0;padding:0;font:500 12px/1 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:var(--fd-csc-brass)}
.fd-csc-eyebrow i{display:block;width:28px;height:1px;background:currentColor}
.fd-csc-title{margin:0;padding:0;max-width:16ch;font:600 clamp(2.25rem,4.4vw,3.5rem)/1.02 ${SANS};letter-spacing:-.035em;color:var(--fd-csc-fg);text-wrap:balance}
.fd-csc-intro{margin:0;padding:0 0 6px;max-width:40ch;font:400 1.0625rem/1.55 ${SANS};color:var(--fd-csc-mut)}
.fd-csc-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;margin:0;padding:0;outline:none}
.fd-csc-grid:focus-visible{outline:2px solid rgba(210,174,99,.7);outline-offset:4px;border-radius:4px}
.fd-csc-card{grid-column:span 5;position:relative;display:flex;flex-direction:column;margin:0;padding:28px 28px 22px;border-radius:20px;background:var(--fd-csc-card);color:var(--fd-csc-fg);box-shadow:inset 0 0 0 1px var(--fd-csc-line);
  transition:box-shadow var(--fd-dur-3) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-ease-out)}
.fd-csc-card[data-wide]{grid-column:span 7}
.fd-csc-card:hover{box-shadow:inset 0 0 0 1px rgba(210,174,99,.45);transform:translateY(-2px)}
.fd-csc-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0;padding:0 0 20px;border-bottom:1px solid var(--fd-csc-line)}
.fd-csc-logo{display:flex;align-items:center;min-height:24px;color:var(--fd-csc-fg)}
.fd-csc-wm{display:inline-flex;align-items:center;white-space:nowrap;color:inherit}
.fd-csc-wm svg{display:block}
.fd-csc-tag{font:500 11px/1 ${MONO};letter-spacing:.1em;text-transform:uppercase;color:var(--fd-csc-mut);white-space:nowrap}
.fd-csc-metric{margin:0;padding:32px 0 20px}
.fd-csc-num{margin:0;padding:0;font:300 clamp(3.5rem,6.4vw,5.5rem)/.92 ${SANS};letter-spacing:-.05em;color:var(--fd-csc-fg);font-variant-numeric:tabular-nums;white-space:nowrap}
.fd-csc-card[data-wide] .fd-csc-num{color:var(--fd-csc-brass)}
.fd-csc-label{margin:12px 0 0;padding:0;font:500 0.9375rem/1.3 ${SANS};color:var(--fd-csc-fg)}
.fd-csc-bars{display:grid;gap:6px;margin:0 0 24px;padding:0}
.fd-csc-bar{display:grid;grid-template-columns:52px 1fr 96px;align-items:center;gap:12px;font:400 11px/1 ${MONO};letter-spacing:.04em;color:var(--fd-csc-mut)}
.fd-csc-bar span{text-transform:uppercase}
.fd-csc-bar i{display:block;height:6px;border-radius:9999px;background:rgba(238,240,234,.18);transform-origin:0 50%;transform:scaleX(var(--w));transition:transform 1500ms var(--fd-ease-out) 120ms}
.fd-csc-bar[data-after] i{background:var(--fd-csc-brass)}
.fd-csc-card:not([data-live]) .fd-csc-bar[data-after] i{transform:scaleX(1)}
.fd-csc-card[data-grow]:not([data-live]) .fd-csc-bar[data-after] i{transform:scaleX(.18)}
.fd-csc-bar b{font-weight:500;text-align:right;color:var(--fd-csc-fg);font-variant-numeric:tabular-nums}
.fd-csc-quote{flex:1;margin:0;padding:0}
.fd-csc-quote p{margin:0;padding:0;max-width:52ch;font:400 0.9375rem/1.6 ${SANS};color:#C9D0D9;text-wrap:pretty}
.fd-csc-quote p::before{content:"\\201C";color:var(--fd-csc-brass)}
.fd-csc-quote p::after{content:"\\201D";color:var(--fd-csc-brass)}
.fd-csc-foot{display:flex;align-items:center;gap:12px;margin:24px 0 0;padding:18px 0 0;border-top:1px solid var(--fd-csc-line)}
.fd-csc-av{display:block;flex:none;width:40px;height:40px;border-radius:50%;object-fit:cover;object-position:50% 25%;background:#1B2C44}
.fd-csc-who{display:flex;flex-direction:column;min-width:0;flex:1}
.fd-csc-who b{font:600 14px/1.3 ${SANS};letter-spacing:-.01em;color:var(--fd-csc-fg)}
.fd-csc-who span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:400 13px/1.35 ${SANS};color:var(--fd-csc-mut)}
.fd-csc-link{display:inline-flex;align-items:center;gap:8px;flex:none;height:36px;margin:0;padding:0 4px 0 14px;border-radius:9999px;font:500 13px/1 ${SANS};letter-spacing:0;color:var(--fd-csc-fg);text-decoration:none;box-shadow:inset 0 0 0 1px var(--fd-csc-line);
  transition:background-color var(--fd-dur-2),color var(--fd-dur-2),box-shadow var(--fd-dur-2)}
.fd-csc-link svg{display:block;width:28px;height:28px;padding:6px;border-radius:50%;background:rgba(238,240,234,.08);transition:transform var(--fd-dur-3) var(--fd-spring),background-color var(--fd-dur-2)}
.fd-csc-card:hover .fd-csc-link svg{transform:translateX(2px);background:var(--fd-csc-brass);color:var(--fd-csc-bg)}
.fd-csc-link:hover{box-shadow:inset 0 0 0 1px rgba(210,174,99,.6)}
.fd-csc-link:active{transform:scale(.96)}
.fd-csc-link:focus-visible{outline:2px solid rgba(210,174,99,.7);outline-offset:2px}
.fd-csc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.fd-csc-pager{display:none}
@media (max-width:900px){
  .fd-csc{padding:64px 0 72px}
  .fd-csc-head{grid-template-columns:1fr;margin-bottom:36px;padding:0 16px}
  .fd-csc-grid{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 16px 4px;scroll-padding:0 16px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .fd-csc-grid::-webkit-scrollbar{display:none}
  .fd-csc-card,.fd-csc-card[data-wide]{flex:none;width:min(86vw,420px);scroll-snap-align:start;padding:24px 22px 18px}
  .fd-csc-card:hover{transform:none}
  .fd-csc-num{font-size:4rem}
  .fd-csc-top{flex-wrap:wrap;row-gap:10px}
  .fd-csc-tag{flex-basis:100%}
  .fd-csc-link{padding:0;gap:0;width:36px;justify-content:center;font-size:0;box-shadow:none}
  .fd-csc-link svg{width:36px;height:36px;padding:9px}
  .fd-csc-pager{display:flex;align-items:center;gap:6px;margin:20px 0 0;padding:0 16px;font:400 12px/1 ${MONO};letter-spacing:.08em;color:var(--fd-csc-mut)}
  .fd-csc-pager b{font-weight:600;color:var(--fd-csc-fg)}
  .fd-csc-pager span{margin-left:auto;text-transform:uppercase}
}
@media (prefers-reduced-motion:reduce){.fd-csc *{transition-duration:1ms!important}.fd-csc-card:hover{transform:none}}
@media (prefers-contrast:more){.fd-csc{--fd-csc-line:rgba(238,240,234,.5);--fd-csc-mut:#B5C0CD}}
`;

export function Demo() {
  return (
    <div className="fd-cscd">
      <style>{demoCss}</style>
      <header className="fd-cscd-bar">
        <span className="fd-cscd-logo">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 4h16M2 10h10M2 16h16" stroke="#D2AE63" strokeWidth="2" strokeLinecap="square" /></svg>
          Ledgerline
        </span>
        <span className="fd-cscd-crumb">Customers</span>
        <a className="fd-cscd-cta" href="#demo">Book a close review</a>
      </header>
      <CaseStudyCards />
    </div>
  );
}

const demoCss = `
.fd-cscd,.fd-cscd *{box-sizing:border-box}
.fd-cscd{min-height:100vh;margin:0;padding:0;background:#0B1626;font:400 14px/1.4 ${SANS}}
.fd-cscd-bar{display:flex;align-items:center;gap:20px;max-width:1240px;height:64px;margin:0 auto;padding:0 32px;border-bottom:1px solid rgba(238,240,234,.08)}
.fd-cscd-logo{display:inline-flex;align-items:center;gap:10px;font:650 17px/1 ${SANS};letter-spacing:-.03em;color:#EEF0EA}
.fd-cscd-logo svg{display:block}
.fd-cscd-crumb{padding-left:20px;border-left:1px solid rgba(238,240,234,.14);font:400 13px/1 ${SANS};color:#8E9CAE}
.fd-cscd-cta{margin-left:auto;display:inline-flex;align-items:center;height:36px;padding:0 16px;border-radius:9999px;background:#EEF0EA;color:#0B1626;font:600 13px/1 ${SANS};text-decoration:none}
.fd-cscd-cta:hover{background:#D2AE63}
.fd-cscd-cta:focus-visible{outline:2px solid rgba(210,174,99,.7);outline-offset:2px}
@media (max-width:900px){.fd-cscd-bar{padding:0 16px}.fd-cscd-crumb{display:none}}
`;
