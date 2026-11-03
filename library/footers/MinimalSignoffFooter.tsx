/**
 * MinimalSignoffFooter, a one-line sign-off for a photographer's portfolio.
 * Name and practice, an email that copies itself to the clipboard with a
 * small "copied" toast, the local time in the studio's city, and a
 * back-to-top button whose ring fills as you scroll down the page and which
 * scrolls home smoothly.
 *
 * Props: name, practice, email, city, timeZone, note.
 * CSS vars: --fd-msf-bg, --fd-msf-fg, --fd-msf-mut.
 *
 * Browser support: all evergreen browsers. Clipboard uses
 * navigator.clipboard.writeText with an execCommand("copy") fallback.
 * SSR: time renders as a placeholder and fills in after mount; the ring
 * starts empty. Time refreshes on each minute boundary.
 * Accessibility: the email is a button (the address is its label, a
 * mailto link sits beside it for keyboard and screen-reader users); the toast
 * is a polite live region. Back-to-top has an aria-label and moves focus to
 * the top of the document. Reduced motion jumps instead of smooth-scrolling.
 */
import { useEffect, useRef, useState } from "react";

export interface MinimalSignoffFooterProps {
  name?: string;
  practice?: string;
  email?: string;
  city?: string;
  timeZone?: string;
  note?: string;
  className?: string;
}

export function MinimalSignoffFooter({
  name = "Ilse Varga",
  practice = "Still life and interiors",
  email = "studio@ilsevarga.com",
  city = "Lisbon",
  timeZone = "Europe/Lisbon",
  note = "© 2026",
  className,
}: MinimalSignoffFooterProps) {
  const [time, setTime] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ringRef = useRef<SVGCircleElement>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const n = Date.now();
      setTime(fmt.format(new Date(n)));
      t = setTimeout(tick, 60000 - (n % 60000) + 30);
    };
    tick();
    return () => clearTimeout(t);
  }, [timeZone]);

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      ring.style.strokeDashoffset = String(100 - p * 100);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => () => clearTimeout(toastT.current), []);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(email);
      ok = true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = email;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
    }
    if (!ok) { window.location.href = `mailto:${email}`; return; }
    setCopied(false);
    requestAnimationFrame(() => setCopied(true));
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setCopied(false), 1800);
  };

  const toTop = () => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    const first = document.querySelector<HTMLElement>("h1, [tabindex='-1'], main");
    if (first) { const had = first.hasAttribute("tabindex"); if (!had) first.setAttribute("tabindex", "-1"); first.focus({ preventScroll: true }); if (!had) first.addEventListener("blur", () => first.removeAttribute("tabindex"), { once: true }); }
  };

  return (
    <footer className={`fd-msf${className ? " " + className : ""}`}>
      <style>{css}</style>
      <div className="fd-msf-line">
        <p className="fd-msf-who"><b>{name}</b><span>{practice}</span></p>

        <div className="fd-msf-mail">
          <button type="button" className="fd-msf-copy" onClick={copy} aria-describedby={undefined}>
            <span className="fd-msf-addr">{email}</span>
            <span className="fd-msf-hint" aria-hidden="true">{copied ? "copied" : "copy"}</span>
          </button>
          <a className="fd-msf-sr" href={`mailto:${email}`}>Write to {email}</a>
          <span className="fd-msf-toast" role="status" aria-live="polite" data-on={copied ? "" : undefined}>
            {copied ? <><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2.5 6.3l2.2 2.2L9.5 3.7" /></svg>Address copied</> : ""}
          </span>
        </div>

        <p className="fd-msf-time">
          <span>{city}</span>
          <time data-pending={time ? undefined : ""}>{time ?? "00:00"}</time>
        </p>

        <p className="fd-msf-note">{note}</p>

        <button type="button" className="fd-msf-top" onClick={toTop} aria-label="Back to top">
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="18" className="fd-msf-track" />
            <circle ref={ringRef} cx="20" cy="20" r="18" pathLength={100} className="fd-msf-ring" transform="rotate(-90 20 20)" />
            <path d="M20 26V14M15 19l5-5 5 5" className="fd-msf-arrow" />
          </svg>
        </button>
      </div>
    </footer>
  );
}

