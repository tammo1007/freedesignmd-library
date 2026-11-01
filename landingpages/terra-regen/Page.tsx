/**
 * Terra — regenerative agriculture & climate-farming collective.
 *
 * The page itself grows. The hero is a pinned vertical cross-section from sky
 * to root zone: as you scroll, procedural SVG wheat, cover crops and a tree
 * rise out of the soil, root systems branch downward through five soil
 * horizons, carbon particles fall from the sky and are banked as green flecks
 * in the earth, and a live per-hectare counter climbs. A season slider (always
 * on screen) re-tints the whole site spring -> summer -> autumn -> winter,
 * moving the sun, thinning the foliage and laying snow on the ground.
 *
 * Below: topographic contour lines that draw across the field, a live carbon
 * ledger with growing bars and a drawn trend line, an interactive field map
 * (hover / focus / tap a plot and its crop rows are drawn in and its soil
 * data appears), a mycelium network with travelling signals, grower voices
 * that grow in, and a wheat field that rises under the sign-up form.
 *
 * Everything is procedural SVG + CSS custom properties driven from a single
 * rAF scroll loop (no React state per frame). No images, no web fonts, no
 * network. prefers-reduced-motion renders the fully grown, static scene.
 * SSR-safe: window/document are only touched inside effects.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Procedural generation (deterministic)                               */
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
const f1 = (n: number) => Math.round(n * 10) / 10;
const HZ = 458; // horizon y in the 1200x1000 scene

type Stroke = { d: string; delay: number; w: number; o?: number };
type Leaf = { x: number; y: number; rx: number; ry: number; rot: number; delay: number; c: 1 | 2 };

function buildScene() {
  const r = rng(11);
  const stems: Stroke[] = [];
  const blades: Stroke[] = [];
  const ears: { x: number; y: number; delay: number; rot: number }[] = [];
  const leaves: Leaf[] = [];
  const flowers: { x: number; y: number; delay: number }[] = [];
  const roots: Stroke[] = [];
  const bases: { x: number; delay: number }[] = [];

  const addRoot = (x: number, y: number, ang: number, len: number, depth: number, maxD: number, d0: number, w: number) => {
    const ex = x + Math.sin(ang) * len;
    const ey = y + Math.cos(ang) * len;
    const cx = x + Math.sin(ang + (r() - 0.5) * 0.9) * len * 0.5;
    const cy = y + Math.cos(ang) * len * 0.45;
    roots.push({ d: `M${f1(x)} ${f1(y)}Q${f1(cx)} ${f1(cy)} ${f1(ex)} ${f1(ey)}`, delay: d0, w, o: 0.95 - depth * 0.12 });
    if (depth < maxD) {
      const n = depth === 0 ? 2 : 2;
      for (let i = 0; i < n; i++) {
        const t = 0.35 + r() * 0.45;
        const px = x + (ex - x) * t;
        const py = y + (ey - y) * t;
        const side = i % 2 ? 1 : -1;
        addRoot(px, py, ang + side * (0.55 + r() * 0.6), len * (0.42 + r() * 0.18), depth + 1, maxD, d0 + 0.1 + depth * 0.04, Math.max(0.8, w * 0.6));
      }
    }
  };

  // wheat
  for (let i = 0; i < 11; i++) {
    const x = 110 + i * 92 + r() * 26;
    const h = 130 + r() * 90;
    const lean = (r() - 0.5) * 46;
    const d = r() * 0.28;
    const qx = x + lean * 0.15;
    const qy = HZ - h * 0.55;
    const tx = x + lean;
    const ty = HZ - h;
    stems.push({ d: `M${f1(x)} ${HZ}Q${f1(qx)} ${f1(qy)} ${f1(tx)} ${f1(ty)}`, delay: d, w: 3 });
    [0.28, 0.46, 0.64].forEach((t, k) => {
      const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * qx + t * t * tx;
      const py = (1 - t) * (1 - t) * HZ + 2 * (1 - t) * t * qy + t * t * ty;
      const side = k % 2 ? 1 : -1;
      blades.push({ d: `M${f1(px)} ${f1(py)}q${side * 20} ${-26 - k * 3} ${side * 42} ${-12 - k * 5}`, delay: d + 0.2 + k * 0.07, w: 3.4 });
    });
    ears.push({ x: tx, y: ty, delay: d + 0.45, rot: lean * 0.5 });
    bases.push({ x, delay: d });
    // fibrous roots
    for (let k = 0; k < 4; k++) addRoot(x, HZ + 4, (k - 1.5) * 0.42 + (r() - 0.5) * 0.15, 150 + r() * 110, 0, 1, 0.02 + r() * 0.1, 2.6);
  }
  // broadleaf cover crop / clover
  for (let i = 0; i < 6; i++) {
    const x = 160 + i * 168 + r() * 40;
    const h = 60 + r() * 55;
    const d = 0.05 + r() * 0.25;
    const lean = (r() - 0.5) * 20;
    stems.push({ d: `M${f1(x)} ${HZ}Q${f1(x + lean)} ${f1(HZ - h * 0.6)} ${f1(x + lean * 1.4)} ${f1(HZ - h)}`, delay: d, w: 2.6 });
    for (let k = 0; k < 5; k++) {
      const t = 0.25 + k * 0.17;
      const side = k % 2 ? 1 : -1;
      leaves.push({ x: x + lean * t * 1.3 + side * 9, y: HZ - h * t, rx: 13, ry: 7, rot: side * 28 - 90 + 90, delay: d + 0.2 + k * 0.05, c: k % 2 ? 1 : 2 });
    }
    flowers.push({ x: x + lean * 1.4, y: HZ - h - 4, delay: d + 0.55 });
    addRoot(x, HZ + 4, (r() - 0.5) * 0.2, 210 + r() * 40, 0, 2, 0.05, 3);
  }
  // hedge on the left + tree on the right
  for (let k = 0; k < 6; k++) leaves.push({ x: 40 + (k % 3) * 26 + r() * 8, y: HZ - 28 - Math.floor(k / 3) * 26, rx: 28, ry: 22, rot: 0, delay: 0.3 + k * 0.04, c: k % 2 ? 1 : 2 });
  stems.push({ d: `M1096 ${HZ}Q1092 ${HZ - 70} 1100 ${HZ - 170}`, delay: 0.1, w: 11 });
  stems.push({ d: `M1098 ${HZ - 100}Q1070 ${HZ - 130} 1052 ${HZ - 168}`, delay: 0.32, w: 5 });
  stems.push({ d: `M1099 ${HZ - 130}Q1130 ${HZ - 160} 1150 ${HZ - 190}`, delay: 0.36, w: 5 });
  const canopy: [number, number, number][] = [[1100, 100, 54], [1056, 130, 42], [1150, 128, 44], [1100, 150, 50], [1070, 88, 36], [1138, 90, 36]];
  canopy.forEach(([x, y, rr], k) => leaves.push({ x, y, rx: rr, ry: rr * 0.82, rot: 0, delay: 0.42 + k * 0.05, c: k % 2 ? 1 : 2 }));
  for (let k = 0; k < 7; k++) addRoot(1096, HZ + 6, (k - 3) * 0.34 + (r() - 0.5) * 0.1, 280 + r() * 190, 0, 2, 0.05 + r() * 0.1, 5.2);

  // soil
  const specks: { x: number; y: number; r: number; c: string }[] = [];
  const cols = ["#8a6a45", "#2b1c12", "#a8855a", "#3b2616", "#c4a572"];
  for (let i = 0; i < 260; i++) {
    const y = HZ + 10 + r() * 530;
    specks.push({ x: r() * 1200, y, r: 0.8 + r() * (y > 780 ? 5 : 2.2), c: cols[Math.floor(r() * cols.length)] });
  }
  const store: { x: number; y: number; delay: number }[] = [];
  for (let i = 0; i < 70; i++) store.push({ x: 40 + r() * 1120, y: HZ + 24 + r() * 330, delay: r() * 0.6 });
  const falling: { x: number; dx: number; dy: number; dur: number; del: number }[] = [];
  for (let i = 0; i < 22; i++) falling.push({ x: 60 + r() * 1080, dx: (r() - 0.5) * 80, dy: 300 + r() * 230, dur: 7 + r() * 6, del: -r() * 12 });
  const worms = [
    `M180 ${HZ + 70}q30 -16 60 0t60 0t60 0`,
    `M820 ${HZ + 150}q-30 14 -60 0t-60 0t-60 0t-40 6`,
    `M420 ${HZ + 230}q26 -14 52 0t52 0`,
  ];
  return { stems, blades, ears, leaves, flowers, roots, bases, specks, store, falling, worms };
}
const SCENE = buildScene();

