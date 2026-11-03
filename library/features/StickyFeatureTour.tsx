/**
 * StickyFeatureTour, a scroll-driven product tour for a developer tool. The
 * left column is a numbered list of steps with a progress rail; the right
 * column stays pinned and crossfades between product visuals built in code
 * (terminal, schema diff, query result, deploy log) as each step crosses the
 * middle of the viewport. On narrow screens each visual sits inline under its
 * step instead.
 *
 * Props: eyebrow, title, lede, steps ({ id, kicker, title, body, meta, visual }).
 * `visual` is any ReactNode, so you can drop in screenshots or your own UI.
 * CSS vars: --fd-stt-bg, --fd-stt-ink, --fd-stt-amber.
 *
 * Browser support: position: sticky (all evergreen browsers).
 * Motion: one rAF-throttled scroll listener reads getBoundingClientRect and
 * sets the active step plus a rail fill (transform only). Lines inside the
 * active visual stagger in with CSS transitions.
 * Accessibility: steps are an ordered list; each step title is a button that
 * scrolls its step into view; the pinned visual is aria-hidden because every
 * step carries a text description (the inline mobile copy is the same UI).
 * Reduced motion: no translate, no stagger, panes swap with a short fade.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface SttStep {
  id: string;
  kicker: string;
  title: string;
  body: ReactNode;
  meta?: string[];
  visual: ReactNode;
  file?: string;
}

export interface StickyFeatureTourProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  steps?: SttStep[];
  className?: string;
}

/* ───────────── visuals ───────────── */
const L = ({ i, c, children }: { i: number; c?: string; children: ReactNode }) => (
  <div className={`fd-stt-ln${c ? " fd-stt-" + c : ""}`} style={{ ["--i" as string]: i }}>{children}</div>
);

function TerminalVisual() {
  return (
    <div className="fd-stt-term">
      <L i={0}><span className="fd-stt-ps">~/api</span> <span className="fd-stt-am">$</span> tide branch create pr-482 --from main</L>
      <L i={1} c="dim">  resolving main@a91f3e2 ............ 212.4 GB</L>
      <L i={2} c="dim">  copy-on-write snapshot ............. <span className="fd-stt-ok">done</span> 1.8s</L>
      <L i={3} c="dim">  compute: 2 vCPU, scales to zero after 5 min idle</L>
      <L i={4}>&nbsp;</L>
      <L i={5}><span className="fd-stt-ok">●</span> branch <b>pr-482</b> is ready</L>
      <L i={6}><span className="fd-stt-dim">  url</span>  postgres://pr-482.eu-central.tidepool.dev/api</L>
      <L i={7}><span className="fd-stt-dim">  cost</span> €0.004 / hour while awake</L>
      <L i={8}>&nbsp;</L>
      <L i={9}><span className="fd-stt-ps">~/api</span> <span className="fd-stt-am">$</span> <span className="fd-stt-caret" /></L>
    </div>
  );
}

function DiffVisual() {
  const rows: [string, string, string][] = [
    [" ", "41", "create table invoices ("],
    [" ", "42", "  id          uuid primary key,"],
    [" ", "43", "  customer_id uuid not null references customers,"],
    ["-", "44", "  amount      integer not null,"],
    ["+", "44", "  amount_minor bigint not null,"],
    ["+", "45", "  currency    char(3) not null default 'EUR',"],
    [" ", "46", "  issued_at   timestamptz not null default now()"],
    [" ", "47", ");"],
    [" ", "48", ""],
    ["+", "49", "create index concurrently invoices_customer_idx"],
    ["+", "50", "  on invoices (customer_id, issued_at desc);"],
  ];
  return (
    <div className="fd-stt-diff">
      <div className="fd-stt-diff-h"><span>migrations/0042_invoice_currency.sql</span><span><b className="fd-stt-ok">+4</b> <b className="fd-stt-bad">−1</b></span></div>
      {rows.map(([s, n, t], i) => (
        <L key={i} i={i} c={s === "+" ? "add" : s === "-" ? "del" : undefined}>
          <span className="fd-stt-gut">{n}</span><span className="fd-stt-sign">{s}</span>{t}
        </L>
      ))}
      <L i={12} c="note"><span className="fd-stt-am">▲</span> tide check: index built concurrently, no table lock. Safe for 1.2M rows.</L>
    </div>
  );
}

