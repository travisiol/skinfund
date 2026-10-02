import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { isSelectable } from "./catalogue.ts";
import { fundingTarget, planFor } from "./funding.ts";
import type { EligibilityPort, RewardsPort, RpProviderPort } from "./ports.ts";
import type { ClaimStatus, ClaimView, FundingTarget, Region, Skin } from "./types.ts";

/** An error that is safe to show to the person who caused it. */
export class LedgerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "LedgerError";
    this.status = status;
  }
}

export interface Fund {
  wallet: string;
  skinId: number;
  region: string;
  /** Increments each time a completed claim is followed by a new target. */
  cycle: number;
  updatedAt: string;
}

export interface ClaimPorts {
  eligibility: EligibilityPort;
  rewards: RewardsPort;
  provider: RpProviderPort;
}

interface ClaimRow {
  id: string;
  wallet: string;
  cycle: number;
  skin_id: number;
  region: string;
  total_rp: number;
  status: ClaimStatus;
  codes: string | null;
  failure: string | null;
  plan: string;
  threshold_minor: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

/** What the operator sees for a claim: who, what to send, and its state. Never the codes. */
export interface AdminClaim {
  id: string;
  wallet: string;
  status: ClaimStatus;
  skinId: number;
  region: string;
  totalRp: number;
  items: { rp: number; quantity: number }[];
  threshold: { minor: number; currency: string };
  failure: string | null;
  createdAt: string;
  updatedAt: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS nonces (nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS funds (
  wallet TEXT PRIMARY KEY, skin_id INTEGER NOT NULL, region TEXT NOT NULL,
  cycle INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY, wallet TEXT NOT NULL, cycle INTEGER NOT NULL,
  skin_id INTEGER NOT NULL, region TEXT NOT NULL, total_rp INTEGER NOT NULL,
  status TEXT NOT NULL, codes TEXT, failure TEXT,
  plan TEXT NOT NULL DEFAULT '[]', threshold_minor INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
-- One live claim per wallet and fund cycle: the database itself refuses a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_open ON claims (wallet, cycle) WHERE status != 'failed';
`;

const NONCE_TTL_MS = 10 * 60_000;

export class Ledger {
  private db: DatabaseSync;
  private key: Buffer;
  private now: () => number;

  constructor(db: DatabaseSync, options: { codeSecret: string; now?: () => number }) {
    this.db = db;
    this.key = createHash("sha256").update(options.codeSecret).digest();
    this.now = options.now ?? Date.now;
    db.exec(SCHEMA);
  }

  private iso(): string {
    return new Date(this.now()).toISOString();
  }

  // ───────────────────────────── sign-in nonces

  issueNonce(): string {
    const nonce = randomBytes(16).toString("hex");
    this.db.prepare("DELETE FROM nonces WHERE expires_at < ?").run(this.now());
    this.db.prepare("INSERT INTO nonces (nonce, expires_at) VALUES (?, ?)").run(nonce, this.now() + NONCE_TTL_MS);
    return nonce;
  }

  /** True exactly once per issued nonce. */
  consumeNonce(nonce: string): boolean {
    const result = this.db.prepare("DELETE FROM nonces WHERE nonce = ? AND expires_at >= ?").run(nonce, this.now());
    return result.changes === 1;
  }

  // ───────────────────────────── funds

  getFund(wallet: string): Fund | null {
    const row = this.db.prepare("SELECT * FROM funds WHERE wallet = ?").get(wallet.toLowerCase()) as
      | { wallet: string; skin_id: number; region: string; cycle: number; updated_at: string }
      | undefined;
    return row ? { wallet: row.wallet, skinId: row.skin_id, region: row.region, cycle: row.cycle, updatedAt: row.updated_at } : null;
  }

  /**
   * Set or change the target. Refused while a claim is being fulfilled; after
   * a completed claim it opens the next fund cycle.
   */
  setFund(wallet: string, skin: Skin, region: Region): Fund {
    if (!isSelectable(skin)) throw new LedgerError(409, "That skin cannot be funded: it is not sold for RP in the regular store.");
    if (planFor(skin.rp!, region) === null)
      throw new LedgerError(409, "No prepaid RP code is available for that region right now.");
    const address = wallet.toLowerCase();
    const current = this.getFund(address);
    let cycle = current?.cycle ?? 1;
    if (current) {
      const open = this.openClaim(address, current.cycle);
      if (open?.status === "pending") throw new LedgerError(409, "A claim is in progress. Wait for it to finish before changing your target.");
      if (open?.status === "completed") cycle = current.cycle + 1;
    }
    this.db
      .prepare(
        `INSERT INTO funds (wallet, skin_id, region, cycle, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(wallet) DO UPDATE SET skin_id = excluded.skin_id, region = excluded.region, cycle = excluded.cycle, updated_at = excluded.updated_at`,
      )
      .run(address, skin.id, region.code, cycle, this.iso());
    return this.getFund(address)!;
  }

  // ───────────────────────────── claims

  private openClaim(wallet: string, cycle: number): ClaimRow | undefined {
    return this.db.prepare("SELECT * FROM claims WHERE wallet = ? AND cycle = ? AND status != 'failed'").get(wallet, cycle) as
      | ClaimRow
      | undefined;
  }

  private seal(codes: { rp: number; code: string }[]): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(codes), "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
  }

  private open(sealed: string): { rp: number; code: string }[] {
    const [iv, tag, body] = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8"));
  }

  private view(row: ClaimRow): ClaimView {
    return {
      id: row.id,
      status: row.status,
      skinId: row.skin_id,
      region: row.region,
      totalRp: row.total_rp,
      items: JSON.parse(row.plan) as { rp: number; quantity: number }[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.status === "completed" && row.codes ? { codes: this.open(row.codes) } : {}),
      ...(row.status === "failed" && row.failure ? { failure: row.failure } : {}),
    };
  }

  /** The owner's claim for the current fund cycle — this is how a completed claim is recovered. */
  currentClaim(wallet: string): ClaimView | null {
    const address = wallet.toLowerCase();
    const fund = this.getFund(address);
    if (!fund) return null;
    const row =
      this.openClaim(address, fund.cycle) ??
      (this.db.prepare("SELECT * FROM claims WHERE wallet = ? AND cycle = ? ORDER BY created_at DESC LIMIT 1").get(address, fund.cycle) as
        | ClaimRow
        | undefined);
    return row ? this.view(row) : null;
  }

  /** What the fund must reach, from the provider's live inventory. */
  async target(skin: Skin, regionCode: string, provider: RpProviderPort): Promise<{ region: Region; target: FundingTarget }> {
    if (!isSelectable(skin)) throw new LedgerError(409, "That skin is not sold for RP in the regular store.");
    const region = (await provider.regions()).find((r) => r.code === regionCode);
    if (!region) throw new LedgerError(409, "That region is not supported by the RP-code provider.");
    const plan = planFor(skin.rp!, region);
    if (!plan) throw new LedgerError(409, "No prepaid RP code is available for that region right now.");
    return { region, target: fundingTarget(plan, await provider.costs(region.code)) };
  }

  /**
   * Claim the RP code. Safe to call twice: a second call returns the claim the
   * first one opened. Every check runs here, on the server, at claim time.
   */
  async requestClaim(wallet: string, skinOf: (id: number) => Skin | undefined, ports: ClaimPorts): Promise<ClaimView> {
    const address = wallet.toLowerCase();
    const fund = this.getFund(address);
    if (!fund) throw new LedgerError(409, "Pick a skin and a region first.");

    const existing = this.openClaim(address, fund.cycle);
    if (existing) return this.view(existing);

    const skin = skinOf(fund.skinId);
    if (!skin) throw new LedgerError(409, "Your selected skin is no longer in the catalogue. Pick another target.");
    const { region, target } = await this.target(skin, fund.region, ports.provider);

    const eligibility = await ports.eligibility.check(address);
    if (!eligibility.eligible)
      throw new LedgerError(403, `This wallet is not eligible to claim${eligibility.reasons.length ? `: ${eligibility.reasons.join("; ")}` : "."}`);

    const balance = await ports.rewards.balance(address);
    if (balance.currency !== target.threshold.currency) throw new LedgerError(503, "Reward valuation is not configured for this provider's currency.");
    if (balance.minor < target.threshold.minor) throw new LedgerError(409, "Your fund has not reached its target yet.");

    const id = randomUUID();
    const at = this.iso();
    const items = target.plan.items.map((item) => ({ denominationId: item.denomination.id, rp: item.denomination.rp, quantity: item.quantity }));
    try {
      this.db
        .prepare(
          `INSERT INTO claims (id, wallet, cycle, skin_id, region, total_rp, status, plan, threshold_minor, currency, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          address,
          fund.cycle,
          skin.id,
          region.code,
          target.plan.totalRp,
          JSON.stringify(items.map(({ rp, quantity }) => ({ rp, quantity }))),
          target.threshold.minor,
          target.threshold.currency,
          at,
          at,
        );
    } catch {
      // The unique index fired: another request opened the claim a moment ago.
      const raced = this.openClaim(address, fund.cycle);
      if (raced) return this.view(raced);
      throw new LedgerError(500, "The claim could not be recorded.");
    }

    // One key per wallet and cycle, reused by a retry, so neither the reward
    // source nor the provider can be made to act twice for the same fund.
    const orderKey = `${address}:${fund.cycle}`;
    const finish = (status: ClaimStatus, fields: { codes?: string; failure?: string }) =>
      this.db
        .prepare("UPDATE claims SET status = ?, codes = ?, failure = ?, updated_at = ? WHERE id = ?")
        .run(status, fields.codes ?? null, fields.failure ?? null, this.iso(), id);

    try {
      await ports.rewards.reserve(address, target.threshold, orderKey);
    } catch {
      finish("failed", { failure: "Your funded balance could not be reserved. Nothing was spent — try again." });
      return this.currentClaim(address)!;
    }

    let codes: { rp: number; code: string }[] | null;
    try {
      codes = await ports.provider.fulfil({ orderKey, region: region.code, items });
      // null = accepted for manual fulfilment: the claim stays pending until the operator completes it.
      if (codes === null) return this.currentClaim(address)!;
      if (!Array.isArray(codes) || codes.length === 0) throw new Error("empty fulfilment");
    } catch {
      // The provider's message is deliberately not stored or shown: it may carry order details.
      await ports.rewards.release(orderKey).catch(() => {});
      finish("failed", { failure: "The provider could not issue your code. Your fund was not spent — try again." });
      return this.currentClaim(address)!;
    }

    finish("completed", { codes: this.seal(codes) });
    await ports.rewards.settle(orderKey).catch(() => {});
    return this.currentClaim(address)!;
  }

  // ───────────────────────────── operator (manual fulfilment)

  listFunds(): Fund[] {
    const rows = this.db.prepare("SELECT * FROM funds ORDER BY updated_at DESC").all() as {
      wallet: string;
      skin_id: number;
      region: string;
      cycle: number;
      updated_at: string;
    }[];
    return rows.map((row) => ({ wallet: row.wallet, skinId: row.skin_id, region: row.region, cycle: row.cycle, updatedAt: row.updated_at }));
  }

  /** Every claim, pending first. Codes are never included. */
  listClaims(): AdminClaim[] {
    const rows = this.db.prepare("SELECT * FROM claims ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 500").all() as unknown as ClaimRow[];
    return rows.map((row) => ({
      id: row.id,
      wallet: row.wallet,
      status: row.status,
      skinId: row.skin_id,
      region: row.region,
      totalRp: row.total_rp,
      items: JSON.parse(row.plan) as { rp: number; quantity: number }[],
      threshold: { minor: row.threshold_minor, currency: row.currency },
      failure: row.failure,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private pendingClaim(id: string): ClaimRow {
    const row = this.db.prepare("SELECT * FROM claims WHERE id = ?").get(id) as ClaimRow | undefined;
    if (!row) throw new LedgerError(404, "No such claim.");
    if (row.status !== "pending") throw new LedgerError(409, `That claim is already ${row.status}.`);
    return row;
  }

  /** The operator hands over the codes. Only a pending claim can be completed, and only once. */
  async completeClaim(id: string, codes: { rp: number; code: string }[], rewards: RewardsPort): Promise<void> {
    const row = this.pendingClaim(id);
    const clean = codes.map((c) => ({ rp: c.rp, code: String(c.code ?? "").trim() }));
    if (clean.length === 0 || clean.some((c) => !Number.isInteger(c.rp) || c.rp <= 0 || c.code.length < 4 || c.code.length > 200))
      throw new LedgerError(400, "Enter every code, with its RP amount.");
    const sent = clean.reduce((sum, c) => sum + c.rp, 0);
    if (sent < row.total_rp) throw new LedgerError(400, `These cards add up to ${sent} RP; the claim is for ${row.total_rp} RP.`);
    const done = this.db
      .prepare("UPDATE claims SET status = 'completed', codes = ?, failure = NULL, updated_at = ? WHERE id = ? AND status = 'pending'")
      .run(this.seal(clean), this.iso(), id);
    if (done.changes !== 1) throw new LedgerError(409, "That claim was just changed by someone else.");
    await rewards.settle(`${row.wallet}:${row.cycle}`);
  }

  /** The operator cannot fulfil: the claim fails, the reserved funds go back, and the holder can claim again. */
  async failClaim(id: string, reason: string, rewards: RewardsPort): Promise<void> {
    const row = this.pendingClaim(id);
    const text = reason.trim().slice(0, 300) || "The code could not be issued. Your fund was not spent — you can claim again.";
    const done = this.db
      .prepare("UPDATE claims SET status = 'failed', failure = ?, updated_at = ? WHERE id = ? AND status = 'pending'")
      .run(text, this.iso(), id);
    if (done.changes !== 1) throw new LedgerError(409, "That claim was just changed by someone else.");
    await rewards.release(`${row.wallet}:${row.cycle}`);
  }
}
