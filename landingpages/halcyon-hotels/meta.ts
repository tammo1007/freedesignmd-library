import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "halcyon-hotels",
  name: "Halcyon",
  tagline: "Boutique hotels on the Amalfi coast and in Kyoto — golden hour to dusk as you scroll.",
  description:
    "A warm, editorial luxury-hospitality homepage. A pinned hero paints a layered procedural Amalfi landscape (sky, sun, sea, a cliff village of 120 houses, mist and bougainvillea) that parallaxes by depth and shifts from golden hour to dusk as you scroll, with a live clock and village lights coming on. A booking bar floats at the bottom of the first screen and docks under the condensing nav; then clip-path image reveals, a pinned horizontal gallery of four houses, hover-zoom room cards, an interactive rituals list, a crossfading guest book, illustrated maps whose coastlines draw in and pins drop, and a newsletter footer. Large serif display, sand / ink / terracotta, no images or web fonts.",
  industry: "Hospitality",
  aesthetic: "Warm Luxury Editorial",
  lexiconTerms: [],
  patternSlugs: [],
  Component: lazyPage(() => import("./Page")),
  order: 10,
  motion: [
    "Time-of-day hero",
    "Layered parallax",
    "Docking booking bar",
    "Clip-path reveals",
    "Pinned horizontal gallery",
    "Testimonial crossfade",
    "Map pins draw in",
  ],
};
