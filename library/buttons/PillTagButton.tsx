/**
 * PillTagButton — selectable filter chips with count badges and an animated
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

type Listing = { id: string; addr: string; hood: string; price: number; beds: number; baths: number; sqft: number; type: string; tags: string[]; hue: number };
const LISTINGS: Listing[] = [
  { id: "l1", addr: "2208 Rainey St #4C", hood: "Rainey District", price: 612000, beds: 2, baths: 2, sqft: 1104, type: "condo", tags: ["parking", "pool", "pets"], hue: 212 },
  { id: "l2", addr: "4410 Duval St", hood: "Hyde Park", price: 925000, beds: 3, baths: 2, sqft: 1860, type: "house", tags: ["pets", "yard"], hue: 28 },
  { id: "l3", addr: "1700 E 6th St #12", hood: "East Austin", price: 489000, beds: 1, baths: 1, sqft: 842, type: "loft", tags: ["new", "parking"], hue: 164 },
  { id: "l4", addr: "908 Barton Springs Rd", hood: "Zilker", price: 1380000, beds: 4, baths: 3, sqft: 2610, type: "house", tags: ["pool", "pets", "yard", "parking"], hue: 100 },
  { id: "l5", addr: "3301 Manor Rd Unit 7", hood: "Windsor Park", price: 538000, beds: 2, baths: 2, sqft: 1290, type: "townhome", tags: ["new", "parking", "pets"], hue: 330 },
  { id: "l6", addr: "711 W Cesar Chavez #1905", hood: "Downtown", price: 799000, beds: 2, baths: 2, sqft: 1320, type: "condo", tags: ["pool", "parking", "new"], hue: 250 },
  { id: "l7", addr: "5215 Avenue F", hood: "Hyde Park", price: 1095000, beds: 3, baths: 3, sqft: 2140, type: "house", tags: ["yard", "parking", "pets"], hue: 48 },
  { id: "l8", addr: "1109 S 1st St #3", hood: "SoCo", price: 574000, beds: 2, baths: 1, sqft: 1010, type: "townhome", tags: ["pets", "yard"], hue: 190 },
];
const TYPES: PillOption[] = ["house", "condo", "townhome", "loft"].map((t) => ({ id: t, label: t === "townhome" ? "Townhomes" : t === "loft" ? "Lofts" : t === "house" ? "Houses" : "Condos", count: LISTINGS.filter((l) => l.type === t).length }));
const glyph = (p: string) => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={p} /></svg>
);
const AMENITIES: PillOption[] = [
  { id: "pets", label: "Pet friendly", icon: glyph("M11 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM16 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM7 10a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM20 10a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM12 11c-3 0-5 3-5 5 0 2 1.5 3 3 3 1 0 1.4-.5 2-.5s1 .5 2 .5c1.5 0 3-1 3-3 0-2-2-5-5-5z") },
  { id: "pool", label: "Pool", icon: glyph("M2 18c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1M8 14V6a2 2 0 0 1 4 0M16 14V6a2 2 0 0 0-4 0M8 9h8") },
  { id: "parking", label: "Parking", icon: glyph("M5 4h8a5 5 0 0 1 0 10H8v6M5 4v16") },
  { id: "yard", label: "Yard", icon: glyph("M12 21v-8M12 13c-3 0-5-2-5-5 3 0 5 2 5 5zM12 13c3 0 5-2 5-5-3 0-5 2-5 5zM6 21h12") },
  { id: "new", label: "New build", icon: glyph("M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z") },
];
const money = (n: number) => "$" + n.toLocaleString("en-US");

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [types, setTypes] = useState<string[]>(["condo", "townhome"]);
  const [am, setAm] = useState<string[]>([]);
  const [beds, setBeds] = useState<string[]>([]);

  const shown = LISTINGS.filter((l) => (types.length === 0 || types.includes(l.type)) && am.every((a) => l.tags.includes(a)) && (beds.length === 0 || l.beds >= Number(beds[0])));
  const any = types.length + am.length + beds.length > 0;

  return (
    <div className="fd-pill-demo" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-pill-demo-bar">
        <span className="fd-pill-demo-brand">Openhaus</span>
        <span className="fd-pill-demo-loc">Austin, TX</span>
        <button type="button" className="fd-pill-demo-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      </header>

      <main className="fd-pill-demo-main">
        <h1>Homes for sale in Austin</h1>
        <div className="fd-pill-demo-filters">
          <div className="fd-pill-demo-frow">
            <span id="fd-pill-t">Home type</span>
            <PillTagButton aria-label="Home type" options={TYPES} value={types} onChange={setTypes} />
          </div>
          <div className="fd-pill-demo-frow">
            <span id="fd-pill-a">Must have</span>
            <PillTagButton aria-label="Amenities" options={AMENITIES} value={am} onChange={setAm} tone="accent" size="sm" />
          </div>
          <div className="fd-pill-demo-frow">
            <span id="fd-pill-b">Bedrooms</span>
            <PillTagButton aria-label="Minimum bedrooms" multiple={false} options={[{ id: "2", label: "2+" }, { id: "3", label: "3+" }, { id: "4", label: "4+" }]} value={beds} onChange={setBeds} size="sm" />
          </div>
        </div>

        <div className="fd-pill-demo-count" aria-live="polite">
          <span><b>{shown.length}</b> {shown.length === 1 ? "home" : "homes"}</span>
          {any && <button type="button" onClick={() => { setTypes([]); setAm([]); setBeds([]); }}>Clear all</button>}
        </div>

        {shown.length === 0 ? (
          <p className="fd-pill-demo-empty">No homes match every filter. Try removing an amenity.</p>
        ) : (
          <ul className="fd-pill-demo-grid">
            {shown.map((l) => (
              <li key={l.id} className="fd-pill-demo-card">
                <div className="fd-pill-demo-img" style={{ ["--hue" as string]: l.hue }} aria-hidden="true">
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 120 60" width="100%" height="100%" preserveAspectRatio="xMidYMax slice"><path d="M0 60V38l22-14 18 10 24-22 26 20 30-12v40z" fill="currentColor" opacity=".35" /><path d="M0 60V46l30-10 26 12 28-14 36 10v16z" fill="currentColor" opacity=".55" /></svg>
                  <span>{l.type === "townhome" ? "Townhome" : l.type[0].toUpperCase() + l.type.slice(1)}</span>
                </div>
                <div className="fd-pill-demo-info">
                  <b>{money(l.price)}</b>
                  <span>{l.beds} bd · {l.baths} ba · {l.sqft.toLocaleString("en-US")} sqft</span>
                  <small>{l.addr}, {l.hood}</small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-pill-demo,.fd-pill-demo *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-pill-demo,.fd-pill-demo *)::before,:where(.fd-pill-demo,.fd-pill-demo *)::after{box-sizing:border-box}
:where(.fd-pill-demo svg){display:block;flex-shrink:0}
:where(.fd-pill-demo button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-pill-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:ui-sans-serif,-apple-system,"SF Pro Display","Inter",sans-serif;
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-dur-2:240ms;
  --d-bg:#F7F7F9;--d-card:#fff;--d-ink:#0B0B0F;--d-mut:#6B6B76;--d-line:rgba(11,11,15,.08);--l:92%;--c:.04;
  min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.45 var(--d-font);-webkit-font-smoothing:antialiased;transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-pill-demo[data-fd-theme="dark"]{--d-bg:#09090B;--d-card:#111115;--d-ink:#F5F5F7;--d-mut:#9A9AA6;--d-line:rgba(255,255,255,.09);--l:30%}
.fd-pill-demo-bar{display:flex;align-items:center;gap:16px;height:60px;padding:0 clamp(16px,4vw,40px);border-bottom:1px solid var(--d-line)}
.fd-pill-demo-brand{font:700 18px/1 var(--d-disp);letter-spacing:-.03em}
.fd-pill-demo-loc{margin-right:auto;font:400 14px/1 var(--d-font);color:var(--d-mut)}
.fd-pill-demo-theme{cursor:pointer;height:32px;padding:0 14px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-pill-demo-theme:hover{color:var(--d-ink)}.fd-pill-demo-theme:focus-visible,.fd-pill-demo-count button:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px;border-radius:6px}
.fd-pill-demo-main{max-width:1040px;margin:0 auto;padding:36px clamp(16px,4vw,40px) 64px}
.fd-pill-demo-main h1{font:600 clamp(24px,4vw,32px)/1.15 var(--d-disp);letter-spacing:-.025em}
.fd-pill-demo-filters{display:flex;flex-direction:column;gap:14px;margin-top:24px;padding:20px;border-radius:20px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line),0 1px 2px rgba(0,0,0,.03)}
.fd-pill-demo-frow{display:grid;grid-template-columns:96px minmax(0,1fr);align-items:center;gap:12px}
.fd-pill-demo-frow>span{font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-pill-demo-count{display:flex;align-items:center;gap:16px;margin:24px 0 16px;font:400 14px/1 var(--d-font);color:var(--d-mut)}
.fd-pill-demo-count b{color:var(--d-ink);font-weight:600;font-variant-numeric:tabular-nums}
.fd-pill-demo-count button{cursor:pointer;font:500 14px/1 var(--d-font);color:#007AFF}
.fd-pill-demo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:16px}
.fd-pill-demo-card{border-radius:20px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line),0 1px 2px rgba(0,0,0,.03);overflow:hidden;animation:fd-pill-in 420ms var(--fd-ease-out) both}
.fd-pill-demo-img{position:relative;height:120px;color:hsl(var(--hue) 35% 45%);background:hsl(var(--hue) 40% var(--l))}
.fd-pill-demo-img span{position:absolute;left:12px;top:12px;height:22px;display:inline-flex;align-items:center;padding:0 9px;border-radius:9999px;background:rgba(255,255,255,.85);color:#0B0B0F;font:600 11px/1 var(--d-font)}
.fd-pill-demo-info{display:flex;flex-direction:column;gap:6px;padding:14px 16px 16px}
.fd-pill-demo-info b{font:600 20px/1.1 var(--d-disp);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.fd-pill-demo-info span{font:400 14px/1.3 var(--d-font)}
.fd-pill-demo-info small{font:400 13px/1.3 var(--d-font);color:var(--d-mut)}
.fd-pill-demo-empty{padding:48px 0;text-align:center;color:var(--d-mut)}
@keyframes fd-pill-in{from{opacity:0;transform:translateY(8px)}}
@media (max-width:640px){.fd-pill-demo-frow{grid-template-columns:1fr;gap:8px}.fd-pill-demo-filters{padding:16px}}
@media (prefers-reduced-motion:reduce){.fd-pill-demo-card{animation:none}}
`;
