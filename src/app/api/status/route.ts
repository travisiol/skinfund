import { handle } from "@/server/http";
import { statusView } from "@/server/views";

export const dynamic = "force-dynamic";

/** Which integrations are live. Public: it carries no user data and no secrets. */
export async function GET() {
  return handle(async () => Response.json(await statusView(), { headers: { "Cache-Control": "no-store" } }));
}
