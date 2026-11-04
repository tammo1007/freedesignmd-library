/**
 * SplitText, splits a string into characters, words or lines and plays an
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
    if (/[.!?––]/.test(prev)) d += base * (4 + hash(i, 7) * 3);
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
  const [preset, setPreset] = useState<SplitPreset>("rise");
  const [run, setRun] = useState(0);
  const pick = (id: SplitPreset) => {
    setPreset(id);
    setRun((n) => n + 1);
  };

  return (
    <div className="fd-std">
      <style>{demoCss}</style>
      <SplitText
        key={preset}
        as="h2"
        preset={preset}
        split={preset === "rise" || preset === "blur" ? "words" : "chars"}
        text="Make it feel alive."
        className="fd-std-text"
        trigger="mount"
        replay={run}
      />
      <div className="fd-std-seg" role="radiogroup" aria-label="Preset">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={preset === p.id} onClick={() => pick(p.id)}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}

const demoCss = `
.fd-std,.fd-std *,.fd-std *::before,.fd-std *::after{box-sizing:border-box}
.fd-std{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f2f2f2;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
.fd-std .fd-std-text{margin:0;padding:0;max-width:100%;color:#1d1d1f;text-align:center;font:600 clamp(36px,8vw,88px)/1.05 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-.04em;--fd-st-caret:#1d1d1f}
.fd-std-seg{display:inline-flex;flex-wrap:wrap;justify-content:center;gap:2px;margin:0;padding:3px;border-radius:9999px;background:rgba(0,0,0,.06)}
.fd-std-seg button{appearance:none;-webkit-appearance:none;margin:0;height:30px;padding:0 14px;border:0;border-radius:9999px;background:transparent;color:#6e6e73;font:500 13px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;cursor:pointer;transition:background-color 220ms cubic-bezier(.65,0,.35,1),color 220ms}
.fd-std-seg button[aria-checked="true"]{background:#fff;color:#1d1d1f;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.fd-std-seg button:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
`;
