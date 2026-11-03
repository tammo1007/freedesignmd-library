/**
 * IslandNav, a "dynamic island" for a music app: one dark pill at the top of
 * the page that morphs between states. Links by default, a now-playing mini
 * player when you tap the track, a search field with suggestions, and (on
 * phones) a tall menu. Width, height and corner radius are driven by an
 * in-file spring integrator so every change of shape settles with a small,
 * physical overshoot while the contents cross-fade inside it.
 *
 * Props: brand, links, current, track ({ title, artist, album, duration
 * seconds, cover colours }), suggestions, defaultPlaying.
 * CSS vars: --fd-isl-bg, --fd-isl-ink, --fd-isl-accent.
 *
 * Browser support: all evergreen browsers.
 * Accessibility: the island is a <nav>; every trigger has aria-expanded and
 * aria-controls; Escape returns to links and restores focus; clicking
 * outside also closes. Play/pause is a toggle button with aria-pressed; the
 * progress is a labelled slider (←/→ seek 5 s).
 * Reduced motion: the island snaps to its new size, no equalizer animation.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

type View = "links" | "player" | "search" | "menu";
export interface IslTrack { title: string; artist: string; album: string; duration: number; cover: { bg: string; ink: string; word: string } }
export interface IslandNavProps {
  brand?: string;
  links?: { label: string; href: string }[];
  current?: string;
  track?: IslTrack;
  suggestions?: { label: string; kind: string }[];
  defaultPlaying?: boolean;
  className?: string;
}

const LINKS = [
  { label: "Listen now", href: "#listen" },
  { label: "Browse", href: "#browse" },
  { label: "Radio", href: "#radio" },
  { label: "Library", href: "#library" },
];
const TRACK: IslTrack = { title: "Harbour Lights (Night Version)", artist: "Maren Solvik", album: "Low Tide", duration: 254, cover: { bg: "#e8ff3a", ink: "#0a0a0a", word: "LOW TIDE" } };
const SUGGEST = [
  { label: "Maren Solvik", kind: "Artist · 212K monthly listeners" },
  { label: "Low Tide", kind: "Album · 2026 · 11 songs" },
  { label: "Night ferry, Bergen to Hirtshals", kind: "Playlist · 3 h 12 min" },
  { label: "Slow Nordic jazz", kind: "Station" },
];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Cover({ t, size }: { t: IslTrack; size: number }) {
  return (
    <span className="fd-isl-cover" style={{ width: size, height: size, background: t.cover.bg, color: t.cover.ink }} aria-hidden="true">
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <circle cx="33" cy="8" r="3.6" fill="currentColor" />
        <path d="M0 30c6-4 10-4 14 0s8 4 14 0 8-4 12 0v10H0z" fill="currentColor" />
        <path d="M0 24c6-4 10-4 14 0s8 4 14 0 8-4 12 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      {size >= 56 && <b>{t.cover.word}</b>}
    </span>
  );
}

function Eq({ on }: { on: boolean }) {
  return <span className="fd-isl-eq" data-on={on ? "" : undefined} aria-hidden="true"><i /><i /><i /><i /></span>;
}

export function IslandNav({
  brand = "fathom",
  links = LINKS,
  current = "#listen",
  track = TRACK,
  suggestions = SUGGEST,
  defaultPlaying = false,
  className,
}: IslandNavProps) {
  const uid = useId();
  const [view, setView] = useState<View>("links");
  const [prev, setPrev] = useState<View | null>(null);
  const [playing, setPlaying] = useState(defaultPlaying);
  const [t, setT] = useState(97);
  const [q, setQ] = useState("");
  const island = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const spring = useRef({ w: 0, h: 0, vw: 0, vh: 0, tw: 0, th: 0, raf: 0, init: false });

  const go = (v: View, from?: HTMLElement | null) => {
    if (v === view) return;
    if (v !== "links") trigger.current = from ?? (document.activeElement as HTMLElement);
    setPrev(view);
    setView(v);
  };
  const back = () => {
    go("links");
    window.setTimeout(() => trigger.current?.focus(), 30);
  };

  // Spring morph of width / height / radius.
  const apply = () => {
    const el = island.current, s = spring.current;
    if (!el) return;
    el.style.width = `${s.w}px`;
    el.style.height = `${s.h}px`;
    el.style.borderRadius = `${Math.min(s.h / 2, 30)}px`;
  };
  useLayoutEffect(() => {
    const c = content.current, s = spring.current;
    if (!c) return;
    const measure = () => {
      s.tw = c.offsetWidth;
      s.th = c.offsetHeight;
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!s.init || reduce) {
        s.init = true;
        s.w = s.tw;
        s.h = s.th;
        s.vw = s.vh = 0;
        apply();
        return;
      }
      if (s.raf) return;
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
        last = now;
        const k = 380, d = 27;
        s.vw += (-k * (s.w - s.tw) - d * s.vw) * dt;
        s.vh += (-k * (s.h - s.th) - d * s.vh) * dt;
        s.w += s.vw * dt;
        s.h += s.vh * dt;
        apply();
        if (Math.abs(s.w - s.tw) < 0.3 && Math.abs(s.h - s.th) < 0.3 && Math.abs(s.vw) + Math.abs(s.vh) < 2) {
          s.w = s.tw; s.h = s.th; s.vw = s.vh = 0;
          apply();
          s.raf = 0;
          return;
        }
        s.raf = requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(c);
    return () => ro.disconnect();
  }, [view]);
  useEffect(() => () => cancelAnimationFrame(spring.current.raf), []);

  // Drop the outgoing layer once it has faded.
  useEffect(() => {
    if (!prev) return;
    const tm = window.setTimeout(() => setPrev(null), 200);
    return () => window.clearTimeout(tm);
  }, [prev, view]);

  // Escape + outside click.
  useEffect(() => {
    if (view === "links") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && back();
    const onDown = (e: PointerEvent) => !island.current?.contains(e.target as Node) && go("links");
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    if (view === "search") window.setTimeout(() => island.current?.querySelector<HTMLInputElement>("input")?.focus(), 60);
    else window.setTimeout(() => island.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Playback clock.
  useEffect(() => {
    if (!playing) return;
    const iv = window.setInterval(() => setT((x) => (x + 1 >= track.duration ? 0 : x + 1)), 1000);
    return () => window.clearInterval(iv);
  }, [playing, track.duration]);

  const seekKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setT((x) => Math.min(track.duration, x + 5)); }
    if (e.key === "ArrowLeft") { e.preventDefault(); setT((x) => Math.max(0, x - 5)); }
  };

  const filtered = q.trim() ? suggestions.filter((s) => (s.label + s.kind).toLowerCase().includes(q.trim().toLowerCase())) : suggestions;
  const playerId = `${uid}-player`, searchId = `${uid}-search`, menuId = `${uid}-menu`;
  const pct = (t / track.duration) * 100;

  const playBtn = (big?: boolean) => (
    <button type="button" className={`fd-isl-play${big ? " fd-isl-play-big" : ""}`} aria-pressed={playing} aria-label={playing ? "Pause" : "Play"} data-autofocus={big ? "" : undefined} onClick={() => setPlaying((p) => !p)}>
      <svg width={big ? 22 : 14} height={big ? 22 : 14} viewBox="0 0 20 20" aria-hidden="true">
        {playing ? <path d="M6 4h3v12H6zM11 4h3v12h-3z" fill="currentColor" /> : <path d="M6.5 3.8v12.4L16 10z" fill="currentColor" />}
      </svg>
    </button>
  );

  const render = (v: View) => {
    if (v === "links")
      return (
        <div className="fd-isl-links">
          <a href="#top" className="fd-isl-logo" aria-label={`${brand} home`}>
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M2 13c3-5 6-5 9 0s6 5 9 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><circle cx="11" cy="5" r="2" fill="var(--fd-isl-accent)" /></svg>
          </a>
          <ul className="fd-isl-ul">
            {links.map((l) => <li key={l.href}><a href={l.href} className="fd-isl-link" aria-current={l.href === current ? "page" : undefined}>{l.label}</a></li>)}
          </ul>
          <span className="fd-isl-sep" aria-hidden="true" />
          <button type="button" className="fd-isl-mini" aria-expanded={false} aria-controls={playerId} onClick={(e) => go("player", e.currentTarget)}>
            <Cover t={track} size={26} />
            <span className="fd-isl-minit">{track.title}</span>
            <Eq on={playing} />
            <span className="fd-isl-sr">, now {playing ? "playing" : "paused"}. Open player</span>
          </button>
          <button type="button" className="fd-isl-ic" aria-label="Search" aria-expanded={false} aria-controls={searchId} onClick={(e) => go("search", e.currentTarget)}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="8" cy="8" r="5.3" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M12 12l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
          <button type="button" className="fd-isl-ic fd-isl-menubtn" aria-label="Menu" aria-expanded={false} aria-controls={menuId} onClick={(e) => go("menu", e.currentTarget)}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 6.5h12M3 11.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
      );
    if (v === "player")
      return (
        <div id={playerId} className="fd-isl-player" role="group" aria-label="Now playing">
          <div className="fd-isl-ptop">
            <Cover t={track} size={64} />
            <div className="fd-isl-pmeta">
              <b>{track.title}</b>
              <span>{track.artist} · {track.album}</span>
            </div>
            <button type="button" className="fd-isl-ic fd-isl-close" aria-label="Collapse player" aria-expanded={true} onClick={back}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <div className="fd-isl-prog">
            <span>{fmt(t)}</span>
            <div className="fd-isl-bar" role="slider" tabIndex={0} aria-label="Seek" aria-valuemin={0} aria-valuemax={track.duration} aria-valuenow={t} aria-valuetext={`${fmt(t)} of ${fmt(track.duration)}`} onKeyDown={seekKey}
              onPointerDown={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setT(Math.round(((e.clientX - r.left) / r.width) * track.duration));
              }}>
              <i style={{ width: `${pct}%` }} />
              <b style={{ left: `${pct}%` }} />
            </div>
            <span>−{fmt(track.duration - t)}</span>
          </div>
          <div className="fd-isl-ctrls">
            <button type="button" className="fd-isl-ic" aria-label="Shuffle" aria-pressed={false}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2.5 5h2.8c1.6 0 2.6.8 3.4 2.2l1.6 3.6c.8 1.4 1.8 2.2 3.4 2.2h1.8M2.5 13h2.8c1 0 1.8-.3 2.4-.9M10.4 5.9c.6-.6 1.4-.9 2.3-.9h1.8M13 3l2.5 2L13 7M13 11l2.5 2-2.5 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" className="fd-isl-ic" aria-label="Previous" onClick={() => setT(0)}>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M15 4.5v11L7 10zM5 4.5v11" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            </button>
            {playBtn(true)}
            <button type="button" className="fd-isl-ic" aria-label="Next" onClick={() => setT(0)}>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 4.5v11l8-5.5zM15 4.5v11" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" className="fd-isl-ic" aria-label="Lyrics">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 4.5h12a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H8l-3.5 2.5V13H3a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5zM5.5 7.5h7M5.5 10h4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
      );
    if (v === "search")
      return (
        <div id={searchId} className="fd-isl-search" role="search">
          <div className="fd-isl-field">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="8" cy="8" r="5.3" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M12 12l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <label htmlFor={`${uid}-q`} className="fd-isl-sr">Search songs, artists and stations</label>
            <input id={`${uid}-q`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Songs, artists, stations" autoComplete="off" spellCheck={false} />
            <button type="button" className="fd-isl-cancel" onClick={back}>Cancel</button>
          </div>
          <ul className="fd-isl-res" aria-label="Suggestions">
            {filtered.map((s) => (
              <li key={s.label}><a href="#result" onClick={back}><b>{s.label}</b><span>{s.kind}</span></a></li>
            ))}
            {!filtered.length && <li className="fd-isl-none">No match for “{q}”. Try “Solvik”.</li>}
          </ul>
        </div>
      );
    return (
      <div id={menuId} className="fd-isl-menu">
        <div className="fd-isl-mhead">
          <span className="fd-isl-word">{brand}</span>
          <button type="button" className="fd-isl-ic" aria-label="Close menu" aria-expanded={true} onClick={back} data-autofocus="">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        <ul className="fd-isl-mlist">
          {links.map((l, i) => (
            <li key={l.href} style={{ animationDelay: `${60 + i * 40}ms` }}>
              <a href={l.href} aria-current={l.href === current ? "page" : undefined} onClick={back}>{l.label}</a>
            </li>
          ))}
        </ul>
        <button type="button" className="fd-isl-mnow" onClick={(e) => go("player", e.currentTarget)}>
          <Cover t={track} size={40} />
          <span><b>{track.title}</b><small>{track.artist}</small></span>
          <Eq on={playing} />
        </button>
      </div>
    );
  };

  return (
    <nav className={`fd-isl${className ? " " + className : ""}`} aria-label="Primary" data-view={view}>
      <style>{css}</style>
      <div ref={island} className="fd-isl-island">
        {prev && (
          <div key={`out-${prev}`} className="fd-isl-layer fd-isl-out" aria-hidden="true" inert>
            {render(prev)}
          </div>
        )}
        <div key={`in-${view}`} ref={content} className="fd-isl-layer fd-isl-in" data-v={view}>
          {render(view)}
        </div>
      </div>
      {view !== "player" && (
        <div className="fd-isl-dock" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      <PlayHidden playing={playing} />
    </nav>
  );
}

/** Keeps a polite announcement of play state for screen readers. */
function PlayHidden({ playing }: { playing: boolean }) {
  return <span className="fd-isl-sr" role="status" aria-live="polite">{playing ? "Playing" : "Paused"}</span>;
}

