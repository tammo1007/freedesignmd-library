/**
 * GlassMediaControls, clear Liquid Glass playback controls for video/music.
 *
 * Clear glass is the HIG variant for controls over rich media: highly
 * translucent so the picture shows through, with a refracting rim. Over bright
 * footage, turn on `dim` for the 35% dimming layer so white glyphs stay legible.
 *
 * Pieces (all clear glass, separate capsules, no glass on glass):
 *   - transport: back 10 s · play/pause (XL) · forward 10 s
 *   - scrubber capsule: elapsed · track · remaining (thumb turns to glass while dragged)
 *   - volume capsule: mute toggle + level track
 *
 * Props: playing + onPlayingChange, time + duration (s) + onSeek(s),
 *   volume (0–1) + onVolumeChange, muted + onMutedChange, dim, title.
 * Keyboard: all real <button>s and <input type="range">s (Arrow/Home/End).
 * Browser support: refraction in Chromium; frosted glass elsewhere.
 * Reduced motion: no press bounce or knob swell.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { GlassScope, LiquidGlass, useGlassEnv, useSpring } from "./liquid-glass";

export interface GlassMediaControlsProps {
  playing: boolean;
  onPlayingChange: (p: boolean) => void;
  time: number;
  duration: number;
  onSeek: (t: number) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  muted: boolean;
  onMutedChange: (m: boolean) => void;
  dim?: boolean;
  /** Accessible name of the media, e.g. "Tidelines, episode 3". */
  title: string;
  className?: string;
}

const fmt = (s: number) => {
  const t = Math.max(0, Math.round(s));
  const m = Math.floor(t / 60);
  return `${m}:${String(t % 60).padStart(2, "0")}`;
};

/** Thin range track with a knob that becomes glass while dragged. */
function Track({ value, max, step, label, valueText, onChange }: { value: number; max: number; step: number; label: string; valueText: string; onChange: (v: number) => void }) {
  const env = useGlassEnv();
  const knob = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const lift = useSpring(0, (v) => {
    const k = knob.current;
    if (!k) return;
    k.style.setProperty("--fd-gmc-k", v.toFixed(3));
  }, { stiffness: 520, damping: 28 });
  useEffect(() => {
    if (env.reducedMotion) lift.set(active ? 1 : 0);
    else lift.to(active ? 1 : 0);
  }, [active, env.reducedMotion, lift]);
  const pct = max ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <span className={`fd-gmc-track${active ? " is-active" : ""}`} style={{ "--p": pct } as CSSProperties}>
      <span className="fd-gmc-rail" aria-hidden="true">
        <span className="fd-gmc-fill" />
      </span>
      <LiquidGlass ref={knob} as="span" className="fd-gmc-knob" variant="clear" radius="capsule" refraction={1.3} shadow={false} aria-hidden="true">
        <span className="fd-gmc-knob-solid" />
      </LiquidGlass>
      <input
        type="range"
        className="fd-gmc-input"
        min={0}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={valueText}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={() => setActive(true)}
        onPointerUp={() => setActive(false)}
        onPointerCancel={() => setActive(false)}
        onBlur={() => setActive(false)}
      />
    </span>
  );
}

