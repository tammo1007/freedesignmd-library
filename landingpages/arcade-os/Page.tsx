/**
 * Arcade OS, indie game studio landing page, presented as a retro desktop OS.
 *
 * First screen: a BIOS boot sequence that drops into a teal desktop whose
 * sections are real windows (About, Games folder, Trailer player, Devlog
 * terminal, Snake, Wishlist form): draggable by the title bar, click-to-focus,
 * minimise to the taskbar, close and re-open from desktop icons or Start.
 * Taskbar has a live clock plus CRT scanline / phosphor-glow toggles.
 * Below the desktop: ticker, roadmap bars, hi-score board (your Snake score
 * lands in it), crew portraits, system alerts and a shutdown footer.
 *
 * Everything is procedural: pixel-art SVG icons from string grids, canvas
 * trailer + snake, CSS bevels. No images, no web fonts, no network.
 * Motion is stepped (steps() easing / canvas) to feel like 8-bit hardware;
 * prefers-reduced-motion skips the boot and freezes ambient motion.
 * SSR-safe: window/document only touched inside effects.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from "react";

/* ------------------------------------------------------------------ */
/* Pixel art                                                           */
/* ------------------------------------------------------------------ */
const PAL: Record<string, string> = {
  k: "#1b1230",
  c: "#f4ecd0",
  w: "#fffdf0",
  y: "#ffd23f",
  m: "#e0338f",
  t: "#2a9d9d",
  d: "#0e4f55",
  g: "#9a9684",
  o: "#ff8a3d",
};

const ICONS: Record<string, string[]> = {
  folder: [
    "............",
    ".kkkkk......",
    "kyyyyyk.....",
    "kkkkkkkkkkk.",
    "kyyyyyyyyyyk",
    "kyyyyyyyyyyk",
    "kyyyyyyyyyyk",
    "kyyyyyyyyyyk",
    "kyyyyyyyyyyk",
    "kyyyyyyyyyyk",
    "kkkkkkkkkkkk",
    "............",
  ],
  doc: [
    "..kkkkkkkk..",
    "..kccccccck.",
    "..kcmmmmmck.",
    "..kccccccck.",
    "..kckkkkkck.",
    "..kccccccck.",
    "..kckkkkkck.",
    "..kccccccck.",
    "..kckkkkkck.",
    "..kccccccck.",
    "..kkkkkkkkk.",
    "............",
  ],
  film: [
    "............",
    "kkkkkkkkkkkk",
    "kddydddddddk",
    "kddyyddddddk",
    "kddyyydddddk",
    "kddyyddddddk",
    "kddydddddddk",
    "kddddddddddk",
    "kkkkkkkkkkkk",
    "....kkkk....",
    "..kkkkkkkk..",
    "............",
  ],
  term: [
    "............",
    "kkkkkkkkkkkk",
    "kyyyyyyyyyyk",
    "kkkkkkkkkkkk",
    "kddddddddddk",
    "kdcddddddddk",
    "kddcdddddddk",
    "kdcddcccdddk",
    "kddddddddddk",
    "kkkkkkkkkkkk",
    "............",
    "............",
  ],
  heart: [
    "............",
    "..kkk..kkk..",
    ".kmmmkkmmmk.",
    "kmmwmmmmmmmk",
    "kmwmmmmmmmmk",
    "kmmmmmmmmmmk",
    ".kmmmmmmmmk.",
    "..kmmmmmmk..",
    "...kmmmmk...",
    "....kmmk....",
    ".....kk.....",
    "............",
  ],
  alien: [
    "............",
    "...k....k...",
    "....k..k....",
    "...mmmmmm...",
    "..mmkmmkmm..",
    ".mmmmmmmmmm.",
    ".mmmmmmmmmm.",
    ".mmmmmmmmmm.",
    ".m.mmmmmm.m.",
    ".m.m....m.m.",
    "...mm..mm...",
    "............",
  ],
  cart: [
    "............",
    "kkkkkkkkkkkk",
    "kcccccccccck",
    "kckkkkkkkkck",
    "kckaaaaaakck",
    "kckaaaaaakck",
    "kckaaaaaakck",
    "kckkkkkkkkck",
    "kcccccccccck",
    "kcccckkcccck",
    "kkkkkkkkkkkk",
    "............",
  ],
  alert: [
    "kkkkkkkkkkkk",
    "kaaaaaaaaaak",
    "kaaaaccaaaak",
    "kaaaaccaaaak",
    "kaaaaccaaaak",
    "kaaaaccaaaak",
    "kaaaaccaaaak",
    "kaaaaaaaaaak",
    "kaaaaccaaaak",
    "kaaaaccaaaak",
    "kaaaaaaaaaak",
    "kkkkkkkkkkkk",
  ],
  cloud: [
    "......kkkk......",
    "....kkwwwwkk....",
    "..kkkwwwwwwkkk..",
    ".kwwwwwwwwwwwwk.",
    "kwwwwwwwwwwwwwwk",
    ".kkkkkkkkkkkkkk.",
  ],
};

