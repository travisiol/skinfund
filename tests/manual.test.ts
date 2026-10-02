import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { fundingTarget, planFor } from "../src/core/funding.ts";
import { Ledger, LedgerError } from "../src/core/ledger.ts";
import { DEFAULT_REGIONS, ManualBook } from "../src/core/manual.ts";
import type { Skin } from "../src/core/types.ts";

const catalogue = JSON.parse(readFileSync(new URL("../src/data/catalogue.json", import.meta.url), "utf8")) as { skins: Skin[] };
const skinOf = (id: number) => catalogue.skins.find((s) => s.id === id);
const LUX = skinOf(99007)!; // 3,250 RP
const WALLET = "0x00000000000000000000000000000000000000a1";
const OTHER = "0x00000000000000000000000000000000000000b2";

async function rig() {
  const db = new DatabaseSync(":memory:");
  const ledger = new Ledger(db, { codeSecret: "test-secret" });
  const book = new ManualBook(db);
  const ports = { provider: book.providerPort(), rewards: book.rewardsPort(), eligibility: book.eligibilityPort() };
  const region = (await ports.provider.regions()).find((r) => r.code === "EUW")!;
  return { db, ledger, book, ports, region };
}

test("the standard servers are open from the first run, and a hidden one is no longer offered", async () => {
  const { db, book, ports } = await rig();
  assert.deepEqual((await ports.provider.regions()).map((r) => r.code).sort(), DEFAULT_REGIONS.map(([code]) => code).sort());
  book.saveRegion({ code: "KR", label: "Korea", enabled: false });
  assert.ok(!(await ports.provider.regions()).some((r) => r.code === "KR"));
  // Seeding happens once: an operator who hid or renamed regions keeps their list.
  assert.ok(!(await new ManualBook(db).providerPort().regions()).some((r) => r.code === "KR"));
  assert.throws(() => book.saveRegion({ code: "!!", label: "Bad" }), (e: LedgerError) => e.status === 400);
});

test("a fund in an operator-supplied region targets the skin's RP price exactly", async () => {
  const { region } = await rig();
  const target = fundingTarget(planFor(LUX.rp!, region)!, []);
  assert.deepEqual(target.threshold, { minor: 3250, currency: "RP" });
  assert.equal(target.plan.totalRp, 3250);
  assert.equal(target.plan.surplusRp, 0);
});

test("a balance is exactly the RP the operator recorded", async () => {
  const { book } = await rig();
  assert.equal(book.balance(WALLET).minor, 0);
  book.credit({ wallet: WALLET, amountMinor: 1500, reference: "Fees week 1" });
  book.credit({ wallet: WALLET.toUpperCase().replace("0X", "0x"), amountMinor: 500, reference: "Fees week 2" });
  assert.deepEqual(book.balance(WALLET), { minor: 2000, currency: "RP" });
  assert.equal(book.balance(OTHER).minor, 0);
  assert.equal(book.history(WALLET).length, 2);
  assert.throws(() => book.credit({ wallet: "not-a-wallet", amountMinor: 100, reference: "x y z" }), (e: LedgerError) => e.status === 400);
  assert.throws(() => book.credit({ wallet: WALLET, amountMinor: -5, reference: "x y z" }), (e: LedgerError) => e.status === 400);
  assert.throws(() => book.credit({ wallet: WALLET, amountMinor: 1.5, reference: "x y z" }), (e: LedgerError) => e.status === 400);
  assert.throws(() => book.credit({ wallet: WALLET, amountMinor: 100, reference: "" }), (e: LedgerError) => e.status === 400);
});

