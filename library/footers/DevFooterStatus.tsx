/**
 * DevFooterStatus, a dense, light footer for a developer platform. A brand
 * column with a live status pill (click it for per-region 90-day uptime
 * bars), a five-column sitemap, a changelog newsletter with real validation,
 * loading and success states, a language select, hand-drawn SVG social icons
 * and a mono legal row with the deployed build.
 *
 * Props: brand, blurb, columns, regions (code, name, uptime %, incidents as
 * day indexes 0-89 → "degraded"), languages, socials, legal, build, onSubscribe
 * (email) => Promise<void> | void.
 * CSS vars: --fd-dfs-bg, --fd-dfs-fg, --fd-dfs-accent, --fd-dfs-ok.
 *
 * Browser support: all evergreen browsers.
 * Accessibility: status pill is a button with aria-expanded controlling a
 * labelled panel (Esc and outside click close it, focus returns). Uptime bars
 * are summarised as text. The email field has a label, aria-invalid and an
 * error tied with aria-describedby; success is announced politely. Social
 * links have aria-labels. Reduced motion stops the status pulse.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

export interface DfsColumn { title: string; links: { label: string; href: string; badge?: string }[] }
export interface DfsRegion { code: string; name: string; uptime: string; incidents?: number[]; minor?: number[] }
export interface DfsSocial { label: string; href: string; icon: "github" | "x" | "discord" | "youtube" | "rss" }

export interface DevFooterStatusProps {
  brand?: string;
  blurb?: string;
  columns?: DfsColumn[];
  regions?: DfsRegion[];
  languages?: { value: string; label: string }[];
  socials?: DfsSocial[];
  legal?: { label: string; href: string }[];
  build?: string;
  onSubscribe?: (email: string) => Promise<void> | void;
  className?: string;
}

const DEFAULT_COLUMNS: DfsColumn[] = [
  { title: "Product", links: [{ label: "Queues", href: "#" }, { label: "Cron", href: "#" }, { label: "Workflows", href: "#", badge: "Beta" }, { label: "Rate limits", href: "#" }, { label: "Dead letters", href: "#" }, { label: "Pricing", href: "#" }] },
  { title: "Developers", links: [{ label: "Docs", href: "#" }, { label: "API reference", href: "#" }, { label: "CLI", href: "#" }, { label: "TypeScript SDK", href: "#" }, { label: "Python SDK", href: "#" }, { label: "Go SDK", href: "#" }, { label: "Changelog", href: "#" }] },
  { title: "Resources", links: [{ label: "Guides", href: "#" }, { label: "Templates", href: "#" }, { label: "From Sidekiq", href: "#" }, { label: "From Celery", href: "#" }, { label: "Benchmarks", href: "#" }, { label: "Blog", href: "#" }] },
  { title: "Company", links: [{ label: "About", href: "#" }, { label: "Customers", href: "#" }, { label: "Careers", href: "#", badge: "4" }, { label: "Security", href: "#" }, { label: "Contact sales", href: "#" }] },
  { title: "Community", links: [{ label: "Discord", href: "#" }, { label: "Discussions", href: "#" }, { label: "Office hours", href: "#" }, { label: "Open source", href: "#" }] },
];

const DEFAULT_REGIONS: DfsRegion[] = [
  { code: "iad1", name: "Washington, D.C.", uptime: "99.998%", minor: [61] },
  { code: "fra1", name: "Frankfurt", uptime: "100%" },
  { code: "sin1", name: "Singapore", uptime: "99.981%", minor: [23, 24], incidents: [52] },
  { code: "syd1", name: "Sydney", uptime: "100%" },
  { code: "gru1", name: "São Paulo", uptime: "99.994%", minor: [80] },
];

const DEFAULT_LANGS = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
  { value: "pt-BR", label: "Português (BR)" },
  { value: "fr", label: "Français" },
];

const DEFAULT_SOCIALS: DfsSocial[] = [
  { label: "GitHub", href: "#", icon: "github" },
  { label: "X", href: "#", icon: "x" },
  { label: "Discord", href: "#", icon: "discord" },
  { label: "YouTube", href: "#", icon: "youtube" },
  { label: "RSS feed", href: "#", icon: "rss" },
];

const DEFAULT_LEGAL = [
  { label: "Terms", href: "#" },
  { label: "Privacy", href: "#" },
  { label: "DPA", href: "#" },
  { label: "Subprocessors", href: "#" },
  { label: "Cookie settings", href: "#" },
];

const ICONS: Record<DfsSocial["icon"], ReactNode> = {
  github: (
    <path fill="currentColor" d="M12 2.5a9.5 9.5 0 00-3 18.5c.5.1.6-.2.6-.5v-1.7c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6 0-.6 0-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.1-.2-4.3-1-4.3-4.7 0-1 .4-1.9 1-2.6-.1-.2-.4-1.2.1-2.5 0 0 .8-.3 2.6 1a9 9 0 014.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.5.6.7 1 1.6 1 2.6 0 3.7-2.2 4.5-4.3 4.7.3.3.6.9.6 1.8v2.6c0 .3.2.6.7.5A9.5 9.5 0 0012 2.5z" />
  ),
  x: <path fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" d="M5 4.5l14 15M19 4.5l-14 15" />,
  discord: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M7.5 6.5c3-1.3 6-1.3 9 0 1.6 2.4 2.5 5.3 2.5 8.6-1.3 1.2-2.8 2-4.4 2.4l-1-1.7m-3.2 0l-1 1.7C8.3 17.1 6.8 16.3 5 15.1c0-3.3.9-6.2 2.5-8.6z" />
      <circle cx="9.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </g>
  ),
  youtube: (
    <g>
      <rect x="2.75" y="5.75" width="18.5" height="12.5" rx="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10.2 9.4v5.2l4.5-2.6z" fill="currentColor" />
    </g>
  ),
  rss: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M5 11a8 8 0 018 8M5 5.5A13.5 13.5 0 0118.5 19" />
      <circle cx="6" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </g>
  ),
};

export function DevFooterStatus({
  brand = "Quay",
  blurb = "Durable background jobs for TypeScript, Python and Go. Retries, schedules and fan-out without running a single Redis box.",
  columns = DEFAULT_COLUMNS,
  regions = DEFAULT_REGIONS,
  languages = DEFAULT_LANGS,
  socials = DEFAULT_SOCIALS,
  legal = DEFAULT_LEGAL,
  build = "v4.12.0 · main@8f3c2a1",
  onSubscribe,
  className,
}: DevFooterStatusProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState(languages[0]?.value ?? "en");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [phase, setPhase] = useState<"idle" | "busy" | "done">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const degraded = regions.some((r) => r.incidents?.includes(89));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !pillRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); pillRef.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const validate = (v: string) => {
    const s = v.trim();
    if (!s) return "Enter an email address.";
    if (!/^[^\s@]+@[^\s@]+$/.test(s)) return "An email needs one @, like ada@company.dev.";
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s)) return `Add a domain ending, like ${s.split("@")[0]}@${s.split("@")[1] || "company"}.dev.`;
    if (/@(mailinator|10minutemail|guerrillamail)\./i.test(s)) return "Disposable inboxes can't confirm. Use a real one.";
    return "";
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const m = validate(email);
    setErr(m);
    if (m) { inputRef.current?.focus(); return; }
    setPhase("busy");
    try {
      await Promise.all([onSubscribe?.(email.trim()), new Promise((r) => setTimeout(r, 700))]);
      setPhase("done");
    } catch {
      setPhase("idle");
      setErr("Something went wrong on our side. Try again in a minute.");
    }
  };

  return (
    <footer className={`fd-dfs${className ? " " + className : ""}`}>
      <style>{css}</style>
      <div className="fd-dfs-in">
        <div className="fd-dfs-grid">
          <div className="fd-dfs-brand">
            <a className="fd-dfs-logo" href="#" aria-label={`${brand} home`}>
              <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
                <rect x="1" y="1" width="24" height="24" rx="6" fill="currentColor" />
                <path d="M7 9h12M7 13h8M7 17h4" stroke="var(--fd-dfs-bg)" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="18" cy="17" r="2" fill="var(--fd-dfs-accent)" />
              </svg>
              <span>{brand.toLowerCase()}</span>
            </a>
            <p className="fd-dfs-blurb">{blurb}</p>

            <div className="fd-dfs-statuswrap">
              <button
                ref={pillRef}
                type="button"
                className="fd-dfs-pill"
                data-state={degraded ? "warn" : "ok"}
                aria-expanded={open}
                aria-controls={`${uid}-st`}
                onClick={() => setOpen((o) => !o)}
              >
                <span className="fd-dfs-dot" aria-hidden="true"><i /></span>
                {degraded ? "Degraded performance" : "All systems normal"}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="fd-dfs-chev"><path d="M2.5 6.5L5 4l2.5 2.5" /></svg>
              </button>
              {open && (
                <div ref={panelRef} id={`${uid}-st`} className="fd-dfs-panel" role="region" aria-label="System status by region">
                  <div className="fd-dfs-ph">
                    <span>Uptime, last 90 days</span>
                    <a href="#" className="fd-dfs-a">status.quay.dev</a>
                  </div>
                  <ul className="fd-dfs-regions">
                    {regions.map((r) => (
                      <li key={r.code}>
                        <div className="fd-dfs-rh">
                          <code>{r.code}</code>
                          <span>{r.name}</span>
                          <b>{r.uptime}</b>
                        </div>
                        <div className="fd-dfs-bars" aria-label={`${r.name}: ${r.uptime} uptime, ${(r.incidents?.length ?? 0) + (r.minor?.length ?? 0)} incident days`} role="img">
                          {Array.from({ length: 90 }, (_, d) => (
                            <i key={d} data-s={r.incidents?.includes(d) ? "down" : r.minor?.includes(d) ? "minor" : undefined} />
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="fd-dfs-pf">Last incident: sin1 queue latency, 38 days ago, 14 min.</p>
                </div>
              )}
            </div>

            <ul className="fd-dfs-social">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} aria-label={s.label} className="fd-dfs-ico">
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">{ICONS[s.icon]}</svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav className="fd-dfs-cols" aria-label="Footer">
            {columns.map((c) => (
              <div key={c.title} className="fd-dfs-col">
                <h3 className="fd-dfs-h">{c.title}</h3>
                <ul>
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <a className="fd-dfs-link" href={l.href}>{l.label}</a>
                      {l.badge && <span className="fd-dfs-badge">{l.badge}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="fd-dfs-mid">
          <form className="fd-dfs-news" onSubmit={submit} noValidate>
            <div className="fd-dfs-nt">
              <label htmlFor={`${uid}-em`} className="fd-dfs-h">Changelog by email</label>
              <p>What shipped, every other Thursday. Plain text, no tracking pixels.</p>
            </div>
            {phase === "done" ? (
              <div className="fd-dfs-done" role="status">
                <span className="fd-dfs-check" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path className="fd-dfs-tick" d="M3 7.4l2.6 2.6L11 4.4" /></svg>
                </span>
                <div>
                  <p><b>Check {email.trim()}</b></p>
                  <p>The confirm link expires in 24 hours. <button type="button" className="fd-dfs-undo" onClick={() => { setPhase("idle"); setEmail(""); setTimeout(() => inputRef.current?.focus(), 0); }}>Use a different address</button></p>
                </div>
              </div>
            ) : (
              <div className="fd-dfs-fwrap">
                <div className="fd-dfs-field" data-err={err ? "" : undefined}>
                  <input
                    ref={inputRef}
                    id={`${uid}-em`}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="ada@company.dev"
                    value={email}
                    disabled={phase === "busy"}
                    aria-invalid={!!err}
                    aria-describedby={err ? `${uid}-er` : undefined}
                    onChange={(e) => { setEmail(e.target.value); if (err) setErr(""); }}
                    onBlur={() => { if (email.trim()) setErr(validate(email)); }}
                  />
                  <button type="submit" disabled={phase === "busy"} data-busy={phase === "busy" ? "" : undefined}>
                    <span>Subscribe</span>
                    {phase === "busy" && <i className="fd-dfs-spin" aria-hidden="true" />}
                  </button>
                </div>
                <p className="fd-dfs-err" id={`${uid}-er`} aria-live="polite">{err}</p>
              </div>
            )}
          </form>

          <div className="fd-dfs-lang">
            <label htmlFor={`${uid}-lang`} className="fd-dfs-sr">Language</label>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" className="fd-dfs-globe"><circle cx="8" cy="8" r="6.2" /><path d="M1.8 8h12.4M8 1.8c1.8 1.7 2.7 3.8 2.7 6.2S9.8 12.5 8 14.2C6.2 12.5 5.3 10.4 5.3 8S6.2 3.5 8 1.8z" /></svg>
            <select id={`${uid}-lang`} value={lang} onChange={(e) => setLang(e.target.value)}>
              {languages.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="fd-dfs-sel"><path d="M2.5 4L5 6.5 7.5 4" /></svg>
          </div>
        </div>

        <div className="fd-dfs-legal">
          <p>© 2026 Quay Labs, Inc.</p>
          <ul>{legal.map((l) => <li key={l.label}><a className="fd-dfs-link" href={l.href}>{l.label}</a></li>)}</ul>
          <p className="fd-dfs-soc">SOC 2 Type II · GDPR · HIPAA on Scale</p>
          <p className="fd-dfs-build"><span aria-hidden="true">◆</span> {build}</p>
        </div>
      </div>
    </footer>
  );
}

const SANS = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const MONO = `ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace`;

const css = `
:where(.fd-dfs,.fd-dfs *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-dfs,.fd-dfs *)::before,:where(.fd-dfs,.fd-dfs *)::after{box-sizing:border-box}
:where(.fd-dfs svg){display:block;flex-shrink:0}
:where(.fd-dfs button,.fd-dfs input,.fd-dfs select){appearance:none;-webkit-appearance:none;border-radius:0;outline:0}
:where(.fd-dfs button){cursor:pointer}
.fd-dfs{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-dfs-bg:#FFFFFF;--fd-dfs-fg:#0B0B0C;--fd-dfs-mut:#66666E;--fd-dfs-line:#E8E8EA;--fd-dfs-soft:#F6F6F7;--fd-dfs-accent:#F04E23;--fd-dfs-ok:#13A150;--fd-dfs-warn:#E0A100;--fd-dfs-bad:#E5484D;
  display:block;width:100%;background:var(--fd-dfs-bg);color:var(--fd-dfs-fg);border-top:1px solid var(--fd-dfs-line);
  font:400 14px/20px ${SANS};letter-spacing:-.003em;-webkit-font-smoothing:antialiased}
.fd-dfs-in{max-width:1280px;margin:0 auto;padding:56px clamp(16px,3vw,40px) 28px}
.fd-dfs-grid{display:grid;grid-template-columns:minmax(260px,1.1fr) minmax(0,3fr);gap:40px clamp(32px,5vw,72px)}
.fd-dfs-logo{display:inline-flex;align-items:center;gap:9px;font:700 22px/26px ${SANS};letter-spacing:-.045em;color:var(--fd-dfs-fg);border-radius:6px;outline:0}
.fd-dfs-blurb{margin-top:16px;max-width:300px;color:var(--fd-dfs-mut)}
.fd-dfs-statuswrap{position:relative;margin-top:20px}
.fd-dfs-pill{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 10px 0 9px;border-radius:9999px;background:var(--fd-dfs-soft);box-shadow:inset 0 0 0 1px var(--fd-dfs-line);font:500 13px/1 ${SANS};color:var(--fd-dfs-fg);transition:box-shadow var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-dfs-pill:hover{box-shadow:inset 0 0 0 1px #CFCFD4}
.fd-dfs-pill:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-dfs-chev{color:var(--fd-dfs-mut);transform:rotate(180deg);transition:transform var(--fd-dur-2) var(--fd-ease-out)}
.fd-dfs-pill[aria-expanded="true"] .fd-dfs-chev{transform:none}
.fd-dfs-dot{position:relative;display:block;width:8px;height:8px}
.fd-dfs-dot i,.fd-dfs-dot::before{position:absolute;inset:0;border-radius:9999px;background:var(--fd-dfs-ok)}
.fd-dfs-dot::before{content:"";animation:fd-dfs-ping 2.4s var(--fd-ease-out) infinite}
.fd-dfs-pill[data-state="warn"] .fd-dfs-dot i,.fd-dfs-pill[data-state="warn"] .fd-dfs-dot::before{background:var(--fd-dfs-warn)}
.fd-dfs-dot i{display:block}
@keyframes fd-dfs-ping{0%{transform:scale(1);opacity:.55}70%,100%{transform:scale(2.6);opacity:0}}
.fd-dfs-panel{position:absolute;left:0;bottom:calc(100% + 10px);z-index:20;width:340px;max-width:calc(100vw - 32px);padding:14px 14px 12px;border-radius:14px;background:var(--fd-dfs-bg);box-shadow:0 0 0 1px var(--fd-dfs-line),0 18px 40px -12px rgba(11,11,12,.22),0 2px 6px rgba(11,11,12,.06);transform-origin:20px 100%;animation:fd-dfs-pop var(--fd-dur-2) var(--fd-ease-out)}
@keyframes fd-dfs-pop{from{opacity:0;transform:translateY(6px) scale(.97)}}
.fd-dfs-ph{display:flex;justify-content:space-between;align-items:center;font:500 11px/16px ${MONO};letter-spacing:.02em;color:var(--fd-dfs-mut)}
.fd-dfs-ph .fd-dfs-a{color:var(--fd-dfs-fg);box-shadow:inset 0 -1px 0 var(--fd-dfs-line)}
.fd-dfs-regions{display:grid;gap:10px;margin-top:12px}
.fd-dfs-rh{display:grid;grid-template-columns:40px 1fr auto;gap:8px;align-items:baseline;font:400 12px/16px ${SANS}}
.fd-dfs-rh code{font:500 11px/16px ${MONO};color:var(--fd-dfs-mut)}
.fd-dfs-rh b{font:500 11px/16px ${MONO};color:var(--fd-dfs-fg);font-variant-numeric:tabular-nums}
.fd-dfs-bars{display:grid;grid-template-columns:repeat(90,minmax(0,1fr));gap:1px;height:16px;margin-top:5px}
.fd-dfs-bars i{display:block;border-radius:1px;background:var(--fd-dfs-ok);opacity:.82;transition:transform var(--fd-dur-1)}
.fd-dfs-bars i[data-s="minor"]{background:var(--fd-dfs-warn);opacity:1}
.fd-dfs-bars i[data-s="down"]{background:var(--fd-dfs-bad);opacity:1}
.fd-dfs-bars i:hover{transform:scaleY(1.25)}
.fd-dfs-pf{margin-top:12px;padding-top:10px;border-top:1px solid var(--fd-dfs-line);font:400 12px/16px ${SANS};color:var(--fd-dfs-mut)}
.fd-dfs-social{display:flex;gap:4px;margin-top:24px;margin-left:-8px}
.fd-dfs-ico{display:grid;place-items:center;width:34px;height:34px;border-radius:8px;color:var(--fd-dfs-mut);outline:0;transition:color var(--fd-dur-1),background-color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-dfs-ico:hover{color:var(--fd-dfs-fg);background:var(--fd-dfs-soft)}
.fd-dfs-ico:active{transform:scale(.92);transition-duration:var(--fd-dur-1)}
.fd-dfs-cols{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:32px 20px}
.fd-dfs-h{display:block;font:600 13px/18px ${SANS};color:var(--fd-dfs-fg)}
.fd-dfs-col ul{display:grid;gap:9px;margin-top:14px}
.fd-dfs-col li{display:flex;align-items:center;gap:6px;min-width:0}
.fd-dfs-link{color:var(--fd-dfs-mut);border-radius:3px;outline:0;transition:color var(--fd-dur-1)}
.fd-dfs-link:hover{color:var(--fd-dfs-fg)}
.fd-dfs-badge{display:inline-flex;align-items:center;height:17px;padding:0 5px;border-radius:5px;font:500 10px/1 ${MONO};color:var(--fd-dfs-accent);background:color-mix(in srgb,var(--fd-dfs-accent) 9%,transparent)}
.fd-dfs-link:focus-visible,.fd-dfs-ico:focus-visible,.fd-dfs-pill:focus-visible,.fd-dfs-logo:focus-visible,.fd-dfs-a:focus-visible,.fd-dfs-undo:focus-visible,.fd-dfs-field button:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-dfs-accent) 70%,transparent);outline-offset:2px}
.fd-dfs-mid{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-top:48px;padding:24px 0;border-top:1px solid var(--fd-dfs-line);border-bottom:1px solid var(--fd-dfs-line)}
.fd-dfs-news{display:flex;align-items:flex-start;gap:16px 40px;flex-wrap:wrap;flex:1;min-width:0}
.fd-dfs-nt{max-width:280px}
.fd-dfs-nt p{margin-top:2px;color:var(--fd-dfs-mut);font-size:13px;line-height:18px}
.fd-dfs-fwrap{flex:1;min-width:260px;max-width:420px}
.fd-dfs-field{display:flex;align-items:center;gap:4px;height:40px;padding:4px;border-radius:10px;background:var(--fd-dfs-bg);box-shadow:inset 0 0 0 1px #D9D9DD;transition:box-shadow var(--fd-dur-2)}
.fd-dfs-field:focus-within{box-shadow:inset 0 0 0 1px var(--fd-dfs-fg),0 0 0 3px rgba(11,11,12,.07)}
.fd-dfs-field[data-err]{box-shadow:inset 0 0 0 1px var(--fd-dfs-bad),0 0 0 3px color-mix(in srgb,var(--fd-dfs-bad) 14%,transparent);animation:fd-dfs-shake var(--fd-dur-3) var(--fd-ease-out)}
@keyframes fd-dfs-shake{20%{transform:translateX(-4px)}45%{transform:translateX(3px)}70%{transform:translateX(-2px)}}
.fd-dfs-field input{flex:1;min-width:0;height:32px;padding:0 8px;font:400 14px/20px ${MONO};letter-spacing:-.01em;color:var(--fd-dfs-fg);background:transparent}
.fd-dfs-field input::placeholder{color:#A2A2A9}
.fd-dfs-field button{position:relative;display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 12px;border-radius:7px;background:var(--fd-dfs-fg);color:var(--fd-dfs-bg);font:500 13px/1 ${SANS};transition:transform var(--fd-dur-2) var(--fd-spring),opacity var(--fd-dur-1)}
.fd-dfs-field button:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-dfs-field button[data-busy] span{opacity:0}
.fd-dfs-spin{position:absolute;width:14px;height:14px;border-radius:9999px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;animation:fd-dfs-rot .7s linear infinite}
@keyframes fd-dfs-rot{to{transform:rotate(360deg)}}
.fd-dfs-err{min-height:18px;margin-top:6px;font:400 12px/18px ${SANS};color:#C8282E}
.fd-dfs-done{display:flex;gap:12px;align-items:flex-start;flex:1;min-width:260px;max-width:440px;animation:fd-dfs-pop var(--fd-dur-3) var(--fd-ease-out)}
.fd-dfs-done p{font-size:13px;line-height:19px;color:var(--fd-dfs-mut)}
.fd-dfs-done b{font-weight:600;color:var(--fd-dfs-fg);overflow-wrap:anywhere}
.fd-dfs-check{display:grid;place-items:center;flex:none;width:26px;height:26px;border-radius:9999px;background:var(--fd-dfs-ok);color:#fff;animation:fd-dfs-bump var(--fd-dur-3) var(--fd-spring)}
@keyframes fd-dfs-bump{from{transform:scale(.4)}}
.fd-dfs-tick{stroke-dasharray:14;stroke-dashoffset:14;animation:fd-dfs-draw var(--fd-dur-3) var(--fd-ease-out) 120ms forwards}
@keyframes fd-dfs-draw{to{stroke-dashoffset:0}}
.fd-dfs-undo{font:500 13px/19px ${SANS};color:var(--fd-dfs-fg);box-shadow:inset 0 -1px 0 #C9C9CE;border-radius:2px}
.fd-dfs-lang{position:relative;display:flex;align-items:center;flex:none}
.fd-dfs-lang select{height:34px;padding:0 30px 0 32px;border-radius:9999px;box-shadow:inset 0 0 0 1px var(--fd-dfs-line);background:var(--fd-dfs-bg);font:500 13px/1 ${SANS};color:var(--fd-dfs-fg);cursor:pointer;transition:box-shadow var(--fd-dur-1)}
.fd-dfs-lang select:hover{box-shadow:inset 0 0 0 1px #CFCFD4}
.fd-dfs-lang select:focus-visible{box-shadow:inset 0 0 0 1px var(--fd-dfs-fg),0 0 0 3px color-mix(in srgb,var(--fd-dfs-accent) 30%,transparent)}
.fd-dfs-globe{position:absolute;left:11px;color:var(--fd-dfs-mut);pointer-events:none}
.fd-dfs-sel{position:absolute;right:12px;color:var(--fd-dfs-mut);pointer-events:none}
.fd-dfs-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.fd-dfs-legal{display:flex;align-items:center;gap:8px 24px;flex-wrap:wrap;padding-top:20px;font:400 12px/16px ${SANS};color:var(--fd-dfs-mut)}
.fd-dfs-legal ul{display:flex;flex-wrap:wrap;gap:6px 18px}
.fd-dfs-soc{margin-left:auto}
.fd-dfs-build{font:400 11px/16px ${MONO};color:var(--fd-dfs-mut)}
.fd-dfs-build span{color:var(--fd-dfs-accent);font-size:8px}
@media (max-width:1100px){
  .fd-dfs-grid{grid-template-columns:1fr}
  .fd-dfs-cols{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media (max-width:640px){
  .fd-dfs-cols{grid-template-columns:1fr 1fr}
  .fd-dfs-mid{flex-direction:column}
  .fd-dfs-news{flex-direction:column;width:100%}
  .fd-dfs-fwrap,.fd-dfs-done{width:100%;max-width:none;min-width:0}
  .fd-dfs-soc{margin-left:0}
}
@media (prefers-reduced-motion:reduce){.fd-dfs *{animation:none!important;transition-duration:1ms!important}.fd-dfs-tick{stroke-dashoffset:0}}
@media (prefers-contrast:more){.fd-dfs{--fd-dfs-mut:#3A3A40;--fd-dfs-line:#9A9AA0}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

export function Demo() {
  const [vote, setVote] = useState<null | "yes" | "no">(null);
  return (
    <div className="fd-dfsd">
      <style>{demoCss}</style>
      <section className="fd-dfsd-end" aria-label="End of article">
        <div className="fd-dfsd-row">
          <div className="fd-dfsd-help">
            {vote ? (
              <p role="status">{vote === "yes" ? "Thanks. We read every vote." : "Thanks. Tell us what was missing in #docs on Discord."}</p>
            ) : (
              <>
                <p>Was this page helpful?</p>
                <button type="button" onClick={() => setVote("yes")}>Yes</button>
                <button type="button" onClick={() => setVote("no")}>No</button>
              </>
            )}
          </div>
          <p className="fd-dfsd-edit">Last edited 4 days ago · <a href="#">Edit on GitHub</a></p>
        </div>
        <div className="fd-dfsd-pager">
          <a href="#"><span>Previous</span><b>Retries and backoff</b></a>
          <a href="#" data-next=""><span>Next</span><b>Dead-letter queues</b></a>
        </div>
      </section>
      <DevFooterStatus />
    </div>
  );
}

const demoCss = `
:where(.fd-dfsd,.fd-dfsd *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none}
:where(.fd-dfsd button){appearance:none;-webkit-appearance:none;cursor:pointer;outline:0}
.fd-dfsd{min-height:100vh;background:#FFFFFF;color:#0B0B0C;font:400 14px/20px ${SANS};-webkit-font-smoothing:antialiased}
.fd-dfsd-end{max-width:760px;margin:0 auto;padding:48px 16px 64px}
.fd-dfsd-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding-bottom:24px;border-bottom:1px solid #E8E8EA}
.fd-dfsd-help{display:flex;align-items:center;gap:8px;min-height:30px;color:#66666E}
.fd-dfsd-help button{height:28px;padding:0 12px;border-radius:9999px;box-shadow:inset 0 0 0 1px #E2E2E5;font-size:13px;color:#0B0B0C}
.fd-dfsd-help button:hover{background:#F6F6F7}
.fd-dfsd-help button:focus-visible,.fd-dfsd-pager a:focus-visible{outline:2px solid rgba(240,78,35,.7);outline-offset:2px}
.fd-dfsd-edit{font-size:13px;color:#66666E}.fd-dfsd-edit a{color:#0B0B0C;box-shadow:inset 0 -1px 0 #D0D0D4}
.fd-dfsd-pager{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}
.fd-dfsd-pager a{display:block;padding:16px 18px;border-radius:12px;box-shadow:inset 0 0 0 1px #E8E8EA;transition:box-shadow 120ms}
.fd-dfsd-pager a:hover{box-shadow:inset 0 0 0 1px #0B0B0C}
.fd-dfsd-pager a[data-next]{text-align:right}
.fd-dfsd-pager span{display:block;font-size:12px;color:#66666E}
.fd-dfsd-pager b{display:block;margin-top:2px;font-weight:600;font-size:15px}
`;
