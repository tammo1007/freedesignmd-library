# Atelier Nord — DESIGN.md

A Scandinavian fashion e-commerce storefront: monochrome high fashion with giant condensed uppercase type, an art-directed asymmetric 12-column grid, and pre-rendered fabric photography (draped herringbone, cable knit, twill, poplin, check and leather, plus a CSS film-grain layer). It uses no web fonts.

All CSS lives in `Page.tsx` under the `.an` prefix. Every element is reset explicitly, so the page is independent of host resets.

## 1. Palette

| Role | Token | Hex |
|---|---|---|
| Page paper | `--an-paper` | `#F2F1EE` |
| White bands (shop, materials, drawer) | `--an-white` | `#FFFFFF` |
| Studio backdrop behind products | `--an-studio` | `#E4E2DD` |
| Ink (type, buttons, footer, marquee) | `--an-ink` | `#0E0E0E` |
| Body text | `--an-graphite` | `#2A2A2A` |
| Meta / captions | `--an-grey` | `#66645F` |
| Hairlines | `--an-line` | `rgba(14,14,14,0.14)` |
| Footer secondary text | — | `#A7A5A0` / `#BDBBB6` |

Product colourways (the only "colour", all desaturated):

| Colourway | Hex |
|---|---|
| Ecru | `#E6E0D3` |
| Stone | `#A8A39A` |
| Charcoal | `#3A3A3A` |
| Black | `#141414` |
| Fog | `#C9C9C6` |
| Moss | `#55574C` |

Contrast: ink on paper is about 18:1, `--an-grey` on paper about 5.4:1, `#A7A5A0` on ink about 7.6:1.

## 2. Typography

- Condensed display (`--an-cond`): `"HelveticaNeue-CondensedBold", "Helvetica Neue Condensed Bold", "Helvetica Neue Condensed", "Arial Narrow", "Roboto Condensed", "Nimbus Sans Narrow", "TeX Gyre Heros Cn", "Liberation Sans Narrow", ui-sans-serif, sans-serif`. Weight 700, `font-stretch: condensed`, uppercase.
- Text (`--an-sans`): `"Helvetica Neue", Helvetica, ui-sans-serif, -apple-system, "Inter", "Segoe UI", Roboto, Arial, sans-serif`.

| Style | Spec |
|---|---|
| Masthead word | condensed 700 / 0.78, −0.02em. **Fitted by JS** to the content width (`min(width-fit, (vh − 330) / 1.56)` on desktop; CSS fallback 22.6vw) |
| H2 XL (New in, Journal, feature) | `clamp(64px, 9vw, 150px)` / 0.82, −0.025em |
| H2 | `clamp(40px, 5vw, 76px)` / 0.88, −0.015em |
| Marquee quote | `clamp(40px, 5vw, 72px)` / 1 |
| Footer wordmark | 16.2vw / 0.78 |
| Statement | sans 400, `clamp(28px, 3.4vw, 52px)` / 1.12, −0.03em, 12% text-indent |
| Product name | sans 500, 14px, 0.04em, uppercase |
| Labels / nav / buttons | sans 500, 12–13px, 0.08–0.1em, uppercase |
| Body | sans 400, 15–16px / 1.55–1.6 |

## 3. Grid, spacing, shape

- Full-bleed with a gutter of `--an-gut` (24px; 16px at ≤760px).
- **New in** uses an art-directed 12-column grid. Each card has an explicit column span and vertical offset (`.an-p-a` … `.an-p-f`): coat 1/6, knit 7/10 +160px, trouser 10/13 +40px, shirt 2/5, scarf 6/9 +120px, bag 9/13 −60px.
- The **Lookbook** grid is 12 columns × 6 rows, with 7 tiles of different spans around a 4×4 centre tile.
- **Journal** is 5fr / 3fr / 4fr with staggered offsets.
- **Shape is square:** radius 0 everywhere. The exceptions are the bag count, swatches and cursor label (circles) and the inline statement image (capsule).
- No shadows except the cart drawer (`-30px 0 60px -30px rgba(0,0,0,.35)`).
- Film grain: an SVG `feTurbulence` data-URI at 20% multiply over imagery (`.an-grain`).

## 4. Motion tokens

```
--fd-ease-out    cubic-bezier(0.22, 1, 0.36, 1)
--fd-ease-in-out cubic-bezier(0.65, 0, 0.35, 1)
--fd-spring      cubic-bezier(0.34, 1.56, 0.64, 1)
--fd-dur-1 120ms · --fd-dur-2 240ms · --fd-dur-3 420ms · --fd-dur-4 700ms
Physics spring (drawer, cursor label): stiffness 380, damping 30, mass 1 — integrated in rAF.
```

### Choreography

1. **Load.** Masthead letters rise out of their masks (1.1s, 45ms stagger per letter across both words).
2. **Masthead scrub.** `--p` is the scroll progress through the masthead. Every letter has its own `--dy` (ATELIER moves up and NORD moves down, 40–150px) and `--rot` (−4°…+4°), so the word shears apart as you leave. The word uses `mix-blend-mode: difference` (white), so it reads as ink on paper and inverts where it crosses the cover photo. The cover image drifts down 120px and its scene scales from 1.12 to 1.24.
3. **Statement.** Paragraph reveal; an inline capsule image of the coat lapel sits inside the sentence.
4. **Zoom-parallax lookbook.** The section is 320vh with a sticky 100vh stage.
   - At p=0 the grid is scaled so the centre tile fills the viewport, and translated to centre it.
   - Over the first 78% of scroll (easeOutCubic `e`) it pulls back to scale 1 and settles into the asymmetric grid.
   - Surrounding tiles arrive from different depths (`--k`: −160…+200px × (1−e)).
   - A "Stillhet" overlay in difference blend fades out, and the heading and captions fade in at the end.
