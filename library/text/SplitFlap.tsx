/**
 * SplitFlap, an airport departure board. Every cell is a split-flap unit
 * with a top and bottom half; when its character changes it flips through
 * the drum (in alphabet order, like the real thing) with a two-half 3D fold,
 * and cells settle in a staggered cascade.
 *
 * Exports
 * - <SplitFlap value length? charset? stagger? flipMs? />  one row of cells.
 * - <FlapBoard rows columns />                            a whole board.
 *
 * SplitFlap props
 * - value: string            Text to show. Uppercased, padded/clipped to `length`.
 * - length?: number          Number of cells. Default value.length.
 * - charset?: string         Drum order. Default " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/".
 * - flipMs?: number          Duration of one flap in ms. Default 90.
 * - maxSteps?: number        Max flaps per change (long trips skip ahead). Default 14.
 * - stagger?: number         ms delay per cell from left. Default 24.
 * - delay?: number           Extra ms before this row starts. Default 0.
 * - tone?: string            Character colour, e.g. a status colour.
 * - label?: string           Accessible text (defaults to the trimmed value).
 * CSS vars on .fd-sf root: --fd-sf-w, --fd-sf-h (cell size), --fd-sf-bg, --fd-sf-fg, --fd-sf-gap.
 *
 * Accessibility: each row is one text node for assistive tech (role="text"
 * fallback via a visually hidden copy); flaps are aria-hidden. Wrap a board in
 * a <table> (as in FlapBoard) so screen readers can navigate it.
 * Reduced motion: cells change instantly.
 * Browser support: all evergreen browsers (3D transforms, backface-visibility).
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

const DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/";

export interface SplitFlapProps {
  value: string;
  length?: number;
  charset?: string;
  flipMs?: number;
  maxSteps?: number;
  stagger?: number;
  delay?: number;
  tone?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** One split-flap cell. All animation is imperative, React renders it once per target char. */
function Cell({ target, charset, flipMs, maxSteps, delay }: { target: string; charset: string; flipMs: number; maxSteps: number; delay: number }) {
  const el = useRef<HTMLSpanElement>(null);
  const shown = useRef(target);
  const timer = useRef(0);

  useEffect(() => {
    const root = el.current;
    if (!root) return;
    const q = (s: string) => root.querySelector<HTMLElement>(s)!;
    const top = q(".fd-sf-top b");
    const bot = q(".fd-sf-bot b");
    const fTop = q(".fd-sf-ftop b");
    const fBot = q(".fd-sf-fbot b");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.clearTimeout(timer.current);
    if (reduced || shown.current === target) {
      shown.current = target;
      top.textContent = bot.textContent = fTop.textContent = fBot.textContent = target;
      root.removeAttribute("data-flip");
      return;
    }
    // build the path through the drum
    const from = Math.max(0, charset.indexOf(shown.current));
    const to = charset.indexOf(target);
    const path: string[] = [];
    if (to < 0) path.push(target);
    else {
      let i = from;
      while (i !== to) {
        i = (i + 1) % charset.length;
        path.push(charset[i]);
      }
    }
    const seq = path.length > maxSteps ? path.slice(path.length - maxSteps) : path;
    let k = 0;
    const step = () => {
      const next = seq[k];
      const cur = shown.current;
      // static halves: top shows next, bottom still shows current; flaps carry the fold
      top.textContent = next;
      bot.textContent = cur;
      fTop.textContent = cur;
      fBot.textContent = next;
      // alternate between two identical animations to restart without a reflow
      root.setAttribute("data-flip", k % 2 ? "b" : "a");
      shown.current = next;
      k++;
      // last flap gets a little extra time to land
      const d = k >= seq.length ? flipMs * 1.6 : flipMs * (0.85 + Math.random() * 0.3);
      timer.current = window.setTimeout(() => {
        bot.textContent = next;
        if (k < seq.length) step();
        else root.removeAttribute("data-flip");
      }, d);
    };
    timer.current = window.setTimeout(step, delay);
    return () => window.clearTimeout(timer.current);
  }, [target, charset, flipMs, maxSteps, delay]);

  const c = shown.current;
  return (
    <span ref={el} className="fd-sf-cell" aria-hidden="true">
      <span className="fd-sf-top"><b>{c}</b></span>
      <span className="fd-sf-bot"><b>{c}</b></span>
      <span className="fd-sf-ftop"><b>{c}</b></span>
      <span className="fd-sf-fbot"><b>{c}</b></span>
    </span>
  );
}

