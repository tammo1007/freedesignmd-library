/**
 * HeroSaasBento — a B2B SaaS hero: a centred headline over an animated bento
 * grid. Each tile runs its own micro-interaction on a staggered loop: a revenue
 * chart draws, notifications slide in, a policy toggle flips, an approval
 * avatar stack fills, a sync ring completes and a command palette types.
 * Tiles tilt toward the pointer with a spotlight border; on scroll the grid
 * unfolds from a slight 3D lean to flat and the headline parallaxes.
 *
 * Demo images: /img/people/pN.webp (in the repo's public/img/people — copy next to your page or swap in your own).
 *
 * Props: title, lede, primaryCta, secondaryCta, logos (string[]).
 * CSS vars: --fd-bto-bg, --fd-bto-ink, --fd-bto-accent.
 *
 * Browser support: all evergreen browsers.
 * Motion: a single 7.2s timeline clock (rAF, paused off-screen / hidden tab)
 * toggles step classes; transitions use the library curves. Pointer spotlight
 * and tilt via CSS variables. Scroll via rAF + getBoundingClientRect.
 * prefers-reduced-motion: every tile shows its finished state, no loop.
 * Accessibility: tiles are an aria-hidden illustration with a visually
 * hidden summary; the toggle shown is decorative (the real control lives in
 * the product).
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface HeroSaasBentoProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  logos?: string[];
}

const CYCLE = 7200;

export function HeroSaasBento({
  eyebrow = "New · Workflows 2.0",
  title = (
    <>
      Run procurement on <span className="fd-bto-hl">autopilot.</span>
    </>
  ),
  lede = "Plinth routes every purchase request, enforces policy before money moves, and syncs approved spend to NetSuite in real time.",
  primaryCta = { label: "Start free trial", href: "#trial" },
  secondaryCta = { label: "Talk to sales", href: "#sales" },
  logos = ["Northwind", "Halden", "Kestrel", "Oslo Freight", "Marlow & Finch"],
}: HeroSaasBentoProps) {
  const root = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0); // 0..11 within a cycle
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(11);
      return;
    }
    let raf = 0;
    let visible = true;
    let clock = 0;
    let last = performance.now();
    let prevStep = -1;
    let prevLoop = 0;
    const frame = (now: number) => {
      raf = 0;
      clock += Math.min(now - last, 64);
      last = now;
      const st = Math.floor(((clock % CYCLE) / CYCLE) * 12);
      const lp = Math.floor(clock / CYCLE);
      if (st !== prevStep) {
        prevStep = st;
        setStep(st);
      }
      if (lp !== prevLoop) {
        prevLoop = lp;
        setLoop(lp);
      }
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      const enter = Math.min(1, Math.max(0, 1 - r.top / Math.max(1, window.innerHeight)));
      if (grid.current) grid.current.style.transform = `perspective(1600px) rotateX(${(Math.max(0, 14 - enter * 10 - p * 30)).toFixed(2)}deg) translate3d(0, ${(p * -80).toFixed(1)}px, 0) scale(${(0.97 + Math.min(1, p * 2) * 0.03).toFixed(4)})`;
      if (head.current) {
        head.current.style.transform = `translate3d(0, ${(p * 100).toFixed(1)}px, 0)`;
        head.current.style.opacity = (1 - p * 1.8).toFixed(3);
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
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
    };
  }, []);

  // spotlight + tilt per tile
  useEffect(() => {
    const g = grid.current;
    if (!g || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      g.querySelectorAll<HTMLElement>(".fd-bto-tile").forEach((t) => {
        const r = t.getBoundingClientRect();
        t.style.setProperty("--mx", `${e.clientX - r.left}px`);
        t.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    g.addEventListener("pointermove", onMove);
    return () => g.removeEventListener("pointermove", onMove);
  }, []);

  const on = (n: number) => step >= n;
  const cmd = "Approve all under $5k from Design";
  const typed = step >= 7 ? cmd.slice(0, Math.min(cmd.length, (step - 6) * 9)) : "";

  return (
    <section ref={root} className="fd-bto" aria-label="Plinth procurement">
      <style>{css}</style>
      <div className="fd-bto-bgfx" aria-hidden="true" />
      <div ref={head} className="fd-bto-head">
        <a className="fd-bto-eyebrow" href="#whats-new">
          <span className="fd-bto-eb-tag">{eyebrow}</span>
          <span>See what’s new</span>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </a>
        <h1 className="fd-bto-h1">{title}</h1>
        <p className="fd-bto-lede">{lede}</p>
        <div className="fd-bto-ctas">
          <a className="fd-bto-btn" href={primaryCta.href}>
            {primaryCta.label}
          </a>
          <a className="fd-bto-btn2" href={secondaryCta.href}>
            {secondaryCta.label}
          </a>
        </div>
      </div>

      <p className="fd-bto-sr">Product preview: spend chart, live approval notifications, policy toggles, approver chain, ERP sync status and a command bar.</p>

      <div ref={grid} className="fd-bto-grid" aria-hidden="true">
        {/* chart */}
        <div className="fd-bto-tile fd-bto-t-chart">
          <div className="fd-bto-th">
            <span>Committed spend · Q4</span>
            <b className="fd-bto-delta">−12.4% vs plan</b>
          </div>
          <p className="fd-bto-big">$2.41M</p>
          <svg aria-hidden="true" focusable="false" className={`fd-bto-chart ${on(1) ? "is-on" : ""}`} viewBox="0 0 400 120" preserveAspectRatio="none" key={`c${loop}`}>
            <path className="fd-bto-plan" d="M0 96 L400 18" />
            <path className="fd-bto-area" d="M0 110 C40 104 70 98 100 92 C140 84 160 88 200 74 C240 60 260 66 300 54 C340 42 370 46 400 38 L400 120 L0 120Z" />
            <path className="fd-bto-line" pathLength="1" d="M0 110 C40 104 70 98 100 92 C140 84 160 88 200 74 C240 60 260 66 300 54 C340 42 370 46 400 38" />
            <circle className="fd-bto-dot" cx="400" cy="38" r="4" />
          </svg>
          <div className="fd-bto-axis"><span>Oct</span><span>Nov</span><span>Dec</span></div>
        </div>

        {/* notifications */}
        <div className="fd-bto-tile fd-bto-t-notes">
          <div className="fd-bto-th"><span>Requests</span><b className="fd-bto-count">{on(5) ? 3 : on(3) ? 2 : on(1) ? 1 : 0} new</b></div>
          <ul className="fd-bto-notes">
            {[
              ["Figma Enterprise", "Design · $18,400/yr", "#A259FF", 1],
              ["AWS reserved instances", "Platform · $42,000", "#FF9900", 3],
              ["Offsite — Lisbon", "People · $9,850", "#22C55E", 5],
            ].map(([t, s, c, at]) => (
              <li key={t as string} className={on(at as number) ? "is-in" : ""}>
                <i style={{ background: c as string }} />
                <div><b>{t}</b><span>{s}</span></div>
                <em className={on((at as number) + 2) ? "is-ok" : ""}>{on((at as number) + 2) ? "Approved" : "Review"}</em>
              </li>
            ))}
          </ul>
        </div>

        {/* toggle */}
        <div className="fd-bto-tile fd-bto-t-toggle">
          <div className="fd-bto-th"><span>Policy</span></div>
          {[
            ["Block personal cards", 2],
            ["Require PO over $10k", 4],
            ["Auto-renew SaaS", 99],
          ].map(([l, at]) => (
            <div key={l as string} className="fd-bto-row">
              <span>{l}</span>
              <span className={`fd-bto-sw ${on(at as number) ? "is-on" : ""}`}><i /></span>
            </div>
          ))}
        </div>

        {/* approvers */}
        <div className="fd-bto-tile fd-bto-t-chain">
          <div className="fd-bto-th"><span>Approval chain</span></div>
          <div className="fd-bto-avs">
            {[
              ["Marcus Kane", "#FDE68A", "/img/people/p2.webp", "a bearded man with dark hair"],
              ["Jia Lin", "#BFDBFE", "/img/people/p6.webp", "a woman with long wavy dark hair"],
              ["Amara Reyes", "#FBCFE8", "/img/people/p3.webp", "a woman with braided hair"],
              ["Tom Sato", "#BBF7D0", "/img/people/p8.webp", "a smiling man with swept-back hair"],
            ].map(([nm, c, src, look], k) => (
              <span key={nm} className={`fd-bto-av ${on(2 + k * 2) ? "is-ok" : ""}`} style={{ background: c }}>
                <img src={src} alt={`${nm}, approver: portrait of ${look} in a black sweater`} width={40} height={40} loading="lazy" decoding="async" />
                <b>✓</b>
              </span>
            ))}
          </div>
          <p className="fd-bto-small">{on(8) ? "Fully approved in 2h 14m" : "Waiting on Finance"}</p>
        </div>

        {/* sync */}
        <div className="fd-bto-tile fd-bto-t-sync">
          <svg aria-hidden="true" focusable="false" className="fd-bto-ring" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" className="fd-bto-ring-bg" />
            <circle cx="32" cy="32" r="26" className="fd-bto-ring-fg" pathLength="1" style={{ strokeDashoffset: 1 - Math.min(1, step / 9) }} />
          </svg>
          <div>
            <b>{on(9) ? "Synced to NetSuite" : "Syncing ledger…"}</b>
            <span>{Math.min(1284, Math.round((step / 9) * 1284)).toLocaleString("en-US")} / 1,284 lines</span>
          </div>
        </div>

        {/* command */}
        <div className="fd-bto-tile fd-bto-t-cmd">
          <div className="fd-bto-cmd">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="14" height="14"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            <span>{typed || <span className="fd-bto-ph">Ask Plinth…</span>}<i className="fd-bto-caret" /></span>
            <kbd>⌘K</kbd>
          </div>
        </div>
      </div>

      <div className="fd-bto-logos">
        <span>Trusted by finance teams at</span>
        <ul>
          {logos.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const css = `
.fd-bto, .fd-bto *, .fd-bto *::before, .fd-bto *::after { box-sizing: border-box; }
.fd-bto {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-bto-bg: #FAFAFB;
  --fd-bto-ink: #0B0B0F;
  --fd-bto-muted: #6B6B76;
  --fd-bto-accent: #4F46E5;
  --fd-bto-sans: "SF Pro Display", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  position: relative; display: block; overflow: hidden; margin: 0; padding: 120px 32px 48px; min-height: 880px;
  background: var(--fd-bto-bg); color: var(--fd-bto-ink); font: 400 1rem/1.5 var(--fd-bto-sans); isolation: isolate;
}
.fd-bto-bgfx { position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: radial-gradient(40% 30% at 50% 0%, rgba(99, 102, 241, 0.16), transparent 70%), radial-gradient(30% 30% at 85% 55%, rgba(236, 72, 153, 0.08), transparent 70%), radial-gradient(30% 30% at 15% 60%, rgba(14, 165, 233, 0.08), transparent 70%);
}
.fd-bto-bgfx::after { content: ""; position: absolute; inset: 0; background-image: radial-gradient(rgba(11,11,15,0.08) 1px, transparent 1px); background-size: 22px 22px; -webkit-mask-image: radial-gradient(60% 50% at 50% 20%, #000, transparent); mask-image: radial-gradient(60% 50% at 50% 20%, #000, transparent); }
.fd-bto-head { max-width: 820px; margin: 0 auto; text-align: center; will-change: transform, opacity; }
.fd-bto-eyebrow {
  display: inline-flex; align-items: center; gap: 10px; margin: 0 0 24px; padding: 4px 12px 4px 4px; border-radius: 9999px; text-decoration: none;
  background: #fff; border: 1px solid rgba(11,11,15,0.08); box-shadow: 0 1px 2px rgba(11,11,15,0.04);
  font: 500 0.8125rem/1 var(--fd-bto-sans); color: #3a3a44; animation: fd-bto-rise var(--fd-dur-4) var(--fd-ease-out) both;
  transition: border-color var(--fd-dur-1);
}
.fd-bto-eyebrow:hover { border-color: rgba(79,70,229,0.35); }
.fd-bto-eyebrow svg { display: block; }
.fd-bto-eb-tag { padding: 5px 10px; border-radius: 9999px; background: rgba(79,70,229,0.1); color: var(--fd-bto-accent); font: 600 0.75rem/1 var(--fd-bto-sans); }
.fd-bto-h1 { margin: 0; padding: 0; font: 600 clamp(2.75rem, 6.2vw, 5.25rem)/0.98 var(--fd-bto-sans); letter-spacing: -0.05em; color: var(--fd-bto-ink); text-wrap: balance; animation: fd-bto-blur 1000ms var(--fd-ease-out) 100ms both; }
.fd-bto-hl { background: linear-gradient(92deg, #4F46E5, #9333EA 50%, #DB2777); -webkit-background-clip: text; background-clip: text; color: transparent; }
.fd-bto-lede { margin: 22px auto 0; padding: 0; max-width: 34rem; font: 400 clamp(1rem, 1.25vw, 1.1875rem)/1.55 var(--fd-bto-sans); letter-spacing: -0.01em; color: var(--fd-bto-muted); text-wrap: pretty; animation: fd-bto-rise var(--fd-dur-4) var(--fd-ease-out) 240ms both; }
.fd-bto-ctas { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin: 30px 0 0; animation: fd-bto-rise var(--fd-dur-4) var(--fd-ease-out) 340ms both; }
.fd-bto-btn, .fd-bto-btn2 { display: inline-flex; align-items: center; margin: 0; height: 46px; padding: 0 20px; border-radius: 12px; text-decoration: none; font: 500 0.9375rem/1 var(--fd-bto-sans); letter-spacing: -0.01em; transition: transform var(--fd-dur-2) var(--fd-spring), box-shadow var(--fd-dur-2), background var(--fd-dur-1); }
.fd-bto-btn { background: var(--fd-bto-ink); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 20px -8px rgba(11,11,15,0.5); }
.fd-bto-btn2 { background: #fff; color: var(--fd-bto-ink); box-shadow: 0 0 0 1px rgba(11,11,15,0.1), 0 2px 4px rgba(11,11,15,0.04); }
.fd-bto-btn:active, .fd-bto-btn2:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-bto-btn:focus-visible, .fd-bto-btn2:focus-visible, .fd-bto-eyebrow:focus-visible { outline: 2px solid rgba(79,70,229,0.7); outline-offset: 2px; }
.fd-bto-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.fd-bto-grid {
  display: grid; grid-template-columns: 1.4fr 1fr 1fr; grid-template-rows: auto auto auto; gap: 14px;
  max-width: 1120px; margin: 56px auto 0; transform-origin: 50% 0%; will-change: transform;
  animation: fd-bto-gridin 1200ms var(--fd-ease-out) 400ms both;
}
.fd-bto-tile {
  --mx: -400px; --my: -400px;
  position: relative; overflow: hidden; margin: 0; padding: 18px; border-radius: 20px; background: #fff;
  box-shadow: 0 0 0 1px rgba(11,11,15,0.06), 0 1px 2px rgba(11,11,15,0.04), 0 12px 32px -16px rgba(11,11,15,0.14);
}
.fd-bto-tile::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
  background: radial-gradient(240px circle at var(--mx) var(--my), rgba(99,102,241,0.55), transparent 60%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
.fd-bto-tile::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(300px circle at var(--mx) var(--my), rgba(99,102,241,0.05), transparent 60%); }
.fd-bto-t-chart { grid-row: span 2; }
.fd-bto-t-notes { grid-row: span 2; }
.fd-bto-t-cmd { grid-column: 2 / -1; display: flex; align-items: center; padding: 10px; }
.fd-bto-t-cmd .fd-bto-cmd { flex: 1; }
.fd-bto-th { display: flex; justify-content: space-between; align-items: center; gap: 8px; font: 500 0.8125rem/1 var(--fd-bto-sans); color: var(--fd-bto-muted); }
.fd-bto-delta { padding: 4px 8px; border-radius: 9999px; background: #ECFDF5; color: #047857; font: 600 0.6875rem/1 var(--fd-bto-sans); }
.fd-bto-big { margin: 10px 0 0; padding: 0; font: 600 2.25rem/1 var(--fd-bto-sans); letter-spacing: -0.04em; color: var(--fd-bto-ink); font-variant-numeric: tabular-nums; }
.fd-bto-chart { display: block; width: 100%; height: 150px; margin: 14px 0 0; overflow: visible; }
.fd-bto-plan { fill: none; stroke: rgba(11,11,15,0.18); stroke-width: 1.2; stroke-dasharray: 4 5; vector-effect: non-scaling-stroke; }
.fd-bto-line { fill: none; stroke: #4F46E5; stroke-width: 2.5; vector-effect: non-scaling-stroke; stroke-dasharray: 1; stroke-dashoffset: 1; }
.fd-bto-area { fill: rgba(79,70,229,0.08); opacity: 0; }
.fd-bto-dot { fill: #4F46E5; opacity: 0; transform-box: fill-box; transform-origin: center; }
.fd-bto-chart.is-on .fd-bto-line { stroke-dashoffset: 0; transition: stroke-dashoffset 1600ms var(--fd-ease-out); }
.fd-bto-chart.is-on .fd-bto-area { opacity: 1; transition: opacity var(--fd-dur-4) var(--fd-ease-out) 900ms; }
.fd-bto-chart.is-on .fd-bto-dot { opacity: 1; animation: fd-bto-ping 2s var(--fd-ease-out) 1500ms infinite; transition: opacity var(--fd-dur-2) 1400ms; }
.fd-bto-axis { display: flex; justify-content: space-between; margin: 8px 0 0; font: 500 0.6875rem/1 var(--fd-bto-sans); color: #9a9aa5; }

.fd-bto-count { font: 600 0.6875rem/1 var(--fd-bto-sans); color: var(--fd-bto-accent); background: rgba(79,70,229,0.1); padding: 4px 8px; border-radius: 9999px; font-variant-numeric: tabular-nums; }
.fd-bto-notes { display: flex; flex-direction: column; gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; }
.fd-bto-notes li {
  display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; gap: 10px; align-items: center; margin: 0; padding: 12px; border-radius: 14px; background: #FAFAFB;
  box-shadow: 0 0 0 1px rgba(11,11,15,0.05); opacity: 0; transform: translateX(24px) scale(0.98);
  transition: opacity var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-4) var(--fd-spring);
}
.fd-bto-notes li.is-in { opacity: 1; transform: none; }
.fd-bto-notes i { display: block; width: 8px; height: 8px; border-radius: 9999px; }
.fd-bto-notes b { display: block; font: 600 0.8125rem/1.2 var(--fd-bto-sans); color: var(--fd-bto-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fd-bto-notes span { display: block; margin-top: 2px; font: 400 0.75rem/1.2 var(--fd-bto-sans); color: var(--fd-bto-muted); }
.fd-bto-notes em { font: 600 0.6875rem/1 var(--fd-bto-sans); font-style: normal; padding: 5px 8px; border-radius: 9999px; background: #FEF3C7; color: #92400E; transition: background var(--fd-dur-2), color var(--fd-dur-2); }
.fd-bto-notes em.is-ok { background: #DCFCE7; color: #166534; }

.fd-bto-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 14px 0 0; font: 500 0.8125rem/1.2 var(--fd-bto-sans); color: var(--fd-bto-ink); }
.fd-bto-sw { position: relative; flex: none; width: 36px; height: 22px; border-radius: 9999px; background: #E4E4EA; transition: background var(--fd-dur-2) var(--fd-ease-in-out); }
.fd-bto-sw i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 9999px; background: #fff; box-shadow: 0 1px 3px rgba(11,11,15,0.25); transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-bto-sw.is-on { background: #4F46E5; }
.fd-bto-sw.is-on i { transform: translateX(14px); }

.fd-bto-avs { display: flex; margin: 16px 0 0; }
.fd-bto-av { position: relative; display: grid; place-items: center; width: 40px; height: 40px; margin-right: -8px; border-radius: 9999px; border: 2px solid #fff; font: 600 0.75rem/1 var(--fd-bto-sans); color: #1C1C22; filter: grayscale(1); opacity: 0.45; transition: filter var(--fd-dur-3), opacity var(--fd-dur-3), transform var(--fd-dur-3) var(--fd-spring); }
.fd-bto-av b { position: absolute; right: -3px; bottom: -3px; display: grid; place-items: center; width: 16px; height: 16px; border-radius: 9999px; background: #22C55E; color: #fff; border: 2px solid #fff; font: 700 0.5rem/1 var(--fd-bto-sans); transform: scale(0); transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-bto-av img { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 9999px; object-fit: cover; object-position: center top; }
.fd-bto-av.is-ok { filter: none; opacity: 1; transform: translateY(-2px); }
.fd-bto-av.is-ok b { transform: scale(1); }
.fd-bto-small { margin: 14px 0 0; padding: 0; font: 400 0.75rem/1.3 var(--fd-bto-sans); color: var(--fd-bto-muted); }

.fd-bto-t-sync { display: flex; align-items: center; gap: 14px; }
.fd-bto-ring { display: block; flex: none; width: 52px; height: 52px; transform: rotate(-90deg); }
.fd-bto-ring circle { fill: none; stroke-width: 5; }
.fd-bto-ring-bg { stroke: #EEEEF2; }
.fd-bto-ring-fg { stroke: #22C55E; stroke-linecap: round; stroke-dasharray: 1; transition: stroke-dashoffset var(--fd-dur-4) var(--fd-ease-out); }
.fd-bto-t-sync b { display: block; font: 600 0.875rem/1.2 var(--fd-bto-sans); color: var(--fd-bto-ink); }
.fd-bto-t-sync span { display: block; margin-top: 4px; font: 400 0.75rem/1.2 var(--fd-bto-sans); color: var(--fd-bto-muted); font-variant-numeric: tabular-nums; }

.fd-bto-cmd { display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 14px; border-radius: 12px; background: #FAFAFB; box-shadow: inset 0 0 0 1px rgba(11,11,15,0.06); color: #9a9aa5; font: 400 0.9375rem/1 var(--fd-bto-sans); }
.fd-bto-cmd svg { display: block; flex: none; }
.fd-bto-cmd > span { flex: 1; color: var(--fd-bto-ink); white-space: nowrap; overflow: hidden; }
.fd-bto-ph { color: #9a9aa5; }
.fd-bto-caret { display: inline-block; width: 2px; height: 1.1em; margin: 0 0 -0.2em 2px; background: var(--fd-bto-accent); animation: fd-bto-blink 1s steps(1) infinite; }
.fd-bto-cmd kbd { padding: 4px 7px; border-radius: 6px; background: #fff; box-shadow: 0 0 0 1px rgba(11,11,15,0.1); font: 500 0.75rem/1 var(--fd-bto-sans); color: var(--fd-bto-muted); }

.fd-bto-logos { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 14px 36px; max-width: 1120px; margin: 40px auto 0; animation: fd-bto-rise var(--fd-dur-4) var(--fd-ease-out) 900ms both; }
.fd-bto-logos > span { font: 500 0.8125rem/1 var(--fd-bto-sans); color: #9a9aa5; }
.fd-bto-logos ul { display: flex; flex-wrap: wrap; gap: 14px 36px; margin: 0; padding: 0; list-style: none; }
.fd-bto-logos li { margin: 0; padding: 0; font: 700 1.0625rem/1 var(--fd-bto-sans); letter-spacing: -0.03em; color: #B4B4BE; }

@keyframes fd-bto-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes fd-bto-blur { from { opacity: 0; filter: blur(12px); transform: translateY(8px); } to { opacity: 1; filter: none; transform: none; } }
@keyframes fd-bto-gridin { from { opacity: 0; translate: 0 60px; } to { opacity: 1; translate: 0 0; } }
@keyframes fd-bto-ping { 0% { transform: scale(1); } 50% { transform: scale(1.6); opacity: 0.6; } 100% { transform: scale(1); opacity: 1; } }
@keyframes fd-bto-blink { 50% { opacity: 0; } }

@media (max-width: 860px) {
  .fd-bto { padding: 100px 16px 40px; min-height: 844px; }
  .fd-bto-grid { grid-template-columns: 1fr 1fr; margin-top: 40px; gap: 10px; }
  .fd-bto-t-chart { grid-column: 1 / -1; grid-row: auto; }
  .fd-bto-t-notes { grid-column: 1 / -1; grid-row: auto; }
  .fd-bto-t-toggle, .fd-bto-t-cmd { display: none; }
  .fd-bto-t-sync { flex-direction: column; align-items: flex-start; }
  .fd-bto-chart { height: 100px; }
  .fd-bto-logos { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-bto *, .fd-bto *::before, .fd-bto *::after { animation: none !important; transition-duration: 1ms !important; transition-delay: 0ms !important; }
}
`;

/* ───────────────────────── Demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-bto-demo">
      <style>{demoCss}</style>
      <header className="fd-bto-demo-nav">
        <a className="fd-bto-demo-logo" href="#top">
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <rect x="2" y="12" width="16" height="5" rx="1.5" fill="#0B0B0F" />
            <rect x="5" y="7" width="10" height="4" rx="1.2" fill="#4F46E5" />
            <rect x="8" y="3" width="4" height="3" rx="1" fill="#0B0B0F" />
          </svg>
          Plinth
        </a>
        <nav aria-label="Primary">
          <a href="#product">Product</a>
          <a href="#customers">Customers</a>
          <a href="#integrations">Integrations</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="fd-bto-demo-r">
          <a href="#signin">Sign in</a>
          <a className="fd-bto-demo-cta" href="#trial">Get started</a>
        </div>
      </header>
      <HeroSaasBento />
    </div>
  );
}

const demoCss = `
.fd-bto-demo { position: relative; margin: 0; padding: 0; min-height: 100vh; background: #FAFAFB; }
.fd-bto-demo *, .fd-bto-demo *::before, .fd-bto-demo *::after { box-sizing: border-box; }
.fd-bto-demo-nav { position: absolute; z-index: 10; top: 0; left: 0; right: 0; max-width: 1120px; height: 68px; margin: 0 auto; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.fd-bto-demo-nav .fd-bto-demo-logo { display: inline-flex; align-items: center; gap: 8px; margin: 0; color: #0B0B0F; text-decoration: none; font: 700 1.0625rem/1 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", sans-serif; letter-spacing: -0.03em; }
.fd-bto-demo-logo svg { display: block; }
.fd-bto-demo-nav nav { display: flex; gap: 28px; }
.fd-bto-demo-nav a { color: #4a4a55; text-decoration: none; font: 500 0.875rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; }
.fd-bto-demo-r { display: flex; align-items: center; gap: 18px; }
.fd-bto-demo-r .fd-bto-demo-cta { display: inline-flex; align-items: center; height: 34px; padding: 0 14px; border-radius: 10px; background: #0B0B0F; color: #fff; }
.fd-bto-demo-nav a:focus-visible { outline: 2px solid rgba(79,70,229,.7); outline-offset: 2px; border-radius: 6px; }
@media (max-width: 860px) { .fd-bto-demo-nav { padding: 0 16px; } .fd-bto-demo-nav nav, .fd-bto-demo-r a:not(.fd-bto-demo-cta) { display: none; } }
`;
