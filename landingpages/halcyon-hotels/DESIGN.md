# Halcyon — DESIGN.md

Boutique hotels on the Amalfi coast and in Kyoto. Warm luxury editorial: a large serif display face with tight tracking, sand / ink / terracotta palette, generous whitespace, and real editorial photography from `public/img/halcyon` (Positano terrace, lemon pool, suite, ryokan, journals).

All CSS lives in `Page.tsx` under the `.hal` prefix. Every element is reset explicitly (margin, padding, border, font, appearance, list-style, box-sizing), so the page looks the same under Tailwind preflight, Bootstrap or no reset at all.

## 1. Palette

| Role | Token | Hex |
|---|---|---|
| Page background (sand) | `--hal-sand` | `#F3ECE2` |
| Raised surface / houses / map band | `--hal-paper` | `#FBF8F3` |
| Primary text, ink buttons | `--hal-ink` | `#1E1915` |
| Secondary text | `--hal-ink-2` | `#5B5048` |
| Accent: eyebrows, italic emphasis, primary CTA | `--hal-terra` | `#A9502B` (hover `#923F1E`) |
| Secondary terracotta (reserved) | `--hal-terra-2` | `#C8693F` |
| Sea (map routes) | `--hal-sea` | `#2F5866` |
| Dark bands (rituals, footer) | `--hal-night` | `#191513` |
| Hairlines | `--hal-line` | `rgba(30,25,21,0.14)` |
| Accent on dark | — | `#E6A47F` |
| Light text on dark | — | `#F3ECE2` / `#F7F0E6` / `#FBF3E8` |

The hero illustration has its own golden-hour palette (sky `#D9C6B8 → #EED3B2 → #F6E2C6`, sea `#9EAEAA → #2B4D5A`, cliff `#9C6A4D → #5A3A2B`, bougainvillea `#B3466A`/`#C95C80`) and a dusk palette that fades in over it (sky `#262640 → #5E4560 → #C2735D → #E9A170`, sea `#B07A6E → #1C2635`, window lights `#FFD48E`).

Contrast: ink on sand is about 15:1, `--hal-ink-2` on sand about 7:1, terracotta on sand about 5:1 (AA for text). On night, `#E6A47F` is about 8:1.

## 2. Typography

- Display serif (`--hal-serif`): `ui-serif, "New York", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`. Weight 400 only; italic is used for emphasis.
- UI sans (`--hal-sans`): `ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif`.

| Style | Spec |
|---|---|
| Hero H1 | serif 400, `clamp(56px, 7.4vw, 120px)` / 0.98, tracking −0.04em, max-width 9.5em; mobile `clamp(48px, 14vw, 64px)` |
| H2 | serif 400, `clamp(32px, 4.2vw, 64px)` / 1.06, −0.025em, `text-wrap: balance` |
| H3 | serif 400, 28px / 1.15, −0.015em (house names 40px, −0.025em) |
| Lede | serif 400, 24px / 1.5, −0.01em; drop cap 88px terracotta |
| Quote | serif italic, `clamp(26px, 3.2vw, 44px)` / 1.3 |
| Ritual time on frame | serif 64px, −0.04em, tabular numerals |
| Body | sans 400, 17px / 1.7, `--hal-ink-2` |
| Eyebrow | sans 500, 12px, tracking 0.18em, uppercase, terracotta |
| Nav link | sans 500, 14px, 0.02em |
| Logo | serif 22px, tracking 0.22em, uppercase |
| Field label | sans 500, 11px, 0.16em uppercase |

## 3. Spacing, layout, radii

- Container: `max-width: 1280px`, side padding 40px (24px at ≤900px).
- Section padding: 160–180px top/bottom on desktop, 100–120px on mobile.
- Radii: imagery 4px (deliberately near-square and editorial). Controls are capsules (9999px). Booking card 24px, docked 9999px. Date popover 20px, date cells 14px.
- Elevation: booking card `0 24px 60px -24px rgba(30,25,21,.35)` plus a 1px ring; when docked, `0 12px 30px -16px`.

