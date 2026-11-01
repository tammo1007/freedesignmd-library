/**
 * AnimatedNumber — an odometer. Each digit is its own drum that rolls to the
 * new value; rises roll upward and falls roll downward (wrapping through 0
 * the way a real counter does). Formatting is Intl.NumberFormat, so locale
 * separators, currencies, percents and compact notation all just work.
 * On change the number flashes green (up) or red (down).
 *
 * Props
 * - value: number
 * - locale?: string                   Default "en-US".
 * - format?: Intl.NumberFormatOptions e.g. { style: "currency", currency: "EUR" }.
 * - duration?: number                 Roll duration in ms. Default 700.
 * - flash?: boolean                   Colour flash on change. Default true.
 * - signColor?: boolean               Keep text green/red by sign (for deltas). Default false.
 * - className / style                 Typography is yours; use tabular figures.
 * CSS vars: --fd-an-up (#16A34A), --fd-an-down (#DC2626), --fd-an-dur.
 *
 * Accessibility: the formatted value is real text in a visually hidden span;
 * the drums are aria-hidden. Don't put aria-live on fast tickers — announce
 * summaries instead (see the Demo).
 * Reduced motion: digits swap without rolling; the flash is a short fade.
 * Browser support: all evergreen browsers.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
const STRIP = Array.from({ length: 30 }, (_, i) => i % 10);

function Digit({ d, dir, duration }: { d: number; dir: number; duration: number }) {
  const strip = useRef<HTMLSpanElement>(null);
  const pos = useRef(10 + d);
  const timer = useRef(0);
  useIso(() => {
    const el = strip.current;
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const cur = pos.current % 10;
    if (cur === d) return;
    window.clearTimeout(timer.current);
    if (reduced) {
      el.style.transition = "none";
      pos.current = 10 + d;
      el.style.transform = `translate3d(0,${-pos.current}em,0)`;
      return;
    }
    // normalise to the middle copy without animating, then roll in `dir`
    el.style.transition = "none";
    el.style.transform = `translate3d(0,${-(10 + cur)}em,0)`;
    void el.offsetHeight;
    let target = 10 + d;
    if (dir > 0 && d <= cur) target = 20 + d;
    if (dir < 0 && d >= cur) target = d;
    el.style.transition = `transform ${duration}ms cubic-bezier(.22,1,.36,1)`;
    el.style.transform = `translate3d(0,${-target}em,0)`;
    pos.current = target;
    timer.current = window.setTimeout(() => {
      el.style.transition = "none";
      pos.current = 10 + d;
      el.style.transform = `translate3d(0,${-pos.current}em,0)`;
    }, duration + 30);
  }, [d, dir, duration]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <span className="fd-an-d">
      <span className="fd-an-ghost">0</span>
      <span className="fd-an-strip" ref={strip} style={{ transform: `translate3d(0,${-(10 + d)}em,0)` }}>
        {STRIP.map((n, i) => (
          <span key={i} className="fd-an-n">{n}</span>
        ))}
      </span>
    </span>
  );
}

export interface AnimatedNumberProps {
  value: number;
  locale?: string;
  format?: Intl.NumberFormatOptions;
  duration?: number;
  flash?: boolean;
  signColor?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function AnimatedNumber({ value, locale = "en-US", format, duration = 700, flash = true, signColor = false, className, style }: AnimatedNumberProps) {
  const fmt = useMemo(() => new Intl.NumberFormat(locale, format), [locale, JSON.stringify(format)]); // eslint-disable-line react-hooks/exhaustive-deps
  const text = fmt.format(value);
  // derive direction during render so digits know it on the same commit
  const [prev, setPrev] = useState(value);
  const [dir, setDir] = useState(0);
  const [tick, setTick] = useState(0);
  if (value !== prev) {
    setPrev(value);
    setDir(value > prev ? 1 : -1);
    setTick((t) => t + 1);
  }

  // key characters from the right so columns persist when the length changes
  const chars = Array.from(text);
  const n = chars.length;
  return (
    <span
      className={`fd-an${className ? " " + className : ""}`}
      style={{ ["--fd-an-dur" as string]: `${duration}ms`, ...style }}
      data-dir={dir > 0 ? "up" : dir < 0 ? "down" : undefined}
      data-sign={signColor ? (value > 0 ? "pos" : value < 0 ? "neg" : "zero") : undefined}
    >
      <style>{css}</style>
      <span className="fd-an-sr">{text}</span>
      <span className="fd-an-row" aria-hidden="true" data-flash={flash && tick > 0 ? (tick % 2 ? "a" : "b") : undefined}>
        {chars.map((ch, i) => {
          const k = n - i;
          return /\d/.test(ch) ? (
            <Digit key={`d${k}`} d={Number(ch)} dir={dir} duration={duration} />
          ) : (
            <span key={`s${k}-${ch}`} className="fd-an-s">{ch}</span>
          );
        })}
      </span>
    </span>
  );
}

const css = `
.fd-an,.fd-an *{box-sizing:border-box}
.fd-an{--fd-an-up:#16A34A;--fd-an-down:#DC2626;display:inline-block;margin:0;padding:0;font-variant-numeric:tabular-nums;font-feature-settings:"tnum";white-space:nowrap;vertical-align:baseline}
.fd-an-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.fd-an-row{display:inline-flex;margin:0;padding:0;line-height:1;color:inherit}
.fd-an[data-sign="pos"] .fd-an-row{color:var(--fd-an-up)}
.fd-an[data-sign="neg"] .fd-an-row{color:var(--fd-an-down)}
.fd-an[data-dir="up"] .fd-an-row[data-flash="a"]{animation:fd-an-up-a calc(var(--fd-an-dur) + 500ms) cubic-bezier(.22,1,.36,1)}
.fd-an[data-dir="up"] .fd-an-row[data-flash="b"]{animation:fd-an-up-b calc(var(--fd-an-dur) + 500ms) cubic-bezier(.22,1,.36,1)}
.fd-an[data-dir="down"] .fd-an-row[data-flash="a"]{animation:fd-an-down-a calc(var(--fd-an-dur) + 500ms) cubic-bezier(.22,1,.36,1)}
.fd-an[data-dir="down"] .fd-an-row[data-flash="b"]{animation:fd-an-down-b calc(var(--fd-an-dur) + 500ms) cubic-bezier(.22,1,.36,1)}
@keyframes fd-an-up-a{0%,30%{color:var(--fd-an-up)}}
@keyframes fd-an-up-b{0%,30%{color:var(--fd-an-up)}}
@keyframes fd-an-down-a{0%,30%{color:var(--fd-an-down)}}
@keyframes fd-an-down-b{0%,30%{color:var(--fd-an-down)}}
.fd-an-d{position:relative;display:inline-block;margin:0;padding:0;height:1em;overflow:hidden;
  -webkit-mask-image:linear-gradient(transparent 0,#000 18%,#000 82%,transparent 100%);mask-image:linear-gradient(transparent 0,#000 18%,#000 82%,transparent 100%)}
.fd-an-ghost{visibility:hidden;display:inline-block;margin:0;padding:0}
.fd-an-strip{position:absolute;left:0;right:0;top:0;display:flex;flex-direction:column;margin:0;padding:0;will-change:transform}
.fd-an-n{display:block;height:1em;margin:0;padding:0;text-align:center}
.fd-an-s{display:inline-block;margin:0;padding:0;white-space:pre}
@media (prefers-reduced-motion:reduce){
  .fd-an[data-dir] .fd-an-row[data-flash]{animation-duration:120ms}
  .fd-an-d{-webkit-mask-image:none;mask-image:none}
}
`;

/* ───────────────────────────── demo ───────────────────────────── */