const wave = (y: number, amp: number, ph: number) => {
  let d = `M0 ${y}`;
  for (let x = 0; x <= 1200; x += 40) d += `L${x} ${f1(y + Math.sin(x * 0.011 + ph) * amp + Math.sin(x * 0.027 + ph * 2) * amp * 0.5)}`;
  return d + "L1200 1000L0 1000Z";
};
const STRATA = [
  { y: 920, fill: "#4d4a46", amp: 5, ph: 3 },
  { y: 790, fill: "#8a6a45", amp: 7, ph: 2 },
  { y: 640, fill: "#6b4a2e", amp: 6, ph: 1 },
  { y: 500, fill: "#4a3020", amp: 4, ph: 0.4 },
  { y: HZ + 2, fill: "#2b1c12", amp: 2.5, ph: 5 },
];
const STRATA_PATHS = STRATA.map((s) => ({ ...s, d: wave(s.y, s.amp, s.ph) }));

/* Contours */
function buildContours() {
  const hills = [
    { cx: 300, cy: 280, n: 13, step: 24, ax: 1.5, ay: 1, ph: 0.4 },
    { cx: 820, cy: 430, n: 15, step: 22, ax: 1.2, ay: 1, ph: 2.1 },
    { cx: 1050, cy: 150, n: 8, step: 20, ax: 1.1, ay: 0.9, ph: 4.2 },
  ];
  const out: { d: string; idx: boolean; delay: number; label?: { x: number; y: number; t: string } }[] = [];
  hills.forEach((h, hi) => {
    for (let i = 1; i <= h.n; i++) {
      const base = i * h.step;
      let d = "";
      for (let a = 0; a <= 6.2832 + 0.01; a += 0.1) {
        const k = 1 + 0.16 * Math.sin(2 * a + h.ph + i * 0.08) + 0.1 * Math.sin(3 * a + h.ph * 2) + 0.05 * Math.sin(5 * a + i * 0.3);
        const x = h.cx + Math.cos(a) * base * h.ax * k;
        const y = h.cy + Math.sin(a) * base * h.ay * k;
        d += (a === 0 ? "M" : "L") + f1(x) + " " + f1(y);
      }
      const idx = i % 4 === 0;
      out.push({
        d: d + "Z",
        idx,
        delay: ((h.n - i) / h.n) * 0.7 + hi * 0.06,
        label: idx ? { x: h.cx + base * h.ax * 1.0 + 4, y: h.cy + 4, t: `${380 + (h.n - i) * 10} m` } : undefined,
      });
    }
  });
  return out;
}
const CONTOURS = buildContours();

/* Plots (field map) */
type Plot = { id: string; name: string; crop: string; practice: string; since: number; ha: number; som: number; carbon: number; kind: "wheat" | "clover" | "pasture" | "orchard" | "fallow"; poly: string; clip: string; cx: number; cy: number; ang: number };
const PLOT_DATA: Omit<Plot, "poly" | "clip" | "cx" | "cy" | "ang">[] = [
  { id: "p1", name: "North Meadow", crop: "Perennial pasture", practice: "Rotational grazing", since: 2019, ha: 14.2, som: 6.8, carbon: 1.9, kind: "pasture" },
  { id: "p2", name: "Hedge Row", crop: "Spelt + hedgerow", practice: "Alley cropping", since: 2020, ha: 8.6, som: 5.4, carbon: 2.7, kind: "wheat" },
  { id: "p3", name: "Long Acre", crop: "Winter rye", practice: "No-till, cover crop", since: 2021, ha: 18.0, som: 4.9, carbon: 1.2, kind: "wheat" },
  { id: "p4", name: "Alder Brook", crop: "Riparian buffer", practice: "Native planting", since: 2018, ha: 5.1, som: 8.2, carbon: 3.4, kind: "orchard" },
  { id: "p5", name: "Clover Flat", crop: "Red clover ley", practice: "Nitrogen-fixing ley", since: 2022, ha: 11.7, som: 4.1, carbon: 1.1, kind: "clover" },
  { id: "p6", name: "Stone Wall", crop: "Heritage wheat", practice: "Minimum till, compost", since: 2020, ha: 16.4, som: 5.2, carbon: 1.5, kind: "wheat" },
  { id: "p7", name: "The Orchard", crop: "Apple + clover", practice: "Silvopasture", since: 2017, ha: 6.9, som: 7.1, carbon: 3.1, kind: "orchard" },
  { id: "p8", name: "Pond Field", crop: "Mixed vegetables", practice: "Compost, living mulch", since: 2023, ha: 3.4, som: 3.8, carbon: 0.9, kind: "clover" },
  { id: "p9", name: "South Fallow", crop: "Fallow / rewilding", practice: "Natural succession", since: 2016, ha: 9.8, som: 7.6, carbon: 2.2, kind: "fallow" },
  { id: "p10", name: "Wind Hill", crop: "Barley + vetch", practice: "Relay intercrop", since: 2021, ha: 20.3, som: 4.6, carbon: 1.4, kind: "wheat" },
  { id: "p11", name: "Mill Pasture", crop: "Herbal ley", practice: "Mob grazing", since: 2019, ha: 13.5, som: 6.2, carbon: 2.0, kind: "pasture" },
  { id: "p12", name: "East Terrace", crop: "Oats + peas", practice: "Contour strips", since: 2022, ha: 10.2, som: 4.3, carbon: 1.3, kind: "clover" },
];
function buildPlots(): Plot[] {
  const r = rng(5);
  const V: [number, number][][] = [];
  for (let j = 0; j <= 3; j++) {
    V.push([]);
    for (let i = 0; i <= 4; i++) {
      const edgeX = i === 0 || i === 4;
      const edgeY = j === 0 || j === 3;
      V[j].push([60 + i * 170 + (edgeX ? (r() - 0.5) * 10 : (r() - 0.5) * 44), 40 + j * 145 + (edgeY ? (r() - 0.5) * 10 : (r() - 0.5) * 40)]);
    }
  }
  return PLOT_DATA.map((p, k) => {
    const i = k % 4;
    const j = Math.floor(k / 4);
    const pts = [V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]];
    const cx = pts.reduce((s, q) => s + q[0], 0) / 4;
    const cy = pts.reduce((s, q) => s + q[1], 0) / 4;
    const poly = pts.map((q) => `${f1(q[0])},${f1(q[1])}`).join(" ");
    const ang = (r() - 0.5) * 50 + (p.kind === "pasture" ? 90 : 0);
    return { ...p, poly, clip: poly, cx, cy, ang };
  });
}
const PLOTS = buildPlots();

/* Mycelium */
function buildMyc() {
  const r = rng(23);
  const nodes: { x: number; y: number }[] = [{ x: 300, y: 40 }];
  for (let i = 0; i < 44; i++) nodes.push({ x: 20 + r() * 560, y: 40 + r() * 330 });
  const edges: { a: number; b: number; d: string; delay: number }[] = [];
  nodes.forEach((n, i) => {
    if (i === 0) return;
    const near = nodes
      .map((m, j) => ({ j, dist: Math.hypot(m.x - n.x, m.y - n.y) }))
      .filter((o) => o.j < i)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, i < 3 ? 1 : 2);
    near.forEach((o) => {
      const m = nodes[o.j];
      const mx = (n.x + m.x) / 2 + (r() - 0.5) * 30;
      const my = (n.y + m.y) / 2 + (r() - 0.5) * 30;
      edges.push({ a: i, b: o.j, d: `M${f1(m.x)} ${f1(m.y)}Q${f1(mx)} ${f1(my)} ${f1(n.x)} ${f1(n.y)}`, delay: Math.min(0.75, (n.y - 40) / 420 + r() * 0.1) });
    });
  });
  return { nodes, edges };
}
const MYC = buildMyc();

