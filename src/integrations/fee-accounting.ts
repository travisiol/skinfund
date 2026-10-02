import "server-only";
import type { FeeAccountingPort } from "@/core/ports";
import { book } from "@/server/db";
import type { Integration } from "./types";

/**
 * Pool-level numbers for "The pot". They come from the operator's record of
 * distributions, as totals only. Swap this for an on-chain reader once the
 * token's fee collector exists on a configured chain.
 */
export function feeAccounting(): Integration<FeeAccountingPort> {
  return { ready: true, adapter: book().feePort() };
}
