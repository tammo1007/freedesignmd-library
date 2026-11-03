/**
 * ProcessTimeline — a shipment's journey as a timeline: stages with
 * timestamps along an SVG route, a marker that travels the route to the live
 * position when it scrolls into view, and stage cards that expand into an
 * event log. Horizontal on desktop, a vertical rail on narrow screens.
 *
 * Props: reference, origin, destination, eta, stages ({ id, title, place,
 * time, status: "done" | "live" | "next", leg?, events[] }), progress (0..1,
 * how far the live leg is done).
 * CSS vars: --fd-ptl-bg, --fd-ptl-ink, --fd-ptl-signal.
 *
 * Browser support: all evergreen browsers (SVGPathElement.getPointAtLength).
 * Motion: one rAF tween moves the marker along the path with transform only,
 * started by an IntersectionObserver; it rests when it arrives.
 * Accessibility: stages are an ordered list; each card's details toggle is a
 * button with aria-expanded; the route SVG is decorative, its information is
 * in the list. The live stage carries aria-current="step".
 * Reduced motion: the marker is placed at the live position immediately and
 * does not bob.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface PtlStage {
  id: string;
  title: string;
  place: string;
  time: string;
  status: "done" | "live" | "next";
  leg?: string;
  events: { t: string; text: string }[];
}

export interface ProcessTimelineProps {
  reference?: string;
  origin?: string;
  destination?: string;
  eta?: ReactNode;
  stages?: PtlStage[];
  progress?: number;
  className?: string;
}

const DEFAULT_STAGES: PtlStage[] = [
  { id: "pickup", title: "Collected", place: "Castellón de la Plana, ES", time: "Mon 3 Nov, 07:40", status: "done", leg: "Truck · 74 km", events: [{ t: "07:40", text: "22 pallets loaded, 14,380 kg" }, { t: "07:52", text: "Seal 448120 applied, photo on file" }, { t: "09:05", text: "Gate in, Valencia Principe Felipe" }] },
  { id: "valencia", title: "Port of Valencia", place: "Export cleared, loaded", time: "Mon 3 Nov, 16:15", status: "done", leg: "MV Nordkapp · 1,940 km sailed", events: [{ t: "11:30", text: "Export declaration MRN 25ES00…7A released" }, { t: "16:15", text: "Container HLDU 204931 loaded, bay 22" }, { t: "22:00", text: "Vessel departed, 2 h late on berth" }] },
  { id: "sea", title: "At sea", place: "Bay of Biscay, 11.4 kn", time: "Wed 5 Nov, 09:20", status: "live", leg: "1,260 km to go", events: [{ t: "09:20", text: "Position 45.12 N, 6.80 W" }, { t: "06:00", text: "Swell 2.1 m, no delay expected" }, { t: "Tue", text: "Passed Finisterre, back on schedule" }] },
  { id: "rotterdam", title: "Rotterdam", place: "Maasvlakte, onto rail", time: "Thu 6 Nov, 06:00", status: "next", leg: "Rail + ferry · 1,180 km", events: [{ t: "ETA", text: "Berth at ECT Delta, 06:00" }, { t: "ETA", text: "Rail slot booked, 11:40 to Göteborg" }] },
  { id: "gothenburg", title: "Delivered", place: "Nordisk Kakel AB, Göteborg", time: "Fri 7 Nov, 14:00–16:00", status: "next", events: [{ t: "ETA", text: "Tail-lift truck, dock 4" }, { t: "Note", text: "Call Linnea 30 min before arrival" }] },
];

const YS = [86, 52, 100, 60, 90];

function routePath(n: [number, number][]) {
  let d = `M${n[0][0]} ${n[0][1]}`;
  for (let i = 1; i < n.length; i++) {
    const [x0, y0] = n[i - 1], [x1, y1] = n[i];
    const dx = (x1 - x0) * 0.45;
    d += ` C${x0 + dx} ${y0}, ${x1 - dx} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

export function ProcessTimeline({
  reference = "HLD-20931",
  origin = "Castellón",
  destination = "Göteborg",
  eta = <>Fri 7 Nov<br />14:00–16:00</>,
  stages = DEFAULT_STAGES,
  progress = 0.18,
  className,
}: ProcessTimelineProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [arrived, setArrived] = useState(false);
  const pathRef = useRef<SVGPathElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const doneRef = useRef<SVGPathElement>(null);
  const root = useRef<HTMLElement>(null);
  const uid = useId();
  const nodes: [number, number][] = stages.map((_, i) => [Math.round(((i + 0.5) / stages.length) * 1010), YS[i % YS.length]]);
  const d = routePath(nodes);
  const live = Math.max(0, stages.findIndex((s) => s.status === "live"));
  const doneCount = stages.filter((s) => s.status === "done").length;
  const pct = Math.round(((doneCount + progress) / Math.max(1, stages.length - 1)) * 100);

  useEffect(() => {
    const p = pathRef.current, m = markRef.current, dn = doneRef.current, el = root.current;
    if (!p || !m || !dn || !el) return;
    const total = p.getTotalLength();
    // find the length on the path whose x matches the live position
    const tx = nodes[live][0] + ((nodes[Math.min(live + 1, nodes.length - 1)][0] - nodes[live][0]) * progress);
    let lo = 0, hi = total;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (p.getPointAtLength(mid).x < tx) lo = mid; else hi = mid; }
    const target = lo;
    const box = m.parentElement!;
    let last = 0;
    const place = (len: number) => {
      last = len;
      const pt = p.getPointAtLength(len);
      const W = box.clientWidth, H = box.clientHeight;
      m.style.transform = `translate(${(pt.x / 1010) * W}px, ${(pt.y / 150) * H}px)`;
      dn.style.strokeDasharray = `${len} ${total}`;
    };
    const ro = new ResizeObserver(() => place(last));
    ro.observe(box);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { place(target); setArrived(true); return () => ro.disconnect(); }
    place(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 2400;
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        const ease = 1 - Math.pow(1 - k, 4);
        place(target * ease);
        if (k < 1) raf = requestAnimationFrame(step); else setArrived(true);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); };
  }, [d, live, progress]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section ref={root} className={`fd-ptl${className ? " " + className : ""}`} aria-labelledby={`${uid}-h`} style={{ ["--fd-ptl-cols" as string]: stages.length }}>
      <style>{css}</style>
      <header className="fd-ptl-head">
        <div>
          <p className="fd-ptl-ref"><span className="fd-ptl-live" aria-hidden="true" />Shipment {reference} · FCL 40′ · Tiles, porcelain</p>
          <h2 id={`${uid}-h`} className="fd-ptl-title">{origin}<span aria-label=" to "> → </span>{destination}</h2>
        </div>
        <dl className="fd-ptl-stats">
          <div><dt>Status</dt><dd>On time</dd></div>
          <div><dt>Journey</dt><dd className="fd-ptl-mono">{pct}%</dd></div>
          <div><dt>ETA</dt><dd>{eta}</dd></div>
        </dl>
      </header>

      <div className="fd-ptl-map" aria-hidden="true">
        <svg viewBox="0 0 1010 150" preserveAspectRatio="none">
          <path d={d} className="fd-ptl-road" vectorEffect="non-scaling-stroke" />
          <path ref={doneRef} d={d} className="fd-ptl-done" />
          <path ref={pathRef} d={d} fill="none" stroke="none" />
        </svg>
        {nodes.map(([x, y], i) => i < nodes.length - 1 && stages[i].leg ? (
          <span key={i} className="fd-ptl-leg" style={{ left: `${((x + nodes[i + 1][0]) / 2 / 1010) * 100}%`, top: `${((Math.max(y, nodes[i + 1][1]) + 26) / 150) * 100}%` }}>{stages[i].leg}</span>
        ) : null)}
        {nodes.map(([x, y], i) => (
          <span key={i} className="fd-ptl-node" data-s={stages[i].status} style={{ left: `${(x / 1010) * 100}%`, top: `${(y / 150) * 100}%` }} />
        ))}
        <span ref={markRef} className="fd-ptl-marker" data-arrived={arrived ? "" : undefined}>
          <span className="fd-ptl-bob">
            <svg viewBox="-24 -24 48 48" width="48" height="48">
              <circle r="22" className="fd-ptl-halo" />
              <circle r="15" className="fd-ptl-dot" />
              <path d="M-8 1 L8 1 L5.5 6 L-5.5 6 Z M-3 1 V-6 H3 V1" className="fd-ptl-ship" />
            </svg>
          </span>
        </span>
      </div>

      <ol className="fd-ptl-stages">
        {stages.map((s, i) => {
          const isOpen = open === s.id;
          return (
            <li key={s.id} className="fd-ptl-stage" data-s={s.status} data-open={isOpen ? "" : undefined} aria-current={s.status === "live" ? "step" : undefined}>
              <span className="fd-ptl-rail" aria-hidden="true"><i /></span>
              <p className="fd-ptl-n"><span>{String(i + 1).padStart(2, "0")}</span>{s.status === "done" ? "Done" : s.status === "live" ? "Now" : "Planned"}</p>
              <h3 className="fd-ptl-st">{s.title}</h3>
              <p className="fd-ptl-place">{s.place}</p>
              <p className="fd-ptl-time">{s.time}</p>
              {s.leg && <p className="fd-ptl-mleg">{s.leg}</p>}
              <button type="button" className="fd-ptl-more" aria-expanded={isOpen} aria-controls={`${uid}-e-${i}`} onClick={() => setOpen(isOpen ? null : s.id)}>
                {isOpen ? "Hide log" : `Log, ${s.events.length} events`}
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div className="fd-ptl-log" id={`${uid}-e-${i}`}>
                <ul>
                  {s.events.map((e, k) => <li key={k}><span>{e.t}</span>{e.text}</li>)}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const css = `
:where(.fd-ptl,.fd-ptl *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-ptl,.fd-ptl *)::before,:where(.fd-ptl,.fd-ptl *)::after{box-sizing:border-box}
:where(.fd-ptl svg){display:block}
:where(.fd-ptl button){appearance:none;-webkit-appearance:none;outline:0;border-radius:0;cursor:pointer;text-align:left}
.fd-ptl{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-ptl-bg:#ECEEEA;--fd-ptl-ink:#0F2E33;--fd-ptl-mut:#5F7276;--fd-ptl-line:rgba(15,46,51,.16);--fd-ptl-signal:#F4C21B;--fd-ptl-card:#F6F7F4;
  --fd-ptl-sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
  --fd-ptl-mono-f:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  display:block;width:100%;background:var(--fd-ptl-bg);color:var(--fd-ptl-ink);padding:clamp(48px,7vw,104px) clamp(16px,4vw,56px);
  font:400 14px/1.5 var(--fd-ptl-sans);-webkit-font-smoothing:antialiased}
.fd-ptl-mono{font-family:var(--fd-ptl-mono-f);font-variant-numeric:tabular-nums}
.fd-ptl-head{max-width:1280px;margin:0 auto 40px;display:flex;justify-content:space-between;align-items:flex-end;gap:32px;flex-wrap:wrap;background:var(--fd-ptl-bg);padding:8px 0}
.fd-ptl-ref{display:flex;align-items:center;gap:10px;font:500 12px/16px var(--fd-ptl-mono-f);letter-spacing:.02em;color:var(--fd-ptl-mut)}
.fd-ptl-live{position:relative;width:8px;height:8px;border-radius:50%;background:#2E9E5B}
.fd-ptl-live::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1.5px solid #2E9E5B;animation:fd-ptl-ping 2s var(--fd-ease-out) infinite}
@keyframes fd-ptl-ping{from{opacity:.8;transform:scale(.6)}to{opacity:0;transform:scale(1.6)}}
.fd-ptl-title{margin-top:12px;font:800 clamp(2.5rem,6.4vw,5.75rem)/.92 var(--fd-ptl-sans);letter-spacing:-.05em;text-transform:uppercase}
.fd-ptl-title span{font-weight:300;color:var(--fd-ptl-mut)}
.fd-ptl-stats{margin-left:auto;display:flex;gap:0;border:1px solid var(--fd-ptl-ink);background:var(--fd-ptl-card)}
.fd-ptl-stats div{padding:12px 18px;border-left:1px solid var(--fd-ptl-line);min-width:110px}
.fd-ptl-stats div:first-child{border-left:0}
.fd-ptl-stats dt{font:500 10px/14px var(--fd-ptl-mono-f);letter-spacing:.12em;text-transform:uppercase;color:var(--fd-ptl-mut)}
.fd-ptl-stats dd{margin-top:4px;font:700 16px/1.2 var(--fd-ptl-sans);letter-spacing:-.01em}
.fd-ptl-stats div:first-child dd{color:#1E7A45}
.fd-ptl-map{position:relative;max-width:1280px;margin:0 auto;height:150px}
.fd-ptl-map>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.fd-ptl-road{fill:none;stroke:var(--fd-ptl-ink);stroke-width:2;stroke-dasharray:2 7;stroke-linecap:round;opacity:.5}
.fd-ptl-done{fill:none;stroke:var(--fd-ptl-ink);stroke-width:3.5;stroke-linecap:round;stroke-dasharray:0 99999}
.fd-ptl-leg{position:absolute;transform:translateX(-50%);white-space:nowrap;font:500 11px/14px var(--fd-ptl-mono-f);color:var(--fd-ptl-mut);letter-spacing:.02em;background:var(--fd-ptl-bg);padding:0 4px}
.fd-ptl-node{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--fd-ptl-bg);box-shadow:inset 0 0 0 2px var(--fd-ptl-ink)}
.fd-ptl-node[data-s="done"]{background:var(--fd-ptl-ink)}
.fd-ptl-node[data-s="live"]{box-shadow:inset 0 0 0 2px var(--fd-ptl-ink),0 0 0 4px var(--fd-ptl-bg)}
.fd-ptl-marker{position:absolute;left:-24px;top:-24px;width:48px;height:48px;pointer-events:none;will-change:transform}
.fd-ptl-bob{display:block;width:48px;height:48px}
.fd-ptl-marker svg{position:static!important;width:48px!important;height:48px!important;overflow:visible}
.fd-ptl-halo{transform-box:fill-box;transform-origin:center}
.fd-ptl-halo{fill:var(--fd-ptl-signal);opacity:.25}
.fd-ptl-dot{fill:var(--fd-ptl-signal);stroke:var(--fd-ptl-ink);stroke-width:1.5}
.fd-ptl-ship{fill:var(--fd-ptl-ink)}
.fd-ptl-marker[data-arrived] .fd-ptl-bob{animation:fd-ptl-bob 2.6s var(--fd-ease-in-out) infinite}
.fd-ptl-marker[data-arrived] .fd-ptl-halo{animation:fd-ptl-halo 2.6s var(--fd-ease-out) infinite}
@keyframes fd-ptl-bob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-3px) rotate(3deg)}}
@keyframes fd-ptl-halo{0%{opacity:.4;transform:scale(.7)}100%{opacity:0;transform:scale(1.5)}}
.fd-ptl-stages{max-width:1280px;margin:28px auto 0;display:grid;grid-template-columns:repeat(var(--fd-ptl-cols),minmax(0,1fr));border-top:1px solid var(--fd-ptl-ink)}
.fd-ptl-stage{position:relative;padding:18px 20px 20px;border-left:1px solid var(--fd-ptl-line);background:var(--fd-ptl-card);transition:background-color var(--fd-dur-2)}
.fd-ptl-stage:first-child{border-left:0}
.fd-ptl-stage[data-s="live"]{background:#fff;box-shadow:inset 0 3px 0 var(--fd-ptl-signal)}
.fd-ptl-stage[data-s="next"] .fd-ptl-st,.fd-ptl-stage[data-s="next"] .fd-ptl-time{color:var(--fd-ptl-mut)}
.fd-ptl-rail{display:none}
.fd-ptl-n{display:flex;align-items:center;gap:8px;font:500 11px/14px var(--fd-ptl-mono-f);letter-spacing:.1em;text-transform:uppercase;color:var(--fd-ptl-mut)}
.fd-ptl-n span{padding:2px 5px;border-radius:3px;background:var(--fd-ptl-ink);color:var(--fd-ptl-bg);letter-spacing:0}
.fd-ptl-stage[data-s="next"] .fd-ptl-n span{background:none;color:var(--fd-ptl-mut);box-shadow:inset 0 0 0 1px var(--fd-ptl-line)}
.fd-ptl-stage[data-s="live"] .fd-ptl-n{color:var(--fd-ptl-ink)}
.fd-ptl-stage[data-s="live"] .fd-ptl-n span{background:var(--fd-ptl-signal);color:var(--fd-ptl-ink)}
.fd-ptl-st{margin-top:14px;font:700 19px/1.2 var(--fd-ptl-sans);letter-spacing:-.02em}
.fd-ptl-place{margin-top:2px;font:400 13px/1.4 var(--fd-ptl-sans);color:var(--fd-ptl-mut)}
.fd-ptl-time{margin-top:14px;font:500 13px/1.3 var(--fd-ptl-mono-f);font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.fd-ptl-mleg{display:none}
.fd-ptl-more{display:inline-flex;align-items:center;gap:6px;margin-top:14px;font:600 12px/16px var(--fd-ptl-sans);color:var(--fd-ptl-ink);padding:4px 0;border-bottom:1px solid var(--fd-ptl-line);transition:border-color var(--fd-dur-1)}
.fd-ptl-more:hover{border-color:var(--fd-ptl-ink)}
.fd-ptl-more:focus-visible{outline:2px solid rgba(15,46,51,.7);outline-offset:2px;border-radius:2px}
.fd-ptl-more svg{transition:transform var(--fd-dur-3) var(--fd-ease-in-out)}
.fd-ptl-stage[data-open] .fd-ptl-more svg{transform:rotate(180deg)}
.fd-ptl-log{display:grid;grid-template-rows:0fr;transition:grid-template-rows var(--fd-dur-3) var(--fd-ease-in-out)}
.fd-ptl-stage[data-open] .fd-ptl-log{grid-template-rows:1fr}
.fd-ptl-log ul{min-height:0;overflow:hidden}
.fd-ptl-log li{display:grid;grid-template-columns:44px minmax(0,1fr);gap:8px;padding:8px 0 0;font:400 12.5px/1.4 var(--fd-ptl-sans);color:var(--fd-ptl-ink)}
.fd-ptl-log li:first-child{margin-top:10px}
.fd-ptl-log li span{font:500 11px/1.6 var(--fd-ptl-mono-f);color:var(--fd-ptl-mut)}
@media (max-width:860px){
  .fd-ptl-map{display:none}
  .fd-ptl-head{margin-bottom:28px}
  .fd-ptl-stats{width:100%}
  .fd-ptl-stats div{flex:1;min-width:0;padding:10px 12px}
  .fd-ptl-stats dd{font-size:14px}
  .fd-ptl-stages{grid-template-columns:minmax(0,1fr);border-top:0;margin-top:0;background:none}
  .fd-ptl-stage{border-left:0;padding:0 0 28px 52px;background:none;box-shadow:none!important}
  .fd-ptl-stage[data-s="live"]{background:none}
  .fd-ptl-rail{display:block;position:absolute;left:16px;top:0;bottom:0;width:4px}
  .fd-ptl-rail::before{content:"";position:absolute;left:1px;top:20px;bottom:-2px;width:2px;background:repeating-linear-gradient(var(--fd-ptl-ink) 0 2px,transparent 2px 9px);opacity:.5}
  .fd-ptl-stage[data-s="done"] .fd-ptl-rail::before{background:var(--fd-ptl-ink);opacity:1;width:4px;left:0}
  .fd-ptl-stage:last-child .fd-ptl-rail::before{display:none}
  .fd-ptl-rail i{position:absolute;left:-5px;top:2px;width:14px;height:14px;border-radius:50%;background:var(--fd-ptl-bg);box-shadow:inset 0 0 0 2px var(--fd-ptl-ink)}
  .fd-ptl-stage[data-s="done"] .fd-ptl-rail i{background:var(--fd-ptl-ink)}
  .fd-ptl-stage[data-s="live"] .fd-ptl-rail::after{content:"";position:absolute;left:-11px;top:46%;width:26px;height:26px;border-radius:50%;background:var(--fd-ptl-signal);box-shadow:0 0 0 1.5px var(--fd-ptl-ink),0 0 0 8px rgba(244,194,27,.25)}
  .fd-ptl-stage[data-s="live"] .fd-ptl-rail{background:linear-gradient(var(--fd-ptl-ink) 0 46%,transparent 46%)}
  .fd-ptl-st{margin-top:8px}
  .fd-ptl-time{margin-top:8px}
  .fd-ptl-mleg{display:block;margin-top:14px;font:500 11px/14px var(--fd-ptl-mono-f);color:var(--fd-ptl-mut)}
  .fd-ptl-mleg::before{content:"↓ "}
}
@media (prefers-reduced-motion:reduce){
  .fd-ptl *,.fd-ptl *::after{transition-duration:1ms!important;animation:none!important}
}
`;

export function Demo() {
  return (
    <div className="fd-ptld">
      <style>{`.fd-ptld{background:#ECEEEA;min-height:100vh}.fd-ptld-nav{box-sizing:border-box;max-width:1392px;margin:0 auto;height:60px;padding:0 clamp(16px,4vw,56px);display:flex;justify-content:space-between;align-items:center;font:500 13px/18px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter",sans-serif;color:#5F7276;border-bottom:1px solid #0F2E33}.fd-ptld-nav b{display:flex;align-items:center;gap:8px;font:900 17px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Inter",sans-serif;letter-spacing:.02em;color:#0F2E33}.fd-ptld-nav b i{display:block;width:14px;height:14px;background:repeating-linear-gradient(-45deg,#0F2E33 0 3px,#F4C21B 3px 6px)}`}</style>
      <div className="fd-ptld-nav"><b><i />HALDEN FREIGHT</b><span>Track · Quote · Account</span></div>
      <ProcessTimeline />
    </div>
  );
}
