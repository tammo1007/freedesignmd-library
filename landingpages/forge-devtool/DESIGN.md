# Forge — Design Brief

A dark developer-tool landing page in the Geist tradition: near-black canvas,
1px hairlines, pill buttons, sans + mono, and exactly one accent — ember
`#ff6b2c` — reserved for "Forge is doing something" (the prompt, the timeline
glow, running jobs, the review bot, the hot plan). Everything else is
greyscale.

Source of truth: `Page.tsx` in this folder.

---

## 1. Principles

1. **Hairlines over fills.** Cards are `#0a0a0a` / `#0f0f10` with a
   `rgba(255,255,255,0.08–0.14)` 1px border. Grids (logos, bento,
   integrations) are built with `gap: 1px` over a hairline-colored background,
   so the lines are the layout.
2. **One accent, with meaning.** Ember marks activity and Forge's own voice.
   Diff green `#3fb950` and red `#f2555a` appear only inside code.
3. **Two-tone headlines.** Every H2 is a white line followed by a muted line
   (`#8a8a8a`): "From push to prod, / one minute twenty-eight."
4. **Real artifacts, not illustrations.** A terminal, a diff, a Gantt chart
   and a merge timeline carry the story. Copy uses believable numbers
   (214 of 9,812 tests, 1m 28s, 96.4% cache hits).
5. **Motion is a demo.** Every animation shows the product working: typing,
   reviewing, running, drawing.

---

## 2. Tokens

```css
--fd-frg-bg:          #0a0a0a;   /* page */
--fd-frg-bg-2:        #0f0f10;   /* alt sections, recessed panels */
--fd-frg-surface:     #141415;   /* comments, stacked PR rows */
--fd-frg-surface-2:   #1b1b1d;   /* hover, tracks, chips */
--fd-frg-fg:          #ededed;   /* primary text, primary button */
--fd-frg-mute:        #a1a1a1;   /* body copy (AA on bg) */
--fd-frg-dim:         #8a8a8a;   /* second headline line, meta (AA on bg) */
--fd-frg-line:        rgba(255,255,255,0.08);
--fd-frg-line-2:      rgba(255,255,255,0.14);
--fd-frg-accent:      #ff6b2c;
--fd-frg-accent-soft: rgba(255,107,44,0.12);
--fd-frg-add:         #3fb950;
--fd-frg-del:         #f2555a;
```

Motion tokens: `--fd-ease-out (0.22,1,0.36,1)`, `--fd-ease-in-out
(0.65,0,0.35,1)`, `--fd-spring (0.34,1.56,0.64,1)`, durations 120 / 240 / 420 /
700ms.

---

## 3. Type

| Role | Spec |
|---|---|
| Sans | `"Geist", -apple-system, "SF Pro Text", "Inter", …` (falls back cleanly without Geist installed) |
| Mono | `"Geist Mono", ui-monospace, "SF Mono", "JetBrains Mono", …` |
| H1 | 600, `clamp(3rem, 8vw, 6.5rem)`/0.96, −0.055em, centered, second line dim |
| H2 | 600, `clamp(2rem, 4.2vw, 3.25rem)`/1.04, −0.04em, two-tone |
| Eyebrow | mono 500 0.8125rem, accent, numbered `01 · Anatomy of a merge` |
| Body | 400 1.0625rem/1.55, mute |
| Big clock | 600 `clamp(3.5rem, 9vw, 7.5rem)`, −0.06em, tabular |

---

## 4. Layout

- Container 1200px, 32px gutters (20px ≤ 720px).
- Sections: Nav · Hero (centered, terminal) · Logos (8-cell hairline row) ·
  Timeline (sticky heading left, steps right) · Auto-review diff ·
  Speed (sticky, 320vh) · Bento (3 columns, two wide tiles) · Integrations
  (4×3 hairline grid) · Proof (stat row + quote) · Pricing (3 plans) · CTA ·
  Footer.
- Section padding 128px (88px ≤ 720px); every section has a top hairline;
  `bg-2` alternates for Review and Integrations.
- Breakpoints: 1000 (burger nav, single-column timeline, stacked diff),
  720 (mobile).

---

## 5. Components

- **Button**: pill, 44px, white fill / black text; `ghost` = hairline border.
  Press `scale(0.96)`, arrow nudges on the spring.
- **Copy command**: pill with `$` prompt in accent and an inline Copy chip
  (writes to the clipboard).
- **Terminal**: 14px radius, dark gradient, traffic-light dots, a Replay
  button, fixed 320px body so typing never shifts layout.
- **Timeline step**: node dot (fills accent + 5px soft ring when reached),
  mono timestamp, title, body, a meta chip / meter / avatar stack.
- **Diff**: grid columns old# / new# / sign / code; add/del tinted rows; a
  side column of review comments (bot avatar in accent-soft, human comment
  dashed).
- **Gantt row**: name with state dot, track with 15s gridlines, bar whose
  fill is `scaleX(--f)`; done bars turn light grey.
- **Integration cell**: icon, name, one-line purpose; the grid's 1px gaps are
  lit by a cursor-following radial gradient.
- **Seat calculator**: native range input restyled (accent track fill via
  `--pct`), live total = seats × per-seat price.

---

## 6. Motion choreography

| Where | What | How |
|---|---|---|
| Hero | Blur-up entrance | `opacity 0, translateY(16px), blur(6px) → none`, 1000ms, staggered |
| Terminal | Typing | command typed 28–74ms per char, then output lines appear with per-line pauses; ends on a summary line and a blinking caret. Replay restarts it |
| Nav | Condense | 64 → 54px, 78% black + blur(14px) + hairline after 12px |
| Timeline | Line draws on scroll | `--draw = (0.62·vh − top) / height`; rail `scaleY(--draw)` with ember glow; each step lights when the line passes its node |
| Diff | Auto-review | on view: a scan highlight sweeps lines (70ms stagger), then comments pop in at 1.5s / 2.6s / 3.5s (opacity + translate + spring scale); "Commit suggestion" rewrites line 46 in place |
| Speed | Scrubbed pipeline | p = −top / (height − vh) maps to t = p × 88s; each job's fill `--f = (t − start) / dur`; a playhead and two clocks (Forge vs. 14:12 legacy CI) follow p |
| Integrations | Spotlight | pointermove (rAF-throttled) sets `--mx/--my` on the grid (lights the hairlines) and on each cell (soft inner glow) |
| Pricing | Toggle | white thumb slides on the spring |
| Blocks | Reveal | `[data-reveal]` → `data-in`, 700/900ms, stagger `--i × 70ms` |

---

## 7. Accessibility and fallbacks

- Terminal output is `aria-hidden`; a polite live region announces the final
  result. The diff uses table roles.
- `prefers-reduced-motion`: no typing (full log shown), comments appear
  instantly, the speed scene is unpinned and shows the finished pipeline,
  no keyframes.
- `prefers-contrast: more`: lighter mute/dim, stronger hairlines.
- Focus ring: 2px ember at 70%, offset 2px.

---

## 8. Do / don't

- Do keep ember for activity only; a static decoration in ember is a bug.
- Do write every H2 as white line + dim line.
- Don't add shadows to cards (the terminal and hot plan are the only glows).
- Don't use more than one accent; status colors stay inside code.

## Assets
Reviewer avatars (approval step, review comment, quote): Placeholder portraits live in `public/img/people/` (`p1.webp` to `p9.webp`, 328×328). Copy the folder next to the page so root-relative `/img/people/...` URLs resolve, or swap in your own photos. They are lazy-loaded and cropped with `object-fit: cover; object-position: center top`.
