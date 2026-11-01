/**
 * HoverRevealCard — a profile/media card with eight interchangeable hover
 * transitions. Pass one piece of artwork as `media`; the card renders a muted
 * (greyscale) base and a full-colour reveal, and the chosen transition moves
 * between them while an info overlay slides in.
 *
 * Effects: "blob" (organic morph reveal), "diagonal" (corner wipe with sheen),
 * "strips" (vertical shutters sweep through), "pixels" (mosaic dissolve),
 * "iris" (circle opens from the cursor), "slices" (rows slide in from
 * alternating sides), "focus" (blur to sharp + info panel), "liquid" (an SVG
 * displacement lens that bulges under the cursor).
 *
 * Props: effect, media, name, role, caption, info (ReactNode), accent.
 * CSS vars: --fd-ht-accent, --fd-ht-radius, --fd-ht-ink.
 *
 * Browser support: evergreen. "blob" uses @property (falls back to an instant
 * swap without it). "liquid" uses an SVG filter on HTML (Chromium, Firefox;
 * Safari shows the crossfade only).
 * Accessibility: cards are focusable and the reveal state also follows
 * keyboard focus; on touch, a tap toggles it. Reduced motion swaps state with
 * a ≤120ms fade.
 *
 * Demo images: /img/people/p1.webp … p8.webp (placeholder portraits, included in
 * the repo's public/img/people — copy them next to your page or swap in your own).
 */
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export type HoverEffect = "blob" | "diagonal" | "strips" | "pixels" | "iris" | "slices" | "focus" | "liquid";

export interface HoverRevealCardProps {
  effect: HoverEffect;
  media: ReactNode;
  name: string;
  role: string;
  caption?: string;
  info?: ReactNode;
  accent?: string;
  className?: string;
  style?: CSSProperties;
}

const PIX_COLS = 6;
const PIX_ROWS = 8;
// deterministic pseudo-random delays so SSR and client markup match
const pixDelay = (i: number) => {
  const x = Math.sin(i * 91.7 + 13.3) * 43758.5453;
  return Math.round((x - Math.floor(x)) * 220);
};

function bulgeMap(): string {
  const n = 256;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x / (n - 1)) * 2 - 1;
      const dy = (y / (n - 1)) * 2 - 1;
      const d = Math.min(1, Math.hypot(dx, dy));
      const f = d < 1 ? Math.pow(1 - d * d, 1.6) : 0;
      const i = (y * n + x) * 4;
      // sample toward the centre → magnified lens
      img.data[i] = 128 - dx * f * 127;
      img.data[i + 1] = 128 - dy * f * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

