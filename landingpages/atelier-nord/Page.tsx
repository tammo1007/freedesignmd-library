/**
 * Atelier Nord, Scandinavian fashion e-commerce.
 *
 * Monochrome high-fashion storefront: giant condensed type, an art-directed
 * asymmetric grid and pre-rendered fabric photography (draped herringbone,
 * cable knit, twill, poplin, check and leather, recoloured per swatch) with a
 * CSS film-grain layer. No web fonts.
 *
 * Demo images: /img/lux/{dr-coat,dr-knit,dr-trouser,dr-shirt,dr-scarf,dr-bag,dunes-mono,still-grey}.webp
 * (+ -800 variants), included in the repo's public/img/lux, copy them next to your page or swap in your own.
 *
 * Motion
 *  - Masthead: each letter of ATELIER / NORD scrubs on scroll at its own
 *    speed and tilt; the cover image drifts and scales underneath.
 *  - Zoom-parallax lookbook: a pinned stage starts zoomed into one image and
 *    pulls back until it settles into an asymmetric grid; tiles arrive at
 *    different depths.
 *  - Product cards: swatch changes cross-fade the fabric colour; "Quick add"
 *    morphs (clip-path) into a size picker, then into an "Added" state.
 *  - Cart drawer slides in on a real spring (stiffness 380, damping 30).
 *  - A cursor-following "View" label springs after the pointer over product
 *    imagery (mouse only).
 *  - Editorial press-quote marquee; reveal-on-scroll everywhere else.
 *
 * Reduced motion: no scrub, no pinning, no marquee, drawer/label snap.
 * SSR-safe: no window/document access during render.
 * Accessibility: real buttons with aria-pressed / aria-label, dialog with
 * focus management + Escape, aria-live cart status, AA contrast.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Photography (pre-rendered, see /img/lux)                            */
/* ------------------------------------------------------------------ */
type GKind = "coat" | "knit" | "trouser" | "shirt" | "scarf" | "bag";
type SceneK = "figure" | "fjord" | "birch" | "stack" | "detail" | "window" | "still";

/* Fabric studies, rendered in neutral grey. The product image is multiplied
   over the swatch colour (mix-blend-mode: overlay) so every colourway keeps
   the same folds, weave and light. */
const FABRIC: Record<GKind, string> = { coat: "dr-coat", knit: "dr-knit", trouser: "dr-trouser", shirt: "dr-shirt", scarf: "dr-scarf", bag: "dr-bag" };
const SCENE_IMG: Record<SceneK, { f: string; w: number; h: number; pos: string; scale?: number }> = {
  figure: { f: "dr-coat", w: 1200, h: 1500, pos: "50% 40%" },
  fjord: { f: "dunes-mono", w: 1920, h: 1200, pos: "60% 50%" },
  birch: { f: "dr-trouser", w: 1200, h: 1500, pos: "50% 50%" },
  stack: { f: "dr-knit", w: 1200, h: 1500, pos: "50% 70%" },
  detail: { f: "dr-coat", w: 1200, h: 1500, pos: "30% 30%", scale: 1.9 },
  window: { f: "still-grey", w: 1200, h: 1500, pos: "50% 55%" },
  still: { f: "dr-bag", w: 1200, h: 1500, pos: "50% 50%" },
};

function ProductShot({ kind, color, label }: { kind: GKind; color: string; label: string }) {
  const f = FABRIC[kind];
  return (
    <div className="an-shot" role={label ? "img" : undefined} aria-label={label || undefined} style={{ background: color }}>
      <img src={`/img/lux/${f}-800.webp`} srcSet={`/img/lux/${f}-800.webp 800w, /img/lux/${f}.webp 1200w`} sizes="(max-width: 700px) 90vw, 480px" width={1200} height={1500} alt={label ? "" : `Grey ${kind} fabric study showing folds and weave in studio light`} loading="lazy" decoding="async" />
    </div>
  );
}

