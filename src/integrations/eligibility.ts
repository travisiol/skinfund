import "server-only";
import type { EligibilityPort } from "@/core/ports";
import { book } from "@/server/db";
import type { Integration } from "./types";

/**
 * Eligibility. While rewards are recorded by hand, the operator decides who is
 * rewarded by crediting them, so every wallet passes here. Holding rules
 * (minimum balance, holding period) are still unresolved in
 * src/config/product.ts — swap this for an on-chain check when they are decided.
 */
export function eligibility(): Integration<EligibilityPort> {
  return { ready: true, adapter: book().eligibilityPort() };
}
