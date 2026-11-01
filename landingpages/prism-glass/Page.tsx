/**
 * Prism — AI product-photography landing page with Apple-style Liquid Glass.
 *
 * Product imagery: three real studio photographs in public/img/prism/ —
 * parfum.webp, balm.webp, tube.webp (each with a -480 variant), grey seamless
 * backdrop, soft light, reflective floor. Every "campaign variation" on the
 * page is the same three photos re-lit and re-cropped with CSS only (blend-mode
 * tints, filters, object-position + scale), so there are no other image files.
 * Copy them next to your page or swap in your own photos of the same style.
 *
 * A complete, self-contained single page: React is the only import and every
 * style lives in the <style> block at the bottom of this file (classes are
 * prefixed `fd-prs-`). Drop it into any React 18+ project and render <Page />.
 *
 * Liquid Glass: the in-file <Glass> helper renders a frosted surface
 * everywhere and, in Chromium, upgrades to true refraction — a per-element
 * SVG filter (feImage displacement map generated on a canvas from the
 * element's own size and radius, three chromatic displacement passes, slight
 * blur and saturation) applied with `backdrop-filter: url(#id)`. Following
 * Apple's HIG, glass is used only for the control layer that floats above
 * content (nav, prompt bar, toggles, sliders, carousel buttons) — never for
 * content cards.
 *
 * Motion: drifting mesh backdrop, nav that condenses into a glass capsule,
 * hero lighting cycle over a fan of the three photos, pointer + scroll
 * parallax, draggable refraction lens with spring follow, sticky feature
 * scenes with parallax depth layers, column-parallax gallery, before/after
 * reveal, count-up stats, momentum carousel (drag, fling, spring snap),
 * spring-thumb pricing toggle, staggered reveals.
 *
 * Browser support: evergreen (the photo crops use container query units).
 * Refraction is Chromium-only (frosted fallback elsewhere). Accessibility:
 * landmarks, real buttons/inputs, keyboard carousel, aria-live, reduced-motion
 * / reduced-transparency / more-contrast fallbacks. SSR-safe: nothing touches
 * window during render.
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  version,
  type CSSProperties,
  type ReactNode,
} from "react";


/* ─────────────────────────── helpers ─────────────────────────── */

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (n: number, a: number, b: number) => (n < a ? a : n > b ? b : n);
const clamp01 = (n: number) => clamp(n, 0, 1);

function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.setAttribute("data-js", "");
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (typeof IntersectionObserver === "undefined" || reducedMotion()) {
      items.forEach((i) => i.setAttribute("data-in", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.setAttribute("data-in", "");
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, [root]);
}

function useScrollFrame(ref: React.RefObject<HTMLElement | null>, fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let active = true;
    const run = () => {
      raf = 0;
      if (active) fnRef.current();
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([e]) => {
              active = e.isIntersecting;
              if (active) queue();
            },
            { rootMargin: "200px 0px" },
          )
        : undefined;
    io?.observe(el);
    queue();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}

/* ─────────────────────────── Liquid Glass helper ─────────────────────────── */

function supportsSvgBackdrop() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const chromium = /(Chrome|Chromium)\/\d+/.test(ua) && !/Firefox|FxiOS|CriOS|EdgiOS/.test(ua);
  const transparencyOk = !window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
  return chromium && transparencyOk;
}

/**
 * Displacement map for a rounded rectangle: neutral grey inside, and a convex
 * bezel of width `bezel` whose red/green channels push samples outward along
 * the edge normal (strongest at the rim) — the "liquid" lensing at the edge.
 */
function buildDisplacementMap(w: number, h: number, radius: number, bezel: number) {
  const W = Math.max(2, Math.round(w));
  const H = Math.max(2, Math.round(h));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(W, H);
  const hw = W / 2;
  const hh = H / 2;
  const r = Math.min(radius, hw, hh);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = i + 0.5 - hw;
      const y = j + 0.5 - hh;
      const qx = Math.abs(x) - (hw - r);
      const qy = Math.abs(y) - (hh - r);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const sd = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
      const d = -sd;
      let nx = 0;
      let ny = 0;
      let mag = 0;
      if (d > 0 && d < bezel) {
        if (qx > 0 && qy > 0) {
          const l = Math.hypot(qx, qy) || 1;
          nx = (qx / l) * Math.sign(x);
          ny = (qy / l) * Math.sign(y);
        } else if (qx > qy) nx = Math.sign(x);
        else ny = Math.sign(y);
        const t = d / bezel;
        mag = Math.pow(1 - t, 2.4);
      }
      const k = (j * W + i) * 4;
      img.data[k] = 128 + nx * mag * 127;
      img.data[k + 1] = 128 + ny * mag * 127;
      img.data[k + 2] = 128;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

type GlassProps = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Corner radius in px used for the displacement map (match your CSS). Use a big number for capsules/circles. */
  radius?: number;
  /** Width of the refracting rim in px. */
  bezel?: number;
  /** Displacement strength in px. */
  strength?: number;
  /** Set false for frosted-only glass (e.g. surfaces that change size via clip-path). */
  refract?: boolean;
  /** Receives the glass element (for callers that animate it). */
  glassRef?: React.MutableRefObject<HTMLDivElement | null>;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "className" | "children">;

function Glass({ className = "", style, children, radius = 9999, bezel = 18, strength = 48, refract = true, glassRef, ...rest }: GlassProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node;
      if (glassRef) glassRef.current = node;
    },
    [glassRef],
  );
  const rawId = useId();
  const id = `fd-prs-g${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [map, setMap] = useState<{ w: number; h: number; url: string } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !refract || !supportsSvgBackdrop()) return;
    let raf = 0;
    let last = "";
    const build = () => {
      raf = 0;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const key = `${w}x${h}`;
      if (!w || !h || key === last) return;
      last = key;
      setMap({ w, h, url: buildDisplacementMap(w, h, Math.min(radius, h / 2, w / 2), Math.min(bezel, h / 2, w / 2)) });
    };
    const ro = new ResizeObserver(() => {
      if (!raf) raf = requestAnimationFrame(build);
    });
    ro.observe(el);
    build();
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [refract, radius, bezel]);

  const on = !!map?.url;
  return (
    <div
      ref={setRef}
      className={`fd-prs-glass ${className}`}
      data-refract={on || undefined}
      style={on ? { ...style, backdropFilter: `url(#${id})`, WebkitBackdropFilter: `url(#${id})` } : style}
      {...rest}
    >
      {on && map && (
        <svg className="fd-prs-glass-svg" width="0" height="0" aria-hidden="true" focusable="false">
          <filter id={id} x="0" y="0" width={map.w} height={map.h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map.url} x="0" y="0" width={map.w} height={map.h} preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={strength} xChannelSelector="R" yChannelSelector="G" result="dr" />
            <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={strength * 0.93} xChannelSelector="R" yChannelSelector="G" result="dg" />
            <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={strength * 0.86} xChannelSelector="R" yChannelSelector="G" result="db" />
            <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feBlend in="r" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="b" mode="screen" result="rgb" />
            <feGaussianBlur in="rgb" stdDeviation="0.7" result="soft" />
            <feColorMatrix in="soft" type="saturate" values="1.45" />
          </filter>
        </svg>
      )}
      {children}
    </div>
  );
}

/* ─────────────────────────── product photography ─────────────────────────── */

// React 19 knows `fetchPriority`; React 18 only passes the lowercase DOM attribute through.
const FETCH_PRIORITY = Number.parseInt(version, 10) >= 19 ? "fetchPriority" : "fetchpriority";

type ProductId = "parfum" | "balm" | "tube";

const PRODUCTS: Record<ProductId, { name: string; w: number; h: number; w480: number; alt: string }> = {
  parfum: { name: "Eau de Parfum Nº4", w: 570, h: 818, w480: 480, alt: "Prism Eau de Parfum Nº4: an amber glass bottle with a brushed-silver cap on a grey studio backdrop" },
  balm: { name: "Fieldnote Balm", w: 568, h: 818, w480: 480, alt: "Prism Fieldnote Balm: a frosted blue glass jar with a navy lid on a grey studio backdrop" },
  tube: { name: "SPF 30", w: 568, h: 818, w480: 480, alt: "Prism SPF 30: a teal squeeze tube with a dark green cap on a grey studio backdrop" },
};

/**
 * A grade is pure CSS over the untouched photo: `bg` is blended over the whole
 * frame (the grey seamless takes the tint, white labels stay white), `all` is a
 * second soft pass, `f` is a filter on the photo itself and lx/ly place the
 * key-light highlight.
 */
type Grade = { name: string; dot: string; bg: string; bgo: number; bgm: string; all: string; allo: number; allm: string; f: string; lx: string; ly: string };

const GRADES = {
  natural: { name: "Original", dot: "#8b8b97", bg: "#ffffff", bgo: 0, bgm: "overlay", all: "#ffffff", allo: 0, allm: "soft-light", f: "none", lx: "30%", ly: "16%" },
  golden: { name: "Golden hour", dot: "#e8862a", bg: "#ffcf9f", bgo: 0.6, bgm: "overlay", all: "#ff9a3c", allo: 0.18, allm: "soft-light", f: "saturate(1.04)", lx: "16%", ly: "14%" },
  north: { name: "North-light studio", dot: "#5b8dff", bg: "#cfe0ff", bgo: 0.55, bgm: "overlay", all: "#7fa8ff", allo: 0.12, allm: "soft-light", f: "none", lx: "82%", ly: "12%" },
  dusk: { name: "Neon dusk", dot: "#ff4f86", bg: "#e6b0ff", bgo: 0.6, bgm: "overlay", all: "#ff3d8b", allo: 0.16, allm: "soft-light", f: "none", lx: "86%", ly: "30%" },
  green: { name: "Greenhouse", dot: "#1fae7c", bg: "#bff0d6", bgo: 0.6, bgm: "overlay", all: "#2fbf8a", allo: 0.14, allm: "soft-light", f: "none", lx: "50%", ly: "4%" },
  rose: { name: "Rose studio", dot: "#ff7fa8", bg: "#ffd1e0", bgo: 0.6, bgm: "overlay", all: "#ff8fb4", allo: 0.14, allm: "soft-light", f: "none", lx: "24%", ly: "20%" },
  ink: { name: "Night edit", dot: "#3d4470", bg: "#2b3150", bgo: 0.8, bgm: "overlay", all: "#6b7bff", allo: 0.1, allm: "soft-light", f: "contrast(1.04)", lx: "70%", ly: "18%" },
  mono: { name: "Mono", dot: "#16161d", bg: "#ffffff", bgo: 0, bgm: "overlay", all: "#ffffff", allo: 0, allm: "soft-light", f: "grayscale(1) contrast(1.1)", lx: "30%", ly: "16%" },
  duo: { name: "Duotone", dot: "#5b3df5", bg: "#ffb3d1", bgo: 0.55, bgm: "overlay", all: "#5b3df5", allo: 0.8, allm: "color", f: "grayscale(1) contrast(1.06)", lx: "30%", ly: "16%" },
} satisfies Record<string, Grade>;

type GradeKey = keyof typeof GRADES;

/** Where the photo sits in its frame: ox/oy = object-position (0-1), fx/fy = zoom focus (0-1), z = zoom (>= 1). */
type Crop = { ox?: number; oy?: number; fx?: number; fy?: number; z?: number };

function Pic({
  id,
  grade = "natural",
  crop,
  className = "",
  eager = false,
  sizes = "(max-width: 700px) 90vw, 560px",
  alt,
  children,
}: {
  id: ProductId;
  grade?: GradeKey;
  crop?: Crop;
  className?: string;
  eager?: boolean;
  sizes?: string;
  alt?: string;
  children?: ReactNode;
}) {
  const p = PRODUCTS[id];
  const g: Grade = GRADES[grade];
  const c = crop ?? {};
  const style = {
    "--bg": g.bg,
    "--bgo": g.bgo,
    "--bgm": g.bgm,
    "--all": g.all,
    "--allo": g.allo,
    "--allm": g.allm,
    "--f": g.f,
    "--lx": g.lx,
    "--ly": g.ly,
    "--ox": c.ox ?? 0.5,
    "--oy": c.oy ?? 0.5,
    "--fx": c.fx ?? 0.5,
    "--fy": c.fy ?? 0.5,
    "--z": c.z ?? 1,
  } as CSSProperties;
  const priority = eager ? { [FETCH_PRIORITY]: "high" } : {};
  return (
    <div className={`fd-prs-shot ${className}`} style={style}>
      <div className="fd-prs-shot-in">
        <img
          className="fd-prs-shot-img"
          src={`/img/prism/${id}.webp`}
          srcSet={`/img/prism/${id}-480.webp ${p.w480}w, /img/prism/${id}.webp ${p.w}w`}
          sizes={sizes}
          width={p.w}
          height={p.h}
          alt={alt ?? p.alt}
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          {...priority}
        />
      </div>
      <i className="fd-prs-g-bg" aria-hidden="true" />
      <i className="fd-prs-g-all" aria-hidden="true" />
      <i className="fd-prs-g-temp" aria-hidden="true" />
      <i className="fd-prs-g-light" aria-hidden="true" />
      {children}
    </div>
  );
}


