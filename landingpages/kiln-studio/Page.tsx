/**
 * Kiln, a ceramics & design studio whose whole portfolio is an infinite,
 * pannable, zoomable canvas.
 *
 * First screen: the canvas at overview zoom with the studio name cut into a
 * clay slab. Project cards, notebook slips, process sketches and a studio map
 * are scattered over the plane at different depths (parallax: nearer layers
 * move faster than the camera). Drag with momentum, wheel/trackpad pan,
 * ctrl/pinch zoom, arrow keys, minimap in the corner. Clicking (or Tab-focusing)
 * a card flies the camera to it; Enter/click expands a case-study panel.
 * "Return to overview" flies back. A List view toggle (default for
 * prefers-reduced-motion) shows the same content as a plain grid.
 *
 * Below the canvas: manifesto words that fire as you scroll, a pinned
 * "throwing" scene where a lump of clay morphs into a vase, a pinned kiln
 * firing curve that draws itself while the peephole heats up, an interactive
 * glaze library, a commission form and a footer.
 *
 * Only react is imported. No images, no web fonts, no network. Everything is
 * procedural SVG / CSS. SSR-safe (no window/document during render).
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */
function rng(seed: number) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Catmull-Rom through points, emitted as cubic segments (no leading M). */
function seg(pts: number[][]): string {
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d;
}
type Prof = number[][];
/** Closed silhouette of a thrown form from a half-profile [radius, y]. */
function outline(prof: Prof, cx: number): string {
  const right = prof.map(([r, y]) => [cx + r, y]);
  const left = prof.map(([r, y]) => [cx - r, y]).reverse();
  return `M${f1(right[0][0])} ${f1(right[0][1])}${seg(right)}L${f1(left[0][0])} ${f1(left[0][1])}${seg(left)}Z`;
}
function rAt(prof: Prof, y: number): number {
  for (let i = 0; i < prof.length - 1; i++) {
    const a = prof[i], b = prof[i + 1];
    if (y >= a[1] && y <= b[1]) return lerp(a[0], b[0], (y - a[1]) / Math.max(0.001, b[1] - a[1]));
  }
  return y < prof[0][1] ? prof[0][0] : prof[prof.length - 1][0];
}

/* ================================================================== */
/* Glazes and thrown forms                                             */
/* ================================================================== */
type Glz = { a: string; b: string; clay: string; speck: string; mode: "dip" | "full" | "bare"; line?: number };
const GL: Record<string, Glz> = {
  tide: { a: "#6B9AAB", b: "#2F5668", clay: "#B5573A", speck: "#1d3b4a", mode: "dip", line: 0.58 },
  bone: { a: "#F1E8D6", b: "#CDBF9F", clay: "#B5573A", speck: "#7a5a3d", mode: "dip", line: 0.72 },
  iron: { a: "#55433b", b: "#1f1a18", clay: "#A5502F", speck: "#c58a58", mode: "full" },
  ember: { a: "#CF6A45", b: "#8A3320", clay: "#B5573A", speck: "#3a1a10", mode: "full" },
  ochre: { a: "#DDAB6A", b: "#A8713A", clay: "#B5573A", speck: "#5a3a1a", mode: "dip", line: 0.46 },
  raw: { a: "#D08A66", b: "#8F3F28", clay: "#C07049", speck: "#4A2E22", mode: "bare" },
};
const PROF: Record<string, Prof> = {
  bowl: [[100, 110], [98, 124], [86, 152], [62, 178], [44, 194], [42, 200]],
  vase: [[30, 40], [28, 56], [44, 92], [68, 128], [72, 158], [60, 188], [52, 200]],
  mug: [[52, 100], [54, 130], [54, 170], [50, 194], [50, 200]],
  lamp: [[16, 44], [24, 60], [62, 92], [104, 140], [122, 184], [124, 200]],
  planter: [[84, 96], [86, 108], [74, 160], [62, 196], [60, 200]],
  jug: [[24, 80], [28, 104], [54, 128], [68, 158], [64, 188], [56, 200]],
  cup: [[34, 150], [36, 170], [30, 192], [26, 200]],
};

