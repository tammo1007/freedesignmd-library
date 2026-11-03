/**
 * HeroSplitScreen: a two-story hero for a bank with two products. Two flat
 * colour fields, "Spend" and "Save", each with its own type voice, product
 * fragment and call to action. Hovering, focusing or tapping a half springs
 * it open and squeezes the other; a round seal rides the seam between them.
 * On phones the halves stack and the tapped one opens.
 *
 * Props: brand, spend and save (label, word, lede, cta, fine print), and the
 * product data (transactions, pot, balance). Each half is a SplitSide.
 * CSS vars: --fd-spl-spend, --fd-spl-spend-ink, --fd-spl-save, --fd-spl-save-ink.
 *
 * Browser support: all evergreen browsers (container query units for the
 * giant words; fixed sizes otherwise).
 * Motion: flex-grow with the library spring curve (overshoot), word size
 * follows via cqw. The savings balance accrues a cent at a time.
 * prefers-reduced-motion: halves swap size instantly, no accrual ticking.
 * Accessibility: each half's title is a button with aria-expanded that opens
 * it; details stay in the accessibility tree when collapsed.
 */
import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";

export interface SplitSide {
  index: string;
  word: string;
  lede: ReactNode;
  cta: { label: string; href: string };
  fine: ReactNode;
}

export interface SplitTxn {
  merchant: string;
  place: string;
  amount: string;
  roundUp: string;
  time: string;
  glyph: string;
}

export interface HeroSplitScreenProps {
  brand?: string;
  spend?: SplitSide;
  save?: SplitSide;
  transactions?: SplitTxn[];
  pot?: { name: string; saved: number; goal: number; due: string };
  balance?: number;
  rate?: string;
  defaultActive?: "spend" | "save" | null;
}

const SPEND: SplitSide = {
  index: "01",
  word: "Spend",
  lede: "A debit card that tells you where the money went before you have left the shop.",
  cta: { label: "Get the card", href: "#card" },
  fine: "No fees abroad in 31 countries. Freeze it from your lock screen.",
};

const SAVE: SplitSide = {
  index: "02",
  word: "Save",
  lede: "Pots that fill themselves with your spare change, at 2.75% paid every month.",
  cta: { label: "Open a pot", href: "#pots" },
  fine: "Deposits protected up to €100,000 by the German deposit scheme.",
};

const TXNS: SplitTxn[] = [
  { merchant: "Bäckerei Rösler", place: "Prenzlauer Berg", amount: "−€3.40", roundUp: "+€0.60", time: "08:12", glyph: "B" },
  { merchant: "BVG Monatskarte", place: "Berlin AB", amount: "−€58.00", roundUp: "+€0.00", time: "08:40", glyph: "U" },
  { merchant: "Dussmann", place: "Friedrichstraße", amount: "−€22.75", roundUp: "+€0.25", time: "13:05", glyph: "D" },
];