/* ─────────────────────────── icons ─────────────────────────── */

function Logo() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="fd-prs-logo">
      <path d="M12 3l9 16H3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 3l-2.5 16M14 12l7 2M14 12l7 4.5" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
    </svg>
  );
}
function Spark() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M8 1.5l1.4 4.1 4.1 1.4-4.1 1.4L8 12.5 6.6 8.4 2.5 7l4.1-1.4z" fill="currentColor" />
    </svg>
  );
}
function Chevron({ dir = "right" }: { dir?: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" style={{ transform: dir === "left" ? "scaleX(-1)" : undefined }}>
      <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Check() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────── backdrop ─────────────────────────── */

function Mesh() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      el.style.setProperty("--m", clamp01(window.scrollY / max).toFixed(4));
    };
    const q = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    q();
    window.addEventListener("scroll", q, { passive: true });
    window.addEventListener("resize", q);
    return () => {
      window.removeEventListener("scroll", q);
      window.removeEventListener("resize", q);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div className="fd-prs-mesh" aria-hidden="true" ref={ref}>
      <i className="fd-prs-blob fd-prs-b1" />
      <i className="fd-prs-blob fd-prs-b2" />
      <i className="fd-prs-blob fd-prs-b3" />
      <i className="fd-prs-blob fd-prs-b4" />
      <i className="fd-prs-blob fd-prs-b5" />
      <i className="fd-prs-grain" />
    </div>
  );
}

/* ─────────────────────────── nav ─────────────────────────── */

const LINKS = [
  ["#lens", "Optics"],
  ["#studio", "Studio"],
  ["#gallery", "Gallery"],
  ["#stories", "Customers"],
  ["#pricing", "Pricing"],
];

function Nav() {
  const [condensed, setCondensed] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setCondensed(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className="fd-prs-nav" data-condensed={condensed || undefined} data-open={open || undefined}>
      <Glass className="fd-prs-nav-glass" refract={false} aria-hidden="true" />
      <div className="fd-prs-nav-in">
        <a href="#top" className="fd-prs-brand" aria-label="Prism home">
          <Logo />
          <span>Prism</span>
        </a>
        <nav className="fd-prs-nav-links" aria-label="Primary">
          {LINKS.map(([h, l]) => (
            <a key={h} href={h}>
              {l}
            </a>
          ))}
        </nav>
        <div className="fd-prs-nav-right">
          <a href="#top" className="fd-prs-nav-signin">
            Sign in
          </a>
          <a href="#pricing" className="fd-prs-btn fd-prs-btn-sm">
            Try free
          </a>
          <button type="button" className="fd-prs-burger" aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
            <span />
            <span />
          </button>
        </div>
      </div>
      <div className="fd-prs-sheet" hidden={!open}>
        {LINKS.map(([h, l]) => (
          <a key={h} href={h} onClick={() => setOpen(false)}>
            {l}
          </a>
        ))}
      </div>
    </header>
  );
}

/* ─────────────────────────── hero ─────────────────────────── */

const ORDER: ProductId[] = ["parfum", "balm", "tube"];

const LIGHTS: { grade: GradeKey; prompt: string; angle: number; lens: number }[] = [
  { grade: "golden", prompt: "Golden hour on travertine, long soft shadow, 50mm", angle: 32, lens: 50 },
  { grade: "north", prompt: "North-light studio, seamless grey, crisp reflections", angle: 38, lens: 85 },
  { grade: "dusk", prompt: "Neon dusk rooftop, magenta rim light, shallow depth", angle: 44, lens: 35 },
  { grade: "green", prompt: "Greenhouse morning, dappled leaves, dew on glass", angle: 50, lens: 50 },
];

