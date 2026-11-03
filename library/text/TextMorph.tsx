/**
 * TextMorph, cycles through words and morphs between them letter by letter.
 * Letters shared by both words glide to their new positions; the rest blur
 * and fade out or in. The slot width eases with the letters, so a centred
 * line stays centred instead of jumping.
 *
 * Props
 * - words: string[]           Words or short phrases to cycle through.
 * - interval?: number          ms each word is held. Default 2600.
 * - index?: number             Controlled index (disables auto-cycling).
 * - paused?: boolean           Pause auto-cycling (also paused off-screen and on reduced motion).
 * - onIndexChange?: (i) => void
 * - className / style          Size it with font-size; the slot inherits typography.
 * CSS vars on root: --fd-tm-dur (default 560ms), --fd-tm-blur (default 8px).
 *
 * Accessibility: letters are aria-hidden; a visually hidden copy carries the
 * current word without a live region (no announcements every few seconds).
 * Give cycling heroes a pause control (WCAG 2.2.2), see the Demo.
 * Reduced motion: words swap with a 120ms cross-fade and don't auto-cycle.
 * Browser support: evergreen browsers (individual `translate` property:
 * Chrome 104, Safari 14.1, Firefox 72).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

type Glyph = { id: number; ch: string; x: number; state: "in" | "stay" | "out" };
type Metrics = { xs: number[][]; widths: number[] };

export interface TextMorphProps {
  words: string[];
  interval?: number;
  index?: number;
  paused?: boolean;
  onIndexChange?: (i: number) => void;
  className?: string;
  style?: CSSProperties;
}

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Pair each letter of `to` with an unused identical letter of `from`, preferring similar relative positions. */
function match(from: string, to: string) {
  const used = new Set<number>();
  const pairs: number[] = [];
  for (let j = 0; j < to.length; j++) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < from.length; i++) {
      if (used.has(i) || from[i] !== to[j] || to[j] === " ") continue;
      const d = Math.abs(i / Math.max(1, from.length) - j / Math.max(1, to.length));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) used.add(best);
    pairs.push(best);
  }
  return pairs;
}