export function HoverRevealCard({ effect, media, name, role, caption, info, accent = "#0A84FF", className, style }: HoverRevealCardProps) {
  const ref = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const feImg = useRef<SVGFEImageElement>(null);
  const feDisp = useRef<SVGFEDisplacementMapElement>(null);
  const [on, setOn] = useState(false);
  const [touched, setTouched] = useState(false);
  const fid = `fd-ht-f${useId().replace(/:/g, "")}`;
  const lens = useRef({ on: false, x: 0, y: 0, s: 0, v: 0, raf: 0, last: 0, reduced: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    lens.current.reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (effect === "liquid" && feImg.current && !lens.current.reduced) {
      const url = bulgeMap();
      feImg.current.setAttribute("href", url);
      feImg.current.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", url);
    }
    return () => cancelAnimationFrame(lens.current.raf);
  }, [effect]);

  const LENS = 180;
  const placeLens = () => {
    const L = lens.current;
    if (!feImg.current || !feDisp.current) return;
    feImg.current.setAttribute("x", String(L.x - LENS / 2));
    feImg.current.setAttribute("y", String(L.y - LENS / 2));
    feDisp.current.setAttribute("scale", (L.s * 64).toFixed(2));
  };
  const tickLens = (t: number) => {
    const L = lens.current;
    const dt = Math.min(0.032, (t - L.last) / 1000 || 0.016);
    L.last = t;
    const goal = L.on ? 1 : 0;
    for (let i = 0; i < 2; i++) {
      const h = dt / 2;
      L.v += (-380 * (L.s - goal) - 30 * L.v) * h;
      L.s += L.v * h;
    }
    placeLens();
    if (Math.abs(L.s - goal) < 0.002 && Math.abs(L.v) < 0.002) {
      L.s = goal;
      placeLens();
      L.raf = 0;
    } else L.raf = requestAnimationFrame(tickLens);
  };
  const kickLens = () => {
    const L = lens.current;
    if (effect !== "liquid" || L.reduced) return;
    if (!L.raf) {
      L.last = performance.now();
      L.raf = requestAnimationFrame(tickLens);
    } else placeLens();
  };

  const point = (cx: number, cy: number) => {
    const m = mediaRef.current;
    if (!m) return;
    const r = m.getBoundingClientRect();
    const x = cx - r.left;
    const y = cy - r.top;
    m.style.setProperty("--fd-ht-x", `${x.toFixed(1)}px`);
    m.style.setProperty("--fd-ht-y", `${y.toFixed(1)}px`);
    m.style.setProperty("--fd-ht-px", `${((x / r.width) * 100).toFixed(1)}%`);
    m.style.setProperty("--fd-ht-py", `${((y / r.height) * 100).toFixed(1)}%`);
    lens.current.x = x;
    lens.current.y = y;
  };
  const center = () => {
    const m = mediaRef.current;
    if (!m) return;
    const r = m.getBoundingClientRect();
    point(r.left + r.width / 2, r.top + r.height / 2);
  };
  const set = (v: boolean) => {
    setTouched(true);
    setOn(v);
    lens.current.on = v;
    kickLens();
  };

  return (
    <article
      ref={ref}
      tabIndex={0}
      className={`fd-ht${className ? " " + className : ""}`}
      data-fx={effect}
      data-on={on ? "" : undefined}
      data-touched={touched ? "" : undefined}
      aria-label={`${name}, ${role}`}
      style={{ ["--fd-ht-accent" as string]: accent, ...style }}
      onPointerEnter={(e) => {
        if (e.pointerType === "touch") return;
        point(e.clientX, e.clientY);
        set(true);
      }}
      onPointerMove={(e) => {
        if (e.pointerType === "touch") return;
        point(e.clientX, e.clientY);
        if (effect === "liquid") kickLens();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "touch") return;
        point(e.clientX, e.clientY);
        set(false);
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== "touch") return;
        point(e.clientX, e.clientY);
        set(!on);
      }}
      onFocus={(e) => {
        if (!e.currentTarget.matches(":focus-visible")) return;
        center();
        set(true);
      }}
      onBlur={() => set(false)}
    >
      <div
        ref={mediaRef}
        className="fd-ht-media"
        style={effect === "liquid" ? { filter: `url(#${fid})` } : undefined}
      >
        {effect === "liquid" && (
          <svg className="fd-ht-defs" aria-hidden="true" width="0" height="0">
            <filter id={fid} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
              <feFlood floodColor="rgb(128,128,128)" result="flat" />
              <feImage ref={feImg} result="lens" x="-200" y="-200" width={LENS} height={LENS} preserveAspectRatio="none" />
              <feComposite in="lens" in2="flat" operator="over" result="map" />
              <feDisplacementMap ref={feDisp} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>
        )}
        <div className="fd-ht-layer fd-ht-base" aria-hidden="true">
          {media}
        </div>

        {effect === "slices" ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="fd-ht-slice" data-i={i} aria-hidden="true">
              <div className="fd-ht-slice-art">{media}</div>
            </div>
          ))
        ) : effect === "blob" ? (
          <>
            <div className="fd-ht-layer fd-ht-blob fd-ht-blob-lead" aria-hidden="true" />
            <div className="fd-ht-layer fd-ht-blob fd-ht-reveal" aria-hidden="true">
              {media}
            </div>
          </>
        ) : (
          <div className="fd-ht-layer fd-ht-reveal" aria-hidden="true">
            {media}
          </div>
        )}

        {effect === "diagonal" && <span className="fd-ht-sheen" aria-hidden="true" />}
        {effect === "iris" && <span className="fd-ht-ring" aria-hidden="true" />}
        {effect === "liquid" && <span className="fd-ht-drop" aria-hidden="true" />}
        {effect === "strips" && (
          <div className="fd-ht-strips" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="fd-ht-strip" style={{ ["--i" as string]: i }} />
            ))}
          </div>
        )}
        {effect === "pixels" && (
          <div className="fd-ht-pix" aria-hidden="true">
            {Array.from({ length: PIX_COLS * PIX_ROWS }, (_, i) => (
              <span key={i} className="fd-ht-tile" style={{ ["--d" as string]: `${pixDelay(i)}ms` }} />
            ))}
          </div>
        )}

        {info && <div className="fd-ht-info">{info}</div>}
      </div>
      <div className="fd-ht-meta">
        <div className="fd-ht-who">
          <h3 className="fd-ht-name">{name}</h3>
          <p className="fd-ht-role">{role}</p>
        </div>
        {caption && <span className="fd-ht-cap">{caption}</span>}
      </div>
      <style>{css}</style>
    </article>
  );
}

