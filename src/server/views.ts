import "server-only";
import { CHAIN } from "@/config/network";
import { LedgerError } from "@/core/ledger";
import type { ClaimPorts } from "@/core/ledger";
import { skinById } from "@/integrations/catalogue";
import { eligibility } from "@/integrations/eligibility";
import { feeAccounting } from "@/integrations/fee-accounting";
import { rewardAllocation } from "@/integrations/reward-allocation";
import { rpProvider } from "@/integrations/rp-provider";
import { tokenBalances } from "@/integrations/token-balances";
import type { FundView, IntegrationState, PotView, StatusView } from "@/lib/api-types";
import { ledger, runtime } from "./db";

export async function statusView(): Promise<StatusView> {
  const token = tokenBalances();
  const elig = eligibility();
  const fees = feeAccounting();
  const rewards = rewardAllocation();
  const provider = rpProvider();
  const row = (key: IntegrationState["key"], label: string, i: { ready: boolean; needs?: string }): IntegrationState => ({
    key,
    label,
    ready: i.ready,
    needs: i.ready ? null : (i.needs ?? null),
  });
  return {
    integrations: [
      row("wallet", "Wallet connection", { ready: true }),
      row("token", "Token balances", token),
      row("eligibility", "Eligibility", elig),
      row("fees", "Trading-fee accounting", fees),
      row("rewards", "Reward allocation", rewards),
      row("provider", "RP-code inventory and fulfilment", provider),
    ],
    chain: CHAIN?.name ?? null,
    provider: provider.ready ? { name: provider.adapter.name, regions: await provider.adapter.regions() } : null,
  };
}

export async function potView(): Promise<PotView> {
  const fees = feeAccounting();
  if (!fees.ready) return { available: false, needs: fees.needs };
  return { available: true, pot: await fees.adapter.pot() };
}

export async function fundView(address: string): Promise<FundView> {
  const fund = ledger().getFund(address);
  const provider = rpProvider();
  const rewards = rewardAllocation();
  const elig = eligibility();
  const token = tokenBalances();
  const missing = [provider, rewards, elig].flatMap((i) => (i.ready ? [] : [i.needs]));

  const skin = fund ? skinById(fund.skinId) : undefined;
  const claim = ledger().currentClaim(address);
  if (claim) delete claim.codes;

  return {
    address,
    fund: fund ? { skinId: fund.skinId, region: fund.region, cycle: fund.cycle, updatedAt: fund.updatedAt } : null,
    // Null when the region or its cards were withdrawn after the target was saved.
    target:
      fund && skin && provider.ready
        ? await ledger()
            .target(skin, fund.region, provider.adapter)
            .then((t) => t.target)
            .catch(() => null)
        : null,
    rewards: rewards.ready
      ? {
          balance: await rewards.adapter.balance(address),
          history: await rewards.adapter.history(address),
          valuation: await rewards.adapter.valuation(),
        }
      : null,
    eligibility: elig.ready ? await elig.adapter.check(address) : null,
    token: token.ready ? await token.adapter.balanceOf(address).catch(() => null) : null,
    claim,
    missing,
  };
}

/** Everything a claim needs, or a 503 naming what is not configured. Nothing is simulated. */
export function claimPorts(): ClaimPorts {
  const provider = rpProvider();
  const rewards = rewardAllocation();
  const elig = eligibility();
  const needs = [provider, rewards, elig].flatMap((i) => (i.ready ? [] : [i.needs]));
  if (!provider.ready || !rewards.ready || !elig.ready)
    throw new LedgerError(503, `Claims are not available yet. Missing: ${needs.join("; ")}.`);
  const { persistent, claimsSealed } = runtime();
  if (!persistent || !claimsSealed) throw new LedgerError(503, "Claims are disabled: this server has no durable, encrypted claim storage.");
  return { provider: provider.adapter, rewards: rewards.adapter, eligibility: elig.adapter };
}

export function providerOr503() {
  const provider = rpProvider();
  if (!provider.ready) throw new LedgerError(503, `Not available yet. Missing: ${provider.needs}.`);
  return provider.adapter;
}
