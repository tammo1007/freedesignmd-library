/**
 * IconButtonGroup, a toolbar of icon buttons with tooltips, toggle
 * (aria-pressed) states, exclusive sub-groups and separators.
 *
 * Props: groups: ToolItem[][], each inner array is a visual group with a
 * separator between groups. ToolItem = { id, label, icon, shortcut?,
 * kind?: "toggle" | "action", exclusive?: string, disabled? }.
 * pressed (Record<id, boolean>) + onToggle(id, next) for toggles,
 * onAction(id) for actions, size ("sm" | "md"), aria-label, theme.
 * Items sharing the same `exclusive` key behave like a radio set.
 *
 * Browser support: all evergreen browsers.
 * Accessibility: role="toolbar" with a roving tabindex (ArrowLeft/Right,
 * Home/End); toggles expose aria-pressed; every button has an aria-label and
 * aria-keyshortcuts; tooltips (role="tooltip") appear on hover after 400ms
 * (instantly once warm) and on keyboard focus, and close on Escape.
 * Reduced motion: tooltip fades only.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export interface ToolItem {
  id: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  kind?: "toggle" | "action";
  exclusive?: string;
  disabled?: boolean;
}

export interface IconButtonGroupProps {
  groups: ToolItem[][];
  pressed?: Record<string, boolean>;
  onToggle?: (id: string, next: boolean) => void;
  onAction?: (id: string) => void;
  size?: "sm" | "md";
  theme?: "light" | "dark";
  className?: string;
  "aria-label"?: string;
}

export function IconButtonGroup({
  groups,
  pressed = {},
  onToggle,
  onAction,
  size = "md",
  theme,
  className,
  "aria-label": ariaLabel = "Formatting",
}: IconButtonGroupProps) {
  const uid = useId();
  const bar = useRef<HTMLDivElement>(null);
  const flat = groups.flat();
  const [active, setActive] = useState(flat[0]?.id);
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const timer = useRef(0);
  const warm = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const showTip = (id: string, el: HTMLElement, delay: number) => {
    window.clearTimeout(timer.current);
    const go = () => setTip({ id, x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop });
    if (delay <= 0 || Date.now() - warm.current < 600) go();
    else timer.current = window.setTimeout(go, delay);
  };
  const hideTip = () => {
    window.clearTimeout(timer.current);
    setTip((t) => {
      if (t) warm.current = Date.now();
      return null;
    });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") return hideTip();
    const btns = Array.from(bar.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % btns.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + btns.length) % btns.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = btns.length - 1;
    if (n >= 0) {
      e.preventDefault();
      btns[n].focus();
    }
  };

  const press = (it: ToolItem) => {
    if (it.kind === "action") return onAction?.(it.id);
    onToggle?.(it.id, !pressed[it.id]);
  };

  const tipItem = tip ? flat.find((f) => f.id === tip.id) : null;

  return (
    <div className={`fd-ibg${className ? " " + className : ""}`} data-size={size} data-fd-theme={theme}>
      <style>{css}</style>
      <div ref={bar} className="fd-ibg-bar" role="toolbar" aria-label={ariaLabel} onKeyDown={onKey}>
        {groups.map((g, gi) => (
          <div key={gi} className="fd-ibg-group" role="group">
            {g.map((it) => {
              const isToggle = it.kind !== "action";
              return (
                <button
                  key={it.id}
                  type="button"
                  className="fd-ibg-btn"
                  aria-label={it.label}
                  aria-pressed={isToggle ? !!pressed[it.id] : undefined}
                  aria-keyshortcuts={it.shortcut}
                  aria-describedby={tip?.id === it.id ? `${uid}-tip` : undefined}
                  disabled={it.disabled}
                  tabIndex={active === it.id ? 0 : -1}
                  onClick={() => {
                    press(it);
                    setActive(it.id);
                  }}
                  onFocus={(e) => {
                    setActive(it.id);
                    if (e.currentTarget.matches(":focus-visible")) showTip(it.id, e.currentTarget, 0);
                  }}
                  onBlur={hideTip}
                  onPointerEnter={(e) => e.pointerType === "mouse" && showTip(it.id, e.currentTarget, 400)}
                  onPointerLeave={hideTip}
                  onPointerDown={hideTip}
                >
                  <span className="fd-ibg-ic">{it.icon}</span>
                </button>
              );
            })}
            {gi < groups.length - 1 && <span className="fd-ibg-sep" aria-hidden="true" />}
          </div>
        ))}
        {tip && tipItem && (
          <div id={`${uid}-tip`} role="tooltip" className="fd-ibg-tip" style={{ left: tip.x, top: tip.y }}>
            {tipItem.label}
            {tipItem.shortcut && <kbd>{tipItem.shortcut}</kbd>}
          </div>
        )}
      </div>
    </div>
  );
}

const css = `
:where(.fd-ibg,.fd-ibg *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-ibg,.fd-ibg *)::before,:where(.fd-ibg,.fd-ibg *)::after{box-sizing:border-box}
:where(.fd-ibg svg){display:block;flex-shrink:0}
:where(.fd-ibg button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-ibg{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;
  --i-bg:#fff;--i-fg:#0B0B0F;--i-mut:#5F5F6B;--i-hover:rgba(11,11,15,.06);--i-on:rgba(0,122,255,.12);--i-on-fg:#0058C7;--i-line:rgba(11,11,15,.1);--i-ring:rgba(0,122,255,.7);
  --i-tip-bg:#0B0B0F;--i-tip-fg:#F5F5F7;
  --i-sh:0 0 0 1px var(--i-line),0 1px 2px rgba(11,11,15,.05),0 8px 24px -12px rgba(11,11,15,.22);
  display:inline-block;max-width:100%;
  font:500 12px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;color:var(--i-fg);
}
[data-fd-theme="dark"] .fd-ibg,.fd-ibg[data-fd-theme="dark"]{--i-bg:#1C1C22;--i-fg:#F5F5F7;--i-mut:#A1A1AD;--i-hover:rgba(255,255,255,.08);--i-on:rgba(10,132,255,.24);--i-on-fg:#6CB4FF;--i-line:rgba(255,255,255,.1);--i-ring:rgba(10,132,255,.85);--i-tip-bg:#F5F5F7;--i-tip-fg:#0B0B0F;
  --i-sh:0 0 0 1px var(--i-line),0 1px 0 rgba(255,255,255,.05) inset,0 8px 24px -12px rgba(0,0,0,.7)}
.fd-ibg[data-size="sm"]{--i-b:28px;--i-ic:16px}
.fd-ibg[data-size="md"]{--i-b:34px;--i-ic:18px}
.fd-ibg-bar{position:relative;display:inline-flex;align-items:center;gap:4px;max-width:100%;flex-wrap:wrap;padding:4px;border-radius:calc(var(--i-b)/3.4 + 8px);background:var(--i-bg);box-shadow:var(--i-sh)}
.fd-ibg-group{display:inline-flex;align-items:center;gap:2px}
.fd-ibg-sep{width:1px;height:18px;margin:0 4px 0 6px;background:var(--i-line)}
.fd-ibg-btn{position:relative;display:grid;place-items:center;width:var(--i-b);height:var(--i-b);border-radius:calc(var(--i-b)/3.4 + 4px);
  appearance:none;-webkit-appearance:none;border:0;outline:0;cursor:pointer;-webkit-tap-highlight-color:transparent;background:transparent;color:var(--i-mut);
  transform:scale(1);transition:transform 420ms var(--fd-spring),background-color var(--fd-dur-1) var(--fd-ease-out),color var(--fd-dur-1) var(--fd-ease-out)}
.fd-ibg-ic{display:grid;place-items:center;width:var(--i-ic);height:var(--i-ic)}.fd-ibg-ic svg{width:100%;height:100%}
@media (hover:hover){.fd-ibg-btn:hover:not(:disabled){background:var(--i-hover);color:var(--i-fg)}}
.fd-ibg-btn[aria-pressed="true"]{background:var(--i-on);color:var(--i-on-fg)}
.fd-ibg-btn:active:not(:disabled){transform:scale(.92);transition:transform var(--fd-dur-1) var(--fd-ease-out)}
.fd-ibg-btn:focus-visible{outline:2px solid var(--i-ring);outline-offset:1px}
.fd-ibg-btn:disabled{opacity:.35;cursor:not-allowed}
.fd-ibg-tip{position:absolute;z-index:10;transform:translate(-50%,calc(-100% - 10px));display:flex;align-items:center;gap:8px;padding:6px 8px 6px 10px;border-radius:8px;background:var(--i-tip-bg);color:var(--i-tip-fg);white-space:nowrap;pointer-events:none;
  font:500 12px/1 inherit;font-family:inherit;box-shadow:0 4px 12px rgba(0,0,0,.25);animation:fd-ibg-tip var(--fd-dur-2) var(--fd-ease-out)}
.fd-ibg-tip:not(:has(kbd)){padding-right:10px}
.fd-ibg-tip kbd{font:500 11px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;padding:3px 5px;border-radius:5px;background:rgba(127,127,140,.28);color:inherit;opacity:.85}
.fd-ibg-tip::after{content:"";position:absolute;left:50%;top:100%;width:8px;height:8px;margin:-4px 0 0 -4px;background:var(--i-tip-bg);transform:rotate(45deg);border-radius:0 0 2px 0}
@keyframes fd-ibg-tip{from{opacity:0;transform:translate(-50%,calc(-100% - 6px)) scale(.96)}}
@media (prefers-reduced-motion:reduce){.fd-ibg-btn,.fd-ibg-btn:active:not(:disabled){transition:background-color 1ms;transform:none}.fd-ibg-tip{animation:fd-ibg-fade 100ms linear}}
@keyframes fd-ibg-fade{from{opacity:0}}
@media (prefers-contrast:more){.fd-ibg-btn[aria-pressed="true"]{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const S = ({ children }: { children: ReactNode }) => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const icons = {
  bold: <S><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" /></S>,
  italic: <S><path d="M19 4h-9M14 20H5M15 4L9 20" /></S>,
  underline: <S><path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14" /></S>,
  link: <S><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></S>,
  bullets: <S><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></S>,
  left: <S><path d="M4 6h16M4 10h10M4 14h16M4 18h10" /></S>,
  center: <S><path d="M4 6h16M7 10h10M4 14h16M7 18h10" /></S>,
  right: <S><path d="M4 6h16M10 10h10M4 14h16M10 18h10" /></S>,
};

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function Demo() {
  const [pressed, setPressed] = useState<Record<string, boolean>>({ "align-left": true, bold: true });
  const [mod, setMod] = useState("Ctrl ");
  useEffect(() => setMod(isMac() ? "⌘ " : "Ctrl "), []);

  const groups: ToolItem[][] = [
    [
      { id: "bold", label: "Bold", icon: icons.bold, shortcut: `${mod}B` },
      { id: "italic", label: "Italic", icon: icons.italic, shortcut: `${mod}I` },
      { id: "underline", label: "Underline", icon: icons.underline, shortcut: `${mod}U` },
    ],
    [
      { id: "bullets", label: "Bulleted list", icon: icons.bullets },
      { id: "link", label: "Link", icon: icons.link, shortcut: `${mod}K` },
    ],
    [
      { id: "align-left", label: "Align left", icon: icons.left, exclusive: "align" },
      { id: "align-center", label: "Align center", icon: icons.center, exclusive: "align" },
      { id: "align-right", label: "Align right", icon: icons.right, exclusive: "align" },
    ],
  ];
  const flat = groups.flat();

  const toggle = (id: string, on: boolean) => {
    const ex = flat.find((f) => f.id === id)?.exclusive;
    const next = { ...pressed };
    if (ex) flat.filter((f) => f.exclusive === ex).forEach((f) => (next[f.id] = false));
    next[id] = ex === "align" ? true : on; // alignment always has one active
    setPressed(next);
  };

  return (
    <div className="fd-ibgd">
      <style>{demoCss}</style>
      <IconButtonGroup groups={groups} pressed={pressed} onToggle={toggle} aria-label="Text formatting" />
    </div>
  );
}

const demoCss = `
.fd-ibgd,.fd-ibgd *,.fd-ibgd *::before,.fd-ibgd *::after{box-sizing:border-box}
.fd-ibgd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 16px;overflow:hidden;background:#f4f4f4;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
`;