/* ------------------------------------------------------------------ */
/* Seasons                                                             */
/* ------------------------------------------------------------------ */
const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
const STOPS = [
  { sky1: "#cfe8d8", sky2: "#f6f0d6", leaf: "#6fae3b", leaf2: "#9ccf4a", wheat: "#b8c46a", bg: "#f3ecda", sun: "#ffe08a", bloom: 0.9, snow: 0, sy: 0, hill: "#7fae5a" },
  { sky1: "#8cc8e8", sky2: "#fbe9b0", leaf: "#3e8f2d", leaf2: "#5fb540", wheat: "#e2b94a", bg: "#f5ecd0", sun: "#ffd24a", bloom: 1, snow: 0, sy: -40, hill: "#5f9b3c" },
  { sky1: "#e8b98a", sky2: "#f7dcae", leaf: "#b86a2a", leaf2: "#d89a35", wheat: "#c98a3a", bg: "#f1e2c6", sun: "#ff9a4a", bloom: 0.72, snow: 0, sy: 40, hill: "#b9803a" },
  { sky1: "#b9c6cf", sky2: "#e9ecec", leaf: "#7d8a6a", leaf2: "#a3ad92", wheat: "#b9a98a", bg: "#ebe9e2", sun: "#f1f5f7", bloom: 0.3, snow: 1, sy: 80, hill: "#9aa58f" },
];
const hex2 = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a: string, b: string, t: number) => {
  const A = hex2(a);
  const B = hex2(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
function applySeason(el: HTMLElement, s: number) {
  const i = Math.min(2, Math.floor(s));
  const t = s - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const set = (k: string, v: string) => el.style.setProperty(k, v);
  (["sky1", "sky2", "leaf", "leaf2", "wheat", "bg", "sun", "hill"] as const).forEach((k) => set(`--${k}`, mixHex(a[k], b[k], t)));
  set("--bloom", String(a.bloom + (b.bloom - a.bloom) * t));
  set("--snow", String(a.snow + (b.snow - a.snow) * t));
  set("--sy", `${a.sy + (b.sy - a.sy) * t}px`);
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */
function useInView<T extends HTMLElement>(threshold = 0.25): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen];
}
const v = (o: Record<string, string | number>) => o as unknown as CSSProperties;

/* ------------------------------------------------------------------ */
/* Hero scene                                                          */
/* ------------------------------------------------------------------ */
function Scene() {
  const S = SCENE;
  const ticks = [0, 30, 60, 120, 200];
  const tickY = [HZ, 500, 640, 790, 920];
  const labels = [
    ["O", "Litter layer", HZ + 22],
    ["A", "Topsoil, 6% organic matter", 570],
    ["B", "Subsoil", 715],
    ["C", "Parent material", 860],
    ["R", "Bedrock", 965],
  ] as const;
  return (
    <svg className="tr-scene" viewBox="0 0 1200 1000" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Cross-section from sky to root zone: crops, a tree and their roots growing through five soil layers while carbon is stored in the soil">
      <defs>
        <linearGradient id="tr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sky1)" />
          <stop offset="1" stopColor="var(--sky2)" />
        </linearGradient>
        <linearGradient id="tr-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".28" />
        </linearGradient>
      </defs>
      <rect width="1200" height={HZ + 4} fill="url(#tr-sky)" />
      <g transform={`translate(0 ${HZ - 330})`}>
      <circle className="tr-sun" cx="860" cy="120" r="46" fill="var(--sun)" />
      <circle className="tr-sun tr-halo" cx="860" cy="120" r="78" fill="var(--sun)" />
      <g className="tr-clouds" fill="#fff" opacity=".7">
        <g className="tr-cl a"><ellipse cx="200" cy="90" rx="70" ry="16" /><ellipse cx="240" cy="76" rx="40" ry="14" /></g>
        <g className="tr-cl b"><ellipse cx="620" cy="150" rx="90" ry="14" /><ellipse cx="660" cy="136" rx="46" ry="13" /></g>
        <g className="tr-cl c"><ellipse cx="1000" cy="60" rx="60" ry="12" /></g>
      </g>
      <path d="M0 300Q150 240 300 280T620 270T900 285T1200 250V340H0Z" fill="var(--hill)" opacity=".28" />
      <path d="M0 320Q200 280 420 308T800 300T1200 296V340H0Z" fill="var(--hill)" opacity=".5" />
      </g>

      {/* soil horizons */}
      {STRATA_PATHS.map((s) => <path key={s.y} d={s.d} fill={s.fill} />)}
      <rect y={HZ} width="1200" height="542" fill="url(#tr-fade)" />
      {S.specks.map((p, i) => <circle key={i} cx={f1(p.x)} cy={f1(p.y)} r={f1(p.r)} fill={p.c} opacity=".55" />)}
      {S.worms.map((d, i) => <path key={i} d={d} fill="none" stroke="#d99a8e" strokeWidth="4" strokeLinecap="round" opacity=".7" />)}

      {/* snow */}
      <path className="tr-snow" d={`M0 ${HZ - 4}Q60 ${HZ - 12} 120 ${HZ - 4}T240 ${HZ - 4}T360 ${HZ - 4}T480 ${HZ - 4}T600 ${HZ - 4}T720 ${HZ - 4}T840 ${HZ - 4}T960 ${HZ - 4}T1080 ${HZ - 4}T1200 ${HZ - 4}V${HZ + 6}H0Z`} fill="#f7fbfc" />

      {/* roots */}
      <g fill="none" strokeLinecap="round" stroke="#efdcb4">
        {S.roots.map((p, i) => <path key={i} className="tr-dr" pathLength={1} d={p.d} strokeWidth={p.w} style={v({ "--d": p.delay, opacity: p.o ?? 1 })} />)}
      </g>

      {/* stored carbon */}
      <g className="tr-store">
        {S.store.map((c, i) => <rect key={i} className="tr-fleck" x={f1(c.x)} y={f1(c.y)} width="5" height="5" style={v({ "--d": c.delay })} />)}
      </g>

      {/* plants */}
      <g>
        {S.stems.map((p, i) => <path key={i} className="tr-ds" pathLength={1} d={p.d} fill="none" stroke={p.w > 8 ? "#5b3d26" : p.w > 4 ? "#6b4a2e" : "var(--stem, #8b9a4a)"} strokeWidth={p.w} strokeLinecap="round" style={v({ "--d": p.delay })} />)}
        {S.blades.map((p, i) => <path key={i} className="tr-ds" pathLength={1} d={p.d} fill="none" stroke="var(--leaf)" strokeWidth={p.w} strokeLinecap="round" style={v({ "--d": p.delay })} />)}
        {S.leaves.map((l, i) => (
          <ellipse key={i} className="tr-sc" cx={f1(l.x)} cy={f1(l.y)} rx={l.rx} ry={l.ry} fill={l.c === 1 ? "var(--leaf)" : "var(--leaf2)"} transform={`rotate(${l.rot})`} style={v({ "--d": l.delay, "--o": "50% 50%" })} />
        ))}
        {S.flowers.map((fl, i) => (
          <g key={i} className="tr-sc" style={v({ "--d": fl.delay })}>
            {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={f1(fl.x + Math.cos((a * Math.PI) / 180) * 5)} cy={f1(fl.y + Math.sin((a * Math.PI) / 180) * 5)} r="3.6" fill="var(--wheat)" />)}
            <circle cx={fl.x} cy={fl.y} r="2.6" fill="#7a4a1c" />
          </g>
        ))}
        {S.ears.map((e, i) => (
          <g key={i} className="tr-sc" transform={`rotate(${f1(e.rot)})`} style={v({ "--d": e.delay })}>
            {[0, 1, 2, 3, 4].map((k) => (
              <g key={k}>
                <ellipse cx={f1(e.x - 4)} cy={f1(e.y - 4 - k * 7)} rx="2.8" ry="5.6" fill="var(--wheat)" transform={`rotate(-24 ${f1(e.x - 4)} ${f1(e.y - 4 - k * 7)})`} />
                <ellipse cx={f1(e.x + 4)} cy={f1(e.y - 7 - k * 7)} rx="2.8" ry="5.6" fill="var(--wheat)" transform={`rotate(24 ${f1(e.x + 4)} ${f1(e.y - 7 - k * 7)})`} />
              </g>
            ))}
            <path d={`M${f1(e.x)} ${f1(e.y - 38)}l0 -22`} stroke="var(--wheat)" strokeWidth="1.5" />
          </g>
        ))}
      </g>

      {/* falling carbon */}
      <g className="tr-fall" fill="var(--sun)">
        {S.falling.map((c, i) => (
          <g key={i} className="tr-co" style={v({ "--dx": `${f1(c.dx)}px`, "--dy": `${f1(c.dy)}px`, animationDuration: `${f1(c.dur)}s`, animationDelay: `${f1(c.del)}s` })}>
            <circle cx={f1(c.x)} cy="150" r="5" fill="#fff" stroke="#2a1d14" strokeWidth="1.2" />
            <text x={f1(c.x)} y="153" fontSize="7" textAnchor="middle" fill="#2a1d14" fontFamily="ui-monospace,monospace" fontWeight="700">C</text>
          </g>
        ))}
      </g>

      {/* labels */}
      <g className="tr-lab" fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace" fontSize="13">
        {labels.map(([k, t, y]) => (
          <g key={k}>
            <text x="22" y={y} fill="#f3ecda" opacity=".9"><tspan fontWeight="700" fill="#3be34f">{k}</tspan>  {t}</text>
          </g>
        ))}
        {ticks.map((t, i) => (
          <g key={t} opacity=".7">
            <path d={`M1140 ${tickY[i]}h38`} stroke="#f3ecda" strokeWidth="1" />
            <text x="1176" y={tickY[i] - 5} textAnchor="end" fill="#f3ecda">{t} cm</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */
const STEPS = [
  ["01", "Seed", "Living roots feed soil life from day one."],
  ["02", "Shoot", "Cover crops and wheat turn sunlight into sugar."],
  ["03", "Root", "Roots push carbon down through every horizon."],
  ["04", "Store", "Fungi lock it into stable humus for decades."],
];

function Hero({ reduced }: { reduced: boolean }) {
  return (
    <header className={`tr-hero${reduced ? " is-static" : ""}`} id="top">
      <div className="tr-stage" data-hero style={v({ "--p": reduced ? 1 : 0, "--gs": reduced ? 1 : 0, "--gr": reduced ? 1 : 0, "--gc": reduced ? 1 : 0, "--tp": 0 })}>
        <Scene />
        <div className="tr-hero-t">
          <p className="tr-eyebrow">Terra / regenerative farming collective</p>
          <h1>Grow the <br className="tr-br" /><em>ground</em> back.</h1>
          <p className="tr-lede">We help farms rebuild living soil, and we pay for the carbon it keeps. Scroll to plant a season.</p>
        </div>
        <div className="tr-hint" aria-hidden="true"><span>scroll to grow</span><i /></div>
        <div className="tr-counter" aria-live="off">
          <small>carbon banked in this hectare</small>
          <b><span data-counter>{reduced ? "+3.80" : "+0.00"}</span> <i>t CO₂e / yr</i></b>
        </div>
        <ol className="tr-steps" data-steps>
          {STEPS.map(([n, t, d], i) => (
            <li key={n} data-i={i}>
              <span>{n}</span>
              <b>{t}</b>
              <em>{d}</em>
            </li>
          ))}
        </ol>
      </div>
    </header>
  );
}

function Contours() {
  return (
    <section className="tr-sec tr-contour" id="land" data-prog>
      <svg className="tr-contour-svg" viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {CONTOURS.map((c, i) => (
          <g key={i}>
            <path className={`tr-dc${c.idx ? " idx" : ""}`} pathLength={1} d={c.d} fill="none" style={v({ "--d": c.delay })} />
            {c.label && <text className="tr-dc-l" x={f1(c.label.x)} y={f1(c.label.y)} style={v({ "--d": c.delay + 0.2 })}>{c.label.t}</text>}
          </g>
        ))}
        <path className="tr-dc fence" pathLength={1} d="M120 80L520 60L560 320L180 360Z" fill="none" style={v({ "--d": 0.85 })} />
      </svg>
      <div className="tr-wrap tr-contour-in">
        <div className="tr-card">
          <p className="tr-eyebrow dark">01 / Read the land</p>
          <h2>Plant the water <em>before</em> the crop.</h2>
          <p>
            Every Terra farm begins with a contour survey. We map slope, flow and
            infiltration, then place keylines, swales and cover so rain walks
            slowly through the field instead of running off it.
          </p>
          <dl className="tr-stats">
            <div><dt>-38%</dt><dd>runoff after two seasons</dd></div>
            <div><dt>2.1x</dt><dd>faster water infiltration</dd></div>
            <div><dt>0</dt><dd>days of bare soil</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}

const PRACTICES = [
  { n: "Agroforestry", v: 3.1 },
  { n: "Rotational grazing", v: 1.6 },
  { n: "Cover crops", v: 1.2 },
  { n: "Compost & biochar", v: 1.0 },
  { n: "No-till", v: 0.6 },
];
const TREND = [4.1, 12.8, 31, 58, 96, 141, 184.2];

function Ledger() {
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  const [tons, setTons] = useState(184206.4);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setTons(184206.4 + ((Date.now() - t0) / 1000) * 0.38), 100);
    return () => window.clearInterval(id);
  }, []);
  const pts = TREND.map((val, i) => `${40 + i * 90},${210 - (val / 190) * 180}`);
  const line = "M" + pts.join("L");
  return (
    <section className="tr-sec tr-ledger" id="carbon">
      <div className="tr-wrap" ref={ref}>
        <p className="tr-eyebrow">02 / The ledger</p>
        <h2>Every tonne, <em>counted in soil.</em></h2>
        <div className="tr-big" aria-live="off">
          <b>{tons.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b>
          <span>tonnes CO₂e verified in Terra soils since 2019</span>
        </div>
        <div className={`tr-ledger-grid${seen ? " in" : ""}`}>
          <div className="tr-panel">
            <h3>Per hectare, per year</h3>
            {PRACTICES.map((p, i) => (
              <div className="tr-bar" key={p.n}>
                <span>{p.n}</span>
                <div><i style={v({ "--w": p.v / 3.2, "--i": i })} /></div>
                <b>{p.v.toFixed(1)} t</b>
              </div>
            ))}
          </div>
          <div className="tr-panel">
            <h3>Cumulative, thousand tonnes</h3>
            <svg viewBox="0 0 640 240" role="img" aria-label="Carbon banked per year rising from 4 thousand tonnes in 2019 to 184 thousand in 2026">
              {[0, 1, 2, 3].map((k) => <path key={k} d={`M40 ${30 + k * 60}H620`} stroke="rgba(243,236,218,.14)" />)}
              <path className="tr-line" pathLength={1} d={line} fill="none" />
              <path className="tr-area" d={`${line}L${40 + 6 * 90} 210L40 210Z`} />
              {pts.map((p, i) => {
                const [x, y] = p.split(",");
                return (
                  <g key={i}>
                    <circle className="tr-dot" cx={x} cy={y} r="4.5" style={v({ "--i": i })} />
                    <text x={x} y="232" textAnchor="middle" className="tr-ax">{2019 + i}</text>
                  </g>
                );
              })}
            </svg>
            <p className="tr-note">Verified by deep-core sampling every five years. Credits retire only after verification.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FieldMap() {
  const [active, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const cur = PLOTS.find((p) => p.id === (active ?? pinned)) ?? null;
  const [ref, seen] = useInView<HTMLDivElement>(0.15);
  const fillFor = (k: Plot["kind"]) =>
    ({ wheat: "var(--wheat)", clover: "var(--leaf2)", pasture: "var(--leaf)", orchard: "#5a6b33", fallow: "#a58b63" })[k];
  return (
    <section className="tr-sec tr-plots" id="plots">
      <div className="tr-wrap">
        <p className="tr-eyebrow dark">03 / The farm map</p>
        <h2>Twelve plots, <em>each with a story.</em></h2>
        <div className={`tr-map-grid${seen ? " in" : ""}`} ref={ref}>
          <div className="tr-map">
            <svg viewBox="0 0 800 520" role="group" aria-label="Field map of Hollin Farm with twelve plots. Hover, focus or tap a plot for details.">
              <defs>
                {PLOTS.map((p) => <clipPath key={p.id} id={`tr-c-${p.id}`}><polygon points={p.clip} /></clipPath>)}
              </defs>
              <rect width="800" height="520" fill="rgba(42,29,20,.06)" />
              {PLOTS.map((p) => {
                const on = cur?.id === p.id;
                const lines = Array.from({ length: 16 }, (_, k) => k);
                return (
                  <g
                    key={p.id}
                    className={`tr-plot${on ? " on" : ""}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${p.name}, ${p.crop}`}
                    aria-pressed={pinned === p.id}
                    onMouseEnter={() => setActive(p.id)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(p.id)}
                    onBlur={() => setActive(null)}
                    onClick={() => setPinned((s) => (s === p.id ? null : p.id))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPinned((s) => (s === p.id ? null : p.id));
                      }
                    }}
                  >
                    <polygon points={p.poly} className="tr-plot-f" fill={fillFor(p.kind)} />
                    <g clipPath={`url(#tr-c-${p.id})`}>
                      <g transform={`rotate(${f1(p.ang)} ${f1(p.cx)} ${f1(p.cy)})`}>
                        {lines.map((k) => (
                          <path key={k} className="tr-row" pathLength={1} d={`M${f1(p.cx - 130)} ${f1(p.cy - 90 + k * 12)}H${f1(p.cx + 130)}`} style={v({ "--i": k })} />
                        ))}
                      </g>
                    </g>
                    <polygon points={p.poly} className="tr-plot-o" fill="none" />
                    <text x={f1(p.cx)} y={f1(p.cy + 4)} textAnchor="middle" className="tr-plot-t">{p.name}</text>
                  </g>
                );
              })}
              <path className="tr-river" d="M-10 262C120 240 190 300 330 270S560 230 650 275 760 300 810 285" fill="none" />
              <text x="700" y="304" className="tr-river-t" transform="rotate(8 700 304)">Alder Brook</text>
            </svg>
            <div className="tr-legend" aria-hidden="true">
              <span><i style={{ background: "var(--wheat)" }} />Grain</span>
              <span><i style={{ background: "var(--leaf2)" }} />Ley / veg</span>
              <span><i style={{ background: "var(--leaf)" }} />Pasture</span>
              <span><i style={{ background: "#5a6b33" }} />Trees</span>
              <span><i style={{ background: "#a58b63" }} />Rewilding</span>
            </div>
          </div>
          <aside className="tr-info" aria-live="polite">
            {cur ? (
              <>
                <p className="tr-eyebrow dark">{cur.crop}</p>
                <h3>{cur.name}</h3>
                <p className="tr-info-p">{cur.practice}, regenerative since {cur.since}.</p>
                <dl>
                  <div><dt>Area</dt><dd>{cur.ha} ha</dd></div>
                  <div><dt>Organic matter</dt><dd>{cur.som}%</dd></div>
                  <div><dt>Carbon</dt><dd>{cur.carbon} t/ha/yr</dd></div>
                </dl>
                <div className="tr-som"><i style={v({ "--w": Math.min(1, cur.som / 9) })} /></div>
                <small>Soil organic matter vs. a 9% native-prairie benchmark.</small>
              </>
            ) : (
              <>
                <p className="tr-eyebrow dark">Hollin Farm / 128 ha</p>
                <h3>Hover a plot.</h3>
                <p className="tr-info-p">Crop rows grow into the field and its soil numbers appear here. Tap or press Enter to pin one.</p>
              </>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

function Mycelium() {
  const [ref, seen] = useInView<HTMLDivElement>(0.25);
  const signals = MYC.edges.filter((_, i) => i % 9 === 0).slice(0, 6);
  return (
    <section className="tr-sec tr-myc" id="soil">
      <div className="tr-wrap tr-myc-grid" ref={ref}>
        <div className={`tr-myc-svg${seen ? " in" : ""}`}>
          <svg viewBox="0 0 600 400" role="img" aria-label="A procedurally drawn fungal network linking plant roots, with signals travelling along it">
            {MYC.edges.map((e, i) => <path key={i} className="tr-hy" pathLength={1} d={e.d} fill="none" style={v({ "--d": e.delay })} />)}
            {MYC.nodes.map((n, i) => <circle key={i} className="tr-nd" cx={f1(n.x)} cy={f1(n.y)} r={i === 0 ? 8 : 3} style={v({ "--d": i === 0 ? 0 : Math.min(0.8, (n.y - 40) / 420) })} />)}
            {signals.map((e, i) => <circle key={i} className="tr-sig" r="3.4" style={v({ offsetPath: `path("${e.d}")`, animationDelay: `${i * 0.9}s` })} />)}
          </svg>
        </div>
        <div>
          <p className="tr-eyebrow">04 / Under one footstep</p>
          <h2>The <em>wood-wide</em> web does the heavy lifting.</h2>
          <p className="tr-lead">
            Mycorrhizal fungi trade minerals for sugar and bind carbon into
            aggregates that outlast any single crop. Tillage tears the web;
            living cover rebuilds it. We measure both.
          </p>
          <div className="tr-count-row">
            <Count to={1000} suffix="M" label="bacteria in a teaspoon" go={seen} />
            <Count to={48} suffix=" m" label="fungal hyphae per gram" go={seen} />
            <Count to={19} suffix="%" label="more water held per point of organic matter" go={seen} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Count({ to, suffix, label, go }: { to: number; suffix: string; label: string; go: boolean }) {
  const [val, setVal] = useState(to);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setVal(0);
      return;
    }
    if (!go) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1600);
      setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [go, to]);
  return (
    <div className="tr-count">
      <b>{val.toLocaleString("en-US")}{suffix}</b>
      <span>{label}</span>
    </div>
  );
}

const LOOK: Record<string, string> = { p1: "a woman with a gray bob", p2: "a bearded man with dark hair", p3: "a woman with braided hair", p4: "a man with short curly hair", p5: "a smiling man with a short beard", p6: "a woman with long wavy dark hair", p7: "a bearded man in round glasses", p8: "a smiling man with swept-back hair", p9: "a woman with natural curly hair" };
const portraitAlt = (n: string, r: string, src: string) => `${n}, ${r}: portrait of ${LOOK[src.match(/p\d/)?.[0] ?? ""] ?? "a person"} in a black sweater`;

const VOICES = [
  { q: "We stopped fighting the field and started feeding it. Year four, the wheat stands in a drought and the earthworms are back in the headlands.", n: "Maren Holt", img: "/img/people/p1.webp", r: "Long Acre, 62 ha, Lower Saxony" },
  { q: "Terra paid for the hedgerows before the first harvest from them. That is the only reason my bank said yes.", n: "Joaquin Ferrer", img: "/img/people/p2.webp", r: "Vall Seca orchards, Catalonia" },
  { q: "The map showed me my worst corner was my best carbon. I would never have guessed. Now I plan around it.", n: "Aoife Brennan", img: "/img/people/p6.webp", r: "Mill Pasture, 40 ha, County Meath" },
];

function Voices() {
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  return (
    <section className="tr-sec tr-voices" id="growers">
      <div className="tr-wrap" ref={ref}>
        <p className="tr-eyebrow dark">05 / Growers</p>
        <h2>Farmers who <em>left the soil better.</em></h2>
        <div className={`tr-vgrid${seen ? " in" : ""}`}>
          {VOICES.map((x, i) => (
            <figure key={x.n} className="tr-voice" style={v({ "--i": i })}>
              <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><path d="M20 38V16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><path d="M20 22C8 22 6 12 6 6c8 0 14 4 14 16ZM20 18c0-9 5-12 14-12 0 7-4 12-14 12Z" fill="var(--leaf)" /></svg>
              <blockquote>{x.q}</blockquote>
              <figcaption><img src={x.img} alt={portraitAlt(x.n, `farmer at ${x.r}`, x.img)} width={52} height={52} loading="lazy" decoding="async" /><b>{x.n}</b><span>{x.r}</span></figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Field() {
  const stalks = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 56 }, (_, i) => ({ x: i * 22 + r() * 12, h: 60 + r() * 90, d: r() * 0.4, s: 3 + r() * 3, del: -r() * 5 }));
  }, []);
  return (
    <svg className="tr-field" viewBox="0 0 1240 180" preserveAspectRatio="none" aria-hidden="true">
      {stalks.map((s, i) => (
        <g key={i} className="tr-fs" style={v({ "--d": s.d, animationDuration: `${s.s}s`, animationDelay: `${s.del}s`, transformOrigin: `${f1(s.x)}px 180px` })}>
          <path d={`M${f1(s.x)} 180Q${f1(s.x + 4)} ${180 - s.h / 2} ${f1(s.x + 2)} ${180 - s.h}`} stroke="var(--wheat)" strokeWidth="2.5" fill="none" />
          <ellipse cx={f1(s.x + 2)} cy={180 - s.h - 8} rx="3.4" ry="9" fill="var(--wheat)" />
          <path d={`M${f1(s.x)} ${180 - s.h * 0.3}q-14 -10 -20 -26`} stroke="var(--leaf)" strokeWidth="2.5" fill="none" />
        </g>
      ))}
    </svg>
  );
}

function Join() {
  const [done, setDone] = useState(false);
  const [ha, setHa] = useState("50-200");
  const [mail, setMail] = useState("");
  const [err, setErr] = useState("");
  return (
    <section className="tr-sec tr-join" id="join" data-prog>
      <div className="tr-wrap tr-join-in">
        <p className="tr-eyebrow">06 / Begin</p>
        <h2>Start with a <em>soil test.</em></h2>
        <p className="tr-lead">We core, map and model your land for free. If the numbers work, we co-fund the first three years of transition.</p>
        {done ? (
          <div className="tr-done" role="status"><b>Seed planted.</b> A Terra agronomist will write to {mail} within two working days.</div>
        ) : (
          <form
            className="tr-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!/.+@.+\..+/.test(mail)) return setErr("Please enter a valid e-mail.");
              setErr("");
              setDone(true);
            }}
          >
            <label>Farm size
              <select value={ha} onChange={(e) => setHa(e.target.value)}>
                {["under 20", "20-50", "50-200", "200-1000", "over 1000"].map((x) => <option key={x} value={x}>{x} ha</option>)}
              </select>
            </label>
            <label>E-mail
              <input type="email" value={mail} onChange={(e) => setMail(e.target.value)} placeholder="you@farm.example" autoComplete="email" />
            </label>
            <button type="submit">Request a soil test</button>
            {err && <p className="tr-err" role="alert">{err}</p>}
          </form>
        )}
      </div>
      <Field />
      <footer className="tr-foot">
        <span>Terra Regenerative Collective, 2026</span>
        <span>Soil is the largest living carbon store we can rebuild.</span>
      </footer>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
function Nav({ children }: { children?: ReactNode }) {
  return (
    <nav className="tr-nav" aria-label="Main">
      <a href="#top" className="tr-logo">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 22V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M12 14C5 14 3 8 3 3c6 0 9 3 9 11ZM12 11c0-6 3-8 9-8 0 5-3 8-9 8Z" fill="#3be34f" stroke="currentColor" strokeWidth="1.2" /></svg>
        Terra
      </a>
      <div className="tr-links">
        <a href="#land">Land</a><a href="#carbon">Carbon</a><a href="#plots">Plots</a><a href="#soil">Soil</a><a href="#growers">Growers</a>
      </div>
      <a className="tr-cta" href="#join">Soil test</a>
      {children}
    </nav>
  );
}

export function Page() {
  const root = useRef<HTMLDivElement | null>(null);
  const [season, setSeason] = useState(0.35);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (root.current) applySeason(root.current, season);
  }, [season]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(rm);
    if (rm) return;
    const stage = el.querySelector<HTMLElement>("[data-hero]");
    const track = stage?.parentElement ?? null;
    const counter = el.querySelector<HTMLElement>("[data-counter]");
    const steps = el.querySelector<HTMLElement>("[data-steps]");
    const progs = Array.from(el.querySelectorAll<HTMLElement>("[data-prog]"));
    const clamp = (x: number) => Math.max(0, Math.min(1, x));
    let raf = 0;
    let lastP = -1;
    let lastStep = -1;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      if (stage && track) {
        const rect = track.getBoundingClientRect();
        const p = clamp(-rect.top / Math.max(1, rect.height - vh));
        if (Math.abs(p - lastP) > 0.0004) {
          lastP = p;
          const gs = clamp(p / 0.42);
          const gr = clamp((p - 0.28) / 0.5);
          const gc = clamp((p - 0.5) / 0.45);
          stage.style.setProperty("--p", p.toFixed(4));
          stage.style.setProperty("--gs", gs.toFixed(4));
          stage.style.setProperty("--gr", gr.toFixed(4));
          stage.style.setProperty("--gc", gc.toFixed(4));
          if (counter) counter.textContent = "+" + (gc * 3.8).toFixed(2);
          const step = p < 0.1 ? 0 : p < 0.38 ? 1 : p < 0.7 ? 2 : 3;
          if (step !== lastStep && steps) {
            lastStep = step;
            steps.dataset.step = String(step);
          }
        }
      }
      progs.forEach((s) => {
        const r = s.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        s.style.setProperty("--sp", clamp((vh - r.top) / (vh * 0.85 + r.height * 0.5)).toFixed(4));
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const sIdx = Math.min(3, Math.round(season));
  return (
    <div className={`tr${reduced ? " reduced" : ""}`} ref={root}>
      <style>{CSS}</style>
      <Nav />
      <Hero reduced={reduced} />
      <div className="tr-edge" aria-hidden="true">
        <svg aria-hidden="true" focusable="false" viewBox="0 0 1200 60" preserveAspectRatio="none"><path d="M0 0H1200V30Q1100 55 1000 34T800 34T600 26T400 38T200 26T0 36Z" fill="#2b1c12" /></svg>
      </div>
      <main>
        <Contours />
        <Ledger />
        <FieldMap />
        <Mycelium />
        <Voices />
        <Join />
      </main>
      <div className="tr-season" role="group" aria-label="Season">
        <span className="tr-season-n">{SEASONS[sIdx]}</span>
        <input
          type="range"
          min={0}
          max={3}
          step={0.01}
          value={season}
          aria-label="Season, spring to winter"
          aria-valuetext={SEASONS[sIdx]}
          onChange={(e) => setSeason(Number(e.target.value))}
        />
        <div className="tr-season-t" aria-hidden="true">{SEASONS.map((s) => <span key={s}>{s.slice(0, 3)}</span>)}</div>
      </div>
    </div>
  );
}

export default Page;

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const CSS = `
.tr{--soil:#2b1c12;--soil2:#5b3d26;--moss:#5a6b33;--ink:#2a1d14;--cream:#f3ecda;--chl:#3be34f;
  --sky1:#cfe8d8;--sky2:#f6f0d6;--leaf:#6fae3b;--leaf2:#9ccf4a;--wheat:#b8c46a;--bg:#f3ecda;--sun:#ffe08a;--bloom:.9;--snow:0;--sy:0px;--hill:#7fae5a;
  --serif:"Fraunces","Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
  --sans:"Instrument Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  box-sizing:border-box;position:relative;font-family:var(--sans);font-size:16px;line-height:1.55;color:var(--ink);background:var(--bg);transition:background-color .3s;overflow-x:clip}
.tr *,.tr *::before,.tr *::after{box-sizing:border-box}
.tr h1,.tr h2,.tr h3{font-family:var(--serif);font-weight:500;line-height:1.02;letter-spacing:-.02em;margin:0}
.tr h2{font-size:clamp(34px,5.4vw,70px);margin-bottom:22px}
.tr h3{font-size:22px;letter-spacing:-.01em}
.tr em{font-style:italic;color:var(--moss)}
.tr p{margin:0 0 1em}
.tr a{color:inherit}
.tr-wrap{max-width:1160px;margin:0 auto;padding:0 28px;position:relative}
.tr-eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 16px;color:var(--cream);opacity:.85}
.tr-eyebrow.dark{color:var(--moss);opacity:1}
.tr-sec{position:relative;padding:120px 0}
.tr-lead{font-size:19px;max-width:52ch}

/* nav */
.tr-nav{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;gap:24px;padding:14px 28px;color:var(--cream);mix-blend-mode:normal}
.tr .tr-logo{display:flex;align-items:center;gap:8px;font-family:var(--serif);font-size:24px;text-decoration:none;font-weight:600;color:var(--ink);background:rgba(243,236,218,.85);padding:4px 12px 4px 8px;border-radius:99px}
.tr-links{display:flex;gap:4px;margin-left:auto;background:rgba(243,236,218,.85);padding:4px;border-radius:99px;color:var(--ink)}
.tr-links a{padding:6px 12px;border-radius:99px;font-size:14px;text-decoration:none}
.tr-links a:hover{background:var(--ink);color:var(--cream)}
.tr-cta{background:var(--chl);color:#0c2a10!important;padding:9px 16px;border-radius:99px;font-weight:700;font-size:14px;text-decoration:none}
.tr a:focus-visible,.tr button:focus-visible,.tr select:focus-visible,.tr input:focus-visible,.tr .tr-plot:focus-visible{outline:3px solid var(--chl);outline-offset:3px}

/* hero */
.tr-hero{position:relative;height:480vh;background:var(--soil)}
.tr-hero.is-static{height:100vh;min-height:680px}
.tr-stage{position:sticky;top:0;height:100vh;min-height:620px;overflow:hidden;background:var(--soil)}
.tr-scene{position:absolute;inset:0;width:100%;height:100%;display:block}
.tr-sun{transform:translateY(var(--sy));transition:transform .2s}
.tr-halo{opacity:.25}
.tr-cl{animation:tr-cloud 60s linear infinite alternate}
.tr-cl.b{animation-duration:80s}.tr-cl.c{animation-duration:50s}
@keyframes tr-cloud{from{transform:translateX(-60px)}to{transform:translateX(80px)}}
.tr-snow{opacity:var(--snow)}
.tr-ds,.tr-dr{--q:clamp(0,calc((var(--gs) * 1.4 - var(--d,0)) * 3),1);stroke-dasharray:1;stroke-dashoffset:calc(1 - var(--q))}
.tr-dr{--q:clamp(0,calc((var(--gr) * 1.4 - var(--d,0)) * 3),1)}
.tr-ds,.tr-dr{opacity:clamp(0,calc(var(--q) * 60),1)}
.tr-dr{opacity:clamp(0,calc(var(--q) * 60),1)}
.tr-sc{--q:clamp(0,calc((var(--gs) * 1.4 - var(--d,0)) * 3),1);transform-box:fill-box;transform-origin:50% 100%}
ellipse.tr-sc{transform-origin:50% 50%}
.tr-sc{opacity:clamp(0,calc(var(--q) * 60),1);scale:calc(var(--q) * var(--bloom,1))}
.tr-fleck{--q:clamp(0,calc((var(--gc) * 1.5 - var(--d,0)) * 3),1);fill:var(--chl);opacity:clamp(0,calc(var(--q) * .95),.95)}
.tr-fall{opacity:clamp(0,calc(var(--p) * 6 - .1),.95)}
.tr-co{animation:tr-fall 9s linear infinite}
@keyframes tr-fall{0%{transform:translate(0,0);opacity:0}10%{opacity:1}60%{opacity:1}100%{transform:translate(var(--dx),var(--dy));opacity:0}}
.tr-lab{opacity:clamp(0,calc(var(--gr) * 3 - .3),1)}
.tr-hero-t{position:absolute;left:0;right:0;top:10vh;text-align:center;padding:0 24px;opacity:clamp(0,calc(1 - var(--p) * 5.5),1);transform:translateY(calc(var(--p) * -90px));pointer-events:none;color:var(--ink)}
.tr-hero.is-static .tr-hero-t{opacity:1;transform:none}
.tr-hero-t .tr-eyebrow{color:var(--ink);opacity:.75}
.tr-br{display:none}
.tr-hero h1{font-size:clamp(46px,7.8vw,118px);white-space:nowrap;font-weight:400;line-height:.92;letter-spacing:-.035em}
.tr-hero h1 em{color:#2f6b1b;font-weight:300}
.tr .tr-lede{font-size:clamp(16px,1.7vw,21px);max-width:44ch;margin:20px auto 0}
.tr-hint{position:absolute;left:50%;bottom:92px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--cream);opacity:clamp(0,calc(1 - var(--p) * 14),1)}
.tr-hint i{width:2px;height:34px;background:var(--chl);animation:tr-hint 1.6s ease-in-out infinite;transform-origin:top}
@keyframes tr-hint{0%{transform:scaleY(0)}60%{transform:scaleY(1)}100%{transform:scaleY(1);opacity:0}}
.tr-counter{position:absolute;left:28px;bottom:96px;background:rgba(27,16,9,.84);padding:14px 20px 12px;border-radius:4px;color:var(--cream);opacity:clamp(0,calc(var(--p) * 5),1);pointer-events:none}
.tr-counter small{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.8}
.tr-counter b{font-family:var(--serif);font-weight:400;font-size:clamp(40px,6vw,76px);line-height:1;color:var(--chl);font-variant-numeric:tabular-nums}
.tr-counter i{font-family:var(--mono);font-style:normal;font-size:13px;color:var(--cream)}
.tr-steps{position:absolute;right:28px;bottom:96px;list-style:none;margin:0;padding:16px 20px;width:min(320px,42vw);height:122px;background:rgba(27,16,9,.84);border-radius:4px;color:var(--cream);opacity:clamp(0,calc(var(--p) * 8),1)}
.tr-steps li{position:absolute;inset:16px 20px;opacity:0;transform:translateY(14px);transition:opacity .4s,transform .4s;display:flex;flex-direction:column;gap:2px}
.tr-steps li span{font-family:var(--mono);font-size:12px;color:var(--chl)}
.tr-steps li b{font-family:var(--serif);font-weight:500;font-size:34px;line-height:1}
.tr-steps li em{font-style:normal;font-size:14px;color:var(--cream);opacity:.85}
.tr-steps[data-step="0"] li[data-i="0"],.tr-steps[data-step="1"] li[data-i="1"],.tr-steps[data-step="2"] li[data-i="2"],.tr-steps[data-step="3"] li[data-i="3"]{opacity:1;transform:none}
.tr-hero.is-static .tr-steps li[data-i="3"]{opacity:1;transform:none}
.tr-hero.is-static .tr-hint{display:none}
.tr-edge{height:48px;margin-top:-1px;background:var(--bg);line-height:0;transition:background-color .3s}
.tr-edge svg{width:100%;height:48px;display:block}

/* contours */
.tr-contour{overflow:hidden;--sp:0;padding:140px 0 120px}
.tr-contour-svg{position:absolute;inset:0;width:100%;height:100%}
.tr-dc{--q:clamp(0,calc((var(--sp) * 1.5 - var(--d,0)) * 3),1);stroke:var(--moss);stroke-width:1.2;opacity:.55;stroke-dasharray:1;stroke-dashoffset:calc(1 - var(--q))}
.tr-dc.idx{stroke-width:2.4;opacity:.9}
.tr-dc.fence{stroke:var(--chl);stroke-width:3;stroke-dasharray:1;opacity:1;filter:drop-shadow(0 0 4px rgba(59,227,79,.5))}
.tr-dc-l{--q:clamp(0,calc((var(--sp) * 1.5 - var(--d,0)) * 3),1);font-family:var(--mono);font-size:11px;fill:var(--ink);opacity:var(--q)}
.reduced .tr-contour,.reduced .tr-join{--sp:1}
.tr-contour-in{display:flex;justify-content:flex-end}
.tr-card{width:min(540px,100%);background:rgba(243,236,218,.92);padding:40px;border:1.5px solid var(--ink);border-radius:4px;box-shadow:10px 10px 0 var(--soil2)}
.tr-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:26px 0 0;border-top:1.5px solid var(--ink);padding-top:18px}
.tr-stats div{display:flex;flex-direction:column-reverse}
.tr-stats dt{font-family:var(--serif);font-size:38px;line-height:1;font-weight:500}
.tr-stats dd{margin:0;font-size:12.5px;line-height:1.3;opacity:.8}

/* ledger */
.tr-ledger{background:var(--soil);color:var(--cream)}
.tr-ledger em{color:var(--chl)}
.tr-big{display:flex;flex-direction:column;gap:4px;margin:0 0 56px}
.tr-big b{font-family:var(--serif);font-weight:400;font-size:clamp(46px,9.5vw,132px);line-height:1;letter-spacing:-.03em;color:var(--chl);font-variant-numeric:tabular-nums;text-shadow:0 0 40px rgba(59,227,79,.25)}
.tr-big span{font-family:var(--mono);font-size:13px;letter-spacing:.1em;text-transform:uppercase;opacity:.8}
.tr-ledger-grid{display:grid;grid-template-columns:1fr 1.15fr;gap:24px}
.tr-panel{border:1px solid rgba(243,236,218,.25);padding:28px;border-radius:4px;background:rgba(243,236,218,.04)}
.tr-panel h3{margin-bottom:20px;font-size:20px}
.tr-bar{display:grid;grid-template-columns:130px 1fr 52px;gap:12px;align-items:center;margin:0 0 14px;font-size:14px}
.tr-bar div{height:14px;background:rgba(243,236,218,.1);overflow:hidden}
.tr-bar i{display:block;height:100%;background:var(--chl);transform-origin:left;transform:scaleX(0);transition:transform 1.2s cubic-bezier(.2,.7,.2,1);transition-delay:calc(var(--i) * .12s)}
.in .tr-bar i{transform:scaleX(var(--w))}
.tr-bar b{font-family:var(--mono);font-weight:500;text-align:right;font-size:13px}
.tr-ledger svg{width:100%;height:auto;display:block}
.tr-line{stroke:var(--chl);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 2s ease .2s}
.in .tr-line{stroke-dashoffset:0}
.tr-area{fill:rgba(59,227,79,.12);opacity:0;transition:opacity 1s 1.6s}
.in .tr-area{opacity:1}
.tr-dot{fill:var(--soil);stroke:var(--chl);stroke-width:2.5;opacity:0;transition:opacity .3s calc(.3s + var(--i) * .26s)}
.in .tr-dot{opacity:1}
.tr-ax{font-family:var(--mono);font-size:11px;fill:var(--cream);opacity:.7}
.tr-note{font-size:13px;opacity:.7;margin:14px 0 0}

/* plots */
.tr-plots{background:var(--bg);transition:background-color .3s}
.tr-map-grid{display:grid;grid-template-columns:1.7fr 1fr;gap:28px;align-items:start}
.tr-map{border:1.5px solid var(--ink);background:rgba(255,255,255,.35);padding:12px;border-radius:4px}
.tr-map svg{width:100%;height:auto;display:block}
.tr-plot{cursor:pointer;outline:none}
.tr-plot-f{opacity:.38;transition:opacity .3s}
.tr-plot-o{stroke:var(--ink);stroke-width:1.5;stroke-linejoin:round}
.tr-plot.on .tr-plot-f{opacity:.85}
.tr-plot.on .tr-plot-o{stroke-width:3;stroke:var(--ink)}
.tr-row{stroke:#2a1d14;stroke-width:1.6;opacity:.7;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset .8s ease;transition-delay:calc(var(--i) * 30ms)}
.tr-plot.on .tr-row{stroke-dashoffset:0}
.tr-plot-t{font-family:var(--mono);font-size:11px;font-weight:700;fill:var(--ink);paint-order:stroke;stroke:rgba(243,236,218,.85);stroke-width:3px;pointer-events:none}
.tr-river{stroke:#7fb8c4;stroke-width:12;stroke-linecap:round;opacity:.85;pointer-events:none}
.tr-river-t{font-family:var(--serif);font-style:italic;font-size:12px;fill:#2c5a66;pointer-events:none}
.tr-legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-family:var(--mono);font-size:11px;padding:10px 4px 2px}
.tr-legend span{display:flex;align-items:center;gap:6px}.tr-legend i{width:12px;height:12px;border:1px solid var(--ink)}
.tr-info{position:sticky;top:90px;border:1.5px solid var(--ink);padding:28px;background:var(--cream);border-radius:4px;box-shadow:8px 8px 0 var(--soil2);min-height:300px}
.tr-info h3{font-size:36px;margin-bottom:10px}
.tr-info-p{font-size:15px}
.tr-info dl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0;border-top:1.5px solid var(--ink);padding-top:14px}
.tr-info dl div{display:flex;flex-direction:column-reverse}
.tr-info dt{font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;opacity:.7}
.tr-info dd{margin:0;font-family:var(--serif);font-size:24px;line-height:1.1}
.tr-som{height:10px;background:rgba(42,29,20,.12);overflow:hidden}
.tr-som i{display:block;height:100%;background:var(--chl);transform-origin:left;transform:scaleX(var(--w));transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.tr-info small{display:block;margin-top:8px;font-size:12px;opacity:.7}

/* mycelium */
.tr-myc{background:#1f150d;color:var(--cream)}
.tr-myc em{color:var(--chl)}
.tr-myc-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:56px;align-items:center}
.tr-myc-svg svg{width:100%;height:auto;display:block}
.tr-hy{stroke:rgba(243,236,218,.7);stroke-width:1.2;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1.4s ease;transition-delay:calc(var(--d) * 2.2s)}
.in .tr-hy{stroke-dashoffset:0}
.tr-nd{fill:var(--chl);opacity:0;transition:opacity .4s calc(var(--d) * 2.2s + .8s)}
.in .tr-nd{opacity:1}
.tr-sig{fill:#fff;offset-distance:0%;opacity:0;filter:drop-shadow(0 0 4px var(--chl))}
.in .tr-sig{animation:tr-sig 3.4s linear 2.6s infinite}
@keyframes tr-sig{0%{offset-distance:0%;opacity:0}10%{opacity:1}90%{opacity:1}100%{offset-distance:100%;opacity:0}}
.tr-count-row{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:34px;border-top:1px solid rgba(243,236,218,.3);padding-top:22px}
.tr-count b{display:block;font-family:var(--serif);font-weight:400;font-size:clamp(28px,3.4vw,44px);color:var(--chl);line-height:1;font-variant-numeric:tabular-nums}
.tr-count span{font-size:12.5px;line-height:1.3;display:block;margin-top:6px;opacity:.8}

/* voices */
.tr-voices{background:var(--bg);transition:background-color .3s;padding-bottom:140px}
.tr-vgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.tr-voice{margin:0;padding:30px;background:var(--cream);border:1.5px solid var(--ink);border-radius:4px;display:flex;flex-direction:column;gap:16px;clip-path:inset(100% 0 0 0);transition:clip-path 1s cubic-bezier(.2,.7,.2,1);transition-delay:calc(var(--i) * .18s);color:var(--ink)}
.in .tr-voice{clip-path:inset(0 0 0 0)}
.tr-voice:nth-child(2){margin-top:32px}
.tr-voice blockquote{margin:0;font-family:var(--serif);font-size:21px;line-height:1.3;flex:1}
.tr-voice figcaption{display:grid;grid-template-columns:52px minmax(0,1fr);column-gap:14px;align-items:center;font-size:13px}
.tr-voice figcaption img{grid-row:1 / span 2;width:52px;height:52px;border-radius:50%;object-fit:cover;object-position:center top;border:1.5px solid var(--ink)}
.tr-voice figcaption span{opacity:.7}

/* join */
.tr-join{background:var(--soil);color:var(--cream);overflow:hidden;--sp:0;padding-bottom:0}
.tr-join em{color:var(--chl)}
.tr-join-in{padding-bottom:120px;z-index:2}
.tr-form{display:grid;grid-template-columns:200px 1fr auto;gap:12px;align-items:end;max-width:760px;margin-top:28px}
.tr-form label{display:flex;flex-direction:column;gap:6px;font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.tr-form input,.tr-form select{font:inherit;font-family:var(--sans);font-size:16px;letter-spacing:0;text-transform:none;padding:13px 14px;border:1.5px solid var(--cream);background:transparent;color:var(--cream);border-radius:4px;width:100%}
.tr-form select option{color:var(--ink)}
.tr-form input::placeholder{color:rgba(243,236,218,.5)}
.tr-form button{font:inherit;font-weight:700;padding:14px 22px;background:var(--chl);color:#0c2a10;border:0;border-radius:4px;cursor:pointer;transition:transform .15s}
.tr-form button:hover{transform:translateY(-2px)}
.tr-err{grid-column:1/-1;color:#ff9d8a;margin:0;font-size:14px}
.tr-done{margin-top:28px;padding:20px;border:1.5px solid var(--chl);max-width:560px;border-radius:4px}
.tr-field{position:absolute;left:0;right:0;bottom:46px;width:100%;height:180px;transform-origin:50% 100%;transform:scaleY(clamp(0,calc(var(--sp) * 1.3 - .2),1));opacity:clamp(0,calc(var(--sp) * 4 - .5),1)}
.tr-fs{animation:tr-sway 4s ease-in-out infinite alternate}
@keyframes tr-sway{from{transform:rotate(-2.5deg)}to{transform:rotate(2.5deg)}}
.tr-foot{position:relative;z-index:2;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:14px 28px;font-family:var(--mono);font-size:12px;background:#1a110a;margin-top:140px;color:var(--cream)}
.tr-join{padding-bottom:0}
.tr-join .tr-field{bottom:46px}

/* season slider */
.tr-season{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:60;width:min(420px,calc(100vw - 32px));background:rgba(243,236,218,.94);border:1.5px solid var(--ink);border-radius:14px;padding:8px 16px 8px;box-shadow:5px 5px 0 var(--soil2);display:grid;grid-template-columns:auto 1fr;gap:2px 14px;align-items:center}
.tr-season-n{font-family:var(--serif);font-size:20px;min-width:76px;color:var(--ink)}
.tr-season input{width:100%;accent-color:#1fa33a;margin:0;height:24px}
.tr-season-t{grid-column:2;display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink);opacity:.7}

@media (max-width:960px){
  .tr-ledger-grid,.tr-map-grid,.tr-myc-grid{grid-template-columns:1fr}
  .tr-info{position:static;min-height:0}
  .tr-vgrid{grid-template-columns:1fr}.tr-voice:nth-child(2){margin-top:0}
  .tr-links{display:none}.tr-nav{padding:12px 16px}.tr-cta{margin-left:auto}
  .tr-sec{padding:84px 0}
}
@media (max-width:900px){.tr-br{display:inline}.tr-hero h1{font-size:clamp(46px,15vw,92px);white-space:normal}}
@media (max-width:640px){
  .tr-wrap{padding:0 16px}
  .tr-lab{display:none}
  .tr-counter{left:16px;bottom:100px;padding:10px 14px}
  .tr-steps{right:16px;left:16px;width:auto;bottom:206px;height:84px}
  .tr-steps li b{font-size:24px}
  .tr-steps li em{font-size:13px}
  .tr-hero-t{top:11vh}
  .tr-card{padding:26px}
  .tr-stats{grid-template-columns:1fr 1fr 1fr}.tr-stats dt{font-size:28px}
  .tr-bar{grid-template-columns:96px 1fr 44px;font-size:12.5px}
  .tr-panel{padding:18px}
  .tr-count-row{grid-template-columns:1fr}
  .tr-form{grid-template-columns:1fr}
  .tr-info h3{font-size:30px}
  .tr-foot{margin-top:100px}
}
@media (prefers-reduced-motion:reduce){
  .tr *,.tr *::before,.tr *::after{animation:none!important;transition:none!important}
  .tr-hint{display:none}
  .tr-voice{clip-path:none}
  .tr-bar i{transform:scaleX(var(--w))}
  .tr-line{stroke-dashoffset:0}.tr-area,.tr-dot,.tr-nd{opacity:1}
  .tr-hy{stroke-dashoffset:0}
  .tr-row{stroke-dashoffset:0}
  .tr-field{--sp:1}
}
`;
