/**
 * Ares — a home on Mars. Relocation and habitat company landing page.
 *
 * Retro-future rust: basalt blacks, oxide reds, ochre, butterscotch dust,
 * copper and one cold blue (the Martian sunset). The hero and postcard stamps
 * use photographic renders from /img/space/ (mars-orbit, mars-surface); the
 * drawings are inline SVG and CSS. No web fonts, no network.
 *
 * Motion:
 *  - Hero: a 330vh pinned stage. Scrolling is a descent: the orbit image zooms
 *    toward the planet, an entry-glow flashes, then the surface image fades in
 *    and settles. A live sol clock / temperature panel runs on real Mars time.
 *  - One scroll loop writes `--p` (0..1) onto every [data-ares-p] section.
 *    Pure CSS reads it: floor-plan strokes draw room by room, the dome
 *    cross-section draws itself layer by layer, Earth and Mars orbit while
 *    the supply ship flies its transfer arc, manifesto words light up.
 *  - Postcards drift at different speeds, passage tiers toggle between pay
 *    once / lease, the FAQ is a mission-control log that types answers.
 *
 * Reduced motion: no autoplay; the hero is a static touchdown
 * composition and every drawing is shown complete.
 * SSR-safe: no window/document access during render.
 */
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Pure helpers (module scope is deterministic: SSR == client)         */
/* ------------------------------------------------------------------ */
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);
const v = (o: Record<string, string | number>) => o as CSSProperties;

/* ------------------------------------------------------------------ */
/* Mars time                                                           */
/* ------------------------------------------------------------------ */
type MarsNow = { sol: string; lmst: string; temp: number; wind: number };
function marsNow(): MarsNow {
  const ms = Date.now();
  const jd = ms / 86400000 + 2440587.5;
  const jdTT = jd + (37 + 32.184) / 86400;
  const msd = (jdTT - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626;
  const mtc = frac(msd) * 24;
  const lmst = (mtc + 77.45 / 15 + 24) % 24;
  const hh = Math.floor(lmst);
  const mm = Math.floor((lmst - hh) * 60);
  const ss = Math.floor((((lmst - hh) * 60 - mm) * 60) % 60);
  const f = lmst / 24;
  const temp = -63 + 36 * Math.sin(2 * Math.PI * (f - 0.3)) + Math.sin(ms / 4000) * 0.6;
  return {
    sol: Math.floor(msd).toLocaleString("en-US"),
    lmst: [hh, mm, ss].map((n) => String(n).padStart(2, "0")).join(":"),
    temp,
    wind: 6 + 4 * Math.sin(ms / 9000) + 3 * Math.sin(f * 12),
  };
}

const PHASES: [number, string][] = [
  [0.08, "Low Mars orbit"],
  [0.26, "Deorbit burn"],
  [0.4, "Entry interface"],
  [0.54, "Peak heating"],
  [0.68, "Parachute deploy"],
  [0.86, "Powered descent"],
  [2, "Touchdown, Jezero"],
];

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const altRef = useRef<HTMLSpanElement>(null);
  const velRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<HTMLSpanElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const [mn, setMn] = useState<MarsNow | null>(null);

  useEffect(() => {
    const tick = () => setMn(marsNow());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pp = reduce ? 0.93 : 0;
    let target = pp;
    let raf = 0;
    let lastPhase = "";
    let lastAlt = "";
    const hud = (p: number) => {
      const d = sm(0.04, 0.62, p);
      const alt = p > 0.93 ? 0 : 410 * Math.pow(1 - d, 1.6);
      const altS = alt >= 100 ? Math.round(alt).toString() : alt.toFixed(1);
      if (altS !== lastAlt && altRef.current) {
        altRef.current.textContent = altS;
        lastAlt = altS;
      }
      if (velRef.current) velRef.current.textContent = (p > 0.93 ? 0 : 3.42 * (1 - sm(0.1, 0.86, p) * 0.97)).toFixed(2);
      const ph = PHASES.find((x) => p < x[0])![1];
      if (ph !== lastPhase && phaseRef.current) {
        phaseRef.current.textContent = ph;
        lastPhase = ph;
      }
      if (railRef.current) railRef.current.style.transform = `translateY(${(p * 100).toFixed(1)}%)`;
      hero.style.setProperty("--hp", p.toFixed(3));
    };
    const frame = () => {
      raf = 0;
      if (!reduce) {
        const r = hero.getBoundingClientRect();
        target = clamp(-r.top / Math.max(1, r.height - window.innerHeight));
        pp += (target - pp) * 0.18;
        if (Math.abs(target - pp) < 0.0007) pp = target;
        else raf = requestAnimationFrame(frame);
      }
      hud(pp);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    kick();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
    };
  }, []);

  return (
    <header className="ares-hero" ref={heroRef} id="top" style={v({ "--hp": 0 })}>
      <div className="ares-hero-stage">
        <div className="ares-photo ares-photo-orbit">
          <img
            src="/img/space/mars-orbit-1200.webp"
            srcSet="/img/space/mars-orbit-640.webp 640w, /img/space/mars-orbit-1200.webp 1200w, /img/space/mars-orbit.webp 1374w"
            sizes="100vw"
            width={1374}
            height={784}
            alt="Mars from low orbit: curved limb, canyons and craters under the Milky Way"
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
        </div>
        <div className="ares-entry" aria-hidden="true" />
        <div className="ares-photo ares-photo-surf">
          <img
            src="/img/space/mars-surface-1200.webp"
            srcSet="/img/space/mars-surface-640.webp 640w, /img/space/mars-surface-1200.webp 1200w, /img/space/mars-surface.webp 1405w"
            sizes="100vw"
            width={1405}
            height={752}
            alt="Mars surface at sunset: orange dunes, a rover, a butte and Phobos in a butterscotch sky"
            decoding="async"
            loading="lazy"
          />
        </div>
        <div className="ares-scrim" aria-hidden="true" />
        <div className="ares-grain" aria-hidden="true" />
        <div className="ares-vig" aria-hidden="true" />

        <div className="ares-hud ares-hud-l" aria-hidden="true">
          <div className="ares-hud-k">Descent telemetry</div>
          <div className="ares-hud-row"><span>ALT</span><b><span ref={altRef}>410</span> km</b></div>
          <div className="ares-hud-row"><span>VEL</span><b><span ref={velRef}>3.42</span> km/s</b></div>
          <div className="ares-hud-row"><span>PHASE</span><b ref={phaseRef}>Low Mars orbit</b></div>
        </div>

        <div className="ares-hud ares-hud-r" role="status" aria-label="Live Mars time at Jezero Crater">
          <div className="ares-hud-k">Jezero Crater · live</div>
          <div className="ares-hud-row"><span>SOL</span><b>{mn ? mn.sol : "-----"}</b></div>
          <div className="ares-hud-row"><span>LMST</span><b className="ares-big">{mn ? mn.lmst : "--:--:--"}</b></div>
          <div className="ares-hud-row"><span>TEMP</span><b>{mn ? `${mn.temp.toFixed(1)} °C` : "--"}</b></div>
          <div className="ares-hud-row ares-hide-s"><span>WIND</span><b>{mn ? `${mn.wind.toFixed(1)} m/s` : "--"}</b></div>
        </div>

        <div className="ares-hero-a">
          <p className="ares-eyebrow">Ares Habitat Company · Passage opens Jan 2029</p>
          <h1 className="ares-h1">
            A home on <em>Mars.</em>
          </h1>
          <p className="ares-lede">Pressurised, shielded, furnished and waiting. Scroll to ride the descent.</p>
        </div>

        <div className="ares-hero-b">
          <p className="ares-eyebrow">Sol 0 · Touchdown confirmed</p>
          <h2 className="ares-h2 ares-h2-hero">Welcome home. Mind the dust.</h2>
          <div className="ares-cta-row">
            <a className="ares-btn ares-btn-solid" href="#passage">Reserve your passage</a>
            <a className="ares-btn ares-btn-ghost" href="#habitat">Tour the Meridian home</a>
          </div>
        </div>

        <div className="ares-rail" aria-hidden="true"><span ref={railRef} /></div>
        <div className="ares-scrollcue" aria-hidden="true"><span>Descend</span><i /></div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */
const MANIFESTO =
  "Every settlement begins as one room with a window. We build the room, pressurise the dream, and hand you the key at six millibars.".split(" ");

const STATS = [
  { n: "148", u: "m²", l: "Private living space in a Meridian home" },
  { n: "3.0", u: "m", l: "Of packed regolith over every pressure shell" },
  { n: "94", u: "%", l: "Of household water recovered and reused" },
  { n: "0.38", u: "g", l: "Gravity, so the stairs are a pleasure" },
];

type Room = { name: string; area: number; x: number; y: number; w: number; h: number; note: string };
const ROOMS: Room[] = [
  { name: "Greenhouse", area: 31, x: 60, y: 60, w: 330, h: 180, note: "Soil-less beds under tuned LEDs: greens, dwarf tomatoes, herbs. It scrubs the air and smells like rain." },
  { name: "Sleep pods", area: 18, x: 390, y: 60, w: 170, h: 180, note: "Three quiet cells with their own shielded wall. Heavy sleepers wanted; the wind sings on the dome." },
  { name: "Water & air", area: 14, x: 560, y: 60, w: 180, h: 180, note: "Recycler, electrolysis and the ice-melt loop. The one room you will learn to love being boring." },
  { name: "Airlock", area: 12, x: 60, y: 260, w: 130, h: 200, note: "Two-stage lock with dust brushing, a suit rack and a bench to sit on when you get back." },
  { name: "Observation lounge", area: 42, x: 190, y: 260, w: 300, h: 200, note: "A curved four-metre window facing the crater rim. Where every resident ends up at sunset." },
  { name: "Galley", area: 17, x: 490, y: 260, w: 150, h: 200, note: "Induction hob, steam oven and a long table. Dinner is the social contract of the colony." },
  { name: "Workshop", area: 14, x: 640, y: 260, w: 100, h: 200, note: "Printer, bench and spares for your own repairs. Everything on Mars is eventually a repair." },
];

const DOME_LAYERS = [
  { t: "Regolith shield", d: "Three metres of sintered Martian soil over the shell. Cuts radiation to a fraction of surface dose." },
  { t: "Aerogel-ETFE shell", d: "A bonded pressure envelope with aerogel insulation. Holds 70 kPa and shrugs off dust storms." },
  { t: "Living deck", d: "Two levels, 148 m², floors cantilevered off a basalt-fibre spine. Normal air, normal doors." },
  { t: "Greenhouse ring", d: "A band of beds hugging the sunlit curve. Dinner, oxygen and a view of something green." },
  { t: "Ice and water store", d: "Mined ice melts into a buried tank that doubles as thermal mass and a second radiation wall." },
  { t: "Airlock and rover port", d: "A pressurised tunnel to the vehicle bay, so a trip to the ridge never starts with a spacewalk." },
];

const WINDOWS = [
  { id: "01", date: "14 Jan 2029", ship: "Meridian Dawn", load: "12 residents · 80 t cargo", arr: "Arrives 30 Sep 2029", st: "Manifest 71% full", a: 0.1 },
  { id: "02", date: "09 Mar 2031", ship: "Meridian Dusk", load: "16 residents · 110 t cargo", arr: "Arrives 23 Nov 2031", st: "Reservations open", a: 0.34 },
  { id: "03", date: "21 Apr 2033", ship: "Perihelion", load: "24 residents · 160 t cargo", arr: "Arrives 05 Jan 2034", st: "Waitlist only", a: 0.58 },
  { id: "04", date: "03 Jun 2035", ship: "Perihelion II", load: "30 residents · 220 t cargo", arr: "Arrives 17 Feb 2036", st: "Pre-registration", a: 0.82 },
];

const LOOK: Record<string, string> = { p1: "a woman with a gray bob", p2: "a bearded man with dark hair", p3: "a woman with braided hair", p4: "a man with short curly hair", p5: "a smiling man with a short beard", p6: "a woman with long wavy dark hair", p7: "a bearded man in round glasses", p8: "a smiling man with swept-back hair", p9: "a woman with natural curly hair" };
const portraitAlt = (n: string, r: string, src: string) => `${n}, ${r}: portrait of ${LOOK[src.match(/p\d/)?.[0] ?? ""] ?? "a person"} in a black sweater`;

const STORIES = [
  {
    n: "Ines Okafor-Lindqvist",
    img: "/img/people/p3.webp",
    r: "Hydroponics agronomist · Sol 1,204",
    q: "I grew up on a Swedish potato farm and now I grow basil under a dome. My daughter thinks the dust is just a very patient dog. The first tomato took 61 sols and I did not share it.",
    h: "Meridian home 0417",
  },
  {
    n: "Tomasz Reyes",
    img: "/img/people/p5.webp",
    r: "Structural welder · Sol 842",
    q: "Gravity is kind to the knees and brutal to the ego, because you will jump too hard for a month. I weld seams that hold a house together. The sunset is the one blue thing here and it is worth the trip.",
    h: "Founder ring, plot 12",
  },
  {
    n: "Dr. Mireille Anand",
    img: "/img/people/p9.webp",
    r: "Retired GP, now the clinic · Sol 1,977",
    q: "I am 71 and my bones were the main worry. We have a centrifuge, a routine and an excellent view. People ask if I miss Lyon. I miss the bread. Bakery rota is Thursday.",
    h: "Meridian home 0102",
  },
];

const TIERS = [
  { name: "Surveyor", tag: "Share a pod, shape the plan", base: 310000, perks: ["Seat on a Meridian cruiser", "Shared residence pod, 18 m²", "Return passage included", "Two-year survey contract"] },
  { name: "Settler", tag: "Your own front door", base: 780000, perks: ["Private Meridian home, 148 m²", "Greenhouse bed and water quota", "Optional return passage", "Rover share, 12 days a month"], hot: true },
  { name: "Founder", tag: "Build the next dome", base: 2400000, perks: ["Founder ring plot and expansion rights", "Priority cargo on every window", "Two guest passages a decade", "Seat on the colony council"] },
];

const LOG = [
  { t: "T-0214", q: "Is it actually survivable?", a: "Yes, inside the dome. Outside it is 6 millibars, minus 63 °C on average and unbreathable. Everything we sell is designed to be boring to survive: redundant seals, three independent life-support loops and a shelter you can reach in under two minutes from any room." },
  { t: "T-0187", q: "How long is the journey?", a: "259 days on a minimum-energy transfer, roughly eight and a half months. The cruiser spins for 0.38 g, has a private cabin per resident and a gym you will resent. Windows open every 26 months when Earth and Mars line up." },
  { t: "T-0162", q: "Can I come back?", a: "Surveyor passage includes a return seat. Settler and Founder tiers can add one. The return window is also every 26 months, and your body needs about eight weeks of centrifuge work to readapt before you board." },
  { t: "T-0139", q: "What will I eat?", a: "Mostly what the greenhouse ring grows: potatoes, soy, greens, dwarf wheat, tomatoes, herbs. Protein is fermented and printed, with imported freeze-dried luxuries on each supply ship. Coffee is the first thing we cargo, every time." },
  { t: "T-0121", q: "What about radiation?", a: "Three metres of regolith over your home cuts the dose to roughly the level of a frequent flyer on Earth. Cruise is the worst part; the cruiser has a storm shelter lined with water. Your dosimeter badge syncs to your medical record weekly." },
  { t: "T-0098", q: "How do I talk to people on Earth?", a: "One-way light delay is 4 to 24 minutes, so live calls are out. We provide an asynchronous relay: video letters, messages and shared documents sync every sol. Weekly live windows are possible at closest approach." },
  { t: "T-0073", q: "Do I own the land?", a: "No one can own Mars; the Outer Space Treaty forbids it. You own or lease your habitat, your equipment and your claim to a share of the shared infrastructure. Founders hold long leases on a plot's use." },
  { t: "T-0041", q: "Can I bring my family?", a: "Yes. Children over six are accepted on Settler and Founder tiers, subject to medical review. Medical, schooling and a sunny, slightly dusty playground are all inside the dome. Pets are not yet cleared; we are working on it." },
];

/* ------------------------------------------------------------------ */
/* Section components                                                  */
/* ------------------------------------------------------------------ */
function Mark() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 20 Q10 14 16 19 T29 17 V29 H3Z" fill="currentColor" />
      <circle cx="22" cy="9" r="2.4" fill="currentColor" />
    </svg>
  );
}

