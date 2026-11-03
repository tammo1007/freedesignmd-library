/**
 * Authoring helpers for v2 systems. These only FORMAT values that the system file passes in
 * explicitly, nothing is inferred from tags or archetypes. Keeps 30 hand-authored systems
 * readable without 1,000 lines of repeated `transition:` boilerplate each.
 */
import type { ComponentSpecs, TypeStyleV2 } from "../types";

export const SANS = "ui-sans-serif, system-ui, -apple-system, sans-serif";
export const SERIF = "ui-serif, Georgia, 'Times New Roman', serif";
export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** `transition:` declaration from property names + duration token + easing token. */
export const tr = (
  props: string[],
  dur: "instant" | "fast" | "base" | "slow" = "fast",
  ease: "standard" | "out" | "in" = "standard",
) => `transition: ${props.map((p) => `${p} var(--duration-${dur}) var(--ease-${ease})`).join(", ")}`;

/** Type style shorthand: t("display", 72, 1.02, 600, "-0.04em") */
export const t = (
  font: TypeStyleV2["font"],
  size: number,
  leading: number,
  weight: number,
  tracking: string,
  opts: { uppercase?: boolean; italic?: boolean } = {},
): TypeStyleV2 => ({ font, size, leading, weight, tracking, ...opts });

export type BtnBase = {
  font: "display" | "sans" | "mono";
  size: number;
  weight: number;
  height: number;
  px: number;
  radius: "sm" | "md" | "lg" | "xl" | "full" | "0";
  tracking?: string;
  uppercase?: boolean;
  border?: string;
  extra?: string;
};

export const btnBase = (b: BtnBase) =>
  [
    "display: inline-flex",
    "align-items: center",
    "justify-content: center",
    "gap: 8px",
    `height: ${b.height}px`,
    `padding: 0 ${b.px}px`,
    `font-family: var(--font-${b.font})`,
    `font-size: ${b.size}px`,
    `font-weight: ${b.weight}`,
    `letter-spacing: ${b.tracking ?? "0em"}`,
    b.uppercase ? "text-transform: uppercase" : "",
    `border-radius: ${b.radius === "0" ? "0" : `var(--radius-${b.radius})`}`,
    `border: ${b.border ?? "1px solid transparent"}`,
    "white-space: nowrap",
    "cursor: pointer",
    "text-decoration: none",
    tr(["background-color", "border-color", "color", "box-shadow", "transform"], "fast"),
    b.extra ?? "",
  ]
    .filter(Boolean)
    .join("; ");

/** Input recipe from explicit parts. */
export const input = (p: {
  height: number;
  radius: "sm" | "md" | "lg" | "full" | "0";
  border: string;
  background: string;
  px: number;
  size: number;
  font?: "sans" | "mono";
  hoverBorder: string;
  focus: string;
  extra?: string;
}): ComponentSpecs["input"] => ({
  rest: [
    "display: block",
    "width: 100%",
    `height: ${p.height}px`,
    `padding: 0 ${p.px}px`,
    `font-family: var(--font-${p.font ?? "sans"})`,
    `font-size: ${p.size}px`,
    "color: var(--foreground)",
    `background: ${p.background}`,
    `border: ${p.border}`,
    `border-radius: ${p.radius === "0" ? "0" : `var(--radius-${p.radius})`}`,
    "outline: none",
    tr(["border-color", "box-shadow", "background-color"], "fast"),
    p.extra ?? "",
  ]
    .filter(Boolean)
    .join("; "),
  placeholder: "color: var(--muted-foreground); opacity: 1",
  hover: `border-color: ${p.hoverBorder}`,
  focus: p.focus,
  invalid: "border-color: var(--destructive); box-shadow: 0 0 0 3px color-mix(in oklab, var(--destructive) 22%, transparent)",
  disabled: "opacity: 0.5; cursor: not-allowed; background: var(--muted)",
});

export const overlay = (color: string, blur = 0) =>
  `position: fixed; inset: 0; background: ${color}; ${blur ? `backdrop-filter: blur(${blur}px); -webkit-backdrop-filter: blur(${blur}px); ` : ""}display: grid; place-items: center; padding: 24px`;

type R = "sm" | "md" | "lg" | "xl" | "full" | "0";
const rad = (r: R) => (r === "0" ? "0" : `var(--radius-${r})`);
const font = (f: "display" | "sans" | "mono") => `var(--font-${f})`;

