/**
 * CustomCursor, a cursor system for a scope (a section or the whole page):
 * a precise dot plus a ring that follows on a spring. Over elements with
 * data attributes the ring morphs:
 *
 *   data-cursor="View" | "Drag" | "Play" | any short label → ring grows into a labelled disc
 *   data-cursor-magnetic                                     → ring snaps around the element, which leans toward the pointer
 *   data-cursor="hide"                                       → hide the custom cursor (e.g. over text inputs)
 *
 * Props
 * - children                  The scope. The native cursor is hidden inside it (pointer: fine only).
 * - color?: string            Dot / disc colour. Default "#F5F3EE".
 * - blend?: boolean           mix-blend-mode: difference for the ring. Default true.
 * - stiffness?, damping?      Ring spring. Defaults 380 / 30 (the dot is exact).
 * - className / style
 * CSS vars: --fd-cc-color, --fd-cc-ring (ring diameter, default 36px), --fd-cc-disc (label disc, default 88px).
 *
 * Behaviour: hidden on touch / coarse pointers and until the first move; the
 * native cursor comes back over form fields. Keyboard users are unaffected
 * (the cursor is aria-hidden and pointer-only). Reduced motion: the ring
 * follows without spring lag and magnetic leaning is off.
 * Performance: one rAF loop that sleeps when the ring is at rest; target
 * rects are read on enter, writes are transform-only.
 * Browser support: all evergreen browsers.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface CustomCursorProps {
  children: ReactNode;
  color?: string;
  blend?: boolean;
  stiffness?: number;
  damping?: number;
  className?: string;
  style?: CSSProperties;
}

export function CustomCursor({ children, color = "#F5F3EE", blend = true, stiffness = 380, damping = 30, className, style }: CustomCursorProps) {
  const scope = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = scope.current;
    const d = dot.current;
    const r = ring.current;
    const lb = label.current;
    if (!el || !d || !r || !lb) return;
    const fine = window.matchMedia?.("(pointer: fine)").matches ?? true;
    if (!fine) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    el.setAttribute("data-cc-on", "");

    const s = { x: 0, y: 0, vx: 0, vy: 0, w: 36, vw: 0, h: 36, vh: 0 };
    const t = { x: 0, y: 0, w: 36, h: 36 };
    let mx = 0;
    let my = 0;
    let raf = 0;
    let last = 0;
    let shown = false;
    let mag: HTMLElement | null = null;
    let magRect: DOMRect | null = null;
    let ringBase = 36;
    let disc = 88;

    const readVars = () => {
      const cs = getComputedStyle(el);
      ringBase = parseFloat(cs.getPropertyValue("--fd-cc-ring")) || 36;
      disc = parseFloat(cs.getPropertyValue("--fd-cc-disc")) || 88;
    };
    readVars();

    const setTarget = () => {
      if (mag && magRect) {
        const er = el.getBoundingClientRect();
        const cx = magRect.left + magRect.width / 2 - er.left;
        const cy = magRect.top + magRect.height / 2 - er.top;
        // ring hugs the element, offset a little toward the pointer
        t.x = cx + (mx - cx) * 0.12;
        t.y = cy + (my - cy) * 0.12;
        t.w = magRect.width + 14;
        t.h = magRect.height + 14;
        if (!reduced) {
          const lx = (mx - cx) * 0.22;
          const ly = (my - cy) * 0.22;
          mag.style.transform = `translate3d(${lx.toFixed(2)}px,${ly.toFixed(2)}px,0)`;
        }
      } else {
        t.x = mx;
        t.y = my;
        const big = el.getAttribute("data-cc-state") === "label";
        t.w = t.h = big ? disc : ringBase;
      }
    };

    const write = () => {
      d.style.transform = `translate3d(${mx}px,${my}px,0)`;
      r.style.transform = `translate3d(${(s.x - s.w / 2).toFixed(2)}px,${(s.y - s.h / 2).toFixed(2)}px,0)`;
      r.style.width = `${s.w.toFixed(2)}px`;
      r.style.height = `${s.h.toFixed(2)}px`;
    };

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      setTarget();
      if (reduced) {
        s.x = t.x;
        s.y = t.y;
        s.w = t.w;
        s.h = t.h;
      } else {
        const h = dt / 2;
        for (let k = 0; k < 2; k++) {
          s.vx += (-stiffness * (s.x - t.x) - damping * s.vx) * h;
          s.vy += (-stiffness * (s.y - t.y) - damping * s.vy) * h;
          s.vw += (-stiffness * 1.1 * (s.w - t.w) - damping * s.vw) * h;
          s.vh += (-stiffness * 1.1 * (s.h - t.h) - damping * s.vh) * h;
          s.x += s.vx * h;
          s.y += s.vy * h;
          s.w += s.vw * h;
          s.h += s.vh * h;
        }
      }
      write();
      const rest = Math.abs(s.x - t.x) + Math.abs(s.y - t.y) + Math.abs(s.w - t.w) + Math.abs(s.h - t.h) < 0.2 && Math.abs(s.vx) + Math.abs(s.vy) < 0.5;
      if (!rest) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const findTarget = (n: EventTarget | null) => (n instanceof Element ? (n.closest("[data-cursor],[data-cursor-magnetic]") as HTMLElement | null) : null);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const er = el.getBoundingClientRect();
      mx = e.clientX - er.left;
      my = e.clientY - er.top;
      if (!shown) {
        shown = true;
        s.x = t.x = mx;
        s.y = t.y = my;
        el.setAttribute("data-cc-visible", "");
      }
      d.style.transform = `translate3d(${mx}px,${my}px,0)`;
      kick();
    };

    const onOver = (e: PointerEvent) => {
      const tg = findTarget(e.target);
      const native = e.target instanceof Element && e.target.closest("input,textarea,select,[contenteditable='true']");
      const lab = tg?.getAttribute("data-cursor") ?? "";
      if (native || lab === "hide") el.setAttribute("data-cc-state", "hide");
      else if (tg?.hasAttribute("data-cursor-magnetic")) {
        if (mag !== tg) {
          releaseMag();
          mag = tg;
          magRect = tg.getBoundingClientRect();
          // radius of the ring follows the element's own radius
          r.style.borderRadius = getComputedStyle(tg).borderRadius || "9999px";
          tg.style.transition = "transform 120ms linear";
        }
        el.setAttribute("data-cc-state", "magnetic");
      } else if (lab) {
        releaseMag();
        lb.textContent = lab;
        el.setAttribute("data-cc-state", "label");
      } else {
        releaseMag();
        el.removeAttribute("data-cc-state");
      }
      kick();
    };

    const releaseMag = () => {
      if (!mag) return;
      const m = mag;
      m.style.transition = "transform 420ms cubic-bezier(.34,1.56,.64,1)";
      m.style.transform = "";
      mag = null;
      magRect = null;
      r.style.borderRadius = "";
    };

    const onLeave = () => {
      shown = false;
      releaseMag();
      el.removeAttribute("data-cc-visible");
      el.removeAttribute("data-cc-state");
    };
    const onDown = () => el.setAttribute("data-cc-down", "");
    const onUp = () => el.removeAttribute("data-cc-down");
    const onScroll = () => {
      if (mag) magRect = mag.getBoundingClientRect();
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerover", onOver);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", readVars);
    return () => {
      cancelAnimationFrame(raf);
      releaseMag();
      el.removeAttribute("data-cc-on");
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerover", onOver);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", readVars);
    };
  }, [stiffness, damping]);

  return (
    <div ref={scope} className={`fd-cc${className ? " " + className : ""}`} data-blend={blend ? "" : undefined} style={{ ["--fd-cc-color" as string]: color, ...style }}>
      <style>{css}</style>
      {children}
      <div className="fd-cc-layer" aria-hidden="true">
        <div ref={ring} className="fd-cc-ring">
          <span ref={label} className="fd-cc-label" />
        </div>
        <div ref={dot} className="fd-cc-dot" />
      </div>
    </div>
  );
}

const css = `
.fd-cc,.fd-cc-layer,.fd-cc-layer *{box-sizing:border-box}
.fd-cc{--fd-cc-ring:36px;--fd-cc-disc:88px;position:relative;margin:0;padding:0}
.fd-cc[data-cc-on],.fd-cc[data-cc-on] *{cursor:none}
.fd-cc[data-cc-on] :is(input,textarea,select,[contenteditable="true"]){cursor:auto}
.fd-cc-layer{position:absolute;inset:0;margin:0;padding:0;pointer-events:none;z-index:2147483000;overflow:hidden;opacity:0;transition:opacity 240ms cubic-bezier(.22,1,.36,1)}
.fd-cc[data-cc-visible] .fd-cc-layer{opacity:1}
.fd-cc[data-cc-state="hide"] .fd-cc-layer{opacity:0}
.fd-cc-dot{position:absolute;left:-3px;top:-3px;width:6px;height:6px;margin:0;padding:0;border-radius:50%;background:var(--fd-cc-color);will-change:transform;
  transition:opacity 120ms,scale 240ms cubic-bezier(.34,1.56,.64,1)}
.fd-cc-ring{position:absolute;left:0;top:0;display:grid;place-items:center;width:var(--fd-cc-ring);height:var(--fd-cc-ring);margin:0;padding:0;border-radius:9999px;
  border:1.5px solid var(--fd-cc-color);background:transparent;will-change:transform,width,height;
  transition:background-color 240ms cubic-bezier(.22,1,.36,1),border-color 240ms,border-radius 240ms cubic-bezier(.65,0,.35,1),scale 120ms cubic-bezier(.22,1,.36,1)}
.fd-cc[data-blend] .fd-cc-ring{mix-blend-mode:difference}
.fd-cc[data-blend] .fd-cc-dot{mix-blend-mode:difference}
.fd-cc-label{margin:0;padding:0;opacity:0;scale:.6;color:#0B0B0F;font:600 13px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif;letter-spacing:-.005em;white-space:nowrap;
  transition:opacity 120ms,scale 240ms cubic-bezier(.34,1.56,.64,1)}
.fd-cc[data-cc-state="label"] .fd-cc-ring{background:var(--fd-cc-color);border-color:var(--fd-cc-color);mix-blend-mode:normal}
.fd-cc[data-cc-state="label"] .fd-cc-label{opacity:1;scale:1;transition-delay:60ms}
.fd-cc[data-cc-state="label"] .fd-cc-dot,.fd-cc[data-cc-state="magnetic"] .fd-cc-dot{opacity:0;scale:.3}
.fd-cc[data-cc-state="magnetic"] .fd-cc-ring{background:color-mix(in srgb,var(--fd-cc-color) 12%,transparent)}
.fd-cc[data-cc-down] .fd-cc-ring{scale:.88}
@media (pointer:coarse){.fd-cc-layer{display:none}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const WORK = [
  { t: "Halden Bank", k: "Identity · 2026", bg: "#E8E3D6", ink: "#1B2A4A", cursor: "View" },
  { t: "Oda Hotels", k: "Booking · 2025", bg: "#C2563A", ink: "#FFF4EA", cursor: "View" },
  { t: "Veloq E-bikes", k: "Launch film · 2026", bg: "#12251F", ink: "#EAF6EE", cursor: "Play" },
];

/** Flat case-study art, one drawn object per project. */
function WorkArt({ id }: { id: string }) {
  if (id === "Halden Bank") {
    return (
      <svg className="fd-cc-demo-art" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        <rect x="34" y="22" width="132" height="150" fill="#FBF9F3" />
        <text x="48" y="48" fill="#1B2A4A" fontFamily="Georgia,'Times New Roman',serif" fontSize="15">Halden</text>
        <g fill="#1B2A4A" opacity=".16"><rect x="48" y="72" width="90" height="4" /><rect x="48" y="84" width="104" height="4" /><rect x="48" y="96" width="76" height="4" /><rect x="48" y="116" width="100" height="4" /><rect x="48" y="128" width="92" height="4" /></g>
        <rect x="148" y="84" width="124" height="76" fill="#1B2A4A" />
        <g fill="#E8E3D6"><rect x="164" y="102" width="4" height="20" /><rect x="172" y="102" width="4" height="20" /><rect x="180" y="102" width="4" height="20" /><rect x="162" y="98" width="24" height="3" /><rect x="162" y="123" width="24" height="3" /></g>
        <text x="164" y="146" fill="#E8E3D6" fontFamily="Georgia,'Times New Roman',serif" fontSize="12">Halden</text>
      </svg>
    );
  }
  if (id === "Oda Hotels") {
    return (
      <svg className="fd-cc-demo-art" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        <path d="M150 0V30" stroke="#FFF4EA" strokeWidth="3" opacity=".7" />
        <rect x="104" y="30" width="92" height="132" rx="46" fill="#E3BE74" />
        <rect x="104" y="30" width="92" height="132" rx="46" fill="none" stroke="#9A7430" strokeWidth="2" />
        <circle cx="150" cy="62" r="9" fill="#C2563A" stroke="#9A7430" strokeWidth="2" />
        <text x="150" y="124" textAnchor="middle" fill="#6B4E17" fontFamily="Georgia,'Times New Roman',serif" fontSize="38">12</text>
        <text x="150" y="146" textAnchor="middle" fill="#6B4E17" fontFamily="ui-sans-serif,system-ui,sans-serif" fontSize="9" letterSpacing="2">ODA</text>
      </svg>
    );
  }
  return (
    <svg className="fd-cc-demo-art" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <g fill="none" stroke="#9BE3B8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="86" cy="104" r="38" /><circle cx="214" cy="104" r="38" />
        <path d="M86 104 L128 56 H178 L214 104 M128 56 L150 104 H86 M150 104 L178 56 M120 44 H138 M176 46 L170 34 H196" />
      </g>
      <rect x="116" y="76" width="32" height="12" rx="3" fill="#EAF6EE" transform="rotate(-40 132 82)" />
      <rect x="34" y="166" width="232" height="3" fill="#EAF6EE" opacity=".25" /><rect x="34" y="166" width="96" height="3" fill="#EAF6EE" />
    </svg>
  );
}

