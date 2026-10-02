/** Shared, framework-free types. Nothing in src/core imports React, Next or the DOM. */

export type SkinStatus = "available" | "legacy" | "limited" | "rare" | "upcoming";

export interface Skin {
  /** Riot skin id, e.g. 99007 = Lux (99) skin 7. */
  id: number;
  /** Official skin name from Data Dragon. */
  name: string;
  champion: string;
  /** Data Dragon champion key, used in asset paths. */
  key: string;
  num: number;
  /** Listed store price in RP, or null when the skin is not sold for RP. */
  rp: number | null;
  status: SkinStatus;
  acquisition: string | null;
  rarity: string | null;
  release: string | null;
}

export interface CatalogueMeta {
  generatedAt: string;
  dataDragonVersion: string;
  nameSource: string;
  pricingSource: string;
  pricingUrl: string;
  count: number;
  dropped: number;
}

/** An amount in the minor units (e.g. cents) of a quote currency. Always an integer. */
export interface Money {
  minor: number;
  currency: string;
}

/** One prepaid RP product a provider can actually issue for a region. */
export interface Denomination {
  id: string;
  rp: number;
  cost: Money;
}

export interface Region {
  /** Provider-side region code, e.g. "EUW". */
  code: string;
  label: string;
  /** What must be true of the player's account for a code from this region to redeem. */
  compatibility: string;
  denominations: Denomination[];
  /**
   * The operator supplies whatever cards cover the skin, so the target is the
   * skin's RP price itself and no card list is needed.
   */
  exact?: boolean;
}

export interface PurchasePlan {
  items: { denomination: Denomination; quantity: number }[];
  totalRp: number;
  /** RP left over after buying the target skin. */
  surplusRp: number;
  cost: Money;
}

export interface KnownCost {
  label: string;
  amount: Money;
}

export interface FundingTarget {
  plan: PurchasePlan;
  costs: KnownCost[];
  /** Code cost plus every known cost: what the fund has to reach. */
  threshold: Money;
}

export interface Progress {
  ratio: number;
  percent: number;
  funded: boolean;
  remaining: Money;
}

export interface RewardEntry {
  id: string;
  at: string;
  amount: Money;
  /** Where the entry comes from, e.g. a distribution id or transaction reference. */
  reference: string;
}

export type ClaimStatus = "pending" | "completed" | "failed";

export interface ClaimView {
  id: string;
  status: ClaimStatus;
  skinId: number;
  region: string;
  totalRp: number;
  /** The prepaid codes this claim is for. */
  items: { rp: number; quantity: number }[];
  createdAt: string;
  updatedAt: string;
  /** Present only on a completed claim, and only ever sent to its owner. */
  codes?: { rp: number; code: string }[];
  /** A safe, user-facing reason on a failed claim. */
  failure?: string;
}
