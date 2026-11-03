# Terra, design brief

Regenerative-agriculture landing page whose composition grows with scroll. Aesthetic: **Organic Earth Editorial**. Single file `Page.tsx` (react only), scoped CSS prefix `tr-`.

## Tokens (CSS custom properties on `.tr`)
| Token | Value | Use |
|---|---|---|
| `--soil` / `--soil2` | `#2b1c12` / `#5b3d26` | dark sections, hero ground, hard shadows |
| `--moss` | `#5a6b33` | italics, contours, eyebrows |
| `--ink` | `#2a1d14` | text, borders |
| `--cream` | `#f3ecda` | cards, text on dark |
| `--chl` | `#3be34f` | the one vivid accent: counters, stored carbon, buttons, focus rings |
| `--bg`, `--sky1/2`, `--leaf`, `--leaf2`, `--wheat`, `--sun`, `--hill` | interpolated | **seasonal**, set by the slider |
| `--bloom`, `--snow`, `--sy` | numbers | foliage scale, snow opacity, sun offset |
| Type | Fraunces first, then Iowan Old Style / Palatino / Georgia | display + quotes (400-500, tight tracking, italic accents) |
| Body | Instrument Sans first, then system-ui | 16px / 1.55 |
| Data | ui-monospace | eyebrows, labels, tickers, 11-13px uppercase |

Season stops (slider 0-3, linear interpolation): Spring (sage sky, fresh greens, `#f3ecda` page), Summer (blue sky, deep green, golden wheat), Autumn (peach sky, rust and amber), Winter (grey sky, muted leaf, snow on the ground, foliage at 30%).

## Shape and spacing
Sections 120px vertical padding, 1160px wrap, 28px gutters (16px at mobile). 4px radii, 1.5px ink borders, hard offset shadows in `--soil2` for cards. Pills only for nav and the season control.

## Sections
1. **Hero / cross-section**: 480vh track, sticky 100vh stage. A 1200x900 SVG scene (slice): sky, sun, clouds, hills, five wavy soil horizons with specks and worms, depth ruler and horizon labels. Seeded generators produce 11 wheat plants (stem, blades, ears), 6 cover crops with leaves and flowers, a hedge, a tree and about 200 branching roots. Caption and counter overlays.
2. **Contours**: three seeded hills as distorted concentric rings with index contours and elevation labels, plus a chlorophyll field boundary, all drawn by scroll progress.
3. **Ledger** (dark): live ticking tonnage, per-practice bars (scaleX), cumulative line chart drawn with dashoffset.
4. **Field map**: 12 jittered plots in a 4x3 grid over a river; hover, focus or click draws crop rows into the plot and fills the info panel.
5. **Mycelium**: seeded fungal network drawing top-down with travelling `offset-path` signals and count-up stats.
6. **Growers**: three quotes revealed with `clip-path` from the ground up.
7. **Join**: soil-test form and a swaying wheat field that rises with scroll.
Fixed nav and a fixed season slider (bottom center).

## Motion
Single rAF scroll loop writes CSS variables (`--p`, `--gs`, `--gr`, `--gc` on the stage, `--sp` on sections); SVG parts derive their state with `calc()` and `clamp()` from those variables plus a per-element `--d` delay (stroke-dashoffset on `pathLength=1` strokes, transform scale on leaves). No React state per frame. Ambient: cloud drift, falling carbon, wheat sway, signal pulses. `prefers-reduced-motion`: scene rendered fully grown (p = 1), all animation and transitions off, section reveals visible.

## Assets
Grower portraits (voices): Placeholder portraits live in `public/img/people/` (`p1.webp` to `p9.webp`, 328×328). Copy the folder next to the page so root-relative `/img/people/...` URLs resolve, or swap in your own photos. They are lazy-loaded and cropped with `object-fit: cover; object-position: center top`.
