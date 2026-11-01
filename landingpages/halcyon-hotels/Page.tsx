/**
 * Halcyon — boutique hotels on the Amalfi coast and in Kyoto.
 *
 * Demo images: /img/halcyon/{positano-sunset,pool-lemons,suite,ryokan,courtyard-pool,journals}.webp (each with
 * -900 and -480 variants), included in the repo's public/img/halcyon — copy them next to your page or swap in your own.
 *
 * A warm, editorial luxury-hospitality homepage with real photography
 * and no web fonts.
 *
 * Motion (all scroll effects are transform/opacity driven by one rAF loop
 * that writes a `--p` progress variable onto `[data-hal-p]` elements):
 *  - Pinned hero: the Positano sunset photograph slowly pushes in and
 *    darkens to dusk as you scroll.
 *  - Booking bar: sticky at the bottom of the first screen, then docks
 *    under the condensed nav once you scroll past the hero.
 *  - Clip-path image reveals, a pinned horizontal "houses" gallery,
 *    hover-zoom room cards, an editorial rituals list with crossfading
 *    frame, an auto-advancing testimonial crossfade, map pins that drop
 *    in with routes drawing, and a newsletter form in the footer.
 *
 * Reduced motion: parallax, pinning and autoplay are removed; the gallery
 * becomes a native swipe row; state changes stay instant.
 * SSR-safe: no window/document access during render.
 * Accessibility: real buttons/inputs/labels, visible focus rings,
 * aria-live for the booking result and testimonial, AA contrast.
 */
import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Photography (pre-rendered, see /img/lux)                            */
/* ------------------------------------------------------------------ */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type SceneKind = "positano" | "ravello" | "gion" | "arashiyama" | "roomSea" | "roomKyoto" | "pool" | "boat" | "tea" | "lantern";

type Ph = { f: string; alt?: string; pos: string; zoom?: number };
const PHOTO: Record<SceneKind, Ph> = {
  positano: { f: "positano-sunset", alt: "pastel houses stacked up the hillside above the sea at sunset", pos: "50% 55%" },
  ravello: { f: "pool-lemons", alt: "lemon pergola and infinity pool above the Amalfi coastline", pos: "50% 50%" },
  gion: { f: "ryokan", alt: "tatami room with shoji screens opening onto a maple garden", pos: "40% 45%" },
  arashiyama: { f: "ryokan", alt: "red maple and moss garden seen through an open shoji screen", pos: "78% 30%", zoom: 1.7 },
  roomSea: { f: "suite", alt: "white bed and sea-view terrace beyond an open arched window", pos: "50% 55%" },
  roomKyoto: { f: "ryokan", alt: "hinoki tub and tatami floor beside a garden doorway", pos: "40% 95%", zoom: 1.5 },
  pool: { f: "courtyard-pool", alt: "plunge pool and sun loungers under a lemon tree against stone walls", pos: "50% 60%" },
  boat: { f: "positano-sunset", alt: "calm Amalfi sea at sunset with a distant headland", pos: "8% 30%", zoom: 1.9 },
  tea: { f: "ryokan", alt: "tatami room and wooden tub beside a moss garden", pos: "70% 55%", zoom: 1.25 },
  lantern: { f: "ryokan", alt: "wooden shoji lattice windows of a Kyoto townhouse", pos: "8% 40%", zoom: 1.7 },
};