function Hero() {
  const [idx, setIdx] = useState(0);
  const [front, setFront] = useState(0);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState(5600);
  const stage = useRef<HTMLDivElement>(null);
  const sec = useRef<HTMLElement>(null);

  const generate = useCallback(() => {
    setBusy(true);
    window.setTimeout(() => {
      setIdx((i) => (i + 1) % LIGHTS.length);
      setBusy(false);
      setValue("");
    }, reducedMotion() ? 0 : 900);
  }, []);

  // Auto-cycle lighting while the user hasn't typed.
  useEffect(() => {
    if (reducedMotion() || value) return;
    const t = window.setInterval(() => {
      if (!document.hidden) setIdx((i) => (i + 1) % LIGHTS.length);
    }, 5200);
    return () => window.clearInterval(t);
  }, [value]);

  // Pointer parallax on the stage layers.
  useEffect(() => {
    const el = stage.current;
    if (!el || reducedMotion()) return;
    let raf = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty("--px", px.toFixed(3));
      el.style.setProperty("--py", py.toFixed(3));
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      px = clamp((e.clientX - (r.left + r.width / 2)) / r.width, -0.5, 0.5);
      py = clamp((e.clientY - (r.top + r.height / 2)) / r.height, -0.5, 0.5);
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const leave = () => {
      px = 0;
      py = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const zone = sec.current ?? el;
    zone.addEventListener("pointermove", move);
    zone.addEventListener("pointerleave", leave);
    return () => {
      zone.removeEventListener("pointermove", move);
      zone.removeEventListener("pointerleave", leave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll: the stage sinks back and the controls drift up at different depths.
  useScrollFrame(sec, () => {
    const el = sec.current;
    if (!el || reducedMotion()) return;
    const r = el.getBoundingClientRect();
    const p = clamp01(-r.top / Math.max(1, r.height));
    el.style.setProperty("--sp", p.toFixed(4));
  });

  const light = LIGHTS[idx];
  const g = GRADES[light.grade];
  return (
    <section className="fd-prs-hero" id="top" ref={sec}>
      <div className="fd-prs-wrap fd-prs-hero-in">
        <div className="fd-prs-hero-copy">
          <p className="fd-prs-kicker fd-prs-in" style={{ "--d": "0ms" } as CSSProperties}>
            Prism 3 · AI product photography
          </p>
          <h1 className="fd-prs-h1">
            <span className="fd-prs-in" style={{ "--d": "80ms" } as CSSProperties}>
              Light,
            </span>{" "}
            <span className="fd-prs-in" style={{ "--d": "170ms" } as CSSProperties}>
              on demand.
            </span>
          </h1>
          <p className="fd-prs-lede fd-prs-in" style={{ "--d": "260ms" } as CSSProperties}>
            Upload one product photo. Prism relights, restages and resizes it into a full campaign — with shadows,
            reflections and refraction that obey real optics.
          </p>
          <form
            className="fd-prs-in fd-prs-prompt-wrap"
            style={{ "--d": "360ms" } as CSSProperties}
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <Glass className="fd-prs-prompt" radius={9999} bezel={16} strength={40}>
              <Spark />
              <label className="fd-prs-sr" htmlFor="fd-prs-prompt-input">
                Describe a scene
              </label>
              <input
                id="fd-prs-prompt-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={light.prompt}
                autoComplete="off"
              />
              <button type="submit" className="fd-prs-btn fd-prs-btn-sm" data-busy={busy || undefined}>
                {busy ? "Rendering…" : "Generate"}
              </button>
            </Glass>
          </form>
          <p className="fd-prs-fine fd-prs-in" style={{ "--d": "440ms" } as CSSProperties}>
            Free for 25 renders · No credit card · Commercial licence included
          </p>
        </div>

        <div
          className="fd-prs-hero-stage fd-prs-in"
          style={{ "--d": "220ms", "--t": ((temp - 5100) / 2400).toFixed(3) } as CSSProperties}
          ref={stage}
        >
          <div className="fd-prs-stage-layer fd-prs-depth-1">
            <div className="fd-prs-fan">
              {ORDER.map((pid, i) => (
                <button
                  key={pid}
                  type="button"
                  className="fd-prs-fan-card"
                  data-pos={(i - front + ORDER.length) % ORDER.length}
                  aria-pressed={i === front}
                  aria-label={`Show ${PRODUCTS[pid].name}`}
                  onClick={() => setFront(i)}
                >
                  <Pic id={pid} grade={light.grade} eager={i === 0} sizes="(max-width: 700px) 60vw, 340px" />
                  <i className="fd-prs-render-sweep" data-busy={busy || undefined} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
          <div className="fd-prs-stage-layer fd-prs-depth-2">
            <Glass className="fd-prs-chip fd-prs-chip-scene" radius={9999} bezel={12} strength={28}>
              <span className="fd-prs-chip-dot" style={{ background: g.dot }} aria-hidden="true" />
              <span aria-live="polite">{g.name}</span>
            </Glass>
          </div>
          <div className="fd-prs-stage-layer fd-prs-depth-3">
            <Glass className="fd-prs-chip fd-prs-chip-temp" radius={22} bezel={14} strength={32}>
              <label htmlFor="fd-prs-temp" className="fd-prs-chip-label">
                <span>Key light</span>
                <b>{temp.toLocaleString("en-US")} K</b>
              </label>
              <input
                id="fd-prs-temp"
                className="fd-prs-slider"
                type="range"
                min={2700}
                max={7500}
                step={100}
                value={temp}
                onChange={(e) => setTemp(Number(e.target.value))}
                style={{ "--v": `${((temp - 2700) / 4800) * 100}%` } as CSSProperties}
              />
            </Glass>
          </div>
          <div className="fd-prs-stage-layer fd-prs-depth-4">
            <Glass className="fd-prs-chip fd-prs-chip-angle" radius={9999} bezel={12} strength={28}>
              <span className="fd-prs-chip-label">
                <span>Angle</span>
                <b>{light.angle}°</b>
              </span>
              <span className="fd-prs-chip-sep" aria-hidden="true" />
              <span className="fd-prs-chip-label">
                <span>Lens</span>
                <b>{light.lens} mm</b>
              </span>
            </Glass>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ─────────────────────────── logos ─────────────────────────── */

function Logos() {
  const names = ["MAISON VALE", "Fieldnote", "otto audio", "Sable & Co", "PALE BLUE", "Hearth", "Kinfolk Eyewear", "Brightside"];
  return (
    <section className="fd-prs-logos" aria-label="Brands using Prism">
      <p className="fd-prs-mini" data-reveal="">
        Shot on Prism by 11,000 brands this season
      </p>
      <div className="fd-prs-marquee">
        <ul>
          {[...names, ...names].map((n, i) => (
            <li key={i} aria-hidden={i >= names.length || undefined} className={`fd-prs-wm-${i % 4}`}>
              {n}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────────── refraction lens ─────────────────────────── */

function Lens() {
  const area = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement | null>(null);
  const [strength, setStrength] = useState(64);
  const [mode, setMode] = useState<"pending" | "refract" | "frost">("pending");

  useEffect(() => {
    setMode(supportsSvgBackdrop() ? "refract" : "frost");
  }, []);

  // Spring-follow drag (k 380, c 30) + idle drift.
  useEffect(() => {
    const a = area.current;
    const l = lens.current;
    if (!a || !l) return;
    const s = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    let dragging = false;
    let touched = false;
    let raf = 0;
    let last = 0;
    let t0 = 0;
    let visible = true;
    const reduced = reducedMotion();
    const place = () => {
      const r = a.getBoundingClientRect();
      s.tx = r.width * 0.5;
      s.ty = r.height * 0.5;
      if (!s.x) {
        s.x = s.tx;
        s.y = s.ty;
      }
    };
    place();
    const step = (now: number) => {
      raf = 0;
      const dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016);
      last = now;
      const r = a.getBoundingClientRect();
      if (!touched && !reduced) {
        t0 += dt;
        s.tx = r.width * (0.5 + 0.28 * Math.sin(t0 * 0.55));
        s.ty = r.height * (0.5 + 0.18 * Math.sin(t0 * 0.9 + 1));
      }
      const k = 380;
      const c = 30;
      s.vx += (k * (s.tx - s.x) - c * s.vx) * dt;
      s.vy += (k * (s.ty - s.y) - c * s.vy) * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const speed = Math.min(1, Math.hypot(s.vx, s.vy) / 1600);
      const ang = Math.atan2(s.vy, s.vx);
      l.style.transform = `translate3d(${(s.x - l.offsetWidth / 2).toFixed(1)}px, ${(s.y - l.offsetHeight / 2).toFixed(1)}px, 0) rotate(${ang}rad) scale(${1 + speed * 0.12}, ${1 - speed * 0.08}) rotate(${-ang}rad)`;
      const settled = touched && !dragging && Math.abs(s.tx - s.x) < 0.2 && Math.abs(s.ty - s.y) < 0.2 && Math.abs(s.vx) < 1 && Math.abs(s.vy) < 1;
      if (visible && !document.hidden && !settled) raf = requestAnimationFrame(step);
      else last = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };
    const toLocal = (e: PointerEvent) => {
      const r = a.getBoundingClientRect();
      s.tx = clamp(e.clientX - r.left, 0, r.width);
      s.ty = clamp(e.clientY - r.top, 0, r.height);
    };
    const down = (e: PointerEvent) => {
      dragging = true;
      touched = true;
      a.setPointerCapture(e.pointerId);
      toLocal(e);
      kick();
    };
    const move = (e: PointerEvent) => {
      if (!dragging && e.pointerType === "touch") return;
      if (!dragging && !touched) touched = true;
      toLocal(e);
      kick();
    };
    const up = () => {
      dragging = false;
    };
    const key = (e: KeyboardEvent) => {
      const d = e.shiftKey ? 40 : 12;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      touched = true;
      const r = a.getBoundingClientRect();
      if (e.key === "ArrowLeft") s.tx = clamp(s.tx - d, 0, r.width);
      if (e.key === "ArrowRight") s.tx = clamp(s.tx + d, 0, r.width);
      if (e.key === "ArrowUp") s.ty = clamp(s.ty - d, 0, r.height);
      if (e.key === "ArrowDown") s.ty = clamp(s.ty + d, 0, r.height);
      kick();
    };
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible) kick();
          })
        : undefined;
    io?.observe(a);
    a.addEventListener("pointerdown", down);
    a.addEventListener("pointermove", move);
    a.addEventListener("pointerup", up);
    a.addEventListener("pointercancel", up);
    l.addEventListener("keydown", key);
    window.addEventListener("resize", place);
    kick();
    return () => {
      io?.disconnect();
      a.removeEventListener("pointerdown", down);
      a.removeEventListener("pointermove", move);
      a.removeEventListener("pointerup", up);
      a.removeEventListener("pointercancel", up);
      l.removeEventListener("keydown", key);
      window.removeEventListener("resize", place);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="fd-prs-sec" id="lens">
      <div className="fd-prs-wrap">
        <div className="fd-prs-head" data-reveal="">
          <p className="fd-prs-kicker">Optics engine</p>
          <h2 className="fd-prs-h2">
            Glass that bends light <span className="fd-prs-mute">the way glass does.</span>
          </h2>
          <p className="fd-prs-p">
            Prism ray-traces every reflective and transparent surface in your shot, so perfume bottles, sunglasses and
            serum droppers come out with honest highlights instead of plastic sheen. Drag the lens to feel it.
          </p>
        </div>
        <div className="fd-prs-lens-stage" ref={area} data-reveal="">
          <div className="fd-prs-lens-bg" aria-hidden="true">
            <div className="fd-prs-lens-stripes" />
            <p className="fd-prs-lens-word">
              Refraction
              <br />
              index 1.52
            </p>
            <div className="fd-prs-lens-grid">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i}>
                  {["Crown glass", "n = 1.52", "Abbe 64.2", "Dispersion", "Caustics", "Fresnel"][i]}
                </span>
              ))}
            </div>
            <div className="fd-prs-lens-shot">
              <Pic id="parfum" grade="north" crop={{ oy: 0.58, fy: 0.6, z: 1.3 }} sizes="(max-width: 720px) 80vw, 390px" />
            </div>
          </div>
          <Glass
            className="fd-prs-lens"
            glassRef={lens}
            radius={9999}
            bezel={46}
            strength={strength}
            tabIndex={0}
            role="img"
            aria-label="Refraction lens. Drag, or focus and use the arrow keys to move it."
          />
          <div className="fd-prs-lens-ctrl">
            <Glass className="fd-prs-chip fd-prs-chip-strength" radius={22} bezel={14} strength={28}>
              <label htmlFor="fd-prs-strength" className="fd-prs-chip-label">
                <span>Refraction</span>
                <b>{strength}</b>
              </label>
              <input
                id="fd-prs-strength"
                className="fd-prs-slider"
                type="range"
                min={0}
                max={120}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                style={{ "--v": `${(strength / 120) * 100}%` } as CSSProperties}
              />
            </Glass>
            <span className="fd-prs-mode" data-mode={mode}>
              {mode === "refract" ? "Live SVG refraction" : mode === "frost" ? "Frosted fallback (this browser)" : "Detecting…"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── sticky studio scenes ─────────────────────────── */

type Scene = { k: string; t: string; d: string; id: ProductId; grade: GradeKey; crop: Crop; clip: string; label: string; az: number; dial: number };

const SCENES: Scene[] = [
  { k: "Relight", t: "Move the sun.", d: "Drag the key light around your product and watch shadows, caustics and reflections follow — no reshoot, no lighting kit.", id: "parfum", grade: "golden", crop: { oy: 0.55 }, clip: "inset(0% 0% 0% 0% round 28px)", label: "1:1 · Shopify PDP", az: 214, dial: -50 },
  { k: "Restage", t: "Change the world around it.", d: "Swap travertine for terrazzo, studio for street. Prism keeps your product pixel-exact and composites the scene around it.", id: "balm", grade: "dusk", crop: { oy: 0.62, z: 1.12, fy: 0.62 }, clip: "inset(0% 10% 0% 10% round 28px)", label: "4:5 · Instagram feed", az: 296, dial: 30 },
  { k: "Resize", t: "Every format, one click.", d: "214 crops for every channel — from a 9:16 story to a 21:9 billboard — each re-composed by the model, not just cropped.", id: "tube", grade: "north", crop: { oy: 0.5, z: 1.05 }, clip: "inset(0% 21% 0% 21% round 28px)", label: "9:16 · Stories & Reels", az: 180, dial: 0 },
];

function Studio() {
  const sec = useRef<HTMLElement>(null);
  const [i, setI] = useState(0);
  const iRef = useRef(0);
  useScrollFrame(sec, () => {
    const el = sec.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const travel = Math.max(1, r.height - window.innerHeight);
    const p = reducedMotion() ? 0.5 : clamp01(-r.top / travel);
    el.style.setProperty("--p", p.toFixed(4));
    const n = Math.min(SCENES.length - 1, Math.floor(p * SCENES.length));
    if (n !== iRef.current) {
      iRef.current = n;
      setI(n);
    }
  });
  const s = SCENES[i];
  const sg = GRADES[s.grade];
  return (
    <section className="fd-prs-studio" id="studio" ref={sec}>
      <div className="fd-prs-studio-stick">
        <div className="fd-prs-wrap fd-prs-studio-grid">
          <div className="fd-prs-studio-copy">
            <p className="fd-prs-kicker">The studio</p>
            <ol className="fd-prs-scene-list">
              {SCENES.map((sc, n) => (
                <li key={sc.k} data-on={n === i || undefined}>
                  <span className="fd-prs-scene-k">
                    0{n + 1} · {sc.k}
                  </span>
                  <h3>{sc.t}</h3>
                  <p>{sc.d}</p>
                </li>
              ))}
            </ol>
            <div className="fd-prs-scene-dots" aria-hidden="true">
              {SCENES.map((sc, n) => (
                <i key={sc.k} data-on={n === i || undefined} />
              ))}
            </div>
          </div>
          <div className="fd-prs-studio-stage" aria-label={`${s.k}: ${s.label}`} role="group">
            <div className="fd-prs-depth" data-depth="-60" style={{ "--depth": -60 } as CSSProperties}>
              <div className="fd-prs-studio-frame" style={{ clipPath: s.clip }}>
                {SCENES.map((sc, n) => (
                  <div key={sc.k} className="fd-prs-stage-shot" data-on={n === i || undefined}>
                    <Pic id={sc.id} grade={sc.grade} crop={sc.crop} sizes="(max-width: 1000px) 90vw, 560px" alt={`${PRODUCTS[sc.id].name} in ${GRADES[sc.grade].name.toLowerCase()} light, ${sc.label}`} />
                  </div>
                ))}
              </div>
            </div>
            <div className="fd-prs-depth fd-prs-studio-c1" style={{ "--depth": 70 } as CSSProperties}>
              <Glass className="fd-prs-chip" radius={9999} bezel={12} strength={26}>
                <span className="fd-prs-chip-dot" style={{ background: sg.dot }} />
                <span>{sg.name}</span>
              </Glass>
            </div>
            <div className="fd-prs-depth fd-prs-studio-c2" style={{ "--depth": 140 } as CSSProperties}>
              <Glass className="fd-prs-chip fd-prs-sun-dial" radius={9999} bezel={16} strength={30}>
                <span className="fd-prs-dial" style={{ "--a": `${s.dial}deg` } as CSSProperties} aria-hidden="true">
                  <i />
                </span>
                <span className="fd-prs-chip-label">
                  <span>Sun azimuth</span>
                  <b>{s.az}°</b>
                </span>
              </Glass>
            </div>
            <div className="fd-prs-depth fd-prs-studio-c3" style={{ "--depth": 110 } as CSSProperties}>
              <Glass className="fd-prs-chip" radius={9999} bezel={12} strength={26}>
                <span className="fd-prs-chip-label">
                  <b>{s.label}</b>
                </span>
              </Glass>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ─────────────────────────── gallery (column parallax) ─────────────────────────── */

const SHOTS: { id: ProductId; grade: GradeKey; crop: Crop; cap: string; tall?: boolean }[] = [
  { id: "parfum", grade: "golden", crop: { oy: 0.5 }, cap: "Nº4 · launch hero", tall: true },
  { id: "balm", grade: "dusk", crop: { oy: 0.7, fy: 0.66, z: 1.4 }, cap: "Fieldnote Balm · label detail" },
  { id: "tube", grade: "north", crop: { oy: 0.5 }, cap: "SPF 30 · Reels", tall: true },
  { id: "balm", grade: "ink", crop: { oy: 0.6, fy: 0.62, z: 1.15 }, cap: "Fieldnote · night edit" },
  { id: "parfum", grade: "mono", crop: { oy: 0.2, fy: 0.22, z: 1.4 }, cap: "Nº4 · cap detail, mono" },
  { id: "tube", grade: "golden", crop: { oy: 0.5, fy: 0.5, z: 1.12 }, cap: "SPF 30 · summer set", tall: true },
  { id: "parfum", grade: "green", crop: { oy: 0.6, fy: 0.6, z: 1.3 }, cap: "Nº4 · greenhouse" },
  { id: "tube", grade: "duo", crop: { oy: 0.5 }, cap: "SPF 30 · duotone teaser", tall: true },
  { id: "balm", grade: "rose", crop: { oy: 0.55 }, cap: "Fieldnote · holiday set" },
];

function Gallery() {
  const sec = useRef<HTMLElement>(null);
  useScrollFrame(sec, () => {
    const el = sec.current;
    if (!el || reducedMotion()) return;
    const r = el.getBoundingClientRect();
    const p = clamp01((window.innerHeight - r.top) / (r.height + window.innerHeight));
    el.style.setProperty("--g", (p - 0.5).toFixed(4));
  });
  const cols = [0, 1, 2].map((c) => SHOTS.filter((_, n) => n % 3 === c));
  return (
    <section className="fd-prs-sec" id="gallery" ref={sec}>
      <div className="fd-prs-wrap">
        <div className="fd-prs-head fd-prs-head-row" data-reveal="">
          <div>
            <p className="fd-prs-kicker">Made with Prism</p>
            <h2 className="fd-prs-h2">
              One photo in. <span className="fd-prs-mute">A season of campaigns out.</span>
            </h2>
          </div>
          <p className="fd-prs-p">Every image below is cut from the same three studio photos — relit, regraded and recomposed by Prism.</p>
        </div>
        <div className="fd-prs-gal">
          {cols.map((col, c) => (
            <div key={c} className="fd-prs-gal-col" style={{ "--speed": [-60, 50, -110][c] } as CSSProperties}>
              {col.map((s, n) => (
                <figure key={s.cap} className="fd-prs-gal-item" data-tall={s.tall || undefined} data-reveal="" style={{ "--i": n + c } as CSSProperties}>
                  <Pic id={s.id} grade={s.grade} crop={s.crop} sizes="(max-width: 720px) 45vw, 370px" alt={`${PRODUCTS[s.id].name}, ${s.cap}, ${GRADES[s.grade].name.toLowerCase()} grade`} />
                  <figcaption>{s.cap}</figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── before / after ─────────────────────────── */

const COMPARE_GRADES: GradeKey[] = ["golden", "dusk", "green", "mono"];

function Compare() {
  const [pid, setPid] = useState<ProductId>("parfum");
  const [grade, setGrade] = useState<GradeKey>("golden");
  const [pos, setPos] = useState(50);
  const g = GRADES[grade];
  return (
    <section className="fd-prs-sec" id="compare">
      <div className="fd-prs-wrap fd-prs-cmp">
        <div className="fd-prs-cmp-copy" data-reveal="">
          <p className="fd-prs-kicker">Before and after</p>
          <h2 className="fd-prs-h2">
            Same photo. <span className="fd-prs-mute">A different light.</span>
          </h2>
          <p className="fd-prs-p">
            Drag the handle to compare your original upload with the relit render. The label, the glass and the cap
            stay pixel-exact; only the light and the world around them change.
          </p>
          <div className="fd-prs-cmp-ctrl">
            <span className="fd-prs-cmp-lab" id="fd-prs-cmp-prod">
              Product
            </span>
            <Glass className="fd-prs-pills" radius={9999} bezel={14} strength={30} role="group" aria-labelledby="fd-prs-cmp-prod">
              {ORDER.map((o) => (
                <button key={o} type="button" aria-pressed={o === pid} onClick={() => setPid(o)}>
                  {PRODUCTS[o].name}
                </button>
              ))}
            </Glass>
            <span className="fd-prs-cmp-lab" id="fd-prs-cmp-light">
              Light
            </span>
            <Glass className="fd-prs-pills" radius={9999} bezel={14} strength={30} role="group" aria-labelledby="fd-prs-cmp-light">
              {COMPARE_GRADES.map((k) => (
                <button key={k} type="button" aria-pressed={k === grade} onClick={() => setGrade(k)}>
                  {GRADES[k].name}
                </button>
              ))}
            </Glass>
          </div>
        </div>
        <div className="fd-prs-cmp-stage" data-reveal="">
          <Pic id={pid} grade="natural" sizes="(max-width: 1000px) 90vw, 520px" alt={`${PRODUCTS[pid].name}, original upload`} />
          <div className="fd-prs-cmp-after" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
            <Pic id={pid} grade={grade} sizes="(max-width: 1000px) 90vw, 520px" alt={`${PRODUCTS[pid].name}, ${g.name.toLowerCase()} grade`} />
          </div>
          <span className="fd-prs-cmp-tag fd-prs-cmp-tag-l">Original</span>
          <span className="fd-prs-cmp-tag fd-prs-cmp-tag-r">{g.name}</span>
          <input
            className="fd-prs-cmp-range"
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Reveal the relit version"
          />
          <div className="fd-prs-cmp-line" style={{ left: `${pos}%` }} aria-hidden="true">
            <Glass className="fd-prs-cmp-knob" radius={9999} bezel={14} strength={28}>
              <Chevron dir="left" />
              <Chevron />
            </Glass>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ─────────────────────────── stats ─────────────────────────── */

function CountUp({ to, dec = 0, suf = "", pre = "" }: { to: number; dec?: number; suf?: string; pre?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) => pre + n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
    if (reducedMotion() || typeof IntersectionObserver === "undefined") {
      el.textContent = fmt(to);
      return;
    }
    el.textContent = fmt(0);
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = clamp01((now - start) / 1500);
          el.textContent = fmt(t >= 1 ? to : to * (1 - Math.pow(2, -10 * t)));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, dec, suf, pre]);
  return (
    <span ref={ref}>
      {pre}
      {to.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}
      {suf}
    </span>
  );
}

function Stats() {
  const items = [
    { to: 4.8, dec: 1, suf: "s", label: "median render, 4K, any scene" },
    { to: 214, suf: "", label: "channel-ready formats per shot" },
    { to: 92, suf: "%", label: "lower cost than a studio day" },
    { to: 11000, suf: "+", label: "brands shooting on Prism" },
  ];
  return (
    <section className="fd-prs-stats" aria-label="Prism in numbers">
      <div className="fd-prs-wrap">
        <dl className="fd-prs-stats-row">
          {items.map((s, n) => (
            <div key={s.label} data-reveal="" style={{ "--i": n } as CSSProperties}>
              <dt>
                <CountUp to={s.to} dec={s.dec} suf={s.suf} />
              </dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ─────────────────────────── momentum carousel ─────────────────────────── */

const QUOTES: { q: string; n: string; r: string; m: string; id: ProductId; grade: GradeKey; crop: Crop }[] = [
  { q: "We shot our entire spring launch — 340 assets — in an afternoon. The bottle reflections are better than our last studio day.", n: "Inès Duval", r: "Creative Director, Maison Vale", m: "340 assets · 1 afternoon", id: "parfum", grade: "golden", crop: { oy: 0.58, fy: 0.58, z: 1.1 } },
  { q: "Our Amazon conversion went up 18% after we replaced flat white-background shots with Prism lifestyle scenes.", n: "Marcus Bell", r: "Head of E-commerce, Fieldnote", m: "+18% conversion", id: "balm", grade: "north", crop: { oy: 0.62, fy: 0.62, z: 1.15 } },
  { q: "Refraction through tinted lenses was the thing every other tool got wrong. Prism gets it right on the first render.", n: "Hana Sato", r: "Brand Lead, Kinfolk Eyewear", m: "0 reshoots this year", id: "parfum", grade: "mono", crop: { oy: 0.62, fy: 0.62, z: 1.2 } },
  { q: "I briefed a billboard on Tuesday and approved it on Wednesday. The agency still doesn't believe me.", n: "Tom Achterberg", r: "CMO, Pale Blue", m: "48 h brief to billboard", id: "tube", grade: "dusk", crop: { oy: 0.5, fy: 0.45, z: 1.2 } },
  { q: "We localise every campaign for nine markets. Prism restages each one with local light and architecture.", n: "Leila Haddad", r: "Global Marketing, Sable & Co", m: "9 markets · 1 shoot", id: "balm", grade: "rose", crop: { oy: 0.62, fy: 0.62, z: 1.15 } },
];


function Carousel() {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const st = useRef({ x: 0, v: 0, target: 0, raf: 0, last: 0, step: 0, min: 0, dragging: false, moved: 0 });

  const render = useCallback(() => {
    const t = track.current;
    if (t) t.style.transform = `translate3d(${st.current.x.toFixed(2)}px,0,0)`;
  }, []);

  const measure = useCallback(() => {
    const t = track.current;
    const v = viewport.current;
    if (!t || !v) return;
    const first = t.children[0] as HTMLElement | undefined;
    const second = t.children[1] as HTMLElement | undefined;
    st.current.step = first && second ? second.offsetLeft - first.offsetLeft : v.clientWidth;
    st.current.min = Math.min(0, v.clientWidth - t.scrollWidth);
  }, []);

  const animateTo = useCallback(
    (target: number, v0 = 0) => {
      const s = st.current;
      s.target = clamp(target, s.min, 0);
      s.v = v0;
      if (reducedMotion()) {
        s.x = s.target;
        render();
        return;
      }
      cancelAnimationFrame(s.raf);
      s.last = 0;
      const tick = (now: number) => {
        const dt = Math.min(0.032, s.last ? (now - s.last) / 1000 : 0.016);
        s.last = now;
        const k = 380;
        const c = 30;
        s.v += (k * (s.target - s.x) - c * s.v) * dt;
        s.x += s.v * dt;
        render();
        if (Math.abs(s.target - s.x) > 0.3 || Math.abs(s.v) > 3) s.raf = requestAnimationFrame(tick);
        else {
          s.x = s.target;
          render();
        }
      };
      s.raf = requestAnimationFrame(tick);
    },
    [render],
  );

  const go = useCallback(
    (n: number) => {
      measure();
      const s = st.current;
      const maxIdx = Math.max(0, Math.round(-s.min / (s.step || 1)));
      const idx = clamp(n, 0, Math.min(QUOTES.length - 1, maxIdx));
      setActive(idx);
      animateTo(Math.max(s.min, -idx * s.step));
    },
    [animateTo, measure],
  );

  useEffect(() => {
    const v = viewport.current;
    if (!v) return;
    measure();
    const s = st.current;
    let startX = 0;
    let startPos = 0;
    let lastX = 0;
    let lastT = 0;
    let vel = 0;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      cancelAnimationFrame(s.raf);
      measure();
      s.dragging = true;
      s.moved = 0;
      startX = lastX = e.clientX;
      startPos = s.x;
      lastT = performance.now();
      vel = 0;
      v.setPointerCapture(e.pointerId);
      v.setAttribute("data-drag", "");
    };
    const move = (e: PointerEvent) => {
      if (!s.dragging) return;
      const now = performance.now();
      const dx = e.clientX - startX;
      s.moved = Math.max(s.moved, Math.abs(dx));
      let x = startPos + dx;
      if (x > 0) x *= 0.35;
      if (x < s.min) x = s.min + (x - s.min) * 0.35;
      const dt = Math.max(1, now - lastT);
      vel = 0.8 * ((e.clientX - lastX) / dt) + 0.2 * vel;
      lastX = e.clientX;
      lastT = now;
      s.x = x;
      render();
    };
    const up = () => {
      if (!s.dragging) return;
      s.dragging = false;
      v.removeAttribute("data-drag");
      const projected = s.x + vel * 260;
      const idx = clamp(Math.round(-projected / (s.step || 1)), 0, QUOTES.length - 1);
      setActive(idx);
      animateTo(Math.max(s.min, -idx * s.step), vel * 1000);
    };
    const click = (e: MouseEvent) => {
      if (s.moved > 6) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onResize = () => {
      measure();
      s.x = clamp(s.x, s.min, 0);
      render();
    };
    v.addEventListener("pointerdown", down);
    v.addEventListener("pointermove", move);
    v.addEventListener("pointerup", up);
    v.addEventListener("pointercancel", up);
    v.addEventListener("click", click, true);
    window.addEventListener("resize", onResize);
    return () => {
      v.removeEventListener("pointerdown", down);
      v.removeEventListener("pointermove", move);
      v.removeEventListener("pointerup", up);
      v.removeEventListener("pointercancel", up);
      v.removeEventListener("click", click, true);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(s.raf);
    };
  }, [animateTo, measure, render]);

  return (
    <section className="fd-prs-sec" id="stories" aria-roledescription="carousel" aria-label="Customer stories">
      <div className="fd-prs-wrap">
        <div className="fd-prs-head fd-prs-head-row" data-reveal="">
          <div>
            <p className="fd-prs-kicker">Customers</p>
            <h2 className="fd-prs-h2">
              Studios on deadline <span className="fd-prs-mute">switched first.</span>
            </h2>
          </div>
          <div className="fd-prs-car-btns">
            <Glass className="fd-prs-round" radius={9999} bezel={14} strength={30}>
              <button type="button" onClick={() => go(active - 1)} aria-label="Previous story" disabled={active === 0}>
                <Chevron dir="left" />
              </button>
            </Glass>
            <Glass className="fd-prs-round" radius={9999} bezel={14} strength={30}>
              <button type="button" onClick={() => go(active + 1)} aria-label="Next story" disabled={active === QUOTES.length - 1}>
                <Chevron />
              </button>
            </Glass>
          </div>
        </div>
      </div>
      <div
        className="fd-prs-car"
        ref={viewport}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(active + 1);
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(active - 1);
          }
        }}
        aria-label="Stories. Drag or use arrow keys."
      >
        <div className="fd-prs-car-track" ref={track}>
          {QUOTES.map((q, n) => (
            <figure key={q.n} className="fd-prs-quote" data-active={n === active || undefined} aria-roledescription="slide" aria-label={`${n + 1} of ${QUOTES.length}`}>
              <div className="fd-prs-quote-shot" aria-hidden="true">
                <Pic id={q.id} grade={q.grade} crop={q.crop} sizes="(max-width: 720px) 82vw, 432px" alt={`${PRODUCTS[q.id].name}, ${GRADES[q.grade].name.toLowerCase()} grade`} />
                <span className="fd-prs-quote-metric">{q.m}</span>
              </div>
              <blockquote>“{q.q}”</blockquote>
              <figcaption>
                <b>{q.n}</b>
                <span>{q.r}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="fd-prs-car-dots" aria-hidden="true">
        {QUOTES.map((q, n) => (
          <i key={q.n} data-on={n === active || undefined} />
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── pricing ─────────────────────────── */

const PLANS = [
  { name: "Starter", m: 0, y: 0, blurb: "Try every feature on your own products.", feats: ["25 renders / month", "1080p exports", "12 scene presets", "Personal licence"], cta: "Start free" },
  { name: "Studio", m: 36, y: 29, blurb: "For brands shipping campaigns every month.", feats: ["1,500 renders / month", "4K + 214 channel formats", "Custom scenes & brand kits", "Ray-traced glass & liquids", "Commercial licence"], cta: "Start 14-day trial", hot: true },
  { name: "Agency", m: 149, y: 119, blurb: "Multiple brands, client review, SSO.", feats: ["Unlimited renders", "8 brand workspaces", "Client approval links", "SSO & audit log", "Priority render queue"], cta: "Talk to us" },
];

function Pricing() {
  const [yearly, setYearly] = useState(true);
  return (
    <section className="fd-prs-sec" id="pricing">
      <div className="fd-prs-wrap">
        <div className="fd-prs-head fd-prs-head-center" data-reveal="">
          <p className="fd-prs-kicker">Pricing</p>
          <h2 className="fd-prs-h2">
            Cheaper than one studio day. <span className="fd-prs-mute">Every month.</span>
          </h2>
          <Glass className="fd-prs-seg" radius={9999} bezel={14} strength={30} role="radiogroup" aria-label="Billing period" data-yearly={yearly || undefined}>
            <i className="fd-prs-seg-thumb" aria-hidden="true" />
            <button type="button" role="radio" aria-checked={!yearly} onClick={() => setYearly(false)}>
              Monthly
            </button>
            <button type="button" role="radio" aria-checked={yearly} onClick={() => setYearly(true)}>
              Yearly <em>save 20%</em>
            </button>
          </Glass>
        </div>
        <div className="fd-prs-plans">
          {PLANS.map((p, n) => (
            <article key={p.name} className="fd-prs-plan" data-hot={p.hot || undefined} data-reveal="" style={{ "--i": n } as CSSProperties}>
              <div className="fd-prs-plan-top">
                <h3>{p.name}</h3>
                {p.hot && <span className="fd-prs-plan-tag">Most popular</span>}
              </div>
              <p className="fd-prs-plan-blurb">{p.blurb}</p>
              <div className="fd-prs-price">
                <span className="fd-prs-price-n" key={yearly ? "y" : "m"}>
                  ${yearly ? p.y : p.m}
                </span>
                <span className="fd-prs-price-per">{p.m === 0 ? "forever" : "/ month"}</span>
              </div>
              <p className="fd-prs-plan-bill">{p.m === 0 ? "No card required" : yearly ? `$${p.y * 12} billed yearly` : "Billed monthly, cancel anytime"}</p>
              <a href="#top" className={`fd-prs-btn ${p.hot ? "" : "fd-prs-btn-soft"}`}>
                {p.cta}
              </a>
              <ul>
                {p.feats.map((f) => (
                  <li key={f}>
                    <Check />
                    {f}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── faq ─────────────────────────── */

const FAQ: [string, string][] = [
  ["Do I need a studio photo to start?", "No. A phone photo on any surface works: Prism cuts the product out, rebuilds the backdrop and lights it from scratch. Clean, evenly lit starting shots, like the grey seamless photos on this page, give the sharpest labels."],
  ["Will my label and logo stay readable?", "Yes. Packaging is locked pixel-exact. Type, foil and embossing are composited on top of every relit scene, so a new light never rewrites your label."],
  ["Can I keep one look across a whole season?", "Brand kits store your palettes, backdrops and lens choices, so a launch hero, a PDP crop and a holiday set all land in the same grade."],
  ["Who owns the renders?", "You do. Studio and Agency plans include a commercial licence, and every file carries C2PA content credentials."],
  ["How fast is a render?", "The median 4K render takes 4.8 seconds. Batches of 214 channel formats run in parallel, so a full set is usually ready before you have finished your coffee."],
];

function Faq() {
  return (
    <section className="fd-prs-sec" id="faq">
      <div className="fd-prs-wrap">
        <div className="fd-prs-head fd-prs-head-center" data-reveal="">
          <p className="fd-prs-kicker">Questions</p>
          <h2 className="fd-prs-h2">
            Good to know <span className="fd-prs-mute">before your first render.</span>
          </h2>
        </div>
        <div className="fd-prs-faq" data-reveal="">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>
                <span>{q}</span>
                <Chevron />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ─────────────────────────── CTA + footer ─────────────────────────── */

function Cta() {
  return (
    <section className="fd-prs-cta">
      <div className="fd-prs-wrap">
        <div className="fd-prs-cta-card" data-reveal="">
          <div className="fd-prs-cta-copy">
            <h2 className="fd-prs-cta-h">Your next shoot is a sentence away.</h2>
            <p className="fd-prs-p">Upload a phone photo of any product. Your first 25 renders are on us.</p>
            <div className="fd-prs-cta-btns">
              <a href="#top" className="fd-prs-btn">
                Try Prism free
              </a>
              <a href="#gallery" className="fd-prs-btn fd-prs-btn-soft">
                See the gallery
              </a>
            </div>
          </div>
          <div className="fd-prs-cta-shot">
            <Pic id="parfum" grade="golden" crop={{ oy: 0.6 }} sizes="(max-width: 1000px) 90vw, 500px" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols: [string, string[]][] = [
    ["Product", ["Studio", "Optics engine", "Brand kits", "API", "What’s new"]],
    ["Use cases", ["Beauty", "Eyewear", "Food & drink", "Home", "Agencies"]],
    ["Company", ["About", "Careers", "Press kit", "Privacy", "Terms"]],
  ];
  return (
    <footer className="fd-prs-foot">
      <div className="fd-prs-wrap">
        <div className="fd-prs-foot-top">
          <div>
            <a href="#top" className="fd-prs-brand" aria-label="Prism home">
              <Logo />
              <span>Prism</span>
            </a>
            <p className="fd-prs-foot-p">AI product photography with real optics. Made in Copenhagen and Lisbon.</p>
          </div>
          {cols.map(([h, items]) => (
            <div key={h}>
              <h4>{h}</h4>
              <ul>
                {items.map((it) => (
                  <li key={it}>
                    <a href="#top">{it}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="fd-prs-foot-bot">
          <span>© 2026 Prism Imaging ApS</span>
          <span>All renders carry C2PA content credentials.</span>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────── page ─────────────────────────── */

export function Page() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  // Depth layers inside sticky scenes: translate by (progress - 0.5) * depth.
  useEffect(() => {
    const el = root.current;
    if (!el || reducedMotion()) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      el.querySelectorAll<HTMLElement>(".fd-prs-studio").forEach((s) => {
        const p = Number(getComputedStyle(s).getPropertyValue("--p") || 0.5);
        s.querySelectorAll<HTMLElement>(".fd-prs-depth").forEach((d) => {
          const depth = Number(d.style.getPropertyValue("--depth") || 0);
          d.style.transform = `translate3d(0, ${((p - 0.5) * -depth).toFixed(1)}px, 0)`;
        });
      });
    };
    const q = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    q();
    window.addEventListener("scroll", q, { passive: true });
    return () => {
      window.removeEventListener("scroll", q);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div className="fd-prs" ref={root}>
      <style>{css}</style>
      <Mesh />
      <Nav />
      <main>
        <Hero />
        <Logos />
        <Lens />
        <Studio />
        <Gallery />
        <Compare />
        <Stats />
        <Carousel />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}

export default Page;

/* ─────────────────────────── styles ─────────────────────────── */

const css = `
.fd-prs {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms;
  --fd-dur-2: 240ms;
  --fd-dur-3: 420ms;
  --fd-dur-4: 700ms;

  --fd-prs-ink: #16161d;
  --fd-prs-ink-2: #2a2a33;
  --fd-prs-mute: #4f4f5c;
  --fd-prs-paper: #f6f4fb;
  --fd-prs-card: #ffffff;
  --fd-prs-line: rgba(22, 22, 29, 0.08);
  --fd-prs-accent: #5b3df5;
  --fd-prs-glass-tint: rgba(255, 255, 255, 0.22);
  --fd-prs-glass-frost: rgba(255, 255, 255, 0.58);
  --fd-prs-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter Variable", "Inter", "Segoe UI", Roboto, sans-serif;

  position: relative; display: block; margin: 0; padding: 0; isolation: isolate;
  background: var(--fd-prs-paper); color: var(--fd-prs-ink);
  font: 400 1rem/1.5 var(--fd-prs-sans); letter-spacing: -0.01em; text-align: left;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  overflow-x: clip; clip-path: inset(0); color-scheme: light;
}
.fd-prs, .fd-prs *, .fd-prs *::before, .fd-prs *::after { box-sizing: border-box; }
.fd-prs :where(h1, h2, h3, h4, p, ul, ol, li, dl, dt, dd, figure, figcaption, blockquote, main, header, footer, section, nav, article, label, form) {
  margin: 0; padding: 0; border: 0; font: inherit; color: inherit; letter-spacing: inherit; background: none;
}
.fd-prs :where(ul, ol) { list-style: none; }
.fd-prs :where(a) { color: inherit; text-decoration: none; }
.fd-prs :where(button, input) { appearance: none; -webkit-appearance: none; margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit; letter-spacing: inherit; text-align: inherit; line-height: inherit; border-radius: 0; box-shadow: none; }
.fd-prs :where(button) { cursor: pointer; }
.fd-prs :where(button:disabled) { cursor: default; }
.fd-prs :where(svg) { display: block; overflow: visible; }
.fd-prs :where(b, strong) { font-weight: 600; }
.fd-prs :where(em) { font-style: normal; }
.fd-prs :where(a, button, input, [tabindex]):focus-visible { outline: 2px solid rgba(91, 61, 245, 0.7); outline-offset: 2px; }
.fd-prs-sr { position: absolute !important; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.fd-prs-wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 32px; }
.fd-prs-kicker { font: 600 0.875rem/1.3 var(--fd-prs-sans); letter-spacing: -0.005em; color: var(--fd-prs-accent); }
.fd-prs-h2 { margin-top: 12px; max-width: 18em; font: 600 clamp(2rem, 4.6vw, 3.5rem)/1.05 var(--fd-prs-sans); letter-spacing: -0.035em; text-wrap: balance; }
.fd-prs-mute { color: #6e6e7a; }
.fd-prs-p { margin-top: 18px; max-width: 36em; font: 400 1.125rem/1.5 var(--fd-prs-sans); color: var(--fd-prs-mute); }
.fd-prs-mini { font: 500 0.875rem/1.4 var(--fd-prs-sans); color: var(--fd-prs-mute); text-align: center; }
.fd-prs-head-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; flex-wrap: wrap; }
.fd-prs-head-row .fd-prs-p { max-width: 24em; margin: 0; }
.fd-prs-head-center { display: flex; flex-direction: column; align-items: center; text-align: center; }
.fd-prs-head-center .fd-prs-h2 { margin-left: auto; margin-right: auto; }
.fd-prs-sec { position: relative; padding: 140px 0; }

/* backdrop */
.fd-prs-mesh { position: fixed; inset: -10vh -10vw; z-index: -1; pointer-events: none; overflow: hidden; }
.fd-prs-blob { position: absolute; display: block; width: 60vmax; height: 60vmax; border-radius: 50%; opacity: 0.9; will-change: transform; }
/* The mesh drifts with scroll (--m: 0→1 over the page), not with time: SVG-refraction glass re-rasterizes whenever its backdrop changes, so a time-based drift would cost a filter pass every frame. */
.fd-prs-mesh { --m: 0; }
.fd-prs-b1 { left: -12vmax; top: -18vmax; background: radial-gradient(closest-side, #ffc2d4, rgba(255,194,212,0)); transform: translate3d(calc(var(--m) * 28vw), calc(var(--m) * 30vh), 0) scale(calc(1 + var(--m) * 0.25)); }
.fd-prs-b2 { right: -16vmax; top: -6vmax; background: radial-gradient(closest-side, #c6b6ff, rgba(198,182,255,0)); transform: translate3d(calc(var(--m) * -24vw), calc(var(--m) * 36vh), 0); }
.fd-prs-b3 { left: 18vw; top: 34vh; background: radial-gradient(closest-side, #b3e1ff, rgba(179,225,255,0)); transform: translate3d(calc(var(--m) * 20vw), calc(var(--m) * -30vh), 0) scale(calc(1 + var(--m) * 0.3)); }
.fd-prs-b4 { right: 4vw; bottom: -24vmax; background: radial-gradient(closest-side, #ffdcb3, rgba(255,220,179,0)); transform: translate3d(calc(var(--m) * -30vw), calc(var(--m) * -26vh), 0); }
.fd-prs-b5 { left: -20vmax; bottom: -10vmax; background: radial-gradient(closest-side, #bff3dd, rgba(191,243,221,0)); transform: translate3d(calc(var(--m) * 36vw), calc(var(--m) * -20vh), 0) scale(calc(1 - var(--m) * 0.15)); }
.fd-prs-grain { position: absolute; inset: 0; opacity: 0.35; mix-blend-mode: soft-light; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>"); }

/* glass */
.fd-prs-glass {
  position: relative; isolation: isolate;
  background: var(--fd-prs-glass-frost);
  -webkit-backdrop-filter: blur(18px) saturate(180%); backdrop-filter: blur(18px) saturate(180%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.35),
    inset 1px 0 0 rgba(255,255,255,0.5), inset -1px 0 0 rgba(255,255,255,0.5),
    0 1px 2px rgba(22,22,29,0.06), 0 12px 32px -12px rgba(22,22,29,0.22);
}
.fd-prs-glass[data-refract] { background: var(--fd-prs-glass-tint); }
.fd-prs-glass::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: linear-gradient(160deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 38%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.22)); mix-blend-mode: soft-light; z-index: 1; }
.fd-prs-glass > * { position: relative; z-index: 2; }
.fd-prs-glass-svg { position: absolute !important; width: 0; height: 0; overflow: hidden; pointer-events: none; }

/* buttons */
.fd-prs-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 48px; padding: 0 24px; border-radius: 9999px;
  background: var(--fd-prs-ink); color: #fff; font: 500 1rem/1 var(--fd-prs-sans); letter-spacing: -0.01em; white-space: nowrap;
  transition: transform var(--fd-dur-1) var(--fd-ease-out), background-color var(--fd-dur-2) var(--fd-ease-out);
}
.fd-prs-btn:hover { background: #000; }
.fd-prs-btn:active { transform: scale(0.96); }
.fd-prs-btn-sm { height: 36px; padding: 0 16px; font-size: 0.875rem; }
.fd-prs-btn-soft { background: rgba(22,22,29,0.06); color: var(--fd-prs-ink); }
.fd-prs-btn-soft:hover { background: rgba(22,22,29,0.1); }
.fd-prs-btn[data-busy] { background: var(--fd-prs-accent); }

/* nav */
.fd-prs-nav { position: sticky; top: 0; z-index: 50; display: block; height: 72px; }
.fd-prs-nav-glass {
  position: absolute; inset: 0; border-radius: 9999px; opacity: 0;
  clip-path: inset(0 0 0 0 round 0px);
  transition: opacity var(--fd-dur-3) var(--fd-ease-out), clip-path var(--fd-dur-4) var(--fd-ease-out);
}
.fd-prs-nav[data-condensed] .fd-prs-nav-glass, .fd-prs-nav[data-open] .fd-prs-nav-glass { opacity: 1; clip-path: inset(10px max(16px, calc((100% - 940px) / 2)) 10px max(16px, calc((100% - 940px) / 2)) round 9999px); }
.fd-prs-nav[data-open] .fd-prs-nav-glass { clip-path: inset(10px 16px -320px 16px round 28px); }
.fd-prs-nav-in { position: relative; z-index: 1; display: flex; align-items: center; gap: 24px; max-width: 1200px; height: 72px; margin: 0 auto; padding: 0 32px; transition: max-width var(--fd-dur-4) var(--fd-ease-out), padding var(--fd-dur-4) var(--fd-ease-out); }
.fd-prs-nav[data-condensed] .fd-prs-nav-in { max-width: 940px; padding: 0 24px 0 28px; }
.fd-prs-brand { display: inline-flex; align-items: center; gap: 8px; font: 600 1.125rem/1 var(--fd-prs-sans); letter-spacing: -0.02em; }
.fd-prs-nav-links { display: flex; gap: 2px; margin: 0 auto; }
.fd-prs-nav-links a { display: inline-flex; align-items: center; height: 34px; padding: 0 14px; border-radius: 9999px; font: 500 0.875rem/1 var(--fd-prs-sans); color: var(--fd-prs-ink-2); transition: background-color var(--fd-dur-1) linear; }
.fd-prs-nav-links a:hover { background: rgba(22,22,29,0.06); }
.fd-prs-nav-right { display: flex; align-items: center; gap: 6px; }
.fd-prs-nav-signin { padding: 0 12px; font: 500 0.875rem/1 var(--fd-prs-sans); color: var(--fd-prs-ink-2); }
.fd-prs-burger { display: none; position: relative; width: 40px; height: 40px; border-radius: 9999px; }
.fd-prs-burger span { position: absolute; left: 12px; right: 12px; height: 1.5px; border-radius: 2px; background: var(--fd-prs-ink); transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-prs-burger span:first-child { top: 16px; }
.fd-prs-burger span:last-child { top: 23px; }
.fd-prs-nav[data-open] .fd-prs-burger span:first-child { transform: translateY(3.5px) rotate(45deg); }
.fd-prs-nav[data-open] .fd-prs-burger span:last-child { transform: translateY(-3.5px) rotate(-45deg); }
.fd-prs-sheet { position: relative; z-index: 1; display: grid; padding: 8px 40px 24px; }
.fd-prs-sheet[hidden] { display: none; }
.fd-prs-sheet a { padding: 13px 0; border-bottom: 1px solid var(--fd-prs-line); font: 600 1.25rem/1.2 var(--fd-prs-sans); letter-spacing: -0.02em; }

/* hero */
.fd-prs-hero { --sp: 0; position: relative; padding: 72px 0 120px; }
.fd-prs-hero-in { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 56px; align-items: center; }
.fd-prs-in { animation: fd-prs-in 1000ms var(--fd-ease-out) both; animation-delay: var(--d, 0ms); }
@keyframes fd-prs-in { from { opacity: 0; transform: translateY(20px) scale(0.985); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }
.fd-prs-h1 { margin-top: 18px; font: 650 clamp(3.25rem, 7.4vw, 6.5rem)/0.95 var(--fd-prs-sans); letter-spacing: -0.05em; }
.fd-prs-h1 > span { display: block; white-space: nowrap; }
.fd-prs-lede { margin-top: 24px; max-width: 30em; font: 400 clamp(1.0625rem, 1.5vw, 1.25rem)/1.5 var(--fd-prs-sans); color: var(--fd-prs-mute); }
.fd-prs-prompt-wrap { margin-top: 36px; max-width: 540px; }
.fd-prs-prompt { display: flex; align-items: center; gap: 10px; height: 60px; padding: 0 10px 0 20px; border-radius: 9999px; color: var(--fd-prs-accent); }
.fd-prs-prompt input { flex: 1; min-width: 0; height: 100%; font: 450 1rem/1 var(--fd-prs-sans); color: var(--fd-prs-ink); outline: none; }
.fd-prs-prompt input::placeholder { color: #5d5d6a; opacity: 1; }
.fd-prs-prompt:focus-within { box-shadow: inset 0 1px 0 rgba(255,255,255,0.95), 0 0 0 3px rgba(91,61,245,0.25), 0 12px 32px -12px rgba(22,22,29,0.22); }
.fd-prs-fine { margin-top: 16px; font: 400 0.8125rem/1.4 var(--fd-prs-sans); color: var(--fd-prs-mute); }

.fd-prs-hero-stage { --px: 0; --py: 0; position: relative; aspect-ratio: 1 / 1.02; transform: translate3d(0, calc(var(--sp) * 60px), 0); }
.fd-prs-stage-layer { position: absolute; transition: transform var(--fd-dur-4) var(--fd-ease-out); }
.fd-prs-depth-1 { inset: 0; transform: translate3d(calc(var(--px) * -14px), calc(var(--py) * -14px), 0); }
.fd-prs-depth-1 { z-index: 1; }
.fd-prs-depth-2 { z-index: 2; left: 0; top: 10%; transform: translate3d(calc(var(--px) * 26px), calc(var(--py) * 26px + var(--sp) * -80px), 0); }
.fd-prs-depth-3 { z-index: 3; right: 0; top: 40%; transform: translate3d(calc(var(--px) * 40px), calc(var(--py) * 40px + var(--sp) * -150px), 0); }
.fd-prs-depth-4 { z-index: 4; left: 2%; bottom: 0; transform: translate3d(calc(var(--px) * 32px), calc(var(--py) * 32px + var(--sp) * -110px), 0); }
.fd-prs-stage-shot { position: absolute; inset: 0; opacity: 0; transition: opacity 900ms var(--fd-ease-in-out); }
.fd-prs-stage-shot[data-on] { opacity: 1; }
.fd-prs-render-sweep { position: absolute; inset: 0; z-index: 3; display: block; pointer-events: none; background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.65) 50%, transparent 70%); transform: translateX(-120%); }
.fd-prs-render-sweep[data-busy] { animation: fd-prs-sweep 900ms var(--fd-ease-in-out); }
@keyframes fd-prs-sweep { to { transform: translateX(120%); } }

.fd-prs-chip { display: inline-flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 24px 8px 20px; border-radius: 9999px; font: 500 0.875rem/1.2 var(--fd-prs-sans); color: var(--fd-prs-ink); white-space: nowrap; }
.fd-prs-chip-dot { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 3px rgba(255,255,255,0.7); transition: background-color var(--fd-dur-4) var(--fd-ease-in-out); }
.fd-prs-chip-label { display: flex; flex-direction: column; gap: 2px; }
.fd-prs-chip-label span { font: 500 0.6875rem/1.1 var(--fd-prs-sans); color: var(--fd-prs-mute); letter-spacing: 0; }
.fd-prs-chip-label b { font: 600 0.9375rem/1.1 var(--fd-prs-sans); font-variant-numeric: tabular-nums; }
.fd-prs-chip-sep { width: 1px; align-self: stretch; margin: 2px 4px; background: rgba(22,22,29,0.12); }
.fd-prs-chip-temp, .fd-prs-chip-strength { flex-direction: column; align-items: stretch; gap: 10px; width: 220px; padding: 14px 18px 16px; border-radius: 22px; }
.fd-prs-chip-temp .fd-prs-chip-label, .fd-prs-chip-strength .fd-prs-chip-label { flex-direction: row; justify-content: space-between; align-items: baseline; }
.fd-prs-chip-temp .fd-prs-chip-label span, .fd-prs-chip-strength .fd-prs-chip-label span { font-size: 0.8125rem; }
.fd-prs-slider { --v: 50%; display: block; width: 100%; height: 22px; background: transparent; cursor: pointer; }
.fd-prs-slider::-webkit-slider-runnable-track { height: 6px; border-radius: 9999px; background: linear-gradient(to right, var(--fd-prs-ink) var(--v), rgba(22,22,29,0.14) var(--v)); }
.fd-prs-slider::-moz-range-track { height: 6px; border-radius: 9999px; background: linear-gradient(to right, var(--fd-prs-ink) var(--v), rgba(22,22,29,0.14) var(--v)); }
.fd-prs-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 18px; margin-top: -6px; border-radius: 9999px; background: #fff; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.12), 0 3px 8px rgba(0,0,0,0.18); transition: transform var(--fd-dur-2) var(--fd-spring); }
.fd-prs-slider:active::-webkit-slider-thumb { transform: scale(1.18); }
.fd-prs-slider::-moz-range-thumb { width: 26px; height: 18px; border: 0; border-radius: 9999px; background: #fff; box-shadow: 0 3px 8px rgba(0,0,0,0.18); }

/* product photography: the real photo, graded and cropped with CSS only */
.fd-prs-shot { position: absolute; inset: 0; overflow: hidden; isolation: isolate; container-type: size; background: #8d8e96; }
.fd-prs-shot-in {
  position: absolute; left: 0; top: 0; width: max(100cqw, calc(100cqh * 0.6968)); aspect-ratio: 570 / 818;
  transform-origin: calc(var(--fx) * 100%) calc(var(--fy) * 100%);
  transform: translate(calc((100cqw - 100%) * var(--ox)), calc((100cqh - 100%) * var(--oy))) scale(var(--z));
}
.fd-prs-shot-img { display: block; width: 100%; height: 100%; max-width: none; filter: var(--f); transition: filter 900ms var(--fd-ease-in-out); }
.fd-prs-shot > i { position: absolute; inset: 0; display: block; pointer-events: none; }
.fd-prs-g-bg { background: var(--bg); opacity: var(--bgo); mix-blend-mode: var(--bgm); transition: background-color 900ms var(--fd-ease-in-out), opacity 900ms var(--fd-ease-in-out); }
.fd-prs-g-all { background: var(--all); opacity: var(--allo); mix-blend-mode: var(--allm); transition: background-color 900ms var(--fd-ease-in-out), opacity 900ms var(--fd-ease-in-out); }
.fd-prs-g-temp { mix-blend-mode: soft-light; background: linear-gradient(rgba(80,140,255,calc(var(--t, 0) * 0.6)), rgba(80,140,255,calc(var(--t, 0) * 0.6))), linear-gradient(rgba(255,140,40,calc(var(--t, 0) * -0.7)), rgba(255,140,40,calc(var(--t, 0) * -0.7))); transition: background 200ms linear; }
.fd-prs-g-light { background: radial-gradient(70% 60% at var(--lx) var(--ly), rgba(255,255,255,0.5), rgba(255,255,255,0) 70%); mix-blend-mode: soft-light; }

/* hero fan */
.fd-prs-fan { position: absolute; inset: 0; }
.fd-prs-fan-card { position: absolute; left: 50%; top: 50%; display: block; width: 58%; aspect-ratio: 570 / 818; border-radius: 26px; overflow: hidden; transform: translate(-50%, -50%); box-shadow: 0 40px 80px -36px rgba(60,30,120,0.5), 0 0 0 1px rgba(255,255,255,0.75); transition: transform 800ms var(--fd-ease-out); }
.fd-prs-fan-card[data-pos="0"] { z-index: 3; cursor: default; }
.fd-prs-fan-card[data-pos="1"] { z-index: 2; transform: translate(calc(-50% + 48%), calc(-50% + 3%)) rotate(7deg) scale(0.78); }
.fd-prs-fan-card[data-pos="2"] { z-index: 1; transform: translate(calc(-50% - 48%), calc(-50% + 3%)) rotate(-7deg) scale(0.78); }
.fd-prs-fan-card[data-pos="1"]:hover { transform: translate(calc(-50% + 50%), calc(-50% + 1%)) rotate(8deg) scale(0.8); }
.fd-prs-fan-card[data-pos="2"]:hover { transform: translate(calc(-50% - 50%), calc(-50% + 1%)) rotate(-8deg) scale(0.8); }

/* logos */
.fd-prs-logos { padding: 32px 0 40px; }
.fd-prs-marquee { margin-top: 22px; overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
.fd-prs-marquee ul { display: flex; width: max-content; gap: 64px; padding-right: 64px; animation: fd-prs-marq 42s linear infinite; }
.fd-prs-marquee li { white-space: nowrap; color: #3d3d48; }
@keyframes fd-prs-marq { to { transform: translateX(-50%); } }
.fd-prs-wm-0 { font: 600 1.125rem/1 var(--fd-prs-sans); letter-spacing: 0.24em; }
.fd-prs-wm-1 { font: italic 500 1.375rem/1 Georgia, "Times New Roman", serif; }
.fd-prs-wm-2 { font: 700 1.375rem/1 var(--fd-prs-sans); letter-spacing: -0.05em; }
.fd-prs-wm-3 { font: 400 1.25rem/1 var(--fd-prs-sans); letter-spacing: 0.02em; }

/* lens */
.fd-prs-lens-stage { position: relative; height: 560px; margin-top: 56px; border-radius: 36px; overflow: hidden; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; box-shadow: 0 40px 90px -50px rgba(60,30,120,0.45), 0 0 0 1px rgba(255,255,255,0.8); }
.fd-prs-lens-stage:active { cursor: grabbing; }
.fd-prs-lens-bg { position: absolute; inset: 0; background: #fbfaff; }
.fd-prs-lens-stripes { position: absolute; inset: 0; background: repeating-linear-gradient(90deg, rgba(91,61,245,0.08) 0 2px, transparent 2px 28px), repeating-linear-gradient(0deg, rgba(22,22,29,0.05) 0 1px, transparent 1px 28px); }
.fd-prs-lens-word { position: absolute; left: 6%; top: 12%; font: 700 clamp(3rem, 8.5vw, 7.5rem)/0.9 var(--fd-prs-sans); letter-spacing: -0.055em; color: var(--fd-prs-ink); }
.fd-prs-lens-word::first-line { color: var(--fd-prs-accent); }
.fd-prs-lens-grid { position: absolute; left: 6%; bottom: 8%; display: grid; grid-template-columns: repeat(3, auto); gap: 8px 28px; font: 500 0.875rem/1.3 ui-monospace, "SF Mono", Menlo, monospace; color: var(--fd-prs-mute); }
.fd-prs-lens-shot { position: absolute; right: 5%; top: 8%; bottom: 8%; width: 34%; border-radius: 28px; overflow: hidden; box-shadow: 0 30px 60px -36px rgba(30,20,60,0.5); }
.fd-prs-lens { position: absolute; left: 0; top: 0; width: 240px; height: 240px; border-radius: 50%; will-change: transform; cursor: grab; touch-action: none; background: rgba(255,255,255,0.3); box-shadow: inset 0 1px 1px rgba(255,255,255,0.95), inset 0 -2px 6px rgba(255,255,255,0.4), inset 0 0 0 1px rgba(255,255,255,0.55), 0 24px 50px -16px rgba(30,20,60,0.4), 0 2px 6px rgba(30,20,60,0.12); }
.fd-prs-lens[data-refract] { background: rgba(255,255,255,0.06); }
.fd-prs-lens:not([data-refract]) { -webkit-backdrop-filter: blur(6px) saturate(200%) contrast(1.05); backdrop-filter: blur(6px) saturate(200%) contrast(1.05); background: rgba(255,255,255,0.28); }
.fd-prs-lens-ctrl { position: absolute; right: 20px; bottom: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.fd-prs-mode { display: inline-flex; align-items: center; gap: 8px; height: 28px; padding: 0 12px; border-radius: 9999px; background: rgba(22,22,29,0.78); color: #fff; font: 500 0.75rem/1 var(--fd-prs-sans); }
.fd-prs-mode::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #9aa0a6; }
.fd-prs-mode[data-mode="refract"]::before { background: #5df2a5; }

/* studio */
.fd-prs-studio { --p: 0; position: relative; height: 330vh; }
.fd-prs-studio-stick { position: sticky; top: 0; height: 100vh; display: flex; align-items: center; overflow: hidden; }
.fd-prs-studio-grid { display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: 64px; align-items: center; }
.fd-prs-scene-list { position: relative; display: grid; margin-top: 18px; }
.fd-prs-scene-list li { grid-area: 1 / 1; opacity: 0; transform: translateY(24px); transition: opacity var(--fd-dur-4) var(--fd-ease-out), transform var(--fd-dur-4) var(--fd-ease-out); pointer-events: none; }
.fd-prs-scene-list li[data-on] { opacity: 1; transform: none; pointer-events: auto; }
.fd-prs-scene-k { font: 600 0.875rem/1.2 var(--fd-prs-sans); color: var(--fd-prs-mute); }
.fd-prs-scene-list h3 { margin-top: 10px; font: 600 clamp(2rem, 4.2vw, 3.25rem)/1.04 var(--fd-prs-sans); letter-spacing: -0.035em; }
.fd-prs-scene-list p { margin-top: 18px; max-width: 26em; font: 400 1.125rem/1.5 var(--fd-prs-sans); color: var(--fd-prs-mute); }
.fd-prs-scene-dots { display: flex; gap: 8px; margin-top: 36px; }
.fd-prs-scene-dots i { width: 8px; height: 8px; border-radius: 9999px; background: rgba(22,22,29,0.18); transition: width var(--fd-dur-3) var(--fd-spring), background-color var(--fd-dur-3); }
.fd-prs-scene-dots i[data-on] { width: 28px; background: var(--fd-prs-ink); }
.fd-prs-studio-stage { position: relative; height: min(76vh, 640px); }
.fd-prs-depth { position: absolute; will-change: transform; }
.fd-prs-studio-stage > .fd-prs-depth:first-child { inset: 0; }
.fd-prs-studio-frame { position: absolute; inset: 0; border-radius: 28px; overflow: hidden; transition: clip-path 900ms var(--fd-ease-out); box-shadow: 0 50px 100px -40px rgba(60,30,120,0.35); }
.fd-prs-studio-c1 { left: -4%; top: 12%; }
.fd-prs-studio-c2 { right: -3%; top: 46%; }
.fd-prs-studio-c3 { left: 8%; bottom: 6%; }
.fd-prs-sun-dial { gap: 12px; padding-left: 10px; }
.fd-prs-dial { position: relative; width: 32px; height: 32px; border-radius: 50%; background: rgba(22,22,29,0.08); box-shadow: inset 0 0 0 1px rgba(22,22,29,0.1); }
.fd-prs-dial i { position: absolute; left: 50%; top: 50%; width: 2px; height: 13px; margin-left: -1px; border-radius: 2px; background: var(--fd-prs-ink); transform-origin: 50% 0; transform: rotate(calc(var(--a) + 180deg)); transition: transform var(--fd-dur-4) var(--fd-spring); }
.fd-prs-dial::after { content: ""; position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px; border-radius: 50%; background: #ffb547; }

/* gallery */
.fd-prs-gal { --g: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; margin-top: 64px; align-items: start; }
.fd-prs-gal-col { display: grid; gap: 20px; transform: translate3d(0, calc(var(--g) * var(--speed) * 1px), 0); will-change: transform; }
.fd-prs-gal-col:nth-child(2) { margin-top: 64px; }
.fd-prs-gal-item { position: relative; border-radius: 26px; overflow: hidden; aspect-ratio: 4 / 4.2; box-shadow: 0 30px 60px -36px rgba(60,30,120,0.4); }
.fd-prs-gal-item[data-tall] { aspect-ratio: 4 / 5.4; }
.fd-prs-gal-item figcaption { position: absolute; left: 14px; bottom: 14px; z-index: 2; display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 9999px; background: rgba(255,255,255,0.86); font: 500 0.75rem/1 var(--fd-prs-sans); color: var(--fd-prs-ink); }

/* stats */
.fd-prs-stats { padding: 40px 0 0; }
.fd-prs-stats-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.fd-prs-stats-row div { padding: 28px; border-radius: 26px; background: rgba(255,255,255,0.72); box-shadow: 0 0 0 1px rgba(255,255,255,0.9), 0 20px 40px -30px rgba(60,30,120,0.35); }
.fd-prs-stats-row dt { font: 650 clamp(2.25rem, 4vw, 3.5rem)/1 var(--fd-prs-sans); letter-spacing: -0.05em; font-variant-numeric: tabular-nums; }
.fd-prs-stats-row dd { margin-top: 10px; font: 400 0.9375rem/1.4 var(--fd-prs-sans); color: var(--fd-prs-mute); }

/* carousel */
.fd-prs-car-btns { display: flex; gap: 10px; }
.fd-prs-round { width: 52px; height: 52px; border-radius: 50%; }
.fd-prs-round button { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 50%; color: var(--fd-prs-ink); transition: transform var(--fd-dur-1) var(--fd-ease-out), opacity var(--fd-dur-2); }
.fd-prs-round button:active { transform: scale(0.92); }
.fd-prs-round button:disabled { opacity: 0.3; }
.fd-prs-car { margin-top: 48px; padding: 8px 0 40px; overflow: hidden; touch-action: pan-y; cursor: grab; user-select: none; -webkit-user-select: none; outline-offset: -4px; }
.fd-prs-car[data-drag] { cursor: grabbing; }
.fd-prs-car-track { display: flex; gap: 20px; width: max-content; padding: 0 max(32px, calc((100vw - 1200px) / 2 + 32px)); will-change: transform; }
.fd-prs-quote { display: flex; flex-direction: column; width: min(460px, 82vw); padding: 14px 14px 28px; border-radius: 32px; background: rgba(255,255,255,0.8); box-shadow: 0 0 0 1px rgba(255,255,255,0.9), 0 30px 60px -40px rgba(60,30,120,0.45); transition: transform var(--fd-dur-4) var(--fd-ease-out), opacity var(--fd-dur-4) var(--fd-ease-out); opacity: 0.6; transform: scale(0.97); }
.fd-prs-quote[data-active] { opacity: 1; transform: none; }
.fd-prs-quote-shot { position: relative; height: 220px; border-radius: 22px; overflow: hidden; }
.fd-prs-quote-metric { position: absolute; left: 12px; top: 12px; z-index: 2; display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 9999px; background: rgba(22,22,29,0.82); color: #fff; font: 600 0.8125rem/1 var(--fd-prs-sans); }
.fd-prs-quote blockquote { margin: 24px 14px 0; font: 500 1.25rem/1.4 var(--fd-prs-sans); letter-spacing: -0.02em; }
.fd-prs-quote figcaption { display: flex; flex-direction: column; gap: 2px; margin: 22px 14px 0; }
.fd-prs-quote figcaption b { font: 600 0.9375rem/1.3 var(--fd-prs-sans); }
.fd-prs-quote figcaption span { font: 400 0.875rem/1.3 var(--fd-prs-sans); color: var(--fd-prs-mute); }
.fd-prs-car-dots { display: flex; justify-content: center; gap: 8px; }
.fd-prs-car-dots i { width: 7px; height: 7px; border-radius: 9999px; background: rgba(22,22,29,0.2); transition: width var(--fd-dur-3) var(--fd-spring), background-color var(--fd-dur-3); }
.fd-prs-car-dots i[data-on] { width: 24px; background: var(--fd-prs-ink); }

/* pricing */
.fd-prs-seg { position: relative; display: inline-grid; grid-template-columns: 1fr 1fr; margin-top: 36px; padding: 5px; border-radius: 9999px; }
.fd-prs-seg button { position: relative; z-index: 3; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; padding: 0 22px; border-radius: 9999px; font: 500 0.9375rem/1 var(--fd-prs-sans); color: var(--fd-prs-ink); }
.fd-prs-seg em { font-size: 0.75rem; color: var(--fd-prs-accent); font-weight: 600; }
.fd-prs-seg-thumb { position: absolute; z-index: 2; top: 5px; bottom: 5px; left: 5px; width: calc(50% - 5px); border-radius: 9999px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 6px 16px -6px rgba(30,20,60,0.3); transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-prs-seg[data-yearly] .fd-prs-seg-thumb { transform: translateX(100%); }
.fd-prs-plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; margin-top: 56px; align-items: stretch; }
.fd-prs-plan { display: flex; flex-direction: column; padding: 32px; border-radius: 32px; background: rgba(255,255,255,0.82); box-shadow: 0 0 0 1px rgba(255,255,255,0.95), 0 30px 60px -40px rgba(60,30,120,0.4); }
.fd-prs-plan[data-hot] { background: var(--fd-prs-ink); color: #fff; box-shadow: 0 40px 80px -36px rgba(60,30,120,0.6); }
.fd-prs-plan-top { display: flex; justify-content: space-between; align-items: center; }
.fd-prs-plan h3 { font: 600 1.375rem/1.2 var(--fd-prs-sans); letter-spacing: -0.02em; }
.fd-prs-plan-tag { display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 9999px; background: rgba(255,255,255,0.14); font: 600 0.75rem/1 var(--fd-prs-sans); }
.fd-prs-plan-blurb { margin-top: 8px; font: 400 0.9375rem/1.45 var(--fd-prs-sans); color: var(--fd-prs-mute); }
.fd-prs-plan[data-hot] .fd-prs-plan-blurb, .fd-prs-plan[data-hot] .fd-prs-plan-bill, .fd-prs-plan[data-hot] .fd-prs-price-per { color: #b9b9c6; }
.fd-prs-price { display: flex; align-items: baseline; gap: 8px; margin-top: 30px; }
.fd-prs-price-n { display: inline-block; font: 650 3.5rem/1 var(--fd-prs-sans); letter-spacing: -0.055em; font-variant-numeric: tabular-nums; animation: fd-prs-pop var(--fd-dur-3) var(--fd-spring); }
@keyframes fd-prs-pop { from { opacity: 0; transform: translateY(10px) scale(0.92); } to { opacity: 1; transform: none; } }
.fd-prs-price-per { font: 400 1rem/1 var(--fd-prs-sans); color: var(--fd-prs-mute); }
.fd-prs-plan-bill { margin-top: 8px; font: 400 0.8125rem/1.4 var(--fd-prs-sans); color: var(--fd-prs-mute); }
.fd-prs-plan .fd-prs-btn { margin-top: 28px; width: 100%; }
.fd-prs-plan[data-hot] .fd-prs-btn { background: #fff; color: var(--fd-prs-ink); }
.fd-prs-plan ul { display: grid; gap: 12px; margin-top: 28px; }
.fd-prs-plan li { display: flex; gap: 10px; align-items: center; font: 400 0.9375rem/1.35 var(--fd-prs-sans); }
.fd-prs-plan li svg { flex: none; color: var(--fd-prs-accent); }
.fd-prs-plan[data-hot] li svg { color: #b7a8ff; }

/* before / after */
.fd-prs-cmp { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr); gap: 64px; align-items: center; }
.fd-prs-cmp-ctrl { display: grid; justify-items: start; gap: 10px; margin-top: 32px; }
.fd-prs-cmp-lab { margin-top: 6px; font: 600 0.8125rem/1.2 var(--fd-prs-sans); color: var(--fd-prs-mute); }
.fd-prs-pills { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 5px; border-radius: 26px; }
.fd-prs-pills button { display: inline-flex; align-items: center; height: 40px; padding: 0 16px; border-radius: 9999px; font: 500 0.9375rem/1 var(--fd-prs-sans); color: var(--fd-prs-ink); transition: background-color var(--fd-dur-2) var(--fd-ease-out), box-shadow var(--fd-dur-2) var(--fd-ease-out); }
.fd-prs-pills button:hover { background: rgba(22,22,29,0.06); }
.fd-prs-pills button[aria-pressed="true"] { background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 6px 16px -6px rgba(30,20,60,0.3); }
.fd-prs-cmp-stage { position: relative; width: 100%; max-width: 540px; aspect-ratio: 4 / 5; justify-self: end; border-radius: 36px; overflow: hidden; isolation: isolate; box-shadow: 0 50px 100px -40px rgba(60,30,120,0.4), 0 0 0 1px rgba(255,255,255,0.8); }
.fd-prs-cmp-after { position: absolute; inset: 0; }
.fd-prs-cmp-tag { position: absolute; top: 16px; z-index: 3; display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 9999px; background: rgba(22,22,29,0.82); color: #fff; font: 600 0.8125rem/1 var(--fd-prs-sans); pointer-events: none; }
.fd-prs-cmp-tag-l { left: 16px; }
.fd-prs-cmp-tag-r { right: 16px; }
.fd-prs-cmp-range { position: absolute; inset: 0; z-index: 5; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: ew-resize; touch-action: pan-y; }
.fd-prs-cmp-line { position: absolute; top: 0; bottom: 0; z-index: 4; width: 2px; margin-left: -1px; background: rgba(255,255,255,0.9); box-shadow: 0 0 0 1px rgba(22,22,29,0.12); pointer-events: none; }
.fd-prs-cmp-knob { position: absolute; left: 50%; top: 50%; display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; color: var(--fd-prs-ink); }
.fd-prs-cmp-knob svg { width: 14px; height: 14px; margin: 0 -2px; }
.fd-prs-cmp-range:focus-visible + .fd-prs-cmp-line .fd-prs-cmp-knob { outline: 2px solid rgba(91, 61, 245, 0.9); outline-offset: 3px; }

/* faq */
.fd-prs-faq { display: grid; gap: 12px; max-width: 760px; margin: 56px auto 0; }
.fd-prs-faq details { border-radius: 24px; background: rgba(255,255,255,0.8); box-shadow: 0 0 0 1px rgba(255,255,255,0.95), 0 20px 40px -32px rgba(60,30,120,0.4); }
.fd-prs-faq summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 22px 26px; border-radius: 24px; font: 600 1.0625rem/1.3 var(--fd-prs-sans); letter-spacing: -0.015em; cursor: pointer; list-style: none; }
.fd-prs-faq summary::-webkit-details-marker { display: none; }
.fd-prs-faq summary:focus-visible { outline: 2px solid rgba(91, 61, 245, 0.7); outline-offset: 2px; }
.fd-prs-faq summary svg { flex: none; color: var(--fd-prs-mute); transform: rotate(90deg); transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-prs-faq details[open] summary svg { transform: rotate(-90deg); }
.fd-prs-faq details p { max-width: 38em; padding: 0 26px 24px; font: 400 1rem/1.55 var(--fd-prs-sans); color: var(--fd-prs-mute); }

/* cta */
.fd-prs-cta { padding: 40px 0 140px; }
.fd-prs-cta-card { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); align-items: stretch; border-radius: 40px; overflow: hidden; background: rgba(255,255,255,0.78); box-shadow: 0 0 0 1px rgba(255,255,255,0.95), 0 50px 100px -50px rgba(60,30,120,0.5); }
.fd-prs-cta-copy { padding: 64px; }
.fd-prs-cta-h { font: 650 clamp(2.25rem, 4.6vw, 3.75rem)/1 var(--fd-prs-sans); letter-spacing: -0.045em; text-wrap: balance; }
.fd-prs-cta-btns { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.fd-prs-cta-shot { position: relative; min-height: 380px; }

/* footer */
.fd-prs-foot { padding: 64px 0 32px; background: rgba(255,255,255,0.6); border-top: 1px solid rgba(255,255,255,0.9); }
.fd-prs-foot-top { display: grid; grid-template-columns: 1.6fr repeat(3, minmax(0, 1fr)); gap: 32px; }
.fd-prs-foot-p { margin-top: 14px; max-width: 22em; font: 400 0.875rem/1.5 var(--fd-prs-sans); color: var(--fd-prs-mute); }
.fd-prs-foot h4 { font: 600 0.8125rem/1 var(--fd-prs-sans); }
.fd-prs-foot ul { display: grid; gap: 10px; margin-top: 16px; }
.fd-prs-foot ul a { font: 400 0.875rem/1.3 var(--fd-prs-sans); color: var(--fd-prs-mute); transition: color var(--fd-dur-1) linear; }
.fd-prs-foot ul a:hover { color: var(--fd-prs-ink); }
.fd-prs-foot-bot { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--fd-prs-line); font: 400 0.8125rem/1.3 var(--fd-prs-sans); color: var(--fd-prs-mute); }

/* reveal */
.fd-prs[data-js] [data-reveal] { opacity: 0; transform: translateY(26px) scale(0.985); transition: opacity var(--fd-dur-4) var(--fd-ease-out), transform 900ms var(--fd-ease-out); transition-delay: calc(var(--i, 0) * 80ms); }
.fd-prs[data-js] [data-reveal][data-in] { opacity: 1; transform: none; }
.fd-prs-gal-item[data-reveal] { transform: translateY(40px) scale(0.96); }

/* responsive */
@media (max-width: 1000px) {
  .fd-prs-nav-links, .fd-prs-nav-signin { display: none; }
  .fd-prs-burger { display: block; }
  .fd-prs-nav[data-condensed] .fd-prs-nav-in { max-width: none; padding: 0 32px; }
  .fd-prs-nav[data-condensed] .fd-prs-nav-glass { clip-path: inset(10px 16px 10px 16px round 9999px); }
  .fd-prs-hero-in { grid-template-columns: minmax(0, 1fr); gap: 40px; }
  .fd-prs-hero-stage { max-width: 620px; width: 100%; justify-self: center; }
  .fd-prs-studio-grid { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  .fd-prs-studio-stage { height: 52vh; }
  .fd-prs-scene-list h3 { font-size: 2rem; }
  .fd-prs-scene-list p { margin-top: 10px; font-size: 1rem; }
  .fd-prs-scene-dots { margin-top: 16px; }
  .fd-prs-stats-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fd-prs-plans { grid-template-columns: 1fr; max-width: 520px; margin-left: auto; margin-right: auto; }
  .fd-prs-cta-card { grid-template-columns: 1fr; }
  .fd-prs-cmp { grid-template-columns: minmax(0, 1fr); gap: 36px; }
  .fd-prs-cmp-stage { justify-self: center; max-width: 560px; }
  .fd-prs-cta-shot { min-height: 300px; }
}
@media (max-width: 720px) {
  .fd-prs-wrap, .fd-prs-nav-in, .fd-prs-nav[data-condensed] .fd-prs-nav-in { padding: 0 20px; }
  .fd-prs-nav-right .fd-prs-btn-sm { display: none; }
  .fd-prs-sheet { padding: 4px 32px 24px; }
  .fd-prs-sec { padding: 96px 0; }
  .fd-prs-hero { padding: 40px 0 88px; }
  .fd-prs-prompt { height: 56px; padding-left: 16px; }
  .fd-prs-prompt input { font-size: 0.9375rem; }
  .fd-prs-chip { min-height: 42px; padding: 6px 14px; font-size: 0.8125rem; }
  .fd-prs-chip-temp { width: 168px; padding: 12px 14px 14px; }
  .fd-prs-depth-3 { right: -2px; }
  .fd-prs-depth-3 { top: 3%; }
  .fd-prs-lens-stage { height: 520px; border-radius: 28px; }
  .fd-prs-lens { width: 170px; height: 170px; }
  .fd-prs-lens-shot { left: 6%; right: 6%; top: auto; bottom: 26%; width: auto; height: 34%; }
  .fd-prs-lens-grid { display: none; }
  .fd-prs-lens-ctrl { left: 16px; right: 16px; bottom: 16px; align-items: stretch; }
  .fd-prs-chip-strength { width: auto; }
  .fd-prs-mode { align-self: flex-start; }
  .fd-prs-studio { height: 300vh; }
  .fd-prs-studio-stage { height: 46vh; }
  .fd-prs-studio-c1 { left: 2%; top: 4%; }
  .fd-prs-studio-c2 { right: 2%; top: 56%; }
  .fd-prs-gal { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .fd-prs-gal-col { gap: 12px; }
  .fd-prs-gal-col:nth-child(3) { display: none; }
  .fd-prs-gal-col:nth-child(2) { margin-top: 40px; }
  .fd-prs-gal-item { border-radius: 20px; }
  .fd-prs-gal-item figcaption { left: 8px; bottom: 8px; height: 26px; padding: 0 9px; font-size: 0.6875rem; max-width: calc(100% - 16px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; line-height: 26px; }
  .fd-prs-stats-row div { padding: 20px; }
  .fd-prs-quote blockquote { font-size: 1.0625rem; }
  .fd-prs-quote-shot { height: 180px; }
  .fd-prs-car-track { padding: 0 20px; gap: 12px; }
  .fd-prs-cta { padding-bottom: 96px; }
  .fd-prs-cta-copy { padding: 36px 28px; }
  .fd-prs-foot-top { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fd-prs-foot-top > div:first-child { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-prs *, .fd-prs *::before, .fd-prs *::after { animation: none !important; }
  .fd-prs[data-js] [data-reveal] { transform: none !important; transition: opacity 120ms linear; transition-delay: 0ms; }
  .fd-prs-hero-stage, .fd-prs-stage-layer, .fd-prs-gal-col, .fd-prs-depth { transform: none !important; }
  .fd-prs-studio { height: auto; padding: 96px 0; }
  .fd-prs-studio-stick { position: relative; height: auto; }
  .fd-prs-scene-list { gap: 32px; }
  .fd-prs-scene-list li { grid-area: auto; opacity: 1; transform: none; }
  .fd-prs-scene-dots { display: none; }
  .fd-prs-quote { transition: none; }
  .fd-prs-fan-card, .fd-prs-shot-img, .fd-prs-g-bg, .fd-prs-g-all { transition: none; }
  .fd-prs-faq summary svg { transition: none; }
}
@media (prefers-reduced-transparency: reduce) {
  .fd-prs-glass, .fd-prs-glass[data-refract] { background: rgba(250,250,252,0.97); -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
  .fd-prs-lens { background: rgba(250,250,252,0.5); }
}
@media (prefers-contrast: more) {
  .fd-prs { --fd-prs-mute: #2f2f38; }
  .fd-prs-glass, .fd-prs-glass[data-refract] { background: #fff; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; box-shadow: 0 0 0 1px #16161d; }
  .fd-prs-mute { color: #3a3a44; }
}
`;
