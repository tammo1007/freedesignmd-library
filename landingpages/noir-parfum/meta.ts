import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "noir-parfum",
  name: "Noir",
  tagline: "A perfume house in black, bone and a single amber — smoke you can stir, a flacon the light walks across.",
  description:
    "A cinematic luxury-fragrance landing page. The hero is a procedural smoke / ink fluid on canvas (about a thousand particles on a drifting noise field) that the cursor drags, swirls and feeds with amber ink, under a giant italic serif title that rises letter by letter. Then a pinned manifesto that lights up word by word, a pinned SVG flacon with two bands of light sweeping across the glass as you scroll, a pinned horizontal journey through top, heart and base notes each with its own colour atmosphere, a pinned 'discover your scent' quiz with an animated result (name, bars, a flacon that fills with its own colour), hover-lift collection rows and a giant outlined wordmark footer. Black, bone and one amber; system serif, no images or web fonts.",
  industry: "Luxury Fragrance",
  aesthetic: "Cinematic Noir Luxury",
  lexiconTerms: [],
  patternSlugs: [],
  Component: lazyPage(() => import("./Page")),
  order: 3,
  motion: [
    "Cursor-stirred smoke canvas",
    "Letter-rise title",
    "Word-by-word manifesto",
    "Scroll light sweep on SVG bottle",
    "Pinned horizontal notes",
    "Crossfading colour atmospheres",
    "Pinned quiz with animated result",
    "Hover-lift collection rows",
  ],
};