const sans = `ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif`;
const mono = `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`;

const css = `
.fd-isl {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-isl-bg: #050505;
  --fd-isl-ink: #f2f2ee;
  --fd-isl-dim: #8e8e88;
  --fd-isl-accent: #e8ff3a;
  position: fixed; left: 0; right: 0; top: 14px; z-index: 60; display: flex; flex-direction: column; align-items: center; margin: 0; padding: 0 12px; pointer-events: none;
  font: 400 14px/1.3 ${sans};
  color: var(--fd-isl-ink); background: transparent;
}
.fd-isl, .fd-isl *, .fd-isl *::before, .fd-isl *::after { box-sizing: border-box; }
.fd-isl a:focus-visible, .fd-isl button:focus-visible, .fd-isl [role="slider"]:focus-visible { outline: 2px solid color-mix(in srgb, var(--fd-isl-accent) 75%, transparent); outline-offset: 2px; }
.fd-isl-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.fd-isl-island { position: relative; overflow: hidden; margin: 0; padding: 0; max-width: 100%; border-radius: 30px; background: var(--fd-isl-bg); box-shadow: 0 0 0 1px rgba(255,255,255,0.07), 0 18px 50px rgba(0,0,0,0.45); pointer-events: auto; will-change: width, height; }
.fd-isl-layer { position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: max-content; max-width: calc(100vw - 24px); margin: 0; padding: 0; }
.fd-isl-in { animation: fd-isl-in var(--fd-dur-3) var(--fd-ease-out) both; animation-delay: 60ms; }
.fd-isl-out { animation: fd-isl-out 160ms linear both; pointer-events: none; }
@keyframes fd-isl-in { from { opacity: 0; transform: translateX(-50%) scale(0.96); filter: blur(4px); } }
@keyframes fd-isl-out { to { opacity: 0; transform: translateX(-50%) scale(0.98); } }
.fd-isl-ul { display: flex; margin: 0; padding: 0; list-style: none; }
.fd-isl-ul li { margin: 0; padding: 0; }

.fd-isl-links { display: flex; align-items: center; gap: 4px; height: 52px; margin: 0; padding: 0 8px 0 14px; }
.fd-isl-logo { display: grid; place-items: center; width: 34px; height: 34px; margin: 0 6px 0 0; color: var(--fd-isl-ink); text-decoration: none; border-radius: 9999px; }
.fd-isl-logo svg { display: block; }
.fd-isl-link { display: block; margin: 0; padding: 8px 12px; border-radius: 9999px; font: 500 0.875rem/1 ${sans}; color: var(--fd-isl-dim); text-decoration: none; white-space: nowrap; transition: color var(--fd-dur-1) linear, background var(--fd-dur-1) linear; }
.fd-isl-link:hover { color: var(--fd-isl-ink); background: #1a1a1a; }
.fd-isl-link[aria-current="page"] { color: var(--fd-isl-ink); }
.fd-isl-sep { display: block; width: 1px; height: 20px; margin: 0 6px; background: #262626; }
.fd-isl-mini { display: flex; align-items: center; gap: 9px; max-width: 220px; height: 38px; margin: 0; padding: 0 12px 0 6px; border: 0; border-radius: 9999px; background: #151515; color: var(--fd-isl-ink); cursor: pointer; appearance: none; -webkit-appearance: none; transition: background var(--fd-dur-1) linear, transform var(--fd-dur-1) var(--fd-ease-out); }
.fd-isl-mini:hover { background: #1f1f1f; }
.fd-isl-mini:active { transform: scale(0.96); }
.fd-isl-minit { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 0.8125rem/1 ${sans}; color: var(--fd-isl-ink); }
.fd-isl-cover { position: relative; display: block; flex: none; overflow: hidden; border-radius: 6px; }
.fd-isl-cover svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.fd-isl-cover b { position: absolute; left: 6px; top: 7px; font: 900 0.6875rem/0.9 ${sans}; letter-spacing: -0.02em; color: inherit; width: 3.2em; }
.fd-isl-eq { display: inline-flex; align-items: flex-end; gap: 2px; flex: none; height: 12px; }
.fd-isl-eq i { display: block; width: 2px; height: 4px; border-radius: 1px; background: var(--fd-isl-accent); }
.fd-isl-eq i:nth-child(2) { height: 8px; } .fd-isl-eq i:nth-child(3) { height: 5px; } .fd-isl-eq i:nth-child(4) { height: 10px; }
.fd-isl-eq[data-on] i { animation: fd-isl-eq 900ms var(--fd-ease-in-out) infinite alternate; }
.fd-isl-eq[data-on] i:nth-child(2) { animation-delay: -300ms; } .fd-isl-eq[data-on] i:nth-child(3) { animation-delay: -600ms; } .fd-isl-eq[data-on] i:nth-child(4) { animation-delay: -150ms; }
@keyframes fd-isl-eq { 0% { height: 2px; } 100% { height: 12px; } }
.fd-isl-ic { display: grid; place-items: center; flex: none; width: 38px; height: 38px; margin: 0; padding: 0; border: 0; border-radius: 9999px; background: none; color: var(--fd-isl-ink); cursor: pointer; appearance: none; -webkit-appearance: none; transition: background var(--fd-dur-1) linear, transform var(--fd-dur-1) var(--fd-ease-out); }
.fd-isl-ic svg { display: block; }
.fd-isl-ic:hover { background: #1c1c1c; }
.fd-isl-ic:active { transform: scale(0.92); }
.fd-isl-menubtn { display: none; }

.fd-isl-player { width: 400px; margin: 0; padding: 14px 14px 10px; }
.fd-isl-ptop { display: flex; align-items: center; gap: 14px; }
.fd-isl-ptop .fd-isl-cover { border-radius: 12px; }
.fd-isl-pmeta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.fd-isl-pmeta b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 1rem/1.15 ${sans}; letter-spacing: -0.01em; color: var(--fd-isl-ink); }
.fd-isl-pmeta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 400 0.8125rem/1.1 ${sans}; color: var(--fd-isl-dim); }
.fd-isl-close { align-self: flex-start; width: 30px; height: 30px; background: #161616; }
.fd-isl-prog { display: flex; align-items: center; gap: 10px; margin: 14px 2px 4px; font: 500 0.6875rem/1 ${mono}; color: var(--fd-isl-dim); font-variant-numeric: tabular-nums; }
.fd-isl-prog > span { width: 34px; }
.fd-isl-prog > span:last-child { text-align: right; }
.fd-isl-bar { position: relative; flex: 1; height: 16px; cursor: pointer; touch-action: none; }
.fd-isl-bar::before { content: ""; position: absolute; left: 0; right: 0; top: 6px; height: 4px; border-radius: 9999px; background: #262626; }
.fd-isl-bar i { position: absolute; left: 0; top: 6px; height: 4px; border-radius: 9999px; background: var(--fd-isl-ink); transition: width 1s linear; }
.fd-isl-bar b { position: absolute; top: 2px; width: 12px; height: 12px; margin-left: -6px; border-radius: 9999px; background: var(--fd-isl-ink); transform: scale(0); transition: transform var(--fd-dur-2) var(--fd-spring), left 1s linear; }
.fd-isl-bar:hover b, .fd-isl-bar:focus-visible b { transform: scale(1); }
.fd-isl-ctrls { display: flex; align-items: center; justify-content: space-between; margin: 0; padding: 4px 6px 0; }
.fd-isl-play { display: grid; place-items: center; width: 30px; height: 30px; margin: 0; padding: 0; border: 0; border-radius: 9999px; background: var(--fd-isl-ink); color: #050505; cursor: pointer; appearance: none; -webkit-appearance: none; transition: transform var(--fd-dur-1) var(--fd-ease-out); }
.fd-isl-play svg { display: block; }
.fd-isl-play-big { width: 52px; height: 52px; background: var(--fd-isl-accent); }
.fd-isl-play:active { transform: scale(0.92); }

.fd-isl-search { width: 460px; margin: 0; padding: 6px; }
.fd-isl-field { display: flex; align-items: center; gap: 10px; height: 44px; margin: 0; padding: 0 6px 0 12px; border-radius: 9999px; background: #151515; color: var(--fd-isl-dim); }
.fd-isl-field svg { display: block; flex: none; }
.fd-isl-field input { flex: 1; min-width: 0; height: 100%; margin: 0; padding: 0; border: 0; outline: 0; background: transparent; font: 400 1rem/1.2 ${sans}; color: var(--fd-isl-ink); appearance: none; -webkit-appearance: none; }
.fd-isl-field input::placeholder { color: #6e6e69; }
.fd-isl-cancel { margin: 0; padding: 8px 10px; border: 0; border-radius: 9999px; background: none; font: 500 0.8125rem/1 ${sans}; color: var(--fd-isl-accent); cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-isl-res { margin: 0; padding: 6px 0 4px; list-style: none; }
.fd-isl-res li { margin: 0; padding: 0; }
.fd-isl-res a { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 10px 14px; border-radius: 16px; text-decoration: none; }
.fd-isl-res a:hover, .fd-isl-res a:focus-visible { background: #141414; }
.fd-isl-res b { font: 600 0.9375rem/1.2 ${sans}; color: var(--fd-isl-ink); }
.fd-isl-res span { font: 400 0.75rem/1.2 ${mono}; color: var(--fd-isl-dim); }
.fd-isl-none { padding: 14px !important; font: 400 0.875rem/1.3 ${sans}; color: var(--fd-isl-dim); }

.fd-isl-menu { width: calc(100vw - 24px); max-width: 420px; margin: 0; padding: 10px 10px 12px; }
.fd-isl-mhead { display: flex; align-items: center; justify-content: space-between; padding: 0 0 0 10px; }
.fd-isl-word { font: 800 1.125rem/1 ${sans}; letter-spacing: -0.04em; color: var(--fd-isl-ink); }
.fd-isl-mlist { margin: 6px 0 10px; padding: 0; list-style: none; }
.fd-isl-mlist li { margin: 0; padding: 0; animation: fd-isl-rise var(--fd-dur-3) var(--fd-ease-out) both; }
@keyframes fd-isl-rise { from { opacity: 0; transform: translateY(10px); } }
.fd-isl-mlist a { display: block; margin: 0; padding: 12px 10px; border-radius: 14px; font: 700 1.75rem/1.05 ${sans}; letter-spacing: -0.04em; color: #5e5e59; text-decoration: none; }
.fd-isl-mlist a[aria-current="page"] { color: var(--fd-isl-ink); }
.fd-isl-mlist a[aria-current="page"]::after { content: ""; display: inline-block; width: 8px; height: 8px; margin: 0 0 0.3em 10px; border-radius: 9999px; background: var(--fd-isl-accent); vertical-align: middle; }
.fd-isl-mnow { display: flex; align-items: center; gap: 12px; width: 100%; margin: 0; padding: 8px 14px 8px 8px; border: 0; border-radius: 18px; background: #151515; color: var(--fd-isl-ink); text-align: left; cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-isl-mnow > span:nth-child(2) { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.fd-isl-mnow b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 0.875rem/1.1 ${sans}; }
.fd-isl-mnow small { font: 400 0.75rem/1 ${sans}; color: var(--fd-isl-dim); }

.fd-isl-dock { width: 64px; height: 3px; margin: 8px 0 0; border-radius: 9999px; background: rgba(255,255,255,0.12); overflow: hidden; }
.fd-isl-dock span { display: block; height: 100%; background: var(--fd-isl-accent); transition: width 1s linear; }

@media (max-width: 760px) {
  .fd-isl-ul, .fd-isl-sep { display: none; }
  .fd-isl-menubtn { display: grid; }
  .fd-isl-links { padding: 0 6px 0 10px; gap: 2px; }
  .fd-isl-mini { max-width: 170px; margin-right: 2px; }
  .fd-isl-player, .fd-isl-search { width: calc(100vw - 24px); max-width: 420px; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-isl-in, .fd-isl-out, .fd-isl-mlist li, .fd-isl-eq[data-on] i { animation: none; }
  .fd-isl-out { display: none; }
  .fd-isl-bar i, .fd-isl-bar b, .fd-isl-dock span { transition: none; }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) { .fd-isl-island { box-shadow: 0 0 0 1px #5a5a55; } }
`;

