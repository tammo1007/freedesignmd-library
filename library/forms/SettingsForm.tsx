/**
 * SettingsForm — grouped settings with switches (role="switch"), range
 * sliders with a value bubble, radio cards, a select, and a save bar that
 * slides in as soon as anything changes.
 *
 * Props: initial (HomeSettings), onSave(values) (may return a Promise),
 * theme. Building blocks are exported too: Switch, RangeField, RadioCards,
 * SelectField, SaveBar — compose your own sections with them.
 *
 * Browser support: all evergreen browsers. The slider uses a native
 * <input type="range"> with ::-webkit / ::-moz thumb styling.
 * Accessibility: switches are <button role="switch" aria-checked> with the
 * label linked via aria-labelledby/aria-describedby; sliders keep native
 * keyboard (arrows, Home/End, PageUp/Down) and expose aria-valuetext; radio
 * cards use real radios (arrow keys); the save bar is a labelled region with
 * a polite live status and Escape-free: Discard and Save are plain buttons.
 * Reduced motion: the bar and knobs change instantly.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface HomeSettings {
  comfort: number;
  setback: number;
  eco: boolean;
  away: boolean;
  preheat: boolean;
  plan: "solar" | "cheap" | "comfort";
  tariff: string;
  alertPeak: boolean;
  weekly: boolean;
}

const DEFAULTS: HomeSettings = { comfort: 21, setback: 17.5, eco: true, away: true, preheat: false, plan: "solar", tariff: "octo", alertPeak: true, weekly: false };

/* ── primitives ── */

