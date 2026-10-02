import type { Money } from "@/core/types";

export const formatRp = (rp: number): string => `${rp.toLocaleString("en-US")} RP`;

export function formatMoney(money: Money): string {
  // Funds are counted in whole RP.
  if (money.currency === "RP") return formatRp(money.minor);
  const value = (money.minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value} ${money.currency}`;
}

export function formatDate(iso: string): string {
  // Only real ISO timestamps are formatted; anything else is shown as written.
  const date = new Date(iso);
  return !/^\d{4}-\d{2}-\d{2}/.test(iso) || Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "1 × 3,500 RP" — the prepaid codes a plan is made of. */
export function describePlan(plan: { items: { denomination: { rp: number }; quantity: number }[] }): string {
  return plan.items.map((item) => `${item.quantity} × ${formatRp(item.denomination.rp)}`).join(" + ");
}
