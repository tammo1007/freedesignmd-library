/**
 * HeroMusicWaveform — an album-launch hero for a streaming service. Giant
 * condensed type, a generative op-art sleeve (two sets of concentric rings
 * whose interference fringes drift with the music, set in a Swiss type band
 * with catalogue number and running order), a vinyl that slides out of it, and
 * a full-width spectrum of bars that dances to a synthetic signal and bulges
 * toward the pointer. The play button morphs to pause (SVG path morph) and
 * drives the energy of the spectrum. On scroll the sleeve tilts back and the
 * bars flatten.
 *
 * Props: artist, album, release, catalogue, tracks, primaryCta, bars.
 * CSS vars: --fd-wav-bg, --fd-wav-ink, --fd-wav-hot, --fd-wav-cool.
 *
 * Browser support: all evergreen browsers. No audio is played; the
 * spectrum is procedural.
 * Motion: one rAF loop (paused off-screen / hidden tab) writes scaleY on the
 * bars and the sleeve transform; the play/pause morph is a CSS `d` transition
 * on Chromium/Firefox, with a cross-fade fallback in Safari.
 * prefers-reduced-motion: static bars, no spin, button still toggles.
 * Accessibility: play button is a real <button aria-pressed>; track list is
 * an <ol>; the spectrum is aria-hidden.
 */
import { useEffect, useRef, useState } from "react";

export interface HeroMusicWaveformProps {
  artist?: string;
  album?: string;
  release?: string;
  tracks?: { title: string; time: string }[];
  primaryCta?: { label: string; href: string };
  catalogue?: string;
  bars?: number;
}

// ring radii for the interference sleeve (two identical sets, offset centres)
const RINGS = Array.from({ length: 46 }, (_, i) => 6 + i * 9);

const DEFAULT_TRACKS = [
  { title: "Saltwater Hymn", time: "3:41" },
  { title: "Low Orbit (feat. Ana Brava)", time: "4:12" },
  { title: "Nine Floors Up", time: "2:58" },
];

const PLAY = "M8 5 L8 19 L13.5 15.5 L13.5 8.5 Z M13.5 8.5 L13.5 15.5 L19 12 L19 12 Z";
const PAUSE = "M7 5 L7 19 L10.5 19 L10.5 5 Z M13.5 5 L13.5 19 L17 19 L17 5 Z";

