/**
 * GlassToolbar, grouped Liquid Glass toolbar with a scroll edge effect.
 *
 * HIG rules baked in:
 * - Related actions share one glass capsule (a group); groups are separated by
 *   fixed spacers, never stacked glass on glass.
 * - Icon groups and text groups are separate (don't mix in one capsule).
 * - Every icon has an accessibility label (also shown as a tooltip).
 * - The selected tool sits under a soft lens that slides between items.
 * - <ScrollEdge> softly blurs + fades content scrolling under a bar.
 *
 * Components:
 *   <GlassToolbar label tone tooltips>, role="toolbar"; Arrow keys move between all
 *     items across groups (roving tabindex).
 *   <ToolbarGroup selectable value onChange>, one glass capsule.
 *   <ToolbarItem id label icon? text? onClick?>, icon-only items need `label`.
 *   <ToolbarSpacer flexible?>, fixed gap (default) or flexible.
 *   <ScrollEdge edge="top"|"bottom" size tone>, place inside a scroll
 *     container's positioned parent, above content and below the bar.
 * Browser support: refraction in Chromium; frosted glass elsewhere.
 */
import { Children, createContext, isValidElement, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { GlassScope, LiquidGlass, useGlassEnv, useSpring } from "./liquid-glass";

type Tone = "light" | "dark";
const ToneCtx = createContext<Tone>("light");
type GroupCtx = { selectable: boolean; value?: string; onChange?: (id: string) => void };
const GroupContext = createContext<GroupCtx>({ selectable: false });

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function GlassToolbar({
  label,
  tone = "light",
  tooltips = "below",
  children,
  className,
  style,
}: {
  label: string;
  tone?: Tone;
  /** Where icon tooltips appear: "below" for top bars, "above" for bottom bars. */
  tooltips?: "above" | "below";
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // roving tabindex across every item in every group
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(".fd-gtb-item:not(:disabled)"));
    const current = items.find((i) => i.getAttribute("aria-pressed") === "true" || i.getAttribute("aria-checked") === "true") ?? items[0];
    items.forEach((i) => (i.tabIndex = i === current ? 0 : -1));
  });
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(".fd-gtb-item:not(:disabled)") ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const map: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: items.length - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const n = items[(map[e.key] + items.length) % items.length];
    items.forEach((x) => (x.tabIndex = -1));
    n.tabIndex = 0;
    n.focus();
  };
  return (
    <ToneCtx.Provider value={tone}>
      <GlassScope>
        <div ref={ref} role="toolbar" aria-label={label} className={["fd-gtb", `fd-gtb--${tone}`, `fd-gtb--tips-${tooltips}`, className ?? ""].filter(Boolean).join(" ")} style={style} onKeyDown={onKey}>
          <style>{css}</style>
          {children}
        </div>
      </GlassScope>
    </ToneCtx.Provider>
  );
}

export function ToolbarGroup({
  children,
  selectable = false,
  value,
  onChange,
  label,
}: {
  children: ReactNode;
  selectable?: boolean;
  value?: string;
  onChange?: (id: string) => void;
  label?: string;
}) {
  const tone = useContext(ToneCtx);
  const env = useGlassEnv();
  const inner = useRef<HTMLDivElement | null>(null);
  const lens = useRef<HTMLSpanElement | null>(null);
  const text = Children.toArray(children).some((c) => isValidElement(c) && (c.props as { text?: string }).text && !(c.props as { icon?: ReactNode }).icon);

  const paint = () => {
    const l = lens.current;
    if (!l) return;
    const st = env.reducedMotion ? 0 : Math.min(0.3, Math.abs(lx.velocity) * 0.0005);
    l.style.transform = `translateX(${lx.value.toFixed(2)}px) scale(${(1 + st).toFixed(4)}, ${(1 - st * 0.4).toFixed(4)})`;
    l.style.width = `${lw.value.toFixed(2)}px`;
  };
  const lx = useSpring(0, paint, { stiffness: 380, damping: 28 });
  const lw = useSpring(0, paint, { stiffness: 380, damping: 30 });
  const first = useRef(true);
  useIso(() => {
    if (!selectable) return;
    const el = inner.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(value ?? "")}"]`);
    if (!el || !lens.current) {
      if (lens.current) lens.current.style.opacity = "0";
      return;
    }
    lens.current.style.opacity = "1";
    if (first.current || env.reducedMotion) {
      lx.set(el.offsetLeft);
      lw.set(el.offsetWidth);
      first.current = false;
    } else {
      lx.to(el.offsetLeft);
      lw.to(el.offsetWidth);
    }
  }, [value, selectable, env.reducedMotion]);

  return (
    <GroupContext.Provider value={{ selectable, value, onChange }}>
      <LiquidGlass className={`fd-gtb-group${text ? " is-text" : ""}`} variant="regular" tone={tone} radius="capsule" role="group" aria-label={label}>
        <div ref={inner} className="fd-gtb-inner">
          {selectable && <span ref={lens} className="fd-gtb-lens" aria-hidden="true" />}
          {children}
        </div>
      </LiquidGlass>
    </GroupContext.Provider>
  );
}

