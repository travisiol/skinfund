// Builds src/data/catalogue.json — a dated snapshot of League of Legends skins.
//
//   names, champion keys, skin numbers  ←  Riot Data Dragon (championFull.json)
//   RP price, availability, rarity      ←  Meraki Analytics champion data (sourced from the LoL Wiki)
//
// Data Dragon carries no pricing, so the two sources are joined on the skin id.
// A skin missing from either source is dropped rather than guessed.
// Run: npm run catalogue

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DDRAGON = "https://ddragon.leagueoflegends.com";
const MERAKI = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json";

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response.json();
}

const [version] = await json(`${DDRAGON}/api/versions.json`);
const [full, meraki] = await Promise.all([json(`${DDRAGON}/cdn/${version}/data/en_US/championFull.json`), json(MERAKI)]);

const official = new Map();
for (const key of Object.keys(full.data)) {
  const champion = full.data[key];
  for (const skin of champion.skins) official.set(Number(skin.id), { key, champion: champion.name, num: skin.num, name: skin.name });
}

const STATUS = { Available: "available", Legacy: "legacy", Limited: "limited", Rare: "rare", Upcoming: "upcoming" };

const skins = [];
let dropped = 0;
for (const key of Object.keys(meraki)) {
  for (const skin of meraki[key].skins) {
    if (skin.isBase) continue;
    const ref = official.get(skin.id);
    const status = STATUS[skin.availability];
    if (!ref || !status) {
      dropped++;
      continue;
    }
    const rp = typeof skin.cost === "number" ? skin.cost : null;
    skins.push({
      id: skin.id,
      name: ref.name,
      champion: ref.champion,
      key: ref.key,
      num: ref.num,
      rp,
      status,
      // How the skin is obtained when it is not a plain RP purchase.
      acquisition: rp === null ? [skin.cost, skin.distribution].filter(Boolean).join(" — ") : null,
      rarity: skin.rarity && skin.rarity !== "NoRarity" ? skin.rarity : null,
      release: skin.release ?? null,
    });
  }
}
skins.sort((a, b) => a.champion.localeCompare(b.champion) || a.num - b.num);

const out = {
  meta: {
    generatedAt: new Date().toISOString(),
    dataDragonVersion: version,
    nameSource: "Riot Data Dragon",
    pricingSource: "Meraki Analytics champion data (LoL Wiki)",
    pricingUrl: MERAKI,
    count: skins.length,
    dropped,
  },
  skins,
};

const target = fileURLToPath(new URL("../src/data/catalogue.json", import.meta.url));
writeFileSync(target, JSON.stringify(out));
console.log(`catalogue: ${skins.length} skins (Data Dragon ${version}), ${dropped} dropped → ${target}`);