type Asset = { sym: string; name: string; price: number; open: number; hold: number; color: string; vol: number };

const START: Asset[] = [
  { sym: "BTC", name: "Bitcoin", price: 98412.55, open: 96870.1, hold: 0.4182, color: "#F7931A", vol: 0.0016 },
  { sym: "ETH", name: "Ether", price: 3641.28, open: 3702.9, hold: 6.25, color: "#8C8CF6", vol: 0.0022 },
  { sym: "SOL", name: "Solana", price: 212.47, open: 205.12, hold: 84, color: "#2DD4BF", vol: 0.0035 },
  { sym: "LINK", name: "Chainlink", price: 24.083, open: 24.51, hold: 640, color: "#3B82F6", vol: 0.004 },
  { sym: "EURC", name: "Euro Coin", price: 1.0842, open: 1.0839, hold: 12500, color: "#A3E635", vol: 0.0002 },
];

export function Demo() {
  const [assets, setAssets] = useState(START);
  const [live, setLive] = useState(true);
  const [ccy, setCcy] = useState<"USD" | "EUR">("USD");
  const fx = ccy === "USD" ? 1 : 0.9223;

  useEffect(() => {
    if (!live) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setAssets((as) =>
        as.map((a, i) => {
          if (rnd() < -0.2 && i !== 0) return a; // not every asset ticks every time
          const p = a.price * (1 + rnd() * a.vol * 2.2);
          const dp = a.price > 1000 ? 2 : a.price > 10 ? 2 : 4;
          return { ...a, price: Number(p.toFixed(dp)) };
        }),
      );
    }, 1700);
    return () => window.clearInterval(id);
  }, [live]);

  const total = assets.reduce((s, a) => s + a.price * a.hold, 0) * fx;
  const opened = assets.reduce((s, a) => s + a.open * a.hold, 0) * fx;
  const pnl = total - opened;
  const money = (max: number): Intl.NumberFormatOptions => ({ style: "currency", currency: ccy, minimumFractionDigits: 2, maximumFractionDigits: max });

  return (
    <div className="fd-an-demo">
      <style>{demoCss}</style>
      <div className="fd-an-demo-card">
        <header className="fd-an-demo-head">
          <span className="fd-an-demo-brand">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="6" fill="#0E1116" /><path d="M7 15l3.2-4 2.6 2.4L17 8" fill="none" stroke="#5EEAD4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Ledgerline
          </span>
          <div className="fd-an-demo-tools">
            <div className="fd-an-demo-seg" role="radiogroup" aria-label="Display currency">
              {(["USD", "EUR"] as const).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={ccy === c} onClick={() => setCcy(c)}>{c}</button>
              ))}
            </div>
            <button type="button" className="fd-an-demo-live" aria-pressed={live} onClick={() => setLive((l) => !l)}>
              <span aria-hidden="true" data-on={live ? "" : undefined} />
              {live ? "Live" : "Paused"}
            </button>
          </div>
        </header>

        <section className="fd-an-demo-total" aria-label="Portfolio value">
          <p className="fd-an-demo-k">Portfolio value</p>
          <AnimatedNumber value={total} format={money(2)} locale={ccy === "USD" ? "en-US" : "de-DE"} className="fd-an-demo-big" duration={900} />
          <p className="fd-an-demo-pnl">
            <AnimatedNumber value={pnl} format={{ ...money(2), signDisplay: "always" }} locale={ccy === "USD" ? "en-US" : "de-DE"} signColor flash={false} />
            <span className="fd-an-demo-dot" aria-hidden="true">·</span>
            <AnimatedNumber value={pnl / opened} format={{ style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "always" }} signColor flash={false} />
            <span className="fd-an-demo-today">today</span>
          </p>
        </section>

        <table className="fd-an-demo-table">
          <caption className="fd-an-sr">Holdings, prices update every two seconds</caption>
          <thead>
            <tr><th scope="col">Asset</th><th scope="col">Price</th><th scope="col">24h</th><th scope="col">Holding</th></tr>
          </thead>
          <tbody>
            {assets.map((a) => {
              const ch = (a.price - a.open) / a.open;
              const p = a.price * fx;
              const frac = a.price < 10 ? 4 : a.price < 100 ? 3 : 2;
              return (
                <tr key={a.sym}>
                  <th scope="row">
                    <span className="fd-an-demo-coin" style={{ background: a.color }} aria-hidden="true">{a.sym[0]}</span>
                    <span className="fd-an-demo-sym">{a.sym}<small>{a.name}</small></span>
                  </th>
                  <td><AnimatedNumber value={p} format={{ ...money(frac), minimumFractionDigits: frac }} locale={ccy === "USD" ? "en-US" : "de-DE"} /></td>
                  <td><AnimatedNumber value={ch} format={{ style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "always" }} signColor flash={false} className="fd-an-demo-chg" /></td>
                  <td><AnimatedNumber value={p * a.hold} format={money(2)} locale={ccy === "USD" ? "en-US" : "de-DE"} flash={false} className="fd-an-demo-hold" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="fd-an-demo-foot">Prices are indicative mid-market quotes. Not investment advice.</p>
      </div>
    </div>
  );
}

const demoCss = `
.fd-an-demo,.fd-an-demo *,.fd-an-demo *::before,.fd-an-demo *::after{box-sizing:border-box}
.fd-an-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:"SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;
  --d-ink:#ECEFF3;--d-mut:#8A93A0;--d-line:rgba(236,239,243,.08);
  display:grid;place-items:center;margin:0;padding:clamp(16px,4vw,48px) clamp(16px,4vw,48px);min-height:100vh;
  background:radial-gradient(80% 60% at 50% 0%,#14202A 0%,#080A0D 70%);color:var(--d-ink);font:400 15px/1.5 var(--d-font);-webkit-font-smoothing:antialiased}
.fd-an-demo .fd-an{--fd-an-up:#34D399;--fd-an-down:#F87171}
.fd-an-demo .fd-an-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.fd-an-demo-card{width:100%;max-width:820px;margin:0;padding:clamp(18px,3vw,32px);border-radius:28px;background:rgba(16,20,26,.85);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),inset 0 0 0 1px rgba(255,255,255,.05),0 40px 80px -40px rgba(0,0,0,.8)}
.fd-an-demo-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0}
.fd-an-demo-brand{display:inline-flex;align-items:center;gap:10px;margin:0;font:600 17px/1 var(--d-disp);letter-spacing:-.01em}
.fd-an-demo-brand svg{display:block}
.fd-an-demo-tools{display:flex;gap:8px;margin:0}
.fd-an-demo-seg{display:inline-flex;margin:0;padding:3px;border-radius:9999px;background:rgba(255,255,255,.06)}
.fd-an-demo-seg button,.fd-an-demo-live{appearance:none;-webkit-appearance:none;margin:0;height:30px;padding:0 12px;border:0;border-radius:9999px;background:transparent;color:var(--d-mut);
  font:500 13px/1 var(--d-font);cursor:pointer;transition:background-color 240ms cubic-bezier(.65,0,.35,1),color 240ms}
.fd-an-demo-seg button[aria-checked="true"]{background:rgba(255,255,255,.12);color:var(--d-ink)}
.fd-an-demo-live{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px;background:rgba(255,255,255,.06)}
.fd-an-demo-live span{display:block;width:7px;height:7px;border-radius:50%;background:var(--d-mut)}
.fd-an-demo-live span[data-on]{background:#34D399;box-shadow:0 0 0 3px rgba(52,211,153,.2)}
.fd-an-demo button:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
.fd-an-demo-total{margin:clamp(24px,4vh,40px) 0 0}
.fd-an-demo-k{margin:0 0 10px;color:var(--d-mut);font:500 13px/1 var(--d-font)}
.fd-an-demo-big{color:var(--d-ink);font:600 clamp(40px,7vw,72px)/1 var(--d-disp);letter-spacing:-.04em}
.fd-an-demo-pnl{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;margin:14px 0 0;font:500 15px/1.2 var(--d-font)}
.fd-an-demo-dot,.fd-an-demo-today{color:var(--d-mut)}
.fd-an-demo-table{width:100%;margin:clamp(24px,4vh,40px) 0 0;border-collapse:collapse;border:0;font:400 15px/1.2 var(--d-font)}
.fd-an-demo-table thead th{margin:0;padding:0 0 10px;border:0;border-bottom:1px solid var(--d-line);color:var(--d-mut);font:500 12px/1 var(--d-font);text-transform:uppercase;letter-spacing:.06em;text-align:right}
.fd-an-demo-table thead th:first-child{text-align:left}
.fd-an-demo-table tbody th,.fd-an-demo-table td{margin:0;padding:14px 0;border:0;border-bottom:1px solid var(--d-line);text-align:right;font:500 15px/1.2 var(--d-font);color:var(--d-ink)}
.fd-an-demo-table tbody tr:last-child th,.fd-an-demo-table tbody tr:last-child td{border-bottom:0}
.fd-an-demo-table tbody th{display:flex;align-items:center;gap:12px;text-align:left}
.fd-an-demo-coin{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:50%;color:#0B0D10;font:700 13px/1 var(--d-font)}
.fd-an-demo-sym{display:flex;flex-direction:column;gap:3px;margin:0;font:600 15px/1 var(--d-font)}
.fd-an-demo-sym small{color:var(--d-mut);font:400 13px/1 var(--d-font)}
.fd-an-demo-chg{font-size:13px}
.fd-an-demo-hold{color:var(--d-mut)}
.fd-an-demo-foot{margin:18px 0 0;color:rgba(138,147,160,.8);font:400 12px/1.4 var(--d-font)}
@media (max-width:560px){.fd-an-demo-table thead th:nth-child(4),.fd-an-demo-table td:nth-child(4){display:none}}
`;