function Nav({ small }: { small: boolean }) {
  return (
    <nav className={`ares-nav${small ? " is-small" : ""}`} aria-label="Primary">
      <a className="ares-brand" href="#top" aria-label="Ares home"><Mark /><span>ARES</span></a>
      <div className="ares-nav-links">
        <a href="#habitat">Habitat</a>
        <a href="#dome">Dome</a>
        <a href="#windows">Windows</a>
        <a href="#residents">Residents</a>
        <a href="#log">Mission log</a>
      </div>
      <a className="ares-btn ares-btn-solid ares-btn-sm" href="#passage">Reserve passage</a>
    </nav>
  );
}

function FloorPlan() {
  const [sel, setSel] = useState(4);
  const furn: Record<number, ReactNode> = {
    0: (
      <g className="ares-furn">
        {[0, 1, 2, 3].map((r) => (
          <g key={r}>
            <path d={`M80 ${100 + r * 34} H370`} strokeDasharray="4 5" />
            {Array.from({ length: 12 }, (_, c) => <circle key={c} cx={92 + c * 24} cy={100 + r * 34} r="4.5" />)}
          </g>
        ))}
      </g>
    ),
    1: <g className="ares-furn">{[0, 1, 2].map((i) => <path key={i} d={`M406 ${76 + i * 55} h78 v40 h-78z M470 ${86 + i * 55} h8 v20 h-8z`} />)}</g>,
    2: <g className="ares-furn"><circle cx="650" cy="150" r="42" /><circle cx="650" cy="150" r="26" /><path d="M582 84 h40 v26 h-40z M582 196 h40 v26 h-40z" /></g>,
    3: <g className="ares-furn"><path d="M72 272 h54 v170 h-54z M126 300 a26 26 0 0 1 26 26 M126 410 a26 26 0 0 0 26 -26" /><path d="M72 442 h106" /></g>,
    4: <g className="ares-furn"><path d="M230 410 h150 v34 h-150z M246 424 h118" /><circle cx="330" cy="344" r="26" /><path d="M200 456 A140 120 0 0 1 480 456" /></g>,
    5: <g className="ares-furn"><path d="M504 274 h124 v68" /><circle cx="570" cy="400" r="30" /><circle cx="570" cy="400" r="4" /></g>,
    6: <g className="ares-furn"><path d="M652 280 h76 v26 h-76z M652 420 h76 M652 436 h76 M660 330 l26 0 l0 50 l-26 0z" /></g>,
  };
  return (
    <section className="ares-sec ares-plan ares-pin" id="habitat" data-ares-p="pin" style={v({ "--pin": "320vh" })}>
      <div className="ares-pin-stage">
        <div className="ares-wrap ares-plan-grid">
          <div className="ares-plan-copy">
            <p className="ares-eyebrow ares-eyebrow-ink">01 · The Meridian home</p>
            <h2 className="ares-h2">One level, seven rooms, <em>zero compromises</em> on light.</h2>
            <ul className="ares-roomlist">
              {ROOMS.map((r, i) => (
                <li key={r.name} style={v({ "--s": 0.06 + i * 0.1, "--d": 0.12 })}>
                  <button type="button" className={sel === i ? "is-sel" : ""} onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)} onClick={() => setSel(i)}>
                    <span className="ares-rn">{String(i + 1).padStart(2, "0")}</span>
                    <span className="ares-rt">{r.name}</span>
                    <span className="ares-ra">{r.area} m²</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="ares-roomnote" aria-live="polite"><b>{ROOMS[sel].name}.</b> {ROOMS[sel].note}</p>
          </div>
          <div className="ares-plan-fig">
            <svg viewBox="0 0 800 520" role="img" aria-label="Floor plan of the Meridian home with seven rooms">
              <defs>
                <pattern id="ares-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(140,47,27,.14)" strokeWidth="1" /></pattern>
              </defs>
              <rect x="0" y="0" width="800" height="520" fill="url(#ares-grid)" />
              <path className="ares-draw ares-hull" pathLength="1" style={v({ "--s": 0, "--d": 0.12 })} d="M100 40 H700 A60 60 0 0 1 760 100 V420 A60 60 0 0 1 700 480 H100 A60 60 0 0 1 40 420 V100 A60 60 0 0 1 100 40Z" />
              {ROOMS.map((r, i) => {
                const s = 0.06 + i * 0.1;
                return (
                  <g key={r.name} className={`ares-room${sel === i ? " is-sel" : ""}`} style={v({ "--s": s, "--d": 0.12 })} onMouseEnter={() => setSel(i)} onClick={() => setSel(i)}>
                    <path className="ares-room-fill" d={`M${r.x} ${r.y} h${r.w} v${r.h} h${-r.w}z`} />
                    <path className="ares-draw ares-room-line" pathLength="1" d={`M${r.x} ${r.y} h${r.w} v${r.h} h${-r.w}z`} />
                    <g className="ares-room-in">{furn[i]}</g>
                    <circle className="ares-pn" cx={r.x + 24} cy={r.y + 24} r="15" />
                    <text className="ares-pnt" x={r.x + 24} y={r.y + 30} textAnchor="middle">{i + 1}</text>
                    <text className="ares-rname" x={r.x + 46} y={r.y + 29}>{r.name.toUpperCase()}</text>
                    <text className="ares-rarea" x={r.x + 46} y={r.y + 47}>{r.area} M²</text>
                  </g>
                );
              })}
              <g className="ares-dim" style={v({ "--s": 0.8, "--d": 0.1 })}>
                <path d="M40 505 H760 M40 498 V512 M760 498 V512" />
                <text x="400" y="500" textAnchor="middle">24.0 M</text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function Dome() {
  return (
    <section className="ares-sec ares-dome ares-pin" id="dome" data-ares-p="pin" style={v({ "--pin": "340vh" })}>
      <div className="ares-pin-stage">
        <div className="ares-wrap ares-dome-grid">
          <div className="ares-dome-copy">
            <p className="ares-eyebrow">02 · Cross-section</p>
            <h2 className="ares-h2">A pressure vessel with <em>a garden inside.</em></h2>
            <ol className="ares-legend">
              {DOME_LAYERS.map((l, i) => (
                <li key={l.t} style={v({ "--s": 0.52 + i * 0.07, "--d": 0.06 })}>
                  <span className="ares-ln">{i + 1}</span>
                  <span><b>{l.t}</b><i>{l.d}</i></span>
                </li>
              ))}
            </ol>
          </div>
          <div className="ares-dome-fig">
            <svg viewBox="0 0 900 540" role="img" aria-label="Cross-section of a pressurised dome buried under regolith">
              <defs>
                <pattern id="ares-reg" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.2" fill="rgba(217,154,56,.45)" /><circle cx="9" cy="8" r="1" fill="rgba(201,123,72,.4)" /></pattern>
                <linearGradient id="ares-ice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(123,163,198,.5)" /><stop offset="1" stopColor="rgba(123,163,198,.12)" /></linearGradient>
              </defs>
              <path className="ares-d" pathLength="1" style={v({ "--s": 0, "--d": 0.1, stroke: "#d99a38" })} d="M0 384 C80 378 160 388 240 381 S400 376 450 381 S620 388 700 381 S840 376 900 383" />
              {[430, 462, 494].map((y, i) => (
                <path key={y} className="ares-d ares-thin" pathLength="1" style={v({ "--s": 0.04 + i * 0.02, "--d": 0.1 })} d={`M0 ${y} C150 ${y - 8} 300 ${y + 8} 450 ${y} S750 ${y - 8} 900 ${y + 4}`} />
              ))}
              <path className="ares-fade" style={v({ "--s": 0.1, "--d": 0.14 })} d="M90 381 A360 320 0 0 1 810 381Z" fill="url(#ares-reg)" />
              <path className="ares-d" pathLength="1" style={v({ "--s": 0.1, "--d": 0.16, stroke: "#c97b48" })} d="M90 381 A360 320 0 0 1 810 381" />
              <path className="ares-fade" style={v({ "--s": 0.26, "--d": 0.1 })} d="M150 381 A300 270 0 0 1 750 381Z" fill="#26160f" />
              <path className="ares-d ares-thick" pathLength="1" style={v({ "--s": 0.24, "--d": 0.16, stroke: "#f2d3a0" })} d="M150 381 A300 270 0 0 1 750 381" />
              <path className="ares-d" pathLength="1" style={v({ "--s": 0.34, "--d": 0.14, stroke: "#e9b98c" })} d="M165 381 A285 255 0 0 1 735 381" />
              <path className="ares-d" pathLength="1" style={v({ "--s": 0.44, "--d": 0.1, stroke: "#f2d3a0" })} d="M165 381 H735" />
              <g className="ares-fade" style={v({ "--s": 0.46, "--d": 0.1 })}>
                <path className="ares-line" d="M230 300 H670 M300 300 V381 M600 300 V381 M450 300 V381" />
                <path className="ares-line" d="M262 262 h78 v38 h-78z M360 270 h60 v30 h-60z M470 266 h70 v34 h-70z" />
                <path className="ares-line" d="M250 340 h130 v41 h-130z M410 340 h110 v41 h-110z" />
              </g>
              <g className="ares-fade" style={v({ "--s": 0.54, "--d": 0.1 })}>
                {Array.from({ length: 11 }, (_, i) => {
                  const a = Math.PI * (0.18 + i * 0.064);
                  return <circle key={i} className="ares-plant" cx={450 + 262 * Math.cos(a + 0)} cy={381 - 232 * Math.sin(a)} r="8" />;
                })}
                <path className="ares-line" d="M620 381 v-32 M620 349 q-14 -6 -14 -20 M620 349 q14 -6 14 -20 M655 381 v-24 M655 357 q-12 -4 -12 -16 M655 357 q12 -4 12 -16" />
              </g>
              <g className="ares-fade" style={v({ "--s": 0.6, "--d": 0.1 })}>
                <ellipse cx="450" cy="458" rx="130" ry="30" fill="url(#ares-ice)" stroke="#7ba3c6" strokeWidth="2" />
                <path className="ares-line" d="M450 428 V381" stroke="#7ba3c6" />
              </g>
              <g className="ares-fade" style={v({ "--s": 0.66, "--d": 0.1 })}>
                <path className="ares-line" d="M735 345 H850 V381 H735 M850 345 L870 381" />
                <path className="ares-line" d="M800 371 h40 M806 371 a6 6 0 1 0 12 0 M826 371 a6 6 0 1 0 12 0" />
              </g>
              <path className="ares-air" d="M290 250 C370 170 530 170 610 250" />
              <path className="ares-air ares-air2" d="M610 275 C530 215 370 215 290 275" />
              {[
                [630, 104], [300, 146], [450, 300], [645, 322], [450, 458], [790, 360],
              ].map(([x, y], i) => (
                <g key={i} className="ares-mk" style={v({ "--s": 0.52 + i * 0.07, "--d": 0.06 })}>
                  <circle cx={x} cy={y} r="19" />
                  <text x={x} y={y + 7} textAnchor="middle">{i + 1}</text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function Windows() {
  return (
    <section className="ares-sec ares-win ares-pin" id="windows" data-ares-p="pin" style={v({ "--pin": "340vh", "--tau": "calc(-0.5 + 1.26 * var(--p))" })}>
      <div className="ares-pin-stage">
        <div className="ares-wrap ares-win-grid">
          <div className="ares-win-copy">
            <p className="ares-eyebrow">03 · Launch windows</p>
            <h2 className="ares-h2">Earth and Mars line up <em>every 26 months.</em> Be on the pad.</h2>
            <div className="ares-readouts">
              <div><span>Transit day</span><b><i data-ares-count="259" data-from="0.397" data-to="0.96" data-pad="3">000</i><u>/259</u></b></div>
              <div><span>Distance flown</span><b><i data-ares-count="483" data-from="0.397" data-to="0.96" data-pad="3">000</i><u>M km</u></b></div>
            </div>
            <ul className="ares-winlist">
              {WINDOWS.map((w) => (
                <li key={w.id} style={v({ "--s": w.a * 0.7, "--d": 0.08 })}>
                  <span className="ares-wid">WIN {w.id}</span>
                  <span className="ares-wmain"><b>{w.date}</b> · {w.ship}<i>{w.load} · {w.arr}</i></span>
                  <span className="ares-wst">{w.st}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="ares-orbit">
            <svg viewBox="0 0 600 600" role="img" aria-label="Earth and Mars orbiting the Sun while a supply ship flies a transfer arc">
              <defs>
                <radialGradient id="ares-sun"><stop offset="0" stopColor="#fff0cf" /><stop offset=".35" stopColor="#f2d3a0" stopOpacity=".7" /><stop offset="1" stopColor="#d99a38" stopOpacity="0" /></radialGradient>
              </defs>
              <circle cx="300" cy="300" r="46" fill="url(#ares-sun)" />
              <circle cx="300" cy="300" r="130" className="ares-orb" />
              <circle cx="300" cy="300" r="198" className="ares-orb" />
              <path className="ares-xfer-ghost" d="M430 300 A164 160.4 0 0 0 102 300" />
              <path className="ares-xfer" pathLength="1" style={v({ "--s": 0.397, "--d": 0.5625 })} d="M430 300 A164 160.4 0 0 0 102 300" />
              <g className="ares-spin" style={v({ "--rot": "calc(var(--tau) * -360deg)" })}>
                <circle cx="430" cy="300" r="11" fill="#7ba3c6" />
                <circle cx="430" cy="300" r="16" fill="none" stroke="#7ba3c6" strokeOpacity=".4" />
                <text x="430" y="337" textAnchor="middle" className="ares-orb-t">EARTH</text>
              </g>
              <g className="ares-spin" style={v({ "--rot": "calc(var(--tau) * -191.4deg)" })}>
                <g className="ares-spin" style={v({ "--rot": "-44.3deg" })}>
                  <circle cx="498" cy="300" r="9" fill="#c0502c" />
                  <text x="498" y="278" textAnchor="middle" className="ares-orb-t">MARS</text>
                </g>
              </g>
              <circle className="ares-ship" r="5" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function Postcards() {
  return (
    <section className="ares-sec ares-res" id="residents" data-ares-p="pass">
      <div className="ares-wrap">
        <p className="ares-eyebrow ares-eyebrow-ink" data-ares-reveal>04 · Residents</p>
        <h2 className="ares-h2 ares-h2-ink" data-ares-reveal>Postcards from <em>Sol 2,114.</em></h2>
        <div className="ares-cards">
          {STORIES.map((s, i) => (
            <figure key={s.n} className="ares-card" data-ares-reveal style={v({ "--i": i, "--rot": `${(i - 1) * 2.6}deg`, "--par": 36 + i * 30 })}>
              <div className="ares-card-in">
                <div className="ares-stamp" aria-hidden="true"><img src="/img/space/mars-surface-640.webp" alt="" width={640} height={343} loading="lazy" decoding="async" style={{ objectPosition: ["66% 63%", "22% 72%", "24% 28%"][i % 3], transformOrigin: ["66% 63%", "22% 72%", "24% 28%"][i % 3] }} /></div>
                <div className="ares-postmark" aria-hidden="true"><span>JEZERO</span><span>SOL {2114 - i * 31}</span></div>
                <blockquote>{s.q}</blockquote>
                <figcaption><img src={s.img} alt={portraitAlt(s.n, s.r.split(" · ")[0].toLowerCase(), s.img)} width={52} height={52} loading="lazy" decoding="async" /><b>{s.n}</b><span>{s.r}</span><span>{s.h}</span></figcaption>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Passage() {
  const [lease, setLease] = useState(false);
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <section className="ares-sec ares-pass" id="passage">
      <div className="ares-wrap">
        <p className="ares-eyebrow" data-ares-reveal>05 · Passage tiers</p>
        <div className="ares-pass-head" data-ares-reveal>
          <h2 className="ares-h2">Pick a seat on the <em>Meridian.</em></h2>
          <div className="ares-toggle" role="group" aria-label="Payment plan">
            <button type="button" aria-pressed={!lease} className={!lease ? "is-on" : ""} onClick={() => setLease(false)}>Pay once</button>
            <button type="button" aria-pressed={lease} className={lease ? "is-on" : ""} onClick={() => setLease(true)}>Mars lease · 20 yr</button>
          </div>
        </div>
        <div className="ares-tiers">
          {TIERS.map((t, i) => (
            <article key={t.name} className={`ares-tier${t.hot ? " is-hot" : ""}`} data-ares-reveal style={v({ "--i": i })}>
              {t.hot && <span className="ares-hot">Most chosen</span>}
              <header>
                <span className="ares-tn">BOARDING PASS · 0{i + 1}</span>
                <h3>{t.name}</h3>
                <p>{t.tag}</p>
              </header>
              <div className="ares-price">
                <b>${lease ? fmt(Math.round((t.base * 1.22) / 240 / 100) * 100) : fmt(t.base)}</b>
                <span>{lease ? "per month · 240 months" : "one payment, Earth-side"}</span>
              </div>
              <ul>{t.perks.map((p) => <li key={p}>{p}</li>)}</ul>
              <div className="ares-tear" aria-hidden="true"><span /><i /></div>
              <a className={`ares-btn ${t.hot ? "ares-btn-solid" : "ares-btn-ghost"}`} href="#hold">Request {t.name}</a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  const [typed, setTyped] = useState(9999);
  useEffect(() => {
    if (typed >= 9999) return;
    const id = window.setInterval(() => setTyped((n) => n + 3), 16);
    return () => window.clearInterval(id);
  }, [typed]);
  const pick = (i: number) => {
    if (i === open) return;
    setOpen(i);
    setTyped(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 9999 : 0);
  };
  return (
    <section className="ares-sec ares-log" id="log">
      <div className="ares-wrap">
        <p className="ares-eyebrow" data-ares-reveal>06 · Mission log</p>
        <h2 className="ares-h2" data-ares-reveal>Questions we get <em>on the uplink.</em></h2>
        <div className="ares-console" data-ares-reveal>
          <div className="ares-console-bar"><span><i /> CHANNEL 07 · LOS ANGELES ⇄ JEZERO</span><span>LIGHT DELAY 12:41</span></div>
          <div className="ares-console-body">
            {LOG.map((l, i) => {
              const on = open === i;
              const full = typed >= l.a.length;
              return (
                <div key={l.t} className={`ares-logrow${on ? " is-open" : ""}`}>
                  <button type="button" aria-expanded={on} onClick={() => pick(i)}>
                    <span className="ares-lt">{l.t}</span>
                    <span className="ares-lq">{l.q}</span>
                    <span className="ares-lp" aria-hidden="true">{on ? "−" : "+"}</span>
                  </button>
                  {on && (
                    <p className="ares-la" aria-live="polite">
                      <span className="ares-lrx">RX&gt;</span> {full ? l.a : l.a.slice(0, typed)}
                      {!full && <span className="ares-caret" />}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Hold() {
  const [left, setLeft] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    const target = Date.UTC(2029, 0, 14, 9, 0, 0);
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  const parts = (() => {
    if (left === null) return ["---", "--", "--", "--"];
    const s = Math.floor(left / 1000);
    return [String(Math.floor(s / 86400)), String(Math.floor((s % 86400) / 3600)).padStart(2, "0"), String(Math.floor((s % 3600) / 60)).padStart(2, "0"), String(s % 60).padStart(2, "0")];
  })();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const em = String(new FormData(e.currentTarget).get("email") || "");
    setDone(`B-${String(100 + ((em.length * 37) % 800))}`);
  };
  return (
    <section className="ares-sec ares-hold" id="hold">
      <div className="ares-wrap">
        <p className="ares-eyebrow ares-eyebrow-ink" data-ares-reveal>Next departure · Window 01</p>
        <h2 className="ares-h2 ares-h2-ink" data-ares-reveal>Window 01 closes <em>the manifest</em> soon.</h2>
        <div className="ares-count" data-ares-reveal role="timer" aria-label="Time until Window 01">
          {["days", "hrs", "min", "sec"].map((u, i) => (
            <div key={u}><b>{parts[i]}</b><span>{u}</span></div>
          ))}
        </div>
        {done ? (
          <p className="ares-thanks" role="status">Seat held. You are boarding group <b>{done}</b>. A passage advisor will write within two sols.</p>
        ) : (
          <form className="ares-form" onSubmit={submit}>
            <label htmlFor="ares-email" className="ares-sr">Email address</label>
            <input id="ares-email" name="email" type="email" required placeholder="you@earth.example" autoComplete="email" />
            <button className="ares-btn ares-btn-solid" type="submit">Hold my seat</button>
          </form>
        )}
        <p className="ares-fine">No deposit to hold a seat. We will send the medical pre-screen and the full manifest.</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="ares-foot">
      <div className="ares-wrap ares-foot-grid">
        <div>
          <a className="ares-brand" href="#top"><Mark /><span>ARES</span></a>
          <p>Habitats, passage and the long patience of settling a new world.</p>
        </div>
        <div><h4>Company</h4><a href="#habitat">The Meridian home</a><a href="#dome">Dome engineering</a><a href="#windows">Launch windows</a></div>
        <div><h4>Residents</h4><a href="#residents">Postcards</a><a href="#passage">Passage tiers</a><a href="#log">Mission log</a></div>
        <div><h4>Mission control</h4><a href="#hold">Hold a seat</a><a href="#top">Back to orbit</a></div>
      </div>
      <p className="ares-wrap ares-legal">Ares Habitat Company is a fictional company; this page is a design template. Prices, dates and residents are illustrative.</p>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export function Page() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [small, setSmall] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-ares-p]")).map((el) => ({
      el,
      mode: el.dataset.aresP,
      counts: Array.from(el.querySelectorAll<HTMLElement>("[data-ares-count]")),
      last: -1,
    }));
    const setCounts = (it: (typeof items)[number], p: number) => {
      for (const c of it.counts) {
        const max = Number(c.dataset.aresCount);
        const a = Number(c.dataset.from);
        const b = Number(c.dataset.to);
        const val = String(Math.round(max * clamp((p - a) / (b - a)))).padStart(Number(c.dataset.pad) || 1, "0");
        if (c.textContent !== val) c.textContent = val;
      }
    };
    const rv = Array.from(root.querySelectorAll<HTMLElement>("[data-ares-reveal]"));
    if (reduce) {
      for (const it of items) {
        it.el.style.setProperty("--p", "1");
        setCounts(it, 1);
      }
      rv.forEach((e) => e.classList.add("ares-in"));
      return;
    }
    root.classList.add("ares-js");
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) {
          e.target.classList.add("ares-in");
          io.unobserve(e.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    rv.forEach((e) => io.observe(e));
    let raf = 0;
    let wasSmall = false;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const it of items) {
        const r = it.el.getBoundingClientRect();
        if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) continue;
        const p = it.mode === "pin" ? clamp(-r.top / Math.max(1, r.height - vh)) : clamp((vh - r.top) / (vh + r.height));
        if (Math.abs(p - it.last) < 0.0008) continue;
        it.last = p;
        it.el.style.setProperty("--p", p.toFixed(4));
        if (it.counts.length) setCounts(it, p);
      }
      const sm2 = window.scrollY > vh * 0.12;
      if (sm2 !== wasSmall) {
        wasSmall = sm2;
        setSmall(sm2);
      }
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
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return (
    <div className="ares" ref={rootRef}>
      <style>{CSS}</style>
      <Nav small={small} />
      <Hero />

      <div className="ares-ticker" aria-hidden="true">
        <div className="ares-ticker-in">
          {[0, 1].map((k) => (
            <span key={k}>
              412 homes pressurised ✦ 18,400 sols of habitation ✦ 94% water recovered ✦ 6.1 mbar outside, 70 kPa inside ✦ next window 14 Jan 2029 ✦ 259 days to your front door ✦{" "}
            </span>
          ))}
        </div>
      </div>

      <section className="ares-sec ares-manifesto" data-ares-p="pass">
        <div className="ares-wrap">
          <p className="ares-eyebrow">The idea</p>
          <p className="ares-words">
            {MANIFESTO.map((w, i) => (
              <span key={i} style={v({ "--w": (i / MANIFESTO.length).toFixed(3) })}>{w} </span>
            ))}
          </p>
          <div className="ares-stats">
            {STATS.map((s) => (
              <div key={s.l} data-ares-reveal><b>{s.n}<u>{s.u}</u></b><span>{s.l}</span></div>
            ))}
          </div>
        </div>
      </section>

      <FloorPlan />
      <Dome />
      <Windows />
      <Postcards />
      <Passage />
      <Faq />
      <Hold />
      <Footer />
    </div>
  );
}

export default Page;

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const CSS = `
.ares {
  --ares-void: #0a0605; --ares-basalt: #1a100c; --ares-basalt-2: #26160f; --ares-rust: #b4502a; --ares-oxide: #8c2f1b;
  --ares-ochre: #d99a38; --ares-butter: #f2d3a0; --ares-dust: #e9b98c; --ares-pink: #f3c8b0; --ares-copper: #c97b48;
  --ares-bone: #f6e9d5; --ares-ink: #2a160e; --ares-blue: #7ba3c6; --ares-line: rgba(242,211,160,.22);
  --ares-display: "Space Grotesk", "Futura", "Avenir Next", "Century Gothic", "Trebuchet MS", ui-sans-serif, sans-serif;
  --ares-serif: "Fraunces", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --ares-mono: "JetBrains Mono", "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --p: 0;
  box-sizing: border-box; margin: 0; padding: 0; position: relative;
  font-family: var(--ares-display); font-size: 17px; line-height: 1.6; color: var(--ares-butter);
  background: var(--ares-void); overflow-x: clip; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
:where(.ares) *, :where(.ares) *::before, :where(.ares) *::after { box-sizing: border-box; }
:where(.ares) :is(h1, h2, h3, h4, p, ul, ol, li, figure, blockquote, figcaption, dl, dd) { margin: 0; padding: 0; font: inherit; list-style: none; }
:where(.ares) a { color: inherit; text-decoration: none; }
:where(.ares) :is(button, input) { font: inherit; color: inherit; margin: 0; border: 0; background: none; border-radius: 0; appearance: none; -webkit-appearance: none; }
:where(.ares) button { cursor: pointer; text-align: left; }
:where(.ares) svg { display: block; }
.ares :focus-visible { outline: 2px solid var(--ares-ochre); outline-offset: 3px; }
.ares-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.ares-wrap { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 32px; }
.ares-sec { position: relative; }
:where(.ares) em { font-family: var(--ares-serif); font-style: italic; font-weight: 400; color: var(--ares-ochre); letter-spacing: -0.01em; }

.ares-eyebrow { font-family: var(--ares-mono); font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: var(--ares-copper); margin-bottom: 18px; }
.ares-eyebrow-ink { color: var(--ares-oxide); }
.ares-h1 { font-size: clamp(54px, 9.4vw, 148px); line-height: .92; font-weight: 700; letter-spacing: -.045em; text-transform: uppercase; color: var(--ares-bone); text-shadow: 0 2px 30px rgba(10,6,5,.55); }
.ares-h1 em { text-transform: none; color: var(--ares-ochre); letter-spacing: -.03em; }
.ares-h2 { font-size: clamp(32px, 4.6vw, 68px); line-height: 1.02; font-weight: 700; letter-spacing: -.035em; text-transform: uppercase; color: var(--ares-bone); text-wrap: balance; max-width: 15em; }
.ares-h2 em { text-transform: none; }
.ares-h2-ink { color: var(--ares-ink); }
.ares-h2-ink em { color: var(--ares-oxide); }
.ares-lede { font-size: 19px; max-width: 28em; margin-top: 22px; color: var(--ares-bone); text-shadow: 0 1px 16px rgba(10,6,5,.9), 0 0 3px rgba(10,6,5,.5); }
.ares-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 26px; font-family: var(--ares-mono); font-size: 12.5px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; border-radius: 999px; transition: transform .25s, background .25s, color .25s, box-shadow .25s; white-space: nowrap; }
.ares-btn-solid { background: var(--ares-ochre); color: var(--ares-void); box-shadow: 0 0 0 0 rgba(217,154,56,.5); }
.ares-btn-solid:hover { background: var(--ares-butter); transform: translateY(-2px); box-shadow: 0 8px 30px rgba(217,154,56,.35); }
.ares-btn-ghost { box-shadow: inset 0 0 0 1.5px currentColor; color: inherit; }
.ares-btn-ghost:hover { background: rgba(242,211,160,.12); transform: translateY(-2px); }
.ares-btn-sm { min-height: 40px; padding: 0 18px; font-size: 11.5px; }

/* nav */
.ares-nav { position: fixed; z-index: 50; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px 32px; transition: background .35s, padding .35s, box-shadow .35s; color: var(--ares-bone); }
.ares-nav.is-small { background: rgba(26,16,12,.82); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); padding-top: 10px; padding-bottom: 10px; box-shadow: 0 1px 0 var(--ares-line); }
.ares-brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: .32em; font-size: 15px; color: var(--ares-bone); }
.ares-brand svg { color: var(--ares-ochre); }
.ares-nav-links { display: flex; gap: 30px; font-family: var(--ares-mono); font-size: 11.5px; letter-spacing: .16em; text-transform: uppercase; }
.ares-nav-links a { opacity: .8; transition: opacity .2s, color .2s; padding: 6px 0; }
.ares-nav-links a:hover { opacity: 1; color: var(--ares-ochre); }

/* hero */
.ares-hero { position: relative; height: 330vh; background: var(--ares-void); --hp: 0; }
.ares-hero-stage { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; color: var(--ares-bone); touch-action: pan-y; }
.ares-photo { position: absolute; inset: 0; overflow: hidden; background: #07040a; will-change: transform, opacity; }
.ares-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.ares-photo-orbit { transform-origin: 50% 85%; transform: scale(calc(1 + var(--hp) * 1.5)); opacity: calc(1 - clamp(0, (var(--hp) - .3) / .22, 1)); }
.ares-photo-orbit img { object-position: 50% 70%; }
.ares-photo-surf { transform-origin: 30% 60%; transform: scale(calc(1.45 - clamp(0, (var(--hp) - .45) / .5, 1) * .45)); opacity: clamp(0, (var(--hp) - .38) / .22, 1); }
.ares-photo-surf img { object-position: 30% 60%; }
.ares-entry { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen; background: radial-gradient(ellipse 70% 55% at 50% 105%, rgba(255,150,70,.85), rgba(210,80,30,.45) 38%, transparent 72%); opacity: min(clamp(0, (var(--hp) - .28) / .12, 1), clamp(0, (.72 - var(--hp)) / .12, 1)); }
.ares-scrim { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(10,6,5,.42) 0, rgba(10,6,5,.16) 38%, rgba(10,6,5,0) 60%), linear-gradient(0deg, rgba(10,6,5,.72) 0, rgba(10,6,5,0) 38%), linear-gradient(90deg, rgba(10,6,5,.45), rgba(10,6,5,0) 55%); }
.ares-grain { position: absolute; inset: 0; opacity: .1; mix-blend-mode: overlay; pointer-events: none; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .9 0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>"); }
.ares-vig { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 55%, transparent 55%, rgba(10,6,5,.55) 100%); }
.ares-hud { position: absolute; z-index: 3; top: 84px; font-family: var(--ares-mono); font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; padding: 12px 14px; min-width: 210px; background: linear-gradient(rgba(26,16,12,.55), rgba(26,16,12,.55)), repeating-linear-gradient(0deg, rgba(242,211,160,.06) 0 1px, transparent 1px 3px); border: 1px solid var(--ares-line); border-radius: 4px; -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); color: var(--ares-butter); pointer-events: none; }
.ares-hud::before, .ares-hud::after { content: ""; position: absolute; width: 10px; height: 10px; border: 2px solid var(--ares-ochre); }
.ares-hud::before { top: -2px; left: -2px; border-right: 0; border-bottom: 0; }
.ares-hud::after { bottom: -2px; right: -2px; border-left: 0; border-top: 0; }
.ares-hud-l { left: 32px; }
.ares-hud-r { right: 32px; text-align: right; }
.ares-hud-k { color: var(--ares-copper); margin-bottom: 6px; font-size: 10.5px; letter-spacing: .2em; }
.ares-hud-row { display: flex; justify-content: space-between; gap: 18px; padding: 2px 0; }
.ares-hud-row span { opacity: .6; }
.ares-hud-row b { font-weight: 600; color: var(--ares-bone); }
.ares-hud-row .ares-big { font-size: 19px; color: var(--ares-ochre); }
.ares-hero-a, .ares-hero-b { position: absolute; z-index: 2; left: 32px; right: 32px; will-change: transform, opacity; }
.ares-hero-a { top: 27vh; max-width: 980px; opacity: calc(1 - clamp(0, (var(--hp) - .1) / .22, 1)); transform: translateY(calc(var(--hp) * -90px)); }
.ares-hero-b { bottom: 11vh; max-width: 760px; opacity: clamp(0, (var(--hp) - .8) / .1, 1); transform: translateY(calc((1 - clamp(0, (var(--hp) - .8) / .1, 1)) * 40px)); pointer-events: none; }
.ares-hero-b .ares-cta-row { pointer-events: auto; }
.ares-hero-a .ares-eyebrow, .ares-hero-b .ares-eyebrow { color: var(--ares-butter); text-shadow: 0 1px 12px rgba(10,6,5,.8); }
.ares-h2-hero { font-size: clamp(34px, 5.4vw, 80px); text-shadow: 0 2px 24px rgba(10,6,5,.7); }
.ares-cta-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
.ares-hero-b .ares-btn-ghost { color: var(--ares-bone); background: rgba(10,6,5,.35); }
.ares-rail { position: absolute; z-index: 3; right: 14px; top: 28vh; bottom: 22vh; width: 2px; background: rgba(242,211,160,.22); }
.ares-rail span { position: absolute; top: 0; left: -4px; width: 10px; height: 10px; border-radius: 50%; background: var(--ares-ochre); box-shadow: 0 0 14px var(--ares-ochre); margin-top: -5px; }
.ares-rail span { top: 0; }
.ares-scrollcue { position: absolute; z-index: 3; left: 50%; bottom: 26px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; font-family: var(--ares-mono); font-size: 10.5px; letter-spacing: .3em; text-transform: uppercase; color: var(--ares-butter); opacity: clamp(0, 1 - var(--hp) * 18, 1); }
.ares-scrollcue i { width: 1px; height: 38px; background: linear-gradient(var(--ares-ochre), transparent); animation: ares-cue 1.8s ease-in-out infinite; transform-origin: top; }
@keyframes ares-cue { 0%, 100% { transform: scaleY(.3); opacity: .5; } 50% { transform: scaleY(1); opacity: 1; } }

/* ticker */
.ares-ticker { background: var(--ares-rust); color: var(--ares-void); overflow: hidden; white-space: nowrap; font-family: var(--ares-mono); font-size: 12.5px; letter-spacing: .14em; text-transform: uppercase; font-weight: 600; padding: 13px 0; border-top: 2px solid var(--ares-oxide); border-bottom: 2px solid var(--ares-oxide); }
.ares-ticker-in { display: inline-block; animation: ares-marq 55s linear infinite; }
@keyframes ares-marq { to { transform: translateX(-50%); } }

/* manifesto */
.ares-manifesto { background: radial-gradient(ellipse at 50% 0%, #3a1a10 0%, var(--ares-basalt) 60%); padding: 150px 0 120px; }
.ares-words { font-size: clamp(30px, 5.2vw, 76px); line-height: 1.08; font-weight: 600; letter-spacing: -.035em; max-width: 17em; color: var(--ares-bone); }
.ares-words span { opacity: calc(.17 + .83 * clamp(0, (var(--p) - .1 - var(--w) * .42) / .1, 1)); transition: opacity .15s linear; }
.ares-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin-top: 110px; border-top: 1px solid var(--ares-line); }
.ares-stats > div { padding: 28px 24px 0 0; border-right: 1px solid var(--ares-line); display: flex; flex-direction: column; gap: 10px; }
.ares-stats > div + div { padding-left: 24px; }
.ares-stats > div:last-child { border-right: 0; }
.ares-stats b { font-size: clamp(46px, 5.6vw, 84px); line-height: 1; font-weight: 700; letter-spacing: -.04em; color: var(--ares-ochre); }
.ares-stats u { font-size: .38em; text-decoration: none; margin-left: 6px; color: var(--ares-copper); letter-spacing: 0; }
.ares-stats span { font-size: 15px; line-height: 1.45; color: var(--ares-dust); max-width: 17em; }

/* reveal */
.ares-js [data-ares-reveal] { opacity: 0; transform: translateY(32px); transition: opacity .8s cubic-bezier(.2,.7,.2,1) calc(var(--i, 0) * .12s), transform .9s cubic-bezier(.2,.7,.2,1) calc(var(--i, 0) * .12s); }
.ares-js [data-ares-reveal].ares-in { opacity: 1; transform: none; }

/* pinned sections */
.ares-pin { height: var(--pin, 300vh); }
.ares-pin-stage { position: sticky; top: 0; height: 100vh; height: 100svh; display: flex; align-items: center; padding-top: 70px; overflow: hidden; }
.ares-draw { fill: none; stroke-dasharray: 1; stroke-dashoffset: calc(1 - clamp(0, (var(--p) - var(--s)) / var(--d, .1), 1)); }
.ares-d { fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: calc(1 - clamp(0, (var(--p) - var(--s)) / var(--d, .1), 1)); stroke: var(--ares-copper); }
.ares-d.ares-thin { stroke-width: 1.2; stroke: rgba(201,123,72,.5); }
.ares-d.ares-thick { stroke-width: 4; }
.ares-fade { opacity: clamp(0, (var(--p) - var(--s)) / var(--d, .1), 1); }

/* floor plan */
.ares-plan { background: var(--ares-bone); color: var(--ares-ink); }
.ares-plan .ares-h2 { color: var(--ares-ink); font-size: clamp(30px, 3.9vw, 56px); }
.ares-plan .ares-h2 em { color: var(--ares-oxide); }
.ares-plan-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 48px; align-items: center; }
.ares-roomlist { margin-top: 28px; border-top: 1px solid rgba(42,22,14,.2); }
.ares-roomlist li { opacity: clamp(.28, .28 + 1.5 * (var(--p) - var(--s)) / var(--d), 1); }
.ares-roomlist button { display: grid; grid-template-columns: 38px 1fr auto; align-items: baseline; width: 100%; padding: 10px 6px; border-bottom: 1px solid rgba(42,22,14,.2); transition: background .2s, padding .25s, color .2s; }
.ares-roomlist button:hover, .ares-roomlist button.is-sel { background: var(--ares-oxide); color: var(--ares-bone); padding-left: 14px; }
.ares-rn, .ares-ra { font-family: var(--ares-mono); font-size: 12px; letter-spacing: .08em; }
.ares-rt { font-size: 18px; font-weight: 600; letter-spacing: -.01em; }
.ares-roomnote { margin-top: 20px; font-size: 15.5px; line-height: 1.55; min-height: 5.2em; color: #4a2a1c; }
.ares-roomnote b { font-family: var(--ares-serif); font-style: italic; font-weight: 400; color: var(--ares-oxide); font-size: 1.1em; }
.ares-plan-fig svg { width: 100%; height: auto; max-height: calc(100svh - 150px); }
.ares-hull { stroke: var(--ares-ink); stroke-width: 5; stroke-linejoin: round; }
.ares-room { cursor: pointer; }
.ares-room-fill { fill: rgba(140,47,27,.0); transition: fill .25s; opacity: clamp(0, (var(--p) - var(--s) - .06) / .08, 1); }
.ares-room.is-sel .ares-room-fill { fill: rgba(180,80,42,.24); }
.ares-room-line { stroke: var(--ares-oxide); stroke-width: 2.4; }
.ares-room.is-sel .ares-room-line { stroke-width: 4; }
.ares-room-in { opacity: clamp(0, (var(--p) - var(--s) - .08) / .08, 1); }
.ares-furn path, .ares-furn circle { fill: none; stroke: rgba(42,22,14,.62); stroke-width: 1.5; stroke-linejoin: round; }
.ares-pn { fill: var(--ares-oxide); opacity: clamp(0, (var(--p) - var(--s) - .08) / .06, 1); }
.ares-pnt { fill: var(--ares-bone); font-family: var(--ares-mono); font-weight: 700; font-size: 17px; opacity: clamp(0, (var(--p) - var(--s) - .08) / .06, 1); pointer-events: none; }
.ares-rname { fill: var(--ares-ink); font-family: var(--ares-mono); font-weight: 700; font-size: 14px; letter-spacing: .08em; opacity: clamp(0, (var(--p) - var(--s) - .1) / .06, 1); pointer-events: none; }
.ares-rarea { fill: var(--ares-oxide); font-family: var(--ares-mono); font-size: 12.5px; letter-spacing: .08em; opacity: clamp(0, (var(--p) - var(--s) - .1) / .06, 1); pointer-events: none; }
.ares-dim { opacity: clamp(0, (var(--p) - var(--s)) / var(--d), 1); }
.ares-dim path { stroke: var(--ares-oxide); stroke-width: 1.5; fill: none; }
.ares-dim text { fill: var(--ares-oxide); font-family: var(--ares-mono); font-size: 13px; letter-spacing: .14em; }

/* dome */
.ares-dome { background: radial-gradient(ellipse at 50% 30%, #3b1b10 0%, var(--ares-basalt) 70%); }
.ares-dome-grid { display: grid; grid-template-columns: minmax(0, 4.4fr) minmax(0, 7fr); gap: 40px; align-items: center; }
.ares-dome .ares-h2 { font-size: clamp(30px, 3.8vw, 54px); }
.ares-legend { margin-top: 26px; display: grid; gap: 4px; }
.ares-legend li { display: grid; grid-template-columns: 34px 1fr; gap: 10px; align-items: start; padding: 7px 0; border-top: 1px solid var(--ares-line); opacity: clamp(.2, .2 + 1.6 * (var(--p) - var(--s)) / var(--d), 1); }
.ares-ln { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--ares-ochre); color: var(--ares-void); font-family: var(--ares-mono); font-weight: 700; font-size: 12px; margin-top: 2px; }
.ares-legend b { display: block; font-size: 15.5px; color: var(--ares-bone); line-height: 1.3; }
.ares-legend i { display: block; font-style: normal; font-size: 13.5px; line-height: 1.45; color: var(--ares-dust); }
.ares-dome-fig svg { width: 100%; height: auto; max-height: calc(100svh - 140px); }
.ares-line { fill: none; stroke: var(--ares-dust); stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round; }
.ares-plant { fill: rgba(143,170,90,.8); stroke: #c9d890; stroke-width: 1; }
.ares-air { fill: none; stroke: var(--ares-blue); stroke-width: 2; stroke-dasharray: 5 9; stroke-linecap: round; opacity: clamp(0, (var(--p) - .6) / .08, .8); animation: ares-air 2.2s linear infinite; }
.ares-air2 { animation-direction: reverse; stroke: var(--ares-ochre); }
@keyframes ares-air { to { stroke-dashoffset: -28; } }
.ares-mk circle { fill: var(--ares-ochre); stroke: var(--ares-void); stroke-width: 3; }
.ares-mk text { fill: var(--ares-void); font-family: var(--ares-mono); font-weight: 700; font-size: 22px; }
.ares-mk { opacity: clamp(0, (var(--p) - var(--s)) / var(--d), 1); }

/* windows */
.ares-win { background: linear-gradient(#0a0605, #130b0c 60%, #0a0605); }
.ares-win-grid { display: grid; grid-template-columns: minmax(0, 6fr) minmax(0, 6fr); gap: 40px; align-items: center; }
.ares-win .ares-h2 { font-size: clamp(30px, 3.8vw, 54px); }
.ares-readouts { display: flex; gap: 40px; margin: 24px 0 14px; font-family: var(--ares-mono); }
.ares-readouts span { display: block; font-size: 10.5px; letter-spacing: .2em; text-transform: uppercase; color: var(--ares-copper); }
.ares-readouts b { font-size: clamp(30px, 3.3vw, 46px); font-weight: 600; color: var(--ares-ochre); font-variant-numeric: tabular-nums; line-height: 1.1; }
.ares-readouts i { font-style: normal; }
.ares-readouts u { text-decoration: none; font-size: 14px; color: var(--ares-dust); margin-left: 6px; }
.ares-winlist li { display: grid; grid-template-columns: 74px 1fr auto; gap: 14px; align-items: center; padding: 12px 0; border-top: 1px solid var(--ares-line); opacity: clamp(.22, .22 + 1.6 * (var(--p) - var(--s)) / var(--d), 1); }
.ares-wid { font-family: var(--ares-mono); font-size: 12px; letter-spacing: .1em; color: var(--ares-copper); }
.ares-wmain { font-size: 16px; color: var(--ares-bone); line-height: 1.35; }
.ares-wmain b { color: var(--ares-ochre); font-weight: 600; }
.ares-wmain i { display: block; font-style: normal; font-size: 13px; color: var(--ares-dust); }
.ares-wst { font-family: var(--ares-mono); font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; padding: 5px 10px; border: 1px solid var(--ares-line); border-radius: 999px; color: var(--ares-butter); white-space: nowrap; }
.ares-orbit svg { width: 100%; height: auto; max-height: calc(100svh - 120px); margin: 0 auto; }
.ares-orb { fill: none; stroke: rgba(242,211,160,.22); stroke-dasharray: 3 6; }
.ares-xfer-ghost { fill: none; stroke: rgba(242,211,160,.14); stroke-width: 1.5; }
.ares-xfer { fill: none; stroke: var(--ares-ochre); stroke-width: 2.5; stroke-dasharray: 1; stroke-dashoffset: calc(1 - clamp(0, (var(--p) - var(--s)) / var(--d), 1)); }
.ares-spin { transform-box: view-box; transform-origin: 300px 300px; transform: rotate(var(--rot)); }
.ares-orb-t { fill: var(--ares-dust); font-family: var(--ares-mono); font-size: 12px; letter-spacing: .2em; }
.ares-ship { fill: var(--ares-bone); offset-path: path("M430 300 A164 160.4 0 0 0 102 300"); offset-rotate: 0deg; offset-distance: calc(clamp(0, (var(--p) - .397) / .5625, 1) * 100%); filter: drop-shadow(0 0 6px #f2d3a0); }

/* residents */
.ares-res { background: linear-gradient(#e9b98c, #f3c8b0 55%, #f6e9d5); color: var(--ares-ink); padding: 140px 0 160px; }
.ares-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 64px; align-items: start; }
.ares-card { transform: translateY(calc((var(--p) - .5) * var(--par) * -1px)); will-change: transform; }
.ares-card-in { position: relative; background: #fbf3e4; padding: 34px 28px 28px; border-radius: 3px; box-shadow: 0 1px 0 rgba(42,22,14,.25), 0 24px 50px -22px rgba(90,30,14,.55); transform: rotate(var(--rot)); transition: transform .5s cubic-bezier(.2,.8,.2,1), box-shadow .5s; background-image: repeating-linear-gradient(transparent 0 31px, rgba(140,47,27,.08) 31px 32px); }
.ares-card:hover .ares-card-in { transform: rotate(0deg) translateY(-6px); box-shadow: 0 1px 0 rgba(42,22,14,.25), 0 34px 60px -24px rgba(90,30,14,.65); }
.ares-card:nth-child(2) { margin-top: 46px; }
.ares-stamp { position: absolute; top: 14px; right: 14px; width: 76px; height: 58px; padding: 3px; background: #f6e9d5; outline: 2px dashed var(--ares-oxide); outline-offset: -1px; transform: rotate(4deg); overflow: hidden; }
.ares-stamp img { width: 100%; height: 100%; object-fit: cover; display: block; transform: scale(1.8); }
.ares-postmark { position: absolute; top: 20px; right: 78px; width: 70px; height: 70px; border: 2px solid rgba(140,47,27,.5); border-radius: 50%; display: grid; place-content: center; text-align: center; font-family: var(--ares-mono); font-size: 9px; letter-spacing: .1em; color: rgba(140,47,27,.7); transform: rotate(-12deg); line-height: 1.5; }
.ares-card blockquote { font-family: var(--ares-serif); font-style: italic; font-size: 19px; line-height: 32px; margin-top: 56px; color: #3a1f14; }
.ares-card figcaption { margin-top: 24px; display: grid; grid-template-columns: 52px minmax(0, 1fr); column-gap: 14px; gap: 1px 14px; font-size: 13.5px; color: #6a4030; }
.ares-card figcaption img { grid-row: 1 / span 3; width: 52px; height: 52px; border-radius: 50%; object-fit: cover; object-position: center top; border: 2px solid rgba(140,47,27,.35); align-self: center; }
.ares-card figcaption b { font-size: 16px; color: var(--ares-ink); }
.ares-card figcaption span:last-child { font-family: var(--ares-mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--ares-oxide); margin-top: 4px; }

/* passage */
.ares-pass { background: var(--ares-basalt-2); padding: 140px 0 150px; background-image: radial-gradient(ellipse at 80% 0%, rgba(180,80,42,.25), transparent 55%); }
.ares-pass-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 30px; flex-wrap: wrap; }
.ares-toggle { display: inline-flex; padding: 4px; border-radius: 999px; border: 1px solid var(--ares-line); background: rgba(10,6,5,.4); }
.ares-toggle button { padding: 10px 20px; border-radius: 999px; font-family: var(--ares-mono); font-size: 11.5px; letter-spacing: .12em; text-transform: uppercase; transition: background .25s, color .25s; white-space: nowrap; }
.ares-toggle button.is-on { background: var(--ares-ochre); color: var(--ares-void); }
.ares-tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 60px; align-items: stretch; }
.ares-tier { position: relative; display: flex; flex-direction: column; gap: 22px; padding: 30px 28px 28px; background: linear-gradient(160deg, #3a2016, #2a1710); border: 1px solid var(--ares-line); border-radius: 18px; transition: transform .35s cubic-bezier(.2,.8,.2,1), border-color .3s; -webkit-mask: radial-gradient(circle 13px at 0 76%, transparent 98%, #000) left / 51% 100% no-repeat, radial-gradient(circle 13px at 100% 76%, transparent 98%, #000) right / 51% 100% no-repeat; mask: radial-gradient(circle 13px at 0 76%, transparent 98%, #000) left / 51% 100% no-repeat, radial-gradient(circle 13px at 100% 76%, transparent 98%, #000) right / 51% 100% no-repeat; }
.ares-tier:hover { transform: translateY(-8px); border-color: var(--ares-ochre); }
.ares-tier.is-hot { background: linear-gradient(160deg, #c05a30, #8c2f1b); border-color: var(--ares-butter); color: var(--ares-bone); }
.ares-hot { position: absolute; top: 18px; right: 18px; font-family: var(--ares-mono); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; background: var(--ares-void); color: var(--ares-ochre); padding: 4px 10px; border-radius: 999px; }
.ares-tn { font-family: var(--ares-mono); font-size: 10.5px; letter-spacing: .22em; color: var(--ares-copper); }
.is-hot .ares-tn { color: var(--ares-butter); }
.ares-tier h3 { font-size: 40px; font-weight: 700; letter-spacing: -.035em; text-transform: uppercase; color: var(--ares-bone); line-height: 1.05; margin-top: 8px; }
.ares-tier header p { font-family: var(--ares-serif); font-style: italic; color: var(--ares-dust); }
.is-hot header p { color: var(--ares-butter); }
.ares-price b { display: block; font-size: 44px; line-height: 1; font-weight: 700; letter-spacing: -.04em; color: var(--ares-ochre); font-variant-numeric: tabular-nums; }
.is-hot .ares-price b { color: var(--ares-bone); }
.ares-price span { font-family: var(--ares-mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--ares-dust); }
.ares-tier ul { display: grid; gap: 9px; font-size: 15px; flex: 1; }
.ares-tier li { padding-left: 22px; position: relative; color: var(--ares-butter); }
.ares-tier li::before { content: ""; position: absolute; left: 0; top: .55em; width: 10px; height: 2px; background: var(--ares-ochre); }
.is-hot li::before { background: var(--ares-bone); }
.ares-tear { position: relative; height: 12px; display: flex; align-items: center; }
.ares-tear span { flex: 1; border-top: 2px dashed rgba(242,211,160,.35); }
.ares-tear i { position: absolute; right: 0; top: -10px; width: 64px; height: 28px; opacity: .55; background: repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 4px, currentColor 4px 5px, transparent 5px 8px); display: none; }
.ares-tier .ares-btn-ghost { color: var(--ares-butter); }

/* mission log */
.ares-log { background: var(--ares-void); padding: 140px 0 150px; }
.ares-console { margin-top: 56px; border: 1px solid rgba(217,154,56,.4); border-radius: 10px; overflow: hidden; background: #0e0806; box-shadow: 0 0 80px -30px rgba(217,154,56,.35), inset 0 0 90px rgba(217,154,56,.04); }
.ares-console-bar { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 20px; font-family: var(--ares-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; background: #22130d; color: var(--ares-butter); border-bottom: 1px solid rgba(217,154,56,.3); }
.ares-console-bar i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #7bd88f; margin-right: 8px; animation: ares-blink 1.6s steps(2) infinite; }
@keyframes ares-blink { 50% { opacity: .2; } }
.ares-console-body { background: repeating-linear-gradient(0deg, rgba(242,211,160,.025) 0 1px, transparent 1px 3px); }
.ares-logrow + .ares-logrow { border-top: 1px solid rgba(242,211,160,.12); }
.ares-logrow button { display: grid; grid-template-columns: 90px 1fr 30px; gap: 12px; align-items: baseline; width: 100%; padding: 18px 20px; font-family: var(--ares-mono); transition: background .2s; }
.ares-logrow button:hover { background: rgba(217,154,56,.07); }
.ares-lt { font-size: 12px; letter-spacing: .12em; color: var(--ares-copper); }
.ares-lq { font-size: 16px; color: var(--ares-bone); }
.ares-logrow.is-open .ares-lq { color: var(--ares-ochre); }
.ares-lp { color: var(--ares-ochre); font-size: 20px; text-align: right; }
.ares-la { padding: 0 20px 22px 122px; font-family: var(--ares-mono); font-size: 14px; line-height: 1.7; color: var(--ares-butter); max-width: 62em; min-height: 3.4em; }
.ares-lrx { color: #7bd88f; margin-right: 6px; }
.ares-caret { display: inline-block; width: 8px; height: 1.1em; background: var(--ares-ochre); vertical-align: text-bottom; margin-left: 2px; animation: ares-blink .8s steps(2) infinite; }

/* hold */
.ares-hold { background: linear-gradient(#f6e9d5, #e9b98c); color: var(--ares-ink); padding: 130px 0 120px; text-align: center; }
.ares-hold .ares-h2 { margin: 0 auto; max-width: 13em; }
.ares-count { display: flex; justify-content: center; gap: 14px; margin: 46px 0; flex-wrap: wrap; }
.ares-count > div { min-width: 118px; padding: 18px 14px 14px; background: var(--ares-basalt); color: var(--ares-ochre); border-radius: 10px; border-bottom: 4px solid var(--ares-oxide); }
.ares-count b { display: block; font-family: var(--ares-mono); font-size: clamp(34px, 5vw, 58px); line-height: 1; font-weight: 600; font-variant-numeric: tabular-nums; }
.ares-count span { font-family: var(--ares-mono); font-size: 11px; letter-spacing: .24em; text-transform: uppercase; color: var(--ares-dust); }
.ares-form { display: flex; justify-content: center; gap: 10px; max-width: 560px; margin: 0 auto; flex-wrap: wrap; }
.ares-form input { flex: 1 1 260px; min-height: 52px; padding: 0 22px; border-radius: 999px; background: #fff8ea; border: 2px solid rgba(42,22,14,.3); color: var(--ares-ink); font-size: 16px; }
.ares-form input::placeholder { color: #8a6a58; }
.ares-form input:focus { border-color: var(--ares-oxide); outline: none; box-shadow: 0 0 0 4px rgba(180,80,42,.25); }
.ares-form .ares-btn-solid { background: var(--ares-oxide); color: var(--ares-bone); min-height: 52px; }
.ares-form .ares-btn-solid:hover { background: var(--ares-rust); }
.ares-thanks { font-size: 20px; max-width: 30em; margin: 0 auto; }
.ares-thanks b { font-family: var(--ares-mono); color: var(--ares-oxide); }
.ares-fine { margin-top: 22px; font-size: 13.5px; color: #6a4030; }

/* footer */
.ares-foot { background: var(--ares-void); padding: 80px 0 40px; color: var(--ares-dust); }
.ares-foot-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; }
.ares-foot-grid p { margin-top: 16px; max-width: 22em; font-size: 15px; }
.ares-foot-grid h4 { font-family: var(--ares-mono); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--ares-copper); margin-bottom: 14px; }
.ares-foot-grid a:not(.ares-brand) { display: block; padding: 4px 0; font-size: 15px; transition: color .2s; }
.ares-foot-grid a:not(.ares-brand):hover { color: var(--ares-ochre); }
.ares-legal { margin-top: 60px; padding-top: 22px; border-top: 1px solid var(--ares-line); font-size: 12.5px; color: #9a7a68; }

/* responsive */
@media (max-width: 980px) {
  .ares-plan-grid, .ares-dome-grid, .ares-win-grid { grid-template-columns: 1fr; gap: 14px; }
  .ares-tiers, .ares-cards { grid-template-columns: 1fr; }
  .ares-card:nth-child(2) { margin-top: 0; }
  .ares-stats { grid-template-columns: repeat(2, 1fr); }
  .ares-stats > div:nth-child(2) { border-right: 0; }
  .ares-stats > div:nth-child(3) { padding-left: 0; }
  .ares-stats > div:nth-child(n+3) { border-top: 1px solid var(--ares-line); margin-top: 28px; }
  .ares-foot-grid { grid-template-columns: 1fr 1fr; }
  .ares-nav-links { display: none; }
}
@media (max-width: 700px) {
  .ares { font-size: 16px; }
  .ares-wrap { padding: 0 16px; }
  .ares-nav { padding: 12px 16px; }
  .ares-hud { top: 70px; min-width: 0; padding: 8px 10px; font-size: 9.5px; }
  .ares-hud-l { left: 12px; }
  .ares-hud-r { right: 12px; }
  .ares-hud-row { gap: 8px; }
  .ares-hud-row .ares-big { font-size: 14px; }
  .ares-hide-s { display: none; }
  .ares-hero-a, .ares-hero-b { left: 16px; right: 16px; }
  .ares-hero-a { top: 28vh; }
  .ares-lede { font-size: 16px; }
  .ares-rail { right: 6px; }
  .ares-manifesto, .ares-pass, .ares-log { padding: 90px 0; }
  .ares-res { padding: 90px 0 100px; }
  .ares-pin-stage { padding-top: 64px; align-items: flex-start; }
  .ares-plan .ares-h2, .ares-dome .ares-h2, .ares-win .ares-h2 { font-size: 24px; }
  .ares-plan .ares-eyebrow, .ares-dome .ares-eyebrow, .ares-win .ares-eyebrow { margin-bottom: 8px; }
  .ares-plan-fig { order: -1; }
  .ares-plan-fig svg { max-height: 34svh; }
  .ares-rname, .ares-rarea { display: none; }
  .ares-roomlist { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; }
  .ares-roomlist button { padding: 6px 4px; grid-template-columns: 24px 1fr auto; }
  .ares-rt { font-size: 13px; }
  .ares-ra { font-size: 10px; }
  .ares-roomnote { font-size: 13px; min-height: 0; margin-top: 10px; }
  .ares-dome-fig { order: -1; }
  .ares-dome-fig svg { max-height: 34svh; }
  .ares-legend { grid-template-columns: 1fr 1fr; column-gap: 10px; margin-top: 10px; gap: 0 10px; }
  .ares-legend li { padding: 5px 0; grid-template-columns: 24px 1fr; gap: 6px; }
  .ares-legend i { display: none; }
  .ares-legend b { font-size: 12.5px; }
  .ares-ln { width: 20px; height: 20px; font-size: 10px; }
  .ares-orbit svg { max-height: 36svh; }
  .ares-orbit { order: -1; }
  .ares-readouts { gap: 20px; margin: 8px 0; }
  .ares-readouts b { font-size: 24px; }
  .ares-winlist li { grid-template-columns: 1fr; gap: 0; padding: 6px 0; }
  .ares-wid, .ares-wst, .ares-wmain i { display: none; }
  .ares-wmain { font-size: 13.5px; }
  .ares-stats b { font-size: 44px; }
  .ares-stats span { font-size: 13px; }
  .ares-logrow button { grid-template-columns: 1fr 24px; padding: 16px 14px; }
  .ares-lt { grid-column: 1 / -1; }
  .ares-la { padding: 0 14px 18px; font-size: 13px; }
  .ares-count > div { min-width: 70px; padding: 12px 8px 10px; }
  .ares-pass-head { align-items: flex-start; }
  .ares-foot-grid { grid-template-columns: 1fr 1fr; gap: 28px; }
  .ares-foot-grid > div:first-child { grid-column: 1 / -1; }
}
@media (max-width: 700px) and (max-height: 700px) {
  .ares-roomnote { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .ares *, .ares *::before, .ares *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; transition-delay: 0ms !important; }
  .ares-hero { height: 100vh; height: 100svh; }
  .ares-hero-a { opacity: 0; }
  .ares-hero-b { opacity: 1; transform: none; }
  .ares-scrollcue, .ares-rail { display: none; }
  .ares-ticker-in { animation: none; }
  .ares-pin { height: auto; }
  .ares-pin-stage { position: relative; height: auto; min-height: 0; padding: 100px 0; overflow: visible; }
  .ares-card { transform: none; }
  .ares-air { animation: none; }
}
@media (prefers-contrast: more) {
  .ares-nav.is-small, .ares-hud { background: var(--ares-void); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
`;
