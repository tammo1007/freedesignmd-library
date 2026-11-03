/**
 * HeroProductStage: a fragrance launch on a dark stage. The bottle stands on
 * its pedestal under a spotlight that follows the pointer (a CSS radial mask
 * over the photograph), a giant backdrop name rolls in per edition, specs
 * tick to their new values and a swatch picker swaps the edition, photo,
 * notes and ambient light.
 *
 * Props: house, editions (id, name, family, swatch, tint, src, notes, conc,
 * sillage, volume, price, batch), defaultEdition, onReserve.
 * CSS vars: --fd-pst-stage, --fd-pst-ink, --fd-pst-tint (per edition).
 *
 * Browser support: all evergreen browsers (mask-image, unprefixed and
 * -webkit-). Pointer Events; on touch the light follows your finger.
 * Motion: spotlight eased by a spring (k 380, c 30) in rAF, paused off-screen
 * and in hidden tabs; numbers tick over 700ms. prefers-reduced-motion keeps
 * the spotlight centred and swaps values instantly.
 * Accessibility: the edition picker is a radiogroup with roving tabindex
 * (arrow keys, Home, End). Spec changes are announced politely.
 */
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export interface StageEdition {
  id: string;
  name: string;
  family: string;
  swatch: string;
  tint: string;
  src: string;
  alt: string;
  notes: { top: string; heart: string; base: string };
  conc: number;
  sillage: number;
  volume: number;
  price: number;
  batch: string;
}

export interface HeroProductStageProps {
  house?: string;
  editions?: StageEdition[];
  defaultEdition?: string;
  currency?: string;
  onReserve?: (edition: StageEdition) => void;
}

const EDITIONS: StageEdition[] = [
  {
    id: "noir", name: "Noir 01", family: "Leather, smoke", swatch: "#B7782C", tint: "#C98A3A",
    src: "/img/lux/perfume-noir.webp", alt: "Amber glass bottle of Vérane Noir 01 on a dark stone plinth",
    notes: { top: "Black tea, bergamot", heart: "Birch tar, iris", base: "Labdanum, suede" },
    conc: 22, sillage: 9, volume: 50, price: 210, batch: "Batch 0412, Grasse, bottled 03.10.2026",
  },
  {
    id: "dusk", name: "Dusk", family: "Rose, cassis", swatch: "#D45A9C", tint: "#C2508E",
    src: "/img/lux/perfume-dusk.webp", alt: "Pink glass bottle of Vérane Dusk on a white plinth",
    notes: { top: "Cassis, pink pepper", heart: "Damask rose, violet leaf", base: "Musk, cashmeran" },
    conc: 18, sillage: 7, volume: 50, price: 185, batch: "Batch 0398, Grasse, bottled 12.09.2026",
  },
  {
    id: "vert", name: "Vert", family: "Fig leaf, vetiver", swatch: "#4FAF84", tint: "#3E9B73",
    src: "/img/lux/perfume-green.webp", alt: "Mint green glass bottle of Vérane Vert on a white plinth",
    notes: { top: "Fig leaf, tomato vine", heart: "Galbanum, mint", base: "Haitian vetiver" },
    conc: 16, sillage: 6, volume: 50, price: 175, batch: "Batch 0401, Grasse, bottled 19.09.2026",
  },
  {
    id: "nord", name: "Nord", family: "Salt, juniper", swatch: "#6C92D8", tint: "#5B7FC4",
    src: "/img/lux/perfume-north.webp", alt: "Pale blue glass bottle of Vérane Nord on a white plinth",
    notes: { top: "Sea salt, juniper", heart: "Ambrette, sage", base: "Driftwood, ambroxan" },
    conc: 15, sillage: 5, volume: 50, price: 175, batch: "Batch 0405, Grasse, bottled 26.09.2026",
  },
  {
    id: "peche", name: "Pêche", family: "Peach, osmanthus", swatch: "#E2964F", tint: "#D9873F",
    src: "/img/lux/perfume-peach.webp", alt: "Peach glass bottle of Vérane Pêche on a white plinth",
    notes: { top: "White peach, neroli", heart: "Osmanthus, apricot skin", base: "Sandalwood, benzoin" },
    conc: 20, sillage: 8, volume: 50, price: 195, batch: "Batch 0409, Grasse, bottled 01.10.2026",
  },
];

