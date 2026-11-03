/**
 * GlassTabBar, iOS 26-style floating tab bar in Liquid Glass.
 *
 * - Floats above content as one regular-glass capsule; Search sits apart at
 *   the trailing end in its own circular glass button (HIG).
 * - The selection is a liquid lens: it springs between tabs, stretching along
 *   its travel and settling with a small overshoot. Drag across the bar to
 *   scrub the lens; it snaps to the nearest tab on release.
 * - `minimizeOnScroll`: pass the scroll container's ref. Scrolling down
 *   collapses the bar to the active tab + search; scrolling up expands it.
 *
 * Props: tabs ({ id, label, icon }), value, onChange, onSearch,
 *   searchLabel, minimizeOnScroll (RefObject<HTMLElement>), tone, accent,
 *   className. Keyboard: Arrow keys / Home / End move between tabs (roving
 *   tabindex), Enter/Space activate. role="tablist" + aria-selected.
 * Browser support: refraction in Chromium; frosted fallback elsewhere.
 * Reduced motion: lens jumps without stretch; minimize is a quick fade.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from "react";
import { GlassScope, LiquidGlass, createVelocityTracker, useGlassEnv, useSpring } from "./liquid-glass";

export type GlassTab = { id: string; label: string; icon: ReactNode };

export interface GlassTabBarProps {
  tabs: GlassTab[];
  value: string;
  onChange: (id: string) => void;
  onSearch?: () => void;
  searchLabel?: string;
  /** Scroll container to watch; bar minimizes on scroll down, expands on scroll up. */
  minimizeOnScroll?: RefObject<HTMLElement | null>;
  tone?: "light" | "dark";
  /** Colour of the selected tab's icon + label. */
  accent?: string;
  className?: string;
  style?: CSSProperties;
}

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function GlassTabBar({
  tabs,
  value,
  onChange,
  onSearch,
  searchLabel = "Search",
  minimizeOnScroll,
  tone = "light",
  accent,
  className,
  style,
}: GlassTabBarProps) {
  const env = useGlassEnv();
  const list = useRef<HTMLDivElement | null>(null);
  const lens = useRef<HTMLSpanElement | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const active = Math.max(0, tabs.findIndex((t) => t.id === value));

  /* lens springs: x + width, with stretch from velocity */
  const paint = () => {
    const n = lens.current;
    if (!n) return;
    const v = env.reducedMotion ? 0 : lx.velocity;
    const stretch = Math.min(0.35, Math.abs(v) * 0.00045);
    n.style.transform = `translateX(${lx.value.toFixed(2)}px) scale(${(1 + stretch + lp.value * 0.1).toFixed(4)}, ${(1 - stretch * 0.55 + lp.value * 0.1).toFixed(4)})`;
    n.style.width = `${lw.value.toFixed(2)}px`;
  };
  const lx = useSpring(0, paint, { stiffness: 380, damping: 28 });
  const lw = useSpring(0, paint, { stiffness: 380, damping: 30 });
  const lp = useSpring(0, paint, { stiffness: 520, damping: 26 }); // press "lift"

  const measure = useCallback(
    (i: number) => {
      const l = list.current;
      const btn = l?.querySelectorAll<HTMLElement>("[role=tab]")[i];
      if (!l || !btn) return null;
      return { x: btn.offsetLeft, w: btn.offsetWidth };
    },
    [],
  );

  const moveTo = useCallback(
    (i: number, instant = false) => {
      const m = measure(i);
      if (!m) return;
      if (instant || env.reducedMotion) {
        lx.set(m.x);
        lw.set(m.w);
      } else {
        lx.to(m.x);
        lw.to(m.w);
      }
    },
    [measure, env.reducedMotion, lx, lw],
  );

  const first = useRef(true);
  useIso(() => {
    moveTo(active, first.current);
    first.current = false;
  }, [active, moveTo]);

  // keep the lens glued to its tab while the bar resizes (minimize/expand, viewport)
  useEffect(() => {
    const l = list.current;
    if (!l || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!draggingRef.current) moveTo(activeRef.current, true);
    });
    ro.observe(l);
    return () => ro.disconnect();
  }, [moveTo]);
  const activeRef = useRef(active);
  activeRef.current = active;
  const draggingRef = useRef(false);

  /* scrub: drag across the bar, the lens follows the finger and snaps on release */
  useEffect(() => {
    const l = list.current;
    if (!l) return;
    const vt = createVelocityTracker();
    let startX = 0;
    let startLens = 0;
    let moved = false;
    let pid = -1;
    const nearest = (cx: number) => {
      const btns = Array.from(l.querySelectorAll<HTMLElement>("[role=tab]"));
      let best = 0, bd = Infinity;
      btns.forEach((b, i) => {
        const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - cx);
        if (d < bd) (bd = d), (best = i);
      });
      return best;
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || l.classList.contains("is-min")) return;
      pid = e.pointerId;
      startX = e.clientX;
      startLens = lx.value;
      moved = false;
      vt.reset();
      vt.push(e.clientX, 0);
      // the lens lifts when you touch the selected tab
      const idx = nearest(e.clientX - l.getBoundingClientRect().left);
      if (idx === activeRef.current && !env.reducedMotion) lp.to(1);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 6) return;
      if (!moved) {
        moved = true;
        draggingRef.current = true;
        setDragging(true);
        l.setPointerCapture(pid);
        if (!env.reducedMotion) lp.to(1);
      }
      vt.push(e.clientX, 0);
      const max = l.clientWidth - lw.value;
      let x = startLens + dx;
      if (x < 0) x *= 0.3;
      if (x > max) x = max + (x - max) * 0.3;
      lx.stiffness = 900;
      lx.damping = 50;
      lx.to(x);
      const idx = nearest(x + lw.value / 2);
      const m = measure(idx);
      if (m) lw.to(m.w);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = -1;
      lp.to(0);
      if (!moved) return;
      draggingRef.current = false;
      setDragging(false);
      lx.stiffness = 380;
      lx.damping = 28;
      const { vx } = vt.get();
      const idx = nearest(lx.value + lw.value / 2 + vx * 0.06);
      const t = tabs[idx];
      if (t && t.id !== value) onChange(t.id);
      else moveTo(idx);
      // swallow the click that follows a drag
      const stop = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      l.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => l.removeEventListener("click", stop, { capture: true }), 0);
    };
    l.addEventListener("pointerdown", down);
    l.addEventListener("pointermove", move);
    l.addEventListener("pointerup", up);
    l.addEventListener("pointercancel", up);
    return () => {
      l.removeEventListener("pointerdown", down);
      l.removeEventListener("pointermove", move);
      l.removeEventListener("pointerup", up);
      l.removeEventListener("pointercancel", up);
    };
  }, [tabs, value, onChange, measure, moveTo, env.reducedMotion, lx, lw, lp]);

  /* minimize on scroll down, expand on scroll up */
  useEffect(() => {
    const sc = minimizeOnScroll?.current;
    if (!sc) return;
    let last = sc.scrollTop;
    let acc = 0;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = sc.scrollTop;
        const d = y - last;
        last = y;
        if (y < 24) {
          acc = 0;
          setMinimized(false);
          return;
        }
        acc = Math.sign(d) === Math.sign(acc) ? acc + d : d;
        if (acc > 28) setMinimized(true);
        else if (acc < -28) setMinimized(false);
      });
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      sc.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [minimizeOnScroll]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = tabs.length;
    const map: Record<string, number> = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: n - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const i = (map[e.key] + n) % n;
    onChange(tabs[i].id);
    list.current?.querySelectorAll<HTMLElement>("[role=tab]")[i]?.focus();
  };

  const cls = ["fd-gtab", minimized ? "is-min" : "", dragging ? "is-drag" : "", `fd-gtab--${tone}`, className ?? ""].filter(Boolean).join(" ");

  return (
    <GlassScope>
      <nav className={cls} style={{ ...(accent ? { "--fd-gtab-accent": accent } : null), ...style } as CSSProperties} aria-label="Primary">
        <style>{css}</style>
        <LiquidGlass className="fd-gtab-bar" variant="regular" tone={tone} radius="capsule">
          <div ref={list} className={`fd-gtab-list${minimized ? " is-min" : ""}`} role="tablist" aria-orientation="horizontal" onKeyDown={onKey}>
            <span ref={lens} className="fd-gtab-lens" aria-hidden="true" />
            {tabs.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`fd-gtab-${t.id}`}
                aria-selected={i === active}
                tabIndex={i === active ? 0 : -1}
                className="fd-gtab-tab"
                onClick={() => {
                  if (minimized) setMinimized(false);
                  else onChange(t.id);
                }}
              >
                <span className="fd-gtab-ico" aria-hidden="true">
                  {t.icon}
                </span>
                <span className="fd-gtab-lbl">{t.label}</span>
              </button>
            ))}
          </div>
        </LiquidGlass>
        <LiquidGlass as="button" type="button" className="fd-gtab-search" variant="regular" tone={tone} interactive aria-label={searchLabel} onClick={onSearch}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
          </svg>
        </LiquidGlass>
      </nav>
    </GlassScope>
  );
}

