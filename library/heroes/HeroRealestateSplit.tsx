/**
 * HeroRealestateSplit, a private-office real-estate hero in a split layout.
 * Left: editorial headline, search and a marquee of recent sales. Right: a
 * topographic coast map drawn in SVG (contours, sea soundings, the coast road,
 * village footprints, small-caps place names, graticule and scale bar) with
 * price pins that drop in and follow the selected listing, over a carousel of
 * photographed residences you can drag with momentum (spring-settled snapping)
 * or step with arrow keys.
 *
 * Props: eyebrow, title, lede, listings ({ name, area, price, beds, baths,
 * sqm, at: [x, y] in map units 0..600 × 0..700, src, alt, tag? }[]),
 * ticker ({ addr, price, delta }[]).
 * CSS vars: --fd-est-paper, --fd-est-ink, --fd-est-accent.
 *
 * Browser support: all evergreen browsers. Pins are placed with container
 * query units so they stay on their village at any panel size. Pointer
 * Events for drag.
 * Motion: drag uses a velocity-tracking spring integrator (k=380, c=30) for
 * the release snap; pins drop with --fd-spring; ticker is a CSS marquee;
 * scroll via rAF + getBoundingClientRect (map parallax, transform only).
 * prefers-reduced-motion: no marquee, instant snaps, static pins.
 * Accessibility: carousel is a region with aria-roledescription, arrow-key
 * navigation and live "n of N" status; prev/next are labelled buttons. The
 * map is decorative; every fact on it is repeated in the cards.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export type Listing = {
  name: string;
  area: string;
  price: string;
  beds: number;
  baths: number;
  sqm: number;
  /** position on the map, in SVG units (viewBox 600 × 700) */
  at: [number, number];
  src: string;
  alt: string;
  view?: string;
  tag?: string;
};
export type Sale = { addr: string; price: string; delta: string };

export interface HeroRealestateSplitProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  listings?: Listing[];
  ticker?: Sale[];
}

const DEFAULT_LISTINGS: Listing[] = [
  { name: "Casa dei Limoni", area: "Positano", view: "Sea view, lemon terrace", price: "€4,250,000", beds: 5, baths: 4, sqm: 412, at: [126, 252], src: "/img/halcyon/pool-lemons-480.webp", alt: "Infinity pool under a lemon pergola looking out over the bay", tag: "New" },
  { name: "Villa Sette Scale", area: "Praiano", view: "Courtyard pool", price: "€2,890,000", beds: 4, baths: 3, sqm: 238, at: [250, 290], src: "/img/halcyon/courtyard-pool-480.webp", alt: "Stone courtyard with a plunge pool, loungers and lemon trees, the sea beyond" },
  { name: "Palazzo Ruggi, piano nobile", area: "Ravello", view: "Vaulted rooms, 330 m up", price: "€1,975,000", beds: 3, baths: 2, sqm: 186, at: [492, 186], src: "/img/halcyon/suite-480.webp", alt: "Pale bedroom with linen drapes opening onto a terrace above the sea", tag: "Under offer" },
  { name: "Torre di Conca", area: "Conca dei Marini", view: "Watchtower, private steps", price: "€3,150,000", beds: 3, baths: 3, sqm: 201, at: [338, 314], src: "/img/halcyon/positano-sunset-480.webp", alt: "Terraced village stepping down a cliff to the sea at sunset" },
];

const DEFAULT_TICKER: Sale[] = [
  { addr: "Via Pasitea, Positano", price: "€6.4M", delta: "+3.1%" },
  { addr: "Via Smeraldo, Praiano", price: "€3.85M", delta: "+1.8%" },
  { addr: "Lungomare, Atrani", price: "€2.2M", delta: "−0.6%" },
  { addr: "Via San Giovanni, Ravello", price: "€4.95M", delta: "+2.4%" },
  { addr: "Fornillo, Positano", price: "€7.1M", delta: "+4.0%" },
  { addr: "Via Annunziata, Minori", price: "€1.9M", delta: "+0.9%" },
];