## 4. Motion tokens

```
--fd-ease-out:    cubic-bezier(0.22, 1, 0.36, 1)   entrances, reveals
--fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)   crossfades, state swaps
--fd-spring:      cubic-bezier(0.34, 1.56, 0.64, 1) segmented thumb, map pins, steppers
--fd-dur-1 120ms · --fd-dur-2 240ms · --fd-dur-3 420ms · --fd-dur-4 700ms
```

One rAF scroll loop writes a `--p` progress value (0→1) onto every `[data-hal-p]` element. `pin` mode measures progress through a tall sticky section; `view` mode measures progress across the viewport. All scroll effects animate transform and opacity only.

### Choreography

1. **Load.** The headline lines rise out of masks (1.2s, 140ms stagger). The sub-line fades up at 500ms. Landscape layers settle from 3% below (1.6s, staggered 0/80/160ms).
2. **Hero, pinned for 190vh, time of day.** As `--p` goes 0→1:
   - the sun sinks 21% behind the sea
   - the cliff drops 5% and drifts 2% right; the foreground bougainvillea and parapet fall 16% and scale to 1.06
   - mist drifts left
   - dusk overlays fade in with `opacity: var(--p)`; window lights appear after p≈0.35 and stars after p≈0.55
   - the live clock in the eyebrow counts 17:42 → 20:16
   - after p>0.45 the copy switches to light text (`.is-dusk`, 700ms colour transition)
   - the copy drifts up 60px and fades out near the end.
3. **Booking bar.** Sticky with both `bottom: 24px` and `top: nav + 10px`. It floats at the bottom of the first screen, then docks under the condensed nav. Docking (JS `.is-docked`, triggered when its top is under 120px) shrinks it from 96px to 68px, turns it into a capsule, and hides the field labels.
4. **Intro.** Two figures reveal with `clip-path: inset(100% 0 0 0) → inset(0)` (1.4s; the second is delayed 220ms), while the inner scene scales 1.18→1. The two figures parallax at different rates (−40px and −110px across the viewport).
5. **Houses gallery, pinned horizontally.** The section height is `100vh + track overflow`. The track translates `-p × overflow`. Each image pans inside its frame (`±7%`). The meter fills from 25% to 100% and the counter reads 01–04.
6. **Rooms.** Cards stagger in (90ms). On hover the image zooms 1.07 (1.1s) and the arrow nudges 4px.
7. **Rituals.** Hovering, focusing or clicking a row crossfades the 4:5 frame (700ms in-out plus a 1.06→1 settle) and indents the row 12px.
8. **Testimonials.** Autoplay every 6.5s with a crossfade, 10px lift and 4px blur clear (900ms). Progress dashes fill linearly. Hover or focus pauses it; it is disabled for reduced motion.
9. **Map.** The coastline and rivers draw in (dash offset, 2.4s). Pins drop with the spring (300/520ms delays). The dashed routes fade in and then march.

## 5. Sections

1. **Sticky condensing nav.** 84px and transparent, condensing to 60px with a sand glass background (`blur(18px)`) and hairline. Logo, five links (underline grows from the left), language, and an ink "Reserve" pill. Below 900px a burger opens a sheet with 28px serif links.
2. **Hero.** Full-bleed layered SVG: sky, sun, far headland, sea with glints, a cliff village of about 120 deterministic houses, mist, and a bougainvillea branch with a stone parapet.
3. **Booking bar.** Destination segmented control (spring thumb), arrival date popover (6-column day grid, May 2027), nights and guests steppers, terracotta CTA. The result pill is announced via `aria-live`.
4. **Intro.** Two-column story with a drop cap and a 3-figure stats row (4 houses, 86 rooms, 61% returning), plus an overlapping two-image collage.
5. **Houses.** Pinned horizontal gallery of 4 properties (image, number, name, place, note, rooms, from-price).
6. **Rooms.** 3-up grid of 4:5 cards.
7. **Rituals.** Dark band; sticky-looking frame plus a list of four timed rituals.
8. **Guest book.** Centred italic quote crossfade with progress dashes.
9. **Getting here.** Two illustrated maps (Amalfi, Kyoto) with transfer notes.
10. **Footer.** Newsletter, four link columns, a giant gradient wordmark, and a legal row.