const css = `
.fd-gtab,.fd-gtab *,.fd-gtab *::before,.fd-gtab *::after{box-sizing:border-box}
.fd-gtab{--fd-gtab-accent:#007AFF;--fd-gtab-h:62px;--fd-gtab-pad:4px;
  display:flex;align-items:center;gap:10px;margin:0;padding:0;background:none;border:0;
  font:500 10px/1.1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:0.01em;color:#0B0B0F}
.fd-gtab--dark{--fd-gtab-accent:#0A84FF}
.fd-gtab-bar{flex:1 1 auto;min-width:0;height:var(--fd-gtab-h);padding:var(--fd-gtab-pad);transition:max-width var(--fd-dur-3) var(--fd-ease-out);max-width:600px}
.fd-gtab.is-min .fd-gtab-bar{flex:0 0 auto;max-width:var(--fd-gtab-h)}
.fd-gtab-list{position:relative;display:flex;height:100%;margin:0;padding:0;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.fd-gtab-lens{position:absolute;left:0;top:0;bottom:0;width:0;margin:0;padding:0;border-radius:999px;pointer-events:none;transform-origin:50% 50%;will-change:transform,width;
  background:rgba(11,11,15,0.075);box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.4)}
.fd-gtab--dark .fd-gtab-lens{background:rgba(255,255,255,0.14)}
.fd-gtab.is-drag .fd-gtab-lens{background:rgba(255,255,255,0.12);box-shadow:inset 0 1px 1px rgba(255,255,255,0.9),inset 0 -1px 1px rgba(255,255,255,0.35),0 6px 18px -4px rgba(0,0,0,0.22),inset 0 0 0 0.5px rgba(255,255,255,0.7);
  -webkit-backdrop-filter:blur(1px) saturate(1.6) brightness(1.08);backdrop-filter:blur(1px) saturate(1.6) brightness(1.08)}
.fd-gtab-tab{position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;height:100%;margin:0;padding:0 6px;border:0;border-radius:999px;background:none;color:inherit;
  font:inherit;letter-spacing:inherit;text-shadow:none;cursor:pointer;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;
  transition:opacity var(--fd-dur-2) var(--fd-ease-out),color var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring)}
.fd-gtab--dark .fd-gtab-tab{color:#F2F2F7}
.fd-gtab-tab[aria-selected="true"]{color:var(--fd-gtab-accent)}
.fd-gtab-tab:active{transform:scale(0.94);transition-duration:var(--fd-dur-1)}
.fd-gtab-ico,.fd-gtab-ico svg{display:block;width:26px;height:26px;margin:0;padding:0}
.fd-gtab-lbl{display:block;margin:0;padding:0;font:600 10px/1.1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.fd-gtab-tab:focus-visible,.fd-gtab-search:focus-visible{outline:2px solid color-mix(in srgb,#0A84FF 70%,transparent);outline-offset:2px}
.fd-gtab.is-min .fd-gtab-tab[aria-selected="false"]{flex:0 0 0;width:0;padding:0;opacity:0;pointer-events:none}
.fd-gtab.is-min .fd-gtab-lbl{opacity:0;height:0}
.fd-gtab.is-min .fd-gtab-lens{opacity:0}
.fd-gtab-search{flex:none;margin-left:auto !important;display:flex;align-items:center;justify-content:center;width:var(--fd-gtab-h);height:var(--fd-gtab-h);margin:0;padding:0;color:inherit}
.fd-gtab-search .fd-lg-glow{mix-blend-mode:normal}
.fd-gtab--dark .fd-gtab-search{color:#F2F2F7}
.fd-gtab-search svg{display:block}
.fd-gtab.is-min{--fd-gtab-h:52px}
.fd-gtab-bar,.fd-gtab-search{transition:max-width var(--fd-dur-3) var(--fd-ease-out),height var(--fd-dur-3) var(--fd-ease-out),width var(--fd-dur-3) var(--fd-ease-out)}
@media (prefers-reduced-motion: reduce){
  .fd-gtab-bar,.fd-gtab-search,.fd-gtab-tab{transition-duration:0ms}
  .fd-gtab-tab:active{transform:none}
}
@media (prefers-contrast: more){.fd-gtab-lens{background:rgba(0,0,0,0.16);box-shadow:inset 0 0 0 1px rgba(0,0,0,0.6)}.fd-gtab--dark .fd-gtab-lens{background:rgba(255,255,255,0.22);box-shadow:inset 0 0 0 1px #fff}}
`;

