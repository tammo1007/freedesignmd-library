/**
 * FloatingCapsuleNav — a full-width developer-tools bar that, once the page
 * scrolls, contracts into a floating capsule centred at the top. The shape is
 * driven by a small spring integrator (k 380, c 30) so it settles with one
 * measured overshoot instead of a CSS ease. Secondary items (version chip,
 * status label, GitHub count, sign in) fade out as the capsule forms; the
 * status light moves onto the logo mark so it is never lost.
 *
 * Props: brand, version, status ({ label, href, state }), links, stars,
 * signIn, cta, threshold (px of scroll before contracting), capsuleWidth.
 * CSS vars on the root: --fd-fcn-bg, --fd-fcn-ink, --fd-fcn-accent.
 *
 * Behaviour: the header is `position: sticky; top: 0`, so place it as the
 * first child of a tall page wrapper. It reads window scroll.
 * Browser support: all evergreen browsers (clip-path inset with round).
 * Accessibility: <header> + <nav aria-label="Primary">; the mobile menu button
 * has aria-expanded/aria-controls, Escape closes and returns focus, Tab is
 * kept inside the open menu, hidden items are removed from the tab order.
 * Reduced motion: the capsule snaps between states, no status pulse.
 */
import { useEffect, useId, useRef, useState } from "react";

export interface FcnLink { label: string; href: string; badge?: string }
export interface FloatingCapsuleNavProps {
  brand?: string;
  version?: string;
  status?: { label: string; href: string; state?: "ok" | "degraded" | "down" };
  links?: FcnLink[];
  stars?: string;
  signIn?: { label: string; href: string };
  cta?: { label: string; href: string };
  threshold?: number;
  capsuleWidth?: number;
  className?: string;
}

const LINKS: FcnLink[] = [
  { label: "Docs", href: "#docs" },
  { label: "Remote cache", href: "#cache" },
  { label: "Pricing", href: "#pricing" },
  { label: "Changelog", href: "#changelog", badge: "New" },
  { label: "Customers", href: "#customers" },
];

