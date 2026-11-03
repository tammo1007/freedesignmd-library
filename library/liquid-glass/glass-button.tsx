/**
 * GlassButton, Liquid Glass buttons from Apple's HIG.
 *
 * Styles:  "glass"            regular glass, neutral        (secondary actions)
 *          "glassProminent"   glass tinted with the accent   (the primary action)
 *          "clear"            clear glass for photos/video   (+ `dim` over bright media)
 *          "clearProminent"   clear glass with accent tint
 * Sizes:   "s" 32 · "m" 40 · "l" 48 · "xl" 60  (capsules; icon-only buttons are circles)
 *
 * Props: glass, size, tone ("light" | "dark", regular glass only), tint (accent,
 *   default #007AFF), icon (leading icon node), iconOnly (requires aria-label),
 *   dim, plus every native <button> attribute.
 * Wrap many buttons in <GlassScope> (from ./liquid-glass) to render the
 * stylesheets once.
 *
 * Behaviour: press scales to 0.96 and releases with a spring overshoot, and a
 * soft glow blooms from the touch point (keyboard: from the centre).
 * Browser support: real refraction in Chromium; frosted fallback elsewhere
 * (see ./liquid-glass). Accessibility: native <button>, visible focus ring,
 * disabled uses the native attribute. Icon-only buttons must get aria-label.
 */
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { GlassScope, LiquidGlass } from "./liquid-glass";

export type GlassButtonStyle = "glass" | "glassProminent" | "clear" | "clearProminent";
export type GlassButtonSize = "s" | "m" | "l" | "xl";

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  glass?: GlassButtonStyle;
  size?: GlassButtonSize;
  tone?: "light" | "dark";
  /** Accent used by the prominent styles. */
  tint?: string;
  icon?: ReactNode;
  iconOnly?: boolean;
  /** Clear styles: 35% dimming layer for bright backgrounds. */
  dim?: boolean;
}

const HEIGHT: Record<GlassButtonSize, number> = { s: 32, m: 40, l: 48, xl: 60 };

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { glass = "glass", size = "m", tone = "light", tint = "#007AFF", icon, iconOnly = false, dim = false, className, style, children, type = "button", ...rest },
  ref,
) {
  const clear = glass === "clear" || glass === "clearProminent";
  const prominent = glass === "glassProminent" || glass === "clearProminent";
  const h = HEIGHT[size];
  return (
    <LiquidGlass
      ref={ref as never}
      as="button"
      type={type}
      variant={clear ? "clear" : "regular"}
      tone={tone}
      tint={prominent ? tint : undefined}
      dim={clear && dim && !prominent}
      interactive
      className={["fd-gbtn", `fd-gbtn--${size}`, iconOnly ? "fd-gbtn--icon" : "", prominent ? "fd-gbtn--prominent" : "", className ?? ""].filter(Boolean).join(" ")}
      style={{ "--fd-gbtn-h": `${h}px`, ...style } as CSSProperties}
      {...rest}
    >
      <style>{css}</style>
      {icon ? (
        <span className="fd-gbtn-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {!iconOnly && children != null ? <span className="fd-gbtn-label">{children}</span> : null}
    </LiquidGlass>
  );
});

const css = `
.fd-gbtn{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:none;height:var(--fd-gbtn-h);min-width:var(--fd-gbtn-h);margin:0;padding:0 calc(var(--fd-gbtn-h) * 0.42);vertical-align:middle;white-space:nowrap;user-select:none;-webkit-user-select:none;
  font:600 15px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-0.01em;text-align:center}
.fd-gbtn--s{font-size:13px;gap:6px}
.fd-gbtn--l{font-size:17px}
.fd-gbtn--xl{font-size:20px;gap:10px;font-weight:600}
.fd-gbtn--icon{width:var(--fd-gbtn-h);padding:0}
.fd-gbtn-icon{display:inline-flex;align-items:center;justify-content:center;margin:0;padding:0;color:inherit}
.fd-gbtn-icon svg{display:block;width:calc(var(--fd-gbtn-h) * 0.46);height:calc(var(--fd-gbtn-h) * 0.46)}
.fd-gbtn:not(.fd-gbtn--icon) .fd-gbtn-icon svg{width:calc(var(--fd-gbtn-h) * 0.42);height:calc(var(--fd-gbtn-h) * 0.42);margin-left:-2px}
.fd-gbtn-label{display:block;margin:0;padding:0;color:inherit;font:inherit;letter-spacing:inherit}
.fd-gbtn:disabled{opacity:0.42;cursor:default}
.fd-gbtn:disabled .fd-lg-glow{display:none}
`;

/* ───────────────────────── demo: hotel photo viewer ───────────────────────── */

const I = {
  back: <path d="M14.5 4.5 7 12l7.5 7.5" />,
  share: (
    <>
      <path d="M12 3.5v11" />
      <path d="m8 7 4-3.5L16 7" />
      <path d="M8.5 10.5H7a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 17 10.5h-1.5" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.4-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.6 12 20 12 20Z" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  play: <path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2A.8.8 0 0 0 8 5.8Z" fill="currentColor" stroke="none" />,
  plus: <path d="M12 5v14M5 12h14" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
};
const Icon = ({ d }: { d: ReactNode }) => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

export function Demo() {
  return (
    <div className="fd-gbd">
      <style>{demoCss}</style>
      <GlassScope>
        <div className="fd-gbd-stage" aria-hidden="true" />
        <div className="fd-gbd-center">
          <div className="fd-gbd-row">
            <GlassButton glass="glass" size="l" icon={<Icon d={I.grid} />}>Glass</GlassButton>
            <GlassButton glass="glassProminent" size="l" icon={<Icon d={I.calendar} />}>Prominent</GlassButton>
            <GlassButton glass="clear" size="l" iconOnly aria-label="Play" icon={<Icon d={I.play} />} />
            <GlassButton glass="glass" size="l" iconOnly aria-label="More options" icon={<Icon d={I.more} />} />
          </div>
        </div>
      </GlassScope>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-gbd,.fd-gbd *,.fd-gbd *::before,.fd-gbd *::after{box-sizing:border-box}
.fd-gbd{position:relative;height:100vh;min-height:420px;width:100%;overflow:hidden;margin:0;padding:0;background:#0d1020;color:#fff;font:400 15px/1.4 ${F};letter-spacing:normal}
.fd-gbd-stage{position:absolute;inset:0;margin:0;padding:0;background:
  radial-gradient(60% 70% at 18% 22%,#ff7a59 0%,transparent 62%),
  radial-gradient(55% 65% at 85% 30%,#3b82f6 0%,transparent 60%),
  radial-gradient(60% 70% at 55% 100%,#a855f7 0%,transparent 62%),
  #0d1020}
.fd-gbd-stage::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,0.10) 0 1.5px,transparent 1.5px 14px)}
.fd-gbd-center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;margin:0;padding:24px}
.fd-gbd-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:14px;margin:0;padding:0}
`;