const SERIF = `"New York",ui-serif,"Iowan Old Style",Georgia,serif`;
const SANS = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const MONO = `ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace`;

const css = `
:where(.fd-msf,.fd-msf *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none}
:where(.fd-msf,.fd-msf *)::before,:where(.fd-msf,.fd-msf *)::after{box-sizing:border-box}
:where(.fd-msf svg){display:block;flex-shrink:0}
:where(.fd-msf button){appearance:none;-webkit-appearance:none;border-radius:0;outline:0;cursor:pointer;text-align:inherit}
.fd-msf{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --fd-msf-bg:#121211;--fd-msf-fg:#E9E5DB;--fd-msf-mut:#88837A;--fd-msf-line:rgba(233,229,219,.12);
  display:block;width:100%;background:var(--fd-msf-bg);color:var(--fd-msf-fg);font:400 14px/20px ${SANS};letter-spacing:0;-webkit-font-smoothing:antialiased}
.fd-msf-line{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto auto;align-items:center;gap:16px 40px;padding:28px clamp(16px,3.4vw,48px);border-top:1px solid var(--fd-msf-line)}
.fd-msf-who{display:flex;align-items:baseline;gap:12px;min-width:0;white-space:nowrap}
.fd-msf-who b{font:italic 400 19px/24px ${SERIF};letter-spacing:-.01em;color:var(--fd-msf-fg)}
.fd-msf-who span{overflow:hidden;text-overflow:ellipsis;color:var(--fd-msf-mut)}
.fd-msf-mail{position:relative;justify-self:center}
.fd-msf-copy{position:relative;display:inline-flex;align-items:baseline;gap:10px;padding:6px 0;color:var(--fd-msf-fg);font:400 14px/20px ${SANS};border-radius:2px}
.fd-msf-addr{background:linear-gradient(currentColor,currentColor) 0 100%/100% 1px no-repeat;padding-bottom:2px;transition:background-size var(--fd-dur-3) var(--fd-ease-out)}
.fd-msf-copy:hover .fd-msf-addr{background-size:0 1px;background-position:100% 100%}
.fd-msf-hint{font:400 11px/16px ${MONO};color:var(--fd-msf-mut);opacity:0;transform:translateX(-4px);transition:opacity var(--fd-dur-2),transform var(--fd-dur-2) var(--fd-ease-out)}
.fd-msf-copy:hover .fd-msf-hint,.fd-msf-copy:focus-visible .fd-msf-hint{opacity:1;transform:none}
.fd-msf-copy:active{transform:scale(.98);transition:transform var(--fd-dur-1)}
.fd-msf-copy:focus-visible,.fd-msf-top:focus-visible{outline:2px solid rgba(233,229,219,.7);outline-offset:3px}
.fd-msf-toast{position:absolute;left:50%;bottom:calc(100% + 10px);display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:9999px;background:var(--fd-msf-fg);color:var(--fd-msf-bg);font:500 12px/1 ${SANS};white-space:nowrap;pointer-events:none;opacity:0;transform:translate(-50%,6px) scale(.94);transition:opacity var(--fd-dur-2),transform var(--fd-dur-3) var(--fd-spring)}
.fd-msf-toast:empty{padding:0}
.fd-msf-toast[data-on]{opacity:1;transform:translate(-50%,0) scale(1)}
.fd-msf-time{display:flex;align-items:baseline;gap:10px;justify-self:end;color:var(--fd-msf-mut);white-space:nowrap}
.fd-msf-time time{font:400 13px/20px ${MONO};font-variant-numeric:tabular-nums;color:var(--fd-msf-fg)}
.fd-msf-time time[data-pending]{opacity:.15}
.fd-msf-note{color:var(--fd-msf-mut);white-space:nowrap}
.fd-msf-top{display:grid;place-items:center;width:40px;height:40px;border-radius:9999px;color:var(--fd-msf-fg);transition:transform var(--fd-dur-2) var(--fd-spring)}
.fd-msf-top:active{transform:scale(.92);transition-duration:var(--fd-dur-1)}
.fd-msf-track{fill:none;stroke:var(--fd-msf-line);stroke-width:1}
.fd-msf-ring{fill:none;stroke:var(--fd-msf-fg);stroke-width:1.25;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100}
.fd-msf-arrow{fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;transition:transform var(--fd-dur-3) var(--fd-spring)}
.fd-msf-top:hover .fd-msf-arrow{transform:translateY(-2px)}
.fd-msf-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.fd-msf-sr:focus{position:static;width:auto;height:auto;clip:auto;display:block;margin-top:4px;font-size:12px;color:var(--fd-msf-mut)}
@media (max-width:860px){
  .fd-msf-line{grid-template-columns:minmax(0,1fr) auto;row-gap:18px}
  .fd-msf-who{grid-column:1/2}
  .fd-msf-time{grid-column:2;grid-row:1}
  .fd-msf-mail{justify-self:start;grid-column:1;grid-row:2}
  .fd-msf-note{display:none}
  .fd-msf-top{grid-column:2;grid-row:2;justify-self:end}
  .fd-msf-who span{display:none}
  .fd-msf-toast{left:0;transform:translate(0,6px) scale(.94);transform-origin:0 100%}
  .fd-msf-toast[data-on]{transform:none}
}
@media (prefers-reduced-motion:reduce){.fd-msf *{transition-duration:1ms!important}}
@media (prefers-contrast:more){.fd-msf{--fd-msf-mut:#C4BFB4;--fd-msf-line:rgba(233,229,219,.45)}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const PLATES = [
  { src: "/img/lux/still-vase.webp", n: "22", t: "Two pots, one lemon", d: "Alfama, May 2026" },
  { src: "/img/lux/still-tea.webp", n: "23", t: "Tea after the shoot", d: "Alfama, May 2026" },
  { src: "/img/lux/still-grey.webp", n: "24", t: "Grey morning", d: "Alfama, June 2026" },
];

export function Demo() {
  return (
    <div className="fd-msfd">
      <style>{demoCss}</style>
      <main className="fd-msfd-main">
        <header className="fd-msfd-head">
          <h1>Kitchen Table</h1>
          <p>A series of 24 plates, shot with one window and no assistant.</p>
        </header>
        <ol className="fd-msfd-plates">
          {PLATES.map((p) => (
            <li key={p.n}>
              <figure>
                <img src={p.src} alt={p.t} width={900} height={1125} loading="lazy" decoding="async" />
                <figcaption><span>{p.n}/24</span>{p.t}<em>{p.d}</em></figcaption>
              </figure>
            </li>
          ))}
        </ol>
        <p className="fd-msfd-end">End of series. Prints in editions of 12, ask by email.</p>
      </main>
      <MinimalSignoffFooter />
    </div>
  );
}

const demoCss = `
:where(.fd-msfd,.fd-msfd *){box-sizing:border-box;margin:0;padding:0;border:0;font:inherit;letter-spacing:inherit;color:inherit;list-style:none;font-style:normal}
:where(.fd-msfd img){display:block}
.fd-msfd{min-height:100vh;background:#121211;color:#E9E5DB;font:400 14px/20px ${SANS};-webkit-font-smoothing:antialiased}
.fd-msfd-main{padding:56px clamp(16px,3.4vw,48px) 96px;outline:0}
.fd-msfd-head{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap}
.fd-msfd-head h1{font:italic 400 clamp(2rem,4vw,3rem)/1 ${SERIF};letter-spacing:-.02em;outline:0}
.fd-msfd-head p{color:#88837A;max-width:360px}
.fd-msfd-plates{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:clamp(16px,2.4vw,32px);align-items:end;margin-top:40px}
.fd-msfd-plates li:nth-child(2){margin-bottom:12%}
.fd-msfd-plates img{width:100%;height:auto;aspect-ratio:4/5;object-fit:cover}
.fd-msfd-plates figcaption{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-top:12px;color:#E9E5DB}
.fd-msfd-plates figcaption span{font:400 11px/16px ${MONO};color:#88837A}
.fd-msfd-plates figcaption em{margin-left:auto;color:#88837A}
.fd-msfd-end{margin-top:72px;text-align:center;font:italic 400 17px/24px ${SERIF};color:#88837A}
@media (max-width:760px){.fd-msfd-plates{grid-template-columns:1fr}.fd-msfd-plates li:nth-child(2){margin-bottom:0}}
`;