function Vessel({ prof, glaze, seed, handle }: { prof: Prof; glaze: Glz; seed: number; handle?: { y1: number; y2: number; out: number } }) {
  const uid = "knv" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const cx = 150;
  const g = glaze;
  const calc = useMemo(() => {
    const rnd = rng(seed);
    const ys = prof.map((p) => p[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const mr = Math.max(...prof.map((p) => p[0]));
    const yb = y0 + (y1 - y0) * (g.line ?? 0.6);
    let glazeD = "";
    if (g.mode === "full") glazeD = `M${cx - mr - 20} ${y0 - 40}H${cx + mr + 20}V${y1 + 20}H${cx - mr - 20}Z`;
    if (g.mode === "dip") {
      const pts: number[][] = [];
      for (let x = cx - mr - 12; x <= cx + mr + 12; x += 12) {
        const drip = rnd() < 0.2 ? 6 + rnd() * 26 : 0;
        pts.push([x, yb + Math.sin(x * 0.07 + seed) * 5 + drip]);
      }
      glazeD = `M${pts[0][0]} ${y0 - 40}L${pts[0][0]} ${f1(pts[0][1])}${seg(pts)}L${pts[pts.length - 1][0]} ${y0 - 40}Z`;
    }
    const specks: { x: number; y: number; r: number; l: boolean }[] = [];
    const n = g.mode === "bare" ? 110 : 56;
    for (let i = 0; i < n; i++) specks.push({ x: cx + (rnd() * 2 - 1) * mr, y: y0 + rnd() * (y1 - y0), r: 0.5 + rnd() * 1.2, l: rnd() < 0.3 });
    const rings: { y: number; w: number }[] = [];
    for (let y = y0 + 8; y < y1; y += 7.5) rings.push({ y, w: (rnd() - 0.5) * 3 });
    const mott = [0, 1, 2].map(() => ({ x: cx + (rnd() * 2 - 1) * mr * 0.7, y: y0 + rnd() * (y1 - y0), rx: 14 + rnd() * 24, ry: 8 + rnd() * 14 }));
    return { y0, y1, mr, yb, glazeD, specks, rings, mott, d: outline(prof, cx) };
  }, [prof, seed, g]);
  const { y0, y1, mr, glazeD, specks, rings, mott, d } = calc;
  const rx0 = prof[0][0];
  let handleEl: ReactNode = null;
  if (handle) {
    const ra = rAt(prof, handle.y1) - 2, rb = rAt(prof, handle.y2) - 2;
    const hd = `M${cx + ra} ${handle.y1}C${cx + ra + handle.out} ${handle.y1 - 10} ${cx + rb + handle.out} ${handle.y2 + 10} ${cx + rb} ${handle.y2}`;
    handleEl = (
      <g fill="none" strokeLinecap="round">
        <path d={hd} stroke={g.mode === "bare" ? g.clay : g.a} strokeWidth="11" />
        <path d={hd} stroke="#000" strokeOpacity=".14" strokeWidth="3" transform="translate(1.5 2)" />
      </g>
    );
  }
  return (
    <g>
      <defs>
        <clipPath id={uid + "c"}><path d={d} /></clipPath>
        <linearGradient id={uid + "g"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={g.a} /><stop offset="1" stopColor={g.b} />
        </linearGradient>
        <linearGradient id={uid + "s"} gradientUnits="userSpaceOnUse" x1={cx - mr} y1="0" x2={cx + mr} y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".46" />
          <stop offset=".16" stopColor="#000" stopOpacity=".1" />
          <stop offset=".34" stopColor="#fff" stopOpacity=".26" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          <stop offset=".82" stopColor="#000" stopOpacity=".16" />
          <stop offset="1" stopColor="#000" stopOpacity=".52" />
        </linearGradient>
      </defs>
      <ellipse cx={cx} cy={y1 + 2} rx={mr * 1.08} ry="8" fill="#26211F" opacity=".26" />
      {handleEl}
      <path d={d} fill={g.clay} />
      <g clipPath={`url(#${uid}c)`}>
        {mott.map((m, i) => <ellipse key={i} cx={m.x} cy={m.y} rx={m.rx} ry={m.ry} fill="#4A2E22" opacity={g.mode === "bare" ? 0.16 : 0.1} />)}
        {glazeD && <path d={glazeD} fill={`url(#${uid}g)`} />}
        {rings.map((r, i) => (
          <g key={i}>
            <path d={`M${cx - mr - 2} ${r.y}Q${cx} ${r.y + r.w} ${cx + mr + 2} ${r.y}`} stroke="#000" strokeOpacity=".08" fill="none" />
            <path d={`M${cx - mr - 2} ${r.y + 1.6}Q${cx} ${r.y + r.w + 1.6} ${cx + mr + 2} ${r.y + 1.6}`} stroke="#fff" strokeOpacity=".09" fill="none" />
          </g>
        ))}
        {specks.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.l ? "#fff" : g.speck} opacity={s.l ? 0.3 : 0.55} />)}
        <rect x={cx - mr} y={y0 - 4} width={mr * 2} height={y1 - y0 + 8} fill={`url(#${uid}s)`} />
        <path d={`M${cx - mr * 0.5} ${y0 + (y1 - y0) * 0.22}V${y0 + (y1 - y0) * 0.62}`} stroke="#fff" strokeOpacity=".3" strokeWidth="4" strokeLinecap="round" />
      </g>
      <ellipse cx={cx} cy={y0} rx={rx0} ry={Math.max(3, rx0 * 0.16)} fill={g.mode === "bare" ? "#6b3220" : g.b} />
      <ellipse cx={cx} cy={y0} rx={rx0} ry={Math.max(3, rx0 * 0.16)} fill="none" stroke={g.mode === "bare" ? "#E0A27E" : g.a} strokeWidth="2" opacity=".9" />
    </g>
  );
}
const at = (X: number, sc: number) => `translate(${f1(X - 150 * sc)} ${f1(206 - 200 * sc)}) scale(${sc})`;

/* ================================================================== */
/* Illustrations                                                       */
/* ================================================================== */
function Scene({ bg, children, floor = true }: { bg: string; children: ReactNode; floor?: boolean }) {
  const id = "kns" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <>
      <defs>
        <radialGradient id={id} cx=".5" cy=".4" r=".7"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset="1" stopColor="#000" stopOpacity=".16" /></radialGradient>
      </defs>
      <rect width="300" height="260" fill={bg} />
      <rect width="300" height="260" fill={`url(#${id})`} />
      {floor && <><rect y="206" width="300" height="54" fill="#26211F" opacity=".14" /><line x1="0" x2="300" y1="206" y2="206" stroke="#26211F" strokeOpacity=".25" /></>}
      {children}
    </>
  );
}
function Tiles() {
  const cols = ["#3F6F86", "#B5573A", "#EFE6D6", "#C98F4F", "#8FB4BF", "#A8452B"];
  const r = rng(11);
  const out: ReactNode[] = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
    const x = 32 + i * 61, y = 44 + j * 61, k = (i * 2 + j * 3 + (i > 1 ? 1 : 0)) % cols.length;
    const jit = () => (r() - 0.5) * 3.2;
    const d = `M${x + jit()} ${y + jit()}L${x + 56 + jit()} ${y + jit()}L${x + 56 + jit()} ${y + 56 + jit()}L${x + jit()} ${y + 56 + jit()}Z`;
    const dark = k === 2 || k === 3 || k === 4;
    out.push(
      <g key={i + "-" + j}>
        <path d={d} fill={cols[k]} />
        <path d={d} fill="#fff" opacity=".08" />
        <path d={`M${x + 28} ${y + 7}L${x + 49} ${y + 28}L${x + 28} ${y + 49}L${x + 7} ${y + 28}Z M${x + 28} ${y + 17}L${x + 39} ${y + 28}L${x + 28} ${y + 39}L${x + 17} ${y + 28}Z`} fill="none" stroke={dark ? "#26211F" : "#EFE6D6"} strokeWidth="1.6" strokeOpacity=".8" />
        {Array.from({ length: 6 }).map((_, n) => <circle key={n} cx={x + 4 + r() * 48} cy={y + 4 + r() * 48} r=".9" fill="#26211F" opacity=".35" />)}
      </g>,
    );
  }
  return <>{out}</>;
}
function Lamp({ X, sc, top, glaze, seed }: { X: number; sc: number; top: number; glaze: Glz; seed: number }) {
  const gid = "knl" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const bottom = top + 156 * sc;
  return (
    <g>
      <defs>
        <radialGradient id={gid}><stop offset="0" stopColor="#FFE2A8" /><stop offset=".7" stopColor="#F2A857" /><stop offset="1" stopColor="#C8623F" /></radialGradient>
        <linearGradient id={gid + "b"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFD58E" stopOpacity=".42" /><stop offset="1" stopColor="#FFD58E" stopOpacity="0" /></linearGradient>
      </defs>
      <path d={`M${X - 118 * sc} ${bottom}L${X - 150 * sc - 20} 260H${X + 150 * sc + 20}L${X + 118 * sc} ${bottom}Z`} fill={`url(#${gid}b)`} />
      <line x1={X} x2={X} y1="0" y2={top} stroke="#8a7a6c" strokeWidth="2" />
      <g transform={`translate(${f1(X - 150 * sc)} ${f1(top - 44 * sc)}) scale(${sc})`}>
        <Vessel prof={PROF.lamp} glaze={glaze} seed={seed} />
        <ellipse cx="150" cy="200" rx="122" ry="17" fill={`url(#${gid})`} />
      </g>
    </g>
  );
}
function Planter({ X, sc, glaze, seed }: { X: number; sc: number; glaze: Glz; seed: number }) {
  const r = rng(seed + 9);
  const y = 206 - 104 * sc;
  return (
    <g>
      <g fill="none" stroke="#6c7a52" strokeWidth="2.4" strokeLinecap="round">
        {Array.from({ length: 9 }).map((_, i) => {
          const a = (i / 8) * 1.7 - 0.85, h = (52 + r() * 40) * sc;
          return <path key={i} d={`M${X} ${y + 4}Q${X + Math.sin(a) * h * 0.4} ${y - h * 0.6} ${X + Math.sin(a) * h} ${y - h * Math.cos(a)}`} />;
        })}
      </g>
      <g transform={at(X, sc)}><Vessel prof={PROF.planter} glaze={glaze} seed={seed} /></g>
    </g>
  );
}
function Art({ kind, label }: { kind: string; label?: string }) {
  const common = { viewBox: "0 0 300 260", role: label ? "img" : undefined, "aria-label": label, "aria-hidden": label ? undefined : true, preserveAspectRatio: "xMidYMid slice", focusable: false } as const;
  switch (kind) {
    case "bowl":
      return <svg {...common}><Scene bg="#E4D7C0"><g transform={at(100, 0.92)}><Vessel prof={PROF.bowl} glaze={GL.tide} seed={3} /></g><g transform={at(240, 0.55)}><Vessel prof={PROF.bowl} glaze={GL.bone} seed={5} /></g></Scene></svg>;
    case "vase":
      return <svg {...common}><Scene bg="#C9D5D3"><g transform={at(52, 0.6)}><Vessel prof={PROF.vase} glaze={GL.ochre} seed={8} /></g><g transform={at(250, 0.5)}><Vessel prof={PROF.vase} glaze={GL.iron} seed={9} /></g><g transform={at(150, 1)}><Vessel prof={PROF.vase} glaze={GL.ember} seed={7} /></g></Scene></svg>;
    case "mug":
      return <svg {...common}><Scene bg="#C9805E"><g transform={at(225, 0.85)}><Vessel prof={PROF.mug} glaze={GL.ochre} seed={13} handle={{ y1: 118, y2: 178, out: 34 }} /></g><g transform={at(115, 1.15)}><Vessel prof={PROF.mug} glaze={GL.bone} seed={12} handle={{ y1: 118, y2: 178, out: 34 }} /></g></Scene></svg>;
    case "lamp":
      return <svg {...common}><Scene bg="#2A2321" floor={false}><Lamp X={46} sc={0.34} top={80} glaze={GL.bone} seed={2} /><Lamp X={256} sc={0.4} top={60} glaze={GL.ochre} seed={4} /><Lamp X={150} sc={0.78} top={42} glaze={GL.bone} seed={6} /></Scene></svg>;
    case "planter":
      return <svg {...common}><Scene bg="#DCCDB0"><Planter X={105} sc={1} glaze={GL.iron} seed={21} /><Planter X={236} sc={0.72} glaze={GL.raw} seed={22} /></Scene></svg>;
    case "tea":
      return <svg {...common}><Scene bg="#8FB4BF"><ellipse cx="150" cy="209" rx="140" ry="12" fill="#2A2321" /><ellipse cx="150" cy="206" rx="140" ry="11" fill="#3b312d" /><g transform={at(98, 0.92)}><Vessel prof={PROF.jug} glaze={GL.ochre} seed={31} handle={{ y1: 100, y2: 170, out: 34 }} /></g><g transform={at(212, 0.9)}><Vessel prof={PROF.cup} glaze={GL.bone} seed={32} /></g><g transform={at(262, 0.76)}><Vessel prof={PROF.cup} glaze={GL.bone} seed={33} /></g></Scene></svg>;
    case "tiles":
      return <svg {...common}><Scene bg="#2A2321" floor={false}><Tiles /></Scene></svg>;
    case "profile":
      return <Sketch kind="profile" label={label} />;
    case "curve":
      return <Sketch kind="curve" label={label} />;
    case "foot":
      return <Sketch kind="foot" label={label} />;
    case "map":
      return <MapArt label={label} />;
    default:
      return null;
  }
}

/* Process sketches (pencil on paper) */
const FIRE: number[][] = [[0, 20], [1, 120], [3, 570], [3.5, 610], [7.5, 1100], [9, 1222], [9.4, 1222], [10.5, 1050], [14, 600], [20, 120]];
function Sketch({ kind, label }: { kind: "profile" | "curve" | "foot"; label?: string }) {
  const id = "knk" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const ink = "#3a312c";
  const base = { viewBox: "0 0 280 220", role: label ? "img" : undefined, "aria-label": label, "aria-hidden": label ? undefined : true, focusable: false } as const;
  const paper = (
    <>
      <defs>
        <pattern id={id + "h"} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke={ink} strokeWidth=".8" opacity=".5" /></pattern>
      </defs>
      <rect width="280" height="220" fill="#F3ECDD" />
      {Array.from({ length: 11 }).map((_, i) => <line key={i} x1="0" x2="280" y1={20 + i * 20} y2={20 + i * 20} stroke="#3F6F86" strokeOpacity=".13" />)}
      <line x1="30" x2="30" y1="0" y2="220" stroke="#B5573A" strokeOpacity=".35" />
    </>
  );
  if (kind === "profile") {
    const p = PROF.vase.map(([r, y]) => [r * 0.95, y * 0.95 + 4]);
    const cx = 150;
    return (
      <svg {...base}>
        {paper}
        <line x1={cx} x2={cx} y1="14" y2="208" stroke={ink} strokeDasharray="8 3 2 3" strokeWidth=".9" />
        <path d={outline(p, cx)} fill="none" stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
        <path d={outline(PROF.vase.map(([r, y]) => [r * 0.95 - 4, y * 0.95 + 4]), cx)} fill="none" stroke={ink} strokeWidth=".7" strokeOpacity=".5" />
        {p.map(([r, y], i) => <circle key={i} cx={cx + r} cy={y} r="2.6" fill="#B5573A" />)}
        <g stroke={ink} strokeWidth=".9" fill="none"><path d={`M${cx - p[4][0]} 196H${cx + p[4][0]}M${cx - p[4][0]} 192v8M${cx + p[4][0]} 192v8`} /><path d="M232 42V195M228 42h8M228 195h8" /></g>
        <g fontFamily="ui-monospace,Menlo,monospace" fontSize="9" fill={ink}>
          <text x="104" y="212">Ø 144 belly</text><text x="238" y="120" transform="rotate(90 238 120)">H 360 mm</text>
          <text x="196" y="44">rim 6 mm</text><text x="40" y="90">pull 3: neck in</text><text x="38" y="160">throw 8% big</text>
        </g>
      </svg>
    );
  }
  if (kind === "curve") {
    const X = (h: number) => 34 + (h / 20) * 220, Y = (t: number) => 184 - (t / 1300) * 150;
    const pts = FIRE.map(([h, t]) => [X(h), Y(t)]);
    return (
      <svg {...base}>
        {paper}
        <g stroke={ink} strokeWidth="1" fill="none"><path d="M34 28V184H258" /></g>
        <path d={`M${pts[0][0]} ${pts[0][1]}${seg(pts)}`} fill="none" stroke="#B5573A" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="34" x2="258" y1={Y(1222)} y2={Y(1222)} stroke={ink} strokeDasharray="3 3" strokeOpacity=".5" />
        <line x1={X(3.2)} x2={X(3.2)} y1="184" y2={Y(573)} stroke={ink} strokeDasharray="3 3" strokeOpacity=".5" />
        <g fontFamily="ui-monospace,Menlo,monospace" fontSize="9" fill={ink}>
          <text x="38" y={Y(1222) - 4}>cone 6 · 1222°C</text><text x={X(3.2) + 4} y={Y(573) + 12}>573 quartz</text>
          <text x="214" y="196">20 h</text><text x="36" y="196">0</text><text x="200" y="130" transform="rotate(-24 200 130)">cool slowly</text>
        </g>
      </svg>
    );
  }
  return (
    <svg {...base}>
      {paper}
      <path d="M70 26L102 26L102 126L208 126L208 152L102 152L102 172L70 172Z" fill={`url(#${id}h)`} stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
      <line x1="150" x2="150" y1="104" y2="126" stroke="#B5573A" strokeWidth="1.4" />
      <path d="M118 64h8M118 64l5-3M118 64l5 3" stroke={ink} fill="none" />
      <g stroke={ink} fill="none" strokeWidth=".9"><path d="M62 26V172M58 26h8M58 172h8" /><path d="M70 184H102M70 180v8M102 180v8" /></g>
      <g fontFamily="ui-monospace,Menlo,monospace" fontSize="9" fill={ink}>
        <text x="130" y="68">wall 5 mm</text><text x="152" y="108">trim here, 3 mm</text><text x="112" y="195">foot ring 8 mm</text><text x="44" y="102" transform="rotate(-90 44 102)">H 146</text>
      </g>
    </svg>
  );
}
function MapArt({ label }: { label?: string }) {
  const m = "ui-monospace,Menlo,monospace";
  const room = (x: number, y: number, w: number, h: number, t: string, c: string) => (
    <g key={t}><rect x={x} y={y} width={w} height={h} fill={c} stroke="#26211F" strokeWidth="2" /><text x={x + 8} y={y + 16} fontFamily={m} fontSize="10" fill="#26211F" letterSpacing=".04em">{t}</text></g>
  );
  return (
    <svg viewBox="0 0 380 280" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable={false} preserveAspectRatio="xMidYMid slice">
      <rect width="380" height="280" fill="#EFE6D6" />
      {Array.from({ length: 20 }).map((_, i) => <line key={i} x1={i * 20} x2={i * 20} y1="0" y2="280" stroke="#3F6F86" strokeOpacity=".1" />)}
      {Array.from({ length: 14 }).map((_, i) => <line key={i} y1={i * 20} y2={i * 20} x1="0" x2="380" stroke="#3F6F86" strokeOpacity=".1" />)}
      <rect x="22" y="22" width="336" height="236" fill="#F6EFE0" stroke="#26211F" strokeWidth="3" />
      {room(22, 22, 130, 96, "WHEEL ROOM", "#E4D7C0")}
      {room(152, 22, 90, 96, "CLAY STORE", "#D9CBB0")}
      {room(242, 22, 116, 96, "GLAZE LAB", "#C9D5D3")}
      {room(22, 118, 110, 140, "KILN YARD", "#C9805E")}
      {room(132, 118, 226, 60, "SHOWROOM", "#F1E8D6")}
      <circle cx="257" cy="220" r="26" fill="#9aa67c" stroke="#26211F" strokeWidth="2" />
      <text x="228" y="258" fontFamily={m} fontSize="10" fill="#26211F">FIG COURTYARD</text>
      {[0, 1, 2, 3].map((i) => <circle key={i} cx={52 + i * 24} cy="72" r="8" fill="#B5573A" stroke="#26211F" strokeWidth="1.5" />)}
      <rect x="42" y="190" width="34" height="44" fill="#26211F" /><rect x="84" y="190" width="34" height="44" fill="#26211F" />
      <rect x="196" y="146" width="150" height="16" fill="#8F3F28" stroke="#26211F" strokeWidth="1.5" />
      <path d="M152 118V148" stroke="#F6EFE0" strokeWidth="6" /><path d="M340 258v-10" stroke="#F6EFE0" strokeWidth="8" />
      <g fontFamily={m} fontSize="9" fill="#26211F"><text x="46" y="106">4 wheels</text><text x="44" y="246">Kiln 1 · Kiln 2</text><text x="200" y="158" fill="#F6EFE0">long table</text></g>
      <path d="M350 56l7 18h-14z" fill="#26211F" /><text x="344" y="86" fontFamily={m} fontSize="9" fill="#26211F">N</text>
    </svg>
  );
}

/* ================================================================== */
/* Content                                                             */
/* ================================================================== */
type Kind = "project" | "note" | "sketch" | "map" | "about";
type Item = {
  id: string; kind: Kind; art: string; title: string; kicker: string;
  x: number; y: number; w: number; h: number; f: number; r: number;
  lead: string; specs: [string, string][]; steps?: string[]; note?: string[];
};
const ITEMS: Item[] = [
  { id: "tidewater", kind: "project", art: "bowl", title: "Tidewater Tableware", kicker: "Tableware · 2026", x: 520, y: 1040, w: 300, h: 380, f: 1.04, r: -2,
    lead: "A 140-piece dinner service for Sal & Maré, a seafood house on the Tagus. Bowls, plates and cups share one dipped blue glaze that deepens wherever it pools.",
    specs: [["Client", "Sal & Maré, Lisbon"], ["Pieces", "140 in 4 loads"], ["Clay", "Speckled stoneware"], ["Glaze", "Tidewater Blue"], ["Firing", "Cone 6, oxidation"], ["Timeline", "11 weeks"]],
    steps: ["Three trial sets thrown to settle rim thickness against dishwasher chipping.", "Dip line lowered 6 mm after the first kiln so the blue meets bare clay under the thumb.", "Packed in wool-lined crates and fired in four loads, one tile test per shelf."] },
  { id: "ember", kind: "project", art: "vase", title: "Ash & Ember Vases", kicker: "Vessels · 2025", x: 1180, y: 1270, w: 300, h: 380, f: 0.98, r: 1.5,
    lead: "Twelve tall vessels for the group show Fire Remembers at Galeria Lume, glazed with our own ember red and pushed to the edge of what the kiln allows.",
    specs: [["Venue", "Galeria Lume"], ["Pieces", "12, unique"], ["Height", "38 to 62 cm"], ["Glaze", "Ember, double dipped"], ["Firing", "Cone 6, slow cool"], ["Timeline", "5 months"]],
    steps: ["Each profile drawn at full scale on the studio wall, then thrown in two sections.", "Ember glaze applied thick at the shoulder so it runs into the throwing rings.", "Four pieces lost to the kiln gods. The eight that survived are the show."] },
  { id: "mugs", kind: "project", art: "mug", title: "Morning Ritual Mugs", kicker: "Everyday · 2026", x: 1850, y: 1190, w: 300, h: 380, f: 1.06, r: -1,
    lead: "A small-batch mug for people who hold things for a long time. Pulled handles, a generous thumb rest and a bone glaze that warms to cream where it is thin.",
    specs: [["Edition", "Batches of 60"], ["Capacity", "320 ml"], ["Clay", "Buff stoneware"], ["Glaze", "Bone Satin, Ochre Ash"], ["Firing", "Cone 6"], ["Price", "from 48 EUR"]],
    steps: ["Handle pulled from a single 90 g coil, left to leather-hard on its own.", "Thumb rest adjusted nine times on the wheel before anyone approved it.", "Glaze dipped in two passes so the lip stays slightly darker."] },
  { id: "salt-pan", kind: "project", art: "lamp", title: "Salt Pan Pendants", kicker: "Lighting · 2025", x: 2420, y: 880, w: 300, h: 380, f: 1.0, r: 2,
    lead: "Hand-thrown pendant shades for the Hotel Salina lobby. Each dome is glazed warm white inside so the light comes out the colour of late afternoon.",
    specs: [["Client", "Hotel Salina, Setubal"], ["Pieces", "26 pendants"], ["Diameter", "24, 36 and 48 cm"], ["Glaze", "Bone Satin inside"], ["Fitting", "E27, ceramic collar"], ["Timeline", "14 weeks"]],
    steps: ["Domes thrown upside down and trimmed in one sitting to keep walls even.", "Light-tested every shade in a dark room before glazing was approved.", "Wired by the hotel's electrician from our hanging drawings."] },
  { id: "lacuna", kind: "project", art: "planter", title: "Lacuna Planters", kicker: "Architectural · 2024", x: 2330, y: 1470, w: 300, h: 380, f: 0.96, r: -1.5,
    lead: "Thirty large planters for a courtyard in Alfama, thrown in two halves and joined while soft. Iron-black glaze, rough feet and drainage hidden in the seam.",
    specs: [["Client", "Casa Alfama"], ["Pieces", "30, three sizes"], ["Height", "60 to 90 cm"], ["Glaze", "Iron Night, raw feet"], ["Firing", "Cone 6, frost-proof"], ["Timeline", "9 months"]],
    steps: ["Halves thrown on a bat and joined at leather-hard with slip and patience.", "Frost test: ten cycles in a freezer borrowed from the fishmonger next door.", "Delivered by hand cart up the hill, because the van would not fit."] },
  { id: "tea", kind: "project", art: "tea", title: "Cold Spring Tea Set", kicker: "Tableware · 2026", x: 720, y: 1590, w: 300, h: 380, f: 1.02, r: 1,
    lead: "A jug, cups and tray for a small tea house, in ochre and bone. Designed so every piece nests: nothing needs a cabinet of its own.",
    specs: [["Client", "Casa de Cha Nuvem"], ["Set", "Jug, 6 cups, tray"], ["Clay", "Porcelain body"], ["Glaze", "Ochre Ash, Bone Satin"], ["Firing", "Cone 6"], ["Timeline", "7 weeks"]],
    steps: ["Cups thrown off the hump, forty in an hour, to keep the family resemblance.", "Jug spout cut and checked with water until it stopped dripping.", "Tray built from a slab, dried between boards so it stayed flat."] },
  { id: "tiles", kind: "project", art: "tiles", title: "Sgraffito Tile Wall", kicker: "Surface · 2025", x: 1500, y: 1650, w: 300, h: 380, f: 1.0, r: -0.5,
    lead: "1,240 hand-pressed tiles for a hotel stair hall, each scratched through a slip layer with the same diamond motif and none of them quite the same.",
    specs: [["Client", "Hotel Salina"], ["Tiles", "1,240, 12 cm"], ["Colours", "6 glazes"], ["Technique", "Slip and sgraffito"], ["Firing", "Bisque 06, glaze cone 6"], ["Timeline", "6 months"]],
    steps: ["Tiles pressed into a plaster mould, 80 a day, and dried under newspaper.", "Diamond scratched with a loop tool by whoever had a free hour, so the hands vary.", "Laid out on the studio floor in sequence before crating, so the pattern drifts naturally."] },
  { id: "map", kind: "map", art: "map", title: "Studio map", kicker: "Visit · Rua do Forno 14", x: 330, y: 500, w: 380, h: 360, f: 1.0, r: -1,
    lead: "A converted bakery in Lisbon with a long table where everything gets decided. The kilns live in the old oven yard, and the fig tree has right of way.",
    specs: [["Address", "Rua do Forno 14, Lisbon"], ["Open studio", "Saturdays, 11 to 17"], ["Tours", "By appointment"], ["Equipment", "4 wheels, 2 kilns"], ["Access", "Step-free to showroom"], ["Parking", "None. Take the tram."]],
    steps: ["Enter through the red door and ask for coffee.", "Showroom first, then the wheel room if someone is throwing.", "The seconds shelf is by the fig tree. Cash or card."] },
  { id: "about", kind: "about", art: "none", title: "About Kiln", kicker: "Studio · since 2014", x: 2640, y: 420, w: 300, h: 250, f: 1.0, r: 1.5,
    lead: "Four makers, two kilns and one long table. We design and make tableware, lighting and surfaces for people who care how things feel in the hand.",
    specs: [["Founded", "2014, Lisbon"], ["Makers", "Ines, Tomas, Rui, Maya"], ["Output", "About 4,000 pieces a year"], ["Clients", "Restaurants, hotels, homes"], ["Materials", "Local stoneware, porcelain"], ["Energy", "Kilns on renewable tariff"]],
    steps: ["We say no to most large orders so we can say yes to good ones.", "Every piece is signed or stamped by the person who finished it.", "Seconds are sold, never destroyed."], note: ["Four makers.", "Two kilns.", "One long table."] },
  { id: "sk-profile", kind: "sketch", art: "profile", title: "Profile study: Ember vase", kicker: "Sketch · profile", x: 1000, y: 230, w: 280, h: 300, f: 1.08, r: -2.5,
    lead: "Every form starts as a half-profile drawn at full size. The orange points are the places the hand will actually change direction.",
    specs: [["Scale", "1:1"], ["Tool", "2B pencil, steel rule"], ["Points", "7 control points"], ["Rule", "Throw 8% bigger"], ["Used for", "Ash & Ember Vases"], ["Date", "February 2025"]], steps: ["Draw the profile, then mirror it.", "Mark the three places the wall must be thickest.", "Cut a plywood rib to check the throw."] },
  { id: "sk-curve", kind: "sketch", art: "curve", title: "Firing curve, cone 6", kicker: "Sketch · kiln", x: 2050, y: 250, w: 280, h: 300, f: 0.94, r: 2,
    lead: "Twenty hours from cold to cold. The curve is slow through quartz inversion at 573 degrees, where pots crack if they are hurried.",
    specs: [["Peak", "1222°C, cone 6"], ["Soak", "20 minutes"], ["Total", "20 hours"], ["Atmosphere", "Oxidation"], ["Kiln", "Two, 280 L each"], ["Fuel", "Electric"]], steps: ["Water smoking below 150°C.", "Crawl through 573°C.", "Cool to 150°C before anyone opens the lid."] },
  { id: "sk-foot", kind: "sketch", art: "foot", title: "Foot ring section", kicker: "Sketch · detail", x: 2750, y: 1360, w: 280, h: 300, f: 1.1, r: -1.5,
    lead: "The foot is where a piece tells you whether it was made with care. Eight millimetres of ring, trimmed at three, wide enough to sit true on a table.",
    specs: [["Foot ring", "8 mm"], ["Trim wall", "3 mm"], ["Glaze", "Wiped clean at foot"], ["Fired on", "Alumina-dusted shelf"], ["Tool", "Loop trimmer, 6 mm"], ["Check", "Rocks on glass? Trim again."]], steps: ["Centre the leather-hard pot upside down.", "Trim the foot ring, then relieve the base.", "Wipe the glaze from the foot with a damp sponge."] },
  { id: "n-glaze", kind: "note", art: "none", title: "Glaze note: Tidewater", kicker: "Notebook · page 31", x: 1480, y: 1020, w: 220, h: 175, f: 1.12, r: -3,
    note: ["Tidewater blue", "Cobalt 0.5% + rutile 2%", "Test tile #31: best yet.", "Do not touch the rutile again."],
    lead: "Thirty tests to find a blue that breaks to rust on edges and still looks like water when it runs. Number thirty-one is the one on the dinner plates.",
    specs: [["Recipe", "Tidewater Blue v31"], ["Cone", "6, oxidation"], ["Thickness", "1.2 mm, two dips"], ["Breaks to", "Rust on rims"], ["Tested on", "Speckled stoneware"], ["Date", "October 2025"]], steps: ["Weigh dry materials twice.", "Sieve through 80 mesh, then again.", "Test tile on every clay body, every time."] },
  { id: "n-shrink", kind: "note", art: "none", title: "Shrinkage note", kicker: "Notebook · page 8", x: 270, y: 1380, w: 220, h: 175, f: 1.1, r: 2.5,
    note: ["Shrinkage = 12.4%", "Throw 14% bigger!", "Measure the lid twice.", "(the lid is always wrong)"],
    lead: "Our stoneware loses 12.4 percent of its size between wet and fired. Every drawing in the studio carries a second, bigger set of dimensions for the wheel.",
    specs: [["Wet to fired", "12.4%"], ["Wet to bone dry", "6%"], ["Bone dry to fired", "7%"], ["Clay", "Speckled stoneware"], ["Tested", "Quarterly"], ["Tool", "Shrink ruler, 112%"]], steps: ["Throw to the larger number.", "Check at leather-hard.", "Check again after bisque."] },
  { id: "n-log", kind: "note", art: "none", title: "Kiln log #214", kicker: "Notebook · kiln 2", x: 2020, y: 1520, w: 220, h: 175, f: 0.9, r: -2,
    note: ["Kiln 2, firing #214", "Cone 6, 9 h 10 min", "Peeked at 1180: all good.", "Cooling overnight."],
    lead: "Every firing is logged by hand: the load, the schedule, what we saw through the peephole. The log is how we found the quartz-inversion cracks in 2019.",
    specs: [["Firing", "#214"], ["Kiln", "Kiln 2, 280 L"], ["Peak", "1222°C, cone 6"], ["Duration", "9 h 10 min up"], ["Load", "34 pieces, 6 shelves"], ["Result", "2 seconds"]], steps: ["Load, cone packs in sight of the peephole.", "Log temperature at the hour.", "Unload only when the lid is cool to the hand."] },
  { id: "n-open", kind: "note", art: "none", title: "Open studio", kicker: "Notebook · reminder", x: 1350, y: 250, w: 220, h: 175, f: 1.14, r: 3,
    note: ["Open studio", "Saturdays 11 to 17", "Seconds shelf by the fig tree.", "Bring a bag."],
    lead: "Once a week the doors open. Come and watch a pot get thrown, drink something, buy a second, or ask about a commission.",
    specs: [["When", "Saturdays, 11 to 17"], ["Where", "Rua do Forno 14"], ["Cost", "Free"], ["Groups", "Book ahead"], ["Dogs", "Welcome"], ["Seconds", "Cash or card"]], steps: ["Ring the bell if the door is shut.", "Ask to see the kilns.", "Say hello to Fig, the studio cat."] },
];

type Decor = { id: string; x: number; y: number; w: number; h: number; f: number; r: number; k: "blob" | "crumb" | "rings" | "dots"; c: string; o: number; seed: number };
const DECOR: Decor[] = [
  { id: "d-rings", x: 1500, y: 700, w: 2400, h: 2400, f: 0.55, r: 0, k: "rings", c: "#B5573A", o: 0.5, seed: 1 },
  { id: "d-b1", x: 250, y: 180, w: 620, h: 520, f: 0.6, r: 12, k: "blob", c: "#C9805E", o: 0.42, seed: 3 },
  { id: "d-b2", x: 2850, y: 1000, w: 700, h: 560, f: 0.62, r: -20, k: "blob", c: "#8FB4BF", o: 0.4, seed: 5 },
  { id: "d-b3", x: 1450, y: 1860, w: 800, h: 480, f: 0.58, r: 6, k: "blob", c: "#B5573A", o: 0.28, seed: 7 },
  { id: "d-b4", x: 2250, y: 70, w: 560, h: 420, f: 0.66, r: -9, k: "blob", c: "#E4D7C0", o: 0.7, seed: 9 },
  { id: "d-b5", x: 80, y: 1600, w: 520, h: 520, f: 0.64, r: 30, k: "blob", c: "#3F6F86", o: 0.22, seed: 11 },
  { id: "d-c1", x: 880, y: 760, w: 60, h: 46, f: 1.45, r: 20, k: "crumb", c: "#8F3F28", o: 0.9, seed: 21 },
  { id: "d-c2", x: 2050, y: 900, w: 80, h: 56, f: 1.5, r: -30, k: "crumb", c: "#B5573A", o: 0.9, seed: 22 },
  { id: "d-c3", x: 1200, y: 1700, w: 70, h: 50, f: 1.4, r: 50, k: "crumb", c: "#3F6F86", o: 0.85, seed: 23 },
  { id: "d-c4", x: 2800, y: 700, w: 50, h: 40, f: 1.55, r: 10, k: "crumb", c: "#C98F4F", o: 0.9, seed: 24 },
  { id: "d-c5", x: 140, y: 900, w: 66, h: 48, f: 1.42, r: -15, k: "crumb", c: "#8F3F28", o: 0.9, seed: 25 },
  { id: "d-c6", x: 1850, y: 420, w: 54, h: 42, f: 1.48, r: 33, k: "crumb", c: "#26211F", o: 0.8, seed: 26 },
  { id: "d-c7", x: 900, y: 1380, w: 46, h: 36, f: 1.5, r: -40, k: "crumb", c: "#B5573A", o: 0.9, seed: 27 },
];
const W = 3000, H = 1900, CX = 1500;

function Blob({ d, c, o }: { d: Decor; c: string; o: number }) {
  const pts = useMemo(() => {
    const r = rng(d.seed), n = 9, out: number[][] = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.72 + r() * 0.28; out.push([50 + Math.cos(a) * 48 * k, 50 + Math.sin(a) * 48 * k]); }
    out.push(out[0]);
    out.push(out[1]);
    return out;
  }, [d.seed]);
  const dd = `M${f1(pts[0][0])} ${f1(pts[0][1])}${seg(pts)}Z`;
  const sp = useMemo(() => { const r = rng(d.seed + 40); return Array.from({ length: d.k === "crumb" ? 6 : 40 }, () => [20 + r() * 60, 20 + r() * 60, 0.4 + r() * 0.9]); }, [d.seed, d.k]);
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none" aria-hidden focusable={false}>
      <path d={dd} fill={c} opacity={o} />
      {sp.map((s, i) => <circle key={i} cx={s[0]} cy={s[1]} r={s[2] * (d.k === "crumb" ? 1.4 : 0.8)} fill="#26211F" opacity={d.k === "crumb" ? 0.35 : 0.18} />)}
      {d.k === "crumb" && <path d={dd} fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="3" transform="translate(-1.5 -1.5)" />}
    </svg>
  );
}
function DecorArt({ d }: { d: Decor }) {
  if (d.k === "rings") {
    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden focusable={false}>
        {[48, 40, 32, 24, 16].map((r, i) => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={d.c} strokeOpacity={d.o - i * 0.06} strokeWidth=".12" strokeDasharray={i % 2 ? "0.6 0.8" : undefined} />)}
      </svg>
    );
  }
  return <Blob d={d} c={d.c} o={d.o} />;
}

