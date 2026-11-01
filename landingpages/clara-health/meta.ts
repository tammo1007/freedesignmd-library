import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "clara-health",
  name: "Clara",
  tagline: "Primary care and a virtual clinic that has time for you.",
  description:
    "A calm, accessibility-first healthcare homepage in soft clinical whites with a sage/teal accent and rounded geometry. A breathing gradient orb sits behind a working appointment widget (visit type, day chips, a highlight pill that springs between time slots, a confirm button that morphs through a spinner into a drawn check). A sticky care-journey story morphs one illustration through four steps; a phone mock plays a clinician chat; outcome stats count up; a fictional insurer marquee, clinician cards with gentle lift, a monthly/annual pricing toggle with rolling prices and FAQ accordions round it out. AA+ contrast, 44px+ targets, full keyboard support and reduced-motion paths.",
  industry: "Healthcare",
  aesthetic: "Calm Clinical · Rounded",
  lexiconTerms: [],
  patternSlugs: [],
  Component: lazyPage(() => import("./Page")),
  order: 11,
  motion: [
    "Breathing gradient orb",
    "Spring time-slot picker",
    "Sticky morphing storytelling",
    "Count-up stats",
    "Logo marquee",
    "Pricing roll toggle",
    "Accordion FAQ",
  ],
};