const I = ({ children, size = 24 }: { children: ReactNode; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    {children}
  </svg>
);

export function GlassMediaControls({ playing, onPlayingChange, time, duration, onSeek, volume, onVolumeChange, muted, onMutedChange, dim = false, title, className }: GlassMediaControlsProps) {
  const vol = muted ? 0 : volume;
  return (
    <GlassScope>
      <div className={["fd-gmc", className ?? ""].filter(Boolean).join(" ")} role="group" aria-label={`Playback controls, ${title}`}>
        <style>{css}</style>
        <div className="fd-gmc-transport">
          <LiquidGlass as="button" type="button" className="fd-gmc-btn" variant="clear" dim={dim} interactive aria-label="Back 10 seconds" onClick={() => onSeek(Math.max(0, time - 10))}>
            <Skip back />
          </LiquidGlass>
          <LiquidGlass as="button" type="button" className="fd-gmc-btn fd-gmc-play" variant="clear" dim={dim} interactive aria-label={playing ? "Pause" : "Play"} aria-pressed={playing} onClick={() => onPlayingChange(!playing)}>
            <span className={`fd-gmc-pp${playing ? " is-playing" : ""}`} aria-hidden="true">
              <I size={34}>
                <path className="fd-gmc-pp-a" d="M7 4.6v14.8c0 .9 1 1.4 1.7.9l11.2-7.4a1.1 1.1 0 0 0 0-1.8L8.7 3.7C8 3.2 7 3.7 7 4.6Z" />
              </I>
              <I size={34}>
                <rect x="5.5" y="4" width="4.6" height="16" rx="1.4" />
                <rect x="13.9" y="4" width="4.6" height="16" rx="1.4" />
              </I>
            </span>
          </LiquidGlass>
          <LiquidGlass as="button" type="button" className="fd-gmc-btn" variant="clear" dim={dim} interactive aria-label="Forward 10 seconds" onClick={() => onSeek(Math.min(duration, time + 10))}>
            <Skip />
          </LiquidGlass>
        </div>

        <div className="fd-gmc-bar">
          <LiquidGlass className="fd-gmc-scrub" variant="clear" dim={dim}>
            <span className="fd-gmc-time">{fmt(time)}</span>
            <Track value={time} max={duration} step={1} label="Seek" valueText={`${fmt(time)} of ${fmt(duration)}`} onChange={onSeek} />
            <span className="fd-gmc-time">−{fmt(duration - time)}</span>
          </LiquidGlass>
          <LiquidGlass className="fd-gmc-vol" variant="clear" dim={dim}>
            <button type="button" className="fd-gmc-mute" aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} onClick={() => onMutedChange(!muted)}>
              <I size={20}>
                <path d="M4 9.2h3.3L12 5v14l-4.7-4.2H4a1 1 0 0 1-1-1v-3.6a1 1 0 0 1 1-1Z" />
                {vol === 0 ? (
                  <path d="m15.5 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" />
                ) : (
                  <>
                    <path d="M15 9.2a4 4 0 0 1 0 5.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" />
                    {vol > 0.5 ? <path d="M17.6 6.6a7.6 7.6 0 0 1 0 10.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" /> : null}
                  </>
                )}
              </I>
            </button>
            <Track
              value={Math.round(vol * 100)}
              max={100}
              step={1}
              label="Volume"
              valueText={`${Math.round(vol * 100)}%`}
              onChange={(v) => {
                onVolumeChange(v / 100);
                if (muted && v > 0) onMutedChange(false);
              }}
            />
          </LiquidGlass>
        </div>
      </div>
    </GlassScope>
  );
}

function Skip({ back = false }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={back ? undefined : { transform: "scaleX(-1)" }}>
      <path d="M9.5 6.5A9.5 9.5 0 1 1 4.6 15" />
      <path d="M9.8 2.6 9.5 6.5l3.9.6" />
      <text x="14" y="18" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8.5" fontWeight="700" fontFamily="ui-sans-serif,-apple-system,Inter,sans-serif" style={back ? undefined : { transform: "scaleX(-1)", transformOrigin: "14px 14px" }}>
        10
      </text>
    </svg>
  );
}