export function HeroRealestateSplit({
  eyebrow = "Private Office · Amalfi Coast",
  title = (
    <>
      Homes that rarely
      <br />
      <em>come to market.</em>
    </>
  ),
  lede = "Forty-one villas between Positano and Ravello that never reach a portal. Shown by appointment, and represented by one partner from the first viewing to the notary's signature.",
  listings = DEFAULT_LISTINGS,
  ticker = DEFAULT_TICKER,
}: HeroRealestateSplitProps) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const st = useRef({ x: 0, v: 0, target: 0, dragging: false, startX: 0, startPos: 0, lastX: 0, lastT: 0, raf: 0, step: 0 });
  const reduced = useRef(false);

  const apply = () => {
    if (track.current) track.current.style.transform = `translate3d(${st.current.x.toFixed(2)}px,0,0)`;
  };

  const measure = () => {
    const first = track.current?.children[0] as HTMLElement | undefined;
    const gap = track.current ? parseFloat(getComputedStyle(track.current).columnGap || "16") : 16;
    st.current.step = first ? first.offsetWidth + gap : 300;
  };

  const run = useCallback(() => {
    const s = st.current;
    if (s.raf) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      if (!s.dragging) {
        for (let i = 0; i < 2; i++) {
          const h = dt / 2;
          s.v += (-380 * (s.x - s.target) - 30 * s.v) * h;
          s.x += s.v * h;
        }
      }
      apply();
      if (!s.dragging && Math.abs(s.x - s.target) < 0.3 && Math.abs(s.v) < 0.3) {
        s.x = s.target;
        s.v = 0;
        apply();
        s.raf = 0;
        return;
      }
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
  }, []);

  const go = useCallback(
    (i: number, vel = 0) => {
      const n = Math.max(0, Math.min(listings.length - 1, i));
      measure();
      st.current.target = -n * st.current.step;
      st.current.v = vel;
      setIdx(n);
      if (reduced.current) {
        st.current.x = st.current.target;
        apply();
      } else run();
    },
    [listings.length, run],
  );

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    measure();
    const ro = new ResizeObserver(() => {
      measure();
      st.current.target = -idx * st.current.step;
      st.current.x = st.current.target;
      apply();
    });
    if (viewport.current) ro.observe(viewport.current);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(st.current.raf);
      st.current.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // drag
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    const s = st.current;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest("button,a")) return;
      measure();
      s.dragging = true;
      s.startX = e.clientX;
      s.startPos = s.x;
      s.lastX = e.clientX;
      s.lastT = performance.now();
      s.v = 0;
      vp.setPointerCapture(e.pointerId);
      vp.setAttribute("data-drag", "");
      run();
    };
    const move = (e: PointerEvent) => {
      if (!s.dragging) return;
      const now = performance.now();
      const dx = e.clientX - s.startX;
      const min = -(listings.length - 1) * s.step;
      let x = s.startPos + dx;
      if (x > 0) x = x * 0.35;
      if (x < min) x = min + (x - min) * 0.35;
      s.x = x;
      const dt = Math.max(1, now - s.lastT);
      s.v = s.v * 0.6 + ((e.clientX - s.lastX) / dt) * 1000 * 0.4;
      s.lastX = e.clientX;
      s.lastT = now;
    };
    const up = (e: PointerEvent) => {
      if (!s.dragging) return;
      s.dragging = false;
      vp.removeAttribute("data-drag");
      if (vp.hasPointerCapture(e.pointerId)) vp.releasePointerCapture(e.pointerId);
      // momentum: project where the throw would land
      const projected = s.x + s.v * 0.18;
      const n = Math.round(-projected / s.step);
      go(n, s.v);
    };
    vp.addEventListener("pointerdown", down);
    vp.addEventListener("pointermove", move);
    vp.addEventListener("pointerup", up);
    vp.addEventListener("pointercancel", up);
    return () => {
      vp.removeEventListener("pointerdown", down);
      vp.removeEventListener("pointermove", move);
      vp.removeEventListener("pointerup", up);
      vp.removeEventListener("pointercancel", up);
    };
  }, [go, listings.length, run]);

  // scroll parallax on map
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let visible = true;
    const frame = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      if (map.current) map.current.style.transform = window.innerWidth > 900 ? `translate3d(0, ${(p * 120).toFixed(1)}px, 0) scale(${(1.04 + p * 0.1).toFixed(4)})` : "";
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
    };
  }, []);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(idx + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(idx - 1);
    }
  };

  const cur = listings[idx];

  return (
    <section ref={root} className="fd-est" aria-label="Ashby & Vale listings">
      <style>{css}</style>
      <div className="fd-est-left">
        <p className="fd-est-eyebrow">{eyebrow}</p>
        <h1 className="fd-est-h1">{title}</h1>
        <p className="fd-est-lede">{lede}</p>
        <form className="fd-est-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <label className="fd-est-sf">
            <span>Village</span>
            <input defaultValue="Positano, Ravello" aria-label="Village" />
          </label>
          <label className="fd-est-sf fd-est-sf-b">
            <span>Budget</span>
            <input defaultValue="€2M to €5M" aria-label="Budget" />
          </label>
          <button type="submit" className="fd-est-go">
            Search
          </button>
        </form>
        <div className="fd-est-ticker" aria-label="Recent sales">
          <span className="fd-est-tk-l">
            <i aria-hidden="true" />
            Sold this season
          </span>
          <div className="fd-est-tk-vp">
            <ul className="fd-est-tk">
              {[...ticker, ...ticker].map((t, i) => (
                <li key={i} aria-hidden={i >= ticker.length || undefined}>
                  <span>{t.addr}</span>
                  <b>{t.price}</b>
                  <em className={t.delta.startsWith("−") ? "is-down" : ""}>{t.delta}</em>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="fd-est-right">
        <div ref={map} className="fd-est-map" aria-hidden="true">
          <CoastMap />
          {listings.map((l, i) => (
            <span
              key={l.name}
              className={`fd-est-pin ${i === idx ? "is-on" : ""}`}
              style={{ ["--x" as string]: l.at[0], ["--y" as string]: l.at[1], animationDelay: `${500 + i * 140}ms` }}
            >
              <b>{shortPrice(l.price)}</b>
            </span>
          ))}
        </div>
        <div className="fd-est-mapshade" aria-hidden="true" />

        <div
          className="fd-est-car"
          role="region"
          aria-roledescription="carousel"
          aria-label="Featured residences"
          tabIndex={0}
          onKeyDown={onKey}
        >
          <div ref={viewport} className="fd-est-vp">
            <div ref={track} className="fd-est-track">
              {listings.map((l, i) => (
                <article key={l.name} className={`fd-est-card ${i === idx ? "is-on" : ""}`} aria-roledescription="slide" aria-label={`${i + 1} of ${listings.length}: ${l.name}`}>
                  <div className="fd-est-photo">
                    <img src={l.src} alt={l.alt} width={480} height={480} draggable={false} decoding="async" />
                    {l.tag && <span className="fd-est-tag">{l.tag}</span>}
                    <span className="fd-est-no" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="fd-est-meta">
                    <p>{l.area}</p>
                    <h2>{l.name}</h2>
                  </div>
                  <div className="fd-est-row">
                    <ul className="fd-est-facts">
                      <li>{l.beds} bed</li>
                      <li>{l.baths} bath</li>
                      <li>{l.sqm} m²</li>
                    </ul>
                    <b>{l.price}</b>
                  </div>
                  {l.view && <p className="fd-est-view">{l.view}</p>}
                </article>
              ))}
            </div>
          </div>
          <div className="fd-est-ctrl">
            <span className="fd-est-status" aria-live="polite">
              <b>{String(idx + 1).padStart(2, "0")}</b> / {String(listings.length).padStart(2, "0")} · {cur.area}
            </span>
            <div className="fd-est-arrows">
              <button type="button" aria-label="Previous residence" onClick={() => go(idx - 1)} disabled={idx === 0}>
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
              <button type="button" aria-label="Next residence" onClick={() => go(idx + 1)} disabled={idx === listings.length - 1}>
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function shortPrice(p: string) {
  const n = Number(p.replace(/[^0-9.]/g, ""));
  const cur = p.replace(/[0-9.,\s]/g, "");
  if (!n) return p;
  if (n >= 1e6) return `${cur}${(n / 1e6).toFixed(2).replace(/\.?0+$/, "")}M`;
  return `${cur}${Math.round(n / 1e3)}k`;
}

/* ───────────── Coast map: generated once at module load (pure maths, SSR safe) ───────────── */

// shoreline height (y) for an x across the 600-unit-wide sheet; land is above
const coastY = (x: number) =>
  292 +
  20 * Math.sin(x / 74 + 1.1) +
  9 * Math.sin(x / 23 + 0.4) +
  4 * Math.sin(x / 8.7 + 1.3) +
  30 * Math.exp(-(((x - 336) / 17) ** 2)) - // Capo di Conca
  18 * Math.exp(-(((x - 120) / 34) ** 2)) - // Positano bay
  14 * Math.exp(-(((x - 452) / 28) ** 2)); // Amalfi harbour
const smoothY = (x: number) => {
  let t = 0;
  for (let k = -4; k <= 4; k++) t += coastY(x + k * 7);
  return t / 9;
};
const XS = Array.from({ length: 111 }, (_, i) => -30 + i * 6);
const toD = (pts: number[][]) => "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L");
const COAST_D = toD(XS.map((x) => [x, coastY(x)]));
const LAND_D = `${toD([[-30, -30], [630, -30], ...XS.slice().reverse().map((x) => [x, coastY(x)])])}Z`;
// land contours: near-parallel lines that tighten where the cliffs are steep
const CONTOURS = Array.from({ length: 7 }, (_, j) => {
  const k = j + 1;
  return toD(
    XS.map((x) => {
      const gap = 17 + 6 * Math.sin(x / 88 + 0.6);
      return [x, smoothY(x) - k * gap - (2 + k * 1.4) * Math.sin(x / 33 + k * 0.22) - 3 * Math.sin(x / 13 + k * 0.5)];
    }),
  );
});
// summits: wobbly closed rings
const ring = (cx: number, cy: number, r: number, seed: number) => {
  const pts = Array.from({ length: 49 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const rr = r * (1 + 0.16 * Math.sin(3 * a + seed + r / 18) + 0.07 * Math.sin(5 * a + seed * 2));
    return [cx + Math.cos(a) * rr * 1.35, cy + Math.sin(a) * rr * 0.8];
  });
  return `${toD(pts)}Z`;
};
const PEAKS = [
  { x: 196, y: 96, name: "M. S. Angelo", h: "1444" },
  { x: 420, y: 108, name: "M. Cerreto", h: "1316" },
];
const SUMMITS = PEAKS.flatMap((p, i) => [10, 20, 30, 40].map((r) => ring(p.x, p.y, r, i * 2.3)));
// sea depth lines, smoothed further offshore
const DEPTHS = [26, 64, 118].map((off, i) =>
  toD(
    XS.map((x) => {
      let t = 0;
      const w = 3 + i * 3;
      for (let k = -w; k <= w; k++) t += coastY(x + k * 6);
      return [x, t / (2 * w + 1) + off];
    }),
  ),
);
const ROAD_D = toD(XS.map((x) => [x, smoothY(x) - 15 + 2.5 * Math.sin(x / 14)]));
const RAVELLO_ROAD_D = "M470 286 C462 270 486 262 478 248 C470 234 500 230 490 216 C482 204 504 200 494 188";
// village footprints: seeded tiny blocks clustered on the slopes
const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const TOWNS = [
  { name: "Positano", x: 116, y: 252, n: 34, lx: 62, ly: 298 },
  { name: "Praiano", x: 246, y: 288, n: 18, lx: 212, ly: 252 },
  { name: "Conca dei Marini", x: 330, y: 304, n: 12, lx: 288, ly: 270 },
  { name: "Amalfi", x: 448, y: 274, n: 30, lx: 412, ly: 256 },
  { name: "Atrani", x: 476, y: 284, n: 10, lx: 462, ly: 318 },
  { name: "Ravello", x: 494, y: 192, n: 22, lx: 504, ly: 214 },
  { name: "Minori", x: 548, y: 278, n: 14, lx: 500, ly: 336 },
];
const BLOCKS = TOWNS.flatMap((t, ti) =>
  Array.from({ length: t.n }, (_, i) => {
    const a = hash(ti * 97 + i) * Math.PI * 2;
    const r = Math.sqrt(hash(ti * 31 + i * 7)) * (8 + t.n * 0.6);
    let x = t.x + Math.cos(a) * r * 1.4;
    let y = t.y + Math.sin(a) * r * 0.7;
    const limit = coastY(x) - 4;
    if (y > limit) y = limit - hash(i + ti) * 6;
    x = Math.round(x * 10) / 10;
    y = Math.round(y * 10) / 10;
    return { x, y, w: 2.4 + hash(i * 3 + ti) * 2.6, h: 2 + hash(i * 5 + ti) * 1.8, r: Math.round((hash(i * 11 + ti) - 0.5) * 50) };
  }),
);
const SOUNDINGS: [number, number, string][] = [
  [80, 352, "38"], [190, 372, "61"], [300, 404, "84"], [420, 356, "47"], [540, 372, "72"], [140, 430, "112"], [380, 452, "136"], [520, 440, "128"], [250, 470, "151"],
];

function CoastMap() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice" className="fd-est-msvg">
      <rect x="-30" y="-30" width="660" height="760" fill="#D5E0DF" />
      <g fill="none" stroke="#9FB5B7" strokeWidth="0.7" strokeDasharray="2 3">
        {DEPTHS.map((d, i) => <path key={i} d={d} opacity={0.9 - i * 0.2} />)}
      </g>
      <g className="fd-est-snd">
        {SOUNDINGS.map(([x, y, t]) => <text key={t} x={x} y={y}>{t}</text>)}
      </g>
      <path d={LAND_D} fill="#EEEAE0" />
      <g fill="none" stroke="#C9BFA6" strokeWidth="0.7">
        {CONTOURS.map((d, i) => <path key={i} d={d} strokeWidth={i === 4 ? 1.2 : 0.7} />)}
        {SUMMITS.map((d, i) => <path key={`s${i}`} d={d} strokeWidth={i % 4 === 3 ? 1.2 : 0.7} />)}
      </g>
      <path d={COAST_D} fill="none" stroke="#8FA6A8" strokeWidth="1.1" />
      <path d={COAST_D} fill="none" stroke="#D5E0DF" strokeWidth="5" opacity="0.5" transform="translate(0 3)" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={ROAD_D} stroke="#B9AD93" strokeWidth="4.2" />
        <path d={RAVELLO_ROAD_D} stroke="#B9AD93" strokeWidth="3.4" />
        <path d={ROAD_D} stroke="#FBF8F1" strokeWidth="2.6" />
        <path d={RAVELLO_ROAD_D} stroke="#FBF8F1" strokeWidth="1.8" />
      </g>
      <g fill="#A99C84">
        {BLOCKS.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w.toFixed(1)} height={b.h.toFixed(1)} transform={`rotate(${b.r} ${b.x} ${b.y})`} />
        ))}
      </g>
      <g stroke="#17150F" strokeWidth="0.4" opacity="0.12">
        <path d="M200 0 V700 M400 0 V700 M0 140 H600" />
      </g>
      <g className="fd-est-grat">
        <text x="204" y="14">14°31′E</text>
        <text x="404" y="14">14°36′E</text>
        <text x="64" y="136">40°38′N</text>
      </g>
      {PEAKS.map((p) => (
        <g key={p.name} className="fd-est-peak">
          <path d={`M${p.x} ${p.y - 4} l4 7 h-8z`} fill="#6D675C" />
          <text x={p.x + 8} y={p.y + 3}>{p.name}</text>
          <text x={p.x + 8} y={p.y + 13} className="fd-est-peak-h">{p.h} m</text>
        </g>
      ))}
      <text x="150" y="292" className="fd-est-road">SS163</text>
      <g className="fd-est-town">
        {TOWNS.map((t) => <text key={t.name} x={t.lx} y={t.ly}>{t.name}</text>)}
      </g>
      <g className="fd-est-sea">
        <text x="150" y="560">Golfo di Salerno</text>
        <text x="380" y="400">Mar Tirreno</text>
      </g>
      <g transform="translate(456 62)" className="fd-est-scale">
        <path d="M0 6 H60" stroke="#17150F" strokeWidth="1" />
        <path d="M0 2 V10 M30 4 V8 M60 2 V10" stroke="#17150F" strokeWidth="1" />
        <text x="0" y="22">0</text>
        <text x="60" y="22" textAnchor="end">1 km</text>
        <path d="M84 -6 l5 14 l-5 -4 l-5 4z" fill="#17150F" />
        <text x="84" y="22" textAnchor="middle">N</text>
      </g>
    </svg>
  );
}

