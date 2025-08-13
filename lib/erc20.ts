import { getRpcUrl, jsonRpc, isAllowedChain } from "@/lib/rpc";

const FN_DECIMALS = "0x313ce567";
const FN_SYMBOL = "0x95d89b41";

export interface Erc20Metadata {
  address: string;
  decimals: number;
  symbol?: string;
}

export async function fetchErc20Metadata(chainId: number, tokenAddress: string): Promise<Erc20Metadata> {
  if (!isAllowedChain(chainId)) {
    throw new Error(`Please select a supported chain.`);
  }
  const rpc = getRpcUrl(chainId);
  if (!rpc) throw new Error(`Please select a supported chain.`);

  // Ensure there is bytecode at the address
  const code = await jsonRpc<string>(rpc, "eth_getCode", [tokenAddress, "latest"]);
  if (!code || code === "0x") {
    throw new Error("Token address not found on selected chain");
  }

  const decimalsHex = await ethCall(rpc, tokenAddress, FN_DECIMALS);
  if (!isValid32ByteReturn(decimalsHex)) {
    throw new Error("Please enter a valid ERC-20 token address");
  }
  const decimals = hexToNumber(decimalsHex);
  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("Invalid decimals value from token contract");
  }

  let symbol: string | undefined;
  try {
    const symHex = await ethCall(rpc, tokenAddress, FN_SYMBOL);
    symbol = decodeString(symHex);
  } catch {
    symbol = undefined;
  }

  return { address: tokenAddress, decimals, symbol };
}

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const result = await jsonRpc<string>(rpcUrl, "eth_call", [
    { to, data },
    "latest",
  ]);
  return result;
}

function isValid32ByteReturn(hex: string): boolean {
  if (typeof hex !== "string" || !hex.startsWith("0x")) return false;
  return hex.length >= 66;
}

function hexToNumber(hex: string): number {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return parseInt(clean.slice(-64), 16);
}

function decodeString(ret: string): string {
  const hex = ret.startsWith("0x") ? ret.slice(2) : ret;
  if (hex.length >= 128) {
    const lenHex = hex.slice(64, 128);
    const len = parseInt(lenHex, 16);
    const data = hex.slice(128, 128 + len * 2);
    return bytesToAscii(data);
  }
  return bytesToAscii(hex);
}

function bytesToAscii(hex: string): string {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (byte === 0) break;
    out.push(byte);
  }
  return String.fromCharCode(...out);
} 