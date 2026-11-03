/**
 * HoldToConfirm, press-and-hold to run a destructive or irreversible action.
 * Progress fills through the button; releasing early drains it back and
 * cancels. Works with pointer, touch and keyboard (hold Space or Enter).
 *
 * Props: onConfirm, duration (ms, default 1500), tone ("danger" | "neutral" |
 * "accent"), size ("md" | "lg"), label, holdingLabel, doneLabel, resetAfter
 * (ms before it returns to idle, default 2200; 0 = stay done), onProgress,
 * onCancel, theme, disabled. CSS vars: --fd-hold-color, --fd-hold-radius.
 *
 * Browser support: all evergreen browsers (clip-path inset + CSS variables).
 * Accessibility: native <button>; a polite live region announces start,
 * cancel and completion; instructions are linked with aria-describedby.
 * Holding via keyboard cancels on keyup or blur. Reduced motion: no scale or
 * shake, the fill still shows progress.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface HoldToConfirmProps {
  onConfirm?: () => void;
  onCancel?: () => void;
  onProgress?: (p: number) => void;
  duration?: number;
  tone?: "danger" | "neutral" | "accent";
  size?: "md" | "lg";
  label?: ReactNode;
  holdingLabel?: ReactNode;
  doneLabel?: ReactNode;
  resetAfter?: number;
  disabled?: boolean;
  theme?: "light" | "dark";
  icon?: ReactNode;
  className?: string;
}

type Phase = "idle" | "holding" | "done";

export function HoldToConfirm({
  onConfirm,
  onCancel,
  onProgress,
  duration = 1500,
  tone = "danger",
  size = "lg",
  label = "Hold to confirm",
  holdingLabel = "Keep holding…",
  doneLabel = "Confirmed",
  resetAfter = 2200,
  disabled,
  theme,
  icon,
  className,
}: HoldToConfirmProps) {
  const hintId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const st = useRef({ p: 0, dir: 0, raf: 0, t0: 0, from: 0, phase: "idle" as Phase, key: false });
  const cb = useRef({ onConfirm, onCancel, onProgress, duration, resetAfter });
  cb.current = { onConfirm, onCancel, onProgress, duration, resetAfter };
  const timer = useRef(0);

  const paint = (p: number) => {
    st.current.p = p;
    btn.current?.style.setProperty("--h-p", p.toFixed(4));
    cb.current.onProgress?.(p);
  };
  const setP = (ph: Phase) => {
    st.current.phase = ph;
    setPhase(ph);
  };

  const loop = useCallback((t: number) => {
    const s = st.current;
    if (s.dir === 1) {
      const p = Math.min(1, s.from + (t - s.t0) / cb.current.duration);
      paint(p);
      if (p >= 1) {
        s.dir = 0;
        s.raf = 0;
        setP("done");
        setMsg("Confirmed");
        cb.current.onConfirm?.();
        if (cb.current.resetAfter > 0)
          timer.current = window.setTimeout(() => {
            paint(0);
            setP("idle");
            setMsg("");
          }, cb.current.resetAfter);
        return;
      }
    } else if (s.dir === -1) {
      const k = Math.min(1, (t - s.t0) / (260 + 240 * s.from));
      const p = s.from * (1 - (1 - Math.pow(1 - k, 3)));
      paint(k >= 1 ? 0 : p);
      if (k >= 1) {
        s.dir = 0;
        s.raf = 0;
        return;
      }
    }
    s.raf = requestAnimationFrame(loop);
  }, []);

  const start = () => {
    const s = st.current;
    if (disabled || s.phase === "done") return;
    cancelAnimationFrame(s.raf);
    s.dir = 1;
    s.from = s.p;
    s.t0 = performance.now();
    setP("holding");
    setMsg("Hold to confirm");
    s.raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    const s = st.current;
    if (s.phase !== "holding") return;
    cancelAnimationFrame(s.raf);
    s.dir = -1;
    s.from = s.p;
    s.t0 = performance.now();
    setP("idle");
    setMsg("Cancelled");
    cb.current.onCancel?.();
    s.raf = requestAnimationFrame(loop);
  };

  useEffect(
    () => () => {
      cancelAnimationFrame(st.current.raf);
      window.clearTimeout(timer.current);
    },
    [],
  );

  const shown = phase === "done" ? doneLabel : phase === "holding" ? holdingLabel : label;

  return (
    <span className={`fd-hold${className ? " " + className : ""}`} data-fd-theme={theme} data-tone={tone} data-size={size} data-phase={phase}>
      <style>{css}</style>
      <button
        ref={btn}
        type="button"
        className="fd-hold-btn"
        disabled={disabled}
        aria-describedby={hintId}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          start();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            st.current.key = true;
            start();
          }
        }}
        onKeyUp={(e) => {
          if ((e.key === " " || e.key === "Enter") && st.current.key) {
            st.current.key = false;
            stop();
          }
        }}
        onBlur={() => {
          st.current.key = false;
          stop();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="fd-hold-face" data-layer="base">
          {icon && <span className="fd-hold-icon">{icon}</span>}
          <span className="fd-hold-text">{shown}</span>
        </span>
        <span className="fd-hold-fill" aria-hidden="true">
          <span className="fd-hold-face" data-layer="on">
            {phase === "done" ? (
              <svg aria-hidden="true" focusable="false" className="fd-hold-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            ) : (
              icon && <span className="fd-hold-icon">{icon}</span>
            )}
            <span className="fd-hold-text">{shown}</span>
          </span>
        </span>
      </button>
      <span id={hintId} className="fd-hold-sr">
        Press and hold for {(duration / 1000).toFixed(1)} seconds, or hold the Space key.
      </span>
      <span className="fd-hold-sr" role="status" aria-live="polite">{msg}</span>
    </span>
  );
}

const css = `
:where(.fd-hold,.fd-hold *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-hold,.fd-hold *)::before,:where(.fd-hold,.fd-hold *)::after{box-sizing:border-box}
:where(.fd-hold svg){display:block;flex-shrink:0}
:where(.fd-hold button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-hold{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --h-c:#E5334B;--h-soft:rgba(229,51,75,.1);--h-fg:#B3162E;--h-on:#fff;--h-line:rgba(229,51,75,.28);
  display:inline-flex;vertical-align:middle;position:relative;
  font:500 15px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
}
.fd-hold[data-tone="neutral"]{--h-c:#0B0B0F;--h-soft:rgba(11,11,15,.06);--h-fg:#0B0B0F;--h-on:#fff;--h-line:rgba(11,11,15,.14)}
.fd-hold[data-tone="accent"]{--h-c:#007AFF;--h-soft:rgba(0,122,255,.1);--h-fg:#0058C7;--h-on:#fff;--h-line:rgba(0,122,255,.28)}
[data-fd-theme="dark"] .fd-hold,.fd-hold[data-fd-theme="dark"]{--h-c:#FF453A;--h-soft:rgba(255,69,58,.14);--h-fg:#FF8F87;--h-on:#1A0504;--h-line:rgba(255,69,58,.32)}
[data-fd-theme="dark"] .fd-hold[data-tone="neutral"],.fd-hold[data-tone="neutral"][data-fd-theme="dark"]{--h-c:#F5F5F7;--h-soft:rgba(255,255,255,.07);--h-fg:#F5F5F7;--h-on:#0B0B0F;--h-line:rgba(255,255,255,.14)}
[data-fd-theme="dark"] .fd-hold[data-tone="accent"],.fd-hold[data-tone="accent"][data-fd-theme="dark"]{--h-c:#0A84FF;--h-soft:rgba(10,132,255,.16);--h-fg:#66B2FF;--h-on:#fff;--h-line:rgba(10,132,255,.36)}
.fd-hold[data-phase="done"]{--h-c:#1FA45B;--h-soft:rgba(31,164,91,.12);--h-fg:#0F7A41;--h-on:#fff;--h-line:rgba(31,164,91,.3)}
[data-fd-theme="dark"] .fd-hold[data-phase="done"],.fd-hold[data-fd-theme="dark"][data-phase="done"]{--h-c:#30D158;--h-soft:rgba(48,209,88,.14);--h-fg:#7BE69B;--h-on:#04210E;--h-line:rgba(48,209,88,.32)}
.fd-hold[data-size="md"]{--h-h:40px;--h-px:18px;--h-fs:15px}
.fd-hold[data-size="lg"]{--h-h:52px;--h-px:26px;--h-fs:15px}
.fd-hold-btn{--h-p:0;position:relative;display:block;overflow:hidden;height:var(--h-h);min-width:176px;padding:0 var(--h-px);border-radius:var(--fd-hold-radius,9999px);
  appearance:none;-webkit-appearance:none;border:0;outline:0;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;
  background:var(--h-soft);color:var(--h-fg);font-weight:500;font-size:var(--h-fs);line-height:1;font-family:inherit;letter-spacing:-.005em;
  box-shadow:0 0 0 1px var(--h-line),0 1px 2px rgba(11,11,15,.06);
  transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring),box-shadow var(--fd-dur-2) var(--fd-ease-out)}
.fd-hold[data-phase="holding"] .fd-hold-btn{transform:scale(.97);transition:transform var(--fd-dur-1) var(--fd-ease-out);box-shadow:0 0 0 1px var(--h-c),0 6px 20px -8px var(--h-c)}
.fd-hold-btn:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
.fd-hold-btn:disabled{opacity:.4;cursor:not-allowed}
.fd-hold-face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 var(--h-px);white-space:nowrap}
.fd-hold-fill{position:absolute;inset:0;background:var(--h-c);color:var(--h-on);
  clip-path:inset(0 calc((1 - var(--h-p)) * 100% + 0px) 0 0);will-change:clip-path}
.fd-hold[data-phase="done"] .fd-hold-fill{clip-path:inset(0)}
.fd-hold-icon{display:grid;place-items:center;width:18px;height:18px}
.fd-hold-icon svg{width:100%;height:100%}
.fd-hold-text{display:block}
.fd-hold-check path{stroke-dasharray:24;stroke-dashoffset:24;animation:fd-hold-draw 380ms var(--fd-ease-out) 80ms forwards}
.fd-hold-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes fd-hold-draw{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.fd-hold-btn,.fd-hold[data-phase="holding"] .fd-hold-btn{transform:none;transition:none}.fd-hold-check path{animation:none;stroke-dashoffset:0}}
@media (prefers-contrast:more){.fd-hold-btn{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const trash = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
);
const rocket = (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2M12 15l-3-3a22 22 0 0 1 2-4 12 12 0 0 1 11-5c0 3-1 8-5 11a22 22 0 0 1-4 2zM9 12H4s.6-3 2-4c1.6-1 5 0 5 0M12 15v5s3-.6 4-2c1-1.6 0-5 0-5" /></svg>
);

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [deleted, setDeleted] = useState(false);
  const [pct, setPct] = useState(0);
  const [promoted, setPromoted] = useState(false);

  return (
    <div className="fd-hold-demo" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <aside className="fd-hold-demo-side" aria-label="Project navigation">
        <div className="fd-hold-demo-proj"><span className="fd-hold-demo-sq">O</span><div><b>orbit-api</b><small>Production</small></div></div>
        <nav>
          {["Overview", "Deployments", "Databases", "Logs", "Settings"].map((n) => (
            <a key={n} href={`#${n}`} aria-current={n === "Databases" ? "page" : undefined}>{n}</a>
          ))}
        </nav>
      </aside>

      <main className="fd-hold-demo-main">
        <div className="fd-hold-demo-top">
          <div>
            <p className="fd-hold-demo-crumb">orbit-api / Databases / orders-prod</p>
            <h1>orders-prod</h1>
          </div>
          <button type="button" className="fd-hold-demo-theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>

        <section className="fd-hold-demo-stats" aria-label="Database summary">
          <div><small>Engine</small><b>Postgres 16.4</b></div>
          <div><small>Size</small><b>184.2 GB</b></div>
          <div><small>Region</small><b>eu-central-1</b></div>
          <div><small>Connections</small><b>212 / 500</b></div>
        </section>

        <section className="fd-hold-demo-card" aria-labelledby="fd-hold-promote">
          <div>
            <h2 id="fd-hold-promote">Promote read replica</h2>
            <p>Switches writes to <code>orders-prod-replica-2</code>. Expect about 8 seconds of write downtime.</p>
          </div>
          <HoldToConfirm tone="accent" size="md" duration={1000} icon={rocket} label="Hold to promote" holdingLabel="Promoting…" doneLabel="Promoted" onConfirm={() => setPromoted(true)} resetAfter={2600} />
        </section>

        <section className="fd-hold-demo-card fd-hold-demo-danger" aria-labelledby="fd-hold-danger">
          <div className="fd-hold-demo-danger-copy">
            <span className="fd-hold-demo-badge">Danger zone</span>
            <h2 id="fd-hold-danger">Delete production database</h2>
            <p>This permanently removes <code>orders-prod</code>, its 3 replicas and 30 days of point-in-time backups. This cannot be undone.</p>
            <ul>
              <li>14 services will lose their connection string</li>
              <li>Scheduled exports to s3://orbit-archive stop immediately</li>
            </ul>
          </div>
          {deleted ? (
            <div className="fd-hold-demo-gone" role="status">
              <b>orders-prod deleted</b>
              <span>Backups are kept for 7 days.</span>
              <button type="button" onClick={() => { setDeleted(false); setPct(0); }}>Undo</button>
            </div>
          ) : (
            <div className="fd-hold-demo-action">
              <HoldToConfirm tone="danger" size="lg" icon={trash} duration={1800} label="Hold to delete" holdingLabel="Deleting…" doneLabel="Deleted" resetAfter={0} onProgress={setPct} onConfirm={() => setDeleted(true)} />
              <small aria-hidden="true">{pct > 0 && pct < 1 ? `${Math.round(pct * 100)}%` : "Hold for 1.8s · or hold Space"}</small>
            </div>
          )}
        </section>
        {promoted && <p className="fd-hold-demo-note" role="status">Replica promoted. Writes now go to orders-prod-replica-2.</p>}
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-hold-demo,.fd-hold-demo *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-hold-demo,.fd-hold-demo *)::before,:where(.fd-hold-demo,.fd-hold-demo *)::after{box-sizing:border-box}
:where(.fd-hold-demo button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-hold-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-dur-2:240ms;
  --d-bg:#F7F7F9;--d-card:#fff;--d-side:#fff;--d-ink:#0B0B0F;--d-mut:#6B6B76;--d-line:rgba(11,11,15,.08);--d-code:rgba(11,11,15,.06);--d-danger:#E5334B;--d-dangerbg:rgba(229,51,75,.04);--d-dangerline:rgba(229,51,75,.22);
  display:grid;grid-template-columns:232px minmax(0,1fr);min-height:100vh;background:var(--d-bg);color:var(--d-ink);font:400 15px/1.45 var(--d-font);-webkit-font-smoothing:antialiased;transition:background-color var(--fd-dur-2) var(--fd-ease-out)}
.fd-hold-demo[data-fd-theme="dark"]{--d-bg:#09090B;--d-card:#101014;--d-side:#0B0B0F;--d-ink:#F5F5F7;--d-mut:#8E8E9A;--d-line:rgba(255,255,255,.08);--d-code:rgba(255,255,255,.08);--d-danger:#FF453A;--d-dangerbg:rgba(255,69,58,.05);--d-dangerline:rgba(255,69,58,.26)}
.fd-hold-demo-side{display:flex;flex-direction:column;gap:20px;padding:20px 12px;background:var(--d-side);border-right:1px solid var(--d-line)}
.fd-hold-demo-proj{display:flex;align-items:center;gap:10px;padding:0 8px}
.fd-hold-demo-proj b{display:block;font:600 15px/1.1 var(--d-font);letter-spacing:-.01em}
.fd-hold-demo-proj small{display:block;font:400 12px/1.4 var(--d-font);color:var(--d-mut)}
.fd-hold-demo-sq{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:var(--d-ink);color:var(--d-bg);font:600 14px/1 var(--d-font)}
.fd-hold-demo-side nav{display:flex;flex-direction:column;gap:2px}
.fd-hold-demo-side nav a{display:flex;align-items:center;height:32px;padding:0 10px;border-radius:8px;font:400 14px/1 var(--d-font);color:var(--d-mut)}
.fd-hold-demo-side nav a:hover{background:var(--d-code);color:var(--d-ink)}
.fd-hold-demo-side nav a[aria-current]{background:var(--d-code);color:var(--d-ink);font-weight:500}
.fd-hold-demo-side a:focus-visible,.fd-hold-demo-theme:focus-visible,.fd-hold-demo-gone button:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px}
.fd-hold-demo-main{display:flex;flex-direction:column;gap:16px;padding:32px clamp(16px,4vw,48px) 64px;max-width:1000px;width:100%}
.fd-hold-demo-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:8px}
.fd-hold-demo-crumb{font:400 13px/1 var(--d-mono);color:var(--d-mut);margin-bottom:12px}
.fd-hold-demo-top h1{font:600 24px/1.15 var(--d-font);letter-spacing:-.02em}
.fd-hold-demo-theme{cursor:pointer;height:32px;padding:0 14px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 13px/1 var(--d-font);color:var(--d-mut)}
.fd-hold-demo-theme:hover{color:var(--d-ink)}
.fd-hold-demo-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-radius:16px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line)}
.fd-hold-demo-stats div{padding:16px 20px;display:flex;flex-direction:column;gap:6px;border-left:1px solid var(--d-line)}
.fd-hold-demo-stats div:first-child{border-left:0}
.fd-hold-demo-stats small{font:400 12px/1 var(--d-font);color:var(--d-mut)}
.fd-hold-demo-stats b{font:500 15px/1.2 var(--d-font);font-variant-numeric:tabular-nums}
.fd-hold-demo-card{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:24px;border-radius:20px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line),0 1px 2px rgba(0,0,0,.04),0 16px 32px -20px rgba(0,0,0,.2)}
.fd-hold-demo-card h2{font:600 17px/1.2 var(--d-font);letter-spacing:-.01em;margin-bottom:6px}
.fd-hold-demo-card p{font:400 14px/1.5 var(--d-font);color:var(--d-mut);max-width:52ch}
.fd-hold-demo-card code{font:400 12.5px/1 var(--d-mono);padding:2px 6px;border-radius:6px;background:var(--d-code);color:var(--d-ink)}
.fd-hold-demo-danger{align-items:flex-start;background:linear-gradient(0deg,var(--d-dangerbg),var(--d-dangerbg)),var(--d-card);box-shadow:0 0 0 1px var(--d-dangerline),0 16px 32px -20px rgba(0,0,0,.2)}
.fd-hold-demo-badge{display:inline-flex;height:22px;align-items:center;padding:0 8px;border-radius:9999px;margin-bottom:12px;background:var(--d-dangerbg);box-shadow:0 0 0 1px var(--d-dangerline);font:500 12px/1 var(--d-font);color:var(--d-danger)}
.fd-hold-demo-danger ul{margin-top:12px;display:flex;flex-direction:column;gap:6px;font:400 14px/1.4 var(--d-font);color:var(--d-mut)}
.fd-hold-demo-danger li{display:flex;gap:10px}.fd-hold-demo-danger li::before{content:"";flex:none;width:5px;height:5px;margin-top:7px;border-radius:50%;background:var(--d-danger)}
.fd-hold-demo-action{display:flex;flex-direction:column;align-items:center;gap:10px;flex:none}
.fd-hold-demo-action small{font:400 12px/1 var(--d-mono);color:var(--d-mut);font-variant-numeric:tabular-nums;min-width:20ch;text-align:center}
.fd-hold-demo-gone{display:flex;flex-direction:column;align-items:flex-start;gap:4px;flex:none;min-width:200px;font:400 13px/1.4 var(--d-font);color:var(--d-mut)}
.fd-hold-demo-gone b{font:600 15px/1.2 var(--d-font);color:var(--d-ink)}
.fd-hold-demo-gone button{margin-top:8px;cursor:pointer;height:32px;padding:0 14px;border-radius:9999px;box-shadow:0 0 0 1px var(--d-line);font:500 13px/1 var(--d-font);color:var(--d-ink)}
.fd-hold-demo-note{font:400 13px/1.4 var(--d-font);color:#30D158}
@media (max-width:860px){.fd-hold-demo{grid-template-columns:1fr}.fd-hold-demo-side{display:none}.fd-hold-demo-card{flex-direction:column;align-items:stretch}.fd-hold-demo-action{align-items:stretch}.fd-hold-demo-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.fd-hold-demo-stats div:nth-child(3){border-left:0}.fd-hold-demo-stats div:nth-child(n+3){border-top:1px solid var(--d-line)}.fd-hold-demo .fd-hold,.fd-hold-demo .fd-hold-btn{display:flex;width:100%}}
`;