// organic blob, drawn in a 100×100 box
const BLOB =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M52 6c13 1 27 6 34 18 8 13 9 27 4 41-5 15-17 27-32 30-16 4-33-2-44-14C4 69 2 52 8 38 15 22 33 5 52 6z"/></svg>',
  );

const css = `
.fd-ht{
  --fd-ease-out:cubic-bezier(0.22,1,0.36,1);--fd-ease-in-out:cubic-bezier(0.65,0,0.35,1);
  --fd-spring:cubic-bezier(0.34,1.56,0.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-ht-radius:20px;--fd-ht-ink:#0B0B0F;
  --fd-ht-sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --fd-ht-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  position:relative;display:flex;flex-direction:column;gap:14px;margin:0;padding:0;
  color:#F5F5F7;background:transparent;outline:none;cursor:default;-webkit-tap-highlight-color:transparent;
}
.fd-ht,.fd-ht *,.fd-ht *::before,.fd-ht *::after{box-sizing:border-box}
.fd-ht:focus-visible .fd-ht-media{outline:2px solid color-mix(in srgb,#0A84FF 70%,transparent);outline-offset:2px}
.fd-ht-media{
  --fd-ht-x:50%;--fd-ht-y:50%;
  position:relative;display:block;aspect-ratio:4/5;width:100%;margin:0;padding:0;overflow:hidden;
  border-radius:var(--fd-ht-radius);background:#16161B;isolation:isolate;
  box-shadow:0 0 0 1px rgba(255,255,255,.06) inset;
}
.fd-ht-defs{position:absolute;width:0;height:0;overflow:hidden}
.fd-ht-layer{position:absolute;inset:0;margin:0;padding:0}
.fd-ht-layer > *,.fd-ht-slice-art > *,.fd-ht-blob-art > *{display:block;width:100%;height:100%}
.fd-ht-base{filter:grayscale(1) contrast(1.06) brightness(.86)}
.fd-ht-reveal{z-index:1}

/* info overlay */
.fd-ht-info{
  position:absolute;left:0;right:0;bottom:0;z-index:6;margin:0;padding:48px 18px 16px;
  background:linear-gradient(to top,rgba(8,8,11,.82),rgba(8,8,11,0));color:#F5F5F7;
  font:400 0.8125rem/1.45 var(--fd-ht-sans);letter-spacing:0;
  opacity:0;transform:translate3d(0,14px,0);
  transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-ease-out);
  pointer-events:none;
}
.fd-ht[data-on] .fd-ht-info{opacity:1;transform:none;transition-delay:160ms}

/* meta */
.fd-ht-meta{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0;padding:0 2px}
.fd-ht-who{min-width:0;margin:0;padding:0}
.fd-ht-name{margin:0;padding:0;color:#F5F5F7;font:600 0.9375rem/1.25 var(--fd-ht-sans);letter-spacing:-0.005em}
.fd-ht-role{margin:3px 0 0;padding:0;color:rgba(245,245,247,.56);font:400 0.8125rem/1.3 var(--fd-ht-sans);letter-spacing:0}
.fd-ht-cap{
  flex:none;margin:2px 0 0;padding:0;color:rgba(245,245,247,.4);
  font:500 0.625rem/1.3 var(--fd-ht-mono);letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;
}
.fd-ht[data-on] .fd-ht-cap{color:var(--fd-ht-accent)}

/* 1 · blob — an organic SVG mask that grows from the cursor, led by an accent blob */
.fd-ht-blob{
  -webkit-mask-image:url("${BLOB}");mask-image:url("${BLOB}");
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  -webkit-mask-position:var(--fd-ht-px,50%) var(--fd-ht-py,50%);mask-position:var(--fd-ht-px,50%) var(--fd-ht-py,50%);
  -webkit-mask-size:0% 0%;mask-size:0% 0%;
  transition:-webkit-mask-size var(--fd-dur-3) var(--fd-ease-in-out),mask-size var(--fd-dur-3) var(--fd-ease-in-out);
}
.fd-ht-blob-lead{z-index:1;background:var(--fd-ht-accent)}
.fd-ht-blob.fd-ht-reveal{z-index:2}
.fd-ht[data-on] .fd-ht-blob{
  -webkit-mask-size:340% 300%;mask-size:340% 300%;
  transition:-webkit-mask-size 900ms var(--fd-ease-out),mask-size 900ms var(--fd-ease-out);
}
.fd-ht[data-on] .fd-ht-blob.fd-ht-reveal{transition-delay:90ms}
.fd-ht:not([data-on]) .fd-ht-blob-lead{transition-delay:80ms}

/* 2 · diagonal */
.fd-ht[data-fx="diagonal"] .fd-ht-reveal{
  clip-path:polygon(0 100%,0 100%,0 100%);
  transition:clip-path var(--fd-dur-4) var(--fd-ease-in-out);
}
.fd-ht[data-fx="diagonal"][data-on] .fd-ht-reveal{clip-path:polygon(0 100%,0 -100%,200% 100%)}
.fd-ht-sheen{
  position:absolute;left:-50%;top:50%;width:200%;height:2px;z-index:2;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.9) 50%,transparent);
  box-shadow:0 0 18px 4px var(--fd-ht-accent);
  transform:translate3d(-70%,70%,0) rotate(-51deg);opacity:0;
  transition:transform var(--fd-dur-4) var(--fd-ease-in-out),opacity var(--fd-dur-4) var(--fd-ease-in-out);
}
.fd-ht[data-on] .fd-ht-sheen{transform:translate3d(30%,-60%,0) rotate(-51deg);opacity:0;animation:fd-ht-sheen var(--fd-dur-4) var(--fd-ease-in-out)}
@keyframes fd-ht-sheen{0%,100%{opacity:0}20%,70%{opacity:1}}

/* 3 · strips */
.fd-ht-strips{position:absolute;inset:0;z-index:3;display:grid;grid-template-columns:repeat(5,1fr);pointer-events:none}
.fd-ht-strip{
  display:block;margin:0 -1px 0 0;height:100%;background:var(--fd-ht-accent);
  transform:translate3d(0,101%,0);
  transition:transform var(--fd-dur-4) var(--fd-ease-in-out) calc(var(--i) * 45ms);
}
.fd-ht[data-on] .fd-ht-strip{transform:translate3d(0,-101%,0)}
.fd-ht[data-fx="strips"] .fd-ht-reveal{opacity:0;transition:opacity 1ms linear 380ms}
.fd-ht[data-fx="strips"][data-on] .fd-ht-reveal{opacity:1}

/* 4 · pixels */
.fd-ht-pix{position:absolute;inset:0;z-index:3;display:grid;grid-template-columns:repeat(${PIX_COLS},1fr);grid-template-rows:repeat(${PIX_ROWS},1fr);pointer-events:none}
.fd-ht-tile{display:block;margin:0 -1px -1px 0;background:var(--fd-ht-ink);opacity:0}
.fd-ht-tile:nth-child(3n){background:var(--fd-ht-accent)}
.fd-ht-tile:nth-child(5n+1){background:color-mix(in srgb,var(--fd-ht-accent) 45%,var(--fd-ht-ink))}
.fd-ht-tile:nth-child(7n+2){background:color-mix(in srgb,var(--fd-ht-accent) 70%,#fff)}
/* each tile: on at its delay, all covered at 230ms (swap), off ~240ms later */
.fd-ht[data-touched] .fd-ht-tile{animation:fd-ht-pix-b 480ms linear var(--d) both}
.fd-ht[data-touched][data-on] .fd-ht-tile{animation-name:fd-ht-pix-a}
@keyframes fd-ht-pix-a{0%{opacity:0}1%,50%{opacity:1}51%,100%{opacity:0}}
@keyframes fd-ht-pix-b{0%{opacity:0}1%,50%{opacity:1}51%,100%{opacity:0}}
.fd-ht[data-fx="pixels"] .fd-ht-reveal{opacity:0;transition:opacity 1ms linear 230ms}
.fd-ht[data-fx="pixels"][data-on] .fd-ht-reveal{opacity:1}

/* 5 · iris */
.fd-ht[data-fx="iris"] .fd-ht-reveal{
  clip-path:circle(0px at var(--fd-ht-x) var(--fd-ht-y));
  transition:clip-path var(--fd-dur-4) var(--fd-ease-in-out);
}
.fd-ht[data-fx="iris"][data-on] .fd-ht-reveal{clip-path:circle(120% at var(--fd-ht-x) var(--fd-ht-y))}
.fd-ht[data-fx="iris"]:not([data-on]) .fd-ht-reveal{transition-timing-function:var(--fd-ease-in-out);transition-duration:var(--fd-dur-3)}
.fd-ht-ring{
  position:absolute;left:var(--fd-ht-x);top:var(--fd-ht-y);width:40px;height:40px;margin:-20px 0 0 -20px;z-index:2;
  border-radius:50%;border:1.5px solid rgba(255,255,255,.85);pointer-events:none;
  transform:scale(0);opacity:0;
}
.fd-ht[data-on] .fd-ht-ring{animation:fd-ht-ring var(--fd-dur-4) var(--fd-ease-out) both}
@keyframes fd-ht-ring{0%{transform:scale(0);opacity:1}100%{transform:scale(14);opacity:0}}

/* 6 · slices */
.fd-ht-slice{position:absolute;left:0;width:100%;height:33.4%;overflow:hidden;z-index:1;background:var(--fd-ht-accent);transform:translate3d(-101%,0,0);
  transition:transform var(--fd-dur-3) var(--fd-ease-in-out)}
.fd-ht-slice[data-i="0"]{top:0}
.fd-ht-slice[data-i="1"]{top:33.3%;transform:translate3d(101%,0,0);transition-delay:60ms}
.fd-ht-slice[data-i="2"]{top:66.6%;transition-delay:120ms}
.fd-ht-slice-art{position:absolute;left:0;top:0;width:100%;height:300%}
.fd-ht-slice[data-i="1"] .fd-ht-slice-art{top:-100%}
.fd-ht-slice[data-i="2"] .fd-ht-slice-art{top:-200%}
.fd-ht-slice-art{transform:translate3d(-14%,0,0);transition:transform var(--fd-dur-4) var(--fd-ease-out)}
.fd-ht-slice[data-i="1"] .fd-ht-slice-art{transform:translate3d(14%,0,0)}
.fd-ht[data-on] .fd-ht-slice,.fd-ht[data-on] .fd-ht-slice .fd-ht-slice-art{transform:none}

/* 7 · focus */
.fd-ht[data-fx="focus"] .fd-ht-base{filter:grayscale(.6) blur(10px) brightness(.8);transform:scale(1.12)}
.fd-ht[data-fx="focus"] .fd-ht-reveal{opacity:0;transform:scale(1.08);
  transition:opacity var(--fd-dur-3) var(--fd-ease-out),transform var(--fd-dur-4) var(--fd-ease-out)}
.fd-ht[data-fx="focus"][data-on] .fd-ht-reveal{opacity:1;transform:none}
.fd-ht[data-fx="focus"] .fd-ht-info{
  top:auto;padding:16px 18px 18px;background:rgba(247,247,249,.94);color:#0B0B0F;
  border-radius:0;transform:translate3d(0,100%,0);opacity:1;
  -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);
}
.fd-ht[data-fx="focus"] .fd-ht-info *{color:#0B0B0F}
.fd-ht[data-fx="focus"][data-on] .fd-ht-info{transform:none;transition-delay:80ms}

/* 8 · liquid */
.fd-ht-drop{
  position:absolute;left:var(--fd-ht-x);top:var(--fd-ht-y);width:170px;height:170px;margin:-85px 0 0 -85px;z-index:2;
  border-radius:50%;pointer-events:none;opacity:0;transform:scale(.4);
  background:radial-gradient(circle at 34% 30%,rgba(255,255,255,.55) 0,rgba(255,255,255,0) 22%),
    radial-gradient(circle at 50% 50%,rgba(255,255,255,0) 58%,rgba(255,255,255,.18) 70%,rgba(255,255,255,0) 74%);
  transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring);
}
.fd-ht[data-on] .fd-ht-drop{opacity:1;transform:none}
.fd-ht[data-fx="liquid"] .fd-ht-reveal{opacity:0;transition:opacity var(--fd-dur-3) var(--fd-ease-out)}
.fd-ht[data-fx="liquid"][data-on] .fd-ht-reveal{opacity:1}

@media (prefers-reduced-motion: reduce){
  .fd-ht *,.fd-ht *::before{animation:none !important;transition-duration:120ms !important;transition-delay:0ms !important}
  .fd-ht-strips,.fd-ht-pix,.fd-ht-ring,.fd-ht-sheen{display:none}
  .fd-ht-blob{-webkit-mask-image:none;mask-image:none}
  .fd-ht-blob-lead{display:none}
  .fd-ht .fd-ht-reveal{clip-path:none !important;transform:none !important;opacity:0;transition:opacity 120ms linear}
  .fd-ht[data-on] .fd-ht-reveal{opacity:1}
  .fd-ht-slice,.fd-ht-slice-art{transform:none !important;opacity:0;transition:opacity 120ms linear}
  .fd-ht[data-on] .fd-ht-slice{opacity:1}
  .fd-ht[data-on] .fd-ht-slice-art{opacity:1}
}
@media (prefers-contrast: more){.fd-ht-media{box-shadow:0 0 0 1px #F5F5F7 inset}}
`;

