import "server-only";
import { createPublicClient, erc20Abi, http } from "viem";
import { CHAIN, TOKEN_ADDRESS } from "@/config/network";
import type { TokenBalancesPort } from "@/core/ports";
import { missing } from "./types";
import type { Integration } from "./types";

/** Reads the real ERC-20 balance once a chain and token address are configured. */
export function tokenBalances(): Integration<TokenBalancesPort> {
  if (!CHAIN || !TOKEN_ADDRESS) return missing("NEXT_PUBLIC_CHAIN_* and NEXT_PUBLIC_TOKEN_ADDRESS");
  const client = createPublicClient({ transport: http(CHAIN.rpcUrl) });
  const token = { address: TOKEN_ADDRESS, abi: erc20Abi } as const;
  return {
    ready: true,
    adapter: {
      async balanceOf(wallet) {
        const [raw, decimals, symbol] = await Promise.all([
          client.readContract({ ...token, functionName: "balanceOf", args: [wallet as `0x${string}`] }),
          client.readContract({ ...token, functionName: "decimals" }),
          client.readContract({ ...token, functionName: "symbol" }),
        ]);
        return { raw: raw.toString(), decimals, symbol };
      },
    },
  };
}
