/**
 * HeroDataTicker: a newsroom hero for an energy-market publication where the
 * hero is the data. A giant live number rolls digit by digit as it updates,
 * the headline quotes it, a 24-hour SVG chart can be scrubbed with the
 * pointer or arrow keys, a generation-mix table shifts with each refresh and
 * a price ticker band runs along the bottom.
 *
 * Props: title (masthead), dateline, kicker, series (24 h of renewable share,
 * percent), mix (source, GW, renewable), quotes (ticker), refreshMs, byline.
 * CSS vars: --fd-tkr-paper, --fd-tkr-ink, --fd-tkr-red.
 *
 * Browser support: all evergreen browsers.
 * Motion: a timer nudges the demo data (seeded, deterministic) every
 * refreshMs, paused in hidden tabs and off-screen; digits roll with
 * --fd-ease-out; the ticker band scrolls with a CSS animation and pauses on
 * hover or focus. prefers-reduced-motion: no live updates, no rolling, and
 * the ticker becomes a static, horizontally scrollable row.
 * Accessibility: the number is announced via an aria-live="polite" summary
 * at most once per refresh; the chart is a focusable figure with an
 * aria-label and arrow-key scrubbing; the ticker duplicate is aria-hidden.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

export interface TickerQuote {
  sym: string;
  price: number;
  unit: string;
  change: number;
}

export interface MixRow {
  source: string;
  gw: number;
  renewable: boolean;
}

export interface HeroDataTickerProps {
  title?: string;
  dateline?: string;
  kicker?: string;
  series?: number[];
  mix?: MixRow[];
  quotes?: TickerQuote[];
  refreshMs?: number;
  byline?: ReactNode;
  price?: number;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 96 quarter hours, 14:45 yesterday to 14:30 today. Wind builds overnight, solar adds a midday bump.
function makeSeries(): number[] {
  const r = mulberry32(1412);
  const out: number[] = [];
  let wind = 34;
  for (let i = 0; i < 96; i++) {
    const hour = (14.75 + i * 0.25) % 24;
    wind += (r() - 0.46) * 1.6;
    wind = Math.max(22, Math.min(52, wind));
    const solar = hour > 7 && hour < 17 ? Math.sin(((hour - 7) / 10) * Math.PI) * 16 : 0;
    const base = 9 + (hour > 0 && hour < 5 ? 2 : 0);
    out.push(Math.round((wind + solar + base) * 10) / 10);
  }
  out[94] = 71.0;
  out[95] = 71.4;
  return out;
}

const DEFAULT_MIX: MixRow[] = [
  { source: "Wind onshore", gw: 31.2, renewable: true },
  { source: "Wind offshore", gw: 6.9, renewable: true },
  { source: "Biomass", gw: 4.4, renewable: true },
  { source: "Solar", gw: 4.1, renewable: true },
  { source: "Gas", gw: 6.8, renewable: false },
  { source: "Lignite", gw: 5.9, renewable: false },
  { source: "Hard coal", gw: 2.1, renewable: false },
];

const DEFAULT_QUOTES: TickerQuote[] = [
  { sym: "DE-LU base", price: 84.12, unit: "€/MWh", change: -3.2 },
  { sym: "FR base", price: 61.4, unit: "€/MWh", change: 1.1 },
  { sym: "NL base", price: 86.03, unit: "€/MWh", change: -2.4 },
  { sym: "PL base", price: 112.7, unit: "€/MWh", change: 0.6 },
  { sym: "ES base", price: 42.18, unit: "€/MWh", change: -7.9 },
  { sym: "NO2", price: 38.9, unit: "€/MWh", change: 4.3 },
  { sym: "EUA Dec-26", price: 71.34, unit: "€/t", change: -0.8 },
  { sym: "TTF front", price: 31.2, unit: "€/MWh", change: 0.4 },
  { sym: "Cal-27 DE", price: 88.5, unit: "€/MWh", change: -0.3 },
];

const HOURS = ["15:00", "19:00", "23:00", "03:00", "07:00", "11:00", "14:30"];

function quarterLabel(i: number) {
  const mins = (14 * 60 + 45 + i * 15) % (24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

function Roll({ value, className }: { value: string; className?: string }) {
  return (
    <span className={`fd-tkr-roll ${className ?? ""}`} aria-hidden="true">
      {Array.from(value).map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className="fd-tkr-digit">
            <span className="fd-tkr-strip" style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>
              {"0123456789".split("").map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} className="fd-tkr-sym">{ch}</span>
        ),
      )}
    </span>
  );
}

export function HeroDataTicker({
  title = "The Baseload",
  dateline = "Monday 2 November 2026",
  kicker = "Live, German grid",
  series: seriesProp,
  mix: mixProp = DEFAULT_MIX,
  quotes: quotesProp = DEFAULT_QUOTES,
  refreshMs = 2600,
  byline = (
    <>
      By <b>Marta Kühn</b>, energy desk. Data refreshed every 15 minutes from grid operator feeds.
    </>
  ),
  price: priceProp = 84.12,
}: HeroDataTickerProps) {
  const initialSeries = useMemo(() => seriesProp ?? makeSeries(), [seriesProp]);
  const [series, setSeries] = useState(initialSeries);
  const [mix, setMix] = useState(mixProp);
  const [quotes, setQuotes] = useState(quotesProp);
  const [price, setPrice] = useState(priceProp);
  const [stamp, setStamp] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [reduce, setReduce] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const now = series[series.length - 1];
  const prev = series[series.length - 2];
  const delta = now - prev;

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduce(rm);
    if (rm) return;
    const rand = mulberry32(77);
    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    if (rootRef.current) io.observe(rootRef.current);
    const id = window.setInterval(() => {
      if (!visible || document.hidden) return;
      const step = (rand() - 0.45) * 1.1;
      setSeries((s) => {
        const next = Math.round(Math.max(40, Math.min(92, s[s.length - 1] + step)) * 10) / 10;
        return [...s.slice(1), next];
      });
      setMix((m) =>
        m.map((row) => ({
          ...row,
          gw: Math.max(0.4, Math.round((row.gw + (rand() - 0.5) * (row.renewable ? 0.8 : 0.3)) * 10) / 10),
        })),
      );
      setQuotes((q) =>
        q.map((x) => {
          const d = (rand() - 0.5) * 0.012 * x.price;
          const p = Math.round((x.price + d) * 100) / 100;
          return { ...x, price: p, change: Math.round((x.change + (d / x.price) * 100) * 10) / 10 };
        }),
      );
      setPrice((p) => Math.round(Math.max(20, p - step * 0.9) * 100) / 100);
      setStamp((t) => t + 1);
    }, refreshMs);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, [refreshMs]);

  // chart geometry (viewBox 0 0 600 240, y 0..100%)
  const W = 600;
  const H = 240;
  const pts = series.map((v, i) => [(i / (series.length - 1)) * W, H - (v / 100) * H] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const area = `${line}L${W},${H}L0,${H}Z`;
  const hi = hover ?? series.length - 1;
  const hv = series[hi];
  const maxGw = Math.max(...mix.map((m) => m.gw));
  const renewGw = mix.filter((m) => m.renewable).reduce((a, b) => a + b.gw, 0);
  const totalGw = mix.reduce((a, b) => a + b.gw, 0);
  const minute = 32 + Math.floor(stamp / 6);
  const timeLabel = `14:${String(Math.min(59, minute)).padStart(2, "0")} CET`;

  const scrubAt = (clientX: number) => {
    const el = chartRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setHover(Math.round(f * (series.length - 1)));
  };
  const onChartKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const dir = e.key === "ArrowLeft" ? -1 : 1;
      setHover((h) => Math.min(series.length - 1, Math.max(0, (h ?? series.length - 1) + dir * (e.shiftKey ? 8 : 1))));
    } else if (e.key === "Escape") setHover(null);
  };

  const fmtQ = (q: TickerQuote) => q.price.toFixed(2);
  const tickerItems = (hidden: boolean) =>
    quotes.map((q) => (
      <li key={q.sym + (hidden ? "-d" : "")} className="fd-tkr-q" aria-hidden={hidden || undefined}>
        <span className="fd-tkr-q-sym">{q.sym}</span>
        <span className="fd-tkr-q-p">{fmtQ(q)}</span>
        <span className="fd-tkr-q-u">{q.unit}</span>
        <span className={`fd-tkr-q-c ${q.change < 0 ? "is-dn" : "is-up"}`}>
          {q.change < 0 ? "▼" : "▲"} {Math.abs(q.change).toFixed(1)}%
        </span>
      </li>
    ));

  return (
    <section ref={rootRef} className={`fd-tkr${reduce ? " is-still" : ""}`} aria-label={`${title}, live grid data`}>
      <style>{css}</style>

      <header className="fd-tkr-mast">
        <p className="fd-tkr-date">{dateline}<span>Edition 1,412</span></p>
        <a className="fd-tkr-title" href="#top">{title}</a>
        <div className="fd-tkr-acts">
          <a className="fd-tkr-sign" href="#signin">Sign in</a>
          <a className="fd-tkr-sub" href="#subscribe">Subscribe, €9 a month</a>
        </div>
      </header>
      <nav className="fd-tkr-nav" aria-label="Sections">
        {["Grid", "Markets", "Policy", "Storage", "Data desk", "The Weekly"].map((s, i) => (
          <a key={s} href={`#${s.toLowerCase().replace(/\s/g, "-")}`} className={`fd-tkr-sec${i === 0 ? " is-on" : ""}`} aria-current={i === 0 ? "page" : undefined}>
            {s}
          </a>
        ))}
      </nav>

      <div className="fd-tkr-main">
        <div className="fd-tkr-story">
          <p className="fd-tkr-kicker">
            <span className="fd-tkr-live" aria-hidden="true" />
            {kicker}
            <span className="fd-tkr-time">{timeLabel}</span>
          </p>
          <p className="fd-tkr-big">
            <Roll value={now.toFixed(1)} />
            <span className="fd-tkr-pct" aria-hidden="true">%</span>
            <span className={`fd-tkr-delta ${delta < 0 ? "is-dn" : "is-up"}`} aria-hidden="true">
              {delta < 0 ? "▼" : "▲"} {Math.abs(delta).toFixed(1)} pts
              <small>vs 15 min ago</small>
            </span>
          </p>
          <span className="fd-tkr-sr" aria-live="polite">
            Renewable share {now.toFixed(1)} percent, {delta < 0 ? "down" : "up"} {Math.abs(delta).toFixed(1)} points.
          </span>
          <h1 className="fd-tkr-head">
            Germany is running on <mark className="fd-tkr-mark">{now.toFixed(1)}%</mark> renewable power. Day-ahead prices slide to €{price.toFixed(2)} as the wind holds.
          </h1>
          <dl className="fd-tkr-stats">
            <div className="fd-tkr-stat"><dt>Wind output</dt><dd><b>{(mix[0].gw + mix[1].gw).toFixed(1)}</b> GW</dd></div>
            <div className="fd-tkr-stat"><dt>Day-ahead</dt><dd><b>{price.toFixed(2)}</b> €/MWh</dd></div>
            <div className="fd-tkr-stat"><dt>Carbon intensity</dt><dd><b>{Math.round(560 - now * 4.9)}</b> g/kWh</dd></div>
          </dl>
          <p className="fd-tkr-by">{byline}</p>
        </div>

        <aside className="fd-tkr-panel" aria-label="Grid data">
          <div className="fd-tkr-panel-h">
            <p className="fd-tkr-panel-t">Renewable share, last 24 hours</p>
            <p className="fd-tkr-read">
              <span>{quarterLabel(hi)}</span>
              <b>{hv.toFixed(1)}%</b>
            </p>
          </div>
          <div
            ref={chartRef}
            className="fd-tkr-chart"
            role="img"
            tabIndex={0}
            aria-label={`Line chart of renewable share over 24 hours, from ${series[0].toFixed(1)}% to ${now.toFixed(1)}%. Use arrow keys to read values.`}
            onPointerMove={(e) => scrubAt(e.clientX)}
            onPointerDown={(e) => scrubAt(e.clientX)}
            onPointerLeave={() => setHover(null)}
            onKeyDown={onChartKey}
            onBlur={() => setHover(null)}
          >
            <span className="fd-tkr-y fd-tkr-y-75">75</span>
            <span className="fd-tkr-y fd-tkr-y-50">50</span>
            <span className="fd-tkr-y fd-tkr-y-25">25</span>
            <svg className="fd-tkr-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
              {[0.25, 0.5, 0.75].map((g) => (
                <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} className={g === 0.5 ? "fd-tkr-grid fd-tkr-grid-50" : "fd-tkr-grid"} vectorEffect="non-scaling-stroke" />
              ))}
              <path d={area} className="fd-tkr-area" />
              <path d={line} className="fd-tkr-line" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="fd-tkr-cross" style={{ left: `${(hi / (series.length - 1)) * 100}%`, opacity: hover === null ? 0 : 1 }} aria-hidden="true" />
            <span className="fd-tkr-dot" style={{ left: `${(hi / (series.length - 1)) * 100}%`, top: `${100 - hv}%` }} aria-hidden="true" />
          </div>
          <div className="fd-tkr-x" aria-hidden="true">
            {HOURS.map((h) => <span key={h}>{h}</span>)}
          </div>

          <p className="fd-tkr-cap" id="fd-tkr-mixcap">
            Generation now <span>{renewGw.toFixed(1)} of {totalGw.toFixed(1)} GW clean</span>
          </p>
          <table className="fd-tkr-mix" aria-labelledby="fd-tkr-mixcap">
            <tbody>
              {mix.map((m) => (
                <tr key={m.source} className={m.renewable ? "is-re" : "is-fo"}>
                  <th scope="row">{m.source}</th>
                  <td className="fd-tkr-barcell">
                    <span className="fd-tkr-bar" style={{ transform: `scaleX(${(m.gw / maxGw).toFixed(3)})` }} />
                  </td>
                  <td className="fd-tkr-gw">{m.gw.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </aside>
      </div>

      <div className="fd-tkr-band" tabIndex={0} aria-label="Market prices">
        <span className="fd-tkr-band-l">Markets<br />14:30</span>
        <div className="fd-tkr-track">
          <ul className="fd-tkr-run">
            {tickerItems(false)}
            {tickerItems(true)}
          </ul>
        </div>
      </div>
    </section>
  );
}

const css = `
.fd-tkr, .fd-tkr *, .fd-tkr *::before, .fd-tkr *::after { box-sizing: border-box; }
.fd-tkr :where(h1, p, a, ul, li, dl, dt, dd, b, small, span, div, nav, header, aside, mark, table, tbody, tr, th, td, svg) {
  margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit;
  letter-spacing: inherit; text-decoration: none; list-style: none; text-align: inherit; border-spacing: 0;
}
.fd-tkr {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-tkr-paper: #F2EEE4;
  --fd-tkr-ink: #141311;
  --fd-tkr-grey: #6E6A61;
  --fd-tkr-rule: rgba(20,19,17,0.22);
  --fd-tkr-red: #C4161C;
  --fd-tkr-green: #1E6B3A;
  --fd-tkr-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --fd-tkr-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  --fd-tkr-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
  position: relative; display: flex; flex-direction: column; min-height: 880px; margin: 0; padding: 0; overflow: hidden;
  background: var(--fd-tkr-paper); color: var(--fd-tkr-ink); font: 400 15px/1.45 var(--fd-tkr-sans);
}

/* masthead */
.fd-tkr-mast { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 24px; padding: 20px 40px 14px; }
.fd-tkr-date { display: flex; flex-direction: column; gap: 3px; font: 400 12px/1.2 var(--fd-tkr-mono); }
.fd-tkr-date span { color: var(--fd-tkr-grey); }
.fd-tkr-title { font: 700 clamp(2rem, 3.4vw, 3rem)/1 var(--fd-tkr-serif); letter-spacing: -0.03em; color: var(--fd-tkr-ink); white-space: nowrap; }
.fd-tkr-acts { justify-self: end; display: flex; align-items: center; gap: 18px; }
.fd-tkr-sign { font: 500 14px/1 var(--fd-tkr-sans); }
.fd-tkr-sign:hover { text-decoration: underline; text-underline-offset: 3px; }
.fd-tkr-sub { font: 600 13px/1 var(--fd-tkr-sans); padding: 10px 14px; background: var(--fd-tkr-red); color: #FFF; border-radius: 2px; transition: background var(--fd-dur-1), transform var(--fd-dur-2) var(--fd-spring); }
.fd-tkr-sub:hover { background: #A51217; }
.fd-tkr-sub:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-tkr-nav { display: flex; justify-content: center; gap: 28px; margin: 0 40px; padding: 10px 0; border-top: 3px double var(--fd-tkr-ink); border-bottom: 1px solid var(--fd-tkr-ink); overflow-x: auto; scrollbar-width: none; }
.fd-tkr-sec { position: relative; font: 600 12px/1.2 var(--fd-tkr-sans); letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; padding: 2px 0; }
.fd-tkr-sec.is-on { color: var(--fd-tkr-red); }
.fd-tkr-sec:hover { text-decoration: underline; text-underline-offset: 4px; }

/* main */
.fd-tkr-main { flex: 1; display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 0; margin: 0 40px; }
.fd-tkr-story { padding: 30px 40px 28px 0; border-right: 1px solid var(--fd-tkr-rule); display: flex; flex-direction: column; justify-content: center; }
.fd-tkr-kicker { display: flex; align-items: center; gap: 10px; font: 700 12px/1 var(--fd-tkr-sans); letter-spacing: 0.1em; text-transform: uppercase; color: var(--fd-tkr-red); }
.fd-tkr-live { position: relative; display: block; width: 9px; height: 9px; border-radius: 50%; background: var(--fd-tkr-red); }
.fd-tkr-live::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 1.5px solid var(--fd-tkr-red); animation: fd-tkr-ping 1.8s var(--fd-ease-out) infinite; }
@keyframes fd-tkr-ping { from { transform: scale(0.5); opacity: 1; } to { transform: scale(1.8); opacity: 0; } }
.fd-tkr-time { font: 400 12px/1 var(--fd-tkr-mono); letter-spacing: 0; color: var(--fd-tkr-grey); text-transform: none; padding-left: 10px; border-left: 1px solid var(--fd-tkr-rule); }

.fd-tkr-big { display: flex; align-items: flex-start; gap: 6px; margin: 14px 0 4px; font: 400 clamp(6rem, 16vw, 15.5rem)/0.9 var(--fd-tkr-serif); letter-spacing: -0.045em; font-variant-numeric: tabular-nums lining-nums; color: var(--fd-tkr-ink); }
.fd-tkr-roll { display: inline-flex; }
.fd-tkr-digit { display: inline-block; height: 0.9em; overflow: hidden; }
.fd-tkr-strip { display: flex; flex-direction: column; transition: transform var(--fd-dur-4) var(--fd-ease-out); }
.fd-tkr-strip span { display: block; height: 0.9em; line-height: 0.9; }
.fd-tkr-sym { display: inline-block; }
.fd-tkr-pct { font-size: 0.42em; line-height: 1; margin-top: 0.12em; color: var(--fd-tkr-red); }
.fd-tkr-delta { align-self: flex-end; display: flex; flex-direction: column; gap: 4px; margin: 0 0 0.25em 18px; font: 600 15px/1 var(--fd-tkr-mono); letter-spacing: 0; white-space: nowrap; }
.fd-tkr-delta small { font: 400 11px/1 var(--fd-tkr-mono); color: var(--fd-tkr-grey); }
.fd-tkr-delta.is-up { color: var(--fd-tkr-green); }
.fd-tkr-delta.is-dn { color: var(--fd-tkr-red); }
.fd-tkr-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.fd-tkr-head { margin-top: 18px; max-width: 26ch; font: 400 clamp(1.75rem, 3vw, 2.75rem)/1.06 var(--fd-tkr-serif); letter-spacing: -0.02em; color: var(--fd-tkr-ink); }
.fd-tkr-mark { background: linear-gradient(transparent 62%, rgba(196,22,28,0.22) 62%); color: inherit; padding: 0 2px; font-variant-numeric: tabular-nums; }
.fd-tkr-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 24px; border-top: 1px solid var(--fd-tkr-ink); border-bottom: 1px solid var(--fd-tkr-rule); }
.fd-tkr-stat { padding: 10px 14px 12px 0; }
.fd-tkr-stat + .fd-tkr-stat { padding-left: 14px; border-left: 1px solid var(--fd-tkr-rule); }
.fd-tkr-stat dt { font: 400 11px/1.2 var(--fd-tkr-mono); color: var(--fd-tkr-grey); margin-bottom: 6px; }
.fd-tkr-stat dd { font: 400 12px/1 var(--fd-tkr-mono); color: var(--fd-tkr-grey); white-space: nowrap; }
.fd-tkr-stat b { font: 400 26px/1 var(--fd-tkr-serif); letter-spacing: -0.02em; color: var(--fd-tkr-ink); font-variant-numeric: tabular-nums; margin-right: 2px; }
.fd-tkr-by { margin-top: 14px; max-width: 56ch; font: 400 13px/1.45 var(--fd-tkr-sans); color: var(--fd-tkr-grey); }
.fd-tkr-by b { font-weight: 600; color: var(--fd-tkr-ink); }

