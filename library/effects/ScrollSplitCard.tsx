/**
 * ScrollSplitCard, a pinned scroll scene. One card splits into three panels,
 * fans out in 3D and flips one by one to reveal three services on the back.
 * Progress is scrubbed by scroll and lightly smoothed so wheel steps glide.
 *
 * Props:
 * - front: ReactNode, artwork for the whole card; each panel shows its third.
 * - services: three { kicker, title, body, points, meta, accent }.
 * - intro / outro: headings above the card; they crossfade mid-scene.
 * - length: scroll length in viewport heights (default 3.2).
 * - scrollContainer: ref to a scrolling element. If omitted, the nearest
 *   scrollable ancestor is detected, falling back to the window.
 * - cue: label of the scroll hint (default "Scroll"); pass null to hide it.
 * CSS vars: --fd-ssc-bg, --fd-ssc-back, --fd-ssc-ink, --fd-ssc-radius.
 *
 * Layout: three columns on wide stages, three rows under 640px (flip on X).
 * Browser support: all evergreen browsers (3D transforms, position: sticky).
 * Accessibility: service copy is real text in the DOM at all times; the front
 * artwork is aria-hidden. prefers-reduced-motion shows the revealed services
 * without pinning or flipping.
 */
import { useEffect, useId, useRef } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";

export type SplitService = {
  kicker: string;
  title: string;
  body: string;
  points: string[];
  meta: string;
  accent: string;
  /** Optional big display mark on the back, e.g. "0→1". */
  glyph?: string;
};

export interface ScrollSplitCardProps {
  front: ReactNode;
  services: [SplitService, SplitService, SplitService];
  intro?: ReactNode;
  outro?: ReactNode;
  length?: number;
  scrollContainer?: RefObject<HTMLElement | null>;
  cue?: string | null;
  className?: string;
  style?: CSSProperties;
}

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
// cubic-bezier(0.65, 0, 0.35, 1)-like in/out, cheap closed form
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && p.scrollHeight > p.clientHeight + 1) return p;
    p = p.parentElement;
  }
  return null;
}

