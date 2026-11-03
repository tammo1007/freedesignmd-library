/**
 * HeroTypeOnly: a purely typographic hero for a type foundry release. No
 * images. A giant specimen word whose letters swell in weight under the
 * pointer (font-weight interpolation, continuous on variable system fonts
 * such as SF Pro, stepped on static families), a weight ruler that tracks the
 * pointer, a live axis readout and a specimen grid of family metadata set on
 * hairline rules. Strictly black and white.
 *
 * Props: word (specimen word), release, family, meta (label/value pairs),
 * sample (pangram line), price, nav, onTrial.
 * CSS vars: --fd-tyo-ink, --fd-tyo-paper, --fd-tyo-size.
 *
 * Browser support: all evergreen browsers. Pointer Events (mouse, pen and
 * touch drag across the word). When idle the weight sweeps slowly by itself.
 * Motion: one rAF loop eases the pointer with a spring (k 380, c 30), paused
 * off-screen and in hidden tabs. prefers-reduced-motion shows a static
 * 100 to 900 weight ramp across the word and no idle sweep.
 * Accessibility: the word is a real heading with an aria-label; per-letter
 * spans are aria-hidden. The weight ruler is decorative; the readout is text.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface HeroTypeOnlyMeta {
  label: string;
  value: ReactNode;
}

export interface HeroTypeOnlyProps {
  word?: string;
  release?: string;
  family?: string;
  meta?: HeroTypeOnlyMeta[];
  sample?: string;
  price?: string;
  nav?: { label: string; href: string }[];
  trialHref?: string;
  buyHref?: string;
}

const DEFAULT_META: HeroTypeOnlyMeta[] = [
  { label: "Family", value: "Brume Grotesk" },
  { label: "Styles", value: "18, nine weights with italics" },
  { label: "Axes", value: "wght 100 to 900, opsz 8 to 144" },
  { label: "Glyphs", value: "1,214 per style" },
  { label: "Scripts", value: "Latin, Cyrillic, Greek, 219 languages" },
  { label: "Drawn by", value: "Ines Vogt, Basel, 2023 to 2026" },
];

const DEFAULT_NAV = [
  { label: "Typefaces", href: "#typefaces" },
  { label: "Trials", href: "#trials" },
  { label: "Licensing", href: "#licensing" },
  { label: "Journal", href: "#journal" },
];

const W_MIN = 100;
const W_MAX = 900;

export function HeroTypeOnly({
  word = "Brume",
  release = "Release No. 14",
  family = "Brume Grotesk",
  meta = DEFAULT_META,
  sample = "Fog lifts off the Rhine at 07:40; the 8 tram to Kleinhüningen is quietly, reliably late.",
  price = "Family from CHF 480",
  nav = DEFAULT_NAV,
  trialHref = "#trial",
  buyHref = "#buy",
}: HeroTypeOnlyProps) {
  const letters = Array.from(word);
  const rootRef = useRef<HTMLElement>(null);
  const wordRef = useRef<HTMLHeadingElement>(null);
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const markRef = useRef<HTMLSpanElement>(null);
  const [readout, setReadout] = useState({ w: 500, x: 0.5, live: false });
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const wordEl = wordRef.current;
    if (!root || !wordEl) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spans = spanRefs.current;
    const n = letters.length;

    if (reduce) {
      spans.forEach((s, i) => {
        if (!s) return;
        const w = Math.round(W_MIN + ((W_MAX - W_MIN) * i) / Math.max(1, n - 1));
        s.style.fontWeight = String(w);
      });
      return;
    }

    // letter centres as fractions of the word width, measured at rest
    let centres: number[] = [];
    const measure = () => {
      const r = wordEl.getBoundingClientRect();
      centres = spans.map((s) => {
        if (!s || r.width === 0) return 0.5;
        const b = s.getBoundingClientRect();
        return (b.left + b.width / 2 - r.left) / r.width;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wordEl);

    let target = 0.5;
    let pos = 0.5;
    let vel = 0;
    let lastMove = -1e9;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let lastReport = 0;
    const t0 = last;

    const onMove = (e: PointerEvent) => {
      const r = wordEl.getBoundingClientRect();
      if (r.width === 0) return;
      target = Math.min(1.08, Math.max(-0.08, (e.clientX - r.left) / r.width));
      lastMove = performance.now();
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onMove);

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const idle = now - lastMove > 2600;
      if (idle) target = 0.5 + 0.56 * Math.sin((now - t0) / 2400);
      // spring k 380, c 30 (softer when idle)
      const k = idle ? 60 : 380;
      const c = idle ? 16 : 30;
      vel += (k * (target - pos) - c * vel) * dt;
      pos += vel * dt;

      const sigma = 0.2;
      let focusW = W_MIN;
      for (let i = 0; i < n; i++) {
        const s = spans[i];
        if (!s) continue;
        const d = (centres[i] ?? 0.5) - pos;
        const f = Math.exp(-(d * d) / (2 * sigma * sigma));
        const w = W_MIN + (W_MAX - W_MIN) * f;
        s.style.fontWeight = w.toFixed(0);
        if (w > focusW) focusW = w;
      }
      const mark = markRef.current;
      const clamped = Math.min(1, Math.max(0, pos));
      if (mark) mark.style.transform = `translateX(${(clamped * 100).toFixed(2)}cqw)`;
      if (now - lastReport > 90) {
        lastReport = now;
        setReadout({ w: Math.round(focusW), x: clamped, live: !idle });
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
    io.observe(root);
    const onVis = () => start();
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onMove);
    };
  }, [word]); // eslint-disable-line react-hooks/exhaustive-deps

  const ticks = [100, 200, 300, 400, 500, 600, 700, 800, 900];

  return (
    <section ref={rootRef} className="fd-tyo" aria-labelledby="fd-tyo-word">
      <style>{css}</style>
      <header className="fd-tyo-nav">
        <a className="fd-tyo-logo" href="#top" aria-label="Kessler and Vogt, home">
          <span className="fd-tyo-logo-k">K</span>
          <span className="fd-tyo-logo-amp">&amp;</span>
          <span className="fd-tyo-logo-v">V</span>
          <span className="fd-tyo-logo-word">Kessler &amp; Vogt<br />Type Foundry, Basel</span>
        </a>
        <nav className={`fd-tyo-links${menu ? " is-open" : ""}`} aria-label="Primary" id="fd-tyo-menu">
          {nav.map((l, i) => (
            <a key={l.href} href={l.href} className="fd-tyo-link">
              <span className="fd-tyo-link-n">{String(i + 1).padStart(2, "0")}</span>
              {l.label}
            </a>
          ))}
        </nav>
        <a className="fd-tyo-cart" href="#cart">Cart (0)</a>
        <button
          type="button"
          className="fd-tyo-burger"
          aria-expanded={menu}
          aria-controls="fd-tyo-menu"
          onClick={() => setMenu((m) => !m)}
        >
          {menu ? "Close" : "Menu"}
        </button>
      </header>

      <div className="fd-tyo-strip">
        <p className="fd-tyo-release">
          <span className="fd-tyo-dot" aria-hidden="true" />
          {release}
          <span className="fd-tyo-sep">/</span>
          Out 11.11.2026
        </p>
        <p className="fd-tyo-readout" aria-live="off">
          <span>wght</span>
          <b>{String(readout.w).padStart(3, "0")}</b>
          <span>x</span>
          <b>{readout.x.toFixed(2)}</b>
          <span className="fd-tyo-state">{readout.live ? "pointer" : "auto"}</span>
        </p>
      </div>

      <h1 ref={wordRef} id="fd-tyo-word" className="fd-tyo-word" aria-label={`${word}, a new typeface by Kessler and Vogt`}>
        {letters.map((ch, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="fd-tyo-ch"
            ref={(el) => {
              spanRefs.current[i] = el;
            }}
          >
            {ch}
          </span>
        ))}
      </h1>

      <div className="fd-tyo-ruler" aria-hidden="true">
        <div className="fd-tyo-ruler-track">
          {ticks.map((t) => (
            <span key={t} className={`fd-tyo-tick${t === 900 ? " is-end" : ""}`}>
              <i />
              {t}
            </span>
          ))}
          <span ref={markRef} className="fd-tyo-mark" />
        </div>
      </div>

      <dl className="fd-tyo-meta">
        {meta.map((m, i) => (
          <div key={m.label} className="fd-tyo-cell">
            <dt className="fd-tyo-dt">
              <span>{String(i + 1).padStart(2, "0")}</span>
              {m.label}
            </dt>
            <dd className="fd-tyo-dd">{m.value}</dd>
          </div>
        ))}
      </dl>

      <div className="fd-tyo-foot">
        <p className="fd-tyo-sample">
          <span className="fd-tyo-sample-tag">{family} Book, 32/36</span>
          {sample}
        </p>
        <div className="fd-tyo-actions">
          <p className="fd-tyo-price">{price}<br />Desktop, web and app licences</p>
          <a className="fd-tyo-btn fd-tyo-btn-solid" href={buyHref}>
            Buy the family
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          </a>
          <a className="fd-tyo-btn" href={trialHref}>Free trial fonts</a>
        </div>
      </div>
    </section>
  );
}

const css = `
.fd-tyo, .fd-tyo *, .fd-tyo *::before, .fd-tyo *::after { box-sizing: border-box; }
.fd-tyo :where(h1, p, a, dl, dt, dd, div, span, b, i, nav, header, button) {
  margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit;
  letter-spacing: inherit; text-decoration: none; text-transform: none;
}
.fd-tyo {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-tyo-ink: #0A0A0A;
  --fd-tyo-paper: #FFFFFF;
  --fd-tyo-size: clamp(120px, 31vw, 470px);
  --fd-tyo-sans: "SF Pro Display", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  --fd-tyo-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --fd-tyo-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
  position: relative; display: flex; flex-direction: column; margin: 0; padding: 0 40px 36px;
  min-height: 880px; background: var(--fd-tyo-paper); color: var(--fd-tyo-ink);
  font: 400 15px/1.4 var(--fd-tyo-sans); letter-spacing: 0; overflow: hidden;
  touch-action: pan-y;
}

/* nav */
.fd-tyo-nav {
  position: relative; z-index: 3; display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 40px;
  padding: 22px 0 20px; border-bottom: 1px solid var(--fd-tyo-ink);
}
.fd-tyo-logo { display: inline-flex; align-items: center; gap: 0; color: var(--fd-tyo-ink); text-decoration: none; }
.fd-tyo-logo-k, .fd-tyo-logo-v { font: 800 28px/1 var(--fd-tyo-sans); letter-spacing: -0.04em; }
.fd-tyo-logo-amp { font: italic 400 30px/1 var(--fd-tyo-serif); margin: 0 1px; transform: translateY(1px); display: inline-block; }
.fd-tyo-logo-word {
  margin-left: 14px; padding-left: 14px; border-left: 1px solid var(--fd-tyo-ink);
  font: 500 12px/1.25 var(--fd-tyo-mono); letter-spacing: 0.02em; text-transform: uppercase;
}
.fd-tyo-links { display: flex; gap: 28px; }
.fd-tyo-link { position: relative; display: inline-flex; align-items: baseline; gap: 6px; font: 500 15px/1.2 var(--fd-tyo-sans); color: var(--fd-tyo-ink); text-decoration: none; }
.fd-tyo-link-n { font: 400 11px/1 var(--fd-tyo-mono); }
.fd-tyo-link::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -4px; height: 1px; background: currentColor;
  transform: scaleX(0); transform-origin: right; transition: transform var(--fd-dur-2) var(--fd-ease-out);
}
.fd-tyo-link:hover::after { transform: scaleX(1); transform-origin: left; }
.fd-tyo-cart { font: 500 13px/1 var(--fd-tyo-mono); padding: 10px 14px; border: 1px solid var(--fd-tyo-ink); border-radius: 9999px; color: var(--fd-tyo-ink); transition: background var(--fd-dur-1), color var(--fd-dur-1); }
.fd-tyo-cart:hover { background: var(--fd-tyo-ink); color: var(--fd-tyo-paper); }
.fd-tyo-burger { display: none; appearance: none; cursor: pointer; font: 500 13px/1 var(--fd-tyo-mono); padding: 10px 14px; border: 1px solid var(--fd-tyo-ink); border-radius: 9999px; color: var(--fd-tyo-ink); background: var(--fd-tyo-paper); }