/* Title slab: the studio name cut into clay */
function Slab() {
  const id = "knt" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const { d, sp } = useMemo(() => {
    const r = rng(77), pts: number[][] = [];
    const jit = () => (r() - 0.5) * 12;
    for (let x = 20; x <= 1480; x += 90) pts.push([x, 14 + jit()]);
    for (let y = 14; y <= 546; y += 90) pts.push([1486 + jit(), y]);
    for (let x = 1480; x >= 20; x -= 90) pts.push([x, 546 + jit()]);
    for (let y = 546; y >= 14; y -= 90) pts.push([14 + jit(), y]);
    pts.push(pts[0], pts[1]);
    const sp = Array.from({ length: 230 }, () => ({ x: 20 + r() * 1460, y: 20 + r() * 520, r: 0.8 + r() * 2.2, l: r() < 0.3 }));
    return { d: `M${pts[0][0]} ${pts[0][1]}${seg(pts)}Z`, sp };
  }, []);
  const font = `"Fraunces","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif`;
  return (
    <svg viewBox="0 0 1500 560" width="100%" height="100%" aria-hidden focusable={false}>
      <defs>
        <linearGradient id={id + "g"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C4694A" /><stop offset=".5" stopColor="#B5573A" /><stop offset="1" stopColor="#9A4529" /></linearGradient>
        <clipPath id={id + "c"}><path d={d} /></clipPath>
        <filter id={id + "f"} x="-5%" y="-10%" width="110%" height="125%">
          <feOffset in="SourceAlpha" dy="16" result="o" /><feGaussianBlur in="o" stdDeviation="9" result="b" />
          <feComposite in="SourceAlpha" in2="b" operator="out" result="inv" />
          <feFlood floodColor="#1b0d07" floodOpacity=".85" /><feComposite in2="inv" operator="in" result="sh" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="sh" /></feMerge>
        </filter>
      </defs>
      <path d={d} fill="#26211F" opacity=".28" transform="translate(0 18)" />
      <path d={d} fill={`url(#${id}g)`} />
      <g clipPath={`url(#${id}c)`}>
        {sp.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.l ? "#F1E8D6" : "#4A2417"} opacity={s.l ? 0.3 : 0.4} />)}
        {Array.from({ length: 16 }).map((_, i) => <path key={i} d={`M0 ${40 + i * 34}Q750 ${30 + i * 34 + (i % 3) * 6} 1500 ${40 + i * 34}`} stroke="#000" strokeOpacity=".05" fill="none" />)}
        <path d="M1180 14L1120 130L1150 214L1100 330" stroke="#4A2417" strokeOpacity=".5" strokeWidth="2.4" fill="none" />
      </g>
      <text x="750" y="446" textAnchor="middle" fontFamily={font} fontWeight="800" fontSize="470" letterSpacing="-14" fill="#F1E8D6" opacity=".55" transform="translate(0 4)">KILN</text>
      <text x="750" y="446" textAnchor="middle" fontFamily={font} fontWeight="800" fontSize="470" letterSpacing="-14" fill="#3b1c10" filter={`url(#${id}f)`}>KILN</text>
      <text x="750" y="516" textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize="26" letterSpacing="9" fill="#2a130b" opacity=".78">CERAMICS &amp; DESIGN STUDIO · LISBON</text>
    </svg>
  );
}