export function HeroMusicWaveform({
  artist = "Noor Okafor",
  album = "TIDAL HEART",
  release = "Out now · 11 tracks · 41 min",
  tracks = DEFAULT_TRACKS,
  primaryCta = { label: "Pre-save the vinyl", href: "#vinyl" },
  catalogue = "RSN 041",
  bars = 72,
}: HeroMusicWaveformProps) {
  const root = useRef<HTMLElement>(null);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const sleeve = useRef<HTMLDivElement>(null);
  const big = useRef<HTMLHeadingElement>(null);
  const prog = useRef<HTMLSpanElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const moire = useRef<SVGGElement>(null);
  const heart = useRef<SVGCircleElement>(null);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(true);
  playingRef.current = playing;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      barRefs.current.forEach((b, i) => b && (b.style.transform = `scaleY(${(0.25 + 0.6 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11))).toFixed(3)})`));
      return;
    }
    const n = barRefs.current.length;
    const level = new Float32Array(n);
    let px = -10;
    let pTarget = -10;
    let energy = 1;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pTarget = (e.clientX - r.left) / r.width;
    };
    const onLeave = () => {
      pTarget = -10;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    let raf = 0;
    let visible = true;
    let last = performance.now();
    let songT = 74;
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      energy += ((playingRef.current ? 1 : 0.12) - energy) * Math.min(1, dt * 4);
      if (playingRef.current) songT += dt;
      px = pTarget < -1 ? px + (-10 - px) * 0.05 : px + (pTarget - px) * 0.12;
      // a beat at 96 bpm with a kick envelope
      const beat = (t * 1.6) % 1;
      const kick = Math.exp(-beat * 7);
      const r = el.getBoundingClientRect();
      const sc = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        // spectrum envelope: bass heavy, mid hump, airy highs
        const env = 0.55 * Math.exp(-u * 3.2) + 0.35 * Math.exp(-Math.pow((u - 0.42) / 0.16, 2)) + 0.12;
        const wob = 0.5 + 0.5 * Math.sin(t * (3.1 + u * 9) + i * 1.7) * Math.sin(t * (1.3 + u * 3) + i * 0.45);
        const k = u < 0.18 ? kick * (1 - u / 0.18) : kick * 0.15;
        const near = Math.exp(-Math.pow((u - px) / 0.07, 2));
        const target = Math.min(1, (env * (0.35 + 0.65 * wob) + k * 0.5) * energy * (1 - sc * 0.8) + near * 0.55 + 0.04);
        level[i] += (target - level[i]) * (target > level[i] ? 0.45 : 0.12);
        const b = barRefs.current[i];
        if (b) b.style.transform = `scaleY(${level[i].toFixed(3)})`;
      }
      if (sleeve.current) sleeve.current.style.transform = `perspective(1400px) rotateX(${(sc * 28).toFixed(2)}deg) rotateY(${(-14 + (px > -1 ? (px - 0.5) * 10 : 0)).toFixed(2)}deg) translateY(${(sc * -60).toFixed(1)}px) scale(${(1 + kick * 0.008 * energy).toFixed(4)})`;
      // the second ring set orbits slowly, so the fringes breathe with the track
      if (moire.current) {
        const a = songT * 0.45;
        moire.current.setAttribute("transform", `translate(${(Math.cos(a) * 14 * energy).toFixed(2)} ${(Math.sin(a * 1.3) * 10 * energy).toFixed(2)})`);
      }
      if (heart.current) heart.current.setAttribute("r", (15 + kick * 5 * energy).toFixed(2));
      if (big.current) big.current.style.transform = `translate3d(${(sc * -8).toFixed(2)}vw, 0, 0)`;
      if (prog.current) prog.current.style.transform = `scaleX(${((songT % 221) / 221).toFixed(4)})`;
      if (clock.current) {
        const s = Math.floor(songT % 221);
        clock.current.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", start);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [bars]);

  return (
    <section ref={root} className="fd-wav" data-playing={playing ? "" : undefined} aria-label={`${artist}, ${album}`}>
      <style>{css}</style>
      <div className="fd-wav-top">
        <p className="fd-wav-artist">{artist}</p>
        <p className="fd-wav-release">{release}</p>
      </div>
      <h1 ref={big} className="fd-wav-big" aria-label={album}>
        {album.split(" ").map((w, wi) => (
          <span key={wi} className="fd-wav-word" aria-hidden="true">
            {Array.from(w).map((c, ci) => (
              <span key={ci} className="fd-wav-c" style={{ animationDelay: `${wi * 220 + ci * 45}ms` }}>
                {c}
              </span>
            ))}
          </span>
        ))}
      </h1>

      <div className="fd-wav-stage">
        <div ref={sleeve} className="fd-wav-sleeve" aria-hidden="true">
          <div className="fd-wav-vinyl">
            <div className="fd-wav-label">
              <span>{artist.split(" ")[0].toUpperCase()}</span>
            </div>
          </div>
          <div className="fd-wav-art">
            <div className="fd-wav-art-top">
              <span>{artist}</span>
              <span>{catalogue}</span>
            </div>
            <svg className="fd-wav-moire" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
              <rect width="400" height="300" fill="#ECE6DA" />
              <g fill="none" stroke="#120E0F" strokeWidth="3.6">
                {RINGS.map((r) => (
                  <circle key={r} cx="170" cy="160" r={r} />
                ))}
              </g>
              <g ref={moire} fill="none" stroke="#120E0F" strokeWidth="3.6">
                {RINGS.map((r) => (
                  <circle key={r} cx="236" cy="138" r={r} />
                ))}
              </g>
              <circle ref={heart} cx="203" cy="149" r="15" fill="#FF5A36" />
            </svg>
            <div className="fd-wav-art-band">
              <span className="fd-wav-art-t">{album}</span>
              <span className="fd-wav-art-m">
                <span>LP · 33⅓</span>
                <span>{tracks.length > 0 ? `A1 ${tracks[0].title}` : ""}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="fd-wav-player">
          <button
            type="button"
            className="fd-wav-play"
            aria-pressed={playing}
            aria-label={playing ? "Pause preview" : "Play preview"}
            onClick={() => setPlaying((p) => !p)}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path className="fd-wav-icon" d={playing ? PAUSE : PLAY} fill="currentColor" />
            </svg>
          </button>
          <div className="fd-wav-now">
            <span className="fd-wav-now-k">{playing ? "Now playing" : "Paused"}</span>
            <b>{tracks[0]?.title}</b>
            <div className="fd-wav-bar">
              <span ref={prog} />
            </div>
            <div className="fd-wav-times">
              <span ref={clock}>1:14</span>
              <span>{tracks[0]?.time}</span>
            </div>
          </div>
          <ol className="fd-wav-tracks">
            {tracks.map((t, i) => (
              <li key={t.title} className={i === 0 ? "is-on" : undefined}>
                <span className="fd-wav-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="fd-wav-tt">{t.title}</span>
                <span className="fd-wav-tm">{t.time}</span>
              </li>
            ))}
          </ol>
          <a className="fd-wav-cta" href={primaryCta.href}>
            {primaryCta.label}
          </a>
        </div>
      </div>

      <div className="fd-wav-spec" aria-hidden="true">
        {Array.from({ length: bars }, (_, i) => (
          <span key={i} ref={(n) => { barRefs.current[i] = n; }} className="fd-wav-b" style={{ ["--u" as string]: i / (bars - 1) }} />
        ))}
      </div>
    </section>
  );
}