/* ── Demo ─────────────────────────────────────────────────────────────── */

const SONGS = [
  ["Ferry Bell", "3:41"], ["Harbour Lights (Night Version)", "4:14"], ["Salt on the Window", "3:02"], ["Hirtshals", "5:27"],
  ["Low Tide", "4:48"], ["Nine Gulls", "2:16"], ["The Long Way Round the Fjord", "6:03"], ["Diesel & Rain", "3:39"],
];

export function Demo() {
  return (
    <div className="fd-isl-demo">
      <style>{demoCss}</style>
      <IslandNav />
      <main>
        <section className="fd-isl-demo-hero">
          <span className="fd-isl-demo-art" aria-hidden="true">
            <svg viewBox="0 0 40 40"><circle cx="33" cy="8" r="3.6" fill="#0a0a0a" /><path d="M0 30c6-4 10-4 14 0s8 4 14 0 8-4 12 0v10H0z" fill="#0a0a0a" /><path d="M0 24c6-4 10-4 14 0s8 4 14 0 8-4 12 0" fill="none" stroke="#0a0a0a" strokeWidth="1.2" /></svg>
            <b>LOW<br />TIDE</b>
          </span>
          <div>
            <p className="fd-isl-demo-k">Album · 2026 · Recorded on the night ferry, Bergen to Hirtshals</p>
            <h1>Low Tide</h1>
            <p className="fd-isl-demo-by">Maren Solvik · 11 songs, 46 min</p>
          </div>
        </section>
        <ol className="fd-isl-demo-list">
          {SONGS.map(([n, d], i) => (
            <li key={n} data-on={i === 1 ? "" : undefined}><span>{String(i + 1).padStart(2, "0")}</span><b>{n}</b><span>{d}</span></li>
          ))}
        </ol>
      </main>
    </div>
  );
}

