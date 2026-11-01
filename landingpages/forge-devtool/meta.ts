import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "forge-devtool",
  name: "Forge",
  tagline: "Dark, hairline dev-tool site where the CI pipeline runs as you scroll.",
  description:
    "A Geist-style developer-tool landing page: near-black canvas, 1px hairlines, one ember accent. A terminal types out a real push-to-merge run, a PR timeline draws itself with scroll, an annotated diff gets auto-review comments that pop in (and a suggestion you can commit), a sticky Gantt scene scrubs the 90-second merge against legacy CI, an integrations grid lights its hairlines with a cursor spotlight, and pricing has a live per-seat calculator. One file, React only.",
  industry: "Developer Tools",
  aesthetic: "Hairline · Dark",
  lexiconTerms: [
    "hairline-border",
    "dark-mode",
    "mono-ui",
    "spotlight-card",
    "sticky-pin",
    "bento-grid",
    "segmented-control",
    "scroll-reveal",
  ],
  patternSlugs: ["bento-quiet", "sticky-index-rail"],
  Component: lazyPage(() => import("./Page")),
  order: 20,
  motion: [
    "Terminal typing hero",
    "Scroll-drawn PR timeline",
    "Auto-review comments pop in",
    "Scroll-scrubbed pipeline Gantt",
    "Cursor spotlight on hairlines",
    "Spring billing toggle",
    "Live seat calculator",
  ],
};
