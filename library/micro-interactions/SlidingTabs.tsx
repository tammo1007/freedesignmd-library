/**
 * SlidingTabs, tabs with a bar under the active one that stretches toward
 * the new tab: the leading edge arrives first, the trailing edge follows.
 *
 * Props: items[] ({ value, label }), value / defaultValue / onChange,
 * aria-label (required for screen readers).
 * CSS vars: --fd-st-accent (bar), --fd-st-ink, --fd-st-muted.
 *
 * Browser support: all evergreen browsers; edges are placed from measured
 * offsets (ResizeObserver), so any label width works.
 * Accessibility: role="tablist" with a roving tabindex, ArrowLeft/Right move
 * focus and select, Home/End jump. Reduced motion: the bar jumps.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface TabItem {
  value: string;
  label: string;
}

export interface SlidingTabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}

export function SlidingTabs({ items, value, defaultValue, onChange, className, "aria-label": label }: SlidingTabsProps) {
  const [inner, setInner] = useState(defaultValue ?? items[0]?.value);
  const current = value ?? inner;
  const list = useRef<HTMLDivElement>(null);
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [edge, setEdge] = useState<{ l: number; r: number; dir: 1 | -1 } | null>(null);

  const measure = useCallback(() => {
    const el = tabs.current[current];
    const box = list.current;
    if (!el || !box) return;
    const l = el.offsetLeft;
    const r = box.clientWidth - (el.offsetLeft + el.offsetWidth);
    setEdge((old) => ({ l, r, dir: old && l < old.l ? -1 : 1 }));
  }, [current]);

  useIso(measure, [measure, items]);
  useEffect(() => {
    const box = list.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [measure]);

  const select = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };
  const key = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    let to = -1;
    if (step) to = (i + step + items.length) % items.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = items.length - 1;
    if (to < 0) return;
    e.preventDefault();
    const v = items[to].value;
    select(v);
    tabs.current[v]?.focus();
  };

  return (
    <div className={`fd-st${className ? ` ${className}` : ""}`}>
      <style>{css}</style>
      <div ref={list} className="fd-st-list" role="tablist" aria-label={label}>
        {items.map((it, i) => (
          <button
            key={it.value}
            ref={(n) => {
              tabs.current[it.value] = n;
            }}
            type="button"
            role="tab"
            className="fd-st-tab"
            aria-selected={current === it.value}
            tabIndex={current === it.value ? 0 : -1}
            onClick={() => select(it.value)}
            onKeyDown={(e) => key(e, i)}
          >
            {it.label}
          </button>
        ))}
        {edge ? (
          <span
            className="fd-st-bar"
            aria-hidden="true"
            style={{
              left: edge.l,
              right: edge.r,
              transitionDuration: edge.dir > 0 ? "480ms, 260ms" : "260ms, 480ms",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

const FONT = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
const css = `
.fd-st,.fd-st *,.fd-st *::before,.fd-st *::after{box-sizing:border-box}
.fd-st{--fd-st-accent:#111;--fd-st-ink:#111;--fd-st-muted:rgba(0,0,0,.45);display:inline-block;margin:0;padding:0;font:400 15px/1.2 ${FONT}}
.fd-st-list{position:relative;display:flex;gap:6px;margin:0;padding:0 0 2px;border-bottom:1px solid rgba(0,0,0,.1)}
.fd-st-tab{display:block;margin:0;padding:10px 14px 12px;border:0;border-radius:10px 10px 0 0;background:transparent;color:var(--fd-st-muted);font:500 15px/1.2 ${FONT};letter-spacing:normal;cursor:pointer;appearance:none;-webkit-appearance:none;transition:color 240ms;-webkit-tap-highlight-color:transparent}
.fd-st-tab:hover{color:rgba(0,0,0,.72)}
.fd-st-tab[aria-selected="true"]{color:var(--fd-st-ink)}
.fd-st-tab:focus-visible{outline:2px solid #1a73e8;outline-offset:-2px}
.fd-st-bar{position:absolute;bottom:-1px;display:block;height:2px;margin:0;padding:0;border-radius:2px;background:var(--fd-st-accent);transition-property:left,right;transition-timing-function:cubic-bezier(0.22,1,0.36,1)}
@media (prefers-reduced-motion:reduce){.fd-st-bar{transition:none!important}}
`;

export function Demo() {
  return (
    <div className="fd-std">
      <style>{demoCss}</style>
      <SlidingTabs
        aria-label="Sections"
        defaultValue="activity"
        items={[
          { value: "overview", label: "Overview" },
          { value: "activity", label: "Activity" },
          { value: "files", label: "Files" },
          { value: "settings", label: "Settings" },
        ]}
      />
    </div>
  );
}

const demoCss = `
.fd-std,.fd-std *,.fd-std *::before,.fd-std *::after{box-sizing:border-box}
.fd-std{display:flex;align-items:center;justify-content:center;width:100%;min-height:100vh;margin:0;padding:48px 20px;background:#ececec;font:400 15px/1.4 ${FONT};letter-spacing:normal;overflow:hidden}
`;