function useTicker(value: number, reduce: boolean) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const e = 1 - Math.pow(1 - t, 3);
      const v = a + (value - a) * e;
      setShown(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return Math.round(shown);
}

export function HeroProductStage({
  house = "Vérane",
  editions = EDITIONS,
  defaultEdition = "noir",
  currency = "€",
  onReserve,
}: HeroProductStageProps) {
  const [activeId, setActiveId] = useState(defaultEdition);
  const [reduce, setReduce] = useState(false);
  const [reserved, setReserved] = useState<string | null>(null);
  const idx = Math.max(0, editions.findIndex((e) => e.id === activeId));
  const ed = editions[idx];
  const stageRef = useRef<HTMLDivElement>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  const conc = useTicker(ed.conc, reduce);
  const sillage = useTicker(ed.sillage, reduce);
  const price = useTicker(ed.price, reduce);

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // pointer-driven spotlight with a spring
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let tx = 50, ty = 46, x = 50, y = 46, vx = 0, vy = 0;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let settled = true;
    const onMove = (e: PointerEvent) => {
      const photo = el.querySelector(".fd-pst-photo") as HTMLElement | null;
      const r = (photo ?? el).getBoundingClientRect();
      tx = Math.min(105, Math.max(-5, ((e.clientX - r.left) / r.width) * 100));
      ty = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
      kick();
    };
    const onLeave = () => {
      tx = 50; ty = 46;
      kick();
    };
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      vx += (380 * (tx - x) - 30 * vx) * dt;
      vy += (380 * (ty - y) - 30 * vy) * dt;
      x += vx * dt;
      y += vy * dt;
      el.style.setProperty("--fd-pst-x", `${x.toFixed(2)}%`);
      el.style.setProperty("--fd-pst-y", `${y.toFixed(2)}%`);
      settled = Math.abs(tx - x) < 0.05 && Math.abs(ty - y) < 0.05 && Math.abs(vx) + Math.abs(vy) < 0.05;
      if (!settled && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !settled) kick();
    });
    io.observe(el);
    const section = el.closest(".fd-pst") as HTMLElement | null;
    const target = section ?? el;
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerdown", onMove);
    target.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerdown", onMove);
      target.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const select = (i: number, focus = false) => {
    const n = (i + editions.length) % editions.length;
    setActiveId(editions[n].id);
    setReserved(null);
    if (focus) radios.current[n]?.focus();
  };

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); select(idx + 1, true); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); select(idx - 1, true); }
    else if (e.key === "Home") { e.preventDefault(); select(0, true); }
    else if (e.key === "End") { e.preventDefault(); select(editions.length - 1, true); }
  };

  return (
    <section
      className="fd-pst"
      style={{ ["--fd-pst-tint" as string]: ed.tint }}
      aria-label={`${house} ${ed.name}`}
    >
      <style>{css}</style>
      <header className="fd-pst-nav">
        <a className="fd-pst-logo" href="#top">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M12 2.5 L21 21.5 H3 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M12 9 V21.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <span>{house}</span>
        </a>
        <p className="fd-pst-season">Collection Ombre, Paris, Hiver 2026</p>
        <a className="fd-pst-bag" href="#bag">Bag <span>{reserved ? 1 : 0}</span></a>
      </header>

      <div className="fd-pst-grid">
        <div className="fd-pst-intro">
          <p className="fd-pst-eyebrow">Eau de parfum, {String(idx + 1).padStart(2, "0")} of {String(editions.length).padStart(2, "0")}</p>
          <h1 className="fd-pst-name">
            <span className="fd-pst-house">{house}</span>
            <span key={ed.id} className="fd-pst-roll">{ed.name}</span>
          </h1>
          <p className="fd-pst-family">{ed.family}</p>
          <dl className="fd-pst-notes">
            <div className="fd-pst-note"><dt>Top</dt><dd key={ed.id + "t"}>{ed.notes.top}</dd></div>
            <div className="fd-pst-note"><dt>Heart</dt><dd key={ed.id + "h"}>{ed.notes.heart}</dd></div>
            <div className="fd-pst-note"><dt>Base</dt><dd key={ed.id + "b"}>{ed.notes.base}</dd></div>
          </dl>
        </div>

        <div ref={stageRef} className="fd-pst-stage">
          <p className="fd-pst-backdrop" aria-hidden="true">
            <span key={ed.id}>{ed.name.split(" ")[0]}</span>
          </p>
          <div className="fd-pst-beam" aria-hidden="true" />
          <div className="fd-pst-photo">
            {editions.map((e, i) => (
              <img
                key={e.id}
                className={`fd-pst-img${i === idx ? " is-on" : ""}`}
                src={e.src}
                alt={i === idx ? e.alt : ""}
                aria-hidden={i === idx ? undefined : true}
                width={1200}
                height={1500}
                loading={i === 0 ? "eager" : "lazy"}
              />
            ))}
          </div>
          <div className="fd-pst-floor" aria-hidden="true" />
          <p className="fd-pst-batch">{ed.batch}</p>
        </div>

        <div className="fd-pst-side">
          <div className="fd-pst-picker">
            <p className="fd-pst-label" id="fd-pst-ed-label">Edition</p>
            <div className="fd-pst-swatches" role="radiogroup" aria-labelledby="fd-pst-ed-label" onKeyDown={onKey}>
              {editions.map((e, i) => (
                <button
                  key={e.id}
                  ref={(el) => {
                    radios.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={i === idx}
                  tabIndex={i === idx ? 0 : -1}
                  className="fd-pst-sw"
                  style={{ ["--fd-pst-sw" as string]: e.swatch }}
                  onClick={() => select(i)}
                >
                  <span className="fd-pst-dot" aria-hidden="true" />
                  <span className="fd-pst-sw-name">{e.name}</span>
                </button>
              ))}
            </div>
          </div>

          <dl className="fd-pst-specs" aria-live="polite">
            <div className="fd-pst-spec"><dt>Concentration</dt><dd><b>{conc}</b>%</dd></div>
            <div className="fd-pst-spec"><dt>Sillage</dt><dd><b>{sillage}</b> h</dd></div>
            <div className="fd-pst-spec"><dt>Volume</dt><dd><b>{ed.volume}</b> ml</dd></div>
          </dl>

          <div className="fd-pst-buy">
            <p className="fd-pst-price"><span>{currency}</span>{price}</p>
            <button
              type="button"
              className={`fd-pst-cta${reserved === ed.id ? " is-done" : ""}`}
              onClick={() => {
                setReserved(ed.id);
                onReserve?.(ed);
              }}
            >
              {reserved === ed.id ? "Reserved, ships 14 Nov" : `Reserve ${ed.name}`}
            </button>
            <p className="fd-pst-fine">Free 2 ml sample of every edition with your order. Engraving included.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const css = `
.fd-pst, .fd-pst *, .fd-pst *::before, .fd-pst *::after { box-sizing: border-box; }
.fd-pst :where(h1, p, a, dl, dt, dd, div, span, b, nav, header, button, img, svg) {
  margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit;
  letter-spacing: inherit; text-decoration: none;
}
.fd-pst {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-pst-stage: #0C0A08;
  --fd-pst-ink: #EFE7DA;
  --fd-pst-dim: rgba(239,231,218,0.58);
  --fd-pst-line: rgba(239,231,218,0.16);
  --fd-pst-tint: #C98A3A;
  --fd-pst-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --fd-pst-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  --fd-pst-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
  position: relative; display: flex; flex-direction: column; min-height: 880px; margin: 0; padding: 0 40px 32px;
  overflow: hidden; isolation: isolate; touch-action: pan-y;
  background:
    radial-gradient(70% 55% at 50% 100%, color-mix(in srgb, var(--fd-pst-tint) 16%, transparent) 0%, transparent 70%),
    var(--fd-pst-stage);
  color: var(--fd-pst-ink); font: 400 15px/1.45 var(--fd-pst-sans);
  transition: background var(--fd-dur-4) var(--fd-ease-in-out);
}

.fd-pst-nav { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 24px 0; border-bottom: 1px solid var(--fd-pst-line); position: relative; z-index: 3; }
.fd-pst-logo { display: inline-flex; align-items: center; gap: 10px; color: var(--fd-pst-ink); }
.fd-pst-logo svg { display: block; }
.fd-pst-logo span { font: 400 20px/1 var(--fd-pst-serif); letter-spacing: 0.32em; text-transform: uppercase; }
.fd-pst-season { font: 400 11px/1 var(--fd-pst-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--fd-pst-dim); }
.fd-pst-bag { justify-self: end; display: inline-flex; align-items: center; gap: 8px; font: 400 14px/1 var(--fd-pst-sans); color: var(--fd-pst-ink); }
.fd-pst-bag span { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 9999px; border: 1px solid var(--fd-pst-line); font: 500 11px/1 var(--fd-pst-mono); }

.fd-pst-grid { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) minmax(0, 1fr); gap: 32px; align-items: stretch; padding-top: 28px; }

/* intro */
.fd-pst-intro { display: flex; flex-direction: column; justify-content: flex-end; position: relative; z-index: 2; padding-bottom: 8px; }
.fd-pst-eyebrow { font: 400 11px/1 var(--fd-pst-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--fd-pst-dim); margin-bottom: 18px; }
.fd-pst-name { display: flex; flex-direction: column; font: 400 clamp(3rem, 5.4vw, 5.5rem)/0.92 var(--fd-pst-serif); letter-spacing: -0.03em; color: var(--fd-pst-ink); }
.fd-pst-house { font: italic 400 0.42em/1.1 var(--fd-pst-serif); letter-spacing: 0; color: var(--fd-pst-dim); }
.fd-pst-roll { display: block; animation: fd-pst-roll var(--fd-dur-4) var(--fd-ease-out) both; }
@keyframes fd-pst-roll { from { opacity: 0; transform: translateY(0.35em); clip-path: inset(0 0 100% 0); } to { opacity: 1; transform: none; clip-path: inset(0 0 -10% 0); } }
.fd-pst-family { margin-top: 14px; font: 400 17px/1.3 var(--fd-pst-sans); color: var(--fd-pst-tint); transition: color var(--fd-dur-3); filter: brightness(1.25); }
.fd-pst-notes { margin-top: 32px; border-top: 1px solid var(--fd-pst-line); }
.fd-pst-note { display: grid; grid-template-columns: 64px 1fr; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--fd-pst-line); }
.fd-pst-note dt { font: 400 11px/1.6 var(--fd-pst-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--fd-pst-dim); }
.fd-pst-note dd { font: 400 15px/1.4 var(--fd-pst-serif); animation: fd-pst-fade var(--fd-dur-3) var(--fd-ease-out) both; }
.fd-pst-note:nth-child(2) dd { animation-delay: 60ms; }
.fd-pst-note:nth-child(3) dd { animation-delay: 120ms; }
@keyframes fd-pst-fade { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }

/* stage */
.fd-pst-stage { --fd-pst-x: 50%; --fd-pst-y: 46%; position: relative; display: flex; align-items: center; justify-content: center; min-height: 600px; }
.fd-pst-backdrop {
  position: absolute; left: 50%; top: 8%; transform: translateX(-50%); z-index: 0; white-space: nowrap; pointer-events: none;
  font: italic 400 clamp(8rem, 19vw, 18rem)/0.8 var(--fd-pst-serif); letter-spacing: -0.04em;
  color: transparent; -webkit-text-stroke: 1px rgba(239,231,218,0.16);
}
.fd-pst-backdrop span { display: block; animation: fd-pst-back var(--fd-dur-4) var(--fd-ease-out) both; }
@keyframes fd-pst-back { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
.fd-pst-beam {
  position: absolute; top: -40px; bottom: 6%; left: 0; right: 0; z-index: 0; pointer-events: none;
  background: linear-gradient(180deg, color-mix(in srgb, var(--fd-pst-tint) 22%, transparent), transparent 85%);
  clip-path: polygon(calc(var(--fd-pst-x) - 5%) 0, calc(var(--fd-pst-x) + 5%) 0, 92% 100%, 8% 100%);
  opacity: 0.55; mix-blend-mode: screen;
}
.fd-pst-photo {
  position: relative; z-index: 1; width: min(100%, 470px); aspect-ratio: 4 / 5;
  --fd-pst-vig: radial-gradient(ellipse 50% 50% at 50% 50%, #000 52%, rgba(0,0,0,0.5) 78%, transparent 100%);
  --fd-pst-spot: radial-gradient(circle 250px at var(--fd-pst-x) var(--fd-pst-y), #000 0%, #000 34%, rgba(0,0,0,0.45) 68%, rgba(0,0,0,0.16) 100%);
  -webkit-mask-image: var(--fd-pst-spot), var(--fd-pst-vig);
  -webkit-mask-composite: source-in;
  mask-image: var(--fd-pst-spot), var(--fd-pst-vig);
  mask-composite: intersect;
}
.fd-pst-img {
  position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover;
  opacity: 0; transform: scale(1.04); filter: blur(6px);
  transition: opacity var(--fd-dur-4) var(--fd-ease-in-out), transform var(--fd-dur-4) var(--fd-ease-out), filter var(--fd-dur-4) var(--fd-ease-out);
}
.fd-pst-img.is-on { opacity: 1; transform: none; filter: none; }
.fd-pst-floor {
  position: absolute; left: 10%; right: 10%; bottom: 7%; height: 70px; z-index: 0;
  background: radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--fd-pst-tint) 38%, transparent), transparent 70%);
  filter: blur(8px);
}
.fd-pst-batch { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; font: 400 11px/1 var(--fd-pst-mono); letter-spacing: 0.08em; color: var(--fd-pst-dim); z-index: 2; }

/* side */
.fd-pst-side { display: flex; flex-direction: column; justify-content: flex-end; gap: 28px; padding-bottom: 8px; position: relative; z-index: 2; }
.fd-pst-label { font: 400 11px/1 var(--fd-pst-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--fd-pst-dim); margin-bottom: 12px; }
.fd-pst-swatches { display: flex; flex-direction: column; border-top: 1px solid var(--fd-pst-line); }
.fd-pst-sw {
  appearance: none; cursor: pointer; display: flex; align-items: center; gap: 14px; width: 100%; padding: 11px 0; text-align: left;
  border: 0; border-bottom: 1px solid var(--fd-pst-line); background: none; color: var(--fd-pst-dim);
  font: 400 15px/1.2 var(--fd-pst-sans); transition: color var(--fd-dur-1), padding var(--fd-dur-2) var(--fd-ease-out);
}
.fd-pst-sw:hover { color: var(--fd-pst-ink); padding-left: 4px; }
.fd-pst-sw[aria-checked="true"] { color: var(--fd-pst-ink); }
.fd-pst-dot {
  position: relative; display: block; flex: none; width: 18px; height: 18px; border-radius: 50%; background: var(--fd-pst-sw);
  box-shadow: inset 0 -3px 6px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.35);
  transition: transform var(--fd-dur-2) var(--fd-spring);
}
.fd-pst-dot::after { content: ""; position: absolute; inset: -5px; border-radius: 50%; border: 1px solid var(--fd-pst-ink); opacity: 0; transform: scale(0.7); transition: opacity var(--fd-dur-2), transform var(--fd-dur-2) var(--fd-spring); }
.fd-pst-sw[aria-checked="true"] .fd-pst-dot::after { opacity: 1; transform: none; }
.fd-pst-sw:active .fd-pst-dot { transform: scale(0.86); transition-duration: var(--fd-dur-1); }
.fd-pst-sw-name { flex: 1; }
.fd-pst-specs { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--fd-pst-line); border-bottom: 1px solid var(--fd-pst-line); }
.fd-pst-spec { padding: 12px 0; }
.fd-pst-spec + .fd-pst-spec { padding-left: 14px; border-left: 1px solid var(--fd-pst-line); }
.fd-pst-spec dt { font: 400 10px/1.2 var(--fd-pst-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--fd-pst-dim); margin-bottom: 8px; }
.fd-pst-spec dd { font: 400 15px/1 var(--fd-pst-mono); color: var(--fd-pst-dim); }
.fd-pst-spec b { font: 400 28px/1 var(--fd-pst-serif); color: var(--fd-pst-ink); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.fd-pst-buy { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 12px 18px; }
.fd-pst-price { font: 400 40px/1 var(--fd-pst-serif); letter-spacing: -0.025em; font-variant-numeric: tabular-nums; }
.fd-pst-price span { font-size: 0.55em; vertical-align: 0.6em; margin-right: 2px; color: var(--fd-pst-dim); }
.fd-pst-cta {
  appearance: none; cursor: pointer; height: 52px; padding: 0 22px; border-radius: 9999px; border: 0;
  background: var(--fd-pst-ink); color: #14110D; font: 600 15px/1 var(--fd-pst-sans); white-space: nowrap;
  transition: background var(--fd-dur-2), color var(--fd-dur-2), transform var(--fd-dur-2) var(--fd-spring);
}
.fd-pst-cta:hover { background: #FFFFFF; }
.fd-pst-cta:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-pst-cta.is-done { background: transparent; color: var(--fd-pst-ink); box-shadow: inset 0 0 0 1px var(--fd-pst-ink); }
.fd-pst-fine { grid-column: 1 / -1; font: 400 12px/1.45 var(--fd-pst-sans); color: var(--fd-pst-dim); }
.fd-pst :focus-visible { outline: 2px solid var(--fd-pst-ink); outline-offset: 3px; border-radius: 4px; }

@media (max-width: 1080px) {
  .fd-pst-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .fd-pst-intro { grid-column: 1; grid-row: 1; }
  .fd-pst-stage { grid-column: 2; grid-row: 1 / 3; }
  .fd-pst-side { grid-column: 1; grid-row: 2; }
}
@media (max-width: 760px) {
  .fd-pst { padding: 0 16px 24px; min-height: 0; }
  .fd-pst-nav { grid-template-columns: 1fr auto; padding: 18px 0; }
  .fd-pst-season { display: none; }
  .fd-pst-grid { grid-template-columns: minmax(0, 1fr); gap: 0; padding-top: 22px; }
  .fd-pst-intro, .fd-pst-stage, .fd-pst-side { grid-column: 1; grid-row: auto; }
  .fd-pst-notes { display: none; }
  .fd-pst-name { flex-direction: row; align-items: baseline; gap: 12px; font-size: 3rem; }
  .fd-pst-house { font-size: 0.5em; }
  .fd-pst-stage { min-height: 0; padding: 4px 0 30px; margin-bottom: 18px; }
  .fd-pst-photo { width: min(82%, 340px); }
  .fd-pst-backdrop { top: 10%; font-size: 9rem; }
  .fd-pst-side { gap: 20px; }
  .fd-pst-swatches { flex-direction: row; gap: 0; justify-content: space-between; border: 0; }
  .fd-pst-sw { flex-direction: column; gap: 8px; width: auto; flex: 1; padding: 10px 0; border: 0; font-size: 12px; text-align: center; }
  .fd-pst-sw:hover { padding-left: 0; }
  .fd-pst-dot { width: 26px; height: 26px; }
  .fd-pst-buy { grid-template-columns: auto 1fr; }
  .fd-pst-cta { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-pst, .fd-pst-img, .fd-pst-sw, .fd-pst-dot, .fd-pst-dot::after, .fd-pst-cta, .fd-pst-family { transition: none; }
  .fd-pst-roll, .fd-pst-note dd, .fd-pst-backdrop span { animation: none; }
  .fd-pst-img { filter: none; transform: none; }
}
@media (prefers-contrast: more) {
  .fd-pst { --fd-pst-dim: rgba(239,231,218,0.85); --fd-pst-line: rgba(239,231,218,0.5); }
}
`;

export function Demo() {
  return <HeroProductStage />;
}
