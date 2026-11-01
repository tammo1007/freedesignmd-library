/**
 * Selene — a lunar base for research and quiet.
 *
 * A cold, silent, spacious landing page for a fictional lunar-hospitality
 * operator. Hero and crater-rim use one photographic render (/img/space/moon-base*.webp);
 * the rest is procedural (canvas + inline SVG + CSS). No web fonts, no network.
 *
 * Motion (one rAF loop reads scroll progress of each `[data-sel-p]` wrapper and
 * writes a `--p` CSS variable; visuals are transform/opacity only):
 *  - Hero: a photographic lunar-base render that pushes in with scroll, a scrim
 *    for contrast, and a 1/6-g cursor: the title letters drift away from the
 *    pointer on underdamped springs and the pointer kicks up regolith that arcs
 *    slowly back down.
 *  - Statement: words light up like sunrise creeping across a plain.
 *  - Crater rim: a pinned push-in on the crater wall (same image, cropped), depth/temperature counters.
 *  - Lunar day: 29.5 days scrubbed by scroll — the sun walks its arc, shadows
 *    swing and stretch, panels glow gold, Earth cycles through its phases.
 *  - Configurator: modules drop in on a slow 1/6-g ease, puff dust, link with tubes.
 *  - Earth window: a porthole with a live-rotating, phase-lit Earth.
 *  - Crew cards that float up and settle slowly; a seat-manifest booking form.
 *
 * Reduced motion: no pinning, no physics, no autoplay; the page renders a
 * complete static composition. SSR-safe: window/document only inside effects.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";

/* ------------------------------------------------------------------ */
/* Pure helpers (module scope is deterministic: SSR == client)         */
/* ------------------------------------------------------------------ */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

function h1(i: number) {
  let h = Math.imul(i | 0, 374761393) ^ 0x9e3779b1;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn1(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const s = smooth(f);
  return h1(i) * (1 - s) + h1(i + 1) * s;
}
function h3(x: number, y: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = smooth(x - xi), fy = smooth(y - yi), fz = smooth(z - zi);
  const c = (a: number, b: number, d: number) => h3(xi + a, yi + b, zi + d);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), fx), x10 = lerp(c(0, 1, 0), c(1, 1, 0), fx);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), fx), x11 = lerp(c(0, 1, 1), c(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}
function fbm3(x: number, y: number, z: number, o: number) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < o; i++) {
    s += a * vn3(x * f, y * f, z * f);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

function paintStars(cv: HTMLCanvasElement, seed: number, n: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const W = Math.max(1, Math.round(cv.clientWidth * dpr));
  const H = Math.max(1, Math.round(cv.clientHeight * dpr));
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const band = r() < 0.35;
    let x = r() * W;
    let y = r() * H;
    if (band) {
      const t = r();
      x = t * W;
      y = H * (0.75 - t * 0.6) + (r() - 0.5) * H * 0.22;
    }
    const s = r();
    const size = (s > 0.97 ? 1.8 : s > 0.85 ? 1.2 : 0.8) * dpr;
    const a = band ? 0.18 + r() * 0.35 : 0.3 + r() * 0.7;
    const hue = r();
    ctx.fillStyle =
      hue > 0.9 ? `rgba(190,215,255,${a})` : hue > 0.8 ? `rgba(255,236,205,${a})` : `rgba(236,238,239,${a})`;
    ctx.fillRect(x, y, size, size);
  }
}

function StarCanvas({ seed, n, className }: { seed: number; n: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let t = 0;
    const run = () => paintStars(cv, seed, n);
    run();
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(run, 120);
    });
    ro.observe(cv);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [seed, n]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Procedural Earth (sphere-sampled from a seamless noise texture)     */
/* ------------------------------------------------------------------ */
const TW = 384, TH = 192;
let EARTH_TEX: { r: Uint8Array; g: Uint8Array; b: Uint8Array; c: Uint8Array } | null = null;
function earthTex() {
  if (EARTH_TEX) return EARTH_TEX;
  const r = new Uint8Array(TW * TH), g = new Uint8Array(TW * TH), b = new Uint8Array(TW * TH), c = new Uint8Array(TW * TH);
  for (let j = 0; j < TH; j++) {
    const lat = (0.5 - (j + 0.5) / TH) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < TW; i++) {
      const lon = ((i + 0.5) / TW) * Math.PI * 2;
      const x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon);
      const n = fbm3(x * 2.1 + 9, y * 2.1 + 3, z * 2.1 + 5, 4);
      const t2 = fbm3(x * 4 + 1, y * 4 + 8, z * 4 + 2, 3);
      let R: number, G: number, B: number;
      if (Math.abs(lat) > 1.2 + (n - 0.5) * 0.35) {
        R = 232; G = 238; B = 244;
      } else if (n > 0.53) {
        const k = clamp((t2 - 0.35) / 0.3);
        R = lerp(62, 150, k); G = lerp(112, 134, k); B = lerp(72, 92, k);
        if (Math.abs(lat) < 0.38 && t2 > 0.6) { R = 168; G = 148; B = 96; }
      } else {
        const d = clamp((0.53 - n) / 0.18);
        R = lerp(52, 12, d); G = lerp(128, 52, d); B = lerp(150, 112, d);
      }
      const cn = fbm3(x * 3.1 + 40, y * 3.6 + 12, z * 3.1 + 21, 4);
      const cc = smooth(clamp((cn - 0.5) / 0.2));
      const idx = j * TW + i;
      r[idx] = R; g[idx] = G; b[idx] = B; c[idx] = cc * 235;
    }
  }
  EARTH_TEX = { r, g, b, c };
  return EARTH_TEX;
}

type EGeo = { S: number; ty: Uint16Array; lf: Float32Array; nx: Float32Array; nz: Float32Array; rim: Float32Array; al: Uint8Array };
const EGEO = new Map<number, EGeo>();
function earthGeo(S: number): EGeo {
  const have = EGEO.get(S);
  if (have) return have;
  const N = S * S;
  const geo: EGeo = {
    S, ty: new Uint16Array(N), lf: new Float32Array(N), nx: new Float32Array(N), nz: new Float32Array(N),
    rim: new Float32Array(N), al: new Uint8Array(N),
  };
  const R = S / 2;
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const nx = (px + 0.5) / R - 1, ny = 1 - (py + 0.5) / R;
      const r2 = nx * nx + ny * ny;
      const k = py * S + px;
      if (r2 >= 1) continue;
      const nz = Math.sqrt(1 - r2);
      geo.nx[k] = nx; geo.nz[k] = nz;
      geo.lf[k] = Math.atan2(nz, nx) / (Math.PI * 2);
      geo.ty[k] = Math.min(TH - 1, Math.floor((0.5 - Math.asin(ny) / Math.PI) * TH));
      geo.rim[k] = Math.pow(1 - nz, 3);
      geo.al[k] = clamp((1 - Math.sqrt(r2)) * R * 1.1, 0, 1) * 255;
    }
  }
  EGEO.set(S, geo);
  return geo;
}

