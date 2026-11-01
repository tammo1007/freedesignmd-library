/**
 * Vault — monochrome business-banking landing page.
 *
 * A complete, self-contained single page: React is the only import and every
 * style lives in the <style> block at the bottom of this file (classes are
 * prefixed `fd-vlt-`). Drop it into any React 18+ project and render <Page />.
 *
 * Motion: CSS-keyframe headline mask reveal, live balance odometer, pointer
 * tilt driven by a small spring integrator, a sticky scene where a dashboard
 * assembles from scroll progress, a pinned horizontal capability rail,
 * count-up stats, compliance marquee, segmented pricing with a spring thumb
 * and grid-row FAQ accordions.
 *
 * Browser support: evergreen browsers. Uses position: sticky, CSS custom
 * properties, IntersectionObserver and requestAnimationFrame.
 * Accessibility: semantic landmarks, real buttons, radiogroup pricing switch,
 * aria-expanded accordions, visible focus rings, prefers-reduced-motion and
 * prefers-contrast fallbacks. SSR-safe (no window access during render).
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* ─────────────────────────── helpers ─────────────────────────── */

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Adds `data-in` to every [data-reveal] descendant as it enters the viewport. */
function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.setAttribute("data-js", "");
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) {
      items.forEach((i) => i.setAttribute("data-in", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-in", "");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, [root]);
}

/**
 * Calls `fn` on every animation frame while `ref` is near the viewport and the
 * page scrolls or resizes. `fn` reads layout and writes transforms/vars only.
 */
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

/** Progress (0→1) of a tall sticky section: 0 when its top hits the viewport top, 1 when its bottom does. */
function pinnedProgress(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const travel = r.height - vh;
  if (travel <= 1) return clamp01((vh * 0.9 - r.top) / (vh * 0.7));
  return clamp01(-r.top / travel);
}

/* ─────────────────────────── odometer ─────────────────────────── */

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function Odometer({ value, className = "" }: { value: string; className?: string }) {
  const chars = value.split("");
  return (
    <span className={`fd-vlt-odo ${className}`}>
      <span className="fd-vlt-sr">{value}</span>
      {chars.map((c, i) => {
        const fromRight = chars.length - i;
        if (!/\d/.test(c)) {
          return (
            <span key={`s${fromRight}${c}`} className="fd-vlt-odo-sep" aria-hidden="true">
              {c}
            </span>
          );
        }
        return (
          <span key={`d${fromRight}`} className="fd-vlt-odo-col" aria-hidden="true">
            <span
              className="fd-vlt-odo-strip"
              style={{ transform: `translateY(-${Number(c) * 10}%)`, transitionDelay: `${fromRight * 22}ms` }}
            >
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─────────────────────────── icons ─────────────────────────── */

function Logo() {
  return (
    <svg className="fd-vlt-logo" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="1.5" y="1.5" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 7l6 10 6-10" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg className="fd-vlt-arrow" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M3 8h9.5M8.5 3.5L13 8l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="fd-vlt-check" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/* ─────────────────────────── nav ─────────────────────────── */

const NAV = [
  { href: "#platform", label: "Platform" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#security", label: "Security" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

function Nav() {
  const [condensed, setCondensed] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setCondensed(window.scrollY > 16);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className="fd-vlt-nav" data-condensed={condensed || undefined} data-open={open || undefined}>
      <div className="fd-vlt-nav-in">
        <a className="fd-vlt-brand" href="#top" aria-label="Vault home">
          <Logo />
          <span>Vault</span>
        </a>
        <nav className="fd-vlt-nav-links" aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="fd-vlt-nav-cta">
          <a className="fd-vlt-nav-signin" href="#top">
            Sign in
          </a>
          <a className="fd-vlt-btn fd-vlt-btn-sm" href="#pricing">
            Open account
          </a>
          <button
            type="button"
            className="fd-vlt-burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
      <div className="fd-vlt-sheet" hidden={!open}>
        {NAV.map((n) => (
          <a key={n.href} href={n.href} onClick={() => setOpen(false)}>
            {n.label}
          </a>
        ))}
        <a className="fd-vlt-btn" href="#pricing" onClick={() => setOpen(false)}>
          Open account <Arrow />
        </a>
      </div>
    </header>
  );
}

/* ─────────────────────────── hero ─────────────────────────── */

type Txn = { id: number; who: string; memo: string; amount: number };
const INCOMING: Omit<Txn, "id">[] = [
  { who: "Northwind Freight", memo: "Invoice 4471 · ACH", amount: 18400 },
  { who: "AWS", memo: "Card ••3391", amount: -2316.48 },
  { who: "Halcyon Health", memo: "Wire · SWIFT", amount: 62250 },
  { who: "Gusto Payroll", memo: "Batch 10/31", amount: -41880.12 },
  { who: "Lumen Bio", memo: "Invoice 4473 · RTP", amount: 9120 },
  { who: "Figma", memo: "Card ••0815", amount: -1440 },
];

function BalanceCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [balance, setBalance] = useState(4812390.22);
  const [txns, setTxns] = useState<Txn[]>([
    { id: -1, who: "Atlas Robotics", memo: "Invoice 4470 · Wire", amount: 120000 },
    { id: -2, who: "Ramp Lease Co.", memo: "Rent · ACH", amount: -28500 },
    { id: -3, who: "Parcel & Co", memo: "Invoice 4468 · RTP", amount: 7310.5 },
  ]);

  // Live feed: a new settlement lands every few seconds while visible.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let i = 0;
    let visible = true;
    const el = cardRef.current;
    const io =
      el && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => (visible = e.isIntersecting))
        : undefined;
    if (el) io?.observe(el);
    const id = window.setInterval(() => {
      if (!visible || document.hidden) return;
      const t = INCOMING[i % INCOMING.length];
      i += 1;
      setBalance((b) => Math.round((b + t.amount) * 100) / 100);
      setTxns((list) => [{ ...t, id: i }, ...list].slice(0, 3));
    }, 2800);
    return () => {
      window.clearInterval(id);
      io?.disconnect();
    };
  }, []);

  // Pointer tilt — spring integrator (k 380, c 30, m 1).
  useEffect(() => {
    const card = cardRef.current;
    if (!card || prefersReducedMotion()) return;
    const zone = card.closest<HTMLElement>(".fd-vlt-hero") ?? card;
    const s = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, gx: 50, gy: 30 };
    let raf = 0;
    let last = 0;
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - (last || now)) / 1000 || 0.016);
      last = now;
      const k = 380;
      const c = 30;
      s.vx += (k * (s.tx - s.x) - c * s.vx) * dt;
      s.vy += (k * (s.ty - s.y) - c * s.vy) * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      card.style.setProperty("--rx", `${s.y.toFixed(3)}deg`);
      card.style.setProperty("--ry", `${s.x.toFixed(3)}deg`);
      card.style.setProperty("--gx", `${s.gx}%`);
      card.style.setProperty("--gy", `${s.gy}%`);
      const settled =
        Math.abs(s.tx - s.x) < 0.01 && Math.abs(s.ty - s.y) < 0.01 && Math.abs(s.vx) < 0.01 && Math.abs(s.vy) < 0.01;
      raf = settled ? 0 : requestAnimationFrame(step);
    };
    const kick = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(step);
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const py = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      s.tx = Math.max(-1, Math.min(1, px)) * 9;
      s.ty = Math.max(-1, Math.min(1, py)) * -7;
      s.gx = Math.round(clamp01((e.clientX - r.left) / r.width) * 100);
      s.gy = Math.round(clamp01((e.clientY - r.top) / r.height) * 100);
      kick();
    };
    const leave = () => {
      s.tx = 0;
      s.ty = 0;
      s.gx = 50;
      s.gy = 30;
      kick();
    };
    zone.addEventListener("pointermove", move);
    zone.addEventListener("pointerleave", leave);
    return () => {
      zone.removeEventListener("pointermove", move);
      zone.removeEventListener("pointerleave", leave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fd-vlt-card-wrap">
      <span className="fd-vlt-fig" aria-hidden="true">
        Fig. 01 — Operating account, live
      </span>
      <div ref={cardRef} className="fd-vlt-card" aria-label="Example operating account">
        <div className="fd-vlt-card-glare" aria-hidden="true" />
        <div className="fd-vlt-card-top">
          <span className="fd-vlt-mono">Operating · USD</span>
          <span className="fd-vlt-live">
            <i aria-hidden="true" /> Live
          </span>
        </div>
        <div className="fd-vlt-card-bal" aria-live="polite">
          <span className="fd-vlt-card-cur">$</span>
          <Odometer value={usd(balance)} />
        </div>
        <div className="fd-vlt-card-meta">
          <span>Acct ••••4417</span>
          <span>Routing 026 073 150</span>
        </div>
        <svg className="fd-vlt-spark" viewBox="0 0 320 64" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 52 L20 50 L40 46 L60 48 L80 40 L100 42 L120 36 L140 38 L160 30 L180 33 L200 26 L220 28 L240 20 L260 22 L280 14 L300 16 L320 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M0 52 L20 50 L40 46 L60 48 L80 40 L100 42 L120 36 L140 38 L160 30 L180 33 L200 26 L220 28 L240 20 L260 22 L280 14 L300 16 L320 8 L320 64 L0 64Z"
            fill="currentColor"
            opacity="0.06"
          />
        </svg>
        <ul className="fd-vlt-txns">
          {txns.map((t) => (
            <li key={t.id} className="fd-vlt-txn">
              <span className="fd-vlt-txn-dot" data-in={t.amount > 0 || undefined} aria-hidden="true" />
              <span className="fd-vlt-txn-who">
                <b>{t.who}</b>
                <small>{t.memo}</small>
              </span>
              <span className="fd-vlt-txn-amt">
                {t.amount > 0 ? "+" : "−"}${usd(Math.abs(t.amount))}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <span className="fd-vlt-dim fd-vlt-dim-x" aria-hidden="true">
        <i />
        440
        <i />
      </span>
    </div>
  );
}

function Hero() {
  return (
    <section className="fd-vlt-hero fd-vlt-grid-bg" id="top">
      <div className="fd-vlt-wrap fd-vlt-hero-in">
        <div className="fd-vlt-hero-copy">
          <p className="fd-vlt-eyebrow fd-vlt-rise" style={{ "--d": "0ms" } as CSSProperties}>
            <span className="fd-vlt-tag">New</span> Treasury sweeps into T-bills, daily
          </p>
          <h1 className="fd-vlt-h1">
            <span className="fd-vlt-mask">
              <span style={{ "--d": "80ms" } as CSSProperties}>Money that</span>
            </span>
            <span className="fd-vlt-mask">
              <span style={{ "--d": "170ms" } as CSSProperties}>holds its</span>
            </span>
            <span className="fd-vlt-mask">
              <span style={{ "--d": "260ms" } as CSSProperties}>
                line<span className="fd-vlt-dot">.</span>
              </span>
            </span>
          </h1>
          <p className="fd-vlt-lede fd-vlt-rise" style={{ "--d": "420ms" } as CSSProperties}>
            Operating accounts, corporate cards, global payments and treasury — one ledger, eleven currencies,
            zero spreadsheets. Built for companies from seed to IPO.
          </p>
          <div className="fd-vlt-ctas fd-vlt-rise" style={{ "--d": "520ms" } as CSSProperties}>
            <a className="fd-vlt-btn" href="#pricing">
              Open an account <Arrow />
            </a>
            <a className="fd-vlt-btn fd-vlt-btn-ghost" href="#platform">
              See the platform
            </a>
          </div>
          <p className="fd-vlt-fine fd-vlt-rise" style={{ "--d": "600ms" } as CSSProperties}>
            Approved in 1 business day · FDIC pass-through to $125M per entity
          </p>
        </div>
        <div className="fd-vlt-hero-card fd-vlt-rise" style={{ "--d": "300ms" } as CSSProperties}>
          <BalanceCard />
        </div>
      </div>
      <div className="fd-vlt-wrap">
        <dl className="fd-vlt-ticker">
          {[
            ["$38.2B", "settled, trailing 12 months"],
            ["41,000+", "companies banking"],
            ["99.998%", "platform uptime"],
            ["11", "settlement currencies"],
          ].map(([k, v], i) => (
            <div key={k} className="fd-vlt-rise" style={{ "--d": `${680 + i * 70}ms` } as CSSProperties}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <span className="fd-vlt-reg fd-vlt-reg-tl" aria-hidden="true" />
      <span className="fd-vlt-reg fd-vlt-reg-tr" aria-hidden="true" />
      <span className="fd-vlt-spec" aria-hidden="true">
        GRID 12 · COL 80 · GUTTER 24 · BASE 8
      </span>
    </section>
  );
}

/* ─────────────────────────── logos ─────────────────────────── */

const LOGOS = [
  { name: "Northwind", style: "fd-vlt-wm-1" },
  { name: "HALCYON", style: "fd-vlt-wm-2" },
  { name: "lumen bio", style: "fd-vlt-wm-3" },
  { name: "Kestrel", style: "fd-vlt-wm-4" },
  { name: "PARCEL&CO", style: "fd-vlt-wm-5" },
  { name: "Atlas Robotics", style: "fd-vlt-wm-6" },
  { name: "ouro", style: "fd-vlt-wm-7" },
];

function Logos() {
  return (
    <section className="fd-vlt-logos" aria-label="Customers">
      <div className="fd-vlt-wrap">
        <p className="fd-vlt-label" data-reveal="">
          Finance teams that moved their operating cash to Vault
        </p>
        <ul className="fd-vlt-logo-row">
          {LOGOS.map((l, i) => (
            <li key={l.name} className={l.style} data-reveal="" style={{ "--i": i } as CSSProperties}>
              {l.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────────── platform (sticky assembly) ─────────────────────────── */

const STEPS = [
  {
    k: "01",
    t: "Every balance, one number.",
    d: "Operating, payroll, tax and reserve accounts roll up across 11 currencies — converted at the mid-market rate, refreshed on every settlement.",
  },
  {
    k: "02",
    t: "Cash flow you can read.",
    d: "Inflows and outflows by week, with runway projected from the last 90 days of actuals — not last quarter’s board deck.",
  },
  {
    k: "03",
    t: "Cards with a conscience.",
    d: "Issue virtual cards in seconds. Lock each one to a vendor, a category or a monthly ceiling, and freeze it from Slack.",
  },
  {
    k: "04",
    t: "Payments that wait for two.",
    d: "Every wire over $50,000 routes for dual approval with a hardware key. Everything else clears same-day on ACH, RTP or SWIFT.",
  },
];

/** [start, end] of each dashboard piece within the scene progress. */
const PIECES: Record<string, [number, number]> = {
  side: [0.02, 0.16],
  bal: [0.06, 0.22],
  flow: [0.26, 0.44],
  card: [0.5, 0.66],
  txns: [0.72, 0.86],
  appr: [0.78, 0.92],
};

function Platform() {
  const outer = useRef<HTMLElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = prefersReducedMotion();
  }, []);
  useScrollFrame(outer, () => {
    const el = outer.current;
    if (!el) return;
    const p = reduced.current ? 1 : pinnedProgress(el);
    el.querySelectorAll<HTMLElement>("[data-piece]").forEach((n) => {
      const [a, b] = PIECES[n.dataset.piece ?? ""] ?? [0, 1];
      n.style.setProperty("--t", easeOut(clamp01((p - a) / (b - a))).toFixed(3));
    });
    const idx = p < 0.24 ? 0 : p < 0.48 ? 1 : p < 0.7 ? 2 : 3;
    el.querySelectorAll<HTMLElement>("[data-step]").forEach((n, i) => {
      if (i === idx) n.setAttribute("data-active", "");
      else n.removeAttribute("data-active");
    });
    el.style.setProperty("--p", p.toFixed(3));
    if (readout.current) readout.current.textContent = `${String(Math.round(p * 100)).padStart(3, "0")}%`;
  });

  return (
    <section ref={outer} className="fd-vlt-plat" id="platform">
      <div className="fd-vlt-plat-stick">
        <div className="fd-vlt-wrap fd-vlt-plat-grid">
          <div className="fd-vlt-plat-copy">
            <p className="fd-vlt-label">02 — Platform</p>
            <h2 className="fd-vlt-h2">
              One screen for
              <br />
              every dollar.
            </h2>
            <ol className="fd-vlt-steps">
              {STEPS.map((s, i) => (
                <li key={s.k} data-step="" data-active={i === 0 || undefined}>
                  <span className="fd-vlt-step-k">{s.k}</span>
                  <div>
                    <h3>{s.t}</h3>
                    <p>{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="fd-vlt-plat-bar" aria-hidden="true">
              <i />
              <span ref={readout}>000%</span>
            </div>
          </div>

          <div className="fd-vlt-dash-wrap" aria-label="Vault dashboard preview" role="img">
            <div className="fd-vlt-dash">
              <div className="fd-vlt-dash-chrome">
                <span />
                <span />
                <span />
                <em>app.vault.co/overview</em>
              </div>
              <div className="fd-vlt-dash-body">
                {(["side", "bal", "flow", "card", "txns", "appr"] as const).map((k, i) => (
                  <div key={k} className={`fd-vlt-slot fd-vlt-slot-${k}`} aria-hidden="true">
                    <span>{String.fromCharCode(65 + i)}</span>
                  </div>
                ))}

                <div className="fd-vlt-piece fd-vlt-slot-side" data-piece="side" style={{ "--dx": "-80px", "--dy": "0px" } as CSSProperties}>
                  <div className="fd-vlt-side">
                    <b>
                      <Logo /> Kestrel Aerospace
                    </b>
                    {["Overview", "Accounts", "Cards", "Payments", "Treasury", "Ledger"].map((n, i) => (
                      <span key={n} data-on={i === 0 || undefined}>
                        {n}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="fd-vlt-piece fd-vlt-slot-bal" data-piece="bal" style={{ "--dx": "0px", "--dy": "-60px" } as CSSProperties}>
                  <div className="fd-vlt-tile">
                    <small>Total cash · 11 currencies</small>
                    <strong>$12,904,118.40</strong>
                    <span className="fd-vlt-delta">▲ 2.4% vs. 30 days</span>
                    <div className="fd-vlt-split">
                      <i style={{ width: "54%" }} />
                      <i style={{ width: "21%" }} />
                      <i style={{ width: "15%" }} />
                      <i style={{ width: "10%" }} />
                    </div>
                    <div className="fd-vlt-legend">
                      <span>Operating 54%</span>
                      <span>Treasury 21%</span>
                      <span>Payroll 15%</span>
                      <span>Reserve 10%</span>
                    </div>
                  </div>
                </div>

                <div className="fd-vlt-piece fd-vlt-slot-flow" data-piece="flow" style={{ "--dx": "90px", "--dy": "40px" } as CSSProperties}>
                  <div className="fd-vlt-tile">
                    <small>Cash flow · last 12 weeks</small>
                    <div className="fd-vlt-bars">
                      {[62, 48, 71, 55, 80, 66, 74, 58, 88, 70, 92, 84].map((h, i) => (
                        <span key={i}>
                          <i style={{ height: `${h}%` }} />
                          <i style={{ height: `${Math.round(h * 0.62)}%` }} />
                        </span>
                      ))}
                    </div>
                    <span className="fd-vlt-runway">Runway 31 mo · at current burn</span>
                  </div>
                </div>

                <div className="fd-vlt-piece fd-vlt-slot-card" data-piece="card" style={{ "--dx": "120px", "--dy": "-30px" } as CSSProperties}>
                  <div className="fd-vlt-mini-card">
                    <div>
                      <Logo />
                      <span>Virtual</span>
                    </div>
                    <span className="fd-vlt-mini-pan">•••• •••• •••• 3391</span>
                    <div className="fd-vlt-mini-foot">
                      <span>Cloud infra</span>
                      <span>$18,240 / $25,000</span>
                    </div>
                    <i className="fd-vlt-mini-meter" style={{ "--m": "0.73" } as CSSProperties} />
                  </div>
                </div>

                <div className="fd-vlt-piece fd-vlt-slot-txns" data-piece="txns" style={{ "--dx": "0px", "--dy": "80px" } as CSSProperties}>
                  <div className="fd-vlt-tile fd-vlt-table">
                    <small>Recent activity</small>
                    {[
                      ["Oct 29", "Halcyon Health", "Wire in", "+$62,250.00"],
                      ["Oct 29", "AWS", "Card ••3391", "−$2,316.48"],
                      ["Oct 28", "Gusto Payroll", "ACH out", "−$41,880.12"],
                      ["Oct 28", "Northwind Freight", "RTP in", "+$18,400.00"],
                    ].map((r) => (
                      <div key={r[1]} className="fd-vlt-row">
                        <span>{r[0]}</span>
                        <span>{r[1]}</span>
                        <span>{r[2]}</span>
                        <span>{r[3]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="fd-vlt-piece fd-vlt-slot-appr" data-piece="appr" style={{ "--dx": "60px", "--dy": "70px" } as CSSProperties}>
                  <div className="fd-vlt-tile fd-vlt-appr">
                    <small>Awaiting approval</small>
                    <strong>2 wires</strong>
                    <span>$184,000 · SWIFT · EUR</span>
                    <div className="fd-vlt-appr-btns">
                      <span>Review</span>
                      <span>Approve with key</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <span className="fd-vlt-fig fd-vlt-fig-b" aria-hidden="true">
              Fig. 02 — Overview, assembled from six modules
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── capability rail (pinned horizontal) ─────────────────────────── */

const CAPS: { k: string; t: string; d: string; specs: [string, string][]; art: ReactNode }[] = [
  {
    k: "01",
    t: "Accounts",
    d: "Unlimited operating and sub-accounts per entity, each with its own routing details and statements.",
    specs: [
      ["Currencies", "11"],
      ["Sub-accounts", "Unlimited"],
      ["Opening time", "1 business day"],
    ],
    art: (
      <svg viewBox="0 0 200 120" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(${20 + i * 8} ${16 + i * 22})`}>
            <rect width="150" height="16" fill="none" stroke="currentColor" />
            <rect x="6" y="5" width={40 + i * 14} height="6" fill="currentColor" opacity={0.85 - i * 0.18} />
          </g>
        ))}
      </svg>
    ),
  },
  {
    k: "02",
    t: "Corporate cards",
    d: "Physical and virtual cards with limits per merchant, category, team or geography — enforced at authorization.",
    specs: [
      ["Issue time", "< 4 seconds"],
      ["Cashback", "1.75% flat"],
      ["Networks", "Visa Signature"],
    ],
    art: (
      <svg viewBox="0 0 200 120" aria-hidden="true">
        <rect x="40" y="14" width="130" height="84" rx="8" fill="none" stroke="currentColor" />
        <rect x="28" y="24" width="130" height="84" rx="8" fill="currentColor" opacity="0.92" />
        <rect x="42" y="46" width="22" height="16" rx="3" fill="none" stroke="#fff" opacity="0.8" />
        <path d="M42 90h60" stroke="#fff" opacity="0.7" />
      </svg>
    ),
  },
  {
    k: "03",
    t: "Global payments",
    d: "ACH, RTP, FedNow, SEPA, Faster Payments and SWIFT from one form. FX at mid-market plus 0.25%.",
    specs: [
      ["Rails", "6"],
      ["Same-day wires", "94%"],
      ["FX spread", "0.25%"],
    ],
    art: (
      <svg viewBox="0 0 200 120" aria-hidden="true">
        <circle cx="100" cy="60" r="44" fill="none" stroke="currentColor" />
        <ellipse cx="100" cy="60" rx="18" ry="44" fill="none" stroke="currentColor" opacity="0.5" />
        <path d="M56 60h88M62 38h76M62 82h76" stroke="currentColor" opacity="0.5" />
        <path d="M30 96 Q100 0 172 30" fill="none" stroke="currentColor" strokeDasharray="3 4" />
        <circle cx="30" cy="96" r="4" fill="currentColor" />
        <circle cx="172" cy="30" r="4" fill="currentColor" />
      </svg>
    ),
  },
  {
    k: "04",
    t: "Treasury",
    d: "Sweep idle cash into US T-bills and government money-market funds daily, with same-day liquidity back to operating.",
    specs: [
      ["Yield, 7-day", "4.12%"],
      ["Liquidity", "Same day"],
      ["Minimum", "$0"],
    ],
    art: (
      <svg viewBox="0 0 200 120" aria-hidden="true">
        <path d="M20 100H184M20 100V14" stroke="currentColor" opacity="0.4" />
        <path d="M20 92 C60 88 70 50 104 44 S160 30 184 22" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {[40, 72, 104, 136, 168].map((x) => (
          <path key={x} d={`M${x} 100v-4`} stroke="currentColor" />
        ))}
        <circle cx="104" cy="44" r="4" fill="currentColor" />
      </svg>
    ),
  },
  {
    k: "05",
    t: "Spend controls",
    d: "Policies written once, enforced everywhere: approval chains by amount, receipts required over $75, auto-freeze on anomalies.",
    specs: [
      ["Policy rules", "Unlimited"],
      ["Receipt match", "Auto · 96%"],
      ["Freeze", "From Slack"],
    ],
    art: (
      <svg viewBox="0 0 200 120" aria-hidden="true">
        {[28, 60, 92].map((y, i) => (
          <g key={y}>
            <path d={`M24 ${y}H176`} stroke="currentColor" opacity="0.35" />
            <path d={`M24 ${y}H${70 + i * 34}`} stroke="currentColor" strokeWidth="2" />
            <circle cx={70 + i * 34} cy={y} r="7" fill="#fff" stroke="currentColor" strokeWidth="1.5" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    k: "06",
    t: "Ledger & sync",
    d: "A double-entry ledger your auditor can read. Pushes coded transactions to NetSuite, Xero or QuickBooks every hour.",
    specs: [
      ["Sync", "Hourly"],
      ["Close time", "−62%"],
      ["Exports", "CSV · API · SFTP"],
    ],
    art: (
      <svg viewBox="0 0 200 120" aria-hidden="true">
        <path d="M30 24H170M100 24V104" stroke="currentColor" strokeWidth="1.5" />
        <text x="62" y="18" textAnchor="middle" fontSize="9" fill="currentColor" fontFamily="ui-monospace, Menlo, monospace">DEBIT</text>
        <text x="138" y="18" textAnchor="middle" fontSize="9" fill="currentColor" fontFamily="ui-monospace, Menlo, monospace">CREDIT</text>
        {[40, 58, 76].map((y, i) => (
          <g key={y}>
            <rect x="40" y={y} width={44 - i * 8} height="6" fill="currentColor" opacity="0.8" />
            <rect x="112" y={y} width={30 + i * 6} height="6" fill="currentColor" opacity="0.8" />
          </g>
        ))}
        <path d="M40 94H90M112 94H162" stroke="currentColor" strokeDasharray="2 3" />
      </svg>
    ),
  },
];

function Capabilities() {
  const outer = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const dist = useRef(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = prefersReducedMotion();
    const o = outer.current;
    const t = track.current;
    if (!o || !t) return;
    const measure = () => {
      if (reduced.current) {
        o.style.height = "";
        return;
      }
      dist.current = Math.max(0, t.scrollWidth - t.clientWidth);
      o.style.height = `${dist.current + window.innerHeight}px`;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(t);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useScrollFrame(outer, () => {
    const o = outer.current;
    const t = track.current;
    if (!o || !t || reduced.current) return;
    const r = o.getBoundingClientRect();
    const p = dist.current > 0 ? clamp01(-r.top / dist.current) : 0;
    t.style.setProperty("--x", `${(-p * dist.current).toFixed(1)}px`);
    o.style.setProperty("--p", p.toFixed(4));
    if (count.current) count.current.textContent = String(Math.min(CAPS.length, 1 + Math.floor(p * CAPS.length * 0.999))).padStart(2, "0");
  });

  return (
    <section ref={outer} className="fd-vlt-caps" id="capabilities" aria-label="Capabilities">
      <div className="fd-vlt-caps-stick">
        <div className="fd-vlt-wrap fd-vlt-caps-head">
          <div>
            <p className="fd-vlt-label fd-vlt-on-dark">03 — Capabilities</p>
            <h2 className="fd-vlt-h2">Six instruments. One ledger.</h2>
          </div>
          <p className="fd-vlt-caps-count" aria-hidden="true">
            <span ref={count}>01</span> / {String(CAPS.length).padStart(2, "0")}
          </p>
        </div>
        <div ref={track} className="fd-vlt-caps-track" tabIndex={0} aria-label="Capabilities, scroll horizontally">
          {CAPS.map((c) => (
            <article key={c.k} className="fd-vlt-cap">
              <div className="fd-vlt-cap-top">
                <span className="fd-vlt-mono">{c.k}</span>
                <span className="fd-vlt-mono">Vault / {c.t}</span>
              </div>
              <div className="fd-vlt-cap-art">{c.art}</div>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
              <dl>
                {c.specs.map(([a, b]) => (
                  <div key={a}>
                    <dt>{a}</dt>
                    <dd>{b}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
          <div className="fd-vlt-cap-end" aria-hidden="true" />
        </div>
        <div className="fd-vlt-wrap">
          <div className="fd-vlt-caps-progress" aria-hidden="true">
            <i />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── stats (count-up) ─────────────────────────── */

const STATS = [
  { to: 38.2, dec: 1, pre: "$", suf: "B", label: "Settled through Vault in the last twelve months." },
  { to: 41000, dec: 0, pre: "", suf: "+", label: "Companies run payroll, payables and cards on Vault." },
  { to: 99.998, dec: 3, pre: "", suf: "%", label: "Platform uptime across all payment rails, trailing year." },
  { to: 19, dec: 0, pre: "", suf: " hrs", label: "Median time from term-sheet wire to cash in T-bills." },
];

function CountUp({ to, dec, pre, suf }: { to: number; dec: number; pre: string; suf: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (n: number) =>
    pre + n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
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
        const dur = 1600;
        const tick = (now: number) => {
          const t = clamp01((now - start) / dur);
          const v = to * (1 - Math.pow(2, -10 * t));
          el.textContent = fmt(t >= 1 ? to : v);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  return (
    <span ref={ref} className="fd-vlt-count">
      {fmt(to)}
    </span>
  );
}

function Stats() {
  return (
    <section className="fd-vlt-stats" aria-label="Vault in numbers">
      <div className="fd-vlt-wrap">
        <div className="fd-vlt-stats-head" data-reveal="">
          <p className="fd-vlt-label">04 — In numbers</p>
          <h2 className="fd-vlt-h2">Measured, not marketed.</h2>
        </div>
        <div className="fd-vlt-stats-grid">
          {STATS.map((s, i) => (
            <div key={s.label} className="fd-vlt-stat" data-reveal="" style={{ "--i": i } as CSSProperties}>
              <span className="fd-vlt-mono">({String.fromCharCode(97 + i)})</span>
              <CountUp {...s} />
              <p>{s.label}</p>
            </div>
          ))}
        </div>
        <p className="fd-vlt-footnote" data-reveal="">
          Figures as of September 30, 2026. Treasury yield is variable and shown net of fees.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────── security + marquee ─────────────────────────── */

const BADGES = [
  "SOC 1 Type II",
  "SOC 2 Type II",
  "PCI DSS Level 1",
  "ISO/IEC 27001",
  "ISO/IEC 27701",
  "GDPR",
  "CCPA",
  "FDIC pass-through",
  "AES-256 at rest",
  "TLS 1.3",
  "FIDO2 keys",
  "Annual pen-test",
];

function Security() {
  return (
    <section className="fd-vlt-sec" id="security">
      <div className="fd-vlt-wrap fd-vlt-sec-grid">
        <div data-reveal="">
          <p className="fd-vlt-label">05 — Security</p>
          <h2 className="fd-vlt-h2">
            Paranoid by
            <br />
            default.
          </h2>
        </div>
        <div className="fd-vlt-sec-cols">
          {[
            ["Dual control", "Wires above a threshold you set require two approvers and a FIDO2 hardware key. No exceptions for admins."],
            ["Partner banks", "Deposits are held at Harbor State Bank and Meridian Trust, Members FDIC, and swept across 14 program banks."],
            ["Audit trail", "Every login, permission change and payment is signed, timestamped and retained for seven years."],
          ].map(([t, d], i) => (
            <div key={t} className="fd-vlt-sec-col" data-reveal="" style={{ "--i": i } as CSSProperties}>
              <span className="fd-vlt-mono">0{i + 1}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="fd-vlt-marquee" aria-label="Certifications and controls">
        {[0, 1].map((row) => (
          <div key={row} className="fd-vlt-marquee-row" data-dir={row === 1 ? "rev" : undefined}>
            <ul className="fd-vlt-marquee-track">
              {[...BADGES, ...BADGES].map((b, i) => (
                <li key={i} aria-hidden={i >= BADGES.length || row === 1 || undefined}>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                    <path d="M8 1.5l5.5 2v4c0 3.3-2.3 6-5.5 7-3.2-1-5.5-3.7-5.5-7v-4z" fill="none" stroke="currentColor" />
                  </svg>
                  {row === 1 ? BADGES[(i + 5) % BADGES.length] : b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── testimonial ─────────────────────────── */

function Testimonial() {
  return (
    <section className="fd-vlt-quote" aria-label="Customer story">
      <div className="fd-vlt-wrap fd-vlt-quote-grid">
        <p className="fd-vlt-label" data-reveal="">
          06 — Customer
        </p>
        <figure data-reveal="">
          <blockquote>
            “We closed our Series B on a Tuesday. By Wednesday morning the wire had cleared, payroll was funded
            for 24 months and the rest was earning in T-bills. Nobody opened a spreadsheet.”
          </blockquote>
          <figcaption>
            <img className="fd-vlt-avatar" src="/img/people/p3.webp" alt="Maren Okafor, CFO of Kestrel Aerospace, a woman with braided hair in a black sweater" width={44} height={44} loading="lazy" decoding="async" />
            <span>
              <b>Maren Okafor</b>
              <small>CFO, Kestrel Aerospace · 212 employees</small>
            </span>
          </figcaption>
        </figure>
        <dl className="fd-vlt-quote-stats">
          {[
            ["19 hrs", "wire to treasury"],
            ["100%", "card spend auto-coded"],
            ["62 hrs", "saved every month-end"],
          ].map(([k, v], i) => (
            <div key={k} data-reveal="" style={{ "--i": i } as CSSProperties}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ─────────────────────────── pricing ─────────────────────────── */

const PLANS = [
  {
    name: "Launch",
    who: "For pre-seed and bootstrapped teams.",
    m: 0,
    y: 0,
    cta: "Open account",
    feats: ["1 operating account", "5 corporate cards", "ACH, RTP and domestic wires", "FDIC pass-through to $5M"],
  },
  {
    name: "Scale",
    who: "For Series A through C.",
    m: 299,
    y: 239,
    cta: "Start 30-day trial",
    featured: true,
    feats: [
      "Unlimited accounts and sub-ledgers",
      "Unlimited cards with policy engine",
      "SWIFT, SEPA, FedNow, Faster Payments",
      "Daily treasury sweeps to T-bills",
      "NetSuite, Xero and QuickBooks sync",
    ],
  },
  {
    name: "Enterprise",
    who: "For public companies and regulated entities.",
    m: 1800,
    y: 1440,
    cta: "Talk to sales",
    feats: ["Dedicated banking partner", "Custom approval chains and SSO/SCIM", "Quarterly compliance review", "99.99% uptime SLA"],
  },
];

function Pricing() {
  const [annual, setAnnual] = useState(true);
  const groupId = useId();
  return (
    <section className="fd-vlt-pricing" id="pricing">
      <div className="fd-vlt-wrap">
        <div className="fd-vlt-pricing-head" data-reveal="">
          <div>
            <p className="fd-vlt-label">07 — Pricing</p>
            <h2 className="fd-vlt-h2">Priced like a utility.</h2>
          </div>
          <div className="fd-vlt-seg" role="radiogroup" aria-labelledby={groupId} data-annual={annual || undefined}>
            <span id={groupId} className="fd-vlt-sr">
              Billing period
            </span>
            <i className="fd-vlt-seg-thumb" aria-hidden="true" />
            <button type="button" role="radio" aria-checked={!annual} onClick={() => setAnnual(false)}>
              Monthly
            </button>
            <button type="button" role="radio" aria-checked={annual} onClick={() => setAnnual(true)}>
              Annual <span className="fd-vlt-save">−20%</span>
            </button>
          </div>
        </div>
        <div className="fd-vlt-plans">
          {PLANS.map((p, i) => (
            <article
              key={p.name}
              className="fd-vlt-plan"
              data-featured={p.featured || undefined}
              data-reveal=""
              style={{ "--i": i } as CSSProperties}
            >
              <div className="fd-vlt-plan-top">
                <h3>{p.name}</h3>
                {p.featured && <span className="fd-vlt-tag fd-vlt-tag-inv">Most chosen</span>}
              </div>
              <p className="fd-vlt-plan-who">{p.who}</p>
              <div className="fd-vlt-price">
                <span className="fd-vlt-price-cur">$</span>
                <Odometer value={(annual ? p.y : p.m).toLocaleString("en-US")} />
                <span className="fd-vlt-price-per">/ mo</span>
              </div>
              <p className="fd-vlt-plan-bill">{p.m === 0 ? "Free forever" : annual ? "Billed annually" : "Billed monthly"}</p>
              <a className={`fd-vlt-btn ${p.featured ? "fd-vlt-btn-inv" : "fd-vlt-btn-ghost"}`} href="#top">
                {p.cta} <Arrow />
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

/* ─────────────────────────── FAQ ─────────────────────────── */

const FAQS = [
  {
    q: "Is Vault a bank?",
    a: "No. Vault is a financial technology company. Banking services are provided by Harbor State Bank and Meridian Trust, Members FDIC. Deposits are eligible for FDIC pass-through insurance up to $125M per entity through our program-bank network.",
  },
  {
    q: "How long does it take to open an account?",
    a: "Most companies are approved within one business day. You’ll need your EIN, formation documents and ID for each beneficial owner with 25% or more. Account and routing numbers are issued the moment you’re approved.",
  },
  {
    q: "Can I keep my existing bank?",
    a: "Yes. Many customers start by moving payables and cards, then migrate payroll once their first close on Vault is done. You can link external accounts for transfers and view their balances alongside Vault.",
  },
  {
    q: "How does treasury work?",
    a: "Set a target operating balance. Each night, cash above it sweeps into a portfolio of US Treasury bills and government money-market funds. Need it back? Redemptions settle to operating the same business day.",
  },
  {
    q: "Which accounting tools do you sync with?",
    a: "NetSuite, Xero, QuickBooks Online and Sage Intacct, with hourly sync of coded transactions, receipts and memos. Everything is also available through our REST API and daily SFTP exports.",
  },
  {
    q: "What happens if Vault goes away?",
    a: "Your funds are held at our partner banks in accounts titled for your benefit, not on Vault’s balance sheet. In a wind-down, partner banks return deposits directly to you.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <section className="fd-vlt-faq" id="faq">
      <div className="fd-vlt-wrap fd-vlt-faq-grid">
        <div data-reveal="">
          <p className="fd-vlt-label">08 — FAQ</p>
          <h2 className="fd-vlt-h2">Fine print, in large print.</h2>
        </div>
        <div className="fd-vlt-faq-list">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="fd-vlt-faq-item" data-open={isOpen || undefined} data-reveal="" style={{ "--i": i } as CSSProperties}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`${base}-${i}`}
                    id={`${base}-${i}-b`}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <span>{f.q}</span>
                    <i aria-hidden="true" />
                  </button>
                </h3>
                <div className="fd-vlt-faq-a" id={`${base}-${i}`} role="region" aria-labelledby={`${base}-${i}-b`}>
                  <div>
                    <p>{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── CTA + footer ─────────────────────────── */

function Cta() {
  return (
    <section className="fd-vlt-cta fd-vlt-grid-bg fd-vlt-grid-dark">
      <div className="fd-vlt-wrap fd-vlt-cta-in" data-reveal="">
        <p className="fd-vlt-label fd-vlt-on-dark">09 — Begin</p>
        <h2 className="fd-vlt-cta-h">Start operating.</h2>
        <p className="fd-vlt-cta-p">Ten minutes to apply. One business day to approval. No minimums, no monthly fees on Launch.</p>
        <div className="fd-vlt-ctas">
          <a className="fd-vlt-btn fd-vlt-btn-inv" href="#pricing">
            Open an account <Arrow />
          </a>
          <a className="fd-vlt-btn fd-vlt-btn-ghost-inv" href="#faq">
            Talk to a banker
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="fd-vlt-foot">
      <div className="fd-vlt-wrap">
        <div className="fd-vlt-foot-top">
          <a className="fd-vlt-brand" href="#top" aria-label="Vault home">
            <Logo />
            <span>Vault</span>
          </a>
          {[
            ["Product", ["Accounts", "Cards", "Payments", "Treasury", "API"]],
            ["Company", ["About", "Careers · 14 open", "Press", "Contact"]],
            ["Resources", ["Docs", "Status", "Security", "Changelog"]],
            ["Legal", ["Privacy", "Terms", "Deposit agreement", "Licenses"]],
          ].map(([h, items]) => (
            <div key={h as string} className="fd-vlt-foot-col">
              <h4>{h as string}</h4>
              <ul>
                {(items as string[]).map((it) => (
                  <li key={it}>
                    <a href="#top">{it}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="fd-vlt-legal">
          Vault is a financial technology company, not a bank. Banking services provided by Harbor State Bank and
          Meridian Trust, Members FDIC. The Vault Visa® Signature Card is issued by Harbor State Bank pursuant to a
          license from Visa U.S.A. Inc. Treasury products are offered through Vault Advisers LLC, an SEC-registered
          investment adviser; investments are not FDIC-insured, not bank-guaranteed and may lose value.
        </p>
        <div className="fd-vlt-foot-bot">
          <span>© 2026 Vault Financial, Inc.</span>
          <span>New York · Berlin</span>
          <span className="fd-vlt-mono">v4.12.0 · All systems normal</span>
        </div>
      </div>
      <div className="fd-vlt-giant" aria-hidden="true">
        VAULT
      </div>
    </footer>
  );
}

/* ─────────────────────────── page ─────────────────────────── */

export function Page() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  return (
    <div ref={root} className="fd-vlt">
      <style>{css}</style>
      <Nav />
      <main>
        <Hero />
        <Logos />
        <Platform />
        <Capabilities />
        <Stats />
        <Security />
        <Testimonial />
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
.fd-vlt {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms;
  --fd-dur-2: 240ms;
  --fd-dur-3: 420ms;
  --fd-dur-4: 700ms;

  --fd-vlt-ink: #0b0b0c;
  --fd-vlt-ink-2: #1c1c1f;
  --fd-vlt-paper: #ffffff;
  --fd-vlt-canvas: #f4f4f5;
  --fd-vlt-mute: #5e5e66;
  --fd-vlt-mute-dark: #a1a1aa;
  --fd-vlt-line: rgba(11, 11, 12, 0.1);
  --fd-vlt-line-2: rgba(11, 11, 12, 0.2);
  --fd-vlt-line-dark: rgba(255, 255, 255, 0.12);
  --fd-vlt-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Variable", "Inter", "Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif;
  --fd-vlt-mono: ui-monospace, "SF Mono", "JetBrains Mono Variable", "JetBrains Mono", Menlo, Consolas, monospace;
  --fd-vlt-nav-h: 64px;

  position: relative;
  display: block;
  margin: 0;
  padding: 0;
  background: var(--fd-vlt-paper);
  color: var(--fd-vlt-ink);
  font: 400 1rem/1.5 var(--fd-vlt-sans);
  letter-spacing: -0.005em;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: clip;
}
.fd-vlt, .fd-vlt *, .fd-vlt *::before, .fd-vlt *::after { box-sizing: border-box; }
.fd-vlt :where(h1, h2, h3, h4, h5, h6, p, ul, ol, li, dl, dt, dd, figure, figcaption, blockquote, main, header, footer, section, nav, article) {
  margin: 0; padding: 0; border: 0; font: inherit; color: inherit; letter-spacing: inherit; background: none;
}
.fd-vlt :where(ul, ol) { list-style: none; }
.fd-vlt :where(a) { color: inherit; text-decoration: none; }
.fd-vlt :where(button) {
  appearance: none; -webkit-appearance: none; margin: 0; padding: 0; border: 0; background: none;
  font: inherit; color: inherit; letter-spacing: inherit; text-align: inherit; cursor: pointer; line-height: inherit;
}
.fd-vlt :where(svg) { display: block; overflow: visible; }
.fd-vlt :where(b, strong) { font-weight: 600; }
.fd-vlt :where(small) { font-size: inherit; }
.fd-vlt :where(a, button, [tabindex]):focus-visible { outline: 2px solid rgba(11, 11, 12, 0.7); outline-offset: 2px; }
.fd-vlt-sr { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.fd-vlt-wrap { width: 100%; max-width: 1280px; margin: 0 auto; padding: 0 32px; }
.fd-vlt-mono { font: 500 0.6875rem/1.4 var(--fd-vlt-mono); letter-spacing: 0.08em; text-transform: uppercase; }
.fd-vlt-label { font: 500 0.75rem/1.4 var(--fd-vlt-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--fd-vlt-mute); }
.fd-vlt-on-dark { color: var(--fd-vlt-mute-dark); }
.fd-vlt-h2 { margin-top: 18px; font: 600 clamp(2rem, 4.6vw, 4rem)/1 var(--fd-vlt-sans); letter-spacing: -0.04em; }

/* blueprint grid */
.fd-vlt-grid-bg { position: relative; isolation: isolate; }
.fd-vlt-grid-bg::before {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(11,11,12,0.07) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(11,11,12,0.07) 1px, transparent 1px),
    linear-gradient(to right, rgba(11,11,12,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(11,11,12,0.03) 1px, transparent 1px);
  background-size: 96px 96px, 96px 96px, 24px 24px, 24px 24px;
  background-position: center top;
  -webkit-mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 40%, transparent 100%);
  mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 40%, transparent 100%);
}
.fd-vlt-grid-dark::before {
  background-image:
    linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px),
    linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
}

/* buttons */
.fd-vlt-btn {
  display: inline-flex; align-items: center; gap: 10px; height: 48px; padding: 0 22px;
  border: 1px solid var(--fd-vlt-ink); border-radius: 0; background: var(--fd-vlt-ink); color: var(--fd-vlt-paper);
  font: 500 0.9375rem/1 var(--fd-vlt-sans); letter-spacing: -0.005em; text-decoration: none; white-space: nowrap;
  transition: transform var(--fd-dur-1) var(--fd-ease-out), background-color var(--fd-dur-2) var(--fd-ease-out), color var(--fd-dur-2) var(--fd-ease-out);
}
.fd-vlt-btn:hover { background: var(--fd-vlt-ink-2); }
.fd-vlt-btn:active { transform: scale(0.96); transition: transform var(--fd-dur-1) var(--fd-ease-out); }
.fd-vlt-btn .fd-vlt-arrow { transition: transform var(--fd-dur-2) var(--fd-spring); }
.fd-vlt-btn:hover .fd-vlt-arrow { transform: translateX(3px); }
.fd-vlt-btn-sm { height: 36px; padding: 0 14px; font-size: 0.8125rem; }
.fd-vlt-btn-ghost { background: transparent; color: var(--fd-vlt-ink); border-color: var(--fd-vlt-line-2); }
.fd-vlt-btn-ghost:hover { background: var(--fd-vlt-canvas); border-color: var(--fd-vlt-ink); }
.fd-vlt-btn-inv { background: var(--fd-vlt-paper); color: var(--fd-vlt-ink); border-color: var(--fd-vlt-paper); }
.fd-vlt-btn-inv:hover { background: #e9e9ec; }
.fd-vlt-btn-ghost-inv { background: transparent; color: var(--fd-vlt-paper); border-color: rgba(255,255,255,0.3); }
.fd-vlt-btn-ghost-inv:hover { background: rgba(255,255,255,0.08); border-color: #fff; }
.fd-vlt-tag {
  display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border: 1px solid var(--fd-vlt-ink);
  font: 600 0.625rem/1 var(--fd-vlt-mono); letter-spacing: 0.08em; text-transform: uppercase;
}
.fd-vlt-tag-inv { background: var(--fd-vlt-paper); color: var(--fd-vlt-ink); border-color: var(--fd-vlt-paper); }

/* nav */
.fd-vlt-nav {
  position: sticky; top: 0; z-index: 50; display: block;
  background: rgba(255,255,255,0); border-bottom: 1px solid transparent;
  transition: background-color var(--fd-dur-3) var(--fd-ease-out), border-color var(--fd-dur-3) var(--fd-ease-out), backdrop-filter var(--fd-dur-3) var(--fd-ease-out);
}
.fd-vlt-nav[data-condensed], .fd-vlt-nav[data-open] {
  background: rgba(255,255,255,0.86); border-bottom-color: var(--fd-vlt-line);
  -webkit-backdrop-filter: saturate(180%) blur(16px); backdrop-filter: saturate(180%) blur(16px);
}
.fd-vlt-nav-in {
  display: flex; align-items: center; gap: 32px; max-width: 1280px; margin: 0 auto; padding: 0 32px;
  height: var(--fd-vlt-nav-h); transition: height var(--fd-dur-3) var(--fd-ease-out);
}
.fd-vlt-nav[data-condensed] .fd-vlt-nav-in { height: 52px; }
.fd-vlt-brand { display: inline-flex; align-items: center; gap: 10px; font: 600 1.0625rem/1 var(--fd-vlt-sans); letter-spacing: -0.02em; color: var(--fd-vlt-ink); }
.fd-vlt-nav-links { display: flex; gap: 28px; margin-right: auto; }
.fd-vlt-nav-links a, .fd-vlt-nav-signin { font: 450 0.875rem/1 var(--fd-vlt-sans); color: var(--fd-vlt-mute); transition: color var(--fd-dur-1) linear; }
.fd-vlt-nav-links a:hover, .fd-vlt-nav-signin:hover { color: var(--fd-vlt-ink); }
.fd-vlt-nav-cta { display: flex; align-items: center; gap: 18px; margin-left: auto; }
.fd-vlt-burger { display: none; width: 40px; height: 40px; position: relative; }
.fd-vlt-burger span { position: absolute; left: 11px; right: 11px; height: 1.5px; background: var(--fd-vlt-ink); transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-vlt-burger span:first-child { top: 16px; }
.fd-vlt-burger span:last-child { top: 23px; }
.fd-vlt-nav[data-open] .fd-vlt-burger span:first-child { transform: translateY(3.5px) rotate(45deg); }
.fd-vlt-nav[data-open] .fd-vlt-burger span:last-child { transform: translateY(-3.5px) rotate(-45deg); }
.fd-vlt-sheet { display: grid; gap: 4px; padding: 8px 20px 20px; border-top: 1px solid var(--fd-vlt-line); }
.fd-vlt-sheet[hidden] { display: none; }
.fd-vlt-sheet a:not(.fd-vlt-btn) { display: block; padding: 14px 0; border-bottom: 1px solid var(--fd-vlt-line); font: 500 1.25rem/1.2 var(--fd-vlt-sans); letter-spacing: -0.02em; }
.fd-vlt-sheet .fd-vlt-btn { margin-top: 14px; justify-content: center; }

/* hero */
.fd-vlt-hero { padding: 72px 0 0; margin-top: calc(var(--fd-vlt-nav-h) * -1); padding-top: calc(var(--fd-vlt-nav-h) + 72px); min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
.fd-vlt-hero-in { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: 48px; align-items: center; }
.fd-vlt-eyebrow { display: inline-flex; align-items: center; gap: 12px; font: 500 0.875rem/1.3 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-h1 { margin-top: 28px; font: 600 clamp(3.25rem, 8.4vw, 7.75rem)/0.92 var(--fd-vlt-sans); letter-spacing: -0.055em; color: var(--fd-vlt-ink); }
.fd-vlt-mask { display: block; overflow: hidden; padding-bottom: 0.06em; margin-bottom: -0.06em; }
.fd-vlt-mask > span { display: block; animation: fd-vlt-mask var(--fd-dur-4) var(--fd-ease-out) both; animation-delay: var(--d, 0ms); animation-duration: 1000ms; }
.fd-vlt-dot { color: var(--fd-vlt-mute); }
@keyframes fd-vlt-mask { from { transform: translateY(105%); } to { transform: none; } }
.fd-vlt-rise { animation: fd-vlt-rise 900ms var(--fd-ease-out) both; animation-delay: var(--d, 0ms); }
@keyframes fd-vlt-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
.fd-vlt-lede { margin-top: 28px; max-width: 34em; font: 400 clamp(1.0625rem, 1.4vw, 1.25rem)/1.5 var(--fd-vlt-sans); letter-spacing: -0.012em; color: var(--fd-vlt-mute); }
.fd-vlt-ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 36px; }
.fd-vlt-fine { margin-top: 18px; font: 400 0.8125rem/1.4 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-hero-card { justify-self: end; width: 100%; max-width: 440px; }
.fd-vlt-ticker { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 88px; border-top: 1px solid var(--fd-vlt-ink); }
.fd-vlt-ticker > div { padding: 18px 20px 28px 0; border-right: 1px solid var(--fd-vlt-line); }
.fd-vlt-ticker > div + div { padding-left: 20px; }
.fd-vlt-ticker > div:last-child { border-right: 0; }
.fd-vlt-ticker dt { font: 600 1.5rem/1.1 var(--fd-vlt-sans); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.fd-vlt-ticker dd { margin-top: 6px; font: 400 0.8125rem/1.4 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-reg { position: absolute; width: 18px; height: 18px; pointer-events: none; }
.fd-vlt-reg::before, .fd-vlt-reg::after { content: ""; position: absolute; background: var(--fd-vlt-ink); }
.fd-vlt-reg::before { left: 8.5px; top: 0; width: 1px; height: 18px; }
.fd-vlt-reg::after { top: 8.5px; left: 0; height: 1px; width: 18px; }
.fd-vlt-reg-tl { top: calc(var(--fd-vlt-nav-h) + 24px); left: 24px; }
.fd-vlt-reg-tr { top: calc(var(--fd-vlt-nav-h) + 24px); right: 24px; }
.fd-vlt-spec { position: absolute; right: 32px; bottom: 16px; font: 500 0.625rem/1 var(--fd-vlt-mono); letter-spacing: 0.12em; color: var(--fd-vlt-mute); }

/* balance card */
.fd-vlt-card-wrap { position: relative; perspective: 1100px; padding: 28px 0 32px; }
.fd-vlt-fig { position: absolute; top: 0; left: 0; font: 500 0.6875rem/1 var(--fd-vlt-mono); letter-spacing: 0.06em; color: var(--fd-vlt-mute); }
.fd-vlt-fig-b { top: auto; bottom: -28px; }
.fd-vlt-card {
  --rx: 0deg; --ry: 0deg; --gx: 50%; --gy: 30%;
  position: relative; overflow: hidden; padding: 26px 26px 10px;
  background: var(--fd-vlt-paper); color: var(--fd-vlt-ink); border: 1px solid var(--fd-vlt-ink);
  box-shadow: 14px 14px 0 -1px var(--fd-vlt-canvas), 14px 14px 0 0 var(--fd-vlt-line-2);
  transform: rotateX(var(--rx)) rotateY(var(--ry)); transform-style: preserve-3d; will-change: transform;
}
.fd-vlt-card-glare { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(420px circle at var(--gx) var(--gy), rgba(11,11,12,0.05), transparent 60%); }
.fd-vlt-card-top { display: flex; justify-content: space-between; align-items: center; color: var(--fd-vlt-mute); }
.fd-vlt-live { display: inline-flex; align-items: center; gap: 6px; font: 500 0.6875rem/1 var(--fd-vlt-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--fd-vlt-ink); }
.fd-vlt-live i { width: 6px; height: 6px; border-radius: 50%; background: var(--fd-vlt-ink); animation: fd-vlt-pulse 1.6s var(--fd-ease-in-out) infinite; }
@keyframes fd-vlt-pulse { 50% { opacity: 0.25; } }
.fd-vlt-card-bal { display: flex; align-items: flex-start; gap: 4px; margin-top: 22px; font: 600 clamp(2rem, 3.3vw, 2.75rem)/1.1 var(--fd-vlt-sans); letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
.fd-vlt-card-cur { font-size: 0.55em; margin-top: 0.18em; color: var(--fd-vlt-mute); letter-spacing: 0; }
.fd-vlt-card-meta { display: flex; gap: 18px; margin-top: 10px; font: 500 0.6875rem/1.3 var(--fd-vlt-mono); letter-spacing: 0.04em; color: var(--fd-vlt-mute); }
.fd-vlt-spark { width: 100%; height: 64px; margin-top: 20px; color: var(--fd-vlt-ink); }
.fd-vlt-txns { margin-top: 14px; border-top: 1px solid var(--fd-vlt-line); }
.fd-vlt-txn { display: grid; grid-template-columns: 10px 1fr auto; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--fd-vlt-line); animation: fd-vlt-txn 600ms var(--fd-ease-out) both; }
.fd-vlt-txn:last-child { border-bottom: 0; }
@keyframes fd-vlt-txn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
.fd-vlt-txn-dot { width: 7px; height: 7px; border: 1px solid var(--fd-vlt-ink); }
.fd-vlt-txn-dot[data-in] { background: var(--fd-vlt-ink); }
.fd-vlt-txn-who { display: grid; gap: 2px; min-width: 0; }
.fd-vlt-txn-who b { font: 500 0.875rem/1.2 var(--fd-vlt-sans); letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fd-vlt-txn-who small { font: 400 0.75rem/1.2 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-txn-amt { font: 500 0.875rem/1 var(--fd-vlt-sans); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.fd-vlt-dim { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 8px; font: 500 0.625rem/1 var(--fd-vlt-mono); letter-spacing: 0.1em; color: var(--fd-vlt-mute); }
.fd-vlt-dim i { flex: 1; height: 7px; border-left: 1px solid var(--fd-vlt-line-2); border-right: 1px solid var(--fd-vlt-line-2); position: relative; }
.fd-vlt-dim i::after { content: ""; position: absolute; left: 0; right: 0; top: 3px; height: 1px; background: var(--fd-vlt-line-2); }
.fd-vlt-dim i:first-child { border-right: 0; }
.fd-vlt-dim i:last-child { border-left: 0; }

/* odometer */
.fd-vlt-odo { position: relative; display: inline-flex; overflow: hidden; line-height: 1.1; height: 1.1em; }
.fd-vlt-odo-col { display: inline-block; height: 1.1em; overflow: hidden; }
.fd-vlt-odo-strip { display: flex; flex-direction: column; transition: transform 900ms var(--fd-ease-out); will-change: transform; }
.fd-vlt-odo-strip > span { display: block; height: 1.1em; line-height: 1.1em; text-align: center; }
.fd-vlt-odo-sep { display: inline-block; }

/* logos */
.fd-vlt-logos { padding: 64px 0 72px; border-bottom: 1px solid var(--fd-vlt-line); }
.fd-vlt-logo-row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 28px 40px; margin-top: 28px; color: var(--fd-vlt-ink); }
.fd-vlt-logo-row li { opacity: 0.86; font-size: 1.375rem; line-height: 1; }
.fd-vlt-wm-1 { font: 700 1.375rem/1 var(--fd-vlt-sans); letter-spacing: -0.04em; }
.fd-vlt-wm-2 { font: 500 1.0625rem/1 var(--fd-vlt-sans); letter-spacing: 0.32em; }
.fd-vlt-wm-3 { font: 300 1.5rem/1 var(--fd-vlt-sans); letter-spacing: -0.02em; }
.fd-vlt-wm-4 { font: italic 600 1.375rem/1 Georgia, "Times New Roman", serif; letter-spacing: -0.01em; }
.fd-vlt-wm-5 { font: 600 1rem/1 var(--fd-vlt-mono); letter-spacing: 0.04em; }
.fd-vlt-wm-6 { font: 500 1.1875rem/1 var(--fd-vlt-sans); letter-spacing: -0.03em; }
.fd-vlt-wm-7 { font: 800 1.625rem/1 var(--fd-vlt-sans); letter-spacing: -0.06em; }

/* platform */
.fd-vlt-plat { position: relative; height: 340vh; background: var(--fd-vlt-canvas); border-bottom: 1px solid var(--fd-vlt-line); --p: 0; }
.fd-vlt-plat-stick { position: sticky; top: 0; height: 100vh; display: flex; align-items: center; overflow: hidden; }
.fd-vlt-plat-grid { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 64px; align-items: center; }
.fd-vlt-steps { margin-top: 36px; border-top: 1px solid var(--fd-vlt-line-2); }
.fd-vlt-steps li { display: grid; grid-template-columns: 40px 1fr; gap: 12px; padding: 16px 0; border-bottom: 1px solid var(--fd-vlt-line); opacity: 0.38; transition: opacity var(--fd-dur-3) var(--fd-ease-out); }
.fd-vlt-steps li[data-active] { opacity: 1; }
.fd-vlt-step-k { font: 500 0.75rem/1.6 var(--fd-vlt-mono); color: var(--fd-vlt-mute); }
.fd-vlt-steps h3 { font: 600 1.0625rem/1.3 var(--fd-vlt-sans); letter-spacing: -0.015em; }
.fd-vlt-steps p { margin-top: 6px; font: 400 0.9375rem/1.5 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-plat-bar { display: flex; align-items: center; gap: 12px; margin-top: 24px; }
.fd-vlt-plat-bar i { position: relative; flex: 1; height: 1px; background: var(--fd-vlt-line-2); overflow: hidden; }
.fd-vlt-plat-bar i::after { content: ""; position: absolute; inset: 0; background: var(--fd-vlt-ink); transform-origin: left; transform: scaleX(var(--p)); }
.fd-vlt-plat-bar span { font: 500 0.6875rem/1 var(--fd-vlt-mono); font-variant-numeric: tabular-nums; color: var(--fd-vlt-mute); }

.fd-vlt-dash-wrap { position: relative; }
.fd-vlt-dash { background: var(--fd-vlt-paper); border: 1px solid var(--fd-vlt-ink); box-shadow: 18px 18px 0 -1px var(--fd-vlt-paper), 18px 18px 0 0 var(--fd-vlt-line-2); }
.fd-vlt-dash-chrome { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-bottom: 1px solid var(--fd-vlt-line); }
.fd-vlt-dash-chrome span { width: 8px; height: 8px; border: 1px solid var(--fd-vlt-line-2); border-radius: 50%; }
.fd-vlt-dash-chrome em { margin-left: 12px; font: 500 0.6875rem/1 var(--fd-vlt-mono); font-style: normal; color: var(--fd-vlt-mute); letter-spacing: 0.02em; }
.fd-vlt-dash-body {
  position: relative; display: grid; gap: 10px; padding: 12px; height: 470px;
  grid-template-columns: 150px repeat(6, minmax(0, 1fr));
  grid-template-rows: 1.05fr 1fr 1fr;
  grid-template-areas:
    "side bal bal bal flow flow flow"
    "side card card txns txns txns txns"
    "side appr appr txns txns txns txns";
}
.fd-vlt-slot-side { grid-area: side; }
.fd-vlt-slot-bal { grid-area: bal; }
.fd-vlt-slot-flow { grid-area: flow; }
.fd-vlt-slot-card { grid-area: card; }
.fd-vlt-slot-txns { grid-area: txns; }
.fd-vlt-dash-body > .fd-vlt-slot-appr { grid-area: appr; }
.fd-vlt-slot { border: 1px dashed var(--fd-vlt-line-2); display: flex; align-items: flex-start; justify-content: flex-start; padding: 8px; }
.fd-vlt-slot span { font: 500 0.625rem/1 var(--fd-vlt-mono); color: var(--fd-vlt-mute); letter-spacing: 0.1em; }
.fd-vlt-piece {
  --t: 0; --dx: 0px; --dy: 0px; position: relative; z-index: 1; min-width: 0; min-height: 0;
  opacity: var(--t);
  transform: translate3d(calc(var(--dx) * (1 - var(--t))), calc(var(--dy) * (1 - var(--t))), 0) scale(calc(0.94 + 0.06 * var(--t)));
  will-change: transform, opacity;
}
.fd-vlt-piece > * { height: 100%; }
.fd-vlt-tile { display: flex; flex-direction: column; gap: 6px; height: 100%; padding: 12px 14px; background: var(--fd-vlt-paper); border: 1px solid var(--fd-vlt-ink); overflow: hidden; }
.fd-vlt-tile small { font: 500 0.625rem/1.2 var(--fd-vlt-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--fd-vlt-mute); }
.fd-vlt-tile strong { font: 600 1.5rem/1.1 var(--fd-vlt-sans); letter-spacing: -0.035em; font-variant-numeric: tabular-nums; }
.fd-vlt-delta { font: 500 0.75rem/1 var(--fd-vlt-sans); color: var(--fd-vlt-ink); }
.fd-vlt-split { display: flex; gap: 2px; height: 8px; margin-top: auto; }
.fd-vlt-split i { display: block; height: 100%; background: var(--fd-vlt-ink); }
.fd-vlt-split i:nth-child(2) { opacity: 0.6; }
.fd-vlt-split i:nth-child(3) { opacity: 0.35; }
.fd-vlt-split i:nth-child(4) { opacity: 0.16; }
.fd-vlt-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; font: 400 0.625rem/1.2 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-bars { flex: 1; display: flex; align-items: flex-end; gap: 5px; min-height: 0; padding-top: 6px; }
.fd-vlt-bars span { flex: 1; display: flex; align-items: flex-end; gap: 1px; height: 100%; }
.fd-vlt-bars i { flex: 1; display: block; background: var(--fd-vlt-ink); }
.fd-vlt-bars i + i { background: transparent; border: 1px solid var(--fd-vlt-ink); }
.fd-vlt-runway { font: 500 0.6875rem/1 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-side { display: flex; flex-direction: column; gap: 2px; height: 100%; padding: 10px; border: 1px solid var(--fd-vlt-ink); background: var(--fd-vlt-paper); }
.fd-vlt-side b { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; font: 600 0.75rem/1.2 var(--fd-vlt-sans); letter-spacing: -0.01em; }
.fd-vlt-side b svg { width: 14px; height: 14px; }
.fd-vlt-side span { padding: 7px 8px; font: 450 0.75rem/1 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-side span[data-on] { background: var(--fd-vlt-ink); color: var(--fd-vlt-paper); }
.fd-vlt-mini-card { position: relative; display: flex; flex-direction: column; justify-content: space-between; height: 100%; padding: 12px; background: var(--fd-vlt-ink); color: var(--fd-vlt-paper); overflow: hidden; }
.fd-vlt-mini-card > div:first-child { display: flex; justify-content: space-between; align-items: center; font: 500 0.625rem/1 var(--fd-vlt-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--fd-vlt-mute-dark); }
.fd-vlt-mini-card svg { width: 16px; height: 16px; color: #fff; }
.fd-vlt-mini-pan { font: 500 0.75rem/1 var(--fd-vlt-mono); letter-spacing: 0.04em; white-space: nowrap; overflow: hidden; text-overflow: clip; }
.fd-vlt-mini-foot { display: flex; justify-content: space-between; font: 400 0.6875rem/1.2 var(--fd-vlt-sans); color: var(--fd-vlt-mute-dark); }
.fd-vlt-mini-meter { display: block; height: 2px; background: rgba(255,255,255,0.18); position: relative; }
.fd-vlt-mini-meter::after { content: ""; position: absolute; inset: 0; background: #fff; transform-origin: left; transform: scaleX(var(--m)); }
.fd-vlt-table { gap: 0; }
.fd-vlt-table small { margin-bottom: 6px; }
.fd-vlt-row { display: grid; grid-template-columns: 48px 1fr 0.8fr auto; gap: 8px; padding: 8px 0; border-top: 1px solid var(--fd-vlt-line); font: 400 0.75rem/1.2 var(--fd-vlt-sans); }
.fd-vlt-row span:first-child, .fd-vlt-row span:nth-child(3) { color: var(--fd-vlt-mute); }
.fd-vlt-row span:last-child { font-variant-numeric: tabular-nums; font-weight: 500; text-align: right; }
.fd-vlt-appr strong { font-size: 1.125rem; }
.fd-vlt-appr > span { font: 400 0.6875rem/1.2 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-appr-btns { display: flex; gap: 6px; margin-top: auto; }
.fd-vlt-appr-btns span { padding: 6px 8px; border: 1px solid var(--fd-vlt-ink); font: 500 0.625rem/1 var(--fd-vlt-sans); }
.fd-vlt-appr-btns span:last-child { background: var(--fd-vlt-ink); color: var(--fd-vlt-paper); }

/* capabilities */
.fd-vlt-caps { position: relative; height: 300vh; background: var(--fd-vlt-ink); color: var(--fd-vlt-paper); --p: 0; }
.fd-vlt-caps-stick { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; justify-content: center; gap: 40px; overflow: hidden; }
.fd-vlt-caps-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
.fd-vlt-caps-count { font: 500 0.875rem/1 var(--fd-vlt-mono); color: var(--fd-vlt-mute-dark); font-variant-numeric: tabular-nums; }
.fd-vlt-caps-count span { color: var(--fd-vlt-paper); }
.fd-vlt-caps-track {
  --x: 0px; display: flex; gap: 20px; width: 100%; overflow: visible;
  padding: 0 max(32px, calc((100% - 1280px) / 2 + 32px));
  transform: translate3d(var(--x), 0, 0); will-change: transform; outline-offset: -2px;
}
.fd-vlt-cap {
  flex: 0 0 min(400px, 80vw); display: flex; flex-direction: column; min-height: min(500px, 58vh); padding: 22px;
  border: 1px solid var(--fd-vlt-line-dark); background: var(--fd-vlt-ink-2);
  transition: border-color var(--fd-dur-2) var(--fd-ease-out), background-color var(--fd-dur-2) var(--fd-ease-out);
}
.fd-vlt-cap:hover { border-color: rgba(255,255,255,0.4); background: #222226; }
.fd-vlt-cap-top { display: flex; justify-content: space-between; color: var(--fd-vlt-mute-dark); }
.fd-vlt-cap-art { flex: 1; display: grid; place-items: center; min-height: 120px; padding: 18px 0; color: var(--fd-vlt-paper); }
.fd-vlt-cap-art svg { width: 78%; max-width: 240px; height: auto; }
.fd-vlt-cap-art svg rect[fill="#fff"], .fd-vlt-cap-art svg circle[fill="#fff"] { fill: var(--fd-vlt-ink-2); }
.fd-vlt-cap-art svg [stroke="#fff"] { stroke: var(--fd-vlt-ink); }
.fd-vlt-cap h3 { font: 600 1.625rem/1.1 var(--fd-vlt-sans); letter-spacing: -0.03em; }
.fd-vlt-cap p { margin-top: 10px; font: 400 0.9375rem/1.5 var(--fd-vlt-sans); color: var(--fd-vlt-mute-dark); }
.fd-vlt-cap dl { margin-top: 20px; border-top: 1px solid var(--fd-vlt-line-dark); }
.fd-vlt-cap dl div { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--fd-vlt-line-dark); font: 400 0.8125rem/1.2 var(--fd-vlt-sans); }
.fd-vlt-cap dt { color: var(--fd-vlt-mute-dark); }
.fd-vlt-cap dd { font-variant-numeric: tabular-nums; }
.fd-vlt-cap-end { flex: 0 0 1px; }
.fd-vlt-caps-progress { position: relative; height: 1px; background: var(--fd-vlt-line-dark); }
.fd-vlt-caps-progress i { position: absolute; inset: 0; background: var(--fd-vlt-paper); transform-origin: left; transform: scaleX(var(--p)); }

/* stats */
.fd-vlt-stats { padding: 140px 0 120px; }
.fd-vlt-stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 64px; border-top: 1px solid var(--fd-vlt-ink); }
.fd-vlt-stat { display: flex; flex-direction: column; gap: 14px; padding: 18px 24px 8px 0; border-right: 1px solid var(--fd-vlt-line); }
.fd-vlt-stat + .fd-vlt-stat { padding-left: 24px; }
.fd-vlt-stat:last-child { border-right: 0; }
.fd-vlt-stat .fd-vlt-mono { color: var(--fd-vlt-mute); }
.fd-vlt-count { font: 600 clamp(2.5rem, 4.6vw, 4.25rem)/1 var(--fd-vlt-sans); letter-spacing: -0.05em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fd-vlt-stat p { max-width: 22em; font: 400 0.9375rem/1.45 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-footnote { margin-top: 40px; font: 400 0.75rem/1.4 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }

/* security */
.fd-vlt-sec { padding: 120px 0 0; background: var(--fd-vlt-canvas); border-top: 1px solid var(--fd-vlt-line); overflow: hidden; }
.fd-vlt-sec-grid { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 64px; }
.fd-vlt-sec-cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; border-top: 1px solid var(--fd-vlt-ink); }
.fd-vlt-sec-col { padding: 18px 20px 0 0; }
.fd-vlt-sec-col + .fd-vlt-sec-col { padding-left: 20px; border-left: 1px solid var(--fd-vlt-line); }
.fd-vlt-sec-col .fd-vlt-mono { color: var(--fd-vlt-mute); }
.fd-vlt-sec-col h3 { margin-top: 28px; font: 600 1.25rem/1.2 var(--fd-vlt-sans); letter-spacing: -0.02em; }
.fd-vlt-sec-col p { margin-top: 10px; font: 400 0.9375rem/1.5 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-marquee { margin-top: 96px; border-top: 1px solid var(--fd-vlt-line); }
.fd-vlt-marquee-row { overflow: hidden; border-bottom: 1px solid var(--fd-vlt-line); -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); }
.fd-vlt-marquee-track { display: flex; width: max-content; animation: fd-vlt-marquee 48s linear infinite; }
.fd-vlt-marquee-row[data-dir="rev"] .fd-vlt-marquee-track { animation-direction: reverse; animation-duration: 56s; }
.fd-vlt-marquee:hover .fd-vlt-marquee-track { animation-play-state: paused; }
.fd-vlt-marquee-track li { display: inline-flex; align-items: center; gap: 10px; padding: 20px 32px; border-right: 1px solid var(--fd-vlt-line); font: 500 0.8125rem/1 var(--fd-vlt-mono); letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
@keyframes fd-vlt-marquee { to { transform: translateX(-50%); } }

/* testimonial */
.fd-vlt-quote { padding: 140px 0; }
.fd-vlt-quote-grid { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 24px 48px; }
.fd-vlt-quote figure { grid-column: 2; }
.fd-vlt-quote blockquote { font: 500 clamp(1.625rem, 3.1vw, 2.75rem)/1.15 var(--fd-vlt-sans); letter-spacing: -0.03em; text-indent: -0.42em; }
.fd-vlt-quote figcaption { display: flex; align-items: center; gap: 14px; margin-top: 36px; }
.fd-vlt-avatar { display: block; width: 44px; height: 44px; object-fit: cover; object-position: center top; background: var(--fd-vlt-ink); }
.fd-vlt-quote figcaption b { display: block; font: 600 0.9375rem/1.3 var(--fd-vlt-sans); }
.fd-vlt-quote figcaption small { display: block; font: 400 0.8125rem/1.3 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-quote-stats { grid-column: 2; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 56px; border-top: 1px solid var(--fd-vlt-ink); }
.fd-vlt-quote-stats div { padding: 16px 16px 0 0; }
.fd-vlt-quote-stats div + div { padding-left: 16px; border-left: 1px solid var(--fd-vlt-line); }
.fd-vlt-quote-stats dt { font: 600 1.75rem/1.1 var(--fd-vlt-sans); letter-spacing: -0.035em; }
.fd-vlt-quote-stats dd { margin-top: 4px; font: 400 0.8125rem/1.4 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }

/* pricing */
.fd-vlt-pricing { padding: 120px 0 140px; border-top: 1px solid var(--fd-vlt-line); }
.fd-vlt-pricing-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap; }
.fd-vlt-seg { position: relative; display: inline-grid; grid-template-columns: 1fr 1fr; padding: 4px; border: 1px solid var(--fd-vlt-ink); background: var(--fd-vlt-paper); }
.fd-vlt-seg button { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 38px; padding: 0 18px; font: 500 0.875rem/1 var(--fd-vlt-sans); color: var(--fd-vlt-ink); transition: color var(--fd-dur-2) var(--fd-ease-out); }
.fd-vlt-seg button[aria-checked="true"] { color: var(--fd-vlt-paper); }
.fd-vlt-seg-thumb { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px); background: var(--fd-vlt-ink); transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-vlt-seg[data-annual] .fd-vlt-seg-thumb { transform: translateX(100%); }
.fd-vlt-save { font: 600 0.6875rem/1 var(--fd-vlt-mono); opacity: 0.75; }
.fd-vlt-plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 56px; border: 1px solid var(--fd-vlt-ink); }
.fd-vlt-plan { display: flex; flex-direction: column; padding: 28px; background: var(--fd-vlt-paper); }
.fd-vlt-plan + .fd-vlt-plan { border-left: 1px solid var(--fd-vlt-ink); }
.fd-vlt-plan[data-featured] { background: var(--fd-vlt-ink); color: var(--fd-vlt-paper); }
.fd-vlt-plan-top { display: flex; justify-content: space-between; align-items: center; }
.fd-vlt-plan h3 { font: 600 1.25rem/1.2 var(--fd-vlt-sans); letter-spacing: -0.02em; }
.fd-vlt-plan-who { margin-top: 6px; font: 400 0.875rem/1.4 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-plan[data-featured] .fd-vlt-plan-who, .fd-vlt-plan[data-featured] .fd-vlt-plan-bill, .fd-vlt-plan[data-featured] .fd-vlt-price-per, .fd-vlt-plan[data-featured] .fd-vlt-price-cur { color: var(--fd-vlt-mute-dark); }
.fd-vlt-price { display: flex; align-items: flex-start; gap: 4px; margin-top: 36px; font: 600 3.5rem/1.1 var(--fd-vlt-sans); letter-spacing: -0.05em; font-variant-numeric: tabular-nums; }
.fd-vlt-price-cur { font-size: 0.42em; margin-top: 0.3em; color: var(--fd-vlt-mute); letter-spacing: 0; }
.fd-vlt-price-per { align-self: flex-end; margin-bottom: 0.4em; font: 400 0.9375rem/1 var(--fd-vlt-sans); letter-spacing: 0; color: var(--fd-vlt-mute); }
.fd-vlt-plan-bill { margin-top: 6px; font: 400 0.8125rem/1.3 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }
.fd-vlt-plan .fd-vlt-btn { justify-content: space-between; margin-top: 28px; }
.fd-vlt-plan ul { margin-top: 28px; border-top: 1px solid var(--fd-vlt-line); }
.fd-vlt-plan[data-featured] ul { border-top-color: var(--fd-vlt-line-dark); }
.fd-vlt-plan li { display: flex; gap: 10px; align-items: flex-start; padding: 11px 0; border-bottom: 1px solid var(--fd-vlt-line); font: 400 0.875rem/1.4 var(--fd-vlt-sans); }
.fd-vlt-plan[data-featured] li { border-bottom-color: var(--fd-vlt-line-dark); }
.fd-vlt-check { flex: none; margin-top: 2px; }

/* faq */
.fd-vlt-faq { padding: 120px 0 140px; background: var(--fd-vlt-canvas); border-top: 1px solid var(--fd-vlt-line); }
.fd-vlt-faq-grid { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 64px; align-items: start; }
.fd-vlt-faq-list { border-top: 1px solid var(--fd-vlt-ink); }
.fd-vlt-faq-item { border-bottom: 1px solid var(--fd-vlt-line-2); }
.fd-vlt-faq-item button { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 24px; padding: 24px 0; font: 500 1.1875rem/1.3 var(--fd-vlt-sans); letter-spacing: -0.02em; color: var(--fd-vlt-ink); }
.fd-vlt-faq-item button i { position: relative; flex: none; width: 14px; height: 14px; }
.fd-vlt-faq-item button i::before, .fd-vlt-faq-item button i::after { content: ""; position: absolute; left: 0; right: 0; top: 6.5px; height: 1.5px; background: currentColor; transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-vlt-faq-item button i::after { transform: rotate(90deg); }
.fd-vlt-faq-item[data-open] button i::after { transform: rotate(0deg); }
.fd-vlt-faq-a { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--fd-dur-3) var(--fd-ease-out); }
.fd-vlt-faq-item[data-open] .fd-vlt-faq-a { grid-template-rows: 1fr; }
.fd-vlt-faq-a > div { overflow: hidden; }
.fd-vlt-faq-a p { max-width: 40em; padding-bottom: 24px; font: 400 1rem/1.6 var(--fd-vlt-sans); color: var(--fd-vlt-mute); }

/* cta */
.fd-vlt-cta { padding: 160px 0 170px; background: var(--fd-vlt-ink); color: var(--fd-vlt-paper); }
.fd-vlt-cta-in { display: flex; flex-direction: column; align-items: flex-start; }
.fd-vlt-cta-h { margin-top: 24px; font: 600 clamp(3.5rem, 11vw, 10rem)/0.9 var(--fd-vlt-sans); letter-spacing: -0.06em; }
.fd-vlt-cta-p { margin-top: 28px; max-width: 30em; font: 400 1.1875rem/1.5 var(--fd-vlt-sans); color: var(--fd-vlt-mute-dark); }

/* footer */
.fd-vlt-foot { position: relative; padding: 72px 0 0; background: var(--fd-vlt-ink); color: var(--fd-vlt-paper); border-top: 1px solid var(--fd-vlt-line-dark); overflow: hidden; }
.fd-vlt-foot .fd-vlt-brand { color: var(--fd-vlt-paper); align-self: start; }
.fd-vlt-foot-top { display: grid; grid-template-columns: 1.4fr repeat(4, minmax(0, 1fr)); gap: 32px; }
.fd-vlt-foot-col h4 { font: 500 0.6875rem/1 var(--fd-vlt-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--fd-vlt-mute-dark); }
.fd-vlt-foot-col ul { display: grid; gap: 10px; margin-top: 18px; }
.fd-vlt-foot-col a { font: 400 0.875rem/1.3 var(--fd-vlt-sans); color: #d4d4d8; transition: color var(--fd-dur-1) linear; }
.fd-vlt-foot-col a:hover { color: #fff; }
.fd-vlt-legal { margin-top: 64px; max-width: 72em; font: 400 0.75rem/1.6 var(--fd-vlt-sans); color: var(--fd-vlt-mute-dark); }
.fd-vlt-foot-bot { display: flex; flex-wrap: wrap; gap: 12px 32px; justify-content: space-between; margin-top: 32px; padding: 20px 0; border-top: 1px solid var(--fd-vlt-line-dark); font: 400 0.8125rem/1.3 var(--fd-vlt-sans); color: var(--fd-vlt-mute-dark); }
.fd-vlt-giant { margin-top: 24px; padding: 0 16px; font: 700 clamp(6rem, 27vw, 24rem)/0.74 var(--fd-vlt-sans); letter-spacing: -0.07em; color: transparent; -webkit-text-stroke: 1px rgba(255,255,255,0.22); text-align: center; white-space: nowrap; user-select: none; transform: translateY(6%); }

/* reveal */
.fd-vlt[data-js] [data-reveal] {
  opacity: 0; transform: translateY(22px);
  transition: opacity var(--fd-dur-4) var(--fd-ease-out), transform 900ms var(--fd-ease-out);
  transition-delay: calc(var(--i, 0) * 70ms);
}
.fd-vlt[data-js] [data-reveal][data-in] { opacity: 1; transform: none; }

/* responsive */
@media (max-width: 1080px) {
  .fd-vlt-nav-links { gap: 20px; }
  .fd-vlt-plat-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 40px; }
  .fd-vlt-dash-body { grid-template-columns: 110px repeat(6, minmax(0, 1fr)); }
  .fd-vlt-foot-top { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .fd-vlt-foot-top > .fd-vlt-brand { grid-column: 1 / -1; }
}
@media (max-width: 900px) {
  .fd-vlt-wrap, .fd-vlt-nav-in { padding: 0 20px; }
  .fd-vlt-nav-links, .fd-vlt-nav-signin { display: none; }
  .fd-vlt-burger { display: block; }
  .fd-vlt-hero { min-height: 0; padding-top: calc(var(--fd-vlt-nav-h) + 40px); }
  .fd-vlt-hero-in { grid-template-columns: 1fr; gap: 56px; }
  .fd-vlt-hero-card { justify-self: stretch; max-width: 520px; }
  .fd-vlt-ticker { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 64px; }
  .fd-vlt-ticker > div:nth-child(2) { border-right: 0; }
  .fd-vlt-ticker > div:nth-child(3) { padding-left: 0; border-top: 1px solid var(--fd-vlt-line); }
  .fd-vlt-ticker > div:nth-child(4) { border-top: 1px solid var(--fd-vlt-line); }
  .fd-vlt-spec, .fd-vlt-reg { display: none; }
  .fd-vlt-plat { height: auto; padding: 96px 0; }
  .fd-vlt-plat-stick { position: relative; height: auto; overflow: visible; }
  .fd-vlt-plat-grid { grid-template-columns: 1fr; gap: 40px; }
  .fd-vlt-steps li { opacity: 1; }
  .fd-vlt-plat-bar { display: none; }
  .fd-vlt-dash-body {
    height: auto; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: none; grid-auto-rows: minmax(130px, auto);
    grid-template-areas: "bal bal" "flow flow" "card appr" "txns txns";
  }
  .fd-vlt-slot-side { display: none; }
  .fd-vlt-slot-flow { min-height: 170px; }
  .fd-vlt-sec-grid, .fd-vlt-faq-grid { grid-template-columns: 1fr; gap: 40px; }
  .fd-vlt-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fd-vlt-stat:nth-child(2) { border-right: 0; }
  .fd-vlt-stat:nth-child(3) { padding-left: 0; }
  .fd-vlt-stat:nth-child(n + 3) { border-top: 1px solid var(--fd-vlt-line); padding-top: 18px; margin-top: 18px; }
  .fd-vlt-quote-grid { grid-template-columns: 1fr; }
  .fd-vlt-quote figure, .fd-vlt-quote-stats { grid-column: 1; }
  .fd-vlt-plans { grid-template-columns: 1fr; }
  .fd-vlt-plan + .fd-vlt-plan { border-left: 0; border-top: 1px solid var(--fd-vlt-ink); }
}
@media (max-width: 640px) {
  .fd-vlt-stats, .fd-vlt-quote, .fd-vlt-pricing, .fd-vlt-faq { padding: 88px 0; }
  .fd-vlt-sec { padding-top: 88px; }
  .fd-vlt-cta { padding: 112px 0; }
  .fd-vlt-btn { height: 46px; }
  .fd-vlt-nav-cta .fd-vlt-btn-sm { display: none; }
  .fd-vlt-sec-cols { grid-template-columns: 1fr; }
  .fd-vlt-sec-col + .fd-vlt-sec-col { padding-left: 0; border-left: 0; border-top: 1px solid var(--fd-vlt-line); margin-top: 24px; }
  .fd-vlt-sec-col h3 { margin-top: 12px; }
  .fd-vlt-stats-grid { grid-template-columns: 1fr; }
  .fd-vlt-stat, .fd-vlt-stat + .fd-vlt-stat { padding-left: 0; border-right: 0; }
  .fd-vlt-stat + .fd-vlt-stat { border-top: 1px solid var(--fd-vlt-line); padding-top: 18px; margin-top: 18px; }
  .fd-vlt-quote-stats { grid-template-columns: 1fr; }
  .fd-vlt-quote-stats div + div { padding-left: 0; border-left: 0; border-top: 1px solid var(--fd-vlt-line); margin-top: 16px; }
  .fd-vlt-quote blockquote { text-indent: 0; }
  .fd-vlt-foot-top { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fd-vlt-card { padding: 20px 18px 6px; }
  .fd-vlt-card-meta { flex-direction: column; gap: 4px; }
  .fd-vlt-row { grid-template-columns: 40px 1fr auto; }
  .fd-vlt-row span:nth-child(3) { display: none; }
  .fd-vlt-caps-head { flex-direction: column; align-items: flex-start; }
  .fd-vlt-caps-stick { gap: 28px; }
  .fd-vlt-cap { min-height: min(460px, 62vh); }
  .fd-vlt-marquee { margin-top: 64px; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-vlt *, .fd-vlt *::before, .fd-vlt *::after { animation: none !important; }
  .fd-vlt-odo-strip, .fd-vlt-seg-thumb, .fd-vlt-faq-a, .fd-vlt-card { transition-duration: 120ms !important; }
  .fd-vlt[data-js] [data-reveal] { transform: none; transition: opacity 120ms linear; transition-delay: 0ms; }
  .fd-vlt-card { transform: none; }
  .fd-vlt-plat { height: auto; padding: 96px 0; }
  .fd-vlt-plat-stick { position: relative; height: auto; }
  .fd-vlt-steps li { opacity: 1; }
  .fd-vlt-plat-bar { display: none; }
  .fd-vlt-caps { height: auto; padding: 96px 0; }
  .fd-vlt-caps-stick { position: relative; height: auto; }
  .fd-vlt-caps-track { transform: none; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 12px; }
  .fd-vlt-cap { scroll-snap-align: start; }
  .fd-vlt-caps-progress { display: none; }
  .fd-vlt-marquee-track { flex-wrap: wrap; width: auto; }
  .fd-vlt-marquee-row[data-dir="rev"] { display: none; }
}
@media (prefers-contrast: more) {
  .fd-vlt { --fd-vlt-mute: #3a3a40; --fd-vlt-line: rgba(11,11,12,0.35); --fd-vlt-mute-dark: #d4d4d8; }
  .fd-vlt-nav[data-condensed] { background: #fff; -webkit-backdrop-filter: none; backdrop-filter: none; }
}
@media (prefers-reduced-transparency: reduce) {
  .fd-vlt-nav[data-condensed], .fd-vlt-nav[data-open] { background: #fff; -webkit-backdrop-filter: none; backdrop-filter: none; }
}
`;
