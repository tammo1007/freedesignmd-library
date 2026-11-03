/**
 * HeroFintechCard, an Apple-clean hero for a corporate card. A CSS-3D metal
 * card (front, back and a stacked edge for real thickness) floats, tilts
 * toward the cursor on a spring and catches a specular highlight. As the
 * section scrolls, a sticky stage scrubs the card through a full flip and docks
 * it into a spend panel while the stats count up with the scroll.
 *
 * Props: eyebrow, title (ReactNode), lede, primaryCta, secondaryCta,
 * holder, company, last4, stats ({ label, value, prefix?, suffix?, decimals? }[]).
 * CSS vars on the root: --fd-ldg-bg, --fd-ldg-ink, --fd-ldg-accent, --fd-ldg-card-w.
 *
 * Browser support: all evergreen browsers (CSS 3D transforms, clip-path).
 * Motion: pointer tilt (spring k=380, c=30), ambient float, scroll scrub via
 * rAF + getBoundingClientRect (transforms/opacity only). The loop pauses when
 * off-screen or when the tab is hidden. prefers-reduced-motion renders the
 * composed final state without a scroll scene.
 * Accessibility: the card is decorative (aria-hidden) and its details are
 * repeated in text; stats are a <dl>; CTAs are real links with focus rings.
 */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export type LedgerStat = { label: string; value: number; prefix?: string; suffix?: string; decimals?: number };

export interface HeroFintechCardProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  holder?: string;
  company?: string;
  last4?: string;
  stats?: LedgerStat[];
  dockTitle?: ReactNode;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

function offsetIn(el: HTMLElement, stop: HTMLElement) {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== stop) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

