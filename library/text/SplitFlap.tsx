/**
 * SplitFlap — an airport departure board. Every cell is a split-flap unit
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

/** One split-flap cell. All animation is imperative — React renders it once per target char. */
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

const COLS: FlapColumn[] = [
  { key: "time", label: "Time", length: 5 },
  { key: "dest", label: "Destination", length: 12 },
  { key: "flight", label: "Flight", length: 6 },
  { key: "gate", label: "Gate", length: 3 },
  { key: "status", label: "Remarks", length: 9 },
];

const AMBER = "#FFC53D";
const GREEN = "#6EE7A8";
const RED = "#FF7A6B";

const BOARD_A: FlapRow[] = [
  { id: "1", time: "14:05", dest: "LISBON", flight: "WV 412", gate: "B12", status: "BOARDING", tone: GREEN },
  { id: "2", time: "14:20", dest: "REYKJAVIK", flight: "NA 220", gate: "C04", status: "ON TIME" },
  { id: "3", time: "14:35", dest: "MARRAKECH", flight: "WV 918", gate: "A21", status: "DELAYED", tone: AMBER },
  { id: "4", time: "14:50", dest: "OSAKA KIX", flight: "SK 061", gate: "D02", status: "ON TIME" },
  { id: "5", time: "15:10", dest: "CAPE TOWN", flight: "WV 731", gate: "B07", status: "ON TIME" },
  { id: "6", time: "15:25", dest: "NEW YORK JFK", flight: "AT 104", gate: "E15", status: "GATE OPEN" },
];
const BOARD_B: FlapRow[] = [
  { id: "1", time: "14:05", dest: "LISBON", flight: "WV 412", gate: "B12", status: "CLOSED", tone: RED },
  { id: "2", time: "14:20", dest: "REYKJAVIK", flight: "NA 220", gate: "C04", status: "BOARDING", tone: GREEN },
  { id: "3", time: "14:55", dest: "MARRAKECH", flight: "WV 918", gate: "A19", status: "GATE CHG", tone: AMBER },
  { id: "4", time: "14:50", dest: "OSAKA KIX", flight: "SK 061", gate: "D02", status: "GATE OPEN" },
  { id: "5", time: "15:10", dest: "CAPE TOWN", flight: "WV 731", gate: "B07", status: "ON TIME" },
  { id: "6", time: "15:25", dest: "NEW YORK JFK", flight: "AT 104", gate: "E15", status: "GATE OPEN" },
];