export function TextMorph({ words, interval = 2600, index, paused, onIndexChange, className, style }: TextMorphProps) {
  const root = useRef<HTMLSpanElement>(null);
  const measurer = useRef<HTMLSpanElement>(null);
  const metrics = useRef<Metrics | null>(null);
  const [auto, setAuto] = useState(0);
  const cur = index ?? auto;
  const word = words[((cur % words.length) + words.length) % words.length] ?? "";
  const [glyphs, setGlyphs] = useState<Glyph[]>(() => Array.from(word).map((ch, i) => ({ id: i, ch, x: 0, state: "stay" as const })));
  const [width, setWidth] = useState<number | null>(null);
  const prev = useRef({ word, glyphs });
  const nextId = useRef(1000);
  const visible = useRef(true);
  const autoRef = useRef(0);
  const cbRef = useRef(onIndexChange);
  cbRef.current = onIndexChange;

  const measure = () => {
    const m = measurer.current;
    if (!m) return;
    const rows = Array.from(m.children) as HTMLElement[];
    metrics.current = {
      xs: rows.map((r) => Array.from(r.children).map((c) => (c as HTMLElement).offsetLeft)),
      widths: rows.map((r) => r.offsetWidth),
    };
  };

  // initial + resize measurement; place current glyphs without animating
  useIso(() => {
    const el = root.current;
    if (!el) return;
    const place = () => {
      measure();
      const wi = words.indexOf(prev.current.word);
      const mt = metrics.current;
      if (!mt || wi < 0) return;
      el.setAttribute("data-snap", "");
      const g = Array.from(prev.current.word).map((ch, i) => ({ id: nextId.current++, ch, x: mt.xs[wi][i] ?? 0, state: "stay" as const }));
      prev.current.glyphs = g;
      setGlyphs(g);
      setWidth(mt.widths[wi]);
      requestAnimationFrame(() => requestAnimationFrame(() => el.removeAttribute("data-snap")));
    };
    place();
    const ro = new ResizeObserver(place);
    if (measurer.current) ro.observe(measurer.current);
    document.fonts?.ready.then(place).catch(() => {});
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words.join("|")]);

  // morph on word change
  useIso(() => {
    const from = prev.current;
    if (from.word === word) return;
    const mt = metrics.current;
    const wi = words.indexOf(word);
    if (!mt || wi < 0) return;
    const live = from.glyphs.filter((g) => g.state !== "out");
    const pairs = match(live.map((g) => g.ch).join(""), word);
    const taken = new Set<number>();
    const next: Glyph[] = Array.from(word).map((ch, j) => {
      const k = pairs[j];
      if (k >= 0) {
        taken.add(k);
        return { id: live[k].id, ch, x: mt.xs[wi][j], state: "stay" };
      }
      return { id: nextId.current++, ch, x: mt.xs[wi][j], state: "in" };
    });
    const leaving: Glyph[] = live.filter((_, k) => !taken.has(k)).map((g) => ({ ...g, state: "out" }));
    const all = [...next, ...leaving];
    prev.current = { word, glyphs: next };
    setGlyphs(all);
    setWidth(mt.widths[wi]);
    const t = window.setTimeout(() => setGlyphs((gs) => gs.filter((g) => g.state !== "out")), 640);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);

  // auto-cycle (uncontrolled), paused off-screen / hidden / reduced motion
  useEffect(() => {
    if (index !== undefined || paused || words.length < 2) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const el = root.current;
    let io: IntersectionObserver | null = null;
    if (el && "IntersectionObserver" in window) {
      io = new IntersectionObserver((es) => (visible.current = es.some((e) => e.isIntersecting)));
      io.observe(el);
    }
    const id = window.setInterval(() => {
      if (!visible.current || document.hidden) return;
      autoRef.current = (autoRef.current + 1) % words.length;
      setAuto(autoRef.current);
      cbRef.current?.(autoRef.current);
    }, interval);
    return () => {
      window.clearInterval(id);
      io?.disconnect();
    };
  }, [index, paused, interval, words.length]);

  return (
    <span
      ref={root}
      className={`fd-tm${className ? " " + className : ""}`}
      data-ready={width == null ? undefined : ""}
      style={{ ...style, width: width == null ? undefined : `${width}px` }}
    >
      <style>{css}</style>
      <span className="fd-tm-sr">{word}</span>
      <span className="fd-tm-measure" ref={measurer} aria-hidden="true">
        {words.map((w, i) => (
          <span key={i} className="fd-tm-mrow">
            {Array.from(w).map((ch, j) => (
              <span key={j} className="fd-tm-mch">{ch}</span>
            ))}
          </span>
        ))}
      </span>
      <span className="fd-tm-ghost" aria-hidden="true">{word}</span>
      <span className="fd-tm-stage" aria-hidden="true">
        {glyphs.map((g) => (
          <span key={g.id} className="fd-tm-g" data-state={g.state} style={{ translate: `${g.x}px 0` }}>
            {g.ch === " " ? " " : g.ch}
          </span>
        ))}
      </span>
    </span>
  );
}

const css = `
.fd-tm,.fd-tm *,.fd-tm *::before,.fd-tm *::after{box-sizing:border-box}
.fd-tm{--fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-tm-dur:560ms;--fd-tm-blur:8px;
  position:relative;display:inline-block;vertical-align:baseline;margin:0;padding:0;white-space:nowrap;
  transition:width var(--fd-tm-dur) var(--fd-ease-in-out)}
.fd-tm[data-snap],.fd-tm[data-snap] *{transition:none!important;animation:none!important}
.fd-tm-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.fd-tm-measure{position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;margin:0;padding:0;white-space:pre}
.fd-tm-mrow{position:absolute;left:0;top:0;display:inline-block;margin:0;padding:0;white-space:pre}
.fd-tm-mch{display:inline;margin:0;padding:0}
.fd-tm-ghost{display:inline-block;visibility:hidden;width:0;margin:0;padding:0;white-space:pre}
.fd-tm:not([data-ready]) .fd-tm-ghost{visibility:visible;width:auto}
.fd-tm:not([data-ready]) .fd-tm-stage{visibility:hidden}
.fd-tm-stage{position:absolute;left:0;top:0;bottom:0;display:block;margin:0;padding:0}
.fd-tm-g{position:absolute;left:0;top:0;display:inline-block;margin:0;padding:0;white-space:pre;will-change:translate,opacity,filter;
  transition:translate var(--fd-tm-dur) var(--fd-ease-in-out),opacity var(--fd-tm-dur) var(--fd-ease-out),filter var(--fd-tm-dur) var(--fd-ease-out)}
.fd-tm-g[data-state="in"]{animation:fd-tm-in var(--fd-tm-dur) var(--fd-ease-out) calc(var(--fd-tm-dur) * .28) both}
.fd-tm-g[data-state="out"]{animation:fd-tm-out calc(var(--fd-tm-dur) * .7) var(--fd-ease-out) both;pointer-events:none}
@keyframes fd-tm-in{from{opacity:0;filter:blur(var(--fd-tm-blur));transform:translate3d(0,.22em,0) scale(.92)}to{opacity:1;filter:blur(0);transform:none}}
@keyframes fd-tm-out{from{opacity:1;filter:blur(0);transform:none}to{opacity:0;filter:blur(var(--fd-tm-blur));transform:translate3d(0,-.18em,0) scale(.94)}}
@media (prefers-reduced-motion:reduce){
  .fd-tm,.fd-tm-g{transition:none}
  .fd-tm-g[data-state="in"]{animation:fd-tm-fade 120ms linear both}
  .fd-tm-g[data-state="out"]{animation:none;opacity:0}
}
@keyframes fd-tm-fade{from{opacity:0}to{opacity:1}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const WORDS = ["founders", "agents", "teams", "everyone"];
const SUBS = [
  "Ship a coherent product from the first pitch deck to the hundredth screen.",
  "A machine-readable DESIGN.md your coding agents follow to the pixel.",
  "One source of truth for tokens, components and the decisions behind them.",
  "Free, MIT-licensed and portable, bring it to any stack you like.",
];

const DOC = [
  { h: "Brand", lines: ["name      Primer", "voice     plain, specific, no hype", "stage     pitch deck to hundredth screen"] },
  { h: "Tokens", lines: ["--accent        #FF5B2E", "--radius        10px", "--font-display  Inter Display 600"] },
  { h: "Components", lines: ["Button   radius 10, height 44", "Card     1px border, no shadow", "Input    focus ring 2px accent"] },
  { h: "License", lines: ["MIT, free to copy, remix and ship", "no account, no attribution"] },
];

export function Demo() {
  const [paused, setPaused] = useState(false);
  const [i, setI] = useState(0);
  const words = useMemo(() => WORDS, []);
  return (
    <div className="fd-tm-demo">
      <style>{demoCss}</style>
      <header className="fd-tm-demo-bar">
        <span className="fd-tm-demo-brand">Primer</span>
        <nav className="fd-tm-demo-nav" aria-label="Primary">
          <a href="#product">Product</a><a href="#agents">For agents</a><a href="#pricing">Pricing</a><a href="#changelog">Changelog</a>
        </nav>
        <a className="fd-tm-demo-sign" href="#signin">Sign in</a>
      </header>
      <main className="fd-tm-demo-main">
        <div className="fd-tm-demo-copy">
          <a className="fd-tm-demo-pill" href="#launch">
            Primer 2.0: tokens that sync to Figma and your repo
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </a>
          <h1 className="fd-tm-demo-h1">
            <span className="fd-tm-demo-pre">Design for</span>{" "}
            <TextMorph words={words} paused={paused} onIndexChange={setI} className="fd-tm-demo-word" />
          </h1>
          <p className="fd-tm-demo-sub" key={i}>{SUBS[i]}</p>
          <div className="fd-tm-demo-cta">
            <a className="fd-tm-demo-btn" href="#start">Start free</a>
            <a className="fd-tm-demo-btn fd-tm-demo-btn--ghost" href="#demo">Book a 20-min demo</a>
          </div>
          <button type="button" className="fd-tm-demo-pause" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1.5" y="1" width="2.4" height="8" rx=".6" fill="currentColor" /><rect x="6.1" y="1" width="2.4" height="8" rx=".6" fill="currentColor" /></svg>
            )}
            {paused ? "Resume" : "Pause"} animation
          </button>
        </div>
        <figure className="fd-tm-demo-doc" aria-label="DESIGN.md excerpt">
          <figcaption className="fd-tm-demo-docbar"><span>DESIGN.md</span><span>4 sections</span></figcaption>
          <div className="fd-tm-demo-docbody">
            {DOC.map((sec, k) => (
              <section key={sec.h} className="fd-tm-demo-sec" data-on={k === i ? "" : undefined}>
                <h2># {sec.h}</h2>
                <pre>{sec.lines.join("\n")}</pre>
              </section>
            ))}
          </div>
        </figure>
      </main>
    </div>
  );
}

const demoCss = `
.fd-tm-demo,.fd-tm-demo *,.fd-tm-demo *::before,.fd-tm-demo *::after{box-sizing:border-box}
.fd-tm-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --d-disp:"SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;
  --d-ink:#16151A;--d-mut:#6B6A72;--d-line:rgba(22,21,26,.1);--d-acc:#FF5B2E;
  position:relative;overflow:hidden;margin:0;padding:0;min-height:100vh;background:#F6F4EF;color:var(--d-ink);font:400 15px/1.5 var(--d-font);-webkit-font-smoothing:antialiased}
.fd-tm-demo-bar{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0;padding:20px clamp(16px,4vw,48px)}
.fd-tm-demo-brand{display:inline-flex;align-items:center;gap:10px;margin:0;font:600 17px/1 var(--d-disp);letter-spacing:-.01em}
.fd-tm-demo-brand svg{display:block}
.fd-tm-demo-nav{display:flex;gap:28px;margin:0;padding:0}
.fd-tm-demo-nav a,.fd-tm-demo-sign{margin:0;padding:6px 0;font:400 15px/1 var(--d-font);color:var(--d-mut);text-decoration:none}
.fd-tm-demo-nav a:hover,.fd-tm-demo-sign:hover{color:var(--d-ink)}
.fd-tm-demo-main{position:relative;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);align-items:center;gap:clamp(24px,5vw,72px);margin:0 auto;padding:clamp(40px,9vh,96px) clamp(16px,4vw,48px) 48px;max-width:1280px;text-align:left}
.fd-tm-demo-copy{display:flex;flex-direction:column;align-items:flex-start;min-width:0}
.fd-tm-demo-pill{display:inline-flex;align-items:center;gap:8px;margin:0;padding:0;color:var(--d-mut);font:500 14px/1.2 var(--d-font);text-decoration:none}
.fd-tm-demo-pill:hover{color:var(--d-ink)}
.fd-tm-demo-pill svg{display:block;flex:none}
.fd-tm-demo-h1{margin:24px 0 0;padding:0;color:var(--d-ink);font:600 clamp(44px,6.4vw,92px)/1 var(--d-disp);letter-spacing:-.05em;text-wrap:balance}
.fd-tm-demo-pre{display:inline-block;margin:0;padding:0}
.fd-tm-demo-word{color:var(--d-acc);font-style:italic;font-weight:600;font-family:ui-serif,"New York","Iowan Old Style",Georgia,serif;letter-spacing:-.04em;padding-right:.04em}
.fd-tm-demo-sub{margin:24px 0 0;max-width:28em;min-height:3em;color:var(--d-mut);font:400 clamp(17px,1.6vw,20px)/1.45 var(--d-font);letter-spacing:-.01em;text-wrap:pretty;
  animation:fd-tm-demo-sub 560ms cubic-bezier(.22,1,.36,1) both}
