# Vault, Design Brief

A monochrome business-banking landing page with Swiss discipline: a blueprint
grid, flush-left type, square corners, ink on white. Every visual decision is
resolved with weight, scale and opacity of one ink. No hue, no gradients on
surfaces, no rounded corners.

Source of truth: `Page.tsx` in this folder. Everything below is read from it.

---

## 1. Principles

1. **One ink, three papers.** Ink `#0b0b0c` on white, with `#f4f4f5` canvas
   bands for alternate sections and a full ink band for the capability rail,
   CTA and footer. Status, emphasis and hierarchy come from opacity.
2. **Square, ruled, measured.** `border-radius: 0` everywhere. 1px rules mark
   columns (ticker, stats, security, quote stats, pricing). Offset "paper"
   shadows (`14px 14px 0 -1px canvas, 14px 14px 0 0 line-2`) stand in for
   elevation.
3. **Blueprint as texture, not wallpaper.** A 96px + 24px grid sits behind the
   hero and CTA only, faded out with a radial mask. Registration crosses, a
   dimension line under the card ("440") and a spec string
   (`GRID 12 · COL 80 · GUTTER 24 · BASE 8`) sell the drafting-table idea.
4. **Mono for metadata.** Section labels (`02, Platform`), figure captions,
   account numbers and badges use the mono stack in uppercase with +0.08em
   tracking. Prose and numbers use the sans stack.
5. **Motion explains the product.** Each motion has a job: the odometer shows
   money moving, the dashboard assembles to show modules composing, the rail
   pins to show breadth.

---

## 2. Tokens

```css
--fd-vlt-ink:        #0b0b0c;   /* text, rules, buttons, dark bands */
--fd-vlt-ink-2:      #1c1c1f;   /* button hover, capability cards */
--fd-vlt-paper:      #ffffff;   /* page */
--fd-vlt-canvas:     #f4f4f5;   /* platform, security, FAQ bands */
--fd-vlt-mute:       #5e5e66;   /* secondary text on light (AA on white & canvas) */
--fd-vlt-mute-dark:  #a1a1aa;   /* secondary text on ink */
--fd-vlt-line:       rgba(11,11,12,0.10);
--fd-vlt-line-2:     rgba(11,11,12,0.20);
--fd-vlt-line-dark:  rgba(255,255,255,0.12);
--fd-vlt-nav-h:      64px;      /* 52px when condensed */
```

Motion tokens (shared library language):

