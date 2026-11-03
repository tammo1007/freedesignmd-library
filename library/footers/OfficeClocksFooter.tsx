/**
 * OfficeClocksFooter, a light footer for a practice with studios on four
 * continents. Every studio shows its live local time on a small analog dial
 * and in digits, whether it is open right now, its address and phone. A 24-hour
 * UTC ruler underneath draws each studio's working day as a band with a "now"
 * line, so you can see at a glance who is still at their desk. Hovering a
 * studio highlights its band. Sitemap links and a quarterly newsletter sit
 * above.
 *
 * Props: name, offices (city, timeZone, open/close "HH:MM", days 0-6 with
 * 0 = Sunday, address, phone), columns, legal.
 * CSS vars: --fd-ocf-bg, --fd-ocf-fg, --fd-ocf-accent.
 *
 * Time: computed with Intl.DateTimeFormat for each IANA zone, refreshed on
 * every minute boundary and when the tab becomes visible again.
 * SSR: renders "--:--" placeholders, real times appear after mount (no
 * hydration mismatch).
 * Accessibility: each studio is a labelled group, open state is text, the
 * ruler is aria-hidden (its content repeats the text). Newsletter has a real
 * label, inline error tied with aria-describedby and a polite success message.
 * Reduced motion: hands jump instead of sweeping.
 */
import { useEffect, useId, useMemo, useState } from "react";
import type { FormEvent } from "react";

export interface OcfOffice {
  city: string;
  country: string;
  timeZone: string;
  open: string;
  close: string;
  days?: number[];
  address: string[];
  phone: string;
}
export interface OcfColumn { title: string; links: { label: string; href: string }[] }

export interface OfficeClocksFooterProps {
  name?: string;
  offices?: OcfOffice[];
  columns?: OcfColumn[];
  legal?: string[];
  className?: string;
}

const DEFAULT_OFFICES: OcfOffice[] = [
  { city: "Copenhagen", country: "Denmark", timeZone: "Europe/Copenhagen", open: "09:00", close: "18:00", address: ["Strandgade 27B", "1401 København K"], phone: "+45 32 57 81 00" },
  { city: "Lagos", country: "Nigeria", timeZone: "Africa/Lagos", open: "08:30", close: "17:30", address: ["14 Idowu Taylor Street", "Victoria Island"], phone: "+234 1 271 4402" },
  { city: "Singapore", country: "Singapore", timeZone: "Asia/Singapore", open: "09:00", close: "18:30", address: ["61 Duxton Road, #03-01", "Singapore 089525"], phone: "+65 6221 0938" },
  { city: "Mexico City", country: "Mexico", timeZone: "America/Mexico_City", open: "09:30", close: "18:30", address: ["Colima 284, Roma Norte", "06700 CDMX"], phone: "+52 55 5584 2271" },
];

const DEFAULT_COLUMNS: OcfColumn[] = [
  { title: "Practice", links: [{ label: "Approach", href: "#" }, { label: "People", href: "#" }, { label: "Research", href: "#" }, { label: "Awards", href: "#" }] },
  { title: "Work", links: [{ label: "Civic", href: "#" }, { label: "Housing", href: "#" }, { label: "Education", href: "#" }, { label: "Adaptive reuse", href: "#" }] },
  { title: "Join", links: [{ label: "Open roles (6)", href: "#" }, { label: "Internships", href: "#" }, { label: "Press kit", href: "#" }, { label: "Contact", href: "#" }] },
];

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const hhmm = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;

interface Local { mins: number; day: number; offset: number; abbr: string }

function localOf(now: number, timeZone: string): Local {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", weekday: "short", hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit", timeZoneName: "short" }).formatToParts(new Date(now));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24, minute = Number(get("minute"));
  const asUtc = Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), hour, minute);
  const offset = Math.round((asUtc - Math.floor(now / 60000) * 60000) / 60000);
  return { mins: hour * 60 + minute, day: WD.indexOf(get("weekday")), offset, abbr: get("timeZoneName") };
}

function statusOf(o: OcfOffice, l: Local) {
  const days = o.days ?? [1, 2, 3, 4, 5];
  const a = toMin(o.open), b = toMin(o.close);
  if (days.includes(l.day) && l.mins >= a && l.mins < b) {
    const left = b - l.mins;
    return { open: true, text: left <= 60 ? `Open, closes in ${left} min` : `Open until ${o.close}` };
  }
  if (days.includes(l.day) && l.mins < a) return { open: false, text: `Closed, opens ${o.open}` };
  for (let k = 1; k <= 7; k++) {
    const d = (l.day + k) % 7;
    if (days.includes(d)) return { open: false, text: `Closed, opens ${k === 1 ? "tomorrow" : WD[d]} ${o.open}` };
  }
  return { open: false, text: "Closed" };
}