/** Responsive photograph from public/img/halcyon (480 / 900 / 1024 px, square). */
function Photo({ f, alt, className, style, eager = false, sizes }: { f: string; alt: string; className?: string; style?: CSSProperties; eager?: boolean; sizes: string }) {
  return (
    <img
      className={className}
      src={`/img/halcyon/${f}-900.webp`}
      srcSet={`/img/halcyon/${f}-480.webp 480w, /img/halcyon/${f}-900.webp 900w, /img/halcyon/${f}.webp 1024w`}
      sizes={sizes}
      width={1024}
      height={1024}
      alt={alt}
      loading={eager ? undefined : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      style={style}
    />
  );
}

const Scene = memo(function Scene({ kind, label }: { kind: SceneKind; label: string }) {
  const p = PHOTO[kind];
  return <Photo f={p.f} alt={label.split(" ").length > 7 ? label : `${label}: ${p.alt}`} className="hal-scene" sizes="(max-width: 700px) 100vw, 40vw" style={{ objectPosition: p.pos, scale: p.zoom, transformOrigin: p.pos }} />;
});

/* Hero: the Positano photograph; a graded copy fades in as you scroll for dusk. */
const HeroLandscape = memo(function HeroLandscape() {
  return (
    <div className="hal-hero-scene">
      <Photo f="positano-sunset" alt="Positano terraces at golden hour, pastel houses stacked up the hillside above the Amalfi Coast sea" className="hal-hero-img" eager sizes="100vw" />
      <Photo f="positano-sunset" alt="" className="hal-hero-img hal-dusk" sizes="100vw" />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
const HOUSES: { name: string; place: string; scene: SceneKind; rooms: number; since: string; from: string; note: string }[] = [
  { name: "Casa Halcyon", place: "Positano, Amalfi Coast", scene: "positano", rooms: 24, since: "1962", from: "€690", note: "Fourteen terraces stacked above Spiaggia Grande; the lift opens into a lemon grove." },
  { name: "Villa Limoni", place: "Ravello, Amalfi Coast", scene: "ravello", rooms: 17, since: "2009", from: "€820", note: "A 13th-century merchant's villa, 365 metres above the sea, with a pergola you can dine under." },
  { name: "Halcyon Gion", place: "Higashiyama, Kyoto", scene: "gion", rooms: 21, since: "2018", from: "¥96,000", note: "Three restored machiya townhouses joined by a moss courtyard, a minute from Yasaka-jinja." },
  { name: "Halcyon Arashiyama", place: "Ukyō-ku, Kyoto", scene: "arashiyama", rooms: 24, since: "2023", from: "¥118,000", note: "A riverside ryokan with hinoki baths and a private path into the bamboo before 7 a.m." },
];

const ROOMS: { name: string; house: string; scene: SceneKind; size: string; feat: string; price: string }[] = [
  { name: "Sea-view Junior Suite", house: "Casa Halcyon · Positano", scene: "roomSea", size: "42 m²", feat: "Private terrace · rain shower", price: "€740" },
  { name: "Garden Ryokan Room", house: "Halcyon Arashiyama · Kyoto", scene: "roomKyoto", size: "38 m²", feat: "Hinoki tub · futon or bed", price: "¥118,000" },
  { name: "Lemon Terrace Suite", house: "Villa Limoni · Ravello", scene: "pool", size: "64 m²", feat: "Plunge pool · pergola", price: "€1,180" },
];

const RITUALS: { time: string; title: string; where: string; scene: SceneKind }[] = [
  { time: "06:10", title: "The first boat to Li Galli", where: "Casa Halcyon · with Capitano Enzo", scene: "boat" },
  { time: "11:00", title: "Lemon harvest on the upper terraces", where: "Villa Limoni · with Signora Aurelia", scene: "ravello" },
  { time: "16:30", title: "Tea in the moss courtyard", where: "Halcyon Gion · usucha & wagashi", scene: "tea" },
  { time: "21:00", title: "Lantern walk through Higashiyama", where: "Halcyon Gion · after the crowds", scene: "lantern" },
];

const QUOTES: { q: string; who: string; stay: string }[] = [
  { q: "We came for three nights and stayed six. Somebody had pressed our linen with lemon leaves; I still don't know how they knew.", who: "Margot & Lise Verhoeven", stay: "Casa Halcyon · June 2026" },
  { q: "The bath was filled at the exact moment the bamboo went quiet. Nothing was announced. Everything was anticipated.", who: "Daniel Okafor", stay: "Halcyon Arashiyama · April 2026" },
  { q: "Dinner under the pergola, the coast turning violet below us — the best table I have sat at in twenty years of travel.", who: "Inés Calderón", stay: "Villa Limoni · September 2025" },
  { q: "They walked us through Gion at nine, when the lanterns are lit and the streets finally belong to the people who live there.", who: "Henrik & Sofie Lund", stay: "Halcyon Gion · November 2025" },
];

const DATES = ["Thu 13 May", "Fri 14 May", "Sat 15 May", "Sun 16 May", "Mon 17 May", "Tue 18 May", "Wed 19 May", "Thu 20 May", "Fri 21 May", "Sat 22 May", "Sun 23 May", "Mon 24 May", "Tue 25 May", "Wed 26 May"];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export function Page() {
  const rootRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const [navSmall, setNavSmall] = useState(false);
  const [docked, setDocked] = useState(false);
  const [dest, setDest] = useState<"amalfi" | "kyoto">("amalfi");
  const [arrive, setArrive] = useState(1);
  const [nights, setNights] = useState(4);
  const [guests, setGuests] = useState(2);
  const [datesOpen, setDatesOpen] = useState(false);
  const [result, setResult] = useState("");
  const [ritual, setRitual] = useState(0);
  const [quote, setQuote] = useState(0);
  const [quotePaused, setQuotePaused] = useState(false);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /* Scroll engine: progress vars, nav + dock state, reveals, gallery sizing. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    if (!win) return;
    const reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.classList.add("hal-js");

    // Hosts that put overflow:hidden on BOTH <html> and <body> turn <body> into a
    // non-scrolling scroll container, which silently breaks position:sticky.
    // `clip` gives the same visual result without that side effect.
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

    const progEls = Array.from(root.querySelectorAll<HTMLElement>("[data-hal-p]"));
    const gallery = root.querySelector<HTMLElement>(".hal-houses");
    const track = root.querySelector<HTMLElement>(".hal-houses-track");
    const bar = root.querySelector<HTMLElement>(".hal-book");
    const cur = root.querySelector<HTMLElement>(".hal-houses-cur");
    const hero = root.querySelector<HTMLElement>(".hal-hero");
    let galleryOn = false;

    const measure = () => {
      galleryOn = !reduce && win.innerWidth > 900;
      if (gallery && track) {
        const dist = galleryOn ? Math.max(0, track.scrollWidth - win.innerWidth) : 0;
        gallery.style.setProperty("--dist", `${dist}px`);
        gallery.dataset.dist = String(dist);
      }
    };

    let raf = 0;
    let lastSmall = false;
    let lastDock = false;
    const update = () => {
      raf = 0;
      const vh = win.innerHeight;
      for (const el of progEls) {
        const r = el.getBoundingClientRect();
        const mode = el.dataset.halP;
        let p = 0;
        if (mode === "pin") p = (-r.top) / Math.max(1, r.height - vh);
        else p = (vh - r.top) / (vh + r.height);
        p = Math.min(1, Math.max(0, p));
        el.style.setProperty("--p", p.toFixed(4));
        if (el === gallery && track) {
          const dist = Number(gallery.dataset.dist || 0);
          track.style.transform = galleryOn ? `translate3d(${(-p * dist).toFixed(1)}px,0,0)` : "";
          if (cur) cur.textContent = `0${Math.min(HOUSES.length, 1 + Math.floor(p * HOUSES.length * 0.999))}`;
        }
        if (el === hero && clockRef.current) {
          const mins = Math.round(lerp(17 * 60 + 42, 20 * 60 + 16, Math.min(1, p * 1.25)));
          clockRef.current.textContent = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
          el.classList.toggle("is-dusk", p > 0.45);
        }
      }
      const y = win.scrollY || doc.documentElement.scrollTop;
      const small = y > 24;
      if (small !== lastSmall) {
        lastSmall = small;
        setNavSmall(small);
      }
      if (bar) {
        const top = bar.getBoundingClientRect().top;
        const dock = top < 120 && y > vh * 0.5;
        if (dock !== lastDock) {
          lastDock = dock;
          setDocked(dock);
        }
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

    // One-shot reveals.
    const io = new win.IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    root.querySelectorAll("[data-hal-rv]").forEach((el) => io.observe(el));

    return () => {
      win.cancelAnimationFrame(fixRaf);
      if (raf) win.cancelAnimationFrame(raf);
      win.removeEventListener("scroll", onScroll);
      win.removeEventListener("resize", onResize);
      io.disconnect();
      restoreBody?.();
      root.classList.remove("hal-js");
    };
  }, []);

  /* Testimonial autoplay (paused on hover/focus, off for reduced motion or hidden tab). */
  useEffect(() => {
    const root = rootRef.current;
    const win = root?.ownerDocument.defaultView;
    if (!win || quotePaused) return;
    if (win.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = win.setInterval(() => {
      if (!root!.ownerDocument.hidden) setQuote((q) => (q + 1) % QUOTES.length);
    }, 6500);
    return () => win.clearInterval(t);
  }, [quotePaused]);

  const depart = DATES[Math.min(DATES.length - 1, arrive + nights)] ?? DATES[DATES.length - 1];
  const nightly = dest === "amalfi" ? 690 : 640;
  const check = () => {
    const suites = dest === "amalfi" ? 5 + (arrive % 3) : 3 + (arrive % 4);
    setResult(
      `${suites} rooms open ${DATES[arrive].replace(/^\w+ /, "")}–${depart.replace(/^\w+ /, "")} · from €${(nightly + guests * 35).toLocaleString("en-GB")} a night`,
    );
  };

  const navLinks = ["Houses", "Rooms", "Rituals", "Journal", "Gift cards"];

  return (
    <div ref={rootRef} className="hal">
      <style>{css}</style>
      <a className="hal-skip" href="#hal-main">Skip to content</a>

      {/* NAV */}
      <header className={`hal-nav${navSmall ? " is-small" : ""}${menuOpen ? " is-open" : ""}`}>
        <div className="hal-nav-bar">
          <a className="hal-logo" href="#hal-top" aria-label="Halcyon — home">
            <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false"><circle cx="14" cy="14" r="13" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M3 16.5 C 8 13.5 11 13.5 14 15 S 20 16.5 25 13.5" fill="none" stroke="currentColor" strokeWidth="1.2" /><circle cx="14" cy="10" r="3.2" fill="currentColor" /></svg>
            <span>Halcyon</span>
          </a>
          <nav className="hal-nav-links" aria-label="Primary">
            {navLinks.map((l) => (
              <a key={l} href={`#hal-${l.toLowerCase().replace(/\s/g, "")}`}>{l}</a>
            ))}
          </nav>
          <div className="hal-nav-end">
            <a className="hal-nav-lang" href="#hal-top" aria-label="Language: English">EN</a>
            <a className="hal-btn hal-btn-ink hal-btn-sm" href="#hal-book">Reserve</a>
            <button className="hal-burger" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              <span /><span />
            </button>
          </div>
        </div>
        <div className="hal-sheet" hidden={!menuOpen}>
          {navLinks.map((l) => (
            <a key={l} href={`#hal-${l.toLowerCase().replace(/\s/g, "")}`} onClick={() => setMenuOpen(false)}>{l}</a>
          ))}
        </div>
      </header>

      <main id="hal-main">
        {/* HERO — pinned, time-of-day */}
        <section id="hal-top" className="hal-hero" data-hal-p="pin" aria-labelledby="hal-hero-title">
          <div className="hal-hero-pin">
            <HeroLandscape />
            <div className="hal-hero-copy">
              <p className="hal-eyebrow hal-hero-eyebrow">
                <span>Positano</span>
                <i aria-hidden="true" />
                <span ref={clockRef} className="hal-clock">17:42</span>
                <i aria-hidden="true" />
                <span>24°C, sea calm</span>
              </p>
              <h1 id="hal-hero-title" className="hal-hero-title">
                <span className="hal-line"><span>Where the light</span></span>
                <span className="hal-line"><span><em>lingers</em> longer.</span></span>
              </h1>
              <p className="hal-hero-sub">Four small houses on the Amalfi coast and in Kyoto, kept by the same families since 1962. Eighty-six rooms, no lobbies, and a staff who will remember how you take your coffee.</p>
            </div>
            <p className="hal-hero-scroll" aria-hidden="true"><span />Scroll for dusk</p>
          </div>
        </section>

        {/* BOOKING BAR — floats at the bottom of screen one, docks under the nav */}
        <div id="hal-book" className={`hal-book${docked ? " is-docked" : ""}`}>
          <form className="hal-book-card" onSubmit={(e) => { e.preventDefault(); check(); }} aria-label="Check availability">
            <div className="hal-field hal-field-dest" role="group" aria-labelledby="hal-dest-l">
              <span className="hal-label" id="hal-dest-l">Destination</span>
              <div className="hal-seg" role="radiogroup" aria-label="Destination">
                {(["amalfi", "kyoto"] as const).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={dest === v} className={dest === v ? "is-on" : ""} onClick={() => { setDest(v); setResult(""); }}>
                    {v === "amalfi" ? "Amalfi Coast" : "Kyoto"}
                  </button>
                ))}
                <span className="hal-seg-thumb" style={{ transform: `translateX(${dest === "amalfi" ? 0 : 100}%)` }} aria-hidden="true" />
              </div>
            </div>
            <div className="hal-field hal-field-date">
              <span className="hal-label" id="hal-arrive-l">Arrive</span>
              <button type="button" className="hal-date-btn" aria-labelledby="hal-arrive-l" aria-expanded={datesOpen} onClick={() => setDatesOpen((o) => !o)}>
                {DATES[arrive]} <small>→ {depart}</small>
              </button>
              {datesOpen && (
                <div className="hal-pop" role="listbox" aria-label="Arrival date, May 2027">
                  <p className="hal-pop-title">May 2027</p>
                  <div className="hal-pop-grid">
                    {DATES.slice(0, 12).map((dd, i) => (
                      <button key={dd} type="button" role="option" aria-selected={arrive === i} className={arrive === i ? "is-on" : ""} onClick={() => { setArrive(i); setDatesOpen(false); setResult(""); }}>
                        <small>{dd.slice(0, 3)}</small>
                        {dd.split(" ")[1]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="hal-field">
              <span className="hal-label">Nights</span>
              <div className="hal-step">
                <button type="button" aria-label="Fewer nights" onClick={() => setNights((n) => Math.max(1, n - 1))}>−</button>
                <output aria-live="polite">{nights}</output>
                <button type="button" aria-label="More nights" onClick={() => setNights((n) => Math.min(10, n + 1))}>+</button>
              </div>
            </div>
            <div className="hal-field">
              <span className="hal-label">Guests</span>
              <div className="hal-step">
                <button type="button" aria-label="Fewer guests" onClick={() => setGuests((n) => Math.max(1, n - 1))}>−</button>
                <output aria-live="polite">{guests}</output>
                <button type="button" aria-label="More guests" onClick={() => setGuests((n) => Math.min(6, n + 1))}>+</button>
              </div>
            </div>
            <button className="hal-btn hal-btn-terra hal-book-cta" type="submit">
              <span className="hal-cta-full">Check availability</span>
              <span className="hal-cta-short" aria-hidden="true">Search</span>
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            </button>
            <p className={`hal-book-result${result ? " is-on" : ""}`} aria-live="polite">{result}</p>
          </form>
        </div>

        {/* INTRO */}
        <section className="hal-intro" aria-labelledby="hal-intro-title">
          <div className="hal-wrap hal-intro-grid">
            <div className="hal-intro-text">
              <p className="hal-eyebrow" data-hal-rv>Est. 1962 · Positano</p>
              <h2 id="hal-intro-title" className="hal-h2" data-hal-rv>A house is not a hotel until somebody waits up for you.</h2>
              <p className="hal-lede hal-drop" data-hal-rv>Nonna Teresa Aiello opened eight rooms above Spiaggia Grande with a borrowed espresso machine and a rule that every guest be met at the boat. Sixty-four years later her grandchildren keep four houses on two coasts — and the rule.</p>
              <p className="hal-body" data-hal-rv>We have never built a lobby. You arrive into a kitchen, a garden, a tea room. Rooms are named, not numbered. In Kyoto we found a family who had been doing the same for nine generations, and asked if we might learn.</p>
              <dl className="hal-figs" data-hal-rv>
                <div><dt>Houses</dt><dd>4</dd></div>
                <div><dt>Rooms & suites</dt><dd>86</dd></div>
                <div><dt>Guests who return</dt><dd>61%</dd></div>
              </dl>
            </div>
            <div className="hal-intro-media" data-hal-p="view">
              <figure className="hal-clip hal-clip-a" data-hal-rv>
                <div className="hal-clip-in"><Scene kind="positano" label="Casa Halcyon's terraces above Positano at golden hour" /></div>
                <figcaption>Casa Halcyon, from the ferry at 18:20</figcaption>
              </figure>
              <figure className="hal-clip hal-clip-b" data-hal-rv>
                <div className="hal-clip-in"><Scene kind="roomKyoto" label="A tatami room at Halcyon Arashiyama opening onto a maple garden" /></div>
                <figcaption>Room Kaede, Arashiyama</figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* HOUSES — pinned horizontal gallery */}
        <section id="hal-houses" className="hal-houses" data-hal-p="pin" aria-labelledby="hal-houses-title">
          <div className="hal-houses-pin">
            <div className="hal-houses-head hal-wrap">
              <div>
                <p className="hal-eyebrow">The houses</p>
                <h2 id="hal-houses-title" className="hal-h2">Four houses, two coasts.</h2>
              </div>
              <div className="hal-houses-meter" aria-hidden="true">
                <span className="hal-houses-bar"><i /></span>
                <span className="hal-houses-count"><b className="hal-houses-cur">01</b> — 04</span>
              </div>
            </div>
            <ol className="hal-houses-track">
              {HOUSES.map((h, i) => (
                <li key={h.name} className="hal-house">
                  <a href="#hal-rooms" className="hal-house-link" aria-label={`${h.name}, ${h.place} — from ${h.from} a night`}>
                    <div className="hal-house-img"><div className="hal-house-par"><Scene kind={h.scene} label={`${h.name}, ${h.place}`} /></div></div>
                    <div className="hal-house-info">
                      <span className="hal-house-n">0{i + 1}</span>
                      <div>
                        <h3 className="hal-h3">{h.name}</h3>
                        <p className="hal-house-place">{h.place} · since {h.since}</p>
                        <p className="hal-house-note">{h.note}</p>
                      </div>
                      <p className="hal-house-meta"><span>{h.rooms} rooms</span><span>from {h.from}</span></p>
                    </div>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ROOMS */}
        <section id="hal-rooms" className="hal-rooms" aria-labelledby="hal-rooms-title">
          <div className="hal-wrap">
            <div className="hal-sec-head">
              <p className="hal-eyebrow" data-hal-rv>Rooms & suites</p>
              <h2 id="hal-rooms-title" className="hal-h2" data-hal-rv>Rooms are named, never numbered.</h2>
              <p className="hal-body hal-sec-sub" data-hal-rv>Every room has a window that frames something worth waking for. Rates include breakfast, the minibar, and the boat or car from wherever you land.</p>
            </div>
            <ul className="hal-room-grid">
              {ROOMS.map((r, i) => (
                <li key={r.name} className="hal-room" data-hal-rv style={{ "--d": `${i * 90}ms` } as CSSProperties}>
                  <a href="#hal-book" className="hal-room-link">
                    <div className="hal-room-img"><Scene kind={r.scene} label={`${r.name} at ${r.house}`} /></div>
                    <div className="hal-room-body">
                      <p className="hal-room-house">{r.house}</p>
                      <h3 className="hal-h3">{r.name}</h3>
                      <p className="hal-room-feat">{r.size} · {r.feat}</p>
                      <p className="hal-room-foot">
                        <span>from <strong>{r.price}</strong> / night</span>
                        <span className="hal-room-cta">View room <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></span>
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* RITUALS */}
        <section id="hal-rituals" className="hal-rituals" aria-labelledby="hal-rituals-title">
          <div className="hal-wrap hal-rituals-grid">
            <div className="hal-rituals-frame" aria-hidden="true">
              {RITUALS.map((r, i) => (
                <div key={r.title} className={`hal-rituals-img${ritual === i ? " is-on" : ""}`}><Scene kind={r.scene} label={r.title} /></div>
              ))}
              <span className="hal-rituals-time">{RITUALS[ritual].time}</span>
            </div>
            <div>
              <p className="hal-eyebrow" data-hal-rv>A day, kept slowly</p>
              <h2 id="hal-rituals-title" className="hal-h2" data-hal-rv>Small rituals, booked by nobody.</h2>
              <ol className="hal-rituals-list">
                {RITUALS.map((r, i) => (
                  <li key={r.title}>
                    <button type="button" className={`hal-ritual${ritual === i ? " is-on" : ""}`} aria-pressed={ritual === i} onMouseEnter={() => setRitual(i)} onFocus={() => setRitual(i)} onClick={() => setRitual(i)}>
                      <span className="hal-ritual-time">{r.time}</span>
                      <span className="hal-ritual-title">{r.title}</span>
                      <span className="hal-ritual-where">{r.where}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="hal-quotes" aria-labelledby="hal-quotes-title" onMouseEnter={() => setQuotePaused(true)} onMouseLeave={() => setQuotePaused(false)} onFocus={() => setQuotePaused(true)} onBlur={() => setQuotePaused(false)}>
          <div className="hal-wrap hal-quotes-in">
            <figure className="hal-quotes-fig" data-hal-p="view">
              <Photo f="journals" alt="Hand-written family journals and faded photographs spread on terracotta" className="hal-quotes-img" sizes="(max-width: 900px) 90vw, 480px" />
            </figure>
            <div className="hal-quotes-body">
            <h2 id="hal-quotes-title" className="hal-eyebrow">From the guest book</h2>
            <div className="hal-quote-stack" aria-live="polite">
              {QUOTES.map((q, i) => (
                <figure key={q.who} className={`hal-quote${quote === i ? " is-on" : ""}`} aria-hidden={quote !== i}>
                  <blockquote><p>“{q.q}”</p></blockquote>
                  <figcaption><strong>{q.who}</strong><span>{q.stay}</span></figcaption>
                </figure>
              ))}
            </div>
            <div className="hal-quote-dots">
              {QUOTES.map((q, i) => (
                <button key={q.who} type="button" aria-label={`Show quote ${i + 1} of ${QUOTES.length}: ${q.who}`} aria-current={quote === i} className={quote === i ? "is-on" : ""} onClick={() => setQuote(i)}>
                  <i style={{ animationPlayState: quotePaused ? "paused" : "running" }} />
                </button>
              ))}
            </div>
            </div>
          </div>
        </section>

        {/* MAP */}
        <section id="hal-journal" className="hal-map" aria-labelledby="hal-map-title">
          <div className="hal-wrap">
            <div className="hal-sec-head">
              <p className="hal-eyebrow" data-hal-rv>Getting here</p>
              <h2 id="hal-map-title" className="hal-h2" data-hal-rv>Two coasts, 9,600 km apart, one way of keeping house.</h2>
            </div>
            <div className="hal-map-grid">
              <figure className="hal-map-card" data-hal-rv>
                <svg className="hal-map-svg" viewBox="0 0 600 420" role="img" aria-label="Map of the Amalfi Coast with Casa Halcyon in Positano and Villa Limoni in Ravello">
                  <rect width="600" height="420" fill="#E7EEEC" />
                  <path d="M0 120 C 60 130 110 170 150 200 C 190 230 230 226 270 240 C 320 256 350 250 390 238 C 430 226 470 236 520 210 C 550 196 580 170 600 160 L600 0 L0 0Z" fill="#EDE3D2" />
                  <path className="hal-draw" d="M0 120 C 60 130 110 170 150 200 C 190 230 230 226 270 240 C 320 256 350 250 390 238 C 430 226 470 236 520 210 C 550 196 580 170 600 160" fill="none" stroke="#A9502B" strokeWidth="1.5" />
                  <path className="hal-draw hal-draw-route" d="M180 220 C 240 300 380 300 420 240" fill="none" stroke="#2F5866" strokeWidth="1.5" strokeDasharray="4 6" />
                  <ellipse cx="80" cy="330" rx="40" ry="16" fill="#EDE3D2" />
                  <text x="80" y="370" className="hal-map-t hal-map-t-sm" textAnchor="middle">Capri</text>
                  <text x="300" y="380" className="hal-map-t hal-map-t-sea" textAnchor="middle">Golfo di Salerno</text>
                  <text x="300" y="90" className="hal-map-t hal-map-t-sm" textAnchor="middle">Monti Lattari</text>
                  <g className="hal-pin" style={{ "--d": "300ms" } as CSSProperties} transform="translate(180 214)">
                    <path d="M0 0 C -10 -14 -14 -20 -14 -28 A14 14 0 0 1 14 -28 C 14 -20 10 -14 0 0Z" fill="#A9502B" />
                    <circle cy="-28" r="5" fill="#FBF8F3" />
                  </g>
                  <text x="180" y="244" className="hal-map-t" textAnchor="middle">Positano</text>
                  <g className="hal-pin" style={{ "--d": "520ms" } as CSSProperties} transform="translate(420 232)">
                    <path d="M0 0 C -10 -14 -14 -20 -14 -28 A14 14 0 0 1 14 -28 C 14 -20 10 -14 0 0Z" fill="#A9502B" />
                    <circle cy="-28" r="5" fill="#FBF8F3" />
                  </g>
                  <text x="420" y="262" className="hal-map-t" textAnchor="middle">Ravello</text>
                </svg>
                <figcaption>
                  <strong>Amalfi Coast</strong>
                  <span>Naples airport → Positano 75 min by car, or 40 min by our boat from Salerno. Positano → Ravello 35 min along the SS163.</span>
                </figcaption>
              </figure>
              <figure className="hal-map-card" data-hal-rv style={{ "--d": "120ms" } as CSSProperties}>
                <svg className="hal-map-svg" viewBox="0 0 600 420" role="img" aria-label="Map of Kyoto with Halcyon Gion in Higashiyama and Halcyon Arashiyama in the west">
                  <rect width="600" height="420" fill="#EEEADF" />
                  {Array.from({ length: 9 }).map((_, i) => (
                    <line key={`v${i}`} x1={160 + i * 40} y1="40" x2={160 + i * 40} y2="400" stroke="#DCD3C1" strokeWidth="1" />
                  ))}
                  {Array.from({ length: 9 }).map((_, i) => (
                    <line key={`h${i}`} x1="160" y1={40 + i * 45} x2="500" y2={40 + i * 45} stroke="#DCD3C1" strokeWidth="1" />
                  ))}
                  <path d="M0 0 L120 0 C 100 80 90 160 110 240 C 120 300 90 360 60 420 L0 420Z" fill="#DCE2CC" />
                  <path className="hal-draw" d="M430 0 C 440 80 445 160 438 240 C 432 320 440 380 450 420" fill="none" stroke="#7FA3AC" strokeWidth="5" />
                  <path className="hal-draw" d="M70 60 C 90 140 70 220 100 300 C 120 350 140 390 150 420" fill="none" stroke="#7FA3AC" strokeWidth="4" />
                  <path className="hal-draw hal-draw-route" d="M110 200 C 200 250 360 250 470 190" fill="none" stroke="#2F5866" strokeWidth="1.5" strokeDasharray="4 6" />
                  <text x="448" y="400" className="hal-map-t hal-map-t-sea">Kamo-gawa</text>
                  <rect x="300" y="355" width="70" height="16" fill="#D6CDB9" />
                  <text x="335" y="390" className="hal-map-t hal-map-t-sm" textAnchor="middle">Kyoto Station</text>
                  <g className="hal-pin" style={{ "--d": "300ms" } as CSSProperties} transform="translate(110 196)">
                    <path d="M0 0 C -10 -14 -14 -20 -14 -28 A14 14 0 0 1 14 -28 C 14 -20 10 -14 0 0Z" fill="#A9502B" />
                    <circle cy="-28" r="5" fill="#FBF8F3" />
                  </g>
                  <text x="110" y="226" className="hal-map-t" textAnchor="middle">Arashiyama</text>
                  <g className="hal-pin" style={{ "--d": "520ms" } as CSSProperties} transform="translate(470 186)">
                    <path d="M0 0 C -10 -14 -14 -20 -14 -28 A14 14 0 0 1 14 -28 C 14 -20 10 -14 0 0Z" fill="#A9502B" />
                    <circle cy="-28" r="5" fill="#FBF8F3" />
                  </g>
                  <text x="470" y="216" className="hal-map-t" textAnchor="middle">Gion</text>
                </svg>
                <figcaption>
                  <strong>Kyoto</strong>
                  <span>Kyoto Station → Gion 18 min, → Arashiyama 25 min. Our car meets every Nozomi; a house-to-house transfer runs twice daily.</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER + NEWSLETTER */}
      <footer className="hal-foot">
        <div className="hal-wrap">
          <div className="hal-news">
            <div>
              <p className="hal-eyebrow hal-eyebrow-light">Letters from the coast</p>
              <h2 className="hal-h2 hal-news-title">Four letters a year. Never more.</h2>
              <p className="hal-news-sub">First word on the lemon harvest, autumn rooms in Kyoto, and the week each spring we open Casa Halcyon early.</p>
            </div>
            <form className="hal-news-form" onSubmit={(e) => { e.preventDefault(); if (/\S+@\S+\.\S+/.test(email)) setSubscribed(true); }}>
              <label className="hal-news-label" htmlFor="hal-email">Email address</label>
              <div className={`hal-news-row${subscribed ? " is-done" : ""}`}>
                <input id="hal-email" type="email" required placeholder="you@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={subscribed} />
                <button type="submit" className="hal-btn hal-btn-sand" disabled={subscribed}>{subscribed ? "Subscribed" : "Subscribe"}</button>
              </div>
              <p className="hal-news-note" aria-live="polite">{subscribed ? `Grazie — the next letter reaches ${email} in early spring.` : "We never share your address. Unsubscribe in one click."}</p>
            </form>
          </div>
          <div className="hal-foot-cols">
            <div>
              <p className="hal-foot-h">Houses</p>
              <ul>{HOUSES.map((h) => <li key={h.name}><a href="#hal-houses">{h.name}</a></li>)}</ul>
            </div>
            <div>
              <p className="hal-foot-h">Stay</p>
              <ul>{["Rooms & suites", "Seasonal offers", "Gift cards", "Weddings & buy-outs"].map((x) => <li key={x}><a href="#hal-rooms">{x}</a></li>)}</ul>
            </div>
            <div>
              <p className="hal-foot-h">Halcyon</p>
              <ul>{["Our story", "Careers", "Press room", "Sustainability report 2025"].map((x) => <li key={x}><a href="#hal-top">{x}</a></li>)}</ul>
            </div>
            <div>
              <p className="hal-foot-h">Reservations</p>
              <ul>
                <li><a href="#hal-book">+39 089 875 0162</a></li>
                <li><a href="#hal-book">stay@halcyon.example</a></li>
                <li><span>Daily 08:00–22:00 CET</span></li>
              </ul>
            </div>
          </div>
          <p className="hal-foot-mark" aria-hidden="true">Halcyon</p>
          <div className="hal-foot-legal">
            <span>© 2026 Halcyon Case & Ryokan S.r.l. · Via Cristoforo Colombo 41, 84017 Positano (SA)</span>
            <span><a href="#hal-top">Privacy</a><a href="#hal-top">Cookies</a><a href="#hal-top">Accessibility</a></span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Page;

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const css = String.raw`
.hal {
  --hal-sand: #F3ECE2;
  --hal-paper: #FBF8F3;
  --hal-ink: #1E1915;
  --hal-ink-2: #5B5048;
  --hal-terra: #A9502B;
  --hal-terra-2: #C8693F;
  --hal-sea: #2F5866;
  --hal-night: #191513;
  --hal-line: rgba(30, 25, 21, 0.14);
  --hal-serif: ui-serif, "New York", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --hal-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms;
  --fd-dur-2: 240ms;
  --fd-dur-3: 420ms;
  --fd-dur-4: 700ms;
  --hal-nav-h: 84px;
  --hal-nav-s: 60px;
  position: relative;
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow-x: clip;
  background: var(--hal-sand);
  color: var(--hal-ink);
  font: 400 17px/1.6 var(--hal-sans);
  letter-spacing: 0;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.hal *, .hal *::before, .hal *::after {
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
}
.hal :where(svg) { display: block; overflow: hidden; }
.hal :where(button) { cursor: pointer; text-align: inherit; line-height: inherit; }
.hal :where(button:disabled) { cursor: default; }
.hal :focus-visible { outline: 2px solid rgba(169, 80, 43, 0.7); outline-offset: 2px; border-radius: 6px; }
.hal [hidden] { display: none !important; }
.hal-skip { position: absolute; left: 16px; top: -60px; z-index: 100; padding: 10px 16px; background: var(--hal-ink); color: var(--hal-paper); border-radius: 9999px; font: 500 13px/1 var(--hal-sans); }
.hal-skip:focus { top: 12px; }

.hal-wrap { width: 100%; max-width: 1280px; margin: 0 auto; padding: 0 40px; }
.hal-eyebrow { display: flex; align-items: center; gap: 10px; font: 500 12px/1.4 var(--hal-sans); letter-spacing: 0.18em; text-transform: uppercase; color: var(--hal-terra); }
.hal-h2 { font: 400 clamp(32px, 4.2vw, 64px)/1.06 var(--hal-serif); letter-spacing: -0.025em; color: var(--hal-ink); text-wrap: balance; }
.hal-h3 { font: 400 28px/1.15 var(--hal-serif); letter-spacing: -0.015em; color: var(--hal-ink); }
.hal-lede { font: 400 24px/1.5 var(--hal-serif); letter-spacing: -0.01em; color: var(--hal-ink); }
.hal-body { font: 400 17px/1.7 var(--hal-sans); color: var(--hal-ink-2); }
.hal-scene { display: block; width: 100%; height: 100%; max-width: none; object-fit: cover; }

/* Buttons */
.hal-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 52px; padding: 0 26px; border-radius: 9999px; font: 500 15px/1 var(--hal-sans); letter-spacing: 0.01em; white-space: nowrap; transition: background-color var(--fd-dur-2) var(--fd-ease-out), color var(--fd-dur-2) var(--fd-ease-out), transform var(--fd-dur-2) var(--fd-spring); }
.hal-btn svg { width: 16px; height: 16px; transition: transform var(--fd-dur-2) var(--fd-ease-out); }
.hal-btn:hover svg { transform: translateX(3px); }
.hal-btn:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.hal-btn-sm { height: 40px; padding: 0 18px; font-size: 13px; }
.hal-btn-ink { background: var(--hal-ink); color: var(--hal-paper); }
.hal-btn-ink:hover { background: #3A302A; }
.hal-btn-terra { background: var(--hal-terra); color: #FFF8F1; }
.hal-btn-terra:hover { background: #923F1E; }
.hal-btn-sand { background: var(--hal-sand); color: var(--hal-ink); }
.hal-btn-sand:hover { background: #FFFFFF; }

/* NAV */
.hal-nav { position: sticky; top: 0; z-index: 60; height: var(--hal-nav-h); margin-bottom: calc(var(--hal-nav-h) * -1); pointer-events: none; }
.hal-nav-bar { pointer-events: auto; position: relative; display: flex; align-items: center; justify-content: space-between; gap: 24px; height: var(--hal-nav-h); padding: 0 40px; transition: height var(--fd-dur-3) var(--fd-ease-out), background-color var(--fd-dur-3) var(--fd-ease-out), box-shadow var(--fd-dur-3) var(--fd-ease-out); }
.hal-nav.is-small .hal-nav-bar { height: var(--hal-nav-s); background: rgba(243, 236, 226, 0.86); -webkit-backdrop-filter: saturate(1.4) blur(18px); backdrop-filter: saturate(1.4) blur(18px); box-shadow: 0 1px 0 var(--hal-line); }
.hal-logo { display: inline-flex; align-items: center; gap: 12px; color: var(--hal-ink); font: 400 22px/1 var(--hal-serif); letter-spacing: 0.22em; text-transform: uppercase; }
.hal-logo svg { width: 28px; height: 28px; transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.hal-nav.is-small .hal-logo svg { transform: scale(0.86); }
.hal-nav-links { display: flex; gap: 34px; }
.hal-nav-links a { position: relative; font: 500 14px/1 var(--hal-sans); letter-spacing: 0.02em; color: var(--hal-ink); padding: 8px 0; }
.hal-nav-links a::after { content: ""; position: absolute; left: 0; right: 0; bottom: 2px; height: 1px; background: currentColor; transform: scaleX(0); transform-origin: right; transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.hal-nav-links a:hover::after { transform: scaleX(1); transform-origin: left; }
.hal-nav-end { display: flex; align-items: center; gap: 18px; }
.hal-nav-lang { font: 500 13px/1 var(--hal-sans); letter-spacing: 0.08em; color: var(--hal-ink-2); }
.hal-burger { display: none; width: 44px; height: 44px; border-radius: 9999px; position: relative; }
.hal-burger span { position: absolute; left: 13px; right: 13px; height: 1.5px; background: var(--hal-ink); transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.hal-burger span:first-child { top: 18px; }
.hal-burger span:last-child { top: 25px; }
.hal-nav.is-open .hal-burger span:first-child { transform: translateY(3.5px) rotate(45deg); }
.hal-nav.is-open .hal-burger span:last-child { transform: translateY(-3.5px) rotate(-45deg); }
.hal-sheet { pointer-events: auto; display: flex; flex-direction: column; padding: 8px 24px 24px; background: rgba(243, 236, 226, 0.97); box-shadow: 0 1px 0 var(--hal-line), 0 30px 60px -30px rgba(30, 25, 21, 0.3); }
.hal-sheet a { font: 400 28px/1.2 var(--hal-serif); padding: 12px 0; border-bottom: 1px solid var(--hal-line); color: var(--hal-ink); }

/* HERO */
.hal-hero { position: relative; height: 190vh; height: 190svh; background: #EAD3B4; --p: 0; }
.hal-hero-pin { position: sticky; top: 0; height: 100vh; height: 100svh; min-height: 620px; overflow: hidden; }
.hal-hero-scene { position: absolute; inset: 0; }
.hal-hero-scene::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(246, 228, 204, 0.88) 0%, rgba(246, 228, 204, 0.62) 34%, rgba(246, 228, 204, 0) 68%); transition: background var(--fd-dur-4) var(--fd-ease-out); }
.hal-hero.is-dusk .hal-hero-scene::after { background: linear-gradient(90deg, rgba(26, 16, 36, 0.72) 0%, rgba(26, 16, 36, 0.42) 34%, rgba(26, 16, 36, 0) 68%); }
.hal-hero-img { position: absolute; left: 0; top: 0; display: block; width: 100%; height: 100%; max-width: none; object-fit: cover; object-position: 55% 40%; transform: scale(calc(1 + var(--p) * 0.08)); transform-origin: 60% 70%; will-change: transform; }
.hal-dusk { opacity: var(--p); filter: brightness(0.55) saturate(0.85) hue-rotate(-14deg) contrast(1.1); }
/* Camera cranes up as you scroll: near layers fall away faster than far ones, the sun sets behind the sea. */

.hal-hero-copy { position: absolute; left: 0; right: 0; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; padding: var(--hal-nav-h) 40px 150px; max-width: 1280px; margin: 0 auto; transform: translate3d(0, calc(var(--p) * -60px), 0); opacity: calc(1.6 - var(--p) * 1.9); }
.hal-hero-eyebrow { color: var(--hal-ink); transition: color var(--fd-dur-4) var(--fd-ease-out); margin-bottom: 28px; }
.hal-hero-eyebrow i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; opacity: 0.6; }
.hal-clock { font-variant-numeric: tabular-nums; min-width: 3.2em; }
.hal-hero-title { font: 400 clamp(56px, 7.4vw, 120px)/0.98 var(--hal-serif); letter-spacing: -0.04em; color: var(--hal-ink); max-width: 9.5em; transition: color var(--fd-dur-4) var(--fd-ease-out); }
.hal-hero-title em { font-style: italic; color: var(--hal-terra); transition: color var(--fd-dur-4) var(--fd-ease-out); }
.hal-line { display: block; overflow: hidden; padding-bottom: 0.08em; margin-bottom: -0.08em; }
.hal-line > span { display: block; transform: translateY(105%); animation: hal-rise 1.2s var(--fd-ease-out) forwards; }
.hal-line:nth-child(2) > span { animation-delay: 140ms; }
@keyframes hal-rise { to { transform: translateY(0); } }
.hal-hero-sub { max-width: 470px; margin-top: 30px; font: 400 17px/1.65 var(--hal-sans); color: var(--hal-ink-2); opacity: 0; animation: hal-fade 1s var(--fd-ease-out) 500ms forwards; transition: color var(--fd-dur-4) var(--fd-ease-out); }
@keyframes hal-fade { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.hal-hero.is-dusk .hal-hero-title, .hal-hero.is-dusk .hal-hero-eyebrow { color: #FBF3E8; }
.hal-hero.is-dusk .hal-hero-title em { color: #F2B48C; }
.hal-hero.is-dusk .hal-hero-sub { color: rgba(251, 243, 232, 0.86); }
.hal-hero-scroll { position: absolute; right: 40px; bottom: 150px; display: flex; align-items: center; gap: 12px; font: 500 12px/1 var(--hal-sans); letter-spacing: 0.18em; text-transform: uppercase; color: var(--hal-ink); writing-mode: vertical-rl; opacity: calc(1 - var(--p) * 4); }
.hal-hero-scroll span { display: block; width: 1px; height: 56px; background: currentColor; transform-origin: top; animation: hal-tick 2.4s var(--fd-ease-in-out) infinite; }
@keyframes hal-tick { 0% { transform: scaleY(0); } 50% { transform: scaleY(1); transform-origin: top; } 51% { transform-origin: bottom; } 100% { transform: scaleY(0); transform-origin: bottom; } }
.hal-l-sky, .hal-l-sun, .hal-l-far, .hal-l-sea, .hal-l-cliff, .hal-l-front { animation: hal-settle 1.6s var(--fd-ease-out) both; }
@keyframes hal-settle { from { opacity: 0; translate: 0 3%; } to { opacity: 1; translate: 0 0; } }
.hal-l-sky { animation-name: hal-fade-in; }
@keyframes hal-fade-in { from { opacity: 0; } to { opacity: 1; } }

/* BOOKING BAR */
.hal-book { position: sticky; top: calc(var(--hal-nav-s) + 10px); bottom: 24px; z-index: 50; display: flex; justify-content: center; margin-top: -120px; padding: 0 40px; height: 96px; pointer-events: none; }
.hal-book-card { pointer-events: auto; position: relative; display: grid; grid-template-columns: auto 1.3fr 0.8fr 0.8fr auto; align-items: center; gap: 0; width: 100%; max-width: 1120px; height: 96px; padding: 0 12px 0 24px; border-radius: 24px; background: rgba(251, 248, 243, 0.94); -webkit-backdrop-filter: saturate(1.3) blur(20px); backdrop-filter: saturate(1.3) blur(20px); box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6) inset, 0 24px 60px -24px rgba(30, 25, 21, 0.35), 0 0 0 1px rgba(30, 25, 21, 0.06); transition: height var(--fd-dur-3) var(--fd-ease-out), border-radius var(--fd-dur-3) var(--fd-ease-out), box-shadow var(--fd-dur-3) var(--fd-ease-out), max-width var(--fd-dur-4) var(--fd-ease-out); }
.hal-book.is-docked .hal-book-card { height: 68px; max-width: 1200px; border-radius: 9999px; box-shadow: 0 0 0 1px rgba(30, 25, 21, 0.08), 0 12px 30px -16px rgba(30, 25, 21, 0.3); }
.hal-field { position: relative; display: flex; flex-direction: column; justify-content: center; gap: 6px; height: 100%; padding: 0 22px; border-left: 1px solid var(--hal-line); }
.hal-field-dest { border-left: 0; padding-left: 0; }
.hal-label { display: block; font: 500 11px/1 var(--hal-sans); letter-spacing: 0.16em; text-transform: uppercase; color: var(--hal-ink-2); transition: opacity var(--fd-dur-2) var(--fd-ease-out), height var(--fd-dur-3) var(--fd-ease-out); }
.hal-book.is-docked .hal-label { opacity: 0; height: 0; margin-bottom: -6px; overflow: hidden; }
.hal-seg { position: relative; display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 9999px; background: rgba(30, 25, 21, 0.06); }
.hal-seg button { position: relative; z-index: 1; height: 36px; padding: 0 16px; border-radius: 9999px; font: 500 14px/1 var(--hal-sans); color: var(--hal-ink-2); text-align: center; white-space: nowrap; transition: color var(--fd-dur-2) var(--fd-ease-out); }
.hal-seg button.is-on { color: var(--hal-ink); }
.hal-seg-thumb { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px); border-radius: 9999px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(30, 25, 21, 0.12), 0 4px 12px -4px rgba(30, 25, 21, 0.18); transition: transform var(--fd-dur-3) var(--fd-spring); }
.hal-date-btn { display: flex; align-items: baseline; gap: 8px; height: 32px; font: 400 20px/32px var(--hal-serif); letter-spacing: -0.01em; color: var(--hal-ink); white-space: nowrap; }
.hal-date-btn small { font: 400 14px/1 var(--hal-sans); color: var(--hal-ink-2); }
.hal-pop { position: absolute; left: 10px; bottom: calc(100% + 14px); width: 360px; padding: 18px; border-radius: 20px; background: var(--hal-paper); box-shadow: 0 0 0 1px var(--hal-line), 0 30px 60px -20px rgba(30, 25, 21, 0.4); animation: hal-pop var(--fd-dur-3) var(--fd-ease-out); }
.hal-book.is-docked .hal-pop { bottom: auto; top: calc(100% + 14px); }
@keyframes hal-pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
.hal-pop-title { font: 400 18px/1.2 var(--hal-serif); margin-bottom: 12px; color: var(--hal-ink); }
.hal-pop-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.hal-pop-grid button { display: flex; flex-direction: column; align-items: center; gap: 2px; height: 52px; justify-content: center; border-radius: 14px; font: 500 16px/1 var(--hal-sans); color: var(--hal-ink); transition: background-color var(--fd-dur-1) var(--fd-ease-out); }
.hal-pop-grid button small { font: 500 10px/1 var(--hal-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--hal-ink-2); }
.hal-pop-grid button:hover { background: rgba(30, 25, 21, 0.06); }
.hal-pop-grid button.is-on { background: var(--hal-ink); color: var(--hal-paper); }
.hal-pop-grid button.is-on small { color: rgba(251, 248, 243, 0.7); }
.hal-step { display: flex; align-items: center; gap: 10px; height: 32px; }
.hal-step button { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--hal-line); font: 400 18px/1 var(--hal-sans); color: var(--hal-ink); text-align: center; transition: background-color var(--fd-dur-1) var(--fd-ease-out), transform var(--fd-dur-2) var(--fd-spring); }
.hal-step button:hover { background: rgba(30, 25, 21, 0.06); }
.hal-step button:active { transform: scale(0.9); }
.hal-step output { min-width: 18px; text-align: center; font: 400 20px/1 var(--hal-serif); color: var(--hal-ink); font-variant-numeric: tabular-nums; }
.hal-cta-short { display: none; }
.hal-book-cta { height: 64px; padding: 0 28px; transition: height var(--fd-dur-3) var(--fd-ease-out), background-color var(--fd-dur-2) var(--fd-ease-out), transform var(--fd-dur-2) var(--fd-spring); }
.hal-book.is-docked .hal-book-cta { height: 48px; }
.hal-book-result { position: absolute; left: 50%; top: calc(100% + 12px); transform: translate(-50%, -6px); padding: 10px 18px; border-radius: 9999px; background: var(--hal-ink); color: var(--hal-paper); font: 500 13px/1.3 var(--hal-sans); white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-ease-out); }
.hal-book-result.is-on { opacity: 1; transform: translate(-50%, 0); }
.hal-book:not(.is-docked) .hal-book-result { top: auto; bottom: calc(100% + 12px); }

/* REVEALS */
.hal-js [data-hal-rv] { opacity: 0; transform: translate3d(0, 28px, 0); transition: opacity 1s var(--fd-ease-out), transform 1.1s var(--fd-ease-out); transition-delay: var(--d, 0ms); }
.hal-js [data-hal-rv].is-in { opacity: 1; transform: none; }

/* INTRO */
.hal-intro { padding: 180px 0 160px; }
.hal-intro-grid { display: grid; grid-template-columns: 1fr 1.05fr; gap: 96px; align-items: start; }
.hal-intro-text { position: relative; padding-top: 40px; }
.hal-intro-text .hal-h2 { margin: 22px 0 36px; }
.hal-drop::first-letter { float: left; font: 400 88px/0.82 var(--hal-serif); color: var(--hal-terra); margin: 8px 12px 0 0; }
.hal-intro-text .hal-body { margin-top: 22px; max-width: 520px; }
.hal-figs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 56px; padding-top: 28px; border-top: 1px solid var(--hal-line); }
.hal-figs dt { font: 500 12px/1.3 var(--hal-sans); letter-spacing: 0.12em; text-transform: uppercase; color: var(--hal-ink-2); }
.hal-figs dd { margin-top: 8px; font: 400 44px/1 var(--hal-serif); letter-spacing: -0.025em; color: var(--hal-ink); }
.hal-intro-media { position: relative; height: 820px; --p: 0; }
.hal-clip { position: absolute; margin: 0; }
.hal-clip-a { right: 0; top: 0; width: 78%; height: 620px; transform: translate3d(0, calc(var(--p) * -40px), 0); }
.hal-clip-b { left: 0; bottom: 0; width: 46%; height: 380px; z-index: 2; transform: translate3d(0, calc(var(--p) * -110px), 0); }
.hal-clip-in { width: 100%; height: calc(100% - 34px); overflow: hidden; border-radius: 4px; background: #D9C4A6; }
.hal-clip-b .hal-clip-in { box-shadow: 0 0 0 10px var(--hal-sand); }
.hal-clip figcaption { margin-top: 12px; font: italic 400 15px/1.3 var(--hal-serif); color: var(--hal-ink-2); }
.hal-js .hal-clip[data-hal-rv] { opacity: 1; transform: translate3d(0, calc(var(--p) * -40px), 0); }
.hal-js .hal-clip-b[data-hal-rv] { transform: translate3d(0, calc(var(--p) * -110px), 0); }
.hal-js .hal-clip .hal-clip-in { clip-path: inset(100% 0 0 0); transition: clip-path 1.4s var(--fd-ease-out); }
.hal-js .hal-clip .hal-scene { transform: scale(1.18); transition: transform 2s var(--fd-ease-out); }
.hal-js .hal-clip.is-in .hal-clip-in { clip-path: inset(0 0 0 0); }
.hal-js .hal-clip.is-in .hal-scene { transform: scale(1); }
.hal-js .hal-clip-b .hal-clip-in { transition-delay: 220ms; }
.hal-js .hal-clip figcaption { opacity: 0; transition: opacity 1s var(--fd-ease-out) 700ms; }
.hal-js .hal-clip.is-in figcaption { opacity: 1; }

/* HOUSES — pinned horizontal */
.hal-houses { position: relative; height: calc(100vh + var(--dist, 0px)); height: calc(100svh + var(--dist, 0px)); background: var(--hal-paper); --p: 0; }
.hal-houses-pin { position: sticky; top: 0; height: 100vh; height: 100svh; min-height: 640px; display: flex; flex-direction: column; justify-content: center; gap: 44px; overflow: hidden; padding-top: 150px; }
.hal-houses-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 40px; }
.hal-houses-head .hal-h2 { margin-top: 16px; }
.hal-houses-meter { display: flex; align-items: center; gap: 18px; padding-bottom: 10px; }
.hal-houses-bar { position: relative; display: block; width: 180px; height: 1px; background: var(--hal-line); }
.hal-houses-bar i { position: absolute; inset: 0; background: var(--hal-ink); transform: scaleX(calc(0.25 + var(--p) * 0.75)); transform-origin: left; }
.hal-houses-cur { font-weight: 600; color: var(--hal-ink); }
.hal-houses-count { font: 500 13px/1 var(--hal-sans); letter-spacing: 0.12em; color: var(--hal-ink-2); font-variant-numeric: tabular-nums; }
.hal-houses-track { display: flex; gap: 32px; padding: 0 40px; width: max-content; will-change: transform; }
.hal-house { flex: 0 0 auto; width: min(58vw, 860px); }
.hal-house-link { display: grid; grid-template-columns: 1.35fr 1fr; gap: 32px; height: min(58vh, 560px); color: var(--hal-ink); }
.hal-house-img { position: relative; overflow: hidden; border-radius: 4px; background: #D9C4A6; }
.hal-house-par { position: absolute; inset: 0 -12%; transform: translate3d(calc(var(--p) * 14% - 7%), 0, 0); }
.hal-house-link:hover .hal-house-par .hal-scene { transform: scale(1.04); }
.hal-house-par .hal-scene { transition: transform 1.2s var(--fd-ease-out); }
.hal-house-info { display: flex; flex-direction: column; justify-content: space-between; padding: 8px 0 4px; }
.hal-house-n { font: italic 400 20px/1 var(--hal-serif); color: var(--hal-terra); }
.hal-house-info .hal-h3 { font-size: 40px; letter-spacing: -0.025em; }
.hal-house-place { margin-top: 10px; font: 500 13px/1.4 var(--hal-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--hal-ink-2); }
.hal-house-note { margin-top: 22px; font: 400 17px/1.65 var(--hal-sans); color: var(--hal-ink-2); max-width: 34ch; }
.hal-house-meta { display: flex; justify-content: space-between; padding-top: 18px; border-top: 1px solid var(--hal-line); font: 400 20px/1 var(--hal-serif); color: var(--hal-ink); }

/* ROOMS */
.hal-rooms { padding: 180px 0 140px; }
.hal-sec-head { max-width: 760px; margin-bottom: 64px; }
.hal-sec-head .hal-h2 { margin-top: 18px; }
.hal-sec-sub { margin-top: 22px; max-width: 560px; }
.hal-room-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.hal-room-link { display: block; color: var(--hal-ink); }
.hal-room-img { position: relative; aspect-ratio: 4 / 5; overflow: hidden; border-radius: 4px; background: #D9C4A6; }
.hal-room-img .hal-scene { transition: transform 1.1s var(--fd-ease-out); }
.hal-room-img::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(30, 25, 21, 0) 60%, rgba(30, 25, 21, 0.18)); opacity: 0; transition: opacity var(--fd-dur-4) var(--fd-ease-out); }
.hal-room-link:hover .hal-room-img .hal-scene, .hal-room-link:focus-visible .hal-room-img .hal-scene { transform: scale(1.07); }
.hal-room-link:hover .hal-room-img::after { opacity: 1; }
.hal-room-body { padding-top: 22px; }
.hal-room-house { font: 500 12px/1.4 var(--hal-sans); letter-spacing: 0.14em; text-transform: uppercase; color: var(--hal-terra); }
.hal-room-body .hal-h3 { margin-top: 10px; }
.hal-room-feat { margin-top: 8px; font: 400 15px/1.5 var(--hal-sans); color: var(--hal-ink-2); }
.hal-room-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--hal-line); font: 400 15px/1 var(--hal-sans); color: var(--hal-ink-2); }
.hal-room-foot strong { font: 400 20px/1 var(--hal-serif); color: var(--hal-ink); }
.hal-room-cta { display: inline-flex; align-items: center; gap: 8px; font: 500 14px/1 var(--hal-sans); color: var(--hal-ink); }
.hal-room-cta svg { width: 16px; height: 16px; transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.hal-room-link:hover .hal-room-cta svg { transform: translateX(4px); }

/* RITUALS */
.hal-rituals { padding: 140px 0; background: var(--hal-night); color: #F3ECE2; }
.hal-rituals .hal-h2 { color: #F7F0E6; margin: 18px 0 44px; }
.hal-rituals .hal-eyebrow { color: #E6A47F; }
.hal-rituals-grid { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 96px; align-items: center; }
.hal-rituals-frame { position: relative; aspect-ratio: 4 / 5; overflow: hidden; border-radius: 4px; background: #2A221D; }
.hal-rituals-img { position: absolute; inset: 0; opacity: 0; transform: scale(1.06); transition: opacity var(--fd-dur-4) var(--fd-ease-in-out), transform 1.4s var(--fd-ease-out); }
.hal-rituals-img.is-on { opacity: 1; transform: scale(1); }
.hal-rituals-time { position: absolute; left: 24px; bottom: 20px; font: 400 64px/1 var(--hal-serif); letter-spacing: -0.04em; color: #FFF8EE; text-shadow: 0 2px 30px rgba(0, 0, 0, 0.35); font-variant-numeric: tabular-nums; }
.hal-rituals-list { border-top: 1px solid rgba(243, 236, 226, 0.16); }
.hal-ritual { display: grid; grid-template-columns: 72px 1fr; grid-template-rows: auto auto; column-gap: 20px; row-gap: 6px; width: 100%; padding: 26px 0; border-bottom: 1px solid rgba(243, 236, 226, 0.16); color: rgba(243, 236, 226, 0.6); text-align: left; transition: color var(--fd-dur-3) var(--fd-ease-out), padding var(--fd-dur-3) var(--fd-ease-out); }
.hal-ritual-time { grid-row: span 2; font: 500 14px/2 var(--hal-sans); letter-spacing: 0.1em; font-variant-numeric: tabular-nums; }
.hal-ritual-title { font: 400 30px/1.15 var(--hal-serif); letter-spacing: -0.015em; }
.hal-ritual-where { font: 400 15px/1.4 var(--hal-sans); color: rgba(243, 236, 226, 0.6); }
.hal-ritual.is-on, .hal-ritual:hover { color: #FFF8EE; padding-left: 12px; }
.hal-ritual.is-on .hal-ritual-time { color: #E6A47F; }
.hal-ritual:focus-visible { outline-color: #E6A47F; }

/* QUOTES */
.hal-quotes { padding: 160px 0; background: var(--hal-sand); }
.hal-quotes-in { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: clamp(40px, 7vw, 110px); align-items: center; text-align: left; }
.hal-quotes-fig { margin: 0; aspect-ratio: 1; overflow: hidden; border-radius: 4px; box-shadow: 0 30px 60px -30px rgba(60, 30, 10, 0.4); }
.hal-quotes-img { display: block; width: 100%; height: 100%; max-width: none; object-fit: cover; }
.hal-quotes-body { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
.hal-quote-stack { display: grid; width: 100%; max-width: 980px; margin-top: 36px; }
.hal-quote { grid-area: 1 / 1; opacity: 0; transform: translateY(10px); filter: blur(4px); transition: opacity 900ms var(--fd-ease-in-out), transform 900ms var(--fd-ease-out), filter 900ms var(--fd-ease-out); pointer-events: none; }
.hal-quote.is-on { opacity: 1; transform: none; filter: none; pointer-events: auto; }
.hal-quote blockquote p { font: italic 400 clamp(24px, 2.6vw, 38px)/1.3 var(--hal-serif); letter-spacing: -0.015em; color: var(--hal-ink); text-wrap: balance; }
.hal-quote figcaption { display: flex; flex-direction: column; gap: 6px; margin-top: 32px; font: 400 15px/1.4 var(--hal-sans); color: var(--hal-ink-2); }
.hal-quote figcaption strong { font: 500 15px/1.4 var(--hal-sans); color: var(--hal-ink); }
.hal-quote-dots { display: flex; gap: 10px; margin-top: 44px; }
.hal-quote-dots button { position: relative; width: 44px; height: 44px; }
.hal-quote-dots button::before { content: ""; position: absolute; left: 4px; right: 4px; top: 21px; height: 2px; background: var(--hal-line); }
.hal-quote-dots i { position: absolute; left: 4px; right: 4px; top: 21px; height: 2px; background: var(--hal-ink); transform: scaleX(0); transform-origin: left; }
.hal-quote-dots button.is-on i { animation: hal-fill 6.5s linear forwards; }
@keyframes hal-fill { to { transform: scaleX(1); } }

/* MAP */
.hal-map { padding: 160px 0; background: var(--hal-paper); }
.hal-map-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.hal-map-card { margin: 0; }
.hal-map-svg { width: 100%; height: auto; border-radius: 4px; }
.hal-map-card figcaption { display: grid; grid-template-columns: 160px 1fr; gap: 20px; margin-top: 22px; font: 400 15px/1.6 var(--hal-sans); color: var(--hal-ink-2); }
.hal-map-card figcaption strong { font: 400 24px/1.2 var(--hal-serif); color: var(--hal-ink); }
.hal-map-t { font: 500 13px/1 var(--hal-sans); fill: #3E342D; letter-spacing: 0.02em; }
.hal-map-t-sm { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; fill: #7A6D62; }
.hal-map-t-sea { font: italic 400 15px/1 var(--hal-serif); fill: #50727C; }
.hal-js .hal-draw { stroke-dasharray: 1200; stroke-dashoffset: 1200; transition: stroke-dashoffset 2.4s var(--fd-ease-out) 200ms; }
.hal-js .hal-draw-route { stroke-dasharray: 4 6; stroke-dashoffset: 0; opacity: 0; transition: opacity 1s var(--fd-ease-out) 1.2s; }
.hal-js .is-in .hal-draw { stroke-dashoffset: 0; }
.hal-js .is-in .hal-draw-route { opacity: 1; animation: hal-march 1.2s linear infinite; }
@keyframes hal-march { to { stroke-dashoffset: -20; } }
.hal-pin { transform-box: fill-box; }
.hal-js .hal-pin path, .hal-js .hal-pin circle { opacity: 0; transform: translateY(-36px); transition: opacity 400ms var(--fd-ease-out) var(--d), transform 700ms var(--fd-spring) var(--d); }
.hal-js .is-in .hal-pin path, .hal-js .is-in .hal-pin circle { opacity: 1; transform: none; }

/* FOOTER */
.hal-foot { padding: 120px 0 40px; background: var(--hal-night); color: #E9E0D4; overflow: hidden; }
.hal-news { display: grid; grid-template-columns: 1.1fr 1fr; gap: 80px; align-items: end; padding-bottom: 96px; border-bottom: 1px solid rgba(243, 236, 226, 0.14); }
.hal-eyebrow-light { color: #E6A47F; }
.hal-news-title { color: #F7F0E6; margin-top: 18px; }
.hal-news-sub { margin-top: 18px; max-width: 470px; font: 400 17px/1.65 var(--hal-sans); color: rgba(243, 236, 226, 0.72); }
.hal-news-label { display: block; margin-bottom: 12px; font: 500 12px/1 var(--hal-sans); letter-spacing: 0.14em; text-transform: uppercase; color: rgba(243, 236, 226, 0.72); }
.hal-news-row { display: flex; gap: 8px; padding: 6px; border-radius: 9999px; background: rgba(243, 236, 226, 0.08); box-shadow: inset 0 0 0 1px rgba(243, 236, 226, 0.16); transition: box-shadow var(--fd-dur-2) var(--fd-ease-out); }
.hal-news-row:focus-within { box-shadow: inset 0 0 0 1px rgba(230, 164, 127, 0.8); }
.hal-news-row input { flex: 1; height: 52px; padding: 0 20px; border-radius: 9999px; background: transparent; font: 400 17px/1 var(--hal-sans); color: #FBF3E8; outline: none; }
.hal-news-row input::placeholder { color: rgba(243, 236, 226, 0.5); }
.hal-news-row.is-done { box-shadow: inset 0 0 0 1px rgba(230, 164, 127, 0.8); }
.hal-news-row.is-done .hal-btn { background: #E6A47F; color: var(--hal-night); }
.hal-news-note { margin-top: 14px; font: 400 14px/1.5 var(--hal-sans); color: rgba(243, 236, 226, 0.62); }
.hal-foot-cols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 40px; padding: 72px 0; }
.hal-foot-h { font: 500 12px/1 var(--hal-sans); letter-spacing: 0.16em; text-transform: uppercase; color: rgba(243, 236, 226, 0.6); margin-bottom: 20px; }
.hal-foot-cols li { margin-bottom: 12px; font: 400 15px/1.4 var(--hal-sans); color: #F3ECE2; }
.hal-foot-cols a { color: #F3ECE2; transition: color var(--fd-dur-1) var(--fd-ease-out); }
.hal-foot-cols a:hover { color: #E6A47F; }
.hal-foot-mark { font: 400 clamp(88px, 21vw, 340px)/0.8 var(--hal-serif); letter-spacing: -0.05em; color: transparent; background: linear-gradient(180deg, rgba(243, 236, 226, 0.22), rgba(243, 236, 226, 0.02)); -webkit-background-clip: text; background-clip: text; text-align: center; white-space: nowrap; margin: 0 -40px; user-select: none; }
.hal-foot-legal { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding-top: 28px; border-top: 1px solid rgba(243, 236, 226, 0.14); font: 400 13px/1.5 var(--hal-sans); color: rgba(243, 236, 226, 0.62); }
.hal-foot-legal span:last-child { display: flex; gap: 22px; }
.hal-foot-legal a { color: rgba(243, 236, 226, 0.78); }
.hal-foot-legal a:hover { color: #FBF3E8; }

/* RESPONSIVE */
@media (max-width: 1080px) {
  .hal-nav-links { gap: 22px; }
  .hal-intro-grid { gap: 56px; }
  .hal-book-card { grid-template-columns: auto 1.2fr 0.9fr 0.9fr auto; padding-left: 16px; }
  .hal-field { padding: 0 14px; }
  .hal-book-cta { padding: 0 20px; }
}
@media (max-width: 900px) {
  .hal-wrap { padding: 0 24px; }
  .hal-nav-bar { padding: 0 20px; }
  .hal-nav-links, .hal-nav-lang { display: none; }
  .hal-burger { display: block; }
  .hal-hero-copy { padding: var(--hal-nav-h) 24px 150px; }
  .hal-hero-scroll { display: none; }
  .hal-intro { padding: 120px 0 100px; }
  .hal-intro-grid, .hal-rituals-grid, .hal-news { grid-template-columns: 1fr; gap: 56px; }
  .hal-intro-media { height: 640px; }
  .hal-houses { height: auto; }
  .hal-houses-pin { position: relative; height: auto; min-height: 0; padding: 110px 0 90px; }
  .hal-houses-meter { display: none; }
  .hal-houses-track { width: auto; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 12px; scrollbar-width: none; transform: none !important; }
  .hal-houses-track::-webkit-scrollbar { display: none; }
  .hal-house { width: 82vw; scroll-snap-align: center; }
  .hal-house-link { grid-template-columns: 1fr; height: auto; gap: 20px; }
  .hal-house-img { aspect-ratio: 4 / 3; }
  .hal-house-par { inset: 0; transform: none; }
  .hal-house-note { margin-top: 14px; }
  .hal-house-meta { margin-top: 18px; }
  .hal-rooms { padding: 110px 0; }
  .hal-room-grid { grid-template-columns: 1fr; gap: 48px; }
  .hal-rituals { padding: 100px 0; }
  .hal-rituals-frame { aspect-ratio: 4 / 3; }
  .hal-quotes, .hal-map { padding: 110px 0; }
  .hal-quotes-in { grid-template-columns: 1fr; }
  .hal-quotes-fig { max-width: 420px; }
  .hal-map-grid { grid-template-columns: 1fr; }
  .hal-foot-cols { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .hal-book { padding: 0 12px; height: auto; margin-top: -196px; bottom: 12px; top: calc(var(--hal-nav-s) + 6px); }
  .hal-book-card { grid-template-columns: 1fr 1fr; grid-template-rows: auto auto auto; height: auto; padding: 14px; gap: 10px 0; border-radius: 22px; }
  .hal-field-dest { grid-column: 1 / -1; padding: 0; }
  .hal-field-dest .hal-label { display: none; }
  .hal-field-date { grid-column: 1 / -1; padding: 0 4px; border-left: 0; }
  .hal-field { padding: 0 4px; height: auto; gap: 4px; }
  .hal-field:nth-child(4) { padding-left: 16px; }
  .hal-field:nth-child(3) { border-left: 0; }
  .hal-book-cta { grid-column: 1 / -1; height: 52px; }
  .hal-label { font-size: 10px; }
  .hal-book.is-docked .hal-book-card { height: auto; grid-template-columns: 1fr auto; grid-template-rows: auto; gap: 8px; padding: 6px; border-radius: 9999px; }
  .hal-book.is-docked .hal-field:nth-child(3), .hal-book.is-docked .hal-field:nth-child(4), .hal-book.is-docked .hal-field-date { display: none; }
  .hal-book.is-docked .hal-field-dest { grid-column: 1; }
  .hal-book.is-docked .hal-book-cta { grid-column: 2; height: 44px; padding: 0 18px; }
  .hal-book.is-docked .hal-cta-full { display: none; }
  .hal-book.is-docked .hal-cta-short { display: inline; }
  .hal-pop { width: calc(100vw - 48px); left: -4px; }
  .hal-pop-grid { grid-template-columns: repeat(4, 1fr); }
  .hal-book-result { white-space: normal; width: max-content; max-width: calc(100vw - 48px); text-align: center; }
  .hal-hero-copy { padding: calc(var(--hal-nav-h) + 36px) 24px 290px; justify-content: flex-start; }
  /* Portrait crop: frame the sea + the cliff edge (viewBox x≈700–1125) instead of the centre. */
  .hal-hero-img { object-position: 60% 40%; }
  .hal-hero-scene::after { background: linear-gradient(180deg, rgba(246, 228, 204, 0.9) 0%, rgba(246, 228, 204, 0.7) 45%, rgba(246, 228, 204, 0) 75%); }
  .hal-hero.is-dusk .hal-hero-scene::after { background: linear-gradient(180deg, rgba(26, 16, 36, 0.75) 0%, rgba(26, 16, 36, 0.5) 45%, rgba(26, 16, 36, 0) 75%); }
  .hal-hero-title { font-size: clamp(48px, 14vw, 64px); }
  .hal-hero-sub { font-size: 15px; margin-top: 18px; }
  .hal-hero-eyebrow { margin-bottom: 18px; font-size: 11px; gap: 8px; }
}
@media (max-width: 560px) {
  .hal-h3 { font-size: 24px; }
  .hal-house-info .hal-h3 { font-size: 32px; }
  .hal-intro-media { height: 520px; }
  .hal-clip-a { width: 86%; height: 400px; }
  .hal-clip-b { width: 54%; height: 250px; }
  .hal-figs dd { font-size: 32px; }
  .hal-lede { font-size: 21px; }
  .hal-drop::first-letter { font-size: 64px; }
  .hal-ritual-title { font-size: 24px; }
  .hal-ritual { grid-template-columns: 56px 1fr; }
  .hal-rituals-time { font-size: 44px; }
  .hal-map-card figcaption { grid-template-columns: 1fr; gap: 6px; }
  .hal-foot-legal { flex-direction: column; }
  .hal-news-row { flex-direction: column; border-radius: 22px; }
  .hal-news-row .hal-btn { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .hal *, .hal *::before, .hal *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 120ms !important; transition-delay: 0ms !important; }
  .hal-hero { height: 100vh; height: 100svh; }
  .hal-hero-img, .hal-hero-copy, .hal-house-par, .hal-clip-a, .hal-clip-b, .hal-js .hal-clip[data-hal-rv], .hal-js .hal-clip-b[data-hal-rv] { transform: none !important; }
  .hal-houses { height: auto; }
  .hal-houses-pin { position: relative; height: auto; min-height: 0; padding: 110px 0 90px; }
  .hal-houses-track { width: auto; overflow-x: auto; scroll-snap-type: x mandatory; transform: none !important; }
  .hal-house { scroll-snap-align: start; }
  .hal-houses-meter, .hal-hero-scroll { display: none; }
  .hal-js [data-hal-rv] { transform: none; }
  .hal-js .hal-clip .hal-clip-in { clip-path: none; }
  .hal-js .hal-clip .hal-scene { transform: none; }
}
@media (prefers-contrast: more) {
  .hal-book-card, .hal-nav.is-small .hal-nav-bar { background: var(--hal-paper); -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: 0 0 0 1px var(--hal-ink); }
}
@media (prefers-reduced-transparency: reduce) {
  .hal-book-card, .hal-nav.is-small .hal-nav-bar { background: var(--hal-paper); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
`;
