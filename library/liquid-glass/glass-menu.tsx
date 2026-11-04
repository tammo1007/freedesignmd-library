/**
 * GlassMenu, a Liquid Glass button that morphs into its menu and back.
 *
 * One glass surface, not two: the capsule's width, height and corner radius
 * spring from button-size to menu-size (anchored to the button's corner), the
 * button face cross-fades out and the menu items cascade in. The refraction
 * map follows the shape every frame. Regular variant, menus carry text.
 *
 * Props: label (button text, or aria-label for icon buttons), icon,
 *   items: ({ id, label, icon?, detail?, destructive?, disabled? } | "separator")[],
 *   onSelect(id), align ("start" | "end", which corner stays anchored),
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

/* ───────────────────────── demo ───────────────────────── */

const s = (d: ReactNode) => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const IC = {
  more: s(<><circle cx="6" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="18" cy="12" r="1.4" fill="currentColor" /></>),
  copy: s(<><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 8.5V6.5A2.5 2.5 0 0 0 13 4H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2" /></>),
  duplicate: s(<><rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="M12 8.5v7M8.5 12h7" /></>),
  share: s(<path d="M12 4v11M8 7.5 12 4l4 3.5M6 12v6.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V12" />),
  trash: s(<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />),
};

export function Demo() {
  const [last, setLast] = useState<string | null>(null);
  return (
    <div className="fd-gmnd">
      <style>{demoCss}</style>
      <div className="fd-gmnd-stage">
        <GlassMenu
          label="Actions"
          icon={IC.more}
          menuWidth={240}
          onSelect={setLast}
          items={[
            { id: "copy", label: "Copy", icon: IC.copy },
            { id: "duplicate", label: "Duplicate", icon: IC.duplicate },
            { id: "share", label: "Share", icon: IC.share },
            "separator",
            { id: "delete", label: "Delete", icon: IC.trash, destructive: true },
          ]}
        />
        <span className="fd-gmnd-live" role="status" aria-live="polite">{last ? `Selected ${last}` : ""}</span>
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-gmnd,.fd-gmnd *,.fd-gmnd *::before,.fd-gmnd *::after{box-sizing:border-box}
.fd-gmnd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;color:#1d1d1f;font:400 15px/1.4 ${F};letter-spacing:normal;
  background:radial-gradient(46% 62% at 28% 32%,#ffcfa6 0%,transparent 70%),radial-gradient(44% 58% at 74% 68%,#b7c3ff 0%,transparent 70%),radial-gradient(30% 40% at 62% 22%,#ffc2dc 0%,transparent 70%),#f1eeea}
.fd-gmnd-stage{display:flex;align-items:flex-start;justify-content:center;width:260px;height:300px;margin:0;padding:0}
.fd-gmnd-live{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;
