import type { ClaimView, FundingTarget, Money, Region, RewardEntry } from "@/core/types";
import type { PotSnapshot } from "@/core/ports";

/** Shapes of the JSON the API returns. Shared by routes and the client. */

export interface IntegrationState {
  key: "wallet" | "token" | "eligibility" | "fees" | "rewards" | "provider";
  label: string;
  ready: boolean;
  needs: string | null;
}

export interface StatusView {
  integrations: IntegrationState[];
  chain: string | null;
  /** Null until an RP-code provider is configured. */
  provider: { name: string; regions: Region[] } | null;
}

export type PotView = { available: true; pot: PotSnapshot } | { available: false; needs: string };

export interface FundView {
  address: string;
  fund: { skinId: number; region: string; cycle: number; updatedAt: string } | null;
  target: FundingTarget | null;
  rewards: { balance: Money; history: RewardEntry[]; valuation: { basis: string; asOf: string } } | null;
  eligibility: { eligible: boolean; reasons: string[] } | null;
  token: { raw: string; decimals: number; symbol: string } | null;
  /** Claim state without the codes — those only travel through /api/claim. */
  claim: Omit<ClaimView, "codes"> | null;
  /** What is not configured, in plain words. Empty when everything is live. */
  missing: string[];
}

export interface AdminOverview {
  storage: { persistent: boolean; claimsSealed: boolean };
  regions: (Region & { enabled: boolean })[];
  funds: {
    wallet: string;
    skin: string;
    region: string;
    balance: Money;
    threshold: Money | null;
    percent: number | null;
    updatedAt: string;
  }[];
  claims: {
    id: string;
    wallet: string;
    status: ClaimView["status"];
    skin: string;
    region: string;
    totalRp: number;
    items: { rp: number; quantity: number }[];
    threshold: Money;
    failure: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  totals: { credited: Money; spent: Money; wallets: number; lastAt: string | null };
}

export type AdminState = { state: "unconfigured" } | { state: "signed-out" } | { state: "ready"; overview: AdminOverview };
