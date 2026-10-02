import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { DEFAULT_QUERY, isSelectable, searchSkins, unavailableReason } from "../src/core/catalogue.ts";
import { estimateRp, fundingTarget, planPurchase, progress } from "../src/core/funding.ts";
import { Ledger, LedgerError } from "../src/core/ledger.ts";
import type { ClaimPorts } from "../src/core/ledger.ts";
import type { Denomination, Money, Region, Skin } from "../src/core/types.ts";

const catalogue = JSON.parse(readFileSync(new URL("../src/data/catalogue.json", import.meta.url), "utf8")) as { skins: Skin[] };
const skinOf = (id: number) => catalogue.skins.find((s) => s.id === id);
const LUX = skinOf(99007)!;

const usd = (minor: number): Money => ({ minor, currency: "USD" });
const d = (rp: number, cents: number): Denomination => ({ id: `rp-${rp}`, rp, cost: usd(cents) });
// Test fixtures only — not a real provider's price list.
const DENOMS = [d(1000, 1000), d(2000, 1900), d(5000, 4500)];
const REGION: Region = { code: "T1", label: "Test region", compatibility: "test", denominations: DENOMS };

// ───────────────────────────── catalogue

test("the catalogue snapshot holds Elementalist Lux as Lux skin 7 at 3,250 RP", () => {
  assert.equal(LUX.name, "Elementalist Lux");
  assert.equal(LUX.champion, "Lux");
  assert.equal(LUX.key, "Lux");
  assert.equal(LUX.num, 7);
  assert.equal(LUX.rp, 3250);
  assert.ok(isSelectable(LUX));
});

test("search matches champion or skin name, ignoring case, accents and apostrophes", () => {
  const find = (text: string) => searchSkins(catalogue.skins, { ...DEFAULT_QUERY, availability: "all", text });
  assert.ok(find("elementalist lux").some((s) => s.id === 99007));
  assert.ok(find("LUX").every((s) => /lux/i.test(`${s.name} ${s.champion}`)));
  assert.ok(find("kaisa").some((s) => s.champion === "Kai'Sa"));
  assert.equal(find("zzzz-not-a-skin").length, 0);
});

test("the default view only offers skins sold for RP in the store", () => {
  const shown = searchSkins(catalogue.skins, DEFAULT_QUERY);
  assert.ok(shown.length > 500);
  assert.ok(shown.every(isSelectable));
  const hidden = catalogue.skins.filter((s) => !isSelectable(s));
  assert.ok(hidden.length > 0);
  assert.ok(hidden.every((s) => typeof unavailableReason(s) === "string"));
});

test("price sort keeps skins without an RP price last", () => {
  const sorted = searchSkins(catalogue.skins, { ...DEFAULT_QUERY, availability: "all", sort: "price-desc" });
  const firstNull = sorted.findIndex((s) => s.rp === null);
  assert.ok(sorted.slice(firstNull).every((s) => s.rp === null));
  assert.ok(sorted[0].rp! >= sorted[1].rp!);
});

// ───────────────────────────── funding

test("a plan covers the target with fixed denominations, never an exact custom amount", () => {
  const plan = planPurchase(3250, DENOMS)!;
  // 2000 + 2000 = $38 beats 5000 = $45 and 2000+1000+1000 = $39.
  assert.deepEqual(plan.items.map((i) => [i.denomination.rp, i.quantity]), [[2000, 2]]);
  assert.equal(plan.totalRp, 4000);
  assert.equal(plan.surplusRp, 750);
  assert.equal(plan.cost.minor, 3800);
});

test("the plan picks one larger code when it is cheaper than several small ones", () => {
  const plan = planPurchase(4500, DENOMS)!;
  assert.deepEqual(plan.items.map((i) => [i.denomination.rp, i.quantity]), [[5000, 1]]);
});

test("no denominations means no plan; a bad target is rejected", () => {
  assert.equal(planPurchase(1350, []), null);
  assert.throws(() => planPurchase(0, DENOMS));
  assert.throws(() => planPurchase(1350, [d(1000, 1000), { id: "x", rp: 500, cost: { minor: 500, currency: "EUR" } }]));
});

test("the threshold adds known costs, and progress never shows 100% early", () => {
  const target = fundingTarget(planPurchase(3250, DENOMS)!, [{ label: "Provider fee", amount: usd(150) }]);
  assert.equal(target.threshold.minor, 3950);
  const almost = progress(usd(3949), target.threshold);
  assert.equal(almost.percent, 99);
  assert.equal(almost.funded, false);
  assert.equal(almost.remaining.minor, 1);
  const done = progress(usd(5000), target.threshold);
  assert.equal(done.percent, 100);
  assert.equal(done.remaining.minor, 0);
  assert.equal(estimateRp(usd(1975), target), 2000);
  assert.throws(() => progress({ minor: 1, currency: "EUR" }, target.threshold));
  assert.throws(() => fundingTarget(target.plan, [{ label: "x", amount: { minor: 1, currency: "EUR" } }]));
});

// ───────────────────────────── claims

