/**
 * ReceiptPricing, agency / studio retainers rendered as printed till
 * receipts hanging from a printer slot. Each receipt carries a summary; pick
 * one and it "prints": the itemised order (hours, roles, VAT, total, barcode)
 * feeds out of the slot line by line with a stepped animation while the slot
 * light blinks. Perforated tear edges are a CSS mask; the barcode is an SVG
 * generated from the order number.
 *
 * Props: packages ({ id, kind, name, price, per, summary[], items[], terms }),
 * studio ({ name, address, vatId }), vatRate, currency, date, defaultId,
 * title, lede.
 * Item: [qty, description, amount|null].
 * CSS vars: --fd-rcp-desk, --fd-rcp-paper, --fd-rcp-ink, --fd-rcp-accent.
 *
 * Browser support: CSS masks (all evergreen browsers, -webkit- prefixed for
 * Safari); the feed animates a measured height.
 * Accessibility: each receipt is an <article>; the print control is a
 * <button aria-pressed> and the printed section is aria-hidden until printed.
 * The barcode is decorative (the order number is printed as text).
 * Reduced motion: the receipt appears printed instantly.
 */
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type ReceiptItem = [string, string, number | null];
export interface ReceiptPackage {
  id: string;
  kind: string;
  name: string;
  price: number;
  per: string;
  summary: string[];
  items: ReceiptItem[];
  terms: string;
  order: string;
}

export interface ReceiptPricingProps {
  packages?: ReceiptPackage[];
  studio?: { name: string; address: string; vatId: string };
  vatRate?: number;
  currency?: string;
  date?: string;
  defaultId?: string;
  title?: string;
  lede?: string;
  className?: string;
}

const PACKAGES: ReceiptPackage[] = [
  {
    id: "sprint",
    kind: "One-off",
    name: "Brand sprint",
    price: 7400,
    per: "once",
    order: "OO-2611-0412",
    summary: ["2 weeks, start any Monday", "Logo, type, colour, 3 key layouts", "One round of changes"],
    items: [
      ["1", "Kick-off workshop, half day", 0],
      ["60h", "Senior designer", 5700],
      ["12h", "Design direction (Mara)", 1440],
      ["1", "Figma library + handoff call", 260],
      ["1", "Coffee, during workshop", null],
    ],
    terms: "50% on booking, 50% on delivery.",
  },
  {
    id: "retainer-s",
    kind: "Monthly",
    name: "Retainer S",
    price: 4800,
    per: "month",
    order: "OO-2611-0417",
    summary: ["32 hours a month", "Weekly crit, Thursdays 10:00", "Replies within one working day"],
    items: [
      ["32h", "Senior designer", 4100],
      ["4h", "Design direction", 480],
      ["4", "Weekly crit, 45 min", 220],
      ["8h", "Rollover cap, unused hours", null],
      ["1", "Shared Slack channel", null],
    ],
    terms: "Cancel with 30 days' notice.",
  },
  {
    id: "retainer-l",
    kind: "Monthly",
    name: "Retainer L",
    price: 11200,
    per: "month",
    order: "OO-2611-0421",
    summary: ["80 hours, two designers", "Same-day replies, 09:00 to 18:00", "Quarterly brand audit"],
    items: [
      ["80h", "Two senior designers", 8800],
      ["12h", "Design direction", 1440],
      ["1", "Quarterly brand audit", 960],
      ["16h", "Rollover cap, unused hours", null],
      ["1", "Motion and 3D, on request", null],
    ],
    terms: "3-month minimum, then 30 days' notice.",
  },
];

const eur = (n: number, c: string) => c + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Barcode({ code }: { code: string }) {
  let h = 2166136261;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  const seq = "11010010000" + code.split("").map((ch) => {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return (h & 0x7ff).toString(2).padStart(11, "0");
  }).join("") + "1100011101011";
  for (let i = 0; i < seq.length; ) {
    const bit = seq[i];
    let run = 0;
    while (i < seq.length && seq[i] === bit && run < 4) {
      run++;
      i++;
    }
    if (bit === "1") bars.push({ x, w: run });
    x += run;
  }
  return (
    <svg className="fd-rcp-bar" viewBox={`0 0 ${x} 40`} preserveAspectRatio="none" aria-hidden="true">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height="40" fill="currentColor" />
      ))}
    </svg>
  );
}

