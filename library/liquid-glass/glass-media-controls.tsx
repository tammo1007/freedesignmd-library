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

/* ───────────────────────── demo ───────────────────────── */

const DURATION = 7 * 60 + 42;

export function Demo() {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(134);
  const [volume, setVolume] = useState(0.72);
  const [muted, setMuted] = useState(false);

  // play clock
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setTime((t) => (t + 1 >= DURATION ? 0 : t + 1)), 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  return (
    <div className="fd-gmcd">
      <style>{demoCss}</style>
      <div className="fd-gmcd-box">
        <GlassMediaControls
          title="Now playing"
          playing={playing}
          onPlayingChange={setPlaying}
          time={time}
          duration={DURATION}
          onSeek={setTime}
          volume={volume}
          onVolumeChange={setVolume}
          muted={muted}
          onMutedChange={setMuted}
        />
      </div>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-gmcd,.fd-gmcd *,.fd-gmcd *::before,.fd-gmcd *::after{box-sizing:border-box}
.fd-gmcd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;color:#1d1d1f;font:400 15px/1.4 ${F};letter-spacing:normal;
  background:radial-gradient(46% 62% at 28% 32%,#ff9f73 0%,transparent 72%),radial-gradient(44% 58% at 74% 68%,#7d8cff 0%,transparent 72%),radial-gradient(30% 40% at 62% 22%,#ff86b8 0%,transparent 72%),#d9d2dc}
.fd-gmcd-box{width:min(100%,460px);margin:0;padding:0}
`;
