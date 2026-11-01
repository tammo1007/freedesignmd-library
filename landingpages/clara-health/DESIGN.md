# Clara — DESIGN.md

A modern primary-care and virtual clinic in Seattle and Portland. Calm and trustworthy: soft clinical whites, a sage / teal accent, rounded geometry, a friendly rounded sans, and accessibility first (AA+ contrast, 44px+ hit targets, full keyboard support).

All CSS lives in `Page.tsx` under the `.cl` prefix. Every element is reset explicitly, so the page is independent of host resets. Illustrations and portraits are inline SVG; there are no image files or web fonts.

## 1. Palette

| Role | Token | Hex |
|---|---|---|
| Page canvas | `--cl-canvas` | `#F6F8F7` |
| Cards, white bands | `--cl-surface` | `#FFFFFF` |
| Soft tint (icon tiles, segmented track) | `--cl-tint` | `#EAF2EE` |
| Tint 2 (hover) | `--cl-tint-2` | `#DCEBE4` |
| Sage (orb, logo, flags) | `--cl-sage` | `#9DBFAE` |
| Primary teal (CTA, selected slot) | `--cl-teal` | `#1F6F68` |
| Teal ink (hover, small teal text) | `--cl-teal-ink` | `#17544F` |
| Ink (headings, dark CTA, footer) | `--cl-ink` | `#0F2420` |
| Body text | `--cl-ink-2` | `#465A55` |
| Tertiary text | `--cl-ink-3` | `#66776F` |
| Hairlines | `--cl-line` | `#DFE7E3` |
| Warm accent (illustration only) | `--cl-coral` / `--cl-peach` | `#E26D5A` / `#F3D3BC` |
| Availability dot | — | `#2E9B6A` |
| Success (booked) | — | `#2E8A5F` |
| Light teal on ink | — | `#A9D7C3` |

Contrast: ink on canvas is about 16:1, `--cl-ink-2` on white about 7.3:1, `--cl-ink-3` on white about 4.6:1, white on teal about 6:1, and disabled slot text `#8C9A95` is decorative alongside a strikethrough plus a hatched fill.

## 2. Typography

- Text (`--cl-font`): `ui-rounded, "SF Pro Rounded", ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif`
- Display (`--cl-display`): `ui-rounded, "SF Pro Rounded", "SF Pro Display", ui-sans-serif, -apple-system, "Inter Display", "Inter", …`

| Style | Spec |
|---|---|
| H1 | display 600, `clamp(44px, 5.6vw, 76px)` / 1.02, −0.035em, max 12ch |
| H2 | display 600, `clamp(32px, 3.6vw, 48px)` / 1.08, −0.028em |
| H3 | display 600, 20px / 1.3 (journey step titles 32px, −0.025em) |
| Stat number | display 600, 64px, −0.045em, tabular; suffix 32px teal |
| Price | display 600, 64px / 72px, −0.045em |
| Lede | 400, 20px / 1.55 |
| Body | 400, 17px / 1.6 |
| Eyebrow | 600, 13px, 0.06em, uppercase, teal |
| Button | 600, 16px (15px small) |

## 3. Spacing, radii, elevation

- Container 1200px with 32px side padding (20px at ≤860px). Section padding 120–140px (96px mobile).
- Radii are concentric:
  - cards 28px (`--cl-r-card`), with the inner portrait at 18px (`--cl-r-inner` = 28 − 10 padding)
  - widget 32px, plans 32px
  - journey stage 40px; CTA band 40px
  - day chips 18px
  - all controls capsules (9999px).
- Elevation is soft: a 1px ring `rgba(15,36,32,.05)` plus at most one long low shadow, e.g. widget `0 40px 80px -40px rgba(15,36,32,.35)`, hovered card `0 24px 40px -24px rgba(15,36,32,.28)`.
- Hit targets: buttons 52px (44px small), slots 48px, day chips 64px, FAQ rows 76px, nav links 44px.

## 4. Motion tokens

```
--fd-ease-out    cubic-bezier(0.22, 1, 0.36, 1)
--fd-ease-in-out cubic-bezier(0.65, 0, 0.35, 1)
--fd-spring      cubic-bezier(0.34, 1.56, 0.64, 1)
--fd-dur-1 120ms · --fd-dur-2 240ms · --fd-dur-3 420ms · --fd-dur-4 700ms
```

### Choreography

1. **Hero load.** Copy children rise 18px in a 80ms stagger (700ms); the widget rises at 200ms.
2. **Breathing orb.** Three radial blobs (sage, peach, aqua) "breathe" on a 9s in-out loop: the main one scales 0.9→1.06 and its opacity 0.75→1, and the others counter-drift. The whole orb follows the mouse at ±24/18px through a damped lerp (factor 0.06).
3. **Booking widget.**
   - The visit-type segmented thumb springs (420ms).
   - The selected day chip turns ink.
   - The slot highlight is one measured pill that springs between slots (`transform` 520ms with spring; width and height 420ms).
   - Arrow keys move the selection across free slots (roving tabindex).
   - Confirm morphs: label slides up and out → spinner (700ms rotation) → green fill with a check that draws (dash offset 520ms).