function rig(options: { balance?: number; eligible?: boolean; failFirst?: number } = {}) {
  const db = new DatabaseSync(":memory:");
  const ledger = new Ledger(db, { codeSecret: "test-secret" });
  const calls = { fulfil: [] as string[], reserve: [] as string[], release: [] as string[], settle: [] as string[] };
  let failures = options.failFirst ?? 0;
  const ports: ClaimPorts = {
    eligibility: { check: async () => ({ eligible: options.eligible ?? true, reasons: options.eligible === false ? ["below the minimum holding"] : [] }) },
    rewards: {
      valuation: async () => ({ basis: "test", asOf: "now" }),
      balance: async () => usd(options.balance ?? 5000),
      history: async () => [],
      reserve: async (_w, _a, key) => void calls.reserve.push(key),
      release: async (key) => void calls.release.push(key),
      settle: async (key) => void calls.settle.push(key),
    },
    provider: {
      name: "test",
      regions: async () => [REGION],
      costs: async () => [],
      fulfil: async (order) => {
        calls.fulfil.push(order.orderKey);
        if (failures-- > 0) throw new Error("provider down: order 123 secret detail");
        return order.items.flatMap((item) => Array.from({ length: item.quantity }, (_, i) => ({ rp: item.rp, code: `FIXTURE-${item.rp}-${i}` })));
      },
    },
  };
  return { db, ledger, ports, calls };
}
const WALLET = "0x00000000000000000000000000000000000000A1";
const OTHER = "0x00000000000000000000000000000000000000b2";

test("a claim completes, stores codes encrypted, and can be recovered by its owner only", async () => {
  const { db, ledger, ports, calls } = rig();
  ledger.setFund(WALLET, LUX, REGION);
  const claim = await ledger.requestClaim(WALLET, skinOf, ports);
  assert.equal(claim.status, "completed");
  assert.deepEqual(claim.codes!.map((c) => c.rp), [2000, 2000]);
  assert.deepEqual(calls.settle, [`${WALLET.toLowerCase()}:1`]);

  const raw = db.prepare("SELECT codes FROM claims").get() as { codes: string };
  assert.ok(!raw.codes.includes("FIXTURE"));

  assert.deepEqual(ledger.currentClaim(WALLET)!.codes, claim.codes);
  assert.equal(ledger.currentClaim(OTHER), null);
});

test("two simultaneous claim requests reach the provider once", async () => {
  const { ledger, ports, calls } = rig();
  ledger.setFund(WALLET, LUX, REGION);
  const [a, b] = await Promise.all([ledger.requestClaim(WALLET, skinOf, ports), ledger.requestClaim(WALLET, skinOf, ports)]);
  assert.equal(calls.fulfil.length, 1);
  assert.equal(a.id, b.id);
  const again = await ledger.requestClaim(WALLET, skinOf, ports);
  assert.equal(again.id, a.id);
  assert.equal(calls.fulfil.length, 1);
});

test("a provider failure releases the reservation, hides the provider's message, and a retry reuses the order key", async () => {
  const { ledger, ports, calls } = rig({ failFirst: 1 });
  ledger.setFund(WALLET, LUX, REGION);
  const failed = await ledger.requestClaim(WALLET, skinOf, ports);
  assert.equal(failed.status, "failed");
  assert.equal(failed.codes, undefined);
  assert.ok(!failed.failure!.includes("123"));
  assert.equal(calls.release.length, 1);

  const retry = await ledger.requestClaim(WALLET, skinOf, ports);
  assert.equal(retry.status, "completed");
  assert.notEqual(retry.id, failed.id);
  assert.deepEqual(calls.fulfil, [calls.fulfil[0], calls.fulfil[0]]);
});

test("an underfunded or ineligible wallet is refused before anything is reserved", async () => {
  const poor = rig({ balance: 3799 });
  poor.ledger.setFund(WALLET, LUX, REGION);
  await assert.rejects(poor.ledger.requestClaim(WALLET, skinOf, poor.ports), (e: LedgerError) => e.status === 409);
  assert.equal(poor.calls.reserve.length, 0);

  const barred = rig({ eligible: false });
  barred.ledger.setFund(WALLET, LUX, REGION);
  await assert.rejects(barred.ledger.requestClaim(WALLET, skinOf, barred.ports), (e: LedgerError) => e.status === 403);
  assert.equal(barred.calls.fulfil.length, 0);

  const none = rig();
  await assert.rejects(none.ledger.requestClaim(WALLET, skinOf, none.ports), (e: LedgerError) => e.status === 409);
});

test("a fund refuses unsellable skins, and a new target after a completed claim opens a new cycle", async () => {
  const { ledger, ports } = rig();
  const unsellable = catalogue.skins.find((s) => !isSelectable(s))!;
  assert.throws(() => ledger.setFund(WALLET, unsellable, REGION), (e: LedgerError) => e.status === 409);
  assert.throws(() => ledger.setFund(WALLET, LUX, { ...REGION, denominations: [] }), (e: LedgerError) => e.status === 409);

  assert.equal(ledger.setFund(WALLET, LUX, REGION).cycle, 1);
  assert.equal(ledger.setFund(WALLET, LUX, REGION).cycle, 1);
  await ledger.requestClaim(WALLET, skinOf, ports);
  assert.equal(ledger.setFund(WALLET, LUX, REGION).cycle, 2);
  assert.equal(ledger.currentClaim(WALLET), null);
});

test("a sign-in nonce works exactly once", () => {
  const { ledger } = rig();
  const nonce = ledger.issueNonce();
  assert.equal(ledger.consumeNonce(nonce), true);
  assert.equal(ledger.consumeNonce(nonce), false);
  assert.equal(ledger.consumeNonce("never-issued"), false);
});