const utcLabel = (off: number) => {
  if (off === 0) return "UTC";
  const s = off > 0 ? "+" : "−";
  const a = Math.abs(off);
  return `UTC${s}${Math.floor(a / 60)}${a % 60 ? ":" + String(a % 60).padStart(2, "0") : ""}`;
};

function useMinuteClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      t = setTimeout(tick, 60000 - (n % 60000) + 30);
    };
    tick();
    const vis = () => { if (!document.hidden) { clearTimeout(t); tick(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", vis); };
  }, []);
  return now;
}

function Dial({ total, open }: { total: number | null; open: boolean }) {
  const m = total ?? 0;
  return (
    <svg className="fd-ocf-dial" viewBox="0 0 64 64" aria-hidden="true" data-open={open ? "" : undefined}>
      <circle cx="32" cy="32" r="30.5" className="fd-ocf-face" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="32" y1={i % 3 === 0 ? 4.5 : 5.5} x2="32" y2={i % 3 === 0 ? 10 : 8} transform={`rotate(${i * 30} 32 32)`} className="fd-ocf-tick" />
      ))}
      <g className="fd-ocf-hand" style={{ transform: `rotate(${total === null ? 0 : m * 0.5}deg)` }}>
        <line x1="32" y1="35" x2="32" y2="17" className="fd-ocf-hh" />
      </g>
      <g className="fd-ocf-hand" style={{ transform: `rotate(${total === null ? 0 : m * 6}deg)` }}>
        <line x1="32" y1="37" x2="32" y2="9" className="fd-ocf-mh" />
      </g>
      <circle cx="32" cy="32" r="2.4" className="fd-ocf-pin" />
    </svg>
  );
}