/* panel */
.fd-tkr-panel { padding: 26px 0 24px 36px; display: flex; flex-direction: column; justify-content: center; }
.fd-tkr-panel-h { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 12px; }
.fd-tkr-panel-t { font: 700 12px/1.2 var(--fd-tkr-sans); letter-spacing: 0.08em; text-transform: uppercase; }
.fd-tkr-read { display: flex; gap: 8px; align-items: baseline; font: 400 12px/1 var(--fd-tkr-mono); color: var(--fd-tkr-grey); font-variant-numeric: tabular-nums; }
.fd-tkr-read b { font: 700 15px/1 var(--fd-tkr-mono); color: var(--fd-tkr-ink); }
.fd-tkr-chart { position: relative; height: 210px; border-bottom: 1px solid var(--fd-tkr-ink); cursor: crosshair; touch-action: pan-y; outline: none; }
.fd-tkr-chart:focus-visible { box-shadow: 0 0 0 2px var(--fd-tkr-paper), 0 0 0 4px var(--fd-tkr-ink); }
.fd-tkr-svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; overflow: visible; }
.fd-tkr-grid { stroke: var(--fd-tkr-rule); stroke-width: 1; }
.fd-tkr-grid-50 { stroke: var(--fd-tkr-ink); stroke-dasharray: 2 4; stroke-opacity: 0.5; }
.fd-tkr-area { fill: rgba(20,19,17,0.07); }
.fd-tkr-line { fill: none; stroke: var(--fd-tkr-ink); stroke-width: 1.75; stroke-linejoin: round; }
.fd-tkr-y { position: absolute; right: 0; font: 400 10px/1 var(--fd-tkr-mono); color: var(--fd-tkr-grey); transform: translateY(-120%); }
.fd-tkr-y-75 { top: 25%; } .fd-tkr-y-50 { top: 50%; } .fd-tkr-y-25 { top: 75%; }
.fd-tkr-cross { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--fd-tkr-red); transition: opacity var(--fd-dur-1); pointer-events: none; }
.fd-tkr-dot { position: absolute; width: 11px; height: 11px; margin: -5.5px 0 0 -5.5px; border-radius: 50%; background: var(--fd-tkr-red); box-shadow: 0 0 0 3px var(--fd-tkr-paper); pointer-events: none; transition: top var(--fd-dur-3) var(--fd-ease-out); }
.fd-tkr-x { display: flex; justify-content: space-between; padding-top: 6px; font: 400 10px/1 var(--fd-tkr-mono); color: var(--fd-tkr-grey); }

