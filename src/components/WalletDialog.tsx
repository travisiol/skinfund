"use client";

import { useState } from "react";
import {
  closeWalletDialog,
  connectWallet,
  disconnectWallet,
  openWalletDialog,
  shortAddress,
  useWallet,
  walletErrorMessage,
} from "@/integrations/wallet";
import type { DiscoveredWallet } from "@/integrations/wallet";
import { AngularButton } from "./AngularButton";
import { Modal } from "./Modal";

const EXTENSIONS = [
  { name: "MetaMask", href: "https://metamask.io/download/" },
  { name: "Rabby", href: "https://rabby.io/" },
  { name: "Coinbase Wallet", href: "https://www.coinbase.com/wallet/downloads" },
];

/** Links that reopen this exact page inside a wallet app's own browser, where the wallet is available. */
function appLinks(): { name: string; href: string }[] {
  const url = window.location.href;
  return [
    { name: "MetaMask", href: `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, "")}` },
    { name: "Coinbase Wallet", href: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}` },
    { name: "Trust Wallet", href: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}` },
  ];
}

const optionClass = "flex min-h-12 items-center justify-between gap-3 border bg-night px-4 py-2 font-semibold text-ivory transition-colors hover:border-teal";

/** No wallet in this browser: say what to do next instead of stopping there. */
function NoWallet() {
  return (
    <div className="space-y-5">
      <p className="font-semibold text-ivory">No wallet found in this browser yet.</p>
      <div>
        <p className="eyebrow mb-2">On a phone — open this page in your wallet app</p>
        <ul className="space-y-2">
          {appLinks().map((wallet) => (
            <li key={wallet.name}>
              <a className={optionClass} href={wallet.href} rel="noopener noreferrer">
                {wallet.name}
                <span className="text-sm font-normal text-mist">Open app →</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="eyebrow mb-2">On a computer — add a wallet extension</p>
        <ul className="space-y-2">
          {EXTENSIONS.map((wallet) => (
            <li key={wallet.name}>
              <a className={optionClass} href={wallet.href} target="_blank" rel="noopener noreferrer">
                {wallet.name}
                <span className="text-sm font-normal text-mist">Install ↗</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <AngularButton variant="outline" className="w-full" onClick={() => window.location.reload()}>
        I installed one — check again
      </AngularButton>
    </div>
  );
}

export function WalletDialog() {
  const wallet = useWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    closeWalletDialog();
  };

  const connect = async (candidate: DiscoveredWallet) => {
    setBusy(candidate.id);
    setError(null);
    try {
      await connectWallet(candidate);
      close();
    } catch (e) {
      setError(walletErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={wallet.dialogOpen} onClose={close} title={wallet.address ? "Your wallet" : "Connect a wallet"}>
      {wallet.address ? (
        <div className="space-y-5">
          <div className="border p-4">
            <p className="num text-lg">{shortAddress(wallet.address)}</p>
            <p className="text-sm text-mist">Connected with {wallet.walletName}</p>
          </div>
          <p className="text-[0.9375rem] text-mist">Connecting only shares your address. It never moves funds.</p>
          <AngularButton
            variant="outline"
            className="w-full"
            onClick={() => {
              disconnectWallet();
              void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
              close();
            }}
          >
            Disconnect
          </AngularButton>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[0.9375rem] text-mist">
            Your wallet is how the fund knows what you hold. SKINFUND never asks for a seed phrase, and never for your Riot password.
          </p>
          {wallet.wallets.length > 0 ? (
            <ul className="space-y-2.5">
              {wallet.wallets.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => connect(candidate)}
                    className="flex min-h-14 w-full items-center gap-4 border bg-night p-3 text-left transition-colors hover:border-teal disabled:opacity-60"
                  >
                    {candidate.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element -- wallet-provided data URI
                      <img src={candidate.icon} alt="" className="size-9" />
                    ) : (
                      <span className="size-9 border" aria-hidden="true" />
                    )}
                    <span className="flex-1 text-lg font-semibold">{candidate.name}</span>
                    {busy === candidate.id ? <span className="spinner" /> : <span className="text-sm text-mist">Detected</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <NoWallet />
          )}
          {error && (
            <p role="alert" className="border border-ember/60 px-4 py-3 text-[0.9375rem] font-medium text-ember">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

export function WalletButton() {
  const wallet = useWallet();
  return (
    <AngularButton variant="outline" onClick={openWalletDialog} className="max-sm:min-h-11 max-sm:px-4 max-sm:text-[0.9375rem]">
      {wallet.address ? (
        <>
          <span className="size-2 bg-teal" aria-hidden="true" />
          <span className="num text-[0.9375rem]">{shortAddress(wallet.address)}</span>
        </>
      ) : (
        "Connect wallet"
      )}
    </AngularButton>
  );
}
