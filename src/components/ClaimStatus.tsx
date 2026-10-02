"use client";

import { useState } from "react";
import type { Money } from "@/core/types";
import { formatMoney, formatRp } from "@/lib/format";
import { AngularButton } from "./AngularButton";

export type ClaimState =
  | { kind: "unavailable"; reason: string }
  | { kind: "not-funded"; remaining: Money }
  | { kind: "ready" }
  | { kind: "pending" }
  | { kind: "completed"; codes: { rp: number; code: string }[] }
  | { kind: "failed"; message: string };

function Code({ rp, code }: { rp: number; code: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  };
  return (
    <li className="border bg-night p-4">
      <p className="eyebrow">{formatRp(rp)} code</p>
      <p className="num mt-1 text-xl break-all text-ivory" aria-live="polite">
        {shown ? code : "•••• •••• •••• ••••"}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <AngularButton variant="outline" size="sm" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
          {shown ? "Hide code" : "Reveal code"}
        </AngularButton>
        <AngularButton size="sm" onClick={copy}>
          Copy code
        </AngularButton>
        <span role="status" className="self-center text-sm text-mist">
          {copied === "done" ? "Copied." : copied === "failed" ? "Copy blocked — reveal and copy by hand." : ""}
        </span>
      </div>
    </li>
  );
}

const STEPS = [
  "Open the League of Legends client and sign in there — never on a page that asks for your Riot password.",
  "Open the Store, then the account menu, and choose Redeem Codes.",
  "Enter the code. The RP lands on the account you are signed in to, so check the region first.",
  "Buy your skin from the Store with that RP.",
];

/** The claim, in every state it can be in. It renders what it is told; the server decides the state. */
export function ClaimStatus({ state, busy = false, onClaim }: { state: ClaimState; busy?: boolean; onClaim?: () => void }) {
  return (
    <section aria-labelledby="claim-title" aria-busy={busy || state.kind === "pending"}>
      <h2 id="claim-title" className="eyebrow mb-3">
        RP code claim
      </h2>

      {state.kind === "unavailable" && (
        <div className="notice">
          <p className="font-semibold text-ivory">Claims are not available yet</p>
          <p className="mt-1">{state.reason}</p>
        </div>
      )}

      {state.kind === "not-funded" && (
        <div className="notice">
          <p className="font-semibold text-ivory">Locked</p>
          <p className="mt-1">
            <span className="num text-ivory">{formatMoney(state.remaining)}</span> to go. The claim opens when the fund reaches its threshold. There is
            no completion date: it depends on actual trading fees.
          </p>
        </div>
      )}

      {state.kind === "ready" && (
        <div className="border border-teal/70 p-5">
          <p className="text-lg font-semibold text-ivory">Your fund is full.</p>
          <p className="mt-1 text-[0.9375rem] text-mist">
            Claiming re-checks eligibility, balance, region and code availability on the server, then requests your code. A fund can be claimed once.
          </p>
          <AngularButton className="mt-4" onClick={onClaim} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Claim my RP code
          </AngularButton>
        </div>
      )}

      {state.kind === "pending" && (
        <div className="border p-5" role="status">
          <p className="flex items-center gap-3 text-lg font-semibold text-ivory">
            <span className="spinner text-teal" aria-hidden="true" />
            Claim pending
          </p>
          <p className="mt-1 text-[0.9375rem] text-mist">Your fund is reserved and the SKINFUND operator has your request. Codes are sent by hand, so this can take a while. You can leave this page: the claim is saved, and your code will appear here.</p>
        </div>
      )}

      {state.kind === "completed" && (
        <div>
          <p className="text-lg font-semibold text-teal">Claim completed</p>
          <p className="mt-1 text-[0.9375rem] text-mist">Only you can see this. Do not share it: whoever redeems a code first keeps the RP.</p>
          <ul className="mt-4 space-y-3">
            {state.codes.map((code, index) => (
              <Code key={index} rp={code.rp} code={code.code} />
            ))}
          </ul>
          <h3 className="eyebrow mt-6 mb-2">How to redeem</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-[0.9375rem] text-mist">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {state.kind === "failed" && (
        <div role="alert" className="border border-ember/60 p-5">
          <p className="text-lg font-semibold text-ember">Claim failed</p>
          <p className="mt-1 text-[0.9375rem] text-mist">{state.message}</p>
          <AngularButton variant="outline" className="mt-4" onClick={onClaim} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Try again
          </AngularButton>
        </div>
      )}
    </section>
  );
}