export function ToolbarItem({
  id,
  label,
  icon,
  text,
  onClick,
  disabled,
  pressed,
  shortcut,
}: {
  id: string;
  /** Accessible name + tooltip. Required for icon-only items. */
  label: string;
  icon?: ReactNode;
  /** Text label (use text-only groups). */
  text?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Toggle state for non-selectable toggle items. */
  pressed?: boolean;
  shortcut?: string;
}) {
  const g = useContext(GroupContext);
  const selected = g.selectable ? g.value === id : pressed;
  return (
    <button
      type="button"
      className={`fd-gtb-item${text && !icon ? " is-text" : ""}`}
      data-id={id}
      aria-label={icon ? label : undefined}
      aria-pressed={selected === undefined ? undefined : selected}
      disabled={disabled}
      onClick={() => {
        if (g.selectable) g.onChange?.(id);
        onClick?.();
      }}
    >
      {icon ? <span className="fd-gtb-ico" aria-hidden="true">{icon}</span> : null}
      {text && !icon ? <span className="fd-gtb-txt">{text}</span> : null}
      {icon ? (
        <span className="fd-gtb-tip" role="presentation" aria-hidden="true">
          {label}
          {shortcut ? <kbd>{shortcut}</kbd> : null}
        </span>
      ) : null}
    </button>
  );
}

export function ToolbarSpacer({ flexible = false }: { flexible?: boolean }) {
  return <span className={`fd-gtb-spacer${flexible ? " is-flex" : ""}`} aria-hidden="true" />;
}

/** Scroll edge effect: a progressive blur + fade where content passes under a bar. */
export function ScrollEdge({ edge = "top", size = 96, tone = "light", style }: { edge?: "top" | "bottom"; size?: number; tone?: Tone; style?: CSSProperties }) {
  return (
    <div className={`fd-gtb-edge fd-gtb-edge--${edge} fd-gtb-edge--${tone}`} style={{ height: size, ...style }} aria-hidden="true">
      <style>{css}</style>
      <span style={{ "--b": "1px", "--a": "0%", "--z": "45%" } as CSSProperties} />
      <span style={{ "--b": "3px", "--a": "0%", "--z": "70%" } as CSSProperties} />
      <span style={{ "--b": "8px", "--a": "0%", "--z": "100%" } as CSSProperties} />
    </div>
  );
}