function QueryVisual() {
  const rows = [
    ["c_81f2", "m•••@k•••.de", "Team", "€1,240.00"],
    ["c_1a07", "j•••@o•••.io", "Scale", "€8,910.50"],
    ["c_77c3", "a•••@f•••.se", "Team", "€412.00"],
    ["c_3e90", "l•••@h•••.nl", "Starter", "€39.00"],
    ["c_c214", "s•••@v•••.ch", "Scale", "€12,077.25"],
  ];
  return (
    <div className="fd-stt-q">
      <L i={0}><span className="fd-stt-am">pr-482=&gt;</span> select id, email, plan, sum(amount_minor)/100.0</L>
      <L i={1}><span className="fd-stt-am">      -&gt;</span>   from customers join invoices using (customer_id)</L>
      <L i={2}><span className="fd-stt-am">      -&gt;</span>   group by 1,2,3 order by 4 desc limit 5;</L>
      <div className="fd-stt-tbl" style={{ ["--i" as string]: 3 }}>
        <div className="fd-stt-tr fd-stt-th"><span>id</span><span>email</span><span>plan</span><span>total</span></div>
        {rows.map((r, i) => (
          <div key={r[0]} className="fd-stt-tr fd-stt-ln" style={{ ["--i" as string]: 4 + i }}>
            {r.map((c, k) => <span key={k} className={k === 1 ? "fd-stt-mask" : undefined}>{c}</span>)}
          </div>
        ))}
      </div>
      <L i={10} c="dim">(5 rows, 14 ms) · PII masked by policy <span className="fd-stt-am">mask_emails</span></L>
    </div>
  );
}

function DeployVisual() {
  const steps = [
    ["Schema check", "0 blocking locks", "0.4s"],
    ["Backfill amount_minor", "1,204,388 rows", "38.2s"],
    ["Swap reads", "0 ms write pause", "0.1s"],
    ["Drop amount", "scheduled after 24h", "queued"],
  ];
  return (
    <div className="fd-stt-dep">
      <div className="fd-stt-dep-h">
        <span><b>Merge pr-482</b> into main</span>
        <span className="fd-stt-pill">Live</span>
      </div>
      {steps.map(([a, b, c], i) => (
        <div key={a} className="fd-stt-dep-r fd-stt-ln" data-q={c === "queued" ? "" : undefined} style={{ ["--i" as string]: i * 2 }}>
          <span className="fd-stt-dep-ic">{c === "queued" ? "" : "✓"}</span>
          <span className="fd-stt-dep-a">{a}<small>{b}</small></span>
          <span className="fd-stt-dep-t">{c}</span>
        </div>
      ))}
      <div className="fd-stt-spark fd-stt-ln" style={{ ["--i" as string]: 9 }}>
        <span>p95 latency, main</span>
        <svg viewBox="0 0 240 40" preserveAspectRatio="none">
          <path d="M0 26 L20 25 L40 27 L60 24 L80 26 L100 25 L120 27 L140 25 L160 26 L180 24 L200 26 L220 25 L240 26" />
          <line x1="132" x2="132" y1="0" y2="40" />
        </svg>
        <span className="fd-stt-dim">flat through the swap, 11.8 ms</span>
      </div>
    </div>
  );
}

const DEFAULT_STEPS: SttStep[] = [
  {
    id: "branch", kicker: "Branch", file: "zsh", title: "A full copy of production in under two seconds.",
    body: "Open a pull request and Tidepool forks your database with it. Copy-on-write, so a 200 GB branch costs you the rows you change, not the rows you have.",
    meta: ["1.8s for 212 GB", "Scales to zero"], visual: <TerminalVisual />,
  },
  {
    id: "migrate", kicker: "Migrate", file: "0042_invoice_currency.sql", title: "Read the migration as a diff, not a prayer.",
    body: "Schema changes show up next to your code review. tide check flags table locks, missing concurrent indexes and long backfills before anyone hits merge.",
    meta: ["17 lock rules", "Runs in CI"], visual: <DiffVisual />,
  },
  {
    id: "query", kicker: "Preview", file: "psql", title: "Real data, with the personal bits blurred.",
    body: "Branches carry production-shaped data. Masking policies rewrite emails, names and IBANs on the way out, so your preview app and your contractor see the same shape and none of the secrets.",
    meta: ["GDPR masking", "Per-column policies"], visual: <QueryVisual />,
  },
  {
    id: "merge", kicker: "Merge", file: "deploy · main", title: "Ship it without a maintenance window.",
    body: "Merging replays the migration on main in expand and contract phases. Reads swap over atomically; the old column waits 24 hours in case you change your mind.",
    meta: ["0 ms write pause", "24h undo"], visual: <DeployVisual />,
  },
];

