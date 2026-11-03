import type { CategoryMeta, LibraryCategory, LibraryFile, LibraryFileWithCode, LibraryItem } from "./types";

/**
 * Library registry. Every category folder exports `items: LibraryItem[]`
 * from its `index.ts`. Folders are discovered with import.meta.glob so a
 * category can be added without touching this file.
 */
export const CATEGORIES: CategoryMeta[] = [
  { id: "liquid-glass", name: "Liquid Glass", order: 0, blurb: "Apple-style Liquid Glass for the web: real refraction, specular rims and controls that morph." },
  { id: "liquid-metal", name: "Liquid Metal", order: 1, blurb: "Liquid metal shaders in WebGL and CSS: polished chrome that flows like molten metal." },
  { id: "dither", name: "Dither", order: 2, blurb: "Dither effects for images, logos and gradients: ordered and error-diffusion, interactive and GPU-fast." },
  { id: "buttons", name: "Buttons", order: 3, blurb: "React buttons with every state: hover, press, focus and loading. Magnetic, shimmer and pressable styles." },
  { id: "forms", name: "Forms", order: 4, blurb: "React form components: inputs, OTP fields, toggles, sliders and full forms with validation states." },
  { id: "heroes", name: "Heroes", order: 5, blurb: "React hero sections with motion, from fintech to fashion." },
  { id: "tables", name: "Tables", order: 6, blurb: "React data tables that sort and select, in dense or editorial styles." },
  { id: "effects", name: "Scroll & Hover Effects", order: 7, blurb: "Scroll and hover effects: scroll-driven scenes, image ripples, split cards and hover transitions." },
  { id: "text", name: "Text Effects", order: 8, blurb: "Text effects for React: split, morph, repel, scramble and flip." },
  { id: "interactions", name: "Cursors & Interactions", order: 9, blurb: "Custom cursors and interactions: cursor trails, magnetic docks, fisheye walls and 3D carousels." },
  { id: "navbars", name: "Navbars", order: 10, blurb: "React navbars: mega menus, command bars, mastheads and menus that morph." },
  { id: "pricing", name: "Pricing", order: 11, blurb: "Pricing sections for React: plan toggles, calculators, receipts and menus." },
  { id: "features", name: "Feature Sections", order: 12, blurb: "Feature sections: bento grids with live UI, sticky tours, before and after sliders and spec sheets." },
  { id: "testimonials", name: "Testimonials", order: 13, blurb: "Testimonial sections: quote walls, portrait carousels, case study cards and review grids." },
  { id: "footers", name: "Footers", order: 14, blurb: "Footer designs: giant wordmarks, curtain reveals, office clocks and sitemaps." },
];

const modules = import.meta.glob<{ items: LibraryItem[] }>(["./*/index.ts", "!./_*/index.ts"], { eager: true });

export const LIBRARY: LibraryItem[] = Object.values(modules)
  .flatMap((m) => m.items ?? [])
  .sort((a, b) => {
    const ca = CATEGORIES.find((c) => c.id === a.category)?.order ?? 99;
    const cb = CATEGORIES.find((c) => c.id === b.category)?.order ?? 99;
    if (ca !== cb) return ca - cb;
    return Number(!!b.featured) - Number(!!a.featured);
  });

export const getItem = (slug: string) => LIBRARY.find((i) => i.slug === slug);

export const itemsIn = (cat: LibraryCategory) => LIBRARY.filter((i) => i.category === cat);

const rawSources = import.meta.glob<string>("./*/*.tsx", { query: "?raw", import: "default" });

/** Verbatim source of one library file, the same file the demo renders from. Loaded on demand. */
export const loadFileCode = async (f: LibraryFile): Promise<string> => {
  const load = rawSources[`./${f.src}`];
  if (!load) throw new Error(`Missing library source: ${f.src}`);
  return load();
};

export const loadItemFiles = (item: LibraryItem): Promise<LibraryFileWithCode[]> =>
  Promise.all(item.files.map(async (f) => ({ ...f, code: await loadFileCode(f) })));
