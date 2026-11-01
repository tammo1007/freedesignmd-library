/**
 * Orbit — SaaS / developer-platform launch page, laid out as an orbital system.
 *
 * Cosmic Technical Dark: deep navy, electric cyan, warm white. No images, no
 * web fonts, no network — the star field is a canvas, the planets are CSS
 * spheres, every diagram is inline SVG.
 *
 * Motion
 *  - Hero: a pinned planetary system. Five orbits each hold a product feature;
 *    scrolling flies the camera inward (log-interpolated zoom, a streaming
 *    star field, outer rings falling off-screen) until the core fills the view.
 *  - Anatomy: a sticky ring diagram follows the feature you are reading.
 *  - Telemetry: a terminal types a deploy, counters + sparklines draw in.
 *  - Integrations: two counter-rotating rings of tools; scroll adds spin.
 *  - Pricing: plans as concentric rings whose arcs fill to their quota.
 *  - Changelog: a pinned spiral draws inward through time as you scroll.
 *
 * Reduced motion: no pinning, no rotation, no typing — a complete static
 * composition (system at rest, spiral fully drawn, all changelog entries).
 * SSR-safe: no window/document access during render.
 */
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
const sv = (o: Record<string, string | number>) => o as CSSProperties;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => t * t * (3 - 2 * t);

type GlyphKey = "bolt" | "wave" | "eye" | "shield" | "layers";
const GLYPHS: Record<GlyphKey, string> = {
  bolt: "M13 2 4 14h6l-1 8 9-12h-6z",
  wave: "M2 12c2-7 4-7 6 0s4 7 6 0 4-7 6 0 1 3 2 0",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  shield: "M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z",
  layers: "M12 3 2 8l10 5 10-5zM2 13l10 5 10-5",
};
function Glyph({ k, size = 24 }: { k: GlyphKey; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPHS[k]} />
    </svg>
  );
}

/** Orbits listed outer → inner; the camera visits them in that order. */
const ORBITS: {
  name: string; short: string; r: number; speed: number; phase: number; size: number;
  glyph: GlyphKey; tint: string; tint2: string; line: string; stat: string; body: string;
  bullets: string[]; code: string;
}[] = [
  { name: "Edge Functions", short: "EDGE", r: 430, speed: 0.05, phase: 0.55, size: 50, glyph: "bolt", tint: "#7DF0FF", tint2: "#0B6C86", line: "Run code in 312 cities.", stat: "4.7 ms cold start",
    body: "Deploy TypeScript to every point of presence with one command. Requests land on the nearest node and start in under five milliseconds.",
    bullets: ["312 points of presence, 14 core regions", "Streaming responses and WebSockets", "Region pinning for data residency"],
    code: "export default {\n  async fetch(req, env) {\n    const geo = req.cf.city;\n    return Response.json({ hello: geo });\n  },\n};" },
  { name: "Realtime Sync", short: "SYNC", r: 330, speed: 0.08, phase: 2.35, size: 46, glyph: "wave", tint: "#BFE6FF", tint2: "#3556C8", line: "Every client, same state.", stat: "38 ms p99 fan-out",
    body: "Presence, live cursors and conflict-free documents over a single socket. Subscribe to a query and the diff arrives before the user blinks.",
    bullets: ["CRDT documents with offline merge", "Presence for 100k concurrent viewers", "Typed channels, generated from your schema"],
    code: "const room = orbit.room(\"doc:42\");\nroom.on(\"presence\", (peers) => draw(peers));\nroom.doc.text(\"body\").insert(0, \"Hello\");" },
  { name: "Observability", short: "TRACE", r: 240, speed: 0.12, phase: 4.1, size: 52, glyph: "eye", tint: "#FBF3E4", tint2: "#9C7B4A", line: "See every request, end to end.", stat: "1 trace, 0 config",
    body: "Traces, logs and metrics are correlated by default. Click a slow span and jump straight to the log line, the deploy and the commit that caused it.",
    bullets: ["Automatic distributed tracing", "30-day retention on every plan above Probe", "Alerts that open with the failing trace attached"],
    code: "$ orbit trace --slow 400ms\n▸ POST /checkout   612ms\n  ├ auth.verify        8ms\n  ├ db.query         481ms  ← orders_by_user\n  └ queue.publish     12ms" },
  { name: "Auth & Access", short: "AUTH", r: 160, speed: 0.19, phase: 1.2, size: 44, glyph: "shield", tint: "#7DF0FF", tint2: "#1F3E9E", line: "Passkeys to policy, one file.", stat: "SOC 2 Type II",
    body: "Passkeys, SSO and row-level policy declared next to your code. Roles are evaluated at the edge, so a denied request never reaches your database.",
    bullets: ["Passkeys, magic links, OIDC and SAML", "SCIM provisioning for Station and above", "Policies tested in CI with orbit policy test"],
    code: "policy(\"orders\", {\n  read:  (u, row) => row.owner === u.id,\n  write: (u) => u.role === \"admin\",\n});" },
  { name: "Queues & Cron", short: "QUEUE", r: 90, speed: 0.31, phase: 5.2, size: 40, glyph: "layers", tint: "#38E1FF", tint2: "#0A4F9E", line: "Jobs that run exactly once.", stat: "0 lost messages",
    body: "Durable queues with exactly-once delivery, retries with jitter and cron triggers that survive deploys. The innermost orbit, closest to your data.",
    bullets: ["Exactly-once delivery with idempotency keys", "Dead-letter inspector and one-click replay", "Cron with timezone and DST awareness"],
    code: "queue(\"emails\").process(async (job) => {\n  await send(job.data);\n}, { retries: 5, backoff: \"jitter\" });" },
];

/** Camera zoom keyframes. Hold windows sit at the chapter centres. */
const CH_C = (c: number) => 0.17 + c * 0.14;
const Z_KEYS: [number, number][] = (() => {
  const zs = [1, 1.3, 1.79, 2.69, 4.78, 9.5];
  const k: [number, number][] = [[0, 1]];
  zs.forEach((z, c) => { k.push([CH_C(c) - 0.035, z]); k.push([CH_C(c) + 0.035, z]); });
  k.push([1, 11]);
  return k;
})();
function zAt(p: number) {
  const k = Z_KEYS;
  if (p <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (p <= k[i][0]) {
      const [p0, z0] = k[i - 1]; const [p1, z1] = k[i];
      const u = ease((p - p0) / (p1 - p0 || 1));
      return Math.exp(Math.log(z0) + (Math.log(z1) - Math.log(z0)) * u);
    }
  }
  return k[k.length - 1][1];
}
const CHAPTERS = [
  ...ORBITS.map((o, i) => ({ k: `ORBIT 0${i + 1} / 05`, t: o.name, b: o.line + " " + o.stat + ".", g: o.glyph })),
  { k: "CORE", t: "One deploy command", b: "Everything above resolves to a single line: orbit deploy. Welcome to the centre of the system.", g: "bolt" as GlyphKey },
];

const INTEGRATIONS: { n: string; d: string; c: string; ring: 0 | 1 }[] = [
  { n: "Marrow", d: "Postgres-compatible serverless database. Branch it per pull request.", c: "#38E1FF", ring: 0 },
  { n: "Kestrel", d: "Streaming event bus. Two-way sync with Orbit queues.", c: "#BFE6FF", ring: 0 },
  { n: "Tessera", d: "Enterprise SSO directory. SAML and SCIM, ready in minutes.", c: "#FBF3E4", ring: 0 },
  { n: "Pylon", d: "Global CDN. Purge from a deploy hook.", c: "#7DF0FF", ring: 0 },
  { n: "Quill", d: "Transactional email with typed templates.", c: "#9FB4FF", ring: 0 },
  { n: "Harbor", d: "Container registry. Pull images straight into edge workers.", c: "#38E1FF", ring: 0 },
  { n: "Sable", d: "Secrets manager. Rotate keys without a redeploy.", c: "#FBF3E4", ring: 0 },
  { n: "Ledger", d: "Payments and invoicing with webhooks signed at the edge.", c: "#BFE6FF", ring: 0 },
  { n: "Northstar", d: "Product analytics streamed from request logs.", c: "#7DF0FF", ring: 1 },
  { n: "Relay", d: "Team chat alerts with the failing trace attached.", c: "#9FB4FF", ring: 1 },
  { n: "Cinder", d: "CI runner. Preview environments per commit.", c: "#FBF3E4", ring: 1 },
  { n: "Fathom", d: "Log search with a SQL-like query language.", c: "#38E1FF", ring: 1 },
  { n: "Lattice", d: "Feature flags evaluated at the edge in microseconds.", c: "#BFE6FF", ring: 1 },
  { n: "Vellum", d: "Docs hosting with versioned API references.", c: "#7DF0FF", ring: 1 },
];

const PLANS = [
  { n: "Probe", sub: "For side projects and first light.", m: 0, a: 0, q: 22, feats: ["100k requests / month", "3 regions, community support", "1 project, 7-day logs"] },
  { n: "Satellite", sub: "For small teams shipping weekly.", m: 39, a: 31, q: 48, feats: ["5M requests / month", "14 regions, email support", "10 projects, 14-day traces"] },
  { n: "Station", sub: "For products that cannot go down.", m: 199, a: 159, q: 76, feats: ["100M requests / month", "312 PoPs, SSO and audit log", "99.95% SLA, unlimited projects"] },
  { n: "Deep Space", sub: "For regulated, planet-scale workloads.", m: -1, a: -1, q: 100, feats: ["Dedicated cells, private links", "99.99% SLA, named engineer", "SOC 2, HIPAA, regional residency"] },
];

