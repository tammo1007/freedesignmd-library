/**
 * CurtainRevealFooter — a restaurant footer that sits still while the page
 * lifts off it like a curtain. Tonight's free tables are chips you can pick,
 * a party-size stepper and a huge serif "Book a table" that turns into a
 * confirmation. Below: hours, address, a small terrace photo, wordmark.
 *
 * Technique (works anywhere you paste it): the footer is `position: fixed` to
 * the bottom of the viewport inside a wrapper that has `clip-path: inset(0)`.
 * The wrapper takes the footer's measured height, so it sits in normal flow
 * after your content; the clip makes the fixed layer visible only through the
 * wrapper's box, which is what makes the content appear to lift. No z-index
 * or background changes are needed on the content above. If the footer is
 * taller than the viewport (small phones), it falls back to a normal static
 * footer so nothing is ever unreachable.
 *
 * Props: name, slots, hours, address, phone, note, photo { src, alt },
 * legal, onBook(slot, guests).
 * CSS vars: --fd-crf-bg, --fd-crf-fg, --fd-crf-accent.
 *
 * Browser support: clip-path inset (all evergreen browsers).
 * Accessibility: slots are a radio group (arrow keys move), the stepper uses
 * labelled buttons and an output, the booking confirmation is announced via
 * a polite live region. Reduced motion removes the depth shading and scale.
 * SSR: renders static; the curtain switches on after measuring in an effect.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export interface CrfSlot { time: string; left: number }
export interface CrfHours { label: string; time: string; days: string }

export interface CurtainRevealFooterProps {
  name?: string;
  slots?: CrfSlot[];
  hours?: CrfHours[];
  address?: string[];
  phone?: string;
  note?: string;
  photo?: { src: string; alt: string };
  legal?: string[];
  onBook?: (slot: string, guests: number) => void;
  className?: string;
}

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

const DEFAULT_SLOTS: CrfSlot[] = [
  { time: "19:30", left: 0 },
  { time: "20:15", left: 2 },
  { time: "21:00", left: 4 },
  { time: "21:45", left: 1 },
];
const DEFAULT_HOURS: CrfHours[] = [
  { label: "Pranzo", time: "12:30 to 15:00", days: "Wed to Sun" },
  { label: "Cena", time: "19:30 to 23:00", days: "Daily, not Tuesday" },
  { label: "Bar", time: "from 17:00", days: "Spritz on the terrace" },
];

export function CurtainRevealFooter({
  name = "Limonaia",
  slots = DEFAULT_SLOTS,
  hours = DEFAULT_HOURS,
  address = ["Via Pasitea 148", "84017 Positano SA, Italia"],
  phone = "+39 089 875 0142",
  note = "Ten minutes up from the beach. Take the steps, or the blue Interno bus to the Chiesa Nuova stop.",
  photo = { src: "/img/halcyon/pool-lemons-480.webp", alt: "Lemon trees over the terrace and the bay of Positano" },
  legal = ["© 2026 Limonaia di Positano S.r.l.", "P.IVA 04827310657"],
  onBook,
  className,
}: CurtainRevealFooterProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  const [fixed, setFixed] = useState(false);
  const firstOpen = slots.find((s) => s.left > 0)?.time ?? "";
  const [slot, setSlot] = useState(firstOpen);
  const [guests, setGuests] = useState(2);
  const [booked, setBooked] = useState<null | { slot: string; guests: number }>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useIso(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const measure = () => {
      const lh = layer.offsetHeight;
      setH(lh);
      setFixed(lh <= window.innerHeight - 24);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(layer);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  // depth: the footer brightens and settles as the curtain lifts
  useEffect(() => {
    const wrap = wrapRef.current, layer = layerRef.current;
    if (!wrap || !layer || !fixed) { layer?.style.removeProperty("--fd-crf-p"); return; }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const r = wrap.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / r.height));
      layer.style.setProperty("--fd-crf-p", p.toFixed(3));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [fixed]);

  const open = slots.filter((s) => s.left > 0);
  const onSlotKey = (e: KeyboardEvent, i: number) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    for (let k = 1; k <= slots.length; k++) {
      const j = (i + dir * k + slots.length) % slots.length;
      if (slots[j].left > 0) { setSlot(slots[j].time); slotRefs.current[j]?.focus(); break; }
    }
  };
  const maxGuests = 8;
  const uid = useId();
  const book = () => {
    if (!slot) return;
    setBooked({ slot, guests });
    onBook?.(slot, guests);
  };

  return (
    <div
      ref={wrapRef}
      className={`fd-crf${className ? " " + className : ""}`}
      data-fixed={fixed ? "" : undefined}
      style={fixed && h ? { height: `${h}px` } : undefined}
    >
      <style>{css}</style>
      <footer ref={layerRef} className="fd-crf-layer">
        <div className="fd-crf-in">
          <div className="fd-crf-book">
            <div className="fd-crf-bl">
              <p className="fd-crf-k">Tonight, {open.length ? `${open.reduce((a, s) => a + s.left, 0)} tables left` : "fully booked"}</p>
              {booked ? (
                <p className="fd-crf-big fd-crf-done">
                  <em>Grazie.</em> {booked.guests} {booked.guests === 1 ? "guest" : "guests"}, {booked.slot}.
                </p>
              ) : (
                <button type="button" className="fd-crf-big fd-crf-cta" onClick={book} disabled={!slot}>
                  <em>Book</em> a table
                  <svg className="fd-crf-arrow" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M10 32h42M36 16l16 16-16 16" /></svg>
                </button>
              )}
              <p className="fd-crf-live" role="status" aria-live="polite">
                {booked ? (
                  <>We are holding it for 15 minutes and will text you to confirm. <button type="button" className="fd-crf-link" onClick={() => setBooked(null)}>Change</button></>
                ) : (
                  "Larger party, or a birthday? Call us and we will move the lemons."
                )}
              </p>
            </div>
            <div className="fd-crf-pick" aria-disabled={booked ? "true" : undefined}>
              <p className="fd-crf-k" id={`${uid}-t`}>Time</p>
              <div className="fd-crf-slots" role="radiogroup" aria-labelledby={`${uid}-t`}>
                {slots.map((s, i) => {
                  const on = slot === s.time;
                  const full = s.left === 0;
                  return (
                    <button
                      key={s.time}
                      ref={(el) => { slotRefs.current[i] = el; }}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-disabled={full || !!booked}
                      tabIndex={on || (!slot && i === 0) ? 0 : -1}
                      className="fd-crf-slot"
                      data-on={on ? "" : undefined}
                      data-full={full ? "" : undefined}
                      onClick={() => !full && !booked && setSlot(s.time)}
                      onKeyDown={(e) => !booked && onSlotKey(e, i)}
                    >
                      <span className="fd-crf-st">{s.time}</span>
                      <span className="fd-crf-sl">{full ? "Full" : s.left === 1 ? "Last table" : `${s.left} left`}</span>
                    </button>
                  );
                })}
              </div>
              <div className="fd-crf-guests">
                <p className="fd-crf-k" id={`${uid}-g`}>Guests</p>
                <div className="fd-crf-step" role="group" aria-labelledby={`${uid}-g`}>
                  <button type="button" aria-label="One guest fewer" disabled={guests <= 1 || !!booked} onClick={() => setGuests((g) => Math.max(1, g - 1))}>
                    <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 7h10" /></svg>
                  </button>
                  <output aria-live="polite" className="fd-crf-n">{guests}</output>
                  <button type="button" aria-label="One guest more" disabled={guests >= maxGuests || !!booked} onClick={() => setGuests((g) => Math.min(maxGuests, g + 1))}>
                    <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 7h10M7 2v10" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="fd-crf-info">
            <div className="fd-crf-col">
              <h3 className="fd-crf-k">Orari</h3>
              <dl className="fd-crf-hours">
                {hours.map((x) => (
                  <div key={x.label}>
                    <dt>{x.label}</dt>
                    <dd><span>{x.time}</span><small>{x.days}</small></dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="fd-crf-col">
              <h3 className="fd-crf-k">Find us</h3>
              <address className="fd-crf-addr">
                {address.map((l) => <span key={l}>{l}</span>)}
                <a className="fd-crf-a" href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a>
              </address>
              <p className="fd-crf-note">{note}</p>
            </div>
            <figure className="fd-crf-fig">
              <img src={photo.src} alt={photo.alt} width={480} height={360} loading="lazy" decoding="async" />
              <figcaption>The terrace. Six tables, walk-ins after 22:00.</figcaption>
            </figure>
          </div>

          <div className="fd-crf-base">
            <span className="fd-crf-word" aria-label={name}>{name}<i aria-hidden="true">.</i></span>
            <ul className="fd-crf-legal">
              {legal.map((l) => <li key={l}>{l}</li>)}
              <li><a className="fd-crf-a" href="#">Instagram</a></li>
              <li><a className="fd-crf-a" href="#">Allergens</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

const SERIF = `"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif`;
const SANS = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const css = `
:where(.fd-crf,.fd-crf *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;font-style:normal}
:where(.fd-crf,.fd-crf *)::before,:where(.fd-crf,.fd-crf *)::after{box-sizing:border-box}
:where(.fd-crf svg,.fd-crf img){display:block;flex-shrink:0}
:where(.fd-crf button){appearance:none;-webkit-appearance:none;cursor:pointer;text-align:inherit;border-radius:0}
.fd-crf{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-crf-bg:#2A1310;--fd-crf-fg:#F4EAD5;--fd-crf-mut:#C2A991;--fd-crf-line:rgba(244,234,213,.16);--fd-crf-accent:#EBC64B;
  position:relative;width:100%;clip-path:inset(0);
  font:400 15px/22px ${SANS};color:var(--fd-crf-fg);-webkit-font-smoothing:antialiased}
.fd-crf::after{content:"";position:absolute;inset:0 0 auto;height:56px;background:linear-gradient(rgba(0,0,0,.42),transparent);pointer-events:none;z-index:2}
.fd-crf-layer{display:block;width:100%;background:var(--fd-crf-bg);color:var(--fd-crf-fg)}
.fd-crf[data-fixed] .fd-crf-layer{position:fixed;left:0;right:0;bottom:0}
.fd-crf-in{max-width:1440px;margin:0 auto;padding:clamp(48px,6vw,80px) clamp(16px,4vw,56px) 24px;
  transform:translateY(calc((1 - var(--fd-crf-p,1)) * -48px)) scale(calc(.97 + var(--fd-crf-p,1) * .03));transform-origin:50% 100%;
  opacity:calc(.35 + var(--fd-crf-p,1) * .65)}
.fd-crf-k{display:block;font:600 11px/16px ${SANS};letter-spacing:.14em;text-transform:uppercase;color:var(--fd-crf-mut)}
.fd-crf-book{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:40px clamp(32px,5vw,80px);align-items:end;padding-bottom:clamp(36px,4vw,56px);border-bottom:1px solid var(--fd-crf-line)}
.fd-crf-big{display:flex;align-items:center;gap:.18em;margin-top:14px;font:400 clamp(3.5rem,9vw,8.5rem)/.92 ${SERIF};letter-spacing:-.035em;color:var(--fd-crf-fg)}
.fd-crf-big em{font-style:italic;color:var(--fd-crf-accent)}
.fd-crf-cta{outline:0;border-radius:6px;transition:color var(--fd-dur-2)}
.fd-crf-arrow{width:.62em;height:.62em;margin-left:.08em;transition:transform var(--fd-dur-3) var(--fd-spring)}
.fd-crf-cta:hover .fd-crf-arrow{transform:translateX(.12em)}
.fd-crf-cta:active{transform:scale(.985);transition:transform var(--fd-dur-1)}
.fd-crf-cta:focus-visible,.fd-crf-slot:focus-visible,.fd-crf-step button:focus-visible,.fd-crf-a:focus-visible,.fd-crf-link:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-crf-accent) 70%,transparent);outline-offset:2px}
.fd-crf-cta:disabled{opacity:.4;cursor:not-allowed}
.fd-crf-done{display:block;font-size:clamp(2.75rem,6.4vw,6rem);line-height:1;animation:fd-crf-in var(--fd-dur-4) var(--fd-ease-out)}
@keyframes fd-crf-in{from{opacity:0;transform:translateY(.25em)}}
.fd-crf-live{margin-top:18px;max-width:440px;font:400 15px/22px ${SANS};color:var(--fd-crf-mut)}
.fd-crf-link{font:600 15px/22px ${SANS};color:var(--fd-crf-accent);box-shadow:inset 0 -1px 0 currentColor;outline:0;border-radius:2px}
.fd-crf-pick{display:grid;gap:12px}
.fd-crf-pick[aria-disabled="true"]{opacity:.45;pointer-events:none}
.fd-crf-slots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.fd-crf-slot{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--fd-crf-line);color:var(--fd-crf-fg);outline:0;transition:background-color var(--fd-dur-1),box-shadow var(--fd-dur-2),transform var(--fd-dur-2) var(--fd-spring)}
.fd-crf-slot:hover:not([data-full]){box-shadow:inset 0 0 0 1px rgba(244,234,213,.4)}
.fd-crf-slot:active:not([data-full]){transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-crf-slot[data-on]{background:var(--fd-crf-accent);color:#2A1310;box-shadow:none}
.fd-crf-slot[data-full]{cursor:not-allowed;color:rgba(244,234,213,.38)}
.fd-crf-slot[data-full] .fd-crf-st{text-decoration:line-through;text-decoration-thickness:1px}
.fd-crf-st{display:block;font:500 17px/22px ${SANS};letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.fd-crf-sl{display:block;font:500 11px/14px ${SANS};opacity:.75}
.fd-crf-guests{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;padding-top:12px;border-top:1px solid var(--fd-crf-line)}
.fd-crf-step{display:flex;align-items:center;gap:4px}
.fd-crf-step button{display:grid;place-items:center;width:36px;height:36px;border-radius:9999px;box-shadow:inset 0 0 0 1px var(--fd-crf-line);color:var(--fd-crf-fg);outline:0;transition:transform var(--fd-dur-2) var(--fd-spring),box-shadow var(--fd-dur-1)}
.fd-crf-step button:hover:not(:disabled){box-shadow:inset 0 0 0 1px rgba(244,234,213,.45)}
.fd-crf-step button:active:not(:disabled){transform:scale(.92);transition-duration:var(--fd-dur-1)}
.fd-crf-step button:disabled{opacity:.3;cursor:not-allowed}
.fd-crf-n{display:block;min-width:40px;text-align:center;font:400 1.5rem/1 ${SERIF};font-variant-numeric:tabular-nums}
.fd-crf-info{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,.8fr);gap:32px clamp(24px,4vw,64px);padding:36px 0}
.fd-crf-col .fd-crf-k{margin-bottom:14px}
.fd-crf-hours{display:grid;gap:12px}
.fd-crf-hours div{display:grid;grid-template-columns:72px 1fr;gap:12px;align-items:baseline}
.fd-crf-hours dt{font:italic 400 19px/24px ${SERIF};color:var(--fd-crf-accent)}
.fd-crf-hours dd{display:flex;flex-direction:column;font-variant-numeric:tabular-nums}
.fd-crf-hours dd span{font:400 15px/22px ${SANS};color:var(--fd-crf-fg)}
.fd-crf-hours small{font:400 13px/18px ${SANS};color:var(--fd-crf-mut)}
.fd-crf-addr{display:flex;flex-direction:column;font:400 19px/26px ${SERIF};color:var(--fd-crf-fg)}
.fd-crf-addr .fd-crf-a{margin-top:6px;align-self:flex-start;font:400 15px/22px ${SANS};font-variant-numeric:tabular-nums}
.fd-crf-a{color:var(--fd-crf-fg);box-shadow:inset 0 -1px 0 rgba(244,234,213,.35);border-radius:1px;outline:0;transition:color var(--fd-dur-1),box-shadow var(--fd-dur-2)}
.fd-crf-a:hover{color:var(--fd-crf-accent);box-shadow:inset 0 -1px 0 var(--fd-crf-accent)}
.fd-crf-note{margin-top:12px;max-width:320px;font:400 13px/19px ${SANS};color:var(--fd-crf-mut)}
.fd-crf-fig{display:block;justify-self:end;width:100%;max-width:280px}
.fd-crf-fig img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:3px;filter:saturate(.9)}
.fd-crf-fig figcaption{margin-top:8px;font:italic 400 13px/18px ${SERIF};color:var(--fd-crf-mut)}
.fd-crf-base{display:flex;justify-content:space-between;align-items:flex-end;gap:16px 32px;flex-wrap:wrap;padding-top:20px;border-top:1px solid var(--fd-crf-line)}
.fd-crf-word{font:italic 400 32px/1 ${SERIF};letter-spacing:-.02em;color:var(--fd-crf-fg)}
.fd-crf-word i{color:var(--fd-crf-accent);font-style:normal}
.fd-crf-legal{display:flex;flex-wrap:wrap;gap:6px 20px;font:400 12px/16px ${SANS};color:var(--fd-crf-mut)}
.fd-crf-legal .fd-crf-a{color:var(--fd-crf-mut)}
@media (max-width:900px){
  .fd-crf-book{grid-template-columns:1fr;align-items:start}
  .fd-crf-info{grid-template-columns:1fr 1fr}
  .fd-crf-fig{grid-column:1/-1;justify-self:start;max-width:none;display:grid;grid-template-columns:120px 1fr;gap:14px;align-items:center}
  .fd-crf-fig figcaption{margin:0}
}
@media (max-width:560px){
  .fd-crf-info{grid-template-columns:1fr}
  .fd-crf-slots{grid-template-columns:repeat(2,minmax(0,1fr))}
  .fd-crf-big{font-size:3.25rem}
  .fd-crf-done{font-size:2.5rem}
}
@media (prefers-reduced-motion:reduce){
  .fd-crf-in{transform:none;opacity:1}
  .fd-crf *{transition-duration:1ms!important;animation:none!important}
}
@media (prefers-contrast:more){.fd-crf{--fd-crf-mut:#E6D3BC;--fd-crf-line:rgba(244,234,213,.55)}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const DOLCI = [
  { n: "Delizia al limone", d: "Sponge, limoncello, a cloud of lemon cream", p: "12" },
  { n: "Torta caprese", d: "Almond and dark chocolate, crème fraîche", p: "11" },
  { n: "Sorbetto del terrazzo", d: "Lemons picked that morning, three metres from your table", p: "8" },
  { n: "Formaggi", d: "Provolone del Monaco, honey from Agerola", p: "16" },
];

export function Demo() {
  return (
    <div className="fd-crfd">
      <style>{demoCss}</style>
      <main className="fd-crfd-page">
        <header className="fd-crfd-head">
          <span className="fd-crfd-num">IV</span>
          <h2>Dolci</h2>
          <p>The menu changes with the fishing boats. Last written on Sunday, 2 November.</p>
        </header>
        <ul className="fd-crfd-menu">
          {DOLCI.map((d) => (
            <li key={d.n}>
              <div><b>{d.n}</b><span>{d.d}</span></div>
              <i aria-hidden="true" />
              <em>{d.p}</em>
            </li>
          ))}
        </ul>
        <p className="fd-crfd-foot">Coperto 3. Tell us about allergies, the kitchen is small but listens.</p>
      </main>
      <CurtainRevealFooter />
    </div>
  );
}

const demoCss = `
:where(.fd-crfd,.fd-crfd *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;list-style:none;font-style:normal}
.fd-crfd{background:#2A1310;font:400 15px/22px ${SANS}}
.fd-crfd-page{padding:clamp(48px,7vw,104px) clamp(16px,4vw,56px) 72px;background:#F4EAD5;color:#2A1310;-webkit-font-smoothing:antialiased}
.fd-crfd-head{display:grid;grid-template-columns:auto 1fr;column-gap:24px;align-items:end;max-width:1080px;margin:0 auto}
.fd-crfd-num{grid-row:span 2;font:italic 400 20px/1 ${SERIF};color:#A4492C;align-self:start;padding-top:18px}
.fd-crfd-head h2{font:400 clamp(3.5rem,8vw,7rem)/.9 ${SERIF};letter-spacing:-.035em}
.fd-crfd-head p{margin-top:16px;max-width:420px;color:#6E5446}
.fd-crfd-menu{max-width:1080px;margin:40px auto 0;display:grid;grid-template-columns:1fr 1fr;gap:0 64px;border-top:1px solid rgba(42,19,16,.2)}
.fd-crfd-menu li{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:baseline;padding:20px 0;border-bottom:1px solid rgba(42,19,16,.12)}
.fd-crfd-menu b{display:block;font:400 22px/28px ${SERIF};letter-spacing:-.01em}
.fd-crfd-menu span{display:block;margin-top:2px;font-size:14px;line-height:20px;color:#6E5446}
.fd-crfd-menu i{display:block;height:1px;border-bottom:1px dotted rgba(42,19,16,.35);align-self:center;margin-top:8px}
.fd-crfd-menu em{font:400 22px/28px ${SERIF};font-variant-numeric:tabular-nums}
.fd-crfd-foot{max-width:1080px;margin:24px auto 0;font:italic 400 15px/22px ${SERIF};color:#6E5446}
@media (max-width:760px){.fd-crfd-menu{grid-template-columns:1fr}.fd-crfd-menu li{grid-template-columns:1fr auto}.fd-crfd-menu i{display:none}}
`;
