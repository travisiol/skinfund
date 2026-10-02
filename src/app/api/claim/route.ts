import { skinById } from "@/integrations/catalogue";
import { ledger } from "@/server/db";
import { assertSameOrigin, handle, PRIVATE } from "@/server/http";
import { requireUser } from "@/server/session";
import { claimPorts } from "@/server/views";

/**
 * The only routes that ever carry an RP code. Both require the wallet
 * session, both answer `no-store`, and neither logs its response.
 */

/** Recover the claim for the current fund — including a completed one's code. */
export async function GET() {
  return handle(async () => Response.json({ claim: ledger().currentClaim(await requireUser()) }, PRIVATE));
}

/** Claim. Idempotent: repeating the request returns the claim already opened. */
export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const user = await requireUser();
    const claim = await ledger().requestClaim(user, skinById, claimPorts());
    return Response.json({ claim }, PRIVATE);
  });
}
