/**
 * HeroAiTerminal, a dark developer-tools hero for an AI coding agent. A
 * terminal window types the user's prompt, streams the agent's plan line by
 * line with tool calls and diffs, and a live preview beside it assembles the
 * generated UI: cards slide into a grid, a chart draws, a toast lands. The
 * sequence loops with a short rest. The whole composition tilts slightly to
 * the pointer and, on scroll, the windows separate in depth while the headline
 * parallaxes away.
 *
 * Props: title, lede, prompt (string typed into the terminal), plan (lines),
 * primaryCta, secondaryCta, loop (default true).
 * CSS vars: --fd-agt-bg, --fd-agt-accent, --fd-agt-mono.
 *
 * Browser support: all evergreen browsers.
 * Motion: one rAF scheduler drives typing/streaming (paused off-screen and in
 * hidden tabs), pointer tilt via spring (k=380, c=30), scroll via rAF +
 * getBoundingClientRect (transform/opacity only). prefers-reduced-motion
 * shows the finished state instantly with no loop.
 * Accessibility: the terminal is an aria-hidden illustration; the prompt and
 * plan are summarised in a visually hidden paragraph.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export type AgentLine =
  | { kind: "think"; text: string }
  | { kind: "tool"; name: string; arg: string; meta?: string }
  | { kind: "diff"; file: string; add: number; del: number }
  | { kind: "ok"; text: string };

export interface HeroAiTerminalProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  prompt?: string;
  plan?: AgentLine[];
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  loop?: boolean;
}

const DEFAULT_PLAN: AgentLine[] = [
  { kind: "think", text: "Reading schema for `invoices` and `customers`…" },
  { kind: "tool", name: "read", arg: "db/schema.prisma", meta: "142 lines" },
  { kind: "tool", name: "grep", arg: "\"useMetrics\" src/", meta: "3 hits" },
  { kind: "think", text: "Plan: KPI row, MRR chart, churn list, live toast." },
  { kind: "diff", file: "app/billing/page.tsx", add: 118, del: 4 },
  { kind: "diff", file: "components/kpi-card.tsx", add: 46, del: 0 },
  { kind: "tool", name: "test", arg: "billing.spec.ts", meta: "12 passed" },
  { kind: "ok", text: "Preview ready · 2.8s" },
];

const PROMPT = "build a billing dashboard: MRR, churn and failed payments, use our design tokens";

// timeline (ms)
const T_TYPE_START = 500;
const T_CHAR = 26;
const T_LINE = 380;

export function HeroAiTerminal({
  eyebrow = "Fathom Agent 3, now with background tasks",
  title = (
    <>
      Describe it.
      <br />
      <span className="fd-agt-dim">Review it.</span> Ship it.
    </>
  ),
  lede = "An autonomous engineer that reads your codebase, writes the change, runs the tests and opens the pull request, while you stay in flow.",
  prompt = PROMPT,
  plan = DEFAULT_PLAN,
  primaryCta = { label: "Install for VS Code", href: "#install" },
  secondaryCta = { label: "npx fathom init", href: "#cli" },
  loop = true,
}: HeroAiTerminalProps) {
  const root = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const term = useRef<HTMLDivElement>(null);
  const prev = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState(0);
  const [lines, setLines] = useState(0);
  const [build, setBuild] = useState(0); // 0..6 preview pieces
  const [copied, setCopied] = useState(false);
  const gid = `fd-agt-g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // sequencing
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(prompt.length);
      setLines(plan.length);
      setBuild(6);
      return;
    }
    const typeEnd = T_TYPE_START + prompt.length * T_CHAR;
    const planStart = typeEnd + 420;
    const planEnd = planStart + plan.length * T_LINE;
    const total = planEnd + 5200;
    let clock = 0;
    let last = 0;
    let raf = 0;
    let visible = true;
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(now - last, 64);
      last = now;
      clock += dt;
      let t = clock;
      if (loop && t > total) {
        clock = 0;
        t = 0;
      }
      setTyped(Math.max(0, Math.min(prompt.length, Math.floor((t - T_TYPE_START) / T_CHAR))));
      setLines(Math.max(0, Math.min(plan.length, Math.floor((t - planStart) / T_LINE) + 1)));
      // preview builds in step with the diff lines
      const b = t < planStart + 3 * T_LINE ? 0 : Math.min(6, Math.floor((t - (planStart + 3 * T_LINE)) / 300) + 1);
      setBuild(b);
      if (visible && !document.hidden && (loop || t < total)) raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", start);
    };
  }, [prompt, plan, loop]);

  // pointer tilt + scroll depth
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sp = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      sp.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      sp.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const onLeave = () => {
      sp.tx = 0;
      sp.ty = 0;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    let raf = 0;
    let last = performance.now();
    let visible = true;
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      for (let i = 0; i < 2; i++) {
        const h = dt / 2;
        sp.vx += (-380 * (sp.x - sp.tx) - 30 * sp.vx) * h;
        sp.vy += (-380 * (sp.y - sp.ty) - 30 * sp.vy) * h;
        sp.x += sp.vx * h;
        sp.y += sp.vy * h;
      }
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      if (scene.current) scene.current.style.transform = `rotateX(${(6 - sp.y * 4 + p * 14).toFixed(2)}deg) rotateY(${(sp.x * 6).toFixed(2)}deg) translate3d(0, ${(p * -40).toFixed(1)}px, 0)`;
      if (term.current) term.current.style.transform = `translate3d(${(p * -60).toFixed(1)}px, 0, ${(30 + p * 60).toFixed(1)}px)`;
      if (prev.current) prev.current.style.transform = `translate3d(${(p * 80).toFixed(1)}px, ${(p * -30).toFixed(1)}px, ${(-20 - p * 120).toFixed(1)}px)`;
      if (copyRef.current) {
        copyRef.current.style.transform = `translate3d(0, ${(p * 120).toFixed(1)}px, 0)`;
        copyRef.current.style.opacity = `${(1 - p * 1.6).toFixed(3)}`;
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", start);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const typing = typed < prompt.length;
  const done = lines >= plan.length;

  return (
    <section ref={root} className="fd-agt" aria-label="Fathom Agent">
      <style>{css}</style>
      <div className="fd-agt-bg" aria-hidden="true">
        <div className="fd-agt-grid" />
        <div className="fd-agt-beam" />
      </div>
      <div ref={copyRef} className="fd-agt-copy">
        <p className="fd-agt-eyebrow">
          <span className="fd-agt-dot" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="fd-agt-h1">{title}</h1>
        <p className="fd-agt-lede">{lede}</p>
        <div className="fd-agt-ctas">
          <a className="fd-agt-btn" href={primaryCta.href}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M11.5 1.5 6 6.6 3 4.3 1.5 5v6l1.5.7L6 9.4l5.5 5.1 3-1.4v-10z M11.5 5v6L8 8z M3 6.4 4.7 8 3 9.6z" fill="currentColor" />
            </svg>
            {primaryCta.label}
          </a>
          <button
            type="button"
            className="fd-agt-cli"
            onClick={() => {
              navigator.clipboard?.writeText(secondaryCta.label).catch(() => {});
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
            aria-label={`Copy command: ${secondaryCta.label}`}
          >
            <span className="fd-agt-cli-p">$</span> {secondaryCta.label}
            <span className="fd-agt-cli-c">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      <p className="fd-agt-sr">
        Example session: the prompt “{prompt}” produces a plan that reads the schema, edits two files, passes 12 tests and renders a billing dashboard preview.
      </p>

      <div className="fd-agt-stagewrap" aria-hidden="true">
        <div ref={scene} className="fd-agt-scene">
          <div ref={prev} className="fd-agt-prev">
            <div className="fd-agt-chrome">
              <i /><i /><i />
              <span className="fd-agt-url">localhost:3000/billing</span>
              <span className={`fd-agt-hmr ${build > 0 ? "is-on" : ""}`}>HMR</span>
            </div>
            <div className="fd-agt-app">
              <div className="fd-agt-app-h">
                <b>Billing</b>
                <span>Oct 2026</span>
              </div>
              <div className="fd-agt-kpis">
                {[
                  ["MRR", "$482.9k", "+8.2%"],
                  ["Net churn", "1.9%", "−0.4 pt"],
                  ["Failed", "37", "$12.4k"],
                ].map(([k, v, d], i) => (
                  <div key={k} className={`fd-agt-kpi ${build > i ? "is-in" : ""}`} style={{ transitionDelay: `${i * 40}ms` }}>
                    <span>{k}</span>
                    <b>{v}</b>
                    <em>{d}</em>
                  </div>
                ))}
              </div>
              <div className={`fd-agt-chart ${build > 3 ? "is-in" : ""}`}>
                <div className="fd-agt-chart-h">
                  <span>Monthly recurring revenue</span>
                  <em>12 mo</em>
                </div>
                <svg aria-hidden="true" focusable="false" viewBox="0 0 300 90" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#7C5CFF" stopOpacity=".35" />
                      <stop offset="1" stopColor="#7C5CFF" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path className="fd-agt-area" d="M0 78 L27 74 L54 70 L81 72 L109 60 L136 56 L163 50 L190 52 L218 38 L245 30 L272 24 L300 12 L300 90 L0 90Z" fill={`url(#${gid})`} />
                  <path className="fd-agt-line" pathLength="1" d="M0 78 L27 74 L54 70 L81 72 L109 60 L136 56 L163 50 L190 52 L218 38 L245 30 L272 24 L300 12" fill="none" stroke="#9D85FF" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              <div className={`fd-agt-list ${build > 4 ? "is-in" : ""}`}>
                {[
                  ["Northwind Bio", "Card declined", "$4,200"],
                  ["Kestrel Air", "Expired card", "$2,950"],
                  ["Oslo Freight", "Insufficient funds", "$1,180"],
                ].map(([c, r, a], i) => (
                  <div key={c} className="fd-agt-row" style={{ transitionDelay: `${i * 70}ms` }}>
                    <i style={{ background: ["#FF8A65", "#FFC34D", "#64D2FF"][i] }} />
                    <b>{c}</b>
                    <span>{r}</span>
                    <em>{a}</em>
                  </div>
                ))}
              </div>
              <div className={`fd-agt-toast ${build > 5 ? "is-in" : ""}`}>
                <span className="fd-agt-toast-i">✓</span>
                Retry scheduled for 37 invoices
              </div>
            </div>
          </div>

          <div ref={term} className="fd-agt-term">
            <div className="fd-agt-chrome fd-agt-chrome-t">
              <i /><i /><i />
              <span className="fd-agt-tab">fathom, ~/acme-billing</span>
            </div>
            <div className="fd-agt-body">
              <div className="fd-agt-prompt">
                <span className="fd-agt-ps">❯</span>
                <span>
                  {prompt.slice(0, typed)}
                  {typing && <span className="fd-agt-caret" />}
                </span>
              </div>
              <ol className="fd-agt-plan">
                {plan.slice(0, lines).map((l, i) => (
                  <li key={i} className={`fd-agt-l fd-agt-l-${l.kind}`}>
                    {l.kind === "think" && (
                      <>
                        <span className="fd-agt-g">✻</span>
                        <span className="fd-agt-think">{l.text}</span>
                      </>
                    )}
                    {l.kind === "tool" && (
                      <>
                        <span className="fd-agt-g">⏺</span>
                        <span>
                          <b>{l.name}</b>(<span className="fd-agt-arg">{l.arg}</span>)
                        </span>
                        {l.meta && <span className="fd-agt-meta">{l.meta}</span>}
                      </>
                    )}
                    {l.kind === "diff" && (
                      <>
                        <span className="fd-agt-g">⏺</span>
                        <span>
                          <b>edit</b> <span className="fd-agt-arg">{l.file}</span>
                        </span>
                        <span className="fd-agt-meta">
                          <span className="fd-agt-add">+{l.add}</span> <span className="fd-agt-del">−{l.del}</span>
                        </span>
                      </>
                    )}
                    {l.kind === "ok" && (
                      <>
                        <span className="fd-agt-g fd-agt-okg">✓</span>
                        <span className="fd-agt-ok">{l.text}</span>
                      </>
                    )}
                  </li>
                ))}
                {!typing && !done && (
                  <li className="fd-agt-l fd-agt-working">
                    <span className="fd-agt-spin" /> <span>Working · esc to interrupt</span>
                  </li>
                )}
              </ol>
              {done && (
                <div className="fd-agt-pr">
                  <span className="fd-agt-pr-b">PR #2481</span>
                  feat(billing): dashboard with MRR, churn &amp; dunning
                  <span className="fd-agt-pr-c">Checks passing</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const css = `
.fd-agt, .fd-agt *, .fd-agt *::before, .fd-agt *::after { box-sizing: border-box; }
.fd-agt {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-agt-bg: #07070A;
  --fd-agt-accent: #9D85FF;
  --fd-agt-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --fd-agt-sans: "SF Pro Display", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  position: relative; display: block; overflow: hidden; margin: 0; padding: 112px 32px 0; min-height: 880px;
  background: var(--fd-agt-bg); color: #EDEDF2; font: 400 1rem/1.5 var(--fd-agt-sans);
  isolation: isolate;
}
.fd-agt-bg { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.fd-agt-grid {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
  background-size: 64px 64px; background-position: center top;
  -webkit-mask-image: radial-gradient(70% 60% at 50% 30%, #000 20%, transparent 75%); mask-image: radial-gradient(70% 60% at 50% 30%, #000 20%, transparent 75%);
}
.fd-agt-beam {
  position: absolute; left: 50%; top: 42%; width: 1100px; height: 640px; transform: translate(-50%, 0);
  background: radial-gradient(50% 50% at 50% 50%, rgba(124, 92, 255, 0.28), rgba(124,92,255,0.06) 50%, transparent 72%);
  filter: blur(20px); animation: fd-agt-breathe 7s var(--fd-ease-in-out) infinite alternate;
}
.fd-agt-copy { position: relative; z-index: 2; max-width: 860px; margin: 0 auto; text-align: center; will-change: transform, opacity; }
.fd-agt-eyebrow {
  display: inline-flex; align-items: center; gap: 10px; margin: 0 0 22px; padding: 7px 14px; border-radius: 9999px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04);
  font: 500 0.8125rem/1 var(--fd-agt-mono); letter-spacing: -0.01em; color: #B9B9C6;
  animation: fd-agt-rise var(--fd-dur-4) var(--fd-ease-out) both;
}
.fd-agt-dot { display: block; width: 6px; height: 6px; border-radius: 9999px; background: #4ADE80; box-shadow: 0 0 0 3px rgba(74,222,128,0.18); }
.fd-agt-h1 {
  margin: 0; padding: 0; color: #F5F5F8;
  font: 600 clamp(2.75rem, 6vw, 5rem)/0.98 var(--fd-agt-sans); letter-spacing: -0.05em; text-wrap: balance;
  animation: fd-agt-blurin 900ms var(--fd-ease-out) 80ms both;
}
.fd-agt-dim { color: #6E6E7C; }
.fd-agt-lede {
  margin: 20px auto 0; padding: 0; max-width: 36rem; color: #9C9CAA;
  font: 400 clamp(1rem, 1.3vw, 1.1875rem)/1.55 var(--fd-agt-sans); letter-spacing: -0.01em; text-wrap: pretty;
  animation: fd-agt-rise var(--fd-dur-4) var(--fd-ease-out) 240ms both;
}
.fd-agt-ctas { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin: 28px 0 0; animation: fd-agt-rise var(--fd-dur-4) var(--fd-ease-out) 340ms both; }
.fd-agt-btn {
  display: inline-flex; align-items: center; gap: 10px; margin: 0; height: 46px; padding: 0 20px; border-radius: 9999px; border: 0;
  background: #F5F5F8; color: #0B0B0F; text-decoration: none; font: 500 0.9375rem/1 var(--fd-agt-sans); letter-spacing: -0.01em;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.2), 0 10px 40px -10px rgba(157,133,255,0.6);
  transition: transform var(--fd-dur-2) var(--fd-spring);
}
.fd-agt-btn svg { display: block; }
.fd-agt-btn:active, .fd-agt-cli:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-agt-cli {
  appearance: none; -webkit-appearance: none; cursor: pointer;
  display: inline-flex; align-items: center; gap: 10px; margin: 0; height: 46px; padding: 0 8px 0 18px; border-radius: 9999px;
  background: rgba(255,255,255,0.04); color: #E3E3EA; border: 1px solid rgba(255,255,255,0.12);
  font: 500 0.875rem/1 var(--fd-agt-mono); letter-spacing: -0.01em;
  transition: transform var(--fd-dur-2) var(--fd-spring), border-color var(--fd-dur-1);
}
.fd-agt-cli:hover { border-color: rgba(255,255,255,0.24); }
.fd-agt-cli-p { color: var(--fd-agt-accent); }
.fd-agt-cli-c { display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 9999px; background: rgba(255,255,255,0.08); color: #B9B9C6; font: 500 0.75rem/1 var(--fd-agt-sans); }
.fd-agt-btn:focus-visible, .fd-agt-cli:focus-visible { outline: 2px solid rgba(157,133,255,0.7); outline-offset: 2px; }
.fd-agt-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.fd-agt-stagewrap { position: relative; max-width: 1180px; margin: 52px auto 0; perspective: 1800px; perspective-origin: 50% 0%; animation: fd-agt-stagein 1200ms var(--fd-ease-out) 300ms both; }
.fd-agt-scene { position: relative; height: 470px; transform-style: preserve-3d; transform: rotateX(6deg); will-change: transform; }
.fd-agt-term, .fd-agt-prev {
  position: absolute; top: 0; border-radius: 16px; overflow: hidden; will-change: transform;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 1px 0 rgba(255,255,255,0.08) inset, 0 50px 100px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.6);
}
.fd-agt-term { left: 0; width: 45%; height: 440px; background: rgba(14, 14, 19, 0.94); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); transform: translateZ(30px); }
.fd-agt-prev { right: 0; top: 30px; width: 57%; height: 436px; background: #F6F6F8; transform: translateZ(-20px); color: #0B0B0F; }
.fd-agt-chrome { display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px; border-bottom: 1px solid rgba(11,11,15,0.08); background: #ECECF0; }
.fd-agt-chrome i { display: block; width: 11px; height: 11px; border-radius: 9999px; background: #D6D6DC; }
.fd-agt-chrome-t { background: rgba(255,255,255,0.03); border-bottom-color: rgba(255,255,255,0.07); }
.fd-agt-chrome-t i { background: #2E2E36; }
.fd-agt-chrome-t i:nth-child(1) { background: #FF5F57; } .fd-agt-chrome-t i:nth-child(2) { background: #FEBC2E; } .fd-agt-chrome-t i:nth-child(3) { background: #28C840; }
.fd-agt-url { margin: 0 auto; padding: 5px 40px; border-radius: 8px; background: #fff; color: #6B6B76; font: 400 0.75rem/1 var(--fd-agt-mono); }
.fd-agt-hmr { padding: 4px 7px; border-radius: 6px; font: 600 0.625rem/1 var(--fd-agt-mono); letter-spacing: 0.06em; color: #9A9AA5; background: #E2E2E8; transition: background var(--fd-dur-2), color var(--fd-dur-2); }
.fd-agt-hmr.is-on { background: #DCFCE7; color: #15803D; }
.fd-agt-tab { margin: 0 auto; color: #7A7A88; font: 500 0.75rem/1 var(--fd-agt-mono); letter-spacing: -0.01em; transform: translateX(-20px); }
.fd-agt-body { padding: 20px 20px 18px; font: 400 0.8125rem/1.6 var(--fd-agt-mono); color: #C9C9D4; letter-spacing: -0.01em; }
.fd-agt-prompt { display: flex; gap: 10px; padding: 12px 14px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #F2F2F6; min-height: 70px; }
.fd-agt-ps { color: var(--fd-agt-accent); }
.fd-agt-caret { display: inline-block; width: 8px; height: 1.05em; margin: 0 0 -0.18em 1px; background: #F2F2F6; animation: fd-agt-blink 1s steps(1) infinite; }
.fd-agt-plan { list-style: none; margin: 14px 0 0; padding: 0; }
.fd-agt-l { display: flex; gap: 10px; align-items: baseline; margin: 0; padding: 3px 2px; animation: fd-agt-line var(--fd-dur-3) var(--fd-ease-out) both; white-space: nowrap; }
.fd-agt-l > span:nth-child(2) { overflow: hidden; text-overflow: ellipsis; }
.fd-agt-g { flex: none; width: 12px; color: #6B6B7A; }
.fd-agt-l-tool .fd-agt-g, .fd-agt-l-diff .fd-agt-g { color: #4ADE80; }
.fd-agt-think { color: #8A8A99; font-style: italic; }
.fd-agt-l b { font-weight: 600; color: #F2F2F6; }
.fd-agt-arg { color: #C4B5FD; }
.fd-agt-meta { margin-left: auto; padding-left: 10px; color: #6B6B7A; font-size: 0.75rem; }
.fd-agt-add { color: #4ADE80; } .fd-agt-del { color: #F87171; }
.fd-agt-okg { color: #4ADE80; }
.fd-agt-ok { color: #4ADE80; font-weight: 500; }
.fd-agt-working { color: #8A8A99; }
.fd-agt-spin { display: inline-block; flex: none; width: 10px; height: 10px; border-radius: 9999px; border: 1.5px solid #3A3A46; border-top-color: var(--fd-agt-accent); animation: fd-agt-spin 700ms linear infinite; transform: translateY(1px); }
.fd-agt-pr {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 14px 0 0; padding: 12px 14px; border-radius: 10px;
  background: linear-gradient(180deg, rgba(124,92,255,0.14), rgba(124,92,255,0.06)); border: 1px solid rgba(157,133,255,0.3); color: #E6E1FF;
  font: 500 0.75rem/1.4 var(--fd-agt-mono); animation: fd-agt-pop var(--fd-dur-3) var(--fd-spring) both;
}
.fd-agt-pr-b { padding: 3px 7px; border-radius: 6px; background: var(--fd-agt-accent); color: #0B0B0F; font-weight: 700; }
.fd-agt-pr-c { margin-left: auto; color: #4ADE80; }

.fd-agt-app { position: relative; height: calc(100% - 38px); padding: 18px 20px; font: 400 0.8125rem/1.4 var(--fd-agt-sans); }
.fd-agt-app-h { display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 14px; }
.fd-agt-app-h b { font: 600 1.0625rem/1 var(--fd-agt-sans); letter-spacing: -0.02em; }
.fd-agt-app-h span { color: #8A8A95; font: 500 0.75rem/1 var(--fd-agt-sans); }
.fd-agt-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.fd-agt-kpi, .fd-agt-chart, .fd-agt-list {
  border-radius: 12px; background: #fff; box-shadow: 0 0 0 1px rgba(11,11,15,0.06), 0 6px 16px -10px rgba(11,11,15,0.2);
  opacity: 0; transform: translateY(18px) scale(0.97); transition: opacity var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-4) var(--fd-spring);
}
.fd-agt .is-in { opacity: 1; transform: none; }
.fd-agt-kpi { padding: 12px; }
.fd-agt-kpi span { display: block; color: #8A8A95; font: 500 0.6875rem/1 var(--fd-agt-sans); }
.fd-agt-kpi b { display: block; margin: 8px 0 4px; font: 600 1.25rem/1 var(--fd-agt-sans); letter-spacing: -0.03em; color: #0B0B0F; }
.fd-agt-kpi em { font: 500 0.6875rem/1 var(--fd-agt-sans); font-style: normal; color: #16A34A; }
.fd-agt-chart { margin: 10px 0 0; padding: 12px 12px 6px; }
.fd-agt-chart-h { display: flex; justify-content: space-between; color: #6B6B76; font: 500 0.6875rem/1 var(--fd-agt-sans); }
.fd-agt-chart-h em { font-style: normal; color: #9A9AA5; }
.fd-agt-chart svg { display: block; width: 100%; height: 92px; margin-top: 6px; }
.fd-agt-chart .fd-agt-line { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1400ms var(--fd-ease-out) 120ms; }
.fd-agt-chart .fd-agt-area { opacity: 0; transition: opacity 900ms var(--fd-ease-out) 500ms; }
.fd-agt-chart.is-in .fd-agt-line { stroke-dashoffset: 0; }
.fd-agt-chart.is-in .fd-agt-area { opacity: 1; }
.fd-agt-list { margin: 10px 0 0; padding: 4px 12px; }
.fd-agt-row { display: grid; grid-template-columns: 8px 1.1fr 1.2fr auto; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid rgba(11,11,15,0.06); opacity: 0; transform: translateX(-10px); transition: opacity var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-ease-out); }
.fd-agt-row:first-child { border-top: 0; }
.fd-agt-list.is-in .fd-agt-row { opacity: 1; transform: none; }
.fd-agt-row i { display: block; width: 8px; height: 8px; border-radius: 9999px; }
.fd-agt-row b { font: 600 0.75rem/1 var(--fd-agt-sans); color: #1C1C22; }
.fd-agt-row span { font: 400 0.75rem/1 var(--fd-agt-sans); color: #8A8A95; }
.fd-agt-row em { font: 500 0.75rem/1 var(--fd-agt-mono); font-style: normal; color: #1C1C22; }
.fd-agt-toast {
  position: absolute; right: 18px; bottom: 18px; display: flex; align-items: center; gap: 10px; padding: 10px 14px 10px 10px; border-radius: 12px;
  background: #0B0B0F; color: #F2F2F6; font: 500 0.75rem/1 var(--fd-agt-sans); box-shadow: 0 16px 40px -12px rgba(11,11,15,0.6);
  opacity: 0; transform: translateY(16px) scale(0.94); transition: opacity var(--fd-dur-3) var(--fd-ease-out), transform var(--fd-dur-3) var(--fd-spring);
}
.fd-agt-toast.is-in { opacity: 1; transform: none; }
.fd-agt-toast-i { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 9999px; background: #22C55E; color: #0B0B0F; font: 700 0.6875rem/1 var(--fd-agt-sans); }

@keyframes fd-agt-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes fd-agt-blurin { from { opacity: 0; filter: blur(14px); transform: translateY(10px) scale(0.98); } to { opacity: 1; filter: none; transform: none; } }
@keyframes fd-agt-stagein { from { opacity: 0; transform: translateY(80px) scale(0.94); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes fd-agt-line { from { opacity: 0; transform: translateY(6px); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes fd-agt-pop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: none; } }
@keyframes fd-agt-blink { 50% { opacity: 0; } }
@keyframes fd-agt-spin { to { transform: translateY(1px) rotate(360deg); } }
@keyframes fd-agt-breathe { from { opacity: 0.75; transform: translate(-50%, 0) scale(0.96); } to { opacity: 1; transform: translate(-50%, -2%) scale(1.04); } }

@media (max-width: 900px) {
  .fd-agt { padding: 104px 16px 0; min-height: 844px; }
  .fd-agt-stagewrap { margin-top: 44px; }
  .fd-agt-scene { height: 540px; }
  .fd-agt-term { width: 100%; height: 330px; }
  .fd-agt-prev { left: 8%; right: auto; width: 92%; top: 220px; height: 400px; }
  .fd-agt-body { padding: 14px; font-size: 0.75rem; }
  .fd-agt-meta { display: none; }
  .fd-agt-url { padding: 5px 14px; }
  .fd-agt-cli { display: none; }
  .fd-agt-eyebrow { font-size: 0.6875rem; letter-spacing: -0.02em; white-space: nowrap; padding: 7px 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-agt *, .fd-agt *::before { animation: none !important; transition-duration: 1ms !important; transition-delay: 0ms !important; }
}
@media (prefers-reduced-transparency: reduce) { .fd-agt-term { background: #0E0E13; -webkit-backdrop-filter: none; backdrop-filter: none; } }
`;

/* ───────────────────────── Demo ───────────────────────── */

