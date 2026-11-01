/**
 * VelocityMarquee — an infinite marquee whose speed and skew react to scroll
 * velocity. Scrolling down speeds it up in its own direction, scrolling up
 * reverses it briefly; skew follows the velocity on a spring. Hover (or
 * keyboard focus) eases the row to a stop.
 *
 * Props:
 * - children: the row content (rendered twice for a seamless loop).
 * - speed: base px/s (default 60). direction: 1 (left) | -1 (right).
 * - boost: how much scroll velocity adds (default 0.9).
 * - maxSkew: degrees at full velocity (default 8).
 * - pauseOnHover (default true).
 * - scrollContainer: optional ref; otherwise nearest scrollable ancestor.
 * CSS vars: --fd-mqv-gap.
 *
 * Browser support: evergreen. One rAF loop per marquee, paused off-screen and
 * when the tab is hidden.
 * Accessibility: the duplicate copy is aria-hidden; the row is a region with
 * an aria-label. Reduced motion: static row, no auto-play.
 */
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";

export interface VelocityMarqueeProps {
  children: ReactNode;
  speed?: number;
  direction?: 1 | -1;
  boost?: number;
  maxSkew?: number;
  pauseOnHover?: boolean;
  label?: string;
  scrollContainer?: RefObject<HTMLElement | null>;
  className?: string;
  style?: CSSProperties;
}

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && p.scrollHeight > p.clientHeight + 1) return p;
    p = p.parentElement;
  }
  return null;
}

