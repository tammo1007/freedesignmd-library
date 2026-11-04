/**
 * PhotoSleeves, record-sleeve albums with photos peeking out of the top.
 * Hover lifts the photos, a click fans them out above the sleeve.
 *
 * Props: albums[] ({ name, images[] }), photoWidth (px, default 104),
 * onOpen(index | null), aria-label.
 * CSS vars: --fd-ps-radius, --fd-ps-sleeve (sleeve tint).
 *
 * Browser support: all evergreen browsers; the sleeve uses backdrop-filter
 * and falls back to a flat tint without it.
 * Accessibility: every sleeve is a button with aria-expanded; Escape or a
 * click outside closes the open one. Reduced motion: no staggering.
 */
import { useEffect, useRef, useState } from "react";

const TONES = [
  "linear-gradient(160deg,#f3d1b8,#d7959a)",
  "linear-gradient(160deg,#c9d6f2,#8e9fd6)",
  "linear-gradient(160deg,#d3e6cf,#8fb996)",
  "linear-gradient(160deg,#f2e2b6,#d9b36b)",
];

export interface Album {
  name: string;
  images: string[];
}

export interface PhotoSleevesProps {
  albums: Album[];
  photoWidth?: number;
  onOpen?: (index: number | null) => void;
  className?: string;
  "aria-label"?: string;
}

export function PhotoSleeves({
  albums,
  photoWidth = 104,
  onOpen,
  className,
  "aria-label": label = "Photo albums",
}: PhotoSleevesProps) {
  const [open, setOpen] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const photoH = Math.round(photoWidth * 1.32);
  const sleeveH = Math.round(photoH * 0.62);

  const set = (v: number | null) => {
    setOpen(v);
    onOpen?.(v);
  };

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && set(null);
    const onDown = (e: globalThis.PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) set(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div
      ref={root}
      className={`fd-ps${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={label}
      style={{ paddingTop: photoH + 24 }}
    >
      <style>{css}</style>
      {albums.map((album, a) => {
        const isOpen = open === a;
        const n = album.images.length;
        return (
          <div
            key={a}
            className="fd-ps-album"
            data-open={isOpen || undefined}
            data-dim={(open !== null && !isOpen) || undefined}
            style={{ width: photoWidth + 56, height: sleeveH + 14, zIndex: isOpen ? 5 : 1 }}
          >
            {album.images.map((src, i) => {
              const mid = (n - 1) / 2;
              const spread = (i - mid) * (photoWidth * 0.58);
              const tilt = (i - mid) * 7;
              return (
                <span
                  key={i}
                  className="fd-ps-photo"
                  style={
                    {
                      width: photoWidth,
                      height: photoH,
                      "--rest": `${(i % 2 ? 1 : -1) * 2}deg`,
                      "--x": `${spread}px`,
                      "--r": `${tilt}deg`,
                      "--i": i,
                      background: TONES[(a + i) % TONES.length],
                    } as React.CSSProperties
                  }
                >
                  <Img src={src} />
                </span>
              );
            })}
            <button
              type="button"
              className="fd-ps-sleeve"
              aria-expanded={isOpen}
              aria-label={`${album.name}, ${n} photos`}
              onClick={() => set(isOpen ? null : a)}
              style={{ height: sleeveH }}
            >
              <span className="fd-ps-name">{album.name}</span>
              <span className="fd-ps-count">{n}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Img({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return <img className="fd-ps-img" src={src} alt="" draggable={false} loading="lazy" decoding="async" onError={() => setOk(false)} />;
}

const FONT = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
const css = `
.fd-ps,.fd-ps *,.fd-ps *::before,.fd-ps *::after{box-sizing:border-box}
.fd-ps{--fd-ps-radius:18px;--fd-ps-sleeve:rgba(255,255,255,.55);--fd-ease-out:cubic-bezier(0.22,1,0.36,1);display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:center;gap:28px 20px;margin:0;color:#111;font:400 14px/1.4 ${FONT}}
.fd-ps-album{position:relative;display:block;margin:0;padding:0;transition:opacity 300ms,filter 300ms}
.fd-ps-album[data-dim]{opacity:.45;filter:saturate(.7)}
.fd-ps-photo{position:absolute;left:50%;bottom:10px;display:block;margin:0;padding:0;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.1),0 10px 22px -8px rgba(0,0,0,.35);transform-origin:50% 100%;transform:translate3d(-50%,0,0) rotate(var(--rest));transition:transform 560ms var(--fd-ease-out);transition-delay:calc(var(--i) * 28ms)}
.fd-ps-album:hover:not([data-open]) .fd-ps-photo{transform:translate3d(-50%,-26px,0) rotate(calc(var(--rest) * 2))}
.fd-ps-album[data-open] .fd-ps-photo{transform:translate3d(calc(-50% + var(--x)),-70%,0) rotate(var(--r));transition-delay:calc(var(--i) * 40ms)}
.fd-ps-img{position:absolute;inset:0;display:block;width:100%;height:100%;margin:0;padding:0;border:0;object-fit:cover;pointer-events:none}
.fd-ps-sleeve{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin:0;padding:14px 16px;border:1px solid rgba(255,255,255,.7);border-radius:var(--fd-ps-radius);background:var(--fd-ps-sleeve);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);box-shadow:0 1px 1px rgba(255,255,255,.7) inset,0 12px 28px -12px rgba(0,0,0,.28);color:#1d1d1f;font:500 14px/1.2 ${FONT};letter-spacing:normal;text-align:left;cursor:pointer;appearance:none;-webkit-appearance:none;transition:transform 400ms var(--fd-ease-out)}
.fd-ps-sleeve:focus-visible{outline:2px solid #1a73e8;outline-offset:3px}
.fd-ps-album:hover:not([data-open]) .fd-ps-sleeve{transform:translateY(2px)}
.fd-ps-name{display:block;margin:0;padding:0}
.fd-ps-count{display:block;margin:0;padding:0;color:rgba(0,0,0,.45);font:400 13px/1.2 ${FONT};font-variant-numeric:tabular-nums}
@media (prefers-reduced-motion:reduce){.fd-ps-photo,.fd-ps-sleeve{transition:none}}
`;

export function Demo() {
  const a = ["eagle", "butterfly", "giraffe", "iguana"];
  const b = ["meadow", "ridge", "sunset", "balloons"];
  const c = ["eye", "aurora", "butterfly", "giraffe"];
  const url = (n: string) => `/demo/${n}-p.webp`;
  return (
    <div className="fd-psd">
      <style>{demoCss}</style>
      <PhotoSleeves
        albums={[
          { name: "Wildlife", images: a.map(url) },
          { name: "Landscapes", images: b.map(url) },
          { name: "Portraits", images: c.map(url) },
        ]}
      />
    </div>
  );
}

const demoCss = `
.fd-psd,.fd-psd *,.fd-psd *::before,.fd-psd *::after{box-sizing:border-box}
.fd-psd{display:flex;align-items:center;justify-content:center;width:100%;min-height:100vh;margin:0;padding:48px 20px;background:#ececec;font:400 14px/1.4 ${FONT};letter-spacing:normal;overflow:hidden}
`;
