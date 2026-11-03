/**
 * MenuPricing — a coffee subscription priced like a printed restaurant menu:
 * roman-numeral sections, small-caps names, italic tasting notes, dotted
 * leaders running to three size columns. Pick a price and it gets circled in
 * pen; choose how often and how it's ground (a coarseness strip of particles
 * resizes to match) and the order slip on the right totals it.
 *
 * Props: sections ({ numeral, title, items[] }), sizes (column labels),
 * frequencies ({ id, label, note, discount, perMonth }), grinds ({ id, label,
 * level 0..6, whole? }), currencyLabel, house (name / place line).
 * Item: { id, name, origin, notes, prices[] } with one price per size.
 * CSS vars: --fd-mp-paper, --fd-mp-ink, --fd-mp-accent.
 *
 * Browser support: all evergreen browsers.
 * Accessibility: each price is a <button aria-pressed> labelled with item,
 * size and price; frequency and grind are native radio groups; the order slip
 * is a polite live region.
 * Reduced motion: the pen circle appears without drawing, particles snap.
 */
import { useId, useState } from "react";

export interface MenuItem {
  id: string;
  name: string;
  origin: string;
  notes: string;
  prices: number[];
}
export interface MenuSection {
  numeral: string;
  title: string;
  items: MenuItem[];
}
export interface Frequency {
  id: string;
  label: string;
  note: string;
  discount: number;
  perMonth: number;
}
export interface Grind {
  id: string;
  label: string;
  level: number;
  whole?: boolean;
}

export interface MenuPricingProps {
  sections?: MenuSection[];
  sizes?: string[];
  frequencies?: Frequency[];
  grinds?: Grind[];
  currencyLabel?: string;
  house?: { name: string; line: string; season: string };
  className?: string;
}

const SECTIONS: MenuSection[] = [
  {
    numeral: "I",
    title: "Filter, single origin",
    items: [
      { id: "huila", name: "Huila, La Esperanza", origin: "Colombia · washed · 1,850 m", notes: "Bergamot, black tea, raw honey", prices: [115, 210, 390] },
      { id: "guji", name: "Guji Hambela", origin: "Ethiopia · natural · 2,100 m", notes: "Blueberry, cacao nib, jasmine", prices: [125, 230, 430] },
      { id: "kirinyaga", name: "Kirinyaga AB", origin: "Kenya · washed · 1,700 m", notes: "Blackcurrant, grapefruit, tomato leaf", prices: [135, 250, 470] },
    ],
  },
  {
    numeral: "II",
    title: "Espresso",
    items: [
      { id: "house", name: "Nordhavn House", origin: "Brazil & Guatemala blend", notes: "Hazelnut, milk chocolate, demerara", prices: [99, 185, 340] },
      { id: "huye", name: "Huye Mountain", origin: "Rwanda · washed · seasonal", notes: "Red apple, caramel, a little cola", prices: [120, 220, 410] },
    ],
  },
  {
    numeral: "III",
    title: "Decaf, done properly",
    items: [{ id: "decaf", name: "Sugarcane Decaf", origin: "Colombia · EA process", notes: "Toffee, orange peel, very soft", prices: [110, 200, 370] }],
  },
];

const SIZES = ["250 g", "500 g", "1 kg"];

const FREQS: Frequency[] = [
  { id: "week", label: "Every week", note: "10% off", discount: 0.1, perMonth: 52 / 12 },
  { id: "fortnight", label: "Every two weeks", note: "5% off", discount: 0.05, perMonth: 26 / 12 },
  { id: "month", label: "Every month", note: "menu price", discount: 0, perMonth: 1 },
];

const GRINDS: Grind[] = [
  { id: "whole", label: "Whole bean", level: 6, whole: true },
  { id: "espresso", label: "Espresso", level: 0 },
  { id: "moka", label: "Moka pot", level: 1 },
  { id: "aeropress", label: "AeroPress", level: 2 },
  { id: "v60", label: "V60, pour-over", level: 3 },
  { id: "chemex", label: "Chemex", level: 4 },
  { id: "press", label: "French press", level: 5 },
];