export function StickyFeatureTour({
  eyebrow = "tidepool / how it works",
  title = <>Every pull request<br />gets its own <span>database.</span></>,
  lede = "Postgres that branches like git. Four steps from a laptop to production, none of them a staging server.",
  steps = DEFAULT_STEPS,
  className,
}: StickyFeatureTourProps) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const tid = useId();

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const items = Array.from(list.querySelectorAll<HTMLElement>("[data-step]"));
      const mid = window.innerHeight * 0.5;
      let a = 0;
      items.forEach((el, i) => { if (el.getBoundingClientRect().top < mid) a = i; });
      setActive(a);
      const lr = list.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (mid - lr.top) / Math.max(1, lr.height)));
      if (railRef.current) railRef.current.style.transform = `scaleY(${p})`;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [steps.length]);

  const go = (i: number) => {
    const el = listRef.current?.querySelectorAll<HTMLElement>("[data-step]")[i];
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3;
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section className={`fd-stt${className ? " " + className : ""}`} aria-labelledby={tid}>
      <style>{css}</style>
      <header className="fd-stt-head">
        <p className="fd-stt-eyebrow">{eyebrow}</p>
        <h2 id={tid} className="fd-stt-title">{title}</h2>
        <p className="fd-stt-lede">{lede}</p>
      </header>
      <div className="fd-stt-body">
        <div className="fd-stt-left">
          <div className="fd-stt-rail" aria-hidden="true"><span ref={railRef} /></div>
          <ol className="fd-stt-steps" ref={listRef}>
            {steps.map((s, i) => (
              <li key={s.id} data-step="" className="fd-stt-step" data-on={i === active ? "" : undefined} data-past={i < active ? "" : undefined}>
                <span className="fd-stt-node" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <p className="fd-stt-kicker">{s.kicker}</p>
                <h3 className="fd-stt-h">
                  <button type="button" onClick={() => go(i)} aria-current={i === active ? "step" : undefined}>{s.title}</button>
                </h3>
                <p className="fd-stt-p">{s.body}</p>
                {s.meta && <ul className="fd-stt-meta">{s.meta.map((m) => <li key={m}>{m}</li>)}</ul>}
                <div className="fd-stt-inline" data-on="">
                  <Frame file={s.file} kicker={s.kicker} index={i} total={steps.length}>{s.visual}</Frame>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="fd-stt-right" aria-hidden="true">
          <div className="fd-stt-sticky">
            <div className="fd-stt-stack">
              {steps.map((s, i) => (
                <div key={s.id} className="fd-stt-pane" data-on={i === active ? "" : undefined} data-dir={i < active ? "up" : "down"}>
                  <Frame file={s.file} kicker={s.kicker} index={i} total={steps.length}>{s.visual}</Frame>
                </div>
              ))}
            </div>
            <div className="fd-stt-dots">
              {steps.map((s, i) => <i key={s.id} data-on={i === active ? "" : undefined} />)}
              <span>{String(active + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Frame({ file, kicker, index, total, children }: { file?: string; kicker: string; index: number; total: number; children: ReactNode }) {
  return (
    <div className="fd-stt-frame">
      <div className="fd-stt-bar">
        <span className="fd-stt-lights"><i /><i /><i /></span>
        <span className="fd-stt-file">{file ?? kicker}</span>
        <span className="fd-stt-idx">{index + 1}/{total}</span>
      </div>
      <div className="fd-stt-screen">{children}</div>
    </div>
  );
}

const css = `
:where(.fd-stt,.fd-stt *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-stt,.fd-stt *)::before,:where(.fd-stt,.fd-stt *)::after{box-sizing:border-box}
:where(.fd-stt svg){display:block;flex-shrink:0}
:where(.fd-stt button){appearance:none;-webkit-appearance:none;outline:0;border-radius:0;cursor:pointer;text-align:left}
.fd-stt{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-stt-bg:#0C0E0C;--fd-stt-ink:#ECE6D6;--fd-stt-mut:#8C8878;--fd-stt-dim:#5E5B50;--fd-stt-line:rgba(236,230,214,.1);--fd-stt-amber:#FFB224;--fd-stt-ok:#8BD17C;--fd-stt-bad:#F2766B;
  --fd-stt-panel:#131612;--fd-stt-screen:#0A0B09;
  --fd-stt-sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --fd-stt-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  display:block;width:100%;background:var(--fd-stt-bg);color:var(--fd-stt-ink);padding:clamp(64px,9vw,128px) clamp(16px,4vw,56px) clamp(64px,10vw,160px);
  font:400 15px/1.5 var(--fd-stt-sans);-webkit-font-smoothing:antialiased;
  background-image:radial-gradient(circle at 1px 1px,rgba(236,230,214,.06) 1px,transparent 0);background-size:24px 24px}
.fd-stt-head{max-width:1240px;margin:0 auto clamp(48px,7vw,96px);display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px 48px;align-items:end}
.fd-stt-eyebrow{grid-column:1 / -1;font:500 13px/16px var(--fd-stt-mono);color:var(--fd-stt-amber);letter-spacing:0}
.fd-stt-eyebrow::before{content:"";display:inline-block;width:8px;height:8px;margin-right:10px;background:var(--fd-stt-amber);vertical-align:0}
.fd-stt-title{font:500 clamp(2.25rem,5.2vw,4.5rem)/1 var(--fd-stt-mono);letter-spacing:-.06em;color:var(--fd-stt-ink)}
.fd-stt-title span{color:var(--fd-stt-amber)}
.fd-stt-lede{font:400 16px/1.55 var(--fd-stt-sans);color:var(--fd-stt-mut)}
.fd-stt-body{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:72px}
.fd-stt-left{position:relative;padding-left:64px}
.fd-stt-rail{position:absolute;left:19px;top:8px;bottom:0;width:1px;background:var(--fd-stt-line)}
.fd-stt-rail span{display:block;width:100%;height:100%;background:var(--fd-stt-amber);transform-origin:top;transform:scaleY(0)}
.fd-stt-step{position:relative;min-height:62vh;padding-bottom:64px;opacity:.42;transition:opacity var(--fd-dur-3) var(--fd-ease-out)}
.fd-stt-step:last-child{min-height:48vh}
.fd-stt-step[data-on]{opacity:1}
.fd-stt-node{position:absolute;left:-64px;top:0;width:40px;height:26px;display:grid;place-items:center;border-radius:4px;background:var(--fd-stt-bg);box-shadow:inset 0 0 0 1px var(--fd-stt-line);font:500 12px/1 var(--fd-stt-mono);color:var(--fd-stt-mut);transition:background-color var(--fd-dur-2) var(--fd-ease-in-out),color var(--fd-dur-2)}
.fd-stt-step[data-on] .fd-stt-node,.fd-stt-step[data-past] .fd-stt-node{background:var(--fd-stt-amber);color:#1A1405;box-shadow:none}
.fd-stt-kicker{font:500 12px/26px var(--fd-stt-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--fd-stt-mut)}
.fd-stt-h{margin-top:12px;font:600 clamp(1.5rem,2.4vw,2rem)/1.15 var(--fd-stt-sans);letter-spacing:-.03em;color:var(--fd-stt-ink)}
.fd-stt-h button{display:block;font:inherit;color:inherit;border-radius:4px}
.fd-stt-h button:hover{color:#fff}
.fd-stt-h button:focus-visible{outline:2px solid rgba(255,178,36,.7);outline-offset:4px}
.fd-stt-p{margin-top:16px;max-width:46ch;font:400 16px/1.6 var(--fd-stt-sans);color:var(--fd-stt-mut)}
.fd-stt-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.fd-stt-meta li{font:500 12px/16px var(--fd-stt-mono);padding:5px 9px;border-radius:4px;color:var(--fd-stt-ink);box-shadow:inset 0 0 0 1px var(--fd-stt-line)}
.fd-stt-inline{display:none;margin-top:28px}
.fd-stt-right{position:relative}
.fd-stt-sticky{position:sticky;top:calc(50vh - 230px);height:auto}
.fd-stt-stack{position:relative;height:420px}
.fd-stt-pane{position:absolute;inset:0;opacity:0;transform:translateY(18px) scale(.985);transition:opacity var(--fd-dur-3) var(--fd-ease-in-out),transform var(--fd-dur-4) var(--fd-ease-out);pointer-events:none}
.fd-stt-pane[data-dir="up"]{transform:translateY(-18px) scale(.985)}
.fd-stt-pane[data-on]{opacity:1;transform:none}
.fd-stt-dots{display:flex;align-items:center;gap:6px;margin-top:20px;font:500 12px/16px var(--fd-stt-mono);color:var(--fd-stt-mut)}
.fd-stt-dots i{display:block;width:18px;height:2px;background:var(--fd-stt-line);transition:background-color var(--fd-dur-2),width var(--fd-dur-3) var(--fd-ease-out)}
.fd-stt-dots i[data-on]{background:var(--fd-stt-amber);width:36px}
.fd-stt-dots span{margin-left:auto}
.fd-stt-frame{height:100%;display:flex;flex-direction:column;border-radius:12px;background:var(--fd-stt-panel);box-shadow:0 0 0 1px var(--fd-stt-line),0 40px 80px -40px rgba(0,0,0,.8);overflow:hidden}
.fd-stt-bar{display:flex;align-items:center;gap:14px;height:38px;padding:0 14px;border-bottom:1px solid var(--fd-stt-line);font:500 12px/1 var(--fd-stt-mono);color:var(--fd-stt-mut)}
.fd-stt-lights{display:flex;gap:6px}
.fd-stt-lights i{display:block;width:9px;height:9px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(236,230,214,.22)}
.fd-stt-file{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fd-stt-ink)}
.fd-stt-screen{flex:1;padding:20px 22px;background:var(--fd-stt-screen);font:400 13px/22px var(--fd-stt-mono);color:var(--fd-stt-ink);overflow:hidden}
.fd-stt-ln{white-space:pre;overflow:hidden;text-overflow:ellipsis;opacity:0;transform:translateX(-6px);transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-ease-out);transition-delay:0ms}
[data-on]>.fd-stt-frame .fd-stt-ln,.fd-stt-inline .fd-stt-ln{opacity:1;transform:none;transition-delay:calc(180ms + var(--i) * 55ms)}
.fd-stt-dim,.fd-stt-ln.fd-stt-dim{color:var(--fd-stt-dim)}
.fd-stt-ps{color:var(--fd-stt-mut)}
.fd-stt-am{color:var(--fd-stt-amber)}
.fd-stt-ok{color:var(--fd-stt-ok)}
.fd-stt-bad{color:var(--fd-stt-bad)}
.fd-stt-term b{font-weight:700;color:#fff}
.fd-stt-caret{display:inline-block;width:8px;height:15px;vertical-align:-3px;background:var(--fd-stt-amber);animation:fd-stt-blink 1s steps(1) infinite}
@keyframes fd-stt-blink{50%{opacity:0}}
.fd-stt-diff{margin:-20px -22px}
.fd-stt-diff-h{display:flex;justify-content:space-between;padding:10px 22px;border-bottom:1px solid var(--fd-stt-line);font:500 12px/18px var(--fd-stt-mono);color:var(--fd-stt-mut)}
.fd-stt-diff-h b{font-weight:600}
.fd-stt-diff .fd-stt-ln{padding:0 22px 0 0}
.fd-stt-gut{display:inline-block;width:44px;padding-right:12px;text-align:right;color:var(--fd-stt-dim)}
.fd-stt-sign{display:inline-block;width:18px;color:var(--fd-stt-dim)}
.fd-stt-add{background:rgba(139,209,124,.09);color:#CFEBC6}.fd-stt-add .fd-stt-sign{color:var(--fd-stt-ok)}
.fd-stt-del{background:rgba(242,118,107,.09);color:#F1C3BD;text-decoration:line-through;text-decoration-color:rgba(242,118,107,.5)}.fd-stt-del .fd-stt-sign{color:var(--fd-stt-bad)}
.fd-stt-note{margin:14px 22px 0;padding:10px 12px!important;border-radius:6px;background:rgba(255,178,36,.08);box-shadow:inset 0 0 0 1px rgba(255,178,36,.25);white-space:normal!important;color:var(--fd-stt-ink);line-height:18px}
.fd-stt-tbl{margin-top:14px;border-top:1px solid var(--fd-stt-line)}
.fd-stt-tr{display:grid;grid-template-columns:70px minmax(0,1fr) 70px 96px;gap:12px;padding:5px 0;border-bottom:1px solid var(--fd-stt-line)}
.fd-stt-tr span:last-child{text-align:right}
.fd-stt-th{color:var(--fd-stt-mut);font-size:12px}
.fd-stt-mask{color:var(--fd-stt-amber);filter:none}
.fd-stt-q>.fd-stt-ln:last-child{margin-top:12px}
.fd-stt-dep-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;font:400 14px/20px var(--fd-stt-sans);color:var(--fd-stt-mut)}
.fd-stt-dep-h b{font-weight:600;color:var(--fd-stt-ink)}
.fd-stt-pill{font:600 11px/1 var(--fd-stt-mono);letter-spacing:.08em;text-transform:uppercase;padding:5px 8px;border-radius:4px;background:var(--fd-stt-ok);color:#0C1A08}
.fd-stt-dep-r{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--fd-stt-line);white-space:normal}
.fd-stt-dep-ic{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:rgba(139,209,124,.15);color:var(--fd-stt-ok);font-size:11px;line-height:1}
.fd-stt-dep-r[data-q] .fd-stt-dep-ic{background:none;box-shadow:inset 0 0 0 1px var(--fd-stt-dim)}
.fd-stt-dep-a{display:flex;flex-direction:column;font:500 13px/18px var(--fd-stt-sans)}
.fd-stt-dep-a small{font:400 12px/16px var(--fd-stt-mono);color:var(--fd-stt-mut)}
.fd-stt-dep-t{font:400 12px/16px var(--fd-stt-mono);color:var(--fd-stt-mut)}
.fd-stt-dep-r[data-q] .fd-stt-dep-t{color:var(--fd-stt-amber)}
.fd-stt-spark{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 16px;margin-top:16px;font:400 12px/16px var(--fd-stt-mono);color:var(--fd-stt-mut);white-space:normal}
.fd-stt-spark svg{order:3;flex-basis:100%;width:100%;height:36px}
.fd-stt-spark path{fill:none;stroke:var(--fd-stt-ok);stroke-width:1.5;vector-effect:non-scaling-stroke}
.fd-stt-spark line{stroke:var(--fd-stt-amber);stroke-dasharray:2 3;vector-effect:non-scaling-stroke}
@media (max-width:960px){
  .fd-stt-head{grid-template-columns:1fr}
  .fd-stt-body{grid-template-columns:minmax(0,1fr);gap:0}
  .fd-stt-left,.fd-stt-step,.fd-stt-inline{min-width:0}
  .fd-stt-right{display:none}
  .fd-stt-inline{display:block}
  .fd-stt-inline .fd-stt-frame{height:auto}
  .fd-stt-step{opacity:1;min-height:0}
  .fd-stt-left{padding-left:52px}
  .fd-stt-node{left:-52px;width:34px}
  .fd-stt-rail{left:16px}
  .fd-stt-screen{padding:16px;font-size:11.5px;line-height:19px}
  .fd-stt-diff{margin:-16px}
  .fd-stt-tr{grid-template-columns:52px minmax(0,1fr) 52px 76px;gap:8px}
}
@media (max-width:520px){
  .fd-stt-left{padding-left:0}
  .fd-stt-rail{display:none}
  .fd-stt-node{position:static;display:inline-grid;margin-bottom:12px}
  .fd-stt-inline{margin-left:-4px;margin-right:-4px}
}
@media (prefers-reduced-motion:reduce){
  .fd-stt-pane,.fd-stt-pane[data-dir="up"]{transform:none;transition:opacity 120ms linear}
  .fd-stt-ln{transform:none;transition:none!important;opacity:1}
  .fd-stt-caret{animation:none}
  .fd-stt *{scroll-behavior:auto}
}
@media (prefers-contrast:more){.fd-stt-frame{box-shadow:0 0 0 1px currentColor}}
`;

export function Demo() {
  return (
    <div className="fd-sttd">
      <style>{`.fd-sttd{background:#0C0E0C;min-height:100vh}.fd-sttd-nav{box-sizing:border-box;max-width:1352px;margin:0 auto;height:60px;padding:0 clamp(16px,4vw,56px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(236,230,214,.1);font:500 13px/18px ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;color:#8C8878}.fd-sttd-nav b{font-weight:700;color:#ECE6D6;letter-spacing:-.04em;font-size:16px}.fd-sttd-nav b i{font-style:normal;color:#FFB224}.fd-sttd-end{box-sizing:border-box;padding:56px 16px 96px;text-align:center;font:500 13px/18px ui-monospace,"SF Mono",Menlo,monospace;color:#8C8878;border-top:1px solid rgba(236,230,214,.1)}.fd-sttd-end b{color:#FFB224;font-weight:500}`}</style>
      <div className="fd-sttd-nav"><b>tidepool<i>_</i></b><span>docs  pricing  status</span></div>
      <StickyFeatureTour />
      <div className="fd-sttd-end"><b>$</b> brew install tidepool/tap/tide</div>
    </div>
  );
}
