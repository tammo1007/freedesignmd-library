import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "terra-regen",
  name: "Terra",
  tagline: "Regenerative farming where the page itself grows — sky to root zone as you scroll.",
  description:
    "A climate-farming landing page that grows as you read it. The hero is a pinned vertical cross-section from sky to root zone: scrolling raises procedural SVG wheat, cover crops and a tree, branches their roots through five soil horizons, drops carbon particles from the sky and banks them as green flecks in the earth while a per-hectare counter climbs. A season slider that is always on screen re-tints the site from spring to winter, moving the sun, thinning foliage and laying snow. Then topographic contour lines that draw across the field, a live carbon ledger with growing bars and a drawn trend line, a hover-reveal field map where crop rows are drawn into each plot, a mycelium network with travelling signals, grower quotes that grow in, and a wheat field rising under the sign-up form. Soil browns, moss, wheat, cream and a vivid chlorophyll green; serif editorial type, no images or web fonts.",
  industry: "Climate & AgTech",
  aesthetic: "Organic Earth Editorial",
  lexiconTerms: [],
  patternSlugs: [],
  Component: lazyPage(() => import("./Page")),
  order: 25,
  motion: [
    "Scroll-grown cross-section",
    "Procedural roots draw down",
    "Falling carbon particles",
    "Season palette slider",
    "Contour lines draw in",
    "Hover-reveal field map",
    "Growing bars and trend line",
    "Mycelium signals",
  ],
};
