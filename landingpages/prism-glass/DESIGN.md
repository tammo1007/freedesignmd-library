# Prism, Design Brief

A bright, optimistic AI product page built around Apple-style **Liquid
Glass**. A soft, muted warm mesh drifts behind everything; content (product shots,
quotes, plans) sits on solid white-ish cards; and glass is reserved for the
**control layer** that floats above content, nav, prompt bar, sliders,
scene chips, carousel buttons, the billing toggle and the lens demo.

Source of truth: `Page.tsx` in this folder.

---

## 1. Principles

1. **Glass is for controls, never content.** Following Apple's HIG, cards that
   hold information are opaque (`rgba(255,255,255,0.72–0.82)` with a white
   1px ring). Only things you touch are glass.
2. **Real refraction where possible, honest frost elsewhere.** Chromium gets
   SVG-displacement refraction with chromatic rim splitting; other browsers
   get `blur(18px) saturate(180%)` frost. Both look intentional.
3. **Colour comes from light, not UI.** The UI is ink `#16161d` on warm
   stone paper with one sienna accent `#8a3f14`. All other colour lives in
   the mesh and the product photography.
4. **Depth by parallax.** The hero stage, studio scene and gallery are built
   from layers that move at different rates with pointer and scroll.
5. **Real photographs, graded in CSS.** The product imagery is three real,
   sharp studio photos (grey seamless backdrop, soft light, reflective floor).
   Every lighting scene and campaign variation is the same photo re-graded and
   re-cropped with blend modes, filters and `object-position` + zoom, never a
   drawn or rendered stand-in, and never a tint strong enough to garble a label.

---

## 2. Tokens

```css
--fd-prs-ink:         #16161d;   /* text, primary buttons, hot plan */
--fd-prs-ink-2:       #2a2a33;   /* nav links */
--fd-prs-mute:        #4f4f5c;   /* body copy (AA on paper and glass) */
--fd-prs-paper:       #f5f2ec;   /* page base under the mesh */
--fd-prs-card:        #ffffff;
--fd-prs-line:        rgba(22,22,29,0.08);
--fd-prs-accent:      #8a3f14;   /* kickers, checkmarks, focus */
--fd-prs-glass-tint:  rgba(255,255,255,0.22);   /* glass with refraction */
--fd-prs-glass-frost: rgba(255,255,255,0.58);   /* frosted fallback */
```

Mesh: five radial blobs (60vmax), clay `#f0d2bd`, sand `#dcd3c4`, stone
`#d6dde0`, apricot `#f7dcb8`, sage `#d3dfcf`, plus an SVG fractal-noise grain
at 35% in `soft-light`.

Grades (product photography): Golden hour, North-light studio, Neon dusk,
Greenhouse, Rose studio, Night edit, Mono, Duotone (plus the untouched
Original). A grade is a `bg` colour blended with `overlay` over the grey
backdrop (the white label stays white), a soft `all` pass, an optional filter
on the photo (`grayscale`, `contrast`) and a key-light highlight position. The
hero key-light slider adds a warm/cool `soft-light` layer on top.

Motion tokens: `--fd-ease-out (0.22,1,0.36,1)`, `--fd-ease-in-out
(0.65,0,0.35,1)`, `--fd-spring (0.34,1.56,0.64,1)`, durations 120 / 240 / 420 /
700ms.

---

## 3. Type

| Role | Spec |
|---|---|
| Stack | `-apple-system, "SF Pro Display", "SF Pro Text", "Inter", …` |
| H1 | 650, `clamp(3.25rem, 7.4vw, 6.5rem)`/0.95, −0.05em, two set lines |
| H2 | 600, `clamp(2rem, 4.6vw, 3.5rem)`/1.05, −0.035em, balanced, second clause in `#6e6e7a` |
| Kicker | 600 0.875rem, accent |
| Body / lede | 400 1.125rem/1.5 mute (lede clamps to 1.25rem) |
| Numbers | 650, −0.05em, tabular (stats, prices) |

---

## 4. Layout

- Container 1200px, 32px gutters (20px ≤ 720px).
- Sections: Nav · Hero (copy + fan of the three photos with glass controls) ·
  Logos marquee · Optics lens · Studio (sticky, 330vh) · Gallery (3 parallax
  columns of crops and grades) · Before/after slider · Stats · Customer
  carousel · Pricing · FAQ · CTA card · Footer.
- Radii: stage 36px, cards 26–32px, CTA 40px, controls are capsules (9999px)
  or 22px panels.
- Breakpoints: 1000 (single column, burger nav), 720 (mobile: 2-column
  gallery, lens controls full-width).

---

## 5. The glass helper

`<Glass radius bezel strength refract>` renders a div with:

1. **Frosted base**: `--fd-prs-glass-frost` fill, `blur(18px) saturate(180%)`,
   inset white highlights on all four edges and a soft drop shadow; a
   `::after` specular sheen (`soft-light`).
