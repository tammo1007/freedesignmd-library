/**
 * Clara, modern primary care & virtual clinic.
 *
 * Calm, accessible healthcare homepage: soft clinical whites, a sage/teal
 * accent, rounded geometry and a friendly rounded sans. Everything is
 * procedural (CSS gradients + inline SVG), no images, no web fonts.
 *
 * Motion
 *  - Breathing gradient orb behind the hero (8s inhale/exhale, follows the pointer).
 *  - Booking widget: visit-type switch, day chips, and a highlight pill that
 *    springs between time slots; confirm button morphs into a drawn check.
 *  - Sticky care-journey storytelling: 4 steps; the illustration is built from
 *    the same 7 primitives that morph between "phone", "video call",
 *    "care plan" and "follow-up chat".
 *  - Virtual-visit phone mock whose messages arrive in sequence.
 *  - Count-up outcome stats, insurance marquee, clinician cards with gentle
 *    lift, monthly/annual pricing toggle with rolling prices, FAQ accordions.
 *
 * Accessibility: AA+ contrast, 44px+ targets, real buttons/radios/regions,
 * aria-live for booking + pricing, visible focus rings, reduced-motion paths
 * (no orb breathing, no marquee, no count-up, instant morphs).
 * SSR-safe: no window/document access during render.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
const DAYS = [
  { key: "mon", dow: "Mon", date: "3", label: "Monday 3 November" },
  { key: "tue", dow: "Tue", date: "4", label: "Tuesday 4 November" },
  { key: "wed", dow: "Wed", date: "5", label: "Wednesday 5 November" },
  { key: "thu", dow: "Thu", date: "6", label: "Thursday 6 November" },
  { key: "fri", dow: "Fri", date: "7", label: "Friday 7 November" },
];
const TIMES = ["8:20", "9:00", "9:40", "10:40", "11:20", "1:00", "2:20", "3:40", "4:40"];
/** Deterministic availability so SSR and client agree. */
const isFree = (day: number, t: number) => ((day * 7 + t * 5) % 11) % 4 !== 0;

const INSURERS = [
  { name: "Bluefield Health", glyph: "leaf" },
  { name: "Cascadia Mutual", glyph: "wave" },
  { name: "Harbor & Pine", glyph: "pine" },
  { name: "Meridian Care", glyph: "sun" },
  { name: "Solace Assurance", glyph: "ring" },
  { name: "Evergreen PPO", glyph: "leaf" },
  { name: "Union Lakes", glyph: "wave" },
  { name: "Atlas Benefit", glyph: "ring" },
] as const;

const SERVICES = [
  { t: "Annual physicals", d: "A full hour with your clinician, labs drawn on site, results explained the same week.", icon: "heart", wide: true },
  { t: "Chronic care", d: "Diabetes, hypertension and asthma plans with check-ins between visits.", icon: "pulse" },
  { t: "Mental health", d: "Therapy and medication management, in person or by video.", icon: "mind" },
  { t: "Women's health", d: "Contraception, menopause care and cervical screening.", icon: "flower" },
  { t: "On-site labs", d: "Bloodwork in the room, most results within 24 hours.", icon: "drop" },
  { t: "Same-day sick visits", d: "Colds, UTIs, rashes and sprains, usually seen within the hour.", icon: "clock", wide: true },
] as const;

const STEPS = [
  { k: "Book", t: "Pick a time that fits your day", d: "See real availability across all six clinics and video. Most members book a same- or next-day visit in under a minute, no phone tree, no hold music." },
  { k: "Meet", t: "Unhurried time with one clinician", d: "Visits are 30 minutes, not 7. Meet in person or on video with the same doctor who knows your history, your meds and how you like to be spoken to." },
  { k: "Plan", t: "A plan you can actually follow", d: "Leave with a written care plan in the app: what we found, what we're testing, what to take, and what “better” should feel like by when." },
  { k: "Follow up", t: "We check in, so you don't have to chase", d: "Your care team messages you after labs, before refills and at the milestones in your plan. Replies from a clinician within 2 hours, 7am–9pm." },
];

const STATS = [
  { v: 4, suffix: " min", label: "Average wait in our waiting rooms", dec: 0 },
  { v: 92, suffix: "%", label: "Members seen same or next day", dec: 0 },
  { v: 4.9, suffix: "", label: "Average rating from 18,400 visit reviews", dec: 1 },
  { v: 31, suffix: "%", label: "Fewer ER visits among chronic-care members", dec: 0 },
];

const LOOK: Record<string, string> = { p1: "a woman with a gray bob", p2: "a bearded man with dark hair", p3: "a woman with braided hair", p4: "a man with short curly hair", p5: "a smiling man with a short beard", p6: "a woman with long wavy dark hair", p7: "a bearded man in round glasses", p8: "a smiling man with swept-back hair", p9: "a woman with natural curly hair" };
const portraitAlt = (n: string, r: string, src: string) => `${n}, ${r}: portrait of ${LOOK[src.match(/p\d/)?.[0] ?? ""] ?? "a person"} in a black sweater`;

const CLINICIANS = [
  { name: "Dr. Amara Osei", role: "Family medicine, MD", langs: "English, Twi, French", next: "Today 3:40 pm", img: "/img/people/p3.webp" },
  { name: "Dr. Lena Park", role: "Internal medicine, MD", langs: "English, Korean", next: "Tomorrow 9:00 am", img: "/img/people/p6.webp" },
  { name: "Mateo Ruiz, PA-C", role: "Urgent & sick visits", langs: "English, Spanish", next: "Today 1:00 pm", img: "/img/people/p8.webp" },
  { name: "Dr. Ruth Adler", role: "Psychiatry, MD", langs: "English, German, Hebrew", next: "Thu 6 Nov, 10:40 am", img: "/img/people/p1.webp" },
] as const;

const PLANS = [
  { name: "Pay per visit", monthly: 0, annual: 0, visit: "No membership fee", note: "We bill your insurance first; self-pay is $129.", feats: ["In-person & video visits", "On-site labs at cost", "Care plan in the app"], cta: "Book a visit" },
  { name: "Clara Membership", monthly: 19, annual: 199, visit: "$0 primary-care visits", note: "Most members, it pays for itself at two visits.", feats: ["Unlimited primary-care visits", "Message a clinician 7am–9pm", "Same- or next-day booking", "Annual physical with full panel"], cta: "Start membership", featured: true },
  { name: "Family", monthly: 49, annual: 499, visit: "Up to 5 people", note: "Kids 2+ and partners on one plan.", feats: ["Everything in Membership", "Pediatric well visits", "One shared family inbox"], cta: "Cover your family" },
];

