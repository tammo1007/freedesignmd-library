/**
 * Forge — code review & CI landing page (dark, hairline, one accent).
 *
 * A complete, self-contained single page: React is the only import and every
 * style lives in the <style> block at the bottom of this file (classes are
 * prefixed `fd-frg-`). Drop it into any React 18+ project and render <Page />.
 *
 * Motion: terminal typing hero, a PR timeline whose line draws with scroll,
 * an annotated diff where review comments pop in (and a suggestion can be
 * committed), a sticky "90-second merge" scene scrubbed by scroll, a bento of
 * live micro-visuals, an integrations grid with a cursor-follow spotlight on
 * its hairlines, a per-seat pricing calculator and staggered reveals.
 *
 * Browser support: evergreen browsers (sticky, IntersectionObserver, CSS
 * custom properties, mask-image). Accessibility: landmarks, real buttons and
 * range input, aria-live terminal summary, focus rings, reduced-motion and
 * prefers-contrast fallbacks. SSR-safe (no window access during render).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* ─────────────────────────── helpers ─────────────────────────── */

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

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

/** rAF-throttled scroll/resize callback, active only while `ref` is near the viewport. */
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

/** Fires once when `ref` enters the viewport (immediately under reduced motion). */
function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.35) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" || reducedMotion()) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return seen;
}

/* ─────────────────────────── icons ─────────────────────────── */

function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg className="fd-frg-logo" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2.5l8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7.5v9M8 10l4-2.5 4 2.5" fill="none" stroke="var(--fd-frg-accent)" strokeWidth="1.5" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="fd-frg-arrow">
      <path d="M3 8h9.5M8.5 3.5L13 8l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function Tick() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function Branch() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="4.5" cy="3.5" r="1.6" fill="none" stroke="currentColor" />
      <circle cx="4.5" cy="12.5" r="1.6" fill="none" stroke="currentColor" />
      <circle cx="11.5" cy="5.5" r="1.6" fill="none" stroke="currentColor" />
      <path d="M4.5 5.1v5.8M11.5 7.1c0 2.4-2 3-7 3.8" fill="none" stroke="currentColor" />
    </svg>
  );
}

/* ─────────────────────────── nav ─────────────────────────── */

const NAV = [
  ["#how", "How it works"],
  ["#review", "Review"],
  ["#speed", "Speed"],
  ["#integrations", "Integrations"],
  ["#pricing", "Pricing"],
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className="fd-frg-nav" data-scrolled={scrolled || undefined} data-open={open || undefined}>
      <div className="fd-frg-nav-in">
        <a href="#top" className="fd-frg-brand" aria-label="Forge home">
          <Logo />
          <span>Forge</span>
        </a>
        <nav className="fd-frg-nav-links" aria-label="Primary">
          {NAV.map(([h, l]) => (
            <a key={h} href={h}>
              {l}
            </a>
          ))}
        </nav>
        <div className="fd-frg-nav-right">
          <a className="fd-frg-nav-ghost" href="#top">
            Docs
          </a>
          <a className="fd-frg-btn fd-frg-btn-sm" href="#pricing">
            Start free
          </a>
          <button
            type="button"
            className="fd-frg-burger"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
      <div className="fd-frg-sheet" hidden={!open}>
        {NAV.map(([h, l]) => (
          <a key={h} href={h} onClick={() => setOpen(false)}>
            {l}
          </a>
        ))}
      </div>
    </header>
  );
}

/* ─────────────────────────── hero terminal ─────────────────────────── */

type TLine = { kind: "cmd" | "out" | "ok" | "warn" | "dim" | "sum"; text: string; pause?: number };

const SCRIPT: TLine[] = [
  { kind: "cmd", text: "git push origin feat/session-rotation" },
  { kind: "dim", text: "→ forge: PR #4182 opened · 7 files · +214 −38", pause: 380 },
  { kind: "out", text: "  selecting tests  214 of 9,812 touch this diff", pause: 420 },
  { kind: "ok", text: "  ✓ build          cached      0:11", pause: 260 },
  { kind: "ok", text: "  ✓ unit           214 passed  0:38", pause: 260 },
  { kind: "ok", text: "  ✓ integration     41 passed  0:52", pause: 260 },
  { kind: "warn", text: "  ◆ review         2 suggestions on src/auth/session.ts", pause: 520 },
  { kind: "ok", text: "  ✓ approved       by jane (staff eng)", pause: 360 },
  { kind: "sum", text: "merged to main in 1m 28s · deployed to prod-us-east", pause: 0 },
];