| token | value |
|---|---|
| `--fd-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--fd-ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` |
| `--fd-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| `--fd-dur-1..4` | `120ms / 240ms / 420ms / 700ms` |

---

## 3. Type

| Role | Spec |
|---|---|
| Sans stack | `-apple-system, "SF Pro Display", "Inter", "Helvetica Neue", …` |
| Mono stack | `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, …` |
| H1 | 600, `clamp(3.25rem, 8.4vw, 7.75rem)`, line-height 0.92, tracking −0.055em, three masked lines |
| H2 | 600, `clamp(2rem, 4.6vw, 4rem)`, line-height 1, tracking −0.04em |
| CTA headline | 600, `clamp(3.5rem, 11vw, 10rem)`, tracking −0.06em |
| Big numbers | 600, tabular-nums, tracking −0.05em (stats `clamp(2.5rem, 4.6vw, 4.25rem)`, prices 3.5rem) |
| Lede | 400, `clamp(1.0625rem, 1.4vw, 1.25rem)`/1.5, mute |
| Label | mono 500, 0.75rem, uppercase, +0.08em, mute |

Numbers are always `font-variant-numeric: tabular-nums` so odometers and
count-ups never jitter.

---

## 4. Layout

- Container: `max-width: 1280px`, side padding 32px (20px ≤ 900px).
- Hero: two columns `1.15fr / 0.85fr`, min-height 100vh, ticker row of four
  ruled cells below.
- Sections, in order: Nav · Hero · Logos · Platform (sticky, 340vh) ·
  Capabilities (pinned horizontal, ink) · Stats · Security + marquee ·
  Testimonial · Pricing · FAQ · CTA (ink, grid) · Footer (ink, giant outlined
  wordmark).
- Section rhythm: 120–140px vertical padding (88px ≤ 640px).
- Breakpoints: 1080, 900 (single column, sticky scenes become normal flow,
  burger nav), 640.

---

## 5. Components

- **Button**: 48px tall, square, ink fill. Variants `ghost` (line-2 border),
  `inv` (white on ink), `ghost-inv`. Arrow nudges 3px on hover with the spring.
  Press: `scale(0.96)`.
- **Balance card**: 1px ink border, offset paper shadow, live dot, odometer
  balance, spark line, last three transactions.
- **Odometer**: each digit is a 0–9 vertical strip translated by `-digit×10%`;
  900ms ease-out, staggered 22ms from the right. Used for the live balance and
  for prices when the billing period changes.
- **Dashboard tile**: white, 1px ink border, mono caption, tabular figure.
  Dashed placeholder slots (A–F) sit underneath so the empty grid reads as a
  blueprint before the modules arrive.
- **Segmented control**: `role="radiogroup"`, ink thumb that slides with
  `--fd-spring` over 420ms.
- **Accordion**: `grid-template-rows: 0fr → 1fr` (no height animation), plus
  icon whose vertical bar rotates away on the spring.
- **Marquee**: two rows of badges with shield icons, 48s / 56s linear,
  opposite directions, edge-masked, paused on hover.

---

## 6. Motion choreography

| Where | What | How |
|---|---|---|
| Hero H1 | Line-by-line mask reveal | each line `overflow:hidden`, child `translateY(105%) → 0`, 1000ms ease-out, delays 80/170/260ms |
| Hero copy | Rise | `opacity 0, translateY(18px) → none`, 900ms, staggered `--d` |
| Balance | Live odometer | a settlement lands every 2.8s while visible and the tab is visible; balance updates, transaction slides in |
| Card | Pointer tilt | spring integrator (k 380, c 30) drives `--rx/--ry` (±9° / ±7°) and a glare position; rAF stops when settled |
| Nav | Condense | height 64 → 52px, white 86% + blur(16px) + hairline after 16px scroll |
| Platform | Sticky assembly | progress p = −top / (height − vh). Six modules each map a `[start,end]` window of p to `--t` (eased), which drives opacity, a translate from `--dx/--dy`, and scale 0.94 → 1. Steps 01–04 highlight by p; a hairline progress bar shows p% |
| Capabilities | Pinned horizontal rail | section height = track overflow + vh; `translateX(−p × overflow)`; counter 01/06 and progress line follow p |
| Stats | Count-up | IntersectionObserver at 60%, exponential ease-out over 1600ms |
| All blocks | Reveal | `[data-reveal]` gets `data-in`; 700ms opacity + 900ms translate, stagger `--i × 70ms` |

Scroll work is rAF-throttled, transform/opacity only, and paused when the
section is off screen.

---

## 7. Accessibility and fallbacks

- `prefers-reduced-motion`: no keyframes, no tilt, no live feed; sticky scenes
  become normal flow with the dashboard fully assembled; the rail becomes a
  native horizontal scroller with snap; fades limited to 120ms.
- `prefers-contrast: more`: darker mute, stronger rules, opaque nav.
- `prefers-reduced-transparency`: opaque nav.
- Odometer exposes the real value via a visually hidden span; the balance is
  `aria-live="polite"`.
- Focus ring: 2px ink at 70%, offset 2px.

---

## 8. Do / don't

- Do add new sections as ruled columns with a mono label `NN, Name`.
- Do keep every number tabular and every corner square.
- Don't introduce a brand hue, gradients on surfaces, or rounded cards.
- Don't animate layout properties; use the `--t` / `--p` variables pattern.

## Assets
Testimonial avatar: Placeholder portraits live in `public/img/people/` (`p1.webp` to `p9.webp`, 328×328). Copy the folder next to the page so root-relative `/img/people/...` URLs resolve, or swap in your own photos. They are lazy-loaded and cropped with `object-fit: cover; object-position: center top`.
