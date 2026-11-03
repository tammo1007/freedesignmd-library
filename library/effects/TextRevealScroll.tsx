/**
 * ScrollTextReveal, a manifesto paragraph whose words light up one by one
 * (from a dim floor to full opacity) as the reader scrolls. Keywords wrapped
 * in *asterisks* get an accent colour and a hand-drawn marker underline that
 * draws on when the reveal reaches them.
 *
 * Props:
 * - text: string. Wrap keywords as *like this*. Paragraph breaks: "\n\n".
 * - start / end: reveal window as fractions of the viewport (where the block
 *   top/bottom meet the viewport). Default: starts when the block's top hits
 *   85% of the viewport, completes when its bottom reaches 55%.
 * - floor: starting opacity of unrevealed words (default 0.15).
 * - scrollContainer: optional ref; otherwise nearest scrollable ancestor.
 * - as: element for each paragraph (default "p").
 * CSS vars: --fd-trs-ink, --fd-trs-accent, --fd-trs-marker.
 *
 * Browser support: evergreen. Only opacity and transform are animated.
 * Accessibility: the full text is in the DOM and readable by assistive tech
 * at all times; words are aria-hidden spans with a visually hidden copy.
 * Reduced motion: shows the finished state.
 */
import { Fragment, useEffect, useMemo, useRef } from "react";
import type { CSSProperties, ElementType, RefObject } from "react";

export interface ScrollTextRevealProps {
  text: string;
  start?: number;
  end?: number;
  floor?: number;
  scrollContainer?: RefObject<HTMLElement | null>;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

type Word = { w: string; key: boolean; i: number };

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && p.scrollHeight > p.clientHeight + 1) return p;
    p = p.parentElement;
  }
  return null;
}

export function ScrollTextReveal({
  text,
  start = 0.85,
  end = 0.55,
  floor = 0.15,
  scrollContainer,
  as: Tag = "p",
  className,
  style,
}: ScrollTextRevealProps) {
  const root = useRef<HTMLDivElement>(null);

  const paras = useMemo(() => {
    let i = 0;
    return text.split(/\n\s*\n/).map((para) => {
      const out: Word[] = [];
      // split into keyword groups (*...*) and plain runs
      para.split(/(\*[^*]+\*)/).forEach((chunk) => {
        if (!chunk) return;
        const key = chunk.startsWith("*") && chunk.endsWith("*");
        const body = key ? chunk.slice(1, -1) : chunk;
        body
          .split(/\s+/)
          .filter(Boolean)
          .forEach((w) => out.push({ w, key, i: i++ }));
      });
      return out;
    });
  }, [text]);
  const total = paras.reduce((n, p) => n + p.length, 0);
  const plain = text.replace(/\*/g, "");

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const words = Array.from(el.querySelectorAll<HTMLElement>(".fd-trs-w"));
    const marks = Array.from(el.querySelectorAll<HTMLElement>(".fd-trs-mark"));
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.done = "";
      return;
    }
    const sc = scrollContainer?.current ?? findScrollParent(el);
    const target: HTMLElement | Window = sc ?? window;
    let raf = 0;
    let visible = true;
    let shown = -1;
    let goal = 0;
    let lastT = 0;
    const lastOp = new Float32Array(words.length).fill(-1);
    const markAt = marks.map((m) => Number(m.dataset.at));

    const measure = () => {
      const vh = sc ? sc.clientHeight : window.innerHeight;
      const r = el.getBoundingClientRect();
      const top = sc ? r.top - sc.getBoundingClientRect().top : r.top;
      const a = vh * start; // top at this line → 0
      const b = vh * end; // bottom at this line → 1
      const span = a - b + r.height;
      return clamp((a - top) / (span || 1));
    };

    const render = (p: number) => {
      // a soft "pen" of ~6 words wide travels through the text
      const head = p * (total + 6) - 3;
      for (let i = 0; i < words.length; i++) {
        const t = clamp((head - i) / 6 + 0.5);
        const o = Math.round((floor + (1 - floor) * t) * 100) / 100;
        if (o !== lastOp[i]) {
          lastOp[i] = o;
          words[i].style.opacity = String(o);
        }
      }
      for (let k = 0; k < marks.length; k++) {
        const t = clamp((head - markAt[k] - 0.5) / 1.6);
        marks[k].style.transform = `scaleX(${t.toFixed(3)})`;
      }
    };

    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
      lastT = t;
      goal = measure();
      if (shown < 0) shown = goal;
      shown += (goal - shown) * (1 - Math.exp(-dt * 12));
      if (Math.abs(goal - shown) < 0.0005) shown = goal;
      render(shown);
      raf = shown !== goal ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!raf && visible) {
        lastT = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    shown = measure();
    render(shown);
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) kick();
      },
      { root: sc ?? null, rootMargin: "100px 0px" },
    );
    io.observe(el);
    target.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    return () => {
      io.disconnect();
      target.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollContainer, start, end, floor, total]);

  return (
    <div ref={root} className={`fd-trs${className ? " " + className : ""}`} style={{ ["--fd-trs-floor" as string]: floor, ...style }}>
      <style>{css}</style>
      <span className="fd-trs-sr">{plain}</span>
      {paras.map((words, pi) => {
        // group consecutive keyword words so one marker spans the phrase
        const groups: Word[][] = [];
        words.forEach((w) => {
          const g = groups[groups.length - 1];
          if (g && g[0].key && w.key) g.push(w);
          else groups.push([w]);
        });
        return (
          <Tag key={pi} className="fd-trs-p" aria-hidden="true">
            {groups.map((g, gi) =>
              g[0].key ? (
                <Fragment key={gi}>
                  {g.map((w, k) => (
                    <Fragment key={w.i}>
                      <span className="fd-trs-key" data-last={k === g.length - 1 ? "" : undefined}>
                        <span className="fd-trs-w">{w.w}</span>
                        <span className="fd-trs-mark" data-at={w.i}>
                          <svg viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">
                            <path d={k === 0 ? MARK_HEAD : k === g.length - 1 ? MARK_TAIL : MARK_MID} />
                          </svg>
                        </span>
                      </span>{" "}
                    </Fragment>
                  ))}
                </Fragment>
              ) : (
                <Fragment key={gi}>
                  <span className="fd-trs-w">{g[0].w}</span>{" "}
                </Fragment>
              ),
            )}
          </Tag>
        );
      })}
    </div>
  );
}