const FAQ = [
  { q: "Do you take my insurance?", a: "We're in network with most major PPO and HMO plans in Washington and Oregon, including all eight shown above. Without insurance, a visit is $129 and labs are billed at cost. Check your plan at booking, it takes about ten seconds." },
  { q: "What does the membership actually cover?", a: "Unlimited primary-care visits in person or by video, messaging with your care team, and an annual physical with a full lab panel. Specialist referrals, imaging and prescriptions are billed to your insurance as usual." },
  { q: "Can I keep the same clinician?", a: "Yes. You choose a primary clinician when you join and can switch at any time. When they're away, someone on the same small care team who has read your chart will see you." },
  { q: "Is a video visit as good as coming in?", a: "For many things, follow-ups, medication changes, mental health, rashes, colds, yes. If your clinician needs to examine you or draw labs, they'll book an in-clinic slot that day at no extra cost." },
  { q: "What if it's an emergency?", a: "Clara is not an emergency service. If you have chest pain, trouble breathing, signs of stroke or a severe injury, call 911 or go to the nearest emergency room." },
];

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */
function Icon({ name }: { name: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let g = null;
  if (name === "heart") g = <path {...p} d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />;
  else if (name === "pulse") g = <path {...p} d="M3 12h4l2-5 4 10 2-5h6" />;
  else if (name === "mind") g = <><path {...p} d="M8.5 19v-2.5A6.5 6.5 0 1 1 18 11c0 1.2.8 1.6 1.5 2.5L18 15v2a2 2 0 0 1-2 2h-1.5" /><path {...p} d="M10 9.5a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.6" /></>;
  else if (name === "flower") g = <><circle {...p} cx="12" cy="10" r="2.4" /><path {...p} d="M12 7.6C12 4 9 4 9 6s1.6 3 3 4c1.4-1 3-2 3-4s-3-2-3 1.6ZM9.6 10C6 10 6 13 8 13s3-1.6 4-3M14.4 10c3.6 0 3.6 3 1.6 3s-3-1.6-4-3M12 12.4V20" /></>;
  else if (name === "drop") g = <path {...p} d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" />;
  else if (name === "clock") g = <><circle {...p} cx="12" cy="12" r="8" /><path {...p} d="M12 7.5V12l3 2" /></>;
  else if (name === "video") g = <><rect {...p} x="3" y="6.5" width="12.5" height="11" rx="3" /><path {...p} d="m15.5 10.5 5-3v9l-5-3" /></>;
  else if (name === "pin") g = <><path {...p} d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" /><circle {...p} cx="12" cy="10" r="2.3" /></>;
  else if (name === "check") g = <path {...p} d="m5 12.5 4.5 4.5L19 7.5" />;
  else if (name === "arrow") g = <path {...p} d="M5 12h14m-5-5 5 5-5 5" />;
  else if (name === "plus") g = <path {...p} d="M12 5v14M5 12h14" />;
  return (
    <svg className="cl-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {g}
    </svg>
  );
}

function InsurerMark({ name, glyph }: { name: string; glyph: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const };
  return (
    <span className="cl-ins">
      <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
        {glyph === "leaf" && <path {...s} d="M6 22C6 11 12 6 22 6c0 10-5 16-16 16Zm0 0 9-9" />}
        {glyph === "wave" && <path {...s} d="M3 11c3-3 5-3 8 0s5 3 8 0 5-3 6-1M3 18c3-3 5-3 8 0s5 3 8 0 5-3 6-1" />}
        {glyph === "pine" && <path {...s} d="M14 3 6 15h5l-4 6h14l-4-6h5L14 3Zm0 18v4" />}
        {glyph === "sun" && <><circle {...s} cx="14" cy="14" r="5" /><path {...s} d="M14 3v3M14 22v3M3 14h3M22 14h3M6.2 6.2l2.1 2.1M19.7 19.7l2.1 2.1M6.2 21.8l2.1-2.1M19.7 8.3l2.1-2.1" /></>}
        {glyph === "ring" && <><circle {...s} cx="11" cy="14" r="7" /><circle {...s} cx="17" cy="14" r="7" /></>}
      </svg>
      {name}
    </span>
  );
}

/** Morphing care-journey illustration: 7 primitives, 4 layouts. */
type Prim = { x: number; y: number; w: number; h: number; r: number; bg: string; o?: number; rot?: number };
const MORPH: Prim[][] = [
  // 0 Book, phone with calendar rows and a chosen slot
  [
    { x: 150, y: 40, w: 220, h: 400, r: 36, bg: "#FFFFFF" },
    { x: 178, y: 92, w: 164, h: 54, r: 14, bg: "#E4EFEA" },
    { x: 178, y: 162, w: 76, h: 44, r: 22, bg: "#EEF2F1" },
    { x: 266, y: 162, w: 76, h: 44, r: 22, bg: "#1F6F68" },
    { x: 178, y: 220, w: 76, h: 44, r: 22, bg: "#EEF2F1" },
    { x: 266, y: 220, w: 76, h: 44, r: 22, bg: "#EEF2F1" },
    { x: 178, y: 370, w: 164, h: 46, r: 23, bg: "#0F2420" },
  ],
  // 1 Meet, video call: screen, clinician, self-view, controls
  [
    { x: 40, y: 80, w: 440, h: 300, r: 32, bg: "#FFFFFF" },
    { x: 60, y: 100, w: 400, h: 220, r: 22, bg: "#DCEBE4" },
    { x: 205, y: 140, w: 110, h: 110, r: 55, bg: "#C48A62" },
    { x: 360, y: 230, w: 82, h: 72, r: 14, bg: "#1F6F68" },
    { x: 205, y: 330, w: 40, h: 40, r: 20, bg: "#EEF2F1" },
    { x: 275, y: 330, w: 40, h: 40, r: 20, bg: "#E26D5A" },
    { x: 165, y: 236, w: 190, h: 84, r: 60, bg: "#2C6E67" },
  ],
  // 2 Plan, care-plan document with checklist
  [
    { x: 110, y: 40, w: 300, h: 400, r: 28, bg: "#FFFFFF" },
    { x: 140, y: 72, w: 150, h: 22, r: 11, bg: "#0F2420" },
    { x: 140, y: 130, w: 26, h: 26, r: 13, bg: "#1F6F68" },
    { x: 180, y: 134, w: 190, h: 18, r: 9, bg: "#E4EFEA" },
    { x: 140, y: 182, w: 26, h: 26, r: 13, bg: "#1F6F68" },
    { x: 180, y: 186, w: 150, h: 18, r: 9, bg: "#E4EFEA" },
    { x: 140, y: 250, w: 240, h: 150, r: 18, bg: "#F3E3D3" },
  ],
  // 3 Follow up, chat bubbles + heart
  [
    { x: 60, y: 60, w: 400, h: 360, r: 36, bg: "#FFFFFF" },
    { x: 90, y: 96, w: 230, h: 60, r: 24, bg: "#EEF2F1" },
    { x: 90, y: 176, w: 40, h: 40, r: 20, bg: "#C48A62" },
    { x: 200, y: 176, w: 230, h: 60, r: 24, bg: "#1F6F68" },
    { x: 90, y: 256, w: 180, h: 60, r: 24, bg: "#EEF2F1" },
    { x: 90, y: 340, w: 58, h: 34, r: 17, bg: "#E4EFEA" },
    { x: 340, y: 300, w: 80, h: 80, r: 40, bg: "#E26D5A" },
  ],
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export function Page() {
  const rootRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"clinic" | "video">("clinic");
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<number | null>(3);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [booking, setBooking] = useState<"idle" | "busy" | "done">("idle");
  const [step, setStep] = useState(0);
  const [annual, setAnnual] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const [counts, setCounts] = useState<number[]>(STATS.map((s) => s.v));
  const [chatIn, setChatIn] = useState(false);

  const slotFree = (t: number) => isFree(day, t) && !(mode === "video" && t === 0);
  const slotLabel = slot !== null ? `${TIMES[slot]} ${slot < 5 ? "am" : "pm"}` : "";
  const firstFree = TIMES.findIndex((_, t) => slotFree(t));

  // Move the highlight pill onto the selected slot (measured, so it works at any width).
  useEffect(() => {
    const grid = slotsRef.current;
    if (!grid || slot === null) {
      setPill(null);
      return;
    }
    const measure = () => {
      const b = grid.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
      if (b) setPill({ x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight });
    };
    measure();
    const win = grid.ownerDocument.defaultView;
    const ro = win && "ResizeObserver" in win ? new win.ResizeObserver(measure) : null;
    ro?.observe(grid);
    return () => ro?.disconnect();
  }, [slot, day, mode]);

  // Keep the selection valid when day/mode changes.
  useEffect(() => {
    if (slot !== null && !slotFree(slot)) setSlot(firstFree >= 0 ? firstFree : null);
    setBooking("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, mode]);

  // Scroll: nav state + active story step + pointer-follow orb + reveals + counters + chat.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    if (!win) return;
    const reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.classList.add("cl-js");

    // Hosts that set overflow:hidden on BOTH <html> and <body> turn <body> into a
    // scroll container that never scrolls, which silently breaks position:sticky.
    // `clip` looks identical without that side effect; restored on unmount.
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

    const steps = Array.from(root.querySelectorAll<HTMLElement>("[data-cl-step]"));
    let raf = 0;
    let lastS = false;
    let lastStep = -1;
    const update = () => {
      raf = 0;
      const y = win.scrollY || doc.documentElement.scrollTop;
      const s = y > 16;
      if (s !== lastS) {
        lastS = s;
        setScrolled(s);
      }
      const mid = win.innerHeight * 0.55;
      let best = 0;
      let bestD = Infinity;
      steps.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best !== lastStep) {
        lastStep = best;
        setStep(best);
      }
    };
    const onScroll = () => {
      if (!raf) raf = win.requestAnimationFrame(update);
    };
    update();
    win.addEventListener("scroll", onScroll, { passive: true });
    win.addEventListener("resize", onScroll);

    // Orb follows the pointer with a critically-damped lerp.
    const orb = root.querySelector<HTMLElement>(".cl-orb");
    let tx = 0, ty = 0, cx = 0, cy = 0, orbRaf = 0;
    const tick = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      orb?.style.setProperty("--mx", cx.toFixed(2));
      orb?.style.setProperty("--my", cy.toFixed(2));
      orbRaf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.01 ? win.requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (reduce || e.pointerType !== "mouse") return;
      tx = (e.clientX / win.innerWidth - 0.5) * 2;
      ty = (e.clientY / win.innerHeight - 0.5) * 2;
      if (!orbRaf) orbRaf = win.requestAnimationFrame(tick);
    };
    win.addEventListener("pointermove", onMove, { passive: true });

    // Reveals.
    const io = new win.IntersectionObserver(
      (es) => es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }),
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    root.querySelectorAll("[data-cl-rv]").forEach((el) => io.observe(el));

    // Count-up stats (armed only when JS runs and motion is allowed).
    const statsEl = root.querySelector(".cl-stats");
    let countRaf = 0;
    let sio: IntersectionObserver | null = null;
    if (!reduce && statsEl) {
      setCounts(STATS.map(() => 0));
      sio = new win.IntersectionObserver(
        (es) => {
          if (!es[0].isIntersecting) return;
          sio?.disconnect();
          const t0 = win.performance.now();
          const run = (now: number) => {
            const k = Math.min(1, (now - t0) / 1800);
            const e = 1 - Math.pow(1 - k, 4);
            setCounts(STATS.map((s) => s.v * e));
            if (k < 1) countRaf = win.requestAnimationFrame(run);
          };
          countRaf = win.requestAnimationFrame(run);
        },
        { threshold: 0.4 },
      );
      sio.observe(statsEl);
    }

    // Chat mock plays when visible.
    const phone = root.querySelector(".cl-phone");
    const pio = new win.IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) {
          setChatIn(true);
          pio.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    if (phone) pio.observe(phone);

    return () => {
      win.cancelAnimationFrame(fixRaf);
      restoreBody?.();
      if (raf) win.cancelAnimationFrame(raf);
      if (orbRaf) win.cancelAnimationFrame(orbRaf);
      if (countRaf) win.cancelAnimationFrame(countRaf);
      win.removeEventListener("scroll", onScroll);
      win.removeEventListener("resize", onScroll);
      win.removeEventListener("pointermove", onMove);
      io.disconnect();
      sio?.disconnect();
      pio.disconnect();
      root.classList.remove("cl-js");
    };
  }, []);

  const book = () => {
    if (slot === null || booking !== "idle") return;
    setBooking("busy");
    const win = rootRef.current?.ownerDocument.defaultView;
    win?.setTimeout(() => setBooking("done"), 900);
  };

  const onSlotKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const free = TIMES.map((_, t) => t).filter(slotFree);
    const cur = Math.max(0, free.indexOf(slot ?? free[0]));
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? 3 : -3;
    const next = free[Math.min(free.length - 1, Math.max(0, cur + delta))];
    setSlot(next);
    setBooking("idle");
    const btn = slotsRef.current?.querySelector<HTMLElement>(`[data-slot="${next}"]`);
    btn?.focus();
  };

  const nav = ["Services", "How it works", "Clinicians", "Pricing", "FAQ"];
  const navId = (l: string) => "cl-" + l.toLowerCase().replace(/\s/g, "-");

  return (
    <div ref={rootRef} className="cl">
      <style>{css}</style>
      <a className="cl-skip" href="#cl-main">Skip to content</a>

      {/* NAV */}
      <header className={`cl-nav${scrolled ? " is-scrolled" : ""}${menuOpen ? " is-open" : ""}`}>
        <div className="cl-nav-in">
          <a href="#cl-top" className="cl-logo" aria-label="Clara Health, home">
            <span className="cl-logo-mark" aria-hidden="true"><i /><i /></span>
            clara
          </a>
          <nav className="cl-nav-links" aria-label="Primary">
            {nav.map((l) => <a key={l} href={`#${navId(l)}`}>{l}</a>)}
          </nav>
          <div className="cl-nav-end">
            <a href="#cl-top" className="cl-nav-sign">Sign in</a>
            <a href="#cl-book" className="cl-btn cl-btn-primary cl-btn-sm">Book a visit</a>
            <button type="button" className="cl-burger" aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen((o) => !o)}>
              <span /><span />
            </button>
          </div>
        </div>
        <div className="cl-sheet" hidden={!menuOpen}>
          {nav.map((l) => <a key={l} href={`#${navId(l)}`} onClick={() => setMenuOpen(false)}>{l}</a>)}
          <a href="#cl-top" onClick={() => setMenuOpen(false)}>Sign in</a>
        </div>
      </header>

      <main id="cl-main">
        {/* HERO */}
        <section id="cl-top" className="cl-hero" aria-labelledby="cl-hero-title">
          <div className="cl-orb" aria-hidden="true">
            <span className="cl-orb-a" />
            <span className="cl-orb-b" />
            <span className="cl-orb-c" />
          </div>
          <div className="cl-wrap cl-hero-grid">
            <div className="cl-hero-copy">
              <p className="cl-badge"><span className="cl-dot" aria-hidden="true" /> Open today until 8 pm · 6 clinics in Seattle & Portland</p>
              <h1 id="cl-hero-title" className="cl-h1">Primary care that has time for you.</h1>
              <p className="cl-lede">Thirty-minute visits with a clinician who knows you, in clinic or on video, usually the same day. Most insurance accepted; $19 a month for everything else.</p>
              <div className="cl-hero-ctas">
                <a href="#cl-book" className="cl-btn cl-btn-primary">Find a time <Icon name="arrow" /></a>
                <a href="#cl-pricing" className="cl-btn cl-btn-ghost">See membership</a>
              </div>
              <ul className="cl-hero-proof">
                <li><strong>4.9</strong> from 18,400 reviews</li>
                <li><strong>2 h</strong> clinician reply time</li>
                <li><strong>In network</strong> with 40+ plans</li>
              </ul>
            </div>

            {/* BOOKING WIDGET */}
            <div id="cl-book" className="cl-widget" aria-labelledby="cl-widget-title">
              <div className="cl-widget-head">
                <h2 id="cl-widget-title" className="cl-widget-title">Book a visit</h2>
                <div className="cl-seg" role="radiogroup" aria-label="Visit type">
                  {(["clinic", "video"] as const).map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? "is-on" : ""} onClick={() => setMode(m)}>
                      <Icon name={m === "clinic" ? "pin" : "video"} />
                      {m === "clinic" ? "In clinic" : "Video"}
                    </button>
                  ))}
                  <span className="cl-seg-thumb" style={{ transform: `translateX(${mode === "clinic" ? 0 : 100}%)` }} aria-hidden="true" />
                </div>
              </div>
              <p className="cl-widget-where">{mode === "clinic" ? "Capitol Hill · 1520 E Pine St, Seattle" : "From anywhere in WA or OR · link sent by text"}</p>

              <div className="cl-days" role="radiogroup" aria-label="Day">
                {DAYS.map((d, i) => (
                  <button key={d.key} type="button" role="radio" aria-checked={day === i} aria-label={d.label} className={day === i ? "is-on" : ""} onClick={() => setDay(i)}>
                    <small>{d.dow}</small>
                    <span>{d.date}</span>
                  </button>
                ))}
              </div>

              <div className="cl-slots" ref={slotsRef} role="radiogroup" aria-label={`Times on ${DAYS[day].label}`} onKeyDown={onSlotKey}>
                <span className={`cl-slot-pill${pill ? " is-on" : ""}`} aria-hidden="true" style={pill ? ({ transform: `translate(${pill.x}px, ${pill.y}px)`, width: pill.w, height: pill.h } as CSSProperties) : undefined} />
                {TIMES.map((t, i) => {
                  const free = slotFree(i);
                  const on = slot === i;
                  return (
                    <button key={t} type="button" role="radio" data-slot={i} aria-checked={on} tabIndex={on || (slot === null && i === firstFree) ? 0 : -1} disabled={!free} className={`cl-slot${on ? " is-on" : ""}`} onClick={() => { setSlot(i); setBooking("idle"); }}>
                      {t}<small>{i < 5 ? " am" : " pm"}</small>
                    </button>
                  );
                })}
              </div>

              <div className="cl-widget-who">
                <span className="cl-mini-av" aria-hidden="true" />
                <p><strong>Dr. Amara Osei</strong><span>Family medicine · your primary clinician</span></p>
              </div>

              <button type="button" className={`cl-confirm is-${booking}`} onClick={book} disabled={slot === null} aria-describedby="cl-book-status">
                <span className="cl-confirm-label">{slot === null ? "No times left, try another day" : `Book ${DAYS[day].dow} ${slotLabel}`}</span>
                <span className="cl-confirm-spin" aria-hidden="true" />
                <svg className="cl-confirm-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              </button>
              <p id="cl-book-status" className="cl-book-status" aria-live="polite">
                {booking === "done"
                  ? `Booked: ${DAYS[day].label}, ${slotLabel}, ${mode === "clinic" ? "Capitol Hill" : "video"}. Confirmation sent by text.`
                  : "Free cancellation up to 2 hours before."}
              </p>
            </div>
          </div>
        </section>

        {/* INSURANCE MARQUEE */}
        <section className="cl-insurers" aria-labelledby="cl-ins-title">
          <h2 id="cl-ins-title" className="cl-ins-title">In network with the plans most Washingtonians and Oregonians carry</h2>
          <div className="cl-marquee">
            <div className="cl-marquee-track">
              {[0, 1].map((k) => (
                <ul key={k} className="cl-marquee-set" aria-hidden={k === 1}>
                  {INSURERS.map((n) => <li key={n.name}><InsurerMark name={n.name} glyph={n.glyph} /></li>)}
                </ul>
              ))}
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section id="cl-services" className="cl-services" aria-labelledby="cl-services-title">
          <div className="cl-wrap">
            <div className="cl-head" data-cl-rv>
              <p className="cl-eyebrow">What we care for</p>
              <h2 id="cl-services-title" className="cl-h2">Everything a good family doctor does, with the time to do it well.</h2>
            </div>
            <ul className="cl-bento">
              {SERVICES.map((s, i) => (
                <li key={s.t} className={`cl-card cl-svc${"wide" in s && s.wide ? " is-wide" : ""}`} data-cl-rv style={{ "--d": `${i * 60}ms` } as CSSProperties}>
                  <span className="cl-svc-ico"><Icon name={s.icon} /></span>
                  <h3 className="cl-h3">{s.t}</h3>
                  <p className="cl-body">{s.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CARE JOURNEY */}
        <section id="cl-how-it-works" className="cl-journey" aria-labelledby="cl-journey-title">
          <div className="cl-wrap">
            <div className="cl-head" data-cl-rv>
              <p className="cl-eyebrow">How it works</p>
              <h2 id="cl-journey-title" className="cl-h2">Four steps. One team the whole way.</h2>
            </div>
            <div className="cl-journey-grid">
              <div className="cl-stage-wrap">
                <div className="cl-stage" aria-hidden="true">
                  <div className="cl-stage-canvas">
                    {MORPH[step].map((p, i) => (
                      <span key={i} className={`cl-prim cl-prim-${i}`} style={{ transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rot ?? 0}deg)`, width: p.w, height: p.h, borderRadius: p.r, background: p.bg, opacity: p.o ?? 1 } as CSSProperties} />
                    ))}
                    <span className={`cl-stage-tag${step === 1 ? " is-on" : ""}`} style={{ transform: "translate(78px, 116px)" }}>● Live · 12:04</span>
                    <span className={`cl-stage-tag${step === 2 ? " is-on" : ""}`} style={{ transform: "translate(158px, 282px)" }}>A1c target: 6.8 by March</span>
                    <span className={`cl-stage-tag${step === 3 ? " is-on" : ""}`} style={{ transform: "translate(104px, 112px)" }}>Your labs are back 🙂</span>
                    <span className={`cl-stage-tag cl-stage-tag-light${step === 0 ? " is-on" : ""}`} style={{ transform: "translate(200px, 381px)" }}>Confirm 10:40</span>
                  </div>
                </div>
                <ol className="cl-stage-rail">
                  {STEPS.map((s, i) => <li key={s.k} className={i <= step ? "is-on" : ""}><span>{s.k}</span></li>)}
                </ol>
              </div>
              <ol className="cl-steps">
                {STEPS.map((s, i) => (
                  <li key={s.k} data-cl-step className={`cl-step${step === i ? " is-on" : ""}`}>
                    <p className="cl-step-n">0{i + 1} · {s.k}</p>
                    <h3 className="cl-h3 cl-step-t">{s.t}</h3>
                    <p className="cl-body">{s.d}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* VIRTUAL CARE */}
        <section className="cl-virtual" aria-labelledby="cl-virtual-title">
          <div className="cl-wrap cl-virtual-grid">
            <div data-cl-rv>
              <p className="cl-eyebrow">Virtual clinic</p>
              <h2 id="cl-virtual-title" className="cl-h2">A clinician in your pocket, 7am to 9pm.</h2>
              <p className="cl-body cl-virtual-lede">Message your care team about anything, a new rash, a refill, a lab result you don't understand. A licensed clinician replies within two hours, and can move you to a video visit with one tap.</p>
              <ul className="cl-ticks">
                <li><Icon name="check" /> Prescriptions sent to any pharmacy</li>
                <li><Icon name="check" /> Photos and lab results in one thread</li>
                <li><Icon name="check" /> Notes written in plain language</li>
              </ul>
            </div>
            <div className={`cl-phone${chatIn ? " is-in" : ""}`} role="img" aria-label="Clara app conversation: a member sends a photo of a rash, Dr. Lena Park replies and books a video visit for 4:40 pm.">
              <div className="cl-phone-screen">
                <div className="cl-phone-top">
                  <span className="cl-mini-av cl-mini-av-b" />
                  <p><strong>Dr. Lena Park</strong><span>Usually replies in 40 min</span></p>
                </div>
                <div className="cl-chat">
                  <p className="cl-msg cl-msg-me" style={{ "--d": "200ms" } as CSSProperties}>Hi! This rash on my forearm appeared yesterday and it's itchy. Should I worry?</p>
                  <div className="cl-msg cl-msg-me cl-msg-photo" style={{ "--d": "700ms" } as CSSProperties}><span /></div>
                  <p className="cl-typing" style={{ "--d": "1300ms" } as CSSProperties}><i /><i /><i /></p>
                  <p className="cl-msg cl-msg-dr" style={{ "--d": "2600ms" } as CSSProperties}>Thanks, Jordan, that looks like contact dermatitis, likely from the new detergent you mentioned. Nothing urgent.</p>
                  <p className="cl-msg cl-msg-dr" style={{ "--d": "3300ms" } as CSSProperties}>I'd like a quick look on video to be sure. I have 4:40 pm today?</p>
                  <p className="cl-chip-row" style={{ "--d": "3900ms" } as CSSProperties}><span className="cl-chip is-on">4:40 pm ✓</span><span className="cl-chip">Tomorrow</span></p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* OUTCOMES */}
        <section className="cl-outcomes" aria-labelledby="cl-outcomes-title">
          <div className="cl-wrap">
            <div className="cl-head cl-head-center" data-cl-rv>
              <p className="cl-eyebrow">Outcomes, measured</p>
              <h2 id="cl-outcomes-title" className="cl-h2">Care you can feel, and numbers we publish.</h2>
            </div>
            <dl className="cl-stats">
              {STATS.map((s, i) => (
                <div key={s.label} className="cl-stat">
                  <dt>{s.label}</dt>
                  <dd>
                    <span className="cl-stat-num">{counts[i].toFixed(s.dec)}</span>
                    <span className="cl-stat-suf">{s.suffix}</span>
                  </dd>
                  <span className="cl-stat-bar" style={{ "--k": String(counts[i] / s.v) } as CSSProperties} aria-hidden="true" />
                </div>
              ))}
            </dl>
            <p className="cl-footnote">Clara internal data, Jan–Sep 2026, across 41,200 members. ER comparison against matched non-member patients in the same ZIP codes.</p>
          </div>
        </section>

        {/* CLINICIANS */}
        <section id="cl-clinicians" className="cl-clinicians" aria-labelledby="cl-clin-title">
          <div className="cl-wrap">
            <div className="cl-head cl-head-row" data-cl-rv>
              <div>
                <p className="cl-eyebrow">Your care team</p>
                <h2 id="cl-clin-title" className="cl-h2">Clinicians who stay.</h2>
              </div>
              <p className="cl-body cl-head-aside">Our clinicians average seven years with Clara and see 12 patients a day, about half the national average.</p>
            </div>
            <ul className="cl-clin-grid">
              {CLINICIANS.map((c, i) => (
                <li key={c.name} className="cl-clin" data-cl-rv style={{ "--d": `${i * 80}ms` } as CSSProperties}>
                  <a href="#cl-book" className="cl-clin-link">
                    <div className="cl-clin-img"><img className="cl-portrait" src={c.img} alt={portraitAlt(c.name, c.role.toLowerCase(), c.img)} width={300} height={340} loading="lazy" decoding="async" /></div>
                    <div className="cl-clin-body">
                      <h3 className="cl-clin-name">{c.name}</h3>
                      <p className="cl-clin-role">{c.role}</p>
                      <p className="cl-clin-langs">Speaks {c.langs}</p>
                      <p className="cl-clin-next"><span className="cl-dot" aria-hidden="true" /> Next: {c.next}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* PRICING */}
        <section id="cl-pricing" className="cl-pricing" aria-labelledby="cl-pricing-title">
          <div className="cl-wrap">
            <div className="cl-head cl-head-center" data-cl-rv>
              <p className="cl-eyebrow">Membership</p>
              <h2 id="cl-pricing-title" className="cl-h2">Simple prices. No surprise bills.</h2>
              <div className="cl-seg cl-seg-lg" role="radiogroup" aria-label="Billing period">
                <button type="button" role="radio" aria-checked={!annual} className={!annual ? "is-on" : ""} onClick={() => setAnnual(false)}>Monthly</button>
                <button type="button" role="radio" aria-checked={annual} className={annual ? "is-on" : ""} onClick={() => setAnnual(true)}>Annual <em>save 12%</em></button>
                <span className="cl-seg-thumb" style={{ transform: `translateX(${annual ? 100 : 0}%)` }} aria-hidden="true" />
              </div>
            </div>
            <ul className="cl-plans" aria-live="polite">
              {PLANS.map((p, i) => {
                const price = annual ? p.annual : p.monthly;
                return (
                  <li key={p.name} className={`cl-plan${p.featured ? " is-featured" : ""}`} data-cl-rv style={{ "--d": `${i * 80}ms` } as CSSProperties}>
                    {p.featured && <span className="cl-plan-flag">Most popular</span>}
                    <h3 className="cl-plan-name">{p.name}</h3>
                    <p className="cl-plan-price">
                      <span className="cl-roll" key={`${p.name}-${annual}`}>{price === 0 ? "$129" : `$${price}`}</span>
                      <span className="cl-plan-per">{price === 0 ? "/ visit" : annual ? "/ year" : "/ month"}</span>
                    </p>
                    <p className="cl-plan-visit">{p.visit}</p>
                    <p className="cl-plan-note">{p.note}</p>
                    <ul className="cl-plan-feats">
                      {p.feats.map((f) => <li key={f}><Icon name="check" />{f}</li>)}
                    </ul>
                    <a href="#cl-book" className={`cl-btn ${p.featured ? "cl-btn-primary" : "cl-btn-soft"} cl-btn-block`}>{p.cta}</a>
                  </li>
                );
              })}
            </ul>
            <p className="cl-footnote cl-footnote-center">HSA/FSA eligible. Cancel any time from the app. Prices for Washington and Oregon residents, effective 1 January 2027.</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="cl-faq" className="cl-faq" aria-labelledby="cl-faq-title">
          <div className="cl-wrap cl-faq-grid">
            <div data-cl-rv>
              <p className="cl-eyebrow">Questions</p>
              <h2 id="cl-faq-title" className="cl-h2">Good to know.</h2>
              <p className="cl-body cl-faq-aside">Can't find an answer? Our member team picks up in under a minute: <a href="#cl-faq">(206) 555-0148</a>.</p>
            </div>
            <div className="cl-acc">
              {FAQ.map((f, i) => {
                const on = open === i;
                return (
                  <div key={f.q} className={`cl-acc-item${on ? " is-open" : ""}`}>
                    <h3 className="cl-acc-h">
                      <button type="button" id={`cl-faq-b${i}`} aria-expanded={on} aria-controls={`cl-faq-p${i}`} onClick={() => setOpen(on ? null : i)}>
                        {f.q}
                        <span className="cl-acc-ico" aria-hidden="true"><Icon name="plus" /></span>
                      </button>
                    </h3>
                    <div id={`cl-faq-p${i}`} role="region" aria-labelledby={`cl-faq-b${i}`} className="cl-acc-panel" aria-hidden={!on}>
                      <div><p>{f.a}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cl-cta" aria-labelledby="cl-cta-title">
          <div className="cl-wrap">
            <div className="cl-cta-card" data-cl-rv>
              <span className="cl-cta-orb" aria-hidden="true" />
              <h2 id="cl-cta-title" className="cl-h2 cl-cta-title">Your first visit could be this afternoon.</h2>
              <p className="cl-cta-sub">14 open times across Seattle and Portland today.</p>
              <a href="#cl-book" className="cl-btn cl-btn-light">Find a time <Icon name="arrow" /></a>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="cl-foot">
        <div className="cl-wrap">
          <p className="cl-emergency"><strong>In an emergency, call 911.</strong> Clara provides primary and urgent care, not emergency care.</p>
          <div className="cl-foot-grid">
            <div className="cl-foot-brand">
              <a href="#cl-top" className="cl-logo" aria-label="Clara Health, home"><span className="cl-logo-mark" aria-hidden="true"><i /><i /></span>clara</a>
              <p>Primary care with time for you. Six clinics, one virtual clinic, about 41,000 members.</p>
            </div>
            <div>
              <p className="cl-foot-h">Clinics</p>
              <ul>
                <li>Capitol Hill, Seattle</li>
                <li>Ballard, Seattle</li>
                <li>South Lake Union, Seattle</li>
                <li>Pearl District, Portland</li>
                <li>Alberta Arts, Portland</li>
                <li>Bellevue Downtown</li>
              </ul>
            </div>
            <div>
              <p className="cl-foot-h">Care</p>
              <ul>{["Primary care", "Urgent & sick visits", "Mental health", "Women's health", "Labs & vaccines"].map((x) => <li key={x}><a href="#cl-services">{x}</a></li>)}</ul>
            </div>
            <div>
              <p className="cl-foot-h">Company</p>
              <ul>{["About Clara", "Careers, we're hiring", "Clinician handbook", "Press", "Contact"].map((x) => <li key={x}><a href="#cl-top">{x}</a></li>)}</ul>
            </div>
            <div>
              <p className="cl-foot-h">Hours</p>
              <ul>
                <li>Clinics Mon–Fri 7am–8pm</li>
                <li>Sat–Sun 9am–5pm</li>
                <li>Messaging daily 7am–9pm</li>
                <li><a href="#cl-faq">(206) 555-0148</a></li>
              </ul>
            </div>
          </div>
          <div className="cl-foot-legal">
            <span>© 2026 Clara Health PC. Clinical services provided by Clara Medical Group, PLLC.</span>
            <span className="cl-foot-legal-links"><a href="#cl-top">Privacy</a><a href="#cl-top">HIPAA notice</a><a href="#cl-top">Accessibility</a><a href="#cl-top">Non-discrimination</a></span>
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
.cl {
  --cl-canvas: #F6F8F7;
  --cl-surface: #FFFFFF;
  --cl-tint: #EAF2EE;
  --cl-tint-2: #DCEBE4;
  --cl-sage: #9DBFAE;
  --cl-teal: #1F6F68;
  --cl-teal-ink: #17544F;
  --cl-ink: #0F2420;
  --cl-ink-2: #465A55;
  --cl-ink-3: #66776F;
  --cl-line: #DFE7E3;
  --cl-coral: #E26D5A;
  --cl-peach: #F3D3BC;
  --cl-font: ui-rounded, "SF Pro Rounded", ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  --cl-display: ui-rounded, "SF Pro Rounded", "SF Pro Display", ui-sans-serif, -apple-system, "Inter Display", "Inter", "Segoe UI", Roboto, sans-serif;
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms;
  --fd-dur-2: 240ms;
  --fd-dur-3: 420ms;
  --fd-dur-4: 700ms;
  --cl-r-card: 28px;
  --cl-r-inner: 18px;
  position: relative;
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow-x: clip;
  background: var(--cl-canvas);
  color: var(--cl-ink);
  font: 400 17px/1.6 var(--cl-font);
  letter-spacing: 0;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.cl *, .cl *::before, .cl *::after {
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
.cl :where(svg) { display: block; }
.cl :where(button) { cursor: pointer; text-align: inherit; line-height: inherit; }
.cl :where(button:disabled) { cursor: not-allowed; }
.cl :focus-visible { outline: 2px solid rgba(31, 111, 104, 0.7); outline-offset: 2px; border-radius: 12px; }
.cl [hidden] { display: none !important; }
.cl-skip { position: absolute; left: 16px; top: -60px; z-index: 100; padding: 12px 18px; border-radius: 9999px; background: var(--cl-ink); color: #FFFFFF; font: 600 15px/1 var(--cl-font); }
.cl-skip:focus { top: 12px; }
.cl-ico { width: 20px; height: 20px; flex: none; }
.cl-wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 32px; }

.cl-eyebrow { font: 600 13px/1.4 var(--cl-font); letter-spacing: 0.06em; text-transform: uppercase; color: var(--cl-teal); }
.cl-h1 { font: 600 clamp(44px, 5.6vw, 76px)/1.02 var(--cl-display); letter-spacing: -0.035em; color: var(--cl-ink); text-wrap: balance; }
.cl-h2 { font: 600 clamp(32px, 3.6vw, 48px)/1.08 var(--cl-display); letter-spacing: -0.028em; color: var(--cl-ink); text-wrap: balance; }
.cl-h3 { font: 600 20px/1.3 var(--cl-display); letter-spacing: -0.01em; color: var(--cl-ink); }
.cl-body { font: 400 17px/1.6 var(--cl-font); color: var(--cl-ink-2); }
.cl-head { max-width: 720px; margin-bottom: 56px; }
.cl-head .cl-h2 { margin-top: 12px; }
.cl-head-center { margin-left: auto; margin-right: auto; text-align: center; display: flex; flex-direction: column; align-items: center; }
.cl-head-row { max-width: none; display: flex; align-items: flex-end; justify-content: space-between; gap: 40px; }
.cl-head-aside { max-width: 380px; }
.cl-footnote { margin-top: 28px; font: 400 13px/1.5 var(--cl-font); color: var(--cl-ink-3); }
.cl-footnote-center { text-align: center; }
.cl-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #2E9B6A; box-shadow: 0 0 0 4px rgba(46, 155, 106, 0.18); flex: none; }

/* Buttons */
.cl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 52px; padding: 0 26px; border-radius: 9999px; font: 600 16px/1 var(--cl-font); white-space: nowrap; transition: background-color var(--fd-dur-2) var(--fd-ease-out), box-shadow var(--fd-dur-2) var(--fd-ease-out), transform var(--fd-dur-2) var(--fd-spring), color var(--fd-dur-2) var(--fd-ease-out); }
.cl-btn .cl-ico { width: 18px; height: 18px; transition: transform var(--fd-dur-2) var(--fd-ease-out); }
.cl-btn:hover .cl-ico { transform: translateX(3px); }
.cl-btn:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.cl-btn-sm { min-height: 44px; padding: 0 20px; font-size: 15px; }
.cl-btn-block { width: 100%; }
.cl-btn-primary { background: var(--cl-teal); color: #FFFFFF; box-shadow: 0 1px 0 rgba(255, 255, 255, 0.2) inset, 0 8px 20px -10px rgba(31, 111, 104, 0.7); }
.cl-btn-primary:hover { background: var(--cl-teal-ink); }
.cl-btn-ghost { background: rgba(255, 255, 255, 0.7); color: var(--cl-ink); box-shadow: inset 0 0 0 1.5px var(--cl-line); }
.cl-btn-ghost:hover { background: #FFFFFF; box-shadow: inset 0 0 0 1.5px var(--cl-sage); }
.cl-btn-soft { background: var(--cl-tint); color: var(--cl-teal-ink); }
.cl-btn-soft:hover { background: var(--cl-tint-2); }
.cl-btn-light { background: #FFFFFF; color: var(--cl-teal-ink); }
.cl-btn-light:hover { background: var(--cl-tint); }

/* NAV */
.cl-nav { position: sticky; top: 0; z-index: 60; height: 84px; margin-bottom: -84px; padding: 12px 20px 0; pointer-events: none; }
.cl-nav-in { pointer-events: auto; display: flex; align-items: center; justify-content: space-between; gap: 24px; max-width: 1200px; height: 60px; margin: 0 auto; padding: 0 12px 0 20px; border-radius: 9999px; transition: max-width var(--fd-dur-4) var(--fd-ease-out), background-color var(--fd-dur-3) var(--fd-ease-out), box-shadow var(--fd-dur-3) var(--fd-ease-out); }
.cl-nav.is-scrolled .cl-nav-in { max-width: 1000px; background: rgba(255, 255, 255, 0.82); -webkit-backdrop-filter: saturate(1.6) blur(20px); backdrop-filter: saturate(1.6) blur(20px); box-shadow: 0 0 0 1px rgba(15, 36, 32, 0.06), 0 12px 32px -16px rgba(15, 36, 32, 0.25); }
.cl-logo { display: inline-flex; align-items: center; gap: 10px; font: 700 24px/1 var(--cl-display); letter-spacing: -0.04em; color: var(--cl-ink); }
.cl-logo-mark { position: relative; width: 28px; height: 28px; }
.cl-logo-mark i { position: absolute; width: 18px; height: 18px; border-radius: 50%; }
.cl-logo-mark i:first-child { left: 0; top: 5px; background: var(--cl-sage); }
.cl-logo-mark i:last-child { right: 0; top: 5px; background: var(--cl-teal); mix-blend-mode: multiply; }
.cl-nav-links { display: flex; gap: 6px; }
.cl-nav-links a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 9999px; font: 500 15px/1 var(--cl-font); color: var(--cl-ink-2); transition: background-color var(--fd-dur-1) var(--fd-ease-out), color var(--fd-dur-1) var(--fd-ease-out); }
.cl-nav-links a:hover { background: rgba(15, 36, 32, 0.05); color: var(--cl-ink); }
.cl-nav-end { display: flex; align-items: center; gap: 6px; }
.cl-nav-sign { display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; font: 500 15px/1 var(--cl-font); color: var(--cl-ink); border-radius: 9999px; }
.cl-nav-sign:hover { background: rgba(15, 36, 32, 0.05); }
.cl-burger { display: none; position: relative; width: 44px; height: 44px; border-radius: 50%; }
.cl-burger span { position: absolute; left: 13px; right: 13px; height: 2px; border-radius: 2px; background: var(--cl-ink); transition: transform var(--fd-dur-3) var(--fd-ease-out); }
.cl-burger span:first-child { top: 18px; }
.cl-burger span:last-child { top: 25px; }
.cl-nav.is-open .cl-burger span:first-child { transform: translateY(3.5px) rotate(45deg); }
.cl-nav.is-open .cl-burger span:last-child { transform: translateY(-3.5px) rotate(-45deg); }
.cl-sheet { pointer-events: auto; max-width: 1000px; margin: 8px auto 0; padding: 10px; border-radius: 24px; background: #FFFFFF; box-shadow: 0 0 0 1px rgba(15, 36, 32, 0.06), 0 24px 48px -20px rgba(15, 36, 32, 0.3); animation: cl-pop var(--fd-dur-3) var(--fd-ease-out); }
.cl-sheet a { display: flex; align-items: center; min-height: 52px; padding: 0 16px; border-radius: 14px; font: 500 18px/1 var(--cl-font); color: var(--cl-ink); }
.cl-sheet a:hover { background: var(--cl-tint); }
@keyframes cl-pop { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: none; } }

/* HERO */
.cl-hero { position: relative; padding: 150px 0 110px; overflow: hidden; }
.cl-orb { position: absolute; left: 50%; top: 46%; width: 1100px; height: 1100px; margin: -550px 0 0 -550px; pointer-events: none; --mx: 0; --my: 0; transform: translate3d(calc(var(--mx) * 24px), calc(var(--my) * 18px), 0); }
.cl-orb span { position: absolute; inset: 0; border-radius: 50%; will-change: transform, opacity; }
.cl-orb-a { background: radial-gradient(closest-side, rgba(157, 191, 174, 0.75), rgba(157, 191, 174, 0.28) 55%, rgba(157, 191, 174, 0) 100%); animation: cl-breathe 9s var(--fd-ease-in-out) infinite; }
.cl-orb-b { inset: 18% 6% 8% 30% !important; background: radial-gradient(closest-side, rgba(243, 211, 188, 0.85), rgba(243, 211, 188, 0) 100%); animation: cl-breathe-b 9s var(--fd-ease-in-out) infinite; }
.cl-orb-c { inset: 8% 34% 30% 4% !important; background: radial-gradient(closest-side, rgba(146, 205, 196, 0.7), rgba(146, 205, 196, 0) 100%); animation: cl-breathe-c 9s var(--fd-ease-in-out) infinite; }
@keyframes cl-breathe { 0%, 100% { transform: scale(0.9); opacity: 0.75; } 45% { transform: scale(1.06); opacity: 1; } }
@keyframes cl-breathe-b { 0%, 100% { transform: translate(-4%, 3%) scale(0.92); } 45% { transform: translate(3%, -2%) scale(1.08); } }
@keyframes cl-breathe-c { 0%, 100% { transform: translate(3%, -2%) scale(1.04); } 45% { transform: translate(-3%, 4%) scale(0.9); } }
.cl-hero-grid { position: relative; display: grid; grid-template-columns: 1.08fr 0.92fr; gap: 64px; align-items: center; }
.cl-badge { display: inline-flex; align-items: center; gap: 10px; min-height: 36px; padding: 0 16px 0 14px; border-radius: 9999px; background: rgba(255, 255, 255, 0.75); box-shadow: inset 0 0 0 1px rgba(15, 36, 32, 0.07); font: 500 14px/1.3 var(--cl-font); color: var(--cl-ink-2); }
.cl-hero-copy .cl-h1 { margin-top: 24px; max-width: 12ch; }
.cl-lede { margin-top: 24px; max-width: 520px; font: 400 20px/1.55 var(--cl-font); color: var(--cl-ink-2); }
.cl-hero-ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 36px; }
.cl-hero-proof { display: flex; flex-wrap: wrap; gap: 10px 28px; margin-top: 40px; font: 400 15px/1.4 var(--cl-font); color: var(--cl-ink-2); }
.cl-hero-proof strong { font-weight: 700; color: var(--cl-ink); }
.cl-hero-copy > * { animation: cl-up var(--fd-dur-4) var(--fd-ease-out) both; }
.cl-hero-copy > *:nth-child(2) { animation-delay: 80ms; }
.cl-hero-copy > *:nth-child(3) { animation-delay: 160ms; }
.cl-hero-copy > *:nth-child(4) { animation-delay: 240ms; }
.cl-hero-copy > *:nth-child(5) { animation-delay: 320ms; }
.cl-widget { animation: cl-up 900ms var(--fd-ease-out) 200ms both; }
@keyframes cl-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }

/* Booking widget */
.cl-widget { position: relative; padding: 28px; border-radius: 32px; background: rgba(255, 255, 255, 0.86); -webkit-backdrop-filter: saturate(1.4) blur(24px); backdrop-filter: saturate(1.4) blur(24px); box-shadow: 0 0 0 1px rgba(15, 36, 32, 0.06), 0 40px 80px -40px rgba(15, 36, 32, 0.35), 0 2px 6px rgba(15, 36, 32, 0.04); }
.cl-widget-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.cl-widget-title { font: 600 24px/1.2 var(--cl-display); letter-spacing: -0.02em; color: var(--cl-ink); }
.cl-widget-where { margin-top: 8px; font: 400 15px/1.4 var(--cl-font); color: var(--cl-ink-2); min-height: 21px; }
.cl-seg { position: relative; display: inline-grid; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 9999px; background: var(--cl-tint); }
.cl-seg button { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; padding: 0 14px; border-radius: 9999px; font: 600 14px/1 var(--cl-font); color: var(--cl-ink-2); white-space: nowrap; transition: color var(--fd-dur-2) var(--fd-ease-out); }
.cl-seg button .cl-ico { width: 16px; height: 16px; }
.cl-seg button.is-on { color: var(--cl-teal-ink); }
.cl-seg button em { font-style: normal; margin-left: 6px; padding: 3px 8px; border-radius: 9999px; background: #FFF1E8; color: #A3412F; font: 600 12px/1 var(--cl-font); }
.cl-seg-thumb { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px); border-radius: 9999px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(15, 36, 32, 0.08), 0 6px 14px -6px rgba(15, 36, 32, 0.2); transition: transform var(--fd-dur-3) var(--fd-spring); }
.cl-seg-lg { margin-top: 32px; }
.cl-seg-lg button { min-height: 48px; padding: 0 22px; font-size: 16px; }
.cl-days { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 22px; }
.cl-days button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 64px; border-radius: 18px; background: var(--cl-canvas); box-shadow: inset 0 0 0 1px var(--cl-line); color: var(--cl-ink); transition: background-color var(--fd-dur-2) var(--fd-ease-out), box-shadow var(--fd-dur-2) var(--fd-ease-out), color var(--fd-dur-2) var(--fd-ease-out), transform var(--fd-dur-2) var(--fd-spring); }
.cl-days button small { font: 500 12px/1 var(--cl-font); letter-spacing: 0.04em; text-transform: uppercase; color: var(--cl-ink-3); transition: color var(--fd-dur-2) var(--fd-ease-out); }
.cl-days button span { font: 600 20px/1 var(--cl-display); }
.cl-days button:hover { box-shadow: inset 0 0 0 1.5px var(--cl-sage); }
.cl-days button:active { transform: scale(0.96); }
.cl-days button.is-on { background: var(--cl-ink); color: #FFFFFF; box-shadow: none; }
.cl-days button.is-on small { color: rgba(255, 255, 255, 0.75); }
.cl-slots { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 14px; }
.cl-slot-pill { position: absolute; left: 0; top: 0; z-index: 0; border-radius: 9999px; background: var(--cl-teal); box-shadow: 0 8px 18px -8px rgba(31, 111, 104, 0.8); opacity: 0; transition: transform 520ms var(--fd-spring), width var(--fd-dur-3) var(--fd-ease-out), height var(--fd-dur-3) var(--fd-ease-out), opacity var(--fd-dur-2) var(--fd-ease-out); }
.cl-slot-pill.is-on { opacity: 1; }
.cl-slot { position: relative; z-index: 1; min-height: 48px; border-radius: 9999px; box-shadow: inset 0 0 0 1px var(--cl-line); background: transparent; font: 600 16px/1 var(--cl-font); color: var(--cl-ink); text-align: center; font-variant-numeric: tabular-nums; transition: color var(--fd-dur-2) var(--fd-ease-out), box-shadow var(--fd-dur-2) var(--fd-ease-out), background-color var(--fd-dur-2) var(--fd-ease-out); }
.cl-slot small { font: 500 13px/1 var(--cl-font); color: var(--cl-ink-3); transition: color var(--fd-dur-2) var(--fd-ease-out); }
.cl-slot:hover:not(:disabled):not(.is-on) { background: var(--cl-tint); box-shadow: inset 0 0 0 1px var(--cl-sage); }
.cl-slot.is-on { color: #FFFFFF; box-shadow: none; }
.cl-slot.is-on small { color: rgba(255, 255, 255, 0.82); }
.cl-slot:disabled { color: #8C9A95; background: repeating-linear-gradient(-45deg, transparent 0 6px, rgba(15, 36, 32, 0.035) 6px 7px); text-decoration: line-through; text-decoration-color: rgba(15, 36, 32, 0.3); }
.cl-slot:disabled small { color: #8C9A95; }
.cl-widget-who { display: flex; align-items: center; gap: 12px; margin-top: 20px; padding: 12px; border-radius: 18px; background: var(--cl-canvas); }
.cl-widget-who p { display: flex; flex-direction: column; gap: 2px; font: 400 14px/1.3 var(--cl-font); color: var(--cl-ink-2); }
.cl-widget-who strong { font: 600 15px/1.3 var(--cl-font); color: var(--cl-ink); }
.cl-mini-av { width: 40px; height: 40px; flex: none; border-radius: 50%; background: radial-gradient(circle at 50% 38%, #8B5A3C 0 26%, transparent 27%), radial-gradient(circle at 50% 118%, #FFFFFF 0 46%, transparent 47%), linear-gradient(135deg, #DCEBE4, #BFD8CB); box-shadow: inset 0 0 0 1px rgba(15, 36, 32, 0.06); }
.cl-mini-av-b { background: radial-gradient(circle at 50% 38%, #E8C2A0 0 26%, transparent 27%), radial-gradient(circle at 50% 118%, #2C6E67 0 46%, transparent 47%), linear-gradient(135deg, #E6EEF5, #C9D9E8); }
.cl-confirm { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; min-height: 56px; margin-top: 16px; border-radius: 9999px; background: var(--cl-ink); color: #FFFFFF; font: 600 17px/1 var(--cl-font); overflow: hidden; transition: background-color var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-2) var(--fd-spring); }
.cl-confirm:hover:not(:disabled) { background: #1E3A35; }
.cl-confirm:active:not(:disabled) { transform: scale(0.97); }
.cl-confirm:disabled { background: #C9D3CF; color: #3D4F4A; }
.cl-confirm-label { transition: opacity var(--fd-dur-2) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-ease-out); }
.cl-confirm-spin { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; border: 2.5px solid rgba(255, 255, 255, 0.3); border-top-color: #FFFFFF; opacity: 0; transition: opacity var(--fd-dur-2) var(--fd-ease-out); }
.cl-confirm-check { position: absolute; left: 50%; top: 50%; width: 28px; height: 28px; margin: -14px 0 0 -14px; fill: none; stroke: #FFFFFF; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 24; stroke-dashoffset: 24; }
.cl-confirm.is-busy .cl-confirm-label, .cl-confirm.is-done .cl-confirm-label { opacity: 0; transform: translateY(-10px); }
.cl-confirm.is-busy .cl-confirm-spin { opacity: 1; animation: cl-spin 700ms linear infinite; }
.cl-confirm.is-done { background: #2E8A5F; }
.cl-confirm.is-done .cl-confirm-check { stroke-dashoffset: 0; transition: stroke-dashoffset 520ms var(--fd-ease-out) 80ms; }
@keyframes cl-spin { to { transform: rotate(360deg); } }
.cl-book-status { margin-top: 12px; min-height: 42px; font: 400 14px/1.5 var(--cl-font); color: var(--cl-ink-2); text-align: center; }

/* INSURERS */
.cl-insurers { padding: 24px 0 96px; }
.cl-ins-title { margin: 0 auto 28px; padding: 0 24px; max-width: 760px; font: 500 15px/1.5 var(--cl-font); color: var(--cl-ink-2); text-align: center; }
.cl-marquee { position: relative; overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
.cl-marquee-track { display: flex; width: max-content; animation: cl-marquee 42s linear infinite; }
.cl-marquee:hover .cl-marquee-track { animation-play-state: paused; }
.cl-marquee-set { display: flex; gap: 56px; padding-right: 56px; }
.cl-ins { display: inline-flex; align-items: center; gap: 10px; min-height: 48px; font: 600 19px/1 var(--cl-display); letter-spacing: -0.015em; color: #52645E; white-space: nowrap; }
.cl-ins svg { width: 26px; height: 26px; color: var(--cl-teal); opacity: 0.85; }
@keyframes cl-marquee { to { transform: translateX(-50%); } }

/* SERVICES */
.cl-services { padding: 40px 0 140px; }
.cl-bento { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.cl-card { position: relative; padding: 28px; border-radius: var(--cl-r-card); background: var(--cl-surface); box-shadow: 0 0 0 1px rgba(15, 36, 32, 0.05), 0 1px 2px rgba(15, 36, 32, 0.04); }
.cl-svc { display: flex; flex-direction: column; gap: 10px; min-height: 240px; transition: transform var(--fd-dur-3) var(--fd-ease-out), box-shadow var(--fd-dur-3) var(--fd-ease-out); }
.cl-svc.is-wide { grid-column: span 2; }
.cl-svc:hover { transform: translateY(-4px); box-shadow: 0 0 0 1px rgba(15, 36, 32, 0.05), 0 24px 40px -24px rgba(15, 36, 32, 0.28); }
.cl-svc-ico { display: grid; place-items: center; width: 52px; height: 52px; margin-bottom: auto; border-radius: 16px; background: var(--cl-tint); color: var(--cl-teal); }
.cl-svc-ico .cl-ico { width: 26px; height: 26px; }
.cl-svc .cl-h3 { margin-top: 28px; }
.cl-svc .cl-body { font-size: 16px; }
.cl-svc.is-wide:first-child { background: linear-gradient(135deg, #FFFFFF 0%, #EAF2EE 100%); }

/* REVEALS */
.cl-js [data-cl-rv] { opacity: 0; transform: translateY(22px); transition: opacity var(--fd-dur-4) var(--fd-ease-out), transform var(--fd-dur-4) var(--fd-ease-out), box-shadow var(--fd-dur-3) var(--fd-ease-out); transition-delay: var(--d, 0ms); }
.cl-js [data-cl-rv].is-in { opacity: 1; transform: none; }
.cl-js .cl-svc[data-cl-rv].is-in:hover, .cl-js .cl-clin[data-cl-rv].is-in:hover { transition-delay: 0ms; }
.cl-js .cl-svc[data-cl-rv].is-in:hover { transform: translateY(-4px); }

/* JOURNEY */
.cl-journey { padding: 130px 0 120px; background: var(--cl-surface); border-radius: 48px 48px 0 0; }
.cl-journey-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; }
.cl-stage-wrap { position: sticky; top: 110px; align-self: start; }
.cl-stage { position: relative; aspect-ratio: 1; border-radius: 40px; background: radial-gradient(circle at 30% 20%, #F3F8F5, #DCEBE4 70%); overflow: hidden; box-shadow: inset 0 0 0 1px rgba(15, 36, 32, 0.05); }
.cl-stage-canvas { position: absolute; left: 50%; top: 50%; width: 520px; height: 480px; margin: -240px 0 0 -260px; transform: scale(var(--cl-stage-s, 1)); contain: layout paint; }
.cl-prim { position: absolute; left: 0; top: 0; box-shadow: 0 1px 2px rgba(15, 36, 32, 0.06); transition: transform 760ms var(--fd-spring), width 620ms var(--fd-ease-out), height 620ms var(--fd-ease-out), border-radius 620ms var(--fd-ease-out), background-color 620ms var(--fd-ease-in-out), opacity var(--fd-dur-3) var(--fd-ease-out); }
.cl-prim-0 { box-shadow: 0 30px 60px -30px rgba(15, 36, 32, 0.35), 0 0 0 1px rgba(15, 36, 32, 0.05); }
.cl-prim-1 { transition-delay: 30ms; }
.cl-prim-2 { transition-delay: 60ms; }
.cl-prim-3 { transition-delay: 90ms; }
.cl-prim-4 { transition-delay: 120ms; }
.cl-prim-5 { transition-delay: 150ms; }
.cl-prim-6 { transition-delay: 180ms; }
.cl-stage-tag { position: absolute; left: 0; top: 0; padding: 7px 12px; border-radius: 9999px; background: #FFFFFF; box-shadow: 0 6px 16px -8px rgba(15, 36, 32, 0.4); font: 600 13px/1 var(--cl-font); color: var(--cl-ink); white-space: nowrap; opacity: 0; scale: 0.9; transition: opacity var(--fd-dur-3) var(--fd-ease-out), scale var(--fd-dur-3) var(--fd-spring); }
.cl-stage-tag-light { background: transparent; box-shadow: none; color: #FFFFFF; }
.cl-stage-tag.is-on { opacity: 1; scale: 1; transition-delay: 420ms; }
.cl-stage-rail { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 20px; }
.cl-stage-rail li { position: relative; padding-top: 14px; font: 600 13px/1.2 var(--cl-font); color: var(--cl-ink-3); transition: color var(--fd-dur-3) var(--fd-ease-out); }
.cl-stage-rail li::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 4px; border-radius: 4px; background: var(--cl-line); }
.cl-stage-rail li::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 4px; border-radius: 4px; background: var(--cl-teal); transform: scaleX(0); transform-origin: left; transition: transform var(--fd-dur-4) var(--fd-ease-out); }
.cl-stage-rail li.is-on { color: var(--cl-teal-ink); }
.cl-stage-rail li.is-on::after { transform: scaleX(1); }
.cl-steps { padding: 6vh 0 18vh; }
.cl-step { display: flex; flex-direction: column; justify-content: center; min-height: 64vh; padding: 0 0 0 28px; border-left: 2px solid var(--cl-line); opacity: 0.38; transition: opacity var(--fd-dur-4) var(--fd-ease-out), border-color var(--fd-dur-4) var(--fd-ease-out); }
.cl-step.is-on { opacity: 1; border-left-color: var(--cl-teal); }
.cl-step-n { font: 600 14px/1 var(--cl-font); letter-spacing: 0.04em; text-transform: uppercase; color: var(--cl-teal); }
.cl-step-t { margin: 14px 0 14px; font-size: 32px; line-height: 1.15; letter-spacing: -0.025em; }
.cl-step .cl-body { max-width: 460px; font-size: 18px; }

/* VIRTUAL */
.cl-virtual { padding: 120px 0; background: var(--cl-surface); }
.cl-virtual-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
.cl-virtual .cl-h2 { margin-top: 12px; }
.cl-virtual-lede { margin-top: 22px; max-width: 480px; }
.cl-ticks { display: grid; gap: 12px; margin-top: 28px; }
.cl-ticks li { display: flex; align-items: center; gap: 12px; font: 500 17px/1.4 var(--cl-font); color: var(--cl-ink); }
.cl-ticks .cl-ico { width: 26px; height: 26px; padding: 4px; border-radius: 50%; background: var(--cl-tint); color: var(--cl-teal); }
.cl-phone { justify-self: center; width: 360px; padding: 12px; border-radius: 52px; background: #0F2420; box-shadow: 0 50px 100px -40px rgba(15, 36, 32, 0.55), inset 0 0 0 2px #2A3D39; }
.cl-phone-screen { height: 600px; border-radius: 42px; background: linear-gradient(180deg, #F6F8F7, #EEF4F1); overflow: hidden; }
.cl-phone-top { display: flex; align-items: center; gap: 12px; padding: 44px 20px 14px; background: rgba(255, 255, 255, 0.9); box-shadow: 0 1px 0 var(--cl-line); }
.cl-phone-top p { display: flex; flex-direction: column; gap: 2px; font: 400 13px/1.3 var(--cl-font); color: var(--cl-ink-2); }
.cl-phone-top strong { font: 600 15px/1.3 var(--cl-font); color: var(--cl-ink); }
.cl-chat { display: flex; flex-direction: column; gap: 10px; padding: 18px 16px; }
.cl-msg { max-width: 82%; padding: 11px 15px; border-radius: 20px; font: 400 15px/1.42 var(--cl-font); }
.cl-msg-me { align-self: flex-end; background: var(--cl-teal); color: #FFFFFF; border-bottom-right-radius: 6px; }
.cl-msg-dr { align-self: flex-start; background: #FFFFFF; color: var(--cl-ink); border-bottom-left-radius: 6px; box-shadow: 0 1px 2px rgba(15, 36, 32, 0.06); }
.cl-msg-photo { width: 150px; height: 104px; padding: 5px; }
.cl-msg-photo span { display: block; width: 100%; height: 100%; border-radius: 15px; background: radial-gradient(ellipse 30% 22% at 46% 52%, rgba(214, 104, 98, 0.75), transparent), radial-gradient(ellipse 18% 14% at 62% 40%, rgba(214, 104, 98, 0.55), transparent), linear-gradient(160deg, #E9C3A6, #D9A985); }
.cl-typing { align-self: flex-start; display: flex; gap: 4px; padding: 14px 16px; border-radius: 20px; background: #FFFFFF; }
.cl-typing i { width: 7px; height: 7px; border-radius: 50%; background: #9AA7A3; animation: cl-dots 1.2s var(--fd-ease-in-out) infinite; }
.cl-typing i:nth-child(2) { animation-delay: 150ms; }
.cl-typing i:nth-child(3) { animation-delay: 300ms; }
@keyframes cl-dots { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }
.cl-chip-row { display: flex; gap: 8px; }
.cl-chip { display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; border-radius: 9999px; background: #FFFFFF; box-shadow: inset 0 0 0 1px var(--cl-line); font: 600 14px/1 var(--cl-font); color: var(--cl-ink); }
.cl-chip.is-on { background: var(--cl-ink); color: #FFFFFF; box-shadow: none; }
.cl-js .cl-chat > * { opacity: 0; transform: translateY(10px) scale(0.97); }
.cl-js .cl-phone.is-in .cl-chat > * { animation: cl-msg 520ms var(--fd-spring) var(--d) forwards; }
.cl-js .cl-phone.is-in .cl-typing { animation: cl-typing 1300ms var(--fd-ease-out) var(--d) forwards; }
@keyframes cl-msg { to { opacity: 1; transform: none; } }
@keyframes cl-typing { 0% { opacity: 0; transform: translateY(10px); max-height: 60px; } 15%, 80% { opacity: 1; transform: none; max-height: 60px; } 100% { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; margin-top: -10px; } }

/* OUTCOMES */
.cl-outcomes { padding: 130px 0; }
.cl-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.cl-stat { position: relative; display: flex; flex-direction: column-reverse; justify-content: flex-end; gap: 14px; padding: 28px; border-radius: var(--cl-r-card); background: var(--cl-surface); box-shadow: 0 0 0 1px rgba(15, 36, 32, 0.05); overflow: hidden; }
.cl-stat dt { font: 400 15px/1.45 var(--cl-font); color: var(--cl-ink-2); }
.cl-stat dd { display: flex; align-items: baseline; font: 600 64px/1 var(--cl-display); letter-spacing: -0.045em; color: var(--cl-ink); font-variant-numeric: tabular-nums; }
.cl-stat-suf { font-size: 32px; letter-spacing: -0.02em; color: var(--cl-teal); margin-left: 2px; }
.cl-stat-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: var(--cl-teal); transform: scaleX(var(--k)); transform-origin: left; }

/* CLINICIANS */
.cl-clinicians { padding: 40px 0 130px; }
.cl-clin-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.cl-clin-link { display: block; height: 100%; padding: 10px; border-radius: var(--cl-r-card); background: var(--cl-surface); box-shadow: 0 0 0 1px rgba(15, 36, 32, 0.05); transition: transform var(--fd-dur-3) var(--fd-ease-out), box-shadow var(--fd-dur-3) var(--fd-ease-out); }
.cl-clin-link:hover, .cl-clin-link:focus-visible { transform: translateY(-6px); box-shadow: 0 0 0 1px rgba(15, 36, 32, 0.05), 0 28px 44px -26px rgba(15, 36, 32, 0.35); }
.cl-clin-img { aspect-ratio: 300 / 340; border-radius: var(--cl-r-inner); overflow: hidden; }
.cl-portrait { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center top; transition: transform var(--fd-dur-4) var(--fd-ease-out); }
.cl-clin-link:hover .cl-portrait { transform: scale(1.04); }
.cl-clin-body { padding: 16px 10px 10px; }
.cl-clin-name { font: 600 19px/1.3 var(--cl-display); letter-spacing: -0.01em; color: var(--cl-ink); }
.cl-clin-role { margin-top: 2px; font: 500 15px/1.4 var(--cl-font); color: var(--cl-teal-ink); }
.cl-clin-langs { margin-top: 10px; font: 400 14px/1.4 var(--cl-font); color: var(--cl-ink-2); }
.cl-clin-next { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--cl-line); font: 500 14px/1.3 var(--cl-font); color: var(--cl-ink); }

/* PRICING */
.cl-pricing { padding: 130px 0; background: linear-gradient(180deg, var(--cl-canvas), #EDF4F0); }
.cl-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-items: stretch; }
.cl-plan { position: relative; display: flex; flex-direction: column; padding: 32px; border-radius: 32px; background: var(--cl-surface); box-shadow: 0 0 0 1px rgba(15, 36, 32, 0.06); }
.cl-plan.is-featured { background: var(--cl-ink); color: #FFFFFF; box-shadow: 0 40px 80px -40px rgba(15, 36, 32, 0.6); }
.cl-plan-flag { position: absolute; top: 28px; right: 28px; padding: 6px 12px; border-radius: 9999px; background: var(--cl-sage); color: var(--cl-ink); font: 600 13px/1 var(--cl-font); }
.cl-plan-name { font: 600 20px/1.3 var(--cl-display); color: inherit; }
.cl-plan-price { display: flex; align-items: baseline; gap: 8px; height: 72px; margin-top: 18px; overflow: hidden; }
.cl-roll { display: inline-block; font: 600 64px/72px var(--cl-display); letter-spacing: -0.045em; animation: cl-roll var(--fd-dur-4) var(--fd-spring); font-variant-numeric: tabular-nums; }
@keyframes cl-roll { from { transform: translateY(70%); opacity: 0; } to { transform: none; opacity: 1; } }
.cl-plan-per { font: 500 16px/1 var(--cl-font); color: var(--cl-ink-2); }
.cl-plan.is-featured .cl-plan-per { color: rgba(255, 255, 255, 0.75); }
.cl-plan-visit { margin-top: 4px; font: 600 16px/1.4 var(--cl-font); color: var(--cl-teal-ink); }
.cl-plan.is-featured .cl-plan-visit { color: #A9D7C3; }
.cl-plan-note { margin-top: 6px; font: 400 15px/1.5 var(--cl-font); color: var(--cl-ink-2); }
.cl-plan.is-featured .cl-plan-note { color: rgba(255, 255, 255, 0.78); }
.cl-plan-feats { display: grid; gap: 12px; margin: 26px 0 30px; padding-top: 24px; border-top: 1px solid var(--cl-line); flex: 1; }
.cl-plan.is-featured .cl-plan-feats { border-top-color: rgba(255, 255, 255, 0.14); }
.cl-plan-feats li { display: flex; gap: 10px; font: 400 16px/1.4 var(--cl-font); }
.cl-plan-feats .cl-ico { width: 20px; height: 20px; color: var(--cl-teal); }
.cl-plan.is-featured .cl-plan-feats .cl-ico { color: #A9D7C3; }

/* FAQ */
.cl-faq { padding: 130px 0; background: var(--cl-surface); }
.cl-faq-grid { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 80px; align-items: start; }
.cl-faq .cl-h2 { margin-top: 12px; }
.cl-faq-aside { margin-top: 18px; max-width: 340px; }
.cl-faq-aside a { color: var(--cl-teal-ink); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.cl-acc { border-top: 1px solid var(--cl-line); }
.cl-acc-item { border-bottom: 1px solid var(--cl-line); }
.cl-acc-h button { display: flex; align-items: center; justify-content: space-between; gap: 24px; width: 100%; min-height: 76px; padding: 18px 4px; font: 600 19px/1.35 var(--cl-display); letter-spacing: -0.01em; color: var(--cl-ink); }
.cl-acc-h button:hover { color: var(--cl-teal-ink); }
.cl-acc-ico { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: 50%; background: var(--cl-tint); color: var(--cl-teal); transition: transform var(--fd-dur-3) var(--fd-spring), background-color var(--fd-dur-2) var(--fd-ease-out), color var(--fd-dur-2) var(--fd-ease-out); }
.cl-acc-item.is-open .cl-acc-ico { transform: rotate(45deg); background: var(--cl-teal); color: #FFFFFF; }
.cl-acc-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--fd-dur-3) var(--fd-ease-out); }
.cl-acc-panel > div { overflow: hidden; }
.cl-acc-panel p { padding: 0 64px 26px 4px; font: 400 17px/1.65 var(--cl-font); color: var(--cl-ink-2); opacity: 0; transform: translateY(-6px); transition: opacity var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-ease-out); }
.cl-acc-item.is-open .cl-acc-panel { grid-template-rows: 1fr; }
.cl-acc-item.is-open .cl-acc-panel p { opacity: 1; transform: none; }

/* CTA */
.cl-cta { padding: 0 0 110px; background: var(--cl-surface); }
.cl-cta-card { position: relative; display: flex; flex-direction: column; align-items: center; padding: 96px 32px; border-radius: 40px; background: var(--cl-teal); text-align: center; overflow: hidden; }
.cl-cta-orb { position: absolute; left: 50%; top: 50%; width: 900px; height: 900px; margin: -450px 0 0 -450px; border-radius: 50%; background: radial-gradient(closest-side, rgba(169, 215, 195, 0.55), rgba(169, 215, 195, 0)); animation: cl-breathe 9s var(--fd-ease-in-out) infinite; pointer-events: none; }
.cl-cta-title { position: relative; color: #FFFFFF; max-width: 680px; }
.cl-cta-sub { position: relative; margin: 16px 0 32px; font: 400 18px/1.5 var(--cl-font); color: rgba(255, 255, 255, 0.88); }
.cl-cta .cl-btn { position: relative; }

/* FOOTER */
.cl-foot { padding: 64px 0 40px; background: var(--cl-ink); color: rgba(255, 255, 255, 0.82); }
.cl-emergency { padding: 18px 22px; border-radius: 18px; background: rgba(255, 255, 255, 0.06); font: 400 15px/1.5 var(--cl-font); color: rgba(255, 255, 255, 0.85); }
.cl-emergency strong { color: #FFFFFF; font-weight: 600; }
.cl-foot-grid { display: grid; grid-template-columns: 1.4fr repeat(4, 1fr); gap: 40px; padding: 56px 0; }
.cl-foot .cl-logo { color: #FFFFFF; }
.cl-foot .cl-logo-mark i:last-child { mix-blend-mode: normal; opacity: 0.9; }
.cl-foot-brand p { margin-top: 18px; max-width: 280px; font: 400 15px/1.6 var(--cl-font); color: rgba(255, 255, 255, 0.7); }
.cl-foot-h { margin-bottom: 16px; font: 600 13px/1 var(--cl-font); letter-spacing: 0.06em; text-transform: uppercase; color: #A9D7C3; }
.cl-foot-grid li { margin-bottom: 10px; font: 400 15px/1.45 var(--cl-font); color: rgba(255, 255, 255, 0.8); }
.cl-foot-grid a { color: rgba(255, 255, 255, 0.85); transition: color var(--fd-dur-1) var(--fd-ease-out); }
.cl-foot-grid a:hover { color: #FFFFFF; text-decoration: underline; text-underline-offset: 3px; }
.cl-foot-legal { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; padding-top: 28px; border-top: 1px solid rgba(255, 255, 255, 0.12); font: 400 13px/1.5 var(--cl-font); color: rgba(255, 255, 255, 0.68); }
.cl-foot-legal-links { display: flex; flex-wrap: wrap; gap: 20px; }
.cl-foot-legal a { color: rgba(255, 255, 255, 0.8); }
.cl-foot-legal a:hover { color: #FFFFFF; }

/* RESPONSIVE */
@media (max-width: 1080px) {
  .cl-nav-links { display: none; }
  .cl-burger { display: block; }
  .cl-hero-grid { grid-template-columns: 1fr; gap: 48px; }
  .cl-hero-copy .cl-h1 { max-width: 14ch; }
  .cl-widget { max-width: 560px; }
  .cl-bento { grid-template-columns: repeat(2, 1fr); }
  .cl-stats, .cl-clin-grid { grid-template-columns: repeat(2, 1fr); }
  .cl-foot-grid { grid-template-columns: repeat(3, 1fr); }
  .cl-foot-brand { grid-column: 1 / -1; }
  .cl-journey-grid { gap: 48px; }
  .cl-stage-canvas { --cl-stage-s: 0.82; }
}
@media (max-width: 860px) {
  .cl-wrap { padding: 0 20px; }
  .cl-nav { padding: 10px 12px 0; }
  .cl-nav-sign { display: none; }
  .cl-hero { padding: 120px 0 72px; }
  .cl-orb { top: 30%; width: 760px; height: 760px; margin: -380px 0 0 -380px; }
  .cl-lede { font-size: 18px; }
  .cl-widget { padding: 20px; border-radius: 28px; }
  .cl-widget-head { flex-direction: column; align-items: flex-start; gap: 12px; }
  .cl-widget-head .cl-seg { width: 100%; }
  .cl-head-row { flex-direction: column; align-items: flex-start; gap: 16px; }
  .cl-services, .cl-clinicians { padding-bottom: 96px; }
  .cl-svc { min-height: 0; }
  .cl-svc .cl-h3 { margin-top: 20px; }
  .cl-journey { padding: 96px 0 72px; border-radius: 32px 32px 0 0; }
  .cl-journey-grid { grid-template-columns: 1fr; gap: 0; }
  .cl-stage-wrap { top: 76px; z-index: 2; margin: 0 -20px; padding: 0 20px 16px; background: linear-gradient(180deg, #FFFFFF 85%, rgba(255, 255, 255, 0)); }
  .cl-stage { aspect-ratio: auto; height: 280px; border-radius: 28px; }
  .cl-stage-canvas { --cl-stage-s: 0.54; }
  .cl-stage-rail { margin-top: 12px; }
  .cl-steps { padding: 0 0 8vh; }
  .cl-step { min-height: 52vh; justify-content: flex-start; padding-top: 24px; }
  .cl-step-t { font-size: 26px; }
  .cl-step .cl-body { font-size: 17px; }
  .cl-virtual, .cl-outcomes, .cl-pricing, .cl-faq { padding: 96px 0; }
  .cl-virtual-grid, .cl-faq-grid { grid-template-columns: 1fr; gap: 56px; }
  .cl-plans { grid-template-columns: 1fr; }
  .cl-cta-card { padding: 72px 24px; border-radius: 32px; }
}
@media (max-width: 560px) {
  .cl-h1 { font-size: 44px; }
  .cl-bento, .cl-stats { grid-template-columns: 1fr; }
  .cl-svc.is-wide { grid-column: auto; }
  .cl-clin-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
  .cl-clin-link { padding: 6px; border-radius: 22px; }
  .cl-clin-body { padding: 12px 6px 6px; }
  .cl-clin-name { font-size: 16px; }
  .cl-clin-role, .cl-clin-langs, .cl-clin-next { font-size: 13px; }
  .cl-stat dd { font-size: 56px; }
  .cl-days { gap: 6px; }
  .cl-days button { min-height: 60px; border-radius: 16px; }
  .cl-phone { width: 100%; max-width: 340px; }
  .cl-phone-screen { height: 560px; }
  .cl-acc-panel p { padding-right: 8px; }
  .cl-acc-h button { font-size: 17px; }
  .cl-foot-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
  .cl-seg-lg button { padding: 0 14px; font-size: 15px; }
  .cl-plan { padding: 26px; }
}

@media (prefers-reduced-motion: reduce) {
  .cl *, .cl *::before, .cl *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; animation-delay: 0ms !important; transition-duration: 120ms !important; transition-delay: 0ms !important; }
  .cl-orb { transform: none; }
  .cl-orb span { animation: none !important; }
  .cl-marquee { -webkit-mask-image: none; mask-image: none; }
  .cl-marquee-track { animation: none !important; width: auto; justify-content: center; }
  .cl-marquee-set { flex-wrap: wrap; justify-content: center; gap: 16px 40px; padding: 0 20px; }
  .cl-marquee-set[aria-hidden="true"] { display: none; }
  .cl-js [data-cl-rv] { transform: none; }
  .cl-js .cl-chat > * { opacity: 1; transform: none; }
  .cl-js .cl-typing { display: none; }
}
@media (prefers-contrast: more) {
  .cl-widget, .cl-nav.is-scrolled .cl-nav-in { background: #FFFFFF; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: 0 0 0 1px var(--cl-ink); }
  .cl-slot, .cl-days button { box-shadow: inset 0 0 0 1px var(--cl-ink-2); }
  .cl-card, .cl-plan, .cl-clin-link, .cl-stat { box-shadow: 0 0 0 1px var(--cl-ink-2); }
}
@media (prefers-reduced-transparency: reduce) {
  .cl-widget, .cl-nav.is-scrolled .cl-nav-in { background: #FFFFFF; -webkit-backdrop-filter: none; backdrop-filter: none; }
}
`;