export function VelocityMarquee({
  children,
  speed = 60,
  direction = 1,
  boost = 0.9,
  maxSkew = 8,
  pauseOnHover = true,
  label = "Marquee",
  scrollContainer,
  className,
  style,
}: VelocityMarqueeProps) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const tr = track.current;
    const one = first.current;
    if (!el || !tr || !one) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.reduced = "";
      return;
    }
    const sc = scrollContainer?.current ?? findScrollParent(el);
    const target: HTMLElement | Window = sc ?? window;
    const readY = () => (sc ? sc.scrollTop : window.scrollY);

    let w = one.offsetWidth;
    let x = 0;
    let lastY = readY();
    let vel = 0; // smoothed scroll velocity, px/s
    let dir = 1; // flips with scroll direction
    let hold = 1; // 1 = running, 0 = paused (hover)
    let holdGoal = 1;
    let skew = 0;
    let skewV = 0;
    let raf = 0;
    let last = 0;
    let visible = true;

    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      const y = readY();
      const inst = (y - lastY) / dt;
      lastY = y;
      vel += (inst - vel) * (1 - Math.exp(-dt * 10));
      if (Math.abs(vel) > 40) dir = vel > 0 ? 1 : -1;
      hold += (holdGoal - hold) * (1 - Math.exp(-dt * 8));
      const v = (speed + Math.abs(vel) * boost) * dir * direction * hold;
      x -= v * dt;
      if (w > 0) {
        if (x <= -w) x += w;
        else if (x > 0) x -= w;
      }
      // skew on a spring toward a velocity-derived target
      const goal = Math.max(-maxSkew, Math.min(maxSkew, (-vel / 1300) * maxSkew * direction)) * hold;
      for (let i = 0; i < 2; i++) {
        const h = dt / 2;
        skewV += (-380 * (skew - goal) - 30 * skewV) * h;
        skew += skewV * h;
      }
      tr.style.transform = `translate3d(${x.toFixed(2)}px,0,0) skewX(${skew.toFixed(3)}deg)`;
      raf = visible && !document.hidden ? requestAnimationFrame(tick) : 0;
    };
    const start = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        lastY = readY();
        raf = requestAnimationFrame(tick);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    }, { root: sc ?? null });
    io.observe(el);
    const ro = new ResizeObserver(() => {
      w = one.offsetWidth;
    });
    ro.observe(one);
    const onVis = () => start();
    const enter = () => {
      if (pauseOnHover) holdGoal = 0;
    };
    const leave = () => {
      holdGoal = 1;
    };
    const onScroll = () => start();
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("focusin", enter);
    el.addEventListener("focusout", leave);
    target.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      io.disconnect();
      ro.disconnect();
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("focusin", enter);
      el.removeEventListener("focusout", leave);
      target.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [speed, direction, boost, maxSkew, pauseOnHover, scrollContainer]);

  return (
    <div ref={root} className={`fd-mqv${className ? " " + className : ""}`} role="region" aria-label={label} style={style}>
      <style>{css}</style>
      <div ref={track} className="fd-mqv-track">
        <div ref={first} className="fd-mqv-set">
          {children}
        </div>
        <div className="fd-mqv-set" aria-hidden="true">
          {children}
        </div>
        <div className="fd-mqv-set" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

const css = `
.fd-mqv{--fd-mqv-gap:0px;position:relative;display:block;width:100%;margin:0;padding:0;overflow:hidden}
.fd-mqv,.fd-mqv *{box-sizing:border-box}
.fd-mqv-track{display:flex;width:max-content;margin:0;padding:0;will-change:transform;backface-visibility:hidden}
.fd-mqv-set{display:flex;flex:none;align-items:center;gap:var(--fd-mqv-gap);margin:0;padding:0 var(--fd-mqv-gap) 0 0}
.fd-mqv[data-reduced] .fd-mqv-set + .fd-mqv-set{display:none}
.fd-mqv[data-reduced]{overflow-x:auto}
`;

/* ------------------------------------------------------------------ Demo */

function Spark({ color }: { color: string }) {
  return (
    <svg className="fd-mqv-demo-spark" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 0 L 24 16 L 40 20 L 24 24 L 20 40 L 16 24 L 0 20 L 16 16 Z" fill={color} />
    </svg>
  );
}

const SHOES = [
  { name: "Volt 3", tag: "Road · 212 g", c1: "#D7FF3A", c2: "#0E0E10" },
  { name: "Apex Trail", tag: "Trail · 268 g", c1: "#FF5A1F", c2: "#2B1A10" },
  { name: "Tempo Lite", tag: "Track · 168 g", c1: "#3AB4FF", c2: "#0A1A2B" },
  { name: "Long Run", tag: "Marathon · 230 g", c1: "#F2F2F2", c2: "#1A1A1A" },
  { name: "Pace Max", tag: "Daily · 245 g", c1: "#FF3A7A", c2: "#2B0A16" },
];

function Shoe({ c1, c2 }: { c1: string; c2: string }) {
  return (
    <svg viewBox="0 0 220 110" className="fd-mqv-demo-shoe" aria-hidden="true">
      {/* upper */}
      <path d="M16 74 C 16 60 28 54 44 52 C 64 48 76 30 92 22 C 98 19 104 20 108 24 L 118 34 C 140 46 176 50 198 62 C 210 69 210 80 202 84 L 24 88 C 18 88 16 82 16 74 Z" fill={c1} />
      {/* heel counter + collar */}
      <path d="M16 74 C 16 60 28 54 44 52 C 40 62 38 72 40 86 L 24 88 C 18 88 16 82 16 74 Z" fill={c2} opacity=".35" />
      <path d="M92 22 C 98 19 104 20 108 24 L 118 34 C 112 34 100 30 92 22 Z" fill={c2} opacity=".5" />
      {/* laces */}
      <path d="M96 34 L 110 40 M102 42 L 118 46 M110 50 L 126 52 M118 56 L 134 58" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".85" />
      {/* swoosh-free brand stripe */}
      <path d="M50 70 C 90 66 130 58 168 64" stroke={c2} strokeWidth="5" strokeLinecap="round" fill="none" opacity=".45" />
      {/* midsole + outsole */}
      <path d="M14 80 L 204 84 C 212 86 212 96 204 98 L 28 100 C 16 100 10 90 14 80 Z" fill="#F4F4F2" />
      <path d="M18 96 L 204 96 C 206 100 202 104 196 104 L 30 104 C 22 104 18 100 18 96 Z" fill={c2} />
    </svg>
  );
}

export function Demo() {
  return (
    <div className="fd-mqv-demo">
      <style>{demoCss}</style>
      <header className="fd-mqv-demo-hero">
        <div className="fd-mqv-demo-top">
          <span className="fd-mqv-demo-logo">STRIDE/9</span>
          <span className="fd-mqv-demo-drop">Drop 04 · Autumn 2026</span>
        </div>
        <h1 className="fd-mqv-demo-h">
          Built for
          <br />
          the last mile.
        </h1>
        <p className="fd-mqv-demo-cue" aria-hidden="true">
          <span className="fd-mqv-demo-cue-line" />
          Scroll fast — the type keeps up
        </p>
      </header>

      <section className="fd-mqv-demo-band">
        <VelocityMarquee label="Stride/9 slogans" speed={70} direction={1}>
          {["Run further", "Recover faster", "Race lighter", "Carbon plate", "Zero excuses"].map((w, i) => (
            <span key={w} className="fd-mqv-demo-word" data-alt={i % 2 ? "" : undefined}>
              {w}
              <Spark color={i % 2 ? "#D7FF3A" : "#0E0E10"} />
            </span>
          ))}
        </VelocityMarquee>
        <VelocityMarquee label="Stride/9 drop 04 products" speed={50} direction={-1} className="fd-mqv-demo-row2">
          {SHOES.map((s) => (
            <a key={s.name} className="fd-mqv-demo-card" href="#shop" style={{ ["--c" as string]: s.c1 }}>
              <Shoe c1={s.c1} c2={s.c2} />
              <span className="fd-mqv-demo-card-n">{s.name}</span>
              <span className="fd-mqv-demo-card-t">{s.tag}</span>
            </a>
          ))}
        </VelocityMarquee>
      </section>

      <section className="fd-mqv-demo-copy">
        <p className="fd-mqv-demo-p">
          Hover a row to stop it. Scroll up and the rows run backwards for a beat. Drop 04 ships 12 November — members get 48 hours early.
        </p>
      </section>
    </div>
  );
}

const demoCss = `
.fd-mqv-demo{display:block;margin:0;padding:0;background:#F1F0EC;color:#0E0E10;min-height:100vh;overflow-x:clip}
.fd-mqv-demo,.fd-mqv-demo *{box-sizing:border-box}
.fd-mqv-demo-hero{display:flex;flex-direction:column;min-height:44vh;max-width:1280px;margin:0 auto;padding:28px clamp(16px,4vw,56px) 40px}
.fd-mqv-demo-top{display:flex;justify-content:space-between;align-items:center;gap:16px}
.fd-mqv-demo-logo{color:#0E0E10;font:800 1.0625rem/1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.02em}
.fd-mqv-demo-drop{color:#55554F;font:500 0.75rem/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.04em;text-transform:uppercase}
.fd-mqv-demo-h{margin:auto 0 0;padding:0;color:#0E0E10;font:800 clamp(3rem,9vw,7.5rem)/.88 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.055em;text-transform:uppercase}
.fd-mqv-demo-cue{display:inline-flex;align-items:center;gap:10px;margin:24px 0 0;padding:0;color:#55554F;font:500 0.75rem/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}
.fd-mqv-demo-cue-line{position:relative;display:block;width:1px;height:28px;overflow:hidden;background:rgba(14,14,16,.15)}
.fd-mqv-demo-cue-line::after{content:"";position:absolute;left:0;top:0;width:1px;height:12px;background:#0E0E10;animation:fd-mqv-cue 1.6s cubic-bezier(0.65,0,0.35,1) infinite}
@keyframes fd-mqv-cue{0%{transform:translateY(-12px)}100%{transform:translateY(28px)}}
.fd-mqv-demo-band{display:grid;gap:clamp(16px,3vh,28px);margin:0;padding:clamp(20px,4vh,40px) 0;background:#0E0E10;transform:rotate(-2deg) scale(1.04);transform-origin:50% 50%}
.fd-mqv-demo-word{
  display:inline-flex;align-items:center;gap:clamp(16px,2.4vw,36px);padding:0 clamp(16px,2.4vw,36px) 0 0;white-space:nowrap;
  color:#F1F0EC;font:800 clamp(3rem,8.5vw,7.5rem)/1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.05em;text-transform:uppercase;
}
.fd-mqv-demo-word[data-alt]{color:transparent;-webkit-text-stroke:2px #D7FF3A}
.fd-mqv-demo-spark{display:block;width:.42em;height:.42em;flex:none}
.fd-mqv-demo-word:not([data-alt]) .fd-mqv-demo-spark path{fill:#D7FF3A}
.fd-mqv-demo-row2 .fd-mqv-set{gap:14px;padding-right:14px}
.fd-mqv-demo-card{
  position:relative;display:grid;grid-template-columns:auto;gap:2px;width:clamp(200px,22vw,280px);margin:0;padding:14px 18px 16px;border-radius:20px;
  background:#1C1C20;color:#F1F0EC;text-decoration:none;border:1px solid rgba(255,255,255,.06);
  transition:background 240ms cubic-bezier(0.22,1,0.36,1),transform 240ms cubic-bezier(0.22,1,0.36,1);
}
.fd-mqv-demo-card:hover{background:#26262B;transform:translateY(-3px)}
.fd-mqv-demo-card:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px}
.fd-mqv-demo-shoe{display:block;width:100%;height:auto;margin:0 0 8px;filter:drop-shadow(0 10px 14px rgba(0,0,0,.45));transform:rotate(-6deg)}
.fd-mqv-demo-card-n{color:#F1F0EC;font:700 1.0625rem/1.2 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.01em}
.fd-mqv-demo-card-t{color:rgba(241,240,236,.55);font:500 0.75rem/1.3 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace}
.fd-mqv-demo-card::after{content:"";position:absolute;right:16px;top:16px;width:10px;height:10px;border-radius:50%;background:var(--c)}
.fd-mqv-demo-copy{max-width:1280px;margin:0 auto;padding:clamp(48px,10vh,96px) clamp(16px,4vw,56px) 70vh}
.fd-mqv-demo-p{margin:0;padding:0;max-width:560px;color:#55554F;font:400 1.0625rem/1.5 ui-sans-serif,-apple-system,"Inter",sans-serif}
@media (prefers-reduced-motion: reduce){.fd-mqv-demo-cue-line::after{animation:none}}
`;
