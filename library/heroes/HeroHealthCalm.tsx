/**
 * HeroHealthCalm, a warm, unhurried hero for a digital clinic. A breathing
 * gradient orb (6s inhale / exhale) sits behind a stack of appointment cards
 * that fans out on load and gently re-stacks as the section scrolls away.
 * The pointer lifts the hovered card; trust stats sit below the headline.
 *
 * Props: title, lede, primaryCta, secondaryCta, appointments
 * ({ who, role, when, kind, tone, photo? }[]), stats ({ value, label }[]).
 * CSS vars: --fd-clm-paper, --fd-clm-ink, --fd-clm-accent, --fd-clm-orb-a/b/c.
 *
 * Demo images: /img/people/pN.webp (in the repo's public/img/people, copy next to your page or swap in your own).
 *
 * Browser support: all evergreen browsers.
 * Motion: long, low-amplitude CSS loops (breathing), CSS fan-out entrance,
 * pointer parallax on a soft spring, scroll re-stack via rAF +
 * getBoundingClientRect (transform only, paused off-screen).
 * prefers-reduced-motion: cards rest fanned, orb is still.
 * Accessibility: the card stack is a list with readable text; the orb is
 * decorative.
 */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export type Appointment = { who: string; role: string; when: string; kind: string; tone: "sage" | "peach" | "sky"; photo?: string };
export type CalmStat = { value: string; label: string };

export interface HeroHealthCalmProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  appointments?: Appointment[];
  stats?: CalmStat[];
}

const DEFAULT_APPTS: Appointment[] = [
  { who: "Dr. Leila Haddad", role: "General practice", when: "Today · 4:30 pm", kind: "Video visit · 20 min", tone: "sage", photo: "/img/people/p6.webp" },
  { who: "Sam Whitlock, RD", role: "Nutrition", when: "Thu 14 Nov · 9:00 am", kind: "Follow-up · 30 min", tone: "peach", photo: "/img/people/p7.webp" },
  { who: "Dr. Mateo Ruiz", role: "Dermatology", when: "Mon 18 Nov · 11:15 am", kind: "Photo review · async", tone: "sky", photo: "/img/people/p4.webp" },
];

const DEFAULT_STATS: CalmStat[] = [
  { value: "11 min", label: "median wait for a same-day visit" },
  { value: "4.9", label: "average rating from 62,000 patients" },
  { value: "HSA/FSA", label: "eligible · most insurers accepted" },
];