export function OfficeClocksFooter({
  name = "Hallberg Adeyemi",
  offices = DEFAULT_OFFICES,
  columns = DEFAULT_COLUMNS,
  legal = ["© 2026 Hallberg Adeyemi Arkitekter ApS", "CVR 41228790"],
  className,
}: OfficeClocksFooterProps) {
  const now = useMinuteClock();
  const uid = useId();
  const [hot, setHot] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "error" | "sent">("idle");

  const locals = useMemo(() => (now === null ? null : offices.map((o) => localOf(now, o.timeZone))), [now, offices]);
  const utcMin = now === null ? null : Math.floor((now % 86400000) / 60000);
  const openCount = locals ? offices.filter((o, i) => statusOf(o, locals[i]).open).length : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setState("error"); return; }
    setState("sent");
  };

  return (
    <footer className={`fd-ocf${className ? " " + className : ""}`}>
      <style>{css}</style>
      <div className="fd-ocf-in">
        <div className="fd-ocf-top">
          <div className="fd-ocf-lead">
            <p className="fd-ocf-mark">{name}<span aria-hidden="true">/</span><small>Architects</small></p>
            <p className="fd-ocf-say">Four studios, one drawing set. Someone here is always awake, {openCount === null ? "and" : openCount === 1 ? "one studio is" : `${openCount} studios are`} at their desks right now.</p>
          </div>
          <nav className="fd-ocf-cols" aria-label="Footer">
            {columns.map((c) => (
              <div key={c.title}>
                <h3 className="fd-ocf-lab">{c.title}</h3>
                <ul>{c.links.map((l) => <li key={l.label}><a className="fd-ocf-a" href={l.href}>{l.label}</a></li>)}</ul>
              </div>
            ))}
          </nav>
          <form className="fd-ocf-news" onSubmit={submit} noValidate>
            <label className="fd-ocf-lab" htmlFor={`${uid}-e`}>Field Notes, quarterly</label>
            <p className="fd-ocf-nd">Drawings, site photos and one long essay. Four letters a year, never more.</p>
            {state === "sent" ? (
              <p className="fd-ocf-ok" role="status">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 8.5l3 3 7-7" /></svg>
                Subscribed. Issue 19 lands on 1 December.
              </p>
            ) : (
              <div className="fd-ocf-field" data-error={state === "error" ? "" : undefined}>
                <input
                  id={`${uid}-e`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@studio.com"
                  value={email}
                  aria-invalid={state === "error"}
                  aria-describedby={state === "error" ? `${uid}-err` : undefined}
                  onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
                />
                <button type="submit">Subscribe</button>
              </div>
            )}
            {state === "error" && <p className="fd-ocf-err" id={`${uid}-err`}>That address looks incomplete. Try name@domain.com.</p>}
          </form>
        </div>

        <ul className="fd-ocf-offices" aria-label="Studios">
          {offices.map((o, i) => {
            const l = locals?.[i];
            const st = l ? statusOf(o, l) : null;
            const total = now !== null && l ? Math.floor(now / 60000) + l.offset : null;
            return (
              <li
                key={o.city}
                className="fd-ocf-office"
                data-hot={hot === i ? "" : undefined}
                onMouseEnter={() => setHot(i)}
                onMouseLeave={() => setHot(null)}
                onFocus={() => setHot(i)}
                onBlur={() => setHot(null)}
                aria-label={`${o.city} studio`}
              >
                <div className="fd-ocf-oh">
                  <div>
                    <h3 className="fd-ocf-city">{o.city}</h3>
                    <p className="fd-ocf-tz">{o.country}, {l ? utcLabel(l.offset) : "UTC"}</p>
                  </div>
                  <Dial total={total} open={!!st?.open} />
                </div>
                <p className="fd-ocf-time">
                  <time data-pending={l ? undefined : ""}>{l ? hhmm(l.mins) : "00:00"}</time>
                  <span>{l ? WD[l.day] : ""}</span>
                </p>
                <p className="fd-ocf-st" data-open={st?.open ? "" : undefined}>
                  <i aria-hidden="true" />{st ? st.text : "Checking hours"}
                </p>
                <address className="fd-ocf-addr">
                  {o.address.map((a) => <span key={a}>{a}</span>)}
                  <a className="fd-ocf-a" href={`tel:${o.phone.replace(/\s/g, "")}`}>{o.phone}</a>
                </address>
              </li>
            );
          })}
        </ul>

        <div className="fd-ocf-ruler" aria-hidden="true">
          <div className="fd-ocf-rh"><span>Working hours, UTC</span><span>{utcMin === null ? "" : `Now ${hhmm(utcMin)} UTC`}</span></div>
          <div className="fd-ocf-track">
            {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
              <span key={h} className="fd-ocf-hr" data-end={h === 24 ? "" : undefined} style={{ left: `${(h / 24) * 100}%` }}><b>{String(h % 24).padStart(2, "0")}</b></span>
            ))}
            {offices.map((o, i) => {
              const off = locals?.[i]?.offset;
              if (off === undefined) return null;
              const a = toMin(o.open) - off, b = toMin(o.close) - off;
              const segs: [number, number][] = [];
              const s = ((a % 1440) + 1440) % 1440, len = b - a;
              if (s + len <= 1440) segs.push([s, s + len]); else { segs.push([s, 1440]); segs.push([0, s + len - 1440]); }
              const st = locals ? statusOf(o, locals[i]) : null;
              return (
                <div key={o.city} className="fd-ocf-row" style={{ top: `${28 + i * 16}px` }} data-hot={hot === i ? "" : undefined} data-dim={hot !== null && hot !== i ? "" : undefined} data-open={st?.open ? "" : undefined}>
                  {segs.map(([x, y], k) => (
                    <span key={k} className="fd-ocf-band" data-flip={y / 1440 > 0.8 ? "" : undefined} style={{ left: `${(x / 1440) * 100}%`, width: `${((y - x) / 1440) * 100}%` }}>
                      {k === 0 && <em>{o.city}</em>}
                    </span>
                  ))}
                </div>
              );
            })}
            {utcMin !== null && <span className="fd-ocf-now" style={{ left: `${(utcMin / 1440) * 100}%` }} />}
          </div>
        </div>

        <div className="fd-ocf-legal">
          <ul>
            {legal.map((l) => <li key={l}>{l}</li>)}
            <li><a className="fd-ocf-a" href="#">Privacy</a></li>
            <li><a className="fd-ocf-a" href="#">Imprint</a></li>
          </ul>
          <ul>
            <li><a className="fd-ocf-a" href="#">Instagram</a></li>
            <li><a className="fd-ocf-a" href="#">LinkedIn</a></li>
            <li><a className="fd-ocf-a" href="#">Dezeen profile</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

const SANS = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const MONO = `ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace`;

