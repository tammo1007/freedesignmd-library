/**
 * MagneticCursorGrid, a grid of tiles that tilt and lift toward a custom
 * cursor. The cursor is a spring-driven follower that morphs: a dot in empty
 * space, a ring near tiles, and a filled "View" label over a tile (or any
 * element with `data-cursor="label text"`).
 *
 * Components:
 * - <CursorStage> provides the follower and tilt behaviour for its subtree.
 *   Props: tilt (deg, default 9), lift (px, default 18), label (default "View").
 * - Tiles are any elements with `data-magnetic`; their inner `[data-depth]`
 *   children move with parallax proportional to the depth value.
 * CSS vars: --fd-mcg-cursor, --fd-mcg-cursor-ink.
 *
 * Browser support: evergreen. Fine-pointer only, on touch the native cursor
 * and plain tiles are used.
 * Accessibility: tiles are links/buttons; keyboard focus lifts a tile the same
 * way hover does. The follower is aria-hidden. Reduced motion: no tilt, no
 * follower, native cursor.
 */
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface CursorStageProps {
  children: ReactNode;
  tilt?: number;
  lift?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

type Spring = { x: number; v: number };
const step = (s: Spring, goal: number, dt: number, k = 380, c = 30) => {
  for (let i = 0; i < 2; i++) {
    const h = dt / 2;
    s.v += (-k * (s.x - goal) - c * s.v) * h;
    s.x += s.v * h;
  }
};

export function CursorStage({ children, tilt = 9, lift = 18, label = "View", className, style }: CursorStageProps) {
  const root = useRef<HTMLDivElement>(null);
  const cur = useRef<HTMLDivElement>(null);
  const txt = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    const cu = cur.current;
    if (!el || !cu) return;
    const mq = window.matchMedia?.("(pointer: fine)");
    if (!mq?.matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.live = "";

    type TileState = { el: HTMLElement; rx: Spring; ry: Spring; z: Spring; depth: HTMLElement[]; tx: number; ty: number; on: boolean };
    const tiles: TileState[] = Array.from(el.querySelectorAll<HTMLElement>("[data-magnetic]")).map((t) => ({
      el: t,
      rx: { x: 0, v: 0 },
      ry: { x: 0, v: 0 },
      z: { x: 0, v: 0 },
      depth: Array.from(t.querySelectorAll<HTMLElement>("[data-depth]")),
      tx: 0,
      ty: 0,
      on: false,
    }));

    const px = { x: 0, v: 0 };
    const py = { x: 0, v: 0 };
    const size = { x: 12, v: 0 };
    const fillS = { x: 0, v: 0 };
    let mx = -100;
    let my = -100;
    let inside = false;
    let mode: "dot" | "ring" | "label" = "dot";
    let text = label;
    let raf = 0;
    let last = 0;
    let rects: DOMRect[] = [];
    let host: DOMRect = el.getBoundingClientRect();
    let dirty = true;

    const read = () => {
      host = el.getBoundingClientRect();
      rects = tiles.map((t) => t.el.getBoundingClientRect());
      dirty = false;
    };

    const tick = (t: number) => {
      const dt = Math.min(0.032, (t - last) / 1000 || 0.016);
      last = t;
      if (dirty) read();

      // decide target mode from pointer position (rects read once per frame)
      let hit = -1;
      let near = false;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) hit = i;
        else if (mx >= r.left - 28 && mx <= r.right + 28 && my >= r.top - 28 && my <= r.bottom + 28) near = true;
      }
      const custom = hit >= 0 ? tiles[hit].el.getAttribute("data-cursor") : null;
      mode = hit >= 0 ? "label" : near ? "ring" : "dot";
      const nextText = custom || label;
      if (nextText !== text && txt.current) {
        text = nextText;
        txt.current.textContent = text;
      }

      // follower
      step(px, mx - host.left, dt, 520, 38);
      step(py, my - host.top, dt, 520, 38);
      step(size, mode === "label" ? 84 : mode === "ring" ? 44 : 12, dt, 380, 26);
      step(fillS, mode === "ring" ? 0 : 1, dt, 380, 30);
      // fixed 84px element, scaled, transform only, no layout
      const sc = Math.max(0.01, size.x / 84);
      cu.style.transform = `translate3d(${(px.x - 42).toFixed(2)}px,${(py.x - 42).toFixed(2)}px,0) scale(${sc.toFixed(4)})`;
      cu.style.setProperty("--ring", `${(1.5 / sc).toFixed(2)}px`);
      cu.style.setProperty("--fill", fillS.x.toFixed(3));
      cu.dataset.mode = mode;
      cu.style.opacity = inside ? "1" : "0";

      let moving = Math.abs(px.v) + Math.abs(py.v) + Math.abs(size.v) > 0.5 || Math.abs(px.x - (mx - host.left)) > 0.3;

      // tiles
      for (let i = 0; i < tiles.length; i++) {
        const T = tiles[i];
        const r = rects[i];
        const focused = T.el.matches(":focus-visible");
        const active = i === hit || focused;
        let nx = 0;
        let ny = 0;
        if (i === hit) {
          nx = ((mx - r.left) / r.width) * 2 - 1;
          ny = ((my - r.top) / r.height) * 2 - 1;
        }
        step(T.rx, active ? -ny * tilt : 0, dt);
        step(T.ry, active ? nx * tilt : 0, dt);
        step(T.z, active ? lift : 0, dt);
        if (active !== T.on) {
          T.on = active;
          if (active) T.el.setAttribute("data-hot", "");
          else T.el.removeAttribute("data-hot");
        }
        T.el.style.transform = `perspective(900px) translate3d(0,${(-T.z.x * 0.35).toFixed(2)}px,${T.z.x.toFixed(2)}px) rotateX(${T.rx.x.toFixed(3)}deg) rotateY(${T.ry.x.toFixed(3)}deg)`;
        T.el.style.setProperty("--fd-mcg-gx", `${((nx + 1) * 50).toFixed(1)}%`);
        T.el.style.setProperty("--fd-mcg-gy", `${((ny + 1) * 50).toFixed(1)}%`);
        for (const d of T.depth) {
          const k = Number(d.dataset.depth) || 0;
          d.style.transform = `translate3d(${(T.ry.x * k * 1.2).toFixed(2)}px,${(-T.rx.x * k * 1.2).toFixed(2)}px,0)`;
        }
        if (Math.abs(T.rx.v) + Math.abs(T.ry.v) + Math.abs(T.z.v) > 0.02 || Math.abs(T.z.x - (active ? lift : 0)) > 0.05) moving = true;
      }
      raf = moving ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      if (!inside) {
        // spawn the follower at the pointer, no fly-in from the corner
        inside = true;
        read();
        px.x = e.clientX - host.left;
        py.x = e.clientY - host.top;
      }
      mx = e.clientX;
      my = e.clientY;
      kick();
    };
    const onLeave = () => {
      inside = false;
      mx = my = -9999;
      kick();
    };
    const mark = () => {
      dirty = true;
      kick();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("focusin", mark);
    el.addEventListener("focusout", mark);
    window.addEventListener("scroll", mark, { passive: true, capture: true });
    window.addEventListener("resize", mark);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("focusin", mark);
      el.removeEventListener("focusout", mark);
      window.removeEventListener("scroll", mark, { capture: true });
      window.removeEventListener("resize", mark);
      if (raf) cancelAnimationFrame(raf);
      delete el.dataset.live;
    };
  }, [tilt, lift, label]);

  return (
    <div ref={root} className={`fd-mcg${className ? " " + className : ""}`} style={style}>
      <style>{css}</style>
      {children}
      <div ref={cur} className="fd-mcg-cursor" data-mode="dot" aria-hidden="true">
        <span ref={txt} className="fd-mcg-cursor-t">
          {label}
        </span>
      </div>
    </div>
  );
}

