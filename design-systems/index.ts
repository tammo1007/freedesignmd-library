import type { System } from "../types";
import { REDIRECTS } from "./redirects";
import { system as acidChrome } from "./acid-chrome";
import { system as arcadeNight } from "./arcade-night";
import { system as argentMachined } from "./argent-machined";
import { system as atriumFolio } from "./atrium-folio";
import { system as auroraGlass } from "./aurora-glass";
import { system as champagneFoundry } from "./champagne-foundry";
import { system as citrineIde } from "./citrine-ide";
import { system as clinicPearl } from "./clinic-pearl";
import { system as darkTerminal } from "./dark-terminal";
import { system as devshellMono } from "./devshell-mono";
import { system as hotelRiviere } from "./hotel-riviere";
import { system as irisPay } from "./iris-pay";
import { system as linearOrbit } from "./linear-orbit";
import { system as liquidMetal } from "./liquid-metal";
import { system as magazineBold } from "./magazine-bold";
import { system as maisonFolio } from "./maison-folio";
import { system as monolithCli } from "./monolith-cli";
import { system as neoMemphis } from "./neo-memphis";
import { system as nullGrid } from "./null-grid";
import { system as obsidianGlass } from "./obsidian-glass";
import { system as parchmentAtelier } from "./parchment-atelier";
import { system as prismConic } from "./prism-conic";
import { system as risographPress } from "./risograph-press";
import { system as signalAi } from "./signal-ai";
import { system as softLinen } from "./soft-linen";
import { system as stadiumBank } from "./stadium-bank";
import { system as titaniumDeck } from "./titanium-deck";
import { system as tokenMesh } from "./token-mesh";
import { system as wanderstayRentals } from "./wanderstay-rentals";
import { system as warmEditorial } from "./warm-editorial";

/** Pinned to the top of the library, in this order. Everything else follows alphabetically. */
const FEATURED_ORDER = ["acid-chrome", "liquid-metal", "linear-orbit", "magazine-bold", "null-grid", "argent-machined"];

/** The 30 live design systems (explicit imports, also works under bun for the prebuild verifier). */
export const systems: System[] = [
  acidChrome, arcadeNight, argentMachined, atriumFolio, auroraGlass, champagneFoundry, citrineIde, clinicPearl, darkTerminal, devshellMono, hotelRiviere, irisPay, linearOrbit, liquidMetal, magazineBold, maisonFolio, monolithCli, neoMemphis, nullGrid, obsidianGlass, parchmentAtelier, prismConic, risographPress, signalAi, softLinen, stadiumBank, titaniumDeck, tokenMesh, wanderstayRentals, warmEditorial,
].sort((a, b) => {
  const ia = FEATURED_ORDER.indexOf(a.slug);
  const ib = FEATURED_ORDER.indexOf(b.slug);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  return a.name.localeCompare(b.name);
});

export const getSystemBySlug = (slug: string): System | undefined => systems.find((s) => s.slug === slug);

/** Live slug for a removed one (301 target), or undefined. */
export const getRedirectSlug = (slug: string): string | undefined => REDIRECTS[slug];

let _tags: string[] | null = null;
export const getAllTags = (): string[] => {
  if (_tags) return _tags;
  const set = new Set<string>();
  systems.forEach((s) => s.tags.forEach((t) => set.add(t)));
  _tags = Array.from(set).sort();
  return _tags;
};