const css = `
:where(.fd-ocf,.fd-ocf *){box-sizing:border-box;margin:0;padding:0;border:0;background:none;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;font-style:normal}
:where(.fd-ocf,.fd-ocf *)::before,:where(.fd-ocf,.fd-ocf *)::after{box-sizing:border-box}
:where(.fd-ocf svg){display:block;flex-shrink:0}
:where(.fd-ocf button,.fd-ocf input){appearance:none;-webkit-appearance:none;border-radius:0;outline:0}
.fd-ocf{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-ocf-bg:#E8E5DF;--fd-ocf-fg:#171614;--fd-ocf-mut:#6B665E;--fd-ocf-line:rgba(23,22,20,.14);--fd-ocf-line2:rgba(23,22,20,.28);--fd-ocf-accent:#B23B22;--fd-ocf-ok:#2F6B3A;
  display:block;width:100%;background:var(--fd-ocf-bg);color:var(--fd-ocf-fg);font:400 15px/22px ${SANS};letter-spacing:-.005em;-webkit-font-smoothing:antialiased}
.fd-ocf-in{max-width:1440px;margin:0 auto;padding:clamp(48px,6vw,80px) clamp(16px,3.4vw,48px) 28px}
.fd-ocf-top{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1fr);gap:40px clamp(28px,4vw,64px);padding-bottom:48px}
.fd-ocf-mark{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font:700 20px/24px ${SANS};letter-spacing:-.02em;text-transform:uppercase}
.fd-ocf-mark span{color:var(--fd-ocf-accent);font-weight:400}
.fd-ocf-mark small{font:500 12px/16px ${MONO};letter-spacing:.04em;color:var(--fd-ocf-mut);text-transform:none}
.fd-ocf-say{margin-top:20px;max-width:420px;font:400 clamp(1.25rem,1.8vw,1.5rem)/1.3 ${SANS};letter-spacing:-.015em;color:var(--fd-ocf-fg)}
.fd-ocf-lab{display:block;font:500 11px/16px ${MONO};letter-spacing:.08em;text-transform:uppercase;color:var(--fd-ocf-mut)}
.fd-ocf-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.fd-ocf-cols ul{display:grid;gap:7px;margin-top:14px}
.fd-ocf-a{color:inherit;border-radius:1px;background:linear-gradient(currentColor,currentColor) 0 100%/0 1px no-repeat;transition:background-size var(--fd-dur-3) var(--fd-ease-out),color var(--fd-dur-1)}
.fd-ocf-a:hover{background-size:100% 1px;color:var(--fd-ocf-accent)}
.fd-ocf-a:focus-visible,.fd-ocf-field button:focus-visible{outline:2px solid color-mix(in srgb,var(--fd-ocf-accent) 70%,transparent);outline-offset:2px}
.fd-ocf-nd{margin-top:10px;font:400 14px/20px ${SANS};color:var(--fd-ocf-mut);max-width:320px}
.fd-ocf-field{display:flex;margin-top:14px;height:44px;box-shadow:inset 0 -1px 0 var(--fd-ocf-fg);transition:box-shadow var(--fd-dur-2)}
.fd-ocf-field:focus-within{box-shadow:inset 0 -2px 0 var(--fd-ocf-fg)}
.fd-ocf-field[data-error]{box-shadow:inset 0 -2px 0 var(--fd-ocf-accent)}
.fd-ocf-field input{flex:1;min-width:0;height:44px;font:400 15px/22px ${SANS};color:var(--fd-ocf-fg);background:transparent}
.fd-ocf-field input::placeholder{color:#9A958C}
.fd-ocf-field button{display:inline-flex;align-items:center;height:44px;padding:0 2px 0 12px;font:600 14px/1 ${SANS};color:var(--fd-ocf-fg);cursor:pointer;transition:color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-ocf-field button:hover{color:var(--fd-ocf-accent)}
.fd-ocf-field button:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-ocf-err{margin-top:8px;font:400 13px/18px ${SANS};color:var(--fd-ocf-accent)}
.fd-ocf-ok{display:flex;align-items:center;gap:8px;margin-top:14px;height:44px;font:500 14px/20px ${SANS};color:var(--fd-ocf-ok);box-shadow:inset 0 -1px 0 var(--fd-ocf-line2);animation:fd-ocf-in var(--fd-dur-3) var(--fd-ease-out)}
@keyframes fd-ocf-in{from{opacity:0;transform:translateY(6px)}}
.fd-ocf-offices{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--fd-ocf-fg)}
.fd-ocf-office{position:relative;padding:20px clamp(14px,1.6vw,24px) 24px;border-left:1px solid var(--fd-ocf-line);transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-ocf-office:first-child{border-left:0;padding-left:0}
.fd-ocf-office[data-hot]{background:linear-gradient(rgba(23,22,20,.035),transparent)}
.fd-ocf-oh{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.fd-ocf-city{font:600 17px/22px ${SANS};letter-spacing:-.01em}
.fd-ocf-tz{margin-top:2px;font:400 12px/16px ${MONO};color:var(--fd-ocf-mut)}
.fd-ocf-dial{width:52px;height:52px}
.fd-ocf-face{fill:none;stroke:var(--fd-ocf-line2);stroke-width:1}
.fd-ocf-dial[data-open] .fd-ocf-face{fill:#F4F2EE;stroke:var(--fd-ocf-fg)}
.fd-ocf-tick{stroke:var(--fd-ocf-fg);stroke-width:1.2;stroke-linecap:round;opacity:.55}
.fd-ocf-hand{transform-origin:32px 32px;transform-box:view-box;transition:transform var(--fd-dur-4) var(--fd-spring)}
.fd-ocf-hh{stroke:var(--fd-ocf-fg);stroke-width:3;stroke-linecap:round}
.fd-ocf-mh{stroke:var(--fd-ocf-fg);stroke-width:1.6;stroke-linecap:round}
.fd-ocf-dial[data-open] .fd-ocf-mh{stroke:var(--fd-ocf-accent)}
.fd-ocf-pin{fill:var(--fd-ocf-bg);stroke:var(--fd-ocf-fg);stroke-width:1.4}
.fd-ocf-time{display:flex;align-items:baseline;gap:10px;margin-top:18px}
.fd-ocf-time time{font:300 clamp(2.5rem,4.2vw,3.75rem)/1 ${SANS};letter-spacing:-.045em;font-variant-numeric:tabular-nums}
.fd-ocf-time time[data-pending]{opacity:.12}
.fd-ocf-time span{font:500 12px/16px ${MONO};color:var(--fd-ocf-mut);text-transform:uppercase;letter-spacing:.06em}
.fd-ocf-st{display:flex;align-items:center;gap:8px;margin-top:10px;font:500 13px/18px ${SANS};color:var(--fd-ocf-mut)}
.fd-ocf-st i{display:block;width:7px;height:7px;border-radius:9999px;box-shadow:inset 0 0 0 1.4px currentColor}
.fd-ocf-st[data-open]{color:var(--fd-ocf-ok)}
.fd-ocf-st[data-open] i{background:currentColor;box-shadow:0 0 0 3px color-mix(in srgb,var(--fd-ocf-ok) 18%,transparent)}
.fd-ocf-addr{display:flex;flex-direction:column;align-items:flex-start;margin-top:16px;padding-top:14px;border-top:1px dashed var(--fd-ocf-line2);font:400 14px/20px ${SANS};color:var(--fd-ocf-fg)}
.fd-ocf-addr .fd-ocf-a{margin-top:6px;font:400 13px/18px ${MONO};color:var(--fd-ocf-mut)}
.fd-ocf-ruler{margin-top:8px;padding:16px 0 20px;border-top:1px solid var(--fd-ocf-line)}
.fd-ocf-rh{display:flex;justify-content:space-between;font:500 11px/16px ${MONO};letter-spacing:.06em;text-transform:uppercase;color:var(--fd-ocf-mut)}
.fd-ocf-rh span:last-child{color:var(--fd-ocf-accent)}
.fd-ocf-track{position:relative;height:100px;margin-top:10px;overflow:hidden}
.fd-ocf-hr{position:absolute;top:0;bottom:0;width:0;border-left:1px solid var(--fd-ocf-line)}
.fd-ocf-hr b{position:absolute;top:0;left:4px;font:400 10px/12px ${MONO};color:var(--fd-ocf-mut)}
.fd-ocf-hr[data-end] b{left:auto;right:4px}
.fd-ocf-band[data-flip] em{left:auto;right:100%;margin:0 8px 0 0}
.fd-ocf-row{position:absolute;left:0;right:0;height:10px;transition:opacity var(--fd-dur-2)}
.fd-ocf-row[data-dim]{opacity:.3}
.fd-ocf-band{position:absolute;top:0;height:10px;background:var(--fd-ocf-line2);border-radius:2px}
.fd-ocf-row[data-open] .fd-ocf-band{background:var(--fd-ocf-fg)}
.fd-ocf-row[data-hot] .fd-ocf-band{background:var(--fd-ocf-accent)}
.fd-ocf-band em{position:absolute;left:100%;top:-3px;margin-left:8px;font:500 11px/16px ${MONO};color:var(--fd-ocf-mut);white-space:nowrap}
.fd-ocf-now{position:absolute;top:18px;bottom:-2px;width:0;border-left:1.5px solid var(--fd-ocf-accent)}
.fd-ocf-now::before{content:"";position:absolute;left:-4.5px;top:-4px;width:8px;height:8px;border-radius:9999px;background:var(--fd-ocf-accent)}
.fd-ocf-legal{display:flex;justify-content:space-between;gap:12px 32px;flex-wrap:wrap;padding-top:20px;border-top:1px solid var(--fd-ocf-line);font:400 12px/16px ${MONO};color:var(--fd-ocf-mut)}
.fd-ocf-legal ul{display:flex;flex-wrap:wrap;gap:6px 20px}
@media (max-width:1080px){
  .fd-ocf-top{grid-template-columns:1fr 1fr}
  .fd-ocf-lead{grid-column:1/-1}
  .fd-ocf-offices{grid-template-columns:1fr 1fr}
  .fd-ocf-office:nth-child(3){border-left:0;padding-left:0}
  .fd-ocf-office:nth-child(n+3){border-top:1px solid var(--fd-ocf-line)}
}
@media (max-width:640px){
  .fd-ocf-top{grid-template-columns:1fr}
  .fd-ocf-cols{grid-template-columns:1fr 1fr}
  .fd-ocf-cols>div:last-child{grid-column:1/-1}
  .fd-ocf-offices{grid-template-columns:1fr}
  .fd-ocf-office{border-left:0;padding-left:0;padding-right:0}
  .fd-ocf-office+.fd-ocf-office{border-top:1px solid var(--fd-ocf-line)}
  .fd-ocf-time time{font-size:2.75rem}
  .fd-ocf-band em{display:none}
}
@media (prefers-reduced-motion:reduce){.fd-ocf *{transition-duration:1ms!important;animation:none!important}}
@media (prefers-contrast:more){.fd-ocf{--fd-ocf-mut:#45413B;--fd-ocf-line:rgba(23,22,20,.45)}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const SPEC: [string, string][] = [
  ["Client", "Aarhus Kommune"],
  ["Programme", "Public library, 3 reading rooms, roof garden"],
  ["Area", "12,400 m²"],
  ["Timber", "Cross-laminated spruce, 2,310 m³"],
  ["Completed", "September 2025"],
  ["Team", "Copenhagen with Lagos"],
];

export function Demo() {
  return (
    <div className="fd-ocfd">
      <style>{demoCss}</style>
      <section className="fd-ocfd-end" aria-label="Project data">
        <p className="fd-ocfd-n">Project 112</p>
        <div>
          <h2>Havnehuset Library, Aarhus</h2>
          <dl>
            {SPEC.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
      </section>
      <OfficeClocksFooter />
    </div>
  );
}

const demoCss = `
:where(.fd-ocfd,.fd-ocfd *){box-sizing:border-box;margin:0;padding:0;border:0;font:inherit;letter-spacing:inherit;color:inherit}
.fd-ocfd{min-height:100vh;background:#F3F1EC;color:#171614;font:400 15px/22px ${SANS};-webkit-font-smoothing:antialiased}
.fd-ocfd-end{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2.4fr);gap:24px;max-width:1440px;margin:0 auto;padding:56px clamp(16px,3.4vw,48px) 64px}
.fd-ocfd-n{font:500 12px/16px ${MONO};letter-spacing:.06em;text-transform:uppercase;color:#6B665E}
.fd-ocfd-end h2{font:500 clamp(1.75rem,3vw,2.5rem)/1.1 ${SANS};letter-spacing:-.03em}
.fd-ocfd-end dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:28px;border-top:1px solid rgba(23,22,20,.14)}
.fd-ocfd-end dl div{padding:14px 16px 14px 0;border-bottom:1px solid rgba(23,22,20,.14)}
.fd-ocfd-end dt{font:500 11px/16px ${MONO};letter-spacing:.06em;text-transform:uppercase;color:#6B665E}
.fd-ocfd-end dd{margin-top:4px}
@media (max-width:760px){.fd-ocfd-end{grid-template-columns:1fr}.fd-ocfd-end dl{grid-template-columns:1fr 1fr}}
`;
