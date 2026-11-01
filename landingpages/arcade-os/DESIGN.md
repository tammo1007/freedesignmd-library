# Arcade OS — design brief

Indie game-studio landing page rendered as a 1996-style desktop OS. Aesthetic: **Retro OS Pixel**. Single file `Page.tsx` (react only), scoped CSS prefix `ao-`.

## Tokens (CSS custom properties on `.ao`)
| Token | Value | Use |
|---|---|---|
| `--ink` | `#1b1230` | borders, hard shadows, text |
| `--cream` / `--cream2` | `#f4ecd0` / `#e2d6a8` | window faces, bars |
| `--lt` / `--sh` | `#fffbe8` / `#b8aa7a` | bevel highlight / shade |
| `--teal` / `--dteal` | `#2a9d9d` / `#0e4f55` | desktop wallpaper, page background |
| `--mag` | `#e0338f` | focused title bars, primary buttons, snake |
| `--yel` | `#ffd23f` | accents, terminal prompt, toggles |
| `--mono` | ui-monospace, SF Mono, Menlo, Consolas | body, 13px / 1.45 |
| `--px` | "Press Start 2P", "Silkscreen", then mono | titles, HUD, 9-16px, bold |

Extra: terminal `#0b2b30` with `#9ff3d0` text; boot screen `#05080c`; shutdown footer black with `#ff9d2e`.

## Shape and spacing
- No radii. Bevel = 2px ink border + inset 2px light top-left and 2px shade bottom-right, plus a 4px hard offset shadow (`.ao-bev`). Sunken fields (`.ao-inset`) invert the inset.
- Title bars 28px, striped magenta when focused, grey `#8d8a7a` otherwise. Buttons 30px min height. Window padding 14px. Section wrap 1120px max, 40px gaps.
- Pixel-art icons are drawn from 12x12 string grids (`ICONS`) rendered as merged SVG rects with `shape-rendering: crispEdges`.

## Windows (hero)
Boot overlay (6 BIOS lines, 20-block progress bar, click/any key to skip) then a stage of 100vh with dithered teal wallpaper, drifting pixel clouds, a big dim "NEON CELLAR" wordmark and a left icon column. Windows: About, Games (folder + preview pane), Trailer (canvas, 4 scenes, scrubber), Devlog (terminal with `help ls log games snake wishlist clear whoami sudo`), Tail Train (Snake, arrows/WASD/space plus on-screen d-pad), Wishlist (form with a fake save progress). Drag by title bar (pointer capture, clamped to stage), click raises (z counter), double-click title or `_` minimises, `x` closes; taskbar buttons and Start menu reopen. Position uses `transform: translate3d`. Below 760px windows stack in normal flow, drag is off, trailer/devlog/snake start minimised.

## Taskbar
Fixed bottom, 42px: Start menu, one button per open window (focused one pressed), CRT and GLOW toggles (`aria-pressed`), live `HH:MM:SS` clock.

## Sections below the desktop
1. Press ticker (linear marquee, duplicated list).
2. ROADMAP.EXE — 20-block segmented bars that fill block by block (staggered `transition-delay`) when in view.
3. HISCORES.TXT — count-up scores quantised to 24 steps; your best Snake score x100 is inserted as a blinking "YOU" row.
4. CREW.DAT — 8x8 procedural pixel portraits with stepped blink.
5. SYSTEM ALERTS — three tilted dialog boxes that pop in with `steps(3)`.
6. Shutdown footer with "Reboot to desktop" (replays the boot).

## Motion
All easing is `steps()` or canvas-driven to feel 8-bit: boot lines and caret, window pop (clip-path steps), cloud drift, ticker, flicker on the CRT overlay (`.crt::after`: scanlines + vignette), phosphor glow via text-shadow, canvas trailer (rAF, paused when minimised), Snake (setInterval 115ms, paused when hidden), reveal on scroll via IntersectionObserver. `prefers-reduced-motion`: boot skipped, ambient animation off, reveals visible.

## Do / don't
Keep the palette limited to the tokens above; no gradients except hard-stop stripes and the CRT overlay; no blur, no radii; the only images are the crew portraits.

## Assets
Crew portraits (CREW.DAT) use Placeholder portraits live in `public/img/people/` (`p1.webp` to `p9.webp`, 328×328). Copy the folder next to the page so root-relative `/img/people/...` URLs resolve, or swap in your own photos. They are lazy-loaded and cropped with `object-fit: cover; object-position: center top`.
