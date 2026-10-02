"use client";

import { useEffect, useState } from "react";
import { progress } from "@/core/funding";
import type { ClaimView, Skin } from "@/core/types";
import { openWalletDialog, shortAddress, useWallet, walletErrorMessage } from "@/integrations/wallet";
import type { FundView } from "@/lib/api-types";
import { useCatalogue } from "@/lib/client-data";
import { api, ApiError, sessionAddress, signIn } from "@/lib/session-client";
import { useApp, useHydrated } from "@/lib/store";
import { AngularButton, AngularLink } from "../AngularButton";
import { ClaimStatus } from "../ClaimStatus";
import type { ClaimState } from "../ClaimStatus";
import { FundSummary } from "../FundSummary";
import { ProgressGauge } from "../ProgressGauge";
import { RewardHistory } from "../RewardHistory";
import { SkinCard } from "../SkinCard";

function Layout({
  skin,
  ratio,
  funded,
  children,
}: {
  skin: Skin;
  ratio: number | null;
  funded: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-12 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-20">
      <div className="mx-auto flex items-stretch gap-5 self-start lg:sticky lg:top-8">
        <ProgressGauge orientation="vertical" percent={ratio === null ? null : progressPercent(ratio, funded)} className="my-10" />
        <SkinCard skin={skin} ratio={ratio} pulse={funded} className="w-[min(62vw,300px)]" />
      </div>
      <div className="min-w-0 space-y-12">{children}</div>
    </div>
  );
}

const progressPercent = (ratio: number, funded: boolean) => (funded ? 100 : Math.min(99, Math.floor(ratio * 100)));

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="notice max-w-2xl">
      <p className="text-lg font-semibold text-ivory">{title}</p>
      <div className="mt-2 space-y-4">{children}</div>
    </div>
  );
}

type Loaded =
  | { address: string; session: "signed-out" }
  | { address: string; session: "signed-in"; view: FundView; claim: ClaimView | null }
  | { address: string; session: "error"; message: string };

async function fetchFund(address: string): Promise<Loaded> {
  try {
    if ((await sessionAddress()) !== address) return { address, session: "signed-out" };
    const [view, claim] = await Promise.all([api<FundView>("/api/fund"), api<{ claim: ClaimView | null }>("/api/claim")]);
    return { address, session: "signed-in", view, claim: claim.claim };
  } catch (e) {
    return { address, session: "error", message: e instanceof ApiError ? e.message : "Your fund could not be loaded." };
  }
}