function Particles({ grind }: { grind: Grind }) {
  const n = 14;
  return (
    <span className="fd-mp-parts" aria-hidden="true" data-whole={grind.whole ? "" : undefined}>
      {Array.from({ length: n }, (_, i) => {
        const jitter = ((i * 37) % 7) / 7;
        const size = grind.whole ? 12 : 2 + grind.level * 1.3 + jitter * (1 + grind.level * 0.5);
        return <i key={i} style={{ width: size, height: grind.whole ? size * 0.72 : size, transitionDelay: `${i * 14}ms` }} />;
      })}
    </span>
  );
}

export function MenuPricing({
  sections = SECTIONS,
  sizes = SIZES,
  frequencies = FREQS,
  grinds = GRINDS,
  currencyLabel = "Danish kroner, delivery included across Denmark",
  house = { name: "Kaffe Halden", line: "Roasted Tuesdays in Nordhavn, posted Wednesday", season: "Subscription menu · Autumn 2026" },
  className,
}: MenuPricingProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [pick, setPick] = useState<{ item: string; size: number }>({ item: "huila", size: 1 });
  const [freq, setFreq] = useState(frequencies[1]?.id ?? frequencies[0].id);
  const [grind, setGrind] = useState(grinds[4]?.id ?? grinds[0].id);
  const items = sections.flatMap((s) => s.items);
  const item = items.find((i) => i.id === pick.item) ?? items[0];
  const f = frequencies.find((x) => x.id === freq) ?? frequencies[0];
  const g = grinds.find((x) => x.id === grind) ?? grinds[0];
  const base = item.prices[pick.size];
  const per = Math.round(base * (1 - f.discount));
  const month = Math.round(per * f.perMonth);

  return (
    <section className={`fd-mp${className ? " " + className : ""}`} aria-label={`${house.name} subscription menu`}>
      <style>{css}</style>
      <div className="fd-mp-paper">
        <header className="fd-mp-head">
          <p className="fd-mp-season">{house.season}</p>
          <h2 className="fd-mp-name">{house.name}</h2>
          <svg className="fd-mp-orn" width="120" height="14" viewBox="0 0 120 14" aria-hidden="true">
            <path d="M0 7h48M72 7h48" stroke="currentColor" strokeWidth=".8" />
            <path d="M60 1.5c3 3 3 8 0 11-3-3-3-8 0-11zM54 7c2-1.6 4-1.6 6 0-2 1.6-4 1.6-6 0zM66 7c-2-1.6-4-1.6-6 0 2 1.6 4 1.6 6 0z" fill="currentColor" />
          </svg>
          <p className="fd-mp-line">{house.line}</p>
        </header>

        <div className="fd-mp-body">
          <div className="fd-mp-menu">
            <div className="fd-mp-sizes" aria-hidden="true">
              {sizes.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            {sections.map((sec) => (
              <div key={sec.numeral} className="fd-mp-sec">
                <h3 className="fd-mp-sec-t">
                  <span>{sec.numeral}.</span> {sec.title}
                </h3>
                <ul>
                  {sec.items.map((it) => (
                    <li key={it.id} className="fd-mp-item" data-on={it.id === item.id ? "" : undefined}>
                      <div className="fd-mp-row">
                        <span className="fd-mp-iname">{it.name}</span>
                        <span className="fd-mp-dots" aria-hidden="true" />
                        <span className="fd-mp-prices">
                          {it.prices.map((p, si) => {
                            const on = it.id === item.id && si === pick.size;
                            return (
                              <button
                                key={si}
                                type="button"
                                className="fd-mp-p"
                                aria-pressed={on}
                                aria-label={`${it.name}, ${sizes[si]}, ${p} kroner`}
                                onClick={() => setPick({ item: it.id, size: si })}
                              >
                                {p}
                                {on && (
                                  <svg className="fd-mp-circle" viewBox="0 0 60 34" preserveAspectRatio="none" aria-hidden="true">
                                    <path pathLength={1} d="M41 4C30 1 9 3 4 13c-4 9 10 18 28 17s26-8 24-17C54 5 40 2 26 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                        </span>
                      </div>
                      <p className="fd-mp-notes">
                        <em>{it.notes}.</em> <span>{it.origin}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="fd-mp-cur">Prices per bag in {currencyLabel}.</p>
          </div>

          <aside className="fd-mp-side" aria-label="Your subscription">
            <fieldset className="fd-mp-fs">
              <legend>How often</legend>
              {frequencies.map((x) => (
                <label key={x.id} className="fd-mp-opt">
                  <input type="radio" name={`${uid}-f`} value={x.id} checked={freq === x.id} onChange={() => setFreq(x.id)} />
                  <span className="fd-mp-radio" aria-hidden="true" />
                  <span className="fd-mp-ol">{x.label}</span>
                  <span className="fd-mp-on">{x.note}</span>
                </label>
              ))}
            </fieldset>

            <fieldset className="fd-mp-fs">
              <legend>Ground for</legend>
              <Particles grind={g} />
              <div className="fd-mp-grinds">
                {grinds.map((x) => (
                  <label key={x.id} className="fd-mp-chip">
                    <input type="radio" name={`${uid}-g`} value={x.id} checked={grind === x.id} onChange={() => setGrind(x.id)} />
                    <span>{x.label}</span>
                  </label>
                ))}
              </div>
              <p className="fd-mp-scale" aria-hidden="true">
                <span>fine</span>
                <span>coarse</span>
              </p>
            </fieldset>

            <div className="fd-mp-slip" aria-live="polite">
              <p className="fd-mp-slip-h">Your order</p>
              <p className="fd-mp-slip-item">
                {item.name}, {sizes[pick.size]}
              </p>
              <p className="fd-mp-slip-meta">
                {f.label.toLowerCase()}, {g.whole ? "whole bean" : `ground for ${g.label.toLowerCase()}`}
              </p>
              <div className="fd-mp-slip-row">
                <span>Per delivery</span>
                <span className="fd-mp-dots" aria-hidden="true" />
                <b>
                  {f.discount > 0 && <s>{base}</s>} kr {per}
                </b>
              </div>
              <div className="fd-mp-slip-row fd-mp-slip-sub">
                <span>About per month</span>
                <span className="fd-mp-dots" aria-hidden="true" />
                <span>kr {month}</span>
              </div>
              <a className="fd-mp-cta" href="#subscribe">
                Subscribe, pause any time
              </a>
              <p className="fd-mp-fine">Skip or swap a coffee until Sunday 23:59 before roast day.</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

const css = `
:where(.fd-mp,.fd-mp *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;min-width:0}
:where(.fd-mp,.fd-mp *)::before,:where(.fd-mp,.fd-mp *)::after{box-sizing:border-box}
:where(.fd-mp svg){display:block;flex-shrink:0}
:where(.fd-mp button){appearance:none;-webkit-appearance:none;cursor:pointer;border-radius:0}
.fd-mp{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-mp-paper:#F5EEDF;--fd-mp-ink:#1F1B15;--fd-mp-accent:#2F5240;
  --mut:#6E6556;--line:rgba(31,27,21,.22);
  --serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
  display:block;width:100%;background:#E9E0CC;color:var(--fd-mp-ink);font:400 16px/24px var(--serif);-webkit-font-smoothing:antialiased;
  padding:clamp(24px,5vw,72px) clamp(12px,4vw,56px)}
.fd-mp-paper{max-width:1120px;margin:0 auto;background:var(--fd-mp-paper);padding:clamp(28px,5vw,64px) clamp(20px,5vw,72px);box-shadow:0 1px 2px rgba(60,45,20,.12),0 24px 48px -28px rgba(60,45,20,.35);outline:1px solid var(--line);outline-offset:-10px;
  background-image:radial-gradient(rgba(31,27,21,.035) 1px,transparent 1px);background-size:5px 5px}
.fd-mp-head{text-align:center}
.fd-mp-season{font:400 12px/16px var(--serif);letter-spacing:.24em;text-transform:uppercase;color:var(--mut)}
.fd-mp-name{margin-top:14px;font:400 clamp(2.5rem,6vw,4.5rem)/1 var(--serif);letter-spacing:.02em;font-variant:small-caps}
.fd-mp-orn{margin:18px auto 0;color:var(--fd-mp-ink)}
.fd-mp-line{margin-top:12px;font:italic 400 15px/22px var(--serif);color:var(--mut)}
.fd-mp-body{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);gap:clamp(32px,5vw,72px);margin-top:clamp(36px,5vw,56px)}
.fd-mp-sizes{display:flex;justify-content:flex-end;gap:0;padding-bottom:6px;border-bottom:1px solid var(--line)}
.fd-mp-sizes span{width:58px;text-align:center;font:400 11px/16px var(--serif);letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
.fd-mp-sec{margin-top:28px}
.fd-mp-sec-t{font:400 13px/18px var(--serif);letter-spacing:.22em;text-transform:uppercase;color:var(--fd-mp-accent)}
.fd-mp-sec-t span{font-style:italic;letter-spacing:.04em;margin-right:4px}
.fd-mp-item{padding:14px 0 4px;border-bottom:1px dotted var(--line)}
.fd-mp-row{display:flex;align-items:baseline;gap:8px}
.fd-mp-iname{font:400 1.25rem/28px var(--serif);font-variant:small-caps;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto}
.fd-mp-dots{flex:1 1 24px;min-width:16px;height:0;border-bottom:2px dotted color-mix(in srgb,var(--fd-mp-ink) 45%,transparent);transform:translateY(-5px)}
.fd-mp-prices{display:flex;flex:none}
.fd-mp-p{position:relative;width:58px;height:34px;font:400 1.125rem/34px var(--serif);font-variant-numeric:oldstyle-nums proportional-nums;color:var(--fd-mp-ink);text-align:center;border-radius:9999px;transition:color var(--fd-dur-1),background-color var(--fd-dur-1)}
.fd-mp-p:hover{background:rgba(31,27,21,.06)}
.fd-mp-p[aria-pressed="true"]{color:var(--fd-mp-accent);font-weight:600}
.fd-mp-p:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-mp-accent) 70%,transparent);outline-offset:0}
.fd-mp-circle{position:absolute;inset:-1px -2px;width:calc(100% + 4px);height:calc(100% + 2px);color:var(--fd-mp-accent);pointer-events:none}
.fd-mp-circle path{stroke-dasharray:1.2;stroke-dashoffset:1.2;animation:fd-mp-draw var(--fd-dur-4) var(--fd-ease-out) forwards}
@keyframes fd-mp-draw{to{stroke-dashoffset:0}}
.fd-mp-notes{padding-bottom:10px;font:400 14px/20px var(--serif);color:var(--mut)}
.fd-mp-notes em{font-style:italic;color:var(--fd-mp-ink)}
.fd-mp-notes span{white-space:nowrap}
.fd-mp-cur{margin-top:20px;font:italic 400 13px/18px var(--serif);color:var(--mut)}

.fd-mp-side{display:flex;flex-direction:column;gap:28px;padding-left:clamp(0px,3vw,40px);border-left:1px solid var(--line)}
.fd-mp-fs{min-width:0}
.fd-mp-fs legend{padding:0 0 10px;font:400 12px/16px var(--serif);letter-spacing:.22em;text-transform:uppercase;color:var(--fd-mp-accent)}
.fd-mp-opt{position:relative;display:flex;align-items:baseline;gap:10px;padding:8px 0;cursor:pointer;border-bottom:1px dotted var(--line)}
.fd-mp-opt input,.fd-mp-chip input{position:absolute;opacity:0;width:1px;height:1px;margin:0}
.fd-mp-radio{position:relative;top:2px;width:14px;height:14px;flex:none;border-radius:50%;box-shadow:inset 0 0 0 1px var(--fd-mp-ink)}
.fd-mp-radio::after{content:"";position:absolute;inset:3px;border-radius:50%;background:var(--fd-mp-ink);transform:scale(0);transition:transform var(--fd-dur-2) var(--fd-spring)}
.fd-mp-opt input:checked+.fd-mp-radio::after{transform:scale(1)}
.fd-mp-opt input:focus-visible+.fd-mp-radio{outline:2px solid color-mix(in srgb,var(--fd-mp-accent) 70%,transparent);outline-offset:2px}
.fd-mp-ol{flex:1;font:400 17px/24px var(--serif)}
.fd-mp-on{font:italic 400 14px/20px var(--serif);color:var(--mut)}
.fd-mp-parts{display:flex;align-items:center;justify-content:space-between;height:28px;padding:0 2px;margin-bottom:12px}
.fd-mp-parts i{display:block;border-radius:40%;background:#5B3A22;transition:width var(--fd-dur-3) var(--fd-spring),height var(--fd-dur-3) var(--fd-spring),border-radius var(--fd-dur-3)}
.fd-mp-parts[data-whole] i{border-radius:50%;background:linear-gradient(90deg,#6B4429 44%,#1A0F07 47% 53%,#6B4429 56%)}
.fd-mp-grinds{display:flex;flex-wrap:wrap;gap:6px}
.fd-mp-chip{position:relative;cursor:pointer}
.fd-mp-chip span{display:block;padding:5px 11px;border-radius:9999px;font:400 14px/20px var(--serif);box-shadow:inset 0 0 0 1px var(--line);transition:background-color var(--fd-dur-1),color var(--fd-dur-1),box-shadow var(--fd-dur-1)}
.fd-mp-chip:hover span{box-shadow:inset 0 0 0 1px var(--fd-mp-ink)}
.fd-mp-chip input:checked+span{background:var(--fd-mp-ink);color:var(--fd-mp-paper);box-shadow:none}
.fd-mp-chip input:focus-visible+span{outline:2px solid color-mix(in srgb,var(--fd-mp-accent) 70%,transparent);outline-offset:2px}
.fd-mp-scale{display:flex;justify-content:space-between;margin-top:10px;font:italic 400 12px/16px var(--serif);color:var(--mut)}
.fd-mp-slip{padding:20px;background:#FBF7EE;box-shadow:inset 0 0 0 1px var(--line)}
.fd-mp-slip-h{font:400 11px/16px var(--serif);letter-spacing:.24em;text-transform:uppercase;color:var(--mut)}
.fd-mp-slip-item{margin-top:8px;font:400 1.375rem/28px var(--serif);font-variant:small-caps;letter-spacing:.03em}
.fd-mp-slip-meta{font:italic 400 15px/22px var(--serif);color:var(--mut)}
.fd-mp-slip-row{display:flex;align-items:baseline;gap:8px;margin-top:16px;font:400 16px/24px var(--serif)}
.fd-mp-slip-row b{font-weight:600;font-size:1.25rem;font-variant-numeric:lining-nums}
.fd-mp-slip-row s{text-decoration:line-through;margin-right:6px;font-weight:400;font-size:.875rem;color:var(--mut)}
.fd-mp-slip-sub{margin-top:4px;color:var(--mut);font-size:14px}
.fd-mp-cta{display:flex;align-items:center;justify-content:center;margin-top:20px;height:48px;background:var(--fd-mp-accent);color:#F5EEDF;font:400 14px/48px var(--serif);letter-spacing:.14em;text-transform:uppercase;transition:background-color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-mp-cta:hover{background:var(--fd-mp-ink)}
.fd-mp-cta:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-mp-cta:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-mp-accent) 70%,transparent);outline-offset:2px}
.fd-mp-fine{margin-top:12px;font:italic 400 13px/18px var(--serif);color:var(--mut)}
@media (max-width:880px){
  .fd-mp-body{grid-template-columns:1fr}
  .fd-mp-side{padding-left:0;border-left:0;padding-top:28px;border-top:1px solid var(--line)}
}
@media (max-width:480px){
  .fd-mp-sizes span,.fd-mp-p{width:44px}
  .fd-mp-p{font-size:1rem}
  .fd-mp-iname{font-size:1.0625rem;white-space:normal}
  .fd-mp-dots{display:none}
  .fd-mp-row{justify-content:space-between}
  .fd-mp-slip-row .fd-mp-dots{display:block}
  .fd-mp-notes span{white-space:normal}
}
@media (prefers-reduced-motion:reduce){.fd-mp *{transition-duration:1ms!important;transition-delay:0ms!important}.fd-mp-circle path{animation:none;stroke-dashoffset:0}}
@media (prefers-contrast:more){.fd-mp{--line:var(--fd-mp-ink)}}
`;

export function Demo() {
  return <MenuPricing />;
}