export function ScrollSplitCard({
  front,
  services,
  intro,
  outro,
  length = 3.2,
  scrollContainer,
  cue = "Scroll",
  className,
  style,
}: ScrollSplitCardProps) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const whole = useRef<HTMLDivElement>(null);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const introRef = useRef<HTMLDivElement>(null);
  const outroRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    const st = stage.current;
    const cd = card.current;
    if (!el || !st || !cd) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.dataset.reduced = "";
      const setOrient = () => (el.dataset.orient = st.clientWidth < 640 ? "rows" : "cols");
      setOrient();
      const ro = new ResizeObserver(setOrient);
      ro.observe(el);
      return () => ro.disconnect();
    }

    const sc = scrollContainer?.current ?? findScrollParent(el);
    const target: HTMLElement | Window = sc ?? window;
    if (sc) el.dataset.contained = "";

    let rows = false;
    let gap = 24;
    let R = 24;
    let vh = 0;
    let shown = -1;
    let raf = 0;
    let visible = true;
    let lastT = 0;
    let lastRi = -1;

    const measure = () => {
      vh = sc ? sc.clientHeight : window.innerHeight;
      if (sc) el.style.setProperty("--fd-ssc-vh", `${vh}px`);
      const w = st.clientWidth;
      const h = st.clientHeight || vh;
      rows = w < 640;
      el.dataset.orient = rows ? "rows" : "cols";
      let W: number;
      let H: number;
      if (rows) {
        gap = 12;
        R = 20;
        W = Math.min(w - 32, 520);
        H = Math.min(h * 0.6, 560);
      } else {
        gap = Math.round(Math.min(32, w * 0.022));
        R = 26;
        W = Math.min(1000, w - 96 - gap * 2);
        H = Math.min(h * 0.58, W * 0.6);
      }
      cd.style.width = `${Math.round(W)}px`;
      cd.style.height = `${Math.round(H)}px`;
      el.style.setProperty("--fd-ssc-r", `${R}px`);
      lastRi = -1;
    };

    const progress = () => {
      const r = el.getBoundingClientRect();
      const top = sc ? r.top - sc.getBoundingClientRect().top : r.top;
      const range = r.height - vh;
      return range > 0 ? clamp(-top / range) : 0;
    };

    const render = (p: number) => {
      const sep = easeInOut(seg(p, 0.05, 0.32));
      const fan = Math.sin(Math.PI * seg(p, 0.05, 0.46));
      // one whole card while closed: hides sub-pixel seams between panels
      const split = p > 0.051;
      if (whole.current) whole.current.style.opacity = split ? "0" : "1";
      const ri = Math.round(R * sep * 10) / 10;
      if (ri !== lastRi) {
        cd.style.setProperty("--fd-ssc-ri", `${ri}px`);
        lastRi = ri;
      }
      const cardScale = 0.94 + 0.06 * easeInOut(seg(p, 0, 0.3));
      cd.style.transform = `scale(${cardScale.toFixed(4)})`;

      for (let i = 0; i < 3; i++) {
        const pn = panels.current[i];
        if (!pn) continue;
        const d = i - 1;
        const f = easeInOut(seg(p, 0.34 + i * 0.075, 0.62 + i * 0.075));
        const lift = Math.sin(Math.PI * f);
        let t: string;
        if (rows) {
          const y = d * gap * sep;
          const x = fan * (d === 0 ? -10 : 14 * d);
          const rz = -d * 2.4 * fan;
          const rx = -d * 16 * fan;
          t = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${(lift * 70 + fan * 20).toFixed(2)}px) rotateZ(${rz.toFixed(3)}deg) rotateX(${(rx - 180 * f).toFixed(3)}deg)`;
        } else {
          const x = d * gap * sep;
          const y = fan * (d === 0 ? -14 : 18) - lift * 14;
          const rz = d * 3.2 * fan + d * 1.6 * lift;
          const ry = -d * 18 * fan;
          t = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${(lift * 90 + fan * 30).toFixed(2)}px) rotateZ(${rz.toFixed(3)}deg) rotateY(${(ry + 180 * f).toFixed(3)}deg)`;
        }
        pn.style.transform = t;
        pn.style.zIndex = String(lift > 0.05 ? 3 : d === 0 ? 2 : 1);
      }

      const swap = easeInOut(seg(p, 0.36, 0.56));
      if (introRef.current) {
        introRef.current.style.opacity = (1 - swap).toFixed(3);
        introRef.current.style.transform = `translate3d(0,${(-18 * swap).toFixed(2)}px,0)`;
      }
      if (outroRef.current) {
        outroRef.current.style.opacity = swap.toFixed(3);
        outroRef.current.style.transform = `translate3d(0,${(18 * (1 - swap)).toFixed(2)}px,0)`;
      }
      if (cueRef.current) cueRef.current.style.opacity = (1 - seg(p, 0, 0.06)).toFixed(3);
      if (fill.current) fill.current.style.transform = `scaleX(${p.toFixed(4)})`;
    };

    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
      lastT = t;
      const goal = progress();
      if (shown < 0) shown = goal;
      // critically damped glide toward the scroll position
      shown += (goal - shown) * (1 - Math.exp(-dt * 14));
      if (Math.abs(goal - shown) < 0.0004) shown = goal;
      render(shown);
      raf = shown !== goal ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!raf && visible && !document.hidden) {
        lastT = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const onResize = () => {
      measure();
      render(shown < 0 ? progress() : shown);
      kick();
    };

    measure();
    shown = progress();
    render(shown);

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) kick();
      },
      { root: sc ?? null, rootMargin: "200px 0px" },
    );
    io.observe(el);
    const ro = new ResizeObserver(onResize);
    ro.observe(st);
    target.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", kick);
    return () => {
      io.disconnect();
      ro.disconnect();
      target.removeEventListener("scroll", kick);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", kick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollContainer]);

  return (
    <section
      ref={root}
      className={`fd-ssc${className ? " " + className : ""}`}
      data-orient="cols"
      style={{ ["--fd-ssc-len" as string]: String(length), ...style }}
    >
      <style>{css}</style>
      <div ref={stage} className="fd-ssc-stage">
        <div className="fd-ssc-heads">
          {intro && (
            <div ref={introRef} className="fd-ssc-head fd-ssc-intro">
              {intro}
            </div>
          )}
          {outro && (
            <div ref={outroRef} className="fd-ssc-head fd-ssc-outro">
              {outro}
            </div>
          )}
        </div>
        <div className="fd-ssc-scene">
          <div ref={card} className="fd-ssc-card">
            <div ref={whole} className="fd-ssc-whole" aria-hidden="true">
              <div className="fd-ssc-art fd-ssc-art-whole">{front}</div>
            </div>
            {services.map((s, i) => (
              <div
                key={i}
                ref={(n) => {
                  panels.current[i] = n;
                }}
                className="fd-ssc-panel"
                data-i={i}
              >
                <div className="fd-ssc-face fd-ssc-front" aria-hidden="true">
                  <div className="fd-ssc-art">{front}</div>
                </div>
                <article className="fd-ssc-face fd-ssc-back" style={{ ["--fd-ssc-accent" as string]: s.accent }}>
                  <div className="fd-ssc-back-top">
                    <span className="fd-ssc-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="fd-ssc-kicker">{s.kicker}</span>
                  </div>
                  {s.glyph && (
                    <span className="fd-ssc-glyph" aria-hidden="true">
                      {s.glyph}
                    </span>
                  )}
                  <h3 className="fd-ssc-title">{s.title}</h3>
                  <p className="fd-ssc-body">{s.body}</p>
                  <ul className="fd-ssc-points">
                    {s.points.map((pt) => (
                      <li key={pt} className="fd-ssc-point">
                        {pt}
                      </li>
                    ))}
                  </ul>
                  <div className="fd-ssc-meta">{s.meta}</div>
                </article>
              </div>
            ))}
          </div>
        </div>
        <div className="fd-ssc-foot" aria-hidden="true">
          {cue && (
            <div ref={cueRef} className="fd-ssc-cue">
              <span className="fd-ssc-cue-line" />
              {cue}
            </div>
          )}
          <span className="fd-ssc-rail">
            <span ref={fill} className="fd-ssc-fill" />
          </span>
        </div>
      </div>
    </section>
  );
}

