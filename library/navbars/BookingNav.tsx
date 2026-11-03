/**
 * BookingNav, a boutique hotel header. A dismissible announcement bar sits
 * above a transparent nav laid over a full-bleed photograph. Once the page
 * scrolls the nav turns solid, hides while you scroll down and comes back
 * the moment you scroll up. On the right a compact "Dates · Guests ·
 * Reserve" pill opens a range calendar (with nightly rates and sold-out
 * nights) and a guest stepper.
 *
 * Props: hotel, place, announcement, links, month (year, monthIndex),
 * rates (day → price), soldOut (days), defaultRange, currency, onReserve.
 * CSS vars: --fd-bkn-cream, --fd-bkn-sea, --fd-bkn-terra.
 *
 * Behaviour: the header is `position: fixed`; put it before a full-bleed
 * hero. It reads window scroll.
 * Browser support: all evergreen browsers (backdrop-filter on the pill
 * degrades to a solid tint).
 * Accessibility: popover triggers have aria-expanded/aria-controls; the
 * calendar is a grid of buttons with arrow-key movement, aria-pressed on
 * chosen nights and labels such as "Saturday 12 December, €340"; Escape
 * closes and returns focus. The mobile menu is a modal dialog with a focus
 * trap. The announcement close button moves focus to the hotel name.
 * Reduced motion: no slide on hide/show, popovers appear instantly.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export interface BookingNavProps {
  hotel?: string;
  place?: string;
  announcement?: string;
  links?: { label: string; href: string }[];
  month?: { year: number; index: number };
  rates?: (day: number) => number;
  soldOut?: number[];
  defaultRange?: [number, number];
  currency?: string;
  onReserve?: (r: { from: number; to: number; adults: number; children: number }) => void;
  className?: string;
}

const LINKS = [
  { label: "Rooms", href: "#rooms" },
  { label: "Terrace", href: "#terrace" },
  { label: "Kitchen", href: "#kitchen" },
  { label: "Journal", href: "#journal" },
];
const SOLD = [24, 25, 31];
const MONTH = { year: 2026, index: 11 };
const RANGE: [number, number] = [12, 15];
const rate = (d: number) => (d >= 18 ? 420 : [5, 6, 12, 13].includes(d) ? 380 : 340);
const WD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function BookingNav({
  hotel = "Sirena",
  place = "Positano · since 1952",
  announcement = "Open all winter: from €340 a night until 15 March, breakfast on the terrace included.",
  links = LINKS,
  month = MONTH,
  rates = rate,
  soldOut = SOLD,
  defaultRange = RANGE,
  currency = "€",
  onReserve,
  className,
}: BookingNavProps) {
  const uid = useId();
  const root = useRef<HTMLElement>(null);
  const ann = useRef<HTMLDivElement>(null);
  const brand = useRef<HTMLAnchorElement>(null);
  const datesBtn = useRef<HTMLButtonElement>(null);
  const guestsBtn = useRef<HTMLButtonElement>(null);
  const burger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [annOpen, setAnnOpen] = useState(true);
  const [annH, setAnnH] = useState(0);
  const [solid, setSolid] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [panel, setPanel] = useState<null | "dates" | "guests">(null);
  const [menu, setMenu] = useState(false);
  const [range, setRange] = useState<[number, number | null]>(defaultRange);
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [focusDay, setFocusDay] = useState(defaultRange[0]);
  const [sent, setSent] = useState(false);

  useLayoutEffect(() => {
    const el = ann.current;
    if (!el) return;
    const set = () => setAnnH(annOpen ? el.offsetHeight : 0);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [annOpen]);

  // Solid after the hero top, hide on scroll down, show on scroll up.
  useEffect(() => {
    let last = window.scrollY, raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        setSolid(y > 24);
        if (y < 120) setHidden(false);
        else if (y > last + 6) setHidden(true);
        else if (y < last - 6) setHidden(false);
        last = y;
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Popover: Escape, outside click, focus.
  useEffect(() => {
    if (!panel) return;
    const opener = panel === "dates" ? datesBtn.current : guestsBtn.current;
    window.setTimeout(() => {
      const p = pop.current;
      (p?.querySelector<HTMLElement>(`[data-day="${focusDay}"]`) ?? p?.querySelector<HTMLElement>("button"))?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanel(null);
        opener?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !datesBtn.current?.contains(t) && !guestsBtn.current?.contains(t)) setPanel(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [panel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mobile menu.
  useEffect(() => {
    if (!menu) return;
    const s = sheet.current;
    window.setTimeout(() => s?.querySelector<HTMLElement>("a,button")?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        burger.current?.focus();
      }
      if (e.key === "Tab" && s) {
        const f = Array.from(s.querySelectorAll<HTMLElement>("a,button")).filter((x) => x.offsetParent !== null);
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    const mq = matchMedia("(min-width: 901px)");
    const onMq = () => mq.matches && setMenu(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [menu]);

  // Calendar maths (UTC, no "now", so server and client agree).
  const first = new Date(Date.UTC(month.year, month.index, 1));
  const days = new Date(Date.UTC(month.year, month.index + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const monthName = first.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  const monShort = first.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  const dayName = (d: number) => new Date(Date.UTC(month.year, month.index, d)).toLocaleString("en-GB", { weekday: "long", timeZone: "UTC" });
  const [from, to] = range;
  const nights = to ? to - from : 0;
  const blocked = (a: number, b: number) => soldOut.some((s) => s >= a && s < b);
  const total = to ? Array.from({ length: nights }, (_, i) => rates(from + i)).reduce((x, y) => x + y, 0) : 0;

  const pickDay = (d: number) => {
    if (soldOut.includes(d) && (to !== null || d <= from)) return;
    if (to === null && d > from && !blocked(from, d)) setRange([from, d]);
    else setRange([d, null]);
    setFocusDay(d);
  };
  const gridKey = (e: ReactKeyboardEvent) => {
    const m: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in m)) return;
    e.preventDefault();
    const n = Math.min(days, Math.max(1, focusDay + m[e.key]));
    setFocusDay(n);
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-day="${n}"]`)?.focus();
  };

  const dateLabel = to ? `${from}–${to} ${monShort}` : `${from} ${monShort} →`;
  const guestLabel = `${adults + kids} ${adults + kids === 1 ? "guest" : "guests"}`;
  const reserve = () => {
    if (!to) {
      setPanel("dates");
      return;
    }
    onReserve?.({ from, to, adults, children: kids });
    setSent(true);
    setPanel(null);
    window.setTimeout(() => setSent(false), 2600);
  };

  const calendar = (
    <div className="fd-bkn-cal">
      <div className="fd-bkn-calhead">
        <b>{monthName} {month.year}</b>
        <span>{to ? `${nights} ${nights === 1 ? "night" : "nights"} · ${currency}${total.toLocaleString("en-GB")}` : "Choose your last night"}</span>
      </div>
      <div className="fd-bkn-grid" role="grid" aria-label={`${monthName} ${month.year}`} onKeyDown={gridKey}>
        <div role="row" className="fd-bkn-wk">{WD.map((w) => <span key={w} role="columnheader">{w}</span>)}</div>
        {Array.from({ length: Math.ceil((lead + days) / 7) }, (_, r) => (
          <div role="row" key={r} className="fd-bkn-wk">
            {Array.from({ length: 7 }, (_, c) => {
              const d = r * 7 + c - lead + 1;
              if (d < 1 || d > days) return <span key={c} role="gridcell" />;
              const sold = soldOut.includes(d);
              const isEnd = d === from || d === to;
              const inRange = to !== null && d > from && d < to;
              return (
                <span key={c} role="gridcell">
                  <button
                    type="button"
                    data-day={d}
                    tabIndex={d === focusDay ? 0 : -1}
                    className="fd-bkn-day"
                    data-end={isEnd ? "" : undefined}
                    data-in={inRange ? "" : undefined}
                    data-start={d === from ? "" : undefined}
                    data-stop={d === to ? "" : undefined}
                    aria-pressed={isEnd || inRange}
                    aria-disabled={sold || undefined}
                    aria-label={`${dayName(d)} ${d} ${monthName}, ${sold ? "sold out" : `${currency}${rates(d)}`}`}
                    onClick={() => pickDay(d)}
                  >
                    <b>{d}</b>
                    <small>{sold ? "full" : rates(d)}</small>
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="fd-bkn-calnote">Prices per night for two, breakfast included. Check-in from 15:00.</p>
    </div>
  );
  const stepper = (label: string, sub: string, v: number, set: (n: number) => void, min: number, max: number) => (
    <div className="fd-bkn-step">
      <span><b>{label}</b><small>{sub}</small></span>
      <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={v <= min} onClick={() => set(v - 1)}>−</button>
      <output aria-live="polite" aria-label={label}>{v}</output>
      <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={v >= max} onClick={() => set(v + 1)}>+</button>
    </div>
  );
  const guests = (
    <div className="fd-bkn-guests">
      {stepper("Adults", "13 and over", adults, setAdults, 1, 4)}
      {stepper("Children", "Cots free, under 3", kids, setKids, 0, 3)}
      <p className="fd-bkn-calnote">Our largest room, the Torre suite, sleeps four.</p>
    </div>
  );

  // No transform while the menu is open: a transformed ancestor would trap the fixed sheet.
  const shift = menu ? null : hidden && !panel ? "-100%" : solid ? `-${annH}px` : null;

  return (
    <header
      ref={root}
      className={`fd-bkn${className ? " " + className : ""}`}
      data-solid={solid || menu ? "" : undefined}
      style={shift ? { transform: `translateY(${shift})` } : undefined}
    >
      <style>{css}</style>
      <div className="fd-bkn-annwrap" data-open={annOpen ? "" : undefined}>
        <div ref={ann} className="fd-bkn-ann" inert={!annOpen ? true : undefined}>
          <p>{announcement} <a href="#winter">See winter dates</a></p>
          <button type="button" className="fd-bkn-annx" aria-label="Dismiss announcement" onClick={() => { setAnnOpen(false); brand.current?.focus(); }}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
      <div className="fd-bkn-bar">
        <nav className="fd-bkn-links" aria-label="Hotel">
          {links.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <a ref={brand} href="#top" className="fd-bkn-brand" aria-label={`${hotel}, ${place}`}>
          <span className="fd-bkn-word">{hotel}</span>
          <span className="fd-bkn-place">{place}</span>
        </a>
        <div className="fd-bkn-right">
          <div className="fd-bkn-pill">
            <button ref={datesBtn} type="button" className="fd-bkn-seg" aria-expanded={panel === "dates"} aria-controls={`${uid}-pop`} onClick={() => setPanel((p) => (p === "dates" ? null : "dates"))}>
              <small>Dates</small><b>{dateLabel}</b>
            </button>
            <span className="fd-bkn-dot" aria-hidden="true" />
            <button ref={guestsBtn} type="button" className="fd-bkn-seg" aria-expanded={panel === "guests"} aria-controls={`${uid}-pop`} onClick={() => setPanel((p) => (p === "guests" ? null : "guests"))}>
              <small>Guests</small><b>{guestLabel}</b>
            </button>
            <button type="button" className="fd-bkn-reserve" onClick={reserve}>
              <span>{sent ? "Request sent" : "Reserve"}</span>
            </button>
          </div>
          <button type="button" className="fd-bkn-mreserve" onClick={() => { setMenu(true); }}>Reserve</button>
          <button ref={burger} type="button" className="fd-bkn-burger" aria-label="Menu" aria-expanded={menu} aria-controls={`${uid}-sheet`} onClick={() => setMenu((m) => !m)}>
            <span /><span />
          </button>
          {panel && (
            <div ref={pop} id={`${uid}-pop`} className="fd-bkn-pop" role="dialog" aria-label={panel === "dates" ? "Choose dates" : "Guests"} data-kind={panel}>
              {panel === "dates" ? calendar : guests}
              <div className="fd-bkn-popfoot">
                <button type="button" className="fd-bkn-text" onClick={() => (panel === "dates" ? setRange([from, null]) : (setAdults(2), setKids(0)))}>Clear</button>
                <button type="button" className="fd-bkn-reserve fd-bkn-reserve-lg" onClick={() => (panel === "dates" && to ? setPanel("guests") : reserve())}>
                  {panel === "dates" ? (to ? "Next: guests" : "Pick a last night") : `Reserve · ${currency}${total.toLocaleString("en-GB")}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {sent && <p className="fd-bkn-toast" role="status">Request sent for {dateLabel}, {guestLabel}. Chiara will reply within the hour.</p>}

      <div ref={sheet} id={`${uid}-sheet`} className="fd-bkn-sheet" role="dialog" aria-modal="true" aria-label="Menu" hidden={!menu} style={{ top: annH + 64 }}>
        <nav aria-label="Hotel">
          {links.map((l, i) => <a key={l.href} href={l.href} style={{ animationDelay: `${i * 50}ms` }} onClick={() => setMenu(false)}>{l.label}</a>)}
        </nav>
        <div className="fd-bkn-mbook">
          <p className="fd-bkn-mh">Stay with us</p>
          {calendar}
          {guests}
          <button type="button" className="fd-bkn-reserve fd-bkn-reserve-lg fd-bkn-mfull" disabled={!to} onClick={() => { if (to) { reserve(); setMenu(false); } }}>
            {to ? `Reserve ${dateLabel} · ${currency}${total.toLocaleString("en-GB")}` : "Pick a last night"}
          </button>
        </div>
      </div>
    </header>
  );
}

const serif = `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`;
const sans = `ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif`;

const css = `
.fd-bkn {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-bkn-cream: #f6efe3;
  --fd-bkn-sea: #0f2a3a;
  --fd-bkn-terra: #b4532f;
  --fd-bkn-line: #e2d6c3;
  --fd-bkn-fg: #fff;
  position: fixed; left: 0; right: 0; top: 0; z-index: 60; display: block; margin: 0; padding: 0;
  font: 400 14px/1.4 ${sans};
  color: var(--fd-bkn-fg); background: transparent;
  transition: transform var(--fd-dur-3) var(--fd-ease-out);
}
.fd-bkn[data-solid] { --fd-bkn-fg: var(--fd-bkn-sea); }
.fd-bkn, .fd-bkn *, .fd-bkn *::before, .fd-bkn *::after { box-sizing: border-box; }
.fd-bkn a:focus-visible, .fd-bkn button:focus-visible { outline: 2px solid color-mix(in srgb, var(--fd-bkn-terra) 75%, transparent); outline-offset: 2px; }

.fd-bkn-annwrap { display: grid; grid-template-rows: 0fr; margin: 0; padding: 0; transition: grid-template-rows var(--fd-dur-3) var(--fd-ease-in-out); }
.fd-bkn-annwrap[data-open] { grid-template-rows: 1fr; }
.fd-bkn-ann { min-height: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 12px; margin: 0; padding: 0 48px; background: var(--fd-bkn-sea); color: #f6efe3; position: relative; }
.fd-bkn-ann p { margin: 0; padding: 10px 0; font: 400 0.8125rem/1.35 ${sans}; color: #f6efe3; text-align: center; }
.fd-bkn-ann a { margin: 0 0 0 6px; font: italic 400 0.875rem/1 ${serif}; color: #f2c9a8; text-decoration: underline; text-underline-offset: 3px; }
.fd-bkn-annx { position: absolute; right: 10px; top: 50%; display: grid; place-items: center; width: 30px; height: 30px; margin: -15px 0 0; padding: 0; border: 0; border-radius: 9999px; background: none; color: #f6efe3; cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-bkn-annx:hover { background: rgba(246,239,227,0.12); }
.fd-bkn-annx svg { display: block; }

.fd-bkn-bar { position: relative; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 84px; margin: 0; padding: 0 28px; color: var(--fd-bkn-fg); transition: background var(--fd-dur-3) linear, color var(--fd-dur-3) linear, box-shadow var(--fd-dur-3) linear; }
.fd-bkn:not([data-solid]) .fd-bkn-bar { background: linear-gradient(rgba(10,20,28,0.42), rgba(10,20,28,0)); text-shadow: 0 1px 12px rgba(0,0,0,0.25); }
.fd-bkn[data-solid] .fd-bkn-bar { background: var(--fd-bkn-cream); box-shadow: 0 1px 0 var(--fd-bkn-line); height: 72px; }
.fd-bkn-links { display: flex; gap: 26px; margin: 0; padding: 0; }
.fd-bkn-links a { position: relative; font: 500 0.8125rem/1 ${sans}; letter-spacing: 0.06em; text-transform: uppercase; color: inherit; text-decoration: none; padding: 6px 0; }
.fd-bkn-links a::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: currentColor; transform: scaleX(0); transform-origin: right; transition: transform var(--fd-dur-2) var(--fd-ease-out); }
.fd-bkn-links a:hover::after { transform: scaleX(1); transform-origin: left; }
.fd-bkn-brand { display: flex; flex-direction: column; align-items: center; gap: 2px; margin: 0; padding: 2px 8px; color: inherit; text-decoration: none; border-radius: 4px; }
.fd-bkn-word { font: italic 400 2.25rem/0.95 ${serif}; letter-spacing: -0.02em; color: inherit; transition: font-size var(--fd-dur-3) var(--fd-ease-out); }
.fd-bkn[data-solid] .fd-bkn-word { font-size: 1.875rem; }
.fd-bkn-place { font: 500 0.625rem/1 ${sans}; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.85; }
.fd-bkn-right { position: relative; display: flex; justify-content: flex-end; align-items: center; gap: 10px; }

.fd-bkn-pill { display: flex; align-items: center; margin: 0; padding: 4px 4px 4px 6px; border: 1px solid rgba(255,255,255,0.35); border-radius: 9999px; background: rgba(15,42,58,0.22); -webkit-backdrop-filter: blur(14px) saturate(1.2); backdrop-filter: blur(14px) saturate(1.2); text-shadow: none; transition: background var(--fd-dur-3) linear, border-color var(--fd-dur-3) linear; }
.fd-bkn[data-solid] .fd-bkn-pill { background: #fff; border-color: var(--fd-bkn-line); -webkit-backdrop-filter: none; backdrop-filter: none; }
.fd-bkn-seg { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; margin: 0; padding: 6px 12px; border: 0; border-radius: 9999px; background: none; color: inherit; cursor: pointer; appearance: none; -webkit-appearance: none; text-align: left; transition: background var(--fd-dur-1) linear; }
.fd-bkn-seg:hover, .fd-bkn-seg[aria-expanded="true"] { background: rgba(255,255,255,0.16); }
.fd-bkn[data-solid] .fd-bkn-seg:hover, .fd-bkn[data-solid] .fd-bkn-seg[aria-expanded="true"] { background: #f3ebde; }
.fd-bkn-seg small { font: 500 0.625rem/1 ${sans}; letter-spacing: 0.14em; text-transform: uppercase; color: inherit; opacity: 0.75; }
.fd-bkn-seg b { font: 400 0.9375rem/1 ${serif}; color: inherit; white-space: nowrap; font-variant-numeric: tabular-nums; }
.fd-bkn-dot { display: block; width: 3px; height: 3px; border-radius: 9999px; background: currentColor; opacity: 0.5; }
.fd-bkn-reserve { display: inline-flex; align-items: center; justify-content: center; height: 40px; margin: 0 0 0 6px; padding: 0 18px; border: 0; border-radius: 9999px; background: var(--fd-bkn-terra); color: #fff; font: 600 0.8125rem/1 ${sans}; letter-spacing: 0.04em; cursor: pointer; appearance: none; -webkit-appearance: none; white-space: nowrap; transition: transform var(--fd-dur-1) var(--fd-ease-out), background var(--fd-dur-1) linear; }
.fd-bkn-reserve:hover { background: #9e4626; }
.fd-bkn-reserve:active { transform: scale(0.96); }
.fd-bkn-reserve-lg { height: 44px; margin: 0; padding: 0 20px; }

.fd-bkn-pop { position: absolute; right: 0; top: calc(100% + 10px); z-index: 3; width: 360px; margin: 0; padding: 18px; border: 1px solid var(--fd-bkn-line); border-radius: 22px; background: var(--fd-bkn-cream); color: var(--fd-bkn-sea); text-shadow: none; box-shadow: 0 30px 60px -12px rgba(15,42,58,0.35); animation: fd-bkn-pop var(--fd-dur-3) var(--fd-ease-out); transform-origin: top right; }
.fd-bkn-pop[data-kind="guests"] { width: 320px; }
@keyframes fd-bkn-pop { from { opacity: 0; transform: translateY(-6px) scale(0.98); } }
.fd-bkn-cal, .fd-bkn-guests { margin: 0; padding: 0; color: var(--fd-bkn-sea); }
.fd-bkn-calhead { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin: 0 0 12px; }
.fd-bkn-calhead b { font: italic 400 1.25rem/1 ${serif}; color: var(--fd-bkn-sea); }
.fd-bkn-calhead span { font: 500 0.75rem/1 ${sans}; color: var(--fd-bkn-terra); }
.fd-bkn-grid { display: block; margin: 0; padding: 0; }
.fd-bkn-wk { display: grid; grid-template-columns: repeat(7, 1fr); }
.fd-bkn-wk > span { display: block; margin: 0; padding: 0; }
.fd-bkn-wk:first-child span { padding: 0 0 6px; font: 500 0.6875rem/1 ${sans}; letter-spacing: 0.06em; color: #7b8790; text-align: center; }
.fd-bkn-day { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 100%; height: 44px; margin: 0; padding: 0; border: 0; border-radius: 0; background: none; color: var(--fd-bkn-sea); cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-bkn-day b { font: 400 0.9375rem/1 ${serif}; font-variant-numeric: tabular-nums; }
.fd-bkn-day small { font: 400 0.5625rem/1 ${sans}; color: #7b8790; }
.fd-bkn-day:hover b { text-decoration: underline; text-underline-offset: 3px; }
.fd-bkn-day[data-in] { background: #ecdcc6; }
.fd-bkn-day[data-start] { background: linear-gradient(90deg, transparent 50%, #ecdcc6 50%); }
.fd-bkn-day[data-stop] { background: linear-gradient(90deg, #ecdcc6 50%, transparent 50%); }
.fd-bkn-day[data-start]:not([data-stop]):last-child { background: none; }
.fd-bkn-day[data-end]::before { content: ""; position: absolute; left: 50%; top: 50%; width: 42px; height: 42px; margin: -21px 0 0 -21px; border-radius: 9999px; background: var(--fd-bkn-sea); z-index: 0; animation: fd-bkn-dot var(--fd-dur-2) var(--fd-spring); }
@keyframes fd-bkn-dot { from { transform: scale(0.6); } }
.fd-bkn-day[data-end] b, .fd-bkn-day[data-end] small { position: relative; z-index: 1; color: #f6efe3; }
.fd-bkn-day[aria-disabled="true"] { cursor: not-allowed; }
.fd-bkn-day[aria-disabled="true"] b { color: #a9b2b8; text-decoration: line-through; }
.fd-bkn-calnote { margin: 12px 0 0; font: italic 400 0.8125rem/1.35 ${serif}; color: #5b6a74; }
.fd-bkn-step { display: grid; grid-template-columns: 1fr 36px 32px 36px; align-items: center; gap: 4px; padding: 12px 0; border-bottom: 1px solid var(--fd-bkn-line); }
.fd-bkn-step > span { display: flex; flex-direction: column; gap: 3px; }
.fd-bkn-step b { font: 400 1.0625rem/1 ${serif}; color: var(--fd-bkn-sea); }
.fd-bkn-step small { font: 400 0.75rem/1 ${sans}; color: #7b8790; }
.fd-bkn-step button { display: grid; place-items: center; width: 36px; height: 36px; margin: 0; padding: 0; border: 1px solid #cdbfa9; border-radius: 9999px; background: none; color: var(--fd-bkn-sea); font: 400 1.125rem/1 ${sans}; cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-bkn-step button:disabled { opacity: 0.35; cursor: default; }
.fd-bkn-step output { font: 400 1.125rem/1 ${serif}; text-align: center; color: var(--fd-bkn-sea); }
.fd-bkn-popfoot { display: flex; justify-content: space-between; align-items: center; margin: 14px 0 0; padding: 14px 0 0; border-top: 1px solid var(--fd-bkn-line); }
.fd-bkn-text { margin: 0; padding: 8px 4px; border: 0; background: none; font: 500 0.8125rem/1 ${sans}; color: var(--fd-bkn-sea); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-bkn-toast { position: fixed; left: 50%; bottom: 24px; z-index: 70; max-width: calc(100vw - 32px); margin: 0; padding: 12px 18px; border-radius: 14px; background: var(--fd-bkn-sea); color: #f6efe3; font: 400 0.9375rem/1.35 ${serif}; transform: translateX(-50%); box-shadow: 0 16px 40px rgba(15,42,58,0.35); animation: fd-bkn-toast var(--fd-dur-3) var(--fd-spring); }
@keyframes fd-bkn-toast { from { opacity: 0; transform: translate(-50%, 12px); } }

.fd-bkn-burger, .fd-bkn-mreserve { display: none; }
.fd-bkn-burger { position: relative; width: 42px; height: 42px; margin: 0 -8px 0 0; padding: 0; border: 0; background: none; color: inherit; cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-bkn-burger span { position: absolute; left: 11px; right: 11px; height: 1.5px; background: currentColor; transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-bkn-burger span:first-child { top: 17px; }
.fd-bkn-burger span:last-child { top: 24px; }
.fd-bkn-burger[aria-expanded="true"] span:first-child { transform: translateY(3.5px) rotate(45deg); }
.fd-bkn-burger[aria-expanded="true"] span:last-child { transform: translateY(-3.5px) rotate(-45deg); }
.fd-bkn-mreserve { height: 36px; margin: 0; padding: 0 14px; border: 0; border-radius: 9999px; background: var(--fd-bkn-terra); color: #fff; font: 600 0.75rem/1 ${sans}; letter-spacing: 0.04em; cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-bkn-sheet { position: fixed; left: 0; right: 0; top: 64px; bottom: 0; z-index: 2; overflow-y: auto; margin: 0; padding: 12px 20px 32px; background: var(--fd-bkn-cream); color: var(--fd-bkn-sea); text-shadow: none; animation: fd-bkn-sheet var(--fd-dur-3) var(--fd-ease-out); }
.fd-bkn-sheet[hidden] { display: none; }
@keyframes fd-bkn-sheet { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0 0 0 0); } }
.fd-bkn-sheet nav { display: block; margin: 0 0 20px; padding: 0; }
.fd-bkn-sheet nav a { display: block; margin: 0; padding: 12px 0; border-bottom: 1px solid var(--fd-bkn-line); font: italic 400 2.25rem/1 ${serif}; letter-spacing: -0.02em; color: var(--fd-bkn-sea); text-decoration: none; animation: fd-bkn-rise var(--fd-dur-3) var(--fd-ease-out) both; }
@keyframes fd-bkn-rise { from { opacity: 0; transform: translateY(10px); } }
.fd-bkn-mbook { margin: 0; padding: 18px; border: 1px solid var(--fd-bkn-line); border-radius: 22px; background: #fbf7f0; }
.fd-bkn-mh { margin: 0 0 14px; font: 500 0.6875rem/1 ${sans}; letter-spacing: 0.16em; text-transform: uppercase; color: var(--fd-bkn-terra); }
.fd-bkn-mbook .fd-bkn-guests { margin: 8px 0 16px; }
.fd-bkn-mfull { width: 100%; }

@media (max-width: 1100px) { .fd-bkn-links { gap: 18px; } .fd-bkn-links a:nth-child(n+4) { display: none; } }
@media (max-width: 900px) {
  .fd-bkn-bar, .fd-bkn[data-solid] .fd-bkn-bar { grid-template-columns: 1fr auto; height: 64px; padding: 0 18px; }
  .fd-bkn-links, .fd-bkn-pill { display: none; }
  .fd-bkn-brand { align-items: flex-start; padding-left: 0; }
  .fd-bkn-word, .fd-bkn[data-solid] .fd-bkn-word { font-size: 1.75rem; }
  .fd-bkn-burger, .fd-bkn-mreserve { display: block; }
  .fd-bkn-ann { padding: 0 44px 0 16px; justify-content: flex-start; }
  .fd-bkn-ann p { text-align: left; font-size: 0.75rem; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-bkn, .fd-bkn-annwrap, .fd-bkn-bar, .fd-bkn-word, .fd-bkn-burger span { transition: none; }
  .fd-bkn-pop, .fd-bkn-sheet, .fd-bkn-sheet nav a, .fd-bkn-toast, .fd-bkn-day[data-end]::before { animation: none; }
}
@media (prefers-reduced-transparency: reduce) { .fd-bkn-pill { -webkit-backdrop-filter: none; backdrop-filter: none; background: rgba(15,42,58,0.75); } }
`;

/* ── Demo ─────────────────────────────────────────────────────────────── */