const css = `
.fd-est, .fd-est *, .fd-est *::before, .fd-est *::after { box-sizing: border-box; }
.fd-est {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-est-paper: #F6F3EE;
  --fd-est-ink: #17150F;
  --fd-est-muted: #6D675C;
  --fd-est-accent: #1F3B2D;
  --fd-est-serif: ui-serif, "New York", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --fd-est-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); margin: 0; padding: 0; min-height: 860px;
  background: var(--fd-est-paper); color: var(--fd-est-ink); font: 400 1rem/1.5 var(--fd-est-sans); isolation: isolate; overflow: hidden;
}
.fd-est-left { display: flex; flex-direction: column; justify-content: center; padding: 120px 56px 48px max(40px, calc(50vw - 620px)); min-width: 0; }
.fd-est-eyebrow { margin: 0 0 22px; padding: 0; font: 600 0.75rem/1 var(--fd-est-sans); letter-spacing: 0.2em; text-transform: uppercase; color: var(--fd-est-accent); animation: fd-est-rise var(--fd-dur-4) var(--fd-ease-out) 100ms both; }
.fd-est-h1 { margin: 0; padding: 0; font: 400 clamp(2.75rem, 5vw, 4.75rem)/1 var(--fd-est-serif); letter-spacing: -0.035em; color: var(--fd-est-ink); text-wrap: balance; animation: fd-est-mask 1100ms var(--fd-ease-out) 150ms both; }
.fd-est-h1 em { font-style: italic; color: var(--fd-est-accent); }
.fd-est-lede { margin: 24px 0 0; padding: 0; max-width: 30rem; font: 400 1.0625rem/1.6 var(--fd-est-sans); color: var(--fd-est-muted); letter-spacing: -0.008em; text-wrap: pretty; animation: fd-est-rise var(--fd-dur-4) var(--fd-ease-out) 350ms both; }
.fd-est-search { display: grid; grid-template-columns: 1.4fr 1fr auto; gap: 0; max-width: 520px; margin: 34px 0 0; padding: 6px; border-radius: 9999px; background: #fff; box-shadow: 0 0 0 1px rgba(23,21,15,0.08), 0 14px 30px -18px rgba(23,21,15,0.3); animation: fd-est-rise var(--fd-dur-4) var(--fd-ease-out) 450ms both; }
.fd-est-sf { display: flex; flex-direction: column; justify-content: center; gap: 3px; margin: 0; padding: 6px 18px; min-width: 0; }
.fd-est-sf-b { border-left: 1px solid rgba(23,21,15,0.1); }
.fd-est-sf span { font: 600 0.625rem/1 var(--fd-est-sans); letter-spacing: 0.12em; text-transform: uppercase; color: var(--fd-est-muted); }
.fd-est-sf input { appearance: none; -webkit-appearance: none; width: 100%; margin: 0; padding: 0; border: 0; outline: 0; background: transparent; font: 500 0.9375rem/1.3 var(--fd-est-sans); color: var(--fd-est-ink); min-width: 0; }
.fd-est-go { appearance: none; -webkit-appearance: none; cursor: pointer; margin: 0; padding: 0 24px; height: 50px; border: 0; border-radius: 9999px; background: var(--fd-est-accent); color: #F6F3EE; font: 500 0.9375rem/1 var(--fd-est-sans); transition: transform var(--fd-dur-2) var(--fd-spring), background var(--fd-dur-1); }
.fd-est-go:hover { background: #2A4D3B; }
.fd-est-go:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-est-go:focus-visible, .fd-est-car:focus-visible, .fd-est-arrows button:focus-visible { outline: 2px solid rgba(31,59,45,0.7); outline-offset: 2px; }
.fd-est-search:focus-within { box-shadow: 0 0 0 2px rgba(31,59,45,0.4), 0 14px 30px -18px rgba(23,21,15,0.3); }

.fd-est-ticker { display: flex; align-items: center; gap: 16px; margin: 48px 0 0; padding: 16px 0 0; border-top: 1px solid rgba(23,21,15,0.1); min-width: 0; animation: fd-est-rise var(--fd-dur-4) var(--fd-ease-out) 600ms both; }
.fd-est-tk-l { display: inline-flex; align-items: center; gap: 8px; flex: none; font: 600 0.6875rem/1 var(--fd-est-sans); letter-spacing: 0.12em; text-transform: uppercase; color: var(--fd-est-ink); }
.fd-est-tk-l i { display: block; width: 6px; height: 6px; border-radius: 9999px; background: #C2410C; animation: fd-est-blink 1.6s var(--fd-ease-in-out) infinite; }
.fd-est-tk-vp { overflow: hidden; flex: 1; min-width: 0; -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
.fd-est-tk { display: flex; gap: 28px; width: max-content; margin: 0; padding: 0; list-style: none; animation: fd-est-marquee 36s linear infinite; }
.fd-est-ticker:hover .fd-est-tk { animation-play-state: paused; }
.fd-est-tk li { display: inline-flex; align-items: baseline; gap: 8px; margin: 0; padding: 0; white-space: nowrap; font: 400 0.8125rem/1 var(--fd-est-sans); color: var(--fd-est-muted); }
.fd-est-tk b { font: 600 0.875rem/1 var(--fd-est-sans); color: var(--fd-est-ink); font-variant-numeric: tabular-nums; }
.fd-est-tk em { font: 600 0.75rem/1 var(--fd-est-sans); font-style: normal; color: #15803D; }
.fd-est-tk em.is-down { color: #B91C1C; }

.fd-est-right { position: relative; min-height: 860px; overflow: hidden; clip-path: inset(0 0 0 100%); animation: fd-est-wipe 1300ms var(--fd-ease-in-out) 100ms both; background: #D5E0DF; }
.fd-est-map { position: absolute; inset: -6% 0 -6% 0; container-type: size; will-change: transform; transform: scale(1.04); }
.fd-est-msvg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.fd-est-msvg text { font-family: var(--fd-est-sans); }
.fd-est-town text { font-size: 8.4px; font-weight: 600; letter-spacing: 1.7px; text-transform: uppercase; fill: #3C382F; paint-order: stroke; stroke: #EEEAE0; stroke-width: 3px; stroke-linejoin: round; }
.fd-est-sea text { font: italic 400 13px var(--fd-est-serif); letter-spacing: 3px; fill: #5F7C80; }
.fd-est-snd text { font: 400 6.5px ui-monospace, "SF Mono", Menlo, monospace; fill: #7E9799; }
.fd-est-grat text, .fd-est-scale text, .fd-est-road { font: 500 6.5px ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: 0.4px; fill: #6D675C; }
.fd-est-peak text { font-size: 7.4px; font-style: italic; fill: #6D675C; font-family: var(--fd-est-serif); }
.fd-est-peak .fd-est-peak-h { font: 400 6.2px ui-monospace, "SF Mono", Menlo, monospace; font-style: normal; }
.fd-est-mapshade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(246,243,238,0) 52%, rgba(246,243,238,0.7) 100%), linear-gradient(90deg, rgba(246,243,238,0.55), transparent 14%); }
.fd-est-pin {
  --k: max(100cqw / 600, 100cqh / 700);
  position: absolute; z-index: 1; display: block; margin: 0;
  left: calc(50% + (var(--x) - 300) * var(--k)); top: calc(50% + (var(--y) - 350) * var(--k));
  transform: translate(-50%, -100%); animation: fd-est-drop 800ms var(--fd-spring) both;
}
.fd-est-pin b {
  position: relative; display: block; margin: 0 0 9px; padding: 6px 9px; border-radius: 3px; background: #FBF9F4; color: var(--fd-est-ink); white-space: nowrap;
  font: 600 0.75rem/1 var(--fd-est-sans); font-variant-numeric: tabular-nums; letter-spacing: 0; box-shadow: 0 6px 16px -8px rgba(23,21,15,0.45), 0 0 0 1px rgba(23,21,15,0.14);
  transition: background var(--fd-dur-3) var(--fd-ease-out), color var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-spring);
}
.fd-est-pin b::after { content: ""; position: absolute; left: 50%; bottom: -4px; width: 8px; height: 8px; margin-left: -4px; background: inherit; transform: rotate(45deg); box-shadow: 1px 1px 0 rgba(23,21,15,0.14); }
.fd-est-pin::before { content: ""; position: absolute; left: 50%; bottom: -3px; width: 6px; height: 6px; margin-left: -3px; border-radius: 9999px; background: var(--fd-est-ink); box-shadow: 0 0 0 2px #FBF9F4; }
.fd-est-pin::after { content: ""; position: absolute; left: 50%; bottom: -5px; width: 10px; height: 10px; margin: 0 0 0 -5px; border-radius: 9999px; background: rgba(31,59,45,0.35); opacity: 0; }
.fd-est-pin.is-on { z-index: 2; }
.fd-est-pin.is-on b { background: var(--fd-est-accent); color: #F6F3EE; transform: scale(1.1) translateY(-3px); }
.fd-est-pin.is-on::before { background: var(--fd-est-accent); }
.fd-est-pin.is-on::after { opacity: 1; animation: fd-est-pulse 2s var(--fd-ease-out) infinite; }

.fd-est-car { position: absolute; left: 32px; right: 0; bottom: 36px; outline: none; animation: fd-est-rise 1000ms var(--fd-ease-out) 800ms both; }
.fd-est-vp { overflow: hidden; margin: 0; padding: 20px 0 24px 0; cursor: grab; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
.fd-est-vp[data-drag] { cursor: grabbing; }
.fd-est-track { display: flex; column-gap: 16px; will-change: transform; }
.fd-est-card {
  flex: none; width: 292px; margin: 0; padding: 8px 8px 14px; border-radius: 4px; background: #FBF9F4;
  box-shadow: 0 0 0 1px rgba(23,21,15,0.08), 0 20px 40px -26px rgba(23,21,15,0.4);
  transform: scale(0.95); transform-origin: left bottom;
  transition: transform var(--fd-dur-4) var(--fd-spring), box-shadow var(--fd-dur-3);
}
.fd-est-card:not(.is-on) .fd-est-photo img { filter: saturate(0.55) brightness(1.06); }
.fd-est-card.is-on { opacity: 1; transform: none; box-shadow: 0 0 0 1px rgba(23,21,15,0.08), 0 30px 60px -26px rgba(23,21,15,0.5); }
.fd-est-photo { position: relative; overflow: hidden; height: 172px; margin: 0; border-radius: 2px; background: #DCD6CA; }
.fd-est-photo img { display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; object-fit: cover; pointer-events: none; transform: scale(1.06); transition: transform 1200ms var(--fd-ease-out), filter var(--fd-dur-3) var(--fd-ease-out); }
.fd-est-card.is-on .fd-est-photo img { transform: none; }
.fd-est-tag { position: absolute; left: 8px; top: 8px; margin: 0; padding: 5px 8px; border-radius: 2px; background: #FBF9F4; color: var(--fd-est-ink); font: 600 0.625rem/1 var(--fd-est-sans); letter-spacing: 0.12em; text-transform: uppercase; }
.fd-est-no { position: absolute; right: 10px; bottom: 8px; margin: 0; font: 400 1.5rem/1 var(--fd-est-serif); font-style: italic; color: #FBF9F4; text-shadow: 0 1px 12px rgba(0,0,0,0.35); }
.fd-est-meta { margin: 12px 4px 0; padding: 0; }
.fd-est-meta p { margin: 0; padding: 0; font: 600 0.625rem/1.2 var(--fd-est-sans); letter-spacing: 0.16em; text-transform: uppercase; color: var(--fd-est-accent); }
.fd-est-meta h2 { margin: 5px 0 0; padding: 0; font: 400 1.1875rem/1.15 var(--fd-est-serif); letter-spacing: -0.01em; color: var(--fd-est-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fd-est-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin: 10px 4px 0; padding: 10px 0 0; border-top: 1px solid rgba(23,21,15,0.1); }
.fd-est-row b { flex: none; font: 600 0.9375rem/1 var(--fd-est-sans); color: var(--fd-est-ink); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.fd-est-facts { display: flex; gap: 0; margin: 0; padding: 0; list-style: none; }
.fd-est-facts li { margin: 0; padding: 0 8px; border-left: 1px solid rgba(23,21,15,0.14); font: 500 0.75rem/1 var(--fd-est-sans); color: var(--fd-est-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.fd-est-facts li:first-child { padding-left: 0; border-left: 0; }
.fd-est-view { margin: 8px 4px 0; padding: 0; font: italic 400 0.8125rem/1.2 var(--fd-est-serif); color: var(--fd-est-muted); }
.fd-est-ctrl { display: flex; justify-content: space-between; align-items: center; margin: 0; padding: 0 32px 0 0; }
.fd-est-status { font: 400 0.8125rem/1 var(--fd-est-sans); color: var(--fd-est-muted); }
.fd-est-status b { font: 600 0.8125rem/1 var(--fd-est-sans); color: var(--fd-est-ink); font-variant-numeric: tabular-nums; }
.fd-est-arrows { display: flex; gap: 8px; }
.fd-est-arrows button { appearance: none; -webkit-appearance: none; cursor: pointer; display: grid; place-items: center; width: 42px; height: 42px; margin: 0; padding: 0; border-radius: 9999px; border: 0; background: #FBF9F4; color: var(--fd-est-ink); box-shadow: 0 0 0 1px rgba(23,21,15,0.14); transition: transform var(--fd-dur-2) var(--fd-spring), opacity var(--fd-dur-2), background var(--fd-dur-1); }
.fd-est-arrows button:hover:not(:disabled) { background: #fff; }
.fd-est-arrows button svg { display: block; }
.fd-est-arrows button:active { transform: scale(0.92); transition-duration: var(--fd-dur-1); }
.fd-est-arrows button:disabled { opacity: 0.35; cursor: default; }

@keyframes fd-est-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes fd-est-mask { from { opacity: 0; clip-path: inset(0 0 100% 0); transform: translateY(24px); } to { opacity: 1; clip-path: inset(0 0 -10% 0); transform: none; } }
@keyframes fd-est-wipe { to { clip-path: inset(0 0 0 0); } }
@keyframes fd-est-drop { from { opacity: 0; transform: translate(-50%, -260%); } to { opacity: 1; transform: translate(-50%, -100%); } }
@keyframes fd-est-pulse { 0% { transform: scale(0.6); opacity: 0.8; } 100% { transform: scale(3.2); opacity: 0; } }
@keyframes fd-est-marquee { to { transform: translateX(-50%); } }
@keyframes fd-est-blink { 50% { opacity: 0.3; } }

@media (max-width: 900px) {
  .fd-est { grid-template-columns: 1fr; min-height: 844px; }
  .fd-est-left { padding: 96px 20px 28px; }
  .fd-est-lede { font-size: 0.9375rem; margin-top: 16px; }
  .fd-est-search { grid-template-columns: 1fr auto; margin-top: 24px; }
  .fd-est-sf-b { display: none; }
  .fd-est-ticker { margin-top: 24px; }
  .fd-est-right { min-height: 0; display: flex; flex-direction: column; background: var(--fd-est-paper); }
  .fd-est-map { position: relative; inset: auto; flex: none; height: 560px; width: 125%; margin: 0 0 0 -12.5%; transform: none; }
  .fd-est-mapshade { height: 330px; bottom: auto; background: linear-gradient(180deg, rgba(246,243,238,0) 70%, rgba(246,243,238,0.9) 100%); }
  .fd-est-car { position: relative; left: auto; right: auto; bottom: auto; margin: -280px 0 0; padding: 0 0 24px 16px; z-index: 2; }
  .fd-est-town text { font-size: 10px; letter-spacing: 1.6px; }
  .fd-est-sea text { font-size: 14px; }
  .fd-est-grat text, .fd-est-scale text, .fd-est-road, .fd-est-snd text { font-size: 8px; }
  .fd-est-peak text { font-size: 9px; }
  .fd-est-vp { padding-top: 0; }
  .fd-est-card { width: 264px; }
  .fd-est-photo { height: 150px; }
  .fd-est-ctrl { padding-right: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-est *, .fd-est *::before, .fd-est *::after, .fd-est-right { animation: none !important; }
  .fd-est-right { clip-path: none; }
}
@media (prefers-reduced-transparency: reduce) { .fd-est-tag { background: #fff; -webkit-backdrop-filter: none; backdrop-filter: none; } }
`;