/* ------------------------------------------------------------------ Demo */

const LOOK: Record<string, string> = { p1: "a woman with a gray bob", p2: "a bearded man with dark hair", p3: "a woman with braided hair", p4: "a man with short curly hair", p5: "a smiling man with a short beard", p6: "a woman with long wavy dark hair", p7: "a bearded man in round glasses", p8: "a smiling man with swept-back hair" };

function Portrait({ photo, bg, name, role }: { photo: string; bg: [string, string]; name: string; role: string }) {
  return (
    <div className="fd-ht-demo-photo" style={{ background: `linear-gradient(165deg, ${bg[0]}, ${bg[1]})` }}>
      <img src={`/img/people/${photo}.webp`} width={328} height={328} alt={`${name}, ${role.toLowerCase()}: portrait of ${LOOK[photo] ?? "a person"} in a black sweater`} loading="lazy" decoding="async" />
    </div>
  );
}

const TEAM: {
  name: string;
  role: string;
  effect: HoverEffect;
  label: string;
  accent: string;
  bio: string;
  focus: string;
  photo: string;
  bg: [string, string];
}[] = [
  {
    name: "Amara Okafor",
    role: "Founder & CEO",
    effect: "blob",
    label: "Morph blob",
    accent: "#FF6B3D",
    bio: "Ex-DeepMind product. Started Northlight to put agents into regulated industries.",
    focus: "London",
    photo: "p1", bg: ["#FFB48A", "#B2462A"],
  },
  {
    name: "Jonas Weber",
    role: "Head of Research",
    effect: "diagonal",
    label: "Diagonal wipe",
    accent: "#4C7DFF",
    bio: "Retrieval and long-context reasoning. 31 papers, 2 that actually shipped.",
    focus: "Berlin",
    photo: "p2", bg: ["#A7C0FF", "#2C3F8F"],
  },
  {
    name: "Mei Lin Zhao",
    role: "Principal ML Engineer",
    effect: "strips",
    label: "Vertical strips",
    accent: "#2FBF8F",
    bio: "Builds the eval harness every model has to pass before it reaches a client.",
    focus: "Singapore",
    photo: "p3", bg: ["#9EE6C9", "#1E6E55"],
  },
  {
    name: "Sofia Marquez",
    role: "Design Director",
    effect: "pixels",
    label: "Pixel dissolve",
    accent: "#F2B33D",
    bio: "Designs interfaces for systems that think out loud. Previously at a Lisbon type foundry.",
    focus: "Lisbon",
    photo: "p4", bg: ["#FFD98A", "#B07A1E"],
  },
  {
    name: "Kwame Mensah",
    role: "Applied AI Lead",
    effect: "iris",
    label: "Circle iris",
    accent: "#B07BFF",
    bio: "Turns prototypes into agents that file claims, reconcile ledgers and don’t hallucinate.",
    focus: "Accra",
    photo: "p5", bg: ["#D2B6FF", "#5B3AA8"],
  },
  {
    name: "Elin Lindqvist",
    role: "Product Lead",
    effect: "slices",
    label: "Slice shift",
    accent: "#FF5C8A",
    bio: "Owns the agent console. Believes every AI feature needs an undo button.",
    focus: "Stockholm",
    photo: "p6", bg: ["#FFB3C8", "#A8325A"],
  },
  {
    name: "Ravi Sharma",
    role: "Infrastructure",
    effect: "focus",
    label: "Blur to sharp",
    accent: "#3DB8F5",
    bio: "Runs 1.2B tokens a day across three clouds at a 99.98% success rate.",
    focus: "Bengaluru",
    photo: "p7", bg: ["#9FDBFA", "#1F6E96"],
  },
  {
    name: "Noor Haddad",
    role: "Evaluation & Safety",
    effect: "liquid",
    label: "Liquid bulge",
    accent: "#7FD45A",
    bio: "Red-teams every release. Wrote the playbook our clients’ auditors now ask for.",
    focus: "Amman",
    photo: "p8", bg: ["#C6EFA8", "#3F7A2A"],
  },
];

