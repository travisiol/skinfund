import "server-only";
import type { CatalogueMeta, Skin } from "@/core/types";
import snapshot from "@/data/catalogue.json";

/**
 * Skin catalogue and pricing: a dated snapshot built by
 * scripts/build-catalogue.mjs (names from Data Dragon, RP prices and
 * availability from Meraki Analytics). Server-side only — the browser gets it
 * through /api/catalogue.
 */
const data = snapshot as { meta: CatalogueMeta; skins: Skin[] };
const byId = new Map(data.skins.map((skin) => [skin.id, skin]));

export const CATALOGUE_META = data.meta;
export const allSkins = (): Skin[] => data.skins;
export const skinById = (id: number): Skin | undefined => byId.get(id);

/** The homepage example. Looked up by id so a rename or removal upstream is noticed. */
export const HERO_SKIN_ID = 99007;