export function Demo() {
  const [sent, setSent] = useState(false);
  return (
    <CustomCursor className="fd-cc-demo">
      <style>{demoCss}</style>
      <header className="fd-cc-demo-bar">
        <span className="fd-cc-demo-brand">Studio Tannery</span>
        <nav className="fd-cc-demo-nav" aria-label="Primary">
          {["Work", "Approach", "Journal"].map((n) => (
            <a key={n} href={`#${n.toLowerCase()}`} data-cursor-magnetic>{n}</a>
          ))}
        </nav>
        <a className="fd-cc-demo-pill" href="#contact" data-cursor-magnetic>Start a project</a>
      </header>

      <main className="fd-cc-demo-main">
        <h1 className="fd-cc-demo-h1">
          Brand worlds for companies <span>with something to say.</span>
        </h1>

        <div className="fd-cc-demo-strip" data-cursor="Drag" role="region" aria-label="Selected work, scroll horizontally" tabIndex={0}>
          {WORK.map((w) => (
            <a key={w.t} href={`#${w.t.toLowerCase().replace(/\s/g, "-")}`} className="fd-cc-demo-card" data-cursor={w.cursor}
              style={{ background: w.bg, color: w.ink }}>
              <WorkArt id={w.t} />
              <span className="fd-cc-demo-meta">
                <strong>{w.t}</strong>
                <span>{w.k}</span>
              </span>
            </a>
          ))}
        </div>

        <form className="fd-cc-demo-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          <label className="fd-cc-demo-lab" htmlFor="fd-cc-demo-email">Get our quarterly letter</label>
          <div className="fd-cc-demo-row">
            <input id="fd-cc-demo-email" type="email" required placeholder="you@company.com" className="fd-cc-demo-input" />
            <button type="submit" className="fd-cc-demo-btn" data-cursor-magnetic>{sent ? "Subscribed" : "Subscribe"}</button>
          </div>
        </form>
      </main>
    </CustomCursor>
  );
}

