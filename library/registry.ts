import type { CategoryMeta, LibraryCategory, LibraryFile, LibraryFileWithCode, LibraryItem } from "./types";

/**
 * Library registry. Every category folder exports `items: LibraryItem[]`
 * from its `index.ts`. Folders are discovered with import.meta.glob so a
 * category can be added without touching this file.
 */
export const CATEGORIES: CategoryMeta[] = [
  { id: "liquid-glass", name: "Liquid Glass", order: 0, blurb: "Real refraction, specular rims and morphing — the material from Apple's HIG, rebuilt for the web." },
  { id: "liquid-metal", name: "Liquid Metal", order: 1, blurb: "Chrome that flows. WebGL shaders and CSS that read as polished, molten metal." },
  { id: "dither", name: "Dither", order: 2, blurb: "Ordered and error-diffusion dithering for images, logos and gradients — interactive, GPU-fast." },
  { id: "buttons", name: "Buttons", order: 3, blurb: "Pressable, magnetic, shimmering. Every state designed: hover, press, focus, loading." },
  { id: "forms", name: "Forms", order: 4, blurb: "Inputs, OTP, toggles, sliders and full forms with real validation states." },
  { id: "heroes", name: "Heroes", order: 5, blurb: "Above-the-fold sections with motion, from fintech to fashion." },
  { id: "tables", name: "Tables", order: 6, blurb: "Data tables that sort, select and breathe — dense or editorial." },
  { id: "effects", name: "Scroll & Hover Effects", order: 7, blurb: "Scroll-driven scenes, image ripples, split cards and hover transitions." },
  { id: "text", name: "Text Effects", order: 8, blurb: "Split, morph, repel, scramble and flip — typography that moves with intent." },
  { id: "interactions", name: "Cursors & Interactions", order: 9, blurb: "Cursor trails, magnetic docks, fisheye walls and 3D carousels." },
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

/** Verbatim source of one library file — the same file the demo renders from. Loaded on demand. */
export const loadFileCode = async (f: LibraryFile): Promise<string> => {
  const load = rawSources[`./${f.src}`];
  if (!load) throw new Error(`Missing library source: ${f.src}`);
  return load();
};

export const loadItemFiles = (item: LibraryItem): Promise<LibraryFileWithCode[]> =>
  Promise.all(item.files.map(async (f) => ({ ...f, code: await loadFileCode(f) })));