.fd-tkr-mix { width: 100%; border-collapse: collapse; }
.fd-tkr-cap { margin-top: 22px; display: flex; justify-content: space-between; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--fd-tkr-ink); font: 700 12px/1.2 var(--fd-tkr-sans); letter-spacing: 0.08em; text-transform: uppercase; text-align: left; }
.fd-tkr-cap span { font: 400 12px/1.2 var(--fd-tkr-mono); letter-spacing: 0; text-transform: none; color: var(--fd-tkr-grey); }
.fd-tkr-mix tr { border-bottom: 1px solid var(--fd-tkr-rule); }
.fd-tkr-mix th { width: 34%; padding: 6px 0; font: 400 13px/1.2 var(--fd-tkr-sans); text-align: left; white-space: nowrap; }
.fd-tkr-barcell { padding: 0 12px; vertical-align: middle; }
.fd-tkr-bar { display: block; height: 8px; width: 100%; transform-origin: left; background: var(--fd-tkr-ink); transition: transform var(--fd-dur-4) var(--fd-ease-out); }
.fd-tkr-mix .is-fo .fd-tkr-bar { background: repeating-linear-gradient(135deg, var(--fd-tkr-grey) 0 1.5px, transparent 1.5px 4px); box-shadow: inset 0 0 0 1px var(--fd-tkr-grey); }
.fd-tkr-mix .is-fo th { color: var(--fd-tkr-grey); }
.fd-tkr-gw { width: 48px; text-align: right; font: 400 13px/1.2 var(--fd-tkr-mono); font-variant-numeric: tabular-nums; }