const css = `
.fd-mcg{
  --fd-ease-out:cubic-bezier(0.22,1,0.36,1);--fd-dur-2:240ms;--fd-dur-3:420ms;
  --fd-mcg-cursor:#FF4D2E;--fd-mcg-cursor-ink:#fff;
  position:relative;display:block;margin:0;padding:0;
}
.fd-mcg,.fd-mcg *{box-sizing:border-box}
.fd-mcg[data-live],.fd-mcg[data-live] *{cursor:none}
.fd-mcg-cursor{
  --fill:1;--ring:1.5px;
  position:absolute;left:0;top:0;z-index:50;width:84px;height:84px;margin:0;padding:0;pointer-events:none;transform-origin:50% 50%;
  display:flex;align-items:center;justify-content:center;border-radius:9999px;opacity:0;
  background:color-mix(in srgb,var(--fd-mcg-cursor) calc(var(--fill) * 100%),transparent);
  box-shadow:inset 0 0 0 var(--ring) var(--fd-mcg-cursor);
  transition:opacity var(--fd-dur-2) var(--fd-ease-out);will-change:transform;
}
.fd-mcg:not([data-live]) .fd-mcg-cursor{display:none}
.fd-mcg-cursor-t{
  color:var(--fd-mcg-cursor-ink);font:600 0.8125rem/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",sans-serif;letter-spacing:-0.005em;
  opacity:0;transform:scale(.6);transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-ease-out);white-space:nowrap;
}
.fd-mcg-cursor[data-mode="label"] .fd-mcg-cursor-t{opacity:1;transform:none;transition-delay:60ms}
[data-magnetic]{transform-style:preserve-3d;will-change:transform}
`;