/* ───────────────────────── Demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-est-demo">
      <style>{demoCss}</style>
      <header className="fd-est-demo-nav">
        <a className="fd-est-demo-logo" href="#top">
          Ashby <i>&amp;</i> Vale
        </a>
        <nav aria-label="Primary">
          <a href="#buy">Buy</a>
          <a href="#sell">Sell</a>
          <a href="#lettings">Lettings</a>
          <a href="#journal">Journal</a>
        </nav>
        <a className="fd-est-demo-cta" href="#valuation">Book a valuation</a>
      </header>
      <HeroRealestateSplit />
    </div>
  );
}

const demoCss = `
.fd-est-demo { position: relative; margin: 0; padding: 0; min-height: 100vh; background: #F6F3EE; }
.fd-est-demo *, .fd-est-demo *::before, .fd-est-demo *::after { box-sizing: border-box; }
.fd-est-demo-nav { position: absolute; z-index: 10; top: 0; left: 0; width: 50%; height: 76px; margin: 0; padding: 0 56px 0 max(40px, calc(50vw - 620px)); display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.fd-est-demo-nav .fd-est-demo-logo { margin: 0; color: #17150F; text-decoration: none; font: 400 1.375rem/1 ui-serif, "New York", "Iowan Old Style", Georgia, serif; letter-spacing: -0.02em; white-space: nowrap; }
.fd-est-demo-logo i { font-style: italic; color: #1F3B2D; }
.fd-est-demo-nav nav { display: flex; gap: 24px; }
.fd-est-demo-nav a { color: #4A453B; text-decoration: none; font: 500 0.875rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; }
.fd-est-demo-nav .fd-est-demo-cta { display: none; }
.fd-est-demo-nav a:focus-visible { outline: 2px solid rgba(31,59,45,.7); outline-offset: 2px; border-radius: 6px; }
@media (max-width: 1100px) { .fd-est-demo-nav nav { display: none; } }
@media (max-width: 900px) { .fd-est-demo-nav { width: 100%; padding: 0 20px; height: 64px; } .fd-est-demo-nav .fd-est-demo-cta { display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 9999px; background: #1F3B2D; color: #F6F3EE; } }
`;