export function Switch({ label, description, checked, onChange, disabled }: { label: string; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="fd-set-row">
      <div className="fd-set-txt">
        <span id={`${id}-l`} className="fd-set-label">{label}</span>
        {description && <span id={`${id}-d`} className="fd-set-desc">{description}</span>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-l`} aria-describedby={description ? `${id}-d` : undefined} disabled={disabled} className="fd-set-switch" onClick={() => onChange(!checked)}>
        <span className="fd-set-knob" />
      </button>
    </div>
  );
}

export function RangeField({ label, value, min, max, step = 1, unit = "", onChange, format, hint }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; format?: (v: number) => string; hint?: string }) {
  const id = useId();
  const [active, setActive] = useState(false);
  const p = (value - min) / (max - min);
  const text = format ? format(value) : `${value}${unit}`;
  return (
    <div className="fd-set-range">
      <div className="fd-set-rhead">
        <label htmlFor={id} className="fd-set-label">{label}</label>
        <output htmlFor={id} className="fd-set-out">{text}</output>
      </div>
      <div className="fd-set-track" data-active={active || undefined} style={{ ["--p" as string]: p }}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={text}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => setActive(true)}
          onPointerUp={() => setActive(false)}
          onFocus={(e) => e.currentTarget.matches(":focus-visible") && setActive(true)}
          onBlur={() => setActive(false)}
        />
        <span className="fd-set-bubble" aria-hidden="true">{text}</span>
      </div>
      <div className="fd-set-ends" aria-hidden="true"><span>{format ? format(min) : `${min}${unit}`}</span>{hint && <span>{hint}</span>}<span>{format ? format(max) : `${max}${unit}`}</span></div>
    </div>
  );
}

export function RadioCards<T extends string>({ legend, value, onChange, options }: { legend: string; value: T; onChange: (v: T) => void; options: { value: T; title: string; desc: string; icon: ReactNode; tag?: string }[] }) {
  const name = useId();
  return (
    <fieldset className="fd-set-cards">
      <legend className="fd-set-label">{legend}</legend>
      <div className="fd-set-cardgrid">
        {options.map((o) => (
          <label key={o.value} className="fd-set-card" data-on={value === o.value || undefined}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="fd-set-cicon">{o.icon}</span>
            <span className="fd-set-ctitle">{o.title}{o.tag && <em>{o.tag}</em>}</span>
            <span className="fd-set-cdesc">{o.desc}</span>
            <span className="fd-set-cradio" aria-hidden="true"><svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SelectField({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; hint?: string }) {
  const id = useId();
  return (
    <div className="fd-set-select">
      <label htmlFor={id} className="fd-set-label">{label}</label>
      <div className="fd-set-sbox">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </div>
      {hint && <p className="fd-set-desc">{hint}</p>}
    </div>
  );
}

export function SaveBar({ open, changes, saving, saved, onDiscard, onSave }: { open: boolean; changes: number; saving?: boolean; saved?: boolean; onDiscard: () => void; onSave: () => void }) {
  return (
    <div className="fd-set-bar" data-open={open || undefined} role="region" aria-label="Unsaved changes" aria-hidden={!open}>
      <p role="status">{saved ? "All changes saved" : `${changes} unsaved ${changes === 1 ? "change" : "changes"}`}</p>
      <button type="button" className="fd-set-bbtn" data-v="ghost" onClick={onDiscard} disabled={!open || saving || saved} tabIndex={open ? 0 : -1}>Discard</button>
      <button type="button" className="fd-set-bbtn" data-v="primary" data-state={saving ? "saving" : saved ? "saved" : undefined} onClick={onSave} disabled={!open || saving || saved} tabIndex={open ? 0 : -1}>
        <span>Save changes</span>
        <svg className="fd-set-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
        <svg className="fd-set-ok" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </button>
    </div>
  );
}

/* ── composed form ── */

const ic = (d: string) => <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const ICONS = {
  sun: ic("M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"),
  coin: ic("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM14.8 9.2C14.3 8.5 13.3 8 12 8c-1.7 0-3 .8-3 2s1.3 1.8 3 2 3 .8 3 2-1.3 2-3 2c-1.3 0-2.3-.5-2.8-1.2M12 6.5V8M12 16v1.5"),
  heart: ic("M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"),
};

export interface SettingsFormProps {
  initial?: HomeSettings;
  onSave?: (v: HomeSettings) => void | Promise<unknown>;
  theme?: "light" | "dark";
  className?: string;
  /** Rendered beside the form (sticky summary). */
  aside?: (v: HomeSettings) => ReactNode;
}

export function SettingsForm({ initial = DEFAULTS, onSave, theme, className, aside }: SettingsFormProps) {
  const [saved, setSaved] = useState(initial);
  const [v, setV] = useState(initial);
  const [phase, setPhase] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const changes = useMemo(() => (Object.keys(v) as (keyof HomeSettings)[]).filter((k) => v[k] !== saved[k]).length, [v, saved]);
  const dirty = changes > 0;
  const set = <K extends keyof HomeSettings>(k: K, val: HomeSettings[K]) => {
    if (phase === "saved") setPhase("idle");
    setV((p) => ({ ...p, [k]: val }));
  };

  const save = async () => {
    setPhase("saving");
    try {
      await onSave?.(v);
      await new Promise((r) => (timer.current = window.setTimeout(r, 900)));
      setSaved(v);
      setPhase("saved");
      timer.current = window.setTimeout(() => setPhase("idle"), 1600);
    } catch {
      setPhase("idle");
    }
  };

  return (
    <div className={`fd-set${className ? " " + className : ""}`} data-fd-theme={theme}>
      <style>{css}</style>
      <div className="fd-set-layout">
        <form className="fd-set-form" onSubmit={(e) => { e.preventDefault(); if (dirty) save(); }} aria-label="Home energy settings">
          <section className="fd-set-sec" aria-labelledby="fd-set-s1">
            <header><h2 id="fd-set-s1">Comfort</h2><p>Set the temperatures your home aims for.</p></header>
            <RangeField label="Target temperature" value={v.comfort} min={16} max={28} step={0.5} format={(n) => `${n.toFixed(1)} °C`} onChange={(n) => set("comfort", n)} hint="Recommended 20–22" />
            <RangeField label="Night setback" value={v.setback} min={14} max={21} step={0.5} format={(n) => `${n.toFixed(1)} °C`} onChange={(n) => set("setback", n)} />
          </section>

          <section className="fd-set-sec" aria-labelledby="fd-set-s2">
            <header><h2 id="fd-set-s2">Automation</h2><p>Let the thermostat adapt to your routine.</p></header>
            <Switch label="Eco mode" description="Lower the target by 1 °C when rooms are empty." checked={v.eco} onChange={(b) => set("eco", b)} />
            <Switch label="Away detection" description="Pause heating when all phones leave the geofence." checked={v.away} onChange={(b) => set("away", b)} />
            <Switch label="Pre-heat before arrival" description="Start warming 30 minutes before you get home." checked={v.preheat} onChange={(b) => set("preheat", b)} />
          </section>

          <section className="fd-set-sec" aria-labelledby="fd-set-s3">
            <header><h2 id="fd-set-s3">Energy plan</h2><p>Choose what the system optimises for.</p></header>
            <RadioCards
              legend="Optimise for"
              value={v.plan}
              onChange={(p) => set("plan", p)}
              options={[
                { value: "solar", title: "Solar first", desc: "Run heavy loads when your panels produce.", icon: ICONS.sun, tag: "Popular" },
                { value: "cheap", title: "Cheapest hours", desc: "Shift charging and heating to low-price slots.", icon: ICONS.coin },
                { value: "comfort", title: "Max comfort", desc: "Never compromise on temperature.", icon: ICONS.heart },
              ]}
            />
            <SelectField label="Electricity tariff" value={v.tariff} onChange={(t) => set("tariff", t)} hint="Used to forecast cost from live day-ahead prices." options={[{ value: "octo", label: "Octopus Agile · dynamic" }, { value: "ovo", label: "OVO Simpler · fixed 27.4p/kWh" }, { value: "edf", label: "EDF GoElectric · EV night rate" }, { value: "none", label: "Not listed" }]} />
          </section>

          <section className="fd-set-sec" aria-labelledby="fd-set-s4">
            <header><h2 id="fd-set-s4">Notifications</h2></header>
            <Switch label="Peak price alerts" description="Push notification 15 minutes before prices spike." checked={v.alertPeak} onChange={(b) => set("alertPeak", b)} />
            <Switch label="Weekly energy report" description="A Sunday summary of usage, cost and CO₂ saved." checked={v.weekly} onChange={(b) => set("weekly", b)} />
          </section>
        </form>
        {aside && <aside className="fd-set-aside">{aside(v)}</aside>}
      </div>

      <SaveBar
        open={dirty || phase !== "idle"}
        changes={changes}
        saving={phase === "saving"}
        saved={phase === "saved"}
        onDiscard={() => setV(saved)}
        onSave={save}
      />
    </div>
  );
}

const css = `
:where(.fd-set,.fd-set *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-set,.fd-set *)::before,:where(.fd-set,.fd-set *)::after{box-sizing:border-box}
:where(.fd-set svg){display:block;flex-shrink:0}
:where(.fd-set button,.fd-set input,.fd-set select){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;outline:0}
:where(.fd-set fieldset){min-width:0}
.fd-set{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --t-card:#fff;--t-fg:#0B0B0F;--t-mut:#6B6B76;--t-line:rgba(11,11,15,.08);--t-track:rgba(11,11,15,.12);--t-soft:rgba(11,11,15,.04);--t-accent:#0E9F6E;--t-ring:rgba(10,132,255,.7);--t-field:#fff;--t-field-line:rgba(11,11,15,.16);
  position:relative;width:100%;
  font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;color:var(--t-fg);
}
[data-fd-theme="dark"] .fd-set,.fd-set[data-fd-theme="dark"]{--t-card:#111115;--t-fg:#F5F5F7;--t-mut:#9A9AA6;--t-line:rgba(255,255,255,.09);--t-track:rgba(255,255,255,.14);--t-soft:rgba(255,255,255,.05);--t-accent:#34D399;--t-field:#16161B;--t-field-line:rgba(255,255,255,.14)}
.fd-set-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;align-items:start}
.fd-set-layout:has(.fd-set-aside){grid-template-columns:minmax(0,1fr) 300px}
.fd-set-form{display:flex;flex-direction:column;gap:16px}
.fd-set-sec{display:flex;flex-direction:column;gap:20px;padding:24px;border-radius:24px;background:var(--t-card);box-shadow:0 0 0 1px var(--t-line),0 1px 2px rgba(0,0,0,.03),0 16px 32px -24px rgba(0,0,0,.18)}
.fd-set-sec header h2{font-size:17px;font-weight:600;line-height:1.2;letter-spacing:-.01em}
.fd-set-sec header p{margin-top:4px;font-size:14px;line-height:1.4;color:var(--t-mut)}
.fd-set-label{font-size:15px;font-weight:500;line-height:1.3;color:var(--t-fg)}
.fd-set-desc{display:block;font-size:13px;line-height:1.4;color:var(--t-mut)}
.fd-set-row{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:4px 0}
.fd-set-row+.fd-set-row{padding-top:16px;border-top:1px solid var(--t-line)}
.fd-set-txt{display:flex;flex-direction:column;gap:3px;min-width:0}
.fd-set-switch{position:relative;flex:none;width:48px;height:28px;border-radius:9999px;cursor:pointer;background:var(--t-track);
  transition:background-color var(--fd-dur-2) var(--fd-ease-out),box-shadow var(--fd-dur-2) var(--fd-ease-out);box-shadow:inset 0 1px 2px rgba(0,0,0,.12)}
.fd-set-switch[aria-checked="true"]{background:var(--t-accent)}
.fd-set-knob{position:absolute;left:2px;top:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 1px rgba(0,0,0,.12),0 2px 5px rgba(0,0,0,.22);transition:transform var(--fd-dur-3) var(--fd-spring),width var(--fd-dur-1) var(--fd-ease-out)}
.fd-set-switch[aria-checked="true"] .fd-set-knob{transform:translateX(20px)}
.fd-set-switch:active .fd-set-knob{width:28px}.fd-set-switch[aria-checked="true"]:active .fd-set-knob{transform:translateX(16px)}
.fd-set-switch:focus-visible{outline:2px solid var(--t-ring);outline-offset:2px}
.fd-set-switch:disabled{opacity:.45;cursor:not-allowed}
.fd-set-range{display:flex;flex-direction:column;gap:12px}
.fd-set-rhead{display:flex;justify-content:space-between;align-items:baseline}
.fd-set-out{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--t-fg)}
.fd-set-track{position:relative;height:28px;display:flex;align-items:center}
.fd-set-track input{width:100%;height:28px;margin:0;cursor:pointer;background:transparent}
.fd-set-track input::-webkit-slider-runnable-track{height:6px;border-radius:9999px;background:linear-gradient(to right,var(--t-accent) calc(11px + (100% - 22px) * var(--p)),var(--t-track) 0)}
.fd-set-track input::-moz-range-track{height:6px;border-radius:9999px;background:var(--t-track)}
.fd-set-track input::-moz-range-progress{height:6px;border-radius:9999px;background:var(--t-accent)}
.fd-set-track input::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;margin-top:-8px;border-radius:50%;border:0;background:#fff;box-shadow:0 0 0 .5px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.18),0 3px 8px rgba(0,0,0,.18);transition:transform var(--fd-dur-3) var(--fd-spring)}
.fd-set-track input::-moz-range-thumb{width:22px;height:22px;border-radius:50%;border:0;background:#fff;box-shadow:0 0 0 .5px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.18),0 3px 8px rgba(0,0,0,.18)}
.fd-set-track input:active::-webkit-slider-thumb{transform:scale(1.12)}
.fd-set-track input:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 2px var(--t-ring),0 2px 8px rgba(0,0,0,.2)}
.fd-set-track input:focus-visible::-moz-range-thumb{box-shadow:0 0 0 2px var(--t-ring)}
.fd-set-bubble{position:absolute;bottom:calc(100% + 2px);left:calc(11px + (100% - 22px) * var(--p));transform:translate(-50%,6px) scale(.8);transform-origin:50% 100%;opacity:0;pointer-events:none;
  padding:6px 10px;border-radius:9px;background:var(--t-fg);color:var(--t-card);font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;
  transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring)}
.fd-set-bubble::after{content:"";position:absolute;left:50%;top:100%;width:8px;height:8px;margin:-4px 0 0 -4px;background:inherit;transform:rotate(45deg);border-radius:0 0 2px 0}
@media (hover:hover){.fd-set-track:hover .fd-set-bubble{opacity:1;transform:translate(-50%,0) scale(1)}}
.fd-set-track[data-active] .fd-set-bubble{opacity:1;transform:translate(-50%,0) scale(1)}
.fd-set-ends{display:flex;justify-content:space-between;font-size:12px;line-height:1;color:var(--t-mut)}
.fd-set-cards{border:0}.fd-set-cards legend{margin-bottom:12px;padding:0}
.fd-set-cardgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.fd-set-card{position:relative;display:flex;flex-direction:column;gap:6px;padding:16px;border-radius:16px;cursor:pointer;background:var(--t-field);box-shadow:0 0 0 1px var(--t-field-line);
  transition:box-shadow var(--fd-dur-2) var(--fd-ease-out),background-color var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring)}
