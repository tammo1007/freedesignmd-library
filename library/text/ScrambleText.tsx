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

const LOG = [
  { t: "09:41:07", k: "BLOCK", m: "Credential stuffing · 1,284 req/min from AS 49981", c: "#FF6B6B" },
  { t: "09:41:12", k: "ISOLATE", m: "Host fin-ws-0217 · beacon to 185.220.101.4", c: "#FFB547" },
  { t: "09:41:19", k: "PATCH", m: "CVE-2026-31337 · OpenSSH 9.8p1 on 42 nodes", c: "#5BE3A8" },
  { t: "09:41:23", k: "VERIFY", m: "Token rotation complete · 0 sessions orphaned", c: "#7AA7FF" },
];

export function Demo() {
  const [n, setN] = useState(0);
  return (
    <div className="fd-sc-demo">
      <style>{demoCss}</style>
      <div className="fd-sc-demo-grid" aria-hidden="true" />
      <header className="fd-sc-demo-bar">
        <span className="fd-sc-demo-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l8 3v6.2c0 4.7-3.3 8.4-8 9.8-4.7-1.4-8-5.1-8-9.8V5.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M8.5 12.2l2.3 2.3 4.7-4.8" fill="none" stroke="#5BE3A8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <ScrambleText text="SENTRYLINE" trigger="mount" speed={18} />
        </span>
        <nav className="fd-sc-demo-nav" aria-label="Primary">
          {["Platform", "Threat intel", "Customers", "Docs"].map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s/g, "-")}`}>
              <ScrambleText text={l} trigger="manual" speed={60} scramble={4} />
            </a>
          ))}
        </nav>
        <span className="fd-sc-demo-status"><span aria-hidden="true" />All systems nominal</span>
      </header>

      <main className="fd-sc-demo-main">
        <p className="fd-sc-demo-eyebrow">
          <ScrambleText text="// AUTONOMOUS SOC · v4.2" trigger="mount" speed={40} />
        </p>
        <h1 className="fd-sc-demo-h1">
          <ScrambleText text="Breaches decoded" trigger="mount" speed={16} scramble={10} replay={n} />
          <br />
          <span className="fd-sc-demo-h1b"><ScrambleText text="before they land." trigger="mount" speed={18} scramble={18} replay={n} /></span>
        </h1>
        <p className="fd-sc-demo-sub">
          Sentryline correlates 2.3 billion events a day across endpoint, identity and cloud, and contains threats in a median 38 seconds, with a human-readable
          reason for every action.
        </p>
        <div className="fd-sc-demo-cta">
          <a className="fd-sc-demo-btn" href="#trial"><ScrambleText text="Start 14-day trial" trigger="manual" speed={50} scramble={5} /></a>
          <button type="button" className="fd-sc-demo-btn fd-sc-demo-btn--ghost" onClick={() => setN((v) => v + 1)}>
            <ScrambleText text="Re-run decrypt" trigger="manual" speed={50} scramble={5} />
          </button>
        </div>

        <section className="fd-sc-demo-panel" aria-label="Live response log">
          <div className="fd-sc-demo-panelhead">
            <span>response.log</span>
            <span>tail -f · eu-central-1</span>
          </div>
          <ol className="fd-sc-demo-log">
            {LOG.map((l, i) => (
              <li key={l.t}>
                <span className="fd-sc-demo-time">{l.t}</span>
                <span className="fd-sc-demo-kind" style={{ color: l.c }}>
                  <ScrambleText text={l.k.padEnd(7, " ")} speed={20} scramble={10 + i * 6} replay={n} />
                </span>
                <ScrambleText className="fd-sc-demo-msg" text={l.m} speed={70} scramble={14 + i * 8} replay={n} />
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

const demoCss = `
.fd-sc-demo,.fd-sc-demo *,.fd-sc-demo *::before,.fd-sc-demo *::after{box-sizing:border-box}
.fd-sc-demo{--d-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --d-ink:#E8EEF2;--d-mut:#8693A0;--d-line:rgba(232,238,242,.1);--d-acc:#5BE3A8;
  position:relative;overflow:hidden;margin:0;padding:0;min-height:100vh;background:#07090C;color:var(--d-ink);font:400 15px/1.5 var(--d-font);-webkit-font-smoothing:antialiased}
.fd-sc-demo-grid{position:absolute;inset:0;pointer-events:none;
  background-image:linear-gradient(rgba(91,227,168,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(91,227,168,.05) 1px,transparent 1px);background-size:48px 48px;
  mask-image:radial-gradient(70% 60% at 50% 30%,#000,transparent);-webkit-mask-image:radial-gradient(70% 60% at 50% 30%,#000,transparent)}
.fd-sc-demo-bar{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0;padding:18px clamp(16px,4vw,48px);border-bottom:1px solid var(--d-line)}
.fd-sc-demo-brand{display:inline-flex;align-items:center;gap:10px;margin:0;font:600 15px/1 var(--d-mono);letter-spacing:.12em}
.fd-sc-demo-brand svg{display:block}
.fd-sc-demo-nav{display:flex;gap:28px;margin:0}
.fd-sc-demo-nav a{margin:0;padding:6px 0;color:var(--d-mut);font:500 13px/1 var(--d-mono);text-decoration:none;text-transform:uppercase;letter-spacing:.06em}
.fd-sc-demo-nav a:hover{color:var(--d-ink)}
.fd-sc-demo-status{display:inline-flex;align-items:center;gap:8px;margin:0;color:var(--d-mut);font:500 12px/1 var(--d-mono)}
.fd-sc-demo-status span{display:block;width:7px;height:7px;border-radius:50%;background:var(--d-acc);box-shadow:0 0 12px var(--d-acc)}
.fd-sc-demo-main{position:relative;max-width:1200px;margin:0 auto;padding:clamp(40px,9vh,96px) clamp(16px,4vw,48px) 48px}
.fd-sc-demo-eyebrow{margin:0 0 24px;color:var(--d-acc);font:500 13px/1 var(--d-mono);letter-spacing:.08em}
.fd-sc-demo-h1{margin:0;color:var(--d-ink);font:600 clamp(40px,7vw,92px)/1 var(--d-mono);letter-spacing:-.05em}
.fd-sc-demo-h1b{color:var(--d-acc)}
.fd-sc-demo-sub{max-width:36em;margin:28px 0 0;color:var(--d-mut);font:400 17px/1.55 var(--d-font);letter-spacing:-.01em;text-wrap:pretty}
.fd-sc-demo-cta{display:flex;flex-wrap:wrap;gap:12px;margin:32px 0 0}
.fd-sc-demo-btn{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;height:46px;margin:0;padding:0 22px;border:0;border-radius:9999px;background:var(--d-acc);color:#04120B;
  font:600 14px/1 var(--d-mono);text-decoration:none;cursor:pointer;letter-spacing:.02em;transition:transform 120ms cubic-bezier(.22,1,.36,1)}
.fd-sc-demo-btn:active{transform:scale(.96)}
.fd-sc-demo-btn--ghost{background:transparent;color:var(--d-ink);box-shadow:inset 0 0 0 1px rgba(232,238,242,.24)}
.fd-sc-demo a:focus-visible,.fd-sc-demo button:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
.fd-sc-demo-panel{margin:clamp(40px,8vh,72px) 0 0;border-radius:20px;background:rgba(232,238,242,.03);box-shadow:inset 0 0 0 1px var(--d-line);overflow:hidden}
.fd-sc-demo-panelhead{display:flex;justify-content:space-between;gap:12px;margin:0;padding:12px 18px;border-bottom:1px solid var(--d-line);color:var(--d-mut);font:500 12px/1 var(--d-mono)}
.fd-sc-demo-log{margin:0;padding:10px 0;list-style:none}
.fd-sc-demo-log li{display:grid;grid-template-columns:88px 92px 1fr;gap:12px;margin:0;padding:9px 18px;font:400 13px/1.4 var(--d-mono);color:var(--d-ink)}
.fd-sc-demo-time{color:var(--d-mut)}
.fd-sc-demo-kind{font-weight:600}
@media (max-width:820px){.fd-sc-demo-nav{display:none}.fd-sc-demo-log li{grid-template-columns:72px 1fr}.fd-sc-demo-msg{grid-column:1/-1;color:var(--d-mut)}}
@media (max-width:480px){.fd-sc-demo-status{display:none}}
`;
