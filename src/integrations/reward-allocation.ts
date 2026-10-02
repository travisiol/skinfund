import "server-only";
import type { RewardsPort } from "@/core/ports";
import { book } from "@/server/db";
import type { Integration } from "./types";

/**
 * Per-wallet rewards. For now the operator records each distribution in
 * /admin and this reads that record — no balance is computed or estimated.
 * Swap this for a contract or indexer adapter once the allocation formula
 * and the fee collector exist.
 */
export function rewardAllocation(): Integration<RewardsPort> {
  return { ready: true, adapter: book().rewardsPort() };
}
