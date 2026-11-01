/**
 * SplitText — splits a string into characters, words or lines and plays an
 * entrance preset across the pieces.
 *
 * Presets
 * - "rise"       pieces slide up out of a clipping mask (per word).
 * - "wave"       a crest travels through the text: each piece lifts, overshoots, settles.
 * - "scatter"    pieces fly in from deterministic random offsets and rotations.
 * - "blur"       pieces sharpen from a soft blur while drifting up.
 * - "typewriter" characters appear one by one with human timing (bursts within
 *                words, pauses after punctuation, the odd hesitation) and a caret.
 *
 * Props
 * - text: string                 The content. Always the accessible text.
 * - as?: "h1"…"h6" | "p" | "span" | "div"   Element. Default "h2".
 * - split?: "chars" | "words" | "lines"    Default "chars" ("typewriter" always uses chars).
 * - preset?: see above. Default "rise".
 * - trigger?: "view" | "mount" | "manual". Default "view" (35% visible, once).
 * - replay?: number | string     Change it to replay (on-demand trigger).
 * - stagger?: number             ms between pieces. Defaults per split: 22 / 70 / 140.
 * - duration?: number            ms per piece. Default 700 (--fd-dur-4).
 * - delay?: number               ms before the first piece. Default 0.
 * - cps?: number                 Typewriter speed in characters per second. Default 20.
 * - caret?: boolean              Typewriter caret. Default true.
 * - onDone?: () => void          Fires once the last piece has landed.
 * - ref?: { play(), reset() }    Imperative control (React 19 ref-as-prop).
 * CSS vars on root: --fd-st-caret (caret colour), --fd-st-blur (blur radius).
 * Typography: inherits nothing; defaults live in :where() so any class you
 * pass (font, size, colour) wins.
 *
 * Accessibility: headings carry aria-label with the full text; other tags get
 * a visually hidden copy. All pieces are aria-hidden. Reduced motion shows the
 * text immediately (the typewriter caret stays, without blinking).
 * Browser support: all evergreen browsers.
 */
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, Ref } from "react";

export type SplitPreset = "rise" | "wave" | "scatter" | "blur" | "typewriter";
export type SplitMode = "chars" | "words" | "lines";
export type SplitTextHandle = { play: () => void; reset: () => void };

export interface SplitTextProps {
  text: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div";
  split?: SplitMode;
  preset?: SplitPreset;
  trigger?: "view" | "mount" | "manual";
  replay?: number | string;
  stagger?: number;
  duration?: number;
  delay?: number;
  cps?: number;
  caret?: boolean;
  onDone?: () => void;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<SplitTextHandle>;
}

// deterministic 0..1 noise, SSR-safe
const hash = (i: number, s: number) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Human-ish keystroke schedule: returns cumulative ms per character. */
function typeSchedule(text: string, cps: number) {
  const base = 1000 / cps;
  const out: number[] = [];
  let t = 0;
  let burst = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const prev = text[i - 1] ?? "";
    let d = base * (0.45 + hash(i, 3) * 0.9);
    if (burst > 0) {
      d *= 0.55; // fingers already moving: quick run inside a word
      burst--;
    } else if (hash(i, 9) > 0.72) burst = 2 + Math.floor(hash(i, 4) * 4);
    if (prev === " ") d += base * 0.35 * hash(i, 5);
    if (/[,;:]/.test(prev)) d += base * (2.2 + hash(i, 6) * 1.5);
    if (/[.!?—–]/.test(prev)) d += base * (4 + hash(i, 7) * 3);
    if (hash(i, 8) > 0.965) d += base * (3 + hash(i, 2) * 4); // the hesitation
    if (c === " ") d *= 0.7;
    t += i === 0 ? 0 : d;
    out.push(Math.round(t));
  }
  return out;
}

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

