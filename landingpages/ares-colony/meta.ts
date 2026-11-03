import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "ares-colony",
  name: "Ares",
  tagline: "A home on Mars, scroll down from low orbit to the surface of Jezero Crater.",
  description:
    "A retro-future habitat and relocation landing page. The first screen is a 330vh pinned canvas: scrolling is a descent from Mars orbit through entry heat to touchdown, where layered dunes, Olympus Mons, Phobos and Deimos, drifting dust and a blue Martian sunset resolve. A live sol clock runs on real Mars time with a temperature readout, and the pointer steers a dust devil that swirls the dust. Below: words that light up as you read, a pinned floor plan that draws itself room by room, a dome cross-section that builds layer by layer, an orbital launch-window diagram where Earth and Mars move and a supply ship flies its transfer arc, drifting postcards from residents, boarding-pass pricing with a pay-once or lease toggle, and an FAQ styled as a typing mission-control log. Basalt, oxide red, ochre, butterscotch dust and copper; no images or web fonts.",
  industry: "Space & Habitat",
  aesthetic: "Retro-Future Rust",
  lexiconTerms: [],
  patternSlugs: [],
  Component: lazyPage(() => import("./Page")),
  order: 5,
  motion: [
    "Orbit-to-surface descent hero",
    "Dust-devil pointer",
    "Live Mars sol clock",
    "Scroll-scrubbed word reveal",
    "Floor plan draws itself",
    "Dome cross-section build",
    "Orbital transfer scrub",
    "Typing mission log",
  ],
};
