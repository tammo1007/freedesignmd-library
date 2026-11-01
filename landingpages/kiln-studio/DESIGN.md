# Kiln — DESIGN.md

A ceramics and design studio in Lisbon. The portfolio is an infinite canvas: a plane of project cards, notebook slips, process sketches and a floor plan that you drag, zoom and fly across. Warm raw-clay craft: terracotta, bone, glaze blue and charcoal, with paper grain and procedural SVG pottery (no image files, no web fonts).

All CSS lives in `Page.tsx` under the `.kn` prefix; the root sets font, line-height and box-sizing explicitly and resets the elements it uses, so it renders the same under any reset.

## 1. Palette

| Role | Token | Hex |
|---|---|---|
| Page / canvas paper | `--kn-bone` | `#EFE6D6` (canvas `#E9DFCB` + grain) |
| Alt band (glazes) | `--kn-bone2` | `#E4D7C0` |
| Cards, panel, form | `--kn-paper` | `#F6EFE0` |
| Accent, raw clay | `--kn-terra` | `#B5573A` (deep `--kn-terra-d` `#8F3F28`) |
| Glaze blue (focus, viewport, links) | `--kn-blue` | `#3F6F86` (light `#8FB4BF`) |
| Text, dark bands, buttons | `--kn-char` | `#26211F` |
| Secondary text | `--kn-ash` | `#6E645B` |
| Ochre (notes, tape, kiln line) | `--kn-ochre` | `#C98F4F` |
| Accent on dark | — | `#E6A47F` |
| Sticky-note paper | — | `#F3E7B8` |

Glazes drawn in SVG: Tidewater `#6B9AAB/#2F5668`, Bone `#F1E8D6/#CDBF9F`, Iron `#55433B/#1F1A18`, Ember `#CF6A45/#8A3320`, Ochre Ash `#DDAB6A/#A8713A`, Raw clay `#D08A66/#8F3F28`. Kiln heat ramp for the peephole: `#2A1D19` → `#6E2C1C` → `#C8461E` → `#FF9646` → `#FFE6BE`. Text on bone is AA or better; focus rings are 3 to 5 px glaze blue.

## 2. Typography

- Display serif (`--kn-serif`): `"Fraunces","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif`. Weight 500 for headings, 800 for the studio name, italic for emphasis.
- Sans (`--kn-sans`): `"Instrument Sans","Avenir Next","Segoe UI",system-ui,sans-serif`.
- Mono (`--kn-mono`): `ui-monospace,"SF Mono",Menlo,Consolas,monospace` for kickers, specs and readouts (11 to 13 px, +0.1 to 0.16em tracking, uppercase for labels).
- Hand (`--kn-hand`): `"Bradley Hand","Segoe Print","Chalkboard SE","Comic Sans MS",cursive` for notebook slips only.

| Style | Spec |
|---|---|
| Studio name | SVG text, 800, 470 units, letter-spacing −14, debossed with an inner-shadow filter on a clay slab |
| H2 | serif 500, `clamp(36px, 5vw, 72px)` / 1.03, −0.025em |
| Manifesto | serif 500, `clamp(28px, 4.6vw, 68px)` / 1.14 |
| Card title | serif 500, 24px / 1.1 (sketch and map 20px) |
| Panel title | serif 500, `clamp(30px, 3.4vw, 44px)` |
| Body | sans 18px / 1.65 |

## 3. Layout and spacing

- World: 3000 x 1900 units. Overview scale `min(vw/2700, vh/1700)` (0.3 under 720 px). Zoom range 0.12 to 2.2. Cards: project 300 x 380, note 220 x 175, sketch 280 x 300, map 380 x 360.
- Depth: each object has a factor `f`; screen position is `center + scale * f * (world − camera)`. Backdrop blobs/rings 0.55 to 0.66, cards 0.94 to 1.14, foreground clay crumbs 1.4 to 1.55.
- Stage is 100svh (min 560). HUD: brand and toggles top, zoom/return pill bottom centre, minimap 176 x 111 bottom left. Panel is a 480 px (46% max) right drawer; under 720 px it is a bottom sheet at 56% height and the camera offsets so the card stays visible above it.
- Below the stage: `.kn-wrap` 1200 px, 24 px gutters, sections padded `clamp(72px, 10vw, 140px)`. Breakpoints at 900 and 720 px.

## 4. Components

- Card (button): paper surface, 6 px radius, layered shadow, hover scales the illustration 1.05 (not the card, the camera owns its transform), 5 px blue focus ring, terracotta ring when open.
- Procedural vessel: profile silhouette via Catmull-Rom, clipped clay body, glaze polygon with a seeded drip edge, throwing rings, speckles, cylinder shading, rim ellipse.
- Buttons: 44 px pills, 1.5 px charcoal outline, solid variant charcoal then deep terracotta on hover; Return to overview turns terracotta once the camera is away from overview.
- Form: bone card, charcoal border, 10 px terracotta offset shadow.

## 5. Motion

1. Intro: the camera starts at 2.1x and eases back to overview (rate 1.7).
2. Camera: target/current spring-free exponential easing (flights rate 4.2, wheel/keys 9 to 14, zoom in log space); drag sets the camera directly; release momentum decays at e^(−3.4t).
3. Parallax by depth factor, all transforms (translate3d, rotate, scale) written from one rAF loop that stops when idle; off-screen items are hidden.
4. Wheel pans until the camera hits its bounds, then the page scrolls; ctrl/meta wheel and two-finger pinch zoom around the pointer.
5. Fly-to on keyboard focus (focus-visible only) and on click; Enter/click opens the panel with a clip-path grow on its illustration.
6. Manifesto: each word's opacity is a CSS calc of `--p`, so the sentence fires word by word.
7. Throwing: four keyframe profiles interpolated on scroll; fingers track the wall; wheel-head ticks slide.
8. Firing: curve `stroke-dashoffset` scrub, marker via `getPointAtLength`, live temperature/stage readout and a glowing peephole.
9. Reveal-on-scroll (IntersectionObserver), CSS marquee, glaze swap fade.

Reduced motion: List view is the default, camera moves snap, momentum off, sticky scenes become static sections at their final state, marquee and reveals stop.

## 6. Accessibility

Every project, note, sketch, the map and the about card is a real button in DOM order; Tab focus flies the camera (keyboard focus only), Enter opens the panel, Escape closes it then returns to overview. The canvas has arrow keys to pan, plus/minus to zoom, 0 for overview. Panel moves focus to its heading and returns it to the card on close. List view toggle is `aria-pressed`. Glaze picker is a radio group with arrow keys.

## 7. Sections

1. Canvas hero with clay-slab title, HUD, minimap, panel (or List view)
2. Marquee strip
3. Manifesto (scroll-fired words)
4. On the wheel (pinned clay morph)
5. In the kiln (pinned firing curve)
6. Glaze library (interactive)
7. Commissions (lead times and form)
8. Footer with textured wordmark
