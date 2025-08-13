import { fetchErc20Metadata } from "@/lib/erc20";
import { isAllowedChain } from "@/lib/rpc";
import { normalizeAddressForChain } from "@/lib/address";

export interface TokenResolved {
  address: string;
  decimals: number;
  symbol?: string;
}

const NATIVE_TOKEN = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export async function resolveToken(chainId: number, input: string): Promise<TokenResolved> {
  if (!isAllowedChain(chainId)) {
    throw new Error("Please select a supported chain.");
  }
  // If input is an address
  if (input.toLowerCase() === NATIVE_TOKEN) {
    return nativeForChain(chainId);
  }
  if (input.startsWith("0x")) {
    const normalized = normalizeAddressForChain(chainId, input);
    const meta = await fetchErc20Metadata(chainId, normalized);
    return meta;
  }
  if (input.toUpperCase() === "ETH") {
    return nativeForChain(chainId);
  }
  throw new Error("Please provide a token address.");
}

function nativeForChain(chainId: number): TokenResolved {
  void chainId;
  return { address: NATIVE_TOKEN, decimals: 18, symbol: "ETH" };
} 