function Feed({ open, children }: { open: boolean; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    if (first.current || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      first.current = false;
      o.style.height = "";
      return;
    }
    const from = open ? 0 : o.offsetHeight;
    const to = open ? i.offsetHeight : 0;
    o.style.height = from + "px";
    void o.offsetHeight;
    o.style.height = to + "px";
    const end = (e: TransitionEvent) => {
      if (e.target === o) o.style.height = "";
    };
    o.addEventListener("transitionend", end);
    return () => o.removeEventListener("transitionend", end);
  }, [open]);
  return (
    <div className="fd-rcp-feed" ref={outer} data-open={open ? "" : undefined} aria-hidden={!open}>
      <div className="fd-rcp-feed-in" ref={inner}>
        {children}
      </div>
    </div>
  );
}

export function ReceiptPricing({
  packages = PACKAGES,
  studio = { name: "Office Ordinary", address: "Witte de Withstraat 61, 3012 BN Rotterdam", vatId: "BTW NL8612.44.519.B01" },
  vatRate = 0.21,
  currency = "€",
  date = "02-11-2026  10:41",
  defaultId = "retainer-s",
  title = "Design, by the hour, itemised.",
  lede = "Three ways to hire us. Pick one and we print exactly what you get: hours, people, rituals and the bill. Nothing hidden under the fold.",
  className,
}: ReceiptPricingProps) {
  const [sel, setSel] = useState(defaultId);
  const [run, setRun] = useState(0);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  return (
    <section className={`fd-rcp${className ? " " + className : ""}`} aria-labelledby={`${uid}-t`}>
      <style>{css}</style>
      <div className="fd-rcp-head">
        <h2 className="fd-rcp-title" id={`${uid}-t`}>{title}</h2>
        <p className="fd-rcp-lede">{lede}</p>
      </div>
      <div className="fd-rcp-row">
        {packages.map((p, i) => {
          const on = p.id === sel;
          const vat = Math.round(p.price * vatRate * 100) / 100;
          return (
            <article key={p.id} className="fd-rcp-r" data-on={on ? "" : undefined} aria-label={`${p.name}, ${eur(p.price, currency)} per ${p.per}`}>
              <div className="fd-rcp-slot" aria-hidden="true">
                <span className="fd-rcp-led" key={on ? `on${run}` : "off"} />
                <span className="fd-rcp-mouth" />
              </div>
              <div className="fd-rcp-paper">
                <p className="fd-rcp-studio">{studio.name}</p>
                <p className="fd-rcp-addr">{studio.address}</p>
                <p className="fd-rcp-rule" aria-hidden="true">{"* ".repeat(40)}</p>
                <p className="fd-rcp-kind">
                  <span>No. {String(i + 1).padStart(2, "0")}</span>
                  <span>{p.kind}</span>
                </p>
                <h3 className="fd-rcp-name">{p.name}</h3>
                <p className="fd-rcp-price">
                  {eur(p.price, currency).replace(/,00$/, "")}
                  <small>/ {p.per}</small>
                </p>
                <ul className="fd-rcp-sum">
                  {p.summary.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>

                <Feed open={on}>
                    <p className="fd-rcp-meta">
                      <span>{date}</span>
                      <span>{p.order}</span>
                    </p>
                    <table className="fd-rcp-tab">
                      <tbody>
                        {p.items.map(([q, d, a]) => (
                          <tr key={d}>
                            <td>{q}</td>
                            <td>{d}</td>
                            <td>{a === null ? "incl." : a === 0 ? "free" : eur(a, "")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <dl className="fd-rcp-totals">
                      <div>
                        <dt>Subtotal</dt>
                        <dd>{eur(p.price, "")}</dd>
                      </div>
                      <div>
                        <dt>BTW {Math.round(vatRate * 100)}%</dt>
                        <dd>{eur(vat, "")}</dd>
                      </div>
                      <div className="fd-rcp-grand">
                        <dt>Total {currency}</dt>
                        <dd>{eur(p.price + vat, "")}</dd>
                      </div>
                    </dl>
                    <p className="fd-rcp-terms">{p.terms}</p>
                    <Barcode code={p.order} />
                    <p className="fd-rcp-code">{p.order.split("").join(" ")}</p>
                    <a className="fd-rcp-cta" href={`#book-${p.id}`} tabIndex={on ? 0 : -1}>
                      Book a 30-min intro
                    </a>
                    <p className="fd-rcp-thanks">{studio.vatId}<br />Thank you. Keep this for your records.</p>
                </Feed>

                {!on && (
                  <button
                    type="button"
                    className="fd-rcp-print"
                    aria-pressed={false}
                    onClick={() => {
                      setSel(p.id);
                      setRun((r) => r + 1);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M4 6V2h8v4M4 12H2.5V6.5h11V12H12M4 10h8v4H4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    </svg>
                    Print this one
                  </button>
                )}
                {on && <span className="fd-rcp-stamp" aria-hidden="true">Selected</span>}
              </div>
            </article>
          );
        })}
      </div>
      <p className="fd-rcp-foot">Prices excl. BTW. Billed on the 1st, payment within 14 days. We take on four retainer clients at a time; two slots open for January.</p>
    </section>
  );
}

const css = `
:where(.fd-rcp,.fd-rcp *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border-collapse:collapse;border-spacing:0}
:where(.fd-rcp,.fd-rcp *)::before,:where(.fd-rcp,.fd-rcp *)::after{box-sizing:border-box}
:where(.fd-rcp svg){display:block;flex-shrink:0}
:where(.fd-rcp button){appearance:none;-webkit-appearance:none;cursor:pointer}
.fd-rcp{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-rcp-desk:#DADFD6;--fd-rcp-paper:#FDFCF7;--fd-rcp-ink:#1B1B19;--fd-rcp-accent:#F0466A;
  --mut:#6F6E68;
  --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  display:block;width:100%;background:var(--fd-rcp-desk);color:var(--fd-rcp-ink);font:400 13px/20px var(--mono);-webkit-font-smoothing:antialiased;
  padding:clamp(48px,7vw,96px) clamp(16px,4vw,56px)}
.fd-rcp-head{max-width:1140px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:24px 64px;align-items:end}
.fd-rcp-title{font:700 clamp(2.25rem,5vw,4rem)/1 var(--mono);letter-spacing:-.06em}
.fd-rcp-lede{max-width:44ch;font-size:.875rem;line-height:22px;color:#4C4B46}
.fd-rcp-row{max-width:1140px;margin:56px auto 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(16px,3vw,40px);align-items:start}
.fd-rcp-r{position:relative;display:flex;flex-direction:column;align-items:center;min-width:0}
.fd-rcp-slot{position:relative;z-index:2;width:100%;height:28px;border-radius:10px;background:#1E1E1C;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 14px -8px rgba(0,0,0,.6)}
.fd-rcp-mouth{position:absolute;left:14px;right:14px;bottom:7px;height:4px;border-radius:2px;background:#000}
.fd-rcp-led{position:absolute;right:12px;top:6px;width:5px;height:5px;border-radius:50%;background:#3E3E3A}
.fd-rcp-r[data-on] .fd-rcp-led{background:#5BE37D;box-shadow:0 0 6px #5BE37D;animation:fd-rcp-blink 160ms steps(1) 8}
@keyframes fd-rcp-blink{50%{background:#3E3E3A;box-shadow:none}}
.fd-rcp-paper{position:relative;width:calc(100% - 28px);margin-top:-12px;padding:28px 20px 30px;background:var(--fd-rcp-paper);
  background-image:linear-gradient(rgba(0,0,0,.05),transparent 22px);
  -webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/12px 7px repeat-x,linear-gradient(#000 0 0) top/100% calc(100% - 6.9px) no-repeat;
  mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/12px 7px repeat-x,linear-gradient(#000 0 0) top/100% calc(100% - 6.9px) no-repeat;
  filter:drop-shadow(0 10px 12px rgba(40,44,36,.18))}
.fd-rcp-r[data-on] .fd-rcp-paper{animation:fd-rcp-jolt var(--fd-dur-3) steps(4) 1}
@keyframes fd-rcp-jolt{0%{transform:translateY(-10px)}100%{transform:none}}
.fd-rcp-studio{text-align:center;font:700 15px/20px var(--mono);letter-spacing:.18em;text-transform:uppercase}
.fd-rcp-addr{margin-top:2px;text-align:center;font-size:10px;line-height:14px;color:var(--mut)}
.fd-rcp-rule{margin:14px 0 12px;overflow:hidden;white-space:nowrap;font-size:11px;line-height:12px;color:var(--mut)}
.fd-rcp-kind{display:flex;justify-content:space-between;font-size:11px;line-height:16px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.fd-rcp-name{margin-top:10px;font:700 1.5rem/28px var(--mono);letter-spacing:-.04em}
.fd-rcp-price{display:flex;align-items:baseline;gap:8px;margin-top:6px;font:700 2.25rem/44px var(--mono);letter-spacing:-.06em;font-variant-numeric:tabular-nums}
.fd-rcp-price small{font-size:12px;font-weight:400;letter-spacing:0;color:var(--mut)}
.fd-rcp-sum{margin-top:12px;padding-top:12px;border-top:1px dashed rgba(27,27,25,.35)}
.fd-rcp-sum li{position:relative;padding-left:16px;font-size:12px;line-height:20px}
.fd-rcp-sum li::before{content:">";position:absolute;left:0;color:var(--mut)}
.fd-rcp-feed{height:0;overflow:hidden;transition:height 1100ms steps(16,end)}
.fd-rcp-feed[data-open]{height:auto}
.fd-rcp-feed-in{display:flow-root}
.fd-rcp-meta{display:flex;justify-content:space-between;margin-top:16px;padding-top:12px;border-top:1px dashed rgba(27,27,25,.35);font-size:10px;line-height:16px;color:var(--mut);white-space:pre}
.fd-rcp-tab{width:100%;margin-top:8px;font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}
.fd-rcp-tab td{padding:3px 0;vertical-align:top}
.fd-rcp-tab td:first-child{width:36px;color:var(--mut)}
.fd-rcp-tab td:last-child{text-align:right;white-space:nowrap;padding-left:8px}
.fd-rcp-totals{margin-top:8px;padding-top:8px;border-top:1px dashed rgba(27,27,25,.35);font-size:11px;line-height:18px;font-variant-numeric:tabular-nums}
.fd-rcp-totals div{display:flex;justify-content:space-between}
.fd-rcp-grand{margin-top:6px;padding:6px 0;border-top:2px solid var(--fd-rcp-ink);border-bottom:2px solid var(--fd-rcp-ink);font-size:15px;line-height:22px;font-weight:700}
.fd-rcp-terms{margin-top:10px;font-size:11px;line-height:16px;text-align:center}
.fd-rcp-bar{width:100%;height:44px;margin-top:14px;color:var(--fd-rcp-ink)}
.fd-rcp-code{margin-top:4px;text-align:center;font-size:9px;line-height:12px;letter-spacing:.1em;color:var(--mut)}
.fd-rcp-cta{display:flex;align-items:center;justify-content:center;margin-top:16px;height:44px;background:var(--fd-rcp-ink);color:var(--fd-rcp-paper);font:700 12px/44px var(--mono);letter-spacing:.08em;text-transform:uppercase;transition:background-color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-rcp-cta:hover{background:var(--fd-rcp-accent)}
.fd-rcp-cta:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-rcp-thanks{margin-top:14px;text-align:center;font-size:10px;line-height:15px;color:var(--mut)}
.fd-rcp-print{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:18px;height:40px;border:1.5px dashed var(--fd-rcp-ink);font:700 12px/16px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--fd-rcp-ink);transition:background-color var(--fd-dur-1),color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-rcp-print:hover{background:var(--fd-rcp-ink);color:var(--fd-rcp-paper);border-style:solid}
.fd-rcp-print:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-rcp-print:focus-visible,.fd-rcp-cta:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-rcp-accent) 70%,transparent);outline-offset:2px}
.fd-rcp-stamp{position:absolute;right:16px;top:124px;padding:4px 10px;border:2px solid var(--fd-rcp-accent);border-radius:4px;color:var(--fd-rcp-accent);font:700 12px/16px var(--mono);letter-spacing:.14em;text-transform:uppercase;transform:rotate(-9deg);mix-blend-mode:multiply;animation:fd-rcp-stamp var(--fd-dur-3) var(--fd-spring) 1000ms both}
@keyframes fd-rcp-stamp{from{opacity:0;transform:rotate(-9deg) scale(1.8)}to{opacity:.9;transform:rotate(-9deg) scale(1)}}
.fd-rcp-foot{max-width:1140px;margin:48px auto 0;font-size:11px;line-height:18px;color:#4C4B46}
@media (max-width:900px){
  .fd-rcp-head{grid-template-columns:1fr}
  .fd-rcp-row{grid-template-columns:minmax(0,1fr);max-width:400px;gap:28px}
}
@media (prefers-reduced-motion:reduce){.fd-rcp *{transition-duration:1ms!important;animation:none!important}.fd-rcp-stamp{opacity:.9}}
@media (prefers-contrast:more){.fd-rcp-paper{filter:none;outline:1px solid var(--fd-rcp-ink)}}
`;

export function Demo() {
  return <ReceiptPricing />;
}
