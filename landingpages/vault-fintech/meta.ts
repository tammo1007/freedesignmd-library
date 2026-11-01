import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "vault-fintech",
  name: "Vault",
  tagline: "Monochrome business-banking site with a dashboard that assembles as you scroll.",
  description:
    "A black-and-white fintech landing page on a blueprint grid with Swiss typography: a masked headline reveal, a live balance odometer on a pointer-tilting card, a sticky scene where the product dashboard assembles from six modules, a pinned horizontal capability rail, count-up stats, a compliance-badge marquee, spring-thumb pricing and accordion FAQ. One file, React only.",
  industry: "Fintech",
  aesthetic: "Monochrome · Swiss",
  lexiconTerms: [
    "blueprint-grid",
    "swiss-grid",
    "monochrome",
    "sticky-pin",
    "horizontal-scroll-section",
    "marquee",
    "segmented-control",
    "ghost-button",
    "scroll-reveal",
  ],
  patternSlugs: ["full-bleed-grid", "asymmetric-split"],
  Component: lazyPage(() => import("./Page")),
  order: 10,
  motion: [
    "Headline mask reveal",
    "Live balance odometer",
    "Spring pointer tilt",
    "Sticky dashboard assembly",
    "Pinned horizontal rail",
    "Count-up stats",
    "Compliance marquee",
    "Spring segmented control",
  ],
};