/** Card recipe. `hover` is the full hover declaration list. */
export const card = (p: { radius: R; border: string; background?: string; shadow?: "sm" | "md" | "none"; padding?: number; extra?: string; hover: string }): ComponentSpecs["card"] => ({
  rest: [
    `background: ${p.background ?? "var(--card)"}`,
    "color: var(--card-foreground)",
    `border: ${p.border}`,
    `border-radius: ${rad(p.radius)}`,
    `box-shadow: ${p.shadow && p.shadow !== "none" ? `var(--shadow-${p.shadow})` : "none"}`,
    p.padding !== undefined ? `padding: ${p.padding}px` : "",
    tr(["border-color", "box-shadow", "transform", "background-color"], "base", "out"),
    p.extra ?? "",
  ]
    .filter(Boolean)
    .join("; "),
  hover: p.hover,
});

/** Badge recipe. soft = tone mixed into the surface at `softPct`%. */
export const badge = (p: {
  height: number;
  px: number;
  radius: R;
  size: number;
  weight: number;
  font?: "display" | "sans" | "mono";
  uppercase?: boolean;
  tracking?: string;
  softPct?: number;
  outline?: string;
}): ComponentSpecs["badge"] => ({
  base: [
    "--tone: var(--primary)",
    "--tone-foreground: var(--primary-foreground)",
    "display: inline-flex",
    "align-items: center",
    "gap: 6px",
    `height: ${p.height}px`,
    `padding: 0 ${p.px}px`,
    `border-radius: ${rad(p.radius)}`,
    `font-family: ${font(p.font ?? "sans")}`,
    `font-size: ${p.size}px`,
    `font-weight: ${p.weight}`,
    `letter-spacing: ${p.tracking ?? "0em"}`,
    p.uppercase ? "text-transform: uppercase" : "",
    "line-height: 1",
    "white-space: nowrap",
  ]
    .filter(Boolean)
    .join("; "),
  solid: "background: var(--tone); color: var(--tone-foreground); border: 1px solid var(--tone)",
  soft: `background: color-mix(in oklab, var(--tone) ${p.softPct ?? 14}%, var(--card)); color: var(--foreground); border: 1px solid color-mix(in oklab, var(--tone) ${(p.softPct ?? 14) + 16}%, transparent)`,
  outline: p.outline ?? "background: transparent; color: var(--foreground); border: 1px solid var(--border)",
});

export const nav = (p: {
  height: number;
  background: string;
  border?: string;
  blur?: number;
  size: number;
  weight: number;
  font?: "display" | "sans" | "mono";
  uppercase?: boolean;
  tracking?: string;
  style: "pill" | "underline" | "plain" | "block";
}): ComponentSpecs["nav"] => ({
  bar: [
    "display: flex",
    "align-items: center",
    "gap: 4px",
    `height: ${p.height}px`,
    "padding: 0 24px",
    `background: ${p.background}`,
    p.blur ? `backdrop-filter: blur(${p.blur}px) saturate(160%); -webkit-backdrop-filter: blur(${p.blur}px) saturate(160%)` : "",
    p.border ? `border-bottom: ${p.border}` : "",
  ]
    .filter(Boolean)
    .join("; "),
  link: [
    p.style === "underline" ? "padding: 6px 2px; margin: 0 10px; border-bottom: 2px solid transparent" : "padding: 6px 12px",
    p.style === "pill" ? "border-radius: var(--radius-full)" : p.style === "block" ? "border-radius: 0" : "border-radius: var(--radius-sm)",
    `font-family: ${font(p.font ?? "sans")}`,
    `font-size: ${p.size}px`,
    `font-weight: ${p.weight}`,
    `letter-spacing: ${p.tracking ?? "0em"}`,
    p.uppercase ? "text-transform: uppercase" : "",
    "color: var(--muted-foreground)",
    "text-decoration: none",
    tr(["color", "background-color", "border-color"], "fast"),
  ]
    .filter(Boolean)
    .join("; "),
  linkHover: p.style === "underline" ? "color: var(--foreground); border-bottom-color: var(--border)" : p.style === "block" ? "color: var(--primary-foreground); background: var(--primary)" : "color: var(--foreground); background: var(--muted)",
  linkActive:
    p.style === "underline"
      ? "color: var(--foreground); border-bottom-color: var(--primary)"
      : p.style === "block"
        ? "color: var(--background); background: var(--foreground)"
        : p.style === "pill"
          ? "color: var(--primary-foreground); background: var(--primary)"
          : "color: var(--foreground); background: var(--accent)",
});