export function Demo() {
  return (
    <div className="fd-ht-demo">
      <style>{demoCss}</style>
      <header className="fd-ht-demo-head">
        <p className="fd-ht-demo-eyebrow">Northlight Labs — Team</p>
        <h2 className="fd-ht-demo-h">Eight people. Every agent we ship.</h2>
        <p className="fd-ht-demo-sub">Hover or tap a portrait — every card uses a different transition.</p>
      </header>
      <div className="fd-ht-demo-grid">
        {TEAM.map((m, i) => (
          <HoverRevealCard
            key={m.name}
            effect={m.effect}
            accent={m.accent}
            name={m.name}
            role={m.role}
            caption={`${String(i + 1).padStart(2, "0")} · ${m.label}`}
            media={<Portrait photo={m.photo} bg={m.bg} name={m.name} role={m.role} />}
            info={
              <>
                <span className="fd-ht-demo-loc">{m.focus}</span>
                <span className="fd-ht-demo-bio">{m.bio}</span>
              </>
            }
          />
        ))}
      </div>
    </div>
  );
}

const demoCss = `
.fd-ht-demo{display:block;margin:0;padding:clamp(40px,6vw,72px) clamp(16px,4vw,56px) 72px;background:#0B0B0F;color:#F5F5F7;min-height:100vh}
.fd-ht-demo,.fd-ht-demo *{box-sizing:border-box}
.fd-ht-demo-head{max-width:1200px;margin:0 auto 36px;padding:0}
.fd-ht-demo-eyebrow{margin:0 0 12px;padding:0;color:rgba(245,245,247,.5);font:500 0.75rem/1.2 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.06em;text-transform:uppercase}
.fd-ht-demo-h{margin:0;padding:0;color:#F5F5F7;font:650 clamp(2rem,4.4vw,2.75rem)/1.04 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter","Segoe UI",sans-serif;letter-spacing:-0.03em}
.fd-ht-demo-sub{margin:12px 0 0;padding:0;color:rgba(245,245,247,.6);font:400 1.0625rem/1.45 ui-sans-serif,-apple-system,"Inter","Segoe UI",sans-serif}
.fd-ht-demo-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:36px 20px;max-width:1200px;margin:0 auto;padding:0}
@media (max-width:900px){.fd-ht-demo-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 12px}}
.fd-ht-demo-photo{display:block;width:100%;height:100%;margin:0;padding:0}
.fd-ht-demo-photo img{display:block;width:100%;height:100%;max-width:none;margin:0;padding:0;object-fit:cover;object-position:center top;mix-blend-mode:multiply}
.fd-ht-demo-loc{display:block;margin:0 0 4px;font:500 0.6875rem/1.2 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;opacity:.7}
.fd-ht-demo-bio{display:block;margin:0;font:400 0.8125rem/1.45 ui-sans-serif,-apple-system,"Inter","Segoe UI",sans-serif}
@media (max-width:600px){.fd-ht-demo .fd-ht-cap{display:none}.fd-ht-demo .fd-ht-info{padding:36px 12px 12px}.fd-ht-demo-bio{font-size:0.75rem}}
`;
