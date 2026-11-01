/**
 * Noir — luxury perfume house landing page (Maison Vérane).
 *
 * Cinematic black, bone and a single amber. Giant italic serif type; no
 * web fonts or network. The hero flacon is a pre-rendered photograph
 * (Demo image: /img/lux/perfume-noir.webp, included in the repo's public/img/lux —
 * copy it next to your page or swap in your own); the smaller flacons stay SVG so they can be tinted.
 * The smoke is a canvas of ~1k particles on
 * a drifting noise field that the cursor stirs.
 *
 * Motion
 *  - Hero: procedural smoke / ink fluid. Pointer velocity drags particles and
 *    adds a swirl; the title rises letter by letter out of a mask.
 *  - Manifesto: pinned, a giant italic sentence lights up word by word.
 *  - Flacon: pinned SVG bottle, two bands of light sweep across the glass as
 *    you scroll while the liquid glows and the bottle tilts; captions arrive
 *    in turn over an outlined background word.
 *  - Notes: pinned horizontal scroll through top / heart / base, each with its
 *    own colour atmosphere that crossfades; giant words counter-parallax.
 *  - Quiz: a pinned "discover your scent" with an animated result (name rises
 *    letter by letter, bars fill, the flacon fills with its own colour).
 *  - Collection rows with hover-lift bottles; reveal-on-scroll elsewhere.
 *
 * Reduced motion: smoke is a single pre-rendered frame, nothing pins, the
 * notes stack vertically, every word and caption is fully visible.
 * SSR-safe: no window/document access during render.
 */
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";

const sv = (o: Record<string, string | number>) => o as CSSProperties;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prefersReduced = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const NOOP = (e: { preventDefault: () => void }) => e.preventDefault();

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
const MANIFESTO = "Some things are not worn. They are remembered — a coat left on a chair, a door closing in another room, the last warm hour of a long day.";
const AMBER_WORDS = new Set(["remembered", "warm", "hour"]);

const NOTES = [
  { k: "Top", n: "I", when: "0 – 15 minutes", word: "Top", line: "The first breath. Bright, cold, gone before you can hold it.", atm: "#9DB5A6", list: [["Black bergamot", "Calabria, cold-pressed at dawn"], ["Pink pepper", "Sharp, almost metallic"], ["Green cardamom", "Crushed between the fingers"]] },
  { k: "Heart", n: "II", when: "15 minutes – 3 hours", word: "Heart", line: "The conversation. Velvet petals over a low smoulder.", atm: "#B04A5C", list: [["Rose absolute", "Bulgarian, steam-distilled twice"], ["Labdanum", "Resin of the cistus, dark and leathery"], ["Smoked iris", "Orris butter touched with birch tar"]] },
  { k: "Base", n: "III", when: "3 – 12 hours", word: "Base", line: "The memory. What stays on the collar long after you leave.", atm: "#E0A04A", list: [["Amber accord", "Warm, resinous, faintly sweet"], ["Aged oud", "Eleven years in oak"], ["Tonka & vetiver", "Dry hay, smoke, the end of summer"]] },
];

const QUIZ = [
  { q: "Where does the evening find you?", o: [
    ["A velvet bar, past midnight", [3, 1, 0, 0]], ["A coastal road at dusk", [0, 0, 3, 1]], ["An empty cathedral", [1, 0, 1, 3]], ["A garden after the rain", [0, 3, 1, 1]]] },
  { q: "Choose a texture.", o: [
    ["Suede, worn soft", [3, 1, 0, 0]], ["Raw silk", [0, 3, 0, 1]], ["Cold stone", [0, 0, 2, 3]], ["Linen, line-dried", [0, 0, 3, 1]]] },
  { q: "How long should it linger?", o: [
    ["A whisper, three hours", [0, 0, 2, 2]], ["An evening, eight hours", [1, 2, 1, 1]], ["A memory, twelve and more", [3, 2, 0, 0]], ["Until someone asks", [2, 1, 0, 2]]] },
] as { q: string; o: [string, number[]][] }[];

const SCENTS = [
  { id: "nox", num: "19", name: "Nox Ambre", tint: "#E0A04A", desc: "Warm, resinous and unhurried. Amber and aged oud in a slow, dark dance. A scent for rooms with the lights turned low.", bars: [92, 78, 96], notes: ["Black bergamot, pink pepper", "Rose absolute, labdanum", "Amber, oud, tonka"] },
  { id: "rose", num: "22", name: "Rose Fumée", tint: "#B04A5C", desc: "A rose that has been near a fire. Smoked petals and birch tar over a floor of patchouli. Romantic, a little dangerous.", bars: [74, 88, 82], notes: ["Saffron, cardamom", "Rose absolute, birch tar", "Patchouli, guaiac wood"] },
  { id: "vet", num: "31", name: "Vétiver Pâle", tint: "#9DB5A6", desc: "Cool, mineral and clean-edged. Vetiver root and cypress under a flash of grapefruit. Salt air and linen.", bars: [58, 46, 64], notes: ["Grapefruit zest, juniper", "Vetiver, cypress", "Oakmoss, white musk"] },
  { id: "iris", num: "08", name: "Iris Cendre", tint: "#C9C2D6", desc: "Powdery, grey and quietly austere. Orris butter, violet leaf and cold ash. The smell of stone after a long silence.", bars: [62, 54, 70], notes: ["Aldehydes, mandarin", "Orris butter, violet leaf", "Cedar, ash, sandalwood"] },
];

const COLLECTION = [
  { n: "Nox Ambre", no: "Nº 19", notes: "Amber · Oud · Tonka", price: "€265", tint: "#E0A04A" },
  { n: "Rose Fumée", no: "Nº 22", notes: "Smoked rose · Birch tar · Patchouli", price: "€265", tint: "#B04A5C" },
  { n: "Vétiver Pâle", no: "Nº 31", notes: "Vetiver · Cypress · Grapefruit", price: "€245", tint: "#9DB5A6" },
  { n: "Iris Cendre", no: "Nº 08", notes: "Orris · Violet leaf · Ash", price: "€285", tint: "#C9C2D6" },
];

/* ------------------------------------------------------------------ */
/* Noise for the smoke                                                 */
/* ------------------------------------------------------------------ */
const hash2 = (x: number, y: number) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

/* ------------------------------------------------------------------ */
/* Flacon                                                              */
/* ------------------------------------------------------------------ */
const BODY = "M104 252Q104 226 130 226H270Q296 226 296 252V556Q296 586 266 586H134Q104 586 104 556Z";
const LIQ = "M118 270Q118 264 126 264H274Q282 264 282 270V550Q282 572 262 572H138Q118 572 118 550Z";

function Defs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="nrg-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1d1a16" /><stop offset=".12" stopColor="#0d0c0a" /><stop offset=".55" stopColor="#14120f" /><stop offset=".9" stopColor="#0a0908" /><stop offset="1" stopColor="#24201a" />
        </linearGradient>
        <linearGradient id="nrg-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" /><stop offset=".25" stopColor="#fff" stopOpacity="0" /><stop offset=".7" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".55" />
        </linearGradient>
        <linearGradient id="nrg-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="nrg-cap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a2621" /><stop offset=".18" stopColor="#0b0a09" /><stop offset=".5" stopColor="#1b1814" /><stop offset=".8" stopColor="#090807" /><stop offset="1" stopColor="#2b2721" />
        </linearGradient>
        <linearGradient id="nrg-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a5524" /><stop offset=".35" stopColor="#f0c27a" /><stop offset=".6" stopColor="#b57f34" /><stop offset="1" stopColor="#5e3f17" />
        </linearGradient>
        <radialGradient id="nrg-glow"><stop offset="0" stopColor="#E0A04A" stopOpacity=".9" /><stop offset=".5" stopColor="#E0A04A" stopOpacity=".25" /><stop offset="1" stopColor="#E0A04A" stopOpacity="0" /></radialGradient>
        <clipPath id="nrg-photo"><rect x="104" y="226" width="192" height="360" rx="30" /><rect x="146" y="120" width="108" height="130" rx="10" /></clipPath>
        <clipPath id="nrg-clip">
          <path d={BODY} /><rect x="176" y="176" width="48" height="54" /><rect x="164" y="162" width="72" height="20" rx="3" /><rect x="146" y="48" width="108" height="118" rx="10" />
        </clipPath>
      </defs>
    </svg>
  );
}