const css = `
.fd-gtb,.fd-gtb *,.fd-gtb *::before,.fd-gtb *::after{box-sizing:border-box}
.fd-gtb{display:flex;align-items:center;gap:0;margin:0;padding:0;background:none;border:0;color:#0B0B0F;font:500 14px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal}
.fd-gtb--dark{color:#F2F2F7}
.fd-gtb-group{flex:none;height:48px;padding:4px}
.fd-gtb-inner{position:relative;display:flex;align-items:center;gap:2px;height:100%;margin:0;padding:0}
.fd-gtb-lens{position:absolute;left:0;top:0;bottom:0;width:0;margin:0;padding:0;border-radius:999px;pointer-events:none;will-change:transform,width;
  background:rgba(11,11,15,0.08);box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.5)}
.fd-gtb--dark .fd-gtb-lens{background:rgba(255,255,255,0.16)}
.fd-gtb-spacer{display:block;flex:none;width:12px;height:1px;margin:0;padding:0}
.fd-gtb-spacer.is-flex{flex:1 1 12px}
.fd-gtb-item{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px;margin:0;padding:0;border:0;border-radius:999px;background:transparent;color:inherit;
  font:600 14px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-0.005em;text-shadow:none;cursor:pointer;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;
  transition:background-color var(--fd-dur-1) linear,transform var(--fd-dur-3) var(--fd-spring),color var(--fd-dur-2) var(--fd-ease-out)}
.fd-gtb-item.is-text{width:auto;padding:0 14px}
.fd-gtb-item:hover:not(:disabled){background:rgba(11,11,15,0.05)}
.fd-gtb--dark .fd-gtb-item:hover:not(:disabled){background:rgba(255,255,255,0.08)}
.fd-gtb-item:active:not(:disabled){transform:scale(0.9);transition-duration:var(--fd-dur-1)}
.fd-gtb-item[aria-pressed="true"]{color:#007AFF}
.fd-gtb--dark .fd-gtb-item[aria-pressed="true"]{color:#0A84FF}
.fd-gtb-item:disabled{opacity:0.35;cursor:default}
.fd-gtb-item:focus-visible{outline:2px solid color-mix(in srgb,#0A84FF 70%,transparent);outline-offset:2px}
.fd-gtb-ico,.fd-gtb-ico svg{display:block;width:22px;height:22px;margin:0;padding:0}
.fd-gtb-txt{display:block;margin:0;padding:0;white-space:nowrap}
.fd-gtb-tip{position:absolute;left:50%;top:calc(100% + 12px);display:flex;align-items:center;gap:8px;margin:0;padding:7px 10px;border-radius:10px;background:rgba(28,28,34,0.94);color:#F2F2F7;
  font:600 12px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:0;white-space:nowrap;pointer-events:none;opacity:0;transform:translate(-50%,-4px) scale(0.96);
  transition:opacity var(--fd-dur-1) linear,transform var(--fd-dur-2) var(--fd-ease-out);z-index:10;box-shadow:0 8px 20px -6px rgba(0,0,0,0.35)}
.fd-gtb--tips-above .fd-gtb-tip{top:auto;bottom:calc(100% + 12px);transform:translate(-50%,4px) scale(0.96)}
.fd-gtb-tip kbd{display:inline-block;margin:0;padding:3px 5px;border:0;border-radius:5px;background:rgba(255,255,255,0.14);color:#C7C7CC;font:500 11px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace}
.fd-gtb-item:hover .fd-gtb-tip,.fd-gtb-item:focus-visible .fd-gtb-tip{opacity:1;transform:translate(-50%,0) scale(1);transition-delay:350ms,350ms}
.fd-gtb-item:focus-visible .fd-gtb-tip{transition-delay:0ms,0ms}
.fd-gtb-edge{position:absolute;left:0;right:0;z-index:2;margin:0;padding:0;pointer-events:none;display:block}
.fd-gtb-edge--top{top:0}
.fd-gtb-edge--bottom{bottom:0}
.fd-gtb-edge span{position:absolute;inset:0;display:block;margin:0;padding:0;-webkit-backdrop-filter:blur(var(--b));backdrop-filter:blur(var(--b))}
.fd-gtb-edge--top span{-webkit-mask:linear-gradient(180deg,#000 var(--a),transparent var(--z));mask:linear-gradient(180deg,#000 var(--a),transparent var(--z))}
.fd-gtb-edge--bottom span{-webkit-mask:linear-gradient(0deg,#000 var(--a),transparent var(--z));mask:linear-gradient(0deg,#000 var(--a),transparent var(--z))}
.fd-gtb-edge--top.fd-gtb-edge--light{background:linear-gradient(180deg,rgba(247,247,249,0.85),rgba(247,247,249,0))}
.fd-gtb-edge--bottom.fd-gtb-edge--light{background:linear-gradient(0deg,rgba(247,247,249,0.85),rgba(247,247,249,0))}
.fd-gtb-edge--top.fd-gtb-edge--dark{background:linear-gradient(180deg,rgba(11,11,15,0.85),rgba(11,11,15,0))}
.fd-gtb-edge--bottom.fd-gtb-edge--dark{background:linear-gradient(0deg,rgba(11,11,15,0.85),rgba(11,11,15,0))}
@media (prefers-reduced-transparency: reduce){.fd-gtb-edge span{-webkit-backdrop-filter:none;backdrop-filter:none}}
@media (prefers-reduced-motion: reduce){.fd-gtb-item:active:not(:disabled){transform:none}.fd-gtb-tip{transition-duration:0ms}}
`;

