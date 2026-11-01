/**
 * GlassMenu — a Liquid Glass button that morphs into its menu and back.
 *
 * One glass surface, not two: the capsule's width, height and corner radius
 * spring from button-size to menu-size (anchored to the button's corner), the
 * button face cross-fades out and the menu items cascade in. The refraction
 * map follows the shape every frame. Regular variant — menus carry text.
 *
 * Props: label (button text, or aria-label for icon buttons), icon,
 *   items: ({ id, label, icon?, detail?, destructive?, disabled? } | "separator")[],
 *   onSelect(id), align ("start" | "end" — which corner stays anchored),
 *   placement ("down" | "up"), tone ("light" | "dark"), menuWidth (px).
 * Keyboard: Enter/Space/ArrowDown open (focus first item), ArrowUp opens on
 *   last; Arrow keys/Home/End move; Enter selects; Escape or Tab closes and
 *   returns focus. Click outside closes. role="menu"/"menuitem",
 *   aria-haspopup, aria-expanded, aria-controls.
 * Reduced motion: shape changes instantly; content fades only.
 * Browser support: refraction in Chromium; frosted glass elsewhere.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { GlassScope, LiquidGlass, useGlassEnv, useSpring } from "./liquid-glass";

export type GlassMenuItem = { id: string; label: string; icon?: ReactNode; detail?: string; destructive?: boolean; disabled?: boolean } | "separator";

export interface GlassMenuProps {
  label: string;
  icon?: ReactNode;
  /** Show only the icon on the button (label becomes aria-label). */
  iconOnly?: boolean;
  items: GlassMenuItem[];
  onSelect?: (id: string) => void;
  align?: "start" | "end";
  placement?: "down" | "up";
  tone?: "light" | "dark";
  menuWidth?: number;
  /** Button height in px (default 44). */
  size?: number;
  className?: string;
}

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
const ITEM_H = 44;
const SEP_H = 9;
const PAD = 8;
const MENU_R = 26;

