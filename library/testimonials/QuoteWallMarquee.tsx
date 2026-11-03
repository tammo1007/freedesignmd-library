/**
 * QuoteWallMarquee, a wall of short social posts in two or three rows that
 * drift in opposite directions. Each post carries a handle, a date and a
 * code-ish detail (a command, a before/after number).
 *
 * Props: posts (Post[]), rows (2 | 3), eyebrow, title, aside, speed (seconds
 * for one loop of the first row), className.
 * Post: { name, handle, date, text, code?, before?, after?, avatar?, likes? }
 *
 * Behaviour: rows pause on hover and on keyboard focus; a Pause button stops
 * all motion (WCAG 2.2.2). Edges fade out with a CSS mask.
 * Reduced motion: the marquee becomes a static grid, duplicates are removed.
 * Browser support: all evergreen browsers (CSS animations, mask-image).
 * Accessibility: duplicated posts are aria-hidden, each post is an <article>
 * with its author and date, the pause control is a real toggle button.
 */
import { useState } from "react";

export interface Post {
  name: string;
  handle: string;
  date: string;
  text: string;
  /** A command or snippet, rendered as a mono line. */
  code?: string;
  /** Before/after stat, e.g. before "14m 02s", after "3m 51s", label "ci". */
  before?: string;
  after?: string;
  label?: string;
  avatar?: string;
  likes?: number;
}

export interface QuoteWallMarqueeProps {
  posts?: Post[];
  rows?: 2 | 3;
  eyebrow?: string;
  title?: string;
  aside?: string;
  /** Before/after pair shown large next to the aside. */
  stat?: [string, string];
  speed?: number;
  className?: string;
}

const P = "/img/people/";

export const DEFAULT_POSTS: Post[] = [
  { name: "Nadia Rahman", handle: "nadia_builds", date: "Mar 3", avatar: P + "p6.webp", text: "turned on the remote cache for our turborepo at 11pm out of pure spite. CI went from 14 minutes to under 4. going to bed.", label: "ci", before: "14m 02s", after: "3m 51s", likes: 812 },
  { name: "Tomasz Wierzbicki", handle: "tomasz.dev", date: "Feb 27", avatar: P + "p7.webp", text: "`ferrule why` just told me a single .env.example was busting the cache for 40 packages. Two years. Two YEARS.", code: "ferrule why apps/web --since main", likes: 1204 },
  { name: "Grace Oyelaran", handle: "goyelaran", date: "Mar 11", avatar: P + "p9.webp", text: "Our flaky-test quarantine list shrank after we moved to hermetic runners. I did not touch a single test. Slightly offended, honestly.", label: "quarantined", before: "37", after: "4", likes: 356 },
  { name: "Mei Tanaka", handle: "mei_ships", date: "Mar 9", text: "honest review: the setup docs assume pnpm. we're on yarn 1 like cavemen, so it took 25 min instead of 5. still the best afternoon of the quarter.", code: "yarn@1.22.19  # don't @ me", likes: 97 },
  { name: "Rafael Silva", handle: "rsilva", date: "Feb 19", avatar: P + "p5.webp", text: "CI bill, February: $4,212. March, with Ferrule: $1,380. Our CFO replied with a thumbs up, which has never once happened.", label: "ci spend", before: "$4,212", after: "$1,380", likes: 2290 },
  { name: "Hollis Grant", handle: "hollisg", date: "Mar 14", text: "the cache hit chart is the first CI graph I have ever opened on purpose", label: "hit rate", before: "38%", after: "91.4%", likes: 143 },
  { name: "Kwame Mensah", handle: "kwame.codes", date: "Mar 2", avatar: P + "p4.webp", text: "PR checks now finish before I'm done writing the PR description. That's not a speed bump, that changes how the team works.", label: "p50 pr check", before: "11m 40s", after: "2m 06s", likes: 640 },
  { name: "Lena Kowalczyk", handle: "lenak", date: "Feb 24", avatar: P + "p1.webp", text: "Migrated 3 repos off self-hosted runners. Deleted 1,100 lines of bash. Nobody has asked where they went.", code: "git rm -r .ci/scripts  # -1,104", likes: 1876 },
  { name: "Karim Haddad", handle: "karimh", date: "Mar 6", avatar: P + "p2.webp", text: "small thing, but replaying a failed CI job on my laptop, same env, same cache, same failure, is actual witchcraft", code: "ferrule replay run_8f21c0", likes: 529 },
  { name: "Juniper Ames", handle: "junebug_eng", date: "Feb 28", text: "we had one engineer whose whole job was babysitting the Jenkins box. he works on the product now and is happier about it than any of us.", likes: 401 },
  { name: "Adaeze Okafor", handle: "adaeze", date: "Mar 12", avatar: P + "p3.webp", text: "the free tier is 10 GB of cache, which sounded small until I checked and we were using 3.2 of it", code: "ferrule usage  3.2 GB / 10 GB", likes: 88 },
  { name: "Ji-ho Park", handle: "jihopark", date: "Mar 15", avatar: P + "p8.webp", text: "first time I saw a 600 MB docker layer come back as a remote hit I laughed out loud in a quiet office", code: "layer sha256:9c1e…  HIT (remote) 0.8s", likes: 733 },
];