function Px({
  name,
  size = 36,
  over,
  className,
}: {
  name: keyof typeof ICONS | string;
  size?: number;
  over?: Record<string, string>;
  className?: string;
}) {
  const g = ICONS[name];
  const h = g.length;
  const w = g[0].length;
  const rects: ReactNode[] = [];
  g.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      const fill = (over && over[ch]) || PAL[ch] || "#000";
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={fill} />);
      x += run;
    }
  });
  return (
    <svg
      className={className}
      width={(size * w) / 12}
      height={(size * h) / 12}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {rects}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
type WinId = "about" | "games" | "trailer" | "devlog" | "snake" | "wishlist";
type WinState = { x: number; y: number; z: number; open: boolean; min: boolean };

const WIN_META: Record<WinId, { title: string; file: string; icon: string; w: number }> = {
  about: { title: "ABOUT.TXT", file: "About", icon: "doc", w: 360 },
  games: { title: "C:\\GAMES", file: "Games", icon: "folder", w: 410 },
  trailer: { title: "TRAILER.AVI", file: "Trailer", icon: "film", w: 400 },
  devlog: { title: "DEVLOG.SH", file: "Devlog", icon: "term", w: 420 },
  snake: { title: "TAILTRAIN.EXE", file: "Tail Train", icon: "alien", w: 352 },
  wishlist: { title: "WISHLIST.DAT", file: "Wishlist", icon: "heart", w: 380 },
};
const ORDER: WinId[] = ["about", "games", "trailer", "devlog", "snake", "wishlist"];

const WIDE_POS: Record<WinId, [number, number]> = {
  about: [130, 28],
  games: [520, 28],
  trailer: [950, 28],
  devlog: [130, 362],
  snake: [545, 432],
  wishlist: [940, 366],
};

const GAMES = [
  { id: "moth", name: "Moth Kingdom", genre: "Metroidvania", status: "Wishlist on Steam", year: "2027", price: "$19.99", color: "#e0338f", blurb: "Play a moth librarian rewiring a collapsing lantern city. 40 hand-pixelled rooms, one very large lamp." },
  { id: "sand", name: "Sandwich Samurai", genre: "Rhythm brawler", status: "Early access", year: "2026", price: "$12.99", color: "#ffd23f", blurb: "Slice lunch to the beat. Four-lane parry combat, a 30-track chiptune ramen soundtrack." },
  { id: "lunch", name: "Dungeon Lunch", genre: "Roguelike cooking", status: "Released", year: "2025", price: "$14.99", color: "#2a9d9d", blurb: "Descend, forage, cook and eat what you kill. 94% positive, 61 recipes, zero health bars." },
  { id: "orbit", name: "Orbit Janitor", genre: "Cozy physics", status: "Playable demo", year: "2027", price: "Free demo", color: "#ff8a3d", blurb: "Sweep space debris with a very long tail. The demo is the Tail Train window on your desktop." },
] as const;

const DEVLOG = [
  { c: "ok", t: "$ git log --oneline -n 5" },
  { c: "", t: "a41f9c2  moth: wings now cast shadows (finally)" },
  { c: "", t: "7be03d1  audio: 32 new sfx, 3 of them are cats" },
  { c: "", t: "c90aa17  fix: door softlock in lantern hall" },
  { c: "", t: "5d2e8f0  perf: 60fps on a 2014 laptop. nice." },
  { c: "ok", t: "$ cat NOTES_OCT.txt" },
  { c: "dim", t: "-- Oct 28 -- boss 2 is fun. too fun. nerfing." },
  { c: "dim", t: "-- Oct 30 -- Luka drew 400 frames of a sneeze." },
  { c: "ok", t: "$ _ type 'help' to talk to me" },
];

const SCORES = [
  { n: "MOO", g: "Dungeon Lunch", s: 128400 },
  { n: "BEX", g: "Sandwich Samurai", s: 97250 },
  { n: "ZIP", g: "Moth Kingdom", s: 88100 },
  { n: "NAN", g: "Orbit Janitor", s: 61900 },
  { n: "OLI", g: "Dungeon Lunch", s: 42300 },
];

const ROADMAP = [
  { n: "Moth Kingdom: vertical slice", pct: 85, when: "Q4 2026" },
  { n: "Sandwich Samurai: 1.0 release", pct: 70, when: "Q1 2027" },
  { n: "Orbit Janitor: public demo", pct: 55, when: "Q2 2027" },
  { n: "Console ports (Switch, Deck)", pct: 25, when: "Q3 2027" },
];

const LOOK: Record<string, string> = { p1: "a woman with a gray bob", p2: "a bearded man with dark hair", p3: "a woman with braided hair", p4: "a man with short curly hair", p5: "a smiling man with a short beard", p6: "a woman with long wavy dark hair", p7: "a bearded man in round glasses", p8: "a smiling man with swept-back hair", p9: "a woman with natural curly hair" };
const portraitAlt = (n: string, r: string, src: string) => `${n}, ${r}: portrait of ${LOOK[src.match(/p\d/)?.[0] ?? ""] ?? "a person"} in a black sweater`;

const CREW = [
  { n: "Luka Vesel", r: "Pixel art", img: "/img/people/p8.webp" },
  { n: "Ines Okafor", r: "Design", img: "/img/people/p3.webp" },
  { n: "Bram de Wit", r: "Engine", img: "/img/people/p5.webp" },
  { n: "Sora Tanaka", r: "Music", img: "/img/people/p6.webp" },
];

const QUOTES = [
  "\"The cosiest 8 hours I spent in a collapsing city.\" - Pixel Parade",
  "\"Dungeon Lunch made me hungry AND sad.\" - Joystick Weekly",
  "\"Neon Cellar ships polish like it is a personality.\" - Indie Cargo",
  "\"I played the Orbit Janitor demo four times. Send help.\" - @lowpolyleo",
];

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */
function useInView<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
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
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

function useCount(target: number, go: boolean, ms = 1100) {
  const [v, setV] = useState(target);
  const first = useRef(true);
  useEffect(() => {
    if (!go) {
      if (first.current) {
        first.current = false;
        setV(0);
      }
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      // quantised to 24 steps for a chunky counter
      setV(Math.round(target * (Math.floor(p * 24) / 24)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setV(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [go, target, ms]);
  return v;
}

/* ------------------------------------------------------------------ */
/* Window frame                                                        */
/* ------------------------------------------------------------------ */
function Win({
  id,
  st,
  focused,
  mobile,
  stageRef,
  onFocus,
  onMin,
  onClose,
  onMove,
  children,
}: {
  id: WinId;
  st: WinState;
  focused: boolean;
  mobile: boolean;
  stageRef: React.RefObject<HTMLDivElement | null>;
  onFocus: (id: WinId) => void;
  onMin: (id: WinId) => void;
  onClose: (id: WinId) => void;
  onMove: (id: WinId, x: number, y: number) => void;
  children: ReactNode;
}) {
  const meta = WIN_META[id];
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const hidden = !st.open || st.min;

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    onFocus(id);
    if (mobile || (e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - st.x, dy: e.clientY - st.y };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const r = stageRef.current?.getBoundingClientRect();
    const W = r ? r.width : 1200;
    const H = r ? r.height : 700;
    const x = Math.max(-meta.w + 90, Math.min(W - 70, e.clientX - drag.current.dx));
    const y = Math.max(0, Math.min(H - 80, e.clientY - drag.current.dy));
    onMove(id, x, y);
  };
  const up = (e: RPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const style: CSSProperties = mobile
    ? { zIndex: st.z }
    : { zIndex: st.z, width: meta.w, transform: `translate3d(${st.x}px, ${st.y}px, 0)` };

  return (
    <section
      className={`ao-win ao-bev${focused ? " is-focus" : ""}${dragging ? " is-drag" : ""}`}
      style={{ ...style, display: hidden ? "none" : undefined }}
      onPointerDown={() => onFocus(id)}
      aria-label={meta.title}
    >
      <div
        className="ao-title"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={() => onMin(id)}
      >
        <Px name={meta.icon === "cart" ? "cart" : meta.icon} size={14} />
        <span className="ao-title-t">{meta.title}</span>
        <button className="ao-tb" aria-label={`Minimise ${meta.title}`} onClick={() => onMin(id)}>
          <i className="ao-tb-min" />
        </button>
        <button className="ao-tb" aria-label={`Close ${meta.title}`} onClick={() => onClose(id)}>
          <i className="ao-tb-x" />
        </button>
      </div>
      <div className="ao-win-body">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Window contents                                                     */
/* ------------------------------------------------------------------ */
function About({ open }: { open: (id: WinId) => void }) {
  return (
    <div className="ao-pad">
      <h2 className="ao-h">NEON CELLAR</h2>
      <p>
        We are eleven people in a converted bike cellar in Rotterdam, making small,
        strange, lovingly polished games. Every sprite is placed by hand. Every
        patch note has a joke in it.
      </p>
      <table className="ao-sys">
        <tbody>
          <tr><td>Founded</td><td>2019</td></tr>
          <tr><td>Shipped</td><td>3 games, 1 jam, 0 crunch</td></tr>
          <tr><td>Players</td><td>1.4 million</td></tr>
          <tr><td>Fuel</td><td>Stroopwafels</td></tr>
        </tbody>
      </table>
      <div className="ao-row">
        <button className="ao-btn" onClick={() => open("games")}>Browse games</button>
        <button className="ao-btn ao-btn-hot" onClick={() => open("wishlist")}>Join wishlist</button>
      </div>
    </div>
  );
}

function CartIcon({ color, size = 40 }: { color: string; size?: number }) {
  return <Px name="cart" size={size} over={{ a: color }} />;
}

function Games({ open }: { open: (id: WinId) => void }) {
  const [sel, setSel] = useState<string>(GAMES[0].id);
  const g = GAMES.find((x) => x.id === sel) ?? GAMES[0];
  return (
    <div className="ao-games">
      <div className="ao-menu"><span>File</span><span>Edit</span><span>View</span><span>Help</span></div>
      <div className="ao-games-body">
        <div className="ao-files" role="listbox" aria-label="Games">
          {GAMES.map((x) => (
            <button
              key={x.id}
              role="option"
              aria-selected={x.id === sel}
              className={`ao-file${x.id === sel ? " on" : ""}`}
              onClick={() => setSel(x.id)}
              onDoubleClick={() => (x.id === "orbit" ? open("snake") : open("wishlist"))}
            >
              <CartIcon color={x.color} size={40} />
              <span>{x.name}</span>
            </button>
          ))}
        </div>
        <div className="ao-prev ao-inset" aria-live="polite">
          <div className="ao-prev-art" style={{ background: g.color }}>
            <CartIcon color="#f4ecd0" size={56} />
          </div>
          <b className="ao-prev-n">{g.name}</b>
          <small>{g.genre} / {g.year}</small>
          <p>{g.blurb}</p>
          <button className="ao-btn ao-btn-hot" onClick={() => (g.id === "orbit" ? open("snake") : open("wishlist"))}>
            {g.id === "orbit" ? "Run demo" : g.status === "Released" ? "Buy " + g.price : "Wishlist " + g.price}
          </button>
        </div>
      </div>
      <div className="ao-status"><span>4 object(s)</span><span>{g.status}</span></div>
    </div>
  );
}

/* Trailer: a procedural 30s canvas "film" */
const TRAILER_LEN = 30;
function drawTrailer(ctx: CanvasRenderingContext2D, t: number) {
  const W = 160;
  const H = 90;
  const R = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const text = (s: string, x: number, y: number, c: string, size = 9) => {
    ctx.font = `bold ${size}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.fillStyle = c;
    ctx.fillText(s, Math.round(x), Math.round(y));
  };
  const type = (s: string, st: number) => s.slice(0, Math.max(0, Math.floor((t - st) * 14)));
  const moth = (x: number, y: number, flap: boolean) => {
    R(x, y + 2, 5, 4, "#f4ecd0");
    R(x + 1, y, 3, 2, "#ffd23f");
    R(x - (flap ? 3 : 2), y + (flap ? 0 : 2), 3, 3, "#e0338f");
    R(x + 5, y + (flap ? 0 : 2), 3, 3, "#e0338f");
    R(x + 1, y + 3, 1, 1, "#1b1230");
    R(x + 3, y + 3, 1, 1, "#1b1230");
  };
  if (t < 8) {
    const bands = ["#0e4f55", "#2a9d9d", "#7fcfb8", "#ffd23f", "#ff8a3d"];
    bands.forEach((c, i) => R(0, i * 14, W, 15, c));
    const sy = 62 - Math.min(1, t / 6) * 26;
    R(104, sy, 18, 18, "#fffdf0");
    R(106, sy - 2, 14, 22, "#fffdf0");
    for (let x = 0; x < W; x += 2) {
      const h1 = 56 + Math.sin((x + t * 10) * 0.07) * 6;
      R(x, h1, 2, H - h1, "#1f7a6a");
      const h2 = 68 + Math.sin((x + t * 24) * 0.11 + 2) * 5;
      R(x, h2, 2, H - h2, "#0e4f55");
    }
    moth(36, 40 + Math.sin(t * 4) * 3, Math.floor(t * 6) % 2 === 0);
    text(type("A MOTH. A KINGDOM.", 1), 8, 14, "#fffdf0");
  } else if (t < 16) {
    const u = t - 8;
    R(0, 0, W, H, "#1b1230");
    for (let i = 0; i < 40; i++) {
      const on = (Math.floor(u * 3) + i) % 5 !== 0;
      if (on) R((i * 37) % W, (i * 23) % 50, 1, 1, "#f4ecd0");
    }
    R(120, 10, 14, 14, "#ffd23f");
    R(125, 8, 9, 14, "#1b1230");
    for (let i = 0; i < 18; i++) {
      const bx = ((i * 11 - u * 18) % (W + 20) + (W + 20)) % (W + 20) - 10;
      const bh = 24 + ((i * 17) % 30);
      R(bx, H - bh, 10, bh, i % 2 ? "#0e4f55" : "#1f5f6a");
      for (let w = 0; w < 4; w++) {
        if ((i + w + Math.floor(u * 2)) % 3 === 0) R(bx + 2 + (w % 2) * 4, H - bh + 4 + w * 5, 2, 2, "#ffd23f");
      }
    }
    moth(40, 36 + Math.sin(u * 4) * 3, Math.floor(u * 6) % 2 === 0);
    text(type("THE LANTERNS ARE GOING OUT.", 9), 6, 14, "#f4ecd0", 8);
  } else if (t < 24) {
    const u = t - 16;
    R(0, 0, W, H, u % 1 < 0.08 ? "#fffdf0" : "#4a1250");
    R(0, 72, W, 18, "#1b1230");
    const by = 22 + Math.sin(u * 2) * 5;
    R(94, by, 40, 36, "#e0338f");
    R(98, by + 8, 10, 8, "#fffdf0");
    R(120, by + 8, 10, 8, "#fffdf0");
    R(102, by + 10, 4, 4, "#1b1230");
    R(124, by + 10, 4, 4, "#1b1230");
    R(100, by + 26, 28, 4, "#1b1230");
    for (let i = 0; i < 6; i++) {
      const bx = 90 - ((u * 40 + i * 24) % 140);
      R(bx, 30 + ((i * 13) % 36), 4, 2, "#ffd23f");
    }
    moth(24 + Math.sin(u * 3) * 8, 52 + Math.cos(u * 3) * 8, Math.floor(u * 8) % 2 === 0);
    R(6, 6, 40, 4, "#1b1230");
    R(7, 7, Math.max(2, 38 - u * 3), 2, "#ffd23f");
    text("BOSS: LAMP MOTHER", 6, 20, "#fffdf0", 7);
  } else {
    const u = t - 24;
    R(0, 0, W, H, "#1b1230");
    for (let y = 0; y < H; y += 3) R(0, y, W, 1, "#241a42");
    text("MOTH KINGDOM", 24, 40, "#ffd23f", 13);
    text("NEON CELLAR", 50, 56, "#e0338f", 8);
    if (Math.floor(u * 2) % 2 === 0) text("WISHLIST NOW", 40, 76, "#fffdf0", 8);
    R(0, (u * 40) % H, W, 2, "rgba(255,255,255,.12)");
  }
}

function Trailer({ visible }: { visible: boolean }) {
  const cv = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const tRef = useRef(0);

  const paint = useCallback((time: number) => {
    const c = cv.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawTrailer(ctx, time);
  }, []);

  useEffect(() => {
    paint(tRef.current);
  }, [paint, t]);

  useEffect(() => {
    if (!playing || !visible) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tRef.current = (tRef.current + dt) % TRAILER_LEN;
      setT(tRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible]);

  const fmt = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;
  return (
    <div className="ao-pad ao-trailer">
      <div className="ao-screen">
        <canvas ref={cv} width={160} height={90} aria-label="Moth Kingdom trailer, a procedural pixel animation" />
        {!playing && (
          <button className="ao-bigplay" onClick={() => setPlaying(true)} aria-label="Play trailer">
            <span />
          </button>
        )}
      </div>
      <div className="ao-controls">
        <button className="ao-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "II" : ">"}
        </button>
        <input
          type="range"
          className="ao-scrub"
          min={0}
          max={TRAILER_LEN}
          step={0.1}
          value={t}
          aria-label="Seek"
          onChange={(e) => {
            const v = Number(e.target.value);
            tRef.current = v;
            setT(v);
          }}
        />
        <span className="ao-time">{fmt(t)}/{fmt(TRAILER_LEN)}</span>
      </div>
    </div>
  );
}

function Devlog({ open }: { open: (id: WinId) => void }) {
  const [shown, setShown] = useState(DEVLOG.length);
  const [extra, setExtra] = useState<{ c: string; t: string }[]>([]);
  const [val, setVal] = useState("");
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShown(0);
    let n = 0;
    const id = window.setInterval(() => {
      n++;
      setShown(n);
      if (n >= DEVLOG.length) window.clearInterval(id);
    }, 260);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const b = box.current;
    if (b) b.scrollTop = b.scrollHeight;
  }, [shown, extra]);

  const run = (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    const out: { c: string; t: string }[] = [{ c: "ok", t: "$ " + raw }];
    if (cmd === "help") out.push({ c: "", t: "commands: help ls log games snake wishlist clear whoami sudo" });
    else if (cmd === "ls") out.push({ c: "", t: "moth/  samurai/  lunch/  orbit/  NOTES_OCT.txt" });
    else if (cmd === "log") out.push({ c: "dim", t: "5 commits today. 1 was a revert. 1 was a cat." });
    else if (cmd === "games") { out.push({ c: "", t: "opening C:\\GAMES ..." }); open("games"); }
    else if (cmd === "snake") { out.push({ c: "", t: "launching TAILTRAIN.EXE ..." }); open("snake"); }
    else if (cmd === "wishlist") { out.push({ c: "", t: "opening WISHLIST.DAT ..." }); open("wishlist"); }
    else if (cmd === "whoami") out.push({ c: "", t: "a visitor with excellent taste" });
    else if (cmd === "sudo") out.push({ c: "hot", t: "nice try. you are not in the sudoers file. this incident will be reported to the moth." });
    else if (cmd === "clear") { setExtra([]); setShown(0); return; }
    else if (cmd) out.push({ c: "hot", t: `${cmd}: command not found. try 'help'` });
    setExtra((e) => [...e, ...out].slice(-40));
  };

  return (
    <div className="ao-term" ref={box} onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}>
      {DEVLOG.slice(0, shown).map((l, i) => (
        <div key={i} className={`ao-tl ${l.c}`}>{l.t}</div>
      ))}
      {extra.map((l, i) => (
        <div key={"e" + i} className={`ao-tl ${l.c}`}>{l.t}</div>
      ))}
      <form
        className="ao-prompt"
        onSubmit={(e) => {
          e.preventDefault();
          run(val);
          setVal("");
        }}
      >
        <span>$</span>
        <input value={val} onChange={(e) => setVal(e.target.value)} aria-label="Terminal input" autoComplete="off" spellCheck={false} placeholder="help" />
      </form>
    </div>
  );
}

/* Snake */
const COLS = 20;
const ROWS = 15;
const CELL = 16;
type Pt = { x: number; y: number };
function Snake({ active, onBest }: { active: boolean; onBest: (n: number) => void }) {
  const cv = useRef<HTMLCanvasElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const g = useRef({
    body: [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }] as Pt[],
    dir: { x: 1, y: 0 },
    next: { x: 1, y: 0 },
    food: { x: 14, y: 7 } as Pt,
    score: 0,
    over: false,
  });
  const [state, setState] = useState<"idle" | "run" | "pause" | "over">("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  const draw = useCallback(() => {
    const c = cv.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const s = g.current;
    ctx.fillStyle = "#0e4f55";
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    ctx.fillStyle = "#14666d";
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(s.food.x * CELL + 3, s.food.y * CELL + 3, CELL - 6, CELL - 6);
    ctx.fillStyle = "#1b1230";
    ctx.fillRect(s.food.x * CELL + 7, s.food.y * CELL + 1, 2, 3);
    s.body.forEach((p, i) => {
      ctx.fillStyle = "#1b1230";
      ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = i === 0 ? "#f4ecd0" : i % 2 ? "#e0338f" : "#c22a7a";
      ctx.fillRect(p.x * CELL + 2, p.y * CELL + 2, CELL - 4, CELL - 4);
      if (i === 0) {
        ctx.fillStyle = "#1b1230";
        ctx.fillRect(p.x * CELL + 4, p.y * CELL + 4, 3, 3);
        ctx.fillRect(p.x * CELL + 9, p.y * CELL + 4, 3, 3);
      }
    });
  }, []);

  const reset = useCallback(() => {
    g.current = { body: [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }], dir: { x: 1, y: 0 }, next: { x: 1, y: 0 }, food: { x: 14, y: 7 }, score: 0, over: false };
    setScore(0);
  }, []);

  const steer = useCallback((dx: number, dy: number) => {
    const s = g.current;
    if (dx === -s.dir.x && dy === -s.dir.y) return;
    s.next = { x: dx, y: dy };
    setState((st) => (st === "idle" || st === "pause" ? "run" : st));
  }, []);

  useEffect(() => {
    draw();
  }, [draw, state]);

  useEffect(() => {
    if (state !== "run" || !active) return;
    const id = window.setInterval(() => {
      const s = g.current;
      s.dir = s.next;
      const h = { x: s.body[0].x + s.dir.x, y: s.body[0].y + s.dir.y };
      const hitWall = h.x < 0 || h.y < 0 || h.x >= COLS || h.y >= ROWS;
      const hitSelf = s.body.some((p, i) => i < s.body.length - 1 && p.x === h.x && p.y === h.y);
      if (hitWall || hitSelf) {
        s.over = true;
        setState("over");
        setBest((b) => {
          const nb = Math.max(b, s.score);
          onBest(nb);
          return nb;
        });
        draw();
        return;
      }
      s.body.unshift(h);
      if (h.x === s.food.x && h.y === s.food.y) {
        s.score += 1;
        setScore(s.score);
        let f: Pt;
        do {
          f = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
        } while (s.body.some((p) => p.x === f.x && p.y === f.y));
        s.food = f;
      } else s.body.pop();
      draw();
    }, 115);
    return () => window.clearInterval(id);
  }, [state, active, draw, onBest]);

  const key = (e: React.KeyboardEvent) => {
    const m: Record<string, [number, number]> = {
      ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
    };
    const v = m[e.key];
    if (v) {
      e.preventDefault();
      if (state === "over") {
        reset();
        setState("run");
      }
      steer(v[0], v[1]);
    } else if (e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };
  const toggle = () => {
    if (state === "run") setState("pause");
    else {
      if (state === "over") reset();
      setState("run");
    }
    box.current?.focus();
  };

  return (
    <div className="ao-snake" ref={box} tabIndex={0} onKeyDown={key} aria-label="Snake game. Arrow keys or WASD to steer, space to pause.">
      <div className="ao-hud">
        <span>SCORE {String(score).padStart(3, "0")}</span>
        <span>BEST {String(best).padStart(3, "0")}</span>
      </div>
      <div className="ao-snake-screen">
        <canvas ref={cv} width={COLS * CELL} height={ROWS * CELL} />
        {state !== "run" && (
          <div className="ao-snake-ov">
            <b>{state === "over" ? "GAME OVER" : state === "pause" ? "PAUSED" : "TAIL TRAIN"}</b>
            <small>arrows / WASD to steer</small>
            <button className="ao-btn ao-btn-hot" onClick={toggle}>{state === "over" ? "Retry" : state === "pause" ? "Resume" : "Start"}</button>
          </div>
        )}
      </div>
      <div className="ao-dpad" aria-label="On-screen controls">
        <button className="ao-btn" aria-label="Up" onClick={() => steer(0, -1)}>^</button>
        <button className="ao-btn" aria-label="Left" onClick={() => steer(-1, 0)}>{"<"}</button>
        <button className="ao-btn" aria-label="Down" onClick={() => steer(0, 1)}>v</button>
        <button className="ao-btn" aria-label="Right" onClick={() => steer(1, 0)}>{">"}</button>
      </div>
    </div>
  );
}

function Wishlist() {
  const [name, setName] = useState("");
  const [mail, setMail] = useState("");
  const [plat, setPlat] = useState("PC");
  const [genres, setGenres] = useState<string[]>(["Metroidvania"]);
  const [news, setNews] = useState(true);
  const [phase, setPhase] = useState<"form" | "saving" | "done">("form");
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (phase !== "saving") return;
    const id = window.setInterval(() => {
      setPct((p) => {
        if (p >= 100) {
          window.clearInterval(id);
          setPhase("done");
          return 100;
        }
        return p + 10;
      });
    }, 110);
    return () => window.clearInterval(id);
  }, [phase]);

  const toggleG = (g: string) => setGenres((a) => (a.includes(g) ? a.filter((x) => x !== g) : [...a, g]));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !/.+@.+\..+/.test(mail)) {
      setErr("ERROR 13: name and a valid e-mail required.");
      return;
    }
    setErr("");
    setPct(0);
    setPhase("saving");
  };

  if (phase !== "form")
    return (
      <div className="ao-pad ao-center">
        <Px name="heart" size={56} />
        {phase === "saving" ? (
          <>
            <p>Writing WISHLIST.DAT ...</p>
            <div className="ao-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < pct / 10 ? "on" : ""} />)}
            </div>
          </>
        ) : (
          <>
            <h3 className="ao-h">SAVED!</h3>
            <p>Thanks {name.split(" ")[0] || "player"}. We will ping you when Moth Kingdom opens its doors on {plat}.</p>
            <button className="ao-btn" onClick={() => { setPhase("form"); setName(""); setMail(""); }}>New entry</button>
          </>
        )}
      </div>
    );

  return (
    <form className="ao-pad ao-form" onSubmit={submit} noValidate>
      <label>Player name<input className="ao-inset" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      <label>E-mail<input className="ao-inset" type="email" value={mail} onChange={(e) => setMail(e.target.value)} autoComplete="email" /></label>
      <fieldset>
        <legend>Platform</legend>
        {["PC", "Switch", "Deck"].map((p) => (
          <label key={p} className="ao-chk"><input type="radio" name="ao-plat" checked={plat === p} onChange={() => setPlat(p)} /><i className="ao-rad" />{p}</label>
        ))}
      </fieldset>
      <fieldset>
        <legend>I like</legend>
        {["Metroidvania", "Rhythm", "Cozy", "Roguelike"].map((p) => (
          <label key={p} className="ao-chk"><input type="checkbox" checked={genres.includes(p)} onChange={() => toggleG(p)} /><i className="ao-box" />{p}</label>
        ))}
      </fieldset>
      <label className="ao-chk"><input type="checkbox" checked={news} onChange={() => setNews(!news)} /><i className="ao-box" />Monthly devlog by e-mail</label>
      {err && <p className="ao-err" role="alert">{err}</p>}
      <button className="ao-btn ao-btn-hot" type="submit">Save to wishlist</button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Below-the-desktop sections                                          */
/* ------------------------------------------------------------------ */
function Pane({ title, icon, children, id, className = "" }: { title: string; icon: string; children: ReactNode; id?: string; className?: string }) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section id={id} ref={ref} className={`ao-pane ao-bev ao-rv${seen ? " in" : ""} ${className}`}>
      <div className="ao-title is-static"><Px name={icon} size={14} /><span className="ao-title-t">{title}</span></div>
      <div className="ao-pane-body">{children}</div>
    </section>
  );
}

function Roadmap() {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="ao-road">
      {ROADMAP.map((r, row) => {
        const filled = Math.round(r.pct / 5);
        return (
          <div className="ao-road-r" key={r.n}>
            <div className="ao-road-h"><b>{r.n}</b><span>{r.when}</span></div>
            <div className="ao-bar ao-bar-l" role="img" aria-label={`${r.pct} percent`}>
              {Array.from({ length: 20 }, (_, i) => (
                <i key={i} className={seen && i < filled ? "on" : ""} style={{ transitionDelay: `${row * 160 + i * 45}ms` }} />
              ))}
              <em>{r.pct}%</em>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreRow({ rank, n, g, s, go, you }: { rank: number; n: string; g: string; s: number; go: boolean; you?: boolean }) {
  const v = useCount(s, go);
  return (
    <tr className={you ? "you" : ""}>
      <td>{String(rank).padStart(2, "0")}</td>
      <td>{n}</td>
      <td>{g}</td>
      <td className="num">{String(v).padStart(6, "0")}</td>
    </tr>
  );
}

function HiScores({ snakeBest }: { snakeBest: number }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const rows = [...SCORES.map((r) => ({ ...r, you: false }))];
  if (snakeBest > 0) rows.push({ n: "YOU", g: "Tail Train", s: snakeBest * 100, you: true });
  rows.sort((a, b) => b.s - a.s);
  return (
    <div ref={ref}>
      <table className="ao-score">
        <thead><tr><th>#</th><th>NAME</th><th>GAME</th><th className="num">SCORE</th></tr></thead>
        <tbody>
          {rows.map((r, i) => <ScoreRow key={r.n + r.g} rank={i + 1} n={r.n} g={r.g} s={r.s} go={seen} you={r.you} />)}
        </tbody>
      </table>
      <p className="ao-note">{snakeBest > 0 ? "You are on the board. Beat it in the Tail Train window." : "Play Tail Train on the desktop to put your name here."}</p>
    </div>
  );
}

function Alerts() {
  const items = [
    { t: "Warning", c: "#e0338f", m: "Too much fun detected. Continue anyway?", b: ["Yes", "Definitely"] },
    { t: "Information", c: "#ffd23f", m: "Dungeon Lunch is 40% off until Sunday. Your fridge is empty anyway.", b: ["Open store"] },
    { t: "Press", c: "#2a9d9d", m: QUOTES[2], b: ["OK"] },
  ];
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div className="ao-alerts" ref={ref}>
      {items.map((a, i) => (
        <div key={a.t} className={`ao-dlg ao-bev${seen ? " in" : ""}`} style={{ transitionDelay: `${i * 220}ms`, ["--r" as string]: `${[-1.5, 1, -0.5][i]}deg` }}>
          <div className="ao-title is-static"><span className="ao-title-t">{a.t}</span></div>
          <div className="ao-dlg-b">
            <Px name="alert" size={32} over={{ a: a.c }} />
            <p>{a.m}</p>
          </div>
          <div className="ao-dlg-f">{a.b.map((b) => <button key={b} className="ao-btn">{b}</button>)}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
const BOOT = [
  "NEON CELLAR BIOS v4.20   (c) 1996-2026",
  "CPU: Moth-486DX  @ 66MHz ........ OK",
  "Memory test: 640K ............... OK",
  "Joysticks detected .............. 2",
  "Mounting C:\\GAMES .............. 4 titles",
  "Loading ARCADE.SYS ...",
];

function Boot({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((v) => Math.min(BOOT.length, v + 1)), 340);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (n < BOOT.length) return;
    const id = window.setInterval(() => setPct((p) => Math.min(100, p + 10)), 120);
    return () => window.clearInterval(id);
  }, [n]);
  useEffect(() => {
    if (pct >= 100) {
      const id = window.setTimeout(onDone, 350);
      return () => window.clearTimeout(id);
    }
  }, [pct, onDone]);
  useEffect(() => {
    const k = () => onDone();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onDone]);
  return (
    <div className="ao-boot" onClick={onDone} role="status" aria-label="Booting Arcade OS. Click to skip.">
      <div className="ao-boot-logo"><Px name="alien" size={64} /></div>
      <div className="ao-boot-t">
        {BOOT.slice(0, n).map((l) => <div key={l}>{l}</div>)}
        <span className="ao-caret" />
      </div>
      <div className="ao-bar ao-bar-boot" aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => <i key={i} className={i < pct / 5 ? "on" : ""} />)}
      </div>
      <small>click or press any key to skip</small>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
const initWins = (): Record<WinId, WinState> => {
  const o = {} as Record<WinId, WinState>;
  ORDER.forEach((id, i) => {
    o[id] = { x: WIDE_POS[id][0], y: WIDE_POS[id][1], z: 10 + i, open: true, min: false };
  });
  return o;
};

export function Page() {
  const [booted, setBooted] = useState(false);
  const [wins, setWins] = useState<Record<WinId, WinState>>(initWins);
  const [focus, setFocus] = useState<WinId>("about");
  const [mobile, setMobile] = useState(false);
  const [crt, setCrt] = useState(true);
  const [glow, setGlow] = useState(true);
  const [menu, setMenu] = useState(false);
  const [clock, setClock] = useState("--:--");
  const [js, setJs] = useState(false);
  const [snakeBest, setSnakeBest] = useState(0);
  const zTop = useRef(30);
  const stage = useRef<HTMLDivElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const [bootKey, setBootKey] = useState(0);

  /* mount: reduced motion skips boot; layout by viewport */
  useEffect(() => {
    setJs(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setBooted(true);
    const mq = window.matchMedia("(max-width: 760px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const w = stage.current?.getBoundingClientRect().width ?? 1440;
    setWins((prev) => {
      const next = { ...prev };
      if (mobile) {
        (["trailer", "devlog", "snake"] as WinId[]).forEach((id) => (next[id] = { ...next[id], min: true }));
      } else if (w < 1280) {
        ORDER.forEach((id, i) => (next[id] = { ...next[id], x: 120 + i * 34, y: 16 + i * 36, min: false }));
      } else {
        ORDER.forEach((id) => (next[id] = { ...next[id], x: WIDE_POS[id][0], y: WIDE_POS[id][1], min: false }));
      }
      return next;
    });
  }, [mobile]);

  /* live clock */
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  /* close Start menu on outside click */
  useEffect(() => {
    if (!menu) return;
    const f = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(".ao-start-wrap")) setMenu(false);
    };
    window.addEventListener("pointerdown", f);
    return () => window.removeEventListener("pointerdown", f);
  }, [menu]);

  const bump = useCallback((id: WinId) => {
    zTop.current += 1;
    const z = zTop.current;
    setFocus(id);
    setWins((w) => (w[id].z === z ? w : { ...w, [id]: { ...w[id], z } }));
  }, []);
  const openWin = useCallback(
    (id: WinId) => {
      setWins((w) => ({ ...w, [id]: { ...w[id], open: true, min: false } }));
      bump(id);
      setMenu(false);
    },
    [bump],
  );
  const minWin = useCallback((id: WinId) => setWins((w) => ({ ...w, [id]: { ...w[id], min: true } })), []);
  const closeWin = useCallback((id: WinId) => setWins((w) => ({ ...w, [id]: { ...w[id], open: false } })), []);
  const moveWin = useCallback((id: WinId, x: number, y: number) => setWins((w) => ({ ...w, [id]: { ...w[id], x, y } })), []);
  const task = (id: WinId) => {
    const s = wins[id];
    if (s.open && !s.min && focus === id) minWin(id);
    else openWin(id);
  };
  const done = useCallback(() => setBooted(true), []);
  const reboot = () => {
    setWins(initWins());
    setBootKey((k) => k + 1);
    setBooted(false);
    root.current?.scrollIntoView({ block: "start" });
    window.scrollTo({ top: 0 });
  };

  const vis = (id: WinId) => wins[id].open && !wins[id].min;

  const winContent: Record<WinId, ReactNode> = {
    about: <About open={openWin} />,
    games: <Games open={openWin} />,
    trailer: <Trailer visible={vis("trailer") && booted} />,
    devlog: <Devlog open={openWin} />,
    snake: <Snake active={vis("snake") && booted} onBest={setSnakeBest} />,
    wishlist: <Wishlist />,
  };

  return (
    <div ref={root} className={`ao${crt ? " crt" : ""}${glow ? " glow" : ""}${js ? " js" : ""}`}>
      <style>{CSS}</style>

      {/* ---------- Desktop ---------- */}
      <div className="ao-stage" ref={stage}>
        <div className="ao-wall" aria-hidden="true">
          <div className="ao-cloud c1"><Px name="cloud" size={96} /></div>
          <div className="ao-cloud c2"><Px name="cloud" size={64} /></div>
          <div className="ao-cloud c3"><Px name="cloud" size={80} /></div>
          <div className="ao-wall-t">NEON<br />CELLAR</div>
        </div>

        {booted ? (
          <>
            <nav className="ao-icons" aria-label="Desktop icons">
              {ORDER.map((id) => (
                <button key={id} className="ao-icon" onClick={() => openWin(id)}>
                  <span className="ao-icon-art"><Px name={WIN_META[id].icon} size={36} /></span>
                  <span className="ao-icon-l">{WIN_META[id].file}</span>
                </button>
              ))}
            </nav>
            <div className="ao-desk">
              {ORDER.map((id) => (
                <Win key={id} id={id} st={wins[id]} focused={focus === id} mobile={mobile} stageRef={stage} onFocus={bump} onMin={minWin} onClose={closeWin} onMove={moveWin}>
                  {winContent[id]}
                </Win>
              ))}
            </div>
          </>
        ) : (
          <Boot key={bootKey} onDone={done} />
        )}
      </div>

      {/* ---------- Taskbar ---------- */}
      {booted && (
        <div className="ao-task" role="toolbar" aria-label="Taskbar">
          <div className="ao-start-wrap">
            <button className="ao-btn ao-start" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <Px name="alien" size={14} /> START
            </button>
            {menu && (
              <div className="ao-menu-pop ao-bev" role="menu">
                {ORDER.map((id) => (
                  <button key={id} role="menuitem" onClick={() => openWin(id)}>
                    <Px name={WIN_META[id].icon} size={16} />{WIN_META[id].title}
                  </button>
                ))}
                <hr />
                <button role="menuitem" onClick={() => { setMenu(false); reboot(); }}>Restart...</button>
              </div>
            )}
          </div>
          <div className="ao-tasks">
            {ORDER.filter((id) => wins[id].open).map((id) => (
              <button key={id} className={`ao-btn ao-taskbtn${focus === id && !wins[id].min ? " on" : ""}`} onClick={() => task(id)}>
                <Px name={WIN_META[id].icon} size={14} />
                <span>{WIN_META[id].file}</span>
              </button>
            ))}
          </div>
          <div className="ao-tray">
            <button className={`ao-btn ao-tog${crt ? " on" : ""}`} aria-pressed={crt} onClick={() => setCrt(!crt)} title="CRT scanlines">CRT</button>
            <button className={`ao-btn ao-tog${glow ? " on" : ""}`} aria-pressed={glow} onClick={() => setGlow(!glow)} title="Phosphor glow">GLOW</button>
            <time className="ao-clock ao-inset" aria-label="Current time">{clock}</time>
          </div>
        </div>
      )}

      {/* ---------- Below the desktop ---------- */}
      <main className="ao-below">
        <div className="ao-ticker" aria-label="Press quotes">
          <div className="ao-ticker-in">
            {[...QUOTES, ...QUOTES].map((q, i) => <span key={i}>{q}</span>)}
          </div>
        </div>

        <div className="ao-wrap">
          <Pane title="ROADMAP.EXE" icon="film" id="roadmap">
            <p className="ao-lead">What the cellar is cooking. Bars fill as we ship.</p>
            <Roadmap />
          </Pane>

          <div className="ao-two">
            <Pane title="HISCORES.TXT" icon="doc">
              <HiScores snakeBest={snakeBest} />
            </Pane>
            <Pane title="CREW.DAT" icon="folder">
              <div className="ao-crew">
                {CREW.map((c) => (
                  <div key={c.n} className="ao-crew-c">
                    <img className="ao-face" src={c.img} alt={portraitAlt(c.n, `${c.r.toLowerCase()} on the Arcade OS crew`, c.img)} width={72} height={72} loading="lazy" decoding="async" />
                    <b>{c.n}</b>
                    <small>{c.r}</small>
                  </div>
                ))}
              </div>
              <p className="ao-note">+7 more. We are hiring a QA wizard and a tools engineer.</p>
            </Pane>
          </div>

          <Pane title="SYSTEM ALERTS" icon="alert">
            <Alerts />
          </Pane>
        </div>

        <footer className="ao-off">
          <p>It is now safe to turn off your computer.</p>
          <small>(c) 2026 Neon Cellar Interactive B.V. - all sprites hand placed</small>
          <button className="ao-btn ao-btn-hot" onClick={reboot}>Reboot to desktop</button>
        </footer>
      </main>
    </div>
  );
}

export default Page;

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const CSS = `
.ao{--ink:#1b1230;--cream:#f4ecd0;--cream2:#e2d6a8;--teal:#2a9d9d;--dteal:#0e4f55;--mag:#e0338f;--yel:#ffd23f;--lt:#fffbe8;--sh:#b8aa7a;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,"Liberation Mono","Courier New",monospace;
  --px:"Press Start 2P","Silkscreen",ui-monospace,Menlo,Consolas,monospace;
  position:relative;box-sizing:border-box;font-family:var(--mono);font-size:13px;line-height:1.45;color:var(--ink);background:var(--dteal);
  -webkit-font-smoothing:none;min-height:100vh;overflow-x:hidden}
.ao *,.ao *::before,.ao *::after{box-sizing:border-box}
.ao button,.ao input{font-family:inherit;font-size:inherit;color:inherit}
.ao p{margin:0 0 .7em}
.ao svg{display:block;image-rendering:pixelated}

/* bevels */
.ao-bev{background:var(--cream);border:2px solid var(--ink);box-shadow:inset 2px 2px 0 var(--lt),inset -2px -2px 0 var(--sh),4px 4px 0 var(--ink)}
.ao-inset{background:var(--lt);border:2px solid var(--ink);box-shadow:inset 2px 2px 0 var(--sh)}
.ao-btn{background:var(--cream);border:2px solid var(--ink);box-shadow:inset 2px 2px 0 var(--lt),inset -2px -2px 0 var(--sh);padding:5px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;min-height:30px;line-height:1}
.ao-btn:active,.ao-btn.on{box-shadow:inset 2px 2px 0 var(--sh),inset -2px -2px 0 var(--lt);transform:translate(1px,1px)}
.ao-btn:focus-visible,.ao-icon:focus-visible,.ao-file:focus-visible,.ao-tb:focus-visible{outline:2px dashed var(--ink);outline-offset:2px}
.ao-btn-hot{background:var(--mag);color:var(--lt);font-weight:700}
.ao-h{font-family:var(--px);font-size:16px;letter-spacing:.04em;margin:0 0 10px;line-height:1.3;font-weight:700}
.ao-pad{padding:14px}
.ao-row{display:flex;gap:8px;flex-wrap:wrap}
.ao-center{text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;padding:28px 14px}

/* stage / desktop */
.ao-stage{position:relative;height:100vh;min-height:640px;max-height:1000px;overflow:hidden;
  background:var(--teal);
  background-image:linear-gradient(45deg,rgba(14,79,85,.35) 25%,transparent 25%,transparent 75%,rgba(14,79,85,.35) 75%),linear-gradient(45deg,rgba(14,79,85,.35) 25%,transparent 25%,transparent 75%,rgba(14,79,85,.35) 75%);
  background-size:8px 8px;background-position:0 0,4px 4px}
.ao-wall{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.ao-wall-t{position:absolute;right:28px;bottom:70px;font-family:var(--px);font-weight:700;font-size:clamp(34px,7vw,92px);line-height:1;letter-spacing:.05em;text-align:right;color:rgba(14,79,85,.55);text-shadow:4px 4px 0 rgba(255,210,63,.18)}
.ao-cloud{position:absolute;opacity:.55;animation:ao-drift 90s steps(60) infinite}
.ao-cloud.c1{top:6%;left:-10%}.ao-cloud.c2{top:42%;left:-20%;animation-duration:140s;animation-delay:-50s}.ao-cloud.c3{top:72%;left:-14%;animation-duration:110s;animation-delay:-20s}
@keyframes ao-drift{to{transform:translateX(125vw)}}
.ao-icons{position:absolute;left:12px;top:14px;display:flex;flex-direction:column;gap:10px;z-index:3}
.ao-icon{width:84px;background:none;border:2px solid transparent;padding:6px 2px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--lt);text-shadow:1px 1px 0 var(--ink)}
.ao-icon:hover,.ao-icon:focus-visible{border:2px dotted var(--lt);background:rgba(27,18,48,.25)}
.ao-icon-art{filter:drop-shadow(2px 2px 0 rgba(27,18,48,.5))}
.ao-icon-l{font-size:12px;font-weight:700}
.ao-desk{position:absolute;inset:0 0 40px 0}

/* windows */
.ao-win{position:absolute;left:0;top:0;max-width:calc(100% - 12px);animation:ao-pop .22s steps(4) both}
@keyframes ao-pop{from{opacity:0;clip-path:inset(40% 40% 40% 40%)}to{opacity:1;clip-path:inset(0)}}
.ao-win.is-drag{opacity:.9}
.ao-title{display:flex;align-items:center;gap:6px;height:28px;padding:0 4px 0 6px;background:#8d8a7a;color:var(--lt);font-family:var(--px);font-size:9px;font-weight:700;letter-spacing:.04em;cursor:grab;touch-action:none;user-select:none;border-bottom:2px solid var(--ink)}
.is-focus>.ao-title{background:repeating-linear-gradient(90deg,var(--mag) 0 4px,#c92a7e 4px 6px)}
.ao-win.is-drag .ao-title{cursor:grabbing}
.ao-title.is-static{cursor:default;background:repeating-linear-gradient(90deg,var(--mag) 0 4px,#c92a7e 4px 6px)}
.ao-title-t{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-shadow:1px 1px 0 var(--ink)}
.ao-tb{width:20px;height:20px;padding:0;background:var(--cream);border:2px solid var(--ink);box-shadow:inset 2px 2px 0 var(--lt),inset -2px -2px 0 var(--sh);display:grid;place-items:center;cursor:pointer}
.ao-tb:active{box-shadow:inset 2px 2px 0 var(--sh)}
.ao-tb-min{display:block;width:8px;height:2px;background:var(--ink);margin-top:5px}
.ao-tb-x{display:block;width:10px;height:10px;background:linear-gradient(45deg,transparent 40%,var(--ink) 40% 60%,transparent 60%),linear-gradient(-45deg,transparent 40%,var(--ink) 40% 60%,transparent 60%)}
.ao-win-body{background:var(--cream);max-height:calc(100vh - 100px);overflow:auto}

/* about */
.ao-sys{width:100%;border-collapse:collapse;margin:10px 0 14px;background:var(--lt);border:2px solid var(--ink)}
.ao-sys td{padding:4px 8px;border-bottom:1px dotted var(--sh)}.ao-sys td:first-child{font-weight:700;width:34%;background:var(--cream2)}

/* games */
.ao-menu{display:flex;gap:14px;padding:3px 10px;border-bottom:2px solid var(--ink);background:var(--cream2)}
.ao-games-body{display:grid;grid-template-columns:1fr 1.15fr;gap:8px;padding:8px}
.ao-files{display:grid;grid-template-columns:1fr 1fr;gap:4px;align-content:start}
.ao-file{background:none;border:2px solid transparent;padding:6px 2px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;text-align:center;font-size:11px;line-height:1.2}
.ao-file.on{background:var(--dteal);color:var(--lt);border:2px dotted var(--yel)}
.ao-prev{padding:10px;display:flex;flex-direction:column;gap:4px;min-height:230px}
.ao-prev-art{display:grid;place-items:center;height:78px;border:2px solid var(--ink);margin-bottom:4px}
.ao-prev-n{font-family:var(--px);font-size:10px;line-height:1.4}
.ao-prev p{font-size:12px;margin:4px 0 6px;flex:1}
.ao-status{display:flex;justify-content:space-between;padding:3px 10px;border-top:2px solid var(--ink);background:var(--cream2);font-size:11px}

/* trailer */
.ao-screen{position:relative;border:2px solid var(--ink);box-shadow:inset 2px 2px 0 var(--sh);background:#000;line-height:0}
.ao-screen canvas{width:100%;height:auto;aspect-ratio:16/9;image-rendering:pixelated;display:block}
.ao-bigplay{position:absolute;inset:0;background:rgba(27,18,48,.35);border:0;cursor:pointer;display:grid;place-items:center}
.ao-bigplay span{width:54px;height:54px;background:var(--yel);border:3px solid var(--ink);box-shadow:4px 4px 0 var(--ink);display:grid;place-items:center;position:relative}
.ao-bigplay span::after{content:"";border-left:16px solid var(--ink);border-top:10px solid transparent;border-bottom:10px solid transparent;margin-left:4px}
.ao-bigplay:hover span{background:var(--mag)}
.ao-controls{display:flex;gap:8px;align-items:center;margin-top:10px}
.ao-scrub{flex:1;min-width:0;accent-color:var(--mag);height:20px}
.ao-time{font-size:11px;white-space:nowrap}

/* terminal */
.ao-term{background:#0b2b30;color:#9ff3d0;height:250px;overflow:auto;padding:10px 12px;font-size:12.5px;cursor:text}
.ao-tl{white-space:pre-wrap;word-break:break-word}.ao-tl.ok{color:var(--yel)}.ao-tl.dim{color:#6fb5a0}.ao-tl.hot{color:#ff7fbf}
.ao-prompt{display:flex;gap:8px;margin-top:2px;color:var(--yel)}
.ao-prompt input{flex:1;min-width:0;background:none;border:0;outline:0;color:#9ff3d0;caret-color:var(--yel);padding:0}
.ao-prompt input::placeholder{color:#3d7a73}

/* snake */
.ao-snake{padding:10px;outline:0;display:flex;flex-direction:column;gap:8px}
.ao-snake:focus-visible .ao-snake-screen{outline:2px dashed var(--mag);outline-offset:2px}
.ao-hud{display:flex;justify-content:space-between;font-family:var(--px);font-size:9px;font-weight:700}
.ao-snake-screen{position:relative;line-height:0;border:2px solid var(--ink);box-shadow:inset 2px 2px 0 var(--sh)}
.ao-snake-screen canvas{width:100%;height:auto;aspect-ratio:4/3;image-rendering:pixelated;display:block}
.ao-snake-ov{position:absolute;inset:0;background:rgba(14,79,85,.82);display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;line-height:1.3;color:var(--lt)}
.ao-snake-ov b{font-family:var(--px);font-size:14px;color:var(--yel);text-shadow:2px 2px 0 var(--ink)}
.ao-dpad{display:none;grid-template-columns:repeat(4,1fr);gap:6px}
.ao-dpad .ao-btn{justify-content:center;min-height:38px}

/* form */
.ao-form{display:flex;flex-direction:column;gap:10px}
.ao-form label{display:flex;flex-direction:column;gap:3px;font-weight:700}
.ao-form input[type=text],.ao-form input[type=email],.ao-form input:not([type]){padding:6px 8px;outline:0}
.ao-form input.ao-inset:focus{outline:2px dashed var(--mag);outline-offset:1px}
.ao-form fieldset{border:2px solid var(--ink);margin:0;padding:6px 8px 8px;display:flex;flex-wrap:wrap;gap:4px 14px}
.ao-form legend{padding:0 4px;font-weight:700}
.ao-form label.ao-chk,.ao-chk{flex-direction:row;align-items:center;gap:6px;font-weight:400;cursor:pointer;position:relative;display:flex}
.ao-chk input{position:absolute;opacity:0;width:16px;height:16px;margin:0}
.ao-box,.ao-rad{width:16px;height:16px;border:2px solid var(--ink);background:var(--lt);box-shadow:inset 2px 2px 0 var(--sh);flex:none;position:relative}
.ao-rad{border-radius:0}
.ao-chk input:checked+.ao-box::after{content:"";position:absolute;inset:2px;background:var(--mag)}
.ao-chk input:checked+.ao-rad::after{content:"";position:absolute;inset:3px;background:var(--ink)}
.ao-chk input:focus-visible+i{outline:2px dashed var(--mag);outline-offset:2px}
.ao-err{color:var(--mag);font-weight:700;margin:0}
.ao-bar{display:flex;gap:2px;padding:3px;background:var(--lt);border:2px solid var(--ink);box-shadow:inset 2px 2px 0 var(--sh);width:100%;position:relative}
.ao-bar i{flex:1;height:16px;background:transparent}
.ao-bar i.on{background:var(--mag)}
.ao-bar-l i{transition:background 0s steps(1)}
.ao-bar-l i.on{animation:ao-fill .01s both}
.ao-bar em{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-style:normal;font-weight:700;font-size:11px;background:var(--lt);padding:0 4px}

/* taskbar */
.ao-task{position:fixed;left:0;right:0;bottom:0;height:42px;z-index:900;background:var(--cream);border-top:2px solid var(--ink);box-shadow:inset 0 2px 0 var(--lt);display:flex;align-items:center;gap:6px;padding:4px 6px}
.ao-start{font-family:var(--px);font-size:10px;font-weight:700;min-height:32px}
.ao-start-wrap{position:relative}
.ao-menu-pop{position:absolute;bottom:42px;left:0;min-width:200px;padding:4px;display:flex;flex-direction:column;z-index:2}
.ao-menu-pop button{display:flex;align-items:center;gap:8px;background:none;border:0;padding:7px 8px;text-align:left;cursor:pointer;font-weight:700}
.ao-menu-pop button:hover,.ao-menu-pop button:focus-visible{background:var(--dteal);color:var(--lt);outline:0}
.ao-menu-pop hr{border:0;border-top:2px solid var(--sh);margin:3px 0}
.ao-tasks{flex:1;min-width:0;display:flex;gap:4px;overflow:hidden}
.ao-taskbtn{min-width:0;flex:0 1 128px;justify-content:flex-start;font-size:12px}
.ao-taskbtn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ao-taskbtn.on{background:var(--cream2);font-weight:700}
.ao-tray{display:flex;gap:4px;align-items:center}
.ao-tog{font-size:11px;font-weight:700;min-height:28px;padding:4px 8px}
.ao-tog.on{background:var(--yel)}
.ao-clock{padding:5px 8px;font-weight:700;font-size:12px;min-width:84px;text-align:center;font-variant-numeric:tabular-nums}

/* boot */
.ao-boot{position:absolute;inset:0;background:#05080c;color:#9ff3d0;z-index:50;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:16px;padding:0 max(24px,8vw);cursor:pointer;font-size:14px}
.ao-boot-t{min-height:150px;line-height:1.7}
.ao-boot small{color:#4a8a80}
.ao-boot-logo{animation:ao-blink 1s steps(2) infinite}
.ao-caret{display:inline-block;width:9px;height:15px;background:#9ff3d0;vertical-align:-2px;animation:ao-blink .8s steps(2) infinite}
@keyframes ao-blink{50%{opacity:0}}
.ao-bar-boot{max-width:420px;background:#05080c;border-color:#9ff3d0;box-shadow:none}
.ao-bar-boot i.on{background:#9ff3d0}

/* below */
.ao-below{position:relative;background:var(--dteal);background-image:radial-gradient(rgba(42,157,157,.35) 1px,transparent 1.5px);background-size:8px 8px;padding-bottom:42px}
.ao-ticker{overflow:hidden;background:var(--ink);color:var(--yel);border-bottom:2px solid var(--yel);white-space:nowrap;padding:8px 0;font-weight:700}
.ao-ticker-in{display:inline-flex;gap:60px;padding-left:60px;animation:ao-scroll 50s linear infinite}
@keyframes ao-scroll{to{transform:translateX(-50%)}}
.ao-wrap{max-width:1120px;margin:0 auto;padding:56px 24px 40px;display:flex;flex-direction:column;gap:40px}
.ao-two{display:grid;grid-template-columns:1.2fr 1fr;gap:40px}
.ao-pane-body{padding:16px}
.ao-lead{margin-bottom:14px}
.js .ao-rv{opacity:0;transform:translateY(16px)}
.js .ao-rv.in{opacity:1;transform:none;transition:opacity .4s steps(4),transform .4s steps(4)}
.ao-road{display:flex;flex-direction:column;gap:14px}
.ao-road-h{display:flex;justify-content:space-between;margin-bottom:4px;gap:10px}
.ao-score{width:100%;border-collapse:collapse;background:var(--ink);color:var(--yel);font-weight:700}
.ao-score th,.ao-score td{padding:6px 10px;text-align:left}
.ao-score th{color:var(--lt);background:var(--dteal);font-family:var(--px);font-size:9px}
.ao-score .num{text-align:right;font-variant-numeric:tabular-nums}
.ao-score tr.you{background:var(--mag);color:var(--lt);animation:ao-blink 1s steps(2) 4}
.ao .ao-note{margin:12px 0 0;font-size:12px}
.ao-crew{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ao-crew-c{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;padding:10px 4px;background:var(--lt);border:2px solid var(--ink);box-shadow:inset 2px 2px 0 var(--sh)}
.ao-face{width:72px;height:72px;object-fit:cover;object-position:center top;border:2px solid var(--ink);image-rendering:auto}
.ao-eye{animation:ao-eye 4.2s steps(1) infinite}
@keyframes ao-eye{0%,92%{opacity:1}94%,98%{opacity:0}100%{opacity:1}}
.ao-alerts{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.ao-dlg{opacity:0;transform:translateY(20px) rotate(var(--r,0deg));display:flex;flex-direction:column}
.ao-dlg.in{opacity:1;transform:rotate(var(--r,0deg));transition:opacity .3s steps(3),transform .3s steps(3)}
.ao-dlg-b{display:flex;gap:12px;padding:16px 14px;align-items:flex-start;flex:1}
.ao-dlg-b p{margin:0}
.ao-dlg-f{display:flex;gap:8px;justify-content:center;padding:0 12px 14px;flex-wrap:wrap}
.ao-off{background:#000;color:#ff9d2e;text-align:center;padding:90px 24px;display:flex;flex-direction:column;align-items:center;gap:14px}
.ao-off p{font-family:var(--px);font-size:clamp(12px,2.2vw,20px);line-height:1.6;max-width:30ch;margin:0}
.ao-off small{color:#8a5a20}

/* CRT + phosphor */
.ao.crt::after{content:"";position:fixed;inset:0;z-index:9999;pointer-events:none;
  background:repeating-linear-gradient(to bottom,rgba(0,0,0,.16) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 62%,rgba(0,0,0,.38) 100%);
  animation:ao-flick 6s steps(1) infinite}
@keyframes ao-flick{0%,96%{opacity:1}97%{opacity:.82}98%{opacity:1}99%{opacity:.9}}
.ao.glow .ao-win-body,.ao.glow .ao-pane-body,.ao.glow .ao-ticker,.ao.glow .ao-icon{text-shadow:0 0 5px rgba(224,51,143,.38)}
.ao.glow .ao-term,.ao.glow .ao-boot{text-shadow:0 0 6px rgba(159,243,208,.7)}
.ao.glow .ao-off{text-shadow:0 0 10px rgba(255,157,46,.8)}

/* responsive */
@media (max-width:1000px){.ao-two{grid-template-columns:1fr}.ao-alerts{grid-template-columns:1fr}}
@media (max-width:760px){
  .ao-stage{height:auto;min-height:100vh;max-height:none;overflow:visible;padding-bottom:50px}
  .ao-icons{position:relative;left:0;top:0;flex-direction:row;flex-wrap:wrap;justify-content:center;gap:2px;padding:12px 8px 4px}
  .ao-icon{width:58px;padding:4px 0}.ao-icon-l{font-size:10px}
  .ao-desk{position:relative;inset:auto;padding:8px 10px 20px;display:flex;flex-direction:column;gap:14px}
  .ao-win{position:relative;width:100%;max-width:none;transform:none}
  .ao-win-body{max-height:none}
  .ao-wall-t{display:none}
  .ao-games-body{grid-template-columns:1fr}
  .ao-dpad{display:grid}
  .ao-boot{position:fixed}
  .ao-tray .ao-tog{padding:4px 6px}.ao-clock{min-width:0;padding:5px 5px;font-size:11px}
  .ao-tasks{display:none}
  .ao-wrap{padding:36px 12px 28px}
  .ao-crew{grid-template-columns:1fr 1fr}
  .ao-start{font-size:9px}
  .ao-cloud{animation-duration:200s}
}
@media (prefers-reduced-motion:reduce){
  .ao-cloud,.ao-ticker-in,.ao-boot-logo,.ao-caret,.ao-eye,.ao-win,.ao.crt::after,.ao-score tr.you{animation:none!important}
  .ao-ticker{white-space:normal}.ao-ticker-in{flex-wrap:wrap;gap:12px 40px}
  .js .ao-rv,.ao-dlg{opacity:1!important;transform:none!important;transition:none!important}
  .ao-dlg{transform:none}
}
`;