const css = `
.fd-gmc,.fd-gmc *,.fd-gmc *::before,.fd-gmc *::after{box-sizing:border-box}
.fd-gmc{display:flex;flex-direction:column;align-items:center;gap:18px;width:100%;margin:0;padding:0;color:#fff;font:600 13px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal}
.fd-gmc-transport{display:flex;align-items:center;gap:22px;margin:0;padding:0}
.fd-gmc-btn{display:grid;place-items:center;width:58px;height:58px;margin:0;padding:0;color:#fff}
.fd-gmc-btn svg{display:block}
.fd-gmc-play{width:84px;height:84px}
.fd-gmc-pp{position:relative;display:block;width:34px;height:34px;margin:0;padding:0}
.fd-gmc-pp svg{position:absolute;inset:0;transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring)}
.fd-gmc-pp svg:first-child{transform:translateX(2px)}
.fd-gmc-pp svg:last-child{opacity:0;transform:scale(0.6)}
.fd-gmc-pp.is-playing svg:first-child{opacity:0;transform:translateX(2px) scale(0.6)}
.fd-gmc-pp.is-playing svg:last-child{opacity:1;transform:none}
.fd-gmc-bar{display:flex;align-items:center;gap:12px;width:100%;margin:0;padding:0}
.fd-gmc-scrub{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:14px;height:52px;margin:0;padding:0 20px}
.fd-gmc-vol{flex:0 0 200px;display:flex;align-items:center;gap:10px;height:52px;margin:0;padding:0 18px 0 8px}
.fd-gmc-time{flex:none;min-width:40px;margin:0;padding:0;font:600 13px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;font-variant-numeric:tabular-nums;color:rgba(255,255,255,0.92);text-align:center}
.fd-gmc-mute{flex:none;display:grid;place-items:center;width:36px;height:36px;margin:0;padding:0;border:0;border-radius:50%;background:none;color:#fff;cursor:pointer;-webkit-appearance:none;appearance:none;transition:background-color var(--fd-dur-1) linear}
.fd-gmc-mute:hover{background:rgba(255,255,255,0.12)}
.fd-gmc-mute svg{display:block}
.fd-gmc-mute:focus-visible,.fd-gmc-btn:focus-visible{outline:2px solid color-mix(in srgb,#0A84FF 70%,transparent);outline-offset:2px}
.fd-gmc-track{position:relative;flex:1 1 auto;min-width:40px;height:28px;display:block;margin:0;padding:0}
.fd-gmc-rail{position:absolute;left:0;right:0;top:50%;height:6px;margin:-3px 0 0;padding:0;display:block;border-radius:999px;background:rgba(255,255,255,0.28);overflow:hidden;transition:height var(--fd-dur-2) var(--fd-ease-out),margin var(--fd-dur-2) var(--fd-ease-out)}
.fd-gmc-track.is-active .fd-gmc-rail{height:10px;margin-top:-5px}
.fd-gmc-fill{position:absolute;left:0;top:0;bottom:0;width:calc(var(--p) * 100%);display:block;margin:0;padding:0;background:#fff;border-radius:inherit}
.fd-gmc-knob{position:absolute !important;top:50%;left:calc(var(--p) * (100% - 22px));width:22px;height:22px;margin:-11px 0 0;padding:0;display:block;pointer-events:none;
  transform:scale(calc(0.55 + var(--fd-gmc-k,0) * 0.95));--fd-lg-shadow:0 2px 6px rgba(0,0,0,0.3)}
.fd-gmc-knob-solid{position:absolute;inset:0;display:block;margin:0;padding:0;border-radius:inherit;background:#fff;opacity:calc(1 - var(--fd-gmc-k,0) * 1.15)}
.fd-gmc-knob .fd-lg-spec{opacity:var(--fd-gmc-k,0)}
.fd-gmc-input{position:absolute;inset:-8px 0;width:100%;height:calc(100% + 16px);margin:0;padding:0;border:0;opacity:0;cursor:pointer;-webkit-appearance:none;appearance:none;background:none}
.fd-gmc-track:has(.fd-gmc-input:focus-visible) .fd-gmc-rail{box-shadow:0 0 0 2px color-mix(in srgb,#0A84FF 70%,transparent)}
@media (max-width:640px){
  .fd-gmc-bar{flex-direction:column;align-items:stretch}
  .fd-gmc-vol{flex:none}
  .fd-gmc-transport{gap:16px}
}
@media (prefers-reduced-motion: reduce){.fd-gmc-pp svg{transition-duration:120ms;transform:none !important}}
`;

/* ───────────────────────── demo: a film player ───────────────────────── */

const DURATION = 7 * 60 + 42;