export function SplitFlap({
  value,
  length,
  charset = DRUM,
  flipMs = 90,
  maxSteps = 14,
  stagger = 24,
  delay = 0,
  tone,
  label,
  className,
  style,
}: SplitFlapProps) {
  const n = length ?? value.length;
  const v = value.toUpperCase().padEnd(n, " ").slice(0, n);
  return (
    <span className={`fd-sf${className ? " " + className : ""}`} style={{ ["--fd-sf-dur" as string]: `${flipMs}ms`, ...style, ...(tone ? { ["--fd-sf-fg" as string]: tone } : null) }}>
      <style>{css}</style>
      <span className="fd-sf-sr">{label ?? value.trim()}</span>
      {Array.from(v).map((ch, i) => (
        <Cell key={i} target={ch} charset={charset} flipMs={flipMs} maxSteps={maxSteps} delay={delay + i * stagger} />
      ))}
    </span>
  );
}

const css = `
.fd-sf,.fd-sf *,.fd-sf *::before,.fd-sf *::after{box-sizing:border-box}
.fd-sf{--fd-sf-w:1em;--fd-sf-h:1.42em;--fd-sf-gap:.08em;--fd-sf-bg:#1A1B1F;--fd-sf-bg2:#141518;--fd-sf-fg:#F2EFE6;--fd-sf-dur:70ms;
  display:inline-flex;gap:var(--fd-sf-gap);margin:0;padding:0;vertical-align:middle;
  font:600 1rem/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:0;color:var(--fd-sf-fg)}
.fd-sf-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.fd-sf-cell{position:relative;display:block;flex:none;width:var(--fd-sf-w);height:var(--fd-sf-h);margin:0;padding:0;perspective:5em;border-radius:.16em;
  box-shadow:0 .06em .12em rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.03)}
.fd-sf-top,.fd-sf-bot,.fd-sf-ftop,.fd-sf-fbot{position:absolute;left:0;right:0;height:50%;margin:0;padding:0;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.fd-sf-top,.fd-sf-ftop{top:0;border-radius:.16em .16em 0 0;background:linear-gradient(180deg,var(--fd-sf-bg),var(--fd-sf-bg2))}
.fd-sf-bot,.fd-sf-fbot{bottom:0;border-radius:0 0 .16em .16em;background:linear-gradient(180deg,var(--fd-sf-bg2),var(--fd-sf-bg))}
.fd-sf-top::after,.fd-sf-ftop::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:rgba(0,0,0,.65)}
.fd-sf-cell b{position:absolute;left:0;right:0;display:block;height:var(--fd-sf-h);margin:0;padding:0;font:inherit;line-height:var(--fd-sf-h);text-align:center;color:inherit;white-space:pre}
.fd-sf-top b,.fd-sf-ftop b{top:0}
.fd-sf-bot b,.fd-sf-fbot b{bottom:0}
.fd-sf-ftop{transform-origin:50% 100%;transform:rotateX(0deg);z-index:2;visibility:hidden}
.fd-sf-fbot{transform-origin:50% 0%;transform:rotateX(90deg);z-index:2;visibility:hidden}
.fd-sf-cell[data-flip] .fd-sf-ftop,.fd-sf-cell[data-flip] .fd-sf-fbot{visibility:visible}
.fd-sf-cell[data-flip="a"] .fd-sf-ftop{animation:fd-sf-ta calc(var(--fd-sf-dur) * .5) cubic-bezier(.55,0,.9,.4) both}
.fd-sf-cell[data-flip="b"] .fd-sf-ftop{animation:fd-sf-tb calc(var(--fd-sf-dur) * .5) cubic-bezier(.55,0,.9,.4) both}
.fd-sf-cell[data-flip="a"] .fd-sf-fbot{animation:fd-sf-ba calc(var(--fd-sf-dur) * .5) cubic-bezier(.1,.6,.4,1) calc(var(--fd-sf-dur) * .5) both}
.fd-sf-cell[data-flip="b"] .fd-sf-fbot{animation:fd-sf-bb calc(var(--fd-sf-dur) * .5) cubic-bezier(.1,.6,.4,1) calc(var(--fd-sf-dur) * .5) both}
@keyframes fd-sf-ta{from{transform:rotateX(0);filter:brightness(1)}to{transform:rotateX(-90deg);filter:brightness(.55)}}
@keyframes fd-sf-tb{from{transform:rotateX(0);filter:brightness(1)}to{transform:rotateX(-90deg);filter:brightness(.55)}}
@keyframes fd-sf-ba{from{transform:rotateX(90deg);filter:brightness(1.35)}to{transform:rotateX(0);filter:brightness(1)}}
@keyframes fd-sf-bb{from{transform:rotateX(90deg);filter:brightness(1.35)}to{transform:rotateX(0);filter:brightness(1)}}
@media (prefers-reduced-motion:reduce){.fd-sf-cell[data-flip] .fd-sf-ftop,.fd-sf-cell[data-flip] .fd-sf-fbot{animation:none;visibility:hidden}}
`;