test("a claim waits as pending, reserves the fund, and completes when the operator enters the codes", async () => {
  const { db, ledger, book, ports, region } = await rig();
  ledger.setFund(WALLET, LUX, region);

  // Nothing recorded yet, then recorded but short: refused both times.
  await assert.rejects(ledger.requestClaim(WALLET, skinOf, ports), (e: LedgerError) => e.status === 409);
  book.credit({ wallet: WALLET, amountMinor: 3000, reference: "Fees week 1" });
  await assert.rejects(ledger.requestClaim(WALLET, skinOf, ports), (e: LedgerError) => e.status === 409);
  book.credit({ wallet: WALLET, amountMinor: 400, reference: "Fees week 2" });

  const claim = await ledger.requestClaim(WALLET, skinOf, ports);
  assert.equal(claim.status, "pending");
  assert.equal(claim.totalRp, 3250);
  assert.equal(claim.codes, undefined);
  assert.equal(book.balance(WALLET).minor, 150); // 3,400 recorded − 3,250 reserved

  // Asking again does not open a second claim or reserve twice.
  assert.equal((await ledger.requestClaim(WALLET, skinOf, ports)).id, claim.id);
  assert.equal(book.balance(WALLET).minor, 150);
  assert.throws(() => ledger.setFund(WALLET, LUX, region), (e: LedgerError) => e.status === 409);

  const [listed] = ledger.listClaims();
  assert.equal(listed.wallet, WALLET);
  assert.deepEqual(listed.threshold, { minor: 3250, currency: "RP" });
  assert.ok(!("codes" in listed));

  await assert.rejects(ledger.completeClaim(claim.id, [], ports.rewards), (e: LedgerError) => e.status === 400);
  // The operator may cover the skin with several cards.
  await ledger.completeClaim(claim.id, [{ rp: 2800, code: " FIXTURE-AAAA " }, { rp: 575, code: "FIXTURE-BBBB" }], ports.rewards);
  await assert.rejects(ledger.completeClaim(claim.id, [{ rp: 2800, code: "FIXTURE-CCCC" }], ports.rewards), (e: LedgerError) => e.status === 409);

  const done = ledger.currentClaim(WALLET)!;
  assert.equal(done.status, "completed");
  assert.deepEqual(done.codes, [{ rp: 2800, code: "FIXTURE-AAAA" }, { rp: 575, code: "FIXTURE-BBBB" }]);
  assert.equal(ledger.currentClaim(OTHER), null);
  assert.ok(!(db.prepare("SELECT codes FROM claims").get() as { codes: string }).codes.includes("FIXTURE"));
  assert.equal(book.balance(WALLET).minor, 150); // spent for good
  assert.equal(book.totals().spent.minor, 3250);
});

test("a refused claim gives the reserved RP back and can be claimed again", async () => {
  const { ledger, book, ports, region } = await rig();
  ledger.setFund(WALLET, LUX, region);
  book.credit({ wallet: WALLET, amountMinor: 3400, reference: "Fees week 1" });

  const claim = await ledger.requestClaim(WALLET, skinOf, ports);
  await ledger.failClaim(claim.id, "Card out of stock this week", ports.rewards);
  assert.equal(book.balance(WALLET).minor, 3400);
  const failed = ledger.currentClaim(WALLET)!;
  assert.equal(failed.status, "failed");
  assert.equal(failed.failure, "Card out of stock this week");
  await assert.rejects(ledger.failClaim(claim.id, "again", ports.rewards), (e: LedgerError) => e.status === 409);

  const retry = await ledger.requestClaim(WALLET, skinOf, ports);
  assert.equal(retry.status, "pending");
  assert.notEqual(retry.id, claim.id);
  assert.equal(book.balance(WALLET).minor, 150);
});

test("a fund on a region hidden later can still be claimed only if the region is open", async () => {
  const { ledger, book, ports, region } = await rig();
  ledger.setFund(WALLET, LUX, region);
  book.credit({ wallet: WALLET, amountMinor: 3250, reference: "Fees week 1" });
  book.saveRegion({ code: "EUW", label: "EU West", enabled: false });
  await assert.rejects(ledger.requestClaim(WALLET, skinOf, ports), (e: LedgerError) => e.status === 409);
  assert.equal(book.balance(WALLET).minor, 3250);
});
