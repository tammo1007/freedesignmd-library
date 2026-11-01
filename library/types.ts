import type { LazyDemo } from "./lazyDemo";

/**
 * Library item — one copy-pasteable component (or a small set of files).
 *
 * THE CONTRACT: `files[].code` is imported with Vite's `?raw` suffix from the
 * very same `.tsx` file whose `Demo` export renders on the site. What people
 * see is what they copy, byte for byte. Never hand-write a `code` string.
 */
export type LibraryCategory =
  | "liquid-glass"
  | "liquid-metal"
  | "dither"
  | "buttons"
  | "forms"
  | "heroes"
  | "tables"
  | "effects"
  | "text"
  | "interactions";

export type LibraryFile = {
  /** Suggested path inside the user's project, e.g. "components/liquid-glass/glass-button.tsx". */
  path: string;
  /** Source file under src/library, e.g. "buttons/ButtonCore.tsx". Loaded verbatim via `?raw` on demand (see loadFileCode). */
  src: string;
};

export type LibraryFileWithCode = LibraryFile & { code: string };

export type LibraryItem = {
  slug: string;
  name: string;
  category: LibraryCategory;
  /** One sentence, < 140 chars. Shown on cards and as meta description. */
  description: string;
  /** Search / filter tags. */
  tags: string[];
  /** Industry the placeholder content is drawn from (shown as a chip). */
  industry?: string;
  /** npm packages the files need besides react/react-dom. Prefer []. */
  dependencies: string[];
  /** Files in install order. The first file holds the main export. */
  files: LibraryFile[];
  /** Live demo — must be exported from files[0] (or another listed file). */
  Demo: LazyDemo;
  /** Preferred canvas for the demo: "light" | "dark" | "media" (rich photo backdrop). */
  canvas?: "light" | "dark" | "media";
  /** Minimum demo height in px on the detail page. Default 520. */
  height?: number;
  /** Browser support notes, e.g. "Refraction: Chromium. Safari/Firefox fall back to frosted blur." */
  support?: string;
  /** Promote to the top of its category. */
  featured?: boolean;
};

export type CategoryMeta = {
  id: LibraryCategory;
  name: string;
  blurb: string;
  order: number;
};