function Face({ it }: { it: Item }) {
  if (it.kind === "note") return <span className="kn-note-body">{it.note!.map((l, i) => <span key={i} className={i === 0 ? "kn-note-h" : ""}>{l}</span>)}</span>;
  if (it.kind === "about") return <span className="kn-about-body">{it.note!.map((l, i) => <span key={i}>{l}</span>)}</span>;
  return <span className="kn-art"><Art kind={it.art} /></span>;
}
function Cap({ it }: { it: Item }) {
  return (
    <span className="kn-cap">
      <span className="kn-k">{it.kicker}</span>
      <span className="kn-t">{it.title}</span>
      {it.kind === "project" && <span className="kn-more">Case study <span aria-hidden>→</span></span>}
    </span>
  );
}

/* ================================================================== */
/* Hooks                                                               */
/* ================================================================== */
function useReduced(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}
/** 0..1 progress through a tall section (top reaches viewport top -> bottom reaches viewport bottom). */
function useScrub(ref: RefObject<HTMLElement | null>, cb: (p: number) => void) {
  const cbr = useRef(cb);
  cbr.current = cb;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const run = () => {
      raf = 0;
      if (reduce) return cbr.current(1);
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      cbr.current(span > 0 ? clamp(-r.top / span, 0, 1) : 1);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(run); };
    run();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); if (raf) cancelAnimationFrame(raf); };
  }, [ref]);
}

/* ================================================================== */
/* Canvas stage (hero)                                                 */
/* ================================================================== */
type Cam = { x: number; y: number; s: number; ls: number; tx: number; ty: number; ts: number; k: number; vx: number; vy: number; vw: number; vh: number };
const ovTarget = (vw: number, vh: number) => (vw < 720 ? { x: CX, y: 820, s: 0.3 } : { x: CX, y: 950, s: Math.min(vw / 2700, vh / 1700) });
const MIN_S = 0.12, MAX_S = 2.2;
type Api = { fly: (it: Item, panel: boolean) => void; overview: () => void; zoom: (f: number) => void; pan: (dx: number, dy: number) => void; goto: (wx: number, wy: number) => void; kick: () => void };
const MMC: Record<Kind, string> = { project: "#B5573A", note: "#C98F4F", sketch: "#3F6F86", map: "#26211F", about: "#26211F" };

