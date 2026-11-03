import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "atelier-nord",
  name: "Atelier Nord",
  tagline: "Scandinavian fashion e-commerce, monochrome, condensed, art-directed.",
  description:
    "A monochrome high-fashion storefront for a Stockholm label. A giant condensed ATELIER NORD masthead is fitted to the viewport and scrubbed apart letter by letter as you scroll, blending over the cover image. A zoom-parallax lookbook starts inside one photograph and pulls back until seven editorial frames settle into an asymmetric grid. Product cards have colour swatches that cross-fade the fabric, a quick-add bar that morphs into a size picker and then an Added state, a spring-physics cart drawer, a cursor-following View label and a press-quote marquee. All garments are procedural SVG with fold shading, herringbone, cable-knit and check textures under a film-grain layer.",
  industry: "Fashion / E-commerce",
  aesthetic: "Monochrome High-Fashion",
  lexiconTerms: [],
  patternSlugs: [],
  Component: lazyPage(() => import("./Page")),
  order: 12,
  motion: [
    "Letter scrub masthead",
    "Zoom-parallax lookbook",
    "Quick-add morph",
    "Swatch cross-fade",
    "Spring cart drawer",
    "Cursor-follow label",
    "Quote marquee",
  ],
};
