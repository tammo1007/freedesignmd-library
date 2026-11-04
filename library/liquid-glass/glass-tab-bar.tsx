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

/* ───────────────────────── demo ───────────────────────── */

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

export function Demo() {
  const [tab, setTab] = useState("home");
  return (
    <div className="fd-gtd">
      <style>{demoCss}</style>
      <div className="fd-gtd-bar">
        <GlassTabBar tabs={TABS} value={tab} onChange={setTab} accent="#FA2D48" />
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-gtd,.fd-gtd *,.fd-gtd *::before,.fd-gtd *::after{box-sizing:border-box}
.fd-gtd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 16px;overflow:hidden;color:#1d1d1f;font:400 15px/1.4 ${F};letter-spacing:normal;
  background:radial-gradient(46% 62% at 28% 32%,#ffcfa6 0%,transparent 70%),radial-gradient(44% 58% at 74% 68%,#b7c3ff 0%,transparent 70%),radial-gradient(30% 40% at 62% 22%,#ffc2dc 0%,transparent 70%),#f1eeea}
.fd-gtd-bar{width:min(100%,360px);margin:0;padding:0}
.fd-gtd-bar .fd-gtab{width:100%}
`;