const demoCss = `
.fd-cc-demo,.fd-cc-demo *,.fd-cc-demo *::before,.fd-cc-demo *::after{box-sizing:border-box}
.fd-cc-demo{--d-font:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;--d-disp:"SF Pro Display",ui-sans-serif,-apple-system,"Inter Display","Inter",sans-serif;
  min-height:100vh;margin:0;padding:0;background:#0E0E10;color:#F5F3EE;font:400 15px/1.5 var(--d-font);-webkit-font-smoothing:antialiased;overflow:hidden}
.fd-cc-demo-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0;padding:20px clamp(16px,4vw,48px)}
.fd-cc-demo-brand{margin:0;font:600 17px/1 var(--d-disp);letter-spacing:-.01em}
.fd-cc-demo-nav{display:flex;gap:8px;margin:0}
.fd-cc-demo-nav a{display:inline-flex;align-items:center;height:36px;margin:0;padding:0 14px;border-radius:9999px;color:rgba(245,243,238,.7);font:500 15px/1 var(--d-font);text-decoration:none}
.fd-cc-demo-nav a:hover{color:#F5F3EE}
.fd-cc-demo-pill{display:inline-flex;align-items:center;height:40px;margin:0;padding:0 18px;border-radius:9999px;background:#F5F3EE;color:#0E0E10;font:600 14px/1 var(--d-font);text-decoration:none}
.fd-cc-demo a:focus-visible,.fd-cc-demo button:focus-visible,.fd-cc-demo-strip:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
.fd-cc-demo-main{max-width:1320px;margin:0 auto;padding:clamp(16px,4vh,48px) clamp(16px,4vw,48px) 48px}
.fd-cc-demo-h1{max-width:14ch;margin:0;color:#F5F3EE;font:600 clamp(40px,5.6vw,84px)/.95 var(--d-disp);letter-spacing:-.045em;text-wrap:balance}
.fd-cc-demo-h1 span{color:rgba(245,243,238,.42)}
.fd-cc-demo-strip{display:flex;gap:16px;margin:clamp(24px,5vh,48px) 0 0;padding:0 0 8px;overflow-x:auto;scrollbar-width:none;scroll-snap-type:x mandatory}
.fd-cc-demo-strip::-webkit-scrollbar{display:none}
.fd-cc-demo-card{position:relative;flex:0 0 clamp(260px,30vw,400px);aspect-ratio:3/2;margin:0;padding:0;border-radius:24px;overflow:hidden;scroll-snap-align:start;text-decoration:none}
.fd-cc-demo-art{position:absolute;left:0;top:10px;width:100%;height:calc(100% - 66px);display:block}
.fd-cc-demo-meta{position:absolute;left:20px;bottom:18px;display:flex;flex-direction:column;gap:4px;margin:0}
.fd-cc-demo-meta strong{font:600 20px/1.1 var(--d-disp);letter-spacing:-.01em}
.fd-cc-demo-meta span{font:500 13px/1 var(--d-font);opacity:.8}
.fd-cc-demo-form{margin:clamp(24px,4vh,40px) 0 0;max-width:520px}
.fd-cc-demo-lab{display:block;margin:0 0 10px;color:rgba(245,243,238,.6);font:500 13px/1 var(--d-font)}
.fd-cc-demo-row{display:flex;gap:8px;margin:0}
.fd-cc-demo-input{flex:1;min-width:0;height:48px;margin:0;padding:0 18px;border:0;border-radius:9999px;background:rgba(245,243,238,.08);box-shadow:inset 0 0 0 1px rgba(245,243,238,.12);
  color:#F5F3EE;font:400 15px/1 var(--d-font);outline:0;appearance:none;-webkit-appearance:none}
.fd-cc-demo-input:focus{box-shadow:inset 0 0 0 1.5px rgba(10,132,255,.9)}
.fd-cc-demo-input::placeholder{color:rgba(245,243,238,.4)}
.fd-cc-demo-btn{appearance:none;-webkit-appearance:none;height:48px;margin:0;padding:0 22px;border:0;border-radius:9999px;background:#D7FF5C;color:#0E0E10;font:600 15px/1 var(--d-font);cursor:pointer}
@media (max-width:640px){.fd-cc-demo-nav{display:none}}
`;
