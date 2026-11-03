/**
 * RetailFooter — a fashion e-commerce footer for a knitwear label. A row of
 * service promises (the free-shipping threshold re-prices itself when you
 * change country), sitemap columns that become accordions on phones, a
 * country and currency picker, payment methods as typographic badges, and a
 * large editorial sign-off line.
 *
 * Props: brand, promises, columns, countries ({ code, name, currency, rate
 * from the base currency, step for rounding }), country / defaultCountry /
 * onCountryChange (controlled or not), freeShippingFrom (base currency),
 * payments, signoff ([before, emphasis, after]), legal.
 * Helper export: priceIn(amount, country) formats a base-currency amount.
 * CSS vars: --fd-rtf-bg, --fd-rtf-fg, --fd-rtf-accent.
 *
 * Browser support: all evergreen browsers. Accordion height animates with
 * grid-template-rows (Chrome 107+, Safari 16+, Firefox 66+), older browsers snap.
 * Accessibility: on narrow screens each column title is a button with
 * aria-expanded/aria-controls; on wide screens it is a plain heading. The
 * country picker is a button + listbox (arrow keys, Home/End, Enter, Esc,
 * type-ahead not included). Reduced motion removes the number roll.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export interface RtfCountry { code: string; name: string; currency: string; rate: number; step: number; locale: string }
export interface RtfColumn { title: string; links: { label: string; href: string }[] }
export interface RtfPromise { icon: "returns" | "repair" | "ship" | "wool"; title: string; text: string }

export interface RetailFooterProps {
  brand?: string;
  promises?: RtfPromise[];
  columns?: RtfColumn[];
  countries?: RtfCountry[];
  country?: string;
  defaultCountry?: string;
  onCountryChange?: (code: string) => void;
  freeShippingFrom?: number;
  payments?: string[];
  signoff?: [string, string, string];
  legal?: string[];
  className?: string;
}

export const COUNTRIES: RtfCountry[] = [
  { code: "NO", name: "Norge", currency: "NOK", rate: 1, step: 10, locale: "nb-NO" },
  { code: "SE", name: "Sverige", currency: "SEK", rate: 1.02, step: 10, locale: "sv-SE" },
  { code: "DK", name: "Danmark", currency: "DKK", rate: 0.65, step: 5, locale: "da-DK" },
  { code: "DE", name: "Deutschland", currency: "EUR", rate: 0.087, step: 5, locale: "de-DE" },
  { code: "GB", name: "United Kingdom", currency: "GBP", rate: 0.074, step: 5, locale: "en-GB" },
  { code: "US", name: "United States", currency: "USD", rate: 0.094, step: 5, locale: "en-US" },
  { code: "JP", name: "日本", currency: "JPY", rate: 14.2, step: 100, locale: "ja-JP" },
];

export function priceIn(amount: number, c: RtfCountry) {
  const v = Math.round((amount * c.rate) / c.step) * c.step;
  return new Intl.NumberFormat(c.locale, { style: "currency", currency: c.currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(v);
}
const symbolOf = (c: RtfCountry) =>
  new Intl.NumberFormat(c.locale, { style: "currency", currency: c.currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? c.currency;

const DEFAULT_PROMISES: RtfPromise[] = [
  { icon: "ship", title: "Free shipping from {free}", text: "Carbon-neutral, 2 to 4 days in Europe." },
  { icon: "returns", title: "Free returns, 30 days", text: "Unworn, tags on. We send the label." },
  { icon: "repair", title: "Repairs for life", text: "Moth hole, worn elbow: we darn it, free." },
  { icon: "wool", title: "Knitted in Ålesund", text: "Norwegian Spælsau wool, traceable to the farm." },
];

const DEFAULT_COLUMNS: RtfColumn[] = [
  { title: "Shop", links: [{ label: "Women", href: "#" }, { label: "Men", href: "#" }, { label: "Sweaters", href: "#" }, { label: "Scarves and hats", href: "#" }, { label: "Blankets", href: "#" }, { label: "Gift cards", href: "#" }] },
  { title: "Help", links: [{ label: "Order status", href: "#" }, { label: "Returns and exchanges", href: "#" }, { label: "Size guide", href: "#" }, { label: "Caring for wool", href: "#" }, { label: "Contact us", href: "#" }] },
  { title: "Repairs", links: [{ label: "Book a repair", href: "#" }, { label: "Darning kits", href: "#" }, { label: "The repair desk", href: "#" }, { label: "Worn again, second hand", href: "#" }] },
  { title: "Løvstad", links: [{ label: "The mill", href: "#" }, { label: "Our farmers", href: "#" }, { label: "Journal", href: "#" }, { label: "Stores in Bergen and Oslo", href: "#" }, { label: "Careers", href: "#" }] },
];

const DEFAULT_PAYMENTS = ["Visa", "Mastercard", "Amex", "Klarna", "Vipps", "Apple Pay", "PayPal"];

const ICON: Record<RtfPromise["icon"], ReactNode> = {
  ship: <path d="M3 8h11v9H3zM14 11h4l3 3v3h-7M7 19.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />,
  returns: <path d="M9 7L5 11l4 4M5 11h10a4 4 0 010 8h-3" />,
  repair: <path d="M16.5 3.5l4 4-11 11H5.5v-4zM13.5 6.5l4 4M4 21h16" />,
  wool: <path d="M12 20a8 8 0 100-16 8 8 0 000 16zM6 9c4-1 9 1 12 5M5 13c4 0 8 2 10 6M9 4.8c3 1.5 6 5 7 9" />,
};

function useWide(q: string) {
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setWide(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return wide;
}

export function RetailFooter({
  brand = "Løvstad",
  promises = DEFAULT_PROMISES,
  columns = DEFAULT_COLUMNS,
  countries = COUNTRIES,
  country,
  defaultCountry = "NO",
  onCountryChange,
  freeShippingFrom = 1500,
  payments = DEFAULT_PAYMENTS,
  signoff = ["Knitted slowly, ", "worn for thirty winters", "."],
  legal = ["© 2026 Løvstad Strikk AS", "Org. nr. 921 448 302"],
  className,
}: RetailFooterProps) {
  const uid = useId();
  const [inner, setInner] = useState(defaultCountry);
  const code = country ?? inner;
  const cur = countries.find((c) => c.code === code) ?? countries[0];
  const wide = useWide("(min-width: 768px)");
  const [openCol, setOpenCol] = useState<Record<number, boolean>>({});
  const [menu, setMenu] = useState(false);
  const [active, setActive] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const choose = (c: string) => {
    if (country === undefined) setInner(c);
    onCountryChange?.(c);
    setMenu(false);
    btnRef.current?.focus();
  };

  useEffect(() => {
    if (!menu) return;
    setActive(Math.max(0, countries.findIndex((c) => c.code === code)));
    requestAnimationFrame(() => listRef.current?.focus());
    const out = (e: PointerEvent) => { if (!boxRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("pointerdown", out);
    return () => document.removeEventListener("pointerdown", out);
  }, [menu]); // eslint-disable-line react-hooks/exhaustive-deps

  const onListKey = (e: KeyboardEvent) => {
    const n = countries.length;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % n); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + n) % n); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(n - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(countries[active].code); }
    else if (e.key === "Escape" || e.key === "Tab") { setMenu(false); if (e.key === "Escape") btnRef.current?.focus(); }
  };

  const free = priceIn(freeShippingFrom, cur);

  return (
    <footer className={`fd-rtf${className ? " " + className : ""}`}>
      <style>{css}</style>
      <ul className="fd-rtf-promises" aria-label="Our promises">
        {promises.map((p, i) => {
          const parts = p.title.split("{free}");
          return (
            <li key={p.icon + i}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[p.icon]}</svg>
              <div>
                <p className="fd-rtf-pt">
                  {parts[0]}
                  {parts.length > 1 && <span className="fd-rtf-roll" key={cur.code}>{free}</span>}
                  {parts[1]}
                </p>
                <p className="fd-rtf-px">{p.text}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="fd-rtf-main">
        <div className="fd-rtf-brand">
          <p className="fd-rtf-word">{brand}</p>
          <p className="fd-rtf-since">Strikkeri, Ålesund. Since 1931.</p>
          <div className="fd-rtf-ctry" ref={boxRef}>
            <p className="fd-rtf-lab" id={`${uid}-cl`}>Shipping to</p>
            <button
              ref={btnRef}
              type="button"
              className="fd-rtf-cbtn"
              aria-haspopup="listbox"
              aria-expanded={menu}
              aria-labelledby={`${uid}-cl ${uid}-cv`}
              onClick={() => setMenu((m) => !m)}
              onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setMenu(true); } }}
            >
              <span id={`${uid}-cv`}><b>{cur.name}</b><span className="fd-rtf-cur">{cur.currency} {symbolOf(cur)}</span></span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M2.5 4L5 6.5 7.5 4" /></svg>
            </button>
            {menu && (
              <ul
                ref={listRef}
                className="fd-rtf-list"
                role="listbox"
                tabIndex={-1}
                aria-labelledby={`${uid}-cl`}
                aria-activedescendant={`${uid}-o${active}`}
                onKeyDown={onListKey}
              >
                {countries.map((c, i) => (
                  <li
                    key={c.code}
                    id={`${uid}-o${i}`}
                    role="option"
                    aria-selected={c.code === cur.code}
                    data-active={i === active ? "" : undefined}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => choose(c.code)}
                  >
                    <span>{c.name}</span>
                    <span className="fd-rtf-cur">{c.currency}</span>
                    {c.code === cur.code && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3L9.5 3.8" /></svg>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <nav className="fd-rtf-cols" aria-label="Footer">
          {columns.map((c, i) => {
            const isOpen = !!openCol[i];
            const pid = `${uid}-p${i}`;
            return (
              <div className="fd-rtf-col" key={c.title} data-open={isOpen ? "" : undefined}>
                {wide ? (
                  <h3 className="fd-rtf-ch">{c.title}</h3>
                ) : (
                  <h3 className="fd-rtf-chw">
                    <button type="button" className="fd-rtf-ch fd-rtf-tog" aria-expanded={isOpen} aria-controls={pid} onClick={() => setOpenCol((o) => ({ ...o, [i]: !o[i] }))}>
                      {c.title}
                      <span className="fd-rtf-pm" aria-hidden="true"><i /><i /></span>
                    </button>
                  </h3>
                )}
                <div className="fd-rtf-panel" id={pid}>
                  <ul>
                    {c.links.map((l) => (
                      <li key={l.label}><a className="fd-rtf-a" href={l.href} tabIndex={wide === false && !isOpen ? -1 : undefined}>{l.label}</a></li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      <p className="fd-rtf-sign">
        {signoff[0]}<em>{signoff[1]}</em>{signoff[2]}
      </p>

      <div className="fd-rtf-base">
        <ul className="fd-rtf-pay" aria-label="Payment methods">
          {payments.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <ul className="fd-rtf-legal">
          {legal.map((l) => <li key={l}>{l}</li>)}
          <li><a className="fd-rtf-a" href="#">Privacy</a></li>
          <li><a className="fd-rtf-a" href="#">Terms of sale</a></li>
          <li><a className="fd-rtf-a" href="#">Accessibility</a></li>
        </ul>
      </div>
    </footer>
  );
}

const SERIF = `"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif`;
const SANS = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const css = `
:where(.fd-rtf,.fd-rtf *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;font-style:normal}
:where(.fd-rtf,.fd-rtf *)::before,:where(.fd-rtf,.fd-rtf *)::after{box-sizing:border-box}
:where(.fd-rtf svg){display:block;flex-shrink:0}
:where(.fd-rtf button){appearance:none;-webkit-appearance:none;border-radius:0;outline:0;cursor:pointer;text-align:inherit}
.fd-rtf{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-rtf-bg:#ECE5D8;--fd-rtf-fg:#231B15;--fd-rtf-mut:#6E6257;--fd-rtf-line:rgba(35,27,21,.16);--fd-rtf-accent:#9C3D1E;--fd-rtf-card:#F6F1E8;
  display:block;width:100%;background:var(--fd-rtf-bg);color:var(--fd-rtf-fg);font:400 14px/20px ${SANS};letter-spacing:0;-webkit-font-smoothing:antialiased;overflow:hidden}
.fd-rtf-promises{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid var(--fd-rtf-line)}
.fd-rtf-promises li{display:flex;gap:14px;align-items:flex-start;padding:24px clamp(16px,2.4vw,32px);border-left:1px solid var(--fd-rtf-line)}
.fd-rtf-promises li:first-child{border-left:0}
.fd-rtf-promises svg{color:var(--fd-rtf-accent);margin-top:-1px}
.fd-rtf-pt{font:500 14px/20px ${SANS};color:var(--fd-rtf-fg)}
.fd-rtf-px{margin-top:2px;font:400 13px/18px ${SANS};color:var(--fd-rtf-mut)}
.fd-rtf-roll{display:inline-block;font-variant-numeric:tabular-nums;animation:fd-rtf-roll var(--fd-dur-3) var(--fd-ease-out)}
@keyframes fd-rtf-roll{from{opacity:0;transform:translateY(60%);filter:blur(2px)}}
.fd-rtf-main{display:grid;grid-template-columns:minmax(220px,1fr) minmax(0,3fr);gap:40px clamp(32px,5vw,80px);padding:56px clamp(16px,3.4vw,48px) 40px}
.fd-rtf-word{font:400 40px/1 ${SERIF};letter-spacing:-.02em}
.fd-rtf-since{margin-top:8px;font:italic 400 15px/22px ${SERIF};color:var(--fd-rtf-mut)}
.fd-rtf-ctry{position:relative;margin-top:32px;max-width:260px}
.fd-rtf-lab{font:500 11px/16px ${SANS};letter-spacing:.12em;text-transform:uppercase;color:var(--fd-rtf-mut)}
.fd-rtf-cbtn{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;height:44px;margin-top:8px;padding:0 14px;border-radius:2px;box-shadow:inset 0 0 0 1px rgba(35,27,21,.3);color:var(--fd-rtf-fg);font:400 14px/20px ${SANS};transition:box-shadow var(--fd-dur-1)}
.fd-rtf-cbtn:hover{box-shadow:inset 0 0 0 1px var(--fd-rtf-fg)}
.fd-rtf-cbtn>span{display:flex;gap:10px;align-items:baseline;min-width:0}
.fd-rtf-cbtn b{font-weight:500}
.fd-rtf-cbtn svg{transition:transform var(--fd-dur-2) var(--fd-ease-out)}
.fd-rtf-cbtn[aria-expanded="true"] svg{transform:rotate(180deg)}
.fd-rtf-cur{font:400 12px/16px ${SANS};letter-spacing:.04em;color:var(--fd-rtf-mut)}
.fd-rtf-list{position:absolute;left:0;right:0;bottom:calc(100% - 16px);z-index:10;padding:6px;background:var(--fd-rtf-card);box-shadow:0 0 0 1px var(--fd-rtf-line),0 20px 40px -16px rgba(35,27,21,.3);border-radius:2px;outline:0;animation:fd-rtf-pop var(--fd-dur-2) var(--fd-ease-out);transform-origin:50% 100%}
@keyframes fd-rtf-pop{from{opacity:0;transform:translateY(6px)}}
.fd-rtf-list li{display:grid;grid-template-columns:1fr auto 12px;gap:10px;align-items:center;height:36px;padding:0 10px;cursor:pointer;font:400 14px/20px ${SANS};border-radius:1px}
.fd-rtf-list li[data-active]{background:rgba(35,27,21,.07)}
.fd-rtf-list li[aria-selected="true"]{font-weight:500}
.fd-rtf-list:focus-visible{box-shadow:0 0 0 2px color-mix(in srgb,var(--fd-rtf-accent) 70%,transparent),0 20px 40px -16px rgba(35,27,21,.3)}
.fd-rtf-cols{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:32px 24px}
.fd-rtf-ch{display:block;font:500 11px/16px ${SANS};letter-spacing:.12em;text-transform:uppercase;color:var(--fd-rtf-mut)}
.fd-rtf-chw{display:block}
.fd-rtf-tog{display:flex;align-items:center;justify-content:space-between;width:100%;cursor:default}
.fd-rtf-pm{display:none}
.fd-rtf-panel{display:grid;grid-template-rows:1fr}
.fd-rtf-panel>ul{min-height:0;overflow:hidden;display:grid;gap:9px;padding-top:16px}
.fd-rtf-a{color:var(--fd-rtf-fg);border-radius:1px;outline:0;background:linear-gradient(currentColor,currentColor) 0 100%/0 1px no-repeat;transition:background-size var(--fd-dur-3) var(--fd-ease-out),color var(--fd-dur-1)}
.fd-rtf-a:hover{background-size:100% 1px;color:var(--fd-rtf-accent)}
.fd-rtf-a:focus-visible,.fd-rtf-cbtn:focus-visible,.fd-rtf-tog:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-rtf-accent) 70%,transparent);outline-offset:2px}
.fd-rtf-sign{padding:8px clamp(16px,3.4vw,48px) 40px;font:400 clamp(2.5rem,7.6vw,7.5rem)/.98 ${SERIF};letter-spacing:-.035em;color:var(--fd-rtf-fg);text-wrap:balance}
.fd-rtf-sign em{font-style:italic;color:var(--fd-rtf-accent)}
.fd-rtf-base{display:flex;justify-content:space-between;align-items:center;gap:16px 32px;flex-wrap:wrap;margin:0 clamp(16px,3.4vw,48px);padding:18px 0 24px;border-top:1px solid var(--fd-rtf-line)}
.fd-rtf-pay{display:flex;flex-wrap:wrap;gap:6px}
.fd-rtf-pay li{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(35,27,21,.22);font:600 10px/1 ${SANS};letter-spacing:.08em;text-transform:uppercase;color:var(--fd-rtf-fg);background:var(--fd-rtf-card)}
.fd-rtf-legal{display:flex;flex-wrap:wrap;gap:6px 20px;font:400 12px/16px ${SANS};color:var(--fd-rtf-mut)}
.fd-rtf-legal .fd-rtf-a{color:var(--fd-rtf-mut)}
@media (max-width:1020px){
  .fd-rtf-promises{grid-template-columns:1fr 1fr}
  .fd-rtf-promises li:nth-child(3){border-left:0}
  .fd-rtf-promises li:nth-child(n+3){border-top:1px solid var(--fd-rtf-line)}
  .fd-rtf-main{grid-template-columns:1fr}
}
@media (max-width:767px){
  .fd-rtf-promises{grid-template-columns:1fr}
  .fd-rtf-promises li{border-left:0;padding:16px}
  .fd-rtf-promises li+li{border-top:1px solid var(--fd-rtf-line)}
  .fd-rtf-cols{grid-template-columns:1fr;gap:0;border-top:1px solid var(--fd-rtf-line)}
  .fd-rtf-col{border-bottom:1px solid var(--fd-rtf-line)}
  .fd-rtf-tog{height:52px;cursor:pointer;font-size:12px;color:var(--fd-rtf-fg)}
  .fd-rtf-pm{position:relative;display:block;width:12px;height:12px}
  .fd-rtf-pm i{position:absolute;left:0;top:5.5px;width:12px;height:1.2px;background:currentColor;transition:transform var(--fd-dur-3) var(--fd-ease-out)}
  .fd-rtf-pm i:last-child{transform:rotate(90deg)}
  .fd-rtf-col[data-open] .fd-rtf-pm i:last-child{transform:rotate(0)}
  .fd-rtf-panel{grid-template-rows:0fr;transition:grid-template-rows var(--fd-dur-3) var(--fd-ease-out)}
  .fd-rtf-col[data-open] .fd-rtf-panel{grid-template-rows:1fr}
  .fd-rtf-panel>ul{padding-top:0}
  .fd-rtf-col[data-open] .fd-rtf-panel>ul{padding-bottom:18px}
  .fd-rtf-ctry{max-width:none}
  .fd-rtf-main{padding-top:40px}
}
@media (prefers-reduced-motion:reduce){.fd-rtf *{animation:none!important;transition-duration:1ms!important}}
@media (prefers-contrast:more){.fd-rtf{--fd-rtf-mut:#43392F;--fd-rtf-line:rgba(35,27,21,.5)}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const RECENT = [
  { name: "Fisherman rib scarf", colour: "Havre", nok: 1290, src: "/img/lux/drape-oat.webp" },
  { name: "Selbu crew neck", colour: "Rust", nok: 3490, src: "/img/lux/drape-terra.webp" },
  { name: "Fjordline cardigan", colour: "Natt", nok: 3990, src: "/img/lux/drape-ink.webp" },
];

export function Demo() {
  const [code, setCode] = useState("NO");
  const c = COUNTRIES.find((x) => x.code === code) ?? COUNTRIES[0];
  return (
    <div className="fd-rtfd">
      <style>{demoCss}</style>
      <section className="fd-rtfd-recent" aria-label="Recently viewed">
        <div className="fd-rtfd-h">
          <h2>Recently viewed</h2>
          <a href="#">Clear</a>
        </div>
        <ul>
          {RECENT.map((r) => (
            <li key={r.name}>
              <a href="#">
                <img src={r.src} alt={`${r.name} in ${r.colour}, close-up of the knit`} width={600} height={750} loading="lazy" decoding="async" />
                <span className="fd-rtfd-n">{r.name}</span>
                <span className="fd-rtfd-m">{r.colour} <b key={code}>{priceIn(r.nok, c)}</b></span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <RetailFooter country={code} onCountryChange={setCode} />
    </div>
  );
}

const demoCss = `
:where(.fd-rtfd,.fd-rtfd *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-rtfd img){display:block}
.fd-rtfd{min-height:100vh;background:#F6F1E8;color:#231B15;font:400 14px/20px ${SANS};-webkit-font-smoothing:antialiased}
.fd-rtfd-recent{padding:48px clamp(16px,3.4vw,48px) 56px}
.fd-rtfd-h{display:flex;justify-content:space-between;align-items:baseline}
.fd-rtfd-h h2{font:400 28px/32px ${SERIF};letter-spacing:-.015em}
.fd-rtfd-h a{font-size:13px;color:#6E6257;box-shadow:inset 0 -1px 0 rgba(35,27,21,.3)}
.fd-rtfd-recent ul{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:20px}
.fd-rtfd-recent a{display:block;outline:0;border-radius:2px}
.fd-rtfd-recent a:focus-visible{outline:2px solid rgba(156,61,30,.7);outline-offset:2px}
.fd-rtfd-recent img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;transition:transform 700ms cubic-bezier(.22,1,.36,1)}
.fd-rtfd-recent li{overflow:hidden}
.fd-rtfd-recent a:hover img{transform:scale(1.03)}
.fd-rtfd-n{display:block;margin-top:12px;font-weight:500}
.fd-rtfd-m{display:flex;justify-content:space-between;color:#6E6257}
.fd-rtfd-m b{font-weight:400;color:#231B15;font-variant-numeric:tabular-nums;animation:fd-rtfd-in 420ms cubic-bezier(.22,1,.36,1)}
@keyframes fd-rtfd-in{from{opacity:0;transform:translateY(4px)}}
@media (max-width:767px){.fd-rtfd-recent ul{grid-template-columns:1fr 1fr}.fd-rtfd-recent li:last-child{display:none}.fd-rtfd-recent img{aspect-ratio:4/5}}
@media (prefers-reduced-motion:reduce){.fd-rtfd *{animation:none!important;transition:none!important}}
`;