2. **Refraction (Chromium)**: after mount it measures itself
   (ResizeObserver) and paints a displacement map on a canvas, neutral grey
   inside, with a convex bezel whose R/G channels push samples outward along
   the edge normal (`(1 − t)^2.4` falloff). An SVG `<filter>` with a `useId()`
   id applies that map three times (scale 1, 0.93, 0.86) isolating R, G and B,
   screens them back together (chromatic aberration), blurs 0.7px and
   saturates 1.45. It's applied as `backdrop-filter: url(#id)` and the fill
   drops to `--fd-prs-glass-tint`.
3. **Gating**: refraction is off for non-Chromium engines and under
   `prefers-reduced-transparency`; `refract={false}` forces frost (used for
   the nav, whose shape animates).

Usage: nav capsule (frost), prompt bar, scene/lens/angle chips, key-light and
refraction sliders, sun-azimuth dial, carousel arrows, billing toggle, and the
240px draggable lens (bezel 46, strength set live by a slider).

---

## 6. Motion choreography

| Where | What | How |
|---|---|---|
| Backdrop | Mesh drift | blobs translate/scale with page scroll progress `--m` (not time, so refraction is only recomputed while scrolling) |
| Nav | Condense into glass capsule | after 40px: glass fades in and `clip-path` insets to a 940px capsule; inner row narrows to match |
| Hero | Entrance | blur-up + rise, staggered; the grade on all three photos cross-fades every 5.2s (stops when you type); clicking a side photo brings it to the front |
| Hero | Generate | submit → button turns sienna "Rendering…", a light sweep crosses the photos, next grade fades in |
| Hero | Parallax | pointer sets `--px/--py` (±0.5); layers move 14 / 26 / 32 / 40px. Scroll sets `--sp`; the stage sinks 60px while chips rise 80–150px |
| Hero | Key-light slider | 2700–7500K tints the photos warm or cool via a soft-light overlay |
| Lens | Spring drag | spring integrator (k 380, c 30); idles on a Lissajous drift until touched; squash-and-stretch along velocity; arrow keys move it |
| Studio | Sticky scenes | p picks scene 1–3 (parfum golden → balm dusk → tube north); copy crossfades; the frame's `clip-path` morphs 1:1 → 4:5 → 9:16; three glass chips sit on depth layers that translate `(p − 0.5) × −depth` (60–140px) |
| Gallery | Column parallax | `--g` (−0.5…0.5) × per-column speed (−60, 50, −110px) |
| Compare | Before/after | a transparent range input drives `clip-path: inset(0 0 0 N%)` on the graded copy; a glass knob follows; product and grade pills swap the pair |
| Stats | Count-up | exponential ease-out over 1.5s on view |
| Carousel | Momentum | pointer drag with rubber-band edges (0.35), velocity projected 260ms ahead to pick the slide, spring snap seeded with release velocity |
| Pricing | Toggle + price pop | white thumb slides on the spring; prices re-mount with a spring pop |
| Blocks | Reveal | `[data-reveal]` → `data-in`, 700/900ms, stagger `--i × 80ms` |

---

## 7. Accessibility and fallbacks

- `prefers-reduced-motion`: no keyframes or parallax, studio unpinned with all
  three scenes listed, carousel snaps without springs, lens doesn't drift.
- `prefers-reduced-transparency`: all glass becomes opaque `#fafafc`.
- `prefers-contrast: more`: glass becomes white with a 1px ink ring; darker
  mute.
- Lens is focusable with arrow-key control; carousel has buttons and arrow
  keys; prompt input has a label; scene name is `aria-live`.

---

## 8. Do / don't

- Do keep glass on controls only; if it holds content, make it a card.
- Do match `radius` on `<Glass>` to the CSS radius so the bezel lines up.
- Don't animate the backdrop with time-based keyframes behind refracting
  glass; tie it to scroll or pointer.
- Don't add new hues to UI chrome; put colour in the scene.

## Assets

Product imagery lives in `public/img/prism/`: `parfum.webp` (amber Eau de
Parfum Nº4, silver cap), `balm.webp` (blue frosted Fieldnote Balm jar) and
`tube.webp` (teal SPF 30 tube), each ~570x818 portrait, plus `-480` variants
(480w) used in `srcSet`. They are real studio photos on a uniform grey
seamless, which is what makes the CSS grading work: the `Pic` helper renders
one photo with explicit `width`/`height`, `srcSet` (480w + full), lazy loading
(the first hero photo is eager with `fetchPriority="high"`) and optional crop
props (`ox/oy` object-position, `fx/fy` zoom focus, `z` zoom, kept at or below
about 1.4 so the 570px source stays sharp). Copy the files next to your page or
swap in your own photos of the same style (grey seamless, centred product).
Placeholder portraits for avatars live in `public/img/people/p1…p9.webp`.