export function SplitText({
  text,
  as = "h2",
  split = "chars",
  preset = "rise",
  trigger = "view",
  replay,
  stagger,
  duration = 700,
  delay = 0,
  cps = 20,
  caret = true,
  onDone,
  className,
  style,
  ref,
}: SplitTextProps) {
  const root = useRef<HTMLElement>(null);
  const timers = useRef<number[]>([]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const mode: SplitMode = preset === "typewriter" ? "chars" : split;
  const step = stagger ?? (mode === "chars" ? 22 : mode === "words" ? 70 : 140);

  // words → chars, keeping a global char index for staggering
  const words = useMemo(() => {
    let ci = 0;
    return text.split(/(\s+)/).filter(Boolean).map((w) => {
      const space = /^\s+$/.test(w);
      const chars = Array.from(w).map((ch) => ({ ch, i: ci++ }));
      return { w, space, chars };
    });
  }, [text]);
  const total = useMemo(() => words.reduce((n, w) => n + w.chars.length, 0), [words]);
  const wordCount = useMemo(() => words.filter((w) => !w.space).length, [words]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // line indices for split="lines": measured, written straight to the DOM
  useIso(() => {
    const el = root.current;
    if (!el || mode !== "lines") return;
    const measure = () => {
      const ws = el.querySelectorAll<HTMLElement>(".fd-st-w");
      let line = -1;
      let lastTop = -Infinity;
      ws.forEach((w) => {
        const top = w.offsetTop;
        if (top > lastTop + 2) {
          line++;
          lastTop = top;
        }
        w.style.setProperty("--fd-st-i", String(line));
      });
      el.style.setProperty("--fd-st-n", String(line + 1));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, text]);

  const runTypewriter = useCallback(() => {
    const el = root.current;
    if (!el) return;
    clear();
    const cs = Array.from(el.querySelectorAll<HTMLElement>(".fd-st-c"));
    cs.forEach((c) => {
      c.removeAttribute("data-on");
      c.removeAttribute("data-caret");
    });
    const lead = el.querySelector<HTMLElement>(".fd-st-lead");
    lead?.setAttribute("data-caret", "");
    el.setAttribute("data-typing", "");
    const sched = typeSchedule(text, cps);
    cs.forEach((c, i) => {
      timers.current.push(
        window.setTimeout(() => {
          c.setAttribute("data-on", "");
          (i === 0 ? lead : cs[i - 1])?.removeAttribute("data-caret");
          c.setAttribute("data-caret", "");
          if (i === cs.length - 1) {
            el.removeAttribute("data-typing");
            doneRef.current?.();
          }
        }, delay + sched[i]),
      );
    });
    // pause the blink while keys are moving; resume shortly after each key
  }, [text, cps, delay]);

  const play = useCallback(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    clear();
    if (reduced) {
      el.setAttribute("data-reduced", "");
      if (preset === "typewriter") {
        const cs = el.querySelectorAll<HTMLElement>(".fd-st-c");
        cs.forEach((c) => c.setAttribute("data-on", ""));
        el.querySelector(".fd-st-lead")?.removeAttribute("data-caret");
        cs[cs.length - 1]?.setAttribute("data-caret", "");
      }
      el.dataset.phase = "in";
      doneRef.current?.();
      return;
    }
    if (preset === "typewriter") {
      el.dataset.phase = "in";
      runTypewriter();
      return;
    }
    // restart: snap to idle without transitions, flush styles, then play
    el.setAttribute("data-snap", "");
    el.dataset.phase = "idle";
    void el.offsetWidth;
    el.removeAttribute("data-snap");
    void el.offsetWidth;
    el.dataset.phase = "in";
    const n = mode === "chars" ? total : mode === "words" ? wordCount : Number(getComputedStyle(el).getPropertyValue("--fd-st-n")) || 3;
    const spread = preset === "scatter" ? 260 : step * Math.max(0, n - 1);
    timers.current.push(window.setTimeout(() => doneRef.current?.(), delay + spread + duration + 60));
  }, [preset, mode, total, wordCount, step, duration, delay, runTypewriter]);

  const reset = useCallback(() => {
    const el = root.current;
    clear();
    if (!el) return;
    el.setAttribute("data-snap", "");
    el.dataset.phase = "idle";
    el.querySelectorAll(".fd-st-c").forEach((c) => {
      c.removeAttribute("data-on");
      c.removeAttribute("data-caret");
    });
    el.querySelector(".fd-st-lead")?.setAttribute("data-caret", "");
    requestAnimationFrame(() => el.removeAttribute("data-snap"));
  }, []);

  useImperativeHandle(ref, () => ({ play, reset }), [play, reset]);

  // triggers
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (trigger === "mount") {
      play();
      return clear;
    }
    if (trigger !== "view") return clear;
    if (!("IntersectionObserver" in window)) {
      play();
      return clear;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, text, preset, split]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay]);

  const Tag = as as "h2";
  const isHeading = HEADINGS.has(as);
  let wi = -1;

  return (
    <Tag
      ref={root as Ref<HTMLHeadingElement>}
      className={`fd-st${className ? " " + className : ""}`}
      data-preset={preset}
      data-split={mode}
      data-phase="idle"
      data-caret-on={preset === "typewriter" && caret ? "" : undefined}
      aria-label={isHeading ? text : undefined}
      style={{ ...style, ["--fd-st-dur" as string]: `${duration}ms`, ["--fd-st-step" as string]: `${step}ms`, ["--fd-st-delay" as string]: `${delay}ms` }}
    >
      <style>{css}</style>
      {!isHeading && <span className="fd-st-sr">{text}</span>}
      <span className="fd-st-inner" aria-hidden="true">
        {preset === "typewriter" && <span className="fd-st-lead" data-caret="" />}
        {words.map((w, k) => {
          if (w.space) {
            // spaces stay real text so lines wrap naturally; typewriter types them too
            return preset === "typewriter" ? (
              <span key={k} className="fd-st-c fd-st-sp">{w.w.replace(/\s+/g, " ")}</span>
            ) : (
              " "
            );
          }
          wi++;
          const pieces =
            mode === "chars"
              ? w.chars.map(({ ch, i }) => (
                  <span
                    key={i}
                    className="fd-st-c"
                    style={{
                      ["--fd-st-i" as string]: i,
                      ["--fd-st-x" as string]: `${((hash(i, 1) - 0.5) * 2.4).toFixed(3)}em`,
                      ["--fd-st-y" as string]: `${((hash(i, 2) - 0.5) * 1.8).toFixed(3)}em`,
                      ["--fd-st-r" as string]: `${((hash(i, 3) - 0.5) * 90).toFixed(1)}deg`,
                      ["--fd-st-j" as string]: hash(i, 4).toFixed(3),
                    }}
                  >
                    {ch}
                  </span>
                ))
              : w.w;
          return (
            <span
              key={k}
              className="fd-st-w"
              style={
                mode === "words"
                  ? {
                      ["--fd-st-i" as string]: wi,
                      ["--fd-st-x" as string]: `${((hash(wi, 1) - 0.5) * 1.6).toFixed(3)}em`,
                      ["--fd-st-y" as string]: `${((hash(wi, 2) - 0.5) * 1.4).toFixed(3)}em`,
                      ["--fd-st-r" as string]: `${((hash(wi, 3) - 0.5) * 40).toFixed(1)}deg`,
                      ["--fd-st-j" as string]: hash(wi, 4).toFixed(3),
                    }
                  : undefined
              }
            >
              <span className="fd-st-wi">{pieces}</span>
            </span>
          );
        })}
      </span>
    </Tag>
  );
}