export function FloatingCapsuleNav({
  brand = "kiln",
  version = "v4.2.0",
  status = { label: "All systems normal", href: "#status", state: "ok" },
  links = LINKS,
  stars = "18.4k",
  signIn = { label: "Sign in", href: "#signin" },
  cta = { label: "Start building", href: "#start" },
  threshold = 24,
  capsuleWidth = 860,
  className,
}: FloatingCapsuleNavProps) {
  const uid = useId();
  const sheetId = `${uid}-menu`;
  const root = useRef<HTMLElement>(null);
  const burger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const hover = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  // Spring-driven capsule.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let x = 0, v = 0, target = 0, raf = 0, last = 0;
    const apply = () => {
      const W = el.clientWidth;
      const mobile = W < 760;
      const margin = mobile ? 12 : 16;
      const cap = Math.min(W - margin * 2, capsuleWidth);
      const s = ((W - cap) / 2) * x;
      const pad = mobile ? 20 : 32;
      const capPad = mobile ? 10 : 12;
      el.style.setProperty("--fcn-s", `${s.toFixed(2)}px`);
      el.style.setProperty("--fcn-t", `${(10 * Math.min(Math.max(x, 0), 1.2)).toFixed(2)}px`);
      el.style.setProperty("--fcn-r", `${(28 * Math.min(Math.max(x, 0), 1)).toFixed(2)}px`);
      el.style.setProperty("--fcn-dx", `${(s + (capPad - pad) * x).toFixed(2)}px`);
      el.style.setProperty("--fcn-p", `${Math.min(Math.max(x, 0), 1).toFixed(3)}`);
      el.style.setProperty("--fcn-fade", `${Math.max(0, 1 - x * 2.4).toFixed(3)}`);
    };
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      const a = -380 * (x - target) - 30 * v;
      v += a * dt;
      x += v * dt;
      apply();
      if (Math.abs(v) < 0.002 && Math.abs(x - target) < 0.001) {
        x = target;
        v = 0;
        apply();
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(step);
    };
    const kick = () => {
      if (reduce) {
        x = target;
        apply();
        return;
      }
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };
    const onScroll = () => {
      const t = window.scrollY > threshold ? 1 : 0;
      if (t !== target) {
        target = t;
        setCompact(t === 1);
        kick();
      }
    };
    target = window.scrollY > threshold ? 1 : 0;
    x = target;
    setCompact(target === 1);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [threshold, capsuleWidth]);

  // Mobile menu: Escape, focus in, focus trap, close when resized to desktop.
  useEffect(() => {
    if (!open) return;
    const first = sheet.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        burger.current?.focus();
      }
      if (e.key === "Tab" && sheet.current) {
        const f = [burger.current!, ...Array.from(sheet.current.querySelectorAll<HTMLElement>("a,button"))];
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && i === f.length - 1) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    const mq = matchMedia("(min-width: 760px)");
    const onMq = () => mq.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [open]);

  const moveHover = (a: HTMLElement | null) => {
    const h = hover.current;
    if (!h) return;
    if (!a) {
      h.style.opacity = "0";
      return;
    }
    h.style.opacity = "1";
    h.style.width = `${a.offsetWidth}px`;
    h.style.transform = `translateX(${a.offsetLeft}px)`;
  };

  const st = status.state ?? "ok";

  return (
    <header ref={root} className={`fd-fcn${className ? " " + className : ""}`} data-compact={compact ? "" : undefined} data-open={open ? "" : undefined}>
      <style>{css}</style>
      <div className="fd-fcn-shape" aria-hidden="true">
        <span className="fd-fcn-edge" />
        <span className="fd-fcn-fill" />
      </div>
      <div className="fd-fcn-row">
        <div className="fd-fcn-l">
          <a className="fd-fcn-logo" href="#top" aria-label={`${brand} home`}>
            <span className="fd-fcn-mark">
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                <path d="M3 19V9.5L11 3l8 6.5V19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M7.5 19v-5.2a3.5 3.5 0 0 1 7 0V19" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M11 12.6c-1 1-1 2.2 0 3.2 1-1 1-2.2 0-3.2z" fill="var(--fd-fcn-accent)" />
              </svg>
              <i className="fd-fcn-markdot" data-state={st} />
            </span>
            <span className="fd-fcn-word">{brand}</span>
          </a>
          <span className="fd-fcn-fade fd-fcn-chip" aria-hidden={compact || undefined}>{version}</span>
          <a className="fd-fcn-fade fd-fcn-status" href={status.href} tabIndex={compact ? -1 : undefined} aria-hidden={compact || undefined}>
            <i className="fd-fcn-dot" data-state={st} />
            {status.label}
          </a>
        </div>

        <nav ref={navRef} className="fd-fcn-c" aria-label="Primary" onPointerLeave={() => moveHover(null)}>
          <span ref={hover} className="fd-fcn-hover" aria-hidden="true" />
          {links.map((l) => (
            <a key={l.href} className="fd-fcn-link" href={l.href} onPointerEnter={(e) => moveHover(e.currentTarget)} onFocus={(e) => moveHover(e.currentTarget)} onBlur={() => moveHover(null)}>
              {l.label}
              {l.badge && <span className="fd-fcn-badge">{l.badge}</span>}
            </a>
          ))}
        </nav>

        <div className="fd-fcn-r">
          <a className="fd-fcn-fade fd-fcn-gh" href="#github" tabIndex={compact ? -1 : undefined} aria-hidden={compact || undefined} aria-label={`GitHub, ${stars} stars`}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.4 7.4 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.6 3.9.3.3.6.8.6 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2z" /></svg>
            <span>{stars}</span>
          </a>
          <a className="fd-fcn-fade fd-fcn-ghost" href={signIn.href} tabIndex={compact ? -1 : undefined} aria-hidden={compact || undefined}>{signIn.label}</a>
          <a className="fd-fcn-cta" href={cta.href}>
            {cta.label}
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8M6.5 2.5 10 6 6.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
          <button ref={burger} type="button" className="fd-fcn-burger" aria-expanded={open} aria-controls={sheetId} aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
            <span /><span />
          </button>
        </div>
      </div>

      {open && <div className="fd-fcn-scrim" aria-hidden="true" onClick={() => setOpen(false)} />}
      <div ref={sheet} id={sheetId} className="fd-fcn-sheet" hidden={!open}>
        <nav aria-label="Mobile">
          {links.map((l, i) => (
            <a key={l.href} href={l.href} className="fd-fcn-mlink" onClick={() => setOpen(false)}>
              <span className="fd-fcn-mi">{String(i + 1).padStart(2, "0")}</span>
              <span className="fd-fcn-ml">{l.label}</span>
              {l.badge && <span className="fd-fcn-badge">{l.badge}</span>}
            </a>
          ))}
        </nav>
        <div className="fd-fcn-mfoot">
          <a className="fd-fcn-status" href={status.href}><i className="fd-fcn-dot" data-state={st} />{status.label}</a>
          <span className="fd-fcn-chip">{version}</span>
        </div>
        <div className="fd-fcn-mbtns">
          <a className="fd-fcn-mghost" href={signIn.href}>{signIn.label}</a>
          <a className="fd-fcn-mcta" href={cta.href}>{cta.label}</a>
        </div>
      </div>
    </header>
  );
}