/* strip */
.fd-tyo-strip { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 0 0; }
.fd-tyo-release, .fd-tyo-readout { display: flex; align-items: center; gap: 10px; font: 500 12px/1.2 var(--fd-tyo-mono); letter-spacing: 0.04em; text-transform: uppercase; }
.fd-tyo-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fd-tyo-ink); display: inline-block; }
.fd-tyo-sep { opacity: 0.4; }
.fd-tyo-readout b { font-weight: 700; min-width: 3.4ch; display: inline-block; font-variant-numeric: tabular-nums; }
.fd-tyo-state { padding: 3px 7px; border: 1px solid var(--fd-tyo-ink); border-radius: 9999px; font-size: 10px; }

/* word */
.fd-tyo-word {
  display: flex; justify-content: flex-start; align-items: baseline; margin: 0 0 0 -0.04em; padding: 0;
  font: 400 var(--fd-tyo-size)/0.86 var(--fd-tyo-sans); letter-spacing: -0.035em; color: var(--fd-tyo-ink);
  white-space: nowrap; user-select: none; cursor: ew-resize; flex: 1 0 auto; align-content: center;
  padding-top: clamp(16px, 4vw, 40px);
}
.fd-tyo-ch { display: inline-block; font-weight: 400; font-variation-settings: normal; }

