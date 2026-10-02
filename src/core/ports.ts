import type { KnownCost, Money, Region, RewardEntry } from "./types.ts";

/**
 * The seams between the product and the outside world. Each one is an
 * interface with no default implementation: until a real adapter is
 * configured the app reports the integration as missing instead of faking it.
 */

export interface EligibilityPort {
  /** Rules are the adapter's: minimum holding, holding period, exclusions… */
  check(wallet: string): Promise<{ eligible: boolean; reasons: string[] }>;
}

export interface RewardsPort {
  /** How reward value is expressed in the quote currency, shown next to every estimate. */
  valuation(): Promise<{ basis: string; asOf: string }>;
  /** Unclaimed rewards actually allocated to this wallet, valued in the quote currency. */
  balance(wallet: string): Promise<Money>;
  history(wallet: string): Promise<RewardEntry[]>;
  /** Hold `amount` against a claim. Must be idempotent on `orderKey`. */
  reserve(wallet: string, amount: Money, orderKey: string): Promise<void>;
  /** Give a reservation back after a failed fulfilment. */
  release(orderKey: string): Promise<void>;
  /** Turn a reservation into spent funds after a completed fulfilment. */
  settle(orderKey: string): Promise<void>;
}

export interface FulfilmentOrder {
  /** Stable per wallet and fund cycle. The provider must never issue twice for one key. */
  orderKey: string;
  region: string;
  items: { denominationId: string; rp: number; quantity: number }[];
}

export interface RpProviderPort {
  name: string;
  /** Regions and prepaid denominations the provider can issue right now. */
  regions(): Promise<Region[]>;
  /** Known costs on top of the code price for a region (fees, etc.). */
  costs(region: string): Promise<KnownCost[]>;
  /** Codes, or null when the order is queued for an operator to fulfil by hand. */
  fulfil(order: FulfilmentOrder): Promise<{ rp: number; code: string }[] | null>;
}

export interface PotSnapshot {
  /** Recorded rewards not yet spent on a code: what sits in holders' funds. */
  inFunds: Money;
  /** Every reward recorded since the start. */
  recorded: Money;
  /** Rewards turned into delivered RP codes. */
  spent: Money;
  /** Wallets that have received at least one reward. */
  holders: number;
  /** When the last reward was recorded, or null if none has been. */
  updatedAt: string | null;
  methodology: string;
}

export interface FeeAccountingPort {
  pot(): Promise<PotSnapshot>;
}

export interface TokenBalancesPort {
  /** Raw token balance in base units, as a decimal string. */
  balanceOf(wallet: string): Promise<{ raw: string; decimals: number; symbol: string }>;
}
