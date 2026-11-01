/**
 * MagneticDock — a macOS-style dock. Icons grow with a gaussian falloff
 * around the cursor, the bar widens with them, labels float above on hover
 * or focus, launching an app bounces it, and running apps get a dot.
 *
 * Props
 * - apps: { id, label, icon: ReactNode, running?: boolean, badge?: number }[]
 * - onLaunch?: (id) => void
 * - size?: number           Base icon size in px. Default 52 (44 under 640px).
 * - magnify?: number        Peak scale. Default 1.75.
 * - spread?: number         Gaussian sigma in icon widths. Default 1.25.
 * - separatorAfter?: number Draw a divider after this index.
 * CSS vars: --fd-dock-bg, --fd-dock-border, --fd-dock-tip-bg, --fd-dock-tip-fg.
 *
 * Accessibility: a real toolbar of <button>s with roving tabindex. ← → Home
 * End move focus (focus also magnifies), Enter / Space launch. Badges and
 * running state are in each button's accessible name.
 * Motion: per-icon spring on scale (380 / 30); layout reflows via width so
 * neighbours make room. Reduced motion or touch: no magnification, bounce
 * becomes a short opacity blink.
 * Browser support: all evergreen browsers (backdrop-filter optional).
 */
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export type DockApp = { id: string; label: string; icon: ReactNode; running?: boolean; badge?: number };

export interface MagneticDockProps {
  apps: DockApp[];
  onLaunch?: (id: string) => void;
  size?: number;
  magnify?: number;
  spread?: number;
  separatorAfter?: number;
  className?: string;
}

