# freedesignmd library — build conventions

Every library item must look *exactly* the same after a user copies it into a
fresh React project. That is the product. These rules exist to guarantee it.

## 1 · The copy contract

- One item = one standalone `.tsx` file (occasionally 2–3 files, e.g. a shared
  `liquid-glass.tsx` primitive + a component that imports it via a relative path
  that matches `LibraryFile.path`).
- The file the site renders **is** the file people copy. In the category
  `index.ts`, import code with `?raw`:
  ```ts
  import { Demo as GlassButtonDemo } from "./GlassButton";
  import glassButtonCode from "./GlassButton.tsx?raw";
  ```
  Never hand-write or truncate code strings.
- Allowed imports: `react` only. No Tailwind, no shadcn, no lucide, no
  framer-motion, no three.js, no `@/` aliases. Icons are inline SVG.
  (If an item truly needs a package, list it in `dependencies` — avoid it.)
- Each file exports the component(s) **and** `export function Demo()`.
  The Demo is part of the copied file and doubles as usage documentation, so
  write it like a polished real screen, not a test harness.
- File header: a short JSDoc block — what it is, props, browser support,
  accessibility notes. No marketing.

## 2 · Styling

- Plain CSS in a template string at the bottom or top of the file:
  `const css = \`...\`` rendered as `<style>{css}</style>` **once**, inside the
  outermost element the component renders (for compound/list components, the
  parent renders it; children don't).
- Every class is prefixed `fd-<short-slug>-` (e.g. `fd-gbtn-label`) so nothing
  collides with the host app. Never style bare tags or `body` (Demo wrappers
  may style their own root class).
- Expose customization as CSS custom properties on the root
  (`--fd-gbtn-tint`, `--fd-gbtn-radius`) and as typed props.
- Units: px for borders/shadows, rem only for font sizes. Use `clamp()` for
  fluid hero type.
- Must render correctly in both light and dark host pages: components carry
  their own colors; never inherit `color`/`background` unknowingly.

### 2b · Reset-independence (critical for the copy contract)

Users paste into projects with Tailwind preflight, with Bootstrap, or with no
reset at all (browser defaults: h1 = 2em bold with margins, buttons with grey
bevels, `box-sizing: content-box`, `p` margins…). Therefore on EVERY element
you render, set explicitly whatever you depend on: `margin`, `padding`,
`font: <weight> <size>/<line-height> <family>`, `letter-spacing`, `color`,
`background`, `border`, `box-sizing: border-box` (put
`.fd-x, .fd-x *, .fd-x *::before, .fd-x *::after { box-sizing: border-box }`
on your root), `appearance: none` on buttons/inputs, `list-style` on lists,
`text-decoration` on links, `display: block` on svg/canvas/img. Never rely on
inherited site styles or resets. The site itself will stop styling bare tags.

The component ROOT must declare `font` with an explicit line-height, so inline /
inline-flex children sit on a deterministic line box. Tailwind preflight sets
line-height 1.5 and browsers default to `normal`; the copy-test catches the shift.

## 3 · SSR & runtime safety (site uses TanStack Start SSR)

- No `window`, `document`, `navigator`, `matchMedia`, canvas or WebGL access at
  module scope or during render. Do it in `useEffect`/`useLayoutEffect`.
- `useId()` for SVG filter ids — never hard-coded ids (two instances = clash).
- Clean up every listener, rAF loop, ResizeObserver, IntersectionObserver and
  WebGL context in effect cleanups. Pause rAF loops when off-screen
  (IntersectionObserver) and when `document.hidden`.
- WebGL: WebGL2 with WebGL1 fallback where cheap; if no context, render a
  static CSS fallback that still looks designed. Cap DPR at 2.
- No network fetches. No external images. Backdrops are procedural
  (CSS gradients, SVG, canvas) or the user passes `src`.

## 4 · Motion — one language across the whole library

Use these and only these curves/durations (declare as CSS vars in the file):

| token | value | use |
|---|---|---|
| `--fd-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | entrances, reveals |
| `--fd-ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | state swaps |
| `--fd-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | press release, knob snaps (overshoot) |
| `--fd-dur-1` | `120ms` | hover tint, press-in |
| `--fd-dur-2` | `240ms` | toggles, small moves |
| `--fd-dur-3` | `420ms` | panels, morphs |
| `--fd-dur-4` | `700ms` | hero reveals, scroll scenes |

- Physics-y motion (drag, morph, magnetic, velocity stretch) uses a small
  in-file spring integrator in rAF (stiffness ~ 380, damping ~ 30, mass 1),
  not CSS keyframes.
- Press: scale to `0.96` over `--fd-dur-1`, release with `--fd-spring`.
- Scroll effects: IntersectionObserver + rAF reading `getBoundingClientRect()`,
  transform/opacity only (never animate layout properties).
- `@media (prefers-reduced-motion: reduce)`: remove parallax, wobble, morph
  stretch and auto-play; keep instant state changes and opacity fades ≤ 120ms.
  In JS check `matchMedia('(prefers-reduced-motion: reduce)')` inside effects.

## 5 · Type, color, shape — shared defaults

- Font stack (no web font downloads in components):
  `ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif`;
  display text may use `"SF Pro Display"` first. Mono: `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`.
- Type scale (px): 12 / 13 / 15 / 17 / 20 / 24 / 32 / 44 / 64 / 88.
  Tracking: −0.01em at 17+, −0.025em at 32+, −0.04em at 64+.
- Radii follow concentric math: `inner = outer − padding`. Capsules for
  controls (`9999px`). Containers 20–28px. Never mix arbitrary radii.
- Neutrals: ink `#0B0B0F`, graphite `#1C1C22`, slate `#6B6B76`, mist
  `#E7E7EC`, paper `#F7F7F9`, white. System accent default: `#0A84FF`
  (dark) / `#007AFF` (light). Items may define their own palette when the
  look demands it (metal, dither), but text contrast must pass WCAG AA.
- Focus: visible `:focus-visible` ring, 2px, offset 2px, accent at 70%.

## 6 · Accessibility

- Real elements: `<button>`, `<input>`, `<label>`, `role="switch"`,
  `aria-pressed`, `aria-checked`, `aria-sort`, etc. Keyboard works everywhere.
- Icon-only controls have `aria-label`.
- `@media (prefers-reduced-transparency: reduce)` → opaque surfaces.
  `@media (prefers-contrast: more)` → opaque surfaces + 1px solid border.
- Decorative canvases: `aria-hidden="true"`.

## 7 · Demo content — placeholder data from real industries

Every Demo shows a believable product moment from a named industry
(set `industry` on the item). Mix across the library: fintech, healthcare,
travel/hospitality, fashion/retail, music/media, developer tools, climate/
energy, real estate, automotive, food & beverage, education, logistics,
biotech, sports. Use realistic names, numbers, dates and copy — never
"Lorem ipsum", never "Button 1", never "John Doe". Keep company names fictional.

## 8 · Quality bar (self-check before finishing)

- Screenshot your demo at 1440×900 and 390×844 via
  `python3 <scratchpad>/shot.py http://127.0.0.1:<port>/lab/<category>/<slug> out.png 1440 900 2500`
  and LOOK at it. Iterate until it looks like it belongs on apple.com or
  linear.app. Check hover/press states by scripting pointer events if needed.
- No console errors. `bunx tsc --noEmit -p .` shows no errors in your files.
- The copied file works alone: it imports only `react` (and sibling files it
  lists in `files`).
