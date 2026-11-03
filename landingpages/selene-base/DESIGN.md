# Selene, design brief

Quiet Lunar Monochrome. Cold, silent, spacious: the opposite of a warm Mars palette. The sky is always black (no atmosphere), light is raking and hard, everything moves slowly as if in 1/6 g. A single gold accent exists only as sunlit solar panels and the primary action.

## Palette (CSS variables on `.sel-root`)
| Token | Value | Use |
|---|---|---|
| `--sel-void` | #06070a | page background, sky |
| `--sel-basalt` | #0d0f12 | alternate section background |
| `--sel-reg1` / `reg2` | #171a1e / #252a2f | hairlines, tracks, card borders |
| `--sel-reg3` | #434950 | strong borders, ghost underline |
| `--sel-reg4` | #767c83 | muted labels |
| `--sel-reg5` | #a3a49f | secondary text |
| `--sel-warm` | #b7ae9c | warm regolith, warnings |
| `--sel-ano` | #eceeef | anorthosite white: primary text, lit ground |
| `--sel-blue` / `--sel-green` | #3f7fb8 / #4e8f6a | Earth only (visor reflections, greenhouse glass) |
| `--sel-gold` / `--sel-gold-hi` | #e3b24a / #fbe29a | solar panels, CTA, meters, focus ring |

Terrain colours are per layer in `TCfg` (lit/shade RGB): far cool grey, mid neutral, near warm grey, rim-floor bluish.

## Type
- Sans (display + body): Outfit / Jost / Avenir Next / Helvetica Neue / system. Display weight 200, body 300; hero title 200 at up to 250px with 0.07em tracking.
- Mono (labels, readouts, buttons): JetBrains Mono / SF Mono / ui-monospace; 10-13px, uppercase, 0.1-0.2em tracking.
- Serif italic (crew quotes only): Iowan Old Style / Palatino / Georgia.

## Spacing and shape
Wrap width 1180px with 24px gutters (16px below 640px). Sections have 80-160px vertical padding. Radii are near zero (2-4px) except the porthole (circle), boarding pass (4px) and cabin outline. Hairline 1px borders, no shadows except the porthole, the boarding pass and card hover.

## Motion (slow lunar ease `cubic-bezier(.16,.84,.3,1)`, 1.2-3s)
One rAF loop reads `getBoundingClientRect` of each `[data-sel-p]` wrapper, writes `--p` (0..1), and drives transform/opacity only.
1. Hero: full-bleed `moon-base` image scaled by `--p` (push-in) under a contrast scrim; HUD readouts follow progress.
2. 1/6 g cursor: title letters and CTA are underdamped springs (k=7, c=1.3) kicked away from the pointer with upward bias; pointer movement over the ground kicks regolith particles under 150 px/s^2 gravity; click bursts dust.
3. Statement: each word's opacity is `clamp(.16, (p*1.35 - w)*9 + .16, 1)`.
4. Crater rim: the same image cropped to the crater wall, zooming toward the flag with `--p`; step captions and depth/temperature counters follow progress.
5. Lunar day: p maps to 29.5 days; sun walks an arc, shadows scale/flip with cot(elevation), gold panels and ground brightness follow elevation, Earth redrawn per day with its real phase, timeline fill and thumb scrub.
6. Configurator: modules transition from above the frame with a 2.6s ease, puff dust on landing, tubes fade in between neighbours.
7. Earth window: sphere-sampled procedural Earth rotates while visible (IntersectionObserver), phase from a day slider.
8. Crew cards rise on view and float up 16px on hover over 3s. Manifest stamp scales in on clearance.
Reduced motion: no pinning, physics or autoplay; pinned sections become static stacked compositions, all phase and step text is shown.

## Sections
1. Nav (fixed, condenses to blurred basalt) 2. Hero 3. Statement + 4 stats 4. Crater rim 5. Lunar day 6. Module configurator (presets, aria-pressed toggles, power balance) 7. Earth window 8. Crew (4 visor cards) 9. Seat manifest (departure, stay, seat map, name, live boarding pass) 10. Footer with outlined wordmark.

## Rules
Imports only `react`. No web fonts or network. Hero and crater rim use the photographic render in `/img/space/` (canvas Earth, stars and inline SVG remain for the other sections). Class prefix `sel-`. SSR-safe: window/document only in effects.

## Assets
Images live in `public/img/space/`: `moon-base.webp` (1329w), `moon-base-1200.webp`, `moon-base-640.webp`. Copy the whole `img/space/` folder next to the page so root-relative `/img/space/...` URLs resolve. The hero image is `fetchPriority="high"`; the rim crop is `loading="lazy"`. Text over imagery sits on gradient scrims (AA contrast).

Crew portraits: Placeholder portraits live in `public/img/people/` (`p1.webp` to `p9.webp`, 328×328). Copy the folder next to the page so root-relative `/img/people/...` URLs resolve, or swap in your own photos. They are lazy-loaded and cropped with `object-fit: cover; object-position: center top`.