export function Demo({ src = "/img/halcyon/positano-sunset.webp", roomSrc = "/img/halcyon/suite-900.webp" }: { src?: string; roomSrc?: string }) {
  return (
    <div className="fd-bkn-demo">
      <style>{demoCss}</style>
      <BookingNav />
      <section className="fd-bkn-demo-hero">
        <img src={src} alt="Positano at sunset, seen from the hotel terrace" width={1024} height={1024} />
        <div className="fd-bkn-demo-copy">
          <p>Hotel Sirena · Via Pasitea 118 · 23 rooms</p>
          <h1>A small hotel above the beach, <i>open all winter.</i></h1>
        </div>
      </section>
      <section className="fd-bkn-demo-rooms" id="rooms">
        <div>
          <p className="fd-bkn-demo-k">Rooms</p>
          <h2>Twenty-three rooms, nineteen with the sea in the window.</h2>
          <p>Terracotta floors from Vietri, linen from a mill in Biella, and shutters that still close with a hook. The Torre suite sits in the 16th century watchtower and sleeps four.</p>
          <ul>
            <li><b>Camera Mare</b><span>24 m² · from €340</span></li>
            <li><b>Terrazza</b><span>38 m² · from €480</span></li>
            <li><b>Suite Torre</b><span>62 m² · from €890</span></li>
          </ul>
        </div>
        <img src={roomSrc} alt="Suite with linen bed and a sea view" width={900} height={900} loading="lazy" />
      </section>
    </div>
  );
}