const css = `
:where(.fd-st){margin:0;padding:0;border:0;background:none;color:inherit;
  font:600 clamp(2rem,5vw,4rem)/1.04 "SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;
  letter-spacing:-.03em;text-wrap:balance}
.fd-st,.fd-st *,.fd-st *::before,.fd-st *::after{box-sizing:border-box}
.fd-st{--fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-st-blur:14px;--fd-st-caret:currentColor;
  display:block;font-kerning:normal;font-feature-settings:"kern"}
.fd-st-inner{display:inline;margin:0;padding:0}
.fd-st-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.fd-st-w{display:inline-block;margin:0;padding:0;white-space:nowrap;vertical-align:top}
.fd-st-wi,.fd-st-c{display:inline-block;margin:0;padding:0;will-change:transform,opacity}
.fd-st-c{white-space:pre}

/* shared timing: chars/words use their index, lines use the measured line index */
.fd-st[data-split="chars"] .fd-st-c,
.fd-st[data-split="words"] .fd-st-w > .fd-st-wi,
.fd-st[data-split="lines"] .fd-st-w > .fd-st-wi{
  --fd-st-t:calc(var(--fd-st-delay) + var(--fd-st-i,0) * var(--fd-st-step));
  transition:transform var(--fd-st-dur) var(--fd-ease-out) var(--fd-st-t),opacity var(--fd-st-dur) var(--fd-ease-out) var(--fd-st-t),filter var(--fd-st-dur) var(--fd-ease-out) var(--fd-st-t)}
.fd-st[data-split="lines"] .fd-st-w{--fd-st-i:0}
.fd-st[data-snap] *{transition:none!important;animation:none!important}

/* rise: words are masks, the inner content slides up through them */
.fd-st[data-preset="rise"] .fd-st-w{overflow:hidden;padding:.06em .02em .14em;margin:-.06em -.02em -.14em}
.fd-st[data-preset="rise"][data-phase="idle"] .fd-st-wi,
.fd-st[data-preset="rise"][data-split="chars"][data-phase="idle"] .fd-st-c{transform:translate3d(0,135%,0) rotate(4deg)}
.fd-st[data-preset="rise"][data-split="chars"] .fd-st-wi{transform:none;transition:none}
.fd-st[data-preset="rise"][data-split="chars"] .fd-st-c{transform-origin:0 100%}
.fd-st[data-preset="rise"] .fd-st-wi{transform-origin:0 100%}

/* blur */
.fd-st[data-preset="blur"][data-phase="idle"] .fd-st-wi,
.fd-st[data-preset="blur"][data-split="chars"][data-phase="idle"] .fd-st-c{opacity:0;filter:blur(var(--fd-st-blur));transform:translate3d(0,.18em,0) scale(1.04)}
.fd-st[data-preset="blur"][data-split="chars"] .fd-st-wi{opacity:1;filter:none;transform:none}

/* scatter: random offsets, a little extra random delay */
.fd-st[data-preset="scatter"] .fd-st-c,.fd-st[data-preset="scatter"][data-split="words"] .fd-st-wi{
  --fd-st-t:calc(var(--fd-st-delay) + var(--fd-st-j) * 260ms);transition-duration:calc(var(--fd-st-dur) * 1.25)}
.fd-st[data-preset="scatter"][data-phase="idle"] .fd-st-c,
.fd-st[data-preset="scatter"][data-split="words"][data-phase="idle"] .fd-st-wi{opacity:0;filter:blur(6px);
  transform:translate3d(var(--fd-st-x),var(--fd-st-y),0) rotate(var(--fd-st-r)) scale(.6)}

/* wave: a crest passes through, pieces overshoot and settle */
.fd-st[data-preset="wave"][data-phase="idle"] .fd-st-c,
.fd-st[data-preset="wave"][data-split="words"][data-phase="idle"] .fd-st-wi,
.fd-st[data-preset="wave"][data-split="lines"][data-phase="idle"] .fd-st-wi{opacity:0;transform:translate3d(0,.55em,0)}
.fd-st[data-preset="wave"][data-phase="in"] .fd-st-c,
.fd-st[data-preset="wave"][data-split="words"][data-phase="in"] .fd-st-wi,
.fd-st[data-preset="wave"][data-split="lines"][data-phase="in"] .fd-st-wi{animation:fd-st-wave var(--fd-st-dur) cubic-bezier(.3,.7,.4,1) var(--fd-st-t) both}
@keyframes fd-st-wave{0%{opacity:0;transform:translate3d(0,.55em,0) scaleY(.9)}38%{opacity:1}55%{transform:translate3d(0,-.16em,0) scaleY(1.04)}78%{transform:translate3d(0,.03em,0)}100%{opacity:1;transform:none}}

/* typewriter */
.fd-st[data-preset="typewriter"] .fd-st-c{opacity:0;transition:none;will-change:auto}
.fd-st[data-preset="typewriter"] .fd-st-c[data-on]{opacity:1}
.fd-st[data-preset="typewriter"] .fd-st-w{white-space:nowrap}
.fd-st-lead{display:inline-block;width:0;margin:0;padding:0}
.fd-st-lead::before{content:"\\200b"}
.fd-st[data-caret-on] [data-caret]{position:relative}
.fd-st[data-caret-on] [data-caret]::after{content:"";position:absolute;top:.1em;bottom:.06em;right:-.1em;width:max(2px,.06em);border-radius:1px;
  background:var(--fd-st-caret);opacity:1;animation:fd-st-blink 1.06s steps(1,end) infinite}
.fd-st[data-caret-on] .fd-st-lead[data-caret]::after{right:auto;left:0}
.fd-st[data-typing] [data-caret]::after{animation:none}
@keyframes fd-st-blink{0%,55%{opacity:1}56%,100%{opacity:0}}

@media (prefers-reduced-motion:reduce){
  .fd-st *{transition:none!important;animation:none!important}
  .fd-st[data-phase] .fd-st-wi,.fd-st[data-phase] .fd-st-c{opacity:1;transform:none;filter:none}
  .fd-st[data-preset="typewriter"] .fd-st-c{opacity:1}
}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const PRESETS: { id: SplitPreset; label: string }[] = [
  { id: "rise", label: "Rise" },
  { id: "wave", label: "Wave" },
  { id: "scatter", label: "Scatter" },
  { id: "blur", label: "Blur" },
  { id: "typewriter", label: "Type" },
];

export function Demo() {
  const [keys, setKeys] = useState<Record<string, number>>({});
  const bump = (id: string) => setKeys((k) => ({ ...k, [id]: (k[id] ?? 0) + 1 }));
  const replayAll = () => setKeys((k) => Object.fromEntries(PRESETS.map((p) => [p.id, (k[p.id] ?? 0) + 1])));

  const Replay = ({ id, label }: { id: string; label: string }) => (
    <button type="button" className="fd-st-demo-replay" onClick={() => bump(id)} aria-label={`Replay ${label} preset`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
      </svg>
      {label}
    </button>
  );

  return (
    <div className="fd-st-demo">
      <style>{demoCss}</style>
      <header className="fd-st-demo-bar">
        <span className="fd-st-demo-logo" aria-label="Halyard Research">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M5 15.5c3-5.5 11-5.5 14 0" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="8" r="1.8" fill="currentColor" /></svg>
          Halyard
        </span>
        <nav className="fd-st-demo-nav" aria-label="Primary">
          <a href="#research">Research</a>
          <a href="#models">Models</a>
          <a href="#safety">Safety</a>
          <a href="#careers">Careers</a>
        </nav>
        <button type="button" className="fd-st-demo-all" onClick={replayAll}>Replay all</button>
      </header>

      <main className="fd-st-demo-main">
        <section className="fd-st-demo-hero">
          <div className="fd-st-demo-kick">
            <span className="fd-st-demo-dot" aria-hidden="true" />
            Release note · 14 November 2026
            <Replay id="rise" label="Rise · lines" />
          </div>
          <SplitText
            as="h1"
            preset="rise"
            split="lines"
            text="Halyard 3 reasons in long arcs, not short hops."
            className="fd-st-demo-h1"
            trigger="mount"
            replay={keys.rise}
          />
          <SplitText
            as="p"
            preset="blur"
            split="words"
            stagger={28}
            delay={380}
            text="A 1.2M-token context, verified tool use and a planning head trained on 41 billion steps of agentic traces. Available today in the API and on-prem."
            className="fd-st-demo-lede"
            trigger="mount"
            replay={keys.rise}
          />
        </section>

        <section className="fd-st-demo-grid" aria-label="Highlights">
          <article className="fd-st-demo-card fd-st-demo-card--stat">
            <div className="fd-st-demo-cardhead"><span>Long-horizon eval</span><Replay id="scatter" label="Scatter" /></div>
            <SplitText as="p" preset="scatter" text="+38.4%" className="fd-st-demo-stat" replay={keys.scatter} />
            <p className="fd-st-demo-note">Task completion on HorizonBench-500 over Halyard 2, with no change to latency at p50.</p>
          </article>

          <article className="fd-st-demo-card fd-st-demo-card--quote">
            <div className="fd-st-demo-cardhead"><span>From the paper</span><Replay id="wave" label="Wave" /></div>
            <SplitText
              as="h2"
              preset="wave"
              text="Plans should bend, not break."
              className="fd-st-demo-quote"
              duration={900}
              stagger={30}
              replay={keys.wave}
            />
            <p className="fd-st-demo-note">Dr. Ines Achterberg, Head of Reasoning</p>
          </article>

          <article className="fd-st-demo-card fd-st-demo-card--term">
            <div className="fd-st-demo-cardhead"><span>halyard-3 · playground</span><Replay id="typewriter" label="Type" /></div>
            <div className="fd-st-demo-term">
              <span className="fd-st-demo-prompt" aria-hidden="true">›</span>
              <SplitText
                as="p"
                preset="typewriter"
                cps={24}
                delay={300}
                text="Plan a 3-week migration of our billing service to event sourcing, with a rollback at every step."
                className="fd-st-demo-typed"
                replay={keys.typewriter}
              />
            </div>
          </article>
        </section>

        <section className="fd-st-demo-foot">
          <div className="fd-st-demo-cardhead"><span>Research agenda</span><Replay id="blur" label="Blur · words" /></div>
          <SplitText
            as="h2"
            preset="blur"
            split="words"
            text="Interpretability you can audit. Evaluations you can rerun. Weights you can host."
            className="fd-st-demo-h2"
            replay={keys.blur}
          />
        </section>
      </main>
    </div>
  );
}

const demoCss = `
.fd-st-demo,.fd-st-demo *,.fd-st-demo *::before,.fd-st-demo *::after{box-sizing:border-box}
.fd-st-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --d-disp:"SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;
  --d-serif:ui-serif,"New York","Iowan Old Style","Charter","Georgia",serif;
  --d-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  --d-bg:#F3F1EC;--d-ink:#101014;--d-mut:#64625C;--d-line:rgba(16,16,20,.12);--d-acc:#E0461B;
  margin:0;padding:0;min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.5 var(--d-font);-webkit-font-smoothing:antialiased}