export function GlassMenu({
  label,
  icon,
  iconOnly = false,
  items,
  onSelect,
  align = "start",
  placement = "down",
  tone = "light",
  menuWidth = 260,
  size = 44,
  className,
}: GlassMenuProps) {
  const env = useGlassEnv();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [open, setOpen] = useState(false);
  const [render, setRender] = useState(false); // keep menu mounted while closing
  const wrap = useRef<HTMLDivElement | null>(null);
  const surf = useRef<HTMLElement | null>(null);
  const btn = useRef<HTMLButtonElement | null>(null);
  const face = useRef<HTMLSpanElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const focusOnOpen = useRef<"first" | "last" | null>(null);
  const closed = useRef({ w: size, h: size });

  const menuH = items.reduce((h, it) => h + (it === "separator" ? SEP_H : ITEM_H), 0) + PAD * 2;

  // progress spring 0 (button) → 1 (menu); geometry is interpolated from it
  const paint = (p: number) => {
    const s = surf.current;
    if (!s) return;
    const c = closed.current;
    const q = Math.max(0, p);
    const w = c.w + (menuWidth - c.w) * q;
    const h = c.h + (menuH - c.h) * q;
    const r = Math.min(h / 2, c.h / 2 + (MENU_R - c.h / 2) * Math.min(1, q));
    s.style.width = `${w.toFixed(2)}px`;
    s.style.height = `${h.toFixed(2)}px`;
    s.style.borderRadius = `${r.toFixed(2)}px`;
    s.style.setProperty("--fd-gmn-p", Math.min(1, Math.max(0, p)).toFixed(3));
    if (face.current) face.current.style.opacity = String(Math.max(0, 1 - q * 3.2).toFixed(3));
    if (menu.current) menu.current.style.opacity = String(Math.min(1, Math.max(0, (q - 0.35) / 0.5)).toFixed(3));
  };
  const prog = useSpring(0, paint, { stiffness: 340, damping: 27, precision: 0.002 });

  // measure the resting button
  useIso(() => {
    const b = btn.current;
    if (!b) return;
    closed.current = { w: b.offsetWidth, h: b.offsetHeight };
    if (!open && prog.value === 0) paint(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, icon, iconOnly, size]);

  const show = useCallback(
    (where: "first" | "last" | null) => {
      focusOnOpen.current = where;
      setRender(true);
      setOpen(true);
    },
    [],
  );
  const hide = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => btn.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (open) {
      prog.stiffness = 340;
      prog.damping = 27;
      if (env.reducedMotion) prog.set(1);
      else prog.to(1);
      const where = focusOnOpen.current;
      if (where) {
        requestAnimationFrame(() => {
          const list = menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])");
          if (!list?.length) return;
          (where === "first" ? list[0] : list[list.length - 1]).focus({ preventScroll: true });
        });
      } else requestAnimationFrame(() => menu.current?.focus({ preventScroll: true }));
    } else if (render) {
      prog.stiffness = 420;
      prog.damping = 32;
      if (env.reducedMotion) prog.set(0);
      else prog.to(0);
      const t = window.setTimeout(() => setRender(false), env.reducedMotion ? 0 : 420);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // outside click closes
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) hide(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, hide]);

  const onBtnKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      show("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      show("last");
    }
  };
  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? []);
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      hide();
    } else if (e.key === "Tab") {
      hide(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const n = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
      list[n]?.focus();
    }
  };

  const choose = (id: string) => {
    onSelect?.(id);
    hide();
  };

  return (
    <GlassScope>
      <div ref={wrap} className={["fd-gmn", `fd-gmn--${align}`, `fd-gmn--${placement}`, `fd-gmn--${tone}`, open ? "is-open" : "", className ?? ""].filter(Boolean).join(" ")} style={{ "--fd-gmn-h": `${size}px` } as CSSProperties}>
        <style>{css}</style>
        <button
          ref={btn}
          type="button"
          className={`fd-gmn-btn${iconOnly ? " is-icon" : ""}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={`fd-gmn-${uid}`}
          aria-label={iconOnly ? label : undefined}
          onClick={() => (open ? hide() : show(null))}
          onKeyDown={onBtnKey}
        >
          {icon ? <span className="fd-gmn-ico" aria-hidden="true">{icon}</span> : null}
          {!iconOnly ? <span className="fd-gmn-lbl">{label}</span> : null}
          {!iconOnly ? (
            <svg className="fd-gmn-chev" viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 4.5 3 3 3-3" />
            </svg>
          ) : null}
        </button>
        <LiquidGlass ref={surf} className="fd-gmn-surf" variant="regular" tone={tone} radius="auto" interactive={!open} aria-hidden={!render || undefined}>
          <span ref={face} className="fd-gmn-face" aria-hidden="true">
            {icon ? <span className="fd-gmn-ico">{icon}</span> : null}
            {!iconOnly ? <span className="fd-gmn-lbl">{label}</span> : null}
            {!iconOnly ? (
              <svg aria-hidden="true" focusable="false" className="fd-gmn-chev" viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 4.5 3 3 3-3" />
              </svg>
            ) : null}
          </span>
          {render ? (
            <div ref={menu} id={`fd-gmn-${uid}`} role="menu" aria-label={label} tabIndex={-1} className="fd-gmn-menu" style={{ width: menuWidth }} onKeyDown={onMenuKey}>
              {items.map((it, i) =>
                it === "separator" ? (
                  <div key={`s${i}`} role="separator" className="fd-gmn-sep" />
                ) : (
                  <div
                    key={it.id}
                    role="menuitem"
                    tabIndex={-1}
                    aria-disabled={it.disabled || undefined}
                    className={`fd-gmn-item${it.destructive ? " is-danger" : ""}`}
                    style={{ "--i": i } as CSSProperties}
                    onClick={() => !it.disabled && choose(it.id)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !it.disabled) {
                        e.preventDefault();
                        choose(it.id);
                      }
                    }}
                  >
                    <span className="fd-gmn-item-ico" aria-hidden="true">{it.icon}</span>
                    <span className="fd-gmn-item-lbl">{it.label}</span>
                    {it.detail ? <span className="fd-gmn-item-detail">{it.detail}</span> : null}
                  </div>
                ),
              )}
            </div>
          ) : null}
        </LiquidGlass>
      </div>
    </GlassScope>
  );
}

const css = `
.fd-gmn,.fd-gmn *,.fd-gmn *::before,.fd-gmn *::after{box-sizing:border-box}
.fd-gmn{position:relative;display:inline-block;vertical-align:middle;margin:0;padding:0;color:#0B0B0F;font:600 15px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-0.01em}
.fd-gmn--dark{color:#F2F2F7}
.fd-gmn.is-open{z-index:50}
.fd-gmn-btn{position:relative;z-index:2;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:var(--fd-gmn-h);min-width:var(--fd-gmn-h);margin:0;padding:0 16px;border:0;border-radius:999px;background:transparent;color:transparent;
  font:inherit;letter-spacing:inherit;cursor:pointer;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent}
.fd-gmn-btn.is-icon{width:var(--fd-gmn-h);padding:0}
.fd-gmn-btn > *{visibility:hidden}
.fd-gmn.is-open .fd-gmn-btn{pointer-events:none}
.fd-gmn-btn:focus-visible{outline:2px solid color-mix(in srgb,#0A84FF 70%,transparent);outline-offset:2px}
.fd-gmn-surf{position:absolute !important;top:0;z-index:1;display:block;overflow:hidden;margin:0;padding:0;pointer-events:none;will-change:width,height}
.fd-gmn.is-open .fd-gmn-surf{pointer-events:auto;z-index:3}
.fd-gmn--start .fd-gmn-surf{left:0}
.fd-gmn--end .fd-gmn-surf{right:0}
.fd-gmn--up .fd-gmn-surf{top:auto;bottom:0}
.fd-gmn-face{position:absolute;top:0;left:0;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:var(--fd-gmn-h);min-width:var(--fd-gmn-h);margin:0;padding:0 16px;white-space:nowrap;color:inherit;font:inherit}
.fd-gmn--end .fd-gmn-face{left:auto;right:0}
.fd-gmn--up .fd-gmn-face{top:auto;bottom:0}
.fd-gmn-btn.is-icon + .fd-gmn-surf .fd-gmn-face{padding:0;width:var(--fd-gmn-h)}
.fd-gmn-ico,.fd-gmn-ico svg{display:block;width:20px;height:20px;margin:0;padding:0}
.fd-gmn-lbl{display:block;margin:0;padding:0}
.fd-gmn-chev{display:block;opacity:0.6;margin:0 -2px 0 -2px}
.fd-gmn-menu{position:absolute;top:0;left:0;margin:0;padding:${PAD}px;outline:none;opacity:0}
.fd-gmn--end .fd-gmn-menu{left:auto;right:0}
.fd-gmn--up .fd-gmn-menu{top:auto;bottom:0}
.fd-gmn-item{display:flex;align-items:center;gap:12px;height:${ITEM_H}px;margin:0;padding:0 14px 0 12px;border-radius:${MENU_R - PAD}px;color:inherit;
  font:500 15px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-0.01em;text-align:left;cursor:pointer;outline:none;white-space:nowrap;
  transform:translateY(calc((1 - var(--fd-gmn-p,0)) * -6px));transition:background-color var(--fd-dur-1) linear}
.fd-gmn--up .fd-gmn-item{transform:translateY(calc((1 - var(--fd-gmn-p,0)) * 6px))}
.fd-gmn-item:hover,.fd-gmn-item:focus-visible{background:rgba(11,11,15,0.07)}
.fd-gmn--dark .fd-gmn-item:hover,.fd-gmn--dark .fd-gmn-item:focus-visible{background:rgba(255,255,255,0.1)}
.fd-gmn-item:focus-visible{box-shadow:inset 0 0 0 2px color-mix(in srgb,#0A84FF 70%,transparent)}
.fd-gmn-item[aria-disabled="true"]{opacity:0.4;cursor:default;background:none}
.fd-gmn-item.is-danger{color:#E5372C}
.fd-gmn--dark .fd-gmn-item.is-danger{color:#FF6961}
.fd-gmn-item-ico{display:grid;place-items:center;width:22px;height:22px;flex:none;margin:0;padding:0}
.fd-gmn-item-ico svg{display:block;width:20px;height:20px}
.fd-gmn-item-lbl{flex:1;display:block;margin:0;padding:0}
.fd-gmn-item-detail{display:block;margin:0;padding:0;font:500 13px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;opacity:0.55}
.fd-gmn-sep{height:1px;margin:4px 12px;padding:0;background:rgba(11,11,15,0.1)}
.fd-gmn--dark .fd-gmn-sep{background:rgba(255,255,255,0.12)}
@media (prefers-reduced-motion: reduce){.fd-gmn-item{transform:none}}
`;

/* ───────────────────────── demo: trading position context menu ───────────────────────── */

const s = (d: ReactNode) => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const IC = {
  more: s(<><circle cx="6" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="18" cy="12" r="1.4" fill="currentColor" /></>),
  buy: s(<path d="M12 19V5M6 11l6-6 6 6" />),
  sell: s(<path d="M12 5v14M6 13l6 6 6-6" />),
  alert: s(<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15ZM10 20.5h4" />),
  stop: s(<><circle cx="12" cy="12" r="8" /><path d="M8.5 12h7" /></>),
  share: s(<path d="M12 4v11M8 7.5 12 4l4 3.5M6 12v6.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V12" />),
  close: s(<path d="M6 6l12 12M18 6 6 18" />),
  range: s(<><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>),
  check: s(<path d="m5 12.5 4.5 4.5L19 7.5" />),
};

/** Deterministic price series (SSR-safe). */
const SERIES = Array.from({ length: 120 }, (_, i) => {
  const t = i / 119;
  return Math.round((182 + Math.sin(t * 9) * 4 + Math.sin(t * 23 + 1) * 1.6 + t * 14 + Math.cos(t * 47) * 0.7) * 100) / 100;
});

export function Demo() {
  const [toast, setToast] = useState<string | null>(null);
  const [range, setRange] = useState("1M");
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);
  const min = Math.min(...SERIES);
  const max = Math.max(...SERIES);
  const pts = SERIES.map((v, i) => `${((i / (SERIES.length - 1)) * 1000).toFixed(1)},${(260 - ((v - min) / (max - min)) * 220).toFixed(1)}`).join(" ");
  const RANGES = ["1D", "1W", "1M", "3M", "1Y", "All"];
  return (
    <div className="fd-gmnd">
      <style>{demoCss}</style>
      <div className="fd-gmnd-card">
        <header className="fd-gmnd-head">
          <div className="fd-gmnd-tick">
            <span className="fd-gmnd-logo" aria-hidden="true">N</span>
            <div>
              <p className="fd-gmnd-sym">NRDX · Nordlys Energy</p>
              <p className="fd-gmnd-ex">XSTO · Position: 240 shares</p>
            </div>
          </div>
          <div className="fd-gmnd-actions">
            <GlassMenu
              label={range === "All" ? "All time" : range}
              icon={IC.range}
              align="end"
              tone="dark"
              menuWidth={200}
              onSelect={setRange}
              items={RANGES.map((r) => ({ id: r, label: r === "All" ? "All time" : r, icon: r === range ? IC.check : undefined }))}
            />
            <GlassMenu
              label="Position actions"
              iconOnly
              icon={IC.more}
              tone="dark"
              align="end"
              menuWidth={272}
              onSelect={(id) => setToast(
                {
                  buy: "Buy order ticket opened",
                  sell: "Sell order ticket opened",
                  alert: "Alert set at SEK 200.00",
                  stop: "Trailing stop set at −4%",
                  share: "Link to NRDX copied",
                  close: "Close position — confirm in ticket",
                }[id] ?? id,
              )}
              items={[
                { id: "buy", label: "Buy more", icon: IC.buy, detail: "B" },
                { id: "sell", label: "Sell", icon: IC.sell, detail: "S" },
                "separator",
                { id: "alert", label: "Price alert", icon: IC.alert },
                { id: "stop", label: "Trailing stop", icon: IC.stop, detail: "−4%" },
                { id: "share", label: "Share", icon: IC.share },
                "separator",
                { id: "close", label: "Close position", icon: IC.close, destructive: true },
              ]}
            />
          </div>
        </header>
        <div className="fd-gmnd-price">
          <span className="fd-gmnd-big">SEK 198.42</span>
          <span className="fd-gmnd-chg">+12.86 (6.93%)</span>
        </div>
        <p className="fd-gmnd-meta">Market value SEK 47 620.80 · Unrealised +SEK 3 086.40</p>
        <svg className="fd-gmnd-chart" viewBox="0 0 1000 280" preserveAspectRatio="none" aria-label="Price chart, up 6.93% this month" role="img">
          <defs>
            <linearGradient id="fdgmndfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#30D158" stopOpacity="0.35" />
              <stop offset="1" stopColor="#30D158" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[40, 100, 160, 220].map((y) => (
            <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <polygon points={`0,280 ${pts} 1000,280`} fill="url(#fdgmndfill)" />
          <polyline points={pts} fill="none" stroke="#30D158" strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        <dl className="fd-gmnd-stats">
          {[
            ["Open", "196.10"],
            ["Day range", "195.02 – 199.80"],
            ["Volume", "3.21 M"],
            ["P/E", "18.4"],
            ["Mkt cap", "SEK 61.2 bn"],
            ["Div. yield", "2.6%"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={`fd-gmnd-toast${toast ? " is-on" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const D = `"SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif`;
const M = `ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace`;
const demoCss = `
.fd-gmnd,.fd-gmnd *,.fd-gmnd *::before,.fd-gmnd *::after{box-sizing:border-box}
.fd-gmnd{position:relative;min-height:100vh;width:100%;margin:0;padding:48px 20px;display:flex;align-items:center;justify-content:center;overflow:hidden;
  background:radial-gradient(700px 400px at 70% 10%,rgba(48,209,88,0.18),transparent 60%),radial-gradient(600px 500px at 10% 90%,rgba(10,132,255,0.16),transparent 60%),#0B0B0F;color:#F2F2F7;font:400 15px/1.4 ${F};letter-spacing:normal}
.fd-gmnd-card{position:relative;width:100%;max-width:760px;margin:0;padding:24px;border-radius:28px;background:#16161B;box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.08),0 40px 80px -40px rgba(0,0,0,0.9)}
.fd-gmnd-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 20px;padding:0}
.fd-gmnd-tick{display:flex;align-items:center;gap:12px;min-width:0}
.fd-gmnd-logo{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#64D2FF,#5E5CE6);font:800 20px/1 ${D};color:#fff}
.fd-gmnd-sym{margin:0;font:700 17px/1.2 ${F};letter-spacing:-0.01em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fd-gmnd-ex{margin:2px 0 0;font:500 13px/1.2 ${F};color:#8E8E99}
.fd-gmnd-actions{display:flex;gap:10px;align-items:center;flex:none}
.fd-gmnd-price{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 4px}
.fd-gmnd-big{font:700 clamp(2.25rem,6vw,3.25rem)/1 ${D};letter-spacing:-0.035em;color:#fff;font-variant-numeric:tabular-nums}
.fd-gmnd-chg{font:600 17px/1 ${F};color:#30D158;font-variant-numeric:tabular-nums}
.fd-gmnd-meta{margin:0 0 16px;font:500 13px/1.4 ${F};color:#8E8E99}
.fd-gmnd-chart{display:block;width:100%;height:220px;margin:0 0 16px}
.fd-gmnd-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin:0;padding:0;border-top:0.5px solid rgba(255,255,255,0.1)}
.fd-gmnd-stats div{margin:0;padding:12px 0;border-bottom:0.5px solid rgba(255,255,255,0.08)}
.fd-gmnd-stats dt{margin:0 0 2px;font:500 12px/1.2 ${F};color:#8E8E99}
.fd-gmnd-stats dd{margin:0;font:500 15px/1.3 ${M};color:#F2F2F7}
.fd-gmnd-toast{position:absolute;left:50%;bottom:28px;margin:0;padding:12px 18px;border-radius:999px;background:#F2F2F7;color:#0B0B0F;font:600 14px/1 ${F};white-space:nowrap;
  transform:translate(-50%,20px);opacity:0;transition:opacity 240ms cubic-bezier(0.22,1,0.36,1),transform 420ms cubic-bezier(0.34,1.56,0.64,1);pointer-events:none}
.fd-gmnd-toast.is-on{opacity:1;transform:translate(-50%,0)}
@media (max-width:560px){
  .fd-gmnd{padding:20px 12px;align-items:flex-start}
  .fd-gmnd-card{padding:18px}
  .fd-gmnd-ex{display:none}
  .fd-gmnd-sym{font-size:15px}
  .fd-gmnd-tick{gap:10px}
  .fd-gmnd-logo{width:38px;height:38px;font-size:17px}
  .fd-gmnd-actions{gap:8px}
  .fd-gmnd-stats{grid-template-columns:repeat(2,1fr)}
  .fd-gmnd-chart{height:160px}
}
`;