/* ------------------------------------------------------------------ Demo */

type Work = { title: string; client: string; disc: string; bg: string; fg: string; motif: "orb" | "grid" | "wave" | "type" | "stack" | "sun"; span?: "wide" | "tall"; light?: boolean };

const WORK: Work[] = [
  { title: "Orbit", client: "Lumen Audio", disc: "Identity · 2026", bg: "#1D1B3A", fg: "#B7A6FF", motif: "orb", span: "wide" },
  { title: "Fieldnotes", client: "Moss & Co.", disc: "Editorial", bg: "#E7E0D0", fg: "#2F4A2A", motif: "type", light: true },
  { title: "Tidal", client: "Kaimana Swim", disc: "Campaign", bg: "#0E4A5C", fg: "#7FE3E0", motif: "wave", span: "tall" },
  { title: "Kiln", client: "Hearth Ceramics", disc: "Packaging", bg: "#D9673D", fg: "#FFE3CC", motif: "sun" },
  { title: "Gridline", client: "Parallel Bank", disc: "Product design", bg: "#F2F2F0", fg: "#141414", motif: "grid", light: true },
  { title: "Strata", client: "Basalt Records", disc: "Album art", bg: "#121214", fg: "#FF4D2E", motif: "stack", span: "wide" },
];

function Motif({ w }: { w: Work }) {
  const c = w.fg;
  switch (w.motif) {
    case "orb":
      return (
        <>
          <span className="fd-mcg-demo-m" data-depth="1.6" style={{ background: `radial-gradient(circle at 35% 30%, #fff 0%, ${c} 30%, transparent 70%)`, width: "46%", aspectRatio: "1", borderRadius: "50%", left: "40%", top: "18%" }} />
          <span className="fd-mcg-demo-m" data-depth="0.6" style={{ border: `1.5px solid ${c}`, width: "70%", aspectRatio: "1", borderRadius: "50%", left: "28%", top: "-6%", opacity: 0.5 }} />
        </>
      );
    case "grid":
      return (
        <span className="fd-mcg-demo-m" data-depth="1" style={{ inset: "18%", backgroundImage: `linear-gradient(${c} 2px, transparent 2px), linear-gradient(90deg, ${c} 2px, transparent 2px)`, backgroundSize: "28px 28px", opacity: 0.85 }} />
      );
    case "wave":
      return (
        <svg aria-hidden="true" focusable="false" className="fd-mcg-demo-m" data-depth="1.2" viewBox="0 0 200 300" preserveAspectRatio="none" style={{ inset: 0 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path key={i} d={`M0 ${120 + i * 26} C 50 ${100 + i * 26} 100 ${150 + i * 26} 200 ${118 + i * 26}`} fill="none" stroke={c} strokeWidth="2" opacity={1 - i * 0.14} />
          ))}
        </svg>
      );
    case "type":
      return (
        <span className="fd-mcg-demo-m fd-mcg-demo-big" data-depth="1.2" style={{ color: c, left: "10%", top: "16%" }}>
          Aa
        </span>
      );
    case "sun":
      return (
        <>
          <span className="fd-mcg-demo-m" data-depth="1.4" style={{ background: c, width: "44%", aspectRatio: "1", borderRadius: "50%", left: "28%", top: "16%" }} />
          <span className="fd-mcg-demo-m" data-depth="0.4" style={{ background: "rgba(0,0,0,.18)", left: 0, right: 0, top: "56%", bottom: 0 }} />
        </>
      );
    default:
      return (
        <>
          {[0, 1, 2].map((i) => (
            <span key={i} className="fd-mcg-demo-m" data-depth={String(0.6 + i * 0.6)} style={{ background: c, opacity: 0.35 + i * 0.3, left: `${18 + i * 10}%`, top: `${20 + i * 12}%`, width: "46%", height: "22%", borderRadius: 10 }} />
          ))}
        </>
      );
  }
}

export function Demo() {
  return (
    <div className="fd-mcg-demo">
      <style>{demoCss}</style>
      <CursorStage label="View">
        <header className="fd-mcg-demo-head">
          <span className="fd-mcg-demo-logo">Kollektiv Nord</span>
          <nav className="fd-mcg-demo-nav" aria-label="Studio">
            <a href="#work" className="fd-mcg-demo-link" data-magnetic data-cursor="Work">
              Work
            </a>
            <a href="#about" className="fd-mcg-demo-link" data-magnetic data-cursor="About">
              Studio
            </a>
            <a href="#contact" className="fd-mcg-demo-link" data-magnetic data-cursor="Say hi">
              Contact
            </a>
          </nav>
        </header>
        <h1 className="fd-mcg-demo-h">Selected work, 2024–26</h1>
        <div className="fd-mcg-demo-grid">
          {WORK.map((w) => (
            <a key={w.title} href={`#${w.title.toLowerCase()}`} className="fd-mcg-demo-tile" data-magnetic data-span={w.span} style={{ background: w.bg, color: w.fg, ["--scrim" as string]: w.light ? "rgba(255,255,255,.85)" : "rgba(0,0,0,.45)" }}>
              <span className="fd-mcg-demo-art">
                <Motif w={w} />
              </span>
              <span className="fd-mcg-demo-glare" />
              <span className="fd-mcg-demo-meta" data-depth="2.2">
                <span className="fd-mcg-demo-t">{w.title}</span>
                <span className="fd-mcg-demo-c">
                  {w.client}, {w.disc}
                </span>
              </span>
            </a>
          ))}
        </div>
      </CursorStage>
    </div>
  );
}

