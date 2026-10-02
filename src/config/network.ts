/**
 * The chain and token are configuration, not assumptions. Until both are set
 * the app runs without balances, eligibility or rewards and says so.
 */
export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string | null;
}

function chain(): ChainConfig | null {
  const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
  const name = process.env.NEXT_PUBLIC_CHAIN_NAME;
  const rpcUrl = process.env.NEXT_PUBLIC_CHAIN_RPC_URL;
  if (!Number.isInteger(id) || id <= 0 || !name || !rpcUrl) return null;
  return { id, name, rpcUrl, explorerUrl: process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL || null };
}

function token(): `0x${string}` | null {
  const address = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
  return address && /^0x[0-9a-fA-F]{40}$/.test(address) ? (address as `0x${string}`) : null;
}

export const CHAIN: ChainConfig | null = chain();
export const TOKEN_ADDRESS: `0x${string}` | null = token();