const css = `
.fd-wav, .fd-wav *, .fd-wav *::before, .fd-wav *::after { box-sizing: border-box; }
.fd-wav {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-wav-bg: #0E0A0B;
  --fd-wav-ink: #F6EDE4;
  --fd-wav-hot: #FF5A36;
  --fd-wav-cool: #FFB547;
  --fd-wav-cond: "Helvetica Neue", "Arial Narrow", "Roboto Condensed", "DejaVu Sans Condensed", ui-sans-serif, -apple-system, "Inter", sans-serif;
  --fd-wav-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  position: relative; display: block; overflow: hidden; margin: 0; padding: 0; min-height: 880px;
  background: var(--fd-wav-bg); color: var(--fd-wav-ink); font: 400 1rem/1.5 var(--fd-wav-sans); isolation: isolate;
}
.fd-wav-top { position: relative; z-index: 2; display: flex; justify-content: space-between; gap: 16px; max-width: 1320px; margin: 0 auto; padding: 96px 40px 0; animation: fd-wav-fade var(--fd-dur-4) var(--fd-ease-out) 600ms both; }
.fd-wav-artist, .fd-wav-release { margin: 0; padding: 0; font: 600 0.75rem/1 var(--fd-wav-sans); letter-spacing: 0.24em; text-transform: uppercase; color: rgba(246,237,228,0.7); }
.fd-wav-artist { color: var(--fd-wav-hot); }
.fd-wav-big {
  position: relative; z-index: 1; display: flex; justify-content: center; gap: 0.18em; margin: 6px 0 0; padding: 0 20px; white-space: nowrap; will-change: transform;
  font: 800 clamp(5rem, 17vw, 17rem)/0.82 var(--fd-wav-cond); font-stretch: condensed; letter-spacing: -0.055em; color: var(--fd-wav-ink);
  transform-origin: center;
}
.fd-wav-word { display: inline-flex; overflow: hidden; padding: 0.02em 0 0.04em; }
.fd-wav-c { display: inline-block; transform: scaleY(1.12); transform-origin: bottom; animation: fd-wav-in 900ms var(--fd-ease-out) both; }
.fd-wav-word:last-child .fd-wav-c { -webkit-text-stroke: 2px var(--fd-wav-ink); color: transparent; }

.fd-wav-stage { position: relative; z-index: 3; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 56px; align-items: start; max-width: 1140px; margin: -9vw auto 0; padding: 0 40px; }
.fd-wav-sleeve { position: relative; width: 340px; aspect-ratio: 1; transform-style: preserve-3d; will-change: transform; animation: fd-wav-sleevein 1200ms var(--fd-ease-out) 300ms both; }
.fd-wav-art {
  position: absolute; inset: 0; overflow: hidden; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; border-radius: 2px;
  background: #ECE6DA; color: #120E0F;
  box-shadow: 0 1px 0 rgba(255,255,255,0.35) inset, 0 40px 80px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06);
}
.fd-wav-art-top { display: flex; justify-content: space-between; gap: 8px; margin: 0; padding: 12px 14px 10px; border-bottom: 2px solid #120E0F; font: 600 0.625rem/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.14em; text-transform: uppercase; color: #120E0F; }
.fd-wav-moire { display: block; width: 100%; height: 100%; min-height: 0; }
.fd-wav-art-band { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 8px 14px 12px; border-top: 2px solid #120E0F; background: #ECE6DA; }
.fd-wav-art-t { display: block; margin: 0; font: 800 2.25rem/0.86 var(--fd-wav-cond); font-stretch: condensed; letter-spacing: -0.045em; color: #120E0F; white-space: nowrap; }
.fd-wav-art-m { display: flex; justify-content: space-between; gap: 8px; font: 500 0.5625rem/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.1em; text-transform: uppercase; color: #4A4244; }
.fd-wav-art-m span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-wav-vinyl {
  position: absolute; inset: 3%; border-radius: 50%;
  background: repeating-radial-gradient(circle at 50% 50%, #161112 0 1px, #0a0708 1px 3px), radial-gradient(circle, #1a1213, #050404);
  box-shadow: 0 20px 50px -20px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.05);
  transform: translateX(0); animation: fd-wav-slide 1400ms var(--fd-ease-out) 1100ms both;
}
.fd-wav-vinyl::before { content: ""; position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 20deg, transparent 0 10%, rgba(255,255,255,0.12) 14%, transparent 20% 55%, rgba(255,255,255,0.08) 60%, transparent 66%); }
.fd-wav-label { position: absolute; left: 50%; top: 50%; width: 34%; aspect-ratio: 1; margin: -17% 0 0 -17%; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle, #0E0A0B 0 5%, #FF5A36 6% 100%); animation: fd-wav-spin 1.8s linear infinite; animation-play-state: paused; }
.fd-wav[data-playing] .fd-wav-label { animation-play-state: running; }
.fd-wav-label span { font: 800 0.5625rem/1 var(--fd-wav-sans); letter-spacing: 0.2em; color: #0E0A0B; transform: translateY(-14px); }

.fd-wav-player { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px 22px; align-items: center; max-width: 520px; margin: 11vw 0 0 auto; animation: fd-wav-rise var(--fd-dur-4) var(--fd-ease-out) 900ms both; }
.fd-wav-play {
  appearance: none; -webkit-appearance: none; cursor: pointer; display: grid; place-items: center; width: 84px; height: 84px; margin: 0; padding: 0; border: 0; border-radius: 9999px;
  background: var(--fd-wav-ink); color: var(--fd-wav-bg); box-shadow: 0 0 0 8px rgba(246,237,228,0.06), 0 20px 50px -14px rgba(255,90,54,0.65);
  transition: transform var(--fd-dur-2) var(--fd-spring), box-shadow var(--fd-dur-3) var(--fd-ease-out);
}
.fd-wav-play svg { display: block; }
.fd-wav-icon { transition: d var(--fd-dur-3) var(--fd-ease-in-out); }
.fd-wav-play:hover { box-shadow: 0 0 0 12px rgba(246,237,228,0.08), 0 24px 60px -14px rgba(255,90,54,0.8); }
.fd-wav-play:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-wav-play:focus-visible, .fd-wav-cta:focus-visible { outline: 2px solid rgba(255,181,71,0.8); outline-offset: 3px; }
.fd-wav-now { min-width: 0; }
.fd-wav-now-k { display: block; margin: 0 0 6px; font: 600 0.6875rem/1 var(--fd-wav-sans); letter-spacing: 0.18em; text-transform: uppercase; color: var(--fd-wav-cool); }
.fd-wav-now b { display: block; font: 600 1.375rem/1.1 var(--fd-wav-sans); letter-spacing: -0.02em; color: var(--fd-wav-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fd-wav-bar { position: relative; height: 3px; margin: 14px 0 8px; border-radius: 9999px; background: rgba(246,237,228,0.14); overflow: hidden; }
.fd-wav-bar span { position: absolute; inset: 0; background: linear-gradient(90deg, var(--fd-wav-hot), var(--fd-wav-cool)); transform-origin: left; transform: scaleX(0.33); }
.fd-wav-times { display: flex; justify-content: space-between; font: 500 0.75rem/1 ui-monospace, "SF Mono", Menlo, monospace; color: rgba(246,237,228,0.5); font-variant-numeric: tabular-nums; }
.fd-wav-tracks { grid-column: 1 / -1; margin: 6px 0 0; padding: 0; list-style: none; border-top: 1px solid rgba(246,237,228,0.1); }
.fd-wav-tracks li { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 8px; margin: 0; padding: 12px 0; border-bottom: 1px solid rgba(246,237,228,0.08); font: 400 0.9375rem/1.2 var(--fd-wav-sans); color: rgba(246,237,228,0.6); }
.fd-wav-tracks li.is-on { color: var(--fd-wav-ink); }
.fd-wav-tracks li.is-on .fd-wav-n { color: var(--fd-wav-hot); }
.fd-wav-n, .fd-wav-tm { font: 500 0.75rem/1.6 ui-monospace, "SF Mono", Menlo, monospace; color: rgba(246,237,228,0.4); }
.fd-wav-tt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-wav-cta { grid-column: 1 / -1; justify-self: start; display: inline-flex; align-items: center; height: 46px; margin: 4px 0 0; padding: 0 22px; border-radius: 9999px; border: 1px solid rgba(246,237,228,0.25); color: var(--fd-wav-ink); text-decoration: none; font: 600 0.875rem/1 var(--fd-wav-sans); letter-spacing: 0.02em; transition: background var(--fd-dur-2), color var(--fd-dur-2), transform var(--fd-dur-2) var(--fd-spring); }
.fd-wav-cta:hover { background: var(--fd-wav-ink); color: var(--fd-wav-bg); }
.fd-wav-cta:active { transform: scale(0.96); }

.fd-wav-spec { position: absolute; z-index: 2; left: 0; right: 0; bottom: 0; height: 200px; display: flex; align-items: flex-end; gap: 3px; padding: 0 3px; pointer-events: none; -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
.fd-wav-b { flex: 1; height: 100%; border-radius: 3px 3px 0 0; transform-origin: bottom; transform: scaleY(0.1); will-change: transform; background: linear-gradient(180deg, color-mix(in srgb, var(--fd-wav-cool) calc(var(--u) * 100%), var(--fd-wav-hot)) 0%, rgba(255,90,54,0.05) 100%); opacity: 0.85; }

@keyframes fd-wav-in { from { transform: translateY(100%) scaleY(1.6); } to { transform: scaleY(1.12); } }
@keyframes fd-wav-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes fd-wav-rise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
@keyframes fd-wav-sleevein { from { opacity: 0; transform: perspective(1400px) rotateY(-50deg) translateX(-80px); filter: blur(10px); } to { opacity: 1; filter: none; } }
@keyframes fd-wav-slide { from { transform: translateX(0) rotate(0deg); } to { transform: translateX(38%) rotate(140deg); } }
@keyframes fd-wav-spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .fd-wav { min-height: 844px; }
  .fd-wav-top { padding: 84px 20px 0; }
  .fd-wav-release { display: none; }
  .fd-wav-big { flex-direction: column; align-items: center; gap: 0; font-size: 27vw; margin-top: 14px; }
  .fd-wav-stage { grid-template-columns: 1fr; gap: 28px; margin-top: 24px; padding: 0 20px; }
  .fd-wav-sleeve { width: 210px; margin: 0 auto 0 8px; }
  .fd-wav-art-top { padding: 8px 9px 7px; font-size: 0.5rem; }
  .fd-wav-art-band { padding: 6px 9px 8px; gap: 4px; }
  .fd-wav-art-t { font-size: 1.375rem; }
  .fd-wav-art-m { font-size: 0.4375rem; }
  .fd-wav-player { margin: 0; grid-template-columns: auto minmax(0, 1fr); }
  .fd-wav-stage { align-items: start; }
  .fd-wav-play { width: 64px; height: 64px; }
  .fd-wav-tracks, .fd-wav-cta { display: none; }
  .fd-wav-spec { height: 120px; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-wav *, .fd-wav *::before { animation: none !important; }
  .fd-wav-c { transform: scaleY(1.12); }
  .fd-wav-vinyl { transform: translateX(38%); }
}
`;