/* ───────────────────────── demo ───────────────────────── */

const s = (d: ReactNode) => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const IC = {
  select: s(<path d="m5.5 4 13 6.2-5.6 1.8-1.8 5.6Z" />),
  frame: s(<path d="M8 3.5v17M16 3.5v17M3.5 8h17M3.5 16h17" />),
  pen: s(<><path d="M12 19.5 19.5 12l-3-3L9 16.5Z" /><path d="m16.5 9-2-6-11 3.5L7 17.5l2-1M4 6.5l5 5" /></>),
  text: s(<path d="M5.5 6V4.5h13V6M12 4.5v15M9 19.5h6" />),
  comment: s(<path d="M5 18.5V7a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 7v6.5a2.5 2.5 0 0 1-2.5 2.5H9Z" />),
  bold: s(<path d="M7 4.5h6a3.5 3.5 0 0 1 0 7H7Zm0 7h7a4 4 0 0 1 0 8H7Z" />),
  italic: s(<path d="M10 4.5h8M6 19.5h8M14 4.5l-4 15" />),
  link: s(<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />),
};

export function Demo() {
  const [tool, setTool] = useState("select");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(true);
  return (
    <div className="fd-gtbd">
      <style>{demoCss}</style>
      <div className="fd-gtbd-stage">
        <GlassToolbar label="Tools">
          <ToolbarGroup label="Tools" selectable value={tool} onChange={setTool}>
            <ToolbarItem id="select" label="Move" icon={IC.select} shortcut="V" />
            <ToolbarItem id="frame" label="Frame" icon={IC.frame} shortcut="F" />
            <ToolbarItem id="pen" label="Pen" icon={IC.pen} shortcut="P" />
            <ToolbarItem id="text" label="Text" icon={IC.text} shortcut="T" />
            <ToolbarItem id="comment" label="Comment" icon={IC.comment} shortcut="C" />
          </ToolbarGroup>
          <ToolbarSpacer />
          <ToolbarGroup label="Format">
            <ToolbarItem id="bold" label="Bold" icon={IC.bold} pressed={bold} onClick={() => setBold((b) => !b)} shortcut="⌘ B" />
            <ToolbarItem id="italic" label="Italic" icon={IC.italic} pressed={italic} onClick={() => setItalic((b) => !b)} shortcut="⌘ I" />
            <ToolbarItem id="link" label="Link" icon={IC.link} shortcut="⌘ K" />
          </ToolbarGroup>
        </GlassToolbar>
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-gtbd,.fd-gtbd *,.fd-gtbd *::before,.fd-gtbd *::after{box-sizing:border-box}
.fd-gtbd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 16px;overflow:hidden;color:#1d1d1f;font:400 15px/1.4 ${F};letter-spacing:normal;
  background:radial-gradient(46% 62% at 28% 32%,#ffcfa6 0%,transparent 70%),radial-gradient(44% 58% at 74% 68%,#b7c3ff 0%,transparent 70%),radial-gradient(30% 40% at 62% 22%,#ffc2dc 0%,transparent 70%),#f1eeea}
.fd-gtbd-stage{display:flex;justify-content:center;max-width:100%;margin:0;padding:0 0 40px}
`;