const css = `
.fd-fcn {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-fcn-bg: #0d0e10;
  --fd-fcn-cap: #17191c;
  --fd-fcn-line: #26282d;
  --fd-fcn-ink: #ecebe6;
  --fd-fcn-dim: #8d8e93;
  --fd-fcn-accent: #c8f06b;
  --fcn-s: 0px; --fcn-t: 0px; --fcn-r: 0px; --fcn-dx: 0px; --fcn-p: 0; --fcn-fade: 1;
  position: sticky; top: 0; z-index: 50;
  display: block; height: 76px; margin: 0; padding: 0;
  font: 400 15px/1.4 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  color: var(--fd-fcn-ink); background: transparent; border: 0;
}
.fd-fcn, .fd-fcn *, .fd-fcn *::before, .fd-fcn *::after { box-sizing: border-box; }
.fd-fcn-shape { position: absolute; inset: 0; z-index: 1; pointer-events: none; filter: drop-shadow(0 calc(var(--fcn-p) * 14px) calc(var(--fcn-p) * 22px) rgba(0,0,0,calc(var(--fcn-p) * 0.55))); }
.fd-fcn-edge, .fd-fcn-fill { position: absolute; inset: 0; display: block; }
.fd-fcn-edge {
  background: var(--fd-fcn-line);
  clip-path: inset(var(--fcn-t) var(--fcn-s) var(--fcn-t) var(--fcn-s) round var(--fcn-r));
}
.fd-fcn-fill {
  background: color-mix(in srgb, var(--fd-fcn-cap) calc(var(--fcn-p) * 100%), var(--fd-fcn-bg));
  clip-path: inset(calc(var(--fcn-t) + var(--fcn-p) * 1px) calc(var(--fcn-s) + var(--fcn-p) * 1px) calc(var(--fcn-t) + 1px) calc(var(--fcn-s) + var(--fcn-p) * 1px) round max(0px, calc(var(--fcn-r) - 1px)));
}
.fd-fcn-row { position: relative; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; margin: 0; }
.fd-fcn-l, .fd-fcn-r { position: relative; z-index: 2; display: flex; align-items: center; gap: 14px; margin: 0; padding: 0; }
.fd-fcn-l { transform: translateX(var(--fcn-dx)); }
.fd-fcn-r { transform: translateX(calc(var(--fcn-dx) * -1)); gap: 8px; }
.fd-fcn-fade { opacity: var(--fcn-fade); }
.fd-fcn[data-compact] .fd-fcn-fade { visibility: hidden; transition: visibility 0s linear var(--fd-dur-2); }

.fd-fcn-logo { display: inline-flex; align-items: center; gap: 9px; margin: 0; padding: 4px 6px 4px 4px; border-radius: 10px; color: var(--fd-fcn-ink); text-decoration: none; background: none; }
.fd-fcn-mark { position: relative; display: block; width: 22px; height: 22px; }
.fd-fcn-mark svg { display: block; }
.fd-fcn-markdot { position: absolute; right: -3px; top: -2px; width: 7px; height: 7px; border-radius: 9999px; background: #4ade80; box-shadow: 0 0 0 2px var(--fd-fcn-cap); opacity: var(--fcn-p); transform: scale(calc(0.4 + var(--fcn-p) * 0.6)); }
.fd-fcn-word { font: 650 1.25rem/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: -0.04em; color: var(--fd-fcn-ink); }
.fd-fcn-chip { display: inline-block; margin: 0; padding: 3px 7px; border: 1px solid var(--fd-fcn-line); border-radius: 6px; font: 500 0.75rem/1.2 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0; color: var(--fd-fcn-dim); background: #141518; }
.fd-fcn-status { display: inline-flex; align-items: center; gap: 8px; margin: 0; padding: 4px 8px; border-radius: 9999px; font: 500 0.8125rem/1.2 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; color: var(--fd-fcn-dim); text-decoration: none; transition: color var(--fd-dur-1) var(--fd-ease-out), background var(--fd-dur-1) var(--fd-ease-out); }
.fd-fcn-status:hover { color: var(--fd-fcn-ink); background: #17191c; }
.fd-fcn-dot { position: relative; display: block; width: 7px; height: 7px; border-radius: 9999px; background: #4ade80; }
.fd-fcn-dot::after { content: ""; position: absolute; inset: -4px; border-radius: 9999px; border: 1.5px solid #4ade80; opacity: 0; animation: fd-fcn-ping 2.4s var(--fd-ease-out) infinite; }
.fd-fcn-dot[data-state="degraded"], .fd-fcn-markdot[data-state="degraded"] { background: #f5b83d; }
.fd-fcn-dot[data-state="down"], .fd-fcn-markdot[data-state="down"] { background: #f2555a; }
.fd-fcn-dot[data-state="degraded"]::after { border-color: #f5b83d; }
.fd-fcn-dot[data-state="down"]::after { border-color: #f2555a; }
@keyframes fd-fcn-ping { 0% { transform: scale(0.5); opacity: 0.9; } 70%, 100% { transform: scale(1.6); opacity: 0; } }

.fd-fcn-c { position: absolute; left: 50%; top: 50%; z-index: 2; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 2px; margin: 0; padding: 0; }
.fd-fcn-hover { position: absolute; left: 0; top: 0; height: 100%; width: 0; border-radius: 9999px; background: #23252a; opacity: 0; pointer-events: none; transition: transform var(--fd-dur-2) var(--fd-ease-out), width var(--fd-dur-2) var(--fd-ease-out), opacity var(--fd-dur-1) linear; }
.fd-fcn-link { position: relative; display: inline-flex; align-items: center; gap: 6px; margin: 0; padding: 8px 13px; border-radius: 9999px; font: 500 0.875rem/1.2 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.005em; color: #bdbcb7; text-decoration: none; white-space: nowrap; transition: color var(--fd-dur-1) var(--fd-ease-out); }
.fd-fcn-link:hover, .fd-fcn-link:focus-visible { color: var(--fd-fcn-ink); }
.fd-fcn-badge { display: inline-block; margin: 0; padding: 2px 5px; border-radius: 4px; font: 600 0.625rem/1.1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.04em; text-transform: uppercase; color: #0d0e10; background: var(--fd-fcn-accent); }

.fd-fcn-gh { display: inline-flex; align-items: center; gap: 7px; margin: 0; padding: 8px 10px; border-radius: 9999px; font: 500 0.8125rem/1.2 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; color: var(--fd-fcn-dim); text-decoration: none; transition: color var(--fd-dur-1) var(--fd-ease-out); }
.fd-fcn-gh svg { display: block; }
.fd-fcn-gh:hover { color: var(--fd-fcn-ink); }
.fd-fcn-ghost { display: inline-flex; margin: 0; padding: 8px 12px; border-radius: 9999px; font: 500 0.875rem/1.2 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; color: var(--fd-fcn-ink); text-decoration: none; }
.fd-fcn-ghost:hover { background: #1c1e22; }
.fd-fcn-cta { display: inline-flex; align-items: center; gap: 8px; margin: 0; padding: 9px 14px 9px 16px; border-radius: 9999px; font: 600 0.875rem/1.2 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.005em; color: #0d0e10; background: var(--fd-fcn-accent); text-decoration: none; white-space: nowrap; transition: transform var(--fd-dur-1) var(--fd-ease-out), background var(--fd-dur-1) var(--fd-ease-out); }
.fd-fcn-cta svg { display: block; transition: transform var(--fd-dur-2) var(--fd-spring); }
.fd-fcn-cta:hover { background: #d6f78b; }
.fd-fcn-cta:hover svg { transform: translateX(3px); }
.fd-fcn-cta:active { transform: scale(0.96); transition: transform var(--fd-dur-1) var(--fd-ease-out); }
.fd-fcn a:focus-visible, .fd-fcn button:focus-visible { outline: 2px solid color-mix(in srgb, var(--fd-fcn-accent) 70%, transparent); outline-offset: 2px; }

.fd-fcn-burger { display: none; position: relative; width: 40px; height: 40px; margin: 0; padding: 0; border: 1px solid var(--fd-fcn-line); border-radius: 9999px; background: #15171a; color: var(--fd-fcn-ink); cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-fcn-burger span { position: absolute; left: 12px; right: 12px; height: 1.5px; border-radius: 2px; background: currentColor; transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-fcn-burger span:nth-child(1) { top: 16px; }
.fd-fcn-burger span:nth-child(2) { top: 22px; }
.fd-fcn[data-open] .fd-fcn-burger span:nth-child(1) { transform: translateY(3px) rotate(45deg); }
.fd-fcn[data-open] .fd-fcn-burger span:nth-child(2) { transform: translateY(-3px) rotate(-45deg); }

.fd-fcn-scrim { position: fixed; inset: 0; z-index: 0; background: rgba(5,6,7,0.6); animation: fd-fcn-fade var(--fd-dur-2) linear; }
@keyframes fd-fcn-fade { from { opacity: 0; } }
.fd-fcn-sheet { position: absolute; left: 12px; right: 12px; top: 70px; z-index: 3; margin: 0; padding: 8px 8px 12px; border: 1px solid var(--fd-fcn-line); border-radius: 24px; background: var(--fd-fcn-cap); box-shadow: 0 24px 60px rgba(0,0,0,0.55); animation: fd-fcn-drop var(--fd-dur-3) var(--fd-ease-out); }
.fd-fcn-sheet[hidden] { display: none; }
@keyframes fd-fcn-drop { from { clip-path: inset(0 0 100% 0 round 24px); } to { clip-path: inset(0 0 0 0 round 24px); } }
.fd-fcn-sheet nav { display: block; margin: 0; padding: 0; }
.fd-fcn-mlink { display: flex; align-items: baseline; gap: 14px; margin: 0; padding: 14px 14px; border-radius: 16px; color: var(--fd-fcn-ink); text-decoration: none; animation: fd-fcn-rise var(--fd-dur-3) var(--fd-ease-out) both; }
.fd-fcn-mlink:nth-child(1) { animation-delay: 40ms; } .fd-fcn-mlink:nth-child(2) { animation-delay: 80ms; } .fd-fcn-mlink:nth-child(3) { animation-delay: 120ms; } .fd-fcn-mlink:nth-child(4) { animation-delay: 160ms; } .fd-fcn-mlink:nth-child(5) { animation-delay: 200ms; }
@keyframes fd-fcn-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.fd-fcn-mlink:active { background: #1f2125; }
.fd-fcn-mi { font: 500 0.75rem/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; color: var(--fd-fcn-dim); }
.fd-fcn-ml { flex: 1; font: 600 1.5rem/1.1 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.025em; color: var(--fd-fcn-ink); }
.fd-fcn-mfoot { display: flex; align-items: center; justify-content: space-between; margin: 8px 6px 10px; padding: 12px 0 0; border-top: 1px solid var(--fd-fcn-line); }
.fd-fcn-mbtns { display: grid; grid-template-columns: 1fr 1.4fr; gap: 8px; margin: 0; padding: 0; }
.fd-fcn-mghost, .fd-fcn-mcta { display: block; margin: 0; padding: 14px 10px; border-radius: 9999px; text-align: center; font: 600 0.9375rem/1.2 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; text-decoration: none; }
.fd-fcn-mghost { color: var(--fd-fcn-ink); border: 1px solid var(--fd-fcn-line); background: transparent; }
.fd-fcn-mcta { color: #0d0e10; background: var(--fd-fcn-accent); border: 1px solid var(--fd-fcn-accent); }

@media (max-width: 1080px) { .fd-fcn-gh, .fd-fcn-row .fd-fcn-status { display: none; } }
@media (max-width: 759px) {
  .fd-fcn { height: 68px; }
  .fd-fcn-row { padding: 0 20px; }
  .fd-fcn-c, .fd-fcn-ghost, .fd-fcn-cta { display: none; }
  .fd-fcn-burger { display: block; }
  .fd-fcn-sheet { top: 64px; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-fcn-dot::after { animation: none; }
  .fd-fcn-sheet, .fd-fcn-mlink { animation: none; }
  .fd-fcn-burger span, .fd-fcn-hover, .fd-fcn-cta svg { transition: none; }
}
@media (prefers-contrast: more) { .fd-fcn { --fd-fcn-line: #5a5c63; --fd-fcn-dim: #b7b8bc; } }
`;