/* ───────────────────────── Demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-wav-demo">
      <style>{demoCss}</style>
      <header className="fd-wav-demo-nav">
        <a className="fd-wav-demo-logo" href="#top">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M3 14v-4M7 18V6M11 15V9M15 20V4M19 16V8" stroke="#FF5A36" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          Resonant
        </a>
        <nav aria-label="Primary">
          <a href="#home">Home</a>
          <a href="#new">New releases</a>
          <a href="#live">Live</a>
          <a href="#library">Library</a>
        </nav>
        <a className="fd-wav-demo-cta" href="#trial">Try 3 months free</a>
      </header>
      <HeroMusicWaveform />
    </div>
  );
}

const demoCss = `
.fd-wav-demo { position: relative; margin: 0; padding: 0; min-height: 100vh; background: #0E0A0B; }
.fd-wav-demo *, .fd-wav-demo *::before, .fd-wav-demo *::after { box-sizing: border-box; }
.fd-wav-demo-nav { position: absolute; z-index: 10; top: 0; left: 0; right: 0; max-width: 1320px; height: 72px; margin: 0 auto; padding: 0 40px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.fd-wav-demo-logo { display: inline-flex; align-items: center; gap: 9px; margin: 0; color: #F6EDE4; text-decoration: none; font: 700 1.125rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; letter-spacing: -0.03em; }
.fd-wav-demo-logo svg { display: block; }
.fd-wav-demo-nav nav { display: flex; gap: 28px; }
.fd-wav-demo-nav nav a { color: rgba(246,237,228,0.6); text-decoration: none; font: 500 0.875rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; transition: color 120ms; }
.fd-wav-demo-nav nav a:hover { color: #F6EDE4; }
.fd-wav-demo-cta { display: inline-flex; align-items: center; height: 36px; padding: 0 16px; border-radius: 9999px; background: #FF5A36; color: #0E0A0B; text-decoration: none; font: 700 0.8125rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; }
.fd-wav-demo-nav a:focus-visible { outline: 2px solid rgba(255,181,71,.8); outline-offset: 2px; border-radius: 8px; }
@media (max-width: 900px) { .fd-wav-demo-nav { padding: 0 20px; height: 64px; } .fd-wav-demo-nav nav { display: none; } }
`;
