/**
 * PressQuotes, an editorial press section for a film: festival laurels
 * drawn in SVG, one huge pull quote with hand-drawn stars, and smaller
 * critics' quotes in a rhythmic newspaper grid. Publications are set as
 * typographic wordmarks. Click any smaller quote to promote it to the lead.
 *
 * Props: quotes (PressQuote[]; the first is the lead), laurels (Laurel[]),
 * title, credit, release, ctaLabel, ctaHref, className.
 * PressQuote: { quote, pub, style, critic, stars? (0..5) }
 *   style picks the wordmark voice: "serif-caps" | "condensed" | "italic" |
 *   "mono" | "ledger" | "light"
 * Laurel: { award, event }
 *
 * Browser support: all evergreen browsers.
 * Accessibility: quotes are <figure>/<blockquote>/<figcaption>; star ratings
 * are labelled images; smaller quotes are buttons ("Lead with this review")
 * and the lead is announced politely after a swap.
 * Reduced motion: stars and laurels appear without drawing.
 */
import { useState } from "react";

export type PubStyle = "serif-caps" | "condensed" | "italic" | "mono" | "ledger" | "light";
export interface PressQuote { quote: string; pub: string; style: PubStyle; critic: string; stars?: number }
export interface Laurel { award: string; event: string }

export interface PressQuotesProps {
  quotes?: PressQuote[];
  laurels?: Laurel[];
  title?: string;
  credit?: string;
  release?: string;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
}

export const DEFAULT_QUOTES: PressQuote[] = [
  { quote: "The quietest film of the year, and the one I still can’t stop thinking about.", pub: "Cahier Noir", style: "italic", critic: "Hélène Marchetti", stars: 5 },
  { quote: "Varga films a salt flat the way other directors film a war. I left the cinema thirsty.", pub: "ScreenWeek", style: "condensed", critic: "Marcus Bell", stars: 5 },
  { quote: "Dunja Petrović barely raises her voice for ninety minutes, then breaks your heart with one look at a kettle.", pub: "The Northern Review", style: "serif-caps", critic: "Owen Achterberg", stars: 5 },
  { quote: "Ninety-eight minutes, eleven lines of dialogue, not one of them wasted.", pub: "Reel/Time", style: "mono", critic: "Sam Okoro", stars: 4 },
  { quote: "Slow, yes. Boring, never. Bring someone you don’t have to talk to afterwards.", pub: "The Morning Ledger", style: "ledger", critic: "Ruth Calloway", stars: 4 },
  { quote: "A small miracle made for €1.4 million and a borrowed truck.", pub: "kino.monat", style: "light", critic: "Jana Weiss", stars: 4 },
];

export const DEFAULT_LAURELS: Laurel[] = [
  { award: "Grand Prize", event: "Nordlicht Film Festival 2026" },
  { award: "Official Selection", event: "Festival de Saint-Clair 2026" },
  { award: "Best Actress", event: "Lindau Film Week 2026" },
];

function Wordmark({ pub, style }: { pub: string; style: PubStyle }) {
  return <span className="fd-prq-pub" data-s={style}>{pub}</span>;
}

