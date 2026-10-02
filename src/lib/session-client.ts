"use client";

import { signMessage } from "@/integrations/wallet";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** JSON fetch against this site's own API. Responses are never cached or stored client-side. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? "GET",
    cache: "no-store",
    credentials: "same-origin",
    ...(init?.body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.body) } : {}),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new ApiError(response.status, data.error ?? "The request failed.");
  return data as T;
}

export async function sessionAddress(): Promise<string | null> {
  return (await api<{ address: string | null }>("/api/auth/me")).address;
}

/** Open a session for the connected wallet by signing a one-time message. No gas, no transaction. */
export async function signIn(address: string): Promise<void> {
  const { nonce, issuedAt, message } = await api<{ nonce: string; issuedAt: string; message: string }>("/api/auth/nonce", {
    method: "POST",
    body: { address },
  });
  const signature = await signMessage(message);
  await api("/api/auth/verify", { method: "POST", body: { address, nonce, issuedAt, signature } });
}