const fmt = (v: number, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const DEFAULT_STATS: LedgerStat[] = [
  { label: "Spend under policy this month", value: 1284610, prefix: "$" },
  { label: "Receipts matched automatically", value: 14920 },
  { label: "Days to close the books", value: 1.6, decimals: 1 },
  { label: "Cashback earned", value: 30830, prefix: "$" },
];

export function HeroFintechCard({
  eyebrow = (
    <>
      <b>New</b> 2.4% back on every SaaS invoice
    </>
  ),
  title = (
    <>
      <span className="fd-ldg-line"><span>The corporate</span></span>{" "}
      <span className="fd-ldg-line"><span>card that closes</span></span>{" "}
      <span className="fd-ldg-line"><span><em>your books.</em></span></span>
    </>
  ),
  lede = "Metal cards for every employee, policy enforced at the swipe, and every receipt reconciled to your general ledger before the month is out.",
  primaryCta = { label: "Open an account", href: "#open" },
  secondaryCta = { label: "Watch the 3-min tour", href: "#tour" },
  holder = "Amara Okonkwo",
  company = "Halden Robotics",
  last4 = "4021",
  stats = DEFAULT_STATS,
  dockTitle = "Every swipe, already reconciled.",
}: HeroFintechCardProps) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const home = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const nums = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const el = root.current;
    const st = stage.current;
    if (!el || !st) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let geo = { hx: 0, hy: 0, hw: 0, hh: 0, dx: 0, dy: 0, ds: 1 };
    const measure = () => {
      if (!home.current || !slot.current || !anchor.current) return;
      const h = offsetIn(home.current, st);
      const s = offsetIn(slot.current, st);
      anchor.current.style.left = `${h.x}px`;
      anchor.current.style.top = `${h.y}px`;
      anchor.current.style.width = `${h.w}px`;
      anchor.current.style.height = `${h.w / 1.586}px`;
      const hh = h.w / 1.586;
      if (shadow.current) {
        shadow.current.style.left = `${h.x + h.w * 0.05}px`;
        shadow.current.style.top = `${h.y + hh * 0.98}px`;
      }
      geo = {
        hx: h.x, hy: h.y, hw: h.w, hh,
        dx: s.x + s.w / 2 - (h.x + h.w / 2),
        dy: s.y + s.h / 2 - (h.y + hh / 2),
        ds: s.w / h.w,
      };
    };
    if (reduced) el.setAttribute("data-static", "");
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(st);
    if (reduced) {
      nums.current.forEach((n, i) => n && (n.textContent = fmt(stats[i].value, stats[i].decimals)));
      return () => ro.disconnect();
    }

    // springs for tilt
    const sp = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    const K = 380;
    const C = 30;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = st.getBoundingClientRect();
      sp.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      sp.ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    };
    const onLeave = () => {
      sp.tx = 0;
      sp.ty = 0;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    let raf = 0;
    let last = 0;
    let visible = true;
    const t0 = performance.now();
    const lastShown: number[] = [];

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min((now - last) / 1000 || 0.016, 0.032);
      last = now;
      for (let i = 0; i < 2; i++) {
        const h = dt / 2;
        sp.vx += (-K * (sp.x - sp.tx) - C * sp.vx) * h;
        sp.vy += (-K * (sp.y - sp.ty) - C * sp.vy) * h;
        sp.x += sp.vx * h;
        sp.y += sp.vy * h;
      }
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const travel = Math.max(1, r.height - st.offsetHeight);
      const p = clamp(-r.top / travel);
      const t = (now - t0) / 1000;

      // phases
      const flip = easeIO(seg(p, 0.06, 0.78));
      const dock = easeIO(seg(p, 0.12, 0.8));
      const settle = 1 - dock;
      const floatY = Math.sin(t * 1.1) * 7 * settle;
      const floatR = Math.sin(t * 0.7) * 1.2 * settle;
      const tiltX = (-sp.y * 14 + 9) * settle + 0 * dock;
      const tiltY = sp.x * 20 * settle - 14 * settle;
      const rotY = tiltY + flip * 360;
      const rotX = tiltX + Math.sin(flip * Math.PI) * -12;
      const sc = 1 + (geo.ds - 1) * dock;
      if (card.current) {
        card.current.style.transform = `translate3d(${(geo.dx * dock).toFixed(2)}px, ${(geo.dy * dock + floatY).toFixed(2)}px, 0) scale(${sc.toFixed(4)}) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) rotateZ(${(floatR - 4 * settle).toFixed(2)}deg)`;
        // specular follows the light, which sits up-left of the pointer
        const facing = Math.cos((rotY * Math.PI) / 180);
        card.current.style.setProperty("--sx", `${(50 + sp.x * 38 - (rotY % 360) * 0.12).toFixed(1)}%`);
        card.current.style.setProperty("--sy", `${(35 + sp.y * 30).toFixed(1)}%`);
        card.current.style.setProperty("--gl", `${(0.55 + Math.abs(sp.x) * 0.35 + (1 - Math.abs(facing)) * 0.4).toFixed(3)}`);
        card.current.style.setProperty("--band", `${(sp.x * 30 + rotY * 0.18).toFixed(1)}%`);
      }
      if (shadow.current) {
        const lift = 1 - floatY / 30;
        shadow.current.style.transform = `translate3d(${(geo.dx * dock + sp.x * -18 * settle).toFixed(1)}px, ${(geo.dy * dock).toFixed(1)}px,0) scale(${(sc * lift).toFixed(3)}, ${(sc * lift * 0.9).toFixed(3)})`;
        shadow.current.style.opacity = `${(0.85 - dock * 0.55).toFixed(3)}`;
      }
      if (copy.current) {
        const c = seg(p, 0.02, 0.4);
        copy.current.style.transform = `translate3d(0, ${(-c * vh * 0.16).toFixed(1)}px, 0) scale(${(1 - c * 0.04).toFixed(4)})`;
        copy.current.style.opacity = `${(1 - ease(c)).toFixed(3)}`;
      }
      if (panel.current) {
        const q = ease(seg(p, 0.42, 0.78));
        panel.current.style.setProperty("--q", q.toFixed(4));
      }
      const cnt = ease(seg(p, 0.5, 0.92));
      nums.current.forEach((n, i) => {
        if (!n) return;
        const v = stats[i].value * cnt;
        const d = stats[i].decimals ?? 0;
        const key = Math.round(v * Math.pow(10, d));
        if (lastShown[i] === key) return;
        lastShown[i] = key;
        n.textContent = fmt(v, d);
      });
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(el);
    const onVis = () => start();
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [stats]);

  const name = holder.toUpperCase();

  return (
    <section ref={root} className="fd-ldg" aria-label="Ledger corporate card">
      <style>{css}</style>
      <div ref={stage} className="fd-ldg-stage">
        <div className="fd-ldg-bgglow" aria-hidden="true" />
        <div className="fd-ldg-grid">
          <div ref={copy} className="fd-ldg-copy">
            <p className="fd-ldg-eyebrow">
              <span className="fd-ldg-pill">{eyebrow}</span>
            </p>
            <h1 className="fd-ldg-h1">{title}</h1>
            <p className="fd-ldg-lede">{lede}</p>
            <div className="fd-ldg-ctas">
              <a className="fd-ldg-btn" href={primaryCta.href}>
                {primaryCta.label}
              </a>
              <a className="fd-ldg-link" href={secondaryCta.href}>
                <span className="fd-ldg-play" aria-hidden="true">
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" width="10" height="10"><path d="M3 1.8v8.4L10 6z" fill="currentColor" /></svg>
                </span>
                {secondaryCta.label}
              </a>
            </div>
            <p className="fd-ldg-fine">SOC 2 Type II · Issued by Calder Trust Bank, N.A., Member FDIC</p>
          </div>
          <div className="fd-ldg-visual">
            <div ref={home} className="fd-ldg-home" aria-hidden="true" />
          </div>
        </div>

        <div ref={panel} className="fd-ldg-panel">
          <div className="fd-ldg-panel-in">
            <div className="fd-ldg-slotwrap">
              <div ref={slot} className="fd-ldg-slot" aria-hidden="true" />
              <p className="fd-ldg-slotcap">
                {holder} · Corporate •••• {last4}
              </p>
            </div>
            <div className="fd-ldg-panel-copy">
              <p className="fd-ldg-panel-k">October · {company}</p>
              <h2 className="fd-ldg-h2">{dockTitle}</h2>
              <dl className="fd-ldg-stats">
                {stats.map((s, i) => (
                  <div key={s.label} className="fd-ldg-stat" style={{ ["--i" as string]: i }}>
                    <dt>{s.label}</dt>
                    <dd>
                      {s.prefix}
                      <span ref={(n) => { nums.current[i] = n; }}>0</span>
                      {s.suffix}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        <div ref={shadow} className="fd-ldg-shadow-anchor" aria-hidden="true">
          <div className="fd-ldg-shadow" />
        </div>
        <div ref={anchor} className="fd-ldg-anchor" aria-hidden="true">
          <div className="fd-ldg-enter">
            <div ref={card} className="fd-ldg-card">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="fd-ldg-edge" style={{ transform: `translateZ(${-(i + 1) * 0.55}px)` }} />
              ))}
              <div className="fd-ldg-face fd-ldg-front">
                <div className="fd-ldg-metal" />
                <div className="fd-ldg-band" />
                <div className="fd-ldg-sheen" />
                <div className="fd-ldg-fc">
                  <div className="fd-ldg-row">
                    <span className="fd-ldg-wm">LEDGER</span>
                    <svg aria-hidden="true" focusable="false" className="fd-ldg-nfc" viewBox="0 0 24 24" width="22" height="22">
                      <path d="M7.5 8.5a5 5 0 0 1 0 7M11 6a9 9 0 0 1 0 12M14.5 3.5a13 13 0 0 1 0 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="fd-ldg-chip">
                    <i /><i /><i /><i />
                  </div>
                  <div className="fd-ldg-row fd-ldg-bottom">
                    <div>
                      <span className="fd-ldg-name">{name}</span>
                      <span className="fd-ldg-co">{company}</span>
                    </div>
                    <div className="fd-ldg-right">
                      <span className="fd-ldg-num">•••• {last4}</span>
                      <span className="fd-ldg-net">
                        <b /> CORPORATE
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="fd-ldg-face fd-ldg-back">
                <div className="fd-ldg-metal" />
                <div className="fd-ldg-stripe" />
                <div className="fd-ldg-band" />
                <div className="fd-ldg-sheen" />
                <div className="fd-ldg-bc">
                  <div className="fd-ldg-sig">
                    <span>{holder}</span>
                    <b>CVV •••</b>
                  </div>
                  <p>
                    This card is property of Calder Trust Bank, N.A. and is issued under licence to {company}. Lost or stolen: +1 (415) 555-0142 · ledger.example/help
                  </p>
                  <span className="fd-ldg-wm fd-ldg-wm-s">LEDGER</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .22 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")`;

const css = `
.fd-ldg, .fd-ldg *, .fd-ldg *::before, .fd-ldg *::after { box-sizing: border-box; }
.fd-ldg {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-ldg-bg: #F5F5F7;
  --fd-ldg-ink: #0B0B0F;
  --fd-ldg-slate: #6B6B76;
  --fd-ldg-accent: #007AFF;
  --fd-ldg-card-w: min(440px, 34vw);
  --fd-ldg-sans: "SF Pro Display", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  position: relative; display: block; margin: 0; padding: 0;
  height: 185vh; min-height: 1200px;
  background: var(--fd-ldg-bg); color: var(--fd-ldg-ink);
  font: 400 1rem/1.5 var(--fd-ldg-sans);
  isolation: isolate;
}
.fd-ldg-stage {
  position: sticky; top: 0; height: 100vh; min-height: 640px; overflow: hidden;
  perspective: 1600px;
}
.fd-ldg-bgglow {
  position: absolute; inset: -10% -10% auto auto; width: 70%; height: 110%; pointer-events: none;
  background:
    radial-gradient(40% 38% at 62% 46%, rgba(160, 182, 255, 0.38), transparent 70%),
    radial-gradient(30% 30% at 78% 66%, rgba(255, 196, 168, 0.32), transparent 70%),
    radial-gradient(28% 26% at 52% 22%, rgba(196, 236, 255, 0.5), transparent 70%);
  filter: blur(10px);
  animation: fd-ldg-fade 1400ms var(--fd-ease-out) both;
}
.fd-ldg-grid {
  position: relative; z-index: 2; height: 100%;
  max-width: 1240px; margin: 0 auto; padding: 120px 40px 64px;
  display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: center; gap: 40px;
}
.fd-ldg-copy { will-change: transform, opacity; }
.fd-ldg-eyebrow { margin: 0 0 28px; padding: 0; }
.fd-ldg-pill {
  display: inline-flex; align-items: center; gap: 8px; margin: 0; padding: 6px 14px 6px 6px;
  border-radius: 9999px; background: #fff; border: 1px solid rgba(11, 11, 15, 0.06);
  box-shadow: 0 1px 2px rgba(11, 11, 15, 0.04), 0 8px 24px -12px rgba(11, 11, 15, 0.18);
  font: 500 0.8125rem/1.2 var(--fd-ldg-sans); letter-spacing: -0.005em; color: #2a2a31;
  animation: fd-ldg-rise var(--fd-dur-4) var(--fd-ease-out) 80ms both;
}
.fd-ldg-pill b {
  font: 600 0.75rem/1 var(--fd-ldg-sans); letter-spacing: 0.01em; color: #fff;
  background: linear-gradient(180deg, #1a8cff, #0063d6); padding: 5px 9px; border-radius: 9999px;
}
.fd-ldg-h1 {
  margin: 0; padding: 0; color: var(--fd-ldg-ink);
  font: 600 clamp(2.75rem, 5.1vw, 4.75rem)/1 var(--fd-ldg-sans);
  letter-spacing: -0.045em; text-wrap: balance;
}
.fd-ldg-line { display: block; overflow: hidden; padding: 0 0 0.08em; margin: 0 0 -0.08em; }
.fd-ldg-line > span { display: inline-block; animation: fd-ldg-mask var(--fd-dur-4) var(--fd-ease-out) both; }
.fd-ldg-line:nth-child(2) > span { animation-delay: 90ms; }
.fd-ldg-line:nth-child(3) > span { animation-delay: 180ms; }
.fd-ldg-h1 em {
  font-style: normal;
  background: linear-gradient(100deg, #0B0B0F 0%, #4a4a57 40%, #8d8d9a 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.fd-ldg-lede {
  margin: 28px 0 0; padding: 0; max-width: 30rem; color: var(--fd-ldg-slate);
  font: 400 clamp(1.0625rem, 1.25vw, 1.25rem)/1.5 var(--fd-ldg-sans); letter-spacing: -0.012em; text-wrap: pretty;
  animation: fd-ldg-rise var(--fd-dur-4) var(--fd-ease-out) 260ms both;
}
.fd-ldg-ctas { display: flex; flex-wrap: wrap; align-items: center; gap: 22px; margin: 36px 0 0; animation: fd-ldg-rise var(--fd-dur-4) var(--fd-ease-out) 360ms both; }
.fd-ldg-btn {
  display: inline-flex; align-items: center; margin: 0; padding: 0 24px; height: 50px; border-radius: 9999px;
  background: var(--fd-ldg-ink); color: #fff; text-decoration: none; border: 0;
  font: 500 1rem/1 var(--fd-ldg-sans); letter-spacing: -0.01em;
  box-shadow: 0 1px 0 rgba(255,255,255,.12) inset, 0 10px 30px -10px rgba(11, 11, 15, 0.55);
  transition: transform var(--fd-dur-2) var(--fd-spring), background var(--fd-dur-1);
}
.fd-ldg-btn:hover { background: #24242b; }
.fd-ldg-btn:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); transition-timing-function: var(--fd-ease-out); }
.fd-ldg-link {
  display: inline-flex; align-items: center; gap: 10px; margin: 0; padding: 0; color: var(--fd-ldg-ink); text-decoration: none;
  font: 500 1rem/1 var(--fd-ldg-sans); letter-spacing: -0.01em;
}
.fd-ldg-play {
  display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9999px; padding-left: 2px;
  background: #fff; color: var(--fd-ldg-ink); box-shadow: 0 0 0 1px rgba(11,11,15,.08), 0 4px 12px -4px rgba(11,11,15,.2);
  transition: transform var(--fd-dur-2) var(--fd-spring);
}
.fd-ldg-play svg { display: block; }
.fd-ldg-link:hover .fd-ldg-play { transform: scale(1.1); }
.fd-ldg-btn:focus-visible, .fd-ldg-link:focus-visible { outline: 2px solid rgba(0, 122, 255, 0.7); outline-offset: 2px; }
.fd-ldg-fine { margin: 40px 0 0; padding: 0; color: #8a8a95; font: 400 0.8125rem/1.4 var(--fd-ldg-sans); letter-spacing: 0; animation: fd-ldg-fade var(--fd-dur-4) var(--fd-ease-out) 520ms both; }

.fd-ldg-visual { position: relative; height: 100%; display: grid; place-items: center; }
.fd-ldg-home { width: var(--fd-ldg-card-w); aspect-ratio: 1.586; margin: 0 0 0 4%; }

.fd-ldg-anchor { position: absolute; left: 0; top: 0; z-index: 5; perspective: 1400px; pointer-events: none; }
.fd-ldg-enter { width: 100%; height: 100%; transform-style: preserve-3d; animation: fd-ldg-cardin 1100ms var(--fd-ease-out) 120ms both; }
.fd-ldg-card {
  position: relative; width: 100%; height: 100%; transform-style: preserve-3d; will-change: transform;
  transform: rotateX(9deg) rotateY(-14deg) rotateZ(-4deg);
  --sx: 40%; --sy: 30%; --gl: .6; --band: 0%;
}
.fd-ldg-face, .fd-ldg-edge {
  position: absolute; inset: 0; border-radius: 4.6% / 7.3%; overflow: hidden;
  backface-visibility: hidden; -webkit-backface-visibility: hidden;
}
.fd-ldg-edge { background: linear-gradient(90deg, #4c4d55, #9a9ba4 30%, #3b3c43 60%, #8e8f98); backface-visibility: visible; -webkit-backface-visibility: visible; }
.fd-ldg-back { transform: translateZ(-4.4px) rotateY(180deg); }
.fd-ldg-metal {
  position: absolute; inset: 0;
  background:
    ${noise},
    repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, rgba(0,0,0,0.04) 1px 2px, transparent 2px 4px),
    linear-gradient(160deg, rgba(255,255,255,0.10), transparent 35%, transparent 70%, rgba(255,255,255,0.05)),
    radial-gradient(120% 140% at 0% 0%, #2c2d34 0%, #16171b 48%, #0b0b0e 100%);
  background-size: 160px 160px, auto, auto, auto;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.09), inset 0 1px 0 rgba(255,255,255,0.18);
}
.fd-ldg-band {
  position: absolute; inset: -40%; pointer-events: none; mix-blend-mode: screen; opacity: .9;
  background: linear-gradient(115deg, transparent 34%, rgba(120,160,255,0.12) 42%, rgba(255,255,255,0.30) 49%, rgba(255,255,255,0.08) 52%, rgba(255,180,150,0.12) 58%, transparent 66%);
  transform: translateX(var(--band));
}
.fd-ldg-sheen {
  position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen; opacity: var(--gl);
  background: radial-gradient(50% 70% at var(--sx) var(--sy), rgba(255,255,255,0.26), rgba(255,255,255,0.05) 45%, transparent 70%);
}
.fd-ldg-fc, .fd-ldg-bc { position: absolute; inset: 0; padding: 7% 7.5%; display: flex; flex-direction: column; justify-content: space-between; color: #e9e9ef; }
.fd-ldg-row { display: flex; justify-content: space-between; align-items: center; }
.fd-ldg-bottom { align-items: flex-end; }
.fd-ldg-wm {
  font: 600 clamp(0.75rem, 1.05vw, 0.9375rem)/1 var(--fd-ldg-sans); letter-spacing: 0.34em;
  background: linear-gradient(180deg, #ffffff, #b9bac4 60%, #8c8d97); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 1px 0 rgba(0,0,0,0.5));
}
.fd-ldg-nfc { display: block; color: rgba(235,235,242,0.75); width: 9%; height: auto; }
.fd-ldg-chip {
  position: relative; width: 15%; aspect-ratio: 1.3; border-radius: 18%; margin: -2% 0 0;
  background: linear-gradient(135deg, #f3e2b4 0%, #c9a65e 35%, #f7e7bd 55%, #a8853f 100%);
  box-shadow: inset 0 0 0 1px rgba(80,55,10,0.35), 0 1px 1px rgba(0,0,0,0.4);
}
.fd-ldg-chip i { position: absolute; display: block; background: rgba(90,62,15,0.38); }
.fd-ldg-chip i:nth-child(1) { left: 0; right: 0; top: 33%; height: 1px; }
.fd-ldg-chip i:nth-child(2) { left: 0; right: 0; top: 66%; height: 1px; }
.fd-ldg-chip i:nth-child(3) { top: 0; bottom: 0; left: 36%; width: 1px; }
.fd-ldg-chip i:nth-child(4) { top: 22%; bottom: 22%; left: 36%; right: 36%; width: auto; background: transparent; border: 1px solid rgba(90,62,15,0.38); border-radius: 3px; }
.fd-ldg-name, .fd-ldg-co, .fd-ldg-num { display: block; margin: 0; }
.fd-ldg-name { font: 500 clamp(0.6875rem, 0.95vw, 0.875rem)/1.2 var(--fd-ldg-sans); letter-spacing: 0.14em; color: #ececf2; text-shadow: 0 1px 0 rgba(0,0,0,0.6); }
.fd-ldg-co { margin-top: 4px; font: 400 clamp(0.5625rem, 0.75vw, 0.6875rem)/1.2 var(--fd-ldg-sans); letter-spacing: 0.04em; color: #9d9ea9; }
.fd-ldg-right { text-align: right; }
.fd-ldg-num { font: 500 clamp(0.6875rem, 0.95vw, 0.875rem)/1.2 ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: 0.1em; color: #d6d6de; }
.fd-ldg-net { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; font: 600 clamp(0.5rem, 0.62vw, 0.5625rem)/1 var(--fd-ldg-sans); letter-spacing: 0.22em; color: #a4a5b0; }
.fd-ldg-net b { display: block; width: 14px; height: 14px; border-radius: 4px; background: conic-gradient(from 210deg, #8fb4ff, #f4c2ff, #ffd5a8, #8fb4ff); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.4); }
.fd-ldg-stripe { position: absolute; left: 0; right: 0; top: 11%; height: 19%; background: linear-gradient(180deg, #070708, #17171b); }
.fd-ldg-bc { justify-content: flex-end; gap: 7%; }
.fd-ldg-sig { display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 18%; padding: 0 4%; border-radius: 4px; background: repeating-linear-gradient(-45deg, #e9e6dd 0 4px, #dcd8cc 4px 8px); }
.fd-ldg-sig span { font: italic 400 clamp(0.75rem, 1.1vw, 1rem)/1 ui-serif, "New York", "Iowan Old Style", Georgia, serif; color: #2b2b33; }
.fd-ldg-sig b { font: 600 clamp(0.5rem, 0.7vw, 0.625rem)/1 ui-monospace, "SF Mono", Menlo, monospace; color: #2b2b33; letter-spacing: 0.08em; }
.fd-ldg-bc p { margin: 0; padding: 0; max-width: 88%; font: 400 clamp(0.4375rem, 0.58vw, 0.5625rem)/1.45 var(--fd-ldg-sans); color: #8e8f9a; letter-spacing: 0.01em; }
.fd-ldg-wm-s { font-size: clamp(0.5625rem, 0.75vw, 0.6875rem); align-self: flex-end; }

.fd-ldg-shadow-anchor { position: absolute; z-index: 1; left: 0; top: 0; width: 0; height: 0; pointer-events: none; will-change: transform; }
.fd-ldg-shadow {
  position: absolute; width: calc(var(--fd-ldg-card-w) * 0.9); height: calc(var(--fd-ldg-card-w) * 0.2); left: 0; top: 0;
  border-radius: 50%; background: radial-gradient(closest-side, rgba(20, 22, 40, 0.34), rgba(20,22,40,0.12) 60%, transparent);
  filter: blur(14px); animation: fd-ldg-fade 1200ms var(--fd-ease-out) 300ms both;
}

.fd-ldg-panel {
  --q: 0;
  position: absolute; z-index: 3; left: 0; right: 0; bottom: 7vh; width: min(1040px, calc(100% - 48px)); margin: 0 auto;
  transform: translate3d(0, calc((1 - var(--q)) * 48px), 0) scale(calc(0.96 + var(--q) * 0.04));
  opacity: var(--q); pointer-events: none;
}
.fd-ldg-panel-in {
  display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr); gap: 40px; align-items: center;
  padding: 28px; border-radius: 28px;
  background: rgba(255,255,255,0.72); border: 1px solid rgba(255,255,255,0.9);
  box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 30px 80px -30px rgba(30, 34, 60, 0.28), 0 0 0 1px rgba(11,11,15,0.04);
  -webkit-backdrop-filter: blur(24px) saturate(1.6); backdrop-filter: blur(24px) saturate(1.6);
}
.fd-ldg-slotwrap { margin: 0; }
.fd-ldg-slot { width: 100%; aspect-ratio: 1.586; border-radius: 4.6% / 7.3%; background: linear-gradient(180deg, #ececf1, #f6f6f9); box-shadow: inset 0 2px 6px rgba(11,11,15,0.08), inset 0 0 0 1px rgba(11,11,15,0.05); }
.fd-ldg-slotcap { margin: 14px 0 0; padding: 0; font: 500 0.8125rem/1.3 var(--fd-ldg-sans); color: var(--fd-ldg-slate); letter-spacing: 0; }
.fd-ldg-panel-k { margin: 0; padding: 0; font: 600 0.75rem/1 var(--fd-ldg-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--fd-ldg-accent); }
.fd-ldg-h2 { margin: 10px 0 0; padding: 0; font: 600 clamp(1.5rem, 2.4vw, 2rem)/1.1 var(--fd-ldg-sans); letter-spacing: -0.03em; color: var(--fd-ldg-ink); text-wrap: balance; }
.fd-ldg-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 28px; margin: 22px 0 0; padding: 0; }
.fd-ldg-stat { margin: 0; padding: 14px 0 0; border-top: 1px solid rgba(11,11,15,0.08); }
.fd-ldg-stat dt { margin: 0; padding: 0; font: 400 0.8125rem/1.3 var(--fd-ldg-sans); color: var(--fd-ldg-slate); letter-spacing: 0; }
.fd-ldg-stat dd { margin: 6px 0 0; padding: 0; font: 600 clamp(1.5rem, 2.3vw, 2rem)/1 var(--fd-ldg-sans); letter-spacing: -0.03em; color: var(--fd-ldg-ink); font-variant-numeric: tabular-nums; }

@keyframes fd-ldg-mask { from { transform: translateY(105%); } to { transform: none; } }
@keyframes fd-ldg-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes fd-ldg-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes fd-ldg-cardin {
  from { opacity: 0; transform: translate3d(40px, 80px, -260px) rotateY(-38deg) rotateX(18deg); filter: blur(10px); }
  60% { filter: blur(0); }
  to { opacity: 1; transform: none; filter: none; }
}

@media (max-width: 820px) {
  .fd-ldg { --fd-ldg-card-w: min(340px, 78vw); height: 175vh; min-height: 1300px; }
  .fd-ldg-grid { grid-template-columns: 1fr; grid-template-rows: auto 1fr; padding: 96px 20px 32px; gap: 8px; align-content: start; }
  .fd-ldg-visual { min-height: 260px; }
  .fd-ldg-home { margin: 0; }
  .fd-ldg-fine { display: none; }
  .fd-ldg-ctas { margin-top: 28px; gap: 18px; }
  .fd-ldg-lede { margin-top: 20px; }
  .fd-ldg-eyebrow { margin-bottom: 20px; }
  .fd-ldg-panel { bottom: 20px; width: calc(100% - 32px); }
  .fd-ldg-panel-in { grid-template-columns: 1fr; gap: 18px; padding: 18px; border-radius: 24px; }
  .fd-ldg-slotwrap { width: 52%; margin: 0 auto; }
  .fd-ldg-slotcap { display: none; }
  .fd-ldg-stats { gap: 12px 18px; margin-top: 14px; }
  .fd-ldg-stat { padding-top: 10px; }
  .fd-ldg-stat dd { font-size: 1.375rem; }
  .fd-ldg-stat dt { font-size: 0.75rem; }
  .fd-ldg-h2 { font-size: 1.375rem; }
}

.fd-ldg[data-static] { height: auto; min-height: 0; }
.fd-ldg[data-static] .fd-ldg-stage { position: relative; height: auto; min-height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
.fd-ldg[data-static] .fd-ldg-grid { height: auto; min-height: 88vh; }
.fd-ldg[data-static] .fd-ldg-enter { animation: none; }
.fd-ldg[data-static] .fd-ldg-panel { position: relative; left: auto; bottom: auto; transform: none; opacity: 1; margin: 0 auto 64px; }
.fd-ldg[data-static] .fd-ldg-slotwrap { display: none; }
.fd-ldg[data-static] .fd-ldg-panel-in { grid-template-columns: 1fr; }
@media (prefers-reduced-motion: reduce) {
  .fd-ldg *, .fd-ldg *::before { animation: none !important; transition-duration: 1ms !important; }
}
@media (prefers-reduced-transparency: reduce) {
  .fd-ldg-panel-in { background: #fff; -webkit-backdrop-filter: none; backdrop-filter: none; }
}
`;

/* ───────────────────────── Demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-ldg-demo">
      <style>{demoCss}</style>
      <header className="fd-ldg-demo-nav">
        <a className="fd-ldg-demo-logo" href="#top" aria-label="Ledger home">
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <rect x="1" y="4" width="18" height="12" rx="3" fill="#0B0B0F" />
            <rect x="1" y="7" width="18" height="2.4" fill="#fff" opacity=".9" />
          </svg>
          Ledger
        </a>
        <nav aria-label="Primary">
          <a href="#cards">Cards</a>
          <a href="#spend">Spend</a>
          <a href="#bills">Bill pay</a>
          <a href="#treasury">Treasury</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="fd-ldg-demo-actions">
          <a href="#signin">Sign in</a>
          <a className="fd-ldg-demo-cta" href="#open">Get started</a>
        </div>
      </header>
      <HeroFintechCard />
      <section className="fd-ldg-demo-after" aria-label="Customers">
        <p>Running finance at 38,000 companies, from seed to IPO</p>
        <ul>
          <li>Halden Robotics</li>
          <li>Northwind Bio</li>
          <li>Kestrel Air</li>
          <li>Oslo Freight</li>
          <li>Marlow &amp; Finch</li>
          <li>Tidewater</li>
        </ul>
      </section>
    </div>
  );
}

const demoCss = `
.fd-ldg-demo { position: relative; margin: 0; padding: 0; min-height: 100vh; background: #F5F5F7; color: #0B0B0F; font: 400 1rem/1.5 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif; }
.fd-ldg-demo *, .fd-ldg-demo *::before, .fd-ldg-demo *::after { box-sizing: border-box; }
.fd-ldg-demo-nav {
  position: absolute; z-index: 20; top: 0; left: 0; right: 0; height: 72px; margin: 0 auto; max-width: 1240px; padding: 0 40px;
  display: flex; align-items: center; justify-content: space-between; gap: 24px;
  animation: fd-ldg-demo-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.fd-ldg-demo-nav .fd-ldg-demo-logo { display: inline-flex; align-items: center; gap: 9px; margin: 0; color: #0B0B0F; text-decoration: none; font: 600 1.0625rem/1 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", sans-serif; letter-spacing: -0.02em; }
.fd-ldg-demo-logo svg { display: block; }
.fd-ldg-demo-nav nav { display: flex; gap: 30px; margin: 0; padding: 0; }
.fd-ldg-demo-nav a { color: #3a3a42; text-decoration: none; font: 500 0.875rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; letter-spacing: -0.005em; }
.fd-ldg-demo-nav nav a:hover, .fd-ldg-demo-actions a:hover { color: #0B0B0F; }
.fd-ldg-demo-actions { display: flex; align-items: center; gap: 20px; }
.fd-ldg-demo-actions .fd-ldg-demo-cta { display: inline-flex; align-items: center; height: 34px; padding: 0 16px; border-radius: 9999px; background: #fff; color: #0B0B0F; box-shadow: 0 0 0 1px rgba(11,11,15,.1), 0 2px 6px -2px rgba(11,11,15,.15); }
.fd-ldg-demo-nav a:focus-visible { outline: 2px solid rgba(0,122,255,.7); outline-offset: 2px; border-radius: 6px; }
.fd-ldg-demo-after { margin: 0; padding: 72px 24px 120px; text-align: center; background: #F5F5F7; }
.fd-ldg-demo-after p { margin: 0; padding: 0; color: #6B6B76; font: 500 0.875rem/1.4 ui-sans-serif, -apple-system, "Inter", sans-serif; }
.fd-ldg-demo-after ul { display: flex; flex-wrap: wrap; justify-content: center; gap: 18px 48px; margin: 28px auto 0; padding: 0; list-style: none; max-width: 980px; }
.fd-ldg-demo-after li { margin: 0; padding: 0; color: #9a9aa4; font: 600 1.25rem/1 "SF Pro Display", ui-sans-serif, -apple-system, "Inter", sans-serif; letter-spacing: -0.03em; }
@keyframes fd-ldg-demo-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
@media (max-width: 820px) {
  .fd-ldg-demo-nav { padding: 0 20px; height: 64px; }
  .fd-ldg-demo-nav nav, .fd-ldg-demo-actions a:not(.fd-ldg-demo-cta) { display: none; }
}
@media (prefers-reduced-motion: reduce) { .fd-ldg-demo-nav { animation: none; } }
`;