/* ───────────────────────── demo: music streaming app ───────────────────────── */

const ico = (d: ReactNode) => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const TABS: GlassTab[] = [
  { id: "home", label: "Home", icon: ico(<path d="M4.5 11.5 13 4.5l8.5 7V21a.5.5 0 0 1-.5.5h-5v-6h-6v6H5a.5.5 0 0 1-.5-.5Z" />) },
  {
    id: "new",
    label: "New",
    icon: ico(
      <>
        <rect x="3.5" y="3.5" width="8" height="8" rx="2" />
        <rect x="14.5" y="3.5" width="8" height="8" rx="2" />
        <rect x="3.5" y="14.5" width="8" height="8" rx="2" />
        <rect x="14.5" y="14.5" width="8" height="8" rx="2" />
      </>,
    ),
  },
  {
    id: "radio",
    label: "Radio",
    icon: ico(
      <>
        <circle cx="13" cy="13" r="2.2" />
        <path d="M8.3 17.7a6.6 6.6 0 0 1 0-9.4M17.7 8.3a6.6 6.6 0 0 1 0 9.4M5.2 20.8a11 11 0 0 1 0-15.6M20.8 5.2a11 11 0 0 1 0 15.6" />
      </>,
    ),
  },
  {
    id: "library",
    label: "Library",
    icon: ico(
      <>
        <path d="M5 4.5v17M9.5 4.5v17" />
        <path d="m14 5.2 3.9-1 4 16.6-3.9 1Z" />
      </>,
    ),
  },
];