/* ruler */
.fd-tyo-ruler { margin-top: clamp(14px, 2vw, 26px); border-top: 1px solid var(--fd-tyo-ink); container-type: inline-size; }
.fd-tyo-ruler-track { position: relative; display: flex; justify-content: space-between; height: 34px; }
.fd-tyo-tick { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; font: 400 10px/1 var(--fd-tyo-mono); width: 0; overflow: visible; white-space: nowrap; }
.fd-tyo-tick i { display: block; width: 1px; height: 8px; background: var(--fd-tyo-ink); }
.fd-tyo-tick.is-end { align-items: flex-end; width: auto; }
.fd-tyo-mark {
  position: absolute; left: 0; top: -5px; width: 0; height: 0;
  border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 7px solid var(--fd-tyo-ink);
  margin-left: -5px; transform: translateX(50cqw);
}

/* meta */
.fd-tyo-meta { display: grid; grid-template-columns: repeat(6, 1fr); border-top: 1px solid var(--fd-tyo-ink); border-bottom: 1px solid var(--fd-tyo-ink); margin: 6px 0 0; }
.fd-tyo-cell { padding: 14px 16px 16px 0; border-right: 1px solid var(--fd-tyo-ink); margin-right: 16px; }
.fd-tyo-cell:last-child { border-right: 0; margin-right: 0; }
.fd-tyo-dt { display: flex; gap: 8px; font: 500 11px/1.2 var(--fd-tyo-mono); letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 10px; }
.fd-tyo-dt span { opacity: 0.45; }
.fd-tyo-dd { font: 400 15px/1.35 var(--fd-tyo-sans); letter-spacing: -0.005em; }

