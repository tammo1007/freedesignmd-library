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

export function Demo() {
  const [paused, setPaused] = useState(false);
  const words = useMemo(() => WORDS, []);
  return (
    <div className="fd-tmd">
      <style>{demoCss}</style>
      <h2 className="fd-tmd-line">
        <span className="fd-tmd-pre">Built for</span>{" "}
        <TextMorph words={words} paused={paused} className="fd-tmd-word" />
      </h2>
      <button type="button" className="fd-tmd-btn" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
        {paused ? "Resume" : "Pause"}
      </button>
    </div>
  );
}

const demoCss = `
.fd-tmd,.fd-tmd *,.fd-tmd *::before,.fd-tmd *::after{box-sizing:border-box}
.fd-tmd{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f2f2f2;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
.fd-tmd-line{margin:0;padding:0;max-width:100%;text-align:center;color:#1d1d1f;font:600 clamp(36px,8vw,88px)/1.1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-.045em}
.fd-tmd-pre{display:inline-block;margin:0;padding:0;color:#86868b}
.fd-tmd-word{color:#1d1d1f}
@media (max-width:640px){.fd-tmd-pre{display:block}}
.fd-tmd-btn{appearance:none;-webkit-appearance:none;margin:0;height:34px;padding:0 16px;border:0;border-radius:9999px;background:rgba(0,0,0,.06);color:#3c3c43;font:500 13px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;cursor:pointer;transition:background-color 200ms}
.fd-tmd-btn:hover{background:rgba(0,0,0,.1)}
.fd-tmd-btn:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
`;