const ART = ["#2F3650,#93705A", "#262E40,#7F8FAE", "#34292F,#B08F7C", "#1F3A3A,#6F9C95", "#3A2F4A,#9D8DC0", "#40302A,#C79A6B"];

export function Demo() {
  const [tab, setTab] = useState("home");
  const scroller = useRef<HTMLDivElement | null>(null);
  return (
    <div className="fd-gtd">
      <style>{demoCss}</style>
      <div className="fd-gtd-bg" aria-hidden="true">
        <span className="fd-gtd-ring fd-gtd-ring--a" />
        <span className="fd-gtd-ring fd-gtd-ring--b" />
        <span className="fd-gtd-grid" />
        <span className="fd-gtd-grain" />
      </div>
      <div className="fd-gtd-device">
        <div ref={scroller} className="fd-gtd-scroll" tabIndex={0} aria-label="Listen Now, scrollable">
          <div className="fd-gtd-status" aria-hidden="true">
            <span>9:41</span>
            <i />
          </div>
          <h1 className="fd-gtd-h1">Listen Now</h1>
          <div className="fd-gtd-hero" aria-hidden="true">
            <p className="fd-gtd-hero-k">Made for you</p>
            <p className="fd-gtd-hero-t">Slow Hours</p>
          </div>
          <h2 className="fd-gtd-h2">Recently played</h2>
          <div className="fd-gtd-row" aria-hidden="true">
            {ART.slice(0, 3).map((c, i) => (
              <div key={i} className="fd-gtd-item">
                <span className="fd-gtd-art" style={{ background: `linear-gradient(135deg,${c.split(",")[0]},${c.split(",")[1]})` }} />
                <i />
                <i />
              </div>
            ))}
          </div>
          <h2 className="fd-gtd-h2">Top picks</h2>
          <div className="fd-gtd-grid2" aria-hidden="true">
            {ART.map((c, i) => (
              <div key={i} className="fd-gtd-item">
                <span className="fd-gtd-art" style={{ background: `linear-gradient(${150 + i * 20}deg,${c.split(",")[1]},${c.split(",")[0]})` }} />
                <i />
                <i />
              </div>
            ))}
          </div>
        </div>
        <div className="fd-gtd-bar">
          <GlassTabBar tabs={TABS} value={tab} onChange={setTab} accent="#FA2D48" minimizeOnScroll={scroller} />
        </div>
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const D = `"SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif`;
/* fine grain, an inline SVG feTurbulence tile (no network) */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='1.4 0 0 0 -.2 1.4 0 0 0 -.2 1.4 0 0 0 -.2 0 0 0 0 1'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const demoCss = `
.fd-gtd,.fd-gtd *,.fd-gtd *::before,.fd-gtd *::after{box-sizing:border-box}
.fd-gtd{position:relative;display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:28px 16px;overflow:hidden;
  background:radial-gradient(900px 620px at 12% 0%,#DDE5FA,transparent 62%),radial-gradient(900px 620px at 96% 100%,#F3E2D6,transparent 62%),#ECEDF3;color:#0B0B0F;font:400 15px/1.4 ${F};letter-spacing:normal}
.fd-gtd-bg{position:absolute;inset:0;margin:0;padding:0;pointer-events:none}
.fd-gtd-bg > span{position:absolute;display:block}
.fd-gtd-ring{border-radius:50%;border:1px solid rgba(11,11,15,0.10)}
.fd-gtd-ring--a{left:calc(50% - 560px);top:50%;width:520px;height:520px;margin-top:-260px;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,0.7),rgba(255,255,255,0) 70%)}
.fd-gtd-ring--b{right:calc(50% - 600px);top:12%;width:380px;height:380px;border-color:rgba(60,80,170,0.16);background:linear-gradient(160deg,rgba(120,140,230,0.16),rgba(120,140,230,0))}
.fd-gtd-grid{inset:0;background:repeating-linear-gradient(90deg,rgba(11,11,15,0.05) 0 1px,transparent 1px 72px),repeating-linear-gradient(0deg,rgba(11,11,15,0.05) 0 1px,transparent 1px 72px);
  -webkit-mask:radial-gradient(60% 70% at 50% 50%,#000,transparent);mask:radial-gradient(60% 70% at 50% 50%,#000,transparent)}
.fd-gtd-grain{inset:0;background-image:${GRAIN};background-size:180px 180px;mix-blend-mode:soft-light;opacity:0.35}
.fd-gtd-device{position:relative;width:390px;max-width:100%;height:min(820px,calc(100vh - 56px));min-height:620px;margin:0;border-radius:52px;overflow:hidden;background:#F1F1F4;isolation:isolate;
  box-shadow:0 0 0 10px #0B0B0F,0 0 0 11px #2A2A31,0 50px 100px -40px rgba(20,20,40,0.55)}
.fd-gtd-scroll{position:absolute;inset:0;margin:0;padding:0 18px 140px;overflow-y:auto;overflow-x:hidden;outline:none;scrollbar-width:none;overscroll-behavior:contain;background:#F1F1F4}
.fd-gtd-scroll::-webkit-scrollbar{display:none}
.fd-gtd-status{position:relative;display:flex;align-items:center;height:52px;margin:0 6px;padding:6px 0 0;font:600 15px/1 ${F};color:#0B0B0F}
.fd-gtd-status span{margin:0;padding:0 0 0 12px}
.fd-gtd-status i{display:block;width:90px;height:26px;margin:0;border-radius:999px;background:#0B0B0F;position:absolute;left:50%;top:12px;transform:translateX(-50%)}
.fd-gtd-h1{margin:6px 0 16px;padding:0 2px;font:800 34px/1.05 ${D};letter-spacing:-0.03em;color:#0B0B0F}
.fd-gtd-h2{margin:26px 0 12px;padding:0 2px;font:700 20px/1.2 ${D};letter-spacing:-0.02em;color:#0B0B0F}
.fd-gtd-hero{position:relative;display:flex;flex-direction:column;justify-content:flex-end;aspect-ratio:16/11;margin:0;padding:20px;border-radius:28px;overflow:hidden;color:#fff;
  background:linear-gradient(140deg,#1F2447 0%,#4A3A78 52%,#B0707A 100%)}
.fd-gtd-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 72% 34%,transparent 0 58px,rgba(255,255,255,0.6) 59px 61px,transparent 62px),radial-gradient(circle at 72% 34%,rgba(255,255,255,0.28),transparent 130px)}
.fd-gtd-hero::after{content:"";position:absolute;inset:0;background-image:${GRAIN};background-size:180px 180px;mix-blend-mode:soft-light;opacity:0.4}
.fd-gtd-hero p{position:relative;z-index:1;margin:0}
.fd-gtd-hero-k{font:600 12px/1.2 ${F};letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.8)}
.fd-gtd-hero-t{margin:4px 0 0 !important;font:800 34px/1.05 ${D};letter-spacing:-0.03em;color:#fff}
.fd-gtd-row,.fd-gtd-grid2{display:grid;gap:14px 12px;margin:0;padding:0}
.fd-gtd-row{grid-template-columns:repeat(3,1fr)}
.fd-gtd-grid2{grid-template-columns:repeat(2,1fr)}
.fd-gtd-item{display:flex;flex-direction:column;gap:7px;margin:0;padding:0}
.fd-gtd-art{position:relative;display:block;aspect-ratio:1;margin:0 0 3px;border-radius:18px;overflow:hidden}
.fd-gtd-art::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 68% 36%,transparent 0 16%,rgba(255,255,255,0.5) 16.5% 18.5%,transparent 19%),radial-gradient(circle at 68% 36%,rgba(255,255,255,0.22),transparent 55%)}
.fd-gtd-art::after{content:"";position:absolute;inset:0;background-image:${GRAIN};background-size:180px 180px;mix-blend-mode:soft-light;opacity:0.4}
.fd-gtd-item > i{display:block;height:9px;margin:0;border-radius:5px;background:#DEDEE5}
.fd-gtd-item > i:last-child{width:55%;background:#E8E8EE}
.fd-gtd-bar{position:absolute;left:14px;right:14px;bottom:18px;z-index:5;margin:0;padding:0}
.fd-gtd-bar .fd-gtab{width:100%}
@media (max-width:480px){
  .fd-gtd{padding:0}
  .fd-gtd-bg{display:none}
  .fd-gtd-device{width:100%;height:100vh;min-height:0;border-radius:0;box-shadow:none}
}
`;