export function Demo() {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(134);
  const [volume, setVolume] = useState(0.72);
  const [muted, setMuted] = useState(false);
  const [dim, setDim] = useState(true);
  const [shown, setShown] = useState(true);
  const stage = useRef<HTMLDivElement | null>(null);

  // play clock
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setTime((t) => (t + 1 >= DURATION ? 0 : t + 1)), 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  // auto-hide chrome while playing; any pointer move brings it back
  useEffect(() => {
    if (!playing) {
      setShown(true);
      return;
    }
    let t = window.setTimeout(() => setShown(false), 3200);
    const wake = () => {
      setShown(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setShown(false), 3200);
    };
    const el = stage.current;
    el?.addEventListener("pointermove", wake);
    el?.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(t);
      el?.removeEventListener("pointermove", wake);
      el?.removeEventListener("keydown", wake);
    };
  }, [playing]);

  return (
    <div className="fd-gmcd">
      <style>{demoCss}</style>
      <div className="fd-gmcd-page">
        <header className="fd-gmcd-nav">
          <span className="fd-gmcd-mark" aria-hidden="true" />
          <span className="fd-gmcd-word">Northbound</span>
          <span className="fd-gmcd-navbars" aria-hidden="true">
            <i /> <i /> <i />
          </span>
          <span className="fd-gmcd-avatar" aria-hidden="true" />
        </header>

        <div ref={stage} className={`fd-gmcd-frame${playing ? " is-playing" : ""}${shown ? "" : " is-hidden"}`}>
          <div className="fd-gmcd-film" aria-hidden="true">
            <div className="fd-gmcd-glow" />
            <div className="fd-gmcd-streak" />
            <div className="fd-gmcd-grid" />
            <div className="fd-gmcd-ring" />
            <div className="fd-gmcd-frag">03</div>
            <div className="fd-gmcd-vignette" />
            <div className="fd-gmcd-grain" />
          </div>
          <div className="fd-gmcd-top">
            <div className="fd-gmcd-meta">
              <p className="fd-gmcd-kicker">Northbound · Episode 3</p>
              <h1 className="fd-gmcd-title">The Lofoten Light</h1>
            </div>
            <button type="button" role="switch" aria-checked={dim} className="fd-gmcd-dim" onClick={() => setDim((d) => !d)}>
              <span className="fd-gmcd-dim-dot" aria-hidden="true" />
              Dimming layer {dim ? "on" : "off"}
            </button>
          </div>
          <div className="fd-gmcd-controls">
            <GlassMediaControls
              title="Northbound, episode 3: The Lofoten Light"
              playing={playing}
              onPlayingChange={setPlaying}
              time={time}
              duration={DURATION}
              onSeek={setTime}
              volume={volume}
              onVolumeChange={setVolume}
              muted={muted}
              onMutedChange={setMuted}
              dim={dim}
            />
          </div>
        </div>

        <div className="fd-gmcd-eps" aria-hidden="true">
          {["01", "02", "03"].map((n) => (
            <div key={n} className={`fd-gmcd-ep${n === "03" ? " is-current" : ""}`}>
              <span className="fd-gmcd-ep-th">
                <b>{n}</b>
              </span>
              <i />
              <i />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;
const D = `"SF Pro Display",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif`;
/* fine film grain, an inline SVG feTurbulence tile (no network) */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='1.4 0 0 0 -.2 1.4 0 0 0 -.2 1.4 0 0 0 -.2 0 0 0 0 1'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const demoCss = `
.fd-gmcd,.fd-gmcd *,.fd-gmcd *::before,.fd-gmcd *::after{box-sizing:border-box}
.fd-gmcd{position:relative;display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:24px 20px;overflow:hidden;
  background:radial-gradient(900px 420px at 50% -10%,rgba(120,130,255,0.14),transparent 70%),#0B0C10;color:#fff;font:400 15px/1.4 ${F};letter-spacing:normal}
.fd-gmcd-page{display:flex;flex-direction:column;gap:18px;width:min(960px,100%,calc((100vh - 236px) * 16 / 9));min-width:min(100%,560px);margin:0;padding:0}
.fd-gmcd-nav{display:flex;align-items:center;gap:10px;height:32px;margin:0;padding:0}
.fd-gmcd-mark{display:block;width:22px;height:22px;margin:0;border-radius:7px;background:linear-gradient(135deg,#8E9BFF,#3B3FB8)}
.fd-gmcd-word{margin:0 18px 0 0;font:650 15px/1 ${D};letter-spacing:-0.01em;color:#fff}
.fd-gmcd-navbars{display:flex;align-items:center;gap:8px;flex:1;margin:0;padding:0}
.fd-gmcd-navbars i{display:block;width:56px;height:8px;border-radius:4px;background:rgba(255,255,255,0.09)}
.fd-gmcd-avatar{display:block;flex:none;width:28px;height:28px;margin:0;border-radius:50%;background:rgba(255,255,255,0.12)}
.fd-gmcd-frame{position:relative;width:100%;aspect-ratio:16/9;margin:0;padding:0;overflow:hidden;border-radius:28px;background:#0B0B14;isolation:isolate;box-shadow:0 0 0 1px rgba(255,255,255,0.07),0 40px 80px -40px rgba(0,0,0,0.8)}
.fd-gmcd-film{position:absolute;inset:0;margin:0;padding:0;overflow:hidden;
  background:linear-gradient(155deg,#141A3D 0%,#1D2358 34%,#2A2066 58%,#0C0B18 100%)}
.fd-gmcd-film > div{position:absolute;display:block;margin:0;padding:0}
.fd-gmcd-glow{inset:-20%;background:
  radial-gradient(38% 46% at 78% 24%,rgba(125,110,255,0.55),transparent 70%),
  radial-gradient(34% 44% at 18% 82%,rgba(40,170,210,0.38),transparent 70%);animation:fd-gmcd-drift 26s ease-in-out infinite alternate;animation-play-state:paused}
.fd-gmcd-streak{left:-10%;right:-10%;top:-30%;bottom:-30%;background:linear-gradient(112deg,transparent 38%,rgba(170,185,255,0.30) 49%,rgba(255,255,255,0.40) 50%,rgba(170,185,255,0.22) 52%,transparent 63%);filter:blur(6px);animation:fd-gmcd-pan 30s ease-in-out infinite alternate;animation-play-state:paused}
.fd-gmcd-grid{inset:0;background:
  repeating-linear-gradient(90deg,rgba(255,255,255,0.10) 0 1px,transparent 1px 64px),
  repeating-linear-gradient(0deg,rgba(255,255,255,0.10) 0 1px,transparent 1px 64px);
  -webkit-mask:radial-gradient(70% 80% at 50% 45%,#000 0%,transparent 100%);mask:radial-gradient(70% 80% at 50% 45%,#000 0%,transparent 100%)}
.fd-gmcd-ring{right:7%;top:14%;width:54%;aspect-ratio:1;max-height:none;border-radius:50%;
  background:conic-gradient(from 200deg,rgba(255,255,255,0),rgba(255,255,255,0.7) 30%,rgba(150,160,255,0.25) 58%,rgba(255,255,255,0) 82%);
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 12px),#000 calc(100% - 11px));mask:radial-gradient(farthest-side,transparent calc(100% - 12px),#000 calc(100% - 11px))}
.fd-gmcd-frag{left:5%;bottom:12%;font:800 clamp(10rem,27vw,21rem)/0.72 ${D};letter-spacing:-0.06em;color:rgba(255,255,255,0.05);-webkit-text-stroke:2px rgba(255,255,255,0.32);white-space:nowrap}
.fd-gmcd-vignette{inset:0;background:radial-gradient(120% 100% at 50% 40%,transparent 55%,rgba(0,0,0,0.5) 100%),linear-gradient(0deg,rgba(0,0,0,0.25),transparent 40%)}
.fd-gmcd-grain{inset:0;background-image:${GRAIN};background-size:180px 180px;mix-blend-mode:soft-light;opacity:0.3}
.fd-gmcd-frame.is-playing .fd-gmcd-glow,.fd-gmcd-frame.is-playing .fd-gmcd-streak{animation-play-state:running}
@keyframes fd-gmcd-drift{to{transform:translate(4%,3%) scale(1.06)}}
@keyframes fd-gmcd-pan{to{transform:translateX(7%)}}
.fd-gmcd-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:0;padding:26px 28px;
  background:linear-gradient(180deg,rgba(0,0,0,0.30),transparent);transition:opacity 420ms cubic-bezier(0.22,1,0.36,1),transform 420ms cubic-bezier(0.22,1,0.36,1)}
.fd-gmcd-meta{margin:0;padding:0;text-shadow:0 1px 12px rgba(0,0,0,0.3)}
.fd-gmcd-kicker{margin:0 0 6px;font:600 12px/1.2 ${F};letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.8)}
.fd-gmcd-title{margin:0;font:700 clamp(1.75rem,3.4vw,2.75rem)/1 ${D};letter-spacing:-0.035em;color:#fff}
.fd-gmcd-dim{display:inline-flex;align-items:center;gap:8px;flex:none;margin:0;padding:9px 14px;border:0;border-radius:999px;background:rgba(0,0,0,0.38);color:#fff;font:600 13px/1 ${F};letter-spacing:normal;cursor:pointer;-webkit-appearance:none;appearance:none;
  -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.fd-gmcd-dim-dot{display:block;width:10px;height:10px;border-radius:50%;background:#8E8E93;transition:background-color 240ms}
.fd-gmcd-dim[aria-checked="true"] .fd-gmcd-dim-dot{background:#30D158}
.fd-gmcd-dim:focus-visible{outline:2px solid color-mix(in srgb,#0A84FF 70%,transparent);outline-offset:2px}
.fd-gmcd-controls{position:absolute;left:50%;bottom:24px;width:min(640px,calc(100% - 32px));margin:0;padding:0;transform:translateX(-50%);transition:opacity 420ms cubic-bezier(0.22,1,0.36,1),transform 420ms cubic-bezier(0.22,1,0.36,1)}
.fd-gmcd-frame.is-hidden .fd-gmcd-controls{opacity:0;transform:translate(-50%,16px);pointer-events:none}
.fd-gmcd-frame.is-hidden .fd-gmcd-top{opacity:0;transform:translateY(-10px)}
.fd-gmcd-frame.is-hidden{cursor:none}
.fd-gmcd-eps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:0;padding:0}
.fd-gmcd-ep{display:grid;grid-template-columns:96px 1fr;grid-template-rows:1fr 1fr;column-gap:12px;row-gap:8px;align-items:center;margin:0;padding:8px;border-radius:16px;background:rgba(255,255,255,0.03);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05)}
.fd-gmcd-ep.is-current{background:rgba(255,255,255,0.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.16)}
.fd-gmcd-ep-th{grid-row:1/3;position:relative;display:grid;place-items:center;aspect-ratio:16/9;margin:0;border-radius:10px;overflow:hidden;background:linear-gradient(150deg,#1D2358,#0F1030)}
.fd-gmcd-ep-th b{margin:0;font:700 17px/1 ${D};letter-spacing:-0.02em;color:rgba(255,255,255,0.7)}
.fd-gmcd-ep > i{display:block;height:8px;margin:0;border-radius:4px;background:rgba(255,255,255,0.1)}
.fd-gmcd-ep > i:last-child{width:62%}
.fd-gmcd-ep > i:nth-of-type(1){align-self:end}
.fd-gmcd-ep > i:nth-of-type(2){align-self:start}
@media (max-width:640px){
  .fd-gmcd{align-items:flex-start;padding:16px 16px 24px}
  .fd-gmcd-page{width:100%;min-width:0}
  .fd-gmcd-frame{aspect-ratio:9/15;border-radius:24px}
  .fd-gmcd-top{flex-direction:column;padding:20px 18px}
  .fd-gmcd-controls{bottom:16px}
  .fd-gmcd-ring{right:4%;top:26%;width:84%}
  .fd-gmcd-frag{left:6%;bottom:auto;top:32%}
  .fd-gmcd-navbars i:nth-child(n+3){display:none}
  .fd-gmcd-eps{gap:8px}
  .fd-gmcd-ep{grid-template-columns:1fr;grid-template-rows:auto 8px 8px;padding:6px}
  .fd-gmcd-ep-th{grid-row:auto}
}
@media (prefers-reduced-motion: reduce){.fd-gmcd-glow,.fd-gmcd-streak{animation:none}}
`;