const CHANGELOG = [
  { v: "4.2", d: "Oct 2026", t: "Perihelion", b: "Region pinning for edge functions and cold starts below five milliseconds on the new V9 isolate pool.", f: 0.04 },
  { v: "4.1", d: "Aug 2026", t: "Passkey-first auth", b: "Passkeys become the default sign-in. SCIM provisioning ships for Station and above.", f: 0.17 },
  { v: "4.0", d: "Jun 2026", t: "Event horizon", b: "A rewritten scheduler. Queues reach general availability with exactly-once delivery.", f: 0.3 },
  { v: "3.8", d: "Apr 2026", t: "Trace to log", b: "Spans link to log lines and deploys. Thirty-day retention becomes the default.", f: 0.43 },
  { v: "3.5", d: "Jan 2026", t: "Presence v2", b: "Rebuilt presence channel scales to 100k viewers. CRDT documents enter beta.", f: 0.55 },
  { v: "3.0", d: "Sep 2025", t: "Marrow bindings", b: "Multi-region Postgres bindings with automatic read replicas near your users.", f: 0.67 },
  { v: "2.0", d: "Mar 2025", t: "Edge runtime", b: "The edge runtime goes public in fourteen regions. The first thousand teams arrive in a week.", f: 0.8 },
  { v: "0.1", d: "Nov 2023", t: "First light", b: "A command line tool, a single region and a very long list of ideas.", f: 0.93 },
];

/* Archimedean spiral drawn newest (outside) → oldest (centre) */
const SPIRAL = (() => {
  const N = 600, turns = 2.7, th0 = turns * Math.PI * 2, r0 = 22, r1 = 352;
  const xs: number[] = [], ys: number[] = [], cum: number[] = [0];
  for (let i = 0; i <= N; i++) {
    const th = th0 * (1 - i / N);
    const r = r0 + (r1 - r0) * (th / th0);
    const a = th - 0.9;
    xs.push(r * Math.cos(a)); ys.push(r * Math.sin(a));
    if (i) cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  }
  const total = cum[N];
  const at = (f: number) => {
    const target = clamp(f) * total;
    let lo = 0, hi = N;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; if (cum[m] <= target) lo = m; else hi = m; }
    return { x: xs[lo], y: ys[lo] };
  };
  const d = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join("");
  return { d, at };
})();

/* ------------------------------------------------------------------ */
/* Small hooks / pieces                                                */
/* ------------------------------------------------------------------ */
function useInView<T extends Element>(opts?: { once?: boolean; margin?: string }) {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setOn(true); if (opts?.once !== false) io.disconnect(); } else if (opts?.once === false) setOn(false);
    }, { rootMargin: opts?.margin ?? "0px 0px -12% 0px", threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, on] as const;
}

const prefersReduced = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Count({ to, dec = 0, pre = "", suf = "" }: { to: number; dec?: number; pre?: string; suf?: string }) {
  const [ref, on] = useInView<HTMLSpanElement>();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!on) return;
    if (prefersReduced()) { setV(to); return; }
    let raf = 0; const t0 = performance.now();
    const f = (n: number) => { const u = clamp((n - t0) / 1600); setV(to * (1 - Math.pow(1 - u, 4))); if (u < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [on, to]);
  return <span ref={ref}>{pre}{(on ? v : 0).toFixed(dec)}{suf}</span>;
}

function Spark({ pts, on }: { pts: number[]; on: boolean }) {
  const w = 160, h = 44;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${(i / (pts.length - 1)) * w} ${h - 4 - p * (h - 8)}`).join("");
  return (
    <svg className={"orb-spark" + (on ? " on" : "")} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d}L${w} ${h}L0 ${h}Z`} className="orb-spark-fill" />
      <path d={d} pathLength={1} className="orb-spark-line" />
    </svg>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="orb-eyebrow"><i />{children}</div>;
}

const NOOP = (e: { preventDefault: () => void }) => e.preventDefault();

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
const NAV = [
  ["orb-top", "Launch"], ["orb-anatomy", "Anatomy"], ["orb-telemetry", "Telemetry"], ["orb-integrations", "Integrations"],
  ["orb-pricing", "Pricing"], ["orb-changelog", "Changelog"], ["orb-touchdown", "Touchdown"],
] as const;

