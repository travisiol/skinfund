import { LedgerError } from "@/core/ledger";
import { progress } from "@/core/funding";
import { skinById } from "@/integrations/catalogue";
import type { AdminOverview } from "@/lib/api-types";
import { book, ledger, runtime } from "@/server/db";
import { assertSameOrigin, handle, PRIVATE, readJson } from "@/server/http";
import { adminConfigured, isAdmin, requireAdmin } from "@/server/session";

/** The operator panel's API. Every call needs the operator cookie; nothing here ever returns a stored code. */

async function overview(): Promise<AdminOverview> {
  const provider = book().providerPort();
  const funds = await Promise.all(
    ledger()
      .listFunds()
      .map(async (fund) => {
        const skin = skinById(fund.skinId);
        const balance = book().balance(fund.wallet);
        const target = skin
          ? await ledger()
              .target(skin, fund.region, provider)
              .then((t) => t.target)
              .catch(() => null)
          : null;
        return {
          wallet: fund.wallet,
          skin: skin?.name ?? `#${fund.skinId}`,
          region: fund.region,
          balance,
          threshold: target?.threshold ?? null,
          percent: target ? progress(balance, target.threshold).percent : null,
          updatedAt: fund.updatedAt,
        };
      }),
  );
  const { persistent, claimsSealed } = runtime();
  return {
    storage: { persistent, claimsSealed },
    regions: book().listRegions(),
    funds,
    claims: ledger()
      .listClaims()
      .map((claim) => ({ ...claim, skin: skinById(claim.skinId)?.name ?? `#${claim.skinId}` })),
    totals: book().totals(),
  };
}

export async function GET() {
  return handle(async () => {
    if (!adminConfigured()) return Response.json({ state: "unconfigured" }, PRIVATE);
    if (!(await isAdmin())) return Response.json({ state: "signed-out" }, PRIVATE);
    return Response.json({ state: "ready", overview: await overview() }, PRIVATE);
  });
}

type Action =
  | { action: "region"; code: string; label: string; compatibility?: string; enabled?: boolean }
  | { action: "credit"; wallet: string; amount: string; reference: string }
  | { action: "complete"; id: string; codes: { rp: number; code: string }[] }
  | { action: "fail"; id: string; reason: string };

/** A whole, positive number of RP. */
function toRp(text: unknown): number {
  const value = String(text ?? "").trim().replace(/[\s,]/g, "");
  if (!/^\d{1,7}$/.test(value)) throw new LedgerError(400, "Enter a whole number of RP, e.g. 250.");
  return Number(value);
}

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    await requireAdmin();
    const body = await readJson<Action>(request);
    const rewards = book().rewardsPort();
    switch (body.action) {
      case "region":
        book().saveRegion(body);
        break;
      case "credit":
        book().credit({ wallet: String(body.wallet).trim(), amountMinor: toRp(body.amount), reference: String(body.reference ?? "") });
        break;
      case "complete":
        await ledger().completeClaim(String(body.id), Array.isArray(body.codes) ? body.codes : [], rewards);
        break;
      case "fail":
        await ledger().failClaim(String(body.id), String(body.reason ?? ""), rewards);
        break;
      default:
        throw new LedgerError(400, "Unknown action.");
    }
    return Response.json({ state: "ready", overview: await overview() }, PRIVATE);
  });
}
