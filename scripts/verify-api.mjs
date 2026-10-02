// End-to-end check of the live path over HTTP, with throwaway wallets.
//
//   BASE=http://localhost:3744 ADMIN_SECRET=… node scripts/verify-api.mjs
//
// Run it against a server started with a scratch SKINFUND_DATA_DIR: it writes
// test rewards and a fixture code.

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.BASE ?? "http://localhost:3744";
const ADMIN = process.env.ADMIN_SECRET;
if (!ADMIN) throw new Error("Set ADMIN_SECRET to the server's operator password.");

let passed = 0;
function check(name, ok, detail = "") {
  if (!ok) {
    console.error(`✖ ${name} ${detail}`);
    process.exit(1);
  }
  passed++;
  console.log(`✔ ${name}`);
}

/** A tiny cookie-keeping client, one per identity. */
function client() {
  const jar = new Map();
  return async (path, { method = "GET", body, origin = BASE } = {}) => {
    const response = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(method !== "GET" ? { Origin: origin } : {}),
        Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const [name, ...value] = pair.split("=");
      jar.set(name, value.join("="));
    }
    return { status: response.status, cache: response.headers.get("cache-control"), json: await response.json().catch(() => ({})) };
  };
}

async function signIn(http, account) {
  const nonce = await http("/api/auth/nonce", { method: "POST", body: { address: account.address } });
  const signature = await account.signMessage({ message: nonce.json.message });
  return http("/api/auth/verify", {
    method: "POST",
    body: { address: account.address, nonce: nonce.json.nonce, issuedAt: nonce.json.issuedAt, signature },
  });
}

const holder = privateKeyToAccount(generatePrivateKey());
const stranger = privateKeyToAccount(generatePrivateKey());
const anon = client();
const admin = client();
const user = client();
const other = client();

// ── closed doors
check("fund needs a session", (await anon("/api/fund")).status === 401);
check("claim needs a session", (await anon("/api/claim", { method: "POST" })).status === 401);
check("operator API hides its data when signed out", (await anon("/api/admin")).json.state === "signed-out");
check("operator action needs the operator cookie", (await anon("/api/admin", { method: "POST", body: { action: "credit" } })).status === 401);
check("wrong operator password is refused", (await anon("/api/admin/login", { method: "POST", body: { password: "nope" } })).status === 401);
check("cross-site operator login is refused", (await anon("/api/admin/login", { method: "POST", body: { password: ADMIN }, origin: "http://evil.example" })).status === 403);

// ── operator sets up
check("operator signs in", (await admin("/api/admin/login", { method: "POST", body: { password: ADMIN } })).status === 200);
const act = (body) => admin("/api/admin", { method: "POST", body });
const status = await anon("/api/status");
check("standard regions are open from the first run", status.json.provider.regions.map((r) => r.code).includes("EUW"));
const hidden = await act({ action: "region", code: "KR", label: "Korea", enabled: false });
check("operator can hide a region", hidden.status === 200 && !(await anon("/api/status")).json.provider.regions.some((r) => r.code === "KR"));

// ── holder signs in and starts a fund
check("holder signs in", (await signIn(user, holder)).status === 200);
check("replayed sign-in is refused", (await user("/api/auth/verify", { method: "POST", body: { address: holder.address, nonce: "0".repeat(32), issuedAt: "x", signature: "0x00" } })).status === 401);
check("unknown region refused", (await user("/api/fund", { method: "PUT", body: { skinId: 99007, region: "ZZ" } })).status === 409);
check("hidden region refused", (await user("/api/fund", { method: "PUT", body: { skinId: 99007, region: "KR" } })).status === 409);
check("unknown skin refused", (await user("/api/fund", { method: "PUT", body: { skinId: 1, region: "EUW" } })).status === 404);
const saved = await user("/api/fund", { method: "PUT", body: { skinId: 99007, region: "EUW" } });
check("fund saved, target = the skin's RP price", saved.status === 200 && saved.json.target.threshold.minor === 3250 && saved.json.target.threshold.currency === "RP", JSON.stringify(saved.json));
check("fund responses are not cacheable", /no-store/.test(saved.cache ?? ""));
check("claim refused before any reward", (await user("/api/claim", { method: "POST" })).status === 409);

// ── operator records rewards
await act({ action: "credit", wallet: holder.address, amount: "3000", reference: "Test distribution 1" });
check("claim refused while underfunded", (await user("/api/claim", { method: "POST" })).status === 409);
check("credit to a bad wallet refused", (await act({ action: "credit", wallet: "0x123", amount: "1", reference: "Test" })).status === 400);
check("a non-whole RP amount is refused", (await act({ action: "credit", wallet: holder.address, amount: "12.5", reference: "Test" })).status === 400);
await act({ action: "credit", wallet: holder.address, amount: "400", reference: "Test distribution 2" });
const funded = await user("/api/fund");
check("holder sees the recorded balance and history", funded.json.rewards.balance.minor === 3400 && funded.json.rewards.history.length === 2);

// ── claim
const claim = await user("/api/claim", { method: "POST" });
check("claim opens as pending, with no code", claim.json.claim.status === "pending" && !claim.json.claim.codes);
const again = await user("/api/claim", { method: "POST" });
check("claiming twice returns the same claim", again.json.claim.id === claim.json.claim.id);
check("the fund is reserved", (await user("/api/fund")).json.rewards.balance.minor === 150);

const queue = (await admin("/api/admin")).json.overview.claims;
check("operator sees one pending claim to send", queue.length === 1 && queue[0].status === "pending" && queue[0].wallet === holder.address.toLowerCase());
check("operator view never carries codes", !JSON.stringify(queue).includes("code\""));
check("empty code refused", (await act({ action: "complete", id: claim.json.claim.id, codes: [{ rp: 3250, code: "" }] })).status === 400);
check("cards that do not cover the skin are refused", (await act({ action: "complete", id: claim.json.claim.id, codes: [{ rp: 1380, code: "FIXTURE-SHORT" }] })).status === 400);
const sent = await act({ action: "complete", id: claim.json.claim.id, codes: [{ rp: 2800, code: "FIXTURE-AAAA-1111" }, { rp: 575, code: "FIXTURE-BBBB-2222" }] });
check("operator sends the codes", sent.status === 200 && sent.json.overview.claims[0].status === "completed");
check("operator response does not echo the codes", !JSON.stringify(sent.json).includes("FIXTURE"));
check("a completed claim cannot be completed again", (await act({ action: "complete", id: claim.json.claim.id, codes: [{ rp: 3250, code: "FIXTURE-CCCC" }] })).status === 409);

// ── holder recovers the code; nobody else can
const mine = await user("/api/claim");
check("holder recovers the codes", mine.json.claim.status === "completed" && mine.json.claim.codes.length === 2 && mine.json.claim.codes[0].code === "FIXTURE-AAAA-1111");
check("code responses are not cacheable", /no-store/.test(mine.cache ?? ""));
check("the fund view never carries codes", !JSON.stringify((await user("/api/fund")).json).includes("FIXTURE"));
await signIn(other, stranger);
check("another wallet sees no claim", (await other("/api/claim")).json.claim === null);
check("public endpoints never carry codes", !JSON.stringify([(await anon("/api/status")).json, (await anon("/api/pot")).json]).includes("FIXTURE"));

console.log(`\n${passed} checks passed against ${BASE}`);
