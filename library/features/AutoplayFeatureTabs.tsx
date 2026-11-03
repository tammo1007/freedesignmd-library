/**
 * AutoplayFeatureTabs, feature tabs that advance on their own with a filling
 * progress bar, each tab showing a phone screen built in code. Shown for a
 * family GP practice's patient app: booking, test results, medication and
 * messages.
 *
 * Props: eyebrow, title, lede, tabs ({ id, label, blurb, screen }), interval (ms).
 * `screen` is any ReactNode rendered inside the phone frame.
 * CSS vars: --fd-aft-bg, --fd-aft-ink, --fd-aft-clay, --fd-aft-sage.
 *
 * Browser support: all evergreen browsers.
 * Motion: one rAF clock drives the progress bar (transform: scaleX). It pauses
 * on hover, on keyboard focus inside the section, when off-screen and when the
 * tab is hidden. Screens crossfade with a small lift.
 * Accessibility: WAI-ARIA tabs (role="tablist" / "tab" / "tabpanel"), arrow
 * keys, Home and End move between tabs; a visible pause button stops the
 * rotation (WCAG 2.2.2). Phone UI inside the panel is real text.
 * Reduced motion: no auto-advance (the pause button is hidden), screens swap
 * instantly.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

export interface AftTab {
  id: string;
  label: string;
  blurb: string;
  screen: ReactNode;
}

export interface AutoplayFeatureTabsProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  tabs?: AftTab[];
  interval?: number;
  className?: string;
}

/* ───────────── phone screens ───────────── */
function BookScreen() {
  const days = [["Mon", 3], ["Tue", 4], ["Wed", 5], ["Thu", 6], ["Fri", 7]] as const;
  const slots = ["08:20", "09:10", "10:40", "11:50", "14:30", "16:00"];
  return (
    <div className="fd-aft-scr">
      <p className="fd-aft-s-k">Book</p>
      <h4 className="fd-aft-s-h">See Dr Okafor</h4>
      <div className="fd-aft-days">
        {days.map(([d, n], i) => (
          <span key={d} data-on={i === 1 ? "" : undefined}><small>{d}</small>{n}</span>
        ))}
      </div>
      <p className="fd-aft-s-l">Tuesday 4 November</p>
      <div className="fd-aft-slots">
        {slots.map((s, i) => <span key={s} data-on={i === 2 ? "" : undefined} data-gone={i === 0 || i === 4 ? "" : undefined}>{s}</span>)}
      </div>
      <div className="fd-aft-doc">
        <img src="/img/people/p9.webp" alt="" width={40} height={40} loading="lazy" />
        <span><b>Dr Amara Okafor</b><small>GP, 14 years at Wren</small></span>
      </div>
      <div className="fd-aft-pill">In person · Room 3 · 10 min</div>
      <span className="fd-aft-cta">Book 10:40</span>
    </div>
  );
}