.fd-st-demo-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0;padding:20px clamp(16px,4vw,48px)}
.fd-st-demo-logo{display:inline-flex;align-items:center;gap:10px;margin:0;font:600 17px/1 var(--d-disp);letter-spacing:-.01em;color:var(--d-ink)}
.fd-st-demo-logo svg{display:block}
.fd-st-demo-nav{display:flex;gap:28px;margin:0;padding:0}
.fd-st-demo-nav a{margin:0;padding:6px 0;font:400 15px/1 var(--d-font);color:var(--d-mut);text-decoration:none}
.fd-st-demo-nav a:hover{color:var(--d-ink)}
.fd-st-demo-all{appearance:none;-webkit-appearance:none;margin:0;height:34px;padding:0 16px;border:0;border-radius:9999px;background:var(--d-ink);color:var(--d-bg);
  font:500 13px/1 var(--d-font);cursor:pointer;transition:transform 120ms cubic-bezier(.22,1,.36,1)}
.fd-st-demo-all:active{transform:scale(.96)}
.fd-st-demo a:focus-visible,.fd-st-demo button:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px;border-radius:9999px}
.fd-st-demo-main{max-width:1280px;margin:0 auto;padding:clamp(24px,6vh,64px) clamp(16px,4vw,48px) 64px}
.fd-st-demo-kick{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 22px;font:500 13px/1 var(--d-mono);color:var(--d-mut);letter-spacing:.01em}
.fd-st-demo-dot{display:block;width:8px;height:8px;border-radius:50%;background:var(--d-acc);box-shadow:0 0 0 4px rgba(224,70,27,.16)}
.fd-st-demo-replay{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;gap:6px;margin:0 0 0 auto;height:26px;padding:0 10px;border:0;border-radius:9999px;
  background:rgba(16,16,20,.06);color:var(--d-mut);font:500 12px/1 var(--d-mono);letter-spacing:0;cursor:pointer;transition:background-color 120ms,color 120ms}