@keyframes fd-tm-demo-sub{from{opacity:0;transform:translate3d(0,6px,0)}to{opacity:1;transform:none}}
.fd-tm-demo-cta{display:flex;flex-wrap:wrap;justify-content:flex-start;gap:12px;margin:32px 0 0}
.fd-tm-demo-btn{display:inline-flex;align-items:center;height:48px;margin:0;padding:0 24px;border-radius:9999px;background:var(--d-ink);color:#F6F4EF;
  font:500 15px/1 var(--d-font);text-decoration:none;transition:transform 120ms cubic-bezier(.22,1,.36,1)}
.fd-tm-demo-btn:active{transform:scale(.96);transition-timing-function:cubic-bezier(.34,1.56,.64,1)}
.fd-tm-demo-btn--ghost{background:transparent;color:var(--d-ink);box-shadow:0 0 0 1px var(--d-line)}
.fd-tm-demo-pause{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;gap:8px;margin:24px 0 0 -12px;height:30px;padding:0 12px;border:0;border-radius:9999px;
  background:transparent;color:var(--d-mut);font:500 12px/1 var(--d-font);cursor:pointer}
.fd-tm-demo-pause:hover{color:var(--d-ink);background:rgba(22,21,26,.05)}
.fd-tm-demo-pause svg{display:block}
.fd-tm-demo a:focus-visible,.fd-tm-demo button:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px}
.fd-tm-demo-doc{margin:0;min-width:0;border-radius:14px;background:#FCFBF8;box-shadow:0 0 0 1px var(--d-line),0 24px 48px -32px rgba(22,21,26,.35);overflow:hidden}
.fd-tm-demo-docbar{display:flex;justify-content:space-between;margin:0;padding:12px 18px;border-bottom:1px solid var(--d-line);color:var(--d-mut);font:500 12px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace}
.fd-tm-demo-docbody{display:flex;flex-direction:column;margin:0;padding:8px 0}
.fd-tm-demo-sec{position:relative;margin:0;padding:14px 18px 14px 22px;color:rgba(22,21,26,.42);transition:color 240ms cubic-bezier(.65,0,.35,1),background-color 240ms cubic-bezier(.65,0,.35,1)}
.fd-tm-demo-sec::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:2px;background:var(--d-acc);opacity:0;transition:opacity 240ms cubic-bezier(.65,0,.35,1)}
.fd-tm-demo-sec[data-on]{color:var(--d-ink);background:rgba(22,21,26,.03)}
.fd-tm-demo-sec[data-on]::before{opacity:1}
.fd-tm-demo-sec h2{margin:0 0 6px;padding:0;font:600 13px/1.4 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:0;color:inherit}
.fd-tm-demo-sec pre{margin:0;padding:0;background:none;border:0;font:400 13px/1.7 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:0;color:inherit;white-space:pre-wrap}
@media (max-width:860px){.fd-tm-demo-nav{display:none}.fd-tm-demo-main{grid-template-columns:minmax(0,1fr)}.fd-tm-demo-h1{font-size:clamp(40px,12vw,64px)}.fd-tm-demo-pre{display:block}}
@media (prefers-reduced-motion:reduce){.fd-tm-demo-sec,.fd-tm-demo-sec::before{transition:none}}
`;
