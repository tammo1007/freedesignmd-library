import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "orbit-launch",
  name: "Orbit",
  tagline: "A developer-platform launch page built as a solar system — scroll to fly the camera inward through every orbit.",
  description:
    "A cosmic-technical SaaS launch page whose whole layout is an orbital system. The pinned hero is a rotating planetary system in which each of five orbits holds a product feature; scrolling flies the camera inward over a streaming canvas star field, outer rings slipping off-screen until the core fills the view. Below it: a sticky concentric-ring diagram that tracks the feature you are reading, a typing deploy terminal with counting stats and drawing sparklines, two counter-rotating rings of integrations that spin faster as you scroll, pricing as four concentric rings whose arcs fill to each plan's quota, and a pinned changelog spiral that draws inward through time. Deep navy, electric cyan and warm white; system fonts, no images.",
  industry: "SaaS / Developer platform",
  aesthetic: "Cosmic Technical Dark",
  lexiconTerms: [],
  patternSlugs: [],
  Component: lazyPage(() => import("./Page")),
  order: 22,
  motion: [
    "Orbital camera zoom",
    "Streaming star field",
    "Pinned planetary hero",
    "Sticky ring scrollspy",
    "Typing terminal",
    "Counter-rotating integration rings",
    "Concentric pricing rings",
    "Scroll-drawn changelog spiral",
  ],
};