/* ticker band */
.fd-tkr-band { display: flex; align-items: stretch; background: var(--fd-tkr-ink); color: var(--fd-tkr-paper); outline: none; }
.fd-tkr-band:focus-visible { box-shadow: inset 0 0 0 2px var(--fd-tkr-red); }
.fd-tkr-band-l { flex: none; display: flex; flex-direction: column; justify-content: center; padding: 0 18px 0 40px; background: var(--fd-tkr-red); color: #FFF; font: 700 11px/1.25 var(--fd-tkr-mono); letter-spacing: 0.06em; text-transform: uppercase; }
.fd-tkr-track { position: relative; flex: 1; overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 40px, #000 calc(100% - 40px), transparent); mask-image: linear-gradient(90deg, transparent, #000 40px, #000 calc(100% - 40px), transparent); }
.fd-tkr-run { display: flex; width: max-content; animation: fd-tkr-run 48s linear infinite; }
.fd-tkr-band:hover .fd-tkr-run, .fd-tkr-band:focus-within .fd-tkr-run { animation-play-state: paused; }
@keyframes fd-tkr-run { to { transform: translateX(-50%); } }
.fd-tkr-q { display: flex; align-items: baseline; gap: 8px; padding: 14px 26px; border-right: 1px solid rgba(242,238,228,0.18); white-space: nowrap; font: 400 13px/1 var(--fd-tkr-mono); font-variant-numeric: tabular-nums; }
.fd-tkr-q-sym { font: 600 12px/1 var(--fd-tkr-sans); letter-spacing: 0.04em; text-transform: uppercase; }
.fd-tkr-q-p { font-weight: 700; }
.fd-tkr-q-u { color: rgba(242,238,228,0.55); font-size: 11px; }
.fd-tkr-q-c.is-up { color: #7FD39A; }
.fd-tkr-q-c.is-dn { color: #FF8A80; }

.fd-tkr a:focus-visible { outline: 2px solid var(--fd-tkr-ink); outline-offset: 3px; }

@media (max-width: 1080px) {
  .fd-tkr-main { grid-template-columns: minmax(0, 1fr); }
  .fd-tkr-story { border-right: 0; border-bottom: 1px solid var(--fd-tkr-rule); padding-right: 0; }
  .fd-tkr-panel { padding-left: 0; }
}
@media (max-width: 760px) {
  .fd-tkr { min-height: 0; }
  .fd-tkr-mast { grid-template-columns: 1fr auto; padding: 16px 16px 12px; gap: 12px; }
  .fd-tkr-date { display: none; }
  .fd-tkr-title { font-size: 1.75rem; }
  .fd-tkr-sign { display: none; }
  .fd-tkr-sub { padding: 9px 12px; }
  .fd-tkr-nav { justify-content: flex-start; gap: 20px; margin: 0 16px; }
  .fd-tkr-main { margin: 0 16px; }
  .fd-tkr-story { padding: 22px 0 22px; }
  .fd-tkr-big { font-size: 7.25rem; margin-top: 12px; }
  .fd-tkr-delta { margin-left: 8px; font-size: 13px; }
  .fd-tkr-head { font-size: 1.625rem; }
  .fd-tkr-stat { padding-right: 8px; }
  .fd-tkr-stat + .fd-tkr-stat { padding-left: 10px; }
  .fd-tkr-stat b { font-size: 20px; }
  .fd-tkr-stat dd { white-space: normal; }
  .fd-tkr-panel { padding: 22px 0 24px; }
  .fd-tkr-chart { height: 170px; }
  .fd-tkr-x span:nth-child(even) { visibility: hidden; }
  .fd-tkr-mix tr:nth-child(n + 6) { display: none; }
  .fd-tkr-band-l { padding: 0 12px 0 16px; }
  .fd-tkr-q { padding: 13px 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-tkr-strip, .fd-tkr-bar, .fd-tkr-dot, .fd-tkr-sub { transition: none; }
  .fd-tkr-live::after { animation: none; opacity: 0; }
  .fd-tkr-run { animation: none; }
  .fd-tkr-track { overflow-x: auto; scrollbar-width: none; }
  .fd-tkr-run .fd-tkr-q[aria-hidden="true"] { display: none; }
}
`;

export function Demo() {
  return <HeroDataTicker />;
}