export function Page() {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const starRef = useRef<HTMLCanvasElement>(null);
  const sysRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ringRefs = useRef<(SVGEllipseElement | null)[]>([]);
  const dashRefs = useRef<(SVGEllipseElement | null)[]>([]);
  const plRefs = useRef<(HTMLDivElement | null)[]>([]);
  const coreRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const intRef = useRef<HTMLElement | null>(null);
  const intBoxRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const chgRef = useRef<HTMLElement | null>(null);
  const cometRef = useRef<SVGGElement>(null);
  const spiralRef = useRef<SVGPathElement>(null);
  const secRefs = useRef<(HTMLElement | null)[]>([]);

  const [ch, setCh] = useState(0);
  const [feat, setFeat] = useState(0);
  const [sel, setSel] = useState(-1);
  const [plan, setPlan] = useState(1);
  const [annual, setAnnual] = useState(true);
  const [shown, setShown] = useState(31);
  const [reached, setReached] = useState(0);
  const [rail, setRail] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");

  const [pricingRef, pricingOn] = useInView<HTMLDivElement>();
  const [termRef, termOn] = useInView<HTMLDivElement>();
  const [teleRef, teleOn] = useInView<HTMLDivElement>();
  const [typed, setTyped] = useState(0);

  const TERM = [
    { c: "cmd", t: "$ orbit init acme-api --runtime edge" },
    { c: "ok", t: "✓ linked project acme-api (fra, iad, sin)" },
    { c: "cmd", t: "$ orbit deploy" },
    { c: "dim", t: "▸ bundling 38 modules ............ 412 ms" },
    { c: "dim", t: "▸ shipping to 312 points of presence" },
    { c: "ok", t: "✓ live at https://acme-api.orbit.run" },
    { c: "dim", t: "  p50 11 ms · p99 38 ms · 0 errors" },
  ];
  const TERM_LEN = TERM.reduce((a, l) => a + l.t.length + 1, 0);

  /* terminal typing */
  useEffect(() => {
    if (!termOn) return;
    if (prefersReduced()) { setTyped(TERM_LEN); return; }
    let n = 0;
    const id = window.setInterval(() => { n += 2; setTyped(n); if (n >= TERM_LEN) window.clearInterval(id); }, 24);
    return () => window.clearInterval(id);
  }, [termOn, TERM_LEN]);

  /* pricing number tween */
  useEffect(() => {
    const P = PLANS[plan]; const target = P.m < 0 ? 0 : annual ? P.a : P.m;
    if (prefersReduced()) { setShown(target); return; }
    let raf = 0; const from = shown; const t0 = performance.now();
    const f = (n: number) => { const u = clamp((n - t0) / 520); setShown(Math.round(from + (target - from) * (1 - Math.pow(1 - u, 3)))); if (u < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [plan, annual]); // eslint-disable-line react-hooks/exhaustive-deps

  /* feature scrollspy */
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-feat]"));
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) setFeat(Number((e.target as HTMLElement).dataset.feat)); });
    }, { rootMargin: "-45% 0px -45% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  /* generic reveals */
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    root.classList.add("orb-js");
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-rv]"));
    if (typeof IntersectionObserver === "undefined") { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -10% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  /* master scroll / frame loop */
  useEffect(() => {
    const root = rootRef.current, hero = heroRef.current, sys = sysRef.current, svg = svgRef.current, cvs = starRef.current;
    if (!root || !hero || !sys || !svg || !cvs) return;
    const rm = prefersReduced();
    const ctx = cvs.getContext("2d");
    let vw = 0, vh = 0, S = 0, TILT = 0.34, cy = 0, dpr = 1, intW = 600;
    const ROT = (-14 * Math.PI) / 180, cosA = Math.cos(ROT), sinA = Math.sin(ROT);
    const stars = Array.from({ length: 300 }, (_, i) => {
      const a = (i * 2.399963) % (Math.PI * 2), rr = 0.05 + ((i * 7919) % 1000) / 1000 * 1.1;
      return { x: Math.cos(a) * rr, y: Math.sin(a) * rr, d: ((i * 104729) % 1000) / 1000, s: 0.5 + ((i * 31) % 10) / 9, w: (i % 5) * 1.3 };
    });
    let chCur = -1, featRail = -1, solid = false, reachedCur = -1;

    const resize = () => {
      vw = window.innerWidth; vh = window.innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
      S = Math.min(vw * 0.98, 1500);
      TILT = vw < 700 ? 0.52 : 0.34;
      cy = vw < 700 ? vh * 0.63 : vh * 0.58;
      cvs.width = Math.round(vw * dpr); cvs.height = Math.round(vh * dpr);
      sys.style.top = cy + "px";
      svg.style.width = S + "px"; svg.style.height = S + "px";
      ORBITS.forEach((o, i) => {
        [ringRefs.current[i], dashRefs.current[i]].forEach((el) => el && el.setAttribute("ry", String(o.r * TILT)));
      });
      if (intBoxRef.current) intW = intBoxRef.current.clientWidth;
    };

    const drawStars = (p: number, t: number) => {
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      const cx = vw / 2, spread = Math.max(vw, vh) * 0.5;
      for (const s of stars) {
        let zz = (s.d - p * 2.4 - t * 0.004) % 1; if (zz < 0) zz += 1;
        zz = zz * 0.95 + 0.05;
        const x = cx + (s.x * spread) / (zz * 1.6), y = cy + (s.y * spread) / (zz * 1.6);
        if (x < -4 || x > vw + 4 || y < -4 || y > vh + 4) continue;
        const k = 1 - zz, tw = 0.75 + 0.25 * Math.sin(t * 1.4 + s.w);
        ctx.globalAlpha = clamp(0.25 + k * 0.9) * tw;
        ctx.fillStyle = s.d > 0.8 ? "#FBF3E4" : s.d > 0.4 ? "#BFE6FF" : "#7DF0FF";
        const sz = s.s * (0.6 + k * 1.6);
        ctx.fillRect(x, y, sz, sz);
      }
      ctx.globalAlpha = 1;
    };

    const renderHero = (p: number, t: number) => {
      const z = zAt(p), s = S / 1000;
      svg.style.transform = `translate(-50%,-50%) scale(${z})`;
      const cc = clamp(Math.round((p - 0.17) / 0.14), 0, 5);
      if (cc !== chCur) { chCur = cc; setCh(cc); }
      ORBITS.forEach((o, i) => {
        const rx = o.r * s * z;
        const fade = clamp(1 - (rx - vw * 0.62) / (vw * 0.4));
        const ring = ringRefs.current[i], dash = dashRefs.current[i];
        if (ring) ring.style.opacity = String(fade * (i === cc ? 1 : 0.42));
        if (dash) dash.style.opacity = String(fade * (i === cc ? 0.9 : 0.25));
        const el = plRefs.current[i]; if (!el) return;
        const th = o.phase + t * o.speed;
        const ux = o.r * Math.cos(th), uy = o.r * TILT * Math.sin(th);
        const x = (ux * cosA - uy * sinA) * s * z, y = (ux * sinA + uy * cosA) * s * z;
        const depth = Math.sin(th);
        const ps = Math.min(1.55, Math.pow(z, 0.32)) * (0.62 + 0.38 * (depth + 1) / 2) * (vw < 700 ? 0.8 : 1);
        const edge = clamp(1 - (Math.abs(x) - vw * 0.6) / (vw * 0.15));
        el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) scale(${ps.toFixed(3)})`;
        el.style.opacity = String(edge * (depth < 0 ? 0.62 : 1) * (i === cc || p < 0.12 ? 1 : 0.75));
        el.style.zIndex = depth > 0 ? "6" : "2";
      });
      const core = coreRef.current;
      if (core) {
        const cs = 1 + (z - 1) * 1.05;
        core.style.transform = `translate(-50%,-50%) scale(${cs.toFixed(3)})`;
        core.style.opacity = String(1 - clamp((p - 0.955) / 0.045));
      }
      if (copyRef.current) {
        copyRef.current.style.opacity = String(1 - clamp(p / 0.08));
        copyRef.current.style.transform = `translate3d(0,${(-p * 380).toFixed(1)}px,0)`;
      }
      if (hintRef.current) hintRef.current.style.opacity = String(1 - clamp(p / 0.03));
      if (hudRef.current) hudRef.current.textContent = z.toFixed(2) + "×";
      if (barRef.current) barRef.current.style.transform = `scaleY(${p.toFixed(3)})`;
      drawStars(p, t);
    };

    const renderInt = (t: number, sy: number) => {
      const box = intBoxRef.current; if (!box) return;
      const outer = INTEGRATIONS.filter((n) => n.ring === 0).length, inner = INTEGRATIONS.length - outer;
      let io = 0, ii = 0;
      INTEGRATIONS.forEach((n, i) => {
        const el = nodeRefs.current[i]; if (!el) return;
        const isOuter = n.ring === 0;
        const idx = isOuter ? io++ : ii++;
        const cnt = isOuter ? outer : inner;
        const R = intW * (isOuter ? 0.42 : 0.25);
        const dir = isOuter ? 1 : -1;
        const a = (idx / cnt) * Math.PI * 2 + dir * (t * 0.045 + sy * 0.00045) + (isOuter ? 0 : 0.5);
        el.style.transform = `translate(-50%,-50%) translate3d(${(Math.cos(a) * R).toFixed(1)}px,${(Math.sin(a) * R).toFixed(1)}px,0)`;
      });
    };

    const renderSpiral = (p: number) => {
      const draw = clamp(p * 1.12 - 0.02);
      if (spiralRef.current) spiralRef.current.style.strokeDashoffset = String(1 - draw);
      const head = SPIRAL.at(draw);
      if (cometRef.current) cometRef.current.setAttribute("transform", `translate(${head.x.toFixed(1)} ${head.y.toFixed(1)})`);
      let r = 0; CHANGELOG.forEach((c, i) => { if (draw >= c.f) r = i; });
      if (r !== reachedCur) { reachedCur = r; setReached(r); }
    };

    const rect = (el: HTMLElement) => el.getBoundingClientRect();
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const sy = window.scrollY;
      const hr = rect(hero);
      if (hr.bottom > -50 && hr.top < vh) renderHero(clamp(-hr.top / (hr.height - vh)), t);
      const ir = intRef.current && rect(intRef.current);
      if (ir && ir.bottom > -100 && ir.top < vh + 100) renderInt(t, sy);
      const cr = chgRef.current && rect(chgRef.current);
      if (cr && cr.bottom > -50 && cr.top < vh) renderSpiral(clamp(-cr.top / (cr.height - vh)));
      const sol = sy > vh * 0.4; if (sol !== solid) { solid = sol; setNavSolid(sol); }
      let act = 0; secRefs.current.forEach((el, i) => { if (el && rect(el).top <= vh * 0.5) act = i; });
      if (act !== featRail) { featRail = act; setRail(act); }
      raf = requestAnimationFrame(frame);
    };

    let raf = 0; const t0 = performance.now();
    resize();
    if (rm) {
      renderHero(0, 3); renderInt(2, 0); renderSpiral(1);
      const onR = () => { resize(); renderHero(0, 3); renderInt(2, 0); };
      window.addEventListener("resize", onR);
      return () => window.removeEventListener("resize", onR);
    }
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const go = (id: string) => (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const el = document.getElementById(id); if (!el) return;
    el.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });
  };

  const P = PLANS[plan];
  const price = P.m < 0 ? "Custom" : "$" + shown;
  const activeInt = sel >= 0 ? INTEGRATIONS[sel] : null;
  const termText = (() => {
    let left = typed; return TERM.map((l) => { const n = clamp(left, 0, l.t.length); left -= l.t.length + 1; return { c: l.c, t: l.t.slice(0, n) }; });
  })();
  const typingDone = typed >= TERM_LEN;

  return (
    <div ref={rootRef} className="orb" id="orb-top">
      <style>{CSS}</style>

      {/* ───────────── nav ───────────── */}
      <header className={"orb-nav" + (navSolid ? " solid" : "")}>
        <a href="#orb-top" className="orb-brand" onClick={go("orb-top")} aria-label="Orbit home">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <ellipse cx="13" cy="13" rx="11.5" ry="4.8" transform="rotate(-24 13 13)" fill="none" stroke="#38E1FF" strokeWidth="1.4" />
            <circle cx="13" cy="13" r="3.6" fill="#FBF3E4" />
            <circle cx="22" cy="8.4" r="1.9" fill="#38E1FF" />
          </svg>
          <span>Orbit</span>
        </a>
        <nav className="orb-links" aria-label="Sections">
          {NAV.slice(1, 6).map(([id, l]) => <a key={id} href={"#" + id} onClick={go(id)}>{l}</a>)}
        </nav>
        <div className="orb-nav-cta">
          <a href="#" onClick={NOOP} className="orb-link-quiet">Sign in</a>
          <a href="#orb-touchdown" onClick={go("orb-touchdown")} className="orb-btn sm">Start building</a>
        </div>
      </header>

      <nav className="orb-rail" aria-label="Depth">
        {NAV.map(([id, l], i) => (
          <a key={id} href={"#" + id} onClick={go(id)} className={i === rail ? "on" : ""} aria-label={l}><span>{l}</span><i /></a>
        ))}
      </nav>

      {/* ───────────── hero: the system ───────────── */}
      <section className="orb-hero" ref={(el) => { heroRef.current = el; secRefs.current[0] = el; }} aria-label="Orbit, the orbital platform">
        <div className="orb-stick">
          <div className="orb-nebula" aria-hidden="true" />
          <canvas ref={starRef} className="orb-stars" aria-hidden="true" />
          <div className="orb-sys" ref={sysRef} aria-hidden="true">
            <svg aria-hidden="true" focusable="false" ref={svgRef} className="orb-rings" viewBox="-500 -500 1000 1000">
              <g transform="rotate(-14)" fill="none">
                {ORBITS.map((o, i) => (
                  <g key={o.name}>
                    <ellipse ref={(el) => { ringRefs.current[i] = el; }} rx={o.r} ry={o.r * 0.34} stroke="#38E1FF" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                    <ellipse ref={(el) => { dashRefs.current[i] = el; }} rx={o.r + 7} ry={(o.r + 7) * 0.34} stroke="#BFE6FF" strokeWidth="1" strokeDasharray="2 9" vectorEffect="non-scaling-stroke" />
                  </g>
                ))}
              </g>
            </svg>
            <div className="orb-core" ref={coreRef}><i /><b /></div>
            {ORBITS.map((o, i) => (
              <div key={o.name} className="orb-pl" ref={(el) => { plRefs.current[i] = el; }}>
                <div className="orb-pl-body" style={sv({ "--t1": o.tint, "--t2": o.tint2, width: o.size, height: o.size })}>
                  {i === 2 && <em className="orb-pl-ring" />}
                  <Glyph k={o.glyph} size={o.size * 0.46} />
                </div>
                <span className="orb-pl-tag" style={{ marginTop: o.size / 2 + 6 }}>{o.short}</span>
              </div>
            ))}
          </div>

          <div className="orb-copy" ref={copyRef}>
            <div className="orb-pill"><i /> Orbit 4.2 is live · sub-5 ms cold starts</div>
            <h1>Ship at <span>orbital</span> velocity.</h1>
            <p>The developer platform where edge compute, realtime, auth and queues share one orbit. Deploy once, land everywhere.</p>
            <div className="orb-cta">
              <a href="#orb-touchdown" onClick={go("orb-touchdown")} className="orb-btn">Start building free</a>
              <a href="#orb-anatomy" onClick={go("orb-anatomy")} className="orb-btn ghost">Explore the system</a>
            </div>
          </div>

          <div className="orb-hint" ref={hintRef}><span /> Scroll to fly inward</div>

          <div className="orb-hud">
            <div className="orb-hud-cap">
              {CHAPTERS.map((c, i) => (
                <div key={c.t} className={"orb-hud-card" + (i === ch ? " on" : "")} aria-hidden={i !== ch}>
                  <div className="k">{c.k}</div>
                  <h2><Glyph k={c.g} size={20} />{c.t}</h2>
                  <p>{c.b}</p>
                </div>
              ))}
            </div>
            <div className="orb-hud-meter" aria-hidden="true">
              <span className="lab">ZOOM</span>
              <span className="val" ref={hudRef}>1.00×</span>
              <span className="trk"><span ref={barRef} /></span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── anatomy ───────────── */}
      <section className="orb-sec orb-anat" id="orb-anatomy" ref={(el) => { secRefs.current[1] = el; }}>
        <div className="orb-wrap orb-anat-grid">
          <div className="orb-anat-side">
            <Eyebrow>Anatomy of the system</Eyebrow>
            <h2 className="orb-h2">Five orbits. <em>One gravity.</em></h2>
            <p className="orb-lede">Each capability sits in its own orbit but pulls on the same core: one config, one deploy, one bill. Scroll the system.</p>
            <svg className="orb-anat-svg" viewBox="-200 -200 400 400" role="img" aria-label={`Orbit diagram, ${ORBITS[feat].name} highlighted`}>
              <defs>
                <radialGradient id="orbg-core"><stop offset="0" stopColor="#FBF3E4" /><stop offset=".4" stopColor="#7DF0FF" /><stop offset="1" stopColor="#38E1FF" stopOpacity="0" /></radialGradient>
              </defs>
              <circle r="34" fill="url(#orbg-core)" opacity=".9" />
              {[...ORBITS].reverse().map((o, k) => {
                const i = ORBITS.length - 1 - k, r = 48 + k * 33, on = i === feat;
                return (
                  <g key={o.name} className={"orb-anat-ring" + (on ? " on" : "")} style={{ animationDuration: 26 - k * 3 + "s" }}>
                    <circle r={r} fill="none" stroke={on ? "#38E1FF" : "#7aa5d8"} strokeOpacity={on ? 1 : 0.28} strokeWidth={on ? 1.6 : 1} strokeDasharray={on ? "none" : "3 6"} />
                    <circle cx={r} cy="0" r={on ? 7 : 4} fill={on ? "#FBF3E4" : "#8CA2C6"} />
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="orb-anat-list">
            {ORBITS.map((o, i) => (
              <article key={o.name} data-feat={i} data-rv className={"orb-feat" + (i === feat ? " on" : "")}>
                <div className="orb-feat-k"><Glyph k={o.glyph} size={18} /> ORBIT 0{i + 1} · {o.stat}</div>
                <h3>{o.name}</h3>
                <p>{o.body}</p>
                <ul>{o.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                <pre className="orb-code" aria-label={o.name + " example"}><code>{o.code}</code></pre>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── telemetry ───────────── */}
      <section className="orb-sec orb-tele" id="orb-telemetry" ref={(el) => { secRefs.current[2] = el; }}>
        <div className="orb-wrap">
          <div className="orb-tele-head" data-rv>
            <Eyebrow>Launch sequence</Eyebrow>
            <h2 className="orb-h2">T-minus <em>one command.</em></h2>
          </div>
          <div className="orb-tele-grid">
            <div className="orb-term" ref={termRef} data-rv>
              <div className="orb-term-bar"><i /><i /><i /><span>~/acme-api — orbit</span></div>
              <div className="orb-term-body" aria-label="Terminal session deploying to Orbit">
                {termText.map((l, i) => (
                  <div key={i} className={"ln " + l.c}>{l.t || " "}{!typingDone && l.t.length > 0 && l.t.length < TERM[i].t.length && <b className="orb-caret" />}</div>
                ))}
                {typingDone && <div className="ln cmd">$ <b className="orb-caret" /></div>}
              </div>
            </div>
            <div className="orb-stats" ref={teleRef}>
              {[
                { l: "Global p99 latency", to: 38, suf: " ms", dec: 0, pts: [0.7, 0.62, 0.66, 0.5, 0.44, 0.48, 0.36, 0.3, 0.28, 0.22] },
                { l: "Points of presence", to: 312, suf: "", dec: 0, pts: [0.1, 0.14, 0.2, 0.3, 0.38, 0.5, 0.62, 0.74, 0.86, 0.95] },
                { l: "Uptime, trailing 12 months", to: 99.995, suf: "%", dec: 3, pts: [0.8, 0.84, 0.82, 0.88, 0.9, 0.9, 0.94, 0.95, 0.96, 0.97] },
                { l: "Requests served per day", to: 2.1, suf: "B", dec: 1, pts: [0.15, 0.2, 0.28, 0.3, 0.42, 0.52, 0.6, 0.7, 0.83, 0.92] },
              ].map((s, i) => (
                <div key={s.l} className="orb-stat" data-rv style={sv({ "--d": i * 0.08 + "s" })}>
                  <div className="orb-stat-l">{s.l}</div>
                  <div className="orb-stat-v"><Count to={s.to} dec={s.dec} suf={s.suf} /></div>
                  <Spark pts={s.pts} on={teleOn} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── integrations ring ───────────── */}
      <section className="orb-sec orb-int" id="orb-integrations" ref={(el) => { intRef.current = el; secRefs.current[3] = el; }}>
        <div className="orb-wrap orb-center">
          <div data-rv>
            <Eyebrow>Integrations</Eyebrow>
            <h2 className="orb-h2">Plays well with <em>everything in range.</em></h2>
          </div>
        </div>
        <div className="orb-ring-box" ref={intBoxRef}>
          <svg className="orb-ring-svg" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#38E1FF" strokeOpacity=".28" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx="50" cy="50" r="25" fill="none" stroke="#BFE6FF" strokeOpacity=".22" strokeWidth="1" strokeDasharray="1 4" vectorEffect="non-scaling-stroke" />
            <circle cx="50" cy="50" r="11" fill="none" stroke="#38E1FF" strokeOpacity=".18" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="orb-ring-mid" aria-live="polite">
            {activeInt ? (
              <><div className="orb-ring-n" style={{ color: activeInt.c }}>{activeInt.n}</div><p>{activeInt.d}</p></>
            ) : (
              <><div className="orb-ring-n">{INTEGRATIONS.length}+ native</div><p>Hover or focus a node. Hundreds more through webhooks and the open connector spec.</p></>
            )}
          </div>
          {INTEGRATIONS.map((n, i) => (
            <button key={n.n} type="button" className={"orb-node" + (n.ring ? " in2" : "") + (i === sel ? " on" : "")}
              ref={(el) => { nodeRefs.current[i] = el; }}
              style={sv({ "--c": n.c })}
              onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)} onMouseLeave={() => setSel(-1)} onBlur={() => setSel(-1)}
              aria-label={n.n + ": " + n.d}>
              <span>{n.n.slice(0, 1)}</span><em>{n.n}</em>
            </button>
          ))}
        </div>
      </section>

      {/* ───────────── pricing rings ───────────── */}
      <section className="orb-sec orb-price" id="orb-pricing" ref={(el) => { secRefs.current[4] = el; }}>
        <div className="orb-wrap">
          <div className="orb-tele-head" data-rv>
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="orb-h2">Pick your <em>altitude.</em></h2>
          </div>
          <div className="orb-price-grid">
            <div className={"orb-price-fig" + (pricingOn ? " on" : "")} ref={pricingRef}>
              <svg viewBox="0 0 520 520" role="img" aria-label={`Pricing rings, ${P.n} selected`}>
                <defs>
                  <filter id="orbg-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                {PLANS.map((pl, i) => {
                  const r = 72 + i * 46, on = i === plan;
                  return (
                    <g key={pl.n} className={"orb-pr" + (on ? " on" : "")} onClick={() => setPlan(i)}>
                      <circle cx="260" cy="260" r={r} className="orb-pr-track" fill="none" strokeWidth="22" />
                      <circle cx="260" cy="260" r={r} className="orb-pr-arc" fill="none" strokeWidth="22" strokeLinecap="butt" pathLength={100}
                        transform="rotate(-90 260 260)" style={sv({ "--q": pl.q })} filter={on ? "url(#orbg-glow)" : undefined} />
                      <circle cx="260" cy="260" r={r} fill="none" stroke="transparent" strokeWidth="40" style={{ cursor: "pointer" }} />
                      <text x="260" y={260 - r + 4} textAnchor="middle" className="orb-pr-lab">{pl.n.toUpperCase()}</text>
                    </g>
                  );
                })}
                <text x="260" y="256" textAnchor="middle" className="orb-pr-price">{price}</text>
                <text x="260" y="278" textAnchor="middle" className="orb-pr-per">{P.m < 0 ? "talk to us" : P.m === 0 ? "forever" : "per month" + (annual ? ", billed yearly" : "")}</text>
              </svg>
            </div>
            <div className="orb-price-info" data-rv>
              <div className="orb-seg" role="group" aria-label="Billing period">
                <button type="button" aria-pressed={!annual} className={!annual ? "on" : ""} onClick={() => setAnnual(false)}>Monthly</button>
                <button type="button" aria-pressed={annual} className={annual ? "on" : ""} onClick={() => setAnnual(true)}>Yearly <small>−20%</small></button>
              </div>
              <div className="orb-plans" role="tablist" aria-label="Plans">
                {PLANS.map((pl, i) => (
                  <button key={pl.n} type="button" role="tab" aria-selected={i === plan} className={i === plan ? "on" : ""} onClick={() => setPlan(i)}>{pl.n}</button>
                ))}
              </div>
              <div className="orb-plan-card" key={plan}>
                <h3>{P.n}</h3>
                <p className="sub">{P.sub}</p>
                <ul>{P.feats.map((f) => <li key={f}>{f}</li>)}</ul>
                <a href="#orb-touchdown" onClick={go("orb-touchdown")} className="orb-btn">{P.m < 0 ? "Talk to an engineer" : P.m === 0 ? "Launch for free" : "Start " + P.n}</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── changelog spiral ───────────── */}
      <section className="orb-chg" id="orb-changelog" ref={(el) => { chgRef.current = el; secRefs.current[5] = el; }}>
        <div className="orb-chg-stick">
          <div className="orb-chg-fig">
            <svg viewBox="-400 -400 800 800" role="img" aria-label="Spiral timeline of Orbit releases">
              <defs>
                <filter id="orbg-glow2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              <path d={SPIRAL.d} fill="none" stroke="#7aa5d8" strokeOpacity=".16" strokeWidth="1.5" strokeDasharray="2 7" />
              <path ref={spiralRef} d={SPIRAL.d} pathLength={1} fill="none" stroke="#38E1FF" strokeWidth="2.4" strokeLinecap="round" className="orb-spiral" filter="url(#orbg-glow2)" />
              {CHANGELOG.map((c, i) => {
                const pt = SPIRAL.at(c.f), on = i <= reached, cur = i === reached;
                return (
                  <g key={c.v} transform={`translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`} className={"orb-spn" + (on ? " on" : "") + (cur ? " cur" : "")}>
                    <circle r={cur ? 9 : 5.5} />
                    <text y={-15} textAnchor="middle">v{c.v}</text>
                  </g>
                );
              })}
              <g ref={cometRef} className="orb-comet"><circle r="14" fill="#38E1FF" opacity=".25" /><circle r="5" fill="#FBF3E4" /></g>
            </svg>
          </div>
          <div className="orb-chg-info">
            <Eyebrow>Changelog</Eyebrow>
            <h2 className="orb-h2">Fall back <em>through time.</em></h2>
            <div className="orb-chg-cards">
              {CHANGELOG.map((c, i) => (
                <div key={c.v} className={"orb-chg-card" + (i === reached ? " on" : "")}>
                  <div className="meta"><b>v{c.v}</b><span>{c.d}</span></div>
                  <h3>{c.t}</h3>
                  <p>{c.b}</p>
                </div>
              ))}
            </div>
            <div className="orb-chg-count" aria-hidden="true">{String(reached + 1).padStart(2, "0")} / {String(CHANGELOG.length).padStart(2, "0")}</div>
          </div>
        </div>
      </section>

      {/* ───────────── touchdown ───────────── */}
      <section className="orb-sec orb-land" id="orb-touchdown" ref={(el) => { secRefs.current[6] = el; }}>
        <div className="orb-land-sun" aria-hidden="true"><i /><i /><i /></div>
        <div className="orb-wrap orb-center">
          <div data-rv>
            <Eyebrow>Touchdown</Eyebrow>
            <h2 className="orb-h3big">Land your next <em>release.</em></h2>
            <p className="orb-lede">Free forever for side projects. No card, no countdown. The first deploy takes about ninety seconds.</p>
          </div>
          <form className="orb-form" data-rv onSubmit={(e: FormEvent) => { e.preventDefault(); if (email.includes("@")) setDone(true); }}>
            {done ? (
              <div className="orb-done" role="status"><span /> You are on the manifest. Check {email} for your launch key.</div>
            ) : (
              <>
                <label className="orb-sr" htmlFor="orb-email">Work email</label>
                <input id="orb-email" type="email" required placeholder="you@company.dev" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button type="submit" className="orb-btn">Get my launch key</button>
              </>
            )}
          </form>
        </div>
        <footer className="orb-foot">
          <div className="orb-wrap orb-foot-grid">
            <div>
              <div className="orb-brand static"><svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true"><ellipse cx="13" cy="13" rx="11.5" ry="4.8" transform="rotate(-24 13 13)" fill="none" stroke="#38E1FF" strokeWidth="1.4" /><circle cx="13" cy="13" r="3.6" fill="#FBF3E4" /></svg><span>Orbit</span></div>
              <p className="orb-foot-note">Kepler Works, Inc. Built for teams who would rather ship than configure.</p>
            </div>
            {[
              ["Platform", ["Edge Functions", "Realtime Sync", "Observability", "Auth & Access", "Queues & Cron"]],
              ["Company", ["About", "Careers", "Customers", "Press kit"]],
              ["Resources", ["Documentation", "API reference", "Status", "Security"]],
            ].map(([h, ls]) => (
              <div key={h as string}>
                <h4>{h as string}</h4>
                <ul>{(ls as string[]).map((l) => <li key={l}><a href="#" onClick={NOOP}>{l}</a></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="orb-wrap orb-legal"><span>© 2026 Kepler Works, Inc.</span><span>Privacy · Terms · DPA</span></div>
        </footer>
      </section>
    </div>
  );
}

export default Page;

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const CSS = `
.orb{--orb-bg:#040A18;--orb-bg2:#071230;--orb-panel:#0A1A3A;--orb-line:rgba(125,190,255,.16);--orb-cyan:#38E1FF;--orb-cyan2:#7DF0FF;--orb-ice:#BFE6FF;--orb-warm:#FBF3E4;--orb-mute:#8CA2C6;--orb-indigo:#5B6BFF;
--orb-sans:"Space Grotesk","Inter",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
--orb-mono:"JetBrains Mono","SF Mono",ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;
--orb-out:cubic-bezier(.22,1,.36,1);
position:relative;box-sizing:border-box;width:100%;background:var(--orb-bg);color:var(--orb-warm);font-family:var(--orb-sans);font-size:16px;line-height:1.55;font-weight:400;text-align:left;overflow-x:clip;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.orb *,.orb *::before,.orb *::after{box-sizing:border-box}
:where(.orb) :where(h1,h2,h3,h4,p,ul,li,pre,code,figure,form){margin:0;padding:0;font:inherit;letter-spacing:inherit}
:where(.orb) :where(ul){list-style:none}
:where(.orb) :where(a){color:inherit;text-decoration:none}
:where(.orb) :where(button,input){font:inherit;color:inherit;margin:0;border:0;background:none;padding:0;appearance:none;-webkit-appearance:none;border-radius:0}
:where(.orb) :where(button){cursor:pointer}
.orb :focus-visible{outline:2px solid var(--orb-cyan);outline-offset:3px;border-radius:6px}
:where(.orb) :where(svg){display:block;max-width:100%}
.orb .orb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

.orb-wrap{width:100%;max-width:1240px;margin:0 auto;padding:0 40px}
.orb-center{text-align:center}
.orb-sec{position:relative;padding:150px 0}
.orb-eyebrow{display:inline-flex;align-items:center;gap:10px;font-family:var(--orb-mono);font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--orb-cyan);margin-bottom:22px}
.orb-eyebrow i{width:26px;height:1px;background:var(--orb-cyan);box-shadow:0 0 10px var(--orb-cyan)}
.orb-h2{font-size:clamp(2.2rem,5vw,4.2rem);line-height:1.04;letter-spacing:-.035em;font-weight:600;text-wrap:balance}
.orb-h2 em,.orb-h3big em{font-style:normal;background:linear-gradient(100deg,var(--orb-cyan2),var(--orb-cyan) 45%,#8da2ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.orb-h3big{font-size:clamp(2.8rem,8vw,7rem);line-height:.98;letter-spacing:-.045em;font-weight:600;text-wrap:balance}
.orb-lede{max-width:34em;margin-top:22px;font-size:1.15rem;line-height:1.6;color:var(--orb-mute)}
.orb-center .orb-lede{margin-left:auto;margin-right:auto}

.orb-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:52px;padding:0 28px;border-radius:999px;background:var(--orb-cyan);color:#021018;font-weight:600;font-size:15px;letter-spacing:.005em;box-shadow:0 0 0 1px rgba(255,255,255,.2) inset,0 10px 40px -8px rgba(56,225,255,.6);transition:transform .35s var(--orb-out),box-shadow .35s,background .2s}
.orb-btn:hover{transform:translateY(-2px);background:var(--orb-cyan2);box-shadow:0 0 0 1px rgba(255,255,255,.3) inset,0 16px 50px -8px rgba(56,225,255,.8)}
.orb-btn.ghost{background:rgba(125,190,255,.06);color:var(--orb-warm);box-shadow:0 0 0 1px rgba(160,210,255,.28) inset}
.orb-btn.ghost:hover{background:rgba(125,190,255,.14)}
.orb-btn.sm{height:38px;padding:0 18px;font-size:14px}

/* nav */
.orb-nav{position:fixed;z-index:50;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 40px;transition:background .4s,backdrop-filter .4s,border-color .4s;border-bottom:1px solid transparent}
.orb-nav.solid{background:rgba(4,10,24,.72);backdrop-filter:blur(16px) saturate(1.4);-webkit-backdrop-filter:blur(16px) saturate(1.4);border-color:var(--orb-line)}
.orb-brand{display:inline-flex;align-items:center;gap:10px;font-weight:600;font-size:20px;letter-spacing:-.02em}
.orb-links{display:flex;gap:30px;font-size:14px;color:var(--orb-ice)}
.orb-links a{opacity:.72;transition:opacity .2s}.orb-links a:hover{opacity:1}
.orb-nav-cta{display:flex;align-items:center;gap:20px}
.orb-link-quiet{font-size:14px;color:var(--orb-ice);opacity:.8}
.orb-rail{position:fixed;z-index:40;right:22px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:14px;align-items:flex-end}
.orb-rail a{display:flex;align-items:center;gap:12px;font-family:var(--orb-mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--orb-mute)}
.orb-rail span{opacity:0;transform:translateX(6px);transition:opacity .3s,transform .3s var(--orb-out)}
.orb-rail a:hover span,.orb-rail a.on span,.orb-rail a:focus-visible span{opacity:1;transform:none}
.orb-rail i{width:7px;height:7px;border-radius:50%;border:1px solid var(--orb-mute);transition:all .3s}
.orb-rail a.on{color:var(--orb-cyan)}.orb-rail a.on i{background:var(--orb-cyan);border-color:var(--orb-cyan);box-shadow:0 0 12px var(--orb-cyan);transform:scale(1.35)}

/* hero */
.orb-hero{position:relative;height:640vh}
.orb-stick{position:sticky;top:0;height:100vh;overflow:hidden;background:radial-gradient(120% 90% at 50% 62%,#0B1D4A 0%,#06112B 42%,#030815 100%)}
.orb-nebula{position:absolute;inset:0;background:radial-gradient(40% 30% at 18% 24%,rgba(91,107,255,.22),transparent 70%),radial-gradient(34% 28% at 84% 70%,rgba(56,225,255,.16),transparent 70%),radial-gradient(26% 20% at 70% 14%,rgba(251,243,228,.06),transparent 70%)}
.orb-stars{position:absolute;inset:0;width:100%;height:100%}
.orb-sys{position:absolute;left:50%;top:58%;width:0;height:0}
.orb .orb-rings{position:absolute;left:0;top:0;transform:translate(-50%,-50%);overflow:visible;max-width:none}
.orb-core{position:absolute;left:0;top:0;width:84px;height:84px;border-radius:50%;z-index:4;transform:translate(-50%,-50%)}
.orb-core i{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 42% 38%,#fff 0%,#FBF3E4 22%,#8FF3FF 52%,#1CB7DD 82%,#0A6E9A 100%);box-shadow:0 0 30px 6px rgba(56,225,255,.45)}
.orb-core b{position:absolute;inset:-110%;border-radius:50%;background:radial-gradient(circle,rgba(125,240,255,.4),rgba(56,225,255,.12) 38%,transparent 66%);animation:orbPulse 5s ease-in-out infinite}
@keyframes orbPulse{50%{transform:scale(1.16);opacity:.7}}
.orb-pl{position:absolute;left:0;top:0;width:0;height:0;will-change:transform,opacity}
.orb-pl-body{position:absolute;left:0;top:0;transform:translate(-50%,-50%);border-radius:50%;display:grid;place-items:center;color:#021018;
background:radial-gradient(circle at 34% 28%,#fff 0,var(--t1) 28%,var(--t2) 100%);box-shadow:inset -8px -10px 18px rgba(2,8,24,.55),inset 5px 5px 10px rgba(255,255,255,.35),0 0 30px -4px var(--t1)}
.orb-pl-ring{position:absolute;left:50%;top:50%;width:190%;height:52%;border-radius:50%;border:2px solid rgba(251,243,228,.7);transform:translate(-50%,-50%) rotate(-22deg);box-shadow:0 0 14px rgba(251,243,228,.35)}
.orb-pl-tag{position:absolute;left:0;top:0;transform:translateX(-50%);white-space:nowrap;font-family:var(--orb-mono);font-size:10px;letter-spacing:.2em;color:var(--orb-ice);text-shadow:0 0 8px #040A18,0 0 3px #040A18}
.orb-copy{position:absolute;left:0;right:0;top:calc(var(--orb-navh,0px) + 12vh);padding:0 24px;text-align:center;will-change:transform,opacity;pointer-events:none;z-index:10}
.orb-copy>*{pointer-events:auto}
.orb-pill{display:inline-flex;align-items:center;gap:10px;padding:7px 16px;border-radius:999px;border:1px solid rgba(160,210,255,.25);background:rgba(10,26,58,.55);backdrop-filter:blur(8px);font-size:13px;color:var(--orb-ice)}
.orb-pill i{width:7px;height:7px;border-radius:50%;background:var(--orb-cyan);box-shadow:0 0 10px var(--orb-cyan);animation:orbBlink 2s infinite}
@keyframes orbBlink{50%{opacity:.35}}
.orb-copy h1{margin:22px auto 0;max-width:11em;font-size:clamp(2.7rem,8.4vw,7.6rem);line-height:.95;letter-spacing:-.05em;font-weight:600;text-wrap:balance;text-shadow:0 4px 60px rgba(4,10,24,.8)}
.orb-copy h1 span{background:linear-gradient(100deg,#fff,var(--orb-cyan2) 40%,var(--orb-cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
.orb-copy p{max-width:36em;margin:22px auto 0;font-size:clamp(1rem,1.5vw,1.25rem);color:var(--orb-ice);opacity:.85}
.orb-cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:32px}
.orb-hint{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;font-family:var(--orb-mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--orb-mute);white-space:nowrap}
.orb-hint span{width:1px;height:28px;background:linear-gradient(var(--orb-cyan),transparent);animation:orbDrop 2s infinite}
@keyframes orbDrop{0%{transform:scaleY(0);transform-origin:top}50%{transform:scaleY(1);transform-origin:top}51%{transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}
.orb-hud{position:absolute;left:0;right:0;bottom:0;padding:0 40px 38px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;pointer-events:none}
.orb-hud-cap{position:relative;width:min(430px,100%);height:150px}
.orb-hud-card{position:absolute;left:0;bottom:0;width:100%;padding:20px 22px;border-radius:18px;border:1px solid rgba(160,210,255,.2);background:rgba(6,16,40,.66);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);opacity:0;transform:translateY(14px);transition:opacity .5s var(--orb-out),transform .6s var(--orb-out)}
.orb-hud-card.on{opacity:1;transform:none}
.orb-hud-card .k{font-family:var(--orb-mono);font-size:11px;letter-spacing:.2em;color:var(--orb-cyan)}
.orb-hud-card h2{display:flex;align-items:center;gap:10px;margin-top:8px;font-size:1.45rem;font-weight:600;letter-spacing:-.02em}
.orb-hud-card h2 svg{color:var(--orb-cyan)}
.orb-hud-card p{margin-top:6px;font-size:.92rem;line-height:1.5;color:var(--orb-mute)}
.orb-hud-meter{display:grid;grid-template-columns:auto auto;grid-template-rows:auto 1fr;gap:4px 14px;align-items:end;font-family:var(--orb-mono);font-size:11px;letter-spacing:.14em;color:var(--orb-mute);height:96px}
.orb-hud-meter .val{font-size:22px;color:var(--orb-warm);letter-spacing:0;text-align:right;font-variant-numeric:tabular-nums}
.orb-hud-meter .trk{grid-row:1/3;grid-column:3;width:2px;height:100%;background:rgba(160,210,255,.2);position:relative;overflow:hidden}
.orb-hud-meter .trk span{position:absolute;inset:0;background:var(--orb-cyan);box-shadow:0 0 10px var(--orb-cyan);transform:scaleY(0);transform-origin:top}

/* reveals */
.orb.orb-js [data-rv]{opacity:0;transform:translate3d(0,34px,0);transition:opacity .9s var(--orb-out) var(--d,0s),transform .9s var(--orb-out) var(--d,0s)}
.orb.orb-js [data-rv].in{opacity:1;transform:none}

/* anatomy */
.orb-anat{background:linear-gradient(180deg,#030815,var(--orb-bg) 18%)}
.orb-anat-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:70px;align-items:start}
.orb-anat-side{position:sticky;top:12vh}
.orb-anat-svg{width:min(430px,100%);margin-top:36px}
.orb-anat-ring{transform-box:view-box;transform-origin:0 0;animation:orbSpin linear infinite}
.orb-anat-ring:nth-of-type(even){animation-direction:reverse}
@keyframes orbSpin{to{transform:rotate(360deg)}}
.orb-anat-ring circle{transition:stroke .5s,stroke-opacity .5s,r .5s}
.orb-anat-list{display:flex;flex-direction:column;gap:18vh;padding:10vh 0 6vh}
.orb-feat{padding:36px;border-radius:24px;border:1px solid var(--orb-line);background:linear-gradient(160deg,rgba(14,32,72,.55),rgba(7,18,48,.35));transition:border-color .5s,box-shadow .5s,background .5s}
.orb-feat.on{border-color:rgba(56,225,255,.5);box-shadow:0 0 0 1px rgba(56,225,255,.12),0 30px 80px -30px rgba(56,225,255,.35)}
.orb-feat-k{display:flex;align-items:center;gap:10px;font-family:var(--orb-mono);font-size:11px;letter-spacing:.16em;color:var(--orb-cyan)}
.orb-feat h3{margin-top:14px;font-size:clamp(1.8rem,3vw,2.6rem);line-height:1.05;letter-spacing:-.03em;font-weight:600}
.orb-feat p{margin-top:14px;color:var(--orb-mute);font-size:1.05rem}
.orb-feat ul{margin-top:20px;display:grid;gap:9px}
.orb-feat li{position:relative;padding-left:22px;color:var(--orb-ice);font-size:.98rem}
.orb-feat li::before{content:"";position:absolute;left:0;top:.62em;width:9px;height:9px;border-radius:50%;border:1.5px solid var(--orb-cyan)}
.orb-code{margin-top:24px;padding:18px 20px;border-radius:14px;background:#030a1b;border:1px solid var(--orb-line);font-family:var(--orb-mono);font-size:12.5px;line-height:1.7;color:var(--orb-ice);overflow-x:auto;white-space:pre}
.orb-code code{font:inherit}

/* telemetry */
.orb-tele{background:radial-gradient(70% 60% at 80% 20%,rgba(56,225,255,.07),transparent 70%),var(--orb-bg)}
.orb-tele-head{margin-bottom:56px}
.orb-tele-grid{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:28px}
.orb-term{border-radius:20px;overflow:hidden;border:1px solid var(--orb-line);background:#030a1b;box-shadow:0 40px 100px -40px rgba(56,225,255,.3)}
.orb-term-bar{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid var(--orb-line);font-family:var(--orb-mono);font-size:12px;color:var(--orb-mute)}
.orb-term-bar i{width:11px;height:11px;border-radius:50%;background:#1b2c52}
.orb-term-bar span{margin-left:10px}
.orb-term-body{padding:24px 24px 30px;font-family:var(--orb-mono);font-size:clamp(11.5px,1.3vw,14px);line-height:2;min-height:320px;overflow-x:auto}
.orb-term-body .ln{white-space:pre}
.orb-term-body .cmd{color:var(--orb-warm)}.orb-term-body .ok{color:var(--orb-cyan)}.orb-term-body .dim{color:var(--orb-mute)}
.orb-caret{display:inline-block;width:.6em;height:1.1em;vertical-align:-.18em;margin-left:2px;background:var(--orb-cyan);animation:orbBlink 1s steps(2) infinite}
.orb-stats{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.orb-stat{padding:22px 22px 14px;border-radius:20px;border:1px solid var(--orb-line);background:linear-gradient(160deg,rgba(14,32,72,.5),rgba(7,18,48,.3));display:flex;flex-direction:column;overflow:hidden}
.orb-stat-l{font-size:12.5px;color:var(--orb-mute);min-height:2.6em}
.orb-stat-v{margin-top:6px;font-size:clamp(1.9rem,3vw,2.7rem);font-weight:600;letter-spacing:-.04em;font-variant-numeric:tabular-nums;color:var(--orb-warm)}
.orb-spark{width:calc(100% + 44px);margin:12px -22px 0;height:44px}
.orb-spark-line{fill:none;stroke:var(--orb-cyan);stroke-width:2;vector-effect:non-scaling-stroke;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1.8s var(--orb-out) .3s}
.orb-spark-fill{fill:rgba(56,225,255,.1);opacity:0;transition:opacity 1.2s 1s}
.orb-spark.on .orb-spark-line{stroke-dashoffset:0}.orb-spark.on .orb-spark-fill{opacity:1}

/* integrations */
.orb-int{padding-bottom:120px;background:radial-gradient(60% 50% at 50% 70%,rgba(91,107,255,.14),transparent 70%),var(--orb-bg);overflow:hidden}
.orb-ring-box{position:relative;width:min(760px,calc(100vw - 20px));aspect-ratio:1;margin:30px auto 0}
.orb-ring-svg{position:absolute;inset:0;width:100%;height:100%}
.orb-ring-mid{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:30%;text-align:center}
.orb-ring-n{font-size:clamp(1rem,2.2vw,1.6rem);font-weight:600;letter-spacing:-.02em;color:var(--orb-warm)}
.orb-ring-mid p{margin-top:6px;font-size:clamp(.66rem,1.15vw,.86rem);line-height:1.4;color:var(--orb-mute)}
.orb-node{position:absolute;left:50%;top:50%;width:62px;height:62px;border-radius:18px;display:grid;place-items:center;border:1px solid rgba(160,210,255,.4);background:linear-gradient(150deg,#16346f,#0a1c48);color:var(--c);box-shadow:0 10px 30px -10px rgba(0,0,0,.7);will-change:transform;transition:border-color .3s,box-shadow .3s,background .3s}
.orb-node.in2{width:48px;height:48px;border-radius:14px}
.orb-node span{font-size:22px;font-weight:700;letter-spacing:-.04em}
.orb-node.in2 span{font-size:17px}
.orb-node em{position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);font-style:normal;font-family:var(--orb-mono);font-size:10px;letter-spacing:.08em;color:var(--orb-ice);opacity:.7;white-space:nowrap}
.orb-node:hover,.orb-node.on{border-color:var(--c);box-shadow:0 0 30px -4px var(--c);background:linear-gradient(150deg,#12307a,#0a1a44);z-index:3}

/* pricing */
.orb-price{background:linear-gradient(180deg,var(--orb-bg),#050d22 50%,var(--orb-bg))}
.orb-price-grid{display:grid;grid-template-columns:minmax(0,6fr) minmax(0,5fr);gap:60px;align-items:center}
.orb-price-fig svg{width:min(560px,100%);margin:0 auto;overflow:visible}
.orb-pr-track{stroke:rgba(125,190,255,.07)}
.orb-pr-arc{stroke:#6f93c9;stroke-opacity:.32;stroke-dasharray:0 100;transition:stroke-dasharray 1.6s var(--orb-out),stroke .4s,stroke-opacity .4s}
.orb-price-fig.on .orb-pr-arc{stroke-dasharray:var(--q) 100}
.orb-pr.on .orb-pr-arc{stroke:var(--orb-cyan);stroke-opacity:1}
.orb-pr{cursor:pointer}
.orb-pr:hover .orb-pr-arc{stroke-opacity:.8}
.orb-pr-lab{font-family:var(--orb-mono);font-size:9.5px;letter-spacing:.2em;fill:#021018;font-weight:700;pointer-events:none}
.orb-pr:not(.on) .orb-pr-lab{fill:var(--orb-ice)}
.orb-pr-price{font-size:40px;font-weight:600;letter-spacing:-.04em;fill:var(--orb-warm)}
.orb-pr-per{font-family:var(--orb-mono);font-size:10px;letter-spacing:.1em;fill:var(--orb-mute)}
.orb-seg{display:inline-flex;padding:4px;border-radius:999px;border:1px solid var(--orb-line);background:rgba(10,26,58,.5)}
.orb-seg button{height:36px;padding:0 18px;border-radius:999px;font-size:14px;color:var(--orb-mute);transition:background .3s,color .3s}
.orb-seg button.on{background:var(--orb-cyan);color:#021018;font-weight:600}
.orb-seg small{font-family:var(--orb-mono);font-size:11px;margin-left:4px}
.orb-plans{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}
.orb-plans button{height:38px;padding:0 16px;border-radius:12px;border:1px solid var(--orb-line);font-size:14px;color:var(--orb-ice);transition:all .3s}
.orb-plans button.on{border-color:var(--orb-cyan);color:var(--orb-cyan);background:rgba(56,225,255,.08)}
.orb-plan-card{padding:32px;border-radius:24px;border:1px solid rgba(56,225,255,.35);background:linear-gradient(160deg,rgba(14,32,72,.65),rgba(7,18,48,.4));animation:orbIn .6s var(--orb-out)}
@keyframes orbIn{from{opacity:0;transform:translateY(12px)}}
.orb-plan-card h3{font-size:2rem;font-weight:600;letter-spacing:-.03em}
.orb-plan-card .sub{margin-top:6px;color:var(--orb-mute)}
.orb-plan-card ul{margin:22px 0 28px;display:grid;gap:11px}
.orb-plan-card li{position:relative;padding-left:26px;color:var(--orb-ice)}
.orb-plan-card li::before{content:"";position:absolute;left:3px;top:.45em;width:6px;height:11px;border:solid var(--orb-cyan);border-width:0 2px 2px 0;transform:rotate(40deg)}

/* changelog */
.orb-chg{position:relative;height:480vh;background:radial-gradient(60% 50% at 30% 50%,rgba(56,225,255,.07),transparent 70%),var(--orb-bg)}
.orb-chg-stick{position:sticky;top:0;height:100vh;max-width:1240px;margin:0 auto;padding:80px 40px 40px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.85fr);gap:50px;align-items:center}
.orb-chg-fig svg{width:min(78vh,100%);margin:0 auto;overflow:visible}
.orb-spiral{stroke-dasharray:1;stroke-dashoffset:1}
.orb-spn circle{fill:var(--orb-bg);stroke:#4d6ea6;stroke-width:1.5;transition:all .5s}
.orb-spn text{font-family:var(--orb-mono);font-size:15px;fill:#6c85b0;paint-order:stroke;stroke:#040A18;stroke-width:5px;transition:fill .5s}
.orb-spn.on circle{stroke:var(--orb-cyan);fill:var(--orb-cyan)}.orb-spn.on text{fill:var(--orb-ice)}
.orb-spn.cur circle{fill:var(--orb-warm);stroke:var(--orb-cyan);stroke-width:3}.orb-spn.cur text{fill:var(--orb-warm);font-weight:700}
.orb-chg-cards{position:relative;display:grid;margin-top:34px}
.orb-chg-card{grid-area:1/1;padding:28px;border-radius:22px;border:1px solid rgba(56,225,255,.35);background:linear-gradient(160deg,rgba(14,32,72,.65),rgba(7,18,48,.4));opacity:0;transform:translateY(16px);transition:opacity .5s var(--orb-out),transform .6s var(--orb-out);pointer-events:none}
.orb-chg-card.on{opacity:1;transform:none;pointer-events:auto}
.orb-chg-card .meta{display:flex;align-items:center;gap:14px;font-family:var(--orb-mono);font-size:12px;color:var(--orb-mute)}
.orb-chg-card .meta b{padding:4px 10px;border-radius:8px;background:rgba(56,225,255,.12);color:var(--orb-cyan);font-weight:600}
.orb-chg-card h3{margin-top:14px;font-size:1.9rem;font-weight:600;letter-spacing:-.03em}
.orb-chg-card p{margin-top:10px;color:var(--orb-mute)}
.orb-chg-count{margin-top:18px;font-family:var(--orb-mono);font-size:12px;letter-spacing:.2em;color:var(--orb-mute)}

/* touchdown */
.orb-land{padding:170px 0 0;background:var(--orb-bg);overflow:hidden}
.orb-land-sun{position:absolute;left:50%;top:-18%;width:min(1100px,150vw);aspect-ratio:1;transform:translateX(-50%);pointer-events:none}
.orb-land-sun i{position:absolute;inset:0;border-radius:50%;border:1px solid rgba(56,225,255,.2)}
.orb-land-sun i:nth-child(1){background:radial-gradient(circle,rgba(56,225,255,.28),rgba(56,225,255,.04) 55%,transparent 70%)}
.orb-land-sun i:nth-child(2){inset:14%;border-style:dashed;animation:orbSpin 80s linear infinite}
.orb-land-sun i:nth-child(3){inset:28%;animation:orbSpin 55s linear infinite reverse;border-color:rgba(251,243,228,.18)}
.orb-land .orb-wrap{position:relative}
.orb-form{display:flex;gap:12px;justify-content:center;margin:42px auto 0;max-width:520px;flex-wrap:wrap}
.orb-form input{flex:1 1 240px;height:52px;padding:0 22px;border-radius:999px;border:1px solid rgba(160,210,255,.3);background:rgba(10,26,58,.6);backdrop-filter:blur(8px);font-size:15px;color:var(--orb-warm)}
.orb-form input::placeholder{color:#6f86ad}
.orb-done{display:flex;align-items:center;gap:12px;padding:16px 24px;border-radius:999px;border:1px solid rgba(56,225,255,.45);background:rgba(56,225,255,.08);color:var(--orb-ice)}
.orb-done span{width:10px;height:10px;border-radius:50%;background:var(--orb-cyan);box-shadow:0 0 12px var(--orb-cyan);flex:none}
.orb-foot{position:relative;margin-top:150px;border-top:1px solid var(--orb-line);background:rgba(3,8,21,.7);padding:60px 0 30px}
.orb-foot-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:40px}
.orb-brand.static{font-size:18px}
.orb-foot-note{margin-top:14px;max-width:22em;color:var(--orb-mute);font-size:14px}
.orb-foot h4{font-family:var(--orb-mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--orb-cyan);margin-bottom:16px}
.orb-foot li{margin:9px 0}.orb-foot li a{color:var(--orb-ice);opacity:.75;font-size:14px;transition:opacity .2s}.orb-foot li a:hover{opacity:1}
.orb-legal{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:50px;padding-top:24px;border-top:1px solid var(--orb-line);font-size:13px;color:var(--orb-mute)}

/* responsive */
@media (max-width:1100px){.orb-rail{display:none}}
@media (max-width:900px){
 .orb-wrap{padding:0 20px}.orb-nav{padding:12px 20px}.orb-links,.orb-link-quiet{display:none}
 .orb-sec{padding:100px 0}
 .orb-anat-grid,.orb-tele-grid,.orb-price-grid{grid-template-columns:1fr;gap:40px}
 .orb-anat-side{position:sticky;top:62px;z-index:3;background:var(--orb-bg);padding:12px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--orb-line)}
 .orb-anat-side .orb-lede,.orb-anat-side .orb-eyebrow{display:none}
 .orb-anat-svg{width:76px;margin:0;flex:none}
 .orb-anat-side .orb-h2{font-size:1.7rem}
 .orb-cta .ghost{display:none}.orb-copy p{font-size:.95rem;margin-top:16px}.orb-cta{margin-top:22px}
 .orb-anat-list{gap:30px;padding:0}
 .orb-feat{padding:24px}
 .orb-hud{padding:0 16px 22px;flex-direction:column;align-items:stretch;gap:10px}
 .orb-hud-cap{width:100%;height:136px}
 .orb-hud-meter{display:none}
 .orb-hint{display:none}
 .orb-copy{top:11vh}
 .orb-chg-stick{grid-template-columns:1fr;padding:70px 16px 16px;gap:8px;align-content:start}
 .orb-chg-fig svg{width:min(42vh,100%)}
 .orb-chg-info .orb-h2{font-size:1.7rem}.orb-chg-info .orb-eyebrow{margin-bottom:10px}
 .orb-chg-cards{margin-top:14px}.orb-chg-card{padding:18px}.orb-chg-card h3{font-size:1.35rem}.orb-chg-count{margin-top:10px}
 .orb-foot-grid{grid-template-columns:1fr 1fr}
 .orb-stats{grid-template-columns:1fr 1fr}
 .orb-node{width:46px;height:46px;border-radius:13px}.orb-node.in2{width:38px;height:38px}.orb-node span{font-size:17px}.orb-node.in2 span{font-size:14px}.orb-node em{display:none}
 .orb-ring-mid{width:34%}
}
@media (max-width:520px){.orb-stats{grid-template-columns:1fr}.orb-stat-l{min-height:0}.orb-foot-grid{grid-template-columns:1fr}}

@media (prefers-reduced-motion:reduce){
 .orb *{animation:none!important}
 .orb.orb-js [data-rv]{opacity:1;transform:none;transition:none}
 .orb-hero{height:100vh}.orb-hint,.orb-hud,.orb-rail{display:none}
 .orb-chg{height:auto;padding:100px 0}
 .orb-chg-stick{position:static;height:auto}
 .orb-chg-cards{gap:14px}.orb-chg-card{grid-area:auto;opacity:1;transform:none;pointer-events:auto}
 .orb-chg-count{display:none}
 .orb-pr-arc,.orb-spark-line,.orb-spark-fill{transition:none}
 .orb-anat-side{position:static}
}
`;