function Stage() {
  const reduced = useReduced();
  const [listView, setListView] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [away, setAway] = useState(false);
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const bg1 = useRef<HTMLDivElement>(null);
  const bg2 = useRef<HTMLDivElement>(null);
  const mmVp = useRef<HTMLDivElement>(null);
  const mmBox = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const els = useRef<Record<string, HTMLElement | null>>({});
  const cam = useRef<Cam>({ x: CX, y: 950, s: 0.5, ls: Math.log(0.5), tx: CX, ty: 950, ts: 0.5, k: 4, vx: 0, vy: 0, vw: 1200, vh: 800 });
  const api = useRef<Api | null>(null);
  const reducedRef = useRef(false);
  reducedRef.current = reduced;
  const openRef = useRef<string | null>(null);
  openRef.current = openId;
  const awayRef = useRef(false);
  const lastBtn = useRef<HTMLElement | null>(null);
  const lastItem = useRef<Item>(ITEMS[0]);
  const item = ITEMS.find((i) => i.id === openId) || null;
  if (item) lastItem.current = item;

  useEffect(() => { if (reduced) setListView(true); }, [reduced]);

  /* ---------------- camera ---------------- */
  useEffect(() => {
    if (listView) { api.current = null; return; }
    const stage = stageRef.current, view = viewRef.current;
    if (!stage || !view) return;
    const c = cam.current;
    let raf = 0, last = 0;
    const drag = { active: false, moved: false, sx: 0, sy: 0, lx: 0, ly: 0, lt: 0, vx: 0, vy: 0 };
    const ptrs = new Map<number, { x: number; y: number }>();
    let pinch: { d0: number; s0: number } | null = null;
    let didDrag = false;

    const measure = () => { c.vw = stage.clientWidth; c.vh = stage.clientHeight; };
    const clampAxis = (v: number, lo: number, hi: number, prev: number) => Math.min(Math.max(v, Math.min(lo, prev)), Math.max(hi, prev));
    const panBy = (dx: number, dy: number) => {
      const hw = c.vw / (2 * c.ts), hh = c.vh / (2 * c.ts), m = 300;
      const ox = c.tx, oy = c.ty;
      c.tx = clampAxis(ox + dx, Math.min(hw - m, W / 2), Math.max(W - hw + m, W / 2), ox);
      c.ty = clampAxis(oy + dy, Math.min(hh - m, H / 2), Math.max(H - hh + m, H / 2), oy);
      return Math.abs(c.tx - ox) > 0.01 || Math.abs(c.ty - oy) > 0.01;
    };
    const render = () => {
      const { x, y, s, vw, vh } = c;
      const place = (id: string, o: { x: number; y: number; w: number; h: number; f: number; r: number }) => {
        const el = els.current[id];
        if (!el) return;
        const X = vw / 2 + s * o.f * (o.x - x), Y = vh / 2 + s * o.f * (o.y - y);
        const m = Math.max(o.w, o.h) * s * 0.75 + 40;
        const vis = X > -m && X < vw + m && Y > -m && Y < vh + m;
        const v = vis ? "visible" : "hidden";
        if (el.style.visibility !== v) el.style.visibility = v;
        if (vis) el.style.transform = `translate3d(${X.toFixed(1)}px,${Y.toFixed(1)}px,0) rotate(${o.r}deg) scale(${s.toFixed(4)})`;
      };
      place("title", { x: CX, y: 640, w: 1500, h: 560, f: 1, r: 0 });
      for (const o of DECOR) place(o.id, o);
      for (const o of ITEMS) place(o.id, o);
      if (bg1.current) { const b = 160 * s * 0.5; bg1.current.style.backgroundSize = `${b}px ${b}px`; bg1.current.style.backgroundPosition = `${vw / 2 - s * 0.5 * x}px ${vh / 2 - s * 0.5 * y}px`; }
      if (bg2.current) { const b = 500 * s * 0.8; bg2.current.style.backgroundSize = `${b}px ${b}px`; bg2.current.style.backgroundPosition = `${vw / 2 - s * 0.8 * x}px ${vh / 2 - s * 0.8 * y}px`; }
      const vp = mmVp.current;
      if (vp) {
        vp.style.left = `${((x - vw / (2 * s)) / W) * 100}%`; vp.style.top = `${((y - vh / (2 * s)) / H) * 100}%`;
        vp.style.width = `${(vw / s / W) * 100}%`; vp.style.height = `${(vh / s / H) * 100}%`;
      }
      const ov = ovTarget(vw, vh);
      const a = Math.abs(Math.log(c.ts / ov.s)) > 0.06 || Math.hypot(c.tx - ov.x, c.ty - ov.y) * c.ts > 90;
      if (a !== awayRef.current) { awayRef.current = a; setAway(a); }
    };
    const tick = (t: number) => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0.001, (t - last) / 1000));
      last = t;
      let active = false;
      if (drag.active) active = true;
      else if (Math.abs(c.vx) > 10 || Math.abs(c.vy) > 10) {
        panBy(-(c.vx * dt) / c.s, -(c.vy * dt) / c.s);
        c.x = c.tx; c.y = c.ty;
        const dmp = Math.exp(-dt * 3.4);
        c.vx *= dmp; c.vy *= dmp;
        active = true;
      } else { c.vx = 0; c.vy = 0; }
      const a = reducedRef.current ? 1 : 1 - Math.exp(-dt * c.k);
      const dl = Math.log(c.ts) - c.ls;
      if (Math.abs(c.tx - c.x) * c.s > 0.2 || Math.abs(c.ty - c.y) * c.s > 0.2 || Math.abs(dl) > 0.0008) {
        c.x += (c.tx - c.x) * a; c.y += (c.ty - c.y) * a; c.ls += dl * a; c.s = Math.exp(c.ls);
        active = true;
      } else { c.x = c.tx; c.y = c.ty; c.ls = Math.log(c.ts); c.s = c.ts; }
      render();
      if (active) raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    const setZoomAt = (mx: number, my: number, ns: number, direct: boolean) => {
      const s2 = clamp(ns, MIN_S, MAX_S);
      const wx = c.tx + (mx - c.vw / 2) / c.ts, wy = c.ty + (my - c.vh / 2) / c.ts;
      c.ts = s2; c.tx = wx - (mx - c.vw / 2) / s2; c.ty = wy - (my - c.vh / 2) / s2;
      panBy(0, 0);
      if (direct) { c.x = c.tx; c.y = c.ty; c.s = s2; c.ls = Math.log(s2); }
    };
    const interact = () => { setTouched(true); };

    api.current = {
      kick,
      fly: (it, panel) => {
        measure();
        const mobile = c.vw < 720;
        const pw = panel && !mobile ? Math.min(480, c.vw * 0.46) : 0;
        const ph = panel && mobile ? c.vh * 0.56 : 0;
        const s = clamp(Math.min(((c.vw - pw) * 0.76) / it.w, ((c.vh - ph - 130) * 0.8) / it.h), 0.3, 1.6);
        c.ts = s; c.tx = it.x + pw / 2 / (s * it.f); c.ty = it.y + ph / 2 / (s * it.f); c.k = 4.2;
        kick();
      },
      overview: () => { measure(); const o = ovTarget(c.vw, c.vh); c.tx = o.x; c.ty = o.y; c.ts = o.s; c.k = 3.6; kick(); },
      zoom: (fct) => { c.k = 9; setZoomAt(c.vw / 2, c.vh / 2, c.ts * fct, false); kick(); },
      pan: (dx, dy) => { c.k = 9; panBy(dx / c.ts, dy / c.ts); kick(); },
      goto: (wx, wy) => { c.k = 7; c.tx = wx; c.ty = wy; panBy(0, 0); kick(); },
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      interact();
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      c.vx = 0; c.vy = 0;
      if (ptrs.size === 1) {
        didDrag = false;
        Object.assign(drag, { active: true, moved: false, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, vx: 0, vy: 0 });
        c.tx = c.x; c.ty = c.y; c.ts = c.s; c.ls = Math.log(c.s);
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: c.s };
        didDrag = true;
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      const rect = stage.getBoundingClientRect();
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        setZoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, pinch.s0 * (d / pinch.d0), true);
        kick();
        return;
      }
      if (!drag.active) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
        drag.moved = true; didDrag = true;
        try { view.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        view.classList.add("is-drag");
      }
      if (!drag.moved) return;
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly, dts = Math.max(0.001, (e.timeStamp - drag.lt) / 1000);
      drag.vx = drag.vx * 0.6 + (dx / dts) * 0.4; drag.vy = drag.vy * 0.6 + (dy / dts) * 0.4;
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = e.timeStamp;
      panBy(-dx / c.s, -dy / c.s);
      c.x = c.tx; c.y = c.ty;
      kick();
    };
    const onUp = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) {
        if (drag.moved && e.timeStamp - drag.lt < 90 && !reducedRef.current) { c.vx = clamp(drag.vx, -4000, 4000); c.vy = clamp(drag.vy, -4000, 4000); }
        drag.active = false; drag.moved = false;
        view.classList.remove("is-drag");
        kick();
      } else {
        const [r] = [...ptrs.values()];
        drag.lx = r.x; drag.ly = r.y;
      }
    };
    const onWheel = (e: WheelEvent) => {
      measure();
      const rect = stage.getBoundingClientRect();
      const mul = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? c.vh : 1;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); interact();
        const fct = clamp(Math.exp(-e.deltaY * mul * 0.01), 0.8, 1.25);
        c.k = 14;
        setZoomAt(e.clientX - rect.left, e.clientY - rect.top, c.ts * fct, false);
        kick();
        return;
      }
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX, dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
      if (panBy((dx * mul) / c.ts, (dy * mul) / c.ts)) { e.preventDefault(); interact(); c.k = 14; kick(); }
    };
    const onClickCap = (e: MouseEvent) => { if (didDrag) { e.preventDefault(); e.stopPropagation(); didDrag = false; } };
    const onDbl = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".kn-card")) return;
      const rect = stage.getBoundingClientRect();
      c.k = 8; setZoomAt(e.clientX - rect.left, e.clientY - rect.top, c.ts * 1.7, false); kick();
    };
    const onScroll = () => { stage.scrollTop = 0; stage.scrollLeft = 0; };
    const onResize = () => {
      measure();
      if (!awayRef.current && !openRef.current) { const o = ovTarget(c.vw, c.vh); c.x = c.tx = o.x; c.y = c.ty = o.y; c.s = c.ts = o.s; c.ls = Math.log(o.s); }
      else if (openRef.current) { const it = ITEMS.find((i) => i.id === openRef.current); if (it) api.current?.fly(it, true); }
      kick();
    };

    measure();
    const o = ovTarget(c.vw, c.vh);
    c.tx = o.x; c.ty = o.y; c.ts = o.s; c.x = o.x; c.y = o.y;
    c.s = reducedRef.current ? o.s : o.s * 2.1; c.ls = Math.log(c.s); c.k = 1.7;
    render();
    kick();
    const rdy = requestAnimationFrame(() => setReady(true));

    view.addEventListener("pointerdown", onDown);
    view.addEventListener("pointermove", onMove);
    view.addEventListener("pointerup", onUp);
    view.addEventListener("pointercancel", onUp);
    view.addEventListener("wheel", onWheel, { passive: false });
    view.addEventListener("click", onClickCap, true);
    view.addEventListener("dblclick", onDbl);
    stage.addEventListener("scroll", onScroll);
    const ro = new ResizeObserver(onResize);
    ro.observe(stage);
    return () => {
      view.removeEventListener("pointerdown", onDown); view.removeEventListener("pointermove", onMove);
      view.removeEventListener("pointerup", onUp); view.removeEventListener("pointercancel", onUp);
      view.removeEventListener("wheel", onWheel); view.removeEventListener("click", onClickCap, true);
      view.removeEventListener("dblclick", onDbl); stage.removeEventListener("scroll", onScroll);
      ro.disconnect(); cancelAnimationFrame(rdy);
      if (raf) cancelAnimationFrame(raf);
      api.current = null;
    };
  }, [listView]);

  /* ---------------- panel ---------------- */
  useEffect(() => {
    if (openId) {
      const t = window.setTimeout(() => headRef.current?.focus({ preventScroll: true }), 60);
      if (panelRef.current) panelRef.current.scrollTop = 0;
      return () => window.clearTimeout(t);
    }
  }, [openId]);

  const open = (it: Item, el?: HTMLElement | null) => {
    if (el) lastBtn.current = el;
    setOpenId(it.id);
    api.current?.fly(it, true);
  };
  const close = () => {
    setOpenId(null);
    lastBtn.current?.focus({ preventScroll: true });
  };
  const overview = () => { setOpenId(null); api.current?.overview(); };
  const step = (dir: number) => {
    const i = ITEMS.findIndex((x) => x.id === openId);
    const n = ITEMS[(i + dir + ITEMS.length) % ITEMS.length];
    lastBtn.current = els.current[n.id];
    open(n);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (openId) { e.preventDefault(); close(); } else if (away) { e.preventDefault(); overview(); }
      return;
    }
    if (listView || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement).closest(".kn-panel,.kn-top,.kn-ctl")) return;
    const a = api.current;
    if (!a) return;
    const k = e.key;
    const st = 180;
    if (k === "ArrowLeft") a.pan(-st, 0);
    else if (k === "ArrowRight") a.pan(st, 0);
    else if (k === "ArrowUp") a.pan(0, -st);
    else if (k === "ArrowDown") a.pan(0, st);
    else if (k === "+" || k === "=") a.zoom(1.3);
    else if (k === "-" || k === "_") a.zoom(1 / 1.3);
    else if (k === "0" || k === "Home") a.overview();
    else return;
    setTouched(true);
    e.preventDefault();
  };
  const mmMove = (e: React.PointerEvent) => {
    if (e.type === "pointermove" && !(e.buttons & 1)) return;
    const b = mmBox.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    api.current?.goto(clamp(((e.clientX - r.left) / r.width) * W, 0, W), clamp(((e.clientY - r.top) / r.height) * H, 0, H));
    setTouched(true);
  };

  const reg = (id: string) => (el: HTMLElement | null) => { els.current[id] = el; };
  const btn = (it: Item) => (
    <button
      type="button"
      className={`kn-card kn-card--${it.kind}${openId === it.id ? " is-open" : ""}`}
      aria-label={`${it.title}. ${it.kicker}. Opens case study.`}
      onClick={(e) => open(it, e.currentTarget)}
      onFocus={(e) => {
        if (listView) return;
        let vis = false;
        try { vis = e.currentTarget.matches(":focus-visible"); } catch { vis = true; }
        if (vis) { lastBtn.current = e.currentTarget; api.current?.fly(it, !!openRef.current); }
      }}
    >
      <Face it={it} />
      <Cap it={it} />
    </button>
  );

  return (
    <div ref={stageRef} className={`kn-stage${listView ? " kn-stage--list" : ""}${ready || listView ? " kn-ready" : ""}`} onKeyDown={onKey}>
      <div className="kn-top">
        <div className="kn-brand"><span className="kn-brand-n">Kiln</span><span className="kn-brand-s">Ceramics &amp; design · Lisbon</span></div>
        <div className="kn-top-r">
          <button type="button" className="kn-btn kn-btn--ghost" aria-pressed={listView} onClick={() => { setListView((v) => !v); setOpenId(null); }}>
            <span aria-hidden>{listView ? "◧" : "☰"}</span> {listView ? "Canvas view" : "List view"}
          </button>
          <a className="kn-btn kn-btn--solid" href="#kn-commission">Commission</a>
        </div>
      </div>

      {!listView && (
        <>
          <div className="kn-bg1" ref={bg1} aria-hidden />
          <div className="kn-bg2" ref={bg2} aria-hidden />
          <div
            ref={viewRef}
            className="kn-view"
            tabIndex={0}
            role="group"
            aria-label="Studio canvas. Arrow keys pan, plus and minus zoom, zero returns to overview. Tab moves through every project, note, sketch and the map."
          >
            {DECOR.map((d) => (
              <div key={d.id} ref={reg(d.id)} className={`kn-it kn-decor kn-decor--${d.k}`} style={{ width: d.w, height: d.h, marginLeft: -d.w / 2, marginTop: -d.h / 2 }} aria-hidden>
                <DecorArt d={d} />
              </div>
            ))}
            <div ref={reg("title")} className="kn-it kn-title" style={{ width: 1500, height: 560, marginLeft: -750, marginTop: -280 }}>
              <h1 className="kn-h1" aria-label="Kiln. Ceramics and design studio, Lisbon."><Slab /></h1>
            </div>
            {ITEMS.map((it) => (
              <div key={it.id} ref={reg(it.id)} className={`kn-it kn-it--${it.kind}`} style={{ width: it.w, height: it.h, marginLeft: -it.w / 2, marginTop: -it.h / 2 }}>
                {btn(it)}
              </div>
            ))}
          </div>
          <p className={`kn-hint${touched ? " is-off" : ""}`} aria-hidden>Drag to explore · scroll to pan · ctrl + scroll or pinch to zoom · Tab visits every piece</p>
          <div className="kn-ctl" role="group" aria-label="Camera">
            <button type="button" className="kn-btn kn-btn--round" onClick={() => api.current?.zoom(1 / 1.3)} aria-label="Zoom out">−</button>
            <button type="button" className={`kn-btn kn-btn--solid kn-ret${away ? " is-on" : ""}`} onClick={overview}>Return to overview</button>
            <button type="button" className="kn-btn kn-btn--round" onClick={() => api.current?.zoom(1.3)} aria-label="Zoom in">+</button>
          </div>
          <div className="kn-mm" aria-hidden>
            <div className="kn-mm-box" ref={mmBox} onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); mmMove(e); }} onPointerMove={mmMove}>
              {ITEMS.map((it) => <i key={it.id} className="kn-mm-dot" style={{ left: `${((it.x - it.w / 2) / W) * 100}%`, top: `${((it.y - it.h / 2) / H) * 100}%`, width: `${(it.w / W) * 100}%`, height: `${(it.h / H) * 100}%`, background: MMC[it.kind] }} />)}
              <i className="kn-mm-vp" ref={mmVp} />
            </div>
            <span className="kn-mm-l">Map</span>
          </div>
        </>
      )}

      {listView && (
        <div className="kn-list">
          <h1 className="kn-lh1">Kiln<span>.</span></h1>
          <p className="kn-llede">Ceramics and design studio, Lisbon. Tableware, lighting and surfaces, thrown by hand. This is the studio canvas as a plain list: every project, note, sketch and the map.</p>
          <div className="kn-lgrid">
            {ITEMS.map((it) => <div key={it.id} className="kn-lcell">{btn(it)}</div>)}
          </div>
        </div>
      )}

      <aside ref={panelRef} className={`kn-panel${openId ? " is-on" : ""}${listView ? " kn-panel--fixed" : ""}`} aria-hidden={!openId} aria-labelledby="kn-panel-h" role="dialog" aria-modal="false">
        {listView && openId && <button type="button" className="kn-scrim" aria-label="Close case study" tabIndex={-1} onClick={close} />}
        <div className="kn-p-in" key={lastItem.current.id}>
          <button type="button" className="kn-x" onClick={close} aria-label="Close case study" tabIndex={openId ? 0 : -1}>×</button>
          <p className="kn-k">{lastItem.current.kicker}</p>
          <h2 id="kn-panel-h" className="kn-p-h" tabIndex={-1} ref={headRef}>{lastItem.current.title}</h2>
          <div className={`kn-p-art kn-p-art--${lastItem.current.kind}`}>
            {lastItem.current.kind === "note" || lastItem.current.kind === "about" ? <div className={lastItem.current.kind === "note" ? "kn-p-note" : "kn-p-about"}><Face it={lastItem.current} /></div> : <Art kind={lastItem.current.art} label={lastItem.current.title} />}
          </div>
          <p className="kn-p-lead">{lastItem.current.lead}</p>
          <h3 className="kn-p-h3">Details</h3>
          <dl className="kn-specs">{lastItem.current.specs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {lastItem.current.steps && (<><h3 className="kn-p-h3">{lastItem.current.kind === "project" ? "Process" : "In practice"}</h3><ol className="kn-steps">{lastItem.current.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></>)}
          <div className="kn-p-nav">
            <button type="button" className="kn-btn kn-btn--ghost" onClick={() => step(-1)} tabIndex={openId ? 0 : -1}>← Previous</button>
            <button type="button" className="kn-btn kn-btn--ghost" onClick={overview} tabIndex={openId ? 0 : -1}>Overview</button>
            <button type="button" className="kn-btn kn-btn--ghost" onClick={() => step(1)} tabIndex={openId ? 0 : -1}>Next →</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ================================================================== */
/* Below the canvas                                                    */
/* ================================================================== */
const MANIFESTO = "We make *things that are meant to be handled.* Every vessel is thrown, trimmed and fired in our Lisbon studio, so it arrives with the small honest evidence of a hand: a thumbprint in the foot, a glaze that pooled where the wall was thin. We design slowly, fire carefully and keep our batches *small enough to remember.*".split(" ");

function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  useScrub(ref, (p) => { ref.current?.style.setProperty("--p", p.toFixed(3)); });
  let em = false;
  const words = MANIFESTO.map((w, i) => {
    const starts = w.startsWith("*"), ends = w.endsWith("*");
    if (starts) em = true;
    const clean = w.replace(/\*/g, "");
    const out = <span key={i} className={`kn-w${em ? " kn-w--em" : ""}`} style={{ "--i": i, "--n": MANIFESTO.length } as CSSProperties}>{clean} </span>;
    if (ends) em = false;
    return out;
  });
  return (
    <section ref={ref} className="kn-tall kn-man" id="kn-studio" style={{ height: "220vh" }}>
      <div className="kn-sticky">
        <p className="kn-eyebrow">The studio</p>
        <p className="kn-man-t">{words}</p>
      </div>
    </section>
  );
}

const K0: Prof = [[40, 170], [62, 176], [72, 190], [74, 205], [72, 218], [68, 228], [66, 232]];
const K1: Prof = [[22, 110], [28, 125], [38, 150], [48, 175], [56, 200], [62, 220], [64, 230]];
const K2: Prof = [[60, 60], [62, 90], [62, 125], [62, 160], [62, 195], [62, 222], [62, 230]];
const K3: Prof = [[34, 22], [30, 45], [46, 85], [74, 125], [78, 165], [66, 205], [52, 230]];
const KF = [K0, K1, K2, K3];
function morph(p: number): Prof {
  const sgm = clamp(p, 0, 0.9999) * 3, i = Math.floor(sgm), t = ease(sgm - i);
  return KF[i].map((a, n) => [lerp(a[0], KF[i + 1][n][0], t), lerp(a[1], KF[i + 1][n][1], t)]);
}
const THROW_STEPS = ["Centre the clay", "Open the well", "Pull the walls", "Shape and collar"];

function Throwing() {
  const ref = useRef<HTMLElement>(null);
  const body = useRef<SVGPathElement>(null), clipP = useRef<SVGPathElement>(null), rim = useRef<SVGEllipseElement>(null), rimIn = useRef<SVGEllipseElement>(null);
  const rings = useRef<SVGGElement>(null), hl = useRef<SVGGElement>(null), hr = useRef<SVGGElement>(null), head = useRef<SVGGElement>(null);
  const read = useRef<HTMLSpanElement>(null);
  const lis = useRef<(HTMLLIElement | null)[]>([]);
  const uid = "knw" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const cx = 200;
  const ringLines = useMemo(() => Array.from({ length: 22 }, (_, i) => 24 + i * 10), []);
  useScrub(ref, (p) => {
    const prof = morph(p);
    const d = outline(prof, cx);
    body.current?.setAttribute("d", d);
    clipP.current?.setAttribute("d", d);
    const r0 = prof[0][0], y0 = prof[0][1];
    for (const e of [rim.current, rimIn.current]) if (e) { e.setAttribute("cy", String(y0)); e.setAttribute("rx", String(r0)); e.setAttribute("ry", String(Math.max(2, r0 * 0.2))); }
    if (rimIn.current) rimIn.current.setAttribute("rx", String(Math.max(0, r0 - 4)));
    if (rimIn.current) rimIn.current.style.opacity = String(clamp((p - 0.28) * 6, 0, 1));
    if (rings.current) rings.current.style.opacity = String(clamp(p * 1.4, 0, 0.9));
    const hy = lerp(212, 40 + (1 - p) * 70, ease(p));
    const rr = rAt(prof, clamp(hy, y0 + 2, 228));
    hl.current?.setAttribute("transform", `translate(${cx - rr - 4} ${hy})`);
    hr.current?.setAttribute("transform", `translate(${cx + rr + 4} ${hy}) scale(-1 1)`);
    head.current?.setAttribute("transform", `translate(${(p * 900) % 30} 0)`);
    const idx = Math.min(3, Math.floor(p * 4));
    lis.current.forEach((li, i) => li && li.classList.toggle("is-on", i === idx));
    if (read.current) read.current.textContent = `Height ${Math.round((232 - y0) * 1.8)} mm · wall ${(14 - p * 9).toFixed(1)} mm`;
  });
  return (
    <section ref={ref} className="kn-tall kn-throw" id="kn-wheel" style={{ height: "320vh" }}>
      <div className="kn-sticky kn-throw-in">
        <div className="kn-throw-l">
          <p className="kn-eyebrow">On the wheel</p>
          <h2 className="kn-h2">One lump, <em>four moves.</em></h2>
          <p className="kn-body">Scroll to throw. A kilo and a half of stoneware becomes a vase in about six minutes, if the hands know what they are doing and the clay agrees.</p>
          <ol className="kn-tsteps">{THROW_STEPS.map((s, i) => <li key={s} ref={(el) => { lis.current[i] = el; }} className={i === 0 ? "is-on" : ""}><span>0{i + 1}</span>{s}</li>)}</ol>
          <p className="kn-mono"><span ref={read}>Height 76 mm · wall 14.0 mm</span></p>
        </div>
        <svg className="kn-throw-svg" viewBox="0 0 400 300" role="img" aria-label="A lump of clay on a wheel is centred, opened, pulled and shaped into a vase as you scroll.">
          <defs>
            <clipPath id={uid + "c"}><path ref={clipP} d={outline(K3, cx)} /></clipPath>
            <linearGradient id={uid + "s"} gradientUnits="userSpaceOnUse" x1="110" x2="290" y1="0" y2="0">
              <stop offset="0" stopColor="#000" stopOpacity=".5" /><stop offset=".25" stopColor="#fff" stopOpacity=".24" /><stop offset=".5" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".5" />
            </linearGradient>
            <clipPath id={uid + "w"}><ellipse cx="200" cy="256" rx="150" ry="22" /></clipPath>
          </defs>
          <ellipse cx="200" cy="262" rx="170" ry="26" fill="#000" opacity=".35" />
          <path d="M60 248V262Q200 300 340 262V248Z" fill="#26211F" />
          <ellipse cx="200" cy="248" rx="150" ry="22" fill="#3b312d" />
          <g clipPath={`url(#${uid}w)`}><g ref={head} stroke="#8a7a6c" strokeWidth="1.6" opacity=".6">{Array.from({ length: 22 }).map((_, i) => <line key={i} x1={i * 30 - 60} x2={i * 30 - 60} y1="230" y2="278" />)}</g></g>
          <ellipse cx="200" cy="248" rx="150" ry="22" fill="none" stroke="#8a7a6c" strokeOpacity=".6" />
          <path ref={body} d={outline(K0, cx)} fill="#B5573A" />
          <g clipPath={`url(#${uid}c)`}>
            <rect x="100" y="0" width="200" height="260" fill={`url(#${uid}s)`} />
            <g ref={rings} stroke="#000" strokeOpacity=".16" fill="none" style={{ opacity: 0 }}>{ringLines.map((y) => <path key={y} d={`M100 ${y}Q200 ${y + (y % 20 ? 2 : -2)} 300 ${y}`} />)}</g>
          </g>
          <ellipse ref={rim} cx="200" cy="170" rx="40" ry="8" fill="#D08A66" />
          <ellipse ref={rimIn} cx="200" cy="170" rx="36" ry="7" fill="#6b3220" style={{ opacity: 0 }} />
          {[hl, hr].map((rf, i) => (
            <g key={i} ref={rf} transform={`translate(${i ? 270 : 130} 212)${i ? " scale(-1 1)" : ""}`}>
              <rect x="-6" y="-24" width="30" height="48" rx="15" fill="#D9B79D" stroke="#3a312c" strokeWidth="1.4" />
              <rect x="-90" y="-20" width="90" height="40" rx="20" fill="#D9B79D" stroke="#3a312c" strokeWidth="1.4" />
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

const HOT: [number, number[]][] = [[0, [42, 29, 25]], [0.35, [110, 44, 28]], [0.62, [200, 70, 30]], [0.85, [255, 150, 70]], [1, [255, 230, 190]]];
function hotColor(t: number): string {
  for (let i = 0; i < HOT.length - 1; i++) {
    const [a, ca] = HOT[i], [b, cb] = HOT[i + 1];
    if (t <= b) { const u = (t - a) / (b - a); return `rgb(${ca.map((v, n) => Math.round(lerp(v, cb[n], u))).join(",")})`; }
  }
  return "rgb(255,230,190)";
}
const FIRE_STAGES: [number, string, string][] = [[1, "Water smoking", "Doors cracked, vents open. Steam leaves the clay."], [3.6, "Quartz inversion", "573°C. We crawl through it. Hurry here and the pots crack."], [8.6, "Climbing", "Glazes begin to melt and seal. The peephole turns orange."], [9.5, "Cone 6, soak", "1222°C. We watch the cones bend, then hold for twenty minutes."], [99, "Cooling", "Lid shut for twelve hours. Nobody opens it before 150°C."]];

function Firing() {
  const ref = useRef<HTMLElement>(null);
  const path = useRef<SVGPathElement>(null), dot = useRef<SVGCircleElement>(null), glow = useRef<HTMLDivElement>(null);
  const tEl = useRef<HTMLSpanElement>(null), hEl = useRef<HTMLSpanElement>(null), sEl = useRef<HTMLSpanElement>(null), dEl = useRef<HTMLSpanElement>(null);
  const X = (h: number) => 70 + (h / 20) * 800, Y = (t: number) => 330 - (t / 1300) * 290;
  const pts = useMemo(() => FIRE.map(([h, t]) => [X(h), Y(t)]), []);
  const d = `M${pts[0][0]} ${pts[0][1]}${seg(pts)}`;
  useScrub(ref, (p) => {
    const pe = path.current;
    if (!pe) return;
    const len = pe.getTotalLength();
    const pt = pe.getPointAtLength(len * p);
    pe.style.strokeDashoffset = String(1 - p);
    dot.current?.setAttribute("cx", String(pt.x)); dot.current?.setAttribute("cy", String(pt.y));
    const T = Math.min(1222, ((330 - pt.y) / 290) * 1300), h = ((pt.x - 70) / 800) * 20;
    if (tEl.current) tEl.current.textContent = `${Math.round(Math.max(20, T)).toLocaleString("en-US")}`;
    if (hEl.current) hEl.current.textContent = `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
    const st = FIRE_STAGES.find((s) => h < s[0]) || FIRE_STAGES[4];
    if (sEl.current) sEl.current.textContent = st[1];
    if (dEl.current) dEl.current.textContent = st[2];
    const hot = clamp((T - 150) / 1072, 0, 1);
    const c = hotColor(hot);
    if (glow.current) { glow.current.style.background = `radial-gradient(circle at 50% 50%, ${c} 0%, ${c} 22%, rgba(60,25,15,.9) 62%, #1c1614 100%)`; glow.current.style.boxShadow = `0 0 ${Math.round(hot * 140)}px ${Math.round(hot * 30)}px rgba(255,120,40,${(hot * 0.5).toFixed(2)})`; }
  });
  return (
    <section ref={ref} className="kn-tall kn-fire" id="kn-kiln" style={{ height: "300vh" }}>
      <div className="kn-sticky kn-fire-in">
        <div className="kn-fire-l">
          <p className="kn-eyebrow kn-eyebrow--lt">In the kiln</p>
          <h2 className="kn-h2 kn-h2--lt">Twenty hours, <em>one curve.</em></h2>
          <div className="kn-peep" aria-hidden><div className="kn-peep-ring"><div className="kn-peep-glow" ref={glow} /></div></div>
        </div>
        <div className="kn-fire-r">
          <div className="kn-read">
            <div><span className="kn-big"><span ref={tEl}>20</span><small>°C</small></span><span className="kn-mono kn-mono--lt">elapsed <span ref={hEl}>0h 00m</span></span></div>
            <div aria-live="off"><strong ref={sEl} className="kn-stage-n">Water smoking</strong><span ref={dEl} className="kn-stage-d">Doors cracked, vents open. Steam leaves the clay.</span></div>
          </div>
          <svg viewBox="0 0 900 380" className="kn-chart" role="img" aria-label="Kiln temperature over twenty hours: a slow climb to 1222 degrees Celsius, a twenty minute soak, then a long cool-down.">
            <g stroke="#EFE6D6" strokeOpacity=".16">{[0, 300, 600, 900, 1200].map((t) => <line key={t} x1="70" x2="880" y1={Y(t)} y2={Y(t)} />)}</g>
            <g fill="#EFE6D6" fillOpacity=".6" fontFamily="ui-monospace,Menlo,monospace" fontSize="12">{[0, 300, 600, 900, 1200].map((t) => <text key={t} x="62" y={Y(t) + 4} textAnchor="end">{t}</text>)}{[0, 5, 10, 15, 20].map((h) => <text key={h} x={X(h)} y="356" textAnchor="middle">{h}h</text>)}</g>
            <line x1="70" x2="880" y1={Y(1222)} y2={Y(1222)} stroke="#C98F4F" strokeDasharray="4 6" strokeOpacity=".7" />
            <text x="878" y={Y(1222) - 8} textAnchor="end" fill="#C98F4F" fontFamily="ui-monospace,Menlo,monospace" fontSize="12">cone 6 · 1222°C</text>
            <path d={d} fill="none" stroke="#EFE6D6" strokeOpacity=".14" strokeWidth="3" />
            <path ref={path} d={d} pathLength={1} fill="none" stroke="#E27A4B" strokeWidth="4" strokeLinecap="round" strokeDasharray="1" strokeDashoffset="1" />
            <circle ref={dot} cx="70" cy={Y(20)} r="8" fill="#FFD9A8" stroke="#E27A4B" strokeWidth="3" />
          </svg>
        </div>
      </div>
    </section>
  );
}

type GlazeInfo = { id: keyof typeof GL; name: string; cone: string; finish: string; recipe: string };
const GLAZES: GlazeInfo[] = [
  { id: "tide", name: "Tidewater Blue", cone: "Cone 6 · oxidation", finish: "Satin gloss that breaks to rust on edges.", recipe: "Nepheline syenite 42 · Whiting 18 · EPK 14 · Silica 24 · Cobalt carb 0.5 · Rutile 2" },
  { id: "bone", name: "Bone Satin", cone: "Cone 6 · oxidation", finish: "Soft matte that pools in the throwing rings.", recipe: "Custer feldspar 38 · Dolomite 14 · Zinc oxide 4 · EPK 12 · Silica 22 · Tin oxide 6" },
  { id: "iron", name: "Iron Night", cone: "Cone 6 · oxidation", finish: "Deep black, breaking to tenmoku brown on rims.", recipe: "Albany slip 60 · Frit 3134 20 · Nepheline 12 · Red iron oxide 8" },
  { id: "ember", name: "Ember", cone: "Cone 6 · oxidation", finish: "A copper-red warmth, without a reduction kiln.", recipe: "Frit 3195 44 · Silica 18 · EPK 10 · Whiting 12 · Copper carb 2 · Tin 1" },
  { id: "ochre", name: "Ochre Ash", cone: "Cone 6 · oxidation", finish: "Runs and pools like wood ash. Dips best at 45%.", recipe: "Hardwood ash 40 · Feldspar 30 · EPK 20 · Rutile 6 · Red iron oxide 4" },
  { id: "raw", name: "Raw Clay", cone: "Cone 04 · bisque only", finish: "Unglazed and burnished. Warm, faintly dusty.", recipe: "No glaze. Burnish with a spoon at leather-hard." },
];
function Glazes() {
  const [sel, setSel] = useState(0);
  const g = GLAZES[sel];
  const onKey = (e: React.KeyboardEvent) => {
    const n = GLAZES.length;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); setSel((s) => (s + 1) % n); }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); setSel((s) => (s + n - 1) % n); }
  };
  useEffect(() => { /* keep DOM focus on the selected radio */ const el = document.querySelector<HTMLElement>(`.kn-gl-b[aria-checked="true"]`); if (el && document.activeElement?.classList.contains("kn-gl-b")) el.focus(); }, [sel]);
  return (
    <section className="kn-sec kn-glz" id="kn-glazes">
      <div className="kn-wrap kn-glz-g">
        <div className="kn-rv">
          <p className="kn-eyebrow">Glaze library</p>
          <h2 className="kn-h2">Six glazes, <em>tested to death.</em></h2>
          <p className="kn-body">Choose one. Every recipe has been tile-tested on every clay body we use, then fired in both kilns.</p>
          <div className="kn-gl-list" role="radiogroup" aria-label="Glaze" onKeyDown={onKey}>
            {GLAZES.map((x, i) => (
              <button key={x.id} type="button" role="radio" aria-checked={sel === i} tabIndex={sel === i ? 0 : -1} className={`kn-gl-b${sel === i ? " is-on" : ""}`} onClick={() => setSel(i)}>
                <i className="kn-sw" style={{ background: `linear-gradient(135deg, ${GL[x.id].a}, ${GL[x.id].b})` }} />
                <span>{x.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="kn-gl-stage kn-rv">
          <svg viewBox="0 0 300 260" key={g.id} className="kn-gl-svg" role="img" aria-label={`A vase glazed in ${g.name}`}>
            <Scene bg="#E4D7C0"><g transform={at(150, 1.05)}><Vessel prof={PROF.vase} glaze={GL[g.id]} seed={7 + sel} /></g><g transform={at(52, 0.52)}><Vessel prof={PROF.cup} glaze={GL[g.id]} seed={3 + sel} /></g><g transform={at(250, 0.62)}><Vessel prof={PROF.bowl} glaze={GL[g.id]} seed={5 + sel} /></g></Scene>
          </svg>
          <div className="kn-gl-info" aria-live="polite">
            <h3>{g.name}</h3>
            <p className="kn-mono">{g.cone}</p>
            <p>{g.finish}</p>
            <p className="kn-recipe">{g.recipe}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const t = ["Stoneware", "Porcelain", "Cone 6", "Hand-thrown", "Lisbon", "Two kilns", "Seconds by the fig tree", "Commissions open"];
  return (
    <div className="kn-marq" aria-hidden>
      <div className="kn-marq-track">{[0, 1].map((k) => <span key={k}>{t.map((x) => <b key={x}>{x}<i>●</i></b>)}</span>)}</div>
    </div>
  );
}

function Commission() {
  const [sent, setSent] = useState(false);
  return (
    <section className="kn-sec kn-com" id="kn-commission">
      <div className="kn-wrap kn-com-g">
        <div className="kn-rv">
          <p className="kn-eyebrow">Commissions</p>
          <h2 className="kn-h2">Spring 2027 books <em>are open.</em></h2>
          <p className="kn-body">Tell us what you are imagining. We reply within three working days, usually with questions, sometimes with a clay sample in the post.</p>
          <ul className="kn-lead">
            <li><b>Tableware sets</b><span>8 to 12 weeks</span></li>
            <li><b>Lighting</b><span>12 to 16 weeks</span></li>
            <li><b>Tiles and surfaces</b><span>5 to 6 months</span></li>
            <li><b>Single pieces</b><span>4 to 6 weeks</span></li>
          </ul>
        </div>
        <form className="kn-form kn-rv" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          {sent ? (
            <div className="kn-sent" role="status"><h3>Thank you.</h3><p>Your note is on the long table. Expect a reply from Ines within three working days.</p><button type="button" className="kn-btn kn-btn--ghost" onClick={() => setSent(false)}>Send another</button></div>
          ) : (
            <>
              <label>Your name<input name="name" required autoComplete="name" /></label>
              <label>Email<input name="email" type="email" required autoComplete="email" /></label>
              <label>What are you after?
                <select name="type" defaultValue="Tableware set"><option>Tableware set</option><option>Lighting</option><option>Tiles or surfaces</option><option>Planters</option><option>Something else</option></select>
              </label>
              <label>Tell us about it<textarea name="msg" rows={4} required placeholder="Where will it live? How many? By when?" /></label>
              <button type="submit" className="kn-btn kn-btn--solid kn-btn--lg">Send to the studio</button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="kn-foot">
      <div className="kn-wrap kn-foot-g">
        <div><h3>Visit</h3><p>Rua do Forno 14<br />Lisbon, Portugal<br />Saturdays 11 to 17</p></div>
        <div><h3>Write</h3><p><a href="mailto:hello@kilnstudio.example">hello@kilnstudio.example</a><br />Press and trade: <a href="mailto:press@kilnstudio.example">press@kilnstudio.example</a></p></div>
        <div><h3>Follow</h3><p><a href="#kn-studio">Journal</a><br /><a href="#kn-glazes">Glaze notes</a><br /><a href="#kn-kiln">Kiln log</a></p></div>
      </div>
      <p className="kn-word" aria-hidden>Kiln</p>
      <p className="kn-fine">© 2026 Kiln Studio Lda. Made by hand, fired twice.</p>
    </footer>
  );
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */
export function Page() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const nodes = el.querySelectorAll(".kn-rv");
    if (typeof IntersectionObserver === "undefined") { nodes.forEach((n) => n.classList.add("is-in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { threshold: 0.15 });
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return (
    <div ref={root} className="kn">
      <style>{CSS}</style>
      <Stage />
      <Marquee />
      <Manifesto />
      <Throwing />
      <Firing />
      <Glazes />
      <Commission />
      <Footer />
    </div>
  );
}
export default Page;

/* ================================================================== */
/* Styles                                                              */
/* ================================================================== */
const CSS = `
.kn{--kn-bone:#EFE6D6;--kn-bone2:#E4D7C0;--kn-paper:#F6EFE0;--kn-terra:#B5573A;--kn-terra-d:#8F3F28;--kn-blue:#3F6F86;--kn-blue-l:#8FB4BF;--kn-char:#26211F;--kn-ash:#6E645B;--kn-ochre:#C98F4F;
--kn-serif:"Fraunces","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;--kn-sans:"Instrument Sans","Avenir Next","Segoe UI",system-ui,-apple-system,sans-serif;--kn-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--kn-hand:"Bradley Hand","Segoe Print","Chalkboard SE","Comic Sans MS",cursive;
--kn-grain:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .25 0 0 0 0 .15 0 0 0 0 .1 0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.55'/></svg>");
font-family:var(--kn-sans);font-size:16px;line-height:1.5;color:var(--kn-char);background:var(--kn-bone);box-sizing:border-box;position:relative;overflow-x:clip;-webkit-font-smoothing:antialiased}
.kn *,.kn *::before,.kn *::after{box-sizing:border-box}
.kn :where(h1,h2,h3,p,ul,ol,dl,dd,figure){margin:0;padding:0}
.kn :where(ul,ol){list-style:none}
.kn :where(button,input,select,textarea){font:inherit;color:inherit;margin:0}
.kn :where(a){color:inherit}
.kn :where(svg){display:block}
.kn-wrap{max-width:1200px;margin:0 auto;padding:0 24px}
.kn-eyebrow{font-family:var(--kn-mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--kn-terra-d);margin-bottom:18px}
.kn-eyebrow--lt{color:#E6A47F}
.kn-h2{font-family:var(--kn-serif);font-weight:500;font-size:clamp(36px,5vw,72px);line-height:1.03;letter-spacing:-.025em;text-wrap:balance}
.kn-h2 em{font-style:italic;color:var(--kn-terra)}
.kn-h2--lt{color:var(--kn-bone)}.kn-h2--lt em{color:#E6A47F}
.kn-body{font-size:18px;line-height:1.65;color:#4a413b;max-width:34em;margin-top:20px}
.kn-mono{font-family:var(--kn-mono);font-size:13px;letter-spacing:.04em;color:var(--kn-ash)}
.kn-mono--lt{color:#d6c9b5}

/* ---- stage ---- */
.kn-stage{position:relative;height:100vh;height:100svh;min-height:560px;overflow:hidden;overflow:clip;background:#E9DFCB;background-image:var(--kn-grain);isolation:isolate}
.kn-stage--list{height:auto;min-height:100vh;overflow:visible;padding-bottom:72px}
.kn-bg1,.kn-bg2{position:absolute;inset:0;pointer-events:none;z-index:0}
.kn-bg1{background-image:radial-gradient(circle,rgba(38,33,31,.28) 1.4px,transparent 1.9px);background-size:80px 80px}
.kn-bg2{background-image:linear-gradient(rgba(181,87,58,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(181,87,58,.14) 1px,transparent 1px);background-size:400px 400px}
.kn-view{position:absolute;inset:0;z-index:1;touch-action:none;cursor:grab;outline:none;user-select:none;-webkit-user-select:none}
.kn-view.is-drag{cursor:grabbing}
.kn-view:focus-visible{box-shadow:inset 0 0 0 4px var(--kn-blue)}
.kn-it{position:absolute;left:0;top:0;transform-origin:50% 50%;visibility:hidden;opacity:0}
.kn-ready .kn-it{opacity:1;transition:opacity .9s ease}
.kn-decor{pointer-events:none}
.kn-decor--crumb{filter:drop-shadow(0 8px 6px rgba(40,20,10,.35))}
.kn-title{pointer-events:none}
.kn-h1{width:100%;height:100%;font-size:0;line-height:0}
.kn-card{appearance:none;-webkit-appearance:none;display:block;width:100%;height:100%;border:0;padding:0;text-align:left;cursor:pointer;background:var(--kn-paper);border-radius:6px;overflow:hidden;position:relative;box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 22px 34px -16px rgba(60,30,15,.5),0 3px 7px rgba(60,30,15,.28);transition:box-shadow .3s}
.kn-card:hover{box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 30px 44px -16px rgba(60,30,15,.6),0 3px 7px rgba(60,30,15,.3)}
.kn-card:focus-visible{outline:5px solid var(--kn-blue);outline-offset:6px}
.kn-card.is-open{outline:4px solid var(--kn-terra);outline-offset:5px}
.kn-art{display:block;width:100%;aspect-ratio:300/260;overflow:hidden}
.kn-art svg{width:100%;height:100%;transition:transform .8s cubic-bezier(.2,.8,.2,1)}
.kn-card:hover .kn-art svg{transform:scale(1.05)}
.kn-cap{display:block;padding:14px 16px 16px}
.kn-k{display:block;font-family:var(--kn-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--kn-ash)}
.kn-t{display:block;font-family:var(--kn-serif);font-weight:500;font-size:24px;line-height:1.1;letter-spacing:-.015em;margin-top:6px}
.kn-more{display:block;margin-top:10px;font-size:13px;color:var(--kn-terra-d);font-weight:600}
.kn-card--map .kn-art{aspect-ratio:380/280}
.kn-card--map .kn-art svg{width:100%;height:100%}
.kn-card--sketch .kn-art{aspect-ratio:280/220}
.kn-card--sketch .kn-t,.kn-card--map .kn-t{font-size:20px}
.kn-card--sketch{background:#F3ECDD}
.kn-card--note{background:#F3E7B8;border-radius:2px;padding:0;transform:none}
.kn-card--note::before{content:"";position:absolute;top:-4px;left:50%;width:70px;height:20px;margin-left:-35px;background:rgba(201,143,79,.55);transform:rotate(-3deg)}
.kn-card--note .kn-cap{display:none}
.kn-note-body{display:block;padding:24px 16px 0;font-family:var(--kn-hand);font-size:19px;line-height:1.3;color:#3a312c}
.kn-note-body span{display:block}.kn-note-h{font-size:24px;font-weight:700;color:var(--kn-terra-d);margin-bottom:4px}
.kn-card--about{background:var(--kn-char);color:var(--kn-bone)}
.kn-card--about .kn-k{color:#E6A47F}.kn-card--about .kn-t{color:var(--kn-bone)}
.kn-about-body span{display:block}
.kn-about-body{display:block;padding:22px 18px 0;font-family:var(--kn-serif);font-size:30px;line-height:1.05;letter-spacing:-.02em}
.kn-about-body span:nth-child(2){color:#E6A47F;font-style:italic}

/* ---- HUD ---- */
.kn-top{position:absolute;z-index:20;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-start;padding:16px 20px;pointer-events:none}
.kn-top>*{pointer-events:auto}
.kn-brand{display:flex;flex-direction:column;line-height:1.1}
.kn-brand-n{font-family:var(--kn-serif);font-weight:800;font-size:28px;letter-spacing:-.03em}
.kn-brand-s{font-family:var(--kn-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--kn-ash);margin-top:2px}
.kn-top-r{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.kn-btn{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border-radius:999px;border:1.5px solid var(--kn-char);background:transparent;color:var(--kn-char);font-family:var(--kn-sans);font-size:14px;font-weight:600;text-decoration:none;cursor:pointer;transition:background .2s,color .2s,transform .2s}
.kn-btn:hover{background:var(--kn-char);color:var(--kn-bone)}
.kn-btn:focus-visible{outline:3px solid var(--kn-blue);outline-offset:3px}
.kn-btn--ghost{background:rgba(246,239,224,.85);backdrop-filter:blur(6px)}
.kn-btn--solid{background:var(--kn-char);color:var(--kn-bone)}
.kn-btn--solid:hover{background:var(--kn-terra-d);border-color:var(--kn-terra-d)}
.kn-btn--round{width:44px;padding:0;font-size:22px;background:rgba(246,239,224,.9)}
.kn-btn--lg{min-height:52px;padding:0 28px;font-size:16px}
.kn-ctl{position:absolute;z-index:20;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:8px;align-items:center}
.kn-ret{opacity:.62}.kn-ret.is-on{opacity:1;background:var(--kn-terra);border-color:var(--kn-terra);color:#fff}
.kn-ret.is-on:hover{background:var(--kn-terra-d)}
.kn-hint{position:absolute;z-index:20;left:0;right:0;bottom:76px;text-align:center;font-family:var(--kn-mono);font-size:12px;letter-spacing:.06em;color:var(--kn-char);padding:0 24px;pointer-events:none;transition:opacity .8s}
.kn-hint.is-off{opacity:0}
.kn-mm{position:absolute;z-index:20;left:18px;bottom:18px;width:176px}
.kn-mm-box{position:relative;width:176px;height:111px;background:rgba(246,239,224,.92);border:1.5px solid var(--kn-char);border-radius:6px;overflow:hidden;cursor:crosshair;touch-action:none}
.kn-mm-dot{position:absolute;display:block;opacity:.85;border-radius:1px}
.kn-mm-vp{position:absolute;display:block;border:2px solid var(--kn-blue);background:rgba(63,111,134,.14);pointer-events:none}
.kn-mm-l{position:absolute;left:8px;top:-20px;font-family:var(--kn-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--kn-ash)}

/* ---- panel ---- */
.kn-panel{position:absolute;z-index:30;top:0;right:0;bottom:0;width:min(480px,46%);background:var(--kn-paper);background-image:var(--kn-grain);box-shadow:-30px 0 60px -24px rgba(40,20,10,.5);overflow:auto;overscroll-behavior:contain;transform:translateX(104%);visibility:hidden;transition:transform .7s cubic-bezier(.2,.8,.2,1),visibility 0s .7s}
.kn-panel.is-on{transform:none;visibility:visible;transition:transform .7s cubic-bezier(.2,.8,.2,1),visibility 0s}
.kn-panel--fixed{position:fixed}
.kn-scrim{position:fixed;inset:0;right:min(480px,46%);border:0;background:rgba(38,33,31,.35);cursor:default}
.kn-p-in{position:relative;padding:28px 28px 40px;min-height:100%}
.kn-p-in .kn-k{margin-bottom:8px}
.kn-p-h{font-family:var(--kn-serif);font-weight:500;font-size:clamp(30px,3.4vw,44px);line-height:1.04;letter-spacing:-.025em;padding-right:48px;outline:none}
.kn-x{position:absolute;top:18px;right:18px;width:44px;height:44px;border-radius:50%;border:1.5px solid var(--kn-char);background:var(--kn-paper);font-size:26px;line-height:1;cursor:pointer}
.kn-x:hover{background:var(--kn-char);color:var(--kn-bone)}.kn-x:focus-visible{outline:3px solid var(--kn-blue);outline-offset:3px}
.kn-p-art{margin:22px 0;border-radius:6px;overflow:hidden;box-shadow:0 14px 30px -14px rgba(60,30,15,.5);animation:knGrow .8s cubic-bezier(.2,.8,.2,1) both}
.kn-p-art svg{width:100%;height:auto;aspect-ratio:300/260}
.kn-p-art--map svg{aspect-ratio:380/280}.kn-p-art--sketch svg{aspect-ratio:280/220}
.kn-p-note,.kn-p-about{padding:28px 22px}
.kn-p-note{background:#F3E7B8}.kn-p-note .kn-note-body{padding:0;font-size:24px}.kn-p-note .kn-note-h{font-size:30px}
.kn-p-about{background:var(--kn-char);color:var(--kn-bone)}.kn-p-about .kn-about-body{padding:0;font-size:44px}.kn-p-about .kn-about-body span:nth-child(2){color:#E6A47F;font-style:italic}
@keyframes knGrow{from{clip-path:inset(14% 26% 14% 26% round 10px);opacity:.2}to{clip-path:inset(0 0 0 0 round 6px);opacity:1}}
.kn-p-lead{font-family:var(--kn-serif);font-size:20px;line-height:1.5;letter-spacing:-.005em}
.kn-p-h3{font-family:var(--kn-mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--kn-terra-d);margin:28px 0 12px}
.kn-specs{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}
.kn-specs>div{padding:10px 0;border-top:1px solid rgba(38,33,31,.16)}
.kn-specs dt{font-family:var(--kn-mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--kn-ash)}
.kn-specs dd{font-size:15px;margin-top:2px}
.kn-steps{counter-reset:s}
.kn-steps li{counter-increment:s;position:relative;padding:12px 0 12px 40px;border-top:1px solid rgba(38,33,31,.16);font-size:15.5px;line-height:1.55}
.kn-steps li::before{content:counter(s);position:absolute;left:0;top:11px;width:26px;height:26px;border-radius:50%;background:var(--kn-terra);color:#fff;font-family:var(--kn-mono);font-size:12px;display:grid;place-items:center}
.kn-p-nav{display:flex;gap:8px;margin-top:32px;flex-wrap:wrap}

/* ---- list view ---- */
.kn-list{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:112px 24px 0}
.kn-lh1{font-family:var(--kn-serif);font-weight:800;font-size:clamp(88px,20vw,240px);line-height:.85;letter-spacing:-.05em;color:var(--kn-terra-d)}
.kn-lh1 span{color:var(--kn-char)}
.kn-llede{max-width:38em;margin-top:24px;font-size:19px;line-height:1.6}
.kn-lgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:28px;margin-top:48px}
.kn-lcell{position:relative}
.kn-lcell .kn-card{height:auto;min-height:100%}
.kn-lcell .kn-card--note{min-height:210px}
.kn-lcell .kn-card--about{min-height:210px}

/* ---- marquee ---- */
.kn-marq{overflow:hidden;background:var(--kn-char);color:var(--kn-bone);border-top:1px solid #000;padding:16px 0}
.kn-marq-track{display:flex;width:max-content;animation:knMarq 38s linear infinite}
.kn-marq-track span{display:flex}
.kn-marq b{font-family:var(--kn-serif);font-weight:500;font-style:italic;font-size:28px;white-space:nowrap;display:flex;align-items:center}
.kn-marq i{font-style:normal;color:var(--kn-terra);font-size:12px;margin:0 28px}
@keyframes knMarq{to{transform:translateX(-50%)}}

/* ---- tall scrub sections ---- */
.kn-tall{position:relative}
.kn-sticky{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;display:flex;flex-direction:column;justify-content:center}
.kn-man{background:var(--kn-bone);background-image:var(--kn-grain)}
.kn-man .kn-sticky{padding:0 clamp(24px,8vw,140px)}
.kn-man-t{font-family:var(--kn-serif);font-weight:500;font-size:clamp(28px,4.6vw,68px);line-height:1.14;letter-spacing:-.025em;max-width:19em}
.kn-w{opacity:clamp(.14,calc((var(--p,0) * (var(--n) + 6) - var(--i)) * .5),1);transition:none}
.kn-w--em{color:var(--kn-terra);font-style:italic}
.kn-throw{background:#DCCDB0;background-image:var(--kn-grain)}
.kn-throw-in{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:32px;align-items:center;padding:0 clamp(24px,6vw,100px)}
.kn-throw-svg{width:100%;max-height:78vh;height:auto}
.kn-tsteps{margin:28px 0 22px}
.kn-tsteps li{display:flex;gap:16px;align-items:baseline;font-family:var(--kn-serif);font-size:26px;letter-spacing:-.01em;padding:8px 0;border-top:1px solid rgba(38,33,31,.2);color:rgba(38,33,31,.4);transition:color .3s,padding .3s}
.kn-tsteps li span{font-family:var(--kn-mono);font-size:12px;letter-spacing:.1em}
.kn-tsteps li.is-on{color:var(--kn-char);padding-left:12px}.kn-tsteps li.is-on span{color:var(--kn-terra)}
.kn-fire{background:#1d1816}
.kn-fire-in{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,7fr);gap:40px;align-items:center;padding:0 clamp(24px,6vw,100px);color:var(--kn-bone)}
.kn-peep{margin-top:36px}
.kn-peep-ring{width:min(240px,30vh);aspect-ratio:1;border-radius:50%;padding:14px;background:linear-gradient(145deg,#5a4f48,#2a2321);box-shadow:inset 0 2px 4px rgba(255,255,255,.2),0 16px 30px rgba(0,0,0,.5)}
.kn-peep-glow{width:100%;height:100%;border-radius:50%;background:#2a1d19}
.kn-read{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:14px;flex-wrap:wrap}
.kn-big{font-family:var(--kn-serif);font-weight:500;font-size:clamp(56px,8vw,112px);line-height:.9;letter-spacing:-.04em;display:block;font-variant-numeric:tabular-nums}
.kn-big small{font-size:.4em;margin-left:6px;color:#E6A47F}
.kn-read>div:last-child{max-width:20em}
.kn-stage-n{display:block;font-family:var(--kn-serif);font-size:24px;font-weight:500;color:#E6A47F}
.kn-stage-d{display:block;font-size:15px;line-height:1.5;color:#d6c9b5;margin-top:4px}
.kn-chart{width:100%;height:auto}

/* ---- glazes / commission / footer ---- */
.kn-sec{padding:clamp(72px,10vw,140px) 0}
.kn-glz{background:var(--kn-bone2);background-image:var(--kn-grain)}
.kn-glz-g{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:clamp(32px,5vw,80px);align-items:center}
.kn-gl-list{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:28px}
.kn-gl-b{appearance:none;display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 14px 6px 8px;border-radius:10px;border:1.5px solid rgba(38,33,31,.25);background:rgba(246,239,224,.6);text-align:left;cursor:pointer;font-size:15px;font-weight:600;transition:background .2s,border-color .2s,transform .2s}
.kn-gl-b:hover{border-color:var(--kn-char)}
.kn-gl-b.is-on{background:var(--kn-char);color:var(--kn-bone);border-color:var(--kn-char)}
.kn-gl-b:focus-visible{outline:3px solid var(--kn-blue);outline-offset:3px}
.kn-sw{width:38px;height:38px;border-radius:50%;flex:none;box-shadow:inset 0 0 0 2px rgba(255,255,255,.3),inset -4px -6px 10px rgba(0,0,0,.28)}
.kn-gl-stage{background:var(--kn-paper);border-radius:10px;overflow:hidden;box-shadow:0 30px 50px -24px rgba(60,30,15,.55)}
.kn-gl-svg{width:100%;height:auto;aspect-ratio:300/260;animation:knFade .6s ease both}
@keyframes knFade{from{opacity:.2;transform:scale(.98)}to{opacity:1;transform:none}}
.kn-gl-info{padding:20px 24px 26px}
.kn-gl-info h3{font-family:var(--kn-serif);font-weight:500;font-size:32px;letter-spacing:-.02em;line-height:1.1}
.kn-gl-info p{margin-top:6px;font-size:16px}
.kn-gl-info .kn-mono{margin-top:8px}
.kn-recipe{font-family:var(--kn-mono);font-size:12.5px!important;line-height:1.6;color:var(--kn-ash);border-top:1px dashed rgba(38,33,31,.3);padding-top:12px;margin-top:14px!important}
.kn-com{background:var(--kn-paper);background-image:var(--kn-grain)}
.kn-com-g{display:grid;grid-template-columns:minmax(0,6fr) minmax(0,5fr);gap:clamp(32px,6vw,96px);align-items:start}
.kn-lead{margin-top:32px}
.kn-lead li{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid rgba(38,33,31,.2);font-size:17px}
.kn-lead li:last-child{border-bottom:1px solid rgba(38,33,31,.2)}
.kn-lead span{font-family:var(--kn-mono);font-size:13px;color:var(--kn-ash)}
.kn-form{background:var(--kn-bone);border:1.5px solid var(--kn-char);border-radius:10px;padding:clamp(20px,3vw,34px);display:grid;gap:18px;box-shadow:10px 10px 0 var(--kn-terra)}
.kn-form label{display:grid;gap:6px;font-family:var(--kn-mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--kn-ash)}
.kn-form input,.kn-form select,.kn-form textarea{width:100%;border:1.5px solid rgba(38,33,31,.4);border-radius:6px;background:#FBF6EA;padding:12px 14px;font-family:var(--kn-sans);font-size:16px;letter-spacing:0;text-transform:none;color:var(--kn-char);min-height:46px}
.kn-form input:focus-visible,.kn-form select:focus-visible,.kn-form textarea:focus-visible{outline:3px solid var(--kn-blue);outline-offset:1px;border-color:var(--kn-blue)}
.kn-sent h3{font-family:var(--kn-serif);font-weight:500;font-size:40px;letter-spacing:-.02em}
.kn-sent p{margin:10px 0 20px;font-size:17px}
.kn-foot{background:var(--kn-char);color:var(--kn-bone);padding:72px 0 28px;overflow:hidden}
.kn-foot-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px}
.kn-foot h3{font-family:var(--kn-mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#E6A47F;margin-bottom:12px}
.kn-foot p{font-size:16px;line-height:1.7}
.kn-foot a{text-underline-offset:3px}
.kn-foot a:focus-visible{outline:3px solid var(--kn-blue-l);outline-offset:3px}
.kn-word{font-family:var(--kn-serif);font-weight:800;font-size:clamp(140px,32vw,460px);line-height:.8;letter-spacing:-.05em;text-align:center;margin-top:56px;color:transparent;background:radial-gradient(circle at 22% 30%,rgba(38,20,12,.5) 1.2px,transparent 1.8px) 0 0/16px 16px,radial-gradient(circle at 70% 60%,rgba(255,230,200,.3) 1px,transparent 1.5px) 0 0/22px 22px,linear-gradient(180deg,#C4694A,#8F3F28);-webkit-background-clip:text;background-clip:text;padding-bottom:.08em}
.kn-fine{text-align:center;font-family:var(--kn-mono);font-size:12px;letter-spacing:.08em;color:#b9ad9c;margin-top:8px}

/* ---- reveal ---- */
.kn-rv{opacity:0;transform:translateY(32px);transition:opacity .9s ease,transform .9s cubic-bezier(.2,.8,.2,1)}
.kn-rv.is-in{opacity:1;transform:none}

/* ---- responsive ---- */
@media (max-width:900px){
  .kn-throw-in,.kn-fire-in{grid-template-columns:1fr;gap:12px;align-content:center}
  .kn-throw-svg{max-height:42vh}
  .kn-throw-l .kn-body,.kn-tsteps{display:none}
  .kn-glz-g,.kn-com-g{grid-template-columns:1fr}
  .kn-peep{display:none}
  .kn-fire-l .kn-h2{font-size:34px}
  .kn-foot-g{grid-template-columns:1fr}
}
@media (max-width:720px){
  .kn-panel{top:auto;left:0;right:0;width:100%;height:56%;border-radius:18px 18px 0 0;transform:translateY(104%)}
  .kn-panel.is-on{transform:none}
  .kn-panel--fixed{height:82%}
  .kn-scrim{right:0}
  .kn-p-in{padding:22px 20px 32px}
  .kn-mm{left:12px;bottom:12px;width:118px}
  .kn-mm-box{width:118px;height:75px}
  .kn-mm-l{display:none}
  .kn-ctl{left:auto;right:12px;bottom:12px;transform:none;flex-direction:column;align-items:flex-end}
  .kn-ret{min-height:44px}
  .kn-hint{display:none}
  .kn-top{padding:12px}
  .kn-brand-s{display:none}
  .kn-top-r .kn-btn{padding:0 14px;font-size:13px}
  .kn-stage:has(.kn-panel.is-on) .kn-mm,.kn-stage:has(.kn-panel.is-on) .kn-ctl,.kn-stage:has(.kn-panel.is-on) .kn-hint{visibility:hidden}
  .kn-specs{grid-template-columns:1fr}
  .kn-gl-list{grid-template-columns:1fr 1fr}
  .kn-list{padding-top:92px}
  .kn-man-t{font-size:clamp(26px,7.4vw,40px)}
}
@media (prefers-reduced-motion:reduce){
  .kn-marq-track{animation:none}
  .kn-rv{opacity:1;transform:none;transition:none}
  .kn-p-art,.kn-gl-svg{animation:none}
  .kn-panel,.kn-panel.is-on{transition:none}
  .kn-ready .kn-it{transition:none}
  .kn-tall{height:auto!important}
  .kn-sticky{position:relative;height:auto;min-height:100vh;padding-top:80px;padding-bottom:80px}
  .kn-w{opacity:1}
}
`;