@media (hover:hover){.fd-set-card:hover{box-shadow:0 0 0 1px var(--t-mut)}}
.fd-set-card input{position:absolute;opacity:0;inset:0;width:100%;height:100%;cursor:pointer}
.fd-set-card:has(input:focus-visible){outline:2px solid var(--t-ring);outline-offset:2px}
.fd-set-card:active{transform:scale(.98);transition-duration:var(--fd-dur-1)}
.fd-set-card[data-on]{box-shadow:0 0 0 1.5px var(--t-accent);background:color-mix(in srgb,var(--t-accent) 7%,var(--t-field))}
.fd-set-cicon{display:grid;place-items:center;width:36px;height:36px;margin-bottom:6px;border-radius:10px;background:var(--t-soft);color:var(--t-mut);transition:background-color var(--fd-dur-2),color var(--fd-dur-2)}
.fd-set-card[data-on] .fd-set-cicon{background:var(--t-accent);color:#fff}
.fd-set-ctitle{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;line-height:1.2}
.fd-set-ctitle em{font-style:normal;font-size:11px;font-weight:600;padding:3px 7px;border-radius:9999px;background:color-mix(in srgb,var(--t-accent) 16%,transparent);color:var(--t-accent)}
.fd-set-cdesc{font-size:13px;line-height:1.4;color:var(--t-mut)}
.fd-set-cradio{position:absolute;right:12px;top:12px;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;box-shadow:0 0 0 1.5px var(--t-field-line) inset;color:transparent;transition:all var(--fd-dur-3) var(--fd-spring)}
.fd-set-card[data-on] .fd-set-cradio{background:var(--t-accent);box-shadow:none;color:#fff;transform:scale(1.05)}
.fd-set-select{display:flex;flex-direction:column;gap:8px}
.fd-set-sbox{position:relative}
.fd-set-sbox select{display:block;width:100%;height:48px;padding:0 40px 0 14px;border-radius:12px;cursor:pointer;background:var(--t-field);color:var(--t-fg);font-family:inherit;font-size:15px;letter-spacing:inherit;box-shadow:0 0 0 1px var(--t-field-line),0 1px 2px rgba(0,0,0,.04);transition:box-shadow var(--fd-dur-2) var(--fd-ease-out)}
.fd-set-sbox select:focus-visible{box-shadow:0 0 0 1.5px var(--t-ring),0 0 0 5px color-mix(in srgb,var(--t-ring) 25%,transparent)}
.fd-set-sbox select option{color:#0B0B0F;background:#fff}
.fd-set-sbox svg{position:absolute;right:14px;top:16px;pointer-events:none;color:var(--t-mut)}
.fd-set-aside{position:sticky;top:24px}
.fd-set-bar{position:sticky;z-index:5;bottom:16px;display:flex;align-items:center;gap:8px;width:max-content;max-width:calc(100% - 16px);margin:20px auto 0;padding:8px 8px 8px 20px;border-radius:9999px;
  background:#16161B;color:#F5F5F7;box-shadow:0 1px 0 rgba(255,255,255,.08) inset,0 0 0 1px rgba(255,255,255,.08),0 2px 6px rgba(0,0,0,.2),0 24px 48px -12px rgba(0,0,0,.5);
  transform:translateY(calc(100% + 40px)) scale(.96);opacity:0;pointer-events:none;visibility:hidden;transition:transform var(--fd-dur-3) var(--fd-spring),opacity var(--fd-dur-2) var(--fd-ease-out),visibility 0s linear var(--fd-dur-3)}
[data-fd-theme="dark"] .fd-set-bar,.fd-set-bar[data-fd-theme="dark"]{background:#F5F5F7;color:#0B0B0F;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 2px 6px rgba(0,0,0,.2),0 24px 48px -12px rgba(0,0,0,.6)}
.fd-set-bar[data-open]{transform:none;opacity:1;pointer-events:auto;visibility:visible;transition-delay:0s}
.fd-set-bar p{margin-right:12px;font-size:14px;font-weight:500;line-height:1;white-space:nowrap;font-variant-numeric:tabular-nums}
.fd-set-bbtn{position:relative;display:inline-grid;place-items:center;height:40px;padding:0 18px;border-radius:9999px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;line-height:1;transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring),background-color var(--fd-dur-2),opacity var(--fd-dur-2)}
.fd-set-bbtn:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-set-bbtn:focus-visible{outline:2px solid #5AA9FF;outline-offset:2px}
.fd-set-bbtn[data-v="ghost"]{color:inherit;opacity:.7}.fd-set-bbtn[data-v="ghost"]:hover:not(:disabled){opacity:1;background:rgba(127,127,140,.2)}
.fd-set-bbtn[data-v="primary"]{background:#34D399;color:#04261A;min-width:136px}
.fd-set-bbtn[data-v="primary"]:hover:not(:disabled){background:#4BE0AA}
.fd-set-bbtn:disabled{cursor:default}.fd-set-bbtn[data-v="ghost"]:disabled{opacity:.3}
.fd-set-bbtn>*{grid-area:1/1;transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-ease-out)}
.fd-set-spin,.fd-set-ok{opacity:0;transform:scale(.6)}
.fd-set-spin{animation:fd-set-rot .8s linear infinite}
.fd-set-bbtn[data-state="saving"]>span,.fd-set-bbtn[data-state="saved"]>span{opacity:0;transform:translateY(-8px)}
.fd-set-bbtn[data-state="saving"] .fd-set-spin,.fd-set-bbtn[data-state="saved"] .fd-set-ok{opacity:1;transform:none}
.fd-set-ok path{stroke-dasharray:24;stroke-dashoffset:24}.fd-set-bbtn[data-state="saved"] .fd-set-ok path{animation:fd-set-draw 380ms var(--fd-ease-out) 100ms forwards}
@keyframes fd-set-rot{to{transform:rotate(360deg)}}
@keyframes fd-set-draw{to{stroke-dashoffset:0}}
@media (max-width:900px){.fd-set-layout:has(.fd-set-aside){grid-template-columns:minmax(0,1fr)}.fd-set-aside{position:static;order:-1}}
@media (max-width:640px){.fd-set-cardgrid{grid-template-columns:1fr}.fd-set-sec{padding:20px;border-radius:20px}.fd-set-card{flex-direction:row;flex-wrap:wrap;align-items:center;column-gap:12px}.fd-set-cicon{margin:0}.fd-set-cdesc{flex-basis:100%}.fd-set-bar{bottom:12px}.fd-set-bar p{margin-right:4px;font-size:13px}.fd-set-bbtn{padding:0 14px}.fd-set-bbtn[data-v="primary"]{min-width:112px}}
@media (prefers-reduced-motion:reduce){.fd-set-bar,.fd-set-knob,.fd-set-bubble,.fd-set-bbtn,.fd-set-card,.fd-set-cradio{transition:none}.fd-set-spin{animation:none}.fd-set-ok path{animation:none;stroke-dashoffset:0}}
@media (prefers-contrast:more){.fd-set-switch{box-shadow:0 0 0 1px currentColor}.fd-set-card{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

function estimate(v: HomeSettings) {
  const plan = { solar: -14, cheap: -9, comfort: 8 }[v.plan];
  const heat = (v.comfort - 20) * 5.2 - (v.setback - 17) * 2.4;
  const auto = (v.eco ? -6.5 : 0) + (v.away ? -5 : 0) + (v.preheat ? 3 : 0);
  const eur = Math.max(18, 74 + plan + heat + auto);
  const co2 = Math.max(12, 138 + plan * 3 + heat * 4 + auto * 3);
  return { eur, co2 };
}

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toast, setToast] = useState("");
  return (
    <div className="fd-set-demo" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-set-demo-bar">
        <span className="fd-set-demo-brand"><i aria-hidden="true" />Voltra Home</span>
        <nav aria-label="Primary"><a href="#home">Home</a><a href="#energy">Energy</a><a href="#devices">Devices</a><a href="#settings" aria-current="page">Settings</a></nav>
        <button type="button" className="fd-set-demo-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      </header>
      <main className="fd-set-demo-main">
        <div className="fd-set-demo-head"><h1>Heating &amp; energy</h1><p>Maple Street · 4 rooms · 3 devices online</p></div>
        <SettingsForm
          theme={theme}
          onSave={() => setToast("Settings synced to 3 devices")}
          aside={(v) => {
            const e = estimate(v);
            return (
              <div className="fd-set-demo-sum">
                <p>Estimated this month</p>
                <b>€{e.eur.toFixed(2)}</b>
                <div className="fd-set-demo-bars" aria-hidden="true"><i style={{ width: `${Math.min(100, (e.eur / 120) * 100)}%` }} /></div>
                <dl>
                  <div><dt>CO₂</dt><dd>{Math.round(e.co2)} kg</dd></div>
                  <div><dt>vs. last month</dt><dd data-up={e.eur > 74 || undefined}>{e.eur > 74 ? "+" : "−"}€{Math.abs(74 - e.eur).toFixed(2)}</dd></div>
                </dl>
                {toast && <small role="status">{toast}</small>}
              </div>
            );
          }}
        />
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-set-demo,.fd-set-demo *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-set-demo,.fd-set-demo *)::before,:where(.fd-set-demo,.fd-set-demo *)::after{box-sizing:border-box}
:where(.fd-set-demo button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-set-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:ui-sans-serif,-apple-system,"SF Pro Display","Inter",sans-serif;
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-dur-2:240ms;
  --d-bg:#F3F5F4;--d-ink:#0B0B0F;--d-mut:#6B6B76;--d-line:rgba(11,11,15,.08);--d-green:#0E9F6E;--d-card:#fff;
  min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.45 var(--d-font);-webkit-font-smoothing:antialiased;transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-set-demo[data-fd-theme="dark"]{--d-bg:#08090A;--d-ink:#F5F5F7;--d-mut:#9A9AA6;--d-line:rgba(255,255,255,.09);--d-green:#34D399;--d-card:#111115}
.fd-set-demo-bar{display:flex;align-items:center;gap:32px;height:60px;padding:0 clamp(16px,4vw,40px)}
.fd-set-demo-brand{display:flex;align-items:center;gap:10px;font:700 17px/1 var(--d-disp);letter-spacing:-.03em;margin-right:auto}
.fd-set-demo-brand i{width:20px;height:20px;border-radius:50%;background:var(--d-green);position:relative}.fd-set-demo-brand i::after{content:"";position:absolute;left:6px;top:4px;width:8px;height:12px;background:var(--d-bg);clip-path:polygon(60% 0,0 58%,45% 58%,35% 100%,100% 38%,55% 38%)}
.fd-set-demo-bar nav{display:flex;gap:24px;font:500 14px/1 var(--d-font);color:var(--d-mut)}.fd-set-demo-bar nav a{padding:8px 0}.fd-set-demo-bar nav a:hover,.fd-set-demo-bar nav a[aria-current]{color:var(--d-ink)}
.fd-set-demo-bar nav a:focus-visible,.fd-set-demo-theme:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px;border-radius:6px}
.fd-set-demo-theme{cursor:pointer;height:32px;padding:0 14px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 13px/1 var(--d-font);color:var(--d-mut)}.fd-set-demo-theme:hover{color:var(--d-ink)}
.fd-set-demo-main{max-width:1040px;margin:0 auto;padding:32px clamp(16px,4vw,40px) 40px}
.fd-set-demo-head{margin-bottom:24px}.fd-set-demo-head h1{font:600 28px/1.15 var(--d-disp);letter-spacing:-.025em}.fd-set-demo-head p{margin-top:6px;font:400 14px/1.4 var(--d-font);color:var(--d-mut)}
.fd-set-demo-sum{display:flex;flex-direction:column;gap:12px;padding:24px;border-radius:24px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line),0 16px 32px -24px rgba(0,0,0,.2)}
.fd-set-demo-sum p{font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-set-demo-sum b{font:600 40px/1 var(--d-disp);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.fd-set-demo-bars{height:6px;border-radius:9999px;background:var(--d-line);overflow:hidden}.fd-set-demo-bars i{display:block;height:100%;border-radius:inherit;background:var(--d-green);transition:width 420ms var(--fd-ease-out)}
.fd-set-demo-sum dl{display:flex;flex-direction:column;gap:10px;margin-top:4px;padding-top:14px;border-top:1px solid var(--d-line);font:400 14px/1.2 var(--d-font)}
.fd-set-demo-sum dl div{display:flex;justify-content:space-between}.fd-set-demo-sum dt{color:var(--d-mut)}.fd-set-demo-sum dd{font-variant-numeric:tabular-nums;font-weight:500;color:var(--d-green)}.fd-set-demo-sum dd[data-up]{color:#E5484D}
.fd-set-demo-sum small{font:500 12px/1.3 var(--d-font);color:var(--d-green)}
@media (max-width:720px){.fd-set-demo-bar nav{display:none}}
`;