4. **Insurance marquee.** Two identical sets translate −50% over 42s, with an edge mask; pauses on hover.
5. **Care journey (sticky storytelling).** The left stage is `position: sticky; top: 110px`. The step nearest 55% of viewport height becomes active and steps fade from 0.38 to 1 opacity. The illustration is the same seven absolutely positioned primitives, re-laid out per step: transform (760ms spring), size and radius (620ms out), colour (620ms in-out), with a 30ms stagger per primitive. A caption chip pops in 420ms after each morph, and a 4-part progress rail fills.
6. **Virtual chat.** When the phone is 35% visible, messages arrive in sequence (spring, delays 200–3900ms) and a typing indicator appears and collapses.
7. **Outcome stats.** Count up from 0 over 1800ms (easeOutQuart) at 40% visibility; each card's 4px bottom bar scales with the value.
8. **Cards.** Services lift 4px on hover; clinician cards lift 6px and the portrait zooms 1.04.
9. **Pricing toggle.** Spring thumb; prices re-mount and roll up from 70% (700ms spring).
10. **FAQ.** `grid-template-rows: 0fr → 1fr` (420ms); text fades and settles; the + rotates 45° with the spring and fills teal.
11. **Reveals.** `[data-cl-rv]` fade up 22px (700ms) with per-item `--d` delays.

## 5. Sections

1. **Sticky nav.** A floating capsule that gains white glass (`blur(20px)`), a ring and a shadow on scroll, and narrows from 1200 to 1000px.
2. **Hero.** Badge, H1, lede, two CTAs, proof row, booking widget, breathing orb.
3. **Insurance marquee.** Eight fictional insurers with line-glyph marks.
4. **Services bento.** 4 columns, two wide cards.
5. **Care journey.** Sticky morphing stage plus four steps.
6. **Virtual clinic.** Copy, ticks, and an animated phone conversation.
7. **Outcomes.** Four count-up stats plus a methodology footnote.
8. **Clinicians.** Four illustrated portrait cards with languages and next availability.
9. **Pricing.** Monthly/annual toggle and three plans (featured plan in ink).
10. **FAQ.** Five accordions.
11. **CTA band.** Teal with a breathing orb.
12. **Footer.** Emergency notice, brand, clinics, care, company, hours, legal.

## 6. Components and states

- **Primary button.** Teal, with an inner highlight and a teal glow shadow. Hover → teal-ink with the arrow nudged 3px; press scales to 0.96.
- **Ghost / soft / light buttons.** Ghost is a 70%-white capsule with a 1.5px hairline (hover: white with a sage ring); soft uses the tint fill; light is white on teal.
- **Slot.** States: idle (hairline), hover (tint plus sage ring), selected (white text over the moving teal pill), disabled (hatched, struck through, `aria-disabled` through native `disabled`).
- **Day chip.** Idle canvas with a hairline; hover sage ring; selected ink.
- **Confirm.** States `idle | busy | done`; disabled (no slots) is grey with a dark label; the status line is `aria-live`.
- **Accordion.** Native button with `aria-expanded` and `aria-controls`; panel `role="region"`.

## 7. Responsive

- **≤1080px:** burger menu, the hero stacks (widget max 560px), bento, stats and clinicians go 2-up, the stage canvas scales to 0.82.
- **≤860px:**
  - the widget header stacks
  - the journey becomes one column, with the stage sticky under the nav (280px tall, canvas scale 0.54, a white fade under it) and steps scrolling beneath
  - plans stack.
- **≤560px:** 44px H1, single-column bento and stats, 2-up compact clinician cards, full-width phone.

## 8. Accessibility and reduced motion

- Skip link, landmarks, labelled sections, `role="radiogroup"`/`radio` for visit type, day, slot and billing. Arrow-key navigation in slots. Visible 2px teal focus ring at 70%.
- `prefers-reduced-motion`:
  - no orb breathing or pointer follow
  - the marquee becomes a static wrapped list
  - no count-up (real values render immediately)
  - chat messages are visible with no typing indicator
  - transitions are capped at 120ms.
- `prefers-contrast: more`: opaque surfaces with ink rings. `prefers-reduced-transparency`: opaque widget and nav.
- Fixes the html+body overflow host quirk that breaks `position: sticky`, and restores it on unmount.

## 9. Do / Don't

- **Do** keep one teal action per view and use ink for the confirm action.
- **Do** keep radii concentric (outer − padding = inner) and controls capsule-shaped.
- **Do** write numbers with units and sources; healthcare copy must be specific and calm.
- **Don't** use red for anything but the illustration's "end call" and heart accents. Errors and emergencies use words, not colour alone.
- **Don't** shrink targets below 44px or put body text below 13px.
- **Don't** autoplay anything that carries essential information; the chat is illustrative and also described in its `aria-label`.

## Assets
Clinician portraits: Placeholder portraits live in `public/img/people/` (`p1.webp` to `p9.webp`, 328×328). Copy the folder next to the page so root-relative `/img/people/...` URLs resolve, or swap in your own photos. They are lazy-loaded and cropped with `object-fit: cover; object-position: center top`.
