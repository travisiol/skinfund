import { assertSameOrigin, handle, PRIVATE, readJson } from "@/server/http";
import { adminLogin } from "@/server/session";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const { password } = await readJson<{ password?: string }>(request);
    const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    await adminLogin(String(password ?? ""), client);
    return Response.json({ ok: true }, PRIVATE);
  });
}