## 6. Components and states

- **Buttons.** 52px capsules (40px small). Hover darkens the fill and moves the arrow 3px; press scales to 0.96 over 120ms and springs back.
- **Segmented control.** A white thumb slides with `--fd-spring` (420ms); options use `role="radio"` and `aria-checked`.
- **Stepper.** 32px round buttons that press to 0.9; the value sits in an `<output aria-live>`.
- **Date popover.** Selected cell is ink-filled; it opens above the bar when floating and below it when docked.
- **Room card.** Whole card is a link; the image zooms and gets a bottom gradient wash on hover or focus.
- **Ritual row.** `aria-pressed`; active row has a terracotta time and light title.
- **Newsletter.** Glass capsule on night. Focus-within shows a terracotta ring. After success the button turns `#E6A47F` and the note reads back the address.

## 7. Responsive

- **≤1080px:** tighter nav gaps, narrower booking columns.
- **≤900px:** burger nav; single-column intro, rituals and footer news. The gallery becomes a native horizontal scroll-snap row (82vw cards, no pinning). Rooms and maps stack.
- **≤760px:**
  - the booking card becomes a 2-row grid (destination, then date, then nights and guests, then a full-width CTA)
  - when docked it collapses to a capsule with the destination toggle plus a short "Search" CTA
  - hero layers are re-framed (1469px wide, offset −643px) so the portrait crop keeps the sea and cliff edge
  - copy is top-aligned under the nav.
- **≤560px:** smaller collage, 32px stats, stacked newsletter.

## 8. Accessibility and reduced motion

- Skip link, landmarks, `aria-labelledby` on sections, labelled controls, `aria-live` for availability, quotes, steppers and newsletter. Focus ring is 2px terracotta at 70%, offset 2px.
- `prefers-reduced-motion`:
  - hero is 100vh with no layer parallax
  - houses become a swipe row
  - no clip-path reveals or scale-ins
  - testimonial autoplay is off
  - all transitions are capped at 120ms.
- `prefers-contrast: more` and `prefers-reduced-transparency`: the booking card and nav become opaque paper with an ink ring.
- The page fixes a host quirk: if both `<html>` and `<body>` clip overflow (which makes `<body>` a non-scrolling scroll container and breaks sticky), it switches `<body>` to `overflow-x: clip` and restores it on unmount.

## 9. Do / Don't

- **Do** keep the serif at weight 400 and let size and italics carry hierarchy.
- **Do** reserve terracotta for one emphasis per view: an eyebrow, an italic word, or the primary CTA.
- **Do** keep imagery nearly square-cornered (4px) and controls fully round.
- **Don't** add drop shadows to imagery; depth comes from parallax and overlap.
- **Don't** animate layout properties; scroll effects use `--p` with transform and opacity only.
- **Don't** run more than one autoplaying element per screen.

## Assets

Photography is supplied (not generated) and lives in `public/img/halcyon/`: `positano-sunset` (hero, fades to a graded dusk copy on scroll), `pool-lemons`, `suite`, `ryokan`, `courtyard-pool` and `journals`, each as `name.webp` (1024 square), `name-900.webp` and `name-480.webp`. Cards re-use the same photographs through `object-position` and `scale` crops (see the `PHOTO` map in `Page.tsx`); always set explicit `width`/`height`, `srcSet`, `loading="lazy"` (hero is `fetchPriority="high"`) and keep the left hero scrim for AA text contrast. Copy the files next to your page or swap in your own.
