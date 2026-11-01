# Noir — DESIGN.md

Luxury perfume house landing page (the fictional Maison Vérane). Cinematic black, bone and exactly one accent, amber. Giant italic serif display, tiny tracked-out sans labels, long pauses. Imagery: a canvas smoke simulation, CSS-blurred colour atmospheres, one pre-rendered hero flacon photograph and small SVG flacons. No web fonts, no network.

All CSS lives in `Page.tsx` under the `.nr` prefix; every element is reset explicitly so it looks identical with or without a CSS reset.

## 1. Palette

| Role | Token | Hex |
|---|---|---|
| Page background (black) | `--nr-black` | `#070605` |
| Raised black | `--nr-ink` | `#0E0C0A` |
| Text, bone | `--nr-bone` | `#E9E2D3` |
| Muted text | `--nr-mute` | `#A8A196` |
| The single accent, amber | `--nr-amber` | `#E0A04A` |
| Hairlines | `--nr-line` | `rgba(233,226,211,.14)` |
| Atmosphere: top notes (smoked sage) | `--atm` | `#9DB5A6` |
| Atmosphere: heart notes (wine rose) | `--atm` | `#B04A5C` |
| Atmosphere: base notes (amber) | `--atm` | `#E0A04A` |
| Quiz result tints | `--tint` | amber `#E0A04A`, rose `#B04A5C`, sage `#9DB5A6`, lilac-grey `#C9C2D6` |

Atmospheres and quiz tints appear only as blurred glows and liquid colour, never as UI colour. Contrast: bone on black about 15:1, muted on black about 8:1, amber on black about 9:1.

## 2. Typography

- Serif (`--nr-serif`): `"Cormorant Garamond", "Playfair Display", "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`. Always italic for display, weight 300–400, tracking −0.025em to −0.05em.
- Sans (`--nr-sans`): `"Helvetica Neue", "Inter", ui-sans-serif, system-ui, Arial`. Weight 300 body; labels 11px / 0.34em uppercase in amber.

| Style | Spec |
|---|---|
| Hero title | serif italic 300, `clamp(5.2rem, 21vw, 21rem)` / 0.8; second line in amber, indented 0.3em |
| Section H2 | serif italic 400, `clamp(3rem, 9vw, 8.4rem)` / 0.92 |
| Manifesto | serif italic 400, `clamp(2.1rem, 6.4vw, 6.4rem)` / 1.02 |
| Notes panel title | serif italic, `clamp(3.4rem, 9vw, 8rem)`; giant outlined/tinted word up to 40rem behind |
| Quiz question | serif italic, `clamp(2.8rem, 7vw, 6.6rem)` / 0.96 |
| Collection names | serif italic, `clamp(2.4rem, 6.4vw, 6rem)` |
| Labels | sans 11px, 0.34em, uppercase |
| Buttons | sans 12px, 0.26em uppercase, square corners, 54px tall |

## 3. Spacing and shape

- Container 1280px, side padding 48px (22px at ≤900px). Sections are 190–420vh when pinned; static sections 110–170px padding.
- Zero radii anywhere except the round bag counter. Hairline dividers instead of cards.

## 4. Motion tokens

`--nr-out: cubic-bezier(.22, 1, .36, 1)` for everything. One rAF loop reads scrollY and `getBoundingClientRect()` and writes transforms and opacity (plus SVG `transform` attributes for the light sweep). A separate rAF loop paints the smoke, paused when the hero is off-screen.

## 5. Sections and choreography

1. **Hero.** The curtain fades from black (1.8s). The smoke canvas runs at half resolution (soft upscale): ~1k particles (scaled to area) follow a two-octave value-noise flow field that drifts over time with an upward bias, drawn as additive hairline strokes over a faint black fade so threads trail. 84% bone, 16% amber. The pointer injects velocity (the field is dragged along the stroke), a tangential swirl inside a 240px radius, and respawns amber particles at the cursor. The title rises letter by letter out of overflow masks (1.5s, 70ms stagger); the block drifts down and fades on scroll.
2. **Manifesto (300vh pinned).** Each word fades from 13% to 100% and rises 14px in sequence; "remembered", "warm" and "hour" are amber.
3. **Flacon (360vh pinned).** A hand-built SVG flacon (glass body, liquid, collar, faceted cap, label). Two skewed gradient bands, clipped to the bottle silhouette and screen-blended, travel left to right with scroll; the amber glow behind rises and falls, the bottle tilts −3° → +3°, an outlined "Le Flacon" background word slides sideways, and three captions (glass, juice, cap) arrive in turn.
4. **Notes (420vh pinned, horizontal).** A 300vw track translates with scroll. Each panel has a giant italic word that counter-parallaxes at 0.32 × viewport, a body block at 0.1, and three drifting blurred orbs. Three full-screen colour atmospheres crossfade behind. A hairline timeline fills along the bottom, labels light as the active note changes.
5. **Quiz (190vh pinned on desktop).** Three questions, four options each, scored against four fragrances. A rotating ring field behind turns with scroll. The result animates: name letters rise with a stagger, three bars fill, notes and CTA fade in, and a flacon in the matched colour fills from empty (2.4s) under a tinted halo. Sample-reserve button, retake link.
6. **Collection.** Four huge rows; on hover the name slides right and takes the fragrance colour while a small flacon lifts in (always visible on mobile).
7. **Footer.** Newsletter (inline success state), address, links, and a giant outlined "Vérane" wordmark fading to amber at its base.

## 6. Responsive and accessibility

- ≤900px: nav links hide, captions dock to the bottom of the flacon stage, notes panels stack their content top-aligned, the quiz and result stop pinning and stack (bottle first), collection rows become two-line.
- Quiz options are real buttons; the result is an `aria-live` region; decorative canvases and big words are `aria-hidden`.
- `prefers-reduced-motion`: the smoke is a single pre-rendered frame, no curtain, no pinning, all manifesto words visible, captions stacked under the bottle, the three note panels stack vertically with their atmospheres, and the quiz result shows complete.

## Assets

The hero flacon is `public/img/lux/perfume-noir.webp` (pre-rendered, black lacquer cap, amber glass; `-800` variant included), placed inside the SVG with a radial mask so it melts into the black page while the scroll-driven light sweep runs on top. The small collection/result flacons stay SVG so they can be tinted per scent. Placeholder portraits, if needed, live in `public/img/people/p1…p9.webp`.
