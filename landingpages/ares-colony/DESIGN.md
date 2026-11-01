# Ares — DESIGN.md

A home on Mars. Retro-future rust: basalt blacks, oxide reds, ochre, butterscotch dust and copper, with a single cold blue reserved for the Martian sunset and for water. Mono readouts, uppercase grotesque headlines, one italic serif accent. All imagery is procedural (canvas and inline SVG).

All CSS lives in `Page.tsx` under the `.ares` prefix, with box-sizing, margins, fonts and list styles set explicitly on the root, so it renders the same under any reset.

## 1. Palette

| Role | Token | Hex |
|---|---|---|
| Deep space, page base | `--ares-void` | `#0A0605` |
| Dark sections | `--ares-basalt` / `-2` | `#1A100C` / `#26160F` |
| Ticker, tier highlight | `--ares-rust` | `#B4502A` |
| Ink accent on light, hot tier | `--ares-oxide` | `#8C2F1B` |
| Primary accent: CTAs, italics, numerals | `--ares-ochre` | `#D99A38` |
| Body text on dark | `--ares-butter` | `#F2D3A0` |
| Secondary text on dark | `--ares-dust` | `#E9B98C` |
| Eyebrows, hairline accents | `--ares-copper` | `#C97B48` |
| Warm sky band | `--ares-pink` | `#F3C8B0` |
| Light sections, headlines on dark | `--ares-bone` | `#F6E9D5` |
| Ink on light | `--ares-ink` | `#2A160E` |
| Sunset sky, ice, water | `--ares-blue` | `#7BA3C6` |
| Hairlines on dark | `--ares-line` | `rgba(242,211,160,.22)` |

Hero canvas colours: day sky `#A85F3C → #F4CFAE`, dusk sky `#1B2140 → #8FB4D4`, dune layers `#D39A72 #B9663D #94432A #66291B #33140E`, night tint `#120A14`.

Contrast: butter on basalt is above 12:1, copper on basalt about 5.5:1, oxide on bone about 7:1.

## 2. Typography

- Display (`--ares-display`): `"Space Grotesk", "Futura", "Avenir Next", "Century Gothic", "Trebuchet MS", ui-sans-serif, sans-serif`. Weight 700, uppercase, tracking -0.035 to -0.045em.
- Serif accent (`--ares-serif`): `"Fraunces", "Iowan Old Style", Palatino, Georgia, serif`, italic 400. Used for emphasis words, postcards and room notes.
- Mono (`--ares-mono`): `"JetBrains Mono", "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace`. Eyebrows (12px, 0.2em, uppercase), HUD, buttons, FAQ log, counters.

| Style | Spec |
|---|---|
| H1 | `clamp(54px, 9.4vw, 148px)` / 0.92, 700, uppercase |
| H2 | `clamp(32px, 4.6vw, 68px)` / 1.02 (pinned sections use 3.8-3.9vw) |
| Manifesto | `clamp(30px, 5.2vw, 76px)` / 1.08, 600 |
| Body | 17px / 1.6 (16px under 700px) |
| Buttons | mono 12.5px, 0.14em, uppercase, pill, 48px tall |

## 3. Spacing and layout

Wrap max 1240px with 32px gutters (16px under 700px). Sections 130-150px vertical padding (90px mobile). Pinned sections are 320-340vh tall with a `position: sticky` 100svh stage and a two-column grid (copy / drawing) that stacks under 980px with the drawing first. Radii: pills 999px, cards 3-18px. Hairlines 1px `--ares-line`.

## 4. Motion

- **Hero descent**: 330vh container, sticky stage, smoothed progress `--hp`. The `mars-orbit` image zooms toward the limb and fades out, an orange entry-glow layer peaks mid-scroll, then `mars-surface` fades in and settles from a 1.45x zoom. Gradient scrims keep the headline, lede and HUD at AA contrast.
- **HUD**: altitude, velocity and phase update by progress; sol clock, LMST and temperature use real Mars time at Jezero (77.45° E), updated every second.
- **Scroll variable**: one rAF-throttled scroll loop writes `--p` (0-1) on `[data-ares-p]` (pin = progress through the sticky range, pass = progress across the viewport). CSS reads it with `clamp()` calc for stroke-dashoffset drawing, opacities, and rotations. Counters use `data-ares-count`.
- **Reveals**: IntersectionObserver adds `.ares-in` (opacity + 32px rise, staggered by `--i`).
- **Others**: marquee ticker, postcard parallax and straighten on hover, boarding-pass lift, pay once / lease toggle, FAQ typewriter at about 190 chars/s.
- **Reduced motion**: no pin, no autoplay; hero is a static touchdown composition; every drawing is shown complete.

## 5. Sections

1. Nav: fixed, transparent, turns into blurred basalt after scroll.
2. Hero: descent image stack, two HUD panels, headline A (orbit) and B (touchdown + CTAs), progress rail.
3. Ticker: rust band with facts.
4. Manifesto: word-by-word scrubbed statement and four stats.
5. Habitat: bone, pinned floor plan of seven rooms drawn sequentially, linked room list.
6. Dome: pinned cross-section (regolith, shell, deck, greenhouse, ice store, airlock) with numbered legend.
7. Windows: pinned orbital diagram, transit counters, four departure windows.
8. Residents: three drifting postcards on a dust-pink gradient.
9. Passage: three boarding-pass tiers with pay-once / lease toggle.
10. Mission log: FAQ console with typing answers.
11. Hold: countdown to Window 01 and seat-hold form.
12. Footer with fictional-company note.

## 6. Assets
Images live in `public/img/space/`: `mars-orbit` and `mars-surface`, each as `.webp` (about 1400w), `-1200.webp` and `-640.webp`. Copy the whole `img/space/` folder next to the page so root-relative `/img/space/...` URLs resolve. The orbit image is the LCP (`fetchPriority="high"`); the surface image and the postcard stamp crops (rover, dunes, sun and Phobos via `object-position`) are lazy-loaded.

Resident postcard portraits: Placeholder portraits live in `public/img/people/` (`p1.webp` to `p9.webp`, 328×328). Copy the folder next to the page so root-relative `/img/people/...` URLs resolve, or swap in your own photos. They are lazy-loaded and cropped with `object-fit: cover; object-position: center top`.