function Avatar({ p }: { p: Post }) {
  if (p.avatar) return <img className="fd-qwm-av" src={p.avatar} alt="" width={36} height={36} loading="lazy" decoding="async" />;
  const ini = p.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return <span className="fd-qwm-av fd-qwm-ini" aria-hidden="true">{ini}</span>;
}

function renderText(t: string) {
  return t.split(/(`[^`]+`)/g).map((s, i) => (s.startsWith("`") ? <code key={i} className="fd-qwm-ic">{s.slice(1, -1)}</code> : s));
}

function Card({ p, i, hidden }: { p: Post; i: number; hidden?: boolean }) {
  return (
    <article className="fd-qwm-card" data-i={i} aria-hidden={hidden || undefined} aria-label={hidden ? undefined : `Post by ${p.name}`}>
      <header className="fd-qwm-ch">
        <Avatar p={p} />
        <span className="fd-qwm-who">
          <span className="fd-qwm-name">{p.name}</span>
          <span className="fd-qwm-handle">@{p.handle}</span>
        </span>
        <time className="fd-qwm-date">{p.date}</time>
      </header>
      <p className="fd-qwm-text">{renderText(p.text)}</p>
      {p.code && (
        <div className="fd-qwm-code"><span aria-hidden="true">$</span>{p.code}</div>
      )}
      {p.before && p.after && (
        <div className="fd-qwm-diff" aria-label={`${p.label ?? "value"} went from ${p.before} to ${p.after}`}>
          <span className="fd-qwm-dl">{p.label}</span>
          <s>{p.before}</s>
          <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true"><path d="M1 5h15M12 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <b>{p.after}</b>
        </div>
      )}
      {p.likes != null && (
        <footer className="fd-qwm-foot">
          <svg width="13" height="12" viewBox="0 0 13 12" aria-hidden="true"><path d="M6.5 11S1 7.6 1 4.1C1 2.4 2.3 1 3.9 1c1.1 0 2 .6 2.6 1.5C7.1 1.6 8 1 9.1 1 10.7 1 12 2.4 12 4.1 12 7.6 6.5 11 6.5 11z" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
          <span>{p.likes.toLocaleString("en-US")}</span>
        </footer>
      )}
    </article>
  );
}

export function QuoteWallMarquee({
  posts = DEFAULT_POSTS,
  rows = 3,
  eyebrow = "// unpaid, unprompted, mostly typed at night",
  title = "People stopped watching the progress bar.",
  aside = "Median CI time across 212 public repos that switched in Q1 2026.",
  stat = ["11m 40s", "2m 06s"],
  speed = 70,
  className,
}: QuoteWallMarqueeProps) {
  const [paused, setPaused] = useState(false);
  const lanes: Post[][] = Array.from({ length: rows }, () => []);
  posts.forEach((p, i) => lanes[i % rows].push(p));
  let n = 0;
  return (
    <section className={`fd-qwm${className ? " " + className : ""}`} data-paused={paused || undefined} aria-label="What developers say">
      <style>{css}</style>
      <div className="fd-qwm-head">
        <div className="fd-qwm-hl">
          <p className="fd-qwm-eyebrow">{eyebrow}</p>
          <h2 className="fd-qwm-title">{title}</h2>
        </div>
        <div className="fd-qwm-hr">
          {stat && (
            <p className="fd-qwm-stat" aria-label={`${stat[0]} before, ${stat[1]} after`}>
              <s>{stat[0]}</s><b>{stat[1]}</b>
            </p>
          )}
          <p className="fd-qwm-aside">{aside}</p>
          <button type="button" className="fd-qwm-pause" style={{ marginTop: 6 }} aria-pressed={paused} onClick={() => setPaused((v) => !v)}>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">{paused ? <path d="M2 1l7 4-7 4z" fill="currentColor" /> : <path d="M2.5 1v8M7.5 1v8" stroke="currentColor" strokeWidth="2" />}</svg>
            {paused ? "Play wall" : "Pause wall"}
          </button>
        </div>
      </div>
      <div className="fd-qwm-rows">
        {lanes.map((lane, r) => {
          const start = n;
          n += lane.length;
          return (
            <div className="fd-qwm-row" key={r} data-dir={r % 2 ? "rev" : "fwd"} style={{ ["--d" as string]: `${speed + r * 9}s` }}>
              <div className="fd-qwm-track">
                {lane.map((p, i) => <Card key={"a" + i} p={p} i={start + i} />)}
                {lane.map((p, i) => <Card key={"b" + i} p={p} i={start + i} hidden />)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const css = `
.fd-qwm,.fd-qwm *,.fd-qwm *::before,.fd-qwm *::after{box-sizing:border-box}
.fd-qwm{--fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --fd-qwm-bg:#11110F;--fd-qwm-card:#191916;--fd-qwm-fg:#ECE8DF;--fd-qwm-mut:#8C877C;--fd-qwm-line:rgba(236,232,223,.09);--fd-qwm-amber:#F0B43C;
  position:relative;display:block;margin:0;padding:80px 0 96px;background:var(--fd-qwm-bg);color:var(--fd-qwm-fg);overflow:hidden;
  font:400 15px/1.5 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;-webkit-font-smoothing:antialiased}
.fd-qwm-head{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:40px;align-items:end;max-width:1240px;margin:0 auto 48px;padding:0 32px}
.fd-qwm-eyebrow{margin:0 0 20px;padding:0;font:500 13px/1.4 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:0;color:var(--fd-qwm-amber)}
.fd-qwm-title{margin:0;padding:0;max-width:13ch;font:700 clamp(2.5rem,5.4vw,4.75rem)/.98 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.045em;color:var(--fd-qwm-fg)}
.fd-qwm-hr{display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding-bottom:6px;border-left:1px solid var(--fd-qwm-line);padding-left:24px}
.fd-qwm-stat{display:flex;align-items:baseline;gap:16px;margin:0;padding:0;font:500 clamp(1.5rem,2.6vw,2rem)/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:-.03em;color:var(--fd-qwm-fg)}
.fd-qwm-stat s{font-size:.6em;color:var(--fd-qwm-mut);text-decoration-color:rgba(236,232,223,.45)}
.fd-qwm-stat b{font-weight:700;color:var(--fd-qwm-amber)}
.fd-qwm-aside{margin:0;padding:0;max-width:34ch;font:400 0.9375rem/1.55 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;color:var(--fd-qwm-mut)}
.fd-qwm-pause{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;gap:8px;height:32px;margin:0;padding:0 14px;border:1px solid var(--fd-qwm-line);border-radius:9999px;background:transparent;color:var(--fd-qwm-fg);cursor:pointer;
  font:500 12px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:0;transition:border-color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-qwm-pause svg{display:block}
.fd-qwm-pause:hover{border-color:rgba(236,232,223,.3)}
.fd-qwm-pause:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-qwm-pause:focus-visible,.fd-qwm-card:focus-visible{outline:2px solid rgba(240,180,60,.7);outline-offset:2px}
.fd-qwm-rows{display:flex;flex-direction:column;gap:16px}
.fd-qwm-row{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent);mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent)}
.fd-qwm-track{display:flex;align-items:stretch;width:max-content;animation:fd-qwm-slide var(--d,70s) linear infinite}
.fd-qwm-row[data-dir="rev"] .fd-qwm-track{animation-direction:reverse}
.fd-qwm-row:hover .fd-qwm-track,.fd-qwm-row:focus-within .fd-qwm-track,.fd-qwm[data-paused] .fd-qwm-track{animation-play-state:paused}
@keyframes fd-qwm-slide{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
.fd-qwm-card{position:relative;display:flex;flex-direction:column;gap:14px;width:340px;margin:0 16px 0 0;padding:20px 20px 16px;border:1px solid var(--fd-qwm-line);border-radius:14px;background:var(--fd-qwm-card);color:var(--fd-qwm-fg);
  transition:border-color var(--fd-dur-2) var(--fd-ease-out),background-color var(--fd-dur-2)}
.fd-qwm-card:nth-child(3n+2){width:376px}.fd-qwm-card:nth-child(4n+3){width:308px}
.fd-qwm-card:hover{border-color:rgba(240,180,60,.38);background:#1D1C18}
.fd-qwm-ch{display:flex;align-items:center;gap:10px;margin:0;padding:0}
.fd-qwm-av{display:block;flex:none;width:36px;height:36px;border-radius:50%;object-fit:cover;object-position:50% 22%;background:#2A2924;filter:grayscale(.15) contrast(1.02)}
.fd-qwm-ini{display:grid;place-items:center;font:600 13px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:0;color:#11110F;background:#C9C2B2}
.fd-qwm-who{display:flex;flex-direction:column;min-width:0;flex:1}
.fd-qwm-name{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:600 14px/1.25 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.01em;color:var(--fd-qwm-fg)}
.fd-qwm-handle,.fd-qwm-date{display:block;font:400 12px/1.4 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:0;color:var(--fd-qwm-mut)}
.fd-qwm-date{align-self:flex-start;flex:none}
.fd-qwm-text{margin:0;padding:0;font:400 0.9375rem/1.5 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.006em;color:#DAD5CA;text-wrap:pretty}
.fd-qwm-ic{display:inline;margin:0;padding:1px 5px;border-radius:5px;background:rgba(240,180,60,.12);font:500 0.8125rem/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:0;color:var(--fd-qwm-amber)}
.fd-qwm-code{display:flex;gap:10px;margin:0;padding:9px 12px;border-radius:8px;background:#0C0C0A;border:1px solid var(--fd-qwm-line);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
  font:400 12px/1.4 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:0;color:#CFC9BC}
.fd-qwm-code span{color:var(--fd-qwm-amber)}
.fd-qwm-diff{display:flex;align-items:center;gap:10px;margin:0;padding:9px 12px;border-radius:8px;border:1px dashed rgba(236,232,223,.16);font:500 13px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:0;color:var(--fd-qwm-fg)}
.fd-qwm-dl{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--fd-qwm-mut)}
.fd-qwm-diff s{text-decoration:line-through;text-decoration-color:rgba(236,232,223,.4);color:var(--fd-qwm-mut)}
.fd-qwm-diff svg{display:block;color:var(--fd-qwm-amber);transition:transform var(--fd-dur-3) var(--fd-spring)}
.fd-qwm-card:hover .fd-qwm-diff svg{transform:translateX(3px)}
.fd-qwm-diff b{font-weight:700;color:var(--fd-qwm-amber)}
.fd-qwm-foot{display:flex;align-items:center;gap:6px;margin:auto 0 0;padding:10px 0 0;border-top:1px solid var(--fd-qwm-line);font:400 12px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:0;color:var(--fd-qwm-mut)}
.fd-qwm-foot svg{display:block}
@media (max-width:760px){
  .fd-qwm{padding:64px 0 72px}
  .fd-qwm-head{grid-template-columns:1fr;gap:24px;margin-bottom:36px;padding:0 16px}
  .fd-qwm-hr{border-left:0;padding-left:0;border-top:1px solid var(--fd-qwm-line);padding-top:20px}
  .fd-qwm-card,.fd-qwm-card:nth-child(3n+2),.fd-qwm-card:nth-child(4n+3){width:286px;margin-right:12px}
  .fd-qwm-rows{gap:12px}
}
@media (prefers-reduced-motion:reduce){
  .fd-qwm-pause{display:none}
  .fd-qwm-rows{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;max-width:1240px;margin:0 auto;padding:0 32px}
  .fd-qwm-row,.fd-qwm-track{display:contents}
  .fd-qwm-card[aria-hidden="true"]{display:none}
  .fd-qwm-card,.fd-qwm-card:nth-child(3n+2),.fd-qwm-card:nth-child(4n+3){width:auto;margin:0}
  .fd-qwm-card[data-i="0"]{order:0}
  .fd-qwm *{transition-duration:1ms!important}
}
@media (prefers-reduced-motion:reduce) and (max-width:760px){
  .fd-qwm-rows{padding:0 16px;grid-template-columns:1fr}
  .fd-qwm-card[data-i="6"],.fd-qwm-card[data-i="7"],.fd-qwm-card[data-i="8"],.fd-qwm-card[data-i="9"],.fd-qwm-card[data-i="10"],.fd-qwm-card[data-i="11"]{display:none}
}
@media (prefers-contrast:more){.fd-qwm-card{border-color:currentColor}}
`;

export function Demo() {
  return (
    <div className="fd-qwmd">
      <style>{demoCss}</style>
      <div className="fd-qwmd-bar">
        <span className="fd-qwmd-logo">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="1" y="1" width="16" height="16" rx="3" fill="none" stroke="#F0B43C" strokeWidth="1.6" /><path d="M5 6h8M5 9h5M5 12h8" stroke="#F0B43C" strokeWidth="1.6" strokeLinecap="round" /></svg>
          ferrule
        </span>
        <span className="fd-qwmd-meta">remote cache + CI runners · v4.2</span>
      </div>
      <QuoteWallMarquee />
    </div>
  );
}

const demoCss = `
.fd-qwmd,.fd-qwmd *{box-sizing:border-box}
.fd-qwmd{min-height:100vh;margin:0;padding:0;background:#11110F;font:400 14px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif}
.fd-qwmd-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;height:56px;margin:0;padding:0 32px;border-bottom:1px solid rgba(236,232,223,.07)}
.fd-qwmd-logo{display:inline-flex;align-items:center;gap:10px;font:700 17px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:-.02em;color:#ECE8DF}
.fd-qwmd-logo svg{display:block}
.fd-qwmd-meta{font:400 12px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;letter-spacing:0;color:#8C877C}
@media (max-width:760px){.fd-qwmd-bar{padding:0 16px}.fd-qwmd-meta{display:none}}
`;