export const table = (p: {
  size: number;
  rowHeight: number;
  head: "muted" | "rule" | "inverse";
  headUppercase?: boolean;
  headFont?: "display" | "sans" | "mono";
  headSize?: number;
  headWeight: number;
  divider?: string;
  numeric?: "mono" | "tabular";
}): ComponentSpecs["table"] => ({
  table: `width: 100%; border-collapse: collapse; font-size: ${p.size}px; font-variant-numeric: tabular-nums${p.head === "rule" ? "; border-top: 2px solid var(--foreground)" : ""}`,
  th: [
    "text-align: left",
    "height: 40px",
    "padding: 0 16px",
    `font-family: ${font(p.headFont ?? "sans")}`,
    `font-size: ${p.headSize ?? p.size - 1}px`,
    `font-weight: ${p.headWeight}`,
    p.headUppercase ? "text-transform: uppercase; letter-spacing: 0.06em" : "",
    p.head === "muted"
      ? "background: var(--muted); color: var(--muted-foreground); border-bottom: 1px solid var(--border)"
      : p.head === "inverse"
        ? "background: var(--foreground); color: var(--background)"
        : "color: var(--foreground); border-bottom: 1px solid var(--foreground)",
  ]
    .filter(Boolean)
    .join("; "),
  td: `height: ${p.rowHeight}px; padding: 0 16px; border-bottom: ${p.divider ?? "1px solid var(--border)"}; color: var(--foreground); ${tr(["background-color"], "fast")}`,
  rowHover: "background: var(--accent); color: var(--accent-foreground)",
});

export const tabs = (p: {
  style: "underline" | "pill" | "boxed" | "brutal";
  size: number;
  weight: number;
  font?: "display" | "sans" | "mono";
  uppercase?: boolean;
  tracking?: string;
  height?: number;
}): ComponentSpecs["tabs"] => {
  const h = p.height ?? 36;
  const typo = [`font-family: ${font(p.font ?? "sans")}`, `font-size: ${p.size}px`, `font-weight: ${p.weight}`, `letter-spacing: ${p.tracking ?? "0em"}`, p.uppercase ? "text-transform: uppercase" : ""].filter(Boolean).join("; ");
  const motion = tr(["color", "background-color", "border-color", "box-shadow"], "base");
  if (p.style === "underline")
    return {
      list: "display: flex; gap: 24px; border-bottom: 1px solid var(--border)",
      tab: `height: ${h}px; padding: 0; margin-bottom: -1px; background: none; border: 0; border-bottom: 2px solid transparent; color: var(--muted-foreground); cursor: pointer; ${typo}; ${motion}`,
      tabHover: "color: var(--foreground)",
      tabActive: "color: var(--foreground); border-bottom-color: var(--primary)",
    };
  if (p.style === "pill")
    return {
      list: "display: inline-flex; gap: 4px; padding: 4px; background: var(--muted); border-radius: var(--radius-full)",
      tab: `height: ${h}px; padding: 0 16px; border: 0; border-radius: var(--radius-full); background: transparent; color: var(--muted-foreground); cursor: pointer; ${typo}; ${motion}`,
      tabHover: "color: var(--foreground)",
      tabActive: "background: var(--card); color: var(--foreground); box-shadow: var(--shadow-sm)",
    };
  if (p.style === "boxed")
    return {
      list: "display: inline-flex; gap: 0; border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden",
      tab: `height: ${h}px; padding: 0 16px; border: 0; border-right: 1px solid var(--border); background: var(--card); color: var(--muted-foreground); cursor: pointer; ${typo}; ${motion}`,
      tabHover: "background: var(--muted); color: var(--foreground)",
      tabActive: "background: var(--primary); color: var(--primary-foreground)",
    };
  return {
    list: "display: flex; gap: 8px",
    tab: `height: ${h}px; padding: 0 16px; border: 2px solid var(--foreground); border-radius: 0; background: var(--card); color: var(--foreground); cursor: pointer; ${typo}; ${motion}`,
    tabHover: "background: var(--accent); color: var(--accent-foreground)",
    tabActive: "background: var(--foreground); color: var(--background); box-shadow: 4px 4px 0 var(--primary)",
  };
};

export const dialog = (p: { overlay: string; blur?: number; radius: R; border: string; padding: number; width?: number; background?: string }): ComponentSpecs["dialog"] => ({
  overlay: overlay(p.overlay, p.blur ?? 0),
  panel: `width: min(${p.width ?? 520}px, 100%); background: ${p.background ?? "var(--card)"}; color: var(--card-foreground); border: ${p.border}; border-radius: ${rad(p.radius)}; box-shadow: var(--shadow-lg); padding: ${p.padding}px`,
});

export const link = (p: { color: string; decoration: string; hover: string; offset?: number; thickness?: string }): ComponentSpecs["link"] => ({
  rest: `color: ${p.color}; text-decoration: underline; text-decoration-color: ${p.decoration}; text-decoration-thickness: ${p.thickness ?? "1px"}; text-underline-offset: ${p.offset ?? 3}px; ${tr(["color", "text-decoration-color"], "fast")}`,
  hover: p.hover,
});
