import { handle, PRIVATE } from "@/server/http";
import { currentUser } from "@/server/session";

export async function GET() {
  return handle(async () => Response.json({ address: await currentUser() }, PRIVATE));
}
