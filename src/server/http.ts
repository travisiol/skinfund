import "server-only";
import { LedgerError } from "@/core/ledger";

/** Private responses are never cached, by the browser or anything in between. */
export const PRIVATE = { headers: { "Cache-Control": "no-store, private" } } as const;

/** Run a handler; turn known errors into JSON, and never echo internals. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    // Matched by name as well: after a dev hot reload the long-lived ledger can throw an older copy of the class.
    if (error instanceof LedgerError || (error instanceof Error && error.name === "LedgerError")) {
      const status = (error as LedgerError).status;
      return Response.json({ error: error.message }, { status: typeof status === "number" ? status : 400, ...PRIVATE });
    }
    // Log the error type only — messages can carry claim or provider details.
    console.error("[skinfund] request failed:", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "Something went wrong on our side." }, { status: 500, ...PRIVATE });
  }
}

/** Mutations must come from this site's own pages. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }
  if (!host || originHost !== host) throw new LedgerError(403, "Cross-site request refused.");
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new LedgerError(400, "Invalid request body.");
  }
}
