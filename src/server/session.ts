import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { LedgerError } from "@/core/ledger";
import { runtime, secretFor } from "./db";

const COOKIE = "sf_session";
const TTL_MS = 7 * 86_400_000;

/** Cookie signing key. Production must set SESSION_SECRET. */
function secret(): string | null {
  return secretFor("SESSION_SECRET", ".dev-session-secret", runtime().dataDir);
}

export function sessionsAvailable(): boolean {
  return secret() !== null;
}

function sign(payload: object): string {
  const key = secret();
  if (!key) throw new LedgerError(503, "Sign-in is not configured on this server.");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token: string | undefined): { sub: string; exp: number } | null {
  const key = secret();
  if (!key || !token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", key).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { sub: string; exp: number };
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export async function startSession(address: string) {
  (await cookies()).set(COOKIE, sign({ sub: address.toLowerCase(), exp: Date.now() + TTL_MS }), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(TTL_MS / 1000),
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<string | null> {
  return verify((await cookies()).get(COOKIE)?.value)?.sub ?? null;
}

export async function requireUser(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new LedgerError(401, "Sign in with your wallet first.");
  return user;
}

// ───────────────────────────── operator

const ADMIN_COOKIE = "sf_admin";
const ADMIN_TTL_MS = 8 * 3_600_000;

/** The operator panel exists only when ADMIN_SECRET (16+ characters) is set. */
export function adminConfigured(): boolean {
  return (process.env.ADMIN_SECRET?.length ?? 0) >= 16 && sessionsAvailable();
}

const attempts = new Map<string, { count: number; resetAt: number }>();

export async function adminLogin(password: string, clientKey: string) {
  const configured = process.env.ADMIN_SECRET;
  if (!configured || !adminConfigured()) throw new LedgerError(503, "The operator panel is not configured on this server.");

  const now = Date.now();
  const entry = attempts.get(clientKey);
  if (entry && entry.resetAt > now && entry.count >= 5) throw new LedgerError(429, "Too many attempts. Wait a minute.");
  if (!entry || entry.resetAt <= now) attempts.set(clientKey, { count: 1, resetAt: now + 60_000 });
  else entry.count++;

  const a = createHmac("sha256", "cmp").update(password).digest();
  const b = createHmac("sha256", "cmp").update(configured).digest();
  if (!timingSafeEqual(a, b)) throw new LedgerError(401, "Wrong password.");

  (await cookies()).set(ADMIN_COOKIE, sign({ sub: "operator", exp: now + ADMIN_TTL_MS }), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(ADMIN_TTL_MS / 1000),
  });
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  return verify((await cookies()).get(ADMIN_COOKIE)?.value)?.sub === "operator";
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new LedgerError(401, "Operator access required.");
}
