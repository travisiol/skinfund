import type { Skin, SkinStatus } from "./types.ts";

/** Only skins in the regular store with a listed RP price can be a fund target. */
export function isSelectable(skin: Skin): boolean {
  return skin.status === "available" && skin.rp !== null;
}

export const STATUS_LABEL: Record<SkinStatus, string> = {
  available: "In store",
  legacy: "Legacy vault",
  limited: "Limited",
  rare: "Not sold for RP",
  upcoming: "Upcoming",
};

/** Why a skin cannot be picked, in the player's words. Null when it can. */
export function unavailableReason(skin: Skin): string | null {
  if (isSelectable(skin)) return null;
  if (skin.rp === null) return skin.acquisition ? `Not sold for RP. ${skin.acquisition}` : "Not sold for RP.";
  if (skin.status === "legacy") return "In the Legacy vault: only purchasable when Riot brings it back to the store.";
  if (skin.status === "limited") return "Limited edition: no longer sold.";
  if (skin.status === "upcoming") return "Not released yet.";
  return "Not in the regular store.";
}

export type Availability = "selectable" | "all";
export type PriceBand = "any" | "to975" | "1350" | "1820" | "3250plus";
export type SortKey = "champion" | "price-asc" | "price-desc" | "newest";

export interface CatalogueQuery {
  text: string;
  availability: Availability;
  price: PriceBand;
  sort: SortKey;
}

export const DEFAULT_QUERY: CatalogueQuery = { text: "", availability: "selectable", price: "any", sort: "champion" };

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’.]/g, "")
    .toLowerCase()
    .trim();
}

function inBand(rp: number | null, band: PriceBand): boolean {
  if (band === "any") return true;
  if (rp === null) return false;
  if (band === "to975") return rp <= 975;
  if (band === "1350") return rp > 975 && rp <= 1350;
  if (band === "1820") return rp > 1350 && rp <= 1820;
  return rp > 1820;
}

/** Search by champion or skin name; every word of the query must match. */
export function searchSkins(skins: Skin[], query: CatalogueQuery): Skin[] {
  const words = fold(query.text).split(/\s+/).filter(Boolean);
  const out = skins.filter((skin) => {
    if (query.availability === "selectable" && !isSelectable(skin)) return false;
    if (!inBand(skin.rp, query.price)) return false;
    if (words.length === 0) return true;
    const haystack = fold(`${skin.name} ${skin.champion}`);
    return words.every((word) => haystack.includes(word));
  });
  const byChampion = (a: Skin, b: Skin) => a.champion.localeCompare(b.champion) || a.num - b.num;
  if (query.sort === "champion") return out.sort(byChampion);
  if (query.sort === "newest") return out.sort((a, b) => (b.release ?? "").localeCompare(a.release ?? "") || byChampion(a, b));
  const sign = query.sort === "price-asc" ? 1 : -1;
  // Skins without an RP price always sort last.
  return out.sort((a, b) => {
    if (a.rp === null || b.rp === null) return a.rp === b.rp ? byChampion(a, b) : a.rp === null ? 1 : -1;
    return sign * (a.rp - b.rp) || byChampion(a, b);
  });
}