// marker strokes: rounded head, flat middle, ragged tail
const MARK_HEAD = "M6 5 C 30 3 70 5 100 4 L 100 12 C 70 12 30 13 6 13 C 1 12 0 6 6 5 Z";
const MARK_MID = "M0 4 C 30 5 70 3 100 4 L 100 12 C 70 13 30 11 0 12 Z";
const MARK_TAIL = "M0 4 C 30 3 70 5 92 4 C 99 5 100 9 96 12 C 70 13 30 12 0 12 Z";

const css = `
.fd-trs{
  --fd-ease-out:cubic-bezier(0.22,1,0.36,1);--fd-dur-1:120ms;
  --fd-trs-ink:#0F1A14;--fd-trs-accent:#0F7B4A;--fd-trs-marker:#C8F169;
  position:relative;display:block;margin:0;padding:0;color:var(--fd-trs-ink);
}
.fd-trs,.fd-trs *{box-sizing:border-box}
.fd-trs-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.fd-trs-p{
  margin:0 0 .6em;padding:0;color:inherit;
  font:600 clamp(1.75rem,4.2vw,3.5rem)/1.12 "SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter Display","Inter","Segoe UI",Roboto,sans-serif;
  letter-spacing:-0.03em;text-wrap:pretty;
}
.fd-trs-p:last-child{margin-bottom:0}
.fd-trs-w{opacity:var(--fd-trs-floor);will-change:opacity}
.fd-trs-key{position:relative;display:inline-block;color:var(--fd-trs-accent);isolation:isolate}
.fd-trs-mark{
  position:absolute;left:-.06em;right:-.3em;bottom:-.02em;height:.5em;z-index:-1;display:block;
  transform:scaleX(0);transform-origin:0 50%;will-change:transform;
}
.fd-trs-key[data-last] .fd-trs-mark{right:-.08em}
.fd-trs-mark svg{display:block;width:100%;height:100%;overflow:visible}
.fd-trs-mark path{fill:var(--fd-trs-marker)}
.fd-trs[data-done] .fd-trs-w{opacity:1}
.fd-trs[data-done] .fd-trs-mark{transform:none}
`;

/* ------------------------------------------------------------------ Demo */

const MANIFESTO = `We don’t fund promises. We fund the boring, physical work of pulling carbon out of the air, kilns, pipes, rock, soil, and we pay for it by the *verified tonne.*

Since 2021 we’ve backed 46 teams across nine countries. Every tonne is measured twice, priced honestly and retired in public. Our job is to make permanence *cheaper than pollution.*`;