const demoCss = `
.fd-mcg-demo{display:block;margin:0;padding:0;background:#0C0C0E;color:#F2F2F0;min-height:100vh;overflow:clip}
.fd-mcg-demo,.fd-mcg-demo *{box-sizing:border-box}
.fd-mcg-demo .fd-mcg{max-width:1240px;margin:0 auto;padding:28px clamp(16px,4vw,48px) 64px}
.fd-mcg-demo-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 clamp(28px,6vh,56px)}
.fd-mcg-demo-logo{color:#F2F2F0;font:700 1rem/1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.02em}
.fd-mcg-demo-nav{display:flex;gap:4px;margin:0;padding:0}
.fd-mcg-demo-link{display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:9999px;color:#F2F2F0;text-decoration:none;font:500 0.875rem/1 ui-sans-serif,-apple-system,"Inter",sans-serif;background:rgba(255,255,255,.06)}
.fd-mcg-demo-link:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:2px}
.fd-mcg-demo-h{margin:0 0 24px;padding:0;color:#F2F2F0;font:600 clamp(2rem,5vw,3.5rem)/1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.04em}
.fd-mcg-demo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:clamp(140px,15vw,210px);gap:14px;margin:0;padding:0}
.fd-mcg-demo-tile{position:relative;display:block;margin:0;padding:0;border-radius:22px;overflow:hidden;text-decoration:none;isolation:isolate;
  box-shadow:0 1px 0 rgba(255,255,255,.04) inset;transition:box-shadow 420ms cubic-bezier(0.22,1,0.36,1)}
.fd-mcg-demo-tile[data-hot]{box-shadow:0 40px 60px -30px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.08) inset;z-index:2}
.fd-mcg-demo-tile[data-span="wide"]{grid-column:span 2}
.fd-mcg-demo-tile[data-span="tall"]{grid-row:span 2}
.fd-mcg-demo-tile:focus-visible{outline:2px solid rgba(10,132,255,.7);outline-offset:3px}
.fd-mcg-demo-art{position:absolute;inset:0;display:block}
.fd-mcg-demo-m{position:absolute;display:block;will-change:transform}
.fd-mcg-demo-big{font:700 clamp(4rem,10vw,9rem)/1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.06em}
.fd-mcg-demo-glare{position:absolute;inset:0;display:block;opacity:0;pointer-events:none;
  background:radial-gradient(60% 60% at var(--fd-mcg-gx,50%) var(--fd-mcg-gy,50%),rgba(255,255,255,.28),transparent 60%);
  transition:opacity 240ms cubic-bezier(0.22,1,0.36,1)}
.fd-mcg-demo-tile[data-hot] .fd-mcg-demo-glare{opacity:1}
.fd-mcg-demo-tile::after{content:"";position:absolute;left:0;right:0;bottom:0;height:46%;z-index:0;pointer-events:none;
  background:linear-gradient(to top,var(--scrim,rgba(0,0,0,.42)),transparent)}
.fd-mcg-demo-meta{position:absolute;left:18px;right:18px;bottom:16px;z-index:1;display:flex;flex-direction:column;gap:3px}
.fd-mcg-demo-t{color:inherit;font:650 1.25rem/1.1 "SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;letter-spacing:-0.02em}
.fd-mcg-demo-c{color:inherit;opacity:.7;font:500 0.75rem/1.3 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace}
@media (max-width:720px){
  .fd-mcg-demo-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:150px;gap:10px}
  .fd-mcg-demo-tile[data-span="wide"]{grid-column:span 2}
  .fd-mcg-demo-grid{grid-auto-flow:dense}
  .fd-mcg-demo-tile[data-span="wide"]:last-child{grid-column:span 1}
  .fd-mcg-demo-nav .fd-mcg-demo-link:not(:last-child){display:none}
  .fd-mcg-demo-tile{border-radius:18px}
  .fd-mcg-demo-big{font-size:3.5rem}
  .fd-mcg-demo-meta{left:14px;right:14px;bottom:12px}
  .fd-mcg-demo-c{display:none}
}
`;
