import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "selene-base",
  name: "Selene",
  tagline: "A lunar base for research and quiet, Earth rises as you scroll, footprints print themselves.",
  description:
    "A cold, silent, spacious lunar-hospitality landing page. A pinned hero paints a procedural cratered horizon in three parallax layers with true raking-light cast shadows, an Earth that rises with scroll, and a trail of footprints that prints itself toward a gold-panelled outpost. The cursor lives in 1/6 g: title letters drift away on slow underdamped springs and the pointer kicks up regolith that arcs back down. Then a word-by-word sunrise statement, a pinned descent over a crater rim, a 29.5-day lunar cycle scrubbed by scroll (sun arc, swinging shadows, gold panels, phase-lit Earth), a module configurator where habitats drop onto the surface, a rotating Earth porthole, crew cards that float and settle, and a seat-manifest booking pass. Regolith greys, basalt black, anorthosite white, one gold accent; no images or web fonts.",
  industry: "Space & Research",
  aesthetic: "Quiet Lunar Monochrome",
  lexiconTerms: [],
  patternSlugs: [],
  Component: lazyPage(() => import("./Page")),
  order: 21,
  motion: [
    "Raking-light terrain",
    "Rising Earth parallax",
    "Scroll-printed footprints",
    "1/6 g cursor physics",
    "Word-by-word sunrise",
    "Pinned crater descent",
    "29.5-day sun & shadow scrub",
    "Modules drop and settle",
    "Rotating phase-lit Earth",
  ],
};
