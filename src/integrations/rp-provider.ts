import "server-only";
import type { RpProviderPort } from "@/core/ports";
import { book } from "@/server/db";
import type { Integration } from "./types";

/**
 * Prepaid RP codes. The operator supplies them by hand: regions and card
 * sizes are the ones listed in /admin, and a claim waits as "pending" until
 * the operator enters the code there. This module is never bundled for the
 * browser.
 */
export function rpProvider(): Integration<RpProviderPort> {
  return { ready: true, adapter: book().providerPort() };
}