export function Demo() {
  return (
    <div className="fd-trs-demo">
      <style>{demoCss}</style>
      <section className="fd-trs-demo-hero">
        <div className="fd-trs-demo-top">
          <span className="fd-trs-demo-logo">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 4 C 7 9 7 15 12 20 C 17 15 17 9 12 4 Z" fill="currentColor" />
            </svg>
            Tidewater Climate Fund
          </span>
          <span className="fd-trs-demo-tag">Fund III · $410M</span>
        </div>
        <h1 className="fd-trs-demo-h">Our manifesto</h1>
        <p className="fd-trs-demo-cue" aria-hidden="true">
          <span className="fd-trs-demo-cue-line" />
          Scroll to read
        </p>
      </section>
      <section className="fd-trs-demo-body">
        <span className="fd-trs-demo-label">01, Why we exist</span>
        <ScrollTextReveal text={MANIFESTO} />
      </section>
      <section className="fd-trs-demo-stats">
        {[
          ["2.1M t", "CO₂ removal contracted"],
          ["46", "portfolio companies"],
          ["1,000+ yrs", "minimum storage we fund"],
        ].map(([v, l]) => (
          <div key={l} className="fd-trs-demo-stat">
            <span className="fd-trs-demo-stat-v">{v}</span>
            <span className="fd-trs-demo-stat-l">{l}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

const demoCss = `
.fd-trs-demo{display:block;margin:0;padding:0;background:#F3F1EA;color:#0F1A14;min-height:100vh;font-family:ui-sans-serif,-apple-system,"Inter","Segoe UI",sans-serif}
.fd-trs-demo,.fd-trs-demo *{box-sizing:border-box}
.fd-trs-demo-hero{display:flex;flex-direction:column;min-height:58vh;max-width:1200px;margin:0 auto;padding:28px clamp(16px,5vw,64px) 40px}
.fd-trs-demo-top{display:flex;align-items:center;justify-content:space-between;gap:16px}
.fd-trs-demo-logo{display:inline-flex;align-items:center;gap:10px;color:#0F1A14;font:600 0.9375rem/1 ui-sans-serif,-apple-system,"Inter",sans-serif;letter-spacing:-0.01em}
.fd-trs-demo-tag{padding:7px 12px;border-radius:9999px;border:1px solid rgba(15,26,20,.14);color:#4A5A50;font:500 0.75rem/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace}
.fd-trs-demo-h{margin:auto 0 0;padding:0;color:#0F1A14;font:650 clamp(3.5rem,13vw,10rem)/.88 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.055em}
.fd-trs-demo-cue{display:inline-flex;align-items:center;gap:10px;margin:28px 0 0;padding:0;color:#4A5A50;font:500 0.75rem/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}
.fd-trs-demo-cue-line{position:relative;display:block;width:1px;height:28px;overflow:hidden;background:rgba(15,26,20,.15)}
.fd-trs-demo-cue-line::after{content:"";position:absolute;left:0;top:0;width:1px;height:12px;background:#0F1A14;animation:fd-trs-cue 1.6s cubic-bezier(0.65,0,0.35,1) infinite}
@keyframes fd-trs-cue{0%{transform:translateY(-12px)}100%{transform:translateY(28px)}}
.fd-trs-demo-body{display:grid;grid-template-columns:180px minmax(0,1fr);gap:24px;max-width:1200px;margin:0 auto;padding:6vh clamp(16px,5vw,64px) 40vh}
.fd-trs-demo-label{padding-top:.9em;color:#4A5A50;font:500 0.75rem/1.3 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.04em}
.fd-trs-demo-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:1200px;margin:0 auto;padding:40px clamp(16px,5vw,64px) 120px;border-top:1px solid rgba(15,26,20,.12)}
.fd-trs-demo-stat{display:flex;flex-direction:column;gap:8px}
.fd-trs-demo-stat-v{color:#0F1A14;font:600 clamp(2rem,4vw,3rem)/1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.035em}
.fd-trs-demo-stat-l{color:#4A5A50;font:400 0.9375rem/1.4 ui-sans-serif,-apple-system,"Inter",sans-serif}
@media (max-width:720px){
  .fd-trs-demo-body{grid-template-columns:1fr;gap:12px;padding-top:6vh}
  .fd-trs-demo-label{padding-top:0}
  .fd-trs-demo-stats{grid-template-columns:1fr;gap:20px}
  .fd-trs-demo-tag{display:none}
}
@media (prefers-reduced-motion: reduce){.fd-trs-demo-cue-line::after{animation:none}}
`;
