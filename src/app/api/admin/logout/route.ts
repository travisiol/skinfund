import { assertSameOrigin, handle, PRIVATE } from "@/server/http";
import { adminLogout } from "@/server/session";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    await adminLogout();
    return Response.json({ ok: true }, PRIVATE);
  });
}
