/**
 * PillTagButton, selectable filter chips with count badges and an animated
 * check that slides in when a chip is selected.
 *
 * Props: options[] ({ id, label, count?, icon?, disabled? }), value (string[]),
 * onChange(next), multiple (default true), size ("sm" | "md"), tone
 * ("neutral" | "accent"), aria-label, theme. Also exports <PillTag/> for a
 * single chip (selected, onToggle).
 *
 * Browser support: all evergreen browsers.
 * Accessibility: each chip is a <button aria-pressed> inside role="group"
 * (multiple) or a role="radiogroup" of role="radio" chips (single). Counts are
 * read as part of the name ("Condos, 64"). Visible focus, 44px-wide touch
 * target on md via padding. Reduced motion: check appears instantly.
 */
import { useState } from "react";
import type { ReactNode } from "react";

export interface PillOption {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface PillTagProps {
  label: string;
  count?: number;
  icon?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  size?: "sm" | "md";
  tone?: "neutral" | "accent";
  radio?: boolean;
}

export function PillTag({ label, count, icon, selected, disabled, onToggle, size = "md", tone = "neutral", radio }: PillTagProps) {
  return (
    <button
      type="button"
      className="fd-pill"
      data-size={size}
      data-tone={tone}
      data-selected={selected || undefined}
      disabled={disabled}
      onClick={onToggle}
      {...(radio ? { role: "radio", "aria-checked": !!selected } : { "aria-pressed": !!selected })}
    >
      <span className="fd-pill-check" aria-hidden="true">
        <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      {icon && <span className="fd-pill-ic">{icon}</span>}
      <span className="fd-pill-label">{label}</span>
      {count !== undefined && <span className="fd-pill-count">{count}</span>}
    </button>
  );
}

export interface PillTagButtonProps {
  options: PillOption[];
  value: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  size?: "sm" | "md";
  tone?: "neutral" | "accent";
  theme?: "light" | "dark";
  className?: string;
  "aria-label"?: string;
}

export function PillTagButton({ options, value, onChange, multiple = true, size = "md", tone = "neutral", theme, className, "aria-label": label }: PillTagButtonProps) {
  const toggle = (id: string) => {
    if (multiple) onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
    else onChange(value.includes(id) ? [] : [id]);
  };
  return (
    <div className={`fd-pill-group${className ? " " + className : ""}`} role={multiple ? "group" : "radiogroup"} aria-label={label} data-fd-theme={theme}>
      <style>{css}</style>
      {options.map((o) => (
        <PillTag key={o.id} label={o.label} count={o.count} icon={o.icon} disabled={o.disabled} size={size} tone={tone} radio={!multiple} selected={value.includes(o.id)} onToggle={() => toggle(o.id)} />
      ))}
    </div>
  );
}

const css = `
:where(.fd-pill-group,.fd-pill-group *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-pill-group,.fd-pill-group *)::before,:where(.fd-pill-group,.fd-pill-group *)::after{box-sizing:border-box}
:where(.fd-pill-group svg){display:block;flex-shrink:0}
:where(.fd-pill-group button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-pill-group{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --p-bg:#fff;--p-fg:#0B0B0F;--p-mut:#6B6B76;--p-line:rgba(11,11,15,.12);--p-hover:#F7F7F9;--p-count:rgba(11,11,15,.07);
  --p-on-bg:#0B0B0F;--p-on-fg:#fff;--p-on-count:rgba(255,255,255,.2);--p-ring:rgba(0,122,255,.7);
  display:flex;flex-wrap:wrap;gap:8px;
  font:500 14px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;color:var(--p-fg);
}
[data-fd-theme="dark"] .fd-pill-group,.fd-pill-group[data-fd-theme="dark"]{--p-bg:#16161B;--p-fg:#F5F5F7;--p-mut:#9A9AA6;--p-line:rgba(255,255,255,.12);--p-hover:#1E1E25;--p-count:rgba(255,255,255,.09);--p-on-bg:#F5F5F7;--p-on-fg:#0B0B0F;--p-on-count:rgba(11,11,15,.14);--p-ring:rgba(10,132,255,.85)}
.fd-pill{position:relative;display:inline-flex;align-items:center;gap:0;flex-shrink:0;
  appearance:none;-webkit-appearance:none;border:0;outline:0;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;white-space:nowrap;
  height:var(--p-h);padding:0 var(--p-px);border-radius:9999px;background:var(--p-bg);color:var(--p-fg);
  font-family:inherit;font-size:var(--p-fs);font-weight:500;line-height:1;letter-spacing:inherit;
  box-shadow:0 0 0 1px var(--p-line),0 1px 2px rgba(11,11,15,.04);
  transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring),background-color var(--fd-dur-2) var(--fd-ease-out),color var(--fd-dur-2) var(--fd-ease-out),box-shadow var(--fd-dur-2) var(--fd-ease-out)}
.fd-pill[data-size="sm"]{--p-h:28px;--p-px:12px;--p-fs:13px;--p-chk:14px}
.fd-pill[data-size="md"]{--p-h:36px;--p-px:16px;--p-fs:14px;--p-chk:16px}
.fd-pill[data-tone="accent"]{--p-on-bg:#007AFF;--p-on-fg:#fff;--p-on-count:rgba(255,255,255,.25)}
[data-fd-theme="dark"] .fd-pill[data-tone="accent"]{--p-on-bg:#0A84FF}
@media (hover:hover){.fd-pill:hover:not(:disabled):not([data-selected]){background:var(--p-hover)}}
.fd-pill[data-selected]{background:var(--p-on-bg);color:var(--p-on-fg);box-shadow:0 0 0 1px var(--p-on-bg),0 4px 12px -6px var(--p-on-bg)}
.fd-pill:active:not(:disabled){transform:scale(.96);transition:transform var(--fd-dur-1) var(--fd-ease-out)}
.fd-pill:focus-visible{outline:2px solid var(--p-ring);outline-offset:2px}
.fd-pill:disabled{opacity:.4;cursor:not-allowed}
.fd-pill-check{display:grid;place-items:center;width:0;height:var(--p-chk);opacity:0;overflow:hidden;transform:scale(.4);
  transition:width var(--fd-dur-3) var(--fd-spring),opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring),margin var(--fd-dur-3) var(--fd-spring)}
.fd-pill[data-selected] .fd-pill-check{width:var(--p-chk);margin-right:6px;opacity:1;transform:scale(1)}
.fd-pill-check path{stroke-dasharray:24;stroke-dashoffset:24;transition:stroke-dashoffset var(--fd-dur-2) var(--fd-ease-out)}
.fd-pill[data-selected] .fd-pill-check path{stroke-dashoffset:0;transition-delay:90ms}
.fd-pill-ic{display:grid;place-items:center;width:16px;height:16px;margin-right:6px;color:var(--p-mut);transition:color var(--fd-dur-2) var(--fd-ease-out)}
.fd-pill-ic svg{width:100%;height:100%}.fd-pill[data-selected] .fd-pill-ic{color:inherit}
.fd-pill-label{display:block}
.fd-pill-count{display:inline-grid;place-items:center;min-width:22px;height:20px;margin-left:8px;margin-right:-6px;padding:0 6px;border-radius:9999px;background:var(--p-count);color:var(--p-mut);font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:0;
  transition:background-color var(--fd-dur-2) var(--fd-ease-out),color var(--fd-dur-2) var(--fd-ease-out)}
.fd-pill[data-selected] .fd-pill-count{background:var(--p-on-count);color:inherit}
@media (prefers-reduced-motion:reduce){.fd-pill,.fd-pill:active:not(:disabled),.fd-pill-check,.fd-pill-check path{transition:none;transform:none}.fd-pill[data-selected] .fd-pill-check{transform:none}}
@media (prefers-contrast:more){.fd-pill[data-selected]{box-shadow:0 0 0 2px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const TYPES: PillOption[] = [
  { id: "houses", label: "Houses", count: 48 },
  { id: "condos", label: "Condos", count: 64 },
  { id: "townhomes", label: "Townhomes", count: 21 },
  { id: "lofts", label: "Lofts", count: 9 },
];

export function Demo() {
  const [value, setValue] = useState<string[]>(["condos"]);
  return (
    <div className="fd-pilld">
      <style>{demoCss}</style>
      <div className="fd-pilld-box">
        <PillTagButton aria-label="Home type" options={TYPES} value={value} onChange={setValue} />
      </div>
    </div>
  );
}

const demoCss = `
.fd-pilld,.fd-pilld *,.fd-pilld *::before,.fd-pilld *::after{box-sizing:border-box}
.fd-pilld{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f4f4f4;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
.fd-pilld-box{display:flex;justify-content:center;max-width:560px;margin:0;padding:0}
`;
