<div align="center">

# freedesignmd

### The free design library for the AI era.

Copy-paste **React components**, complete **landing pages** and **DESIGN.md design systems** for AI coding agents.
Built for Claude Code, Cursor, Lovable, v0, Bolt, Windsurf and Codex. MIT licensed. No ads, no paywall, no sign-up.

[**Live library**](https://freedesignmd.com) ·
[**Components**](https://freedesignmd.com/components) ·
[**Design systems**](https://freedesignmd.com/systems) ·
[**Landing pages**](https://freedesignmd.com/landingpages) ·
[**Design lexicon**](https://freedesignmd.com/lexicon)

![License: MIT](https://img.shields.io/badge/license-MIT-black)
![Components](https://img.shields.io/badge/components-107-black)
![DESIGN.md systems](https://img.shields.io/badge/DESIGN.md%20systems-31-black)
![Landing pages](https://img.shields.io/badge/landing%20pages-12-black)
![React](https://img.shields.io/badge/React-19-black)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-black)

**If this saves you time, please [star the repo](https://github.com/tammo1007/freedesignmd-library). It takes two seconds and helps other builders find it.**

</div>

---

## Featured design system: Liquid Glass

Apple-like Liquid Glass for landing pages **and** dashboards: 48 React components, a product type scale for dense UIs, scroll showpieces, DESIGN.md, AGENTS.md, an audit script and an agent skill. Made by [Tammo Elsner](https://www.linkedin.com/in/tammo-elsner-682998186/).

[**Repo: tammo1007/liquid-glass-design-system**](https://github.com/tammo1007/liquid-glass-design-system) · [**Preview and DESIGN.md**](https://freedesignmd.com/system/liquid-glass-design-system) · source in [`design-systems/liquid-glass-design-system.ts`](design-systems/liquid-glass-design-system.ts)

---

## Why

AI coding tools build fast, but the result often looks generic. freedesignmd gives your agent three things it can follow exactly:

1. **Components** that are one file each, with `react` as the only import. Paste, done.
2. **DESIGN.md systems**: tokens, type, motion and component rules written so an agent can obey them.
3. **Landing pages**: complete single-file pages, each with its own `DESIGN.md`, to start from or to learn from.

Every component installs **byte-identical** to the live preview on [freedesignmd.com](https://freedesignmd.com). What you see is what you copy.

## Quick start

**Install a component with the shadcn CLI**

```bash
npx shadcn@latest add https://freedesignmd.com/r/glass-button.json
```

**Or copy it by hand.** Open any component on [freedesignmd.com/components](https://freedesignmd.com/components), press Copy, paste into your project.

**Give your agent a design system**

1. Pick a system on [freedesignmd.com/systems](https://freedesignmd.com/systems) and download its `DESIGN.md`.
2. Save it in the root of your repo.
3. Add one line to `CLAUDE.md`, `AGENTS.md`, `.cursorrules` or your Lovable knowledge:

```md
Follow DESIGN.md for all UI. Use its tokens, type scale, spacing and motion rules.
```

That is it. Your agent now builds in a consistent, intentional style.

## What is inside

| Folder | What it is |
| --- | --- |
| [`library/`](library) | 107 copy-paste React components in 15 families. One file each. |
| [`design-systems/`](design-systems) | 31 `DESIGN.md` systems with tokens, type, motion and components. |
| [`landingpages/`](landingpages) | 12 complete landing pages, each with its own `DESIGN.md`. |
| [`public/img/`](public/img) | Demo photography used by the examples. Swap in your own. |

### Components (107)

| Family | Count | What you get |
| --- | :-: | --- |
| Liquid Glass | 9 | Apple-style Liquid Glass for the web: real refraction, specular rims and controls that morph. |
| Liquid Metal | 4 | Liquid metal shaders in WebGL and CSS: polished chrome that flows like molten metal. |
| Dither | 4 | Dither effects for images, logos and gradients: ordered and error-diffusion, interactive and GPU-fast. |
| Buttons | 8 | React buttons with every state: hover, press, focus and loading. Magnetic, shimmer and pressable styles. |
| Forms | 7 | React form components: inputs, OTP fields, toggles, sliders and full forms with validation states. |
| Heroes | 15 | React hero sections with motion, from fintech to fashion. |
| Tables | 5 | React data tables that sort and select, in dense or editorial styles. |
| Scroll & Hover Effects | 10 | Scroll and hover effects: scroll-driven scenes, image ripples, split cards and hover transitions. |
| Text Effects | 7 | Text effects for React: split, morph, repel, scramble and flip. |
| Cursors & Interactions | 4 | Custom cursors and interactions: cursor trails, magnetic docks, fisheye walls and 3D carousels. |
| Navbars | 8 | React navbars: mega menus, command bars, mastheads and menus that morph. |
| Pricing | 7 | Pricing sections for React: plan toggles, calculators, receipts and menus. |
| Feature Sections | 7 | Feature sections: bento grids with live UI, sticky tours, before and after sliders and spec sheets. |
| Testimonials | 6 | Testimonial sections: quote walls, portrait carousels, case study cards and review grids. |
| Footers | 6 | Footer designs: giant wordmarks, curtain reveals, office clocks and sitemaps. |

### Landing pages (12)

Arcade OS, Ares, Atelier Nord, Clara, Forge, Halcyon, Kiln, Noir, Prism, Selene, Terra and Vault. Each one is a single file with its own `DESIGN.md`, covering space, hospitality, climate, health, fintech, developer tools, fashion, fragrance, glass UI, ceramics and gaming.

### Design systems (31)

Aesthetics from Liquid Glass and Liquid Metal to Risograph, Neo Memphis, Magazine Bold, Soft Linen, Obsidian Glass, Acid Chrome, Parchment Atelier, Titanium Deck and Null Grid. Industries include fintech, health, travel, developer tools, hospitality, fashion and AI products. Each system ships light and dark, WCAG AA verified colors and a ready to paste agent prompt.

Browse them all: [freedesignmd.com/systems](https://freedesignmd.com/systems)

## Works with

Claude Code, Cursor, Lovable, v0, Bolt, Windsurf, Codex, GitHub Copilot, Replit and any agent that reads a `DESIGN.md`, `AGENTS.md` or rules file.

Stack: React 19, TypeScript, Tailwind CSS compatible, shadcn registry compatible. Components use plain React and CSS, so they drop into Next.js, Vite, Remix, TanStack Start and Astro.

## Design lexicon

Not sure what to call that layout or style? The [design lexicon](https://freedesignmd.com/lexicon) explains terms such as blueprint grids, glassmorphism, bento grids, segmented controls and more, with mini previews, so you can prompt your AI tool with the right words.

## FAQ

**What is a DESIGN.md?**
A markdown file that describes a visual system (colors, type, spacing, motion, component rules) in a form AI coding agents can follow. Think of it as a style guide written for machines.

**Is it really free?**
Yes. MIT license, no sign-up, no paywall. Use it in personal and commercial projects.

**Do I need to credit you?**
No. A star on GitHub is appreciated but optional.

**Does the code match the preview?**
Yes. Every component is tested against the live preview, and the library items import only `react`.

**Can I contribute?**
Absolutely. See below.

## Contributing

Ideas, bug reports and feedback are welcome.

- Found a bug or want a component? [Open an issue](../../issues).
- Want to talk design or share what you built? [Start a discussion](../../discussions).
- Know a design trend that is missing from the lexicon? Tell us in a discussion.

This repository is a read-only mirror of the library, kept in sync automatically from the project behind [freedesignmd.com](https://freedesignmd.com). Pull requests are not merged here directly, but every suggestion is read and many end up in the next release.

## Keywords

free react components, copy paste ui components, design system, DESIGN.md, AGENTS.md, AI design system, design tokens, landing page templates, vibe coding, Claude Code, Cursor, Lovable, v0, Bolt, shadcn registry, liquid glass, glassmorphism, liquid metal shader, WebGL, dither effect, bento grid, tailwind, UI kit, open source design library.

## License

[MIT](LICENSE) © 2026 Tammo Elsner. Demo photography in `public/img` is included for the examples. Replace it with your own images in production.

---

<div align="center">

**Made with care by [Tammo](https://freedesignmd.com/about). If freedesignmd helps you, a ⭐ makes my day.**

[Star on GitHub](https://github.com/tammo1007/freedesignmd-library) · [Open the library](https://freedesignmd.com)

</div>