const fmt = (n: number) =>
  "€" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function HeroSplitScreen({
  brand = "Kontor",
  spend = SPEND,
  save = SAVE,
  transactions = TXNS,
  pot = { name: "Lisbon in June", saved: 1840, goal: 2400, due: "by 14 May" },
  balance = 4182.36,
  rate = "2.75% AER",
  defaultActive = null,
}: HeroSplitScreenProps) {
  const [active, setActive] = useState<"spend" | "save" | null>(defaultActive);
  const [bal, setBal] = useState(balance);
  const [isTouch, setIsTouch] = useState(false);
  const ringId = "fd-spl-ring" + useId().replace(/:/g, "");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const sync = () => {
      setIsTouch(mq.matches);
      if (mq.matches) setActive((a) => a ?? "spend");
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let id = 0;
    const tick = () => {
      if (!document.hidden) setBal((b) => Math.round((b + 0.01) * 100) / 100);
      id = window.setTimeout(tick, 1400);
    };
    id = window.setTimeout(tick, 1400);
    return () => window.clearTimeout(id);
  }, []);

  const state = active ? `is-${active}` : "is-even";
  const pct = Math.round((pot.saved / pot.goal) * 100);

  const enter = (s: "spend" | "save") => {
    if (!isTouch) setActive(s);
  };

  return (
    <section
      className={`fd-spl ${state}`}
      aria-label={`${brand}: ${spend.word} and ${save.word}`}
      onPointerLeave={(e) => e.pointerType === "mouse" && !isTouch && setActive(defaultActive)}
    >
      <style>{css}</style>

      {/* SPEND */}
      <div
        className={`fd-spl-half fd-spl-spend${active === "spend" ? " is-open" : ""}${active === "save" ? " is-shut" : ""}`}
        onPointerMove={(e) => e.pointerType === "mouse" && active !== "spend" && enter("spend")}
        onClick={() => isTouch && setActive("spend")}
        onFocus={() => enter("spend")}
      >
        <div className="fd-spl-clip">
          <header className="fd-spl-top">
            <a className="fd-spl-logo" href="#top" aria-label={`${brand}, home`}>
              <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
                <rect x="1" y="1" width="26" height="26" rx="6" fill="currentColor" />
                <path d="M9 7v14M9 14l9-7M12 12l7 9" stroke="#FF5B2E" strokeWidth="2.6" fill="none" strokeLinecap="square" />
              </svg>
              <span>{brand.toLowerCase()}</span>
            </a>
            <span className="fd-spl-tag">Personal, Business, Kids</span>
          </header>

          <div className="fd-spl-body">
            <button
              type="button"
              className="fd-spl-head"
              aria-expanded={active === "spend"}
              onClick={() => setActive("spend")}
            >
              <span className="fd-spl-idx">{spend.index} / {spend.word}</span>
              <span className="fd-spl-word fd-spl-word-spend">{spend.word}.</span>
            </button>

            <div className="fd-spl-detail">
              <div className="fd-spl-detail-in">
              <p className="fd-spl-lede">{spend.lede}</p>
              <ul className="fd-spl-feed" aria-label="Today on your card">
                {transactions.map((t) => (
                  <li key={t.merchant} className="fd-spl-txn">
                    <span className="fd-spl-glyph" aria-hidden="true">{t.glyph}</span>
                    <span className="fd-spl-txn-m">
                      <b>{t.merchant}</b>
                      <span>{t.place}, {t.time}</span>
                    </span>
                    <span className="fd-spl-txn-a">
                      <b>{t.amount}</b>
                      <span>{t.roundUp} to Save</span>
                    </span>
                  </li>
                ))}
              </ul>
              </div>
            </div>

            <div className="fd-spl-foot">
              <a className="fd-spl-cta fd-spl-cta-spend" href={spend.cta.href}>
                {spend.cta.label}
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
              </a>
              <p className="fd-spl-fine">{spend.fine}</p>
            </div>
          </div>
        </div>
        <div className="fd-spl-seal" aria-hidden="true">
          <svg viewBox="0 0 100 100" width="100" height="100">
            <defs>
              <path id={ringId} d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
            </defs>
            <circle cx="50" cy="50" r="49" fill="#1A0F0A" />
            <text className="fd-spl-seal-t">
              <textPath href={`#${ringId}`}>ONE ACCOUNT, TWO HALVES, ONE APP, </textPath>
            </text>
            <text x="50" y="58" textAnchor="middle" className="fd-spl-seal-or">&amp;</text>
          </svg>
        </div>
      </div>

      {/* SAVE */}
      <div
        className={`fd-spl-half fd-spl-save${active === "save" ? " is-open" : ""}${active === "spend" ? " is-shut" : ""}`}
        onPointerMove={(e) => e.pointerType === "mouse" && active !== "save" && enter("save")}
        onClick={() => isTouch && setActive("save")}
        onFocus={() => enter("save")}
      >
        <div className="fd-spl-clip">
          <header className="fd-spl-top fd-spl-top-r">
            <a className="fd-spl-login" href="#login">Log in</a>
            <a className="fd-spl-open" href="#open">Open an account</a>
          </header>

          <div className="fd-spl-body">
            <button
              type="button"
              className="fd-spl-head"
              aria-expanded={active === "save"}
              onClick={() => setActive("save")}
            >
              <span className="fd-spl-idx">{save.index} / {save.word}</span>
              <span className="fd-spl-word fd-spl-word-save">{save.word}.</span>
            </button>

            <div className="fd-spl-detail">
              <div className="fd-spl-detail-in">
              <p className="fd-spl-lede">{save.lede}</p>
              <div className="fd-spl-pot">
                <div className="fd-spl-pot-row">
                  <span className="fd-spl-pot-name">{pot.name}</span>
                  <span className="fd-spl-pot-due">{pct}%, {pot.due}</span>
                </div>
                <div className="fd-spl-bar" role="img" aria-label={`${pct}% of ${fmt(pot.goal)} saved`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="fd-spl-pot-row fd-spl-pot-nums">
                  <span>{fmt(pot.saved)}</span>
                  <span>of {fmt(pot.goal)}</span>
                </div>
              </div>
              <div className="fd-spl-bal">
                <span className="fd-spl-bal-l">All pots, earning {rate}</span>
                <span className="fd-spl-bal-v">{fmt(bal)}</span>
              </div>
              </div>
            </div>

            <div className="fd-spl-foot">
              <a className="fd-spl-cta fd-spl-cta-save" href={save.cta.href}>
                {save.cta.label}
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
              </a>
              <p className="fd-spl-fine">{save.fine}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const css = `
.fd-spl, .fd-spl *, .fd-spl *::before, .fd-spl *::after { box-sizing: border-box; }
.fd-spl :where(p, a, ul, li, b, span, div, header, button, svg) {
  margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit;
  letter-spacing: inherit; text-decoration: none; list-style: none; text-align: inherit;
}
.fd-spl {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-spl-spend: #FF5B2E;
  --fd-spl-spend-ink: #1A0F0A;
  --fd-spl-save: #0E3B2D;
  --fd-spl-save-ink: #F1E8D3;
  --fd-spl-brass: #E1B85C;
  --fd-spl-sans: "SF Pro Display", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  --fd-spl-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --fd-spl-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
  position: relative; display: flex; min-height: 880px; margin: 0; padding: 0; overflow: hidden;
  font: 400 15px/1.45 var(--fd-spl-sans); color: var(--fd-spl-spend-ink); background: var(--fd-spl-save);
}
.fd-spl-half {
  position: relative; flex: 1 1 0; min-width: 0; container-type: inline-size; display: flex; flex-direction: column;
  transition: flex-grow var(--fd-dur-4) var(--fd-spring);
}
.fd-spl.is-spend .fd-spl-spend, .fd-spl.is-save .fd-spl-save { flex-grow: 1.85; }
.fd-spl-spend { background: var(--fd-spl-spend); color: var(--fd-spl-spend-ink); z-index: 2; }
.fd-spl-save { background: var(--fd-spl-save); color: var(--fd-spl-save-ink); z-index: 1; }
.fd-spl-clip { position: relative; flex: 1 1 auto; overflow: hidden; display: flex; flex-direction: column; padding: 0 44px 40px; }

.fd-spl-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 84px; white-space: nowrap; }
.fd-spl-top-r { justify-content: flex-end; }
.fd-spl-logo { display: inline-flex; align-items: center; gap: 10px; color: var(--fd-spl-spend-ink); }
.fd-spl-logo svg { display: block; }
.fd-spl-logo span { font: 800 24px/1 var(--fd-spl-sans); letter-spacing: -0.04em; }
.fd-spl-tag { font: 500 12px/1 var(--fd-spl-mono); letter-spacing: 0.02em; transition: opacity var(--fd-dur-2); }
.fd-spl-login { font: 500 15px/1 var(--fd-spl-sans); padding: 10px 6px; }
.fd-spl-login:hover { text-decoration: underline; text-underline-offset: 4px; }
.fd-spl-open { font: 600 14px/1 var(--fd-spl-sans); padding: 12px 18px; border-radius: 9999px; background: var(--fd-spl-save-ink); color: var(--fd-spl-save); transition: transform var(--fd-dur-2) var(--fd-spring); }
.fd-spl-open:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }

.fd-spl-body { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: 28px; min-width: 0; }
.fd-spl-head { appearance: none; cursor: default; display: flex; flex-direction: column; align-items: flex-start; gap: 14px; text-align: left; color: inherit; background: none; border: 0; padding: 0; width: 100%; }
.fd-spl-idx { font: 500 12px/1 var(--fd-spl-mono); letter-spacing: 0.06em; text-transform: uppercase; }
.fd-spl-word { display: block; white-space: nowrap; }
.fd-spl-word-spend { font: 900 clamp(4.5rem, 25.5cqw, 15rem)/0.8 var(--fd-spl-sans); letter-spacing: -0.065em; margin-left: -0.05em; }
.fd-spl-word-save { font: italic 400 clamp(4.5rem, 34cqw, 17rem)/0.8 var(--fd-spl-serif); letter-spacing: -0.045em; margin-left: -0.03em; color: var(--fd-spl-save-ink); }

.fd-spl-detail { display: grid; grid-template-rows: 1fr; max-width: 520px; margin-bottom: 0; transition: grid-template-rows var(--fd-dur-4) var(--fd-ease-out), opacity var(--fd-dur-3) var(--fd-ease-out), margin var(--fd-dur-4) var(--fd-ease-out); }
.fd-spl-detail-in { display: flex; flex-direction: column; gap: 22px; min-height: 0; overflow: hidden; }
.fd-spl-half.is-shut .fd-spl-detail { grid-template-rows: 0fr; opacity: 0; margin-bottom: -28px; pointer-events: none; }
.fd-spl-half.is-shut .fd-spl-tag { opacity: 0; }
.fd-spl-lede { font: 500 clamp(1.125rem, 1.6vw, 1.375rem)/1.3 var(--fd-spl-sans); letter-spacing: -0.012em; max-width: 30ch; }
.fd-spl-save .fd-spl-lede { font: 400 clamp(1.25rem, 1.8vw, 1.5rem)/1.3 var(--fd-spl-serif); }

.fd-spl-feed { display: flex; flex-direction: column; border-top: 2px solid var(--fd-spl-spend-ink); }
.fd-spl-txn { display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: 14px; padding: 11px 0; border-bottom: 1px solid rgba(26,15,10,0.28); }
.fd-spl-glyph { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--fd-spl-spend-ink); color: var(--fd-spl-spend); font: 800 14px/1 var(--fd-spl-sans); }
.fd-spl-txn-m, .fd-spl-txn-a { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.fd-spl-txn-a { text-align: right; align-items: flex-end; }
.fd-spl-txn b { font: 600 15px/1.2 var(--fd-spl-sans); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fd-spl-txn-a b { font: 600 15px/1.2 var(--fd-spl-mono); }
.fd-spl-txn span span, .fd-spl-txn-m > span, .fd-spl-txn-a > span { font: 400 12px/1.2 var(--fd-spl-mono); opacity: 0.78; white-space: nowrap; }

.fd-spl-pot { padding: 16px 0 0; border-top: 1px solid rgba(241,232,211,0.4); }
.fd-spl-pot-row { display: flex; justify-content: space-between; gap: 12px; }
.fd-spl-pot-name { font: 600 15px/1.2 var(--fd-spl-sans); }
.fd-spl-pot-due { font: 400 12px/1.4 var(--fd-spl-mono); opacity: 0.8; }
.fd-spl-bar { position: relative; display: block; height: 10px; margin: 12px 0 10px; border-radius: 9999px; background: rgba(241,232,211,0.16); overflow: hidden; }
.fd-spl-bar span { position: absolute; left: 0; top: 0; bottom: 0; display: block; border-radius: 9999px; background: var(--fd-spl-brass); }
.fd-spl-pot-nums { font: 400 13px/1.2 var(--fd-spl-mono); }
.fd-spl-bal { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding-top: 16px; border-top: 1px solid rgba(241,232,211,0.4); }
.fd-spl-bal-l { font: 400 12px/1.3 var(--fd-spl-mono); opacity: 0.8; }
.fd-spl-bal-v { font: 400 40px/1 var(--fd-spl-serif); letter-spacing: -0.025em; font-variant-numeric: tabular-nums; color: var(--fd-spl-brass); }

.fd-spl-foot { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.fd-spl-cta {
  display: inline-flex; align-items: center; gap: 12px; height: 54px; padding: 0 26px; border-radius: 9999px; white-space: nowrap;
  font: 700 16px/1 var(--fd-spl-sans); transition: transform var(--fd-dur-2) var(--fd-spring), background var(--fd-dur-1);
}
.fd-spl-cta svg { display: block; transition: transform var(--fd-dur-2) var(--fd-ease-out); }
.fd-spl-cta:hover svg { transform: translateX(4px); }
.fd-spl-cta:active { transform: scale(0.96); transition-duration: var(--fd-dur-1); }
.fd-spl-cta-spend { background: var(--fd-spl-spend-ink); color: var(--fd-spl-spend); }
.fd-spl-cta-save { background: var(--fd-spl-brass); color: var(--fd-spl-save); }
.fd-spl-fine { font: 400 12px/1.4 var(--fd-spl-mono); max-width: 34ch; transition: opacity var(--fd-dur-2); }
.fd-spl-half.is-shut .fd-spl-fine { opacity: 0; }

.fd-spl-seal {
  position: absolute; top: 50%; right: -50px; width: 100px; height: 100px; margin-top: -50px; z-index: 5; pointer-events: none;
  color: var(--fd-spl-spend);
}
.fd-spl-seal svg { display: block; width: 100%; height: 100%; animation: fd-spl-spin 24s linear infinite; }
.fd-spl-seal-t { font: 600 9.2px/1 ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: 0.16em; fill: #FFD9C9; }
.fd-spl-seal-or { font: italic 400 30px/1 "Iowan Old Style", Palatino, Georgia, serif; fill: #E1B85C; }
@keyframes fd-spl-spin { to { transform: rotate(360deg); } }

.fd-spl :focus-visible { outline: 2px solid currentColor; outline-offset: 3px; border-radius: 6px; }
.fd-spl-cta:focus-visible { outline-offset: 4px; border-radius: 9999px; }

@media (max-width: 760px) {
  .fd-spl { flex-direction: column; min-height: 844px; }
  .fd-spl-half, .fd-spl.is-spend .fd-spl-spend, .fd-spl.is-save .fd-spl-save { flex: 0 0 auto; transition: none; }
  .fd-spl .fd-spl-half.is-open { flex: 1 0 auto; }
  .fd-spl-half.is-shut { cursor: pointer; }
  .fd-spl-clip { padding: 0 16px 28px; }
  .fd-spl-top { height: 64px; }
  .fd-spl-tag { display: none; }
  .fd-spl-save .fd-spl-top { display: none; }
  .fd-spl-save .fd-spl-clip { padding-top: 40px; }
  .fd-spl-logo span { font-size: 22px; }
  .fd-spl-body { gap: 18px; justify-content: flex-end; }
  .fd-spl-spend.is-shut .fd-spl-clip { padding-bottom: 44px; }
  .fd-spl-head { cursor: pointer; flex-direction: row; align-items: flex-end; justify-content: space-between; }
  .fd-spl-head .fd-spl-idx { display: none; }
  .fd-spl-word-spend { font-size: 6rem; }
  .fd-spl-word-save { font-size: 6.4rem; }
  .fd-spl-detail { transition: opacity var(--fd-dur-3) var(--fd-ease-out); }
  .fd-spl-half.is-shut .fd-spl-detail, .fd-spl-half.is-shut .fd-spl-fine, .fd-spl-half.is-shut .fd-spl-idx { display: none; }
  .fd-spl-half.is-shut .fd-spl-body { flex-direction: row; align-items: center; justify-content: space-between; gap: 12px; }
  .fd-spl-half.is-shut .fd-spl-head { width: auto; }
  .fd-spl-half.is-shut .fd-spl-word-spend { font-size: 3.6rem; }
  .fd-spl-half.is-shut .fd-spl-word-save { font-size: 3.9rem; }
  .fd-spl-half.is-shut .fd-spl-cta { height: 44px; padding: 0 18px; font-size: 14px; }
  .fd-spl-half.is-open .fd-spl-detail { animation: fd-spl-in var(--fd-dur-3) var(--fd-ease-out) both; }
  .fd-spl-lede, .fd-spl-save .fd-spl-lede { font-size: 1.0625rem; }
  .fd-spl-txn:nth-child(3) { display: none; }
  .fd-spl-bal-v { font-size: 32px; }
  .fd-spl-cta { height: 50px; }
  .fd-spl-foot { gap: 12px; }
  .fd-spl-seal { top: auto; bottom: -30px; right: 16px; margin-top: 0; width: 60px; height: 60px; }
  .fd-spl-seal-t { display: none; }
}
@keyframes fd-spl-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .fd-spl-half, .fd-spl-detail, .fd-spl-tag, .fd-spl-fine, .fd-spl-cta, .fd-spl-cta svg, .fd-spl-open { transition: none; }
  .fd-spl-seal svg { animation: none; }
  .fd-spl-half.is-open .fd-spl-detail { animation: none; }
}
`;

export function Demo() {
  return <HeroSplitScreen />;
}
