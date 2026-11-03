import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "kiln-studio",
  name: "Kiln",
  tagline: "A ceramics studio whose entire portfolio is an infinite canvas you drag, zoom and fly through.",
  description:
    "A creative-studio portfolio built as a pannable, zoomable plane. The first screen is the canvas at overview zoom with the studio name cut into a terracotta clay slab; project cards, notebook slips, process sketches and a studio floor plan are scattered across it at different depths with parallax. Drag with momentum, wheel or trackpad pan, ctrl-wheel or pinch zoom, arrow keys, a live minimap, double-click zoom. Clicking or Tab-focusing a card flies the camera to it and expands a case-study panel; Return to overview flies back. Every card is keyboard reachable and a List view toggle (default under reduced motion) shows the same content as a plain grid. Below: words that fire as you scroll, a pinned wheel-throwing scene where a lump of clay morphs into a vase, a pinned kiln firing curve that draws itself while the peephole heats up, an interactive glaze library and a commission form. Textured procedural clay and glaze illustrations in SVG, terracotta / bone / glaze blue / charcoal, no images or web fonts.",
  industry: "Creative Studio / Ceramics",
  aesthetic: "Warm Raw Clay Craft",
  lexiconTerms: [],
  patternSlugs: [],
  Component: lazyPage(() => import("./Page")),
  order: 6,
  motion: [
    "Infinite pan/zoom canvas",
    "Drag momentum",
    "Depth parallax",
    "Camera fly-to",
    "Minimap",
    "Case-study panel",
    "Scroll-fired manifesto",
    "Clay morph on scroll",
    "Kiln curve scrub",
  ],
};