/* ── Demo: Kiln changelog page ─────────────────────────────────────────── */

const ENTRIES = [
  {
    date: "Oct 29, 2026", tag: "v4.2.0", title: "Remote cache now shards by package graph",
    body: "Cache keys used to hash the whole lockfile, so bumping one dev dependency invalidated every package. Keys are now scoped to each package's resolved subgraph. On our own monorepo (312 packages) median CI time went from 11m 40s to 3m 05s.",
    items: ["kiln cache stats --since 7d shows hit rate per package", "New KILN_CACHE_SHARD env for self-hosted buckets", "Fixed a race when two runners uploaded the same artifact"],
  },
  {
    date: "Oct 14, 2026", tag: "v4.1.3", title: "Quieter logs, louder failures",
    body: "Successful tasks now collapse to one line. Failed tasks print their full output, the exact command, and the cache key that missed, so you can rerun it locally with kiln replay.",
    items: ["kiln replay <task-id> reproduces a CI task on your machine", "Log output is 74% shorter on green builds"],
  },
  {
    date: "Sep 30, 2026", tag: "v4.1.0", title: "Bun and Deno workspaces",
    body: "Kiln reads bun.lock and deno.json workspaces natively. No adapter, no config. Mixed repos work too: we tested a 40 package repo with pnpm, Bun and a Rust crate side by side.",
    items: ["Workspace detection takes 38ms on a cold start", "Rust crates hash Cargo.lock per member"],
  },
];