export function HeroHealthCalm({
  eyebrow = "Primary care, membership included",
  title = (
    <>
      A doctor who knows you,
      <br />
      <em>whenever you need one.</em>
    </>
  ),
  lede = "Same-day video visits, a care team that answers within the hour, and prescriptions sent to your pharmacy before you’ve put the kettle on.",
  primaryCta = { label: "Book your first visit", href: "#book" },
  secondaryCta = { label: "Check your coverage", href: "#coverage" },
  appointments = DEFAULT_APPTS,
  stats = DEFAULT_STATS,
}: HeroHealthCalmProps) {
  const root = useRef<HTMLElement>(null);
  const stack = useRef<HTMLOListElement>(null);
  const orb = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sp = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      sp.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      sp.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    el.addEventListener("pointermove", onMove);
    let raf = 0;
    let visible = true;
    const frame = () => {
      raf = 0;
      sp.x += (sp.tx - sp.x) * 0.045;
      sp.y += (sp.ty - sp.y) * 0.045;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height * 0.7)));
      if (stack.current) {
        stack.current.style.setProperty("--fan", (1 - p).toFixed(4));
        stack.current.style.transform = `translate3d(${(sp.x * 10).toFixed(2)}px, ${(sp.y * 8 + p * -40).toFixed(2)}px, 0) rotateX(${(-sp.y * 4).toFixed(2)}deg) rotateY(${(sp.x * 6).toFixed(2)}deg)`;
      }
      if (orb.current) orb.current.style.transform = `translate3d(${(sp.x * -24).toFixed(2)}px, ${(sp.y * -18 + p * 80).toFixed(2)}px, 0) scale(${(1 + p * 0.25).toFixed(4)})`;
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", start);
      el.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <section ref={root} className="fd-clm" aria-label="Tend Health">
      <style>{css}</style>
      <div className="fd-clm-grid">
        <div className="fd-clm-copy">
          <p className="fd-clm-eyebrow">
            <span className="fd-clm-pulse" aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 className="fd-clm-h1">{title}</h1>
          <p className="fd-clm-lede">{lede}</p>
          <div className="fd-clm-ctas">
            <a className="fd-clm-btn" href={primaryCta.href}>
              {primaryCta.label}
            </a>
            <a className="fd-clm-link" href={secondaryCta.href}>
              {secondaryCta.label}
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
          <dl className="fd-clm-stats">
            {stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="fd-clm-visual">
          <div ref={orb} className="fd-clm-orbwrap" aria-hidden="true">
            <div className="fd-clm-orb" />
            <div className="fd-clm-ring" />
            <div className="fd-clm-ring fd-clm-ring-2" />
          </div>
          <ol ref={stack} className="fd-clm-stack" aria-label="Upcoming appointments">
            {appointments.map((a, i) => (
              <li key={a.who} className={`fd-clm-card fd-clm-${a.tone}`} style={{ ["--i" as string]: i, ["--fy" as string]: `${[0, 206, 334][i] ?? i * 128}px` }}>
                <div className="fd-clm-card-top">
                  <span className="fd-clm-av" aria-hidden="true">
                    {a.photo ? (
                      <img src={a.photo} alt="" width={44} height={44} loading="lazy" decoding="async" />
                    ) : (
                      a.who.replace(/^Dr\. /, "").split(" ").map((w) => w[0]).slice(0, 2).join("")
                    )}
                  </span>
                  <div className="fd-clm-who">
                    <b>{a.who}</b>
                    <span>{a.role}</span>
                  </div>
                  {i === 0 && <span className="fd-clm-live">Ready</span>}
                </div>
                <div className="fd-clm-card-bot">
                  <span className="fd-clm-when">
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M8 4.8V8l2.2 1.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    {a.when}
                  </span>
                  <span className="fd-clm-kind">{a.kind}</span>
                </div>
                {i === 0 && (
                  <div className="fd-clm-join">
                    <span>Join waiting room</span>
                    <span className="fd-clm-dots" aria-hidden="true">
                      <i /><i /><i />
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

const css = `
.fd-clm, .fd-clm *, .fd-clm *::before, .fd-clm *::after { box-sizing: border-box; }
.fd-clm {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-clm-paper: #FBF7F1;
  --fd-clm-ink: #1F2A24;
  --fd-clm-muted: #66706A;
  --fd-clm-accent: #2F5D4A;
  --fd-clm-orb-a: #F6C8A8;
  --fd-clm-orb-b: #CFE3D2;
  --fd-clm-orb-c: #F3E2B8;
  --fd-clm-serif: ui-serif, "New York", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --fd-clm-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  position: relative; display: block; overflow: hidden; margin: 0; padding: 0; min-height: 860px;
  background: var(--fd-clm-paper); color: var(--fd-clm-ink); font: 400 1rem/1.5 var(--fd-clm-sans);
  isolation: isolate;
}
.fd-clm-grid {
  position: relative; max-width: 1240px; min-height: 860px; margin: 0 auto; padding: 132px 48px 72px;
  display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 48px; align-items: center;
}
.fd-clm-eyebrow {
  display: inline-flex; align-items: center; gap: 10px; margin: 0 0 26px; padding: 0;
  font: 500 0.875rem/1 var(--fd-clm-sans); letter-spacing: -0.005em; color: var(--fd-clm-accent);
  animation: fd-clm-rise 1100ms var(--fd-ease-out) 100ms both;
}
.fd-clm-pulse { position: relative; display: block; width: 8px; height: 8px; border-radius: 9999px; background: #5FA37F; }
.fd-clm-pulse::after { content: ""; position: absolute; inset: -5px; border-radius: 9999px; border: 1px solid #5FA37F; animation: fd-clm-ping 3s var(--fd-ease-out) infinite; }
.fd-clm-h1 {
  margin: 0; padding: 0; color: var(--fd-clm-ink);
  font: 400 clamp(2.5rem, 4.6vw, 4.125rem)/1.02 var(--fd-clm-serif); letter-spacing: -0.03em; text-wrap: balance;
  animation: fd-clm-soft 1600ms var(--fd-ease-out) 200ms both;
}
.fd-clm-h1 em { font-style: italic; color: var(--fd-clm-accent); }
.fd-clm-lede {
  margin: 26px 0 0; padding: 0; max-width: 30rem; color: var(--fd-clm-muted);
  font: 400 clamp(1.0625rem, 1.2vw, 1.1875rem)/1.6 var(--fd-clm-sans); letter-spacing: -0.008em; text-wrap: pretty;
  animation: fd-clm-rise 1100ms var(--fd-ease-out) 450ms both;
}
.fd-clm-ctas { display: flex; flex-wrap: wrap; align-items: center; gap: 24px; margin: 36px 0 0; animation: fd-clm-rise 1100ms var(--fd-ease-out) 600ms both; }
.fd-clm-btn {
  display: inline-flex; align-items: center; margin: 0; height: 54px; padding: 0 28px; border-radius: 9999px; border: 0;
  background: var(--fd-clm-accent); color: #FBF7F1; text-decoration: none; font: 500 1rem/1 var(--fd-clm-sans); letter-spacing: -0.01em;
  box-shadow: 0 1px 0 rgba(255,255,255,0.18) inset, 0 14px 30px -14px rgba(47,93,74,0.7);
  transition: transform var(--fd-dur-2) var(--fd-spring), background var(--fd-dur-2) var(--fd-ease-out);
}
.fd-clm-btn:hover { background: #274E3E; }
.fd-clm-btn:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-clm-link { display: inline-flex; align-items: center; gap: 8px; margin: 0; padding: 0; color: var(--fd-clm-ink); text-decoration: none; font: 500 1rem/1 var(--fd-clm-sans); letter-spacing: -0.01em; }
.fd-clm-link svg { display: block; transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.fd-clm-link:hover svg { transform: translateX(4px); }
.fd-clm-btn:focus-visible, .fd-clm-link:focus-visible { outline: 2px solid rgba(47,93,74,0.7); outline-offset: 3px; }
.fd-clm-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; margin: 56px 0 0; padding: 24px 0 0; border-top: 1px solid rgba(31,42,36,0.1); animation: fd-clm-rise 1100ms var(--fd-ease-out) 750ms both; }
.fd-clm-stats div { display: flex; flex-direction: column-reverse; justify-content: flex-end; margin: 0; }
.fd-clm-stats dd { margin: 0 0 6px; padding: 0; font: 400 1.75rem/1 var(--fd-clm-serif); letter-spacing: -0.02em; color: var(--fd-clm-ink); }
.fd-clm-stats dt { margin: 0; padding: 0; font: 400 0.8125rem/1.4 var(--fd-clm-sans); color: var(--fd-clm-muted); }

.fd-clm-visual { position: relative; height: 560px; display: grid; place-items: center; perspective: 1400px; }
.fd-clm-orbwrap { position: absolute; inset: 0; display: grid; place-items: center; will-change: transform; }
.fd-clm-orb {
  width: 470px; height: 470px; border-radius: 50%;
  background:
    radial-gradient(40% 40% at 30% 30%, var(--fd-clm-orb-c), transparent 70%),
    radial-gradient(50% 50% at 70% 35%, var(--fd-clm-orb-a), transparent 72%),
    radial-gradient(60% 60% at 45% 75%, var(--fd-clm-orb-b), transparent 75%),
    radial-gradient(closest-side, #F7DCC6, #FBF7F1);
  filter: blur(26px) saturate(1.1);
  animation: fd-clm-in 2000ms var(--fd-ease-out) both, fd-clm-breathe 12s var(--fd-ease-in-out) 2s infinite;
}
.fd-clm-ring { position: absolute; width: 520px; height: 520px; border-radius: 50%; border: 1px solid rgba(47,93,74,0.12); animation: fd-clm-breathe 12s var(--fd-ease-in-out) 2.4s infinite, fd-clm-fade 2000ms var(--fd-ease-out) 400ms both; }
.fd-clm-ring-2 { width: 640px; height: 640px; border-color: rgba(47,93,74,0.07); animation-delay: 2.8s, 600ms; }

.fd-clm-stack { --fan: 1; position: relative; width: 380px; height: 460px; margin: 0; padding: 0; list-style: none; transform-style: preserve-3d; will-change: transform; }
.fd-clm-card {
  --y: calc(var(--i) * 16px * (1 - var(--fan)) + var(--fy) * var(--fan));
  --r: calc((var(--i) - 1) * var(--fan) * 2.5deg);
  --s: calc(1 - var(--i) * 0.05 * (1 - var(--fan)));
  position: absolute; left: 0; right: 0; top: 0; margin: 0; padding: 18px 18px 16px;
  border-radius: 24px; background: rgba(255,255,255,0.86); border: 1px solid rgba(255,255,255,0.9);
  box-shadow: 0 1px 0 #fff inset, 0 24px 48px -24px rgba(70, 52, 30, 0.28), 0 0 0 1px rgba(31,42,36,0.05);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  z-index: calc(10 - var(--i));
  transform: translate3d(calc((var(--i) - 1) * var(--fan) * 22px), var(--y), calc(var(--i) * -30px)) rotate(var(--r)) scale(var(--s));
  animation: fd-clm-deal 1400ms var(--fd-ease-out) both; animation-delay: calc(600ms + var(--i) * 180ms);
  transition: box-shadow var(--fd-dur-3) var(--fd-ease-out);
}
.fd-clm-card:hover { box-shadow: 0 1px 0 #fff inset, 0 34px 60px -24px rgba(70, 52, 30, 0.38), 0 0 0 1px rgba(31,42,36,0.08); }
.fd-clm-card-top { display: flex; align-items: center; gap: 12px; }
.fd-clm-av { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 9999px; font: 500 0.9375rem/1 var(--fd-clm-serif); color: var(--fd-clm-ink); }
.fd-clm-av img { width: 100%; height: 100%; border-radius: 9999px; object-fit: cover; object-position: center top; }
.fd-clm-sage .fd-clm-av { background: linear-gradient(135deg, #DCEBDD, #B9D5C0); }
.fd-clm-peach .fd-clm-av { background: linear-gradient(135deg, #FBE1CF, #F2C3A4); }
.fd-clm-sky .fd-clm-av { background: linear-gradient(135deg, #DDE9F4, #BCD2E8); }
.fd-clm-who { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.fd-clm-who b { font: 600 0.9375rem/1.2 var(--fd-clm-sans); letter-spacing: -0.01em; color: var(--fd-clm-ink); }
.fd-clm-who span { font: 400 0.8125rem/1.2 var(--fd-clm-sans); color: var(--fd-clm-muted); }
.fd-clm-live { margin-left: auto; padding: 5px 10px; border-radius: 9999px; background: #E3F1E7; color: #2F6B4D; font: 600 0.6875rem/1 var(--fd-clm-sans); letter-spacing: 0.02em; }
.fd-clm-card-bot { display: flex; justify-content: space-between; gap: 12px; margin: 16px 0 0; padding: 14px 0 0; border-top: 1px dashed rgba(31,42,36,0.12); }
.fd-clm-when { display: inline-flex; align-items: center; gap: 6px; font: 500 0.8125rem/1 var(--fd-clm-sans); color: var(--fd-clm-ink); }
.fd-clm-when svg { display: block; color: var(--fd-clm-muted); }
.fd-clm-kind { font: 400 0.8125rem/1 var(--fd-clm-sans); color: var(--fd-clm-muted); }
.fd-clm-join { display: flex; align-items: center; justify-content: space-between; margin: 14px 0 0; padding: 12px 16px; border-radius: 14px; background: var(--fd-clm-accent); color: #FBF7F1; font: 500 0.875rem/1 var(--fd-clm-sans); }
.fd-clm-dots { display: inline-flex; gap: 4px; }
.fd-clm-dots i { display: block; width: 5px; height: 5px; border-radius: 9999px; background: currentColor; opacity: 0.4; animation: fd-clm-dot 1.8s var(--fd-ease-in-out) infinite; }
.fd-clm-dots i:nth-child(2) { animation-delay: 0.2s; } .fd-clm-dots i:nth-child(3) { animation-delay: 0.4s; }

@keyframes fd-clm-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes fd-clm-soft { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: none; } }
@keyframes fd-clm-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes fd-clm-in { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: none; } }
@keyframes fd-clm-breathe { 0%, 100% { transform: scale(0.94); } 50% { transform: scale(1.06); } }
@keyframes fd-clm-ping { 0% { transform: scale(0.6); opacity: 0.8; } 80%, 100% { transform: scale(1.6); opacity: 0; } }
@keyframes fd-clm-dot { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
@keyframes fd-clm-deal { from { opacity: 0; transform: translate3d(0, 60px, -80px) rotate(0deg) scale(0.92); } to { opacity: 1; } }

@media (max-width: 900px) {
  .fd-clm { min-height: 844px; }
  .fd-clm-grid { grid-template-columns: 1fr; gap: 12px; padding: 104px 20px 48px; min-height: 844px; }
  .fd-clm-visual { height: 500px; order: 2; }
  .fd-clm-orb { width: 340px; height: 340px; }
  .fd-clm-ring { width: 380px; height: 380px; } .fd-clm-ring-2 { width: 460px; height: 460px; }
  .fd-clm-stack { width: min(340px, 100%); }
  .fd-clm-stack { height: 400px; }
  .fd-clm-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 36px; }
  .fd-clm-stats dd { font-size: 1.25rem; }
  .fd-clm-stats dt { font-size: 0.75rem; }
}
@media (prefers-reduced-motion: reduce) { .fd-clm *, .fd-clm *::before, .fd-clm *::after { animation: none !important; } }
@media (prefers-reduced-transparency: reduce) { .fd-clm-card { background: #fff; -webkit-backdrop-filter: none; backdrop-filter: none; } }
`;

/* ───────────────────────── Demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-clm-demo">
      <style>{demoCss}</style>
      <header className="fd-clm-demo-nav">
        <a className="fd-clm-demo-logo" href="#top">
          <svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true">
            <path d="M11 3c3 3.2 6 6 6 9.4A6 6 0 0 1 11 18.6a6 6 0 0 1-6-6.2C5 9 8 6.2 11 3Z" fill="#2F5D4A" />
            <path d="M11 9v6M8 12h6" stroke="#FBF7F1" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          tend
        </a>
        <nav aria-label="Primary">
          <a href="#care">Care</a>
          <a href="#membership">Membership</a>
          <a href="#employers">For employers</a>
          <a href="#clinicians">Our clinicians</a>
        </nav>
        <div className="fd-clm-demo-r">
          <a href="#login">Log in</a>
          <a className="fd-clm-demo-cta" href="#join">Join for $19/mo</a>
        </div>
      </header>
      <HeroHealthCalm />
    </div>
  );
}

const demoCss = `
.fd-clm-demo { position: relative; margin: 0; padding: 0; min-height: 100vh; background: #FBF7F1; }
.fd-clm-demo *, .fd-clm-demo *::before, .fd-clm-demo *::after { box-sizing: border-box; }
.fd-clm-demo-nav {
  position: absolute; z-index: 10; top: 0; left: 0; right: 0; max-width: 1240px; height: 80px; margin: 0 auto; padding: 0 48px;
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  animation: fd-clm-demo-in 1200ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.fd-clm-demo-nav .fd-clm-demo-logo { display: inline-flex; align-items: center; gap: 8px; margin: 0; color: #1F2A24; text-decoration: none; font: 500 1.5rem/1 ui-serif, "New York", "Iowan Old Style", Georgia, serif; letter-spacing: -0.03em; }
.fd-clm-demo-logo svg { display: block; }
.fd-clm-demo-nav nav { display: flex; gap: 32px; }
.fd-clm-demo-nav a { color: #48524C; text-decoration: none; font: 500 0.9375rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; letter-spacing: -0.01em; }
.fd-clm-demo-r { display: flex; align-items: center; gap: 22px; }
.fd-clm-demo-r .fd-clm-demo-cta { display: inline-flex; align-items: center; height: 40px; padding: 0 18px; border-radius: 9999px; background: #fff; color: #1F2A24; box-shadow: 0 0 0 1px rgba(31,42,36,0.1), 0 4px 12px -6px rgba(70,52,30,0.25); }
.fd-clm-demo-nav a:focus-visible { outline: 2px solid rgba(47,93,74,.7); outline-offset: 2px; border-radius: 8px; }
@keyframes fd-clm-demo-in { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 900px) { .fd-clm-demo-nav { padding: 0 20px; height: 68px; } .fd-clm-demo-nav nav, .fd-clm-demo-r a:not(.fd-clm-demo-cta) { display: none; } }
@media (prefers-reduced-motion: reduce) { .fd-clm-demo-nav { animation: none; } }
`;