5. **Product cards.**
   - Swatch → fabric fill cross-fades (700ms in-out); the colour name fades in.
   - Hover zooms the image 1.04 (1.2s) and reveals Quick add (fade plus 8px rise).
   - **Quick-add morph:** a white bar is clipped to 132px; on click `clip-path` opens to full width (420ms) and the sizes slide in (30ms stagger) while the + rotates to ×.
   - Choosing a size collapses the bar back to 132px in ink with a check ("Added"), bounces the bag count (600ms spring), then opens the drawer 650ms later.
6. **Cart drawer.** Its translateX goes from 104% to 0 through the physics spring (with a slight overshoot). The scrim fades (420ms). Focus moves to Close, Tab is trapped, Escape closes, and focus returns to the opener. The free-shipping bar scales to the subtotal against €400.
7. **Cursor "View" label.** An 84px ink circle follows the mouse through the spring over `[data-an-view]` imagery (scale 0→1 with the spring). It hides over buttons so it never covers controls, and is disabled on touch.
8. **Press marquee.** Two sets translate −50% over 60s; pauses on hover.
9. **Feature hotspots.** Pulsing white dots (2.4s ping); the tooltip rises in on hover or focus.
10. **Materials.** Fabric swatches zoom 1.5 on hover (1.2s), like a loupe.

## 5. Sections

1. Announcement bar (ink).
2. **Sticky condensing nav.** 72px → 52px, translucent paper with a hairline; the logo shrinks from 30px to 22px and its tracking widens. Bag button with an animated count.
3. **Masthead.** Collection meta, cover image (Look 07), the fitted giant word, an intro line and CTA.
4. **Statement.** (01) "Stillhet" paragraph with an inline image.
5. **Lookbook.** Zoom-parallax pinned grid of 7 editorial scenes (studio, fjord, birch forest, knit stack, lapel detail, window still, tote).
6. **New in.** Six products in the asymmetric grid with swatches and quick add.
7. **Press marquee.** Four editorial quotes.
8. **Feature.** Sticky Sund Overcoat image with 3 hotspots, a spec table and an add-to-bag button.
9. **Materials.** Four mills with CSS-pattern swatches.
10. **Journal.** Three stories in a staggered grid.
11. **Footer.** Newsletter (underline input), stores, help, atelier, follow, a giant wordmark, and legal.
12. **Cart drawer** (dialog).

## 6. Components and states

- **Buttons.** 52px, square, uppercase 13px. Ink fill; hover `#333`; press 0.97; disabled `#9A9893`.
- **Text link.** 1px underline that wipes out to the right on hover.
- **Swatch.** 36px hit area with a 16px dot and a ring that springs in when `aria-pressed="true"`.
- **Quick add.** States: hidden (desktop, no hover) → bar → `.is-pick` (sizes, sold-out XS on the coat struck through) → `.is-added` (ink + check). One-size items (scarf, bag) add directly.
- **Cart line.** Thumbnail, name, colour · size, quantity stepper (removing the last unit deletes the line), price.
- **Newsletter.** Underline field; after success the note reads back the address.

## 7. Responsive

- **≤1080px:** burger replaces the text nav; the shop header becomes 2 columns; materials go 2-up; the footer stacks.
- **≤760px:**
  - the cover image moves into the flow (72% width, right-aligned) with the word overlapping it from below
  - the lookbook stops pinning and becomes a 2-column grid with the fjord tile full-width first
  - the shop becomes 2 columns with coat and bag full-width
  - quick add shows as a 44px + button and opens into a 3×2 size grid with 44px cells
  - the feature image is no longer sticky
  - the journal goes to 1 column.
- `(hover: none)`: no cursor label; quick add is always visible.

## 8. Accessibility and reduced motion

- Skip link and landmarks. The H1 is `aria-label="Atelier Nord"`, with its split letters `aria-hidden`.
- Product links carry name, colour and price. Swatches have `aria-label` and `aria-pressed`; size buttons are labelled (including "sold out").
- An `aria-live` region announces bag additions.
- The drawer is `role="dialog"` with `aria-modal`, focus trap, Escape to close and focus return.
- Focus ring: 2px ink at 70%.
- `prefers-reduced-motion`:
  - no letter scrub, cover drift or lookbook pin/zoom
  - the marquee becomes a static list
  - the drawer and cursor snap instead of springing
  - transitions are capped at 120ms.
- `prefers-contrast: more` removes the grain and makes the nav opaque.
- Fixes the html+body overflow host quirk that breaks `position: sticky`, and restores it on unmount.

## 9. Do / Don't

- **Do** let type be the image: one giant condensed word per major section, with everything else small and tracked.
- **Do** keep it monochrome. Colour exists only in the product colourways, and only in greys and naturals.
- **Do** break the grid on purpose (offsets, spans) while keeping every edge on a column line.
- **Don't** round corners or add card shadows.
- **Don't** let the cursor label cover a control, or show it on touch devices.
- **Don't** animate layout; scrub and zoom are transform-only and driven by one rAF scroll loop.

## Assets

Product and editorial images are pre-rendered fabric studies in `public/img/lux/`: `dr-coat`, `dr-knit`, `dr-trouser`, `dr-shirt`, `dr-scarf`, `dr-bag` (neutral grey, recoloured per swatch with `mix-blend-mode: overlay` over the swatch colour), plus `dunes-mono` and `still-grey` for editorial tiles (each with a `-800` variant). Swap in real packshots by replacing the files; people portraits, if you add any, live in `public/img/people/p1…p9.webp`.
