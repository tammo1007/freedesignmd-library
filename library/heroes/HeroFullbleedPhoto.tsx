/**
 * HeroFullbleedPhoto: a magazine-cover hero for a literary quarterly of
 * private letters and family archives. A full-bleed photograph "develops" in
 * from an overexposed sepia print, then drifts in a slow Ken Burns. The
 * masthead is set letter by letter, the headline arrives line by line, a
 * disciplined text block sits in the lower left, cover lines with page
 * numbers in the lower right and a vertical mono caption runs up the edge.
 *
 * Props: src, alt, masthead, issue, kicker, titleLines, dek, availability,
 * coverLines, caption, nav, primaryCta, secondaryCta.
 * CSS vars: --fd-fbp-paper, --fd-fbp-ink, --fd-fbp-accent.
 *
 * Browser support: all evergreen browsers (writing-mode for the caption).
 * Motion: CSS only. Print develop (700ms), staggered masthead letters and
 * headline lines (700ms each), then a 32s Ken Burns drift.
 * prefers-reduced-motion removes all of it: the photo and type are shown still.
 * Accessibility: the photo has alt text, the masthead letters are aria-hidden
 * with the name on the brand link, the mobile menu is a disclosure button with
 * aria-expanded and closes on Escape. Text sits on a scrim that keeps
 * contrast above 4.5:1.
 */
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface HeroFullbleedPhotoProps {
  src?: string;
  alt?: string;
  masthead?: string;
  issue?: string;
  kicker?: string;
  titleLines?: ReactNode[];
  dek?: ReactNode;
  availability?: ReactNode;
  coverLines?: { n: string; text: string; href: string }[];
  caption?: string[];
  nav?: { label: string; href: string }[];
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

const DEFAULT_NAV = [
  { label: "Current issue", href: "#issue" },
  { label: "The archive", href: "#archive" },
  { label: "Send us letters", href: "#submit" },
  { label: "Stockists", href: "#stockists" },
];

const DEFAULT_LINES = [
  { n: "p. 14", text: "Her recipe for panisse, in her hand, with two crossings-out", href: "#panisse" },
  { n: "p. 52", text: "Who is the man in the third photograph? Readers wrote in", href: "#photograph" },
  { n: "p. 96", text: "How to read cursive from 1929: a short, patient guide", href: "#cursive" },
];

const DEFAULT_CAPTION = ["43°17′47″N 5°22′49″E", "Rue d'Aubagne, Marseille", "Notebook 2, p. 41", "Ferrand family archive"];

export function HeroFullbleedPhoto({
  src = "/img/halcyon/journals.webp",
  alt = "Open handwritten notebooks and old black and white family photographs spread across a rust and sand coloured table",
  masthead = "Recto",
  issue = "No. 11, Winter 2026",
  kicker = "A quarterly of private letters",
  titleLines = [
    "Four notebooks,",
    "one Marseille kitchen,",
    <em key="e">1928 to 1931.</em>,
  ],
  dek = "Odette Ferrand wrote to her daughter every Sunday for three years. We transcribed all 212 pages, translated them, and then went looking for the house.",
  availability = (
    <>
      Ships <b>Fri 20 Nov</b>, 148 pages, €18 an issue or €64 for four
    </>
  ),
  coverLines = DEFAULT_LINES,
  caption = DEFAULT_CAPTION,
  nav = DEFAULT_NAV,
  primaryCta = { label: "Subscribe, four issues", href: "#subscribe" },
  secondaryCta = { label: "Read the first letter", href: "#letter" },
}: HeroFullbleedPhotoProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <section className="fd-fbp" aria-label={`${masthead}, ${issue}`}>
      <style>{css}</style>
      <div className="fd-fbp-photo">
        <img className="fd-fbp-img" src={src} alt={alt} width={1024} height={1024} />
        <div className="fd-fbp-scrim" aria-hidden="true" />
      </div>

      <header className="fd-fbp-nav">
        <a className="fd-fbp-brand" href="#top" aria-label={`${masthead}, home`}>
          <svg className="fd-fbp-stamp" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
            <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="20" cy="20" r="13.5" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 2" />
            <path d="M6 17 H34 M6 23 H34" stroke="currentColor" strokeWidth="0.8" />
            <text x="20" y="21.6" textAnchor="middle" className="fd-fbp-stamp-t">R</text>
          </svg>
          <span className="fd-fbp-issue">{issue}</span>
        </a>
        <nav className={`fd-fbp-links${open ? " is-open" : ""}`} id="fd-fbp-menu" aria-label="Primary">
          {nav.map((l) => (
            <a key={l.href} className="fd-fbp-link" href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a className="fd-fbp-reserve" href={primaryCta.href} onClick={() => setOpen(false)}>Subscribe</a>
        </nav>
        <button
          type="button"
          className="fd-fbp-burger"
          aria-expanded={open}
          aria-controls="fd-fbp-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="fd-fbp-burger-lines" aria-hidden="true" />
          {open ? "Close" : "Menu"}
        </button>
      </header>

      <p className="fd-fbp-masthead" aria-hidden="true">
        {Array.from(masthead).map((ch, i) => (
          <span key={i} className="fd-fbp-ml" style={{ "--fd-fbp-i": i } as CSSProperties}>{ch}</span>
        ))}
      </p>

      <div className="fd-fbp-block">
        <p className="fd-fbp-kicker">
          <span className="fd-fbp-rule" aria-hidden="true" />
          {kicker}
        </p>
        <h1 className="fd-fbp-title">
          {titleLines.map((line, i) => (
            <span key={i} className="fd-fbp-tl" style={{ "--fd-fbp-i": i } as CSSProperties}>
              <span className="fd-fbp-tl-in">{line}</span>
            </span>
          ))}
        </h1>
        <p className="fd-fbp-dek">{dek}</p>
        <div className="fd-fbp-ctas">
          <a className="fd-fbp-btn" href={primaryCta.href}>
            {primaryCta.label}
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          </a>
          <a className="fd-fbp-text" href={secondaryCta.href}>{secondaryCta.label}</a>
        </div>
        <p className="fd-fbp-avail">
          <span className="fd-fbp-live" aria-hidden="true" />
          <span>{availability}</span>
        </p>
      </div>

      <ol className="fd-fbp-lines" aria-label="In this issue">
        {coverLines.map((l) => (
          <li key={l.n} className="fd-fbp-line">
            <a href={l.href} className="fd-fbp-line-a">
              <span className="fd-fbp-line-n">{l.n}</span>
              <span className="fd-fbp-line-t">{l.text}</span>
            </a>
          </li>
        ))}
      </ol>

      <p className="fd-fbp-caption">
        {caption.map((c, i) => (
          <span key={i} className="fd-fbp-cap">{c}</span>
        ))}
      </p>
    </section>
  );
}

const css = `
.fd-fbp, .fd-fbp *, .fd-fbp *::before, .fd-fbp *::after { box-sizing: border-box; }
.fd-fbp :where(h1, p, a, ol, li, em, b, span, div, nav, header, button, img, svg) {
  margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit;
  letter-spacing: inherit; text-decoration: none; list-style: none;
}
.fd-fbp {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-fbp-paper: #F4ECDD;
  --fd-fbp-ink: #1A1410;
  --fd-fbp-accent: #B9CAF0;
  --fd-fbp-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --fd-fbp-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  --fd-fbp-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
  position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 360px) 56px;
  grid-template-rows: auto auto 1fr auto; column-gap: 40px;
  min-height: 880px; margin: 0; padding: 0 0 48px 48px; overflow: hidden; isolation: isolate;
  background: var(--fd-fbp-ink); color: var(--fd-fbp-paper); font: 400 15px/1.45 var(--fd-fbp-sans);
}

/* photo */
.fd-fbp-photo { position: absolute; inset: 0; z-index: -1; overflow: hidden; background: #3A2A20; }
.fd-fbp-img {
  display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 62%;
  transform-origin: 30% 70%; transform: scale(1.04);
  animation:
    fd-fbp-develop var(--fd-dur-4) var(--fd-ease-out) 0.1s both,
    fd-fbp-burns 32s var(--fd-ease-in-out) 1.2s infinite alternate;
}
@keyframes fd-fbp-develop {
  from { filter: sepia(1) brightness(1.9) contrast(0.45) blur(3px); }
  to { filter: none; }
}
@keyframes fd-fbp-burns {
  from { transform: scale(1.04) translate3d(0, 0, 0); }
  to { transform: scale(1.16) translate3d(1.4%, -1.6%, 0); }
}
.fd-fbp-scrim {
  position: absolute; inset: 0;
  background:
    linear-gradient(180deg, rgba(20,14,10,0.78) 0%, rgba(20,14,10,0.35) 30%, rgba(20,14,10,0.2) 45%),
    linear-gradient(0deg, rgba(20,14,10,0.92) 0%, rgba(20,14,10,0.72) 34%, rgba(20,14,10,0) 66%),
    linear-gradient(90deg, rgba(20,14,10,0.7) 0%, rgba(20,14,10,0.35) 40%, rgba(20,14,10,0) 60%),
    radial-gradient(60% 50% at 88% 100%, rgba(20,14,10,0.75) 0%, rgba(20,14,10,0) 100%);
}

/* nav */
.fd-fbp-nav {
  grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 24px;
  padding: 22px 48px 0 0; position: relative; z-index: 4;
}
.fd-fbp-brand { display: inline-flex; align-items: center; gap: 14px; color: var(--fd-fbp-paper); }
.fd-fbp-stamp { display: block; transform: rotate(-12deg); }
.fd-fbp-stamp-t { font: italic 400 15px/1 var(--fd-fbp-serif); fill: currentColor; dominant-baseline: middle; }
.fd-fbp-issue { font: 400 11px/1 var(--fd-fbp-mono); letter-spacing: 0.08em; text-transform: uppercase; padding-left: 14px; border-left: 1px solid rgba(244,236,221,0.5); }
.fd-fbp-links { display: flex; align-items: center; gap: 30px; }
.fd-fbp-link { position: relative; font: 400 15px/1.2 var(--fd-fbp-sans); color: var(--fd-fbp-paper); }
.fd-fbp-link::after { content: ""; position: absolute; left: 0; right: 0; bottom: -5px; height: 1px; background: currentColor; transform: scaleX(0); transform-origin: left; transition: transform var(--fd-dur-2) var(--fd-ease-out); }
.fd-fbp-link:hover::after { transform: scaleX(1); }
.fd-fbp-reserve { font: 500 14px/1 var(--fd-fbp-sans); padding: 11px 18px; border-radius: 9999px; border: 1px solid rgba(244,236,221,0.7); color: var(--fd-fbp-paper); transition: background var(--fd-dur-1), color var(--fd-dur-1); }
.fd-fbp-reserve:hover { background: var(--fd-fbp-paper); color: var(--fd-fbp-ink); }
.fd-fbp-burger { display: none; appearance: none; cursor: pointer; align-items: center; gap: 10px; color: var(--fd-fbp-paper); font: 500 13px/1 var(--fd-fbp-mono); letter-spacing: 0.06em; text-transform: uppercase; padding: 8px 0; background: none; border: 0; }
.fd-fbp-burger-lines { position: relative; display: block; width: 20px; height: 7px; border-top: 1px solid currentColor; border-bottom: 1px solid currentColor; }

/* masthead, set letter by letter */
.fd-fbp-masthead {
  grid-column: 1 / 3; grid-row: 2; display: flex; margin: 4px 0 0 -0.05em;
  font: italic 400 clamp(6rem, 19vw, 18rem)/0.84 var(--fd-fbp-serif);
  letter-spacing: -0.045em; color: var(--fd-fbp-paper);
}
.fd-fbp-ml {
  display: inline-block; padding-right: 0.02em;
  animation: fd-fbp-set var(--fd-dur-4) var(--fd-ease-out) both;
  animation-delay: calc(0.35s + var(--fd-fbp-i) * 90ms);
}
@keyframes fd-fbp-set {
  from { opacity: 0; transform: translateY(0.18em) rotate(-4deg); clip-path: inset(0 0 100% 0); }
  to { opacity: 1; transform: none; clip-path: inset(-20% -20% -20% -20%); }
}

/* block */
.fd-fbp-block { grid-column: 1; grid-row: 4; align-self: end; max-width: 620px; }
.fd-fbp-kicker { display: flex; align-items: center; gap: 12px; font: 400 12px/1.2 var(--fd-fbp-mono); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 20px; }
.fd-fbp-rule { width: 32px; height: 1px; background: var(--fd-fbp-accent); display: block; }
.fd-fbp-title { display: flex; flex-direction: column; font: 400 clamp(2.375rem, 4vw, 3.625rem)/1.02 var(--fd-fbp-serif); white-space: nowrap; letter-spacing: -0.025em; color: var(--fd-fbp-paper); }
.fd-fbp-tl { display: block; overflow: hidden; padding-bottom: 0.06em; margin-bottom: -0.06em; }
.fd-fbp-tl-in { display: block; animation: fd-fbp-line var(--fd-dur-4) var(--fd-ease-out) both; animation-delay: calc(0.8s + var(--fd-fbp-i) * 110ms); }
@keyframes fd-fbp-line { from { transform: translateY(105%); } to { transform: none; } }
.fd-fbp-title em { font-style: italic; color: var(--fd-fbp-accent); }
.fd-fbp-dek { margin-top: 20px; max-width: 46ch; font: 400 16px/1.5 var(--fd-fbp-sans); color: rgba(244,236,221,0.88); }
.fd-fbp-ctas { display: flex; align-items: center; gap: 24px; margin-top: 28px; flex-wrap: wrap; }
.fd-fbp-btn {
  display: inline-flex; align-items: center; gap: 12px; height: 50px; padding: 0 24px; border-radius: 9999px;
  background: var(--fd-fbp-paper); color: var(--fd-fbp-ink); font: 600 15px/1 var(--fd-fbp-sans);
  transition: background var(--fd-dur-1), transform var(--fd-dur-2) var(--fd-spring);
}
.fd-fbp-btn svg { display: block; transition: transform var(--fd-dur-2) var(--fd-ease-out); }
.fd-fbp-btn:hover { background: #FFFFFF; }
.fd-fbp-btn:hover svg { transform: translateX(3px); }
.fd-fbp-btn:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-fbp-text { font: 500 15px/1.2 var(--fd-fbp-sans); color: var(--fd-fbp-paper); border-bottom: 1px solid rgba(244,236,221,0.5); padding-bottom: 3px; transition: border-color var(--fd-dur-1); }
.fd-fbp-text:hover { border-color: var(--fd-fbp-paper); }
.fd-fbp-avail { display: flex; align-items: baseline; gap: 10px; margin-top: 26px; padding-top: 14px; border-top: 1px solid rgba(244,236,221,0.28); font: 400 12px/1.5 var(--fd-fbp-mono); color: rgba(244,236,221,0.82); }
.fd-fbp-avail b { font-weight: 700; color: var(--fd-fbp-paper); }
.fd-fbp-live { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--fd-fbp-accent); display: block; transform: translateY(-1px); }

/* cover lines */
.fd-fbp-lines { grid-column: 2; grid-row: 4; align-self: end; display: flex; flex-direction: column; border-top: 1px solid rgba(244,236,221,0.5); }
.fd-fbp-line { border-bottom: 1px solid rgba(244,236,221,0.28); }
.fd-fbp-line-a { display: grid; grid-template-columns: 52px 1fr; gap: 12px; padding: 14px 0; color: var(--fd-fbp-paper); }
.fd-fbp-line-n { font: 400 11px/1.6 var(--fd-fbp-mono); color: var(--fd-fbp-accent); letter-spacing: 0.04em; }
.fd-fbp-line-t { font: 400 17px/1.3 var(--fd-fbp-serif); letter-spacing: -0.005em; transition: transform var(--fd-dur-2) var(--fd-ease-out); }
.fd-fbp-line-a:hover .fd-fbp-line-t { transform: translateX(4px); }

/* vertical caption */
.fd-fbp-caption {
  grid-column: 3; grid-row: 2 / 5; justify-self: center; align-self: end;
  writing-mode: vertical-rl; display: flex; gap: 22px; padding: 0;
  font: 400 11px/1 var(--fd-fbp-mono); letter-spacing: 0.12em; text-transform: uppercase; color: rgba(244,236,221,0.9);
}
.fd-fbp-cap { display: block; white-space: nowrap; }
.fd-fbp-cap + .fd-fbp-cap { padding-top: 22px; border-top: 1px solid rgba(244,236,221,0.45); }

.fd-fbp :focus-visible { outline: 2px solid var(--fd-fbp-paper); outline-offset: 3px; border-radius: 2px; }

@media (max-width: 1080px) {
  .fd-fbp { grid-template-columns: minmax(0, 1fr) 40px; }
  .fd-fbp-lines { display: none; }
  .fd-fbp-caption { grid-column: 2; }
}
@media (max-width: 760px) {
  .fd-fbp { grid-template-columns: minmax(0, 1fr) 28px; column-gap: 12px; padding: 0 0 28px 20px; min-height: 844px; }
  .fd-fbp-nav { padding: 16px 20px 0 0; }
  .fd-fbp-burger { display: inline-flex; }
  .fd-fbp-links {
    display: none; position: absolute; top: 100%; left: -20px; right: 0; margin-top: 12px; z-index: 5;
    flex-direction: column; align-items: stretch; gap: 0; padding: 8px 20px 20px;
    background: var(--fd-fbp-paper); color: var(--fd-fbp-ink);
  }
  .fd-fbp-links.is-open { display: flex; }
  .fd-fbp-link { color: var(--fd-fbp-ink); font: 400 26px/1.1 var(--fd-fbp-serif); padding: 14px 0; border-bottom: 1px solid rgba(26,20,16,0.15); }
  .fd-fbp-link::after { display: none; }
  .fd-fbp-reserve { margin-top: 16px; text-align: center; padding: 16px; background: var(--fd-fbp-ink); color: var(--fd-fbp-paper); border-color: var(--fd-fbp-ink); }
  .fd-fbp-masthead { grid-column: 1 / -1; font-size: 38vw; margin-top: 14px; }
  .fd-fbp-caption { grid-row: 3 / 5; }
  .fd-fbp-img { object-position: 40% 60%; }
  .fd-fbp-title { font-size: 2.125rem; }
  .fd-fbp-dek { font-size: 15px; }
  .fd-fbp-ctas { gap: 18px; }
  .fd-fbp-caption { font-size: 10px; gap: 16px; }
  .fd-fbp-cap + .fd-fbp-cap { padding-top: 16px; }
  .fd-fbp-cap:nth-child(n + 3) { display: none; }
  .fd-fbp-scrim {
    background:
      linear-gradient(180deg, rgba(20,14,10,0.78) 0%, rgba(20,14,10,0.3) 34%),
      linear-gradient(0deg, rgba(20,14,10,0.96) 0%, rgba(20,14,10,0.86) 50%, rgba(20,14,10,0.3) 68%, rgba(20,14,10,0) 78%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .fd-fbp-img { animation: none; transform: scale(1.04); filter: none; }
  .fd-fbp-ml, .fd-fbp-tl-in { animation: none; }
  .fd-fbp-link::after, .fd-fbp-btn, .fd-fbp-btn svg, .fd-fbp-line-t { transition: none; }
}
`;

export function Demo() {
  return <HeroFullbleedPhoto />;
}
