/**
 * LeaderboardTable, editorial league standings: rank-change arrows, zone
 * markers, W/D/L form dots, tabular figures, and rows that FLIP to their new
 * positions when results change.
 *
 * Props: teams (raw records, order doesn't matter), zones, highlightId,
 * matchday (label shown in the caption), theme.
 * Team: { id, name, short, color, played, won, drawn, lost, gf, ga, form, prevRank? }
 * Points (3/1/0), goal difference and the ordering (pts, GD, GF, name) are
 * computed for you. Rank movement is read from prevRank.
 *
 * Browser support: Web Animations API (all evergreen browsers). Without it the
 * rows simply re-order.
 * Accessibility: role="table" built from a CSS grid so rows can animate
 * reliably; header cells use role="columnheader", rank changes are exposed as
 * visually hidden text ("up 2 places"), form dots are one labelled image
 * ("Last five: won, won, drew, lost, won"), and a polite live region
 * announces re-orders. Abbreviated headers carry a full-name title/aria-label.
 * Reduced motion: no FLIP and no flash; rows jump to their new place.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";

export type Result = "W" | "D" | "L";
export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  form: Result[];
  prevRank?: number;
}
export interface Zone { from: number; to: number; label: string; color: string }

export interface LeaderboardTableProps {
  teams: Team[];
  zones?: Zone[];
  highlightId?: string;
  caption?: string;
  matchday?: string;
  theme?: "light" | "dark";
  className?: string;
}

const pts = (t: Team) => t.won * 3 + t.drawn;
const word = { W: "won", D: "drew", L: "lost" } as const;

export function rankTeams(teams: Team[]) {
  return [...teams].sort((a, b) => pts(b) - pts(a) || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));
}

export function LeaderboardTable({ teams, zones = [], highlightId, caption = "League standings", matchday, theme, className }: LeaderboardTableProps) {
  const ranked = useMemo(() => rankTeams(teams), [teams]);
  const key = ranked.map((t) => t.id).join("|");
  const els = useRef(new Map<string, HTMLElement>());
  const prevIdx = useRef(new Map<string, number>());
  const [live, setLive] = useState("");
  const first = useRef(true);

  useLayoutEffect(() => {
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let moved = 0;
    ranked.forEach((t, i) => {
      const el = els.current.get(t.id);
      const was = prevIdx.current.get(t.id);
      if (el && was !== undefined && was !== i) {
        moved++;
        if (!reduce && el.animate) {
          const dy = (was - i) * el.offsetHeight;
          const up = i < was;
          el.animate([{ transform: `translateY(${dy}px)`, zIndex: 2 }, { transform: "translateY(0)", zIndex: 2 }], { duration: 760, easing: "cubic-bezier(.22,1,.36,1)" });
          el.querySelector<HTMLElement>("[data-flash]")?.animate(
            [{ opacity: 1, background: up ? "var(--l-up)" : "var(--l-down)" }, { opacity: 1, background: up ? "var(--l-up)" : "var(--l-down)", offset: 0.35 }, { opacity: 0, background: up ? "var(--l-up)" : "var(--l-down)" }],
            { duration: 1400, easing: "ease-out" },
          );
        }
      }
      prevIdx.current.set(t.id, i);
    });
    if (!first.current && moved) setLive(`Standings updated${matchday ? ` for ${matchday}` : ""}. ${ranked[0].name} lead the table.`);
    first.current = false;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoneOf = (pos: number) => zones.find((z) => pos >= z.from && pos <= z.to);
  const H = (label: string, full: string, cls = "") => (
    <div role="columnheader" className={`fd-lb-h ${cls}`} aria-label={full} title={full}>{label}</div>
  );

  return (
    <div className={`fd-lb${className ? " " + className : ""}`} data-fd-theme={theme}>
      <style>{css}</style>
      <div className="fd-lb-table" role="table" aria-label={caption} aria-rowcount={ranked.length + 1}>
        <div role="rowgroup">
          <div role="row" className="fd-lb-row fd-lb-head">
            {H("#", "Position", "fd-lb-c-pos")}
            {H("Club", "Club", "fd-lb-c-club")}
            {H("P", "Played", "fd-lb-n fd-lb-nh")}
            {H("W", "Won", "fd-lb-n fd-lb-nh")}
            {H("D", "Drawn", "fd-lb-n fd-lb-nh")}
            {H("L", "Lost", "fd-lb-n fd-lb-nh")}
            {H("GD", "Goal difference", "fd-lb-n fd-lb-gd")}
            {H("Pts", "Points", "fd-lb-n fd-lb-pts")}
            {H("Form", "Last five matches", "fd-lb-form fd-lb-nh")}
          </div>
        </div>
        <div role="rowgroup" className="fd-lb-body">
          {ranked.map((t, i) => {
            const pos = i + 1;
            const z = zoneOf(pos);
            const gd = t.gf - t.ga;
            const mv = t.prevRank ? t.prevRank - pos : 0;
            return (
              <div
                key={t.id}
                role="row"
                aria-rowindex={pos + 1}
                className="fd-lb-row fd-lb-team"
                data-me={t.id === highlightId ? "" : undefined}
                ref={(el) => {
                  if (el) els.current.set(t.id, el);
                  else els.current.delete(t.id);
                }}
              >
                <span className="fd-lb-flash" data-flash="" aria-hidden="true" />
                {z && <span className="fd-lb-zone" style={{ background: z.color }} aria-hidden="true" />}
                <div role="cell" className="fd-lb-c-pos">
                  <span className="fd-lb-rank">{pos}</span>
                  <span className="fd-lb-mv" data-dir={mv > 0 ? "up" : mv < 0 ? "down" : "same"}>
                    {mv > 0 && <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 1l3.2 5.2H.8z" fill="currentColor" /></svg>}
                    {mv < 0 && <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 7L.8 1.8h6.4z" fill="currentColor" /></svg>}
                    {mv === 0 && <i aria-hidden="true" />}
                    {mv !== 0 && <b aria-hidden="true">{Math.abs(mv)}</b>}
                    <span className="fd-lb-sr">{mv > 0 ? `up ${mv} ${mv === 1 ? "place" : "places"}` : mv < 0 ? `down ${-mv} ${mv === -1 ? "place" : "places"}` : "no change"}</span>
                  </span>
                </div>
                <div role="cell" className="fd-lb-c-club">
                  <span className="fd-lb-crest" style={{ ["--c" as string]: t.color }} aria-hidden="true">{t.short}</span>
                  <span className="fd-lb-name">{t.name}</span>
                  {z && <span className="fd-lb-sr">, {z.label}</span>}
                </div>
                <div role="cell" className="fd-lb-n fd-lb-nh">{t.played}</div>
                <div role="cell" className="fd-lb-n fd-lb-nh">{t.won}</div>
                <div role="cell" className="fd-lb-n fd-lb-nh">{t.drawn}</div>
                <div role="cell" className="fd-lb-n fd-lb-nh">{t.lost}</div>
                <div role="cell" className="fd-lb-n fd-lb-gd">{gd > 0 ? `+${gd}` : gd < 0 ? `−${-gd}` : "0"}</div>
                <div role="cell" className="fd-lb-n fd-lb-pts">{pts(t)}</div>
                <div role="cell" className="fd-lb-form fd-lb-nh">
                  <span className="fd-lb-dots" role="img" aria-label={`Last five: ${t.form.slice(-5).map((f) => word[f]).join(", ")}`}>
                    {t.form.slice(-5).map((f, k) => (
                      <i key={k} data-r={f} data-new={k === t.form.slice(-5).length - 1 ? "" : undefined} />
                    ))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {zones.length > 0 && (
        <ul className="fd-lb-legend" aria-label="Zones">
          {zones.map((z) => (
            <li key={z.label}><i style={{ background: z.color }} aria-hidden="true" />{z.label}</li>
          ))}
        </ul>
      )}
      <div className="fd-lb-sr" role="status" aria-live="polite">{live}</div>
    </div>
  );
}

const css = `
:where(.fd-lb,.fd-lb *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-lb,.fd-lb *)::before,:where(.fd-lb,.fd-lb *)::after{box-sizing:border-box}
:where(.fd-lb svg){display:block;flex-shrink:0}
.fd-lb{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --l-bg:#fff;--l-fg:#0E1411;--l-mut:#6A746E;--l-line:rgba(14,20,17,.09);--l-line2:rgba(14,20,17,.18);--l-hover:rgba(14,20,17,.03);--l-up:rgba(22,163,74,.12);--l-down:rgba(220,38,38,.1);--l-upc:#15803D;--l-downc:#C2271B;--l-me:rgba(5,150,105,.07);--l-w:#16A34A;--l-d:#B8BDB9;--l-l:#DC2626;
  width:100%;font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.006em;color:var(--l-fg);-webkit-font-smoothing:antialiased}
[data-fd-theme="dark"].fd-lb,[data-fd-theme="dark"] .fd-lb{--l-bg:#0E1311;--l-fg:#EAF0EC;--l-mut:#8E9A93;--l-line:rgba(255,255,255,.07);--l-line2:rgba(255,255,255,.16);--l-hover:rgba(255,255,255,.035);--l-up:rgba(74,222,128,.22);--l-down:rgba(248,113,113,.2);--l-upc:#4ADE80;--l-downc:#FF8A7A;--l-me:rgba(52,211,153,.09);--l-w:#4ADE80;--l-d:#59635D;--l-l:#F87171}
.fd-lb-table{overflow:hidden;border-radius:16px;background:var(--l-bg);box-shadow:0 0 0 1px var(--l-line),0 1px 2px rgba(14,20,17,.04),0 12px 32px -16px rgba(14,20,17,.14);container-type:inline-size}
.fd-lb-row{position:relative;display:grid;grid-template-columns:72px minmax(0,1fr) 44px 44px 44px 44px 56px 60px 128px;align-items:center;column-gap:4px;padding:0 20px 0 12px;background:var(--l-bg)}
.fd-lb-head{height:40px;font-size:11px;line-height:16px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--l-mut);box-shadow:inset 0 -1px 0 var(--l-line2)}
.fd-lb-h{white-space:nowrap}
.fd-lb-team{height:56px;box-shadow:inset 0 -1px 0 var(--l-line);transition:background-color var(--fd-dur-1)}
.fd-lb-body>.fd-lb-team:last-child{box-shadow:none}
@media (hover:hover){.fd-lb-team:hover{background:color-mix(in srgb,var(--l-fg) 3%,var(--l-bg))}}
.fd-lb-team[data-me]{background:var(--l-me)}
.fd-lb-flash{position:absolute;inset:0;opacity:0;pointer-events:none}
.fd-lb-zone{position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0}
.fd-lb-c-pos{display:flex;align-items:center;gap:6px;padding-left:8px;position:relative}
.fd-lb-rank{display:block;min-width:24px;font-size:17px;line-height:24px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.fd-lb-mv{display:inline-flex;align-items:center;gap:2px;min-width:22px;font-size:11px;line-height:12px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--l-mut)}
.fd-lb-mv[data-dir="up"]{color:var(--l-upc)}.fd-lb-mv[data-dir="down"]{color:var(--l-downc)}
.fd-lb-mv i{display:block;width:6px;height:2px;border-radius:1px;background:currentColor;opacity:.5;margin-left:1px}
.fd-lb-c-club{display:flex;align-items:center;gap:12px;min-width:0}
.fd-lb-crest{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:9px;font-size:10px;line-height:1;font-weight:800;letter-spacing:.02em;color:#fff;background:linear-gradient(160deg,color-mix(in srgb,var(--c) 82%,#fff),var(--c));box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),0 1px 2px rgba(0,0,0,.18)}
.fd-lb-name{font-weight:600;letter-spacing:-.012em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fd-lb-n{text-align:right;font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1;color:var(--l-mut)}
.fd-lb-head .fd-lb-n{color:var(--l-mut)}
.fd-lb-team .fd-lb-gd{color:var(--l-fg)}
.fd-lb-pts{font-weight:700;color:var(--l-fg);font-size:16px}
.fd-lb-head .fd-lb-pts{font-size:11px;color:var(--l-fg)}
.fd-lb-form{display:flex;justify-content:flex-end}
.fd-lb-head .fd-lb-form{justify-content:flex-end}
.fd-lb-dots{display:inline-flex;gap:5px}
.fd-lb-dots i{display:block;width:8px;height:8px;border-radius:50%;background:var(--l-d)}
.fd-lb-dots i[data-r="W"]{background:var(--l-w)}.fd-lb-dots i[data-r="L"]{background:var(--l-l)}
.fd-lb-dots i[data-new]{box-shadow:0 0 0 2px var(--l-bg),0 0 0 3.5px color-mix(in srgb,currentColor 0%,transparent);transform:scale(1.2)}
.fd-lb-legend{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:16px;padding:0 4px;font-size:12px;line-height:16px;color:var(--l-mut)}
.fd-lb-legend li{display:flex;align-items:center;gap:8px}
.fd-lb-legend i{display:block;width:3px;height:12px;border-radius:2px}
.fd-lb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@container (max-width:640px){
  .fd-lb-row{grid-template-columns:64px minmax(0,1fr) 44px 40px;padding:0 12px 0 4px}
  .fd-lb-nh{display:none}
  .fd-lb-c-pos{padding-left:6px}
}
@media (prefers-reduced-motion:reduce){.fd-lb *{transition-duration:1ms!important}}
@media (prefers-contrast:more){.fd-lb-table{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const BASE: Team[] = [
  { id: "har", name: "Harbourside FC", short: "HAR", color: "#1D4ED8", played: 12, won: 8, drawn: 2, lost: 2, gf: 24, ga: 11, form: ["W", "W", "D", "W", "W"] },
  { id: "ash", name: "Ashgrove United", short: "ASH", color: "#B91C1C", played: 12, won: 8, drawn: 1, lost: 3, gf: 22, ga: 12, form: ["W", "L", "W", "W", "W"] },
  { id: "kin", name: "Kingsley Rovers", short: "KIN", color: "#0F766E", played: 12, won: 7, drawn: 3, lost: 2, gf: 19, ga: 10, form: ["D", "W", "W", "D", "W"] },
  { id: "red", name: "Redcliffe Athletic", short: "RED", color: "#C2410C", played: 12, won: 6, drawn: 4, lost: 2, gf: 20, ga: 14, form: ["W", "D", "D", "W", "D"] },
  { id: "mar", name: "Marlowe Town", short: "MAR", color: "#7C3AED", played: 12, won: 6, drawn: 2, lost: 4, gf: 17, ga: 15, form: ["L", "W", "W", "L", "W"] },
  { id: "sto", name: "Stonebridge City", short: "STO", color: "#0369A1", played: 12, won: 5, drawn: 4, lost: 3, gf: 16, ga: 13, form: ["D", "D", "W", "L", "D"] },
  { id: "whi", name: "Whitmoor Wanderers", short: "WHI", color: "#4D7C0F", played: 12, won: 5, drawn: 2, lost: 5, gf: 15, ga: 16, form: ["L", "W", "L", "W", "L"] },
  { id: "cal", name: "Calderbank", short: "CAL", color: "#BE185D", played: 12, won: 4, drawn: 3, lost: 5, gf: 14, ga: 17, form: ["W", "L", "D", "L", "D"] },
  { id: "oak", name: "Oakhurst Albion", short: "OAK", color: "#A16207", played: 12, won: 3, drawn: 3, lost: 6, gf: 11, ga: 18, form: ["L", "L", "D", "W", "L"] },
  { id: "fen", name: "Fenwick Park", short: "FEN", color: "#475569", played: 12, won: 2, drawn: 4, lost: 6, gf: 10, ga: 19, form: ["D", "L", "L", "D", "L"] },
  { id: "bra", name: "Braeside Town", short: "BRA", color: "#0891B2", played: 12, won: 2, drawn: 2, lost: 8, gf: 9, ga: 24, form: ["L", "L", "W", "L", "L"] },
  { id: "tho", name: "Thornley Vale", short: "THO", color: "#9F1239", played: 12, won: 1, drawn: 3, lost: 8, gf: 8, ga: 25, form: ["L", "D", "L", "L", "D"] },
];

/** [home, away, homeGoals, awayGoals] */
const MATCHDAYS: [string, string, number, number][][] = [
  [["har", "ash", 1, 2], ["kin", "red", 2, 0], ["mar", "sto", 1, 1], ["whi", "cal", 0, 3], ["oak", "fen", 2, 1], ["bra", "tho", 1, 1]],
  [["ash", "kin", 1, 1], ["red", "har", 3, 1], ["sto", "whi", 2, 0], ["cal", "mar", 2, 0], ["fen", "bra", 0, 1], ["tho", "oak", 0, 2]],
  [["kin", "har", 0, 2], ["ash", "mar", 3, 0], ["red", "cal", 1, 2], ["sto", "oak", 0, 0], ["whi", "tho", 2, 1], ["bra", "fen", 1, 2]],
];