const css = `
.fd-ssc{
  --fd-ease-out:cubic-bezier(0.22,1,0.36,1);--fd-ease-in-out:cubic-bezier(0.65,0,0.35,1);
  --fd-spring:cubic-bezier(0.34,1.56,0.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-ssc-bg:#0B0B0F;--fd-ssc-back:#F4F1EA;--fd-ssc-ink:#15140F;--fd-ssc-muted:#6B6860;
  --fd-ssc-sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --fd-ssc-display:"SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter Display","Inter","Segoe UI",Roboto,sans-serif;
  --fd-ssc-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  --fd-ssc-r:26px;--fd-ssc-ri:0px;
  position:relative;display:block;margin:0;padding:0;
  height:calc(var(--fd-ssc-len) * 100vh);height:calc(var(--fd-ssc-len) * 100svh);
  background:var(--fd-ssc-bg);color:#F5F5F7;
}
.fd-ssc,.fd-ssc *,.fd-ssc *::before,.fd-ssc *::after{box-sizing:border-box}
.fd-ssc[data-contained]{height:calc(var(--fd-ssc-len) * var(--fd-ssc-vh,100vh))}
.fd-ssc-stage{
  position:sticky;top:0;height:100vh;height:100svh;width:100%;overflow:hidden;
  display:grid;grid-template-rows:auto 1fr auto;margin:0;padding:clamp(28px,6vh,64px) 0 28px;
}
.fd-ssc[data-contained] .fd-ssc-stage{height:var(--fd-ssc-vh,100vh)}
.fd-ssc-heads{position:relative;display:grid;margin:0;padding:0 24px}
.fd-ssc-head{grid-area:1/1;margin:0;padding:0;text-align:center;will-change:transform,opacity}
.fd-ssc-outro{opacity:0}
.fd-ssc-scene{
  position:relative;display:flex;align-items:center;justify-content:center;
  perspective:1700px;perspective-origin:50% 45%;margin:0;padding:0;min-height:0;
}
.fd-ssc-card{position:relative;width:min(1000px,calc(100% - 96px));height:56%;transform-style:preserve-3d;will-change:transform}
.fd-ssc-whole{
  position:absolute;inset:0;border-radius:var(--fd-ssc-r);overflow:hidden;z-index:4;pointer-events:none;
  box-shadow:0 40px 80px -30px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.07) inset;
}
.fd-ssc-panel{
  position:absolute;top:0;left:0;width:33.3334%;height:100%;
  transform-style:preserve-3d;will-change:transform;
}
.fd-ssc-panel[data-i="1"]{left:33.3333%}
.fd-ssc-panel[data-i="2"]{left:66.6666%}
.fd-ssc[data-orient="rows"] .fd-ssc-panel{left:0;width:100%;height:33.3334%}
.fd-ssc[data-orient="rows"] .fd-ssc-panel[data-i="1"]{top:33.3333%}
.fd-ssc[data-orient="rows"] .fd-ssc-panel[data-i="2"]{top:66.6666%}
.fd-ssc-face{
  position:absolute;inset:0;overflow:hidden;margin:0;
  -webkit-backface-visibility:hidden;backface-visibility:hidden;
}
.fd-ssc-front{box-shadow:0 30px 60px -28px rgba(0,0,0,.7)}
.fd-ssc-panel[data-i="0"] .fd-ssc-front{border-radius:var(--fd-ssc-r) var(--fd-ssc-ri) var(--fd-ssc-ri) var(--fd-ssc-r)}
.fd-ssc-panel[data-i="1"] .fd-ssc-front{border-radius:var(--fd-ssc-ri)}
.fd-ssc-panel[data-i="2"] .fd-ssc-front{border-radius:var(--fd-ssc-ri) var(--fd-ssc-r) var(--fd-ssc-r) var(--fd-ssc-ri)}
.fd-ssc[data-orient="rows"] .fd-ssc-panel[data-i="0"] .fd-ssc-front{border-radius:var(--fd-ssc-r) var(--fd-ssc-r) var(--fd-ssc-ri) var(--fd-ssc-ri)}
.fd-ssc[data-orient="rows"] .fd-ssc-panel[data-i="2"] .fd-ssc-front{border-radius:var(--fd-ssc-ri) var(--fd-ssc-ri) var(--fd-ssc-r) var(--fd-ssc-r)}
.fd-ssc-art{position:absolute;top:0;left:0;width:300%;height:100%;margin:0;padding:0}
.fd-ssc-art-whole{width:100%}
.fd-ssc-panel[data-i="1"] .fd-ssc-art{left:-100%}
.fd-ssc-panel[data-i="2"] .fd-ssc-art{left:-200%}
.fd-ssc[data-orient="rows"] .fd-ssc-panel .fd-ssc-art{left:0;width:100%;height:300%}
.fd-ssc[data-orient="rows"] .fd-ssc-panel[data-i="1"] .fd-ssc-art{top:-100%}
.fd-ssc[data-orient="rows"] .fd-ssc-panel[data-i="2"] .fd-ssc-art{top:-200%}
.fd-ssc[data-orient="rows"] .fd-ssc-art-whole{height:100%}

.fd-ssc-back{
  transform:rotateY(180deg);border-radius:var(--fd-ssc-r);
  background:var(--fd-ssc-back);color:var(--fd-ssc-ink);
  display:flex;flex-direction:column;padding:clamp(20px,2.4vw,32px);
  box-shadow:0 40px 70px -34px rgba(0,0,0,.75),0 0 0 1px rgba(0,0,0,.04) inset;
}
.fd-ssc-back::after{
  content:"";position:absolute;right:-30%;top:-30%;width:80%;aspect-ratio:1;border-radius:50%;
  background:radial-gradient(closest-side,color-mix(in srgb,var(--fd-ssc-accent) 26%,transparent),transparent);
  pointer-events:none;
}
.fd-ssc[data-orient="rows"] .fd-ssc-back{transform:rotateX(180deg);padding:16px 18px;justify-content:center}
.fd-ssc-back-top{display:flex;align-items:center;gap:10px;margin:0;padding:0}
.fd-ssc-back-top + .fd-ssc-title{margin-top:auto}
.fd-ssc-num{
  display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 10px;border-radius:9999px;
  background:var(--fd-ssc-ink);color:var(--fd-ssc-back);font:600 0.75rem/1 var(--fd-ssc-mono);letter-spacing:0;
}
.fd-ssc-kicker{display:inline-flex;align-items:center;gap:8px;font:500 0.8125rem/1.2 var(--fd-ssc-sans);letter-spacing:0;color:var(--fd-ssc-muted)}
.fd-ssc-kicker::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--fd-ssc-accent)}
.fd-ssc-glyph{
  display:block;margin:clamp(18px,2.4vh,28px) 0 auto;padding:0;color:var(--fd-ssc-accent);
  font:300 clamp(2.75rem,5vw,4.5rem)/0.9 var(--fd-ssc-display);letter-spacing:-0.04em;
}
.fd-ssc-glyph + .fd-ssc-title{margin-top:14px}
.fd-ssc[data-orient="rows"] .fd-ssc-glyph{display:none}
.fd-ssc-title{
  margin:24px 0 10px;padding:0;color:var(--fd-ssc-ink);
  font:650 clamp(1.5rem,2.3vw,2rem)/1.06 var(--fd-ssc-display);letter-spacing:-0.025em;
}
.fd-ssc-body{margin:0;padding:0;color:#45433D;font:400 0.9375rem/1.5 var(--fd-ssc-sans);letter-spacing:0}
.fd-ssc-points{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:8px}
.fd-ssc-point{
  position:relative;margin:0;padding:0 0 0 22px;color:var(--fd-ssc-ink);
  font:500 0.8125rem/1.35 var(--fd-ssc-sans);letter-spacing:0;
}
.fd-ssc-point::before{
  content:"";position:absolute;left:0;top:.2em;width:12px;height:8px;
  border-left:1.6px solid var(--fd-ssc-accent);border-bottom:1.6px solid var(--fd-ssc-accent);
  transform:rotate(-45deg) scale(.8);transform-origin:30% 60%;
}
.fd-ssc-meta{
  margin:20px 0 0;padding:14px 0 0;border-top:1px solid rgba(21,20,15,.12);
  color:var(--fd-ssc-ink);font:500 0.75rem/1.2 var(--fd-ssc-mono);letter-spacing:0;
}
.fd-ssc[data-orient="rows"] .fd-ssc-back-top{margin:0}
.fd-ssc[data-orient="rows"] .fd-ssc-title{margin:10px 0 4px;font-size:1.25rem}
.fd-ssc[data-orient="rows"] .fd-ssc-body{font-size:0.8125rem;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.fd-ssc[data-orient="rows"] .fd-ssc-points,.fd-ssc[data-orient="rows"] .fd-ssc-meta{display:none}
.fd-ssc[data-orient="rows"] .fd-ssc-num{height:22px;padding:0 8px}

.fd-ssc-foot{position:relative;display:flex;flex-direction:column;align-items:center;gap:14px;margin:0;padding:0 24px}
.fd-ssc-cue{
  display:inline-flex;align-items:center;gap:10px;margin:0;padding:0;
  color:rgba(245,245,247,.6);font:500 0.75rem/1 var(--fd-ssc-mono);letter-spacing:.08em;text-transform:uppercase;
}
.fd-ssc-cue-line{position:relative;display:block;width:1px;height:28px;overflow:hidden;background:rgba(245,245,247,.16)}
.fd-ssc-cue-line::after{
  content:"";position:absolute;left:0;top:0;width:1px;height:12px;background:#F5F5F7;
  animation:fd-ssc-cue 1.6s var(--fd-ease-in-out) infinite;
}
@keyframes fd-ssc-cue{0%{transform:translateY(-12px)}100%{transform:translateY(28px)}}
.fd-ssc-rail{position:relative;display:block;width:min(220px,40%);height:2px;border-radius:9999px;background:rgba(245,245,247,.12);overflow:hidden}
.fd-ssc-fill{position:absolute;inset:0;display:block;background:#F5F5F7;transform:scaleX(0);transform-origin:0 50%;will-change:transform}

/* Reduced motion: no pin, panels shown flipped, side by side. */
.fd-ssc[data-reduced]{height:auto}
.fd-ssc[data-reduced] .fd-ssc-stage{position:relative;height:auto;min-height:0;padding:56px 0}
.fd-ssc[data-reduced] .fd-ssc-intro,.fd-ssc[data-reduced] .fd-ssc-whole,.fd-ssc[data-reduced] .fd-ssc-front,.fd-ssc[data-reduced] .fd-ssc-foot{display:none}
.fd-ssc[data-reduced] .fd-ssc-outro{opacity:1}
.fd-ssc[data-reduced] .fd-ssc-scene{perspective:none;padding:32px 24px 0}
.fd-ssc[data-reduced] .fd-ssc-card{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;width:min(1040px,100%);height:auto;transform:none}
.fd-ssc[data-reduced][data-orient="rows"] .fd-ssc-card{grid-template-columns:1fr}
.fd-ssc[data-reduced] .fd-ssc-panel,.fd-ssc[data-reduced][data-orient] .fd-ssc-panel[data-i]{position:relative;inset:auto;left:auto;top:auto;width:auto;height:auto;transform:none}
.fd-ssc[data-reduced][data-orient] .fd-ssc-body{display:block;-webkit-line-clamp:unset;overflow:visible}
.fd-ssc[data-reduced] .fd-ssc-back{position:relative;transform:none;min-height:340px}
.fd-ssc[data-reduced][data-orient="rows"] .fd-ssc-back{min-height:0;padding:22px}
@media (prefers-reduced-motion: reduce){.fd-ssc-cue-line::after{animation:none}}
@media (prefers-contrast: more){.fd-ssc-back{box-shadow:none;border:1px solid var(--fd-ssc-ink)}}
`;