export function Demo() {
  return (
    <div className="fd-fcn-demo">
      <style>{demoCss}</style>
      <FloatingCapsuleNav />
      <main className="fd-fcn-demo-main">
        <div className="fd-fcn-demo-head">
          <p className="fd-fcn-demo-eyebrow">Changelog · RSS · 214 releases since 2022</p>
          <h1>What we shipped.</h1>
          <p className="fd-fcn-demo-lede">Every release of the kiln CLI and remote cache, newest first. Breaking changes are marked, and there have been three.</p>
        </div>
        {ENTRIES.map((e) => (
          <article key={e.tag} className="fd-fcn-demo-entry">
            <div className="fd-fcn-demo-meta">
              <time>{e.date}</time>
              <code>{e.tag}</code>
            </div>
            <div className="fd-fcn-demo-body">
              <h2>{e.title}</h2>
              <p>{e.body}</p>
              <pre aria-label="Terminal"><span>$</span> npx kiln@{e.tag.slice(1)} run build --affected{"\n"}<em>✓ 41 tasks · 37 cached · 3m 05s</em></pre>
              <ul>{e.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}

const demoCss = `
.fd-fcn-demo { margin: 0; padding: 0; min-height: 100vh; background: #0d0e10; color: #ecebe6; font: 400 15px/1.6 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; }
.fd-fcn-demo *, .fd-fcn-demo *::before, .fd-fcn-demo *::after { box-sizing: border-box; }
.fd-fcn-demo-main { max-width: 1040px; margin: 0 auto; padding: 72px 32px 160px; }
.fd-fcn-demo-head { margin: 0 0 72px; padding: 0 0 40px; border-bottom: 1px solid #26282d; }
.fd-fcn-demo-eyebrow { margin: 0 0 18px; font: 500 0.8125rem/1.4 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; color: #8d8e93; }
.fd-fcn-demo-head h1 { margin: 0; font: 650 clamp(2.75rem, 7vw, 5.5rem)/0.95 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.045em; color: #ecebe6; }
.fd-fcn-demo-lede { max-width: 520px; margin: 22px 0 0; font: 400 1.0625rem/1.55 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; color: #a2a3a8; }
.fd-fcn-demo-entry { display: grid; grid-template-columns: 200px 1fr; gap: 32px; margin: 0 0 72px; padding: 0; }
.fd-fcn-demo-meta { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; position: sticky; top: 96px; align-self: start; }
.fd-fcn-demo-meta time { font: 500 0.8125rem/1.4 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; color: #8d8e93; }
.fd-fcn-demo-meta code { padding: 3px 7px; border-radius: 6px; font: 600 0.75rem/1.2 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; color: #0d0e10; background: #c8f06b; }
.fd-fcn-demo-body h2 { margin: 0 0 12px; font: 600 1.5rem/1.2 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", Roboto, sans-serif; letter-spacing: -0.02em; color: #ecebe6; }
.fd-fcn-demo-body p { max-width: 640px; margin: 0 0 18px; color: #a2a3a8; }
.fd-fcn-demo-body pre { margin: 0 0 18px; padding: 16px 18px; border: 1px solid #26282d; border-radius: 12px; background: #121316; font: 400 0.8125rem/1.7 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; color: #d5d4cf; overflow-x: auto; white-space: pre; }
.fd-fcn-demo-body pre span { color: #c8f06b; }
.fd-fcn-demo-body pre em { font-style: normal; color: #4ade80; }
.fd-fcn-demo-body ul { margin: 0; padding: 0; list-style: none; }
.fd-fcn-demo-body li { position: relative; margin: 0; padding: 6px 0 6px 20px; color: #c9c8c3; border-top: 1px dashed #24262a; }
.fd-fcn-demo-body li::before { content: "+"; position: absolute; left: 0; top: 6px; font-family: ui-monospace, "SF Mono", Menlo, monospace; color: #c8f06b; }
@media (max-width: 759px) {
  .fd-fcn-demo-main { padding: 48px 20px 120px; }
  .fd-fcn-demo-entry { grid-template-columns: 1fr; gap: 14px; margin-bottom: 56px; }
  .fd-fcn-demo-meta { position: static; flex-direction: row; align-items: center; }
}
`;
