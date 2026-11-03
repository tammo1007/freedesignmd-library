import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "prism-glass",
  name: "Prism",
  tagline: "Apple-style Liquid Glass landing page for an AI product-photography studio.",
  description:
    "A bright, colorful AI-product page on a drifting mesh backdrop with real Liquid Glass: an in-file helper renders true SVG-displacement refraction (with chromatic edges) in Chromium and a frosted fallback elsewhere — used only for the floating control layer, as Apple's HIG prescribes. A nav that condenses into a glass capsule, a prompt bar that relights the hero scene, a draggable refraction lens with spring physics, sticky studio scenes with parallax depth, a column-parallax gallery, a momentum carousel and glass pricing toggles. One file, React only.",
  industry: "AI · Creative tools",
  aesthetic: "Liquid Glass · Mesh",
  lexiconTerms: [
    "glassmorphism",
    "mesh-gradient",
    "parallax",
    "sticky-pin",
    "segmented-control",
    "marquee",
    "scroll-reveal",
    "card-stack",
  ],
  patternSlugs: ["centered-column", "asymmetric-split"],
  Component: lazyPage(() => import("./Page")),
  order: 7,
  motion: [
    "SVG refraction Liquid Glass",
    "Nav condenses to glass capsule",
    "Draggable spring lens",
    "Pointer + scroll parallax hero",
    "Sticky scenes with depth layers",
    "Column-parallax gallery",
    "Momentum carousel",
    "Spring glass toggle",
  ],
};