/* ------------------------------------------------------------------ Demo */

const SERVICES: [SplitService, SplitService, SplitService] = [
  {
    kicker: "Zero → One",
    title: "Starting from a blank page",
    body: "You have conviction and a deadline. We turn it into a product people can hold, strategy, brand and a shippable v1.",
    points: ["Positioning & naming sprint", "Clickable prototype in 10 days", "Production v1 with analytics"],
    meta: "8–12 weeks · from €64k",
    accent: "#FF7A2F",
    glyph: "0→1",
  },
  {
    kicker: "One → N",
    title: "Scaling what already works",
    body: "Traction is real; the product is creaking. We embed with your team to rebuild the core without stopping the train.",
    points: ["Design system & component library", "Growth loops and onboarding", "Platform & performance work"],
    meta: "Quarterly retainer · 4–6 people",
    accent: "#4C6FFF",
    glyph: "1→N",
  },
  {
    kicker: "Rapid response",
    title: "When it has to ship by Friday",
    body: "A launch slipped or a feature is on fire. A senior strike team scopes in a day and delivers in a week.",
    points: ["24-hour scoping call", "Senior-only, no handovers", "Fixed price, fixed date"],
    meta: "1–3 weeks · fixed fee",
    accent: "#1FA67A",
    glyph: "72h",
  },
];