/* foot */
.fd-tyo-foot { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 40px; padding-top: 26px; }
.fd-tyo-sample { font: 400 clamp(1.375rem, 2.3vw, 2rem)/1.12 var(--fd-tyo-sans); letter-spacing: -0.02em; max-width: 30ch; }
.fd-tyo-sample-tag { display: block; font: 500 11px/1 var(--fd-tyo-mono); letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 12px; }
.fd-tyo-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
.fd-tyo-price { font: 400 12px/1.4 var(--fd-tyo-mono); margin-right: 12px; text-align: right; }
.fd-tyo-btn {
  display: inline-flex; align-items: center; gap: 10px; height: 48px; padding: 0 22px; border-radius: 9999px;
  border: 1px solid var(--fd-tyo-ink); color: var(--fd-tyo-ink); background: var(--fd-tyo-paper);
  font: 600 15px/1 var(--fd-tyo-sans); text-decoration: none; white-space: nowrap;
  transition: background var(--fd-dur-1), color var(--fd-dur-1), transform var(--fd-dur-2) var(--fd-spring);
}
.fd-tyo-btn svg { display: block; transition: transform var(--fd-dur-2) var(--fd-ease-out); }
.fd-tyo-btn:hover { background: var(--fd-tyo-ink); color: var(--fd-tyo-paper); }
.fd-tyo-btn:hover svg { transform: translateX(3px); }
.fd-tyo-btn:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-tyo-btn-solid { background: var(--fd-tyo-ink); color: var(--fd-tyo-paper); }
.fd-tyo-btn-solid:hover { background: var(--fd-tyo-paper); color: var(--fd-tyo-ink); }
.fd-tyo :focus-visible { outline: 2px solid var(--fd-tyo-ink); outline-offset: 3px; }

