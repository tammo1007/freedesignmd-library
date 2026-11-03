# Orbit, DESIGN.md

SaaS / developer-platform launch page whose entire layout is an orbital system. Cosmic Technical Dark: deep navy field, electric cyan as the only saturated colour, warm white for text and the star. Everything is procedural: a canvas star field, CSS-gradient planets, inline SVG rings, spirals and sparklines. No images, no web fonts, no network.

All CSS lives in `Page.tsx` under the `.orb` prefix and every element is reset explicitly, so the page looks the same with or without a CSS reset.

## 1. Palette

| Role | Token | Hex |
|---|---|---|
| Page background | `--orb-bg` | `#040A18` |
| Raised navy | `--orb-bg2` / `--orb-panel` | `#071230` / `#0A1A3A` |
| Primary accent (electric cyan) | `--orb-cyan` | `#38E1FF` |
| Bright cyan (hover, gradients) | `--orb-cyan2` | `#7DF0FF` |
| Ice (secondary text on dark, planet tint) | `--orb-ice` | `#BFE6FF` |
| Warm white (headings, the star) | `--orb-warm` | `#FBF3E4` |
| Muted text | `--orb-mute` | `#8CA2C6` |
| Nebula indigo (glow only) | `--orb-indigo` | `#5B6BFF` |
| Hairlines | `--orb-line` | `rgba(125,190,255,.16)` |
| Hero field |, | radial `#0B1D4A → #06112B → #030815` |

Contrast: warm white on navy about 17:1, muted `#8CA2C6` on navy about 7:1, cyan on navy about 11:1. Dark text on cyan buttons is `#021018`.

## 2. Typography

- Sans (`--orb-sans`): `"Space Grotesk", "Inter", ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif`. Headings 600, tracking −0.035em to −0.05em, balanced wrapping.
- Mono (`--orb-mono`): `"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace` for eyebrows, HUD, terminal, code and version tags.

| Style | Spec |
|---|---|
| Hero H1 | sans 600, `clamp(2.7rem, 8.4vw, 7.6rem)` / 0.95, −0.05em; the word "orbital" is a white→cyan gradient clip |
| H2 | `clamp(2.2rem, 5vw, 4.2rem)` / 1.04, −0.035em; emphasis words use a cyan→indigo gradient clip |
| Closing H | `clamp(2.8rem, 8vw, 7rem)` / 0.98, −0.045em |
| Lede | 1.15rem / 1.6, muted |
| Eyebrow | mono 12px, 0.2em, uppercase, cyan, with a glowing 26px rule |
| HUD / tags | mono 10–11px, 0.14–0.2em |

## 3. Spacing, layout, radii

- Container `max-width: 1240px`, side padding 40px (20px at ≤900px). Section padding 150px (100px mobile).
- Radii: cards 20–24px, code blocks 14px, controls and buttons are pills (999px), integration nodes 18px (14px for the inner ring).
- Cards are translucent navy gradients with a 1px `--orb-line` border; the active card gains a cyan border and a cyan underglow.

## 4. Motion tokens

`--orb-out: cubic-bezier(.22, 1, .36, 1)` for every entrance. One `requestAnimationFrame` loop reads `scrollY` and `getBoundingClientRect()` and writes `transform`/`opacity` (plus SVG `stroke-dashoffset` for the spiral). Sections outside the viewport are skipped. Reveals use IntersectionObserver (`[data-rv]`, 34px rise, 0.9s).

## 5. Sections and choreography

1. **Hero, the system (640vh, sticky stage).** Five orbits (rings tilted −14°, ellipse ratio 0.34, 0.52 on phones) each carry a planet: Edge Functions, Realtime Sync, Observability (ringed), Auth & Access, Queues & Cron. Planets orbit at Kepler-like speeds and scale/dim by depth (front vs back of the ellipse). Scroll drives a log-interpolated camera zoom 1× → 11× through keyframes with hold windows at each orbit; the focused ring brightens, outer rings fade as they exceed the viewport, a canvas star field streams toward the viewer (depth-wrapped), and the core scales to fill the screen then fades. A HUD card per orbit crossfades bottom-left, with a zoom readout and progress bar bottom-right. Headline, pill, sub copy and CTAs fade and lift in the first 8% of scroll.
2. **Anatomy.** Left column is sticky: a concentric-ring SVG whose rings spin; the ring matching the feature in view turns solid cyan with a bright planet. Right column: five feature cards (body, bullets, code sample) tracked by IntersectionObserver.
3. **Launch sequence.** A terminal types a deploy session (2 chars / 24ms) when it enters view; four stat tiles count up (ease-out quart, 1.6s) with sparklines that draw their stroke then fade in the fill.
4. **Integrations.** Fourteen tool nodes on two concentric rings rotating in opposite directions; scroll position adds to the angular velocity. Hover or focus a node to read its description in the centre of the ring.
5. **Pricing.** Four plans as concentric rings (Probe innermost). Each ring's arc fills to the plan's quota when it enters view; selecting a ring or a tab lights it, tweens the price in the core, and swaps the plan card. Monthly / yearly segmented control (−20%).
6. **Changelog spiral (480vh, sticky).** An Archimedean spiral (2.7 turns) draws from the newest release on the outside to the oldest at the centre; a glowing comet follows the stroke tip, release nodes light as the stroke reaches them, and the matching card crossfades in.
7. **Touchdown.** Giant closing line over a pulsing, slowly rotating star-ring, a launch-key email form (success state), and a four-column footer.

Navigation: a fixed nav gains a blurred navy background after the first 40% of the viewport; a right-edge depth rail (hidden ≤1100px) shows the current section.

## 6. Responsive and accessibility

- ≤900px: single-column grids, the anatomy diagram shrinks to a sticky 150px header, the hero HUD stacks under the system, the changelog spiral sits above its card.
- Real buttons with `aria-pressed` / `aria-selected`, labelled diagrams (`role="img"`), `aria-live` for the integrations readout, visible focus rings.
- `prefers-reduced-motion`: no pinning (hero is a single static screen with the system at rest), no rotation, no typing, no reveals, spiral fully drawn and every changelog entry listed.