function HaldenArt() {
  const gid = `fd-ssc-ring-${useId().replace(/:/g, "")}`;
  return (
    <div className="fd-ssc-demo-art">
      <svg className="fd-ssc-demo-rings" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".42" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="720" cy="250" r="230" fill="none" stroke={`url(#${gid})`} strokeWidth="1" />
        <circle cx="720" cy="250" r="160" fill="none" stroke={`url(#${gid})`} strokeWidth="1" />
        <circle cx="720" cy="250" r="90" fill="none" stroke={`url(#${gid})`} strokeWidth="1" />
        <path d="M0 470 C 250 420 420 520 640 450 S 900 380 1000 410" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
      </svg>
      <div className="fd-ssc-demo-top">
        <span className="fd-ssc-demo-mark">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M4 4h4v6h8V4h4v16h-4v-6H8v6H4z" fill="currentColor" />
          </svg>
          Halden
        </span>
        <span className="fd-ssc-demo-small">Product studio · Copenhagen & Berlin</span>
        <span className="fd-ssc-demo-small fd-ssc-demo-right">Est. 2014, 140 products shipped</span>
      </div>
      <div className="fd-ssc-demo-big">
        We build what
        <br />
        comes next.
      </div>
    </div>
  );
}

export function Demo() {
  return (
    <div className="fd-ssc-demo">
      <style>{demoCss}</style>
      <ScrollSplitCard
        front={<HaldenArt />}
        services={SERVICES}
        intro={
          <>
            <p className="fd-ssc-demo-eyebrow">Services</p>
            <h2 className="fd-ssc-demo-h">One studio. Three ways in.</h2>
          </>
        }
        outro={
          <>
            <p className="fd-ssc-demo-eyebrow">Pick your starting point</p>
            <h2 className="fd-ssc-demo-h">Wherever you are, we meet you there.</h2>
          </>
        }
      />
      <footer className="fd-ssc-demo-after">
        <p className="fd-ssc-demo-after-k">Not sure which one fits?</p>
        <p className="fd-ssc-demo-after-t">Book a 30-minute call with a partner, no deck required.</p>
        <a className="fd-ssc-demo-btn" href="#contact">
          hello@halden.studio
        </a>
      </footer>
    </div>
  );
}

