/**
 * BentoLiveUi, an asymmetric feature bento for a business bank where every
 * tile is a small working piece of the product instead of an icon: a card
 * you can freeze, an FX converter, an approval queue you can clear and a
 * spend chart that draws itself when it scrolls into view.
 *
 * Props: eyebrow, title, lede, card, rates, approvals, spend, categories.
 * CSS vars on the root: --fd-blu-bg, --fd-blu-ink, --fd-blu-forest, --fd-blu-lime.
 *
 * Demo images: /img/people/pN.webp (requester avatars). Copy them next to your
 * page or pass your own `avatar` urls.
 *
 * Browser support: all evergreen browsers. Collapsing rows use
 * grid-template-rows interpolation (Chrome 107+, Safari 16+, Firefox 66+),
 * older engines simply remove the row.
 * Accessibility: the freeze control is a real role="switch"; the converter is
 * a labelled input plus a radio group of currencies; approve / decline are
 * buttons with full labels and a polite live region; the chart is keyboard
 * scrubbable (arrow keys) and announces the focused week.
 * Reduced motion: the chart is drawn immediately, numbers do not tween, rows
 * leave without collapsing.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface BluCard {
  holder: string;
  company: string;
  last4: string;
  limit: number;
  spent: number;
}
export interface BluRate {
  code: string;
  name: string;
  rate: number;
  arrives: string;
}
export interface BluApproval {
  id: string;
  payee: string;
  memo: string;
  amount: number;
  requester: string;
  avatar: string;
  when: string;
}
export interface BluWeek {
  label: string;
  value: number;
}
export interface BluCategory {
  label: string;
  share: number;
}

export interface BentoLiveUiProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  card?: BluCard;
  rates?: BluRate[];
  approvals?: BluApproval[];
  spend?: BluWeek[];
  categories?: BluCategory[];
  className?: string;
}

const eur = (n: number, d = 2) =>
  "€" + n.toLocaleString("en-IE", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (n: number, d = 2) => n.toLocaleString("en-IE", { minimumFractionDigits: d, maximumFractionDigits: d });

const DEFAULT_CARD: BluCard = { holder: "Mara Lindqvist", company: "Okapi Studio GmbH", last4: "4417", limit: 4000, spent: 1284.6 };
const DEFAULT_RATES: BluRate[] = [
  { code: "GBP", name: "Pound sterling", rate: 0.8541, arrives: "Today, 16:00" },
  { code: "USD", name: "US dollar", rate: 1.0838, arrives: "Today, 18:30" },
  { code: "CHF", name: "Swiss franc", rate: 0.9412, arrives: "Today, 15:00" },
  { code: "SEK", name: "Swedish krona", rate: 11.482, arrives: "Tomorrow, 09:00" },
];
const DEFAULT_APPROVALS: BluApproval[] = [
  { id: "a1", payee: "Hetzner Online", memo: "Invoice 2026-1184, servers", amount: 612.4, requester: "Jonas", avatar: "/img/people/p8.webp", when: "2h ago" },
  { id: "a2", payee: "Druckerei Hansen", memo: "Lookbook print run, 400 copies", amount: 2380, requester: "Ayla", avatar: "/img/people/p6.webp", when: "Yesterday" },
  { id: "a3", payee: "Deutsche Bahn", memo: "Berlin to Milan, 2 seats", amount: 318.9, requester: "Kofi", avatar: "/img/people/p4.webp", when: "Mon" },
];
const DEFAULT_SPEND: BluWeek[] = [
  { label: "Aug 4", value: 2840 }, { label: "Aug 11", value: 3120 }, { label: "Aug 18", value: 2610 },
  { label: "Aug 25", value: 4480 }, { label: "Sep 1", value: 3790 }, { label: "Sep 8", value: 3350 },
  { label: "Sep 15", value: 5120 }, { label: "Sep 22", value: 4210 }, { label: "Sep 29", value: 3980 },
  { label: "Oct 6", value: 4630 }, { label: "Oct 13", value: 5480 }, { label: "Oct 20", value: 4592 },
];
const DEFAULT_CATS: BluCategory[] = [
  { label: "Contractors", share: 38 }, { label: "Software", share: 24 }, { label: "Travel", share: 21 }, { label: "Everything else", share: 17 },
];

function useReduced() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

/** Tween a number toward a target with a critically damped spring (rAF). */
function useSpringNumber(target: number, reduced: boolean) {
  const [v, setV] = useState(target);
  const cur = useRef({ x: target, vel: 0 });
  useEffect(() => {
    if (reduced) { cur.current = { x: target, vel: 0 }; setV(target); return; }
    let raf = 0, last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.032, (t - last) / 1000); last = t;
      const s = cur.current;
      const f = -380 * (s.x - target) - 38 * s.vel;
      s.vel += f * dt; s.x += s.vel * dt;
      if (Math.abs(s.x - target) < Math.abs(target) * 0.00002 + 0.0005 && Math.abs(s.vel) < 0.01) { s.x = target; s.vel = 0; setV(target); return; }
      setV(s.x); raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return v;
}

export function BentoLiveUi({
  eyebrow = "Tallyard for business",
  title = <>Spend, approve,<br />pay. <em>Before lunch.</em></>,
  lede = "One account for a company of 4 or 40. Cards with limits that mean something, invoices that wait for the right person, and euros that leave at the mid-market rate.",
  card = DEFAULT_CARD,
  rates = DEFAULT_RATES,
  approvals = DEFAULT_APPROVALS,
  spend = DEFAULT_SPEND,
  categories = DEFAULT_CATS,
  className,
}: BentoLiveUiProps) {
  const reduced = useReduced();
  const tid = useId();
  return (
    <section className={`fd-blu${className ? " " + className : ""}`} aria-labelledby={tid}>
      <style>{css}</style>
      <header className="fd-blu-head">
        <div>
          <p className="fd-blu-eyebrow"><span className="fd-blu-dot" aria-hidden="true" />{eyebrow}</p>
          <h2 id={tid} className="fd-blu-title">{title}</h2>
        </div>
        <p className="fd-blu-lede">{lede}</p>
      </header>
      <div className="fd-blu-grid">
        <CardTile card={card} />
        <SpendTile spend={spend} categories={categories} reduced={reduced} />
        <FxTile rates={rates} reduced={reduced} />
        <ApprovalTile items={approvals} reduced={reduced} />
      </div>
    </section>
  );
}

/* ───────────── card freeze ───────────── */
const TXS = [
  { n: "Figma", w: "Today, 09:12", a: 45 },
  { n: "Café Kosmos", w: "Yesterday, 13:40", a: 18.6 },
];
function CardTile({ card }: { card: BluCard }) {
  const [frozen, setFrozen] = useState(false);
  const pct = Math.min(100, (card.spent / card.limit) * 100);
  const id = useId();
  return (
    <article className="fd-blu-tile fd-blu-t-card" data-frozen={frozen ? "" : undefined}>
      <div className="fd-blu-tag"><span>01</span>Cards</div>
      <h3 className="fd-blu-h">Freeze a card from a train platform.</h3>
      <div className="fd-blu-cardwrap">
        <div className="fd-blu-card" aria-hidden="true">
          <svg className="fd-blu-guil" viewBox="0 0 340 214" preserveAspectRatio="none">
            {Array.from({ length: 14 }).map((_, i) => (
              <path key={i} d={`M-10 ${40 + i * 12} C 80 ${10 + i * 12}, 180 ${90 + i * 9}, 350 ${30 + i * 13}`} />
            ))}
          </svg>
          <div className="fd-blu-card-top">
            <span className="fd-blu-wm">tallyard<i>.</i></span>
            <span className="fd-blu-kind">Debit · Business</span>
          </div>
          <div className="fd-blu-chip"><i /><i /><i /></div>
          <div className="fd-blu-card-bot">
            <div>
              <span className="fd-blu-holder">{card.holder}</span>
              <span className="fd-blu-co">{card.company}</span>
            </div>
            <span className="fd-blu-num">•••• {card.last4}</span>
          </div>
          <div className="fd-blu-frost">
            <svg viewBox="0 0 340 214" preserveAspectRatio="xMidYMid slice">
              {[[54, 48, 26], [278, 60, 34], [190, 170, 22], [92, 168, 16], [236, 118, 12], [140, 82, 10]].map(([x, y, r], i) => (
                <g key={i} transform={`translate(${x} ${y})`} style={{ ["--i" as string]: i }}>
                  {[0, 60, 120].map((a) => (
                    <g key={a} transform={`rotate(${a})`}>
                      <line x1={-r} y1="0" x2={r} y2="0" />
                      <line x1={r * 0.55} y1="0" x2={r * 0.75} y2={-r * 0.2} /><line x1={r * 0.55} y1="0" x2={r * 0.75} y2={r * 0.2} />
                      <line x1={-r * 0.55} y1="0" x2={-r * 0.75} y2={-r * 0.2} /><line x1={-r * 0.55} y1="0" x2={-r * 0.75} y2={r * 0.2} />
                    </g>
                  ))}
                </g>
              ))}
            </svg>
            <span className="fd-blu-frozen">Frozen</span>
          </div>
        </div>
      </div>
      <ul className="fd-blu-tx" aria-label="Latest card activity">
        {frozen && (
          <li className="fd-blu-tx-blocked" key="blocked">
            <span className="fd-blu-tx-m">UB</span><span className="fd-blu-tx-n">Uber Trip, Lisbon<small>Just now, blocked</small></span><span className="fd-blu-mono">€23.40</span>
          </li>
        )}
        {TXS.map((t) => (
          <li key={t.n}><span className="fd-blu-tx-m">{t.n.slice(0, 2).toUpperCase()}</span><span className="fd-blu-tx-n">{t.n}<small>{t.w}</small></span><span className="fd-blu-mono">{eur(t.a)}</span></li>
        ))}
      </ul>
      <div className="fd-blu-row">
        <div className="fd-blu-sw-label">
          <span id={id} className="fd-blu-sw-title">{frozen ? "Card frozen" : "Card active"}</span>
          <span className="fd-blu-sw-sub" aria-live="polite">{frozen ? `Nothing can be charged to •••• ${card.last4}. Unfreeze any time.` : "Online, in store and contactless."}</span>
        </div>
        <button type="button" role="switch" aria-checked={frozen} aria-labelledby={id} className="fd-blu-switch" onClick={() => setFrozen((f) => !f)}>
          <span className="fd-blu-knob" />
        </button>
      </div>
      <div className="fd-blu-limit">
        <div className="fd-blu-limit-row"><span>Monthly limit</span><span className="fd-blu-mono">{eur(card.spent)} <s>/ {eur(card.limit, 0)}</s></span></div>
        <div className="fd-blu-bar" role="meter" aria-label="Monthly limit used" aria-valuemin={0} aria-valuemax={card.limit} aria-valuenow={card.spent}><i style={{ width: pct + "%" }} /></div>
      </div>
    </article>
  );
}

/* ───────────── spend chart ───────────── */
function SpendTile({ spend, categories, reduced }: { spend: BluWeek[]; categories: BluCategory[]; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  const W = 640, H = 200, P = 8;
  const max = Math.max(...spend.map((s) => s.value)) * 1.12;
  const pts = spend.map((s, i) => [P + (i * (W - P * 2)) / (spend.length - 1), H - (s.value / max) * H] as const);
  const line = useMemo(() => {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      d += ` C${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  }, [pts]);
  const area = `${line} L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H} Z`;
  const total = spend.reduce((a, s) => a + s.value, 0);
  const last = spend[spend.length - 1].value, prev = spend[spend.length - 2].value;
  const idx = hover ?? spend.length - 1;

  useEffect(() => {
    if (reduced) { setDrawn(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setDrawn(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const pick = (clientX: number) => {
    const r = ref.current?.querySelector("svg")?.getBoundingClientRect();
    if (!r) return;
    const x = ((clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p[0] - x) < Math.abs(pts[best][0] - x)) best = i; });
    setHover(best);
  };
  const [hx, hy] = pts[idx];

  return (
    <article className="fd-blu-tile fd-blu-t-spend" ref={ref} data-drawn={drawn ? "" : undefined}>
      <div className="fd-blu-spend-top">
        <div>
          <div className="fd-blu-tag"><span>02</span>Spend</div>
          <h3 className="fd-blu-h">Every euro, by the week it left.</h3>
        </div>
        <div className="fd-blu-kpi">
          <span className="fd-blu-kpi-l">12 weeks</span>
          <span className="fd-blu-kpi-v">{eur(total, 0)}</span>
          <span className="fd-blu-kpi-d">{last > prev ? "Up " : "Down "}{fmt(Math.abs(((last - prev) / prev) * 100), 1)}% on last week</span>
        </div>
      </div>
      <div
        className="fd-blu-chart"
        tabIndex={0}
        role="group"
        aria-label="Weekly spend chart. Use left and right arrow keys to read each week."
        onPointerMove={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            const d = e.key === "ArrowRight" ? 1 : -1;
            setHover((h) => Math.max(0, Math.min(spend.length - 1, (h ?? spend.length - 1) + d)));
          }
        }}
        onBlur={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H + 24}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--fd-blu-lime)" stopOpacity=".55" />
              <stop offset="1" stopColor="var(--fd-blu-lime)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => <line key={f} className="fd-blu-gl" x1="0" x2={W} y1={H * f} y2={H * f} vectorEffect="non-scaling-stroke" />)}
          <path className="fd-blu-area" d={area} fill={`url(#g${gid})`} />
          <path className="fd-blu-line" d={line} pathLength={1} vectorEffect="non-scaling-stroke" />
          <line className="fd-blu-cross" x1={hx} x2={hx} y1="0" y2={H} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="fd-blu-pt" style={{ left: `${(hx / W) * 100}%`, top: `calc(30px + ${hy / (H + 24)} * (100% - 50px))` }} aria-hidden="true" />
        <span className="fd-blu-tip" style={{ left: `${Math.min(86, Math.max(14, (hx / W) * 100))}%` }}>
          <b>{eur(spend[idx].value, 0)}</b> w/c {spend[idx].label}
        </span>
        <div className="fd-blu-xl" aria-hidden="true">
          {spend.map((s, i) => <span key={s.label} data-on={i === idx ? "" : undefined} data-alt={i % 4 !== 0 && i !== spend.length - 1 ? "" : undefined}>{(i % 2 === 0 && i < spend.length - 2) || i === spend.length - 1 ? s.label : ""}</span>)}
        </div>
        <span className="fd-blu-sr" aria-live="polite">{hover !== null ? `Week of ${spend[idx].label}: ${eur(spend[idx].value, 0)}` : ""}</span>
      </div>
      <div className="fd-blu-cats">
        <div className="fd-blu-stack" aria-hidden="true">
          {categories.map((c, i) => <i key={c.label} style={{ flexGrow: c.share, ["--k" as string]: i }} />)}
        </div>
        <ul>
          {categories.map((c, i) => (
            <li key={c.label}><i style={{ ["--k" as string]: i }} aria-hidden="true" />{c.label}<span className="fd-blu-mono">{c.share}%</span></li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/* ───────────── FX converter ───────────── */
function FxTile({ rates, reduced }: { rates: BluRate[]; reduced: boolean }) {
  const [amount, setAmount] = useState("12500");
  const [code, setCode] = useState(rates[0].code);
  const [flip, setFlip] = useState(0);
  const [sent, setSent] = useState(false);
  const r = rates.find((x) => x.code === code) ?? rates[0];
  const n = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
  const fee = n > 10000 ? (n - 10000) * 0.0035 : 0;
  const out = useSpringNumber((n - fee) * r.rate, reduced);
  const inId = useId();
  return (
    <article className="fd-blu-tile fd-blu-t-fx">
      <div className="fd-blu-tag"><span>03</span>FX</div>
      <h3 className="fd-blu-h">Mid-market, no spread.</h3>
      <div className="fd-blu-fx">
        <label className="fd-blu-fx-box" htmlFor={inId}>
          <span className="fd-blu-fx-l">You send</span>
          <span className="fd-blu-fx-in">
            <input id={inId} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").slice(0, 9))} aria-label="Amount in euros" />
            <span className="fd-blu-ccy">EUR</span>
          </span>
        </label>
        <button type="button" className="fd-blu-swap" aria-label="Refresh rate" onClick={() => setFlip((f) => f + 1)} style={{ transform: `rotate(${flip * 180}deg)` }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v10M1.5 9.5 4 12l2.5-2.5M10 12V2M7.5 4.5 10 2l2.5 2.5" /></svg>
        </button>
        <div className="fd-blu-fx-box fd-blu-fx-out">
          <span className="fd-blu-fx-l">They receive</span>
          <span className="fd-blu-fx-in"><output className="fd-blu-fx-v" aria-live="polite">{fmt(out)}</output><span className="fd-blu-ccy">{r.code}</span></span>
        </div>
      </div>
      <div className="fd-blu-ccys" role="radiogroup" aria-label="Currency">
        {rates.map((x) => (
          <button key={x.code} type="button" role="radio" aria-checked={x.code === code} title={x.name} onClick={() => setCode(x.code)}>{x.code}</button>
        ))}
      </div>
      <dl className="fd-blu-fx-meta">
        <div><dt>Rate</dt><dd className="fd-blu-mono">1 EUR = {r.rate.toFixed(4)}</dd></div>
        <div><dt>Fee</dt><dd className="fd-blu-mono">{fee ? eur(fee) : "€0.00"}</dd></div>
        <div><dt>Arrives</dt><dd>{r.arrives}</dd></div>
      </dl>
      <button type="button" className="fd-blu-send" data-sent={sent ? "" : undefined} onClick={() => setSent((v) => !v)}>
        {sent ? <>Scheduled, {r.arrives.toLowerCase()}<span className="fd-blu-undo">Undo</span></> : <>Send {r.code} {fmt((n - fee) * r.rate)}</>}
      </button>
    </article>
  );
}

/* ───────────── approval queue ───────────── */
function ApprovalTile({ items, reduced }: { items: BluApproval[]; reduced: boolean }) {
  const [list, setList] = useState(items.map((i) => ({ ...i, state: "open" as "open" | "approved" | "declined" })));
  const [msg, setMsg] = useState("");
  const open = list.filter((l) => l.state === "open");
  const decide = (id: string, state: "approved" | "declined") => {
    const it = list.find((l) => l.id === id)!;
    setList((ls) => ls.map((l) => (l.id === id ? { ...l, state } : l)));
    setMsg(`${state === "approved" ? "Approved" : "Declined"} ${eur(it.amount)} to ${it.payee}.`);
  };
  const paid = list.filter((l) => l.state === "approved").reduce((a, l) => a + l.amount, 0);
  return (
    <article className="fd-blu-tile fd-blu-t-ap">
      <div className="fd-blu-ap-top">
        <div className="fd-blu-tag"><span>04</span>Approvals</div>
        <span className="fd-blu-count" aria-label={`${open.length} waiting`}>{open.length}</span>
      </div>
      <h3 className="fd-blu-h">Invoices wait for the right yes.</h3>
      <ul className="fd-blu-ap">
        {list.map((l) => (
          <li key={l.id} className="fd-blu-ap-li" data-state={l.state} data-instant={reduced ? "" : undefined}>
            <div className="fd-blu-ap-in">
              <div className="fd-blu-ap-row">
                <img src={l.avatar} alt="" width={32} height={32} loading="lazy" />
                <div className="fd-blu-ap-txt">
                  <span className="fd-blu-ap-payee">{l.payee}</span>
                  <span className="fd-blu-ap-memo">{l.memo}</span>
                  <span className="fd-blu-ap-who">{l.requester} asked, {l.when}</span>
                </div>
                <span className="fd-blu-ap-amt fd-blu-mono">{eur(l.amount)}</span>
              </div>
              <div className="fd-blu-ap-btns">
                <button type="button" className="fd-blu-no" disabled={l.state !== "open"} onClick={() => decide(l.id, "declined")} aria-label={`Decline ${eur(l.amount)} to ${l.payee}`}>Decline</button>
                <button type="button" className="fd-blu-yes" disabled={l.state !== "open"} onClick={() => decide(l.id, "approved")} aria-label={`Approve ${eur(l.amount)} to ${l.payee}`}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 6.2 5 8.6l4.5-5" /></svg>
                  Approve
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {open.length === 0 && (
        <div className="fd-blu-empty">
          <p><b>Queue clear.</b> {eur(paid)} goes out in the 15:00 batch.</p>
          <button type="button" className="fd-blu-link" onClick={() => { setList(items.map((i) => ({ ...i, state: "open" }))); setMsg("Queue reset."); }}>Reset demo</button>
        </div>
      )}
      <span className="fd-blu-sr" role="status" aria-live="polite">{msg}</span>
    </article>
  );
}

const css = `
:where(.fd-blu,.fd-blu *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-blu,.fd-blu *)::before,:where(.fd-blu,.fd-blu *)::after{box-sizing:border-box}
:where(.fd-blu svg,.fd-blu img){display:block;flex-shrink:0}
:where(.fd-blu button,.fd-blu input){appearance:none;-webkit-appearance:none;outline:0;border-radius:0;cursor:pointer}
.fd-blu{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-blu-bg:#EEEBE3;--fd-blu-ink:#141412;--fd-blu-tile:#FBFAF6;--fd-blu-mut:#6C6A62;--fd-blu-line:rgba(20,20,18,.1);
  --fd-blu-forest:#0E4D33;--fd-blu-lime:#C6F04D;--fd-blu-red:#B9381C;
  --fd-blu-sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --fd-blu-mono-f:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  display:block;width:100%;padding:clamp(56px,8vw,112px) clamp(16px,4vw,56px);background:var(--fd-blu-bg);color:var(--fd-blu-ink);
  font:400 15px/1.45 var(--fd-blu-sans);letter-spacing:-.005em;-webkit-font-smoothing:antialiased}
.fd-blu-mono{font-family:var(--fd-blu-mono-f);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.fd-blu-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.fd-blu-head{max-width:1240px;margin:0 auto 48px;display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:32px;align-items:end}
.fd-blu-eyebrow{display:flex;align-items:center;gap:10px;font:500 13px/16px var(--fd-blu-mono-f);letter-spacing:.02em;color:var(--fd-blu-mut);margin-bottom:20px}
.fd-blu-dot{display:block;width:8px;height:8px;border-radius:2px;background:var(--fd-blu-forest);box-shadow:3px 3px 0 var(--fd-blu-lime)}
.fd-blu-title{font:650 clamp(2.25rem,6vw,5.5rem)/.94 var(--fd-blu-sans);letter-spacing:-.05em;color:var(--fd-blu-ink)}
.fd-blu-title em{font-style:normal;color:var(--fd-blu-forest);background:linear-gradient(transparent 62%,var(--fd-blu-lime) 62%,var(--fd-blu-lime) 90%,transparent 90%)}
.fd-blu-lede{font:400 17px/1.5 var(--fd-blu-sans);letter-spacing:-.01em;color:#3B3A35;max-width:420px;justify-self:end}
.fd-blu-grid{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:auto;gap:12px}
.fd-blu-tile{position:relative;background:var(--fd-blu-tile);border-radius:20px;padding:24px;box-shadow:0 0 0 1px var(--fd-blu-line);display:flex;flex-direction:column;min-width:0}
.fd-blu-tag{display:flex;align-items:center;gap:8px;font:500 12px/16px var(--fd-blu-mono-f);letter-spacing:.04em;text-transform:uppercase;color:var(--fd-blu-mut)}
.fd-blu-tag span{display:inline-block;padding:2px 5px;border-radius:4px;background:var(--fd-blu-ink);color:var(--fd-blu-tile);font-size:11px;line-height:14px}
.fd-blu-h{margin-top:10px;font:600 20px/1.2 var(--fd-blu-sans);letter-spacing:-.02em;color:var(--fd-blu-ink);max-width:22ch}
.fd-blu-t-card{grid-column:1 / span 5;grid-row:1 / span 2}
.fd-blu-t-spend{grid-column:6 / span 7}
.fd-blu-t-fx{grid-column:6 / span 3}
.fd-blu-t-ap{grid-column:9 / span 4}

/* card */
.fd-blu-cardwrap{flex:1;display:grid;place-items:center;padding:28px 0 24px;perspective:900px}
.fd-blu-card{position:relative;width:100%;max-width:420px;aspect-ratio:1.586;border-radius:16px;overflow:hidden;padding:20px 22px;display:flex;flex-direction:column;justify-content:space-between;color:#F1F5E6;
  background:radial-gradient(120% 90% at 85% 0%,#1C6B49 0%,transparent 60%),linear-gradient(155deg,#125A3C,#0A3825 70%);
  box-shadow:0 1px 0 rgba(255,255,255,.14) inset,0 30px 50px -28px rgba(14,77,51,.7),0 8px 18px -10px rgba(0,0,0,.35);
  transform:rotateX(8deg) rotateZ(-3deg);transition:transform var(--fd-dur-3) var(--fd-ease-out),filter var(--fd-dur-3) var(--fd-ease-in-out)}
.fd-blu-t-card:hover .fd-blu-card{transform:rotateX(0) rotateZ(-1deg) translateY(-4px)}
.fd-blu-guil{position:absolute;inset:0;width:100%;height:100%;opacity:.18}
.fd-blu-guil path{fill:none;stroke:var(--fd-blu-lime);stroke-width:.6}
.fd-blu-card-top,.fd-blu-card-bot{position:relative;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.fd-blu-card-bot{align-items:flex-end}
.fd-blu-wm{font:700 22px/1 var(--fd-blu-sans);letter-spacing:-.06em}
.fd-blu-wm i{font-style:normal;color:var(--fd-blu-lime)}
.fd-blu-kind{font:500 10px/14px var(--fd-blu-mono-f);letter-spacing:.08em;text-transform:uppercase;opacity:.75}
.fd-blu-chip{position:relative;width:40px;height:30px;border-radius:6px;background:linear-gradient(135deg,#E3E7C9,#B9BE95);display:grid;grid-template-rows:repeat(3,1fr);padding:5px 0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
.fd-blu-chip i{display:block;border-top:1px solid rgba(0,0,0,.18)}
.fd-blu-holder{display:block;font:600 14px/18px var(--fd-blu-sans);letter-spacing:-.01em}
.fd-blu-co{display:block;font:400 12px/16px var(--fd-blu-sans);opacity:.7}
.fd-blu-num{font:500 14px/18px var(--fd-blu-mono-f);letter-spacing:.06em}
.fd-blu-frost{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(160deg,rgba(236,244,247,.82),rgba(205,222,230,.7));opacity:0;transition:opacity var(--fd-dur-3) var(--fd-ease-in-out);pointer-events:none}
.fd-blu-frost svg{position:absolute;inset:0;width:100%;height:100%}
.fd-blu-frost line{stroke:#fff;stroke-width:1.4;stroke-linecap:round}
.fd-blu-frost g[style]{transform-box:fill-box;transform-origin:center;opacity:0;scale:.3;rotate:-40deg;transition:opacity var(--fd-dur-3) var(--fd-ease-out),scale var(--fd-dur-4) var(--fd-spring),rotate var(--fd-dur-4) var(--fd-ease-out);transition-delay:calc(var(--i) * 60ms)}
.fd-blu-frozen{position:relative;font:600 12px/16px var(--fd-blu-mono-f);letter-spacing:.24em;text-transform:uppercase;color:#1C3A48;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.7);box-shadow:0 0 0 1px rgba(28,58,72,.18)}
.fd-blu-t-card[data-frozen] .fd-blu-card{filter:saturate(.25);transform:rotateX(0) rotateZ(0)}
.fd-blu-t-card[data-frozen] .fd-blu-frost{opacity:1}
.fd-blu-t-card[data-frozen] .fd-blu-frost g[style]{opacity:.9;scale:1;rotate:0deg}
.fd-blu-tx{display:flex;flex-direction:column;margin-bottom:8px}
.fd-blu-tx li{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 0;font:500 14px/18px var(--fd-blu-sans)}
.fd-blu-tx-m{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:#EFEDE5;font:600 10px/1 var(--fd-blu-mono-f);color:var(--fd-blu-mut)}
.fd-blu-tx-n{display:flex;flex-direction:column;min-width:0}
.fd-blu-tx-n small{font:400 12px/16px var(--fd-blu-sans);color:var(--fd-blu-mut)}
.fd-blu-tx .fd-blu-mono{font-size:14px}
.fd-blu-tx-blocked{animation:fd-blu-in var(--fd-dur-3) var(--fd-ease-out) both}
.fd-blu-tx-blocked .fd-blu-tx-m{background:#DCE8EE;color:#1C3A48}
.fd-blu-tx-blocked small{color:#3E6F86}
.fd-blu-tx-blocked .fd-blu-mono{text-decoration:line-through;color:var(--fd-blu-mut)}
.fd-blu-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;border-top:1px solid var(--fd-blu-line)}
.fd-blu-sw-label{display:flex;flex-direction:column;gap:2px;min-width:0}
.fd-blu-sw-title{font:600 15px/20px var(--fd-blu-sans);letter-spacing:-.01em}
.fd-blu-sw-sub{font:400 13px/18px var(--fd-blu-sans);color:var(--fd-blu-mut)}
.fd-blu-switch{position:relative;flex:none;width:52px;height:30px;border-radius:999px;background:#D8D5CB;transition:background-color var(--fd-dur-2) var(--fd-ease-in-out)}
.fd-blu-switch[aria-checked="true"]{background:#5D8AA0}
.fd-blu-knob{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform var(--fd-dur-2) var(--fd-spring),width var(--fd-dur-1)}
.fd-blu-switch[aria-checked="true"] .fd-blu-knob{transform:translateX(22px)}
.fd-blu-switch:active .fd-blu-knob{width:28px}
.fd-blu-switch[aria-checked="true"]:active .fd-blu-knob{transform:translateX(18px)}
.fd-blu-limit{padding-top:14px;border-top:1px solid var(--fd-blu-line)}
.fd-blu-limit-row{display:flex;justify-content:space-between;font:400 13px/18px var(--fd-blu-sans);color:var(--fd-blu-mut);margin-bottom:10px}
.fd-blu-limit-row .fd-blu-mono{color:var(--fd-blu-ink)}
.fd-blu-limit-row s{text-decoration:none;color:var(--fd-blu-mut)}
.fd-blu-bar{height:6px;border-radius:3px;background:#E4E1D7;overflow:hidden}
.fd-blu-bar i{display:block;height:100%;border-radius:3px;background:var(--fd-blu-forest)}

/* spend */
.fd-blu-spend-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.fd-blu-kpi{display:flex;flex-direction:column;align-items:flex-end;text-align:right}
.fd-blu-kpi-l{font:500 12px/16px var(--fd-blu-mono-f);color:var(--fd-blu-mut);text-transform:uppercase;letter-spacing:.04em}
.fd-blu-kpi-v{font:600 32px/1.1 var(--fd-blu-sans);letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.fd-blu-kpi-d{font:500 12px/16px var(--fd-blu-mono-f);color:var(--fd-blu-mut)}
.fd-blu-chart{position:relative;margin-top:12px;height:236px;padding-top:30px;border-radius:8px;outline:0;cursor:crosshair;touch-action:pan-y}
.fd-blu-chart:focus-visible{box-shadow:0 0 0 2px var(--fd-blu-bg),0 0 0 4px rgba(14,77,51,.7)}
.fd-blu-chart svg{width:100%;height:calc(100% - 50px);overflow:visible}
.fd-blu-gl{stroke:var(--fd-blu-line);stroke-width:1;stroke-dasharray:2 4}
.fd-blu-line{fill:none;stroke:var(--fd-blu-forest);stroke-width:2.25;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1600ms var(--fd-ease-out)}
.fd-blu-area{opacity:0;transition:opacity var(--fd-dur-4) var(--fd-ease-out) 900ms}
.fd-blu-t-spend[data-drawn] .fd-blu-line{stroke-dashoffset:0}
.fd-blu-t-spend[data-drawn] .fd-blu-area{opacity:1}
.fd-blu-cross{stroke:var(--fd-blu-ink);stroke-width:1;stroke-dasharray:3 3;opacity:.35}
.fd-blu-pt{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--fd-blu-tile);box-shadow:0 0 0 2.5px var(--fd-blu-forest);transition:left var(--fd-dur-2) var(--fd-ease-out),top var(--fd-dur-2) var(--fd-ease-out);pointer-events:none}
.fd-blu-tip{position:absolute;top:0;transform:translateX(-50%);padding:5px 9px;border-radius:7px;background:var(--fd-blu-ink);color:var(--fd-blu-tile);font:400 12px/16px var(--fd-blu-sans);white-space:nowrap;transition:left var(--fd-dur-2) var(--fd-ease-out);pointer-events:none}
.fd-blu-tip b{font-weight:600;font-family:var(--fd-blu-mono-f);letter-spacing:-.02em;margin-right:4px;color:var(--fd-blu-lime)}
.fd-blu-xl{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;font:400 11px/14px var(--fd-blu-mono-f);color:var(--fd-blu-mut)}
.fd-blu-xl span{width:0;display:flex;justify-content:center;white-space:nowrap}
.fd-blu-xl span[data-on]{color:var(--fd-blu-ink)}
.fd-blu-cats{margin-top:18px;padding-top:16px;border-top:1px solid var(--fd-blu-line)}
.fd-blu-stack{display:flex;gap:3px;height:10px}
.fd-blu-stack i,.fd-blu-cats li i{display:block;border-radius:2px;background:color-mix(in srgb,var(--fd-blu-forest) calc(100% - var(--k) * 26%),var(--fd-blu-lime))}
.fd-blu-cats ul{display:flex;flex-wrap:wrap;gap:6px 20px;margin-top:12px}
.fd-blu-cats li{display:flex;align-items:center;gap:7px;font:400 13px/18px var(--fd-blu-sans);color:#3B3A35}
.fd-blu-cats li i{width:8px;height:8px}
.fd-blu-cats li .fd-blu-mono{color:var(--fd-blu-mut);font-size:12px}

/* fx */
.fd-blu-fx{position:relative;margin-top:18px;display:flex;flex-direction:column;gap:4px}
.fd-blu-fx-box{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:12px;background:#F1EFE8;box-shadow:inset 0 0 0 1px var(--fd-blu-line);cursor:text;transition:box-shadow var(--fd-dur-1)}
.fd-blu-fx-box:focus-within{box-shadow:inset 0 0 0 1.5px var(--fd-blu-forest)}
.fd-blu-fx-out{background:var(--fd-blu-forest);color:#F1F5E6;box-shadow:none;cursor:default}
.fd-blu-fx-l{font:500 11px/14px var(--fd-blu-mono-f);letter-spacing:.04em;text-transform:uppercase;opacity:.65}
.fd-blu-fx-in{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.fd-blu-fx-in input,.fd-blu-fx-v{width:100%;min-width:0;font:600 24px/30px var(--fd-blu-mono-f);letter-spacing:-.04em;color:inherit;font-variant-numeric:tabular-nums;cursor:text}
.fd-blu-fx-v{display:block;cursor:default;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fd-blu-ccy{font:600 12px/16px var(--fd-blu-mono-f);letter-spacing:.04em;opacity:.7}
.fd-blu-fx-out .fd-blu-ccy{color:var(--fd-blu-lime);opacity:1}
.fd-blu-swap{position:absolute;left:50%;top:50%;margin:-15px 0 0 -15px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--fd-blu-tile);color:var(--fd-blu-ink);box-shadow:0 0 0 1px var(--fd-blu-line),0 2px 6px rgba(0,0,0,.08);transition:transform var(--fd-dur-3) var(--fd-spring);z-index:1}
.fd-blu-swap:focus-visible,.fd-blu-ccys button:focus-visible,.fd-blu-ap-btns button:focus-visible,.fd-blu-switch:focus-visible,.fd-blu-link:focus-visible{outline:2px solid rgba(14,77,51,.7);outline-offset:2px}
.fd-blu-ccys{display:flex;gap:4px;margin-top:12px;padding:3px;border-radius:999px;background:#F1EFE8}
.fd-blu-ccys button{flex:1;height:28px;border-radius:999px;font:600 12px/1 var(--fd-blu-mono-f);color:var(--fd-blu-mut);transition:background-color var(--fd-dur-2) var(--fd-ease-in-out),color var(--fd-dur-1)}
.fd-blu-ccys button:hover{color:var(--fd-blu-ink)}
.fd-blu-ccys button[aria-checked="true"]{background:var(--fd-blu-tile);color:var(--fd-blu-ink);box-shadow:0 1px 2px rgba(0,0,0,.1),0 0 0 1px var(--fd-blu-line)}
.fd-blu-fx-meta{margin-top:16px;display:grid;gap:6px}
.fd-blu-fx-meta div{display:flex;justify-content:space-between;gap:8px;font:400 13px/18px var(--fd-blu-sans)}
.fd-blu-fx-meta dt{color:var(--fd-blu-mut)}
.fd-blu-fx-meta dd{text-align:right}

.fd-blu-send{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:10px;height:42px;border-radius:999px;background:var(--fd-blu-ink);color:var(--fd-blu-tile);font:600 14px/1 var(--fd-blu-sans);letter-spacing:-.01em;transition:transform var(--fd-dur-2) var(--fd-spring),background-color var(--fd-dur-2) var(--fd-ease-in-out)}
.fd-blu-fx-meta{margin-bottom:18px}
.fd-blu-send:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-blu-send[data-sent]{background:var(--fd-blu-lime);color:var(--fd-blu-ink)}
.fd-blu-send:focus-visible{outline:2px solid rgba(14,77,51,.7);outline-offset:2px}
.fd-blu-undo{font:500 12px/1 var(--fd-blu-mono-f);text-decoration:underline;text-underline-offset:3px;opacity:.7}
/* approvals */
.fd-blu-ap-top{display:flex;justify-content:space-between;align-items:center}
.fd-blu-count{min-width:26px;height:26px;padding:0 8px;border-radius:999px;display:grid;place-items:center;background:var(--fd-blu-lime);color:var(--fd-blu-ink);font:700 13px/1 var(--fd-blu-mono-f)}
.fd-blu-ap{margin-top:14px;display:flex;flex-direction:column}
.fd-blu-ap-li{display:grid;grid-template-rows:1fr;transition:grid-template-rows var(--fd-dur-3) var(--fd-ease-in-out) 380ms,opacity var(--fd-dur-2) 380ms}
.fd-blu-ap-in{overflow:hidden;min-height:0;border-top:1px solid var(--fd-blu-line);padding:12px 0;transition:padding var(--fd-dur-3) var(--fd-ease-in-out) 380ms,border-color var(--fd-dur-2) 380ms}
.fd-blu-ap-li:first-child .fd-blu-ap-in{border-top:0;padding-top:0}
.fd-blu-ap-li:not([data-state="open"]){grid-template-rows:0fr;opacity:0}
.fd-blu-ap-li:not([data-state="open"]) .fd-blu-ap-in{padding-top:0;padding-bottom:0;border-color:transparent}
.fd-blu-ap-li[data-instant]{transition:none}.fd-blu-ap-li[data-instant] .fd-blu-ap-in{transition:none}
.fd-blu-ap-row{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:10px;align-items:start}
.fd-blu-ap-row img{width:32px;height:32px;border-radius:50%;object-fit:cover;background:#ddd}
.fd-blu-ap-txt{display:flex;flex-direction:column;min-width:0}
.fd-blu-ap-payee{font:600 14px/18px var(--fd-blu-sans);letter-spacing:-.01em}
.fd-blu-ap-memo{font:400 13px/17px var(--fd-blu-sans);color:#3B3A35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fd-blu-ap-who{font:400 12px/16px var(--fd-blu-sans);color:var(--fd-blu-mut)}
.fd-blu-ap-amt{font-size:14px;line-height:18px;font-weight:600}
.fd-blu-ap-btns{display:flex;justify-content:flex-end;gap:6px;margin-top:8px}
.fd-blu-ap-btns button{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;font:600 13px/1 var(--fd-blu-sans);transition:transform var(--fd-dur-1),background-color var(--fd-dur-2) var(--fd-ease-in-out),color var(--fd-dur-2)}
.fd-blu-ap-btns button:active{transform:scale(.96);transition:transform var(--fd-dur-1)}
.fd-blu-no{color:var(--fd-blu-mut);box-shadow:inset 0 0 0 1px var(--fd-blu-line)}
.fd-blu-no:hover{color:var(--fd-blu-red)}
.fd-blu-yes{background:var(--fd-blu-ink);color:var(--fd-blu-tile)}
.fd-blu-yes:hover{background:var(--fd-blu-forest)}
.fd-blu-ap-li[data-state="approved"] .fd-blu-yes{background:var(--fd-blu-lime);color:var(--fd-blu-ink);transform:scale(1.06);transition:transform var(--fd-dur-2) var(--fd-spring),background-color var(--fd-dur-1)}
.fd-blu-ap-li[data-state="declined"] .fd-blu-no{color:var(--fd-blu-red);box-shadow:inset 0 0 0 1px var(--fd-blu-red)}
.fd-blu-ap-btns button:disabled{cursor:default}
.fd-blu-empty{margin-top:4px;padding:16px;border-radius:12px;background:#F1EFE8;display:flex;flex-direction:column;gap:8px;align-items:flex-start;animation:fd-blu-in var(--fd-dur-3) var(--fd-ease-out) both}
.fd-blu-empty p{font:400 14px/20px var(--fd-blu-sans)}
.fd-blu-empty b{font-weight:600}
.fd-blu-link{font:600 13px/18px var(--fd-blu-sans);color:var(--fd-blu-forest);text-decoration:underline;text-underline-offset:3px;border-radius:4px}
@keyframes fd-blu-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

@media (max-width:1080px){
  .fd-blu-t-card{grid-column:1 / span 6;grid-row:auto}
  .fd-blu-t-spend{grid-column:1 / -1;order:-1}
  .fd-blu-t-fx{grid-column:7 / span 6}
  .fd-blu-t-ap{grid-column:1 / -1}
}
@media (max-width:720px){
  .fd-blu-head{grid-template-columns:1fr;gap:20px}
  .fd-blu-lede{justify-self:start;font-size:16px}
  .fd-blu-grid{grid-template-columns:1fr}
  .fd-blu-tile{grid-column:1 / -1!important;padding:20px;border-radius:18px}
  .fd-blu-t-spend{order:0}
  .fd-blu-spend-top{flex-direction:column}
  .fd-blu-kpi{align-items:flex-start;text-align:left}
  .fd-blu-chart{height:210px}
  .fd-blu-xl span[data-alt]{visibility:hidden}
  .fd-blu-cardwrap{padding:24px 4px}
}
@media (prefers-reduced-motion:reduce){
  .fd-blu *{transition-duration:1ms!important;transition-delay:0ms!important;animation-duration:1ms!important}
}
@media (prefers-contrast:more){.fd-blu-tile{box-shadow:0 0 0 1px currentColor}}
`;

export function Demo() {
  return (
    <div className="fd-blud">
      <style>{`.fd-blud{background:#EEEBE3;min-height:100vh}.fd-blud-nav{box-sizing:border-box;max-width:1352px;margin:0 auto;padding:18px clamp(16px,4vw,56px);display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(20,20,18,.1);font:500 13px/18px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;color:#6C6A62}.fd-blud-nav b{font:700 19px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter",sans-serif;letter-spacing:-.06em;color:#141412}.fd-blud-nav b i{font-style:normal;color:#0E4D33}`}</style>
      <div className="fd-blud-nav"><b>tallyard<i>.</i></b><span>Business · Pricing · Log in</span></div>
      <BentoLiveUi />
    </div>
  );
}
