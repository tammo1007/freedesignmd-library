/**
 * SplitButton, a primary action joined to a chevron that opens a menu of
 * related actions (deploy / schedule / roll back, publish / schedule…).
 *
 * Props: label, onPrimary, items[] ({ id, label, description?, icon?,
 * shortcut?, danger?, disabled?, separatorBefore? }), onSelect(item),
 * variant ("primary" | "secondary"), size ("md" | "lg"), icon, align
 * ("start" | "end"), menuLabel, theme, disabled.
 *
 * Browser support: all evergreen browsers. The menu flips above the button
 * when there is not enough room below.
 * Accessibility: WAI-ARIA menu button pattern. The chevron has
 * aria-haspopup="menu" / aria-expanded / aria-controls; the menu is
 * role="menu" with role="menuitem" children and roving focus. Keys:
 * ArrowDown/Up open + move, Home/End, type-ahead, Enter/Space activate,
 * Escape closes and returns focus, Tab closes. Reduced motion: no scale.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export interface SplitItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export interface SplitButtonProps {
  label: ReactNode;
  items: SplitItem[];
  onPrimary?: () => void;
  onSelect?: (item: SplitItem) => void;
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
  icon?: ReactNode;
  align?: "start" | "end";
  menuLabel?: string;
  disabled?: boolean;
  theme?: "light" | "dark";
  className?: string;
}

export function SplitButton({
  label,
  items,
  onPrimary,
  onSelect,
  variant = "primary",
  size = "md",
  icon,
  align = "end",
  menuLabel = "More actions",
  disabled,
  theme,
  className,
}: SplitButtonProps) {
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const typed = useRef({ s: "", t: 0 });

  const focusItem = useCallback((i: number) => {
    const els = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
    if (!els || !els.length) return;
    els[(i + els.length) % els.length].focus();
  }, []);
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) toggle.current?.focus();
  }, []);

  // flip above when there is no room below
  useLayoutEffect(() => {
    if (!open || !root.current || !menu.current) return;
    const r = root.current.getBoundingClientRect();
    const h = menu.current.offsetHeight + 12;
    setFlip(window.innerHeight - r.bottom < h && r.top > h);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const openAt = (where: "first" | "last") => {
    setOpen(true);
    requestAnimationFrame(() => focusItem(where === "first" ? 0 : -1));
  };

  const onToggleKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openAt("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAt("last");
    }
  };

  const onMenuKey = (e: KeyboardEvent) => {
    const els = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []);
    const cur = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") (e.preventDefault(), focusItem(cur + 1));
    else if (e.key === "ArrowUp") (e.preventDefault(), focusItem(cur - 1));
    else if (e.key === "Home") (e.preventDefault(), focusItem(0));
    else if (e.key === "End") (e.preventDefault(), focusItem(-1));
    else if (e.key === "Escape") (e.preventDefault(), close());
    else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const t = typed.current;
      window.clearTimeout(t.t);
      t.s += e.key.toLowerCase();
      t.t = window.setTimeout(() => (t.s = ""), 600);
      const hit = els.findIndex((el) => (el.textContent ?? "").trim().toLowerCase().startsWith(t.s));
      if (hit >= 0) focusItem(hit);
    }
  };

  const choose = (it: SplitItem) => {
    setOpen(false);
    toggle.current?.focus();
    onSelect?.(it);
  };

  return (
    <span ref={root} className={`fd-split${className ? " " + className : ""}`} data-variant={variant} data-size={size} data-align={align} data-open={open || undefined} data-flip={flip || undefined} data-fd-theme={theme}>
      <style>{css}</style>
      <span className="fd-split-group" role="group">
        <button type="button" className="fd-split-main" disabled={disabled} onClick={onPrimary}>
          {icon && <span className="fd-split-ic">{icon}</span>}
          <span>{label}</span>
        </button>
        <span className="fd-split-sep" aria-hidden="true" />
        <button
          ref={toggle}
          type="button"
          className="fd-split-chev"
          aria-label={menuLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openAt("first"))}
          onKeyDown={onToggleKey}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </span>

      {open && (
        <div ref={menu} id={menuId} className="fd-split-menu" role="menu" aria-label={menuLabel} onKeyDown={onMenuKey}>
          {items.map((it) => (
            <span key={it.id} className="fd-split-row" data-sep={it.separatorBefore || undefined}>
              <button
                type="button"
                role="menuitem"
                className="fd-split-item"
                data-danger={it.danger || undefined}
                disabled={it.disabled}
                tabIndex={-1}
                onClick={() => choose(it)}
              >
                {it.icon && <span className="fd-split-ic">{it.icon}</span>}
                <span className="fd-split-txt">
                  <span className="fd-split-t">{it.label}</span>
                  {it.description && <span className="fd-split-d">{it.description}</span>}
                </span>
                {it.shortcut && <kbd className="fd-split-kbd">{it.shortcut}</kbd>}
              </button>
            </span>
          ))}
        </div>
      )}
    </span>
  );
}

const css = `
:where(.fd-split,.fd-split *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-split,.fd-split *)::before,:where(.fd-split,.fd-split *)::after{box-sizing:border-box}
:where(.fd-split svg){display:block;flex-shrink:0}
:where(.fd-split button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-split{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --s-bg:#007AFF;--s-bg-h:#1A8CFF;--s-fg:#fff;--s-sep:rgba(255,255,255,.28);--s-ring:rgba(0,122,255,.7);
  --s-sh:0 1px 0 rgba(255,255,255,.22) inset,0 1px 2px rgba(0,40,120,.35),0 8px 18px -10px #007AFF;
  --m-bg:#fff;--m-fg:#0B0B0F;--m-mut:#6B6B76;--m-line:rgba(11,11,15,.1);--m-hover:rgba(11,11,15,.05);--m-danger:#D70015;
  --m-sh:0 0 0 1px rgba(11,11,15,.08),0 2px 4px rgba(11,11,15,.04),0 16px 40px -12px rgba(11,11,15,.25);
  position:relative;display:inline-flex;vertical-align:middle;
  font:500 15px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;color:var(--m-fg);
}
[data-fd-theme="dark"] .fd-split,.fd-split[data-fd-theme="dark"]{
  --s-bg:#0A84FF;--s-bg-h:#3B9CFF;--s-ring:rgba(10,132,255,.85);
  --m-bg:#1C1C22;--m-fg:#F5F5F7;--m-mut:#9A9AA6;--m-line:rgba(255,255,255,.08);--m-hover:rgba(255,255,255,.07);--m-danger:#FF6A60;
  --m-sh:0 0 0 1px rgba(255,255,255,.1),0 1px 0 rgba(255,255,255,.06) inset,0 2px 4px rgba(0,0,0,.3),0 24px 48px -12px rgba(0,0,0,.7)}
.fd-split[data-size="md"]{--s-h:40px;--s-fs:15px;--s-px:16px}
.fd-split[data-size="lg"]{--s-h:48px;--s-fs:17px;--s-px:20px}
.fd-split-group{position:relative;display:inline-flex;align-items:stretch;height:var(--s-h);border-radius:9999px;background:var(--s-bg);color:var(--s-fg);box-shadow:var(--s-sh);transition:box-shadow var(--fd-dur-2) var(--fd-ease-out)}
.fd-split[data-variant="secondary"]{--s-bg:var(--m-bg);--s-fg:var(--m-fg);--s-sep:var(--m-line);--s-bg-h:var(--m-hover);--s-sh:0 0 0 1px var(--m-line),0 1px 2px rgba(11,11,15,.06)}
.fd-split-main,.fd-split-chev{appearance:none;-webkit-appearance:none;border:0;outline:0;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;background:transparent;color:inherit;
  display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:var(--s-fs);font-weight:500;line-height:1;font-family:inherit;letter-spacing:inherit;
  transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring),background-color var(--fd-dur-1) var(--fd-ease-out)}
.fd-split-main{padding:0 var(--s-px) 0 calc(var(--s-px) + 2px);border-radius:9999px 0 0 9999px;white-space:nowrap}
.fd-split-chev{width:calc(var(--s-h) - 2px);padding:0;border-radius:0 9999px 9999px 0}
.fd-split-chev svg{transition:transform var(--fd-dur-3) var(--fd-spring)}
.fd-split[data-open] .fd-split-chev svg{transform:rotate(180deg)}
.fd-split-sep{width:1px;margin:10px 0;background:var(--s-sep)}
@media (hover:hover){.fd-split-main:hover:not(:disabled),.fd-split-chev:hover:not(:disabled){background:var(--s-bg-h)}}
.fd-split[data-variant="primary"] .fd-split-main:hover:not(:disabled),.fd-split[data-variant="primary"] .fd-split-chev:hover:not(:disabled){background:rgba(255,255,255,.14)}
.fd-split-main:active,.fd-split-chev:active{transform:scale(.96);transition:transform var(--fd-dur-1) var(--fd-ease-out)}
.fd-split-main:focus-visible,.fd-split-chev:focus-visible{outline:2px solid var(--s-ring);outline-offset:2px}
.fd-split-main:disabled,.fd-split-chev:disabled{opacity:.45;cursor:not-allowed}
.fd-split-ic{display:grid;place-items:center;width:18px;height:18px}.fd-split-ic svg{width:100%;height:100%}

.fd-split-menu{position:absolute;z-index:20;top:calc(100% + 8px);min-width:300px;padding:6px;border-radius:16px;background:var(--m-bg);box-shadow:var(--m-sh);transform-origin:top right;animation:fd-split-in var(--fd-dur-2) var(--fd-ease-out);outline:0}
.fd-split[data-align="end"] .fd-split-menu{right:0}
.fd-split[data-align="start"] .fd-split-menu{left:0;transform-origin:top left}
.fd-split[data-flip] .fd-split-menu{top:auto;bottom:calc(100% + 8px);transform-origin:bottom right}
.fd-split-row{display:block}
.fd-split-row[data-sep]{margin-top:6px;padding-top:6px;border-top:1px solid var(--m-line)}
.fd-split-item{appearance:none;-webkit-appearance:none;display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border:0;outline:0;border-radius:10px;background:transparent;color:var(--m-fg);cursor:pointer;text-align:left;font-family:inherit;transition:background-color var(--fd-dur-1) var(--fd-ease-out)}
.fd-split-item:hover:not(:disabled),.fd-split-item:focus-visible{background:var(--m-hover)}
.fd-split-item:focus-visible{box-shadow:0 0 0 2px var(--s-ring) inset}
.fd-split-item:disabled{opacity:.4;cursor:not-allowed}
.fd-split-item[data-danger]{color:var(--m-danger)}
.fd-split-item .fd-split-ic{color:var(--m-mut)}.fd-split-item[data-danger] .fd-split-ic{color:var(--m-danger)}
.fd-split-txt{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}
.fd-split-t{font-size:14px;font-weight:500;line-height:1.2}
.fd-split-d{font-size:12px;font-weight:400;line-height:1.35;color:var(--m-mut)}
.fd-split-kbd{font:500 11px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;color:var(--m-mut);padding:4px 6px;border-radius:6px;background:var(--m-hover)}
@keyframes fd-split-in{from{opacity:0;transform:translateY(-4px) scale(.96)}}
.fd-split[data-flip] .fd-split-menu{animation-name:fd-split-in-up}
@keyframes fd-split-in-up{from{opacity:0;transform:translateY(4px) scale(.96)}}
@media (prefers-reduced-motion:reduce){.fd-split-main,.fd-split-chev,.fd-split-chev svg{transition:none}.fd-split-main:active,.fd-split-chev:active{transform:none}.fd-split-menu{animation:fd-split-fade 100ms linear}}
@keyframes fd-split-fade{from{opacity:0}}
@media (prefers-reduced-transparency:reduce),(prefers-contrast:more){.fd-split-menu{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const ic = {
  rocket: <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2M12 15l-3-3a22 22 0 0 1 2-4 12 12 0 0 1 11-5c0 3-1 8-5 11a22 22 0 0 1-4 2zM9 12H4s.6-3 2-4c1.6-1 5 0 5 0M12 15v5s3-.6 4-2c1-1.6 0-5 0-5" /></svg>,
  clock: <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  layers: <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" /></svg>,
  undo: <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>,
};

export function Demo() {
  return (
    <div className="fd-splitd">
      <style>{demoCss}</style>
      <div className="fd-splitd-stage">
        <SplitButton
          label="Deploy"
          icon={ic.rocket}
          size="lg"
          theme="light"
          items={[
            { id: "staging", label: "Deploy to staging", icon: ic.layers, shortcut: "⌘ S" },
            { id: "schedule", label: "Schedule deploy", icon: ic.clock, shortcut: "⌘ ⇧ S" },
            { id: "rollback", label: "Roll back", icon: ic.undo, danger: true, separatorBefore: true },
          ]}
        />
      </div>
    </div>
  );
}

const demoCss = `
.fd-splitd,.fd-splitd *,.fd-splitd *::before,.fd-splitd *::after{box-sizing:border-box}
.fd-splitd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f4f4f4;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
.fd-splitd-stage{display:flex;justify-content:center;margin:0;padding:0}
`;