@media (max-width: 1100px) {
  .fd-tyo-meta { grid-template-columns: repeat(3, 1fr); }
  .fd-tyo-cell:nth-child(3n) { border-right: 0; margin-right: 0; }
  .fd-tyo-cell:nth-child(-n + 3) { border-bottom: 1px solid var(--fd-tyo-ink); }
}
@media (max-width: 760px) {
  .fd-tyo { padding: 0 16px 24px; min-height: 0; --fd-tyo-size: 26vw; }
  .fd-tyo-nav { grid-template-columns: 1fr auto; gap: 12px; padding: 16px 0; }
  .fd-tyo-logo-word { font-size: 10px; margin-left: 10px; padding-left: 10px; }
  .fd-tyo-cart { display: none; }
  .fd-tyo-burger { display: inline-block; }
  .fd-tyo-links {
    display: none; position: absolute; left: 0; right: 0; top: 100%; flex-direction: column; gap: 0;
    background: var(--fd-tyo-paper); border-bottom: 1px solid var(--fd-tyo-ink);
  }
  .fd-tyo-links.is-open { display: flex; }
  .fd-tyo-link { padding: 16px 0; border-top: 1px solid var(--fd-tyo-ink); font-size: 24px; letter-spacing: -0.02em; gap: 12px; }
  .fd-tyo-link::after { display: none; }
  .fd-tyo-strip { flex-direction: column; align-items: flex-start; gap: 8px; }
  .fd-tyo-word { padding-top: 28px; padding-bottom: 6px; flex: 0 0 auto; }
  .fd-tyo-tick { font-size: 9px; }
  .fd-tyo-tick:nth-child(even) { color: transparent; }
  .fd-tyo-meta { grid-template-columns: 1fr 1fr; }
  .fd-tyo-cell, .fd-tyo-cell:nth-child(3n) { border-right: 0; margin-right: 0; border-bottom: 1px solid var(--fd-tyo-ink); padding: 12px 12px 12px 0; }
  .fd-tyo-cell:nth-child(odd) { border-right: 1px solid var(--fd-tyo-ink); margin-right: 12px; }
  .fd-tyo-cell:nth-last-child(-n + 2) { border-bottom: 0; }
  .fd-tyo-dd { font-size: 14px; }
  .fd-tyo-foot { grid-template-columns: 1fr; gap: 22px; padding-top: 22px; }
  .fd-tyo-actions { justify-content: flex-start; }
  .fd-tyo-price { text-align: left; width: 100%; margin: 0; }
  .fd-tyo-btn { flex: 1 1 auto; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-tyo-link::after, .fd-tyo-btn, .fd-tyo-btn svg { transition: none; }
}
`;

export function Demo() {
  return <HeroTypeOnly />;
}
