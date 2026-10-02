"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RULES } from "@/config/product";
import { isSelectable } from "@/core/catalogue";
import { fundingTarget, planFor } from "@/core/funding";
import type { FundingTarget, Region } from "@/core/types";
import { openWalletDialog, shortAddress, useWallet, walletErrorMessage } from "@/integrations/wallet";
import { useCatalogue, useStatus } from "@/lib/client-data";
import { formatMoney, formatRp } from "@/lib/format";
import { api, ApiError, sessionAddress, signIn } from "@/lib/session-client";
import { setApp, useApp } from "@/lib/store";
import { AngularButton } from "../AngularButton";
import { RuleText } from "../Faq";
import { RegionSelector } from "../RegionSelector";
import { SkinCard } from "../SkinCard";
import { SkinSearch } from "../SkinSearch";

const STEP_LABELS = ["Select a skin", "Redemption region", "Review"];

function Stepper({ step, reachable, onStep }: { step: number; reachable: number; onStep: (step: number) => void }) {
  return (
    <ol className="grid border-y border-gold/80 sm:grid-cols-3" aria-label="Setup steps">
      {STEP_LABELS.map((label, index) => {
        const n = index + 1;
        const current = n === step;
        return (
          <li key={label} className="border-gold/60 max-sm:border-b max-sm:last:border-b-0 sm:border-l sm:first:border-l-0">
            <button
              type="button"
              disabled={n > reachable}
              aria-current={current ? "step" : undefined}
              onClick={() => onStep(n)}
              className={`flex min-h-14 w-full items-center gap-4 px-4 py-3 text-left transition-colors disabled:opacity-45 ${current ? "bg-surface" : "hover:bg-surface/60"}`}
            >
              <span className={`num text-xl ${current ? "text-teal" : "text-gold"}`}>0{n}</span>
              <span className="text-lg font-medium text-ivory">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-1 border-b py-4 sm:grid-cols-[14rem_1fr]">
      <dt className="text-mist">{label}</dt>
      <dd className="text-ivory">{children}</dd>
    </div>
  );
}

export function SetupFlow() {
  const app = useApp();
  const wallet = useWallet();
  const router = useRouter();
  const catalogue = useCatalogue();
  const status = useStatus();
  const [stepChoice, setStepChoice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skin = catalogue.data?.skins.find((s) => s.id === app.skinId && isSelectable(s)) ?? null;
  const liveRegions = status.data?.provider?.regions ?? [];
  const regions: Region[] | null = liveRegions.length > 0 ? liveRegions : null;
  const region = regions?.find((r) => r.code === app.region) ?? null;

  // A preview of the target; the server recomputes it when the fund is saved.
  const plan = skin && region ? planFor(skin.rp!, region) : null;
  const target: FundingTarget | null = plan ? fundingTarget(plan, []) : null;

  const reachable = !skin ? 1 : !region || !target ? 2 : 3;
  const step = Math.min(stepChoice ?? (skin ? 2 : 1), reachable);
  const go = (n: number) => {
    setError(null);
    setStepChoice(n);
    document.getElementById("setup")?.scrollIntoView({ block: "start" });
  };

  const confirm = async () => {
    if (!skin || !region) return;
    setError(null);
    if (!wallet.address) {
      openWalletDialog();
      return;
    }
    setBusy(true);
    try {
      if ((await sessionAddress()) !== wallet.address) await signIn(wallet.address);
      await api("/api/fund", { method: "PUT", body: { skinId: skin.id, region: region.code } });
      router.push("/fund");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : walletErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="setup" className="scroll-mt-4">
      <Stepper step={step} reachable={reachable} onStep={go} />

      {/* ───────────── Step 1 */}
      {step === 1 && (
        <section aria-labelledby="s1" className="pt-10">
          <h2 id="s1" className="display text-3xl md:text-4xl">
            Select a skin
          </h2>
          <p className="mt-2 mb-8 max-w-2xl text-mist">
            Only skins sold for RP in the regular store can be a target. Others are listed under “All skins” with the reason they cannot be picked.
          </p>
          <SkinSearch
            selectedId={skin?.id ?? null}
            onSelect={(picked) => {
              setApp({ skinId: picked.id });
              go(2);
            }}
          />
        </section>
      )}

      {/* ───────────── Step 2 */}
      {step === 2 && skin && (
        <section aria-labelledby="s2" className="pt-10">
          <h2 id="s2" className="display text-3xl md:text-4xl">
            Redemption region
          </h2>
          <p className="mt-2 mb-8 max-w-2xl text-mist">
            For <span className="text-ivory">{skin.name}</span> at <span className="num text-ivory">{formatRp(skin.rp!)}</span>. Pick the server your
            League account is on: your RP code will be bought for that region.
          </p>

          {regions ? (
            <RegionSelector regions={regions} targetRp={skin.rp!} value={region?.code ?? null} onChange={(code) => setApp({ region: code })} />
          ) : (
            <div className="notice max-w-3xl">
              <p className="text-lg font-semibold text-ivory">
                {status.data ? "No redemption region is open yet" : status.error ? "Region data could not be loaded" : "Checking supported regions…"}
              </p>
              {status.data && (
                <>
                  <p className="mt-1">No region is open right now. Check back soon.</p>
                </>
              )}
            </div>
          )}

          <div className="mt-10 flex flex-wrap gap-4">
            <AngularButton variant="outline" onClick={() => go(1)}>
              Change skin
            </AngularButton>
            <AngularButton disabled={!region || !target} onClick={() => go(3)}>
              Review
            </AngularButton>
          </div>
        </section>
      )}

      {/* ───────────── Step 3 */}
      {step === 3 && skin && region && target && (
        <section aria-labelledby="s3" className="pt-10">
          <h2 id="s3" className="display text-3xl md:text-4xl">
            Review
          </h2>
          <div className="mt-8 grid gap-10 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-16">
            <SkinCard skin={skin} className="mx-auto w-[min(70vw,260px)] lg:mx-0" />
            <div>
              <dl className="border-t">
                <ReviewRow label="Selected skin">
                  {skin.name} <span className="text-mist">· {skin.champion}</span>
                </ReviewRow>
                <ReviewRow label="RP target">
                  <span className="num">{formatRp(skin.rp!)}</span> <span className="text-mist">· listed store price</span>
                </ReviewRow>
                <ReviewRow label="Region">
                  {region.label} <span className="num text-gold">{region.code}</span>
                  <span className="block text-[0.9375rem] text-mist">{region.compatibility}</span>
                </ReviewRow>
                <ReviewRow label="RP code">
                  <span className="num">{formatRp(target.plan.totalRp)}</span>
                  <span className="block text-[0.9375rem] text-mist">
                    Covers the skin price. Prepaid cards come in fixed sizes, so the code you receive can carry a little more RP — it stays on your
                    account.
                  </span>
                </ReviewRow>
                <ReviewRow label="Required funding threshold">
                  <span className="num">{formatMoney(target.threshold)}</span>
                  <span className="block text-[0.9375rem] text-mist">Your fund is counted in RP. It is full when it reaches the skin price.</span>
                </ReviewRow>
                <ReviewRow label="Wallet">
                  {wallet.address ? (
                    <span className="num">{shortAddress(wallet.address)}</span>
                  ) : (
                    <button type="button" className="link" onClick={openWalletDialog}>
                      Connect a wallet
                    </button>
                  )}
                </ReviewRow>
                <ReviewRow label="Good to know">
                  <div className="space-y-3 text-[0.9375rem] text-mist">
                    <RuleText rule={RULES.minimumHolding} />
                    <RuleText rule={RULES.sellOrTransfer} />
                    <RuleText rule={RULES.noVolume} />
                  </div>
                </ReviewRow>
              </dl>

              {error && (
                <p role="alert" className="mt-6 border border-ember/60 px-4 py-3 font-medium text-ember">
                  {error}
                </p>
              )}

              <div className="mt-8 flex flex-wrap gap-4">
                <AngularButton variant="outline" onClick={() => go(2)}>
                  Back
                </AngularButton>
                <AngularButton onClick={confirm} disabled={busy}>
                  {busy && <span className="spinner" aria-hidden="true" />}
                  {wallet.address ? "Sign in and start my fund" : "Connect wallet to continue"}
                </AngularButton>
              </div>
              <p className="mt-4 max-w-2xl text-sm text-mist">
                Starting a fund costs nothing and moves no funds. It records your target; rewards only accrue from actual trading fees.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
