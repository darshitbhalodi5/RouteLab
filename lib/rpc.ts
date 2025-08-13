type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";

export const ALLOWED_CHAIN_IDS: number[] = [
  1,
  42161,
  11155111,
  421614,
  10,
  11155420,
  8453,
  84532,
  999,
];

export function isAllowedChain(chainId: number): boolean {
  return ALLOWED_CHAIN_IDS.includes(chainId);
}

function alchemyUrl(chainId: number): string | null {
  if (!ALCHEMY_API_KEY) return null;
  switch (chainId) {
    case 1:
      return `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    case 42161:
      return `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    case 11155111:
      return `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    case 421614:
      return `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    case 10:
      return `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    case 11155420:
      return `https://opt-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    case 8453:
      return `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    case 84532:
      return `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    case 999:
      return `https://hyperliquid-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    default:
      return null;
  }
}

export function getRpcUrl(chainId: number): string | null {
  const envKey = `RPC_URL_${chainId}`;
  const envVal = process.env[envKey as keyof NodeJS.ProcessEnv] as string | undefined;
  if (envVal) return envVal;
  const a = alchemyUrl(chainId);
  if (a) return a;
  return null;
}

export async function jsonRpc<T = Json>(rpcUrl: string, method: string, params: Json[] = []): Promise<T> {
  const body = {
    jsonrpc: "2.0",
    id: Math.floor(Math.random() * 1e9),
    method,
    params,
  };
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RPC ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { result?: T; error?: { code: number; message: string } };
  if (data.error) throw new Error(`RPC error ${data.error.code}: ${data.error.message}`);
  return data.result as T;
} 