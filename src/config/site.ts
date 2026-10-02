/** Brand and asset switches. */
export const SITE = {
  name: "skinfund",
  title: "skinfund — Hold the coin. It buys your skin.",
  description:
    "A token for League of Legends players. A share of actual trading fees fills a personal fund toward a prepaid RP code. No volume, no rewards.",
  disclaimer: "SKINFUND is not affiliated with or endorsed by Riot Games.",
} as const;

/**
 * Skin artwork source.
 *
 * "ddragon" hot-links Riot's Data Dragon CDN with ids verified in the
 * catalogue snapshot. It is OFF unless NEXT_PUBLIC_SKIN_ART=ddragon, because
 * Riot's asset terms have to be cleared first: the developer policy that
 * governs Data Dragon requires product registration and states "No
 * cryptocurrencies, no blockchain". With it off, cards render an explicit
 * "artwork not enabled" plate — never a stand-in image.
 */
export const SKIN_ART: "ddragon" | "none" = process.env.NEXT_PUBLIC_SKIN_ART === "ddragon" ? "ddragon" : "none";

const DDRAGON = "https://ddragon.leagueoflegends.com/cdn/img/champion";

export function skinArt(skin: { key: string; num: number }, kind: "portrait" | "wide"): string | null {
  if (SKIN_ART !== "ddragon") return null;
  return kind === "portrait" ? `${DDRAGON}/loading/${skin.key}_${skin.num}.jpg` : `${DDRAGON}/centered/${skin.key}_${skin.num}.jpg`;
}
