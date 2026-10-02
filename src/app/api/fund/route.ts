import { LedgerError } from "@/core/ledger";
import { skinById } from "@/integrations/catalogue";
import { ledger } from "@/server/db";
import { assertSameOrigin, handle, PRIVATE, readJson } from "@/server/http";
import { requireUser } from "@/server/session";
import { fundView, providerOr503 } from "@/server/views";

export async function GET() {
  return handle(async () => Response.json(await fundView(await requireUser()), PRIVATE));
}

/** Set or change the target. The skin and the region are validated here, not trusted from the browser. */
export async function PUT(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const user = await requireUser();
    const { skinId, region } = await readJson<{ skinId?: unknown; region?: unknown }>(request);
    if (typeof skinId !== "number" || typeof region !== "string") throw new LedgerError(400, "Choose a skin and a region.");
    const skin = skinById(skinId);
    if (!skin) throw new LedgerError(404, "That skin is not in the catalogue.");
    const supported = (await providerOr503().regions()).find((r) => r.code === region);
    if (!supported) throw new LedgerError(409, "That region is not supported by the RP-code provider.");
    ledger().setFund(user, skin, supported);
    return Response.json(await fundView(user), PRIVATE);
  });
}