function Scene({ k, label, eager = false }: { k: SceneK; label: string; eager?: boolean }) {
  const s = SCENE_IMG[k];
  return (
    <img
      className="an-scene"
      src={`/img/lux/${s.f}-800.webp`}
      srcSet={`/img/lux/${s.f}-800.webp 800w, /img/lux/${s.f}.webp ${s.w}w`}
      sizes="(max-width: 700px) 100vw, 50vw"
      width={s.w}
      height={s.h}
      alt={label}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      style={{ objectPosition: s.pos, ...(s.scale ? { transform: `scale(${s.scale})`, transformOrigin: s.pos } : null) }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
type Swatch = { name: string; hex: string };
const SW = {
  ecru: { name: "Ecru", hex: "#E6E0D3" },
  stone: { name: "Stone", hex: "#A8A39A" },
  charcoal: { name: "Charcoal", hex: "#3A3A3A" },
  black: { name: "Black", hex: "#141414" },
  fog: { name: "Fog", hex: "#C9C9C6" },
  moss: { name: "Moss", hex: "#55574C" },
};
const PRODUCTS: { name: string; kind: GKind; price: number; tag?: string; swatches: Swatch[]; fabric: string; layout: string }[] = [
  { name: "Sund Overcoat", kind: "coat", price: 690, tag: "New", swatches: [SW.charcoal, SW.stone, SW.black], fabric: "Wool herringbone, 680 g/m", layout: "an-p-a" },
  { name: "Vind Cable Crew", kind: "knit", price: 230, swatches: [SW.ecru, SW.fog, SW.charcoal], fabric: "Extrafine merino", layout: "an-p-b" },
  { name: "Ström Pleated Trouser", kind: "trouser", price: 260, swatches: [SW.black, SW.stone, SW.moss], fabric: "Wool twill", layout: "an-p-c" },
  { name: "Ljus Poplin Shirt", kind: "shirt", price: 160, tag: "Restocked", swatches: [SW.ecru, SW.fog, SW.black], fabric: "Organic cotton poplin", layout: "an-p-d" },
  { name: "Frost Check Scarf", kind: "scarf", price: 140, swatches: [SW.fog, SW.charcoal, SW.ecru], fabric: "Lambswool", layout: "an-p-e" },
  { name: "Båt Leather Tote", kind: "bag", price: 320, swatches: [SW.black, SW.stone], fabric: "Vegetable-tanned leather", layout: "an-p-f" },
];
const SIZES = ["XS", "S", "M", "L", "XL"];
const ONE_SIZE: GKind[] = ["scarf", "bag"];

const LOOKS: { k: SceneK; label: string; cap: string }[] = [
  { k: "birch", label: "Charcoal wool twill falling in raking light", cap: "Look 03, Ström Trouser" },
  { k: "stack", label: "Merino cable knit, draped over a plinth", cap: "Vind Cable Crew" },
  { k: "detail", label: "Close-up of the herringbone weave on the overcoat", cap: "Herringbone, 680 g/m" },
  { k: "fjord", label: "Wind-sculpted dunes at first light, in monochrome", cap: "Look 01, Råbjerg Mile, 06:40" },
  { k: "window", label: "Ceramics and a dried branch in window light", cap: "Frost Check Scarf" },
  { k: "figure", label: "Charcoal herringbone wool, studio light", cap: "Look 07" },
  { k: "still", label: "Vegetable-tanned black leather, close-up", cap: "Båt Tote" },
];
const LOOK_CENTER = 3;

const QUOTES = [
  { q: "The quietest coat of the season, and the one everyone asked about.", s: "Kvarter Magazine" },
  { q: "Scandinavian restraint, cut with a tailor's arrogance.", s: "The Northern Review" },
  { q: "Atelier Nord makes clothes you stop noticing, which is the point.", s: "Form & Fabric" },
  { q: "A knit you will hand down, not throw out.", s: "Studio Weekly" },
];

const FABRICS = [
  { name: "Herringbone wool", from: "Kvarnby Spinneri, Halland", spec: "680 g/m · 100% wool", cls: "an-tx-hb" },
  { name: "Cable merino", from: "Filatura Orsi, Biella", spec: "19.5 µm · RWS certified", cls: "an-tx-knit" },
  { name: "Bouclé alpaca", from: "Andean co-op, Arequipa", spec: "62% alpaca · 38% wool", cls: "an-tx-boucle" },
  { name: "Cotton poplin", from: "Tessitura Vela, Como", spec: "120/2 · GOTS organic", cls: "an-tx-poplin" },
];

const JOURNAL = [
  { k: "fjord" as SceneK, date: "14 Oct 2026", t: "Six days on Lysefjord: shooting AW26 in four hours of light a day" },
  { k: "stack" as SceneK, date: "2 Oct 2026", t: "Why our cable crew takes eleven hours to knit, and why we refuse to speed it up" },
  { k: "window" as SceneK, date: "19 Sep 2026", t: "Inside the Södermalm atelier: repairs, alterations and a very old Pfaff" },
];

const fmt = (n: number) => `€${n.toLocaleString("en-IE")}`;
type CartItem = { key: string; name: string; kind: GKind; color: Swatch; size: string; price: number; qty: number };

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export function Page() {
  const rootRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const [small, setSmall] = useState(false);
  const [menu, setMenu] = useState(false);
  const [colors, setColors] = useState<number[]>(PRODUCTS.map(() => 0));
  const [picking, setPicking] = useState<number | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([
    { key: "ström-black-M", name: "Ström Pleated Trouser", kind: "trouser", color: SW.black, size: "M", price: 260, qty: 1 },
  ]);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  const count = cart.reduce((a, c) => a + c.qty, 0);
  const subtotal = cart.reduce((a, c) => a + c.qty * c.price, 0);
  const FREE = 400;

  /* Scroll engine, reveals, cursor label. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    if (!win) return;
    const reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.classList.add("an-js");

    // Hosts with overflow:hidden on html AND body make <body> a scroll container
    // that never scrolls, which breaks position:sticky. `clip` looks the same.
    let restoreBody: (() => void) | null = null;
    const fixRaf = win.requestAnimationFrame(() => {
      const b = doc.body;
      const bs = win.getComputedStyle(b);
      const hs = win.getComputedStyle(doc.documentElement);
      if (hs.overflowX !== "visible" && (bs.overflowX === "hidden" || bs.overflowY === "auto")) {
        const prev = [b.style.overflowX, b.style.overflowY];
        b.style.overflowX = "clip";
        b.style.overflowY = "visible";
        restoreBody = () => {
          b.style.overflowX = prev[0];
          b.style.overflowY = prev[1];
        };
      }
    });

    const mast = root.querySelector<HTMLElement>(".an-mast");
    const look = root.querySelector<HTMLElement>(".an-look");
    const grid = root.querySelector<HTMLElement>(".an-look-grid");
    const stage = root.querySelector<HTMLElement>(".an-look-stage");
    const center = root.querySelector<HTMLElement>(`.an-tile-${LOOK_CENTER}`);
    let s0 = 1;
    let ox = 0;
    let oy = 0;
    let lookOn = false;

    // Fit the masthead word to the content width whatever condensed face the OS supplies.
    const word = root.querySelector<HTMLElement>(".an-word");
    const fitWord = () => {
      if (!word || !mast) return;
      const lines = Array.from(word.querySelectorAll<HTMLElement>(".an-word-line"));
      word.style.fontSize = "100px";
      const widest = Math.max(...lines.map((l) => l.scrollWidth));
      const avail = mast.clientWidth - parseFloat(win.getComputedStyle(mast).paddingLeft) * 2;
      if (widest <= 0) return;
      const byWidth = ((100 * avail) / widest) * 0.995;
      // Keep the CTA row above the fold on short desktop viewports.
      const byHeight = win.innerWidth > 760 ? (win.innerHeight - 330) / 1.56 : Infinity;
      word.style.fontSize = `${Math.floor(Math.max(64, Math.min(byWidth, byHeight)))}px`;
    };
    doc.fonts?.ready.then(() => { fitWord(); }).catch(() => {});

    const measure = () => {
      fitWord();
      lookOn = !reduce && win.innerWidth > 760;
      if (!grid || !center || !stage) return;
      grid.style.transform = "";
      if (!lookOn) {
        look?.classList.remove("is-zoom");
        return;
      }
      look?.classList.add("is-zoom");
      const cw = center.offsetWidth;
      const ch = center.offsetHeight;
      const cx = center.offsetLeft + cw / 2;
      const cy = center.offsetTop + ch / 2;
      grid.style.transformOrigin = `${cx}px ${cy}px`;
      s0 = Math.max(win.innerWidth / cw, win.innerHeight / ch) * 1.02;
      // Where the centre tile sits relative to the stage centre when settled.
      ox = stage.clientWidth / 2 - (grid.offsetLeft + cx);
      oy = stage.clientHeight / 2 - (grid.offsetTop + cy);
    };

    let raf = 0;
    let lastSmall = false;
    const update = () => {
      raf = 0;
      const vh = win.innerHeight;
      const y = win.scrollY || doc.documentElement.scrollTop;
      const sm = y > 40;
      if (sm !== lastSmall) {
        lastSmall = sm;
        setSmall(sm);
      }
      if (mast && !reduce) {
        const r = mast.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
        mast.style.setProperty("--p", p.toFixed(4));
      }
      if (look && grid && lookOn) {
        const r = look.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)));
        const k = Math.min(1, p / 0.78);
        const e = 1 - Math.pow(1 - k, 3);
        const s = s0 + (1 - s0) * e;
        grid.style.transform = `translate3d(${(ox * (1 - e)).toFixed(1)}px, ${(oy * (1 - e)).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
        look.style.setProperty("--e", e.toFixed(4));
      }
    };
    const onScroll = () => {
      if (!raf) raf = win.requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    update();
    win.addEventListener("scroll", onScroll, { passive: true });
    win.addEventListener("resize", onResize);

    const io = new win.IntersectionObserver(
      (es) => es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }),
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    root.querySelectorAll("[data-an-rv]").forEach((el) => io.observe(el));

    // Cursor "View" label, spring-follow (stiffness 380, damping 30).
    const label = root.querySelector<HTMLElement>(".an-cursor");
    let tx = 0, ty = 0, x = 0, y2 = 0, vx = 0, vy = 0, active = false, cRaf = 0, last = 0;
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - (last || now)) / 1000) || 0.016;
      last = now;
      const ax = 380 * (tx - x) - 30 * vx;
      const ay = 380 * (ty - y2) - 30 * vy;
      vx += ax * dt; vy += ay * dt;
      x += vx * dt; y2 += vy * dt;
      if (label) label.style.transform = `translate3d(${x.toFixed(1)}px, ${y2.toFixed(1)}px, 0)`;
      if (Math.abs(tx - x) + Math.abs(ty - y2) + Math.abs(vx) + Math.abs(vy) > 0.3) cRaf = win.requestAnimationFrame(step);
      else { cRaf = 0; last = 0; }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !label) return;
      const t = e.target as Element | null;
      // Show over imagery, but step aside for real controls (quick add, hotspots).
      const hit = t?.closest?.("[data-an-view]") && !t.closest("button");
      const rr = root.getBoundingClientRect();
      tx = e.clientX - rr.left;
      ty = e.clientY - rr.top;
      if (hit && !active) {
        active = true;
        if (reduce || !label.classList.contains("is-on")) { x = tx; y2 = ty; vx = vy = 0; }
        label.classList.add("is-on");
      } else if (!hit && active) {
        active = false;
        label.classList.remove("is-on");
      }
      if (reduce) {
        label.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        return;
      }
      if (!cRaf) cRaf = win.requestAnimationFrame(step);
    };
    root.addEventListener("pointermove", onMove, { passive: true });
    const onLeave = () => { active = false; label?.classList.remove("is-on"); };
    root.addEventListener("pointerleave", onLeave);

    return () => {
      win.cancelAnimationFrame(fixRaf);
      if (raf) win.cancelAnimationFrame(raf);
      if (cRaf) win.cancelAnimationFrame(cRaf);
      win.removeEventListener("scroll", onScroll);
      win.removeEventListener("resize", onResize);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      io.disconnect();
      restoreBody?.();
      root.classList.remove("an-js");
    };
  }, []);

  /* Cart drawer, spring slide + focus management. */
  const springX = useRef({ x: 104, v: 0 });
  useEffect(() => {
    const el = drawerRef.current;
    const win = el?.ownerDocument.defaultView;
    if (!el || !win) return;
    const reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = open ? 0 : 104;
    const st = springX.current;
    let raf = 0;
    let last = 0;
    const paint = () => { el.style.transform = `translate3d(${st.x.toFixed(2)}%, 0, 0)`; };
    if (reduce) {
      st.x = target; st.v = 0; paint();
    } else {
      const tick = (now: number) => {
        const dt = Math.min(0.032, (now - (last || now)) / 1000) || 0.016;
        last = now;
        const a = 380 * (target - st.x) - 30 * st.v;
        st.v += a * dt;
        st.x += st.v * dt;
        paint();
        if (Math.abs(target - st.x) > 0.05 || Math.abs(st.v) > 0.05) raf = win.requestAnimationFrame(tick);
        else { st.x = target; st.v = 0; paint(); }
      };
      raf = win.requestAnimationFrame(tick);
    }
    if (open) {
      lastFocus.current = el.ownerDocument.activeElement as HTMLElement | null;
      win.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 60);
    } else if (lastFocus.current) {
      lastFocus.current.focus?.({ preventScroll: true });
      lastFocus.current = null;
    }
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        const f = Array.from(el.querySelectorAll<HTMLElement>("button, a[href], input")).filter((n) => !n.hasAttribute("disabled"));
        if (!f.length) return;
        const first = f[0];
        const lastEl = f[f.length - 1];
        const act = el.ownerDocument.activeElement;
        if (e.shiftKey && act === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && act === lastEl) { e.preventDefault(); first.focus(); }
      }
    };
    el.ownerDocument.addEventListener("keydown", onKey);
    return () => {
      win.cancelAnimationFrame(raf);
      el.ownerDocument.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const addToCart = (pi: number, size: string) => {
    const p = PRODUCTS[pi];
    const c = p.swatches[colors[pi]];
    const key = `${p.name}-${c.name}-${size}`;
    setCart((cs) => {
      const ex = cs.find((x) => x.key === key);
      if (ex) return cs.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x));
      return [{ key, name: p.name, kind: p.kind, color: c, size, price: p.price, qty: 1 }, ...cs];
    });
    setPicking(null);
    setAdded(pi);
    setBump((b) => b + 1);
    setStatus(`${p.name}, ${c.name}, size ${size} added to your bag.`);
    const win = rootRef.current?.ownerDocument.defaultView;
    win?.setTimeout(() => setOpen(true), 650);
    win?.setTimeout(() => setAdded((a) => (a === pi ? null : a)), 2600);
  };
  const changeQty = (key: string, d: number) =>
    setCart((cs) => cs.map((x) => (x.key === key ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));

  const navL = ["Women", "Men", "Knitwear", "Lookbook", "Journal"];
  const word1 = "ATELIER".split("");
  const word2 = "NORD".split("");
  const dyOf = (i: number, w: number) => (w === 0 ? -1 : 1) * (40 + ((i * 53 + w * 31) % 110));
  const rotOf = (i: number, w: number) => (((i + w) % 3) - 1) * (2 + (i % 2) * 2);

  return (
    <div ref={rootRef} className="an">
      <style>{css}</style>
      <a className="an-skip" href="#an-main">Skip to content</a>
      <span className="an-cursor" aria-hidden="true">View</span>

      <p className="an-announce">Complimentary shipping & returns across the EU over €400 · Repairs free for life</p>

      {/* NAV */}
      <header className={`an-nav${small ? " is-small" : ""}${menu ? " is-open" : ""}`}>
        <div className="an-nav-in">
          <nav className="an-nav-l" aria-label="Primary">
            <button type="button" className="an-burger" aria-expanded={menu} aria-label={menu ? "Close menu" : "Open menu"} onClick={() => setMenu((m) => !m)}><span /><span /></button>
            {navL.map((l) => <a key={l} href={l === "Lookbook" ? "#an-look" : l === "Journal" ? "#an-journal" : "#an-shop"}>{l}</a>)}
          </nav>
          <a href="#an-top" className="an-logo" aria-label="Atelier Nord, home">Atelier&nbsp;Nord</a>
          <div className="an-nav-r">
            <a href="#an-top" className="an-nav-txt">Search</a>
            <a href="#an-top" className="an-nav-txt">Account</a>
            <button type="button" className="an-bag-btn" onClick={() => setOpen(true)} aria-label={`Bag, ${count} ${count === 1 ? "item" : "items"}`}>
              Bag <span key={bump} className={`an-bag-n${bump ? " is-bump" : ""}`}>{count}</span>
            </button>
          </div>
        </div>
        <div className="an-sheet" hidden={!menu}>
          {navL.map((l) => <a key={l} href={l === "Lookbook" ? "#an-look" : l === "Journal" ? "#an-journal" : "#an-shop"} onClick={() => setMenu(false)}>{l}</a>)}
        </div>
      </header>

      <main id="an-main">
        {/* MASTHEAD */}
        <section id="an-top" className="an-mast" aria-labelledby="an-mast-title">
          <div className="an-mast-meta">
            <p>Autumn / Winter 2026<br />Collection 07, <em>Stillhet</em></p>
            <p className="an-mast-meta-r">Designed in Stockholm<br />Made in Portugal & Italy</p>
          </div>
          <figure className="an-mast-img" data-an-view>
            <div className="an-mast-img-in an-grain"><Scene k="figure" eager label="Charcoal herringbone wool, draped in soft studio light" /></div>
            <figcaption>Look 07 · Sund Overcoat, Charcoal</figcaption>
          </figure>
          <h1 id="an-mast-title" className="an-word" aria-label="Atelier Nord">
            <span className="an-word-line" aria-hidden="true">
              {word1.map((c, i) => (
                <span key={i} className="an-ch" style={{ "--dy": dyOf(i, 0), "--rot": rotOf(i, 0), "--i": i } as CSSProperties}><span>{c}</span></span>
              ))}
            </span>
            <span className="an-word-line an-word-line-2" aria-hidden="true">
              {word2.map((c, i) => (
                <span key={i} className="an-ch" style={{ "--dy": dyOf(i, 1), "--rot": rotOf(i, 1), "--i": i + 7 } as CSSProperties}><span>{c}</span></span>
              ))}
            </span>
          </h1>
          <div className="an-mast-foot">
            <p>Clothes for long winters and short light. Seven-year coats, knits you repair, nothing you need to explain.</p>
            <a href="#an-shop" className="an-btn an-btn-ink">Shop the collection <span aria-hidden="true">→</span></a>
          </div>
        </section>

        {/* STATEMENT */}
        <section className="an-statement" aria-label="About the collection">
          <p className="an-statement-n" data-an-rv>(01)</p>
          <p className="an-statement-t" data-an-rv>
            Stillhet is Swedish for <em>stillness</em>. Thirty-one pieces in five colours, cut from cloth woven within
            <span className="an-inline-img an-grain" aria-hidden="true"><Scene k="detail" label="" /></span>
            a day of where it was spun, built to be worn hard and mended, not replaced.
          </p>
        </section>

        {/* LOOKBOOK ZOOM */}
        <section id="an-look" className="an-look" aria-labelledby="an-look-title">
          <div className="an-look-stage">
            <div className="an-look-head">
              <h2 id="an-look-title" className="an-h2">Lookbook, AW26</h2>
              <p>Shot on Lysefjord and in Tyresta, October 2026</p>
            </div>
            <ul className="an-look-grid">
              {LOOKS.map((l, i) => (
                <li key={l.k} className={`an-tile an-tile-${i}`} style={{ "--k": [140, -90, 200, 0, -160, 120, -60][i] } as CSSProperties} data-an-view>
                  <div className="an-tile-img an-grain"><Scene k={l.k} label={l.label} /></div>
                  <p className="an-tile-cap">{l.cap}</p>
                </li>
              ))}
            </ul>
            <p className="an-look-over" aria-hidden="true">Stillhet</p>
          </div>
        </section>

        {/* SHOP */}
        <section id="an-shop" className="an-shop" aria-labelledby="an-shop-title">
          <div className="an-shop-head">
            <h2 id="an-shop-title" className="an-h2 an-h2-xl" data-an-rv>New in</h2>
            <p data-an-rv>Six pieces from Collection 07. Every garment ships with a repair card, send it back any time and we'll mend it free.</p>
            <a href="#an-shop" className="an-link" data-an-rv>View all 31 pieces</a>
          </div>
          <p className="an-sr" aria-live="polite">{status}</p>
          <ul className="an-grid">
            {PRODUCTS.map((p, i) => {
              const c = p.swatches[colors[i]];
              const isPick = picking === i;
              const isAdded = added === i;
              const oneSize = ONE_SIZE.includes(p.kind);
              return (
                <li key={p.name} className={`an-card ${p.layout}`} data-an-rv>
                  <div className="an-card-media" data-an-view>
                    <a href="#an-shop" className="an-card-img an-grain" aria-label={`${p.name} in ${c.name}, ${fmt(p.price)}`}>
                      <ProductShot kind={p.kind} color={c.hex} label={`${p.name} in ${c.name}`} />
                    </a>
                    {p.tag && <span className="an-tag">{p.tag}</span>}
                    <div className={`an-qa${isPick ? " is-pick" : ""}${isAdded ? " is-added" : ""}`}>
                      <button type="button" className="an-qa-main" aria-expanded={isPick} onClick={() => (oneSize ? addToCart(i, "One size") : setPicking(isPick ? null : i))} disabled={isAdded}>
                        <span className="an-qa-plus" aria-hidden="true" />
                        <span className="an-qa-txt">{isAdded ? "Added" : oneSize ? "Add to bag" : "Quick add"}</span>
                      </button>
                      <div className="an-qa-sizes" role="group" aria-label={`Choose size for ${p.name}`} aria-hidden={!isPick}>
                        {SIZES.map((s, si) => (
                          <button key={s} type="button" tabIndex={isPick ? 0 : -1} disabled={p.kind === "coat" && si === 0} onClick={() => addToCart(i, s)} aria-label={`Size ${s}${p.kind === "coat" && si === 0 ? ", sold out" : ""}`}>{s}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="an-card-info">
                    <div>
                      <h3 className="an-card-name">{p.name}</h3>
                      <p className="an-card-fab">{p.fabric} · <span className="an-card-col">{c.name}</span></p>
                    </div>
                    <p className="an-card-price">{fmt(p.price)}</p>
                  </div>
                  <div className="an-sw" role="group" aria-label={`Colour for ${p.name}`}>
                    {p.swatches.map((s, si) => (
                      <button key={s.name} type="button" aria-label={s.name} aria-pressed={colors[i] === si} className={colors[i] === si ? "is-on" : ""} style={{ "--c": s.hex } as CSSProperties} onClick={() => setColors((cs) => cs.map((v, k) => (k === i ? si : v)))} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* PRESS MARQUEE */}
        <section className="an-press" aria-label="Press">
          <div className="an-marquee">
            <div className="an-marquee-track">
              {[0, 1].map((k) => (
                <ul key={k} className="an-marquee-set" aria-hidden={k === 1}>
                  {QUOTES.map((q) => (
                    <li key={q.s}><blockquote>“{q.q}”</blockquote><cite>– {q.s}</cite><span className="an-star" aria-hidden="true">✳</span></li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURE */}
        <section className="an-feature" aria-labelledby="an-feature-title">
          <div className="an-feature-media" data-an-view>
            <div className="an-feature-img an-grain">
              <ProductShot kind="coat" color={SW.charcoal.hex} label="Sund Overcoat, charcoal, front view" />
              {[
                { x: 47, y: 24, t: "Herringbone twill, 680 g/m wool" },
                { x: 57, y: 55, t: "Brushed by hand for a soft, even nap" },
                { x: 30, y: 70, t: "Lined in Bemberg cupro" },
              ].map((h, i) => (
                <button key={i} type="button" className="an-hot" style={{ left: `${h.x}%`, top: `${h.y}%` }} aria-label={h.t}>
                  <span aria-hidden="true">{i + 1}</span>
                  <em role="tooltip">{h.t}</em>
                </button>
              ))}
            </div>
          </div>
          <div className="an-feature-text">
            <p className="an-eyebrow" data-an-rv>The Sund Overcoat</p>
            <h2 id="an-feature-title" className="an-h2 an-h2-xl" data-an-rv>Seven winters, minimum.</h2>
            <p className="an-body" data-an-rv>A single-breasted coat in 680-gram herringbone, woven in Halland from wool shorn forty kilometres away. Canvassed through the chest, cut long enough to cover a blazer and roomy enough for a cable knit underneath.</p>
            <dl className="an-specs" data-an-rv>
              <div><dt>Cloth</dt><dd>100% wool herringbone, Kvarnby Spinneri</dd></div>
              <div><dt>Lining</dt><dd>Bemberg cupro, body & sleeves</dd></div>
              <div><dt>Fit</dt><dd>Relaxed. Model is 186 cm wearing M</dd></div>
              <div><dt>Made</dt><dd>Guimarães, Portugal, 14 hours per coat</dd></div>
              <div><dt>Care</dt><dd>Brush, air, steam. Free repairs for life</dd></div>
            </dl>
            <div className="an-feature-cta" data-an-rv>
              <button type="button" className="an-btn an-btn-ink" onClick={() => addToCart(0, "M")}>Add to bag, {fmt(690)}</button>
              <a href="#an-shop" className="an-link">Size guide</a>
            </div>
          </div>
        </section>

        {/* MATERIALS */}
        <section className="an-mat" aria-labelledby="an-mat-title">
          <div className="an-mat-head">
            <p className="an-eyebrow" data-an-rv>(04) Materials</p>
            <h2 id="an-mat-title" className="an-h2" data-an-rv>Four cloths. Four mills. We have visited every one.</h2>
          </div>
          <ul className="an-mat-grid">
            {FABRICS.map((f, i) => (
              <li key={f.name} className="an-mat-card" data-an-rv style={{ "--d": `${i * 80}ms` } as CSSProperties}>
                <div className="an-mat-sw"><span className={`an-tx ${f.cls}`} /></div>
                <h3 className="an-mat-name">{f.name}</h3>
                <p className="an-mat-from">{f.from}</p>
                <p className="an-mat-spec">{f.spec}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* JOURNAL */}
        <section id="an-journal" className="an-journal" aria-labelledby="an-journal-title">
          <div className="an-journal-head">
            <h2 id="an-journal-title" className="an-h2 an-h2-xl" data-an-rv>Journal</h2>
            <a href="#an-journal" className="an-link" data-an-rv>All stories</a>
          </div>
          <ul className="an-journal-grid">
            {JOURNAL.map((j, i) => (
              <li key={j.t} className="an-story" data-an-rv style={{ "--d": `${i * 90}ms` } as CSSProperties}>
                <a href="#an-journal">
                  <div className="an-story-img an-grain"><Scene k={j.k} label={LOOKS.find((l) => l.k === j.k)?.label ?? "Atelier Nord journal story cover"} /></div>
                  <p className="an-story-date">{j.date}</p>
                  <h3 className="an-story-t">{j.t}</h3>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="an-foot">
        <div className="an-foot-top">
          <form className="an-news" onSubmit={(e) => { e.preventDefault(); if (/\S+@\S+\.\S+/.test(email)) setJoined(true); }}>
            <h2 className="an-news-t">Letters from the atelier</h2>
            <p className="an-news-s">New collections a week early, sample sales in Stockholm and Copenhagen. Twice a season, never more.</p>
            <label htmlFor="an-email" className="an-news-l">Email</label>
            <div className="an-news-row">
              <input id="an-email" type="email" required autoComplete="email" placeholder="name@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={joined} />
              <button type="submit" disabled={joined}>{joined ? "Subscribed ✓" : "Subscribe"}</button>
            </div>
            <p className="an-news-note" aria-live="polite">{joined ? `Tack, the next letter goes to ${email}.` : "By subscribing you accept our privacy policy."}</p>
          </form>
          <div className="an-foot-cols">
            <div><p className="an-foot-h">Stores</p><ul><li>Hornsgatan 54, Stockholm</li><li>Ravnsborggade 9, København</li><li>Markveien 35, Oslo</li></ul></div>
            <div><p className="an-foot-h">Help</p><ul>{["Shipping & returns", "Repairs", "Size guide", "Care", "Contact"].map((x) => <li key={x}><a href="#an-top">{x}</a></li>)}</ul></div>
            <div><p className="an-foot-h">Atelier</p><ul>{["About", "Mills & makers", "Impact report 2025", "Careers", "Stockists"].map((x) => <li key={x}><a href="#an-top">{x}</a></li>)}</ul></div>
            <div><p className="an-foot-h">Follow</p><ul>{["Instagram", "Pinterest", "Spotify, Stillhet playlist"].map((x) => <li key={x}><a href="#an-top">{x}</a></li>)}</ul></div>
          </div>
        </div>
        <p className="an-foot-word" aria-hidden="true">ATELIER NORD</p>
        <div className="an-foot-legal">
          <span>© 2026 Atelier Nord AB · Org. nr 559301-4471 · Stockholm</span>
          <span><a href="#an-top">Privacy</a><a href="#an-top">Terms</a><a href="#an-top">Cookies</a><a href="#an-top">EUR € / English</a></span>
        </div>
      </footer>

      {/* CART DRAWER */}
      <div className={`an-scrim${open ? " is-on" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div ref={drawerRef} className={`an-drawer${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="an-bag-title" aria-hidden={!open} style={{ transform: "translate3d(104%,0,0)" }}>
        <div className="an-drawer-head">
          <h2 id="an-bag-title" className="an-drawer-t">Bag <span>({count})</span></h2>
          <button ref={closeRef} type="button" className="an-x" onClick={() => setOpen(false)} aria-label="Close bag" tabIndex={open ? 0 : -1}><span /><span /></button>
        </div>
        <div className="an-ship">
          <p>{subtotal >= FREE ? "You've unlocked free shipping." : `You're ${fmt(FREE - subtotal)} away from free shipping.`}</p>
          <span className="an-ship-bar"><i style={{ transform: `scaleX(${Math.min(1, subtotal / FREE)})` }} /></span>
        </div>
        <ul className="an-lines">
          {cart.length === 0 && <li className="an-empty">Your bag is empty.</li>}
          {cart.map((c) => (
            <li key={c.key} className="an-line">
              <div className="an-line-img"><ProductShot kind={c.kind} color={c.color.hex} label="" /></div>
              <div className="an-line-info">
                <p className="an-line-name">{c.name}</p>
                <p className="an-line-meta">{c.color.name} · {c.size}</p>
                <div className="an-qty">
                  <button type="button" onClick={() => changeQty(c.key, -1)} aria-label={`Remove one ${c.name}`} tabIndex={open ? 0 : -1}>−</button>
                  <span>{c.qty}</span>
                  <button type="button" onClick={() => changeQty(c.key, 1)} aria-label={`Add one ${c.name}`} tabIndex={open ? 0 : -1}>+</button>
                </div>
              </div>
              <p className="an-line-price">{fmt(c.price * c.qty)}</p>
            </li>
          ))}
        </ul>
        <div className="an-drawer-foot">
          <p className="an-sub"><span>Subtotal</span><span>{fmt(subtotal)}</span></p>
          <p className="an-sub-note">Taxes included. Shipping calculated at checkout.</p>
          <button type="button" className="an-btn an-btn-ink an-btn-block" disabled={!cart.length} tabIndex={open ? 0 : -1}>Checkout</button>
        </div>
      </div>
    </div>
  );
}

export default Page;

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")`;

const css = String.raw`
.an {
  --an-paper: #F2F1EE;
  --an-white: #FFFFFF;
  --an-studio: #E4E2DD;
  --an-ink: #0E0E0E;
  --an-graphite: #2A2A2A;
  --an-grey: #66645F;
  --an-line: rgba(14, 14, 14, 0.14);
  --an-cond: "HelveticaNeue-CondensedBold", "Helvetica Neue Condensed Bold", "Helvetica Neue Condensed", "Arial Narrow", "Roboto Condensed", "Nimbus Sans Narrow", "TeX Gyre Heros Cn", "Liberation Sans Narrow", ui-sans-serif, sans-serif;
  --an-sans: "Helvetica Neue", Helvetica, ui-sans-serif, -apple-system, "Inter", "Segoe UI", Roboto, Arial, sans-serif;
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms;
  --fd-dur-2: 240ms;
  --fd-dur-3: 420ms;
  --fd-dur-4: 700ms;
  --an-gut: 24px;
  position: relative;
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow-x: clip;
  background: var(--an-paper);
  color: var(--an-ink);
  font: 400 14px/1.5 var(--an-sans);
  letter-spacing: 0;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.an *, .an *::before, .an *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0 solid transparent;
  font: inherit;
  color: inherit;
  letter-spacing: inherit;
  text-decoration: none;
  list-style: none;
  background: none;
  -webkit-appearance: none;
  appearance: none;
  min-width: 0;
  font-style: normal;
}
.an :where(svg) { display: block; }
.an :where(button) { cursor: pointer; text-align: inherit; line-height: inherit; border-radius: 0; }
.an :where(button:disabled) { cursor: not-allowed; }
.an :focus-visible { outline: 2px solid rgba(14, 14, 14, 0.7); outline-offset: 2px; }
.an [hidden] { display: none !important; }
.an-skip { position: absolute; left: 12px; top: -60px; z-index: 200; padding: 12px 16px; background: var(--an-ink); color: #fff; font: 500 13px/1 var(--an-sans); }
.an-skip:focus { top: 12px; }
.an-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.an-grain { position: relative; }
.an-grain::after { content: ""; position: absolute; inset: 0; pointer-events: none; background-image: ${GRAIN}; background-size: 160px 160px; opacity: 0.2; mix-blend-mode: multiply; }
.an-shot, .an-scene { display: block; width: 100%; height: 100%; max-width: none; }
.an-shot { position: relative; overflow: hidden; }
.an-shot img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; max-width: none; object-fit: cover; mix-blend-mode: overlay; }
.an-scene { object-fit: cover; }
.an-fab { transition: fill var(--fd-dur-4) var(--fd-ease-in-out); }
.an-fab-stroke { transition: stroke var(--fd-dur-4) var(--fd-ease-in-out); }

.an-eyebrow { font: 500 12px/1.4 var(--an-sans); letter-spacing: 0.1em; text-transform: uppercase; color: var(--an-grey); }
.an-h2 { font: 700 clamp(40px, 5vw, 76px)/0.88 var(--an-cond); font-stretch: condensed; letter-spacing: -0.015em; text-transform: uppercase; color: var(--an-ink); }
.an-h2-xl { font-size: clamp(64px, 9vw, 150px); line-height: 0.82; letter-spacing: -0.025em; }
.an-body { font: 400 16px/1.6 var(--an-sans); color: var(--an-graphite); }
.an-link { display: inline-flex; align-items: center; min-height: 44px; font: 500 13px/1 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--an-ink); background-image: linear-gradient(currentColor, currentColor); background-size: 100% 1px; background-repeat: no-repeat; background-position: 0 calc(50% + 10px); transition: background-size var(--fd-dur-3) var(--fd-ease-out); }
.an-link:hover { background-size: 0% 1px; background-position: 100% calc(50% + 10px); }
.an-btn { display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 52px; padding: 0 28px; font: 500 13px/1 var(--an-sans); letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; transition: background-color var(--fd-dur-2) var(--fd-ease-out), color var(--fd-dur-2) var(--fd-ease-out), transform var(--fd-dur-2) var(--fd-spring); }
.an-btn span { transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.an-btn:hover span { transform: translateX(4px); }
.an-btn:active { transform: scale(0.97); transition-duration: var(--fd-dur-1); }
.an-btn-ink { background: var(--an-ink); color: #FFFFFF; }
.an-btn-ink:hover { background: #333; }
.an-btn-ink:disabled { background: #9A9893; }
.an-btn-block { width: 100%; }

/* Cursor label */
.an-cursor { position: absolute; left: 0; top: 0; z-index: 90; display: grid; place-items: center; width: 84px; height: 84px; margin: -42px 0 0 -42px; border-radius: 50%; background: var(--an-ink); color: #FFFFFF; font: 500 12px/1 var(--an-sans); letter-spacing: 0.12em; text-transform: uppercase; pointer-events: none; scale: 0; transition: scale var(--fd-dur-3) var(--fd-spring); will-change: transform; }
.an-cursor.is-on { scale: 1; }

/* Announcement + NAV */
.an-announce { padding: 10px var(--an-gut); background: var(--an-ink); color: #EDEDEA; font: 400 12px/1.4 var(--an-sans); letter-spacing: 0.06em; text-align: center; }
.an-nav { position: sticky; top: 0; z-index: 70; }
.an-nav-in { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 72px; padding: 0 var(--an-gut); background: var(--an-paper); border-bottom: 1px solid transparent; transition: height var(--fd-dur-3) var(--fd-ease-out), border-color var(--fd-dur-3) var(--fd-ease-out), background-color var(--fd-dur-3) var(--fd-ease-out); }
.an-nav.is-small .an-nav-in { height: 52px; border-bottom-color: var(--an-line); background: rgba(242, 241, 238, 0.9); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); }
.an-nav-l { display: flex; align-items: center; gap: 22px; }
.an-nav-l a, .an-nav-txt { display: inline-flex; align-items: center; min-height: 44px; font: 500 12px/1 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--an-ink); }
.an-nav-l a:hover, .an-nav-txt:hover { text-decoration: underline; text-underline-offset: 4px; }
.an-logo { font: 700 30px/1 var(--an-cond); font-stretch: condensed; letter-spacing: 0.04em; text-transform: uppercase; color: var(--an-ink); white-space: nowrap; transition: font-size var(--fd-dur-3) var(--fd-ease-out), letter-spacing var(--fd-dur-3) var(--fd-ease-out); }
.an-nav.is-small .an-logo { font-size: 22px; letter-spacing: 0.08em; }
.an-nav-r { display: flex; align-items: center; justify-content: flex-end; gap: 22px; }
.an-bag-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font: 500 12px/1 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--an-ink); }
.an-bag-n { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 9999px; background: var(--an-ink); color: #FFFFFF; font: 500 11px/1 var(--an-sans); letter-spacing: 0; }
.an-bag-n.is-bump { animation: an-bump 600ms var(--fd-spring); }
@keyframes an-bump { 0% { transform: scale(1); } 30% { transform: scale(1.5); } 100% { transform: scale(1); } }
.an-burger { display: none; position: relative; width: 44px; height: 44px; margin-left: -10px; }
.an-burger span { position: absolute; left: 11px; right: 11px; height: 1.5px; background: var(--an-ink); transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.an-burger span:first-child { top: 18px; }
.an-burger span:last-child { top: 25px; }
.an-nav.is-open .an-burger span:first-child { transform: translateY(3.5px) rotate(45deg); }
.an-nav.is-open .an-burger span:last-child { transform: translateY(-3.5px) rotate(-45deg); }
.an-sheet { display: flex; flex-direction: column; padding: 8px var(--an-gut) 24px; background: var(--an-paper); border-bottom: 1px solid var(--an-line); }
.an-sheet a { padding: 10px 0; font: 700 44px/1 var(--an-cond); font-stretch: condensed; text-transform: uppercase; color: var(--an-ink); }

/* MASTHEAD */
.an-mast { position: relative; display: grid; grid-template-columns: 1fr; grid-template-rows: auto 1fr auto auto; min-height: calc(100vh - 110px); min-height: calc(100svh - 110px); padding: 20px var(--an-gut) 28px; --p: 0; overflow: hidden; }
.an-mast-meta { display: flex; justify-content: space-between; gap: 24px; font: 500 12px/1.5 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--an-ink); position: relative; z-index: 3; }
.an-mast > .an-word { isolation: auto; }
.an-mast-meta em { font-style: italic; }
.an-mast-meta-r { text-align: right; color: var(--an-grey); }
.an-mast-img { position: absolute; right: 9vw; top: 84px; z-index: 2; width: 24vw; margin: 0; transform: translate3d(0, calc(var(--p) * 120px), 0); }
.an-mast-img-in { aspect-ratio: 3 / 4; overflow: hidden; background: var(--an-studio); }
.an-mast-img-in .an-scene { transform: scale(calc(1.12 + var(--p) * 0.12)); transform-origin: 50% 30%; }
.an-mast-img figcaption { margin-top: 10px; font: 500 11px/1.4 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--an-grey); }
.an-word { grid-row: 3; position: relative; z-index: 3; mix-blend-mode: difference; color: #FFFFFF; display: flex; flex-direction: column; font: 700 22.6vw/0.78 var(--an-cond); font-stretch: condensed; letter-spacing: -0.02em; text-transform: uppercase; margin: 0; }
.an-word-line { display: flex; width: max-content; white-space: nowrap; }
.an-word-line-2 { justify-content: flex-start; padding-left: 0; }
.an-ch { display: inline-block; overflow: hidden; padding: 0.04em 0 0.02em; margin: -0.04em 0 -0.02em; transform: translate3d(0, calc(var(--p) * var(--dy) * 1px), 0) rotate(calc(var(--p) * var(--rot) * 1deg)); will-change: transform; }
.an-ch > span { display: inline-block; animation: an-rise 1.1s var(--fd-ease-out) both; animation-delay: calc(var(--i) * 45ms + 120ms); }
@keyframes an-rise { from { transform: translateY(102%); } to { transform: none; } }
.an-mast-foot { grid-row: 4; position: relative; z-index: 3; display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--an-ink); }
.an-mast-foot p { max-width: 420px; font: 400 16px/1.5 var(--an-sans); color: var(--an-graphite); }

/* STATEMENT */
.an-statement { display: grid; grid-template-columns: 1fr 3fr; gap: var(--an-gut); padding: 160px var(--an-gut) 180px; }
.an-statement-n { font: 500 12px/1.6 var(--an-sans); letter-spacing: 0.08em; color: var(--an-grey); }
.an-statement-t { font: 400 clamp(28px, 3.4vw, 52px)/1.12 var(--an-sans); letter-spacing: -0.03em; color: var(--an-ink); text-indent: 12%; }
.an-statement-t em { font-style: italic; }
.an-inline-img { display: inline-block; width: 1.9em; height: 0.82em; margin: 0 0.12em; vertical-align: -0.06em; overflow: hidden; border-radius: 9999px; background: #2E2E2E; }
.an-inline-img .an-scene { width: 100%; height: 100%; }

/* REVEALS */
.an-js [data-an-rv] { opacity: 0; transform: translate3d(0, 32px, 0); transition: opacity 900ms var(--fd-ease-out), transform 1s var(--fd-ease-out); transition-delay: var(--d, 0ms); }
.an-js [data-an-rv].is-in { opacity: 1; transform: none; }

/* LOOKBOOK */
.an-look { position: relative; background: var(--an-paper); --e: 1; }
.an-look.is-zoom { height: 320vh; height: 320svh; --e: 0; }
.an-look-stage { position: relative; padding: 80px var(--an-gut); }
.an-look.is-zoom .an-look-stage { position: sticky; top: 0; height: 100vh; height: 100svh; padding: 0 var(--an-gut); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.an-look-head { position: relative; z-index: 3; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 32px; font: 500 12px/1.4 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--an-grey); }
.an-look.is-zoom .an-look-head { position: absolute; left: var(--an-gut); right: var(--an-gut); top: 72px; margin: 0; opacity: calc((var(--e) - 0.75) * 4); transform: translate3d(0, calc((1 - var(--e)) * 30px), 0); }
.an-look-grid { position: relative; display: grid; grid-template-columns: repeat(12, 1fr); grid-template-rows: repeat(6, minmax(0, 1fr)); gap: 14px; width: 100%; max-width: 1400px; height: min(66vh, 640px); will-change: transform; }
.an-tile { position: relative; margin: 0; transform: translate3d(0, calc((1 - var(--e)) * var(--k) * 1px), 0); }
.an-tile-img { width: 100%; height: 100%; overflow: hidden; background: var(--an-studio); }
.an-tile-cap { position: absolute; left: 0; bottom: -22px; font: 500 11px/1.4 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--an-grey); white-space: nowrap; opacity: calc((var(--e) - 0.8) * 5); }
.an-tile-0 { grid-column: 1 / 3; grid-row: 1 / 4; }
.an-tile-1 { grid-column: 1 / 4; grid-row: 4 / 7; }
.an-tile-2 { grid-column: 3 / 5; grid-row: 1 / 4; }
.an-tile-3 { grid-column: 5 / 9; grid-row: 2 / 6; }
.an-tile-4 { grid-column: 9 / 11; grid-row: 1 / 4; }
.an-tile-5 { grid-column: 11 / 13; grid-row: 1 / 5; }
.an-tile-6 { grid-column: 9 / 11; grid-row: 4 / 7; }
.an-tile-1, .an-tile-6 { margin-top: 18px; }
.an-look-over { position: absolute; z-index: 2; left: 50%; top: 50%; font: 700 15vw/0.8 var(--an-cond); font-stretch: condensed; text-transform: uppercase; letter-spacing: -0.02em; color: #FFFFFF; mix-blend-mode: difference; pointer-events: none; white-space: nowrap; transform: translate3d(-50%, -50%, 0) scale(calc(1 + (1 - var(--e)) * 0.25)); opacity: calc(1 - var(--e) * 2.4); }
.an-look:not(.is-zoom) .an-look-over { display: none; }

/* SHOP */
.an-shop { padding: 140px var(--an-gut) 120px; background: var(--an-white); }
.an-shop-head { display: grid; grid-template-columns: 1.4fr 1fr auto; align-items: end; gap: var(--an-gut); margin-bottom: 72px; }
.an-shop-head p { max-width: 380px; font: 400 15px/1.55 var(--an-sans); color: var(--an-graphite); }
.an-grid { display: grid; grid-template-columns: repeat(12, 1fr); column-gap: var(--an-gut); row-gap: 72px; align-items: start; }
.an-p-a { grid-column: 1 / 6; }
.an-p-b { grid-column: 7 / 10; margin-top: 160px; }
.an-p-c { grid-column: 10 / 13; margin-top: 40px; }
.an-p-d { grid-column: 2 / 5; }
.an-p-e { grid-column: 6 / 9; margin-top: 120px; }
.an-p-f { grid-column: 9 / 13; margin-top: -60px; }
.an-card-media { position: relative; overflow: hidden; background: var(--an-studio); cursor: none; }
.an-card-img { display: block; aspect-ratio: 4 / 5; overflow: hidden; }
.an-card-img .an-shot { transition: transform 1.2s var(--fd-ease-out); }
.an-card-media:hover .an-card-img .an-shot { transform: scale(1.04); }
.an-tag { position: absolute; left: 14px; top: 14px; padding: 6px 10px; background: var(--an-white); font: 500 11px/1 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--an-ink); }
.an-card-info { display: flex; justify-content: space-between; gap: 16px; margin-top: 14px; }
.an-card-name { font: 500 14px/1.35 var(--an-sans); letter-spacing: 0.04em; text-transform: uppercase; color: var(--an-ink); }
.an-card-fab { margin-top: 3px; font: 400 13px/1.4 var(--an-sans); color: var(--an-grey); }
.an-card-col { display: inline-block; animation: an-fadein var(--fd-dur-3) var(--fd-ease-out); }
.an-card-price { font: 500 14px/1.35 var(--an-sans); color: var(--an-ink); font-variant-numeric: tabular-nums; }
.an-sw { display: flex; gap: 4px; margin-top: 8px; margin-left: -8px; }
.an-sw button { position: relative; width: 36px; height: 36px; border-radius: 50%; }
.an-sw button::before { content: ""; position: absolute; inset: 10px; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 1px rgba(14, 14, 14, 0.18); transition: inset var(--fd-dur-2) var(--fd-spring); }
.an-sw button::after { content: ""; position: absolute; inset: 6px; border-radius: 50%; box-shadow: 0 0 0 1px var(--an-ink); opacity: 0; transform: scale(0.7); transition: opacity var(--fd-dur-2) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-spring); }
.an-sw button.is-on::after { opacity: 1; transform: none; }
.an-sw button:hover::before { inset: 9px; }
@keyframes an-fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

/* Quick add morph */
.an-qa { position: absolute; left: 12px; right: 12px; bottom: 12px; height: 48px; display: flex; align-items: stretch; background: var(--an-white); clip-path: inset(0 calc(100% - 132px) 0 0); transform: translateY(8px); opacity: 0; transition: clip-path var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-ease-out), opacity var(--fd-dur-2) var(--fd-ease-out), background-color var(--fd-dur-3) var(--fd-ease-out); }
.an-card-media:hover .an-qa, .an-qa:focus-within, .an-qa.is-pick, .an-qa.is-added { opacity: 1; transform: none; }
.an-qa.is-pick { clip-path: inset(0 0 0 0); }
.an-qa.is-added { clip-path: inset(0 calc(100% - 132px) 0 0); background: var(--an-ink); color: #FFFFFF; }
.an-qa-main { flex: none; display: flex; align-items: center; gap: 10px; width: 132px; padding: 0 16px; font: 500 12px/1 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: inherit; }
.an-qa-main:disabled { cursor: default; }
.an-qa-plus { position: relative; width: 12px; height: 12px; flex: none; transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.an-qa-plus::before, .an-qa-plus::after { content: ""; position: absolute; left: 0; top: 5.25px; width: 12px; height: 1.5px; background: currentColor; transition: transform var(--fd-dur-3) var(--fd-ease-out), width var(--fd-dur-3) var(--fd-ease-out); }
.an-qa-plus::after { transform: rotate(90deg); }
.an-qa.is-pick .an-qa-plus { transform: rotate(45deg); }
.an-qa.is-added .an-qa-plus { transform: rotate(-45deg) translate(1px, -1px); }
.an-qa.is-added .an-qa-plus::before { width: 6px; top: 8px; left: 0; transform: rotate(90deg) translateX(-3px); transform-origin: left; }
.an-qa.is-added .an-qa-plus::after { width: 12px; top: 8px; transform: none; }
.an-qa-sizes { flex: 1; display: grid; grid-template-columns: repeat(5, 1fr); border-left: 1px solid var(--an-line); }
.an-qa-sizes button { font: 500 12px/1 var(--an-sans); letter-spacing: 0.06em; color: var(--an-ink); text-align: center; opacity: 0; transform: translateX(-8px); transition: opacity var(--fd-dur-2) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-ease-out), background-color var(--fd-dur-1) var(--fd-ease-out); }
.an-qa.is-pick .an-qa-sizes button { opacity: 1; transform: none; }
.an-qa.is-pick .an-qa-sizes button:nth-child(2) { transition-delay: 30ms; }
.an-qa.is-pick .an-qa-sizes button:nth-child(3) { transition-delay: 60ms; }
.an-qa.is-pick .an-qa-sizes button:nth-child(4) { transition-delay: 90ms; }
.an-qa.is-pick .an-qa-sizes button:nth-child(5) { transition-delay: 120ms; }
.an-qa-sizes button:hover:not(:disabled) { background: var(--an-paper); }
.an-qa-sizes button:disabled { color: #8D8B86; text-decoration: line-through; }

/* PRESS */
.an-press { padding: 56px 0; background: var(--an-ink); color: #F2F1EE; overflow: hidden; }
.an-marquee-track { display: flex; width: max-content; animation: an-marq 60s linear infinite; }
.an-press:hover .an-marquee-track { animation-play-state: paused; }
.an-marquee-set { display: flex; }
.an-marquee-set li { display: flex; align-items: baseline; gap: 18px; padding-right: 18px; white-space: nowrap; }
.an-marquee-set blockquote { font: 700 clamp(40px, 5vw, 72px)/1 var(--an-cond); font-stretch: condensed; letter-spacing: -0.01em; text-transform: uppercase; }
.an-marquee-set cite { font: 500 12px/1 var(--an-sans); letter-spacing: 0.1em; text-transform: uppercase; color: #B9B7B2; }
.an-star { font: 400 36px/1 var(--an-sans); color: #8C8A85; margin-left: 40px; }
@keyframes an-marq { to { transform: translateX(-50%); } }

/* FEATURE */
.an-feature { display: grid; grid-template-columns: 7fr 5fr; gap: var(--an-gut); padding: 140px var(--an-gut); background: var(--an-paper); }
.an-feature-media { position: sticky; top: 76px; align-self: start; cursor: none; }
.an-feature-img { aspect-ratio: 4 / 5; overflow: hidden; background: var(--an-studio); max-height: calc(100vh - 100px); margin: 0 auto; }
.an-hot { position: absolute; z-index: 2; display: grid; place-items: center; width: 44px; height: 44px; margin: -22px 0 0 -22px; cursor: pointer; }
.an-hot span { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: #FFFFFF; color: var(--an-ink); font: 500 12px/1 var(--an-sans); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.6); animation: an-ping 2.4s var(--fd-ease-out) infinite; }
@keyframes an-ping { 0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.6); } 80%, 100% { box-shadow: 0 0 0 14px rgba(255, 255, 255, 0); } }
.an-hot em { position: absolute; left: 50%; bottom: calc(100% + 4px); width: 220px; padding: 10px 12px; background: #FFFFFF; color: var(--an-ink); font: 400 13px/1.4 var(--an-sans); text-align: left; opacity: 0; transform: translate(-50%, 6px); pointer-events: none; transition: opacity var(--fd-dur-2) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-ease-out); }
.an-hot:hover em, .an-hot:focus-visible em { opacity: 1; transform: translate(-50%, 0); }
.an-feature-text { padding: 40px 0 0 4vw; }
.an-feature-text .an-h2 { margin: 20px 0 32px; }
.an-feature-text .an-body { max-width: 460px; }
.an-specs { margin-top: 48px; border-top: 1px solid var(--an-ink); }
.an-specs div { display: grid; grid-template-columns: 110px 1fr; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--an-line); }
.an-specs dt { font: 500 12px/1.5 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--an-grey); }
.an-specs dd { font: 400 15px/1.5 var(--an-sans); color: var(--an-ink); }
.an-feature-cta { display: flex; align-items: center; gap: 28px; margin-top: 40px; }

/* MATERIALS */
.an-mat { padding: 140px var(--an-gut); background: var(--an-white); }
.an-mat-head { display: grid; grid-template-columns: 1fr 2fr; gap: var(--an-gut); margin-bottom: 64px; }
.an-mat-head .an-h2 { max-width: 14ch; }
.an-mat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--an-gut); }
.an-mat-sw { aspect-ratio: 1; overflow: hidden; background: var(--an-studio); }
.an-tx { display: block; width: 100%; height: 100%; transition: transform 1.2s var(--fd-ease-out); }
.an-mat-card:hover .an-tx { transform: scale(1.5); }
.an-tx-hb { background-color: #3A3A3A; }
.an-tx-hb { background-image: linear-gradient(90deg, transparent 50%, rgba(0,0,0,.06) 50%), repeating-linear-gradient(45deg, rgba(255,255,255,.1) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, rgba(255,255,255,.1) 0 2px, transparent 2px 6px); background-size: 28px 100%, 28px 28px, 28px 28px; }
.an-tx-knit { background-color: #E6E0D3; background-image: radial-gradient(ellipse 5px 9px at 50% 50%, rgba(0,0,0,.14) 60%, transparent 62%), radial-gradient(ellipse 5px 9px at 50% 50%, rgba(255,255,255,.5) 40%, transparent 42%); background-size: 12px 14px, 12px 14px; background-position: 0 0, 6px 7px; }
.an-tx-boucle { background-color: #C9C9C6; background-image: radial-gradient(circle at 30% 30%, rgba(255,255,255,.7) 0 2px, transparent 3px), radial-gradient(circle at 70% 60%, rgba(0,0,0,.18) 0 3px, transparent 4px), radial-gradient(circle at 50% 80%, rgba(255,255,255,.5) 0 2.5px, transparent 3.5px), radial-gradient(circle at 20% 70%, rgba(0,0,0,.12) 0 2px, transparent 3px); background-size: 11px 11px, 13px 13px, 9px 9px, 15px 15px; }
.an-tx-poplin { background-color: #F1EEE7; background-image: repeating-linear-gradient(0deg, rgba(0,0,0,.05) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.04) 0 1px, transparent 1px 3px), linear-gradient(120deg, rgba(255,255,255,.6), rgba(0,0,0,.06)); }
.an-mat-name { margin-top: 18px; font: 500 14px/1.35 var(--an-sans); letter-spacing: 0.04em; text-transform: uppercase; color: var(--an-ink); }
.an-mat-from { margin-top: 4px; font: 400 14px/1.4 var(--an-sans); color: var(--an-graphite); }
.an-mat-spec { margin-top: 2px; font: 400 13px/1.4 var(--an-sans); color: var(--an-grey); }

/* JOURNAL */
.an-journal { padding: 140px var(--an-gut); background: var(--an-paper); }
.an-journal-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 56px; }
.an-journal-grid { display: grid; grid-template-columns: 5fr 3fr 4fr; gap: var(--an-gut); align-items: start; }
.an-story:nth-child(2) { margin-top: 120px; }
.an-story:nth-child(3) { margin-top: 40px; }
.an-story a { display: block; color: var(--an-ink); }
.an-story-img { aspect-ratio: 4 / 5; overflow: hidden; background: var(--an-studio); }
.an-story:first-child .an-story-img { aspect-ratio: 5 / 4; }
.an-story-img .an-scene { transition: transform 1.2s var(--fd-ease-out); }
.an-story a:hover .an-story-img .an-scene { transform: scale(1.05); }
.an-story-date { margin-top: 16px; font: 500 12px/1.4 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--an-grey); }
.an-story-t { margin-top: 8px; font: 400 22px/1.25 var(--an-sans); letter-spacing: -0.02em; color: var(--an-ink); max-width: 30ch; }
.an-story a:hover .an-story-t { text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 1px; }

/* FOOTER */
.an-foot { padding: 96px var(--an-gut) 28px; background: var(--an-ink); color: #EDEDEA; overflow: hidden; }
.an-foot-top { display: grid; grid-template-columns: 5fr 7fr; gap: 64px; }
.an-news-t { font: 700 44px/0.9 var(--an-cond); font-stretch: condensed; text-transform: uppercase; color: #FFFFFF; }
.an-news-s { margin-top: 14px; max-width: 420px; font: 400 15px/1.55 var(--an-sans); color: #BDBBB6; }
.an-news-l { display: block; margin-top: 28px; font: 500 12px/1 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: #BDBBB6; }
.an-news-row { display: flex; margin-top: 10px; border-bottom: 1px solid #EDEDEA; }
.an-news-row input { flex: 1; height: 52px; font: 400 18px/1 var(--an-sans); color: #FFFFFF; outline: none; }
.an-news-row input::placeholder { color: #8C8A85; }
.an-news-row button { padding: 0 4px 0 16px; font: 500 12px/1 var(--an-sans); letter-spacing: 0.1em; text-transform: uppercase; color: #FFFFFF; min-height: 52px; }
.an-news-row:focus-within { border-bottom-color: #FFFFFF; box-shadow: 0 1px 0 #FFFFFF; }
.an-news-note { margin-top: 10px; font: 400 12px/1.5 var(--an-sans); color: #A7A5A0; }
.an-foot-cols { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--an-gut); }
.an-foot-h { margin-bottom: 14px; font: 500 12px/1 var(--an-sans); letter-spacing: 0.08em; text-transform: uppercase; color: #A7A5A0; }
.an-foot-cols li { margin-bottom: 8px; font: 400 14px/1.45 var(--an-sans); color: #EDEDEA; }
.an-foot-cols a:hover { text-decoration: underline; text-underline-offset: 3px; }
.an-foot-word { margin: 96px -0.02em 0; font: 700 16.2vw/0.78 var(--an-cond); font-stretch: condensed; letter-spacing: -0.02em; color: #FFFFFF; white-space: nowrap; text-align: center; }
.an-foot-legal { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; margin-top: 28px; padding-top: 18px; border-top: 1px solid rgba(237, 237, 234, 0.2); font: 400 12px/1.5 var(--an-sans); color: #A7A5A0; }
.an-foot-legal span:last-child { display: flex; flex-wrap: wrap; gap: 18px; }
.an-foot-legal a:hover { color: #FFFFFF; }

/* DRAWER */
.an-scrim { position: fixed; inset: 0; z-index: 95; background: rgba(14, 14, 14, 0.4); opacity: 0; pointer-events: none; transition: opacity var(--fd-dur-3) var(--fd-ease-out); }
.an-scrim.is-on { opacity: 1; pointer-events: auto; }
.an-drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 100; display: flex; flex-direction: column; width: min(440px, 100vw); background: var(--an-white); box-shadow: -30px 0 60px -30px rgba(0, 0, 0, 0.35); will-change: transform; visibility: hidden; transition: visibility 0s linear 600ms; }
.an-drawer.is-open { visibility: visible; transition: none; }
.an-drawer-head { display: flex; align-items: center; justify-content: space-between; height: 72px; padding: 0 var(--an-gut); border-bottom: 1px solid var(--an-line); }
.an-drawer-t { font: 700 32px/1 var(--an-cond); font-stretch: condensed; text-transform: uppercase; color: var(--an-ink); }
.an-drawer-t span { color: var(--an-grey); }
.an-x { position: relative; width: 44px; height: 44px; margin-right: -10px; }
.an-x span { position: absolute; left: 12px; right: 12px; top: 21px; height: 1.5px; background: var(--an-ink); transform: rotate(45deg); }
.an-x span:last-child { transform: rotate(-45deg); }
.an-ship { padding: 16px var(--an-gut); border-bottom: 1px solid var(--an-line); font: 400 13px/1.4 var(--an-sans); color: var(--an-graphite); }
.an-ship-bar { position: relative; display: block; height: 2px; margin-top: 10px; background: var(--an-line); }
.an-ship-bar i { position: absolute; inset: 0; background: var(--an-ink); transform-origin: left; transition: transform var(--fd-dur-4) var(--fd-ease-out); }
.an-lines { flex: 1; overflow-y: auto; padding: 8px var(--an-gut); }
.an-empty { padding: 40px 0; font: 400 15px/1.5 var(--an-sans); color: var(--an-grey); }
.an-line { display: grid; grid-template-columns: 84px 1fr auto; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--an-line); animation: an-fadein var(--fd-dur-3) var(--fd-ease-out); }
.an-line-img { aspect-ratio: 4 / 5; overflow: hidden; background: var(--an-studio); }
.an-line-name { font: 500 13px/1.35 var(--an-sans); letter-spacing: 0.04em; text-transform: uppercase; color: var(--an-ink); }
.an-line-meta { margin-top: 4px; font: 400 13px/1.4 var(--an-sans); color: var(--an-grey); }
.an-qty { display: inline-flex; align-items: center; margin-top: 12px; border: 1px solid var(--an-line); }
.an-qty button { width: 36px; height: 36px; font: 400 16px/1 var(--an-sans); color: var(--an-ink); text-align: center; }
.an-qty button:hover { background: var(--an-paper); }
.an-qty span { min-width: 24px; font: 500 13px/1 var(--an-sans); text-align: center; font-variant-numeric: tabular-nums; }
.an-line-price { font: 500 13px/1.35 var(--an-sans); color: var(--an-ink); font-variant-numeric: tabular-nums; }
.an-drawer-foot { padding: 20px var(--an-gut) 24px; border-top: 1px solid var(--an-line); }
.an-sub { display: flex; justify-content: space-between; font: 500 14px/1 var(--an-sans); letter-spacing: 0.06em; text-transform: uppercase; color: var(--an-ink); }
.an-sub-note { margin: 8px 0 16px; font: 400 12px/1.4 var(--an-sans); color: var(--an-grey); }

/* RESPONSIVE */
@media (max-width: 1080px) {
  .an-nav-l a, .an-nav-txt { display: none; }
  .an-burger { display: block; }
  .an-mast-img { width: 32vw; right: 6vw; }
  .an-shop-head { grid-template-columns: 1fr 1fr; }
  .an-shop-head .an-link { grid-column: 2; }
  .an-mat-grid { grid-template-columns: repeat(2, 1fr); row-gap: 40px; }
  .an-foot-top { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .an { --an-gut: 16px; }
  .an-announce { font-size: 11px; }
  .an-nav-in { height: 60px; }
  .an-logo { font-size: 24px; }
  .an-nav.is-small .an-logo { font-size: 20px; }
  .an-mast { min-height: 0; padding-top: 16px; grid-template-rows: auto auto auto auto; }
  .an-mast-meta-r { display: none; }
  .an-mast-img { position: relative; right: auto; top: auto; grid-row: 2; width: 72%; margin: 20px 0 0 auto; transform: translate3d(0, calc(var(--p) * 60px), 0); }
  .an-word { font-size: 25.4vw; margin-top: -18vw; }
  .an-mast-foot { flex-direction: column; align-items: flex-start; gap: 18px; }
  .an-mast-foot .an-btn { width: 100%; }
  .an-statement { grid-template-columns: 1fr; padding: 96px var(--an-gut); }
  .an-statement-t { text-indent: 0; font-size: 28px; }
  .an-look-stage { padding: 72px var(--an-gut); }
  .an-look-head { flex-direction: column; align-items: flex-start; gap: 8px; }
  .an-look-grid { grid-template-columns: repeat(2, 1fr); grid-template-rows: none; grid-auto-rows: 200px; height: auto; gap: 10px; }
  .an-tile { grid-column: auto !important; grid-row: auto !important; margin: 0 !important; transform: none; }
  .an-tile-3 { grid-column: 1 / -1 !important; grid-row: span 2 !important; order: -1; }
  .an-tile-cap { position: static; margin-top: 6px; opacity: 1; }
  .an-look-grid { row-gap: 34px; }
  .an-shop { padding: 96px var(--an-gut); }
  .an-shop-head { grid-template-columns: 1fr; gap: 16px; margin-bottom: 48px; }
  .an-shop-head .an-link { grid-column: auto; }
  .an-grid { grid-template-columns: 1fr 1fr; column-gap: 10px; row-gap: 40px; }
  .an-card { grid-column: auto !important; margin-top: 0 !important; }
  .an-p-a, .an-p-f { grid-column: 1 / -1 !important; }
  .an-card-name { font-size: 12px; }
  .an-card-fab { font-size: 12px; }
  .an-card-info { flex-direction: column; gap: 4px; }
  .an-qa { opacity: 1; transform: none; left: 8px; right: 8px; bottom: 8px; height: 44px; clip-path: inset(0 calc(100% - 44px) 0 0); }
  .an-qa-main { width: 44px; padding: 0 16px; }
  .an-qa-txt { display: none; }
  .an-qa.is-pick { clip-path: inset(0 0 0 0); height: auto; flex-wrap: wrap; }
  .an-qa.is-pick .an-qa-sizes { flex-basis: 100%; grid-template-columns: repeat(3, 1fr); border-left: 0; border-top: 1px solid var(--an-line); }
  .an-qa.is-pick .an-qa-sizes button { min-height: 44px; }
  .an-qa.is-added { clip-path: inset(0 calc(100% - 44px) 0 0); }
  .an-mast-img figcaption { display: none; }
  .an-journal-head .an-link { white-space: nowrap; }
  .an-card-media { cursor: auto; }
  .an-feature { grid-template-columns: 1fr; padding: 96px var(--an-gut); }
  .an-feature-media { position: relative; top: auto; }
  .an-feature-text { padding: 32px 0 0; }
  .an-feature-cta { flex-direction: column; align-items: stretch; gap: 8px; }
  .an-hot em { width: 180px; }
  .an-mat { padding: 96px var(--an-gut); }
  .an-mat-head { grid-template-columns: 1fr; gap: 16px; margin-bottom: 40px; }
  .an-mat-grid { gap: 10px; row-gap: 32px; }
  .an-journal { padding: 96px var(--an-gut); }
  .an-journal-grid { grid-template-columns: 1fr; gap: 40px; }
  .an-story:nth-child(n) { margin-top: 0; }
  .an-story-t { font-size: 20px; }
  .an-foot { padding-top: 72px; }
  .an-foot-cols { grid-template-columns: 1fr 1fr; row-gap: 32px; }
  .an-foot-word { margin-top: 64px; }
  .an-specs div { grid-template-columns: 90px 1fr; }
}
@media (hover: none) {
  .an-cursor { display: none; }
  .an-card-media, .an-feature-media { cursor: auto; }
  .an-qa { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .an *, .an *::before, .an *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; animation-delay: 0ms !important; transition-duration: 120ms !important; transition-delay: 0ms !important; }
  .an-ch, .an-mast-img, .an-mast-img-in .an-scene, .an-tile { transform: none !important; }
  .an-js [data-an-rv] { transform: none; }
  .an-marquee-track { animation: none !important; width: auto; }
  .an-marquee-set[aria-hidden="true"] { display: none; }
  .an-marquee-set { flex-direction: column; gap: 24px; padding: 0 var(--an-gut); }
  .an-marquee-set li { white-space: normal; flex-wrap: wrap; }
  .an-star { display: none; }
}
@media (prefers-contrast: more) {
  .an-nav.is-small .an-nav-in { background: var(--an-paper); -webkit-backdrop-filter: none; backdrop-filter: none; border-bottom-color: var(--an-ink); }
  .an-grain::after { display: none; }
}
@media (prefers-reduced-transparency: reduce) {
  .an-nav.is-small .an-nav-in { background: var(--an-paper); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
`;