export function MagneticDock({ apps, onLaunch, size = 52, magnify = 1.75, spread = 1.25, separatorAfter, className }: MagneticDockProps) {
  const bar = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState(0);
  const [bouncing, setBouncing] = useState<string | null>(null);
  const focusX = useRef<number | null>(null);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
    if (reduced || !fine) return;
    const n = apps.length;
    const sc = new Float32Array(n).fill(1);
    const vs = new Float32Array(n);
    const tg = new Float32Array(n).fill(1);
    const centers = new Float32Array(n);
    let base = size;
    let mx: number | null = null;
    let raf = 0;
    let last = 0;

    // centres measured from the un-magnified layout (offsetLeft at rest is stable enough;
    // we compute from index so magnification never feeds back into the input)
    const measure = () => {
      base = el.clientWidth < 1 ? size : parseFloat(getComputedStyle(el).getPropertyValue("--fd-dock-size")) || size;
    };
    const restCenters = () => {
        if (!items.current[0]) return;
      const r0 = el.getBoundingClientRect();
      // rest layout: icons packed with gap; reconstruct from the bar's centre so it is symmetric
      const gap = parseFloat(getComputedStyle(el.firstElementChild as Element).columnGap || "0") || 0;
      let extra = 0;
      const ws: number[] = [];
      for (let i = 0; i < n; i++) {
        ws.push(base);
        if (separatorAfter !== undefined && i === separatorAfter) extra += 17;
      }
      const total = ws.reduce((a, b) => a + b, 0) + gap * (n - 1) + extra;
      let x = r0.left + r0.width / 2 - total / 2;
      for (let i = 0; i < n; i++) {
        centers[i] = x + base / 2;
        x += base + gap + (separatorAfter !== undefined && i === separatorAfter ? 17 : 0);
      }
    };

    const tick = (t: number) => {
      raf = 0;
      const dt = Math.min(0.032, (t - last) / 1000 || 0.016);
      last = t;
      const src = mx ?? focusX.current;
      if (src !== null) restCenters();
      const sig = spread * base;
      let moving = false;
      for (let i = 0; i < n; i++) {
        if (src === null) tg[i] = 1;
        else {
          const d = src - centers[i];
          tg[i] = 1 + (magnify - 1) * Math.exp(-(d * d) / (2 * sig * sig));
        }
        const h = dt / 2;
        for (let k = 0; k < 2; k++) {
          vs[i] += (-520 * (sc[i] - tg[i]) - 36 * vs[i]) * h;
          sc[i] += vs[i] * h;
        }
        if (Math.abs(sc[i] - tg[i]) > 0.001 || Math.abs(vs[i]) > 0.01) moving = true;
      }
      for (let i = 0; i < n; i++) {
        const it = items.current[i];
        if (it) it.style.setProperty("--s", sc[i].toFixed(4));
      }
      if (moving || src !== null) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      kick();
    };
    const onLeave = () => {
      mx = null;
      kick();
    };
    measure();
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    const onFocusMove = () => kick();
    el.addEventListener("fd-dock-focus", onFocusMove);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("fd-dock-focus", onFocusMove);
      window.removeEventListener("resize", measure);
    };
  }, [apps.length, size, magnify, spread, separatorAfter]);

  const launch = (id: string) => {
    setBouncing(null);
    requestAnimationFrame(() => setBouncing(id));
    onLaunch?.(id);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = apps.length;
    let next = focus;
    if (e.key === "ArrowRight") next = (focus + 1) % n;
    else if (e.key === "ArrowLeft") next = (focus - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    setFocus(next);
    btns.current[next]?.focus();
  };

  const onFocusBtn = (i: number) => {
    setFocus(i);
    const b = btns.current[i];
    if (b && b.matches(":focus-visible")) {
      const r = b.getBoundingClientRect();
      focusX.current = r.left + r.width / 2;
      bar.current?.dispatchEvent(new Event("fd-dock-focus"));
    }
  };
  const onBlurBtn = () => {
    focusX.current = null;
    bar.current?.dispatchEvent(new Event("fd-dock-focus"));
  };

  return (
    <div className={`fd-dock${className ? " " + className : ""}`} style={{ ["--fd-dock-size" as string]: `${size}px`, ["--fd-dock-mag" as string]: magnify }}>
      <style>{css}</style>
      <div ref={bar} className="fd-dock-bar" role="toolbar" aria-label="Dock" onKeyDown={onKey}>
        <ul className="fd-dock-list">
          {apps.map((a, i) => (
            <li
              key={a.id}
              ref={(n) => { items.current[i] = n; }}
              className="fd-dock-item"
              data-sep={separatorAfter === i ? "" : undefined}
              data-bounce={bouncing === a.id ? "" : undefined}
              onAnimationEnd={() => setBouncing((b) => (b === a.id ? null : b))}
            >
              <button
                ref={(n) => { btns.current[i] = n; }}
                type="button"
                className="fd-dock-btn"
                tabIndex={i === focus ? 0 : -1}
                aria-label={`${a.label}${a.badge ? `, ${a.badge} new` : ""}${a.running ? ", running" : ""}`}
                onClick={() => launch(a.id)}
                onFocus={() => onFocusBtn(i)}
                onBlur={onBlurBtn}
              >
                <span className="fd-dock-icon" aria-hidden="true">{a.icon}</span>
                {a.badge ? <span className="fd-dock-badge" aria-hidden="true">{a.badge > 99 ? "99+" : a.badge}</span> : null}
              </button>
              <span className="fd-dock-tip" aria-hidden="true">{a.label}</span>
              <span className="fd-dock-dot" data-on={a.running ? "" : undefined} aria-hidden="true" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const css = `
.fd-dock,.fd-dock *,.fd-dock *::before,.fd-dock *::after{box-sizing:border-box}
.fd-dock{--fd-dock-bg:rgba(246,246,248,.42);--fd-dock-border:rgba(255,255,255,.45);--fd-dock-tip-bg:rgba(28,28,34,.86);--fd-dock-tip-fg:#F5F5F7;
  --fd-dock-pad:8px;display:flex;justify-content:center;margin:0;padding:0;font:500 13px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",sans-serif}
.fd-dock-bar{position:relative;display:flex;align-items:flex-end;margin:0;padding:var(--fd-dock-pad) 10px;border-radius:calc(var(--fd-dock-size) * .44 + var(--fd-dock-pad));
  background:var(--fd-dock-bg);-webkit-backdrop-filter:blur(28px) saturate(1.8);backdrop-filter:blur(28px) saturate(1.8);
  box-shadow:inset 0 0 0 1px var(--fd-dock-border),inset 0 1px 0 rgba(255,255,255,.5),0 20px 50px -18px rgba(10,10,20,.5),0 2px 8px rgba(10,10,20,.12)}
.fd-dock-list{display:flex;align-items:flex-end;gap:6px;margin:0;padding:0;list-style:none}
.fd-dock-item{--s:1;position:relative;display:flex;flex-direction:column;align-items:center;margin:0;padding:0;list-style:none;
  width:calc(var(--fd-dock-size) * var(--s));height:var(--fd-dock-size);will-change:width}
.fd-dock-item[data-sep]{margin-right:17px}
.fd-dock-item[data-sep]::after{content:"";position:absolute;right:-12px;bottom:4px;width:1px;height:calc(var(--fd-dock-size) - 8px);background:rgba(20,20,30,.18)}
.fd-dock-btn{appearance:none;-webkit-appearance:none;position:absolute;left:50%;bottom:0;display:block;width:var(--fd-dock-size);height:var(--fd-dock-size);margin:0;padding:0;border:0;background:none;
  cursor:pointer;transform-origin:50% 100%;transform:translateX(-50%) scale(var(--s));border-radius:calc(var(--fd-dock-size) * .23);-webkit-tap-highlight-color:transparent}
.fd-dock-btn:focus-visible{outline:2px solid rgba(10,132,255,.85);outline-offset:3px}
.fd-dock-icon{display:block;width:100%;height:100%;margin:0;padding:0;border-radius:inherit;overflow:hidden;
  box-shadow:0 1px 1px rgba(0,0,0,.12),0 4px 10px -4px rgba(0,0,0,.35);transition:filter 120ms}
.fd-dock-icon svg{display:block;width:100%;height:100%}
.fd-dock-btn:active .fd-dock-icon{filter:brightness(.78)}
.fd-dock-badge{position:absolute;top:-4px;right:-6px;min-width:20px;height:20px;margin:0;padding:0 6px;border-radius:9999px;background:#FF3B30;color:#fff;
  font:600 12px/20px ui-sans-serif,-apple-system,"SF Pro Text",sans-serif;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.fd-dock-tip{position:absolute;left:50%;bottom:calc(var(--fd-dock-size) * var(--s) + 14px);margin:0;padding:6px 10px;border-radius:8px;background:var(--fd-dock-tip-bg);color:var(--fd-dock-tip-fg);
  font:500 13px/1 ui-sans-serif,-apple-system,"SF Pro Text","Inter",sans-serif;letter-spacing:-.005em;white-space:nowrap;pointer-events:none;
  opacity:0;transform:translate(-50%,4px);transition:opacity 120ms cubic-bezier(.22,1,.36,1),transform 240ms cubic-bezier(.22,1,.36,1);
  -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.fd-dock-tip::after{content:"";position:absolute;left:50%;bottom:-4px;width:8px;height:8px;margin-left:-4px;background:inherit;transform:rotate(45deg);border-radius:1px}
.fd-dock-item:hover .fd-dock-tip,.fd-dock-item:has(.fd-dock-btn:focus-visible) .fd-dock-tip{opacity:1;transform:translate(-50%,0)}
.fd-dock-dot{position:absolute;left:50%;bottom:-7px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:rgba(20,20,30,.72);opacity:0;transition:opacity 240ms}
.fd-dock-dot[data-on]{opacity:1}
.fd-dock-item[data-bounce] .fd-dock-btn{animation:fd-dock-bounce 1150ms cubic-bezier(.3,0,.5,1)}
@keyframes fd-dock-bounce{
  0%{translate:0 0}18%{translate:0 -34%;animation-timing-function:cubic-bezier(.5,0,.7,1)}36%{translate:0 0;animation-timing-function:cubic-bezier(.3,0,.5,1)}
  52%{translate:0 -20%;animation-timing-function:cubic-bezier(.5,0,.7,1)}68%{translate:0 0;animation-timing-function:cubic-bezier(.3,0,.5,1)}82%{translate:0 -7%}100%{translate:0 0}}
@media (max-width:640px){.fd-dock{--fd-dock-size:40px!important}.fd-dock-list{gap:4px}.fd-dock-bar{padding:6px 8px}}
@media (prefers-reduced-motion:reduce){.fd-dock-item[data-bounce] .fd-dock-btn{animation:fd-dock-blink 240ms linear}.fd-dock-tip{transition:none}}
@keyframes fd-dock-blink{50%{opacity:.5}}
@media (prefers-reduced-transparency:reduce){.fd-dock{--fd-dock-bg:#ECECF0}}
@media (prefers-contrast:more){.fd-dock{--fd-dock-bg:#ECECF0;--fd-dock-border:#1C1C22}}
`;

/* ───────────────────────── original app icons ───────────────────────── */

const Icon = ({ bg, children }: { bg: [string, string]; children: ReactNode }) => {
  const id = `fd-dock${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 64 64">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={bg[0]} /><stop offset="1" stopColor={bg[1]} /></linearGradient>
      </defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      {children}
      <rect width="64" height="32" fill="#fff" opacity=".06" />
    </svg>
  );
};

const ICONS: Record<string, ReactNode> = {
  finder: (
    <Icon bg={["#7CC4FF", "#2F7BF6"]}>
      <path d="M32 0v64" stroke="#1D4FB8" strokeWidth="0" />
      <rect x="32" width="32" height="64" fill="#EAF4FF" />
      <circle cx="22" cy="26" r="2.6" fill="#0B2A66" /><circle cx="42" cy="26" r="2.6" fill="#0B2A66" />
      <path d="M32 12c-3 8-4 18-1 28h-5" fill="none" stroke="#0B2A66" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 44c8 6 20 6 28 0" fill="none" stroke="#0B2A66" strokeWidth="2.4" strokeLinecap="round" />
    </Icon>
  ),
  mail: (
    <Icon bg={["#6FD3FF", "#1C8BF0"]}>
      <rect x="12" y="19" width="40" height="27" rx="4" fill="#fff" />
      <path d="M13 21l19 14 19-14" fill="none" stroke="#1C8BF0" strokeWidth="2.6" strokeLinejoin="round" />
    </Icon>
  ),
  calendar: (
    <Icon bg={["#FFFFFF", "#ECECEF"]}>
      <rect width="64" height="18" fill="#FF3B30" />
      <text x="32" y="13" textAnchor="middle" fill="#fff" style={{ font: '700 9px ui-sans-serif,-apple-system,"SF Pro Text",sans-serif', letterSpacing: ".06em" }}>NOV</text>
      <text x="32" y="50" textAnchor="middle" fill="#1C1C22" style={{ font: '300 30px "SF Pro Display",ui-sans-serif,-apple-system,sans-serif', letterSpacing: "-.04em" }}>14</text>
    </Icon>
  ),
  notes: (
    <Icon bg={["#FFF3B0", "#FFE16A"]}>
      <rect width="64" height="15" fill="#F5C518" />
      {[26, 34, 42, 50].map((y) => <rect key={y} x="11" y={y} width={y === 50 ? 26 : 42} height="2" rx="1" fill="#B79A3A" opacity=".55" />)}
    </Icon>
  ),
  board: (
    <Icon bg={["#B48CFF", "#6B3DF0"]}>
      <rect x="11" y="13" width="12" height="38" rx="3" fill="#fff" opacity=".95" />
      <rect x="26" y="13" width="12" height="26" rx="3" fill="#fff" opacity=".8" />
      <rect x="41" y="13" width="12" height="32" rx="3" fill="#fff" opacity=".65" />
    </Icon>
  ),
  chat: (
    <Icon bg={["#5BF08A", "#16B84B"]}>
      <path d="M32 14c11 0 20 7 20 16s-9 16-20 16c-2.4 0-4.6-.3-6.6-.9L16 49l2.6-7.4C14.5 38.6 12 34.5 12 30c0-9 9-16 20-16z" fill="#fff" />
    </Icon>
  ),
  docs: (
    <Icon bg={["#2B2B33", "#121216"]}>
      <path d="M20 12h17l9 9v31H20z" fill="#F5F5F7" />
      <path d="M37 12v9h9" fill="#C9C9D1" />
      {[30, 36, 42].map((y) => <rect key={y} x="25" y={y} width={y === 42 ? 12 : 16} height="2.4" rx="1.2" fill="#5E5CE6" />)}
    </Icon>
  ),
  music: (
    <Icon bg={["#FF7A9A", "#F5294F"]}>
      <path d="M26 44V20l18-4v24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="22" cy="44" rx="5" ry="4" fill="#fff" /><ellipse cx="40" cy="40" rx="5" ry="4" fill="#fff" />
    </Icon>
  ),
  settings: (
    <Icon bg={["#A9AAB4", "#6C6D78"]}>
      <g transform="translate(32 32)">
        {Array.from({ length: 12 }, (_, k) => <rect key={k} x="-2.6" y="-21" width="5.2" height="8" rx="1.4" fill="#E8E8ED" transform={`rotate(${k * 30})`} />)}
        <circle r="14" fill="#E8E8ED" /><circle r="6.5" fill="#6C6D78" />
      </g>
    </Icon>
  ),
  trash: (
    <Icon bg={["#E9EEF4", "#C9D2DC"]}>
      <path d="M20 22h24l-2.5 28a3 3 0 0 1-3 2.7H25.5a3 3 0 0 1-3-2.7z" fill="#fff" stroke="#93A0AF" strokeWidth="1.6" />
      {[27, 32, 37].map((x) => <path key={x} d={`M${x} 27v20`} stroke="#B3BECB" strokeWidth="1.4" />)}
      <rect x="17" y="18" width="30" height="5" rx="2" fill="#AAB6C3" />
    </Icon>
  ),
};

/* ───────────────────────────── demo ───────────────────────────── */

const APPS: DockApp[] = [
  { id: "finder", label: "Files", icon: ICONS.finder, running: true },
  { id: "mail", label: "Mail", icon: ICONS.mail, running: true, badge: 12 },
  { id: "calendar", label: "Calendar", icon: ICONS.calendar, running: true },
  { id: "notes", label: "Notes", icon: ICONS.notes },
  { id: "board", label: "Boards", icon: ICONS.board, running: true },
  { id: "chat", label: "Threads", icon: ICONS.chat, badge: 3 },
  { id: "docs", label: "Docs", icon: ICONS.docs },
  { id: "music", label: "Focus Radio", icon: ICONS.music },
  { id: "settings", label: "Settings", icon: ICONS.settings },
  { id: "trash", label: "Trash", icon: ICONS.trash },
];

export function Demo() {
  const [apps, setApps] = useState(APPS);
  const [active, setActive] = useState("Boards");
  const launch = (id: string) => {
    setApps((as) => as.map((a) => (a.id === id ? { ...a, running: true, badge: undefined } : a)));
    setActive(APPS.find((a) => a.id === id)?.label ?? "");
  };
  return (
    <div className="fd-dock-demo">
      <style>{demoCss}</style>
      <div className="fd-dock-demo-wall" aria-hidden="true" />
      <header className="fd-dock-demo-menu">
        <svg className="fd-dock-demo-logo" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" /></svg>
        <strong>{active}</strong>
        <span>File</span><span>Edit</span><span>View</span><span>Window</span>
        <span className="fd-dock-demo-clock">Sat 14 Nov 09:41</span>
      </header>
      <main className="fd-dock-demo-desk">
        <section className="fd-dock-demo-win" aria-label="Today">
          <div className="fd-dock-demo-tl" aria-hidden="true"><i /><i /><i /></div>
          <p className="fd-dock-demo-k">Orbit Workspace · Today</p>
          <h1 className="fd-dock-demo-h1">3 meetings, 1 deep-work block, 12 unread.</h1>
          <ul className="fd-dock-demo-agenda">
            <li><time>10:00</time> Q4 roadmap review <span>Boards</span></li>
            <li><time>13:30</time> Design crit — onboarding v3 <span>Docs</span></li>
            <li><time>15:00</time> Focus · no notifications <span>Focus Radio</span></li>
          </ul>
        </section>
      </main>
      <div className="fd-dock-demo-dockwrap">
        <MagneticDock apps={apps} onLaunch={launch} separatorAfter={8} />
      </div>
    </div>
  );
}

const demoCss = `
.fd-dock-demo,.fd-dock-demo *,.fd-dock-demo *::before,.fd-dock-demo *::after{box-sizing:border-box}
.fd-dock-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:"SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;
  position:relative;display:flex;flex-direction:column;min-height:100vh;margin:0;padding:0;overflow:hidden;color:#1C1C22;font:400 15px/1.5 var(--d-font);-webkit-font-smoothing:antialiased;background:#9AB6D8}
.fd-dock-demo-wall{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(70% 60% at 15% 20%,#F8C8A8 0%,transparent 60%),radial-gradient(60% 70% at 85% 30%,#B9A4F2 0%,transparent 62%),
  radial-gradient(80% 60% at 50% 100%,#6E9BE0 0%,transparent 70%),linear-gradient(180deg,#E9D6E6,#A7BDE6)}
.fd-dock-demo-menu{position:relative;display:flex;align-items:center;gap:18px;height:30px;margin:0;padding:0 16px;background:rgba(255,255,255,.35);
  -webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);font:500 13px/1 var(--d-font);color:#1C1C22}
.fd-dock-demo-menu strong{font-weight:700}
.fd-dock-demo-logo{display:block}
.fd-dock-demo-clock{margin-left:auto}
.fd-dock-demo-desk{position:relative;flex:1;display:flex;align-items:flex-start;justify-content:center;margin:0;padding:clamp(24px,7vh,72px) 16px 0}
.fd-dock-demo-win{width:100%;max-width:560px;margin:0;padding:22px 26px 26px;border-radius:20px;background:rgba(255,255,255,.78);-webkit-backdrop-filter:blur(30px);backdrop-filter:blur(30px);
  box-shadow:0 0 0 1px rgba(255,255,255,.6),0 30px 60px -24px rgba(20,30,60,.45)}
.fd-dock-demo-tl{display:flex;gap:8px;margin:0 0 18px}
.fd-dock-demo-tl i{display:block;width:12px;height:12px;border-radius:50%;background:#FF5F57}
.fd-dock-demo-tl i:nth-child(2){background:#FEBC2E}.fd-dock-demo-tl i:nth-child(3){background:#28C840}
.fd-dock-demo-k{margin:0 0 6px;color:#6B6B76;font:500 13px/1 var(--d-font)}
.fd-dock-demo-h1{margin:0;color:#1C1C22;font:600 clamp(24px,3vw,32px)/1.1 var(--d-disp);letter-spacing:-.025em;text-wrap:balance}
.fd-dock-demo-agenda{margin:20px 0 0;padding:0;list-style:none}
.fd-dock-demo-agenda li{display:flex;align-items:center;gap:14px;margin:0;padding:12px 0;border-top:1px solid rgba(28,28,34,.08);font:500 15px/1.3 var(--d-font)}
.fd-dock-demo-agenda time{width:44px;color:#6B6B76;font:500 13px/1 ui-monospace,"SF Mono",Menlo,monospace}
.fd-dock-demo-agenda span{margin-left:auto;color:#6B6B76;font:400 13px/1 var(--d-font)}
.fd-dock-demo-dockwrap{position:relative;display:flex;justify-content:center;margin:0;padding:96px 12px 14px}
@media (max-width:640px){.fd-dock-demo-menu span:not(.fd-dock-demo-clock):not(.fd-dock-demo-logo){display:none}}
`;
