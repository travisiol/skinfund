"use client";

import { useEffect, useState } from "react";
import type { AdminOverview, AdminState } from "@/lib/api-types";
import { formatDate, formatMoney, formatRp } from "@/lib/format";
import { api, ApiError } from "@/lib/session-client";
import { AngularButton } from "../AngularButton";

const short = (wallet: string) => `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border border-gold/60 bg-surface p-5 sm:p-7">
      <h2 className="display text-2xl">{title}</h2>
      {hint && <p className="mt-1 mb-5 max-w-3xl text-[0.9375rem] text-mist">{hint}</p>}
      {children}
    </section>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<"input">) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="eyebrow mb-1.5 block">{label}</span>
      <input className="field" autoComplete="off" {...props} />
    </label>
  );
}

type Claim = AdminOverview["claims"][number];

function PendingClaim({ claim, busy, run }: { claim: Claim; busy: boolean; run: (body: object) => Promise<boolean> }) {
  // One row per card sent. Cards come in fixed sizes, so the operator can send one or several and says how much RP each carries.
  const [codes, setCodes] = useState<{ rp: string; code: string }[]>([{ rp: String(claim.totalRp), code: "" }]);
  const [reason, setReason] = useState("");
  const edit = (index: number, patch: Partial<{ rp: string; code: string }>) =>
    setCodes((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const sentRp = codes.reduce((sum, row) => sum + (Number(row.rp) || 0), 0);
  const ready = codes.every((row) => row.code.trim().length >= 4 && Number.isInteger(Number(row.rp)) && Number(row.rp) > 0) && sentRp >= claim.totalRp;

  return (
    <li className="border border-teal/60 bg-night p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-lg font-semibold text-ivory">
          {claim.skin} <span className="num text-gold">{claim.region}</span>
        </p>
        <p className="num text-sm text-mist">{formatDate(claim.createdAt)}</p>
      </div>
      <p className="mt-1 text-[0.9375rem] text-mist">
        Send at least <span className="num text-teal">{formatRp(claim.totalRp)}</span> in prepaid cards for region{" "}
        <span className="num text-ivory">{claim.region}</span>. Reserved from the fund: <span className="num text-ivory">{formatMoney(claim.threshold)}</span>.
      </p>
      <p className="num mt-1 text-xs break-all text-mist">{claim.wallet}</p>
      <ul className="mt-4 space-y-3">
        {codes.map((row, index) => (
          <li key={index} className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <Field label="RP on the card" inputMode="numeric" value={row.rp} onChange={(event) => edit(index, { rp: event.target.value })} />
            </div>
            <Field label="Card code" value={row.code} onChange={(event) => edit(index, { code: event.target.value })} placeholder="Paste the code" spellCheck={false} />
            {codes.length > 1 && (
              <AngularButton size="sm" variant="outline" disabled={busy} onClick={() => setCodes((current) => current.filter((_, i) => i !== index))}>
                Remove
              </AngularButton>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="link mt-3 min-h-11 text-[0.9375rem]" onClick={() => setCodes((current) => [...current, { rp: "", code: "" }])}>
        + Add another card
      </button>
      {sentRp < claim.totalRp && <p className="mt-1 text-sm text-ember">The cards add up to {formatRp(sentRp)} — {formatRp(claim.totalRp - sentRp)} short of the skin.</p>}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <AngularButton
          disabled={busy || !ready}
          onClick={() => run({ action: "complete", id: claim.id, codes: codes.map((row) => ({ rp: Number(row.rp), code: row.code })) })}
        >
          Send code to holder
        </AngularButton>
        <Field label="Or refuse, with a reason shown to the holder" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional" />
        <AngularButton variant="outline" disabled={busy} onClick={() => run({ action: "fail", id: claim.id, reason })}>
          Refuse and release RP
        </AngularButton>
      </div>
    </li>
  );
}

function Ready({ overview, busy, run }: { overview: AdminOverview; busy: boolean; run: (body: object) => Promise<boolean> }) {
  const [region, setRegion] = useState({ code: "", label: "" });
  const [credit, setCredit] = useState({ wallet: "", amount: "", reference: "" });

  const pending = overview.claims.filter((claim) => claim.status === "pending");
  const closed = overview.claims.filter((claim) => claim.status !== "pending");

  return (
    <div className="space-y-8">
      {(!overview.storage.persistent || !overview.storage.claimsSealed) && (
        <p role="alert" className="border border-ember/60 px-4 py-3 font-medium text-ember">
          Claims are disabled on this server: {overview.storage.persistent ? "CLAIM_SECRET is not set" : "the data directory is not persistent"}. Fix it
          before holders can claim.
        </p>
      )}

      <Section
        title={`Codes to send (${pending.length})`}
        hint="A holder whose fund is full has claimed. Buy the card(s), paste the code here, and it appears on their fund page — only for them. The code is encrypted and never shown again in this panel."
      >
        {pending.length === 0 ? (
          <p className="notice">Nothing to send right now.</p>
        ) : (
          <ul className="space-y-4">
            {pending.map((claim) => (
              <PendingClaim key={claim.id} claim={claim} busy={busy} run={run} />
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Regions"
        hint="The servers holders can pick. All standard servers are open by default — hide the ones you cannot buy cards for. Hiding a region does not affect funds already started on it."
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {overview.regions.map((r) => (
            <li key={r.code} className="flex flex-wrap items-center justify-between gap-3 border bg-night px-4 py-2.5">
              <p className="font-semibold text-ivory">
                {r.label} <span className="num text-gold">{r.code}</span>
                <span className={`chip ml-3 ${r.enabled ? "chip-teal" : "chip-warn"}`}>{r.enabled ? "Open" : "Hidden"}</span>
              </p>
              <AngularButton size="sm" variant="outline" disabled={busy} onClick={() => run({ action: "region", code: r.code, label: r.label, compatibility: r.compatibility, enabled: !r.enabled })}>
                {r.enabled ? "Hide" : "Open"}
              </AngularButton>
            </li>
          ))}
        </ul>
        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await run({ action: "region", ...region })) setRegion({ code: "", label: "" });
          }}
        >
          <Field label="Add a region — code" value={region.code} onChange={(event) => setRegion({ ...region, code: event.target.value })} placeholder="e.g. SEA" />
          <Field label="Name" value={region.label} onChange={(event) => setRegion({ ...region, label: event.target.value })} placeholder="Shown to holders" />
          <AngularButton type="submit" variant="outline" disabled={busy || !region.code || !region.label}>
            Add region
          </AngularButton>
        </form>
      </Section>

      <Section
        title="Record a reward"
        hint={`When you distribute trading fees, record each holder's share here, in RP. It is added to their fund and shown in their reward history with your reference. Recorded so far: ${formatMoney(overview.totals.credited)} to ${overview.totals.wallets} wallet(s); spent on codes: ${formatMoney(overview.totals.spent)}.`}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await run({ action: "credit", ...credit })) setCredit({ wallet: "", amount: "", reference: credit.reference });
          }}
        >
          <Field label="Wallet" value={credit.wallet} onChange={(event) => setCredit({ ...credit, wallet: event.target.value })} placeholder="0x…" spellCheck={false} />
          <Field label="Amount (RP)" inputMode="numeric" value={credit.amount} onChange={(event) => setCredit({ ...credit, amount: event.target.value })} placeholder="e.g. 250" />
          <Field label="Reference" value={credit.reference} onChange={(event) => setCredit({ ...credit, reference: event.target.value })} placeholder="Which fees / distribution" />
          <AngularButton type="submit" disabled={busy || !credit.wallet || !credit.amount || !credit.reference}>
            Record reward
          </AngularButton>
        </form>
      </Section>

      <Section title={`Funds (${overview.funds.length})`} hint="Every holder who has set a target. Click a wallet to fill the reward form.">
        {overview.funds.length === 0 ? (
          <p className="notice">No holder has started a fund yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-[0.9375rem]">
              <thead className="eyebrow">
                <tr className="border-b">
                  <th className="py-2 pr-4 font-medium">Wallet</th>
                  <th className="py-2 pr-4 font-medium">Skin</th>
                  <th className="py-2 pr-4 font-medium">Region</th>
                  <th className="py-2 pr-4 text-right font-medium">Fund</th>
                  <th className="py-2 pr-4 text-right font-medium">Target</th>
                  <th className="py-2 text-right font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                {overview.funds.map((fund) => (
                  <tr key={fund.wallet} className="border-b">
                    <td className="py-2 pr-4">
                      <button type="button" className="num link" title={fund.wallet} onClick={() => setCredit((c) => ({ ...c, wallet: fund.wallet }))}>
                        {short(fund.wallet)}
                      </button>
                    </td>
                    <td className="py-2 pr-4 text-ivory">{fund.skin}</td>
                    <td className="num py-2 pr-4 text-gold">{fund.region}</td>
                    <td className="num py-2 pr-4 text-right">{formatMoney(fund.balance)}</td>
                    <td className="num py-2 pr-4 text-right">{fund.threshold ? formatMoney(fund.threshold) : "—"}</td>
                    <td className="num py-2 text-right text-teal">{fund.percent === null ? "—" : `${fund.percent}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {closed.length > 0 && (
        <Section title="Past claims">
          <ul className="border-t">
            {closed.map((claim) => (
              <li key={claim.id} className="flex flex-wrap items-baseline justify-between gap-x-6 border-b py-2.5 text-[0.9375rem]">
                <span className="text-ivory">
                  {claim.skin} <span className="num text-gold">{claim.region}</span> <span className="num text-mist">· {short(claim.wallet)}</span>
                </span>
                <span>
                  <span className={`chip ${claim.status === "completed" ? "chip-teal" : "chip-warn"}`}>{claim.status}</span>
                  <span className="num ml-3 text-mist">{formatDate(claim.updatedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

export function AdminPanel() {
  const [state, setState] = useState<AdminState | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<AdminState>("/api/admin")
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setError("The operator panel could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const attempt = async (work: () => Promise<AdminState>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      setState(await work());
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const run = (body: object) => attempt(() => api<AdminState>("/api/admin", { method: "POST", body }));

  return (
    <div>
      {error && (
        <p role="alert" className="mb-6 border border-ember/60 px-4 py-3 font-medium text-ember">
          {error}
        </p>
      )}

      {!state && !error && <p className="text-mist">Loading…</p>}

      {state?.state === "unconfigured" && (
        <div className="notice max-w-2xl">
          <p className="text-lg font-semibold text-ivory">The operator panel is switched off</p>
          <p className="mt-1">
            Set <span className="num text-ivory">ADMIN_SECRET</span> (16 characters or more) in the server environment, restart, and sign in here with
            it.
          </p>
        </div>
      )}

      {state?.state === "signed-out" && (
        <form
          className="max-w-md space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void attempt(async () => {
              await api("/api/admin/login", { method: "POST", body: { password } });
              setPassword("");
              return api<AdminState>("/api/admin");
            });
          }}
        >
          <Field label="Operator password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          <AngularButton type="submit" disabled={busy || password.length === 0}>
            Sign in
          </AngularButton>
        </form>
      )}

      {state?.state === "ready" && (
        <>
          <div className="mb-6 text-right">
            <button
              type="button"
              className="link min-h-11"
              onClick={() =>
                attempt(async () => {
                  await api("/api/admin/logout", { method: "POST" });
                  return api<AdminState>("/api/admin");
                })
              }
            >
              Sign out
            </button>
          </div>
          <Ready overview={state.overview} busy={busy} run={run} />
        </>
      )}
    </div>
  );
}