const demoCss = `
.fd-ssc-demo{display:block;margin:0;padding:0;background:#0B0B0F;color:#F5F5F7;min-height:100vh}
.fd-ssc-demo,.fd-ssc-demo *{box-sizing:border-box}
.fd-ssc-demo-eyebrow{margin:0 0 10px;padding:0;color:rgba(245,245,247,.56);font:500 0.8125rem/1.2 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.06em;text-transform:uppercase}
.fd-ssc-demo-h{margin:0;padding:0;color:#F5F5F7;font:650 clamp(1.75rem,3.6vw,2.75rem)/1.04 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter","Segoe UI",sans-serif;letter-spacing:-0.03em}
.fd-ssc-demo-art{
  position:absolute;inset:0;overflow:hidden;color:#F5F5F7;
  background:
    radial-gradient(60% 70% at 78% 22%,rgba(255,122,47,.95) 0%,rgba(255,122,47,0) 60%),
    radial-gradient(55% 80% at 12% 105%,rgba(76,111,255,.95) 0%,rgba(76,111,255,0) 62%),
    radial-gradient(40% 50% at 50% 60%,rgba(47,191,143,.35) 0%,rgba(47,191,143,0) 70%),
    linear-gradient(160deg,#1A1A22 0%,#0E0E13 100%);
}
.fd-ssc-demo-art::before{
  content:"";position:absolute;inset:0;opacity:.5;
  background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);
  background-size:48px 48px;
  -webkit-mask-image:radial-gradient(80% 80% at 50% 40%,#000,transparent);mask-image:radial-gradient(80% 80% at 50% 40%,#000,transparent);
}
.fd-ssc-demo-rings{position:absolute;inset:0;display:block;width:100%;height:100%}
.fd-ssc-demo-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:20px;padding:28px 32px;flex-wrap:wrap}
.fd-ssc-demo-mark{display:inline-flex;align-items:center;gap:10px;font:650 1.25rem/1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.02em}
.fd-ssc-demo-small{font:500 0.8125rem/1.2 ui-sans-serif,-apple-system,"Inter",sans-serif;color:rgba(245,245,247,.72);letter-spacing:0}
.fd-ssc-demo-right{margin-left:auto}
.fd-ssc-demo-big{
  position:absolute;left:32px;right:32px;bottom:26px;margin:0;
  font:700 clamp(3rem,8.6vw,7.5rem)/0.9 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.055em;
}
.fd-ssc[data-orient="rows"] .fd-ssc-demo-top{padding:20px;gap:6px 14px}
.fd-ssc[data-orient="rows"] .fd-ssc-demo-right{margin-left:0}
.fd-ssc[data-orient="rows"] .fd-ssc-demo-big{left:20px;right:20px;bottom:20px;font-size:3.25rem}
.fd-ssc-demo-after{display:flex;flex-direction:column;align-items:center;gap:12px;margin:0;padding:96px 24px 120px;text-align:center}
.fd-ssc-demo-after-k{margin:0;padding:0;color:rgba(245,245,247,.56);font:500 0.9375rem/1.4 ui-sans-serif,-apple-system,"Inter",sans-serif}
.fd-ssc-demo-after-t{margin:0;padding:0;max-width:560px;color:#F5F5F7;font:600 clamp(1.5rem,3vw,2rem)/1.15 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.025em}
.fd-ssc-demo-btn{
  display:inline-flex;align-items:center;height:48px;margin:12px 0 0;padding:0 22px;border-radius:9999px;
  background:#F5F5F7;color:#0B0B0F;text-decoration:none;font:600 0.9375rem/1 ui-sans-serif,-apple-system,"Inter",sans-serif;
  transition:transform 120ms cubic-bezier(0.22,1,0.36,1);
}
.fd-ssc-demo-btn:active{transform:scale(.96);transition:transform 240ms cubic-bezier(0.34,1.56,0.64,1)}
.fd-ssc-demo-btn:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px}
`;