/** alpha = phase angle: 0 full, PI/2 half, PI new. Lit side is on the right while alpha<PI. */
function drawEarth(cv: HTMLCanvasElement, S: number, rot: number, alpha: number) {
  const tex = earthTex();
  const geo = earthGeo(S);
  if (cv.width !== S || cv.height !== S) { cv.width = S; cv.height = S; }
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const holder = cv as HTMLCanvasElement & { __img?: ImageData };
  const img = holder.__img && holder.__img.width === S ? holder.__img : (holder.__img = ctx.createImageData(S, S));
  const d = img.data;
  const Lx = Math.sin(alpha), Lz = Math.cos(alpha);
  const off = rot / (Math.PI * 2);
  for (let k = 0; k < S * S; k++) {
    const a = geo.al[k];
    const o = k * 4;
    if (a === 0) { d[o + 3] = 0; continue; }
    let u = geo.lf[k] + off;
    u -= Math.floor(u);
    const ti = geo.ty[k] * TW + Math.min(TW - 1, (u * TW) | 0);
    const cc = tex.c[ti] / 255;
    let R = tex.r[ti], G = tex.g[ti], B = tex.b[ti];
    R += (238 - R) * cc; G += (242 - G) * cc; B += (248 - B) * cc;
    const dl = geo.nx[k] * Lx + geo.nz[k] * Lz;
    const t = smooth(clamp((dl + 0.08) / 0.5));
    const sh = 0.035 + 0.965 * t;
    const rim = geo.rim[k] * (0.22 + 0.95 * t);
    d[o] = Math.min(255, R * sh + rim * 120);
    d[o + 1] = Math.min(255, G * sh + rim * 170);
    d[o + 2] = Math.min(255, B * sh + rim * 255);
    d[o + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
}

/** Earth phase angle seen from the near side, given days since local sunrise. */
const earthAlpha = (day: number) => (((7.4 + day) / 29.53) % 1) * Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */
const NAV = [
  ["Rim", "#sel-rim"],
  ["Lunar day", "#sel-day"],
  ["Modules", "#sel-modules"],
  ["Crew", "#sel-crew"],
  ["Manifest", "#sel-manifest"],
] as const;

const STATEMENT =
  "There is no weather here. No wind to carry sound, no cloud to hide the stars. Selene is a station built for stillness, for research and for the long view — four hundred thousand kilometres from the nearest inbox.";

const STEPS_RIM = [
  { k: "01", t: "The landing rim", d: "Pads are cut into the lip of the crater, in sunlight for 89 percent of the year. Guests arrive in daylight, the descent is felt as a slow exhale.", depth: "0 m", temp: "+54 °C" },
  { k: "02", t: "Over the lip", d: "A heated gallery runs 400 metres inside the rim, where the temperature holds near −20 °C and the Earth never leaves the window.", depth: "−140 m", temp: "−20 °C" },
  { k: "03", t: "The cold trap", d: "On the floor, sunlight has not arrived in two billion years. Our crews cut water ice at 40 K, the quietest place we know of.", depth: "−412 m", temp: "−233 °C" },
];

const PHASES = [
  { n: "Dawn", r: "D+00 to D+02", d: "Sunlight arrives sideways. Shadows run twenty times the height of a person and the array unfolds, panel by panel." },
  { n: "Long day", r: "D+03 to D+12", d: "The regolith reaches +106 °C. Work happens in the shaded galleries; the greenhouse is fed by light piped down from the mast." },
  { n: "Dusk", r: "D+13 to D+15", d: "The sun slides along the horizon for two days. Everyone gathers at the west window for the last light." },
  { n: "Long night", r: "D+16 to D+29", d: "−173 °C and the stars all day. Earth hangs full overhead, about forty-three times brighter than a full Moon over your head at home." },
];

type ModKey = "hab" | "lab" | "gh" | "mast";
const MODS: { k: ModKey; name: string; x: number; line: string; beds: number; racks: number; food: number; kw: number }[] = [
  { k: "hab", name: "Habitat", x: 170, line: "Four private berths, a galley and the long window.", beds: 4, racks: 0, food: 0, kw: -6 },
  { k: "lab", name: "Laboratory", x: 345, line: "Eight instrument racks, a glovebox and a regolith bench.", beds: 0, racks: 8, food: 0, kw: -11 },
  { k: "gh", name: "Greenhouse", x: 535, line: "Forty kilos of fresh greens a week under piped sunlight.", beds: 0, racks: 0, food: 40, kw: -9 },
  { k: "mast", name: "Solar mast", x: 715, line: "A 26 kW gold-film array on a self-tracking mast.", beds: 0, racks: 0, food: 0, kw: 26 },
];

const LOOK: Record<string, string> = { p1: "a woman with a gray bob", p2: "a bearded man with dark hair", p3: "a woman with braided hair", p4: "a man with short curly hair", p5: "a smiling man with a short beard", p6: "a woman with long wavy dark hair", p7: "a bearded man in round glasses", p8: "a smiling man with swept-back hair", p9: "a woman with natural curly hair" };
const portraitAlt = (n: string, r: string, src: string) => `${n}, ${r}: portrait of ${LOOK[src.match(/p\d/)?.[0] ?? ""] ?? "a person"} in a black sweater`;

const CREW = [
  { n: "Dr. Imani Okafor", img: "/img/people/p9.webp", r: "Station director, geochemist", q: "People think the quiet is empty. It is the opposite: you can hear the whole station think.", s: "Moonwalks 63", tilt: -14 },
  { n: "Jonas Reiter", img: "/img/people/p7.webp", r: "Hospitality and life support", q: "I set the table for guests four hundred thousand kilometres from the nearest restaurant. Nobody has complained.", s: "Moonwalks 22", tilt: 8 },
  { n: "Ayaka Mori", img: "/img/people/p6.webp", r: "Greenhouse lead", q: "The first tomato of the month always goes to whoever has been looking at Earth the longest.", s: "Moonwalks 31", tilt: -4 },
  { n: "Cpt. Luis Ferreira", img: "/img/people/p4.webp", r: "Surface operations", q: "Walking is a kind of slow flying here. You learn to land softly and to take your time.", s: "Moonwalks 118", tilt: 16 },
];

const FLIGHTS = [
  { id: "SEL-2801", date: "08 MAR 2028", from: "Cislunar Gate A", transit: "3 d 06 h" },
  { id: "SEL-2802", date: "21 APR 2028", from: "Cislunar Gate A", transit: "3 d 04 h" },
  { id: "SEL-2803", date: "02 JUN 2028", from: "Cislunar Gate B", transit: "3 d 08 h" },
];
const STAYS = [
  { d: 7, name: "Seven days", note: "A short, bright week", price: 2400000 },
  { d: 14, name: "One lunar day", note: "Sunrise to sunset", price: 3900000 },
  { d: 29, name: "A full lunation", note: "Day, dusk and the long night", price: 6800000 },
];
const ROWS = [1, 2, 3, 4];
const COLS = ["A", "B", "C", "D"];
const TAKEN = new Set(["1B", "2A", "2D", "3C", "4A"]);
const eur = (n: number) => "€" + new Intl.NumberFormat("en-GB").format(n);

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */
function StationClock() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const f = () => setT(new Date().toISOString().slice(11, 19));
    f();
    const id = window.setInterval(f, 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span>{t}</span>;
}


/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export function Page() {
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const cycEarth = useRef<HTMLCanvasElement>(null);
  const cfgEarth = useRef<HTMLCanvasElement>(null);
  const cfgScene = useRef<HTMLCanvasElement>(null);
  const winEarth = useRef<HTMLCanvasElement>(null);
  const winBox = useRef<HTMLDivElement>(null);
  const dayRef = useRef(7);
  const [reduced, setReduced] = useState(false);
  const [mods, setMods] = useState<Record<ModKey, boolean>>({ hab: true, lab: false, gh: false, mast: true });
  const [winDay, setWinDay] = useState(19);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [rimIdx, setRimIdx] = useState(0);
  const [flight, setFlight] = useState(0);
  const [stay, setStay] = useState(1);
  const [seat, setSeat] = useState<string | null>("2C");
  const [name, setName] = useState("");
  const [cleared, setCleared] = useState(false);

  const words = useMemo(() => STATEMENT.split(" "), []);
  const stars = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 90 }, () => ({ x: r() * 800, y: r() * 300, s: 0.5 + r() * 1.2, o: 0.3 + r() * 0.7 }));
  }, []);
  const ridge = useMemo(() => {
    const pts: string[] = [];
    for (let x = 0; x <= 800; x += 16) pts.push(`${x},${(322 - vn1(x / 90 + 3) * 22 - Math.sin(x / 130) * 5).toFixed(1)}`);
    return `M0,346 L${pts.join(" L")} L800,346 Z`;
  }, []);
  const cfgStars = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: 70 }, () => ({ x: r() * 800, y: r() * 250, s: 0.5 + r() * 1.1 }));
  }, []);
  /* ---- reduced motion flag ---- */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  /* ---- scroll engine ---- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const q = (s: string) => root.querySelector<HTMLElement>(`[data-sel-out="${s}"]`);
    const pins = Array.from(root.querySelectorAll<HTMLElement>("[data-sel-p]"));
    const o = {
      elev: q("elev"), rise: q("rise"),
      depth: q("depth"), rtemp: q("rtemp"),
      day: q("day"), sun: q("sun"), temp: q("temp"), kw: q("kw"), kwbar: q("kwbar"), ephase: q("ephase"), elevd: q("elevd"),
      fill: q("fill"), thumb: q("thumb"),
    };
    const sunG = root.querySelector<SVGGElement>('[data-sel-svg="sun"]');
    const sh1 = root.querySelector<SVGPathElement>('[data-sel-svg="sh1"]');
    const sh2 = root.querySelector<SVGPathElement>('[data-sel-svg="sh2"]');
    const night = root.querySelector<SVGRectElement>('[data-sel-svg="night"]');
    const panels = root.querySelector<SVGGElement>('[data-sel-svg="panels"]');
    const last: Record<string, number> = {};
    let lastDay = -1, lastPhase = -1, lastRim = -1;
    let raf = 0;

    const cycle = (p: number) => {
      const day = p * 29.5;
      const isDay = day < 14.75;
      const a = isDay ? day / 14.75 : 0;
      const phi = Math.PI * a;
      const el = isDay ? Math.sin(phi) : 0;
      const elevAng = isDay ? (Math.PI / 2 - Math.abs(phi - Math.PI / 2)) : 0;
      if (sunG) {
        sunG.style.transform = `translate(${400 - Math.cos(phi) * 340}px, ${340 - Math.sin(phi) * 250}px)`;
        sunG.style.opacity = isDay ? "1" : "0";
      }
      const dir = Math.cos(phi) > 0 ? 1 : -1;
      const cot = 1 / Math.max(0.05, Math.tan(Math.max(0.03, elevAng)));
      if (sh1) {
        sh1.setAttribute("transform", `translate(250 346) scale(${dir * clamp(58 * cot, 6, 380)} 1)`);
        sh1.style.opacity = isDay ? String(clamp(el * 6, 0, 0.85)) : "0";
      }
      if (sh2) {
        sh2.setAttribute("transform", `translate(600 346) scale(${dir * clamp(104 * cot, 6, 420)} 1)`);
        sh2.style.opacity = isDay ? String(clamp(el * 6, 0, 0.8)) : "0";
      }
      const bright = isDay ? 0.3 + 0.7 * Math.pow(el, 0.6) : 0.09;
      if (night) night.style.opacity = String((1 - bright) * 0.9);
      if (panels) panels.style.opacity = String(isDay ? 0.25 + 0.75 * el : 0.12);
      const T = isDay ? -140 + 246 * Math.pow(Math.max(el, 0), 0.45) : -140 - 33 * smooth((day - 14.75) / 14.75);
      const kw = isDay ? 48 * Math.pow(el, 0.8) : 0;
      const dI = Math.min(29, Math.floor(day));
      if (o.day) o.day.textContent = "D+" + String(dI).padStart(2, "0");
      if (o.sun) o.sun.textContent = isDay ? "Rising" : "Below horizon";
      if (o.elevd) o.elevd.textContent = ((elevAng * 180) / Math.PI).toFixed(0) + "°";
      if (o.temp) o.temp.textContent = (T > 0 ? "+" : "−") + Math.abs(T).toFixed(0) + " °C";
      if (o.kw) o.kw.textContent = kw.toFixed(1) + " kW";
      if (o.kwbar) o.kwbar.style.transform = `scaleX(${(kw / 48).toFixed(3)})`;
      if (o.fill) o.fill.style.transform = `scaleX(${p.toFixed(4)})`;
      if (o.thumb) o.thumb.style.transform = `translateX(${(p * 100).toFixed(2)}cqw)`;
      const al = earthAlpha(day);
      if (o.ephase) o.ephase.textContent = ((1 + Math.cos(al)) * 50).toFixed(0) + "% lit";
      if (dI !== lastDay) {
        lastDay = dI;
        dayRef.current = dI;
        if (cycEarth.current) drawEarth(cycEarth.current, 160, 1.6 + dI * 0.2, al);
      }
      const ph = day < 2.5 ? 0 : day < 12.3 ? 1 : day < 15.6 ? 2 : 3;
      if (ph !== lastPhase) { lastPhase = ph; setPhaseIdx(ph); }
    };

    const frame = () => {
      raf = 0;
      const vh = window.innerHeight;
      const y = window.scrollY;
      if (navRef.current) navRef.current.classList.toggle("sel-solid", y > 40);
      for (const el of pins) {
        const id = el.dataset.selP || "";
        let p = 0;
        if (reducedRef.current) p = id === "hero" ? 0.72 : id === "cycle" ? 0.26 : id === "rim" ? 0.5 : 1;
        else {
          const r = el.getBoundingClientRect();
          p = clamp(-r.top / Math.max(1, r.height - vh));
        }
        if (last[id] !== undefined && Math.abs(last[id] - p) < 0.0004) continue;
        last[id] = p;
        el.style.setProperty("--p", p.toFixed(4));
        if (id === "hero") {
          if (o.elev) o.elev.textContent = (1.2 + p * 17.5).toFixed(1) + "°";
          if (o.rise) o.rise.textContent = Math.round(p * 100) + "%";
        } else if (id === "rim") {
          const k = Math.min(2, Math.floor(p * 3));
          if (k !== lastRim) { lastRim = k; setRimIdx(k); }
          if (o.depth) o.depth.textContent = "−" + Math.round(p * 412) + " m";
          if (o.rtemp) o.rtemp.textContent = (p < 0.2 ? "+" + Math.round(54 - p * 370) : "−" + Math.round(p * 233)) + " °C";
        } else if (id === "cycle") cycle(p);
      }
    };
    const reducedRef = { current: reduced };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    kick();
    return () => {
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  /* ---- reveal on view ---- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.add("sel-js");
    const els = Array.from(root.querySelectorAll<HTMLElement>(".sel-rv"));
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.12 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  /* ---- 1/6 g hero: floaty letters + ballistic regolith dust ---- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;
    const stick = root.querySelector<HTMLElement>(".sel-hero .sel-stick");
    const dust = root.querySelector<HTMLCanvasElement>(".sel-dust");
    if (!stick || !dust) return;
    const dctx = dust.getContext("2d");
    const els = Array.from(stick.querySelectorAll<HTMLElement>("[data-sel-float]"));
    const S = els.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0 }));
    const home = els.map(() => ({ x: 0, y: 0 }));
    let parts: { x: number; y: number; vx: number; vy: number; l: number; s: number }[] = [];
    let raf = 0, last = 0, lx = -1, ly = -1;
    const size = () => {
      const r = stick.getBoundingClientRect();
      dust.width = Math.round(r.width);
      dust.height = Math.round(r.height);
    };
    size();
    const measure = () =>
      els.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        home[i].x = r.left + r.width / 2 - S[i].x;
        home[i].y = r.top + r.height / 2 - S[i].y;
      });
    const spawn = (x: number, y: number, n: number, vx: number, vy: number) => {
      for (let i = 0; i < n; i++)
        parts.push({ x, y, vx: vx * 6 + (Math.random() - 0.5) * 90, vy: -(40 + Math.random() * 110) - Math.abs(vy) * 3, l: 1, s: 0.8 + Math.random() * 1.8 });
      if (parts.length > 220) parts = parts.slice(-220);
    };
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
      last = now;
      let moving = false;
      els.forEach((el, i) => {
        const s = S[i];
        const ax = -7 * s.x - 1.3 * s.vx;
        const ay = -7 * s.y - 1.3 * s.vy;
        const ar = -8 * s.r - 1.4 * s.vr;
        s.vx += ax * dt; s.vy += ay * dt; s.vr += ar * dt;
        s.x += s.vx * dt; s.y += s.vy * dt; s.r += s.vr * dt;
        if (Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.r) + Math.abs(s.vx) + Math.abs(s.vy) > 0.15) {
          moving = true;
          el.style.transform = `translate3d(${s.x.toFixed(2)}px,${s.y.toFixed(2)}px,0) rotate(${s.r.toFixed(2)}deg)`;
        } else if (s.x !== 0 || s.y !== 0 || s.r !== 0) {
          s.x = s.y = s.r = s.vx = s.vy = s.vr = 0;
          el.style.transform = "";
        }
      });
      if (dctx) {
        dctx.clearRect(0, 0, dust.width, dust.height);
        parts = parts.filter((p) => p.l > 0);
        for (const p of parts) {
          p.vy += 150 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt * 0.38;
          dctx.fillStyle = `rgba(206,200,190,${Math.max(0, p.l) * 0.7})`;
          dctx.fillRect(p.x, p.y, p.s, p.s);
        }
        if (parts.length) moving = true;
      }
      if (moving) raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    const onMove = (e: PointerEvent) => {
      if (lx < 0) { lx = e.clientX; ly = e.clientY; }
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      const sp = Math.min(60, Math.hypot(dx, dy));
      if (sp < 1) return;
      measure();
      els.forEach((_, i) => {
        const hx = home[i].x + S[i].x - e.clientX, hy = home[i].y + S[i].y - e.clientY;
        const dist = Math.hypot(hx, hy) || 1;
        if (dist > 180) return;
        const k = Math.pow(1 - dist / 180, 2) * sp;
        S[i].vx += (hx / dist) * k * 4;
        S[i].vy += (hy / dist) * k * 4 - k * 2.4;
        S[i].vr += (hx > 0 ? 1 : -1) * k * 1.2;
      });
      const r = stick.getBoundingClientRect();
      if (e.clientY - r.top > r.height * 0.6) spawn(e.clientX - r.left, e.clientY - r.top, Math.min(4, 1 + ((sp / 10) | 0)), dx * 0.2, dy);
      wake();
    };
    const onDown = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect();
      spawn(e.clientX - r.left, e.clientY - r.top, 26, 0, 4);
      wake();
    };
    const onLeave = () => { lx = -1; };
    stick.addEventListener("pointermove", onMove);
    stick.addEventListener("pointerdown", onDown);
    stick.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", size);
    return () => {
      stick.removeEventListener("pointermove", onMove);
      stick.removeEventListener("pointerdown", onDown);
      stick.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", size);
      if (raf) cancelAnimationFrame(raf);
      els.forEach((el) => (el.style.transform = ""));
    };
  }, [reduced]);

  /* ---- configurator Earth sprite ---- */
  useEffect(() => {
    if (cfgEarth.current) drawEarth(cfgEarth.current, 140, 4.1, 0.5);
  }, []);

  /* ---- Earth window: rotating, phase-lit ---- */
  const winDayRef = useRef(19);
  useEffect(() => {
    winDayRef.current = winDay;
    if (reduced && winEarth.current) drawEarth(winEarth.current, 300, 1.2, earthAlpha(winDay));
  }, [winDay, reduced]);
  useEffect(() => {
    const cv = winEarth.current;
    const box = winBox.current;
    if (!cv || !box) return;
    drawEarth(cv, 300, 1.2, earthAlpha(winDayRef.current));
    if (reduced) return;
    let vis = false, raf = 0, rot = 1.2, last = 0, acc = 0;
    const io = new IntersectionObserver((es) => {
      vis = es[0].isIntersecting;
      if (vis && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    });
    io.observe(box);
    function loop(now: number) {
      raf = 0;
      if (!vis || !cv) return;
      const dt = (now - last) / 1000;
      last = now;
      acc += dt;
      rot += dt * 0.35;
      if (acc > 0.05) { acc = 0; drawEarth(cv, 300, rot, earthAlpha(winDayRef.current)); }
      raf = requestAnimationFrame(loop);
    }
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [reduced]);

  /* ---- derived: configurator totals, booking ---- */
  const tot = MODS.reduce(
    (a, m) => (mods[m.k] ? { beds: a.beds + m.beds, racks: a.racks + m.racks, food: a.food + m.food, kw: a.kw + m.kw } : a),
    { beds: 0, racks: 0, food: 0, kw: 0 },
  );
  const supply = mods.mast ? 26 : 0;
  const demand = MODS.reduce((a, m) => (mods[m.k] && m.kw < 0 ? a - m.kw : a), 0);
  const present = MODS.filter((m) => mods[m.k]);
  const toggle = (k: ModKey) => setMods((s) => ({ ...s, [k]: !s[k] }));
  const preset = (p: "retreat" | "research" | "station") =>
    setMods(p === "retreat" ? { hab: true, lab: false, gh: true, mast: true } : p === "research" ? { hab: true, lab: true, gh: false, mast: true } : { hab: true, lab: true, gh: true, mast: true });

  const fl = FLIGHTS[flight], st = STAYS[stay];
  const seatPrice = seat && (seat.endsWith("A") || seat.endsWith("D")) ? 180000 : 0;
  const total = st.price + seatPrice;
  const ref = useMemo(() => {
    let h = 7;
    for (const ch of name + fl.id + (seat || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return "M-" + h.toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
  }, [name, fl.id, seat]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && seat) setCleared(true);
  };

  return (
    <div ref={rootRef} className={"sel-root" + (reduced ? " sel-rm" : "")}>
      <style>{CSS}</style>

      {/* nav */}
      <nav ref={navRef} className="sel-nav" aria-label="Primary">
        <a href="#sel-top" className="sel-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M12 2a10 10 0 0 0 0 20a6.5 10 0 0 1 0-20z" fill="currentColor" />
          </svg>
          Selene
        </a>
        <div className="sel-links">
          {NAV.map(([l, h]) => (
            <a key={h} href={h}>{l}</a>
          ))}
        </div>
        <a className="sel-btn sel-btn-sm" href="#sel-manifest">Reserve a seat</a>
      </nav>

      {/* ============ HERO ============ */}
      <header id="sel-top" className="sel-hero sel-pin" data-sel-p="hero">
        <div className="sel-stick">
          <div className="sel-photo" aria-hidden="false">
            <img
              className="sel-hero-img"
              src="/img/space/moon-base-1200.webp"
              srcSet="/img/space/moon-base-640.webp 640w, /img/space/moon-base-1200.webp 1200w, /img/space/moon-base.webp 1329w"
              sizes="100vw"
              width={1329}
              height={784}
              alt="Selene lunar base: grey habitat modules, a yellow flag and Earth above the crater rim"
              fetchPriority="high"
              loading="eager"
              decoding="async"
            />
          </div>
          <div className="sel-hero-scrim" aria-hidden="true" />
          <canvas className="sel-dust" aria-hidden="true" />

          <div className="sel-hero-copy">
            <p className="sel-eyebrow">Lunar hospitality and research · Sinus Medii, near side</p>
            <h1 className="sel-title" aria-label="Selene">
              {"SELENE".split("").map((c, i) => (
                <span key={i} className="sel-letter" data-sel-float aria-hidden="true">{c}</span>
              ))}
            </h1>
            <p className="sel-sub">
              A quiet place, 384,400 kilometres from anywhere. Stay a week, a lunar day, or the whole lunation.
            </p>
            <div className="sel-cta">
              <a className="sel-btn" href="#sel-manifest" data-sel-float>Reserve a seat</a>
              <a className="sel-ghost" href="#sel-rim">Descend to the rim</a>
            </div>
          </div>

          <div className="sel-rise" aria-hidden="true">Approach, 06:12 station time. The camera has closed {` `}
            <b data-sel-out="rise">0%</b> of the distance.</div>

          <dl className="sel-hud" aria-label="Station readout">
            <div><dt>Station time (UTC)</dt><dd><StationClock /></dd></div>
            <div><dt>Earth elevation</dt><dd data-sel-out="elev">1.2°</dd></div>
            <div><dt>Gravity</dt><dd>0.166 g</dd></div>
            <div><dt>Light delay</dt><dd>1.28 s</dd></div>
          </dl>
          <div className="sel-cue" aria-hidden="true"><span>Scroll</span><i /></div>
        </div>
      </header>

      {/* ============ STATEMENT ============ */}
      <section className="sel-statement sel-pin" data-sel-p="statement" aria-label="Why Selene">
        <div className="sel-stick sel-center">
          <p className="sel-big">
            {words.map((w, i) => (
              <span key={i} className="sel-word" style={{ "--w": (i / words.length).toFixed(3) } as CSSProperties}>{w} </span>
            ))}
          </p>
          <div className="sel-stats">
            {[
              ["1.28 s", "light delay to Earth"],
              ["0.166 g", "six times lighter on your feet"],
              ["14 days", "of unbroken sunlight"],
              ["0 m/s", "of wind, ever"],
            ].map(([a, b]) => (
              <div key={a} className="sel-stat"><b>{a}</b><span>{b}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CRATER RIM ============ */}
      <section id="sel-rim" className="sel-rim sel-pin" data-sel-p="rim" aria-label="Crater rim descent">
        <div className="sel-stick">
          <div className="sel-rimphoto">
            <img
              className="sel-rim-img"
              src="/img/space/moon-base-1200.webp"
              srcSet="/img/space/moon-base-640.webp 640w, /img/space/moon-base-1200.webp 1200w, /img/space/moon-base.webp 1329w"
              sizes="100vw"
              width={1329}
              height={784}
              alt="Layered crater rim and vehicle tracks across grey regolith beside the Selene habitat modules"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="sel-scrim" />
          <div className="sel-rim-head">
            <p className="sel-eyebrow">01 · The rim</p>
            <h2 className="sel-h2">Arrive over a crater lip.<br />Descend into silence.</h2>
          </div>
          <ol className="sel-steps">
            {STEPS_RIM.map((s, i) => (
              <li key={s.k} className={"sel-step" + (rimIdx === i ? " on" : "")}>
                <span className="sel-k">{s.k}</span>
                <div><h3>{s.t}</h3><p>{s.d}</p></div>
              </li>
            ))}
          </ol>
          <dl className="sel-hud sel-hud-r" aria-label="Descent readout">
            <div><dt>Depth</dt><dd data-sel-out="depth">−0 m</dd></div>
            <div><dt>Surface</dt><dd data-sel-out="rtemp">+54 °C</dd></div>
          </dl>
        </div>
      </section>

      {/* ============ LUNAR DAY ============ */}
      <section id="sel-day" className="sel-cycle sel-pin" data-sel-p="cycle" aria-label="The lunar day">
        <div className="sel-stick sel-cyc-stick">
          <div className="sel-cyc-head">
            <p className="sel-eyebrow">02 · The lunar day</p>
            <h2 className="sel-h2">Fourteen days of light.<br />Fourteen of stars.</h2>
          </div>
          <div className="sel-cyc-grid">
            <div className="sel-scene">
              <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Sun crossing a black lunar sky above the station, shadows swinging with it">
                <defs>
                  <linearGradient id="sel-gnd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#9a9791" />
                    <stop offset="1" stopColor="#2b2c2f" />
                  </linearGradient>
                  <radialGradient id="sel-glow">
                    <stop offset="0" stopColor="#fff6dc" stopOpacity=".55" />
                    <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="sel-gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fbe29a" />
                    <stop offset="1" stopColor="#c58f21" />
                  </linearGradient>
                  <linearGradient id="sel-dome" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#8d9399" />
                    <stop offset="1" stopColor="#f4f6f7" />
                  </linearGradient>
                </defs>
                <rect width="800" height="450" fill="#040507" />
                {stars.map((s, i) => (<circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#eceeef" opacity={s.o} />))}
                <g data-sel-svg="sun" style={{ transform: "translate(60px, 340px)" }}>
                  <circle r="64" fill="url(#sel-glow)" />
                  <circle r="13" fill="#fff7e0" />
                </g>
                <path d={ridge} fill="#55595e" />
                <rect y="340" width="800" height="110" fill="url(#sel-gnd)" />
                <g data-sel-svg="panels" opacity=".6">
                  {[0, 1, 2, 3].map((i) => (
                    <polygon key={i} points={`${430 + i * 58},356 ${480 + i * 58},356 ${492 + i * 58},384 ${440 + i * 58},384`} fill="url(#sel-gold)" />
                  ))}
                  {[0, 1, 2, 3].map((i) => (
                    <path key={i} d={`M${455 + i * 58} 356 L${466 + i * 58} 384`} stroke="#8a6416" strokeWidth=".8" opacity=".6" />
                  ))}
                </g>
                <path data-sel-svg="sh1" d="M0 -2 L1 2 L1 9 L0 11Z" fill="#000" transform="translate(250 346) scale(120 1)" opacity=".5" />
                <path data-sel-svg="sh2" d="M0 -1 L1 1 L1 4 L0 4Z" fill="#000" transform="translate(600 346) scale(180 1)" opacity=".5" />
                <path d="M196 346a54 58 0 0 1 108 0z" fill="url(#sel-dome)" />
                <path d="M196 346a54 58 0 0 1 108 0" fill="none" stroke="#fff" strokeOpacity=".25" />
                <rect x="241" y="320" width="18" height="26" rx="2" fill="#2a2e33" />
                <rect x="212" y="322" width="9" height="5" rx="1" fill="#1b222b" />
                <rect x="279" y="322" width="9" height="5" rx="1" fill="#1b222b" />
                <rect x="598" y="242" width="4" height="104" fill="#b9bdc2" />
                <polygon points="570,246 630,236 634,256 574,266" fill="url(#sel-gold)" />
                <rect data-sel-svg="night" y="300" width="800" height="150" fill="#030405" opacity=".4" />
              </svg>
              <canvas ref={cycEarth} className="sel-cyc-earth" aria-hidden="true" />
              <span className="sel-cap">Window cam 3 · Earth stays put in the sky; the sun walks around it</span>
            </div>
            <div className="sel-cyc-side">
              <dl className="sel-readouts">
                <div><dt>Day</dt><dd data-sel-out="day">D+00</dd></div>
                <div><dt>Sun elevation</dt><dd data-sel-out="elevd">0°</dd></div>
                <div><dt>Surface</dt><dd data-sel-out="temp">−140 °C</dd></div>
                <div><dt>Earth</dt><dd data-sel-out="ephase">50% lit</dd></div>
                <div className="sel-wide"><dt>Solar yield <b data-sel-out="kw">0.0 kW</b></dt><dd><span className="sel-meter"><i data-sel-out="kwbar" /></span></dd></div>
              </dl>
              <ul className="sel-phases">
                {PHASES.map((p, i) => (
                  <li key={p.n} className={"sel-phase" + (phaseIdx === i ? " on" : "")}>
                    <h3>{p.n} <span>{p.r}</span></h3>
                    <p>{p.d}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="sel-timeline" aria-hidden="true">
            <div className="sel-tl-labels"><span>Dawn</span><span>Long day</span><span>Dusk</span><span>Long night</span></div>
            <div className="sel-tl-bar"><i data-sel-out="fill" /><b data-sel-out="thumb" /></div>
          </div>
        </div>
      </section>

      {/* ============ MODULES ============ */}
      <section id="sel-modules" className="sel-sec" aria-label="Module configurator">
        <div className="sel-wrap">
          <div className="sel-sec-head sel-rv">
            <p className="sel-eyebrow">03 · Build your stay</p>
            <h2 className="sel-h2">Modules are lowered, slowly,<br />onto the regolith.</h2>
            <p className="sel-lead">Choose what your party needs. Everything is delivered in advance by the cargo lander and linked before you arrive.</p>
          </div>
          <div className="sel-cfg">
            <div className="sel-cfg-scene sel-rv">
              <svg viewBox="0 0 800 420" role="img" aria-label="Modules assembled on the lunar surface" preserveAspectRatio="xMidYMax meet">
                <defs>
                  <linearGradient id="sel-g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8d8a84" /><stop offset="1" stopColor="#25262a" /></linearGradient>
                  <linearGradient id="sel-m1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7d838a" /><stop offset="1" stopColor="#f4f6f7" /></linearGradient>
                  <linearGradient id="sel-m2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5f666d" /><stop offset="1" stopColor="#d9dde0" /></linearGradient>
                  <linearGradient id="sel-gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4e8f6a" stopOpacity=".55" /><stop offset="1" stopColor="#3f7fb8" stopOpacity=".35" /></linearGradient>
                  <linearGradient id="sel-g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbe29a" /><stop offset="1" stopColor="#c58f21" /></linearGradient>
                </defs>
                <rect width="800" height="420" fill="#040507" />
                {cfgStars.map((s, i) => (<circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#eceeef" opacity=".7" />))}
                <path d="M0 330 L0 300 Q90 280 170 296 T330 290 T520 298 T700 284 L800 296 L800 330Z" fill="#43474c" />
                <rect y="330" width="800" height="90" fill="url(#sel-g2)" />
                {present.slice(0, -1).map((m, i) => (
                  <line key={m.k + present[i + 1].k} className="sel-tube" x1={m.x} y1="316" x2={present[i + 1].x} y2="316" />
                ))}
                {MODS.map((m) => (
                  <g key={m.k} className={"sel-mod" + (mods[m.k] ? " on" : "")} style={{ "--x": m.x + "px" } as CSSProperties}>
                    <polygon className="sel-sh" points="-40,0 -250,3 -258,12 40,14" />
                    {m.k === "hab" && (
                      <g>
                        <path d="M-72 0v-40a72 40 0 0 1 144 0v40z" fill="url(#sel-m1)" />
                        <path d="M-72 -40a72 40 0 0 1 144 0" fill="none" stroke="#fff" strokeOpacity=".3" />
                        {[-44, -22, 0, 22, 44].map((x) => (<circle key={x} cx={x} cy="-26" r="4" fill="#12161b" />))}
                        <rect x="-8" y="-20" width="16" height="20" rx="2" fill="#2a2e33" />
                      </g>
                    )}
                    {m.k === "lab" && (
                      <g>
                        <rect x="-62" y="-62" width="124" height="62" rx="3" fill="url(#sel-m2)" />
                        <rect x="-62" y="-62" width="124" height="8" fill="#fff" opacity=".18" />
                        <path d="M-6 -62 v-30" stroke="#aeb3b8" strokeWidth="2" />
                        <path d="M-26 -92 q26 -22 52 0 q-26 -8 -52 0z" fill="#e8ebed" />
                        {[-40, -16, 8, 32].map((x) => (<rect key={x} x={x} y="-44" width="14" height="22" rx="1" fill="#12161b" />))}
                      </g>
                    )}
                    {m.k === "gh" && (
                      <g>
                        <path d="M-78 0v-26a78 56 0 0 1 156 0v26z" fill="url(#sel-gl)" stroke="#a9cfe0" strokeOpacity=".5" />
                        {[-52, -26, 0, 26, 52].map((x) => (
                          <g key={x}><path d={`M${x} 0 v-18`} stroke="#4e8f6a" strokeWidth="2" /><ellipse cx={x - 4} cy="-20" rx="6" ry="3" fill="#6fb287" /><ellipse cx={x + 4} cy="-24" rx="6" ry="3" fill="#4e8f6a" /></g>
                        ))}
                        <path d="M-78 -26a78 56 0 0 1 156 0" fill="none" stroke="#fff" strokeOpacity=".35" />
                      </g>
                    )}
                    {m.k === "mast" && (
                      <g>
                        <rect x="-3" y="-128" width="6" height="128" fill="#b9bdc2" />
                        <polygon points="-62,-132 -4,-146 -4,-96 -62,-84" fill="url(#sel-g3)" />
                        <polygon points="4,-146 62,-132 62,-84 4,-96" fill="url(#sel-g3)" />
                        <polygon points="4,-146 62,-132 62,-126 4,-140" fill="#fff" opacity=".35" />
                        <rect x="-18" y="-10" width="36" height="10" fill="#7d838a" />
                      </g>
                    )}
                    <ellipse className="sel-puff" cx="0" cy="4" rx="70" ry="8" />
                  </g>
                ))}
              </svg>
              <canvas ref={cfgEarth} className="sel-cfg-earth" aria-hidden="true" />
              <span className="sel-cap">{present.length} of 4 modules on site</span>
            </div>
            <div className="sel-cfg-panel sel-rv">
              <div className="sel-presets" role="group" aria-label="Presets">
                <button type="button" onClick={() => preset("retreat")}>Retreat</button>
                <button type="button" onClick={() => preset("research")}>Research</button>
                <button type="button" onClick={() => preset("station")}>Full station</button>
              </div>
              <div className="sel-modlist">
                {MODS.map((m) => (
                  <button key={m.k} type="button" className={"sel-modbtn" + (mods[m.k] ? " on" : "")} aria-pressed={mods[m.k]} onClick={() => toggle(m.k)}>
                    <span className="sel-tick" aria-hidden="true" />
                    <span><b>{m.name}</b><small>{m.line}</small></span>
                  </button>
                ))}
              </div>
              <div className="sel-totals" aria-live="polite">
                <div><b>{tot.beds}</b><span>berths</span></div>
                <div><b>{tot.racks}</b><span>instrument racks</span></div>
                <div><b>{tot.food}</b><span>kg greens / week</span></div>
              </div>
              <div className="sel-power">
                <div className="sel-power-row"><span>Demand</span><b>{demand} kW</b></div>
                <div className="sel-power-bar"><i style={{ transform: `scaleX(${clamp(demand / 40)})` }} /><u style={{ transform: `scaleX(${clamp(supply / 40)})` }} /></div>
                <div className="sel-power-row"><span>Solar supply</span><b className="sel-gold-t">{supply} kW</b></div>
                <p className={"sel-note" + (demand > supply ? " warn" : "")}>
                  {demand > supply ? "Demand exceeds supply. Add the solar mast, or the station runs on fuel cells at night only." : "Power is balanced. The night is carried by the regolith thermal store."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ EARTH WINDOW ============ */}
      <section id="sel-window" className="sel-sec sel-win" aria-label="Earth window">
        <div className="sel-wrap sel-win-grid">
          <div className="sel-rv">
            <p className="sel-eyebrow">04 · The window</p>
            <h2 className="sel-h2">The only view<br />you will never tire of.</h2>
            <p className="sel-lead">From the near side the Earth does not rise and set. It hangs in one place, turning once a day and passing through its phases every month. Move the slider to see the sky from any day of your stay.</p>
            <label className="sel-slider">
              <span>Lunar day <b>D+{String(winDay).padStart(2, "0")}</b></span>
              <input type="range" min={0} max={29} value={winDay} onChange={(e) => setWinDay(+e.target.value)} aria-label="Lunar day of your stay" />
            </label>
            <p className="sel-fine">Earth lit: {Math.round((1 + Math.cos(earthAlpha(winDay))) * 50)}%. Earthshine on the surface is about 43 times brighter than moonlight at home, enough to read by.</p>
          </div>
          <div className="sel-port-wrap sel-rv">
            <div ref={winBox} className="sel-port">
              <div className="sel-port-glass">
                <StarCanvas seed={33} n={160} className="sel-fill" />
                <canvas ref={winEarth} className="sel-port-earth" aria-label="The Earth, turning" role="img" />
                <svg className="sel-port-horizon" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 80V46q40-14 90-4t100-6q70 8 120-4t90 8V80z" fill="#121418" />
                  <path d="M0 52q60-6 110 2t120-2q70 2 170-6" stroke="#5b6066" strokeWidth="1" fill="none" opacity=".6" />
                </svg>
                <i className="sel-glare" />
              </div>
              <i className="sel-bolt sel-b1" /><i className="sel-bolt sel-b2" /><i className="sel-bolt sel-b3" /><i className="sel-bolt sel-b4" />
            </div>
            <span className="sel-cap">Window 2 · Earth 7.4° above the horizon · turning once every 24 hours</span>
          </div>
        </div>
      </section>

      {/* ============ CREW ============ */}
      <section id="sel-crew" className="sel-sec" aria-label="Mission crew">
        <div className="sel-wrap">
          <div className="sel-sec-head sel-rv">
            <p className="sel-eyebrow">05 · Mission crew</p>
            <h2 className="sel-h2">Four people who live<br />where you are visiting.</h2>
          </div>
          <div className="sel-crew">
            {CREW.map((c, i) => (
              <article key={c.n} className="sel-card sel-rv" style={{ "--d": i * 0.18 + "s" } as CSSProperties} tabIndex={0}>
                <img className="sel-visor" src={c.img} alt={portraitAlt(c.n, c.r.toLowerCase(), c.img)} width={112} height={112} loading="lazy" decoding="async" />
                <h3>{c.n}</h3>
                <p className="sel-role">{c.r}</p>
                <blockquote>{c.q}</blockquote>
                <p className="sel-stat-line">{c.s}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ MANIFEST ============ */}
      <section id="sel-manifest" className="sel-sec sel-man" aria-label="Seat manifest booking">
        <div className="sel-wrap">
          <div className="sel-sec-head sel-rv">
            <p className="sel-eyebrow">06 · Seat manifest</p>
            <h2 className="sel-h2">Take a seat on the next<br />transfer from Cislunar Gate.</h2>
          </div>
          <form className="sel-man-grid sel-rv" onSubmit={submit}>
            <div className="sel-man-form">
              <fieldset>
                <legend>1 · Departure</legend>
                <div className="sel-opts">
                  {FLIGHTS.map((f, i) => (
                    <label key={f.id} className={"sel-opt" + (flight === i ? " on" : "")}>
                      <input type="radio" name="flight" checked={flight === i} onChange={() => { setFlight(i); setCleared(false); }} />
                      <b>{f.date}</b><span>{f.id} · {f.from} · transit {f.transit}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>2 · Length of stay</legend>
                <div className="sel-opts sel-opts-3">
                  {STAYS.map((s, i) => (
                    <label key={s.d} className={"sel-opt" + (stay === i ? " on" : "")}>
                      <input type="radio" name="stay" checked={stay === i} onChange={() => { setStay(i); setCleared(false); }} />
                      <b>{s.name}</b><span>{s.note}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>3 · Seat <small>Window seats (A, D) face Earth</small></legend>
                <div className="sel-cabin" role="group" aria-label="Cabin seat map">
                  {ROWS.map((r) => (
                    <div key={r} className="sel-seatrow">
                      <em>{r}</em>
                      {COLS.map((c, ci) => {
                        const id = r + c;
                        const taken = TAKEN.has(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={taken}
                            aria-pressed={seat === id}
                            aria-label={`Seat ${id}${taken ? ", taken" : ""}${c === "A" || c === "D" ? ", window" : ""}`}
                            className={"sel-seat" + (seat === id ? " on" : "") + (ci === 1 ? " aisle" : "")}
                            onClick={() => { setSeat(id); setCleared(false); }}
                          >{c}</button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </fieldset>
              <label className="sel-field">
                <span>4 · Passenger name</span>
                <input value={name} onChange={(e) => { setName(e.target.value); setCleared(false); }} placeholder="As printed on your passport" autoComplete="name" required />
              </label>
              <button className="sel-btn" type="submit" disabled={!name.trim() || !seat}>Request clearance</button>
            </div>

            <aside className={"sel-pass" + (cleared ? " cleared" : "")} aria-live="polite" aria-label="Boarding manifest">
              <div className="sel-pass-top"><span>Selene Transfer Manifest</span><span>{fl.id}</span></div>
              <dl>
                <div><dt>Passenger</dt><dd>{name.trim() || "— — —"}</dd></div>
                <div><dt>Departs</dt><dd>{fl.date}</dd></div>
                <div><dt>From</dt><dd>{fl.from}</dd></div>
                <div><dt>Transit</dt><dd>{fl.transit}</dd></div>
                <div><dt>Seat</dt><dd>{seat || "—"}{seatPrice ? " · window" : ""}</dd></div>
                <div><dt>Stay</dt><dd>{st.name} · {st.d} d</dd></div>
                <div><dt>Mass allowance</dt><dd>23 kg + 4 kg personal</dd></div>
              </dl>
              <div className="sel-pass-bar" aria-hidden="true">
                {Array.from({ length: 44 }, (_, i) => (<i key={i} style={{ width: 1 + ((i * 7 + (name.length % 5)) % 4) + "px" }} />))}
              </div>
              <div className="sel-pass-total"><span>Total, all inclusive</span><b>{eur(total)}</b></div>
              <div className="sel-stamp" aria-hidden={!cleared}>
                <span>Cleared for transit</span>
                <small>{ref}</small>
              </div>
              <p className="sel-fine">{cleared ? `Thank you, ${name.trim().split(" ")[0]}. Your medical briefing arrives within 48 hours.` : "Clearance includes a 6-week conditioning programme and a medical review."}</p>
            </aside>
          </form>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="sel-foot">
        <div className="sel-wrap sel-foot-grid">
          <div>
            <div className="sel-foot-mark" aria-hidden="true">SELENE</div>
            <p className="sel-fine">2.4° N · 1.7° E · Sinus Medii, near side<br />Selene Lunar Hospitality is a fictional concept.</p>
          </div>
          <div className="sel-foot-cols">
            <div><h4>Stay</h4><a href="#sel-rim">Crater rim</a><a href="#sel-day">The lunar day</a><a href="#sel-modules">Modules</a></div>
            <div><h4>Station</h4><a href="#sel-crew">Crew</a><a href="#sel-window">Earth window</a><a href="#sel-manifest">Manifest</a></div>
            <div><h4>Contact</h4><a href="#sel-top">Press</a><a href="#sel-top">Research access</a><a href="#sel-top">Safety</a></div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Page;

/* ------------------------------------------------------------------ */
/* Styles (scoped under .sel-root)                                     */
/* ------------------------------------------------------------------ */
const CSS = `
.sel-root{
  --sel-void:#06070a; --sel-basalt:#0d0f12; --sel-reg1:#171a1e; --sel-reg2:#252a2f; --sel-reg3:#434950;
  --sel-reg4:#767c83; --sel-reg5:#a3a49f; --sel-ano:#eceeef; --sel-warm:#b7ae9c;
  --sel-blue:#3f7fb8; --sel-green:#4e8f6a; --sel-gold:#e3b24a; --sel-gold-hi:#fbe29a;
  --sel-sans:"Outfit","Jost","Avenir Next","Helvetica Neue",system-ui,-apple-system,"Segoe UI",sans-serif;
  --sel-mono:"JetBrains Mono","SF Mono",ui-monospace,Menlo,Consolas,monospace;
  --sel-serif:"Iowan Old Style","Palatino Linotype",Georgia,serif;
  --sel-slow:cubic-bezier(.16,.84,.3,1);
  font:300 16px/1.6 var(--sel-sans); color:var(--sel-ano); background:var(--sel-void);
  box-sizing:border-box; overflow-x:clip; -webkit-font-smoothing:antialiased; position:relative;
}
.sel-root *,.sel-root *::before,.sel-root *::after{box-sizing:border-box}
.sel-root a{color:inherit;text-decoration:none}
.sel-root h1,.sel-root h2,.sel-root h3,.sel-root h4,.sel-root p,.sel-root dl,.sel-root dd,.sel-root ol,.sel-root ul,.sel-root blockquote,.sel-root fieldset{margin:0;padding:0}
.sel-root ol,.sel-root ul{list-style:none}
.sel-root button,.sel-root input{font:inherit;color:inherit}
.sel-root :focus-visible{outline:2px solid var(--sel-gold);outline-offset:3px}
.sel-wrap{width:min(1180px,100% - 48px);margin:0 auto}
.sel-fill{position:absolute;inset:0;width:100%;height:100%;display:block}
.sel-eyebrow{font:400 11px/1.4 var(--sel-mono);letter-spacing:.2em;text-transform:uppercase;color:#cfd0cc;text-shadow:0 1px 10px rgba(0,0,0,.7)}
.sel-h2{font:200 clamp(32px,5.2vw,68px)/1.06 var(--sel-sans);letter-spacing:-.01em;margin-top:14px}
.sel-lead{font-size:clamp(16px,1.5vw,19px);color:var(--sel-reg5);max-width:46ch;margin-top:20px}
.sel-fine{font:400 12px/1.6 var(--sel-mono);color:var(--sel-reg4);margin-top:16px;letter-spacing:.02em}
.sel-cap{display:block;font:400 11px/1.4 var(--sel-mono);color:var(--sel-reg4);letter-spacing:.06em;margin-top:12px}
.sel-gold-t{color:var(--sel-gold)}

/* buttons */
.sel-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:var(--sel-gold);color:#14100a;font:500 13px/1 var(--sel-mono);letter-spacing:.12em;text-transform:uppercase;padding:17px 26px;border:0;border-radius:2px;cursor:pointer;transition:transform 1.4s var(--sel-slow),background .4s,box-shadow 1.4s var(--sel-slow);box-shadow:0 0 0 0 rgba(227,178,74,0)}
.sel-btn:hover{transform:translateY(-4px);background:var(--sel-gold-hi);box-shadow:0 18px 40px -18px rgba(227,178,74,.55)}
.sel-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.sel-btn-sm{padding:11px 16px;font-size:11px}
.sel-ghost{font:400 12px/1 var(--sel-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--sel-ano);padding:17px 8px;border-bottom:1px solid var(--sel-reg3);transition:border-color .4s,color .4s}
.sel-ghost:hover{border-color:var(--sel-ano)}

/* nav */
.sel-nav{position:fixed;inset:0 0 auto 0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px clamp(16px,3vw,40px);transition:background .6s,backdrop-filter .6s,border-color .6s;border-bottom:1px solid transparent}
.sel-nav.sel-solid{background:rgba(6,7,10,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-color:rgba(255,255,255,.07)}
.sel-brand{display:inline-flex;align-items:center;gap:10px;font:300 18px/1 var(--sel-sans);letter-spacing:.34em;text-transform:uppercase}
.sel-links{display:flex;gap:30px;font:400 11px/1 var(--sel-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--sel-reg5)}
.sel-links a{transition:color .4s}.sel-links a:hover{color:var(--sel-ano)}

/* pinned sections */
.sel-pin{position:relative}
.sel-stick{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden}
.sel-hero{height:260vh}
.sel-statement{height:230vh}
.sel-rim{height:380vh}
.sel-cycle{height:440vh}

/* hero */
.sel-hero{--p:0}
.sel-hero .sel-stick{background:#030406}
.sel-photo{position:absolute;inset:0;overflow:hidden;background:#05070a}
.sel-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 70%;transform-origin:56% 72%;transform:scale(calc(1 + var(--p) * .55)) translate3d(0,calc(var(--p) * -3vh),0);will-change:transform}
.sel-hero-scrim{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(3,4,6,.72) 0,rgba(3,4,6,.38) 34%,rgba(3,4,6,0) 56%),linear-gradient(0deg,rgba(3,4,6,.7) 0,rgba(3,4,6,0) 30%),linear-gradient(90deg,rgba(3,4,6,.5),rgba(3,4,6,0) 55%),rgba(3,4,6,calc(var(--p) * .45))}
.sel-dust{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sel-hero-copy{position:absolute;left:clamp(18px,6vw,96px);top:clamp(86px,15vh,150px);z-index:3;max-width:min(680px,88vw);transform:translate3d(0,calc(var(--p) * -9vh),0);opacity:calc(1 - var(--p) * 1.25)}
.sel-title{font:200 clamp(66px,16.5vw,250px)/.92 var(--sel-sans);letter-spacing:.07em;margin:18px 0 22px -.05em;display:flex;color:var(--sel-ano);}
.sel-letter{display:inline-block;will-change:transform}
.sel-sub{font-size:clamp(16px,1.6vw,20px);color:#e4e5e2;max-width:38ch;text-shadow:0 1px 14px rgba(0,0,0,.8)}
.sel-cta{display:flex;flex-wrap:wrap;align-items:center;gap:20px;margin-top:30px}
.sel-rise{position:absolute;left:clamp(18px,6vw,96px);bottom:11vh;z-index:3;font:400 11px/1.6 var(--sel-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--sel-ano);max-width:30ch;opacity:clamp(0,calc((var(--p) - .3) * 5),1);text-shadow:0 1px 8px #000}
.sel-rise b{color:var(--sel-gold);font-weight:400}
.sel-hud{position:absolute;right:clamp(16px,3vw,40px);bottom:7vh;z-index:3;display:grid;gap:8px;font:400 11px/1.3 var(--sel-mono);letter-spacing:.1em;text-transform:uppercase;text-shadow:0 1px 8px #000}
.sel-hud div{display:flex;justify-content:space-between;gap:28px;border-top:1px solid rgba(255,255,255,.18);padding-top:6px;min-width:210px}
.sel-hud dt{color:var(--sel-reg5)}.sel-hud dd{color:var(--sel-ano)}
.sel-cue{position:absolute;left:50%;bottom:2.6vh;z-index:3;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;font:400 10px/1 var(--sel-mono);letter-spacing:.3em;text-transform:uppercase;color:var(--sel-reg5);opacity:calc(1 - var(--p) * 6)}
.sel-cue i{width:1px;height:34px;background:linear-gradient(var(--sel-ano),transparent);transform-origin:top;animation:sel-cue 3.4s var(--sel-slow) infinite}
@keyframes sel-cue{0%{transform:scaleY(0)}60%{transform:scaleY(1);opacity:1}100%{transform:scaleY(1);opacity:0}}

/* statement */
.sel-statement{--p:0;background:var(--sel-void)}
.sel-center{display:flex;flex-direction:column;justify-content:center;gap:56px;width:min(1080px,100% - 48px);margin:0 auto}
.sel-big{font:200 clamp(26px,4.4vw,56px)/1.22 var(--sel-sans);letter-spacing:-.01em}
.sel-word{opacity:clamp(.16,calc((var(--p) * 1.35 - var(--w)) * 9 + .16),1);color:var(--sel-ano)}
.sel-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;opacity:clamp(0,calc((var(--p) - .55) * 5),1)}
.sel-stat{border-top:1px solid var(--sel-reg3);padding-top:14px;display:flex;flex-direction:column;gap:4px}
.sel-stat b{font:200 clamp(26px,3vw,40px)/1.1 var(--sel-sans)}
.sel-stat span{font:400 11px/1.5 var(--sel-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--sel-reg4)}

/* crater rim */
.sel-rim{--p:0}
.sel-rim .sel-stick{background:#030406}
.sel-rimphoto{position:absolute;inset:0;overflow:hidden;background:#05070a}
.sel-rim-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:60% 55%;transform-origin:66% 50%;transform:scale(calc(1.25 + var(--p) * 1.35)) translate3d(0,calc(var(--p) * -4vh),0);will-change:transform}
.sel-scrim{position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,4,6,.88),rgba(3,4,6,.25) 60%,rgba(3,4,6,.1)),linear-gradient(0deg,rgba(3,4,6,.82),transparent 45%),linear-gradient(180deg,rgba(3,4,6,.6),transparent 30%);pointer-events:none}
.sel-rim-head{position:absolute;left:clamp(18px,6vw,96px);top:clamp(88px,14vh,130px);z-index:2}
.sel-steps{position:absolute;left:clamp(18px,6vw,96px);bottom:8vh;z-index:2;width:min(460px,88vw);display:grid;gap:18px}
.sel-step{display:grid;grid-template-columns:34px 1fr;gap:12px;opacity:.28;transition:opacity 1.2s var(--sel-slow),transform 1.2s var(--sel-slow);transform:translateX(-6px)}
.sel-step.on{opacity:1;transform:none}
.sel-k{font:400 11px/1.9 var(--sel-mono);color:var(--sel-gold)}
.sel-step h3{font:300 22px/1.2 var(--sel-sans)}
.sel-step p{font-size:14px;color:var(--sel-reg5);margin-top:6px;display:none}
.sel-step.on p{display:block}
.sel-hud-r{bottom:8vh}

/* lunar day */
.sel-cycle{--p:0;background:var(--sel-basalt)}
.sel-cyc-stick{display:flex;flex-direction:column;justify-content:center;gap:clamp(12px,2.4vh,26px);width:min(1180px,100% - 48px);margin:0 auto;padding-top:68px}
.sel-cyc-head .sel-h2{font-size:clamp(28px,4vw,52px)}
.sel-cyc-grid{display:grid;grid-template-columns:1.55fr 1fr;gap:clamp(18px,3vw,44px);align-items:start;min-height:0}
.sel-scene{position:relative;border:1px solid rgba(255,255,255,.08);background:#040507}
.sel-scene svg{display:block;width:100%;height:auto;aspect-ratio:16/9;max-height:52vh}
.sel-cyc-earth{position:absolute;right:7%;top:7%;width:10.5%;aspect-ratio:1}
.sel-scene .sel-cap{position:absolute;left:12px;bottom:6px;margin:0;color:var(--sel-ano);text-shadow:0 1px 6px #000}
.sel-readouts{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}
.sel-readouts div{border-top:1px solid var(--sel-reg2);padding:9px 0}
.sel-readouts dt{font:400 10px/1.4 var(--sel-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--sel-reg4)}
.sel-readouts dd{font:200 clamp(20px,2.4vw,30px)/1.2 var(--sel-sans)}
.sel-wide{grid-column:1/-1}
.sel-wide dt{display:flex;justify-content:space-between}
.sel-wide dt b{font-weight:400;color:var(--sel-gold)}
.sel-meter{display:block;height:3px;background:var(--sel-reg2);margin-top:8px;overflow:hidden}
.sel-meter i{display:block;height:100%;background:var(--sel-gold);transform-origin:left;transform:scaleX(0)}
.sel-phases{display:grid;gap:12px;margin-top:14px}
.sel-phase{opacity:.3;transition:opacity 1s var(--sel-slow)}
.sel-phase.on{opacity:1}
.sel-phase h3{font:300 18px/1.3 var(--sel-sans)}
.sel-phase h3 span{font:400 10px/1 var(--sel-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--sel-reg4);margin-left:8px}
.sel-phase p{font-size:13px;color:var(--sel-reg5);line-height:1.55;margin-top:3px}
.sel-phase:not(.on) p{display:none}
.sel-timeline{container-type:inline-size}
.sel-tl-labels{display:grid;grid-template-columns:10fr 41fr 10fr 39fr;font:400 10px/1 var(--sel-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--sel-reg4);margin-bottom:8px}
.sel-tl-bar{position:relative;height:3px;background:repeating-linear-gradient(90deg,var(--sel-reg3) 0 1px,transparent 1px calc(100%/29.5));overflow:visible}
.sel-tl-bar::before{content:"";position:absolute;inset:0;background:var(--sel-reg2);z-index:-1}
.sel-tl-bar i{position:absolute;inset:0;background:var(--sel-ano);transform-origin:left;transform:scaleX(0);opacity:.85}
.sel-tl-bar b{position:absolute;left:0;top:-5px;width:13px;height:13px;margin-left:-6px;border-radius:50%;background:var(--sel-gold);box-shadow:0 0 14px rgba(227,178,74,.8)}

/* sections */
.sel-sec{padding:clamp(80px,12vw,160px) 0;background:var(--sel-void);position:relative}
.sel-sec:nth-of-type(odd){background:var(--sel-basalt)}
.sel-sec-head{margin-bottom:clamp(36px,5vw,64px)}
.sel-rv{transition:opacity 1.8s var(--sel-slow) var(--d,0s),transform 1.8s var(--sel-slow) var(--d,0s)}
.sel-js .sel-rv:not(.in){opacity:0;transform:translate3d(0,34px,0)}

/* configurator */
.sel-cfg{display:grid;grid-template-columns:1.5fr 1fr;gap:clamp(24px,4vw,56px);align-items:start}
.sel-cfg-scene{position:relative;border:1px solid rgba(255,255,255,.08);background:#040507;overflow:hidden}
.sel-cfg-scene svg{display:block;width:100%;height:auto}
.sel-cfg-earth{position:absolute;left:6%;top:7%;width:9%;aspect-ratio:1}
.sel-cfg-scene .sel-cap{position:absolute;right:12px;bottom:4px;margin:0;color:var(--sel-ano)}
.sel-mod{transform:translate(var(--x),-120px);opacity:0;transition:transform 2.6s var(--sel-slow),opacity .6s}
.sel-mod.on{transform:translate(var(--x),330px);opacity:1}
.sel-sh{fill:rgba(0,0,0,.55)}
.sel-puff{fill:rgba(210,205,196,.4);opacity:0;transform-box:fill-box;transform-origin:center}
.sel-mod.on .sel-puff{animation:sel-puff 2.2s ease-out 1.5s both}
@keyframes sel-puff{0%{opacity:.6;transform:scale(.2)}100%{opacity:0;transform:scale(1.8,1.4)}}
.sel-tube{stroke:#aeb3b8;stroke-width:5;stroke-linecap:round;opacity:.85;animation:sel-fadein 1.4s ease both}
@keyframes sel-fadein{from{opacity:0}to{opacity:.85}}
.sel-presets{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.sel-presets button{background:transparent;border:1px solid var(--sel-reg3);padding:8px 14px;font:400 11px/1 var(--sel-mono);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:border-color .4s,background .4s}
.sel-presets button:hover{border-color:var(--sel-ano);background:rgba(255,255,255,.04)}
.sel-modlist{display:grid;gap:8px}
.sel-modbtn{display:grid;grid-template-columns:22px 1fr;gap:14px;text-align:left;background:rgba(255,255,255,.02);border:1px solid var(--sel-reg2);padding:14px 16px;cursor:pointer;transition:border-color .5s,background .5s}
.sel-modbtn:hover{border-color:var(--sel-reg4)}
.sel-modbtn.on{border-color:var(--sel-ano);background:rgba(255,255,255,.05)}
.sel-modbtn b{display:block;font-weight:400;font-size:17px}
.sel-modbtn small{display:block;font-size:13px;color:var(--sel-reg4);margin-top:2px}
.sel-tick{width:16px;height:16px;border:1px solid var(--sel-reg4);margin-top:4px;position:relative;border-radius:50%}
.sel-modbtn.on .sel-tick{border-color:var(--sel-ano)}
.sel-modbtn.on .sel-tick::after{content:"";position:absolute;inset:3px;background:var(--sel-ano);border-radius:50%}
.sel-totals{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:22px}
.sel-totals div{border-top:1px solid var(--sel-reg3);padding-top:10px}
.sel-totals b{display:block;font:200 36px/1.1 var(--sel-sans)}
.sel-totals span{font:400 10px/1.3 var(--sel-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--sel-reg4)}
.sel-power{margin-top:22px}
.sel-power-row{display:flex;justify-content:space-between;font:400 11px/1 var(--sel-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--sel-reg5)}
.sel-power-row b{font-weight:400;color:var(--sel-ano)}
.sel-power-bar{position:relative;height:6px;background:var(--sel-reg2);margin:10px 0;overflow:hidden}
.sel-power-bar i,.sel-power-bar u{position:absolute;left:0;right:0;transform-origin:left;transition:transform 1.4s var(--sel-slow)}
.sel-power-bar i{top:0;height:3px;background:var(--sel-ano)}
.sel-power-bar u{bottom:0;height:3px;background:var(--sel-gold);text-decoration:none}
.sel-note{font-size:13px;color:var(--sel-reg5);margin-top:12px}
.sel-note.warn{color:var(--sel-warm)}

/* earth window */
.sel-win-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(28px,6vw,90px);align-items:center}
.sel-slider{display:block;margin-top:30px}
.sel-slider span{display:flex;justify-content:space-between;font:400 11px/1 var(--sel-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--sel-reg5);margin-bottom:12px}
.sel-slider b{font-weight:400;color:var(--sel-ano)}
.sel-slider input{width:100%;accent-color:var(--sel-gold);height:24px;cursor:pointer}
.sel-port-wrap{display:flex;flex-direction:column;align-items:center}
.sel-port{position:relative;width:min(100%,460px);aspect-ratio:1;border-radius:50%;padding:7%;background:conic-gradient(from 210deg,#6b7078,#c9ccd0,#4b5056,#aab0b6,#6b7078);box-shadow:0 40px 80px -30px rgba(0,0,0,.9),inset 0 0 0 2px rgba(255,255,255,.2)}
.sel-port::before{content:"";position:absolute;inset:5%;border-radius:50%;background:#101215;box-shadow:inset 0 6px 18px rgba(0,0,0,.9)}
.sel-port-glass{position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;background:#020305;isolation:isolate}
.sel-port-earth{position:absolute;left:50%;top:44%;width:62%;aspect-ratio:1;transform:translate(-50%,-50%)}
.sel-port-horizon{position:absolute;left:0;bottom:0;width:100%;height:22%}
.sel-glare{position:absolute;inset:0;background:linear-gradient(130deg,rgba(255,255,255,.14),transparent 34%);pointer-events:none}
.sel-bolt{position:absolute;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#e7e9eb,#5b6066);box-shadow:0 1px 2px #000}
.sel-b1{left:50%;top:1.6%;margin-left:-6px}.sel-b2{left:50%;bottom:1.6%;margin-left:-6px}.sel-b3{top:50%;left:1.6%;margin-top:-6px}.sel-b4{top:50%;right:1.6%;margin-top:-6px}

/* crew */
.sel-crew{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.sel-card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid var(--sel-reg2);padding:22px 20px 24px;display:flex;flex-direction:column;gap:6px;outline-offset:2px}
.sel-card.in{transition:transform 3s var(--sel-slow),border-color 1.5s,box-shadow 3s var(--sel-slow)}
.sel-card.in:hover,.sel-card.in:focus-visible{transform:translate3d(0,-16px,0) rotate(-.8deg);border-color:var(--sel-reg4);box-shadow:0 40px 50px -30px rgba(0,0,0,.9)}
.sel-visor{width:112px;height:112px;margin-bottom:10px;border-radius:50%;object-fit:cover;object-position:center top;border:3px solid var(--sel-reg4);box-shadow:0 0 0 6px rgba(255,255,255,.05)}
.sel-card h3{font:300 20px/1.2 var(--sel-sans)}
.sel-role{font:400 11px/1.5 var(--sel-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--sel-reg4)}
.sel-card blockquote{font:italic 400 15px/1.55 var(--sel-serif);color:var(--sel-reg5);margin-top:14px}
.sel-stat-line{font:400 11px/1 var(--sel-mono);letter-spacing:.1em;color:var(--sel-gold);margin-top:auto;padding-top:18px}

/* manifest */
.sel-man-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:clamp(24px,4vw,60px);align-items:start}
.sel-man-form{display:grid;gap:26px}
.sel-man-form fieldset{border:0;min-width:0}
.sel-man-form legend{font:400 11px/1 var(--sel-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--sel-reg5);padding:0;margin-bottom:12px}
.sel-man-form legend small{color:var(--sel-reg4);margin-left:10px;letter-spacing:.06em;text-transform:none}
.sel-opts{display:grid;gap:8px}
.sel-opts-3{grid-template-columns:repeat(3,1fr)}
.sel-opt{position:relative;display:flex;flex-direction:column;gap:3px;border:1px solid var(--sel-reg2);padding:14px 16px;cursor:pointer;transition:border-color .5s,background .5s}
.sel-opt:hover{border-color:var(--sel-reg4)}
.sel-opt.on{border-color:var(--sel-ano);background:rgba(255,255,255,.05)}
.sel-opt input{position:absolute;opacity:0;inset:0;cursor:pointer}
.sel-opt:focus-within{outline:2px solid var(--sel-gold);outline-offset:3px}
.sel-opt b{font:400 15px/1.3 var(--sel-mono);letter-spacing:.04em}
.sel-opt span{font-size:13px;color:var(--sel-reg4)}
.sel-cabin{display:inline-grid;gap:8px;padding:18px 22px;border:1px solid var(--sel-reg2);border-radius:60px 60px 10px 10px / 40px 40px 10px 10px}
.sel-seatrow{display:flex;gap:8px;align-items:center}
.sel-seatrow em{width:16px;font:400 10px/1 var(--sel-mono);color:var(--sel-reg4);font-style:normal}
.sel-seat{width:44px;height:40px;background:transparent;border:1px solid var(--sel-reg3);border-radius:8px 8px 4px 4px;cursor:pointer;font:400 11px/1 var(--sel-mono);color:var(--sel-reg5);transition:background .4s,border-color .4s,color .4s}
.sel-seat.aisle{margin-right:22px}
.sel-seat:hover:not(:disabled){border-color:var(--sel-ano)}
.sel-seat.on{background:var(--sel-ano);color:#101215;border-color:var(--sel-ano)}
.sel-seat:disabled{background:repeating-linear-gradient(45deg,var(--sel-reg2) 0 3px,transparent 3px 6px);color:var(--sel-reg3);border-color:var(--sel-reg2);cursor:not-allowed}
.sel-field{display:grid;gap:10px}
.sel-field span{font:400 11px/1 var(--sel-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--sel-reg5)}
.sel-field input{background:transparent;border:0;border-bottom:1px solid var(--sel-reg3);padding:10px 0;font-size:20px;font-weight:200;border-radius:0;transition:border-color .4s}
.sel-field input:focus{outline:none;border-color:var(--sel-gold)}
.sel-field input::placeholder{color:var(--sel-reg3)}
.sel-man-form .sel-btn{justify-self:start}
.sel-pass{position:sticky;top:90px;background:#e9ebec;color:#14161a;padding:24px 26px 22px;border-radius:4px;font-family:var(--sel-mono);overflow:hidden;box-shadow:0 40px 80px -40px rgba(0,0,0,.9)}
.sel-pass::before,.sel-pass::after{content:"";position:absolute;top:96px;width:22px;height:22px;border-radius:50%;background:var(--sel-basalt)}
.sel-pass::before{left:-11px}.sel-pass::after{right:-11px}
.sel-pass-top{display:flex;justify-content:space-between;font:500 10px/1 var(--sel-mono);letter-spacing:.18em;text-transform:uppercase;padding-bottom:16px;border-bottom:1px dashed #9aa0a6}
.sel-pass dl{display:grid;gap:10px;margin-top:20px}
.sel-pass dl div{display:flex;justify-content:space-between;gap:14px;font-size:12px}
.sel-pass dt{color:#767c83;text-transform:uppercase;letter-spacing:.1em;font-size:10px;padding-top:2px}
.sel-pass dd{text-align:right;font-weight:500;word-break:break-word}
.sel-pass-bar{display:flex;gap:2px;height:34px;margin:22px 0 14px;align-items:stretch}
.sel-pass-bar i{background:#14161a;display:block}
.sel-pass-total{display:flex;justify-content:space-between;align-items:baseline;border-top:1px dashed #9aa0a6;padding-top:14px}
.sel-pass-total span{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#767c83}
.sel-pass-total b{font:300 28px/1 var(--sel-sans)}
.sel-pass .sel-fine{color:#5a6068;margin-top:14px}
.sel-stamp{position:absolute;right:20px;top:128px;border:2px solid #b4801a;color:#b4801a;padding:6px 12px;text-transform:uppercase;font:500 11px/1.3 var(--sel-mono);letter-spacing:.14em;text-align:center;opacity:0;transform:rotate(-12deg) scale(1.6);transition:opacity .4s,transform 1s var(--sel-slow);pointer-events:none}
.sel-stamp small{display:block;font-size:10px}
.sel-pass.cleared .sel-stamp{opacity:.92;transform:rotate(-12deg) scale(1)}

/* footer */
.sel-foot{background:var(--sel-void);padding:clamp(60px,9vw,120px) 0 40px;border-top:1px solid var(--sel-reg2);overflow:hidden}
.sel-foot-grid{display:grid;grid-template-columns:1.6fr 1fr;gap:40px;align-items:end}
.sel-foot-mark{font:200 clamp(60px,15vw,210px)/.9 var(--sel-sans);letter-spacing:.07em;color:transparent;-webkit-text-stroke:1px var(--sel-reg3)}
.sel-foot-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.sel-foot-cols h4{font:400 10px/1 var(--sel-mono);letter-spacing:.2em;text-transform:uppercase;color:var(--sel-reg4);margin-bottom:14px}
.sel-foot-cols a{display:block;font-size:14px;color:var(--sel-reg5);padding:4px 0;transition:color .4s}
.sel-foot-cols a:hover{color:var(--sel-ano)}

/* reduced motion */
.sel-rm .sel-hero{height:100vh;height:100svh}
.sel-rm .sel-statement{height:auto;padding:120px 0}
.sel-rm .sel-statement .sel-stick{position:relative;height:auto}
.sel-rm .sel-rim,.sel-rm .sel-cycle{height:auto}
.sel-rm .sel-rim .sel-stick{height:100vh}
.sel-rm .sel-cycle .sel-stick{position:relative;height:auto;padding:90px 0}
.sel-rm .sel-step,.sel-rm .sel-phase{opacity:1;transform:none}
.sel-rm .sel-step p,.sel-rm .sel-phase p{display:block}
.sel-rm .sel-mod,.sel-rm .sel-card,.sel-rm .sel-rv{transition:none}
.sel-rm .sel-mod.on .sel-puff,.sel-rm .sel-cue i,.sel-rm .sel-tube{animation:none}
.sel-rm .sel-rv{opacity:1!important;transform:none!important}
.sel-rm .sel-cue{display:none}
@media (prefers-reduced-motion:reduce){
  .sel-root *,.sel-root *::before,.sel-root *::after{animation-duration:.001s!important;transition-duration:.001s!important}
}

/* responsive */
@media (max-width:960px){
  .sel-links{display:none}
  .sel-cyc-grid,.sel-cfg,.sel-win-grid,.sel-man-grid{grid-template-columns:1fr}
  .sel-crew{grid-template-columns:repeat(2,1fr)}
  .sel-stats{grid-template-columns:repeat(2,1fr)}
  .sel-pass{position:relative;top:0}
  .sel-foot-grid{grid-template-columns:1fr}
}
@media (max-width:640px){
  .sel-wrap{width:calc(100% - 32px)}
  .sel-nav{padding:12px 16px}
  .sel-brand{font-size:15px;letter-spacing:.26em}
  .sel-hero-img{object-position:47% 70%;transform-origin:47% 72%}
  .sel-rim-img{object-position:62% 55%;transform:scale(calc(1 + var(--p) * .6)) translate3d(0,calc(var(--p) * -3vh),0)}
  .sel-hero-img{transform:scale(calc(1 + var(--p) * .3))}
  .sel-hero-copy{top:auto;bottom:34vh}
  .sel-title{font-size:22vw;margin:12px 0 14px -.05em}
  .sel-sub{font-size:15px}
  .sel-cta{margin-top:18px;gap:10px}
  .sel-btn{padding:15px 20px}
  .sel-hud{display:none}
  .sel-rise{bottom:5vh;font-size:10px}
  .sel-cue{display:none}
  .sel-rim-head{top:84px}
  .sel-steps{bottom:5vh}
  .sel-step:not(.on){display:none}
  .sel-hud-r{display:none}
  .sel-cyc-stick{width:calc(100% - 32px);padding-top:60px;gap:10px}
  .sel-cyc-head .sel-h2{font-size:26px}
  .sel-cyc-head .sel-eyebrow{display:none}
  .sel-scene svg{max-height:none}
  .sel-phase:not(.on){display:none}
  .sel-phase p{font-size:12.5px}
  .sel-readouts dd{font-size:18px}
  .sel-readouts div{padding:6px 0}
  .sel-timeline{display:none}
  .sel-opts-3{grid-template-columns:1fr}
  .sel-crew{grid-template-columns:1fr}
  .sel-seat{width:40px}
  .sel-seat.aisle{margin-right:14px}
  .sel-foot-cols{grid-template-columns:repeat(2,1fr)}
  .sel-rm .sel-hero-copy{bottom:34vh}
}
`;