function LiveFund({ skins, draftSkinId }: { skins: Skin[]; draftSkinId: number | null }) {
  const wallet = useWallet();
  // Held in memory only, for as long as this page is open. Claim data is never written to storage.
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const address = wallet.address;

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchFund(address).then((result) => {
      if (!cancelled) setLoaded(result);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const current = loaded && loaded.address === address ? loaded : null;
  const view = current?.session === "signed-in" ? current.view : null;
  const claim = current?.session === "signed-in" ? current.claim : null;
  const error = actionError ?? (current?.session === "error" ? current.message : null);
  const setError = setActionError;
  const load = async (forAddress: string) => setLoaded(await fetchFund(forAddress));

  if (!address)
    return (
      <Empty title="Connect your wallet to see your fund">
        <p>Your fund is tied to the wallet that holds the token. Connecting only shares your address.</p>
        <AngularButton onClick={openWalletDialog}>Connect wallet</AngularButton>
      </Empty>
    );

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : walletErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!view)
    return (
      <Empty title={!current ? "Checking your session…" : "Sign in to open your fund"}>
        <p>
          Sign a one-time message with <span className="num text-ivory">{shortAddress(address)}</span> to prove the wallet is yours. It costs no gas
          and moves no funds.
        </p>
        {error && (
          <p role="alert" className="font-medium text-ember">
            {error}
          </p>
        )}
        <AngularButton
          disabled={busy}
          onClick={() =>
            act(async () => {
              await signIn(address);
              await load(address);
            })
          }
        >
          {busy && <span className="spinner" aria-hidden="true" />}
          Sign in with wallet
        </AngularButton>
      </Empty>
    );

  const saved = view.fund ? (skins.find((s) => s.id === view.fund!.skinId) ?? null) : null;
  const draft = skins.find((s) => s.id === draftSkinId) ?? null;
  const skin = saved ?? draft;

  if (!skin)
    return (
      <Empty title="You have no target yet">
        <p>Pick a skin and a redemption region to start your fund.</p>
        <AngularLink href="/start">Start my skin fund</AngularLink>
      </Empty>
    );

  // Once claimed, the fund's value is held (pending) or spent (completed): show it as fully funded, not as an empty balance.
  const claimed = claim?.status === "pending" || claim?.status === "completed";
  const funded = claimed && view.target ? view.target.threshold : (view.rewards?.balance ?? null);
  const p = view.target && funded && funded.currency === view.target.threshold.currency ? progress(funded, view.target.threshold) : null;

  let state: ClaimState;
  if (claim?.status === "completed" && claim.codes) state = { kind: "completed", codes: claim.codes };
  else if (claim?.status === "pending") state = { kind: "pending" };
  else if (view.missing.length > 0)
    state = { kind: "unavailable", reason: `Nothing can be claimed until these are configured: ${view.missing.join("; ")}. No reward or code is simulated in the meantime.` };
  else if (claim?.status === "failed") state = { kind: "failed", message: claim.failure ?? "The claim did not go through. Your fund was not spent." };
  else if (!saved) state = { kind: "unavailable", reason: "Finish the setup to save your target first." };
  else if (view.eligibility && !view.eligibility.eligible)
    state = { kind: "unavailable", reason: `This wallet is not eligible: ${view.eligibility.reasons.join("; ") || "see the eligibility rules"}.` };
  else if (p?.funded) state = { kind: "ready" };
  else if (p) state = { kind: "not-funded", remaining: p.remaining };
  else state = { kind: "unavailable", reason: "Funding data is not available." };

  return (
    <Layout skin={skin} ratio={p ? p.ratio : null} funded={p?.funded ?? false}>
      {!saved && (
        <p className="notice">
          <span className="font-semibold text-ivory">This target is not saved yet.</span> It is the skin you picked on this device. Finish the setup
          (region, then review) to start your fund.
        </p>
      )}
      <FundSummary
        skin={skin}
        regionLabel={view.fund?.region ?? null}
        target={view.target}
        funded={funded}
        valuationBasis={view.rewards?.valuation.basis}
        tag={claim?.status === "pending" ? "Reserved for your claim" : claim?.status === "completed" ? "Claimed" : undefined}
      />

      <section aria-labelledby="eligibility">
        <h2 id="eligibility" className="eyebrow mb-3">
          Eligibility
        </h2>
        <dl className="border-t">
          <div className="flex flex-wrap justify-between gap-x-6 border-b py-3">
            <dt className="text-mist">Wallet</dt>
            <dd className="num text-ivory">{shortAddress(view.address)}</dd>
          </div>
          {view.token && (
            <div className="flex flex-wrap justify-between gap-x-6 border-b py-3">
              <dt className="text-mist">Token balance</dt>
              <dd className="num text-ivory">
                {(Number(view.token.raw) / 10 ** view.token.decimals).toLocaleString("en-US", { maximumFractionDigits: 4 })} {view.token.symbol}
              </dd>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-x-6 border-b py-3">
            <dt className="text-mist">Status</dt>
            <dd className="text-ivory">
              {view.eligibility ? (
                view.eligibility.eligible ? (
                  <span className="chip chip-teal">Eligible</span>
                ) : (
                  <span className="chip chip-warn">Not eligible</span>
                )
              ) : (
                <span className="chip">Not configured</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {error && (
        <p role="alert" className="border border-ember/60 px-4 py-3 font-medium text-ember">
          {error}
        </p>
      )}

      <ClaimStatus
        state={state}
        busy={busy}
        onClaim={() =>
          act(async () => {
            await api<{ claim: ClaimView }>("/api/claim", { method: "POST" });
            await load(address);
          })
        }
      />

      <RewardHistory entries={view.rewards?.history ?? null} />

      <div className="flex flex-wrap gap-4">
        <AngularButton disabled={busy} onClick={() => act(() => load(address))}>
          {busy && <span className="spinner" aria-hidden="true" />}
          Refresh my fund
        </AngularButton>
        <AngularLink href="/start" variant="outline">
          Change target
        </AngularLink>
      </div>
    </Layout>
  );
}

export function FundDashboard() {
  const app = useApp();
  const hydrated = useHydrated();
  const catalogue = useCatalogue();

  if (catalogue.error) return <Empty title="The skin catalogue could not be loaded">Reload the page to try again.</Empty>;
  if (!hydrated || !catalogue.data) return <p className="text-mist">Loading your fund…</p>;

  return <LiveFund skins={catalogue.data.skins} draftSkinId={app.skinId} />;
}
