import type { Denomination, FundingTarget, KnownCost, Money, Progress, PurchasePlan, Region } from "./types.ts";

/**
 * Funding maths. A fund is a balance of accrued rewards valued in the
 * provider's quote currency; it is "full" when it covers the cheapest set of
 * prepaid codes whose RP reaches the skin price, plus every known cost.
 * Progress is always funded value ÷ threshold — never RP already owned.
 */

function assertSameCurrency(denominations: Denomination[]): string {
  const currency = denominations[0].cost.currency;
  for (const d of denominations) {
    if (d.cost.currency !== currency) throw new Error("Denominations must share one quote currency.");
    if (!Number.isInteger(d.rp) || d.rp <= 0) throw new Error("A denomination must carry a positive whole RP amount.");
    if (!Number.isInteger(d.cost.minor) || d.cost.minor <= 0) throw new Error("A denomination must have a positive integer cost.");
  }
  return currency;
}

/**
 * The cheapest combination of prepaid codes that reaches `targetRp`.
 * Codes come in fixed sizes, so the plan usually overshoots; ties on cost are
 * broken by fewer codes, then by more RP. Returns null with no denominations.
 */
export function planPurchase(targetRp: number, denominations: Denomination[]): PurchasePlan | null {
  if (!Number.isInteger(targetRp) || targetRp <= 0) throw new Error("Target RP must be a positive whole number.");
  if (denominations.length === 0) return null;
  const currency = assertSameCurrency(denominations);

  interface Cell {
    cost: number;
    codes: number;
    rp: number;
    pick: number;
    from: number;
  }
  // best[r] = cheapest way to still need r RP covered. best[0] is "nothing left to buy".
  const best: Cell[] = [{ cost: 0, codes: 0, rp: 0, pick: -1, from: -1 }];
  for (let need = 1; need <= targetRp; need++) {
    let cell: Cell | null = null;
    denominations.forEach((d, index) => {
      const from = Math.max(0, need - d.rp);
      const prev = best[from];
      const candidate: Cell = { cost: prev.cost + d.cost.minor, codes: prev.codes + 1, rp: prev.rp + d.rp, pick: index, from };
      if (
        !cell ||
        candidate.cost < cell.cost ||
        (candidate.cost === cell.cost && (candidate.codes < cell.codes || (candidate.codes === cell.codes && candidate.rp > cell.rp)))
      )
        cell = candidate;
    });
    best.push(cell!);
  }

  const counts = new Map<number, number>();
  for (let need = targetRp; need > 0; need = best[need].from) counts.set(best[need].pick, (counts.get(best[need].pick) ?? 0) + 1);

  const items = [...counts.entries()]
    .map(([index, quantity]) => ({ denomination: denominations[index], quantity }))
    .sort((a, b) => b.denomination.rp - a.denomination.rp);
  const totalRp = best[targetRp].rp;
  return { items, totalRp, surplusRp: totalRp - targetRp, cost: { minor: best[targetRp].cost, currency } };
}

/** The unit a fund is counted in when the operator supplies exact RP. One minor unit = 1 RP. */
export const RP = "RP";

/**
 * The plan for a skin in a region. An "exact" region is funded in RP: the
 * target is the skin price, covered by the operator. Otherwise it is the
 * cheapest combination of the region's fixed card sizes.
 */
export function planFor(targetRp: number, region: Pick<Region, "denominations" | "exact">): PurchasePlan | null {
  if (!region.exact) return planPurchase(targetRp, region.denominations);
  if (!Number.isInteger(targetRp) || targetRp <= 0) throw new Error("Target RP must be a positive whole number.");
  const cost = { minor: targetRp, currency: RP };
  return { items: [{ denomination: { id: `exact-${targetRp}`, rp: targetRp, cost }, quantity: 1 }], totalRp: targetRp, surplusRp: 0, cost };
}

/** Code cost plus known costs. Costs in another currency are rejected, not converted. */
export function fundingTarget(plan: PurchasePlan, costs: KnownCost[]): FundingTarget {
  let minor = plan.cost.minor;
  for (const cost of costs) {
    if (cost.amount.currency !== plan.cost.currency) throw new Error(`Cost "${cost.label}" is not in ${plan.cost.currency}.`);
    if (!Number.isInteger(cost.amount.minor) || cost.amount.minor < 0) throw new Error(`Cost "${cost.label}" must be a non-negative integer.`);
    minor += cost.amount.minor;
  }
  return { plan, costs, threshold: { minor, currency: plan.cost.currency } };
}

export function progress(funded: Money, threshold: Money): Progress {
  if (funded.currency !== threshold.currency) throw new Error("Funded value and threshold must share a currency.");
  if (threshold.minor <= 0) throw new Error("Threshold must be positive.");
  const value = Math.max(0, funded.minor);
  const ratio = Math.min(1, value / threshold.minor);
  const isFunded = value >= threshold.minor;
  return {
    ratio,
    // Floored, and never 100 until the threshold is truly met.
    percent: isFunded ? 100 : Math.min(99, Math.floor(ratio * 100)),
    funded: isFunded,
    remaining: { minor: Math.max(0, threshold.minor - value), currency: threshold.currency },
  };
}

/** An RP-equivalent of the funded value — an estimate, to be labelled as one. */
export function estimateRp(funded: Money, target: FundingTarget): number {
  const p = progress(funded, target.threshold);
  return Math.floor(p.ratio * target.plan.totalRp);
}

export function sumMoney(entries: { amount: Money }[], currency: string): Money {
  let minor = 0;
  for (const entry of entries) {
    if (entry.amount.currency !== currency) throw new Error("Mixed currencies in reward history.");
    minor += entry.amount.minor;
  }
  return { minor, currency };
}