const STAR = "M12 2.5l2.7 6.2 6.8.6-5.1 4.5 1.5 6.6L12 16.9l-5.9 3.5 1.5-6.6-5.1-4.5 6.8-.6z";
function Stars({ n, size = 18 }: { n: number; size?: number }) {
  return (
    <span className="fd-prq-stars" role="img" aria-label={`${n} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((k) => (
        <svg key={k} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ ["--k" as string]: k }}>
          <path d={STAR} pathLength={1} className="fd-prq-sline" />
          {k < n && <path d={STAR} className="fd-prq-sfill" />}
        </svg>
      ))}
    </span>
  );
}

function LaurelMark({ award, event }: Laurel) {
  const leaves = Array.from({ length: 7 }, (_, i) => i);
  const branch = (flip: boolean) => (
    <g transform={flip ? "translate(200 0) scale(-1 1)" : undefined}>
      <path d="M44 104 C 22 86, 18 52, 34 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {leaves.map((i) => {
        const t = i / 6;
        const y = 98 - t * 74;
        const x = 40 - Math.sin(t * Math.PI * 0.9) * 16 + t * 2;
        const a = -30 - t * 26;
        return (
          <g key={i} className="fd-prq-leaf" style={{ ["--i" as string]: i }}>
            <ellipse cx={x - 7} cy={y} rx="9" ry="3.6" transform={`rotate(${a} ${x} ${y})`} fill="currentColor" />
            <ellipse cx={x + 6} cy={y - 5} rx="8" ry="3.2" transform={`rotate(${a + 70} ${x} ${y})`} fill="currentColor" />
          </g>
        );
      })}
    </g>
  );
  return (
    <figure className="fd-prq-laurel">
      <svg viewBox="0 0 200 112" width="240" height="134" aria-hidden="true">{branch(false)}{branch(true)}</svg>
      <figcaption>
        <b>{award}</b>
        <span>{event}</span>
      </figcaption>
    </figure>
  );
}

export function PressQuotes({
  quotes = DEFAULT_QUOTES,
  laurels = DEFAULT_LAURELS,
  title = "The Salt Year",
  credit = "A film by Ines Varga",
  release = "In cinemas 14 November",
  ctaLabel = "Find a screening",
  ctaHref = "#screenings",
  className,
}: PressQuotesProps) {
  const [order, setOrder] = useState(() => quotes.map((_, i) => i));
  const [swaps, setSwaps] = useState(0);
  const lead = quotes[order[0]];
  const promote = (pos: number) => {
    setOrder((o) => { const n = [...o]; [n[0], n[pos]] = [n[pos], n[0]]; return n; });
    setSwaps((s) => s + 1);
  };
  return (
    <section className={`fd-prq${className ? " " + className : ""}`} aria-label={`Press for ${title}`}>
      <style>{css}</style>
      <header className="fd-prq-mast">
        <span>{title}</span>
        <span>{credit}</span>
        <span>{release}</span>
      </header>

      <div className="fd-prq-laurels">
        {laurels.map((l) => <LaurelMark key={l.event} {...l} />)}
      </div>

      <figure className="fd-prq-lead" key={"lead" + order[0]} aria-live={swaps ? "polite" : "off"}>
        {lead.stars != null && <Stars n={lead.stars} size={30} />}
        <blockquote className="fd-prq-lq"><p>{lead.quote}</p></blockquote>
        <figcaption className="fd-prq-lc">
          <Wordmark pub={lead.pub} style={lead.style} />
          <span className="fd-prq-critic">{lead.critic}</span>
        </figcaption>
      </figure>

      <div className="fd-prq-grid">
        {order.slice(1).map((qi, k) => {
          const q = quotes[qi];
          return (
            <div key={qi} className="fd-prq-item" data-slot={k}>
              <figure className="fd-prq-fig">
                {q.stars != null && <Stars n={q.stars} size={14} />}
                <blockquote className="fd-prq-q"><p>{q.quote}</p></blockquote>
                <figcaption className="fd-prq-cap">
                  <Wordmark pub={q.pub} style={q.style} />
                  <span className="fd-prq-critic">{q.critic}</span>
                </figcaption>
              </figure>
              <button type="button" className="fd-prq-hint" onClick={() => promote(k + 1)} aria-label={`Lead with the ${q.pub} review`}>Lead with this</button>
            </div>
          );
        })}
        <a className="fd-prq-cta" href={ctaHref}>
          <span className="fd-prq-ctak">{release}</span>
          <span className="fd-prq-ctal">{ctaLabel}</span>
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 20h24M23 11l9 9-9 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></svg>
        </a>
      </div>
    </section>
  );
}

const SERIF = `"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif`;
const SANS = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const MONO = `ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace`;

const css = `
.fd-prq,.fd-prq *,.fd-prq *::before,.fd-prq *::after{box-sizing:border-box}
.fd-prq{--fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-prq-bg:#E9E5DB;--fd-prq-ink:#15130F;--fd-prq-mut:#6B655A;--fd-prq-rule:#15130F;--fd-prq-hair:rgba(21,19,15,.2);--fd-prq-red:#C0291A;
  display:block;max-width:1240px;margin:0 auto;padding:40px 32px 88px;background:var(--fd-prq-bg);color:var(--fd-prq-ink);
  font:400 16px/1.45 ${SERIF};letter-spacing:0;-webkit-font-smoothing:antialiased}
.fd-prq-mast{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;margin:0;padding:10px 0;border-top:3px solid var(--fd-prq-rule);border-bottom:1px solid var(--fd-prq-rule);
  font:500 11px/1.2 ${MONO};letter-spacing:.14em;text-transform:uppercase;color:var(--fd-prq-ink)}
.fd-prq-mast span:nth-child(2){text-align:center}
.fd-prq-mast span:nth-child(3){text-align:right;color:var(--fd-prq-red)}
.fd-prq-laurels{display:flex;justify-content:center;flex-wrap:wrap;gap:24px 56px;margin:0;padding:48px 0 8px}
.fd-prq-laurel{position:relative;width:240px;height:134px;margin:0;padding:0;color:var(--fd-prq-ink)}
.fd-prq-laurel svg{display:block;width:240px;height:134px}
.fd-prq-laurel figcaption{position:absolute;inset:16px 60px 14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;text-align:center}
.fd-prq-laurel b{display:block;font:700 10.5px/1.15 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:var(--fd-prq-ink)}
.fd-prq-laurel span{display:block;font:italic 400 14px/1.2 ${SERIF};color:var(--fd-prq-ink)}
.fd-prq-leaf{opacity:1;transform-box:fill-box;transform-origin:center;animation:fd-prq-leaf var(--fd-dur-4) var(--fd-spring) both;animation-delay:calc(var(--i) * 70ms + 200ms)}
@keyframes fd-prq-leaf{from{opacity:0;transform:scale(.2)}}
.fd-prq-lead{margin:0;padding:56px 0 64px;border-bottom:1px solid var(--fd-prq-rule);text-align:center}
.fd-prq-lead .fd-prq-stars{justify-content:center;margin:0 0 28px}
.fd-prq-lq{margin:0 auto;padding:0}
.fd-prq-lq p{padding:0;font:400 clamp(2.5rem,6.6vw,6rem)/.98 ${SERIF};letter-spacing:-.035em;color:var(--fd-prq-ink);max-width:15ch;margin:0 auto;text-wrap:balance;animation:fd-prq-in var(--fd-dur-4) var(--fd-ease-out) both}
.fd-prq-lq p::before{content:"\\201C";margin-left:-.42em;color:var(--fd-prq-red)}
.fd-prq-lq p::after{content:"\\201D";color:var(--fd-prq-red)}
@keyframes fd-prq-in{from{opacity:0;transform:translateY(18px)}}
.fd-prq-lc{display:flex;align-items:baseline;justify-content:center;gap:14px;margin:32px 0 0;padding:0}
.fd-prq-lc .fd-prq-pub{font-size:1.5rem}
.fd-prq-critic{font:400 12px/1.2 ${MONO};letter-spacing:.06em;text-transform:uppercase;color:var(--fd-prq-mut)}
.fd-prq-stars{display:flex;gap:4px;color:var(--fd-prq-red)}
.fd-prq-stars svg{display:block;overflow:visible}
.fd-prq-sline{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:0;animation:fd-prq-draw var(--fd-dur-4) var(--fd-ease-out) both;animation-delay:calc(var(--k) * 90ms)}
.fd-prq-sfill{fill:currentColor;animation:fd-prq-fill var(--fd-dur-3) var(--fd-ease-out) both;animation-delay:calc(var(--k) * 90ms + 380ms)}
@keyframes fd-prq-draw{from{stroke-dashoffset:1}}
@keyframes fd-prq-fill{from{opacity:0}}
.fd-prq-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));margin:0;padding:0}
.fd-prq-item{position:relative;display:block;margin:0;padding:32px 28px 40px;border:0;border-right:1px solid var(--fd-prq-hair);border-bottom:1px solid var(--fd-prq-hair);background:transparent;color:inherit;text-align:left;cursor:pointer;
  transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-prq-item[data-slot="0"]{grid-column:span 5;padding-left:0}
.fd-prq-item[data-slot="1"]{grid-column:span 4}
.fd-prq-item[data-slot="2"]{grid-column:span 3;border-right:0}
.fd-prq-item[data-slot="3"]{grid-column:span 4;padding-left:0}
.fd-prq-item[data-slot="4"]{grid-column:span 4}
.fd-prq-item:hover{background:rgba(21,19,15,.04)}
.fd-prq-item:has(.fd-prq-hint:focus-visible){outline:2px solid rgba(192,41,26,.75);outline-offset:-2px}
.fd-prq-cta:focus-visible{outline:2px solid rgba(192,41,26,.75);outline-offset:-2px}
.fd-prq-fig{margin:0;padding:0}
.fd-prq-fig .fd-prq-stars{margin:0 0 16px}
.fd-prq-q{margin:0;padding:0}
.fd-prq-q p{margin:0;padding:0;font:400 1.25rem/1.3 ${SERIF};letter-spacing:-.01em;color:var(--fd-prq-ink);text-wrap:pretty}
.fd-prq-item[data-slot="0"] .fd-prq-q p{font-size:2rem;line-height:1.12;letter-spacing:-.02em}
.fd-prq-cap{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin:20px 0 0;padding:0}
.fd-prq-pub{display:inline-block;color:var(--fd-prq-ink);white-space:nowrap}
.fd-prq-pub[data-s="serif-caps"]{font:600 0.9375rem/1 ${SERIF};letter-spacing:.2em;text-transform:uppercase}
.fd-prq-pub[data-s="condensed"]{font:900 italic 1.25rem/1 ${SANS};letter-spacing:-.06em;text-transform:uppercase}
.fd-prq-pub[data-s="italic"]{font:italic 400 1.375rem/1 ${SERIF};letter-spacing:-.01em}
.fd-prq-pub[data-s="mono"]{font:700 1rem/1 ${MONO};letter-spacing:-.02em;text-transform:uppercase;padding:3px 6px;background:var(--fd-prq-ink);color:var(--fd-prq-bg)}
.fd-prq-pub[data-s="ledger"]{font:700 1.125rem/1 ${SERIF};letter-spacing:-.02em;padding-bottom:3px;border-bottom:3px double var(--fd-prq-ink)}
.fd-prq-pub[data-s="light"]{font:300 1.25rem/1 ${SANS};letter-spacing:-.04em}
.fd-prq-lc .fd-prq-pub[data-s="serif-caps"]{font-size:1.0625rem}
.fd-prq-hint{appearance:none;-webkit-appearance:none;position:absolute;right:16px;bottom:12px;margin:0;padding:0;border:0;border-radius:0;background:transparent;cursor:pointer;outline:none;font:500 10px/1 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:var(--fd-prq-red);opacity:0;transform:translateY(4px);transition:opacity var(--fd-dur-2),transform var(--fd-dur-2) var(--fd-ease-out)}
.fd-prq-hint::after{content:"";position:absolute;inset:-2000px;}
.fd-prq-item{overflow:hidden}
.fd-prq-item:hover .fd-prq-hint,.fd-prq-hint:focus-visible{opacity:1;transform:none}
.fd-prq-cta{grid-column:span 4;display:flex;flex-direction:column;justify-content:space-between;min-height:220px;margin:0;padding:28px;background:var(--fd-prq-red);color:#F6EFE6;text-decoration:none;border-bottom:1px solid var(--fd-prq-red);transition:background-color var(--fd-dur-2)}
.fd-prq-cta:hover{background:#A32014}
.fd-prq-ctak{font:500 11px/1.2 ${MONO};letter-spacing:.14em;text-transform:uppercase}
.fd-prq-ctal{font:400 2.5rem/1 ${SERIF};letter-spacing:-.03em}
.fd-prq-cta svg{display:block;align-self:flex-end;transition:transform var(--fd-dur-3) var(--fd-spring)}
.fd-prq-cta:hover svg{transform:translateX(6px)}
@media (max-width:900px){
  .fd-prq{padding:24px 16px 64px}
  .fd-prq-mast{grid-template-columns:1fr 1fr;font-size:10px}
  .fd-prq-mast span:nth-child(2){display:none}
  .fd-prq-laurels{gap:8px 4px;padding-top:32px}
  .fd-prq-laurel{width:170px;height:96px}
  .fd-prq-laurel svg{width:170px;height:96px}
  .fd-prq-laurel figcaption{inset:14px 38px 10px}
  .fd-prq-laurel span{font-size:11.5px}
  .fd-prq-laurel b{font-size:9px}
  .fd-prq-lead{padding:40px 0 48px}
  .fd-prq-lq p{font-size:2.5rem}
  .fd-prq-lc{flex-direction:column;align-items:center;gap:8px}
  .fd-prq-grid{grid-template-columns:1fr}
  .fd-prq-item,.fd-prq-item[data-slot]{grid-column:auto;padding:28px 0 32px;border-right:0}
  .fd-prq-item[data-slot="0"] .fd-prq-q p{font-size:1.625rem}
  .fd-prq-cta{grid-column:auto;min-height:180px;margin-top:24px}
  .fd-prq-hint{right:0}
}
@media (prefers-reduced-motion:reduce){.fd-prq *{animation:none!important;transition-duration:1ms!important}}
@media (prefers-contrast:more){.fd-prq{--fd-prq-hair:rgba(21,19,15,.6);--fd-prq-mut:#433E35}}
`;

export function Demo() {
  return (
    <div className="fd-prqd">
      <style>{`.fd-prqd{min-height:100vh;margin:0;padding:0;background:#E9E5DB}`}</style>
      <PressQuotes />
    </div>
  );
}