function play(teams: Team[], fixtures: [string, string, number, number][]): Team[] {
  const before = new Map(rankTeams(teams).map((t, i) => [t.id, i + 1]));
  const next = teams.map((t) => ({ ...t, prevRank: before.get(t.id) }));
  const by = new Map(next.map((t) => [t.id, t]));
  for (const [h, a, hg, ag] of fixtures) {
    const H = by.get(h)!, A = by.get(a)!;
    H.played++; A.played++; H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
    const r: [Result, Result] = hg > ag ? ["W", "L"] : hg < ag ? ["L", "W"] : ["D", "D"];
    H.form = [...H.form, r[0]].slice(-5); A.form = [...A.form, r[1]].slice(-5);
    if (hg > ag) { H.won++; A.lost++; } else if (hg < ag) { A.won++; H.lost++; } else { H.drawn++; A.drawn++; }
  }
  return next;
}

const ZONES: Zone[] = [
  { from: 1, to: 4, label: "Champions Cup", color: "#2563EB" },
  { from: 5, to: 6, label: "Continental Shield", color: "#F59E0B" },
  { from: 10, to: 12, label: "Relegation", color: "#DC2626" },
];

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [step, setStep] = useState(0);
  const [teams, setTeams] = useState(BASE);
  const md = 12 + step;
  const advance = () => {
    if (step >= MATCHDAYS.length) {
      setStep(0);
      setTeams(BASE.map((t) => ({ ...t })));
      return;
    }
    setTeams((t) => play(t, MATCHDAYS[step]));
    setStep((s) => s + 1);
  };
  const last = step > 0 ? MATCHDAYS[step - 1] : [];
  const name = (id: string) => BASE.find((t) => t.id === id)!.short;

  return (
    <div className="fd-lbd" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <header className="fd-lbd-top">
        <span className="fd-lbd-brand">The Northern League</span>
        <button type="button" className="fd-lbd-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      </header>
      <main className="fd-lbd-main">
        <div className="fd-lbd-head">
          <div>
            <p className="fd-lbd-eyebrow">Season 2026/27 · Matchday {md}</p>
            <h1>Standings</h1>
          </div>
          <button type="button" className="fd-lbd-btn" onClick={advance}>
            {step >= MATCHDAYS.length ? "Reset to matchday 12" : `Play matchday ${md + 1}`}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{step >= MATCHDAYS.length ? <path d="M2.5 7a4.5 4.5 0 107.7-3.2M10.5 1.5v2.5H8" /> : <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" />}</svg>
          </button>
        </div>
        <LeaderboardTable theme={theme} teams={teams} zones={ZONES} highlightId="har" matchday={`matchday ${md}`} caption={`Northern League standings after matchday ${md}`} />
        {last.length > 0 && (
          <section className="fd-lbd-res" aria-label={`Results from matchday ${md}`}>
            <h2>Matchday {md} results</h2>
            <ul>
              {last.map(([h, a, hg, ag]) => (
                <li key={h + a}><span>{name(h)}</span><b>{hg}–{ag}</b><span>{name(a)}</span></li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-lbd,.fd-lbd *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-lbd,.fd-lbd *)::before,:where(.fd-lbd,.fd-lbd *)::after{box-sizing:border-box}
:where(.fd-lbd svg){display:block;flex-shrink:0}
:where(.fd-lbd button){appearance:none;-webkit-appearance:none;outline:0;border-radius:0;cursor:pointer}
.fd-lbd{--fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --d-bg:#F2F5F3;--d-fg:#0E1411;--d-mut:#6A746E;--d-line:rgba(14,20,17,.09);--d-ring:rgba(5,150,105,.55);--d-card:#fff;
  min-height:100vh;background:var(--d-bg);color:var(--d-fg);font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.006em;-webkit-font-smoothing:antialiased}
.fd-lbd[data-fd-theme="dark"]{--d-bg:#080B09;--d-fg:#EAF0EC;--d-mut:#8E9A93;--d-line:rgba(255,255,255,.08);--d-ring:rgba(52,211,153,.6);--d-card:#0E1311}
.fd-lbd-top{display:flex;align-items:center;justify-content:space-between;height:56px;padding:0 clamp(16px,3vw,32px);background:var(--d-card);box-shadow:inset 0 -1px 0 var(--d-line)}
.fd-lbd-brand{font-weight:800;font-size:15px;letter-spacing:-.03em;text-transform:uppercase}
.fd-lbd-theme{height:32px;padding:0 12px;border-radius:8px;font-size:13px;font-weight:500;color:var(--d-mut);box-shadow:inset 0 0 0 1px var(--d-line)}.fd-lbd-theme:hover{color:var(--d-fg)}
.fd-lbd-theme:focus-visible,.fd-lbd-btn:focus-visible{outline:2px solid var(--d-ring);outline-offset:2px}
.fd-lbd-main{max-width:960px;margin:0 auto;padding:40px clamp(16px,3vw,32px) 64px}
.fd-lbd-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.fd-lbd-eyebrow{font-size:12px;line-height:16px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--d-mut)}
.fd-lbd-head h1{margin-top:6px;font-size:clamp(36px,6vw,56px);line-height:1;font-weight:800;letter-spacing:-.045em}
.fd-lbd-btn{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:12px;background:var(--d-fg);color:var(--d-bg);font-size:14px;font-weight:600;line-height:1;transition:transform 240ms var(--fd-spring);box-shadow:0 1px 2px rgba(0,0,0,.25)}
.fd-lbd-btn:active{transform:scale(.96)}
.fd-lbd-res{margin-top:32px}
.fd-lbd-res h2{font-size:12px;line-height:16px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--d-mut)}
.fd-lbd-res ul{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-top:12px}
.fd-lbd-res li{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;height:44px;padding:0 14px;border-radius:12px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line);font-size:13px;font-weight:600;letter-spacing:.02em}
.fd-lbd-res li span:last-child{text-align:right}
.fd-lbd-res li b{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
@media (prefers-reduced-motion:reduce){.fd-lbd *{transition-duration:1ms!important}}
`;
