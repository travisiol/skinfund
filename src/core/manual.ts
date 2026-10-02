import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { LedgerError } from "./ledger.ts";
import type { EligibilityPort, FeeAccountingPort, RewardsPort, RpProviderPort } from "./ports.ts";
import { RP } from "./funding.ts";
import type { Money, Region, RewardEntry } from "./types.ts";

/**
 * The operator's book. SKINFUND is run by hand: the operator records, in RP,
 * each reward they distribute to a wallet, and sends the RP codes themselves.
 * A fund is full when its recorded RP reaches the skin's RP price.
 *
 * This class is that record, and it exposes itself to the claim ledger as the
 * reward source and the code provider. A balance is the sum of what the
 * operator recorded, minus what a claim holds or has spent — nothing else.
 */

/** League of Legends servers, opened by default. The operator hides the ones they cannot supply. */
export const DEFAULT_REGIONS: [string, string][] = [
  ["EUW", "EU West"],
  ["EUNE", "EU Nordic & East"],
  ["NA", "North America"],
  ["BR", "Brazil"],
  ["LAN", "Latin America North"],
  ["LAS", "Latin America South"],
  ["OCE", "Oceania"],
  ["TR", "Türkiye"],
  ["JP", "Japan"],
  ["KR", "Korea"],
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS regions (
  code TEXT PRIMARY KEY, label TEXT NOT NULL, compatibility TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS credits (
  id TEXT PRIMARY KEY, wallet TEXT NOT NULL, amount_minor INTEGER NOT NULL, reference TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS credits_wallet ON credits (wallet);
CREATE TABLE IF NOT EXISTS reservations (
  order_key TEXT PRIMARY KEY, wallet TEXT NOT NULL, amount_minor INTEGER NOT NULL, state TEXT NOT NULL
);
`;

const WALLET = /^0x[0-9a-fA-F]{40}$/;

export interface AdminRegion extends Region {
  enabled: boolean;
}

export class ManualBook {
  private db: DatabaseSync;
  private now: () => number;
  currency = RP;

  constructor(db: DatabaseSync, options: { now?: () => number; seedRegions?: boolean } = {}) {
    this.db = db;
    this.now = options.now ?? Date.now;
    db.exec(SCHEMA);
    // First run: open the standard servers so holders can start a fund straight away.
    const count = db.prepare("SELECT COUNT(*) AS n FROM regions").get() as { n: number };
    if (options.seedRegions !== false && count.n === 0) for (const [code, label] of DEFAULT_REGIONS) this.saveRegion({ code, label });
  }

  private money(minor: number): Money {
    return { minor, currency: this.currency };
  }

  // ───────────────────────────── regions

  listRegions(): AdminRegion[] {
    const regions = this.db.prepare("SELECT * FROM regions ORDER BY label").all() as {
      code: string;
      label: string;
      compatibility: string;
      enabled: number;
    }[];
    return regions.map((region) => ({
      code: region.code,
      label: region.label,
      compatibility: region.compatibility,
      enabled: region.enabled === 1,
      denominations: [],
      exact: true,
    }));
  }

  saveRegion(input: { code: string; label: string; compatibility?: string; enabled?: boolean }) {
    const code = input.code.trim().toUpperCase();
    const label = input.label.trim();
    if (!/^[A-Z0-9]{2,8}$/.test(code)) throw new LedgerError(400, "A region code is 2–8 letters or digits, e.g. EUW.");
    if (label.length < 2 || label.length > 60) throw new LedgerError(400, "Give the region a name.");
    const compatibility = input.compatibility?.trim() || `Redeems only on a League of Legends account on the ${label} server.`;
    this.db
      .prepare(
        `INSERT INTO regions (code, label, compatibility, enabled) VALUES (?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET label = excluded.label, compatibility = excluded.compatibility, enabled = excluded.enabled`,
      )
      .run(code, label, compatibility.slice(0, 240), input.enabled === false ? 0 : 1);
  }

  // ───────────────────────────── rewards

  /** Record a reward distributed to a wallet. The reference says where it comes from. */
  credit(input: { wallet: string; amountMinor: number; reference: string }): RewardEntry {
    if (!WALLET.test(input.wallet)) throw new LedgerError(400, "That is not a wallet address.");
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new LedgerError(400, "Enter a whole number of RP, greater than zero.");
    const reference = input.reference.trim();
    if (reference.length < 3 || reference.length > 140) throw new LedgerError(400, "Add a reference: which fees or distribution this comes from.");
    const entry = { id: randomUUID(), at: new Date(this.now()).toISOString(), amount: this.money(input.amountMinor), reference };
    this.db
      .prepare("INSERT INTO credits (id, wallet, amount_minor, reference, at) VALUES (?, ?, ?, ?, ?)")
      .run(entry.id, input.wallet.toLowerCase(), input.amountMinor, reference, entry.at);
    return entry;
  }

  history(wallet: string): RewardEntry[] {
    const rows = this.db.prepare("SELECT * FROM credits WHERE wallet = ? ORDER BY at DESC").all(wallet.toLowerCase()) as {
      id: string;
      amount_minor: number;
      reference: string;
      at: string;
    }[];
    return rows.map((row) => ({ id: row.id, at: row.at, amount: this.money(row.amount_minor), reference: row.reference }));
  }

  /** Credited, minus what a pending claim holds or a completed claim spent. */
  balance(wallet: string): Money {
    const address = wallet.toLowerCase();
    const credited = this.db.prepare("SELECT COALESCE(SUM(amount_minor), 0) AS n FROM credits WHERE wallet = ?").get(address) as { n: number };
    const held = this.db
      .prepare("SELECT COALESCE(SUM(amount_minor), 0) AS n FROM reservations WHERE wallet = ? AND state != 'released'")
      .get(address) as { n: number };
    return this.money(credited.n - held.n);
  }

  totals(): { credited: Money; spent: Money; wallets: number; lastAt: string | null } {
    const credited = this.db.prepare("SELECT COALESCE(SUM(amount_minor), 0) AS n, COUNT(DISTINCT wallet) AS w, MAX(at) AS last FROM credits").get() as {
      n: number;
      w: number;
      last: string | null;
    };
    const spent = this.db.prepare("SELECT COALESCE(SUM(amount_minor), 0) AS n FROM reservations WHERE state = 'settled'").get() as { n: number };
    return { credited: this.money(credited.n), spent: this.money(spent.n), wallets: credited.w, lastAt: credited.last };
  }

  /** The public pot: only totals, never a wallet or an amount per holder. */
  feePort(): FeeAccountingPort {
    return {
      pot: async () => {
        const totals = this.totals();
        return {
          inFunds: this.money(totals.credited.minor - totals.spent.minor),
          recorded: totals.credited,
          spent: totals.spent,
          holders: totals.wallets,
          updatedAt: totals.lastAt,
          methodology:
            "Figures are in RP and come from the SKINFUND operator's record: each time trading fees are distributed, every holder's share is recorded by hand and added here. Nothing is projected — with no volume, these numbers do not move.",
        };
      },
    };
  }

  // ───────────────────────────── ports

  rewardsPort(): RewardsPort {
    return {
      valuation: async () => ({
        basis: "Rewards are recorded in RP by the SKINFUND operator each time trading fees are distributed.",
        asOf: new Date(this.now()).toISOString(),
      }),
      balance: async (wallet) => this.balance(wallet),
      history: async (wallet) => this.history(wallet),
      reserve: async (wallet, amount, orderKey) => {
        const existing = this.db.prepare("SELECT state FROM reservations WHERE order_key = ?").get(orderKey) as { state: string } | undefined;
        if (existing?.state === "reserved" || existing?.state === "settled") return; // idempotent
        if (this.balance(wallet).minor < amount.minor) throw new Error("insufficient balance");
        this.db
          .prepare(
            `INSERT INTO reservations (order_key, wallet, amount_minor, state) VALUES (?, ?, ?, 'reserved')
             ON CONFLICT(order_key) DO UPDATE SET amount_minor = excluded.amount_minor, state = 'reserved'`,
          )
          .run(orderKey, wallet.toLowerCase(), amount.minor);
      },
      release: async (orderKey) => void this.db.prepare("UPDATE reservations SET state = 'released' WHERE order_key = ? AND state = 'reserved'").run(orderKey),
      settle: async (orderKey) => void this.db.prepare("UPDATE reservations SET state = 'settled' WHERE order_key = ? AND state = 'reserved'").run(orderKey),
    };
  }

  providerPort(): RpProviderPort {
    return {
      name: "SKINFUND operator (codes sent by hand)",
      regions: async () =>
        this.listRegions()
          .filter((region) => region.enabled)
          .map((region) => ({ code: region.code, label: region.label, compatibility: region.compatibility, denominations: [], exact: true })),
      // Funds are counted in RP: what the cards cost the operator is not the holder's concern.
      costs: async () => [],
      // Queued: the operator sees the claim in /admin and enters the code there.
      fulfil: async () => null,
    };
  }

  /**
   * With rewards recorded by hand, the operator decides who is rewarded by
   * choosing whom to credit, so there is no separate eligibility gate here.
   */
  eligibilityPort(): EligibilityPort {
    return { check: async () => ({ eligible: true, reasons: [] }) };
  }
}