/* ───────────────────────── board ───────────────────────── */

export type FlapColumn = { key: string; label: string; length: number; align?: "start" | "end" };
export type FlapRow = Record<string, string> & { id: string; tone?: string };

export function FlapBoard({ columns, rows, caption, className }: { columns: FlapColumn[]; rows: FlapRow[]; caption?: string; className?: string }) {
  return (
    <table className={`fd-sf-board${className ? " " + className : ""}`}>
      <style>{boardCss}</style>
      {caption && <caption className="fd-sf-sr">{caption}</caption>}
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={r.id}>
            {columns.map((c, ci) => {
              const raw = r[c.key] ?? "";
              const val = c.align === "end" ? raw.padStart(c.length, " ") : raw;
              return (
                <td key={c.key}>
                  <SplitFlap value={val} label={raw} length={c.length} delay={ri * 90 + ci * 60} tone={c.key === "status" ? r.tone : undefined} />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const boardCss = `
.fd-sf-board{border-collapse:separate;border-spacing:0;margin:0;padding:0;border:0;background:none;color:inherit;font:inherit}
.fd-sf-board th{margin:0;padding:0 .9em .7em 0;border:0;text-align:left;font:600 .62em/1 ui-sans-serif,-apple-system,"SF Pro Text","Inter",sans-serif;
  letter-spacing:.14em;text-transform:uppercase;color:#C9A227;white-space:nowrap}
.fd-sf-board td{margin:0;padding:0 .9em .3em 0;border:0;vertical-align:middle}
.fd-sf-board th:last-child,.fd-sf-board td:last-child{padding-right:0}
.fd-sf-board .fd-sf-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const PLACES = ["LISBON", "OSAKA", "NAIROBI", "TORONTO", "BREMEN"];

export function Demo() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setI((x) => (x + 1) % PLACES.length);
    }, 3600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="fd-sfd">
      <style>{demoCss}</style>
      <SplitFlap value={PLACES[i]} length={8} className="fd-sfd-flap" stagger={55} />
      <button type="button" className="fd-sfd-btn" onClick={() => setI((x) => (x + 1) % PLACES.length)}>Next</button>
    </div>
  );
}

const demoCss = `
.fd-sfd,.fd-sfd *,.fd-sfd *::before,.fd-sfd *::after{box-sizing:border-box}
.fd-sfd{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f2f2f2;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
.fd-sfd .fd-sfd-flap{font-size:clamp(20px,4.6vw,56px)}
.fd-sfd-btn{appearance:none;-webkit-appearance:none;margin:0;height:34px;padding:0 16px;border:0;border-radius:9999px;background:rgba(0,0,0,.06);color:#3c3c43;font:500 13px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;cursor:pointer;transition:background-color 200ms}
.fd-sfd-btn:hover{background:rgba(0,0,0,.1)}
.fd-sfd-btn:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
`;