type FlaconProps = {
  tint?: string; big?: boolean; level?: number; className?: string;
  sweepRef?: (el: SVGRectElement | null) => void; sweep2Ref?: (el: SVGRectElement | null) => void;
  glowRef?: (el: SVGCircleElement | null) => void; tiltRef?: (el: SVGGElement | null) => void;
};
function Flacon({ tint = "#E0A04A", big = false, level = 1, className, sweepRef, sweep2Ref, glowRef, tiltRef }: FlaconProps) {
  if (big)
    return (
      <svg className={className} viewBox="0 0 400 640" role="img" aria-label="Vérane Nº 19 flacon: amber glass, black lacquer cap, photographed in golden light" style={{ overflow: "visible" }}>
        <circle ref={glowRef} cx="200" cy="420" r="260" fill="url(#nrg-glow)" opacity={0.3} style={{ mixBlendMode: "screen" }} />
        <g ref={tiltRef}>
          <image
            href="/img/lux/perfume-noir.webp"
            x="-70" y="20" width="540" height="675"
            preserveAspectRatio="xMidYMid slice"
            style={{ WebkitMaskImage: "radial-gradient(ellipse 62% 60% at 50% 50%, #000 52%, transparent 100%)", maskImage: "radial-gradient(ellipse 62% 60% at 50% 50%, #000 52%, transparent 100%)" }}
          />
          <g clipPath="url(#nrg-photo)" style={{ mixBlendMode: "screen" }}>
            <rect ref={sweepRef} x="0" y="0" width="90" height="640" fill="url(#nrg-sweep)" transform="translate(-200 0) skewX(-16)" />
            <rect ref={sweep2Ref} x="0" y="0" width="26" height="640" fill="url(#nrg-sweep)" opacity=".8" transform="translate(-200 0) skewX(-16)" />
          </g>
        </g>
      </svg>
    );
  return (
    <svg className={className} viewBox="0 0 400 640" role="img" aria-label="Vérane flacon, hand-blown glass with an oak cap" style={{ overflow: "visible" }}>
      <circle ref={glowRef} cx="200" cy="420" r="260" fill="url(#nrg-glow)" opacity={big ? 0.3 : 0.18} style={{ mixBlendMode: "screen" }} />
      <g ref={tiltRef}>
        <ellipse cx="200" cy="600" rx="150" ry="14" fill="#000" opacity=".7" />
        {/* glass */}
        <path d={BODY} fill="url(#nrg-glass)" stroke="#E9E2D3" strokeOpacity=".38" strokeWidth="1.2" />
        {/* liquid */}
        <g className="nr-liq" style={{ transform: `scaleY(${level})`, transformOrigin: "200px 572px", transformBox: "view-box" } as CSSProperties}>
          <path d={LIQ} fill={tint} fillOpacity=".92" />
          <path d={LIQ} fill="url(#nrg-shade)" />
          <ellipse cx="200" cy="266" rx="82" ry="4" fill="#fff" opacity=".35" />
        </g>
        <path d="M104 252Q104 226 130 226H270Q296 226 296 252V556Q296 586 266 586H134Q104 586 104 556Z" fill="url(#nrg-shade)" opacity=".35" />
        <rect x="112" y="240" width="5" height="330" rx="2.5" fill="#fff" opacity=".16" />
        <rect x="104" y="548" width="192" height="3" fill="#fff" opacity=".08" />
        {/* neck + collar + cap */}
        <rect x="176" y="176" width="48" height="54" fill="url(#nrg-glass)" stroke="#E9E2D3" strokeOpacity=".3" />
        <rect x="164" y="162" width="72" height="20" rx="3" fill="url(#nrg-metal)" />
        <rect x="146" y="48" width="108" height="118" rx="10" fill="url(#nrg-cap)" stroke="#E9E2D3" strokeOpacity=".3" />
        <path d="M172 52V162M200 52V162M228 52V162" stroke="#E9E2D3" strokeOpacity=".08" />
        <rect x="150" y="56" width="4" height="100" rx="2" fill="#fff" opacity=".18" />
        {/* label */}
        <rect x="134" y="344" width="132" height="140" fill="none" stroke="#E9E2D3" strokeOpacity={big ? 0.45 : 0.35} strokeWidth=".8" />
        {big && (
          <>
            <text x="200" y="372" textAnchor="middle" fontFamily="inherit" fontSize="10" letterSpacing="5" fill="#E9E2D3" fillOpacity=".85">VÉRANE</text>
            <text x="200" y="430" textAnchor="middle" fontFamily="inherit" fontStyle="italic" fontSize="46" fill="#E9E2D3">Nº 19</text>
            <line x1="176" y1="446" x2="224" y2="446" stroke="#E0A04A" strokeWidth="1" />
            <text x="200" y="464" textAnchor="middle" fontFamily="inherit" fontSize="8" letterSpacing="3.5" fill="#E9E2D3" fillOpacity=".7">NOX AMBRE</text>
            <text x="200" y="476" textAnchor="middle" fontFamily="inherit" fontSize="6" letterSpacing="2.5" fill="#E9E2D3" fillOpacity=".5">EAU DE PARFUM · 50 ML</text>
          </>
        )}
        {!big && <line x1="170" y1="414" x2="230" y2="414" stroke="#E9E2D3" strokeOpacity=".5" strokeWidth=".8" />}
        {/* light */}
        {big && (
          <g clipPath="url(#nrg-clip)" style={{ mixBlendMode: "screen" }}>
            <rect ref={sweepRef} x="0" y="0" width="90" height="640" fill="url(#nrg-sweep)" transform="translate(-200 0) skewX(-16)" />
            <rect ref={sweep2Ref} x="0" y="0" width="26" height="640" fill="url(#nrg-sweep)" opacity=".8" transform="translate(-200 0) skewX(-16)" />
          </g>
        )}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export function Page() {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const cvsRef = useRef<HTMLCanvasElement>(null);
  const heroTxtRef = useRef<HTMLDivElement>(null);
  const manRef = useRef<HTMLElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const botRef = useRef<HTMLElement>(null);
  const sweepRef = useRef<SVGRectElement | null>(null);
  const sweep2Ref = useRef<SVGRectElement | null>(null);
  const glowRef = useRef<SVGCircleElement | null>(null);
  const tiltRef = useRef<SVGGElement | null>(null);
  const capRefs = useRef<(HTMLDivElement | null)[]>([]);
  const bgWordRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const atmRefs = useRef<(HTMLDivElement | null)[]>([]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fillRef = useRef<HTMLSpanElement>(null);
  const quizRef = useRef<HTMLElement>(null);
  const qringRef = useRef<SVGGElement>(null);

  const [note, setNote] = useState(0);
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<number[][]>([]);
  const [go, setGo] = useState(false);
  const [reserved, setReserved] = useState(false);
  const [navSolid, setNavSolid] = useState(false);
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  const words = MANIFESTO.split(" ");

  /* reveals */
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    root.classList.add("nr-js");
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-rv]"));
    if (typeof IntersectionObserver === "undefined") { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -10% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  /* ───── smoke ───── */
  useEffect(() => {
    const cvs = cvsRef.current, hero = heroRef.current; if (!cvs || !hero) return;
    const ctx = cvs.getContext("2d"); if (!ctx) return;
    const rm = prefersReduced();
    const SC = 0.5;
    let W = 0, H = 0, N = 0;
    let xs = new Float32Array(0), ys = new Float32Array(0), pxs = new Float32Array(0), pys = new Float32Array(0), life = new Float32Array(0), kind = new Uint8Array(0);
    let mx = -9999, my = -9999, lx = -9999, ly = -9999, mvx = 0, mvy = 0, hot = 0;
    let visible = true, raf = 0, last = performance.now(), T = 0;
    const R = 120;

    const spawn = (i: number, anywhere: boolean) => {
      if (anywhere || Math.random() < 0.3) { xs[i] = Math.random() * W; ys[i] = Math.random() * H; }
      else { xs[i] = W * 0.5 + (Math.random() + Math.random() + Math.random() - 1.5) * W * 0.32; ys[i] = H + 8; }
      pxs[i] = xs[i]; pys[i] = ys[i];
      life[i] = 220 + Math.random() * 380;
      kind[i] = Math.random() < 0.16 ? 1 : 0;
    };
    const resize = () => {
      W = Math.ceil(hero.clientWidth * SC); H = Math.ceil(hero.clientHeight * SC);
      cvs.width = W; cvs.height = H;
      ctx.fillStyle = "#070605"; ctx.fillRect(0, 0, W, H);
      N = Math.round(clamp((W * H) / 520, 420, 1500));
      xs = new Float32Array(N); ys = new Float32Array(N); pxs = new Float32Array(N); pys = new Float32Array(N); life = new Float32Array(N); kind = new Uint8Array(N);
      for (let i = 0; i < N; i++) spawn(i, true);
    };
    const step = (dt: number, fade: number) => {
      T += dt * 0.016;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(7,6,5,${fade})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 1.3; ctx.lineCap = "round";
      const sp = Math.hypot(mvx, mvy);
      // pointer injects fresh amber ink
      if (hot > 0.02 && sp > 0.6) { for (let k = 0; k < 10; k++) { const i = (Math.random() * N) | 0; xs[i] = mx + (Math.random() - 0.5) * 16; ys[i] = my + (Math.random() - 0.5) * 16; pxs[i] = xs[i]; pys[i] = ys[i]; kind[i] = Math.random() < 0.55 ? 1 : 0; life[i] = 120 + Math.random() * 160; } }
      for (let i = 0; i < N; i++) {
        let x = xs[i], y = ys[i];
        const a = vnoise(x * 0.0042 + T * 0.35, y * 0.0042 - T * 0.2) * 12.5 + vnoise(x * 0.011 - T * 0.5, y * 0.011 + T * 0.3) * 3;
        let vx = Math.cos(a) * 0.85, vy = Math.sin(a) * 0.85 - 0.42;
        let near = 0;
        if (hot > 0.02) {
          const dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) + 0.001, f = (1 - d / R) * (1 - d / R) * hot;
            vx += mvx * f * 0.45 - (dy / d) * f * 2.2; vy += mvy * f * 0.45 + (dx / d) * f * 2.2; near = f;
          }
        }
        x += vx * dt; y += vy * dt;
        const al = (kind[i] ? 0.2 : 0.15) * (1 + near * 1.4) * clamp(life[i] / 60);
        ctx.strokeStyle = kind[i] ? `rgba(224,160,74,${al})` : `rgba(233,226,211,${al})`;
        ctx.beginPath(); ctx.moveTo(pxs[i], pys[i]); ctx.lineTo(x, y); ctx.stroke();
        pxs[i] = x; pys[i] = y; xs[i] = x; ys[i] = y;
        life[i] -= dt;
        if (life[i] <= 0 || x < -20 || x > W + 20 || y < -20 || y > H + 20) spawn(i, false);
      }
      mvx *= 0.9; mvy *= 0.9; hot *= 0.985;
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(2.2, (now - last) / 16.67); last = now;
      if (!visible) return;
      step(dt, 0.05);
    };
    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) * SC, y = (e.clientY - r.top) * SC;
      if (lx > -9000) { mvx = mvx * 0.5 + (x - lx) * 0.9; mvy = mvy * 0.5 + (y - ly) * 0.9; }
      mx = x; my = y; lx = x; ly = y; hot = 1;
    };
    const onLeave = () => { lx = ly = -9999; };
    resize();
    if (rm) {
      for (let k = 0; k < 340; k++) step(1, 0.03);
      const onR = () => { resize(); for (let k = 0; k < 340; k++) step(1, 0.03); };
      window.addEventListener("resize", onR);
      return () => window.removeEventListener("resize", onR);
    }
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }) : null;
    io?.observe(hero);
    hero.addEventListener("pointermove", onMove); hero.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io?.disconnect(); hero.removeEventListener("pointermove", onMove); hero.removeEventListener("pointerleave", onLeave); window.removeEventListener("resize", resize); };
  }, []);

  /* ───── scroll choreography ───── */
  useEffect(() => {
    const rm = prefersReduced();
    let raf = 0, cur = -1, solid = false;
    const prog = (el: HTMLElement | null, vh: number) => { if (!el) return null; const r = el.getBoundingClientRect(); if (r.bottom < -80 || r.top > vh + 80) return null; return clamp(-r.top / Math.max(1, r.height - vh)); };
    const WN = words.length;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const vh = window.innerHeight, vw = window.innerWidth, sy = window.scrollY;
      const sol = sy > 40; if (sol !== solid) { solid = sol; setNavSolid(sol); }
      if (heroTxtRef.current) { const u = clamp(sy / (vh * 0.9)); heroTxtRef.current.style.transform = `translate3d(0,${(u * 140).toFixed(1)}px,0)`; heroTxtRef.current.style.opacity = String(1 - u * 0.9); }
      const pm = prog(manRef.current, vh);
      if (pm !== null) wordRefs.current.forEach((w, i) => { if (!w) return; const s = (i / WN) * 0.8 + 0.06; const u = clamp((pm - s) / 0.06); w.style.opacity = String(0.13 + 0.87 * u); w.style.transform = `translate3d(0,${((1 - u) * 14).toFixed(1)}px,0)`; });
      const pb = prog(botRef.current, vh);
      if (pb !== null) {
        const x = -150 + pb * 640;
        sweepRef.current?.setAttribute("transform", `translate(${x.toFixed(1)} 0) skewX(-16)`);
        sweep2Ref.current?.setAttribute("transform", `translate(${(x - 135).toFixed(1)} 0) skewX(-16)`);
        glowRef.current?.setAttribute("opacity", (0.2 + 0.55 * Math.sin(pb * Math.PI)).toFixed(3));
        tiltRef.current?.setAttribute("transform", `rotate(${(-3 + pb * 6).toFixed(2)} 200 590)`);
        [0.18, 0.5, 0.82].forEach((c, i) => { const el = capRefs.current[i]; if (el) { const o = clamp(1.7 - Math.abs(pb - c) / 0.1); el.style.opacity = String(o); el.style.transform = `translate3d(0,${((1 - o) * 24).toFixed(1)}px,0)`; } });
        if (bgWordRef.current) bgWordRef.current.style.transform = `translate3d(${(-pb * 26).toFixed(2)}vw,0,0)`;
      }
      const pn = prog(notesRef.current, vh);
      if (pn !== null && trackRef.current) {
        const pos = pn * 2;
        trackRef.current.style.transform = `translate3d(${(-pos * vw).toFixed(1)}px,0,0)`;
        atmRefs.current.forEach((el, i) => { if (el) el.style.opacity = String(clamp(1.15 - Math.abs(pos - i) * 1.1)); });
        panelRefs.current.forEach((el, i) => {
          if (!el) return; const off = i - pos;
          const word = el.querySelector<HTMLElement>(".nr-gw"), body = el.querySelector<HTMLElement>(".nr-pbody");
          if (word) word.style.transform = `translate3d(${(off * vw * 0.32).toFixed(1)}px,0,0)`;
          if (body) { body.style.transform = `translate3d(${(off * vw * 0.1).toFixed(1)}px,0,0)`; body.style.opacity = String(clamp(1.25 - Math.abs(off) * 1.3)); }
        });
        if (fillRef.current) fillRef.current.style.transform = `scaleX(${pn.toFixed(3)})`;
        const n = Math.round(pos); if (n !== cur) { cur = n; setNote(n); }
      }
      const pq = prog(quizRef.current, vh);
      if (pq !== null) qringRef.current?.setAttribute("transform", `rotate(${(pq * 140).toFixed(1)})`);
    };
    if (rm) {
      wordRefs.current.forEach((w) => { if (w) w.style.opacity = "1"; });
      return;
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [words.length]);

  /* result animation trigger */
  useEffect(() => {
    if (step < QUIZ.length) { setGo(false); return; }
    const id = window.setTimeout(() => setGo(true), 80);
    return () => window.clearTimeout(id);
  }, [step]);

  const scent = (() => {
    if (step < QUIZ.length) return SCENTS[0];
    const tot = [0, 0, 0, 0]; picks.forEach((p) => p.forEach((v, i) => { tot[i] += v; }));
    let b = 0; tot.forEach((v, i) => { if (v > tot[b]) b = i; });
    return SCENTS[b];
  })();
  const choose = (w: number[]) => { setPicks((p) => [...p, w]); setStep((s) => s + 1); };
  const back = () => { setPicks((p) => p.slice(0, -1)); setStep((s) => Math.max(0, s - 1)); };
  const retake = () => { setPicks([]); setStep(0); setReserved(false); };

  const goTo = (id: string) => (e: { preventDefault: () => void }) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });
  };

  return (
    <div ref={rootRef} className="nr" id="nr-top">
      <style>{CSS}</style>
      <Defs />
      <div className="nr-curtain" aria-hidden="true" />

      <header className={"nr-nav" + (navSolid ? " solid" : "")}>
        <a href="#nr-top" className="nr-logo" onClick={goTo("nr-top")}>Vérane</a>
        <nav className="nr-nav-links" aria-label="Primary">
          <a href="#nr-flacon" onClick={goTo("nr-flacon")}>The flacon</a>
          <a href="#nr-notes" onClick={goTo("nr-notes")}>Notes</a>
          <a href="#nr-quiz" onClick={goTo("nr-quiz")}>Find your scent</a>
          <a href="#nr-collection" onClick={goTo("nr-collection")}>Collection</a>
        </nav>
        <a href="#nr-collection" onClick={goTo("nr-collection")} className="nr-nav-bag">Boutique<span>0</span></a>
      </header>

      {/* ───────────── hero ───────────── */}
      <section className="nr-hero" ref={heroRef} aria-label="Nox Ambre, Eau de Parfum">
        <canvas ref={cvsRef} className="nr-smoke" aria-hidden="true" />
        <div className="nr-vig" aria-hidden="true" />
        <div className="nr-hero-in" ref={heroTxtRef}>
          <div className="nr-kicker">Maison de parfum · Grasse — Paris · Nº 19</div>
          <h1 aria-label="Smoke and Amber">
            <span className="nr-ln" aria-hidden="true">{"Smoke".split("").map((c, i) => <span key={i} style={sv({ "--i": i })}>{c}</span>)}</span>
            <span className="nr-ln amber2" aria-hidden="true">{"& Amber".split("").map((c, i) => <span key={i} style={sv({ "--i": i + 6 })}>{c === " " ? " " : c}</span>)}</span>
          </h1>
        </div>
        <div className="nr-hero-foot">
          <div className="nr-hero-meta">
            <b>Nox Ambre</b>
            <span>Eau de Parfum · 50 ml</span>
            <a href="#nr-quiz" onClick={goTo("nr-quiz")}>Discover your scent →</a>
          </div>
          <div className="nr-hero-hint"><i />Move through the smoke</div>
        </div>
      </section>

      {/* ───────────── manifesto ───────────── */}
      <section className="nr-man" ref={manRef} aria-label="Manifesto">
        <div className="nr-man-stick">
          <div className="nr-label">Manifeste</div>
          <p className="nr-man-p" aria-label={MANIFESTO}>
            {words.map((w, i) => (
              <span key={i} aria-hidden="true" ref={(el) => { wordRefs.current[i] = el; }} className={AMBER_WORDS.has(w.replace(/[.,—]/g, "")) ? "am" : ""}>{w}</span>
            ))}
          </p>
        </div>
      </section>

      {/* ───────────── flacon ───────────── */}
      <section className="nr-bot" id="nr-flacon" ref={botRef}>
        <div className="nr-bot-stick">
          <div className="nr-bgword" ref={bgWordRef} aria-hidden="true">Le Flacon</div>
          <Flacon big className="nr-flacon" sweepRef={(el) => { sweepRef.current = el; }} sweep2Ref={(el) => { sweep2Ref.current = el; }} glowRef={(el) => { glowRef.current = el; }} tiltRef={(el) => { tiltRef.current = el; }} />
          {[
            ["01", "The glass", "Hand-blown in the Vallée de la Bresle. 480 grams of lead-free crystal, so thick it bends the light before it reaches the juice.", "l t"],
            ["02", "The juice", "Thirty-two percent absolute, macerated twelve weeks on oak. Nothing added to make it louder. Only time.", "r m"],
            ["03", "The cap", "Smoked oak, turned by one family in the Jura, finished with a ring of brushed amber brass.", "l b"],
          ].map(([n, t, b, pos], i) => (
            <div key={n} className={"nr-cap " + pos} ref={(el) => { capRefs.current[i] = el; }}>
              <span>{n}</span><h3>{t}</h3><p>{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── notes ───────────── */}
      <section className="nr-notes" id="nr-notes" ref={notesRef} aria-label="Notes: top, heart and base">
        <div className="nr-notes-stick">
          {NOTES.map((n, i) => (
            <div key={n.k} className="nr-atm" ref={(el) => { atmRefs.current[i] = el; }} style={sv({ "--atm": n.atm })} aria-hidden="true" />
          ))}
          <div className="nr-track" ref={trackRef}>
            {NOTES.map((n, i) => (
              <div key={n.k} className="nr-panel" ref={(el) => { panelRefs.current[i] = el; }} style={sv({ "--atm": n.atm })}>
                <div className="nr-gw" aria-hidden="true">{n.word}</div>
                <div className="nr-pbody">
                  <div className="nr-pk"><b>{n.n}</b><span>{n.when}</span></div>
                  <h2>{n.k} <em>notes</em></h2>
                  <p className="nr-pline">{n.line}</p>
                  <ul>
                    {n.list.map(([a, d]) => (<li key={a}><span>{a}</span><small>{d}</small></li>))}
                  </ul>
                </div>
                <div className="nr-orb" aria-hidden="true"><i /><i /><i /></div>
              </div>
            ))}
          </div>
          <div className="nr-tl" aria-hidden="true">
            <div className="nr-tl-bar"><span ref={fillRef} /></div>
            <div className="nr-tl-labels">{NOTES.map((n, i) => <span key={n.k} className={i === note ? "on" : ""}>{n.k} · {n.when}</span>)}</div>
          </div>
        </div>
      </section>

      {/* ───────────── quiz ───────────── */}
      <section className="nr-quiz" id="nr-quiz" ref={quizRef}>
        <div className="nr-quiz-stick">
          <svg className="nr-qring" viewBox="-400 -400 800 800" aria-hidden="true">
            <g ref={qringRef}>
              {[380, 300, 220].map((r, i) => <circle key={r} r={r} fill="none" stroke="#E9E2D3" strokeOpacity={0.1 - i * 0.02} strokeDasharray={i === 1 ? "2 10" : "none"} />)}
              <circle cx="380" cy="0" r="5" fill="#E0A04A" /><circle cx="-220" cy="0" r="3" fill="#E9E2D3" />
            </g>
          </svg>
          <div className="nr-quiz-in">
            {step < QUIZ.length ? (
              <div key={step} className="nr-qstep">
                <div className="nr-label">Discover your scent · 0{step + 1} / 0{QUIZ.length}</div>
                <h2 className="nr-qh">{QUIZ[step].q}</h2>
                <div className="nr-opts">
                  {QUIZ[step].o.map(([t, w], i) => (
                    <button key={t} type="button" className="nr-opt" onClick={() => choose(w)}>
                      <small>{["I", "II", "III", "IV"][i]}</small><span>{t}</span>
                    </button>
                  ))}
                </div>
                <div className="nr-qnav">
                  <div className="dots" aria-hidden="true">{QUIZ.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
                  {step > 0 && <button type="button" onClick={back} className="nr-linkbtn">← Back</button>}
                </div>
              </div>
            ) : (
              <div className={"nr-res" + (go ? " go" : "")} role="status" aria-live="polite">
                <div className="nr-res-l">
                  <div className="nr-label">Your signature · Nº {scent.num}</div>
                  <h2 className="nr-res-name" aria-label={scent.name}>
                    {scent.name.split("").map((c, i) => <span key={i} aria-hidden="true" style={sv({ "--i": i })}>{c === " " ? " " : c}</span>)}
                  </h2>
                  <p className="nr-res-d">{scent.desc}</p>
                  <div className="nr-bars">
                    {["Warmth", "Sillage", "Longevity"].map((l, i) => (
                      <div key={l}><span>{l}</span><div><i style={sv({ "--w": scent.bars[i] + "%", "--k": i })} /></div><b>{scent.bars[i]}</b></div>
                    ))}
                  </div>
                  <div className="nr-res-notes">{["Top", "Heart", "Base"].map((l, i) => <div key={l}><small>{l}</small><span>{scent.notes[i]}</span></div>)}</div>
                  <div className="nr-res-cta">
                    <button type="button" className="nr-btn" onClick={() => setReserved(true)} disabled={reserved}>{reserved ? "Sample reserved ✓" : "Reserve a 2 ml sample"}</button>
                    <button type="button" className="nr-linkbtn" onClick={retake}>Retake the quiz</button>
                  </div>
                </div>
                <div className="nr-res-r" style={sv({ "--tint": scent.tint })}>
                  <div className="nr-res-halo" aria-hidden="true" />
                  <Flacon tint={scent.tint} level={go ? 1 : 0.02} className="nr-res-bottle" />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ───────────── collection ───────────── */}
      <section className="nr-coll" id="nr-collection">
        <div className="nr-wrap">
          <div className="nr-label" data-rv>The collection</div>
          <h2 className="nr-h2" data-rv>Four ways to <em>disappear.</em></h2>
          <ul className="nr-rows">
            {COLLECTION.map((c, i) => (
              <li key={c.n} data-rv style={sv({ "--d": i * 0.08 + "s", "--tint": c.tint })}>
                <a href="#" onClick={NOOP} className="nr-row">
                  <span className="no">{c.no}</span>
                  <span className="nm">{c.n}</span>
                  <span className="nt">{c.notes}</span>
                  <span className="pr">{c.price}<small>50 ml</small></span>
                  <span className="bt" aria-hidden="true"><Flacon tint={c.tint} /></span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────────── footer ───────────── */}
      <footer className="nr-foot">
        <div className="nr-wrap nr-foot-grid">
          <div data-rv>
            <div className="nr-label">The letter</div>
            <p className="nr-foot-p">One letter a season. New accords, rare restocks, nothing else.</p>
            <form className="nr-sub" onSubmit={(e: FormEvent) => { e.preventDefault(); if (email.includes("@")) setJoined(true); }}>
              {joined ? <div className="nr-thanks">Merci. The next letter finds you in spring.</div> : (
                <>
                  <label className="nr-sr" htmlFor="nr-email">Email</label>
                  <input id="nr-email" type="email" required placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button type="submit">Subscribe</button>
                </>
              )}
            </form>
          </div>
          <div data-rv style={sv({ "--d": ".1s" })}>
            <div className="nr-label">Maison</div>
            <address>14 rue du Faubourg Saint-Honoré<br />75008 Paris<br />Tue – Sat, 11 – 19h</address>
          </div>
          <div data-rv style={sv({ "--d": ".2s" })}>
            <div className="nr-label">House</div>
            <ul className="nr-foot-links">{["Our story", "The atelier in Grasse", "Refills", "Stockists", "Contact"].map((l) => <li key={l}><a href="#" onClick={NOOP}>{l}</a></li>)}</ul>
          </div>
        </div>
        <div className="nr-giant" aria-hidden="true">Vérane</div>
        <div className="nr-wrap nr-legal"><span>© 2026 Maison Vérane SAS</span><span>Privacy · Terms · Shipping</span></div>
      </footer>
    </div>
  );
}

export default Page;

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const CSS = `
.nr{--nr-black:#070605;--nr-ink:#0E0C0A;--nr-bone:#E9E2D3;--nr-mute:#A8A196;--nr-amber:#E0A04A;--nr-line:rgba(233,226,211,.14);
--nr-serif:"Cormorant Garamond","Playfair Display","Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
--nr-sans:"Helvetica Neue","Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;
--nr-out:cubic-bezier(.22,1,.36,1);
position:relative;box-sizing:border-box;width:100%;background:var(--nr-black);color:var(--nr-bone);font-family:var(--nr-sans);font-size:16px;line-height:1.6;font-weight:300;text-align:left;overflow-x:clip;-webkit-font-smoothing:antialiased}
.nr *,.nr *::before,.nr *::after{box-sizing:border-box}
:where(.nr) :where(h1,h2,h3,p,ul,li,form,address){margin:0;padding:0;font:inherit;letter-spacing:inherit;font-style:normal}
:where(.nr) :where(ul){list-style:none}
:where(.nr) :where(a){color:inherit;text-decoration:none}
:where(.nr) :where(button,input){font:inherit;color:inherit;margin:0;border:0;background:none;padding:0;appearance:none;-webkit-appearance:none;border-radius:0;text-align:inherit}
:where(.nr) :where(button){cursor:pointer}
.nr :focus-visible{outline:1px solid var(--nr-amber);outline-offset:4px}
:where(.nr) :where(svg){display:block;max-width:100%}
.nr .nr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.nr-wrap{width:100%;max-width:1280px;margin:0 auto;padding:0 48px}
.nr-label{font-family:var(--nr-sans);font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:var(--nr-amber);font-weight:400}
.nr-h2{margin-top:22px;font-family:var(--nr-serif);font-style:italic;font-weight:400;font-size:clamp(3rem,9vw,8.4rem);line-height:.92;letter-spacing:-.025em}
.nr-h2 em{color:var(--nr-amber)}
.nr-btn{display:inline-flex;align-items:center;justify-content:center;height:54px;padding:0 34px;border:1px solid var(--nr-amber);color:var(--nr-black);background:var(--nr-amber);font-size:12px;letter-spacing:.26em;text-transform:uppercase;font-weight:500;transition:background .4s,color .4s,transform .5s var(--nr-out)}
.nr-btn:hover:not(:disabled){background:transparent;color:var(--nr-amber)}
.nr-btn:disabled{background:transparent;color:var(--nr-amber);cursor:default}
.nr-linkbtn{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--nr-mute);border-bottom:1px solid transparent;transition:color .3s,border-color .3s;padding:4px 0}
.nr-linkbtn:hover{color:var(--nr-bone);border-color:var(--nr-bone)}

.nr-curtain{position:fixed;inset:0;z-index:100;background:var(--nr-black);pointer-events:none;animation:nrCurtain 1.8s .15s var(--nr-out) forwards}
@keyframes nrCurtain{to{opacity:0;visibility:hidden}}

/* nav */
.nr-nav{position:fixed;z-index:60;top:0;left:0;right:0;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:22px 48px;transition:background .5s,padding .5s;mix-blend-mode:normal}
.nr-nav.solid{background:rgba(7,6,5,.78);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);padding-top:14px;padding-bottom:14px;border-bottom:1px solid var(--nr-line)}
.nr-logo{font-family:var(--nr-serif);font-size:26px;letter-spacing:.34em;text-transform:uppercase;font-weight:500}
.nr-nav-links{display:flex;gap:38px;font-size:11px;letter-spacing:.26em;text-transform:uppercase}
.nr-nav-links a,.nr-nav-bag{opacity:.78;transition:opacity .3s,color .3s}.nr-nav-links a:hover,.nr-nav-bag:hover{opacity:1;color:var(--nr-amber)}
.nr-nav-bag{justify-self:end;font-size:11px;letter-spacing:.26em;text-transform:uppercase;display:inline-flex;gap:10px;align-items:center}
.nr-nav-bag span{width:22px;height:22px;border:1px solid var(--nr-line);border-radius:50%;display:grid;place-items:center;font-size:10px;letter-spacing:0}

/* hero */
.nr-hero{position:relative;height:100vh;min-height:620px;overflow:hidden;background:var(--nr-black);cursor:crosshair}
.nr-smoke{position:absolute;inset:0;width:100%;height:100%}
.nr-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(70% 45% at 50% 105%,rgba(224,160,74,.16),transparent 70%),radial-gradient(75% 70% at 50% 50%,transparent 35%,rgba(7,6,5,.8) 100%),linear-gradient(180deg,rgba(7,6,5,.55),transparent 22%,transparent 70%,rgba(7,6,5,.8))}
.nr-hero-in{position:absolute;left:0;right:0;bottom:15vh;padding:0 48px;pointer-events:none;will-change:transform,opacity}
.nr-kicker{font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:var(--nr-mute);margin-bottom:2vh;opacity:0;animation:nrFade 1.4s 1.6s var(--nr-out) forwards}
.nr-hero h1{font-family:var(--nr-serif);font-style:italic;font-weight:300;font-size:clamp(5.2rem,21vw,21rem);line-height:.8;letter-spacing:-.04em;color:var(--nr-bone)}
.nr-ln{display:block;overflow:hidden;padding:.06em .1em .12em 0;margin-right:-.1em}
.nr-ln span{display:inline-block;transform:translate3d(0,112%,0);animation:nrRise 1.5s var(--nr-out) calc(var(--i) * 70ms + 1s) forwards}
.nr-ln.amber2{color:var(--nr-amber);padding-left:.3em}
@keyframes nrRise{to{transform:none}}
@keyframes nrFade{to{opacity:1}}
.nr-hero-foot{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end;padding:0 48px 34px;gap:20px;opacity:0;animation:nrFade 1.4s 2.1s var(--nr-out) forwards;pointer-events:none}
.nr-hero-meta{display:grid;gap:4px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--nr-mute);pointer-events:auto}
.nr-hero-meta b{font-family:var(--nr-serif);font-style:italic;font-weight:400;font-size:28px;letter-spacing:0;text-transform:none;color:var(--nr-bone)}
.nr-hero-meta a{margin-top:8px;color:var(--nr-amber);transition:letter-spacing .4s var(--nr-out)}.nr-hero-meta a:hover{letter-spacing:.3em}
.nr-hero-hint{display:flex;align-items:center;gap:14px;font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--nr-mute)}
.nr-hero-hint i{width:46px;height:1px;background:var(--nr-amber);transform-origin:left;animation:nrLine 2.6s ease-in-out infinite}
@keyframes nrLine{50%{transform:scaleX(.2)}}

.nr.nr-js [data-rv]{opacity:0;transform:translate3d(0,40px,0);transition:opacity 1.2s var(--nr-out) var(--d,0s),transform 1.2s var(--nr-out) var(--d,0s)}
.nr.nr-js [data-rv].in{opacity:1;transform:none}

/* manifesto */
.nr-man{position:relative;height:300vh;background:var(--nr-black)}
.nr-man-stick{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 48px;max-width:1380px;margin:0 auto}
.nr-man-p{margin-top:28px;font-family:var(--nr-serif);font-style:italic;font-weight:400;font-size:clamp(2.1rem,6.4vw,6.4rem);line-height:1.02;letter-spacing:-.025em}
.nr-man-p span{display:inline-block;margin-right:.26em;opacity:.13;will-change:opacity,transform}
.nr-man-p span.am{color:var(--nr-amber)}

/* flacon */
.nr-bot{position:relative;height:360vh;background:radial-gradient(60% 50% at 50% 55%,#15110c,var(--nr-black) 70%)}
.nr-bot-stick{position:sticky;top:0;height:100vh;overflow:hidden;display:grid;place-items:center}
.nr-bgword{position:absolute;left:0;top:50%;margin-top:-.5em;white-space:nowrap;font-family:var(--nr-serif);font-style:italic;font-size:clamp(10rem,36vw,36rem);line-height:1;color:transparent;-webkit-text-stroke:1px rgba(233,226,211,.13);padding-left:12vw;will-change:transform}
.nr-flacon{position:relative;height:min(82vh,760px);width:auto;aspect-ratio:400/640;font-family:var(--nr-serif)}
.nr-cap{position:absolute;max-width:320px;opacity:0;will-change:opacity,transform}
.nr-cap.l{left:max(48px,6vw)}.nr-cap.r{right:max(48px,6vw)}
.nr-cap.t{top:20vh}.nr-cap.m{top:42vh}.nr-cap.b{bottom:15vh}
.nr-cap span{font-size:11px;letter-spacing:.34em;color:var(--nr-amber)}
.nr-cap h3{margin-top:10px;font-family:var(--nr-serif);font-style:italic;font-weight:400;font-size:clamp(2rem,3.4vw,3.2rem);line-height:1}
.nr-cap p{margin-top:14px;color:var(--nr-mute);font-size:15px;line-height:1.65}
.nr-cap.r{text-align:right}

/* notes */
.nr-notes{position:relative;height:420vh;background:var(--nr-black)}
.nr-notes-stick{position:sticky;top:0;height:100vh;overflow:hidden}
.nr-atm{position:absolute;inset:0;opacity:0;background:radial-gradient(70% 80% at 72% 55%,color-mix(in srgb,var(--atm) 30%,transparent),transparent 70%),radial-gradient(60% 60% at 10% 100%,color-mix(in srgb,var(--atm) 16%,transparent),transparent 70%)}
.nr-atm:first-child{opacity:1}
.nr-track{position:absolute;left:0;top:0;height:100%;width:300vw;display:flex;will-change:transform}
.nr-panel{position:relative;flex:0 0 100vw;height:100%;overflow:hidden;display:flex;align-items:center;padding:0 7vw}
.nr-gw{position:absolute;left:0;bottom:-.12em;font-family:var(--nr-serif);font-style:italic;font-weight:300;font-size:clamp(11rem,38vw,40rem);line-height:.8;letter-spacing:-.05em;color:color-mix(in srgb,var(--atm) 20%,transparent);white-space:nowrap;padding-left:3vw;will-change:transform}
.nr-pbody{position:relative;z-index:2;max-width:640px;will-change:transform,opacity}
.nr-pk{display:flex;align-items:center;gap:18px;font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--atm)}
.nr-pk b{font-family:var(--nr-serif);font-style:italic;font-weight:400;font-size:28px;letter-spacing:0}
.nr-panel h2{margin-top:14px;font-family:var(--nr-serif);font-style:italic;font-weight:400;font-size:clamp(3.4rem,9vw,8rem);line-height:.9;letter-spacing:-.03em}
.nr-panel h2 em{color:var(--atm)}
.nr-pline{margin-top:20px;max-width:28em;font-family:var(--nr-serif);font-style:italic;font-size:clamp(1.2rem,2vw,1.7rem);line-height:1.3;color:var(--nr-bone);opacity:.85}
.nr-panel ul{margin-top:32px;border-top:1px solid var(--nr-line)}
.nr-panel li{display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:15px 0;border-bottom:1px solid var(--nr-line)}
.nr-panel li span{font-family:var(--nr-serif);font-size:clamp(1.3rem,2vw,1.75rem);color:var(--nr-bone)}
.nr-panel li small{font-size:12px;letter-spacing:.06em;color:var(--nr-mute);text-align:right}
.nr-orb{position:absolute;right:8vw;top:50%;width:min(36vw,520px);aspect-ratio:1;margin-top:calc(min(36vw,520px) / -2);pointer-events:none}
.nr-orb i{position:absolute;border-radius:50%;filter:blur(36px);background:radial-gradient(circle,color-mix(in srgb,var(--atm) 55%,transparent),transparent 70%);animation:nrDrift 14s ease-in-out infinite}
.nr-orb i:nth-child(1){inset:8%}.nr-orb i:nth-child(2){inset:30% 0 0 34%;animation-delay:-5s;animation-duration:18s}.nr-orb i:nth-child(3){inset:0 38% 42% 0;animation-delay:-9s;opacity:.6}
@keyframes nrDrift{50%{transform:translate3d(8%,-6%,0) scale(1.15)}}
.nr-tl{position:absolute;left:7vw;right:7vw;bottom:34px;z-index:3}
.nr-tl-bar{height:1px;background:var(--nr-line)}
.nr-tl-bar span{display:block;height:1px;background:var(--nr-amber);transform:scaleX(0);transform-origin:left}
.nr-tl-labels{display:flex;justify-content:space-between;margin-top:14px;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#6f6a62}
.nr-tl-labels .on{color:var(--nr-amber)}

/* quiz */
.nr-quiz{position:relative;height:190vh;background:var(--nr-black);border-top:1px solid var(--nr-line)}
.nr-quiz-stick{position:sticky;top:0;height:100vh;overflow:hidden;display:flex;align-items:center}
.nr-qring{position:absolute;left:50%;top:50%;width:max(130vh,900px);transform:translate(-50%,-50%);pointer-events:none}
.nr-quiz-in{position:relative;width:100%;max-width:1280px;margin:0 auto;padding:0 48px}
.nr-qstep{animation:nrStep .9s var(--nr-out)}
@keyframes nrStep{from{opacity:0;transform:translate3d(0,24px,0)}}
.nr-qh{margin-top:24px;max-width:11em;font-family:var(--nr-serif);font-style:italic;font-weight:400;font-size:clamp(2.8rem,7vw,6.6rem);line-height:.96;letter-spacing:-.03em}
.nr-opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 48px;margin-top:44px;max-width:980px}
.nr-opt{display:flex;align-items:baseline;gap:20px;padding:20px 0;border-top:1px solid var(--nr-line);font-family:var(--nr-serif);font-size:clamp(1.3rem,2.2vw,2rem);line-height:1.15;transition:padding .5s var(--nr-out),color .3s,border-color .3s}
.nr-opt small{font-family:var(--nr-sans);font-size:11px;letter-spacing:.2em;color:var(--nr-amber);min-width:2.2em}
.nr-opt:hover,.nr-opt:focus-visible{padding-left:18px;color:var(--nr-amber);border-color:var(--nr-amber)}
.nr-qnav{display:flex;align-items:center;gap:30px;margin-top:34px}
.nr-qnav .dots{display:flex;gap:8px}.nr-qnav .dots i{width:26px;height:1px;background:var(--nr-line)}.nr-qnav .dots i.on{background:var(--nr-amber)}
.nr-res{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:5vw;align-items:center}
.nr-res-name{margin-top:14px;font-family:var(--nr-serif);font-style:italic;font-weight:400;font-size:clamp(3.4rem,8vw,7.6rem);line-height:.9;letter-spacing:-.03em;color:var(--nr-bone)}
.nr-res-name span{display:inline-block;opacity:0;transform:translate3d(0,40%,0) rotate(4deg);transition:opacity 1s var(--nr-out) calc(var(--i) * 55ms),transform 1.2s var(--nr-out) calc(var(--i) * 55ms)}
.nr-res.go .nr-res-name span{opacity:1;transform:none}
.nr-res-d{margin-top:18px;max-width:34em;color:var(--nr-mute);font-size:15.5px;opacity:0;transition:opacity 1s .5s}
.nr-res.go .nr-res-d,.nr-res.go .nr-res-notes,.nr-res.go .nr-res-cta{opacity:1}
.nr-bars{margin-top:24px;display:grid;gap:10px;max-width:440px}
.nr-bars>div{display:grid;grid-template-columns:90px 1fr 28px;align-items:center;gap:14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--nr-mute)}
.nr-bars>div>div{height:1px;background:var(--nr-line);position:relative}
.nr-bars i{position:absolute;left:0;top:-1px;height:3px;width:var(--w);background:var(--nr-amber);transform:scaleX(0);transform-origin:left;transition:transform 1.8s var(--nr-out) calc(.5s + var(--k) * .15s)}
.nr-res.go .nr-bars i{transform:scaleX(1)}
.nr-bars b{font-weight:400;color:var(--nr-bone);letter-spacing:0;text-align:right}
.nr-res-notes{margin-top:22px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:640px;opacity:0;transition:opacity 1s .9s}
.nr-res-notes small{display:block;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--nr-amber);margin-bottom:4px}
.nr-res-notes span{font-family:var(--nr-serif);font-style:italic;font-size:1.1rem;line-height:1.2;color:var(--nr-bone)}
.nr-res-cta{margin-top:26px;display:flex;align-items:center;gap:28px;flex-wrap:wrap;opacity:0;transition:opacity 1s 1.1s}
.nr-res-r{position:relative;justify-self:center;width:100%;display:grid;place-items:center}
.nr-res-halo{position:absolute;width:120%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--tint) 40%,transparent),transparent 65%);filter:blur(10px)}
.nr-res-bottle{position:relative;height:min(56vh,520px);width:auto;aspect-ratio:400/640}
.nr .nr-liq{transition:transform 2.4s var(--nr-out)}

/* collection */
.nr-coll{padding:170px 0 120px;background:var(--nr-black);border-top:1px solid var(--nr-line)}
.nr-rows{margin-top:70px;border-top:1px solid var(--nr-line)}
.nr-row{position:relative;display:grid;grid-template-columns:80px minmax(0,1.3fr) minmax(0,1.2fr) 150px;align-items:center;gap:24px;padding:34px 0;border-bottom:1px solid var(--nr-line);transition:padding .6s var(--nr-out)}
.nr-row .no{font-size:11px;letter-spacing:.3em;color:var(--nr-amber)}
.nr-row .nm{font-family:var(--nr-serif);font-style:italic;font-size:clamp(2.4rem,6.4vw,6rem);line-height:.95;letter-spacing:-.03em;transition:color .4s,transform .7s var(--nr-out)}
.nr-row .nt{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--nr-mute)}
.nr-row .pr{text-align:right;font-family:var(--nr-serif);font-size:1.7rem}
.nr-row .pr small{display:block;font-family:var(--nr-sans);font-size:10px;letter-spacing:.24em;color:var(--nr-mute);text-transform:uppercase}
.nr-row .bt{position:absolute;right:190px;top:50%;width:62px;margin-top:-52px;opacity:0;transform:translate3d(0,24px,0) rotate(6deg);transition:opacity .5s,transform .8s var(--nr-out);pointer-events:none}
.nr-row:hover .nm,.nr-row:focus-visible .nm{color:var(--tint);transform:translate3d(18px,0,0)}
.nr-row:hover .bt,.nr-row:focus-visible .bt{opacity:1;transform:none}

/* footer */
.nr-foot{position:relative;padding:110px 0 0;background:var(--nr-black);border-top:1px solid var(--nr-line);overflow:hidden}
.nr-foot-grid{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:60px}
.nr-foot-p{margin-top:16px;font-family:var(--nr-serif);font-style:italic;font-size:1.7rem;line-height:1.2;max-width:15em}
.nr-sub{display:flex;margin-top:26px;max-width:440px;border-bottom:1px solid var(--nr-bone)}
.nr-sub input{flex:1;min-width:0;height:48px;font-size:15px}.nr-sub input::placeholder{color:#6f6a62}
.nr-sub button{font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--nr-amber);padding-left:16px}
.nr-thanks{height:48px;display:flex;align-items:center;color:var(--nr-amber);font-family:var(--nr-serif);font-style:italic;font-size:1.2rem}
.nr-foot address{margin-top:16px;color:var(--nr-mute);line-height:1.9}
.nr-foot-links{margin-top:16px;display:grid;gap:6px}.nr-foot-links a{color:var(--nr-mute);transition:color .3s}.nr-foot-links a:hover{color:var(--nr-amber)}
.nr-giant{margin-top:70px;text-align:center;font-family:var(--nr-serif);font-style:italic;font-weight:300;font-size:clamp(7rem,30vw,32rem);line-height:.74;letter-spacing:-.05em;white-space:nowrap;color:transparent;-webkit-text-stroke:1px rgba(233,226,211,.22);background:linear-gradient(180deg,rgba(224,160,74,.5),transparent 70%);-webkit-background-clip:text;background-clip:text;padding-bottom:.02em;height:.62em;overflow:hidden}
.nr-legal{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-top:22px;padding-bottom:30px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6f6a62;border-top:1px solid var(--nr-line);position:relative;background:var(--nr-black)}

/* responsive */
@media (max-width:900px){
 .nr-wrap,.nr-nav,.nr-hero-in,.nr-hero-foot,.nr-man-stick,.nr-quiz-in{padding-left:22px;padding-right:22px}
 .nr-nav{grid-template-columns:1fr auto;padding-top:16px;padding-bottom:16px}.nr-nav-links{display:none}.nr-logo{font-size:21px}
 .nr-hero-hint{display:none}.nr-hero-in{bottom:19vh}
 .nr-cap{max-width:none;left:22px!important;right:22px!important;text-align:left!important}
 .nr-cap.t,.nr-cap.m,.nr-cap.b{top:auto;bottom:7vh}
 .nr-cap p{font-size:14px}
 .nr-flacon{height:min(56vh,520px);margin-top:-10vh}
 .nr-panel{padding:0 22px;align-items:flex-start;padding-top:15vh}
 .nr-orb{opacity:.7;right:-20vw;width:70vw;margin-top:-10vh}
 .nr-panel ul{margin-top:20px}.nr-panel li{padding:11px 0;flex-direction:column;gap:2px}.nr-panel li small{text-align:left}
 .nr-pline{margin-top:12px}
 .nr-tl{left:22px;right:22px;bottom:20px}.nr-tl-labels{font-size:9px;letter-spacing:.12em}.nr-tl-labels span:not(.on){opacity:.5}
 .nr-quiz{height:auto}.nr-quiz-stick{position:static;height:auto;min-height:100svh;padding:90px 0 70px}
 .nr-opts{grid-template-columns:1fr;margin-top:26px}.nr-opt{padding:15px 0}
 .nr-res{grid-template-columns:1fr;gap:30px}.nr-res-bottle{height:240px}.nr-res-r{order:-1}
 .nr-res-notes{grid-template-columns:1fr 1fr 1fr;gap:10px}.nr-res-notes span{font-size:.95rem}
 .nr-coll{padding:110px 0 80px}
 .nr-row{grid-template-columns:1fr auto;gap:6px 14px;padding:26px 0}.nr-row .no{grid-column:1/-1}.nr-row .nt{grid-column:1;grid-row:3}.nr-row .nm{grid-column:1;grid-row:2}.nr-row .pr{grid-column:2;grid-row:2/4;align-self:end}
 .nr-row .bt{right:84px;top:34px;margin:0;width:38px;opacity:.9;transform:none}
 .nr-foot-grid{grid-template-columns:1fr;gap:36px}
}
@media (min-width:901px) and (max-height:700px){
 .nr-quiz{height:auto}.nr-quiz-stick{position:static;height:auto;min-height:100vh;padding:80px 0}
}

@media (prefers-reduced-motion:reduce){
 .nr *{animation:none!important}
 .nr-curtain{display:none}
 .nr-ln span,.nr-kicker,.nr-hero-foot{transform:none!important;opacity:1!important}
 .nr.nr-js [data-rv]{opacity:1;transform:none;transition:none}
 .nr-man{height:auto;padding:120px 0}.nr-man-stick{position:static;height:auto}.nr-man-p span{opacity:1!important;transform:none!important}
 .nr-bot{height:auto;padding:80px 0 100px}.nr-bot-stick{position:static;height:auto;display:block;overflow:visible;padding:0 48px}
 .nr-flacon{display:block;margin:0 auto 50px}
 .nr-cap{position:static;opacity:1!important;transform:none!important;max-width:560px;margin:0 auto 34px;text-align:left!important}
 .nr-bgword{display:none}
 .nr-notes{height:auto}.nr-notes-stick{position:static;height:auto;overflow:visible}
 .nr-atm{display:none}.nr-track{position:static;width:100%;flex-direction:column;transform:none!important}
 .nr-panel{flex:none;height:auto;min-height:100vh;padding-top:12vh;padding-bottom:12vh;background:radial-gradient(70% 70% at 72% 50%,color-mix(in srgb,var(--atm) 24%,transparent),transparent 70%)}
 .nr-gw,.nr-pbody{transform:none!important;opacity:1!important}.nr-tl{display:none}
 .nr-quiz{height:auto}.nr-quiz-stick{position:static;height:auto;min-height:100vh;padding:100px 0}
 .nr-res-name span{opacity:1;transform:none;transition:none}.nr-bars i{transform:scaleX(1);transition:none}
 .nr-res-d,.nr-res-notes,.nr-res-cta{opacity:1;transition:none}.nr .nr-liq{transition:none}
}
`;