export function Demo() {
  const [b, setB] = useState(0);
  const [clock, setClock] = useState("13:58");
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const first = window.setTimeout(() => setB(1), 5200);
    if (reduced) return () => window.clearTimeout(first);
    const id = window.setInterval(() => setB((x) => (x + 1) % 2), 9000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  useEffect(() => setClock(b ? "14:02" : "13:58"), [b]);
  const rows = b ? BOARD_B : BOARD_A;

  return (
    <div className="fd-sf-demo">
      <style>{demoCss}</style>
      <header className="fd-sf-demo-bar">
        <span className="fd-sf-demo-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 13.5l7-1.6 5.2-7.4h2.6l-2.8 7 5-1.1c1.4-.3 2.3 1.6.9 2.3l-14.9 4.4-3-3.6z" fill="#FFC53D" /></svg>
          Wayvia
        </span>
        <span className="fd-sf-demo-meta">Terminal 2 · Departures</span>
        <button type="button" className="fd-sf-demo-btn" onClick={() => setB((x) => (x + 1) % 2)}>Update board</button>
      </header>

      <main className="fd-sf-demo-main">
        <div className="fd-sf-demo-title">
          <div>
            <p className="fd-sf-demo-eyebrow">Your trip · Sat 14 Nov</p>
            <h1 className="fd-sf-demo-h1">Departures</h1>
          </div>
          <div className="fd-sf-demo-clock" aria-label={`Local time ${clock}`}>
            <SplitFlap value={clock} className="fd-sf-demo-clockflap" stagger={60} />
          </div>
        </div>

        <div className="fd-sf-demo-board">
          <div className="fd-sf-demo-scroll">
            <FlapBoard columns={COLS} rows={rows} caption="Departures, Terminal 2" className="fd-sf-demo-table" />
          </div>
        </div>

        <div className="fd-sf-demo-trip">
          <div className="fd-sf-demo-pass">
            <span className="fd-sf-demo-k">Your flight</span>
            <span className="fd-sf-demo-v">WV 918 · Marrakech</span>
          </div>
          <div className="fd-sf-demo-pass">
            <span className="fd-sf-demo-k">Gate</span>
            <span className="fd-sf-demo-v">{b ? "A19 · 6 min walk" : "A21 · 7 min walk"}</span>
          </div>
          <div className="fd-sf-demo-pass">
            <span className="fd-sf-demo-k">Seat</span>
            <span className="fd-sf-demo-v">14A · Window</span>
          </div>
        </div>
      </main>
    </div>
  );
}

const demoCss = `
.fd-sf-demo,.fd-sf-demo *,.fd-sf-demo *::before,.fd-sf-demo *::after{box-sizing:border-box}
.fd-sf-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:"SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;
  margin:0;padding:0;min-height:100vh;background:radial-gradient(120% 80% at 50% 0%,#1B1C21 0%,#0C0D10 60%);color:#F2EFE6;font:400 15px/1.5 var(--d-font);-webkit-font-smoothing:antialiased}
.fd-sf-demo-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0;padding:20px clamp(16px,4vw,48px)}
.fd-sf-demo-brand{display:inline-flex;align-items:center;gap:10px;margin:0;font:600 17px/1 var(--d-disp);letter-spacing:-.01em}
.fd-sf-demo-brand svg{display:block}
.fd-sf-demo-meta{margin:0;color:rgba(242,239,230,.55);font:500 13px/1 var(--d-font)}
.fd-sf-demo-btn{appearance:none;-webkit-appearance:none;margin:0;height:36px;padding:0 16px;border:0;border-radius:9999px;background:#FFC53D;color:#1A1405;font:600 13px/1 var(--d-font);cursor:pointer;
  transition:transform 120ms cubic-bezier(.22,1,.36,1)}
.fd-sf-demo-btn:active{transform:scale(.96)}
.fd-sf-demo-btn:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
.fd-sf-demo-main{max-width:1280px;margin:0 auto;padding:clamp(24px,5vh,56px) clamp(16px,4vw,48px) 48px}
.fd-sf-demo-title{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin:0 0 28px}
.fd-sf-demo-eyebrow{margin:0 0 8px;color:rgba(242,239,230,.55);font:500 13px/1 var(--d-font)}
.fd-sf-demo-h1{margin:0;font:600 clamp(32px,4.4vw,56px)/1 var(--d-disp);letter-spacing:-.035em;color:#F2EFE6}
.fd-sf-demo-clockflap{font-size:clamp(22px,2.6vw,32px);--fd-sf-fg:#FFC53D}
.fd-sf-demo-board{margin:0;padding:clamp(16px,2.4vw,28px);border-radius:24px;background:linear-gradient(180deg,#0A0A0C,#060607);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),inset 0 0 0 1px rgba(255,255,255,.04),0 40px 80px -40px rgba(0,0,0,.8)}
.fd-sf-demo-scroll{overflow-x:auto;margin:0;padding:0 0 4px;scrollbar-width:thin}
.fd-sf-demo-table{font-size:clamp(15px,2.05vw,27px)}
.fd-sf-demo-trip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0 0}
.fd-sf-demo-pass{display:flex;flex-direction:column;gap:6px;margin:0;padding:16px 18px;border-radius:18px;background:rgba(255,255,255,.04);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
.fd-sf-demo-k{margin:0;color:rgba(242,239,230,.5);font:500 12px/1 var(--d-font);text-transform:uppercase;letter-spacing:.08em}
.fd-sf-demo-v{margin:0;color:#F2EFE6;font:500 17px/1.25 var(--d-font);letter-spacing:-.01em}
@media (max-width:720px){.fd-sf-demo-meta{display:none}.fd-sf-demo-trip{grid-template-columns:1fr}.fd-sf-demo-table{font-size:14px}}
`;
