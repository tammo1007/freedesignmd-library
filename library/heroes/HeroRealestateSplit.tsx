/**
 * HeroRealestateSplit — a premium real-estate hero in a split layout. Left:
 * editorial headline, a live price ticker of recent sales, and search. Right:
 * a stylised SVG map with animated pins that drop in, pulse, and follow the
 * selected listing, over a property-card carousel you can drag with momentum
 * (spring-settled snapping) or step with arrow keys. Listing "photos" are
 * procedural architecture renders (CSS gradients + SVG).
 *
 * Props: title, lede, listings ({ name, area, price, beds, baths, sqm, pin: [x%, y%], palette }[]),
 * ticker ({ addr, price, delta }[]).
 * CSS vars: --fd-est-paper, --fd-est-ink, --fd-est-accent.
 *
 * Browser support: all evergreen browsers. Pointer Events for drag.
 * Motion: drag uses a velocity-tracking spring integrator (k=380, c=30) for
 * the release snap; pins drop with --fd-spring; ticker is a CSS marquee;
 * scroll via rAF + getBoundingClientRect (map parallax, transform only).
 * prefers-reduced-motion: no marquee, instant snaps, static pins.
 * Accessibility: carousel is a region with aria-roledescription, arrow-key
 * navigation and live "n of N" status; prev/next are labelled buttons.
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
  pin: [number, number];
  palette: [string, string, string];
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
  { name: "The Linden Residence", area: "Hampstead, NW3", price: "£4,250,000", beds: 5, baths: 4, sqm: 412, pin: [36, 30], palette: ["#E9DCC8", "#B88A5E", "#3B4A3F"], tag: "New" },
  { name: "Wharf House No. 7", area: "Wapping, E1W", price: "£2,890,000", beds: 3, baths: 3, sqm: 238, pin: [70, 58], palette: ["#D6DEE4", "#7E8C99", "#2B3540"] },
  { name: "Mews Cottage", area: "Notting Hill, W11", price: "£1,975,000", beds: 2, baths: 2, sqm: 146, pin: [22, 62], palette: ["#F1E4D8", "#C9826B", "#5B3A31"], tag: "Under offer" },
  { name: "Garden Flat, Thurloe Sq.", area: "South Kensington, SW7", price: "£3,150,000", beds: 3, baths: 2, sqm: 201, pin: [44, 72], palette: ["#E3E7DA", "#8FA27E", "#36432F"] },
];

const DEFAULT_TICKER: Sale[] = [
  { addr: "Cheyne Walk, SW3", price: "£6.4M", delta: "+3.1%" },
  { addr: "Elgin Crescent, W11", price: "£3.85M", delta: "+1.8%" },
  { addr: "Canonbury Sq, N1", price: "£2.2M", delta: "−0.6%" },
  { addr: "Primrose Hill, NW1", price: "£4.95M", delta: "+2.4%" },
  { addr: "Lansdowne Rd, W11", price: "£7.1M", delta: "+4.0%" },
  { addr: "Albert Bridge Rd, SW11", price: "£1.9M", delta: "+0.9%" },
];

export function HeroRealestateSplit({
  eyebrow = "Ashby & Vale · Private Office",
  title = (
    <>
      Homes that rarely
      <br />
      <em>come to market.</em>
    </>
  ),
  lede = "Four hundred off-market residences across prime London, shown by appointment and represented by the same partner from first viewing to completion.",
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
      if (map.current) map.current.style.transform = `translate3d(0, ${(p * 120).toFixed(1)}px, 0) scale(${(1.04 + p * 0.1).toFixed(4)})`;
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
            <span>Neighbourhood</span>
            <input defaultValue="Hampstead, Notting Hill…" aria-label="Neighbourhood" />
          </label>
          <label className="fd-est-sf fd-est-sf-b">
            <span>Budget</span>
            <input defaultValue="£2M – £5M" aria-label="Budget" />
          </label>
          <button type="submit" className="fd-est-go">
            Search
          </button>
        </form>
        <div className="fd-est-ticker" aria-label="Recent sales">
          <span className="fd-est-tk-l">
            <i aria-hidden="true" />
            Sold this week
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
          <svg aria-hidden="true" focusable="false" viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
            <rect width="600" height="700" fill="#E9E5DC" />
            {/* parks */}
            <path d="M120 120 C180 90 260 110 280 170 C300 230 230 270 170 250 C110 230 80 160 120 120Z" fill="#CFD8C0" />
            <path d="M380 420 C430 400 500 420 510 470 C520 520 460 540 410 520 C370 500 350 440 380 420Z" fill="#CFD8C0" />
            <path d="M60 470 C100 450 150 470 150 510 C150 550 100 560 70 540 C40 520 30 490 60 470Z" fill="#D5DCC6" />
            {/* river */}
            <path d="M-20 560 C80 520 160 600 260 560 C360 520 420 600 520 580 C580 568 620 540 640 530 L640 620 C600 640 560 660 500 664 C400 670 340 610 250 640 C160 670 80 610 -20 650Z" fill="#B9CCD6" />
            {/* streets */}
            <g stroke="#FBF9F4" strokeLinecap="round" fill="none">
              <path d="M0 300 C150 280 300 320 600 260" strokeWidth="10" />
              <path d="M260 0 C250 200 300 400 280 700" strokeWidth="10" />
              <path d="M0 160 L600 220" strokeWidth="6" />
              <path d="M90 0 L180 700" strokeWidth="6" />
              <path d="M450 0 C420 200 470 380 430 700" strokeWidth="6" />
              <path d="M0 420 L600 380" strokeWidth="6" />
              {Array.from({ length: 12 }, (_, i) => (
                <path key={i} d={`M${i * 55 - 20} 0 L${i * 55 + 60} 700`} strokeWidth="2" opacity="0.7" />
              ))}
              {Array.from({ length: 14 }, (_, i) => (
                <path key={`h${i}`} d={`M0 ${i * 52} L600 ${i * 52 + 30}`} strokeWidth="2" opacity="0.7" />
              ))}
            </g>
          </svg>
          {listings.map((l, i) => (
            <span
              key={l.name}
              className={`fd-est-pin ${i === idx ? "is-on" : ""}`}
              style={{ left: `${l.pin[0]}%`, top: `${l.pin[1]}%`, animationDelay: `${500 + i * 140}ms` }}
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
                  <div className="fd-est-photo" style={{ ["--a" as string]: l.palette[0], ["--b" as string]: l.palette[1], ["--c" as string]: l.palette[2] }}>
                    <Facade palette={l.palette} variant={i} />
                    {l.tag && <span className="fd-est-tag">{l.tag}</span>}
                  </div>
                  <div className="fd-est-meta">
                    <div>
                      <h2>{l.name}</h2>
                      <p>{l.area}</p>
                    </div>
                    <b>{l.price}</b>
                  </div>
                  <ul className="fd-est-facts">
                    <li>{l.beds} bed</li>
                    <li>{l.baths} bath</li>
                    <li>{l.sqm} m²</li>
                  </ul>
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

/** A procedural "architectural photo": sky, facade, windows, foliage. */
function Facade({ palette, variant }: { palette: [string, string, string]; variant: number }) {
  const [a, b, c] = palette;
  const v = variant % 4;
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className="fd-est-svg">
      <rect width="320" height="200" fill={a} />
      <rect width="320" height="120" fill="#fff" opacity="0.35" />
      <circle cx={v % 2 ? 260 : 60} cy="40" r="60" fill="#fff" opacity="0.35" />
      {v === 0 && (
        <g>
          <path d="M70 70 L160 30 L250 70 L250 180 L70 180Z" fill={b} />
          <path d="M60 72 L160 26 L260 72" fill="none" stroke={c} strokeWidth="6" />
          {[95, 145, 195].map((x) => <rect key={x} x={x} y="90" width="30" height="40" fill={c} opacity="0.85" />)}
          {[95, 195].map((x) => <rect key={x} x={x} y="140" width="30" height="40" fill={c} opacity="0.85" />)}
          <rect x="145" y="140" width="30" height="40" fill="#1a1a1a" />
        </g>
      )}
      {v === 1 && (
        <g>
          <rect x="40" y="40" width="240" height="140" fill={b} />
          {Array.from({ length: 4 }, (_, r) => Array.from({ length: 6 }, (_, k) => (
            <rect key={`${r}-${k}`} x={54 + k * 38} y={52 + r * 32} width="26" height="22" fill={c} opacity={0.6 + ((r + k) % 3) * 0.12} />
          )))}
          <rect x="40" y="36" width="240" height="6" fill={c} />
        </g>
      )}
      {v === 2 && (
        <g>
          <rect x="30" y="60" width="120" height="120" fill={b} />
          <rect x="150" y="80" width="140" height="100" fill={a} stroke={b} strokeWidth="2" />
          <path d="M30 60 L90 30 L150 60Z" fill={c} />
          <rect x="60" y="110" width="28" height="70" fill={c} />
          <rect x="100" y="90" width="30" height="30" fill="#fff" opacity="0.7" />
          {[170, 220].map((x) => <rect key={x} x={x} y="100" width="40" height="50" fill={c} opacity="0.5" />)}
        </g>
      )}
      {v === 3 && (
        <g>
          <rect x="50" y="50" width="220" height="130" fill="#F7F3EC" />
          {[70, 130, 190].map((x) => <rect key={x} x={x} y="70" width="40" height="80" fill={c} opacity="0.7" />)}
          <rect x="50" y="150" width="220" height="6" fill={b} />
          {Array.from({ length: 10 }, (_, i) => <rect key={i} x={54 + i * 22} y="156" width="3" height="24" fill={b} />)}
        </g>
      )}
      <ellipse cx="20" cy="185" rx="60" ry="34" fill={c} opacity="0.85" />
      <ellipse cx="300" cy="190" rx="50" ry="30" fill={c} opacity="0.75" />
      <rect y="180" width="320" height="20" fill={c} opacity="0.25" />
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

.fd-est-right { position: relative; min-height: 860px; overflow: hidden; clip-path: inset(0 0 0 100%); animation: fd-est-wipe 1300ms var(--fd-ease-in-out) 100ms both; }
.fd-est-map { position: absolute; inset: -6% 0 -6% 0; will-change: transform; transform: scale(1.04); }
.fd-est-map svg { display: block; width: 100%; height: 100%; }
.fd-est-mapshade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(246,243,238,0) 45%, rgba(246,243,238,0.65) 100%), linear-gradient(90deg, rgba(246,243,238,0.5), transparent 18%); }
.fd-est-pin {
  position: absolute; z-index: 1; display: block; margin: 0; transform: translate(-50%, -100%); animation: fd-est-drop 800ms var(--fd-spring) both;
}
.fd-est-pin b {
  position: relative; display: block; padding: 7px 11px; border-radius: 9999px; background: #fff; color: var(--fd-est-ink); white-space: nowrap;
  font: 600 0.75rem/1 var(--fd-est-sans); box-shadow: 0 6px 16px -6px rgba(23,21,15,0.4), 0 0 0 1px rgba(23,21,15,0.06);
  transition: background var(--fd-dur-3) var(--fd-ease-out), color var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-spring);
}
.fd-est-pin b::after { content: ""; position: absolute; left: 50%; bottom: -5px; width: 10px; height: 10px; margin-left: -5px; background: inherit; transform: rotate(45deg); border-radius: 0 0 2px 0; }
.fd-est-pin::after { content: ""; position: absolute; left: 50%; top: calc(100% + 6px); width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 9999px; background: rgba(31,59,45,0.35); opacity: 0; }
.fd-est-pin.is-on { z-index: 2; }
.fd-est-pin.is-on b { background: var(--fd-est-accent); color: #F6F3EE; transform: scale(1.12) translateY(-4px); }
.fd-est-pin.is-on::after { opacity: 1; animation: fd-est-pulse 2s var(--fd-ease-out) infinite; }

.fd-est-car { position: absolute; left: 32px; right: 0; bottom: 36px; outline: none; animation: fd-est-rise 1000ms var(--fd-ease-out) 800ms both; }
.fd-est-vp { overflow: hidden; padding: 20px 0 24px 0; cursor: grab; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
.fd-est-vp[data-drag] { cursor: grabbing; }
.fd-est-track { display: flex; column-gap: 16px; will-change: transform; }
.fd-est-card {
  flex: none; width: 300px; margin: 0; padding: 10px 10px 14px; border-radius: 22px; background: #fff;
  box-shadow: 0 0 0 1px rgba(23,21,15,0.06), 0 20px 40px -24px rgba(23,21,15,0.35);
  opacity: 0.72; transform: scale(0.95); transform-origin: left bottom;
  transition: opacity var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-4) var(--fd-spring), box-shadow var(--fd-dur-3);
}
.fd-est-card.is-on { opacity: 1; transform: none; box-shadow: 0 0 0 1px rgba(23,21,15,0.06), 0 30px 60px -24px rgba(23,21,15,0.45); }
.fd-est-photo { position: relative; overflow: hidden; height: 168px; border-radius: 14px; background: var(--a); }
.fd-est-svg { display: block; width: 100%; height: 100%; pointer-events: none; }
.fd-est-tag { position: absolute; left: 10px; top: 10px; padding: 5px 9px; border-radius: 9999px; background: rgba(255,255,255,0.9); color: var(--fd-est-ink); font: 600 0.6875rem/1 var(--fd-est-sans); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.fd-est-meta { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin: 12px 4px 0; }
.fd-est-meta h2 { margin: 0; padding: 0; font: 400 1.125rem/1.2 var(--fd-est-serif); letter-spacing: -0.01em; color: var(--fd-est-ink); }
.fd-est-meta p { margin: 3px 0 0; padding: 0; font: 400 0.8125rem/1.2 var(--fd-est-sans); color: var(--fd-est-muted); }
.fd-est-meta b { flex: none; font: 600 0.9375rem/1.3 var(--fd-est-sans); color: var(--fd-est-ink); font-variant-numeric: tabular-nums; }
.fd-est-facts { display: flex; gap: 6px; margin: 12px 4px 0; padding: 0; list-style: none; }
.fd-est-facts li { margin: 0; padding: 5px 9px; border-radius: 9999px; background: #F3F0EA; font: 500 0.75rem/1 var(--fd-est-sans); color: var(--fd-est-muted); }
.fd-est-ctrl { display: flex; justify-content: space-between; align-items: center; margin: 0; padding: 0 32px 0 0; }
.fd-est-status { font: 400 0.8125rem/1 var(--fd-est-sans); color: var(--fd-est-muted); }
.fd-est-status b { font: 600 0.8125rem/1 var(--fd-est-sans); color: var(--fd-est-ink); font-variant-numeric: tabular-nums; }
.fd-est-arrows { display: flex; gap: 8px; }
.fd-est-arrows button { appearance: none; -webkit-appearance: none; cursor: pointer; display: grid; place-items: center; width: 42px; height: 42px; margin: 0; padding: 0; border-radius: 9999px; border: 0; background: #fff; color: var(--fd-est-ink); box-shadow: 0 0 0 1px rgba(23,21,15,0.1); transition: transform var(--fd-dur-2) var(--fd-spring), opacity var(--fd-dur-2); }
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
  .fd-est-left { padding: 96px 20px 24px; }
  .fd-est-lede { font-size: 0.9375rem; margin-top: 16px; }
  .fd-est-search { grid-template-columns: 1fr auto; margin-top: 24px; }
  .fd-est-sf-b { display: none; }
  .fd-est-ticker { margin-top: 24px; }
  .fd-est-right { min-height: 460px; }
  .fd-est-car { left: 16px; bottom: 16px; }
  .fd-est-card { width: 260px; }
  .fd-est-pin { font-size: 0.75rem; }
  .fd-est-map { inset: -6% 0 30% 0; }
  .fd-est-photo { height: 130px; }
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