function ResultsScreen() {
  const r = [
    { n: "Ferritin", v: "18", u: "µg/L", lo: 30, hi: 400, max: 450, flag: "Low" },
    { n: "Vitamin D", v: "62", u: "nmol/L", lo: 50, hi: 125, max: 160 },
    { n: "HbA1c", v: "36", u: "mmol/mol", lo: 20, hi: 41, max: 60 },
  ];
  return (
    <div className="fd-aft-scr">
      <p className="fd-aft-s-k">Results</p>
      <h4 className="fd-aft-s-h">Blood test, 28 Oct</h4>
      <div className="fd-aft-res">
        {r.map((x) => {
          const v = parseFloat(x.v);
          return (
            <div key={x.n} className="fd-aft-res-r">
              <div className="fd-aft-res-t"><span>{x.n}</span>{x.flag && <em>{x.flag}</em>}<b>{x.v}<small> {x.u}</small></b></div>
              <div className="fd-aft-range">
                <i className="fd-aft-ok" style={{ left: `${(x.lo / x.max) * 100}%`, width: `${((x.hi - x.lo) / x.max) * 100}%` }} />
                <i className="fd-aft-dot" data-flag={x.flag ? "" : undefined} style={{ left: `${(v / x.max) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="fd-aft-note">
        <img src="/img/people/p9.webp" alt="" width={24} height={24} loading="lazy" />
        <p>“Iron is a little low. Nothing urgent, we'll talk it through on Tuesday.” <small>Dr Okafor</small></p>
      </div>
    </div>
  );
}

function MedsScreen() {
  const m = [
    { t: "07:00", n: "Levothyroxine", d: "50 µg, before breakfast", s: "taken" },
    { t: "13:00", n: "Ferrous fumarate", d: "210 mg, with orange juice", s: "due" },
    { t: "20:00", n: "Vitamin D3", d: "1,000 IU", s: "later" },
  ];
  return (
    <div className="fd-aft-scr">
      <p className="fd-aft-s-k">Medication</p>
      <h4 className="fd-aft-s-h">Today, 3 doses</h4>
      <ol className="fd-aft-meds">
        {m.map((x) => (
          <li key={x.n} data-s={x.s}>
            <span className="fd-aft-med-t">{x.t}</span>
            <span className="fd-aft-med-n"><b>{x.n}</b><small>{x.d}</small></span>
            <span className="fd-aft-med-c" aria-label={x.s}>{x.s === "taken" && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 6.2 5 8.6l4.5-5" /></svg>}</span>
          </li>
        ))}
      </ol>
      <div className="fd-aft-refill">
        <div className="fd-aft-refill-bar"><i /></div>
        <p><b>12 tablets left.</b> Repeat sent to Hyde Park Pharmacy, ready Thursday.</p>
      </div>
    </div>
  );
}

function MessagesScreen() {
  return (
    <div className="fd-aft-scr fd-aft-chat">
      <div className="fd-aft-chat-h">
        <img src="/img/people/p6.webp" alt="" width={32} height={32} loading="lazy" />
        <span><b>Priya, practice nurse</b><small>Replies within 2 working hours</small></span>
      </div>
      <div className="fd-aft-msgs">
        <p className="fd-aft-me" style={{ ["--i" as string]: 0 }}>Hi Priya, the rash on Leo's arm is back. Photo attached. Should I bring him in?</p>
        <div className="fd-aft-photo" style={{ ["--i" as string]: 1 }} aria-hidden="true" />
        <p className="fd-aft-them" style={{ ["--i" as string]: 2 }}>Thanks Sofia. That looks like his eczema flaring, not an infection.</p>
        <p className="fd-aft-them" style={{ ["--i" as string]: 3 }}>Use the 1% cream twice a day for 5 days. If it's not calmer by Monday, I've held 09:10 for you.</p>
        <span className="fd-aft-typing" style={{ ["--i" as string]: 4 }} aria-label="Priya is typing"><i /><i /><i /></span>
      </div>
      <div className="fd-aft-compose">Message Priya</div>
    </div>
  );
}

const DEFAULT_TABS: AftTab[] = [
  { id: "book", label: "Book", blurb: "Pick the doctor you saw last time, at a time that works around school pickup.", screen: <BookScreen /> },
  { id: "results", label: "Results", blurb: "Test results land with a note from your GP, in plain English, the same day they do.", screen: <ResultsScreen /> },
  { id: "meds", label: "Medication", blurb: "Reminders that know iron and thyroxine shouldn't share a breakfast. Repeats reorder themselves.", screen: <MedsScreen /> },
  { id: "messages", label: "Messages", blurb: "Send a photo to a nurse instead of queuing on the phone at 08:00.", screen: <MessagesScreen /> },
];

export function AutoplayFeatureTabs({
  eyebrow = "The Wren app",
  title = <>The waiting room, <em>minus the waiting.</em></>,
  lede = "Four things our 11,400 patients used to ring reception for. Now they take about a minute each.",
  tabs = DEFAULT_TABS,
  interval = 6500,
  className,
}: AutoplayFeatureTabsProps) {
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const elapsed = useRef(0);
  const uid = useId();
  const stopped = paused || reduced;
  const halted = stopped || hover || focus || !visible;

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    const el = root.current;
    let io: IntersectionObserver | undefined;
    if (el) { io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 }); io.observe(el); }
    return () => { m.removeEventListener("change", on); io?.disconnect(); };
  }, []);

  useEffect(() => { elapsed.current = 0; bars.current.forEach((b, i) => b && (b.style.transform = `scaleX(${i < active && !stopped ? 1 : 0})`)); }, [active, stopped]);

  useEffect(() => {
    if (halted) return;
    let raf = 0, last = performance.now();
    const tick = (t: number) => {
      if (document.hidden) { last = t; raf = requestAnimationFrame(tick); return; }
      elapsed.current += t - last; last = t;
      const p = Math.min(1, elapsed.current / interval);
      const b = bars.current[active];
      if (b) b.style.transform = `scaleX(${p})`;
      if (p >= 1) { setActive((a) => (a + 1) % tabs.length); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [halted, active, interval, tabs.length]);

  const select = (i: number, f = false) => {
    setActive(i);
    if (f) document.getElementById(`${uid}-t-${i}`)?.focus();
  };
  const onKey = (e: ReactKeyboardEvent, i: number) => {
    const n = tabs.length;
    const map: Record<string, number> = { ArrowDown: (i + 1) % n, ArrowRight: (i + 1) % n, ArrowUp: (i - 1 + n) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 };
    if (e.key in map) { e.preventDefault(); select(map[e.key], true); }
  };

  return (
    <section
      ref={root}
      className={`fd-aft${className ? " " + className : ""}`}
      aria-labelledby={`${uid}-h`}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={(e) => { if ((e.target as HTMLElement).matches?.(":focus-visible")) setFocus(true); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocus(false); }}
    >
      <style>{css}</style>
      <div className="fd-aft-wrap">
        <div className="fd-aft-copy">
          <p className="fd-aft-eyebrow">{eyebrow}</p>
          <h2 id={`${uid}-h`} className="fd-aft-title">{title}</h2>
          <p className="fd-aft-lede">{lede}</p>
          <div className="fd-aft-tabs" role="tablist" aria-orientation="vertical" aria-label="App features">
            {tabs.map((t, i) => (
              <button
                key={t.id}
                id={`${uid}-t-${i}`}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-controls={`${uid}-p`}
                tabIndex={i === active ? 0 : -1}
                className="fd-aft-tab"
                onClick={() => select(i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span className="fd-aft-tab-n">0{i + 1}</span>
                <span className="fd-aft-tab-b">
                  <span className="fd-aft-tab-l">{t.label}</span>
                  <span className="fd-aft-tab-d"><span>{t.blurb}</span></span>
                </span>
                <span className="fd-aft-prog" aria-hidden="true"><span ref={(el) => { bars.current[i] = el; }} /></span>
              </button>
            ))}
          </div>
          {!reduced && (
            <button type="button" className="fd-aft-pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
              {paused
                ? <><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>Play tour</>
                : <><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1h2v8H2zM6 1h2v8H6z" fill="currentColor" /></svg>Pause tour</>}
            </button>
          )}
        </div>
        <div className="fd-aft-stage">
          <div className="fd-aft-arch" aria-hidden="true" />
          <div className="fd-aft-phone">
            <div className="fd-aft-island" aria-hidden="true" />
            <div className="fd-aft-status" aria-hidden="true"><span>9:41</span><span className="fd-aft-sig"><i /><i /><i /><i /></span></div>
            <div id={`${uid}-p`} role="tabpanel" aria-labelledby={`${uid}-t-${active}`} className="fd-aft-panel">
              {tabs.map((t, i) => (
                <div key={t.id} className="fd-aft-screen" data-on={i === active ? "" : undefined} hidden={i !== active && reduced ? true : undefined} aria-hidden={i !== active}>
                  {t.screen}
                </div>
              ))}
            </div>
            <div className="fd-aft-home" aria-hidden="true" />
          </div>
          <p className="fd-aft-caption" aria-hidden="true">{String(active + 1).padStart(2, "0")} {tabs[active].label}</p>
        </div>
      </div>
    </section>
  );
}

const css = `
:where(.fd-aft,.fd-aft *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-aft,.fd-aft *)::before,:where(.fd-aft,.fd-aft *)::after{box-sizing:border-box}
:where(.fd-aft svg,.fd-aft img){display:block;flex-shrink:0}
:where(.fd-aft button){appearance:none;-webkit-appearance:none;outline:0;border-radius:0;cursor:pointer;text-align:left}
.fd-aft{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-aft-bg:#F4ECE1;--fd-aft-ink:#2B1C16;--fd-aft-mut:#7A6457;--fd-aft-line:rgba(43,28,22,.12);--fd-aft-clay:#B5532E;--fd-aft-sage:#6F8466;--fd-aft-cream:#FBF7F1;--fd-aft-blush:#EBD3C2;
  --fd-aft-serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
  --fd-aft-sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  display:block;width:100%;background:var(--fd-aft-bg);color:var(--fd-aft-ink);padding:clamp(56px,8vw,120px) clamp(16px,4vw,56px);
  font:400 15px/1.5 var(--fd-aft-sans);-webkit-font-smoothing:antialiased}
.fd-aft-wrap{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(32px,6vw,96px);align-items:center}
.fd-aft-eyebrow{font:500 13px/18px var(--fd-aft-sans);letter-spacing:.14em;text-transform:uppercase;color:var(--fd-aft-clay)}
.fd-aft-title{margin-top:16px;font:400 clamp(2.5rem,5vw,4.25rem)/1.02 var(--fd-aft-serif);letter-spacing:-.025em;color:var(--fd-aft-ink)}
.fd-aft-title em{font-style:italic;color:var(--fd-aft-clay)}
.fd-aft-lede{margin-top:20px;max-width:40ch;font:400 17px/1.55 var(--fd-aft-sans);color:var(--fd-aft-mut)}
.fd-aft-tabs{margin-top:40px;display:flex;flex-direction:column;border-top:1px solid var(--fd-aft-line)}
.fd-aft-tab{position:relative;display:grid;grid-template-columns:40px minmax(0,1fr);gap:8px;padding:18px 4px 20px;border-bottom:1px solid var(--fd-aft-line);color:var(--fd-aft-ink);border-radius:2px;transition:background-color var(--fd-dur-2)}
.fd-aft-tab:hover{background:rgba(255,255,255,.35)}
.fd-aft-tab:focus-visible{outline:2px solid rgba(181,83,46,.7);outline-offset:2px}
.fd-aft-tab-n{font:400 15px/26px var(--fd-aft-serif);font-style:italic;color:var(--fd-aft-mut)}
.fd-aft-tab-b{display:flex;flex-direction:column;min-width:0}
.fd-aft-tab-l{font:400 22px/26px var(--fd-aft-serif);letter-spacing:-.01em;color:var(--fd-aft-mut);transition:color var(--fd-dur-2)}
.fd-aft-tab-d{display:grid;grid-template-rows:0fr;opacity:0;font:400 15px/1.5 var(--fd-aft-sans);color:var(--fd-aft-mut);max-width:44ch;transition:grid-template-rows var(--fd-dur-3) var(--fd-ease-in-out),opacity var(--fd-dur-3) var(--fd-ease-out),margin var(--fd-dur-3) var(--fd-ease-in-out);overflow:hidden}
.fd-aft-tab-d>span{min-height:0;overflow:hidden}
.fd-aft-tab[aria-selected="true"] .fd-aft-tab-l{color:var(--fd-aft-ink)}
.fd-aft-tab[aria-selected="true"] .fd-aft-tab-n{color:var(--fd-aft-clay)}
.fd-aft-tab[aria-selected="true"] .fd-aft-tab-d{grid-template-rows:1fr;opacity:1;margin-top:6px}
.fd-aft-prog{position:absolute;left:0;right:0;bottom:-1px;height:2px;overflow:hidden}
.fd-aft-prog span{display:block;height:100%;background:var(--fd-aft-clay);transform-origin:left;transform:scaleX(0)}
.fd-aft-tab[aria-selected="false"] .fd-aft-prog span{transform:scaleX(0)!important}
.fd-aft-pause{display:inline-flex;align-items:center;gap:8px;margin-top:20px;height:32px;padding:0 14px;border-radius:999px;font:500 13px/1 var(--fd-aft-sans);color:var(--fd-aft-mut);box-shadow:inset 0 0 0 1px var(--fd-aft-line);transition:color var(--fd-dur-1),transform var(--fd-dur-1)}
.fd-aft-pause:hover{color:var(--fd-aft-ink)}
.fd-aft-pause:active{transform:scale(.96)}
.fd-aft-pause:focus-visible{outline:2px solid rgba(181,83,46,.7);outline-offset:2px}

.fd-aft-stage{position:relative;display:grid;justify-items:center;padding:40px 0 0}
.fd-aft-arch{position:absolute;left:50%;top:0;bottom:40px;width:min(440px,100%);transform:translateX(-50%);border-radius:220px 220px 6px 6px;background:linear-gradient(180deg,var(--fd-aft-blush),#E4C3AD);overflow:hidden}
.fd-aft-arch::after{content:"";position:absolute;left:-20%;right:-20%;bottom:-30%;height:70%;border-radius:50%;background:radial-gradient(closest-side,rgba(181,83,46,.25),transparent)}
.fd-aft-phone{position:relative;width:300px;height:620px;border-radius:48px;padding:12px;background:#1F1512;box-shadow:inset 0 0 0 1.5px #4A3A33,0 1px 0 rgba(255,255,255,.08) inset,0 50px 80px -40px rgba(43,28,22,.55),0 20px 40px -20px rgba(43,28,22,.35)}
.fd-aft-island{position:absolute;left:50%;top:22px;width:92px;height:26px;border-radius:999px;background:#000;transform:translateX(-50%);z-index:3}
.fd-aft-status{position:absolute;left:12px;right:12px;top:12px;height:48px;padding:0 30px;display:flex;align-items:center;justify-content:space-between;z-index:2;font:600 14px/1 var(--fd-aft-sans);color:var(--fd-aft-ink)}
.fd-aft-sig{display:flex;align-items:flex-end;gap:2px;height:11px}
.fd-aft-sig i{display:block;width:3px;border-radius:1px;background:var(--fd-aft-ink)}
.fd-aft-sig i:nth-child(1){height:4px}.fd-aft-sig i:nth-child(2){height:6px}.fd-aft-sig i:nth-child(3){height:8px}.fd-aft-sig i:nth-child(4){height:11px}
.fd-aft-panel{position:relative;width:100%;height:100%;border-radius:36px;overflow:hidden;background:var(--fd-aft-cream)}
.fd-aft-home{position:absolute;left:50%;bottom:20px;width:110px;height:4px;border-radius:2px;background:var(--fd-aft-ink);opacity:.8;transform:translateX(-50%)}
.fd-aft-screen{position:absolute;inset:0;padding:60px 18px 30px;opacity:0;transform:translateY(14px);transition:opacity var(--fd-dur-3) var(--fd-ease-in-out),transform var(--fd-dur-4) var(--fd-ease-out);pointer-events:none}
.fd-aft-screen[data-on]{opacity:1;transform:none;pointer-events:auto}
.fd-aft-caption{margin-top:20px;font:italic 400 15px/20px var(--fd-aft-serif);color:var(--fd-aft-mut)}

/* screen content */
.fd-aft-scr{display:flex;flex-direction:column;height:100%;font:400 13px/1.4 var(--fd-aft-sans);color:var(--fd-aft-ink)}
.fd-aft-s-k{font:600 11px/14px var(--fd-aft-sans);letter-spacing:.12em;text-transform:uppercase;color:var(--fd-aft-clay)}
.fd-aft-s-h{margin-top:4px;font:400 26px/1.1 var(--fd-aft-serif);letter-spacing:-.015em}
.fd-aft-s-l{margin:14px 0 8px;font:600 12px/16px var(--fd-aft-sans);color:var(--fd-aft-mut)}
.fd-aft-days{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:16px}
.fd-aft-days span{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0;border-radius:14px;background:#F1E7DB;font:600 17px/1 var(--fd-aft-sans)}
.fd-aft-days small{font:500 10px/1 var(--fd-aft-sans);letter-spacing:.06em;text-transform:uppercase;color:var(--fd-aft-mut)}
.fd-aft-days span[data-on]{background:var(--fd-aft-ink);color:var(--fd-aft-cream)}
.fd-aft-days span[data-on] small{color:#CDB8AA}
.fd-aft-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.fd-aft-slots span{display:grid;place-items:center;height:34px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--fd-aft-line);font:500 13px/1 var(--fd-aft-sans);font-variant-numeric:tabular-nums}
.fd-aft-slots span[data-gone]{color:#BCA99C;text-decoration:line-through;box-shadow:none;background:#F3ECE3}
.fd-aft-slots span[data-on]{background:var(--fd-aft-clay);color:#fff;box-shadow:none}
.fd-aft-doc{display:flex;align-items:center;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid var(--fd-aft-line)}
.fd-aft-doc img{width:40px;height:40px;border-radius:50%;object-fit:cover}
.fd-aft-doc span{display:flex;flex-direction:column}
.fd-aft-doc b{font-weight:600;font-size:14px}
.fd-aft-doc small{font-size:12px;color:var(--fd-aft-mut)}
.fd-aft-pill{margin-top:12px;font:500 12px/16px var(--fd-aft-sans);color:var(--fd-aft-sage)}
.fd-aft-cta{margin-top:auto;display:grid;place-items:center;height:46px;border-radius:999px;background:var(--fd-aft-ink);color:var(--fd-aft-cream);font:600 15px/1 var(--fd-aft-sans)}
.fd-aft-res{margin-top:18px;display:flex;flex-direction:column;gap:16px}
.fd-aft-res-r{padding:14px;border-radius:16px;background:#fff;box-shadow:0 0 0 1px var(--fd-aft-line)}
.fd-aft-res-t{display:flex;align-items:baseline;gap:8px;font:500 13px/18px var(--fd-aft-sans)}
.fd-aft-res-t em{font-style:normal;font:600 10px/1 var(--fd-aft-sans);letter-spacing:.06em;text-transform:uppercase;padding:3px 6px;border-radius:999px;background:#F6DCCF;color:#8C3517}
.fd-aft-res-t b{margin-left:auto;font:400 22px/1 var(--fd-aft-serif)}
.fd-aft-res-t b small{font:400 11px/1 var(--fd-aft-sans);color:var(--fd-aft-mut)}
.fd-aft-range{position:relative;height:6px;margin-top:12px;border-radius:3px;background:#EFE5DA}
.fd-aft-ok{position:absolute;top:0;bottom:0;border-radius:3px;background:#C9D5C2}
.fd-aft-dot{position:absolute;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--fd-aft-sage);box-shadow:0 0 0 2px #fff}
.fd-aft-dot[data-flag]{background:var(--fd-aft-clay)}
.fd-aft-note{display:flex;gap:10px;margin-top:auto;padding:12px;border-radius:16px;background:#F1E7DB}
.fd-aft-note img{width:24px;height:24px;border-radius:50%;object-fit:cover}
.fd-aft-note p{font:400 14px/1.4 var(--fd-aft-serif);font-style:italic}
.fd-aft-note small{display:block;margin-top:4px;font:500 11px/1 var(--fd-aft-sans);font-style:normal;color:var(--fd-aft-mut)}
.fd-aft-meds{margin-top:18px;display:flex;flex-direction:column}
.fd-aft-meds li{display:grid;grid-template-columns:44px minmax(0,1fr) 26px;gap:8px;align-items:center;padding:12px 0;border-bottom:1px solid var(--fd-aft-line)}
.fd-aft-med-t{font:500 12px/1 var(--fd-aft-sans);font-variant-numeric:tabular-nums;color:var(--fd-aft-mut)}
.fd-aft-med-n{display:flex;flex-direction:column}
.fd-aft-med-n b{font-weight:600;font-size:14px}
.fd-aft-med-n small{font-size:12px;color:var(--fd-aft-mut)}
.fd-aft-med-c{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--fd-aft-line)}
.fd-aft-meds li[data-s="taken"] .fd-aft-med-c{background:var(--fd-aft-sage);color:#fff;box-shadow:none}
.fd-aft-meds li[data-s="taken"] .fd-aft-med-n b{text-decoration:line-through;text-decoration-color:rgba(43,28,22,.35)}
.fd-aft-meds li[data-s="due"]{margin:0 -10px;padding:12px 10px;border-radius:14px;background:#F6DCCF;border-color:transparent}
.fd-aft-meds li[data-s="due"] .fd-aft-med-t{color:#8C3517;font-weight:700}
.fd-aft-meds li[data-s="due"] .fd-aft-med-c{box-shadow:inset 0 0 0 1.5px var(--fd-aft-clay)}
.fd-aft-refill{margin-top:auto;padding:14px;border-radius:16px;background:#fff;box-shadow:0 0 0 1px var(--fd-aft-line)}
.fd-aft-refill-bar{height:6px;border-radius:3px;background:#EFE5DA}
.fd-aft-refill-bar i{display:block;width:21%;height:100%;border-radius:3px;background:var(--fd-aft-clay)}
.fd-aft-refill p{margin-top:10px;font-size:12px;line-height:1.45;color:var(--fd-aft-mut)}
.fd-aft-refill b{color:var(--fd-aft-ink);font-weight:600}
.fd-aft-chat{padding-top:0}
.fd-aft-chat-h{display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid var(--fd-aft-line)}
.fd-aft-chat-h img{width:32px;height:32px;border-radius:50%;object-fit:cover}
.fd-aft-chat-h span{display:flex;flex-direction:column}
.fd-aft-chat-h b{font-size:14px;font-weight:600}
.fd-aft-chat-h small{font-size:11px;color:var(--fd-aft-sage)}
.fd-aft-msgs{display:flex;flex-direction:column;gap:6px;padding-top:14px}
.fd-aft-msgs>*{opacity:0;transform:translateY(8px);transition:opacity var(--fd-dur-3) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-ease-out)}
[data-on] .fd-aft-msgs>*{opacity:1;transform:none;transition-delay:calc(300ms + var(--i) * 420ms)}
.fd-aft-me,.fd-aft-them{max-width:84%;padding:9px 12px;border-radius:16px;font-size:13px;line-height:1.4}
.fd-aft-me{align-self:flex-end;background:var(--fd-aft-ink);color:var(--fd-aft-cream);border-bottom-right-radius:4px}
.fd-aft-them{align-self:flex-start;background:#fff;box-shadow:0 0 0 1px var(--fd-aft-line);border-bottom-left-radius:4px}
.fd-aft-photo{align-self:flex-end;width:120px;height:78px;border-radius:12px;background:radial-gradient(40% 50% at 55% 50%,#D99A86,transparent),radial-gradient(30% 40% at 35% 60%,#E0A792,transparent),linear-gradient(135deg,#E9C4AE,#D8AE95)}
.fd-aft-typing{align-self:flex-start;display:flex;gap:4px;padding:10px 12px;border-radius:16px;background:#fff;box-shadow:0 0 0 1px var(--fd-aft-line)}
.fd-aft-typing i{display:block;width:6px;height:6px;border-radius:50%;background:var(--fd-aft-mut);animation:fd-aft-bounce 1.2s var(--fd-ease-in-out) infinite}
.fd-aft-typing i:nth-child(2){animation-delay:.15s}.fd-aft-typing i:nth-child(3){animation-delay:.3s}
@keyframes fd-aft-bounce{0%,60%,100%{transform:none;opacity:.5}30%{transform:translateY(-3px);opacity:1}}
.fd-aft-compose{margin-top:auto;height:40px;display:flex;align-items:center;padding:0 14px;border-radius:999px;background:#fff;box-shadow:0 0 0 1px var(--fd-aft-line);color:#B19C8E;font-size:13px}

@media (max-width:900px){
  .fd-aft-wrap{grid-template-columns:minmax(0,1fr);gap:0}
  .fd-aft-copy{display:contents}
  .fd-aft-stage{order:1;margin-top:36px}
  .fd-aft-tabs{order:2;margin-top:28px}
  .fd-aft-pause{order:3;justify-self:start}
}
@media (max-width:420px){
  .fd-aft-phone{width:280px;height:580px}
  .fd-aft-tab-l{font-size:20px}
}
@media (prefers-reduced-motion:reduce){
  .fd-aft *,.fd-aft-msgs>*{transition-duration:1ms!important;transition-delay:0ms!important;animation:none!important}
  .fd-aft-screen{transform:none}
}
@media (prefers-contrast:more){.fd-aft-phone{box-shadow:0 0 0 2px currentColor}}
`;

export function Demo() {
  return (
    <div className="fd-aftd">
      <style>{`.fd-aftd{background:#F4ECE1;min-height:100vh}.fd-aftd-nav{box-sizing:border-box;max-width:1272px;margin:0 auto;height:64px;padding:0 clamp(16px,4vw,56px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(43,28,22,.12);font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter",sans-serif;color:#7A6457}.fd-aftd-nav b{font:400 24px/1 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-style:italic;letter-spacing:-.02em;color:#2B1C16}.fd-aftd-nav b i{font-style:normal;color:#B5532E}`}</style>
      <div className="fd-aftd-nav"><b>Wren<i>.</i></b><span>Hyde Park, Leeds · 0113 496 0021</span></div>
      <AutoplayFeatureTabs />
    </div>
  );
}