export function Demo() {
  return (
    <div className="fd-agt-demo">
      <style>{demoCss}</style>
      <header className="fd-agt-demo-nav">
        <a className="fd-agt-demo-logo" href="#top">
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <path d="M3 3h14v4H7v3h8v4H7v3H3z" fill="#F5F5F8" />
          </svg>
          fathom
        </a>
        <nav aria-label="Primary">
          <a href="#product">Product</a>
          <a href="#docs">Docs</a>
          <a href="#changelog">Changelog</a>
          <a href="#enterprise">Enterprise</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="fd-agt-demo-r">
          <a href="#gh" className="fd-agt-demo-gh">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 .2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L8 12.6l-4.8 2.5.9-5.4L.2 5.9l5.4-.8z" /></svg>
            41.2k
          </a>
          <a href="#login" className="fd-agt-demo-in">Log in</a>
        </div>
      </header>
      <HeroAiTerminal />
    </div>
  );
}

const demoCss = `
.fd-agt-demo { position: relative; margin: 0; padding: 0; min-height: 100vh; background: #07070A; }
.fd-agt-demo *, .fd-agt-demo *::before, .fd-agt-demo *::after { box-sizing: border-box; }
.fd-agt-demo-nav {
  position: absolute; z-index: 10; top: 0; left: 0; right: 0; max-width: 1180px; margin: 0 auto; height: 68px; padding: 0 32px;
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.fd-agt-demo-nav .fd-agt-demo-logo { display: inline-flex; align-items: center; gap: 9px; margin: 0; color: #F5F5F8; text-decoration: none; font: 600 1.0625rem/1 ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: -0.04em; }
.fd-agt-demo-logo svg { display: block; }
.fd-agt-demo-nav nav { display: flex; gap: 28px; }
.fd-agt-demo-nav a { color: #9C9CAA; text-decoration: none; font: 500 0.875rem/1 ui-sans-serif, -apple-system, "Inter", sans-serif; letter-spacing: -0.005em; transition: color 120ms; }
.fd-agt-demo-nav a:hover { color: #F5F5F8; }
.fd-agt-demo-nav a:focus-visible { outline: 2px solid rgba(157,133,255,.7); outline-offset: 2px; border-radius: 6px; }
.fd-agt-demo-r { display: flex; align-items: center; gap: 18px; }
.fd-agt-demo-gh { display: inline-flex; align-items: center; gap: 6px; font-family: ui-monospace, "SF Mono", Menlo, monospace !important; }
.fd-agt-demo-gh svg { display: block; color: #FEBC2E; }
.fd-agt-demo-in { display: inline-flex; align-items: center; height: 32px; padding: 0 14px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.14); color: #F5F5F8 !important; }
@media (max-width: 900px) { .fd-agt-demo-nav { padding: 0 16px; } .fd-agt-demo-nav nav, .fd-agt-demo-gh { display: none !important; } }
`;
