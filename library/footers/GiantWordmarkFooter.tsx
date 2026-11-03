/**
 * GiantWordmarkFooter, a dark agency footer: a new-business pitch with a big
 * email, three sitemap columns and a studio address, closed by a wordmark that
 * spans the full width exactly. The wordmark is fitted by measuring the text
 * at a reference size and scaling (re-fitted on resize), then each letter
 * rises out of a mask, staggered, when the footer scrolls into view. Letters
 * nudge up and take the signal colour on hover.
 *
 * Props: wordmark, pitch, contacts, columns, address, legal, tagline.
 * CSS vars on the root: --fd-gwf-bg, --fd-gwf-fg, --fd-gwf-signal.
 *
 * Browser support: all evergreen browsers (ResizeObserver, IntersectionObserver).
 * Accessibility: the wordmark is one heading with an aria-label; the per-letter
 * spans are aria-hidden. Links have visible focus rings. Reduced motion shows
 * the wordmark immediately without the rise or the hover nudge.
 * SSR: renders with a vw-based fallback size; fitting happens in an effect.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface GwfLink { label: string; href: string; note?: string }
export interface GwfColumn { title: string; links: GwfLink[] }
export interface GwfContact { label: string; name: string; email: string; phone?: string }

export interface GiantWordmarkFooterProps {
  wordmark?: string;
  pitch?: [string, string];
  contacts?: GwfContact[];
  columns?: GwfColumn[];
  address?: string[];
  legal?: string[];
  tagline?: string;
  className?: string;
}

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

const DEFAULT_COLUMNS: GwfColumn[] = [
  {
    title: "Work",
    links: [
      { label: "Brightwater Ferries", href: "#", note: "Identity" },
      { label: "Common Loaf", href: "#", note: "Packaging" },
      { label: "Tidal Records", href: "#", note: "Motion" },
      { label: "Northbank Opera", href: "#", note: "Season" },
      { label: "All projects", href: "#", note: "48" },
    ],
  },
  {
    title: "Studio",
    links: [
      { label: "About", href: "#" },
      { label: "People", href: "#", note: "19" },
      { label: "Jobs", href: "#", note: "2 open" },
      { label: "Notes", href: "#" },
    ],
  },
  {
    title: "Elsewhere",
    links: [
      { label: "Instagram", href: "#" },
      { label: "Are.na", href: "#" },
      { label: "Vimeo", href: "#" },
      { label: "LinkedIn", href: "#" },
    ],
  },
];

const DEFAULT_CONTACTS: GwfContact[] = [
  { label: "New work", name: "Priya Raman", email: "priya@oddweather.studio", phone: "+44 20 7946 0321" },
  { label: "Press, talks, students", name: "Tom Achterberg", email: "hello@oddweather.studio" },
];

export function GiantWordmarkFooter({
  wordmark = "Odd Weather",
  pitch = ["Got a strange brief?", "Good. Send it over."],
  contacts = DEFAULT_CONTACTS,
  columns = DEFAULT_COLUMNS,
  address = ["Unit 7, 41 Hackney Road", "London E2 7NX"],
  legal = ["© 2026 Odd Weather Ltd.", "Company no. 11290473", "Privacy"],
  tagline = "Mostly sunny. Occasionally odd.",
  className,
}: GiantWordmarkFooterProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const markRef = useRef<HTMLHeadingElement>(null);
  const [size, setSize] = useState<number | null>(null);
  const [shown, setShown] = useState(false);
  const letters = Array.from(wordmark);

  useIso(() => {
    const box = boxRef.current, probe = probeRef.current;
    if (!box || !probe) return;
    const fit = () => {
      const w = probe.getBoundingClientRect().width; // measured at 100px
      const avail = box.clientWidth;
      if (w > 0 && avail > 0) setSize(Math.floor((avail / w) * 100 * 100) / 100);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [wordmark]);

  useEffect(() => {
    const el = markRef.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <footer className={`fd-gwf${className ? " " + className : ""}`}>
      <style>{css}</style>
      <div className="fd-gwf-in">
        <div className="fd-gwf-top">
          <div className="fd-gwf-pitch">
            <p className="fd-gwf-kicker"><span aria-hidden="true">●</span> Taking on two projects for spring 2027</p>
            <h2 className="fd-gwf-h">
              <span>{pitch[0]}</span>
              <span className="fd-gwf-h2">{pitch[1]}</span>
            </h2>
            {contacts[0] && (
              <a className="fd-gwf-big" href={`mailto:${contacts[0].email}`}>
                <span>{contacts[0].email}</span>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M7 21L21 7M10 7h11v11" /></svg>
              </a>
            )}
          </div>
          <nav className="fd-gwf-cols" aria-label="Footer">
            {columns.map((c) => (
              <div className="fd-gwf-col" key={c.title}>
                <h3 className="fd-gwf-lab">{c.title}</h3>
                <ul className="fd-gwf-list">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <a className="fd-gwf-a" href={l.href}><span>{l.label}</span></a>
                      {l.note && <span className="fd-gwf-note">{l.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="fd-gwf-mid">
          {contacts.map((c, i) => (
            <div className="fd-gwf-cell" key={c.email}>
              <p className="fd-gwf-lab">{c.label}</p>
              <p className="fd-gwf-txt">{c.name}</p>
              {i > 0 && <a className="fd-gwf-a fd-gwf-txt" href={`mailto:${c.email}`}><span>{c.email}</span></a>}
              {c.phone && <a className="fd-gwf-a fd-gwf-txt" href={`tel:${c.phone.replace(/\s/g, "")}`}><span>{c.phone}</span></a>}
            </div>
          ))}
          <div className="fd-gwf-cell">
            <p className="fd-gwf-lab">Studio</p>
            {address.map((l) => <p className="fd-gwf-txt" key={l}>{l}</p>)}
            <a className="fd-gwf-a fd-gwf-txt" href="#"><span>Directions</span></a>
          </div>
        </div>

        <div className="fd-gwf-box" ref={boxRef}>
          <span className="fd-gwf-probe" ref={probeRef} aria-hidden="true">
            {letters.map((ch, i) => <span key={i} data-last={i === letters.length - 1 ? "" : undefined}>{ch === " " ? "\u00A0" : ch}</span>)}
          </span>
          <h2
            ref={markRef}
            className="fd-gwf-mark"
            data-in={shown ? "" : undefined}
            aria-label={wordmark}
            style={size ? { fontSize: `${size}px` } : undefined}
          >
            {letters.map((ch, i) => (
              <span className="fd-gwf-cl" key={i} aria-hidden="true">
                <span
                  className="fd-gwf-ch"
                  data-last={i === letters.length - 1 ? "" : undefined}
                  style={{ transitionDelay: shown ? `${i * 48}ms` : "0ms" }}
                >{ch === " " ? " " : ch}</span>
              </span>
            ))}
          </h2>
        </div>

        <div className="fd-gwf-legal">
          <ul className="fd-gwf-ll">
            {legal.map((l) => <li key={l}>{l === "Privacy" ? <a className="fd-gwf-a" href="#"><span>{l}</span></a> : l}</li>)}
          </ul>
          <p>{tagline}</p>
        </div>
      </div>
    </footer>
  );
}

const SANS = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const MONO = `ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace`;

const css = `
:where(.fd-gwf,.fd-gwf *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-gwf,.fd-gwf *)::before,:where(.fd-gwf,.fd-gwf *)::after{box-sizing:border-box}
:where(.fd-gwf svg){display:block;flex-shrink:0}
.fd-gwf{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-gwf-bg:#0F0F0D;--fd-gwf-fg:#ECEAE3;--fd-gwf-mut:#8C8A82;--fd-gwf-line:rgba(236,234,227,.14);--fd-gwf-signal:#D7FF3B;
  display:block;width:100%;background:var(--fd-gwf-bg);color:var(--fd-gwf-fg);
  font:400 15px/22px ${SANS};letter-spacing:-.005em;-webkit-font-smoothing:antialiased;overflow:hidden}
.fd-gwf-in{padding:clamp(56px,7vw,96px) clamp(16px,3.4vw,48px) 0}
.fd-gwf-top{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:48px clamp(32px,6vw,96px);padding-bottom:56px}
.fd-gwf-kicker{display:flex;align-items:center;gap:10px;font:500 12px/16px ${MONO};letter-spacing:.02em;color:var(--fd-gwf-mut)}
.fd-gwf-kicker span{color:var(--fd-gwf-signal);font-size:9px;line-height:16px;animation:fd-gwf-blink 2.4s steps(1) infinite}
@keyframes fd-gwf-blink{50%{opacity:.25}}
.fd-gwf-h{margin-top:20px;font:800 clamp(2.25rem,4.6vw,4rem)/.98 ${SANS};letter-spacing:-.045em}
.fd-gwf-h span{display:block}
.fd-gwf-h2{color:var(--fd-gwf-mut)}
.fd-gwf-big{display:inline-flex;align-items:center;gap:14px;margin-top:32px;padding-bottom:6px;font:600 clamp(1.25rem,2.2vw,1.75rem)/1.2 ${SANS};letter-spacing:-.02em;color:var(--fd-gwf-fg);box-shadow:inset 0 -2px 0 var(--fd-gwf-signal);transition:color var(--fd-dur-2) var(--fd-ease-out);max-width:100%}
.fd-gwf-big span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fd-gwf-big svg{transition:transform var(--fd-dur-3) var(--fd-spring)}
.fd-gwf-big:hover{color:var(--fd-gwf-signal)}
.fd-gwf-big:hover svg{transform:translate(4px,-4px) rotate(45deg)}
.fd-gwf-cols{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:32px;align-content:start}
.fd-gwf-lab{font:500 11px/16px ${MONO};letter-spacing:.08em;text-transform:uppercase;color:var(--fd-gwf-mut)}
.fd-gwf-list{margin-top:16px;display:grid;gap:8px}
.fd-gwf-list li{display:flex;align-items:baseline;gap:8px;min-width:0}
.fd-gwf-note{font:400 11px/16px ${MONO};color:var(--fd-gwf-mut);white-space:nowrap}
.fd-gwf-a{position:relative;display:inline-block;color:var(--fd-gwf-fg);border-radius:2px;outline:0}
.fd-gwf-a span{background:linear-gradient(var(--fd-gwf-signal),var(--fd-gwf-signal)) 0 100%/0 1px no-repeat;transition:background-size var(--fd-dur-3) var(--fd-ease-out),color var(--fd-dur-1)}
.fd-gwf-a:hover span{background-size:100% 1px;color:var(--fd-gwf-signal)}
.fd-gwf-a:focus-visible,.fd-gwf-big:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-gwf-signal) 70%,transparent);outline-offset:2px}
.fd-gwf-mid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;padding:28px 0 32px;border-top:1px solid var(--fd-gwf-line)}
.fd-gwf-cell{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0}
.fd-gwf-cell .fd-gwf-lab{margin-bottom:10px}
.fd-gwf-txt{font:400 15px/22px ${SANS};color:var(--fd-gwf-fg);max-width:100%;overflow-wrap:anywhere}
.fd-gwf-box{position:relative;width:100%;padding:8px 0 clamp(8px,1.2vw,18px)}
.fd-gwf-probe{position:absolute;left:0;top:0;display:inline-flex;visibility:hidden;white-space:pre;pointer-events:none;font:800 100px/1 ${SANS};letter-spacing:-.06em}
.fd-gwf-probe span{display:block}.fd-gwf-probe span[data-last]{letter-spacing:0}
.fd-gwf-mark{display:flex;white-space:pre;font:800 18.6vw/.82 ${SANS};letter-spacing:-.06em;color:var(--fd-gwf-fg);user-select:none}
.fd-gwf-cl{display:block;overflow:hidden;padding:.14em 0 .02em;margin:-.14em 0 -.02em}
.fd-gwf-ch{display:block;transform:translateY(102%) rotate(6deg);transform-origin:0 100%;transition:transform var(--fd-dur-4) var(--fd-ease-out),color var(--fd-dur-2) var(--fd-ease-out)}
.fd-gwf-ch[data-last]{letter-spacing:0}
.fd-gwf-mark[data-in] .fd-gwf-ch{transform:none}
@media (hover:hover){
  .fd-gwf-mark[data-in] .fd-gwf-cl:hover .fd-gwf-ch{transform:translateY(-5%);color:var(--fd-gwf-signal);transition:transform var(--fd-dur-3) var(--fd-spring),color var(--fd-dur-1);transition-delay:0ms!important}
}
.fd-gwf-legal{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:20px 0 24px;border-top:1px solid var(--fd-gwf-line);font:400 12px/16px ${MONO};color:var(--fd-gwf-mut)}
.fd-gwf-ll{display:flex;flex-wrap:wrap;gap:6px 24px}
.fd-gwf-legal .fd-gwf-a{color:var(--fd-gwf-mut)}
@media (max-width:900px){
  .fd-gwf-top{grid-template-columns:1fr}
}
@media (max-width:640px){
  .fd-gwf-cols{grid-template-columns:1fr 1fr}
  .fd-gwf-cols .fd-gwf-col:first-child{grid-column:1/-1}
  .fd-gwf-mid{grid-template-columns:1fr;gap:28px}
  .fd-gwf-legal{flex-direction:column;align-items:flex-start}
}
@media (prefers-reduced-motion:reduce){
  .fd-gwf-ch{transform:none!important;transition:color var(--fd-dur-1)!important}
  .fd-gwf-kicker span{animation:none}
  .fd-gwf *{transition-duration:1ms}
}
@media (prefers-contrast:more){.fd-gwf{--fd-gwf-mut:#C9C7BF;--fd-gwf-line:rgba(236,234,227,.5)}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

export function Demo() {
  return (
    <div className="fd-gwfd">
      <style>{demoCss}</style>
      <section className="fd-gwfd-end" aria-label="End of case study">
        <div className="fd-gwfd-credits">
          <p className="fd-gwfd-k">Credits</p>
          <p>Creative direction, Priya Raman. Type and motion, Jonas Ek, Ama Owusu. Photography, Leon Brandt. Built with the ferry crews of Brightwater, 2025 to 2026.</p>
        </div>
        <a className="fd-gwfd-next" href="#">
          <span className="fd-gwfd-k">Next case, 06 of 48</span>
          <span className="fd-gwfd-t">Tidal Records</span>
          <span className="fd-gwfd-s">A label that sounds like the sea, and now looks like it too.</span>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 20h24M22 10l10 10-10 10" /></svg>
        </a>
      </section>
      <GiantWordmarkFooter />
    </div>
  );
}

const demoCss = `
:where(.fd-gwfd,.fd-gwfd *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none}
:where(.fd-gwfd svg){display:block}
.fd-gwfd{min-height:100vh;background:#0F0F0D;color:#ECEAE3;font:400 15px/22px ${SANS};-webkit-font-smoothing:antialiased}
.fd-gwfd-end{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:32px;padding:56px clamp(16px,3.4vw,48px) 0}
.fd-gwfd-k{display:block;font:500 11px/16px ${MONO};letter-spacing:.08em;text-transform:uppercase;color:#8C8A82}
.fd-gwfd-credits p:last-child{margin-top:12px;max-width:380px;color:#B9B7AF;font-size:14px;line-height:21px}
.fd-gwfd-next{position:relative;display:block;padding:24px 72px 28px 0;border-top:1px solid rgba(236,234,227,.14);border-bottom:1px solid rgba(236,234,227,.14);border-radius:2px;outline:0}
.fd-gwfd-next:focus-visible{outline:2px solid rgba(215,255,59,.7);outline-offset:2px}
.fd-gwfd-t{display:block;margin-top:8px;font:800 clamp(2rem,4vw,3.5rem)/1 ${SANS};letter-spacing:-.04em;transition:color 240ms cubic-bezier(.22,1,.36,1)}
.fd-gwfd-s{display:block;margin-top:10px;color:#8C8A82}
.fd-gwfd-next svg{position:absolute;right:0;top:50%;margin-top:-20px;transition:transform 420ms cubic-bezier(.34,1.56,.64,1)}
.fd-gwfd-next:hover .fd-gwfd-t{color:#D7FF3B}
.fd-gwfd-next:hover svg{transform:translateX(8px)}
@media (max-width:760px){.fd-gwfd-end{grid-template-columns:1fr}}
`;
