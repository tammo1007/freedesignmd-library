import type { Template } from "../types";
import { lazyPage } from "../lazyPage";

export const template: Template = {
  slug: "arcade-os",
  name: "Arcade OS",
  tagline: "An indie game studio that boots like a 1996 desktop — every section is a draggable window.",
  description:
    "A game-studio landing page presented as a retro operating system. The hero is a BIOS boot sequence that drops into a teal desktop with pixel-art icons and drifting clouds; the sections are real windows you can drag, focus, minimise to the taskbar, close and reopen: About, a Games folder with a preview pane, a canvas-drawn trailer player with a scrubber, a Devlog terminal that answers commands, a playable Snake, and a Wishlist form that saves with a progress bar. The taskbar has a Start menu, window buttons, a live clock and CRT scanline / phosphor-glow toggles. Below the desktop: a press ticker, a roadmap with stepped progress bars, a hi-score board your Snake score lands on, blinking pixel crew portraits, tilted system-alert dialogs and a shutdown footer. Teal, cream, magenta and yellow; no images or web fonts.",
  industry: "Gaming",
  aesthetic: "Retro OS Pixel",
  lexiconTerms: [],
  patternSlugs: [],
  Component: lazyPage(() => import("./Page")),
  order: 4,
  motion: [
    "BIOS boot sequence",
    "Draggable focusable windows",
    "Minimise to taskbar",
    "CRT scanlines + glow toggle",
    "Playable canvas Snake",
    "Procedural canvas trailer",
    "Stepped progress bars",
    "Count-up hi-scores",
  ],
};
