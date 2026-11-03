/**
 * PortraitQuoteCarousel, one large serif pull quote at a time, the guest's
 * portrait over a photo of the room they stayed in, stay details set as a
 * small ledger, and a filmstrip of portraits to jump between guests.
 *
 * Props: guests (Guest[]), title, eyebrow, interval (ms, 0 disables autoplay),
 * className.
 * Guest: { name, from, quote, room, nights, when, portrait, photo, photoAlt }
 *
 * Behaviour: the room photo crossfades; the quote reveals line by line (each
 * line rises out of its own mask). Arrows, the filmstrip and the keyboard
 * (Left/Right/Home/End while the carousel has focus) change the guest.
 * Autoplay pauses on hover, on focus and when off-screen, and never runs
 * with reduced motion.
 * Browser support: all evergreen browsers.
 * Accessibility: role="region" with aria-roledescription="carousel"; the
 * filmstrip buttons use aria-current; the quote is announced politely when
 * changed by the user (not during autoplay).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

export interface Guest {
  name: string;
  from: string;
  quote: string;
  room: string;
  nights: number;
  when: string;
  portrait: string;
  photo: string;
  photoAlt: string;
}

export interface PortraitQuoteCarouselProps {
  guests?: Guest[];
  eyebrow?: string;
  title?: string;
  interval?: number;
  className?: string;
}

const H = "/img/halcyon/";
const P = "/img/people/";

export const DEFAULT_GUESTS: Guest[] = [
  { name: "Ingrid Solberg", from: "Bergen", portrait: P + "p1.webp", room: "Limonaia Suite", nights: 5, when: "May 2026", photo: H + "suite-900.webp", photoAlt: "The Limonaia Suite, linen bed facing an open window over the bay",
    quote: "I booked two nights and stayed five. On the third morning Rosa left a lemon cake outside the door with a note saying the ferry was cancelled anyway. It wasn’t. I didn’t check." },
  { name: "Omar Farouk", from: "Amman", portrait: P + "p2.webp", room: "Room 7, Sea Terrace", nights: 4, when: "June 2026", photo: H + "pool-lemons-900.webp", photoAlt: "Terrace pool under lemon trees above the sea",
    quote: "We arrived after eleven hours of travel and one lost suitcase. By dinner someone had found me a linen shirt in my size, ironed. I still don’t know whose it was." },
  { name: "Amara Nwosu", from: "London", portrait: P + "p3.webp", room: "Garden Room", nights: 3, when: "September 2026", photo: H + "courtyard-pool-900.webp", photoAlt: "Stone courtyard with a small pool and two loungers",
    quote: "I’m a terrible sleeper and I have complained in hotels all over Italy. Here the only sound at night was the pool filter, and they switched it off at ten without being asked." },
  { name: "Daniel Ortega", from: "Mexico City", portrait: P + "p5.webp", room: "Limonaia Suite", nights: 6, when: "October 2026", photo: H + "positano-sunset-900.webp", photoAlt: "The coast at sunset seen from the villa's upper terrace",
    quote: "Honeymoon. We had a list of nine restaurants. We went to two, then ate on the terrace every night because Paolo’s anchovies were better and nobody had to put shoes on." },
  { name: "Priya Raman", from: "Singapore", portrait: P + "p6.webp", room: "Room 3, Courtyard", nights: 2, when: "April 2026", photo: H + "courtyard-pool-900.webp", photoAlt: "Stone courtyard with lemon trees and a pool",
    quote: "Two nights was a mistake. I have tried to make the ricotta and fig breakfast at home four times now. It is not the same, and Rosa will not tell me why." },
  { name: "Mae Thompson", from: "Atlanta", portrait: P + "p9.webp", room: "Torre Room", nights: 7, when: "March 2026", photo: H + "suite-900.webp", photoAlt: "Bright room with a sea view and a wide bed",
    quote: "My daughter booked it for my seventieth. I was sure the 212 steps down to the water would finish me. By day four I was doing them twice before lunch." },
];

function useReduced() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const f = () => setR(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return r;
}

function SplitQuote({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ws = Array.from(el.querySelectorAll<HTMLElement>("[data-w]"));
    let line = -1;
    let top = -Infinity;
    for (const w of ws) {
      if (w.offsetTop > top + 4) { line++; top = w.offsetTop; }
      w.style.setProperty("--ln", String(line));
    }
    el.setAttribute("data-ready", "");
  }, [text]);
  const words = text.split(" ");
  return (
    <p ref={ref} className="fd-pqc-quote">
      <span className="fd-pqc-sr">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <span key={i} data-w="" className="fd-pqc-w"><span className="fd-pqc-wi">{w}</span>{i < words.length - 1 ? " " : ""}</span>
        ))}
      </span>
    </p>
  );
}

export function PortraitQuoteCarousel({
  guests = DEFAULT_GUESTS,
  eyebrow = "From the guest book",
  title = "Fourteen rooms, mostly rebooked.",
  interval = 9000,
  className,
}: PortraitQuoteCarouselProps) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const [seen, setSeen] = useState(false);
  const [byUser, setByUser] = useState(false);
  const reduced = useReduced();
  const root = useRef<HTMLElement>(null);
  const sx = useRef(0);
  const n = guests.length;
  const g = guests[i];
  const go = useCallback((to: number, user = true) => { setI(((to % n) + n) % n); if (user) setByUser(true); }, [n]);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const auto = interval > 0 && !reduced && !hold && seen;
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => go(i + 1, false), interval);
    return () => clearTimeout(t);
  }, [auto, i, interval, go]);

  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowRight") go(i + 1);
    else if (k === "ArrowLeft") go(i - 1);
    else if (k === "Home") go(0);
    else if (k === "End") go(n - 1);
    else return;
    e.preventDefault();
  };

  return (
    <section
      ref={root}
      className={`fd-pqc${className ? " " + className : ""}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Guest stories"
      tabIndex={0}
      onKeyDown={onKey}
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHold(false); }}
      data-auto={auto || undefined}
    >
      <style>{css}</style>
      <div className="fd-pqc-top">
        <p className="fd-pqc-eyebrow">{eyebrow}</p>
        <h2 className="fd-pqc-title">{title}</h2>
        <p className="fd-pqc-count" aria-hidden="true"><b>{String(i + 1).padStart(2, "0")}</b> / {String(n).padStart(2, "0")}</p>
      </div>

      <div className="fd-pqc-stage">
        <div
          className="fd-pqc-media"
          onPointerDown={(e) => { sx.current = e.clientX; }}
          onPointerUp={(e) => { const d = e.clientX - sx.current; if (Math.abs(d) > 48) go(i + (d < 0 ? 1 : -1)); }}
        >
          <div className="fd-pqc-arch">
            {guests.map((x, k) => (
              <img key={k} className="fd-pqc-photo" data-on={k === i || undefined} src={x.photo} alt={k === i ? x.photoAlt : ""} aria-hidden={k !== i || undefined} width={900} height={900} loading={k === 0 ? "eager" : "lazy"} decoding="async" />
            ))}
          </div>
          <div className="fd-pqc-portrait" key={"p" + i}>
            <img src={g.portrait} alt={`Portrait of ${g.name}`} width={328} height={328} decoding="async" />
          </div>
          <p className="fd-pqc-caption" aria-hidden="true">{g.room}</p>
        </div>

        <div className="fd-pqc-copy" aria-live={byUser ? "polite" : "off"}>
          <svg className="fd-pqc-mark" width="56" height="44" viewBox="0 0 56 44" aria-hidden="true"><path d="M0 44V27C0 11.6 8.2 2.6 22 0l2.4 5.6C16 8.2 12.2 13.4 11.8 20H22v24H0zm32 0V27C32 11.6 40.2 2.6 54 0l2 5.6C47.9 8.2 44.2 13.4 43.8 20H54v24H32z" fill="currentColor" /></svg>
          <SplitQuote key={i} text={g.quote} />
          <div className="fd-pqc-by" key={"b" + i}>
            <p className="fd-pqc-name">{g.name}<span>, {g.from}</span></p>
            <dl className="fd-pqc-ledger">
              <div><dt>Room</dt><dd>{g.room}</dd></div>
              <div><dt>Nights</dt><dd>{g.nights}</dd></div>
              <div><dt>Stayed</dt><dd>{g.when}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      <div className="fd-pqc-nav">
        <ol className="fd-pqc-strip" aria-label="Choose a guest">
          {guests.map((x, k) => (
            <li key={k}>
              <button type="button" className="fd-pqc-thumb" aria-current={k === i || undefined} aria-label={`${x.name}, ${x.room}`} onClick={() => go(k)}>
                <img src={x.portrait} alt="" width={64} height={80} loading="lazy" decoding="async" />
                <span className="fd-pqc-bar" aria-hidden="true"><i key={k === i ? "on" + i : "off"} style={{ animationDuration: interval + "ms" }} /></span>
              </button>
            </li>
          ))}
        </ol>
        <div className="fd-pqc-arrows">
          <button type="button" className="fd-pqc-arrow" aria-label="Previous guest" onClick={() => go(i - 1)}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H4M9 5l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="fd-pqc-arrow" aria-label="Next guest" onClick={() => go(i + 1)}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
    </section>
  );
}

const SERIF = `"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif`;
const SANS = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const css = `
.fd-pqc,.fd-pqc *,.fd-pqc *::before,.fd-pqc *::after{box-sizing:border-box}
.fd-pqc{--fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-pqc-bg:#EFE9DE;--fd-pqc-ink:#23201A;--fd-pqc-mut:#756C5F;--fd-pqc-line:rgba(35,32,26,.16);--fd-pqc-terra:#A3472A;
  display:block;max-width:1240px;margin:0 auto;padding:72px 32px 64px;background:var(--fd-pqc-bg);color:var(--fd-pqc-ink);outline:none;
  font:400 15px/1.5 ${SANS};letter-spacing:0;-webkit-font-smoothing:antialiased}
.fd-pqc:focus-visible{outline:2px solid rgba(163,71,42,.7);outline-offset:4px}
.fd-pqc-top{display:grid;grid-template-columns:5fr 7fr;align-items:end;column-gap:64px;margin:0 0 48px;padding:0 0 20px;border-bottom:1px solid var(--fd-pqc-line)}
.fd-pqc-eyebrow{grid-column:1;margin:0;padding:0;font:italic 400 1.0625rem/1.3 ${SERIF};color:var(--fd-pqc-terra)}
.fd-pqc-title{grid-column:1;margin:6px 0 0;padding:0;font:400 1.5rem/1.2 ${SERIF};letter-spacing:-.01em;color:var(--fd-pqc-ink)}
.fd-pqc-count{grid-column:2;grid-row:1 / span 2;justify-self:end;margin:0;padding:0;font:400 13px/1 ${SANS};letter-spacing:.14em;color:var(--fd-pqc-mut);font-variant-numeric:tabular-nums}
.fd-pqc-count b{font-weight:600;color:var(--fd-pqc-ink)}
.fd-pqc-stage{display:grid;grid-template-columns:5fr 7fr;column-gap:64px;align-items:center}
.fd-pqc-media{position:relative;margin:0;padding:0 0 28px;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.fd-pqc-arch{position:relative;aspect-ratio:4/5;overflow:hidden;border-radius:9999px 9999px 4px 4px;background:#DCD3C3}
.fd-pqc-photo{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;opacity:0;transform:scale(1.06);transition:opacity var(--fd-dur-4) var(--fd-ease-in-out),transform 1400ms var(--fd-ease-out)}
.fd-pqc-photo[data-on]{opacity:1;transform:scale(1)}
.fd-pqc-portrait{position:absolute;right:-28px;bottom:0;width:38%;max-width:168px;aspect-ratio:4/5;overflow:hidden;margin:0;padding:6px;background:#FBF8F2;box-shadow:0 1px 0 rgba(35,32,26,.08),0 18px 40px -18px rgba(35,32,26,.45);animation:fd-pqc-drop var(--fd-dur-4) var(--fd-ease-out) both}
.fd-pqc-portrait img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 30%}
@keyframes fd-pqc-drop{from{opacity:0;transform:translateY(14px) rotate(2deg)}to{opacity:1;transform:none}}
.fd-pqc-caption{position:absolute;left:0;bottom:0;margin:0;padding:0;font:italic 400 0.8125rem/1 ${SERIF};color:var(--fd-pqc-mut)}
.fd-pqc-copy{position:relative;min-height:440px;display:flex;flex-direction:column;justify-content:center;padding:0}
.fd-pqc-mark{display:block;width:44px;height:auto;margin:0 0 28px;color:var(--fd-pqc-terra)}
.fd-pqc-quote{margin:0;padding:0;font:400 clamp(1.75rem,3.1vw,2.75rem)/1.18 ${SERIF};letter-spacing:-.018em;color:var(--fd-pqc-ink);text-wrap:pretty}
.fd-pqc-w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.08em;margin-bottom:-.08em;white-space:pre}
.fd-pqc-wi{display:inline-block;transform:translateY(105%)}
.fd-pqc-quote[data-ready] .fd-pqc-wi{animation:fd-pqc-rise var(--fd-dur-4) var(--fd-ease-out) both;animation-delay:calc(var(--ln,0) * 90ms + 60ms)}
@keyframes fd-pqc-rise{from{transform:translateY(105%)}to{transform:translateY(0)}}
.fd-pqc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.fd-pqc-by{margin:40px 0 0;padding:0;animation:fd-pqc-fade var(--fd-dur-4) var(--fd-ease-out) 380ms both}
@keyframes fd-pqc-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.fd-pqc-name{margin:0 0 16px;padding:0;font:600 13px/1.3 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:var(--fd-pqc-ink)}
.fd-pqc-name span{font-weight:400;color:var(--fd-pqc-mut)}
.fd-pqc-ledger{display:grid;grid-template-columns:2fr 1fr 1.4fr;margin:0;padding:0;border-top:1px solid var(--fd-pqc-line)}
.fd-pqc-ledger div{margin:0;padding:12px 16px 0 0;border-right:1px solid var(--fd-pqc-line)}
.fd-pqc-ledger div+div{padding-left:16px}
.fd-pqc-ledger div:last-child{border-right:0}
.fd-pqc-ledger dt{margin:0;padding:0;font:500 11px/1.2 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:var(--fd-pqc-mut)}
.fd-pqc-ledger dd{margin:6px 0 0;padding:0;font:400 1.0625rem/1.3 ${SERIF};color:var(--fd-pqc-ink)}
.fd-pqc-nav{display:flex;align-items:center;justify-content:space-between;gap:24px;margin:48px 0 0;padding:24px 0 0;border-top:1px solid var(--fd-pqc-line)}
.fd-pqc-strip{display:flex;gap:10px;margin:0;padding:0;list-style:none;overflow-x:auto;scrollbar-width:none}
.fd-pqc-strip::-webkit-scrollbar{display:none}
.fd-pqc-strip li{margin:0;padding:0;list-style:none;flex:none}
.fd-pqc-thumb{appearance:none;-webkit-appearance:none;position:relative;display:block;width:64px;margin:0;padding:0 0 8px;border:0;background:transparent;cursor:pointer;color:inherit;font:inherit;border-radius:0}
.fd-pqc-thumb img{display:block;width:64px;height:80px;object-fit:cover;object-position:50% 28%;filter:grayscale(1) contrast(.95);opacity:.55;transition:filter var(--fd-dur-3) var(--fd-ease-out),opacity var(--fd-dur-3) var(--fd-ease-out),transform var(--fd-dur-2) var(--fd-spring)}
.fd-pqc-thumb:hover img{opacity:.9;filter:grayscale(.3)}
.fd-pqc-thumb:active img{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-pqc-thumb[aria-current] img{filter:none;opacity:1}
.fd-pqc-thumb:focus-visible,.fd-pqc-arrow:focus-visible{outline:2px solid rgba(163,71,42,.7);outline-offset:2px}
.fd-pqc-bar{position:absolute;left:0;right:0;bottom:0;display:block;height:2px;background:transparent;overflow:hidden}
.fd-pqc-thumb[aria-current] .fd-pqc-bar{background:var(--fd-pqc-line)}
.fd-pqc-bar i{display:block;height:100%;width:100%;background:var(--fd-pqc-terra);transform-origin:0 50%;transform:scaleX(0)}
.fd-pqc-thumb[aria-current] .fd-pqc-bar i{transform:scaleX(1)}
.fd-pqc[data-auto] .fd-pqc-thumb[aria-current] .fd-pqc-bar i{animation:fd-pqc-prog linear both}
@keyframes fd-pqc-prog{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.fd-pqc-arrows{display:flex;gap:8px;flex:none}
.fd-pqc-arrow{appearance:none;-webkit-appearance:none;display:grid;place-items:center;width:52px;height:52px;margin:0;padding:0;border:1px solid var(--fd-pqc-line);border-radius:9999px;background:transparent;color:var(--fd-pqc-ink);cursor:pointer;
  transition:background-color var(--fd-dur-2),color var(--fd-dur-2),border-color var(--fd-dur-2),transform var(--fd-dur-2) var(--fd-spring)}
.fd-pqc-arrow svg{display:block}
.fd-pqc-arrow:hover{background:var(--fd-pqc-ink);border-color:var(--fd-pqc-ink);color:var(--fd-pqc-bg)}
.fd-pqc-arrow:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
@media (max-width:820px){
  .fd-pqc{padding:48px 16px 40px}
  .fd-pqc-top{grid-template-columns:1fr auto;column-gap:16px;margin-bottom:28px}
  .fd-pqc-title{font-size:1.25rem}
  .fd-pqc-stage{grid-template-columns:1fr;row-gap:32px}
  .fd-pqc-media{width:78%;padding-bottom:24px}
  .fd-pqc-portrait{right:-26%;width:44%}
  .fd-pqc-copy{min-height:0;display:block}
  .fd-pqc-mark{width:32px;margin-bottom:18px}
  .fd-pqc-quote{font-size:1.625rem;line-height:1.22}
  .fd-pqc-by{margin-top:28px}
  .fd-pqc-ledger{grid-template-columns:1.6fr .8fr 1.3fr}
  .fd-pqc-ledger div{padding-right:10px}.fd-pqc-ledger div+div{padding-left:10px}
  .fd-pqc-ledger dd{font-size:0.9375rem}
  .fd-pqc-nav{margin-top:32px;padding-top:20px}
  .fd-pqc-strip{gap:8px}
  .fd-pqc-thumb,.fd-pqc-thumb img{width:44px}.fd-pqc-thumb img{height:56px}
  .fd-pqc-arrows{display:none}
}
@media (prefers-reduced-motion:reduce){
  .fd-pqc *,.fd-pqc *::before{animation:none!important;transition-duration:1ms!important}
  .fd-pqc-wi{transform:none}
  .fd-pqc-photo{transform:none}
}
@media (prefers-contrast:more){.fd-pqc{--fd-pqc-line:rgba(35,32,26,.5);--fd-pqc-mut:#4F473C}}
`;

export function Demo() {
  return (
    <div className="fd-pqcd">
      <style>{demoCss}</style>
      <header className="fd-pqcd-bar">
        <span className="fd-pqcd-logo">Villa Saracena<em>Praiano</em></span>
        <nav className="fd-pqcd-nav" aria-label="Hotel">
          <a href="#rooms">Rooms</a><a href="#table">The table</a><a href="#getting-here">Getting here</a>
        </nav>
        <a className="fd-pqcd-book" href="#book">Check dates</a>
      </header>
      <PortraitQuoteCarousel />
    </div>
  );
}

const demoCss = `
.fd-pqcd,.fd-pqcd *{box-sizing:border-box}
.fd-pqcd{min-height:100vh;margin:0;padding:0;background:#EFE9DE;color:#23201A;font:400 14px/1.4 ${SANS}}
.fd-pqcd-bar{display:flex;align-items:center;gap:32px;max-width:1240px;height:64px;margin:0 auto;padding:0 32px}
.fd-pqcd-logo{display:flex;align-items:baseline;gap:8px;margin-right:auto;font:400 1.25rem/1 ${SERIF};letter-spacing:.01em;color:#23201A}
.fd-pqcd-logo em{font:italic 400 0.875rem/1 ${SERIF};color:#A3472A}
.fd-pqcd-nav{display:flex;gap:28px}
.fd-pqcd-nav a,.fd-pqcd-book{font:400 13px/1 ${SANS};letter-spacing:.06em;color:#23201A;text-decoration:none}
.fd-pqcd-nav a:hover{text-decoration:underline;text-underline-offset:4px}
.fd-pqcd-book{display:inline-flex;align-items:center;height:36px;padding:0 16px;border:1px solid #23201A;border-radius:9999px}
.fd-pqcd-book:hover{background:#23201A;color:#EFE9DE}
.fd-pqcd a:focus-visible{outline:2px solid rgba(163,71,42,.7);outline-offset:2px}
@media (max-width:820px){.fd-pqcd-bar{padding:0 16px}.fd-pqcd-nav{display:none}}
`;