function Terminal() {
  const [shown, setShown] = useState<{ line: number; chars: number }>({ line: 0, chars: 0 });
  const [run, setRun] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const done = shown.line >= SCRIPT.length;

  useEffect(() => {
    if (reducedMotion()) {
      setShown({ line: SCRIPT.length, chars: 0 });
      return;
    }
    let line = 0;
    let chars = 0;
    let t = 0;
    let cancelled = false;
    setShown({ line: 0, chars: 0 });
    const tick = () => {
      if (cancelled) return;
      const cur = SCRIPT[line];
      if (!cur) return;
      if (cur.kind === "cmd" && chars < cur.text.length) {
        chars += 1;
        setShown({ line, chars });
        t = window.setTimeout(tick, 28 + Math.random() * 46);
        return;
      }
      line += 1;
      chars = 0;
      setShown({ line, chars: 0 });
      t = window.setTimeout(tick, cur.pause ?? 300);
    };
    t = window.setTimeout(tick, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [run]);

  return (
    <div className="fd-frg-term" ref={boxRef}>
      <div className="fd-frg-term-bar">
        <span className="fd-frg-term-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="fd-frg-term-title">~/acme/api — zsh</span>
        <button type="button" className="fd-frg-term-replay" onClick={() => setRun((r) => r + 1)} disabled={!done}>
          Replay
        </button>
      </div>
      <div className="fd-frg-term-body" aria-hidden="true">
        {SCRIPT.map((l, i) => {
          if (i > shown.line) return null;
          const typing = l.kind === "cmd" && i === shown.line;
          const text = typing ? l.text.slice(0, shown.chars) : l.text;
          if (i === shown.line && !typing) return null;
          return (
            <div key={`${run}-${i}`} className={`fd-frg-tl fd-frg-tl-${l.kind}`}>
              {l.kind === "cmd" && <span className="fd-frg-prompt">$</span>}
              {l.kind === "sum" && <span className="fd-frg-sum-dot" />}
              <span>{text}</span>
              {typing && <span className="fd-frg-caret" />}
            </div>
          );
        })}
        {done && (
          <div className="fd-frg-tl fd-frg-tl-cmd">
            <span className="fd-frg-prompt">$</span>
            <span className="fd-frg-caret" />
          </div>
        )}
      </div>
      <p className="fd-frg-sr" aria-live="polite">
        {done ? "Example run: pull request 4182 merged to main in 1 minute 28 seconds." : ""}
      </p>
    </div>
  );
}

function Hero() {
  return (
    <section className="fd-frg-hero" id="top">
      <div className="fd-frg-hero-grid" aria-hidden="true" />
      <div className="fd-frg-wrap fd-frg-hero-in">
        <a className="fd-frg-pill fd-frg-in" href="#speed" style={{ "--d": "0ms" } as CSSProperties}>
          <span className="fd-frg-pill-new">v4.2</span> <span className="fd-frg-pill-txt">Merge queues now rebase stacked PRs</span> <Arrow />
        </a>
        <h1 className="fd-frg-h1">
          <span className="fd-frg-in" style={{ "--d": "80ms" } as CSSProperties}>
            Ship the PR.
          </span>
          <span className="fd-frg-in fd-frg-h1-mute" style={{ "--d": "180ms" } as CSSProperties}>
            Skip the wait.
          </span>
        </h1>
        <p className="fd-frg-lede fd-frg-in" style={{ "--d": "280ms" } as CSSProperties}>
          Forge runs only the tests your diff touches, reviews every line before a human does, and lands the merge in
          about ninety seconds. Works with the GitHub repo you already have.
        </p>
        <div className="fd-frg-ctas fd-frg-in" style={{ "--d": "360ms" } as CSSProperties}>
          <a className="fd-frg-btn" href="#pricing">
            Start free <Arrow />
          </a>
          <CopyCmd cmd="npx forge init" />
        </div>
        <div className="fd-frg-hero-term fd-frg-in" style={{ "--d": "460ms" } as CSSProperties}>
          <Terminal />
        </div>
      </div>
    </section>
  );
}

function CopyCmd({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="fd-frg-cmd"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(cmd);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
      aria-label={`Copy command: ${cmd}`}
    >
      <span className="fd-frg-cmd-p">$</span>
      <span>{cmd}</span>
      <span className="fd-frg-cmd-c">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/* ─────────────────────────── logos ─────────────────────────── */

function Logos() {
  const names = ["Linear Labs", "northwind", "PARCEL", "Halcyon", "tessellate", "Orbital", "kiln.dev", "Quanta"];
  return (
    <section className="fd-frg-logos" aria-label="Customers">
      <div className="fd-frg-wrap">
        <p className="fd-frg-mini" data-reveal="">
          Merging 2.1 million PRs a month for 3,400 engineering teams
        </p>
        <ul>
          {names.map((n, i) => (
            <li key={n} data-reveal="" style={{ "--i": i } as CSSProperties} className={`fd-frg-wm fd-frg-wm-${i % 4}`}>
              {n}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────────── PR timeline (draws on scroll) ─────────────────────────── */

const STEPS: { t: string; time: string; title: string; body: string; meta: ReactNode }[] = [
  {
    t: "00:00",
    time: "Push",
    title: "PR opened from your branch",
    body: "Forge reads the diff, the dependency graph and the CODEOWNERS file before CI even starts.",
    meta: (
      <span className="fd-frg-chip">
        <Branch /> feat/session-rotation → main
      </span>
    ),
  },
  {
    t: "00:04",
    time: "Select",
    title: "214 of 9,812 tests selected",
    body: "Test impact analysis maps every changed symbol to the tests that exercise it. The other 9,598 stay cached.",
    meta: (
      <span className="fd-frg-meter" aria-label="2.2 percent of the suite">
        <i />
        <b>2.2% of suite</b>
      </span>
    ),
  },
  {
    t: "00:11",
    time: "Build",
    title: "Remote cache hit, 11 seconds",
    body: "Content-addressed build artifacts are shared across every branch, so the second build is almost free.",
    meta: <span className="fd-frg-chip">cache · 96.4% hit rate</span>,
  },
  {
    t: "00:52",
    time: "Review",
    title: "Auto-review leaves two suggestions",
    body: "Forge comments like a careful staff engineer: idempotency, missing indexes, unhandled errors. Never style nits.",
    meta: <span className="fd-frg-chip fd-frg-chip-acc">2 suggestions · 0 nits</span>,
  },
  {
    t: "01:14",
    time: "Approve",
    title: "A human signs off",
    body: "Reviewers are routed by ownership and load. Hot files with incident history pull in a second reviewer automatically.",
    meta: (
      <span className="fd-frg-avs" aria-label="Approved by Jane and Nikhil">
        <img className="" src="/img/people/p9.webp" alt="Jane Lindqvist, staff engineer, a woman with natural curly hair in a black sweater" width={28} height={28} loading="lazy" decoding="async" />
        <img className="" src="/img/people/p7.webp" alt="Nikhil Sharma, reviewer, a bearded man in round glasses and a black sweater" width={28} height={28} loading="lazy" decoding="async" />
      </span>
    ),
  },
  {
    t: "01:28",
    time: "Merge",
    title: "Queued, rebased, merged, deployed",
    body: "The merge queue batches compatible PRs, re-runs only what changed after rebase and promotes to production.",
    meta: <span className="fd-frg-chip">prod-us-east · v2026.10.29-4182</span>,
  },
];

function Timeline() {
  const ref = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  useScrollFrame(ref, () => {
    const l = list.current;
    if (!l) return;
    const r = l.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = reducedMotion() ? 1 : clamp01((vh * 0.62 - r.top) / r.height);
    l.style.setProperty("--draw", p.toFixed(4));
    const lineY = p * r.height;
    l.querySelectorAll<HTMLElement>("[data-step]").forEach((li) => {
      if (li.offsetTop + 14 <= lineY + 1) li.setAttribute("data-on", "");
      else li.removeAttribute("data-on");
    });
  });
  return (
    <section className="fd-frg-sec" id="how" ref={ref}>
      <div className="fd-frg-wrap fd-frg-tl-grid">
        <div className="fd-frg-sticky-head" data-reveal="">
          <p className="fd-frg-eyebrow">01 · Anatomy of a merge</p>
          <h2 className="fd-frg-h2">
            From push to prod,
            <br />
            <span className="fd-frg-h2-mute">one minute twenty-eight.</span>
          </h2>
          <p className="fd-frg-p">
            Every step below is a real span from PR #4182 in the acme/api monorepo — 1.4M lines, 61 services, 180
            engineers.
          </p>
        </div>
        <ol className="fd-frg-steps" ref={list}>
          <span className="fd-frg-rail" aria-hidden="true">
            <i />
          </span>
          {STEPS.map((s) => (
            <li key={s.t} data-step="">
              <span className="fd-frg-node" aria-hidden="true" />
              <div className="fd-frg-step-head">
                <span className="fd-frg-mono fd-frg-step-t">{s.t}</span>
                <span className="fd-frg-mono fd-frg-step-k">{s.time}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <div className="fd-frg-step-meta">{s.meta}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────────── diff with auto-review ─────────────────────────── */

type DL = { n: number | null; o: number | null; k: " " | "+" | "-"; code: string };
const DIFF: DL[] = [
  { o: 41, n: 41, k: " ", code: "export async function rotateSession(userId: string) {" },
  { o: 42, n: 42, k: " ", code: "  const current = await db.session.findActive(userId);" },
  { o: 43, n: null, k: "-", code: "  await db.session.revoke(current.id);" },
  { o: 44, n: null, k: "-", code: "  return db.session.create({ userId });" },
  { o: null, n: 43, k: "+", code: "  return db.transaction(async (tx) => {" },
  { o: null, n: 44, k: "+", code: "    await tx.session.revoke(current.id);" },
  { o: null, n: 45, k: "+", code: "    const next = await tx.session.create({ userId });" },
  { o: null, n: 46, k: "+", code: "    audit.emit(\"session.rotated\", { userId });" },
  { o: null, n: 47, k: "+", code: "    return next;" },
  { o: null, n: 48, k: "+", code: "  });" },
  { o: 45, n: 49, k: " ", code: "}" },
];

function Diff() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, 0.3);
  const [stage, setStage] = useState(0);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!seen) return;
    if (reducedMotion()) {
      setStage(4);
      return;
    }
    const ts = [400, 1500, 2600, 3500].map((ms, i) => window.setTimeout(() => setStage(i + 1), ms));
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, [seen]);

  return (
    <section className="fd-frg-sec fd-frg-sec-alt" id="review">
      <div className="fd-frg-wrap">
        <div className="fd-frg-head-row" data-reveal="">
          <div>
            <p className="fd-frg-eyebrow">02 · Auto-review</p>
            <h2 className="fd-frg-h2">
              Reviews that read the code,
              <br />
              <span className="fd-frg-h2-mute">not the linter output.</span>
            </h2>
          </div>
          <p className="fd-frg-p fd-frg-head-p">
            Forge checks for the bugs that page people at 3 a.m. — race conditions, missing idempotency, unbounded
            queries — and stays silent about semicolons.
          </p>
        </div>

        <div className="fd-frg-diff" ref={ref} data-stage={stage} data-reveal="">
          <div className="fd-frg-diff-bar">
            <span className="fd-frg-mono">src/auth/session.ts</span>
            <span className="fd-frg-diff-stat">
              <b className="fd-frg-add">+6</b> <b className="fd-frg-del">−2</b>
            </span>
            <span className="fd-frg-diff-status" data-on={stage >= 1 || undefined}>
              <span className="fd-frg-spin" aria-hidden="true" />
              {stage >= 4 ? "Review complete · 2 suggestions" : stage >= 1 ? "Forge is reviewing…" : "Queued"}
            </span>
          </div>
          <div className="fd-frg-diff-body">
            <div className="fd-frg-code" role="table" aria-label="Diff of src/auth/session.ts">
              {DIFF.map((l, i) => (
                <div key={i} role="row" className={`fd-frg-dl fd-frg-dl-${l.k === "+" ? "add" : l.k === "-" ? "del" : "ctx"}`} data-scan={stage >= 1 || undefined} style={{ "--i": i } as CSSProperties}>
                  <span role="cell" className="fd-frg-ln">{l.o ?? ""}</span>
                  <span role="cell" className="fd-frg-ln">{l.n ?? ""}</span>
                  <span role="cell" className="fd-frg-sign">{l.k}</span>
                  <span role="cell" className="fd-frg-src">
                    {applied && i === 7 ? "    audit.emit(\"session.rotated\", { userId, prev: current.id });" : l.code}
                  </span>
                </div>
              ))}
            </div>
            <div className="fd-frg-comments">
              <article className="fd-frg-cmt" data-show={stage >= 2 || undefined}>
                <header>
                  <span className="fd-frg-bot">
                    <Logo size={14} />
                  </span>
                  <b>forge-review</b>
                  <span className="fd-frg-mono">L43 · correctness</span>
                </header>
                <p>
                  Good call wrapping revoke + create in a transaction. Retries from the mobile client will still mint
                  two sessions though — key the transaction on <code>request.idempotencyKey</code>.
                </p>
              </article>
              <article className="fd-frg-cmt" data-show={stage >= 3 || undefined}>
                <header>
                  <span className="fd-frg-bot">
                    <Logo size={14} />
                  </span>
                  <b>forge-review</b>
                  <span className="fd-frg-mono">L46 · observability</span>
                </header>
                <p>
                  Include the previous session id so dashboards can split rotations from logouts.
                </p>
                <div className="fd-frg-sugg">
                  <span className="fd-frg-mono">Suggested change</span>
                  <code>- audit.emit("session.rotated", {"{ userId }"});</code>
                  <code>+ audit.emit("session.rotated", {"{ userId, prev: current.id }"});</code>
                </div>
                <button
                  type="button"
                  className="fd-frg-btn fd-frg-btn-sm fd-frg-btn-ghost"
                  onClick={() => setApplied(true)}
                  disabled={applied}
                >
                  {applied ? (
                    <>
                      <Tick /> Committed · 9c41f2a
                    </>
                  ) : (
                    "Commit suggestion"
                  )}
                </button>
              </article>
              <article className="fd-frg-cmt fd-frg-cmt-human" data-show={stage >= 4 || undefined}>
                <header>
                  <img className="fd-frg-av" src="/img/people/p9.webp" alt="Jane Lindqvist, staff engineer, a woman with natural curly hair in a black sweater" width={22} height={22} loading="lazy" decoding="async" />
                  <b>jane</b>
                  <span className="fd-frg-mono">staff eng</span>
                </header>
                <p>This file had 14 incidents last quarter — glad it pulled me in. Approving once the key lands.</p>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── 90-second merge (scroll-scrubbed) ─────────────────────────── */

const JOBS = [
  { name: "Checkout + diff", start: 0, dur: 4 },
  { name: "Build (cached)", start: 4, dur: 11 },
  { name: "Unit · 214 tests", start: 15, dur: 38 },
  { name: "Integration · 41", start: 15, dur: 52 },
  { name: "Auto-review", start: 15, dur: 37 },
  { name: "Human approval", start: 52, dur: 22 },
  { name: "Merge queue + deploy", start: 74, dur: 14 },
];
const TOTAL = 88;

function Speed() {
  const ref = useRef<HTMLElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const legacy = useRef<HTMLSpanElement>(null);
  useScrollFrame(ref, () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const travel = Math.max(1, r.height - vh);
    const p = reducedMotion() ? 1 : clamp01((-r.top) / travel);
    const t = p * TOTAL;
    el.style.setProperty("--p", p.toFixed(4));
    el.querySelectorAll<HTMLElement>("[data-job]").forEach((row) => {
      const s = Number(row.dataset.start);
      const d = Number(row.dataset.dur);
      const f = clamp01((t - s) / d);
      row.style.setProperty("--f", f.toFixed(4));
      row.dataset.state = f >= 1 ? "done" : f > 0 ? "run" : "wait";
    });
    if (clock.current) {
      const sec = Math.round(t);
      clock.current.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    }
    if (legacy.current) {
      const lt = Math.round(p * 852);
      legacy.current.textContent = `${Math.floor(lt / 60)}:${String(lt % 60).padStart(2, "0")}`;
    }
  });
  return (
    <section className="fd-frg-speed" id="speed" ref={ref}>
      <div className="fd-frg-speed-stick">
        <div className="fd-frg-wrap fd-frg-speed-in">
          <div className="fd-frg-speed-head">
            <div>
              <p className="fd-frg-eyebrow">03 · The ninety-second merge</p>
              <h2 className="fd-frg-h2">
                Same PR. <span className="fd-frg-h2-mute">Ten times sooner.</span>
              </h2>
            </div>
            <p className="fd-frg-mono fd-frg-speed-hint" aria-hidden="true">Scroll to run the pipeline ↓</p>
          </div>
          <div className="fd-frg-clock-row">
            <div className="fd-frg-clock">
              <span className="fd-frg-mono">Forge</span>
              <span ref={clock} className="fd-frg-clock-n">
                0:00
              </span>
            </div>
            <div className="fd-frg-clock fd-frg-clock-legacy">
              <span className="fd-frg-mono">Same PR on full-suite CI</span>
              <span ref={legacy} className="fd-frg-clock-n">
                0:00
              </span>
            </div>
          </div>
          <div className="fd-frg-gantt" role="img" aria-label="Pipeline: seven jobs complete in 88 seconds, versus 14 minutes 12 seconds on full-suite CI">
            <div className="fd-frg-gantt-axis" aria-hidden="true">
              {[0, 15, 30, 45, 60, 75, 88].map((s) => (
                <span key={s} style={{ left: `${(s / TOTAL) * 100}%` }}>
                  {s}s
                </span>
              ))}
            </div>
            {JOBS.map((j) => (
              <div key={j.name} className="fd-frg-job" data-job="" data-start={j.start} data-dur={j.dur} data-state="wait">
                <span className="fd-frg-job-name">
                  <i aria-hidden="true" />
                  {j.name}
                </span>
                <span className="fd-frg-job-track">
                  <span
                    className="fd-frg-job-bar"
                    style={{ left: `${(j.start / TOTAL) * 100}%`, width: `${(j.dur / TOTAL) * 100}%` }}
                  >
                    <i />
                  </span>
                </span>
                <span className="fd-frg-job-dur fd-frg-mono">{j.dur}s</span>
              </div>
            ))}
            <span className="fd-frg-playhead" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── bento ─────────────────────────── */

function Bento() {
  return (
    <section className="fd-frg-sec" aria-label="Features">
      <div className="fd-frg-wrap">
        <div className="fd-frg-head-row" data-reveal="">
          <div>
            <p className="fd-frg-eyebrow">04 · Built for the merge queue</p>
            <h2 className="fd-frg-h2">
              Less waiting.
              <br />
              <span className="fd-frg-h2-mute">More shipping.</span>
            </h2>
          </div>
        </div>
        <div className="fd-frg-bento">
          <article className="fd-frg-tile fd-frg-tile-wide" data-reveal="">
            <div className="fd-frg-tile-vis fd-frg-vis-stack" aria-hidden="true">
              {["#4180 schema: add sessions.prev_id", "#4181 api: rotate on refresh", "#4182 auth: idempotent rotation"].map((t, i) => (
                <div key={t} style={{ "--i": i } as CSSProperties}>
                  <Branch />
                  <span>{t}</span>
                  <em>{i === 2 ? "rebasing" : "ready"}</em>
                </div>
              ))}
            </div>
            <h3>Stacked PRs that stay stacked</h3>
            <p>Forge rebases, re-checks and re-routes reviewers as the stack changes. Land the bottom, the rest follows.</p>
          </article>
          <article className="fd-frg-tile" data-reveal="" style={{ "--i": 1 } as CSSProperties}>
            <div className="fd-frg-tile-vis fd-frg-vis-flake" aria-hidden="true">
              {Array.from({ length: 48 }, (_, i) => (
                <i key={i} data-f={i === 13 || i === 29 || i === 38 ? "" : undefined} />
              ))}
            </div>
            <h3>Flake quarantine</h3>
            <p>Tests that fail then pass on retry are isolated, owned and ticketed — never blocking your merge.</p>
          </article>
          <article className="fd-frg-tile" data-reveal="" style={{ "--i": 2 } as CSSProperties}>
            <div className="fd-frg-tile-vis fd-frg-vis-cache" aria-hidden="true">
              <span>96.4%</span>
              <small>remote cache hit rate</small>
            </div>
            <h3>Shared build cache</h3>
            <p>Content-addressed artifacts across every branch and laptop. Cold builds become a rounding error.</p>
          </article>
          <article className="fd-frg-tile fd-frg-tile-wide" data-reveal="" style={{ "--i": 3 } as CSSProperties}>
            <div className="fd-frg-tile-vis fd-frg-vis-chart" aria-hidden="true">
              <svg aria-hidden="true" focusable="false" viewBox="0 0 400 110" preserveAspectRatio="none">
                <path d="M0 18 L40 22 L80 20 L120 30 L160 46 L200 62 L240 76 L280 84 L320 88 L360 92 L400 93" fill="none" stroke="var(--fd-frg-accent)" strokeWidth="2" />
                <path d="M0 18 L40 22 L80 20 L120 30 L160 46 L200 62 L240 76 L280 84 L320 88 L360 92 L400 93 L400 110 L0 110Z" fill="var(--fd-frg-accent)" opacity="0.08" />
                <path d="M160 0V110" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 4" />
              </svg>
              <span className="fd-frg-chart-tag">Forge enabled · Jun 3</span>
            </div>
            <h3>Cycle time you’ll actually open on Monday</h3>
            <p>PR cycle time, review latency and flake rate per team — measured from the same spans that run your CI.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── integrations (spotlight) ─────────────────────────── */

const INTEGRATIONS: [string, string, string][] = [
  ["GitHub", "Checks, merge queue, CODEOWNERS", "M8 1.5a6.5 6.5 0 00-2 12.7c.3 0 .4-.2.4-.4v-1.3c-1.8.4-2.2-.8-2.2-.8-.3-.8-.7-1-.7-1-.6-.4 0-.4 0-.4.7 0 1 .7 1 .7.6 1 1.6.7 2 .5 0-.4.2-.7.4-.9-1.4-.2-3-.7-3-3.2 0-.7.3-1.3.7-1.8 0-.2-.3-.8.1-1.7 0 0 .5-.2 1.8.7a6 6 0 013.2 0c1.3-.9 1.8-.7 1.8-.7.4.9.1 1.5.1 1.7.4.5.7 1.1.7 1.8 0 2.5-1.5 3-3 3.2.3.2.5.6.5 1.2v1.8c0 .2.1.4.4.4A6.5 6.5 0 008 1.5z"],
  ["GitLab", "MR pipelines and approvals", "M8 14.5L2 9.8l1.6-6.3 1.5 4.3h5.8l1.5-4.3L14 9.8z"],
  ["Slack", "Review requests that respect focus time", "M4 9.5a1.3 1.3 0 11-1.3-1.3H4zm.7 0a1.3 1.3 0 012.6 0v3.3a1.3 1.3 0 11-2.6 0zM6 4a1.3 1.3 0 111.3-1.3V4zm0 .7a1.3 1.3 0 010 2.6H2.7a1.3 1.3 0 110-2.6zM11.5 6a1.3 1.3 0 111.3 1.3h-1.3zm-.7 0a1.3 1.3 0 01-2.6 0V2.7a1.3 1.3 0 112.6 0zM9.5 11.5a1.3 1.3 0 11-1.3 1.3v-1.3zm0-.7a1.3 1.3 0 010-2.6h3.3a1.3 1.3 0 110 2.6z"],
  ["Linear", "Issue status follows the PR", "M2 9.5l4.5 4.5M2 6.8l7.2 7.2M3 4.4l8.6 8.6M5 2.6l8.4 8.4M8 1.6l6.4 6.4"],
  ["Jira", "Transitions on merge and deploy", "M8 1.5L14.5 8 8 14.5 1.5 8zM8 5L11 8 8 11 5 8z"],
  ["PagerDuty", "Incident history weights reviews", "M4 14.5v-13h4.5a3.5 3.5 0 010 7H4"],
  ["Datadog", "Deploy markers and test traces", "M3 12l2-7 3 3 3-5 2 9z"],
  ["Sentry", "Regressions linked to the PR", "M8 2l6 11H10a5 5 0 00-5-5M8 2L2 13h3"],
  ["Vercel", "Preview URLs on every commit", "M8 2.5l6.5 11h-13z"],
  ["AWS", "OIDC deploys to ECS and Lambda", "M2 10c3 2.5 9 2.5 12 0M11.5 10.8l2.5-.8-.6 2.5"],
  ["Bazel", "Remote execution and cache", "M8 1.5l3 3-3 3-3-3zM4.5 5l3 3-3 3-3-3zM11.5 5l3 3-3 3-3-3zM8 8.5l3 3-3 3-3-3z"],
  ["Terraform", "Plan diffs as review comments", "M2 2.5l3.8 2.2v4.4L2 6.9zM6.5 5.1l3.8 2.2v4.4L6.5 9.5zM11 7.3l3-1.7v4.4l-3 1.7zM6.5 10.3l3.8 2.2v1.9"],
];

function Integrations() {
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const g = grid.current;
    if (!g) return;
    let raf = 0;
    let ex = 0;
    let ey = 0;
    const apply = () => {
      raf = 0;
      const gr = g.getBoundingClientRect();
      g.style.setProperty("--mx", `${ex - gr.left}px`);
      g.style.setProperty("--my", `${ey - gr.top}px`);
      g.querySelectorAll<HTMLElement>("[data-cell]").forEach((c) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty("--mx", `${ex - r.left}px`);
        c.style.setProperty("--my", `${ey - r.top}px`);
      });
    };
    const move = (e: PointerEvent) => {
      ex = e.clientX;
      ey = e.clientY;
      g.setAttribute("data-hot", "");
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const leave = () => g.removeAttribute("data-hot");
    g.addEventListener("pointermove", move);
    g.addEventListener("pointerleave", leave);
    return () => {
      g.removeEventListener("pointermove", move);
      g.removeEventListener("pointerleave", leave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <section className="fd-frg-sec fd-frg-sec-alt" id="integrations">
      <div className="fd-frg-wrap">
        <div className="fd-frg-head-row" data-reveal="">
          <div>
            <p className="fd-frg-eyebrow">05 · Integrations</p>
            <h2 className="fd-frg-h2">
              Fits the stack
              <br />
              <span className="fd-frg-h2-mute">you won’t migrate.</span>
            </h2>
          </div>
          <p className="fd-frg-p fd-frg-head-p">
            Forge is a GitHub App and a single YAML file. No runners to babysit, no agents in your VPC unless you want
            them.
          </p>
        </div>
        <div className="fd-frg-int" ref={grid} data-reveal="">
          {INTEGRATIONS.map(([name, desc, d]) => (
            <a key={name} href="#integrations" className="fd-frg-int-cell" data-cell="">
              <svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true">
                <path d={d} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
              </svg>
              <b>{name}</b>
              <span>{desc}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── stats + quote ─────────────────────────── */

function Proof() {
  return (
    <section className="fd-frg-sec" aria-label="Results">
      <div className="fd-frg-wrap">
        <dl className="fd-frg-stats">
          {[
            ["14m → 90s", "median pipeline after enabling test selection"],
            ["−41%", "PR cycle time in the first 30 days"],
            ["0.3%", "of auto-review comments dismissed as noise"],
            ["SOC 2", "Type II · code never used for training"],
          ].map(([k, v], i) => (
            <div key={k} data-reveal="" style={{ "--i": i } as CSSProperties}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <figure className="fd-frg-quote" data-reveal="">
          <blockquote>
            “We used to batch merges at 4 p.m. because CI took fifteen minutes. Now people merge whenever they’re done,
            and the queue just… keeps up.”
          </blockquote>
          <figcaption>
            <img className="fd-frg-av fd-frg-av-lg" src="/img/people/p6.webp" alt="Priya Anand, customer, a woman with long wavy dark hair in a black sweater" width={40} height={40} loading="lazy" decoding="async" />
            <span>
              <b>Priya Anand</b>
              <small>Head of Platform, Tessellate · 240 engineers</small>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/* ─────────────────────────── pricing (seat calculator) ─────────────────────────── */

function Pricing() {
  const [seats, setSeats] = useState(24);
  const [annual, setAnnual] = useState(true);
  const per = annual ? 19 : 24;
  const total = seats * per;
  const pct = ((seats - 1) / 199) * 100;
  return (
    <section className="fd-frg-sec" id="pricing">
      <div className="fd-frg-wrap">
        <div className="fd-frg-head-row" data-reveal="">
          <div>
            <p className="fd-frg-eyebrow">06 · Pricing</p>
            <h2 className="fd-frg-h2">
              Per seat.
              <br />
              <span className="fd-frg-h2-mute">CI minutes included.</span>
            </h2>
          </div>
          <div className="fd-frg-toggle" role="group" aria-label="Billing period">
            <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>
              Monthly
            </button>
            <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>
              Yearly <em>−20%</em>
            </button>
            <i aria-hidden="true" data-right={annual || undefined} />
          </div>
        </div>
        <div className="fd-frg-plans">
          <article className="fd-frg-plan" data-reveal="">
            <h3>Hobby</h3>
            <p className="fd-frg-plan-p">Open source and side projects.</p>
            <div className="fd-frg-price">
              <span>$0</span>
            </div>
            <ul>
              {["Public repos, unlimited", "3 private repos", "2,000 CI minutes / mo", "Auto-review on 50 PRs / mo"].map((f) => (
                <li key={f}>
                  <Tick />
                  {f}
                </li>
              ))}
            </ul>
            <a href="#top" className="fd-frg-btn fd-frg-btn-ghost">
              Start free
            </a>
          </article>
          <article className="fd-frg-plan fd-frg-plan-hot" data-reveal="" style={{ "--i": 1 } as CSSProperties}>
            <div className="fd-frg-plan-top">
              <h3>Team</h3>
              <span className="fd-frg-chip fd-frg-chip-acc">Most teams</span>
            </div>
            <p className="fd-frg-plan-p">Merge queues, test selection, unlimited review.</p>
            <div className="fd-frg-price">
              <span>${total.toLocaleString("en-US")}</span>
              <small>/ mo</small>
            </div>
            <p className="fd-frg-plan-calc fd-frg-mono">
              {seats} seats × ${per} {annual ? "billed yearly" : "billed monthly"}
            </p>
            <label className="fd-frg-range" style={{ "--pct": `${pct}%` } as CSSProperties}>
              <span className="fd-frg-sr">Number of seats</span>
              <input type="range" min={1} max={200} value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
            </label>
            <ul>
              {["Unlimited private repos", "25,000 CI minutes / seat pool", "Smart test selection", "Merge queue + stacked PRs", "SAML SSO"].map((f) => (
                <li key={f}>
                  <Tick />
                  {f}
                </li>
              ))}
            </ul>
            <a href="#top" className="fd-frg-btn">
              Start 14-day trial <Arrow />
            </a>
          </article>
          <article className="fd-frg-plan" data-reveal="" style={{ "--i": 2 } as CSSProperties}>
            <h3>Enterprise</h3>
            <p className="fd-frg-plan-p">Self-hosted runners and custom retention.</p>
            <div className="fd-frg-price">
              <span>Custom</span>
            </div>
            <ul>
              {["Runners in your VPC", "SCIM, audit log streaming", "99.95% uptime SLA", "Dedicated solutions engineer"].map((f) => (
                <li key={f}>
                  <Tick />
                  {f}
                </li>
              ))}
            </ul>
            <a href="#top" className="fd-frg-btn fd-frg-btn-ghost">
              Talk to sales
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── CTA + footer ─────────────────────────── */

function Cta() {
  return (
    <section className="fd-frg-cta">
      <div className="fd-frg-hero-grid" aria-hidden="true" />
      <div className="fd-frg-wrap fd-frg-cta-in" data-reveal="">
        <Logo size={40} />
        <h2 className="fd-frg-cta-h">Your next PR could already be merged.</h2>
        <p className="fd-frg-p">Install the GitHub App, add one YAML file, push. Most teams see their first sub-two-minute merge the same afternoon.</p>
        <div className="fd-frg-ctas">
          <a className="fd-frg-btn" href="#pricing">
            Start free <Arrow />
          </a>
          <CopyCmd cmd="npx forge init" />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols: [string, string[]][] = [
    ["Product", ["Review", "CI", "Merge queue", "Insights", "Changelog"]],
    ["Developers", ["Docs", "CLI", "API", "Status", "forge.yml reference"]],
    ["Company", ["About", "Blog", "Careers", "Security", "Contact"]],
  ];
  return (
    <footer className="fd-frg-foot">
      <div className="fd-frg-wrap">
        <div className="fd-frg-foot-top">
          <div>
            <a href="#top" className="fd-frg-brand" aria-label="Forge home">
              <Logo />
              <span>Forge</span>
            </a>
            <p className="fd-frg-foot-p">Code review and CI for teams that merge on Fridays.</p>
            <span className="fd-frg-status">
              <i aria-hidden="true" /> All systems operational
            </span>
          </div>
          {cols.map(([h, items]) => (
            <div key={h} className="fd-frg-foot-col">
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
        <div className="fd-frg-foot-bot">
          <span>© 2026 Forge Labs, Inc.</span>
          <span className="fd-frg-mono">build 2026.10.29 · 4f1c9e2</span>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────── page ─────────────────────────── */

export function Page() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  return (
    <div className="fd-frg" ref={root}>
      <style>{css}</style>
      <Nav />
      <main>
        <Hero />
        <Logos />
        <Timeline />
        <Diff />
        <Speed />
        <Bento />
        <Integrations />
        <Proof />
        <Pricing />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}

export default Page;

/* ─────────────────────────── styles ─────────────────────────── */

const css = `
.fd-frg {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms;
  --fd-dur-2: 240ms;
  --fd-dur-3: 420ms;
  --fd-dur-4: 700ms;

  --fd-frg-bg: #0a0a0a;
  --fd-frg-bg-2: #0f0f10;
  --fd-frg-surface: #141415;
  --fd-frg-surface-2: #1b1b1d;
  --fd-frg-fg: #ededed;
  --fd-frg-mute: #a1a1a1;
  --fd-frg-dim: #8a8a8a;
  --fd-frg-line: rgba(255, 255, 255, 0.08);
  --fd-frg-line-2: rgba(255, 255, 255, 0.14);
  --fd-frg-accent: #ff6b2c;
  --fd-frg-accent-soft: rgba(255, 107, 44, 0.12);
  --fd-frg-add: #3fb950;
  --fd-frg-del: #f2555a;
  --fd-frg-sans: "Geist", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter Variable", "Inter", "Segoe UI", Roboto, sans-serif;
  --fd-frg-mono-f: "Geist Mono", ui-monospace, "SF Mono", "JetBrains Mono Variable", "JetBrains Mono", Menlo, Consolas, monospace;

  position: relative; display: block; margin: 0; padding: 0;
  background: var(--fd-frg-bg); color: var(--fd-frg-fg);
  font: 400 1rem/1.5 var(--fd-frg-sans); letter-spacing: -0.006em; text-align: left;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  overflow-x: clip; color-scheme: dark;
}
.fd-frg, .fd-frg *, .fd-frg *::before, .fd-frg *::after { box-sizing: border-box; }
.fd-frg :where(h1, h2, h3, h4, p, ul, ol, li, dl, dt, dd, figure, figcaption, blockquote, main, header, footer, section, nav, article, label) {
  margin: 0; padding: 0; border: 0; font: inherit; color: inherit; letter-spacing: inherit; background: none;
}
.fd-frg :where(ul, ol) { list-style: none; }
.fd-frg :where(a) { color: inherit; text-decoration: none; }
.fd-frg :where(button) { appearance: none; -webkit-appearance: none; margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit; letter-spacing: inherit; cursor: pointer; text-align: inherit; line-height: inherit; }
.fd-frg :where(button:disabled) { cursor: default; }
.fd-frg :where(svg) { display: block; overflow: visible; }
.fd-frg :where(code) { font: 400 0.92em/1.5 var(--fd-frg-mono-f); background: none; padding: 0; color: inherit; }
.fd-frg :where(b, strong) { font-weight: 600; }
.fd-frg :where(em) { font-style: normal; }
.fd-frg :where(small) { font-size: inherit; }
.fd-frg :where(a, button, input, [tabindex]):focus-visible { outline: 2px solid rgba(255, 107, 44, 0.7); outline-offset: 2px; border-radius: 6px; }
.fd-frg-sr { position: absolute !important; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.fd-frg-wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 32px; }
.fd-frg-mono { font: 400 0.75rem/1.4 var(--fd-frg-mono-f); letter-spacing: 0; }
.fd-frg-mini { font: 400 0.8125rem/1.4 var(--fd-frg-sans); color: var(--fd-frg-mute); text-align: center; }
.fd-frg-eyebrow { font: 500 0.8125rem/1.4 var(--fd-frg-mono-f); color: var(--fd-frg-accent); letter-spacing: 0; }
.fd-frg-h2 { margin-top: 14px; font: 600 clamp(2rem, 4.2vw, 3.25rem)/1.04 var(--fd-frg-sans); letter-spacing: -0.04em; }
.fd-frg-h2-mute { color: var(--fd-frg-dim); }
.fd-frg-p { margin-top: 18px; max-width: 34em; font: 400 1.0625rem/1.55 var(--fd-frg-sans); color: var(--fd-frg-mute); }
.fd-frg-head-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; flex-wrap: wrap; }
.fd-frg-head-p { max-width: 26em; margin: 0; }

.fd-frg-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 18px;
  border: 1px solid var(--fd-frg-fg); border-radius: 9999px; background: var(--fd-frg-fg); color: var(--fd-frg-bg);
  font: 500 0.9375rem/1 var(--fd-frg-sans); letter-spacing: -0.01em; white-space: nowrap;
  transition: transform var(--fd-dur-1) var(--fd-ease-out), background-color var(--fd-dur-2) var(--fd-ease-out), border-color var(--fd-dur-2) var(--fd-ease-out), color var(--fd-dur-2) var(--fd-ease-out);
}
.fd-frg-btn:hover { background: #fff; }
.fd-frg-btn:active { transform: scale(0.96); }
.fd-frg-btn .fd-frg-arrow { transition: transform var(--fd-dur-2) var(--fd-spring); }
.fd-frg-btn:hover .fd-frg-arrow { transform: translateX(3px); }
.fd-frg-btn-sm { height: 34px; padding: 0 14px; font-size: 0.8125rem; }
.fd-frg-btn-ghost { background: transparent; color: var(--fd-frg-fg); border-color: var(--fd-frg-line-2); }
.fd-frg-btn-ghost:hover { background: var(--fd-frg-surface-2); border-color: rgba(255,255,255,0.3); }
.fd-frg-btn-ghost:disabled { color: var(--fd-frg-mute); }
.fd-frg-cmd {
  display: inline-flex; align-items: center; gap: 12px; height: 44px; padding: 0 8px 0 16px; border: 1px solid var(--fd-frg-line-2); border-radius: 9999px;
  background: var(--fd-frg-bg-2); font: 400 0.875rem/1 var(--fd-frg-mono-f); color: var(--fd-frg-fg);
  transition: border-color var(--fd-dur-2) var(--fd-ease-out), transform var(--fd-dur-1) var(--fd-ease-out);
}
.fd-frg-cmd:hover { border-color: rgba(255,255,255,0.3); }
.fd-frg-cmd:active { transform: scale(0.97); }
.fd-frg-cmd-p { color: var(--fd-frg-accent); }
.fd-frg-cmd-c { display: inline-flex; align-items: center; height: 28px; padding: 0 10px; border-radius: 9999px; background: var(--fd-frg-surface-2); font: 500 0.75rem/1 var(--fd-frg-sans); color: var(--fd-frg-mute); }
.fd-frg-chip { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border: 1px solid var(--fd-frg-line-2); border-radius: 9999px; font: 400 0.75rem/1 var(--fd-frg-mono-f); color: var(--fd-frg-mute); white-space: nowrap; }
.fd-frg-chip-acc { color: var(--fd-frg-accent); border-color: rgba(255,107,44,0.35); background: var(--fd-frg-accent-soft); }

/* nav */
.fd-frg-nav { position: sticky; top: 0; z-index: 50; display: block; border-bottom: 1px solid transparent; transition: background-color var(--fd-dur-3) var(--fd-ease-out), border-color var(--fd-dur-3) var(--fd-ease-out); }
.fd-frg-nav[data-scrolled], .fd-frg-nav[data-open] { background: rgba(10,10,10,0.78); border-bottom-color: var(--fd-frg-line); -webkit-backdrop-filter: saturate(160%) blur(14px); backdrop-filter: saturate(160%) blur(14px); }
.fd-frg-nav-in { display: flex; align-items: center; gap: 28px; max-width: 1200px; height: 64px; margin: 0 auto; padding: 0 32px; transition: height var(--fd-dur-3) var(--fd-ease-out); }
.fd-frg-nav[data-scrolled] .fd-frg-nav-in { height: 54px; }
.fd-frg-brand { display: inline-flex; align-items: center; gap: 9px; font: 600 1rem/1 var(--fd-frg-sans); letter-spacing: -0.02em; color: var(--fd-frg-fg); }
.fd-frg-nav-links { display: flex; gap: 4px; }
.fd-frg-nav-links a, .fd-frg-nav-ghost { display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 9999px; font: 400 0.875rem/1 var(--fd-frg-sans); color: var(--fd-frg-mute); transition: color var(--fd-dur-1) linear, background-color var(--fd-dur-1) linear; }
.fd-frg-nav-links a:hover, .fd-frg-nav-ghost:hover { color: var(--fd-frg-fg); background: var(--fd-frg-surface-2); }
.fd-frg-nav-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.fd-frg-burger { display: none; position: relative; width: 40px; height: 40px; }
.fd-frg-burger span { position: absolute; left: 11px; right: 11px; height: 1.5px; background: var(--fd-frg-fg); transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-frg-burger span:first-child { top: 16px; }
.fd-frg-burger span:last-child { top: 23px; }
.fd-frg-nav[data-open] .fd-frg-burger span:first-child { transform: translateY(3.5px) rotate(45deg); }
.fd-frg-nav[data-open] .fd-frg-burger span:last-child { transform: translateY(-3.5px) rotate(-45deg); }
.fd-frg-sheet { display: grid; padding: 4px 20px 16px; }
.fd-frg-sheet[hidden] { display: none; }
.fd-frg-sheet a { padding: 14px 0; border-bottom: 1px solid var(--fd-frg-line); font: 500 1.125rem/1.2 var(--fd-frg-sans); }

/* hero */
.fd-frg-hero { position: relative; padding: 96px 0 120px; margin-top: -64px; padding-top: 160px; overflow: hidden; isolation: isolate; }
.fd-frg-hero-grid {
  position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background-image: linear-gradient(to right, var(--fd-frg-line) 1px, transparent 1px), linear-gradient(to bottom, var(--fd-frg-line) 1px, transparent 1px);
  background-size: 64px 64px; background-position: center -1px;
  -webkit-mask-image: radial-gradient(ellipse 60% 55% at 50% 30%, #000 0%, transparent 75%); mask-image: radial-gradient(ellipse 60% 55% at 50% 30%, #000 0%, transparent 75%);
}
.fd-frg-hero::after { content: ""; position: absolute; left: 50%; top: 220px; width: 900px; height: 500px; transform: translateX(-50%); z-index: -1; background: radial-gradient(closest-side, rgba(255,107,44,0.14), transparent); pointer-events: none; }
.fd-frg-hero-in { display: flex; flex-direction: column; align-items: center; text-align: center; }
.fd-frg-pill { display: inline-flex; align-items: center; gap: 10px; height: 32px; padding: 0 12px 0 4px; border: 1px solid var(--fd-frg-line-2); border-radius: 9999px; background: rgba(20,20,21,0.8); font: 400 0.8125rem/1 var(--fd-frg-sans); color: var(--fd-frg-mute); transition: border-color var(--fd-dur-2) var(--fd-ease-out), color var(--fd-dur-2); }
.fd-frg-pill:hover { border-color: rgba(255,255,255,0.3); color: var(--fd-frg-fg); }
.fd-frg-pill-new { display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border-radius: 9999px; background: var(--fd-frg-accent-soft); color: var(--fd-frg-accent); font: 500 0.75rem/1 var(--fd-frg-mono-f); }
.fd-frg-h1 { display: flex; flex-direction: column; margin-top: 28px; font: 600 clamp(3rem, 8vw, 6.5rem)/0.96 var(--fd-frg-sans); letter-spacing: -0.055em; }
.fd-frg-h1-mute { color: var(--fd-frg-dim); }
.fd-frg-in { animation: fd-frg-in 1000ms var(--fd-ease-out) both; animation-delay: var(--d, 0ms); }
@keyframes fd-frg-in { from { opacity: 0; transform: translateY(16px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
.fd-frg-lede { max-width: 36em; margin-top: 26px; font: 400 clamp(1.0625rem, 1.5vw, 1.25rem)/1.5 var(--fd-frg-sans); color: var(--fd-frg-mute); }
.fd-frg-ctas { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 34px; }
.fd-frg-hero-term { width: 100%; max-width: 820px; margin-top: 64px; text-align: left; }

/* terminal */
.fd-frg-term { position: relative; border: 1px solid var(--fd-frg-line-2); border-radius: 14px; background: linear-gradient(180deg, #121213, #0c0c0d); box-shadow: 0 0 0 1px rgba(0,0,0,0.6), 0 40px 80px -30px rgba(0,0,0,0.9), 0 0 120px -40px rgba(255,107,44,0.25); overflow: hidden; }
.fd-frg-term-bar { display: flex; align-items: center; gap: 12px; height: 40px; padding: 0 12px 0 14px; border-bottom: 1px solid var(--fd-frg-line); }
.fd-frg-term-dots { display: flex; gap: 6px; }
.fd-frg-term-dots i { width: 10px; height: 10px; border-radius: 50%; background: var(--fd-frg-surface-2); border: 1px solid var(--fd-frg-line-2); }
.fd-frg-term-title { flex: 1; font: 400 0.75rem/1 var(--fd-frg-mono-f); color: var(--fd-frg-dim); text-align: center; }
.fd-frg-term-replay { height: 24px; padding: 0 10px; border-radius: 9999px; border: 1px solid var(--fd-frg-line-2); font: 500 0.6875rem/1 var(--fd-frg-sans); color: var(--fd-frg-mute); transition: opacity var(--fd-dur-2); }
.fd-frg-term-replay:disabled { opacity: 0.35; }
.fd-frg-term-body { height: 320px; padding: 18px 20px; font: 400 0.8125rem/1.85 var(--fd-frg-mono-f); color: var(--fd-frg-fg); overflow: hidden; }
.fd-frg-tl { display: flex; gap: 10px; align-items: center; white-space: pre; animation: fd-frg-line 280ms var(--fd-ease-out) both; }
@keyframes fd-frg-line { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.fd-frg-tl-cmd { animation: none; }
.fd-frg-tl-dim { color: var(--fd-frg-dim); }
.fd-frg-tl-out { color: var(--fd-frg-mute); }
.fd-frg-tl-ok { color: var(--fd-frg-fg); }
.fd-frg-tl-warn { color: var(--fd-frg-accent); }
.fd-frg-tl-sum { margin-top: 6px; color: var(--fd-frg-fg); font-weight: 500; }
.fd-frg-sum-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fd-frg-add); box-shadow: 0 0 0 4px rgba(63,185,80,0.15); }
.fd-frg-prompt { color: var(--fd-frg-accent); }
.fd-frg-caret { display: inline-block; width: 8px; height: 1.1em; margin-left: -6px; background: var(--fd-frg-fg); animation: fd-frg-blink 1s steps(2, start) infinite; }
@keyframes fd-frg-blink { to { visibility: hidden; } }

/* logos */
.fd-frg-logos { padding: 0 0 96px; }
.fd-frg-logos ul { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); margin-top: 28px; border-top: 1px solid var(--fd-frg-line); border-bottom: 1px solid var(--fd-frg-line); }
.fd-frg-logos li { display: grid; place-items: center; height: 84px; color: var(--fd-frg-mute); border-right: 1px solid var(--fd-frg-line); white-space: nowrap; transition: color var(--fd-dur-2) var(--fd-ease-out); }
.fd-frg-logos li:last-child { border-right: 0; }
.fd-frg-logos li:hover { color: var(--fd-frg-fg); }
.fd-frg-wm-0 { font: 600 1.0625rem/1 var(--fd-frg-sans); letter-spacing: -0.03em; }
.fd-frg-wm-1 { font: 400 1.125rem/1 var(--fd-frg-sans); letter-spacing: -0.04em; }
.fd-frg-wm-2 { font: 600 0.875rem/1 var(--fd-frg-mono-f); letter-spacing: 0.08em; }
.fd-frg-wm-3 { font: italic 500 1.125rem/1 Georgia, serif; }

/* sections */
.fd-frg-sec { padding: 128px 0; border-top: 1px solid var(--fd-frg-line); }
.fd-frg-sec-alt { background: var(--fd-frg-bg-2); }

/* timeline */
.fd-frg-tl-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 72px; align-items: start; }
.fd-frg-sticky-head { position: sticky; top: 120px; }
.fd-frg-steps { --draw: 0; position: relative; padding-left: 44px; }
.fd-frg-rail { position: absolute; left: 11px; top: 14px; bottom: 14px; width: 1px; background: var(--fd-frg-line-2); }
.fd-frg-rail i { position: absolute; inset: 0; background: linear-gradient(to bottom, var(--fd-frg-accent), #ffb08a); transform-origin: top; transform: scaleY(var(--draw)); box-shadow: 0 0 12px rgba(255,107,44,0.6); }
.fd-frg-steps li { position: relative; padding: 0 0 56px; opacity: 0.4; transition: opacity var(--fd-dur-3) var(--fd-ease-out); }
.fd-frg-steps li:last-child { padding-bottom: 0; }
.fd-frg-steps li[data-on] { opacity: 1; }
.fd-frg-node { position: absolute; left: -38px; top: 8px; width: 11px; height: 11px; border-radius: 50%; background: var(--fd-frg-bg); border: 1px solid var(--fd-frg-line-2); transition: background-color var(--fd-dur-2) var(--fd-ease-out), border-color var(--fd-dur-2), box-shadow var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-spring); }
.fd-frg-steps li[data-on] .fd-frg-node { background: var(--fd-frg-accent); border-color: var(--fd-frg-accent); box-shadow: 0 0 0 5px var(--fd-frg-accent-soft); transform: scale(1.1); }
.fd-frg-step-head { display: flex; gap: 12px; align-items: center; }
.fd-frg-step-t { color: var(--fd-frg-fg); font-variant-numeric: tabular-nums; }
.fd-frg-step-k { color: var(--fd-frg-dim); text-transform: uppercase; letter-spacing: 0.06em; }
.fd-frg-steps h3 { margin-top: 8px; font: 600 1.375rem/1.25 var(--fd-frg-sans); letter-spacing: -0.025em; }
.fd-frg-steps p { margin-top: 8px; max-width: 32em; font: 400 0.9688rem/1.55 var(--fd-frg-sans); color: var(--fd-frg-mute); }
.fd-frg-step-meta { margin-top: 14px; }
.fd-frg-meter { display: inline-flex; align-items: center; gap: 10px; }
.fd-frg-meter > i { display: grid; grid-template-columns: repeat(46, 1fr); gap: 2px; width: 230px; height: 14px; background: repeating-linear-gradient(to right, var(--fd-frg-surface-2) 0 3px, transparent 3px 5px); }
.fd-frg-meter > i::before { content: ""; width: 3px; height: 100%; background: var(--fd-frg-accent); box-shadow: 0 0 8px var(--fd-frg-accent); }
.fd-frg-meter b { font: 400 0.75rem/1 var(--fd-frg-mono-f); color: var(--fd-frg-mute); white-space: nowrap; }
.fd-frg-avs { display: inline-flex; }
.fd-frg-avs img, .fd-frg-av { display: inline-block; flex: none; width: 28px; height: 28px; border-radius: 50%; object-fit: cover; object-position: center top; background: var(--fd-frg-surface-2); border: 1px solid var(--fd-frg-line-2); }
.fd-frg-avs img + img { margin-left: -8px; }

/* diff */
.fd-frg-diff { margin-top: 56px; border: 1px solid var(--fd-frg-line-2); border-radius: 14px; background: var(--fd-frg-bg); overflow: hidden; }
.fd-frg-diff-bar { display: flex; align-items: center; gap: 16px; height: 46px; padding: 0 16px; border-bottom: 1px solid var(--fd-frg-line); color: var(--fd-frg-fg); }
.fd-frg-diff-stat { font: 500 0.75rem/1 var(--fd-frg-mono-f); }
.fd-frg-add { color: var(--fd-frg-add); }
.fd-frg-del { color: var(--fd-frg-del); }
.fd-frg-diff-status { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; font: 400 0.8125rem/1 var(--fd-frg-sans); color: var(--fd-frg-mute); }
.fd-frg-spin { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid var(--fd-frg-line-2); border-top-color: var(--fd-frg-accent); }
.fd-frg-diff-status[data-on] .fd-frg-spin { animation: fd-frg-spin 0.8s linear infinite; }
.fd-frg-diff[data-stage="4"] .fd-frg-spin { animation: none; border-color: var(--fd-frg-accent); background: var(--fd-frg-accent); }
@keyframes fd-frg-spin { to { transform: rotate(360deg); } }
.fd-frg-diff-body { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr); }
.fd-frg-code { padding: 12px 0; font: 400 0.8125rem/1.9 var(--fd-frg-mono-f); overflow-x: auto; border-right: 1px solid var(--fd-frg-line); }
.fd-frg-dl { position: relative; display: grid; grid-template-columns: 40px 40px 22px max-content; min-width: 100%; white-space: pre; }
.fd-frg-dl::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,107,44,0.18), transparent); opacity: 0; pointer-events: none; }
.fd-frg-dl[data-scan]::after { animation: fd-frg-scan 900ms var(--fd-ease-out) both; animation-delay: calc(var(--i) * 70ms); }
@keyframes fd-frg-scan { 0% { opacity: 0; transform: translateX(-30%); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateX(30%); } }
.fd-frg-ln { padding-right: 12px; color: #5f5f63; text-align: right; user-select: none; font-variant-numeric: tabular-nums; }
.fd-frg-sign { color: var(--fd-frg-dim); user-select: none; }
.fd-frg-src { padding-right: 20px; color: #d6d6d6; }
.fd-frg-dl-add { background: rgba(63,185,80,0.1); }
.fd-frg-dl-add .fd-frg-sign, .fd-frg-dl-add .fd-frg-ln { color: var(--fd-frg-add); }
.fd-frg-dl-del { background: rgba(242,85,90,0.1); }
.fd-frg-dl-del .fd-frg-sign, .fd-frg-dl-del .fd-frg-ln { color: var(--fd-frg-del); }
.fd-frg-dl-del .fd-frg-src { color: #b9b9b9; }
.fd-frg-comments { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: var(--fd-frg-bg-2); }
.fd-frg-cmt { padding: 14px; border: 1px solid var(--fd-frg-line-2); border-radius: 12px; background: var(--fd-frg-surface); opacity: 0; transform: translateY(10px) scale(0.96); transform-origin: top left; transition: opacity var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-spring); }
.fd-frg-cmt[data-show] { opacity: 1; transform: none; }
.fd-frg-cmt header { display: flex; align-items: center; gap: 8px; font: 400 0.8125rem/1 var(--fd-frg-sans); }
.fd-frg-cmt header .fd-frg-mono { margin-left: auto; color: var(--fd-frg-dim); font-size: 0.6875rem; }
.fd-frg-bot { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; background: var(--fd-frg-accent-soft); color: var(--fd-frg-accent); }
.fd-frg-cmt .fd-frg-av { width: 22px; height: 22px; font-size: 0.5625rem; }
.fd-frg-cmt p { margin-top: 10px; font: 400 0.875rem/1.5 var(--fd-frg-sans); color: #c9c9c9; }
.fd-frg-cmt p code { color: var(--fd-frg-accent); }
.fd-frg-sugg { display: grid; gap: 2px; margin: 12px 0; padding: 10px; border: 1px solid var(--fd-frg-line); border-radius: 8px; background: var(--fd-frg-bg); overflow-x: auto; }
.fd-frg-sugg .fd-frg-mono { color: var(--fd-frg-dim); margin-bottom: 4px; font-size: 0.6875rem; }
.fd-frg-sugg code { white-space: pre-wrap; word-break: break-word; font-size: 0.75rem; }
.fd-frg-sugg code:nth-of-type(1) { color: var(--fd-frg-del); }
.fd-frg-sugg code:nth-of-type(2) { color: var(--fd-frg-add); }
.fd-frg-cmt-human { border-style: dashed; }

/* speed */
.fd-frg-speed { --p: 0; position: relative; height: 320vh; border-top: 1px solid var(--fd-frg-line); background: var(--fd-frg-bg); }
.fd-frg-speed-stick { position: sticky; top: 0; height: 100vh; display: flex; align-items: center; overflow: hidden; }
.fd-frg-speed-in { display: grid; gap: 36px; }
.fd-frg-speed-head { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
.fd-frg-speed-hint { color: var(--fd-frg-dim); }
.fd-frg-clock-row { display: grid; grid-template-columns: 1.3fr 1fr; border: 1px solid var(--fd-frg-line-2); border-radius: 14px; overflow: hidden; }
.fd-frg-clock { display: flex; flex-direction: column; gap: 8px; padding: 20px 24px; }
.fd-frg-clock .fd-frg-mono { color: var(--fd-frg-accent); text-transform: uppercase; letter-spacing: 0.06em; }
.fd-frg-clock-n { font: 600 clamp(3.5rem, 9vw, 7.5rem)/0.9 var(--fd-frg-sans); letter-spacing: -0.06em; font-variant-numeric: tabular-nums; }
.fd-frg-clock-legacy { border-left: 1px solid var(--fd-frg-line); background: repeating-linear-gradient(135deg, transparent 0 8px, rgba(255,255,255,0.025) 8px 9px); }
.fd-frg-clock-legacy .fd-frg-mono { color: var(--fd-frg-dim); }
.fd-frg-clock-legacy .fd-frg-clock-n { color: #5f5f63; }
.fd-frg-gantt { position: relative; display: grid; gap: 8px; padding: 30px 0 4px; }
.fd-frg-gantt-axis { position: absolute; left: 190px; right: 56px; top: 0; height: 18px; }
.fd-frg-gantt-axis span { position: absolute; transform: translateX(-50%); font: 400 0.6875rem/1 var(--fd-frg-mono-f); color: var(--fd-frg-dim); }
.fd-frg-job { --f: 0; display: grid; grid-template-columns: 190px 1fr 56px; align-items: center; height: 30px; }
.fd-frg-job-name { display: flex; align-items: center; gap: 10px; font: 400 0.875rem/1 var(--fd-frg-sans); color: var(--fd-frg-mute); transition: color var(--fd-dur-2); }
.fd-frg-job-name i { width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--fd-frg-line-2); transition: background-color var(--fd-dur-2), border-color var(--fd-dur-2), box-shadow var(--fd-dur-2); }
.fd-frg-job[data-state="run"] .fd-frg-job-name { color: var(--fd-frg-fg); }
.fd-frg-job[data-state="run"] .fd-frg-job-name i { border-color: var(--fd-frg-accent); box-shadow: 0 0 0 3px var(--fd-frg-accent-soft); }
.fd-frg-job[data-state="done"] .fd-frg-job-name { color: var(--fd-frg-fg); }
.fd-frg-job[data-state="done"] .fd-frg-job-name i { background: var(--fd-frg-fg); border-color: var(--fd-frg-fg); }
.fd-frg-job-track { position: relative; height: 100%; border-left: 1px solid var(--fd-frg-line); background-image: linear-gradient(to right, var(--fd-frg-line) 1px, transparent 1px); background-size: calc(100% / 88 * 15) 100%; }
.fd-frg-job-bar { position: absolute; top: 6px; bottom: 6px; border-radius: 5px; background: var(--fd-frg-surface-2); border: 1px solid var(--fd-frg-line-2); overflow: hidden; }
.fd-frg-job-bar i { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(255,107,44,0.7), var(--fd-frg-accent)); transform-origin: left; transform: scaleX(var(--f)); }
.fd-frg-job[data-state="done"] .fd-frg-job-bar i { background: #e6e6e6; }
.fd-frg-job-dur { text-align: right; color: var(--fd-frg-dim); }
.fd-frg-playhead { position: absolute; top: 22px; bottom: 0; left: calc(190px + (100% - 190px - 56px) * var(--p)); width: 1px; background: var(--fd-frg-accent); box-shadow: 0 0 10px var(--fd-frg-accent); }

/* bento */
.fd-frg-bento { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; margin-top: 56px; border: 1px solid var(--fd-frg-line); border-radius: 16px; background: var(--fd-frg-line); overflow: hidden; }
.fd-frg-tile { display: flex; flex-direction: column; padding: 28px; background: var(--fd-frg-bg); min-height: 360px; }
.fd-frg-tile-wide { grid-column: span 2; }
.fd-frg-tile h3 { margin-top: auto; padding-top: 24px; font: 600 1.1875rem/1.3 var(--fd-frg-sans); letter-spacing: -0.02em; }
.fd-frg-tile p { margin-top: 8px; max-width: 34em; font: 400 0.9375rem/1.55 var(--fd-frg-sans); color: var(--fd-frg-mute); }
.fd-frg-tile-vis { flex: 1; min-height: 160px; }
.fd-frg-vis-stack { display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.fd-frg-vis-stack div { min-width: 0; display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 14px; border: 1px solid var(--fd-frg-line-2); border-radius: 10px; background: var(--fd-frg-surface); margin-left: calc(var(--i) * 28px); font: 400 0.8125rem/1 var(--fd-frg-mono-f); color: var(--fd-frg-fg); transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-frg-tile:hover .fd-frg-vis-stack div { transform: translateX(calc(var(--i) * 6px)); }
.fd-frg-vis-stack svg { color: var(--fd-frg-dim); flex: none; }
.fd-frg-vis-stack span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-frg-vis-stack em { margin-left: auto; font-size: 0.6875rem; color: var(--fd-frg-dim); }
.fd-frg-vis-stack div:last-child em { color: var(--fd-frg-accent); }
.fd-frg-vis-flake { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; align-content: center; }
.fd-frg-vis-flake i { aspect-ratio: 1; border-radius: 3px; background: var(--fd-frg-surface-2); }
.fd-frg-vis-flake i[data-f] { background: var(--fd-frg-accent); animation: fd-frg-flake 2.4s var(--fd-ease-in-out) infinite; }
@keyframes fd-frg-flake { 50% { opacity: 0.35; } }
.fd-frg-vis-cache { display: flex; flex-direction: column; justify-content: center; }
.fd-frg-vis-cache span { font: 600 4.5rem/1 var(--fd-frg-sans); letter-spacing: -0.06em; background: linear-gradient(180deg, #fff, #6b6b6b); -webkit-background-clip: text; background-clip: text; color: transparent; }
.fd-frg-vis-cache small { margin-top: 8px; font: 400 0.75rem/1 var(--fd-frg-mono-f); color: var(--fd-frg-dim); }
.fd-frg-vis-chart { position: relative; }
.fd-frg-vis-chart svg { width: 100%; height: 100%; min-height: 160px; }
.fd-frg-chart-tag { position: absolute; left: 41%; top: 6px; font: 400 0.6875rem/1 var(--fd-frg-mono-f); color: var(--fd-frg-mute); }

/* integrations */
.fd-frg-int {
  --mx: -999px; --my: -999px; position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin-top: 56px;
  border-radius: 16px; overflow: hidden; padding: 1px;
  background: radial-gradient(360px circle at var(--mx) var(--my), rgba(255,107,44,0.75), transparent 60%), var(--fd-frg-line);
}
.fd-frg-int-cell { --mx: -999px; --my: -999px; position: relative; display: flex; flex-direction: column; gap: 6px; min-height: 148px; padding: 22px; background: var(--fd-frg-bg-2); color: var(--fd-frg-fg); transition: background-color var(--fd-dur-2) var(--fd-ease-out); }
.fd-frg-int-cell::before { content: ""; position: absolute; inset: 0; background: radial-gradient(260px circle at var(--mx) var(--my), rgba(255,107,44,0.09), transparent 65%); opacity: 0; transition: opacity var(--fd-dur-3) var(--fd-ease-out); pointer-events: none; }
.fd-frg-int[data-hot] .fd-frg-int-cell::before { opacity: 1; }
.fd-frg-int-cell svg { margin-bottom: auto; color: var(--fd-frg-mute); transition: color var(--fd-dur-2), transform var(--fd-dur-3) var(--fd-spring); }
.fd-frg-int-cell:hover svg { color: var(--fd-frg-accent); transform: scale(1.08); }
.fd-frg-int-cell b { position: relative; margin-top: 22px; font: 500 0.9688rem/1.2 var(--fd-frg-sans); letter-spacing: -0.01em; }
.fd-frg-int-cell span { position: relative; font: 400 0.8125rem/1.4 var(--fd-frg-sans); color: var(--fd-frg-mute); }

/* proof */
.fd-frg-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--fd-frg-line-2); border-bottom: 1px solid var(--fd-frg-line); }
.fd-frg-stats div { padding: 28px 24px 28px 0; }
.fd-frg-stats div + div { padding-left: 24px; border-left: 1px solid var(--fd-frg-line); }
.fd-frg-stats dt { font: 600 clamp(1.75rem, 3vw, 2.5rem)/1 var(--fd-frg-sans); letter-spacing: -0.045em; white-space: nowrap; }
.fd-frg-stats dd { margin-top: 10px; font: 400 0.875rem/1.45 var(--fd-frg-sans); color: var(--fd-frg-mute); }
.fd-frg-quote { max-width: 900px; margin: 96px auto 0; text-align: center; }
.fd-frg-quote blockquote { font: 500 clamp(1.5rem, 2.8vw, 2.25rem)/1.25 var(--fd-frg-sans); letter-spacing: -0.03em; }
.fd-frg-quote figcaption { display: inline-flex; align-items: center; gap: 12px; margin-top: 32px; text-align: left; }
.fd-frg-av-lg { width: 40px; height: 40px; font-size: 0.75rem; }
.fd-frg-quote b { display: block; font: 500 0.9375rem/1.3 var(--fd-frg-sans); }
.fd-frg-quote small { display: block; font: 400 0.8125rem/1.3 var(--fd-frg-sans); color: var(--fd-frg-mute); }

/* pricing */
.fd-frg-toggle { position: relative; display: inline-grid; grid-template-columns: 1fr 1fr; padding: 3px; border: 1px solid var(--fd-frg-line-2); border-radius: 9999px; background: var(--fd-frg-bg-2); }
.fd-frg-toggle button { position: relative; z-index: 1; height: 34px; padding: 0 16px; border-radius: 9999px; font: 500 0.8125rem/1 var(--fd-frg-sans); color: var(--fd-frg-mute); transition: color var(--fd-dur-2); }
.fd-frg-toggle button[aria-pressed="true"] { color: var(--fd-frg-bg); }
.fd-frg-toggle em { color: var(--fd-frg-accent); font-size: 0.75rem; }
.fd-frg-toggle button[aria-pressed="true"] em { color: #b5420f; }
.fd-frg-toggle i { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px); border-radius: 9999px; background: var(--fd-frg-fg); transition: transform var(--fd-dur-3) var(--fd-spring); }
.fd-frg-toggle i[data-right] { transform: translateX(100%); }
.fd-frg-plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 56px; align-items: stretch; }
.fd-frg-plan { display: flex; flex-direction: column; padding: 28px; border: 1px solid var(--fd-frg-line-2); border-radius: 16px; background: var(--fd-frg-bg-2); }
.fd-frg-plan-hot { border-color: rgba(255,107,44,0.45); background: linear-gradient(180deg, rgba(255,107,44,0.07), transparent 40%), var(--fd-frg-bg-2); box-shadow: 0 0 0 1px rgba(255,107,44,0.15), 0 30px 80px -40px rgba(255,107,44,0.4); }
.fd-frg-plan-top { display: flex; justify-content: space-between; align-items: center; }
.fd-frg-plan h3 { font: 600 1.125rem/1.2 var(--fd-frg-sans); letter-spacing: -0.02em; }
.fd-frg-plan-p { margin-top: 6px; font: 400 0.875rem/1.45 var(--fd-frg-sans); color: var(--fd-frg-mute); }
.fd-frg-price { display: flex; align-items: baseline; gap: 6px; margin-top: 28px; }
.fd-frg-price span { font: 600 2.75rem/1 var(--fd-frg-sans); letter-spacing: -0.05em; font-variant-numeric: tabular-nums; }
.fd-frg-price small { font: 400 0.9375rem/1 var(--fd-frg-sans); color: var(--fd-frg-mute); }
.fd-frg-plan-calc { margin-top: 8px; color: var(--fd-frg-dim); }
.fd-frg-range { --pct: 50%; display: block; margin-top: 18px; }
.fd-frg-range input { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 22px; margin: 0; background: transparent; cursor: pointer; }
.fd-frg-range input::-webkit-slider-runnable-track { height: 4px; border-radius: 9999px; background: linear-gradient(to right, var(--fd-frg-accent) var(--pct), var(--fd-frg-surface-2) var(--pct)); }
.fd-frg-range input::-moz-range-track { height: 4px; border-radius: 9999px; background: linear-gradient(to right, var(--fd-frg-accent) var(--pct), var(--fd-frg-surface-2) var(--pct)); }
.fd-frg-range input::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; margin-top: -7px; border-radius: 50%; background: #fff; border: 0; box-shadow: 0 0 0 4px var(--fd-frg-accent-soft), 0 2px 6px rgba(0,0,0,0.5); transition: transform var(--fd-dur-2) var(--fd-spring); }
.fd-frg-range input:active::-webkit-slider-thumb { transform: scale(1.15); }
.fd-frg-range input::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 0; box-shadow: 0 0 0 4px var(--fd-frg-accent-soft); }
.fd-frg-plan ul { display: grid; gap: 10px; margin: 24px 0 28px; }
.fd-frg-plan li { display: flex; gap: 10px; align-items: center; font: 400 0.875rem/1.4 var(--fd-frg-sans); color: #d0d0d0; }
.fd-frg-plan li svg { color: var(--fd-frg-accent); flex: none; }
.fd-frg-plan .fd-frg-btn { margin-top: auto; width: 100%; }

/* cta */
.fd-frg-cta { position: relative; padding: 160px 0; border-top: 1px solid var(--fd-frg-line); overflow: hidden; isolation: isolate; }
.fd-frg-cta::after { content: ""; position: absolute; left: 50%; top: 50%; width: 800px; height: 420px; transform: translate(-50%, -50%); background: radial-gradient(closest-side, rgba(255,107,44,0.16), transparent); z-index: -1; }
.fd-frg-cta-in { display: flex; flex-direction: column; align-items: center; text-align: center; }
.fd-frg-cta-in .fd-frg-p { margin-left: auto; margin-right: auto; }
.fd-frg-cta-h { max-width: 14em; margin-top: 28px; font: 600 clamp(2.25rem, 5.5vw, 4.5rem)/1 var(--fd-frg-sans); letter-spacing: -0.05em; }

/* footer */
.fd-frg-foot { padding: 72px 0 32px; border-top: 1px solid var(--fd-frg-line); background: var(--fd-frg-bg); }
.fd-frg-foot-top { display: grid; grid-template-columns: 1.6fr repeat(3, minmax(0, 1fr)); gap: 32px; }
.fd-frg-foot-p { margin-top: 14px; max-width: 22em; font: 400 0.875rem/1.5 var(--fd-frg-sans); color: var(--fd-frg-mute); }
.fd-frg-status { display: inline-flex; align-items: center; gap: 8px; margin-top: 18px; height: 28px; padding: 0 12px; border: 1px solid var(--fd-frg-line-2); border-radius: 9999px; font: 400 0.75rem/1 var(--fd-frg-sans); color: var(--fd-frg-mute); }
.fd-frg-status i { width: 7px; height: 7px; border-radius: 50%; background: var(--fd-frg-add); }
.fd-frg-foot-col h4 { font: 500 0.8125rem/1 var(--fd-frg-sans); color: var(--fd-frg-fg); }
.fd-frg-foot-col ul { display: grid; gap: 10px; margin-top: 16px; }
.fd-frg-foot-col a { font: 400 0.875rem/1.3 var(--fd-frg-sans); color: var(--fd-frg-mute); transition: color var(--fd-dur-1) linear; }
.fd-frg-foot-col a:hover { color: var(--fd-frg-fg); }
.fd-frg-foot-bot { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 64px; padding-top: 20px; border-top: 1px solid var(--fd-frg-line); font: 400 0.8125rem/1.3 var(--fd-frg-sans); color: var(--fd-frg-dim); }

/* reveal */
.fd-frg[data-js] [data-reveal] { opacity: 0; transform: translateY(18px); transition: opacity var(--fd-dur-4) var(--fd-ease-out), transform 900ms var(--fd-ease-out); transition-delay: calc(var(--i, 0) * 70ms); }
.fd-frg[data-js] [data-reveal][data-in] { opacity: 1; transform: none; }

/* responsive */
@media (max-width: 1000px) {
  .fd-frg-nav-links { display: none; }
  .fd-frg-burger { display: block; }
  .fd-frg-logos ul { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .fd-frg-logos li:nth-child(4) { border-right: 0; }
  .fd-frg-logos li:nth-child(-n + 4) { border-bottom: 1px solid var(--fd-frg-line); }
  .fd-frg-tl-grid { grid-template-columns: 1fr; gap: 48px; }
  .fd-frg-sticky-head { position: static; }
  .fd-frg-diff-body { grid-template-columns: 1fr; }
  .fd-frg-code { border-right: 0; border-bottom: 1px solid var(--fd-frg-line); }
  .fd-frg-int { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .fd-frg-plans { grid-template-columns: 1fr; max-width: 520px; }
  .fd-frg-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fd-frg-stats div:nth-child(3) { padding-left: 0; border-left: 0; }
  .fd-frg-stats div:nth-child(n + 3) { border-top: 1px solid var(--fd-frg-line); }
}
@media (max-width: 720px) {
  .fd-frg-wrap, .fd-frg-nav-in { padding: 0 20px; }
  .fd-frg-nav-ghost { display: none; }
  .fd-frg-hero { padding-top: 120px; padding-bottom: 88px; }
  .fd-frg-hero-term { margin-top: 44px; }
  .fd-frg-term-body { height: 300px; padding: 14px; font-size: 0.6875rem; line-height: 1.8; }
  .fd-frg-term-title { display: none; }
  .fd-frg-term-bar { justify-content: space-between; }
  .fd-frg-sec { padding: 88px 0; }
  .fd-frg-logos ul { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fd-frg-logos li { height: 64px; border-bottom: 1px solid var(--fd-frg-line); }
  .fd-frg-logos li:nth-child(2n) { border-right: 0; }
  .fd-frg-logos li:nth-child(4) { border-right: 0; }
  .fd-frg-logos li:nth-child(n + 7) { border-bottom: 0; }
  .fd-frg-steps { padding-left: 36px; }
  .fd-frg-node { left: -30px; }
  .fd-frg-rail { left: 10px; }
  .fd-frg-meter > i { width: 150px; }
  .fd-frg-diff-bar { flex-wrap: wrap; height: auto; padding: 12px 14px; row-gap: 8px; }
  .fd-frg-diff-status { margin-left: 0; width: 100%; }
  .fd-frg-code { font-size: 0.6875rem; }
  .fd-frg-dl { grid-template-columns: 28px 28px 16px max-content; }
  .fd-frg-speed { height: 300vh; }
  .fd-frg-speed-in { gap: 24px; }
  .fd-frg-speed-hint { color: var(--fd-frg-dim); }
.fd-frg-clock-row { grid-template-columns: 1fr 1fr; }
  .fd-frg-clock { padding: 14px 16px; }
  .fd-frg-clock-n { font-size: 2.75rem; }
  .fd-frg-clock .fd-frg-mono { font-size: 0.625rem; }
  .fd-frg-gantt-axis { left: 104px; right: 0; }
  .fd-frg-job { grid-template-columns: 104px 1fr 0; height: 28px; }
  .fd-frg-job-name { font-size: 0.6875rem; gap: 6px; }
  .fd-frg-job-dur { display: none; }
  .fd-frg-playhead { left: calc(104px + (100% - 104px) * var(--p)); }
  .fd-frg-bento { grid-template-columns: 1fr; }
  .fd-frg-tile-wide { grid-column: auto; }
  .fd-frg-tile { min-height: 300px; padding: 22px; }
  .fd-frg-vis-stack div { margin-left: calc(var(--i) * 12px); padding: 0 10px; gap: 8px; font-size: 0.6875rem; min-width: 0; }
  .fd-frg-vis-stack em { display: none; }
  .fd-frg-vis-flake { grid-template-columns: repeat(8, 1fr); }
  .fd-frg-vis-flake i:nth-child(n + 33) { display: none; }
  .fd-frg-pill { max-width: 100%; }
  .fd-frg-pill-txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fd-frg-int { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fd-frg-int-cell { min-height: 132px; padding: 16px; }
  .fd-frg-stats { grid-template-columns: 1fr; }
  .fd-frg-stats div, .fd-frg-stats div + div { padding: 20px 0; border-left: 0; }
  .fd-frg-stats div + div { border-top: 1px solid var(--fd-frg-line); }
  .fd-frg-quote { margin-top: 64px; }
  .fd-frg-cta { padding: 104px 0; }
  .fd-frg-foot-top { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fd-frg-foot-top > div:first-child { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-frg *, .fd-frg *::before, .fd-frg *::after { animation: none !important; }
  .fd-frg[data-js] [data-reveal] { transform: none; transition: opacity 120ms linear; transition-delay: 0ms; }
  .fd-frg-cmt { transform: none; transition: opacity 120ms linear; }
  .fd-frg-speed { height: auto; padding: 96px 0; }
  .fd-frg-speed-stick { position: relative; height: auto; }
  .fd-frg-caret { display: none; }
}
@media (prefers-contrast: more) {
  .fd-frg { --fd-frg-mute: #cfcfcf; --fd-frg-dim: #b0b0b0; --fd-frg-line: rgba(255,255,255,0.3); --fd-frg-line-2: rgba(255,255,255,0.45); }
}
@media (prefers-reduced-transparency: reduce) {
  .fd-frg-nav[data-scrolled], .fd-frg-nav[data-open] { background: var(--fd-frg-bg); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
`;