const demoCss = `
.fd-isl-demo { margin: 0; padding: 0; min-height: 140vh; background: #0f0f0e; color: #f2f2ee; font: 400 15px/1.5 ${sans}; }
.fd-isl-demo *, .fd-isl-demo *::before, .fd-isl-demo *::after { box-sizing: border-box; }
.fd-isl-demo main { display: block; max-width: 1080px; margin: 0 auto; padding: 120px 28px 120px; }
.fd-isl-demo-hero { display: grid; grid-template-columns: 300px 1fr; gap: 40px; align-items: end; margin: 0 0 48px; }
.fd-isl-demo-art { position: relative; display: block; aspect-ratio: 1; background: #e8ff3a; border-radius: 6px; overflow: hidden; }
.fd-isl-demo-art svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.fd-isl-demo-art b { position: absolute; left: 20px; top: 18px; font: 900 3.5rem/0.85 ${sans}; letter-spacing: -0.05em; color: #0a0a0a; }
.fd-isl-demo-k { margin: 0 0 12px; font: 500 0.75rem/1.4 ${mono}; color: #8e8e88; }
.fd-isl-demo h1 { margin: 0; font: 800 clamp(4rem, 12vw, 10rem)/0.82 ${sans}; letter-spacing: -0.06em; color: #f2f2ee; }
.fd-isl-demo-by { margin: 16px 0 0; font: 500 1rem/1 ${sans}; color: #c9c9c3; }
.fd-isl-demo-list { margin: 0; padding: 0; list-style: none; border-top: 1px solid #262624; }
.fd-isl-demo-list li { display: grid; grid-template-columns: 48px 1fr auto; align-items: center; padding: 16px 4px; border-bottom: 1px solid #1e1e1c; font: 400 0.875rem/1 ${mono}; color: #8e8e88; }
.fd-isl-demo-list b { font: 500 1.0625rem/1.2 ${sans}; color: #f2f2ee; }
.fd-isl-demo-list li[data-on] b, .fd-isl-demo-list li[data-on] span:first-child { color: #e8ff3a; }
@media (max-width: 760px) {
  .fd-isl-demo main { padding: 96px 16px 80px; }
  .fd-isl-demo-hero { grid-template-columns: 1fr; gap: 24px; }
  .fd-isl-demo-art { width: 200px; }
}
`;
