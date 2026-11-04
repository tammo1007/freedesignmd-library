/**
 * AnimatedNumber, an odometer. Each digit is its own drum that rolls to the
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
 * the drums are aria-hidden. Don't put aria-live on fast tickers, announce
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

export function Demo() {
  const [value, setValue] = useState(12480.5);
  const seed = useRef(11);
  const step = () => {
    seed.current = (seed.current * 16807) % 2147483647;
    const r = seed.current / 2147483647 - 0.5;
    setValue((v) => Math.max(1000, Number((v + r * 4200).toFixed(2))));
  };

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (!document.hidden) step();
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="fd-and">
      <style>{demoCss}</style>
      <AnimatedNumber value={value} format={{ style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }} className="fd-and-num" duration={900} />
      <button type="button" className="fd-and-btn" onClick={step}>Update</button>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const FD = `"SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif`;

const demoCss = `
.fd-and,.fd-and *,.fd-and *::before,.fd-and *::after{box-sizing:border-box}
.fd-and{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f2f2f2;color:#1d1d1f;font:400 15px/1.4 ${F};letter-spacing:normal;-webkit-font-smoothing:antialiased}
.fd-and .fd-and-num{margin:0;padding:0;color:#1d1d1f;font:600 clamp(44px,11vw,88px)/1 ${FD};letter-spacing:-.04em}
.fd-and-btn{appearance:none;-webkit-appearance:none;margin:0;height:34px;padding:0 16px;border:0;border-radius:9999px;background:rgba(0,0,0,.06);color:#3c3c43;font:500 13px/1 ${F};letter-spacing:normal;cursor:pointer;transition:background-color 200ms}
.fd-and-btn:hover{background:rgba(0,0,0,.1)}
.fd-and-btn:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
`;