.fd-st-demo-replay:hover{background:rgba(16,16,20,.1);color:var(--d-ink)}
.fd-st-demo-replay svg{display:block}
.fd-st-demo-h1{max-width:13ch;color:var(--d-ink);font:600 clamp(44px,8.4vw,112px)/.94 var(--d-disp);letter-spacing:-.045em}
.fd-st-demo-lede{max-width:34em;margin:28px 0 0;color:var(--d-mut);font:400 clamp(17px,1.6vw,20px)/1.45 var(--d-font);letter-spacing:-.01em;text-wrap:pretty}
.fd-st-demo-grid{display:grid;grid-template-columns:1fr 1.15fr 1.35fr;gap:16px;margin:clamp(40px,8vh,80px) 0 0}
.fd-st-demo-card{display:flex;flex-direction:column;gap:14px;margin:0;padding:22px;border-radius:24px;background:#FBFAF7;box-shadow:0 0 0 1px var(--d-line);min-height:220px}
.fd-st-demo-cardhead{display:flex;align-items:center;gap:10px;margin:0;font:500 12px/1 var(--d-mono);color:var(--d-mut);text-transform:uppercase;letter-spacing:.06em}
.fd-st-demo-cardhead .fd-st-demo-replay{text-transform:none}
.fd-st-demo-stat{margin:auto 0 0;color:var(--d-acc);font:600 clamp(56px,6vw,88px)/1 var(--d-disp);letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.fd-st-demo-note{margin:0;color:var(--d-mut);font:400 13px/1.45 var(--d-font);max-width:32em}
.fd-st-demo-card--quote{background:var(--d-ink);color:#F3F1EC;box-shadow:none}
.fd-st-demo-card--quote .fd-st-demo-cardhead,.fd-st-demo-card--quote .fd-st-demo-note{color:rgba(243,241,236,.6)}
.fd-st-demo-card--quote .fd-st-demo-replay{background:rgba(255,255,255,.1);color:rgba(243,241,236,.7)}
.fd-st-demo-quote{margin:auto 0 0;color:#F3F1EC;font:400 italic clamp(32px,3.2vw,44px)/1.05 var(--d-serif);letter-spacing:-.025em}
.fd-st-demo-card--term{background:#16161B;box-shadow:0 0 0 1px rgba(255,255,255,.06),0 24px 48px -28px rgba(16,16,20,.6)}
.fd-st-demo-card--term .fd-st-demo-cardhead{color:rgba(243,241,236,.5);text-transform:none;letter-spacing:0}
.fd-st-demo-card--term .fd-st-demo-replay{background:rgba(255,255,255,.08);color:rgba(243,241,236,.7)}
.fd-st-demo-term{display:flex;gap:12px;margin:auto 0 0;padding:16px;border-radius:12px;background:rgba(255,255,255,.04)}
.fd-st-demo-prompt{margin:0;color:#7BE0A6;font:500 17px/1.45 var(--d-mono)}
.fd-st-demo-typed{--fd-st-caret:#7BE0A6;color:#EDEBE6;font:400 15px/1.55 var(--d-mono);letter-spacing:0;text-wrap:pretty}
.fd-st-demo-foot{margin:clamp(48px,10vh,96px) 0 0;padding:24px 0 0;border-top:1px solid var(--d-line)}
.fd-st-demo-h2{margin:22px 0 0;max-width:22ch;color:var(--d-ink);font:500 clamp(32px,4.4vw,64px)/1.02 var(--d-disp);letter-spacing:-.035em}
@media (max-width:900px){.fd-st-demo-grid{grid-template-columns:1fr}.fd-st-demo-nav{display:none}}
`;
