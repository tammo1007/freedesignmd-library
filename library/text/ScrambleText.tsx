/**
 * ScrambleText, a decoding effect. Characters cycle through a glyph set and
 * lock in left to right, each after a short, slightly random number of
 * cycles. Hover (or focus) re-scrambles. Spaces and punctuation you choose
 * stay put so the shape of the line reads from the first frame.
 *
 * Props
 * - text: string                 Final text (also what screen readers get).
 * - as?: keyof JSX intrinsic     Element. Default "span".
 * - glyphs?: string              Scramble alphabet. Default A–Z 0–9 and symbols.
 * - speed?: number               Lock-in speed in characters per second. Default 28.
 * - scramble?: number            Cycles before the first char locks. Default 8.
 * - trigger?: "view" | "mount" | "manual". Default "view".
 * - hover?: boolean              Re-scramble on hover / focus. Default true.
 * - replay?: number | string     Change to replay.
 * - keep?: string                Characters never scrambled. Default " .,:-/·".
 * CSS vars: --fd-sc-dim (colour of unresolved glyphs, default 50% currentColor).
 *
 * Layout stays stable: every char cell is sized by its final glyph (a ghost
 * layer holds the width), and scrambling glyphs are centred inside it.
 * For best results use a monospace or tabular font.
 * Accessibility: a visually hidden copy holds the final text; glyph cells are aria-hidden.
 * Reduced motion shows the final text with no scrambling.
 * Browser support: all evergreen browsers.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ElementType } from "react";

export interface ScrambleTextProps {
  text: string;
  as?: ElementType;
  glyphs?: string;
  speed?: number;
  scramble?: number;
  trigger?: "view" | "mount" | "manual";
  hover?: boolean;
  replay?: number | string;
  keep?: string;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>/\\[]{}";

export function ScrambleText({
  text,
  as: Tag = "span",
  glyphs = DEFAULT_GLYPHS,
  speed = 28,
  scramble = 8,
  trigger = "view",
  hover = true,
  replay,
  keep = " .,:-/·",
  className,
  style,
}: ScrambleTextProps) {
  const root = useRef<HTMLElement>(null);
  const raf = useRef(0);
  const running = useRef(false);

  const run = useCallback(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const cells = Array.from(el.querySelectorAll<HTMLElement>(".fd-sc-live"));
    const chars = Array.from(text);
    const n = chars.length;
    // each char locks at a time: left-to-right sweep + a bit of jitter
    const per = 1000 / speed;
    const lead = (scramble * 1000) / 30;
    const lockAt = chars.map((_, i) => lead + i * per + Math.random() * per * 2.5);
    const nextSwap = new Float32Array(n);
    const locked = new Uint8Array(n);
    const t0 = performance.now();
    cancelAnimationFrame(raf.current);
    running.current = true;
    el.setAttribute("data-scrambling", "");
    cells.forEach((c, i) => {
      if (keep.includes(chars[i])) {
        locked[i] = 1;
        return;
      }
      c.textContent = glyphs[(Math.random() * glyphs.length) | 0];
      c.setAttribute("data-s", "");
    });
    const tick = (t: number) => {
      const e = t - t0;
      let left = 0;
      for (let i = 0; i < n; i++) {
        if (locked[i]) continue;
        const c = cells[i];
        if (e >= lockAt[i]) {
          locked[i] = 1;
          c.textContent = chars[i];
          c.removeAttribute("data-s");
          continue;
        }
        left++;
        // glyphs flicker at ~30 fps with per-cell phase, not every frame
        if (e >= nextSwap[i]) {
          c.textContent = glyphs[(Math.random() * glyphs.length) | 0];
          nextSwap[i] = e + 26 + Math.random() * 40;
        }
      }
      if (left > 0) raf.current = requestAnimationFrame(tick);
      else {
        running.current = false;
        el.removeAttribute("data-scrambling");
      }
    };
    raf.current = requestAnimationFrame(tick);
  }, [text, glyphs, speed, scramble, keep]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (trigger === "mount") run();
    let io: IntersectionObserver | null = null;
    if (trigger === "view") {
      io = new IntersectionObserver(
        (es) => {
          if (es.some((x) => x.isIntersecting)) {
            io?.disconnect();
            run();
          }
        },
        { threshold: 0.4 },
      );
      io.observe(el);
    }
    return () => {
      io?.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, [trigger, run]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay]);

  const onEnter = () => {
    if (hover && !running.current) run();
  };

  return (
    <Tag
      ref={root}
      className={`fd-sc${className ? " " + className : ""}`}
      style={style}
      onPointerEnter={onEnter}
      onFocus={onEnter}
    >
      <style>{css}</style>
      <span className="fd-sc-sr">{text}</span>
      {Array.from(text).map((ch, i) => (
        <span key={i} className="fd-sc-cell" aria-hidden="true">
          <span className="fd-sc-ghost">{ch}</span>
          <span className="fd-sc-live">{ch}</span>
        </span>
      ))}
    </Tag>
  );
}

const css = `
.fd-sc,.fd-sc *{box-sizing:border-box}
.fd-sc{--fd-sc-dim:color-mix(in srgb,currentColor 50%,transparent);margin:0;padding:0;font-variant-numeric:tabular-nums}
.fd-sc-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.fd-sc-cell{position:relative;display:inline-block;margin:0;padding:0;white-space:pre;vertical-align:baseline}
.fd-sc-ghost{visibility:hidden;margin:0;padding:0}
.fd-sc-live{position:absolute;left:50%;top:0;margin:0;padding:0;transform:translateX(-50%);white-space:pre}
.fd-sc-live[data-s]{color:var(--fd-sc-dim)}
@supports not (color:color-mix(in srgb,red,blue)){.fd-sc-live[data-s]{opacity:.5}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

export function Demo() {
  const [n, setN] = useState(0);
  return (
    <div className="fd-scd">
      <style>{demoCss}</style>
      <p className="fd-scd-line">
        <ScrambleText text="Decode the signal" trigger="mount" speed={16} scramble={10} replay={n} />
      </p>
      <button type="button" className="fd-scd-btn" onClick={() => setN((v) => v + 1)}>Replay</button>
    </div>
  );
}

const demoCss = `
.fd-scd,.fd-scd *,.fd-scd *::before,.fd-scd *::after{box-sizing:border-box}
.fd-scd{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f2f2f2;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
.fd-scd-line{margin:0;padding:0;max-width:100%;color:#1d1d1f;text-align:center;font:500 clamp(28px,7.2vw,72px)/1.1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:-.04em;--fd-sc-dim:rgba(29,29,31,.3)}
.fd-scd-btn{appearance:none;-webkit-appearance:none;margin:0;height:34px;padding:0 16px;border:0;border-radius:9999px;background:rgba(0,0,0,.06);color:#3c3c43;font:500 13px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;cursor:pointer;transition:background-color 200ms}
.fd-scd-btn:hover{background:rgba(0,0,0,.1)}
.fd-scd-btn:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
`;
