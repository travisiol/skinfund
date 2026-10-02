import { handle } from "@/server/http";
import { potView } from "@/server/views";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => Response.json(await potView(), { headers: { "Cache-Control": "no-store" } }));
}