const demoCss = `
.fd-bkn-demo { margin: 0; padding: 0; background: #f6efe3; color: #0f2a3a; font: 400 15px/1.55 ${sans}; }
.fd-bkn-demo *, .fd-bkn-demo *::before, .fd-bkn-demo *::after { box-sizing: border-box; }
.fd-bkn-demo-hero { position: relative; height: 100vh; min-height: 620px; margin: 0; overflow: hidden; background: #2a2622; }
.fd-bkn-demo-hero img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 60%; }
.fd-bkn-demo-hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 45%, rgba(10,20,28,0.55)); }
.fd-bkn-demo-copy { position: absolute; left: 28px; right: 28px; bottom: 44px; z-index: 1; color: #fff; }
.fd-bkn-demo-copy p { margin: 0 0 14px; font: 500 0.75rem/1 ${sans}; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.86); }
.fd-bkn-demo-copy h1 { max-width: 15ch; margin: 0; font: 400 clamp(2.5rem, 6.4vw, 5.75rem)/0.98 ${serif}; letter-spacing: -0.03em; color: #fff; }
.fd-bkn-demo-rooms { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; max-width: 1240px; margin: 0 auto; padding: 96px 28px 140px; }
.fd-bkn-demo-k { margin: 0 0 14px; font: 500 0.6875rem/1 ${sans}; letter-spacing: 0.16em; text-transform: uppercase; color: #b4532f; }
.fd-bkn-demo-rooms h2 { margin: 0 0 18px; font: 400 2.5rem/1.05 ${serif}; letter-spacing: -0.02em; }
.fd-bkn-demo-rooms p { margin: 0 0 24px; max-width: 46ch; font: 400 1.0625rem/1.6 ${serif}; color: #3b4f5c; }
.fd-bkn-demo-rooms ul { margin: 0; padding: 0; list-style: none; border-top: 1px solid #e2d6c3; }
.fd-bkn-demo-rooms li { display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #e2d6c3; }
.fd-bkn-demo-rooms li b { font: italic 400 1.25rem/1 ${serif}; }
.fd-bkn-demo-rooms li span { font: 400 0.875rem/1 ${sans}; color: #5b6a74; }
.fd-bkn-demo-rooms img { display: block; width: 100%; aspect-ratio: 4 / 5; height: auto; object-fit: cover; border-radius: 200px 200px 0 0; }
@media (max-width: 900px) {
  .fd-bkn-demo-copy { left: 18px; right: 18px; bottom: 32px; }
  .fd-bkn-demo-rooms { grid-template-columns: 1fr; gap: 32px; padding: 56px 18px 80px; }
  .fd-bkn-demo-rooms h2 { font-size: 1.875rem; }
}
`;
